import User from "../models/User.js";
import { publicUser } from "../middlewares/auth.js";
import { saveProfile } from "../services/profileService.js";

export function getProfile(req, res) {
  return res.json({
    success: true,
    data: { user: publicUser(req.user) }
  });
}

export async function updateProfile(req, res) {
  const user = await saveProfile(req.user, req.body, req.file);
  return res.json({ success: true, message: "Profile updated.", data: { user: publicUser(user) } });
}

export async function getPhoto(req, res) {
  const photoPath = `/profile/photo/${req.params.version}`;

  if (req.user.profileImage !== photoPath) {
    return res.status(404).json({
      success: false,
      message: "Photo not found."
    });
  }

  const user = await User.findById(req.user.id).select("+profilePhoto");

  if (!user?.profilePhoto || user.profileImage !== photoPath) {
    return res.status(404).json({
      success: false,
      message: "Photo not found."
    });
  }

  res.type("jpeg");
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");

  return res.send(user.profilePhoto);
}