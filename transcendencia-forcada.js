/* ════════════════════════════════════════════════════════════
   TRANSCENDENCIA-FORCADA.JS — Transcendência Forçada (rework)
   ────────────────────────────────────────────────────────────
   Quando o agente atinge o nível mínimo (padrão 15), o Outro Lado
   força a passagem: uma cutscene abre e UM ritual de 1º círculo é
   desbloqueado de forma permanente. Independe da Transcendência
   "de verdade" (liberada pelo Mestre, sem nível mínimo — app.js).
   Acontece UMA ÚNICA VEZ por personagem: depois de concluída (ou de
   registrada no histórico) não volta a ser oferecida — nem pelo Mestre.

   FLUXO
     intro (cutscene) → escolha → confirmação (segurar) → selo
   MODOS (definidos pelo Mestre — aba Mestre › Transcendência)
     livre    — o agente escolhe elemento e ritual
     oferta   — ELE oferece 3 rituais de elementos diferentes
     sorteio  — ELE escolhe sozinho (roleta)
   EXTRAS
     · "Agora não": adia até o fim da sessão do navegador (o Mestre
       pode desativar). Um chip "ELE aguarda" fica na tela.
     · Marca no painel da aba Rituais (selo ou chamado pendente).
     · Mestre pode ligar/desligar, mudar o nível mínimo e o modo e
       forçar o evento num agente que ainda não o viveu.

   DADOS
     personagem  c.transForcada = { concluida, ritual, elemento, ts,
                   modo, pendente, oferta[], forcado, usada,
                   forcarVisto }
     Mestre      db.mestre.transForcada = { ativo, nivel, modo, adiar,
                   forcar:{usuario:ts}, reset:{} (legado, ignorado) }
       "forcar" é um carimbo: o cliente do agente compara com
       forcarVisto e age uma única vez. Assim o Mestre nunca
       escreve na ficha de outra pessoa (evita corrida de sincronização).

   Carregado depois de app.js (usa db, currentUser, userChar, saveDB,
   toast, RITUAIS_DB, _RITUAIS_OFICIAIS, TRANSCENDENCIA_ELEMENTOS).
   Chamado por app.js via _checkTransForcadaTrigger().
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const OV_ID = '_tf_overlay';
const CHIP_ID = '_tf_chip';
const HOLD_MS = 1400;
const reduzido = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ───────────── utilidades ───────────── */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = arr.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nivelDe = c => (window.Nivel ? Nivel.de(c) : 1);

const MODOS = {
  livre:   {rot:'Livre',   desc:'O agente escolhe o elemento e o ritual.'},
  oferta:  {rot:'Oferta',  desc:'ELE oferece 3 rituais de elementos diferentes; o agente fica com um.'},
  sorteio: {rot:'Sorteio', desc:'ELE escolhe sozinho, por roleta.'},
};

/* ───────────── configuração do Mestre ───────────── */
const CFG_PADRAO = {ativo:true, nivel:15, modo:'livre', adiar:true};
function tfCfg(){
  const raw = (typeof db !== 'undefined' && db.mestre && db.mestre.transForcada) || {};
  const c = Object.assign({}, CFG_PADRAO, raw);
  c.forcar = Object.assign({}, raw.forcar);
  c.reset = Object.assign({}, raw.reset);
  c.nivel = Math.min(99, Math.max(1, parseInt(c.nivel, 10) || CFG_PADRAO.nivel));
  if(!MODOS[c.modo]) c.modo = CFG_PADRAO.modo;
  return c;
}
function tfCfgSet(patch){
  if(!db.mestre) db.mestre = {notes:'', playerNotes:{}, messages:[], fichasRecebidas:{}};
  db.mestre.transForcada = Object.assign(tfCfg(), patch);
}

/* ───────────── estado do personagem ───────────── */
function ensure(c){
  if(!c.transForcada || typeof c.transForcada !== 'object') c.transForcada = {};
  const t = c.transForcada;
  if(t.concluida === undefined) t.concluida = false;
  if(!('ritual' in t)) t.ritual = null;
  if(!('elemento' in t)) t.elemento = null;
  return t;
}

// Já viveu a Transcendência Forçada? Olha o estado E o histórico, para que
// um reset de ficha/sincronização não permita repetir o evento.
function jaUsou(c, tf){
  if(tf && (tf.concluida || tf.usada)) return true;
  return Array.isArray(c.transcendenciaHistorico) && c.transcendenciaHistorico.some(h => h && h.forcada);
}

const oficiais = () => (typeof _RITUAIS_OFICIAIS === 'function' ? _RITUAIS_OFICIAIS() : RITUAIS_DB.filter(r => !r._custom));
const pool = c => { const ap = c.rituaisAprendidos || {}; return oficiais().filter(r => r.circ === 1 && !ap[r.nome]); };
const ritualPorNome = n => oficiais().find(r => r.nome === n && r.circ === 1);

