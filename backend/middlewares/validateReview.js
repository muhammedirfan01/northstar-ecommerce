import { z } from "zod";

export const reviewSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(100),
  text: z.string().trim().min(10).max(1000),
  recommends: z.boolean(),
  retainedImageIds: z
    .array(z.string().regex(/^[a-f0-9]{24}$/i))
    .max(3)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Choose each photo only once.",
    )
    .optional(),
});
export function validateReview(req, res, next) {
  let input = req.body;
  if (req.is("multipart/form-data")) {
    try {
      input = JSON.parse(req.body.data);
    } catch {
      return res
        .status(400)
        .json({ success: false, message: "Invalid review data." });
    }
  }
  const result = reviewSchema.safeParse(input);
  if (!result.success)
    return res
      .status(400)
      .json({ success: false, message: result.error.issues[0].message });
  req.reviewInput = result.data;
  next();
}
export function validateReviewPage(req, res, next) {
  const result = z
    .strictObject({
      page: z.coerce.number().int().min(1).max(10000).default(1),
    })
    .safeParse(req.query);
  if (!result.success)
    return res
      .status(400)
      .json({ success: false, message: "Invalid review page." });
  req.reviewPage = result.data.page;
  next();
}
export function validateReviewId(req, res, next) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.reviewId))
    return res
      .status(400)
      .json({ success: false, message: "Invalid review ID." });
  next();
}
