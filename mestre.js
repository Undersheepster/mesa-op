/* ════════════════════════════════════════════════════════════
   MESTRE.JS — a aba do Mestre (reescrita completa)
   ────────────────────────────────────────────────────────────
   Substitui a antiga "Sala de Operações". Seis seções:
     Painel · Dossiê · Transcendência · NPCs · Diário · Rolagens

   Arquivos:
     mestre.js        núcleo + Painel, Dossiê, Diário, Rolagens
     mestre-trans.js  seção Transcendência
     mestre-npc.js    seção NPCs (fichas, dados de ataque)
     mestre.css       visual (prefixo .mx-)

   Regras do módulo
   · Nenhum texto vindo de jogador entra no HTML sem esc().
   · Nada de onclick inline: botões usam data-mx-act e campos
     usam data-mx-in / data-mx-ch (delegação em document).
   · populateMestre() (app.js) chama Mestre.render() a cada sync;
     por isso render() é barato e NÃO refaz a tela enquanto o
     Mestre está digitando num campo.
   · Carregar depois de app.js, morte.js, pacto.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ───────────── utilidades ───────────── */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (v, d = 0) => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const hhmm = ms => new Date(ms).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
const safeColor = (c, d) => /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : d;
const $ = (s, r) => (r || document).querySelector(s);
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

function dur(ms){
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if(m < 1) return '<1min';
  if(m < 60) return m + 'min';
  return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
}

/* ───────────── dados ───────────── */
const M = () => { if(!db.mestre) db.mestre = {notes:'', playerNotes:{}, messages:[], fichasRecebidas:{}}; return db.mestre; };
const roster = () => Object.keys(db.users || {}).filter(u => u !== 'billy' && u !== currentUser);
const C = u => (db.characters && db.characters[u]) || null;
const nome = u => (C(u) && C(u).nome) || u;
const estadoMorte = u => (C(u) && C(u).morte && C(u).morte.estado) || 'vivo';
const isExistido = u => !!(C(u) && C(u).existido && C(u).existido.ativo);
const condsAtivas = u => Object.entries((C(u) || {}).conds || {}).filter(e => e[1]).map(e => e[0]);
const transLib = u => !!(db.mestre && db.mestre.transLiberada && db.mestre.transLiberada[u]);

const SECOES = [
  {id:'painel',         label:'Painel',         desc:'A mesa de relance: quem está de pé, quem precisa de você.'},
  {id:'agentes',        label:'Dossiê',         desc:'Tudo sobre um agente, num só lugar.'},
  {id:'nivel',          label:'Nível',          desc:'Conceda XP e acompanhe a evolução dos agentes.'},
  {id:'transcendencia', label:'Transcendência', desc:'Liberações, Existidos e rituais.'},
  {id:'npcs',           label:'NPCs',           desc:'Fichas de NPC e criaturas da cena.'},
  {id:'diario',         label:'Diário',         desc:'Suas anotações da sessão.'},
  {id:'rolagens',       label:'Rolagens',       desc:'O que a mesa rolou.'},
];

const S = {
  sec:'painel', agent:null,
  condOpen:{}, menu:null, refOpen:false,
  presence:{}, lastSeen:{},
  roll:{u:'', tipo:'', sort:'recente', exp:false, lim:60},
  pending:false, sent:null,
  sort:'nome', filtro:'todos',          // ordenação/filtro do Painel
  sel:{}, grp:{k:'pv', n:5},            // seleção e ação em grupo
  undo:[],                              // pilha de desfazer
  dice:[], diceExpr:'1d20',             // dado rápido do Mestre
};
try{
  const s = JSON.parse(sessionStorage.getItem('mx_state') || '{}');
  if(SECOES.some(x => x.id === s.sec)) S.sec = s.sec;
  if(s.agent) S.agent = s.agent;
  if(['nome','pv','san','nex','risco'].indexOf(s.sort) >= 0) S.sort = s.sort;
  if(['todos','campo','risco'].indexOf(s.filtro) >= 0) S.filtro = s.filtro;
}catch(e){}
const persist = () => { try{ sessionStorage.setItem('mx_state', JSON.stringify({sec:S.sec, agent:S.agent, sort:S.sort, filtro:S.filtro})); }catch(e){} };

const Mestre = window.Mestre = {
  S, esc, num, clamp, hhmm, safeColor, plural, dur, M, roster, C, nome, estadoMorte,
  sections:{}, act:{}, input:{}, change:{},
};
const act = Mestre.act, inp = Mestre.input, chg = Mestre.change;

/* ───────────── diálogo (modal próprio, mais largo que o universal) ───────────── */
function dialog(html, opts){
  let d = document.getElementById('mx-dlg');
  if(!d){
    d = document.createElement('div');
    d.id = 'mx-dlg'; d.className = 'mx-dlg';
    d.innerHTML = '<div class="mx-dlg-box" role="dialog" aria-modal="true"><button type="button" class="mx-dlg-x" data-mx-act="dlg-close" aria-label="Fechar">×</button><div class="mx-dlg-body"></div></div>';
    d.addEventListener('mousedown', e => { if(e.target === d) closeDialog(); });
    document.body.appendChild(d);
  }
  d.querySelector('.mx-dlg-box').className = 'mx-dlg-box' + (opts && opts.wide ? ' is-wide' : '');
  d.querySelector('.mx-dlg-body').innerHTML = html;
  d.classList.add('open');
  document.body.style.overflow = 'hidden';
  const f = d.querySelector('[autofocus]') || d.querySelector('input,select,textarea');
  if(f) setTimeout(() => f.focus(), 30);
}
function closeDialog(){
  const d = document.getElementById('mx-dlg');
  if(d) d.classList.remove('open');
  document.body.style.overflow = '';
  Mestre.dlg = null;
}
Mestre.dialog = dialog; Mestre.closeDialog = closeDialog;
act['dlg-close'] = closeDialog;

/* ───────────── salvar com debounce + indicador ───────────── */
let _saveT = null;
function saveSoon(cb){
  clearTimeout(_saveT);
  _saveT = setTimeout(() => { saveDB(); if(cb) cb(); }, 350);
}
Mestre.saveSoon = saveSoon;

/* ───────────── blocos de HTML reutilizáveis ───────────── */
function panel(title, body, o){
  o = o || {};
  return `<section class="mx-panel${o.cls ? ' ' + o.cls : ''}"${o.id ? ` id="${o.id}"` : ''}>
    <header class="mx-panel-hd"><h3>${title}</h3>${o.right ? `<div class="mx-panel-r">${o.right}</div>` : ''}</header>
    <div class="mx-panel-bd">${body}</div></section>`;
}
const empty = (t, sub) => `<div class="mx-empty"><p>${t}</p>${sub ? `<small>${sub}</small>` : ''}</div>`;
Mestre.panel = panel; Mestre.empty = empty;

function avatar(u, big){
  const c = C(u) || {}, t = c.token || {};
  const ring = safeColor(t.ring, '#a3241a');
  const inner = t.imgData && /^data:image\//.test(t.imgData)
    ? `<img src="${esc(t.imgData)}" alt="">`
    : `<span>${esc((typeof ICONS !== 'undefined' && ICONS[t.icon || 'skull']) || '☠')}</span>`;
  return `<div class="mx-avatar${big ? ' is-big' : ''}" style="--ring:${ring}">${inner}</div>`;
}

function presInfo(u){
  const p = S.presence[u];
  if(p) return p.away ? {k:'away', t:'ausente'} : {k:'on', t:'em campo' + (p.since ? ' · ' + dur(p.since) : '')};
  const ls = S.lastSeen[u];
  return {k:'off', t: ls && ls.lastSeen ? 'offline · ' + (typeof _relTime === 'function' ? _relTime(ls.lastSeen) : dur(ls.lastSeen)) : 'offline'};
}

/* ───────────── vitais ───────────── */
const VIT = [['pv','pvMax','PV'], ['esf','esfMax','PD']];

