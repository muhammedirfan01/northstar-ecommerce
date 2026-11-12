import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import User from "../src/models/User.js";
import { updateProfile } from "../src/services/profileService.js";

afterEach(() => mock.restoreAll());
const user = {
  id: "111111111111111111111111",
  email: "asha@example.test",
  name: "Asha Devi",
  authVersion: 0,
  profileImage: "https://res.cloudinary.com/test/image/upload/old.jpg",
  profileImagePublicId: "northstar/profiles/old",
};
const url = "https://res.cloudinary.com/test/image/upload/new.jpg";
function setup() {
  process.env.CLOUDINARY_CLOUD_NAME = "test";
  process.env.CLOUDINARY_API_KEY = "test";
  process.env.CLOUDINARY_API_SECRET = "test";
  let bytes;
  const upload = mock.method(cloudinary.uploader, "upload_stream", (options, callback) =>
    new Writable({
      write(chunk, encoding, done) { bytes = chunk; done(); },
      final(done) {
        callback(null, { public_id: options.public_id, secure_url: url });
        done();
      },
    }),
  );
  const destroy = mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
  return { upload, destroy, bytes: () => bytes };
}
async function input() {
  return {
    user,
    body: { name: "Asha Devi", phone: "" },
    file: { buffer: await sharp({ create: {
      width: 800, height: 600, channels: 3, background: "white",
    } }).png().toBuffer() },
  };
}

test("profile upload saves the Cloudinary URL and cleans up the previous owned photo", async () => {
  const cloud = setup();
  let changes;
  mock.method(User, "findOneAndUpdate", (filter, update) => {
    assert.equal(filter.profileImage, user.profileImage);
    changes = update.$set;
    assert.equal(cloud.destroy.mock.calls.length, 0);
    return { select: async () => ({ ...user, ...changes }) };
  });
  const result = await updateProfile(await input());
  assert.equal(result.body.data.user.profileImage, url);
  assert.equal(changes.profilePhoto, undefined);
  assert.match(changes.profileImagePublicId, /^northstar\/profiles\//);
  assert.equal(result.body.data.user.profileImagePublicId, undefined);
  assert.equal(cloud.destroy.mock.calls[0].arguments[0], user.profileImagePublicId);
  const metadata = await sharp(cloud.bytes()).metadata();
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.format, "jpeg");
  assert.equal(User.schema.path("profileImagePublicId").options.select, false);
});

test("a profile save failure removes the new upload and keeps the previous photo", async () => {
  const cloud = setup();
  mock.method(User, "findOneAndUpdate", () => ({ select: async () => { throw new Error("save failed"); } }));
  await assert.rejects(updateProfile(await input()), /save failed/);
  assert.equal(cloud.destroy.mock.calls.length, 1);
  assert.equal(cloud.destroy.mock.calls[0].arguments[0], cloud.upload.mock.calls[0].arguments[0].public_id);
});

test("a concurrent photo update rejects the stale upload and cleans it up", async () => {
  const cloud = setup();
  mock.method(User, "findOneAndUpdate", () => ({ select: async () => null }));
  await assert.rejects(updateProfile(await input()), { status: 409 });
  assert.equal(cloud.destroy.mock.calls.length, 1);
  assert.notEqual(cloud.destroy.mock.calls[0].arguments[0], user.profileImagePublicId);
});

test("invalid profile images are rejected before upload or database writes", async () => {
  const cloud = setup();
  const save = mock.method(User, "findOneAndUpdate", () => { throw new Error("unexpected save"); });
  await assert.rejects(updateProfile({ user, body: { name: "Asha Devi", phone: "" },
    file: { buffer: Buffer.from("not an image") } }), { status: 400 });
  assert.equal(cloud.upload.mock.calls.length, 0);
  assert.equal(save.mock.calls.length, 0);
});

test("upload failures clean up the attempted upload and never change the user", async () => {
  const cloud = setup();
  cloud.upload.mock.mockImplementation((options, callback) => new Writable({
    write(chunk, encoding, done) { done(); },
    final(done) { callback(new Error("upload failed")); done(); },
  }));
  const save = mock.method(User, "findOneAndUpdate", () => { throw new Error("unexpected save"); });
  await assert.rejects(updateProfile(await input()), { status: 503 });
  assert.equal(save.mock.calls.length, 0);
  assert.equal(cloud.destroy.mock.calls.length, 1);
});

test("editing profile details without a photo leaves Cloudinary unchanged", async () => {
  const cloud = setup();
  mock.method(User, "findOneAndUpdate", (filter, update) => {
    assert.deepEqual(update.$set, { name: "Asha Devi", phone: "" });
    return { select: async () => user };
  });
  await updateProfile({ user, body: { name: "Asha Devi", phone: "" } });
  assert.equal(cloud.upload.mock.calls.length, 0);
  assert.equal(cloud.destroy.mock.calls.length, 0);
});
