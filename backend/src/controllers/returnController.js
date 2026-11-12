import { inputFrom } from "./requestInput.js";
import * as returnService from "../services/returnService.js";
import * as refundService from "../services/refundService.js";
import { getReturnPhoto as readPhoto } from "../services/returnPhotoService.js";

async function sendPhoto(req, res, admin) {
  const photo = await readPhoto(inputFrom(req), admin);
  res.set({
    "Content-Type": "image/jpeg",
    "Content-Disposition": `inline; filename="${photo.filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  return res.status(200).send(photo.bytes);
}
export const getReturnPhoto = (req, res) => sendPhoto(req, res, false);
export const getAdminReturnPhoto = (req, res) => sendPhoto(req, res, true);

export async function requestReturn(req, res) {
  const result = await returnService.requestReturn(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function cancelReturn(req, res) {
  const result = await returnService.cancelReturn(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function reviewReturn(req, res) {
  const result = await returnService.reviewReturn(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function completeReturn(req, res) {
  const result = await returnService.completeReturn(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function updateReplacement(req, res) {
  const result = await returnService.updateReplacement(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function processRefund(req, res) {
  const result = await refundService.processRefund(inputFrom(req));
  return res.status(result.status).json(result.body);
}
