import test from "node:test";
import assert from "node:assert/strict";
import Order from "../src/models/Order.js";
import Product from "../src/models/Product.js";
import { exportAdminData, formatCsvValue } from "../src/services/adminExportService.js";
import { ids, account, savedOrder } from "./scenarioHelpers.js";

test("CSV fields quote commas and embedded quotes and neutralize spreadsheet formulas", () => {
  assert.equal(formatCsvValue('Laptop, "Pro"'), '"Laptop, ""Pro"""');
  for (const text of ["=1+1", "+SUM(A1)", "-1+1", "@SUM(A1)", "  =1+1"]) {
    assert.equal(formatCsvValue(text), '"\'' + text + '"');
  }
  assert.equal(formatCsvValue(null), '""');
});

test("order CSV exports matching rows with customer, item and paise-to-INR conversion", async (t) => {
  const order = savedOrder({ customer: { name: "Test Customer", email: "customer@example.test" },
    createdAt: new Date("2026-11-18T00:00:00Z"), items: [{ productName: "Headphones" }] });
  const read = t.mock.method(Order, "find", () => ({
    populate() { return this; }, sort() { return this; },
    async *cursor() { yield order; },
  }));
  const result = await exportAdminData({ user: account(), query: { status: "confirmed" } }, "orders");
  const text = result.bytes.toString("utf8");
  assert.equal(result.filename, "northstar-orders.csv");
  assert.ok(text.startsWith("\uFEFF"));
  assert.ok(text.includes('"150.00"'));
  assert.ok(text.includes('"Headphones"'));
  assert.equal(read.mock.calls[0].arguments[0].orderStatus, "confirmed");
});

test("inventory CSV retains stock zero and exports a header when there are no more rows", async (t) => {
  t.mock.method(Product, "find", () => ({
    populate() { return this; }, sort() { return this; },
    async *cursor() { yield { _id: ids.product, name: "Sold out", stock: 0, category: { name: "Audio" } }; },
  }));
  const result = await exportAdminData({ query: {} }, "inventory");
  assert.ok(result.bytes.toString().includes('"Sold out","Audio","0"'));
});
