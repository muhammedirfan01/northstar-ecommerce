// Handle return requests, replacements and returned stock.

import { refundWallet } from "./walletService.js";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Product from "../models/Product.js";
import { updateProductStockTotal, restorePurchasedStock } from "./inventoryService.js";
import User from "../models/User.js";
import ReturnPhoto from "../models/ReturnPhoto.js";
import { uploadReturnImages, removeReturnImages } from "./returnPhotoStorage.js";
import { prepareReturnPhotos } from "./returnPhotoService.js";
import { findOrder, formatOrder } from "./customerOrderService.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";

const orderResponse = (order) => ({
  status: 200,
  body: { success: true, data: { order: formatOrder(order) } },
});
function getReturnRequestNumber(requestData) {
  const value = requestData.body.requestCycle === undefined ? 1 : requestData.body.requestCycle;
  if ((typeof value !== "number" && typeof value !== "string") || !/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw createError("Invalid request cycle. Reload the order and try again.", 400);
  return Number(value);
}
function checkReturnRequestNumber(formData, order) {
  if (getReturnRequestNumber(formData) !== (order.returnRequest?.cycle || 1)) throw createError("This request has changed. Reload the order before updating it.", 409);
}
function canRequestAnotherReturn(order) {
  const request = order.returnRequest;
  return order.orderStatus === "delivered" && order.paymentStatus === "paid" && ((request?.resolution === "replacement" && request.status === "completed" && request.replacementStatus === "delivered") || (["cancelled", "rejected"].includes(request?.status) && !request.replacementReservedAt));
}
export async function requestReturn(requestData) {
  validateFormFields(requestData.body, [
    "requestCycle",
    "resolution",
    "reason",
    "description",
    "pickupAddressId",
    "packagingConfirmed",
  ]);
  const cycle = getReturnRequestNumber(requestData);
  const {
    resolution = "refund",
    reason,
    description = "",
    pickupAddressId = "",
    packagingConfirmed,
  } = requestData.body;
  if (!["refund", "replacement"].includes(resolution)) throw createError("Choose return and refund or replacement.", 400);
  if (
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 500
  )
    throw createError("A return reason of 3–500 characters is required.", 400);
  if (typeof description !== "string" || description.length > 500)
    throw createError("Return details must be at most 500 characters.", 400);
  if (
    typeof pickupAddressId !== "string" ||
    (pickupAddressId && !/^[a-f0-9]{24}$/i.test(pickupAddressId))
  )
    throw createError("Select a valid pickup address.", 400);
  // Older return forms may send only a reason. Continue accepting them.
  const enhanced =
    packagingConfirmed !== undefined ||
    requestData.body.description !== undefined ||
    requestData.body.pickupAddressId !== undefined ||
    requestData.files?.length;
  if (enhanced && packagingConfirmed !== true && packagingConfirmed !== "true")
    throw createError(
      "Confirm packaging and accessories before submitting the return.",
      400,
    );
  const photos = await prepareReturnPhotos(requestData.files);
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        resolution,
        reason: reason.trim(),
        description: description.trim(),
        pickupAddressId,
        packagingConfirmed: Boolean(enhanced),
        photos: photos.map((photo) =>
          createHash("sha256").update(photo.bytes).digest("hex"),
        ),
      }),
    )
    .digest("hex");
  // Check that the customer can make this return before uploading photos. Check again when saving.
  const existing = await findOrder(requestData);
  if (existing.orderStatus !== "delivered")
    throw createError("Only delivered orders can be returned.", 409);
  if (resolution === "replacement" && existing.paymentStatus !== "paid")
    throw createError("Only paid, delivered orders can be replaced.", 409);
  if (cycle === (existing.returnRequest?.cycle || 1) && existing.returnRequest?.requestFingerprint === requestHash)
    return orderResponse(existing);
  await ReturnPhoto.init();
  const session = await mongoose.startSession();
  let order, uploaded = [], saved = false, usedPhotos = false;
  try {
    // Upload photos once. A database retry must not upload the same photos again.
    uploaded = await uploadReturnImages(photos);
    await session.withTransaction(async () => {
      usedPhotos = false;
      order = await findOrder(requestData, false, session);
      if (resolution === "replacement" && order.paymentStatus !== "paid") throw createError("Only paid, delivered orders can be replaced.", 409);
      if (order.orderStatus !== "delivered")
        throw createError("Only delivered orders can be returned.", 409);
      const currentCycle = order.returnRequest?.cycle || 1;
      const hasRequest = order.returnRequest?.status && order.returnRequest.status !== "none";
      const followup = hasRequest && cycle === currentCycle + 1 && canRequestAnotherReturn(order);
      if (hasRequest && !followup) {
        if (cycle === currentCycle && (order.returnRequest.requestFingerprint === requestHash || (!enhanced && (order.returnRequest.resolution || "refund") === resolution && order.returnRequest.reason === reason.trim()))) return;
        throw createError("A request already exists or has changed. Start a new request from the order page when eligible.", 409);
      }
      if (!hasRequest && cycle !== 1) throw createError("Invalid request cycle. Reload the order and try again.", 409);
      if (followup) {
        order.returnHistory.push(order.returnRequest.toObject ? order.returnRequest.toObject() : { ...order.returnRequest });
      }
      let pickupAddress = order.shippingAddress.toObject
        ? order.shippingAddress.toObject()
        : order.shippingAddress;
      if (pickupAddressId) {
        const user = await User.findById(requestData.user.id || requestData.user._id)
          .select("+addresses")
          .session(session);
        const address = user?.addresses?.id(pickupAddressId);
        if (!address)
          throw createError(
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
          uploaded.map((photo) => ({ ...photo, orderId: order._id })),
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
        requestFingerprint: requestHash,
        photos: photos.map((photo) => ({ id: String(photo._id), name: photo.name })),
        requestedAt: new Date(),
      };
      order.statusHistory.push({ status: resolution === "replacement" ? "replacement_requested" : "return_requested", at: new Date() });
      await order.save({ session });
      usedPhotos = true;
    });
    saved = true;
  } finally {
    await session.endSession();
    if (uploaded.length && (!saved || !usedPhotos)) {
      // MongoDB may have saved the return even if its reply was lost. Do not delete
      // a photo used by a saved return. Keep the photo if we cannot confirm the save result.
      try {
        const ids = uploaded.map(photo => photo._id);
        const referenced = await ReturnPhoto.find({ _id: { $in: ids } }).select("_id").lean();
        const keep = new Set(referenced.map(photo => String(photo._id)));
        await removeReturnImages(uploaded.filter(photo => !keep.has(String(photo._id))));
      } catch { console.error("Return photo cleanup deferred: database state could not be confirmed."); }
    }
  }
  return orderResponse(order);
}
export async function cancelReturn(requestData) {
  validateFormFields(requestData.body, ["requestCycle"]);
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(requestData, false, session);
      checkReturnRequestNumber(requestData, order);
      if (order.returnRequest?.status === "cancelled") return;
      const reserved = order.returnRequest?.resolution === "replacement" && order.returnRequest.status === "completed" && order.returnRequest.replacementStatus === "ready_to_ship";
      if (order.orderStatus !== "delivered" || (!["requested", "accepted"].includes(order.returnRequest?.status) && !reserved))
        throw createError("This return request can no longer be cancelled.", 409);
      if (reserved) {
        if ((order.refund?.reason === "duplicate_payment" && order.refund.status !== "completed") || (order.refund?.status && order.refund.status !== "none" && order.refund.reason !== "duplicate_payment")) throw createError("Resolve the existing refund before cancelling this replacement.", 409);
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
  return orderResponse(order);
}
export async function reviewReturn(requestData) {
  validateFormFields(requestData.body, ["decision", "note", "requestCycle"]);
  const { decision, note = "" } = requestData.body;
  if (
    !["accepted", "rejected"].includes(decision) ||
    typeof note !== "string" ||
    note.length > 500
  )
    throw createError(
      "Choose accept or reject and a note of at most 500 characters.",
      400,
    );
  const order = await findOrder(requestData, true);
  checkReturnRequestNumber(requestData, order);
  if (order.returnRequest?.status === decision) return orderResponse(order);
  if (
    order.orderStatus !== "delivered" ||
    order.returnRequest?.status !== "requested"
  )
    throw createError("There is no return awaiting review.", 409);
  Object.assign(order.returnRequest, {
    status: decision,
    reviewNote: note.trim(),
    reviewedAt: new Date(),
  });
  order.statusHistory.push({ status: `${order.returnRequest.resolution === "replacement" ? "replacement" : "return"}_${decision}`, at: new Date() });
  await order.save();
  return orderResponse(order);
}
export async function completeReturn(requestData) {
  validateFormFields(requestData.body, ["requestCycle"]);
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(requestData, true, session);
      checkReturnRequestNumber(requestData, order);
      if (order.returnRequest?.status === "completed") return;
      if (
        order.orderStatus !== "delivered" ||
        order.returnRequest?.status !== "accepted"
      )
        throw createError(
          "Accept this return before confirming receipt of the goods.",
          409,
        );
      if (order.refund?.reason === "duplicate_payment" && order.refund.status !== "completed")
        throw createError("Complete the duplicate-payment refund before cancelling or completing a return.", 409);
      if (order.returnRequest.resolution === "replacement") {
        await reserveReplacement(order, session);
        order.returnRequest.status = "completed";
        order.returnRequest.completedAt = new Date();
        order.returnRequest.replacementStatus = "ready_to_ship";
        order.statusHistory.push({ status: "replacement_ready_to_ship", at: new Date() });
        await order.save({ session });
        return;
      }
      await restorePurchasedStock(order, session);
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
  return orderResponse(order);
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
    if (reserved.modifiedCount !== 1) throw createError("Replacement stock is unavailable for the ordered option. Replenish stock before confirming receipt, or cancel the request.", 409);
    if (item.variantId) await updateProductStockTotal(item.productId, session);
  }
  order.returnRequest.replacementReservedAt = new Date();
}

