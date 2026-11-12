import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import mongoose from "mongoose";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import ReturnPhoto from "../src/models/ReturnPhoto.js";
import Order from "../src/models/Order.js";
import { prepareReturnPhotos, getReturnPhoto } from "../src/services/returnPhotoService.js";
import { uploadReturnImages, downloadReturnImage } from "../src/services/returnPhotoStorage.js";
import { requestReturn } from "../src/services/returnService.js";

afterEach(() => mock.restoreAll());
const id = "111111111111111111111111", userId = "222222222222222222222222";
const env = { ...process.env };
afterEach(() => {
  for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"])
    if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
});
function cloudSetup(failAt = 0) {
  process.env.CLOUDINARY_CLOUD_NAME = "test";
  process.env.CLOUDINARY_API_KEY = "test";
  process.env.CLOUDINARY_API_SECRET = "test";
  let count = 0;
  const uploaded = [];
  const upload = mock.method(cloudinary.uploader, "upload_stream", (options, callback) => {
    const number = ++count;
    return new Writable({
      write(chunk, encoding, done) { uploaded.push(chunk); done(); },
      final(done) {
        if (number === failAt) callback(new Error("provider failed"));
        else callback(null, { public_id: options.public_id, secure_url: `https://res.cloudinary.com/test/image/authenticated/${options.public_id}.jpg` });
        done();
      },
    });
  });
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
  return { upload, destroy, uploaded };
}
async function file() {
  return { buffer: await sharp({ create: { width: 20, height: 10, channels: 3, background: "white" } }).png().toBuffer() };
}
function orderSetup({ failSave = false, replay = false, retries = 1, references = [] } = {}) {
  const record = {
    _id: id, orderId: "NS-0001", userId, orderStatus: "delivered", paymentStatus: "paid",
    shippingAddress: { name: "Test" }, statusHistory: [], returnHistory: [], returnRequest: { status: "none" },
    async save() { if (failSave) throw Error("save failed"); },
  };
  let initial = true;
  mock.method(Order, "findOne", filter => ({ session() {
    assert.equal(String(filter.userId), userId);
    if (initial) { initial = false; return Promise.resolve(record); }
    if (replay) record.returnRequest.status = "requested";
    return Promise.resolve(record);
  } }));
  mock.method(ReturnPhoto, "init", async () => {});
  const insert = mock.method(ReturnPhoto, "insertMany", async docs => docs);
  mock.method(ReturnPhoto, "find", () => ({ select: () => ({ lean: async () => references }) }));
  const session = { async withTransaction(fn) {
    for (let i = 0; i < retries; i++) {
      record.returnRequest = { status: "none" };
      await fn();
    }
  }, async endSession() {} };
  mock.method(mongoose, "startSession", async () => session);
  return { record, insert };
}
async function input() {
  return { user: { id: userId }, params: { id }, body: {
    reason: "Damaged product", packagingConfirmed: true,
  }, files: [await file()] };
}

test("return image validation rejects fake files before Cloudinary calls", async () => {
  const cloud = cloudSetup();
  await assert.rejects(prepareReturnPhotos([{ buffer: Buffer.from("fake") }]), { status: 400 });
  assert.equal(cloud.upload.mock.calls.length, 0);
});

test("return uploads store authenticated Cloudinary references without MongoDB bytes", async () => {
  const cloud = cloudSetup();
  const { insert } = orderSetup();
  const result = await requestReturn(await input());
  assert.equal(result.status, 200);
  const saved = insert.mock.calls[0].arguments[0][0];
  assert.equal(saved.bytes, undefined);
  assert.match(saved.publicId, /^northstar\/returns\//);
  assert.match(saved.url, /^https:/);
  assert.equal(cloud.upload.mock.calls[0].arguments[0].type, "authenticated");
  assert.equal((await sharp(cloud.uploaded[0]).metadata()).format, "jpeg");
  assert.equal(ReturnPhoto.schema.path("bytes"), undefined);
  assert.equal(result.body.data.order.returnRequest.photos[0].publicId, undefined);
  assert.equal(cloud.destroy.mock.calls.length, 0);
});

test("partial upload failure cleans every attempted asset and returns 503", async () => {
  const cloud = cloudSetup(2);
  const photos = await prepareReturnPhotos([await file(), await file()]);
  await assert.rejects(uploadReturnImages(photos), { status: 503 });
  assert.equal(cloud.destroy.mock.calls.length, 2);
  assert.equal(cloud.destroy.mock.calls[0].arguments[1].type, "authenticated");
});

test("database failure removes uploaded photos after confirming they are unreferenced", async () => {
  const cloud = cloudSetup();
  orderSetup({ failSave: true });
  await assert.rejects(requestReturn(await input()), /save failed/);
  assert.equal(cloud.destroy.mock.calls.length, 1);
});

test("transaction retries reuse one upload", async () => {
  const cloud = cloudSetup();
  const { insert } = orderSetup({ retries: 2 });
  await requestReturn(await input());
  assert.equal(cloud.upload.mock.calls.length, 1);
  assert.equal(insert.mock.calls.length, 2);
  assert.equal(cloud.destroy.mock.calls.length, 0);
});

test("an identical return retry does not upload another photo", async () => {
  const cloud = cloudSetup();
  orderSetup();
  const data = await input();
  await requestReturn(data);
  await requestReturn(data);
  assert.equal(cloud.upload.mock.calls.length, 1);
});

test("photo download uses a signed URL and fails cleanly when Cloudinary is down", async () => {
  cloudSetup();
  const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
    assert.match(url, /image\/authenticated\/s--/);
    assert.equal(options.redirect, "error");
    return new Response(Buffer.from("jpeg"), { headers: { "content-type": "image/jpeg" } });
  });
  assert.equal((await downloadReturnImage("northstar/returns/test")).toString(), "jpeg");
  fetchMock.mock.mockImplementation(async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(downloadReturnImage("northstar/returns/test"), { status: 503 });
});

test("photo access checks order ownership before querying or downloading evidence", async () => {
  cloudSetup();
  mock.method(Order, "findOne", filter => ({ session() {
    assert.equal(filter.userId, userId);
    return null;
  } }));
  const photo = mock.method(ReturnPhoto, "findOne", () => { throw Error("must not query"); });
  const download = mock.method(globalThis, "fetch", () => { throw Error("must not download"); });
  await assert.rejects(getReturnPhoto({ user: { id: userId }, params: { id, photoId: id } }), { status: 404 });
  assert.equal(photo.mock.calls.length, 0);
  assert.equal(download.mock.calls.length, 0);
});

test("older MongoDB photo evidence remains readable", async () => {
  mock.method(Order, "findOne", () => ({ session: () => ({ _id: id }) }));
  mock.method(ReturnPhoto, "findOne", async () => ({ _id: id, name: "old.jpg" }));
  mock.method(ReturnPhoto.collection, "findOne", async () => ({ bytes: Buffer.from("legacy") }));
  const result = await getReturnPhoto({ user: { id: userId }, params: { id, photoId: id } });
  assert.equal(result.bytes.toString(), "legacy");
});
