import { inputFrom } from "./requestInput.js";
import * as payments from "../services/adminPaymentService.js";
import * as adjustments from "../services/stockAdjustmentService.js";
import * as exports from "../services/adminExportService.js";
export async function listPayments(req, res) {
  const result = await payments.listPayments(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function adjustStock(req, res) {
  const result = await adjustments.adjustStock(inputFrom(req));
  return res.status(result.status).json(result.body);
}
async function sendExport(req, res, kind) {
  const result = await exports.exportAdminData(inputFrom(req), kind);
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${result.filename}"`,
  });
  return res.status(200).send(result.bytes);
}
export const exportOrders = (req, res) => sendExport(req, res, "orders");
export const exportPayments = (req, res) => sendExport(req, res, "payments");
export const exportInventory = (req, res) => sendExport(req, res, "inventory");
