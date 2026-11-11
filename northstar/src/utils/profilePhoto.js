export async function validateProfilePhoto(file) {
  const types = {
    "image/jpeg": /\.jpe?g$/i,
    "image/png": /\.png$/i,
    "image/webp": /\.webp$/i,
  };
  if (
    !types[file.type]?.test(file.name) ||
    !file.size ||
    file.size > 2 * 1024 * 1024
  ) {
    throw new Error(
      "Choose a JPG, PNG or WebP photo no larger than 2 MB. Documents are not accepted.",
    );
  }
  // Decode the contents as well: a document renamed to .jpg is still invalid.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 16000000
    )
      throw new Error();
  } catch {
    throw new Error(
      "This file could not be opened as a photo. Choose a valid JPG, PNG or WebP image up to 16 megapixels.",
    );
  } finally {
    bitmap?.close();
  }
}
