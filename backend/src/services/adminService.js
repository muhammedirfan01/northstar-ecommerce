// Load dashboard totals and manage customer accounts.

import Order from "../models/Order.js";
import { CustomerStatus } from "../constants/statuses.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import { Types } from "mongoose";
import { createValidationError } from "../utils/validation.js";
import { validateFormFields, validateQueryNumber, validateText, validateChoice, validateBoolean } from "../utils/formValidation.js";

// The controller passes request data here and sends the result back to the browser.

// Convert MongoDB user into frontend-friendly data
function formatCustomer(user, apiBaseUrl) {
  let profileImage = user.profileImage?.startsWith("/profile/photo/")
    ? `/admin/customers/${user._id}/photo?version=${user.profileImage.split("/").pop()}`
    : user.profileImage || "";
  if (apiBaseUrl && profileImage.startsWith("/admin/customers/"))
    profileImage = apiBaseUrl + profileImage;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    profileImage: profileImage,
    isEmailVerified: user.isEmailVerified,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
}

// Get customers
export async function getCustomers(requestData) {
  try {
    requestData.filters = validateCustomerFilters(requestData.query);
  } catch (error) {
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  const { page, limit, search, status } = requestData.filters;
  const filter = {
    role: "customer",
    deletedAt: null,
  };
  if (status !== CustomerStatus.ALL) {
    filter.isBlocked = status === CustomerStatus.BLOCKED;
  }
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");
    filter.$or = [
      {
        name: pattern,
      },
      {
        email: pattern,
      },
    ];
    if (Types.ObjectId.isValid(search) && /^[a-f0-9]{24}$/i.test(search)) {
      filter.$or.push({
        _id: new Types.ObjectId(search),
      });
    }
  }
  const total = await User.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const customers = await User.find(filter)
    .select(
      "_id name email phone profileImage isEmailVerified isBlocked createdAt",
    )
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .skip((currentPage - 1) * limit)
    .limit(limit)
    .lean();
  const customerList = customers.map((customer) =>
    formatCustomer(customer, requestData.apiBaseUrl),
  );
  const totalCustomers = await User.countDocuments({
    role: "customer",
    deletedAt: null,
  });
  const blocked = await User.countDocuments({
    role: "customer",
    deletedAt: null,
    isBlocked: true,
  });
  return {
    status: 200,
    body: {
      success: true,
      data: {
        customers: customerList,
        summary: {
          total: totalCustomers,
          active: totalCustomers - blocked,
          blocked,
        },
        pagination: {
          page: currentPage,
          limit,
          total,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrevious: currentPage > 1,
        },
      },
    },
  };
}

// Block or unblock customer
export async function setCustomerStatus(requestData) {
  validateCustomerId(requestData.params);
  try {
    requestData.statusChange = {
      params: requestData.params,
      body: validateCustomerStatus(requestData.body),
    };
  } catch (error) {
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  const { id } = requestData.statusChange.params;
  const { isBlocked } = requestData.statusChange.body;
  if (id === String(requestData.user._id)) {
    return {
      status: 403,
      body: {
        success: false,
        message: "You cannot change your own account status.",
      },
    };
  }
  const customer = await User.findOne({
    _id: id,
    role: "customer",
    deletedAt: null,
  }).select("+authVersion");
  if (!customer) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Customer not found.",
      },
    };
  }
  if (customer.isBlocked !== isBlocked) {
    customer.isBlocked = isBlocked;
    customer.authVersion = (customer.authVersion ?? 0) + 1;
    await customer.save();
  }
  return {
    status: 200,
    body: {
      success: true,
      message: isBlocked ? "Customer blocked." : "Customer unblocked.",
      data: {
        customer: formatCustomer(customer, requestData.apiBaseUrl),
      },
    },
  };
}

// View one customer
export async function getCustomer(requestData) {
  validateCustomerId(requestData.params);
  const customer = await User.findOne({
    _id: requestData.params.id,
    role: "customer",
    deletedAt: null,
  }).select("+addresses +defaultAddressId +walletBalancePaise");
  if (!customer) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Customer not found.",
      },
    };
  }
  const addresses = customer.addresses.map((address) => ({
    id: String(address._id),
    fullName: address.fullName,
    phoneNumber: address.phoneNumber,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    label: address.label,
    isDefault: String(address._id) === String(customer.defaultAddressId),
  }));
  addresses.sort((firstAddress, secondAddress) => Number(secondAddress.isDefault) - Number(firstAddress.isDefault));
  return {
    status: 200,
    body: {
      success: true,
      data: {
        customer: {
          ...formatCustomer(customer, requestData.apiBaseUrl),
          addresses,
          walletBalancePaise: customer.walletBalancePaise ?? 0,
          currency: "INR",
        },
      },
    },
  };
}

