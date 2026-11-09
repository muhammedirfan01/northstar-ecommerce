import errorHandler from "./middlewares/errorHandler.js";
import express from "express";
import cors from "cors";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import catalogStoreRoutes from "./routes/catalogStoreRoutes.js";
import shoppingRoutes from "./routes/shoppingRoutes.js";
import cookieParser from "cookie-parser";
import { getJwtSecret } from "./config/jwt.js";
import orderRoutes from "./routes/orderRoutes.js"
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
  app.use("/api/products", catalogStoreRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/addresses", addressRoutes);
  app.use("/api", shoppingRoutes);
  app.use("/api/orders",orderRoutes)
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });
  app.use(errorHandler);
  return app;
}

export default createApp;
