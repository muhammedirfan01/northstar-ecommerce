import { test as base, expect } from "playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ids = { product: "222222222222222222222222", order: "333333333333333333333333", address: "444444444444444444444444" };
const image = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export const test = base.extend({
  store: async ({ page }, provide) => {
    const buildDirectory = fileURLToPath(new URL("../../test-dist/", import.meta.url));
    await page.route("http://localhost:5175/**", async route => {
      const pathname = new URL(route.request().url()).pathname;
      const filename = pathname.startsWith("/assets/") ? pathname.slice(1) : "index.html";
      const filePath = path.resolve(buildDirectory, filename);
      if (!filePath.startsWith(path.resolve(buildDirectory) + path.sep)) throw Error("Unexpected asset path");
      return route.fulfill({ path: filePath });
    });
    const product = { id: ids.product, name: "Test Headphones", description: "Wireless headphones for daily use.",
      stock: 9, pricePaise: 60000, regularPricePaise: null, available: true, variants: [],
      images: [{ id: "image-one", url: image }], highlights: [], specifications: [],
      category: { id: "audio", name: "Audio" } };
    const item = { id: "cart-line", productId: ids.product, name: product.name, image,
      quantity: 1, unitPricePaise: 60000, subtotalPaise: 60000, maxQuantity: 9, available: true, valid: true };
    const orderItem = { productId: ids.product, productName: product.name, productImage: image,
      quantity: 1, unitPricePaise: 60000, lineTotalPaise: 60000 };
    const state = {
      user: { id: "111111111111111111111111", name: "Test Customer", email: "customer@example.test", role: "customer", phone: "", profileImage: "", isEmailVerified: true },
      product,
      cart: { items: [item], quantityTotal: 1, totalPaise: 60000, canCheckout: true },
      quote: { items: [orderItem], subtotal: 60000, shippingCharge: 0, tax: 0, discount: 0,
        offerDiscount: 0, couponDiscount: 0, totalAmount: 60000, walletBalancePaise: 0,
        paymentMethods: { cod: true, razorpay: true, wallet: false } },
      order: { id: ids.order, orderId: "NS-0001", items: [orderItem], subtotal: 60000,
        shippingCharge: 0, tax: 0, discount: 0, couponDiscount: 0, totalAmount: 60000,
        paymentMethod: "cod", paymentStatus: "pending", orderStatus: "confirmed",
        createdAt: "2026-11-18T00:00:00Z", statusHistory: [], paymentHistory: [], returnHistory: [],
        returnRequest: { status: "none" }, refund: { status: "none" },
        shippingAddress: { name: "Test Customer", addressLine1: "123 Main Street", city: "Kochi",
          state: "Kerala", pincode: "682001", phone: "+919876543210" } },
      calls: [], handlers: {}, unexpected: [],
    };
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api/, "");
      const key = `${request.method()} ${path}`;
      const body = request.postDataJSON();
      state.calls.push({ key, body, search: url.search });
      const reply = (data, status = 200) => route.fulfill({ status, json: { success: true, data } });
      const custom = state.handlers[key];
      if (custom) return custom({ route, request, body, reply, state });
      if (key === "GET /auth/me") return state.user ? reply({ user: state.user }) : route.fulfill({ status: 401, json: { message: "Please sign in." } });
      if (key === "GET /products/categories") return reply({ categories: [] });
      if (key === "GET /support") return reply({ storeName: "NORTHSTAR", email: "support@example.test", phone: "", address: "" });
      if (key === "GET /products") return reply({ products: [product], pagination: { page: 1, total: 1, totalPages: 1 } });
      if (key === `GET /products/${ids.product}`) return reply({ product, related: [] });
      if (key === "GET /cart") return reply(state.cart);
      if (key === "GET /wishlist") return reply({ products: [] });
      if (key === "GET /addresses") return reply({ version: 0, maxAddresses: 10, addresses: [{
        id: ids.address, fullName: "Test Customer", phoneNumber: "+919876543210", addressLine1: "123 Main Street",
        city: "Kochi", state: "Kerala", postalCode: "682001", isDefault: true,
      }] });
      if (key === "POST /orders/preview") return reply(state.quote);
      if (key === "GET /orders") return reply({ orders: [], pagination: { total: 0, page: 1, totalPages: 1, limit: 4 } });
      if (key === `GET /orders/${ids.order}`) return reply({ order: state.order });
      if (key === "GET /wallet") return reply({ walletId: "TEST-WALLET", balancePaise: 0, transactions: [], total: 0, page: 1, pages: 1 });
      state.unexpected.push(key);
      return route.fulfill({ status: 500, json: { message: `Missing test fixture for ${key}` } });
    });
    // Images and third-party scripts are irrelevant to these behavior checks.
    await page.route(/^https:\/\//, route => route.abort());
    await provide(state);
    expect(state.unexpected, "All API calls should have a deliberate test response").toEqual([]);
  },
});
export { expect };
