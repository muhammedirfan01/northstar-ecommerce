import test from "node:test";
import assert from "node:assert/strict";
import Campaign from "../src/models/Campaign.js";
import Coupon from "../src/models/Coupon.js";
import Product from "../src/models/Product.js";
import User from "../src/models/User.js";
import { previewOrder } from "../src/services/checkoutService.js";

const productId = "111111111111111111111111";
const addressId = "222222222222222222222222";
const userId = "333333333333333333333333";

async function previewWithCoupon(t, { pricePaise, maxDiscountPaise = null }) {
  const previousEnv = process.env;
  process.env = {
    ...previousEnv,
    RAZORPAY_KEY_ID: "rzp_test_checkout",
    RAZORPAY_KEY_SECRET: "checkout-test-secret",
  };
  t.after(() => { process.env = previousEnv; });

  t.mock.method(User, "findById", () => ({
    select: async () => ({
      addresses: { id: () => ({
        fullName: "Test Customer",
        phoneNumber: "+919876543210",
        addressLine1: "Test Road",
        city: "Kochi",
        state: "Kerala",
        postalCode: "682001",
      }) },
      walletBalancePaise: 0,
    }),
  }));
  t.mock.method(Campaign, "find", () => ({
    sort() { return this; },
    session() { return this; },
    lean: async () => [],
  }));
  t.mock.method(Product, "find", () => ({
    session() { return this; },
    populate: async () => [{
      _id: productId,
      name: "Headphones",
      isListed: true,
      isPublished: true,
      category: { isListed: true },
      pricePaise,
      stock: 1,
      variants: [],
      images: [],
    }],
  }));
  t.mock.method(Coupon, "findOne", () => ({
    session: async () => ({
      isActive: true,
      startDate: new Date(Date.now() - 60_000),
      expiryDate: new Date(Date.now() + 60_000),
      discountType: "percentage",
      discountValue: 100,
      minPurchasePaise: 0,
      maxDiscountPaise,
      usageLimit: null,
    }),
  }));
  const response = await previewOrder({
    user: { id: userId },
    body: {
      addressId,
      couponCode: "FREE100",
      buyNow: { productId, quantity: 1 },
    },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.data;
}

test("an uncapped 100% coupon with free shipping leaves zero due and disables Razorpay", async (t) => {
  const quote = await previewWithCoupon(t, { pricePaise: 60000 });

  assert.equal(quote.couponDiscount, 60000);
  assert.equal(quote.shippingCharge, 0);
  assert.equal(quote.totalAmount, 0);
  assert.deepEqual(quote.paymentMethods, { wallet: true, cod: true, razorpay: false });
});

test("a 100% coupon discounts merchandise and preserves paid shipping", async (t) => {
  const quote = await previewWithCoupon(t, { pricePaise: 40000 });

  assert.equal(quote.couponDiscount, 40000);
  assert.equal(quote.shippingCharge, 5000);
  assert.equal(quote.totalAmount, 5000);
  assert.equal(quote.paymentMethods.razorpay, true);
});

test("a capped coupon with 99 paise due disables Razorpay", async (t) => {
  const quote = await previewWithCoupon(t, { pricePaise: 60000, maxDiscountPaise: 59901 });

  assert.equal(quote.couponDiscount, 59901);
  assert.equal(quote.totalAmount, 99);
  assert.equal(quote.paymentMethods.razorpay, false);
});

test("Razorpay is available at its exact 100 paise minimum", async (t) => {
  const quote = await previewWithCoupon(t, { pricePaise: 60000, maxDiscountPaise: 59900 });

  assert.equal(quote.couponDiscount, 59900);
  assert.equal(quote.totalAmount, 100);
  assert.equal(quote.paymentMethods.razorpay, true);
});
