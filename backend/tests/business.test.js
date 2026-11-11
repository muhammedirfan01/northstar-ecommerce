import test from "node:test";
import assert from "node:assert/strict";
import { settingsForm, campaignForm } from "../utils/validators/business.js";
import { DEFAULT_SETTINGS } from "../models/StoreSettings.js";
import { bestOffer } from "../utils/offerPricing.js";
import { reportQuery } from "../services/salesReportService.js";
const settings = () => ({ ...DEFAULT_SETTINGS, version: 0 });
test("settings reject secrets, unsafe amounts and all payment methods disabled", () => {
  assert.deepEqual(settingsForm(settings()), DEFAULT_SETTINGS);
  for (const extra of [
    { RAZORPAY_KEY_SECRET: "fixture" },
    { shippingChargePaise: 1.5 },
    { taxBasisPoints: -1 },
    { codEnabled: false, onlineEnabled: false },
  ])
    assert.throws(
      () => settingsForm({ ...settings(), ...extra }),
      (e) => e.status === 400,
    );
  assert.equal(
    settingsForm({ ...settings(), freeShippingAbovePaise: null })
      .freeShippingAbovePaise,
    null,
  );
});
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
  assert.equal(campaignForm(form).name, form.name);
  for (const extra of [
    { discountValue: 101 },
    { scope: "product" },
    { expiryDate: form.startDate },
    { isActive: "true" },
    { discountType: "fixed", discountValue: 0.1 },
  ])
    assert.throws(
      () => campaignForm({ ...form, ...extra }),
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
  assert.equal(bestOffer(product, 1000, 2, [offer], now).discount, 200);
  assert.equal(
    bestOffer(
      product,
      1000,
      2,
      [{ ...offer, discountType: "fixed", discountValue: 2000 }],
      now,
    ).discount,
    2000,
  );
  assert.equal(
    bestOffer(product, 1000, 1, [offer, { ...offer, _id: "a" }], now)
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
      bestOffer(product, 1000, 1, [{ ...offer, ...change }], now),
      null,
    );
});
test("sales dates use inclusive India boundaries, leap validation and bounded ranges", () => {
  const q = reportQuery({
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
      () => reportQuery({ query }),
      (e) => e.status === 400,
    );
});