function elemData(nome){
  const base = {nome, cor:'#999999', corGlow:'#cccccc', simbolo:'', corFundo:null};
  if(typeof TRANSCENDENCIA_ELEMENTOS === 'undefined') return base;
  const id = Object.keys(TRANSCENDENCIA_ELEMENTOS).find(k => TRANSCENDENCIA_ELEMENTOS[k].nome === nome);
  return id ? TRANSCENDENCIA_ELEMENTOS[id] : base;
}
const simbolo = ed => ed.simbolo ? `<span class="sym-el ${esc(ed.simbolo)}" aria-hidden="true"></span>` : '';

/* ───────────── sorteio da oferta ───────────── */
function gerarOferta(c, modo){
  const p = pool(c);
  const porElem = {};
  p.forEach(r => (porElem[r.elem] = porElem[r.elem] || []).push(r));
  const elems = Object.keys(porElem);
  if(!elems.length) return [];
  if(modo === 'sorteio') return [pick(porElem[pick(elems)]).nome];   // elemento uniforme, depois ritual
  const out = shuffle(elems).slice(0, 3).map(e => pick(porElem[e]).nome);
  while(out.length < Math.min(3, p.length)){ const r = pick(p); if(out.indexOf(r.nome) < 0) out.push(r.nome); }
  return out;
}

/* ═════════════════════ GATILHO ═════════════════════ */
const chaveAdiar = () => '_tf_adiar_' + currentUser;
const adiado = () => { try{ return sessionStorage.getItem(chaveAdiar()) === '1'; }catch(e){ return false; } };
const setAdiado = v => { try{ v ? sessionStorage.setItem(chaveAdiar(), '1') : sessionStorage.removeItem(chaveAdiar()); }catch(e){} };

function elegivel(c, tf, cfg){
  return !!tf.forcado || (cfg.ativo && nivelDe(c) >= cfg.nivel);
}

let _espera = 0;
function esperar(){ if(_espera) return; _espera = setTimeout(() => { _espera = 0; checar(); }, 4000); }

function checar(){
  if(typeof currentUser === 'undefined' || !currentUser || typeof db === 'undefined' || !db.characters) return;
  const c = userChar(currentUser), tf = ensure(c), cfg = tfCfg();
  let mudou = false;

  // Uma única vez: se já viveu (estado ou histórico), trava de forma permanente
  if(jaUsou(c, tf) && !(tf.concluida && tf.usada)){
    tf.concluida = true; tf.usada = true; tf.pendente = false; tf.forcado = false;
    mudou = true;
  }
  // a reabertura pelo Mestre não existe mais: consome o carimbo antigo sem desfazer nada
  const rs = cfg.reset && cfg.reset[currentUser];
  if(rs && rs !== tf.resetVisto){ tf.resetVisto = rs; mudou = true; }
  const t = tf;

  // evento forçado pelo Mestre (só para quem ainda não viveu o evento)
  const fc = cfg.forcar[currentUser];
  if(fc && fc !== t.forcarVisto){
    t.forcarVisto = fc;
    if(!jaUsou(c, t)) t.forcado = true;
    mudou = true;
  }
  if(mudou) saveDB();

  if(c.morte && c.morte.estado && c.morte.estado !== 'vivo') return;   // quem morreu não é chamado

  if(t.concluida){
    if(document.getElementById(OV_ID) && S.stage !== 'selo') fechar(true);
    tirarChip();
    return;
  }
  if(!elegivel(c, t, cfg)){ tirarChip(); return; }
  if(document.getElementById(OV_ID) || document.getElementById('_trans_overlay') || document.getElementById('_tn_overlay')) return;
  if(document.getElementById('tutorial-agatha-overlay') || document.getElementById('tutorial-samuel-overlay')){
    esperar();                                         // tutorial em andamento: tenta de novo mais tarde
    return;
  }

  if(!pool(c).length){            // já conhece todos os de 1º círculo: nada a arrancar
    t.concluida = true; t.usada = true; t.pendente = false;
    saveDB();
    return;
  }
  if(cfg.adiar && adiado()){ mostrarChip(); return; }
  abrir();
}

/* ═════════════════════ OVERLAY ═════════════════════ */
let S = {};   // estado da sessão da cutscene (zerado a cada abertura)

