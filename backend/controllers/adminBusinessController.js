import { makeServiceInput } from "./makeServiceInput.js";
import * as settings from "../services/settingsService.js";
import * as offers from "../services/campaignService.js";
import * as reports from "../services/salesReportService.js";
export async function getSettings(req, res) {
  const result = await settings.getSettings(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function updateSettings(req, res) {
  const result = await settings.updateSettings(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function listOffers(req, res) {
  const result = await offers.listOffers(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function listTargets(req, res) {
  const result = await offers.listTargets(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function createOffer(req, res) {
  const result = await offers.createOffer(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function editOffer(req, res) {
  const result = await offers.editOffer(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function setOfferStatus(req, res) {
  const result = await offers.setOfferStatus(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function salesReport(req, res) {
  const result = await reports.salesReport(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function exportSales(req, res) {
  const result = await reports.exportSales(makeServiceInput(req));
  return res.attachment(result.filename).type("text/csv").send(result.bytes);
}
