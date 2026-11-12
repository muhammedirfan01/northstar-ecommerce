import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Product from "../src/models/Product.js";
import Category from "../src/models/Category.js";
import Order from "../src/models/Order.js";
import User from "../src/models/User.js";
import Campaign from "../src/models/Campaign.js";
import { saveProduct } from "../src/services/productService.js";
import { saveVariant, deleteVariant } from "../src/services/variantService.js";
import { listProducts } from "../src/services/storeService.js";
import { getProfilePhoto } from "../src/services/profileService.js";
import { getCustomerPhoto } from "../src/services/adminService.js";
import { getJwtSecret } from "../src/config/jwt.js";
afterEach(() => mock.restoreAll());
const id = '111111111111111111111111', categoryId = '222222222222222222222222';
const variantId = '333333333333333333333333';
const images = () => [1, 2, 3].map(n => ({ publicId: 'test/' + n, url: 'https://example.test/' + n }));
const productForm = { name: 'Changed product', description: 'An updated description', categoryId,
  price: '100', stock: '10', isPublished: true, isListed: true, highlights: [], specifications: [], retainedImageIds: [] };
const variantForm = { name: 'Original option', price: '100', regularPrice: '', stock: '10', isListed: true };
function productFixture() {
  return new Product({ _id: id, name: 'Test product', description: 'A product description', category: categoryId,
    pricePaise: 10000, stock: 9, images: images(), __v: 1, isListed: true, isPublished: true,
    variants: [{ _id: variantId, name: 'Original option', pricePaise: 10000, stock: 9, images: images() }] });
}
test('stale product and variant forms cannot restore stock sold during editing', async () => {
  const product = productFixture();
  mock.method(Product, 'findById', async () => product);
  const saved = mock.method(product, 'save', async () => product);
  for (const [service, params, body] of [
    [saveProduct, { id }, productForm], [saveVariant, { id, variantId }, variantForm],
  ]) {
    await assert.rejects(service({ params, body: { ...body, version: 0 }, files: [] }),
      error => error.status === 409 && /Reload/.test(error.message));
    await assert.rejects(service({ params, body: { ...body }, files: [] }), /Reload/);
  }
  assert.equal(product.stock, 9);
  assert.equal(product.variants[0].stock, 9);
  assert.equal(saved.mock.callCount(), 0);
});
test('current product and variant forms can still save stock changes', async () => {
  const product = productFixture();
  mock.method(Product, 'findById', async () => product);
  mock.method(Category, 'exists', async () => ({ _id: categoryId }));
  mock.method(product, 'save', async () => { await product.validate(); return product; });
  mock.method(product, 'populate', async () => product);
  const variantResult = await saveVariant({ params: { id, variantId }, body: { ...variantForm, version: 1 }, files: [] });
  assert.equal(variantResult.body.data.product.stock, 10);
  assert.equal(variantResult.body.data.product.version, 1);
  product.variants = [];
  const result = await saveProduct({ params: { id }, files: [], body: { ...productForm, version: 1,
    retainedImageIds: product.images.map(image => String(image._id)) } });
  assert.equal(result.status, 200);
  assert.equal(product.stock, 10);
});
test('purchased variants cannot be deleted, preserving stock restoration', async () => {
  const product = productFixture();
  mock.method(Product, 'findById', async () => product);
  const saved = mock.method(product, 'save', async () => product);
  let filter;
  mock.method(Order, 'exists', async value => { filter = value; return { _id: id }; });
  await assert.rejects(deleteVariant({ params: { id, variantId } }),
    error => error.status === 409 && /Unlist/.test(error.message));
  assert.deepEqual(filter, { items: { $elemMatch: { productId: id, variantId } } });
  assert.equal(product.variants.length, 1);
  assert.equal(saved.mock.callCount(), 0);
});
function query(value) {
  const q = { then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
  for (const key of ['sort', 'session', 'lean', 'populate', 'collation', 'skip', 'limit']) q[key] = () => q;
  return q;
}
test('price filters and sorting use the available variant price without campaigns', async () => {
  const product = { _id: id, name: 'Test variants', images: [], isListed: true, isPublished: true, stock: 2,
    pricePaise: 10000, category: { _id: categoryId, name: 'Audio', isListed: true },
    defaultVariantId: variantId, variants: [
      { _id: variantId, name: 'Sold out', pricePaise: 10000, stock: 0, isListed: true, images: [] },
      { _id: '444444444444444444444444', name: 'Available', pricePaise: 20000, stock: 2, isListed: true, images: [] },
    ] };
  const other = { ...product, _id: '555555555555555555555555', pricePaise: 17500, variants: [], defaultVariantId: null };
  mock.method(Category, 'find', () => query([product.category]));
  mock.method(Campaign, 'find', () => query([]));
  mock.method(Product, 'find', filter => {
    assert.equal(filter.pricePaise, undefined);
    return query([product, other]);
  });
  const filtered = await listProducts({ query: { minPrice: '190', maxPrice: '210' } });
  assert.deepEqual(filtered.body.data.products.map(p => p.id), [id]);
  const excluded = await listProducts({ query: { maxPrice: '150' } });
  assert.equal(excluded.body.data.pagination.total, 0);
  for (const [sort, expected] of [['price-asc', [String(other._id), id]], ['price-desc', [id, String(other._id)]]]) {
    const result = await listProducts({ query: { sort, limit: '1', page: '2' } });
    assert.deepEqual(result.body.data.products.map(p => p.id), [expected[1]]);
    assert.equal(result.body.data.pagination.total, 2);
  }
});
test('legacy photo bytes are readable only through explicitly selected photo fields', async () => {
  const version = '11111111-1111-4111-8111-111111111111';
  const photoPath = '/profile/photo/' + version, bytes = Buffer.from('old JPEG bytes');
  const legacy = User.hydrate({ _id: id, name: 'Test user', email: 'test@example.test', profileImage: photoPath, profilePhoto: bytes });
  assert.equal(User.schema.path('profilePhoto').options.select, false);
  mock.method(User, 'findById', () => ({ select: async fields => { assert.equal(fields, '+profilePhoto'); return legacy; } }));
  mock.method(User, 'findOne', () => ({ select: async () => legacy }));
  assert.deepEqual(Buffer.from(await getProfilePhoto({ user: { id, profileImage: photoPath }, params: { version } })), bytes);
  assert.deepEqual(Buffer.from(await getCustomerPhoto({ params: { id }, query: { version } })), bytes);
  assert.equal(await getProfilePhoto({ user: { id, profileImage: photoPath }, params: { version: 'wrong-version' } }), null);
});
test('JWT configuration rejects missing, short and whitespace-only secrets', () => {
  const original = process.env.JWT_SECRET;
  try {
    for (const secret of [undefined, '', 'x', 'x'.repeat(31), ' '.repeat(40), ' ' + 'x'.repeat(30) + ' ']) {
      if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
      assert.throws(getJwtSecret, /at least 32 characters/);
    }
    process.env.JWT_SECRET = 'x'.repeat(32);
    assert.equal(getJwtSecret(), 'x'.repeat(32));
  } finally { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; }
});
