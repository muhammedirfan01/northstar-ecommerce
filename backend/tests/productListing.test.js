import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Product from '../models/Product.js';
import { listProducts } from '../services/productService.js';
import { categoryPopulation } from '../utils/productAvailability.js';

afterEach(() => mock.restoreAll());

for (const empty of [false, true]) {
  test(`admin latest-first listing loads ${empty ? 'an empty catalog' : 'products with pagination'}`, async () => {
    const product = new Product({ name: 'Regression product', pricePaise: 10000, stock: 2 });
    const rows = empty ? [] : [product];
    const calls = [];
    // A Mongoose query stays chainable until it is awaited.
    const query = { then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject) };
    for (const method of ['populate', 'sort', 'skip', 'limit']) {
      query[method] = (value) => { calls.push([method, value]); return query; };
    }
    const find = mock.method(Product, 'find', () => query);
    const counts = empty ? [0, 0, 0, 0] : [21, 25, 20, 3];
    mock.method(Product, 'countDocuments', async () => counts.shift());

    const result = await listProducts({ query: empty ? {} : { sort: 'latest', page: '2', limit: '10' } });

    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.deepEqual(find.mock.calls[0].arguments, [{ deletedAt: null }]);
    assert.deepEqual(calls, [
      ['populate', categoryPopulation],
      ['sort', { createdAt: -1, _id: -1 }],
      ['skip', empty ? 0 : 10],
      ['limit', 10],
    ]);
    assert.deepEqual(result.body.data.pagination, {
      page: empty ? 1 : 2, limit: 10, total: empty ? 0 : 21, totalPages: empty ? 1 : 3,
    });
    assert.deepEqual(result.body.data.summary, empty
      ? { total: 0, published: 0, lowStock: 0 }
      : { total: 25, published: 20, lowStock: 3 });
    assert.equal(result.body.data.products.length, rows.length);
    if (!empty) assert.equal(result.body.data.products[0].name, product.name);
  });
}