function vitalRow(u, k, mk, label){
  const c = C(u) || {};
  const cur = num(c[k]), max = num(c[mk]);
  const pct = max > 0 ? clamp(Math.round(cur / max * 100), 0, 100) : 0;
  const st = cur <= 0 ? ' is-zero' : pct <= 25 ? ' is-low' : '';
  const eu = esc(u);
  return `<div class="mx-vital v-${k}${st}">
    <span class="mx-vl">${label}</span>
    <div class="mx-bar"><i style="width:${pct}%"></i></div>
    <button type="button" class="mx-step" data-mx-act="vital" data-u="${eu}" data-k="${k}" data-d="-1" aria-label="Diminuir ${label}">−</button>
    <span class="mx-vn"><b>${cur}</b>/${max}</span>
    <button type="button" class="mx-step" data-mx-act="vital" data-u="${eu}" data-k="${k}" data-d="1" aria-label="Aumentar ${label}">+</button>
  </div>`;
}
const vitalsHtml = u => `<div class="mx-vitals">${VIT.map(v => vitalRow(u, v[0], v[1], v[2])).join('')}</div>`;

/* ── desfazer ──
   Cada mudança de vital/condição entra numa pilha (30). Cliques seguidos no mesmo
   vital do mesmo agente (< 2 s) viram uma só entrada, para um Ctrl+Z desfazer a "rajada". */
const KNOME = {pv:'PV', san:'PD', esf:'PD'};
function undoLabel(ch){
  if(ch.length > 1) return `${KNOME[ch[0].k]} em ${ch.length} agentes`;
  const c = ch[0];
  return c.cond ? `${nome(c.u)}: ${c.cond} ${c.now ? 'ligada' : 'desligada'}` : `${nome(c.u)} ${KNOME[c.k]} ${c.prev}→${c.now}`;
}
function pushUndo(changes){
  const now = Date.now(), last = S.undo[S.undo.length - 1];
  if(changes.length === 1 && last && last.changes.length === 1 && !changes[0].cond && !last.changes[0].cond &&
     last.changes[0].u === changes[0].u && last.changes[0].k === changes[0].k && now - last.ts < 2000){
    last.changes[0].now = changes[0].now; last.ts = now; last.label = undoLabel(last.changes); return;
  }
  S.undo.push({changes, ts:now, label:undoLabel(changes)});
  if(S.undo.length > 30) S.undo.shift();
}
function undo(){
  const e = S.undo.pop();
  if(!e){ toast('Nada para desfazer.'); return; }
  e.changes.slice().reverse().forEach(c => {
    const ch = userChar(c.u);
    if(c.cond){ if(!ch.conds) ch.conds = {}; ch.conds[c.cond] = c.prev; } else ch[c.k] = c.prev;
  });
  saveDB();
  e.changes.forEach(c => { if(c.k === 'pv' && typeof checarMorte === 'function') checarMorte(c.u); });
  toast('↶ Desfeito: ' + e.label);
  render(true);
}
act.undo = undo;

function adjust(u, k, d){
  const c = userChar(u);
  const max = num(c[k + 'Max']), prev = num(c[k]);
  const nv = clamp(prev + d, 0, max);       // mesmo limite do ajuste feito na ficha
  if(nv === prev) return;
  c[k] = nv;
  saveDB();
  if(k === 'pv' && typeof checarMorte === 'function') checarMorte(u);
  pushUndo([{u, k, prev, now:nv}]);
  render(true);
}
act.vital = (el, e) => adjust(el.dataset.u, el.dataset.k, num(el.dataset.d) * (e.shiftKey ? 5 : 1));

/* ───────────── rolagens: leitura ───────────── */
function rollTs(r){
  if(r.ts) return r.ts;
  const m = /^(\d{1,2}):(\d{2})/.exec(r.h || '');
  if(!m) return 0;
  const d = new Date(); d.setHours(+m[1], +m[2], 0, 0);
  if(d.getTime() > Date.now() + 60000) d.setDate(d.getDate() - 1);
  return d.getTime();
}
function allRolls(){
  const out = [];
  Object.entries(db.rolls || {}).forEach(([u, arr]) => (arr || []).forEach((r, i) => out.push(Object.assign({}, r, {user: u, _ts: rollTs(r), _i: i}))));
  return out;
}
const byRecent = (a, b) => (b._ts - a._ts) || (a._i - b._i);
function rollCat(r){
  const l = r.label || '';
  if(l.indexOf('[Ritual]') >= 0) return 'ritual';
  if(l.indexOf('[Arma]') >= 0 || l.indexOf('[Explosivo]') >= 0 || l.indexOf('[Dano]') >= 0) return 'arma';
  return 'pericia';
}
const CAT = {arma:['Arma','#ee5522'], ritual:['Ritual','#b737ea'], pericia:['Perícia','#3784ea']};
const cleanLabel = l => String(l || 'Rolagem').replace(/\[(Arma|Ritual|Explosivo|Dano)\]\s*/, '').trim();
function danoTipo(r){
  if(typeof TIPOS_DANO === 'undefined') return null;
  const ctx = r.ctx || '';
  for(const k in TIPOS_DANO){ const td = TIPOS_DANO[k]; if(ctx.indexOf(td.nome) >= 0 || ctx.indexOf(td.emoji) >= 0) return [k, td]; }
  return null;
}
function rollColor(r, td, cat){
  if(td) return td[1].cor;
  if(cat === 'pericia') return r.total <= 4 ? '#ee4a3a' : r.total >= 18 ? '#4fd98f' : 'var(--hx-osso)';
  return 'var(--hx-osso)';
}
function rollLine(r, expanded){
  const cat = rollCat(r), dt = danoTipo(r), cor = rollColor(r, dt, cat);
  const when = r.h || (r._ts ? hhmm(r._ts) : '—');
  const tipo = dt ? `<span class="mx-dt" style="color:${dt[1].cor}" title="${esc(dt[1].nome)}">${esc(dt[1].emoji)}${expanded ? ' ' + esc(dt[1].nome) : ''}</span>` : '';
  return `<li class="mx-roll${expanded ? ' is-exp' : ''}">
    <time>${esc(when)}</time>
    <b class="mx-roll-who">${esc(nome(r.user))}</b>
    <span class="mx-tag" style="--tg:${CAT[cat][1]}">${CAT[cat][0]}</span>${tipo}
    <span class="mx-roll-lbl">${esc(cleanLabel(r.label))}${expanded && r.ctx && !dt ? ` <small>— ${esc(r.ctx)}</small>` : ''}</span>
    <em class="mx-roll-n" style="color:${cor}">${esc(r.total)}</em></li>`;
}

/* ───────────── PAINEL ───────────── */
function attention(){
  const out = [];
  const us = roster();
  us.forEach(u => {
    const st = estadoMorte(u), eu = esc(u), n = esc(nome(u)), c = C(u) || {};
    if(st === 'morrendo') out.push({tone:'danger', u, t:`${n} está morrendo`, d:'PV zerado. Decida o destino.',
      acts:[['estabilizar','✚ Estabilizar', eu], ['declarar-morte','☠ Declarar morte', eu]]});
    else if(st === 'morto') out.push({tone:'dead', u, t:`${n} morreu`,
      d: c.morte && c.morte.liberado ? 'Escolha liberada — aguardando o agente.' : 'Libere a escolha de destino quando for a hora.',
      acts: c.morte && c.morte.liberado ? [] : [['liberar-escolha','Liberar escolha', eu]]});
    const p = c.pacto || {};
    if(p.oferta) out.push({tone:'pact', u, t:`Pacto oferecido a ${n}`, d:'Oferta pendente — o agente ainda não respondeu.', acts:[['open-dossie','Abrir dossiê', eu]]});
    else if(p.cobranca) out.push({tone:'pact', u, t:`Cobrança de pacto em curso — ${n}`, d:'Narre o preço.', acts:[['open-dossie','Abrir dossiê', eu]]});
  });
  const fr = M().fichasRecebidas || {};
  us.filter(u => fr[u]).forEach(u => out.push({tone:'info', u, t:`${esc(nome(u))} enviou a ficha`, d:'Recebida às ' + (fr[u].ts ? hhmm(fr[u].ts) : '—') + '.',
    acts:[['open-dossie','Abrir dossiê', esc(u)], ['dismiss-ficha','Dispensar', esc(u)]]}));
  return out;
}
const attentionCount = () => { try{ return attention().length; }catch(e){ return 0; } };

