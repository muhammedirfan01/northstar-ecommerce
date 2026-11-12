// Add, edit and remove saved addresses. Check each address before saving it.

import { validatePostalAddress } from "./postalService.js";
import { Types } from "mongoose";
import User from "../models/User.js";
import { getActiveUserFilter } from "../utils/activeAccount.js";
import { createError } from "../utils/httpError.js";
import { createValidationError } from "../utils/validation.js";
import { validateFormFields, validateText, validateChoice, validateBoolean } from "../utils/formValidation.js";
import { validateAddressVersion } from "../utils/accountValidation.js";

const ADDRESS_FIELDS = "+addresses +defaultAddressId +addressVersion";
function formatAddresses(user) {
  const addresses = [];
  for (const address of user.addresses) {
    addresses.push({
      ...address,
      id: String(address._id),
      isDefault: String(address._id) === String(user.defaultAddressId),
    });
  }
  return {
    version: user.addressVersion ?? 0,
    maxAddresses: 10,
    addresses,
  };
}
async function loadAddresses(requestData) {
  const user = await User.findById(requestData.user.id).select(ADDRESS_FIELDS).lean();
  if (!user) {
    throw createError("Please sign in again.", 401);
  }
  if (requestData.data && (user.addressVersion ?? 0) !== requestData.data.version) {
    throw createError(
      "Your addresses changed. Reload them before continuing.",
      409,
    );
  }
  return user;
}
async function saveAddresses(requestData, user, status, message) {
  const version = requestData.data.version;
  const filter = getActiveUserFilter(
    requestData.user.id,
    requestData.user.email,
    requestData.user.authVersion,
  );

  // Older users may have no addressVersion field. Treat that as version zero.
  if (version === 0) {
    filter.$and = [
      {
        $or: [
          {
            addressVersion: 0,
          },
          {
            addressVersion: {
              $exists: false,
            },
          },
        ],
      },
    ];
  } else {
    filter.$and = [
      {
        addressVersion: version,
      },
    ];
  }

  // Check the version in the update itself so two saves cannot overwrite each other.
  const updated = await User.findOneAndUpdate(
    filter,
    {
      $set: {
        addresses: user.addresses,
        defaultAddressId: user.defaultAddressId,
      },
      $inc: {
        addressVersion: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  )
    .select(ADDRESS_FIELDS)
    .lean();
  if (!updated) {
    throw createError("Your account or addresses changed. Please reload.", 409);
  }
  return {
    status,
    body: {
      success: true,
      message,
      data: formatAddresses(updated),
    },
  };
}
export async function getAddresses(requestData) {
  const user = await loadAddresses(requestData);
  return {
    status: 200,
    body: {
      success: true,
      data: formatAddresses(user),
    },
  };
}
export async function addAddress(requestData) {
  requestData.data = getAddressForm(requestData.body);
  const user = await loadAddresses(requestData);
  if (user.addresses.length >= 10) {
    throw createError("Maximum 10 addresses allowed.");
  }
  await validatePostalAddress(requestData.data);
  const { version, isDefault, ...details } = requestData.data;
  const address = {
    ...details,
    _id: new Types.ObjectId(),
    country: "IN",
  };
  user.addresses.push(address);
  if (isDefault || user.addresses.length === 1) {
    user.defaultAddressId = address._id;
  }
  return saveAddresses(requestData, user, 201, "Address added.");
}
export async function editAddress(requestData) {
  validateAddressId(requestData.params);
  requestData.data = getAddressForm(requestData.body);
  const user = await loadAddresses(requestData);
  const address = user.addresses.find(
    (item) => String(item._id) === requestData.params.id.toLowerCase(),
  );
  if (!address) {
    throw createError("Address not found.", 404);
  }
  await validatePostalAddress(requestData.data);
  const details = requestData.data;
  address.fullName = details.fullName;
  address.phoneNumber = details.phoneNumber;
  address.addressLine1 = details.addressLine1;
  address.addressLine2 = details.addressLine2;
  address.city = details.city;
  address.state = details.state;
  address.postalCode = details.postalCode;
  address.label = details.label;
  if (details.isDefault) {
    user.defaultAddressId = address._id;
  }
  return saveAddresses(requestData, user, 200, "Address updated.");
}
export async function deleteAddress(requestData) {
  validateAddressId(requestData.params);
  requestData.data = getAddressForm(requestData.body, true);
  const user = await loadAddresses(requestData);
  const index = user.addresses.findIndex(
    (item) => String(item._id) === requestData.params.id.toLowerCase(),
  );
  if (index === -1) {
    throw createError("Address not found.", 404);
  }
  const [removed] = user.addresses.splice(index, 1);
  if (String(user.defaultAddressId) === String(removed._id)) {
    user.defaultAddressId = user.addresses[0]?._id || null;
  }
  return saveAddresses(requestData, user, 200, "Address deleted.");
}
export async function setDefaultAddress(requestData) {
  validateAddressId(requestData.params);
  requestData.data = getAddressForm(requestData.body, true);
  const user = await loadAddresses(requestData);
  const address = user.addresses.find(
    (item) => String(item._id) === requestData.params.id.toLowerCase(),
  );
  if (!address) {
    throw createError("Address not found.", 404);
  }
  user.defaultAddressId = address._id;
  return saveAddresses(requestData, user, 200, "Default address updated.");
}

export function validateAddressForm(formData) {
  validateFormFields(formData, [
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
  const fullName = validateText(formData.fullName, "fullName", 2, 80);
  if (typeof formData.phoneNumber !== "string")
    throw createValidationError("Invalid phoneNumber.", "phoneNumber");
  let phoneNumber = formData.phoneNumber.trim();
  if (!/^(\+91)?[6-9]\d{9}$/.test(phoneNumber)) {
    throw createValidationError("Invalid phoneNumber.", "phoneNumber");
  }
  if (!phoneNumber.startsWith("+91")) phoneNumber = "+91" + phoneNumber;
  const addressLine1 = validateText(formData.addressLine1, "addressLine1", 5, 160);
  let addressLine2 = "";
  if (formData.addressLine2 !== undefined)
    addressLine2 = validateText(formData.addressLine2, "addressLine2", 0, 100);
  const city = validateText(formData.city, "city", 2, 80);
  const state = validateText(formData.state, "state", 2, 80);
  const postalCode = validateText(formData.postalCode, "postalCode", 0, Infinity);
  if (!/^[1-9]\d{5}$/.test(postalCode))
    throw createValidationError("Invalid postalCode.", "postalCode");
  const result = {
    fullName,
    phoneNumber,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
  };
  if (formData.country !== undefined)
    result.country = validateChoice(formData.country, "country", ["IN"]);
  result.label = "Home";
  if (formData.label !== undefined)
    result.label = validateChoice(formData.label, "label", ["Home", "Work", "Other"]);
  result.isDefault = false;
  if (formData.isDefault !== undefined)
    result.isDefault = validateBoolean(formData.isDefault, "isDefault");
  result.version = validateAddressVersion(formData.version);
  return result;
}
export function validateAddressUpdate(formData) {
  validateFormFields(formData, ["version"]);
  return {
    version: validateAddressVersion(formData.version),
  };
}

export function validateAddressId(params) {
  if (!/^[a-f0-9]{24}$/i.test(params?.id)) {
    const error = createValidationError("Invalid address ID");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}

export function getAddressForm(body, versionOnly = false) {
  try {
    if (versionOnly) return validateAddressUpdate(body);
    return validateAddressForm(body);
  } catch (error) {
    error.code = "VALIDATION_ERROR";
    error.data = { fieldErrors: { [error.field || "form"]: [error.message] } };
    throw error;
  }
}
