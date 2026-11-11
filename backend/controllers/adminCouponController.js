import { makeServiceInput } from "./makeServiceInput.js";
import * as service from "../services/adminCouponService.js";
export async function listCoupons(req, res) {
  const result = await service.listCoupons(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function createCoupon(req, res) {
  const result = await service.createCoupon(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function editCoupon(req, res) {
  const result = await service.editCoupon(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function setCouponStatus(req, res) {
  const result = await service.setCouponStatus(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function deleteCoupon(req, res) {
  const result = await service.deleteCoupon(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function restoreCoupon(req, res) {
  const result = await service.restoreCoupon(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
