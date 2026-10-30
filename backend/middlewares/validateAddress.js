import { z } from "zod";

const version = z.number().int().min(0);

const details = z.object({
  fullName: z.string().trim().min(2).max(80),
  phoneNumber: z.string().trim().regex(/^(\+91)?[6-9]\d{9}$/).transform(phone => phone.startsWith("+91") ? phone : "+91" + phone),
  addressLine1: z.string().trim().min(5).max(160),
  addressLine2: z.string().trim().max(100).default(""),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/),
  country: z.literal("IN").optional(),
  label: z.enum(["Home", "Work", "Other"]).default("Home"),
  isDefault: z.boolean().default(false),
  version,
}).strict();

const mutation = z.object({
  version
}).strict();

export function validateAddress(type) {
  return (req, res, next) => {
    const schema = type === "details" ? details : mutation;
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: result.error.issues[0].message,
        data: {
          fieldErrors: z.flattenError(result.error).fieldErrors
        }
      });
    }

    req.addressInput = result.data;
    next();
  };
}

export function validateAddressId(req, res, next) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid address ID."
    });
  }

  next();
}