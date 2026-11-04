import { validationError } from "../utils/validation.js";
export function checkReviewInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (
      !["rating", "title", "text", "recommends", "retainedImageIds"].includes(
        field,
      )
    ) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const rating = original.rating;
  if (typeof rating !== "number" || !Number.isFinite(rating)) {
    throw validationError("Invalid rating.", "rating");
  }
  if (!Number.isSafeInteger(rating)) {
    throw validationError("Invalid rating.", "rating");
  }
  if (rating < 1) {
    throw validationError("Invalid rating.", "rating");
  }
  if (rating > 5) {
    throw validationError("Invalid rating.", "rating");
  }
  if (rating !== undefined) {
    input.rating = rating;
  }
  let title = original.title;
  if (typeof title !== "string") {
    throw validationError("Invalid title.", "title");
  }
  title = title.trim();
  if (title.length < 2) {
    throw validationError("Invalid title.", "title");
  }
  if (title.length > 100) {
    throw validationError("Invalid title.", "title");
  }
  input.title = title;
  let text = original.text;
  if (typeof text !== "string") {
    throw validationError("Invalid text.", "text");
  }
  text = text.trim();
  if (text.length < 10) {
    throw validationError("Invalid text.", "text");
  }
  if (text.length > 1000) {
    throw validationError("Invalid text.", "text");
  }
  input.text = text;
  const recommends = original.recommends;
  if (typeof recommends !== "boolean") {
    throw validationError("Invalid recommends.", "recommends");
  }
  input.recommends = recommends;
  let retainedImageIds = original.retainedImageIds;
  if (retainedImageIds !== undefined) {
    if (!Array.isArray(retainedImageIds)) {
      throw validationError("Invalid retainedImageIds.", "retainedImageIds");
    }
    retainedImageIds = [...retainedImageIds];
    for (let index = 0; index < retainedImageIds.length; index++) {
      const item = retainedImageIds[index];
      if (typeof item !== "string") {
        throw validationError("Invalid retainedImageIds.", "retainedImageIds");
      }
      if (!/^[a-f0-9]{24}$/i.test(item)) {
        throw validationError("Invalid retainedImageIds.", "retainedImageIds");
      }
      retainedImageIds[index] = item;
    }
    if (retainedImageIds.length > 3) {
      throw validationError("Invalid retainedImageIds.", "retainedImageIds");
    }
    if (!(new Set(retainedImageIds).size === retainedImageIds.length)) {
      throw validationError("Choose each photo only once.", "retainedImageIds");
    }
  }
  if (retainedImageIds !== undefined) {
    input.retainedImageIds = retainedImageIds;
  }
  return input;
}
export function validateReview(req, res, next) {
  try {
    let input = req.body;
    if (req.is("multipart/form-data")) {
      input = JSON.parse(req.body.data);
    }
    req.reviewInput = checkReviewInput(input);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof SyntaxError ? "Invalid review data." : error.message,
    });
  }
  next();
}
export function validateReviewPage(req, res, next) {
  const page = Number(req.query.page ?? 1);
  if (
    Object.keys(req.query).some((field) => field !== "page") ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid review page.",
    });
  }
  req.reviewPage = page;
  next();
}
export function validateReviewId(req, res, next) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.reviewId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid review ID.",
    });
  }
  next();
}
