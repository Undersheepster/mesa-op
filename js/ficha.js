const appFicha = {};
  },
  'Artista':{
    pericias:'Diplomacia e Profissão (Artes)',
    poder:'Magnum Opus',
    desc:'Músico, ator, pintor, escritor. Você criou obras que tocam a alma humana — e talvez algo além dela. Usa criatividade e carisma para resolver problemas.',
    poder_desc:'Uma vez por missão, pode apresentar uma performance ou obra de arte para mudar a atitude de um grupo de NPCs (DT definida pelo Mestre). Sucesso: todos ficam Amigáveis por 1 hora.'
  },
  'Atleta':{
    pericias:'Atletismo e Fortitude',
    poder:'110%',
    desc:'Esportista de elite, corredor, nadador, escalador. Seu corpo é uma máquina perfeitamente treinada. Supera obstáculos físicos que paralisariam qualquer outro.',
    poder_desc:'Uma vez por cena, pode gastar 2 PE para ignorar os efeitos de uma condição física (Lento, Fatigado, Imobilizado) por 1 rodada. Recebe +2 em testes de Atletismo.'
  },
  'Camponês':{
    pericias:'Adestramento e Sobrevivência',
    poder:'Trilhas e Rumos',
    desc:'Criado no campo, floresta ou interior. Conhece os ritmos da natureza, rastrea animais e sobrevive em ambientes onde outros morreriam em horas.',
    poder_desc:'Não sofre penalidade em deslocamento e Sobrevivência por clima ruim ou terreno difícil natural. Uma vez por missão, pode guiar o grupo por um caminho alternativo evitando uma ameaça.'
  },
  'Criminoso':{
    pericias:'Crime e Furtividade',
    poder:'O Crime Compensa',
    desc:'Ladrão, hacker, vigarista ou traficante reformado. Conhece os cantos escuros da sociedade. Na Ordem, sua experiência com o submundo é surpreendentemente valiosa.',
    poder_desc:'Uma vez por cena, pode gastar 1 PE para acessar o mercado negro local. Obtém um item de categoria I sem custo de Prestígio (disponibilidade a critério do Mestre). +2 em testes de Crime.'
  },
  'Detetive':{
    pericias:'Investigação e Percepção',
    poder:'Olhos Aguçados',
    desc:'Investigador particular, perito forense ou policial federal. Resolve mistérios onde outros veem apenas caos. Entrou na Ordem ao se deparar com um caso impossível.',
    poder_desc:'Uma vez por cena, ao fazer um teste para procurar pistas, pode gastar 1 PE para receber +5 nesse teste. Se já for treinado em Investigação, recebe +1d20 em vez do bônus fixo.'
  },
  'Exorcista':{
    pericias:'Intuição e Religião',
    poder:'Exorcismo',
    desc:'Praticante de rituais religiosos de purificação. Enfrenta entidades do Outro Lado com fé e conhecimento ancestral. Chamado pela Ordem por suas habilidades únicas.',
    poder_desc:'Pode realizar um exorcismo (ação completa, Intuição ou Religião DT 20) em um ser possuído ou local amaldiçoado. Sucesso: remove a influência paranormal por 1 cena. +2 em testes contra efeitos de possessão.'
  },
  'Inventor':{
    pericias:'Profissão e Tecnologia',
    poder:'Ferramentas Favoritas',
    desc:'Engenheiro, maker ou cientista aplicado. Constrói soluções onde não existem. Seus gadgets improvisados já salvaram mais vidas do que qualquer arma convencional.',
    poder_desc:'Possui um kit de ferramentas pessoal. Uma vez por missão, pode criar um gadget improvisado (DT 15, Tecnologia) com efeito prático definido pelo Mestre. Itens tecnológicos que usa têm categoria reduzida em 1.'
  },
  'Lutador':{
    pericias:'Luta e Reflexos',
    poder:'Mão Pesada',
    desc:'Praticante de artes marciais, boxeador ou brigão de rua. Seus punhos são armas letais. Entrou na Ordem após um confronto com algo que não deveria existir.',
    poder_desc:'Recebe +2 em rolagens de dano com ataques corpo a corpo. Uma vez por cena, ao acertar um ataque desarmado, pode gastar 1 PE para aplicar uma manobra (derrubar, desarmar ou empurrar) gratuitamente.'
  },
  'Mercenário':{
    pericias:'Tática e Luta ou Pontaria (à escolha)',
    poder:'Posição de Combate',
    desc:'Soldado de aluguel, segurança privado ou ex-militar que trabalha por dinheiro. Pragmático e eficiente. Não faz perguntas — exceto sobre o pagamento.',
    poder_desc:'No início de cada combate, pode declarar uma posição tática (Ataque, Defesa ou Flanqueio). Dependendo da posição: +2 em testes de ataque, +2 na Defesa, ou +1d20 em ataques flanqueando, respectivamente.'
  },
  'Operário':{
    pericias:'Fortitude e Profissão (trabalhos braçais)',
    poder:'Ferramentas da Profissão',
    desc:'Construtor, mecânico, minerador ou trabalhador manual. Corpo forjado pelo trabalho duro. Conhece estruturas, máquinas e como quebrar (ou consertar) qualquer coisa.',
    poder_desc:'Possui proficiência com ferramentas de trabalho como armas improvisadas (+1 dano). Uma vez por missão, pode usar seu conhecimento profissional para resolver um problema estrutural ou mecânico automaticamente.'
  },
  'Policial':{
    pericias:'Atletismo e Pontaria',
    poder:'Patrulha T.I.',
    desc:'Policial civil, militar ou agente federal. Treinado para proteger e servir — mas o paranormal quebrou todas as suas certezas sobre o que realmente ameaça a cidade.',
    poder_desc:'Recebe +2 em testes de Pontaria com armas de fogo. Uma vez por missão, pode invocar recursos policiais (suporte, informações de registro, acesso a locais restritos) com uma ligação (DT 15 Diplomacia).'
  },
  'Religioso':{
    pericias:'Intuição e Religião',
    poder:'Devoção',
    desc:'Padre, pastor, monge, rabino ou adepto de qualquer fé. Sua crença é um escudo contra o Outro Lado. A Ordem o procurou porque sabe que a fé tem poder real.',
    poder_desc:'Recebe resistência a efeitos paranormais de medo e possessão (+2 em testes de Vontade contra esses efeitos). Uma vez por cena, pode usar Religião para confortar um aliado, restaurando 1d6 de Sanidade.'
  },
  'Soldado':{
    pericias:'Fortitude e Tática',
    poder:'Veterano de Guerra',
    desc:'Militar de carreira, ex-combatente ou veterano de conflitos armados. Disciplinado, resiliente e treinado para operar sob pressão extrema em qualquer ambiente.',
    poder_desc:'Não pode ser Surpreendido em combate. Uma vez por cena, pode gastar 2 PE para permitir que um aliado em alcance curto use sua reação como ação livre (reposicionamento tático).'
  },
  'Trambiqueiro':{
    pericias:'Enganação e Intuição',
    poder:'Papo Furado',
    desc:'Vigarista, charlatão ou manipulador nato. Faz qualquer um acreditar em qualquer coisa. Na Ordem, sua habilidade de improvisar histórias e disfarces vale tanto quanto uma pistola.',
    poder_desc:'Uma vez por cena, pode relançar um teste de Enganação ou Diplomacia falho, aceitando o novo resultado. Além disso, recebe +2 em testes de Enganação e +1 em Intuição para detectar mentiras de outros.'
  }
};

