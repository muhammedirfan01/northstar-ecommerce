import * as shopping from "../services/shoppingService.js";

export async function getCart(req, res) {
  return res.json({ success: true, data: await shopping.getCart(req.user.id) });
}
export async function addToCart(req, res) {
  return res.json({
    success: true,
    data: await shopping.addToCart(req.user.id, req.shoppingInput),
  });
}
export async function setQuantity(req, res) {
  return res.json({
    success: true,
    data: await shopping.setCartQuantity(
      req.user.id,
      req.params.id,
      req.shoppingInput.quantity,
    ),
  });
}
export async function removeCartItem(req, res) {
  return res.json({
    success: true,
    data: await shopping.removeCartItem(req.user.id, req.params.id),
  });
}
export async function checkout(req, res) {
  return res.json({
    success: true,
    data: await shopping.validateCheckout(
      req.user.id,
      req.shoppingInput.expectedTotalPaise,
    ),
  });
}
export async function getWishlist(req, res) {
  return res.json({
    success: true,
    data: await shopping.getWishlist(req.user.id),
  });
}
export async function addWish(req, res) {
  return res.json({
    success: true,
    data: await shopping.addWish(req.user.id, req.shoppingInput.productId),
  });
}
export async function removeWish(req, res) {
  return res.json({
    success: true,
    data: await shopping.removeWish(req.user.id, req.params.id),
  });
}
