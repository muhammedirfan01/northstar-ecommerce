import test from "node:test";
import assert from "node:assert/strict";
import Coupon from "../src/models/Coupon.js";
import { editCoupon, setCouponStatus, deleteCoupon, restoreCoupon } from "../src/services/adminCouponService.js";
import { ids, queryResult } from "./scenarioHelpers.js";

const form = () => ({ code: "SAVE10", discountType: "percentage", discountValue: 10,
  minPurchasePaise: 0, maxDiscountPaise: null, usageLimit: 10,
  startDate: "2026-01-01T00:00:00Z", expiryDate: "2027-01-01T00:00:00Z", isActive: true, version: 2 });
const coupon = () => ({ _id: ids.product, ...form(), usedCount: 4, __v: 2 });

for (const [name, changes] of [["renamed used code", { code: "OTHER" }], ["usage limit below existing uses", { usageLimit: 3 }]]) {
  test(`coupon edit rejects ${name}`, async (t) => {
    t.mock.method(Coupon, "findById", () => queryResult(coupon()));
    const write = t.mock.method(Coupon, "findOneAndUpdate", () => { throw Error("Unexpected coupon write"); });
    await assert.rejects(editCoupon({ params: { id: ids.product }, body: { ...form(), ...changes } }), { status: 409 });
    assert.equal(write.mock.callCount(), 0);
  });
}

test("coupon enable checks saved usage and version atomically and rejects a stale edit", async (t) => {
  t.mock.method(Coupon, "findById", () => queryResult(coupon()));
  const write = t.mock.method(Coupon, "findOneAndUpdate", () => queryResult(null));
  await assert.rejects(setCouponStatus({ params: { id: ids.product }, body: { version: 2, isActive: false } }), { status: 409 });
  assert.equal(write.mock.calls[0].arguments[0].usedCount, 4);
  assert.equal(write.mock.calls[0].arguments[0].__v, 2);
});

test("coupon deletion requires confirmation before any database read", async (t) => {
  const read = t.mock.method(Coupon, "findById", () => { throw Error("Unexpected read"); });
  await assert.rejects(deleteCoupon({ params: { id: ids.product }, body: { version: 2, confirmDelete: false } }), { status: 400 });
  assert.equal(read.mock.callCount(), 0);
});

test("restoring a coupon clears deletion without resetting recorded usage", async (t) => {
  t.mock.method(Coupon, "findById", () => queryResult(coupon()));
  const write = t.mock.method(Coupon, "findOneAndUpdate", () => queryResult(coupon()));
  assert.equal((await restoreCoupon({ params: { id: ids.product }, body: { version: 2 } })).status, 200);
  assert.deepEqual(write.mock.calls[0].arguments[1].$set, { deletedAt: null });
});
