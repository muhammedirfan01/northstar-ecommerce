import { inputFrom } from "./requestInput.js";
import * as categoryService from "../services/categoryService.js";

export async function addCategory(req, res) {
  const result = await categoryService.addCategory(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function listCategories(req, res) {
  const result = await categoryService.listCategories(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function saveCategory(req, res) {
  const result = await categoryService.saveCategory(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function setCategoryListed(req, res) {
  const result = await categoryService.setCategoryListed(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function deleteCategory(req, res) {
  const result = await categoryService.deleteCategory(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function restoreCategory(req, res) {
  const result = await categoryService.restoreCategory(inputFrom(req));
  return res.status(result.status).json(result.body);
}

