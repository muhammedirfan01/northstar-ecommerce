import multer from "multer";

const uploadProfile = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024,
  },

  fileFilter(req, file, cb) {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (
      allowedTypes.includes(file.mimetype) &&
      {
        "image/jpeg": /\.jpe?g$/i,
        "image/png": /\.png$/i,
        "image/webp": /\.webp$/i,
      }[file.mimetype].test(file.originalname)
    ) {
      return cb(null, true);
    }

    return cb(new Error("Only JPEG, WebP and PNG are acceptable."));
  },
}).single("photo");

export default function profileUpload(req, res, next) {
  uploadProfile(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Choose a profile photo no larger than 2 MB."
            : error.message,
      });
    }

    next();
  });
}
