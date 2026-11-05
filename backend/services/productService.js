import { readFormBody } from "../utils/formValidation.js";
import { checkProductInput } from "../utils/validators/product.js";
import {
  checkCatalogQuery,
  checkCatalogParams,
  checkCatalogStatus,
} from "../utils/validators/catalog.js";
// Application steps. Input is a plain object; the controller sends the response.
import { publicProduct } from "../utils/product.js";
import { categoryPopulation } from "../utils/productAvailability.js";
import { categoryAndChildren } from "../utils/category.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { httpError } from "../utils/httpError.js";
import {
  uploadCatalogImages,
  removeCatalogImages,
} from "../services/catalogImageService.js";
export async function listProducts(input) {
  input.filters = checkCatalogQuery(input.query);
  const query = input.filters;
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
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function getProduct(input) {
  input.params = checkCatalogParams(input.params);
  const id = input.params.id;
  const product = await Product.findById(id).populate(categoryPopulation);
  if (!product || product.deletedAt) {
    throw httpError("Product not found.", 404);
  }
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
export async function saveProduct(input) {
  if (input.params?.id) input.params = checkCatalogParams(input.params);
  input.data = checkProductInput(readFormBody(input.body));
  // Validate ownership/category, upload new images, save, then clean up old images.
  const id = input.params.id;
  const data = input.data;
  const files = input.files || [];
  let product;
  if (id) {
    product = await Product.findById(id);
  } else {
    product = new Product();
  }
  if (!product || product.deletedAt) {
    throw httpError("Product not found.", 404);
  }
  const categoryExists = await Category.exists({
    _id: data.categoryId,
    deletedAt: null,
  });
  if (!categoryExists) {
    throw httpError("Choose an existing category.");
  }
  if (
    !product.variants.length &&
    (data.price === undefined || data.stock === undefined)
  ) {
    throw httpError("Enter a price and stock quantity.");
  }
  if (
    product.variants.length &&
    (data.price !== undefined ||
      data.stock !== undefined ||
      data.regularPrice !== undefined)
  ) {
    throw httpError("Manage price and stock on the variants page.");
  }
  // Only this product's existing images may be kept by the submitted form.
  const retained = data.retainedImageIds.map((id) => product.images.id(id));
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
    (image) => !data.retainedImageIds.includes(String(image._id)),
  );
  const uploaded = await uploadCatalogImages(files);
  product.name = data.name;
  product.description = data.description;
  product.series = data.series;
  product.subtitle = data.subtitle;
  product.badge = data.badge;
  product.priceNote = data.priceNote;
  product.quickSpecs = data.quickSpecs;
  product.category = data.categoryId;
  product.isPublished = data.isPublished;
  product.isListed = data.isListed;
  product.highlights = data.highlights;
  product.specifications = data.specifications;
  product.images = [...retained, ...uploaded];
  // Clear a variant image choice if that gallery image was removed.
  for (const variant of product.variants) {
    if (variant.imageId && !product.images.id(variant.imageId)) {
      variant.imageId = null;
    }
  }
  if (!product.variants.length) {
    product.pricePaise = data.price;
    product.regularPricePaise = data.regularPrice ?? null;
    product.stock = data.stock;
  }
  try {
    await product.save();
  } catch (error) {
    // New uploads must not be left unused when the database save fails.
    await removeCatalogImages(uploaded);
    throw error;
  }
  await removeCatalogImages(removed);
  await product.populate(categoryPopulation);
  const responseData = publicProduct(product);
  return {
    status: input.params.id ? 200 : 201,
    body: {
      success: true,
      message: "Product saved.",
      data: {
        product: responseData,
      },
    },
  };
}
export async function setProductListed(input) {
  input.params = checkCatalogParams(input.params);
  input.data = checkCatalogStatus(input.body);
  const id = input.params.id;
  const isListed = input.data.isListed;
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
export async function deleteProduct(input) {
  input.params = checkCatalogParams(input.params);
  const product = await Product.findById(input.params.id);
  if (!product) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Product not found.",
      },
    };
  }
  // Soft-delete preserves the product, variants and images for restoration.
  product.deletedAt = new Date();
  await product.save();
  return {
    status: 200,
    body: {
      success: true,
      message:
        "Product deleted. Its images and variants are kept for restoration.",
    },
  };
}
export async function restoreProduct(input) {
  input.params = checkCatalogParams(input.params);
  const product = await Product.findById(input.params.id);
  if (!product) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Product not found.",
      },
    };
  }
  product.deletedAt = null;
  await product.save();
  return {
    status: 200,
    body: {
      success: true,
      message:
        "Product restored. It will appear to customers when its category, publication status and stock allow it.",
    },
  };
}
