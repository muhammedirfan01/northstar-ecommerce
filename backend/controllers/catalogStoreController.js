import { makeServiceInput } from "./makeServiceInput.js";
import * as storeService from "../services/storeService.js";

export async function listCategories(req, res) {
  const result = await storeService.listCategories(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listProducts(req, res) {
  const result = await storeService.listProducts(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getProduct(req, res) {
  const result = await storeService.getProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
