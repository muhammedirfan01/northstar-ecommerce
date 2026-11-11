import { makeServiceInput } from "./makeServiceInput.js";
import * as adminOrderService from "../services/adminOrderService.js";

export async function listOrders(req, res) {
  const result = await adminOrderService.listOrders(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getOrder(req, res) {
  const result = await adminOrderService.getOrder(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function cancelOrder(req, res) {
  const result = await adminOrderService.cancelOrder(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function updateOrderStatus(req, res) {
  const result = await adminOrderService.updateOrderStatus(
    makeServiceInput(req),
  );
  return res.status(result.status).json(result.body);
}

export async function markOrderPaid(req, res) {
  const result = await adminOrderService.markOrderPaid(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
