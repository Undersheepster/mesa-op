/* Abas v22 — "boil" da pincelada nas abas que não são a Ficha (a Ficha tem o seu). */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var a=document.querySelector('#hx-rough feTurbulence'),b=document.querySelector('#hx-rough-fino feTurbulence'),f=document.getElementById('tab-ficha');
  if(!a||!b) return;
  var s=[7,12,19],i=0;
  setInterval(function(){
    if(document.hidden||(f&&f.classList.contains('active'))||!document.querySelector('.aba-hx.active')) return;
    i=(i+1)%s.length;a.setAttribute('seed',s[i]);b.setAttribute('seed',s[(i+2)%s.length]);
  },800);
})();

/* v25: atraso em cascata (--hx-d) na ordem do documento, como a Ficha escalona suas peças */
var HX_SEL='.panel-title,.mx-panel-hd,.panel,.mx-panel,.mx-card,.list-item,.mx-row,.mx-trow,.mx-npc,.mx-dl-i,.btn-add,.mx-btn,.cr-order-btn,.fit-chip,.cr-chip,.mx-chip,.mx-tab,.mx-seg,.field,.form-field,.die-btn,.badge,.cr-badge,.mx-badge,.mx-tag,.mx-pill,.rit-card:nth-child(-n+10),.px-head,.px-web,.px-node,.px-idle,.mo-card-hd>span:first-child,.tf-carta-hd,.tf-rit-hd,.tn-trilha-hd,.tn-pod-hd,.tn-det-hd,.cr-det-head,.mx-card-hd,.mx-npcv-hd,.mx-atk-hd,.inv-head,.cs-title,.px-card,.px-m-toolbar,.px-matrix-wrap,.px-m-legend,.px-agent,.px-rel';
function hxCascata(tab){
  var n=0,vh=innerHeight*1.2;
  tab.querySelectorAll(HX_SEL).forEach(function(el){
    var r=el.getBoundingClientRect();
    if(!r.height){el.style.setProperty('--hx-d','0.06s');return;}   /* oculto agora (display:none): entra quando for exibido e NÃO atrasa quem está visível */
    if(r.top>vh){el.style.removeProperty('--hx-d');return;}         /* fora da tela: sem atraso */
    el.style.setProperty('--hx-d',Math.min(n*0.045,0.8).toFixed(3)+'s');n++;
  });
}

/* v30 — o que é renderizado DEPOIS que a aba abre (setTimeout 80ms, rede, display:none→visível) também entra animado.
   Antes só era carimbado o que já existia no instante da abertura; o resto (Psiquê inteira, Poderes, Transcendência…) aparecia seco.
   Este observador é criado ANTES do de abertura: na própria abertura ele não age (a aba ainda não tem .hx-in) e o hxCascata cuida de tudo. */
var HX_LATE=2600;   /* ms após abrir a aba em que o que for inserido ainda entra animado */
(function(){
  var app=document.getElementById('screen-app')||document.body,user=-1e9;
  /* re-render causado pelo próprio usuário (busca, filtro, clique) NÃO reanima, como já era o combinado */
  ['input','click','keydown','change'].forEach(function(ev){
    document.addEventListener(ev,function(e){var t=e.target;if(t&&t.closest&&t.closest('.aba-hx.active'))user=performance.now();},true);
  });
  new MutationObserver(function(ms){
    var tab=app.querySelector('.aba-hx.active.hx-in');if(!tab) return;
    var now=performance.now(),age=now-(tab._hxT0||0);
    if(age>HX_LATE||now-user<700) return;
    var nodes=[];
    ms.forEach(function(m){m.addedNodes.forEach(function(nd){if(nd.nodeType===1&&tab.contains(nd))nodes.push(nd);});});
    if(!nodes.length) return;
    var n=0,vh=innerHeight*1.2,comp=Math.min(age/1000,0.12),hit=false;
    function stamp(el){
      var r=el.getBoundingClientRect();
      if(r.height&&r.top>vh) return;
      /* re-render logo após abrir (80 ms): compensa um pouco o atraso pra não recomeçar do zero */
      var d=r.height?Math.min(n*0.04,0.5)-comp:0.06;if(r.height)n++;
      el.style.setProperty('--hx-d',d.toFixed(3)+'s');hit=true;
    }
    /* fallback: peça solta (aviso vazio, dica…) que não casa com HX_SEL e chega depois do container já ter parado de animar */
    var soft=0,BLOCO=/^(DIV|P|SECTION|ARTICLE|UL|OL|FORM|TABLE|HEADER|FOOTER|ASIDE|H[1-6]|FIGURE|DETAILS|BUTTON|LABEL|SELECT|INPUT|TEXTAREA)$/;
    function solta(el){
      if(soft>=40||!BLOCO.test(el.tagName)) return;
      var r=el.getBoundingClientRect();if(!r.height||r.top>vh) return;
      for(var p=el.parentElement;p&&p!==tab;p=p.parentElement){
        if(p.getAnimations&&p.getAnimations().some(function(a){return /^hx-(in|pop|wipe|stamp)/.test(a.animationName||'');})) return;   /* o ancestral ainda está entrando: leva junto */
      }
      soft++;el.setAttribute('data-hx-late','');
      el.style.setProperty('--hx-d',(Math.min(n*0.04,0.5)-comp).toFixed(3)+'s');n++;hit=true;
    }
    nodes.forEach(function(nd){
      var casa=nd.matches&&nd.matches(HX_SEL),dentro=nd.querySelectorAll?nd.querySelectorAll(HX_SEL):[];
      if(casa) stamp(nd);
      dentro.forEach(stamp);
      if(!casa&&!dentro.length) solta(nd);
    });
    /* mantém .hx-in até a animação dos recém-chegados terminar (senão remover a classe corta a animação no meio) */
    if(hit){clearTimeout(tab._hx);tab._hx=setTimeout(function(){tab.classList.remove('hx-in');},1300);}
  }).observe(app,{childList:true,subtree:true});
})();

