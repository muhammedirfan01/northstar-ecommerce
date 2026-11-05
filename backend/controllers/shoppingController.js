import * as wishlistService from "../services/wishlistService.js";
import * as cartService from "../services/cartService.js";

export async function getCart(req, res) {
  const result = await cartService.getCart({
    user: req.user,
  });
  return res.status(result.status).json(result.body);
}

export async function addToCart(req, res) {
  const result = await cartService.addToCart({
    user: req.user,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function setQuantity(req, res) {
  const result = await cartService.setQuantity({
    user: req.user,
    params: req.params,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function removeCartItem(req, res) {
  const result = await cartService.removeCartItem({
    user: req.user,
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}

export async function checkout(req, res) {
  const result = await cartService.checkout({
    user: req.user,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function getWishlist(req, res) {
  const result = await wishlistService.getWishlist({
    user: req.user,
  });
  return res.status(result.status).json(result.body);
}

export async function addWish(req, res) {
  const result = await wishlistService.addWish({
    user: req.user,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function removeWish(req, res) {
  const result = await wishlistService.removeWish({
    user: req.user,
    params: req.params,
  });
  return res.status(result.status).json(result.body);
}
