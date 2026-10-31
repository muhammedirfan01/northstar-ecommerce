import test from "node:test";
import assert from "node:assert/strict";
import Product from "../models/Product.js";
import { shoppingSchemas } from "../middlewares/validateShopping.js";
import {
  describeCartItem,
  productIsAvailable,
} from "../services/shoppingService.js";

const productId = "111111111111111111111111";
const variantId = "222222222222222222222222";
function productFixture() {
  const document = new Product({
    name: "Laptop",
    pricePaise: 10000,
    stock: 10,
    isListed: true,
    isPublished: true,
    images: [{ publicId: "test", url: "test.webp" }],
  });
  return {
    ...document.toObject(),
    category: { isListed: true },
    variants: document.variants,
  };
}

test("cart accepts only whole quantities within the limit and rejects browser prices", () => {
  assert.equal(
    shoppingSchemas.add.parse({ productId, quantity: 1 }).variantId,
    null,
  );
  for (const quantity of [-1, 0, 1.5, 6, "2"])
    assert.equal(
      shoppingSchemas.add.safeParse({ productId, quantity }).success,
      false,
    );
  assert.equal(
    shoppingSchemas.add.safeParse({ productId, quantity: 1, pricePaise: 1 })
      .success,
    false,
  );
  assert.equal(
    shoppingSchemas.quantity.safeParse({ quantity: 1, userId: "another-user" })
      .success,
    false,
  );
  assert.equal(
    shoppingSchemas.checkout.safeParse({ expectedTotalPaise: -1 }).success,
    false,
  );
});

test("shopping availability excludes drafts, unlisted categories/products and zero stock", () => {
  const product = productFixture();
  assert.equal(productIsAvailable(product), true);
  for (const changes of [
    { isPublished: false },
    { isListed: false },
    { stock: 0 },
    { category: null },
    { category: { isListed: false } },
  ]) {
    assert.equal(productIsAvailable({ ...product, ...changes }), false);
  }
  assert.equal(productIsAvailable(null), false);
});

test("cart line prices are recomputed using current catalog values", () => {
  const product = productFixture();
  const item = { productId, variantId: null, quantity: 2 };
  assert.equal(describeCartItem(item, product).subtotalPaise, 20000);
  product.pricePaise = 15000;
  assert.equal(describeCartItem(item, product).subtotalPaise, 30000);
  product.stock = 1;
  assert.equal(describeCartItem(item, product).valid, false);
  assert.equal(describeCartItem(item, product).maxQuantity, 1);
});

test("cart validates the selected variant's own price, stock and visibility", () => {
  const product = productFixture();
  product.variants.push({
    _id: variantId,
    name: "Silver",
    pricePaise: 25000,
    stock: 3,
    isListed: true,
  });
  const item = { productId, variantId, quantity: 3 };
  assert.equal(describeCartItem(item, product).subtotalPaise, 75000);
  assert.equal(describeCartItem(item, product).valid, true);
  assert.equal(
    describeCartItem({ ...item, quantity: 4 }, product).valid,
    false,
  );
  product.variants[0].isListed = false;
  assert.equal(describeCartItem(item, product).available, false);
  assert.equal(
    describeCartItem({ ...item, variantId: productId }, product).available,
    false,
  );
});

test("deleted products and removed variants remain removable invalid cart lines", () => {
  const item = { productId, variantId, quantity: 1 };
  assert.equal(describeCartItem(item, null).available, false);
  assert.equal(describeCartItem(item, productFixture()).available, false);
});
