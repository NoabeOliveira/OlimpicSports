'use strict';
(async()=>{
 await OS.ready();if(!OS.requireLogin())return;
 const summary=document.getElementById('checkout-summary'),select=document.getElementById('checkout-address'),form=document.getElementById('checkout-form'),install=document.getElementById('checkout-installments'),pay=document.getElementById('checkout-payment');
 try{
  const {items,subtotal_cents}=await OS.api('/cart');if(!items.length){summary.innerHTML='<p>Carrinho vazio. <a href="produtos.html">Ver produtos</a></p>';form.hidden=true;return;}
  summary.innerHTML=items.map(p=>`<div class="d-flex justify-content-between gap-3 py-2 border-bottom"><span>${OS.esc(p.name)} × ${p.quantity}</span><strong>${OS.money(p.price_cents*p.quantity)}</strong></div>`).join('')+`<div class="d-flex justify-content-between pt-3"><strong>Total</strong><strong class="detail-price">${OS.money(subtotal_cents)}</strong></div>`;
  const {addresses}=await OS.api('/addresses');if(!addresses.length){select.innerHTML='<option value="">Cadastre seu endereço na área Minha Conta</option>';form.querySelector('button[type=submit]').disabled=true;document.getElementById('address-warning').innerHTML='<a href="conta.html#enderecos" class="btn btn-outline-dark">Cadastrar endereço</a>';}
  else select.innerHTML='<option value="">Selecione o endereço</option>'+addresses.map(a=>`<option value="${a.id}" ${a.is_default?'selected':''}>${OS.esc(a.label)}: ${OS.esc(a.street)}, ${OS.esc(a.number)} — ${OS.esc(a.city)}/${OS.esc(a.state)}</option>`).join('');
 }catch(e){summary.textContent=e.message;form.hidden=true;return;}
 pay.addEventListener('change',()=>{install.parentElement.hidden=pay.value!=='cartao';install.required=pay.value==='cartao';if(pay.value!=='cartao')install.value='1';});
 form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('button[type=submit]');btn.disabled=true;
  try{const {order}=await OS.send('/orders','POST',{address_id:Number(select.value),payment_method:pay.value,installments:pay.value==='cartao'?Number(install.value):1});
   form.hidden=true;summary.innerHTML=`<div class="success-order"><i class="bi bi-check-circle-fill"></i><h3>Pedido demonstrativo #${order.id} criado!</h3><p>Total: ${OS.money(order.total_cents)}</p><p><strong>Não houve cobrança real.</strong> Você pode acompanhar o pedido na sua conta.</p><a class="btn btn-success" href="conta.html#pedidos">Meus pedidos</a></div>`;OS.refreshCartCount();
  }catch(ex){OS.notify(ex.message,true);btn.disabled=false;}
 });
})();
