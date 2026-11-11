const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { spawn } = require("node:child_process"),
  path = require("node:path"),
  fs = require("node:fs");
const server = spawn(
  process.execPath,
  [
    path.join(__dirname, "../node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5193",
    "--strictPort",
  ],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
);
const ready = new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes("5193")) resolve();
  });
  server.once("exit", () => reject(Error("Vite stopped")));
});
const id = "111111111111111111111111";
(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1166 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let lastQuery = "",
      adjustments = 0;
    const names = [
      "Aryan Malhotra",
      "Dr. Sunita Rao",
      "Kavish Nambiar",
      "Priya Varma",
      "Rohan Singhania",
      "Ananya Iyer",
      "Vikramaditya Roy",
      "Meera Sen",
    ];
    const products = [
      "Apple MacBook Pro 16-inch",
      "Sony Alpha 7 IV Mirrorless",
      "Apple Watch Series 9",
      "Studio Reference ANC V2",
      "AirPods Pro (2nd Gen)",
      "Titanium Pro S24 Ultra",
      "FX30 Cinema Line Camera",
      "ROG Zephyrus G16",
    ];
    const rows = names.map((name, i) => ({
      id: i ? id.slice(0, -1) + String(i) : id,
      orderId: `NS-${88402 - i}`,
      paymentReference: `PAY-${99201 - i}`,
      customer: {
        name,
        email: name.split(" ")[0].toLowerCase() + "@example.test",
      },
      shippingAddress: { name, phone: "9876543210" },
      items: [
        {
          productName: products[i],
          variantName: "Space Black · 256 GB",
          quantity: 1,
        },
      ],
      totalAmount: [
        19990000, 15999000, 4190000, 3490000, 2490000, 13999900, 21999000,
        18499000,
      ][i],
      paymentStatus: i === 5 ? "pending" : i === 7 ? "failed" : "paid",
      paymentMethod: i === 4 ? "cod" : "razorpay",
      orderStatus: i % 3 ? "shipped" : "pending",
      createdAt: "2026-10-12T05:52:00Z",
      paymentHistory: [
        {
          status: "paid",
          at: "2026-10-12T05:52:00Z",
          reference: "pay_fixture",
        },
      ],
    }));
    const inventory = products.map((name, i) => ({
      id: i ? id.slice(0, -1) + String(i) : id,
      name,
      stock: [3, 18, 42, 0, 85, 4, 62, 0][i],
      version: 0,
      category: { id, name: "Electronics" },
      updatedAt: "2026-11-09T05:15:00Z",
      variants: [],
    }));
    await page.route("**/api/**", async (route) => {
      const u = new URL(route.request().url());
      if (!u.pathname.startsWith("/api/")) return route.continue();
      const p = u.pathname.slice(4),
        method = route.request().method();
      lastQuery = u.search;
      const send = (data) => route.fulfill({ json: { success: true, data } });
      if (p === "/auth/me" || p === "/admin/me")
        return send({
          user: {
            id,
            name: "Store Admin",
            email: "admin@northstar.test",
            role: "admin",
          },
        });
      if (p.endsWith("/export"))
        return route.fulfill({
          contentType: "text/csv",
          body: "Order ID,Amount\nNS-88402,199900",
        });
      if (p === "/admin/dashboard")
        return send({
          customers: 36,
          products: 86,
          categories: 8,
          publishedProducts: 72,
          orders: 1428,
        });
      if (p === "/admin/orders")
        return send({
          orders: rows.slice(
            0,
            Number(u.searchParams.get("limit")) || rows.length,
          ),
          pagination: { page: 1, limit: 10, total: 1428, totalPages: 143 },
          summary: {
            total: 1428,
            fulfilled: 1360,
            pending: 44,
            delivered: 1316,
          },
        });
      if (p === "/admin/payments")
        return send({
          payments: rows,
          pagination: { page: 1, limit: 10, total: 248, totalPages: 25 },
          summary: {
            collected: 184285000,
            pending: 34280000,
            failed: 6,
            refunded: 12840000,
          },
        });
      if (p === "/admin/inventory")
        return send({
          products: inventory,
          categories: [{ id, name: "Electronics" }],
          pagination: { page: 1, limit: 10, total: 86, totalPages: 9 },
          summary: { total: 86, lowStock: 7, outOfStock: 3 },
        });
      if (p.endsWith("/adjustments")) {
        const body = route.request().postDataJSON();
        assert.equal(body.type, "correction");
        assert.equal(body.quantity, 10);
        assert.ok(body.reason);
        assert.ok(body.requestId);
        adjustments++;
        return send({ stock: 13 });
      }
      if (p.includes("categories")) return send({ categories: [] });
      return send({ products: [], pagination: { page: 1, totalPages: 1 } });
    });
    const base = "http://127.0.0.1:5193";
    async function screenshot(name) {
      if (process.env.NORTHSTAR_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.NORTHSTAR_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(process.env.NORTHSTAR_SCREENSHOT_DIR, name + ".png"),
          fullPage: true,
        });
      }
    }
    await page.goto(base + "/admin/orders");
    await page.getByRole("heading", { name: "Orders" }).waitFor();
    await page.getByText("Aryan Malhotra", { exact: true }).waitFor();
    assert.equal(await page.locator(".ops-summary > span").count(), 4);
    await screenshot("admin-orders");
    await page
      .getByRole("combobox", { name: "Order status", exact: true })
      .selectOption("pending");
    await page.waitForTimeout(200);
    assert.ok(lastQuery.includes("status=pending"));
    await page
      .getByRole("button", { name: "Clear Filters", exact: true })
      .click();
    assert.ok(!page.url().includes("status=pending"));
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    assert.equal((await download).suggestedFilename(), "northstar-orders.csv");
    await page.goto(base + "/admin/inventory");
    await page
      .getByRole("button", { name: "Update stock", exact: true })
      .first()
      .waitFor();
    await screenshot("admin-inventory");
    await page
      .getByRole("button", { name: "Update stock", exact: true })
      .first()
      .click();
    await page.getByLabel("New stock quantity").fill("13");
    await page
      .getByLabel("Reason (optional)")
      .fill("PO #88410 Received from logistics");
    await screenshot("admin-stock-dialog");
    await page
      .getByRole("button", { name: "Save stock", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(adjustments, 1);
    await page.goto(base + "/admin/payments");
    await page.getByRole("heading", { name: "Payments" }).waitFor();
    await page
      .getByRole("button", { name: "View payment for NS-88402" })
      .waitFor();
    await screenshot("admin-payments");
    await page
      .getByRole("button", { name: "View payment for NS-88402" })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.getByText("Not available", { exact: true }).waitFor();
    await screenshot("admin-payment-dialog");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.goto(base + "/admin");
    await page
      .getByRole("heading", { name: "Dashboard", exact: true })
      .waitFor();
    await page
      .getByRole("link", { name: /Total customers/ })
      .filter({ hasText: "36" })
      .waitFor();
    await screenshot("admin-dashboard");
    assert.equal(await page.locator(".admin-operations").count(), 0);
    assert.equal(
      await page
        .locator(".admin-brand strong")
        .evaluate((n) => getComputedStyle(n).fontSize),
      "23px",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/admin/orders");
    await page.getByRole("heading", { name: "Orders" }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: new admin directories, filters, CSV, stock dialog, payment details, Escape, mobile layout and one consistent admin shell and populated dashboard",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
