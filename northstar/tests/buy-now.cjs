const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const origin='http://127.0.0.1:5217', id='111111111111111111111111', other='222222222222222222222222';
const server=spawn(process.execPath,[path.join(__dirname,'../node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5217','--strictPort'],{cwd:path.join(__dirname,'..'),stdio:['ignore','pipe','pipe']});
const ready=new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(b.toString().includes('5217'))resolve();});server.once('exit',()=>reject(Error('Vite exited')));});
(async()=>{let browser;try{
await ready;browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();let cartWrites=0,preview,placement;const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)}); page.on('console',m=>{if(m.type()==='error')console.log(m.text())});
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="gray"/></svg>');
const product={id,name:'Buy now fixture',pricePaise:10000,regularPricePaise:12000,stock:20,variants:[],images:[{id:'image',url:image}],category:{id:other,name:'Camera'},highlights:[],specifications:[],quickSpecs:[],description:'Fixture',priceNote:'Demo-price note'};
const quote={items:[{productId:id,productName:product.name,quantity:3,lineTotalPaise:30000}],subtotal:30000,totalAmount:35000,shippingCharge:5000,tax:0,discount:0,paymentMethods:{cod:true,razorpay:false,wallet:false}};
const order={id:other,orderId:'NS-001',items:quote.items,orderStatus:'cancelled',paymentMethod:'wallet',paymentStatus:'refunded',createdAt:new Date().toISOString(),...quote,shippingAddress:{name:'Fixture'},refund:{method:'wallet',status:'completed',amount:35000},returnRequest:{status:'none'},statusHistory:[],paymentHistory:[]};
await page.route('**/api/**',async route=>{const u=new URL(route.request().url()); if(!u.pathname.startsWith('/api/'))return route.continue(); const p=u.pathname.slice(4),method=route.request().method();let body=route.request().postDataJSON();const send=data=>route.fulfill({json:{success:true,data}});
if(p==='/auth/me'||p==='/admin/me')return send({user:{id:other,name:'Fixture',role:'customer',email:'fixture@example.test',isEmailVerified:true}});
if(p==='/cart'){if(method!=='GET')cartWrites++;return send({quantityTotal:7,items:[],totalPaise:70000});}
if(p==='/wishlist')return send({products:[]});
if(p===`/products/${id}`)return send({product,related:[]});
if(p==='/products/categories')return send({categories:[]});
if(p==='/addresses')return send({version:0,addresses:[{id:other,fullName:'Fixture',phoneNumber:'9876543210',addressLine1:'123 Test Street',city:'Kochi',state:'Kerala',postalCode:'682001',isDefault:true}]});
if(p==='/orders/preview'){preview=body;assert.deepEqual(body.buyNow,{productId:id,variantId:null,quantity:3});return send(quote);}
if(p==='/orders'&&method==='POST'){placement=body;return send({order});}
if(p===`/orders/${other}`)return send({order});
return send({});});
await page.goto(`${origin}/products/${id}`);
await page.getByRole('heading',{name:product.name,exact:true}).waitFor();
assert.equal(await page.getByLabel('Quantity',{exact:true}).locator('option').count(),9);
assert.equal(await page.locator('.pd-info').getByRole('link',{name:/View cart/}).count(),0);
assert.equal(await page.getByText('Demo-price note',{exact:true}).count(),0);
await page.getByLabel('Quantity',{exact:true}).selectOption('3');
await page.getByRole('button',{name:/Buy now/}).click();await page.waitForURL('**/checkout?**');
await page.getByRole('button',{name:'Place COD order'}).waitFor();assert.ok(preview);assert.equal(cartWrites,0);
await page.reload();await page.getByRole('button',{name:'Place COD order'}).waitFor();
await page.getByRole('button',{name:'Place COD order'}).click();await page.waitForURL('**/payment/success');
assert.deepEqual(placement.buyNow,{productId:id,variantId:null,quantity:3});assert.equal(cartWrites,0);
await page.goto(`${origin}/orders/${other}`);await page.getByRole('link',{name:'Check my wallet',exact:true}).waitFor();
assert.equal(await page.getByRole('link',{name:'Check my wallet',exact:true}).getAttribute('href'),'/wallet');
assert.ok(await page.getByText(/Refunded amount added to wallet/).count());assert.deepEqual(errors,[]);
console.log('PASS: nine quantity options, removed View cart/demo note, Buy now isolates selection through refresh and placement without cart writes, wallet refund message/link (browser fixtures).');
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
