import * as profileService from "../services/profileService.js";
export async function getPhoto(req, res) {
  const photo = await profileService.getProfilePhoto({
    user: req.user,
    params: req.params,
  });
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
  const result = await profileService.getProfile({
    user: req.user,
    apiBaseUrl: req.headers?.host
      ? `${req.protocol || "http"}://${req.headers.host}/api`
      : "",
  });
  return res.status(result.status).json(result.body);
}
export async function updateProfile(req, res) {
  const result = await profileService.updateProfile({
    user: req.user,
    body: req.body,
    file: req.file,
    apiBaseUrl: req.headers?.host
      ? `${req.protocol || "http"}://${req.headers.host}/api`
      : "",
  });
  return res.status(result.status).json(result.body);
}
