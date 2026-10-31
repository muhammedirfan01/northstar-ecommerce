import "dotenv/config";
import mongoose from "mongoose";
import createApp from "./app.js";
import connectDB from "./config/db.js";

const port = 5000;

async function startServer() {
  try {
    await connectDB();
    const app = createApp();
    // Wait for the port so connection errors reach the catch block below.
    await new Promise((resolve, reject) => {
      app.listen(port, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    console.log("Server is running");
  } catch (error) {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${port} is already in use. Stop the other backend and try again.`
        : `Server startup failed: ${error.message}`,
    );
    process.exitCode = 1;
    await mongoose.disconnect();
  }
}

await startServer();
