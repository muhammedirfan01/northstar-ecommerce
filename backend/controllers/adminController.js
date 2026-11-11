import { makeServiceInput, makePublicServiceInput } from "./makeServiceInput.js";
import { publicUser } from "../utils/user.js";
import * as adminService from "../services/adminService.js";
export async function getCustomerPhoto(req, res) {
  const photo = await adminService.getCustomerPhoto(makeServiceInput(req));
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
  const result = await adminService.getCustomers(makePublicServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function setCustomerStatus(req, res) {
  const result = await adminService.setCustomerStatus(makePublicServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function getCustomer(req, res) {
  const result = await adminService.getCustomer(makePublicServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function deleteCustomer(req, res) {
  const result = await adminService.deleteCustomer(makePublicServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function restoreCustomer(req, res) {
  const result = await adminService.restoreCustomer(makePublicServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function getDashboard(req, res) {
  const result = await adminService.getDashboard(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export function getCurrentAdmin(req, res) {
  return res.json({
    success: true,
    data: {
      user: publicUser(
        req.user,
        req.headers?.host
          ? `${req.protocol || "http"}://${req.headers.host}/api`
          : "",
      ),
    },
  });
}
