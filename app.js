'use strict';
(async()=>{
 const grid=document.getElementById('home-products');if(!grid)return;
 try {const {products}=await OS.api('/products');grid.innerHTML=products.filter(p=>p.featured).slice(0,6).map(OS.productCard).join('')||'<p>Nenhum produto em destaque.</p>';OS.bindCards(grid);}
 catch(e){grid.textContent=e.message;}
})();
