import { checkShoppingAdd } from "../utils/validators/shopping.js";
import { DEFAULT_SETTINGS } from "../models/StoreSettings.js";
import { bestOffer } from "../utils/offerPricing.js";
import mongoose from "mongoose";
import ShoppingList from "../models/ShoppingList.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import { categoryPopulation } from "../utils/productAvailability.js";
import { MAX_CART_QUANTITY } from "../constants/shopping.js";

// One validation/calculation path is shared by preview and transactional placement.
export async function checkout(input) {
  const fail = (status, message) => ({
    status,
    body: { success: false, message },
  });
  try {
    const list = input.body.buyNow
      ? { cart: [checkShoppingAdd(input.body.buyNow)] }
      : await ShoppingList.findOne({ userId: input.user._id }).session(input.session || null);
    if (!list || !list.cart.length) return fail(400, "cart is empty");
    const products = await Product.find({
      _id: { $in: list.cart.map((item) => item.productId) },
    })
      .session(input.session || null)
      .populate(categoryPopulation);
    const items = [];
    let subtotal = 0,
      offerDiscount = 0;
    const appliedOffers = [],
      settings = input.settings || DEFAULT_SETTINGS;
    for (const item of list.cart) {
      const product = products.find(
        (p) => String(p._id) === String(item.productId),
      );
      const category = product?.category;
      if (
        !product ||
        !product.isListed ||
        product.deletedAt ||
        !product.isPublished ||
        (input.enforceAvailability &&
          (!category?.isListed ||
            category.deletedAt ||
            (category.parent &&
              (!category.parent.isListed || category.parent.deletedAt))))
      )
        return fail(400, "Product is unavailable");
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_CART_QUANTITY
      )
        return fail(400, "Invalid quantity");
      let variant = null;
      if (product.variants.length) {
        variant = product.variants.id(item.variantId);
        if (!variant || !variant.isListed)
          return fail(400, "Variant is unavailable");
      } else if (item.variantId) return fail(400, "Variant is unavailable");
      const option = variant || product;
      if (option.stock < item.quantity) return fail(409, "Insufficient stock");
      const lineTotalPaise = option.pricePaise * item.quantity;
      if (!Number.isSafeInteger(lineTotalPaise) || lineTotalPaise < 0)
        return fail(400, "Invalid product price");
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
      const offer = bestOffer(
        product,
        option.pricePaise,
        item.quantity,
        input.offers,
      );
      if (offer) {
        offerDiscount += offer.discount;
        appliedOffers.push(offer);
      }
    }
    const { addressId, couponCode } = input.body;
    const eligibleSubtotal = subtotal - offerDiscount;
    let discount = 0,
      couponId = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
        deletedAt: null,
      }).session(input.session || null);
      if (!coupon || !coupon.isActive) return fail(400, "Invalid coupon");
      const now = new Date();
      if (now < coupon.startDate || now >= coupon.expiryDate)
        return fail(400, "Coupon expired or not started");
      if (eligibleSubtotal < coupon.minPurchasePaise)
        return fail(400, "Minimum purchase amount not reached");
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
        return fail(409, "Coupon usage limit reached");
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
      return fail(400, "Invalid address ID");
    const address = input.user.addresses?.id(addressId);
    if (!address) return fail(400, "select a valid delivery address");
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
        settings.freeShippingAbovePaise !== null &&
        subtotal > settings.freeShippingAbovePaise
          ? 0
          : settings.shippingChargePaise,
      tax = Math.round(
        ((subtotal - discount) * settings.taxBasisPoints) / 10000,
      );
    const totalAmount = subtotal + shippingCharge + tax - discount;
    if (![subtotal, discount, totalAmount].every(Number.isSafeInteger))
      return fail(400, "Invalid order total");
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
        storeSnapshot: {
          storeName: settings.storeName,
          supportEmail: settings.supportEmail,
          supportPhone: settings.supportPhone,
          invoiceAddress: settings.invoiceAddress,
        },
        totalAmount,
        couponId,
        cartId: list._id,
        cartVersion: list.__v ?? 0,
      },
    };
  } catch (error) {
    if (input.session) throw error; // Let MongoDB retry transient transaction errors.
    console.error(error.message);
    return fail(500, "Something went wrong");
  }
}
