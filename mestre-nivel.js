/* ════════════════════════════════════════════════════════════
   MESTRE-NIVEL.JS — seção "Nível" da aba Mestre
   ────────────────────────────────────────────────────────────
   · Concede (ou retira) XP de um ou vários agentes, com motivo.
   · Mostra nível, XP e progresso de cada agente.
   · Liga/desliga o ajuste manual de XP pelo próprio agente.
   · Mostra a curva de XP e as últimas concessões.
   O Mestre só escreve em db.mestre.xpConcessoes; cada agente aplica
   as suas concessões no próprio cliente (ver nivel.js › processar).
   Carregar depois de mestre.js e nivel.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(!window.Mestre || !window.Nivel) return;
const {S, esc, num, clamp, M, roster, C, nome, panel, empty, act, input: inp, change: chg} = Mestre;

S.nx = S.nx || {sel:{}, qtd:100, motivo:''};
const PRESETS = [50, 100, 250, 500, -50];
const fmt = n => Number(n).toLocaleString('pt-BR');
const sinal = n => (n > 0 ? '+' : '') + fmt(n);
const dataCurta = ts => { const d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };
const ehExistido = u => !!(C(u) && C(u).existido && C(u).existido.ativo);

const concessoes = u => (M().xpConcessoes && M().xpConcessoes[u]) || [];
const pendente = u => {
  const v = (C(u) || {}).xpVisto || 0;
  return concessoes(u).filter(g => g && g.n > v).reduce((a, g) => a + (parseInt(g.qtd, 10) || 0), 0);
};

function linha(u){
  const c = C(u) || {}, i = Nivel.info(c), ex = ehExistido(u), pend = pendente(u), eu = esc(u);
  const sel = !!S.nx.sel[u];
  const xpTxt = ex ? 'Existido' : i.max ? fmt(i.xp) + ' XP (máximo)' : fmt(i.xp) + ' / ' + fmt(i.prox) + ' XP';
  return `<div class="mx-nx-row">
    <button type="button" class="mx-sel${sel ? ' is-on' : ''}" data-mx-act="nx-sel" data-u="${eu}" aria-pressed="${sel}" aria-label="Selecionar ${esc(nome(u))}" title="Selecionar"></button>
    <div class="mx-nx-id"><b>${esc(nome(u))}</b><span>${esc(c.classe || '—')} · NEX ${i.nex}%</span></div>
    <div class="mx-nx-xp${ex ? ' mx-nx-bar-ex' : ''}"><span>Nv <b>${i.nivel}</b> · ${xpTxt}</span><span class="nv-bar"><i style="width:${i.pct}%"></i></span></div>
    <div>${pend ? `<span class="mx-chip is-gold" title="Ainda não aplicado na ficha do agente">${sinal(pend)} XP a caminho</span>` : ''}</div>
  </div>`;
}

function formHtml(us){
  const alvos = us.filter(u => S.nx.sel[u]).length;
  const chips = PRESETS.map(v => `<button type="button" class="mx-btn is-sm${S.nx.qtd === v ? ' is-on' : ''}" data-mx-act="nx-preset" data-v="${v}">${v > 0 ? '+' : ''}${v}</button>`).join('');
  return `<div class="mx-nx-form">
    <label>XP (use valor negativo para retirar)<input type="number" step="10" value="${esc(S.nx.qtd)}" data-mx-in="nx-qtd" data-mx-enter="nx-dar" aria-label="Quantidade de XP"></label>
    <div class="mx-nx-chips">${chips}</div>
    <label>Motivo (o agente vê no histórico)<input type="text" maxlength="80" placeholder="Ex.: sobreviveu ao porão" value="${esc(S.nx.motivo)}" data-mx-in="nx-motivo" data-mx-enter="nx-dar" autocomplete="off" aria-label="Motivo"></label>
  </div>
  <div class="mx-nx-actions">
    <button type="button" class="mx-btn" data-mx-act="nx-all">${us.length && us.every(u => S.nx.sel[u]) ? 'Limpar seleção' : 'Selecionar todos'}</button>
    <button type="button" class="mx-btn is-primary" data-mx-act="nx-dar"${alvos ? '' : ' disabled'}>Conceder a ${alvos} agente${alvos === 1 ? '' : 's'}</button>
  </div>`;
}

function logHtml(){
  const todos = [], m = M().xpConcessoes || {};
  Object.keys(m).forEach(u => (m[u] || []).forEach(g => { if(g) todos.push(Object.assign({u}, g)); }));
  todos.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if(!todos.length) return '<p class="mx-none">Nenhuma concessão ainda.</p>';
  return '<ul class="mx-nx-log">' + todos.slice(0, 12).map(g =>
    `<li><time>${dataCurta(g.ts)}</time><b class="${g.qtd < 0 ? 'neg' : ''}">${sinal(g.qtd)}</b><span>${esc(nome(g.u))}${g.motivo ? ' — ' + esc(g.motivo) : ''}</span></li>`).join('') + '</ul>';
}

function curvaHtml(){
  const nvs = [2, 5, 10, 15, 25, 50, 75, 100];
  return `<table class="mx-nx-curva"><thead><tr><th>Nível</th><th>XP total</th><th>NEX</th></tr></thead><tbody>` +
    nvs.map(n => `<tr><td>${n}</td><td>${fmt(Nivel.xpDoNivel(n))}</td><td>${Nivel.nexDeNivel(n)}%</td></tr>`).join('') + `</tbody></table>`;
}

function html(){
  const us = roster();
  S.nx.sel = Object.keys(S.nx.sel).reduce((o, u) => { if(us.indexOf(u) >= 0) o[u] = true; return o; }, {});
  const manual = !(M().xpCfg && M().xpCfg.manual === false);
  const lista = us.length ? us.map(linha).join('') : empty('Nenhum agente registrado ainda.', 'Quando alguém criar uma conta, a ficha aparece aqui.');
  return `<div class="mx-nx-grid">
    <div>
      ${panel('Conceder XP', `<p class="mx-lead">Marque os agentes, informe o XP e o motivo. Cada agente recebe a concessão na própria ficha, com o aviso de subida de nível.</p>${formHtml(us)}`)}
      ${panel('Agentes', lista)}
    </div>
    <aside>
      ${panel('Últimas concessões', logHtml())}
      ${panel('Configuração', `<label class="mx-tfc"><input type="checkbox" data-mx-ch="nx-manual"${manual ? ' checked' : ''}><span>Agentes podem ajustar o próprio XP e nível</span></label>
        <p class="mx-tfdesc">Ligado por padrão: cada agente soma ou retira XP, sobe/desce níveis e vai direto a um nível na janela de progressão (Existidos não). Tudo fica no histórico dele. Desligue para que o XP só chegue por concessão sua. O nível da Transcendência Forçada fica na seção Transcendência.</p>`)}
      ${panel('Curva de XP', curvaHtml())}
    </aside>
  </div>`;
}

/* ── ações ── */
act['nx-sel'] = el => { const u = el.dataset.u; if(S.nx.sel[u]) delete S.nx.sel[u]; else S.nx.sel[u] = true; Mestre.paintBody(true); };
act['nx-all'] = () => {
  const us = roster();
  if(us.length && us.every(u => S.nx.sel[u])) S.nx.sel = {};
  else us.forEach(u => { S.nx.sel[u] = true; });
  Mestre.paintBody(true);
};
act['nx-preset'] = el => { S.nx.qtd = parseInt(el.dataset.v, 10) || 0; Mestre.paintBody(true); };
inp['nx-qtd'] = el => { S.nx.qtd = parseInt(el.value, 10) || 0; };
inp['nx-motivo'] = el => { S.nx.motivo = el.value; };
chg['nx-manual'] = el => {
  M().xpCfg = Object.assign({}, M().xpCfg, {manual: el.checked});
  saveDB(); Mestre.paintBody(true);
  toast(el.checked ? 'Agentes podem ajustar o próprio XP e nível.' : 'Ajuste de XP pelos agentes desligado.', '#d8a050');
};
act['nx-dar'] = () => {
  const qtd = parseInt(S.nx.qtd, 10) || 0;
  const sel = roster().filter(u => S.nx.sel[u]);
  if(!sel.length){ toast('Selecione ao menos um agente.'); return; }
  if(!qtd){ toast('Informe um valor de XP diferente de zero.'); return; }
  const alvos = sel.filter(u => !ehExistido(u));
  if(!alvos.length){ toast('Existidos têm o nível fixo — nada a conceder.'); return; }
  const m = M(), motivo = (S.nx.motivo || '').trim().slice(0, 80);
  m.xpConcessoes = m.xpConcessoes || {};
  alvos.forEach(u => {
    const l = m.xpConcessoes[u] = Array.isArray(m.xpConcessoes[u]) ? m.xpConcessoes[u] : [];
    const n = l.reduce((a, g) => Math.max(a, g && g.n || 0), 0) + 1;
    l.push({n, qtd, motivo, ts: Date.now()});
    while(l.length > 40) l.shift();
  });
  saveDB();
  S.nx.motivo = '';
  const nomes = alvos.map(nome).join(', ');
  toast('✦ ' + sinal(qtd) + ' XP enviado a ' + nomes + (sel.length > alvos.length ? ' (Existidos ignorados)' : '') + '.', '#d8a050');
  Mestre.paintBody(true);
};

Mestre.sections.nivel = {html};
})();
