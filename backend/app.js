import express from "express";
import cors from "cors";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import catalogStoreRoutes from "./routes/catalogStoreRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import shoppingRoutes from "./routes/shoppingRoutes.js";
import cookieParser from "cookie-parser";
import { getJwtSecret } from "./config/jwt.js";

function createApp() {
  getJwtSecret();
  const app = express();
  app.use(
    cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/products", reviewRoutes);
  app.use("/api/products", catalogStoreRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/addresses", addressRoutes);
  app.use("/api", shoppingRoutes);

  app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error(error.message);

  let status = error.status || 500;
  let message = error.expose
    ? error.message
    : "Something went wrong";

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

  res.status(status).json({
    success: false,
    message,
    ...(error.data ? { data: error.data } : {})
  });
});
  return app;
}

export default createApp;
