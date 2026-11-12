// Preview or place an order and prevent the same checkout from placing it twice.

import { prepareOrderCounter, nextOrderNumber } from "./orderNumberService.js";
import { debitWallet } from "./walletService.js";
import { getActiveOffers } from "./campaignService.js";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import ShoppingList from "../models/ShoppingList.js";
import { createError } from "../utils/httpError.js";
import { calculateOrder } from "./orderService.js";
import { formatOrder } from "./customerOrderService.js";
import { isOnlinePaymentReady } from "./razorpayService.js";
import { updateProductStockTotal } from "./inventoryService.js";
import { validateCartItem } from "../utils/shoppingValidation.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createValidationError } from "../utils/validation.js";

// Hash the checkout details so a retry can be compared with the first request.
function createCheckoutHash(body) {
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
// Accept a retry only if its details match the order already saved.
function checkRepeatedCheckout(order, body) {
  if (order.requestFingerprint !== createCheckoutHash(body))
    throw createError(
      "This checkout request ID was already used with different details.",
      409,
    );
  return {
    status: 200,
    body: {
      success: true,
      message: "Order already placed.",
      data: { order: formatOrder(order) },
    },
  };
}
export async function previewOrder(requestData) {
  validateCheckoutForm(requestData.body);
  const user = await User.findById(requestData.user.id || requestData.user._id).select(
    "+addresses +walletBalancePaise",
  );
  if (!user) throw createError("Please sign in again.", 401);
  const offers = await getActiveOffers();
  const result = await calculateOrder({
    ...requestData,
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
          cod: true,
          razorpay: isOnlinePaymentReady(),
        },
      },
    },
  };
}
export async function placeOrder(requestData) {
  const body = validateCheckoutForm(requestData.body, true);
  const userId = requestData.user.id || requestData.user._id;
  const existing = await Order.findOne({ userId, requestId: body.requestId });
  if (existing) return checkRepeatedCheckout(existing, body);
  if (body.paymentMethod === "razorpay" && !isOnlinePaymentReady())
    throw createError(
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
        checkRepeatedCheckout(duplicate, body);
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
        (user.authVersion ?? 0) !== (requestData.user.authVersion ?? 0)
      )
        throw createError(
          "Your account is unavailable. Please sign in again.",
          403,
        );
      const offers = await getActiveOffers(session);
      const result = await calculateOrder({
        ...requestData,
        offers,
        user,
        session,
        enforceAvailability: true,
      });
      if (result.status !== 200)
        throw createError(result.body.message, result.status);
      const draft = result.checkout;
      if (draft.totalAmount !== body.expectedTotalPaise)
        throw createError("Prices changed. Review your order again.", 409);
      if (body.paymentMethod === "razorpay" && draft.totalAmount < 100)
        throw createError(
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
          throw createError(
            "Insufficient stock or product changed. Review your cart.",
            409,
          );
        if (item.variantId) await updateProductStockTotal(item.productId, session);
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
          throw createError("Coupon usage limit reached", 409);
      }
      if (!body.buyNow) {
        const cleared = await ShoppingList.updateOne(
          { _id: draft.cartId, __v: draft.cartVersion },
          { $set: { cart: [] }, $inc: { __v: 1 } },
          { session },
        );
        if (cleared.modifiedCount !== 1)
          throw createError(
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
            requestFingerprint: createCheckoutHash(body),
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
        await debitWallet(placed, requestData.user, session);
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Order.findOne({
        userId,
        requestId: body.requestId,
      });
      if (duplicate) return checkRepeatedCheckout(duplicate, body);
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
      data: { order: formatOrder(placed) },
    },
  };
}

export function validateCheckoutForm(body, placing = false) {
  validateFormFields(
    body,
    placing
      ? [
          "buyNow",
          "addressId",
          "couponCode",
          "paymentMethod",
          "requestId",
          "expectedTotalPaise",
        ]
      : ["addressId", "couponCode", "buyNow"],
  );
  if (!/^[a-f0-9]{24}$/i.test(body.addressId || ""))
    throw createValidationError("Invalid address ID");
  if (
    body.couponCode !== undefined &&
    (typeof body.couponCode !== "string" || body.couponCode.length > 40)
  )
    throw createValidationError("Invalid coupon");
  if (body.buyNow !== undefined) validateCartItem(body.buyNow);
  if (placing) {
    if (!["cod", "razorpay", "wallet"].includes(body.paymentMethod))
      throw createValidationError("Select a valid payment method.");
    if (
      typeof body.requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId)
    )
      throw createValidationError("A valid checkout request ID is required.");
    if (
      !Number.isSafeInteger(body.expectedTotalPaise) ||
      body.expectedTotalPaise < 0
    )
      throw createValidationError(
        "Review the current order total before placing your order.",
      );
  }
  return body;
}
