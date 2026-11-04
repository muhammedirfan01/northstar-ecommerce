import multer from "multer";
export function imageUpload(maxFiles = 6) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: maxFiles,
    },
    fileFilter(_req, file, callback) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.mimetype)) {
        return callback(
          new Error("Only JPG, PNG and WebP images are allowed."),
        );
      }
      callback(null, true);
    },
  }).array("images", maxFiles);
  return function uploadImages(req, res, next) {
    upload(req, res, function (error) {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      next();
    });
  };
}
export default imageUpload(6);
