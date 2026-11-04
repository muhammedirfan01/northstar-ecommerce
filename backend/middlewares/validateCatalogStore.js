import { validationError } from "../utils/validation.js";
export function checkStoreQuery(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (
      ![
        "search",
        "category",
        "minPrice",
        "maxPrice",
        "sort",
        "page",
        "limit",
      ].includes(field)
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
  const category = original.category;
  if (category !== undefined) {
    if (typeof category !== "string") {
      throw validationError("Invalid category.", "category");
    }
    if (!/^[a-f0-9]{24}$/i.test(category)) {
      throw validationError("Invalid category.", "category");
    }
  }
  if (category !== undefined) {
    input.category = category;
  }
  let minPrice = original.minPrice;
  if (minPrice !== undefined) {
    minPrice = Number(minPrice);
    if (typeof minPrice !== "number" || !Number.isFinite(minPrice)) {
      throw validationError("Invalid minPrice.", "minPrice");
    }
    if (minPrice < 0) {
      throw validationError("Invalid minPrice.", "minPrice");
    }
    if (minPrice > 99999999.99) {
      throw validationError("Invalid minPrice.", "minPrice");
    }
  }
  if (minPrice !== undefined) {
    input.minPrice = minPrice;
  }
  let maxPrice = original.maxPrice;
  if (maxPrice !== undefined) {
    maxPrice = Number(maxPrice);
    if (typeof maxPrice !== "number" || !Number.isFinite(maxPrice)) {
      throw validationError("Invalid maxPrice.", "maxPrice");
    }
    if (maxPrice < 0) {
      throw validationError("Invalid maxPrice.", "maxPrice");
    }
    if (maxPrice > 99999999.99) {
      throw validationError("Invalid maxPrice.", "maxPrice");
    }
  }
  if (maxPrice !== undefined) {
    input.maxPrice = maxPrice;
  }
  let sort = original.sort;
  if (sort === undefined) {
    sort = "latest";
  } else {
    if (
      !["latest", "price-asc", "price-desc", "name-asc", "name-desc"].includes(
        sort,
      )
    ) {
      throw validationError("Invalid sort.", "sort");
    }
  }
  if (sort !== undefined) {
    input.sort = sort;
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
    limit = 12;
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
  if (
    !(
      input.minPrice === undefined ||
      input.maxPrice === undefined ||
      input.minPrice <= input.maxPrice
    )
  ) {
    throw validationError("Invalid form.", "form");
  }
  return input;
}
export function disableCatalogCache(_req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}
export function validateCatalogStoreQuery(req, res, next) {
  try {
    req.catalogStoreQuery = checkStoreQuery(req.query);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
