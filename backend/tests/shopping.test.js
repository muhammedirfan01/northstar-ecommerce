import { productIsAvailable } from "../src/services/catalogService.js";
import { validationCase } from "./controllerTestHelpers.js";
import test from "node:test";
import assert from "node:assert/strict";
import Product from "../src/models/Product.js";
import { validateCartItem, validateCartQuantity, validateWishlistItem } from "../src/utils/shoppingValidation.js";
import { getCartItemDetails } from "../src/services/shoppingService.js";

const shoppingSchemas = {
  add: validationCase(validateCartItem),
  quantity: validationCase(validateCartQuantity),
  wish: validationCase(validateWishlistItem),
};
const productId = "111111111111111111111111";
const variantId = "222222222222222222222222";
function productFixture() {
  const document = new Product({
    name: "Laptop",
    pricePaise: 10000,
    stock: 10,
    isListed: true,
    isPublished: true,
    images: [
      {
        publicId: "test",
        url: "test.webp",
      },
    ],
  });
  return {
    ...document.toObject(),
    category: {
      isListed: true,
    },
    variants: document.variants,
  };
}
test("cart accepts only whole quantities within the limit and rejects browser prices", () => {
  assert.equal(
    shoppingSchemas.add.parse({
      productId,
      quantity: 1,
    }).variantId,
    null,
  );
  for (const quantity of [-1, 0, 1.5, 10, "2"])
    assert.equal(
      shoppingSchemas.add.safeParse({
        productId,
        quantity,
      }).success,
      false,
    );
  assert.equal(
    shoppingSchemas.add.safeParse({
      productId,
      quantity: 1,
      pricePaise: 1,
    }).success,
    false,
  );
  assert.equal(
    shoppingSchemas.quantity.safeParse({
      quantity: 1,
      userId: "another-user",
    }).success,
    false,
  );
});
test("shopping availability excludes drafts, unlisted categories/products and zero stock", () => {
  const product = productFixture();
  assert.equal(productIsAvailable(product), true);
  for (const changes of [
    {
      isPublished: false,
    },
    {
      isListed: false,
    },
    {
      stock: 0,
    },
    {
      category: null,
    },
    {
      category: {
        isListed: false,
      },
    },
  ]) {
    assert.equal(
      productIsAvailable({
        ...product,
        ...changes,
      }),
      false,
    );
  }
  assert.equal(productIsAvailable(null), false);
});
test("cart line prices are recomputed using current catalog values", () => {
  const product = productFixture();
  const item = {
    productId,
    variantId: null,
    quantity: 2,
  };
  assert.equal(getCartItemDetails(item, product).subtotalPaise, 20000);
  product.pricePaise = 15000;
  assert.equal(getCartItemDetails(item, product).subtotalPaise, 30000);
  product.stock = 1;
  assert.equal(getCartItemDetails(item, product).valid, false);
  assert.equal(getCartItemDetails(item, product).maxQuantity, 1);
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
  const item = {
    productId,
    variantId,
    quantity: 3,
  };
  assert.equal(getCartItemDetails(item, product).subtotalPaise, 75000);
  assert.equal(getCartItemDetails(item, product).valid, true);
  assert.equal(
    getCartItemDetails(
      {
        ...item,
        quantity: 4,
      },
      product,
    ).valid,
    false,
  );
  product.variants[0].isListed = false;
  assert.equal(getCartItemDetails(item, product).available, false);
  assert.equal(
    getCartItemDetails(
      {
        ...item,
        variantId: productId,
      },
      product,
    ).available,
    false,
  );
});
test("deleted products and removed variants remain removable invalid cart lines", () => {
  const item = {
    productId,
    variantId,
    quantity: 1,
  };
  assert.equal(getCartItemDetails(item, null).available, false);
  assert.equal(getCartItemDetails(item, productFixture()).available, false);
});

test("cart add/update and displayed stock share the nine-unit limit", () => {
  assert.equal(validateCartItem({ productId, quantity: 9 }).quantity, 9);
  assert.equal(validateCartQuantity({ quantity: 9 }).quantity, 9);
  assert.throws(() => validateCartQuantity({ quantity: 10 }), { status: 400 });
  const product = productFixture();
  const item = { productId, quantity: 9 };
  assert.equal(getCartItemDetails(item, product).maxQuantity, 9);
  assert.equal(getCartItemDetails(item, product).valid, true);
  const exceeded = getCartItemDetails({ ...item, quantity: 10 }, product);
  assert.equal(exceeded.valid, false);
  assert.equal(exceeded.error, "Maximum 9 units per option, including units already in your cart.");
});

test("low stock has a separate message from the nine-unit maximum", () => {
  const product = productFixture(); product.stock = 5;
  const result = getCartItemDetails({ productId, quantity: 6 }, product);
  assert.equal(result.maxQuantity, 5);
  assert.equal(result.error, "Only 5 units are available for this option.");
});
