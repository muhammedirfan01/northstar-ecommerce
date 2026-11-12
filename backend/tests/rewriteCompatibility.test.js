import Campaign from "../src/models/Campaign.js";
import { postalDirectory } from "../src/services/postalService.js";
import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import ShoppingList from "../src/models/ShoppingList.js";
import { OAuth2Client } from "google-auth-library";
import { googleSignIn } from "../src/controllers/googleAuthController.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../src/controllers/shoppingController.js";
import {
  saveVariant,
  deleteVariant,
} from "../src/controllers/productController.js";
import ProfileVerification from "../src/models/ProfileVerification.js";
import { startLogin } from "../src/controllers/loginController.js";
import { changePassword } from "../src/controllers/profileSecurityController.js";
import { getPhoto } from "../src/controllers/profileController.js";
import { getCustomerPhoto } from "../src/controllers/adminController.js";
import {
  addAddress,
  deleteAddress,
  editAddress,
} from "../src/controllers/addressController.js";
import { hashPassword } from "../src/utils/password.js";
import { hashOtp } from "../src/utils/otp.js";
import { getLoginData } from "../src/utils/jwt.js";
import { AUTH_COOKIE_NAME } from "../src/config/jwt.js";
import createApp from "../src/app.js";

process.env.JWT_SECRET = "rewrite-compatibility-test-secret-32-characters";
process.env.OTP_SECRET = "ab".repeat(32);
process.env.CLIENT_URL = "http://localhost:5173";
const id = "111111111111111111111111";
const firstId = "222222222222222222222222";
const secondId = "333333333333333333333333";
const account = {
  id,
  _id: id,
  name: "Asha Devi",
  email: "asha@example.test",
  role: "customer",
  isEmailVerified: true,
  isBlocked: false,
  deletedAt: null,
  authVersion: 2,
};
const select = (value) => ({ select: () => value });
const lean = (value) => ({ select: () => ({ lean: async () => value }) });

function response() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    type(value) {
      this.headers.type = value;
      return this;
    },
    set(name, value) {
      if (typeof name === "object") Object.assign(this.headers, name);
      else this.headers[name] = value;
      return this;
    },
  };
}
afterEach(() => mock.restoreAll());

test("wishlist read, add and remove actions preserve results and save only changes", async () => {
  mock.method(Campaign, "find", () => ({ sort() { return this; }, session() { return this; }, lean: async () => [] }));
  const product = {
    _id: firstId,
    name: "Sample product",
    description: "A sample product.",
    category: {
      _id: secondId,
      name: "Laptops",
      isListed: true,
      deletedAt: null,
    },
    images: [],
    variants: [],
    stock: 5,
    pricePaise: 10000,
    regularPricePaise: null,
    isListed: true,
    isPublished: true,
    deletedAt: null,
    highlights: [],
    specifications: [],
  };
  let saves = 0;
  const list = {
    wishlist: [],
    cart: [],
    async save() {
      saves++;
    },
  };
  mock.method(ShoppingList, "findOne", async () => list);
  mock.method(Product, "findById", () => ({ populate: async () => product }));
  mock.method(Product, "find", () => ({ populate: async () => [product] }));
  const added = response();
  await addToWishlist({ user: account, body: { productId: firstId } }, added);
  assert.equal(added.body.data.products[0].id, firstId);
  const current = response();
  await getWishlist({ user: account }, current);
  assert.equal(current.body.data.products.length, 1);
  const removed = response();
  await removeFromWishlist({ user: account, params: { id: firstId } }, removed);
  assert.deepEqual(removed.body.data.products, []);
  assert.equal(saves, 2);
});

test("variant image validation, editing and deletion preserve price, stock and the default selection", async () => {
  const product = new Product({
    name: "Laptop",
    description: "A sample laptop.",
    category: secondId,
    images: [{ publicId: "sample", url: "/sample.webp" }],
    pricePaise: 10000,
    stock: 0,
    variants: [{ name: "Large", options: [{ name: "Size", value: "Large" }], pricePaise: 10000, stock: 0, images: [1,2,3].map((n) => ({ publicId: "sample-" + n, url: "/sample-" + n + ".webp" })) }],
    isListed: true,
    isPublished: true,
  });
  mock.method(Product, "findById", async () => product);
  mock.method(product, "save", async () => product);
  mock.method(product, "populate", async () => product);
  await assert.rejects(saveVariant({ params: { id: String(product._id) }, files: [], body: { name: "Small", price: "120", regularPrice: "150", stock: "3", isListed: true } }, response()), /at least three images/);
  mock.method(Order, "exists", async () => null);
  const created = response();
  await saveVariant(
    {
      params: { id: String(product._id), variantId: String(product.variants[0]._id) },
      files: [],
      body: {
        version: 0,
        name: "Large",
        options: [{ name: "Size", value: "Large" }],
        colorHex: "",
        imageId: "",
        price: "120",
        regularPrice: "150",
        stock: "3",
        isListed: true,
        isDefault: true,
      },
    },
    created,
  );
  assert.equal(created.statusCode, 200);
  assert.equal(created.body.data.product.stock, 3);
  assert.equal(created.body.data.product.pricePaise, 12000);
  const variantId = created.body.data.product.variants[0].id;
  assert.equal(created.body.data.product.defaultVariantId, variantId);
  const removed = response();
  await deleteVariant(
    { params: { id: String(product._id), variantId } },
    removed,
  );
  assert.deepEqual(removed.body.data.product.variants, []);
  assert.equal(removed.body.data.product.stock, 0);
  assert.equal(removed.body.data.product.defaultVariantId, null);
});

