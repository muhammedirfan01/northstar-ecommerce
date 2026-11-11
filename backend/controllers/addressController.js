import { makeServiceInput } from "./makeServiceInput.js";
import * as addressService from "../services/addressService.js";

export async function getAddresses(req, res) {
  const result = await addressService.getAddresses(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function addAddress(req, res) {
  const result = await addressService.addAddress(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function editAddress(req, res) {
  const result = await addressService.editAddress(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function deleteAddress(req, res) {
  const result = await addressService.deleteAddress(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function setDefaultAddress(req, res) {
  const result = await addressService.setDefaultAddress(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
