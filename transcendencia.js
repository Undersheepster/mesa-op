/* ════════════════════════════════════════════════════════════
   TRANSCENDENCIA.JS — Transcendência comum em GRAUS + ÁRVORE DE AFINIDADE
   (rework v3 — regras e dados em transcendencia-arvore.js)
   ────────────────────────────────────────────────────────────
   Cada liberação do Mestre é uma PASSAGEM:
     Grau I      escolhe o elemento (Marca + ritual de afinidade)
     Grau II–IV  escolhe 1 dádiva na árvore + os segredos do grau
                 (rituais de círculo ≤ grau) — selados juntos, num gesto
     Grau IV concluído → a próxima Passagem abre uma nova faceta
   "Acerto": fichas migradas com dádivas pendentes as escolhem sem
   precisar de nova liberação.

   FLUXO  intro → (elemento | árvore → segredo) → confirmação
          (segurar) → narração do grau → selo
   Também aqui: o painel da aba Transcendência (renderTranscendenciaPanel),
   o visualizador da árvore (transVerArvore) e o ritual de afinidade.
   Substitui transIniciarCutscene / transReviver / renderTranscendenciaPanel /
   usarRitualDeAfinidade de app.js. Depende de transcendencia-forcada.js
   (window.TFUI), transcendencia-arvore.js (window.TransArvore) e transcendencia.css.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const U = window.TFUI, TA = window.TransArvore;
if(!U || !TA || typeof TRANSCENDENCIA_ELEMENTOS === 'undefined') return;
const {esc, norm, simbolo, detalhe, rasurar, reduzido} = U;

const ID = '_tn_overlay', HOLD_MS = 1400, FADE_MS = 950;
const COR_PADRAO = {cor:'#cc2244', glow:'#ff4466'};
let T = {};                                   /* estado da sessão aberta (um objeto novo a cada abrir) */

const char = () => userChar(currentUser);
const ed = e => TA.elemInfo(e);
const liberada = () => !!(db.mestre && db.mestre.transLiberada && db.mestre.transLiberada[currentUser]);
const consumirLiberacao = () => { if(db.mestre && db.mestre.transLiberada) db.mestre.transLiberada[currentUser] = false; };
const grauRot = n => `Grau ${TA.grauInfo(n).rom} · ${TA.grauInfo(n).nome}`;
const usoRot = n => TA.USO[n.uso] + (n.custo ? ' · ' + n.custo : '');
const q = s => (T.ov ? T.ov.querySelector(s) : null);       /* sempre dentro do overlay ATUAL (o antigo pode ainda estar sumindo) */
const rolar = (el, opt) => { if(el && el.scrollIntoView){ try{ el.scrollIntoView(opt); }catch(x){} } };
const oficiaisRit = nome => U.oficiais().find(r => r.nome === nome);

/* ═════════════ abertura / fechamento ═════════════ */
function abrir(opts){
  if(document.getElementById(ID)) return;
  const old = document.getElementById('_trans_overlay'); if(old) old.remove();
  const c = char(), P = opts.passagem || null;
  const a = TA.ativa(c);
  T = {modo:opts.modo || 'passagem', P, fase:P ? P.fase : null, elem:(P && P.elem) || a, grau:(P && P.grau) || 0, stage:'intro',
       sel:null, dadiva:null, segredos:[], nSeg:0, busca:'', circ:'', mapaElem:opts.elem || a,
       timers:[], raf:0, hold:null, cor:COR_PADRAO.cor, glow:COR_PADRAO.glow, pm:'padrao', somOn:opts.modo !== 'mapa', narrando:false, grauSom:0};

  const ov = document.createElement('div');
  ov.id = ID; ov.className = 'tf-root tn-root';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', '_tf_titulo');
  ov.dataset.stage = 'intro';
  ov.innerHTML = `<div class="tf-bg"></div><canvas class="tf-canvas" aria-hidden="true"></canvas><div class="tf-vinheta"></div><div class="tn-flash" aria-hidden="true"></div>
    <div class="tf-corner">
      <button type="button" class="tf-ctl" data-tn="som">Som</button>
      <button type="button" class="tf-ctl" data-tn="pular" hidden>Pular ▶</button>
      <button type="button" class="tf-ctl" data-tn="fechar" aria-label="Fechar">✕</button>
    </div>
    <main class="tf-stage" aria-live="polite"></main>`;
  document.body.appendChild(ov);
  T.ov = ov;
  const ouvir = (alvo, ev, fn, cap) => { alvo.addEventListener(ev, fn, cap); T.off = (T.off || []).concat([() => alvo.removeEventListener(ev, fn, cap)]); };
  ouvir(ov, 'click', aoClicar);
  ouvir(ov, 'input', e => { if(e.target.matches && e.target.matches('[data-tn-busca]')){ T.busca = e.target.value; T.sel = null; pintarLista(); } });
  ouvir(ov, 'pointerdown', e => { const b = e.target.closest && e.target.closest('[data-tn-hold]'); if(b){ retomar(); try{ b.setPointerCapture(e.pointerId); }catch(x){} iniciarHold(b); } });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => ouvir(ov, ev, e => { if(T.hold && (ev !== 'pointerleave' || e.target === T.hold.btn)) soltarHold(); }, true));
  ouvir(document, 'keydown', aoTecla, true);
  ouvir(document, 'keyup', e => { if(e.key === 'Enter' || e.key === ' ') soltarHold(); }, true);
  ouvir(window, 'blur', soltarHold);
  som(); particulas();
  requestAnimationFrame(() => { if(T.ov === ov) ov.classList.add('tf-in'); });

  if(T.modo === 'mapa'){ ir('mapa'); }
  else if(T.modo === 'reviver'){ const e = ed(a); cor(a); ir('narrar', {linhas:e.textos, fim:'fechar', ed:e}); }
  else if(T.fase === 'acerto'){ ir('arvore'); }
  else{
    if(T.fase === 'subir') T.grauSom = T.grau;
    ir('intro');
  }
}
function fechar(){
  const ov = T.ov; if(!ov) return;
  T.timers.forEach(clearTimeout); T.timers = []; cancelAnimationFrame(T.raf); T.narrando = false; T.hold = null;
  clearInterval(T.beat); if(T.audio){ try{ T.audio.close(); }catch(e){} T.audio = null; }
  (T.off || []).forEach(f => f()); T.off = [];
  T.ov = null;
  /* o overlay some aos poucos, mas já não existe para o resto do app: pode-se abrir outro na hora */
  ov.removeAttribute('id'); ov.style.pointerEvents = 'none'; ov.setAttribute('aria-hidden', 'true');
  ov.classList.remove('tf-in'); ov.classList.add('tf-out');
  setTimeout(() => ov.remove(), FADE_MS);
  if(typeof renderTranscendenciaPanel === 'function') renderTranscendenciaPanel();
}

