import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import createApp from "../src/app.js";
import { createLoginToken } from "../src/utils/jwt.js";
import { AUTH_COOKIE_NAME } from "../src/config/jwt.js";
import { formatUser } from "../src/utils/user.js";
import { getCustomer } from "../src/controllers/adminController.js";

const id = "111111111111111111111111";
const user = {
  id,
  _id: id,
  name: "Asha Devi",
  email: "asha@example.test",
  role: "customer",
  isEmailVerified: true,
  authVersion: 0,
  profileImage: "/profile/photo/photo-version",
  addresses: [],
};
afterEach(() => mock.restoreAll());

test("current-user response provides a complete photo URL without changing stored data", async () => {
  process.env.JWT_SECRET = "photo-url-test-only-secret-at-least-32-characters";
  mock.method(User, "findById", () => ({ select: async () => user }));
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(origin + "/api/auth/me", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${createLoginToken(user)}` },
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).data.user.profileImage,
      origin + "/api/profile/photo/photo-version",
    );
    assert.equal(user.profileImage, "/profile/photo/photo-version");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("existing Cloudinary profile URLs are returned unchanged", () => {
  const source = "https://res.cloudinary.com/example/image/upload/avatar.png";
  assert.equal(
    formatUser(
      { ...user, profileImage: source },
      "https://api.example.test/api",
    ).profileImage,
    source,
  );
});

test("admin customer responses provide a complete customer-photo URL", async () => {
  mock.method(User, "findOne", () => ({ select: async () => user }));
  let body;
  await getCustomer(
    {
      params: { id },
      headers: { host: "api.example.test" },
      protocol: "https",
    },
    {
      status() {
        return this;
      },
      json(value) {
        body = value;
        return this;
      },
    },
  );
  assert.equal(
    body.data.customer.profileImage,
    `https://api.example.test/api/admin/customers/${id}/photo?version=photo-version`,
  );
});

test("public user photo URLs support API origins without mutating records", () => {
  assert.equal(formatUser(user).profileImage, user.profileImage);
  assert.equal(formatUser(user, "https://api.example.test/api").profileImage,
    "https://api.example.test/api/profile/photo/photo-version");
  assert.equal(formatUser({ ...user, profileImage: "" }, "https://api.example.test/api").profileImage, "");
  assert.equal(user.profileImage, "/profile/photo/photo-version");
});
