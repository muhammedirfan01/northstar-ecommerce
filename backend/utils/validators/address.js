import { validationError } from "../validation.js";
import {
  checkFields,
  readText,
  readChoice,
  readBoolean,
} from "../formValidation.js";
import { readAddressVersion } from "../accountValidation.js";
export function checkAddressDetails(input) {
  checkFields(input, [
    "fullName",
    "phoneNumber",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postalCode",
    "country",
    "label",
    "isDefault",
    "version",
  ]);
  const fullName = readText(input.fullName, "fullName", 2, 80);
  if (typeof input.phoneNumber !== "string")
    throw validationError("Invalid phoneNumber.", "phoneNumber");
  let phoneNumber = input.phoneNumber.trim();
  if (!/^(\+91)?[6-9]\d{9}$/.test(phoneNumber)) {
    throw validationError("Invalid phoneNumber.", "phoneNumber");
  }
  if (!phoneNumber.startsWith("+91")) phoneNumber = "+91" + phoneNumber;
  const addressLine1 = readText(input.addressLine1, "addressLine1", 5, 160);
  let addressLine2 = "";
  if (input.addressLine2 !== undefined)
    addressLine2 = readText(input.addressLine2, "addressLine2", 0, 100);
  const city = readText(input.city, "city", 2, 80);
  const state = readText(input.state, "state", 2, 80);
  const postalCode = readText(input.postalCode, "postalCode", 0, Infinity);
  if (!/^[1-9]\d{5}$/.test(postalCode))
    throw validationError("Invalid postalCode.", "postalCode");
  const result = {
    fullName,
    phoneNumber,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
  };
  if (input.country !== undefined)
    result.country = readChoice(input.country, "country", ["IN"]);
  result.label = "Home";
  if (input.label !== undefined)
    result.label = readChoice(input.label, "label", ["Home", "Work", "Other"]);
  result.isDefault = false;
  if (input.isDefault !== undefined)
    result.isDefault = readBoolean(input.isDefault, "isDefault");
  result.version = readAddressVersion(input.version);
  return result;
}
export function checkAddressVersion(input) {
  checkFields(input, ["version"]);
  return {
    version: readAddressVersion(input.version),
  };
}

export function checkAddressId(params) {
  if (!/^[a-f0-9]{24}$/i.test(params?.id)) {
    const error = validationError("Invalid address ID");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}

export function readAddressForm(body, versionOnly = false) {
  try {
    if (versionOnly) return checkAddressVersion(body);
    return checkAddressDetails(body);
  } catch (error) {
    error.code = "VALIDATION_ERROR";
    error.data = { fieldErrors: { [error.field || "form"]: [error.message] } };
    throw error;
  }
}
