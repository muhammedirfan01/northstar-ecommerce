import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import ShoppingList from "../models/ShoppingList.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import StoreSettings from "../models/StoreSettings.js";
import Campaign from "../models/Campaign.js";
import { checkout, placeOrder } from "../controllers/orderController.js";
import {
  makeServiceInput,
  makePublicServiceInput,
} from "../controllers/makeServiceInput.js";
import router from "../routes/orderRoutes.js";
import { requireAuth, requireCustomer } from "../middlewares/auth.js";
import noCache from "../middlewares/noCache.js";

afterEach(() => mock.restoreAll());
const id = "111111111111111111111111";
function setup() {
  const product = {
    _id: id,
    isListed: true,
    isPublished: true,
    stock: 4,
    pricePaise: 10000,
    category: { isListed: true },
    variants: [],
    images: [],
  };
  const item = { productId: id, quantity: 1 };
  const list = { cart: [item] };
  const address = { fullName: "Test Customer" };
  const req = {
    user: { _id: id, addresses: { id: () => address } },
    body: { addressId: id },
  };
  const coupon = {
    isActive: true,
    startDate: new Date(0),
    expiryDate: new Date("2099-01-01"),
    minPurchasePaise: 0,
    usageLimit: null,
    maxDiscountPaise: null,
    discountType: "percentage",
    discountValue: 10,
  };
  mock.method(ShoppingList, "findOne", () => ({ session: async () => list }));
  mock.method(Product, "find", () => ({
    session() {
      return this;
    },
    populate: async () => [product],
  }));
  mock.method(Coupon, "findOne", () => ({ session: async () => coupon }));
  return { req, list, product, item, coupon };
}
async function response(req) {
  let status, body;
  await checkout(req, {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  });
  return { status, body };
}
test("adapter keeps raw input references and supplies empty defaults", () => {
  assert.deepEqual(makeServiceInput({}), {
    body: {},
    user: undefined,
    params: {},
    query: {},
    file: undefined,
    files: undefined,
  });
  const req = {
    body: {},
    params: {},
    query: {},
    user: {},
    file: {},
    files: [],
  };
  for (const key of Object.keys(req))
    assert.equal(makeServiceInput(req)[key], req[key]);
  assert.equal(
    makePublicServiceInput({
      headers: { host: "shop.test" },
      protocol: "https",
    }).apiBaseUrl,
    "https://shop.test/api",
  );
});
test("order route preserves endpoint and authentication middleware order", () => {
  const route = router.stack.find((layer) => layer.route).route;
  assert.equal(route.path, "/preview");
  assert.equal(route.methods.post, true);
  assert.deepEqual(
    router.stack.filter((layer) => !layer.route).map((layer) => layer.handle),
    [noCache, requireAuth, requireCustomer],
  );
  const placement = router.stack.find(
    (layer) => layer.route?.path === "/" && layer.route.methods.post,
  ).route;
  assert.equal(placement.stack[0].handle, placeOrder);
});
const cases = [
  [
    "empty cart",
    (s) => {
      s.list.cart = [];
    },
    400,
    "cart is empty",
  ],
  [
    "unlisted product",
    (s) => {
      s.product.isListed = false;
    },
    400,
    "Product is unavailable",
  ],
  [
    "deleted product",
    (s) => {
      s.product.deletedAt = new Date();
    },
    400,
    "Product is unavailable",
  ],
  [
    "unpublished product",
    (s) => {
      s.product.isPublished = false;
    },
    400,
    "Product is unavailable",
  ],
  [
    "invalid quantity",
    (s) => {
      s.item.quantity = 0;
    },
    400,
    "Invalid quantity",
  ],
  [
    "insufficient stock",
    (s) => {
      s.product.stock = 0;
    },
    409,
    "Insufficient stock",
  ],
  [
    "missing variant",
    (s) => {
      s.product.variants = { length: 1, id: () => null };
    },
    400,
    "Variant is unavailable",
  ],
  [
    "inactive coupon",
    (s) => {
      s.req.body.couponCode = "SAVE";
      s.coupon.isActive = false;
    },
    400,
    "Invalid coupon",
  ],
  [
    "expired coupon",
    (s) => {
      s.req.body.couponCode = "SAVE";
      s.coupon.expiryDate = new Date(0);
    },
    400,
    "Coupon expired or not started",
  ],
  [
    "coupon minimum",
    (s) => {
      s.req.body.couponCode = "SAVE";
      s.coupon.minPurchasePaise = 999999;
    },
    400,
    "Minimum purchase amount not reached",
  ],
  [
    "coupon usage limit",
    (s) => {
      s.req.body.couponCode = "SAVE";
      s.coupon.usageLimit = 1;
      s.coupon.usedCount = 1;
    },
    409,
    "Coupon usage limit reached",
  ],
  [
    "invalid address",
    (s) => {
      s.req.body.addressId = "bad";
    },
    400,
    "Invalid address ID",
  ],
  [
    "missing address",
    (s) => {
      s.req.user.addresses.id = () => null;
    },
    400,
    "select a valid delivery address",
  ],
  ["valid checkout", () => {}, 200, "checkout validated sucessfully"],
  [
    "valid coupon",
    (s) => {
      s.req.body.couponCode = " save ";
    },
    200,
    "checkout validated sucessfully",
  ],
];
for (const [name, change, status, message] of cases) {
  test(`order checkout retains ${name} response`, async () => {
    const s = setup();
    change(s);
    assert.deepEqual(await response(s.req), {
      status,
      body: { success: status === 200, message },
    });
  });
}
test("unexpected order errors retain the existing generic 500 response", async () => {
  const s = setup();
  mock.method(ShoppingList, "findOne", () => {
    throw new Error("fixture failure");
  });
  const log = mock.method(console, "error", () => {});
  assert.deepEqual(await response(s.req), {
    status: 500,
    body: { success: false, message: "Something went wrong" },
  });
  assert.equal(log.mock.calls.length, 1);
});
import createApp from "../app.js";
import User from "../models/User.js";
import { createToken } from "../utils/jwt.js";
import { AUTH_COOKIE_NAME } from "../config/jwt.js";

test("order HTTP endpoint preserves auth, customer restriction and checkout contract", async () => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "order-fixture-secret-at-least-32-characters";
  const s = setup();
  Object.assign(s.req.user, { id, role: "customer", isEmailVerified: true });
  mock.method(User, "findById", () => ({ select: async () => s.req.user }));
  mock.method(StoreSettings, "findById", () => ({
    session() {
      return this;
    },
    lean: async () => null,
  }));
  mock.method(Campaign, "find", () => ({
    sort() {
      return this;
    },
    session() {
      return this;
    },
    lean: async () => [],
  }));
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/orders/preview`;
  const headers = {
    "Content-Type": "application/json",
    Cookie: `${AUTH_COOKIE_NAME}=${createToken(s.req.user)}`,
  };
  try {
    assert.equal((await fetch(url, { method: "POST" })).status, 401);
    s.req.user.role = "admin";
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(s.req.body),
        })
      ).status,
      403,
    );
    s.req.user.role = "customer";
    const result = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(s.req.body),
    });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).success, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});
