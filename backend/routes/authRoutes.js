import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { register } from "../controllers/registrationController.js";
import { verifyRegistration, resendRegistrationOtp } from "../controllers/registrationOtpController.js";
import validateRegistration from "../middlewares/validateRegistration.js";
import validateRegistrationOtp from "../middlewares/validateRegistrationOtp.js";

import validateOtpResend from "../middlewares/validateOtpResend.js";
import validateRecovery from "../middlewares/validateRecovery.js";
import { requestRecovery, resendRecovery, verifyRecovery, resetPassword } from "../controllers/passwordResetController.js";

import {
  startLogin,
  currentUser,
  logout,
} from "../controllers/loginController.js";
import validateLogin from "../middlewares/validateLogin.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  googleSignIn,
} from "../controllers/googleAuthController.js";
const router = Router();
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const registrationIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false, 
  message: {
    success: false,
    message: "Too many registration requests. Please try again later.",
  },
});

const registrationEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body.email,
  message: {
    success: false,
    message: "Too many requests for this email. Please try again later.",
  },
});

const verificationIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification requests. Please try again later.",
  },
});

router.post(
  "/register",
  registrationIpLimiter,
  validateRegistration,
  registrationEmailLimiter,
  register
);

router.post(
  "/register/verify-otp",
  verificationIpLimiter,
  validateRegistrationOtp,
  verifyRegistration
);

const resendIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many resend requests. Please try again later.",
  },
});

router.post(
  "/register/resend-otp",
  resendIpLimiter,
  validateOtpResend,
  resendRegistrationOtp
);

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many sign-in attempts. Please try again later." },
});
const loginEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.body.email,
  message: { success: false, message: "Too many sign-in attempts for this email. Please try again later." },
});
router.get("/me", requireAuth, currentUser);
router.post("/login", loginIpLimiter, validateLogin, loginEmailLimiter, startLogin);
router.post(
  "/google",
  loginIpLimiter,
  googleSignIn
);
router.post("/logout", logout);

const recoveryIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many recovery requests. Please try again in 15 minutes." },
});
const recoveryEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 3, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => req.body.email,
  message: { success: false, message: "Too many recovery requests for this email. Please try again later." },
});
const recoveryVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many recovery attempts. Please try again later." },
});
router.post("/forgot-password", recoveryIpLimiter, validateRecovery("request"), recoveryEmailLimiter, requestRecovery);
router.post("/forgot-password/resend-otp", recoveryIpLimiter, validateRecovery("resend"), resendRecovery);
router.post("/forgot-password/verify-otp", recoveryVerifyLimiter, validateRecovery("verify"), verifyRecovery);
router.post("/reset-password", recoveryVerifyLimiter, validateRecovery("reset"), resetPassword);

export default router;
