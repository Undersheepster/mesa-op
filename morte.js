/* ════════════════════════════════════════════════════════════
   MORTE.JS — Sistema de Morte, Cutscene e Renascimento
   ────────────────────────────────────────────────────────────
   Quando o PV de um personagem chega a 0, uma cutscene de morte
   é exibida para o jogador. O Mestre pode, pelo painel na aba
   "Agentes", liberar a escolha de destino do agente morto:

     ↻ Reencarnar             — apaga a ficha (defaultChar), um
                                  novo agente nasce do zero.
     ◉ Reviver como Criatura  — mantém a ficha, mas o agente
                                  renasce transformado pelo seu
                                  elemento de Transcendência
                                  (ou "Morte", se nunca transcendeu).

   Arquivo carregado DEPOIS de app.js e ficha.js (usa userChar,
   defaultChar, TRANSCENDENCIA_ELEMENTOS, toast, saveDB, db,
   currentUser, isMestre, populateAll).
   ════════════════════════════════════════════════════════════ */

let _morteCutsceneAtiva = false;

/* Garante que o personagem tenha o campo de estado de morte */
function _ensureMorteState(c){
  if(!c.morte || typeof c.morte !== 'object'){
    c.morte = { estado: 'vivo', liberado: false };
  }
  return c.morte;
}

/* ── Chamado sempre que o PV de um personagem muda (dano, cura,
   ajuste manual, custo de ritual etc). Detecta as duas transições:
   vivo → morrendo (PV chegou a 0) e morrendo → vivo (foi
   estabilizado antes do Mestre declarar a morte). A morte de fato
   NUNCA acontece sozinha por PV zerado — só quando o Mestre
   confirma pela aba de Status (declararMorte). ── */
function checarMorte(user){
  if(!user || !db || !db.characters) return;
  const c = userChar(user);
  const m = _ensureMorteState(c);
  const pv = c.pv || 0;
  if(pv <= 0 && m.estado === 'vivo'){
    m.estado = 'morrendo';
    saveDB();
    if(typeof _publishMyStatus === 'function' && user === currentUser) _publishMyStatus();
    if(user === currentUser) _checkMorteLocal();
    if(isMestre && typeof renderStatusMestrePanel === 'function') renderStatusMestrePanel();
  } else if(pv > 0 && m.estado === 'morrendo'){
    m.estado = 'vivo';
    saveDB();
    if(typeof _publishMyStatus === 'function' && user === currentUser) _publishMyStatus();
    if(user === currentUser) _checkMorteLocal();
    if(isMestre && typeof renderStatusMestrePanel === 'function') renderStatusMestrePanel();
  }
}

/* ── Rede de segurança: roda a cada ciclo de sync remoto e detecta
   mudanças de estado que tenham ocorrido em QUALQUER personagem
   (ex: PV editado pelo Mestre em outra tela), garantindo que
   'morrendo'/'vivo' fiquem corretos mesmo fora dos pontos de dano
   conhecidos. Nunca mexe em quem já está 'morto' — essa transição
   só o Mestre faz, manualmente, pela aba de Status. ── */
function _syncCheckAllMorte(){
  if(!db || !db.characters) return;
  Object.keys(db.characters).forEach(u => {
    const c = db.characters[u];
    const m = _ensureMorteState(c);
    const pv = c.pv || 0;
    if(pv <= 0 && m.estado === 'vivo'){
      m.estado = 'morrendo';
    } else if(pv > 0 && m.estado === 'morrendo'){
      m.estado = 'vivo';
    }
  });
}

/* ── Verifica localmente (para quem está logado — jogador OU
   Mestre em sua própria ficha) se deve exibir a cutscene de
   morte/agonia ou fechar ela, chamado após cada sync. ── */
function _checkMorteLocal(){
  if(!currentUser) return;
  const c = userChar(currentUser);
  const m = _ensureMorteState(c);
  if(m.estado === 'morto' || m.estado === 'morrendo'){
    if(!document.getElementById('morte-cutscene')){
      _iniciarCutsceneMorte();
    } else {
      _atualizarConteudoCutsceneMorte();
    }
  } else {
    _fecharCutsceneMorte();
  }
}

/* ══════════════════════════════════════════════════════════════
   CUTSCENE DE MORTE
   ══════════════════════════════════════════════════════════════ */
