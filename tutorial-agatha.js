/* ══════════════════════════════════════════════════════════════
   TOUR GUIADO DA AGATHA — isolado em arquivo separado (mesmo
   padrão do dano-rituais.js) pra não arriscar quebrar o app.js.
   Holofote real sobre a interface + pequenas interações: em
   alguns passos dá pra "responder" pra Agatha e ela reage.
   Ela fala como quem tá explicando o sistema pra um agente de
   verdade — não descreve mecânica de jogo, e nunca usa a palavra
   "dano" nem jargão de sistema. Voz dela: direta, ríspida, com
   humor seco e fascínio genuíno por ocultismo — não sarcasmo de
   quem foi obrigada, é o jeito dela mesmo.
   ══════════════════════════════════════════════════════════════ */

const TUT_AGATHA_KEY = 'mp_tutorialAgathaV3';

/* Cada passo pode ter:
   - sel: seletor CSS do elemento a destacar (null = sem holofote, texto centralizado)
   - pad: preenchimento extra ao redor do elemento destacado (px)
   - before: nome da aba pra trocar antes de destacar (chama showTab)
   - p: array de parágrafos que a Agatha "fala" nesse passo
   - reacts: opcional, array de {label, reply} — aparece como botões
     depois do último parágrafo do passo; clicar mostra uma resposta
     extra dela, sem interromper o fluxo do tour */
