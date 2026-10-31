import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: Number.isInteger,
  },
});

// Cart and wishlist share one customer record so adding to cart can update both atomically.
const shoppingListSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    cart: {
      type: [cartItemSchema],
      default: [],
      validate: (items) => items.length <= 50,
    },
    wishlist: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
      validate: (ids) => ids.length <= 100,
    },
  },
  { timestamps: true, optimisticConcurrency: true },
);
export default mongoose.model("ShoppingList", shoppingListSchema);
