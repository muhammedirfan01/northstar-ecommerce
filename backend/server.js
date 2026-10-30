import "dotenv/config";
import mongoose from "mongoose";
import createApp from "./app.js";
import connectDB from "./config/db.js";

const port = 5000;

async function startServer() {
  try {
    await connectDB();
    const app = createApp();
    app.listen(port, (error) => {
      if (error) throw error;
      console.log("Server is running");
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
    await mongoose.disconnect();
  }
}

await startServer();
