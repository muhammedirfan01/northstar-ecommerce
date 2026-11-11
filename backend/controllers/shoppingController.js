import { makeServiceInput } from "./makeServiceInput.js";
import * as wishlistService from "../services/wishlistService.js";
import * as cartService from "../services/cartService.js";

export async function getCart(req, res) {
  const result = await cartService.getCart(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function addToCart(req, res) {
  const result = await cartService.addToCart(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function setQuantity(req, res) {
  const result = await cartService.setQuantity(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function removeCartItem(req, res) {
  const result = await cartService.removeCartItem(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function checkout(req, res) {
  const result = await cartService.checkout(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function getWishlist(req, res) {
  const result = await wishlistService.getWishlist(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function addWish(req, res) {
  const result = await wishlistService.addWish(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function removeWish(req, res) {
  const result = await wishlistService.removeWish(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
