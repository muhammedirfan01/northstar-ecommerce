import { categoryPopulation } from "../utils/productAvailability.js";
import { validateVariantOptions } from "../utils/variantOptions.js";
import { categoryAndChildren } from "./categoryService.js";
import {
  variantOptions,
  defaultVariant,
  optionName,
} from "../utils/variantSelection.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
import { deleteProducts } from "./catalogDeletionService.js";
import { serviceError } from "../utils/serviceError.js";
import {
  uploadCatalogImages,
  removeCatalogImages,
} from "./catalogImageService.js";

export function publicProduct(product) {
  const selected = defaultVariant(product);
  return {
    id: String(product._id),
    name: product.name,
    description: product.description,
    series: product.series || "",
    subtitle: product.subtitle || "",
    badge: product.badge || "",
    priceNote: product.priceNote || "",
    quickSpecs: (product.quickSpecs || []).map((spec) => ({
      label: spec.label,
      value: spec.value,
      note: spec.note,
    })),
    category: product.category
      ? {
          id: String(product.category._id),
          name: product.category.name,
          isListed: product.category.isListed,
          parentId: product.category.parent
            ? String(product.category.parent._id || product.category.parent)
            : null,
          parentName: product.category.parent?.name || "",
        }
      : { id: "", name: "Category unavailable", isListed: false },
    images: product.images.map((image) => ({
      id: String(image._id),
      url: image.url,
    })),
    pricePaise: selected?.pricePaise ?? product.pricePaise,
    regularPricePaise: selected
      ? selected.regularPricePaise
      : product.regularPricePaise,
    stock: product.stock,
    isPublished: product.isPublished,
    isListed: product.isListed,
    highlights: product.highlights,
    specifications: product.specifications,
    defaultVariantId: product.defaultVariantId
      ? String(product.defaultVariantId)
      : null,
    variants: product.variants.map((variant) => ({
      id: String(variant._id),
      name: variant.name,
      colorName: variant.colorName || "",
      colorHex: variant.colorHex || "",
      memory: variant.memory || "",
      storage: variant.storage || "",
      imageId: variant.imageId ? String(variant.imageId) : null,
      options: variantOptions(variant),
      images: (variant.images || []).map((image) => ({
        id: String(image._id),
        url: image.url,
      })),
      pricePaise: variant.pricePaise,
      regularPricePaise: variant.regularPricePaise,
      stock: variant.stock,
      isListed: variant.isListed,
    })),
    createdAt: product.createdAt,
  };
}

export async function getProduct(id) {
  const product = await Product.findById(id).populate(categoryPopulation);
  if (!product) throw serviceError("Product not found.", 404);
  return publicProduct(product);
}

export async function listProducts(query) {
  const filter = {};
  if (query.search)
    filter.name = new RegExp(
      query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  if (query.category)
    filter.category = { $in: await categoryAndChildren(query.category) };
  if (query.status === "published")
    Object.assign(filter, { isPublished: true, isListed: true });
  if (query.status === "draft") filter.isPublished = false;
  if (query.status === "unlisted") filter.isListed = false;
  if (query.status === "out-of-stock") filter.stock = 0;
  const total = await Product.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const products = await Product.find(filter)
    .populate(categoryPopulation)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * query.limit)
    .limit(query.limit);
  const all = await Product.countDocuments({});
  const published = await Product.countDocuments({
    isPublished: true,
    isListed: true,
  });
  const lowStock = await Product.countDocuments({ stock: { $gt: 0, $lte: 5 } });
  return {
    products: products.map(publicProduct),
    summary: { total: all, published, lowStock },
    pagination: { page, limit: query.limit, total, totalPages },
  };
}

export async function saveProduct(id, input, files) {
  const product = id ? await Product.findById(id) : new Product();
  if (!product) throw serviceError("Product not found.", 404);
  if (!(await Category.exists({ _id: input.categoryId })))
    throw serviceError("Choose an existing category.");
  if (
    !product.variants.length &&
    (input.price === undefined || input.stock === undefined)
  )
    throw serviceError("Enter a price and stock quantity.");
  if (
    product.variants.length &&
    (input.price !== undefined ||
      input.stock !== undefined ||
      input.regularPrice !== undefined)
  )
    throw serviceError("Manage price and stock on the variants page.");
  const retained = input.retainedImageIds.map((id) => product.images.id(id));
  if (retained.some((image) => !image))
    throw serviceError(
      "An image was changed or does not belong to this product. Reload and try again.",
      409,
    );
  const count = retained.length + files.length;
  if (count < 1 || count > 6)
    throw serviceError("A product needs between 1 and 6 images.");
  const removed = product.images.filter(
    (image) => !input.retainedImageIds.includes(String(image._id)),
  );
  const uploaded = await uploadCatalogImages(files);
  product.name = input.name;
  product.description = input.description;
  product.series = input.series;
  product.subtitle = input.subtitle;
  product.badge = input.badge;
  product.priceNote = input.priceNote;
  product.quickSpecs = input.quickSpecs;
  product.category = input.categoryId;
  product.isPublished = input.isPublished;
  product.isListed = input.isListed;
  product.highlights = input.highlights;
  product.specifications = input.specifications;
  product.images = [...retained, ...uploaded];
  // Clear a variant image choice if that gallery image was removed.
  for (const variant of product.variants) {
    if (variant.imageId && !product.images.id(variant.imageId))
      variant.imageId = null;
  }
  if (!product.variants.length) {
    product.pricePaise = input.price;
    product.regularPricePaise = input.regularPrice ?? null;
    product.stock = input.stock;
  }
  try {
    await product.save();
  } catch (error) {
    await removeCatalogImages(uploaded);
    throw error;
  }
  await removeCatalogImages(removed);
  await product.populate(categoryPopulation);
  return publicProduct(product);
}

