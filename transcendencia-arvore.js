/* ════════════════════════════════════════════════════════════
   TRANSCENDENCIA-ARVORE.JS — dados e regras da Transcendência comum
   (rework v3: GRAUS + ÁRVORE DE AFINIDADE, motor revisado)
   ────────────────────────────────────────────────────────────
   REGRAS
   · Cada liberação do Mestre é uma PASSAGEM e sobe 1 GRAU:
       I   Limiar    escolhe o elemento → ganha a MARCA (passiva fixa)
                      e o ritual de afinidade
       II  Corrente  escolhe uma VIA (A ou B) → 1ª dádiva + SEGREDOS
       III Abismo    1 dádiva da mesma Via (2 opções) + SEGREDOS
       IV  Coroa     o ÁPICE da Via + SEGREDOS
   · SEGREDOS: cada Passagem (II–IV) libera SEGREDOS_POR_GRAU rituais
     oficiais do elemento (2 por grau).
   · SEGREDO = um ritual oficial do elemento com círculo ≤ grau
     (Manifestação conta como círculo 0), ainda não aprendido.
   · Concluído o Grau IV, a próxima Passagem abre uma NOVA FACETA:
     outro elemento, recomeçando no Grau I. Marcas e dádivas já
     ganhas nunca se perdem.
   · Dádivas são poderes de mesa: o app guarda e controla os usos
     (cena / sessão); o efeito é aplicado pelo jogador e pelo Mestre.
   · O ritual de afinidade (grátis) é 1× por SESSÃO e também fica
     guardado na ficha (id "<elem>-afinidade"), não mais no navegador.

   DADOS NA FICHA
     c.trans = { v:2, rev:N, trilhas:{ <elem>:{grau, via, dadivas:[id],
                 segredos:[nome], ts} }, usos:{id:true}, log:[…] }
       rev  contador que sobe a cada mudança. A sincronização usa o
            rev (e não o "tamanho" do progresso) para decidir qual
            cópia vence — assim o "Desfazer" do Mestre não é revertido.
     c.transcendencia (legado — mantido: elemento ATIVO, ritual_gratis)
     c.transcendenciaHistorico (legado — um item por segredo)
   Fichas antigas são migradas na primeira leitura (ver migrar()).
   Dádivas pendentes de fichas migradas são resolvidas SEM nova
   liberação do Mestre ("acerto").

   API: window.TransArvore
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const GRAUS = [
  {n:1, nome:'Limiar',   rom:'I',   circ:0},
  {n:2, nome:'Corrente', rom:'II',  circ:2},
  {n:3, nome:'Abismo',   rom:'III', circ:3},
  {n:4, nome:'Coroa',    rom:'IV',  circ:4},
];
const SEGREDOS_POR_GRAU = 2; /* rituais liberados em cada Passagem (Graus II–IV) */
const USO = {passiva:'Passiva', rodada:'1× por rodada', cena:'1× por cena', sessao:'1× por sessão'};

