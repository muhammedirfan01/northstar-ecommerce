import multer from "multer";

export function imageUpload(maxFiles = 6) {
  return multer({
    storage: multer.memoryStorage(),

    limits: {
      fileSize: 5 * 1024 * 1024,
      files: maxFiles,
    },

    fileFilter(req, file, cb) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error("Only JPG, PNG and WebP images are allowed"));
      }
      cb(null, true);
    },
  }).array("images", maxFiles);
};

export default imageUpload(6);