/* ════════════════════════════════════════════════════════════
   MESTRE-NPC.JS — seção "NPCs" da aba Mestre
   ────────────────────────────────────────────────────────────
   Fichas de NPC / criaturas / chefes, guardadas em
   db.mestre.npcFichas (formato inalterado: fichas antigas
   continuam abrindo).
   · lista com busca e filtro por tipo
   · PV rápido direto no cartão
   · visualização e edição em diálogo (não mais um formulário
     gigante no pé da página)
   · duplicar ficha  ·  rolar ataque e dano
   Carregar depois de mestre.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(!window.Mestre) return;
const {S, esc, num, clamp, M, panel, empty, dialog, closeDialog, act, input: inp, change: chg} = Mestre;

S.npc = S.npc || {q:'', tipo:''};
const TIPOS = (typeof OPT_NPC_TIPO !== 'undefined' ? OPT_NPC_TIPO : [
  {v:'npc', t:'NPC Humano'}, {v:'criatura', t:'Criatura'}, {v:'chefe', t:'Chefe / Boss'}, {v:'aliado', t:'Aliado'}, {v:'neutro', t:'Neutro'}]);
const TIPO_LABEL = {}; TIPOS.forEach(t => { TIPO_LABEL[t.v] = t.t; });
const TIPO_COR = {npc:'#bfae8e', criatura:'#d23a26', chefe:'#d8a050', aliado:'#9fc26b', neutro:'#8f7f66'};
const ATTRS = [['fis','Físico'], ['emo','Emoção'], ['men','Mente']];
/* NPCs salvos com os 5 atributos antigos (agi/for/int/pre/vig) viram fis/emo/men.
   Físico = o maior entre agi, for e vig. Idempotente. */
function npcAttrs(a){
  a = a || {};
  const n = v => (typeof v === 'number' && !isNaN(v));
  const fis = [a.agi, a.for, a.vig].filter(n);
  return {
    fis: n(a.fis) ? a.fis : (fis.length ? Math.max(...fis) : 0),
    emo: n(a.emo) ? a.emo : (n(a.pre) ? a.pre : 0),
    men: n(a.men) ? a.men : (n(a.int) ? a.int : 0),
  };
}

const lista = () => { const m = M(); if(!m.npcFichas) m.npcFichas = []; return m.npcFichas; };
const achar = id => lista().find(f => f.id === id);
const pvAtual = f => f.pvAtual != null ? f.pvAtual : f.pv;
const pvPct = f => f.pv > 0 ? clamp(pvAtual(f) / f.pv, 0, 1) : 0;
const salvar = () => saveDB();

/* ───────────── dados ───────────── */
function rollExpr(expr){
  const s = String(expr == null ? '' : expr).replace(/\s+/g, '').replace(/−/g, '-');
  if(!s) return null;
  const re = /([+-]?)(?:(\d*)d(\d+)|(\d+))/gi;
  let m, pos = 0, total = 0;
  const parts = [];
  while((m = re.exec(s))){
    if(m.index !== pos) return null;
    pos = re.lastIndex;
    const sg = m[1] === '-' ? -1 : 1;
    if(m[3]){
      const n = m[2] === '' ? 1 : +m[2], f = +m[3];
      if(n < 1 || n > 100 || f < 2 || f > 1000) return null;
      const rs = [];
      for(let i = 0; i < n; i++) rs.push(1 + Math.floor(Math.random() * f));
      total += sg * rs.reduce((a, b) => a + b, 0);
      parts.push({sg, n, f, rs});
    }else{
      total += sg * +m[4];
      parts.push({sg, flat:+m[4]});
    }
  }
  if(pos !== s.length || !parts.length) return null;
  return {total, parts};
}
function fmtRoll(r){
  return r.parts.map((p, i) => {
    const sg = p.sg < 0 ? '−' : (i ? '+' : '');
    return p.flat != null ? `${sg}${p.flat}` : `${sg}${p.n}d${p.f}(${p.rs.join(',')})`;
  }).join(' ');
}
Mestre.rollExpr = rollExpr; Mestre.fmtRoll = fmtRoll;
const res = {};   // resultados de dados exibidos no diálogo { 'id:i:tipo': html }

