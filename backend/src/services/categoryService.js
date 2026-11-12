// Manage categories and decide which categories appear in the store.

import { CategoryStatus } from "../constants/statuses.js";
import { createValidationError } from "../utils/validation.js";
import { getFormData, validateFormFields, validateText, validateId, validateBoolean } from "../utils/formValidation.js";
import { checkCatalogQuery, checkCatalogParams, checkCatalogStatus } from "./catalogService.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { createError } from "../utils/httpError.js";
import { uploadCatalogImages, removeCatalogImages } from "./catalogImageService.js";

// The controller passes request data here and sends the result back to the browser.

export async function addCategory(requestData) {
  requestData.category = validateCategoryForm(getFormData(requestData.body));
  if (requestData.files && requestData.files.length > 1)
    throw createValidationError("Choose only one category image.");
  const { name, parentId, isListed } = requestData.category;
  // "Laptops" and "  LAPTOPS  " must not create two categories.
  const nameKey = name.replace(/\s+/g, " ").toLowerCase();
  const duplicate = await Category.exists({
    nameKey,
  });
  if (duplicate) {
    return {
      status: 409,
      body: {
        success: false,
        message: "A category with this name already exists.",
      },
    };
  }

  // We allow a main category and its subcategories, with no third level.
  let parent = null;
  if (parentId) {
    parent = await Category.findById(parentId);
    if (!parent || parent.deletedAt || parent.parent) {
      return {
        status: 400,
        body: {
          success: false,
          message: "Choose an existing main category as the parent.",
        },
      };
    }
  }
  const category = new Category();
  category.name = name;
  category.nameKey = nameKey;
  category.isListed = isListed;
  if (parentId) {
    category.parent = parentId;
  }

  // Image processing stays in the existing helper because products also use it.
  const uploadedImages = await uploadCatalogImages(requestData.files || []);
  if (uploadedImages.length > 0) {
    category.image = uploadedImages[0];
  }
  try {
    await category.save();
  } catch (error) {
    // If saving fails, remove the new image so it is not left unused in Cloudinary.
    await removeCatalogImages(uploadedImages);
    throw error;
  }
  let parentCategoryId = null;
  let parentName = "";
  let parentListed = true;
  if (parent) {
    parentCategoryId = String(parent._id);
    parentName = parent.name;
    parentListed = parent.isListed;
  }
  let image = null;
  if (category.image) {
    image = {
      id: String(category.image._id),
      url: category.image.url,
    };
  }
  return {
    status: 201,
    body: {
      success: true,
      message: "Category saved.",
      data: {
        category: {
          id: String(category._id),
          name: category.name,
          parentId: parentCategoryId,
          parentName,
          parentListed,
          isListed: category.isListed,
          createdAt: category.createdAt,
          image,
        },
      },
    },
  };
}
export async function listCategories(requestData) {
  requestData.filters = checkCatalogQuery(requestData.query);
  // Choose the matching categories, count them, and load the requested page.
  const query = requestData.filters;
  const filter = {
    deletedAt: null,
  };
  if (query.status === CategoryStatus.DELETED) {
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
  if (query.status === CategoryStatus.LISTED) {
    filter.isListed = true;
  }
  if (query.status === CategoryStatus.UNLISTED) {
    filter.isListed = false;
  }
  if (query.options === "true") {
    const categories = await Category.find({
      deletedAt: null,
    })
      .populate("parent", "name isListed deletedAt")
      .sort({
        name: 1,
      })
      .lean();
    const options = [];
    for (const category of categories) {
      if (!category.parent || !category.parent.deletedAt) {
        options.push(formatCategory(category));
      }
    }
    return {
      status: 200,
      body: {
        success: true,
        data: {
          categories: options,
        },
      },
    };
  }
  const total = await Category.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const categories = await Category.find(filter)
    .populate("parent", "name isListed deletedAt")
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .skip((page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  const results = [];
  for (const category of categories) {
    const item = formatCategory(category);
    const categoryIds = await getCategoryIdsWithChildren(category._id);
    item.productCount = await Product.countDocuments({
      category: {
        $in: categoryIds,
      },
      deletedAt: null,
    });
    item.subcategoryCount = await Category.countDocuments({
      parent: category._id,
      deletedAt: null,
    });
    results.push(item);
  }
  const all = await Category.countDocuments({
    deletedAt: null,
  });
  const listed = await Category.countDocuments({
    deletedAt: null,
    isListed: true,
  });
  const deleted = await Category.countDocuments({
    deletedAt: {
      $ne: null,
    },
  });
  return {
    status: 200,
    body: {
      success: true,
      data: {
        categories: results,
        summary: {
          total: all,
          listed,
          unlisted: all - listed,
          deleted,
        },
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
export async function saveCategory(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  requestData.category = validateCategoryForm(getFormData(requestData.body));
  if (requestData.files && requestData.files.length > 1)
    throw createValidationError("Choose only one category image.");
  const id = requestData.params.id;
  const categoryData = requestData.category;
  const files = requestData.files || [];
  const category = await Category.findById(id);
  if (!category || category.deletedAt) {
    throw createError("Category not found.", 404);
  }
  if (files.length > 1) {
    throw createError("Choose only one category image.");
  }
  if (categoryData.parentId) {
    if (categoryData.parentId === id) {
      throw createError("A category cannot be its own parent.");
    }
    const parent = await Category.findById(categoryData.parentId);
    if (!parent || parent.deletedAt || parent.parent) {
      throw createError("Choose an existing main category as the parent.");
    }
    const hasChildren = await Category.exists({
      parent: id,
    });
    if (hasChildren) {
      throw createError(
        "Move this category's subcategories before making it a subcategory.",
      );
    }
  }
  const nameKey = categoryData.name.replace(/\s+/g, " ").toLowerCase();
  if (
    await Category.exists({
      nameKey,
      _id: {
        $ne: id,
      },
    })
  ) {
    throw createError("A category with this name already exists.", 409);
  }
  const previousImage = category.image;
  const uploaded = await uploadCatalogImages(files);
  category.name = categoryData.name;
  category.nameKey = nameKey;
  category.parent = categoryData.parentId || null;
  category.isListed = categoryData.isListed;
  if (uploaded.length > 0) {
    category.image = uploaded[0];
  } else if (!categoryData.keepImage) {
    category.image = null;
  }
  try {
    await category.save();
  } catch (error) {
    await removeCatalogImages(uploaded);
    throw error;
  }
  if (
    previousImage &&
    String(previousImage._id) !== String(category.image?._id)
  ) {
    await removeCatalogImages([previousImage]);
  }
  await category.populate("parent", "name isListed deletedAt");
  const responseData = formatCategory(category);
  return {
    status: 200,
    body: {
      success: true,
      message: "Category saved.",
      data: {
        category: responseData,
      },
    },
  };
}
export async function setCategoryListed(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  requestData.data = checkCatalogStatus(requestData.body);
  const id = requestData.params.id;
  const isListed = requestData.data.isListed;
  const category = await Category.findOneAndUpdate(
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
  ).populate("parent", "name isListed deletedAt");
  if (!category) {
    throw createError("Category not found.", 404);
  }
  const responseData = formatCategory(category);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        category: responseData,
      },
    },
  };
}
export async function deleteCategory(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  if (requestData.body?.confirmDelete !== true) {
    return {
      status: 400,
      body: {
        success: false,
        message: "Confirm deletion of this category.",
      },
    };
  }
  const category = await Category.findById(requestData.params.id);
  if (!category) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Category not found.",
      },
    };
  }
  // Mark the category as deleted. Keep its details and images so it can be restored.
  category.deletedAt = new Date();
  await category.save();
  return {
    status: 200,
    body: {
      success: true,
      message:
        "Category deleted. Its products and subcategories are hidden from customers. You can restore it later.",
    },
  };
}
export async function restoreCategory(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  const category = await Category.findById(requestData.params.id);
  if (!category) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Category not found.",
      },
    };
  }
  category.deletedAt = null;
  await category.save();
  return {
    status: 200,
    body: {
      success: true,
      message: "Category restored. Its original listing status has been kept.",
    },
  };
}