const VIEWS = () => ({intro:vIntro, elemento:vElemento, arvore:vArvore, segredo:vSegredo, confirmar:vConfirmar, narrar:vNarrar, selo:vSelo, mapa:vMapa});
function ir(stage, extra){
  if(!T.ov) return;
  Object.assign(T, extra || {});
  T.stage = stage; T.ov.dataset.stage = stage;
  const box = q('.tf-stage');
  box.innerHTML = VIEWS()[stage]();
  const pular = q('[data-tn="pular"]'); if(pular) pular.hidden = !(stage === 'intro' || stage === 'narrar');
  if(stage === 'intro') narrar(introLinhas(), () => proxima());
  if(stage === 'narrar') narrar(T.linhas, () => T.fim === 'fechar' ? fechar() : ir('selo'));
  box.scrollTop = 0;
  const f = box.querySelector('[data-foco]') || box.querySelector('button, input');
  if(f && stage !== 'intro' && stage !== 'narrar'){ const ov = T.ov; setTimeout(() => { if(T.ov === ov){ try{ f.focus({preventScroll:true}); }catch(e){} } }, 60); }
  if(stage === 'arvore' || stage === 'mapa'){ const l = box.querySelector('.tn-no.is-livre') || box.querySelector('.tn-no.is-tomado:last-of-type'); if(l){ const ov = T.ov; setTimeout(() => { if(T.ov === ov) rolar(l, {block:'center', behavior:reduzido() ? 'auto' : 'smooth'}); }, 120); } }
}
function aplicarCor(d){
  T.cor = d.cor; T.glow = d.corGlow;
  T.pm = Object.keys(TRANSCENDENCIA_ELEMENTOS).find(k => TRANSCENDENCIA_ELEMENTOS[k] === d) || 'padrao';
  T.ov.style.setProperty('--tf-cor', d.cor); T.ov.style.setProperty('--tf-glow', d.corGlow);
  const bg = q('.tf-bg'); if(bg) bg.style.background = d.corFundo || '';
}
function cor(e){
  if(!T.ov) return;
  const d = typeof e === 'string' ? ed(e) : e;
  if(!d) return corPadrao();
  aplicarCor(d);
}
function corPadrao(){
  if(!T.ov) return;
  T.cor = COR_PADRAO.cor; T.glow = COR_PADRAO.glow; T.pm = 'padrao';
  T.ov.style.setProperty('--tf-cor', COR_PADRAO.cor); T.ov.style.setProperty('--tf-glow', COR_PADRAO.glow);
  const bg = q('.tf-bg'); if(bg) bg.style.background = '';
}
const cab = (eyebrow, titulo, sub) => `<div class="tf-eyebrow">⛧ ${eyebrow} ⛧</div>
  <h2 id="_tf_titulo" class="tf-titulo">${titulo}</h2>${sub ? `<p class="tf-sub">${sub}</p>` : ''}`;
const titOculto = '<h2 id="_tf_titulo" class="tf-titulo" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Transcendência</h2>';

/* ═════════════ intro / narração ═════════════ */
function introLinhas(){
  if(T.fase === 'nova'){ const a = TA.ativa(char()); return TA.linhasIntro('nova', {nomeAnterior:TA.nomeDe(a)}); }
  if(T.fase === 'subir') return TA.linhasIntro('subir', {grau:T.grau});
  return TA.linhasIntro('elemento', {});
}
const vIntro = () => { if(T.fase === 'subir') cor(T.elem); else corPadrao();
  return `<div class="tf-view tf-intro"><div class="tf-sym">${simbolo(T.fase === 'subir' ? ed(T.elem) : TA.elemInfo('sangue'))}</div>
  <div class="tf-linha" role="status" data-linha></div><div class="tf-pontos" data-pontos aria-hidden="true"></div>${titOculto}</div>`; };
const vNarrar = () => `<div class="tf-view tf-intro"><div class="tf-sym">${simbolo(T.ed || TA.elemInfo('sangue'))}</div>
  <div class="tf-linha" role="status" data-linha></div><div class="tf-pontos" data-pontos aria-hidden="true"></div>${titOculto}</div>`;

function narrar(linhas, fim){
  T.fimNarr = fim; T.narrando = true;
  const ov = T.ov, vivo = () => T.ov === ov && T.narrando;
  const pts = q('[data-pontos]');
  if(pts) pts.innerHTML = linhas.map(() => '<i></i>').join('');
  const dur = reduzido() ? 1400 : 2500;
  let i = 0;
  const agenda = (fn, ms) => T.timers.push(setTimeout(fn, ms));
  const passo = () => {
    const l = q('[data-linha]'); if(!l || !vivo()) return;
    if(i >= linhas.length){ agenda(() => { if(vivo()){ T.narrando = false; fim(); } }, 1100); return; }
    l.classList.remove('on');
    agenda(() => {
      const l2 = q('[data-linha]'); if(!l2 || !vivo()) return;
      l2.innerHTML = rasurar(linhas[i]);
      ov.querySelectorAll('[data-pontos] i').forEach((p, k) => p.classList.toggle('on', k <= i));
      i++; void l2.offsetWidth; l2.classList.add('on');
      agenda(passo, dur);
    }, 700);
  };
  agenda(passo, 600);
}
function pularNarracao(){
  if(!T.ov) return;
  T.timers.forEach(clearTimeout); T.timers = [];
  if(T.narrando){ T.narrando = false; const f = T.fimNarr; if(f) f(); }
}
function proxima(){
  T.narrando = false;
  ir(T.fase === 'subir' ? 'arvore' : 'elemento');
}

/* ═════════════ escolha de elemento (Grau I) ═════════════ */
function vElemento(){
  corPadrao();
  const c = char(), t = TA.estado(c), nova = T.fase === 'nova';
  const ids = TA.elementos().filter(e => !t.trilhas[e]);
  const cards = ids.map(id => { const e = ed(id), A = TA.ARV[id]; return `
    <button type="button" class="tf-elem tn-elem" style="--c:${esc(e.cor)};--g:${esc(e.corGlow)}" data-tn="elem" data-e="${esc(id)}">
      ${simbolo(e)}<b>${esc(e.nome)}</b>
      <span class="tn-marca-nome">${esc(A.marca.nome)}</span>
      <span class="tn-vias">${esc(A.vias.A.nome)} · ${esc(A.vias.B.nome)}</span>
      <span>${e.ritual_gratis ? '✦ ' + esc(e.ritual_gratis) : 'sem ritual grátis'}</span></button>`; }).join('');
  return `<div class="tf-view">${cab(nova ? 'Nova faceta' : 'Grau I · Limiar', nova ? 'Qual essência você abraça agora?' : 'Qual faceta é a sua?',
    nova ? `ELE abriu outra faceta. Você recomeça no Limiar — e tudo que já conquistou permanece. <b>A escolha é permanente.</b>`
         : 'O Outro Lado te reconhece. Escolha o elemento de afinidade: ele define a Marca que você carrega e a árvore de dádivas que poderá trilhar. <b>A escolha é permanente.</b>')}
    <div class="tf-elems">${cards}</div></div>`;
}

