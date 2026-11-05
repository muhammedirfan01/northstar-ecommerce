// Run with: node tests/pending-fixes.cjs
// Uses an installed Playwright package and Chrome/Edge; all API data is local fixtures.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const id='111111111111111111111111', child='222222222222222222222222';
const noChildren='333333333333333333333333';
const categories=[{id:noChildren,name:'Books'},{id,name:'Electronics'},{id:child,name:'Phones',parentId:id,parentName:'Electronics'}];
const server=spawn(process.execPath,[path.join(__dirname,'../node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5187','--strictPort'],{cwd:path.join(__dirname,'..'),stdio:['ignore','pipe','pipe']});
const ready=new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(b.toString().includes('5187'))resolve();});server.on('exit',()=>reject(new Error('Vite stopped')));});
(async()=>{
 let browser;
 try {
  await ready;
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  const page=await browser.newPage();
  page.on('pageerror', error => console.error('PAGE ERROR:',error.message));
  page.on('console', message => { if(message.type()==='error') console.error('BROWSER:',message.text()); });
  let account=null, restrictMe=false, restrictCart=false, saves=0, requestQuery, restrictionCode="ACCOUNT_BLOCKED", logoutCalls=0, failLogout=false, productSaves=0;
  const product={id,name:'Phone',stock:2,pricePaise:10000,category:categories.find(item => item.id === id),images:[],variants:[{id:child,name:'Small',options:[],pricePaise:10000,stock:2,isListed:true,images:[1,2,3].map(n=>({id:String(n),url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='}))}]};
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const endpoint=url.pathname.replace('/api','');
    if ((endpoint==='/auth/me' && restrictMe) || (endpoint==='/cart' && restrictCart)) return route.fulfill({status:403,json:{code:restrictionCode,message:'Your account is restricted.'}});
    if(endpoint==='/auth/logout') {
      logoutCalls++;
      if (failLogout) return route.fulfill({status:503,json:{message:'Try again'}});
      account=null;restrictMe=false;restrictCart=false;
      return route.fulfill({json:{success:true}});
    }
    if(endpoint==='/auth/me') return route.fulfill({status:account?200:401,json:account?{data:{user:account}}:{message:'Please sign in.'}});
    if(endpoint==='/admin/products' && route.request().method()==='POST') {
      productSaves++;
      // Product creation must submit exactly three cropped uploads.
      assert.equal((route.request().postDataBuffer().toString().match(/name="images"/g)||[]).length,3);
      product.images=[1,2,3].map(n=>({id:String(n),url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='}));
      product.description='A sample product with three images.';
      product.highlights=[];product.specifications=[];
      return route.fulfill({json:{data:{product}}});
    }
    if(endpoint.includes('/variants') && route.request().method()==='PATCH') { saves++; return route.fulfill({json:{data:{product}}}); }
    let data={};
    if(endpoint==='/products/categories' || endpoint==='/admin/categories') data={categories};
    else if(endpoint==='/products') {requestQuery=url.searchParams;data={products:[],pagination:{page:1,totalPages:1,total:0}};}
    else if(endpoint==='/admin/products/'+id) data={product};
    else if(endpoint==='/cart') data={items:[],quantityTotal:0,totalPaise:0};
    else if(endpoint==='/wishlist') data={products:[]};
    await route.fulfill({json:{success:true,data}});
  });
  await page.goto('http://127.0.0.1:5187/products');
  await page.locator('select[name="category"]').waitFor();
  assert.equal(await page.locator('select[name="subcategory"]').count(),0);
  await page.locator('select[name="category"]').selectOption(noChildren);
  assert.equal(await page.locator('select[name="subcategory"]').count(),0);
  await page.locator('select[name="category"]').selectOption(id);
  await page.locator('select[name="subcategory"]').waitFor();
  assert.equal(await page.locator(`select[name="subcategory"] option[value="${child}"]`).textContent(),'Phones');
  await page.locator('select[name="subcategory"]').selectOption(child);
  await page.locator('select[name="category"]').selectOption(noChildren);
  assert.equal(await page.locator('select[name="subcategory"]').count(),0);
  await page.locator('select[name="category"]').selectOption(id);
  assert.equal(await page.locator('select[name="subcategory"]').inputValue(),'');
  console.log('PASS: subcategory appears only for a selected parent with children; switching parents clears it');
  await page.locator('select[name="subcategory"]').selectOption(child);
  await page.getByLabel('Search',{exact:true}).fill('phone');
  const applied = page.waitForResponse(response => new URL(response.url()).searchParams.get('subcategory') === child);
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  await page.waitForURL('**subcategory='+child+'**');
  await applied;
  assert.equal(requestQuery.get('subcategory'),child);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.waitForURL('**/products');
  assert.equal(await page.getByLabel('Search',{exact:true}).inputValue(),'');
  assert.equal(await page.locator('select[name="category"]').inputValue(),'');
  assert.equal(await page.locator('select[name="subcategory"]').count(),0);
  // Clear also resets unsaved values when the URL is already empty.
  await page.getByLabel('Search',{exact:true}).fill('unsaved');
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  assert.equal(await page.getByLabel('Search',{exact:true}).inputValue(),'');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('select[name="category"]').selectOption(id);
  assert.equal(await page.locator('select[name="subcategory"]').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  console.log('PASS: subcategory apply, complete clear, same-URL clear and mobile width');
  restrictMe=true;
  await page.goto('http://127.0.0.1:5187/products');
  await page.locator('dialog[open]').waitFor();
  assert.match(await page.locator('dialog').innerText(),/Your account is restricted/);
  assert.equal(new URL(page.url()).pathname,'/products');
  assert.equal(new URL(page.url()).search,'');
  assert.equal(logoutCalls,0);
  assert.equal(await page.locator('dialog.auth-modal').count(),0);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(),1);
  await page.getByRole('button',{name:'Continue browsing',exact:true}).click();
  await page.waitForURL('http://127.0.0.1:5187/');
  assert.equal(logoutCalls,1);
  console.log('PASS: dedicated restriction modal preserves the URL and waits for acknowledgement');
  restrictionCode='ACCOUNT_DELETED';restrictMe=true;
  await page.goto('http://127.0.0.1:5187/products');
  await page.getByRole('heading',{name:'Your account has been deleted',exact:true}).waitFor();
  assert.equal(logoutCalls,1);
  await page.getByRole('button',{name:'Sign in with another account',exact:true}).click();
  await page.waitForURL('**/?signin=1');
  await page.locator('dialog.auth-modal[open]').waitFor();
  assert.equal(logoutCalls,2);
  restrictionCode='ACCOUNT_BLOCKED';
  console.log('PASS: deleted accounts receive their own modal and can choose another sign-in');
  restrictMe=false;restrictCart=true;account={id,role:'customer',name:'Customer'};
  await page.goto('http://127.0.0.1:5187/cart');
  await page.locator('dialog[open]').waitFor();
  assert.match(await page.locator('dialog').innerText(),/Your account is restricted/);
  assert.equal(new URL(page.url()).pathname,'/cart');
  assert.equal(logoutCalls,2);
  assert.equal(await page.locator('dialog[open]').count(),1);
  failLogout=true;
  await page.getByRole('button',{name:'Continue browsing',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Unable to continue'}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/cart');
  failLogout=false;
  await page.getByRole('button',{name:'Continue browsing',exact:true}).click();
  await page.waitForURL('http://127.0.0.1:5187/');
  assert.equal(logoutCalls,4);
  console.log('PASS: in-session restrictions show one modal without redirecting; failed acknowledgement can be retried');
  restrictCart=false;account={id,role:'admin',name:'Admin'};
  await page.goto('http://127.0.0.1:5187/admin/products/'+id+'/variants');
  await page.getByRole('button',{name:'Add variant',exact:true}).click();
  await page.getByLabel('Variant name').fill('Large');
  await page.getByLabel('Selling price').fill('100');
  await page.getByRole('button',{name:'Save variant',exact:true}).click();
  assert.match(await page.getByRole('alert').innerText(),/at least three images/);
  assert.equal(saves,0);
  console.log('PASS: frontend blocks saving variants with fewer than three images');
  await page.goto('http://127.0.0.1:5187/admin/products/new');
  await page.getByLabel('Product name').fill('Three-image product');
  await page.getByLabel('Description',{exact:false}).first().fill('A sample product with three images.');
  await page.locator('select').filter({has:page.locator('option[value="'+id+'"]')}).selectOption(id);
  await page.getByLabel('Selling price').fill('100');
  const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=20;c.getContext('2d').fillRect(0,0,20,20);return c.toDataURL('image/png').split(',')[1];}),'base64');
  for(let count=0;count<3;count++) {
    await page.getByRole('button',{name:'Save product',exact:true}).click();
    assert.match(await page.getByRole('alert').innerText(),/at least three product images/);
    assert.equal(productSaves,0);
    await page.locator('input[type="file"]').setInputFiles({name:'image-'+count+'.png',mimeType:'image/png',buffer:png});
    await page.getByRole('button',{name:'Use cropped image',exact:true}).click();
    await page.locator('dialog[open]').waitFor({state:'detached'});
    assert.equal(await page.locator('.catalog-image-card').count(),count+1);
  }
  await page.getByRole('button',{name:'Save product',exact:true}).click();
  await page.waitForURL('**/admin/products/'+id+'/edit');
  assert.equal(productSaves,1);
  await page.getByRole('button',{name:'Remove image 3',exact:true}).click();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  assert.match(await page.getByRole('alert').innerText(),/at least three product images/);
  console.log('PASS: product creation blocks zero, one and two images; saves three cropped images; editing cannot reduce below three');
 } finally {await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;server.kill();});
