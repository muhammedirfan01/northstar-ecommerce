const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const server = spawn(
  process.execPath,
  [
    path.join(__dirname, "../node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5198",
    "--strictPort",
    "--force",
  ],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
);
server.stderr.on("data", (b) => process.stderr.write(b));
const ready = new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes("5198")) resolve();
  });
  server.once("exit", () => reject(Error("Vite stopped")));
});
(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    const errors = [],
      queries = [];
    let fail = false,
      empty = false;
    page.on("requestfailed", (r) =>
      console.log("NETWORK", r.url(), r.failure()),
    );
    page.on("console", (m) => {
      if (m.type() === "error") console.log("CONSOLE", m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) => {
      const u = new URL(route.request().url()),
        p = u.pathname;
      if (!p.startsWith("/api/")) return route.continue();
      const send = (data) => route.fulfill({ json: { success: true, data } });
      if (p.endsWith("/auth/me") || p.endsWith("/admin/me"))
        return send({
          user: {
            id: "111111111111111111111111",
            role: "admin",
            name: "Store Admin",
            email: "admin@example.test",
          },
        });
      if (p.endsWith("/reports/sales/export"))
        return route.fulfill({
          contentType: "text/csv",
          body: "Order ID,Net INR\nNS-FIXTURE,200",
          headers: {
            "Content-Disposition": 'attachment; filename="northstar-sales.csv"',
          },
        });
      if (p.endsWith("/reports/sales")) {
        queries.push(Object.fromEntries(u.searchParams));
        if (fail)
          return route.fulfill({
            status: 503,
            json: { message: "Report unavailable" },
          });
        const from = u.searchParams.get("from"),
          group = u.searchParams.get("group");
        const factor =
          u.searchParams.get("to") <
          new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)
            ? 0.68
            : 1;
        return send({
          summary: {
            orders: empty ? 0 : 194,
            collected: empty ? 0 : Math.round(284520000 * factor),
            refunded: 0,
            completedOrders: empty ? 0 : 194,
            completedSales: empty ? 0 : Math.round(284520000 * factor),
          },
          trend: empty
            ? []
            : Array.from({ length: 10 }, (_, i) => ({
                period:
                  group === "month"
                    ? from.slice(0, 7)
                    : new Date(Date.parse(from) + i * 86400000)
                        .toISOString()
                        .slice(0, 10),
                orders: 10 + i,
                collected: Math.round(
                  (9000000 + i * 2200000 + Math.sin(i / 2) * 2000000) * factor,
                ),
                refunded: 0,
              })),
          topProducts: empty
            ? []
            : Array.from({ length: 8 }, (_, i) => ({
                id: "product-" + i,
                name: [
                  "Apple MacBook Pro 16-inch",
                  "Sony Alpha 7 IV Mirrorless Camera",
                  "Titanium Pro S24 Ultra 512GB",
                  "Apple Watch Series 9 GPS",
                  "Studio Reference ANC Headphones",
                  "Sony FX30 Cinema Line",
                  "Camera Tripod",
                  "Wireless Keyboard",
                ][i],
                units: 42 - i,
                netSales: 52495000 - i * 6000000,
              })),
          orders: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        });
      }
      return send({});
    });
    await page.goto("http://127.0.0.1:5198/admin/sales-report");
    await page
      .getByText("Apple MacBook Pro 16-inch", { exact: false })
      .waitFor()
      .catch(async (e) => {
        console.log(
          "DEBUG",
          page.url(),
          await page.locator("body").innerText(),
          errors,
        );
        throw e;
      });
    assert.equal(await page.locator(".sr-stat").count(), 3);
    assert.equal(await page.locator(".sr-products tbody tr").count(), 6);
    await page
      .getByRole("button", { name: "Next product page", exact: true })
      .click();
    await page.getByText("Wireless Keyboard", { exact: false }).waitFor();
    assert.equal(await page.locator(".sr-products tbody tr").count(), 2);
    await page.getByLabel("Products per page").selectOption("12");
    assert.equal(await page.locator(".sr-products tbody tr").count(), 8);
    await page
      .getByRole("button", { name: "Last 7 Days", exact: true })
      .click();
    await page.waitForFunction(() =>
      new URL(location.href).searchParams.has("from"),
    );
    const params = new URL(page.url()).searchParams;
    assert.equal(
      (Date.parse(params.get("to")) - Date.parse(params.get("from"))) /
        86400000,
      6,
    );
    await page.getByRole("button", { name: "30 Days", exact: true }).click();
    await page.waitForFunction(
      () =>
        (Date.parse(new URL(location.href).searchParams.get("to")) -
          Date.parse(new URL(location.href).searchParams.get("from"))) /
          86400000 ===
        29,
    );
    const point = page.locator('.sr-chart circle[role="button"]').first();
    await point.focus();
    await page.locator(".sr-chart-tooltip strong").waitFor();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Report" }).click();
    assert.equal(
      (await downloading).suggestedFilename(),
      "northstar-sales.csv",
    );
    assert.equal(await page.locator(".sr-details, .sr-help").count(), 0);
    assert.equal(
      await page
        .getByText("Order details & advanced filters", { exact: true })
        .count(),
      0,
    );
    assert.equal(await page.getByText(/India time. Net sales/).count(), 0);
    await page.goto("http://127.0.0.1:5198/admin/sales-report?from=2026-11-10&to=2026-11-01");
    await page.getByText("Choose a reporting period above", { exact: true }).waitFor();
    assert.equal(await page.getByText(/advanced filters/i).count(), 0);
    await page.getByRole("button", { name: "Last 7 Days", exact: true }).click();
    await page.locator(".sr-chart-current").waitFor();
    assert.match(
      await page.locator(".sr-chart-current").getAttribute("d"),
      / C/,
    );
    assert.equal(
      await page.locator(".sr-chart-previous").getAttribute("stroke-dasharray"),
      "4 4",
    );
    assert.ok(
      !/NaN|Infinity/.test(
        await page.locator(".sr-chart-current").getAttribute("d"),
      ),
    );
    await page.getByRole("button", { name: "This Month", exact: true }).click();
    await page.getByLabel("Products per page").selectOption("6");
    await page.setViewportSize({ width: 1440, height: 1520 });
    await page.locator(".admin-workspace").evaluate((n) => (n.scrollTop = 0));
    const graph = await page.locator(".sr-chart svg").boundingBox();
    await page.mouse.move(
      graph.x + graph.width * 0.66,
      graph.y + graph.height * 0.55,
    );
    const dir = process.env.NORTHSTAR_SCREENSHOT_DIR;
    if (dir) {
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({
        path: path.join(dir, "sales-report-desktop.png"),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (dir)
      await page.screenshot({
        path: path.join(dir, "sales-report-mobile.png"),
        fullPage: true,
      });
    empty = true;
    await page
      .getByRole("button", { name: "Last 7 Days", exact: true })
      .click();
    await page
      .getByText("No paid product sales in this period.", { exact: true })
      .waitFor();
    fail = true;
    await page.getByRole("button", { name: "30 Days", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Report unavailable" })
      .waitFor();
    fail = false;
    empty = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page
      .getByText("Apple MacBook Pro 16-inch", { exact: false })
      .waitFor();
    assert.deepEqual(errors, []);
    assert.ok(queries.length > 6);
    console.log(
      "PASS: summary cards, date presets, comparison chart focus, ranked product pagination, page size, CSV download, removed advanced filters/help, smooth comparison curves, mobile overflow, empty state and error recovery (fixtures).",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
