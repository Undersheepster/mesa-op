/* ══════════════════════════════════════════════════════════════
   TOUR DO SISTEMA — apresentado pelo Samuel Norte (hacker da
   Equipe de Pesquisa da Ordo Realitas, de Desconjuração/Enigma
   do Medo). Arquivo isolado, mesmo padrão do tutorial-agatha.js
   — reaproveita as MESMAS classes CSS (.tut-card, .tut-text etc)
   pra manter a cara visual igual, só com IDs próprios (prefixo
   "sam-") pra não colidir com o tour da Agatha.

   Diferença de conteúdo: enquanto a Agatha mostra o SITE (onde
   fica cada botão), o Samuel explica o SISTEMA de Ordem Paranormal
   de verdade — classes, NEX, atributos, testes, PV/Sanidade/Esforço,
   dano, elementos, rituais, trilhas, condições. É jargão de RPG
   mesmo, de propósito — é literalmente sobre isso que ele fala.

   Personalidade dele: gente boa, brincalhão, recebe todo mundo bem
   e se preocupa com a saúde dos agentes — mas tem um pavor genuíno
   de paranormal, e isso vaza toda vez que o assunto fica sério.
   ══════════════════════════════════════════════════════════════ */

const SAM_TOUR_KEY = 'mp_tourSamuelV1';

