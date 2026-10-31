import multer from "multer";

export function imageUpload(maxFiles) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: maxFiles,
      fields: 1,
      fieldSize: 64 * 1024,
    },
    fileFilter(_req, file, next) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
        return next(new Error("Only JPG, PNG and WebP images are allowed."));
      next(null, true);
    },
  }).array("images", maxFiles);

  return function uploadImages(req, res, next) {
    upload(req, res, (error) => {
      if (error)
        return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
          success: false,
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "Each image must be smaller than 5 MB."
              : error.code === "LIMIT_FILE_COUNT" ||
                  error.code === "LIMIT_UNEXPECTED_FILE"
                ? `Choose no more than ${maxFiles} images using the images field.`
                : error.message,
        });
      next();
    });
  };
}
export default imageUpload(6);
