import test from "node:test";
import assert from "node:assert/strict";
import Product from "../models/Product.js";
import {
  categorySchema,
  variantSchema,
} from "../middlewares/validateCatalog.js";
import { defaultVariant, variantOptions } from "../utils/variantSelection.js";
import { validateVariantOptions } from "../utils/variantOptions.js";
import { updateVariantTotals } from "../services/productService.js";
import { productIsAvailable } from "../utils/productAvailability.js";
import { describeCartItem } from "../services/shoppingService.js";

const id = "111111111111111111111111";
const variant = {
  name: "Burgundy / Large",
  options: [
    { name: "Colour", value: "Burgundy" },
    { name: "Size", value: "Large" },
  ],
  colorHex: "#660033",
  imageId: "",
  price: "2000",
  regularPrice: "2500",
  stock: "3",
  isListed: true,
  isDefault: true,
  retainedImageIds: [],
};

test("categories accept a parent and no longer accept descriptions", () => {
  const category = {
    name: "Gaming laptops",
    parentId: id,
    isListed: true,
    keepImage: false,
  };
  assert.equal(categorySchema.safeParse(category).success, true);
  assert.equal(
    categorySchema.safeParse({ ...category, parentId: "wrong" }).success,
    false,
  );
  assert.equal(
    categorySchema.safeParse({ ...category, description: "Old field" }).success,
    false,
  );
});
test("variants allow arbitrary option names but reject duplicate aliases and malformed colours", () => {
  assert.equal(variantSchema.safeParse(variant).success, true);
  assert.equal(
    variantSchema.safeParse({
      ...variant,
      options: [{ name: "Processor", value: "M3 Pro" }],
      colorHex: "",
    }).success,
    true,
  );
  assert.equal(
    variantSchema.safeParse({
      ...variant,
      options: [
        { name: "RAM", value: "16 GB" },
        { name: "Memory", value: "32 GB" },
      ],
      colorHex: "",
    }).success,
    false,
  );
  assert.equal(
    variantSchema.safeParse({ ...variant, colorHex: "burgundy" }).success,
    false,
  );
});
test("combination validation ignores option order and name case", () => {
  const product = new Product({
    images: [],
    variants: [
      {
        name: "Existing",
        options: variant.options,
        colorName: "Burgundy",
        colorHex: "#660033",
        pricePaise: 200000,
        stock: 3,
      },
    ],
  });
  assert.throws(
    () =>
      validateVariantOptions(product, null, {
        ...variant,
        options: [
          { name: "size", value: "large" },
          { name: "color", value: "burgundy" },
        ],
      }),
    { status: 409 },
  );
  assert.deepEqual(variantOptions({ colorName: "Black", memory: "16 GB" }), [
    { name: "Colour", value: "Black" },
    { name: "RAM", value: "16 GB" },
  ]);
});
test("the chosen default controls display price, with an available fallback", () => {
  const product = new Product({
    variants: [
      { name: "Standard", pricePaise: 10000, stock: 2, isListed: true },
      { name: "Premium", pricePaise: 20000, stock: 3, isListed: true },
    ],
  });
  product.defaultVariantId = product.variants[1]._id;
  updateVariantTotals(product);
  assert.equal(product.pricePaise, 20000);
  assert.equal(product.stock, 5);
  assert.equal(defaultVariant(product).name, "Premium");
  product.variants[1].stock = 0;
  updateVariantTotals(product);
  assert.equal(defaultVariant(product).name, "Standard");
  assert.equal(product.pricePaise, 10000);
});
test("hidden parent categories invalidate customer products and variant images reach the cart", () => {
  const product = new Product({
    name: "Phone",
    images: [{ url: "/base.png", publicId: "base" }],
    pricePaise: 200000,
    stock: 3,
    isPublished: true,
    isListed: true,
    variants: [
      {
        name: "Burgundy",
        pricePaise: 200000,
        stock: 3,
        isListed: true,
        images: [{ url: "/burgundy.png", publicId: "burgundy" }],
      },
    ],
  });
  const data = product.toObject();
  data.variants = product.variants;
  data.category = { isListed: true, parent: { isListed: false } };
  assert.equal(productIsAvailable(data), false);
  data.category.parent.isListed = true;
  const item = describeCartItem(
    {
      _id: id,
      productId: product._id,
      variantId: product.variants[0]._id,
      quantity: 1,
    },
    data,
  );
  assert.equal(item.image, "/burgundy.png");
  assert.equal(item.valid, true);
});
