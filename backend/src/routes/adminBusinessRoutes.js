import { Router } from "express";
import * as controller from "../controllers/adminBusinessController.js";
// The parent admin router provides authentication, authorization and no-cache.
const router = Router();
router.get("/offers/targets", controller.listTargets);
router.get("/offers", controller.listOffers);
router.post("/offers", controller.createOffer);
router.patch("/offers/:id", controller.editOffer);
router.patch("/offers/:id/status", controller.setOfferStatus);
router.get("/reports/sales/export", controller.exportSales);
router.get("/reports/sales", controller.salesReport);
export default router;