function attHtml(list){
  if(!list.length) return '';
  return `<section class="mx-att" aria-label="Pendências">${list.map(a => `
    <div class="mx-att-row t-${a.tone}">
      <div class="mx-att-tx"><b>${a.t}</b><span>${a.d}</span></div>
      <div class="mx-att-ac">${a.acts.map(x => `<button type="button" class="mx-btn${x[0] === 'declarar-morte' ? ' is-danger' : ''}" data-mx-act="${x[0]}" data-u="${x[2]}">${x[1]}</button>`).join('')}</div>
    </div>`).join('')}</section>`;
}

function chips(u){
  const out = [];
  const st = estadoMorte(u);
  if(st === 'morrendo') out.push('<span class="mx-chip is-danger">Morrendo</span>');
  if(st === 'morto') out.push('<span class="mx-chip is-dead">Morto</span>');
  if(isExistido(u)) out.push('<span class="mx-chip is-exist">Existido</span>');
  if(transLib(u)) out.push('<span class="mx-chip is-gold">Transcendência liberada</span>');
  if(M().fichasRecebidas && M().fichasRecebidas[u]) out.push('<span class="mx-chip">Ficha enviada</span>');
  return out.join('');
}

function condsHtml(u){
  const on = condsAtivas(u), eu = esc(u), open = !!S.condOpen[u];
  const lista = typeof CONDS !== 'undefined' ? CONDS : [];
  const ativos = on.map(c => `<button type="button" class="mx-cond is-on" data-mx-act="cond" data-u="${eu}" data-c="${esc(c)}" title="Remover condição">${esc(c)}</button>`).join('');
  const todos = open ? `<div class="mx-condpanel">${lista.map(c => `<button type="button" class="mx-cond${on.indexOf(c) >= 0 ? ' is-on' : ''}" data-mx-act="cond" data-u="${eu}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : '';
  return `<div class="mx-conds">${ativos || '<span class="mx-none">sem condições</span>'}
    <button type="button" class="mx-cond is-add" data-mx-act="cond-panel" data-u="${eu}" aria-expanded="${open}">${open ? '− fechar' : '＋ condição'}</button></div>${todos}`;
}

function menuHtml(u){
  const eu = esc(u), online = !!S.presence[u];
  const it = (a, t, cls) => `<button type="button" class="mx-menu-it${cls ? ' ' + cls : ''}" data-mx-act="${a}" data-u="${eu}">${t}</button>`;
  return `<details class="mx-menu"${S.menu === u ? ' open' : ''} data-u="${eu}">
    <summary aria-label="Mais ações de ${esc(nome(u))}">⋯</summary>
    <div class="mx-menu-list">
      ${it('edit-vitals', 'Editar vitais…')}
      ${it('foco', 'Dar foco na cena')}
      ${transLib(u) ? it('trans-rev', 'Revogar transcendência') : it('trans-lib', 'Liberar transcendência')}
      ${online ? it('kick', 'Desconectar agente') : ''}
      ${it('remove', 'Remover ficha…', 'is-danger')}
    </div></details>`;
}

function card(u){
  const c = C(u) || {}, eu = esc(u), pr = presInfo(u), st = estadoMorte(u);
  const sub = [c.classe, 'Nv ' + Nivel.de(c), c.trilha].filter(Boolean).map(esc).join(' · ');
  return `<article class="mx-card st-${st} pr-${pr.k}" data-u="${eu}">
    <header class="mx-card-hd">
      ${avatar(u)}
      <div class="mx-id">
        <h3 class="mx-name">${esc(nome(u))}</h3>
        <div class="mx-sub">${sub}</div>
        <div class="mx-pres"><i class="mx-dot d-${pr.k}"></i>${esc(pr.t)}</div>
      </div>
      <div class="mx-card-tl">
        <button type="button" class="mx-sel${S.sel[u] ? ' is-on' : ''}" data-mx-act="sel" data-u="${eu}" aria-pressed="${!!S.sel[u]}" aria-label="Selecionar ${esc(nome(u))} para ação em grupo" title="Selecionar para ação em grupo"></button>
        ${menuHtml(u)}
      </div>
    </header>
    ${chips(u) ? `<div class="mx-chips">${chips(u)}</div>` : ''}
    ${vitalsHtml(u)}
    ${condsHtml(u)}
    <footer class="mx-card-ft">
      <button type="button" class="mx-btn" data-mx-act="open-dossie" data-u="${eu}">Dossiê</button>
      <button type="button" class="mx-btn" data-mx-act="req-roll" data-u="${eu}">Pedir rolagem</button>
    </footer>
  </article>`;
}

function feedHtml(){
  const list = allRolls().sort(byRecent).slice(0, 14);
  if(!list.length) return empty('Nenhuma rolagem ainda.', 'Quando a mesa rolar, aparece aqui.');
  return `<ol class="mx-rolls is-feed">${list.map(r => rollLine(r, false)).join('')}</ol>`;
}

/* ── ordenar / filtrar ── */
const pct = (u, k, mk) => { const c = C(u) || {}, m = num(c[mk]); return m > 0 ? num(c[k]) / m : 1; };
const emRisco = u => estadoMorte(u) === 'morrendo' || pct(u, 'pv', 'pvMax') <= .25 || pct(u, 'san', 'sanMax') <= .25;
const pior = u => Math.min(pct(u, 'pv', 'pvMax'), pct(u, 'san', 'sanMax'));
function rosterVisivel(){
  let us = roster();
  if(S.filtro === 'campo') us = us.filter(u => S.presence[u]);
  if(S.filtro === 'risco') us = us.filter(u => estadoMorte(u) !== 'morto' && emRisco(u));
  const cmp = {
    nome:  (a, b) => nome(a).localeCompare(nome(b), 'pt-BR'),
    pv:    (a, b) => pct(a, 'pv', 'pvMax') - pct(b, 'pv', 'pvMax'),
    san:   (a, b) => pct(a, 'san', 'sanMax') - pct(b, 'san', 'sanMax'),
    nex:   (a, b) => Nivel.de(C(b)) - Nivel.de(C(a)),
    risco: (a, b) => pior(a) - pior(b),
  }[S.sort] || ((a, b) => 0);
  return us.slice().sort(cmp);
}
const GRP_ROT = {pv:['Dano','Cura'], san:['Perda','Ganho'], esf:['Gasto','Recupera']};

function toolbarHtml(vis){
  const all = roster();
  const seg = (v, t) => `<button type="button" class="mx-seg${S.filtro === v ? ' is-active' : ''}" data-mx-act="filtro" data-v="${v}">${t}</button>`;
  const nsel = all.filter(u => S.sel[u]).length;
  const todosSel = vis.length > 0 && vis.every(u => S.sel[u]);
  const opt = (v, t) => `<option value="${v}"${S.sort === v ? ' selected' : ''}>${t}</option>`;
  const g = GRP_ROT[S.grp.k];
  const grp = nsel ? `<div class="mx-grp" role="group" aria-label="Ação em grupo">
      <b>${plural(nsel, 'selecionado', 'selecionados')}</b>
      <select data-mx-ch="grp-k" aria-label="Vital">${['pv','san','esf'].map(k => `<option value="${k}"${S.grp.k === k ? ' selected' : ''}>${KNOME[k]}</option>`).join('')}</select>
      <input type="number" min="1" value="${S.grp.n}" data-mx-in="grp-n" aria-label="Quantidade">
      <button type="button" class="mx-btn is-danger" data-mx-act="grp-apply" data-sg="-1">− ${g[0]}</button>
      <button type="button" class="mx-btn is-gold" data-mx-act="grp-apply" data-sg="1">+ ${g[1]}</button>
      <button type="button" class="mx-btn" data-mx-act="grp-apply" data-sg="max">Máximo</button>
      <button type="button" class="mx-link" data-mx-act="sel-clear">limpar seleção</button>
    </div>` : '';
  return `<div class="mx-toolbar">
      <div class="mx-segs">${seg('todos','Todos')}${seg('campo','Em campo')}${seg('risco','Em risco')}</div>
      <label class="mx-sort"><span>Ordenar</span><select data-mx-ch="sort" aria-label="Ordenar agentes">${opt('nome','Nome')}${opt('risco','Mais em risco')}${opt('pv','PV (menor primeiro)')}${opt('san','PD (menor primeiro)')}${opt('nex','Nível (maior primeiro)')}</select></label>
      <button type="button" class="mx-btn is-sm" data-mx-act="sel-all">${todosSel ? 'Limpar seleção' : 'Selecionar todos'}</button>
    </div>${grp}`;
}
act.filtro = el => { S.filtro = el.dataset.v; persist(); render(true); };
chg.sort = el => { S.sort = el.value; persist(); render(true); };
act.sel = el => { const u = el.dataset.u; if(S.sel[u]) delete S.sel[u]; else S.sel[u] = true; render(true); };
act['sel-clear'] = () => { S.sel = {}; render(true); };
act['sel-all'] = () => {
  const vis = rosterVisivel();
  if(vis.length && vis.every(u => S.sel[u])) S.sel = {};
  else vis.forEach(u => { S.sel[u] = true; });
  render(true);
};
chg['grp-k'] = el => { S.grp.k = el.value; render(true); };
inp['grp-n'] = el => { S.grp.n = Math.max(1, num(el.value, 1)); };
act['grp-apply'] = el => {
  const k = S.grp.k, sg = el.dataset.sg, n = Math.max(1, num(S.grp.n, 1));
  const alvos = roster().filter(u => S.sel[u]);
  const vivos = alvos.filter(u => estadoMorte(u) !== 'morto');
  const changes = [];
  vivos.forEach(u => {
    const c = userChar(u), max = num(c[k + 'Max']), prev = num(c[k]);
    const nv = sg === 'max' ? max : clamp(prev + (sg === '-1' ? -n : n), 0, max);
    if(nv !== prev){ c[k] = nv; changes.push({u, k, prev, now:nv}); }
  });
  if(!changes.length){ toast('Nada mudou (já no limite, ou só mortos selecionados).'); return; }
  saveDB();
  if(k === 'pv' && typeof checarMorte === 'function') changes.forEach(c => checarMorte(c.u));
  pushUndo(changes);
  render(true);
  toast(`${KNOME[k]}: ${plural(changes.length, 'agente alterado', 'agentes alterados')}${alvos.length > vivos.length ? ' (mortos ignorados)' : ''}. Ctrl+Z desfaz.`);
};

