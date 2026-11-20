import test from "node:test";
import assert from "node:assert/strict";
import errorHandler from "../src/middlewares/errorHandler.js";
import { createError } from "../src/utils/httpError.js";

function response() {
  return { headers: {}, set(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; } };
}

test("unexpected server failures hide internal messages from customers", (t) => {
  t.mock.method(console, "error", () => {});
  const res = response();
  errorHandler(Error("Database password and internal path"), {}, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { success: false, message: "Something went wrong" });
});

for (const [name, error, status] of [
  ["duplicate key", { code: 11000 }, 409],
  ["stale document", { name: "VersionError" }, 409],
  ["schema validation", { name: "ValidationError" }, 400],
  ["malformed database ID", { name: "CastError" }, 400],
]) {
  test(`error handler translates ${name} into the expected customer response`, (t) => {
    t.mock.method(console, "error", () => {});
    const res = response();
    errorHandler(error, {}, res, () => {});
    assert.equal(res.statusCode, status);
    assert.equal(res.body.success, false);
    assert.ok(res.body.message.length > 0);
  });
}

test("cooldown validation returns its retry header and field errors", (t) => {
  t.mock.method(console, "error", () => {});
  const res = response();
  const error = createError("Wait before retrying.", 429, { resendAfter: 30, fieldErrors: { code: ["Wait"] } });
  error.code = "VALIDATION_ERROR";
  errorHandler(error, {}, res, () => {});
  assert.equal(res.headers["Retry-After"], "30");
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, "VALIDATION_ERROR");
  assert.deepEqual(res.body.data.fieldErrors, { code: ["Wait"] });
});
