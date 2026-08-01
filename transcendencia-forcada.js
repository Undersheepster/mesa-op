/* ════════════════════════════════════════════════════════════
   TRANSCENDENCIA-FORCADA.JS — Transcendência Forçada (NEX 15%+)
   ────────────────────────────────────────────────────────────
   A partir de 15% de NEX, o agente sofre um contato involuntário
   com o Outro Lado: automaticamente (sem depender do Mestre) uma
   tela aparece oferecendo a escolha de UM ritual de 1º círculo,
   de QUALQUER elemento, que é desbloqueado permanentemente.

   Isso é independente e não substitui a Transcendência "de
   verdade" (renderTranscendenciaPanel / transIniciarCutscene),
   que continua ligada ao NEX 99% e à liberação do Mestre.

   Arquivo carregado depois de app.js (usa userChar, defaultChar,
   RITUAIS_DB, TRANSCENDENCIA_ELEMENTOS, saveDB, toast, currentUser,
   isMestre, renderRituaisTab, renderTranscendenciaPanel).
   ════════════════════════════════════════════════════════════ */

/* Garante o estado do campo no personagem */
function _ensureTransForcadaState(c){
  if(!c.transForcada || typeof c.transForcada !== 'object'){
    c.transForcada = { concluida:false, ritual:null, elemento:null };
  }
  return c.transForcada;
}

/* Busca os dados visuais (cor, símbolo...) de um elemento pelo nome
   usado em RITUAIS_DB (ex: 'Sangue', 'Morte'...) */
function _elemDataByNome(nome){
  if(typeof TRANSCENDENCIA_ELEMENTOS === 'undefined') return { cor:'#999', corGlow:'#ccc', simbolo:'' };
  const id = Object.keys(TRANSCENDENCIA_ELEMENTOS).find(k => TRANSCENDENCIA_ELEMENTOS[k].nome === nome);
  return id ? TRANSCENDENCIA_ELEMENTOS[id] : { cor:'#999', corGlow:'#ccc', simbolo:'' };
}

/* ── Verifica se deve disparar a Transcendência Forçada ──
   Funciona tanto para jogadores quanto para o Mestre em sua
   própria ficha (cada login só enxerga userChar(currentUser),
   nunca a ficha de outra pessoa). ── */
function _checkTransForcadaTrigger(){
  if(!currentUser) return;
  const c = userChar(currentUser);
  const tf = _ensureTransForcadaState(c);
  if(tf.concluida) return;
  if(document.getElementById('_transforcada_overlay')) return; // já está na tela

  const nex = parseInt(c.nex) || 5;
  if(nex < 15) return;

  if(!c.rituaisAprendidos) c.rituaisAprendidos = {};
  const candidatos = RITUAIS_DB.filter(r => r.circ === 1 && !c.rituaisAprendidos[r.nome]);

  if(!candidatos.length){
    // Nada para desbloquear (já sabe todos os rituais de 1º círculo) — encerra silenciosamente
    tf.concluida = true;
    saveDB();
    return;
  }

  _iniciarTranscendenciaForcada();
}

/* ══════════════════════════════════════════════════════════════
   TELA DE ESCOLHA
   ══════════════════════════════════════════════════════════════ */
function _iniciarTranscendenciaForcada(){
  const old = document.getElementById('_transforcada_overlay');
  if(old) old.remove();
  const oldSt = document.getElementById('_transforcada_style');
  if(oldSt) oldSt.remove();

  const style = document.createElement('style');
  style.id = '_transforcada_style';
  style.textContent = `
    #_transforcada_overlay{
      position:fixed;inset:0;z-index:9997;background:#000;
      display:flex;align-items:center;justify-content:center;overflow:hidden;
      opacity:0;transition:opacity 1.2s ease;padding:24px;box-sizing:border-box;
    }
    #_transforcada_overlay.tf-in{opacity:1}
    #_transforcada_bg{
      position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at center,#1a0010 0%,#050002 60%,#000 100%);
      animation:tf-pulse 5s ease-in-out infinite alternate;
    }
    @keyframes tf-pulse{
      from{background:radial-gradient(ellipse at center,#1a0010 0%,#050002 60%,#000 100%)}
      to{background:radial-gradient(ellipse at center,#2a001a 0%,#070003 60%,#000 100%)}
    }
    #_transforcada_content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:16px;max-width:740px;width:100%;max-height:92vh}
    #_transforcada_titulo{
      font-family:'Cinzel Decorative',serif;font-weight:900;letter-spacing:.16em;text-transform:uppercase;
      font-size:clamp(19px,4vw,30px);color:#cc2244;text-align:center;
      text-shadow:0 0 24px rgba(200,0,60,0.85),0 0 60px rgba(120,0,40,0.5);
      opacity:0;animation:tf-appear 1.2s .1s ease both;
    }
    @keyframes tf-appear{from{opacity:0;transform:scale(1.15);filter:blur(10px)}to{opacity:1;transform:scale(1);filter:blur(0)}}
    #_transforcada_sub{
      font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash,#c8c0c0);
      font-size:13px;text-align:center;max-width:580px;line-height:1.7;
      opacity:0;animation:tf-fade 1s .5s ease both;
    }
    @keyframes tf-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    #_transforcada_lista{display:flex;flex-direction:column;gap:14px;width:100%;overflow-y:auto;padding-right:6px;flex:1;opacity:0;animation:tf-fade 1s 1s ease both}
    .tf-card{background:rgba(10,0,8,0.94);border:1px solid var(--tf-cor,#8883);padding:9px 13px}
    .tf-card button{padding:5px 14px;background:rgba(139,0,0,0.15);border:1px solid var(--tf-cor,#8888);color:var(--tf-cor,#ccc);font-family:'Cinzel',serif;font-size:9px;letter-spacing:.08em;cursor:pointer;text-transform:uppercase;width:100%;margin-top:4px}
    .tf-card button:hover{background:rgba(139,0,0,0.3)}
  `;
  document.head.appendChild(style);

  const ov = document.createElement('div');
  ov.id = '_transforcada_overlay';
  ov.innerHTML = `
    <div id="_transforcada_bg"></div>
    <div id="_transforcada_content">
      <div id="_transforcada_titulo">⛧ Transcendência Forçada ⛧</div>
      <div id="_transforcada_sub">A membrana não se abriu porque você chamou — ELE forçou a passagem. Aos 15% de NEX, algo do Outro Lado se agarrou a você e não soltou mais. Escolha, agora, qual segredo ELE arranca de você: um ritual de 1º círculo, de qualquer natureza. Esta escolha é permanente.</div>
      <div id="_transforcada_lista"></div>
    </div>
  `;
  document.body.appendChild(ov);
  requestAnimationFrame(()=> ov.classList.add('tf-in'));
  _renderTransForcadaLista();
}