/* ── dado rápido do Mestre ── */
const DADOS = [4, 6, 8, 10, 12, 20, 100];
function diceLine(r, i){
  return `<li class="mx-dl-i${r.crit ? ' ' + r.crit : ''}"><time>${hhmm(r.ts)}</time><span class="mx-dl-x">${esc(r.expr)} <small>${esc(r.det)}</small></span><b>${r.total}</b>
    <button type="button" class="mx-x is-quiet" data-mx-act="dice-say" data-i="${i}" title="Mostrar este resultado à mesa" aria-label="Mostrar à mesa">↗</button></li>`;
}
const diceLogHtml = () => S.dice.length ? S.dice.map(diceLine).join('') : '<li class="mx-none">Nenhuma rolagem ainda.</li>';
function diceHtml(){
  return `<div class="mx-dice-btns">${DADOS.map(d => `<button type="button" class="mx-die" data-mx-act="die" data-d="${d}" title="Rola 1d${d} (Shift: 2d${d})">d${d}</button>`).join('')}</div>
    <div class="mx-qrow"><input id="mx-dice-expr" value="${esc(S.diceExpr)}" placeholder="2d6+3" autocomplete="off" aria-label="Expressão de dados" data-mx-in="dice-expr" data-mx-enter="dice-roll">
    <button type="button" class="mx-btn is-primary" data-mx-act="dice-roll">Rolar</button></div>
    <ol class="mx-dice-log" id="mx-dice-log">${diceLogHtml()}</ol>`;
}
function rolarDados(expr){
  if(!Mestre.rollExpr){ toast('Módulo de dados não carregou.'); return; }
  const r = Mestre.rollExpr(expr);
  if(!r){ toast('Fórmula inválida. Exemplos: 1d20, 2d6+3, 4d8-1.'); return; }
  const p0 = r.parts[0], solo = r.parts.length === 1 && p0.rs && p0.rs.length === 1 && p0.f === 20 && p0.sg > 0;
  S.dice.unshift({ts:Date.now(), expr:String(expr).trim(), total:r.total, det:Mestre.fmtRoll(r), crit: solo ? (p0.rs[0] === 20 ? 'is-crit' : p0.rs[0] === 1 ? 'is-fail' : '') : ''});
  if(S.dice.length > 8) S.dice.pop();
  const l = $('#mx-dice-log'); if(l) l.innerHTML = diceLogHtml();
}
act.die = (el, e) => { S.diceExpr = (e.shiftKey ? '2' : '1') + 'd' + el.dataset.d; const i = $('#mx-dice-expr'); if(i) i.value = S.diceExpr; rolarDados(S.diceExpr); };
act['dice-roll'] = () => { const i = $('#mx-dice-expr'); if(i) S.diceExpr = i.value; rolarDados(S.diceExpr); };
inp['dice-expr'] = el => { S.diceExpr = el.value; };
act['dice-say'] = el => {
  const r = S.dice[num(el.dataset.i)]; if(!r) return;
  if(!window.fbBroadcast){ toast('Sem conexão com o servidor.'); return; }
  window.fbBroadcast(`O Mestre rolou ${r.expr}: ${r.total}`, currentUser);
  toast('↗ Resultado mostrado à mesa.');
};

/* ── nota rápida (vai para o Diário, com a hora) ── */
act['qn-add'] = () => {
  const i = $('#mx-qn'); const t = i ? i.value.trim() : ''; if(!t) return;
  const m = M(), base = (m.notes || '').replace(/\s+$/, '');
  m.notes = (base ? base + '\n' : '') + `[${hhmm(Date.now())}] ${t}\n`;
  i.value = '';
  saveSoon();
  const ok = $('#mx-qn-ok'); if(ok) ok.textContent = '✓ anotado às ' + hhmm(Date.now());
};
const quickNoteHtml = () => `<div class="mx-qrow"><input id="mx-qn" placeholder="Anotar no Diário…" autocomplete="off" aria-label="Nota rápida" data-mx-enter="qn-add"><button type="button" class="mx-btn" data-mx-act="qn-add">＋</button></div><div class="mx-qn-ok" id="mx-qn-ok"></div>`;

function htmlPainel(){
  const us = roster();
  S.sel = Object.keys(S.sel).reduce((o, u) => { if(us.indexOf(u) >= 0) o[u] = true; return o; }, {});
  const vis = rosterVisivel();
  let lista;
  if(!us.length) lista = empty('Nenhum agente registrado ainda.', 'Quando alguém criar uma conta, a ficha aparece aqui.');
  else if(!vis.length) lista = empty('Nenhum agente corresponde ao filtro.', S.filtro === 'campo' ? 'Ninguém está conectado agora.' : 'Ninguém está em risco. Por enquanto.');
  else lista = `<div class="mx-roster">${vis.map(card).join('')}</div>`;
  return `<div class="mx-painel">
    <div class="mx-col-main">${attHtml(attention())}${us.length ? toolbarHtml(vis) : ''}${lista}</div>
    <aside class="mx-col-side">
      ${panel('Dados do Mestre', diceHtml())}
      ${panel('Nota rápida', quickNoteHtml())}
      ${panel('Últimas rolagens', feedHtml(), {right:'<button type="button" class="mx-link" data-mx-act="sec" data-s="rolagens">Ver tudo →</button>'})}
    </aside>
  </div>`;
}
Mestre.sections.painel = {html: htmlPainel};

/* ações do painel */
act.sec = el => go(el.dataset.s);
act['cond-panel'] = el => { S.condOpen[el.dataset.u] = !S.condOpen[el.dataset.u]; render(true); };
act.cond = el => {
  const c = userChar(el.dataset.u), nm = el.dataset.c;
  if(!c.conds) c.conds = {};
  const prev = !!c.conds[nm];
  c.conds[nm] = !prev;
  saveDB();
  pushUndo([{u:el.dataset.u, cond:nm, prev, now:!prev}]);
  render(true);
};
act['open-dossie'] = el => { S.agent = el.dataset.u; go('agentes'); };
act.estabilizar = el => { if(typeof estabilizarAgente === 'function') estabilizarAgente(el.dataset.u); render(true); };
act['declarar-morte'] = el => {
  if(!confirm('Declarar a morte de ' + nome(el.dataset.u) + '? A cena de morte começa para o agente.')) return;
  if(typeof declararMorte === 'function') declararMorte(el.dataset.u);
  render(true);
};
act['liberar-escolha'] = el => { if(typeof _liberarEscolhaMorte === 'function') _liberarEscolhaMorte(el.dataset.u); render(true); };
act['dismiss-ficha'] = el => { const fr = M().fichasRecebidas; if(fr) delete fr[el.dataset.u]; saveDB(); render(true); };
act.foco = el => { S.menu = null; if(typeof darFoco === 'function') darFoco(el.dataset.u); render(true); };
act.kick = el => { S.menu = null; if(typeof fbKickPlayer === 'function') fbKickPlayer(el.dataset.u); render(true); };
act.remove = el => { S.menu = null; if(typeof mestreDeleteAgent === 'function') mestreDeleteAgent(el.dataset.u); };
act['trans-lib'] = el => setTrans(el.dataset.u, true);
act['trans-rev'] = el => setTrans(el.dataset.u, false);
function setTrans(u, on){
  const m = M();
  if(!m.transLiberada) m.transLiberada = {};
  m.transLiberada[u] = on;
  S.menu = null;
  saveDB();
  toast(on ? `⛧ Transcendência liberada para ${nome(u)}.` : `Transcendência revogada de ${nome(u)}.`, on ? '#d8a050' : '#555');
  render(true);
}
Mestre.setTrans = setTrans;

