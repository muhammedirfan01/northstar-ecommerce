import * as catalogStoreService from "../services/catalogStoreService.js";

export async function listCategories(_req, res) {
  const data = await catalogStoreService.listCategories();
  return res.json({ success: true, data });
}

export async function listProducts(req, res) {
  const data = await catalogStoreService.listProducts(req.catalogStoreQuery);
  return res.json({ success: true, data });
}

export async function getProduct(req, res) {
  const data = await catalogStoreService.getProduct(req.params.id);
  if (!data)
    return res.status(404).json({
      success: false,
      message: "This product is unavailable. Browse other products.",
    });
  return res.json({ success: true, data });
}
