import { rateLimit } from "express-rate-limit";

function createLimiter(limit, message, keyGenerator) {
  const options = {
    windowMs: 15 * 60 * 1000,
    limit:limit,
    standardHeaders:true,
    legacyHeaders: false,
    message: { success: false, message },
  };
  if (keyGenerator)
    {
      options.keyGenerator = keyGenerator;
    } 
  return rateLimit(options);
}

function emailKey(req) {
  if (typeof req.body?.email === "string")
    return req.body.email.trim().toLowerCase();
  return "missing-email";
}

export const addressLimiter = createLimiter(
  60,
  "Too many address changes. Please try again later.",
  (req) => req.user.id,
);

export const registrationIpLimiter = createLimiter(
  10,
  "Too many registration requests. Please try again later.",
);

export const registrationEmailLimiter = createLimiter(
  3,
  "Too many requests for this email. Please try again later.",
  emailKey,
);

export const verificationIpLimiter = createLimiter(
  30,
  "Too many verification requests. Please try again later.",
);

export const resendIpLimiter = createLimiter(
  10,
  "Too many resend requests. Please try again later.",
);

export const loginIpLimiter = createLimiter(
  20,
  "Too many sign-in attempts. Please try again later.",
);

export const loginEmailLimiter = createLimiter(
  10,
  "Too many sign-in attempts for this email. Please try again later.",
  emailKey,
);

export const recoveryIpLimiter = createLimiter(
  10,
  "Too many recovery requests. Please try again in 15 minutes.",
);

export const recoveryEmailLimiter = createLimiter(
  3,
  "Too many recovery requests for this email. Please try again later.",
  emailKey,
);

export const recoveryVerifyLimiter = createLimiter(
  30,
  "Too many recovery attempts. Please try again later.",
);

export const catalogWriteLimiter = createLimiter(
  100,
  "Too many catalog changes. Please wait and try again.",
  (req) => req.user.id,
);

export const profileSaveLimiter = createLimiter(
  30,
  "Too many requests. Please try again later.",
  (req) => req.user.id,

);

export const profileSecurityLimiter = createLimiter(
  10,
  "Too many requests. Please try again later.",
  (req) => req.user.id,
  
);

export const profileVerifyLimiter = createLimiter(
  30,
  "Too many requests. Please try again later.",
  (req) => req.user.id,
 
);

export const shoppingLimiter = createLimiter(
  120,
  "Too many shopping changes. Please wait and try again.",
  (req) => req.user.id,
);
// export const cartLimiter=createLimiter(
//   9,
//   "Maximum 9 times only",
//   (req)=>req.user.id,
// )