/* ═════════════ a árvore ═════════════ */
const COLS = {2:{A:'1 / span 2', B:'3 / span 2'}, 4:{A:'1 / span 2', B:'3 / span 2'}};
function mapa(e, o){
  o = o || {};
  const c = char(), A = TA.ARV[e], tr = TA.trilha(c, e), via = TA.viaDe(tr), liv = new Set(o.livres || []);
  const itens = [];
  itens.push(`<button type="button" class="tn-no tn-raiz ${tr ? 'is-tomado' : 'is-futuro'}${T.sel === 'marca:' + e ? ' is-sel' : ''}" style="grid-column:1 / span 4" data-tn="no" data-id="marca:${esc(e)}" aria-pressed="${T.sel === 'marca:' + e}">
    <i class="tn-gr">I</i><b>${esc(A.marca.nome)}</b><small>Marca · passiva</small></button>`);
  itens.push(`<div class="tn-via${via === 'B' ? ' is-fora' : ''}" style="grid-column:1 / span 2"><b>${esc(A.vias.A.nome)}</b><small>${esc(A.vias.A.lema)}</small></div>
    <div class="tn-via${via === 'A' ? ' is-fora' : ''}" style="grid-column:3 / span 2"><b>${esc(A.vias.B.nome)}</b><small>${esc(A.vias.B.lema)}</small></div>`);
  [2, 3, 4].forEach(g => {
    const idx = {A:0, B:0};
    A.nos.filter(n => n.grau === g).forEach(n => {
      const tomado = !!(tr && tr.dadivas.indexOf(n.id) >= 0);
      const livre = liv.has(n.id);
      const fora = !tomado && !livre && via && n.via !== via;
      const est = tomado ? 'is-tomado' : livre ? 'is-livre' : fora ? 'is-fora' : 'is-futuro';
      const col = g === 3 ? String((n.via === 'A' ? 1 : 3) + idx[n.via]++) : COLS[g][n.via];
      itens.push(`<button type="button" class="tn-no ${est} tn-v${n.via}${T.sel === n.id ? ' is-sel' : ''}" style="grid-column:${col}" data-tn="no" data-id="${esc(n.id)}" aria-pressed="${T.sel === n.id}">
        <i class="tn-gr">${TA.grauInfo(g).rom}</i><b>${esc(n.nome)}</b><small>${esc(TA.USO[n.uso])}</small></button>`);
    });
  });
  return `<div class="tn-mapa" style="--c:${esc(ed(e).cor)};--g:${esc(ed(e).corGlow)}"><div class="tn-grade">${itens.join('')}</div></div>`;
}
function infoNo(id){
  if(!id) return null;
  if(id.indexOf('marca:') === 0){ const e = id.slice(6); if(!TA.ARV[e]) return null; const m = TA.ARV[e].marca; return {id, nome:m.nome, uso:'passiva', desc:m.desc, grau:1, marca:true, elem:e}; }
  const n = TA.no(id); return n ? Object.assign({elem:id.split('-')[0]}, n) : null;
}
function painelNo(livres){
  const n = infoNo(T.sel);
  if(!n) return `<div class="tn-detalhe is-vazio">Toque em uma dádiva para ler o que ela faz.</div>`;
  const pode = livres && livres.indexOf(n.id) >= 0;
  const via = n.marca ? '' : TA.ARV[n.elem].vias[n.via].nome + ' · ';
  return `<div class="tn-detalhe" role="region" aria-live="polite"><div class="tn-det-hd"><small>${via}${esc(grauRot(n.grau))}</small><b>${esc(n.nome)}</b>
    <span class="tf-tag"><b>${esc(n.marca ? 'Passiva' : usoRot(n))}</b></span></div>
    <p class="tf-efeito">${esc(n.desc)}</p>
    ${pode ? `<button type="button" class="tf-btn" data-tn="escolher-dadiva" data-id="${esc(n.id)}" data-foco>⛧ Escolher esta dádiva</button>` : ''}</div>`;
}
const livresDaArvore = () => (T.stage === 'arvore' ? TA.opcoesDadiva(char(), T.elem, T.grauAlvo).map(n => n.id) : []);
function vArvore(){
  const c = char(), e = T.elem; cor(e);
  const acerto = T.fase === 'acerto';
  const grau = acerto ? TA.proximaDadivaGrau(c, e) : T.grau;
  T.grauAlvo = grau;
  const livres = TA.opcoesDadiva(c, e, grau).map(n => n.id);
  const via = TA.viaDe(TA.trilha(c, e));
  const sub = (grau === 2 || !via) ? 'Escolha uma <b>Via</b>: ela define todas as dádivas dos próximos graus.'
            : `Você trilha a <b>${esc(TA.ARV[e].vias[via].nome)}</b>. Escolha uma das dádivas do ${esc(TA.grauInfo(grau).nome)}.`;
  return `<div class="tf-view tn-arvore">${cab((acerto ? 'Dádiva pendente · ' : '') + grauRot(grau) + ' · ' + esc(ed(e).nome), acerto ? 'ELE ainda guarda uma dádiva' : 'ELE oferece um dom', sub + ' <b>A escolha é permanente.</b>')}
    ${mapa(e, {livres})}<div data-det>${painelNo(livres)}</div></div>`;
}
function repintarDetalhe(){
  const d = q('[data-det]'); if(!d) return;
  d.innerHTML = painelNo(livresDaArvore());
  T.ov.querySelectorAll('.tn-no').forEach(b => { const s = b.dataset.id === T.sel; b.classList.toggle('is-sel', s); b.setAttribute('aria-pressed', s); });
  const bt = d.querySelector('[data-foco]'); if(bt) rolar(bt, {block:'nearest'});
}

