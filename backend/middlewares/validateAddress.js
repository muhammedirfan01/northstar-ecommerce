import { validationError } from "../utils/validation.js";
export function checkAddressDetails(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (
      ![
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
      ].includes(field)
    ) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let fullName = original.fullName;
  if (typeof fullName !== "string") {
    throw validationError("Invalid fullName.", "fullName");
  }
  fullName = fullName.trim();
  if (fullName.length < 2) {
    throw validationError("Invalid fullName.", "fullName");
  }
  if (fullName.length > 80) {
    throw validationError("Invalid fullName.", "fullName");
  }
  input.fullName = fullName;
  let phoneNumber = original.phoneNumber;
  if (typeof phoneNumber !== "string") {
    throw validationError("Invalid phoneNumber.", "phoneNumber");
  }
  phoneNumber = phoneNumber.trim();
  if (!/^(\+91)?[6-9]\d{9}$/.test(phoneNumber)) {
    throw validationError("Invalid phoneNumber.", "phoneNumber");
  }
  phoneNumber = phoneNumber.startsWith("+91")
    ? phoneNumber
    : "+91" + phoneNumber;
  input.phoneNumber = phoneNumber;
  let addressLine = original.addressLine1;
  if (typeof addressLine !== "string") {
    throw validationError("Invalid addressLine1.", "addressLine1");
  }
  addressLine = addressLine.trim();
  if (addressLine.length < 5) {
    throw validationError("Invalid addressLine1.", "addressLine1");
  }
  if (addressLine.length > 160) {
    throw validationError("Invalid addressLine1.", "addressLine1");
  }
  input.addressLine1 = addressLine;
  let addressLine25 = original.addressLine2;
  if (addressLine25 === undefined) {
    addressLine25 = "";
  } else {
    if (typeof addressLine25 !== "string") {
      throw validationError("Invalid addressLine2.", "addressLine2");
    }
    addressLine25 = addressLine25.trim();
    if (addressLine25.length > 100) {
      throw validationError("Invalid addressLine2.", "addressLine2");
    }
  }
  if (addressLine25 !== undefined) {
    input.addressLine2 = addressLine25;
  }
  let city = original.city;
  if (typeof city !== "string") {
    throw validationError("Invalid city.", "city");
  }
  city = city.trim();
  if (city.length < 2) {
    throw validationError("Invalid city.", "city");
  }
  if (city.length > 80) {
    throw validationError("Invalid city.", "city");
  }
  input.city = city;
  let state = original.state;
  if (typeof state !== "string") {
    throw validationError("Invalid state.", "state");
  }
  state = state.trim();
  if (state.length < 2) {
    throw validationError("Invalid state.", "state");
  }
  if (state.length > 80) {
    throw validationError("Invalid state.", "state");
  }
  input.state = state;
  let postalCode = original.postalCode;
  if (typeof postalCode !== "string") {
    throw validationError("Invalid postalCode.", "postalCode");
  }
  postalCode = postalCode.trim();
  if (!/^[1-9]\d{5}$/.test(postalCode)) {
    throw validationError("Invalid postalCode.", "postalCode");
  }
  input.postalCode = postalCode;
  const country = original.country;
  if (country !== undefined) {
    if (country !== "IN") {
      throw validationError("Invalid country.", "country");
    }
  }
  if (country !== undefined) {
    input.country = country;
  }
  let label = original.label;
  if (label === undefined) {
    label = "Home";
  } else {
    if (!["Home", "Work", "Other"].includes(label)) {
      throw validationError("Invalid label.", "label");
    }
  }
  if (label !== undefined) {
    input.label = label;
  }
  let isDefault = original.isDefault;
  if (isDefault === undefined) {
    isDefault = false;
  } else {
    if (typeof isDefault !== "boolean") {
      throw validationError("Invalid isDefault.", "isDefault");
    }
  }
  if (isDefault !== undefined) {
    input.isDefault = isDefault;
  }
  const version = original.version;
  if (typeof version !== "number" || !Number.isFinite(version)) {
    throw validationError("Invalid version.", "version");
  }
  if (!Number.isSafeInteger(version)) {
    throw validationError("Invalid version.", "version");
  }
  if (version < 0) {
    throw validationError("Invalid version.", "version");
  }
  if (version !== undefined) {
    input.version = version;
  }
  return input;
}
export function checkAddressVersion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["version"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const version = original.version;
  if (typeof version !== "number" || !Number.isFinite(version)) {
    throw validationError("Invalid version.", "version");
  }
  if (!Number.isSafeInteger(version)) {
    throw validationError("Invalid version.", "version");
  }
  if (version < 0) {
    throw validationError("Invalid version.", "version");
  }
  if (version !== undefined) {
    input.version = version;
  }
  return input;
}
export function validateAddressId(req, res, next) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid address ID",
    });
  }
  next();
}
export function validateAddressDetails(req, res, next) {
  try {
    req.addressInput = checkAddressDetails(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      data: {
        fieldErrors: {
          [error.field || "form"]: [error.message],
        },
      },
      message: error.message,
    });
  }
  next();
}
export function validateAddressVersion(req, res, next) {
  try {
    req.addressInput = checkAddressVersion(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      data: {
        fieldErrors: {
          [error.field || "form"]: [error.message],
        },
      },
      message: error.message,
    });
  }
  next();
}
