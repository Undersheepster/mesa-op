/* ═════════════════════════════════════════════════════════════════════
   CURSOR-HX · animações
   O CSS não anima a propriedade `cursor`, então os desenhos (seta, mão, "I",
   proibido, redimensionar) continuam sendo os SVGs de cursor-hx.css e esta
   camada por cima cuida do movimento. Tudo em osso + tinta + sangue seco,
   bordas duras, sem brilho e sem degradê:

     · mira       — anel de osso tracejado que segue o cursor com atraso,
                    estica na direção do movimento e gira devagar
     · trava      — sobre algo clicável a mira aperta, ganha as 4 marcas e
                    gira mais rápido
     · aperto     — ao segurar o botão a mira se comprime; ao soltar volta
                    com um tranco
     · respingo   — clique solta tinta (e um carimbo de sangue que abre e some)
     · rastro     — gotas de tinta pingam atrás do cursor ao mover
     · brasa      — parado por uns segundos, a mira "respira" e sobem brasas
     · proibido   — a mira fica carmesim, para de girar e treme
     · espera     — gira rápido (cursor wait/progress)
     · entrada    — a mira "brota" ao entrar na janela e some ao sair

   Segurança: só roda com mouse/caneta (não em toque), respeita
   prefers-reduced-motion e se este arquivo falhar os cursores estáticos
   continuam funcionando. Para desligar:
     localStorage.setItem('hx-cursor-fx','off')   ou   HXCursorFx.enable(false)
   ═════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.HXCursorFx||!window.requestAnimationFrame||!document.documentElement.animate)return;

  var doc=document,root=doc.documentElement;
  var mqReduce=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
  var OSSO='#d3c6a4',TINTA='#0d0806',SECO='#7d1a14',SANGUE='#a3241a',POEIRA='#c9965a';
  var VIVO='#c8321f'; /* sangue fresco: só nas gotas, para ler em fundo escuro */
  /* cores claras/vivas + contorno de tinta no CSS: lê bem em fundo escuro e em papel */
  var GOTAS=[VIVO,OSSO,VIVO,SANGUE,OSSO,VIVO];

  var on=true;try{on=localStorage.getItem('hx-cursor-fx')!=='off'}catch(_){}
  var built=false,running=false,shown=false,down=false,idle=false,raf=0;
  var layer,ring,rotG,drops,flecks,stamps,embers;
  var tx=-200,ty=-200,x=-200,y=-200,lastDropX=0,lastDropY=0;
  var st=0,ang=0,rot=0,rotV=30,rotT=30,lastT=0,lastMove=0,nextEmber=0,lastDropT=0;
  var state='def',lastTarget=null,downX=0,downY=0,moved=false;

  var rnd=Math.random,PI2=Math.PI*2;
  function pick(a){return a[(rnd()*a.length)|0]}
  function el(tag,cls){var e=doc.createElement(tag);if(cls)e.className=cls;return e}

  /* gota/respingo: polígono torto de recorte de papel, com contorno de tinta (via CSS) */
  function blob(){
    var n=5+((rnd()*3)|0),p=[];
    for(var i=0;i<n;i++){
      var a=i/n*PI2+rnd()*.5,r=6.4+rnd()*3.2;
      p.push((Math.cos(a)*r).toFixed(1)+','+(Math.sin(a)*r).toFixed(1));
    }
    return '<svg viewBox="-10 -10 20 20"><polygon points="'+p.join(' ')+'"/></svg>';
  }
  /* anel "torto" para o carimbo: circunferência com tremida de pincel */
  function rough(r,n,j){
    var d='';
    for(var i=0;i<n;i++){
      var a=i/n*PI2,rr=r+(rnd()*2-1)*j;
      d+=(i?'L':'M')+(Math.cos(a)*rr).toFixed(1)+' '+(Math.sin(a)*rr).toFixed(1);
    }
    return d+'Z';
  }
  function makePool(n,make){
    var a=[],i=0;
    for(var k=0;k<n;k++){var e=make();e.style.opacity='0';layer.appendChild(e);a.push(e)}
    return function(){var e=a[i];i=(i+1)%a.length;if(e._a)e._a.cancel();return e};
  }

  function build(){
    built=true;
    layer=el('div');layer.id='cx-layer';layer.setAttribute('aria-hidden','true');layer.setAttribute('data-s','def');

    /* mira */
    ring=el('div','cx-ring');
    var s=el('div','cx-s');
    var ticks='';
    for(var i=0;i<4;i++){
      ticks+='<g transform="rotate('+(i*90)+')"><path class="cx-ink" d="M0 -26 L0 -20"/><path class="cx-bone" d="M0 -26 L0 -20"/></g>';
    }
    s.innerHTML='<svg class="cx-svg" viewBox="-32 -32 64 64" width="64" height="64">'+
      '<circle class="cx-sh" r="15" transform="translate(2.2 2.2)"/>'+
      '<circle class="cx-ink" r="15"/>'+
      '<g class="cx-rot"><circle class="cx-bone cx-dash" r="15"/></g>'+
      '<g class="cx-t">'+ticks+'</g></svg>';
    ring.appendChild(s);layer.appendChild(ring);
    rotG=s.querySelector('.cx-rot');

    /* pools reaproveitados (nada de criar/destruir nó a cada clique) */
    drops=makePool(28,function(){var e=el('i','cx-d');e.innerHTML=blob();return e});
    flecks=makePool(30,function(){var e=el('i','cx-d');e.innerHTML=blob();return e});
    embers=makePool(8,function(){return el('i','cx-e')});
    stamps=makePool(3,function(){
      var e=el('div','cx-st');
      e.innerHTML='<svg viewBox="-32 -32 64 64" width="64" height="64"><path class="cx-sti" d="'+rough(21,22,1.6)+'"/><path class="cx-stb" d="'+rough(21,22,1.6)+'"/></svg>';
      return e;
    });
    (doc.body||root).appendChild(layer);
  }

  /* ── efeitos ─────────────────────────────────────────────── */
  function fall(pool,x0,y0,size,color,dx,dy,dur,rotate){
    var e=pool(),h=size/2;
    e.style.width=e.style.height=size+'px';
    e.style.margin='-'+h+'px 0 0 -'+h+'px';
    e.style.color=color;
    /* a gota fica inteira por um tempo, depois escorre e some */
    e._a=e.animate([
      {transform:'translate('+x0+'px,'+y0+'px) scale(1) rotate(0deg)',opacity:.95},
      {transform:'translate('+(x0+dx*.3)+'px,'+(y0+dy*.25)+'px) scale(1) rotate('+(rotate*.3)+'deg)',opacity:.95,offset:.4},
      {transform:'translate('+(x0+dx)+'px,'+(y0+dy)+'px) scale(.2) rotate('+rotate+'deg)',opacity:0}
    ],{duration:dur,easing:'cubic-bezier(.3,.5,.5,1)',fill:'forwards'});
  }
  function drip(){
    var big=down&&moved,size=(big?6:4.4)+rnd()*(big?4:3.4);
    fall(drops,tx+(rnd()*6-3),ty+(rnd()*6-3),size,big?pick([VIVO,SECO,VIVO]):pick(GOTAS),
      rnd()*8-4,12+rnd()*18,700+rnd()*500,(rnd()*140-70)|0);
  }
  function splash(px,py,strong){
    /* carimbo */
    var c=stamps();
    c.style.margin='-32px 0 0 -32px';
    c._a=c.animate([
      {transform:'translate('+px+'px,'+py+'px) scale(.3) rotate('+((rnd()*60-30)|0)+'deg)',opacity:1},
      {transform:'translate('+px+'px,'+py+'px) scale('+(strong?1.55:1.05)+') rotate(0deg)',opacity:0}
    ],{duration:strong?460:340,easing:'cubic-bezier(.15,.8,.3,1)',fill:'forwards'});
    /* tinta voando */
    var n=strong?11:6;
    for(var i=0;i<n;i++){
      var a=rnd()*PI2,d=(strong?18:12)+rnd()*(strong?36:20),sz=2.4+rnd()*(strong?6:3.6);
      var e=flecks(),h=sz/2;
      e.style.width=e.style.height=sz+'px';
      e.style.margin='-'+h+'px 0 0 -'+h+'px';
      e.style.color=pick(GOTAS);
      var ex=px+Math.cos(a)*d,ey=py+Math.sin(a)*d;
      e._a=e.animate([
        {transform:'translate('+px+'px,'+py+'px) scale(.3)',opacity:1},
        {transform:'translate('+(px+(ex-px)*.85)+'px,'+(py+(ey-py)*.8)+'px) scale(1.1) rotate('+((rnd()*90)|0)+'deg)',opacity:1,offset:.32},
        {transform:'translate('+ex+'px,'+(ey+10+rnd()*16)+'px) scale(.35) rotate('+((rnd()*240-120)|0)+'deg)',opacity:0}
      ],{duration:420+rnd()*320,easing:'cubic-bezier(.2,.7,.4,1)',fill:'forwards'});
    }
  }
  function ember(){
    var e=embers(),sz=3.4+rnd()*2.4;
    e.style.width=e.style.height=sz+'px';
    e.style.background=rnd()<.6?POEIRA:SANGUE;
    var x0=tx+(rnd()*18-9),y0=ty+(rnd()*8-2),dx=rnd()*30-15;
    e._a=e.animate([
      {transform:'translate('+x0+'px,'+y0+'px) rotate(45deg) scale(1)',opacity:0},
      {transform:'translate('+(x0+dx*.4)+'px,'+(y0-18)+'px) rotate(90deg) scale(1)',opacity:.95,offset:.18},
      {transform:'translate('+(x0+dx)+'px,'+(y0-48-rnd()*34)+'px) rotate(200deg) scale(.2)',opacity:0}
    ],{duration:1500+rnd()*900,easing:'ease-out',fill:'forwards'});
  }

  /* ── estado (lido do `cursor` computado, então vale para qualquer
        elemento do projeto sem precisar listar seletores) ─────────── */
  function classify(t){
    var c='';
    try{c=getComputedStyle(t).cursor||''}catch(_){}
    var i=c.lastIndexOf(',');
    c=(i>-1?c.slice(i+1):c).trim().toLowerCase();
    if(c==='pointer'||c==='crosshair'||c==='help'||c==='copy'||c==='alias'||c==='cell'||c==='zoom-in'||c==='zoom-out')return'link';
    if(c==='text'||c==='vertical-text')return'text';
    if(c==='not-allowed'||c==='no-drop')return'no';
    if(c==='grab'||c==='grabbing')return'grab';
    if(c==='move'||c==='all-scroll'||/resize$/.test(c))return'size';
    if(c==='wait'||c==='progress')return'wait';
    if(c==='none')return'none';
    return'def';
  }
  var ROT={def:30,link:95,text:30,no:0,grab:60,size:0,wait:420,none:0};
  function setState(s){
    if(s===state)return;
    state=s;layer.setAttribute('data-s',s);
    rotT=ROT[s]||30;
  }
  function refresh(t){if(t&&t.nodeType===1)setState(classify(t))}

  /* ── mostrar / esconder ─────────────────────────────────── */
  function show(){
    if(shown)return;
    shown=true;x=tx;y=ty;lastDropX=tx;lastDropY=ty;
    layer.classList.add('cx-on');
  }
  function hide(){
    if(!shown)return;
    shown=false;down=false;
    layer.classList.remove('cx-on','cx-down','cx-idle');idle=false;
    stop();
  }

  /* ── laço de animação (só posição/estica/gira; o resto é WAAPI/CSS) ─ */
  function frame(t){
    raf=requestAnimationFrame(frame);
    var dt=Math.min(64,t-lastT||16);lastT=t;
    if(!shown)return;
    var k=1-Math.pow(1-.27,dt/16.67);
    var ox=x,oy=y;
    x+=(tx-x)*k;y+=(ty-y)*k;
    var vx=(x-ox)*16.67/dt,vy=(y-oy)*16.67/dt,sp=Math.sqrt(vx*vx+vy*vy);
    if(sp>.8)ang=Math.atan2(vy,vx);
    var target=state==='text'||state==='none'?0:Math.min(sp/42,.5);
    st+=(target-st)*.28;
    ring.style.transform='translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) rotate('+ang.toFixed(3)+'rad) scale('+(1+st).toFixed(3)+','+(1-st*.42).toFixed(3)+') rotate('+(-ang).toFixed(3)+'rad)';
    rotV+=(rotT-rotV)*Math.min(1,.09*dt/16.67);
    rot=(rot+rotV*dt/1000)%360;
    rotG.setAttribute('transform','rotate('+rot.toFixed(1)+')');

    /* rastro: uma gota a cada tantos pixels andados */
    if(state!=='text'&&state!=='none'){
      var dx=tx-lastDropX,dy=ty-lastDropY,step=down&&moved?12:(state==='link'?30:22);
      /* o intervalo mínimo impede o mouse rápido de esgotar o conjunto de gotas
         (reciclar uma gota ainda visível faria ela sumir de repente) */
      if(dx*dx+dy*dy>step*step&&t-lastDropT>46){lastDropX=tx;lastDropY=ty;lastDropT=t;drip()}
    }
    /* parado: respira e solta brasas */
    if(!idle&&t-lastMove>2400&&!down){idle=true;layer.classList.add('cx-idle');nextEmber=t+250}
    if(idle&&t>nextEmber){ember();nextEmber=t+650+rnd()*700}
  }
  function start(){if(running)return;running=true;lastT=performance.now();raf=requestAnimationFrame(frame)}
  function stop(){running=false;cancelAnimationFrame(raf)}

  /* ── eventos ─────────────────────────────────────────────── */
  function usable(e){return on&&!mqReduce.matches&&(e.pointerType==='mouse'||e.pointerType==='pen')}
  function wake(){lastMove=performance.now();if(idle){idle=false;layer.classList.remove('cx-idle')}}

  function onMove(e){
    if(!usable(e))return;
    if(!built)build();
    tx=e.clientX;ty=e.clientY;
    if(down&&!moved){var ddx=tx-downX,ddy=ty-downY;if(ddx*ddx+ddy*ddy>36)moved=true}
    wake();
    if(!shown){show();refresh(e.target);start()}
    if(e.target!==lastTarget){lastTarget=e.target;refresh(e.target)}
  }
  function onDown(e){
    if(!usable(e)||!built||e.button!==0)return;
    tx=e.clientX;ty=e.clientY;downX=tx;downY=ty;moved=false;
    wake();down=true;layer.classList.add('cx-down');
    var t=e.target;requestAnimationFrame(function(){refresh(t)});
  }
  function onUp(e){
    if(!built||!down)return;
    down=false;layer.classList.remove('cx-down');
    if(e&&e.clientX!=null){tx=e.clientX;ty=e.clientY}
    wake();
    if(state!=='text'&&state!=='none'&&state!=='no')splash(tx,ty,state==='link'||state==='grab');
    else if(state==='no')splash(tx,ty,false);
    var t=e&&e.target;requestAnimationFrame(function(){refresh(t)});
  }
  function cancelPress(){
    if(!built)return;
    down=false;layer.classList.remove('cx-down');
  }

  doc.addEventListener('pointermove',onMove,{passive:true,capture:true});
  doc.addEventListener('pointerdown',onDown,{passive:true,capture:true});
  doc.addEventListener('pointerup',onUp,{passive:true,capture:true});
  doc.addEventListener('pointercancel',cancelPress,{passive:true,capture:true});
  doc.addEventListener('dragstart',function(){cancelPress();hide()},{passive:true,capture:true});
  doc.addEventListener('mouseout',function(e){if(!e.relatedTarget)hide()},{passive:true});
  window.addEventListener('blur',function(){cancelPress();hide()});
  doc.addEventListener('visibilitychange',function(){if(doc.hidden){cancelPress();hide()}});
  /* digitando: não solta brasa nem "respira" */
  doc.addEventListener('keydown',function(){if(shown)wake()},{passive:true,capture:true});

  function setOn(v){
    on=!!v;
    try{localStorage.setItem('hx-cursor-fx',on?'on':'off')}catch(_){}
    if(!on){hide();stop()}
  }
  if(mqReduce.addEventListener)mqReduce.addEventListener('change',function(){if(mqReduce.matches){hide();stop()}});

  window.HXCursorFx={enable:setOn,get enabled(){return on&&!mqReduce.matches}};
})();
