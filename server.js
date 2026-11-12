'use strict';
// OlimpicSports: servidor e-commerce demonstrativo, persistência SQLite e autorização no backend.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DB_FILE = path.resolve(process.env.OLIMPIC_DB_FILE || path.join(ROOT, '.data', 'olimpic.sqlite'));
const PORT = Number(process.env.PORT || 3000);
const PROD = process.env.NODE_ENV === 'production';
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
db.exec(`
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','admin')), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    description TEXT NOT NULL, category TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents>0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), image TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0,
    offer INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS addresses(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL, receiver TEXT NOT NULL, zip TEXT NOT NULL, street TEXT NOT NULL, number TEXT NOT NULL,
    complement TEXT NOT NULL DEFAULT '', neighborhood TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS cart_items(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity>=1 AND quantity<=99),
    PRIMARY KEY(user_id,product_id));
 CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
    address_snapshot TEXT NOT NULL, total_cents INTEGER NOT NULL, payment_method TEXT NOT NULL,
    installments INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'simulado',
    payment_status TEXT NOT NULL DEFAULT 'nao_cobrado', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id), product_name TEXT NOT NULL, quantity INTEGER NOT NULL,
    price_cents INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id),
    delta INTEGER NOT NULL, reason TEXT NOT NULL, admin_id INTEGER REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS finance_entries(id INTEGER PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('receita','despesa')),
    category TEXT NOT NULL, note TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
    admin_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

const stmt = sql => db.prepare(sql);
const now = () => Math.floor(Date.now() / 1000);
const clean = (v, max=160) => String(v ?? '').trim().slice(0, max);
const emailClean = v => clean(v,254).toLowerCase();
const hashPassword = pw => { const salt=crypto.randomBytes(16).toString('hex'); const hash=crypto.scryptSync(pw,salt,64).toString('hex'); return `scrypt:${salt}:${hash}`; };
const verifyPassword = (pw,stored) => { try { const [algo,salt,hex]=stored.split(':'); if(algo!=='scrypt')return false;const expected=Buffer.from(hex,'hex'); const actual=crypto.scryptSync(pw,salt,expected.length);return crypto.timingSafeEqual(expected,actual); } catch {return false;} };

const seeds = [
 ['tenis','Tênis Esportivo','Conforto e desempenho para suas corridas.','Corrida',29990,18,'imagens/tenisC.jpg'],
 ['camisa','Camisa Esportiva','Conforto para torcer pelo seu time do coração.','Futebol',35000,25,'imagens/Bahia.jpg'],
 ['bola','Bola de Futebol','Qualidade e resistência para suas partidas.','Futebol',25990,35,'imagens/bola.jpg'],
 ['chuteira','Chuteira','A melhor chuteira para o seu melhor jogo.','Futebol',59990,12,'imagens/chuteira2.jpg'],
 ['oculos','Óculos Esportivo','Proteção e estilo para sua maratona.','Corrida',24990,20,'imagens/oculespor.jpg'],
 ['basquete','Camisa de Basquete','Qualidade dentro e fora das quadras.','Basquete',79990,8,'imagens/bast3.png']
];
if (!stmt('SELECT id FROM products LIMIT 1').get()) {
 const ins=stmt('INSERT INTO products(slug,name,description,category,price_cents,stock,image,featured,offer) VALUES(?,?,?,?,?,?,?,1,0)');
 for(const s of seeds) ins.run(...s);
 stmt("UPDATE products SET offer=1 WHERE slug IN ('tenis','oculos')").run();
}
const adminExists = stmt("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
if (!adminExists) {
 const email=emailClean(process.env.ADMIN_EMAIL), pw=process.env.ADMIN_PASSWORD;
 if (!email.includes('@') || !pw || pw.length<12) {
   console.error('\nERRO: configure ADMIN_EMAIL e ADMIN_PASSWORD (mín. 12 caracteres) antes da primeira execução. Veja README.md.\n');
   process.exit(1);
 }
 stmt("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run('Administrador OlimpicSports',email,hashPassword(pw));
 console.log('Conta de administrador inicializada. Credenciais não são exibidas.');
}

function respond(res,status,data,headers={}) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data)); }
function error(res,status,message){respond(res,status,{error:message});}
async function bodyJSON(req) {
 return new Promise((resolve,reject)=>{
   let data='', size=0;
   req.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024){reject(Object.assign(new Error('Corpo excessivo.'),{status:413}));req.destroy();return;}data+=chunk.toString('utf8');});
   req.on('end',()=>{try{resolve(data?JSON.parse(data):{});}catch{reject(Object.assign(new Error('JSON inválido.'),{status:400}));}});
   req.on('error',reject);
 });
}
function cookie(req,key){const found=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='));return found?found.slice(key.length+1):'';}
function sessionUser(req){const token=cookie(req,'os_session');if(!/^[0-9a-f]{64}$/.test(token))return null;
 return stmt('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(crypto.createHash('sha256').update(token).digest('hex'),now())||null;}
function saveSession(res,userId) { const token=crypto.randomBytes(32).toString('hex');
 stmt('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),userId,now()+7*86400);
 res.setHeader('Set-Cookie',`os_session=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax${PROD?'; Secure':''}`);
}
function requireUser(req,res){const user=sessionUser(req);if(!user)error(res,401,'Entre na sua conta para continuar.');return user;}
function requireAdmin(req,res){const u=requireUser(req,res);if(u&&u.role!=='admin'){error(res,403,'Acesso exclusivo ao administrador.');return null;}return u;}
const goodName = v => {const s=clean(v,100);if(s.length<2)throw Object.assign(new Error('Informe um nome válido.'),{status:400});return s;};
function validateAddress(b){const a={label:clean(b.label,40)||'Meu endereço',receiver:clean(b.receiver,100),zip:clean(b.zip,12),street:clean(b.street,120),number:clean(b.number,20),complement:clean(b.complement,100),neighborhood:clean(b.neighborhood,100),city:clean(b.city,100),state:clean(b.state,2).toUpperCase(),is_default:b.is_default?1:0};
 if(!a.receiver||!/^[0-9]{5}-?[0-9]{3}$/.test(a.zip)||!a.street||!a.number||!a.neighborhood||!a.city||!/^[A-Z]{2}$/.test(a.state))throw Object.assign(new Error('Preencha corretamente o endereço (CEP, rua, número, bairro, cidade e UF).'),{status:400});return a;}
function validateProduct(b){ const p={name:clean(b.name,100),description:clean(b.description,1200),category:clean(b.category,70),price_cents:Number(b.price_cents),stock:Number(b.stock),image:clean(b.image,400),featured:b.featured?1:0,offer:b.offer?1:0};
 if(p.name.length<3||!p.description||!p.category||!Number.isInteger(p.price_cents)||p.price_cents<=0||p.price_cents>100000000||!Number.isInteger(p.stock)||p.stock<0||p.stock>1000000||!/^(imagens\/[\w.\-]+|uploads\/[\w.\-]+|https:\/\/[^\s]+)$/i.test(p.image)) throw Object.assign(new Error('Dados de produto inválidos. Imagem: caminho da pasta imagens/uploads ou URL HTTPS.'),{status:400});return p; }
const numericId=x=>{const id=Number(x);return Number.isSafeInteger(id)&&id>0?id:0;};
const productPublicSql='SELECT id,slug,name,description,category,price_cents,stock,image,featured,offer FROM products WHERE active=1';
const methods=new Set(['POST','PUT','PATCH','DELETE']);
const attempts=new Map();
function enforceLoginRate(req,email){const key=(req.socket.remoteAddress||'ip')+'|'+email;const x=attempts.get(key)||{n:0,until:0};if(Date.now()>x.until){x.n=0;x.until=Date.now()+15*60000;} if(x.n>=10)throw Object.assign(new Error('Muitas tentativas. Tente novamente em 15 minutos.'),{status:429});x.n++;attempts.set(key,x);if(attempts.size>4000)attempts.clear();return ()=>attempts.delete(key);}
function tx(action){db.exec('BEGIN IMMEDIATE');try{const r=action();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
const bad=(msg,status=400)=>{throw Object.assign(new Error(msg),{status});};
const cartQuery=stmt('SELECT c.product_id,c.quantity,p.name,p.image,p.price_cents,p.stock,p.active,p.slug FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=? ORDER BY p.name');
const getCart=id=>{const items=cartQuery.all(id);return {items,subtotal_cents:items.reduce((s,x)=>s+x.quantity*x.price_cents,0)};};

async function api(req,res,url){const pathname=url.pathname,method=req.method;
 if(methods.has(method)){
   const origin=req.headers.origin; const host=req.headers.host;
   if((origin && new URL(origin).host!==host) || req.headers['sec-fetch-site']==='cross-site')return error(res,403,'Origem não autorizada.');
 }
 if(method==='GET'&&pathname==='/api/products'){
  let sql=productPublicSql,params=[];const q=clean(url.searchParams.get('q'),100),cat=clean(url.searchParams.get('category'),70);
  if(q){sql+=' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)';params.push(...Array(3).fill('%'+q+'%'));}
  if(cat){sql+=' AND category=?';params.push(cat);}
  if(url.searchParams.get('offers')==='1')sql+=' AND offer=1';
  sql+=' ORDER BY featured DESC,id ASC';return respond(res,200,{products:stmt(sql).all(...params)});
 }
 const productMatch=pathname.match(/^\/api\/products\/(\d+)$/);
 if(method==='GET'&&productMatch){const p=stmt(productPublicSql+' AND id=?').get(numericId(productMatch[1]));return p?respond(res,200,{product:p}):error(res,404,'Produto não encontrado.');}
 if(method==='POST'&&pathname==='/api/auth/register'){
  const b=await bodyJSON(req),name=goodName(b.name),email=emailClean(b.email),pw=String(b.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||pw.length<10||pw.length>200)bad('Use um e-mail válido e senha de 10 a 200 caracteres.');
  try {const r=stmt("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'user')").run(name,email,hashPassword(pw));saveSession(res,Number(r.lastInsertRowid));return respond(res,201,{user:{id:Number(r.lastInsertRowid),name,email,role:'user'}});
  } catch(e){if(String(e).includes('UNIQUE'))bad('Este e-mail já está cadastrado.',409);throw e;}
 }
 if(method==='POST'&&pathname==='/api/auth/login'){
  const b=await bodyJSON(req),email=emailClean(b.email),pw=String(b.password||'');const reset=enforceLoginRate(req,email);
  const u=stmt('SELECT * FROM users WHERE email=?').get(email);if(!u||!verifyPassword(pw,u.password_hash))bad('E-mail ou senha incorretos.',401);
  reset();saveSession(res,u.id);return respond(res,200,{user:{id:u.id,name:u.name,email:u.email,role:u.role}});
 }
 if(method==='POST'&&pathname==='/api/auth/logout'){
  const token=cookie(req,'os_session');if(/^[0-9a-f]{64}$/.test(token))stmt('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));
  res.setHeader('Set-Cookie',`os_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${PROD?'; Secure':''}`);return respond(res,200,{ok:true});
 }
 if(method==='GET'&&pathname==='/api/me'){return respond(res,200,{user:sessionUser(req)});}
 if(method==='PUT'&&pathname==='/api/me'){
  const u=requireUser(req,res);if(!u)return;const b=await bodyJSON(req),name=goodName(b.name);stmt('UPDATE users SET name=? WHERE id=?').run(name,u.id);return respond(res,200,{ok:true});
 }
 if(method==='PUT'&&pathname==='/api/me/password'){
  const u=requireUser(req,res);if(!u)return;const b=await bodyJSON(req);const old=String(b.old_password||''),pw=String(b.new_password||'');
  if(pw.length<10||pw.length>200)bad('A nova senha deve conter pelo menos 10 caracteres.');
  if(!verifyPassword(old,stmt('SELECT password_hash FROM users WHERE id=?').get(u.id).password_hash))bad('Senha atual incorreta.',403);
  stmt('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(pw),u.id);stmt('DELETE FROM sessions WHERE user_id=?').run(u.id);res.setHeader('Set-Cookie','os_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');return respond(res,200,{ok:true});
 }
 if(pathname==='/api/addresses'&&method==='GET'){
  const u=requireUser(req,res);if(!u)return;return respond(res,200,{addresses:stmt('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,id DESC').all(u.id)});
 }
 if(pathname==='/api/addresses'&&method==='POST'){
  const u=requireUser(req,res);if(!u)return;const a=validateAddress(await bodyJSON(req));
  const id=tx(()=>{if(a.is_default||!stmt('SELECT id FROM addresses WHERE user_id=? LIMIT 1').get(u.id)){stmt('UPDATE addresses SET is_default=0 WHERE user_id=?').run(u.id);a.is_default=1;}
   const r=stmt('INSERT INTO addresses(user_id,label,receiver,zip,street,number,complement,neighborhood,city,state,is_default) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(u.id,a.label,a.receiver,a.zip,a.street,a.number,a.complement,a.neighborhood,a.city,a.state,a.is_default);return Number(r.lastInsertRowid);});return respond(res,201,{id});
 }
 const addrMatch=pathname.match(/^\/api\/addresses\/(\d+)$/);
 if(addrMatch&&['PUT','DELETE'].includes(method)){
  const u=requireUser(req,res);if(!u)return;const id=numericId(addrMatch[1]);const existing=stmt('SELECT * FROM addresses WHERE id=? AND user_id=?').get(id,u.id);if(!existing)return error(res,404,'Endereço não encontrado.');
  if(method==='DELETE'){tx(()=>{stmt('DELETE FROM addresses WHERE id=? AND user_id=?').run(id,u.id);if(existing.is_default)stmt('UPDATE addresses SET is_default=1 WHERE id=(SELECT id FROM addresses WHERE user_id=? ORDER BY id DESC LIMIT 1)').run(u.id);});return respond(res,200,{ok:true});}
  const a=validateAddress(await bodyJSON(req));tx(()=>{if(a.is_default)stmt('UPDATE addresses SET is_default=0 WHERE user_id=?').run(u.id);
    stmt('UPDATE addresses SET label=?,receiver=?,zip=?,street=?,number=?,complement=?,neighborhood=?,city=?,state=?,is_default=? WHERE id=? AND user_id=?').run(a.label,a.receiver,a.zip,a.street,a.number,a.complement,a.neighborhood,a.city,a.state,a.is_default,id,u.id);
    if(!stmt('SELECT id FROM addresses WHERE user_id=? AND is_default=1').get(u.id))stmt('UPDATE addresses SET is_default=1 WHERE id=?').run(id);});return respond(res,200,{ok:true});
 }
 if(pathname==='/api/cart'&&method==='GET'){
  const u=requireUser(req,res);if(!u)return;return respond(res,200,getCart(u.id));
 }
 if(pathname==='/api/cart'&&method==='POST'){
  const u=requireUser(req,res);if(!u)return;const b=await bodyJSON(req),id=numericId(b.product_id),qty=Number(b.quantity||1);
  if(!Number.isInteger(qty)||qty<1||qty>99)bad('Quantidade inválida.');const p=stmt('SELECT id,stock FROM products WHERE id=? AND active=1').get(id);
  if(!p)bad('Produto indisponível.',404);
  const previous=stmt('SELECT quantity FROM cart_items WHERE user_id=? AND product_id=?').get(u.id,id)?.quantity||0;
  if(previous+qty>p.stock||previous+qty>99)bad('Estoque insuficiente para a quantidade solicitada.',409);
  stmt('INSERT INTO cart_items(user_id,product_id,quantity) VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=excluded.quantity').run(u.id,id,previous+qty);
  return respond(res,200,getCart(u.id));
 }
 const cartMatch=pathname.match(/^\/api\/cart\/(\d+)$/);
 if(cartMatch&&['PUT','DELETE'].includes(method)){
  const u=requireUser(req,res);if(!u)return;const id=numericId(cartMatch[1]);
  if(method==='DELETE')stmt('DELETE FROM cart_items WHERE user_id=? AND product_id=?').run(u.id,id);
  else {const b=await bodyJSON(req),qty=Number(b.quantity),p=stmt('SELECT stock FROM products WHERE id=? AND active=1').get(id);
   if(!p||!Number.isInteger(qty)||qty<1||qty>99||qty>p.stock)bad('Quantidade inválida ou estoque insuficiente.',409);
   const x=stmt('UPDATE cart_items SET quantity=? WHERE user_id=? AND product_id=?').run(qty,u.id,id);if(!x.changes)bad('Item não encontrado.',404);
  }
  return respond(res,200,getCart(u.id));
 }
 if(pathname==='/api/orders'&&method==='POST'){
  const u=requireUser(req,res);if(!u)return;const b=await bodyJSON(req),address_id=numericId(b.address_id),payment=clean(b.payment_method,20),installments=Number(b.installments||1);
  if(!['pix','cartao','boleto'].includes(payment)||!Number.isInteger(installments)||installments<1||(payment==='cartao'?installments>6:installments!==1))bad('Selecione pagamento e parcelas válidos.');
  const result=tx(()=>{
   const a=stmt('SELECT * FROM addresses WHERE id=? AND user_id=?').get(address_id,u.id);if(!a)bad('Escolha um endereço da sua conta.',404);
   const items=cartQuery.all(u.id);if(!items.length)bad('Carrinho vazio.');
   for(const p of items)if(!p.active||p.quantity>p.stock)bad(`Estoque indisponível para ${p.name}. Atualize seu carrinho.`,409);
   const total=items.reduce((s,p)=>s+p.price_cents*p.quantity,0);
   const r=stmt('INSERT INTO orders(user_id,address_snapshot,total_cents,payment_method,installments) VALUES(?,?,?,?,?)').run(u.id,JSON.stringify(a),total,payment,installments);
   const oid=Number(r.lastInsertRowid);
   for(const p of items){stmt('INSERT INTO order_items(order_id,product_id,product_name,quantity,price_cents) VALUES(?,?,?,?,?)').run(oid,p.product_id,p.name,p.quantity,p.price_cents);
    const ok=stmt('UPDATE products SET stock=stock-? WHERE id=? AND active=1 AND stock>=?').run(p.quantity,p.product_id,p.quantity);
    if(!ok.changes)bad('O estoque mudou. Atualize o carrinho.',409);
    stmt('INSERT INTO stock_movements(product_id,delta,reason) VALUES(?,?,?)').run(p.product_id,-p.quantity,`Pedido demonstrativo #${oid}`);
   }
   stmt('DELETE FROM cart_items WHERE user_id=?').run(u.id);return {id:oid,total_cents:total,status:'simulado',payment_status:'nao_cobrado'};
  });return respond(res,201,{order:result});
 }
 if(pathname==='/api/orders'&&method==='GET'){
  const u=requireUser(req,res);if(!u)return;const orders=stmt('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(u.id);
  for(const o of orders)o.items=stmt('SELECT product_name,quantity,price_cents FROM order_items WHERE order_id=?').all(o.id);
  return respond(res,200,{orders});
 }
 if(pathname==='/api/admin/products'&&method==='GET'){
  const u=requireAdmin(req,res);if(!u)return;return respond(res,200,{products:stmt('SELECT * FROM products ORDER BY id DESC').all()});
 }
 if(pathname==='/api/admin/products'&&method==='POST'){
  const u=requireAdmin(req,res);if(!u)return;const p=validateProduct(await bodyJSON(req));
  const slug=clean(p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),70)+'-'+crypto.randomBytes(3).toString('hex');
  const r=stmt('INSERT INTO products(slug,name,description,category,price_cents,stock,image,featured,offer) VALUES(?,?,?,?,?,?,?,?,?)').run(slug,p.name,p.description,p.category,p.price_cents,p.stock,p.image,p.featured,p.offer);
  stmt('INSERT INTO stock_movements(product_id,delta,reason,admin_id) VALUES(?,?,?,?)').run(Number(r.lastInsertRowid),p.stock,'Estoque inicial',u.id);
  return respond(res,201,{id:Number(r.lastInsertRowid)});
 }
 const adminProduct=pathname.match(/^\/api\/admin\/products\/(\d+)$/);
 if(adminProduct&&['PUT','DELETE'].includes(method)){
  const u=requireAdmin(req,res);if(!u)return;const id=numericId(adminProduct[1]),old=stmt('SELECT * FROM products WHERE id=?').get(id);if(!old)bad('Produto não encontrado.',404);
  if(method==='DELETE'){stmt('UPDATE products SET active=0 WHERE id=?').run(id);return respond(res,200,{ok:true});}
  const p=validateProduct(await bodyJSON(req));tx(()=>{stmt('UPDATE products SET name=?,description=?,category=?,price_cents=?,stock=?,image=?,featured=?,offer=?,active=1 WHERE id=?').run(p.name,p.description,p.category,p.price_cents,p.stock,p.image,p.featured,p.offer,id);
   if(p.stock!==old.stock)stmt('INSERT INTO stock_movements(product_id,delta,reason,admin_id) VALUES(?,?,?,?)').run(id,p.stock-old.stock,'Ajuste administrativo',u.id);
  });return respond(res,200,{ok:true});
 }
 if(pathname==='/api/admin/uploads'&&method==='POST'){
  const u=requireAdmin(req,res);if(!u)return;const b=await bodyJSON(req);const encoded=String(b.data||''),mime=clean(b.mime,30);
  const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};if(!allowed[mime]||encoded.length>3.8e6||!encoded.length)bad('Envie JPG, PNG ou WebP com até cerca de 2,5 MB.');
  const buf=Buffer.from(encoded,'base64');if(buf.length>2.5*1024*1024||buf.length<12)bad('Imagem inválida.');
  const sig=mime==='image/png'?buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):mime==='image/jpeg'?(buf[0]===0xff&&buf[1]===0xd8):buf.subarray(0,4).toString()==='RIFF'&&buf.subarray(8,12).toString()==='WEBP';
  if(!sig)bad('Formato de arquivo incompatível.');
  const dest='uploads/'+crypto.randomBytes(14).toString('hex')+'.'+allowed[mime];fs.mkdirSync(path.join(ROOT,'uploads'),{recursive:true});fs.writeFileSync(path.join(ROOT,dest),buf,{flag:'wx'});return respond(res,201,{image:dest});
 }
 if(pathname==='/api/admin/orders'&&method==='GET'){
  const u=requireAdmin(req,res);if(!u)return;const orders=stmt('SELECT o.*,u.name AS customer,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC').all();
  for(const o of orders)o.items=stmt('SELECT product_name,quantity,price_cents FROM order_items WHERE order_id=?').all(o.id);
  return respond(res,200,{orders});
 }
 const orderStatus=pathname.match(/^\/api\/admin\/orders\/(\d+)\/status$/);
 if(orderStatus&&method==='PUT'){
  const u=requireAdmin(req,res);if(!u)return;const id=numericId(orderStatus[1]),{status}=await bodyJSON(req);
  if(!['simulado','em_preparacao','enviado','entregue','cancelado'].includes(status))bad('Status inválido.');
  tx(()=>{const o=stmt('SELECT * FROM orders WHERE id=?').get(id);if(!o)bad('Pedido não encontrado.',404);
   if(o.status==='cancelado'&&status!=='cancelado')bad('Um pedido cancelado não pode ser reaberto.',409);
   if(status==='cancelado'&&o.status!=='cancelado'){
    for(const item of stmt('SELECT * FROM order_items WHERE order_id=?').all(id))if(item.product_id){stmt('UPDATE products SET stock=stock+? WHERE id=?').run(item.quantity,item.product_id);stmt('INSERT INTO stock_movements(product_id,delta,reason,admin_id) VALUES(?,?,?,?)').run(item.product_id,item.quantity,`Cancelamento #${id}`,u.id);}
   }
   stmt('UPDATE orders SET status=? WHERE id=?').run(status,id);
  });return respond(res,200,{ok:true});
 }
 if(pathname==='/api/admin/users'&&method==='GET'){
  const u=requireAdmin(req,res);if(!u)return;return respond(res,200,{users:stmt('SELECT id,name,email,role,created_at FROM users ORDER BY id DESC').all()});
 }
 if(pathname==='/api/admin/finance'&&method==='GET'){
  const u=requireAdmin(req,res);if(!u)return;
  const entries=stmt('SELECT f.*,u.name AS author FROM finance_entries f JOIN users u ON f.admin_id=u.id ORDER BY f.id DESC').all();
  const orders=stmt("SELECT COUNT(*) AS quantity,COALESCE(SUM(total_cents),0) AS total FROM orders WHERE status<>'cancelado'").get();
  const income=entries.filter(x=>x.type==='receita').reduce((s,x)=>s+x.amount_cents,0),expense=entries.filter(x=>x.type==='despesa').reduce((s,x)=>s+x.amount_cents,0);
  return respond(res,200,{entries,totals:{simulated_orders:orders.quantity,simulated_sales_cents:orders.total,income_cents:income,expense_cents:expense,balance_cents:income-expense}});
 }
 if(pathname==='/api/admin/finance'&&method==='POST'){
  const u=requireAdmin(req,res);if(!u)return;const b=await bodyJSON(req),type=clean(b.type,10),category=clean(b.category,70),note=clean(b.note,300),amount=Number(b.amount_cents);
  if(!['receita','despesa'].includes(type)||!category||!note||!Number.isInteger(amount)||amount<=0||amount>1e11)bad('Lançamento financeiro inválido.');
  const r=stmt('INSERT INTO finance_entries(type,category,note,amount_cents,admin_id) VALUES(?,?,?,?,?)').run(type,category,note,amount,u.id);return respond(res,201,{id:Number(r.lastInsertRowid)});
 }
 const financeDel=pathname.match(/^\/api\/admin\/finance\/(\d+)$/);
 if(financeDel&&method==='DELETE'){const u=requireAdmin(req,res);if(!u)return;const r=stmt('DELETE FROM finance_entries WHERE id=?').run(numericId(financeDel[1]));if(!r.changes)bad('Lançamento não encontrado.',404);return respond(res,200,{ok:true});}
 if(pathname==='/api/admin/stock'&&method==='GET'){
  const u=requireAdmin(req,res);if(!u)return;return respond(res,200,{movements:stmt('SELECT m.*,p.name AS product FROM stock_movements m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 150').all()});
 }
 return error(res,404,'Rota de API não encontrada.');
}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon'};
function staticFile(req,res,url){if(req.method!=='GET'&&req.method!=='HEAD')return error(res,405,'Método não permitido.');
 let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return error(res,400,'Caminho inválido.');}
 if(pathname==='/')pathname='/index.html';
 const extension=path.extname(pathname).toLowerCase();if(!MIME[extension]||!(/^\/[a-z0-9-]+\.(html|css|js)$/i.test(pathname)||/^\/(imagens|uploads)\/[a-z0-9_.-]+\.(jpg|jpeg|png|webp|svg)$/i.test(pathname)))return error(res,404,'Arquivo não encontrado.');
 const name=path.join(ROOT,pathname);if(!name.startsWith(ROOT+path.sep))return error(res,403,'Acesso negado.');
 fs.stat(name,(e,info)=>{if(e||!info.isFile())return error(res,404,'Arquivo não encontrado.');res.writeHead(200,{'Content-Type':MIME[extension],'Cache-Control':extension==='.html'?'no-cache':'public, max-age=3600'});if(req.method==='HEAD')return res.end();fs.createReadStream(name).pipe(res);});
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))await api(req,res,url);else staticFile(req,res,url);
 }catch(e){console.error('Falha:',e.message);if(!res.headersSent)error(res,e.status||500,e.status?e.message:'Erro interno do servidor.');else res.end();}
});
if(require.main===module)server.listen(PORT,()=>console.log(`OlimpicSports disponível em http://localhost:${PORT}`));
module.exports={server,db};
