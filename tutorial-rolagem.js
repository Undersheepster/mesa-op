/* ══════════════════════════════════════════════════════════════
   AULA DE ROLAGEM — apresentada pelo Samuel Norte.
   Explica, passo a passo e com dados de verdade, o sistema de
   testes no estilo de Ordem Paranormal 2: três atributos (FÍSICO,
   EMOÇÃO, MENTE), cada um com um DADO (d4–d12), somado ao dado da
   perícia e comparado com a DT.

   Mesmo padrão do tutorial-samuel.js (classes .tut-*, IDs "rol-"),
   mais uma "bancada" interativa dentro do cartão que NÃO mexe na
   ficha do jogador.

   Regras (idênticas às de fxRolarTeste em ficha.js):
     • Atributo (valor 0–4): d4 · d6 · d8 · d10 · d12.
     • Perícia: Destreinado d4 · Treinado d6 · Veterano d8 · Expert d10.
     • Teste = dado do atributo + dado da perícia (+ bônus fixo) ≥ DT. DT padrão 7.
     • Crítico: dois dados iguais, valor 6 ou mais (sucesso automático).
       Falha crítica: os dois dados em 1.
     • Degrau de dado: +1 sobe o dado do atributo um tamanho; −1 desce.
   ══════════════════════════════════════════════════════════════ */

const ROL_TOUR_KEY = 'mp_tutorialRolagemV2';

const _rolDemoState = { attr:1, treino:0, dt:7, extra:0, res:null, _fixoAnterior:false };
const ROL_DADOS = [4,6,8,10,12];
const ROL_TREINOS = [['Destreinado',4],['Treinado',6],['Veterano',8],['Expert',10]];

function _rolFacesAttr(){ const S=_rolDemoState; return ROL_DADOS[Math.max(0,Math.min(4,S.attr+S.extra))]; }
function _rolFacesPer(){ return ROL_TREINOS[_rolDemoState.treino][1]; }
const _rolD = n => 1 + Math.floor(Math.random()*n);

function _rolDemoRolar(){
  const S = _rolDemoState, cfg = S._cfg || {};
  const fa = _rolFacesAttr(), fp = cfg.attrSo ? null : _rolFacesPer();
  const ra = _rolD(fa), rp = fp ? _rolD(fp) : null;
  S.res = { fa, fp, ra, rp };
  if(window.playDiceRoll) try{ playDiceRoll(fa); }catch(e){}
  _rolDemoPintarResultado();
}

function _rolDemoFormula(cfg){
  return 'd' + _rolFacesAttr() + (cfg.attrSo ? '' : '+d' + _rolFacesPer());
}

function _rolDemoPintarResultado(){
  const box = document.getElementById('rol-demo-res');
  const S = _rolDemoState, cfg = S._cfg || {};
  if(!box) return;
  if(!S.res){ box.innerHTML = '<div class="rd-note">Clique em Rolar.</div>'; return; }
  const r = S.res;
  if(cfg.attrSo){
    box.innerHTML = `<div class="rd-dice"><span class="rd-die pick" title="d${r.fa}">${r.ra}</span></div><div class="rd-out">d${r.fa} → <b>${r.ra}</b></div>`;
    return;
  }
  const total = r.ra + r.rp;
  const critS = r.ra === r.rp && r.ra >= 6, critF = r.ra === 1 && r.rp === 1;
  const dadosHtml = `<span class="rd-die${critS?' nat20':''}${critF?' nat1':''}" title="dado do atributo (d${r.fa})">${r.ra}</span><span style="align-self:center">+</span><span class="rd-die${critS?' nat20':''}${critF?' nat1':''}" title="dado da perícia (d${r.fp})" style="animation-delay:80ms">${r.rp}</span>`;
  let txt = `Atributo d${r.fa}: <b>${r.ra}</b> + Perícia d${r.fp}: <b>${r.rp}</b> = <b>${total}</b>`;
  if(critS) txt += `<br><span class="ok"><b>CRÍTICO!</b></span> Dois dados iguais (${r.ra}) — sucesso automático.`;
  else if(critF) txt += `<br><span class="bad"><b>FALHA CRÍTICA</b></span> — os dois dados em 1.`;
  else if(cfg.dt){ const ok = total >= S.dt; txt += `<br>Contra DT ${S.dt}: <span class="${ok?'ok':'bad'}"><b>${ok?'SUCESSO':'FALHA'}</b></span>`; }
  txt += `<br><span class="rd-note">RA (resultado alto) ${Math.max(r.ra,r.rp)} · RB (resultado baixo) ${Math.min(r.ra,r.rp)}</span>`;
  box.innerHTML = `<div class="rd-dice">${dadosHtml}</div><div class="rd-out">${txt}</div>`;
}

