import { z } from "zod";
import { variantOptions, optionName } from "../utils/variantSelection.js";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid catalog ID.");
const money = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/,
    "Enter a valid price with at most 2 decimal places.",
  )
  .transform((value) => Math.round(Number(value) * 100))
  .refine((value) => value > 0, "Price must be greater than zero.");
const regularPrice = z.union([z.literal("").transform(() => null), money]);
const quantity = z
  .string()
  .regex(/^\d{1,7}$/, "Stock must be a whole number.")
  .transform(Number)
  .refine((value) => value <= 1000000, "Stock cannot exceed 1,000,000.");
const lines = z.array(z.string().trim().min(1).max(200)).max(20);

export const categorySchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(2, "Enter a category name with at least 2 characters.")
    .max(80),
  parentId: z.union([z.literal(""), objectId]).default(""),
  isListed: z.boolean(),
  keepImage: z.boolean(),
});
export const productSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(160),
    description: z
      .string()
      .trim()
      .min(10, "Description must have at least 10 characters.")
      .max(5000),
    series: z.string().trim().max(80).default(""),
    subtitle: z.string().trim().max(240).default(""),
    badge: z
      .enum([
        "",
        "Best seller",
        "Deal of the day",
        "Most purchased",
        "New arrival",
      ])
      .default(""),
    priceNote: z.string().trim().max(180).default(""),
    quickSpecs: z
      .array(
        z.strictObject({
          label: z.string().trim().min(1).max(60),
          value: z.string().trim().min(1).max(120),
          note: z.string().trim().max(200).default(""),
        }),
      )
      .max(6)
      .default([]),
    categoryId: objectId,
    price: money.optional(),
    regularPrice: regularPrice.optional(),
    stock: quantity.optional(),
    isPublished: z.boolean(),
    isListed: z.boolean(),
    highlights: lines,
    specifications: z.array(z.string().trim().min(1).max(500)).max(20),
    retainedImageIds: z
      .array(objectId)
      .max(6)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate retained images.",
      ),
  })
  .refine(
    (value) =>
      !value.regularPrice || !value.price || value.regularPrice >= value.price,
    "Regular price must be at least the selling price.",
  );
export const variantSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(120),
    options: z
      .array(
        z.strictObject({
          name: z.string().trim().min(1).max(40),
          value: z.string().trim().min(1).max(80),
        }),
      )
      .max(5)
      .optional(),
    isDefault: z.boolean().optional(),
    retainedImageIds: z
      .array(objectId)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate images.")
      .optional(),
    colorName: z.string().trim().max(40).default(""),
    colorHex: z
      .union([
        z.literal(""),
        z.string().regex(/^#[a-f0-9]{6}$/i, "Choose a valid colour swatch."),
      ])
      .default(""),
    memory: z.string().trim().max(80).default(""),
    storage: z.string().trim().max(80).default(""),
    imageId: z.union([z.literal(""), objectId]).default(""),
    price: money,
    regularPrice,
    stock: quantity,
    isListed: z.boolean(),
  })
  .refine(
    (value) => !value.regularPrice || value.regularPrice >= value.price,
    "Regular price must be at least the selling price.",
  )
  .refine(
    (value) =>
      Boolean(
        variantOptions(value).find(
          (option) => optionName(option.name) === "colour",
        ),
      ) === Boolean(value.colorHex),
    "Add both a colour option and swatch, or leave both empty.",
  )
  .refine((value) => {
    const names = variantOptions(value).map((option) =>
      optionName(option.name),
    );
    return new Set(names).size === names.length;
  }, "Use each option name only once.");

const schemas = {
  category: categorySchema,
  product: productSchema,
  variant: variantSchema,
  status: z.strictObject({ isListed: z.boolean() }),
};

export function validateCatalog(kind) {
  return (req, res, next) => {
    let input = req.body;
    if (
      kind === "category" ||
      kind === "product" ||
      (kind === "variant" && req.body.data)
    ) {
      try {
        input = JSON.parse(req.body.data);
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid form data." });
      }
    }
    const result = schemas[kind].safeParse(input);
    if (!result.success)
      return res
        .status(400)
        .json({ success: false, message: result.error.issues[0].message });
    req.catalogInput = result.data;
    next();
  };
}

export function validateCatalogId(req, res, next) {
  if (
    !objectId.safeParse(req.params.id).success ||
    (req.params.variantId && !objectId.safeParse(req.params.variantId).success)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid catalog ID." });
  }
  next();
}

const querySchema = z.strictObject({
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z
    .enum(["all", "listed", "unlisted", "published", "draft", "out-of-stock"])
    .default("all"),
  category: z.union([z.literal(""), objectId]).default(""),
  options: z.enum(["true", "false"]).optional(),
});
export function validateCatalogQuery(req, res, next) {
  const result = querySchema.safeParse(req.query);
  if (!result.success)
    return res.status(400).json({
      success: false,
      message: "Invalid search or pagination options.",
    });
  req.catalogQuery = result.data;
  next();
}
