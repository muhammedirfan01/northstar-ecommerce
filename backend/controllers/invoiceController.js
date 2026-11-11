import { makeServiceInput } from "./makeServiceInput.js";
import * as invoiceService from "../services/invoiceService.js";

async function sendInvoice(req, res, admin) {
  const invoice = await invoiceService.getInvoice(makeServiceInput(req), admin);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${invoice.filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  return res.status(200).send(invoice.bytes);
}
export const getInvoice = (req, res) => sendInvoice(req, res, false);
export const getAdminInvoice = (req, res) => sendInvoice(req, res, true);
