import User from "../models/User.js";
import Order from "../models/Order.js";
import { Types } from "mongoose";

// Convert MongoDB user into frontend-friendly data
function customerData(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    profileImage: user.profileImage?.startsWith("/profile/photo/")
      ? `/admin/customers/${user._id}/photo?version=${user.profileImage.split("/").pop()}`
      : user.profileImage || "",
    isEmailVerified: user.isEmailVerified,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
}

// Count orders and returned orders
async function getOrderCounts(customerId) {
  const [totalOrders, returnedOrders] = await Promise.all([
    Order.countDocuments({ customer: customerId }),
    Order.countDocuments({ customer: customerId, status: "returned" }),
  ]);

  return { totalOrders, returnedOrders };
}

// Get customers
export async function getCustomers(req, res) {
  const { page, limit, search, status } = req.customerQuery;

  const filter = {
    role: "customer",
    deletedAt: null,
  };

  if (status !== "all") {
    filter.isBlocked = status === "blocked";
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");

    filter.$or = [
      { name: pattern },
      { email: pattern },
    ];

    if (Types.ObjectId.isValid(search) && /^[a-f0-9]{24}$/i.test(search)) {
      filter.$or.push({ _id: new Types.ObjectId(search) });
    }
  }

  const total = await User.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);

  const customers = await User.find(filter)
    .select("_id name email phone profileImage isEmailVerified isBlocked createdAt")
    .sort({ createdAt: -1, _id: -1 })
    .skip((currentPage - 1) * limit)
    .limit(limit)
    .lean();

  const customerList = await Promise.all(
    customers.map(async customer => ({
      ...customerData(customer),
      ...await getOrderCounts(customer._id),
    }))
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

  return res.json({
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
  });
}

// Block or unblock customer
export async function setCustomerStatus(req, res) {
  const { id } = req.customerStatus.params;
  const { isBlocked } = req.customerStatus.body;

  if (id === String(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: "You cannot change your own account status.",
    });
  }

  const customer = await User.findOne({
    _id: id,
    role: "customer",
    deletedAt: null,
  }).select("+authVersion");

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found.",
    });
  }

  if (customer.isBlocked !== isBlocked) {
    customer.isBlocked = isBlocked;
    customer.authVersion = (customer.authVersion ?? 0) + 1;
    await customer.save();
  }

  return res.json({
    success: true,
    message: isBlocked ? "Customer blocked." : "Customer unblocked.",
    data: { customer: customerData(customer) },
  });
}

// View one customer
export async function getCustomer(req, res) {
  const customer = await User.findOne({
    _id: req.params.id,
    role: "customer",
    deletedAt: null,
  }).select("+addresses +defaultAddressId +walletBalancePaise");

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found.",
    });
  }

  const orderCounts = await getOrderCounts(customer._id);

  const addresses = customer.addresses.map(address => ({
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

  return res.json({
    success: true,
    data: {
      customer: {
        ...customerData(customer),
        ...orderCounts,
        addresses,
        walletBalancePaise: customer.walletBalancePaise ?? 0,
        currency: "INR",
      },
    },
  });
}

// Get customer profile photo
export async function getCustomerPhoto(req, res) {
  const customer = await User.findOne({
    _id: req.params.id,
    role: "customer",
    deletedAt: null,
  }).select("profileImage +profilePhoto");

  if (
    !customer?.profilePhoto ||
    customer.profileImage !== `/profile/photo/${req.query.version}`
  ) {
    return res.status(404).json({
      success: false,
      message: "Photo not found.",
    });
  }

  res.set({
    "Content-Type": "image/jpeg",
    "X-Content-Type-Options": "nosniff",
  });

  return res.send(customer.profilePhoto);
}

// Delete customer (soft delete)
export async function deleteCustomer(req, res) {
  const customer = await User.findOneAndUpdate(
    {
      _id: req.params.id,
      role: "customer",
      deletedAt: null,
    },
    {
      $set: { deletedAt: new Date() },
      $inc: { authVersion: 1 },
    },
    { returnDocument: "after" }
  );

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found.",
    });
  }

  return res.json({
    success: true,
    message: "Customer deleted.",
    data: { customer: customerData(customer) },
  });
}

// Restore deleted customer
export async function restoreCustomer(req, res) {
  const customer = await User.findOneAndUpdate(
    {
      _id: req.params.id,
      role: "customer",
      deletedAt: { $ne: null },
    },
    {
      $set: { deletedAt: null },
      $inc: { authVersion: 1 },
    },
    { returnDocument: "after" }
  );

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found.",
    });
  }

  return res.json({
    success: true,
    message: "Customer restored.",
    data: { customer: customerData(customer) },
  });
}

