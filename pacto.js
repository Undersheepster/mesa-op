/* ════════════════════════════════════════════════════════════
   PACTO.JS — Pacto com o Diabo
   ────────────────────────────────────────────────────────────
   O Mestre oferece, a qualquer momento, um Pacto com o Diabo
   pra um agente (painel na aba Agentes) — cura, um ritual, um
   item ou um poder paranormal específico. O jogador recebe uma
   cutscene sombria com a oferta e escolhe Selar ou Recusar.

   Selar: recebe a recompensa escolhida, cura tudo (PV/PE/SAN),
   ganha a Marca do Pacto (habilidade permanente) e perde 1d6 de
   Sanidade máxima pra sempre — o início de uma dependência
   obsessiva. O Mestre pode, depois, Cobrar o Pacto a qualquer
   momento, disparando uma cutscene de cobrança.

   Ódio do Diabo: um efeito à parte que o Mestre pode aplicar ou
   remover em qualquer agente, a qualquer momento — o azar
   sobrenatural persegue quem está marcado.
   ════════════════════════════════════════════════════════════ */

function _ensurePactoState(c){
  if(!c.pacto || typeof c.pacto !== 'object'){
    c.pacto = { selado:false, vezes:0, oferta:false, cobranca:false, ofertaTipo:'cura', ofertaDados:null };
  }
  if(c.pacto.oferta === undefined) c.pacto.oferta = false;
  if(c.pacto.cobranca === undefined) c.pacto.cobranca = false;
  if(c.pacto.ofertaTipo === undefined) c.pacto.ofertaTipo = 'cura';
  if(c.pacto.ofertaDados === undefined) c.pacto.ofertaDados = null;
  return c.pacto;
}

/* ── MESTRE: oferece o pacto para um agente. tipo: 'cura' | 'ritual' | 'item' | 'poder' ── */
function _oferecerPacto(user, tipo){
  if(!user) return;
  const c = userChar(user);
  const p = _ensurePactoState(c);
  tipo = tipo || 'cura';

  let dados = null;
  if(tipo === 'ritual'){
    const q = prompt('Nome (ou parte do nome) do ritual a oferecer:');
    if(q === null) return;
    dados = (typeof RITUAIS_DB !== 'undefined' ? RITUAIS_DB : []).find(r => r.nome.toLowerCase().includes(q.trim().toLowerCase()));
    if(!dados){ toast('Ritual não encontrado.', '#cc4422'); return; }
  } else if(tipo === 'item'){
    const q = prompt('Nome (ou parte do nome) do item a oferecer:');
    if(q === null) return;
    dados = (typeof ITENS_DB !== 'undefined' ? ITENS_DB : []).find(i => i.nome.toLowerCase().includes(q.trim().toLowerCase()));
    if(!dados){ toast('Item não encontrado.', '#cc4422'); return; }
  } else if(tipo === 'poder'){
    const q = prompt('Nome (ou parte do nome) do poder paranormal a oferecer:');
    if(q === null) return;
    dados = (typeof PODERES_DB !== 'undefined' ? PODERES_DB : []).find(x => x.nome.toLowerCase().includes(q.trim().toLowerCase()));
    if(!dados){ toast('Poder não encontrado.', '#cc4422'); return; }
  }

  p.oferta = true;
  p.ofertaTipo = tipo;
  p.ofertaDados = dados ? { nome: dados.nome } : null;
  saveDB();
  renderPactoMestrePanel();
  toast(`⛧ Pacto (${tipo}${dados ? ': '+dados.nome : ''}) oferecido a ${c.nome || user}.`, '#8b0000');
}

/* ── MESTRE: aplica ou remove a condição Ódio do Diabo em um agente ── */
function _toggleOdioDoDiabo(user){
  if(!user) return;
  const c = userChar(user);
  if(!c.conds) c.conds = {};
  const nomeCond = 'Ódio do Diabo';
  const ativo = !c.conds[nomeCond];
  if(ativo){
    c.conds[nomeCond] = true;
    if(!c.habs) c.habs = [];
    if(!c.habs.some(h=>h.nome===nomeCond)){
      c.habs.unshift({
        nome: nomeCond,
        desc: 'Algo do Outro Lado voltou sua atenção maldosa contra você. Enquanto esta condição durar: -5 em testes de resistência contra efeitos Paranormais, -2 de Defesa contra ataques de criaturas Paranormais, e uma vez por sessão o Mestre pode forçar uma falha automática em qualquer teste de perícia seu, representando o azar que o persegue. Só é removida por ação do Mestre ou ritual de proteção adequado.'
      });
    }
    toast(`⛧ Ódio do Diabo caiu sobre ${c.nome||user}.`, '#cc0000');
  } else {
    delete c.conds[nomeCond];
    if(c.habs) c.habs = c.habs.filter(h=>h.nome!==nomeCond);
    toast(`O Ódio do Diabo se afastou de ${c.nome||user}... por enquanto.`, '#888');
  }
  saveDB();
  if(typeof populateAll==='function' && user===currentUser) populateAll();
  if(typeof renderConds==='function' && user===currentUser) renderConds();
  if(typeof renderHabs==='function' && user===currentUser) renderHabs();
  renderPactoMestrePanel();
}

