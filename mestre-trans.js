/* ════════════════════════════════════════════════════════════
   MESTRE-TRANS.JS — seção "Transcendência" da aba Mestre
   ────────────────────────────────────────────────────────────
   · Sua Transcendência (Narrador)
   · Liberação por agente (sem NEX mínimo): cada liberação é uma
     PASSAGEM que sobe 1 grau (ver transcendencia-arvore.js)
   · Existidos  (renderExistidoMestrePanel, em app.js, preenche
     o contêiner #mx-existido criado aqui)
   · Desbloqueio manual de rituais
   · Referência dos elementos (Marca, Vias e Dádivas)
   Carregar depois de mestre.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(!window.Mestre) return;
const {S, esc, num, clamp, M, roster, C, nome, panel, empty, act, input: inp, change: chg} = Mestre;

S.rit = S.rit || {u:'', q:'', elem:''};
const ELEMS = ['Sangue','Morte','Energia','Conhecimento','Medo','Fé'];
const elemCor = e => (typeof ELEM_COR !== 'undefined' && ELEM_COR[e]) || '#a3241a';
const oficiais = () => (typeof RITUAIS_DB !== 'undefined' && typeof _RITUAIS_OFICIAIS === 'function') ? _RITUAIS_OFICIAIS() : [];
const transLib = u => !!(db.mestre && db.mestre.transLiberada && db.mestre.transLiberada[u]);

/* ritual do elemento já desbloqueado / total */
function progresso(c, elemNome){
  const lst = oficiais().filter(r => r.elem === elemNome);
  const ap = c.rituaisAprendidos || {};
  return {tot: lst.length, des: lst.filter(r => ap[r.nome]).length};
}

const TA = () => window.TransArvore;
/* texto curto do estado de transcendência de um agente */
function grauTxt(c){
  const T = TA(); if(!T || !T.temTrilha(c)) return null;
  const a = T.ativa(c), tr = T.trilha(c, a), via = T.viaDe(tr);
  return `${T.nomeDe(a)} · Grau ${T.grauInfo(tr.grau).rom}${via ? ' · ' + T.ARV[a].vias[via].nome : ''}`;
}
function passagemRot(P){
  if(P.fase === 'subir') return `Liberar Passagem — Grau ${TA().grauInfo(P.grau).rom}`;
  if(P.fase === 'nova') return 'Liberar nova faceta';
  return 'Liberar';
}

/* ── Sua transcendência (Narrador) ── */
function selfPanel(){
  const u = currentUser, c = (db.characters && db.characters[u]) || {};
  const nex = num(c.nex, 5), nvl = Nivel.de(c), lib = transLib(u);
  const jaTransc = !!(c.transcendencia && c.transcendencia.elemento);
  let titulo, sub, btn;
  const b = (a, t, cls) => `<button type="button" class="mx-btn ${cls}" data-mx-act="${a}">${t}</button>`;
  if(lib){
    titulo = '◈ Transcendência disponível';
    sub = 'ELE estendeu a mão. Vá até a sua ficha para transcender.';
    btn = b('self-rev', 'Revogar', 'is-danger');
  }else if(jaTransc && TA() && TA().temTrilha(c)){
    const a = TA().ativa(c), ed = TRANSCENDENCIA_ELEMENTOS[a], P = TA().proximaPassagem(c);
    titulo = `<span style="color:${esc(ed.cor)}">✦ ${esc(grauTxt(c))}</span>`;
    sub = `${progresso(c, ed.nome).des}/${progresso(c, ed.nome).tot} rituais · Nv ${nvl}${P.fase === 'acerto' ? ' · dádivas pendentes' : ''}`;
    btn = P.fase === 'completo' ? '' : P.fase === 'acerto' ? '' : b('self-lib', passagemRot(P), 'is-gold');
  }else{
    titulo = '⛧ Transcendência bloqueada';
    sub = `Nv ${nvl} — sem nível mínimo.`;
    btn = b('self-lib', 'Liberar', 'is-gold');
  }
  return panel('Sua transcendência — Narrador', `<div class="mx-row"><div class="mx-row-tx"><b>${titulo}</b><span>${sub}</span></div>${btn}</div>`, {cls:'is-gold'});
}
act['self-lib'] = () => { Mestre.setTrans(currentUser, true); toast('⛧ Sua Transcendência foi liberada — vá até a aba Transcendência para transcender.', '#d8a050'); };
act['self-rev'] = () => Mestre.setTrans(currentUser, false);

