import { Router, raw } from "express";
import { receiveWebhook } from "../controllers/paymentWebhookController.js";
const router = Router();
router.post(
  "/razorpay/webhook",
  raw({ type: "application/json", limit: "256kb" }),
  receiveWebhook,
);
export default router;
