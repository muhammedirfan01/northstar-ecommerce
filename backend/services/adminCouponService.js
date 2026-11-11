import Coupon from "../models/Coupon.js";
import {
  couponForm,
  couponId,
  couponQuery,
  couponVersion,
} from "../utils/validators/coupon.js";
import { checkFields, readBoolean } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";
const success = (data, status = 200) => ({
  status,
  body: { success: true, data },
});
function remaining() {
  return {
    $or: [
      { usageLimit: null },
      { $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] } },
    ],
  };
}
export function couponStatus(coupon, now = new Date()) {
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
function couponData(coupon) {
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
    status: couponStatus(value),
  };
}
export function couponFilter(query, now = new Date()) {
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
    Object.assign(filter, remaining());
  if (query.status === "exhausted") {
    filter.usageLimit = { $ne: null };
    filter.$expr = { $gte: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] };
  }
  return filter;
}
export async function listCoupons(input) {
  const query = couponQuery(input.query),
    filter = couponFilter(query),
    now = new Date();
  const [total, all, active, expired, inactive] = await Promise.all([
    Coupon.countDocuments(filter),
    Coupon.countDocuments({ deletedAt: null }),
    Coupon.countDocuments(couponFilter({ status: "active" }, now)),
    Coupon.countDocuments(couponFilter({ status: "expired" }, now)),
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
  return success({
    coupons: records.map(couponData),
    summary: { total: all, active, expired, inactive },
    pagination: { page, totalPages, total, limit: query.limit },
  });
}
export async function createCoupon(input) {
  const values = couponForm(input.body);
  try {
    return success({ coupon: couponData(await Coupon.create(values)) }, 201);
  } catch (error) {
    if (error.code === 11000)
      throw httpError(
        "This coupon code already exists. Choose another code or restore the existing coupon.",
        409,
      );
    throw error;
  }
}
async function load(input) {
  const record = await Coupon.findById(couponId(input.params));
  if (!record) throw httpError("Coupon not found.", 404);
  return record;
}
async function update(record, version, changes) {
  const filter = {
    _id: record._id,
    usedCount:
      (record.usedCount ?? 0) === 0 ? { $in: [0, null] } : record.usedCount,
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
    throw httpError("Coupon or usage changed. Refresh before saving.", 409);
  return success({ coupon: couponData(coupon) });
}
export async function editCoupon(input) {
  const { version, ...values } = couponForm(input.body, true),
    record = await load(input);
  if (record.deletedAt)
    throw httpError("Restore the coupon before editing it.", 409);
  if (record.usedCount > 0 && record.code !== values.code)
    throw httpError("Used coupon codes cannot be renamed.", 409);
  if (values.usageLimit !== null && values.usageLimit < record.usedCount)
    throw httpError("The usage limit cannot be below recorded uses.", 409);
  try {
    return await update(record, version, values);
  } catch (error) {
    if (error.code === 11000)
      throw httpError("This coupon code already exists.", 409);
    throw error;
  }
}
export async function setCouponStatus(input) {
  checkFields(input.body, ["version", "isActive"]);
  const version = couponVersion(input.body.version),
    isActive = readBoolean(input.body.isActive, "isActive"),
    record = await load(input);
  if (record.deletedAt)
    throw httpError("Restore the coupon before enabling it.", 409);
  return update(record, version, { isActive });
}
export async function deleteCoupon(input) {
  checkFields(input.body, ["version", "confirmDelete"]);
  const version = couponVersion(input.body.version);
  if (input.body.confirmDelete !== true)
    throw httpError("Confirm coupon deletion.", 400);
  const record = await load(input);
  return update(record, version, { deletedAt: record.deletedAt || new Date() });
}
export async function restoreCoupon(input) {
  checkFields(input.body, ["version"]);
  const version = couponVersion(input.body.version),
    record = await load(input);
  return update(record, version, { deletedAt: null });
}
