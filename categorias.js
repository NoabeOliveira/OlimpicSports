'use strict';
(async()=>{
 const el=document.getElementById('categories-grid');
 try{const {products}=await OS.api('/products');const groups=new Map();
  for(const p of products){const g=groups.get(p.category)||{name:p.category,count:0,image:p.image};g.count++;groups.set(p.category,g);}
  el.innerHTML=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(g=>`<article class="col-md-6 col-lg-4"><a href="produtos.html?categoria=${encodeURIComponent(g.name)}" class="category-card"><img src="${OS.esc(g.image)}" alt="${OS.esc(g.name)}" loading="lazy"><span><strong>${OS.esc(g.name)}</strong><small>${g.count} produto(s) <i class="bi bi-arrow-right"></i></small></span></a></article>`).join('')||'<p class="text-muted">Nenhuma categoria cadastrada.</p>';
 }catch(e){el.textContent=e.message;}
})();
