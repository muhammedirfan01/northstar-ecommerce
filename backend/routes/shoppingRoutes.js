import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../middlewares/auth.js";
import { validateCatalogId } from "../middlewares/validateCatalog.js";
import { validateShopping } from "../middlewares/validateShopping.js";
import * as shopping from "../controllers/shoppingController.js";

const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many shopping changes. Please wait and try again.",
  },
});
function requireCustomer(req, res, next) {
  res.set("Cache-Control", "no-store");
  if (req.user.role !== "customer")
    return res
      .status(403)
      .json({ success: false, message: "Use a customer account to shop." });
  next();
}
router.use(["/cart", "/wishlist"], requireAuth, requireCustomer);
router.get("/cart", shopping.getCart);
router.post("/cart", limiter, validateShopping("add"), shopping.addToCart);
router.post(
  "/cart/checkout",
  limiter,
  validateShopping("checkout"),
  shopping.checkout,
);
router.patch(
  "/cart/:id",
  limiter,
  validateCatalogId,
  validateShopping("quantity"),
  shopping.setQuantity,
);
router.delete("/cart/:id", limiter, validateCatalogId, shopping.removeCartItem);
router.get("/wishlist", shopping.getWishlist);
router.post("/wishlist", limiter, validateShopping("wish"), shopping.addWish);
router.delete("/wishlist/:id", limiter, validateCatalogId, shopping.removeWish);
export default router;
