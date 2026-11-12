import mongoose from "mongoose";
import catalogImageSchema from "../schemas/catalogImageSchema.js";

const price = { type: Number, required: true, min: 1, validate: Number.isSafeInteger };
const stock = { type: Number, required: true, min: 0, validate: Number.isInteger };

const optionSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 40 },
  value: { type: String, required: true, maxlength: 80 },
}, { _id: false });

const quickSpecSchema = new mongoose.Schema({
  label: { type: String, required: true, maxlength: 60 },
  value: { type: String, required: true, maxlength: 120 },
  note: { type: String, default: "", maxlength: 200 },
}, { _id: false });

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  colorName: { type: String, default: "", trim: true, maxlength: 40 },
  colorHex: { type: String, default: "" },
  memory: { type: String, default: "", trim: true, maxlength: 80 },
  storage: { type: String, default: "", trim: true, maxlength: 80 },
  imageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  options: { type: [optionSchema], default: [], validate: (values) => values.length <= 5 },
  images: { type: [catalogImageSchema], default: [], validate: { validator: (images) => images.length >= 3 && images.length <= 6, message: "Each variant requires three to six images." } },
  pricePaise: price,
  regularPricePaise: { type: Number, default: null },
  stock,
  isListed: { type: Boolean, default: true },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  series: { type: String, default: "", trim: true, maxlength: 80 },
  subtitle: { type: String, default: "", trim: true, maxlength: 240 },
  badge: { type: String, enum: ["", "Best seller", "Deal of the day", "Most purchased", "New arrival"], default: "" },
  priceNote: { type: String, default: "", trim: true, maxlength: 180 },
  quickSpecs: { type: [quickSpecSchema], default: [], validate: (cards) => cards.length <= 6 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  images: { type: [catalogImageSchema], validate: { validator: (images) => images.length >= 3 && images.length <= 6, message: "A product needs between 3 and 6 images." } },
  pricePaise: price,
  regularPricePaise: { type: Number, default: null },
  stock: { ...stock, max: 100000000 },
  isPublished: { type: Boolean, default: false },
  isListed: { type: Boolean, default: true },
  highlights: [String],
  specifications: [String],
  variants: { type: [variantSchema], default: [] },
  defaultVariantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true, optimisticConcurrency: true });

productSchema.index({ createdAt: -1, _id: -1 });
productSchema.index({ category: 1, isListed: 1, isPublished: 1, stock: 1 });

export default mongoose.model("Product", productSchema);