/* ═════════════ visualizador somente-leitura ═════════════ */
function vMapa(){
  const c = char(), t = TA.estado(c), ids = Object.keys(t.trilhas).filter(i => TA.ARV[i]);
  if(!ids.length){ T.ov.dataset.stage = 'mapa'; return `<div class="tf-view"><p class="tf-sub">Você ainda não trilha nenhuma faceta.</p><button type="button" class="tf-btn" data-tn="fechar" data-foco>Voltar à mesa</button></div>`; }
  const e = ids.indexOf(T.mapaElem) >= 0 ? T.mapaElem : (TA.ativa(c) || ids[0]); T.mapaElem = e; cor(e);
  const tr = t.trilhas[e];
  const tabs = ids.length > 1 ? `<div class="tn-abas" role="tablist">${ids.map(i => `<button type="button" role="tab" class="tf-back${i === e ? ' is-on' : ''}" aria-selected="${i === e}" data-tn="aba" data-e="${esc(i)}">${esc(TA.nomeDe(i))}</button>`).join('')}</div>` : '';
  const via = TA.viaDe(tr);
  return `<div class="tf-view tn-arvore">${cab('Árvore de afinidade', esc(ed(e).nome), `${esc(grauRot(tr.grau))}${via ? ' · ' + esc(TA.ARV[e].vias[via].nome) : ''}${TA.dadivasPendentes(c, e) ? ' · <b>dádivas pendentes</b>' : ''}`)}
    ${tabs}${mapa(e)}<div data-det>${painelNo([])}</div></div>`;
}