/* ───────────── lista ───────────── */
function npcCard(f){
  const cor = TIPO_COR[f.tipo] || '#bfae8e', pct = pvPct(f), p = pvAtual(f);
  const st = p <= 0 ? ' is-zero' : pct <= .25 ? ' is-low' : '';
  const id = esc(f.id);
  return `<article class="mx-npc" style="--tc:${cor}">
    <button type="button" class="mx-npc-main" data-mx-act="npc-view" data-id="${id}">
      <b class="mx-npc-name">${esc(f.nome)}</b>
      <span class="mx-npc-sub"><i>${esc(TIPO_LABEL[f.tipo] || f.tipo)}</i>${f.nex ? ' · ' + esc(f.nex) : ''}</span>
    </button>
    <div class="mx-npc-stats"><span>DEF <b>${num(f.def, 10)}</b></span><span>Desl. <b>${esc(f.desl || '—')}</b></span></div>
    <div class="mx-vital v-pv${st}">
      <span class="mx-vl">PV</span>
      <div class="mx-bar"><i style="width:${Math.round(pct * 100)}%"></i></div>
      <button type="button" class="mx-step" data-mx-act="npc-hp" data-id="${id}" data-d="-1" aria-label="Diminuir PV">−</button>
      <span class="mx-vn"><b>${p}</b>/${f.pv}</span>
      <button type="button" class="mx-step" data-mx-act="npc-hp" data-id="${id}" data-d="1" aria-label="Aumentar PV">+</button>
    </div>
  </article>`;
}
function npcGrid(){
  const q = (S.npc.q || '').toLowerCase();
  const l = lista().filter(f => (!S.npc.tipo || f.tipo === S.npc.tipo) && (!q || (f.nome || '').toLowerCase().indexOf(q) >= 0 || (f.nex || '').toLowerCase().indexOf(q) >= 0));
  if(!lista().length) return empty('Nenhuma ficha criada.', 'Use “Nova ficha” para registrar um NPC, criatura ou chefe.');
  if(!l.length) return empty('Nenhuma ficha corresponde à busca.');
  return `<div class="mx-npcs">${l.map(npcCard).join('')}</div>`;
}
function htmlNpcs(){
  const seg = (v, t) => `<button type="button" class="mx-seg${S.npc.tipo === v ? ' is-active' : ''}" data-mx-act="npc-tipo" data-v="${esc(v)}">${esc(t)}</button>`;
  return panel('Arquivos — fichas de NPC', `
    <div class="mx-filters">
      <input type="search" class="mx-grow" placeholder="Buscar por nome ou NEX…" value="${esc(S.npc.q)}" data-mx-in="npc-q">
      <button type="button" class="mx-btn is-primary" data-mx-act="npc-new">＋ Nova ficha</button>
    </div>
    <div class="mx-segs">${seg('', 'Todos')}${TIPOS.map(t => seg(t.v, t.t)).join('')}</div>
    <div id="mx-npc-grid">${npcGrid()}</div>`);
}
Mestre.sections.npcs = {html: htmlNpcs};
const paintGrid = () => { const g = document.getElementById('mx-npc-grid'); if(g) g.innerHTML = npcGrid(); };
inp['npc-q'] = el => { S.npc.q = el.value; paintGrid(); };
act['npc-tipo'] = el => { S.npc.tipo = el.dataset.v; Mestre.paintBody(true); };