/* ───────────── a árvore de cada elemento ───────────── */
const ARV = {
  sangue:{
    marca:{nome:'Pulso Carmesim', uso:'passiva',
      resumo:'+1d6 PV temporários ao usar rituais de Sangue • sente batimentos próximos',
      desc:'Seu coração bate no compasso d’ELE. Uma vez por rodada, ao conjurar um ritual de Sangue, você recebe 1d6 PV temporários. Você também sente o pulso de seres vivos a até 9 m: sabe quantos são e onde estão, mas não o que são.'},
    vias:{A:{nome:'Via da Sede', lema:'Quem sangra, alimenta.'}, B:{nome:'Via da Veia', lema:'O sangue é uma estrada.'}},
    nos:[
      {id:'sangue-A2', grau:2, via:'A', nome:'Sede de Sangue', uso:'rodada', desc:'Uma vez por rodada, ao causar dano com um ataque corpo a corpo ou com um ritual de Sangue, você recebe PV temporários iguais à sua Emoção (mínimo 1).'},
      {id:'sangue-A3a', grau:3, via:'A', nome:'Frenesi', uso:'cena', custo:'2 PE', desc:'Ação livre. Por 1d4+1 rodadas você recebe +2 em ataques corpo a corpo e +2 de dano, mas não pode conjurar rituais, fazer ações que exijam concentração nem recuar de propósito.'},
      {id:'sangue-A3b', grau:3, via:'A', nome:'Eco do Abate', uso:'rodada', desc:'Uma vez por rodada, quando você reduz um inimigo a 0 PV, recupera 1d6 PV e 1 PE.'},
      {id:'sangue-A4', grau:4, via:'A', nome:'Fome Carmesim', uso:'sessao', custo:'5 PE', desc:'Ação padrão. Até o fim da cena, seus ataques e rituais de Sangue ignoram 5 pontos de RD e curam você em metade do dano causado. Ao fim da cena você sofre 1d6 de dano de Sangue que não pode ser reduzido.'},
      {id:'sangue-B2', grau:2, via:'B', nome:'Vínculo de Veias', uso:'cena', custo:'2 PE', desc:'Ação de movimento, toque. Escolha um aliado: até o fim da cena, uma vez por rodada, quando ele sofreria dano você pode (reação) assumir até 2d6 desse dano.'},
      {id:'sangue-B3a', grau:3, via:'B', nome:'Coagulação', uso:'passiva', desc:'Enquanto estiver com metade ou menos dos seus PV, você recebe RD 3 contra dano balístico, de corte, de impacto e de perfuração, e estanca sangramentos automaticamente.'},
      {id:'sangue-B3b', grau:3, via:'B', nome:'Rastro Vivo', uso:'cena', custo:'1 PE', desc:'Ação de movimento. Você sente o sangue de todo ser que sangrou nesta cena: sabe a direção e a distância de cada um e recebe +5 em testes para rastreá-los.'},
      {id:'sangue-B4', grau:4, via:'B', nome:'Coração Duplo', uso:'sessao', desc:'Reação, quando você cairia a 0 PV: em vez disso, fica com PV iguais ao dobro do seu Físico (mínimo 5) e todos os seres a 3 m sofrem 2d6 de dano de Sangue (Fortitude, DT de rituais, reduz à metade).'},
    ],
    textos:{
      2:['O pulso agora tem ritmo próprio.','Cada veia sua é uma estrada — e ELE caminha por todas.','A Corrente carmesim aceita você.'],
      3:['O vermelho deixa de ser cor. Vira lugar.','Você afunda no Abismo, e o Abismo afunda em você.','Cada coração do mundo bate um compasso atrás do seu.'],
      4:['O trono do Rei Carmesim cede um assento.','Não à força. Por reconhecimento.','Você veste a Coroa de sangue — e ela é quente.'],
    },
  },
  morte:{
    marca:{nome:'Véu Fino', uso:'passiva',
      resumo:'Enxerga espíritos e ecos de mortos • imune ao 1º teste de Medo por cena',
      desc:'Para você, o Véu é translúcido. Você enxerga espíritos, ecos e rastros de morte recente, e ouve o que os mortos ainda repetem. Além disso, é imune ao primeiro teste de Medo de cada cena.'},
    vias:{A:{nome:'Via da Ceifa', lema:'Toda vida tem prazo.'}, B:{nome:'Via do Véu', lema:'Os mortos também falam.'}},
    nos:[
      {id:'morte-A2', grau:2, via:'A', nome:'Toque Gélido', uso:'rodada', desc:'Uma vez por rodada, o primeiro dano de Morte que você causa recebe +1d6.'},
      {id:'morte-A3a', grau:3, via:'A', nome:'Marca da Ceifa', uso:'cena', custo:'2 PE', desc:'Ação de movimento. Marque um ser em alcance curto: uma vez por rodada, o primeiro dano que você causar a ele recebe +2d6 de dano de Morte, e ele não recupera PV por meios normais até o fim da cena.'},
      {id:'morte-A3b', grau:3, via:'A', nome:'Colheita', uso:'rodada', desc:'Uma vez por rodada, quando um ser morre a até 9 m de você, você recupera 1d4 PE.'},
      {id:'morte-A4', grau:4, via:'A', nome:'Ceifeiro', uso:'sessao', custo:'5 PE', desc:'Ação padrão. Todos os inimigos a até 9 m sofrem 6d6 de dano de Morte (Fortitude, DT de rituais, reduz à metade). Seres reduzidos a 0 PV por esse dano viram cinzas.'},
      {id:'morte-B2', grau:2, via:'B', nome:'Passo Entre Fios', uso:'cena', custo:'1 PE', desc:'Ação de movimento. Até o fim do turno você atravessa criaturas e objetos finos (portas, grades, paredes de até 30 cm) e ignora terreno difícil, mas não pode terminar o turno dentro de um objeto.'},
      {id:'morte-B3a', grau:3, via:'B', nome:'Murmúrio dos Mortos', uso:'cena', custo:'2 PE', desc:'Ação padrão. Invoque o eco de um ser morto neste local: ele responde 3 perguntas com “sim”, “não” ou “não sei”, dentro do que sabia em vida.'},
      {id:'morte-B3b', grau:3, via:'B', nome:'Companhia Invisível', uso:'cena', custo:'3 PE', desc:'Ação padrão. Um eco acompanha você até o fim da cena: você e seus aliados contam como flanqueando um inimigo à sua escolha, e você recebe +5 em Furtividade.'},
      {id:'morte-B4', grau:4, via:'B', nome:'Recusar o Fim', uso:'sessao', custo:'5 PE', desc:'Ação padrão, alcance curto. Traga de volta um aliado (ou a si mesmo, como reação) que tenha morrido há até 1d4 rodadas, com metade dos PV. Você perde 1d10 de Sanidade e o Mestre pode cobrar um preço do Outro Lado.'},
    ],
    textos:{
      2:['O frio agora tem rostos.','Eles não pedem nada. Apenas observam.','A Corrente do silêncio corre pelas suas mãos.'],
      3:['Você caminha onde os passos não deixam eco.','No Abismo, até o seu nome é uma lembrança.','ELE sorri — sem boca, sem rosto, sem pressa.'],
      4:['Todos os caminhos terminam aqui.','E você descobre que o fim também tem um trono.','A Coroa de cinzas é leve. Quem a usa, não.'],
    },
  },
  energia:{
    marca:{nome:'Faísca Viva', uso:'passiva',
      resumo:'Equipamentos respondem ao toque • +2 em Reflexos contra Energia',
      desc:'A eletricidade obedece você nas pequenas coisas: liga, desliga e destrava aparelhos eletrônicos simples ao toque, e sente linhas de energia a até 9 m. Você recebe +2 em Reflexos contra efeitos de Energia.'},
    vias:{A:{nome:'Via do Caos', lema:'O que se quebra, se liberta.'}, B:{nome:'Via do Fluxo', lema:'Nada precisa ficar parado.'}},
    nos:[
      {id:'energia-A2', grau:2, via:'A', nome:'Descarga em Arco', uso:'rodada', desc:'Uma vez por rodada, quando um ritual de Energia seu causa dano, um segundo ser a até 3 m do alvo sofre metade desse dano.'},
      {id:'energia-A3a', grau:3, via:'A', nome:'Sobrecarga', uso:'cena', custo:'2 PE', desc:'Ação padrão. Sobrecarregue um aparelho eletrônico em alcance curto: ao fim da rodada ele explode, causando 4d6 de dano de Energia em 3 m (Reflexos, DT de rituais, reduz à metade).'},
      {id:'energia-A3b', grau:3, via:'A', nome:'Pele de Raio', uso:'passiva', desc:'Você recebe RD 5 contra Energia. Quando um ser acerta você com ataque corpo a corpo, ele sofre 1d6 de dano de Energia.'},
      {id:'energia-A4', grau:4, via:'A', nome:'Tempestade Carmesim', uso:'sessao', custo:'5 PE', desc:'Ação padrão. Raios caem sobre até 3 seres em alcance médio: 8d6 de dano de Energia (Reflexos, DT de rituais, reduz à metade). Quem falhar fica desprevenido por 1 rodada.'},
      {id:'energia-B2', grau:2, via:'B', nome:'Passo Elétrico', uso:'cena', custo:'1 PE', desc:'Ação de movimento. Teletransporte-se até 9 m para um espaço que você consiga ver.'},
      {id:'energia-B3a', grau:3, via:'B', nome:'Curto-Circuito', uso:'cena', custo:'2 PE', desc:'Ação padrão. Todos os aparelhos eletrônicos a até 9 m (câmeras, rádios, fechaduras, armas eletrônicas) desligam por 1d4 rodadas. Seres de Energia resistem com Vontade (DT de rituais).'},
      {id:'energia-B3b', grau:3, via:'B', nome:'Condutor', uso:'rodada', desc:'Ação livre. Transfira até 5 dos seus PE para um aliado ao toque.'},
      {id:'energia-B4', grau:4, via:'B', nome:'Aceleração Carmesim', uso:'sessao', custo:'5 PE', desc:'Ação livre. Até o fim da cena, você recebe uma ação de movimento adicional por rodada e +5 em Defesa e Reflexos. Ao fim da cena, fica fatigado.'},
    ],
    textos:{
      2:['A faísca aprendeu a correr.','Ela cruza paredes, fios, ossos.','A Corrente roxa responde ao seu chamado.'],
      3:['O ar estala. O mundo inteiro é um circuito aberto.','No Abismo, o caos não grita — canta.','ELE ri, e a eletricidade ri junto.'],
      4:['O relâmpago deixa de cair. Ele nasce em você.','Nada o contém. Nada o precede.','A Coroa de estática pesa menos que um pensamento.'],
    },
  },
  conhecimento:{
    marca:{nome:'Olho Que Sabe', uso:'passiva',
      resumo:'Detecta rituais e auras automaticamente • +5 em Ocultismo',
      desc:'Você percebe, sem tentar, a presença de rituais e auras paranormais a até 9 m, e a voz d’ELE sussurra o que cada um é. Você recebe +5 em Ocultismo.'},
    vias:{A:{nome:'Via da Mente', lema:'Pensar já é agir.'}, B:{nome:'Via do Saber', lema:'Nenhuma porta resiste a quem leu a chave.'}},
    nos:[
      {id:'conhecimento-A2', grau:2, via:'A', nome:'Voz Interior', uso:'passiva', desc:'Você se comunica por telepatia com seres que conheça a até 18 m, sem precisar de idioma em comum.'},
      {id:'conhecimento-A3a', grau:3, via:'A', nome:'Pensamento Emprestado', uso:'cena', custo:'2 PE', desc:'Ação padrão. Um ser em alcance curto faz Vontade (DT de rituais). Se falhar, você lê o que ele pensa agora e ele responde com sinceridade a 1 pergunta.'},
      {id:'conhecimento-A3b', grau:3, via:'A', nome:'Muralha Mental', uso:'passiva', desc:'Você recebe +5 em Vontade contra efeitos mentais, e ninguém lê seus pensamentos sem o seu consentimento.'},
      {id:'conhecimento-A4', grau:4, via:'A', nome:'Mente Aberta', uso:'sessao', custo:'5 PE', desc:'Ação padrão. Seres à sua escolha a até 9 m fazem Vontade (DT de rituais) ou ficam atordoados por 1 rodada; você vasculha as memórias recentes de um deles e o Mestre responde 3 perguntas.'},
      {id:'conhecimento-B2', grau:2, via:'B', nome:'Já Vi Isso', uso:'cena', desc:'Ação livre. Refaça um teste de perícia baseada em Mente e fique com o melhor resultado.'},
      {id:'conhecimento-B3a', grau:3, via:'B', nome:'Previsão', uso:'cena', custo:'2 PE', desc:'Reação. Quando for alvo de um ataque, force o atacante a rolar o ataque duas vezes e usar o pior resultado.'},
      {id:'conhecimento-B3b', grau:3, via:'B', nome:'Biblioteca Interior', uso:'passiva', desc:'Você é treinado em todas as perícias baseadas em Mente; nas que já era treinado, recebe +2.'},
      {id:'conhecimento-B4', grau:4, via:'B', nome:'Saber Tudo', uso:'sessao', custo:'5 PE', desc:'Ação padrão. Faça até 3 perguntas ao Mestre sobre a cena, o local ou uma criatura presente; ele responde com verdades. Você perde 1d6 de Sanidade por pergunta — saber demais tem preço.'},
    ],
    textos:{
      2:['A voz agora fala em frases inteiras.','Você entende antes que terminem de dizer.','A Corrente dourada abre as primeiras portas.'],
      3:['Mais uma porta. E mais outra. E outra.','No Abismo, saber é descer.','ELE sussurra um segredo — e o segredo conhece você.'],
      4:['Não resta pergunta que o silêncio não responda.','Resta apenas decidir o que esquecer.','A Coroa de luz pesa tudo o que você já soube.'],
    },
  },
  medo:{
    marca:{nome:'Aura Pavorosa', uso:'passiva',
      resumo:'Aura de terror (DT 12 para adjacentes) • enigmas de Medo se revelam',
      desc:'O Medo recua diante de você — e quem está perto sente o que ele deixou para trás. Seres adjacentes a você que não sejam aliados fazem Vontade (DT 12) no início do turno deles ou ficam abalados até o fim do turno. Você também percebe, sem tentar, quando um enigma, selo ou armadilha de Medo está por perto, e o Mestre diz a você o que ele é.'},
    vias:{A:{nome:'Via do Pavor', lema:'Quem teme, obedece.'}, B:{nome:'Via do Enigma', lema:'Todo terror esconde uma resposta.'}},
    nos:[
      {id:'medo-A2', grau:2, via:'A', nome:'Olhar Aterrador', uso:'rodada', desc:'Uma vez por rodada, quando você causa dano a um ser abalado ou apavorado, ele sofre 1d6 de dano mental adicional (Vontade, DT de rituais, reduz à metade).'},
      {id:'medo-A3a', grau:3, via:'A', nome:'Presença Sufocante', uso:'cena', custo:'2 PE', desc:'Ação padrão. Todos os inimigos a até 9 m fazem Vontade (DT de rituais) ou ficam apavorados por 1d4 rodadas.'},
      {id:'medo-A3b', grau:3, via:'A', nome:'Banquete de Terror', uso:'rodada', desc:'Uma vez por rodada, quando um ser a até 9 m fica abalado ou apavorado por um efeito seu, você recupera 1d4 PE.'},
      {id:'medo-A4', grau:4, via:'A', nome:'Rei do Pesadelo', uso:'sessao', custo:'5 PE', desc:'Ação padrão. Até o fim da cena, a aura da Marca passa para DT de rituais e alcança 9 m. Inimigos que falharem ficam apavorados por 1 rodada; ao fim da cena você fica abalado.'},
      {id:'medo-B2', grau:2, via:'B', nome:'Olho do Enigma', uso:'cena', custo:'1 PE', desc:'Ação de movimento. Examine um objeto, símbolo ou local: o Mestre revela uma pista verdadeira sobre ele e você recebe +5 em Ocultismo e Investigação para decifrá-lo.'},
      {id:'medo-B3a', grau:3, via:'B', nome:'Véu da Névoa', uso:'cena', custo:'2 PE', desc:'Ação padrão. Uma névoa cobre você e seus aliados a até 6 m até o fim da cena: +5 em Furtividade e camuflagem contra quem estiver a mais de 3 m.'},
      {id:'medo-B3b', grau:3, via:'B', nome:'Mente Calejada', uso:'passiva', desc:'Você recebe +5 em Vontade contra Medo e efeitos mentais, e perde 1 de Sanidade a menos (mínimo 1) sempre que a perderia por criaturas ou rituais de Medo.'},
      {id:'medo-B4', grau:4, via:'B', nome:'Resposta do Outro Lado', uso:'sessao', custo:'5 PE', desc:'Ação padrão. Faça até 2 perguntas ao Mestre sobre um enigma, ritual ou criatura de Medo presente; ele responde com verdades. Você fica abalado até o fim da cena.'},
    ],
    textos:{
      2:['O medo já não corre de você.','Ele senta ao seu lado, e espera.','A Corrente azul abre o primeiro olho.'],
      3:['O escuro deixa de ser ausência. Vira presença.','No Abismo, até o terror pede licença.','ELE ri baixo — e a risada sabe o seu nome.'],
      4:['Não há pesadelo que você não reconheça.','Só os que ainda não aprenderam a se ajoelhar.','A Coroa de névoa é fria. E obedece.'],
    },
  },
};