/* ═════════════ segredo (ritual) ═════════════ */
function itens(){
  const c = char(), q2 = norm(T.busca);
  const lst = TA.segredosDisponiveis(c, T.elem, T.grau, T.segredos).filter(r => (T.circ === '' || String(r.circ) === T.circ) && (!q2 || norm(r.nome).indexOf(q2) >= 0 || norm(r.efeito).indexOf(q2) >= 0))
    .sort((a, b) => (a.circ - b.circ) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return {n:lst.length, html:lst.length ? lst.map(r => {
    const sel = T.sel === 'r:' + r.nome;
    return `<div class="tf-rit${sel ? ' is-sel' : ''}"><button type="button" class="tf-rit-hd" data-tn="sel-r" data-r="${esc(r.nome)}" aria-expanded="${sel}">
      <b>${esc(r.nome)}</b><span>${r.circ === 0 ? 'Manifestação' : r.circ + 'º círculo'} · ${esc(r.pe)} PD</span></button>
      <div class="tf-rit-bd">${sel ? detalhe(r, ed(T.elem)) + `<button type="button" class="tf-btn" data-tn="escolher-ritual" data-r="${esc(r.nome)}" style="margin-top:12px">⛧ Escolher este segredo</button>` : ''}</div></div>`;
  }).join('') : '<div class="tf-vazio">Nenhum ritual encontrado.</div>'};
}
function vSegredo(){
  cor(T.elem);
  const it = itens(), g = T.grau;
  const chips = [''].concat(Array.from({length:g + 1}, (_, i) => String(i))).map(v =>
    `<button type="button" class="tn-chip${T.circ === v ? ' is-on' : ''}" data-tn="circ" data-v="${v}">${v === '' ? 'Todos' : v === '0' ? 'Manif.' : v + 'º'}</button>`).join('');
  return `<div class="tf-view" style="min-height:0">${cab(grauRot(g) + ' · ' + esc(ed(T.elem).nome), 'ELE revela ' + (T.nSeg > 1 ? 'segredos' : 'um segredo'), `${T.nSeg > 1 ? `<b>Segredo ${T.segredos.length + 1} de ${T.nSeg}.</b> ` : ''}Escolha um ritual de ${esc(ed(T.elem).nome)} de até ${g}º círculo. <b>A escolha é permanente.</b>`)}
    <div class="tf-barra"><button type="button" class="tf-back" data-tn="voltar">← ${T.segredos.length ? 'Segredo anterior' : 'Árvore'}</button>
    <input type="search" class="tf-busca" data-tn-busca placeholder="Buscar por nome ou efeito…" autocomplete="off" value="${esc(T.busca)}" aria-label="Buscar ritual">
    <span class="tf-cont" data-cont>${it.n} ritua${it.n === 1 ? 'l' : 'is'}</span></div>
    <div class="tn-chips" role="group" aria-label="Filtrar por círculo">${chips}</div>
    <div class="tf-lista" data-lista>${it.html}</div></div>`;
}
function pintarLista(){
  const l = q('[data-lista]'); if(!l) return;
  const it = itens(); l.innerHTML = it.html;
  const n = q('[data-cont]'); if(n) n.textContent = `${it.n} ritua${it.n === 1 ? 'l' : 'is'}`;
  T.ov.querySelectorAll('.tn-chip').forEach(b => b.classList.toggle('is-on', b.dataset.v === T.circ));
  rolar(l.querySelector('.is-sel'), {block:'nearest'});
}

/* ═════════════ confirmação ═════════════ */
const cartaHd = (e, rot, nome, tam) => `<div class="tf-carta-hd" style="--c:${esc(e.cor)};--g:${esc(e.corGlow)}">${simbolo(e)}<div><small style="color:${esc(e.cor)}">${rot}</small><b style="font-size:${tam || 22}px;font-family:'IM Fell English SC',serif;font-weight:400;color:#f0e4de">${esc(nome)}</b></div></div>`;
function vConfirmar(){
  if(T.fase === 'elemento' || T.fase === 'nova'){
    const e = ed(T.elem), A = TA.ARV[T.elem]; cor(e);
    return `<div class="tf-view" style="min-height:0;overflow-y:auto">${cab('Grau I · Limiar', 'Selar a essência', '')}
      <div class="tf-selo-box">${cartaHd(e, 'Elemento de afinidade', e.nome, 24)}
        <p class="tf-efeito"><em style="font-style:normal;color:${esc(e.cor)}">Marca — ${esc(A.marca.nome)}.</em> ${esc(A.marca.desc)}</p>
        ${e.ritual_gratis ? `<p class="tf-var"><em>Ritual de afinidade (grátis)</em> ${esc(e.ritual_gratis)} — conjurável sem PD, 1× por sessão.</p>` : ''}
        <p class="tf-var"><em>Vias a trilhar</em> ${esc(A.vias.A.nome)} ou ${esc(A.vias.B.nome)} — você escolhe no Grau II.</p></div>
      <p class="tf-aviso">Esta escolha é permanente. Só o Mestre pode desfazê-la.</p>
      <button type="button" class="tf-segure" data-tn-hold="1" data-foco aria-label="Segure para selar ${esc(e.nome)}"><span>Segure para selar</span></button>
      <button type="button" class="tf-back" data-tn="voltar">← Voltar</button></div>`;
  }
  const e = ed(T.elem), n = TA.no(T.dadiva); cor(e);
  const rs = T.segredos.map(oficiaisRit).filter(Boolean);
  const via = TA.ARV[T.elem].vias[n.via].nome;
  return `<div class="tf-view" style="min-height:0;overflow-y:auto">${cab(grauRot(n.grau), 'Selar a passagem', '')}
    <div class="tf-selo-box">${cartaHd(e, esc(via) + ' · dádiva', n.nome, 22)}
      <div class="tf-tags"><span class="tf-tag"><b>${esc(usoRot(n))}</b></span></div><p class="tf-efeito">${esc(n.desc)}</p></div>
    ${rs.map(r => `<div class="tf-selo-box">${cartaHd(e, 'Segredo · ' + (r.circ === 0 ? 'Manifestação' : r.circ + 'º círculo'), r.nome, 22)}${detalhe(r, e)}</div>`).join('')}
    <p class="tf-aviso">Esta escolha é permanente. Só o Mestre pode desfazê-la.</p>
    <button type="button" class="tf-segure" data-tn-hold="1" data-foco aria-label="Segure para selar a passagem"><span>Segure para selar</span></button>
    <button type="button" class="tf-back" data-tn="voltar">← Voltar</button></div>`;
}
function iniciarHold(btn){
  if(T.hold || T.stage !== 'confirmar') return;
  const t0 = performance.now(), ov = T.ov; T.hold = {btn};
  const tick = now => {
    if(!T.hold || T.ov !== ov) return;
    const p = Math.min(1, (now - t0) / HOLD_MS);
    btn.style.setProperty('--p', p);
    if(p >= 1){ T.hold = null; aplicar(); return; }
    T.raf = requestAnimationFrame(tick);
  };
  T.raf = requestAnimationFrame(tick);
}
function soltarHold(){ if(!T.hold) return; cancelAnimationFrame(T.raf); T.hold.btn.style.setProperty('--p', 0); T.hold = null; }

/* ═════════════ aplicar ═════════════ */
function atualizarTudo(){
  if(typeof renderRituaisTab === 'function') renderRituaisTab();
  if(typeof renderTranscendenciaPanel === 'function') renderTranscendenciaPanel();
}
function recusar(msg){
  toast('⛧ ' + msg, '#cc2244');
  T.dadiva = null; T.segredos = []; T.sel = null;
  ir(T.fase === 'elemento' || T.fase === 'nova' ? 'elemento' : 'arvore');
}
function aplicar(){
  if(!T.ov) return;
  const c = char();
  if(T.fase !== 'acerto' && !liberada()){ toast('⛧ A membrana se fechou — o Mestre revogou a liberação.', '#cc2244'); return fechar(); }
  if(T.fase === 'elemento' || T.fase === 'nova'){
    const e = ed(T.elem);
    if(!TA.aplicarElemento(c, T.elem)) return recusar('Essa faceta já não está disponível.');
    consumirLiberacao(); saveDB();
    T.resultado = {tipo:'elem', elem:T.elem};
    toast(`⛧ Transcendência — ${e.nome}${e.ritual_gratis ? ' · ✦ ' + e.ritual_gratis + ' concedido!' : ''}`, e.cor);
    flash(); atualizarTudo(); cor(e); T.grauSom = 1;
    ir('narrar', {linhas:e.textos, fim:'selo', ed:e});
  }else if(T.fase === 'subir'){
    const e = ed(T.elem), g = T.grau, n = TA.no(T.dadiva);
    if(!n || !TA.aplicarSubida(c, T.elem, T.dadiva, T.segredos)) return recusar('A Corrente recusou a escolha. Refaça a passagem.');
    consumirLiberacao(); saveDB();
    T.resultado = {tipo:'subir', elem:T.elem, grau:g, dadiva:n, segredos:T.segredos.slice()};
    toast(`⛧ ${grauRot(g)} — ${n.nome}${T.segredos.length ? ' · ✦ ' + T.segredos.join(', ') : ''}`, e.cor);
    flash(); atualizarTudo(); T.grauSom = g;
    ir('narrar', {linhas:TA.ARV[T.elem].textos[g], fim:'selo', ed:e});
  }else if(T.fase === 'acerto'){
    const e = ed(T.elem), n = TA.no(T.dadiva);
    if(!n || !TA.aplicarAcerto(c, T.elem, T.dadiva)) return recusar('Essa dádiva já não está disponível.');
    saveDB();
    toast(`⛧ Dádiva recuperada — ${n.nome}`, e.cor);
    flash(); atualizarTudo();
    T.dadiva = null; T.sel = null;
    if(TA.dadivasPendentes(c, T.elem) > 0) return ir('arvore');
    T.resultado = {tipo:'acerto', elem:T.elem, dadiva:n};
    ir('narrar', {linhas:['A Corrente se ajusta.', n.nome.toUpperCase(), 'ELE guardava isto para você.'], fim:'selo', ed:e});
  }
}

/* ═════════════ selo final ═════════════ */
function anel(grau, e){
  const segs = [0, 1, 2, 3].map(i => `<circle class="tn-seg${i < grau ? ' on' : ''}" cx="50" cy="50" r="46" stroke-dasharray="62 227" stroke-dashoffset="${-i * 72}" transform="rotate(-90 50 50)" style="animation-delay:${.9 + i * .22}s"/>`).join('');
  return `<div class="tn-anel"><svg viewBox="0 0 100 100" aria-hidden="true">${segs}</svg><div class="tf-sym">${simbolo(e)}</div></div>`;
}
function vSelo(){
  const R = T.resultado, e = ed(R.elem), A = TA.ARV[R.elem]; cor(e);
  const acoes = `<div class="tf-acoes"><button type="button" class="tf-btn" data-tn="grimorio">Abrir o grimório</button><button type="button" class="tf-btn" data-tn="arvore-ver">Ver a árvore</button><button type="button" class="tf-btn" data-tn="fechar" data-foco>Voltar à mesa</button></div>`;
  const grau = (TA.trilha(char(), R.elem) || {grau:1}).grau;
  if(R.tipo === 'elem'){
    return `<div class="tf-view tf-final">${cab('Transcendeu · Grau I', esc(e.nome), '')}${anel(1, e)}
      <div class="tf-resultado"><p class="tf-efeito"><em style="font-style:normal;color:${esc(e.cor)}">${esc(A.marca.nome)}.</em> ${esc(A.marca.desc)}</p>
      ${e.ritual_gratis ? `<p class="tf-var"><em>✦ Ritual de afinidade</em> ${esc(e.ritual_gratis)} — já no seu grimório, e conjurável sem PD 1× por sessão.</p>` : ''}${acoes}</div></div>`;
  }
  if(R.tipo === 'acerto'){
    return `<div class="tf-view tf-final">${cab('Dádiva recuperada', esc(R.dadiva.nome), '')}${anel(grau, e)}
      <div class="tf-resultado"><p class="tf-efeito">${esc(R.dadiva.desc)}</p><p class="tf-var"><em>${esc(usoRot(R.dadiva))}</em></p>${acoes}</div></div>`;
  }
  const rs = (R.segredos || []).map(oficiaisRit).filter(Boolean);
  return `<div class="tf-view tf-final">${cab('Selado · ' + grauRot(R.grau), esc(R.dadiva.nome), esc(A.vias[R.dadiva.via].nome))}${anel(R.grau, e)}
    <div class="tf-resultado"><p class="tf-efeito">${esc(R.dadiva.desc)}</p><p class="tf-var"><em>${esc(usoRot(R.dadiva))}</em></p>
    ${rs.map(r => `<p class="tf-var"><em>✦ Segredo</em> ${esc(r.nome)} · ${r.circ === 0 ? 'Manifestação' : r.circ + 'º círculo'} — já no seu grimório.</p>`).join('')}
    ${R.grau === 4 ? `<p class="tf-var"><em>⛧ Coroa</em> Você alcançou o Ápice de ${esc(e.nome)}. A próxima Passagem abrirá uma nova faceta.</p>` : ''}${acoes}</div></div>`;
}

/* ═════════════ eventos ═════════════ */
function aoClicar(e){
  const el = e.target.closest('[data-tn]'); if(!el || !T.ov) return;
  retomar();
  const a = el.dataset.tn;
  if(a === 'fechar') return fechar();
  if(a === 'pular') return pularNarracao();
  if(a === 'som') return alternarSom(el);
  if(a === 'elem'){ T.elem = el.dataset.e; return ir('confirmar'); }
  if(a === 'no'){ T.sel = T.sel === el.dataset.id ? null : el.dataset.id; return repintarDetalhe(); }
  if(a === 'aba'){ T.mapaElem = el.dataset.e; T.sel = null; return ir('mapa'); }
  if(a === 'escolher-dadiva'){
    T.dadiva = el.dataset.id; T.sel = null; T.busca = ''; T.circ = ''; T.segredos = [];
    T.nSeg = T.fase === 'acerto' ? 0 : TA.segredosDaPassagem(char(), T.elem, T.grau);
    return ir(T.nSeg ? 'segredo' : 'confirmar');
  }
  if(a === 'sel-r'){ T.sel = T.sel === 'r:' + el.dataset.r ? null : 'r:' + el.dataset.r; return pintarLista(); }
  if(a === 'circ'){ T.circ = el.dataset.v; T.sel = null; return pintarLista(); }
  if(a === 'escolher-ritual'){
    if(T.segredos.length >= T.nSeg || T.segredos.indexOf(el.dataset.r) >= 0) return;
    T.segredos.push(el.dataset.r); T.sel = null; T.busca = '';
    return ir(T.segredos.length < T.nSeg ? 'segredo' : 'confirmar');
  }
  if(a === 'voltar'){
    T.sel = null;
    if(T.stage === 'segredo'){
      if(T.segredos.length){ T.segredos.pop(); return ir('segredo'); }
      T.dadiva = null; return ir('arvore');
    }
    if(T.stage === 'confirmar'){
      if(T.fase === 'elemento' || T.fase === 'nova') return ir('elemento');
      if(T.nSeg){ T.segredos.pop(); return ir('segredo'); }
      T.dadiva = null; return ir('arvore');
    }
    return;
  }
  if(a === 'arvore-ver'){ T.sel = null; T.mapaElem = T.resultado.elem; T.modo = 'mapa'; return ir('mapa'); }
  if(a === 'grimorio'){ fechar(); try{ const b = document.querySelector('.tab-btn[onclick*="showTab(\'rituais\'"]'); if(typeof showTab === 'function') showTab('rituais', b); }catch(x){} }
}
function aoTecla(e){
  if(!T.ov) return;
  if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); if(!T.hold) fechar(); return; }
  const h = e.target && e.target.closest && e.target.closest('[data-tn-hold]');
  if((e.key === 'Enter' || e.key === ' ') && h){ e.preventDefault(); if(!e.repeat){ retomar(); iniciarHold(h); } return; }
  if(e.key === 'Tab'){
    const f = Array.from(T.ov.querySelectorAll('button:not([hidden]), input')).filter(x => !x.disabled && (x.offsetParent !== null || x === document.activeElement));
    if(!f.length) return;
    const i = f.indexOf(document.activeElement);
    if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
    else if(!e.shiftKey && (i === f.length - 1 || i < 0)){ e.preventDefault(); f[0].focus(); }
  }
}