function abrir(){
  tirarChip();
  const c = userChar(currentUser), tf = ensure(c), cfg = tfCfg();

  if(!tf.pendente || !tf.modo){
    tf.modo = cfg.modo; tf.pendente = true;
    tf.oferta = tf.modo === 'livre' ? null : gerarOferta(c, tf.modo);
    saveDB();
  }
  if(tf.modo !== 'livre'){                      // oferta guardada pode ter ficado inválida (ex.: Mestre liberou um ritual)
    const validos = (tf.oferta || []).filter(n => pool(c).some(r => r.nome === n));
    const esperado = tf.modo === 'sorteio' ? 1 : Math.min(3, pool(c).length);
    if(validos.length < esperado){ tf.oferta = gerarOferta(c, tf.modo); saveDB(); }
  }

  S = {stage:'intro', modo:tf.modo, elem:null, sel:null, busca:'', origem:null, timers:[], raf:0, hold:null,
       cor:'#cc2244', glow:'#ff4466', adiar:cfg.adiar};

  const ov = document.createElement('div');
  ov.id = OV_ID;
  ov.className = 'tf-root';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', '_tf_titulo');
  ov.dataset.stage = 'intro';
  ov.innerHTML = `
    <div class="tf-bg"></div><canvas class="tf-canvas" aria-hidden="true"></canvas><div class="tf-vinheta"></div>
    <div class="tf-corner">
      <button type="button" class="tf-ctl" data-tf="som" aria-pressed="true">Som</button>
      <button type="button" class="tf-ctl" data-tf="pular" hidden>Pular ▶</button>
      <button type="button" class="tf-ctl" data-tf="adiar" hidden>Agora não</button>
    </div>
    <main class="tf-stage" id="_tf_stage" aria-live="polite"></main>`;
  document.body.appendChild(ov);
  S.ov = ov;

  ov.addEventListener('click', aoClicar);
  ov.addEventListener('input', aoDigitar);
  ov.addEventListener('pointerdown', aoPressionar);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => ov.addEventListener(ev, aoSoltar, true));
  S.onKey = aoTecla;
  document.addEventListener('keydown', S.onKey, true);
  document.addEventListener('keyup', aoTeclaSolta, true);

  somLigar();
  particulas();
  requestAnimationFrame(() => ov.classList.add('tf-in'));
  ir('intro');
}

function fechar(imediato){
  const ov = document.getElementById(OV_ID);
  if(!ov) return;
  (S.timers || []).forEach(clearTimeout);
  cancelAnimationFrame(S.raf);
  somDesligar();
  document.removeEventListener('keydown', S.onKey, true);
  document.removeEventListener('keyup', aoTeclaSolta, true);
  if(S.onResize) window.removeEventListener('resize', S.onResize);
  S.ov = null;
  if(imediato){ ov.remove(); return; }
  ov.classList.remove('tf-in'); ov.classList.add('tf-out');
  setTimeout(() => ov.remove(), 950);
}

/* troca de etapa */
function ir(stage){
  const ov = S.ov; if(!ov) return;
  S.stage = stage;
  ov.dataset.stage = stage;
  const box = ov.querySelector('#_tf_stage');
  const html = {intro:vIntro, elemento:vElemento, lista:vLista, oferta:vOferta, sorteio:vSorteio, confirmar:vConfirmar, selo:vSelo}[stage]();
  box.innerHTML = html;
  const pular = ov.querySelector('[data-tf="pular"]'), adiar = ov.querySelector('[data-tf="adiar"]');
  pular.hidden = stage !== 'intro';
  adiar.hidden = !(S.adiar && stage !== 'selo');
  if(stage === 'intro') narrar();
  if(stage === 'sorteio' || stage === 'confirmar' || stage === 'selo' || stage === 'lista' || stage === 'oferta' || stage === 'elemento'){
    const f = box.querySelector('[data-foco]') || box.querySelector('button, input');
    if(f) setTimeout(() => { try{ f.focus({preventScroll:true}); }catch(e){} }, 60);
  }
}

function cor(ed){
  S.cor = ed.cor; S.glow = ed.corGlow;
  if(S.ov){
    S.ov.style.setProperty('--tf-cor', ed.cor);
    S.ov.style.setProperty('--tf-glow', ed.corGlow);
    const bg = S.ov.querySelector('.tf-bg');
    if(bg && ed.corFundo) bg.style.background = ed.corFundo;
  }
}
function corPadrao(){
  S.cor = '#cc2244'; S.glow = '#ff4466';
  if(S.ov){
    S.ov.style.setProperty('--tf-cor', '#cc2244'); S.ov.style.setProperty('--tf-glow', '#ff4466');
    const bg = S.ov.querySelector('.tf-bg'); if(bg) bg.style.background = '';
  }
}