/* o texto curto da Marca alimenta o bonus_desc usado por morte.js e pelos painéis antigos */
(function sincronizarBonus(){
  if(typeof TRANSCENDENCIA_ELEMENTOS === 'undefined') return;
  Object.keys(ARV).forEach(id => { if(TRANSCENDENCIA_ELEMENTOS[id]) TRANSCENDENCIA_ELEMENTOS[id].bonus_desc = ARV[id].marca.resumo; });
})();


/* ───────────── utilidades ───────────── */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const oficiais = () => (typeof _RITUAIS_OFICIAIS === 'function' ? _RITUAIS_OFICIAIS() : (typeof RITUAIS_DB !== 'undefined' ? RITUAIS_DB.filter(r => !r._custom) : []));
const elementos = () => Object.keys(ARV);
const elemInfo = id => (typeof TRANSCENDENCIA_ELEMENTOS !== 'undefined' && TRANSCENDENCIA_ELEMENTOS[id]) || null;
const grauInfo = n => GRAUS[clamp(parseInt(n, 10) || 1, 1, 4) - 1];
const todosNos = id => (ARV[id] ? ARV[id].nos : []);
function no(id){
  const e = String(id || '').split('-')[0];
  return todosNos(e).find(n => n.id === id) || null;
}
const nomeDe = id => (elemInfo(id) && elemInfo(id).nome) || id;
const copia = o => JSON.parse(JSON.stringify(o));
const LOG_MAX = 60;
const idAfinidade = e => e + '-afinidade';

