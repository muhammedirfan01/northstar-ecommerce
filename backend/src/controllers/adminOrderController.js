import { inputFrom } from "./requestInput.js";
import * as adminOrderService from "../services/adminOrderService.js";

export async function listOrders(req, res) {
  const result = await adminOrderService.listOrders(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function getOrder(req, res) {
  const result = await adminOrderService.getOrder(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function cancelOrder(req, res) {
  const result = await adminOrderService.cancelOrder(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function updateOrderStatus(req, res) {
  const result = await adminOrderService.updateOrderStatus(
    inputFrom(req),
  );
  return res.status(result.status).json(result.body);
}

export async function markOrderPaid(req, res) {
  const result = await adminOrderService.markOrderPaid(inputFrom(req));
  return res.status(result.status).json(result.body);
}
