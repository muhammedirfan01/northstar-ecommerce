import { checkProfileDetails } from "../utils/validators/profile.js";
// Application steps. Input is a plain object; the controller sends the response.
import {
  uploadPreparedImages,
  removeCatalogImages,
} from "./catalogImageService.js";
import User from "../models/User.js";
import { activeAccountFilter } from "../utils/activeAccount.js";
import processProfilePhoto from "../services/profilePhotoService.js";
import { httpError } from "../utils/httpError.js";
import { publicUser } from "../utils/user.js";
export function getProfile(input) {
  return {
    status: 200,
    body: {
      success: true,
      data: {
        user: publicUser(input.user, input.apiBaseUrl),
      },
    },
  };
}
export async function updateProfile(input) {
  input.body = checkProfileDetails(input.body);
  const account = input.user;
  const details = input.body;
  const file = input.file;
  const changes = {
    name: details.name,
    phone: details.phone,
  };
  let uploaded = [];
  if (file) {
    let buffer;
    try {
      buffer = await processProfilePhoto(file.buffer);
    } catch {
      throw httpError("Invalid profile photo.");
    }
    uploaded = await uploadPreparedImages([buffer], "northstar/profiles");
    changes.profileImage = uploaded[0].url;
    changes.profileImagePublicId = uploaded[0].publicId;
  }
  const filter = activeAccountFilter(account.id, account.email, account.authVersion);
  if (file) {
    // Reject an older upload rather than replacing a more recently saved photo.
    filter.profileImage = account.profileImage || { $in: ["", null] };
  }
  let user;
  try {
    user = await User.findOneAndUpdate(
      filter,
      { $set: changes },
      { returnDocument: "after", runValidators: true },
    ).select("+passwordHash +googleId");
    if (!user) {
      throw httpError("Please refresh and try again.", 409);
    }
  } catch (error) {
    await removeCatalogImages(uploaded);
    throw error;
  }
  // Delete the previous app-owned photo only after the new URL is saved.
  if (file && account.profileImagePublicId) {
    await removeCatalogImages([{ publicId: account.profileImagePublicId }]);
  }
  const responseData = user;
  return {
    status: 200,
    body: {
      success: true,
      message: "Profile updated.",
      data: {
        user: publicUser(responseData, input.apiBaseUrl),
      },
    },
  };
}
export async function getProfilePhoto(input) {
  const photoPath = `/profile/photo/${input.params.version}`;
  if (input.user.profileImage !== photoPath) {
    return null;
  }
  const user = await User.findById(input.user.id).select("+profilePhoto");
  if (!user?.profilePhoto || user.profileImage !== photoPath) {
    return null;
  }
  return user.profilePhoto;
}
