/* Defesa & Proteção — enriquece o bloco sem mexer na lógica da ficha:
   lê #s-protecao-rd ("RD 3 · físico") para montar o carimbo de RD e
   transforma #f-resist em chips coloridos por elemento. */
(function(){
  var ELEM=[['balíst','bal'],['balist','bal'],['físic','fis'],['fisic','fis'],['corte','fis'],['perfur','fis'],['impact','fis'],['energ','ene'],['fogo','ene'],['eletr','ene'],['morte','mor'],['sangue','san'],['conhec','con'],['medo','med'],['paranormal','par']];
  function el(t){t=(t||'').toLowerCase();for(var i=0;i<ELEM.length;i++)if(t.indexOf(ELEM[i][0])>-1)return ELEM[i][1];return 'x';}
  function stamp(){
    var sub=document.getElementById('s-protecao-rd'),box=sub&&sub.parentNode;if(!box)return;
    var m=/RD\s*(\d+)\s*·?\s*(.*)/i.exec(sub.textContent||'');
    var st=box.querySelector('.def-rd');
    if(!st){st=document.createElement('div');st.className='def-rd';box.appendChild(st);}
    if(m){st.innerHTML='<small>RD</small><b>'+m[1]+'</b>';st.setAttribute('data-el',el(m[2]));st.hidden=false;box.setAttribute('data-armada','1');}
    else{st.hidden=true;box.setAttribute('data-armada',/sem RD/i.test(sub.textContent)?'1':'0');}
  }
  function chips(){
    var inp=document.getElementById('f-resist');if(!inp)return;
    var wrap=document.getElementById('def-chips');
    if(!wrap){wrap=document.createElement('div');wrap.id='def-chips';wrap.className='def-chips';inp.parentNode.appendChild(wrap);}
    var parts=(inp.value||'').split(/[,;\n]+/).map(function(x){return x.trim();}).filter(Boolean);
    wrap.innerHTML='';
    parts.forEach(function(p){var c=document.createElement('span');c.className='def-chip';c.setAttribute('data-el',el(p));c.textContent=p;wrap.appendChild(c);});
    wrap.hidden=!parts.length;
  }
  function init(){
    var sub=document.getElementById('s-protecao-rd'),inp=document.getElementById('f-resist');
    if(!sub||!inp)return;
    if(window.MutationObserver)new MutationObserver(stamp).observe(sub,{childList:true,characterData:true,subtree:true});
    inp.addEventListener('input',chips);
    /* o valor é preenchido por script ao carregar o personagem */
    var last=null;setInterval(function(){if(inp.value!==last){last=inp.value;chips();}},600);
    stamp();chips();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
