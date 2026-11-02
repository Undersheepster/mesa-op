/* ════════════════════════════════════════════════════════════
   NIVEL.JS — Sistema de Nível (v2)
   ────────────────────────────────────────────────────────────
   O QUE MUDOU EM RELAÇÃO AO NEX
   · O agente acumula XP; o nível (1–100) é derivado do XP.
   · Nível 15: Transcendência Forçada (o Mestre pode mudar o valor).
   · Nível 100: o agente vira Existido.
   · O Mestre concede XP (aba Mestre › Nível) e o agente recebe com
     o aviso de subida de nível. O PRÓPRIO agente também pode somar
     ou retirar XP, subir/descer níveis e ir direto a um nível pela
     janela de progressão (ligado por padrão; o Mestre pode desligar
     — xpCfg.manual === false). Tudo cai no histórico.

   CURVA
   · Cada nível custa um pouco mais que o anterior:
         custo(n → n+1) = 100 + 4·(n−1), arredondado para 10
     Nv 2 = 100 XP · Nv 15 ≈ 1.960 XP · Nv 50 ≈ 9.700 XP · Nv 100 ≈ 29.300 XP

   O QUE SOBE A CADA NÍVEL
   · PV e PD crescem NÍVEL A NÍVEL (antes só a cada 5%). A
     conta é a mesma do livro, distribuída em 99 passos:
         bônus = ⌊ (ganho por degrau) × (nível − 1) × 19 / 99 ⌋
     No nível 100 o total é idêntico ao do antigo NEX 99%.
   · Ao subir, o valor ATUAL de PV/PD sobe junto com o máximo.
   · O NEX continua existindo como valor derivado (para os marcos
     de trilha: 10%, 40%, 65%, 99%):
         degrau = ⌊(nível − 1) × 19 / 99⌋  →  NEX_DEGRAUS

   DADOS
     personagem  c.xp (verdade) · c.nivel · c.nex (derivados) · c.xpV (esquema)
                 c.xpVisto (última concessão aplicada) · c.xpHist (últimos ganhos)
     Mestre      db.mestre.xpConcessoes = { usuário: [{n, qtd, motivo, ts}] }
                 db.mestre.xpCfg = { manual }
       O Mestre só ESCREVE concessões; cada cliente aplica as suas
       (mesmo padrão da Transcendência Forçada — nunca escreve na ficha
       de outra pessoa, para evitar corrida de sincronização).

   MIGRAÇÃO
     · Ficha sem XP: pelo NEX que tinha (NEX 15% → Nv 12), limitado ao 99
       para ninguém virar Existido sem querer.
     · Ficha da 1ª versão do sistema (curva fixa de 100 XP): mantém o
       NÍVEL que tinha.

   Carregado logo depois de ficha.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const NIVEL_MAX   = 100;
const NIVEL_TRANS = 15;      // padrão da Transcendência Forçada
const GRAUS       = 19;      // degraus de NEX acima do primeiro
const ESQUEMA     = 2;

/* ───────────── curva ───────────── */
const custo = n => 10 * Math.round((100 + 4 * (n - 1)) / 10);   // n → n+1
const ACUM = [0, 0];                                             // ACUM[n] = XP para ser nível n
for(let n = 1; n < NIVEL_MAX; n++) ACUM[n + 1] = ACUM[n] + custo(n);
const XP_MAX = ACUM[NIVEL_MAX];

const $ = id => document.getElementById(id);
const toInt = x => parseInt(x, 10);
const clampXp = x => Math.min(XP_MAX, Math.max(0, toInt(x) || 0));
const clampNv = n => Math.min(NIVEL_MAX, Math.max(1, toInt(n) || 1));
const fmt = n => Number(n).toLocaleString('pt-BR');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function nivelDeXp(xp){
  xp = clampXp(xp);
  let lo = 1, hi = NIVEL_MAX;
  while(lo < hi){ const m = (lo + hi + 1) >> 1; if(ACUM[m] <= xp) lo = m; else hi = m - 1; }
  return lo;
}
const xpDoNivel = n => ACUM[clampNv(n)];
const degrauDeNivel = n => Math.floor((clampNv(n) - 1) * GRAUS / (NIVEL_MAX - 1));
const nexDeNivel = n => NEX_DEGRAUS[degrauDeNivel(n)];
/* ganho acumulado até o nível n, para um ganho de "porDegrau" por degrau do livro */
const escala = (n, porDegrau) => Math.floor(porDegrau * (clampNv(n) - 1) * GRAUS / (NIVEL_MAX - 1));