function _iniciarCutsceneMorte(){
  _morteCutsceneAtiva = true;

  const old = document.getElementById('morte-cutscene');
  if(old) old.remove();
  const oldSt = document.getElementById('morte-cutscene-style');
  if(oldSt) oldSt.remove();

  const style = document.createElement('style');
  style.id = 'morte-cutscene-style';
  style.textContent = `
    #morte-cutscene{
      position:fixed;inset:0;z-index:99998;background:#000;
      display:flex;align-items:center;justify-content:center;overflow:hidden;
      opacity:0;transition:opacity 1.6s ease;font-family:'Courier Prime',monospace;
    }
    #morte-cutscene.morte-in{opacity:1}
    #morte-cutscene.morte-fadeout{opacity:0;pointer-events:none}
    #morte-vignette{
      position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse 75% 70% at 50% 45%,rgba(40,0,0,0.25) 0%,rgba(0,0,0,0.97) 75%),
                  repeating-linear-gradient(to bottom,transparent 0px,transparent 2px,rgba(60,0,0,0.08) 2px,rgba(60,0,0,0.08) 3px);
      animation:morte-pulse 4s ease-in-out infinite alternate;
    }
    @keyframes morte-pulse{
      from{background:radial-gradient(ellipse 75% 70% at 50% 45%,rgba(40,0,0,0.25) 0%,rgba(0,0,0,0.97) 75%),repeating-linear-gradient(to bottom,transparent 0px,transparent 2px,rgba(60,0,0,0.08) 2px,rgba(60,0,0,0.08) 3px)}
      to{background:radial-gradient(ellipse 65% 60% at 50% 45%,rgba(70,0,0,0.35) 0%,rgba(0,0,0,0.99) 75%),repeating-linear-gradient(to bottom,transparent 0px,transparent 2px,rgba(90,0,0,0.12) 2px,rgba(90,0,0,0.12) 3px)}
    }
    #morte-center{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center;padding:0 24px;max-width:640px}
    #morte-titulo{
      font-family:'Cinzel Decorative',serif;font-weight:900;letter-spacing:.22em;text-transform:uppercase;
      font-size:clamp(28px,7vw,58px);color:#cc0000;
      text-shadow:0 0 30px rgba(200,0,0,0.9),0 0 90px rgba(120,0,0,0.6);
      animation:morte-titulo-flicker 3.2s ease-in-out infinite;
      opacity:0;transform:scale(1.15);
      animation:morte-appear 1.4s .2s cubic-bezier(.1,0,0,1) both, morte-titulo-flicker 3.2s 1.8s ease-in-out infinite;
    }
    @keyframes morte-appear{0%{opacity:0;transform:scale(1.3);filter:blur(14px)}60%{opacity:1;transform:scale(0.98);filter:blur(0)}100%{opacity:1;transform:scale(1)}}
    @keyframes morte-titulo-flicker{0%,100%{opacity:1}45%{opacity:.85}50%{opacity:.5}55%{opacity:.95}}
    #morte-sub{
      font-family:'Cinzel',serif;font-size:clamp(11px,1.8vw,14px);letter-spacing:.12em;
      color:var(--white-dust,#6a6060);opacity:0;animation:morte-fade-in 1.2s 1.1s ease both;
    }
    @keyframes morte-fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    #morte-aguardando{
      font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;
      color:#7a3030;opacity:0;animation:morte-fade-in 1.2s 2s ease both;
    }
    .morte-dots span{animation:morte-dot 1.4s infinite}
    .morte-dots span:nth-child(2){animation-delay:.2s}
    .morte-dots span:nth-child(3){animation-delay:.4s}
    @keyframes morte-dot{0%,80%,100%{opacity:.15}40%{opacity:1}}
    #morte-escolhas{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:8px;opacity:0;animation:morte-fade-in 1s ease both}
    .morte-btn{
      background:rgba(10,0,8,0.9);border:1px solid rgba(139,0,0,0.6);color:var(--white-bone,#c8c0c0);
      font-family:'Cinzel',serif;font-size:12px;letter-spacing:.06em;padding:14px 20px;cursor:pointer;
      max-width:230px;line-height:1.6;transition:all .2s ease;
    }
    .morte-btn:hover{background:rgba(80,0,0,0.35);transform:translateY(-2px)}
    .morte-btn span{display:block;font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.02em;opacity:.75;margin-top:6px;text-transform:none}
    #sorteio-roleta{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:10px;opacity:0;animation:tf-fade 1s ease both}
    #sorteio-simbolo{width:72px;height:72px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(153,119,255,0.4);border-radius:50%;background:rgba(0,0,0,0.4);transition:box-shadow .2s ease}
    #sorteio-simbolo .sym-el{width:40px;height:40px;display:inline-block;background-size:contain;background-repeat:no-repeat;background-position:center;filter:drop-shadow(0 0 6px currentColor)}
    #sorteio-nome{font-family:'Cinzel',serif;font-size:13px;letter-spacing:.2em;transition:color .1s ease}
    #sorteio-roleta.sorteio-parado #sorteio-simbolo{box-shadow:0 0 22px 4px var(--sorteio-glow,#9977ff),0 0 50px 10px rgba(153,119,255,0.25);animation:sorteio-pulso 1.4s ease-in-out infinite}
    @keyframes sorteio-pulso{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
  `;
  document.head.appendChild(style);

  const div = document.createElement('div');
  div.id = 'morte-cutscene';
  document.body.appendChild(div);

  _atualizarConteudoCutsceneMorte();
  requestAnimationFrame(()=> div.classList.add('morte-in'));
}