function mudarPv(id, d){
  const f = achar(id); if(!f) return;
  f.pvAtual = clamp(pvAtual(f) + d, 0, f.pv);
  salvar(); paintGrid();
  if(Mestre.dlg && Mestre.dlg.type === 'npc-view' && Mestre.dlg.id === id) verNpc(id, true);
}
act['npc-hp'] = (el, e) => mudarPv(el.dataset.id, num(el.dataset.d) * (e.shiftKey ? 5 : 1));
act['npc-hp-set'] = el => {
  const f = achar(el.dataset.id); if(!f) return;
  const v = prompt('PV atual de ' + f.nome + ' (0 a ' + f.pv + '):', pvAtual(f));
  if(v === null) return;
  f.pvAtual = clamp(num(v, pvAtual(f)), 0, f.pv);
  salvar(); paintGrid(); verNpc(f.id, true);
};
act['npc-heal'] = el => {
  const f = achar(el.dataset.id); if(!f) return;
  f.pvAtual = f.pv; salvar(); paintGrid(); verNpc(f.id, true);
};

/* ───────────── visualizar ───────────── */
function verNpc(id, mantem){
  const f = achar(id); if(!f) return;
  Mestre.dlg = {type:'npc-view', id};
  if(!mantem) Object.keys(res).forEach(k => delete res[k]);
  const cor = TIPO_COR[f.tipo] || '#bfae8e', a = npcAttrs(f.atrs), pct = pvPct(f), p = pvAtual(f), eid = esc(f.id);
  const st = p <= 0 ? ' is-zero' : pct <= .25 ? ' is-low' : '';
  const h = t => `<h4 class="mx-h4">${t}</h4>`;
  const ataques = (f.ataques || []).length ? (f.ataques || []).map((at, i) => `
    <div class="mx-atk">
      <div class="mx-atk-hd"><b>${esc(at.nome)}</b><span>${at.bonus ? esc(at.bonus) : ''}${at.dano ? ' · ' + esc(at.dano) : ''}${at.tipo ? ' · ' + esc(at.tipo) : ''}</span></div>
      <div class="mx-atk-ac">
        ${at.bonus !== '' && at.bonus != null ? `<button type="button" class="mx-btn is-sm" data-mx-act="npc-roll" data-id="${eid}" data-i="${i}" data-k="atk">Atacar</button>` : ''}
        ${at.dano ? `<button type="button" class="mx-btn is-sm" data-mx-act="npc-roll" data-id="${eid}" data-i="${i}" data-k="dmg">Dano</button>` : ''}
      </div>
      <div class="mx-atk-res">${res[f.id + ':' + i + ':atk'] || ''}${res[f.id + ':' + i + ':dmg'] || ''}</div>
    </div>`).join('') : '';
  dialog(`<div class="mx-npcv" style="--tc:${cor}">
    <header class="mx-npcv-hd">
      <div><h2>${esc(f.nome)}</h2><div class="mx-sub"><span style="color:${cor}">${esc(TIPO_LABEL[f.tipo] || f.tipo)}</span>${f.nex ? ' · ' + esc(f.nex) : ''}${f.desl ? ' · Desl. ' + esc(f.desl) : ''}</div></div>
      <div class="mx-npcv-ac">
        <button type="button" class="mx-btn" data-mx-act="npc-edit" data-id="${eid}">✎ Editar</button>
        <button type="button" class="mx-btn" data-mx-act="npc-dup" data-id="${eid}">Duplicar</button>
        <button type="button" class="mx-btn" data-mx-act="npc-dup-n" data-id="${eid}" title="Cria várias cópias numeradas (capangas, zumbis…)">Duplicar ×N</button>
        <button type="button" class="mx-btn is-danger" data-mx-act="npc-del" data-id="${eid}">Apagar</button>
      </div>
    </header>
    <div class="mx-vital v-pv big${st}">
      <span class="mx-vl">PV</span>
      <div class="mx-bar"><i style="width:${Math.round(pct * 100)}%"></i></div>
      <button type="button" class="mx-step" data-mx-act="npc-hp" data-id="${eid}" data-d="-5" aria-label="Diminuir 5">−5</button>
      <button type="button" class="mx-step" data-mx-act="npc-hp" data-id="${eid}" data-d="-1" aria-label="Diminuir 1">−</button>
      <button type="button" class="mx-vn as-btn" data-mx-act="npc-hp-set" data-id="${eid}" title="Definir PV"><b>${p}</b>/${f.pv}</button>
      <button type="button" class="mx-step" data-mx-act="npc-hp" data-id="${eid}" data-d="1" aria-label="Aumentar 1">+</button>
      <button type="button" class="mx-step" data-mx-act="npc-hp" data-id="${eid}" data-d="5" aria-label="Aumentar 5">+5</button>
      <button type="button" class="mx-btn is-sm" data-mx-act="npc-heal" data-id="${eid}">Cheio</button>
    </div>
    <div class="mx-attrs">${ATTRS.map(x => `<div class="mx-attr"><b>${num(a[x[0]])}</b><span>${x[1]}</span></div>`).join('')}</div>
    <div class="mx-defs">${[['DEF', f.def], ['Fort', f.fort], ['Ref', f.ref], ['Vont', f.vont], ['PD', f.pe]].map(x => `<div><span>${x[0]}</span><b>${esc(x[1] === '' || x[1] == null ? '—' : x[1])}</b></div>`).join('')}</div>
    ${ataques ? h('Ataques') + ataques : ''}
    ${(f.habs || '').trim() ? h('Habilidades') + `<div class="mx-story">${esc(f.habs)}</div>` : ''}
    ${(f.desc || '').trim() ? h('Notas do Mestre') + `<div class="mx-story">${esc(f.desc)}</div>` : ''}
    ${(f.origem || f.trilha) ? `<dl class="mx-dl is-2">${f.origem ? `<div><dt>Origem</dt><dd>${esc(f.origem)}</dd></div>` : ''}${f.trilha ? `<div><dt>Trilha</dt><dd>${esc(f.trilha)}</dd></div>` : ''}</dl>` : ''}
    ${(f.inv || []).length ? h('Inventário') + `<div class="mx-tags">${f.inv.map(i => `<span class="mx-pill">${esc(i.nome)}${num(i.qtd, 1) > 1 ? ' ×' + num(i.qtd, 1) : ''}</span>`).join('')}</div>` : ''}
    ${(f.rituais || []).length ? h('Rituais conhecidos') + `<div class="mx-tags">${f.rituais.map(r => `<span class="mx-pill is-crimson">${esc(r.nome)}${r.elem ? ' <small>' + esc(r.elem) + '</small>' : ''}${r.circ ? ' <small>' + esc(r.circ) + '°</small>' : ''}</span>`).join('')}</div>` : ''}
  </div>`, {wide:true});
}
act['npc-view'] = el => verNpc(el.dataset.id);

