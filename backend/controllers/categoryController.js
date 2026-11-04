import { publicCategory, categoryAndChildren } from "../utils/category.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { httpError } from "../utils/httpError.js";
import {
  uploadCatalogImages,
  removeCatalogImages,
} from "../services/catalogImageService.js";
export async function addCategory(req, res) {
  const { name, parentId, isListed } = req.categoryInput;

  // "Laptops" and "  LAPTOPS  " must not create two categories.
  const nameKey = name.replace(/\s+/g, " ").toLowerCase();
  const duplicate = await Category.exists({
    nameKey,
  });
  if (duplicate) {
    return res.status(409).json({
      success: false,
      message: "A category with this name already exists.",
    });
  }

  // We allow a main category and its subcategories, with no third level.
  let parent = null;
  if (parentId) {
    parent = await Category.findById(parentId);
    if (!parent || parent.deletedAt || parent.parent) {
      return res.status(400).json({
        success: false,
        message: "Choose an existing main category as the parent.",
      });
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
  const uploadedImages = await uploadCatalogImages(req.files || []);
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
  return res.status(201).json({
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
  });
}
export async function listCategories(req, res) {
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
  if (query.status === "listed") {
    filter.isListed = true;
  }
  if (query.status === "unlisted") {
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
        options.push(publicCategory(category));
      }
    }
    return res.json({
      success: true,
      data: {
        categories: options,
      },
    });
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
    const item = publicCategory(category);
    const categoryIds = await categoryAndChildren(category._id);
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
  return res.json({
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
  });
}
export async function saveCategory(req, res) {
  const id = req.params.id;
  const input = req.categoryInput;
  const files = req.files || [];
  const category = await Category.findById(id);
  if (!category || category.deletedAt) {
    throw httpError("Category not found.", 404);
  }
  if (files.length > 1) {
    throw httpError("Choose only one category image.");
  }
  if (input.parentId) {
    if (input.parentId === id) {
      throw httpError("A category cannot be its own parent.");
    }
    const parent = await Category.findById(input.parentId);
    if (!parent || parent.deletedAt || parent.parent) {
      throw httpError("Choose an existing main category as the parent.");
    }
    if (
      id &&
      (await Category.exists({
        parent: id,
      }))
    ) {
      throw httpError(
        "Move this category's subcategories before making it a subcategory.",
      );
    }
  }
  const nameKey = input.name.replace(/\s+/g, " ").toLowerCase();
  if (
    await Category.exists({
      nameKey,
      _id: {
        $ne: id,
      },
    })
  ) {
    throw httpError("A category with this name already exists.", 409);
  }
  const previousImage = category.image;
  const uploaded = await uploadCatalogImages(files);
  category.name = input.name;
  category.nameKey = nameKey;
  category.parent = input.parentId || null;
  category.isListed = input.isListed;
  if (uploaded.length > 0) {
    category.image = uploaded[0];
  } else if (!input.keepImage) {
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
  const responseData = publicCategory(category);
  return res.status(200).json({
    success: true,
    message: "Category saved.",
    data: {
      category: responseData,
    },
  });
}
export async function setCategoryListed(req, res) {
  const id = req.params.id;
  const isListed = req.catalogInput.isListed;
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
    throw httpError("Category not found.", 404);
  }
  const responseData = publicCategory(category);
  return res.json({
    success: true,
    data: {
      category: responseData,
    },
  });
}
export async function deleteCategory(req, res) {
  if (req.body?.confirmDelete !== true) {
    return res.status(400).json({
      success: false,
      message: "Confirm deletion of this category.",
    });
  }
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found.",
    });
  }
  category.deletedAt = new Date();
  await category.save();
  return res.json({
    success: true,
    message:
      "Category deleted. Its products and subcategories are hidden from customers. You can restore it later.",
  });
}
export async function restoreCategory(req, res) {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found.",
    });
  }
  category.deletedAt = null;
  await category.save();
  return res.json({
    success: true,
    message: "Category restored. Its original listing status has been kept.",
  });
}
