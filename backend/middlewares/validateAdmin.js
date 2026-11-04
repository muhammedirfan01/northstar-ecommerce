import { validationError } from "../utils/validation.js";
export function checkCustomerQuery(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["page", "limit", "search", "status"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
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
  let status = original.status;
  if (status === undefined) {
    status = "all";
  } else {
    if (!["all", "active", "blocked"].includes(status)) {
      throw validationError("Invalid status.", "status");
    }
  }
  if (status !== undefined) {
    input.status = status;
  }
  return input;
}
export function checkCustomerStatus(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["isBlocked"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const isBlocked = original.isBlocked;
  if (typeof isBlocked !== "boolean") {
    throw validationError("Invalid isBlocked.", "isBlocked");
  }
  input.isBlocked = isBlocked;
  return input;
}
export function validateCustomerQuery(req, res, next) {
  try {
    req.customerQuery = checkCustomerQuery(req.query);
  } catch (error) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message,
    });
  }
  next();
}
export function validateCustomerId(req, res, next) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid customer ID.",
    });
  }
  next();
}
export function validateCustomerStatus(req, res, next) {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
      throw validationError("Invalid customer ID.");
    }
    req.customerStatus = {
      params: {
        id: req.params.id,
      },
      body: checkCustomerStatus(req.body),
    };
  } catch (error) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message,
    });
  }
  next();
}
export function validateCustomerPhoto(req, res, next) {
  if (
    Object.keys(req.query).length !== 1 ||
    typeof req.query.version !== "string" ||
    !/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/.test(
      req.query.version,
    )
  ) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid photo version.",
    });
  }
  next();
}
