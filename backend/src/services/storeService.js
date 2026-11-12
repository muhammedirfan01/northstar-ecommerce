// Show the categories and products that customers can buy.

import { checkCatalogParams, formatStoreProduct, productIsAvailable, categoryDetails } from "./catalogService.js";
import Product from "../models/Product.js";
import { getVisibleCategories, getCategoryIdsWithChildren, formatCategory } from "./categoryService.js";
import { getActiveOffers } from "./campaignService.js";
import { createValidationError } from "../utils/validation.js";
import { validateFormFields, validateText, validateId, validateChoice, validateQueryNumber } from "../utils/formValidation.js";

// The controller passes request data here and sends the result back to the browser.

// Use this rule for customer-facing catalog requests. Admin lists intentionally show hidden items.
async function getStoreProductFilter() {
  const categories = await getVisibleCategories();
  return {
    isListed: true,
    deletedAt: null,
    isPublished: true,
    stock: {
      $gt: 0,
    },
    category: {
      $in: categories.map((category) => category._id),
    },
  };
}
export async function listCategories(requestData) {
  const categories = await getVisibleCategories();
  return {
    status: 200,
    body: {
      success: true,
      data: {
        categories: categories.map(formatCategory),
      },
    },
  };
}
export async function listProducts(requestData) {
  requestData.filters = validateStoreFilters(requestData.query);
  const query = requestData.filters;
  const filter = await getStoreProductFilter();
  if (query.category) {
    // Keep the visibility filter AND the chosen category filter.
    // Replacing filter.category would accidentally allow hidden categories.
    filter.$and = [
      {
        category: {
          $in: await getCategoryIdsWithChildren(query.category),
        },
      },
    ];
  }
  if (query.subcategory) {
    // Intersect the child with parent and visibility filters; never replace them.
    filter.$and ||= [];
    filter.$and.push({ category: query.subcategory });
  }
  if (query.search) {
    filter.name = new RegExp(
      query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.pricePaise = {};
    if (query.minPrice !== undefined) {
      filter.pricePaise.$gte = Math.round(query.minPrice * 100);
    }
    if (query.maxPrice !== undefined) {
      filter.pricePaise.$lte = Math.round(query.maxPrice * 100);
    }
  }
  const sorts = {
    latest: {
      createdAt: -1,
      _id: -1,
    },
    "price-asc": {
      pricePaise: 1,
      _id: 1,
    },
    "price-desc": {
      pricePaise: -1,
      _id: 1,
    },
    "name-asc": {
      name: 1,
      _id: 1,
    },
    "name-desc": {
      name: -1,
      _id: 1,
    },
  };
  const offers = await getActiveOffers();
  const now = new Date();
  // Available variants and campaigns determine the displayed price.
  // Filter and sort that price before pagination.
  if (query.sort.startsWith("price-") || filter.pricePaise) {
    delete filter.pricePaise;
    const records = await Product.find(filter)
      .populate(categoryDetails)
      .collation({ locale: "en", strength: 2 })
      .sort(sorts[query.sort]);
    let products = records.filter(productIsAvailable)
      .map((product) => formatStoreProduct(product, offers, now))
      .filter((product) =>
        (query.minPrice === undefined || product.pricePaise >= Math.round(query.minPrice * 100)) &&
        (query.maxPrice === undefined || product.pricePaise <= Math.round(query.maxPrice * 100)));
    if (query.sort.startsWith("price-")) {
      const direction = query.sort === "price-asc" ? 1 : -1;
      products.sort((firstProduct, secondProduct) => direction * (firstProduct.pricePaise - secondProduct.pricePaise) || firstProduct.id.localeCompare(secondProduct.id));
    }
    const total = products.length;
    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    const page = Math.min(query.page, totalPages);
    products = products.slice((page - 1) * query.limit, page * query.limit);
    return { status: 200, body: { success: true, data: {
      products, pagination: { page, limit: query.limit, total, totalPages },
    } } };
  }
  const total = await Product.countDocuments(filter);
  // Keep at least one page, including when the search has no matches.
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const products = await Product.find(filter)
    .populate(categoryDetails)
    .collation({
      locale: "en",
      strength: 2,
    })
    .sort(sorts[query.sort])
    .skip((page - 1) * query.limit)
    .limit(query.limit);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        products: products.filter(productIsAvailable).map((product) => formatStoreProduct(product, offers, now)),
        pagination: {
          page,
          limit: query.limit,
          total,
          totalPages,
        },
      },
    },
  };
}
export async function getProduct(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  const id = requestData.params.id;
  const filter = await getStoreProductFilter();
  const product = await Product.findOne({
    ...filter,
    _id: id,
  }).populate(categoryDetails);
  if (!productIsAvailable(product)) {
    return {
      status: 404,
      body: {
        success: false,
        message: "This product is unavailable. Browse other products.",
      },
    };
  }
  const offers = await getActiveOffers();
  const now = new Date();
  const related = await Product.find({
    ...filter,
    _id: {
      $ne: product._id,
    },
    $and: [
      {
        category: product.category._id,
      },
    ],
  })
    .populate(categoryDetails)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(4);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        product: formatStoreProduct(product, offers, now),
        related: related.filter(productIsAvailable).map((product) => formatStoreProduct(product, offers, now)),
      },
    },
  };
}

export function validateStoreFilters(searchOptions) {
  validateFormFields(searchOptions, [
    "search",
    "category",
    "subcategory",
    "minPrice",
    "maxPrice",
    "sort",
    "page",
    "limit",
  ]);
  const query = {};
  if (searchOptions.search === undefined) {
    query.search = "";
  } else {
    query.search = validateText(searchOptions.search, "search", 0, 100);
  }
  if (searchOptions.category !== undefined) {
    query.category = validateId(searchOptions.category, "category", "Invalid category.");
  }
  if (searchOptions.subcategory !== undefined) {
    query.subcategory = validateId(searchOptions.subcategory, "subcategory", "Invalid subcategory.");
  }
  if (searchOptions.minPrice !== undefined) {
    query.minPrice = validateQueryNumber(
      searchOptions.minPrice,
      "minPrice",
      0,
      99999999.99,
    );
  }
  if (searchOptions.maxPrice !== undefined) {
    query.maxPrice = validateQueryNumber(
      searchOptions.maxPrice,
      "maxPrice",
      0,
      99999999.99,
    );
  }
  query.sort = validateChoice(
    searchOptions.sort === undefined ? "latest" : searchOptions.sort,
    "sort",
    ["latest", "price-asc", "price-desc", "name-asc", "name-desc"],
  );
  if (searchOptions.page === undefined) {
    query.page = 1;
  } else {
    query.page = validateQueryNumber(searchOptions.page, "page", 1, 10000, true);
  }
  if (searchOptions.limit === undefined) {
    query.limit = 12;
  } else {
    query.limit = validateQueryNumber(searchOptions.limit, "limit", 1, 50, true);
  }
  if (
    query.minPrice !== undefined &&
    query.maxPrice !== undefined &&
    query.minPrice > query.maxPrice
  ) {
    throw createValidationError("Invalid form.", "form");
  }
  return query;
}