/* ───────────── estado / migração ───────────── */
/* Ler o estado NUNCA grava um c.trans vazio na ficha: quem só olha (o painel do Mestre, por
   exemplo) enviaria esse vazio ao salvar e apagaria a trilha do agente na sincronização. */
const vazio = () => ({v:2, rev:0, trilhas:{}, usos:{}, log:[]});
const nTrilhas = t => (t && t.v === 2 && t.trilhas && typeof t.trilhas === 'object') ? Object.keys(t.trilhas).length : 0;
function progresso(t){
  if(!nTrilhas(t)) return 0;
  return Object.keys(t.trilhas).reduce((s, k) => s + 10 * (t.trilhas[k].grau || 1) + (t.trilhas[k].dadivas || []).length, 0) + ((t.log || []).length);
}
/* "versão" de uma ficha para a sincronização: o rev manda; o progresso só desempata fichas antigas (sem rev).
   Vale também para um c.trans sem trilhas (ex.: depois de o Mestre desfazer a única passagem). */
function versao(c){
  const t = c && c.trans;
  if(!t || t.v !== 2) return 0;
  return (parseInt(t.rev, 10) || 0) * 1e6 + Math.min(progresso(t), 999999);
}
/* espelho de segurança: se a ficha chegar com o trans apagado, ele é restaurado daqui */
function espelhar(c){ if(nTrilhas(c.trans)) c.transBackup = copia(c.trans); else delete c.transBackup; }
/* toda mudança passa por aqui: sobe o rev, espelha */
function mutar(c, t){
  t.rev = (parseInt(t.rev, 10) || 0) + 1; t.ts = Date.now();
  if(t.log.length > LOG_MAX) t.log.splice(0, t.log.length - LOG_MAX);
  c.trans = t; espelhar(c);
}
function migrar(c){
  const t = vazio();
  const leg = c.transcendencia;
  if(c.trans && c.trans.v === 2) t.rev = parseInt(c.trans.rev, 10) || 0;
  if(leg && leg.elemento && ARV[leg.elemento]){
    const hist = (c.transcendenciaHistorico || []).filter(h => h && !h.forcada);
    const rits = oficiais();
    (leg.anteriores || []).forEach(a => { if(ARV[a] && !t.trilhas[a]) t.trilhas[a] = {grau:4, via:null, dadivas:[], segredos:[], ts:leg.dataHora || null, legado:true}; });
    const nome = nomeDe(leg.elemento);
    const doElem = hist.filter(h => { const r = rits.find(x => x.nome === h.ritual); return r && r.elem === nome; });
    const comGrau = doElem.filter(h => h.grau).map(h => h.grau);
    /* histórico novo guarda o grau de cada segredo; o antigo era 1 segredo por grau */
    const grau = comGrau.length ? Math.max.apply(null, comGrau) : 1 + doElem.length;
    t.trilhas[leg.elemento] = {grau:clamp(grau, 1, 4), via:null, dadivas:[], segredos:hist.map(h => h.ritual), ts:leg.dataHora || null, legado:true};
  }
  c.trans = t;
  return t;
}
function normalizar(t){
  if(!t.usos || typeof t.usos !== 'object') t.usos = {};
  if(!Array.isArray(t.log)) t.log = [];
  Object.keys(t.trilhas).forEach(k => {          /* tolera fichas com trilhas incompletas ou adulteradas */
    const tr = t.trilhas[k] && typeof t.trilhas[k] === 'object' ? t.trilhas[k] : (t.trilhas[k] = {});
    tr.grau = clamp(parseInt(tr.grau, 10) || 1, 1, 4);
    tr.dadivas = (Array.isArray(tr.dadivas) ? tr.dadivas : []).filter((id, i, a) => no(id) && id.split('-')[0] === k && a.indexOf(id) === i);
    if(tr.dadivas.length + 1 > tr.grau) tr.grau = clamp(tr.dadivas.length + 1, 1, 4);
    if(!Array.isArray(tr.segredos)) tr.segredos = [];
    if(tr.via === undefined) tr.via = null;
  });
  return t;
}
function estado(c){
  let t = c.trans;
  if(!nTrilhas(t)){
    if(nTrilhas(c.transBackup)){ c.trans = copia(c.transBackup); t = c.trans; }                                   /* restaura do espelho */
    else if(c.transcendencia && c.transcendencia.elemento && ARV[c.transcendencia.elemento]) t = migrar(c);      /* ficha legada ou trilha perdida */
    else return vazio();                                                                                          /* nada a gravar */
  }
  return normalizar(t);
}
const trilha = (c, e) => estado(c).trilhas[e] || null;
const ativa = c => { const t = estado(c); const a = c.transcendencia && c.transcendencia.elemento; return (a && t.trilhas[a] && ARV[a]) ? a : (Object.keys(t.trilhas).filter(k => ARV[k])[0] || null); };
const temTrilha = c => Object.keys(estado(c).trilhas).length > 0;
const dadivasPendentes = (c, e) => { const tr = trilha(c, e); return tr ? Math.max(0, (tr.grau - 1) - tr.dadivas.length) : 0; };
const viaDe = tr => { const n = tr && tr.dadivas[0] && no(tr.dadivas[0]); return n ? n.via : null; };