export function formatCategory(category) {
  // Send only the fields the frontend needs; keep Cloudinary publicId private.
  let parentId = null;
  let parentName = "";
  let parentListed = true;
  if (category.parent) {
    parentId = String(category.parent._id || category.parent);
    parentName = category.parent.name || "";
    parentListed = category.parent.isListed && !category.parent.deletedAt;
  }
  let image = null;
  if (category.image) {
    image = {
      id: String(category.image._id),
      url: category.image.url,
    };
  }
  return {
    id: String(category._id),
    name: category.name,
    parentId,
    parentName,
    parentListed,
    isListed: category.isListed,
    deletedAt: category.deletedAt || null,
    createdAt: category.createdAt,
    image,
  };
}

export async function getCategoryIdsWithChildren(id) {
  const children = await Category.find({
    parent: id,
    deletedAt: null,
  }).select("_id");
  const ids = [id];
  for (const child of children) {
    ids.push(child._id);
  }
  return ids;
}

export async function getVisibleCategories() {
  // A listed child is still hidden when its parent is unlisted or deleted.
  const categories = await Category.find({
    isListed: true,
    deletedAt: null,
  })
    .populate("parent", "name isListed deletedAt")
    .sort({
      name: 1,
    });
  const visible = [];
  for (const category of categories) {
    if (category.deletedAt) {
      continue;
    }
    if (
      category.parent &&
      (!category.parent.isListed || category.parent.deletedAt)
    ) {
      continue;
    }
    visible.push(category);
  }
  return visible;
}

export function validateCategoryForm(formData) {
  validateFormFields(formData, ["name", "parentId", "isListed", "keepImage"]);
  const name = validateText(
    formData.name,
    "name",
    2,
    80,
    "Enter a category name with at least 2 characters.",
  );
  let parentId = "";
  if (formData.parentId !== undefined && formData.parentId !== "") {
    parentId = validateId(formData.parentId, "parentId").toLowerCase();
  }
  return {
    name,
    parentId,
    isListed: validateBoolean(formData.isListed, "isListed"),
    keepImage: validateBoolean(formData.keepImage, "keepImage"),
  };
}
