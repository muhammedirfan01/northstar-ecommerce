import { z } from "zod";

const resendSchema = z.strictObject({
  challengeId: z.string()
    .regex(/^[a-f0-9]{24}$/i, "Invalid verification ID")
    .toLowerCase(),
});

export default function validateOtpResend(req, res, next) {
  const result = resendSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.issues[0].message,
    });
  }

  req.body = result.data;
  next();
}