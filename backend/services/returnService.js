import { refundWallet } from "./walletService.js";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Product from "../models/Product.js";
import { syncVariantStock } from "../utils/inventory.js";
import User from "../models/User.js";
import ReturnPhoto from "../models/ReturnPhoto.js";
import { prepareReturnPhotos } from "./returnPhotoService.js";
import { findOrder, publicOrder } from "./customerOrderService.js";
import { restoreOrderStock } from "../utils/inventory.js";
import { checkFields } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";

const result = (order) => ({
  status: 200,
  body: { success: true, data: { order: publicOrder(order) } },
});
function requestCycle(input) {
  const value = input.body.requestCycle === undefined ? 1 : input.body.requestCycle;
  if ((typeof value !== "number" && typeof value !== "string") || !/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw httpError("Invalid request cycle. Reload the order and try again.", 400);
  return Number(value);
}
function checkCycle(input, order) {
  if (requestCycle(input) !== (order.returnRequest?.cycle || 1)) throw httpError("This request has changed. Reload the order before updating it.", 409);
}
function canFollowup(order) {
  const request = order.returnRequest;
  return order.orderStatus === "delivered" && order.paymentStatus === "paid" && ((request?.resolution === "replacement" && request.status === "completed" && request.replacementStatus === "delivered") || (["cancelled", "rejected"].includes(request?.status) && !request.replacementReservedAt));
}
export async function requestReturn(input) {
  checkFields(input.body, [
    "requestCycle",
    "resolution",
    "reason",
    "description",
    "pickupAddressId",
    "packagingConfirmed",
  ]);
  const cycle = requestCycle(input);
  const {
    resolution = "refund",
    reason,
    description = "",
    pickupAddressId = "",
    packagingConfirmed,
  } = input.body;
  if (!["refund", "replacement"].includes(resolution)) throw httpError("Choose return and refund or replacement.", 400);
  if (
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 500
  )
    throw httpError("A return reason of 3–500 characters is required.", 400);
  if (typeof description !== "string" || description.length > 500)
    throw httpError("Return details must be at most 500 characters.", 400);
  if (
    typeof pickupAddressId !== "string" ||
    (pickupAddressId && !/^[a-f0-9]{24}$/i.test(pickupAddressId))
  )
    throw httpError("Select a valid pickup address.", 400);
  // Reason-only JSON requests remain compatible with the original API.
  const enhanced =
    packagingConfirmed !== undefined ||
    input.body.description !== undefined ||
    input.body.pickupAddressId !== undefined ||
    input.files?.length;
  if (enhanced && packagingConfirmed !== true && packagingConfirmed !== "true")
    throw httpError(
      "Confirm packaging and accessories before submitting the return.",
      400,
    );
  const photos = await prepareReturnPhotos(input.files);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        resolution,
        reason: reason.trim(),
        description: description.trim(),
        pickupAddressId,
        packagingConfirmed: Boolean(enhanced),
        photos: photos.map((p) =>
          createHash("sha256").update(p.bytes).digest("hex"),
        ),
      }),
    )
    .digest("hex");
  await ReturnPhoto.init();
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(input, false, session);
      if (resolution === "replacement" && order.paymentStatus !== "paid") throw httpError("Only paid, delivered orders can be replaced.", 409);
      if (order.orderStatus !== "delivered")
        throw httpError("Only delivered orders can be returned.", 409);
      const currentCycle = order.returnRequest?.cycle || 1;
      const hasRequest = order.returnRequest?.status && order.returnRequest.status !== "none";
      const followup = hasRequest && cycle === currentCycle + 1 && canFollowup(order);
      if (hasRequest && !followup) {
        if (cycle === currentCycle && (order.returnRequest.requestFingerprint === fingerprint || (!enhanced && (order.returnRequest.resolution || "refund") === resolution && order.returnRequest.reason === reason.trim()))) return;
        throw httpError("A request already exists or has changed. Start a new request from the order page when eligible.", 409);
      }
      if (!hasRequest && cycle !== 1) throw httpError("Invalid request cycle. Reload the order and try again.", 409);
      if (followup) {
        order.returnHistory.push(order.returnRequest.toObject ? order.returnRequest.toObject() : { ...order.returnRequest });
      }
      let pickupAddress = order.shippingAddress.toObject
        ? order.shippingAddress.toObject()
        : order.shippingAddress;
      if (pickupAddressId) {
        const user = await User.findById(input.user.id || input.user._id)
          .select("+addresses")
          .session(session);
        const address = user?.addresses?.id(pickupAddressId);
        if (!address)
          throw httpError(
            "Pickup address not found in your saved addresses.",
            400,
          );
        pickupAddress = {
          name: address.fullName,
          phone: address.phoneNumber,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2 || "",
          city: address.city,
          state: address.state,
          pincode: address.postalCode,
        };
      }
      if (photos.length)
        await ReturnPhoto.insertMany(
          photos.map((photo) => ({ ...photo, orderId: order._id })),
          { session },
        );
      order.returnRequest = {
        cycle,
        resolution,
        status: "requested",
        reference: `${resolution === "replacement" ? "REP" : "RET"}-${order.orderId}${cycle > 1 ? `-${cycle}` : ""}`,
        reason: reason.trim(),
        description: description.trim(),
        pickupAddress,
        packagingConfirmed: Boolean(enhanced),
        requestFingerprint: fingerprint,
        photos: photos.map((p) => ({ id: String(p._id), name: p.name })),
        requestedAt: new Date(),
      };
      order.statusHistory.push({ status: resolution === "replacement" ? "replacement_requested" : "return_requested", at: new Date() });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return result(order);
}
export async function cancelReturn(input) {
  checkFields(input.body, ["requestCycle"]);
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(input, false, session);
      checkCycle(input, order);
      if (order.returnRequest?.status === "cancelled") return;
      const reserved = order.returnRequest?.resolution === "replacement" && order.returnRequest.status === "completed" && order.returnRequest.replacementStatus === "ready_to_ship";
      if (order.orderStatus !== "delivered" || (!["requested", "accepted"].includes(order.returnRequest?.status) && !reserved))
        throw httpError("This return request can no longer be cancelled.", 409);
      if (reserved) {
        if ((order.refund?.reason === "duplicate_payment" && order.refund.status !== "completed") || (order.refund?.status && order.refund.status !== "none" && order.refund.reason !== "duplicate_payment")) throw httpError("Resolve the existing refund before cancelling this replacement.", 409);
        await releaseReplacement(order, session);
        await refundWallet(order, session, { manualRefund: true });
        order.returnRequest.replacementStatus = "cancelled";
      }
      order.returnRequest.status = "cancelled";
      order.returnRequest.cancelledAt = new Date();
      order.statusHistory.push({ status: order.returnRequest.resolution === "replacement" ? "replacement_cancelled" : "return_cancelled", at: new Date() });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return result(order);
}
export async function reviewReturn(input) {
  checkFields(input.body, ["decision", "note", "requestCycle"]);
  const { decision, note = "" } = input.body;
  if (
    !["accepted", "rejected"].includes(decision) ||
    typeof note !== "string" ||
    note.length > 500
  )
    throw httpError(
      "Choose accept or reject and a note of at most 500 characters.",
      400,
    );
  const order = await findOrder(input, true);
  checkCycle(input, order);
  if (order.returnRequest?.status === decision) return result(order);
  if (
    order.orderStatus !== "delivered" ||
    order.returnRequest?.status !== "requested"
  )
    throw httpError("There is no return awaiting review.", 409);
  Object.assign(order.returnRequest, {
    status: decision,
    reviewNote: note.trim(),
    reviewedAt: new Date(),
    reviewedBy: input.user.id || input.user._id,
  });
  order.statusHistory.push({ status: `${order.returnRequest.resolution === "replacement" ? "replacement" : "return"}_${decision}`, at: new Date() });
  await order.save();
  return result(order);
}
export async function completeReturn(input) {
  checkFields(input.body, ["requestCycle"]);
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(input, true, session);
      checkCycle(input, order);
      if (order.returnRequest?.status === "completed") return;
      if (
        order.orderStatus !== "delivered" ||
        order.returnRequest?.status !== "accepted"
      )
        throw httpError(
          "Accept this return before confirming receipt of the goods.",
          409,
        );
      if (order.refund?.reason === "duplicate_payment" && order.refund.status !== "completed")
        throw httpError("Complete the duplicate-payment refund before cancelling or completing a return.", 409);
      if (order.returnRequest.resolution === "replacement") {
        await reserveReplacement(order, session);
        order.returnRequest.status = "completed";
        order.returnRequest.completedAt = new Date();
        order.returnRequest.replacementStatus = "ready_to_ship";
        order.statusHistory.push({ status: "replacement_ready_to_ship", at: new Date() });
        await order.save({ session });
        return;
      }
      await restoreOrderStock(order, session);
      order.returnRequest.status = "completed";
      order.returnRequest.completedAt = new Date();
      await refundWallet(order, session);
      if (order.paymentStatus === "paid")
        order.refund = {
          status: "pending",
          amount: order.totalAmount,
          method: "wallet",
          requestedAt: new Date(),
        };
      order.statusHistory.push({ status: "return_completed", at: new Date() });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return result(order);
}