function _rolDemoMudar(campo, d){
  const S = _rolDemoState;
  if(campo === 'attr') S.attr = Math.max(0, Math.min(4, S.attr + d));
  if(campo === 'extra') S.extra = Math.max(-3, Math.min(3, S.extra + d));
  S.res = null;
  _rolRenderDemo(_rolStepAtual());
}
function _rolStepAtual(){ return ROL_STEPS[_rolStepIdx]; }
function _rolDemoSet(campo, v){
  const S = _rolDemoState;
  if(campo === 'treino') S.treino = parseInt(v,10) || 0;
  if(campo === 'dt') S.dt = Math.max(1, Math.min(30, parseInt(v,10) || 7));
  S.res = null;
  _rolRenderDemo(_rolStepAtual());
}

/* monta a bancada conforme o passo (step.demo = {attrSo, treino, dt, extra, deFicha, real, nota}) */
function _rolRenderDemo(step){
  const el = document.getElementById('rol-demo');
  if(!el) return;
  const cfg = step && step.demo;
  if(!cfg){ el.className = ''; el.innerHTML = ''; _rolDemoState._cfg = null; return; }
  const S = _rolDemoState;
  if(cfg.deFicha){ try{ S.attr = attrVal(fxChar(), 'Físico'); }catch(e){} }
  if(!cfg.extra) S.extra = 0;
  if(!cfg.treino) S.treino = 0;
  if(cfg.dt && !cfg._dtIni){ S.dt = 7; }
  S._cfg = cfg;
  const stepper = (campo, txt, rot, fixo) => fixo
    ? `<label>${rot} <b style="color:var(--white-bone);font-size:17px">${txt}</b></label>`
    : `<label>${rot} <span class="rd-step"><button type="button" onclick="_rolDemoMudar('${campo}',-1)" aria-label="menos">−</button><b>${txt}</b><button type="button" onclick="_rolDemoMudar('${campo}',1)" aria-label="mais">+</button></span></label>`;
  let h = '<div class="rd-row">';
  h += stepper('attr', 'd' + ROL_DADOS[S.attr], cfg.rotulo || 'Atributo', !!cfg.deFicha);
  if(cfg.extra) h += stepper('extra', (S.extra>0?'+':'') + S.extra, 'Degrau', false);
  if(cfg.treino) h += `<label>Perícia <select class="rd-sel" onchange="_rolDemoSet('treino',this.value)">${ROL_TREINOS.map((t,i) => `<option value="${i}"${i===S.treino?' selected':''}>${t[0]} (d${t[1]})</option>`).join('')}</select></label>`;
  if(cfg.dt) h += `<label>DT <input class="rd-dt" type="number" min="1" max="30" value="${S.dt}" onchange="_rolDemoSet('dt',this.value)"></label>`;
  h += '</div>';
  h += `<div class="rd-row"><span class="rd-formula">${_rolDemoFormula(cfg)}</span><button type="button" class="rd-roll" onclick="_rolDemoRolar()">🎲 Rolar</button>`;
  if(cfg.real) h += `<button type="button" class="rd-roll" onclick="_rolRolarDeVerdade()">Rolar na minha ficha</button>`;
  h += '</div><div id="rol-demo-res"></div>';
  if(cfg.nota) h += `<div class="rd-note">${cfg.nota}</div>`;
  el.className = 'on';
  el.innerHTML = h;
  _rolDemoPintarResultado();
  if(typeof _rolPositionAll === 'function') _rolPositionAll();
}

/* último passo: fecha a aula e rola o Físico de verdade na ficha do jogador */
function _rolRolarDeVerdade(){
  _rolFinalizar();
  setTimeout(() => { try{ if(typeof rolarAtributo === 'function') rolarAtributo('Físico'); }catch(e){} }, 520);
}