/* ── MESTRE: cobra um pacto já selado, disparando a cutscene de cobrança no cliente do jogador ── */
function _cobrarPacto(user){
  if(!user) return;
  const c = userChar(user);
  const p = _ensurePactoState(c);
  if(!p.selado){ toast('Este agente não tem pacto selado.', '#cc4422'); return; }
  p.cobranca = true;
  saveDB();
  renderPactoMestrePanel();
  toast(`⛧ O Pacto de ${c.nome || user} está sendo cobrado...`, '#8b0000');
}

/* ── Verifica localmente (jogador ou Mestre em sua própria ficha) se há
   oferta pendente ou cobrança pendente, e mostra a cutscene certa ── */
function _checkPactoLocal(){
  if(!currentUser) return;
  const c = userChar(currentUser);
  const p = _ensurePactoState(c);
  if(p.oferta && !document.getElementById('pacto-cutscene')){
    _iniciarCutscenePacto('oferta');
  } else if(p.cobranca && !document.getElementById('pacto-cutscene')){
    _iniciarCutscenePacto('cobranca');
  }
}

/* ══════════════════════════════════════════════════════════════
   CUTSCENE — no estilo Transcendência (sigilo, linhas reveladas em
   sequência, rótulo de canto, barra de progresso), com narração
   canônica de "O Diabo" (portador da Relíquia de Sangue): nunca
   mente, nunca foi derrotado, e a frase icônica "Eu vim te
   oferecer um pacto".
   ══════════════════════════════════════════════════════════════ */
