import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import User from "../models/User.js";
import { createToken } from "../utils/jwt.js";
import { requireAuth } from "../middlewares/auth.js";

process.env.JWT_SECRET = "session-test-only-secret-with-at-least-32-characters";
afterEach(() => mock.restoreAll());
const account = {
  id: "111111111111111111111111",
  role: "customer",
  isEmailVerified: true,
  isBlocked: false,
  deletedAt: null,
  authVersion: 3,
};

async function authenticate(tokenAccount, currentAccount) {
  mock.method(User, "findById", () => ({ select: async () => currentAccount }));
  let status,
    continued = false;
  const req = { cookies: { "northstar.token": createToken(tokenAccount) } };
  const res = {
    clearCookie() {},
    status(value) {
      status = value;
      return this;
    },
    json() {
      return this;
    },
  };
  await requireAuth(req, res, () => {
    continued = true;
  });
  return { status, continued };
}

test("old sessions stop working after the account's session counter changes", async () => {
  const result = await authenticate({ ...account, authVersion: 2 }, account);
  assert.equal(result.status, 401);
  assert.equal(result.continued, false);
});

test("a fresh session works and blocked accounts still receive the restriction response", async () => {
  let result = await authenticate(account, account);
  assert.equal(result.continued, true);
  mock.restoreAll();
  result = await authenticate(account, { ...account, isBlocked: true });
  assert.equal(result.status, 403);
  assert.equal(result.continued, false);
});