/* ── Pacto com o Diabo (painel montado por renderPactoMestrePanel, em pacto.js) ── */
act['pacto-oferecer'] = el => { if(typeof _oferecerPacto === 'function') _oferecerPacto(el.dataset.u, el.dataset.t); render(true); };
act['pacto-cobrar'] = el => { if(typeof _cobrarPacto === 'function') _cobrarPacto(el.dataset.u); render(true); };
act['pacto-odio'] = el => { if(typeof _toggleOdioDoDiabo === 'function') _toggleOdioDoDiabo(el.dataset.u); render(true); };

/* ── editar vitais (diálogo) ── */
act['edit-vitals'] = el => {
  const u = el.dataset.u, c = C(u) || {};
  S.menu = null;
  const f = (k, l) => `<label class="mx-f"><span>${l}</span><input type="number" min="0" data-k="${k}" value="${num(c[k])}"></label>`;
  dialog(`<h3 class="mx-dlg-t">Vitais — ${esc(nome(u))}</h3>
    <div class="mx-fgrid">${f('pv','PV')}${f('pvMax','PV máx.')}${f('esf','PD')}${f('esfMax','PD máx.')}</div>
    <div class="mx-dlg-ft"><button type="button" class="mx-btn" data-mx-act="dlg-close">Cancelar</button>
    <button type="button" class="mx-btn is-primary" data-mx-act="save-vitals" data-u="${esc(u)}">Salvar</button></div>`);
  render(true);
};
act['save-vitals'] = el => {
  const u = el.dataset.u, c = userChar(u);
  document.querySelectorAll('#mx-dlg [data-k]').forEach(i => { c[i.dataset.k] = Math.max(0, num(i.value)); });
  VIT.forEach(v => { if(c[v[0]] > c[v[1]]) c[v[0]] = c[v[1]]; });
  saveDB();
  if(typeof checarMorte === 'function') checarMorte(u);
  closeDialog(); render(true);
  toast('Vitais de ' + nome(u) + ' atualizados.');
};

