import { inputFrom } from "./requestInput.js";
import * as supportService from "../services/supportService.js";
import * as walletService from "../services/walletService.js";
import * as postalService from "../services/postalService.js";

export async function getContact(req, res) {
  const result = await supportService.getContact(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function sendMessage(req, res) {
  const result = await supportService.sendMessage(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function getWallet(req, res) {
  const result = await walletService.getWallet(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function getPostalLocation(req, res) {
  const result = await postalService.getPostalLocation(inputFrom(req));
  return res.status(result.status).json(result.body);
}
