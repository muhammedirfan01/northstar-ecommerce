import { validationError } from "../utils/validation.js";
export function checkCategoryInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["name", "parentId", "isListed", "keepImage"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let name = original.name;
  if (typeof name !== "string") {
    throw validationError("Invalid name.", "name");
  }
  name = name.trim();
  if (name.length < 2) {
    throw validationError(
      "Enter a category name with at least 2 characters.",
      "name",
    );
  }
  if (name.length > 80) {
    throw validationError("Invalid name.", "name");
  }
  input.name = name;
  let parentId = original.parentId;
  if (parentId === undefined) {
    parentId = "";
  } else {
    if (!(parentId === "")) {
      if (typeof parentId !== "string") {
        throw validationError("Invalid parentId.", "parentId");
      }
      if (!/^[a-f0-9]{24}$/i.test(parentId)) {
        throw validationError("Invalid catalog ID.", "parentId");
      }
    }
  }
  if (parentId !== undefined) {
    input.parentId = parentId;
  }
  const isListed = original.isListed;
  if (typeof isListed !== "boolean") {
    throw validationError("Invalid isListed.", "isListed");
  }
  input.isListed = isListed;
  const keepImage = original.keepImage;
  if (typeof keepImage !== "boolean") {
    throw validationError("Invalid keepImage.", "keepImage");
  }
  input.keepImage = keepImage;
  if (input.parentId) {
    input.parentId = input.parentId.toLowerCase();
  }
  return input;
}
export default function validateCategory(req, res, next) {
  try {
    let input = req.body;
    if (typeof req.body?.data === "string") {
      input = JSON.parse(req.body.data);
    }
    const checked = checkCategoryInput(input);
    if (req.files && req.files.length > 1) {
      throw validationError("Choose only one category image.");
    }
    req.categoryInput = checked;
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof SyntaxError ? "Invalid form data." : error.message,
    });
  }
  next();
}