const TUT_AGATHA_STEPS = [
  // ── FASE 1: tela de entrada ──
  {
    sel:null, phase:'login',
    p:[
      'Agatha Volkomenn. Guarda esse nome — não vou ficar repetindo.',
      'Fui eu que me candidatei pra fazer essa introdução. A maioria da Ordem prefere manter distância de mim, então prefiro logo cortar caminho e ir direto ao que interessa. Menos gente fingindo educação por perto, melhor pra todo mundo.',
      'Isso aqui é o sistema da Ordo Realitas. É onde fica registrado tudo sobre você e sobre as operações em campo: seus dados, seus recursos, o que te ameaça. Vou te mostrar cada parte, apontando exatamente onde fica na tela. Presta atenção — eu não repito duas vezes. Sério.'
    ],
    reacts:[
      {label:'"Por que logo você?"', reply:'Porque sou boa nisso, e ninguém mais se ofereceu rápido o suficiente. Próxima pergunta.'},
      {label:'"Você é sempre assim?"', reply:'Direta? Sempre. Já economizei mais gente sendo direta do que educação nunca economizou. Continua prestando atenção.'}
    ]
  },
  {
    sel:'#login-form', phase:'login', pad:10,
    p:[
      'Aqui é onde você entra no sistema. Codinome e senha — nada elaborado. A Ordem não te pede pra decorar um mantra, só pra não usar "1234" feito amador.',
      'Se já tem cadastro, preenche e entra. Rápido, sem cerimônia.'
    ]
  },
  {
    sel:'.login-toggle', phase:'login', pad:8,
    p:['Primeira vez no sistema? Clica em "Cadastrar agente" ali. Você cria o acesso agora e monta o resto com calma depois — ninguém cobra pra saber tudo no primeiro minuto. Só no segundo.']
  },
  {
    sel:'#login-mestre-block', phase:'login', pad:10,
    p:[
      'Esse botão dourado é só pra quem coordena a operação. Acesso separado, com ferramentas que agentes de campo não veem: registros da operação, fichas de ameaças catalogadas, esse tipo de coisa.',
      'Se você não tem certeza se é você quem coordena, não é. Entra como agente e segue o fluxo.'
    ],
    reacts:[
      {label:'"E se eu clicar por engano?"', reply:'Você vai ver um monte de ferramenta que não faz sentido pra você e vai perceber sozinho. Ou eu vou saber, de um jeito ou de outro.'}
    ]
  },

  // ── FASE 2: dentro do sistema, depois do primeiro acesso ──
  {
    sel:'#tab-nav', phase:'app', pad:6,
    p:[
      'Bom, você entrou. Essa barra em cima tem todas as áreas do sistema. Vou passar por cada uma — não precisa gravar tudo agora, só quero que você saiba que existem antes de precisar delas correndo.',
      'E vai precisar. Mais cedo do que gostaria.'
    ]
  },
  {
    sel:'.ficha-header', phase:'app', pad:10,
    p:[
      'Isso aqui é o topo do seu registro: nome, codinome, classe, seu grau de exposição ao paranormal — o NEX —, deslocamento, origem, e a trilha que você seguiu dentro da Ordem, se já escolheu uma.',
      'É a sua identidade documentada. Oficialmente. E, se as coisas derem errado, também é o que resta de você nos arquivos.',
      'Tem um botão de descartar esse registro logo ali. Existe por motivo burocrático. Não é indicação minha.'
    ],
    reacts:[
      {label:'"Por que eu ia querer descartar?"', reply:'Burocracia, troca de agente, esse tipo de coisa chata. Eu nunca descartei nada na vida — mas também nunca segui regra direito.'}
    ]
  },
  {
    sel:'.stat-grid', phase:'app', pad:8,
    p:[
      'Três números que decidem se você continua de pé: sua vitalidade, sua sanidade, e o esforço que ainda tem pra gastar antes de precisar parar.',
      'As barras mudam de cor sozinhas quando ficam baixas — primeiro um aviso amarelo, depois vermelho pulsando feito alarme. Gente boa em campo aprende a olhar pra essas barras antes de olhar pra qualquer outra coisa. Gente morta aprendeu tarde demais.'
    ]
  },
  {
    sel:'#dmg-calc-body', phase:'app', pad:8,
    action:function(){ if(typeof toggleDmgCalc==='function') toggleDmgCalc(true); },
    p:[
      'Isso aqui registra o que te atingiu. Você escolhe a origem do ferimento — impacto de arma de fogo, força bruta, ou algo pior: energia, morte, sangue, conhecimento, medo — informa a gravidade, e o sistema desconta sozinho.',
      'Se você tiver proteção equipada, ela absorve parte do impacto automaticamente, sem você precisar fazer conta nenhuma.',
      'Eu sobrevivi anos sem essa ferramenta. Vocês não sabem a sorte que têm.'
    ],
    reacts:[
      {label:'"O que é pior que arma de fogo?"', reply:'Alguma coisa que te lembra que existir é opcional. Você vai entender melhor quando eu chegar na aba de Elementos.'}
    ]
  },
  {
    sel:'.attr-hex-wrap', phase:'app', pad:14,
    p:[
      'Cinco capacidades: Agilidade, Força, Intelecto, Presença, Vigor.',
      'É basicamente o que separa você de uma estatística — o que seu corpo e sua cabeça aguentam antes de começarem a cobrar a conta.'
    ]
  },
  {
    sel:'#pericias-wrap', phase:'app', pad:8,
    p:[
      'Uma lista longa da sua capacidade em cada área específica: investigação, combate, ocultismo, o que for.',
      'Ninguém domina tudo isso de primeira. E quem diz que domina está mentindo, ou nunca saiu de casa pra testar na prática.'
    ]
  },
  {
    sel:'#hab-list', phase:'app', pad:10,
    p:['Habilidades e talentos paranormais ficam registrados aqui. Se você tem algo além do óbvio — e eu espero que tenha —, é aqui que mora.']
  },
  {
    sel:'#ataques-wrap', phase:'app', pad:8,
    p:[
      'Isso lista o que você usa pra revidar. Armas equipadas no seu equipamento aparecem sozinhas aqui.',
      'E dá pra registrar ataques manuais também — rituais, golpes, qualquer coisa que não venha de um item físico.'
    ]
  },
  {
    sel:'#cond-grid', phase:'app', pad:8,
    p:['Condições ativas. Envenenado, abalado, apavorado — o que estiver te afetando agora fica marcado bem visível aqui. Não adianta fingir que não tá acontecendo.']
  },
  {
    sel:'#tab-dados', phase:'app', pad:6, before:'dados',
    p:[
      'Aqui o sistema registra seus testes automaticamente — aplica sua capacidade em cada perícia sozinho.',
      'Nada de precisar calcular nada de cabeça no meio de uma operação, enquanto alguma coisa do outro lado tenta te matar.'
    ]
  },
  {
    sel:'#tab-danos', phase:'app', pad:6, before:'danos',
    p:['Essa área tem o mesmo registro de ferimentos que te mostrei antes, só que solta — dá pra usar direto, sem precisar abrir seu registro completo toda vez que alguém do grupo se ferra.']
  },
  {
    sel:'#tab-inventario', phase:'app', pad:6, before:'inventario',
    p:[
      'Seu equipamento. Armas, munição, itens paranormais recuperados em campo, o que for.',
      'Você equipa proteção por aqui também — e sim, é o que alimenta o registro de ferimentos que já te mostrei. Presta atenção nisso; gente esquece com uma frequência que deveria preocupar mais do que preocupa.'
    ],
    reacts:[
      {label:'"Já perdeu equipamento em campo?"', reply:'Perdi um parceiro tentando recuperar equipamento. Guarda suas coisas, mas não morre por elas.'}
    ]
  },
  {
    sel:'#tab-rituais', phase:'app', pad:6, before:'rituais',
    p:[
      'Rituais. Aqui é onde ficam documentados todos os pedidos que você pode fazer.',
      'Porque é isso que um ritual é, no fundo — um pedido. Você entrega alguma coisa sua: esforço, sangue, memória, o que a força do outro lado exigir. E, se o pedido for feito do jeito certo, ela responde. Cada ritual documentado aqui tem o preço e o efeito escritos, sem letra miúda.',
      'Eu já fiz pedidos que a maioria nem ousaria formular. Trata cada um com o respeito que merece — um pedido malfeito também recebe resposta, só que raramente a que você queria.'
    ],
    reacts:[
      {label:'"Você criou um ritual? Sério?"', reply:'Sério. Chamam de "Descarnar". O nome já entrega o que ele pede em troca. Não pergunta como eu descobri que funcionava.'}
    ]
  },
  {
    sel:'#tab-elementos', phase:'app', pad:6, before:'elementos',
    p:[
      'Energia, Morte, Sangue, Conhecimento, Medo. Não é o paranormal que se apoia nelas — é o mundo inteiro. O seu, o meu, o de quem nunca vai saber que essas forças existem.',
      'A diferença é que agentes aprendem a reconhecer cada uma. O resto das pessoas só sente o efeito e chama de azar, coincidência, ou sorte. Aprende a reconhecer cedo — é bem melhor do que reconhecer de repente, no escuro.'
    ]
  },
  {
    sel:'#tab-criaturas', phase:'app', pad:6, before:'criaturas',
    p:[
      'Bestiário. Registros de ameaças catalogadas, prontos pra consulta em campo sem precisar improvisar na hora.',
      'Tem gente na Ordem que me colocaria numa lista dessas, se tivesse coragem. Ainda não tiveram.'
    ]
  },
  {
    sel:'#tab-multi', phase:'app', pad:6, before:'multi',
    p:['Canal entre agentes conectados. O que acontece em campo aparece em tempo real pra todo mundo acompanhar. Quem coordena controla o ambiente e o clima por perto daqui também — porque atmosfera importa, mesmo quando ninguém admite.']
  },
  {
    sel:'#tab-psique', phase:'app', pad:6, before:'psique',
    p:[
      'Um mapa dos seus vínculos — em quem você confia, quem você evita, o que resta entre vocês.',
      'Parece dispensável até o dia em que não é. Eu aprendi isso tarde. Sugiro que você aprenda mais cedo.'
    ],
    reacts:[
      {label:'"O que te fez aprender tarde?"', reply:'Isso não tá no tour. Próxima aba.'}
    ]
  },
  {
    sel:null, phase:'app',
    p:[
      'É isso. Eu não apareço de novo sozinha — tem um botão "⛧ Tour" ali em cima, do lado do seu nome, se quiser passar por tudo de novo.',
      'Se a dúvida for sobre regra — como um teste funciona, o que cada atributo faz, esse tipo de coisa — tem o Samuel também, no botão azul do lado. Ele explica melhor esse lado técnico do que eu. Eu só assusto melhor.',
      'Agora vai. Presta atenção no que tá na tela, porque eu não vou estar por perto pra repetir no meio de uma operação de verdade.'
    ],
    reacts:[
      {label:'"Obrigado, Agatha."', reply:'Não me agradece. Só não morre — isso já paga a dívida.'}
    ]
  }
];

