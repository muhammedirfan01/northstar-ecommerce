import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import express from "express";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import Category from "../src/models/Category.js";
import adminCatalogRoutes from "../src/routes/adminCatalogRoutes.js";
const parentId = "111111111111111111111111";
const valid = {
  name: "Laptops",
  parentId: "",
  isListed: true,
  keepImage: false,
};
test("admin add-category request", async (t) => {
  const app = express();
  // Test the catalog router after the authentication step used by adminRoutes.
  app.use((req, _res, next) => {
    req.user = {
      id: parentId,
    };
    next();
  });
  app.use("/admin", adminCatalogRoutes);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/admin/categories`;
  async function post(input, images = []) {
    const form = new FormData();
    form.set("data", typeof input === "string" ? input : JSON.stringify(input));
    for (const image of images)
      form.append(
        "images",
        new Blob([image], {
          type: "image/png",
        }),
        "category.png",
      );
    const response = await fetch(url, {
      method: "POST",
      body: form,
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  }
  function database(t) {
    const saved = [];
    t.mock.method(Category, "exists", async () => false);
    t.mock.method(Category.prototype, "save", async function () {
      this.createdAt = new Date("2026-11-03T00:00:00Z");
      saved.push(this);
      return this;
    });
    return saved;
  }
  await t.test("rejects invalid forms before querying MongoDB", async (t) => {
    const exists = t.mock.method(Category, "exists", async () => {
      throw new Error("Must not query");
    });
    const invalid = [
      "not JSON",
      "null",
      "[]",
      {
        ...valid,
        name: 123,
      },
      {
        ...valid,
        name: " ",
      },
      {
        ...valid,
        name: "x".repeat(81),
      },
      {
        ...valid,
        parentId: "bad-id",
      },
      {
        ...valid,
        parentId: null,
      },
      {
        ...valid,
        isListed: "true",
      },
      {
        ...valid,
        keepImage: "false",
      },
      {
        ...valid,
        role: "admin",
      },
    ];
    for (const input of invalid) assert.equal((await post(input)).status, 400);
    assert.equal(exists.mock.calls.length, 0);
  });
  await t.test(
    "creates a main category and keeps private image fields out of the response",
    async (t) => {
      const saved = database(t);
      const result = await post({
        ...valid,
        name: "  LAPTOPS  ",
      });
      assert.equal(result.status, 201);
      assert.equal(saved[0].name, "LAPTOPS");
      assert.equal(saved[0].nameKey, "laptops");
      assert.equal(saved[0].parent, null);
      assert.deepEqual(
        Object.keys(result.body.data.category).sort(),
        [
          "id",
          "name",
          "parentId",
          "parentName",
          "parentListed",
          "isListed",
          "createdAt",
          "image",
        ].sort(),
      );
      assert.equal(result.body.data.category.parentListed, true);
      assert.equal(result.body.data.category.image, null);
      assert.equal(result.body.data.category.nameKey, undefined);
    },
  );
  await t.test(
    "allows an omitted parent ID and an initially hidden category",
    async (t) => {
      const saved = database(t);
      const { parentId: _unused, ...input } = valid;
      input.isListed = false;
      assert.equal((await post(input)).status, 201);
      assert.equal(saved[0].parent, null);
      assert.equal(saved[0].isListed, false);
    },
  );
  await t.test(
    "normalizes whitespace and case before checking duplicates",
    async (t) => {
      let filter;
      t.mock.method(Category, "exists", async (value) => {
        filter = value;
        return true;
      });
      const result = await post({
        ...valid,
        name: "  Gaming   LAPTOPS ",
      });
      assert.equal(result.status, 409);
      assert.deepEqual(filter, {
        nameKey: "gaming laptops",
      });
    },
  );
  await t.test(
    "rejects a missing parent and a third category level",
    async (t) => {
      database(t);
      const find = t.mock.method(Category, "findById", async () => null);
      assert.equal(
        (
          await post({
            ...valid,
            parentId,
          })
        ).status,
        400,
      );
      find.mock.mockImplementation(async () => ({
        _id: parentId,
        parent: parentId,
      }));
      assert.equal(
        (
          await post({
            ...valid,
            parentId,
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "creates a subcategory and returns its parent details",
    async (t) => {
      const saved = database(t);
      const parent = {
        _id: parentId,
        name: "Computers",
        isListed: true,
        parent: null,
      };
      t.mock.method(Category, "findById", async () => parent);
      const result = await post({
        ...valid,
        parentId,
      });
      assert.equal(result.status, 201);
      assert.equal(String(saved[0].parent._id), parentId);
      assert.equal(result.body.data.category.parentId, parentId);
      assert.equal(result.body.data.category.parentName, "Computers");
    },
  );
  await t.test(
    "rejects multiple category images before database or upload work",
    async (t) => {
      const exists = t.mock.method(Category, "exists", async () => {
        throw new Error("Must not query");
      });
      assert.equal((await post(valid, ["image1", "image2"])).status, 400);
      assert.equal(exists.mock.calls.length, 0);
    },
  );
  await t.test(
    "rejects fake image bytes rather than trusting the file name",
    async (t) => {
      const saved = database(t);
      assert.equal((await post(valid, ["not a PNG"])).status, 400);
      assert.equal(saved.length, 0);
    },
  );

  // Only Cloudinary's transport is replaced: actual image validation and resizing still run.
  function imageTransport(t) {
    for (const key of [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ]) {
      const old = process.env[key];
      process.env[key] = "category-test";
      t.after(() => {
        if (old === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = old;
        }
      });
    }
    t.mock.method(cloudinary, "config", () => ({}));
    t.mock.method(
      cloudinary.uploader,
      "upload_stream",
      (options, callback) =>
        new Writable({
          write(_chunk, _encoding, next) {
            next();
          },
          final(next) {
            callback(null, {
              public_id: options.public_id,
              secure_url: "https://example.com/category.webp",
            });
            next();
          },
        }),
    );
    return t.mock.method(cloudinary.uploader, "destroy", async () => ({}));
  }
  const png = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: "red",
    },
  })
    .png()
    .toBuffer();
  await t.test(
    "saves a validated image and returns only its display URL and ID",
    async (t) => {
      const saved = database(t);
      imageTransport(t);
      const result = await post(valid, [png]);
      assert.equal(result.status, 201);
      assert.equal(
        result.body.data.category.image.url,
        "https://example.com/category.webp",
      );
      assert.ok(saved[0].image.publicId);
      assert.equal(result.body.data.category.image.publicId, undefined);
    },
  );
  await t.test(
    "removes the uploaded image when MongoDB saving fails",
    async (t) => {
      database(t);
      const destroy = imageTransport(t);
      t.mock.method(Category.prototype, "save", async () => {
        throw new Error("Database unavailable");
      });
      assert.equal((await post(valid, [png])).status, 500);
      assert.equal(destroy.mock.calls.length, 1);
    },
  );
});
