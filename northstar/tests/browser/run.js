import { build } from "vite";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

// Build the real app against the intercepted test origin.
process.env.VITE_API_URL = "/api";
await build({ build: { outDir: "test-dist" } });
const runner = fileURLToPath(new URL("../../node_modules/playwright/cli.js", import.meta.url));
const result = spawnSync(process.execPath, [runner, "test", ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
