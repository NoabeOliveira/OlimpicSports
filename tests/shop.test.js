'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'olimpic-test-'));
const port=23000+Math.floor(Math.random()*15000);
const base=`http://127.0.0.1:${port}`;
let server;
const cookie={admin:'',client:''};
async function call(endpoint,method='GET',body,role){const rsp=await fetch(base+'/api'+endpoint,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(role&&cookie[role]?{cookie:cookie[role]}:{})},body:body?JSON.stringify(body):undefined});
 const set=rsp.headers.get('set-cookie');if(role&&set&&set.includes('os_session='))cookie[role]=set.split(';')[0];return {status:rsp.status,data:await rsp.json()};}
function waitForServer(){return new Promise((resolve,reject)=>{let attempts=0;const poll=async()=>{try{const r=await fetch(base+'/api/me');if(r.ok)return resolve();}catch{}
 if(++attempts>70)return reject(Error('Server failed to start'));
 setTimeout(poll,100);
 };poll();});}
test('fluxo integrado: admin, contas, endereços, carrinho, pedidos e financeiro',async()=>{
 server=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),ADMIN_EMAIL:'admin@olimpic.local',ADMIN_PASSWORD:'Senha-Admin-Teste-Forte-2026',OLIMPIC_DB_FILE:path.join(temp,'shop.sqlite')},stdio:'pipe'});
 let logs='';server.stderr.on('data',x=>{logs+=x;});server.stdout.on('data',x=>{logs+=x;});
 try{
  await waitForServer();
  let r=await call('/products');assert.equal(r.status,200);assert.equal(r.data.products.length,6);
  assert.equal(r.data.products[0].name,'Tênis Esportivo');
  r=await call('/auth/register','POST',{name:'Cliente de Testes',email:'cliente@test.local',password:'SenhaClienteSuperForte'},'client');assert.equal(r.status,201);assert.equal(r.data.user.role,'user');
  r=await call('/admin/users','GET',undefined,'client');assert.equal(r.status,403);
  r=await call('/admin/products','POST',{name:'Hack',price_cents:1,stock:1,category:'x',description:'x',image:'imagens/bola.jpg'},'client');assert.equal(r.status,403);
  r=await call('/auth/login','POST',{email:'admin@olimpic.local',password:'Senha-Admin-Teste-Forte-2026'},'admin');assert.equal(r.status,200);assert.equal(r.data.user.role,'admin');
  const a={label:'Casa',receiver:'Cliente de Testes',zip:'44000-000',street:'Rua dos Esportes',number:'10',complement:'Apto 5',neighborhood:'Centro',city:'Feira de Santana',state:'BA',is_default:true};
  r=await call('/addresses','POST',a,'client');assert.equal(r.status,201);let addr=r.data.id;
  r=await call('/cart','POST',{product_id:1,quantity:2},'client');assert.equal(r.status,200);assert.equal(r.data.subtotal_cents,59980);
  r=await call('/orders','POST',{address_id:addr,payment_method:'pix',installments:1},'client');assert.equal(r.status,201);const order=r.data.order;assert.equal(order.total_cents,59980);assert.equal(order.payment_status,'nao_cobrado');
  r=await call('/cart','GET',undefined,'client');assert.equal(r.data.items.length,0);
  r=await call('/products/1');assert.equal(r.data.product.stock,16);
  r=await call('/orders','GET',undefined,'client');assert.equal(r.data.orders.length,1);assert.equal(r.data.orders[0].items[0].quantity,2);
  r=await call('/admin/finance','GET',undefined,'admin');assert.equal(r.data.totals.simulated_sales_cents,59980);assert.equal(r.data.totals.income_cents,0);
  r=await call('/admin/finance','POST',{type:'despesa',category:'Teste',note:'Compra de material',amount_cents:500},'admin');assert.equal(r.status,201);
  r=await call('/admin/finance','GET',undefined,'admin');assert.equal(r.data.totals.balance_cents,-500);
  r=await call(`/admin/orders/${order.id}/status`,'PUT',{status:'cancelado'},'admin');assert.equal(r.status,200);
  r=await call('/products/1');assert.equal(r.data.product.stock,18);
  r=await call('/admin/finance','GET',undefined,'admin');assert.equal(r.data.totals.simulated_sales_cents,0);
  r=await call('/admin/products','POST',{name:'Produto de Teste',description:'Novo produto',category:'Fitness',price_cents:12990,stock:3,image:'imagens/bola.jpg',offer:true},'admin');assert.equal(r.status,201);const prod=r.data.id;
  r=await call('/products/'+prod);assert.equal(r.status,200);
  r=await call('/admin/products/'+prod,'DELETE',undefined,'admin');assert.equal(r.status,200);
  r=await call('/products/'+prod);assert.equal(r.status,404);
  r=await fetch(base+'/');assert.equal(r.status,200);assert.match(await r.text(),/VIVA O ESPORTE/);
  r=await fetch(base+'/admin.html');assert.equal(r.status,200);
  r=await fetch(base+'/.data/shop.sqlite');assert.equal(r.status,404);
 }finally{server.kill();fs.rmSync(temp,{recursive:true,force:true});}
}, {timeout:20000});
