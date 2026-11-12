// Manage discount coupons and check whether a coupon can still be used.

import Coupon from "../models/Coupon.js";
import { validateFormFields, validateBoolean, validateText, validateQueryNumber, validateId, validateChoice } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";
import { createValidationError } from "../utils/validation.js";

const successResponse = (responseData, status = 200) => ({
  status,
  body: { success: true, data: responseData },
});
function getAvailableCouponFilter() {
  return {
    $or: [
      { usageLimit: null },
      { $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] } },
    ],
  };
}
export function getCouponStatus(coupon, now = new Date()) {
  if (coupon.deletedAt) return "deleted";
  if (!coupon.isActive) return "inactive";
  if (new Date(coupon.expiryDate) <= now) return "expired";
  if (
    coupon.usageLimit !== null &&
    coupon.usageLimit !== undefined &&
    (coupon.usedCount || 0) >= coupon.usageLimit
  )
    return "exhausted";
  if (new Date(coupon.startDate) > now) return "scheduled";
  return "active";
}
function formatCoupon(coupon) {
  const value = coupon.toObject ? coupon.toObject() : coupon;
  return {
    id: String(value._id),
    code: value.code,
    discountType: value.discountType,
    discountValue: value.discountValue,
    minPurchasePaise: value.minPurchasePaise ?? 0,
    maxDiscountPaise: value.maxDiscountPaise ?? null,
    usageLimit: value.usageLimit ?? null,
    usedCount: value.usedCount ?? 0,
    startDate: value.startDate,
    expiryDate: value.expiryDate,
    isActive: value.isActive,
    deletedAt: value.deletedAt || null,
    version: value.__v ?? 0,
    status: getCouponStatus(value),
  };
}
export function getCouponFilter(query, now = new Date()) {
  const filter = {
    deletedAt: query.status === "deleted" ? { $ne: null } : null,
  };
  if (query.search)
    filter.code = {
      $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  if (query.status === "inactive") filter.isActive = false;
  if (["active", "scheduled", "expired", "exhausted"].includes(query.status))
    filter.isActive = true;
  if (query.status === "expired") filter.expiryDate = { $lte: now };
  if (["active", "scheduled", "exhausted"].includes(query.status))
    filter.expiryDate = { $gt: now };
  if (query.status === "active") filter.startDate = { $lte: now };
  if (query.status === "scheduled") filter.startDate = { $gt: now };
  if (["active", "scheduled"].includes(query.status))
    Object.assign(filter, getAvailableCouponFilter());
  if (query.status === "exhausted") {
    filter.usageLimit = { $ne: null };
    filter.$expr = { $gte: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] };
  }
  return filter;
}
export async function listCoupons(requestData) {
  const query = validateCouponFilters(requestData.query),
    filter = getCouponFilter(query),
    now = new Date();
  const [total, all, active, expired, inactive] = await Promise.all([
    Coupon.countDocuments(filter),
    Coupon.countDocuments({ deletedAt: null }),
    Coupon.countDocuments(getCouponFilter({ status: "active" }, now)),
    Coupon.countDocuments(getCouponFilter({ status: "expired" }, now)),
    Coupon.countDocuments({ deletedAt: null, isActive: false }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / query.limit)),
    page = Math.min(query.page, totalPages),
    sort = {
      newest: { createdAt: -1, _id: -1 },
      code: { code: 1, _id: 1 },
      expiry: { expiryDate: 1, _id: 1 },
    }[query.sort];
  const records = await Coupon.find(filter)
    .sort(sort)
    .skip((page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  return successResponse({
    coupons: records.map(formatCoupon),
    summary: { total: all, active, expired, inactive },
    pagination: { page, totalPages, total, limit: query.limit },
  });
}
export async function createCoupon(requestData) {
  const values = validateCouponForm(requestData.body);
  try {
    return successResponse({ coupon: formatCoupon(await Coupon.create(values)) }, 201);
  } catch (error) {
    if (error.code === 11000)
      throw createError(
        "This coupon code already exists. Choose another code or restore the existing coupon.",
        409,
      );
    throw error;
  }
}
async function findCoupon(requestData) {
  const savedCoupon = await Coupon.findById(validateCouponId(requestData.params));
  if (!savedCoupon) throw createError("Coupon not found.", 404);
  return savedCoupon;
}
async function saveCouponChanges(savedCoupon, version, changes) {
  const filter = {
    _id: savedCoupon._id,
    usedCount:
      (savedCoupon.usedCount ?? 0) === 0 ? { $in: [0, null] } : savedCoupon.usedCount,
    ...(version === 0
      ? { $or: [{ __v: 0 }, { __v: { $exists: false } }] }
      : { __v: version }),
  };
  const coupon = await Coupon.findOneAndUpdate(
    filter,
    { $set: changes, $inc: { __v: 1 } },
    { returnDocument: "after", runValidators: true },
  );
  if (!coupon)
    throw createError("Coupon or usage changed. Refresh before saving.", 409);
  return successResponse({ coupon: formatCoupon(coupon) });
}
export async function editCoupon(requestData) {
  const { version, ...values } = validateCouponForm(requestData.body, true),
    savedCoupon = await findCoupon(requestData);
  if (savedCoupon.deletedAt)
    throw createError("Restore the coupon before editing it.", 409);
  if (savedCoupon.usedCount > 0 && savedCoupon.code !== values.code)
    throw createError("Used coupon codes cannot be renamed.", 409);
  if (values.usageLimit !== null && values.usageLimit < savedCoupon.usedCount)
    throw createError("The usage limit cannot be below recorded uses.", 409);
  try {
    return await saveCouponChanges(savedCoupon, version, values);
  } catch (error) {
    if (error.code === 11000)
      throw createError("This coupon code already exists.", 409);
    throw error;
  }
}
export async function setCouponStatus(requestData) {
  validateFormFields(requestData.body, ["version", "isActive"]);
  const version = validateCouponVersion(requestData.body.version),
    isActive = validateBoolean(requestData.body.isActive, "isActive"),
    savedCoupon = await findCoupon(requestData);
  if (savedCoupon.deletedAt)
    throw createError("Restore the coupon before enabling it.", 409);
  return saveCouponChanges(savedCoupon, version, { isActive });
}
export async function deleteCoupon(requestData) {
  validateFormFields(requestData.body, ["version", "confirmDelete"]);
  const version = validateCouponVersion(requestData.body.version);
  if (requestData.body.confirmDelete !== true)
    throw createError("Confirm coupon deletion.", 400);
  const savedCoupon = await findCoupon(requestData);
  return saveCouponChanges(savedCoupon, version, { deletedAt: savedCoupon.deletedAt || new Date() });
}
export async function restoreCoupon(requestData) {
  validateFormFields(requestData.body, ["version"]);
  const version = validateCouponVersion(requestData.body.version),
    savedCoupon = await findCoupon(requestData);
  return saveCouponChanges(savedCoupon, version, { deletedAt: null });
}

export function validateCouponId(params) {
  return validateId(params?.id, "id", "Invalid coupon ID.");
}
export function validateCouponVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw createValidationError(
      "Refresh the coupon before making changes.",
      "version",
    );
  return value;
}
function validateWholeNumber(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw createValidationError(`Invalid ${name}.`, name);
  return value;
}
export function validateCouponForm(body, editing = false) {
  validateFormFields(body, [
    "code",
    "discountType",
    "discountValue",
    "minPurchasePaise",
    "maxDiscountPaise",
    "usageLimit",
    "startDate",
    "expiryDate",
    "isActive",
    ...(editing ? ["version"] : []),
  ]);
  const code = validateText(body.code, "code", 3, 40).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(code))
    throw createValidationError(
      "Use letters, numbers, underscores or hyphens for the coupon code.",
      "code",
    );
  const discountType = validateChoice(body.discountType, "discountType", [
      "percentage",
      "fixed",
    ]),
    discountValue = validateWholeNumber(
      body.discountValue,
      "discountValue",
      1,
      discountType === "percentage" ? 100 : 100000000,
    );
  const minPurchasePaise = validateWholeNumber(
      body.minPurchasePaise ?? 0,
      "minPurchasePaise",
      0,
      100000000,
    ),
    maxDiscountPaise =
      body.maxDiscountPaise == null
        ? null
        : validateWholeNumber(body.maxDiscountPaise, "maxDiscountPaise", 1, 100000000),
    usageLimit =
      body.usageLimit == null
        ? null
        : validateWholeNumber(body.usageLimit, "usageLimit", 1, 100000000);
  for (const key of ["startDate", "expiryDate"])
    if (
      typeof body[key] !== "string" ||
      body[key].length > 40 ||
      !Number.isFinite(Date.parse(body[key]))
    )
      throw createValidationError(`Enter a valid ${key}.`, key);
  const startDate = new Date(body.startDate),
    expiryDate = new Date(body.expiryDate);
  if (expiryDate <= startDate)
    throw createValidationError("Expiry must be after the start date.", "expiryDate");
  return {
    code,
    discountType,
    discountValue,
    minPurchasePaise,
    maxDiscountPaise,
    usageLimit,
    startDate,
    expiryDate,
    isActive: validateBoolean(body.isActive ?? true, "isActive"),
    ...(editing ? { version: validateCouponVersion(body.version) } : {}),
  };
}
export function validateCouponFilters(searchOptions = {}) {
  validateFormFields(searchOptions, ["page", "limit", "search", "status", "sort"]);
  return {
    page: validateQueryNumber(searchOptions.page ?? 1, "page", 1, 10000, true),
    limit: validateQueryNumber(searchOptions.limit ?? 10, "limit", 1, 50, true),
    search: validateText(searchOptions.search ?? "", "search", 0, 100),
    status: validateChoice(searchOptions.status || "all", "status", [
      "all",
      "active",
      "scheduled",
      "expired",
      "inactive",
      "exhausted",
      "deleted",
    ]),
    sort: validateChoice(searchOptions.sort || "newest", "sort", [
      "newest",
      "code",
      "expiry",
    ]),
  };
}
