// Real browser/client code with a simulated hosted Razorpay window and local API fixtures.
const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { spawn } = require("node:child_process"),
  path = require("node:path"),
  fs = require("node:fs");
const output = process.env.NORTHSTAR_SCREENSHOTS || path.join(__dirname, "../test-results/payment-methods");
fs.mkdirSync(output, { recursive: true });
const server = spawn(
  process.execPath,
  [
    path.join(__dirname, "../node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5195",
    "--strictPort",
  ],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
);
const ready = new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes("5195")) resolve();
  });
  server.once("exit", () => reject(Error("Vite stopped")));
});
const id = "111111111111111111111111";
(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage();
    let mode = "success",
      role = "customer",
      paid = false,
      starts = 0,
      verifications = 0,
      reconciliations = 0,
      paymentMethod = "razorpay",
      rejectWallet = false,
      switched = 0,
      ordersCreated = 0;
    const order = () => ({
      id,
      orderId: "NS-PAYMENT-FIXTURE",
      paymentMethod,
      paymentStatus: paid ? "paid" : "pending",
      orderStatus: paid || paymentMethod === "cod" ? "confirmed" : "pending",
      totalAmount: 15000,
      subtotal: 10000,
      shippingCharge: 5000,
      discount: 0,
      tax: 0,
      createdAt: "2026-11-09T10:00:00Z",
      items: [
        { productName: "Test headphones", quantity: 1, lineTotalPaise: 10000 },
      ],
      shippingAddress: {
        name: "Test Customer",
        phone: "9876543210",
        addressLine1: "123 Main Street",
        city: "Kochi",
        state: "Kerala",
        pincode: "682001",
      },
      customer: { name: "Test Customer", email: "customer@example.test" },
      paymentHistory: [],
      statusHistory: [],
      paymentReference: "order_fixture",
      refund: { status: "none" },
    });
    await page.route("**/api/**", async (route) => {
      if (!new URL(route.request().url()).pathname.startsWith("/api/"))
        return route.continue();
      const p = new URL(route.request().url()).pathname.slice(4),
        send = (data, status = 200) =>
          route.fulfill({
            status,
            json:
              status < 400
                ? { success: true, data }
                : { success: false, message: data },
          });
      if (p === "/auth/me" || p === "/admin/me")
        return send({
          user: {
            id,
            name: "Test Customer",
            email: "customer@example.test",
            role,
            isEmailVerified: true,
          },
        });
      if (p === "/cart") return send({ quantityTotal: 0, items: [] });
      if (p === "/wishlist") return send({ products: [{ id: "wish1" }, { id: "wish2" }, { id: "wish3" }] });
      if (p === "/support") return send({ email: "care@example.test", phone: "+919876543210" });
      if (p === "/orders" && route.request().method() === "POST") ordersCreated++;
      if (p.endsWith("/payment-method")) {
        const method = route.request().postDataJSON().paymentMethod;
        if (method === "wallet" && rejectWallet) return send("Your wallet balance is insufficient.", 409);
        paymentMethod = method;
        paid = method === "wallet";
        switched++;
        return send({ order: order() });
      }
      if (p.includes("categories")) return send({ categories: [] });
      if (p.endsWith("/payment/reconcile")) {
        reconciliations++;
        paid = true;
        return send({ order: order() });
      }
      if (p.endsWith("/payment/verify")) {
        verifications++;
        const body = route.request().postDataJSON();
        assert.deepEqual(Object.keys(body).sort(), [
          "razorpay_order_id",
          "razorpay_payment_id",
          "razorpay_signature",
        ]);
        if (mode === "verify-lost")
          return send("Verification response unavailable.", 503);
        if (mode === "verify-dismiss")
          await new Promise((resolve) => setTimeout(resolve, 120));
        paid = true;
        return send({ order: order() });
      }
      if (p.endsWith("/payment")) {
        starts++;
        return send({
          order: order(),
          checkout: paid
            ? null
            : {
                key: "rzp_test_fixture",
                order_id: "order_fixture",
                amount: 15000,
                currency: "INR",
              },
        });
      }
      if (p === "/admin/payments")
        return send({
          payments: [order()],
          summary: {
            collected: paid ? 15000 : 0,
            pending: paid ? 0 : 15000,
            failed: 0,
            refunded: 0,
          },
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        });
      if (p === `/orders/${id}` || p === `/admin/orders/${id}`)
        return send({ order: order() });
      return send({ products: [], pagination: { page: 1, totalPages: 1 } });
    });
    const origin = "http://127.0.0.1:5195";
    await page.route(origin + "/payment-harness", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><body>Local payment test harness</body></html>",
      }),
    );
    await page.goto(origin + "/payment-harness");
    await page.evaluate(async () => {
      window.payments = await import("/src/features/orders/payment.js");
      window.installRazorpay = () => {
        window.Razorpay = class {
          constructor(options) {
            this.options = options;
            this.events = {};
            window.popupOptions = options;
          }
          on(name, callback) {
            this.events[name] = callback;
          }
          close() {
            window.closedPopups = (window.closedPopups || 0) + 1;
            this.options.modal.ondismiss();
          }
          open() {
            window.openedPopups = (window.openedPopups || 0) + 1;
            if (window.mode === "failed") {
              this.events["payment.failed"]();
              return;
            }
            if (window.mode === "dismiss") {
              this.options.modal.ondismiss();
              return;
            }
            this.options.handler({
              razorpay_order_id: "order_fixture",
              razorpay_payment_id: "pay_fixture",
              razorpay_signature: "fixture",
              untrusted_extra: "ignore",
            });
            if (window.mode === "verify-dismiss")
              this.options.modal.ondismiss();
          }
        };
      };
      window.installRazorpay();
    });
    async function run(value) {
      mode = value;
      paid = false;
      await page.evaluate((value) => {
        window.mode = value;
      }, value);
      return page.evaluate(async (id) => {
        try {
          return {
            status: (await window.payments.payForOrder(id)).paymentStatus,
          };
        } catch (e) {
          return { error: e.message };
        }
      }, id);
    }
    const firstStarts = starts;
    const shared = await page.evaluate(async (id) => {
      window.mode = "success";
      const a = window.payments.payForOrder(id),
        b = window.payments.payForOrder(id);
      return {
        same: a === b,
        results: (await Promise.all([a, b])).map((o) => o.paymentStatus),
      };
    }, id);
    assert.equal(shared.same, true);
    assert.deepEqual(shared.results, ["paid", "paid"]);
    assert.equal(starts, firstStarts + 1);
    assert.equal(verifications, 1);
    assert.equal(
      await page.evaluate(() => window.popupOptions.retry.enabled),
      false,
    );
    assert.equal(
      (await run("verify-dismiss")).status,
      "paid",
      "Dismissal during verification must not report failure",
    );
    const checksBefore = reconciliations;
    assert.equal((await run("verify-lost")).status, "paid");
    assert.equal(reconciliations, checksBefore + 1);
    assert.match((await run("failed")).error, /Payment failed/);
    assert.ok(await page.evaluate(() => window.closedPopups >= 1));
    assert.match((await run("dismiss")).error, /not completed/);
    await page.evaluate(() => {
      delete window.Razorpay;
    });
    let scriptMode = "abort";
    await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
      scriptMode === "abort"
        ? route.abort()
        : route.fulfill({
            contentType: "application/javascript",
            body: "window.installRazorpay();",
          }),
    );
    assert.match((await run("success")).error, /could not load/);
    scriptMode = "success";
    assert.equal(
      (await run("success")).status,
      "paid",
      "Script load failure must be retryable",
    );
    console.log(
      "PASS: one popup per order, callback field allowlist, dismiss/verification race, lost verification response recovery, failed-window close and script reload",
    );
    paid = false;
    await page.goto(origin + `/orders/${id}/payment/failure`);
    await page.getByRole("heading", { name: "Payment Could Not Be Processed" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Check payment status", exact: true }).count(), 0);
    assert.equal(await page.getByText("Payment recovery", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("heading", { name: "Select an Alternative Channel" }).count(), 0);
    assert.equal(await page.getByRole("region", { name: "Choose payment method" }).count(), 0);
    const wishlist = page.getByRole("link", { name: "Wishlist, 3 products", exact: true });
    await wishlist.waitFor();
    assert.equal(await wishlist.locator(".cart-count").textContent(), "3");
    assert.equal(await wishlist.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(29, 32, 34)");
    assert.equal(await wishlist.evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
    const heart = await wishlist.locator('svg').boundingBox();
    const circle = await wishlist.boundingBox();
    assert.ok(Math.abs(heart.x + heart.width / 2 - circle.x - circle.width / 2) < 1, 'Wishlist icon is centered');
    const eyebrow = page.locator(".purchase-failure .purchase-eyebrow");
    const iconBounds = await eyebrow.locator("svg").boundingBox();
    const labelBounds = await eyebrow.boundingBox();
    assert.ok(Math.abs(iconBounds.y + iconBounds.height / 2 - labelBounds.y - labelBounds.height / 2) < 1, "Failure icon is vertically centered");
    const myOrders = page.getByRole("link", { name: "My orders", exact: true });
    assert.equal(await myOrders.locator("svg").count(), 1);
    await page.getByRole("heading", { name: "Customer care", exact: true }).waitFor();
    await page.getByRole("link", { name: "care@example.test", exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, "failure-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Use another method", exact: true }).click();
    const picker = page.getByRole("region", { name: "Choose payment method" });
    await picker.waitFor();
    await page.screenshot({ path: path.join(output, "alternative-methods.png"), fullPage: true });
    await picker.getByRole("button", { name: /Cash on delivery/ }).click();
    await page.getByRole("heading", { name: /Thank You for Your Order/ }).waitFor();
    assert.equal(paymentMethod, "cod");
    assert.equal(paid, false);
    assert.equal(switched, 1);
    assert.equal(ordersCreated, 0, "Switching methods reuses the saved order");
    assert.equal(await page.getByRole("link", { name: "My orders", exact: true }).locator("svg").count(), 1);
    paymentMethod = "razorpay";
    rejectWallet = true;
    await page.goto(origin + `/orders/${id}/payment/failure`);
    await page.getByRole("button", { name: "Use another method", exact: true }).click();
    await picker.getByRole("button", { name: /Northstar Wallet/ }).click();
    await page.getByRole("alert").filter({ hasText: /wallet balance is insufficient/ }).waitFor();
    assert.equal(paymentMethod, "razorpay");
    rejectWallet = false;
    await picker.getByRole("button", { name: /Northstar Wallet/ }).click();
    await page.getByRole("heading", { name: /Thank You for Your Order/ }).waitFor();
    assert.equal(paymentMethod, "wallet");
    assert.equal(ordersCreated, 0);
    paymentMethod = "razorpay";
    paid = false;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + `/orders/${id}/payment/failure`);
    await page.getByRole("button", { name: "Use another method", exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Failure page fits mobile width");
    await page.screenshot({ path: path.join(output, "failure-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => {
      window.Razorpay = class {
        constructor(options) { this.options = options; }
        on() {}
        open() { this.options.handler({ razorpay_order_id: "order_fixture", razorpay_payment_id: "pay_fixture", razorpay_signature: "fixture" }); }
        close() {}
      };
    });
    await page.goto(origin + `/orders/${id}/payment/failure`);
    await page.getByRole("button", { name: "Retry payment", exact: true }).click();
    await page.getByRole("heading", { name: /Thank You for Your Order/ }).waitFor();
    assert.equal(paid, true);
    console.log("PASS: simple failure actions, COD/wallet switching, insufficient balance, retry, aligned icon, customer care, wishlist badge and mobile layout");
    role = "admin";
    paid = false;
    await page.goto(origin + "/admin/payments");
    await page
      .getByRole("button", { name: "View payment for NS-PAYMENT-FIXTURE" })
      .click();
    await page
      .getByRole("button", { name: "Reconcile payment", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page
      .locator(".ops-table-card .ops-badge")
      .filter({ hasText: "Paid" })
      .waitFor();
    console.log(
      "PASS: customer method switching and admin payment reconciliation controls",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
