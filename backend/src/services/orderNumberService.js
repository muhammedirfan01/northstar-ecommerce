// Create readable order numbers and update older order references.

import mongoose from "mongoose";
import Order from "../models/Order.js";
import OrderCounter from "../models/OrderCounter.js";
import { createError } from "../utils/httpError.js";
import { ensureOrderIndexes } from "./orderIndexService.js";

const shortReference = /^NS-\d{4,12}$/;
export async function prepareOrderCounter(synchronize = false) {
  await Promise.all([OrderCounter.init(), ensureOrderIndexes()]);
  if (!synchronize && (await OrderCounter.exists({ _id: "orders" }))) return;
  const numbered = await Order.find({ orderId: shortReference })
    .select("orderId")
    .lean();
  const value = numbered.reduce(
    (highest, order) => Math.max(highest, Number(order.orderId.slice(3))),
    0,
  );
  try {
    await OrderCounter.updateOne(
      { _id: "orders" },
      { $max: { value } },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    await OrderCounter.updateOne({ _id: "orders" }, { $max: { value } });
  }
}
export async function nextOrderNumber(session) {
  const counter = await OrderCounter.findOneAndUpdate(
    { _id: "orders", value: { $lt: 999999999999 } },
    { $inc: { value: 1 } },
    { session, returnDocument: "after" },
  );
  if (!counter || !Number.isSafeInteger(counter.value))
    throw createError(
      "An order number could not be allocated. Please try again.",
      503,
    );
  return `NS-${String(counter.value).padStart(4, "0")}`;
}
export async function backfillOrderNumbers() {
  await prepareOrderCounter(true);
  let updated = 0;
  const oldOrders = Order.find({ orderId: { $not: shortReference } })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id")
    .lean()
    .cursor();
  for await (const row of oldOrders) {
    const session = await mongoose.startSession();
    let changed = false;
    try {
      await session.withTransaction(async () => {
        changed = false;
        const order = await Order.findById(row._id)
          .select("orderId legacyOrderId")
          .session(session);
        if (!order || shortReference.test(order.orderId)) return;
        const orderId = await nextOrderNumber(session);
        await Order.updateOne(
          { _id: order._id },
          {
            $set: {
              orderId,
              legacyOrderId: order.legacyOrderId || order.orderId,
            },
            $inc: { __v: 1 },
          },
          { session },
        );
        changed = true;
      });
      if (changed) updated++;
    } finally {
      await session.endSession();
    }
  }
  return updated;
}
