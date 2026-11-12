import { inputFrom } from "./requestInput.js";
import * as checkoutService from "../services/checkoutService.js";
import * as customerOrderService from "../services/customerOrderService.js";
import * as paymentService from "../services/paymentService.js";

export async function previewOrder(req, res) {
  const result = await checkoutService.previewOrder(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function placeOrder(req, res) {
  const result = await checkoutService.placeOrder(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function listOrders(req, res) {
  const result = await customerOrderService.listOrders(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function getOrder(req, res) {
  const result = await customerOrderService.getOrder(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function cancelOrder(req, res) {
  const result = await customerOrderService.cancelOrder(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function startPayment(req, res) {
  const result = await paymentService.startPayment(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function verifyPayment(req, res) {
  const result = await paymentService.verifyPayment(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function reconcilePayment(req, res) {
  const result = await paymentService.checkPaymentStatus(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function reconcileAdminPayment(req, res) {
  const result = await paymentService.checkPaymentStatus(
    inputFrom(req),
    true,
  );
  return res.status(result.status).json(result.body);
}

export { checkout } from "./orderValidationController.js";

export async function changePaymentMethod(req, res) {
  const result = await paymentService.changePaymentMethod(inputFrom(req));
  return res.status(result.status).json(result.body);
}
