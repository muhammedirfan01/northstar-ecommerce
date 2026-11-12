import noCache from "../middlewares/noCache.js";
import {
  profileSaveLimiter,
  profileSecurityLimiter,
  profileVerifyLimiter,
} from "../middlewares/rateLimiters.js";
import { Router } from "express";
import { requireAuth, requirePasswordAccount } from "../middlewares/auth.js";
import profileUpload from "../middlewares/profileUpload.js";
import {
  updateProfile,
  getPhoto,
} from "../controllers/profileController.js";
import {
  requestEmailChange,
  verifyEmailChange,
  requestPasswordChange,
  changePassword,
  resendSecurityCode,
} from "../controllers/profileSecurityController.js";
const router = Router();
router.use(noCache);
router.use(requireAuth);
router.get("/photo/:version", getPhoto);
router.patch("/", profileSaveLimiter, profileUpload, updateProfile);
router.post(
  "/email",
  requirePasswordAccount,
  profileSecurityLimiter,
  requestEmailChange,
);
router.post(
  "/email/verify",
  requirePasswordAccount,
  profileVerifyLimiter,
  verifyEmailChange,
);
router.post(
  "/password/code",
  requirePasswordAccount,
  profileSecurityLimiter,
  requestPasswordChange,
);
router.patch(
  "/password",
  requirePasswordAccount,
  profileVerifyLimiter,
  changePassword,
);
router.post(
  "/security/resend",
  requirePasswordAccount,
  profileSecurityLimiter,
  resendSecurityCode,
);
export default router;