const ROL_STEPS = [
  {
    sel:null, before:'ficha',
    p:[
      'Chega mais. Samuel de novo. Hoje a aula é rolagem — e esquece o que você sabe de d20, porque aqui o jogo é outro.',
      'Em vez de uma pilha de d20, cada teste usa só DOIS dados: um do seu atributo e um da sua perícia. Os dois são somados, e você compara com a Dificuldade.',
      'Dado pequeno é gente comum. Dado grande é gente boa no que faz. É por isso que a ficha mostra "d8" onde antes tinha um número.'
    ],
    reacts:[
      {label:'"Então o d20 morreu?"', reply:'Pros humanos, sim. O d20 fica reservado pro paranormal — habilidades, criaturas e itens que passam do limite do normal. Faz sentido: o paranormal é caótico, e o d20 também.'}
    ]
  },
  {
    sel:'.attr-hex-wrap', pad:14, action:function(){ if(typeof fxExpandir==='function') fxExpandir('attr'); },
    p:[
      'Três atributos: Físico, Emoção e Mente.',
      'Físico é o corpo inteiro: reflexo, mira, soco, resistência. Emoção é instinto, presença, controle emocional: carisma, intimidação, intuição, vontade. Mente é raciocínio, percepção de detalhe, conhecimento: ciência, ocultismo, tecnologia.',
      'Toda perícia pertence a um deles — a etiqueta FÍS, EMO ou MEN ao lado do nome diz qual.'
    ]
  },
  {
    sel:'.attr-hex-wrap', pad:14,
    p:[
      'O que aparece dentro do hexágono é o DADO do atributo. Vai de d4 (fraco) até d12 (fenomenal): d4, d6, d8, d10, d12.',
      'Quanto maior o dado, maior o resultado médio. Muda o atributo aí embaixo e rola algumas vezes pra sentir a diferença.'
    ],
    demo:{ attrSo:true, rotulo:'Atributo', extra:false, treino:false, dt:false }
  },
  {
    sel:'#pericias-wrap', pad:8, action:function(){ if(typeof fxExpandir==='function') fxExpandir('pericias'); },
    p:[
      'A perícia entra com o dado dela, que depende do treinamento: Destreinado d4, Treinado d6, Veterano d8, Expert d10. O hexágono da perícia avança de grau com clique, botão direito volta.',
      'O teste é: dado do atributo + dado da perícia. Um Mente d8 com Investigação Treinada rola d8+d6. A fórmula aparece em cada perícia, ao lado do nome.',
      'Perícia tem às vezes um bônus fixo também (coluna da direita), que soma no final.',
      'Monta o teu aí embaixo: escolhe o atributo, o treino e rola.'
    ],
    demo:{ rotulo:'Atributo', extra:false, treino:true, dt:false }
  },
  {
    sel:null,
    p:[
      'E pra que serve a soma? Pra bater na DT, a Dificuldade do Teste. A DT padrão é 7, e o Mestre ajusta pra cima ou pra baixo conforme a situação.',
      'Total igual ou maior que a DT, deu certo. Menor, a história segue do jeito que você não escolheu.',
      'Testa aí. Muda o dado, o treino e a DT, e vê como um atributo bom compensa uma perícia fraca (e o contrário).'
    ],
    demo:{ rotulo:'Atributo', extra:false, treino:true, dt:true }
  },
  {
    sel:null,
    p:[
      'Agora a parte divertida: críticos. Se os DOIS dados saírem com o mesmo número, e esse número for 6 ou mais (6-6, 7-7, 8-8…), é crítico: sucesso automático, e numa investigação o Mestre ainda pode te dar uma informação extra.',
      'Do outro lado: se os dois dados saírem 1, é falha crítica, e vem consequência.',
      'Repare que dado pequeno quase nunca faz crítico — um d4+d4 nem chega no 6. Atributo e perícia grandes abrem essa porta.',
      'Rola umas vinte vezes e tenta ver um crítico acontecer.'
    ],
    demo:{ rotulo:'Atributo', extra:false, treino:true, dt:true }
  },
  {
    sel:'#fx-dice-mod', pad:6,
    p:[
      'O controle "Degrau do dado" na barra mexe no tamanho do dado do atributo. +1 sobe um degrau (d6 vira d8); −1 desce (d8 vira d6). Itens, poderes e condições vão te dar e tirar degraus — a ficha mostra a fórmula já com eles.',
      'O teto é d12 e o piso é d4. Não tem como crescer além disso só empilhando bônus.',
      'Mexe nos degraus na bancada e repara na fórmula mudando.'
    ],
    demo:{ rotulo:'Atributo', extra:true, treino:true, dt:true }
  },
  {
    sel:'#fx-sec-ataques', pad:8,
    p:[
      'Ataques seguem a mesma regra: dado do atributo da perícia da arma (Luta ou Pontaria, as duas de Físico) mais o dado do seu treino nela.',
      'Se o teste de ataque sair crítico (dois dados iguais, 6+), o cartão avisa e o botão de dano multiplica os dados de dano — o multiplicador da arma é o "x2", "x3" que aparece no chip.',
      'Também aparecem no cartão o RA e o RB: Resultado Alto e Resultado Baixo, o maior e o menor dos dois dados. Algumas regras (como dano e intensidade) usam um ou outro.'
    ]
  },
  {
    sel:'.attr-hex-wrap', pad:14,
    p:[
      'Resumo pra colar na testa: dado do atributo + dado da perícia (+ bônus) contra a DT, que costuma ser 7. Dois dados iguais de 6 pra cima: crítico. Dois uns: desastre.',
      'Agora faz na ficha de verdade. Clica no hexágono pra rolar só o atributo (ele soma com um d4 de "perícia destreinada"), no nome de uma perícia pra rolar com treino, ou no botão de um ataque.',
      'Boa sorte lá fora. E não rola Ocultismo sozinho no escuro. Eu tô falando sério.'
    ],
    demo:{ rotulo:'Físico', deFicha:true, extra:false, treino:false, dt:false, real:true, nota:'"Rolar na minha ficha" fecha a aula e rola seu Físico de verdade.' },
    reacts:[
      {label:'"Valeu, Samuel."', reply:'Disponha! Se esquecer, tem o botão "Rolagem" no rodapé, ou o "? Como rolar" no cartão de Atributos. Eu fico aqui. Longe do escuro.'}
    ]
  }
];

