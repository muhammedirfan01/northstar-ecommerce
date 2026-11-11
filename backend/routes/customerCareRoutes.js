import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, requireCustomer } from "../middlewares/auth.js";
import noCache from "../middlewares/noCache.js";
import {
  getContact,
  sendMessage,
  getWallet,
} from "../controllers/customerCareController.js";
const router = Router();
router.use(noCache);
router.get("/support", getContact);
router.post(
  "/support",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many support messages. Please try again later.",
    },
  }),
  sendMessage,
);
router.get("/wallet", requireAuth, requireCustomer, getWallet);
export default router;
