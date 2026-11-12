import { inputFrom, inputWithUrl } from "./requestInput.js";
import * as adminService from "../services/adminService.js";
export async function getCustomerPhoto(req, res) {
  const photo = await adminService.getCustomerPhoto(inputFrom(req));
  if (!photo)
    return res.status(404).json({
      success: false,
      message: "Photo not found.",
    });
  res.set({
    "Content-Type": "image/jpeg",
    "X-Content-Type-Options": "nosniff",
  });
  return res.send(photo);
}
export async function getCustomers(req, res) {
  const result = await adminService.getCustomers(inputWithUrl(req));
  return res.status(result.status).json(result.body);
}
export async function setCustomerStatus(req, res) {
  const result = await adminService.setCustomerStatus(inputWithUrl(req));
  return res.status(result.status).json(result.body);
}
export async function getCustomer(req, res) {
  const result = await adminService.getCustomer(inputWithUrl(req));
  return res.status(result.status).json(result.body);
}
export async function deleteCustomer(req, res) {
  const result = await adminService.deleteCustomer(inputWithUrl(req));
  return res.status(result.status).json(result.body);
}
export async function restoreCustomer(req, res) {
  const result = await adminService.restoreCustomer(inputWithUrl(req));
  return res.status(result.status).json(result.body);
}
export async function getDashboard(req, res) {
  const result = await adminService.getDashboard(inputFrom(req));
  return res.status(result.status).json(result.body);
}