/* ───────────── intro ───────────── */
function linhasIntro(){
  const nivel = nivelDe(userChar(currentUser));
  const fim = {
    livre:   '…e, dessa vez, ELE deixa você escolher qual.',
    oferta:  '…ELE estende três mãos. Você só pode segurar uma.',
    sorteio: '…e ELE já escolheu qual.',
  }[S.modo];
  return [
    `NÍVEL ${nivel}.`,
    'Você nunca chamou.',
    'Mas o Outro Lado já aprendeu o seu cheiro.',
    'Algo se agarra a você — frio, paciente, antigo.',
    'O Rei Carmesim não pede. ELE cobra.',
    'A membrana cede, e um segredo é arrancado de dentro de você…',
    fim,
  ];
}
function rasurar(t){
  return typeof _rascarReiCarmesim === 'function' ? _rascarReiCarmesim(t) : esc(t);
}
function vIntro(){
  corPadrao();
  const ed = elemData('Sangue');
  return `<div class="tf-view tf-intro">
    <div class="tf-sym">${simbolo(ed)}</div>
    <div class="tf-linha" id="_tf_linha" role="status"></div>
    <div class="tf-pontos" id="_tf_pontos" aria-hidden="true">${linhasIntro().map(() => '<i></i>').join('')}</div>
    <h2 id="_tf_titulo" class="tf-titulo" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Transcendência Forçada</h2>
  </div>`;
}
function narrar(){
  const linhas = linhasIntro();
  let i = 0;
  const el = () => document.getElementById('_tf_linha');
  const pontos = () => document.querySelectorAll('#_tf_pontos i');
  function passo(){
    const l = el(); if(!l || S.stage !== 'intro') return;
    if(i >= linhas.length){ S.timers.push(setTimeout(avancarDaIntro, 1100)); return; }
    l.classList.remove('on');
    S.timers.push(setTimeout(() => {
      const l2 = el(); if(!l2 || S.stage !== 'intro') return;
      l2.innerHTML = rasurar(linhas[i]);
      pontos().forEach((p, k) => p.classList.toggle('on', k <= i));
      i++;
      void l2.offsetWidth;
      l2.classList.add('on');
      S.timers.push(setTimeout(passo, 2500));
    }, 700));
  }
  S.timers.push(setTimeout(passo, 600));
}
function avancarDaIntro(){
  (S.timers || []).forEach(clearTimeout); S.timers = [];
  ir({livre:'elemento', oferta:'oferta', sorteio:'sorteio'}[S.modo] || 'elemento');
}

/* ───────────── cabeçalho comum ───────────── */
const cab = (titulo, sub) => `
  <div class="tf-eyebrow">⛧ Transcendência Forçada · 1º círculo ⛧</div>
  <h2 id="_tf_titulo" class="tf-titulo">${titulo}</h2>
  ${sub ? `<p class="tf-sub">${sub}</p>` : ''}`;

/* ───────────── escolha de elemento (modo livre) ───────────── */
function vElemento(){
  corPadrao();
  const c = userChar(currentUser), p = pool(c);
  const por = {};
  p.forEach(r => por[r.elem] = (por[r.elem] || 0) + 1);
  const cards = Object.keys(por).map(nome => {
    const ed = elemData(nome);
    return `<button type="button" class="tf-elem" style="--c:${esc(ed.cor)};--g:${esc(ed.corGlow)}" data-tf="elem" data-e="${esc(nome)}">
      ${simbolo(ed)}<b>${esc(nome)}</b><span>${por[nome]} ritua${por[nome] === 1 ? 'l' : 'is'}</span></button>`;
  }).join('');
  return `<div class="tf-view">
    ${cab('Por onde ELE entra?', 'A membrana rasgou em algum lugar dentro de você. Escolha o elemento do segredo que será arrancado — depois, o ritual. <b>A escolha é permanente.</b>')}
    <div class="tf-elems">${cards}</div></div>`;
}

