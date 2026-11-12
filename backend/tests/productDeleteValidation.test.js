import test from 'node:test';
import assert from 'node:assert/strict';
import Product from "../src/models/Product.js";
import { deleteProduct, restoreProduct } from "../src/services/productService.js";

const id='111111111111111111111111';
function legacyProduct(imageCount) {
  return Product.hydrate({
    _id:id, __v:4,
    name:'test_product',description:'A product created before the image minimum.',
    category:'222222222222222222222222',
    images:[{_id:'333333333333333333333333',publicId:'product-image',url:'/product.webp'}],
    pricePaise:10000,stock:2,isPublished:true,isListed:true,deletedAt:null,
    series:'',subtitle:'',badge:'',priceNote:'',quickSpecs:[],highlights:[],specifications:[],
    variants:[{
      _id:'444444444444444444444444',name:'Old variant',pricePaise:10000,stock:2,isListed:true,
      images:Array.from({length:imageCount},(_,n)=>({publicId:'variant-'+n,url:'/variant-'+n+'.webp'})),
    }],
  });
}
for (const count of [0,1,2]) {
  test(`delete and restore preserve legacy variants with ${count} images without full-document validation`, async (t) => {
    // Establish that the new image rule fails on this existing document.
    await assert.rejects(legacyProduct(count).validate(),error => Boolean(error.errors['variants.0.images']));
    const product=legacyProduct(count);
    const before=product.toObject();
    t.mock.method(Product,'findById',async () => product);
    const writes=[];
    t.mock.method(Product.collection,'updateOne',async (filter,update) => {
      writes.push({filter,update});
      return {acknowledged:true,matchedCount:1,modifiedCount:1};
    });
    assert.equal((await deleteProduct({params:{id}})).status,200);
    assert.ok(product.deletedAt instanceof Date);
    assert.equal(writes.length,1);
    assert.ok(writes[0].update.$set.deletedAt instanceof Date);
    assert.equal(writes[0].filter.__v,4);
    assert.equal(writes[0].update.$inc.__v,1);
    assert.equal((await restoreProduct({params:{id}})).status,200);
    assert.equal(product.deletedAt,null);
    assert.equal(writes.length,2);
    assert.equal(writes[1].update.$set.deletedAt,null);
    for(const key of ['variants','images','stock','pricePaise','isPublished','isListed']) assert.deepEqual(product.toObject()[key],before[key]);
    for(const {update} of writes) assert.deepEqual(Object.keys(update.$set).sort(),['deletedAt','updatedAt']);
    // Creating/editing variants still has to meet the minimum.
    await assert.rejects(product.validate(),error => Boolean(error.errors['variants.0.images']));
  });
}
test('invalid IDs are rejected before loading a product',async (t) => {
  const find=t.mock.method(Product,'findById',async () => assert.fail('Must not query'));
  await assert.rejects(deleteProduct({params:{id:'invalid'}}),{status:400});
  assert.equal(find.mock.calls.length,0);
});
test('missing products still return 404 when deleting or restoring',async (t) => {
  t.mock.method(Product,'findById',async () => null);
  assert.equal((await deleteProduct({params:{id}})).status,404);
  assert.equal((await restoreProduct({params:{id}})).status,404);
});
