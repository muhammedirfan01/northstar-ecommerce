import { ProductStatus } from "../../constants/statuses.js";
import { validationError } from "../validation.js";
import {
  checkFields,
  readBoolean,
  readText,
  readQueryNumber,
  readChoice,
  readId,
} from "../formValidation.js";
export function checkCatalogStatus(input) {
  checkFields(input, ["isListed"]);
  return {
    isListed: readBoolean(input.isListed, "isListed"),
  };
}
export function checkCatalogQuery(input) {
  checkFields(input, [
    "search",
    "page",
    "limit",
    "status",
    "category",
    "options",
    "sort",
  ]);
  const query = {};
  if (input.search === undefined) {
    query.search = "";
  } else {
    query.search = readText(input.search, "search", 0, 100);
  }
  if (input.page === undefined) {
    query.page = 1;
  } else {
    query.page = readQueryNumber(input.page, "page", 1, 10000, true);
  }
  if (input.limit === undefined) {
    query.limit = 10;
  } else {
    query.limit = readQueryNumber(input.limit, "limit", 1, 50, true);
  }
  query.status = readChoice(
    input.status === undefined ? ProductStatus.ALL : input.status,
    "status",
    Object.values(ProductStatus),
  );
  query.sort = readChoice(input.sort ?? "latest", "sort", ["latest", "status-asc", "status-desc"]);
  query.category = "";
  if (input.category !== undefined && input.category !== "") {
    query.category = readId(input.category, "category");
  }
  if (input.options !== undefined) {
    query.options = readChoice(input.options, "options", ["true", "false"]);
  }
  return query;
}

export function checkCatalogParams(params) {
  const id = params?.id;
  const variantId = params?.variantId;
  if (
    !/^[a-f0-9]{24}$/i.test(id) ||
    (variantId && !/^[a-f0-9]{24}$/i.test(variantId))
  ) {
    throw validationError("Invalid catalog ID.", "form");
  }
  const result = { ...params, id: id.toLowerCase() };
  if (variantId) result.variantId = variantId.toLowerCase();
  return result;
}
