import { CustomerStatus } from "../../constants/statuses.js";
import { validationError } from "../validation.js";
import {
  checkFields,
  readQueryNumber,
  readText,
  readChoice,
  readBoolean,
} from "../formValidation.js";
export function checkCustomerQuery(input) {
  checkFields(input, ["page", "limit", "search", "status"]);
  const query = {
    page: 1,
    limit: 10,
    search: "",
    status: CustomerStatus.ALL,
  };
  if (input.page !== undefined)
    query.page = readQueryNumber(input.page, "page", 1, 10000, true);
  if (input.limit !== undefined)
    query.limit = readQueryNumber(input.limit, "limit", 1, 50, true);
  if (input.search !== undefined)
    query.search = readText(input.search, "search", 0, 100);
  if (input.status !== undefined)
    query.status = readChoice(input.status, "status", Object.values(CustomerStatus));
  return query;
}
export function checkCustomerStatus(input) {
  checkFields(input, ["isBlocked"]);
  return {
    isBlocked: readBoolean(input.isBlocked, "isBlocked"),
  };
}

export function checkCustomerId(params) {
  if (!/^[a-f0-9]{24}$/i.test(params?.id)) {
    const error = validationError("Invalid customer ID.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}

export function checkCustomerPhotoQuery(query) {
  const uuid =
    /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  if (
    !query ||
    Object.keys(query).length !== 1 ||
    typeof query.version !== "string" ||
    !uuid.test(query.version)
  ) {
    const error = validationError("Invalid photo version.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}
