// Local UI regression fixtures; real transaction/gateway tests live in the backend.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");
const server = spawn(
  process.execPath,
  [
    path.join(__dirname, "../node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5191",
    "--strictPort",
  ],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
);
const ready = new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes("5191")) resolve();
  });
  server.once("exit", () => reject(new Error("Vite stopped")));
});
const id = "111111111111111111111111";
(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({
      channel: process.env.BROWSER_CHANNEL || "msedge",
      headless: true,
    });
    const page = await browser.newPage();
    const failures = [];
    page.on("pageerror", (e) => {
      failures.push(e.message);
      console.log("PAGE ERROR", e.message);
    });
    let role = "customer",
      stock = 9,
      version = 1,
      placed = 0,
      updated = 0,
      status = "confirmed",
      paymentStatus = "pending",
      paymentMethod = "cod";
    let returnState = "none",
      returnCount = 0,
      returnReason = "",
      refundState = "none",
      restored = 0;
    const shippingAddress = {
      name: "Asha Devi",
      phone: "9876543210",
      addressLine1: "123 Main Street",
      city: "Kochi",
      state: "Kerala",
      pincode: "682001",
    };
    const quote = {
      items: [
        {
          productName: "Test headphones",
          variantName: "",
          quantity: 1,
          lineTotalPaise: 10000,
        },
      ],
      subtotal: 10000,
      shippingCharge: 5000,
      tax: 0,
      discount: 0,
      totalAmount: 15000,
    };
    const order = () => ({
      ...quote,
      id,
      orderId: "NS-fixture-001",
      shippingAddress,
      paymentMethod,
      paymentStatus,
      orderStatus: status,
      customer: { name: "Asha Devi", email: "asha@example.test" },
      returnRequest: { status: returnState, reason: returnReason },
      refund: { status: refundState, method: "cash", amount: 15000 },
      statusHistory: [{ status, at: "2026-11-09T10:00:00Z" }],
      paymentHistory: [{ status: paymentStatus, at: "2026-11-09T10:00:00Z" }],
      createdAt: "2026-11-09T10:00:00Z",
      nextStatuses: status === "confirmed" ? ["shipped"] : [],
    });
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url()),
        endpoint = url.pathname.replace("/api", ""),
        method = route.request().method();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const body = route.request().postDataJSON?.();
      const send = (data, status = 200) =>
        route.fulfill({
          status,
          json: {
            success: status < 400,
            ...(status < 400 ? { data } : { message: data }),
          },
        });
      if (endpoint === "/auth/me" || endpoint === "/admin/me")
        return send({
          user: {
            id,
            name: "Asha Devi",
            email: "asha@example.test",
            role,
            isEmailVerified: true,
          },
        });
      if (endpoint === "/cart")
        return send({
          quantityTotal: placed ? 0 : 1,
          items: [],
          totalPaise: 10000,
        });
      if (endpoint === "/wishlist") return send({ products: [] });
      if (endpoint.includes("categories")) return send({ categories: [] });
      if (endpoint === "/addresses")
        return send({
          addresses: [
            {
              id,
              fullName: "Asha Devi",
              phoneNumber: "9876543210",
              addressLine1: "123 Main Street",
              city: "Kochi",
              state: "Kerala",
              postalCode: "682001",
              isDefault: true,
            },
          ],
        });
      if (endpoint === "/orders/preview") {
        assert.equal(body.addressId, id);
        return send(quote);
      }
      if (endpoint.endsWith("/invoice"))
        return route.fulfill({
          contentType: "application/pdf",
          headers: {
            "Content-Disposition":
              'attachment; filename="invoice-NS-fixture-001.pdf"',
          },
          body: Buffer.from("%PDF-1.4\nfixture"),
        });
      if (endpoint.endsWith("/return") && method === "POST") {
        returnCount++;
        returnReason = body.reason;
        returnState = "requested";
        return send({ order: order() });
      }
      if (endpoint.endsWith("/return/review")) {
        returnState = body.decision;
        return send({ order: order() });
      }
      if (endpoint.endsWith("/return/complete")) {
        if (returnState === "accepted") {
          restored++;
          stock++;
        }
        returnState = "completed";
        refundState = "pending";
        return send({ order: order() });
      }
      if (endpoint.endsWith("/refund")) {
        assert.ok(body.reference);
        refundState = "completed";
        paymentStatus = "refunded";
        return send({ order: order() });
      }
      if (endpoint === "/orders" && method === "POST") {
        placed++;
        assert.match(body.requestId, /^[a-z0-9-]{36}$/i);
        assert.equal(body.expectedTotalPaise, 15000);
        paymentMethod = body.paymentMethod;
        return send({ order: order() }, 201);
      }
      if (endpoint.endsWith("/payment/verify")) {
        paymentStatus = "paid";
        return send({ order: order() });
      }
      if (endpoint.endsWith("/payment"))
        return send({
          order: order(),
          checkout: {
            key: "rzp_test_fixture",
            order_id: "order_fixture",
            amount: 15000,
            currency: "INR",
          },
        });
      if (endpoint.endsWith("/cancel")) {
        assert.ok(body.reason.length >= 3);
        status = "cancelled";
        return send({ order: order() });
      }
      if (endpoint.endsWith("/status") && method === "PATCH") {
        status = body.status;
        return send({ order: order() });
      }
      if (endpoint === "/admin/inventory" && method === "GET")
        return send({
          products: [
            { id, name: "Test headphones", stock, version, variants: [] },
          ],
          pagination: { page: 1, totalPages: 1 },
        });
      if (endpoint === `/admin/inventory/${id}/adjustments`) {
        assert.equal(body.version, version);
        assert.equal(body.type, "correction");
        assert.ok(body.reason.length >= 3);
        stock += body.quantity;
        version++;
        updated++;
        return send({});
      }
      if (endpoint === "/orders" || endpoint === "/admin/orders")
        return send({
          orders: placed ? [order()] : [],
          pagination: { page: 1, totalPages: 1 },
        });
      if (endpoint === `/orders/${id}` || endpoint === `/admin/orders/${id}`)
        return send({ order: order() });
      return send({ products: [], pagination: { page: 1, totalPages: 1 } });
    });
    const origin = "http://127.0.0.1:5191";
    await page.goto(origin + "/checkout");
    assert.equal(
      await page.getByRole("button", { name: "Review order" }).count(),
      0,
    );
    await page.getByRole("button", { name: "Place COD order" }).click();
    await page
      .getByRole("heading", { name: /Thank You for Your Order/ })
      .waitFor();
    await page.getByRole("link", { name: "Track order status" }).click();
    await page.getByRole("heading", { name: "NS-fixture-001" }).waitFor();
    assert.equal(placed, 1);
    await page
      .getByRole("textbox", { name: "Cancellation reason (optional)" })
      .fill("Changed my mind");
    await page
      .getByRole("button", { name: "Cancel order", exact: true })
      .click();
    await page.getByText("Cancelled", { exact: true }).first().waitFor();
    console.log(
      "PASS: address review, server totals, COD placement, details and cancellation",
    );
    await page.goto(origin + "/orders");
    await page
      .getByRole("link", { name: "View order details", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + "/checkout");
    await page.getByRole("button", { name: "Place COD order" }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Mobile checkout overflows",
    );
    console.log("PASS: customer orders and mobile checkout layout");
    quote.paymentMethods = { cod: false, razorpay: false };
    await page.reload();
    await page
      .getByRole("alert")
      .filter({ hasText: "No payment methods are available" })
      .waitFor();
    assert.ok(
      await page
        .locator(".purchase-checkout-summary .purchase-primary.purchase-wide")
        .isDisabled(),
    );
    quote.paymentMethods = { cod: false, razorpay: true };
    quote.appliedOffers = [{ name: "Fixture audio offer", discount: 1000 }];
    quote.offerDiscount = 1000;
    quote.discount = 1000;
    quote.totalAmount = 14000;
    await page.reload();
    await page.getByText("Fixture audio offer", { exact: true }).waitFor();
    assert.ok(
      await page
        .getByRole("radio", { name: /Pay online with Razorpay/ })
        .isChecked(),
    );
    assert.ok(
      await page.getByRole("radio", { name: /Cash on delivery/ }).isDisabled(),
    );
    assert.equal(placed, 1, "Changing availability must not place an order");
    delete quote.paymentMethods;
    delete quote.appliedOffers;
    delete quote.offerDiscount;
    quote.discount = 0;
    quote.totalAmount = 15000;
    console.log(
      "PASS: checkout disables unavailable methods, selects an available method and displays automatic offers",
    );
    role = "admin";
    status = "confirmed";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + "/admin/orders/" + id);
    await page.getByRole("button", { name: "Mark shipped" }).click();
    await page.locator(".ops-badge").filter({ hasText: "Shipped" }).waitFor();
    await page.goto(origin + "/admin/inventory");
    await page
      .getByRole("button", { name: "Update stock", exact: true })
      .click();
    await page
      .getByRole("spinbutton", { name: "New stock quantity" })
      .fill("12");
    await page.getByLabel("Reason (optional)").fill("TEST-PO-001");
    await page.getByRole("button", { name: "Save stock" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(stock, 12);
    assert.equal(updated, 1);
    console.log("PASS: admin order progression and inventory update");
    role = "customer";
    status = "pending";
    paymentMethod = "razorpay";
    paymentStatus = "pending";
    await page.addInitScript(() => {
      window.Razorpay = class {
        constructor(options) {
          this.options = options;
        }
        on() {}
        open() {
          this.options.handler({
            razorpay_order_id: "order_fixture",
            razorpay_payment_id: "pay_fixture",
            razorpay_signature: "fixture",
          });
        }
      };
    });
    await page.goto(origin + "/orders/" + id);
    await page.getByRole("button", { name: "Pay / retry payment" }).click();
    await page
      .getByRole("heading", { name: /Thank You for Your Order/ })
      .waitFor();
    console.log(
      "PASS: payment retry UI and verified-payment refresh (gateway UI stub)",
    );
    status = "delivered";
    paymentMethod = "cod";
    paymentStatus = "paid";
    await page.goto(origin + "/orders/" + id);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF invoice" }).click();
    assert.equal(
      (await download).suggestedFilename(),
      "invoice-NS-fixture-001.pdf",
    );
    await page
      .getByRole("link", { name: "Return / replacement", exact: true })
      .click();
    await page.getByRole("button", { name: "Submit return request →" }).click();
    assert.equal(returnCount, 0);
    await page
      .getByLabel("Return reason · Required")
      .selectOption("Received defective or malfunctioning item");
    await page
      .getByRole("textbox", { name: /Detailed description/ })
      .fill("The item will not turn on");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Submit return request →" }).click();
    await page
      .getByRole("dialog", { name: "Return Request Submitted" })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(returnCount, 1);
    role = "admin";
    await page.goto(origin + "/admin/orders/" + id);
    await page.getByRole("button", { name: "Accept return" }).click();
    await page
      .getByRole("button", { name: "Confirm returned goods received" })
      .click();
    await page.getByRole("heading", { name: "Return: completed" }).waitFor();
    assert.equal(restored, 1);
    await page
      .getByRole("textbox", { name: "Reference confirming cash was refunded" })
      .fill("TEST-VOUCHER-001");
    await page
      .getByRole("button", { name: "Confirm cash refund paid" })
      .click();
    await page.getByRole("heading", { name: "Refund: completed" }).waitFor();
    console.log(
      "PASS: invoice download, required return reason, admin review, receipt and cash-refund record",
    );
    returnState = "requested";
    refundState = "none";
    paymentStatus = "paid";
    await page.reload();
    await page.getByRole("button", { name: "Reject return" }).click();
    await page.getByRole("heading", { name: "Return: rejected" }).waitFor();
    assert.equal(restored, 1);
    role = "customer";
    paymentMethod = "razorpay";
    paymentStatus = "pending";
    status = "pending";
    await page.goto(origin + `/orders/${id}/payment/failure`);
    await page
      .getByRole("heading", { name: "Payment Could Not Be Processed" })
      .waitFor();
    await page
      .getByRole("button", { name: "Retry payment", exact: true })
      .click();
    await page
      .getByRole("heading", { name: /Thank You for Your Order/ })
      .waitFor();
    assert.ok(page.url().endsWith("/payment/success"));
    console.log(
      "PASS: rejected returns and payment failure/success pages with retry",
    );
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