// Get customer profile photo

// Delete customer (soft delete)
export async function deleteCustomer(requestData) {
  validateCustomerId(requestData.params);
  const customer = await User.findOneAndUpdate(
    {
      _id: requestData.params.id,
      role: "customer",
      deletedAt: null,
    },
    {
      $set: {
        deletedAt: new Date(),
      },
      $inc: {
        authVersion: 1,
      },
    },
    {
      returnDocument: "after",
    },
  );
  if (!customer) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Customer not found.",
      },
    };
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "Customer deleted.",
      data: {
        customer: formatCustomer(customer, requestData.apiBaseUrl),
      },
    },
  };
}

// Restore deleted customer
export async function restoreCustomer(requestData) {
  validateCustomerId(requestData.params);
  const customer = await User.findOneAndUpdate(
    {
      _id: requestData.params.id,
      role: "customer",
      deletedAt: {
        $ne: null,
      },
    },
    {
      $set: {
        deletedAt: null,
      },
      $inc: {
        authVersion: 1,
      },
    },
    {
      returnDocument: "after",
    },
  );
  if (!customer) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Customer not found.",
      },
    };
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "Customer restored.",
      data: {
        customer: formatCustomer(customer, requestData.apiBaseUrl),
      },
    },
  };
}
export async function getDashboard(requestData) {
  const orders = await Order.countDocuments({});
  const returns = await Order.countDocuments({
    "returnRequest.status": { $in: ["requested", "accepted", "rejected", "completed", "cancelled"] },
  });
  const customers = await User.countDocuments({
    role: "customer",
    deletedAt: null,
  });
  const products = await Product.countDocuments({
    deletedAt: null,
  });
  const categories = await Category.countDocuments({
    deletedAt: null,
  });
  const publishedProducts = await Product.countDocuments({
    deletedAt: null,
    isPublished: true,
    isListed: true,
  });
  return {
    status: 200,
    body: {
      success: true,
      data: {
        customers,
        products,
        categories,
        publishedProducts,
        orders,
        returns,
      },
    },
  };
}
export async function getCustomerPhoto(requestData) {
  validateCustomerId(requestData.params);
  validateCustomerPhotoFilters(requestData.query);
  const customer = await User.findOne({
    _id: requestData.params.id,
    role: "customer",
    deletedAt: null,
  }).select("profileImage +profilePhoto");
  if (
    !customer?.profilePhoto ||
    customer.profileImage !== `/profile/photo/${requestData.query.version}`
  ) {
    return null;
  }
  return customer.profilePhoto;
}

export function validateCustomerFilters(searchOptions) {
  validateFormFields(searchOptions, ["page", "limit", "search", "status"]);
  const query = {
    page: 1,
    limit: 10,
    search: "",
    status: CustomerStatus.ALL,
  };
  if (searchOptions.page !== undefined)
    query.page = validateQueryNumber(searchOptions.page, "page", 1, 10000, true);
  if (searchOptions.limit !== undefined)
    query.limit = validateQueryNumber(searchOptions.limit, "limit", 1, 50, true);
  if (searchOptions.search !== undefined)
    query.search = validateText(searchOptions.search, "search", 0, 100);
  if (searchOptions.status !== undefined)
    query.status = validateChoice(searchOptions.status, "status", Object.values(CustomerStatus));
  return query;
}
export function validateCustomerStatus(formData) {
  validateFormFields(formData, ["isBlocked"]);
  return {
    isBlocked: validateBoolean(formData.isBlocked, "isBlocked"),
  };
}

export function validateCustomerId(params) {
  if (!/^[a-f0-9]{24}$/i.test(params?.id)) {
    const error = createValidationError("Invalid customer ID.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}

export function validateCustomerPhotoFilters(query) {
  const uuid =
    /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  if (
    !query ||
    Object.keys(query).length !== 1 ||
    typeof query.version !== "string" ||
    !uuid.test(query.version)
  ) {
    const error = createValidationError("Invalid photo version.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}
