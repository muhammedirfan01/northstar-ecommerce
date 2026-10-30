import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, requirePasswordAccount } from "../middlewares/auth.js";
import validateProfile from "../middlewares/validateProfile.js";
import profileUpload from "../middlewares/profileUpload.js";

import { getProfile, updateProfile, getPhoto } from "../controllers/profileController.js";
import { requestEmailChange, verifyEmailChange, requestPasswordChange, changePassword, resendSecurityCode } from "../controllers/profileSecurityController.js";
const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});  
router.use(requireAuth);
const limiter = limit => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  keyGenerator: req => req.user.id,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});
const saveLimiter = limiter(30);
const securityLimiter = limiter(10);
const verifyLimiter = limiter(30);
router.get("/", getProfile);
router.get("/photo/:version", getPhoto);
router.patch("/", saveLimiter, profileUpload, validateProfile("details"), updateProfile);
router.post("/email", requirePasswordAccount, securityLimiter, validateProfile("email"), requestEmailChange);
router.post("/email/verify", requirePasswordAccount, verifyLimiter, validateProfile("verifyEmail"), verifyEmailChange);
router.post("/password/code", requirePasswordAccount, securityLimiter, validateProfile("passwordRequest"), requestPasswordChange);
router.patch("/password", requirePasswordAccount, verifyLimiter, validateProfile("password"), changePassword);
router.post("/security/resend", requirePasswordAccount, securityLimiter, validateProfile("resend"), resendSecurityCode);

export default router;