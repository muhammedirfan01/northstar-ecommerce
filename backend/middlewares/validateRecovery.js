import { z } from "zod";

const challengeId = z.string().regex(/^[a-f0-9]{24}$/i).toLowerCase();
const password = z.string().min(8).max(128);
const code = z.string().regex(/^\d{6}$/);

const schemas = {
  request: z.strictObject({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  }),

  resend: z.strictObject({
    challengeId,
  }),

  verify: z.strictObject({
    challengeId,
    code,
  }),

  reset: z.strictObject({
    challengeId,
    resetToken: z.string().regex(/^[a-f0-9]{64}$/i),
    password,
    confirmPassword: password,
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  }),
};

export default function validateRecovery(kind) {
  return (req, res, next) => {
    const result = schemas[kind].safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0].message,
      });
    }

    req.body = result.data;
    next();
  };
}