/* menor nível cujo degrau já é o do NEX informado (limitado a 99) */
function nivelDeNex(nex){
  const d = nexDegrau(nex);
  if(d <= 0) return 1;
  return Math.min(NIVEL_MAX - 1, Math.ceil(d * (NIVEL_MAX - 1) / GRAUS) + 1);
}
const ehExistido = c => !!(c && c.existido && c.existido.ativo);

/* ───────────── estado do personagem ───────────── */
function aplicar(c){
  if(!c) return c;
  if(c.xpV !== ESQUEMA){
    let nv;
    if(c.xp == null || isNaN(toInt(c.xp))) nv = nivelDeNex(c.nex);
    else nv = Math.min(NIVEL_MAX, Math.floor(clampXp(c.xp) / 100) + 1);   // 1ª versão: 100 XP fixos
    const parcial = (c.xp == null || isNaN(toInt(c.xp))) ? 0 : (toInt(c.xp) % 100);
    c.xp = nv >= NIVEL_MAX ? XP_MAX : ACUM[nv] + Math.min(parcial, custo(nv) - 1);
    c.xpV = ESQUEMA;
  }
  if(ehExistido(c)) c.xp = XP_MAX;
  c.xp = clampXp(c.xp);
  c.nivel = nivelDeXp(c.xp);
  c.nex = nexDeNivel(c.nivel);
  return c;
}
/* versão que não mexe na ficha original (serve para fichas de outros agentes e importadas) */
const copia = c => aplicar({xp: c && c.xp, xpV: c && c.xpV, nex: c && c.nex, existido: c && c.existido});
const de = c => c ? copia(c).nivel : 1;
const xpDe = c => c ? copia(c).xp : 0;

function info(c){
  const t = copia(c), nv = t.nivel, max = nv >= NIVEL_MAX;
  const base = ACUM[nv], prox = max ? XP_MAX : ACUM[nv + 1];
  return {
    nivel: nv, xp: t.xp, nex: t.nex, max, base, prox,
    falta: max ? 0 : prox - t.xp,
    pct: max ? 100 : Math.round((t.xp - base) / (prox - base) * 100),
  };
}

const meuChar = () => {
  if(typeof isMestre !== 'undefined' && isMestre) return null;
  if(typeof userChar !== 'function' || typeof currentUser === 'undefined' || !currentUser) return null;
  return userChar(currentUser);
};

/* lido por getFormChar() (app.js) ao salvar: o XP nunca vem de um campo da tela */
function doForm(){
  const c = meuChar();
  if(!c) return {};
  aplicar(c);
  return {xp: c.xp, xpV: c.xpV, nivel: c.nivel, nex: c.nex};
}

/* ───────────── mudança de XP ───────────── */
const sinal = n => (n > 0 ? '+' : '') + n;

