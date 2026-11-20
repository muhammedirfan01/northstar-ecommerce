import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  timeout: 20000,
  use: { baseURL: "http://localhost:5175", headless: true, channel: "chrome", trace: "retain-on-failure" },
});