/* ── Liberação por agente ── */
function controlPanel(){
  const us = roster(), T = TA();
  const intro = `<p class="mx-lead">Cada liberação é uma <b>Passagem</b> e sobe um grau da Transcendência (I Limiar → IV Coroa). No Grau I o agente escolhe o elemento e ganha a Marca e o ritual de afinidade; nos graus II–IV escolhe uma dádiva na árvore (a Via fica definida no II) e 2 segredos — rituais do elemento de círculo até o grau. Concluída a Coroa, a próxima Passagem abre uma nova faceta. Revogar remove só a permissão da rodada atual — não desfaz nada já concedido; use “Desfazer última” para isso.</p>`;
  if(!us.length) return panel('Liberação de transcendência', intro + empty('Nenhum agente registrado.'));
  const rows = us.map(u => {
    const c = C(u) || {}, nex = num(c.nex, 5), nvl = Nivel.de(c), lib = transLib(u), eu = esc(u);
    const tem = !!(T && T.temTrilha(c));
    let status, acao;
    const desfazer = tem && T.estado(c).log.length ? `<button type="button" class="mx-btn is-sm" data-mx-act="trans-undo" data-u="${eu}" title="Remove a última Passagem (grau, dádiva e segredo)">Desfazer última</button>` : '';
    if(tem){
      const a = T.ativa(c), ed = TRANSCENDENCIA_ELEMENTOS[a], P = T.proximaPassagem(c), tr = T.trilha(c, a);
      const dads = tr.dadivas.map(id => T.no(id)).filter(Boolean).map(n => `<span class="mx-chip" title="${esc(n.desc)}">${esc(n.nome)}</span>`).join('');
      const outras = Object.keys(T.estado(c).trilhas).filter(k => k !== a).map(k => `<span class="mx-chip" style="--cc:${elemCor(T.nomeDe(k))}">${esc(T.nomeDe(k))} · ${T.grauInfo(T.trilha(c, k).grau).rom}</span>`).join('');
      status = `<span class="mx-chip is-exist" style="--cc:${elemCor(ed.nome)}">✦ ${esc(grauTxt(c))}</span>${dads}${outras}${P.fase === 'acerto' ? '<span class="mx-chip is-gold">Dádivas pendentes (o agente resolve sozinho)</span>' : ''}${lib ? '<span class="mx-chip is-gold">Liberado</span>' : ''}`;
      if(lib) acao = `<button type="button" class="mx-btn is-danger" data-mx-act="trans-rev" data-u="${eu}">Revogar</button>`;
      else if(P.fase === 'completo') acao = '<span class="mx-chip">Todas as facetas trilhadas</span>';
      else if(P.fase === 'acerto') acao = '';
      else acao = `<button type="button" class="mx-btn is-gold" data-mx-act="trans-lib" data-u="${eu}">${esc(passagemRot(P))}</button>`;
      acao += desfazer;
    }else if(lib){
      status = '<span class="mx-chip is-gold">Liberado</span>';
      acao = `<button type="button" class="mx-btn is-danger" data-mx-act="trans-rev" data-u="${eu}">Revogar</button>`;
    }else{
      status = '<span class="mx-chip">Bloqueado</span>';
      acao = `<button type="button" class="mx-btn is-gold" data-mx-act="trans-lib" data-u="${eu}">Liberar</button>`;
    }
    return `<div class="mx-trow">
      <div class="mx-trow-id"><b>${esc(nome(u))}</b><span>${esc(c.classe || '—')} · Nv ${nvl}</span></div>
      <div class="mx-nex is-ok" title="Nível ${nvl}"><i style="width:${clamp(nvl, 0, 100)}%"></i></div>
      <div class="mx-trow-st">${status}</div>
      <div class="mx-trow-ac">${acao}</div>
    </div>`;
  }).join('');
  return panel('Liberação de transcendência', intro + `<div class="mx-trows">${rows}</div>`);
}
act['trans-undo'] = el => {
  const u = el.dataset.u, c = userChar(u), T = TA();
  if(!T || !c) return;
  const log = T.estado(c).log, prev = log[log.length - 1];
  if(!prev) return;
  const dn = prev.dadiva && T.no(prev.dadiva) ? T.no(prev.dadiva).nome : null;
  const o = prev.t === 'elem' ? `a escolha de ${T.nomeDe(prev.elem)} (Grau I)`
          : prev.t === 'acerto' ? `a dádiva ${dn || ''} de ${T.nomeDe(prev.elem)} (acerto)`
          : `o Grau ${T.grauInfo(prev.grau).rom} de ${T.nomeDe(prev.elem)}${dn ? ' — dádiva ' + dn : ''}${(prev.segredos || []).length ? ', segredos ' + prev.segredos.join(' e ') : ''}`;
  if(!confirm(`Desfazer ${o} de ${nome(u)}?`)) return;
  T.desfazer(c); saveDB();
  toast(`Última Passagem de ${nome(u)} desfeita.`, '#555');
  Mestre.paintBody(true);
};

