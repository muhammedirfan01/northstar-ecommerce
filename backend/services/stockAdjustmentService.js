import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Product from "../models/Product.js";
import StockAdjustment from "../models/StockAdjustment.js";
import { updateStock } from "./inventoryService.js";
import { orderId } from "../utils/validators/order.js";
import { checkFields } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";
export async function adjustStock(input) {
  checkFields(input.body, [
    "variantId",
    "type",
    "quantity",
    "reason",
    "version",
    "requestId",
  ]);
  const { variantId, type, quantity, reason, version, requestId } = input.body;
  const productId = orderId(input.params),
    adminId = input.user.id || input.user._id;
  if (
    !["received", "correction", "loss"].includes(type) ||
    !Number.isSafeInteger(quantity) ||
    quantity === 0 ||
    (type !== "correction" && quantity < 1) ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    throw httpError(
      "Enter a valid adjustment quantity and current version.",
      400,
    );
  if (variantId !== null && !/^[a-f0-9]{24}$/i.test(variantId || ""))
    throw httpError("Invalid variant ID.", 400);
  if (
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 300
  )
    throw httpError(
      "A reason or reference of 3–300 characters is required.",
      400,
    );
  if (
    typeof requestId !== "string" ||
    !/^[-_a-zA-Z0-9]{16,80}$/.test(requestId)
  )
    throw httpError("A valid adjustment request ID is required.", 400);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        productId,
        variantId,
        type,
        quantity,
        reason.trim(),
        version,
      ]),
    )
    .digest("hex");
  function replay(record) {
    if (record.fingerprint !== fingerprint)
      throw httpError("This request ID was used for another adjustment.", 409);
    return {
      status: 200,
      body: {
        success: true,
        data: { adjustmentId: String(record._id), stock: record.after },
      },
    };
  }
  await StockAdjustment.init();
  const existing = await StockAdjustment.findOne({ adminId, requestId });
  if (existing) return replay(existing);
  const session = await mongoose.startSession();
  let record;
  try {
    await session.withTransaction(async () => {
      const previous = await StockAdjustment.findOne({
        adminId,
        requestId,
      }).session(session);
      if (previous) {
        replay(previous);
        record = previous;
        return;
      }
      const product = await Product.findOne({
        _id: productId,
        deletedAt: null,
      }).session(session);
      if (!product) throw httpError("Product not found.", 404);
      const option = variantId ? product.variants.id(variantId) : product;
      if (!option || (product.variants.length && !variantId))
        throw httpError("Choose a valid product option.", 400);
      const delta = type === "loss" ? -quantity : quantity,
        after = option.stock + delta;
      if (!Number.isSafeInteger(after) || after < 0 || after > 100000000)
        throw httpError(
          "Adjustment would create an invalid stock balance.",
          400,
        );
      await updateStock(
        { ...input, body: { variantId, stock: after, version } },
        session,
      );
      [record] = await StockAdjustment.create(
        [
          {
            productId,
            variantId,
            adminId,
            requestId,
            fingerprint,
            type,
            quantity: delta,
            before: option.stock,
            after,
            reason: reason.trim(),
          },
        ],
        { session },
      );
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await StockAdjustment.findOne({ adminId, requestId });
      if (duplicate) return replay(duplicate);
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return {
    status: 201,
    body: {
      success: true,
      data: { adjustmentId: String(record._id), stock: record.after },
    },
  };
}
