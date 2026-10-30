import { nameSchema } from "../utils/nameValidation.js";
import { z } from "zod";

const registrationSchema = z.strictObject({
  name: nameSchema,

  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),

  password: z.string().min(8).max(128),

  acceptedTerms: z.literal(true),
});

export default function validateRegistration(req, res, next) {
  const result = registrationSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.issues[0].message,
    });
  }

  req.body = result.data;
  next();
}