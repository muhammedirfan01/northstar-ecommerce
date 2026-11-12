import { inputFrom } from "./requestInput.js";
import * as storeService from "../services/storeService.js";

export async function listCategories(req, res) {
  const result = await storeService.listCategories(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function listProducts(req, res) {
  const result = await storeService.listProducts(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function getProduct(req, res) {
  const result = await storeService.getProduct(inputFrom(req));
  return res.status(result.status).json(result.body);
}