act['npc-roll'] = el => {
  const f = achar(el.dataset.id); if(!f) return;
  const i = num(el.dataset.i), at = (f.ataques || [])[i]; if(!at) return;
  let r, rotulo;
  if(el.dataset.k === 'atk'){
    const b = String(at.bonus).trim();
    r = rollExpr('1d20' + (/^[+\-−]/.test(b) ? b : '+' + b)); rotulo = 'Ataque';
  }else{
    r = rollExpr(at.dano); rotulo = 'Dano';
  }
  if(!r){ toast('Não consegui ler a fórmula “' + (el.dataset.k === 'atk' ? at.bonus : at.dano) + '”.'); return; }
  let cls = '';
  if(el.dataset.k === 'atk' && r.parts[0] && r.parts[0].rs){ const d = r.parts[0].rs[0]; cls = d === 20 ? ' is-crit' : d === 1 ? ' is-fail' : ''; }
  res[f.id + ':' + i + ':' + el.dataset.k] = `<span class="mx-res${cls}">${rotulo}: <small>${esc(fmtRoll(r))}</small> = <b>${r.total}</b></span>`;
  verNpc(f.id, true);
};

/* ───────────── editar / criar ───────────── */
const blank = () => ({id:null, nome:'', tipo:'npc', nex:'', desl:'', origem:'', trilha:'',
  atrs:{fis:0, emo:0, men:0}, pv:20, pvAtual:20, pe:0, def:10, fort:'', ref:'', vont:'',
  ataques:[], inv:[], rituais:[], habs:'', desc:''});
