import sharp from "sharp";
import mongoose from "mongoose";
import ReturnPhoto from "../models/ReturnPhoto.js";
import { findOrder } from "./customerOrderService.js";
import { httpError } from "../utils/httpError.js";

export async function prepareReturnPhotos(files = []) {
  if (!Array.isArray(files) || files.length > 3)
    throw httpError("Choose up to 3 return photos.", 400);
  const photos = [];
  for (const file of files) {
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 16_000_000,
        animated: false,
      });
      const metadata = await image.metadata();
      if (
        !["jpeg", "png", "webp"].includes(metadata.format) ||
        (metadata.pages || 1) !== 1
      )
        throw new Error("Unsupported image");
      const bytes = await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 85 })
        .toBuffer();
      if (bytes.length > 2 * 1024 * 1024) throw new Error("Image too large");
      photos.push({
        _id: new mongoose.Types.ObjectId(),
        name: `return-photo-${photos.length + 1}.jpg`,
        bytes,
      });
    } catch {
      throw httpError(
        "Return photos must be valid, single-frame JPG, PNG or WebP images up to 16 megapixels.",
        400,
      );
    }
  }
  return photos;
}
export async function getReturnPhoto(input, admin = false) {
  const order = await findOrder(input, admin);
  if (!/^[a-f0-9]{24}$/i.test(input.params.photoId || ""))
    throw httpError("Photo not found.", 404);
  const photo = await ReturnPhoto.findOne({
    _id: input.params.photoId,
    orderId: order._id,
  }).select("+bytes");
  if (!photo) throw httpError("Photo not found.", 404);
  return { bytes: photo.bytes, filename: photo.name };
}
