import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import Product from "../models/Product.js";
import {
  categorySchema,
  productSchema,
  variantSchema,
} from "../middlewares/validateCatalog.js";
import { prepareCatalogImage } from "../services/catalogImageService.js";
import { updateVariantTotals } from "../services/productService.js";

const categoryId = "111111111111111111111111";
const validProduct = {
  name: "Laptop",
  description: "A lightweight laptop.",
  categoryId,
  price: "1234.56",
  regularPrice: "1499.99",
  stock: "10",
  isPublished: true,
  isListed: true,
  highlights: [],
  specifications: [],
  retainedImageIds: [],
};

test("catalog validates prices as integer paise and rejects invalid price/stock", () => {
  const value = productSchema.parse(validProduct);
  assert.equal(value.price, 123456);
  assert.equal(value.stock, 10);
  for (const price of ["-1", "0", "1.234", "NaN", "1e3"])
    assert.equal(
      productSchema.safeParse({ ...validProduct, price }).success,
      false,
    );
  for (const stock of ["-1", "1.5", "1000001", "Infinity"])
    assert.equal(
      productSchema.safeParse({ ...validProduct, stock }).success,
      false,
    );
  assert.equal(
    productSchema.safeParse({ ...validProduct, regularPrice: "10" }).success,
    false,
  );
});

test("catalog rejects unknown fields and invalid names/IDs", () => {
  assert.equal(
    categorySchema.safeParse({
      name: "  ",
      description: "",
      isListed: true,
      keepImage: false,
    }).success,
    false,
  );
  assert.equal(
    categorySchema.safeParse({
      name: "Laptops",
      description: "",
      isListed: true,
      keepImage: false,
      role: "admin",
    }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ ...validProduct, categoryId: "bad-id" }).success,
    false,
  );
  assert.equal(
    variantSchema.safeParse({
      name: "Black",
      price: "100",
      regularPrice: "50",
      stock: "1",
      isListed: true,
    }).success,
    false,
  );
});

test("variant stock replaces base stock and ignores hidden variants", () => {
  const product = new Product({
    stock: 100,
    variants: [
      {
        name: "Black",
        pricePaise: 20000,
        regularPricePaise: 24000,
        stock: 3,
        isListed: true,
      },
      { name: "Silver", pricePaise: 18000, stock: 0, isListed: true },
      { name: "Hidden", pricePaise: 10000, stock: 99, isListed: false },
    ],
  });
  updateVariantTotals(product);
  assert.equal(product.stock, 3);
  assert.equal(product.pricePaise, 20000);
  product.variants[0].isListed = false;
  updateVariantTotals(product);
  assert.equal(product.stock, 0);
  product.variants = [];
  updateVariantTotals(product);
  assert.equal(product.stock, 0);
});

test("backend rejects a PDF disguised as an image", async () => {
  await assert.rejects(
    prepareCatalogImage({
      buffer: Buffer.from("%PDF-1.4 Fake PDF"),
      mimetype: "image/png",
    }),
    { status: 400 },
  );
});

test("backend independently resizes valid image bytes", async () => {
  const buffer = await sharp({
    create: { width: 1800, height: 1500, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const result = await prepareCatalogImage({ buffer });
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1200);
  assert.ok(metadata.height <= 1200);
});
