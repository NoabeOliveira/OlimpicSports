'use strict';
(async()=>{
 await OS.ready();if(!OS.requireLogin())return;
 if(OS.me.role!=='admin'){location.href='index.html';return;}
 const paneNames=['visao','produtos','pedidos','estoque','financeiro','usuarios'];
 document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.addEventListener('click',()=>openTab(btn.dataset.adminTab)));
 function openTab(name){paneNames.forEach(n=>{document.getElementById('admin-'+n).hidden=n!==name;const b=document.querySelector(`[data-admin-tab="${n}"]`);b.classList.toggle('active',n===name);});history.replaceState(null,'','#'+name);}
 openTab(paneNames.includes(location.hash.slice(1))?location.hash.slice(1):'visao');
 const alert=msg=>OS.notify(msg,true);
 const form=document.getElementById('admin-product-form');
 let products=[];
 async function loadProducts(){try{products=(await OS.api('/admin/products')).products;document.getElementById('admin-products-table').innerHTML=products.map(p=>`<tr><td><img class="admin-thumb" src="${OS.esc(p.image)}" alt=""></td><td>${OS.esc(p.name)}<br><small class="text-muted">${OS.esc(p.category)} ${!p.active?' • Inativo':''}</small></td><td>${OS.money(p.price_cents)}</td><td>${p.stock}</td><td><button class="btn btn-sm btn-outline-dark product-edit" data-id="${p.id}">Editar</button> <button class="btn btn-sm btn-outline-danger product-remove" data-id="${p.id}" ${p.active?'':'disabled'}>Desativar</button></td></tr>`).join('')||'<tr><td colspan="5">Nenhum produto.</td></tr>';
  const active=products.filter(p=>p.active);document.getElementById('metric-products').textContent=active.length;document.getElementById('metric-stock').textContent=active.reduce((s,p)=>s+p.stock,0);
  const table=document.getElementById('admin-products-table');table.querySelectorAll('.product-edit').forEach(b=>b.onclick=()=>{const p=products.find(x=>x.id==b.dataset.id);if(!p)return;
   form.elements.product_id.value=p.id;['name','description','category','image','stock'].forEach(k=>form.elements[k].value=p[k]);form.elements.price.value=(p.price_cents/100).toFixed(2);form.elements.featured.checked=!!p.featured;form.elements.offer.checked=!!p.offer;
   document.getElementById('product-form-title').textContent='Editar produto #'+p.id;form.scrollIntoView({behavior:'smooth',block:'start'});
  });
  table.querySelectorAll('.product-remove').forEach(b=>b.onclick=async()=>{if(!confirm('Desativar produto? Ele deixará de ser exibido, mas pedidos antigos serão preservados.'))return;
   try{await OS.send('/admin/products/'+b.dataset.id,'DELETE');OS.notify('Produto desativado.');await loadProducts();}catch(e){alert(e.message);}});
 }catch(e){alert(e.message);}}
 document.getElementById('product-reset').onclick=()=>{form.reset();form.elements.product_id.value='';document.getElementById('product-form-title').textContent='Adicionar produto';};
 form.addEventListener('submit',async e=>{e.preventDefault();const file=form.elements.upload.files[0];const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{let image=form.elements.image.value.trim();if(file){if(file.size>2.5*1024*1024)throw new Error('Imagem muito grande (máximo 2,5 MB).');
    const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(new Error('Falha ao ler imagem.'));r.readAsDataURL(file);});
    const r=await OS.send('/admin/uploads','POST',{mime:file.type,data:base64});image=r.image;
   }
   const data={name:form.elements.name.value,description:form.elements.description.value,category:form.elements.category.value,price_cents:Math.round(Number(form.elements.price.value)*100),stock:Number(form.elements.stock.value),image,featured:form.elements.featured.checked,offer:form.elements.offer.checked};
   const id=form.elements.product_id.value;await OS.send('/admin/products'+(id?'/'+id:''),id?'PUT':'POST',data);
   OS.notify(id?'Produto atualizado.':'Produto adicionado.');form.reset();form.elements.product_id.value='';document.getElementById('product-form-title').textContent='Adicionar produto';await Promise.all([loadProducts(),loadStock()]);
  }catch(ex){alert(ex.message);}finally{btn.disabled=false;}
 });
 async function loadOrders(){try{const {orders}=await OS.api('/admin/orders');document.getElementById('metric-orders').textContent=orders.length;
  const el=document.getElementById('admin-orders-table');el.innerHTML=orders.map(o=>`<tr><td>#${o.id}<br><small>${OS.esc(o.created_at)}</small></td><td>${OS.esc(o.customer)}<br><small>${OS.esc(o.email)}</small></td><td>${o.items.map(x=>`${OS.esc(x.product_name)} ×${x.quantity}`).join('<br>')}</td><td>${OS.money(o.total_cents)}</td><td><select class="form-select form-select-sm order-status" data-id="${o.id}" ${o.status==='cancelado'?'disabled':''}>${['simulado','em_preparacao','enviado','entregue','cancelado'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}</select><small class="text-muted">Sem pagamento real</small></td></tr>`).join('')||'<tr><td colspan="5">Nenhum pedido.</td></tr>';
  el.querySelectorAll('select.order-status').forEach(x=>x.onchange=async()=>{try{await OS.send('/admin/orders/'+x.dataset.id+'/status','PUT',{status:x.value});OS.notify('Status atualizado.');await Promise.all([loadOrders(),loadProducts(),loadStock(),loadFinance()]);}catch(e){alert(e.message);await loadOrders();}});
 }catch(e){alert(e.message);}}
 async function loadStock(){try{const {movements}=await OS.api('/admin/stock');document.getElementById('admin-stock-table').innerHTML=movements.map(m=>`<tr><td>${OS.esc(m.created_at)}</td><td>${OS.esc(m.product)}</td><td class="${m.delta<0?'text-danger':'text-success'} fw-bold">${m.delta>0?'+':''}${m.delta}</td><td>${OS.esc(m.reason)}</td></tr>`).join('')||'<tr><td colspan="4">Nenhuma movimentação.</td></tr>';}
  catch(e){alert(e.message);}}
 async function loadFinance(){try{const {entries,totals}=await OS.api('/admin/finance');document.getElementById('metric-simulated').textContent=OS.money(totals.simulated_sales_cents);
  document.getElementById('fin-simulated').textContent=OS.money(totals.simulated_sales_cents);document.getElementById('fin-income').textContent=OS.money(totals.income_cents);document.getElementById('fin-expense').textContent=OS.money(totals.expense_cents);document.getElementById('fin-balance').textContent=OS.money(totals.balance_cents);
  const el=document.getElementById('admin-finance-table');el.innerHTML=entries.map(f=>`<tr><td>${OS.esc(f.created_at)}</td><td>${f.type==='receita'?'Receita':'Despesa'}</td><td>${OS.esc(f.category)}</td><td>${OS.esc(f.note)}</td><td>${OS.money(f.amount_cents)}</td><td><button class="btn btn-sm btn-outline-danger fin-delete" data-id="${f.id}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="6">Nenhum lançamento manual.</td></tr>';
  el.querySelectorAll('.fin-delete').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este lançamento financeiro?'))return;try{await OS.send('/admin/finance/'+b.dataset.id,'DELETE');await loadFinance();OS.notify('Lançamento excluído.');}catch(e){alert(e.message);}});
 }catch(e){alert(e.message);}}
 document.getElementById('admin-finance-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.target;try{await OS.send('/admin/finance','POST',{type:f.elements.type.value,category:f.elements.category.value,note:f.elements.note.value,amount_cents:Math.round(Number(f.elements.amount.value)*100)});f.reset();OS.notify('Lançamento registrado.');await loadFinance();}catch(ex){alert(ex.message);}});
 async function loadUsers(){try{const {users}=await OS.api('/admin/users');document.getElementById('metric-users').textContent=users.length;document.getElementById('admin-users-table').innerHTML=users.map(u=>`<tr><td>${u.id}</td><td>${OS.esc(u.name)}</td><td>${OS.esc(u.email)}</td><td>${u.role==='admin'?'Administrador':'Cliente'}</td><td>${OS.esc(u.created_at)}</td></tr>`).join('');}catch(e){alert(e.message);}}
 await Promise.all([loadProducts(),loadOrders(),loadStock(),loadFinance(),loadUsers()]);
})();
