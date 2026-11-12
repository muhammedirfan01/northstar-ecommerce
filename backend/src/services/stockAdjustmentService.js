// Save a stock adjustment once, even if the same request is sent again.

import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockAdjustment from "../models/StockAdjustment.js";
import { updateStock } from "./inventoryService.js";
import { validateOrderId } from "../utils/orderValidation.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";

export async function adjustStock(requestData) {
  validateFormFields(requestData.body, [
    "variantId",
    "quantity",
    "version",
    "requestId",
  ]);
  const { variantId, quantity, version, requestId } = requestData.body;
  const productId = validateOrderId(requestData.params);
  if (
    !Number.isSafeInteger(quantity) ||
    quantity === 0 ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    throw createError(
      "Enter a valid adjustment quantity and current version.",
      400,
    );
  if (variantId !== null && !/^[a-f0-9]{24}$/i.test(variantId || ""))
    throw createError("Invalid variant ID.", 400);
  if (
    typeof requestId !== "string" ||
    !/^[-_a-zA-Z0-9]{16,80}$/.test(requestId)
  )
    throw createError("A valid adjustment request ID is required.", 400);
  function checkRepeatedAdjustment(adjustment) {
    if (
      String(adjustment.productId) !== productId.toLowerCase() ||
      String(adjustment.variantId || "") !== (variantId || "").toLowerCase() ||
      adjustment.quantity !== quantity ||
      adjustment.version !== version
    )
      throw createError("This request ID was used for another adjustment.", 409);
    return {
      status: 200,
      body: {
        success: true,
        data: { adjustmentId: String(adjustment._id), stock: adjustment.after },
      },
    };
  }
  await StockAdjustment.init();
  const existing = await StockAdjustment.findOne({ requestId });
  if (existing) return checkRepeatedAdjustment(existing);
  const session = await mongoose.startSession();
  let adjustment;
  try {
    await session.withTransaction(async () => {
      const previousAdjustment = await StockAdjustment.findOne({
        requestId,
      }).session(session);
      if (previousAdjustment) {
        checkRepeatedAdjustment(previousAdjustment);
        adjustment = previousAdjustment;
        return;
      }
      const product = await Product.findOne({
        _id: productId,
        deletedAt: null,
      }).session(session);
      if (!product) throw createError("Product not found.", 404);
      const option = variantId ? product.variants.id(variantId) : product;
      if (!option || (product.variants.length && !variantId))
        throw createError("Choose a valid product option.", 400);
      const after = option.stock + quantity;
      if (!Number.isSafeInteger(after) || after < 0 || after > 100000000)
        throw createError(
          "Adjustment would create an invalid stock balance.",
          400,
        );
      await updateStock(
        { ...requestData, body: { variantId, stock: after, version } },
        session,
      );
      [adjustment] = await StockAdjustment.create(
        [
          {
            productId,
            variantId,
            requestId,
            version,
            quantity,
            before: option.stock,
            after,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await StockAdjustment.findOne({ requestId });
      if (duplicate) return checkRepeatedAdjustment(duplicate);
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return {
    status: 201,
    body: {
      success: true,
      data: { adjustmentId: String(adjustment._id), stock: adjustment.after },
    },
  };
}

// Add the new rule that prevents duplicate requests before removing the older database rule.
export async function ensureStockAdjustmentIndexes() {
  await StockAdjustment.init();
  await StockAdjustment.collection.createIndex({ requestId: 1 }, { unique: true });
  const indexes = await StockAdjustment.collection.indexes();
  for (const index of indexes) {
    if (Object.keys(index.key).length !== 2 || index.key.adminId !== 1 || index.key.requestId !== 1) continue;
    try {
      await StockAdjustment.collection.dropIndex(index.name);
    } catch (error) {
      if (error.code !== 27) throw error;
    }
  }
}
