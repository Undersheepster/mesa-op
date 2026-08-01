/* ════════════════════════════════════════════════════════════
   DANOS-TAB.JS — Aba "⚔ Danos"
   ────────────────────────────────────────────────────────────
   Arquivo ISOLADO de propósito (mesma lógica do dano-rituais.js):
   ele só lê ITENS_DB, RITUAIS_DB, TIPOS_DANO, calcularRD, rolarDado
   e o personagem atual (userChar/db), então PRECISA ser carregado
   DEPOIS de app.js, ficha.js e dano-rituais.js no index.html.

   O que essa aba faz:
   - Varre o inventário do personagem (c.inv) e junta as armas,
     explosivos e equipamentos que possuam campo `dam` no ITENS_DB.
   - Varre os rituais desbloqueados do personagem (c.rituaisAprendidos)
     e junta os que possuam `dam`/`tipoDano` no RITUAIS_DB.
   - Mostra tudo numa lista única com um botão "⚄ Rolar" para cada,
     que reaproveita rolarDado()/calcularRD() já existentes, aplica a
     RD da armadura equipada e loga no mesmo histórico de rolagens
     (db.rolls) usado pelas outras abas.
   ════════════════════════════════════════════════════════════ */

/* Monta a lista de "coisas que causam dano" que o personagem possui */
function _coletarFontesDeDano(){
  const c = userChar(currentUser);
  if(!c.inv) c.inv = [];
  if(!c.rituaisAprendidos) c.rituaisAprendidos = {};

  const fontes = [];

  // Armas, explosivos e equipamentos do inventário com dano definido
  c.inv.forEach((it, idx) => {
    if(!it.dbId) return;
    const dbItem = (typeof ITENS_DB !== 'undefined') ? ITENS_DB.find(x => x.id === it.dbId) : null;
    if(!dbItem || !dbItem.dam) return;
    fontes.push({
      origem: 'item',
      idx,
      dbId: dbItem.id,
      nome: dbItem.nome,
      dam: dbItem.dam,
      tipoDano: dbItem.tipoDano || null,
      area: dbItem.area || null,
      categoria: dbItem.tipo === 'explosivo' ? 'Explosivo' : (dbItem.tipo === 'arma' ? 'Arma' : 'Equipamento'),
    });
  });

  // Rituais desbloqueados com dano definido
  if(typeof RITUAIS_DB !== 'undefined'){
    RITUAIS_DB.forEach(r => {
      if(!r.dam || !r.tipoDano) return;
      if(!c.rituaisAprendidos[r.nome]) return;
      fontes.push({
        origem: 'ritual',
        nome: r.nome,
        dam: r.dam,
        tipoDano: r.tipoDano,
        elem: r.elem || null,
        categoria: 'Ritual',
      });
    });
  }

  return fontes;
}