const clone = o => JSON.parse(JSON.stringify(o));
let draft = null;

function setPath(o, path, v){
  const ks = path.split('.'); let t = o;
  while(ks.length > 1) t = t[ks.shift()];
  t[ks[0]] = v;
}
const fld = (label, path, o) => {
  o = o || {};
  const v = path.split('.').reduce((a, k) => a == null ? a : a[k], draft);
  return `<label class="mx-f${o.span ? ' is-span' : ''}"><span>${label}</span><input ${o.type ? `type="${o.type}"` : ''}${o.min != null ? ` min="${o.min}"` : ''} value="${esc(v)}" placeholder="${esc(o.ph || '')}" data-mx-in="npc-f" data-f="${path}"></label>`;
};
function listaAtaques(){
  if(!draft.ataques.length) return '<div class="mx-none">Nenhum ataque. Use “＋ Ataque”.</div>';
  return draft.ataques.map((a, i) => `<div class="mx-atrow">
    ${['nome:Nome do ataque', 'bonus:+bônus', 'dano:dano (1d8+2)', 'tipo:tipo'].map(x => { const [k, ph] = x.split(':'); return `<input value="${esc(a[k])}" placeholder="${ph}" aria-label="${ph}" data-mx-in="npc-at" data-i="${i}" data-f="${k}">`; }).join('')}
    <button type="button" class="mx-x" data-mx-act="npc-del-at" data-i="${i}" aria-label="Remover ataque">×</button></div>`).join('');
}
function listaInv(){
  if(!draft.inv.length) return '<div class="mx-none">Nenhum item.</div>';
  return `<div class="mx-tags">${draft.inv.map((it, i) => `<span class="mx-pill">${esc(it.nome)}${it.qtd > 1 ? ' ×' + it.qtd : ''}<button type="button" class="mx-x" data-mx-act="npc-del-inv" data-i="${i}" aria-label="Remover">×</button></span>`).join('')}</div>`;
}
function listaRit(){
  if(!draft.rituais.length) return '<div class="mx-none">Nenhum ritual.</div>';
  return `<div class="mx-tags">${draft.rituais.map((r, i) => `<span class="mx-pill is-crimson">${esc(r.nome)}${r.elem ? ' <small>' + esc(r.elem) + '</small>' : ''}${r.circ ? ' <small>' + esc(r.circ) + '°</small>' : ''}<button type="button" class="mx-x" data-mx-act="npc-del-rit" data-i="${i}" aria-label="Remover">×</button></span>`).join('')}</div>`;
}
const paintListas = () => {
  const a = document.getElementById('mx-npc-ats'), b = document.getElementById('mx-npc-inv'), c = document.getElementById('mx-npc-rit');
  if(a) a.innerHTML = listaAtaques(); if(b) b.innerHTML = listaInv(); if(c) c.innerHTML = listaRit();
};