/* próximo grau de dádiva a escolher (acerto) em um elemento */
function proximaDadivaGrau(c, e){ const tr = trilha(c, e); return tr ? tr.dadivas.length + 2 : 2; }
function opcoesDadiva(c, e, grau){
  const tr = trilha(c, e), via = viaDe(tr);
  return todosNos(e).filter(n => n.grau === grau && (grau === 2 || !via || n.via === via));
}
function segredosDisponiveis(c, e, grau, excluir){
  const nome = nomeDe(e), ap = c.rituaisAprendidos || {}, ex = excluir || [];
  return oficiais().filter(r => r.elem === nome && r.circ <= grau && !ap[r.nome] && ex.indexOf(r.nome) < 0);
}
/* quantos segredos uma Passagem de determinado grau entrega agora (limitado pelo que ainda existe para aprender) */
const segredosDaPassagem = (c, e, grau) => Math.min(SEGREDOS_POR_GRAU, segredosDisponiveis(c, e, grau).length);
function segredosValidos(c, e, grau, lista){
  const disp = segredosDisponiveis(c, e, grau).map(r => r.nome);
  return lista.length === segredosDaPassagem(c, e, grau) && lista.every((n, i) => disp.indexOf(n) >= 0 && lista.indexOf(n) === i);
}

