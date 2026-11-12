import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per image
    files: 6,
  },
  fileFilter(req, file, callback) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);  //accepted
    } else {
      callback(new Error("Only JPG, PNG and WebP images are allowed."));  //rejected
    }
  },
}).array("images", 6);

export default function uploadImages(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next();
  });
}