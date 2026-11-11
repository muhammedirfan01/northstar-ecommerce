import Order from "../models/order.js";
import { CustomerStatus } from "../constants/statuses.js";
import {
  checkCustomerQuery,
  checkCustomerId,
  checkCustomerStatus,
  checkCustomerPhotoQuery,
} from "../utils/validators/admin.js";
// Application steps. Input is a plain object; the controller sends the response.
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import { Types } from "mongoose";

// Convert MongoDB user into frontend-friendly data
function customerData(user, apiBaseUrl) {
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
export async function getCustomers(input) {
  try {
    input.filters = checkCustomerQuery(input.query);
  } catch (error) {
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  const { page, limit, search, status } = input.filters;
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
    customerData(customer, input.apiBaseUrl),
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
export async function setCustomerStatus(input) {
  checkCustomerId(input.params);
  try {
    input.statusChange = {
      params: input.params,
      body: checkCustomerStatus(input.body),
    };
  } catch (error) {
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  const { id } = input.statusChange.params;
  const { isBlocked } = input.statusChange.body;
  if (id === String(input.user._id)) {
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
        customer: customerData(customer, input.apiBaseUrl),
      },
    },
  };
}

// View one customer
export async function getCustomer(input) {
  checkCustomerId(input.params);
  const customer = await User.findOne({
    _id: input.params.id,
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
  addresses.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return {
    status: 200,
    body: {
      success: true,
      data: {
        customer: {
          ...customerData(customer, input.apiBaseUrl),
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
export async function deleteCustomer(input) {
  checkCustomerId(input.params);
  const customer = await User.findOneAndUpdate(
    {
      _id: input.params.id,
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
        customer: customerData(customer, input.apiBaseUrl),
      },
    },
  };
}

// Restore deleted customer
export async function restoreCustomer(input) {
  checkCustomerId(input.params);
  const customer = await User.findOneAndUpdate(
    {
      _id: input.params.id,
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
        customer: customerData(customer, input.apiBaseUrl),
      },
    },
  };
}
export async function getDashboard(input) {
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
export async function getCustomerPhoto(input) {
  checkCustomerId(input.params);
  checkCustomerPhotoQuery(input.query);
  const customer = await User.findOne({
    _id: input.params.id,
    role: "customer",
    deletedAt: null,
  }).select("profileImage +profilePhoto");
  if (
    !customer?.profilePhoto ||
    customer.profileImage !== `/profile/photo/${input.query.version}`
  ) {
    return null;
  }
  return customer.profilePhoto;
}