/* ═════════════ som, flash e partículas ═════════════ */
const somPref = () => { try{ return localStorage.getItem('tf_som') !== '0'; }catch(e){ return true; } };
function thump(ctx, off, vol){
  const t = ctx.currentTime + off, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(36, t + .18);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .32);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .36);
}
function boom(){
  if(!T.audio || T.audio.state !== 'running' || !somPref()) return;
  const ctx = T.audio, t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(24, t + 1.1);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.55, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + 1.3);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 1.4);
  const len = ctx.sampleRate * .5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = ctx.createBufferSource(), g2 = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 700; g2.gain.value = .35; s.buffer = buf; s.connect(f); f.connect(g2); g2.connect(ctx.destination); s.start(t);
}
function flash(){
  boom();
  if(!T.ov || reduzido()) return;
  const f = q('.tn-flash'); if(!f) return;
  f.style.setProperty('--fl', T.glow); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  T.ov.classList.remove('tn-treme'); void T.ov.offsetWidth; T.ov.classList.add('tn-treme');
}
function som(){
  const b = q('[data-tn="som"]'); if(b) b.textContent = somPref() ? 'Som ligado' : 'Som desligado';
  if(!T.somOn){ if(b) b.hidden = true; return; }
  if(!somPref()) return;
  try{
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    const ctx = new AC(); T.audio = ctx;
    let ritmo = 0;
    const bate = () => { if(ctx.state === 'running'){ thump(ctx, 0, .2); thump(ctx, .3, .13); } };
    const agenda = () => {
      const alvo = [1500, 1500, 1300, 1100, 900][T.grauSom || 0] || 1500;
      if(alvo !== ritmo){ ritmo = alvo; clearInterval(T.beat); T.beat = setInterval(() => { bate(); agenda(); }, ritmo); }
    };
    bate(); agenda();
  }catch(e){}
}
function retomar(){ if(T.audio && T.audio.state === 'suspended') T.audio.resume().catch(() => {}); }
function alternarSom(btn){
  const on = !somPref();
  try{ localStorage.setItem('tf_som', on ? '1' : '0'); }catch(e){}
  clearInterval(T.beat); if(T.audio){ try{ T.audio.close(); }catch(e){} T.audio = null; }
  if(on) som(); else btn.textContent = 'Som desligado';
}
/* partículas com movimento próprio de cada elemento */
function particulas(){
  if(reduzido()) return;
  const ov = T.ov, cv = ov.querySelector('.tf-canvas'); if(!cv) return;
  const ctx = cv.getContext('2d'); if(!ctx) return;
  let W = 0, H = 0;
  const aj = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }; aj();
  window.addEventListener('resize', aj); T.off = (T.off || []).concat([() => window.removeEventListener('resize', aj)]);
  const nova = (y, m) => {
    const p = {x:Math.random() * W, y:y == null ? Math.random() * H : y, vx:(Math.random() - .5) * .5, vy:-(Math.random() * .9 + .2), r:Math.random() * 2.2 + .5, a:Math.random() * .5 + .12, d:.0022, ph:Math.random() * 6.28};
    if(m === 'sangue'){ p.y = y == null ? Math.random() * H : -6; p.vy = Math.random() * 1.6 + .6; p.vx = (Math.random() - .5) * .15; p.r = Math.random() * 1.8 + .8; p.d = .0014; }
    if(m === 'morte'){ p.vy = -(Math.random() * .35 + .08); p.vx = (Math.random() - .5) * .3; p.r = Math.random() * 2.8 + .8; p.a = Math.random() * .32 + .08; p.d = .0012; }
    if(m === 'energia'){ p.vx = 0; p.vy = 0; p.r = Math.random() * 1.6 + .5; p.a = Math.random() * .6 + .3; p.d = .012; p.y = Math.random() * H; }
    if(m === 'conhecimento'){ p.vy = -(Math.random() * .3 + .1); p.vx = 0; p.r = Math.random() * 1.8 + .6; p.d = .0016; }
    return p;
  };
  let m0 = T.pm, pts = Array.from({length:64}, () => nova(null, m0));
  const loop = () => {
    if(T.ov !== ov || !cv.isConnected) return;               /* para quando ESTE overlay fecha (não o próximo) */
    if(T.pm !== m0){ m0 = T.pm; pts = Array.from({length:64}, () => nova(null, m0)); }
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = T.glow;
    pts.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.a);
      if(m0 === 'energia'){ ctx.fillRect(p.x, p.y, p.r * 2.2, p.r * .8); p.x += (Math.random() - .5) * 26; p.y += (Math.random() - .5) * 26; }
      else if(m0 === 'sangue'){ ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * .7, p.r * 2.2, 0, 0, 6.2832); ctx.fill(); p.x += p.vx; p.y += p.vy; }
      else{ ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); if(m0 === 'conhecimento'){ p.ph += .02; p.x += Math.sin(p.ph) * .6; p.a += Math.sin(p.ph * 3) * .004; } else p.x += p.vx; p.y += p.vy; }
      p.a -= p.d;
      if(p.a <= 0 || p.y < -10 || p.y > H + 12) Object.assign(p, nova(m0 === 'sangue' ? -6 : H + 6, m0));
    });
    ctx.globalAlpha = 1; requestAnimationFrame(loop);
  };
  loop();
}

