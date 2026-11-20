import test from "node:test";
import assert from "node:assert/strict";
import { selectedVariant, variantOptions, variantConfiguration, variantImage, optionKey } from "../src/utils/variants.js";

test("product selection uses an available default and falls back when it sells out", () => {
  const product = { defaultVariantId: "red", variants: [
    { id: "hidden", isListed: false, stock: 9 },
    { id: "blue", isListed: true, stock: 2 },
    { id: "red", isListed: true, stock: 1 },
  ] };
  assert.equal(selectedVariant(product).id, "red");
  product.variants[2].stock = 0;
  assert.equal(selectedVariant(product).id, "blue");
  product.variants[1].stock = 0;
  assert.equal(selectedVariant(product), null);
});

test("legacy and structured variant options display compatible configuration text", () => {
  const legacy = { name: "Laptop option", colorName: "Black", memory: "16 GB", storage: "512 GB" };
  assert.deepEqual(variantOptions(legacy).map(item => item.value), ["Black", "16 GB", "512 GB"]);
  assert.equal(variantConfiguration(legacy), "Black / 16 GB / 512 GB");
  assert.equal(variantConfiguration({ name: "Custom", options: [{ name: "Edition", value: "Pro" }] }), "Pro");
  assert.equal(variantConfiguration({ name: "Basic" }), "Basic");
  assert.equal(optionKey(" Color "), optionKey("Colour"));
  assert.equal(optionKey("Memory"), optionKey("RAM"));
});

test("variant imagery prefers owned variant images and supports legacy image IDs", () => {
  const product = { images: [{ id: "one", url: "first.jpg" }, { id: "two", url: "second.jpg" }] };
  assert.equal(variantImage(product, { images: [{ url: "variant.jpg" }] }), "variant.jpg");
  assert.equal(variantImage(product, { imageId: "two" }), "second.jpg");
  assert.equal(variantImage(product, null), "first.jpg");
  assert.equal(typeof variantImage({ images: [] }, null), "string");
});
