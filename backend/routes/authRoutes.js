import noCache from "../middlewares/noCache.js";
import {
  registrationIpLimiter,
  registrationEmailLimiter,
  verificationIpLimiter,
  resendIpLimiter,
  loginIpLimiter,
  loginEmailLimiter,
  recoveryIpLimiter,
  recoveryEmailLimiter,
  recoveryVerifyLimiter,
} from "../middlewares/rateLimiters.js";
import { Router } from "express";
import { register } from "../controllers/registrationController.js";
import {
  verifyRegistration,
  resendRegistrationOtp,
} from "../controllers/registrationOtpController.js";
import {
  requestRecovery,
  resendRecovery,
  verifyRecovery,
  resetPassword,
} from "../controllers/passwordResetController.js";
import {
  startLogin,
  currentUser,
  logout,
} from "../controllers/loginController.js";
import { requireAuth } from "../middlewares/auth.js";
import { googleSignIn } from "../controllers/googleAuthController.js";
const router = Router();
router.use(noCache);
router.post(
  "/register",
  registrationIpLimiter,
  registrationEmailLimiter,
  register,
);
router.post("/register/verify-otp", verificationIpLimiter, verifyRegistration);
router.post("/register/resend-otp", resendIpLimiter, resendRegistrationOtp);
router.get("/me", requireAuth, currentUser);
router.post("/login", loginIpLimiter, loginEmailLimiter, startLogin);
router.post("/google", loginIpLimiter, googleSignIn);
router.post("/logout", logout);
router.post(
  "/forgot-password",
  recoveryIpLimiter,
  recoveryEmailLimiter,
  requestRecovery,
);
router.post("/forgot-password/resend-otp", recoveryIpLimiter, resendRecovery);
router.post(
  "/forgot-password/verify-otp",
  recoveryVerifyLimiter,
  verifyRecovery,
);
router.post("/reset-password", recoveryVerifyLimiter, resetPassword);
export default router;
