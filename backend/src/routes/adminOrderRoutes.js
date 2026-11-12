import * as operations from "../controllers/adminOperationsController.js";
import { Router } from "express";
import * as orders from "../controllers/adminOrderController.js";
import * as inventory from "../controllers/inventoryController.js";
import {
  reviewReturn,
  updateReplacement,
  completeReturn,
  processRefund,
  getAdminReturnPhoto,
} from "../controllers/returnController.js";
import { getAdminInvoice } from "../controllers/invoiceController.js";
import { reconcileAdminPayment } from "../controllers/orderController.js";
const router = Router();
router.get("/orders/export", operations.exportOrders);
router.get("/payments/export", operations.exportPayments);
router.get("/inventory/export", operations.exportInventory);
router.get("/payments", operations.listPayments);
router.post("/inventory/:id/adjustments", operations.adjustStock);
router.get("/orders", orders.listOrders);
router.get("/orders/:id", orders.getOrder);
router.patch("/orders/:id/status", orders.updateOrderStatus);
router.post("/orders/:id/cancel", orders.cancelOrder);
router.post("/orders/:id/mark-paid", orders.markOrderPaid);
router.post("/orders/:id/return/review", reviewReturn);
router.get("/orders/:id/return/photos/:photoId", getAdminReturnPhoto);
router.post("/orders/:id/return/complete", completeReturn);
router.post("/orders/:id/return/replacement", updateReplacement);
router.post("/orders/:id/refund", processRefund);
router.post("/orders/:id/payment/reconcile", reconcileAdminPayment);
router.get("/orders/:id/invoice", getAdminInvoice);
router.get("/inventory", inventory.listInventory);
export default router;