function abrirEditor(){
  Mestre.dlg = {type:'npc-edit'};
  dialog(`<form class="mx-npce" onsubmit="return false">
    <h3 class="mx-dlg-t">${draft.id ? 'Editar ficha — ' + esc(draft.nome) : 'Nova ficha de NPC'}</h3>
    <div class="mx-fgrid is-4">
      ${fld('Nome', 'nome', {span:2, ph:'Nome do NPC'})}
      <label class="mx-f"><span>Tipo</span><select data-mx-in="npc-f" data-f="tipo">${TIPOS.map(t => `<option value="${esc(t.v)}"${t.v === draft.tipo ? ' selected' : ''}>${esc(t.t)}</option>`).join('')}</select></label>
      ${fld('NEX / Ameaça', 'nex', {ph:'25% / Ameaça 2'})}
      ${fld('Deslocamento', 'desl', {ph:'9m'})}
      ${fld('PV máx.', 'pv', {type:'number', min:1})}
      ${fld('PD máx.', 'pe', {type:'number', min:0})}
      ${fld('Defesa', 'def', {type:'number', min:0})}
    </div>
    <h4 class="mx-h4">Atributos</h4>
    <div class="mx-fgrid is-3">${ATTRS.map(x => fld(x[1], 'atrs.' + x[0], {type:'number', min:-5})).join('')}</div>
    <h4 class="mx-h4">Resistências</h4>
    <div class="mx-fgrid is-3">${fld('Fortitude', 'fort', {ph:'+3'})}${fld('Reflexos', 'ref', {ph:'+1'})}${fld('Vontade', 'vont', {ph:'+2'})}</div>
    <h4 class="mx-h4">Ataques e ações <button type="button" class="mx-btn is-sm" data-mx-act="npc-add-at">＋ Ataque</button></h4>
    <div id="mx-npc-ats" class="mx-stack">${listaAtaques()}</div>
    <label class="mx-f"><span>Habilidades / poderes especiais (um por linha)</span><textarea rows="3" data-mx-in="npc-f" data-f="habs">${esc(draft.habs)}</textarea></label>
    <div class="mx-fgrid is-2">${fld('Origem', 'origem', {ph:'Militante, Acadêmico…'})}${fld('Trilha paranormal', 'trilha', {ph:'Atirador, Médium…'})}</div>
    <h4 class="mx-h4">Inventário</h4>
    <div id="mx-npc-inv">${listaInv()}</div>
    <div class="mx-addrow"><input id="mx-ni-n" placeholder="Nome do item" data-mx-enter="npc-add-inv"><input id="mx-ni-q" type="number" min="1" value="1" aria-label="Quantidade"><button type="button" class="mx-btn is-sm" data-mx-act="npc-add-inv">＋ Item</button></div>
    <h4 class="mx-h4">Rituais conhecidos</h4>
    <div id="mx-npc-rit">${listaRit()}</div>
    <div class="mx-addrow"><input id="mx-nr-n" placeholder="Nome do ritual"><input id="mx-nr-e" placeholder="Elemento"><input id="mx-nr-c" placeholder="Círculo"><button type="button" class="mx-btn is-sm" data-mx-act="npc-add-rit">＋ Ritual</button></div>
    <label class="mx-f"><span>Descrição / notas do Mestre</span><textarea rows="4" data-mx-in="npc-f" data-f="desc" placeholder="Segredos, motivações, anotações…">${esc(draft.desc)}</textarea></label>
    <div class="mx-dlg-ft"><button type="button" class="mx-btn" data-mx-act="npc-cancel">Cancelar</button><button type="button" class="mx-btn is-primary" data-mx-act="npc-save">▣ Salvar ficha</button></div>
  </form>`, {wide:true});
}
act['npc-new'] = () => { draft = blank(); abrirEditor(); };
act['npc-edit'] = el => { const f = achar(el.dataset.id); if(!f) return; draft = Object.assign(blank(), clone(f)); draft.atrs = npcAttrs(draft.atrs); abrirEditor(); };
act['npc-cancel'] = () => { const id = draft && draft.id; draft = null; if(id && achar(id)) verNpc(id); else closeDialog(); };
inp['npc-f'] = el => {
  if(!draft) return;
  const p = el.dataset.f, num_ = ['pv','pe','def','atrs.fis','atrs.emo','atrs.men'].indexOf(p) >= 0;
  setPath(draft, p, num_ ? (el.value === '' ? 0 : num(el.value)) : el.value);
};
inp['npc-at'] = el => { if(draft && draft.ataques[num(el.dataset.i)]) draft.ataques[num(el.dataset.i)][el.dataset.f] = el.value; };
act['npc-add-at'] = () => { draft.ataques.push({nome:'', bonus:'', dano:'', tipo:''}); paintListas(); const ins = document.querySelectorAll('#mx-npc-ats .mx-atrow'); const l = ins[ins.length - 1]; if(l) l.querySelector('input').focus(); };
act['npc-del-at'] = el => { draft.ataques.splice(num(el.dataset.i), 1); paintListas(); };
act['npc-add-inv'] = () => {
  const n = (document.getElementById('mx-ni-n').value || '').trim(); if(!n) return;
  draft.inv.push({nome:n, qtd:Math.max(1, num(document.getElementById('mx-ni-q').value, 1))});
  document.getElementById('mx-ni-n').value = ''; document.getElementById('mx-ni-q').value = '1';
  paintListas(); document.getElementById('mx-ni-n').focus();
};
act['npc-del-inv'] = el => { draft.inv.splice(num(el.dataset.i), 1); paintListas(); };
act['npc-add-rit'] = () => {
  const n = (document.getElementById('mx-nr-n').value || '').trim(); if(!n) return;
  draft.rituais.push({nome:n, elem:document.getElementById('mx-nr-e').value.trim(), circ:document.getElementById('mx-nr-c').value.trim()});
  ['n','e','c'].forEach(k => { document.getElementById('mx-nr-' + k).value = ''; });
  paintListas(); document.getElementById('mx-nr-n').focus();
};
act['npc-del-rit'] = el => { draft.rituais.splice(num(el.dataset.i), 1); paintListas(); };
document.addEventListener('keydown', e => {
  if(e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.mxEnter) return;
  e.preventDefault(); const fn = act[e.target.dataset.mxEnter]; if(fn) fn(e.target, e);
});

