import { makeServiceInput } from "./makeServiceInput.js";
import * as checkoutService from "../services/checkoutService.js";
import * as customerOrderService from "../services/customerOrderService.js";
import * as paymentService from "../services/paymentService.js";

export async function preview(req, res) {
  const result = await checkoutService.preview(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function placeOrder(req, res) {
  const result = await checkoutService.placeOrder(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listOrders(req, res) {
  const result = await customerOrderService.listOrders(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getOrder(req, res) {
  const result = await customerOrderService.getOrder(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function cancelOrder(req, res) {
  const result = await customerOrderService.cancelOrder(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function startPayment(req, res) {
  const result = await paymentService.startPayment(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function verifyPayment(req, res) {
  const result = await paymentService.verifyPayment(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function reconcilePayment(req, res) {
  const result = await paymentService.reconcilePayment(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function reconcileAdminPayment(req, res) {
  const result = await paymentService.reconcilePayment(
    makeServiceInput(req),
    true,
  );
  return res.status(result.status).json(result.body);
}

export { checkout } from "./orderValidationController.js";

export async function changePaymentMethod(req, res) {
  const result = await paymentService.changePaymentMethod(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
