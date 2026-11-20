import test from "node:test";
import assert from "node:assert/strict";
import { validateProfilePhoto } from "../src/features/profile/profilePhoto.js";

test("profile photo rejects files with invalid types, extensions, empty bytes or excessive size", async () => {
  for (const file of [
    { name: "document.pdf", type: "application/pdf", size: 100 },
    { name: "document.pdf", type: "image/jpeg", size: 100 },
    { name: "photo.jpg", type: "image/jpeg", size: 0 },
    { name: "photo.jpg", type: "image/jpeg", size: 2 * 1024 * 1024 + 1 },
  ]) await assert.rejects(validateProfilePhoto(file), /no larger than 2 MB/);
});

test("valid profile image is decoded and its bitmap is closed after checking dimensions", async (t) => {
  const close = t.mock.fn();
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => ({ width: 2000, height: 2000, close }) });
  t.after(() => { delete globalThis.createImageBitmap; });
  await validateProfilePhoto({ name: "photo.webp", type: "image/webp", size: 1024 });
  assert.equal(close.mock.callCount(), 1);
});

test("an oversized decoded bitmap is rejected and its resource is released", async (t) => {
  const close = t.mock.fn();
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => ({ width: 8000, height: 8000, close }) });
  t.after(() => { delete globalThis.createImageBitmap; });
  await assert.rejects(validateProfilePhoto({ name: "photo.png", type: "image/png", size: 1024 }), /16 megapixels/);
  assert.equal(close.mock.callCount(), 1);
});
