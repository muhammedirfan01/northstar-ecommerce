// Stateful browser fixtures exercise UI only; the separate integration suite covers MongoDB.
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
    "5197",
    "--strictPort",
  ],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
);
const ready = new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes("5197")) resolve();
  });
  server.once("exit", () => reject(Error("Vite stopped")));
});
(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [],
      reportQueries = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const id = "111111111111111111111111",
      pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
    let settings = {
        version: 0,
        storeName: "NORTHSTAR",
        supportEmail: "",
        supportPhone: "",
        invoiceAddress: "",
        shippingChargePaise: 5000,
        freeShippingAbovePaise: 50000,
        taxBasisPoints: 1800,
        codEnabled: true,
        onlineEnabled: false,
      },
      offers = [],
      fail = false,
      exportCount = 0,
      saves = 0;
    await page.route("**/api/**", async (route) => {
      const u = new URL(route.request().url());
      if (!u.pathname.startsWith("/api/")) return route.continue();
      const p = u.pathname.slice(4),
        method = route.request().method(),
        body = method === "GET" ? null : route.request().postDataJSON();
      const send = (data, status = 200) =>
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
            role: "admin",
            name: "Store Admin",
            email: "admin@example.test",
          },
        });
      if (p === "/admin/categories")
        return send({
          categories: [
            {
              id,
              name: "Fixture category",
              isListed: true,
              productCount: 1,
              createdAt: "2026-11-01",
              image: null,
            },
          ],
          summary: { total: 1, listed: 1, unlisted: 0 },
          pagination,
        });
      if (p === "/admin/customers")
        return send({
          customers: [
            {
              id,
              name: "Fixture customer",
              email: "customer@example.test",
              isBlocked: false,
              createdAt: "2026-11-01",
            },
          ],
          summary: { total: 1, active: 1, blocked: 0 },
          pagination,
        });
      if (p === "/admin/settings") {
        if (method === "PATCH") {
          if (!body.codEnabled && !body.onlineEnabled)
            return send("Enable at least one payment method.", 400);
          assert.equal(body.version, settings.version);
          settings = { ...body, version: body.version + 1 };
          saves++;
        }
        return send({ settings, paymentConfigured: false });
      }
      if (p === "/admin/offers/targets")
        return send({
          targets: [{ id, name: "Northstar fixture headphones" }],
        });
      if (p === "/admin/offers") {
        if (method === "POST") {
          offers.push({
            ...body,
            id,
            version: 0,
            status: "active",
            targetName: "Northstar fixture headphones",
          });
          return send({ offer: offers[0] }, 201);
        }
        if (fail) return send("Campaign loading failed.", 503);
        return send({
          offers: offers.filter(
            (o) =>
              !u.searchParams.get("search") ||
              o.name.includes(u.searchParams.get("search")),
          ),
          pagination: { ...pagination, total: offers.length },
        });
      }
      if (p.startsWith("/admin/offers/")) {
        assert.equal(body.version, offers[0].version);
        offers[0] = { ...offers[0], ...body, version: body.version + 1 };
        offers[0].status = offers[0].isActive ? "active" : "inactive";
        return send({ offer: offers[0] });
      }
      if (p === "/admin/reports/sales/export") {
        exportCount++;
        return route.fulfill({
          contentType: "text/csv",
          headers: {
            "Content-Disposition": 'attachment; filename="northstar-sales.csv"',
          },
          body: "Order ID,Total\r\nNS-FIXTURE,200\r\n",
        });
      }
      if (p === "/admin/reports/sales") {
        reportQueries.push(Object.fromEntries(u.searchParams));
        return send({
          summary: { orders: 1, collected: 20000, refunded: 0 },
          trend: [{ period: "2026-11-10", orders: 1, collected: 20000 }],
          orders: [
            {
              id,
              orderId: "NS-FIXTURE",
              createdAt: "2026-11-10",
              customer: {
                name: "Fixture Customer",
                email: "fixture@example.test",
              },
              totalAmount: 20000,
              completedRefund: 0,
              paymentStatus: "paid",
              paymentMethod: "cod",
              orderStatus: "delivered",
            },
          ],
          pagination,
        });
      }
      return send({});
    });
    async function shot(name) {
      if (process.env.NORTHSTAR_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.NORTHSTAR_SCREENSHOT_DIR, { recursive: true });
        await page
          .locator(".admin-workspace")
          .evaluate((n) => (n.scrollTop = 0));
        await page.screenshot({
          path: path.join(process.env.NORTHSTAR_SCREENSHOT_DIR, name + ".png"),
          fullPage: true,
        });
      }
    }
    const origin = "http://127.0.0.1:5197";
    await page.goto(origin + "/admin/offers");
    const adminNav = page.getByRole("navigation", { name: "Admin navigation" });
    assert.equal(
      await adminNav
        .getByRole("link", { name: "Settings", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await adminNav
        .getByRole("heading", { name: "System", exact: true })
        .count(),
      0,
    );
    await page
      .getByRole("link", { name: "Offers and Campaigns", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add campaign", exact: true })
      .click();
    await page
      .getByLabel("Campaign name", { exact: true })
      .fill("Audio weekend");
    await page
      .getByLabel("Applies to", { exact: true })
      .selectOption("product");
    await page.getByLabel("Campaign target", { exact: true }).selectOption(id);
    await page
      .getByLabel("Discount type", { exact: true })
      .selectOption("fixed");
    await page
      .getByLabel("Discount per unit (₹)", { exact: true })
      .fill("125.50");
    await page
      .getByLabel("Starts at", { exact: true })
      .fill("2026-11-02T09:00");
    await page
      .getByLabel("Expires at", { exact: true })
      .fill("2026-11-30T23:59");
    await shot("admin-campaign-form");
    await page
      .getByRole("button", { name: "Save campaign", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByText("Audio weekend", { exact: true }).waitFor();
    assert.equal(offers[0].discountValue, 12550);
    assert.equal(offers[0].targetId, id);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByLabel("Campaign name", { exact: true })
      .fill("Audio weekend updated");
    await page
      .getByRole("button", { name: "Save campaign", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Disable", exact: true }).click();
    await page.getByRole("button", { name: "Enable", exact: true }).waitFor();
    assert.equal(offers[0].isActive, false);
    await page.getByRole("button", { name: "Enable", exact: true }).click();
    await page.getByRole("button", { name: "Disable", exact: true }).waitFor();
    await shot("admin-campaigns");
    await page.getByPlaceholder("Search campaigns…").fill("missing");
    await page.getByText("No campaigns match these filters.").waitFor();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await page.getByText("Audio weekend updated", { exact: true }).waitFor();
    fail = true;
    await page.reload();
    await page
      .getByRole("alert")
      .filter({ hasText: "Campaign loading failed." })
      .waitFor();
    fail = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByText("Audio weekend updated", { exact: true }).waitFor();
    const typography = (locator) =>
      locator.evaluate((n) => {
        const c = getComputedStyle(n);
        return [c.fontFamily, c.fontSize, c.fontWeight];
      });
    const badgeStyle = (locator) =>
      locator.evaluate((n) => {
        const c = getComputedStyle(n);
        return [
          c.fontFamily,
          c.fontSize,
          c.fontWeight,
          c.color,
          c.backgroundColor,
          c.borderColor,
          c.borderRadius,
          c.padding,
        ];
      });
    const buttonStyle = (locator) =>
      locator.evaluate((n) => {
        const c = getComputedStyle(n);
        return [
          c.fontFamily,
          c.fontSize,
          c.fontWeight,
          c.borderRadius,
          c.padding,
          c.borderColor,
        ];
      });
    const campaignBadge = await badgeStyle(
      page.locator(".cm-status.is-active"),
    );
    const campaignButton = await buttonStyle(
      page.getByRole("button", { name: "Edit", exact: true }),
    );
    await page.getByRole("link", { name: "Categories", exact: true }).click();
    await page.getByText("Fixture category", { exact: true }).waitFor();
    assert.deepEqual(
      campaignBadge,
      await badgeStyle(page.locator(".cm-status.is-active")),
    );
    assert.deepEqual(
      campaignButton,
      await buttonStyle(
        page.getByRole("button", { name: "Edit", exact: true }),
      ),
    );
    const categoryHeading = await typography(page.locator(".cm-heading h1"));
    await page.getByRole("link", { name: "Customers", exact: true }).click();
    await page.getByText("Fixture customer", { exact: true }).waitFor();
    assert.deepEqual(
      campaignBadge,
      await badgeStyle(page.locator(".cm-status.is-active")),
    );
    const customerHeading = await typography(page.locator(".cm-heading h1"));
    assert.deepEqual(categoryHeading, customerHeading);
    await page.getByRole("link", { name: "Sales Report", exact: true }).click();
    assert.deepEqual(
      customerHeading,
      await typography(page.locator(".sr-heading h1")),
    );
    await page.locator(".sr-chart-current").waitFor();
    assert.equal(await page.locator(".sr-details, .sr-help").count(), 0);
    assert.equal(
      await page.getByLabel("Report from", { exact: true }).count(),
      0,
    );
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("reports/sales?")),
      page.getByRole("button", { name: "Last 7 Days", exact: true }).click(),
    ]);
    const last = reportQueries.findLast(
      (q) => q.to === new URL(page.url()).searchParams.get("to"),
    );
    assert.equal((Date.parse(last.to) - Date.parse(last.from)) / 86400000, 6);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Report" }).click();
    await downloading;
    assert.equal(exportCount, 1);
    await shot("admin-sales-report");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["offers", "sales-report"]) {
      await page.goto(origin + "/admin/" + route);
      await page.locator(".cm-heading h1, .sr-heading h1").waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Mobile overflow: " + route,
      );
      await shot("admin-" + route + "-mobile");
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: No Settings/System navigation; campaigns create/edit/target/enable/disable/search/error recovery; matching category/customer campaign badges/buttons and heading typography; sales presets/export, removed detail/help sections and mobile layouts.",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
