import { nameSchema } from "../utils/nameValidation.js";
import { z } from "zod";

const password = z.string().min(8).max(128);
const code = z.string().regex(/^\d{6}$/);
const challengeId = z.string().regex(/^[a-f0-9]{24}$/i);
const email = z.string().trim().toLowerCase().pipe(z.email());

const schemas = {
  details: z.strictObject({
    name: nameSchema,
    phone: z.string().trim().max(25)
      .refine(value => value === "" || /^[+\d\s()-]{7,25}$/.test(value)),
  }),

  email: z.strictObject({
    newEmail: email,
    currentPassword: z.string().min(1).optional(),
  }),

  verifyEmail: z.strictObject({
    challengeId,
    currentCode: code,
    newCode: code,
  }),

  resend: z.strictObject({
    challengeId,
  }),

  passwordRequest: z.strictObject({
    newPassword: password,
    confirmPassword: password,
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  }),

  password: z.strictObject({
    challengeId,
    code,
  }),
};

export default function validateProfile(kind) {
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