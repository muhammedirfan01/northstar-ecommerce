import * as variantService from "../services/variantService.js";
import * as productService from "../services/productService.js";

export async function listProducts(req, res) {
  const result = await productService.listProducts({
    query: req.query,
  });
  return res.status(result.status).json(result.body);
}

export async function getProduct(req, res) {
  const result = await productService.getProduct({
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}

export async function saveProduct(req, res) {
  const result = await productService.saveProduct({
    params: req.params,
    body: req.body,
    files: req.files,
  });
  return res.status(result.status).json(result.body);
}

export async function setProductListed(req, res) {
  const result = await productService.setProductListed({
    params: req.params,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function deleteProduct(req, res) {
  const result = await productService.deleteProduct({
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}

export async function saveVariant(req, res) {
  const result = await variantService.saveVariant({
    params: req.params,
    body: req.body,
    files: req.files,
  });
  return res.status(result.status).json(result.body);
}

export async function deleteVariant(req, res) {
  const result = await variantService.deleteVariant({
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}

export async function restoreProduct(req, res) {
  const result = await productService.restoreProduct({
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}