/* ── Desbloqueio manual de rituais ── */
function ritGrid(){
  const u = S.rit.u;
  if(!u) return empty('Escolha um agente para gerenciar os rituais dele.');
  const c = C(u) || {}, ap = c.rituaisAprendidos || {};
  const q = (S.rit.q || '').toLowerCase();
  const lst = oficiais().filter(r => (!q || r.nome.toLowerCase().indexOf(q) >= 0) && (!S.rit.elem || r.elem === S.rit.elem));
  if(!lst.length) return empty('Nenhum ritual encontrado.');
  return `<div class="mx-ritgrid">${lst.map(r => {
    const on = !!ap[r.nome], cor = elemCor(r.elem);
    return `<div class="mx-rit${on ? ' is-on' : ''}" style="--cc:${cor}">
      <div class="mx-rit-tx"><b>${esc(r.nome)}</b><span>${esc(r.elem)} · ${r.circ === 0 ? 'Manifestação' : esc(r.circ) + 'º círculo'}</span></div>
      <button type="button" class="mx-btn is-sm ${on ? 'is-danger' : 'is-gold'}" data-mx-act="rit-toggle" data-u="${esc(u)}" data-r="${esc(r.nome)}">${on ? 'Revogar' : 'Liberar'}</button>
    </div>`;
  }).join('')}</div>`;
}
function ritPanel(){
  const us = roster();
  if(S.rit.u && us.indexOf(S.rit.u) < 0) S.rit.u = '';
  const body = `<p class="mx-lead">Todo ritual começa bloqueado. Aqui você libera ou revoga o acesso de um agente a qualquer ritual, independente da transcendência.</p>
    <div class="mx-filters">
      <select data-mx-ch="rit-u"><option value="">— Selecionar agente —</option>${us.map(u => `<option value="${esc(u)}"${u === S.rit.u ? ' selected' : ''}>${esc(nome(u))}</option>`).join('')}</select>
      <input type="search" class="mx-grow" placeholder="Buscar ritual…" value="${esc(S.rit.q)}" data-mx-in="rit-q">
      <select data-mx-ch="rit-elem"><option value="">Todos os elementos</option>${ELEMS.map(e => `<option${e === S.rit.elem ? ' selected' : ''}>${e}</option>`).join('')}</select>
    </div>
    <div id="mx-ritgrid-wrap">${ritGrid()}</div>`;
  return panel('Desbloqueio manual de rituais', body);
}
const paintRit = () => { const w = document.getElementById('mx-ritgrid-wrap'); if(w) w.innerHTML = ritGrid(); };
chg['rit-u'] = el => { S.rit.u = el.value; Mestre.paintBody(true); };
chg['rit-elem'] = el => { S.rit.elem = el.value; paintRit(); };
inp['rit-q'] = el => { S.rit.q = el.value; paintRit(); };
act['rit-toggle'] = el => {
  const u = el.dataset.u, nomeR = el.dataset.r, c = userChar(u);
  if(!c.rituaisAprendidos) c.rituaisAprendidos = {};
  const novo = !c.rituaisAprendidos[nomeR];
  if(novo) c.rituaisAprendidos[nomeR] = true; else delete c.rituaisAprendidos[nomeR];
  saveDB();
  toast(`Ritual “${nomeR}” ${novo ? 'liberado' : 'revogado'} para ${nome(u)}.`, novo ? '#d8a050' : '#555');
  Mestre.paintBody(true);
};