function _iniciarCutscenePacto(tipo){
  const old = document.getElementById('pacto-cutscene');
  if(old) old.remove();
  const oldSt = document.getElementById('pacto-cutscene-style');
  if(oldSt) oldSt.remove();

  const cor = '#cc2222', glow = 'rgba(220,20,20,0.7)';
  const nomePJ = ((userChar(currentUser)||{}).nome || currentUser || '').toUpperCase();

  const style = document.createElement('style');
  style.id = 'pacto-cutscene-style';
  style.textContent = `
    #pacto-cutscene{position:fixed;inset:0;z-index:99996;background:#000;overflow:hidden;
      display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 1.3s ease;font-family:'Courier Prime',monospace}
    #pacto-cutscene.pc-in{opacity:1}
    #pc-vignette{position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse 70% 65% at 50% 45%,rgba(120,0,0,0.28) 0%,rgba(0,0,0,0.98) 75%);
      animation:pc-pulse 4s ease-in-out infinite alternate}
    @keyframes pc-pulse{from{opacity:.8}to{opacity:1}}
    #pc-center{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;max-width:640px;padding:0 24px}
    #pc-sigil{font-size:44px;color:${cor};text-shadow:0 0 20px ${glow},0 0 50px rgba(180,0,0,0.4);
      opacity:0;animation:pc-appear 1.3s .1s cubic-bezier(.1,0,0,1) both,pc-spin 6s linear infinite}
    @keyframes pc-appear{0%{opacity:0;transform:scale(1.4);filter:blur(12px)}60%{opacity:1;transform:scale(.97)}100%{opacity:1;transform:scale(1)}}
    @keyframes pc-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    #pc-lines{display:flex;flex-direction:column;gap:10px;min-height:130px;justify-content:center}
    .pc-line{opacity:0;font-family:'Cinzel',serif;letter-spacing:.1em;transition:opacity .8s ease}
    .pc-line.show{opacity:1}
    .pc-l1{font-size:11px;color:${cor};text-transform:uppercase;letter-spacing:.3em}
    .pc-l2{font-size:14px;color:var(--white-ash,#aaa);font-family:'IM Fell English',serif;font-style:italic;max-width:520px;line-height:1.7}
    .pc-l3{font-family:'Cinzel Decorative',serif;font-size:clamp(18px,3.6vw,28px);color:${cor};text-shadow:0 0 24px ${glow}}
    .pc-l4{font-size:12px;color:var(--white-dust,#887);max-width:500px;line-height:1.6}
    #pc-escolhas{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:6px;opacity:0;transition:opacity .8s ease}
    #pc-escolhas.show{opacity:1}
    .pc-btn{background:rgba(10,0,0,0.9);border:1px solid rgba(139,0,0,0.6);color:var(--white-bone,#ccc);
      font-family:'Cinzel',serif;font-size:12px;letter-spacing:.06em;padding:14px 20px;cursor:pointer;max-width:230px;
      line-height:1.6;transition:all .2s ease}
    .pc-btn:hover{background:rgba(120,0,0,0.35);transform:translateY(-2px)}
    .pc-btn span{display:block;font-family:'Courier Prime',monospace;font-size:10px;opacity:.75;margin-top:6px;text-transform:none}
    .pc-btn.aceitar{border-color:#cc2222;color:#e04444}
    .pc-btn.recusar{border-color:#555;color:#999}
    #pc-corner{position:absolute;bottom:18px;right:22px;font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.15em;color:${cor};opacity:.7}
    #pc-progress{position:absolute;bottom:0;left:0;height:2px;background:${cor};width:0%;transition:width linear;box-shadow:0 0 8px ${glow}}
  `;
  document.head.appendChild(style);

  const div = document.createElement('div');
  div.id = 'pacto-cutscene';
  document.body.appendChild(div);

  if(tipo === 'oferta'){
    const c = userChar(currentUser);
    const p = _ensurePactoState(c);
    let ofertaTxt = 'força e a cura de tudo que sangra em você';
    let ofertaSpan = 'Cura tudo e ganha uma Marca do Pacto.';
    if(p.ofertaTipo === 'ritual' && p.ofertaDados) { ofertaTxt = `o segredo do ritual <b>${p.ofertaDados.nome}</b>`; ofertaSpan = `Aprende o ritual "${p.ofertaDados.nome}" e cura tudo.`; }
    else if(p.ofertaTipo === 'item' && p.ofertaDados) { ofertaTxt = `<b>${p.ofertaDados.nome}</b>, arrancado do Outro Lado`; ofertaSpan = `Recebe "${p.ofertaDados.nome}" no inventário e cura tudo.`; }
    else if(p.ofertaTipo === 'poder' && p.ofertaDados) { ofertaTxt = `o poder <b>${p.ofertaDados.nome}</b>`; ofertaSpan = `Aprende o poder "${p.ofertaDados.nome}" e cura tudo.`; }

    div.innerHTML = `
      <div id="pc-vignette"></div>
      <div id="pc-center">
        <div id="pc-sigil">⛧</div>
        <div id="pc-lines">
          <div class="pc-line pc-l1" data-t="300">ELE TÁ VINDO</div>
          <div class="pc-line pc-l2" data-t="1100">O cheiro de sangue enche o ar antes mesmo dele chegar. Portador da Relíquia de Sangue, complementado por Conhecimento e Medo — nunca derrotado, nunca aprisionado. Você já ouviu: não se envolva com o Diabo. Ele nunca mente. Isso é o que torna tudo pior.</div>
          <div class="pc-line pc-l3" data-t="2200">${nomePJ}</div>
          <div class="pc-line pc-l4" data-t="3200">"Eu vim te oferecer um pacto. Eu posso ter ${ofertaTxt} — tudo o que você procura, direto do sangue. A escolha é sua."</div>
        </div>
        <div id="pc-escolhas">
          <button class="pc-btn aceitar" onclick="_responderPacto(true)">
            ◉ SELAR O PACTO
            <span>${ofertaSpan} Perde 1d6 de Sanidade máxima para sempre — o início de uma dependência obsessiva.</span>
          </button>
          <button class="pc-btn recusar" onclick="_responderPacto(false)">
            ✕ NÃO SE ENVOLVER
            <span>Você recusa. Ele sempre volta a oferecer, mais cedo ou mais tarde.</span>
          </button>
        </div>
      </div>
      <div id="pc-corner">CLASSIFICAÇÃO: RELÍQUIA DE SANGUE — O DIABO</div>
      <div id="pc-progress"></div>
    `;
  } else {
    div.innerHTML = `
      <div id="pc-vignette"></div>
      <div id="pc-center">
        <div id="pc-sigil">⛧</div>
        <div id="pc-lines">
          <div class="pc-line pc-l1" data-t="300">A ESCOLHA JÁ FOI SUA</div>
          <div class="pc-line pc-l2" data-t="1100">A Marca do Pacto pulsa sob sua pele, quente como sangue fresco. Do outro lado, Ele cumpre a parte dele — sempre cumpre, nunca mente — mas isso não o impede de distorcer o resultado a seu favor.</div>
          <div class="pc-line pc-l3" data-t="2200">${nomePJ}</div>
          <div class="pc-line pc-l4" data-t="3200">"Olá de novo. Nos reencontramos outra vez. Tenho uma proposta pra você — na verdade, já é hora de cobrar a antiga." O Mestre decide agora o preço exato desta cobrança.</div>
        </div>
        <div id="pc-escolhas">
          <button class="pc-btn aceitar" onclick="_fecharCobrancaPacto()">
            ⛧ ENFRENTAR A COBRANÇA
            <span>Fecha esta cena. O Mestre narra o que acontece a seguir.</span>
          </button>
        </div>
      </div>
      <div id="pc-corner">CLASSIFICAÇÃO: COBRANÇA DO PACTO</div>
      <div id="pc-progress"></div>
    `;
  }

  requestAnimationFrame(()=> div.classList.add('pc-in'));

  div.querySelectorAll('.pc-line').forEach(el=>{
    setTimeout(()=> el.classList.add('show'), parseInt(el.dataset.t));
  });
  const escolhas = div.querySelector('#pc-escolhas');
  setTimeout(()=>{ if(escolhas) escolhas.classList.add('show'); }, 4000);
  const bar = div.querySelector('#pc-progress');
  if(bar){ requestAnimationFrame(()=>{ bar.style.transitionDuration='4000ms'; bar.style.width='100%'; }); }
}

