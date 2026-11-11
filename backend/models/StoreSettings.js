import mongoose from "mongoose";
export const DEFAULT_SETTINGS = Object.freeze({
  storeName: "NORTHSTAR",
  supportEmail: "",
  supportPhone: "",
  invoiceAddress: "",
  shippingChargePaise: 5000,
  freeShippingAbovePaise: 50000,
  taxBasisPoints: 0,
  codEnabled: true,
  onlineEnabled: true,
});
const schema = new mongoose.Schema(
  {
    _id: { type: String, default: "northstar" },
    storeName: String,
    supportEmail: String,
    supportPhone: String,
    invoiceAddress: String,
    shippingChargePaise: Number,
    freeShippingAbovePaise: Number,
    taxBasisPoints: Number,
    codEnabled: Boolean,
    onlineEnabled: Boolean,
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true },
);
export default mongoose.model("StoreSettings", schema);