function mudarXp(c, novoXp, meta){
  aplicar(c);
  const nvAntes = c.nivel, xpAntes = c.xp, antes = calcMaxStats(c);
  c.xp = clampXp(novoXp);
  aplicar(c);
  const res = {nvAntes, nvDepois: c.nivel, delta: c.xp - xpAntes, ganho: {pv:0, san:0, esf:0}};
  if(c.nivel !== nvAntes){
    const dep = calcMaxStats(c);
    res.ganho = {pv: dep.pvMax - antes.pvMax, san: dep.sanMax - antes.sanMax, esf: dep.esfMax - antes.esfMax};
    if(!c._manualStats){
      if(c.nivel > nvAntes){          // o valor atual acompanha o ganho do máximo
        if(res.ganho.pv  > 0) c.pv  = Math.min(dep.pvMax,  (c.pv  || 0) + res.ganho.pv);
        if(res.ganho.san > 0) c.san = Math.min(dep.sanMax, (c.san || 0) + res.ganho.san);
        if(res.ganho.esf > 0) c.esf = Math.min(dep.esfMax, (c.esf || 0) + res.ganho.esf);
      }
      c.pvMax = dep.pvMax; c.sanMax = dep.sanMax; c.esfMax = dep.esfMax;
      c.pv = Math.min(c.pv, c.pvMax); c.san = Math.min(c.san, c.sanMax); c.esf = Math.min(c.esf, c.esfMax);
    }
  }
  if(meta && res.delta){
    if(!Array.isArray(c.xpHist)) c.xpHist = [];
    c.xpHist.unshift({qtd: res.delta, motivo: meta.motivo || '', origem: meta.origem || 'mestre', ts: meta.ts || Date.now()});
    if(c.xpHist.length > 30) c.xpHist.length = 30;
  }
  return res;
}

function depois(res, c){
  if(typeof recalcMaxStats === 'function') recalcMaxStats(true);
  pintar();
  if(typeof fxSync === 'function') try{ fxSync(); }catch(e){}
  if(typeof fxSyncIdent === 'function') try{ fxSyncIdent(); }catch(e){}
  if(typeof renderStats === 'function') try{ renderStats(); }catch(e){}
  if(typeof _publishMyStatus === 'function') try{ _publishMyStatus(); }catch(e){}
  if(res.nvDepois > res.nvAntes) anunciar(res, c);
  else if(res.nvDepois < res.nvAntes) toast('Nível ' + res.nvDepois + ' (' + sinal(res.delta) + ' XP).', '#c49a00');
  /* nível 100 (Existido) e Transcendência Forçada reagem ao novo nível — depois do aviso */
  setTimeout(() => {
    if(typeof _checkExistidoTrigger === 'function') try{ _checkExistidoTrigger(); }catch(e){}
    if(typeof _checkTransForcadaTrigger === 'function') try{ _checkTransForcadaTrigger(); }catch(e){}
  }, res.nvDepois > res.nvAntes ? 3200 : 50);
}

/* ───────────── concessões do Mestre ───────────── */
let _proc = false;
function processar(){
  if(_proc) return false;
  const c = meuChar(); if(!c) return false;
  _proc = true;
  try{
    aplicar(c);
    const lista = (db.mestre && db.mestre.xpConcessoes && db.mestre.xpConcessoes[currentUser]) || [];
    const visto = c.xpVisto || 0;
    const novas = lista.filter(g => g && g.n > visto).sort((a, b) => a.n - b.n);
    if(!novas.length){ pintar(); return false; }
    if(ehExistido(c)){ c.xpVisto = novas[novas.length - 1].n; saveDB(); pintar(); return false; }
    let total = 0, res = null;
    novas.forEach(g => {
      const r = mudarXp(c, c.xp + (toInt(g.qtd) || 0), {motivo: g.motivo, origem: 'mestre', ts: g.ts});
      total += r.delta;
      res = res ? {nvAntes: res.nvAntes, nvDepois: r.nvDepois, delta: res.delta + r.delta,
                   ganho: {pv: res.ganho.pv + r.ganho.pv, san: res.ganho.san + r.ganho.san, esf: res.ganho.esf + r.ganho.esf}} : r;
    });
    c.xpVisto = novas[novas.length - 1].n;
    saveDB();
    if(res.nvDepois === res.nvAntes) toast('✦ ' + sinal(total) + ' XP' + (novas.length === 1 && novas[0].motivo ? ' — ' + novas[0].motivo : '') + '.', '#d8a050');
    depois(res, c);
    return true;
  }finally{ _proc = false; }
}