async function reserveReplacement(order, session) {
  if (order.returnRequest.replacementReservedAt) return;
  for (const item of order.items) {
    const filter = { _id: item.productId, isListed: true, isPublished: true, deletedAt: null };
    let update;
    if (item.variantId) {
      filter.variants = { $elemMatch: { _id: item.variantId, isListed: true, stock: { $gte: item.quantity } } };
      update = { $inc: { "variants.$.stock": -item.quantity, __v: 1 } };
    } else {
      filter["variants.0"] = { $exists: false };
      filter.stock = { $gte: item.quantity };
      update = { $inc: { stock: -item.quantity, __v: 1 } };
    }
    const reserved = await Product.updateOne(filter, update, { session });
    if (reserved.modifiedCount !== 1) throw httpError("Replacement stock is unavailable for the ordered option. Replenish stock before confirming receipt, or cancel the request.", 409);
    if (item.variantId) await syncVariantStock(item.productId, session);
  }
  order.returnRequest.replacementReservedAt = new Date();
}

export async function updateReplacement(input) {
  checkFields(input.body, ["status", "requestCycle"]);
  const transitions = { ready_to_ship: "shipped", shipped: "out_for_delivery", out_for_delivery: "delivered" };
  const status = input.body.status;
  if (!["shipped", "out_for_delivery", "delivered"].includes(status)) throw httpError("Select a valid replacement delivery status.", 400);
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(input, true, session);
      checkCycle(input, order);
      const request = order.returnRequest;
      if (request?.resolution !== "replacement" || request.status !== "completed" || !request.replacementReservedAt) throw httpError("Receive the returned goods and reserve replacement stock before dispatch.", 409);
      if (request.replacementStatus === status) return;
      if (transitions[request.replacementStatus] !== status) throw httpError("Invalid replacement status transition.", 409);
      request.replacementStatus = status;
      if (status === "shipped") request.replacementShippedAt = new Date();
      if (status === "delivered") request.replacementDeliveredAt = new Date();
      order.statusHistory.push({ status: `replacement_${status}`, at: new Date() });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return result(order);
}

async function releaseReplacement(order, session) {
  if (order.returnRequest.replacementReleasedAt) return;
  for (const item of order.items) {
    const filter = { _id: item.productId }, increment = { __v: 1 };
    if (item.variantId) { filter["variants._id"] = item.variantId; increment["variants.$.stock"] = item.quantity; }
    else increment.stock = item.quantity;
    const released = await Product.updateOne(filter, { $inc: increment }, { session });
    if (released.modifiedCount !== 1) throw httpError("Replacement stock could not be released. Please contact support.", 409);
    if (item.variantId) await syncVariantStock(item.productId, session);
  }
  order.returnRequest.replacementReleasedAt = new Date();
}
