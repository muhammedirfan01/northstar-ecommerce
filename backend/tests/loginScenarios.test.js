import test from "node:test";
import assert from "node:assert/strict";
import { OAuth2Client } from "google-auth-library";
import User from "../src/models/User.js";
import { startLogin } from "../src/services/loginService.js";
import { googleSignIn } from "../src/services/googleSignInService.js";
import { hashPassword } from "../src/utils/password.js";
import { ids, account, queryResult, testEnvironment } from "./scenarioHelpers.js";

test("correct password on an unverified account cannot start a session", async (t) => {
  const passwordHash = await hashPassword("Password123");
  t.mock.method(User, "findOne", () => queryResult(account({ passwordHash, isEmailVerified: false })));
  const result = await startLogin({ body: { email: account().email, password: "Password123" } });
  assert.equal(result.status, 403);
  assert.equal(result.authUser, undefined);
});

test("Google profiles with an unverified email cannot read or create a local account", async (t) => {
  testEnvironment(t, { CLIENT_URL: "http://localhost:5173" });
  t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "fixture" } }));
  t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({ sub: "google-sub", email: account().email, email_verified: false }) }));
  const read = t.mock.method(User, "findOne", () => { throw Error("Unexpected account lookup"); });
  assert.equal((await googleSignIn({ body: { code: "fixture-code" } })).status, 401);
  assert.equal(read.mock.callCount(), 0);
});

test("Google sign-in cannot silently take over an existing password account", async (t) => {
  testEnvironment(t, { CLIENT_URL: "http://localhost:5173" });
  t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "fixture" } }));
  t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({ sub: "google-sub", email: account().email, email_verified: true }) }));
  t.mock.method(User, "findOne", (filter) => queryResult(filter.googleId ? null : account()));
  const create = t.mock.method(User, "create", () => { throw Error("Unexpected takeover"); });
  assert.equal((await googleSignIn({ body: { code: "fixture-code" } })).status, 409);
  assert.equal(create.mock.callCount(), 0);
});

test("new verified Google profile creates a customer without exposing its provider identifier", async (t) => {
  testEnvironment(t, { CLIENT_URL: "http://localhost:5173" });
  t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "fixture" } }));
  t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({ sub: "google-sub", email: "NEW@example.test", email_verified: true }) }));
  t.mock.method(User, "findOne", () => queryResult(null));
  const create = t.mock.method(User, "create", async (values) => account({ ...values, id: ids.user }));
  const result = await googleSignIn({ body: { code: "fixture-code" } });
  assert.equal(result.status, 200);
  assert.equal(create.mock.calls[0].arguments[0].role, "customer");
  assert.equal(result.body.data.user.email, "new@example.test");
  assert.equal(result.body.data.user.isGoogleAccount, true);
  assert.equal(Object.hasOwn(result.body.data.user, "googleId"), false);
});
