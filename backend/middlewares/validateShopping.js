import { z } from "zod";
const id = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Invalid product or cart ID.")
  .toLowerCase();
const quantity = z
  .number()
  .int()
  .min(1)
  .max(5, "A product option can have at most 5 units.");
export const shoppingSchemas = {
  add: z.strictObject({
    productId: id,
    variantId: id.nullable().default(null),
    quantity,
  }),
  quantity: z.strictObject({ quantity }),
  wish: z.strictObject({ productId: id }),
  checkout: z.strictObject({
    expectedTotalPaise: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
  }),
};
export function validateShopping(kind) {
  return (req, res, next) => {
    const result = shoppingSchemas[kind].safeParse(req.body);
    if (!result.success)
      return res
        .status(400)
        .json({ success: false, message: result.error.issues[0].message });
    req.shoppingInput = result.data;
    next();
  };
}
