import { z } from "zod";

const verificationSchema = z.strictObject({
  challengeId: z.string().regex(/^[a-f0-9]{24}$/i),
  code: z.string().regex(/^\d{6}$/),
});

export default function validateRegistrationOtp(req, res, next) {
  const result = verificationSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.issues[0].message,
    });
  }

  req.body = result.data;
  next();
}