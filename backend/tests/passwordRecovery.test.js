import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import User from "../src/models/User.js";
import PasswordReset from "../src/models/PasswordReset.js";
import { hashOtp } from "../src/utils/otp.js";
import { verifyPassword } from "../src/utils/password.js";
import { requestPasswordReset, resendPasswordResetOtp, verifyPasswordResetOtp,
  resetPassword, validateNewPasswordForm } from "../src/services/passwordResetService.js";
import { ids, queryResult, testEnvironment } from "./scenarioHelpers.js";

const resetForm = () => ({ challengeId: ids.challenge, resetToken: "ab".repeat(32),
  password: "NewPassword123", confirmPassword: "NewPassword123" });

test("recovery rejects malformed tokens and mismatched passwords before reading accounts", async (t) => {
  const read = t.mock.method(PasswordReset, "findOne", () => { throw Error("Unexpected database read"); });
  for (const changes of [{ resetToken: "fake" }, { confirmPassword: "Different123" }, { password: "short" }]) {
    await assert.rejects(resetPassword({ body: { ...resetForm(), ...changes } }), { status: 400 });
  }
  assert.equal(read.mock.callCount(), 0);
  assert.equal(validateNewPasswordForm(resetForm()).password, "NewPassword123");
});

test("unknown email receives an opaque recovery challenge without sending email", async (t) => {
  testEnvironment(t, { OTP_SECRET: "ab".repeat(32) });
  t.mock.method(PasswordReset, "deleteOne", async () => ({}));
  t.mock.method(User, "findOne", () => queryResult(null));
  const save = t.mock.method(PasswordReset.prototype, "save", async function () { return this; });
  const result = await requestPasswordReset({ body: { email: "UNKNOWN@example.test" } });
  assert.equal(result.status, 202);
  assert.match(result.body.data.challengeId, /^[a-f0-9]{24}$/);
  assert.equal(result.body.data.expiresIn, 300);
  assert.equal(save.mock.calls[0].this.userId, undefined);
  assert.equal(Object.hasOwn(result.body.data, "otpHash"), false);
  assert.equal(Object.hasOwn(result.body.data, "userId"), false);
});

test("recovery resend respects cooldown and performs no write", async (t) => {
  t.mock.method(PasswordReset, "findOne", () => queryResult({ resendAvailableAt: new Date(Date.now() + 30000) }));
  const update = t.mock.method(PasswordReset, "findOneAndUpdate", () => { throw Error("Unexpected write"); });
  const result = await resendPasswordResetOtp({ body: { challengeId: ids.challenge } });
  assert.equal(result.status, 429);
  assert.ok(result.body.data.resendAfter > 0);
  assert.equal(update.mock.callCount(), 0);
});

test("wrong recovery code consumes an attempt without issuing a reset token", async (t) => {
  testEnvironment(t, { OTP_SECRET: "ab".repeat(32) });
  const update = t.mock.method(PasswordReset, "findOneAndUpdate", () => queryResult({
    userId: ids.user, otpHash: hashOtp(ids.challenge, "password-recovery", "654321"),
  }));
  const result = await verifyPasswordResetOtp({ body: { challengeId: ids.challenge, code: "123456" } });
  assert.equal(result.status, 400);
  assert.equal(result.body.data, undefined);
  assert.equal(update.mock.callCount(), 1);
  const [filter, changes] = update.mock.calls[0].arguments;
  assert.equal(filter.usedAt, null);
  assert.deepEqual(filter.attempts, { $lt: 5 });
  assert.ok(filter.expiresAt.$gt instanceof Date);
  assert.deepEqual(changes, { $inc: { attempts: 1 } });
});

test("valid recovery code returns a token whose hash alone is persisted", async (t) => {
  testEnvironment(t, { OTP_SECRET: "ab".repeat(32) });
  const challenge = { _id: ids.challenge, userId: ids.user, email: "customer@example.test", authVersion: 2,
    otpHash: hashOtp(ids.challenge, "password-recovery", "123456") };
  const update = t.mock.method(PasswordReset, "findOneAndUpdate", (filter, changes) =>
    queryResult(changes.$inc ? challenge : { resetExpiresAt: changes.$set.resetExpiresAt }));
  t.mock.method(User, "exists", async () => ({ _id: ids.user }));
  const result = await verifyPasswordResetOtp({ body: { challengeId: ids.challenge, code: "123456" } });
  assert.equal(result.status, 200);
  const token = result.body.data.resetToken;
  assert.match(token, /^[a-f0-9]{64}$/);
  const persisted = update.mock.calls[1].arguments[1].$set;
  assert.equal(persisted.resetTokenHash, createHash("sha256").update(token).digest("hex"));
  assert.notEqual(persisted.resetTokenHash, token);
  assert.equal(update.mock.calls[1].arguments[0].usedAt, null);
});

test("expired or already used recovery challenge cannot change a password", async (t) => {
  const read = t.mock.method(PasswordReset, "findOne", () => queryResult(null));
  const write = t.mock.method(User, "findOneAndUpdate", () => { throw Error("Unexpected password update"); });
  assert.equal((await resetPassword({ body: resetForm() })).status, 400);
  assert.equal(write.mock.callCount(), 0);
  const filter = read.mock.calls[0].arguments[0];
  assert.equal(filter.usedAt, null);
  assert.ok(filter.resetExpiresAt.$gt instanceof Date);
  assert.deepEqual(filter.verifiedAt, { $ne: null });
});

test("password reset hashes the password, invalidates old sessions and consumes its token", async (t) => {
  t.mock.method(PasswordReset, "findOne", () => queryResult({ _id: ids.challenge,
    userId: ids.user, email: "customer@example.test", authVersion: 2 }));
  const write = t.mock.method(User, "findOneAndUpdate", async () => ({ _id: ids.user }));
  const consume = t.mock.method(PasswordReset, "updateOne", async () => ({}));
  assert.equal((await resetPassword({ body: resetForm() })).status, 200);
  const [filter, update] = write.mock.calls[0].arguments;
  assert.equal(filter._id, ids.user);
  assert.equal(filter.authVersion, 2);
  assert.equal(filter.isBlocked, false);
  assert.deepEqual(update.$inc, { authVersion: 1 });
  assert.equal(await verifyPassword(update.$set.passwordHash, resetForm().password), true);
  assert.deepEqual(consume.mock.calls[0].arguments[1].$unset, { resetTokenHash: 1 });
});
