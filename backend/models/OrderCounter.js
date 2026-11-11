import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: { type: String },
  value: {
    type: Number,
    required: true,
    min: 0,
    max: 999999999999,
    validate: Number.isSafeInteger,
  },
});
export default mongoose.model("OrderCounter", schema);
