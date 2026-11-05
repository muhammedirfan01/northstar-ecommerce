import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import User from "../models/User.js";
import Product from "../models/Product.js";
import ShoppingList from "../models/ShoppingList.js";
import { addToCart } from "../services/cartService.js";
import { addAddress } from "../services/addressService.js";
import { getCustomer, setCustomerStatus } from "../services/adminService.js";
import { updateProfile } from "../services/profileService.js";
import createApp from "../app.js";

const id = "111111111111111111111111";
const user = { id, email: "asha@example.test", role: "customer" };
afterEach(() => mock.restoreAll());

test("cart service validates raw requests before loading records", async () => {
  const product = mock.method(Product, "findById", () => { throw new Error("Must not query"); });
  const list = mock.method(ShoppingList, "findOne", () => { throw new Error("Must not query"); });
  await assert.rejects(addToCart({ user, body: { productId: "bad-id", quantity: 1 } }), { status: 400 });
  await assert.rejects(addToCart({ user, body: { productId: id, quantity: 6 }, data: { productId: id, quantity: 1 } }), { status: 400 });
  assert.equal(product.mock.calls.length, 0);
  assert.equal(list.mock.calls.length, 0);
});

test("profile validation runs before any account update", async () => {
  const save = mock.method(User, "findOneAndUpdate", () => { throw new Error("Must not save"); });
  await assert.rejects(updateProfile({ user, body: { name: "123", phone: "" } }), { status: 400 });
  assert.equal(save.mock.calls.length, 0);
});

test("address errors retain the frontend field-error response data", async () => {
  const find = mock.method(User, "findById", () => { throw new Error("Must not query"); });
  await assert.rejects(addAddress({ user, body: {
    fullName: "Asha Devi", phoneNumber: "9876543210", addressLine1: "123 Main Street",
    city: "Kochi", state: "Kerala", postalCode: "bad", version: 0,
  } }), error => error.status === 400 && error.code === "VALIDATION_ERROR" && error.data.fieldErrors.postalCode[0] === "Invalid postalCode.");
  assert.equal(find.mock.calls.length, 0);
});

test("customer IDs and status values are validated inside the service", async () => {
  const find = mock.method(User, "findOne", () => { throw new Error("Must not query"); });
  await assert.rejects(getCustomer({ params: { id: "bad" } }), { status: 400, code: "VALIDATION_ERROR" });
  await assert.rejects(setCustomerStatus({ user, params: { id }, body: { isBlocked: "true" } }), { status: 400, code: "VALIDATION_ERROR" });
  assert.equal(find.mock.calls.length, 0);
});

test("shorter routes still protect account, admin, cart and address endpoints", async () => {
  process.env.JWT_SECRET = "service-boundary-test-secret-at-least-32-characters";
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ["/api/profile", "/api/admin/customers", "/api/cart", "/api/addresses"]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 401, route);
    }
    const response = await fetch(base + "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad-email", password: "Password123" }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, "Enter a valid email address.");
  } finally { await new Promise(resolve => server.close(resolve)); }
});
