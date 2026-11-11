import { prepareOrderCounter, nextOrderNumber } from "./orderNumberService.js";
import { debitWallet } from "./walletService.js";
import { readSettings } from "./settingsService.js";
import { activeOffers } from "./campaignService.js";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Order from "../models/order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import ShoppingList from "../models/ShoppingList.js";
import { checkoutInput } from "../utils/validators/order.js";
import { httpError } from "../utils/httpError.js";
import { checkout as validateCheckout } from "./orderService.js";
import { publicOrder } from "./customerOrderService.js";
import { paymentConfigured } from "./razorpayService.js";
import { syncVariantStock } from "../utils/inventory.js";

function fingerprint(body) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        body.addressId,
        body.couponCode?.trim().toUpperCase() || "",
        body.paymentMethod,
        body.expectedTotalPaise,
        ...(body.buyNow ? [{ productId: body.buyNow.productId.toLowerCase(), variantId: body.buyNow.variantId?.toLowerCase() || null, quantity: body.buyNow.quantity }] : []),
      ]),
    )
    .digest("hex");
}
function replay(order, body) {
  if (order.requestFingerprint !== fingerprint(body))
    throw httpError(
      "This checkout request ID was already used with different details.",
      409,
    );
  return {
    status: 200,
    body: {
      success: true,
      message: "Order already placed.",
      data: { order: publicOrder(order) },
    },
  };
}
export async function preview(input) {
  checkoutInput(input.body);
  const user = await User.findById(input.user.id || input.user._id).select(
    "+addresses +walletBalancePaise",
  );
  if (!user) throw httpError("Please sign in again.", 401);
  const settings = await readSettings(),
    offers = await activeOffers();
  const result = await validateCheckout({
    ...input,
    settings,
    offers,
    user,
    enforceAvailability: true,
  });
  if (result.status !== 200) return result;
  const { cartId, cartVersion, couponId, ...quote } = result.checkout;
  return {
    status: 200,
    body: {
      success: true,
      data: {
        ...quote,
        walletBalancePaise: user.walletBalancePaise ?? 0,
        paymentMethods: {
          wallet: (user.walletBalancePaise ?? 0) >= quote.totalAmount,
          cod: settings.codEnabled,
          razorpay: settings.onlineEnabled && paymentConfigured(),
        },
      },
    },
  };
}
export async function placeOrder(input) {
  const body = checkoutInput(input.body, true);
  const userId = input.user.id || input.user._id;
  const existing = await Order.findOne({ userId, requestId: body.requestId });
  if (existing) return replay(existing, body);
  if (body.paymentMethod === "razorpay" && !paymentConfigured())
    throw httpError(
      "Online payments are not configured yet. Choose cash on delivery.",
      503,
    );
  await prepareOrderCounter();
  const session = await mongoose.startSession();
  let placed;
  try {
    await session.withTransaction(async () => {
      const duplicate = await Order.findOne({
        userId,
        requestId: body.requestId,
      }).session(session);
      if (duplicate) {
        replay(duplicate, body);
        placed = duplicate;
        return;
      }
      const user = await User.findById(userId)
        .select("+addresses +authVersion")
        .session(session);
      if (
        !user ||
        user.isBlocked ||
        user.deletedAt ||
        !user.isEmailVerified ||
        (user.authVersion ?? 0) !== (input.user.authVersion ?? 0)
      )
        throw httpError(
          "Your account is unavailable. Please sign in again.",
          403,
        );
      const settings = await readSettings(session),
        offers = await activeOffers(session);
      if (
        (body.paymentMethod === "cod" && !settings.codEnabled) ||
        (body.paymentMethod === "razorpay" && !settings.onlineEnabled)
      )
        throw httpError(
          "This payment method is currently unavailable. Choose another method.",
          409,
        );
      const result = await validateCheckout({
        ...input,
        settings,
        offers,
        user,
        session,
        enforceAvailability: true,
      });
      if (result.status !== 200)
        throw httpError(result.body.message, result.status);
      const draft = result.checkout;
      if (draft.totalAmount !== body.expectedTotalPaise)
        throw httpError("Prices changed. Review your order again.", 409);
      if (body.paymentMethod === "razorpay" && draft.totalAmount < 100)
        throw httpError(
          "Online payment requires at least ₹1. Choose cash on delivery.",
          400,
        );
      for (const item of draft.items) {
        const filter = {
          _id: item.productId,
          isListed: true,
          isPublished: true,
          deletedAt: null,
        };
        let update;
        if (item.variantId) {
          filter.variants = {
            $elemMatch: {
              _id: item.variantId,
              isListed: true,
              pricePaise: item.unitPricePaise,
              stock: { $gte: item.quantity },
            },
          };
          update = { $inc: { "variants.$.stock": -item.quantity, __v: 1 } };
        } else {
          Object.assign(filter, {
            pricePaise: item.unitPricePaise,
            stock: { $gte: item.quantity },
            "variants.0": { $exists: false },
          });
          update = { $inc: { stock: -item.quantity, __v: 1 } };
        }
        const reserved = await Product.updateOne(filter, update, { session });
        if (reserved.modifiedCount !== 1)
          throw httpError(
            "Insufficient stock or product changed. Review your cart.",
            409,
          );
        if (item.variantId) await syncVariantStock(item.productId, session);
      }
      if (draft.couponId) {
        const now = new Date();
        const used = await Coupon.updateOne(
          {
            _id: draft.couponId,
            deletedAt: null,
            isActive: true,
            startDate: { $lte: now },
            expiryDate: { $gt: now },
            $or: [
              { usageLimit: null },
              { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
            ],
          },
          { $inc: { usedCount: 1 } },
          { session },
        );
        if (used.modifiedCount !== 1)
          throw httpError("Coupon usage limit reached", 409);
      }
      if (!body.buyNow) {
        const cleared = await ShoppingList.updateOne(
          { _id: draft.cartId, __v: draft.cartVersion },
          { $set: { cart: [] }, $inc: { __v: 1 } },
          { session },
        );
        if (cleared.modifiedCount !== 1)
          throw httpError(
            "Your cart changed. Review it before placing an order.",
            409,
          );
      }
      const { cartId, cartVersion, ...details } = draft;
      [placed] = await Order.create(
        [
          {
            ...details,
            userId,
            orderId: await nextOrderNumber(session),
            paymentMethod: body.paymentMethod,
            customer: {
              name: user.name,
              email: user.email,
              phone: user.phone || "",
            },
            paymentStatus: body.paymentMethod === "wallet" ? "paid" : "pending",
            paymentHistory: [
              {
                status: body.paymentMethod === "wallet" ? "paid" : "pending",
                at: new Date(),
                note:
                  body.paymentMethod === "cod"
                    ? "Cash due on delivery"
                    : body.paymentMethod === "wallet"
                      ? "Paid from Northstar Wallet"
                      : "Awaiting online payment",
              },
            ],
            orderStatus:
              body.paymentMethod !== "razorpay" ? "confirmed" : "pending",
            requestId: body.requestId,
            requestFingerprint: fingerprint(body),
            statusHistory: [
              {
                status:
                  body.paymentMethod !== "razorpay" ? "confirmed" : "pending",
                at: new Date(),
              },
            ],
          },
        ],
        { session },
      );
      if (body.paymentMethod === "wallet")
        await debitWallet(placed, input.user, session);
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Order.findOne({
        userId,
        requestId: body.requestId,
      });
      if (duplicate) return replay(duplicate, body);
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return {
    status: 201,
    body: {
      success: true,
      message: "Order placed successfully.",
      data: { order: publicOrder(placed) },
    },
  };
}
