import * as productService from "../services/productService.js";

export async function listProducts(req, res) {
  const data = await productService.listProducts(req.catalogQuery);
  return res.json({ success: true, data });
}
export async function getProduct(req, res) {
  const product = await productService.getProduct(req.params.id);
  return res.json({ success: true, data: { product } });
}
export async function saveProduct(req, res) {
  const product = await productService.saveProduct(
    req.params.id,
    req.catalogInput,
    req.files || [],
  );
  return res
    .status(req.params.id ? 200 : 201)
    .json({ success: true, message: "Product saved.", data: { product } });
}
export async function setProductListed(req, res) {
  const product = await productService.setProductListed(
    req.params.id,
    req.catalogInput.isListed,
  );
  return res.json({ success: true, data: { product } });
}
export async function deleteProduct(req, res) {
  await productService.deleteProduct(req.params.id);
  return res.json({ success: true, message: "Product permanently deleted." });
}
export async function saveVariant(req, res) {
  const product = await productService.saveVariant(
    req.params.id,
    req.params.variantId,
    req.catalogInput,
    req.files || [],
  );
  return res
    .status(req.params.variantId ? 200 : 201)
    .json({ success: true, data: { product } });
}
export async function deleteVariant(req, res) {
  const product = await productService.deleteVariant(
    req.params.id,
    req.params.variantId,
  );
  return res.json({ success: true, data: { product } });
}
