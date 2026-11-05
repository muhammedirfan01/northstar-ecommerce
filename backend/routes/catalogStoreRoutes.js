import noCache from "../middlewares/noCache.js";
import { Router } from "express";
import * as catalogStore from "../controllers/catalogStoreController.js";
const router = Router();
router.use(noCache);
router.get("/categories", catalogStore.listCategories);
router.get("/", catalogStore.listProducts);
router.get("/:id", catalogStore.getProduct);
export default router;
