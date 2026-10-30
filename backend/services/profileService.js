import { randomUUID } from "node:crypto";
import User from "../models/User.js";
import { activeAccountFilter } from "../utils/activeAccount.js";
import processProfilePhoto from "../utils/profilePhoto.js";
import { serviceError } from "../utils/serviceError.js";

export async function saveProfile(account, details, file) {
  const changes = {
    name: details.name,
    phone: details.phone
  };

  if (file) {
    try {
      changes.profilePhoto = await processProfilePhoto(file.buffer);
      changes.profileImage = `/profile/photo/${randomUUID()}`;
    } catch {
      throw serviceError("Invalid profile photo.");
    }
  }

  const user = await User.findOneAndUpdate(
    activeAccountFilter(account.id, account.email, account.authVersion),
    { $set: changes },
    { new: true, runValidators: true }
  ).select("+passwordHash +googleId");

  if (!user) {
    throw serviceError("Please refresh and try again.", 409);
  }

  return user;
}

