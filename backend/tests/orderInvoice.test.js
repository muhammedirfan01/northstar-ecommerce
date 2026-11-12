import { STORE } from "../src/constants/store.js";
import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import PDFDocument from "pdfkit";
import { createInvoicePdf } from "../src/services/invoiceService.js";

afterEach(() => mock.restoreAll());

test("invoice renders fixed store details without an order store snapshot", async () => {
  const texts = [];
  const text = PDFDocument.prototype.text;
  mock.method(PDFDocument.prototype, "text", function (value, ...args) {
    texts.push(String(value));
    return text.call(this, value, ...args);
  });
  const order = {
    orderId: "NS-0001", createdAt: new Date("2026-11-11T00:00:00Z"),
    orderStatus: "confirmed", paymentStatus: "paid", paymentMethod: "wallet",
    shippingAddress: { name: "Test Customer", phone: "9876543210", addressLine1: "Test Road",
      city: "Kochi", state: "Kerala", pincode: "682001" },
    items: [{ productName: "Test headphones", quantity: 2, unitPricePaise: 10000, lineTotalPaise: 20000 }],
    subtotal: 20000, shippingCharge: 5000, tax: 0, discount: 0, totalAmount: 25000,
  };
  const bytes = await createInvoicePdf(order);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(texts.includes(STORE.storeName));
  assert.ok(texts.includes("Order: NS-0001"));
  assert.ok(texts.includes("Test headphones"));
  assert.ok(texts.includes("INR 250.00"));
});
