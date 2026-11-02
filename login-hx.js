/* Login Hexatombe — brasas subindo e número do formulário. Só decoração. */
(function(){
  function init(){
    var n=document.getElementById('lg-num');
    if(n)n.textContent=String(Math.floor(Math.random()*9000)+1000);
    var box=document.getElementById('lg-embers');
    if(!box||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(var i=0;i<12;i++){
      var e=document.createElement('i');
      e.style.cssText='left:'+(Math.random()*100).toFixed(1)+'%;--s:'+(2+Math.random()*4).toFixed(1)+'px;--d:'+(9+Math.random()*12).toFixed(1)+'s;--w:'+(Math.random()*-20).toFixed(1)+'s;--x:'+(Math.round(Math.random()*120-60))+'px';
      box.appendChild(e);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Câmara do Mestre: Esc fecha, erro faz o cartão tremer */
(function(){
  document.addEventListener('keydown',function(e){
    var m=document.getElementById('modal-mestre');
    if(e.key==='Escape'&&m&&m.style.display!=='none'&&typeof closeMestreModal==='function')closeMestreModal();
  });
  function init(){
    var err=document.getElementById('m-err'),card=document.querySelector('#modal-mestre .mm-card');
    if(!err||!card||!window.MutationObserver)return;
    new MutationObserver(function(){
      if(!err.textContent)return;
      card.classList.remove('shake');void card.offsetWidth;card.classList.add('shake');
    }).observe(err,{childList:true,characterData:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ═══ Ordem Paranormal: terminal da Ordo — só decoração e microinterações ═══ */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $=function(id){return document.getElementById(id)};

  function init(){
    var scr=$('screen-login'),box=$('login-box-el');
    if(!scr||!box)return;

    /* relógio do HUD */
    var clk=$('lg-clock');
    function tick(){if(!clk)return;var d=new Date(),p=function(n){return String(n).padStart(2,'0')};clk.textContent=p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds())}
    tick();setInterval(tick,1000);

    /* log digitado no herói */
    var log=$('lg-log');
    var lines=['> conectando ao servidor da Ordo…','> assinatura paranormal detectada: setor 07','> o Véu está fino esta noite.','> não olhe para o outro lado.','> identifique-se, agente.'];
    if(log&&!reduce){
      var li=0,ci=0,hold=0;
      setInterval(function(){
        if(hold>0){hold--;return}
        var s=lines[li];
        if(ci<s.length){ci++;log.textContent=s.slice(0,ci)}
        else{hold=34;li=(li+1)%lines.length;ci=0}
      },55);
    }

    /* foto de identificação reage ao codinome */
    var photo=$('lg-photo'),who=$('lg-who');
    function bind(id){
      var el=$(id);if(!el)return;
      el.addEventListener('input',function(){
        var v=el.value.trim();
        if(photo)photo.classList.toggle('on',!!v);
        if(who){who.textContent=v?v.slice(0,18):'não identificado';who.classList.toggle('set',!!v)}
      });
    }
    bind('li-user');bind('rg-user');

    /* mostrar/ocultar senha */
    document.querySelectorAll('.lg-eye').forEach(function(b){
      b.addEventListener('click',function(){
        var i=$(b.getAttribute('data-for'));if(!i)return;
        var show=i.type==='password';i.type=show?'text':'password';
        b.textContent=show?'ocultar':'ver';b.classList.toggle('on',show);
        b.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
      });
    });

    /* erro: cartão treme em vermelho */
    if(window.MutationObserver){
      ['li-err','rg-err'].forEach(function(id){
        var e=$(id);if(!e)return;
        new MutationObserver(function(){
          if(!e.textContent)return;
          box.classList.remove('lg-deny');void box.offsetWidth;box.classList.add('lg-deny');
        }).observe(e,{childList:true,characterData:true,subtree:true});
      });
    }

    /* título do cartão acompanha entrar / cadastrar */
    function setMode(reg){
      var t=$('lg-title'),s=$('lg-sub'),f=$('lg-form-name');
      if(t)t.textContent=reg?'Recrutamento':'Registro de agente';
      if(s)s.textContent=reg?'Novo agente · formulário de ingresso':'Acesso restrito à Ordem';
      if(f)f.textContent=reg?'Formulário OR-01':'Formulário OR-13';
    }
    ['showRegister','showLogin'].forEach(function(n){
      var orig=window[n];if(typeof orig!=='function')return;
      window[n]=function(){var r=orig.apply(this,arguments);setMode(n==='showRegister');return r};
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