const SAM_STEPS = [
  {
    sel:null,
    p:[
      'E aí! Samuel Norte, prazer. Se a Agatha já passou por aqui, relaxa — eu prometo ser um pouco menos assustador. Só um pouco.',
      'Ela te mostrou onde fica cada botão do sistema, né? Beleza. Eu tô aqui pra outra parte: as regras de verdade. Como o seu personagem funciona por trás da tela.',
      'Isso aqui vai ser mais longo que o tour dela, aviso logo. Tem bastante coisa pra explicar, e eu prefiro fazer direito do que fazer rápido. Fica confortável, pega uma água, o que precisar.'
    ],
    reacts:[
      {label:'"Você não tem medo de nada?"', reply:'Ah, tenho, sim. De bastante coisa, na real. Só finjo bem enquanto tô explicando regra.'},
      {label:'"Isso vai demorar muito?"', reply:'Um pouco. Mas eu prometo que no fim você entende o jogo de verdade, não só decorado. Vale o tempo.'}
    ]
  },
  {
    sel:'.ficha-tags-row', pad:10,
    p:[
      'Primeira coisa: sua classe. Ela é a base de tudo — define seu papel na equipe e como você ganha poder conforme o jogo avança.',
      'Combatente aguenta pancada, briga de perto ou à distância, e é quem segura a linha de frente quando as coisas ficam feias. Especialista é o coringa: perícia de sobra, versatilidade, brilha resolvendo problema fora de combate — investigação, infiltração, esse tipo de coisa.',
      'Ocultista mexe com ritual desde o primeiro dia. Literalmente lida com o que a gente evita comentar alto — e paga um preço por isso, physical e mental, sempre.',
      'Escolhe uma e ela define seus pontos fortes o jogo inteiro. Não tem "classe errada", só tem estilo de jogo diferente.'
    ]
  },
  {
    sel:'.ficha-tags-row', pad:10,
    p:[
      'NEX é o seu Nível de Exposição — quanto contato seu personagem já teve com o paranormal, em porcentagem. Começa em 5% pra maioria e sobe conforme a história avança.',
      'A cada alguns pontos de NEX você desbloqueia coisa nova: perícia extra, poder de classe, acesso a rituais mais fortes. É basicamente a curva de progressão do personagem inteiro.',
      'Mas — e aqui que fica sério — NEX alto também é NEX perigoso. Quanto mais exposto, mais perto seu personagem fica de coisas que mudam ele de um jeito que não dá pra desfazer. Ninguém sai imune depois de anos vendo esse tipo de coisa de perto. Inclusive eu. Vamos com calma nesse assunto, por favor.'
    ]
  },
  {
    sel:'.attr-hex-wrap', pad:14,
    p:[
      'Seus cinco atributos: Agilidade, Força, Intelecto, Presença, Vigor. Cada teste que você faz usa um deles como base.',
      'Agilidade é reflexo, esquiva, pontaria fina. Força é o quanto você carrega e o quanto seu golpe dói. Intelecto resolve enigma, conhecimento técnico e ocultismo teórico.',
      'Presença é carisma, intimidação, força de vontade — inclusive resistir a efeito mental. Vigor é resistência física pura: quanto seu corpo aguenta antes de desistir.',
      'Isso aqui decide praticamente tudo que seu personagem tenta fazer. Um número bom no atributo certo salva vida. Literalmente.'
    ]
  },
  {
    sel:'#pericias-wrap', pad:8,
    p:[
      'Perícias funcionam assim: você rola um d20, soma o bônus do atributo relacionado e o seu nível de treinamento naquela perícia, e compara com uma Dificuldade que o Mestre define.',
      'Treinamento vai de Destreinado até Expert — quanto mais treinado, maior o bônus fixo que você soma, e alguns testes nem dá pra tentar sem treino nenhum. Investigação, Luta, Ocultismo, Percepção, Furtividade... cada perícia cobre um tipo de situação diferente.',
      'Dificuldade costuma seguir uma régua: fácil é baixa, média é o padrão pra maioria das coisas do dia a dia complicado, difícil já exige personagem bom naquilo. Quanto mais grave a consequência de errar, maior tende a ser a régua.',
      'Passou da dificuldade, deu certo. Não passou... bom, aí a história continua de um jeito que você não escolheu.'
    ],
    reacts:[
      {label:'"E se eu errar feio o teste?"', reply:'Geralmente a cena só piora de um jeito criativo. O Mestre adora um erro feio, sinceramente. Eu já vi gente errar teste de Furtividade e acordar um Amálgamo inteiro.'}
    ]
  },
  {
    sel:'.stat-grid', pad:8,
    p:[
      'Pontos de Vida. O óbvio: representa o quanto de dano físico seu corpo aguenta. Zerou, seu personagem para de aguentar — entra num estado grave, e a partir daí quem decide o que acontece é o Mestre.',
      'Se você já deu uma olhada na aba de Status com a Agatha, é exatamente aí que esse número vira decisão de vida ou morte de verdade.'
    ]
  },
  {
    sel:'.stat-grid', pad:8,
    p:[
      'Sanidade. Esse aqui é sério, presta atenção: representa o quanto sua cabeça aguenta ver, sentir e entender coisa que não deveria existir.',
      'Zerar Sanidade não é "ficar estressado" — tem consequência mecânica de verdade, transtornos que mudam como seu personagem se comporta, às vezes de forma permanente. O paranormal cobra um preço mental antes mesmo de chegar perto de te matar fisicamente.',
      'Cuida da sua Sanidade tanto quanto cuida do seu PV. Sério mesmo. Eu não brinco com isso.'
    ]
  },
  {
    sel:'.stat-grid', pad:8,
    p:[
      'Esforço. É o combustível de habilidades de classe e de boa parte dos rituais — cada uso específico consome uma quantidade dele.',
      'Gasta com cuidado. Ficar sem Esforço bem no momento que você mais precisa de uma habilidade é surpreendentemente comum, e normalmente acontece no pior momento possível da cena.'
    ]
  },
  {
    sel:'#dmg-calc-body', pad:8,
    p:[
      'Dano tem tipo. Físico e Balístico são os "normais" — arma branca, tiro, essas coisas. O resto — Energia, Morte, Sangue, Conhecimento, Medo — é dano paranormal, ligado diretamente a cada elemento.',
      'Armadura tem Redução de Dano, a RD, que abate uma parte fixa de cada ataque — mas só contra os tipos que ela foi feita pra deter. Uma armadura balística não faz nada contra um ritual de Medo, por exemplo. Proteção física não segura o que não é físico.',
      'Isso aqui calcula tudo isso pra você, então nem precisa decorar a tabela toda. Eu decorei, e olha a carga que ficou na minha cabeça até hoje.'
    ]
  },
  {
    sel:'#tab-elementos', before:'elementos', pad:6,
    p:[
      'Os cinco elementos paranormais: Energia, Morte, Sangue, Conhecimento e Medo. Cada ritual, cada criatura, praticamente cada coisa estranha que existe se encaixa em pelo menos um desses.',
      'Energia é força bruta invisível — eletricidade, radiação, esse tipo de coisa fora de controle. Sangue é vida e sacrifício, quase sempre envolve entregar algo do próprio corpo pra conseguir o efeito.',
      'Conhecimento é informação proibida — o tipo de coisa que, uma vez que você sabe, não dá pra "desaprender". Morte é... bom, é Morte mesmo, sem muito mistério no nome.',
      'E Medo é justamente o motivo de eu preferir ficar no computador enquanto vocês vão pro campo. Sem ofensa.'
    ],
    reacts:[
      {label:'"Você tem medo do elemento Medo?"', reply:'Tenho medo de TUDO que tem a ver com o elemento Medo. É redundante, eu sei, mas é a verdade.'}
    ]
  },
  {
    sel:'#tab-rituais', before:'rituais', pad:6,
    p:[
      'Rituais são organizados em círculos — do 1º ao 4º, cada um mais forte, mais caro e mais arriscado que o anterior.',
      'Cada ritual pede um custo pra ser executado: Esforço quase sempre, e dependendo de quão feio ele é, Pontos de Vida ou Sanidade também. Ocultistas aprendem rituais como habilidade principal; outras classes conseguem alguns com o tempo, geralmente em número bem menor.',
      'Executar um ritual tem tempo de conjuração — alguns são rápidos o bastante pra usar no meio de uma luta, outros exigem minutos de concentração que ninguém tem quando algo tá tentando te matar.',
      'E cada ritual pertence a um elemento — o efeito dele reflete isso. Um ritual de Sangue não vai parecer nem de longe com um de Conhecimento.'
    ]
  },
  {
    sel:'.ficha-desc-box.origem-box', pad:8,
    p:[
      'Sua Origem é de onde seu personagem veio antes de entrar pra Ordem — o que ele fazia, o tipo de vida que tinha. Policial, médico, criminoso, acadêmico, o que for.',
      'Ela te dá uma perícia treinada de graça, um poder específico, e geralmente um item ou contato inicial que reflete esse passado. É o detalhe que faz dois Combatentes parecerem pessoas completamente diferentes.'
    ]
  },
  {
    sel:'#tab-trilhas', before:'trilhas', pad:6,
    p:[
      'Trilhas Paranormais são a especialização que você escolhe conforme o NEX sobe — cada uma aprofunda uma linha de habilidades específica dentro da sua classe.',
      'É onde seu personagem para de ser "genérico" e vira alguém específico: o Combatente que virou praticamente uma arma viva, o Ocultista que abraçou de vez um elemento só, esse tipo de identidade.'
    ]
  },
  {
    sel:'#tab-inventario', before:'inventario', pad:6,
    p:[
      'Rapidinho sobre equipamento: cada item tem peso, e seu personagem tem um limite de carga baseado em Força. Passa disso, fica sobrecarregado — pior deslocamento, pior desempenho físico.',
      'Munição se conta item por item na maioria das armas, então sim, ela acaba, e sim, alguém sempre esquece de recarregar antes de entrar na sala errada.',
      'Itens paranormais recuperados em campo costumam ter uso limitado ou custo próprio pra ativar — não são só "arma melhor", geralmente vêm com implicação.'
    ]
  },
  {
    sel:'#cond-grid', pad:8,
    p:[
      'Condições são efeitos temporários que mudam como seu personagem funciona, e ficam marcadas aqui bem visíveis.',
      'Apavorado tira ação e foco. Envenenado desgasta PV com o tempo, rodada após rodada. Enredado te prende no lugar. Cego, Surdo, Caído — cada uma muda a matemática de tudo que você tenta fazer enquanto durar.',
      'Vale a pena aprender a reconhecer cada uma de cabeça, porque no meio de uma cena tensa ninguém tem tempo de parar pra ler a descrição completa.'
    ]
  },
  {
    sel:null,
    p:[
      'Última coisa antes de eu te soltar: Classes de Perigo. Toda ameaça — criatura, ritual descontrolado, agente corrompido — recebe uma classificação que indica o quão fora da sua liga ela pode estar.',
      'Uma ameaça de classe alta pra um grupo de NEX baixo normalmente não é "luta difícil", é "corre". E tudo bem correr. Sobreviver também é vitória nesse jogo, mais do que as pessoas costumam admitir.'
    ]
  },
  {
    sel:null,
    p:[
      'É basicamente isso — o esqueleto do sistema inteiro. Tem letra miúda pra cada regra, claro, mas com isso você já entende o que tá rolando numa mesa sem travar toda hora perguntando "espera, como funciona isso mesmo?"',
      'Se ainda tiver dúvida sobre onde clicar no site em vez de como a regra funciona, chama a Agatha de novo — ela é rispida, mas cobre isso melhor que eu. Eu cuido da teoria, ela cuida da prática.',
      'Boa sorte aí fora. E, sério: se alguém mencionar o elemento Medo perto de mim, finge que eu não ouvi.'
    ],
    reacts:[
      {label:'"Valeu, Samuel."', reply:'Disponha! Qualquer coisa é só chamar de novo pelo botão aí em cima. Vou fingir que não tenho mais nada melhor pra fazer.'}
    ]
  }
];

