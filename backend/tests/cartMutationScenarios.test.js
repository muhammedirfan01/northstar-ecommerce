import test from "node:test";
import assert from "node:assert/strict";
import Product from "../src/models/Product.js";
import ShoppingList from "../src/models/ShoppingList.js";
import Campaign from "../src/models/Campaign.js";
import { updateCartItem, removeCartItem } from "../src/services/cartService.js";
import { addToWishlist } from "../src/services/wishlistService.js";
import { ids, account, queryResult } from "./scenarioHelpers.js";

function shoppingFixture(t, stock = 9) {
  const product = new Product({ _id: ids.product, name: "Headphones", pricePaise: 10000,
    stock, isPublished: true, isListed: true, images: [], variants: [] });
  const catalogProduct = { ...product.toObject(), variants: product.variants,
    category: { isListed: true, deletedAt: null } };
  const list = new ShoppingList({ userId: ids.user, cart: [{ _id: ids.address, productId: ids.product, quantity: 1 }] });
  const save = t.mock.method(list, "save", async () => list);
  t.mock.method(ShoppingList, "findOne", () => queryResult(list));
  t.mock.method(Product, "findById", () => queryResult(catalogProduct));
  t.mock.method(Product, "find", () => queryResult([catalogProduct]));
  t.mock.method(Campaign, "find", () => queryResult([]));
  return { list, save, product: catalogProduct };
}

test("cart quantity update uses current product price and allows the nine-unit boundary", async (t) => {
  const { list, save } = shoppingFixture(t);
  const result = await updateCartItem({ user: account(), params: { id: ids.address }, body: { quantity: 9 } });
  assert.equal(list.cart[0].quantity, 9);
  assert.equal(result.body.data.totalPaise, 90000);
  assert.equal(result.body.data.canCheckout, true);
  assert.equal(save.mock.callCount(), 1);
});

test("stock reduction blocks an excessive cart edit without saving it", async (t) => {
  const { list, save } = shoppingFixture(t, 2);
  await assert.rejects(updateCartItem({ user: account(), params: { id: ids.address }, body: { quantity: 3 } }), { status: 409 });
  assert.equal(list.cart[0].quantity, 1);
  assert.equal(save.mock.callCount(), 0);
});

test("cart removal deletes the requested line and makes an empty cart ineligible for checkout", async (t) => {
  const { list, save } = shoppingFixture(t);
  const result = await removeCartItem({ user: account(), params: { id: ids.address } });
  assert.equal(list.cart.length, 0);
  assert.equal(result.body.data.quantityTotal, 0);
  assert.equal(result.body.data.canCheckout, false);
  assert.equal(save.mock.callCount(), 1);
});

test("another customer's cart line cannot be edited or deleted", async (t) => {
  const { save } = shoppingFixture(t);
  await assert.rejects(updateCartItem({ user: account(), params: { id: ids.order }, body: { quantity: 1 } }), { status: 404 });
  await assert.rejects(removeCartItem({ user: account(), params: { id: ids.order } }), { status: 404 });
  assert.equal(save.mock.callCount(), 0);
});

test("wishlist limit rejects a new product while keeping existing entries", async (t) => {
  const { list, save } = shoppingFixture(t);
  list.wishlist = Array.from({ length: 100 }, () => ids.order);
  await assert.rejects(addToWishlist({ user: account(), body: { productId: ids.product } }), /up to 100/);
  assert.equal(list.wishlist.length, 100);
  assert.equal(save.mock.callCount(), 0);
});