function _fecharCutscenePacto(){
  const div = document.getElementById('pacto-cutscene');
  if(div){
    div.classList.remove('pc-in');
    setTimeout(()=>{ div.remove(); }, 1200);
  }
}

/* ── Jogador responde à oferta ── */
function _responderPacto(aceitou){
  if(!currentUser) return;
  const c = userChar(currentUser);
  const p = _ensurePactoState(c);
  p.oferta = false;

  if(aceitou){
    c.pv = c.pvMax;
    c.esf = c.esfMax;
    c.san = c.sanMax;
    const perda = 1 + Math.floor(Math.random()*6);
    c.sanMax = Math.max(1, c.sanMax - perda);
    if(c.san > c.sanMax) c.san = c.sanMax;

    p.selado = true;
    p.vezes = (p.vezes||0) + 1;

    if(!c.habs) c.habs = [];
    const nomeHab = 'Marca do Pacto';
    if(!c.habs.some(h=>h.nome===nomeHab)){
      c.habs.unshift({ nome: nomeHab, desc: `Você selou um pacto com algo do Outro Lado. Uma vez por cena, pode gastar 1 PE para receber +1d6 em qualquer teste. O Mestre pode cobrar este pacto a qualquer momento — e ele sempre cobra.` });
    }

    let extra = '';
    if(p.ofertaTipo === 'ritual' && p.ofertaDados){
      if(!c.rituaisAprendidos) c.rituaisAprendidos = {};
      c.rituaisAprendidos[p.ofertaDados.nome] = true;
      extra = ` Ritual aprendido: ${p.ofertaDados.nome}.`;
    } else if(p.ofertaTipo === 'item' && p.ofertaDados){
      const itemFull = (typeof ITENS_DB !== 'undefined' ? ITENS_DB : []).find(i => i.nome === p.ofertaDados.nome);
      if(itemFull){
        if(!c.inv) c.inv = [];
        c.inv.push({ nome: itemFull.nome, desc: itemFull.desc, qtd: 1, dbId: itemFull.id });
        extra = ` Item recebido: ${itemFull.nome}.`;
      }
    } else if(p.ofertaTipo === 'poder' && p.ofertaDados){
      if(!c.poderesAprendidos) c.poderesAprendidos = {};
      c.poderesAprendidos[p.ofertaDados.nome] = true;
      extra = ` Poder aprendido: ${p.ofertaDados.nome}.`;
    }
    p.ofertaTipo = 'cura';
    p.ofertaDados = null;

    saveDB();
    if(typeof populateAll === 'function') populateAll();
    if(typeof renderConds === 'function') renderConds();
    if(typeof renderHabs === 'function') renderHabs();
    toast(`◉ Pacto selado. Sanidade máxima perdida: ${perda}.${extra}`, '#cc2222');
  } else {
    saveDB();
    toast('Você recusou o pacto. A fresta se fecha.', '#888');
  }
  if(typeof renderPactoMestrePanel === 'function') renderPactoMestrePanel();
  _fecharCutscenePacto();
}

