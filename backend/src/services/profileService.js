// Update profile details and load older profile photos.

import { uploadPreparedImages, removeCatalogImages } from "./catalogImageService.js";
import User from "../models/User.js";
import { getActiveUserFilter } from "../utils/activeAccount.js";
import processProfilePhoto from "./profilePhotoService.js";
import { createError } from "../utils/httpError.js";
import { formatUser } from "../utils/user.js";
import { createValidationError } from "../utils/validation.js";
import { getNameError } from "../utils/nameValidation.js";
import { validateFormFields } from "../utils/formValidation.js";

// The controller passes request data here and sends the result back to the browser.

export async function updateProfile(requestData) {
  requestData.body = validateProfileForm(requestData.body);
  const account = requestData.user;
  const details = requestData.body;
  const file = requestData.file;
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
      throw createError("Invalid profile photo.");
    }
    uploaded = await uploadPreparedImages([buffer], "northstar/profiles");
    changes.profileImage = uploaded[0].url;
    changes.profileImagePublicId = uploaded[0].publicId;
  }
  const filter = getActiveUserFilter(account.id, account.email, account.authVersion);
  if (file) {
    // Do not let an older upload replace a photo that was saved more recently.
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
      throw createError("Please refresh and try again.", 409);
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
        user: formatUser(responseData, requestData.apiBaseUrl),
      },
    },
  };
}
export async function getProfilePhoto(requestData) {
  const photoPath = `/profile/photo/${requestData.params.version}`;
  if (requestData.user.profileImage !== photoPath) {
    return null;
  }
  const user = await User.findById(requestData.user.id).select("+profilePhoto");
  if (!user?.profilePhoto || user.profileImage !== photoPath) {
    return null;
  }
  return user.profilePhoto;
}

export function validateProfileForm(formData) {
  validateFormFields(formData, ["name", "phone"]);
  const invalidName = getNameError(formData.name);
  if (invalidName) throw createValidationError(invalidName, "name");
  const name = formData.name.trim();
  if (typeof formData.phone !== "string")
    throw createValidationError("Invalid phone.", "phone");
  const phone = formData.phone.trim();
  if (
    phone.length > 25 ||
    (phone !== "" && !/^[+\d\s()-]{7,25}$/.test(phone))
  ) {
    throw createValidationError("Invalid phone.", "phone");
  }
  return {
    name,
    phone,
  };
}
