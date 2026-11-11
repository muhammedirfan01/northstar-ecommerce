import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));
const sharedDirectory = fileURLToPath(new URL("../shared", import.meta.url));

// Let the Google popup return its result to the sign-in page.
const browserHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Referrer-Policy": "no-referrer-when-downgrade",
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": sharedDirectory } },
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    headers: browserHeaders,
    fs: { allow: [frontendDirectory, sharedDirectory] },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: false,
      },
    },
  },
  preview: { headers: browserHeaders },
});
