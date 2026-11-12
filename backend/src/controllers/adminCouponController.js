import { inputFrom } from "./requestInput.js";
import * as service from "../services/adminCouponService.js";
export async function listCoupons(req, res) {
  const result = await service.listCoupons(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function createCoupon(req, res) {
  const result = await service.createCoupon(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function editCoupon(req, res) {
  const result = await service.editCoupon(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function setCouponStatus(req, res) {
  const result = await service.setCouponStatus(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function deleteCoupon(req, res) {
  const result = await service.deleteCoupon(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function restoreCoupon(req, res) {
  const result = await service.restoreCoupon(inputFrom(req));
  return res.status(result.status).json(result.body);
}