/* o que a próxima Passagem faz */
function proximaPassagem(c){
  const t = estado(c);
  const ids = Object.keys(t.trilhas).filter(k => ARV[k]);
  for(let i = 0; i < ids.length; i++) if(dadivasPendentes(c, ids[i])) return {fase:'acerto', elem:ids[i]};
  if(!ids.length) return {fase:'elemento'};
  const a = ativa(c), tr = t.trilhas[a];
  if(tr.grau < 4) return {fase:'subir', elem:a, grau:tr.grau + 1};
  const livres = elementos().filter(e => !t.trilhas[e]);
  return livres.length ? {fase:'nova', livres} : {fase:'completo'};
}

/* ───────────── aplicar ───────────── */
function aprender(c, nome){ if(!c.rituaisAprendidos) c.rituaisAprendidos = {}; const ja = !!c.rituaisAprendidos[nome]; c.rituaisAprendidos[nome] = true; return ja; }
function aplicarElemento(c, e){
  const P = proximaPassagem(c);
  if(!ARV[e] || (P.fase !== 'elemento' && P.fase !== 'nova') || (P.livres && P.livres.indexOf(e) < 0)) return false;
  const t = estado(c), ed = elemInfo(e), agora = new Date().toISOString();
  if(t.trilhas[e]) return false;
  const antes = c.transcendencia ? copia(c.transcendencia) : null;
  let jaTinha = true;
  if(ed && ed.ritual_gratis) jaTinha = aprender(c, ed.ritual_gratis);
  const ant = c.transcendencia && c.transcendencia.elemento;
  const anteriores = ((c.transcendencia && c.transcendencia.anteriores) || []).concat(ant && ant !== e ? [ant] : []);
  c.transcendencia = {elemento:e, nome:nomeDe(e), dataHora:agora, ritual_gratis:ed ? ed.ritual_gratis : null, anteriores};
  t.trilhas[e] = {grau:1, via:null, dadivas:[], segredos:ed && ed.ritual_gratis ? [ed.ritual_gratis] : [], ts:agora};
  t.log.push({t:'elem', elem:e, grau:1, ts:agora, jaTinha, antes});
  mutar(c, t);
  return true;
}
function aplicarSubida(c, e, dadivaId, rituais){
  rituais = (Array.isArray(rituais) ? rituais : [rituais]).filter(Boolean);
  const P = proximaPassagem(c);
  if(P.fase !== 'subir' || P.elem !== e) return false;
  const t = estado(c), tr = t.trilhas[e], agora = new Date().toISOString();
  const grau = P.grau, n = no(dadivaId);
  if(!n || n.grau !== grau || !opcoesDadiva(c, e, grau).some(x => x.id === dadivaId)) return false;
  if(!segredosValidos(c, e, grau, rituais)) return false;
  tr.grau = grau; tr.dadivas.push(dadivaId);
  rituais.forEach(ritual => { aprender(c, ritual); tr.segredos.push(ritual); if(!c.transcendenciaHistorico) c.transcendenciaHistorico = []; c.transcendenciaHistorico.push({ritual, ts:agora, grau}); });
  t.log.push({t:'subir', elem:e, grau, dadiva:dadivaId, segredos:rituais, segredo:rituais[0] || null, ts:agora});
  mutar(c, t);
  return true;
}
function aplicarAcerto(c, e, dadivaId){
  const P = proximaPassagem(c);
  if(P.fase !== 'acerto' || P.elem !== e) return false;
  const t = estado(c), tr = t.trilhas[e], agora = new Date().toISOString();
  const n = no(dadivaId);
  if(!tr || !n || n.grau !== proximaDadivaGrau(c, e) || !opcoesDadiva(c, e, n.grau).some(x => x.id === dadivaId)) return false;
  tr.dadivas.push(dadivaId);
  t.log.push({t:'acerto', elem:e, grau:n.grau, dadiva:dadivaId, ts:agora});
  mutar(c, t);
  return true;
}
/* desfaz a última passagem (Mestre) */
function desfazer(c){
  if(!temTrilha(c)) return null;
  const t = estado(c), l = t.log.pop();
  if(!l){ return null; }
  const tr = t.trilhas[l.elem];
  if(l.t === 'elem'){
    delete t.trilhas[l.elem]; delete t.usos[idAfinidade(l.elem)];
    const ed = elemInfo(l.elem);
    if(ed && ed.ritual_gratis && !l.jaTinha && c.rituaisAprendidos) delete c.rituaisAprendidos[ed.ritual_gratis];
    if(l.antes) c.transcendencia = l.antes; else delete c.transcendencia;
  }else if(tr){
    const id = tr.dadivas.pop(); if(id) delete t.usos[id];
    if(l.t === 'subir'){
      tr.grau = Math.max(1, tr.grau - 1);
      (l.segredos || (l.segredo ? [l.segredo] : [])).forEach(sg => {
        tr.segredos = tr.segredos.filter(s => s !== sg);
        if(c.rituaisAprendidos) delete c.rituaisAprendidos[sg];
        if(c.transcendenciaHistorico){ const i = c.transcendenciaHistorico.map(h => h && h.ritual).lastIndexOf(sg); if(i >= 0) c.transcendenciaHistorico.splice(i, 1); }
      });
    }
  }
  mutar(c, t);          /* mantém c.trans (mesmo sem trilhas) com rev maior: a sincronização aceita o desfazer */
  return l;
}

