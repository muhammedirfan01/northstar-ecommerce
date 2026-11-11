import { makeServiceInput } from "./makeServiceInput.js";
import * as variantService from "../services/variantService.js";
import * as productService from "../services/productService.js";

export async function listProducts(req, res) {
  const result = await productService.listProducts(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getProduct(req, res) {
  const result = await productService.getProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function saveProduct(req, res) {
  const result = await productService.saveProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function setProductListed(req, res) {
  const result = await productService.setProductListed(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function deleteProduct(req, res) {
  const result = await productService.deleteProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function saveVariant(req, res) {
  const result = await variantService.saveVariant(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function deleteVariant(req, res) {
  const result = await variantService.deleteVariant(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function restoreProduct(req, res) {
  const result = await productService.restoreProduct(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
