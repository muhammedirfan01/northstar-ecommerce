import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../middlewares/auth.js";
import {
  validateAddressId,
  validateAddressDetails,
  validateAddressVersion,
} from "../middlewares/validateAddress.js";
import {
  getAddresses,
  addAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/addressController.js";
const router = Router();
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(requireAuth, (req, res, next) =>
  req.user.role === "customer"
    ? next()
    : res.status(403).json({
        success: false,
        message: "Address management is available for customer accounts.",
      }),
);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // need to find out this
  limit: 60,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many address changes. Please try again later.",
  },
});
router.get("/", getAddresses);
router.post("/", limiter, validateAddressDetails, addAddress);
router.patch(
  "/:id",
  limiter,
  validateAddressId,
  validateAddressDetails,
  editAddress,
);
router.delete(
  "/:id",
  limiter,
  validateAddressId,
  validateAddressVersion,
  deleteAddress,
);
router.patch(
  "/:id/default",
  limiter,
  validateAddressId,
  validateAddressVersion,
  setDefaultAddress,
);
export default router;
