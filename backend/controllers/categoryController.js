import * as categoryService from "../services/categoryService.js";

export async function listCategories(req, res) {
  const data = await categoryService.listCategories(req.catalogQuery);
  return res.json({ success: true, data });
}
export async function saveCategory(req, res) {
  const category = await categoryService.saveCategory(
    req.params.id,
    req.catalogInput,
    req.files || [],
  );
  return res
    .status(req.params.id ? 200 : 201)
    .json({ success: true, message: "Category saved.", data: { category } });
}
export async function setCategoryListed(req, res) {
  const category = await categoryService.setCategoryListed(
    req.params.id,
    req.catalogInput.isListed,
  );
  return res.json({ success: true, data: { category } });
}
export async function deleteCategory(req, res) {
  if (req.body?.confirmDelete !== true)
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Confirm permanent deletion of this category, its subcategories and all their products.",
      });
  await categoryService.deleteCategory(req.params.id);
  return res.json({
    success: true,
    message: "Category and its products permanently deleted.",
  });
}
