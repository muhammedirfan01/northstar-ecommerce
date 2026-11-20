import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import ProfileVerification from "../src/models/ProfileVerification.js";
import { hashOtp } from "../src/utils/otp.js";
import { requestEmailChange, verifyEmailChange, changePassword } from "../src/services/profileSecurityService.js";
import { ids, account, queryResult, testEnvironment } from "./scenarioHelpers.js";

function challenge() {
  return { id: ids.challenge, currentEmail: "customer@example.test", newEmail: "new@example.test",
    currentCodeHash: hashOtp(ids.challenge, "email-change:current", "123456"),
    newCodeHash: hashOtp(ids.challenge, "email-change:new", "654321") };
}
const codes = () => ({ challengeId: ids.challenge, currentCode: "123456", newCode: "654321" });

test("email change requires both current-address and new-address codes", async (t) => {
  testEnvironment(t, { OTP_SECRET: "ab".repeat(32) });
  const verification = t.mock.method(ProfileVerification, "findOneAndUpdate", () => queryResult(challenge()));
  const update = t.mock.method(User, "findOneAndUpdate", () => { throw Error("Unexpected account update"); });
  const result = await verifyEmailChange({ user: account(), body: { ...codes(), newCode: "111111" } });
  assert.equal(result.status, 400);
  assert.equal(verification.mock.callCount(), 1);
  assert.equal(update.mock.callCount(), 0);
  const filter = verification.mock.calls[0].arguments[0];
  assert.equal(filter.userId, ids.user);
  assert.equal(filter.authVersion, 2);
  assert.ok(filter.expiresAt.$gt instanceof Date);
});

test("verified email change consumes codes, updates the email and refreshes the session version", async (t) => {
  testEnvironment(t, { OTP_SECRET: "ab".repeat(32) });
  const verification = t.mock.method(ProfileVerification, "findOneAndUpdate", () => queryResult(challenge()));
  const update = t.mock.method(User, "findOneAndUpdate", () => queryResult(account({ email: "new@example.test", authVersion: 3 })));
  const result = await verifyEmailChange({ user: account(), body: codes() });
  assert.equal(result.status, 200);
  assert.equal(result.authUser.authVersion, 3);
  assert.equal(result.body.data.user.email, "new@example.test");
  assert.ok(verification.mock.calls[1].arguments[1].$set.usedAt instanceof Date);
  assert.equal(update.mock.calls[0].arguments[0].email, "customer@example.test");
  assert.deepEqual(update.mock.calls[0].arguments[1].$inc, { authVersion: 1 });
});

test("expired password-change codes cannot write the pending password", async (t) => {
  t.mock.method(ProfileVerification, "findOneAndUpdate", () => queryResult(null));
  const update = t.mock.method(User, "findOneAndUpdate", () => { throw Error("Unexpected write"); });
  const result = await changePassword({ user: account(), body: { challengeId: ids.challenge, code: "123456" } });
  assert.equal(result.status, 400);
  assert.equal(update.mock.callCount(), 0);
});

test("email change rejects an unchanged address or an address already owned by another account", async (t) => {
  const exists = t.mock.method(User, "exists", async () => ({ _id: ids.product }));
  const save = t.mock.method(ProfileVerification.prototype, "save", () => { throw Error("Unexpected challenge"); });
  assert.equal((await requestEmailChange({ user: account(), body: { newEmail: account().email } })).status, 400);
  assert.equal(exists.mock.callCount(), 0);
  assert.equal((await requestEmailChange({ user: account(), body: { newEmail: "taken@example.test" } })).status, 409);
  assert.equal(save.mock.callCount(), 0);
});