let _rolStepIdx = 0;
let _rolParaIdx = 0;
let _rolTyping = false;
let _rolTypeTimer = null;
let _rolResizeBound = false;
let _rolCurrentFullText = '';

function _rolBuildChrome(){
  if(document.getElementById('tutorial-rolagem-overlay')) return;
  const wrap = document.createElement('div');
  wrap.id = 'tutorial-rolagem-overlay';
  wrap.innerHTML = `
    <div id="rol-blocker"></div>
    <div id="rol-spot"></div>
    <button class="tut-skip" onclick="_rolPular()">Pular ✕</button>
    <div class="tut-step-count" id="rol-step-count"></div>
    <div class="tut-card" id="rol-card">
      <div class="tut-name-row">
        <span class="tut-name" style="color:#86b266;text-shadow:0 0 8px rgba(134,178,102,0.35)">Samuel</span>
        <span class="tut-role" style="color:#86b266;opacity:.85">Aula de rolagem · Físico, Emoção e Mente</span>
      </div>
      <div class="tut-text" id="rol-text" onclick="_rolAdvanceOrSkipType()"></div>
      <div class="tut-reacts" id="rol-reacts"></div>
      <div id="rol-demo"></div>
      <div class="tut-continue-hint" id="rol-hint">▾ clique ou "próximo" pra continuar</div>
      <div class="tut-footer">
        <div class="tut-dots" id="rol-dots"></div>
        <div class="tut-btns">
          <button class="tut-btn" id="rol-btn-back" onclick="_rolVoltar()">◂ Voltar</button>
          <button class="tut-btn primary" id="rol-btn-next" onclick="_rolAvancar()">Próximo ▸</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  if(!_rolResizeBound){
    window.addEventListener('resize', ()=>{ if(document.getElementById('tutorial-rolagem-overlay')) _rolPositionAll(); });
    _rolResizeBound = true;
  }
  requestAnimationFrame(()=> wrap.classList.add('show'));
}

function _rolUpdateChrome(){
  const total = ROL_STEPS.length;
  const countEl = document.getElementById('rol-step-count');
  if(countEl) countEl.textContent = `${_rolStepIdx+1} / ${total}`;
  const dotsEl = document.getElementById('rol-dots');
  if(dotsEl){
    dotsEl.innerHTML = '';
    ROL_STEPS.forEach((s,i)=>{
      const d = document.createElement('span');
      d.className = 'tut-dot' + (i===_rolStepIdx?' on':'');
      dotsEl.appendChild(d);
    });
  }
  const backBtn = document.getElementById('rol-btn-back');
  if(backBtn) backBtn.disabled = (_rolStepIdx===0);
  const nextBtn = document.getElementById('rol-btn-next');
  if(nextBtn) nextBtn.textContent = (_rolStepIdx===total-1) ? 'Encerrar ✎' : 'Próximo ▸';
}

function _rolPositionAll(){
  const step = ROL_STEPS[_rolStepIdx];
  const spot = document.getElementById('rol-spot');
  const card = document.getElementById('rol-card');
  if(!spot || !card || !step) return;
  const el = step.sel ? document.querySelector(step.sel) : null;

  if(!el || el.offsetWidth===0 || el.offsetHeight===0){
    spot.style.opacity = '0';
    card.classList.add('centered');
    card.style.top = ''; card.style.left = ''; card.style.bottom=''; card.style.transform = '';
    return;
  }

  card.classList.remove('centered');
  const pad = step.pad || 8;
  const r = el.getBoundingClientRect();
  spot.style.opacity = '1';
  spot.style.top = (r.top - pad) + 'px';
  spot.style.left = (r.left - pad) + 'px';
  spot.style.width = (r.width + pad*2) + 'px';
  spot.style.height = (r.height + pad*2) + 'px';

  const cardH = card.offsetHeight || 200;
  const spaceBelow = window.innerHeight - (r.bottom + pad);
  const spaceAbove = r.top - pad;
  let top;
  if(spaceBelow > cardH + 24 || spaceBelow > spaceAbove){
    top = Math.min(r.bottom + pad + 16, window.innerHeight - cardH - 14);
  } else {
    top = Math.max(14, r.top - pad - cardH - 16);
  }
  let left = r.left + r.width/2;
  const cardW = card.offsetWidth || 420;
  left = Math.max(cardW/2 + 14, Math.min(window.innerWidth - cardW/2 - 14, left));
  if(step.demo && top < r.bottom + pad && top + cardH > r.top - pad){
    const esq = r.left - pad - 16 - cardW;
    const dir = r.right + pad + 16;
    if(esq >= 14){ left = esq + cardW/2; top = Math.max(14, Math.min(window.innerHeight - cardH - 14, r.top)); }
    else if(dir + cardW <= window.innerWidth - 14){ left = dir + cardW/2; top = Math.max(14, Math.min(window.innerHeight - cardH - 14, r.top)); }
  }
  card.style.top = top + 'px';
  card.style.left = left + 'px';
  card.style.transform = 'translateX(-50%)';
  card.style.bottom = '';
}

function _rolTypeText(full){
  const textEl = document.getElementById('rol-text');
  const hintEl = document.getElementById('rol-hint');
  if(!textEl) return;
  hintEl.classList.remove('show');
  _rolCurrentFullText = full;
  textEl.style.minHeight = '';
  textEl.innerHTML = full.replace(/\n/g,'<br>');
  textEl.style.minHeight = textEl.offsetHeight + 'px';
  let i = 0;
  _rolTyping = true;
  clearInterval(_rolTypeTimer);
  textEl.innerHTML = '<span class="tut-cursor"></span>';
  _rolPositionAll();
  _rolTypeTimer = setInterval(()=>{
    i += 2;
    if(i >= full.length){
      i = full.length;
      clearInterval(_rolTypeTimer);
      _rolTyping = false;
      hintEl.classList.add('show');
      _rolMaybeShowReacts();
    }
    textEl.innerHTML = full.slice(0,i).replace(/\n/g,'<br>') + (i<full.length ? '<span class="tut-cursor"></span>' : '');
  }, 15);
}

function _rolFinishTypingNow(){
  clearInterval(_rolTypeTimer);
  _rolTyping = false;
  const textEl = document.getElementById('rol-text');
  if(textEl) textEl.innerHTML = _rolCurrentFullText.replace(/\n/g,'<br>');
  const hintEl = document.getElementById('rol-hint');
  if(hintEl) hintEl.classList.add('show');
  _rolPositionAll();
  _rolMaybeShowReacts();
}

function _rolMaybeShowReacts(){
  const step = ROL_STEPS[_rolStepIdx];
  const reactsEl = document.getElementById('rol-reacts');
  if(!reactsEl || !step) return;
  if(step.reacts && _rolParaIdx === step.p.length-1 && !step._reacted){
    reactsEl.innerHTML = step.reacts.map((r,i)=>
      `<button class="tut-react-btn" onclick="_rolPlayReact(${i})">${r.label}</button>`
    ).join('');
  } else {
    reactsEl.innerHTML = '';
  }
}

function _rolClearReacts(){
  const reactsEl = document.getElementById('rol-reacts');
  if(reactsEl) reactsEl.innerHTML = '';
  const said = document.getElementById('rol-react-said');
  if(said) said.remove();
}

function _rolPlayReact(i){
  const step = ROL_STEPS[_rolStepIdx];
  if(!step || !step.reacts || !step.reacts[i]) return;
  step._reacted = true;
  const reactsEl = document.getElementById('rol-reacts');
  if(reactsEl) reactsEl.innerHTML = '';
  const textEl = document.getElementById('rol-text');
  let said = document.getElementById('rol-react-said');
  if(!said && textEl){
    said = document.createElement('div');
    said.id = 'rol-react-said';
    said.className = 'tut-react-said';
    textEl.parentNode.insertBefore(said, textEl);
  }
  if(said) said.textContent = step.reacts[i].label.replace(/^"|"$/g,'');
  _rolTypeText(step.reacts[i].reply);
}

function _rolTypeParagraph(){
  const step = ROL_STEPS[_rolStepIdx];
  if(!step) return;
  _rolClearReacts();
  _rolTypeText(step.p[_rolParaIdx] || '');
}

function _rolAdvanceOrSkipType(){
  if(_rolTyping){ _rolFinishTypingNow(); return; }
  _rolAvancar();
}

function _rolShowStep(){
  const step = ROL_STEPS[_rolStepIdx];
  try{
    if(step.before && typeof showTab === 'function'){
      const btn = document.querySelector(`.tab-btn[onclick*="'${step.before}'"]`);
      showTab(step.before, btn);
      if(step.before==='rituais' && typeof renderTranscendenciaPanel==='function') setTimeout(renderTranscendenciaPanel,80);
    }
  }catch(e){}
  if(step.action) try{ step.action(); }catch(e){}
  _rolRenderDemo(step);
  _rolUpdateChrome();
  const el = step.sel ? document.querySelector(step.sel) : null;
  if(el && el.scrollIntoView){
    el.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(()=>{ _rolPositionAll(); _rolTypeParagraph(); }, 280);
  } else {
    _rolPositionAll();
    _rolTypeParagraph();
  }
}

function _rolAvancar(){
  if(_rolTyping){ _rolFinishTypingNow(); return; }
  const step = ROL_STEPS[_rolStepIdx];
  if(_rolParaIdx < step.p.length-1){
    _rolParaIdx++;
    _rolTypeParagraph();
    return;
  }
  if(_rolStepIdx < ROL_STEPS.length-1){
    _rolStepIdx++;
    _rolParaIdx = 0;
    _rolShowStep();
  } else {
    _rolFinalizar();
  }
}

function _rolVoltar(){
  if(_rolParaIdx > 0){
    _rolParaIdx--;
    _rolTypeParagraph();
    return;
  }
  if(_rolStepIdx > 0){
    _rolStepIdx--;
    _rolParaIdx = ROL_STEPS[_rolStepIdx].p.length - 1;
    _rolShowStep();
  }
}

function _rolFecharOverlay(){
  const overlay = document.getElementById('tutorial-rolagem-overlay');
  if(overlay){
    overlay.classList.remove('show');
    setTimeout(()=>{ overlay.remove(); }, 500);
  }
  document.removeEventListener('keydown', _rolKeyHandler);
}

function _rolPular(){
  _rolDemoState.rolou = false;
  _rolFecharOverlay();
  try{ localStorage.setItem(ROL_TOUR_KEY, '1'); }catch(e){}
}

function _rolFinalizar(){
  _rolFecharOverlay();
  try{ localStorage.setItem(ROL_TOUR_KEY, '1'); }catch(e){}
}

function _rolKeyHandler(e){
  if(!document.getElementById('tutorial-rolagem-overlay')){
    document.removeEventListener('keydown', _rolKeyHandler);
    return;
  }
  if(e.key===' '||e.key==='Enter'){ e.preventDefault(); _rolAvancar(); }
  else if(e.key==='Escape'){ _rolPular(); }
  else if(e.key==='ArrowLeft'){ _rolVoltar(); }
  else if(e.key==='ArrowRight'){ _rolAvancar(); }
}

// Ponto de entrada — sempre manual, pelo botão "✎ Sistema" na barra
// superior (só faz sentido depois de logado, já que aponta pra
// elementos reais da ficha/abas).
function iniciarTutorialRolagem(){
  if(document.getElementById('tutorial-rolagem-overlay')) return;
  if(document.getElementById('tutorial-agatha-overlay')) return; // não roda os dois juntos
  _rolStepIdx = 0;
  _rolParaIdx = 0;
  _rolBuildChrome();
  _rolShowStep();
  document.addEventListener('keydown', _rolKeyHandler);
}