export async function updateReplacement(requestData) {
  validateFormFields(requestData.body, ["status", "requestCycle"]);
  const transitions = { ready_to_ship: "shipped", shipped: "out_for_delivery", out_for_delivery: "delivered" };
  const status = requestData.body.status;
  if (!["shipped", "out_for_delivery", "delivered"].includes(status)) throw createError("Select a valid replacement delivery status.", 400);
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(requestData, true, session);
      checkReturnRequestNumber(requestData, order);
      const request = order.returnRequest;
      if (request?.resolution !== "replacement" || request.status !== "completed" || !request.replacementReservedAt) throw createError("Receive the returned goods and reserve replacement stock before dispatch.", 409);
      if (request.replacementStatus === status) return;
      if (transitions[request.replacementStatus] !== status) throw createError("Invalid replacement status transition.", 409);
      request.replacementStatus = status;
      if (status === "shipped") request.replacementShippedAt = new Date();
      if (status === "delivered") request.replacementDeliveredAt = new Date();
      order.statusHistory.push({ status: `replacement_${status}`, at: new Date() });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return orderResponse(order);
}

async function releaseReplacement(order, session) {
  if (order.returnRequest.replacementReleasedAt) return;
  for (const item of order.items) {
    const filter = { _id: item.productId }, increment = { __v: 1 };
    if (item.variantId) { filter["variants._id"] = item.variantId; increment["variants.$.stock"] = item.quantity; }
    else increment.stock = item.quantity;
    const released = await Product.updateOne(filter, { $inc: increment }, { session });
    if (released.modifiedCount !== 1) throw createError("Replacement stock could not be released. Please contact support.", 409);
    if (item.variantId) await updateProductStockTotal(item.productId, session);
  }
  order.returnRequest.replacementReleasedAt = new Date();
}