function renderOrigemDesc(){
  const orig=(document.getElementById('f-origem')||{}).value||'';
  const el=document.getElementById('origem-desc');
  if(!el)return;
  const o=ORIGENS_DB[orig];
  if(o){
    el.innerHTML=`<b style="color:var(--gold-light)">${o.poder}</b> &nbsp;|&nbsp; <span style="color:var(--crimson)"><span class="sym-el sym-conhecimento" title="Conhecimento"></span> ${o.pericias}</span><br>${o.desc}<br><span style="color:var(--white-ash);font-size:10.5px">⬝ ${o.poder_desc}</span>`;
    el.style.display='block';
  } else {
    el.style.display='none';
  }
}
 
/* ══════════════════════════════════════════════
   POPULATE / AUTO-SAVE
══════════════════════════════════════════════ */
function populateAll(){
  const c=userChar(currentUser);
  sv('f-nome',c.nome);sv('f-classe',c.classe);sv('f-nex',c.nex);sv('f-origem',c.origem);sv('f-trilha',c.trilha);sv('f-historia',c.historia);
  sv('m-nome',c.opNome);sv('m-local',c.opLocal);sv('m-ameaca',c.opAmeaca);sv('m-ent',c.opEnt);sv('m-resumo',c.opResumo);
  document.getElementById('s-pv').textContent=c.pv;document.getElementById('s-pvmax').textContent=c.pvMax;
  document.getElementById('s-san').textContent=c.san;document.getElementById('s-sanmax').textContent=c.sanMax;
  document.getElementById('s-esf').textContent=c.esf;document.getElementById('s-esfmax').textContent=c.esfMax;
  renderAttrs();renderPericias();renderConds();renderHabs();renderInv();renderRit();renderPistas();renderNotas();renderLog();loadTrilhaSelects();renderClasseDesc();renderOrigemDesc();
  buildTokenControls();
  if(isMestre){sv('mestre-notes',db.mestre.notes||'');populateMestre();}
}
 
