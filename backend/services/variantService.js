import { readFormBody } from "../utils/formValidation.js";
import { checkVariantInput } from "../utils/validators/variant.js";
import { checkCatalogParams } from "../utils/validators/catalog.js";
// Application steps. Input is a plain object; the controller sends the response.
import { publicProduct } from "../utils/product.js";
import { categoryPopulation } from "../utils/productAvailability.js";
import Product from "../models/Product.js";
import { httpError } from "../utils/httpError.js";
import {
  uploadCatalogImages,
  removeCatalogImages,
} from "../services/catalogImageService.js";
export async function saveVariant(input) {
  input.params = checkCatalogParams(input.params);
  input.data = checkVariantInput(readFormBody(input.body));
  const productId = input.params.id;
  const variantId = input.params.variantId;
  const data = input.data;
  const files = input.files || [];
  const product = await Product.findById(productId);
  if (!product || product.deletedAt) {
    throw httpError("Product not found.", 404);
  }
  if (!variantId && product.variants.length >= 100) {
    throw httpError("A product can have up to 100 variants.");
  }
  if (
    product.variants.some(
      (variant) =>
        String(variant._id) !== variantId &&
        variant.name.toLowerCase() === data.name.toLowerCase(),
    )
  ) {
    throw httpError("A variant with this name already exists.", 409);
  }
  let variant;
  if (variantId) {
    variant = product.variants.id(variantId);
  } else {
    variant = null;
  }
  if (variantId && !variant) {
    throw httpError("Variant not found.", 404);
  }
  validateVariantOptions(product, variantId, data);
  if (!variant && data.retainedImageIds?.length) {
    throw httpError("New variants cannot retain another variant’s images.");
  }
  const previous = variant?.images || [];
  let retained;
  if (data.retainedImageIds === undefined) {
    retained = [...previous];
  } else {
    retained = data.retainedImageIds.map((id) => previous.id(id));
  }
  if (retained.some((image) => !image)) {
    throw httpError(
      "A variant image changed or belongs to another variant. Reload and try again.",
      409,
    );
  }
  if (retained.length + files.length < 3) {
    throw httpError("Each variant requires at least three images.");
  }
  if (retained.length + files.length > 6) {
    throw httpError("A variant can have up to six images.");
  }
  const options = variantOptions(data);
  function optionValue(name) {
    const option = options.find((option) => optionName(option.name) === name);
    return option?.value || "";
  }
  const uploaded = await uploadCatalogImages(files);
  const details = {
    name: data.name,
    options,
    colorName: optionValue("colour"),
    colorHex: data.colorHex,
    memory: optionValue("ram"),
    storage: optionValue("storage"),
    imageId: data.imageId || null,
    images: [...retained, ...uploaded],
    pricePaise: data.price,
    regularPricePaise: data.regularPrice,
    stock: data.stock,
    isListed: data.isListed,
  };
  if (variant) {
    variant.name = details.name;
    variant.options = details.options;
    variant.colorName = details.colorName;
    variant.colorHex = details.colorHex;
    variant.memory = details.memory;
    variant.storage = details.storage;
    variant.imageId = details.imageId;
    variant.images = details.images;
    variant.pricePaise = details.pricePaise;
    variant.regularPricePaise = details.regularPricePaise;
    variant.stock = details.stock;
    variant.isListed = details.isListed;
  } else {
    product.variants.push(details);
    variant = product.variants.at(-1);
  }
  if (data.isDefault) {
    product.defaultVariantId = variant._id;
  } else if (
    data.isDefault === false &&
    String(product.defaultVariantId) === String(variant._id)
  ) {
    product.defaultVariantId = null;
  }
  updateVariantTotals(product);
  try {
    await product.save();
  } catch (error) {
    await removeCatalogImages(uploaded);
    throw error;
  }
  await removeCatalogImages(
    previous.filter(
      (image) =>
        !retained.some((kept) => String(kept._id) === String(image._id)),
    ),
  );
  await product.populate(categoryPopulation);
  const responseData = publicProduct(product);
  return {
    status: input.params.variantId ? 200 : 201,
    body: {
      success: true,
      data: {
        product: responseData,
      },
    },
  };
}
export async function deleteVariant(input) {
  input.params = checkCatalogParams(input.params);
  const productId = input.params.id;
  const variantId = input.params.variantId;
  const product = await Product.findById(productId);
  if (!product || product.deletedAt) {
    throw httpError("Product not found.", 404);
  }
  const variant = product.variants.id(variantId);
  if (!variant) {
    throw httpError("Variant not found.", 404);
  }
  const images = [...variant.images];
  variant.deleteOne();
  if (String(product.defaultVariantId) === variantId) {
    product.defaultVariantId = null;
  }
  updateVariantTotals(product);
  await product.save();
  await removeCatalogImages(images);
  await product.populate(categoryPopulation);
  const responseData = publicProduct(product);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        product: responseData,
      },
    },
  };
}
import { validateVariantOptions } from "../utils/variantOptions.js";
import { variantOptions, optionName } from "../utils/variantSelection.js";
import { updateVariantTotals } from "../utils/product.js";