/* ───────────── lista de rituais de um elemento ───────────── */
function detalhe(r, ed){
  return `<div class="tf-det">
    <div class="tf-tags">
      <span class="tf-tag"><b>${esc(r.pe)} PE</b></span>
      ${r.exec ? `<span class="tf-tag">Execução: <b>${esc(r.exec)}</b></span>` : ''}
      ${r.alcance ? `<span class="tf-tag">Alcance: <b>${esc(r.alcance)}</b></span>` : ''}
      ${r.alvo ? `<span class="tf-tag">Alvo: <b>${esc(r.alvo)}</b></span>` : ''}
      ${r.dur ? `<span class="tf-tag">Duração: <b>${esc(r.dur)}</b></span>` : ''}
      ${r.resist && r.resist !== '—' ? `<span class="tf-tag">Resistência: <b>${esc(r.resist)}</b></span>` : ''}
    </div>
    <p class="tf-efeito">${esc(r.efeito)}</p>
    ${r.disc && r.disc !== '—' ? `<p class="tf-var"><em>Discente</em> ${esc(r.disc)}</p>` : ''}
    ${r.verd && r.verd !== '—' ? `<p class="tf-var"><em>Verdadeiro</em> ${esc(r.verd)}</p>` : ''}
  </div>`;
}
function itensLista(){
  const c = userChar(currentUser), ed = elemData(S.elem);
  const q = norm(S.busca);
  const lst = pool(c).filter(r => r.elem === S.elem && (!q || norm(r.nome).indexOf(q) >= 0 || norm(r.efeito).indexOf(q) >= 0))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    n: lst.length,
    html: lst.length ? lst.map(r => {
      const sel = S.sel === r.nome;
      return `<div class="tf-rit${sel ? ' is-sel' : ''}">
        <button type="button" class="tf-rit-hd" data-tf="sel" data-r="${esc(r.nome)}" aria-expanded="${sel}">
          <b>${esc(r.nome)}</b><span>${esc(r.pe)} PE</span></button>
        <div class="tf-rit-bd">${sel ? detalhe(r, ed) + `<button type="button" class="tf-btn" data-tf="escolher" data-r="${esc(r.nome)}" style="margin-top:12px">⛧ Escolher este ritual</button>` : ''}</div>
      </div>`;
    }).join('') : '<div class="tf-vazio">Nenhum ritual encontrado.</div>',
  };
}
function vLista(){
  const ed = elemData(S.elem); cor(ed);
  const it = itensLista();
  return `<div class="tf-view" style="min-height:0">
    ${cab(esc(S.elem), 'Escolha o ritual que ELE arranca de você.')}
    <div class="tf-barra">
      <button type="button" class="tf-back" data-tf="voltar-elem">← Elementos</button>
      <input type="search" class="tf-busca" id="_tf_busca" placeholder="Buscar por nome ou efeito…" autocomplete="off" value="${esc(S.busca)}" aria-label="Buscar ritual">
      <span class="tf-cont" id="_tf_cont">${it.n} ritua${it.n === 1 ? 'l' : 'is'}</span>
    </div>
    <div class="tf-lista" id="_tf_lista">${it.html}</div></div>`;
}
function pintarLista(){
  const l = document.getElementById('_tf_lista'); if(!l) return;
  const it = itensLista();
  l.innerHTML = it.html;
  const n = document.getElementById('_tf_cont'); if(n) n.textContent = `${it.n} ritua${it.n === 1 ? 'l' : 'is'}`;
}

/* ───────────── oferta (3 cartas) ───────────── */
function cartaRitual(r, rotulo){
  const ed = elemData(r.elem);
  return `<article class="tf-carta" style="--c:${esc(ed.cor)};--g:${esc(ed.corGlow)};--tf-cor:${esc(ed.cor)}">
    <div class="tf-carta-hd">${simbolo(ed)}<div><small>${esc(r.elem)}${rotulo ? ' · ' + esc(rotulo) : ''}</small><b>${esc(r.nome)}</b></div></div>
    <button type="button" class="tf-btn" data-tf="escolher" data-r="${esc(r.nome)}">⛧ Ficar com este</button>
    ${detalhe(r, ed)}
  </article>`;
}
function vOferta(){
  corPadrao();
  const tf = ensure(userChar(currentUser));
  const rs = (tf.oferta || []).map(ritualPorNome).filter(Boolean);
  return `<div class="tf-view" style="min-height:0">
    ${cab('ELE estende três mãos', 'Cada uma segura um segredo de natureza diferente. Você só pode apertar uma. <b>A escolha é permanente.</b>')}
    <div class="tf-cartas">${rs.map(r => cartaRitual(r)).join('')}</div></div>`;
}

