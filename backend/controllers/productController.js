import { publicProduct, updateVariantTotals } from "../utils/product.js";
import { categoryPopulation } from "../utils/productAvailability.js";
import { validateVariantOptions } from "../utils/variantOptions.js";
import { categoryAndChildren } from "../utils/category.js";
import { variantOptions, optionName } from "../utils/variantSelection.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { httpError } from "../utils/httpError.js";
import {
  uploadCatalogImages,
  removeCatalogImages,
} from "../services/catalogImageService.js";
export async function listProducts(req, res) {
  const query = req.catalogQuery;
  const filter = {
    deletedAt: null,
  };
  if (query.status === "deleted") {
    filter.deletedAt = {
      $ne: null,
    };
  }
  if (query.search) {
    filter.name = new RegExp(
      query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  }
  if (query.category) {
    filter.category = {
      $in: await categoryAndChildren(query.category),
    };
  }
  if (query.status === "published") {
    filter.isPublished = true;
    filter.isListed = true;
  }
  if (query.status === "draft") {
    filter.isPublished = false;
  }
  if (query.status === "unlisted") {
    filter.isListed = false;
  }
  if (query.status === "out-of-stock") {
    filter.stock = 0;
  }
  const total = await Product.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const products = await Product.find(filter)
    .populate(categoryPopulation)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .skip((page - 1) * query.limit)
    .limit(query.limit);
  const all = await Product.countDocuments({
    deletedAt: null,
  });
  const published = await Product.countDocuments({
    isPublished: true,
    isListed: true,
    deletedAt: null,
  });
  const lowStock = await Product.countDocuments({
    stock: {
      $gt: 0,
      $lte: 5,
    },
    deletedAt: null,
  });
  const responseData = {
    products: products.map(publicProduct),
    summary: {
      total: all,
      published,
      lowStock,
    },
    pagination: {
      page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function getProduct(req, res) {
  const id = req.params.id;
  const product = await Product.findById(id).populate(categoryPopulation);
  if (!product || product.deletedAt) {
    throw httpError("Product not found.", 404);
  }
  const responseData = publicProduct(product);
  return res.json({
    success: true,
    data: {
      product: responseData,
    },
  });
}
export async function saveProduct(req, res) {
  const id = req.params.id;
  const input = req.catalogInput;
  const files = req.files || [];
  let product;
  if (id) {
    product = await Product.findById(id);
  } else {
    product = new Product();
  }
  if (!product || product.deletedAt) {
    throw httpError("Product not found.", 404);
  }
  if (
    !(await Category.exists({
      _id: input.categoryId,
      deletedAt: null,
    }))
  ) {
    throw httpError("Choose an existing category.");
  }
  if (
    !product.variants.length &&
    (input.price === undefined || input.stock === undefined)
  ) {
    throw httpError("Enter a price and stock quantity.");
  }
  if (
    product.variants.length &&
    (input.price !== undefined ||
      input.stock !== undefined ||
      input.regularPrice !== undefined)
  ) {
    throw httpError("Manage price and stock on the variants page.");
  }
  const retained = input.retainedImageIds.map((id) => product.images.id(id));
  if (retained.some((image) => !image)) {
    throw httpError(
      "An image was changed or does not belong to this product. Reload and try again.",
      409,
    );
  }
  const count = retained.length + files.length;
  if (count < 1 || count > 6) {
    throw httpError("A product needs between 1 and 6 images.");
  }
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
    if (variant.imageId && !product.images.id(variant.imageId)) {
      variant.imageId = null;
    }
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
  const responseData = publicProduct(product);
  return res.status(req.params.id ? 200 : 201).json({
    success: true,
    message: "Product saved.",
    data: {
      product: responseData,
    },
  });
}
export async function setProductListed(req, res) {
  const id = req.params.id;
  const isListed = req.catalogInput.isListed;
  const product = await Product.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      $set: {
        isListed,
      },
      $inc: {
        __v: 1,
      },
    },
    {
      returnDocument: "after",
    },
  ).populate(categoryPopulation);
  if (!product || product.deletedAt) {
    throw httpError("Product not found.", 404);
  }
  const responseData = publicProduct(product);
  return res.json({
    success: true,
    data: {
      product: responseData,
    },
  });
}
export async function deleteProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found.",
    });
  }
  product.deletedAt = new Date();
  await product.save();
  return res.json({
    success: true,
    message:
      "Product deleted. Its images and variants are kept for restoration.",
  });
}
export async function saveVariant(req, res) {
  const productId = req.params.id;
  const variantId = req.params.variantId;
  const input = req.catalogInput;
  const files = req.files || [];
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
        variant.name.toLowerCase() === input.name.toLowerCase(),
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
  validateVariantOptions(product, variantId, input);
  if (!variant && input.retainedImageIds?.length) {
    throw httpError("New variants cannot retain another variant’s images.");
  }
  const previous = variant?.images || [];
  let retained;
  if (input.retainedImageIds === undefined) {
    retained = [...previous];
  } else {
    retained = input.retainedImageIds.map((id) => previous.id(id));
  }
  if (retained.some((image) => !image)) {
    throw httpError(
      "A variant image changed or belongs to another variant. Reload and try again.",
      409,
    );
  }
  if (retained.length + files.length > 6) {
    throw httpError("A variant can have up to six images.");
  }
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
  if (input.isDefault) {
    product.defaultVariantId = variant._id;
  } else if (
    input.isDefault === false &&
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
  return res.status(req.params.variantId ? 200 : 201).json({
    success: true,
    data: {
      product: responseData,
    },
  });
}
export async function deleteVariant(req, res) {
  const productId = req.params.id;
  const variantId = req.params.variantId;
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
  return res.json({
    success: true,
    data: {
      product: responseData,
    },
  });
}
export async function restoreProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found.",
    });
  }
  product.deletedAt = null;
  await product.save();
  return res.json({
    success: true,
    message:
      "Product restored. It will appear to customers when its category, publication status and stock allow it.",
  });
}
