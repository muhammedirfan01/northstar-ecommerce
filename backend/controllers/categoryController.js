import { makeServiceInput } from "./makeServiceInput.js";
import * as categoryService from "../services/categoryService.js";

export async function addCategory(req, res) {
  const result = await categoryService.addCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function listCategories(req, res) {
  const result = await categoryService.listCategories(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function saveCategory(req, res) {
  const result = await categoryService.saveCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function setCategoryListed(req, res) {
  const result = await categoryService.setCategoryListed(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function deleteCategory(req, res) {
  const result = await categoryService.deleteCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function restoreCategory(req, res) {
  const result = await categoryService.restoreCategory(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