let saveTimer=null;
function autoSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveChar();flashSave('save-ficha');flashSave('save-missao');},800);}
 
function flashSave(id){const e=document.getElementById(id);if(e){e.textContent='⛧ Salvo.';setTimeout(()=>e.textContent='',2000);}}
 
/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
function showTab(t,btn){
  document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  if(btn)btn.classList.add('active');
  if(t==='mapa'){setTimeout(initMap,60);}
  if(t==='token'){setTimeout(()=>{buildTokenControls();drawToken();},60);}
  if(t==='mestre'&&isMestre){populateMestre();}
}
 
/* ══════════════════════════════════════════════
   STATS
══════════════════════════════════════════════ */
function adjStat(stat,d){
  const c=userChar(currentUser);
  c[stat]=Math.max(0,Math.min(c[stat+'Max'],c[stat]+d));
  document.getElementById('s-'+stat).textContent=c[stat];
  saveDB();drawToken();
}
function adjMax(stat,d){
  const c=userChar(currentUser);
  c[stat+'Max']=Math.max(1,c[stat+'Max']+d);
  c[stat]=Math.min(c[stat],c[stat+'Max']);
  document.getElementById('s-'+stat).textContent=c[stat];
  document.getElementById('s-'+stat+'max').textContent=c[stat+'Max'];
  saveDB();
}
 
/* ══════════════════════════════════════════════
   ATTRS
══════════════════════════════════════════════ */
const ATTRS=['Agilidade','Força','Intelecto','Presença','Vigor'];
function renderAttrs(){
  const el=document.getElementById('attr-list');el.innerHTML='';
  const c=userChar(currentUser);
  ATTRS.forEach(a=>{
    const vv=c.attrs[a]||1;
    const row=document.createElement('div');row.className='attr-row';
    row.innerHTML=`<span class="attr-name">${a}</span>
      <div class="attr-track"><div class="attr-fill" style="width:${vv*20}%"></div></div>
      <span class="attr-val">${vv}</span>
      <button class="adj" onclick="adjAttr('${a}',-1)">−</button>
      <button class="adj" onclick="adjAttr('${a}',1)">+</button>`;
    el.appendChild(row);
  });
}
function adjAttr(a,d){const c=userChar(currentUser);c.attrs[a]=Math.max(1,Math.min(5,(c.attrs[a]||1)+d));renderAttrs();saveDB();}
 
