import { z } from "zod";

export function disableCatalogCache(_req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

const querySchema = z
  .strictObject({
    search: z.string().trim().max(100).default(""),
    category: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    minPrice: z.coerce.number().min(0).max(99999999.99).optional(),
    maxPrice: z.coerce.number().min(0).max(99999999.99).optional(),
    sort: z
      .enum(["latest", "price-asc", "price-desc", "name-asc", "name-desc"])
      .default("latest"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
  );

export function validateCatalogStoreQuery(req, res, next) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success)
    return res
      .status(400)
      .json({ success: false, message: "Invalid catalog filters." });
  req.catalogStoreQuery = parsed.data;
  next();
}