/* ───────────── animações auxiliares ───────────── */
const reduzido = () => { try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } };
const _anim = new WeakMap();
/* conta de um valor a outro (número inteiro) */
function contar(el, de, para, dur, fmtFn){
  if(!el) return;
  const f = fmtFn || (v => String(v));
  if(reduzido() || de === para){ el.textContent = f(para); return; }
  const id = (_anim.get(el) || 0) + 1; _anim.set(el, id);
  const t0 = performance.now();
  const passo = t => {
    if(_anim.get(el) !== id) return;
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = f(Math.round(de + (para - de) * e));
    if(k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
function reagir(el, cls, ms){
  if(!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms || 800);
}
/* "+120 XP" subindo a partir do cartão de nível */
function flutuar(txt, neg){
  if(reduzido()) return;
  const cands = [$('nv-card'), $('nv-card-side')].filter(Boolean);
  const alvo = cands.find(e => e.getBoundingClientRect().width > 0); if(!alvo) return;
  const r = alvo.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'nv-float' + (neg ? ' neg' : ''); d.textContent = txt;
  d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + 4) + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1500);
}

/* ───────────── aviso de subida de nível ───────────── */
function anunciar(res, c){
  const velho = $('nv-up'); if(velho) velho.remove();
  const el = document.createElement('div');
  el.id = 'nv-up'; el.className = 'nv-up'; el.setAttribute('role', 'status');
  const g = res.ganho, partes = [];
  if(g.pv  > 0) partes.push('<span class="pv">+' + g.pv + ' PV</span>');
  if(g.esf > 0) partes.push('<span class="pe">+' + g.esf + ' PD</span>');
  const sobe = res.nvDepois - res.nvAntes;
  const nexMudou = nexDeNivel(res.nvAntes) !== nexDeNivel(res.nvDepois);
  const tf = window.TransForcada && TransForcada.cfg ? TransForcada.cfg() : null;
  const tfCruzou = tf && tf.ativo && res.nvAntes < tf.nivel && res.nvDepois >= tf.nivel;
  /* raios e brasas (só decoração) */
  let enfeite = '';
  if(!reduzido()){
    for(let i = 0; i < 14; i++) enfeite += '<i class="nv-raio" style="--a:' + (i * 360 / 14) + 'deg;--d:' + (i % 4) * .05 + 's"></i>';
    for(let i = 0; i < 22; i++){
      const x = Math.round(Math.random() * 100), dl = (Math.random() * 1.2).toFixed(2), du = (1.8 + Math.random() * 1.8).toFixed(2), dx = Math.round(Math.random() * 60 - 30);
      enfeite += '<s class="nv-brasa" style="left:' + x + '%;--dl:' + dl + 's;--du:' + du + 's;--dx:' + dx + 'px"></s>';
    }
  }
  el.innerHTML = '<div class="nv-up-fx" aria-hidden="true">' + enfeite + '</div>' +
  `<div class="nv-up-box">
    <small>${sobe > 1 ? 'Nível ' + res.nvAntes + ' →' : 'Subiu para o'}</small>
    <b><span id="nv-up-num">${res.nvAntes}</span></b>
    <div class="nv-up-ganho">${partes.join('') || '<span>—</span>'}</div>
    ${nexMudou ? '<em>NEX ' + nexDeNivel(res.nvDepois) + '%</em>' : ''}
    ${tfCruzou ? '<em class="alerta">O Outro Lado está de olho em você…</em>' : ''}
    ${res.nvDepois >= NIVEL_MAX ? '<em class="alerta">Você alcançou o limite do que é humano.</em>' : ''}
  </div>`;
  const fecha = () => { el.classList.add('sai'); setTimeout(() => el.remove(), 320); };
  el.onclick = fecha;
  document.body.appendChild(el);
  const num = el.querySelector('#nv-up-num');
  const rot = el.querySelector('.nv-up-box b');
  if(rot) rot.insertBefore(document.createTextNode('NÍVEL '), num);
  setTimeout(() => contar(num, res.nvAntes, res.nvDepois, Math.min(1400, 500 + sobe * 90)), 450);
  setTimeout(fecha, 5200);
}

/* ───────────── bloco da ficha ───────────── */
let _ult = null;      // {xp, nv} da última pintura (para animar só o que mudou)
function pintar(){
  const c = meuChar();
  if(_ult && _ult.u !== (typeof currentUser !== 'undefined' ? currentUser : null)) _ult = null;
  const i = info(c || {});
  const ex = ehExistido(c);
  const nv = $('fx-nivel');
  const mudouNv = _ult && _ult.nv !== i.nivel, mudouXp = _ult && _ult.xp !== i.xp;
  if(nv){
    if(mudouNv) contar(nv, _ult.nv, i.nivel, 500); else nv.textContent = i.nivel;
  }
  const nexIn = $('f-nex'); if(nexIn) nexIn.value = i.nex;
  /* cartão lateral (todas as abas) */
  const side = $('nv-side');
  if(side){
    side.hidden = !c;
    const sn = $('nv-side-num');
    if(sn){ if(mudouNv) contar(sn, _ult.nv, i.nivel, 500); else sn.textContent = i.nivel; }
    const sf = $('nv-side-fill'); if(sf) sf.style.width = i.pct + '%';
    const sx = $('nv-side-xp');
    if(sx){
      if(mudouXp && !ex && !i.max) contar(sx, _ult.xp, i.xp, 600, v => fmt(v) + ' / ' + fmt(i.prox) + ' XP');
      else sx.textContent = ex ? 'Existido' : i.max ? fmt(i.xp) + ' XP · máximo' : fmt(i.xp) + ' / ' + fmt(i.prox) + ' XP';
    }
    const sc = $('nv-card-side');
    if(sc){
      sc.classList.toggle('is-existido', ex);
      sc.title = $('nv-card') ? $('nv-card').title : '';
      if(mudouNv) reagir(sc, i.nivel > _ult.nv ? 'subiu' : 'desceu', 1100);
      else if(mudouXp) reagir(sc, _ult.xp < i.xp ? 'ganhou' : 'perdeu', 700);
    }
  }
  const fill = $('nv-bar-fill'); if(fill) fill.style.width = i.pct + '%';
  const txt = $('nv-xp-txt');
  if(txt){
    const alvoTxt = ex ? 'Existido' : i.max ? fmt(i.xp) + ' XP · máximo' : fmt(i.xp) + ' / ' + fmt(i.prox) + ' XP';
    if(mudouXp && !ex && !i.max) contar(txt, _ult.xp, i.xp, 600, v => fmt(v) + ' / ' + fmt(i.prox) + ' XP');
    else txt.textContent = alvoTxt;
  }
  const card = $('nv-card');
  if(card){
    card.classList.toggle('is-existido', ex);
    card.title = ex ? 'Existido — nível fixo' : i.max ? 'Nível máximo' : 'Faltam ' + fmt(i.falta) + ' XP para o nível ' + (i.nivel + 1) + ' · clique para ver a progressão';
    if(mudouNv) reagir(card, i.nivel > _ult.nv ? 'subiu' : 'desceu', 1100);
    else if(mudouXp) reagir(card, _ult.xp < i.xp ? 'ganhou' : 'perdeu', 700);
  }
  if(_ult && mudouXp) flutuar(sinal(i.xp - _ult.xp) + ' XP', i.xp < _ult.xp);
  _ult = {xp: i.xp, nv: i.nivel, u: typeof currentUser !== 'undefined' ? currentUser : null};
  if($('nv-dlg')) atualizarDlg();
}

/* ───────────── janela de progressão ───────────── */
/* O ajuste pelo próprio agente vem LIGADO; o Mestre pode desligar (xpCfg.manual === false). */
const manualLiberado = () => !(db.mestre && db.mestre.xpCfg && db.mestre.xpCfg.manual === false);
const dataCurta = ts => { const d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };

function previa(c){
  const i = info(c); if(i.max) return '';
  const atual = calcMaxStats(c);
  const t = copia(c); t.xp = ACUM[i.nivel + 1]; aplicar(t);
  const fut = Object.assign({}, c, {xp: t.xp, xpV: ESQUEMA, nex: t.nex, existido: null});
  const dep = calcMaxStats(fut);
  const g = [['PV', dep.pvMax - atual.pvMax, 'pv'], ['PD', dep.esfMax - atual.esfMax, 'pe']]
    .map(x => `<span class="${x[2]}">${x[1] > 0 ? '+' + x[1] : '±0'} ${x[0]}</span>`).join('');
  return `<h5>Ao chegar no nível ${i.nivel + 1}</h5><div class="nv-ganhos">${g}</div>`;
}

function marcos(c){
  const i = info(c), tf = window.TransForcada && TransForcada.cfg ? TransForcada.cfg() : {ativo: true, nivel: NIVEL_TRANS};
  const itens = [];
  if(tf.ativo){
    const jaFoi = !!(c.transForcada && (c.transForcada.concluida || c.transForcada.usada));
    itens.push({nv: tf.nivel, nome: 'Transcendência Forçada', ok: jaFoi, feito: jaFoi});
  }
  const proxNex = NEX_DEGRAUS.find((_, k) => k > degrauDeNivel(i.nivel));
  if(proxNex){
    const k = NEX_DEGRAUS.indexOf(proxNex);
    itens.push({nv: Math.ceil(k * (NIVEL_MAX - 1) / GRAUS) + 1, nome: 'NEX ' + proxNex + '%', ok: false});
  }
  itens.push({nv: NIVEL_MAX, nome: 'Existido', ok: ehExistido(c), feito: ehExistido(c)});
  return `<h5>Marcos</h5><ul class="nv-marcos">` +
    itens.sort((a, b) => a.nv - b.nv).map(m =>
      `<li class="${m.feito ? 'ok' : i.nivel >= m.nv ? 'at' : ''}"><b>Nv ${m.nv}</b><span>${esc(m.nome)}</span><i>${m.feito ? '✓' : i.nivel >= m.nv ? '●' : 'faltam ' + (m.nv - i.nivel)}</i></li>`
    ).join('') + `</ul>`;
}

function historico(c){
  const h = Array.isArray(c.xpHist) ? c.xpHist.slice(0, 8) : [];
  if(!h.length) return `<h5>Histórico</h5><p class="nv-vazio">Nenhum XP registrado ainda.</p>`;
  return `<h5>Histórico</h5><ul class="nv-hist">` + h.map((x, k) =>
    `<li style="--k:${k}"><time>${dataCurta(x.ts)}</time><b class="${x.qtd < 0 ? 'neg' : ''}">${sinal(x.qtd)} XP</b><span>${esc(x.motivo || (x.origem === 'manual' ? 'Ajuste manual' : 'Sem motivo'))}</span></li>`).join('') + `</ul>`;
}

/* formulário de autoatendimento (montado uma vez, para não perder foco nem texto digitado) */
function formAjuste(){
  const chips = [10, 25, 50, 100, 250].map(v => `<button type="button" class="nv-chip" onclick="nvChip(${v})">+${v}</button>`).join('');
  return `<h5>Ganhar XP</h5>
    <div class="nv-chips">${chips}</div>
    <div class="nv-manual">
      <input id="nv-man" type="number" step="1" inputmode="numeric" placeholder="XP" aria-label="Quantidade de XP" onkeydown="if(event.key==='Enter'){event.preventDefault();nvManual(1)}">
      <button type="button" class="fx-btn nv-ok" onclick="nvManual(1)">+ Adicionar</button>
      <button type="button" class="fx-btn nv-menos" onclick="nvManual(-1)" title="Retirar este XP">− Retirar</button>
    </div>
    <input id="nv-motivo" class="nv-motivo" type="text" maxlength="60" placeholder="Motivo (opcional) — aparece no histórico" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();nvManual(1)}">
    <h5 class="nv-h5-nivel">Nível</h5>
    <div class="nv-nivel-ctl">
      <button type="button" class="fx-btn" id="nv-menos1" onclick="nvNivel(-1)" aria-label="Descer um nível">− 1 nível</button>
      <button type="button" class="fx-btn nv-ok" id="nv-mais1" onclick="nvNivel(1)" aria-label="Subir um nível">+ 1 nível</button>
    </div>
    <div class="nv-manual nv-ir">
      <input id="nv-ir" type="number" min="1" max="${NIVEL_MAX}" step="1" inputmode="numeric" placeholder="Ir para o nível…" aria-label="Ir direto para o nível" onkeydown="if(event.key==='Enter'){event.preventDefault();nvIr()}">
      <button type="button" class="fx-btn" onclick="nvIr()">Ir</button>
    </div>
    <p class="nv-vazio" id="nv-aviso">Tudo fica registrado no histórico. O Mestre também pode conceder XP.</p>`;
}

function abrir(foco){
  const c = meuChar(); if(!c) return;
  aplicar(c);
  let d = $('nv-dlg');
  if(!d){
    d = document.createElement('div');
    d.id = 'nv-dlg'; d.className = 'nv-dlg';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Progressão de nível');
    d.addEventListener('mousedown', e => { if(e.target === d) fechar(); });
    d.innerHTML = `<div class="nv-box">
      <button type="button" class="nv-x" onclick="nvFechar()" aria-label="Fechar">×</button>
      <header><small>Progressão</small><h4>Nível <b id="nv-d-nv">1</b></h4><span id="nv-d-nex"></span></header>
      <div class="nv-prog"><div class="nv-bar big"><i id="nv-d-bar" style="width:0"></i></div><p id="nv-d-txt"></p></div>
      <div class="nv-sec" id="nv-d-prev"></div>
      <div class="nv-sec" id="nv-d-marc"></div>
      <div class="nv-sec" id="nv-d-hist"></div>
      <div class="nv-sec" id="nv-d-form"></div>
    </div>`;
    document.body.appendChild(d);
    document.addEventListener('keydown', teclaEsc);
    d._nv = null; d._form = null;
    atualizarDlg(true);
    requestAnimationFrame(() => d.classList.add('aberto'));
    if(foco === true) setTimeout(() => { const m = $('nv-man'); if(m) m.focus(); }, 120);
  } else if(foco === true){ const m = $('nv-man'); if(m) m.focus(); }
}

function atualizarDlg(primeira){
  const c = meuChar(), d = $('nv-dlg'); if(!c || !d) return;
  aplicar(c);
  const i = info(c), ex = ehExistido(c);
  const nvEl = $('nv-d-nv');
  if(primeira || d._nv == null) nvEl.textContent = i.nivel; else if(d._nv !== i.nivel){ contar(nvEl, d._nv, i.nivel, 450); reagir(nvEl, 'pulo', 700); }
  d._nv = i.nivel;
  $('nv-d-nex').textContent = 'NEX ' + i.nex + '%';
  const bar = $('nv-d-bar');
  if(primeira){ bar.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = i.pct + '%'; })); }
  else bar.style.width = i.pct + '%';
  $('nv-d-txt').innerHTML = ex ? 'Existido — o nível está fixo.' : i.max ? fmt(i.xp) + ' XP · nível máximo' :
    fmt(i.xp) + ' / ' + fmt(i.prox) + ' XP · faltam <b>' + fmt(i.falta) + '</b> para o nível ' + (i.nivel + 1);
  const pv = ex ? '' : previa(c);
  $('nv-d-prev').innerHTML = pv; $('nv-d-prev').hidden = !pv;
  $('nv-d-marc').innerHTML = marcos(c);
  $('nv-d-hist').innerHTML = historico(c);
  const quer = (!ex && manualLiberado()) ? 'sim' : ex ? 'ex' : 'nao';
  if(d._form !== quer){
    d._form = quer;
    $('nv-d-form').innerHTML = quer === 'sim' ? formAjuste() :
      `<h5>Ajuste</h5><p class="nv-vazio">${quer === 'ex' ? 'Existido — o nível está fixo.' : 'O Mestre desligou o ajuste de XP pelos agentes. XP só chega por concessão dele.'}</p>`;
    $('nv-d-form').hidden = false;
  }
  if(quer === 'sim'){
    const m1 = $('nv-menos1'), p1 = $('nv-mais1');
    if(m1) m1.disabled = i.nivel <= 1;
    if(p1) p1.disabled = i.nivel >= NIVEL_MAX;
  }
}
function fechar(){
  const d = $('nv-dlg'); if(!d) return;
  document.removeEventListener('keydown', teclaEsc);
  d.classList.remove('aberto'); d.classList.add('fecha');
  setTimeout(() => { if(d.classList.contains('fecha')) d.remove(); }, 180);
}
function teclaEsc(e){ if(e.key === 'Escape') fechar(); }