/* ── Referência ── */
function refPanel(){
  const T = TA();
  if(typeof TRANSCENDENCIA_ELEMENTOS === 'undefined' || !T) return '';
  const itens = T.elementos().map(id => {
    const ed = TRANSCENDENCIA_ELEMENTOS[id], A = T.ARV[id];
    const nos = ['A', 'B'].map(v => `<div class="mx-ref-via"><b>${esc(A.vias[v].nome)}</b> <i>${esc(A.vias[v].lema)}</i><ul>${A.nos.filter(n => n.via === v).map(n =>
      `<li><b>${T.grauInfo(n.grau).rom} · ${esc(n.nome)}</b> <em>${esc(T.USO[n.uso])}${n.custo ? ' · ' + esc(n.custo) : ''}</em> — ${esc(n.desc)}</li>`).join('')}</ul></div>`).join('');
    return `<div class="mx-ref" style="--cc:${esc(ed.cor)}"><b>${esc(ed.nome)}</b><span><b>Marca — ${esc(A.marca.nome)}.</b> ${esc(A.marca.desc)}</span>${ed.ritual_gratis ? `<em>✦ Ritual de afinidade: ${esc(ed.ritual_gratis)}</em>` : ''}${nos}</div>`;
  }).join('');
  return `<details class="mx-fold"${S.refOpen ? ' open' : ''}><summary data-mx-act="ref-toggle">Referência — árvore de transcendência (Marcas, Vias e Dádivas)</summary><div class="mx-refs">${itens}</div></details>`;
}
act['ref-toggle'] = el => { const d = el.closest('details'); S.refOpen = !d.open; };

/* ── Existidos (o painel em si é montado por renderExistidoMestrePanel, em app.js) ── */
act['existido-ver'] = el => existido(el.dataset.u, 'verdade', 'Saber Tudo');
act['existido-mestre'] = el => existido(el.dataset.u, 'mestre', 'Amalgamado');
function existido(u, causa, rotulo){
  if(!confirm(`Transformar ${nome(u)} em Existido (${rotulo})?`)) return;
  if(typeof tornarExistidoForce === 'function') tornarExistidoForce(u, causa);
  Mestre.render(true);
}
act['existido-rev'] = el => {
  const u = el.dataset.u;
  if(!confirm(`Reverter o Existido de ${nome(u)}? Isso é permanente.`)) return;
  if(typeof reverterExistido === 'function') reverterExistido(u);
  Mestre.render(true);
};