/* ───────────── sorteio (roleta) ───────────── */
function vSorteio(){
  corPadrao();
  return `<div class="tf-view" style="justify-content:center">
    ${cab('ELE já escolheu', 'Não há o que decidir. Só há o que encarar.')}
    <div class="tf-roleta" id="_tf_roleta" aria-live="polite">?</div>
    <div class="tf-resultado" id="_tf_res"></div>
    <button type="button" class="tf-btn is-big" id="_tf_girar" data-tf="girar" data-foco>⛧ Encarar ⛧</button>
  </div>`;
}
function girar(){
  const c = userChar(currentUser), tf = ensure(c);
  const alvo = ritualPorNome((tf.oferta || [])[0]);
  const btn = document.getElementById('_tf_girar'), el = document.getElementById('_tf_roleta');
  if(!alvo || !el || !btn) return;
  btn.hidden = true;
  const nomes = oficiais().filter(r => r.circ === 1).map(r => r.nome);
  const total = reduzido() ? 0 : 2800;
  const t0 = Date.now();
  el.classList.add('is-girando');
  let atraso = 55;
  const passo = () => {
    if(S.stage !== 'sorteio' || !document.getElementById('_tf_roleta')) return;
    const dec = Date.now() - t0;
    if(dec >= total){
      el.classList.remove('is-girando');
      el.textContent = alvo.nome;
      cor(elemData(alvo.elem));
      const ed = elemData(alvo.elem);
      document.getElementById('_tf_res').innerHTML = `${detalhe(alvo, ed)}
        <button type="button" class="tf-btn is-big" data-tf="aceitar" data-r="${esc(alvo.nome)}" data-foco style="margin-top:8px">⛧ Aceitar ⛧</button>`;
      const f = document.querySelector('#_tf_res [data-foco]'); if(f) f.focus({preventScroll:true});
      return;
    }
    el.textContent = pick(nomes);
    atraso = Math.min(420, atraso * 1.09);
    S.timers.push(setTimeout(passo, atraso));
  };
  passo();
}

/* ───────────── confirmação: segurar para selar ───────────── */
function vConfirmar(){
  const r = ritualPorNome(S.sel); if(!r) return vElemento();
  const ed = elemData(r.elem); cor(ed);
  return `<div class="tf-view" style="min-height:0;overflow-y:auto">
    ${cab('Selar o segredo', '')}
    <div class="tf-selo-box">
      <div class="tf-carta-hd" style="--c:${esc(ed.cor)};--g:${esc(ed.corGlow)}">${simbolo(ed)}<div><small style="color:${esc(ed.cor)}">${esc(r.elem)}</small><b style="font-size:22px;font-family:'IM Fell English SC',serif;font-weight:400;color:#f0e4de">${esc(r.nome)}</b></div></div>
      ${detalhe(r, ed)}
    </div>
    <p class="tf-aviso">Esta escolha é permanente. Só o Mestre pode desfazê-la.</p>
    <button type="button" class="tf-segure" data-tf-hold="${esc(r.nome)}" data-foco aria-label="Segure para selar ${esc(r.nome)}"><span>Segure para selar</span></button>
    <button type="button" class="tf-back" data-tf="voltar">← Voltar</button>
  </div>`;
}
function iniciarHold(btn){
  if(S.hold) return;
  const t0 = performance.now();
  S.hold = {btn, nome:btn.dataset.tfHold};
  const tick = now => {
    if(!S.hold) return;
    const p = Math.min(1, (now - t0) / HOLD_MS);
    btn.style.setProperty('--p', p);
    if(p >= 1){ const n = S.hold.nome; S.hold = null; aplicar(n); return; }
    S.raf = requestAnimationFrame(tick);
  };
  S.raf = requestAnimationFrame(tick);
}
function soltarHold(){
  if(!S.hold) return;
  cancelAnimationFrame(S.raf);
  S.hold.btn.style.setProperty('--p', 0);
  S.hold = null;
}

/* ───────────── aplicar a escolha ───────────── */
function aplicar(nome){
  if(typeof currentUser === 'undefined' || !currentUser) return;
  const c = userChar(currentUser), tf = ensure(c);
  const r = ritualPorNome(nome);
  if(!r || jaUsou(c, tf)) return;
  const agora = new Date().toISOString();
  if(!c.rituaisAprendidos) c.rituaisAprendidos = {};
  c.rituaisAprendidos[r.nome] = true;
  Object.assign(tf, {concluida:true, usada:true, pendente:false, forcado:false, ritual:r.nome, elemento:r.elem, ts:agora, oferta:null});
  if(!c.transcendenciaHistorico) c.transcendenciaHistorico = [];
  c.transcendenciaHistorico.push({ritual:r.nome, ts:agora, forcada:true, elemento:r.elem});
  setAdiado(false);
  saveDB();
  toast(`⛧ Transcendência Forçada — ${r.nome} (${r.elem}) desbloqueado!`, elemData(r.elem).cor);
  S.sel = r.nome;
  if(typeof renderRituaisTab === 'function') renderRituaisTab();
  if(typeof renderTranscendenciaPanel === 'function') renderTranscendenciaPanel();
  if(S.ov) ir('selo');
}