act['npc-save'] = () => {
  if(!draft) return;
  const n = (draft.nome || '').trim();
  if(!n){ toast('Escreva o nome do NPC.'); return; }
  const f = clone(draft);
  f.nome = n; f.pv = Math.max(1, num(f.pv, 20));
  f.ataques = f.ataques.filter(a => (a.nome || '').trim());
  if(f.id){
    const old = achar(f.id);
    f.pvAtual = clamp(old && old.pvAtual != null ? old.pvAtual : f.pv, 0, f.pv);
    const i = lista().findIndex(x => x.id === f.id);
    if(i >= 0) lista()[i] = f; else lista().push(f);
  }else{
    f.id = 'nf_' + Date.now(); f.pvAtual = f.pv; lista().push(f);
  }
  salvar(); draft = null; paintGrid(); verNpc(f.id);
  toast('“' + n + '” salva.');
};
act['npc-dup'] = el => {
  const f = achar(el.dataset.id); if(!f) return;
  const c = clone(f); c.id = 'nf_' + Date.now(); c.nome = f.nome + ' (cópia)'; c.pvAtual = c.pv;
  lista().push(c); salvar(); paintGrid(); verNpc(c.id); toast('Ficha duplicada.');
};
act['npc-dup-n'] = el => {
  const f = achar(el.dataset.id); if(!f) return;
  const v = prompt('Quantas cópias numeradas de “' + f.nome + '”? (1 a 20)', '3');
  if(v === null) return;
  const n = clamp(num(v, 0), 0, 20);
  if(!n){ toast('Número inválido.'); return; }
  const base = f.nome.replace(/\s+\d+$/, '');
  const nomes = {}; lista().forEach(x => { nomes[x.nome] = true; });
  let k = 2, feitas = 0;
  while(feitas < n){
    const nm = base + ' ' + k++;
    if(nomes[nm]) continue;
    const c = clone(f); c.id = 'nf_' + Date.now() + '_' + feitas; c.nome = nm; c.pvAtual = c.pv;
    lista().push(c); nomes[nm] = true; feitas++;
  }
  salvar(); paintGrid(); verNpc(f.id, true);
  toast(n + (n === 1 ? ' cópia criada' : ' cópias criadas') + ' (' + base + ' 2…).');
};
act['npc-del'] = el => {
  const f = achar(el.dataset.id); if(!f) return;
  if(!confirm('Apagar a ficha de “' + f.nome + '”?')) return;
  M().npcFichas = lista().filter(x => x.id !== f.id);
  salvar(); closeDialog(); paintGrid(); toast('Ficha apagada.');
};

})();
