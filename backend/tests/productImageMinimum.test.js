import test from 'node:test';
import assert from 'node:assert/strict';
import Product from "../src/models/Product.js";
import Category from "../src/models/Category.js";
import { saveProduct } from "../src/services/productService.js";

const id='111111111111111111111111';
const body={name:'Image product',description:'A product with enough detail.',categoryId:id,price:'100',stock:'2',isPublished:false,isListed:true,highlights:[],specifications:[],retainedImageIds:[]};
const images=(count)=>Array.from({length:count},(_,i)=>({publicId:'owned-'+i,url:'/image-'+i+'.webp'}));
const invalidFiles=(count)=>Array.from({length:count},()=>({buffer:Buffer.from('invalid image')}));

test('product schema requires three to six images',async () => {
  for(const count of [0,1,2,3,6,7]) {
    const product=new Product({name:body.name,description:body.description,category:id,pricePaise:10000,stock:2,images:images(count)});
    if(count<3||count>6) await assert.rejects(product.validate(),error=>Boolean(error.errors.images));
    else await product.validate();
  }
});
test('creation rejects fewer than three or over six files before saving',async (t) => {
  t.mock.method(Category,'exists',async()=>true);
  const save=t.mock.method(Product.prototype,'save',async()=>assert.fail('Must not save'));
  for(const count of [0,1,2,7]) await assert.rejects(saveProduct({params:{},body,files:invalidFiles(count)}),/between 3 and 6 images/);
  assert.equal(save.mock.calls.length,0);
});
test('three new images pass the count check and still undergo real byte validation',async (t)=>{
  t.mock.method(Category,'exists',async()=>true);
  await assert.rejects(saveProduct({params:{},body,files:invalidFiles(3)}),/not a valid JPG/);
});
test('editing counts retained images and new uploads together and validates ownership',async(t)=>{
  t.mock.method(Category,'exists',async()=>true);
  const product=new Product({name:body.name,description:body.description,category:id,pricePaise:10000,stock:2,images:images(3)});
  t.mock.method(Product,'findById',async()=>product);
  const retainedImageIds=product.images.slice(0,2).map(image=>String(image._id));
  await assert.rejects(saveProduct({params:{id},body:{...body,version:0,retainedImageIds},files:[]}),/between 3 and 6 images/);
  await assert.rejects(saveProduct({params:{id},body:{...body,version:0,retainedImageIds},files:invalidFiles(1)}),/not a valid JPG/);
  await assert.rejects(saveProduct({params:{id},body:{...body,version:0,retainedImageIds:[id]},files:invalidFiles(2)}),/does not belong to this product/);
});
for(const count of [3,6]) {
  test(`editing saves a valid gallery of ${count} retained images`,async(t)=>{
    t.mock.method(Category,'exists',async()=>true);
    const product=new Product({name:body.name,description:body.description,category:id,pricePaise:10000,stock:2,images:images(count)});
    t.mock.method(Product,'findById',async()=>product);
    let writes=0;
    t.mock.method(product,'save',async()=>{await product.validate();writes++;return product;});
    t.mock.method(product,'populate',async()=>product);
    const result=await saveProduct({params:{id},body:{...body,version:0,retainedImageIds:product.images.map(image=>String(image._id))},files:[]});
    assert.equal(result.status,200);assert.equal(writes,1);assert.equal(result.body.data.product.images.length,count);
  });
}