/* Atualiza o conteúdo interno da cutscene conforme o estado
   (aguardando o Mestre vs. escolha liberada) — permite que a
   tela se atualize sozinha quando o Mestre libera a escolha,
   sem precisar recriar toda a cutscene. */
function _atualizarConteudoCutsceneMorte(){
  const div = document.getElementById('morte-cutscene');
  if(!div || !currentUser) return;
  const c = userChar(currentUser);
  const m = _ensureMorteState(c);

  if(m.estado === 'morrendo'){
    div.innerHTML = `
      <div id="morte-vignette" style="animation-duration:2.4s"></div>
      <div id="morte-center">
        <div id="morte-titulo" style="font-size:clamp(22px,5.5vw,44px);color:#cc7700;text-shadow:0 0 30px rgba(200,120,0,0.9),0 0 90px rgba(120,70,0,0.6)">VOCÊ ESTÁ MORRENDO</div>
        <div id="morte-sub">Seus pontos de vida chegaram a zero. Você ainda respira — por enquanto.</div>
        ${isMestre
          ? `<div id="morte-aguardando">Como Mestre, decida pela aba <b style="color:#cc7700">☠ Status</b>: estabilizar ${c && c.nome ? c.nome : 'o agente'} ou declarar a morte.</div>`
          : `<div id="morte-aguardando">Aguardando a decisão do Mestre<span class="morte-dots"><span>.</span><span>.</span><span>.</span></span></div>`
        }
      </div>
    `;
    return;
  }

  if(!m.liberado){
    div.innerHTML = `
      <div id="morte-vignette"></div>
      <div id="morte-center">
        <div id="morte-titulo">VOCÊ MORREU</div>
        <div id="morte-sub">O fio se rompeu. Seu corpo jaz imóvel sob o Véu.</div>
        ${isMestre
          ? `<div id="morte-aguardando">Como Mestre, você mesmo decide seu destino.</div>
             <div id="morte-escolhas">
               <button class="morte-btn" style="border-color:var(--gold-light,#c78400);color:var(--gold-light,#c78400)" onclick="_liberarEscolhaMorte('${currentUser}')">
                 ⛧ LIBERAR MINHA ESCOLHA
                 <span>Revela as opções de reencarnar ou reviver como criatura paranormal.</span>
               </button>
             </div>`
          : `<div id="morte-aguardando">Aguardando o julgamento do Mestre<span class="morte-dots"><span>.</span><span>.</span><span>.</span></span></div>`
        }
      </div>
    `;
    return;
  }

  const temElemento = !!(c.transcendencia && c.transcendencia.elemento);
  const elemId = temElemento ? c.transcendencia.elemento : null;
  const ed = (elemId && typeof TRANSCENDENCIA_ELEMENTOS !== 'undefined' && TRANSCENDENCIA_ELEMENTOS[elemId])
    || { nome: 'Morte', cor: '#9977ff', bonus_desc: 'Enxerga espíritos e ecos de mortos.' };

  div.innerHTML = `
    <div id="morte-vignette"></div>
    <div id="morte-center">
      <div id="morte-titulo">VOCÊ MORREU</div>
      <div id="morte-sub">Mas o Outro Lado ainda tem planos para você. Escolha seu destino.</div>
      <div id="morte-escolhas">
        <button class="morte-btn" onclick="_escolherReencarnar()">
          ↻ REENCARNAR
          <span>Sua ficha é apagada. Um novo agente nasce, sem memória do que veio antes.</span>
        </button>
        ${temElemento
          ? `<button class="morte-btn" style="border-color:${ed.cor};color:${ed.cor}" onclick="_escolherReviverCriatura()">
               ◉ REVIVER COMO CRIATURA
               <span>Você renasce transformado pelo elemento <b>${ed.nome}</b>, o mesmo da sua Transcendência. ${ed.bonus_desc || ''}</span>
             </button>`
          : `<button class="morte-btn" style="border-color:#9977ff;color:#9977ff" onclick="_iniciarSorteioCriatura()">
               ◉ REVIVER COMO CRIATURA
               <span>Você nunca transcendeu — não tem elemento próprio. O Véu sorteia um na hora. Ninguém escolhe — só se descobre.</span>
             </button>`
        }
      </div>
    </div>
  `;
}

function _fecharCutsceneMorte(){
  _morteCutsceneAtiva = false;
  const div = document.getElementById('morte-cutscene');
  if(div){
    div.classList.remove('morte-in');
    div.classList.add('morte-fadeout');
    setTimeout(()=>{ div.remove(); }, 900);
  }
}

/* ══════════════════════════════════════════════════════════════
   ESCOLHAS DO JOGADOR (liberadas pelo Mestre)
   ══════════════════════════════════════════════════════════════ */

