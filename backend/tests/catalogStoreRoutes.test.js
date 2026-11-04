import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import router from "../routes/catalogStoreRoutes.js";
const categoryId = "111111111111111111111111";
const productId = "222222222222222222222222";
const category = {
  _id: categoryId,
  name: "Laptops",
  isListed: true,
};
const product = {
  _id: productId,
  name: "Laptop [Pro]",
  category,
  isListed: true,
  isPublished: true,
  stock: 2,
  pricePaise: 12345,
  images: [],
  variants: [],
};
function queryResult(value, calls = {}) {
  const query = {};
  for (const method of [
    "populate",
    "sort",
    "select",
    "collation",
    "skip",
    "limit",
  ])
    query[method] = (argument) => {
      calls[method] = argument;
      return query;
    };
  query.then = (resolve, reject) =>
    Promise.resolve(value).then(resolve, reject);
  return query;
}
test("store catalog routes preserve validation, visibility and responses", async (t) => {
  const app = express();
  app.use("/api/products", router);
  app.use((error, _req, res, _next) =>
    res.status(500).json({
      message: error.message,
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const url = `http://127.0.0.1:${server.address().port}/api/products`;
  const get = async (suffix) => {
    const response = await fetch(url + suffix);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return {
      status: response.status,
      body: await response.json(),
    };
  };
  await t.test(
    "rejects malformed filters and IDs before querying the database",
    async () => {
      for (const suffix of [
        "?minPrice=20&maxPrice=10",
        "?page=0",
        "?sort=invalid",
        "?unknown=true",
        "/bad-id",
      ])
        assert.equal((await get(suffix)).status, 400);
    },
  );
  await t.test(
    "categories endpoint excludes categories with hidden parents",
    async (t) => {
      t.mock.method(Category, "find", () =>
        queryResult([
          category,
          {
            _id: productId,
            name: "Hidden child",
            parent: {
              isListed: false,
            },
          },
        ]),
      );
      const result = await get("/categories");
      assert.equal(result.status, 200);
      assert.deepEqual(
        result.body.data.categories.map((item) => item.id),
        [categoryId],
      );
    },
  );
  await t.test(
    "listing preserves filters, escaped search, sorting and page clamping",
    async (t) => {
      t.mock.method(Category, "find", (filter) =>
        queryResult(filter.parent ? [] : [category]),
      );
      let captured;
      t.mock.method(Product, "countDocuments", async (filter) => {
        captured = filter;
        return 1;
      });
      const calls = {};
      t.mock.method(Product, "find", () => queryResult([product], calls));
      const result = await get(
        `?search=%5BPro%5D&category=${categoryId}&minPrice=1.25&maxPrice=200&sort=price-asc&page=9&limit=2`,
      );
      assert.equal(result.status, 200);
      assert.equal(captured.isPublished, true);
      assert.equal(captured.isListed, true);
      assert.deepEqual(captured.stock, {
        $gt: 0,
      });
      assert.deepEqual(captured.category, {
        $in: [categoryId],
      });
      assert.deepEqual(captured.$and, [
        {
          category: {
            $in: [categoryId],
          },
        },
      ]);
      assert.deepEqual(captured.pricePaise, {
        $gte: 125,
        $lte: 20000,
      });
      assert.equal(captured.name.test("Laptop [Pro]"), true);
      assert.equal(captured.name.test("Laptop P"), false);
      assert.deepEqual(calls.sort, {
        pricePaise: 1,
        _id: 1,
      });
      assert.equal(calls.skip, 0);
      assert.deepEqual(result.body.data.pagination, {
        page: 1,
        limit: 2,
        total: 1,
        totalPages: 1,
      });
      assert.equal(result.body.data.products[0].id, productId);
    },
  );
  await t.test(
    "unavailable products keep the existing 404 response",
    async (t) => {
      t.mock.method(Category, "find", () => queryResult([category]));
      t.mock.method(Product, "findOne", () => queryResult(null));
      const result = await get(`/${productId}`);
      assert.equal(result.status, 404);
      assert.deepEqual(result.body, {
        success: false,
        message: "This product is unavailable. Browse other products.",
      });
    },
  );
  await t.test(
    "details exclude hidden variants and unavailable related products",
    async (t) => {
      t.mock.method(Category, "find", () => queryResult([category]));
      t.mock.method(Product, "findOne", () =>
        queryResult({
          ...product,
          variants: [
            {
              _id: "333333333333333333333333",
              name: "Hidden",
              isListed: false,
            },
          ],
        }),
      );
      t.mock.method(Product, "find", () =>
        queryResult([
          product,
          {
            ...product,
            stock: 0,
          },
        ]),
      );
      const result = await get(`/${productId}`);
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.data.product.variants, []);
      assert.equal(result.body.data.related.length, 1);
    },
  );
});
