import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import User from "../models/User.js";
import RegistrationOtp from "../models/RegistrationOtp.js";
import mailer from "../config/mailer.js";
import { registerAccount } from "../services/registrationService.js";
import { verifyRegistration, resendRegistrationOtp } from "../services/registrationOtpService.js";
import { hashOtp } from "../utils/otp.js";
import validateProfile from "../middlewares/validateProfile.js";
import validateRegistration from "../middlewares/validateRegistration.js";
import { publicUser, requirePasswordAccount } from "../middlewares/auth.js";
import { otpTiming } from "../../northstar/src/utils/otpTiming.js";
import { nameError } from "../../northstar/src/utils/nameValidation.js";

process.env.OTP_SECRET = "ab".repeat(32);
const challengeId = "0123456789abcdef01234567";
const select = value => ({ select: async () => value });
afterEach(() => mock.restoreAll());

test("registration returns a usable expiry without disclosing an existing email", async () => {
  mock.method(User, "exists", async () => true);
  const result = await registerAccount({ email: "existing@example.com" });
  assert.match(result.challengeId, /^[a-f0-9]{24}$/);
  assert.equal(result.expiresIn, 300);
  assert.ok(otpTiming(result).expiresAt > Date.now());
});

test("new registration stores a hash, emails a code and returns its actual expiry", async () => {
  mock.method(User, "exists", async () => false);
  mock.method(RegistrationOtp, "deleteOne", async () => ({}));
  let saved;
  mock.method(RegistrationOtp.prototype, "save", async function () { saved = this; return this; });
  const send = mock.method(mailer, "sendMail", async () => ({}));
  const result = await registerAccount({ name: "Asha Devi", email: "asha@example.com", password: "Password8" });
  assert.notEqual(saved.pendingRegistration.passwordHash, "Password8");
  assert.equal(result.expiresAt, saved.expiresAt);
  assert.match(send.mock.calls[0].arguments[0].text, /\d{6}/);
});

test("failed registration delivery removes the challenge and reports 503", async () => {
  mock.method(User, "exists", async () => false);
  const remove = mock.method(RegistrationOtp, "deleteOne", async () => ({}));
  mock.method(RegistrationOtp.prototype, "save", async function () { return this; });
  mock.method(mailer, "sendMail", async () => { throw new Error("Delivery failed"); });
  mock.method(console, "error", () => {});
  await assert.rejects(registerAccount({ name: "Asha Devi", email: "asha@example.com", password: "Password8" }), { status: 503 });
  assert.equal(remove.mock.calls.length, 2);
});

test("wrong and expired OTPs cannot create accounts", async () => {
  const create = mock.method(User, "create", async () => { throw new Error("Must not create a user"); });
  const find = mock.method(RegistrationOtp, "findOneAndUpdate", () => select(null));
  await assert.rejects(verifyRegistration({ challengeId, code: "123456" }), { status: 400 });
  find.mock.mockImplementation(() => select({ id: challengeId, otpHash: hashOtp(challengeId, "registration", "654321") }));
  await assert.rejects(verifyRegistration({ challengeId, code: "123456" }), { status: 400 });
  assert.equal(create.mock.calls.length, 0);
});

test("a valid OTP consumes the challenge before creating the verified user", async () => {
  const record = { id: challengeId, email: "asha@example.com", otpHash: hashOtp(challengeId, "registration", "012345"), pendingRegistration: { name: "Asha Devi", passwordHash: "hash" } };
  const find = mock.method(RegistrationOtp, "findOneAndUpdate", () => select(record));
  mock.method(User, "create", async details => ({ id: "user-id", ...details }));
  const result = await verifyRegistration({ challengeId, code: "012345" });
  assert.equal(result.verified, true);
  assert.equal(result.user.name, "Asha Devi");
  assert.ok(find.mock.calls[1].arguments[1].$set.usedAt instanceof Date);
  assert.equal(result.user.passwordHash, undefined);
});

test("resend enforces cooldown and provides a fresh expiry", async () => {
  const record = { id: challengeId, email: "asha@example.com", otpHash: "old-hash", resendCount: 0, resendAvailableAt: new Date(Date.now() + 60000) };
  mock.method(RegistrationOtp, "findOne", () => select(record));
  await assert.rejects(resendRegistrationOtp({ challengeId }), error => error.status === 429 && error.data.resendAfter > 0);
  record.resendAvailableAt = new Date(Date.now() - 1000);
  mock.method(RegistrationOtp, "findOneAndUpdate", async (_filter, update) => ({ ...record, ...update.$set }));
  mock.method(mailer, "sendMail", async () => ({}));
  const result = await resendRegistrationOtp({ challengeId });
  assert.ok(Date.parse(result.expiresAt) > Date.now());
  assert.equal(result.resendAfter, 60);
});

test("OTP timing supports both backend response formats and preserves expiry", () => {
  assert.ok(otpTiming({ expiresIn: 300, resendAfter: 60 }).expiresAt > Date.now());
  const expired = new Date(Date.now() - 1000).toISOString();
  assert.equal(otpTiming({ expiresAt: expired, expiresIn: 300, resendAfter: 60 }).expiresAt, Date.parse(expired));
});

function validate(middleware, body) {
  let passed = false;
  const res = { status() { return this; }, json() { return this; } };
  middleware({ body }, res, () => { passed = true; });
  return passed;
}

test("profile and signup reject invalid names and accept international names", () => {
  for (const name of ["  ", "12345", "A1", "---", "A", "<script>"]) {
    assert.ok(nameError(name));
    assert.equal(validate(validateProfile("details"), { name, phone: "" }), false);
    assert.equal(validate(validateRegistration, { name, email: "asha@example.com", password: "Password8", acceptedTerms: true }), false);
  }
  for (const name of ["Asha Devi", "O'Connor", "Anne-Marie", "José", "محمد", "李明"]) {
    assert.equal(nameError(name), "");
    assert.equal(validate(validateProfile("details"), { name, phone: "" }), true);
  }
});

test("Google account flag is public while the Google id stays private", () => {
  const result = publicUser({ googleId: "private-google-id" });
  assert.equal(result.isGoogleAccount, true);
  assert.equal(result.googleId, undefined);
  assert.equal(publicUser({ passwordHash: "hash" }).isGoogleAccount, false);
});

test("Google account guard rejects security edits even when a password exists", () => {
  let status;
  let next = false;
  const res = { status(value) { status = value; return this; }, json() { return this; } };
  requirePasswordAccount({ user: { googleId: "google-id", passwordHash: "hash" } }, res, () => { next = true; });
  assert.equal(status, 403);
  assert.equal(next, false);
  requirePasswordAccount({ user: { passwordHash: "hash" } }, res, () => { next = true; });
  assert.equal(next, true);
});