/* ───────────── ajuste feito pelo próprio agente ───────────── */
let _conf100 = 0;
function aviso(t){ const a = $('nv-aviso'); if(a){ a.textContent = t; a.classList.remove('flash'); void a.offsetWidth; a.classList.add('flash'); } toast(t); }

function aplicarPropio(novoXp, motivo){
  const c = meuChar(); if(!c) return false;
  aplicar(c);
  /* chegar ao 100 vira Existido — pede confirmação em dois toques */
  if(clampXp(novoXp) >= XP_MAX && c.xp < XP_MAX){
    if(Date.now() - _conf100 > 5000){
      _conf100 = Date.now();
      aviso('⚠ O nível 100 transforma seu agente em Existido. Repita a ação em até 5 s para confirmar.');
      return false;
    }
  }
  _conf100 = 0;
  const res = mudarXp(c, novoXp, {motivo, origem: 'manual'});
  if(!res.delta){ aviso(c.xp >= XP_MAX && novoXp > c.xp ? 'Você já está no nível máximo.' : 'Nada mudou.'); return false; }
  saveDB(); if(typeof autoSave === 'function') try{ autoSave(); }catch(e){}
  depois(res, c);
  return true;
}
function guardaLiberado(){
  const c = meuChar();
  if(!c || ehExistido(c)) return null;
  if(!manualLiberado()){ toast('O Mestre desligou o ajuste de XP pelos agentes.'); atualizarDlg(); return null; }
  return c;
}
/* sinal: +1 soma, −1 retira */
function manual(sg){
  const c = guardaLiberado(); if(!c) return;
  const inp = $('nv-man'), v = inp ? Math.abs(toInt(inp.value)) : NaN;
  if(!v){ toast('Informe quanto XP.'); if(inp) inp.focus(); return; }
  const mot = ($('nv-motivo') && $('nv-motivo').value.trim().slice(0, 60)) || (sg < 0 ? 'Ajuste manual (−)' : 'Ajuste manual');
  aplicar(c);
  if(aplicarPropio(c.xp + (sg < 0 ? -v : v), mot)){
    if(inp) inp.value = '';
    if($('nv-motivo')) $('nv-motivo').value = '';
  }
}
function chip(v){
  const c = guardaLiberado(); if(!c) return;
  aplicar(c);
  aplicarPropio(c.xp + v, ($('nv-motivo') && $('nv-motivo').value.trim().slice(0, 60)) || 'Ajuste manual');
}
/* +1 / −1 nível: vai para o início do nível vizinho */
function nivelRel(d){
  const c = guardaLiberado(); if(!c) return;
  aplicar(c);
  const alvo = clampNv(c.nivel + d);
  if(alvo === c.nivel){ aviso(d > 0 ? 'Você já está no nível máximo.' : 'Você já está no nível 1.'); return; }
  aplicarPropio(ACUM[alvo], 'Nível ' + c.nivel + ' → ' + alvo);
}
function nivelIr(){
  const c = guardaLiberado(); if(!c) return;
  const inp = $('nv-ir'), n = inp ? toInt(inp.value) : NaN;
  if(!n || n < 1 || n > NIVEL_MAX){ toast('Informe um nível de 1 a ' + NIVEL_MAX + '.'); if(inp) inp.focus(); return; }
  aplicar(c);
  if(n === c.nivel){ toast('Você já está no nível ' + n + '.'); return; }
  if(aplicarPropio(ACUM[n], 'Nível ' + c.nivel + ' → ' + n) && inp) inp.value = '';
}

window.Nivel = {
  MAX: NIVEL_MAX, XP_MAX, TRANS_FORCADA: NIVEL_TRANS,
  custo, nivelDeXp, xpDoNivel, nexDeNivel, escala,
  de, xpDe, info, aplicar, doForm, pintar, processar, abrir, fechar,
};
window.nvAbrir = foco => abrir(foco);
window.nvFechar = fechar;
window.nvManual = manual;
window.nvChip = chip;
window.nvNivel = nivelRel;
window.nvIr = nivelIr;
})();
