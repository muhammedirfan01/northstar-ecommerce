// Create offers and choose the products or categories they apply to.

import Campaign from "../models/Campaign.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { validateOrderId } from "../utils/orderValidation.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";
import { createValidationError } from "../utils/validation.js";

const successResponse = (responseData, status = 200) => ({
  status,
  body: { success: true, data: responseData },
});
const getNameSearchFilter = (text) => ({
  $regex: text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  $options: "i",
});
export function getOfferStatus(offer, now = new Date()) {
  return !offer.isActive
    ? "inactive"
    : +new Date(offer.expiryDate) <= +now
      ? "expired"
      : +new Date(offer.startDate) > +now
        ? "scheduled"
        : "active";
}
async function formatOffer(offer) {
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
  } = offer;
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
    status: getOfferStatus(offer),
  };
}
export async function listOffers(requestData) {
  const searchOptions = validateOfferFilters(requestData.query),
    now = new Date(),
    filter = {};
  if (searchOptions.search) filter.name = getNameSearchFilter(searchOptions.search);
  if (searchOptions.status === "inactive") filter.isActive = false;
  if (["active", "scheduled", "expired"].includes(searchOptions.status))
    filter.isActive = true;
  if (searchOptions.status === "expired") filter.expiryDate = { $lte: now };
  if (["active", "scheduled"].includes(searchOptions.status))
    filter.expiryDate = { $gt: now };
  if (searchOptions.status === "active") filter.startDate = { $lte: now };
  if (searchOptions.status === "scheduled") filter.startDate = { $gt: now };
  const total = await Campaign.countDocuments(filter),
    totalPages = Math.max(1, Math.ceil(total / searchOptions.limit)),
    page = Math.min(searchOptions.page, totalPages);
  const offers = await Campaign.find(filter)
    .sort(
      {
        newest: { createdAt: -1, _id: -1 },
        name: { name: 1, _id: 1 },
        expiry: { expiryDate: 1, _id: 1 },
      }[searchOptions.sort],
    )
    .skip((page - 1) * searchOptions.limit)
    .limit(searchOptions.limit)
    .lean();
  return successResponse({
    offers: await Promise.all(offers.map(formatOffer)),
    summary: {
      total: await Campaign.countDocuments({}),
      active: await Campaign.countDocuments({
        isActive: true, startDate: { $lte: now }, expiryDate: { $gt: now },
      }),
      inactive: await Campaign.countDocuments({ isActive: false }),
    },
    pagination: { page, limit: searchOptions.limit, total, totalPages },
  });
}
export async function listTargets(requestData) {
  validateFormFields(requestData.query, ["scope", "search"]);
  const { scope, search = "" } = requestData.query;
  if (
    !["all", "product", "category"].includes(scope) ||
    typeof search !== "string" ||
    search.length > 100
  )
    throw createError("Invalid target search.");
  if (scope === "all") return successResponse({ targets: [] });
  const targets = await (scope === "product" ? Product : Category)
    .find({
      deletedAt: null,
      ...(search.trim() ? { name: getNameSearchFilter(search.trim()) } : {}),
    })
    .select("name")
    .sort({ name: 1, _id: 1 })
    .limit(50)
    .lean();
  return successResponse({
    targets: targets.map((targetOption) => ({ id: String(targetOption._id), name: targetOption.name })),
  });
}
async function validateOfferTarget(offer) {
  if (
    offer.scope !== "all" &&
    !(await (offer.scope === "product" ? Product : Category).exists({
      _id: offer.targetId,
      deletedAt: null,
    }))
  )
    throw createError(
      "Target is unavailable. Select an existing product or category.",
    );
}
export async function createOffer(requestData) {
  const form = validateOfferForm(requestData.body);
  await validateOfferTarget(form);
  const offer = await Campaign.create({
    ...form,
    updatedBy: requestData.user.id || requestData.user._id,
  });
  return successResponse({ offer: await formatOffer(offer) }, 201);
}
export async function editOffer(requestData) {
  const form = validateOfferForm(requestData.body, true);
  await validateOfferTarget(form);
  const offer = await Campaign.findOneAndUpdate(
    { _id: validateOrderId(requestData.params), __v: requestData.body.version },
    {
      $set: { ...form, updatedBy: requestData.user.id || requestData.user._id },
      $inc: { __v: 1 },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!offer)
    throw createError(
      "Campaign changed or is unavailable. Refresh and try again.",
      409,
    );
  return successResponse({ offer: await formatOffer(offer) });
}
export async function setOfferStatus(requestData) {
  validateFormFields(requestData.body, ["version", "isActive"]);
  validateOfferVersion(requestData.body.version);
  if (typeof requestData.body.isActive !== "boolean")
    throw createError("Invalid campaign status.");
  const offer = await Campaign.findOneAndUpdate(
    { _id: validateOrderId(requestData.params), __v: requestData.body.version },
    {
      $set: {
        isActive: requestData.body.isActive,
        updatedBy: requestData.user.id || requestData.user._id,
      },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" },
  );
  if (!offer)
    throw createError(
      "Campaign changed or is unavailable. Refresh and try again.",
      409,
    );
  return successResponse({ offer: await formatOffer(offer) });
}
export async function getActiveOffers(session = null) {
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

export function validateOfferVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw createValidationError("Invalid version. Refresh and try again.");
  return value;
}
function validateOfferText(value, name, maximum, required = false) {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    (required && !value.trim())
  )
    throw createValidationError(`Invalid ${name}.`, name);
  return value.trim();
}
function validateOfferNumber(value, name, maximum, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw createValidationError(`Invalid ${name}.`, name);
  return value;
}
function validateOfferBoolean(value, name) {
  if (typeof value !== "boolean")
    throw createValidationError(`Invalid ${name}.`, name);
  return value;
}
export function validateOfferForm(body, editing = false) {
  validateFormFields(body, [
    "name",
    "description",
    "scope",
    "targetId",
    "discountType",
    "discountValue",
    "startDate",
    "expiryDate",
    "isActive",
    ...(editing ? ["version"] : []),
  ]);
  if (editing) validateOfferVersion(body.version);
  if (!["all", "product", "category"].includes(body.scope))
    throw createValidationError("Invalid campaign scope.");
  if (body.scope !== "all" && !/^[a-f0-9]{24}$/i.test(body.targetId || ""))
    throw createValidationError("Select a valid target.");
  if (body.scope === "all" && body.targetId !== null)
    throw createValidationError("All-product campaigns cannot have a target.");
  if (!["fixed", "percentage"].includes(body.discountType))
    throw createValidationError("Invalid discount type.");
  const startDate = new Date(body.startDate),
    expiryDate = new Date(body.expiryDate);
  if (
    typeof body.startDate !== "string" ||
    typeof body.expiryDate !== "string" ||
    !Number.isFinite(+startDate) ||
    !Number.isFinite(+expiryDate) ||
    expiryDate <= startDate
  )
    throw createValidationError(
      "Set valid start and expiry dates, with expiry after start.",
    );
  return {
    name: validateOfferText(body.name, "campaign name", 100, true),
    description: validateOfferText(body.description, "description", 500),
    scope: body.scope,
    targetId: body.scope === "all" ? null : body.targetId,
    discountType: body.discountType,
    discountValue: validateOfferNumber(
      body.discountValue,
      "discount",
      body.discountType === "percentage" ? 100 : 100000000,
      1,
    ),
    startDate,
    expiryDate,
    isActive: validateOfferBoolean(body.isActive, "campaign status"),
  };
}
export function validateOfferFilters(searchOptions = {}) {
  validateFormFields(searchOptions, ["page", "limit", "search", "status", "sort"]);
  const page = validateOfferNumber(Number(searchOptions.page ?? 1), "page", 10000, 1),
    limit = validateOfferNumber(Number(searchOptions.limit ?? 10), "limit", 50, 1);
  const status = searchOptions.status || "all",
    sort = searchOptions.sort || "newest",
    search = validateOfferText(searchOptions.search ?? "", "search", 100);
  if (!["all", "active", "scheduled", "expired", "inactive"].includes(status))
    throw createValidationError("Invalid campaign status.");
  if (!["newest", "name", "expiry"].includes(sort))
    throw createValidationError("Invalid campaign sort.");
  return { page, limit, status, sort, search };
}
