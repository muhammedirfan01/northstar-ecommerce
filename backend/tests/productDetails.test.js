import test from "node:test";
import assert from "node:assert/strict";
import Product from "../models/Product.js";
import {
  productSchema,
  variantSchema,
} from "../middlewares/validateCatalog.js";
import { reviewSchema } from "../middlewares/validateReview.js";
import { validateVariantOptions } from "../utils/variantOptions.js";
import { publicProduct } from "../services/productService.js";
import { reviewSummary } from "../services/reviewService.js";

const imageId = "111111111111111111111111";
const productInput = {
  name: "Laptop",
  description: "A premium everyday laptop.",
  categoryId: imageId,
  price: "100",
  regularPrice: "120",
  stock: "5",
  isPublished: true,
  isListed: true,
  highlights: [],
  specifications: [],
  retainedImageIds: [],
};
const variantInput = {
  name: "Black / 16 GB / 512 GB",
  colorName: "Black",
  colorHex: "#222222",
  memory: "16 GB",
  storage: "512 GB",
  imageId,
  price: "100",
  regularPrice: "120",
  stock: "3",
  isListed: true,
};

test("product presentation supports legacy forms and validates cards and promotional fields", () => {
  const legacy = productSchema.parse(productInput);
  assert.deepEqual(legacy.quickSpecs, []);
  assert.equal(legacy.series, "");
  const updated = productSchema.parse({
    ...productInput,
    series: "Pro series",
    subtitle: "Built for work",
    badge: "Best seller",
    priceNote: "Includes taxes.",
    quickSpecs: [{ label: "Display", value: "Retina", note: "120 Hz" }],
  });
  assert.equal(updated.quickSpecs[0].value, "Retina");
  for (const extra of [
    { quickSpecs: [{ label: "", value: "Retina" }] },
    {
      quickSpecs: Array.from({ length: 7 }, () => ({
        label: "Display",
        value: "Retina",
      })),
    },
    { badge: "Uncontrolled badge" },
    { priceNote: "x".repeat(181) },
    { rating: 5 },
  ])
    assert.equal(
      productSchema.safeParse({ ...productInput, ...extra }).success,
      false,
    );
});
test("structured variants validate colour pairs, IDs and prices while keeping named variants compatible", () => {
  assert.equal(variantSchema.parse(variantInput).price, 10000);
  assert.equal(
    variantSchema.parse({
      name: "Standard",
      price: "100",
      regularPrice: "",
      stock: "1",
      isListed: true,
    }).colorName,
    "",
  );
  for (const extra of [
    { colorHex: "red" },
    { colorName: "" },
    { colorHex: "" },
    { imageId: "other-image" },
    { regularPrice: "50" },
  ])
    assert.equal(
      variantSchema.safeParse({ ...variantInput, ...extra }).success,
      false,
    );
  assert.equal(
    variantSchema.safeParse({ ...variantInput, memory: "", storage: "" })
      .success,
    true,
  );
});
test("variants reject duplicate combinations, inconsistent swatches and another product's images", () => {
  const product = new Product({
    images: [{ _id: imageId, url: "/test.png", publicId: "test" }],
    variants: [
      {
        name: "Existing",
        colorName: "Black",
        colorHex: "#222222",
        memory: "16 GB",
        storage: "512 GB",
        pricePaise: 10000,
        stock: 2,
      },
    ],
  });
  assert.throws(
    () =>
      validateVariantOptions(product, null, {
        ...variantInput,
        colorName: "black",
      }),
    { status: 409 },
  );
  assert.throws(
    () =>
      validateVariantOptions(product, null, {
        ...variantInput,
        memory: "32 GB",
        colorHex: "#333333",
      }),
    { status: 400 },
  );
  assert.throws(
    () =>
      validateVariantOptions(product, null, {
        ...variantInput,
        memory: "32 GB",
        imageId: "222222222222222222222222",
      }),
    { status: 400 },
  );
  assert.doesNotThrow(() =>
    validateVariantOptions(
      product,
      String(product.variants[0]._id),
      variantInput,
    ),
  );
});
test("public product data includes editable presentation and variant option fields without storage IDs", () => {
  const product = new Product({
    name: "Laptop",
    series: "Pro",
    subtitle: "Work anywhere",
    quickSpecs: [{ label: "Display", value: "Retina" }],
    category: null,
    images: [{ _id: imageId, url: "/test.png", publicId: "private-public-id" }],
    variants: [
      {
        name: "Black",
        colorName: "Black",
        colorHex: "#222222",
        memory: "16 GB",
        imageId,
        pricePaise: 10000,
        stock: 1,
      },
    ],
  });
  const output = publicProduct(product);
  assert.equal(output.variants[0].colorHex, "#222222");
  assert.equal(output.variants[0].imageId, imageId);
  assert.equal(output.quickSpecs[0].value, "Retina");
  assert.equal(output.images[0].publicId, undefined);
});
test("reviews reject client-controlled verification, identity, moderation and invalid ratings", () => {
  const review = {
    rating: 5,
    title: "Great laptop",
    text: "A bright display and very good battery.",
    recommends: true,
  };
  assert.equal(reviewSchema.safeParse(review).success, true);
  for (const extra of [
    { rating: 6 },
    { rating: 3.5 },
    { title: " " },
    { text: "short" },
    { isListed: true },
    { verified: true },
    { userId: imageId },
  ])
    assert.equal(
      reviewSchema.safeParse({ ...review, ...extra }).success,
      false,
    );
});
test("review summaries handle empty reviews and calculate recommendation percentages", () => {
  assert.deepEqual(reviewSummary(), {
    count: 0,
    average: 0,
    recommendPercent: 0,
  });
  assert.deepEqual(reviewSummary({ count: 3, average: 4, recommended: 2 }), {
    count: 3,
    average: 4,
    recommendPercent: 67,
  });
});
