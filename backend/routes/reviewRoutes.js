import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../middlewares/auth.js";
import { validateCatalogId } from "../middlewares/validateCatalog.js";
import {
  validateReview,
  validateReviewPage,
} from "../middlewares/validateReview.js";
import * as reviews from "../controllers/reviewController.js";
import { imageUpload } from "../middlewares/catalogUpload.js";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const writes = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many review changes. Please wait and try again.",
  },
});
function customer(req, res, next) {
  if (req.user.role !== "customer")
    return res.status(403).json({
      success: false,
      message: "Use a customer account to write a review.",
    });
  next();
}
router.get("/:id/reviews", validateCatalogId, validateReviewPage, reviews.list);
router.get(
  "/:id/review-eligibility",
  validateCatalogId,
  requireAuth,
  customer,
  reviews.eligibility,
);
router.post(
  "/:id/reviews",
  validateCatalogId,
  requireAuth,
  customer,
  writes,
  imageUpload(3),
  validateReview,
  reviews.save,
);
export default router;
