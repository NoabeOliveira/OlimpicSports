'use strict';
(async()=>{
 await OS.ready();if(!OS.requireLogin())return;
 const mount=document.getElementById('cart-content');
 async function render(){try{
  const {items,subtotal_cents}=await OS.api('/cart');if(!items.length){mount.innerHTML='<div class="empty-state"><i class="bi bi-bag-x"></i><h3>Seu carrinho está vazio</h3><p>Escolha produtos para começar.</p><a href="produtos.html" class="btn btn-success">Explorar produtos</a></div>';await OS.refreshCartCount();return;}
  mount.innerHTML=`<div class="row g-4"><div class="col-lg-8"><div class="cart-items">${items.map(p=>`<div class="cart-line"><a href="produto.html?id=${p.product_id}"><img src="${OS.esc(p.image)}" alt="${OS.esc(p.name)}"></a><div class="cart-line-body"><h5><a href="produto.html?id=${p.product_id}">${OS.esc(p.name)}</a></h5><p>${OS.money(p.price_cents)} cada</p>${p.stock<p.quantity?'<small class="text-danger">Estoque alterado — ajuste a quantidade</small>':''}<div class="d-flex align-items-center gap-2"><label class="small">Qtd. <input type="number" class="form-control form-control-sm cart-qty" data-id="${p.product_id}" min="1" max="${Math.min(99,p.stock)}" value="${p.quantity}" style="width:85px"></label><button class="btn btn-sm btn-outline-danger cart-delete" data-id="${p.product_id}">Remover</button></div></div><strong>${OS.money(p.price_cents*p.quantity)}</strong></div>`).join('')}</div></div><div class="col-lg-4"><div class="summary-card"><h4>Resumo do carrinho</h4><div class="d-flex justify-content-between py-3"><span>Subtotal</span><strong>${OS.money(subtotal_cents)}</strong></div><p class="small text-muted">Frete e pagamentos reais não estão integrados nesta versão acadêmica.</p><a class="btn btn-success w-100 btn-lg" href="checkout.html">Ir para o checkout</a><a class="btn btn-outline-dark w-100 mt-2" href="produtos.html">Continuar comprando</a></div></div></div>`;
  mount.querySelectorAll('.cart-qty').forEach(x=>x.addEventListener('change',async()=>{try{await OS.send('/cart/'+x.dataset.id,'PUT',{quantity:Number(x.value)});await render();}catch(e){OS.notify(e.message,true);await render();}}));
  mount.querySelectorAll('.cart-delete').forEach(x=>x.addEventListener('click',async()=>{try{await OS.send('/cart/'+x.dataset.id,'DELETE');await render();}catch(e){OS.notify(e.message,true);}}));
  await OS.refreshCartCount();
 }catch(e){mount.textContent=e.message;}}
 await render();
})();
