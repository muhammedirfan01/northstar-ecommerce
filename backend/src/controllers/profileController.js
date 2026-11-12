import { inputFrom, inputWithUrl } from "./requestInput.js";
import * as profileService from "../services/profileService.js";
export async function getPhoto(req, res) {
  const photo = await profileService.getProfilePhoto(inputFrom(req));
  if (!photo)
    return res.status(404).json({
      success: false,
      message: "Photo not found.",
    });
  res.type("jpeg");
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  return res.send(photo);
}
export async function updateProfile(req, res) {
  const result = await profileService.updateProfile(inputWithUrl(req));
  return res.status(result.status).json(result.body);
}