/* ───────────── selo final ───────────── */
function vSelo(){
  const r = ritualPorNome(S.sel) || oficiais().find(x => x.nome === S.sel);
  const ed = elemData(r ? r.elem : 'Sangue'); cor(ed);
  return `<div class="tf-view tf-final">
    <div class="tf-eyebrow">⛧ Selado ⛧</div>
    <div class="tf-sym">${simbolo(ed)}</div>
    <h2 id="_tf_titulo" class="tf-titulo">${esc(r ? r.nome : '')}</h2>
    <p class="tf-sub">ELE agora sabe o seu nome — e você, um pedaço do dele. O ritual já está no seu grimório.</p>
    <div class="tf-resultado">${r ? detalhe(r, ed) : ''}
      <div class="tf-acoes">
        <button type="button" class="tf-btn" data-tf="grimorio">Abrir o grimório</button>
        <button type="button" class="tf-btn" data-tf="fechar" data-foco>Voltar à mesa</button>
      </div></div></div>`;
}

/* ═════════════════════ EVENTOS ═════════════════════ */
function aoClicar(e){
  const el = e.target.closest('[data-tf]');
  if(!el) return;
  somRetomar();
  const a = el.dataset.tf;
  if(a === 'pular') return avancarDaIntro();
  if(a === 'adiar') return adiar();
  if(a === 'som') return somAlternar(el);
  if(a === 'elem'){ S.elem = el.dataset.e; S.sel = null; S.busca = ''; return ir('lista'); }
  if(a === 'voltar-elem'){ S.sel = null; return ir('elemento'); }
  if(a === 'sel'){ S.sel = S.sel === el.dataset.r ? null : el.dataset.r; pintarLista(); const s = document.querySelector('#_tf_lista .is-sel'); if(s) s.scrollIntoView({block:'nearest'}); return; }
  if(a === 'escolher'){ S.sel = el.dataset.r; S.origem = S.stage; return ir('confirmar'); }
  if(a === 'voltar') return ir(S.origem || 'elemento');
  if(a === 'girar') return girar();
  if(a === 'aceitar') return aplicar(el.dataset.r);
  if(a === 'grimorio'){ fechar(); abrirGrimorio(); return; }
  if(a === 'fechar') return fechar();
}
function aoDigitar(e){
  if(e.target.id === '_tf_busca'){ S.busca = e.target.value; S.sel = null; pintarLista(); }
}
function aoPressionar(e){
  const b = e.target.closest('[data-tf-hold]');
  if(!b) return;
  somRetomar();
  try{ b.setPointerCapture(e.pointerId); }catch(err){}
  iniciarHold(b);
}
function aoSoltar(e){
  if(S.hold && (e.type !== 'pointerleave' || e.target === S.hold.btn)) soltarHold();
}
function aoTecla(e){
  if(!S.ov) return;
  if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); if(S.adiar && S.stage !== 'selo') adiar(); return; }
  if((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-tf-hold]')){
    e.preventDefault();
    if(!e.repeat) iniciarHold(e.target.closest('[data-tf-hold]'));
    return;
  }
  if(e.key === 'Tab'){                                  // prende o foco dentro do overlay
    const f = Array.from(S.ov.querySelectorAll('button:not([hidden]), input')).filter(x => !x.disabled && x.offsetParent !== null);
    if(!f.length) return;
    const i = f.indexOf(document.activeElement);
    if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
    else if(!e.shiftKey && (i === f.length - 1 || i < 0)){ e.preventDefault(); f[0].focus(); }
  }
}
function aoTeclaSolta(e){
  if(e.key === 'Enter' || e.key === ' ') soltarHold();
}

function adiar(){
  if(!S.adiar) return;
  setAdiado(true);
  fechar();
  mostrarChip();
  toast('ELE aguarda. O chamado continua pendente.', '#cc2244');
}
function abrirGrimorio(){
  try{
    const b = document.querySelector('.tab-btn[onclick*="showTab(\'rituais\'"]');
    if(typeof showTab === 'function') showTab('rituais', b);
  }catch(e){}
}

/* ═════════════════════ CHIP "ELE AGUARDA" ═════════════════════ */
function mostrarChip(){
  if(document.getElementById(CHIP_ID)) return;
  const b = document.createElement('button');
  b.id = CHIP_ID; b.type = 'button';
  b.innerHTML = '⛧ ELE aguarda — responder';
  b.addEventListener('click', () => { setAdiado(false); b.remove(); abrir(); });
  document.body.appendChild(b);
}
function tirarChip(){ const b = document.getElementById(CHIP_ID); if(b) b.remove(); }

