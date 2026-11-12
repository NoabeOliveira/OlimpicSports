'use strict';
window.OS = (()=>{
 let me=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=c=>(Number(c)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 async function api(route, options={}) {
  const response=await fetch('/api'+route,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  let data;try{data=await response.json();}catch{throw new Error('Resposta inesperada do servidor.');}
  if(!response.ok)throw new Error(data.error||'Não foi possível completar a solicitação.');return data;
 }
 const send=(route,method,data)=>api(route,{method,body:data!==undefined?JSON.stringify(data):undefined});
 function notify(message,error=false){const el=document.getElementById('os-notification')||document.createElement('div');el.id='os-notification';el.setAttribute('role','status');el.className='os-notification'+(error?' error':'');el.textContent=message;document.body.appendChild(el);clearTimeout(window.__osTimer);window.__osTimer=setTimeout(()=>el.remove(),5500);}
 function productCard(p){return `<article class="col-lg-4 col-md-6"><div class="card h-100 product-card">
  <div class="product-photo"><a href="produto.html?id=${p.id}" aria-label="Ver ${esc(p.name)}"><img src="${esc(p.image)}" class="card-img-top" loading="lazy" alt="${esc(p.name)}"><span class="hover-prompt"><i class="bi bi-eye"></i> Ver detalhes</span></a>${p.offer?'<span class="product-badge">Oferta</span>':''}</div>
  <div class="card-body"><p class="categoria-produto">${esc(p.category)}</p><h5 class="card-title"><a href="produto.html?id=${p.id}" class="product-name">${esc(p.name)}</a></h5><p class="card-text">${esc(p.description)}</p><h4>${money(p.price_cents)}</h4>
  <div class="d-flex align-items-center gap-2 mt-auto"><a class="btn btn-outline-dark flex-grow-1" href="produto.html?id=${p.id}">Detalhes</a><button class="btn btn-success flex-grow-1 add-to-cart" data-product="${p.id}" ${p.stock<=0?'disabled':''}>${p.stock<=0?'Esgotado':'<i class="bi bi-cart-plus"></i> Carrinho'}</button></div></div></div></article>`;}
 async function refreshNav(){try {me=(await api('/me')).user;}catch {me=null;}
  const nav=document.querySelector('.navbar-nav');if(!nav)return;nav.querySelectorAll('.os-cart-nav,.os-admin-nav').forEach(x=>x.remove());
  const cartLink=document.createElement('li');cartLink.className='nav-item os-cart-nav';cartLink.innerHTML='<a class="nav-link" href="carrinho.html"><i class="bi bi-cart3"></i> Carrinho <span id="navCartCount" class="cart-count" hidden>0</span></a>';nav.appendChild(cartLink);
  const accountLink=nav.querySelector('[data-account-link]');if(accountLink){accountLink.textContent=me?'Minha conta':'Entrar';accountLink.href=me?'conta.html':'login.html';}
  if(me?.role==='admin'){const item=document.createElement('li');item.className='nav-item os-admin-nav';item.innerHTML='<a class="nav-link admin-link" href="admin.html"><i class="bi bi-shield-lock"></i> Gestão</a>';nav.appendChild(item);}
  if(me)try{const cart=await api('/cart');const num=cart.items.reduce((sum,p)=>sum+p.quantity,0);const badge=document.getElementById('navCartCount');badge.textContent=num;badge.hidden=!num;}catch{}
 }
 async function add(id,quantity=1){if(!me){location.href='login.html?next='+encodeURIComponent('produto.html?id='+id);return;}
  try {await send('/cart','POST',{product_id:Number(id),quantity});notify('Produto adicionado ao carrinho!');await refreshCartCount();}
  catch(e){notify(e.message,true);}}
 async function refreshCartCount(){if(!me)return;const cart=await api('/cart');const n=cart.items.reduce((s,x)=>s+x.quantity,0);const b=document.getElementById('navCartCount');if(b){b.textContent=n;b.hidden=!n;}}
 function bindCards(root=document){root.addEventListener('click',event=>{const b=event.target.closest('.add-to-cart');if(b){event.preventDefault();add(b.dataset.product);}});}
 function requireLogin(){if(!me){location.href='login.html?next='+encodeURIComponent(location.pathname.split('/').pop()+location.search);return false;}return true;}
 const safeNext=next=>{if(typeof next!=='string'||!/^[\w.-]+\.html(?:\?[\w=&%.-]*)?$/.test(next))return 'conta.html';return next;};
 let resolveReady;const readyPromise=new Promise(resolve=>resolveReady=resolve);
 const load=async()=>{try{await refreshNav();}finally{resolveReady();}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
 return {esc,money,api,send,notify,productCard,bindCards,add,refreshNav,refreshCartCount,requireLogin,safeNext,get me(){return me;},ready:()=>readyPromise};
})();