/* ── Jogador fecha a tela de cobrança (o Mestre narra o resto) ── */
function _fecharCobrancaPacto(){
  if(!currentUser) return;
  const c = userChar(currentUser);
  const p = _ensurePactoState(c);
  p.cobranca = false;
  saveDB();
  if(typeof renderPactoMestrePanel === 'function') renderPactoMestrePanel();
  _fecharCutscenePacto();
}

/* ══════════════════════════════════════════════════════════════
   PAINEL DO MESTRE
   ══════════════════════════════════════════════════════════════ */
function renderPactoMestrePanel(){
  if(!isMestre) return;
  if(currentUser && !db.characters[currentUser]) db.characters[currentUser] = defaultChar();
  let panel = document.getElementById('pacto-mestre-panel');
  if(!panel){
    const anchor = document.getElementById('fichas-recebidas-panel');
    const subtab = document.getElementById('msubtab-agentes');
    if(!anchor && !subtab) return;
    panel = document.createElement('div');
    panel.id = 'pacto-mestre-panel';
    panel.className = 'noir-panel';
    panel.style.margin = '14px 16px 0';
    panel.style.borderColor = 'rgba(139,0,0,0.4)';
    if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor);
    else subtab.insertBefore(panel, subtab.firstChild);
  }

  const usuarios = Object.keys(db.characters || {});
  panel.innerHTML = `
    <div class="noir-panel-header" style="background:rgba(60,0,0,0.35)">
      <div class="noir-panel-title">⛧ <span class="noir-panel-title-accent">Pacto</span> com o Diabo</div>
    </div>
    <div class="noir-panel-body">
      ${usuarios.length ? usuarios.map(u=>{
        const ch = db.characters[u];
        const p = ch.pacto || {};
        const nome = ch.nome || u;
        const odioAtivo = !!(ch.conds && ch.conds['Ódio do Diabo']);
        let status;
        if(p.oferta) status = '<span style="color:#cc8822;font-size:10px">Oferta pendente...</span>';
        else if(p.cobranca) status = '<span style="color:#cc2222;font-size:10px">Cobrança em andamento...</span>';
        else if(p.selado) status = `<span style="color:#cc2222;font-size:10px">Pacto selado (${p.vezes}x) — <span style="cursor:pointer;text-decoration:underline" onclick="_cobrarPacto('${u}')">Cobrar Pacto</span></span>`;
        else status = `<div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="noir-btn accent" style="font-size:10px;padding:5px 8px" onclick="_oferecerPacto('${u}','cura')">◉ Cura</button>
            <button class="noir-btn accent" style="font-size:10px;padding:5px 8px" onclick="_oferecerPacto('${u}','ritual')">▤ Ritual</button>
            <button class="noir-btn accent" style="font-size:10px;padding:5px 8px" onclick="_oferecerPacto('${u}','item')">⚿ Item</button>
            <button class="noir-btn accent" style="font-size:10px;padding:5px 8px" onclick="_oferecerPacto('${u}','poder')">⚛ Poder</button>
          </div>`;
        return `<div class="existido-row" style="display:flex;flex-direction:column;gap:6px;padding:8px 0;border-bottom:1px solid rgba(139,0,0,0.2)">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="trans-agent-name" style="flex:1">⛧ ${nome}${u===currentUser?' <span style="opacity:.6;font-size:10px">(você, Mestre)</span>':''}${odioAtivo?' <span style="color:#cc2222;font-size:10px">[Ódio do Diabo ativo]</span>':''}</span>
            <button class="noir-btn" style="font-size:9px;padding:4px 8px;${odioAtivo?'border-color:#cc2222;color:#cc2222':''}" onclick="_toggleOdioDoDiabo('${u}')">${odioAtivo?'Remover Ódio':'Aplicar Ódio do Diabo'}</button>
          </div>
          <div>${status}</div>
        </div>`;
      }).join('') : '<div style="font-family:\'Courier Prime\',monospace;font-size:12px;color:#3a3020">Nenhum agente registrado.</div>'}
    </div>
  `;
}

/* Encadeia com hooks de sync/login já existentes (morte.js/app.js) */
(function(){
  const _prevLoginAs = typeof loginAs !== 'undefined' ? loginAs : null;
  if(_prevLoginAs){
    loginAs = function(user, roleFlag, skipDB){
      _prevLoginAs(user, roleFlag, skipDB);
      if(isMestre && typeof renderPactoMestrePanel === 'function') renderPactoMestrePanel();
      if(typeof _checkPactoLocal === 'function') _checkPactoLocal();
    };
  }
})();
