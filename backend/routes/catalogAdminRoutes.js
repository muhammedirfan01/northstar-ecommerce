import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as reviews from "../controllers/reviewController.js";
import {
  validateReviewId,
  validateReviewPage,
} from "../middlewares/validateReview.js";
import catalogUpload from "../middlewares/catalogUpload.js";
import {
  validateCatalog,
  validateCatalogId,
  validateCatalogQuery,
} from "../middlewares/validateCatalog.js";
import * as category from "../controllers/categoryController.js";
import * as product from "../controllers/productController.js";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
// adminRoutes mounts this router after its authentication and admin checks.
const writeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many catalog changes. Please wait and try again.",
  },
});

router.get("/categories", validateCatalogQuery, category.listCategories);
router.post(
  "/categories",
  writeLimit,
  catalogUpload,
  validateCatalog("category"),
  category.saveCategory,
);
router.patch(
  "/categories/:id",
  writeLimit,
  validateCatalogId,
  catalogUpload,
  validateCatalog("category"),
  category.saveCategory,
);
router.patch(
  "/categories/:id/status",
  writeLimit,
  validateCatalogId,
  validateCatalog("status"),
  category.setCategoryListed,
);
router.delete(
  "/categories/:id",
  writeLimit,
  validateCatalogId,
  category.deleteCategory,
);

router.get(
  "/products/:id/reviews",
  validateCatalogId,
  validateReviewPage,
  reviews.adminList,
);
router.patch(
  "/products/:id/reviews/:reviewId",
  writeLimit,
  validateCatalogId,
  validateReviewId,
  validateCatalog("status"),
  reviews.moderate,
);
router.delete(
  "/products/:id/reviews/:reviewId",
  writeLimit,
  validateCatalogId,
  validateReviewId,
  reviews.remove,
);

router.get("/products", validateCatalogQuery, product.listProducts);
router.get("/products/:id", validateCatalogId, product.getProduct);
router.post(
  "/products",
  writeLimit,
  catalogUpload,
  validateCatalog("product"),
  product.saveProduct,
);
router.patch(
  "/products/:id",
  writeLimit,
  validateCatalogId,
  catalogUpload,
  validateCatalog("product"),
  product.saveProduct,
);
router.patch(
  "/products/:id/status",
  writeLimit,
  validateCatalogId,
  validateCatalog("status"),
  product.setProductListed,
);
router.delete(
  "/products/:id",
  writeLimit,
  validateCatalogId,
  product.deleteProduct,
);
router.post(
  "/products/:id/variants",
  writeLimit,
  validateCatalogId,
  catalogUpload,
  validateCatalog("variant"),
  product.saveVariant,
);
router.patch(
  "/products/:id/variants/:variantId",
  writeLimit,
  validateCatalogId,
  catalogUpload,
  validateCatalog("variant"),
  product.saveVariant,
);
router.delete(
  "/products/:id/variants/:variantId",
  writeLimit,
  validateCatalogId,
  product.deleteVariant,
);
export default router;
