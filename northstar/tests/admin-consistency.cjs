// Browser fixtures only; no store records are written.
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
    "5196",
    "--strictPort",
  ],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
);
const ready = new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes("5196")) resolve();
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
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let coupons = [],
      creates = 0,
      edits = 0,
      toggles = 0,
      deletes = 0,
      restores = 0,
      failCoupons = false;
    const pagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
    const product = {
      id,
      name: "Northstar test headphones",
      stock: 3,
      version: 0,
      variants: [],
      category: { id, name: "Audio" },
      images: [],
      pricePaise: 10000,
      isListed: true,
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const order = {
      id,
      orderId: "NS-FIXTURE-001",
      customer: { name: "Fixture Customer", email: "fixture@example.test" },
      shippingAddress: { name: "Fixture Customer" },
      items: [{ productName: product.name, variantName: "Black", quantity: 1 }],
      totalAmount: 15000,
      paymentStatus: "pending",
      paymentMethod: "cod",
      orderStatus: "confirmed",
      createdAt: new Date().toISOString(),
      returnRequest: {
        status: "requested",
        reason: "Fixture reason",
        requestedAt: new Date().toISOString(),
      },
      refund: { status: "none" },
    };
    await page.route("**/api/**", async (route) => {
      const u = new URL(route.request().url());
      if (!u.pathname.startsWith("/api/")) return route.continue();
      const p = u.pathname.slice(4),
        method = route.request().method(),
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
            name: "Store Admin",
            email: "admin@example.test",
            role: "admin",
            isEmailVerified: true,
          },
        });
      if (p === "/admin/dashboard")
        return send({
          customers: 12,
          products: 8,
          categories: 3,
          publishedProducts: 6,
        });
      if (p === "/admin/customers")
        return send({
          customers: [],
          summary: { total: 12, active: 10, blocked: 2 },
          pagination,
        });
      if (p === "/admin/products")
        return send({
          products: [product],
          summary: { total: 8, published: 6, lowStock: 1 },
          pagination: { ...pagination, total: 1 },
        });
      if (p === "/admin/categories")
        return send({
          categories: [
            {
              id,
              name: "Audio",
              isListed: true,
              parentId: null,
              productCount: 8,
              createdAt: new Date().toISOString(),
            },
          ],
          summary: { total: 3, listed: 3, unlisted: 0 },
          pagination: { ...pagination, total: 1 },
        });
      if (p === "/admin/inventory")
        return send({
          products: [product],
          categories: [product.category],
          summary: { total: 8, lowStock: 1, outOfStock: 0 },
          pagination: { ...pagination, total: 1 },
        });
      if (p === "/admin/orders")
        return send({
          orders: [order],
          summary: { total: 1, fulfilled: 0, pending: 1, delivered: 0 },
          returnSummary: { total: 1, requested: 1, accepted: 0, completed: 0 },
          pagination: { ...pagination, total: 1 },
        });
      if (p === "/admin/payments")
        return send({
          payments: [order],
          summary: { collected: 0, pending: 15000, failed: 0, refunded: 0 },
          pagination: { ...pagination, total: 1 },
        });
      if (p === "/admin/coupons" && method === "GET") {
        if (failCoupons) return send("Coupon loading failed.", 503);
        let rows = coupons.filter((c) =>
          u.searchParams.get("status") === "deleted"
            ? c.deletedAt
            : !c.deletedAt,
        );
        if (u.searchParams.get("search"))
          rows = rows.filter((c) =>
            c.code.includes(u.searchParams.get("search").toUpperCase()),
          );
        if (u.searchParams.get("status") === "inactive")
          rows = rows.filter((c) => !c.isActive);
        return send({
          coupons: rows,
          summary: {
            total: coupons.filter((c) => !c.deletedAt).length,
            active: coupons.filter((c) => c.isActive && !c.deletedAt).length,
            expired: 0,
            inactive: coupons.filter((c) => !c.isActive && !c.deletedAt).length,
          },
          pagination: { ...pagination, total: rows.length },
        });
      }
      if (p === "/admin/coupons" && method === "POST") {
        const body = route.request().postDataJSON();
        assert.equal(body.code, "NORTHSTAR10");
        assert.equal(body.discountValue, 10);
        assert.equal(body.minPurchasePaise, 25000);
        assert.equal(body.usedCount, undefined);
        creates++;
        coupons.push({
          ...body,
          id,
          version: 0,
          usedCount: 0,
          deletedAt: null,
          status: "active",
        });
        return send({ coupon: coupons[0] }, 201);
      }
      if (p.startsWith("/admin/coupons/" + id)) {
        const body = route.request().postDataJSON(),
          coupon = coupons[0];
        assert.equal(body.version, coupon.version);
        if (p.endsWith("/status")) {
          toggles++;
          coupon.isActive = body.isActive;
        } else if (p.endsWith("/restore")) {
          restores++;
          coupon.deletedAt = null;
        } else if (method === "DELETE") {
          assert.equal(body.confirmDelete, true);
          deletes++;
          coupon.deletedAt = new Date().toISOString();
        } else {
          edits++;
          assert.equal(body.discountValue, 5025);
          assert.equal(body.discountType, "fixed");
          Object.assign(coupon, body);
        }
        coupon.version++;
        coupon.status = coupon.deletedAt
          ? "deleted"
          : coupon.isActive
            ? "active"
            : "inactive";
        return send({ coupon });
      }
      return send({});
    });
    const origin = "http://127.0.0.1:5196";
    async function screenshot(name) {
      if (process.env.NORTHSTAR_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.NORTHSTAR_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(process.env.NORTHSTAR_SCREENSHOT_DIR, name + ".png"),
          fullPage: true,
        });
      }
    }
    async function styles() {
      return page.evaluate(() => {
        const heading = getComputedStyle(
            document.querySelector(".cm-heading h1"),
          ),
          card = getComputedStyle(document.querySelector(".cm-table-card")),
          table = getComputedStyle(document.querySelector(".cm-table th"));
        return {
          headingFont: heading.fontFamily,
          headingSize: heading.fontSize,
          headingWeight: heading.fontWeight,
          cardRadius: card.borderRadius,
          cardBackground: card.backgroundColor,
          tableFont: table.fontFamily,
          tableSize: table.fontSize,
          tableBackground: table.backgroundColor,
          brand: getComputedStyle(document.querySelector(".admin-brand strong"))
            .fontSize,
        };
      });
    }
    await page.goto(origin + "/admin/products");
    await page.locator(".cm-table tbody").getByText(product.name).waitFor();
    const baseline = await styles();
    for (const route of [
      "/admin/customers",
      "/admin/categories",
      "/admin/orders",
      "/admin/inventory",
      "/admin/payments",
      "/admin/returns",
      "/admin/coupons",
      "/admin",
    ]) {
      await page.goto(origin + route);
      await page.locator(".cm-heading h1").waitFor();
      await page.locator(".cm-table th").first().waitFor();
      assert.deepEqual(
        await styles(),
        baseline,
        "Shared styles differ on " + route,
      );
      assert.equal(
        await page.locator(".ops-topbar,.admin-operations").count(),
        0,
      );
    }
    await page
      .getByRole("link", { name: /Total customers/ })
      .filter({ hasText: "12" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Recent orders", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Quick access", exact: true })
      .waitFor();
    await page
      .getByRole("link", { name: "Coupons Manage discount codes" })
      .click();
    await page.getByRole("heading", { name: "Coupons", exact: true }).waitFor();
    await screenshot("admin-coupons-empty");
    await page.getByRole("button", { name: "Add coupon", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Save coupon", exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(23, 23, 23)",
      "Coupon form should use the existing catalog primary button",
    );
    await page.getByLabel("Coupon code", { exact: true }).fill("northstar10");
    await page.getByLabel("Discount percentage", { exact: true }).fill("10");
    await page.getByLabel("Minimum purchase (₹)", { exact: true }).fill("250");
    await page
      .getByLabel("Expires at", { exact: true })
      .fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16));
    await screenshot("admin-coupon-form");
    await page
      .getByRole("button", { name: "Save coupon", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByText("NORTHSTAR10", { exact: true }).waitFor();
    assert.equal(creates, 1);
    await page.getByRole("button", { name: "Edit NORTHSTAR10" }).click();
    await page
      .getByLabel("Discount type", { exact: true })
      .selectOption("fixed");
    await page.getByLabel("Discount amount (₹)", { exact: true }).fill("50.25");
    await page
      .getByRole("button", { name: "Save coupon", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByText("₹50.25", { exact: true }).waitFor();
    assert.equal(edits, 1);
    await page.getByRole("button", { name: "Disable", exact: true }).click();
    await page
      .getByRole("button", { name: "Disable coupon", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(toggles, 1);
    await page.getByRole("button", { name: "Enable", exact: true }).waitFor();
    await screenshot("admin-coupons");
    await page
      .getByRole("textbox", { name: "Search coupon codes…" })
      .fill("MISSING");
    await page.getByRole("heading", { name: "No coupons found" }).waitFor();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await page.getByText("NORTHSTAR10", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Delete NORTHSTAR10" }).click();
    await page
      .getByRole("button", { name: "Delete coupon", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: "No coupons found" }).waitFor();
    assert.equal(deletes, 1);
    await page
      .getByRole("combobox", { name: "Coupon status", exact: true })
      .selectOption("deleted");
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await page
      .getByRole("button", { name: "Restore coupon", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(restores, 1);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await page.getByText("NORTHSTAR10", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Add coupon", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    failCoupons = true;
    await page.reload();
    await page
      .getByRole("alert")
      .filter({ hasText: "Coupon loading failed." })
      .waitFor();
    failCoupons = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByText("NORTHSTAR10", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "/admin",
      "/admin/orders",
      "/admin/inventory",
      "/admin/coupons",
    ]) {
      await page.goto(origin + route);
      await page.locator(".cm-heading h1").waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Mobile overflow on " + route,
      );
    }
    await page.getByRole("button", { name: "Add coupon", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Mobile coupon dialog overflow",
    );
    await screenshot("admin-coupons-mobile");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: one shared admin design across all pages, original dashboard counts/sections/navigation, coupon create/edit/paise/disable/delete/restore/search/error recovery and mobile layout",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
