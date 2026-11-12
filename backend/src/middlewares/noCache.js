export default function noCache(req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}