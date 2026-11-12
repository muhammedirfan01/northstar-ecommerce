import test from "node:test";
import assert from "node:assert/strict";
import { validateOfferForm } from "../src/services/campaignService.js";
import { findBestOffer } from "../src/services/catalogService.js";
import { validateReportFilters } from "../src/services/salesReportService.js";

test("campaigns validate dates, targets and whole paise/percent values", () => {
  const form = {
    name: "Test campaign",
    description: "",
    scope: "all",
    targetId: null,
    discountType: "percentage",
    discountValue: 10,
    isActive: true,
    startDate: "2026-01-01T00:00:00Z",
    expiryDate: "2027-01-01T00:00:00Z",
  };
  assert.equal(validateOfferForm(form).name, form.name);
  for (const extra of [
    { discountValue: 101 },
    { scope: "product" },
    { expiryDate: form.startDate },
    { isActive: "true" },
    { discountType: "fixed", discountValue: 0.1 },
  ])
    assert.throws(
      () => validateOfferForm({ ...form, ...extra }),
      (e) => e.status === 400,
    );
});
test("best offer honors parent category, variants' price, per-unit cap, dates and deterministic ties", () => {
  const product = {
      _id: "product",
      category: { _id: "child", parent: { _id: "parent" } },
    },
    now = new Date("2026-11-10");
  const offer = {
    _id: "b",
    name: "Parent offer",
    scope: "category",
    targetId: "parent",
    isActive: true,
    startDate: "2026-01-01",
    expiryDate: "2027-01-01",
    discountType: "percentage",
    discountValue: 10,
  };
  assert.equal(findBestOffer(product, 1000, 2, [offer], now).discount, 200);
  assert.equal(
    findBestOffer(
      product,
      1000,
      2,
      [{ ...offer, discountType: "fixed", discountValue: 2000 }],
      now,
    ).discount,
    2000,
  );
  assert.equal(
    findBestOffer(product, 1000, 1, [offer, { ...offer, _id: "a" }], now)
      .campaignId,
    "a",
  );
  for (const change of [
    { isActive: false },
    { expiryDate: "2026-11-10" },
    { startDate: "2026-11-11" },
    { targetId: "unrelated" },
  ])
    assert.equal(
      findBestOffer(product, 1000, 1, [{ ...offer, ...change }], now),
      null,
    );
});
test("sales dates use inclusive India boundaries, leap validation and bounded ranges", () => {
  const q = validateReportFilters({
    query: { from: "2026-11-10", to: "2026-11-10", sort: "total-desc" },
  });
  assert.equal(
    q.filter.createdAt.$gte.toISOString(),
    "2026-11-09T18:30:00.000Z",
  );
  assert.equal(
    q.filter.createdAt.$lt.toISOString(),
    "2026-11-10T18:30:00.000Z",
  );
  assert.deepEqual(q.sort, { totalAmount: -1, _id: -1 });
  for (const query of [
    { from: "2026-02-29" },
    { from: "2024-01-01", to: "2026-01-01" },
    { from: "2026-11-12", to: "2026-11-10" },
    { group: "invalid" },
    { unknown: 1 },
  ])
    assert.throws(
      () => validateReportFilters({ query }),
      (e) => e.status === 400,
    );
});