/* Reencarnar: apaga a ficha do agente (mantém o token/aparência) */
function _escolherReencarnar(){
  if(!currentUser) return;
  const tokenAtual = (db.characters[currentUser] || {}).token;
  const nova = defaultChar();
  if(tokenAtual) nova.token = tokenAtual;
  db.characters[currentUser] = nova;
  saveDB();
  if(typeof populateAll === 'function') populateAll();
  _fecharCutsceneMorte();
  _removerTemaElemento();
  if(typeof _ensureClasseCriaturaOption === 'function') _ensureClasseCriaturaOption();
  toast('↻ Você reencarnou. Uma nova vida começa, sem memória do que veio antes.', '#22cc66');
}

/* ══════════════════════════════════════════════════════════════
   SORTEIO DO ELEMENTO — quando o jogador escolhe "Reviver como
   Criatura", o elemento não é escolhido: gira feito uma roleta
   entre os 5 elementos, desacelerando até parar num resultado
   sorteado na hora, e só então aplica a transformação.
   ══════════════════════════════════════════════════════════════ */
function _iniciarSorteioCriatura(){
  const div = document.getElementById('morte-cutscene');
  if(!div || typeof TRANSCENDENCIA_ELEMENTOS === 'undefined') return;

  const elementos = Object.keys(TRANSCENDENCIA_ELEMENTOS);
  const sorteado = elementos[Math.floor(Math.random() * elementos.length)];

  div.innerHTML = `
    <div id="morte-vignette"></div>
    <div id="morte-center">
      <div id="morte-titulo" style="font-size:clamp(16px,3.2vw,24px)">O VÉU DECIDE...</div>
      <div id="morte-sub">O destino gira. Ninguém escolhe qual parte de você sobrevive.</div>
      <div id="sorteio-roleta">
        <div id="sorteio-simbolo"><span class="sym-el" id="sorteio-simbolo-el"></span></div>
        <div id="sorteio-nome">?????</div>
      </div>
    </div>
  `;

  const simboloWrap = document.getElementById('sorteio-simbolo-el');
  const nomeEl = document.getElementById('sorteio-nome');
  const roletaEl = document.getElementById('sorteio-roleta');

  let tick = 0;
  const totalTicks = 20;
  let delay = 55;

  function passo(){
    const meio = tick < totalTicks - 1;
    const elemId = meio ? elementos[Math.floor(Math.random() * elementos.length)] : sorteado;
    const ed = TRANSCENDENCIA_ELEMENTOS[elemId];

    simboloWrap.className = 'sym-el ' + (ed.simbolo || '');
    nomeEl.textContent = ed.nome.toUpperCase();
    nomeEl.style.color = ed.cor;
    document.getElementById('sorteio-simbolo').style.setProperty('--sorteio-glow', ed.corGlow || ed.cor);

    tick++;
    if(tick < totalTicks){
      delay = Math.round(delay * 1.16);
      setTimeout(passo, delay);
    } else {
      roletaEl.classList.add('sorteio-parado');
      const subEl = document.getElementById('morte-sub');
      if(subEl) subEl.textContent = `Sorteado: ${ed.nome}. ${ed.bonus_desc || ''}`;
      setTimeout(()=> _escolherReviverCriatura(sorteado), 1400);
    }
  }
  passo();
}

/* Reviver como criatura paranormal — o elemento é sorteado pelo
   Véu (ver _iniciarSorteioCriatura), não escolhido pelo jogador. */
function _escolherReviverCriatura(elemForcado){
  if(!currentUser) return;
  const c = userChar(currentUser);
  const elemId = elemForcado || (c.transcendencia && c.transcendencia.elemento) || 'morte';
  const ed = (typeof TRANSCENDENCIA_ELEMENTOS !== 'undefined' && TRANSCENDENCIA_ELEMENTOS[elemId])
    || { nome: 'Morte', cor: '#9977ff', bonus_desc: 'Enxerga espíritos e ecos de mortos.' };

  if(!c.conds) c.conds = {};
  c.conds['criaturaParanormal'] = true;
  c.criaturaElemento = elemId;
  c.classeAntesCriatura = c.classe; // guarda a classe humana anterior, caso volte a ser humano
  c.classe = `Criatura Paranormal de ${ed.nome}`;
  if(typeof CLASSES_DESC !== 'undefined'){
    CLASSES_DESC[c.classe] = `⛧ Não é mais inteiramente humano — voltou do outro lado do Véu transformado por ${ed.nome}. PV alto e resistente, mas a Sanidade paga o preço. PV: 24+Vig (mais 5+Vig/NEX). PE: 3+Pre (mais 3+Pre/NEX). SAN: 8 (mais 2/NEX).`;
  }
  _ensureClasseCriaturaOption();

  if(typeof recalcMaxStats === 'function') recalcMaxStats(true);
  c.pv = Math.max(1, Math.floor((c.pvMax || 10) * 0.5));

  if(!c.habs) c.habs = [];
  const nomeHab = `Natureza Paranormal — ${ed.nome}`;
  if(!c.habs.some(h => h.nome === nomeHab)){
    c.habs.unshift({
      nome: nomeHab,
      desc: `Você morreu e voltou transformado pelo elemento ${ed.nome}. ${ed.bonus_desc || ''}`
    });
  }

  const m = _ensureMorteState(c);
  m.estado = 'vivo';
  m.liberado = false;

  saveDB();
  if(typeof populateAll === 'function') populateAll();
  if(typeof renderConds === 'function') renderConds();
  if(typeof renderHabs === 'function') renderHabs();
  _fecharCutsceneMorte();
  _cutsceneCriaturaParanormal(elemId, ed);
}

