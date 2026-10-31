import { request } from "./request.js";

export const categoryApi = {
  list: (query, signal) =>
    request(`/admin/categories?${new URLSearchParams(query)}`, { signal }),
  save: (id, body) =>
    request(id ? `/admin/categories/${id}` : "/admin/categories", {
      method: id ? "PATCH" : "POST",
      body,
    }),
  setListed: (id, isListed) =>
    request(`/admin/categories/${id}/status`, {
      method: "PATCH",
      body: { isListed },
    }),
  remove: (id) =>
    request(`/admin/categories/${id}`, {
      method: "DELETE",
      body: { confirmDelete: true },
    }),
};

export const productApi = {
  list: (query, signal) =>
    request(`/admin/products?${new URLSearchParams(query)}`, { signal }),
  get: (id, signal) => request(`/admin/products/${id}`, { signal }),
  save: (id, body) =>
    request(id ? `/admin/products/${id}` : "/admin/products", {
      method: id ? "PATCH" : "POST",
      body,
    }),
  setListed: (id, isListed) =>
    request(`/admin/products/${id}/status`, {
      method: "PATCH",
      body: { isListed },
    }),
  remove: (id) => request(`/admin/products/${id}`, { method: "DELETE" }),
  saveVariant: (productId, id, body) =>
    request(`/admin/products/${productId}/variants${id ? `/${id}` : ""}`, {
      method: id ? "PATCH" : "POST",
      body,
    }),
  reviews: (id, page, signal) =>
    request(`/admin/products/${id}/reviews?page=${page}`, { signal }),
  reviewStatus: (id, reviewId, isListed) =>
    request(`/admin/products/${id}/reviews/${reviewId}`, {
      method: "PATCH",
      body: { isListed },
    }),
  removeReview: (id, reviewId) =>
    request(`/admin/products/${id}/reviews/${reviewId}`, { method: "DELETE" }),
  removeVariant: (productId, id) =>
    request(`/admin/products/${productId}/variants/${id}`, {
      method: "DELETE",
    }),
};
