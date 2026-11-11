import { Router } from "express";
import { requireAuth, requireCustomer } from "../middlewares/auth.js";
import * as controller from "../controllers/orderController.js";
import {
  requestReturn,
  cancelReturn,
  getReturnPhoto,
} from "../controllers/returnController.js";
import returnUpload from "../middlewares/returnUpload.js";
import { getInvoice } from "../controllers/invoiceController.js";
import noCache from "../middlewares/noCache.js";
const router = Router();
router.use(noCache);
router.use(requireAuth, requireCustomer);
router.post("/preview", controller.preview);
router.post("/", controller.placeOrder);
router.get("/", controller.listOrders);
router.get("/:id", controller.getOrder);
router.post("/:id/cancel", controller.cancelOrder);
router.post("/:id/return", returnUpload, requestReturn);
router.post("/:id/return/cancel", cancelReturn);
router.get("/:id/return/photos/:photoId", getReturnPhoto);
router.get("/:id/invoice", getInvoice);
router.post("/:id/payment-method", controller.changePaymentMethod);
router.post("/:id/payment", controller.startPayment);
router.post("/:id/payment/verify", controller.verifyPayment);
router.post("/:id/payment/reconcile", controller.reconcilePayment);
export default router;