/* ══════════════════════════════════════════════════════════════
   CUTSCENE DE TRANSFORMAÇÃO EM CRIATURA PARANORMAL — no mesmo
   espírito da cutscene de Existido (linhas reveladas em sequência,
   selo central, rótulos de canto, barra de progresso), mas com a
   paleta do elemento que definiu a transformação.
   ══════════════════════════════════════════════════════════════ */
function _cutsceneCriaturaParanormal(elemId, ed){
  const nomePJ = (userChar(currentUser).nome || currentUser).toUpperCase();
  const cor = ed.cor || '#9977ff';
  const glow = ed.corGlow || cor;

  const old = document.getElementById('criatura-cutscene');
  if(old) old.remove();
  const oldSt = document.getElementById('criatura-cutscene-style');
  if(oldSt) oldSt.remove();

  const style = document.createElement('style');
  style.id = 'criatura-cutscene-style';
  style.textContent = `
    #criatura-cutscene{position:fixed;inset:0;z-index:99997;background:#000;overflow:hidden;
      display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 1.2s ease}
    #criatura-cutscene.cp-in{opacity:1}
    #cp-vignette{position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse 70% 65% at 50% 45%,${_hexToRgba(cor,0.22)} 0%,rgba(0,0,0,0.97) 75%);
      animation:cp-pulse 3.5s ease-in-out infinite alternate}
    @keyframes cp-pulse{from{opacity:.8}to{opacity:1}}
    #cp-center{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;max-width:640px;padding:0 24px}
    #cp-sigil{font-size:44px;color:${cor};text-shadow:0 0 20px ${glow},0 0 50px ${_hexToRgba(cor,0.4)};opacity:0;animation:cp-fade 1s .1s ease both,cp-spin 6s linear infinite}
    @keyframes cp-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    #cp-lines{display:flex;flex-direction:column;gap:10px;min-height:150px;justify-content:center}
    .cp-line{opacity:0;font-family:'Cinzel',serif;letter-spacing:.1em;transition:opacity .8s ease}
    .cp-line.show{opacity:1}
    .cp-l1{font-size:11px;color:${cor};text-transform:uppercase;letter-spacing:.3em}
    .cp-l2{font-size:14px;color:var(--white-ash,#aaa);font-family:'IM Fell English',serif;font-style:italic}
    .cp-l3{font-family:'Cinzel Decorative',serif;font-size:clamp(20px,4vw,32px);color:${cor};text-shadow:0 0 24px ${glow}}
    .cp-l4{font-size:13px;color:var(--white-dust,#887);max-width:480px;line-height:1.7}
    @keyframes cp-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    #cp-corner{position:absolute;bottom:18px;right:22px;font-family:'Courier Prime',monospace;font-size:10px;letter-spacing:.15em;color:${cor};opacity:.7}
    #cp-progress{position:absolute;bottom:0;left:0;height:2px;background:${cor};width:0%;transition:width linear;box-shadow:0 0 8px ${glow}}
  `;
  document.head.appendChild(style);

  const div = document.createElement('div');
  div.id = 'criatura-cutscene';
  div.innerHTML = `
    <div id="cp-vignette"></div>
    <div id="cp-center">
      <div id="cp-sigil">⛧</div>
      <div id="cp-lines">
        <div class="cp-line cp-l1" data-t="300">TRANSFORMAÇÃO</div>
        <div class="cp-line cp-l2" data-t="1100">A morte não te levou. Ela te reformou.</div>
        <div class="cp-line cp-l3" data-t="2200">${nomePJ}</div>
        <div class="cp-line cp-l4" data-t="3200">Seu corpo agora responde ao elemento <b style="color:${cor}">${ed.nome}</b>. ${ed.bonus_desc || ''}</div>
      </div>
    </div>
    <div id="cp-corner">CLASSIFICAÇÃO: CRIATURA PARANORMAL — ${ed.nome.toUpperCase()}</div>
    <div id="cp-progress"></div>
  `;
  document.body.appendChild(div);
  requestAnimationFrame(()=> div.classList.add('cp-in'));

  div.querySelectorAll('.cp-line').forEach(el=>{
    setTimeout(()=> el.classList.add('show'), parseInt(el.dataset.t));
  });
  const bar = document.getElementById('cp-progress');
  requestAnimationFrame(()=>{ bar.style.transitionDuration='5200ms'; bar.style.width='100%'; });

  setTimeout(()=>{
    div.style.transition = 'opacity 1.4s ease';
    div.style.opacity = '0';
    setTimeout(()=>{
      div.remove();
      _aplicarTemaElemento(elemId);
      toast(`◉ Você reviveu como criatura paranormal do elemento ${ed.nome}.`, cor);
    }, 1400);
  }, 5300);
}

