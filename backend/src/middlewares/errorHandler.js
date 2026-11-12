export default function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }
  console.error(error.message);
  let status = error.status || 500;
  let message;
  if (error.expose) {
    message = error.message;
  } else {
    message = "Something went wrong";
  }
  if (error.name === "VersionError") {
    status = 409;
    message = "This item was changed. Please reload.";
  }
  if (error.code === 11000) {
    status = 409;
    message = "Item already exists";
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    status = 400;
    message = "Invalid data provided";
  }
  if (error.data?.resendAfter) {
    res.set("Retry-After", String(error.data.resendAfter));
  }
  const body = {
    success: false,
    message,
  };
  if (error.code === "VALIDATION_ERROR") body.code = error.code;
  if (error.data) body.data = error.data;
  res.status(status).json(body);
}
