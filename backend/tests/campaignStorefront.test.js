import test from "node:test";
import assert from "node:assert/strict";
import Product from "../src/models/Product.js";
import Campaign from "../src/models/Campaign.js";
import Category from "../src/models/Category.js";
import { formatStoreProduct, formatAdminProduct } from "../src/services/catalogService.js";
import { getCartItemDetails, getCartDetails, getWishlistDetails } from "../src/services/shoppingService.js";
import { listProducts, getProduct } from "../src/services/storeService.js";
import { calculateOrder } from "../src/services/orderService.js";

const now = new Date("2026-11-11T10:00:00Z");
const category = { _id: "111111111111111111111111", name: "Phones", isListed: true };
function fixture() {
  const doc = new Product({
    _id: "222222222222222222222222", name: "Phone", pricePaise: 10000,
    stock: 10, isListed: true, isPublished: true, images: [],
    variants: [{ name: "Large", pricePaise: 20000, stock: 10, isListed: true }],
  });
  return { ...doc.toObject(), variants: doc.variants, category };
}
const offer = {
  _id: "333333333333333333333333", name: "Phone sale", scope: "category",
  targetId: category._id, discountType: "percentage", discountValue: 10,
  isActive: true, startDate: new Date("2020-01-01"), expiryDate: new Date("2099-01-01"),
};
const query = (value) => {
  const result = {};
  for (const key of ["populate", "sort", "select", "collation", "skip", "limit", "session"])
    result[key] = () => result;
  result.lean = async () => value;
  result.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  return result;
};

test("customer and variant prices match checkout discounts without changing admin/base prices", () => {
  const product = fixture();
  const data = formatStoreProduct(product, [offer], now);
  assert.equal(data.pricePaise, 18000);
  assert.equal(data.regularPricePaise, 20000);
  assert.equal(data.variants[0].pricePaise, 18000);
  assert.equal(data.variants[0].offer.name, offer.name);
  assert.equal(formatAdminProduct(product).pricePaise, 20000);
  assert.equal(product.variants[0].pricePaise, 20000);
  for (const change of [{ isActive: false }, { startDate: "2090-01-01" }, { expiryDate: "2020-01-01" }, { targetId: "other" }]) {
    assert.equal(formatStoreProduct(product, [{ ...offer, ...change }], now).pricePaise, 20000);
  }
  const plain = { ...product, variants: [], regularPricePaise: 12000 };
  const free = formatStoreProduct(plain, [{ ...offer, discountType: "fixed", discountValue: 50000 }], now);
  assert.equal(free.pricePaise, 0);
  assert.equal(free.regularPricePaise, 12000);
});

test("cart, wishlist, product detail and checkout use the same current offer once", async (t) => {
  const product = fixture();
  const item = { _id: "line", productId: product._id, variantId: product.variants[0]._id, quantity: 2 };
  t.mock.method(Product, "find", () => query([product]));
  t.mock.method(Product, "findOne", () => query(product));
  t.mock.method(Category, "find", () => query([category]));
  t.mock.method(Campaign, "find", () => query([offer]));
  const cart = await getCartDetails({ cart: [item] });
  assert.equal(cart.items[0].unitPricePaise, 18000);
  assert.equal(cart.totalPaise, 36000);
  assert.equal(cart.canCheckout, true);
  assert.equal(getCartItemDetails(item, product, [{ ...offer, isActive: false }], now).unitPricePaise, 20000);
  const wish = await getWishlistDetails({ wishlist: [product._id] });
  assert.equal(wish.products[0].pricePaise, 18000);
  const detail = await getProduct({ params: { id: String(product._id) } });
  assert.equal(detail.body.data.product.pricePaise, 18000);
  assert.equal(detail.body.data.related[0].pricePaise, 18000);
  const addressId = "444444444444444444444444";
  const result = await calculateOrder({
    user: { addresses: { id: () => ({ fullName: "Test User", phoneNumber: "9876543210", addressLine1: "Test", city: "Test", state: "Test", postalCode: "123456" }) } },
    body: { addressId, buyNow: { productId: String(product._id), variantId: String(item.variantId), quantity: 2 } },
    offers: [offer],
  });
  assert.equal(result.status, 200);
  assert.equal(result.checkout.offerDiscount, 4000);
  assert.equal(result.checkout.shippingCharge, 5000);
  assert.equal(result.checkout.totalAmount, cart.totalPaise + result.checkout.shippingCharge);
  assert.equal(result.checkout.items[0].unitPricePaise, 20000);
});

test("price filtering and sorting include campaign prices before pagination", async (t) => {
  const discounted = { ...fixture(), variants: [], pricePaise: 20000 };
  const ordinary = { ...discounted, _id: "555555555555555555555555", pricePaise: 15000 };
  t.mock.method(Category, "find", () => query([category]));
  t.mock.method(Product, "find", (filter) => {
    assert.equal(filter.pricePaise, undefined);
    return query([ordinary, discounted]);
  });
  t.mock.method(Campaign, "find", () => query([{ ...offer, scope: "product", targetId: discounted._id, discountValue: 50 }]));
  const result = await listProducts({ query: { sort: "price-asc", maxPrice: "160", limit: "1", page: "1" } });
  assert.equal(result.body.data.products[0].id, String(discounted._id));
  assert.equal(result.body.data.products[0].pricePaise, 10000);
  assert.equal(result.body.data.pagination.total, 2);
});