function _hexToRgba(hex, a){
  hex = (hex||'#9977ff').replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.substr(0,2),16)||0, g = parseInt(hex.substr(2,2),16)||0, b = parseInt(hex.substr(4,2),16)||0;
  return `rgba(${r},${g},${b},${a})`;
}

/* Garante que a opção "Criatura Paranormal de X" exista no seletor
   de classe SOMENTE enquanto o agente estiver com essa condição —
   é uma classe travada, ninguém escolhe ela na mão. */
function _ensureClasseCriaturaOption(){
  const sel = document.getElementById('f-classe');
  if(!sel || !currentUser) return;
  const c = userChar(currentUser);
  const ativa = !!(c.conds && c.conds.criaturaParanormal && c.criaturaElemento);

  // Remove qualquer opção de criatura antiga que não seja mais a atual
  Array.from(sel.querySelectorAll('option[data-criatura-classe]')).forEach(opt => {
    if(!ativa || opt.value !== c.classe) opt.remove();
  });

  if(ativa && !Array.from(sel.options).some(o => o.value === c.classe)){
    const opt = document.createElement('option');
    opt.value = c.classe;
    opt.textContent = `⛧ ${c.classe}`;
    opt.dataset.criaturaClasse = '1';
    sel.appendChild(opt);
  }
}

/* ══════════════════════════════════════════════════════════════
   PAINEL DO MESTRE — liberar a escolha de destino
   ══════════════════════════════════════════════════════════════ */
function _liberarEscolhaMorte(user){
  if(!user || !db.characters[user]) return;
  const c = db.characters[user];
  const m = _ensureMorteState(c);
  if(m.estado !== 'morto'){ toast('Este agente não está morto.', '#cc4422'); return; }
  m.liberado = true;
  saveDB();
  if(typeof renderStatusMestrePanel === 'function') renderStatusMestrePanel();
  if(user === currentUser && typeof _atualizarConteudoCutsceneMorte === 'function') _atualizarConteudoCutsceneMorte();
  toast(`☠ Escolha de destino liberada para ${c.nome || user}.`, '#cc2244');
}

/* ══════════════════════════════════════════════════════════════
   AÇÕES DO MESTRE sobre agentes "morrendo"
   ══════════════════════════════════════════════════════════════ */

/* Confirma a morte de um agente que estava "morrendo" — só a
   partir daqui é que a cutscene de morte de verdade (com as
   escolhas de destino) passa a valer para ele. */
function declararMorte(user){
  if(!isMestre || !user) return;
  const c = userChar(user);
  const m = _ensureMorteState(c);
  if(m.estado !== 'morrendo') return;
  m.estado = 'morto';
  m.liberado = false;
  saveDB();
  if(typeof _publishMyStatus === 'function' && user === currentUser) _publishMyStatus();
  if(user === currentUser && typeof _checkMorteLocal === 'function') _checkMorteLocal();
  if(typeof renderStatusMestrePanel === 'function') renderStatusMestrePanel();
  toast(`☠ Morte declarada para ${c.nome || user}.`, '#cc2244');
}

/* Estabiliza um agente "morrendo" — ele volta a 'vivo' com 1 PV,
   sem passar pela morte. Útil quando ninguém curou a tempo pelo
   próprio botão, mas o Mestre decide que ele sobrevive mesmo assim. */
function estabilizarAgente(user){
  if(!isMestre || !user) return;
  const c = userChar(user);
  const m = _ensureMorteState(c);
  if(m.estado !== 'morrendo') return;
  m.estado = 'vivo';
  if((c.pv||0) <= 0) c.pv = 1;
  saveDB();
  if(typeof _publishMyStatus === 'function' && user === currentUser) _publishMyStatus();
  if(user === currentUser){
    if(typeof _checkMorteLocal === 'function') _checkMorteLocal();
    if(typeof renderStats === 'function') renderStats();
  }
  if(typeof renderStatusMestrePanel === 'function') renderStatusMestrePanel();
  toast(`✚ ${c.nome || user} foi estabilizado — segue vivo, por pouco.`, '#22cc66');
}

/* ══════════════════════════════════════════════════════════════
   ABA ☠ STATUS (Mestre) — visão de quem está vivo, morrendo, morto
   ══════════════════════════════════════════════════════════════ */
