import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

test("server startup loads its .env before connecting and reading the port", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "northstar-startup-"));
  t.after(async () => {
    await unlink(join(temp, ".env"));
    await rmdir(temp);
  });
  await writeFile(
    join(temp, ".env"),
    "MONGODB_URI=mongodb://startup-test.invalid/northstar\nPORT=6123\n",
  );
  const require = createRequire(import.meta.url);
  const moduleURL = (text) =>
    "data:text/javascript;base64," + Buffer.from(text).toString("base64");
  const serverFile = fileURLToPath(new URL("../src/server.js", import.meta.url));
  let source = await readFile(serverFile, "utf8");
  source = source.replace(
    '"dotenv/config"',
    JSON.stringify(pathToFileURL(require.resolve("dotenv/config")).href),
  );
  source = source.replace(
    '"./config/db.js"',
    JSON.stringify(
      moduleURL(
        'export default async function(){if(!process.env.MONGODB_URI)throw new Error("Missing test database setting");}',
      ),
    ),
  );
  source = source.replace(
    '"mongoose"',
    JSON.stringify(moduleURL("export default {async disconnect(){}};")),
  );
  source = source.replace(
    '"./app.js"',
    JSON.stringify(
      moduleURL(
        'export default function(){return {listen(port,ready){if(port!==6123)throw new Error("Wrong test port");ready();return {on(){}};}};}',
      ),
    ),
  );
  const env = { ...process.env };
  delete env.MONGODB_URI;
  delete env.PORT;
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "await import(" + JSON.stringify(moduleURL(source)) + ")",
    ],
    { cwd: temp, env, encoding: "utf8", timeout: 10000 },
  );
  assert.equal(child.status, 0, child.stderr + child.stdout);
  assert.match(child.stdout, /6123/);
});
