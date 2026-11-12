import { inputFrom } from "./requestInput.js";
import * as variantService from "../services/variantService.js";
import * as productService from "../services/productService.js";

export async function listProducts(req, res) {
  const result = await productService.listProducts(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function getProduct(req, res) {
  const result = await productService.getProduct(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function saveProduct(req, res) {
  const result = await productService.saveProduct(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function setProductListed(req, res) {
  const result = await productService.setProductListed(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function deleteProduct(req, res) {
  const result = await productService.deleteProduct(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function saveVariant(req, res) {
  const result = await variantService.saveVariant(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function deleteVariant(req, res) {
  const result = await variantService.deleteVariant(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function restoreProduct(req, res) {
  const result = await productService.restoreProduct(inputFrom(req));
  return res.status(result.status).json(result.body);
}
