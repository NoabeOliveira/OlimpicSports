'use strict';
(async()=>{
 const form=document.querySelector('#auth-form');if(!form)return;
 await OS.ready();const signup=location.pathname.endsWith('cadastro.html'),next=OS.safeNext(new URLSearchParams(location.search).get('next'));
 if(OS.me){location.href=OS.me.role==='admin'?'admin.html':next;return;}
 form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button[type=submit]');submit.disabled=true;
 const data={email:form.elements.email.value,password:form.elements.password.value};if(signup){data.name=form.elements.fullname.value;if(data.password!==form.elements.confirm.value){OS.notify('As senhas não coincidem.',true);submit.disabled=false;return;}}
 try{const r=await OS.send(signup?'/auth/register':'/auth/login','POST',data);location.href=r.user.role==='admin'?'admin.html':next;}
 catch(e){OS.notify(e.message,true);submit.disabled=false;}
 });
})();
