import { z } from "zod";

const customerId = z.string().regex(/^[a-f0-9]{24}$/i);

const customerQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "blocked"]).default("all"),
});

const customerStatusSchema = z.strictObject({
  isBlocked: z.boolean(),
});

function validate(schema, data, req, res, next, key) {
  const result = schema.safeParse(data);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: result.error.issues[0].message,
    });
  }

  req[key] = result.data;
  next();
}

// Validate search, pagination and status filters
export function validateCustomerQuery(req, res, next) {
  validate(customerQuerySchema, req.query, req, res, next, "customerQuery");
}

// Validate block/unblock requests
export function validateCustomerStatus(req, res, next) {
  const result = customerStatusSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: result.error.issues[0].message,
    });
  }

  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid customer ID.",
    });
  }

  req.customerStatus = {
    params: { id: req.params.id },
    body: result.data,
  };

  next();
}

// Validate MongoDB customer ID
export function validateCustomerId(req, res, next) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid customer ID.",
    });
  }

  next();
}

// Validate customer photo version
export function validateCustomerPhoto(req, res, next) {
  const result = z.strictObject({
    version: z.string().uuid(),
  }).safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid photo version.",
    });
  }

  next();
}