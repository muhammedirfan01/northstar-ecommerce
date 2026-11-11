import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Order from "../models/order.js";
import { salesReport } from "../services/salesReportService.js";

test(
  "sales summary, refunds, product ranking and pagination use the entire period",
  { skip: !process.env.NORTHSTAR_INTEGRATION },
  async () => {
    const database = `northstar_codex_test_${randomUUID().replaceAll("-", "")}`;
    await mongoose.connect("mongodb://127.0.0.1:27017/?replicaSet=rs0", {
      dbName: database,
      serverSelectionTimeoutMS: 5000,
    });
    try {
      const a = new mongoose.Types.ObjectId(),
        b = new mongoose.Types.ObjectId();
      const row = (name, productId, amount, extra = {}) => ({
        orderId: name,
        createdAt: new Date("2026-11-10T04:00:00Z"),
        paymentStatus: "paid",
        orderStatus: "delivered",
        subtotal: amount,
        discount: 0,
        totalAmount: amount,
        refund: { status: "none", amount: 0 },
        items: [
          { productId, productName: name, quantity: 2, lineTotalPaise: amount },
        ],
        ...extra,
      });
      await Order.collection.insertMany([
        row("Small", a, 10000),
        row("Large", b, 40000, { discount: 5000, totalAmount: 42000 }),
        row("Partial refund", b, 20000, {
          refund: { status: "completed", amount: 10000 },
        }),
        row("Full refund", a, 30000, {
          paymentStatus: "refunded",
          refund: { status: "completed", amount: 30000 },
        }),
        row("Unpaid", a, 999999, { paymentStatus: "pending" }),
        row("Outside", a, 900000, { createdAt: new Date("2026-10-01") }),
      ]);
      const get = (query = {}) =>
        salesReport({
          query: { from: "2026-11-10", to: "2026-11-10", limit: "1", ...query },
        });
      const data = (await get()).body.data;
      assert.equal(data.summary.orders, 5);
      assert.equal(data.summary.collected, 102000);
      assert.equal(data.summary.refunded, 40000);
      assert.equal(data.summary.completedOrders, 3);
      assert.equal(data.summary.completedSales, 62000);
      assert.equal(data.orders.length, 1);
      assert.equal(data.topProducts.length, 2);
      assert.equal(data.topProducts[0].id, String(b));
      assert.equal(data.topProducts[0].netSales, 45000);
      assert.equal(data.topProducts[0].units, 4);
      assert.equal(data.topProducts[1].netSales, 10000);
      assert.equal(data.trend[0].refunded, 40000);
      assert.deepEqual(
        (await get({ page: "2" })).body.data.topProducts,
        data.topProducts,
      );
      const empty = (await get({ from: "2026-09-01", to: "2026-09-01" })).body
        .data;
      assert.equal(empty.summary.completedOrders, 0);
      assert.deepEqual(empty.topProducts, []);
      const monthly = (await get({ group: "month", paymentStatus: "paid" }))
        .body.data;
      assert.equal(monthly.trend[0].period, "2026-11");
      assert.equal(monthly.summary.orders, 3);
    } finally {
      if (
        mongoose.connection.name === database &&
        /^northstar_codex_test_[a-f0-9]{32}$/.test(database)
      )
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