test("Google sign-in keeps its public user response and issues a cookie after verification", async () => {
  mock.method(OAuth2Client.prototype, "getToken", async () => ({
    tokens: { id_token: "test-only-token" },
  }));
  mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({
    getPayload: () => ({
      sub: "google-test-user",
      email: account.email,
      email_verified: true,
    }),
  }));
  mock.method(User, "findOne", () =>
    select({ ...account, googleId: "google-test-user" }),
  );
  const res = response();
  await googleSignIn({ body: { code: "test-only-code" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.user.isGoogleAccount, true);
  assert.equal(res.body.data.user.googleId, undefined);
  assert.equal(res.cookies.length, 1);
});

test("rewritten app starts and preserves health, missing-route and validation responses", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(base + "/api/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).success, true);
    assert.equal((await fetch(base + "/does-not-exist")).status, 404);
    const removedPaymentRoute = await fetch(base + "/api/payments/razorpay/webhook", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal(removedPaymentRoute.status, 404);
    const invalid = await fetch(base + "/api/products?page=0");
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).message, "Invalid page.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("login service result becomes the same public response and signed cookie", async () => {
  const user = { ...account, passwordHash: await hashPassword("password123") };
  mock.method(User, "findOne", () => select(user));
  const res = response();
  await startLogin(
    { body: { email: user.email, password: "password123" } },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.user.id, id);
  assert.equal(res.body.authUser, undefined);
  assert.equal(res.body.data.user.passwordHash, undefined);
  assert.equal(res.cookies.length, 1);
  assert.equal(res.cookies[0].options.httpOnly, true);
  const token = getLoginData({
    cookies: { [AUTH_COOKIE_NAME]: res.cookies[0].value },
  });
  assert.equal(token.userId, id);
  assert.equal(token.authVersion, 2);
});

test("bad login credentials never issue a session cookie", async () => {
  mock.method(User, "findOne", () => select(null));
  const res = response();
  await startLogin(
    { body: { email: account.email, password: "incorrect" } },
    res,
  );
  assert.equal(res.statusCode, 401);
  assert.equal(res.cookies.length, 0);
});

test("blocked accounts retain their restriction code and never receive a login cookie", async () => {
  const user = {
    ...account,
    isBlocked: true,
    passwordHash: await hashPassword("password123"),
  };
  mock.method(User, "findOne", () => select(user));
  const res = response();
  await startLogin(
    { body: { email: user.email, password: "password123" } },
    res,
  );
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "ACCOUNT_BLOCKED");
  assert.equal(res.cookies.length, 0);
});

test("verified password change refreshes the cookie using the new session counter", async () => {
  const challengeId = "444444444444444444444444";
  const record = {
    id: challengeId,
    currentCodeHash: hashOtp(challengeId, "password-change:current", "123456"),
    pendingPasswordHash: "new-password-hash",
  };
  mock.method(ProfileVerification, "findOneAndUpdate", () => select(record));
  mock.method(User, "findOneAndUpdate", () =>
    select({
      ...account,
      authVersion: 3,
      passwordHash: record.pendingPasswordHash,
    }),
  );
  const res = response();
  await changePassword(
    { user: account, body: { challengeId, code: "123456" } },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.verified, true);
  const token = getLoginData({
    cookies: { [AUTH_COOKIE_NAME]: res.cookies[0].value },
  });
  assert.equal(token.authVersion, 3);
});

test("profile photo service preserves bytes and privacy headers", async () => {
  const photo = Buffer.from("test-photo-bytes");
  mock.method(User, "findById", () =>
    select({
      profileImage: "/profile/photo/12345678-1234-4234-8234-123456789abc",
      profilePhoto: photo,
    }),
  );
  const res = response();
  await getPhoto(
    {
      user: {
        ...account,
        profileImage: "/profile/photo/12345678-1234-4234-8234-123456789abc",
      },
      params: { version: "12345678-1234-4234-8234-123456789abc" },
    },
    res,
  );
  assert.deepEqual(res.body, photo);
  assert.equal(res.headers.type, "jpeg");
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
});

