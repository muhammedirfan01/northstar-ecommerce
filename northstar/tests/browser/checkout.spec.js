import { test, expect, ids } from "./storeFixture.js";

test("checkout uses server payment availability for a zero-total order", async ({ page, store }) => {
  Object.assign(store.quote, { totalAmount: 0, discount: 60000, couponDiscount: 60000,
    paymentMethods: { cod: true, razorpay: false, wallet: true } });
  await page.goto("/checkout");
  await expect(page.getByRole("button", { name: "Place COD order" })).toBeEnabled();
  await expect(page.getByRole("radio", { name: /Pay online with Razorpay/ })).toBeDisabled();
});

test("invalid coupon shows the backend error and prevents order placement", async ({ page, store }) => {
  store.handlers["POST /orders/preview"] = ({ body, reply, route }) => body.couponCode
    ? route.fulfill({ status: 400, json: { message: "Coupon expired or not started" } }) : reply(store.quote);
  await page.goto("/checkout");
  await expect(page.getByRole("button", { name: "Place COD order" })).toBeEnabled();
  await page.getByRole("textbox", { name: "Coupon code" }).fill("EXPIRED");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Coupon expired or not started");
  await expect(page.getByRole("button", { name: "Place COD order" })).toHaveCount(0);
});

test("retry after an uncertain checkout response reuses the request ID and server total", async ({ page, store }) => {
  store.handlers["POST /orders"] = ({ route }) => route.fulfill({ status: 503, json: { message: "Temporary failure. Retry." } });
  await page.goto("/checkout");
  const place = page.getByRole("button", { name: "Place COD order" });
  await place.click();
  await expect(page.getByRole("alert")).toHaveText("Temporary failure. Retry.");
  await place.click();
  await expect.poll(() => store.calls.filter(call => call.key === "POST /orders").length).toBe(2);
  const requests = store.calls.filter(call => call.key === "POST /orders");
  expect(requests[0].body.requestId).toBe(requests[1].body.requestId);
  expect(requests[0].body.expectedTotalPaise).toBe(60000);
  expect(requests[0].body.addressId).toBe(ids.address);
});

test("a changed-price conflict refreshes the quote before checkout can continue", async ({ page, store }) => {
  store.handlers["POST /orders"] = ({ route }) => {
    store.quote.totalAmount = 65000;
    return route.fulfill({ status: 409, json: { message: "Prices changed. Review your order again." } });
  };
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Place COD order" }).click();
  await expect(page.getByRole("alert")).toContainText("Prices changed");
  await expect.poll(() => store.calls.filter(call => call.key === "POST /orders/preview").length).toBeGreaterThan(1);
});

test("successful COD checkout sends one order and opens its confirmation page", async ({ page, store }) => {
  store.handlers["POST /orders"] = ({ reply }) => reply({ order: store.order }, 201);
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Place COD order" }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${ids.order}/payment/success$`));
  await expect(page.getByRole("heading", { name: /Thank You for Your Order/ })).toBeVisible();
  expect(store.calls.filter(call => call.key === "POST /orders")).toHaveLength(1);
});
