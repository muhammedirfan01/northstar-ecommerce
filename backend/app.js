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

  app.use((req, res) =>
    res.status(404).json({ success: false, message: "Route not found" }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("API request failed:", error.code || error.name);
    let status = error.status || 500;
    if (error.name === "VersionError") {
      return res.status(409).json({
        success: false,
        message: "This item changed. Reload it before saving again.",
      });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An item with this name already exists.",
      });
    }
    if (error.name === "ValidationError" || error.name === "CastError") {
      status = 400;
    }
    if (error.data?.resendAfter)
      res.set("Retry-After", String(error.data.resendAfter));
    return res.status(status).json({
      success: false,
      message: error.expose
        ? error.message
        : "Unable to process your request. Please try again.",
      ...(error.data ? { data: error.data } : {}),
    });
  });
  return app;
}

export default createApp;
