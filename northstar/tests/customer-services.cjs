// Real browser interactions against explicit local fixtures, never customer records.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const origin = process.env.NORTHSTAR_TEST_ORIGIN || "http://127.0.0.1:5203";
const id = "111111111111111111111111",
  addressId = "222222222222222222222222";
const server = process.env.NORTHSTAR_TEST_ORIGIN
  ? null
  : spawn(
      process.execPath,
      [
        path.join(__dirname, "../node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
        "--port",
        "5203",
        "--strictPort",
      ],
      { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] },
    );
const ready = server
  ? new Promise((resolve, reject) => {
      server.stdout.on("data", (bytes) => {
        if (bytes.toString().includes("5203")) resolve();
      });
      server.once("exit", () => reject(Error("Vite stopped")));
    })
  : Promise.resolve();
const output =
  process.env.NORTHSTAR_SCREENSHOTS ||
  path.join(__dirname, "../test-results/customer-services");
fs.mkdirSync(output, { recursive: true });
(async () => {
  let browser;
  try {
    await ready;
    const transformed = await fetch(
      origin + "/src/features/profile/AddressForm.jsx",
    );
    assert.equal(
      transformed.status,
      200,
      "AddressForm must compile on the running Vite server",
    );
    const moduleSource = await transformed.text();
    const sharedImport = moduleSource.match(
      /from\s*["']([^"']*postalLocations\.mjs[^"']*)["']/,
    );
    assert.ok(
      sharedImport,
      "The shared city helper must resolve to a served module",
    );
    assert.equal(
      (await fetch(new URL(sharedImport[1], origin))).status,
      200,
      "The shared helper must not be blocked by Vite",
    );
    const repoDirectory = path
      .resolve(__dirname, "../..")
      .replaceAll("\\", "/");
    assert.equal(
      (await fetch(origin + "/@fs/" + repoDirectory + "/backend/app.js"))
        .status,
      403,
      "Backend files must remain outside Vite’s allowed folders",
    );
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    page.setDefaultTimeout(12000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    let postalUnavailable = false,
      savedAddresses = 0,
      placed = 0,
      orderMethod = "cod",
      submitted,
      onlinePaid = false;
    const user = {
      id,
      name: "Asha Devi",
      email: "asha@example.test",
      role: "customer",
      isEmailVerified: true,
      phone: "9876543210",
    };
    const address = {
      id: addressId,
      fullName: "Asha Devi",
      phoneNumber: "9876543210",
      addressLine1: "123 Main Street",
      city: "Kochi",
      state: "Kerala",
      postalCode: "682001",
      label: "Home",
      isDefault: true,
    };
    const item = {
      productId: id,
      productName: "Northstar Laptop",
      quantity: 1,
      unitPricePaise: 10000,
      lineTotalPaise: 10000,
      productImage: "",
      variantName: "Space Black · 16GB",
    };
    const quote = {
      items: [item],
      subtotal: 10000,
      totalAmount: 15000,
      shippingCharge: 5000,
      tax: 0,
      discount: 0,
      walletBalancePaise: 20000,
      paymentMethods: { cod: true, razorpay: true, wallet: true },
    };
    const order = () => ({
      ...quote,
      id,
      orderId: "NS-FIXTURE-001",
      paymentMethod: orderMethod,
      paymentStatus:
        orderMethod === "wallet" || onlinePaid ? "paid" : "pending",
      orderStatus: "confirmed",
      customer: user,
      createdAt: new Date().toISOString(),
      shippingAddress: {
        ...address,
        name: address.fullName,
        phone: address.phoneNumber,
        pincode: address.postalCode,
      },
      statusHistory: [{ status: "confirmed", at: new Date().toISOString() }],
      paymentHistory: [],
      refund: { status: "none" },
      returnRequest: { status: "none" },
    });
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const endpoint = url.pathname.slice(4),
        method = req.method();
      const send = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(
            status >= 400
              ? { success: false, message: data }
              : { success: true, data },
          ),
        });
      if (endpoint === "/auth/me") return send({ user });
      if (endpoint === "/cart")
        return send({ quantityTotal: 1, items: [], totalPaise: 10000 });
      if (endpoint === "/wishlist") return send({ products: [] });
      if (endpoint === "/products/categories")
        return send({
          categories: [
            { id, name: "Laptops", parentId: null },
            { id: "333333333333333333333333", name: "Mobiles", parentId: null },
            { id: "444444444444444444444444", name: "Audio", parentId: null },
            { id: addressId, name: "Hidden subcategory", parentId: id },
          ],
        });
      if (endpoint === "/support") {
        if (method === "POST") {
          submitted = req.postDataJSON();
          return send({ reference: "SUP-FIXTURE-001" }, 201);
        }
        return send({
          storeName: "NORTHSTAR",
          email: "care@example.test",
          phone: "+919876543210",
          address: "Fixture store address",
        });
      }
      if (endpoint === "/wallet") {
        const second = url.searchParams.get("page") === "2";
        return send({
          balancePaise: 20000,
          walletId: `NSW-${id}-INR`,
          page: second ? 2 : 1,
          limit: 10,
          total: 11,
          pages: 2,
          transactions: [
            {
              id: second ? addressId : id,
              orderId: id,
              type: second ? "debit" : "credit",
              amountPaise: 15000,
              description: second ? "Purchase · NS-OLD" : "Refund · NS-RECENT",
              createdAt: "2026-11-10T08:00:00Z",
            },
          ],
        });
      }
      if (endpoint.startsWith("/addresses/postal/")) {
        if (postalUnavailable)
          return send("Postal lookup is temporarily unavailable.", 503);
        const pin = endpoint.split("/").pop();
        if (pin === "999999") return send("This PIN code was not found.", 400);
        if (pin === "560001")
          await new Promise((resolve) => setTimeout(resolve, 500));
        return send({
          state: pin === "560001" ? "Karnataka" : "Kerala",
          districts: [pin === "560001" ? "Bengaluru" : "Ernakulam"],
          cities: pin === "560001" ? ["Bengaluru"] : ["Kochi", "Ernakulam"],
        });
      }
      if (endpoint === "/addresses") {
        if (method === "POST") {
          savedAddresses++;
          return send(
            { addresses: [address], version: savedAddresses, maxAddresses: 10 },
            201,
          );
        }
        return send({ addresses: [address], version: 0, maxAddresses: 10 });
      }
      if (endpoint === "/profile" && method === "PATCH") return send({ user });
      if (endpoint === "/orders/preview") {
        const body = req.postDataJSON();
        assert.equal(body.couponCode, body.couponCode.toUpperCase());
        return send(quote);
      }
      if (endpoint === "/orders" && method === "POST") {
        placed++;
        orderMethod = req.postDataJSON().paymentMethod;
        return send({ order: order() }, 201);
      }
      if (endpoint === `/orders/${id}`) return send({ order: order() });
      if (endpoint === `/orders/${id}/payment` && method === "POST")
        return send({
          order: order(),
          checkout: {
            key: "rzp_test_fixture",
            order_id: "order_fixture",
            amount: 15000,
            currency: "INR",
          },
        });
      if (endpoint === `/orders/${id}/payment/verify`) {
        orderMethod = "razorpay";
        onlinePaid = true;
        return send({ order: order() });
      }
      return send({
        products: [],
        pagination: { page: 1, totalPages: 1, total: 0 },
      });
    });
    await page.goto(origin + "/support");
    await page
      .getByRole("heading", { name: "Contact Us", exact: true })
      .waitFor();
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const firstItems = await nav.evaluate((element) =>
      Array.from(element.children)
        .slice(0, 3)
        .map((node) => node.textContent.trim()),
    );
    assert.deepEqual(firstItems, ["Home", "Categories ▾", "Shop Now"]);
    async function currentNavigation(label) {
      const current = nav.locator('[aria-current="page"]');
      await current.filter({ hasText: label }).waitFor();
      assert.equal(await current.count(), 1, "Only the current section is highlighted");
      await page.mouse.move(0, 0);
      const style = await current.evaluate((element) => {
        const css = getComputedStyle(element);
        return { width: css.borderBottomWidth, color: css.borderBottomColor };
      });
      assert.equal(style.width, "2px");
      assert.equal(style.color, "rgb(140, 130, 99)", "Underline remains without hover");
    }
    await currentNavigation("Support");
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await currentNavigation("Home");
    await nav.getByRole("link", { name: "Shop Now", exact: true }).click();
    await currentNavigation("Shop Now");
    await page.screenshot({ path: path.join(output, "navigation-shop.png") });
    await nav.getByRole("link", { name: "Laptops", exact: true }).click();
    await currentNavigation("Laptops");
    await nav.getByRole("link", { name: "Mobiles", exact: true }).click();
    await currentNavigation("Mobiles");
    await nav.getByRole("button", { name: "Categories" }).click();
    await page.locator(".category-dropdown-panel").getByRole("link", { name: "Audio", exact: true }).click();
    await currentNavigation("Categories");
    await page.reload();
    await currentNavigation("Categories");
    await page.setViewportSize({ width: 390, height: 844 });
    await currentNavigation("Categories");
    await page.screenshot({ path: path.join(output, "navigation-mobile.png") });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await nav.getByRole("link", { name: "Support", exact: true }).click();
    await page.getByRole("heading", { name: "Contact Us", exact: true }).waitFor();
    await currentNavigation("Support");
    assert.equal(
      await page
        .getByText("Customer care · Here to help", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByText(/Questions about a product, your order, or your account/)
        .count(),
      0,
    );
    await page.getByText("Fixture store address", { exact: true }).waitFor();
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const bounds = await page.locator(".support-page").boundingBox();
      if (bounds.y + bounds.height > viewport.height) {
        console.log(
          JSON.stringify({
            viewport,
            bounds,
            form: await page.locator(".support-form").boundingBox(),
            aside: await page.locator(".support-aside").boundingBox(),
          }),
        );
        await page.screenshot({
          path: path.join(output, "support-sizing.png"),
          fullPage: true,
        });
      }
      assert.ok(
        bounds.y + bounds.height <= viewport.height,
        "Support content should fit the normal desktop viewport at 100% zoom",
      );
    }
    await page.screenshot({
      path: path.join(output, "support-compact.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole("button", { name: "Categories" }).click();
    await page.locator(".category-dropdown-panel").waitFor();
    await page
      .getByRole("heading", { name: "Contact Us", exact: true })
      .click();
    await page.locator(".category-dropdown-panel").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Categories" }).click();
    await page.keyboard.press("Escape");
    await page.locator(".category-dropdown-panel").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Categories" }).click();
    await nav.getByRole("link", { name: "Shop Now", exact: true }).focus();
    await page.locator(".category-dropdown-panel").waitFor({ state: "hidden" });
    await page.getByLabel("Account options").click();
    const profilePanel = page.locator(".profile-panel");
    assert.equal(await profilePanel.getByRole("link", { name: "Support", exact: true }).count(), 0);
    assert.equal(await nav.getByRole("link", { name: "Support", exact: true }).count(), 1);
    assert.deepEqual(await profilePanel.locator(".profile-menu-group").first().locator("a").allTextContents().then(labels => labels.map(label => label.trim())), ["My Orders", "Saved Addresses", "My Wallet", "My Wishlist"]);
    for (const [label, href] of [
      ["My Orders", "/orders"], ["Saved Addresses", "/addresses"],
      ["My Wallet", "/wallet"], ["My Wishlist", "/wishlist"],
      ["My Profile", "/profile"], ["Shipping Policy", "/shipping-policy"],
      ["Terms & Conditions", "/terms-and-conditions"], ["Privacy Policy", "/privacy-policy"],
    ]) {
      const link = profilePanel.getByRole("link", { name: label, exact: true });
      assert.equal(await link.getAttribute("href"), href);
      assert.ok(await link.locator("svg.lucide").count() >= 1, label + " has a Lucide icon");
    }
    await page.screenshot({ path: path.join(output, "profile-menu-desktop.png") });
    await profilePanel.getByRole("button", { name: "Close account menu" }).click();
    await profilePanel.waitFor({ state: "hidden" });
    assert.equal(await page.getByLabel("Account options").evaluate(el => el === document.activeElement), true);
    await page.keyboard.press("Enter");
    await profilePanel.waitFor();
    await page.keyboard.press("Escape");
    await profilePanel.waitFor({ state: "hidden" });
    await page.getByLabel("Account options").click();
    await page.getByRole("heading", { name: "Contact Us", exact: true }).click();
    await profilePanel.waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Account options").click();
    await page.screenshot({ path: path.join(output, "profile-menu-mobile.png") });
    const menuBounds = await profilePanel.boundingBox();
    assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= 390, "Account menu fits the mobile width");
    assert.ok(menuBounds.y + menuBounds.height <= 844, "Account menu fits the mobile height");
    await page.screenshot({ path: path.join(output, "profile-menu-mobile.png") });
    await profilePanel.getByRole("button", { name: "Close account menu" }).click();
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByLabel("Account options").click();
    await profilePanel.getByRole("button", { name: "Sign Out", exact: true }).click();
    await page.getByRole("heading", { name: "Sign out of Northstar?" }).waitFor();
    await profilePanel.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Close sign-out confirmation", exact: true }).click();
    await page.getByLabel("Account options").click();
    for (const [name, href] of [
      ["Shipping Policy", "/shipping-policy"],
      ["Terms & Conditions", "/terms-and-conditions"],
      ["Privacy Policy", "/privacy-policy"],
    ])
      assert.equal(
        await page
          .locator(".profile-panel")
          .getByRole("link", { name, exact: true })
          .getAttribute("href"),
        href,
      );
    await page
      .locator(".profile-panel")
      .getByRole("link", { name: "Shipping Policy", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Shipping Policy", exact: true })
      .waitFor();
    await page.goto(origin + "/support");
    await page.locator('nav[aria-label="Main navigation"] a[href="/products"]').waitFor();
    assert.equal(
      await page
        .locator('nav[aria-label="Main navigation"] a[href="/products"]')
        .count(),
      1,
    );
    await page.getByRole("button", { name: "Categories" }).click();
    await page.locator(".category-dropdown-panel a").first().waitFor();
    assert.equal(await page.locator(".category-dropdown-panel a").count(), 3);
    assert.equal(
      await page.getByText("All products", { exact: true }).count(),
      0,
    );
    assert.equal(await page.getByText("Hidden subcategory").count(), 0);
    await page
      .getByLabel("Subject", { exact: true })
      .fill("Help with my order");
    await page
      .getByLabel("Message", { exact: true })
      .fill("Please help me find my delivery update.");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page.getByRole("heading", { name: "Message received" }).waitFor();
    assert.equal(submitted.email, user.email);
    await page.getByRole("button", { name: "Send another message" }).click();
    await page
      .getByRole("heading", { name: "Contact Us", exact: true })
      .click();
    await page.screenshot({
      path: path.join(output, "support-desktop.png"),
      fullPage: true,
    });
    for (const [url, name] of [
      ["privacy-policy", "Privacy Policy"],
      ["terms-and-conditions", "Terms & Conditions"],
      ["shipping-policy", "Shipping Policy"],
    ]) {
      await page.goto(origin + "/" + url);
      await page.getByRole("heading", { name, exact: true }).waitFor();
    }
    await page.goto(origin + "/wallet");
    await page.getByText("Refund · NS-RECENT", { exact: false }).waitFor();
    await page.screenshot({
      path: path.join(output, "wallet-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Next ›" }).click();
    await page.getByText("Purchase · NS-OLD", { exact: false }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Next ›" }).isDisabled(),
      true,
    );
    await page.goto(origin + "/profile/edit");
    const picker = page.getByLabel("Choose a profile photo");
    for (const [name, mimeType, buffer] of [
      ["document.pdf", "application/pdf", Buffer.from("%PDF-1.7")],
      [
        "slides.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        Buffer.from("PK slides"),
      ],
      ["renamed.jpg", "image/jpeg", Buffer.from("%PDF-1.7")],
    ]) {
      await picker.setInputFiles({ name, mimeType, buffer });
      await page
        .getByRole("alert")
        .filter({ hasText: /Choose a|could not be opened/ })
        .waitFor();
      assert.equal(await picker.inputValue(), "");
    }
    const png = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 20;
        canvas.height = 20;
        canvas.getContext("2d").fillRect(0, 0, 20, 20);
        return canvas.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    );
    await picker.setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.waitForFunction(() =>
      document.querySelector(".account-avatar img")?.src.startsWith("blob:"),
    );
    await page.goto(origin + "/checkout");
    await page
      .getByRole("button", { name: "Place COD order", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: /Review order|Continue to Razorpay/i })
        .count(),
      0,
    );
    assert.equal(await page.locator('.checkout-progress').count(), 0);
    assert.equal(await page.getByText(/Your purchase|A few final details/).count(), 0);
    await page.locator('.checkout-wallet-balance strong').waitFor();
    assert.equal(await page.locator('.checkout-wallet-balance strong').textContent(),'₹200.00');
    await page.getByText('Pay securely using UPI, cards or netbanking.',{exact:true}).waitFor();
    await page.getByText('Pay in cash when your order is delivered.',{exact:true}).waitFor();
    await page.getByLabel("Coupon code").fill("northstar10");
    assert.equal(
      await page.getByLabel("Coupon code").inputValue(),
      "NORTHSTAR10",
    );
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page
      .getByRole("button", { name: "Add new delivery address", exact: true })
      .click();
    await page.getByLabel("PIN code", { exact: true }).fill("999999");
    await page.getByRole("alert").filter({ hasText: "not found" }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Save address", exact: true })
        .isDisabled(),
      true,
    );
    postalUnavailable = true;
    await page.getByLabel("PIN code", { exact: true }).fill("682002");
    await page.getByRole("button", { name: "Retry lookup" }).waitFor();
    postalUnavailable = false;
    await page.getByRole("button", { name: "Retry lookup" }).click();
    await page.getByText(/PIN 682002: Kochi, Ernakulam/).waitFor();
    await page.getByLabel("PIN code", { exact: true }).fill("560001");
    await page.waitForTimeout(400);
    await page.getByLabel("PIN code", { exact: true }).fill("682001");
    await page.getByText(/PIN 682001: Kochi, Ernakulam/).waitFor();
    await page.waitForTimeout(600);
    assert.equal(
      await page.getByLabel("State / union territory").inputValue(),
      "Kerala",
    );
    assert.equal(
      await page.getByLabel("State / union territory").getAttribute("readonly"),
      "",
    );
    await page.getByLabel("City", { exact: true }).fill("Chennai");
    assert.equal(
      await page
        .getByRole("button", { name: "Save address", exact: true })
        .isDisabled(),
      true,
    );
    await page.getByLabel("City", { exact: true }).fill("Cochin");
    await page.getByText(/City matches this PIN code/).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Save address", exact: true })
        .isDisabled(),
      false,
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.screenshot({
      path: path.join(output, "checkout-desktop.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Place COD order", exact: true })
      .click();
    await page
      .getByRole("heading", { name: /Thank You for Your Order/ })
      .waitFor();
    await page
      .getByText("Payment is due on delivery.", { exact: false })
      .waitFor();
    assert.equal(placed, 1);
    assert.equal(await page.getByRole('link', {name:'My orders', exact:true}).locator('svg').count(), 1);
    await page.screenshot({
      path: path.join(output, "cod-confirmation.png"),
      fullPage: true,
    });
    await page.getByRole('link', {name:'Track order status', exact:true}).click();
    await page.locator('.purchase-detail-title').waitFor();
    assert.equal(await page.getByText('Your orders / Order details', {exact:true}).count(), 0);
    await page.getByRole('heading',{name:'Order information',exact:true}).waitFor();
    assert.equal(await page.getByText('Order & payment history',{exact:true}).count(),0);
    assert.equal(await page.locator('.order-information-grid > div').count(),4);
    await page.screenshot({path:path.join(output,'order-details-desktop.png'),fullPage:true});
    await page.goto(origin + "/checkout");
    await page.getByRole("radio", { name: /Northstar Wallet/ }).check();
    await page.getByRole("button", { name: /Pay with wallet/ }).click();
    await page
      .getByRole("heading", { name: /Thank You for Your Order/ })
      .waitFor();
    assert.equal(orderMethod, "wallet");
    await page.goto(origin + "/checkout");
    await page.evaluate(() => {
      window.modalOpens = 0;
      window.Razorpay = function (options) {
        this.on = () => {};
        this.close = () => {};
        this.open = () => {
          window.modalOpens++;
          setTimeout(
            () =>
              options.handler({
                razorpay_order_id: "order_fixture",
                razorpay_payment_id: "pay_fixture",
                razorpay_signature: "fixture",
              }),
            100,
          );
        };
      };
    });
    await page.getByRole("radio", { name: /Pay online with Razorpay/ }).check();
    await page.getByRole("button", { name: /Complete order & pay/ }).click();
    await page
      .getByRole("heading", { name: /Thank You for Your Order/ })
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.modalOpens),
      1,
      "The only checkout action must open Razorpay once",
    );
    assert.equal(orderMethod, "razorpay");
    quote.walletBalancePaise=0;
    quote.paymentMethods.wallet=false;
    await page.goto(origin+'/checkout');
    await page.getByText('Your balance must cover the full order total.',{exact:true}).waitFor();
    assert.equal(await page.locator('.checkout-wallet-balance strong').textContent(),'₹0.00');
    assert.equal(await page.getByRole('radio',{name:/Northstar Wallet/}).isDisabled(),true);
    await page.goto(origin+'/wallet');
    await page.getByRole('heading',{name:'My Wallet',exact:true}).waitFor();
    assert.equal(await page.locator('.wallet-page').getByRole('link',{name:/Shop now/i}).count(),0);
    for (const url of ["/support", "/wallet", "/checkout", "/privacy-policy"]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(origin + url);
      await page.locator("main h1").waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Mobile overflow: ${url}`,
      );
      await page.screenshot({
        path: path.join(output, url.slice(1) + "-mobile.png"),
        fullPage: true,
      });
    }
    assert.deepEqual(
      pageErrors.filter((error) => !/_.zd/.test(error)),
      [],
    );
    console.log(
      "PASS: grouped profile menu with icons, close/Escape/outside dismissal and mobile fit, active navigation on desktop/mobile, category changes and refresh, customer navigation, support submission, policies, wallet history, photo file restrictions, PIN lookup/retry/stale replies/city mismatch and alias handling, uppercase coupon, single checkout action, COD confirmation, wallet purchase, and mobile layouts",
    );
  } finally {
    await browser?.close();
    server?.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
