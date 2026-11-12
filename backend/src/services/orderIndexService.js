// Keep the database rules that prevent duplicate order references.

import Order from "../models/Order.js";

export async function ensureOrderIndexes() {
  await Order.init();
  const indexes = await Order.collection.indexes();
  const obsolete = indexes.filter(
    (index) =>
      index.unique &&
      !index.sparse &&
      !index.partialFilterExpression &&
      Object.keys(index.key).length === 1 &&
      index.key.orderNumber === 1,
  );
  if (!obsolete.length || Order.schema.path("orderNumber")) return;
  // Add the current order-reference rule before removing the older database rule.
  const current = indexes.some(
    (index) =>
      index.unique &&
      !index.sparse &&
      !index.partialFilterExpression &&
      Object.keys(index.key).length === 1 &&
      index.key.orderId === 1,
  );
  if (!current) throw new Error("The required order-ID index is missing.");
  for (const index of obsolete) {
    try {
      await Order.collection.dropIndex(index.name);
    } catch (error) {
      if (error.code !== 27) throw error;
    } // Another request may already have updated this database rule.
  }
}
