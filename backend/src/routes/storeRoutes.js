import noCache from "../middlewares/noCache.js";
import { Router } from "express";
import * as store from "../controllers/storeController.js";
const router = Router();
router.use(noCache);
router.get("/categories", store.listCategories);
router.get("/", store.listProducts);
router.get("/:id", store.getProduct);
export default router;
