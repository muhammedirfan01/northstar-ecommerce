import { validationError } from "../validation.js";
import {
  checkFields,
  readText,
  readId,
  readChoice,
  readQueryNumber,
} from "../formValidation.js";
export function checkStoreQuery(input) {
  checkFields(input, [
    "search",
    "category",
    "minPrice",
    "maxPrice",
    "sort",
    "page",
    "limit",
  ]);
  const query = {};
  if (input.search === undefined) {
    query.search = "";
  } else {
    query.search = readText(input.search, "search", 0, 100);
  }
  if (input.category !== undefined) {
    query.category = readId(input.category, "category", "Invalid category.");
  }
  if (input.minPrice !== undefined) {
    query.minPrice = readQueryNumber(
      input.minPrice,
      "minPrice",
      0,
      99999999.99,
    );
  }
  if (input.maxPrice !== undefined) {
    query.maxPrice = readQueryNumber(
      input.maxPrice,
      "maxPrice",
      0,
      99999999.99,
    );
  }
  query.sort = readChoice(
    input.sort === undefined ? "latest" : input.sort,
    "sort",
    ["latest", "price-asc", "price-desc", "name-asc", "name-desc"],
  );
  if (input.page === undefined) {
    query.page = 1;
  } else {
    query.page = readQueryNumber(input.page, "page", 1, 10000, true);
  }
  if (input.limit === undefined) {
    query.limit = 12;
  } else {
    query.limit = readQueryNumber(input.limit, "limit", 1, 50, true);
  }
  if (
    query.minPrice !== undefined &&
    query.maxPrice !== undefined &&
    query.minPrice > query.maxPrice
  ) {
    throw validationError("Invalid form.", "form");
  }
  return query;
}
