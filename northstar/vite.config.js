import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Let the Google popup return its result to the sign-in page.
const browserHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Referrer-Policy": "no-referrer-when-downgrade",
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    headers: browserHeaders,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  preview: { headers: browserHeaders },
});
