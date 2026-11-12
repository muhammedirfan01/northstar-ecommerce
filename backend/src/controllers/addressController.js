import { inputFrom } from "./requestInput.js";
import * as addressService from "../services/addressService.js";

export async function getAddresses(req, res) {
  const result = await addressService.getAddresses(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function addAddress(req, res) {
  const result = await addressService.addAddress(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function editAddress(req, res) {
  const result = await addressService.editAddress(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function deleteAddress(req, res) {
  const result = await addressService.deleteAddress(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function setDefaultAddress(req, res) {
  const result = await addressService.setDefaultAddress(inputFrom(req));
  return res.status(result.status).json(result.body);
}
