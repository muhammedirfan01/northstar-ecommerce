import { test, expect, ids } from "./storeFixture.js";

test("catalog failure displays a retry action and recovers after a successful response", async ({ page, store }) => {
  store.handlers["GET /products"] = ({ route }) => route.fulfill({ status: 503, json: { message: "Catalog unavailable" } });
  await page.goto("/products");
  await expect(page.getByRole("alert")).toContainText("Catalog unavailable");
  delete store.handlers["GET /products"];
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test Headphones", exact: true })).toBeVisible();
});

test("empty catalog displays its empty state", async ({ page, store }) => {
  store.handlers["GET /products"] = ({ reply }) => reply({ products: [], pagination: { page: 1, total: 0, totalPages: 1 } });
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "No products found" })).toBeVisible();
});

test("unavailable cart items prevent checkout", async ({ page, store }) => {
  store.cart.items[0] = { ...store.cart.items[0], available: false, valid: false, maxQuantity: 0, error: "This product is unavailable." };
  store.cart.canCheckout = false;
  await page.goto("/cart");
  await expect(page.getByText("This product is unavailable.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Proceed to checkout/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Increase Test Headphones" })).toBeDisabled();
});

test("quantity increase is disabled at the nine-unit cap", async ({ page, store }) => {
  store.cart.items[0].quantity = 9;
  store.cart.quantityTotal = 9;
  await page.goto("/cart");
  await expect(page.getByRole("button", { name: "Increase Test Headphones" })).toBeDisabled();
  expect(store.calls.filter(call => call.key.startsWith("PATCH /cart"))).toEqual([]);
});

test("removing the final cart item displays the empty cart", async ({ page, store }) => {
  store.handlers["DELETE /cart/cart-line"] = ({ reply }) => {
    store.cart = { items: [], quantityTotal: 0, totalPaise: 0, canCheckout: false };
    return reply(store.cart);
  };
  await page.goto("/cart");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
});

test("Buy Now opens checkout with the selected quantity and never adds it to the cart", async ({ page, store }) => {
  await page.goto(`/products/${ids.product}`);
  await page.getByLabel("Quantity", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: /Buy now/i }).click();
  await expect(page).toHaveURL(/\/checkout\?/);
  await expect.poll(() => store.calls.filter(call => call.key === "POST /orders/preview").length).toBeGreaterThan(0);
  const preview = store.calls.find(call => call.key === "POST /orders/preview");
  expect(preview.body.buyNow).toEqual({ productId: ids.product, variantId: null, quantity: 2 });
  expect(store.calls.filter(call => call.key === "POST /cart")).toEqual([]);
});
