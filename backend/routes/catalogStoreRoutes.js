import { Router } from "express";
import * as catalogStore from "../controllers/catalogStoreController.js";
import { validateCatalogId } from "../middlewares/validateCatalog.js";
import {
  disableCatalogCache,
  validateCatalogStoreQuery,
} from "../middlewares/validateCatalogStore.js";

const router = Router();
router.use(disableCatalogCache);
router.get("/categories", catalogStore.listCategories);
router.get("/", validateCatalogStoreQuery, catalogStore.listProducts);
router.get("/:id", validateCatalogId, catalogStore.getProduct);

export default router;
