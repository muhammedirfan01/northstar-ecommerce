import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024,
  },

  fileFilter(req, file, cb) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG and WebP images are allowed."));
    }

    cb(null, true);
  },
}).single("photo");

export default function profileUpload(req, res, next) {
  upload(req, res, error => {
    if (error) {
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        success: false,
        message: error.code === "LIMIT_FILE_SIZE"
          ? "Image must be smaller than 2 MB."
          : error.message,
      });
    }

    next();
  });
}