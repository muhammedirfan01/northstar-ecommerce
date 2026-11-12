// Upload return photos, download them and remove unused uploads.

import { randomUUID } from "node:crypto";
import { getCloudinary } from "../config/cloudinary.js";
import { createError } from "../utils/httpError.js";

export async function removeReturnImages(images) {
  if (!images.length) return;
  const cloud = getCloudinary();
  const results = await Promise.allSettled(images.map(image =>
    cloud.uploader.destroy(image.publicId, {
      resource_type: "image", type: "authenticated", invalidate: true, timeout: 15000,
    }),
  ));
  results.forEach((result, imageIndex) => {
    if (result.status === "rejected") console.error("Return photo cleanup failed:", images[imageIndex].publicId);
  });
}

// Keep photo bytes in memory during upload. Save the Cloudinary details in MongoDB.
export async function uploadReturnImages(photos) {
  if (!photos.length) return [];
  const attempted = [];
  try {
    const cloud = getCloudinary();
    const images = [];
    for (const photo of photos) {
      const publicId = `northstar/returns/${randomUUID()}`;
      attempted.push({ publicId });
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloud.uploader.upload_stream({
          public_id: publicId, resource_type: "image", type: "authenticated",
          overwrite: false, timeout: 20000,
        }, (error, value) => error ? reject(error) : resolve(value));
        stream.on("error", reject);
        stream.end(photo.bytes);
      });
      if (uploaded.public_id !== publicId || !uploaded.secure_url?.startsWith("https://"))
        throw new Error("Invalid upload response");
      images.push({ _id: photo._id, name: photo.name, publicId, url: uploaded.secure_url });
    }
    return images;
  } catch {
    if (attempted.length) await removeReturnImages(attempted);
    throw createError("Could not upload return photos. Please try again.", 503);
  }
}

export async function downloadReturnImage(publicId) {
  try {
    const url = getCloudinary().url(publicId, {
      resource_type: "image", type: "authenticated", format: "jpg", sign_url: true, secure: true,
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/"))
      throw new Error("Image unavailable");
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) throw new Error("Image too large");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    throw createError("Return photo is temporarily unavailable. Please try again.", 503);
  }
}
