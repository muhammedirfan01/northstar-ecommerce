import test from "node:test";
import assert from "node:assert/strict";
import { reviewSchema } from "../middlewares/validateReview.js";
import Review from "../models/Review.js";

const review = {
  rating: 5,
  title: "Good product",
  text: "Easy to use every day.",
  recommends: true,
};
const id = "111111111111111111111111";

test("review inputs accept old text-only clients but never customer-supplied image URLs or duplicate photo IDs", () => {
  assert.equal(reviewSchema.parse(review).retainedImageIds, undefined);
  assert.deepEqual(
    reviewSchema.parse({ ...review, retainedImageIds: [] }).retainedImageIds,
    [],
  );
  for (const extra of [
    { retainedImageIds: [id, id] },
    { retainedImageIds: ["not-an-id"] },
    {
      images: [
        {
          publicId: "someone-elses-image",
          url: "https://example.com/photo.png",
        },
      ],
    },
  ])
    assert.equal(
      reviewSchema.safeParse({ ...review, ...extra }).success,
      false,
    );
});

test("review documents remain compatible with no photos and reject more than three", () => {
  const document = new Review({ ...review, productId: id, userId: id });
  assert.equal(document.validateSync(), undefined);
  assert.equal(document.images.length, 0);
  document.images = Array.from({ length: 4 }, (_, index) => ({
    publicId: `review/${index}`,
    url: `https://example.com/${index}.png`,
  }));
  assert.ok(document.validateSync().errors.images);
});