/* Renderiza a lista da aba Danos */
function renderDanosTab(){
  const el = document.getElementById('danos-lista');
  if(!el) return;

  const fontes = _coletarFontesDeDano();

  if(!fontes.length){
    el.innerHTML = `<div style="color:var(--white-dust);font-size:12px;font-family:'Courier Prime',monospace;padding:16px 0;text-align:center;font-style:italic">
      Nenhuma fonte de dano encontrada. Adquira armas/explosivos na aba Inventário
      ou desbloqueie rituais com dano na aba Rituais.
    </div>`;
    return;
  }

  // Agrupa por categoria (Arma, Explosivo, Equipamento, Ritual)
  const grupos = {};
  fontes.forEach(f => { (grupos[f.categoria] = grupos[f.categoria] || []).push(f); });

  const ordemCategorias = ['Arma', 'Explosivo', 'Equipamento', 'Ritual'];

  el.innerHTML = ordemCategorias.filter(cat => grupos[cat]).map(cat => {
    const itens = grupos[cat];
    const linhas = itens.map((f, i) => {
      const td = f.tipoDano && typeof TIPOS_DANO !== 'undefined' ? TIPOS_DANO[f.tipoDano] : null;
      const cor = td ? td.cor : '#cc4422';
      const emoji = td ? td.emoji : '⚄';
      const chave = f.origem === 'item' ? `'item','${f.idx}'` : `'ritual','${f.nome.replace(/'/g, "\\'")}'`;
      return `<div style="display:flex;align-items:center;gap:10px;background:rgba(10,0,8,0.9);border:1px solid rgba(50,0,0,0.5);border-left:2px solid ${cor};padding:9px 12px;margin-bottom:4px">
        <div style="flex:1;min-width:0">
          <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--white-bone)">${f.nome}</div>
          <div style="font-family:'Courier Prime',monospace;font-size:10px;color:var(--white-dust);display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">
            <span>⚄ <b style="color:${cor}">${f.dam}</b></span>
            ${td ? `<span style="color:${cor}">${emoji} ${td.nome}</span>` : ''}
            ${f.area ? `<span>✷ ${f.area}</span>` : ''}
            ${f.elem ? `<span style="color:var(--gold-light)">${f.elem}</span>` : ''}
          </div>
        </div>
        <button onclick="rolarDanoTab(${chave})" style="padding:7px 14px;background:rgba(${typeof hexToRgb === 'function' ? hexToRgb(cor) : '139,0,0'},0.15);border:1px solid ${cor};color:${cor};font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.08em;cursor:pointer;white-space:nowrap;flex-shrink:0">⚄ Rolar ${f.dam}</button>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:14px">
      <div style="font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.14em;color:var(--gold-light);text-transform:uppercase;margin-bottom:6px;opacity:.85">${cat} (${itens.length})</div>
      ${linhas}
    </div>`;
  }).join('');
}

/* Rola o dano de uma fonte específica (arma/explosivo/equipamento do
   inventário, ou ritual desbloqueado) e mostra o resultado na própria
   aba Danos, aplicando a RD da armadura equipada e logando no
   histórico de rolagens (mesmo db.rolls usado nas outras abas). */
function rolarDanoTab(origem, chave){
  const c = userChar(currentUser);
  let nome, damExpr, tipoDano, area = null;

  if(origem === 'item'){
    const it = c.inv[parseInt(chave)];
    const dbItem = it && it.dbId ? ITENS_DB.find(x => x.id === it.dbId) : null;
    if(!dbItem || !dbItem.dam) return;
    nome = dbItem.nome; damExpr = dbItem.dam; tipoDano = dbItem.tipoDano || null; area = dbItem.area || null;
  } else if(origem === 'ritual'){
    const r = (typeof RITUAIS_DB !== 'undefined') ? RITUAIS_DB.find(x => x.nome === chave) : null;
    if(!r || !r.dam) return;
    nome = r.nome; damExpr = r.dam; tipoDano = r.tipoDano || null;
  } else {
    return;
  }

  const result = rolarDado(damExpr);
  const total  = result.total ?? result;
  const rolls  = result.rolls || [];
  const td     = tipoDano && typeof TIPOS_DANO !== 'undefined' ? TIPOS_DANO[tipoDano] : null;
  const cor    = td ? td.cor : '#cc4422';

  const arm = c.armaduraEquipada ? ITENS_DB.find(i => i.id === c.armaduraEquipada) : null;
  const rd  = tipoDano ? calcularRD(arm, tipoDano) : 0;
  const final = Math.max(0, total - rd);

  // Mostra na própria aba Danos
  const el = document.getElementById('danos-resultado');
  const elVazio = document.getElementById('danos-resultado-vazio');
  if(el){
    el.style.display = 'block';
    if(elVazio) elVazio.style.display = 'none';
    let html = `<div style="margin-bottom:6px;font-size:12px;color:${cor};font-family:'Cinzel',serif;letter-spacing:.06em">${td ? td.emoji : '⚄'} ${nome}</div>`;
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">`;
    if(rolls.length) html += `<span style="color:var(--white-dust)">Dados: [${rolls.join(', ')}]</span>`;
    html += `<span style="color:var(--white-dust)">→ Bruto: <b style="color:${cor}">${total}</b></span>`;
    if(rd > 0) html += `<span style="color:var(--white-dust)">− RD <b style="color:#3af">${rd}</b></span>`;
    html += `<span style="color:var(--white-dust)">= Final: <b style="color:${final > 0 ? cor : '#22cc66'};font-size:14px">${final}</b></span>`;
    html += `</div>`;
    if(rd > 0 && arm) html += `<div style="font-size:10px;color:#88aacc">🛡 ${arm.nome} absorveu ${rd} de dano${td ? ' ' + td.nome : ''}.</div>`;
    if(area) html += `<div style="font-size:10px;color:#ff8844;margin-top:2px">✷ Área de efeito: <b>${area}</b></div>`;
    el.innerHTML = html;
  }

  // Loga no histórico de rolagens (compartilhado com a aba Dados)
  if(!db.rolls) db.rolls = {};
  if(!db.rolls[currentUser]) db.rolls[currentUser] = [];
  const h = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  db.rolls[currentUser].unshift({
    h,
    label: `[${origem === 'ritual' ? 'Ritual' : 'Dano'}] ${nome}: ${damExpr} = ${total}${rd > 0 ? ` → ${final} (RD −${rd})` : ''}`,
    ctx: td ? `${td.emoji} ${td.nome}` : '',
    total: final,
  });
  if(db.rolls[currentUser].length > 50) db.rolls[currentUser].length = 50;
  saveDB();
  renderLog();
  toast(`⚄ ${nome}: ${total}${rd > 0 ? ` −${rd}RD = ${final}` : ''}`);
}
