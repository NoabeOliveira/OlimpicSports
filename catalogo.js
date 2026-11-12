'use strict';
(async()=>{
 const grid=document.getElementById('catalog-grid'),search=document.getElementById('catalog-search'),cat=document.getElementById('catalog-category'),count=document.getElementById('catalog-count');
 const args=new URLSearchParams(location.search);if(args.get('categoria'))cat.value=args.get('categoria');if(args.get('q'))search.value=args.get('q');
 try{const {products}=await OS.api('/products');const categories=[...new Set(products.map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));cat.innerHTML='<option value="">Todas as categorias</option>'+categories.map(c=>`<option value="${OS.esc(c)}">${OS.esc(c)}</option>`).join('');if(args.get('categoria'))cat.value=args.get('categoria');}catch{}
 if(args.get('ofertas')==='1'||location.pathname.endsWith('/ofertas.html')){document.getElementById('catalog-heading').textContent='Ofertas Esportivas';document.getElementById('catalog-subtitle').textContent='Produtos selecionados pelo administrador com destaque de oferta.';}
 async function render(){grid.innerHTML='<p class="text-muted">Carregando produtos...</p>';
  const query=new URLSearchParams();if(search.value.trim())query.set('q',search.value.trim());if(cat.value)query.set('category',cat.value);if(args.get('ofertas')==='1'||location.pathname.endsWith('/ofertas.html'))query.set('offers','1');
  try{const {products}=await OS.api('/products?'+query);count.textContent=products.length+' produto(s) encontrado(s)';grid.innerHTML=products.map(OS.productCard).join('')||'<div class="col-12 text-center py-5">Não encontramos produtos com esses filtros.</div>';}
  catch(e){grid.innerHTML='<p>'+OS.esc(e.message)+'</p>';}
 }
 let t;search.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(render,200);});cat.addEventListener('change',render);OS.bindCards(grid);await render();
})();
