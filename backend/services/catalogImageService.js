import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { getCloudinary } from "../config/cloudinary.js";
import { serviceError } from "../utils/serviceError.js";

export async function prepareCatalogImage(file) {
  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 25_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    )
      throw new Error("Invalid image");
    return await image
      .rotate()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw serviceError(
      "One of the files is not a valid JPG, PNG or WebP image.",
    );
  }
}

export async function removeCatalogImages(images) {
  if (!images.length) return;
  let cloudinary;
  try {
    cloudinary = getCloudinary();
  } catch {
    console.error("Catalog image cleanup needs Cloudinary configuration.");
    return;
  }
  const results = await Promise.allSettled(
    images.map((image) =>
      cloudinary.uploader.destroy(image.publicId, {
        resource_type: "image",
        invalidate: true,
        timeout: 15000,
      }),
    ),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected")
      console.error("Could not remove catalog image:", images[index].publicId);
  });
}

export async function uploadCatalogImages(files, folder = "northstar/catalog") {
  if (!files.length) return [];
  // Inspect and resize every file before uploading anything to Cloudinary.
  const buffers = [];
  for (const file of files) buffers.push(await prepareCatalogImage(file));
  const cloudinary = getCloudinary();
  const images = [];
  const attempted = [];
  try {
    for (const buffer of buffers) {
      const publicId = `${folder}/${randomUUID()}`;
      attempted.push({ publicId });
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            public_id: publicId,
            overwrite: false,
            timeout: 20000,
          },
          (error, result) => (error ? reject(error) : resolve(result)),
        );
        stream.on("error", reject);
        stream.end(buffer);
      });
      images.push({ publicId: result.public_id, url: result.secure_url });
    }
    return images;
  } catch {
    await removeCatalogImages(attempted);
    throw serviceError("Could not upload images. Please try again.", 503);
  }
}
