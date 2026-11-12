import { catalogWriteLimiter } from "../middlewares/rateLimiters.js";
import { Router } from "express";
import catalogUpload from "../middlewares/catalogUpload.js";
import * as category from "../controllers/categoryController.js";
import * as product from "../controllers/productController.js";
const router = Router();
// adminRoutes mounts this router after its authentication and admin checks.

router.get("/categories", category.listCategories);
router.post(
  "/categories",
  catalogWriteLimiter,
  catalogUpload,
  category.addCategory,
);
router.patch(
  "/categories/:id",
  catalogWriteLimiter,
  catalogUpload,
  category.saveCategory,
);
router.patch(
  "/categories/:id/status",
  catalogWriteLimiter,
  category.setCategoryListed,
);
router.delete("/categories/:id", catalogWriteLimiter, category.deleteCategory);
router.get("/products", product.listProducts);
router.get("/products/:id", product.getProduct);
router.post(
  "/products",
  catalogWriteLimiter,
  catalogUpload,
  product.saveProduct,
);
router.patch(
  "/products/:id",
  catalogWriteLimiter,
  catalogUpload,
  product.saveProduct,
);
router.patch(
  "/products/:id/status",
  catalogWriteLimiter,
  product.setProductListed,
);
router.delete("/products/:id", catalogWriteLimiter, product.deleteProduct);
router.post(
  "/products/:id/variants",
  catalogWriteLimiter,
  catalogUpload,
  product.saveVariant,
);
router.patch(
  "/products/:id/variants/:variantId",
  catalogWriteLimiter,
  catalogUpload,
  product.saveVariant,
);
router.delete(
  "/products/:id/variants/:variantId",
  catalogWriteLimiter,
  product.deleteVariant,
);
router.post(
  "/categories/:id/restore",
  catalogWriteLimiter,
  category.restoreCategory,
);
router.post(
  "/products/:id/restore",
  catalogWriteLimiter,
  product.restoreProduct,
);
export default router;