/* entrada: marca a aba com .hx-in ao ABRIR (não ao re-renderizar listas) */
(function(){
  var t;
  new MutationObserver(function(ms){ms.forEach(function(m){
    var e=m.target;if(!e.classList||!e.classList.contains('aba-hx'))return;
    var antes=(m.oldValue||'').split(' ').indexOf('active')>-1,agora=e.classList.contains('active');
    if(agora&&!antes){e.classList.remove('hx-in');e._hxT0=performance.now();hxCascata(e);void e.offsetWidth;e.classList.add('hx-in');clearTimeout(e._hx);e._hx=setTimeout(function(){e.classList.remove('hx-in');},1600);}
    if(!agora&&e.classList.contains('hx-in'))e.classList.remove('hx-in');
  });}).observe(document.getElementById('screen-app')||document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true,subtree:true});
})();

/* v29 — TÍTULOS aparecem sempre (pincelada), não só os que já existiam ao abrir a aba */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var SEL='.panel-title,.mx-panel-hd,.mo-card-hd>span:first-child,.tf-carta-hd,.tf-rit-hd,.tn-trilha-hd,.tn-pod-hd,.tn-det-hd,.cr-det-head,.mx-card-hd,.mx-npcv-hd,.mx-atk-hd,.inv-head,.cs-title,.px-head h2';
  var last={};
  function pop(el,cls){
    var k=cls+'|'+(el.textContent||'').trim().slice(0,40),now=Date.now();
    if(last[k]&&now-last[k]<1200) return;           /* re-render em rajada (busca/filtro) não pisca */
    last[k]=now;
    rean(el,cls);
  }
  /* reinicia a animação e agenda a limpeza; o temporizador anterior é cancelado (troca rápida de aba não corta a animação nova) */
  function rean(el,cls){
    clearTimeout(el['_t'+cls]);
    el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
    el['_t'+cls]=setTimeout(function(){el.classList.remove(cls);},1100);
  }
  function scan(n){
    if(n.nodeType!==1) return;
    if(n.matches&&n.matches(SEL)) pop(n,'hx-t');
    if(n.querySelectorAll) n.querySelectorAll(SEL).forEach(function(e){pop(e,'hx-t');});
  }
  function iniciar(){
    var app=document.getElementById('screen-app');if(!app||!window.MutationObserver) return;
    /* títulos inseridos depois (listas, sub-abas, painéis renderizados por JS) */
    new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(scan);});})
      .observe(app,{childList:true,subtree:true});
    /* título grande da página: reanima a cada troca de aba */
    var head=document.getElementById('hx-pagehead');
    if(head) new MutationObserver(function(){
      var h=document.getElementById('hx-pagehead-title'),p=document.getElementById('hx-pagehead-desc');
      if(h) rean(h,'hx-t');
      if(p) rean(p,'hx-t2');
    }).observe(head,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar); else iniciar();
})();