/* ── Transcendência Forçada (nível mínimo; lógica em transcendencia-forcada.js) ── */
function forcadaPanel(){
  const TF = window.TransForcada;
  if(!TF) return '';
  const cfg = TF.cfg(), us = roster();
  const modoOpts = Object.keys(TF.MODOS).map(k => `<option value="${k}"${k === cfg.modo ? ' selected' : ''}>${esc(TF.MODOS[k].rot)}</option>`).join('');
  const conf = `<div class="mx-tfcfg">
      <label class="mx-tfc"><input type="checkbox" data-mx-ch="tf-ativo"${cfg.ativo ? ' checked' : ''}><span>Ativa</span></label>
      <label class="mx-tfc"><span>Nível mínimo</span><input type="number" min="1" max="99" step="1" value="${cfg.nivel}" data-mx-ch="tf-nivel" aria-label="Nível mínimo"></label>
      <label class="mx-tfc"><span>Modo</span><select data-mx-ch="tf-modo" aria-label="Modo">${modoOpts}</select></label>
      <label class="mx-tfc"><input type="checkbox" data-mx-ch="tf-adiar"${cfg.adiar ? ' checked' : ''}><span>Permitir “Agora não”</span></label>
    </div>
    <p class="mx-tfdesc"><b>${esc(TF.MODOS[cfg.modo].rot)}:</b> ${esc(TF.MODOS[cfg.modo].desc)} O modo vale para os próximos eventos; quem já está com a escolha aberta mantém o modo de quando foi chamado.</p>`;
  const intro = `<p class="mx-lead">Ao atingir o nível mínimo, o Outro Lado força a passagem: o agente vê uma cutscene e desbloqueia, para sempre, um ritual de 1º círculo. Acontece uma única vez por agente e é independente da Transcendência comum. Você pode forçar o evento antes da hora; depois de concluído, ele não se repete nem pode ser reaberto.</p>`;
  if(!us.length) return panel('Transcendência Forçada', intro + conf + empty('Nenhum agente registrado.'), {id:'mx-tf'});
  const rows = us.map(u => {
    const c = C(u) || {}, tf = c.transForcada || {}, nex = num(c.nex, 5), nvl = Nivel.de(c), eu = esc(u);
    const elegivel = !!tf.forcado || (cfg.ativo && nvl >= cfg.nivel);
    const resetEnviado = cfg.reset[u] && cfg.reset[u] !== tf.resetVisto;
    const forcarEnviado = cfg.forcar[u] && cfg.forcar[u] !== tf.forcarVisto;
    let status, acao = '';
    if(resetEnviado){
      status = '<span class="mx-chip is-gold">Reabertura enviada — aguardando o agente</span>';
    }else if(forcarEnviado){
      status = '<span class="mx-chip is-gold">Evento enviado — aguardando o agente</span>';
    }else if(tf.concluida && tf.ritual){
      const m = tf.modo && window.TransForcada.MODOS[tf.modo];
      status = `<span class="mx-chip is-exist" style="--cc:${elemCor(tf.elemento)}">✦ ${esc(tf.ritual)} · ${esc(tf.elemento)}</span>${m ? `<span class="mx-chip">${esc(m.rot)}</span>` : ''}`;
    }else if(tf.concluida){
      status = '<span class="mx-chip">Já conhecia todos os de 1º círculo</span>';
    }else if(elegivel){
      status = `<span class="mx-chip is-gold">Pendente${tf.pendente && tf.modo ? ' · ' + esc(window.TransForcada.MODOS[tf.modo].rot) : ''}</span>`;
    }else{
      status = `<span class="mx-chip">${cfg.ativo ? 'Nv ' + nvl + ' (mín. ' + cfg.nivel + ')' : 'Desativada'}</span>`;
      acao = `<button type="button" class="mx-btn is-sm is-gold" data-mx-act="tf-forcar" data-u="${eu}">Forçar agora</button>`;
    }
    return `<div class="mx-trow mx-tfrow">
      <div class="mx-trow-id"><b>${esc(nome(u))}</b><span>${esc(c.classe || '—')} · Nv ${nvl}</span></div>
      <div class="mx-trow-st">${status}</div>
      <div class="mx-trow-ac">${acao}</div>
    </div>`;
  }).join('');
  return panel('Transcendência Forçada', intro + conf + `<div class="mx-trows">${rows}</div>`, {id:'mx-tf'});
}
function tfEnviar(campo, u, msg){
  const TF = window.TransForcada, cfg = TF.cfg();
  TF.setCfg({[campo]: Object.assign({}, cfg[campo], {[u]: Date.now()})});
  saveDB();
  toast(msg, '#d8a050');
  Mestre.paintBody(true);
}
act['tf-forcar'] = el => tfEnviar('forcar', el.dataset.u, `⛧ Transcendência Forçada enviada a ${nome(el.dataset.u)}.`);
const tfSet = patch => { window.TransForcada.setCfg(patch); saveDB(); Mestre.paintBody(true); };
chg['tf-ativo'] = el => tfSet({ativo: el.checked});
chg['tf-adiar'] = el => tfSet({adiar: el.checked});
chg['tf-modo'] = el => tfSet({modo: el.value});
chg['tf-nivel'] = el => tfSet({nivel: clamp(num(el.value, 15), 1, 99)});

/* ── seção ── */
Mestre.sections.transcendencia = {
  html: () => selfPanel() + controlPanel() + forcadaPanel() + '<div id="mx-existido"></div>' + ritPanel() + refPanel(),
  after: () => { if(typeof renderExistidoMestrePanel === 'function') renderExistidoMestrePanel(); },
};

})();