function _renderTransForcadaLista(){
  const wrap = document.getElementById('_transforcada_lista');
  if(!wrap || !currentUser) return;
  const c = userChar(currentUser);
  if(!c.rituaisAprendidos) c.rituaisAprendidos = {};

  const primeiroCirculo = RITUAIS_DB.filter(r => r.circ === 1);
  const porElemento = {};
  primeiroCirculo.forEach(r => { (porElemento[r.elem] = porElemento[r.elem] || []).push(r); });

  wrap.innerHTML = Object.keys(porElemento).map(elemNome => {
    const ed = _elemDataByNome(elemNome);
    return `
      <div>
        <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.15em;color:${ed.cor};text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <span class="sym-el ${ed.simbolo}" style="width:18px;height:18px;display:inline-block;background-size:contain;filter:drop-shadow(0 0 4px ${ed.corGlow})"></span>${elemNome}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${porElemento[elemNome].map(r => {
            const jaTem = !!c.rituaisAprendidos[r.nome];
            return `<div class="tf-card" style="--tf-cor:${ed.cor};${jaTem ? 'opacity:.4' : ''}">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:4px">
                <span style="font-family:'Cinzel',serif;font-size:11px;color:${ed.cor}">${r.nome}</span>
                <span style="font-size:9px;color:var(--white-dust,#887);font-family:'Courier Prime',monospace;white-space:nowrap">${r.pe} PE</span>
              </div>
              <div style="font-size:13px;color:var(--white-ash,#ccc);line-height:1.55">${r.efeito}</div>
              ${jaTem
                ? `<div style="margin-top:5px;font-size:9px;color:#668866;font-family:'Courier Prime',monospace">✓ já conhecido</div>`
                : `<button onclick="_transForcadaEscolher('${r.nome.replace(/'/g, "\\'")}')">⛧ Escolher este ritual</button>`
              }
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

/* ── O jogador escolhe o ritual — desbloqueia e encerra o evento ── */
function _transForcadaEscolher(nome){
  if(!currentUser) return;
  const c = userChar(currentUser);
  const r = RITUAIS_DB.find(x => x.nome === nome && x.circ === 1);
  if(!r) return;

  if(!c.rituaisAprendidos) c.rituaisAprendidos = {};
  c.rituaisAprendidos[r.nome] = true;

  const tf = _ensureTransForcadaState(c);
  tf.concluida = true;
  tf.ritual = r.nome;
  tf.elemento = r.elem;
  tf.ts = new Date().toISOString();

  if(!c.transcendenciaHistorico) c.transcendenciaHistorico = [];
  c.transcendenciaHistorico.push({ ritual: r.nome, ts: new Date().toISOString(), forcada: true });

  saveDB();

  const ed = _elemDataByNome(r.elem);
  toast(`⛧ Transcendência Forçada — ${r.nome} (${r.elem}) desbloqueado!`, ed.cor || '#cc2244');

  _fecharTransForcada();
  if(typeof renderRituaisTab === 'function') renderRituaisTab();
  if(typeof renderTranscendenciaPanel === 'function') renderTranscendenciaPanel();
}

function _fecharTransForcada(){
  const ov = document.getElementById('_transforcada_overlay');
  if(ov){
    ov.classList.remove('tf-in');
    setTimeout(()=> ov.remove(), 1200);
  }
}
