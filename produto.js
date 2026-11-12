'use strict';
(async()=>{
 const mount=document.getElementById('product-detail');const id=Number(new URLSearchParams(location.search).get('id'));
 if(!Number.isInteger(id)||id<=0){mount.textContent='Produto inválido.';return;}
 try{
  const {product:p}=await OS.api('/products/'+id);document.title=p.name+' — OlimpicSports';
  mount.innerHTML=`<div class="row align-items-start g-5"><div class="col-lg-6"><div class="detail-photo"><img src="${OS.esc(p.image)}" alt="${OS.esc(p.name)}"></div></div>
   <div class="col-lg-6"><a class="small text-muted" href="produtos.html">← Voltar ao catálogo</a><p class="categoria-produto mt-4">${OS.esc(p.category)}</p><h1 class="mb-3">${OS.esc(p.name)}</h1><p class="detail-description">${OS.esc(p.description)}</p><h2 class="detail-price">${OS.money(p.price_cents)}</h2>
   <p class="${p.stock>0?'text-success':'text-danger'} fw-semibold">${p.stock>0?`${p.stock} unidade(s) em estoque`:'Produto esgotado'}</p>
   <label for="detail-qty" class="form-label">Quantidade</label><input id="detail-qty" type="number" class="form-control mb-3" style="max-width:135px" min="1" max="${Math.min(p.stock,99)}" value="1" ${p.stock?'':'disabled'}>
   <div class="d-flex flex-wrap gap-2"><button id="detail-add" class="btn btn-success btn-lg" ${p.stock?'':'disabled'}><i class="bi bi-cart-plus"></i> Adicionar ao carrinho</button><button id="detail-buy" class="btn btn-outline-dark btn-lg" ${p.stock?'':'disabled'}>Comprar agora</button></div>
   <div class="mt-4 detail-benefits"><p><i class="bi bi-truck"></i> Cadastre seu endereço para entrega</p><p><i class="bi bi-shield-check"></i> Checkout acadêmico demonstrativo — sem cobrança real</p></div></div></div>`;
  function quantity(){const q=Number(document.getElementById('detail-qty').value);if(!Number.isInteger(q)||q<1||q>Math.min(p.stock,99)){OS.notify('Informe uma quantidade disponível.',true);return null;}return q;}
  document.getElementById('detail-add').addEventListener('click',()=>{const q=quantity();if(q)OS.add(id,q);});
  document.getElementById('detail-buy').addEventListener('click',async()=>{const q=quantity();if(!q)return;
   if(!OS.me){location.href='login.html?next='+encodeURIComponent('produto.html?id='+id);return;}
   try{await OS.send('/cart','POST',{product_id:id,quantity:q});location.href='checkout.html';}catch(e){OS.notify(e.message,true);}
  });
 }catch(e){mount.innerHTML='<p class="text-danger">'+OS.esc(e.message)+'</p>';}
})();
