'use strict';
(async()=>{
 await OS.ready();if(!OS.requireLogin())return;
 document.getElementById('welcome-name').textContent=OS.me.name;
 const form=document.getElementById('profile-form');form.elements.name.value=OS.me.name;form.elements.email.value=OS.me.email;
 form.addEventListener('submit',async e=>{e.preventDefault();try{await OS.send('/me','PUT',{name:form.elements.name.value});OS.notify('Dados atualizados.');document.getElementById('welcome-name').textContent=form.elements.name.value;}catch(ex){OS.notify(ex.message,true);}});
 document.getElementById('password-form').addEventListener('submit',async e=>{e.preventDefault();try{await OS.send('/me/password','PUT',{old_password:e.target.elements.old_password.value,new_password:e.target.elements.new_password.value});OS.notify('Senha alterada. Entre novamente na sua conta.');setTimeout(()=>location.href='login.html',1300);}catch(ex){OS.notify(ex.message,true);}});
 document.getElementById('logout-btn').addEventListener('click',async()=>{await OS.send('/auth/logout','POST');location.href='index.html';});
 if(OS.me.role==='admin')document.getElementById('admin-shortcut').hidden=false;
 const addrForm=document.getElementById('address-form');
 const fields=['label','receiver','zip','street','number','complement','neighborhood','city','state'];
 const clear=()=>{addrForm.reset();addrForm.elements.address_id.value='';addrForm.elements.is_default.checked=false;document.getElementById('address-submit').textContent='Salvar endereço';};
 document.getElementById('address-cancel').addEventListener('click',clear);
 let addressCache=[];
 async function loadAddresses(){try{const {addresses}=await OS.api('/addresses');addressCache=addresses;const holder=document.getElementById('addresses-list');
  holder.innerHTML=addresses.length?addresses.map(a=>`<article class="address-card"><div><h5>${OS.esc(a.label)} ${a.is_default?'<span class="badge text-bg-success">Principal</span>':''}</h5><p>${OS.esc(a.receiver)}<br>${OS.esc(a.street)}, ${OS.esc(a.number)} ${OS.esc(a.complement)}<br>${OS.esc(a.neighborhood)} — ${OS.esc(a.city)}/${OS.esc(a.state)}<br>CEP ${OS.esc(a.zip)}</p></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-dark address-edit" data-id="${a.id}">Editar</button><button class="btn btn-sm btn-outline-danger address-delete" data-id="${a.id}">Excluir</button></div></article>`).join(''):'<p class="text-muted">Você ainda não cadastrou endereços.</p>';
  holder.querySelectorAll('.address-edit').forEach(b=>b.onclick=()=>{const a=addressCache.find(x=>x.id==b.dataset.id);if(!a)return;addrForm.elements.address_id.value=a.id;fields.forEach(f=>addrForm.elements[f].value=a[f]);addrForm.elements.is_default.checked=!!a.is_default;document.getElementById('address-submit').textContent='Atualizar endereço';addrForm.scrollIntoView({behavior:'smooth',block:'center'});});
  holder.querySelectorAll('.address-delete').forEach(b=>b.onclick=async()=>{if(!confirm('Deseja excluir este endereço?'))return;try{await OS.send('/addresses/'+b.dataset.id,'DELETE');OS.notify('Endereço excluído.');await loadAddresses();}catch(e){OS.notify(e.message,true);}});
 }catch(e){OS.notify(e.message,true);}}
 addrForm.addEventListener('submit',async e=>{e.preventDefault();const b=Object.fromEntries(fields.map(f=>[f,addrForm.elements[f].value]));b.is_default=addrForm.elements.is_default.checked;
  try{await OS.send('/addresses'+(addrForm.elements.address_id.value?'/'+addrForm.elements.address_id.value:''),addrForm.elements.address_id.value?'PUT':'POST',b);OS.notify('Endereço salvo.');clear();await loadAddresses();}catch(ex){OS.notify(ex.message,true);}
 });
 async function loadOrders(){try{const {orders}=await OS.api('/orders');const el=document.getElementById('order-history');el.innerHTML=orders.length?orders.map(o=>`<article class="address-card d-block"><div class="d-flex justify-content-between flex-wrap gap-2"><h5>Pedido #${o.id}</h5><span class="badge text-bg-secondary">${OS.esc(o.status.replaceAll('_',' '))}</span></div><p class="small text-muted mb-2">${OS.esc(o.created_at)} • ${OS.esc(o.payment_method.toUpperCase())} • ${OS.esc(o.payment_status.replaceAll('_',' '))}</p><p>${o.items.map(i=>`${OS.esc(i.product_name)} × ${i.quantity}`).join(' • ')}</p><strong>${OS.money(o.total_cents)}</strong></article>`).join(''):'<p>Você ainda não possui pedidos. <a href="produtos.html">Comece a comprar.</a></p>';}
  catch(e){OS.notify(e.message,true);}}
 await Promise.all([loadAddresses(),loadOrders()]);
})();
