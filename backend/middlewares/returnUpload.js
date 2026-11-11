import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
    fields: 6,
    fieldSize: 4096,
    parts: 9,
  },
  fileFilter(req, file, callback) {
    callback(
      ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)
        ? null
        : new Error("Only JPG, PNG and WebP return photos are supported."),
      true,
    );
  },
}).array("photos", 3);
export default function returnUpload(req, res, next) {
  upload(req, res, (error) => {
    if (error)
      return res.status(400).json({ success: false, message: error.message });
    next();
  });
}
