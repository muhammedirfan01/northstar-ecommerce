// Prepare return photos and check who can view them.

import sharp from "sharp";
import { downloadReturnImage } from "./returnPhotoStorage.js";
import mongoose from "mongoose";
import ReturnPhoto from "../models/ReturnPhoto.js";
import { findOrder } from "./customerOrderService.js";
import { createError } from "../utils/httpError.js";

export async function prepareReturnPhotos(files = []) {
  if (!Array.isArray(files) || files.length > 3)
    throw createError("Choose up to 3 return photos.", 400);
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
      throw createError(
        "Return photos must be valid, single-frame JPG, PNG or WebP images up to 16 megapixels.",
        400,
      );
    }
  }
  return photos;
}
export async function getReturnPhoto(requestData, admin = false) {
  const order = await findOrder(requestData, admin);
  if (!/^[a-f0-9]{24}$/i.test(requestData.params.photoId || ""))
    throw createError("Photo not found.", 404);
  const photo = await ReturnPhoto.findOne({
    _id: requestData.params.photoId,
    orderId: order._id,
  });
  if (!photo) throw createError("Photo not found.", 404);
  if (photo.publicId)
    return { bytes: await downloadReturnImage(photo.publicId), filename: photo.name };
  // Read older return photos that were saved in MongoDB before Cloudinary was used.
  const legacy = await ReturnPhoto.collection.findOne({ _id: photo._id, orderId: order._id });
  const bytes = legacy?.bytes;
  if (!bytes) throw createError("Photo not found.", 404);
  return { bytes: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer), filename: photo.name };
}