function renderStatusMestrePanel(){
  if(!isMestre) return;
  const panel = document.getElementById('status-mestre-panel');
  if(!panel) return;

  const usuarios = Object.keys(db.characters || {});
  const vivos    = usuarios.filter(u => _ensureMorteState(db.characters[u]).estado === 'vivo');
  const morrendo = usuarios.filter(u => _ensureMorteState(db.characters[u]).estado === 'morrendo');
  const mortos   = usuarios.filter(u => _ensureMorteState(db.characters[u]).estado === 'morto');

  const linha = (u, corDot, extra) => {
    const c = db.characters[u];
    const nome = c.nome || u;
    const souEu = u === currentUser;
    const pv = c.pv||0, pvMax = c.pvMax||10;
    return `<div style="display:flex;align-items:center;gap:8px 10px;padding:8px 0;border-bottom:1px solid rgba(139,0,0,0.2);flex-wrap:wrap">
      <span style="width:8px;height:8px;border-radius:50%;background:${corDot};flex-shrink:0"></span>
      <span style="flex:1;font-family:'Cinzel',serif;font-size:12.5px;color:var(--white-bone)">${nome}${souEu?' <span style="opacity:.6;font-size:10px">(você)</span>':''}</span>
      <span style="font-family:'Courier Prime',monospace;font-size:11px;color:var(--white-dust)">${pv}/${pvMax} PV</span>
      ${extra||''}
    </div>`;
  };

  panel.innerHTML = `
    <div class="panel" style="border-color:rgba(34,204,102,0.35)">
      <div class="panel-title" style="color:#22cc66">● Vivos (${vivos.length})</div>
      ${vivos.length ? vivos.map(u=>linha(u,'#22cc66')).join('') : '<div style="font-family:\'Courier Prime\',monospace;font-size:12px;color:#3a3020">Nenhum agente registrado.</div>'}
    </div>
    <div class="panel" style="border-color:rgba(204,119,0,0.45)">
      <div class="panel-title" style="color:#cc7700">◉ Morrendo (${morrendo.length})</div>
      ${morrendo.length ? morrendo.map(u=>linha(u,'#cc7700',`
        <div style="display:flex;gap:6px">
          <button class="noir-btn" style="border-color:rgba(34,204,102,0.5);color:#22cc66" onclick="estabilizarAgente('${u}')">✚ Estabilizar</button>
          <button class="noir-btn danger" onclick="declararMorte('${u}')">☠ Declarar Morte</button>
        </div>
      `)).join('') : '<div style="font-family:\'Courier Prime\',monospace;font-size:12px;color:#3a3020">Ninguém morrendo no momento.</div>'}
    </div>
    <div class="panel" style="border-color:rgba(204,34,68,0.4)">
      <div class="panel-title" style="color:#cc2244">☠ Mortos (${mortos.length})</div>
      ${mortos.length ? mortos.map(u=>{
        const m = _ensureMorteState(db.characters[u]);
        return linha(u,'#cc2244', m.liberado
          ? '<span style="font-family:\'Courier Prime\',monospace;font-size:10px;color:#cc8822;letter-spacing:.06em">Escolha liberada — aguardando decisão</span>'
          : `<button class="noir-btn accent" onclick="_liberarEscolhaMorte('${u}')">Liberar Escolha</button>`);
      }).join('') : '<div style="font-family:\'Courier Prime\',monospace;font-size:12px;color:#3a3020">Nenhum agente morto no momento.</div>'}
    </div>
  `;
}

/* Garante que o painel renderize junto com populateMestre (encadeia
   com o hook já existente do sistema de Existido, se houver) */
(function(){
  const _prevPopulateMestre = typeof populateMestre !== 'undefined' ? populateMestre : null;
  if(_prevPopulateMestre){
    populateMestre = function(){
      _prevPopulateMestre();
      renderStatusMestrePanel();
    };
  }
})();

/* Garante checagem de morte assim que o jogador loga/recarrega
   a página (encadeia com hooks já existentes de loginAs) */
(function(){
  const _prevLoginAs = typeof loginAs !== 'undefined' ? loginAs : null;
  if(_prevLoginAs){
    loginAs = function(user, roleFlag, skipDB){
      _prevLoginAs(user, roleFlag, skipDB);
      const statusTab = document.getElementById('tab-status-btn');
      if(statusTab) statusTab.style.display = isMestre ? '' : 'none';
      if(isMestre && typeof renderStatusMestrePanel === 'function') renderStatusMestrePanel();
      if(typeof _checkMorteLocal === 'function') _checkMorteLocal();
      if(typeof _checkTemaElementoLocal === 'function') _checkTemaElementoLocal();
    };
  }
})();

/* ══════════════════════════════════════════════════════════════
   TEMA VISUAL POR ELEMENTO — quando o agente vira uma Criatura
   Paranormal, apenas as cores DE BASE do site mudam pro clima do
   elemento (fundo geral, barra de abas e cor padrão das letras):
   ex. Sangue = vermelho e preto, Energia = roxo/azul...
   IMPORTANTE: isso troca só um punhado de variáveis CSS (--bg-*,
   --white-*, --crimson*, --topbar-bg) — de propósito NÃO usa
   filtro/blend-mode por cima da tela inteira, porque isso apagava
   as cores próprias de elementos, raridade de itens e criaturas,
   que precisam continuar se destacando normalmente.
   ══════════════════════════════════════════════════════════════ */
