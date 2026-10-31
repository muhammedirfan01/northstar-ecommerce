import { request } from "./request.js";

export const shopApi = {
  products: (query, signal) =>
    request(`/products?${new URLSearchParams(query)}`, { signal }),
  product: (id, signal) => request(`/products/${id}`, { signal }),
  reviews: (id, page, signal) =>
    request(`/products/${id}/reviews?page=${page}`, { signal }),
  reviewEligibility: (id, signal) =>
    request(`/products/${id}/review-eligibility`, { signal }),
  saveReview: (id, body) =>
    request(`/products/${id}/reviews`, { method: "POST", body }),
  categories: (signal) => request("/products/categories", { signal }),
  cart: (signal) => request("/cart", { signal }),
  addToCart: (body) => request("/cart", { method: "POST", body }),
  quantity: (id, quantity) =>
    request(`/cart/${id}`, { method: "PATCH", body: { quantity } }),
  removeFromCart: (id) => request(`/cart/${id}`, { method: "DELETE" }),
  checkout: (expectedTotalPaise) =>
    request("/cart/checkout", { method: "POST", body: { expectedTotalPaise } }),
  wishlist: (signal) => request("/wishlist", { signal }),
  saveWish: (productId) =>
    request("/wishlist", { method: "POST", body: { productId } }),
  removeWish: (id) => request(`/wishlist/${id}`, { method: "DELETE" }),
};
