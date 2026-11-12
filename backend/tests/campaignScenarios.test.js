import test from "node:test";
import assert from "node:assert/strict";
import Product from "../src/models/Product.js";
import Coupon from "../src/models/Coupon.js";
import Order from "../src/models/Order.js";
import { findBestOffer, formatStoreProduct } from "../src/services/catalogService.js";
import { getCartItemDetails } from "../src/services/shoppingService.js";
import { calculateOrder } from "../src/services/orderService.js";
import { offerLabel, selectedOffer } from "../../northstar/src/utils/offers.js";

const now = new Date("2026-11-11T12:00:00Z");
const ids = [1, 2, 3, 4, 5].map(n => String(n).repeat(24));
const category = { _id: ids[1], isListed: true, parent: { _id: ids[2], isListed: true } };
const campaign = {
  _id: ids[3], name: "Five rupees", scope: "all", isActive: true,
  discountType: "fixed", discountValue: 500,
  startDate: "2020-01-01", expiryDate: "2099-01-01",
};
function fixture(variants = false) {
  const doc = new Product({ _id: ids[0], name: "Phone", pricePaise: 70000,
    regularPricePaise: 100000, isListed: true, isPublished: true, stock: 10,
    images: [], variants: variants ? [{ name: "Pro", pricePaise: 90000, regularPricePaise: 120000, stock: 10, isListed: true }] : [],
  });
  return { ...doc.toObject(), variants: doc.variants, category };
}

test("fixed ₹5 is labeled as currency despite a 30% existing markdown", () => {
  const data = formatStoreProduct(fixture(), [campaign], now);
  assert.equal(data.pricePaise, 69500);
  assert.equal(data.regularPricePaise, 100000);
  assert.equal(data.offer.discountType, "fixed");
  assert.match(offerLabel(data.offer), /5\.00 off per unit$/);
  assert.ok(!offerLabel(data.offer).includes("%"));
  assert.equal(selectedOffer(data, { offer: undefined }), undefined);
  assert.equal(selectedOffer(data, null), data.offer);
});

test("all, product, category and parent-category campaigns agree across variants and quantities", () => {
  for (const variants of [false, true]) for (const quantity of [1, 2, 9]) {
    const product = fixture(variants);
    for (const [scope, targetId] of [["all", null], ["product", ids[0]], ["category", ids[1]], ["category", ids[2]]]) {
      for (const [discountType, discountValue] of [["fixed", 500], ["percentage", 5]]) {
        const offer = { ...campaign, scope, targetId, discountType, discountValue };
        const base = variants ? 90000 : 70000;
        const perUnit = discountType === "fixed" ? 500 : Math.floor(base * discountValue / 100);
        const productData = formatStoreProduct(product, [offer], now);
        const cart = getCartItemDetails({ productId: ids[0], variantId: product.variants[0]?._id, quantity }, product, [offer], now);
        assert.equal(productData.pricePaise, base - perUnit);
        assert.equal(cart.subtotalPaise, (base - perUnit) * quantity);
        assert.equal(findBestOffer(product, base, quantity, [offer], now).discount, perUnit * quantity);
        assert.equal(cart.offer.discountType, discountType);
        assert.equal(cart.offer.discountPaise, perUnit);
      }
    }
  }
});

test("inactive, future, expired and unrelated campaigns do not apply; boundaries are exact", () => {
  const product = fixture();
  for (const change of [{ isActive: false }, { startDate: "2090-01-01" }, { expiryDate: now }, { scope: "product", targetId: ids[4] }, { scope: "category", targetId: ids[4] }]) {
    assert.equal(findBestOffer(product, 70000, 2, [{ ...campaign, ...change }], now), null);
    assert.equal(formatStoreProduct(product, [{ ...campaign, ...change }], now).offer, undefined);
  }
  assert.equal(findBestOffer(product, 70000, 1, [{ ...campaign, startDate: now }], now).discount, 500);
});

test("best offer does not stack campaigns, fixed discounts cap at price, percentages round per unit", () => {
  const product = fixture();
  const percent = { ...campaign, _id: ids[4], discountType: "percentage", discountValue: 10 };
  const result = findBestOffer(product, 70000, 2, [campaign, percent], now);
  assert.equal(result.discountType, "percentage");
  assert.equal(result.discount, 14000);
  assert.equal(findBestOffer(product, 300, 9, [campaign], now).discount, 2700);
  assert.equal(findBestOffer(product, 101, 2, [percent], now).discount, 20);
  assert.equal(findBestOffer(product, 0, 1, [campaign], now), null);
  const free = formatStoreProduct({ ...product, pricePaise: 300 }, [campaign], now);
  assert.match(offerLabel(free.offer), /3\.00 off per unit$/);
});

test("checkout multiplies ₹5 per unit once and applies coupons after campaign savings", async (t) => {
  const product = fixture(true);
  t.mock.method(Product, "find", () => ({ session() { return this; }, populate: async () => [product] }));
  t.mock.method(Coupon, "findOne", () => ({ session: async () => ({ _id: ids[4], isActive: true,
    startDate: new Date("2020-01-01"), expiryDate: new Date("2099-01-01"), minPurchasePaise: 0,
    usageLimit: null, discountType: "percentage", discountValue: 10, maxDiscountPaise: null }) }));
  const result = await calculateOrder({
    user: { addresses: { id: () => ({ fullName: "Test", phoneNumber: "9876543210", addressLine1: "Test", city: "Test", state: "Test", postalCode: "123456" }) } },
    body: { addressId: ids[4], couponCode: "TEN", buyNow: { productId: ids[0], variantId: String(product.variants[0]._id), quantity: 3 } },
    offers: [campaign],
  });
  assert.equal(result.status, 200);
  const quote = result.checkout;
  assert.equal(quote.subtotal, 270000);
  assert.equal(quote.offerDiscount, 1500);
  assert.equal(quote.couponDiscount, 26850);
  assert.equal(quote.totalAmount, 241650);
  assert.equal(quote.appliedOffers[0].discountPaise, 500);
  assert.equal(quote.appliedOffers[0].quantity, 3);
  assert.equal(String(quote.appliedOffers[0].variantId), String(product.variants[0]._id));
  const saved = new Order({ appliedOffers: quote.appliedOffers }).toObject().appliedOffers[0];
  assert.equal(saved.discountType, "fixed");
  assert.equal(saved.discountValue, 500);
  assert.equal(saved.quantity, 3);
  assert.match(offerLabel(saved), /5\.00 off per unit$/);
});