/* ═════════════ painel da aba Transcendência ═════════════ */
const abertos = new Set();
function blocoTrilha(c, e, principal){
  const tr = TA.trilha(c, e), d = ed(e), A = TA.ARV[e], via = TA.viaDe(tr), usos = TA.estado(c).usos;
  const pend = TA.dadivasPendentes(c, e);
  const aprendidos = c.rituaisAprendidos || {};
  const total = U.oficiais().filter(r => r.elem === d.nome).length, des = U.oficiais().filter(r => r.elem === d.nome && aprendidos[r.nome]).length;
  const pips = TA.GRAUS.map(g => `<span class="tn-pip${g.n <= tr.grau ? ' on' : ''}" title="Grau ${g.rom} · ${g.nome}"><i>${g.rom}</i><em>${g.nome}</em></span>`).join('');
  const lista = TA.poderes(c).filter(p => p.elem === e).map(p => {
    const marc = p.tipo === 'marca', tra = TA.usavel(p), gasto = !!usos[p.id], aberto = abertos.has(p.id);
    return `<div class="tn-pod${gasto ? ' is-gasto' : ''}">
      <button type="button" class="tn-pod-hd" data-tp="abrir" data-id="${esc(p.id)}" aria-expanded="${aberto}"><b>${esc(p.nome)}</b><span>${esc(marc ? 'Marca · passiva' : TA.grauInfo(p.grau).rom + ' · ' + usoRot(p))}</span></button>
      ${tra ? `<button type="button" class="tn-uso${gasto ? ' is-gasto' : ''}" data-tp="uso" data-id="${esc(p.id)}" aria-pressed="${gasto}">${gasto ? 'Usada' : 'Pronta'}</button>` : ''}
      <p class="tn-pod-tx"${aberto ? '' : ' hidden'}>${esc(p.desc)}</p></div>`;
  }).join('');
  return `<section class="tn-trilha${principal ? ' is-principal' : ''}" style="--c:${esc(d.cor)};--g:${esc(d.corGlow)}">
    <div class="tn-trilha-hd">
      <span class="sym-el ${esc(d.simbolo)}" aria-hidden="true"></span>
      <div class="tn-trilha-id"><small>⛧ Transcendência${principal ? '' : ' · faceta'}</small><b>${esc(d.nome)}</b>
        <span>${esc(grauRot(tr.grau))}${via ? ' · ' + esc(A.vias[via].nome) : ''}</span></div>
      <div class="tn-pips" role="img" aria-label="${esc(grauRot(tr.grau))} de 4">${pips}</div>
    </div>
    <div class="tn-pods">${lista}</div>
    ${pend ? `<div class="tn-pend">◈ ${pend} dádiva${pend > 1 ? 's' : ''} pendente${pend > 1 ? 's' : ''} — ${pend > 1 ? 'aguardam' : 'aguarda'} a sua escolha.</div>` : ''}
    <div class="tn-rod"><span>Rituais de ${esc(d.nome)}: ${des}/${total}</span></div></section>`;
}
function renderPainel(){
  const el = document.getElementById('transcendencia-panel'), afin = document.getElementById('transcendencia-afinidade-btn');
  if(!el) return;
  if(!el.dataset.tn){ el.dataset.tn = '1'; el.addEventListener('click', aoClicarPainel); }
  if(typeof currentUser === 'undefined' || !currentUser) return;
  const c = char(); if(!c) return;
  const t = TA.estado(c), ids = Object.keys(t.trilhas).filter(i => TA.ARV[i]), P = TA.proximaPassagem(c), lib = liberada();
  let html = '';
  if(!ids.length){
    html = `<div class="tn-vazio"><div><b class="${lib ? 'is-lib' : ''}">⛧ Transcendência ${lib ? 'disponível' : 'bloqueada'}</b>
      <p>${lib ? 'ELE aguarda. O Rei Carmesim estendeu a mão — a membrana nunca foi tão fina.' : 'ELE ainda não escolheu você. Aguarde a autorização do Mestre para cruzar a membrana.'}</p></div>
      ${lib ? '<button type="button" class="tn-cta" data-tp="passagem">Cruzar a membrana</button>' : '<span class="tn-trava">Bloqueada</span>'}</div>`;
  }else{
    const a = TA.ativa(c), ordem = [a].concat(ids.filter(i => i !== a));
    html = ordem.map(e => blocoTrilha(c, e, e === a)).join('');
    let prox = '';
    if(P.fase === 'acerto') prox = `<div class="tn-prox"><p>Há dádivas esperando a sua escolha. Não é preciso nova liberação do Mestre.</p><button type="button" class="tn-cta" data-tp="passagem">Escolher dádivas pendentes</button></div>`;
    else if(P.fase === 'completo') prox = `<div class="tn-prox is-fim"><p>Você trilhou todas as facetas. Não há mais nada além da membrana.</p></div>`;
    else if(lib){
      const rot = P.fase === 'subir' ? `Passagem — ${grauRot(P.grau)}` : 'Abrir uma nova faceta';
      prox = `<div class="tn-prox"><p>${P.fase === 'subir' ? 'ELE chama de novo. A membrana se abre — um novo grau aguarda.' : 'Você alcançou a Coroa. ELE abre outra faceta da membrana.'}</p><button type="button" class="tn-cta" data-tp="passagem">${esc(rot)}</button></div>`;
    }else{
      const alvo = P.fase === 'subir' ? grauRot(P.grau) : 'uma nova faceta';
      prox = `<div class="tn-prox is-espera"><p>■ Aguardando o Mestre liberar a próxima Passagem — ${esc(alvo)}.</p></div>`;
    }
    const temUsos = Object.keys(t.usos).length > 0;
    html += `${prox}<div class="tn-barra">
      <button type="button" class="tn-sec" data-tp="arvore">Ver a árvore</button>
      <button type="button" class="tn-sec" data-tp="reviver">Rever a visão</button>
      <span class="tn-gap"></span>
      <button type="button" class="tn-sec" data-tp="cena"${temUsos ? '' : ' disabled'}>Nova cena</button>
      <button type="button" class="tn-sec" data-tp="sessao"${temUsos ? '' : ' disabled'}>Nova sessão</button></div>`;
  }
  el.innerHTML = html;
  if(afin) afin.style.display = 'none';           /* o ritual de afinidade agora é um poder da trilha ("Pronta/Usada"), guardado na ficha */
  if(U.pintarMarca){ try{ U.pintarMarca(); }catch(err){ console.error('[Transcendência] marca da forçada', err); } }
}
function usarAfinidade(c, id){
  const novo = TA.alternarUso(c, id); if(novo === null) return;
  const p = TA.poderPorId(c, id);
  if(novo && p && p.tipo === 'afinidade'){
    toast(`⛧ ${p.ritual} — Afinidade ativada sem custo! (1× por sessão)`, (ed(p.elem) || {}).cor || '#d8a050');
    if(db.rolls){ db.rolls.unshift({user:currentUser, type:'ritual', detail:`${p.ritual} (AFINIDADE — 0 PD)`, ts:Date.now()}); if(typeof renderLog === 'function') renderLog(); }
  }
}
function aoClicarPainel(e){
  const b = e.target.closest('[data-tp]'); if(!b) return;
  const a = b.dataset.tp, c = char();
  if(a === 'abrir'){ const id = b.dataset.id; abertos.has(id) ? abertos.delete(id) : abertos.add(id); return renderPainel(); }
  if(a === 'uso'){ usarAfinidade(c, b.dataset.id); saveDB(); return renderPainel(); }
  if(a === 'cena' || a === 'sessao'){ TA.restaurar(c, a === 'cena' ? 'cena' : 'tudo'); saveDB(); toast(a === 'cena' ? 'Dádivas de cena restauradas.' : 'Todas as dádivas restauradas.', '#d8a050'); return renderPainel(); }
  if(a === 'passagem') return window.transIniciarCutscene();
  if(a === 'arvore') return window.transVerArvore();
  if(a === 'reviver') return window.transReviver();
}