/* ── pedir rolagem (diálogo) ── */
act['req-roll'] = el => {
  const u = el.dataset.u;
  dialog(`<h3 class="mx-dlg-t">Pedir rolagem — ${esc(nome(u))}</h3>
    <p class="mx-dlg-p">O pedido aparece na tela do agente e abre a aba de Dados.</p>
    <div class="mx-fgrid is-2">
      <label class="mx-f"><span>Dado</span><select id="mx-rr-dado">${['1d4','1d6','1d8','1d10','1d12','1d20','2d6','2d20','1d100'].map(d => `<option${d === '1d20' ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="mx-f"><span>Motivo</span><input id="mx-rr-motivo" placeholder="ex.: Percepção" autofocus></label>
    </div>
    <div class="mx-dlg-ft"><button type="button" class="mx-btn" data-mx-act="dlg-close">Cancelar</button>
    <button type="button" class="mx-btn is-primary" data-mx-act="send-roll" data-u="${esc(u)}">Pedir</button></div>`);
};
act['send-roll'] = el => {
  const u = el.dataset.u;
  if(!window.fbRequestRoll){ toast('Sem conexão com o servidor — não foi possível enviar.'); return; }
  window.fbRequestRoll({target:u, dado:$('#mx-rr-dado').value, motivo:($('#mx-rr-motivo').value || '').trim(), from:currentUser, ts:Date.now()});
  closeDialog();
  toast('⛧ Pedido de rolagem enviado a ' + nome(u) + '.');
};

/* ───────────── DOSSIÊ ───────────── */
function pickItem(u){
  const c = C(u) || {}, pr = presInfo(u), act_ = u === S.agent;
  return `<button type="button" class="mx-pick st-${estadoMorte(u)}${act_ ? ' is-active' : ''}" data-mx-act="pick" data-u="${esc(u)}" aria-pressed="${act_}">
    ${avatar(u)}<span class="mx-pick-t"><b>${esc(nome(u))}</b><small>${esc(c.classe || '—')} · Nv ${Nivel.de(c)}</small></span><i class="mx-dot d-${pr.k}"></i></button>`;
}
act.pick = el => { S.agent = el.dataset.u; persist(); render(true); };

function attrsHtml(c){
  const a = (typeof OP_attrs === 'function') ? OP_attrs(c.attrs) : (c.attrs || {});   // aceita fichas antigas de 5 atributos
  const ab = [['Físico','Físico'],['Emoção','Emoção'],['Mente','Mente']];
  return `<div class="mx-attrs">${ab.map(x => `<div class="mx-attr"><b>${num(a[x[0]], 0)}</b><span>${x[1]}</span></div>`).join('')}</div>`;
}
function periciasHtml(c){
  const p = c.pericias || {};
  const lst = Object.keys(p).filter(k => num(p[k]) > 0).sort((a, b) => num(p[b]) - num(p[a]) || a.localeCompare(b, 'pt-BR'));
  if(!lst.length) return '<span class="mx-none">Nenhuma perícia treinada.</span>';
  return `<div class="mx-tags">${lst.map(k => `<span class="mx-pill" title="${esc((typeof GRAUS !== 'undefined' && (GRAUS.find(g => g.val === num(p[k])) || {}).label) || '')}">${esc(k)} <b>+${num(p[k])}</b></span>`).join('')}</div>`;
}
function armaduraHtml(c){
  if(typeof ITENS_DB === 'undefined' || !c.armaduraEquipada) return '<span class="mx-none">Sem armadura equipada.</span>';
  const a = ITENS_DB.find(i => i.id === c.armaduraEquipada);
  if(!a) return '<span class="mx-none">Sem armadura equipada.</span>';
  const tipo = a.rdTipo == null ? 'Fís.' : a.rdTipo === 'paranormal' ? 'Para.' : ((typeof TIPOS_DANO !== 'undefined' && TIPOS_DANO[a.rdTipo] && TIPOS_DANO[a.rdTipo].emoji) || a.rdTipo);
  return `<span class="mx-pill is-blue">🛡 ${esc(a.nome)} · RD ${num(a.rd)} ${esc(tipo)}</span>`;
}
function listaSimples(arr, vazio){
  if(!arr.length) return `<span class="mx-none">${vazio}</span>`;
  return `<div class="mx-tags">${arr.map(x => `<span class="mx-pill">${esc(x)}</span>`).join('')}</div>`;
}
function missaoHtml(c){
  const row = (l, v) => `<div><dt>${l}</dt><dd>${v ? esc(v) : '—'}</dd></div>`;
  const pistas = c.pistaList || [], notas = c.notas || [];
  return `<dl class="mx-dl">${row('Operação', c.opNome)}${row('Local', c.opLocal)}${row('Ameaça', c.opAmeaca)}${row('Entidade', c.opEnt)}</dl>
    ${c.opResumo ? `<blockquote class="mx-quote">${esc(c.opResumo)}</blockquote>` : ''}
    <h4 class="mx-h4">Pistas (${pistas.length})</h4>
    ${pistas.length ? `<ul class="mx-ul">${pistas.map(p => `<li><span class="mx-tag" style="--tg:#a8742f">${esc(p.tipo || 'pista')}</span>${esc(p.txt)}</li>`).join('')}</ul>` : '<span class="mx-none">Sem pistas registradas.</span>'}
    <h4 class="mx-h4">Anotações do agente (${notas.length})</h4>
    ${notas.length ? `<ul class="mx-ul">${notas.map(n => `<li>${esc(n.txt)}<time>${esc(n.h || '')}</time></li>`).join('')}</ul>` : '<span class="mx-none">Sem anotações.</span>'}`;
}
function ultimoDano(u){
  const r = (db.rolls || {})[u] || [];
  const x = r.find(q => /\[Arma\]|\[Ritual\]|\[Dano\]/.test(q.label || ''));
  if(!x) return '';
  const dt = danoTipo(x);
  return `<span class="mx-pill" ${dt ? `style="color:${dt[1].cor}"` : ''}>Último dano: ${dt ? esc(dt[1].emoji) : ''} <b>${esc(x.total)}</b></span>`;
}

function dossieDetail(u){
  const c = C(u) || defaultChar(), eu = esc(u), pr = presInfo(u);
  const sub = [c.classe, 'Nv ' + Nivel.de(c), c.origem, c.trilha].filter(Boolean).map(esc).join(' · ');
  const rits = Object.keys(c.rituaisAprendidos || {});
  const ritsFicha = (c.rituais || []).map(r => r.nome);
  const todosRit = Array.from(new Set(rits.concat(ritsFicha)));
  const pnote = (M().playerNotes || {})[u] || '';
  const hist = (c.historia || '').trim();
  return `<div class="mx-dossie">
    <header class="mx-hero st-${estadoMorte(u)}">
      ${avatar(u, true)}
      <div class="mx-hero-id">
        <h2>${esc(nome(u))}</h2>
        <div class="mx-sub">${sub}</div>
        <div class="mx-pres"><i class="mx-dot d-${pr.k}"></i>${esc(pr.t)}</div>
        ${chips(u) ? `<div class="mx-chips">${chips(u)}</div>` : ''}
      </div>
      <div class="mx-hero-ac">
        <button type="button" class="mx-btn" data-mx-act="req-roll" data-u="${eu}">Pedir rolagem</button>
        <button type="button" class="mx-btn" data-mx-act="edit-vitals" data-u="${eu}">Editar vitais</button>
        <button type="button" class="mx-btn" data-mx-act="foco" data-u="${eu}">Dar foco</button>
        ${transLib(u) ? `<button type="button" class="mx-btn is-danger" data-mx-act="trans-rev" data-u="${eu}">Revogar transcendência</button>` : `<button type="button" class="mx-btn is-gold" data-mx-act="trans-lib" data-u="${eu}">Liberar transcendência</button>`}
      </div>
    </header>
    <div class="mx-cols">
      <div class="mx-col">
        ${panel('Estado', vitalsHtml(u) + condsHtml(u) + `<div class="mx-tags mx-gap">${armaduraHtml(c)}${ultimoDano(u)}</div>`)}
        ${panel('Atributos', attrsHtml(c))}
        ${panel('Perícias treinadas', periciasHtml(c))}
        ${panel('Arsenal', `<h4 class="mx-h4 is-first">Habilidades</h4>${listaSimples((c.habs || []).map(h => h.nome), 'Nenhuma habilidade.')}
          <h4 class="mx-h4">Rituais (${todosRit.length})</h4>${listaSimples(todosRit, 'Nenhum ritual.')}
          <h4 class="mx-h4">Inventário</h4>${listaSimples((c.inv || []).map(i => i.nome + (num(i.qtd, 1) > 1 ? ' ×' + num(i.qtd, 1) : '')), 'Inventário vazio.')}`)}
      </div>
      <div class="mx-col">
        ${panel('Suas notas sobre o agente', `<textarea class="mx-note" data-mx-in="pnote" data-u="${eu}" placeholder="O que você sabe e ele não sabe. Segredos, ganchos, planos…">${esc(pnote)}</textarea><div class="mx-foot"><span class="mx-saved" id="mx-pnote-saved"></span></div>`)}
        ${panel('Missão', missaoHtml(c))}
        ${panel('História', hist ? `<div class="mx-story">${esc(hist)}</div>` : '<span class="mx-none">Este agente ainda não escreveu sua história.</span>')}
        <div id="mx-pacto"></div>
      </div>
    </div>
  </div>`;
}

function htmlAgentes(){
  const us = roster();
  if(!us.length) return empty('Nenhum agente registrado ainda.', 'Quando alguém criar uma conta, o dossiê aparece aqui.');
  if(!S.agent || us.indexOf(S.agent) < 0) S.agent = us[0];
  return `<div class="mx-split">
    <nav class="mx-picklist" aria-label="Agentes">${us.map(pickItem).join('')}</nav>
    <div class="mx-detail">${dossieDetail(S.agent)}</div>
  </div>`;
}
Mestre.sections.agentes = {html: htmlAgentes, after: () => { if(typeof renderPactoMestrePanel === 'function') renderPactoMestrePanel(); }};

inp.pnote = el => {
  const m = M(); if(!m.playerNotes) m.playerNotes = {};
  m.playerNotes[el.dataset.u] = el.value;
  const s = $('#mx-pnote-saved'); if(s) s.textContent = 'salvando…';
  saveSoon(() => { const s2 = $('#mx-pnote-saved'); if(s2) s2.textContent = 'salvo às ' + hhmm(Date.now()); });
};

/* ───────────── DIÁRIO ───────────── */
const palavras = t => (String(t).trim().match(/\S+/g) || []).length;
function htmlDiario(){
  const t = M().notes || '';
  const tool = (k, l) => `<button type="button" class="mx-btn is-sm" data-mx-act="diario-ins" data-t="${k}">${l}</button>`;
  return panel('Diário da sessão', `
    <p class="mx-lead">Rascunho livre, salvo sozinho. Use os atalhos para marcar o ritmo da sessão.</p>
    <div class="mx-tools">${tool('hora','＋ Hora')}${tool('cena','＋ Cena')}${tool('pista','＋ Pista')}${tool('gancho','＋ Gancho')}
      <span class="mx-tools-r"><button type="button" class="mx-btn is-sm" data-mx-act="diario-copy">Copiar</button><button type="button" class="mx-btn is-sm" data-mx-act="diario-dl">Baixar .txt</button></span></div>
    <textarea id="mestre-notes" class="mx-note is-big" data-mx-in="diario" placeholder="Cena 1 — …">${esc(t)}</textarea>
    <div class="mx-foot"><span id="mx-diario-count">${plural(palavras(t), 'palavra', 'palavras')}</span><span class="mx-saved" id="mx-diario-saved"></span></div>`);
}
Mestre.sections.diario = {html: htmlDiario};
inp.diario = el => {
  M().notes = el.value;
  const c = $('#mx-diario-count'); if(c) c.textContent = plural(palavras(el.value), 'palavra', 'palavras');
  const s = $('#mx-diario-saved'); if(s) s.textContent = 'salvando…';
  saveSoon(() => { const s2 = $('#mx-diario-saved'); if(s2) s2.textContent = 'salvo às ' + hhmm(Date.now()); });
};
act['diario-copy'] = async () => {
  const t = M().notes || '';
  try{ await navigator.clipboard.writeText(t); toast('Diário copiado.'); }
  catch(e){ const ta = $('#mestre-notes'); if(ta){ ta.select(); try{ document.execCommand('copy'); toast('Diário copiado.'); }catch(_){ toast('Não consegui copiar.'); } } }
};
act['diario-dl'] = () => {
  const blob = new Blob([M().notes || ''], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = 'diario-' + new Date().toISOString().slice(0, 10) + '.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
act['diario-ins'] = el => {
  const ta = $('#mestre-notes'); if(!ta) return;
  const tpl = {hora:'[' + hhmm(Date.now()) + '] ', cena:'\n— Cena: ', pista:'\n◆ Pista: ', gancho:'\n⛧ Gancho: '}[el.dataset.t] || '';
  const a = ta.selectionStart, b = ta.selectionEnd;
  ta.value = ta.value.slice(0, a) + tpl + ta.value.slice(b);
  ta.focus(); ta.selectionStart = ta.selectionEnd = a + tpl.length;
  inp.diario(ta);
};

/* ───────────── ROLAGENS ───────────── */
function filteredRolls(){
  const f = S.roll;
  let list = allRolls().filter(r => {
    if(f.u && r.user !== f.u) return false;
    if(!f.tipo) return true;
    if(f.tipo === 'arma' || f.tipo === 'ritual' || f.tipo === 'pericia') return rollCat(r) === f.tipo;
    const td = typeof TIPOS_DANO !== 'undefined' && TIPOS_DANO[f.tipo];
    return td ? ((r.ctx || '').indexOf(td.nome) >= 0 || (r.ctx || '').indexOf(td.emoji) >= 0) : true;
  });
  if(f.sort === 'maior') list.sort((a, b) => (b.total || 0) - (a.total || 0));
  else if(f.sort === 'menor') list.sort((a, b) => (a.total || 0) - (b.total || 0));
  else list.sort(byRecent);
  return list;
}
function danoResumo(){
  const por = {};
  allRolls().filter(r => rollCat(r) !== 'pericia').forEach(r => {
    const dt = danoTipo(r), k = dt ? dt[0] : '?';
    const o = por[k] || (por[k] = {n:0, soma:0, max:0, td: dt ? dt[1] : null});
    o.n++; o.soma += num(r.total); o.max = Math.max(o.max, num(r.total));
  });
  const ks = Object.keys(por);
  if(!ks.length) return '';
  return `<div class="mx-dmg">${ks.map(k => { const o = por[k], cor = o.td ? o.td.cor : '#8f7f66';
    return `<div class="mx-dmg-c" style="--c:${cor}"><span>${o.td ? esc(o.td.emoji + ' ' + o.td.nome) : 'Sem tipo'}</span><b>${o.soma}</b><small>${plural(o.n, 'rolagem', 'rolagens')} · máx ${o.max}</small></div>`; }).join('')}</div>`;
}
function rollsListHtml(){
  const list = filteredRolls(), f = S.roll;
  if(!list.length) return empty('Nenhuma rolagem encontrada.');
  const mostra = list.slice(0, f.lim);
  return `<ol class="mx-rolls">${mostra.map(r => rollLine(r, f.exp)).join('')}</ol>
    ${list.length > mostra.length ? `<div class="mx-more"><button type="button" class="mx-btn" data-mx-act="roll-more">Mostrar mais (${list.length - mostra.length})</button></div>` : ''}`;
}
function htmlRolagens(){
  const f = S.roll, us = Object.keys(db.rolls || {}).filter(u => u !== 'billy');
  const sel = (id, val, opts) => `<select data-mx-ch="${id}">${opts.map(o => `<option value="${esc(o[0])}"${o[0] === val ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const tipos = [['','Todos os tipos'], ['arma','⚔ Armas'], ['ritual','⛧ Rituais'], ['pericia','⚄ Perícias']]
    .concat(typeof TIPOS_DANO !== 'undefined' ? Object.keys(TIPOS_DANO).map(k => [k, TIPOS_DANO[k].emoji + ' ' + TIPOS_DANO[k].nome]) : []);
  const total = filteredRolls().length;
  return panel('Registro de rolagens', `
    <div class="mx-filters">
      ${sel('roll-u', f.u, [['','Todos os agentes']].concat(us.map(u => [u, nome(u)])))}
      ${sel('roll-tipo', f.tipo, tipos)}
      ${sel('roll-sort', f.sort, [['recente','Mais recente'], ['maior','Maior valor'], ['menor','Menor valor']])}
      <button type="button" class="mx-btn" data-mx-act="roll-view">Vista: ${f.exp ? 'expandida' : 'compacta'}</button>
      <button type="button" class="mx-btn is-danger" data-mx-act="roll-clear">Limpar tudo</button>
    </div>
    ${danoResumo()}
    <div class="mx-count">${plural(total, 'rolagem', 'rolagens')}</div>
    <div id="mx-rolls-list">${rollsListHtml()}</div>`);
}
Mestre.sections.rolagens = {html: htmlRolagens};
chg['roll-u'] = el => { S.roll.u = el.value; S.roll.lim = 60; paintBody(true); };
chg['roll-tipo'] = el => { S.roll.tipo = el.value; S.roll.lim = 60; paintBody(true); };
chg['roll-sort'] = el => { S.roll.sort = el.value; paintBody(true); };
act['roll-view'] = () => { S.roll.exp = !S.roll.exp; paintBody(true); };
act['roll-more'] = () => { S.roll.lim += 60; paintBody(true); };
act['roll-clear'] = () => {
  if(!confirm('Limpar o histórico de rolagens de TODOS os agentes? Isso não pode ser desfeito.')) return;
  db.rolls = {}; saveDB();
  if(typeof renderLog === 'function') try{ renderLog(); }catch(e){}
  render(true); toast('Histórico limpo.');
};
window.resetAllRolls = () => act['roll-clear']();

/* ───────────── deck (cabeçalho fixo) ───────────── */
function paintDeck(){
  const el = $('#mx-stats'); if(!el) return;
  const us = roster();
  const em = us.filter(u => S.presence[u] && !S.presence[u].away).length;
  const mor = us.filter(u => estadoMorte(u) === 'morrendo').length;
  const mrt = us.filter(u => estadoMorte(u) === 'morto').length;
  const lib = us.filter(transLib).length;
  const cell = (n, l, cls) => `<div class="mx-stat${cls ? ' ' + cls : ''}"><b>${n}</b><span>${l}</span></div>`;
  el.innerHTML = cell(em + '<small>/' + us.length + '</small>', 'Em campo', em ? 'is-ok' : '') + cell(mor, 'Morrendo', mor ? 'is-alert' : '') + cell(mrt, 'Mortos', mrt ? 'is-dead' : '') + cell(lib, 'Transc. liberada', lib ? 'is-gold' : '');
  paintPresets();
  const last = $('#mx-cast-last');
  if(last) last.textContent = S.sent ? `Última transmissão às ${hhmm(S.sent.ts)}: “${S.sent.msg.length > 70 ? S.sent.msg.slice(0, 70) + '…' : S.sent.msg}”` : '';
}
/* ── transmissões prontas: 4 padrão + as que você salvar (ficam neste navegador) ── */
const PRESETS_BASE = ['Pausa de 5 minutos.', 'Silêncio na mesa, por favor.', 'Rolem iniciativa.', 'Vamos retomar a cena.'];
const presetsCustom = () => { try{ return JSON.parse(localStorage.getItem('mx_presets') || '[]').filter(x => typeof x === 'string' && x.trim()).slice(0, 12); }catch(e){ return []; } };
const presetsSave = a => { try{ localStorage.setItem('mx_presets', JSON.stringify(a)); }catch(e){} };
function paintPresets(){
  const el = $('#mx-presets'); if(!el) return;
  const cu = presetsCustom();
  const html = PRESETS_BASE.map(t => `<button type="button" class="mx-preset" data-mx-act="preset" data-t="${esc(t)}">${esc(t)}</button>`).join('')
    + cu.map((t, i) => `<span class="mx-preset is-custom"><button type="button" data-mx-act="preset" data-t="${esc(t)}">${esc(t)}</button><button type="button" class="mx-x" data-mx-act="preset-del" data-i="${i}" aria-label="Remover atalho">×</button></span>`).join('')
    + `<button type="button" class="mx-preset is-add" data-mx-act="preset-save" title="Guardar o texto digitado como atalho">＋ guardar texto</button>`;
  if(el._html !== html){ el.innerHTML = html; el._html = html; }
}
act.preset = el => { const i = $('#broadcast-input'); if(!i) return; i.value = el.dataset.t; i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
act['preset-save'] = () => {
  const i = $('#broadcast-input'), t = i ? i.value.trim().slice(0, 140) : '';
  if(!t){ toast('Digite a frase no campo de transmissão e clique de novo.'); return; }
  const cu = presetsCustom();
  if(cu.indexOf(t) >= 0 || PRESETS_BASE.indexOf(t) >= 0){ toast('Esse atalho já existe.'); return; }
  if(cu.length >= 12){ toast('Limite de 12 atalhos próprios. Remova algum.'); return; }
  cu.push(t); presetsSave(cu); paintPresets(); toast('Atalho guardado.');
};
act['preset-del'] = el => { const cu = presetsCustom(); cu.splice(num(el.dataset.i), 1); presetsSave(cu); paintPresets(); };

(function(){
  const inpEl = () => $('#broadcast-input');
  const orig = window.fbSendBroadcast;
  if(typeof orig === 'function'){
    window.fbSendBroadcast = function(){
      const v = inpEl() ? inpEl().value.trim() : '';
      orig.apply(this, arguments);
      if(v && window.fbBroadcast){ S.sent = {msg:v, ts:Date.now()}; paintDeck(); }
    };
  }
})();

/* ───────────── navegação ───────────── */
function paintNav(){
  const nav = $('#mx-nav'); if(!nav) return;
  const n = attentionCount();
  const last = S.undo[S.undo.length - 1];
  const tabs = SECOES.map((s, i) => `<button type="button" role="tab" class="mx-tab${s.id === S.sec ? ' is-active' : ''}" aria-selected="${s.id === S.sec}" data-mx-act="sec" data-s="${s.id}" title="Atalho: ${i + 1}">${s.label}${s.id === 'painel' && n ? `<i class="mx-badge" aria-label="${n} pendências">${n}</i>` : ''}</button>`).join('');
  const lbl = last ? (last.label.length > 34 ? last.label.slice(0, 34) + '…' : last.label) : '';
  const html = `<div class="mx-tabs" role="tablist" aria-label="Seções do Mestre">${tabs}</div>
    <div class="mx-nav-r">${last ? `<button type="button" class="mx-undo" data-mx-act="undo" title="Desfazer (Ctrl+Z)">↶ <span>${esc(lbl)}</span></button>` : ''}<button type="button" class="mx-help" data-mx-act="help" title="Atalhos do teclado (?)" aria-label="Atalhos do teclado">?</button></div>`;
  if(nav._html !== html){ nav.innerHTML = html; nav._html = html; }
}
function go(id){
  if(!SECOES.some(s => s.id === id)) id = 'painel';
  S.sec = id; S.menu = null; persist();
  paintNav(); paintBody(true);
  const r = $('#mx-root'); if(r){ const top = r.getBoundingClientRect().top; if(top < 0) window.scrollBy(0, top - 12); }
}
Mestre.go = go;

function paintBody(force){
  const b = $('#mx-body'); if(!b) return;
  const sec = Mestre.sections[S.sec];
  let html;
  try{ html = sec ? sec.html() : empty('Esta seção não carregou.', 'Recarregue a página.'); }
  catch(err){ console.error('[Mestre] erro na seção ' + S.sec, err); html = empty('Não foi possível montar esta seção.', esc(err.message)); }
  if(force || b.dataset.sec !== S.sec || b._html !== html){
    b.innerHTML = html; b._html = html; b.dataset.sec = S.sec;
    const d = SECOES.find(s => s.id === S.sec);
    b.setAttribute('aria-label', d ? d.label : '');
  }
  if(sec && sec.after){ try{ sec.after(b); }catch(err){ console.error('[Mestre] after', err); } }
}
const busy = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#mx-body') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
const tabAtiva = () => { const t = document.getElementById('tab-mestre'); return !!(t && t.classList.contains('active')); };

function render(force){
  if(typeof isMestre === 'undefined' || !isMestre) return;
  if(!$('#mx-root')) return;
  paintDeck(); paintNav();
  if(!force && busy()){ S.pending = true; return; }
  S.pending = false;
  paintBody(!!force);
}
Mestre.render = render;
Mestre.paintBody = paintBody;

document.addEventListener('focusout', e => {
  if(!S.pending || !e.target.closest || !e.target.closest('#mx-body')) return;
  setTimeout(() => { if(S.pending && !busy()){ S.pending = false; paintBody(false); } }, 150);
});

/* ───────────── presença (vem do renderOnlineList do app.js) ───────────── */
Mestre.onPresence = (p, l) => {
  S.presence = p || {}; S.lastSeen = l || {};
  clearTimeout(Mestre._pt);
  Mestre._pt = setTimeout(() => { if(tabAtiva()) render(); else paintDeck(); }, 150);
};
(function(){
  const orig = window.renderOnlineList;
  if(typeof orig !== 'function') return;
  window.renderOnlineList = function(presence, lastSeen){
    const r = orig.apply(this, arguments);
    try{ Mestre.onPresence(presence, lastSeen); }catch(e){ console.error(e); }
    return r;
  };
})();

/* ───────────── delegação de eventos ───────────── */
function closeMenus(except){
  document.querySelectorAll('#mx-root .mx-menu[open]').forEach(d => { if(d !== except) d.removeAttribute('open'); });
  if(!except) S.menu = null;
}
document.addEventListener('click', e => {
  const inMenu = e.target.closest && e.target.closest('.mx-menu');
  if(!inMenu && S.menu) closeMenus();
  if(inMenu){
    const sm = e.target.closest('summary');
    if(sm){ setTimeout(() => { S.menu = inMenu.open ? inMenu.dataset.u : null; closeMenus(inMenu.open ? inMenu : null); }, 0); return; }
  }
  const el = e.target.closest && e.target.closest('[data-mx-act]');
  if(!el) return;
  const fn = act[el.dataset.mxAct];
  if(fn){ e.preventDefault(); try{ fn(el, e); }catch(err){ console.error('[Mestre] ação ' + el.dataset.mxAct, err); } }
});
document.addEventListener('input', e => {
  const el = e.target.closest && e.target.closest('[data-mx-in]');
  if(el && inp[el.dataset.mxIn]){ try{ inp[el.dataset.mxIn](el, e); }catch(err){ console.error(err); } }
});
document.addEventListener('change', e => {
  const el = e.target.closest && e.target.closest('[data-mx-ch]');
  if(el && chg[el.dataset.mxCh]){ try{ chg[el.dataset.mxCh](el, e); }catch(err){ console.error(err); } }
});
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeDialog(); if(S.menu){ closeMenus(); } } });

/* ── atalhos de teclado (só com a aba Mestre aberta e sem estar digitando) ── */
const dlgAberto = () => !!document.querySelector('#mx-dlg.open');
function focarNoPainel(id){ go('painel'); setTimeout(() => { const i = document.getElementById(id); if(i){ i.focus(); i.select && i.select(); } }, 30); }
function ajuda(){
  const k = (t, d) => `<div class="mx-keyrow"><span>${t}</span><b>${d}</b></div>`;
  dialog(`<h3 class="mx-dlg-t">Atalhos do teclado</h3>
    <div class="mx-keys">
      ${k('<kbd>1</kbd> – <kbd>6</kbd>', 'Trocar de seção')}
      ${k('<kbd>/</kbd>', 'Escrever uma transmissão')}
      ${k('<kbd>D</kbd>', 'Dado rápido')}
      ${k('<kbd>N</kbd>', 'Nota rápida no Diário')}
      ${k('<kbd>Ctrl</kbd> + <kbd>Z</kbd>', 'Desfazer vital / condição')}
      ${k('<kbd>Shift</kbd> + clique em − / +', 'Muda 5 de uma vez')}
      ${k('<kbd>Shift</kbd> + clique num dado', 'Rola 2 dados')}
      ${k('<kbd>Esc</kbd>', 'Fechar janela ou menu')}
      ${k('<kbd>?</kbd>', 'Esta ajuda')}
    </div>
    <div class="mx-dlg-ft"><button type="button" class="mx-btn is-primary" data-mx-act="dlg-close">Entendi</button></div>`);
}
act.help = ajuda;
document.addEventListener('keydown', e => {
  if(typeof isMestre === 'undefined' || !isMestre || !tabAtiva()) return;
  const t = e.target, tag = t && t.tagName;
  const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (t && t.isContentEditable);
  if((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key || '').toLowerCase() === 'z'){
    if(digitando || dlgAberto()) return;
    e.preventDefault(); undo(); return;
  }
  if(digitando || dlgAberto() || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key;
  if(key >= '1' && key <= String(SECOES.length)){ e.preventDefault(); go(SECOES[+key - 1].id); }
  else if(key === '/'){ e.preventDefault(); const i = $('#broadcast-input'); if(i) i.focus(); }
  else if(key === 'd' || key === 'D'){ e.preventDefault(); focarNoPainel('mx-dice-expr'); }
  else if(key === 'n' || key === 'N'){ e.preventDefault(); focarNoPainel('mx-qn'); }
  else if(key === '?'){ e.preventDefault(); ajuda(); }
});

/* atualiza rótulos de tempo ("em campo · 12min") */
setInterval(() => { if(tabAtiva() && !document.hidden) render(); }, 30000);

})();
