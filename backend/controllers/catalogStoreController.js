import * as storeService from "../services/storeService.js";

export async function listCategories(req, res) {
  const result = await storeService.listCategories({});
  return res.status(result.status).json(result.body);
}

export async function listProducts(req, res) {
  const result = await storeService.listProducts({
    query: req.query,
  });
  return res.status(result.status).json(result.body);
}

export async function getProduct(req, res) {
  const result = await storeService.getProduct({
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}
