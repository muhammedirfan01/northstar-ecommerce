import * as categoryService from "../services/categoryService.js";
import { checkCategoryInput } from "../utils/validators/category.js";

export async function addCategory(req, res) {
  const result = await categoryService.addCategory({
    body: req.body,
    files: req.files,
  });
  return res.status(result.status).json(result.body);
}

export async function listCategories(req, res) {
  const result = await categoryService.listCategories({
    query: req.query,
  });
  return res.status(result.status).json(result.body);
}

export async function saveCategory(req, res) {
  const result = await categoryService.saveCategory({
    params: req.params,
    body: req.body,
    files: req.files,
  });
  return res.status(result.status).json(result.body);
}

export async function setCategoryListed(req, res) {
  const result = await categoryService.setCategoryListed({
    params: req.params,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function deleteCategory(req, res) {
  const result = await categoryService.deleteCategory({
    body: req.body,
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}

export async function restoreCategory(req, res) {
  const result = await categoryService.restoreCategory({
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}

