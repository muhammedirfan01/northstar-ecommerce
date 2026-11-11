import { makeServiceInput, makePublicServiceInput } from "./makeServiceInput.js";
import * as profileService from "../services/profileService.js";
export async function getPhoto(req, res) {
  const photo = await profileService.getProfilePhoto(makeServiceInput(req));
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
export async function getProfile(req, res) {
  const result = await profileService.getProfile(makePublicServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function updateProfile(req, res) {
  const result = await profileService.updateProfile(makePublicServiceInput(req));
  return res.status(result.status).json(result.body);
}
