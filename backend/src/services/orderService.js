// Check the selected products and calculate order prices, discounts and shipping.

import { STORE } from "../constants/store.js";
import { validateCartItem } from "../utils/shoppingValidation.js";
import { findBestOffer, categoryDetails } from "./catalogService.js";
import mongoose from "mongoose";
import ShoppingList from "../models/ShoppingList.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import { MAX_CART_QUANTITY } from "../constants/shopping.js";

// Order preview and order placement use these same product checks and price calculations.
export async function calculateOrder(formData) {
  const errorResponse = (status, message) => ({
    status,
    body: { success: false, message },
  });
  try {
    const list = formData.body.buyNow
      ? { cart: [validateCartItem(formData.body.buyNow)] }
      : await ShoppingList.findOne({ userId: formData.user._id }).session(formData.session || null);
    if (!list || !list.cart.length) return errorResponse(400, "cart is empty");
    const products = await Product.find({
      _id: { $in: list.cart.map((item) => item.productId) },
    })
      .session(formData.session || null)
      .populate(categoryDetails);
    const items = [];
    let subtotal = 0,
      offerDiscount = 0;
    const appliedOffers = [];
    for (const item of list.cart) {
      const product = products.find(
        (product) => String(product._id) === String(item.productId),
      );
      const category = product?.category;
      if (
        !product ||
        !product.isListed ||
        product.deletedAt ||
        !product.isPublished ||
        (formData.enforceAvailability &&
          (!category?.isListed ||
            category.deletedAt ||
            (category.parent &&
              (!category.parent.isListed || category.parent.deletedAt))))
      )
        return errorResponse(400, "Product is unavailable");
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_CART_QUANTITY
      )
        return errorResponse(400, "Invalid quantity");
      let variant = null;
      if (product.variants.length) {
        variant = product.variants.id(item.variantId);
        if (!variant || !variant.isListed)
          return errorResponse(400, "Variant is unavailable");
      } else if (item.variantId) return errorResponse(400, "Variant is unavailable");
      const option = variant || product;
      if (option.stock < item.quantity) return errorResponse(409, "Insufficient stock");
      const lineTotalPaise = option.pricePaise * item.quantity;
      if (!Number.isSafeInteger(lineTotalPaise) || lineTotalPaise < 0)
        return errorResponse(400, "Invalid product price");
      items.push({
        productId: product._id,
        variantId: variant?._id ?? null,
        productName: product.name,
        variantName: variant?.name ?? "",
        productImage: variant?.images[0]?.url ?? product.images[0]?.url ?? "",
        quantity: item.quantity,
        unitPricePaise: option.pricePaise,
        lineTotalPaise,
      });
      subtotal += lineTotalPaise;
      const offer = findBestOffer(
        product,
        option.pricePaise,
        item.quantity,
        formData.offers,
      );
      if (offer) {
        offerDiscount += offer.discount;
        appliedOffers.push({ ...offer, variantId: variant?._id ?? null });
      }
    }
    const { addressId, couponCode } = formData.body;
    const eligibleSubtotal = subtotal - offerDiscount;
    let discount = 0,
      couponId = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
        deletedAt: null,
      }).session(formData.session || null);
      if (!coupon || !coupon.isActive) return errorResponse(400, "Invalid coupon");
      const now = new Date();
      if (now < coupon.startDate || now >= coupon.expiryDate)
        return errorResponse(400, "Coupon expired or not started");
      if (eligibleSubtotal < coupon.minPurchasePaise)
        return errorResponse(400, "Minimum purchase amount not reached");
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
        return errorResponse(409, "Coupon usage limit reached");
      discount =
        coupon.discountType === "percentage"
          ? Math.floor((eligibleSubtotal * coupon.discountValue) / 100)
          : coupon.discountValue;
      if (coupon.maxDiscountPaise !== null)
        discount = Math.min(discount, coupon.maxDiscountPaise);
      discount = Math.min(discount, eligibleSubtotal);
      couponId = coupon._id;
    }
    if (!mongoose.isValidObjectId(addressId))
      return errorResponse(400, "Invalid address ID");
    const address = formData.user.addresses?.id(addressId);
    if (!address) return errorResponse(400, "select a valid delivery address");
    const shippingAddress = {
      name: address.fullName,
      phone: address.phoneNumber,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || "",
      city: address.city,
      state: address.state,
      pincode: address.postalCode,
    };
    const couponDiscount = discount;
    discount += offerDiscount;
    const shippingCharge =
      STORE.freeShippingAbovePaise !== null && subtotal > STORE.freeShippingAbovePaise
        ? 0
        : STORE.shippingChargePaise;
    const tax = Math.round(((subtotal - discount) * STORE.taxBasisPoints) / 10000);
    const totalAmount = subtotal + shippingCharge + tax - discount;
    if (![subtotal, discount, totalAmount].every(Number.isSafeInteger))
      return errorResponse(400, "Invalid order total");
    return {
      status: 200,
      body: { success: true, message: "checkout validated sucessfully" },
      checkout: {
        items,
        shippingAddress,
        subtotal,
        shippingCharge,
        tax,
        discount,
        offerDiscount,
        couponDiscount,
        appliedOffers,
        totalAmount,
        couponId,
        cartId: list._id,
        cartVersion: list.__v ?? 0,
      },
    };
  } catch (error) {
    if (formData.session) throw error; // Let MongoDB retry a temporary database failure.
    console.error(error.message);
    return errorResponse(500, "Something went wrong");
  }
}
