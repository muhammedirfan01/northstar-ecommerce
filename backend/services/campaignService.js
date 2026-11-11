import Campaign from "../models/Campaign.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import {
  campaignForm,
  campaignQuery,
  version,
} from "../utils/validators/business.js";
import { orderId } from "../utils/validators/order.js";
import { checkFields } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";
const success = (data, status = 200) => ({
  status,
  body: { success: true, data },
});
const pattern = (text) => ({
  $regex: text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  $options: "i",
});
export function campaignStatus(o, now = new Date()) {
  return !o.isActive
    ? "inactive"
    : +new Date(o.expiryDate) <= +now
      ? "expired"
      : +new Date(o.startDate) > +now
        ? "scheduled"
        : "active";
}
async function data(o) {
  const {
    _id,
    name,
    description,
    scope,
    targetId,
    discountType,
    discountValue,
    startDate,
    expiryDate,
    isActive,
    __v,
  } = o;
  const target =
    scope === "all"
      ? null
      : await (scope === "product" ? Product : Category)
          .findById(targetId)
          .select("name deletedAt")
          .lean();
  return {
    id: String(_id),
    name,
    description,
    scope,
    targetId: targetId ? String(targetId) : null,
    targetName: target && !target.deletedAt ? target.name : "",
    discountType,
    discountValue,
    startDate,
    expiryDate,
    isActive,
    version: __v ?? 0,
    status: campaignStatus(o),
  };
}
export async function listOffers(input) {
  const q = campaignQuery(input.query),
    now = new Date(),
    filter = {};
  if (q.search) filter.name = pattern(q.search);
  if (q.status === "inactive") filter.isActive = false;
  if (["active", "scheduled", "expired"].includes(q.status))
    filter.isActive = true;
  if (q.status === "expired") filter.expiryDate = { $lte: now };
  if (["active", "scheduled"].includes(q.status))
    filter.expiryDate = { $gt: now };
  if (q.status === "active") filter.startDate = { $lte: now };
  if (q.status === "scheduled") filter.startDate = { $gt: now };
  const total = await Campaign.countDocuments(filter),
    totalPages = Math.max(1, Math.ceil(total / q.limit)),
    page = Math.min(q.page, totalPages);
  const records = await Campaign.find(filter)
    .sort(
      {
        newest: { createdAt: -1, _id: -1 },
        name: { name: 1, _id: 1 },
        expiry: { expiryDate: 1, _id: 1 },
      }[q.sort],
    )
    .skip((page - 1) * q.limit)
    .limit(q.limit)
    .lean();
  return success({
    offers: await Promise.all(records.map(data)),
    summary: {
      total: await Campaign.countDocuments({}),
      active: await Campaign.countDocuments({
        isActive: true, startDate: { $lte: now }, expiryDate: { $gt: now },
      }),
      inactive: await Campaign.countDocuments({ isActive: false }),
    },
    pagination: { page, limit: q.limit, total, totalPages },
  });
}
export async function listTargets(input) {
  checkFields(input.query, ["scope", "search"]);
  const { scope, search = "" } = input.query;
  if (
    !["all", "product", "category"].includes(scope) ||
    typeof search !== "string" ||
    search.length > 100
  )
    throw httpError("Invalid target search.");
  if (scope === "all") return success({ targets: [] });
  const targets = await (scope === "product" ? Product : Category)
    .find({
      deletedAt: null,
      ...(search.trim() ? { name: pattern(search.trim()) } : {}),
    })
    .select("name")
    .sort({ name: 1, _id: 1 })
    .limit(50)
    .lean();
  return success({
    targets: targets.map((o) => ({ id: String(o._id), name: o.name })),
  });
}
async function validateTarget(o) {
  if (
    o.scope !== "all" &&
    !(await (o.scope === "product" ? Product : Category).exists({
      _id: o.targetId,
      deletedAt: null,
    }))
  )
    throw httpError(
      "Target is unavailable. Select an existing product or category.",
    );
}
export async function createOffer(input) {
  const form = campaignForm(input.body);
  await validateTarget(form);
  const o = await Campaign.create({
    ...form,
    updatedBy: input.user.id || input.user._id,
  });
  return success({ offer: await data(o) }, 201);
}
export async function editOffer(input) {
  const form = campaignForm(input.body, true);
  await validateTarget(form);
  const o = await Campaign.findOneAndUpdate(
    { _id: orderId(input.params), __v: input.body.version },
    {
      $set: { ...form, updatedBy: input.user.id || input.user._id },
      $inc: { __v: 1 },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!o)
    throw httpError(
      "Campaign changed or is unavailable. Refresh and try again.",
      409,
    );
  return success({ offer: await data(o) });
}
export async function setOfferStatus(input) {
  checkFields(input.body, ["version", "isActive"]);
  version(input.body.version);
  if (typeof input.body.isActive !== "boolean")
    throw httpError("Invalid campaign status.");
  const o = await Campaign.findOneAndUpdate(
    { _id: orderId(input.params), __v: input.body.version },
    {
      $set: {
        isActive: input.body.isActive,
        updatedBy: input.user.id || input.user._id,
      },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" },
  );
  if (!o)
    throw httpError(
      "Campaign changed or is unavailable. Refresh and try again.",
      409,
    );
  return success({ offer: await data(o) });
}
export async function activeOffers(session = null) {
  const now = new Date();
  return Campaign.find({
    isActive: true,
    startDate: { $lte: now },
    expiryDate: { $gt: now },
  })
    .sort({ _id: 1 })
    .session(session)
    .lean();
}
