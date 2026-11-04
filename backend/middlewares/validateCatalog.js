import { validationError } from "../utils/validation.js";
export function checkCatalogStatus(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["isListed"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const isListed = original.isListed;
  if (typeof isListed !== "boolean") {
    throw validationError("Invalid isListed.", "isListed");
  }
  input.isListed = isListed;
  return input;
}
export function checkCatalogQuery(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (
      !["search", "page", "limit", "status", "category", "options"].includes(
        field,
      )
    ) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let search = original.search;
  if (search === undefined) {
    search = "";
  } else {
    if (typeof search !== "string") {
      throw validationError("Invalid search.", "search");
    }
    search = search.trim();
    if (search.length > 100) {
      throw validationError("Invalid search.", "search");
    }
  }
  if (search !== undefined) {
    input.search = search;
  }
  let page = original.page;
  if (page === undefined) {
    page = 1;
  } else {
    page = Number(page);
    if (typeof page !== "number" || !Number.isFinite(page)) {
      throw validationError("Invalid page.", "page");
    }
    if (!Number.isSafeInteger(page)) {
      throw validationError("Invalid page.", "page");
    }
    if (page < 1) {
      throw validationError("Invalid page.", "page");
    }
    if (page > 10000) {
      throw validationError("Invalid page.", "page");
    }
  }
  if (page !== undefined) {
    input.page = page;
  }
  let limit = original.limit;
  if (limit === undefined) {
    limit = 10;
  } else {
    limit = Number(limit);
    if (typeof limit !== "number" || !Number.isFinite(limit)) {
      throw validationError("Invalid limit.", "limit");
    }
    if (!Number.isSafeInteger(limit)) {
      throw validationError("Invalid limit.", "limit");
    }
    if (limit < 1) {
      throw validationError("Invalid limit.", "limit");
    }
    if (limit > 50) {
      throw validationError("Invalid limit.", "limit");
    }
  }
  if (limit !== undefined) {
    input.limit = limit;
  }
  let status = original.status;
  if (status === undefined) {
    status = "all";
  } else {
    if (
      ![
        "all",
        "listed",
        "unlisted",
        "published",
        "draft",
        "out-of-stock",
        "deleted",
      ].includes(status)
    ) {
      throw validationError("Invalid status.", "status");
    }
  }
  if (status !== undefined) {
    input.status = status;
  }
  let category = original.category;
  if (category === undefined) {
    category = "";
  } else {
    if (!(category === "")) {
      if (typeof category !== "string") {
        throw validationError("Invalid category.", "category");
      }
      if (!/^[a-f0-9]{24}$/i.test(category)) {
        throw validationError("Invalid catalog ID.", "category");
      }
    }
  }
  if (category !== undefined) {
    input.category = category;
  }
  const options = original.options;
  if (options !== undefined) {
    if (!["true", "false"].includes(options)) {
      throw validationError("Invalid options.", "options");
    }
  }
  if (options !== undefined) {
    input.options = options;
  }
  return input;
}
export function validateCatalogId(req, res, next) {
  if (
    !/^[a-f0-9]{24}$/i.test(req.params.id) ||
    (req.params.variantId && !/^[a-f0-9]{24}$/i.test(req.params.variantId))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid catalog ID.",
    });
  }
  req.params.id = req.params.id.toLowerCase();
  if (req.params.variantId) {
    req.params.variantId = req.params.variantId.toLowerCase();
  }
  next();
}
export function validateCatalogQuery(req, res, next) {
  try {
    req.catalogQuery = checkCatalogQuery(req.query);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateCatalogStatus(req, res, next) {
  try {
    req.catalogInput = checkCatalogStatus(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
