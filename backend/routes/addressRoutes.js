import noCache from "../middlewares/noCache.js";
import { addressLimiter } from "../middlewares/rateLimiters.js";
import { Router } from "express";
import { requireAuth, requireAddressCustomer } from "../middlewares/auth.js";
import {
  getAddresses,
  addAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/addressController.js";
const router = Router();
router.use(noCache);
router.use(requireAuth, requireAddressCustomer);
router.get("/", getAddresses);
router.post("/", addressLimiter, addAddress);
router.patch("/:id", addressLimiter, editAddress);
router.delete("/:id", addressLimiter, deleteAddress);
router.patch("/:id/default", addressLimiter, setDefaultAddress);
export default router;
