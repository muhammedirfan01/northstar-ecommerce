import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import createApp from "../src/app.js";
import User from "../src/models/User.js";
import { createLoginToken } from "../src/utils/jwt.js";
import { AUTH_COOKIE_NAME } from "../src/config/jwt.js";

afterEach(() => mock.restoreAll());

test("retired endpoints return 404 while current-user access and admin protection remain", async () => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "route-cleanup-test-only-secret-at-least-32-characters";
  const user = { id: "111111111111111111111111", name: "Test User",
    email: "user@example.test", role: "customer", isEmailVerified: true, authVersion: 0 };
  mock.method(User, "findById", () => ({ select: async () => user }));
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(method, url, authenticated = true) {
    return fetch(base + url, { method, headers: authenticated
      ? { Cookie: `${AUTH_COOKIE_NAME}=${createLoginToken(user)}` } : {} });
  }
  try {
    for (const [method, url] of [["GET", "/profile"], ["POST", "/cart/checkout"]])
      assert.equal((await call(method, url)).status, 404, url);
    const me = await call("GET", "/auth/me");
    assert.equal(me.status, 200);
    assert.equal((await me.json()).data.user.email, user.email);
    assert.equal((await call("GET", "/admin/categories", false)).status, 401);
    assert.equal((await call("GET", "/admin/categories")).status, 403);
    user.role = "admin";
    for (const [method, url] of [["GET", "/admin/me"], ["PATCH", "/admin/inventory/111111111111111111111111"]])
      assert.equal((await call(method, url)).status, 404, url);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});