/* ───────────── lista de poderes ativos da ficha ───────────── */
function poderes(c){
  const t = estado(c), out = [];
  Object.keys(t.trilhas).forEach(e => {
    const tr = t.trilhas[e]; if(!ARV[e]) return;
    const ed = elemInfo(e);
    out.push({elem:e, tipo:'marca', id:e + '-marca', grau:1, nome:ARV[e].marca.nome, uso:'passiva', desc:ARV[e].marca.desc});
    if(ed && ed.ritual_gratis) out.push({elem:e, tipo:'afinidade', id:idAfinidade(e), grau:1, nome:'Afinidade — ' + ed.ritual_gratis, uso:'sessao', custo:'0 PE',
      desc:'Conjure ' + ed.ritual_gratis + ' sem gastar PE, uma vez por sessão. O ritual também fica no seu grimório, com custo normal.', ritual:ed.ritual_gratis});
    tr.dadivas.forEach(id => { const n = no(id); if(n) out.push(Object.assign({elem:e, tipo:'dadiva'}, n)); });
  });
  return out;
}
const poderPorId = (c, id) => poderes(c).find(p => p.id === id) || null;

/* ───────────── usos (cena / sessão) ───────────── */
const usavel = n => !!n && (n.uso === 'cena' || n.uso === 'sessao');
function alternarUso(c, id){
  const p = poderPorId(c, id); if(!p || !usavel(p)) return null;
  const t = estado(c);
  if(t.usos[id]) delete t.usos[id]; else t.usos[id] = true;
  mutar(c, t);
  return !!t.usos[id];
}
function restaurar(c, quais){
  const t = estado(c);
  if(!Object.keys(t.usos).length) return;
  Object.keys(t.usos).forEach(id => { const p = poderPorId(c, id); if(!p || quais === 'tudo' || (quais === 'cena' && p.uso === 'cena')) delete t.usos[id]; });
  mutar(c, t);
}

