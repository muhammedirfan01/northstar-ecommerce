import { validatePostalAddress } from "./postalService.js";
import {
  readAddressForm,
  checkAddressId,
} from "../utils/validators/address.js";
import { Types } from "mongoose";
import User from "../models/User.js";
import { activeAccountFilter } from "../utils/activeAccount.js";
import { httpError } from "../utils/httpError.js";
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
async function loadAddresses(input) {
  const user = await User.findById(input.user.id).select(ADDRESS_FIELDS).lean();
  if (!user) {
    throw httpError("Please sign in again.", 401);
  }
  if (input.data && (user.addressVersion ?? 0) !== input.data.version) {
    throw httpError(
      "Your addresses changed. Reload them before continuing.",
      409,
    );
  }
  return user;
}
async function saveAddresses(input, user, status, message) {
  const version = input.data.version;
  const filter = activeAccountFilter(
    input.user.id,
    input.user.email,
    input.user.authVersion,
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
    throw httpError("Your account or addresses changed. Please reload.", 409);
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
export async function getAddresses(input) {
  const user = await loadAddresses(input);
  return {
    status: 200,
    body: {
      success: true,
      data: formatAddresses(user),
    },
  };
}
export async function addAddress(input) {
  input.data = readAddressForm(input.body);
  const user = await loadAddresses(input);
  if (user.addresses.length >= 10) {
    throw httpError("Maximum 10 addresses allowed.");
  }
  await validatePostalAddress(input.data);
  const { version, isDefault, ...details } = input.data;
  const address = {
    ...details,
    _id: new Types.ObjectId(),
    country: "IN",
  };
  user.addresses.push(address);
  if (isDefault || user.addresses.length === 1) {
    user.defaultAddressId = address._id;
  }
  return saveAddresses(input, user, 201, "Address added.");
}
export async function editAddress(input) {
  checkAddressId(input.params);
  input.data = readAddressForm(input.body);
  const user = await loadAddresses(input);
  const address = user.addresses.find(
    (item) => String(item._id) === input.params.id.toLowerCase(),
  );
  if (!address) {
    throw httpError("Address not found.", 404);
  }
  await validatePostalAddress(input.data);
  const details = input.data;
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
  return saveAddresses(input, user, 200, "Address updated.");
}
export async function deleteAddress(input) {
  checkAddressId(input.params);
  input.data = readAddressForm(input.body, true);
  const user = await loadAddresses(input);
  const index = user.addresses.findIndex(
    (item) => String(item._id) === input.params.id.toLowerCase(),
  );
  if (index === -1) {
    throw httpError("Address not found.", 404);
  }
  const [removed] = user.addresses.splice(index, 1);
  if (String(user.defaultAddressId) === String(removed._id)) {
    user.defaultAddressId = user.addresses[0]?._id || null;
  }
  return saveAddresses(input, user, 200, "Address deleted.");
}
export async function setDefaultAddress(input) {
  checkAddressId(input.params);
  input.data = readAddressForm(input.body, true);
  const user = await loadAddresses(input);
  const address = user.addresses.find(
    (item) => String(item._id) === input.params.id.toLowerCase(),
  );
  if (!address) {
    throw httpError("Address not found.", 404);
  }
  user.defaultAddressId = address._id;
  return saveAddresses(input, user, 200, "Default address updated.");
}
