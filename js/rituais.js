const appRituais = {};
/* ══════════════════════════════════════════════
   RITUAIS
══════════════════════════════════════════════ */
const ELEM_COR = {Sangue:'#cc1111',Morte:'#555566',Energia:'#9933cc',Conhecimento:'#c8a000',Medo:'#1155aa'};
const ELEM_ICO = {
  Sangue:'<span class="sym-el sym-sangue" style="display:inline-block;width:36px;height:36px;vertical-align:middle;background-size:85%;background-repeat:no-repeat;background-position:center;mix-blend-mode:screen;filter:brightness(1.2)" title="Sangue"></span>',
  Morte:'<span class="sym-el sym-morte" style="display:inline-block;width:36px;height:36px;vertical-align:middle;background-size:85%;background-repeat:no-repeat;background-position:center;mix-blend-mode:screen;filter:brightness(1.2)" title="Morte"></span>',
  Energia:'<span class="sym-el sym-energia" style="display:inline-block;width:36px;height:36px;vertical-align:middle;background-size:85%;background-repeat:no-repeat;background-position:center;mix-blend-mode:screen;filter:brightness(1.2)" title="Energia"></span>',
  Conhecimento:'<span class="sym-el sym-conhecimento" style="display:inline-block;width:36px;height:36px;vertical-align:middle;background-size:65%;background-repeat:no-repeat;background-position:center;mix-blend-mode:screen;filter:brightness(1.2)" title="Conhecimento"></span>',
  Medo:'<span class="sym-el sym-medo" style="display:inline-block;width:36px;height:36px;vertical-align:middle;background-size:75%;background-repeat:no-repeat;background-position:center;mix-blend-mode:screen;filter:brightness(1.2)" title="Medo"></span>'
};
const RITUAIS_DB = [
  // ══════════════════ 1º CÍRCULO ══════════════════
  // ── Sangue ──
  {nome:'Armadura de Sangue',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Seu sangue escorre para fora do corpo, cobrindo-o sob a forma de uma carapaça que fornece +5 em Defesa. Bônus cumulativo com outros rituais, mas não com bônus de equipamentos.',disc:'(+5 PE, 3º círculo) Muda o efeito para +10 na Defesa e resistência balística, corte, impacto e perfuração 5.',verd:'(+9 PE, 4º círculo, afinidade) +15 na Defesa e resistência balística, corte, impacto e perfuração 10.'},
  {nome:'Arma Atroz',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 arma corpo a corpo',dur:'Sustentada',resist:'—',pe:2,efeito:'A arma é recoberta por veias carmesim e exala aura de violência. Fornece +2 em testes de ataque e +1 na margem de ameaça.',disc:'(+2 PE, 2º círculo) Muda o bônus para +5 em testes de ataque.',verd:'(+5 PE, 3º círculo, afinidade) Muda o bônus para +2 na margem de ameaça e no multiplicador de crítico.'},
  {nome:'Corpo Adaptado',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 pessoa ou animal',dur:'Cena',resist:'—',pe:2,efeito:'Modifica a biologia do alvo para sobreviver em ambientes hostis. Fica imune a calor e frio extremo, pode respirar na água (ou ar) e não sufoca em fumaça densa.',disc:'(+2 PE, 2º círculo) Muda a duração para 1 dia.',verd:'(+5 PE) Muda o alcance para Curto e o alvo para pessoas ou animais escolhidos.'},
  {nome:'Fortalecimento Sensorial',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Potencializa os sentidos: +1d20 em Investigação, Luta, Percepção e Pontaria.',disc:'(+2 PE, 2º círculo) Além do normal, seus inimigos sofrem –1d20 em testes de ataque contra você.',verd:'(+5 PE, 4º círculo, afinidade) Imune às condições Surpreso e Desprevenido; +10 em Defesa e Reflexos.'},
  {nome:'Ódio Incontrolável',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 pessoa',dur:'Cena',resist:'—',pe:2,efeito:'O alvo entra em frenesi: +2 em testes de ataque e dano corpo a corpo, resistência a balístico/corte/impacto/perfuração 5. Não pode usar Furtividade nem rituais; deve atacar sempre que puder.',disc:'(+2 PE, 2º círculo) Além do normal, ao usar ação Agredir pode fazer um ataque corpo a corpo adicional contra o mesmo alvo.',verd:'(+5 PE, 3º círculo, afinidade) Bônus sobe para +5 em ataque e dano; o alvo sofre apenas metade de dano de corte, impacto, balístico e perfuração.'},
  {nome:'Vidência',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Longo (visão)',alvo:'1 local ou alvo',dur:'Cena',resist:'—',pe:2,efeito:'Permite observar e ouvir um local ou alvo à distância, desde que você o conheça ou tenha um objeto ligado a ele.',disc:'(+2 PE, 2º círculo) Pode mover o ponto de visão pelo local.',verd:'(+5 PE, 3º círculo, afinidade) Também pode interagir telepaticamente com quem está no local.'},
  {nome:'Perfurar Pele',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude parcial',pe:2,efeito:'Sigilos de sangue perfuram a pele do alvo de dentro para fora: 2d6+2 de dano de Sangue. Se falhar, o alvo sangra (–1 PV por rodada até receber cuidados).',disc:'(+2 PE, 2º círculo) Dano sobe para 4d6+4 e o sangramento é –2 PV por rodada.',verd:'(+5 PE, 3º círculo, afinidade) Dano 6d6+6; o alvo sangra independente da resistência.'},
  {nome:'Distorcer Aparência',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'Vontade (desacredita)',pe:2,efeito:'Altera sua aparência física para se passar por outra pessoa, ajustando altura, peso, cor de pele, cabelo, voz e até impressão digital.',disc:'(+2 PE, 2º círculo) Duração aumenta para 1 dia.',verd:'(+5 PE, 3º círculo) Pode copiar a aparência de uma pessoa que você conhece ou tenha visto recentemente com precisão total.'},
  // ── Morte ──
  {nome:'Cicatrização',elem:'Morte',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Instantânea',resist:'—',pe:2,efeito:'Acelera o tempo ao redor das feridas. O alvo recupera 3d8+3 PV, mas envelhece 1 ano automaticamente.',disc:'(+2 PE, 2º círculo) Aumenta a cura para 5d8+5 PV.',verd:'(+9 PE, 4º círculo, afinidade) Muda o alcance para Curto, o alvo para seres escolhidos e a cura para 7d8+7 PV.'},
  {nome:'Decadência',elem:'Morte',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude (reduz à metade)',pe:2,efeito:'Espirais de trevas envolvem sua mão e definhám o alvo: 2d8+2 de dano de Morte.',disc:'(+2 PE, 2º círculo) Muda a resistência para nenhuma e o dano para 3d8+3. Como parte da execução, transfere as espirais para uma arma e faz ataque corpo a corpo — se acertar, causa dano da arma + ritual somados.',verd:'(+5 PE, 3º círculo) Muda o alcance para pessoal, alvo para área: explosão com 6m de raio e dano para 8d8+8.'},
  {nome:'Definhar',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:2,efeito:'Lufada de cinzas drena as forças do alvo. O alvo fica Fatigado. Se passar na resistência, fica Vulnerável em vez disso.',disc:'(+2 PE, 2º círculo) Em vez do normal, o alvo fica Exausto. Se passar na resistência, fica Fatigado.',verd:'(+5 PE, 3º círculo, afinidade) Como discente, mas muda o alvo para até 5 seres.'},
  {nome:'Espirais da Perdição',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'—',pe:2,efeito:'Espirais surgem no corpo do alvo, tornando seus movimentos lentos. O alvo sofre –1d20 em testes de ataque.',disc:'(+2 PE, 2º círculo) Muda a penalidade para –2d20.',verd:'(+5 PE, 3º círculo, afinidade) Muda a penalidade para –2d20 e o alvo para seres escolhidos.'},
  {nome:'Nuvem de Cinzas',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'Nuvem 6m de raio, 6m de altura',dur:'Cena',resist:'—',pe:2,efeito:'Nuvem de fuligem espessa obscurece a visão. Seres a até 1,5m têm camuflagem; seres a partir de 3m têm camuflagem total. Vento forte dispersa em 4 rodadas; vendaval em 1.',disc:'(+2 PE, 2º círculo) Você pode escolher seres ao conjurar; eles enxergam através do efeito.',verd:'(+5 PE, 3º círculo, afinidade) A nuvem fica espessa e quase sólida. Qualquer ser dentro tem deslocamento reduzido a 3m e sofre –2 em testes de ataque.'},
  {nome:'Lentidão Concentrada',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:2,efeito:'Fluxo de entropia desacelera o alvo. O alvo fica com deslocamento reduzido à metade e sofre –2 em Reflexos. Se passar na resistência, apenas –1 em Reflexos.',disc:'(+2 PE, 2º círculo) O alvo também sofre –1d20 em testes de ataque.',verd:'(+5 PE, 3º círculo) Muda o alvo para até 3 seres; efeito completo sem resistência.'},
  {nome:'Garras do Abismo',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Reflexos parcial',pe:2,efeito:'Mãos esqueléticas surgem do chão e tentam prender o alvo: o alvo fica Imobilizado. Se passar na resistência, apenas Lento por 1 rodada.',disc:'(+2 PE, 2º círculo) As garras causam também 2d6 de dano de Morte por rodada que o alvo permanecer Imobilizado.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para área: explosão de 6m de raio; afeta todos os seres na área.'},
  // ── Energia ──
  {nome:'Amaldiçoar Tecnologia',elem:'Energia',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 acessório ou arma de fogo',dur:'Cena',resist:'—',pe:2,efeito:'Infunde o objeto com energia caótica. Armas de fogo têm munição amaldiçoada — causam dano adicional ao atirador em vez do alvo. Acessórios eletrônicos passam a funcionar de forma errática e prejudicial.',disc:'(+2 PE, 2º círculo) O objeto passa a causar dano direto a quem o empunhar a cada uso.',verd:'(+5 PE, 3º círculo, afinidade) O objeto explode no próximo uso, causando 4d6 de dano de Energia em área de 3m de raio.'},
  {nome:'Coincidência Forçada',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'—',pe:2,efeito:'Manipula os caminhos do caos para que o alvo tenha mais sorte: +2 em testes de perícias.',disc:'(+2 PE, 2º círculo) Muda o alvo para aliados à sua escolha.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para aliados à sua escolha e o bônus para +5.'},
  {nome:'Eletrocussão',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser ou objeto',dur:'Instantânea',resist:'Fortitude parcial',pe:2,efeito:'Dispara corrente elétrica: 3d6 de dano de Energia e o alvo fica Vulnerável por 1 rodada. Se passar: metade do dano sem condição. Contra objetos eletrônicos: dobro de dano, ignora resistência.',disc:'(+2 PE, 2º círculo) Muda o alvo para área: linha de 30m. Raio causa 6d6 de dano de Energia em todos os seres e objetos livres na área.',verd:'(+5 PE, 3º círculo, afinidade) Muda a área para alvos escolhidos; dispara vários relâmpagos, um por alvo, causando 8d6 de Energia cada.'},
  {nome:'Embaralhar',elem:'Energia',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Cria 3 cópias ilusórias suas — hologramas realistas que imitam suas ações. Você recebe +6 na Defesa. A cada ataque errado, uma cópia desaparece e o bônus cai em 2.',disc:'(+2 PE, 2º círculo) Muda o número de cópias para 5 (bônus na Defesa +10).',verd:'(+5 PE, 3º círculo, afinidade) 8 cópias (+16 na Defesa). Toda vez que uma cópia é destruída, emite clarão — o atacante fica Ofuscado por 1 rodada.'},
  {nome:'Maré de Azar',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:2,efeito:'Um azar paranormal atinge o alvo: –2 em todos os seus testes. Se passar na resistência, apenas –1.',disc:'(+2 PE, 2º círculo) Muda a penalidade para –5 (resistência: –2).',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para todos os seres hostis em alcance curto; penalidade –5.'},
  {nome:'Barreira Energética',elem:'Energia',circ:1,exec:'Reação',alcance:'Curto',alvo:'Você e aliados escolhidos',dur:'1 rodada',resist:'—',pe:2,efeito:'Cria uma parede invisível de energia que bloqueia ataques. Você e os aliados escolhidos recebem resistência 10 contra o próximo ataque físico.',disc:'(+2 PE, 2º círculo) A resistência aumenta para 15 e dura até o início do seu próximo turno.',verd:'(+5 PE, 3º círculo, afinidade) Resistência 20; qualquer ataque bloqueado pela barreira causa 2d6 de dano de Energia de volta ao atacante.'},
  {nome:'Tela de Ruído',elem:'Energia',circ:1,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:2,efeito:'Cria uma película de energia ao redor do corpo que absorve energia cinética. Recebe 30 PV temporários, mas apenas contra dano balístico, corte, impacto ou perfuração. Pode ser usado como reação ao sofrer dano: recebe resistência 15 apenas contra aquele dano.',disc:'(+2 PE) PV temporários aumentam para 45.',verd:'(+5 PE, 3º círculo, afinidade) PV temporários 60; dura toda a cena.'},
  {nome:'Forma Fantasmagórica',elem:'Energia',circ:1,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'1 rodada',resist:'—',pe:2,efeito:'Seu corpo se torna temporariamente imaterial. Você passa a ignorar obstáculos físicos, atravessa paredes e é imune a dano físico (mas não paranormal) por 1 rodada. Pode levar 1 aliado consigo se tocá-lo.',disc:'(+2 PE, 2º círculo) A duração aumenta para o dobro de rodadas.',verd:'(+5 PE, 3º círculo) Pode levar todos os aliados em alcance curto e a duração aumenta para a cena toda.'},
  {nome:'Salto Fantasma',elem:'Energia',circ:2,exec:'Movimento',alcance:'Longo',alvo:'Você',dur:'Instantânea',resist:'—',pe:4,efeito:'Seu corpo se transforma em Energia pura e viaja instantaneamente para um ponto que você possa ver dentro do alcance. Você pode levar 1 aliado consigo.',disc:'(+3 PE) Pode alcançar qualquer ponto que você conheça, mesmo que não possa ver.',verd:'(+5 PE, 3º círculo, afinidade) Pode levar todos os aliados em alcance curto; pode ser usado como reação.'},
  // ── Conhecimento ──
  {nome:'Ouvir Sussurros',elem:'Conhecimento',circ:1,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:2,efeito:'Conecta-se com os sussurros — memórias ecoando pelo Outro Lado. Você pode fazer uma pergunta sobre um evento futuro próximo; o Mestre responde com "sim", "não" ou "sim e não".',disc:'(+2 PE, 2º círculo) A pergunta pode ser sobre um evento futuro de até 1 dia.',verd:'(+5 PE, 3º círculo, afinidade) Pode fazer uma pergunta sobre qualquer coisa que o Outro Lado saiba, com resposta direta do Mestre.'},
  {nome:'Enfeitiçar',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade anula',pe:2,efeito:'O alvo percebe suas palavras de forma favorável. Você recebe +10 em testes de Diplomacia com ele. Qualquer ação hostil sua ou de aliados dissipa o efeito.',disc:'(+2 PE, 2º círculo) Em vez do normal, você sugere uma ação ao alvo; ele obedece se parecer aceitável ao Mestre. Ao executar, o efeito termina.',verd:'(+5 PE, 3º círculo, afinidade) Afeta todos os alvos dentro do alcance.'},
  {nome:'Detetizar',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Médio',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Rituais ativos, itens amaldiçoados e criaturas paranormais emitem auras visíveis. Você sabe o elemento e a intensidade (fraca/moderada/poderosa). Como ação de movimento, sabe se um ser em alcance médio tem poderes paranormais.',disc:'(+2 PE, 2º círculo) Duração aumenta para 1 dia.',verd:'(+5 PE, 3º círculo) Você pode enxergar seres e objetos invisíveis como formas translúcidas.'},
  {nome:'Leitura Psíquica',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 objeto',dur:'Instantânea',resist:'—',pe:2,efeito:'Ao tocar um objeto, você recebe flashes de memórias e emoções de quem o manipulou recentemente. O Mestre fornece uma visão vaga sobre o objeto ou seu dono.',disc:'(+2 PE, 2º círculo) As visões são mais claras e detalhadas, incluindo contexto e localização.',verd:'(+5 PE, 3º círculo, afinidade) Pode tocar uma pessoa e ler seus pensamentos superficiais atuais.'},
  {nome:'Eco do Passado',elem:'Conhecimento',circ:1,exec:'Completa',alcance:'Pessoal',alvo:'1 local',dur:'Instantânea',resist:'—',pe:2,efeito:'Você chama memórias traumáticas do local, vendo um evento do passado como um eco espectral. O Mestre descreve uma cena relevante ocorrida no local.',disc:'(+2 PE, 2º círculo) Pode escolher o tipo de evento (violência, ritual, morte, etc.) que quer visualizar.',verd:'(+5 PE, 3º círculo, afinidade) Pode reviver o evento como se estivesse presente — percebendo detalhes e identidades.'},
  {nome:'Chiados Internos',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:2,efeito:'Sons paranormais perturbam a mente do alvo: ele fica Confuso e sofre –2 em todos os testes. Se passar na resistência, apenas Confuso por 1 rodada.',disc:'(+2 PE, 2º círculo) Além do normal, o alvo tem 50% de chance de atingir um aliado aleatório em vez do alvo pretendido.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para até 3 seres; duração cena para todos que falharem.'},
  {nome:'Camuflagem',elem:'Conhecimento',circ:2,exec:'Livre',alcance:'Pessoal',alvo:'Você',dur:'1 rodada',resist:'—',pe:4,efeito:'Você fica invisível (incluindo equipamento), recebe camuflagem total e +15 em testes de Furtividade. O efeito termina se você fizer um ataque ou usar habilidade hostil.',disc:'(+3 PE) Duração aumenta para 3 rodadas.',verd:'(+5 PE, 3º círculo, afinidade) Duração aumenta para a cena; ataques à distância não dissipam o efeito — apenas ataques corpo a corpo.'},
  // ── Medo ──
  {nome:'Cinerária',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'Nuvem 6m de raio',dur:'Cena',resist:'—',pe:2,efeito:'Névoa de essência paranormal carregada: rituais conjurados dentro dela têm DT +5.',disc:'(+2 PE, 2º círculo) Além do normal, rituais conjurados dentro da névoa custam –2 PE.',verd:'(+5 PE, 3º círculo, afinidade) Além do normal, rituais conjurados dentro da névoa causam dano maximizado.'},
  {nome:'Pavor Anormal',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:2,efeito:'Inocula o terror paranormal no alvo: ele fica Abalado e sofre –2 em testes. Se passar na resistência, apenas Abalado por 1 rodada.',disc:'(+2 PE, 2º círculo) Falha: alvo fica Apavorado (cena inteira); sucesso: Abalado.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para todos os seres hostis em alcance curto; falha: Apavorados.'},
  {nome:'Invocar Névoa',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'Área 9m de raio',dur:'Cena',resist:'—',pe:2,efeito:'Uma névoa densa e fantasmagórica emerge, cobrindo a área. Todos dentro têm camuflagem. Seres com Medo alto ficam Abalados ao entrar na névoa.',disc:'(+2 PE, 2º círculo) A névoa pode ser movida pelo conjurador com ação de movimento.',verd:'(+5 PE, 3º círculo) A névoa persiste até o fim da missão e causa 2d6 de dano mental por rodada a quem permanecer dentro.'},
  {nome:'Pronunciar Sigilo',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Instantânea',resist:'Vontade parcial',pe:2,efeito:'Pronuncia um sigilo do Outro Lado que drena a Sanidade do alvo: o alvo perde 1d6 de Sanidade. Se passar na resistência, perde apenas 1d3.',disc:'(+2 PE, 2º círculo) O dano aumenta para 2d6 (resistência: 1d6).',verd:'(+5 PE, 3º círculo, afinidade) Dano 3d8 de Sanidade; o alvo fica Apavorado se falhar (resistência: Abalado).'},
  // ══════════════════ 2º CÍRCULO ══════════════════
  // ── Sangue ──
  {nome:'Invólucro de Carne',elem:'Sangue',circ:2,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:4,efeito:'Cria um clone de carne e sangue com as mesmas estatísticas do usuário. O clone pode conjurar rituais e age no seu turno.',disc:'(+4 PE, 3º círculo) O clone age de forma independente no turno do conjurador.',verd:'(+8 PE, 4º círculo, afinidade) O clone possui PV dobrados e age em turno próprio.'},
  {nome:'Purgatório',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'Cena',resist:'Reflexos parcial',pe:4,efeito:'Área impregnada de sangue paranormal: alvos que entrem ficam Vulneráveis a dano e sofrem 2d6 de dano se tentarem sair. Se passar na resistência, o dano é reduzido à metade.',disc:'(+3 PE, 3º círculo) O dano ao sair aumenta para 4d6 e alvos dentro sofrem –2 em todos os testes.',verd:'(+6 PE, 4º círculo, afinidade) A área dobra; quem entrar ou tentar sair fica Imobilizado (Reflexos evita).'},
  {nome:'Vomitar Pestes',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'2 rodadas',resist:'Fortitude parcial',pe:4,efeito:'Vomita enxame de criaturas parasitas de Sangue. Alvos na área sofrem 3d6 de dano e ficam Perturbados. Resistência: metade do dano, sem condição.',disc:'(+3 PE, 3º círculo) O enxame persiste por mais 2 rodadas.',verd:'(+6 PE, 4º círculo) O enxame cobre área de 12m e o dano dobra.'},
  {nome:'Mergulho Mental',elem:'Sangue',circ:2,exec:'Completa',alcance:'Toque',alvo:'1 ser inconsciente ou consentindo',dur:'Cena',resist:'Vontade anula',pe:4,efeito:'Infiltra-se na mente do alvo para vasculhar pensamentos e memórias recentes (últimas 24h). O Mestre fornece informações relevantes.',disc:'(+3 PE) Pode alterar ou apagar memórias recentes do alvo.',verd:'(+6 PE, 4º círculo, afinidade) Pode implantar memórias falsas detalhadas que o alvo acredita plenamente.'},
  {nome:'Flagelo de Sangue',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:4,efeito:'O sangue do alvo começa a entrar em ebulição por dentro, causando 4d8 de dano de Sangue. Se passar na resistência, o dano é reduzido à metade.',disc:'(+3 PE) Dano aumenta para 6d8.',verd:'(+6 PE, 3º círculo, afinidade) Dano 8d8; o alvo fica Vulnerável por toda a cena, independente da resistência.'},
  // ── Morte ──
  {nome:'Apodrecer',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude parcial',pe:4,efeito:'Acelera o envelhecimento dos órgãos internos: 2d8+2 de dano de Morte.',disc:'(+2 PE) Dano aumenta para 4d8+4.',verd:'(+5 PE, 3º círculo, afinidade) Dano 6d8+6; sem resistência.'},
  {nome:'Zerar Entropia',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:4,efeito:'O alvo fica imobilizado pela entropia. Se falhar: Imobilizado. Se passar: Lento (–1d20 em testes de ataque e Defesa reduzida).',disc:'(+3 PE, 3º círculo) Afeta até 3 seres.',verd:'(+6 PE, 4º círculo, afinidade) O alvo fica Paralisado sem resistência.'},
  {nome:'Poeira da Podridão',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'3 rodadas',resist:'Fortitude parcial',pe:4,efeito:'Nuvem de poeira paranormal que apodrece tudo que toca. Seres na área sofrem 3d6 de dano de Morte por rodada.',disc:'(+3 PE) Dano aumenta para 5d6 por rodada.',verd:'(+6 PE, 3º círculo, afinidade) Duração aumenta para 5 rodadas e dano sobe para 6d6 por rodada.'},
  {nome:'Tentáculos de Lodo',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'Cena',resist:'Reflexos parcial',pe:4,efeito:'Tentáculos negros de podridão brotam do chão, atacando e agarrando seres na área: 2d8 de dano de Morte e ficam Imobilizados. Resistência: apenas dano, sem condição.',disc:'(+3 PE) Os tentáculos também arrastam alvos agarrados para o centro da área.',verd:'(+6 PE, 4º círculo) Os tentáculos também atacam como reação sempre que alguém passar pela área.'},
  {nome:'Possessão',elem:'Morte',circ:2,exec:'Completa',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade anula',pe:4,efeito:'Você projeta sua consciência para o corpo de outra pessoa. Você passa a controlar o alvo completamente enquanto seu próprio corpo fica inconsciente e vulnerável.',disc:'(+3 PE) Pode possuir qualquer ser que você conheça, independente da distância.',verd:'(+6 PE, 3º círculo, afinidade) Pode possuir e controlar até 2 seres ao mesmo tempo.'},
  // ── Energia ──
  {nome:'Explosão Caótica',elem:'Energia',circ:2,exec:'Padrão',alcance:'Médio',alvo:'Área 6m de raio',dur:'Instantânea',resist:'Reflexos parcial',pe:4,efeito:'Explosão de energia caótica: 4d6+4 de dano de Energia. Se passar na resistência, metade do dano.',disc:'(+3 PE, 3º círculo) Dano sobe para 6d8.',verd:'(+6 PE, 3º círculo, afinidade) Dano 8d8; alvos que falharem ficam Atordoados por 1 rodada.'},
  {nome:'Convocação Instantânea',elem:'Energia',circ:2,exec:'Reação',alcance:'Ilimitado',alvo:'1 objeto marcado',dur:'Instantânea',resist:'—',pe:4,efeito:'Teletransporta um objeto previamente marcado para suas mãos, independente da distância.',disc:'(+2 PE) Pode marcar o objeto durante a execução do ritual.',verd:'(+5 PE, 3º círculo) Pode teletransportar qualquer objeto que você possa ver dentro de alcance médio.'},
  {nome:'Esfera do Caos',elem:'Energia',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser ou área 3m de raio',dur:'Instantânea',resist:'Reflexos parcial',pe:4,efeito:'Gera um ataque elemental caótico que alterna entre diferentes elementos aleatoriamente: role 1d6 (1=fogo, 2=gelo, 3=eletricidade, 4=ácido, 5=sônico, 6=escolha) causando 5d6 de dano.',disc:'(+3 PE) Você pode escolher o elemento em vez de rolar aleatoriamente.',verd:'(+6 PE, 3º círculo, afinidade) Dano aumenta para 8d8 e você pode combinar dois elementos.'},
  {nome:'Deflagração de Energia',elem:'Energia',circ:2,exec:'Completa',alcance:'Longo',alvo:'Área 9m de raio',dur:'Instantânea',resist:'Reflexos parcial',pe:4,efeito:'Acumula energia imensa e a libera de uma vez em uma explosão colossal: 6d10 de dano de Energia.',disc:'(+4 PE, 3º círculo) Dano aumenta para 9d10.',verd:'(+8 PE, 4º círculo, afinidade) Dano 12d10; a área dobra e estruturas físicas na área podem ser destruídas.'},
  {nome:'Contenção Fantasmagórica',elem:'Energia',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Reflexos parcial',pe:4,efeito:'Laços de energia translúcida prendem o alvo: ele fica Imobilizado. Se passar na resistência, fica apenas Lento por 2 rodadas.',disc:'(+3 PE) Os laços causam também 2d6 de dano de Energia por rodada.',verd:'(+6 PE, 3º círculo, afinidade) Muda o alvo para até 3 seres em alcance médio.'},
  // ── Conhecimento ──
  {nome:'Aurora da Verdade',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Esfera 3m de raio',dur:'Sustentada',resist:'Vontade parcial',pe:4,efeito:'Luz espectral dourada surge na área. Qualquer ser dentro é obrigado a falar só a verdade, inclusive o conjurador. Se passar na resistência, pode mentir (mas pode ser percebido com Intuição). Seres invisíveis ou em camuflagem dentro da luz são revelados por sigilos brilhantes.',disc:'(+3 PE) Muda o alcance para médio, área para esfera de 9m de raio; o conjurador não é afetado.',verd:'(+7 PE) Como discente, mas alcance longo e duração cena.'},
  {nome:'Aprimorar Mente',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Cena',resist:'—',pe:4,efeito:'A mente do alvo é energizada: +2 em testes de Intelecto, Investigação, Ciências, Tecnologia e Ocultismo.',disc:'(+3 PE) Bônus sobe para +5.',verd:'(+6 PE, 3º círculo, afinidade) Além do normal, concede +2 em número de rituais e +2 na DT dos rituais do alvo.'},
  {nome:'Relembrar Fragmento',elem:'Conhecimento',circ:2,exec:'Completa',alcance:'Toque',alvo:'1 objeto danificado ou corrompido',dur:'Instantânea',resist:'—',pe:4,efeito:'Lê ou recupera informações de documentos, objetos ou mídias danificados ou destruídos.',disc:'(+3 PE) Pode recuperar informações de objetos completamente destruídos.',verd:'(+6 PE, 4º círculo) Pode recuperar memórias de uma pessoa falecida tocando seus restos mortais.'},
  {nome:'Paraíso Maldito',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Vontade anula',pe:4,efeito:'Coloca o alvo em uma ilusão poderosa de realidade alternativa. O alvo fica Incapacitado e completamente alheio ao mundo real.',disc:'(+3 PE) A ilusão dura até o alvo ser fisicamente atacado.',verd:'(+6 PE, 3º círculo) Afeta até 3 alvos ao mesmo tempo.'},
  {nome:'Eco Traumático',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:4,efeito:'Força o alvo a reviver sua maior memória traumática. O alvo perde 2d8 de Sanidade e fica Abalado. Se passar, perde 1d8 de Sanidade.',disc:'(+3 PE) A perda de Sanidade sobe para 3d8 (resistência: 1d8); o alvo fica Apavorado se falhar.',verd:'(+6 PE, 3º círculo, afinidade) O alvo revive o trauma físicamente: recebe dano igual à perda de Sanidade e fica Incapacitado por 1 rodada.'},
  {nome:'Ligação Telepática',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Até 4 seres consentindo',dur:'1 dia',resist:'—',pe:4,efeito:'Cria um elo mental entre os alvos, permitindo comunicação telepática silenciosa a qualquer distância. Como ação de movimento, pode ver/ouvir pelos sentidos de um aliado ligado.',disc:'(+3 PE) Alvos involuntários podem ser incluídos (resistência: Vontade anula); como ação de movimento pode perceber os pensamentos superficiais de qualquer ser ligado.',verd:'(+5 PE, 3º círculo) Conecta até 10 seres; dura a missão inteira.'},
  {nome:'Localização',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:4,efeito:'Você localiza uma pessoa ou objeto que conhece, recebendo direção e distância aproximada se estiver no mesmo plano. Exige uma imagem mental precisa para objetos; falhas ainda consomem PE. Bloqueado por camadas de chumbo.',disc:'(+3 PE) O alvo descobre o caminho mais direto para entrar ou sair de um local (não localiza pessoas).',verd:'(+5 PE, 3º círculo, afinidade) Localiza qualquer ser ou objeto no mesmo plano, mesmo sem imagem mental — apenas o nome ou descrição.'},
  // ── Medo ──
  {nome:'Dissipar Ritual',elem:'Medo',circ:2,exec:'Reação',alcance:'Médio',alvo:'1 ser ou área',dur:'Instantânea',resist:'—',pe:4,efeito:'Cancela os efeitos de um ritual ativo em um alvo ou área. O PE gasto é referente ao custo deste ritual, não do dissipado.',disc:'(+3 PE) Pode dissipar dois rituais simultâneos.',verd:'(+6 PE, 3º círculo, afinidade) Dissipa todos os rituais ativos em uma área de 9m de raio.'},
  {nome:'Selo do Outro Lado',elem:'Medo',circ:2,exec:'Padrão',alcance:'Toque',alvo:'1 local ou objeto',dur:'1 dia',resist:'—',pe:4,efeito:'Cria uma marca paranormal que impede a conjuração de rituais na área ou objeto marcado.',disc:'(+3 PE) A duração aumenta para 1 semana.',verd:'(+6 PE, 3º círculo) Também impede o uso de poderes paranormais na área marcada.'},
  {nome:'Vozes do Vazio',elem:'Medo',circ:2,exec:'Padrão',alcance:'Médio',alvo:'Área 12m de raio',dur:'Cena',resist:'Vontade parcial',pe:4,efeito:'Palavras indecifráveis do Outro Lado confundem os sentidos dos alvos. Se falharem: Abalados e –2 em todos os testes. Se passarem: apenas Abalados.',disc:'(+3 PE, 3º círculo) Falha: Apavorados; sucesso: Abalados.',verd:'(+6 PE, 4º círculo, afinidade) Falha: Apavorados e Atordoados; sucesso: Apavorados.'},
  {nome:'Ilusão',elem:'Medo',circ:2,exec:'Padrão',alcance:'Médio',alvo:'Área 6m de raio',dur:'Sustentada',resist:'Vontade (desacredita)',pe:4,efeito:'Cria uma ilusão visual ou sonora complexa que parece real a todos na área. Seres que interagirem com a ilusão têm direito a um teste de resistência para desacreditarem.',disc:'(+3 PE) A ilusão pode incluir temperatura, cheiro e textura.',verd:'(+6 PE, 3º círculo, afinidade) A ilusão causa dano real (3d6 de dano mental) a quem acreditar nela.'},
  // ══════════════════ 3º CÍRCULO ══════════════════
  // ── Sangue ──
  {nome:'Manto das Sombras',elem:'Sangue',circ:3,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:6,efeito:'Cria um manto de sombras ao redor. Você recebe Camuflagem Total e +5 em testes de Furtividade.',disc:'(+4 PE) Aliados em alcance curto também recebem Camuflagem.',verd:'(+8 PE, 4º círculo, afinidade) Você e aliados em alcance curto ficam completamente Invisíveis até que ataquem.'},
  {nome:'Erodir Conhecimento',elem:'Sangue',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:6,efeito:'Drena o conhecimento do alvo. Se falhar: perde 1d4 rituais aprendidos temporariamente e sofre –5 em Intelecto. Se passar: apenas –3 em Intelecto.',disc:'(+4 PE) A perda de rituais é permanente até o fim da missão.',verd:'(+8 PE, 4º círculo) Afeta até 3 alvos simultaneamente.'},
  {nome:'Contágio de Sangue',elem:'Sangue',circ:3,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:6,efeito:'Transmite uma infecção paranormal ao alvo: sofre 3d8 de dano de Sangue por rodada. Se passar na resistência, o dano é 1d8 por rodada.',disc:'(+4 PE) O alvo também fica Vulnerável a dano por toda a cena.',verd:'(+8 PE, 4º círculo, afinidade) O contágio se espalha para seres em contato com o alvo.'},
  // ── Morte ──
  {nome:'Invocar Morto-Vivo',elem:'Morte',circ:3,exec:'Completa',alcance:'Toque',alvo:'1 cadáver',dur:'Cena',resist:'—',pe:6,efeito:'Anima um cadáver como morto-vivo controlado com VD igual a metade do original. Age no seu turno conforme seus comandos.',disc:'(+4 PE) O morto-vivo tem o VD completo do original.',verd:'(+8 PE, 4º círculo, afinidade) Pode animar até 3 cadáveres simultaneamente.'},
  {nome:'Derreter Sangue',elem:'Morte',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude parcial',pe:6,efeito:'Aquece o sangue do alvo de dentro para fora: 5d8+5 de dano de Morte. Se falhar, o alvo fica Incapacitado por 1 rodada.',disc:'(+4 PE) Dano sobe para 8d8+8.',verd:'(+8 PE, 4º círculo) Sem resistência; afeta até 3 alvos adjacentes.'},
  {nome:'Sugada Mortal',elem:'Morte',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Instantânea',resist:'Vontade parcial',pe:6,efeito:'Drena a força vital do alvo: ele sofre 4d8 de dano de Morte e você recupera metade como PV.',disc:'(+4 PE) Você recupera PV iguais a todo o dano causado.',verd:'(+8 PE, 4º círculo, afinidade) Drena também PE e Sanidade do alvo, recuperando metade para você.'},
  // ── Energia ──
  {nome:'Milagre Ionizante',elem:'Energia',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Instantânea',resist:'Reflexos parcial',pe:6,efeito:'Descarga de energia ionizante massiva: 6d8 de dano de Energia. O alvo fica Atordoado por 1 rodada se falhar.',disc:'(+4 PE) Dano sobe para 9d8; muda o alvo para área: explosão de 6m.',verd:'(+8 PE, 4º círculo, afinidade) Dano 12d8; afeta toda a área sem resistência.'},
  {nome:'Queimar Distorção',elem:'Energia',circ:3,exec:'Padrão',alcance:'Médio',alvo:'Área 9m de raio',dur:'Instantânea',resist:'Reflexos parcial',pe:6,efeito:'Descarga que queima e distorce a realidade: 5d6 de dano de Energia. Cria Terreno Difícil na área por 2 rodadas.',disc:'(+4 PE) Dano sobe para 8d6; o Terreno Difícil dura toda a cena.',verd:'(+8 PE, 4º círculo) Qualquer ritual conjurado na área durante a próxima rodada falha automaticamente.'},
  {nome:'Rajada Ionizante',elem:'Energia',circ:3,exec:'Padrão',alcance:'Longo',alvo:'Alvos escolhidos',dur:'Instantânea',resist:'Reflexos parcial',pe:6,efeito:'Dispara múltiplos raios de energia, um por alvo escolhido: 10d6 de dano de Energia em cada. Se passar: metade.',disc:'(+4 PE) Dano sobe para 12d6 por alvo.',verd:'(+8 PE, 4º círculo, afinidade) Dano 15d6; os raios voltam ao conjurador e ele pode redispará-los como ação de movimento.'},
  // ── Conhecimento ──
  {nome:'Alterar Memória',elem:'Conhecimento',circ:3,exec:'Completa',alcance:'Toque',alvo:'1 Ser',dur:'Permanente',resist:'Vontade anula',pe:6,efeito:'Apaga ou modifica a memória recente do alvo (até 1 hora). Ele acredita plenamente na versão alterada.',disc:'(+4 PE) Pode alterar memórias de até 1 dia atrás.',verd:'(+8 PE, 4º círculo, afinidade) Pode reescrever memórias de qualquer período da vida do alvo.'},
  {nome:'Contato Paranormal',elem:'Conhecimento',circ:3,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:6,efeito:'Você barganha com uma entidade do Outro Lado para obter ajuda. O Mestre determina o que a entidade oferece e o preço a pagar.',disc:'(+4 PE) O Mestre deve oferecer algo concreto e imediato.',verd:'(+8 PE, 4º círculo, afinidade) Você pode exigir a ajuda sem negociação (mas o preço aumenta significativamente).'},
  {nome:'Dissipar Espíritos',elem:'Conhecimento',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 criatura paranormal',dur:'Instantânea',resist:'Vontade anula',pe:6,efeito:'Dissolve a manifestação de uma criatura paranormal. Se falhar na resistência: a criatura é banida por 1 cena.',disc:'(+4 PE) A criatura é banida permanentemente se falhar.',verd:'(+8 PE, 4º círculo, afinidade) Pode banir até 3 criaturas paranormais ao mesmo tempo.'},
  {nome:'Controle Mental',elem:'Conhecimento',circ:3,exec:'Completa',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade anula',pe:6,efeito:'A mente do alvo é completamente controlada. Você pode comandá-lo como quiser — ele obedece qualquer ordem, inclusive contra aliados. O alvo não tem memória do período controlado.',disc:'(+4 PE) Pode controlar o alvo mesmo à distância longa.',verd:'(+8 PE, 4º círculo, afinidade) O controle dura 1 dia inteiro e pode ser ativado/desativado à distância.'},
  // ── Medo ──
  {nome:'Manifestação do Terror',elem:'Medo',circ:3,exec:'Completa',alcance:'Médio',alvo:'Área 9m de raio',dur:'Cena',resist:'Vontade parcial',pe:6,efeito:'Manifesta o medo mais profundo de cada ser na área de forma paranormal. Se falharem: Apavorados e perdem 2d6 de Sanidade. Se passarem: Abalados.',disc:'(+4 PE) Falha: Apavorados e Incapacitados por 1 rodada.',verd:'(+8 PE, 4º círculo, afinidade) Falha: Apavorados, Incapacitados e perdem 4d8 de Sanidade.'},
  {nome:'Eco do Medo',elem:'Medo',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:6,efeito:'Transforma o medo interno do alvo em dano real: o alvo sofre dano igual ao seu nível de Medo atual (min. 3d6). Se passar: metade.',disc:'(+4 PE) O dano máximo é dobrado.',verd:'(+8 PE, 4º círculo, afinidade) O medo se espalha: todos em alcance curto do alvo original são afetados.'},
  {nome:'Regeneração do Medo',elem:'Medo',circ:3,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:6,efeito:'Ao receber dano, você o absorve e o converte: recupera PV iguais à metade do dano recebido. Pode ser usado 1 vez por cena.',disc:'(+4 PE) Recupera PV iguais ao dano total recebido.',verd:'(+8 PE, 4º círculo, afinidade) Além de recuperar PV, você libera o excesso como dano de Medo em área de 6m de raio ao seu redor.'},
  // ══════════════════ 4º CÍRCULO ══════════════════
  {nome:'Invocar Demônio',elem:'Morte',circ:4,exec:'Completa (10 min)',alcance:'Pessoal',alvo:'Área 9m de raio',dur:'Cena',resist:'—',pe:10,efeito:'Invoca uma criatura poderosa do Outro Lado que obedece seus comandos. A criatura tem VD alto e habilidades únicas definidas pelo Mestre.',disc:'—',verd:'(+10 PE, afinidade) A criatura invocada tem o dobro de VD e permanece até o fim da missão.'},
  {nome:'Contágio Paranormal',elem:'Sangue',circ:4,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Permanente',resist:'Fortitude anula',pe:10,efeito:'Transmite uma maldição paranormal permanente. O alvo sofre efeitos negativos progressivos definidos pelo Mestre.',disc:'—',verd:'(+10 PE, afinidade) A maldição se espalha para outros seres em contato com o alvo.'},
  {nome:'Colapso da Mente',elem:'Conhecimento',circ:4,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Permanente',resist:'Vontade anula',pe:10,efeito:'Destrói os processos mentais do alvo: Loucura permanente (Medo 35). O alvo perde 2d10 de Sanidade máxima.',disc:'—',verd:'(+10 PE, afinidade) Afeta até 3 alvos; Sanidade máxima perdida sobe para 3d10.'},
  {nome:'Tempestade de Energia',elem:'Energia',circ:4,exec:'Padrão',alcance:'Longo',alvo:'Área 15m de raio',dur:'3 rodadas',resist:'Reflexos parcial',pe:10,efeito:'Invoca tempestade elétrica colossal: 8d10 de dano de Energia por rodada a todos na área. Equipamentos eletrônicos são destruídos.',disc:'—',verd:'(+10 PE, afinidade) A tempestade se move conforme sua vontade e dura toda a cena.'},
  {nome:'Apoteose do Medo',elem:'Medo',circ:4,exec:'Completa',alcance:'Médio',alvo:'Todos os seres na área',dur:'Cena',resist:'Vontade parcial',pe:10,efeito:'Manifesta a essência pura do Medo do Outro Lado. Falha: alvo foge aterrorizado e fica Apavorado toda a cena. Sucesso: Abalado.',disc:'—',verd:'(+10 PE, afinidade) Falha: Apavorados e Incapacitados toda a cena; sucesso: Apavorados.'},
  {nome:'Inexistir',elem:'Conhecimento',circ:4,exec:'Completa',alcance:'Toque',alvo:'1 Ser',dur:'Permanente',resist:'Poder anula',pe:10,efeito:'Apaga completamente um ser da existência. Se o alvo falhar na resistência, ele desaparece como se nunca tivesse existido — inclusive das memórias de outros seres. Custo adicional: 5 PE permanentes.',disc:'—',verd:'(+10 PE, afinidade) O alvo pode fazer um teste de resistência com penalidade de –10. Falha absoluta: existência apagada do registro da Realidade.'},
  {nome:'Drenagem do Medo',elem:'Medo',circ:4,exec:'Padrão',alcance:'Longo',alvo:'Área 12m de raio',dur:'Cena',resist:'Vontade parcial',pe:10,efeito:'Drena o medo de todos os seres na área, absorvendo-o. Você recupera 4d6 de Sanidade e os alvos perdem 4d6 de Sanidade (resistência: metade).',disc:'—',verd:'(+10 PE, afinidade) Você também recupera PV iguais à Sanidade drenada e pode redistribuir a Sanidade para aliados.'},
  // ── Rituais Oficiais Adicionais (Livro v1.3) ──
  // Sangue 1
  {nome:'Hemofagia',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude parcial',pe:2,efeito:'Você drena o sangue do alvo, enfraquecendo-o e se fortalecendo. O alvo sofre 2d6 de dano de Sangue e você recupera metade como PV. Se o alvo falhar na resistência, você recupera todos os PV do dano causado.',disc:'(+2 PE, 2º círculo) Além de PV, você também recupera 1d4 PE.',verd:'(+5 PE, 3º círculo, afinidade) Dano sobe para 4d6; você recupera PV e PE iguais ao dano total causado.'},
  // Morte 1
  {nome:'Consumir Manancial',elem:'Morte',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:0,efeito:'Você drena sua própria força vital para conjurar energia. Perde 1d8 PV e recupera PE iguais à metade do dano sofrido (arredondado para cima). Esse ritual não pode ser usado se você estiver Machucado.',disc:'(+2 PE) Além do normal, a recuperação de PE é igual a todo o dano sofrido.',verd:'(+4 PE, 2º círculo) O custo em PV é reduzido a 1d4 e você recupera PE iguais ao dano sofrido + seu Intelecto.'},
  {nome:'Maré do Tempo',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Instantânea',resist:'Vontade parcial',pe:2,efeito:'Acelera o envelhecimento do alvo por um momento: ele sofre –1 em Agilidade e Força até o fim da cena. Se falhar, também fica Lento por 1 rodada.',disc:'(+2 PE, 2º círculo) A penalidade aumenta para –2 em Agilidade e Força.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para até 3 seres; penalidade –2 e duração permanente até curados.'},
  // Conhecimento 1
  {nome:'Barreira Mental',elem:'Conhecimento',circ:1,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:2,efeito:'Cria uma barreira psíquica ao redor de sua mente. Você se torna imune a efeitos de leitura de mente, controle mental e perda de Sanidade pelo próximo ataque que o atingir. Pode ser usado como reação.',disc:'(+2 PE) A barreira dura até o fim da rodada.',verd:'(+5 PE, 3º círculo, afinidade) Você e até 3 aliados em alcance curto ficam imunes a efeitos mentais e de Sanidade por 1 rodada.'},
  {nome:'Sussurro Telepático',elem:'Conhecimento',circ:1,exec:'Livre',alcance:'Longo',alvo:'1 ser que você conheça',dur:'Instantânea',resist:'—',pe:2,efeito:'Você envia uma mensagem mental de até 25 palavras para um ser que você conheça pessoalmente, independente da distância (contanto que esteja no mesmo plano). O alvo ouve claramente em sua mente.',disc:'(+2 PE) O alvo pode responder imediatamente com até 25 palavras.',verd:'(+5 PE, 3º círculo, afinidade) Pode enviar mensagem para até 5 seres conhecidos simultaneamente; eles podem responder ao mesmo tempo.'},
  // Medo 1
  {nome:'Aura de Terror',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'Cena',resist:'Vontade parcial',pe:2,efeito:'Você irradia uma aura de medo paranormal. Seres hostis que entrem na área ficam Abalados enquanto permanecerem nela. Se falharem na resistência, ficam Apavorados por 1 rodada ao entrar.',disc:'(+2 PE) Além do normal, seres Abalados na área sofrem –1d20 em todos os testes.',verd:'(+5 PE, 3º círculo, afinidade) Seres que falham ficam Apavorados pela cena toda; a área dobra.'},
  // Sangue 2
  {nome:'Laço de Sangue',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Toque',alvo:'Até 2 seres consentindo',dur:'Missão',resist:'—',pe:4,efeito:'Cria um laço de sangue entre você e até 2 aliados. Você sabe a localização e estado de saúde (PV e condições) de cada aliado ligado a qualquer momento. Uma vez por cena, pode sacrificar 5 PV seus para curar 5 PV de um aliado ligado.',disc:'(+3 PE) O bônus de cura sobe para 10 PV transferidos por 5 PV gastos.',verd:'(+6 PE, 4º círculo, afinidade) Pode afetar até 4 aliados; ao morrer, os PV dos laços são redistribuídos entre os aliados ligados.'},
  // Morte 2
  {nome:'Visão da Morte',elem:'Morte',circ:2,exec:'Completa',alcance:'Toque',alvo:'1 Ser inconsciente ou morto',dur:'Instantânea',resist:'—',pe:4,efeito:'Ao tocar um ser morto ou inconsciente, você vê os últimos instantes de sua consciência — os últimos 10 minutos antes de cair. O Mestre descreve o que o ser viu, ouviu e sentiu.',disc:'(+3 PE) Estende a visão para a última hora antes da queda.',verd:'(+6 PE, 4º círculo, afinidade) Pode comunicar-se brevemente com a consciência do morto, fazendo até 3 perguntas que ele responde com o que sabia em vida.'},
  // Energia 2
  {nome:'Pulso Eletromagnético',elem:'Energia',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 9m de raio',dur:'Instantânea',resist:'—',pe:4,efeito:'Libera um pulso de energia caótica que desativa todos os equipamentos eletrônicos na área por 1 cena. Armas de fogo perdem 1 tiro de munição e falham no próximo uso (DT 15 Força para forçar o mecanismo).',disc:'(+3 PE) Além de desativar, causa 3d6 de dano de Energia em equipamentos e seres cibernéticos.',verd:'(+6 PE, 3º círculo, afinidade) A área dobra e equipamentos destruídos ficam permanentemente inutilizados.'},
  // Conhecimento 2
  {nome:'Escudo Telepático',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Aliados escolhidos',dur:'Cena',resist:'—',pe:4,efeito:'Cria um escudo mental ao redor de aliados escolhidos. Eles ficam imunes a leitura de mente, controle mental e efeitos de Sanidade por toda a cena.',disc:'(+3 PE) Além da imunidade, aliados protegidos recebem +2 em testes de Vontade.',verd:'(+6 PE, 4º círculo, afinidade) Aliados protegidos também ficam imunes a condições mentais (Abalado, Apavorado, Confuso).'},
  // Medo 2
  {nome:'Campo do Pesadelo',elem:'Medo',circ:2,exec:'Padrão',alcance:'Médio',alvo:'Área 9m de raio',dur:'Cena',resist:'Vontade parcial',pe:4,efeito:'Cria uma zona de pesadelos paranormais. Seres hostis na área perdem 1d6 de Sanidade por rodada. Se falharem na resistência inicial, ficam Abalados.',disc:'(+3 PE, 3º círculo) A perda de Sanidade sobe para 2d6 por rodada.',verd:'(+6 PE, 4º círculo, afinidade) Seres que perderem toda a Sanidade na área ficam Incapacitados de terror absoluto.'},
  // Sangue 3
  {nome:'Forma Bestial',elem:'Sangue',circ:3,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:6,efeito:'Transforma-se em uma forma bestial de sangue e carne: +4 em Força e Agilidade, garras naturais (2d8 de dano de Sangue), Resistência a dano físico 5 e deslocamento aumentado em +6m. Não pode conjurar rituais enquanto transformado.',disc:'(+4 PE) Também recebe regeneração 5 (recupera 5 PV no início de cada turno).',verd:'(+8 PE, 4º círculo, afinidade) Os bônus sobem para +6 em Força e Agilidade, garras 3d8, e pode usar rituais de Sangue 1º círculo na forma bestial.'},
  // Morte 3
  {nome:'Tempestade de Cinzas',elem:'Morte',circ:3,exec:'Completa',alcance:'Longo',alvo:'Área 12m de raio',dur:'3 rodadas',resist:'Fortitude parcial',pe:6,efeito:'Invoca uma tempestade de cinzas mortais. Seres na área sofrem 4d6 de dano de Morte por rodada e ficam Cegos enquanto permanecerem dentro.',disc:'(+4 PE) O dano sobe para 6d6 por rodada.',verd:'(+8 PE, 4º círculo, afinidade) A tempestade dura a cena inteira; seres que morrerem dentro dela se animam como mortos-vivos por 1 rodada.'},
  // Energia 3
  {nome:'Portal Fantasma',elem:'Energia',circ:3,exec:'Completa',alcance:'Longo',alvo:'2 pontos escolhidos',dur:'Cena',resist:'—',pe:6,efeito:'Cria dois portais de energia interconectados em dois pontos dentro do alcance. Qualquer ser pode atravessar um portal para emergir pelo outro. Os portais são visíveis a todos.',disc:'(+4 PE) Os portais ficam invisíveis a quem você não escolher.',verd:'(+8 PE, 4º círculo, afinidade) Os portais podem conectar dois pontos em locais diferentes, mesmo que estejam a quilômetros de distância — contanto que você conheça os dois locais.'},
  // Conhecimento 3
  {nome:'Profecia Limitada',elem:'Conhecimento',circ:3,exec:'Completa (10 min)',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:6,efeito:'Você entra em transe e recebe uma visão do futuro próximo (próximas 24h). O Mestre descreve uma cena vaga mas verdadeira sobre o que está por vir. Pode ser usada para antecipar armadilhas ou perigos.',disc:'(+4 PE) A visão inclui detalhes adicionais e cobre os próximos 3 dias.',verd:'(+8 PE, 4º círculo, afinidade) Pode fazer uma pergunta específica sobre o futuro e receber uma resposta direta (sim/não/talvez) do Mestre.'},
  // Medo 3
  {nome:'Espelho do Terror',elem:'Medo',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Instantânea',resist:'Vontade anula',pe:6,efeito:'Reflete o medo interno do alvo de volta a ele de forma amplificada. O alvo perde 3d8 de Sanidade e fica Apavorado por toda a cena. Se passar na resistência, o efeito é anulado completamente.',disc:'(+4 PE) A resistência passa para parcial: falha completa ou fica apenas Abalado.',verd:'(+8 PE, 4º círculo, afinidade) O terror é tão intenso que o alvo sofre dano real igual à Sanidade perdida.'},
  // 4º círculo adicionais
  {nome:'Dilúvio de Sangue',elem:'Sangue',circ:4,exec:'Completa',alcance:'Longo',alvo:'Área 15m de raio',dur:'Cena',resist:'Fortitude parcial',pe:10,efeito:'Manifesta um dilúvio de sangue paranormal. Seres na área sofrem 6d10 de dano de Sangue e ficam Vulneráveis por toda a cena. Resistência: metade do dano, sem condição.',disc:'—',verd:'(+10 PE, afinidade) O dano é maximizado; seres que falham ficam Imobilizados em coágulos de sangue.'},
  {nome:'Apocalipse da Entropia',elem:'Morte',circ:4,exec:'Completa (1 min)',alcance:'Extremo',alvo:'Área 30m de raio',dur:'Cena',resist:'Fortitude parcial',pe:10,efeito:'Acelera a entropia em uma área massiva. Todas as estruturas não-paranormais entram em colapso gradual. Seres na área sofrem 5d8 de dano de Morte por rodada.',disc:'—',verd:'(+10 PE, afinidade) O dano é dobrado; estruturas paranormais também são afetadas.'}
];

function renderRituaisTab(){
  const c=userChar(currentUser);
  if(!c.rituaisAprendidos) c.rituaisAprendidos={};
  const busca=(document.getElementById('ritual-busca')||{}).value||'';
  const elemFil=(document.getElementById('ritual-elem-fil')||{}).value||'';
  const circFil=(document.getElementById('ritual-circ-fil')||{}).value||'';
  const aprFil=(document.getElementById('ritual-apr-fil')||{}).value||'';
  const grid=document.getElementById('rituais-grid');
  if(!grid) return;
  grid.innerHTML='';
  const filtrado=RITUAIS_DB.filter(r=>{
    if(busca&&!r.nome.toLowerCase().includes(busca.toLowerCase())&&!r.efeito.toLowerCase().includes(busca.toLowerCase())) return false;
    if(elemFil&&r.elem!==elemFil) return false;
    if(circFil&&String(r.circ)!==circFil) return false;
    if(aprFil==='1'&&!c.rituaisAprendidos[r.nome]) return false;
    if(aprFil==='0'&&c.rituaisAprendidos[r.nome]) return false;
    return true;
  });
  const countEl=document.getElementById('ritual-count');
  if(countEl){const aprendidos=filtrado.filter(r=>c.rituaisAprendidos[r.nome]).length;countEl.textContent=`${filtrado.length} ritual${filtrado.length!==1?'s':''} exibido${filtrado.length!==1?'s':''} · ${aprendidos} aprendido${aprendidos!==1?'s':''}`;}
  if(!filtrado.length){grid.innerHTML='<div style="color:var(--white-dust);font-size:13px;padding:10px">Nenhum ritual encontrado.</div>';return;}
  filtrado.forEach(r=>{
    const apr=c.rituaisAprendidos[r.nome]||false;
    const cor=ELEM_COR[r.elem]||'var(--crimson)';
    const ico=ELEM_ICO[r.elem]||'⛧';
    const card=document.createElement('div');
    card.style.cssText=`background:rgba(10,0,8,0.9);border:1px solid ${apr?cor:'rgba(58,0,0,0.4)'};padding:14px;position:relative;overflow:hidden;transition:border-color .2s;`;
    const elemKey = r.elem.toLowerCase();
    const bgSize = elemKey==='conhecimento'?'65%':elemKey==='medo'?'95%':'85%';
    const wm = ico.replace('width:36px;height:36px;vertical-align:middle;', `position:absolute;top:36px;right:8px;width:100px;height:100px;opacity:0.45;pointer-events:none;`);
    card.innerHTML=`${wm}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer" onclick="toggleRitual('${r.nome.replace(/'/g,"\\'")}')">
        <div>
          <span style="font-family:'Cinzel',serif;font-size:12px;color:${apr?cor:'var(--white-bone)'};">${r.nome}</span>
          ${apr?`<span style="font-size:9px;font-family:'Oswald',sans-serif;color:${cor};margin-left:6px;letter-spacing:.08em">✓ APRENDIDO</span>`:''}
        </div>
        <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
          <span style="font-family:'Cinzel',serif;font-size:18px;letter-spacing:.12em;color:${cor};text-transform:uppercase;white-space:nowrap">${r.elem}</span>
          <span style="font-size:10px;padding:1px 6px;border:1px solid rgba(138,106,0,0.5);color:var(--gold-light);font-family:'Cinzel',serif;white-space:nowrap">${r.circ}º ⬤</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;font-size:10px;font-family:'Courier Prime',monospace;color:var(--white-dust)">
        <span>Exec: <b style="color:var(--white-ash)">${r.exec}</b></span>
        <span>Alcance: <b style="color:var(--white-ash)">${r.alcance}</b></span>
        <span>Alvo: <b style="color:var(--white-ash)">${r.alvo}</b></span>
        <span>Duração: <b style="color:var(--white-ash)">${r.dur}</b></span>
        ${r.resist!=='—'?`<span style="grid-column:1/-1">Resist: <b style="color:var(--white-ash)">${r.resist}</b></span>`:''}
        <span>Custo base: <b style="color:var(--gold-light)">${r.pe} PE</b></span>
      </div>
      <div style="font-size:12px;color:var(--white-ash);line-height:1.6;margin-bottom:6px">${r.efeito}</div>
      ${r.disc&&r.disc!=='—'?`<div style="font-size:11px;color:#aabbcc;line-height:1.5;margin-top:4px;padding-top:4px;border-top:1px solid rgba(34,136,204,0.2)"><span style="color:#55aadd;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.08em">DISCENTE</span> ${r.disc}</div>`:''}
      ${r.verd&&r.verd!=='—'?`<div style="font-size:11px;color:#ccbbaa;line-height:1.5;margin-top:4px;padding-top:4px;border-top:1px solid rgba(138,106,0,0.2)"><span style="color:var(--gold-light);font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.08em">VERDADEIRO</span> ${r.verd}</div>`:''}
    `;
    grid.appendChild(card);
  });
}

function toggleRitual(nome){
  const c=userChar(currentUser);
  if(!c.rituaisAprendidos) c.rituaisAprendidos={};
  c.rituaisAprendidos[nome]=!c.rituaisAprendidos[nome];
  if(!c.rituaisAprendidos[nome]) delete c.rituaisAprendidos[nome];
  renderRituaisTab();saveDB();
}


function renderInv(){
  const el=document.getElementById('inv-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.inv) c.inv=[];
  if(!c.inv.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhum item.</div>';return;}
  c.inv.forEach((it,i)=>{
    const row=document.createElement('div');row.className='list-item';
    row.innerHTML=`<div class="list-body">${it.nome}${it.qtd>1?' <span style="color:var(--crimson);font-size:11px">×'+it.qtd+'</span>':''}${it.desc?'<div class="list-meta">'+it.desc+'</div>':''}</div>
      <button class="del-btn" onclick="delInv(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addInv(){
  const n=document.getElementById('inv-nome').value.trim();if(!n)return;
  const c=userChar(currentUser);
  if(!c.inv) c.inv=[];
  c.inv.push({nome:n,desc:document.getElementById('inv-desc').value.trim(),qtd:parseInt(document.getElementById('inv-qtd').value)||1});
  document.getElementById('inv-nome').value='';document.getElementById('inv-desc').value='';
  renderInv();saveDB();flashSave('save-inv');
}
function delInv(i){const c=userChar(currentUser);c.inv.splice(i,1);renderInv();saveDB();}
 
/* ══════════════════════════════════════════════
   RITUAIS
══════════════════════════════════════════════ */
function renderRit(){
  const el=document.getElementById('rit-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.rituais) c.rituais=[];
  if(!c.rituais.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhum ritual.</div>';return;}
  c.rituais.forEach((r,i)=>{
    const row=document.createElement('div');row.className='list-item';
    row.innerHTML=`<div class="list-body"><span class="badge badge-r">Ritual</span>${r.nome}${r.nex?' <span style="color:var(--crimson);font-size:11px">NEX '+r.nex+'%</span>':''}${r.desc?'<div class="list-meta">'+r.desc+'</div>':''}</div>
      <button class="del-btn" onclick="delRit(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addRit(){
  const n=document.getElementById('rit-nome').value.trim();if(!n)return;
  const c=userChar(currentUser);
  c.rituais.push({nome:n,nex:document.getElementById('rit-nex').value.trim(),desc:document.getElementById('rit-desc').value.trim()});
  document.getElementById('rit-nome').value='';document.getElementById('rit-nex').value='';document.getElementById('rit-desc').value='';
  renderRit();saveDB();
}
function delRit(i){const c=userChar(currentUser);c.rituais.splice(i,1);renderRit();saveDB();}
 
/* ══════════════════════════════════════════════
   PISTAS / NOTAS
══════════════════════════════════════════════ */
const PISTA_COLORS={pista:'#c49a00',npc:'#1fc8a0',local:'#5b9cf6',ocult:'#bb88ff'};
function renderPistas(){
  const el=document.getElementById('pista-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.pistaList||!c.pistaList.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhuma pista registrada.</div>';return;}
  c.pistaList.forEach((p,i)=>{
    const row=document.createElement('div');row.className='list-item';
    const col=PISTA_COLORS[p.tipo]||'#888';
    row.innerHTML=`<div style="width:4px;background:${col};align-self:stretch;flex-shrink:0"></div>
      <div class="list-body">${p.texto}<div class="list-meta">${p.tipo.toUpperCase()} — ${p.h}</div></div>
      <button class="del-btn" onclick="delPista(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addPista(){
  const t=document.getElementById('pista-inp').value.trim();if(!t)return;
  const c=userChar(currentUser);if(!c.pistaList)c.pistaList=[];
  const h=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  c.pistaList.push({texto:t,tipo:document.getElementById('pista-tipo').value,h});
  document.getElementById('pista-inp').value='';renderPistas();saveDB();
}
function delPista(i){const c=userChar(currentUser);c.pistaList.splice(i,1);renderPistas();saveDB();}
 
function renderNotas(){
  const el=document.getElementById('nota-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.notas) c.notas=[];
  if(!c.notas.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhuma anotação.</div>';return;}
  c.notas.forEach((n,i)=>{
    const row=document.createElement('div');row.className='list-item';
    row.innerHTML=`<div class="list-body">${n.t}<div class="list-meta">${n.h}</div></div>
      <button class="del-btn" onclick="delNota(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addNota(){
  const t=document.getElementById('nota-inp').value.trim();if(!t)return;
  const c=userChar(currentUser);
  c.notas.unshift({t,h:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});
  document.getElementById('nota-inp').value='';renderNotas();saveDB();flashSave('save-missao');
}
function delNota(i){const c=userChar(currentUser);c.notas.splice(i,1);renderNotas();saveDB();}
 
/* ══════════════════════════════════════════════
   DICE
══════════════════════════════════════════════ */
function rollDie(f){
  if(window.playDiceRoll) playDiceRoll(f);
  const r=Math.floor(Math.random()*f)+1;
  showRoll('D'+f,[r],0,r,'');
}
function rollCustom(){
  const q=parseInt(document.getElementById('r-qtd').value)||1;
  const f=parseInt(document.getElementById('r-faces').value)||20;
  const mod=parseInt(document.getElementById('r-mod').value)||0;
  const lbl=document.getElementById('r-label').value.trim();
  if(window.playDiceRoll) playDiceRoll(f);
  const rolls=Array.from({length:q},()=>Math.floor(Math.random()*f)+1);
  const total=rolls.reduce((a,b)=>a+b,0)+mod;
  showRoll(q+'d'+f+(mod?(mod>0?'+':'')+mod:''),rolls,mod,total,lbl);
}
function showRoll(label,rolls,mod,total,ctx){
  document.getElementById('roll-res').textContent=total;
  const detail=rolls.join(' + ')+(mod&&mod!==0?(mod>0?' + ':' ')+mod:'');
  document.getElementById('roll-detail').textContent=label+(ctx?' ('+ctx+')':'')+': ['+detail+']';
  const h=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(!db.rolls[currentUser])db.rolls[currentUser]=[];
  const maxV=parseInt(label.replace(/\d+d/,''))||20;
  db.rolls[currentUser].unshift({label,total,h,ctx,user:currentUser,ts:Date.now(),maxVal:maxV});
  if(db.rolls[currentUser].length>50)db.rolls[currentUser].pop();
  renderLog();saveDB();
}
function renderLog(){
  const el=document.getElementById('roll-log');el.innerHTML='';
  const logs=db.rolls[currentUser]||[];
  if(!logs.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhuma rolagem ainda.</div>';return;}
  logs.forEach(r=>{
    const d=document.createElement('div');d.className='log-line';
    d.innerHTML=`<span class="log-tag">${r.h}</span> <span>${r.label}${r.ctx?' — '+r.ctx:''}</span> <b>→ ${r.total}</b>`;
    el.appendChild(d);
  });
}
function resetAllRolls(){if(confirm('Limpar histórico de rolagens de todos?')){db.rolls={};saveDB();renderLog();toast('Histórico limpo.');}}
 


appRituais.addInv = addInv;
appRituais.addNota = addNota;
appRituais.addPista = addPista;
appRituais.addRit = addRit;
appRituais.delInv = delInv;
appRituais.delNota = delNota;
appRituais.delPista = delPista;
appRituais.delRit = delRit;
appRituais.renderInv = renderInv;
appRituais.renderLog = renderLog;
appRituais.renderNotas = renderNotas;
appRituais.renderPistas = renderPistas;
appRituais.renderRit = renderRit;
appRituais.renderRituaisTab = renderRituaisTab;
appRituais.resetAllRolls = resetAllRolls;
appRituais.rollCustom = rollCustom;
appRituais.rollDie = rollDie;
appRituais.showRoll = showRoll;
appRituais.toggleRitual = toggleRitual;
Object.assign(window, appRituais);