/* ───────────── narração ───────────── */
function linhasIntro(fase, p){
  if(fase === 'subir'){
    return ({
      2:['A Marca em você pulsa.', 'ELE chama de novo.', 'Mais fundo, desta vez.'],
      3:['Você já não sente a membrana.', 'Sente o que existe atrás dela.', 'O Abismo se abre — e ele sabe o seu nome.'],
      4:['Só resta uma porta.', 'O Rei Carmesim espera do outro lado — sem máscara.', 'Quem passa por ela não volta como entrou.'],
    })[p.grau];
  }
  if(fase === 'nova') return [`Você percorreu a Coroa de ${p.nomeAnterior}.`, 'Mas o Outro Lado não tem fundo.', 'ELE abre outra faceta da membrana…'];
  return ['A membrana entre mundos…', '…é mais fina do que você imaginava.', 'Você sempre sentiu. Aquele peso. Aquela presença.', 'ELE está do outro lado.', 'O Rei Carmesim. O Senhor do Outro Lado.', 'ELE sabe o seu nome. ELE sempre soube.', 'E agora… ELE está chamando por você.'];
}

window.TransArvore = {
  GRAUS, USO, ARV, SEGREDOS_POR_GRAU, elementos, elemInfo, grauInfo, no, todosNos, nomeDe,
  estado, espelhar, progresso, versao, trilha, ativa, temTrilha, viaDe, dadivasPendentes, proximaDadivaGrau, opcoesDadiva,
  segredosDisponiveis, segredosDaPassagem, proximaPassagem,
  aplicarElemento, aplicarSubida, aplicarAcerto, desfazer, usavel, alternarUso, restaurar, poderes, poderPorId, idAfinidade, linhasIntro,
};
})();
