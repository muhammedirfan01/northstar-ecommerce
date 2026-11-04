import API from "../../api/API.js";

export async function getCart(signal) {
  const response = await API.get("/cart", { signal });
  return response.data.data;
}

export async function addCartItem(
  productId,
  variantId = null,
  quantity = 1,
  signal,
) {
  const response = await API.post(
    "/cart",
    { productId, variantId, quantity },
    { signal },
  );
  return response.data.data;
}
