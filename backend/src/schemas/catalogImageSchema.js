import mongoose from "mongoose";

const catalogImageSchema = new mongoose.Schema({
  publicId: { type: String, required: true },
  url: { type: String, required: true },
});

export default catalogImageSchema;
