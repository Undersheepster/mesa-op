/* Hexatombe — cabeçalho de página.
   Só lê o botão de aba ativo e mostra o nome dele como título, no topo do conteúdo.
   Não altera showTab nem nenhum outro comportamento do app. */
(function(){
  var DESC = {
    ficha:'Seu agente: atributos, vida, perícias e ataques.',
    dados:'Rolagens da mesa.',
    danos:'Dano e cura em cena.',
    agentes:'Fichas e consulta de agentes.',
    inventario:'O que você carrega e quanto pesa.',
    missao:'Objetivos e anotações da missão.',
    trilhas:'Trilhas e habilidades de classe.',
    rituais:'Grimório de rituais.',
    poderes:'Poderes paranormais.',
    itens:'Catálogo de itens.',
    elementos:'Os elementos do Outro Lado.',
    criaturas:'Bestiário e relíquias.',
    multi:'',
    psique:'',
    status:'Estado de cada agente, para o Mestre.',
    mestre:'A mesa inteira, sob o seu controle.'
  };
  function currentKey(btn){
    var m = /showTab\('(\w+)'/.exec(btn.getAttribute('onclick')||'');
    return m ? m[1] : '';
  }
  function build(){
    var body = document.querySelector('.app-body');
    if(!body || document.getElementById('hx-pagehead')) return;
    var head = document.createElement('header');
    head.id = 'hx-pagehead';
    head.className = 'hx-pagehead';
    head.innerHTML = '<h2 id="hx-pagehead-title"></h2><p id="hx-pagehead-desc"></p>';
    body.insertBefore(head, body.firstChild);
    function update(){
      var btn = document.querySelector('.tab-btn.active');
      if(!btn) return;
      var key = currentKey(btn);
      var title = (btn.textContent || '').replace(/\s+/g,' ').trim().replace(/^[^\p{L}\p{N}]+/u,'');
      document.getElementById('hx-pagehead-title').textContent = title;
      document.getElementById('hx-pagehead-desc').textContent = DESC[key] || '';
      head.hidden = (key === 'multi' || key === 'psique');
      document.getElementById('screen-app').setAttribute('data-tab', key);
    }
    var nav = document.getElementById('tab-nav');
    if(nav && window.MutationObserver){
      new MutationObserver(update).observe(nav, {subtree:true, attributes:true, attributeFilter:['class']});
    }
    update();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();


/* Inicial do agente no rodapé da barra lateral */
(function(){
  function _setAvatar(){
    var u=document.getElementById('topbar-username'),a=document.getElementById('topbar-avatar');
    if(!u||!a) return;
    var t=(u.textContent||'').trim();
    a.textContent=t?t.charAt(0):'?';
  }
  document.addEventListener('DOMContentLoaded',function(){
    var u=document.getElementById('topbar-username');
    if(u&&window.MutationObserver) new MutationObserver(_setAvatar).observe(u,{childList:true,characterData:true,subtree:true});
    _setAvatar();
  });
})();
