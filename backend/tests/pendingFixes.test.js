import Campaign from "../src/models/Campaign.js";
import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import Product from "../src/models/Product.js";
import Category from "../src/models/Category.js";
import { listProducts as adminProducts, getProductStatusSortSteps } from "../src/services/productService.js";
import { listProducts as shopProducts, validateStoreFilters } from "../src/services/storeService.js";
import { saveVariant } from "../src/services/variantService.js";
import { checkCatalogQuery } from "../src/services/catalogService.js";
import { requireAuth } from "../src/middlewares/auth.js";
import User from "../src/models/User.js";
import { createLoginToken } from "../src/utils/jwt.js";

const id = '111111111111111111111111';
const child = '222222222222222222222222';
afterEach(() => mock.restoreAll());
function query(value) {
  const q = { then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
  for (const name of ['populate','select','sort','skip','limit','collation']) q[name] = () => q;
  return q;
}
test('subcategory query accepts IDs and rejects malformed/array inputs', () => {
  assert.equal(validateStoreFilters({ subcategory: child }).subcategory, child);
  for (const subcategory of ['bad', [child], { $ne: null }]) assert.throws(() => validateStoreFilters({ subcategory }));
});
test('shop intersects subcategory with parent and visible-category constraints', async () => {
  mock.method(Campaign, "find", () => ({ sort() { return this; }, session() { return this; }, lean: async () => [] }));
  mock.method(Category, 'find', (filter) => query(filter.parent ? [{ _id: child }] : [{ _id: id, isListed: true }, { _id: child, isListed: true }]));
  let filter;
  mock.method(Product, 'countDocuments', async (value) => { filter = value; return 0; });
  mock.method(Product, 'find', () => query([]));
  await shopProducts({ query: { category: id, subcategory: child } });
  assert.deepEqual(filter.category, { $in: [id, child] });
  assert.deepEqual(filter.$and, [{ category: { $in: [id, child] } }, { category: child }]);
  assert.equal(filter.isPublished, true);
  assert.equal(filter.isListed, true);
});
test('status sort is validated and ranks the full result before pagination', async () => {
  assert.equal(checkCatalogQuery({ sort: 'status-desc' }).sort, 'status-desc');
  assert.throws(() => checkCatalogQuery({ sort: 'bad' }));
  mock.method(Product, 'countDocuments', async () => 25);
  mock.method(Category, 'find', () => query([]));
  let pipeline;
  mock.method(Product, 'aggregate', async (value) => { pipeline = value; return []; });
  mock.method(Product, 'populate', async (rows) => rows);
  const result = await adminProducts({ query: { sort: 'status-asc', page: '2', limit: '10', category: id } });
  // Aggregations must receive cast ObjectIds rather than raw strings.
  assert.equal(pipeline[0].$match.category.$in[0].constructor.name, 'ObjectId');
  assert.deepEqual(pipeline[2], { $sort: { statusRank: 1, createdAt: -1, _id: -1 } });
  assert.deepEqual(pipeline.slice(3,5), [{ $skip: 10 }, { $limit: 10 }]);
  assert.equal(result.body.data.pagination.totalPages, 3);
  assert.equal(getProductStatusSortSteps({}, 'status-desc', 1, 10)[2].$sort.statusRank, -1);
});
test('status ranking handles overlapping flags and deterministic ties', () => {
  const pipeline = getProductStatusSortSteps({}, 'status-asc', 1, 2);
  const expression = pipeline[1].$addFields.statusRank.$switch;
  function evaluate(expr, item) {
    if (typeof expr === 'string' && expr.startsWith('$')) return item[expr.slice(1)];
    if (!expr || typeof expr !== 'object') return expr;
    if (expr.$ifNull) return evaluate(expr.$ifNull[0],item) ?? expr.$ifNull[1];
    const values = (expr.$eq || expr.$ne).map((part) => evaluate(part,item));
    return expr.$eq ? values[0] === values[1] : values[0] !== values[1];
  }
  const fixtures = [
    { name:'unlisted draft', isListed:false, isPublished:false, stock:0 },
    { name:'draft', isListed:true, isPublished:false, stock:0 },
    { name:'out', isListed:true, isPublished:true, stock:0 },
    { name:'published', isListed:true, isPublished:true, stock:2 },
    { name:'deleted', deletedAt:new Date(), isListed:false, isPublished:false, stock:0 },
  ];
  const rank = (item) => expression.branches.find((branch) => evaluate(branch.case,item))?.then ?? expression.default;
  assert.deepEqual(fixtures.sort((a,b) => rank(a)-rank(b)).map((p) => p.name), ['published','out','draft','unlisted draft','deleted']);
});
test('variant model enforces three to six owned images', () => {
  for (const count of [0,1,2,3,6,7]) {
    const product = new Product({ variants:[{ name:'Small', pricePaise:100, stock:1, images:Array.from({length:count},(_,i) => ({ publicId:String(i), url:'/image.webp' })) }] });
    assert.equal(Boolean(product.validateSync()?.errors['variants.0.images']), count < 3 || count > 6);
  }
});
test('variant service rejects zero to two images before upload or save', async () => {
  const product = new Product({ variants:[] });
  mock.method(Product, 'findById', async () => product);
  const save = mock.method(product, 'save', async () => { throw new Error('Must not save'); });
  for (const count of [0,1,2]) {
    await assert.rejects(saveVariant({ params:{id}, body:{ name:'Small', price:'10', regularPrice:'', stock:'1', isListed:true }, files:Array(count).fill({buffer:Buffer.from('invalid')}) }), /at least three images/);
  }
  assert.equal(save.mock.calls.length, 0);
});
test('variant edit cannot remove images below three or retain foreign images', async () => {
  const product = new Product({ variants:[{ name:'Small', pricePaise:100, stock:1, images:[1,2,3].map((n) => ({publicId:String(n),url:'/image.webp'})) }] });
  mock.method(Product,'findById',async () => product);
  const variant = product.variants[0];
  const input = { params:{id,variantId:String(variant._id)}, body:{version:0,name:'Small',price:'10',regularPrice:'',stock:'1',isListed:true,retainedImageIds:variant.images.slice(0,2).map((image) => String(image._id))} };
  await assert.rejects(saveVariant(input), /at least three images/);
  input.body.retainedImageIds = [id,child];
  await assert.rejects(saveVariant(input), /belongs to another variant/);
});
test('blocked and deleted sessions return explicit restriction codes before session expiry', async () => {
  process.env.JWT_SECRET = 'pending-fixes-test-secret-of-at-least-32-characters';
  for (const deletedAt of [null,new Date()]) {
    mock.method(User,'findById',() => ({select:async () => ({isEmailVerified:true,isBlocked:true,deletedAt,authVersion:2})}));
    let body, status;
    await requireAuth({cookies:{'northstar.token':createLoginToken({id,authVersion:1})}}, {status(value){status=value;return this;},json(value){body=value;},clearCookie(){}}, () => assert.fail('Restricted request must stop'));
    assert.equal(status,403);
    assert.equal(body.code,deletedAt ? 'ACCOUNT_DELETED' : 'ACCOUNT_BLOCKED');
    assert.match(body.message,/restricted/);
    mock.restoreAll();
  }
});
