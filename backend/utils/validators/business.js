import { checkFields } from "../formValidation.js";
import { validationError } from "../validation.js";
export function version(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw validationError("Invalid version. Refresh and try again.");
  return value;
}
function text(value, name, max, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw validationError(`Invalid ${name}.`, name);
  return value.trim();
}
function integer(value, name, max, min = 0) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw validationError(`Invalid ${name}.`, name);
  return value;
}
function boolean(value, name) {
  if (typeof value !== "boolean")
    throw validationError(`Invalid ${name}.`, name);
  return value;
}
export function settingsForm(body) {
  checkFields(body, [
    "version",
    "storeName",
    "supportEmail",
    "supportPhone",
    "invoiceAddress",
    "shippingChargePaise",
    "freeShippingAbovePaise",
    "taxBasisPoints",
    "codEnabled",
    "onlineEnabled",
  ]);
  version(body.version);
  const result = {
    storeName: text(body.storeName, "store name", 100, true),
    supportEmail: text(body.supportEmail, "support email", 200),
    supportPhone: text(body.supportPhone, "support phone", 30),
    invoiceAddress: text(body.invoiceAddress, "invoice address", 500),
    shippingChargePaise: integer(
      body.shippingChargePaise,
      "delivery charge",
      100000000,
    ),
    freeShippingAbovePaise:
      body.freeShippingAbovePaise === null
        ? null
        : integer(body.freeShippingAbovePaise, "delivery threshold", 100000000),
    taxBasisPoints: integer(body.taxBasisPoints, "tax rate", 10000),
    codEnabled: boolean(body.codEnabled, "cash on delivery"),
    onlineEnabled: boolean(body.onlineEnabled, "online payments"),
  };
  if (
    result.supportEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.supportEmail)
  )
    throw validationError("Invalid support email.");
  if (!result.codEnabled && !result.onlineEnabled)
    throw validationError("Enable at least one payment method.");
  return result;
}
export function campaignForm(body, editing = false) {
  checkFields(body, [
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
  if (editing) version(body.version);
  if (!["all", "product", "category"].includes(body.scope))
    throw validationError("Invalid campaign scope.");
  if (body.scope !== "all" && !/^[a-f0-9]{24}$/i.test(body.targetId || ""))
    throw validationError("Select a valid target.");
  if (body.scope === "all" && body.targetId !== null)
    throw validationError("All-product campaigns cannot have a target.");
  if (!["fixed", "percentage"].includes(body.discountType))
    throw validationError("Invalid discount type.");
  const startDate = new Date(body.startDate),
    expiryDate = new Date(body.expiryDate);
  if (
    typeof body.startDate !== "string" ||
    typeof body.expiryDate !== "string" ||
    !Number.isFinite(+startDate) ||
    !Number.isFinite(+expiryDate) ||
    expiryDate <= startDate
  )
    throw validationError(
      "Set valid start and expiry dates, with expiry after start.",
    );
  return {
    name: text(body.name, "campaign name", 100, true),
    description: text(body.description, "description", 500),
    scope: body.scope,
    targetId: body.scope === "all" ? null : body.targetId,
    discountType: body.discountType,
    discountValue: integer(
      body.discountValue,
      "discount",
      body.discountType === "percentage" ? 100 : 100000000,
      1,
    ),
    startDate,
    expiryDate,
    isActive: boolean(body.isActive, "campaign status"),
  };
}
export function campaignQuery(q = {}) {
  checkFields(q, ["page", "limit", "search", "status", "sort"]);
  const page = integer(Number(q.page ?? 1), "page", 10000, 1),
    limit = integer(Number(q.limit ?? 10), "limit", 50, 1);
  const status = q.status || "all",
    sort = q.sort || "newest",
    search = text(q.search ?? "", "search", 100);
  if (!["all", "active", "scheduled", "expired", "inactive"].includes(status))
    throw validationError("Invalid campaign status.");
  if (!["newest", "name", "expiry"].includes(sort))
    throw validationError("Invalid campaign sort.");
  return { page, limit, status, sort, search };
}
