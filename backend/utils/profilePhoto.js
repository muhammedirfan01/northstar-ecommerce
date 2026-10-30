import sharp from "sharp";

export default async function processProfilePhoto(buffer) {
  const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: "warning" });
  const metadata = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages || 1) > 1) {
    throw new Error("Unsupported photo");
  }
  return image.rotate().resize(512, 512, { fit: "cover", withoutEnlargement: true })
    .flatten({ background: "#f0eee8" }).jpeg({ quality: 82 }).toBuffer();
}
