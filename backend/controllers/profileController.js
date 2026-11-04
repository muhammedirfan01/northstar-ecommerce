import { randomUUID } from "node:crypto";
import User from "../models/User.js";
import { activeAccountFilter } from "../utils/activeAccount.js";
import processProfilePhoto from "../services/profilePhotoService.js";
import { httpError } from "../utils/httpError.js";
import { publicUser } from "../middlewares/auth.js";
export function getProfile(req, res) {
  return res.json({
    success: true,
    data: {
      user: publicUser(req.user),
    },
  });
}
export async function updateProfile(req, res) {
  const account = req.user;
  const details = req.body;
  const file = req.file;
  const changes = {
    name: details.name,
    phone: details.phone,
  };
  if (file) {
    try {
      changes.profilePhoto = await processProfilePhoto(file.buffer);
      changes.profileImage = `/profile/photo/${randomUUID()}`;
    } catch {
      throw httpError("Invalid profile photo.");
    }
  }
  const user = await User.findOneAndUpdate(
    activeAccountFilter(account.id, account.email, account.authVersion),
    {
      $set: changes,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  ).select("+passwordHash +googleId");
  if (!user) {
    throw httpError("Please refresh and try again.", 409);
  }
  const responseData = user;
  return res.json({
    success: true,
    message: "Profile updated.",
    data: {
      user: publicUser(responseData),
    },
  });
}
export async function getPhoto(req, res) {
  const photoPath = `/profile/photo/${req.params.version}`;
  if (req.user.profileImage !== photoPath) {
    return res.status(404).json({
      success: false,
      message: "Photo not found.",
    });
  }
  const user = await User.findById(req.user.id).select("+profilePhoto");
  if (!user?.profilePhoto || user.profileImage !== photoPath) {
    return res.status(404).json({
      success: false,
      message: "Photo not found.",
    });
  }
  res.type("jpeg");
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  return res.send(user.profilePhoto);
}
