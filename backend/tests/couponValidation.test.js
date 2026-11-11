import test from "node:test";
import assert from "node:assert/strict";
import { couponForm, couponQuery } from "../utils/validators/coupon.js";
import { couponStatus, couponFilter } from "../services/adminCouponService.js";
const form = () => ({
  code: " northstar10 ",
  discountType: "percentage",
  discountValue: 10,
  minPurchasePaise: 10000,
  maxDiscountPaise: 5000,
  usageLimit: 20,
  startDate: "2026-01-01T00:00:00Z",
  expiryDate: "2027-01-01T00:00:00Z",
  isActive: true,
});
test("coupon forms preserve existing percentage/paise semantics and normalize only the code", () => {
  const value = couponForm(form());
  assert.equal(value.code, "NORTHSTAR10");
  assert.equal(value.discountValue, 10);
  assert.equal(value.minPurchasePaise, 10000);
  assert.equal(value.maxDiscountPaise, 5000);
  assert.equal(
    couponForm({ ...form(), discountType: "fixed", discountValue: 5000 })
      .discountValue,
    5000,
  );
});
test("coupon forms reject forged usage, unsafe money, invalid percentages, limits and date ranges", () => {
  for (const changes of [
    { usedCount: 10 },
    { discountValue: 101 },
    { discountValue: 1.2 },
    { discountValue: 0 },
    { minPurchasePaise: -1 },
    { maxDiscountPaise: 0 },
    { usageLimit: 0 },
    { usageLimit: 1.5 },
    { expiryDate: "invalid" },
    { expiryDate: "2025-01-01" },
    { code: "BAD CODE" },
  ])
    assert.throws(
      () => couponForm({ ...form(), ...changes }),
      (error) => error.status === 400,
    );
  assert.throws(() => couponForm({ ...form(), version: -1 }, true));
});
test("coupon queries escape code searches and reject unsupported filters/sorts", () => {
  const query = couponQuery({
    search: "CODE.*",
    status: "active",
    sort: "code",
    page: "2",
    limit: "5",
  });
  assert.equal(query.page, 2);
  assert.equal(couponFilter(query).code.$regex, "CODE\\.\\*");
  for (const value of [
    { sort: "price" },
    { status: "hidden" },
    { page: "0" },
    { limit: "51" },
    { usedCount: "9" },
  ])
    assert.throws(
      () => couponQuery(value),
      (error) => error.status === 400,
    );
});
test("coupon status respects deletion, enable setting, dates and recorded quota", () => {
  const now = new Date("2026-06-01T00:00:00Z"),
    base = { ...form(), usedCount: 1 };
  assert.equal(couponStatus(base, now), "active");
  assert.equal(couponStatus({ ...base, deletedAt: now }, now), "deleted");
  assert.equal(couponStatus({ ...base, isActive: false }, now), "inactive");
  assert.equal(
    couponStatus({ ...base, expiryDate: "2026-05-01" }, now),
    "expired",
  );
  assert.equal(couponStatus({ ...base, usageLimit: 1 }, now), "exhausted");
  assert.equal(
    couponStatus({ ...base, startDate: "2026-07-01" }, now),
    "scheduled",
  );
});
