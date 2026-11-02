/* Ficha v8 — "boil" de desenho à mão: troca a semente do ruído das
   pinceladas ~3x por segundo, só com a aba aberta e sem reduzir movimento. */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var a=document.querySelector('#hx-rough feTurbulence'),b=document.querySelector('#hx-rough-fino feTurbulence'),tab=document.getElementById('tab-ficha');
  if(!a||!b||!tab) return;
  var s=[7,12,19],i=0;
  setInterval(function(){
    if(document.hidden||!tab.classList.contains('active')) return;
    i=(i+1)%s.length;a.setAttribute('seed',s[i]);b.setAttribute('seed',s[(i+2)%s.length]);
  },800);
})();
/* Ficha v9 — Pontos Vitais: sobe para o topo, ganha −5/+5, arrastar a barra
   para definir o valor e reações visuais. Usa fxSetVital/_fxAdj da ficha. */
(function(){
  var v=document.getElementById('fx-sec-vitais'),h=document.getElementById('fx-top');
  if(!v||!h) return;
  h.insertAdjacentElement('afterend',v);               /* topo da ficha */
  var mk=function(k,d){var b=document.createElement('button');b.type='button';b.className='sadj v9-q';
    b.setAttribute('data-fx-adj',k);b.setAttribute('data-d',d);
    b.setAttribute('aria-label',(d>0?'Aumentar ':'Diminuir ')+k+' em '+Math.abs(d));b.textContent=(d>0?'+':'−')+Math.abs(d);return b;};
  ['pv','esf'].forEach(function(k){
    var box=v.querySelector('.vital-box[data-k="'+k+'"]');if(!box) return;
    var ctrl=box.querySelector('.stat-ctrl'),tr=box.querySelector('.vital-bar-track'),num=document.getElementById('s-'+k),mx=document.getElementById('s-'+k+'max');
    ctrl.insertBefore(mk(k,-5),ctrl.firstChild);ctrl.appendChild(mk(k,5));
    /* arrastar a barra: prévia ao vivo, grava uma vez ao soltar (um passo no desfazer) */
    var val=null,max=function(){var c=fxChar();return c?(c[k+'Max']||0):0;};
    var calc=function(e){var r=tr.getBoundingClientRect(),p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
      val=Math.round(p*max());tr.dataset.prev=val;tr.style.setProperty('--px',(p*100)+'%');
      var f=tr.querySelector('.vital-bar-fill');if(f)f.style.width=(max()?val/max()*100:0)+'%';};
    tr.addEventListener('pointerdown',function(e){if(e.button>0)return;tr.setPointerCapture(e.pointerId);tr.classList.add('drag');calc(e);});
    tr.addEventListener('pointermove',function(e){if(tr.classList.contains('drag'))calc(e);});
    var fim=function(){if(!tr.classList.contains('drag'))return;tr.classList.remove('drag');delete tr.dataset.prev;
      if(val!==null&&!fxSetVital(k,val,{flutuar:true})&&typeof _updateVitalBars==='function')_updateVitalBars();val=null;};
    tr.addEventListener('pointerup',fim);tr.addEventListener('pointercancel',fim);
    /* reações ao mudar o número */
    var last=null,t;
    var ler=function(){var n=parseInt(num.textContent,10)||0,m=parseInt(mx.textContent,10)||0;
      box.style.setProperty('--tick',(m?Math.min(100,5/m*100):10)+'%');
      box.dataset.low=(m&&n>0&&n/m<=.25)?'1':'0';box.dataset.zero=(n<=0&&m>0)?'1':'0';
      if(last!==null&&n!==last){box.classList.remove('hit','heal');void box.offsetWidth;box.classList.add(n<last?'hit':'heal');clearTimeout(t);t=setTimeout(function(){box.classList.remove('hit','heal');},650);}
      last=n;};
    var mo=new MutationObserver(ler);[num,mx].forEach(function(e){if(e)mo.observe(e,{childList:true,characterData:true,subtree:true});});ler();
  });
})();
