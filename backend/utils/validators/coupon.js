import {
  checkFields,
  readText,
  readQueryNumber,
  readId,
  readBoolean,
  readChoice,
} from "../formValidation.js";
import { validationError } from "../validation.js";
export function couponId(params) {
  return readId(params?.id, "id", "Invalid coupon ID.");
}
export function couponVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw validationError(
      "Refresh the coupon before making changes.",
      "version",
    );
  return value;
}
function whole(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw validationError(`Invalid ${name}.`, name);
  return value;
}
export function couponForm(body, editing = false) {
  checkFields(body, [
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
  const code = readText(body.code, "code", 3, 40).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(code))
    throw validationError(
      "Use letters, numbers, underscores or hyphens for the coupon code.",
      "code",
    );
  const discountType = readChoice(body.discountType, "discountType", [
      "percentage",
      "fixed",
    ]),
    discountValue = whole(
      body.discountValue,
      "discountValue",
      1,
      discountType === "percentage" ? 100 : 100000000,
    );
  const minPurchasePaise = whole(
      body.minPurchasePaise ?? 0,
      "minPurchasePaise",
      0,
      100000000,
    ),
    maxDiscountPaise =
      body.maxDiscountPaise == null
        ? null
        : whole(body.maxDiscountPaise, "maxDiscountPaise", 1, 100000000),
    usageLimit =
      body.usageLimit == null
        ? null
        : whole(body.usageLimit, "usageLimit", 1, 100000000);
  for (const key of ["startDate", "expiryDate"])
    if (
      typeof body[key] !== "string" ||
      body[key].length > 40 ||
      !Number.isFinite(Date.parse(body[key]))
    )
      throw validationError(`Enter a valid ${key}.`, key);
  const startDate = new Date(body.startDate),
    expiryDate = new Date(body.expiryDate);
  if (expiryDate <= startDate)
    throw validationError("Expiry must be after the start date.", "expiryDate");
  return {
    code,
    discountType,
    discountValue,
    minPurchasePaise,
    maxDiscountPaise,
    usageLimit,
    startDate,
    expiryDate,
    isActive: readBoolean(body.isActive ?? true, "isActive"),
    ...(editing ? { version: couponVersion(body.version) } : {}),
  };
}
export function couponQuery(input = {}) {
  checkFields(input, ["page", "limit", "search", "status", "sort"]);
  return {
    page: readQueryNumber(input.page ?? 1, "page", 1, 10000, true),
    limit: readQueryNumber(input.limit ?? 10, "limit", 1, 50, true),
    search: readText(input.search ?? "", "search", 0, 100),
    status: readChoice(input.status || "all", "status", [
      "all",
      "active",
      "scheduled",
      "expired",
      "inactive",
      "exhausted",
      "deleted",
    ]),
    sort: readChoice(input.sort || "newest", "sort", [
      "newest",
      "code",
      "expiry",
    ]),
  };
}
