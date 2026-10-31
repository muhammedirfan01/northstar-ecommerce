import { Types } from "mongoose";
import User from "../models/User.js";
import { activeAccountFilter } from "../utils/activeAccount.js";
const fields = "+addresses +defaultAddressId +addressVersion";
function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}
function formatAddresses(user) {
  return {
    version: user.addressVersion ?? 0,
    maxAddresses: 10,
    addresses: user.addresses.map(address => ({
      ...address,
      id: String(address._id),
      isDefault: String(address._id) === String(user.defaultAddressId),
    })),
  };
}
async function loadAddresses(req, res) {
  const user = await User.findById(req.user.id).select(fields).lean();
  if (!user) {
    fail(res, 401, "Please sign in again.");
    return null;
  }
  if (req.addressInput && (user.addressVersion ?? 0) !== req.addressInput.version) {
    fail(res, 409, "Your addresses changed. Reload them before continuing.");
    return null;
  }
  return user;
}

async function saveAddresses(req, res, user, status, message) {
  const version = req.addressInput.version;
  const filter = activeAccountFilter(req.user.id, req.user.email, req.user.authVersion);
  // Save only if another request has not changed these addresses.
  filter.$and = [version === 0
    ? { $or: [{ addressVersion: 0 }, { addressVersion: { $exists: false } }] }
    : { addressVersion: version }];

  const updated = await User.findOneAndUpdate(filter, {
    $set: { addresses: user.addresses, defaultAddressId: user.defaultAddressId },
    $inc: { addressVersion: 1 },
  }, { returnDocument: "after", runValidators: true }).select(fields).lean();

  if (!updated) return fail(res, 409, "Your account or addresses changed. Please reload.");
  return res.status(status).json({ success: true, message, data: formatAddresses(updated) });
}

export async function getAddresses(req, res) {
  const user = await loadAddresses(req, res);
  if (user) return res.json({ success: true, data: formatAddresses(user) });
}

export async function addAddress(req, res) {
  const user = await loadAddresses(req, res);
  if (!user) return;
  if (user.addresses.length >= 10) return fail(res, 400, "Maximum 10 addresses allowed.");
  const { version, isDefault, ...details } = req.addressInput;
  const address = { ...details, _id: new Types.ObjectId(), country: "IN" };
  user.addresses.push(address);
  if (isDefault || user.addresses.length === 1) user.defaultAddressId = address._id;
  return saveAddresses(req, res, user, 201, "Address added.");
}

export async function editAddress(req, res) {
  const user = await loadAddresses(req, res);
  if (!user) return;
  const address = user.addresses.find(item => String(item._id) === req.params.id.toLowerCase());
  if (!address) return fail(res, 404, "Address not found.");
  const { version, isDefault, ...details } = req.addressInput;
  Object.assign(address, details);
  if (isDefault) user.defaultAddressId = address._id;
  return saveAddresses(req, res, user, 200, "Address updated.");
}

export async function deleteAddress(req, res) {
  const user = await loadAddresses(req, res);
  if (!user) return;
  const index = user.addresses.findIndex(item => String(item._id) === req.params.id.toLowerCase());
  if (index === -1) return fail(res, 404, "Address not found.");
  const [removed] = user.addresses.splice(index, 1);
  if (String(user.defaultAddressId) === String(removed._id)) {
    user.defaultAddressId = user.addresses[0]?._id || null;
  }
  return saveAddresses(req, res, user, 200, "Address deleted.");
}

export async function setDefaultAddress(req, res) {
  const user = await loadAddresses(req, res);
  if (!user) return;
  const address = user.addresses.find(item => String(item._id) === req.params.id.toLowerCase());
  if (!address) return fail(res, 404, "Address not found.");
  user.defaultAddressId = address._id;
  return saveAddresses(req, res, user, 200, "Default address updated.");
}