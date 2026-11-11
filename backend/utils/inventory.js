import Product from "../models/Product.js";

// Catalog availability uses the sum of listed variants as the product stock.
export const variantStockTotal = {
  $sum: {
    $map: {
      input: {
        $filter: {
          input: "$variants",
          as: "variant",
          cond: { $eq: ["$$variant.isListed", true] },
        },
      },
      as: "variant",
      in: "$$variant.stock",
    },
  },
};
export async function syncVariantStock(productId, session) {
  await Product.updateOne(
    { _id: productId },
    [{ $set: { stock: variantStockTotal } }],
    { session, updatePipeline: true },
  );
}
export async function restoreOrderStock(order, session) {
  if (order.inventoryRestoredAt) return;
  for (const item of order.items) {
    const filter = { _id: item.productId };
    const increment = { __v: 1 };
    if (item.variantId) {
      filter["variants._id"] = item.variantId;
      increment["variants.$.stock"] = item.quantity;
    } else increment.stock = item.quantity;
    const restored = await Product.updateOne(
      filter,
      { $inc: increment },
      { session },
    );
    if (restored.modifiedCount !== 1) {
      const error = new Error(
        "Inventory could not be restored. Contact support.",
      );
      error.status = 409;
      error.expose = true;
      throw error;
    }
    if (item.variantId) await syncVariantStock(item.productId, session);
  }
  order.inventoryRestoredAt = new Date();
}
