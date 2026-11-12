import { inputFrom } from "./requestInput.js";
import * as offers from "../services/campaignService.js";
import * as reports from "../services/salesReportService.js";
export async function listOffers(req, res) {
  const result = await offers.listOffers(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function listTargets(req, res) {
  const result = await offers.listTargets(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function createOffer(req, res) {
  const result = await offers.createOffer(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function editOffer(req, res) {
  const result = await offers.editOffer(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function setOfferStatus(req, res) {
  const result = await offers.setOfferStatus(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function salesReport(req, res) {
  const result = await reports.salesReport(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function exportSales(req, res) {
  const result = await reports.exportSales(inputFrom(req));
  return res.attachment(result.filename).type("text/csv").send(result.bytes);
}


