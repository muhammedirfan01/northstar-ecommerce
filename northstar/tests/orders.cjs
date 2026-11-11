// Browser regressions use explicit customer/order fixtures, never real purchases.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const origin = process.env.NORTHSTAR_TEST_ORIGIN || "http://127.0.0.1:5204";
const output = process.env.NORTHSTAR_SCREENSHOTS || path.join(__dirname, "../test-results/orders");
fs.mkdirSync(output, { recursive: true });
const server = process.env.NORTHSTAR_TEST_ORIGIN ? null : spawn(process.execPath,
  [path.join(__dirname, "../node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5204", "--strictPort"],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] });
const ready = server ? new Promise((resolve, reject) => {
  server.stdout.on("data", bytes => { if (bytes.toString().includes("5204")) resolve(); });
  server.once("exit", () => reject(Error("Vite stopped")));
}) : Promise.resolve();
const id = value => String(value).padStart(24, "0");
const productImage = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect x="14" y="24" width="92" height="66" rx="9" fill="#343a3a"/><rect x="25" y="17" width="28" height="16" rx="3" fill="#444c4c"/><circle cx="64" cy="56" r="25" fill="#192224" stroke="#747f7b" stroke-width="4"/><circle cx="64" cy="56" r="15" fill="#315054"/><circle cx="64" cy="56" r="9" fill="#182829"/></svg>');
function makeOrder(number, status, paymentMethod, paymentStatus, age, productName, total) {
  return {
    id: id(number), orderId: `NS-${String(number).padStart(4, "0")}`,
    orderStatus: status, paymentMethod, paymentStatus,
    createdAt: new Date(Date.now() - age * 86400000).toISOString(),
    totalAmount: total, subtotal: total, shippingCharge: 0, tax: 0, discount: 0,
    shippingAddress: { name: "Asha Menon", addressLine1: "12 Lake Road", city: "Kochi", state: "Kerala", pincode: "682001", phone: "9876543210" },
    items: [{ productId: id(10), variantId: id(11), productName, variantName: "Graphite · 128 GB", quantity: 1, lineTotalPaise: total, productImage }],
    returnRequest: { status: "none" }, statusHistory: [], paymentHistory: [], refund: { status: "none" },
  };
}
const orders = [
  makeOrder(1, "confirmed", "razorpay", "paid", 10, "Northstar Focus Mirrorless Camera", 5999000),
  makeOrder(2, "delivered", "wallet", "paid", 4, "Northstar Studio Headphones", 1299000),
  makeOrder(3, "cancelled", "cod", "pending", 80, "Northstar Pulse Lite", 1799000),
  makeOrder(4, "shipped", "cod", "pending", 120, "Northstar Creator 16 Laptop", 8999000),
  makeOrder(5, "pending", "razorpay", "failed", 1, "Northstar Compact Camera", 2999000),
];
orders[0].items.push({ ...orders[0].items[0], productId: id(12), productName: "Northstar Wireless Microphone", variantName: "Black · USB-C", lineTotalPaise: 499000 });
orders[0].totalAmount += 499000;
(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let failOrders = false, delaySearch = "", noOrders = false, cartAdds = 0, rejectBuyAgain = false;
    const queries = [];
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const endpoint = url.pathname.slice(4);
      const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(status >= 400 ? { success: false, message: data } : { success: true, data }) });
      if (endpoint === "/auth/me") return send({ user: { id: id(99), name: "Asha Menon", email: "asha@example.test", role: "customer", isEmailVerified: true } });
      if (endpoint === "/cart") {
        if (route.request().method() === "POST") {
          if (rejectBuyAgain) return send("This product is currently unavailable.",409);
          const body = route.request().postDataJSON();
          assert.equal(body.quantity, 1); assert.equal(body.variantId, id(11)); cartAdds++;
        }
        return send({ items: [], quantityTotal: cartAdds, totalPaise: 0 });
      }
      if (endpoint === "/wishlist") return send({ products: [] });
      if (endpoint === "/products/categories") return send({ categories: [] });
      if (endpoint === '/addresses') return send({addresses:[{id:id(80),fullName:'Asha Menon',phoneNumber:'9876543210',addressLine1:'12 Lake Road',city:'Kochi',state:'Kerala',postalCode:'682001',isDefault:true}],version:0,maxAddresses:10});
      if (endpoint === '/orders/preview') return send({...orders[4],paymentMethods:{cod:true,razorpay:true,wallet:false},walletBalancePaise:0});
      if (endpoint === "/orders") {
        const q = url.searchParams;
        queries.push(Object.fromEntries(q));
        if (failOrders) return send("Orders could not be loaded. Please retry.", 503);
        const search = (q.get("search") || "").toLowerCase();
        if (search === delaySearch) await new Promise(resolve => setTimeout(resolve, 650));
        let rows = noOrders ? [] : orders.filter(order =>
          [order.orderId, ...order.items.flatMap(item => [item.productName, item.variantName])].join(" ").toLowerCase().includes(search));
        if (q.get("status")) rows = rows.filter(order => order.orderStatus === q.get("status"));
        const days = { "3months": 90, "6months": 180, year: 365 }[q.get("timeframe")];
        if (days) rows = rows.filter(order => Date.now() - new Date(order.createdAt).getTime() <= days * 86400000);
        const sort = q.get("sort");
        rows.sort((a, b) => sort === "oldest" ? new Date(a.createdAt) - new Date(b.createdAt) : sort === "total-asc" ? a.totalAmount - b.totalAmount : sort === "total-desc" ? b.totalAmount - a.totalAmount : new Date(b.createdAt) - new Date(a.createdAt));
        const total = rows.length, totalPages = Math.max(1, Math.ceil(total / 4));
        const current = Math.min(Number(q.get("page") || 1), totalPages);
        return send({ orders: rows.slice((current - 1) * 4, current * 4), pagination: { page: current, totalPages, total, limit: 4 } });
      }
      if (/\/orders\/[^/]+\/invoice$/.test(endpoint)) return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4\n% fixture download\n" });
      if (/^\/orders\/[^/]+$/.test(endpoint)) return send({ order: orders.find(order => order.id === endpoint.split("/").pop()) });
      return send({});
    });
    const cards = page.locator(".order-card");
    const filters = page.getByRole("form", { name: "Order filters" });
    async function loaded() { await page.locator('.orders-results[aria-busy="false"]').waitFor({ state: 'attached' }); }
    async function clear() { await filters.getByRole("button", { name: "Clear", exact: true }).click(); await loaded(); }
    async function search(value) {
      await filters.getByRole("textbox", { name: "Search orders" }).fill(value);
      await filters.getByRole("button", { name: "Search orders", exact: true }).click();
      await loaded();
    }
    await page.goto(origin + "/orders"); await loaded();
    await page.getByRole("heading", { name: "My Orders", exact: true }).waitFor();
    assert.equal(await cards.count(), 4);
    assert.ok(await filters.locator('input').evaluate(input => parseInt(getComputedStyle(input).paddingLeft) >= 36), "Search text clears the icon");
    assert.equal(await cards.first().getByRole("heading", { level: 2 }).textContent(), "NS-0005");
    assert.equal(await cards.filter({ hasText: "NS-0001" }).locator(".purchase-product").count(), 2);
    assert.equal(await cards.first().locator('.order-card-status svg.lucide-clock-3').count(), 1);
    assert.equal(await cards.first().getByRole("link", { name: "Request cancellation", exact: true }).count(), 1);
    const delivered = cards.filter({ hasText: "NS-0002" });
    assert.equal(await delivered.getByRole("link", { name: "Return / replacement", exact: true }).count(), 1);
    assert.equal(await delivered.getByRole("link", { name: "Request cancellation", exact: true }).count(), 0);
    await page.screenshot({ path: path.join(output, "my-orders-desktop.png"), fullPage: true });
    const download = page.waitForEvent("download");
    await cards.first().getByRole("button", { name: "Download invoice for NS-0005" }).click();
    assert.equal((await download).suggestedFilename(), "invoice-NS-0005.pdf");
    rejectBuyAgain=true;
    await cards.first().getByRole("button", { name: "Buy it again", exact: true }).click();
    await page.getByRole('alert').filter({hasText:'currently unavailable'}).waitFor();
    assert.ok(page.url().endsWith('/orders'),'Unavailable repeat purchases stay on the orders page');
    assert.equal(cartAdds,0);
    rejectBuyAgain=false;
    await cards.first().getByRole("button", { name: "Buy it again", exact: true }).click();
    await page.getByRole('heading',{name:'Checkout',exact:true}).waitFor();
    await page.getByRole('button',{name:'Place COD order',exact:true}).waitFor();
    assert.ok(page.url().endsWith('/checkout'),'Buy it again opens checkout directly');
    assert.equal(cartAdds, 1);
    await page.goto(origin+'/orders');await loaded();
    const pager = page.getByRole("navigation", { name: "Order pagination" });
    await pager.getByRole("button", { name: "Next", exact: true }).click(); await loaded();
    assert.equal(await cards.count(), 1);
    assert.equal(await cards.first().getByRole("heading", { level: 2 }).textContent(), "NS-0004");
    assert.equal(await cards.first().getByRole("link", { name: "Request cancellation", exact: true }).count(), 0);
    await filters.getByLabel("Status", { exact: true }).selectOption("cancelled"); await loaded();
    assert.equal(queries.at(-1).page, "1");
    assert.equal(await cards.first().getByRole("heading", { level: 2 }).textContent(), "NS-0003");
    assert.equal(await cards.first().locator('.order-card-status svg.lucide-circle-x').count(), 1);
    assert.equal(await cards.first().getByRole("link").count(), 1);
    await clear();
    await search("USB-C"); assert.equal(await cards.count(), 1);
    await search("  NS-0002  "); assert.equal(await cards.count(), 1);
    assert.equal(queries.at(-1).search, "NS-0002");
    await clear();
    await filters.getByLabel("Sort by", { exact: true }).selectOption("total-desc"); await loaded();
    assert.equal(await cards.first().getByRole("heading", { level: 2 }).textContent(), "NS-0004");
    await filters.getByLabel("Filter by timeframe:", { exact: true }).selectOption("3months"); await loaded();
    assert.equal(queries.at(-1).sort, "total-desc");
    assert.equal(await cards.first().getByRole("heading", { level: 2 }).textContent(), "NS-0001");
    await search("no-such-product");
    await page.getByRole("heading", { name: "No matching orders", exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear filters", exact: true }).click(); await loaded();
    delaySearch = "camera";
    await filters.getByRole("textbox", { name: "Search orders" }).fill("camera");
    await filters.getByRole("button", { name: "Search orders", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Loading your orders" }).waitFor();
    assert.equal(await cards.count(), 0, "Do not show old orders while a new search loads");
    await search("headphones");
    await page.waitForTimeout(750);
    assert.equal(await cards.count(), 1);
    assert.equal(await cards.first().getByRole("heading", { level: 2 }).textContent(), "NS-0002");
    failOrders = true; await search("camera");
    await page.getByRole("alert").filter({ hasText: "Orders could not be loaded" }).waitFor();
    assert.equal(await cards.count(), 0);
    failOrders = false; delaySearch = "";
    await page.getByRole("button", { name: "Try again", exact: true }).click(); await loaded();
    assert.equal(await cards.count(), 2);
    await clear();
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Orders fit ${width}px`);
      const field = await filters.locator("input").boundingBox();
      assert.ok(field.width > 150, "Search remains usable");
      await page.screenshot({ path: path.join(output, `my-orders-${width}.png`), fullPage: true });
    }
    await cards.first().getByRole("link", { name: "View order details", exact: true }).click();
    await page.locator(".purchase-detail-title").waitFor();
    assert.ok(page.url().endsWith("/orders/" + id(5)));
    await page.getByRole('heading',{name:'Order information',exact:true}).waitFor();
    assert.equal(await page.getByText('Order & payment history',{exact:true}).count(),0);
    assert.equal(await page.locator('.order-information-grid > div').count(),4);
    await page.screenshot({path:path.join(output,'order-information-mobile.png'),fullPage:true});
    noOrders = true;
    await page.goto(origin + "/orders"); await loaded();
    await page.getByRole("heading", { name: "Your orders will appear here", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Shop now", exact: true }).getAttribute("href"), "/products");
    assert.deepEqual(errors, []);
    console.log("PASS: order cards, status/action eligibility, invoice, buy again, search/variant/ID, sort before pagination, timeframe, clear, loading/races, errors/retry, empty state and desktop/tablet/mobile layout (local fixtures)");
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