/* ══════════════════════════════════════════════
   PERÍCIAS
══════════════════════════════════════════════ */
const PERICIAS=[
  {nome:'Atletismo',attr:'FOR'},
  {nome:'Atualidades',attr:'INT'},
  {nome:'Ciências',attr:'INT'},
  {nome:'Diplomacia',attr:'PRE'},
  {nome:'Enganação',attr:'PRE'},
  {nome:'Fortitude',attr:'VIG'},
  {nome:'Furtividade',attr:'AGI'},
  {nome:'Intimidação',attr:'PRE'},
  {nome:'Intuição',attr:'PRE'},
  {nome:'Investigação',attr:'INT'},
  {nome:'Luta',attr:'FOR'},
  {nome:'Medicina',attr:'INT'},
  {nome:'Ocultismo',attr:'INT'},
  {nome:'Percepção',attr:'PRE'},
  {nome:'Pilotagem',attr:'AGI'},
  {nome:'Pontaria',attr:'AGI'},
  {nome:'Prestidigitação',attr:'AGI'},
  {nome:'Profissão',attr:'INT'},
  {nome:'Reflexos',attr:'AGI'},
  {nome:'Religião',attr:'INT'},
  {nome:'Tática',attr:'INT'},
  {nome:'Tecnologia',attr:'INT'},
  {nome:'Vontade',attr:'PRE'}
];
const GRAUS=[{label:'—',val:0},{label:'Treinado',val:5},{label:'Veterano',val:10},{label:'Expert',val:15}];
function _buildPericiaEl(nome, attr, custom){
  const c=userChar(currentUser);
  if(!c.pericias) c.pericias={};
  const grau=c.pericias[nome]||0;
  const grauIdx=GRAUS.findIndex(g=>g.val===grau);
  const next=GRAUS[(grauIdx+1)%GRAUS.length];
  const isOn=grau>0;
  const wrap=document.createElement('div');
  wrap.style.cssText='display:flex;align-items:center;gap:4px;padding:5px 7px;border:1px solid '+(isOn?'rgba(139,0,0,0.6)':'rgba(58,0,0,0.35)')+';background:'+(isOn?'rgba(139,0,0,0.12)':'transparent')+';transition:all .15s;';
  // clickable main area
  const main=document.createElement('div');
  main.style.cssText='display:flex;align-items:center;gap:4px;flex:1;cursor:pointer;user-select:none;min-width:0';
  main.title='Avançar grau → '+next.label;
  main.innerHTML=`<span style="font-size:10px;font-family:'Oswald',sans-serif;letter-spacing:.05em;color:${isOn?'var(--crimson-hot)':'var(--white-dust)'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</span>`+
    `<span style="font-size:9px;font-family:'Courier Prime',monospace;color:${isOn?'var(--crimson-mid)':'var(--white-dust)'};white-space:nowrap;margin-left:2px">${attr}${grau>0?' +'+grau:''}</span>`+
    (grau>0?`<span style="font-size:8px;font-family:'Oswald',sans-serif;color:var(--gold-light);letter-spacing:.03em;margin-left:2px">${GRAUS[grauIdx].label}</span>`:'');
  main.onclick=()=>{
    const cur=c.pericias[nome]||0;
    const idx=GRAUS.findIndex(g=>g.val===cur);
    c.pericias[nome]=GRAUS[(idx+1)%GRAUS.length].val;
    renderPericias();saveDB();
  };
  wrap.appendChild(main);
  if(custom){
    const del=document.createElement('button');
    del.className='del-btn';del.textContent='×';del.title='Remover perícia';
    del.style.cssText='font-size:14px;padding:0 2px;flex-shrink:0';
    del.onclick=(e)=>{e.stopPropagation();delPericia(nome);};
    wrap.appendChild(del);
  }
  return wrap;
}
function renderPericias(){
  const el=document.getElementById('pericias-wrap');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.pericias) c.pericias={};
  if(!c.periciasCust) c.periciasCust=[];
  // built-in
  PERICIAS.forEach(p=>el.appendChild(_buildPericiaEl(p.nome,p.attr,false)));
  // custom
  c.periciasCust.forEach(p=>el.appendChild(_buildPericiaEl(p.nome,p.attr,true)));
}
function addPericia(){
  const nome=document.getElementById('per-inp-nome').value.trim();
  if(!nome){toast('⛧ Digite o nome da perícia.');return;}
  const attr=document.getElementById('per-inp-attr').value;
  const c=userChar(currentUser);
  if(!c.periciasCust) c.periciasCust=[];
  const existe=PERICIAS.some(p=>p.nome.toLowerCase()===nome.toLowerCase())||c.periciasCust.some(p=>p.nome.toLowerCase()===nome.toLowerCase());
  if(existe){toast('⛧ Perícia já existe.');return;}
  c.periciasCust.push({nome,attr});
  document.getElementById('per-inp-nome').value='';
  renderPericias();saveDB();toast('Perícia adicionada.');
}
function delPericia(nome){
  const c=userChar(currentUser);
  if(!c.periciasCust) return;
  c.periciasCust=c.periciasCust.filter(p=>p.nome!==nome);
  if(c.pericias) delete c.pericias[nome];
  renderPericias();saveDB();toast('Perícia removida.');
}
 


appFicha._buildPericiaEl = _buildPericiaEl;
appFicha.addPericia = addPericia;
appFicha.adjAttr = adjAttr;
appFicha.adjMax = adjMax;
appFicha.adjStat = adjStat;
appFicha.autoSave = autoSave;
appFicha.delPericia = delPericia;
appFicha.flashSave = flashSave;
appFicha.populateAll = populateAll;
appFicha.renderAttrs = renderAttrs;
appFicha.renderOrigemDesc = renderOrigemDesc;
appFicha.renderPericias = renderPericias;
appFicha.showTab = showTab;
Object.assign(window, appFicha);