test("an outdated profile photo URL is rejected before reading stored bytes", async () => {
  const lookup = mock.method(User, "findById", () => {
    throw new Error("Should not query");
  });
  const res = response();
  await getPhoto(
    {
      user: { ...account, profileImage: "/profile/photo/new" },
      params: { version: "old" },
    },
    res,
  );
  assert.equal(res.statusCode, 404);
  assert.equal(lookup.mock.calls.length, 0);
});

test("admin customer photos preserve their version check and response type", async () => {
  const photo = Buffer.from("customer-photo");
  mock.method(User, "findOne", () =>
    select({
      profileImage: "/profile/photo/12345678-1234-4234-8234-123456789abc",
      profilePhoto: photo,
    }),
  );
  const res = response();
  await getCustomerPhoto(
    {
      params: { id },
      query: { version: "12345678-1234-4234-8234-123456789abc" },
    },
    res,
  );
  assert.deepEqual(res.body, photo);
  assert.equal(res.headers["Content-Type"], "image/jpeg");
});

test("address version conflicts reject without writing to the database", async () => {
  mock.method(User, "findById", () =>
    lean({ ...account, addressVersion: 2, addresses: [] }),
  );
  const save = mock.method(User, "findOneAndUpdate", () => {
    throw new Error("Should not write");
  });
  await assert.rejects(
    addAddress(
      {
        user: account,
        body: {
          version: 1,
          fullName: "Asha Devi",
          phoneNumber: "9876543210",
          addressLine1: "123 Main Street",
          city: "Ernakulam",
          state: "Kerala",
          postalCode: "682001",
        },
      },
      response(),
    ),
    { status: 409 },
  );
  assert.equal(save.mock.calls.length, 0);
});

test("first address becomes default and the save atomically checks version zero", async () => {
  mock.method(postalDirectory, "lookup", async () => ({ state: "Kerala", districts: ["Ernakulam"], states: ["Kerala"] }));
  const user = { ...account, addresses: [], defaultAddressId: null };
  mock.method(User, "findById", () => lean(user));
  let filter;
  mock.method(User, "findOneAndUpdate", (query, update) => {
    filter = query;
    assert.equal(update.$inc.addressVersion, 1);
    return lean({ ...user, ...update.$set, addressVersion: 1 });
  });
  const res = response();
  await addAddress(
    {
      user: account,
      body: {
        version: 0,
        isDefault: false,
        fullName: "Asha Devi",
        phoneNumber: "9876543210",
        addressLine1: "123 Main Street",
        city: "Ernakulam",
        state: "Kerala",
        postalCode: "682001",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.addresses[0].isDefault, true);
  assert.equal(res.body.data.addresses[0].country, "IN");
  assert.deepEqual(filter.$and, [
    { $or: [{ addressVersion: 0 }, { addressVersion: { $exists: false } }] },
  ]);
});

test("removing the default address chooses a remaining address as default", async () => {
  const user = {
    ...account,
    addressVersion: 3,
    defaultAddressId: firstId,
    addresses: [{ _id: firstId }, { _id: secondId }],
  };
  mock.method(User, "findById", () => lean(user));
  mock.method(User, "findOneAndUpdate", (_filter, update) =>
    lean({ ...user, ...update.$set, addressVersion: 4 }),
  );
  const res = response();
  await deleteAddress(
    { user: account, params: { id: firstId }, body: { version: 3 } },
    res,
  );
  assert.equal(res.body.data.addresses.length, 1);
  assert.equal(res.body.data.addresses[0].id, secondId);
  assert.equal(res.body.data.addresses[0].isDefault, true);
});

test("editing another address ID is rejected without saving", async () => {
  mock.method(User, "findById", () =>
    lean({ ...account, addressVersion: 0, addresses: [{ _id: firstId }] }),
  );
  const save = mock.method(User, "findOneAndUpdate", () => {
    throw new Error("Should not write");
  });
  await assert.rejects(
    editAddress(
      {
        user: account,
        params: { id: secondId },
        body: {
          version: 0,
          fullName: "Asha Devi",
          phoneNumber: "9876543210",
          addressLine1: "123 Main Street",
          city: "Ernakulam",
          state: "Kerala",
          postalCode: "682001",
        },
      },
      response(),
    ),
    { status: 404 },
  );
  assert.equal(save.mock.calls.length, 0);
});
