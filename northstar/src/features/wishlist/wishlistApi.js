import API from "../../api/API.js";

export async function getWishlist(signal) {
  const response = await API.get("/wishlist", { signal });
  return response.data.data;
}

export async function addWishlistItem(productId, signal) {
  const response = await API.post("/wishlist", { productId }, { signal });
  return response.data.data;
}

export async function removeWishlistItem(productId, signal) {
  const response = await API.delete(`/wishlist/${productId}`, { signal });
  return response.data.data;
}
