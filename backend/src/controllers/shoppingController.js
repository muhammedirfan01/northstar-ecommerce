import { inputFrom } from "./requestInput.js";
import * as wishlistService from "../services/wishlistService.js";
import * as cartService from "../services/cartService.js";

export async function getCart(req, res) {
  const result = await cartService.getCart(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function addToCart(req, res) {
  const result = await cartService.addToCart(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function updateCartItem(req, res) {
  const result = await cartService.updateCartItem(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function removeCartItem(req, res) {
  const result = await cartService.removeCartItem(inputFrom(req));
  return res.status(result.status).json(result.body);
}


export async function getWishlist(req, res) {
  const result = await wishlistService.getWishlist(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function addToWishlist(req, res) {
  const result = await wishlistService.addToWishlist(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function removeFromWishlist(req, res) {
  const result = await wishlistService.removeFromWishlist(inputFrom(req));
  return res.status(result.status).json(result.body);
}