let _tutStepIdx = 0;
let _tutParaIdx = 0;
let _tutTyping = false;
let _tutTypeTimer = null;
let _tutResizeBound = false;
let _tutActivePhase = null;
let _tutCurrentFullText = '';

function _tutStepsForPhase(phase){
  return TUT_AGATHA_STEPS.filter(s=>s.phase===phase);
}
function _tutCurrentSteps(){ return _tutStepsForPhase(_tutActivePhase); }

function _tutBuildChrome(){
  if(document.getElementById('tutorial-agatha-overlay')) return;
  const wrap = document.createElement('div');
  wrap.id = 'tutorial-agatha-overlay';
  wrap.innerHTML = `
    <div id="tut-blocker"></div>
    <div id="tut-spot"></div>
    <button class="tut-skip" onclick="_tutPular()">Pular ✕</button>
    <div class="tut-step-count" id="tut-step-count"></div>
    <div class="tut-card" id="tut-card">
      <div class="tut-name-row">
        <span class="tut-name">Agatha</span>
        <span class="tut-role">Ocultista da Ordo Realitas</span>
      </div>
      <div class="tut-text" id="tut-text" onclick="_tutAdvanceOrSkipType()"></div>
      <div class="tut-reacts" id="tut-reacts"></div>
      <div class="tut-continue-hint" id="tut-hint">▾ clique ou "próximo" pra continuar</div>
      <div class="tut-footer">
        <div class="tut-dots" id="tut-dots"></div>
        <div class="tut-btns">
          <button class="tut-btn" id="tut-btn-back" onclick="_tutVoltar()">◂ Voltar</button>
          <button class="tut-btn primary" id="tut-btn-next" onclick="_tutAvancar()">Próximo ▸</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  if(!_tutResizeBound){
    window.addEventListener('resize', ()=>{ if(document.getElementById('tutorial-agatha-overlay')) _tutPositionAll(); });
    _tutResizeBound = true;
  }
  requestAnimationFrame(()=> wrap.classList.add('show'));
}

function _tutUpdateChrome(){
  const steps = _tutCurrentSteps();
  const total = steps.length;
  const countEl = document.getElementById('tut-step-count');
  if(countEl) countEl.textContent = `${_tutStepIdx+1} / ${total}`;
  const dotsEl = document.getElementById('tut-dots');
  if(dotsEl){
    dotsEl.innerHTML = '';
    steps.forEach((s,i)=>{
      const d = document.createElement('span');
      d.className = 'tut-dot' + (i===_tutStepIdx?' on':'');
      dotsEl.appendChild(d);
    });
  }
  const backBtn = document.getElementById('tut-btn-back');
  if(backBtn) backBtn.disabled = (_tutStepIdx===0);
  const nextBtn = document.getElementById('tut-btn-next');
  if(nextBtn) nextBtn.textContent = (_tutStepIdx===total-1) ? 'Encerrar ⛧' : 'Próximo ▸';
}

// Posiciona o holofote (recorte iluminado no fundo escuro) sobre o
// elemento-alvo, e o cartão de fala perto dele — acima ou abaixo,
// o que couber melhor na tela.
function _tutPositionAll(){
  const steps = _tutCurrentSteps();
  const step = steps[_tutStepIdx];
  const spot = document.getElementById('tut-spot');
  const card = document.getElementById('tut-card');
  if(!spot || !card || !step) return;
  const el = step.sel ? document.querySelector(step.sel) : null;

  if(!el){
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
  card.style.top = top + 'px';
  card.style.left = left + 'px';
  card.style.transform = 'translateX(-50%)';
  card.style.bottom = '';
}

// Escreve um texto qualquer, letra por letra, no balão de fala.
// Usado tanto pros parágrafos normais quanto pras respostas de reação.
function _tutTypeText(full){
  const textEl = document.getElementById('tut-text');
  const hintEl = document.getElementById('tut-hint');
  if(!textEl) return;
  hintEl.classList.remove('show');
  _tutCurrentFullText = full;
  // Mede a altura final do texto ANTES de começar a digitar e trava essa
  // altura mínima — assim o cartão e o holofote não ficam se mexendo
  // conforme o texto vai crescendo letra por letra.
  textEl.style.minHeight = '';
  textEl.innerHTML = full.replace(/\n/g,'<br>');
  textEl.style.minHeight = textEl.offsetHeight + 'px';
  let i = 0;
  _tutTyping = true;
  clearInterval(_tutTypeTimer);
  textEl.innerHTML = '<span class="tut-cursor"></span>';
  _tutPositionAll();
  _tutTypeTimer = setInterval(()=>{
    i += 2;
    if(i >= full.length){
      i = full.length;
      clearInterval(_tutTypeTimer);
      _tutTyping = false;
      hintEl.classList.add('show');
      _tutMaybeShowReacts();
    }
    textEl.innerHTML = full.slice(0,i).replace(/\n/g,'<br>') + (i<full.length ? '<span class="tut-cursor"></span>' : '');
  }, 15);
}

function _tutFinishTypingNow(){
  clearInterval(_tutTypeTimer);
  _tutTyping = false;
  const textEl = document.getElementById('tut-text');
  if(textEl) textEl.innerHTML = _tutCurrentFullText.replace(/\n/g,'<br>');
  const hintEl = document.getElementById('tut-hint');
  if(hintEl) hintEl.classList.add('show');
  _tutPositionAll();
  _tutMaybeShowReacts();
}

// Mostra os botões de "resposta" (se o passo tiver, e só depois do
// último parágrafo dele terminar de aparecer, e só uma vez).
function _tutMaybeShowReacts(){
  const steps = _tutCurrentSteps();
  const step = steps[_tutStepIdx];
  const reactsEl = document.getElementById('tut-reacts');
  if(!reactsEl || !step) return;
  if(step.reacts && _tutParaIdx === step.p.length-1 && !step._reacted){
    reactsEl.innerHTML = step.reacts.map((r,i)=>
      `<button class="tut-react-btn" onclick="_tutPlayReact(${i})">${r.label}</button>`
    ).join('');
  } else {
    reactsEl.innerHTML = '';
  }
}

function _tutClearReacts(){
  const reactsEl = document.getElementById('tut-reacts');
  if(reactsEl) reactsEl.innerHTML = '';
  const said = document.getElementById('tut-react-said');
  if(said) said.remove();
}

// Clique num botão de resposta: mostra o que "você" disse, e a
// réplica dela por cima do parágrafo — sem atrapalhar o avanço normal.
function _tutPlayReact(i){
  const steps = _tutCurrentSteps();
  const step = steps[_tutStepIdx];
  if(!step || !step.reacts || !step.reacts[i]) return;
  step._reacted = true;
  const reactsEl = document.getElementById('tut-reacts');
  if(reactsEl) reactsEl.innerHTML = '';
  const textEl = document.getElementById('tut-text');
  let said = document.getElementById('tut-react-said');
  if(!said && textEl){
    said = document.createElement('div');
    said.id = 'tut-react-said';
    said.className = 'tut-react-said';
    textEl.parentNode.insertBefore(said, textEl);
  }
  if(said) said.textContent = step.reacts[i].label.replace(/^"|"$/g,'');
  _tutTypeText(step.reacts[i].reply);
}

function _tutTypeParagraph(){
  const steps = _tutCurrentSteps();
  const step = steps[_tutStepIdx];
  if(!step) return;
  _tutClearReacts();
  _tutTypeText(step.p[_tutParaIdx] || '');
}

function _tutAdvanceOrSkipType(){
  if(_tutTyping){ _tutFinishTypingNow(); return; }
  _tutAvancar();
}

function _tutShowStep(){
  const steps = _tutCurrentSteps();
  const step = steps[_tutStepIdx];
  // Alguns passos precisam de uma ação antes de aparecer — ex: abrir
  // sozinho o painel de ferimentos, se o jogador tiver deixado fechado.
  try{ if(typeof step.action === 'function') step.action(); }catch(e){}
  // Alguns passos trocam de aba antes de destacar o elemento
  try{
    if(step.before && typeof showTab === 'function'){
      const btn = document.querySelector(`.tab-btn[onclick*="'${step.before}'"]`);
      showTab(step.before, btn);
      // showTab já cuida de elementos/itens/criaturas/multi/psique/mestre sozinho;
      // esses três aqui são chamados via onclick extra no HTML, então replico manualmente.
      if(step.before==='danos' && typeof renderDanosTab==='function') renderDanosTab();
      if(step.before==='rituais' && typeof renderTranscendenciaPanel==='function') setTimeout(renderTranscendenciaPanel,80);
      if(step.before==='agentes' && typeof renderAgentesTab==='function') renderAgentesTab();
    }
  }catch(e){}
  _tutUpdateChrome();
  const el = step.sel ? document.querySelector(step.sel) : null;
  if(el && el.scrollIntoView){
    el.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(()=>{ _tutPositionAll(); _tutTypeParagraph(); }, 280);
  } else {
    _tutPositionAll();
    _tutTypeParagraph();
  }
}

function _tutAvancar(){
  if(_tutTyping){ _tutFinishTypingNow(); return; }
  const steps = _tutCurrentSteps();
  const step = steps[_tutStepIdx];
  if(_tutParaIdx < step.p.length-1){
    _tutParaIdx++;
    _tutTypeParagraph();
    return;
  }
  if(_tutStepIdx < steps.length-1){
    _tutStepIdx++;
    _tutParaIdx = 0;
    _tutShowStep();
  } else {
    _tutFimDaFase();
  }
}

function _tutVoltar(){
  if(_tutParaIdx > 0){
    _tutParaIdx--;
    _tutTypeParagraph();
    return;
  }
  if(_tutStepIdx > 0){
    _tutStepIdx--;
    const steps = _tutCurrentSteps();
    _tutParaIdx = steps[_tutStepIdx].p.length - 1;
    _tutShowStep();
  }
}

function _tutFecharOverlay(){
  const overlay = document.getElementById('tutorial-agatha-overlay');
  if(overlay){
    overlay.classList.remove('show');
    setTimeout(()=>{ overlay.remove(); }, 500);
  }
  document.removeEventListener('keydown', _tutKeyHandler);
  _tutActivePhase = null;
}

// Botão "Pular" — cancela o tour de vez, não importa a fase.
function _tutPular(){
  _tutFecharOverlay();
  try{ localStorage.setItem(TUT_AGATHA_KEY, '1'); }catch(e){}
}

// Chegou no fim dos passos de uma fase clicando em "Próximo"/"Encerrar".
// Só marca como "visto" de vez quando a fase do app termina — a fase de
// login sozinha ainda precisa deixar o tour continuar depois do login.
function _tutFimDaFase(){
  const fase = _tutActivePhase;
  _tutFecharOverlay();
  if(fase === 'app'){
    try{ localStorage.setItem(TUT_AGATHA_KEY, '1'); }catch(e){}
  }
}

function _tutKeyHandler(e){
  if(!document.getElementById('tutorial-agatha-overlay')){
    document.removeEventListener('keydown', _tutKeyHandler);
    return;
  }
  if(e.key===' '||e.key==='Enter'){ e.preventDefault(); _tutAvancar(); }
  else if(e.key==='Escape'){ _tutPular(); }
  else if(e.key==='ArrowLeft'){ _tutVoltar(); }
  else if(e.key==='ArrowRight'){ _tutAvancar(); }
}

function _tutIniciarFase(phase){
  if(document.getElementById('tutorial-agatha-overlay')) return;
  const steps = _tutStepsForPhase(phase);
  if(!steps.length) return;
  _tutActivePhase = phase;
  _tutStepIdx = 0;
  _tutParaIdx = 0;
  _tutBuildChrome();
  _tutShowStep();
  document.addEventListener('keydown', _tutKeyHandler);
}

function _tutIniciarFaseLogin(){ _tutIniciarFase('login'); }
function _tutIniciarFaseApp(){ _tutIniciarFase('app'); }

// Botão manual — sempre disponível. Se ainda não logou, mostra o tour do
// login; se já tá dentro do app, mostra o tour completo das abas.
function reverTourAgatha(){
  const noApp = !document.getElementById('screen-app') || !document.getElementById('screen-app').classList.contains('active');
  if(noApp) _tutIniciarFaseLogin();
  else _tutIniciarFaseApp();
}

// ── AVISINHO SUTIL DA AGATHA ──
// Toda vez que alguém entra e o tour completo NÃO vai rodar (porque já
// foi visto antes), aparece um avisinho discreto lembrando que o botão
// "⛧ Tour" existe, sem interromper nada. Some sozinho depois de um tempo.
function _tutMostrarLembrete(){
  if(document.getElementById('tut-lembrete')) return;
  const el = document.createElement('div');
  el.id = 'tut-lembrete';
  el.innerHTML = `
    <span class="tut-lembrete-mark">⛧</span>
    <span class="tut-lembrete-txt"><b>Agatha:</b> se esquecer de algo, o tour tá ali em cima — botão "⛧ Tour", do lado do seu nome.</span>
    <button class="tut-lembrete-x" onclick="_tutFecharLembrete()" title="Dispensar">✕</button>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('show'));
  clearTimeout(_tutLembreteTimer);
  _tutLembreteTimer = setTimeout(_tutFecharLembrete, 9000);
}
let _tutLembreteTimer = null;
function _tutFecharLembrete(){
  const el = document.getElementById('tut-lembrete');
  if(!el) return;
  clearTimeout(_tutLembreteTimer);
  el.classList.remove('show');
  setTimeout(()=> el.remove(), 500);
}

// Continua automaticamente pro tour de dentro do app assim que o login
// (e a cutscene de entrada normal do site) terminar, só na primeira visita.
// Se o tour já foi visto antes, mostra só o avisinho discreto no lugar.
(function(){
  const _origPlayLoginCutscene = window.playLoginCutscene;
  if(typeof _origPlayLoginCutscene === 'function'){
    window.playLoginCutscene = function(user, isMestreFlag, onComplete){
      _origPlayLoginCutscene(user, isMestreFlag, function(){
        if(typeof onComplete === 'function') onComplete();
        let jaViu = false;
        try{ jaViu = localStorage.getItem(TUT_AGATHA_KEY) === '1'; }catch(e){}
        if(!jaViu) setTimeout(_tutIniciarFaseApp, 500);
        else setTimeout(_tutMostrarLembrete, 700);
      });
    };
  }
})();

// Roda a fase de login sozinha na primeira visita ao site.
document.addEventListener('DOMContentLoaded', ()=>{
  let jaViu = false;
  try{ jaViu = localStorage.getItem(TUT_AGATHA_KEY) === '1'; }catch(e){}
  if(!jaViu) setTimeout(_tutIniciarFaseLogin, 300);
});
