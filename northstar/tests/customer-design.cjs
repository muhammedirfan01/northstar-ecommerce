// Local fixture browser checks. External payments and production records are not used.
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
    "5194",
    "--strictPort",
  ],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
);
const ready = new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes("5194")) resolve();
  });
  server.once("exit", () => reject(Error("Vite stopped")));
});
const id = "111111111111111111111111",
  addressId = "222222222222222222222222";
(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let role = "customer",
      version = 0,
      lastQuery = "",
      saved = 0,
      returnStatus = "none",
      description = "",
      reviewNote = "",
      photoCount = 0,
      refundStatus = "none",
      received = 0;
    const addresses = [
      {
        id: addressId,
        fullName: "Julian Sterling",
        phoneNumber: "9876543210",
        addressLine1: "Flat 402, Signature Towers",
        addressLine2: "DLF Phase 5",
        city: "Gurugram",
        state: "Haryana",
        postalCode: "122002",
        isDefault: true,
        label: "Home",
      },
    ];
    const shippingAddress = {
      name: "Julian Sterling",
      phone: "9876543210",
      addressLine1: "Flat 402, Signature Towers",
      addressLine2: "DLF Phase 5",
      city: "Gurugram",
      state: "Haryana",
      pincode: "122002",
    };
    const names = [
      "Apple MacBook Pro 16-inch Liquid Retina XDR",
      "Sony Alpha 7 IV Full-Frame Mirrorless Camera",
      "Studio Reference Over-Ear ANC Headphones",
      "Apple Watch Series 9 GPS + Cellular",
    ];
    const prices = [12495000, 15999000, 3490000, 4190000];
    const rows = () =>
      names.map((name, i) => ({
        id: i ? id.slice(0, -1) + i : id,
        orderId: `NS-${88402 - i}`,
        items: [
          {
            productId: id,
            productName: name,
            variantName: [
              "M3 Pro · 36 GB Unified Memory · 512 GB SSD · Space Black",
              "33 MP Exmor CMOS · 28–70 mm zoom lens kit",
              "Lossless USB-C · 40-hour battery · Silver",
              "45 mm · Midnight aluminium · Sport loop",
            ][i],
            quantity: 1,
            lineTotalPaise: prices[i],
          },
        ],
        shippingAddress,
        customer: { name: "Julian Sterling", email: "julian@example.test" },
        subtotal: prices[i],
        shippingCharge: 0,
        tax: 0,
        discount: 0,
        totalAmount: prices[i],
        paymentStatus: "paid",
        paymentMethod: "razorpay",
        orderStatus: i === 3 ? "shipped" : "delivered",
        createdAt: "2026-10-10T10:00:00Z",
        statusHistory: [
          "pending",
          "confirmed",
          "shipped",
          "out_for_delivery",
          "delivered",
        ].map((status) => ({ status, at: "2026-10-12T10:00:00Z" })),
        paymentHistory: [{ status: "paid", at: "2026-10-10T10:00:00Z" }],
        returnRequest: {
          status: returnStatus,
          reason: "Received defective or malfunctioning item",
          description,
          reference: "RET-NS-88402",
          pickupAddress: shippingAddress,
          packagingConfirmed: true,
          requestedAt: "2026-11-09T10:00:00Z",
          reviewNote,
          photos: photoCount
            ? [{ id: addressId, name: "return-photo-1.jpg" }]
            : [],
        },
        refund: { status: refundStatus, method: "cash", amount: prices[i] },
      }));
    let failure = false;
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (!u.pathname.startsWith("/api/")) return route.continue();
      const p = u.pathname.slice(4),
        method = req.method();
      lastQuery = u.search;
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
            name: "Julian Sterling",
            email: "julian@example.test",
            role,
            isEmailVerified: true,
          },
        });
      if (p === "/cart")
        return send({ quantityTotal: 1, items: [], totalPaise: 12495000 });
      if (p === "/wishlist") return send({ products: [] });
      if (p.includes("categories")) return send({ categories: [] });
      if (p.startsWith("/addresses/postal/"))
        return send({
          state: p.endsWith("560001") ? "Karnataka" : "Haryana",
          districts: [p.endsWith("560001") ? "Bengaluru" : "Gurugram"],
          cities: [p.endsWith("560001") ? "Bengaluru" : "Gurugram"],
        });
      if (p === "/addresses") {
        if (method === "POST") {
          const body = req.postDataJSON();
          assert.equal(body.version, version);
          addresses.push({ ...body, id: "333333333333333333333333" });
          version++;
          saved++;
        }
        return send({ addresses, version, maxAddresses: 10 });
      }
      if (p === `/addresses/${addressId}`) {
        const body = req.postDataJSON();
        assert.equal(body.version, version);
        addresses[0] = { ...addresses[0], ...body };
        version++;
        saved++;
        return send({ addresses, version, maxAddresses: 10 });
      }
      if (p === "/orders/preview") {
        const body = req.postDataJSON();
        if (body.couponCode === "BAD") return send("Coupon is invalid.", 400);
        return send({ ...rows()[0], items: rows()[0].items });
      }
      if (p === "/orders" || p === "/admin/orders")
        return send({
          orders: rows(),
          pagination: { page: 1, limit: 4, total: 21, totalPages: 6 },
          returnSummary: {
            total: 21,
            requested: 7,
            accepted: 4,
            completed: 8,
            rejected: 2,
          },
        });
      if (p.endsWith("/return/photos/" + addressId))
        return route.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jIn0AAAAASUVORK5CYII=",
            "base64",
          ),
        });
      if (p.endsWith("/return") && method === "POST") {
        const raw = req.postDataBuffer().toString();
        assert.match(raw, /packagingConfirmed/);
        assert.match(raw, /photos/);
        assert.match(raw, /image\/png/);
        photoCount = 1;
        description = "The camera will not switch on.";
        returnStatus = "requested";
        return send({ order: rows()[0] });
      }
      if (p.endsWith("/return/review")) {
        const body = req.postDataJSON();
        returnStatus = body.decision;
        reviewNote = body.note;
        return send({ order: rows()[0] });
      }
      if (p.endsWith("/return/complete")) {
        returnStatus = "completed";
        refundStatus = "pending";
        received++;
        return send({ order: rows()[0] });
      }
      if (p.endsWith("/refund")) {
        assert.equal(req.postDataJSON().reference, "TEST-REFUND-001");
        refundStatus = "completed";
        return send({ order: rows()[0] });
      }
      if (p.endsWith("/invoice"))
        return route.fulfill({
          contentType: "application/pdf",
          body: "%PDF-1.4 fixture",
        });
      if (p === `/orders/${id}` || p === `/admin/orders/${id}`) {
        const order = rows()[0];
        if (failure) {
          order.orderStatus = "pending";
          order.paymentStatus = "failed";
        }
        return send({ order });
      }
      return send({ products: [], pagination: { page: 1, totalPages: 1 } });
    });
    const origin = "http://127.0.0.1:5194",
      out = process.env.NORTHSTAR_SCREENSHOTS;
    if (out) fs.mkdirSync(out, { recursive: true });
    async function shot(name) {
      if (out)
        await page.screenshot({
          path: path.join(out, name + ".png"),
          fullPage: true,
        });
    }
    async function mobile() {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Mobile content overflows",
      );
      await page.setViewportSize({ width: 1280, height: 1100 });
    }
    await page.goto(origin + "/orders");
    await page
      .getByRole("link", { name: "View order details", exact: true })
      .first()
      .waitFor();
    await shot("customer-orders");
    await page
      .getByRole("textbox", { name: "Search orders", exact: true })
      .fill("MacBook");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("search=MacBook")),
      page.getByRole("button", { name: "Search orders", exact: true }).click(),
    ]);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("timeframe=3months")),
      page.getByLabel("Filter by timeframe:").selectOption("3months"),
    ]);
    assert.match(lastQuery, /search=MacBook/);
    await mobile();
    await page.goto(origin + "/checkout");
    await page.getByRole("button", { name: "Place COD order" }).waitFor();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Street address", exact: true })
      .fill("Suite 18, Signature Towers");
    await page
      .getByRole("button", { name: "Save address", exact: true })
      .click();
    await page.getByText("Suite 18, Signature Towers").waitFor();
    assert.equal(saved, 1);
    await page
      .getByRole("button", { name: "Add new delivery address", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Full name", exact: true })
      .fill("Julian Sterling");
    await page
      .getByRole("textbox", { name: "Street address", exact: true })
      .fill("45 Residency Road");
    await page.getByLabel("PIN code", { exact: true }).fill("560001");
    await page.getByLabel("City", { exact: true }).fill("Bengaluru");

    await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
    await page
      .getByRole("button", { name: "Save address", exact: true })
      .click();
    await page.getByText("45 Residency Road").waitFor();
    assert.equal(saved, 2);
    await page.getByRole("textbox", { name: "Coupon code" }).fill("BAD");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Coupon is invalid." })
      .waitFor();
    await page.getByRole("textbox", { name: "Coupon code" }).fill("");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("button", { name: "Place COD order" }).waitFor();
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await shot("customer-checkout");
    await mobile();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto(origin + `/orders/${id}/payment/success`);
    await page
      .getByRole("heading", { name: /Thank You for Your Order/ })
      .waitFor();
    await shot("customer-confirmation");
    await mobile();
    failure = true;
    await page.goto(origin + `/orders/${id}/payment/failure`);
    await page
      .getByRole("heading", { name: "Payment Could Not Be Processed" })
      .waitFor();
    await shot("customer-payment-failure");
    await mobile();
    failure = false;
    await page.goto(origin + `/orders/${id}/return`);
    await page
      .getByLabel("Return reason · Required")
      .selectOption("Received defective or malfunctioning item");
    await page
      .getByRole("textbox", { name: /Detailed description/ })
      .fill("The camera will not switch on.");
    await page.getByLabel("Upload return photos").setInputFiles({
      name: "evidence.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jIn0AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.getByRole("checkbox").check();
    await shot("customer-return-request");
    await mobile();
    await page.getByRole("button", { name: "Submit return request →" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Return Request Submitted",
    });
    await dialog.waitFor();
    await shot("customer-return-submitted");
    await page.keyboard.press("Tab");
    assert.ok(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    role = "admin";
    await page.goto(origin + "/admin/returns");
    await page.getByRole("heading", { name: "Returns & Refunds" }).waitFor();
    await page
      .getByRole("button", { name: "Review return for NS-88402" })
      .waitFor();
    assert.ok(
      await page
        .locator(".ops-table-scroll")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      "Admin return actions should fit without desktop scrolling",
    );
    await shot("admin-returns");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("returnStatus=all")),
      page
        .getByRole("combobox", { name: "Return status", exact: true })
        .selectOption("all"),
    ]);
    await page
      .getByRole("button", { name: "Review return for NS-88402" })
      .click();
    await page
      .getByLabel("Return review note")
      .fill("Photo reviewed; accept for inspection.");
    await shot("admin-return-dialog");
    await page
      .getByRole("button", { name: "Accept return", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm returned goods received" })
      .click();
    await page.getByRole("heading", { name: "Refund: Pending" }).waitFor();
    assert.equal(received, 1);
    await page
      .getByLabel("Reference confirming cash was refunded")
      .fill("TEST-REFUND-001");
    await page
      .getByRole("button", { name: "Confirm cash refund paid" })
      .click();
    await page.getByRole("heading", { name: "Refund: Completed" }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await mobile();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: customer reference layouts, search/timeframe, inline address edit/add, coupon error recovery, responsive pages, photo return submission and modal, admin return review/receipt/refund",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