export async function setProductListed(id, isListed) {
  const product = await Product.findByIdAndUpdate(
    id,
    { $set: { isListed }, $inc: { __v: 1 } },
    { returnDocument: "after" },
  ).populate(categoryPopulation);
  if (!product) throw serviceError("Product not found.", 404);
  return publicProduct(product);
}

export async function deleteProduct(id) {
  const product = await Product.findById(id);
  if (!product) throw serviceError("Product not found.", 404);
  await deleteProducts([product]);
}

// The product's list price and stock always come from its current variants.
export function updateVariantTotals(product) {
  const listed = product.variants.filter((variant) => variant.isListed);
  product.stock = listed.reduce((total, variant) => total + variant.stock, 0);
  const selected = defaultVariant(product) || listed[0] || product.variants[0];
  if (selected) {
    product.pricePaise = selected.pricePaise;
    product.regularPricePaise = selected.regularPricePaise;
  }
}

export async function saveVariant(productId, variantId, input, files = []) {
  const product = await Product.findById(productId);
  if (!product) throw serviceError("Product not found.", 404);
  if (!variantId && product.variants.length >= 100)
    throw serviceError("A product can have up to 100 variants.");
  if (
    product.variants.some(
      (variant) =>
        String(variant._id) !== variantId &&
        variant.name.toLowerCase() === input.name.toLowerCase(),
    )
  )
    throw serviceError("A variant with this name already exists.", 409);
  let variant = variantId ? product.variants.id(variantId) : null;
  if (variantId && !variant) throw serviceError("Variant not found.", 404);
  validateVariantOptions(product, variantId, input);
  if (!variant && input.retainedImageIds?.length)
    throw serviceError("New variants cannot retain another variant’s images.");
  const previous = variant?.images || [];
  const retained =
    input.retainedImageIds === undefined
      ? [...previous]
      : input.retainedImageIds.map((id) => previous.id(id));
  if (retained.some((image) => !image))
    throw serviceError(
      "A variant image changed or belongs to another variant. Reload and try again.",
      409,
    );
  if (retained.length + files.length > 6)
    throw serviceError("A variant can have up to six images.");
  const options = variantOptions(input);
  const value = (name) =>
    options.find((option) => optionName(option.name) === name)?.value || "";
  const uploaded = await uploadCatalogImages(files);
  const details = {
    name: input.name,
    options,
    colorName: value("colour"),
    colorHex: input.colorHex,
    memory: value("ram"),
    storage: value("storage"),
    imageId: input.imageId || null,
    images: [...retained, ...uploaded],
    pricePaise: input.price,
    regularPricePaise: input.regularPrice,
    stock: input.stock,
    isListed: input.isListed,
  };
  if (variant) Object.assign(variant, details);
  else {
    product.variants.push(details);
    variant = product.variants.at(-1);
  }
  if (input.isDefault) product.defaultVariantId = variant._id;
  else if (
    input.isDefault === false &&
    String(product.defaultVariantId) === String(variant._id)
  )
    product.defaultVariantId = null;
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
  return publicProduct(product);
}

export async function deleteVariant(productId, variantId) {
  if (await Order.exists({ "items.productId": productId }))
    throw serviceError(
      "This product is used in an order. Unlist the variant instead.",
      409,
    );
  const product = await Product.findById(productId);
  if (!product) throw serviceError("Product not found.", 404);
  const variant = product.variants.id(variantId);
  if (!variant) throw serviceError("Variant not found.", 404);
  const images = [...variant.images];
  variant.deleteOne();
  if (String(product.defaultVariantId) === variantId)
    product.defaultVariantId = null;
  updateVariantTotals(product);
  await product.save();
  await removeCatalogImages(images);
  await product.populate(categoryPopulation);
  return publicProduct(product);
}