let _samStepIdx = 0;
let _samParaIdx = 0;
let _samTyping = false;
let _samTypeTimer = null;
let _samResizeBound = false;
let _samCurrentFullText = '';

function _samBuildChrome(){
  if(document.getElementById('tutorial-samuel-overlay')) return;
  const wrap = document.createElement('div');
  wrap.id = 'tutorial-samuel-overlay';
  wrap.innerHTML = `
    <div id="sam-blocker"></div>
    <div id="sam-spot"></div>
    <button class="tut-skip" onclick="_samPular()">Pular ✕</button>
    <div class="tut-step-count" id="sam-step-count"></div>
    <div class="tut-card" id="sam-card">
      <div class="tut-name-row">
        <span class="tut-name" style="color:#22cc66;text-shadow:0 0 8px rgba(34,204,102,0.35)">Samuel</span>
        <span class="tut-role" style="color:#22cc66;opacity:.85">Pesquisa &amp; Suporte Técnico — Ordo Realitas</span>
      </div>
      <div class="tut-text" id="sam-text" onclick="_samAdvanceOrSkipType()"></div>
      <div class="tut-reacts" id="sam-reacts"></div>
      <div class="tut-continue-hint" id="sam-hint">▾ clique ou "próximo" pra continuar</div>
      <div class="tut-footer">
        <div class="tut-dots" id="sam-dots"></div>
        <div class="tut-btns">
          <button class="tut-btn" id="sam-btn-back" onclick="_samVoltar()">◂ Voltar</button>
          <button class="tut-btn primary" id="sam-btn-next" onclick="_samAvancar()">Próximo ▸</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  if(!_samResizeBound){
    window.addEventListener('resize', ()=>{ if(document.getElementById('tutorial-samuel-overlay')) _samPositionAll(); });
    _samResizeBound = true;
  }
  requestAnimationFrame(()=> wrap.classList.add('show'));
}

function _samUpdateChrome(){
  const total = SAM_STEPS.length;
  const countEl = document.getElementById('sam-step-count');
  if(countEl) countEl.textContent = `${_samStepIdx+1} / ${total}`;
  const dotsEl = document.getElementById('sam-dots');
  if(dotsEl){
    dotsEl.innerHTML = '';
    SAM_STEPS.forEach((s,i)=>{
      const d = document.createElement('span');
      d.className = 'tut-dot' + (i===_samStepIdx?' on':'');
      dotsEl.appendChild(d);
    });
  }
  const backBtn = document.getElementById('sam-btn-back');
  if(backBtn) backBtn.disabled = (_samStepIdx===0);
  const nextBtn = document.getElementById('sam-btn-next');
  if(nextBtn) nextBtn.textContent = (_samStepIdx===total-1) ? 'Encerrar ✎' : 'Próximo ▸';
}

function _samPositionAll(){
  const step = SAM_STEPS[_samStepIdx];
  const spot = document.getElementById('sam-spot');
  const card = document.getElementById('sam-card');
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
  card.style.top = top + 'px';
  card.style.left = left + 'px';
  card.style.transform = 'translateX(-50%)';
  card.style.bottom = '';
}

function _samTypeText(full){
  const textEl = document.getElementById('sam-text');
  const hintEl = document.getElementById('sam-hint');
  if(!textEl) return;
  hintEl.classList.remove('show');
  _samCurrentFullText = full;
  textEl.style.minHeight = '';
  textEl.innerHTML = full.replace(/\n/g,'<br>');
  textEl.style.minHeight = textEl.offsetHeight + 'px';
  let i = 0;
  _samTyping = true;
  clearInterval(_samTypeTimer);
  textEl.innerHTML = '<span class="tut-cursor"></span>';
  _samPositionAll();
  _samTypeTimer = setInterval(()=>{
    i += 2;
    if(i >= full.length){
      i = full.length;
      clearInterval(_samTypeTimer);
      _samTyping = false;
      hintEl.classList.add('show');
      _samMaybeShowReacts();
    }
    textEl.innerHTML = full.slice(0,i).replace(/\n/g,'<br>') + (i<full.length ? '<span class="tut-cursor"></span>' : '');
  }, 15);
}

function _samFinishTypingNow(){
  clearInterval(_samTypeTimer);
  _samTyping = false;
  const textEl = document.getElementById('sam-text');
  if(textEl) textEl.innerHTML = _samCurrentFullText.replace(/\n/g,'<br>');
  const hintEl = document.getElementById('sam-hint');
  if(hintEl) hintEl.classList.add('show');
  _samPositionAll();
  _samMaybeShowReacts();
}

function _samMaybeShowReacts(){
  const step = SAM_STEPS[_samStepIdx];
  const reactsEl = document.getElementById('sam-reacts');
  if(!reactsEl || !step) return;
  if(step.reacts && _samParaIdx === step.p.length-1 && !step._reacted){
    reactsEl.innerHTML = step.reacts.map((r,i)=>
      `<button class="tut-react-btn" onclick="_samPlayReact(${i})">${r.label}</button>`
    ).join('');
  } else {
    reactsEl.innerHTML = '';
  }
}

function _samClearReacts(){
  const reactsEl = document.getElementById('sam-reacts');
  if(reactsEl) reactsEl.innerHTML = '';
  const said = document.getElementById('sam-react-said');
  if(said) said.remove();
}

function _samPlayReact(i){
  const step = SAM_STEPS[_samStepIdx];
  if(!step || !step.reacts || !step.reacts[i]) return;
  step._reacted = true;
  const reactsEl = document.getElementById('sam-reacts');
  if(reactsEl) reactsEl.innerHTML = '';
  const textEl = document.getElementById('sam-text');
  let said = document.getElementById('sam-react-said');
  if(!said && textEl){
    said = document.createElement('div');
    said.id = 'sam-react-said';
    said.className = 'tut-react-said';
    textEl.parentNode.insertBefore(said, textEl);
  }
  if(said) said.textContent = step.reacts[i].label.replace(/^"|"$/g,'');
  _samTypeText(step.reacts[i].reply);
}

function _samTypeParagraph(){
  const step = SAM_STEPS[_samStepIdx];
  if(!step) return;
  _samClearReacts();
  _samTypeText(step.p[_samParaIdx] || '');
}

function _samAdvanceOrSkipType(){
  if(_samTyping){ _samFinishTypingNow(); return; }
  _samAvancar();
}

function _samShowStep(){
  const step = SAM_STEPS[_samStepIdx];
  try{
    if(step.before && typeof showTab === 'function'){
      const btn = document.querySelector(`.tab-btn[onclick*="'${step.before}'"]`);
      showTab(step.before, btn);
      if(step.before==='rituais' && typeof renderTranscendenciaPanel==='function') setTimeout(renderTranscendenciaPanel,80);
    }
  }catch(e){}
  _samUpdateChrome();
  const el = step.sel ? document.querySelector(step.sel) : null;
  if(el && el.scrollIntoView){
    el.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(()=>{ _samPositionAll(); _samTypeParagraph(); }, 280);
  } else {
    _samPositionAll();
    _samTypeParagraph();
  }
}

function _samAvancar(){
  if(_samTyping){ _samFinishTypingNow(); return; }
  const step = SAM_STEPS[_samStepIdx];
  if(_samParaIdx < step.p.length-1){
    _samParaIdx++;
    _samTypeParagraph();
    return;
  }
  if(_samStepIdx < SAM_STEPS.length-1){
    _samStepIdx++;
    _samParaIdx = 0;
    _samShowStep();
  } else {
    _samFinalizar();
  }
}

function _samVoltar(){
  if(_samParaIdx > 0){
    _samParaIdx--;
    _samTypeParagraph();
    return;
  }
  if(_samStepIdx > 0){
    _samStepIdx--;
    _samParaIdx = SAM_STEPS[_samStepIdx].p.length - 1;
    _samShowStep();
  }
}

function _samFecharOverlay(){
  const overlay = document.getElementById('tutorial-samuel-overlay');
  if(overlay){
    overlay.classList.remove('show');
    setTimeout(()=>{ overlay.remove(); }, 500);
  }
  document.removeEventListener('keydown', _samKeyHandler);
}

function _samPular(){
  _samFecharOverlay();
  try{ localStorage.setItem(SAM_TOUR_KEY, '1'); }catch(e){}
}

function _samFinalizar(){
  _samFecharOverlay();
  try{ localStorage.setItem(SAM_TOUR_KEY, '1'); }catch(e){}
}

function _samKeyHandler(e){
  if(!document.getElementById('tutorial-samuel-overlay')){
    document.removeEventListener('keydown', _samKeyHandler);
    return;
  }
  if(e.key===' '||e.key==='Enter'){ e.preventDefault(); _samAvancar(); }
  else if(e.key==='Escape'){ _samPular(); }
  else if(e.key==='ArrowLeft'){ _samVoltar(); }
  else if(e.key==='ArrowRight'){ _samAvancar(); }
}

// Ponto de entrada — sempre manual, pelo botão "✎ Sistema" na barra
// superior (só faz sentido depois de logado, já que aponta pra
// elementos reais da ficha/abas).
function iniciarTourSamuel(){
  if(document.getElementById('tutorial-samuel-overlay')) return;
  if(document.getElementById('tutorial-agatha-overlay')) return; // não roda os dois juntos
  _samStepIdx = 0;
  _samParaIdx = 0;
  _samBuildChrome();
  _samShowStep();
  document.addEventListener('keydown', _samKeyHandler);
}