/* ═════════════════════ ÁUDIO (batimento) ═════════════════════ */
const somPref = () => { try{ return localStorage.getItem('tf_som') !== '0'; }catch(e){ return true; } };
function thump(ctx, off, vol){
  const t = ctx.currentTime + off;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(36, t + .18);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .32);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .36);
}
function somLigar(){
  const btn = S.ov && S.ov.querySelector('[data-tf="som"]');
  if(btn){ btn.setAttribute('aria-pressed', String(somPref())); btn.textContent = somPref() ? 'Som ligado' : 'Som desligado'; }
  if(!somPref()) return;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    const ctx = new AC();
    S.audio = ctx;
    const bate = () => { if(ctx.state === 'running'){ thump(ctx, 0, .2); thump(ctx, .3, .13); } };
    S.beat = setInterval(bate, 1500);
    bate();
  }catch(e){}
}
function somRetomar(){ if(S.audio && S.audio.state === 'suspended') S.audio.resume().catch(() => {}); }
function somDesligar(){
  clearInterval(S.beat);
  if(S.audio){ try{ S.audio.close(); }catch(e){} S.audio = null; }
}
function somAlternar(btn){
  const on = !somPref();
  try{ localStorage.setItem('tf_som', on ? '1' : '0'); }catch(e){}
  somDesligar();
  if(on) somLigar(); else { btn.setAttribute('aria-pressed', 'false'); btn.textContent = 'Som desligado'; }
}

/* ═════════════════════ PARTÍCULAS ═════════════════════ */
function particulas(){
  if(reduzido()) return;
  const cv = S.ov.querySelector('.tf-canvas'); if(!cv) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;
  const ajustar = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
  ajustar();
  S.onResize = ajustar;
  window.addEventListener('resize', ajustar);
  const nova = (y) => ({x:Math.random() * W, y:y == null ? Math.random() * H : y, vx:(Math.random() - .5) * .5, vy:-(Math.random() * .9 + .2), r:Math.random() * 2.2 + .5, a:Math.random() * .5 + .12});
  const pts = Array.from({length:60}, () => nova());
  const loop = () => {
    if(!document.getElementById(OV_ID) || !S.ov) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = S.glow;
    pts.forEach(p => {
      ctx.globalAlpha = p.a;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.a -= .0022;
      if(p.a <= 0 || p.y < -10) Object.assign(p, nova(H + 6));
    });
    ctx.globalAlpha = 1;
    S.partRaf = requestAnimationFrame(loop);
  };
  loop();
}

/* ═════════════════════ MARCA NA ABA RITUAIS ═════════════════════ */
function pintarMarca(){
  const el = document.getElementById('transcendencia-panel');
  if(!el || typeof currentUser === 'undefined' || !currentUser) return;
  const old = el.querySelector('.tf-marca'); if(old) old.remove();
  const c = userChar(currentUser), tf = ensure(c), cfg = tfCfg();
  let html = '';
  if(tf.concluida && tf.ritual){
    const ed = elemData(tf.elemento);
    const data = tf.ts ? new Date(tf.ts).toLocaleDateString('pt-BR') : '';
    html = `<div class="tf-marca" style="--tf-m:${esc(ed.cor)}">${simbolo(ed)}
      <div class="tf-marca-tx"><b>⛧ Transcendência Forçada</b>Selo: <em>${esc(tf.ritual)}</em> (${esc(tf.elemento)})${data ? ' · ' + esc(data) : ''}</div></div>`;
  }else if(!tf.concluida && elegivel(c, tf, cfg) && pool(c).length){
    html = `<div class="tf-marca"><div class="tf-marca-tx"><b>⛧ Transcendência Forçada</b>ELE ainda aguarda a sua resposta.</div>
      <button type="button" data-tf-marca="abrir">Responder ao chamado</button></div>`;
  }
  if(html) el.insertAdjacentHTML('beforeend', html);
}
document.addEventListener('click', e => {
  if(e.target.closest && e.target.closest('[data-tf-marca="abrir"]')){ setAdiado(false); if(!document.getElementById(OV_ID)){ tirarChip(); abrir(); } }
});
if(typeof window.renderTranscendenciaPanel === 'function'){
  const orig = window.renderTranscendenciaPanel;
  window.renderTranscendenciaPanel = function(){
    const r = orig.apply(this, arguments);
    try{ pintarMarca(); }catch(err){ console.error('[TransForçada] marca', err); }
    return r;
  };
}

/* ═════════════════════ API PÚBLICA ═════════════════════ */
window.TFUI = {esc, norm, elemData, simbolo, detalhe, rasurar, oficiais, pick, reduzido, pintarMarca};
window._checkTransForcadaTrigger = function(){          // chamado por app.js
  try{ if(window.Nivel) Nivel.processar(); }catch(e){ console.error('[nivel]', e); }   // aplica XP do Mestre antes de checar o nível
  return checar.apply(this, arguments);
};
window.TransForcada = {cfg:tfCfg, setCfg:tfCfgSet, MODOS, elegivel:(c, cfg) => elegivel(c, ensure(c), cfg || tfCfg()), abrir:() => { if(currentUser && !document.getElementById(OV_ID)) abrir(); }};

})();
