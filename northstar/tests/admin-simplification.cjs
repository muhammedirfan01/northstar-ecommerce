// Isolated browser fixtures; no real store orders, messages or payments are changed.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs"),
  path = require("node:path");
const origin = process.env.NORTHSTAR_TEST_ORIGIN || "http://127.0.0.1:5204",
  id = "111111111111111111111111",
  otherId = "222222222222222222222222",
  variantId = "333333333333333333333333";
const server = process.env.NORTHSTAR_TEST_ORIGIN ? null : spawn(
  process.execPath,
  [
    path.join(__dirname, "../node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5204",
    "--strictPort",
  ],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
);
const ready = server ? new Promise((resolve, reject) => {
  server.stdout.on("data", (bytes) => {
    if (bytes.toString().includes("5204")) resolve();
  });
  server.once("exit", () => reject(Error("Vite stopped")));
}) : Promise.resolve();
const output =
  process.env.NORTHSTAR_SCREENSHOT_DIR ||
  path.join(__dirname, "../test-results/admin-simplification");
fs.mkdirSync(output, { recursive: true });
(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let paidCalls = 0,
      cancels = 0,
      adjustment,
      settingsSave;
    const settings = {
      version: 0,
      storeName: "NORTHSTAR",
      supportEmail: "care@example.test",
      supportPhone: "",
      invoiceAddress: "Fixture address",
      shippingChargePaise: 5000,
      freeShippingAbovePaise: 50000,
      taxBasisPoints: 1800,
      codEnabled: true,
      onlineEnabled: true,
    };
    const request = {
      id,
      reference: "REQ-10001",
      name: "Asha Devi",
      email: "asha@example.test",
      subject: "Delivery question",
      message: "Can you help me with the delivery of my order?",
      status: "open",
      resolutionNote: "",
      createdAt: "2026-11-01T10:00:00Z",
      version: 0,
    };
    const orders = [id, otherId].map((value, index) => ({
      id: value,
      orderId: `NS-000${index + 1}`,
      customer: {
        name: index ? "Julian Sterling" : "Asha Devi",
        email: index ? "julian@example.test" : "asha@example.test",
        phone: "9876543210",
      },
      shippingAddress: {
        name: "Asha Devi",
        addressLine1: "123 Main Street",
        city: "Kochi",
        state: "Kerala",
        pincode: "682001",
        phone: "9876543210",
      },
      items: [
        {
          productName: "Northstar Pulse Lite",
          variantName: "4 GB RAM / 64 GB · Black",
          quantity: 1,
          unitPricePaise: 10000,
          lineTotalPaise: 10000,
        },
      ],
      paymentMethod: index ? "razorpay" : "cod",
      paymentStatus: "pending",
      orderStatus: "confirmed",
      subtotal: 10000,
      shippingCharge: 5000,
      tax: 0,
      discount: 0,
      totalAmount: 15000,
      nextStatuses: ["shipped"],
      createdAt: "2026-11-01T10:00:00Z",
      statusHistory: [{ status: "confirmed", at: "2026-11-01T10:00:00Z" }],
      paymentHistory: [{ status: "pending", at: "2026-11-01T10:00:00Z" }],
      refund: { status: "none" },
      returnRequest: { status: "none" },
    }));
    const product = {
      id,
      name: "Northstar Pulse Lite",
      stock: 6,
      version: 2,
      category: { id, name: "Mobiles" },
      variants: [
        { id: variantId, name: "4 GB RAM / 64 GB", stock: 4 },
        { id: otherId, name: "8 GB RAM / 128 GB", stock: 2 },
      ],
      updatedAt: "2026-11-01T10:00:00Z",
    };
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const endpoint = url.pathname.slice(4),
        method = req.method();
      const send = (data, status = 200) =>
        route.fulfill({
          status,
          json:
            status >= 400
              ? { success: false, message: data }
              : { success: true, data },
        });
      if (["/auth/me", "/admin/me"].includes(endpoint))
        return send({
          user: {
            id,
            name: "Store Admin",
            email: "admin@example.test",
            role: "admin",
            isEmailVerified: true,
          },
        });
      if (endpoint === "/admin/dashboard")
        return send({
          orders: 2,
          products: 2,
          customers: 12,
          categories: 3,
          returns: 1,
          publishedProducts: 1,
        });
      if (endpoint.endsWith('/export')) return route.fulfill({status:200,contentType:'text/csv',body:'Order,Total\nNS-0001,150\n'});
      if (endpoint === '/admin/payments') return send({payments:orders.map(order=>({...order,paymentReference:'PAY-'+order.orderId})),summary:{collected:15000,pending:15000,failed:0,refunded:0},pagination:{page:1,limit:10,total:2,totalPages:1}});
      if (endpoint === '/admin/returns') return send({orders:[{...orders[0],returnRequest:{status:'requested',reference:'RET-0001',requestedAt:'2026-11-01T10:00:00Z'}}],summary:{total:1,requested:1,accepted:0,completed:0},pagination:{page:1,limit:10,total:1,totalPages:1}});
      if (endpoint === '/admin/offers') return send({offers:[{id,name:'Welcome offer',description:'Store offer',scope:'all',discountType:'percentage',discountValue:10,isActive:true,status:'active',startDate:'2026-11-01T10:00:00Z',expiryDate:'2026-12-01T10:00:00Z',version:0}],summary:{total:1,active:1,inactive:0},pagination:{page:1,limit:10,total:1,totalPages:1}});
      if (endpoint === "/admin/orders")
        return send({
          orders,
          summary: { total: 2, fulfilled: 0, pending: 2, delivered: 0 },
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
        });
      const order = orders.find((value) =>
        endpoint.startsWith(`/admin/orders/${value.id}`),
      );
      if (order) {
        if (endpoint.endsWith("/mark-paid")) {
          paidCalls++;
          assert.equal(order.paymentMethod, "cod");
          order.paymentStatus = "paid";
          order.paymentHistory.push({
            status: "paid",
            at: new Date().toISOString(),
          });
        }
        if (endpoint.endsWith("/cancel")) {
          cancels++;
          assert.equal(
            req.postDataJSON().reason,
            "Customer requested cancellation",
          );
          order.orderStatus = "cancelled";
          order.nextStatuses = [];
        }
        if (endpoint.endsWith("/status"))
          order.orderStatus = req.postDataJSON().status;
        return send({ order });
      }
      if (endpoint === "/admin/inventory")
        return send({
          products: [product],
          categories: [{ id, name: "Mobiles" }],
          summary: { total: 2, lowStock: 0, outOfStock: 1 },
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        });
      if (endpoint.endsWith("/adjustments")) {
        adjustment = req.postDataJSON();
        assert.equal(adjustment.type, "correction");
        assert.equal(adjustment.variantId, variantId);
        assert.ok([7,-3].includes(adjustment.quantity));
        assert.equal(adjustment.version, product.version);
        assert.equal(adjustment.reason, "Stock count updated");
        product.stock += adjustment.quantity;
        product.variants[0].stock += adjustment.quantity;
        product.version++;
        return send({ stock: product.variants[0].stock });
      }
      if (endpoint === "/admin/settings") {
        if (method === "PATCH") {
          settingsSave = req.postDataJSON();
          Object.assign(settings, settingsSave, {
            version: settings.version + 1,
          });
        }
        return send({ settings, paymentConfigured: true });
      }
      if (endpoint === "/admin/customers")
        return send({
          customers: [],
          summary: { total: 12, active: 12, blocked: 0 },
          pagination: { page: 1, totalPages: 1, total: 0, limit: 10 },
        });
      if (endpoint === "/admin/customer-requests")
        return send({
          requests: [request],
          summary: {
            total: 1,
            open: request.status === "open" ? 1 : 0,
            in_progress: request.status === "in_progress" ? 1 : 0,
            closed: request.status === "closed" ? 1 : 0,
          },
          pagination: { page: 1, totalPages: 1, total: 1, limit: 10 },
        });
      if (endpoint === `/admin/customer-requests/${id}`) {
        const body = req.postDataJSON();
        assert.equal(body.version, request.version);
        Object.assign(request, {
          status: body.status,
          resolutionNote: body.note,
          version: request.version + 1,
        });
        return send({ request });
      }
      if (endpoint === "/products/categories") return send({ categories: [] });
      return send({});
    });
    const shot = async (name) => {
      await page.locator(".admin-workspace").evaluate((element) => {
        element.scrollTop = 0;
      });
      return page.screenshot({
        path: path.join(output, name + ".png"),
        fullPage: true,
      });
    };
    await page.goto(origin + "/admin");
    await page
      .getByRole("link", { name: /Total orders/ })
      .filter({ hasText: "2" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Recent orders", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Quick access", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "Stock alerts", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole("link", { name: /Published products/ }).count(),
      0,
    );
    assert.equal(await page.getByRole('link',{name:/Total categories/}).count(),0);
    await page.getByRole('link',{name:/Total returns/}).waitFor();
    const dashboardPanels=page.locator('.dashboard-sections > section');
    const recent=await dashboardPanels.nth(0).boundingBox(), quick=await dashboardPanels.nth(1).boundingBox();
    assert.ok(Math.abs(recent.y-quick.y)<1 && Math.abs(recent.y+recent.height-quick.y-quick.height)<1,'Recent orders and Quick access align at both ends');
    const headings=page.locator('.dashboard-sections .dashboard-section-heading');
    await shot('dashboard-alignment');
    assert.ok(Math.abs((await headings.nth(0).boundingBox()).height-(await headings.nth(1).boundingBox()).height)<1,'Panel heading borders align');
    await shot("dashboard");
    await page.goto(origin + "/admin/inventory");
    await page
      .getByRole("button", { name: "Update stock", exact: true })
      .click();
    assert.equal(
      await page.getByText("Adjustment type", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: "+5", exact: true }).count(),
      0,
    );
    await page.getByLabel("New stock quantity").fill("-1");
    assert.equal(
      await page
        .getByRole("button", { name: "Save stock", exact: true })
        .isDisabled(),
      true,
    );
    await page.getByLabel("Product option").selectOption(otherId);
    assert.equal(await page.getByLabel("New stock quantity").inputValue(), "2");
    await page.getByLabel("Product option").selectOption(variantId);
    await page.getByLabel("New stock quantity").fill("11");
    await shot("stock-dialog");
    await page.getByRole("button", { name: "Save stock", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.ok(adjustment);
    assert.equal(
      await page.getByRole("button", { name: "Export CSV" }).count(),
      1,
    );
    assert.equal(
      await page.getByRole("button", { name: "Receive stock" }).count(),
      0,
    );
    assert.equal(await page.locator(".ops-row-actions a").count(), 0);
    await page.getByRole('button',{name:'Update stock',exact:true}).click();
    await page.getByLabel('New stock quantity').fill('8');
    await page.getByRole('status').filter({hasText:'Decrease by 3 units'}).waitFor();
    await page.getByRole('button',{name:'Save stock',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(adjustment.quantity,-3);
    assert.equal(product.variants[0].stock,8);
    const inventorySummary=await page.locator('.cm-heading .cm-summary').boundingBox();
    const inventoryExport=page.getByRole('button',{name:'Export CSV',exact:true});
    assert.ok((await inventoryExport.boundingBox()).y>=inventorySummary.y+inventorySummary.height,'Inventory export is below totals');
    const inventoryDownload=page.waitForEvent('download');await inventoryExport.click();
    assert.equal((await inventoryDownload).suggestedFilename(),'northstar-inventory.csv');
    await shot("inventory");
    await page.goto(origin + "/admin/orders");
    assert.equal(await page.getByText("Sales / Orders",{exact:true}).count(),0);
    assert.equal(await page.getByRole("button",{name:"Refresh orders"}).count(),0);
    await page.locator(".cm-heading > .cm-summary").waitFor();
    await page.getByRole("button",{name:"Advanced filters",exact:true}).click();
    await page.getByLabel("Sort orders").waitFor();
    await page.getByLabel("Order return status").waitFor();
    await page.getByRole('button',{name:'Actions for NS-0001',exact:true}).waitFor();
    const rowHeight=(await page.locator('tbody tr').first().boundingBox()).height;
    await page.getByRole('button',{name:'Actions for NS-0001',exact:true}).click();
    await page.getByRole('dialog',{name:'Order actions',exact:true}).waitFor();
    assert.equal((await page.locator('tbody tr').first().boundingBox()).height,rowHeight,'Action popup does not expand the row');
    await shot('order-actions-modal');
    await page
      .getByRole("button", { name: "Mark as paid", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Confirm payment received" })
        .isDisabled(),
      true,
    );
    await page
      .getByRole("checkbox", {
        name: /I confirm that payment has been received/,
      })
      .check();
    await page
      .getByRole("button", { name: "Confirm payment received" })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(paidCalls, 1);
    await page.getByRole('button',{name:'Actions for NS-0002',exact:true}).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Mark as paid", exact: true })
        .count(),
      0,
      "Online payments must not have a manual paid action",
    );
    await page
      .getByRole("button", { name: "Cancel order", exact: true })
      .click();
    await page
      .getByLabel("Cancellation reason (optional)")
      .fill("Customer requested cancellation");
    await page.getByRole("button", { name: "Confirm cancellation" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(cancels, 1);
    const ordersSummary=await page.locator('.cm-heading .cm-summary').boundingBox();
    const ordersExport=page.getByRole('button',{name:'Export CSV',exact:true});
    assert.ok((await ordersExport.boundingBox()).y>=ordersSummary.y+ordersSummary.height,'Orders export is below totals');
    const ordersDownload=page.waitForEvent('download');await ordersExport.click();
    assert.equal((await ordersDownload).suggestedFilename(),'northstar-orders.csv');
    await shot("orders");
    await page.goto(origin + `/admin/orders/${id}`);
    await page
      .getByRole("heading", { name: "Order details", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".admin-order-history-toggle").getAttribute("open"),
      null,
    );
    await page.getByText("Order & payment history", { exact: true }).click();
    await page
      .getByRole("heading", { name: "Payment history", exact: true })
      .waitFor();
    await page.getByText("Order & payment history", { exact: true }).click();
    await shot("order-details");
    await page.goto(origin + "/admin/customers");
    assert.equal(await page.getByRole('navigation',{name:'Customer sections'}).count(),0);
    const baselineHeader=await page.locator('.cm-table th').first().evaluate(el=>({fontSize:getComputedStyle(el).fontSize,padding:getComputedStyle(el).padding,background:getComputedStyle(el).backgroundColor}));
    for(const [route,title] of [['payments','Payments'],['returns','Returns & Refunds'],['offers','Offers & Campaigns']]){
      await page.goto(origin+'/admin/'+route);
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      await page.locator('tbody tr').first().waitFor();
      assert.equal(await page.locator('.cm-heading > .cm-summary').count(),1,title+' summary is in the shared header');
      const appearance=await page.locator('.cm-table th').first().evaluate(el=>({fontSize:getComputedStyle(el).fontSize,padding:getComputedStyle(el).padding,background:getComputedStyle(el).backgroundColor}));
      assert.deepEqual(appearance,baselineHeader,title+' table matches Customers');
      assert.equal(await page.locator('.cm-toolbar .cm-search').count(),1,title+' uses shared search');
      await shot(route+'-consistent');
    }
    await page.getByRole('navigation',{name:'Admin navigation'}).getByRole('link',{name:'Customer Requests',exact:true}).click();
    await page.locator('.requests-page .cm-heading .cm-summary').waitFor();
    assert.deepEqual(await page.locator('.requests-page th').allTextContents(),['Request','Customer','Date received','Status','Action']);
    assert.equal(await page.getByRole('navigation',{name:'Customer sections'}).count(),0);
    await page
      .getByRole("button", { name: "View request REQ-10001" })
      .click();
    await page
      .getByLabel("Internal note (optional)")
      .fill("Delivery question reviewed");
    await page.getByRole('button',{name:'Mark in progress',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(request.status,'in_progress');
    await page.getByRole('button',{name:'View request REQ-10001',exact:true}).click();
    await page.getByRole("button", { name: "Fulfill request" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(request.status, "closed");
    await page
      .getByRole("button", { name: "View request REQ-10001" })
      .click();
    await page.getByRole("button", { name: "Reopen request" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(request.status, "open");
    await shot("customer-requests");
    const adminNav=page.getByRole('navigation',{name:'Admin navigation'});
    assert.equal(await adminNav.getByRole('link',{name:'Settings',exact:true}).count(),0);
    assert.equal(await adminNav.getByRole('heading',{name:'System',exact:true}).count(),0);
    await page.goto(origin+'/admin/settings');
    await page.getByRole('heading',{name:'Page not found',exact:true}).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "/admin",
      "/admin/orders",
      "/admin/inventory",
      "/admin/customers/requests",
      `/admin/orders/${id}`,
    ]) {
      await page.goto(origin + route);
      await page.locator(".cm-heading h1").waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Mobile overflow: ${route}`,
      );
    }
    await shot("mobile-order-details");
    assert.deepEqual(
      errors.filter((error) => !/_.zd/.test(error)),
      [],
    );
    console.log(
      "PASS: real-count dashboard fixtures, quick access, simple variant stock editing, order action modal, dashboard alignment, stock decrease, guarded cash receipt, cancellation, simple details/history, customer request resolve/reopen, removed Settings route and System navigation and mobile layouts",
    );
  } finally {
    await browser?.close();
    server?.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