const ELEMENTO_TEMAS = {
  sangue: {
    '--bg-void':'#0d0000','--bg-deep':'#150000','--bg-dark':'#1c0000','--bg-mid':'#260000','--bg-panel':'#0a0000',
    '--white-dim':'#f5e0e0','--white-bone':'#dbb8b8','--white-ash':'#a87070','--white-dust':'#7a4040',
    '--crimson':'#dd0000','--crimson-mid':'#ff2222','--crimson-hot':'#ff4444',
    '--blood':'#a30000','--blood-deep':'#5c0000','--maroon':'#3a0000','--wine':'#8b0020','--wine-light':'#b8003a',
    '--border-blood':'rgba(221,0,0,0.5)',
    '--topbar-bg':'rgba(13,0,0,0.97)'
  },
  morte: {
    '--bg-void':'#0d0018','--bg-deep':'#14001f','--bg-dark':'#1a0028','--bg-mid':'#220033','--bg-panel':'#0a0012',
    '--white-dim':'#ece0f5','--white-bone':'#c9b8db','--white-ash':'#9a80b8','--white-dust':'#6b5490',
    '--crimson':'#5940bf','--crimson-mid':'#7a5cd6','--crimson-hot':'#9977ff',
    '--blood':'#4a2f8f','--blood-deep':'#2a1a5c','--maroon':'#1c1040','--wine':'#3d1f6e','--wine-light':'#5a3898',
    '--border-blood':'rgba(89,64,191,0.5)',
    '--topbar-bg':'rgba(13,0,24,0.97)'
  },
  energia: {
    '--bg-void':'#0f0022','--bg-deep':'#15002e','--bg-dark':'#1a0040','--bg-mid':'#26005a','--bg-panel':'#0a0018',
    '--white-dim':'#e8dcff','--white-bone':'#c9a8f0','--white-ash':'#9c78d6','--white-dust':'#6a4aa0',
    '--crimson':'#a60df2','--crimson-mid':'#cc55ff','--crimson-hot':'#e070ff',
    '--blood':'#7a1fc9','--blood-deep':'#4a1080','--maroon':'#2e0a52','--wine':'#5c1499','--wine-light':'#8a3fd6',
    '--border-blood':'rgba(166,13,242,0.5)',
    '--topbar-bg':'rgba(15,0,34,0.97)'
  },
  conhecimento: {
    '--bg-void':'#140f00','--bg-deep':'#1c1500','--bg-dark':'#241a00','--bg-mid':'#302200','--bg-panel':'#0f0b00',
    '--white-dim':'#faf0d8','--white-bone':'#e0cc94','--white-ash':'#b89a54','--white-dust':'#8a7030',
    '--crimson':'#c8a000','--crimson-mid':'#e0b800','--crimson-hot':'#ffdd44',
    '--blood':'#8a6a00','--blood-deep':'#5c4700','--maroon':'#3a2e00','--wine':'#6e5400','--wine-light':'#a37f00',
    '--border-blood':'rgba(200,160,0,0.5)',
    '--topbar-bg':'rgba(20,15,0,0.97)'
  },
  medo: {
    '--bg-void':'#000814','--bg-deep':'#00101f','--bg-dark':'#001529','--bg-mid':'#001c38','--bg-panel':'#000610',
    '--white-dim':'#dceaff','--white-bone':'#a8c8f0','--white-ash':'#7098d0','--white-dust':'#4a6ca0',
    '--crimson':'#0053bb','--crimson-mid':'#2a70d6','--crimson-hot':'#3388ff',
    '--blood':'#003a8a','--blood-deep':'#00224f','--maroon':'#001630','--wine':'#002d6e','--wine-light':'#0044a3',
    '--border-blood':'rgba(0,83,187,0.5)',
    '--topbar-bg':'rgba(0,8,20,0.97)'
  }
};

/* Aplica as variáveis do elemento na raiz do documento */
function _aplicarTemaElemento(elemId){
  const tema = ELEMENTO_TEMAS[elemId] || ELEMENTO_TEMAS.morte;
  const root = document.documentElement.style;
  Object.keys(tema).forEach(k => root.setProperty(k, tema[k]));
}

/* Remove as variáveis do elemento (volta ao visual padrão da mesa) */
function _removerTemaElemento(){
  const root = document.documentElement.style;
  const todasVars = new Set();
  Object.values(ELEMENTO_TEMAS).forEach(tema => Object.keys(tema).forEach(k => todasVars.add(k)));
  todasVars.forEach(k => root.removeProperty(k));
}

/* Verifica, para quem está logado agora (jogador ou Mestre), se
   deve estar com o tema elemental ativo — chamado no login e a
   cada ciclo de sincronização, para refletir tanto a própria
   transformação quanto uma eventual reversão (reencarnação). */
function _checkTemaElementoLocal(){
  if(!currentUser) return;
  const c = userChar(currentUser);
  _ensureClasseCriaturaOption();
  if(c.conds && c.conds.criaturaParanormal && c.criaturaElemento){
    _aplicarTemaElemento(c.criaturaElemento);
  } else {
    _removerTemaElemento();
  }
}