/* ═════════════ pontos de entrada ═════════════ */
window.transIniciarCutscene = function(){
  if(typeof currentUser === 'undefined' || !currentUser) return;
  const c = char(), P = TA.proximaPassagem(c);
  if(P.fase === 'completo'){ toast('⛧ Você já trilhou todas as facetas.', '#d8a050'); return; }
  if(P.fase !== 'acerto' && !liberada()){ toast('⛧ A membrana ainda não se abriu — aguarde a liberação do Mestre.', '#cc2244'); return; }
  if(P.fase === 'acerto') P.grau = TA.proximaDadivaGrau(c, P.elem);
  abrir({passagem:P});
};
window.transReviver = function(){
  const c = char(), a = TA.ativa(c);
  if(a && ed(a)) abrir({modo:'reviver'});
};
window.transVerArvore = function(elem){
  const c = char(); if(!TA.temTrilha(c)) return;
  abrir({modo:'mapa', elem:elem || TA.ativa(c)});
};
/* o botão antigo "Ritual de Afinidade" (1× por dia, preso ao navegador) agora usa o controle de sessão da ficha */
window.usarRitualDeAfinidade = function(){
  const c = char(), a = TA.ativa(c), todas = TA.poderes(c).filter(p => p.tipo === 'afinidade');
  if(!todas.length){ toast('⚠ Nenhum ritual de afinidade disponível.', '#ee3000'); return; }
  const usos = TA.estado(c).usos;
  const livres = todas.filter(p => !usos[p.id]).sort((x, y) => (y.elem === a) - (x.elem === a));    /* prefere a faceta ativa */
  if(!livres.length){ toast('⚠ Ritual de afinidade já usado nesta sessão.', '#f2590d'); return; }
  usarAfinidade(c, livres[0].id); saveDB(); renderPainel();
};
window.renderTranscendenciaPanel = renderPainel;
window.transFecharOverlay = fechar;
window.transPular = pularNarracao;
window.TransUI = {abrir, renderPainel};

})();
