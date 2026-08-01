/* ════════════════════════════════════════════════════════════
   FICHA.JS — Aba "Ficha" (ficha do agente/personagem)
   ────────────────────────────────────────────────────────────
   Extraído do app.js para isolar tudo que pertence à aba Ficha:
   identidade do agente, atributos, PV/Sanidade/Esforço, perícias,
   condições, habilidades/poderes e cálculo de dano recebido.

   IMPORTANTE — o que NÃO está mais aqui:
   Equipar/desequipar armadura e qualquer ação de "usar" um item
   (arma, ritual, explosivo) foram movidos para app.js, porque essas
   ações pertencem à aba Inventário, não à Ficha. A Ficha só LÊ o
   estado (qual armadura está equipada) para calcular a RD no
   calculador de dano — quem MUDA esse estado é sempre o Inventário.
   Ver renderArmaduraEquipada()/desequiparArmadura() em app.js.

   Ordem de carregamento no index.html: este arquivo deve vir
   ANTES do app.js (mesmo padrão do criaturas.js), pois só declara
   funções e constantes independentes — nada aqui roda no topo do
   arquivo, então a ordem exata não quebra nada, mas mantemos essa
   convenção por clareza.

   Correção feita durante o rework: existiam DUAS versões da função
   aplicarCura() (uma delas usando um formato de dados errado,
   c.stats.pv, e chamando renderStats() — uma função que nunca
   tinha sido definida em lugar nenhum do projeto). Isso quebrava
   silenciosamente a cura e qualquer ação que dependesse de
   atualizarFicha()/renderStats() com um ReferenceError. Mantivemos
   apenas a versão correta e criamos a função renderStats() que
   faltava.
   ════════════════════════════════════════════════════════════ */

function descartarFicha(){
  if(!currentUser)return;
  const c=userChar(currentUser);
  const nomeAtual=c.nome||currentUser;

  // Modal de confirmação
  const existing=document.getElementById('_descarte_modal');
  if(existing)existing.remove();

  const modal=document.createElement('div');
  modal.id='_descarte_modal';
  modal.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  modal.innerHTML=`
    <div style="background:#0d0008;border:1px solid #8b0000;max-width:440px;width:100%;padding:28px 24px;box-sizing:border-box;font-family:'Cinzel',serif">
      <div style="font-size:15px;letter-spacing:.18em;color:#cc2222;text-transform:uppercase;margin-bottom:8px">⚠ Descartar Ficha</div>
      <div style="font-family:'IM Fell English',serif;font-style:italic;font-size:13px;color:var(--white-ash);line-height:1.7;margin-bottom:18px">
        Você está prestes a apagar toda a ficha de <b style="color:var(--gold-light)">${nomeAtual}</b> — atributos, inventário, rituais, habilidades e progresso.<br><br>
        Uma nova ficha em branco será criada no lugar.<br>
        <span style="color:#cc4444">Esta ação não pode ser desfeita.</span>
      </div>
      <div style="font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.1em;color:var(--white-dust);text-transform:uppercase;margin-bottom:8px">Digite o nome do agente para confirmar:</div>
      <input id="_descarte_confirm_inp" placeholder="${nomeAtual}" style="width:100%;box-sizing:border-box;background:rgba(20,0,10,0.8);border:1px solid rgba(139,0,0,0.5);color:var(--white-bone);padding:9px 12px;font-family:'Courier Prime',monospace;font-size:13px;outline:none;margin-bottom:16px" oninput="document.getElementById('_descarte_btn_ok').style.opacity=this.value.trim()===document.getElementById('_descarte_nome_ref').textContent?'1':'0.4'">
      <span id="_descarte_nome_ref" style="display:none">${nomeAtual}</span>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="document.getElementById('_descarte_modal').remove()" style="padding:8px 18px;background:transparent;border:1px solid rgba(100,100,100,0.4);color:var(--white-dust);font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer">Cancelar</button>
        <button id="_descarte_btn_ok" onclick="_confirmarDescarte()" style="padding:8px 18px;background:rgba(139,0,0,0.2);border:1px solid #8b0000;color:#ff5555;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;opacity:0.4;transition:opacity .2s">✕ Confirmar Descarte</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(()=>document.getElementById('_descarte_confirm_inp')?.focus(),50);
}

function _confirmarDescarte(){
  const inp=document.getElementById('_descarte_confirm_inp');
  const ref=document.getElementById('_descarte_nome_ref');
  if(!inp||!ref)return;
  if(inp.value.trim()!==ref.textContent){toast('Nome incorreto. Descarte cancelado.','#cc4444');return;}

  // Apaga a ficha e cria uma nova em branco, preservando token e login
  const novaFicha=defaultChar();
  // Preserva token e dados de auth que não devem sumir
  const tokenAtual=(db.characters[currentUser]||{}).token;
  if(tokenAtual)novaFicha.token=tokenAtual;

  // Apaga transcendência, rituais, habilidades, inventário — tudo
  db.characters[currentUser]=novaFicha;
  // Apaga liberação de transcendência
  if(db.mestre&&db.mestre.transLiberada)db.mestre.transLiberada[currentUser]=false;
  saveDB();

  // Remove modal e repopula a ficha
  const modal=document.getElementById('_descarte_modal');
  if(modal)modal.remove();

  populateAll();
  if(typeof renderTranscendenciaPanel==='function')renderTranscendenciaPanel();
  if(typeof renderRituaisTab==='function')renderRituaisTab();
  if(typeof renderTrilhaHabs==='function')renderTrilhaHabs();
  if(typeof _removerTemaElemento==='function')_removerTemaElemento();
  if(typeof _ensureClasseCriaturaOption==='function')_ensureClasseCriaturaOption();
  toast('Ficha descartada. Esse é o seu novo começo.','#8b0000');
}

/* ══════════════════════════════════════════════
   TRILHA / CLASSE / ORIGEM — textos descritivos
══════════════════════════════════════════════ */
function renderTrilhaInfo(){
  const trilha=(document.getElementById('f-trilha')||{}).value||'';
  const el=document.getElementById('trilha-info');
  if(!el)return;
  el.textContent=trilha?'Trilha: '+trilha:'';
}

/* ── Classes ── */
const CLASSES_DESC={
  Combatente:'⚔ Perito em combate direto. PV alto, proficiência em armas táticas e proteções. Foca em ataques, manobras e resistência física. PV: 20+Vig (mais 4+Vig/NEX). PE: 2+Pre (mais 2+Pre/NEX). SAN: 12 (mais 3/NEX).',
  Especialista:'◎ Profissional versátil com muitas perícias treinadas. Perito em áreas técnicas (tiro, medicina, tecnologia, infiltração, negociação). PV: 16+Vig (mais 3+Vig/NEX). PE: 3+Pre (mais 3+Pre/NEX). SAN: 16 (mais 4/NEX).',
  Ocultista:'❖ Conjurador de rituais do Outro Lado. Conexão inata com o paranormal. Acesso a rituais de 1º ao 4º círculo. PV: 12+Vig (mais 2+Vig/NEX). PE: 4+Pre (mais 4+Pre/NEX). SAN: 20 (mais 5/NEX).'
};

function renderClasseDesc(){
  const cls=(document.getElementById('f-classe')||{}).value||'';
  const el=document.getElementById('classe-desc');
  if(!el)return;
  if(cls&&CLASSES_DESC[cls]){
    el.innerHTML=CLASSES_DESC[cls]+'<div class="desc-click-hint">Ver em tela cheia</div>';
    el.style.display='block';
    el.onclick=()=>abrirDescPopup(cls, CLASSES_DESC[cls], {subtitulo:'⚔ Classe'});
  }
  else{el.style.display='none';el.onclick=null;}
}

/* ── Origens ── */
const ORIGENS_DB={
  // ── Novas origens: Arsenal dos Agentes v0.6.6 ──
  'Açougueiro':{pericias:'Luta e Medicina',poder:'Corte De Carne',desc:'Você trabalhava em um açougue, mercado ou até mesmo em uma casa de carnes, passando seus dias envolto no cheiro de animais mortos enquanto corta carnes e vende elas para os clientes.',poder_desc:'Com facas, facões e armas leves ou de uma mão que causem dano de Corte, você soma o dobro da Força no dano, em vez de apenas uma vez. PASSOU UM POQUINHO. Acostumado a exagerar com pesos, levando as carcaças de animais e sempre colocando um pouco mais de carne do que pedido. Por isso, ao sofrer sobrecarga sofre apenas a penalidade em testes de perícia afetadas por carga.'},
  'Adestrador':{pericias:'Adestramento e Sobrevivência',poder:'Conexão Natural',desc:'Você possui uma ligação com os animais, tendo treinado dezenas deles em seus anos de trabalho. Talvez para auxiliar em missões com animais ou para tentar controlar criaturas do Outro Lado, você foi recrutado.',poder_desc:'Enquanto estiver em terreno natural, você se sente abraçado pela terra, como se aquele fosse seu verdadeiro lar. Nesses locais, você recebe +1d em todos os seus testes e caso falhe em um teste, pode gastar 3 PE para rolá-lo novamente. SENTA, DEITA E ROLA. Você recebe +2 em testes de Adestramento e pode utilizar esta perícia para dar comandos complexos para animais. Caso tenha um animal adestrado por você em alcance médio, pode gastar uma ação de movimento e 2 PE para comandá-lo (faça um teste de Adestramento contrário a Vontade dele). Caso ganhe, ele seguirá o comando na próxima vez que agir, se superar a DT por 10 ou mais, ele iá seguir seus comandos até o fim da cena. Existem três comandos padrões para serem utilizados: ATACAR. O animal ataca causando 1d6 de dano + sua Presença para +1d6 por categoria de tamanho que possuir acima de tamanho médio. O tipo de dano causado deve ser escolhido entre Corte, Impacto e Perfuração, conforme o animal que está sendo comandado. FUGIR. O animal foge do local, se deslocando até 21 metros em uma direção à sua escolha. VASCULHAR. O animal vasculha um local que possivelmente era inacessível para você. Faça um teste de Investigação com Presença em vez de Intelecto como atributo. Se passar, o animal consegue encontrar uma pista.'},
  'Aeronauta':{pericias:'Intuição e Pilotagem',poder:'Esqueça O Livro',desc:'Um agente da aeronáutica ou das forças especiais, protegendo seu país (ou espionando outros) com aviões de última tecnologia, você voou graciosamente pelos seus, até que algo lhe ocorreu. Talvez por um acidente ou por ter se deparado com o Paranormal, seu foco mudou, se propondo a lutar por algo muito maior que seu país.',poder_desc:'CONFIE NOS SEUS INSTINTOS. Uma vez por missão, você pode usar uma regra do sistema de forma errada, desde que confie que ela esteja certa. Caso ela seja contestada por outro jogador até o fim da rodada no qual a utilizou, o bônus recebido por isso será perdido e o uso desta habilidade será NOVAS ORIGENS'},
  'Origem':{pericias:'',poder:'Poder de Origem',desc:'',poder_desc:'PODERES Açougueiro Luta e Medicina Corte de Carne e Passou Um Pouquinho Adestrador Adestramento e Sobrevivência Conexão Neural e Senta, Deita e Rola Aeronauta Intuição e Pilotagem Esqueça o Livro! Confie Nos Seus Instintos e Sinto a Necessidade da Velocidade Ajudante Diplomacia e Percepção Aqui Para Ajudar e Observando e Crescendo Animador Artes e Pontaria 24 Quadros e Prazo Apertado Aposentado Fortitude e Sociedade Uma Vida de Trabalho e Tempo Para Pensar Apostador Enganação e Intuição All In e Tudo ou Nada Arqueólogo Ocultismo e Sociedade Aprendendo Com o Passado e Registros Paranormais Arquiteto Artes e Ciências Belas Decorações e Planejamento Estrutural Arquivista Iniciativa e Percepção Lendo as Entrelinhas e Reposição Rápida Astrônomo Ciências e Investigação Alinhamento dos Planetas e Mapa Astral Atendente Atualidades e Diplomacia Mais Um Na Multidão e Paciência Incansável Ativista Atualidades e Fortitude Quebrando as Regras e Tudo Pela Causa Auxiliar de Limpeza Atletismo e Fortitude Limpeza Impecável e O Lixo de Um é o Tesouro de Outro Barbeiro Atualidades e Reflexos Barba, Cabelo e Bigode e Mãos Ágeis e Fofocas Quentes Barista Acrobacia e Diplomacia Arte da Fala e Centenas de Histórias de Amor Bombeiro Fortitude e Iniciativa Altas Temperaturas e De Frente Com o Medo Caça Problemas Iniciativa e Vontade Problema Meu e Sem Medo de Arriscar Circense Acrobacia e Artes Apresentação de Destaque e Quem Faz o Palhaço Rir Coach Diplomacia ou Enganação, e Vontade Falsas Verdades e Palavras Vazias Colecionador Artes e Investigação Cuidados Excessivos e Tesouros Escondidos Comerciante Diplomacia e Iniciativa Ah, Deixa Que Eu Faço e Planejamento Econômico Controlador de Pragas Ciências e Sobrevivência Prevenção Nunca É Demais e Vermes Malditos Costureiro Artes e Atualidades Closet Lotado e Toques Pessoais Coveiro Atletismo e Percepção Enterrando o Passado e Ladrão de Tumbas Cria da Ordem Investigação e Ocultismo Herança Familiar e Nascido do Outro Lado'},
  'Novas Origens Origem':{pericias:'',poder:'Poder de Origem',desc:'',poder_desc:'PODERES Crítico Artes e Sociedade Avaliação Criteriosa e Olhar Analítico Cuidador Adestramento ou Diplomacia, e Medicina Acalentar a Fúria e Rotina Programada Dançarino Acrobacia e Artes Música de Batalha e Ritmo Esguio Delinquente Crime e Vontade Caminhos Pouco Ortodoxos e Rebeldia Institucional Desafiador Atletismo e Vontade Buscando Por Adrenalina e Sem Medo do Perigo Designer de Produtos Artes e Tecnologia Projeto Ergonômico e Protótipo Deslocado no Tempo Atualidades ou Sobrevivência, e Percepção O Passado Está Presente e Um Deslumbrante Futuro Diarista Atletismo e Percepção Ao Seu Dispor e Cuidado Impecável Enigmático Investigação e Vontade Cifra de Cesar e Enigma do Milênio Entregador Atletismo e Diplomacia Clientes Fieis e Rotina Ingrata Espadachim Luta e Reflexos Caminho da Espada e Tempo de Treino Espião Enganação e Furtividade Ratirada Tátiva e Vivendo nas Sombras Espiritualizado Ocultismo e Religião Fé Ancestral e Saberes Futuros Famoso da Internet Atualidades e Tecnologia Coordenação Perfeita e Público Nichado Fanático Uma perícia de Intelecto e Vontade Discussões Revigorantes e Hiperfixação Ferreiro Fortitude e Profissão (Armeiro) Armas Bem-feitas e Conhecendo Sua Própria Obra Festeiro Artes e Iniciativa Até Cair e Virando o Copo Filósofo Ciências e Religião Autoconsciência e Reflexão Profunda Físico Nuclear Ciências e Fortitude Eu Virei a Morte e Materiais Radioativos Fisioterapeuta Atletismo e Medicina Exercícios Preventivos e Relaxamento Corporal Forasteiro Profissão e Sociedade Aprendendo Novas Culturas e Equipamento Importado Gerente Diplomacia e Intimidação Estagiário e Façam Direito! Guerrilheiro Luta ou Pontaria, e Sobrevivência Guerra na Mata e Lutando Por Um Ideal Guia Turístico Atualidades e Sociedade Apresentando a Cidade e Joias Ocultas Historiador Investigação e Sociedade Relíquias do Passado e Solo Conhecido NOVAS ORIGENS'},
  'Origem':{pericias:'',poder:'Poder de Origem',desc:'',poder_desc:'PODERES Hoteleiro Atualidades e Percepção Certo, Senhor! e Suíte Presidencial Humorista Diplomacia e Enganação Cotidiano Fascinante e Qual a Graça? Ilusionista Artes e Enganação Mãos Astutas e Truques Sorrateiros Ilustrador Artes e Pontaria Gravura Detalhada e Inspiração Deslumbrante Incitador do Paranormal Artes e Enganação Proteção Improvável e Vem Pro Pai Juiz Investigação e Sociedade Arbitragem Justa e Jurisprudência Linguista Intuição e Sociedade Escritas Ancestrais e Padrões de Fala Marido Troféu Atletismo e Atualidades Beleza Desinteressante e Esculpido no Ócio Mascote Artes e Acrobacia Entrando no Personagem e Levantando o Clima Mecânico Profissão (Engenheiro) e Tecnologia Só Uns Ajustes e Turbinando Meretriz Diplomacia e Fortitude Resistindo às Adversidades e Só No Amor Miliciano Crime e Diplomacia Recebendo Com Juros e Sorte no Jogo Modelo Artes e Intimidação Beleza Ofuscante e Olhar Matador Muquirana Diplomacia e Sobrevivência Pão Duro e Vai Me Negar Um Prato de Comida? Musicista Artes e Percepção Ouvido Treinado e Vozeirão Nutricionista Ciências e Medicina Alimentação Equilibrada e Nutrição Preparatória Olheiro Intuição e Percepção Em Busca de Novos Talentos e Lapidar o Diamante Pacifista Diplomacia e Sociedade A Unica Opção e Fúria de Um Pacifista Padeiro Diplomacia e Profissão (Cozinheiro) Deixe Fermentar e Esperar Calmamente Pai/Mãe Solo Fortitude e Vontade Não Posso Desistir e Jornada Tripla Pescador Enganação e Fortitude Esperando a Maré e Histórias de Pescador Pesquisador Paranormal Ciências e Ocultismo Experimentos Elementais e Proto-Ocultista Político Crime e Enganação Favores Políticos e Manipulador de Informações Porteiro Diplomacia e Percepção Boca de Túmulo e Ouvidos nas Paredes Powerlifter Atletismo e Vontade Força de Vontade e Músculos Reforçados Praieiro Atletismo e Fortitude Fritando no Sol e Tá Dando Onda'},
  'Novas Origens Origem':{pericias:'',poder:'Poder de Origem',desc:'',poder_desc:'PODERES Prodígio Intuição e Percepção Mente Poderosa e Padrões Lógicos Profissional de R.H. Intuição e Investigação Amenização e Melhor Para a Função Profissional Incomum Atualidades e Sobrevivência Combinação Unica e Super Especialização Publicitário Ciências e Diplomacia Análise de Mercado e Fortalecendo a Imagem Químico Ciências e Profissão (Químico) Desequilíbrio Químico e Química do Bem Radialista Artes e Diplomacia Desenrolando o Assunto e Palavras Profundas Reabilitado Sobrevivência e Vontade Já Estive Pior e Vivendo de Migalhas Rejeitado Furtividade e Vontade Presença Ignorável e Sem Esperanças Revisor Artes e Sociedade Ações Revistas e Revisão Completa Roteirista Atualidades e uma perícia entre Ciências, Religião e Ocultismo Escrevendo Minha Própria História e Seguindo o Roteiro Selvagem Fortitude e Furtividade Bote do Predador e Metabolismo Reforçado Singularidade Fortitude e Ocultismo Anomalia Energética, Conhecimento Raro, Excedendo a Morte e Sangue Unico Sobrevivente Oprimido Atletismo e Fortitude Doce Liberdade e Extração Mineral Sub Empregado Diplomacia e Profissão Persistência Necessária e Por Conta Própria Tatuador Artes e Fortitude Ilustração Irregular e Pulso Firme Tripulante Acrobacia e Vontade Lutando Pelo Povo e Vivendo Em Alto Mar Ventríloquo Artes e Enganação Controlar Voz e Manipulação Sonora Vigia Iniciativa e Percepção Desafiar o Perigo e Essa É Pela Equipe recuperado. Entretanto, só será possível utilizá-la novamente a partir da próxima cena. Além disso, você recebe +5 em Intuição. SINTO A NECESSIDADE DA VELOCIDADE. Treinado para pilotar aviões em alta-velocidade, você possui Reflexos que superam em muito os de um humano comum. Você recebe +2 em testes de Reflexos e a ação gasta para realizar um uso de Pilotagem diminui em 1 passo (completa para padrão, padrão para movimento, etc).'},
  'Ajudante':{pericias:'Diplomacia e Percepção',poder:'Aqui Para Ajudar',desc:'Você trabalhava como secretário, como algum tipo de auxiliar para uma profissional de sua área ou como um estagiário, aprendendo o máximo possível para se desenvolver. Enquanto seguia um destes mentores, acabou se encontrar com a Ordem, muito provavelmente se reunindo a ela jundo dele.',poder_desc:'Você veio para poder ajudar os demais, estando sempre pronto para tal. Ao realizar uma Ajuda, a ação gasta para fazê-la é um passo menor do que a ação que normalmente seria gasta para auxiliar naquele teste (completa para padrão, padrão para movimento, etc). OBSERVANDO E CRESCENDO. Para se desenvolver e encontrar a profissão que quer seguir, você está se adaptando pouco a pouco. Ao começar uma missão, você recebe, até o fim da missão, um poder de origem possuído pelo personagem que você passou mais tempo interagindo em sua última missão.'},
  'Animador':{pericias:'Artes e Pontaria',poder:'24 Quadros',desc:'Você trabalhava fazendo animações, seja para canais do youtube, filmes ou até mesmo series animadas. Tendo uma rotina de muitas horas de trabalho em frente a um computador, acabou por se isolar do mundo ao seu redor, mas não de suas ambições e procuras, conseguindo inclusive despertar novas.',poder_desc:'Acostumado a pensar em cada passo de uma animação, tendo em sua mente cada fragmento de um movimento separado de forma detalhada, você é capaz de pensar de cortar movimentos desnecessários. Ao gastar 2 PE, recebe +3m de deslocamento até o fim da rodada e +2 em testes de perícias baseadas em Agilidade. PRAZO APERTADO. Em momentos desesperados, você consegue correr para realizar uma ação de forma mais rápida, porém muito menos precisa. Você pode sofrer -10 em um teste para reduzir a ação necessária para realizá-lo em um passo (Completa para Padrão, Padrão para Movimento, etc). Uma ação nunca pode se tornar uma ação livre por influência desta habilidade. Após usar esta habilidade você fica Fatigado até o fim da cena (esta condição é cumulativa).'},
  'Aposentado':{pericias:'Fortitude e Sociedade',poder:'Uma Vida De Trabalho',desc:'Você já trabalhou por toda sua vida e chegou finalmente seu momento de descansar, ou talvez não? O tédio e calmaria da aposentadoria te levaram a buscar algo mais, um novo sentido para sua vida, fazendo com que se deparasse com o paranormal.',poder_desc:'Para se aposentar, você trabalhou por uma quantidade considerável de tempo exercendo uma, ou múltiplas funções na sociedade. Escolha uma origem para representar a função que você exerceu, você recebe ambas as perícias da origem escolhida e +1d20 em testes com uma delas. TEMPO PARA PENSAR. Com tanta experiência acumulada, você sabe que normalmente parar e pensar pode ser o necessário para atingir a melhor das soluções. Ao realizar um teste de uma perícia baseada em Intelecto, pode levar o dobro do tempo (ou gastar o dobro das ações, exceto para ações livres ou reações) para conseguir um melhor desempenho. Você recebe +5 neste teste.'},
  'Apostador':{pericias:'Enganação e Intuição',poder:'All In',desc:'A vida sem riscos nunca teve graça para você, por isso, sempre se manteve apostando. A frustração de perder e a euforia em ganhar lhe moviam, como o carvão move uma locomotiva. Buscando fontes ainda maiores de adrenalina, encontrou a Ordem, onde poderia ajudar o mundo, enquanto abastecia seu próprio vício, apostando sua vida em cada missão.',poder_desc:'Uma vez por cena você pode lançar tudo que tem em uma única jogada. Caso faça isso, irá somar sua Presença em uma rolagem, independentemente de qual for. TUDO OU NADA. Para se conquistar os grandes prêmios, é preciso estar disposto a fazer grandes apostas. Você pode ao gastar uma ação de padrão, propor uma aposta contra um ser em alcance médio, caso ele aceite, você receberá +2 em testes contra ele até a aposta ser finalizada. Como principio, a aposta é resolvida como um teste contrário de Vontade entre os dois participantes que ocorre instantaneamente, mas à critério do mestre, caso seja uma disputa mais elaborada, outros fins podem definir seu resultado. De qualquer maneira, aquele que ganhar irá receber +1d20 em testes até o fim da cena e o que perder ficará Frustrado.'},
  'Arqueólogo':{pericias:'Ocultismo e Sociedade',poder:'Aprendendo Com O Passado',desc:'A história humana é fascinante e atraiu sua atenção para pesquisá-la cada vez mais. Em tais pesquisas cada vez mais específicas e complexas, você se deparou com incongruências, como se o passado estivesse incoerente. Buscando por revelar a verdade por trás disso, acabou por se deparar com o Paranormal e a vastidão de mudanças que ele ocasionou na história, motivando ainda mais suas buscas.',poder_desc:'Você pode gastar uma ação de movimento e 1 PE, para vasculhar rapidamente seu conhecimento sobre o passado e realizar um teste de Sociedade. Este teste conta como uma ajuda para o próximo teste de uma perícia baseada em Intelecto (exceto Sociedade) que você realizar, na mesma cena. REGISTROS PARANORMAIS. Durante uma parte considerável da história humana enquanto sociedade, o Paranormal esteve presente. Afetando, destruindo e até mesmo controlando civilizações por debaixo dos panos. Para a maioria das pessoas, isto não passa de um conto ficcional, mas para você, isso é apenas mais um registro de nossa história. Você recebe +5 em testes para identificar criaturas e ao realizar um teste de Sociedade relacionado ao Paranormal, pode gastar 2 PE para adicionar metade de seu bônus de Ocultismo ao teste.'},
  'Arquiteto':{pericias:'Artes e Ciências',poder:'Belas Decorações',desc:'Você trabalhou planejando casas, prédios e todos os tipos de construções, estudando arduamente a melhor forma de configurá-las. Talvez ao trabalhar na confecção de uma planta secreta para a Ordem, ou por um evento aleatório de sua vida, você se aproximou do Paranormal.',poder_desc:'Acostumado a planejar interiores de forma detalhada e utilitária, você se tornou um expert em fazer isso de forma barata e prática. Quando constrói uma base, ou veículo, que não possua modificações, você pode adicionar a ele uma modificação à sua escolha. PLANEJAMENTO ESTRUTURAL. Tendo estudado sobre a criação de projetos, você sabe como estruturá-los de forma mais resistente. Ao criar uma base, ela tem seus PV iniciais aumentados em 50%. Além disso, ao conjurar rituais que criem seres ou objetos os PV deles são 25% maiores.'},
  'Arquivista':{pericias:'Iniciativa e Percepção',poder:'Lendo As Entrelinhas',desc:'Você trabalhava em alguma função em cujo objetivo era catalogar, organizar e separar arquivos, livros ou produtos, como um Arquivista, Bibliotecário ou Estoquista. Por isso, desenvolveu uma capacidade organizacional. Talvez por este fato, ou apenas por uma coincidência do destino, foi recrutado pela Ordem, se tornando um agente.',poder_desc:'Cada mínimo detalhe deve ser levado em conta ao se organizar um local, como colocar os refrigerantes perto das carnes para estimular o público a comprá-los em conjunto. Graças a esta experiência, pode notar pequenos detalhes que para a maioria das pessoas deixaria passar. Ao realizar um teste de Investigação, Percepção ou Reflexos, pode gastar 1 PE para ver além do comum, diminuindo a DT em 2 para aquele uso. A cada vez que fizer isso para um mesmo teste, na cena, irá diminuir a DT em 1 ponto a mais do que a vez anterior. REPOSIÇÃO RÁPIDA. Quanto mais rápida era a reposição que você realizava, menos tempo precisava se dedicar a isso, podendo desfrutar de outros pontos mais calmos em seu trabalho. A ação necessária para que você recarregue qualquer item diminui em uma categoria (completa para padrão, padrão para movimento, etc). Além disso, pode recarregar um item que esteja sendo empunhado por um ser adjacente, caso você tenha em mãos o necessário para recarregar o objeto.'},
  'Astrônomo':{pericias:'Ciências e Investigação',poder:'Alinhamento Dos Planetas',desc:'Desde os primórdios da humanidade, olhamos para os céus buscando respostas para os problemas da terra. Ma você, foi um dos poucos capazes de realmente encontrar respostas lá.',poder_desc:'A partir dos céus é possível ver o passado, enquanto se projeta o futuro. Você pode gastar sua Folga da Ordem para prever o Paranormal a partir dos céus. Realize um teste de Ciências (DT 20), ao passar, descobre qual será o próximo local a ter sua membrana Rompida. Caso supere a DT por 10 ou mais, saberá qual será o próximo local a ter sua membrana Arruinada e se superar por 20 pontos ou mais, saberá o próximo local que terá a membrana Danificada. Por fim, quando realiza este teste, recebe +1 de PE máximo em sua próxima missão para cada dado que possuir um valor igual a outro na rolagem. Por exemplo, se rolar 6, 6, 6, 12, 14, 14, irá receber 5 PE. MAPA ASTRAL. A partir do céu noturno você é capaz de se guiar pelas estrelas. Durante a noite, você recebe +2 em testes de Investigação, Percepção e Sobrevivência.'},
  'Atendente':{pericias:'Atualidades e Diplomacia',poder:'Mais Um Na Multidão',desc:'A vida lidando com possíveis compradores nunca foi fácil, mas você sempre manteve um sorriso no rosto (ou tentou, pela insistência de seus chefes). Manter essa persona viva e ainda ter que lidar com as reclamações dos clientes, te levaram ao limite de sua sanidade e talvez por isso, o Paranormal se aproximou de você.',poder_desc:'O Sua loja era mais uma dentre as milhares e para conseguir uma comissão minimamente decente para sua existência, precisou desenvolver métodos de chamar atenção do público. Você consegue chamar atenção do público. Em um combate, pode gastar 2 PE para chamar atenção de um alvo, fazendo um teste de Presença (DT 15). Caso passe, o alvo priorizará interagir com você até o fim da cena, ou até que algo quebre este foco. PACIÊNCIA INCANSÁVEL. Por lidar diariamente com clientes ingratos e mal-educados, sua paciência cresceu, para evitar que exploda em ódio. Por isso, recebe +2 em testes de Vontade e caso atrase seu turno, seu Limite de PE irá aumentar em +1 até o início da próxima rodada.'},
  'Ativista':{pericias:'Atualidades e Fortitude',poder:'Quebrando As Regras',desc:'Por discordar com o rumo que a sociedade está tomando, você foi as ruas, buscando uma forma de melhorar o mundo em que vivemos. Sendo tratado como um rebelde, ou até um criminoso, sua luta não parou e ao se deparar com o Outro Lado, só cresceu.',poder_desc:'Às vezes para mudar o mundo, é preciso quebrar algumas regras. Você pode ignorar os pré-requisitos do primeiro poder geral que adquirir, desde que ele não exija NEX superior a 50% ou mais do que 2 outros poderes. TUDO PELA CENA. Você luta pelo que acredita até não poder mais. Mesmo prestes a cair se recusa a ser derrubado. Quando seu PV é reduzido a 0, deve realizar um teste de Presença (DT 20 menos seu Vigor). Caso passe, em vez de cair em Morrendo, fica com 1 PV. A cada vez que faz isso em um mesmo dia, a DT aumenta em 2.'},
  'Auxiliar De Limpeza':{pericias:'Atletismo e Furtividade',poder:'Limpeza Impecável',desc:'Você trabalhava na limpeza, seja nos prédios, residências ou ruas. Trabalhar assim foi exaustivo, e a falta de reconhecimento por todo seu esforço também não ajudou, mas você persistiu e isso te levou a um lugar diferente.',poder_desc:'Você não deixa nem um pingo de sujeira passar. Você recebe +2 em testes de Furtividade e a DT para rastrear seu grupo aumenta em 5. Caso, pelo menos, 2 membros do grupo tenham esta habilidade, aumentará em 10. Se todos possuirem, ela aumentará em 15. O LIXO DE UM, É O TESOURO DE OUTRO. Muitas vezes em seu trabalho, você achou itens valiosos em meio ao lixo, ou até mesmo os recebeu daqueles que preferiam dá-los para alguém em vez de apenas jogar fora. Aproveitando o que para eles foi descartado, você conseguiu melhoras para si mesmo. Quando um ser em alcance médio realiza um teste e tem uma rolagem inferior a 11, você pode gastar 1 PE para utilizar o resultado final do teste como o seu resultado no próximo teste daquela perícia que realizar nesta cena.'},
  'Barbeiro':{pericias:'Atualidades e Reflexos',poder:'Barba, Cabelo E Bigode',desc:'Com ótimas habilidades em suas mãos, você fazia cortes incríveis, adquirindo a confiança de seus clientes, forjando laços mais duradouros que a maioria dos relacionamentos. Por este vínculo de confiança, acabou por se deparar com a verdade de nosso mundo contada por um cliente, a existência de um poder além de nossa compreensão, o Paranormal.',poder_desc:'Você é capaz de preparar a beleza de um aliado ao seu máximo, dando uma repaginada em seu visual. Ao gastar uma ação de interlúdio, fornece +2 em testes de Artes, Diplomacia e Enganação para um aliado até o fim da cena. MÃOS ÁGEIS E FOFOCAS QUENTES. Você já ouviu muitas histórias enquanto cortava cabelos e treinava ainda mais suas mãos precisas. Por isso, você recebe +1d20 em testes de Atualidades e ao realizar um teste de uma perícia baseada em Agilidade onde o fato de estar empunhando um objeto relacionado ao teste seja relevante (como fazer um ataque), pode gastar 1 PE para receber +2 em seu teste. Por fim, graças as suas mãos precisas, recebe +1 em Margem de Ameaça.'},
  'Barista':{pericias:'Acrobacia e Diplomacia',poder:'Arte Da Fala',desc:'Trabalhando durante várias madrugadas em bares, você já ouviu as mais mirabolantes histórias. Muitas verdadeiras, muitas ficcionais, criadas por mentes alteradas pelo álcool. Porém a necessidade de atender os clientes e os escutar te tornaram um ótimo ouvinte.',poder_desc:'Suas palavras são capazes de retirar as pessoas dos piores momentos possíveis. Quando faz um teste de Diplomacia para Acalmar um ser, pode sempre escolher 10. E caso supere a DT por 10 ou mais, irá fornecer +1d20 para o alvo até o fim da cena, ou até que entre novamente em Enlouquecendo. CENTENAS DE HISTÓRIAS DE AMOR. Após anos escutando as histórias de sofrimento das pessoas, você aprendeu a reconfortá-las. Afinal, isso era o máximo que você podia fazer na posição em que estava. Você pode gastar uma ação padrão e 2 PE para absorver uma condição de um aliado adjacente, passando-a para si mesmo. Independentemente da origem deste efeito, a condição recebida irá acumular com qualquer outra. Você não pode utilizar esta habilidade caso seja imune a esta condição.'},
  'Bombeiro':{pericias:'Fortitude e Iniciativa',poder:'Altas Temperaturas',desc:'O Combatentes das chamas, treinados para impedir que o fogo se alastre e destrua ainda mais conquistas humanas, como já fez no passado. Tais virtudes fazem com que bombeiros sejam figuras comuns de se encontrar em organizações que combatem o Outro Lado e sua influência em nosso mundo.',poder_desc:'O Ao avançar em meio aos incêndios, seu corpo se acostumou com as temperaturas elevadas. Por isso, recebem +2 em Iniciativa, RD 5 a fogo e, na primeira rodada de uma cena, +3 metros de deslocamento. DE FRENTE COM O MEDO. O O fogo é naturalmente uma fonte de curiosidade e medo para os humanos, bombeiros são treinados para enfrentá-lo e respeitarem seu poder, avançando de forma corajosa e cautelosa. Por isso, são as pessoas perfeitas para enfrentar os perigos do Outro Lado, recebendo +2 contra efeitos de medo (efeitos que afetem sanidade, qualquer efeito que cause as condições abalado ou apavorado e efeitos de Medo) e imunidade a condição apavorado.'},
  'Caça Problemas':{pericias:'Iniciativa e Vontade',poder:'Problema Meu',desc:'Você é um caçador de tempestades, de mitos ou simplesmente alguém destemido o suficiente para ir em locais abandonados pela pura emoção ou pelas visualizações que poderia ter gravando possíveis fenômenos. Indo em locais tão propícios a chegada do Paranormal, encontrá-lo foi apenas uma questão de tempo, te levando a novos locais para arranjar novos problemas.',poder_desc:'Você está sempre atrás de novos problemas para se aventurar. Sempre que realizar uma ação duvidosa que pode criar novas aventuras (problemas), você recebe +5 em seu teste para realizá-la. SEM MEDO DE ARRISCAR. Você não tem medo de tomar decisões arriscadas. Ao realizar um teste que possua consequências por falhar, pode sofrer -1d20 para realizá-lo de forma arriscada. Se passar, recebe 1 PE temporário.'},
  'Circense':{pericias:'Acrobacia e Artes',poder:'Apresentação De Destaque',desc:'Você trabalhou ou foi criado em um circo, sendo acostumado ao palco e as apresentações. Vivendo nos holofotes, sua vida sempre se voltou para o show e para realizar um grande espetáculo. Talvez seja este brilhantismo que lhe aproximou ao Paranormal, ou possa ser tudo uma “coincidência”.',poder_desc:'Rotinas acrobáticas e cheias de truque prepararam seu corpo para realizar apresentações fenomenais. Você pode utilizar Agilidade em vez de Força e Presença para testes de Artes e Atletismo. Além disso, ao utilizar o uso de Artes Impressionar, também recebe os bônus em perícias baseadas em Agilidade. QUEM FAZ O PALHAÇO RIR. Circos são lugares de apresentações, onde é preciso manter sempre uma face apresentável e feliz, para que o público se afeiçoe mais pelos apresentadores. Enquanto estiver recebendo bônus por Impressionar, você pode, ao sofrer dano mental, gastar 1 PE para receber seu valor em Presença como RD a este dano.'},
  'Coach':{pericias:'Diplomacia ou Enganação, e Vontade',poder:'Falsas Verdades',desc:'Você era um coach, utilizando de suas palavras vazias para motivar as pessoas e vender seus ideais. Esta capacidade de manipular a mente humana, se provou um diferencial atrativo para a Ordem, fazendo com que você chamasse atenção.',poder_desc:'Uma vez por cena, você pode gastar uma ação padrão e 2 PE para realizar um teste de Enganação contrário ao teste de Vontade de um aliado em alcance curto que tenha perdido Sanidade desde seu último turno. Se ele falhar, você pode motivá-lo, fazendo com que recupere metade da Sanidade perdida e receba +2 em testes por 1d4 rodadas. PALAVRAS VAZIAS. Você fala o que os outros querem ouvir, podendo motivá-los de forma única. Ao realizar um teste de Enganação, pode gastar 1 PE para receber +2 em seu teste. Além disso, pode substituir testes de Diplomacia por testes de Enganação. Por fim, quando utiliza o uso Acalmar, o alvo recupera 1 de SAN a mais para cada 5 pontos que você ultrapassar a DT do teste.'},
  'Colecionador':{pericias:'Artes e Investigação',poder:'Cuidados Excessivos',desc:'Você colecionava algo em quantias surpreendentes, sejam moedas, revistinhas ou qualquer tipo de artigo que seja lançado em grandes quantias. Por algum motivo, provavelmente não correlacionado a sua coleção, você se deparou com o Paranormal.',poder_desc:'Para preservar cada peça em sua coleção, você utilizava de diversos métodos de cuidado e restauração, como guardar revistinhas em saquinhos, com um quarto climatizado, ou repintar miniaturas para que não percam suas cores conforme os anos. Por isso, ao utilizar a ação manutenção em uma cena de interlúdio, pode recuperar os PV de um número de itens igual ao seu Intelecto. Além disso, pode utilizar Manutenção em um item que esteja consertado para garantir que ele se torne mais durável, fornecendo 5 de RD a ele. TESOUROS ESCONDIDOS. Acostumado a encontrar itens extremamente raros de forma tão frequente e em locais improváveis, você se tornou um caçador nato de tesouros. Por isso, pode utilizar o uso de perícia Identificar Item Amaldiçoado para itens comuns com a perícia Investigação. Por fim, caso esteja procurando um objeto, você recebe +2 em testes de Investigação.'},
  'Comerciante':{pericias:'Diplomacia e Iniciativa',poder:'Ah, Deixa Que Eu Faço',desc:'Tendo administrado um pequeno negócio, você teve que aprender de tudo um pouco. Administração, contabilidade, legislação, marketing e muito mais foram conhecimentos que precisaram ser desenvolvidos em seu dia a dia no comando de sua empresa.',poder_desc:'Lidar com outras pessoas nem sempre é fácil, principalmente quando o erro delas pode custar tanto para você. Por isso, aprendeu a resolver as coisas do seu jeito quando isso fosse necessário. Quando um aliado em alcance médio falha em um teste, você pode gastar 1 PE para que na próxima vez que realizar um teste daquele uso de perícia nesta cena, receber +1d20. PLANEJAMENTO ECONÔMICO. Para que seu negócio crescesse, foi preciso tomar decisões arriscadas, que poderiam terminar com ele definitivamente. Esta coragem e capacidade de planejamento estratégico lhe tornaram um ótimo investidor. Graças a tal capacidade, pode uma vez por cena gastar uma ação de movimento para planejar todas as próximas ações que irá realizar em seu próximo turno (escreva elas em um papel e entregue ao mestre). O gasto em PE de todas elas será diminuído em 1 (mínimo 1).'},
  'Controlador De Pragas':{pericias:'Ciências e Sobrevivência PREVENÇÃO NUNCA É DEMAIS',poder:'Poder de Origem',desc:'Você trabalhava lidando com pragas, podendo ser um infecciologista ou um exterminador de insetos, tendo que impedir que tais criaturas infestem as casas e cidades. Com esta experiência, estava qualificado para exterminar a maior praga que assola a realidade.',poder_desc:'Alternativamente, pode usar isso para fornecer +2 em testes para resistir à doenças e venenos para até 5 pessoas. VERMES MALDITOS. Você já está acostumado a lidar com pragas e está pronto para exterminar as maiores que conhecemos. Por isso, recebe +1 em multiplicador de crítico contra criaturas.'},
  'Costureiro':{pericias:'Artes e Atualidades',poder:'Closet Lotado',desc:'A moda foi sua vida, costurando e criando as peças mais belas de roupa. Entretanto, seu estilo e mãos precisas reservaram um futuro diferente para você.',poder_desc:'Por seu costume em lidar com roupas para desfiles de grandes marcas, você aprendeu a combinar peças de forma orgânica e fabulosa. Você recebe +1 espaço de vestimenta totalizando 3. TOQUES PESSOAIS. Às vezes algo dava errado e ajustes precisavam ser feitos, tendo que costurar novamente ou remendar roupas de forma urgente, para que pudessem ser usadas a tempo. Esta correria lhe forneceu uma agilidade invejável. Você pode gastar uma ação de interlúdio e 1 PE para fazer um remendo, misturando estampas e tecidos. Escolha duas vestimentas, elas se tornarão uma única vestimenta. Enquanto estiver sendo usada, é possível com uma ação de movimento alternar qual será o bônus recebido pelo usuário, escolhendo dentre as duas vestes. Por fim, pode consertar qualquer vestimenta ao gastar 1 PE e 1 minuto.'},
  'Coveiro':{pericias:'Atletismo e Percepção',poder:'Enterrando O Passado',desc:'O ciclo da vida e da morte é um dos conceitos mais relevantes para o desenvolvimento e a cultura humana. Como forma de respeito e higiene, profissões foram criadas para lidar com o fim deste ciclo, sendo comum que fossem contratados para lidar com os cadáveres após missões da Ordem.',poder_desc:'Você já enterrou pessoas demais, seja figurativa ou literalmente. Graças a tais experiências, você é capaz de lidar com a morte de forma calma e costumeira, mas não significando que isso te impedirá de lutar para impedi-la. Uma vez por cena, quando um aliado entra em morrendo, você recebe um dos benefícios de Inspiração Resoluta à sua escolha. LADRÃO DE TUMBAS. Acostumado a enterrar pessoas e as exumar, você faz isso de forma extremamente eficaz e veloz. Ao enterrar uma pessoa, você reduz à 0 a chance dela se tornar uma criatura (veja a página XX). Além disso, você pode com facilidade exumar cadáveres, gastando uma ação de interlúdio para os desenterrar, investigar o corpo (realizando um teste propício para isso) e devolvê-lo ao solo.'},
  'Cria Da Ordem':{pericias:'Investigação e Ocultismo',poder:'Herança Familiar',desc:'Nascido em meio a luta contra o Paranormal, você cresceu com este conceito oculto para a população sendo algo de seu cotidiano, desenvolvendo uma afinidade com as organizações que o combatem e com ele mesmo.',poder_desc:'Crescendo em conexão ao Paranormal, você teve alguém que revelou este mundo para você, mas que já não pertence mais a realidade, deixando para você um item como herança. Este item Amaldiçoado de até Categoria III nunca irá contar no seu limite de itens e caso seja quebrado ou roubado, você sofrerá 1d6 de perda de Sanidade por categoria do item e ficará Alquebrado e Frustrado até o item ser recuperado. Qualquer efeito advindo das maldições desse item só irão se ativar quando você possuir a patente necessária para utilizar itens amaldiçoados (graças a ligação anterior ainda mantida no item). Por fim, caso ele seja perdido de forma definitiva, você perderá 2d8 de Sanidade permanente. NASCIDO DO OUTRO LADO. Por contato prévio com a Ordem, você é uma figura de confiança. Você recebe +5 de Sanidade e +25 PP.'},
  'Crítico':{pericias:'Artes e Sociedade',poder:'Avaliação Criteriosa',desc:'Você trabalhava na indústria artística, tendo como função tecer críticas para obras, detalhando onde poderiam ter sido melhores para que aprendam e da próxima vez criem produções em uma qualidade superior. De alguma maneira, este trabalho acabou te ligando com o Paranormal, por mais estranho que isso possa parecer.',poder_desc:'Acostumado a realizar avaliações detalhadas, encontrando as falhas em obras, você consegue fazer o mesmo na movimentação de seres. Ao gastar uma ação completa e 2 PE pode avaliar um inimigo em alcance curto. Até o fim da cena, você recebe uma ação especial defensiva extra contra este inimigo. OLHAR ANALÍTICO. Você pode realizar críticas construtivas aos membros de seu grupo, permitindo que melhorem de forma rápida e efetiva. Você pode gastar uma reação e 2 PE para fornecer +2 no teste de um aliado em alcance médio.'},
  'Cuidador':{pericias:'Adestramento ou Diplomacia, e Medicina',poder:'Acalentar A Fúria',desc:'Você cuidava de pessoas ou animais, normalmente crianças, cães, idosos, gatos ou pessoas que necessitam de suporte para poderem sobreviver decentemente. Talvez por ter cuidado de um antigo agente, ou por ter oferecido seu serviço para membros da Ordem, acabou se deparando com o Paranormal.',poder_desc:'Acostumado a lidar com a birra daqueles que tem de cuidar, você aprendeu a como acalmar tal fúria. Você pode gastar uma ação de movimento e 2 PE para fazer um teste de Diplomacia (ou Adestramento, no caso de animais) para acalentar um alvo adjacente que esteja enfurecido, em frenesi ou qualquer tipo de perda de controle (exceto Enlouquecendo). Compare o resultado com a DT do efeito que deixou o alvo de tal maneira. Se passar, ele retomará o controle de seu corpo. Ao invés do normal, se usada em um alvo que esteja Enlouquecendo, recupera 1 de Sanidade +1 por ponto que superar a DT (máximo 10). ROTINA PROGRAMADA. Ao se cuidar de alguém é sempre útil criar uma rotina, para facilitar a administração do tempo do mesmo e diminuir a resistência em relação a tais cuidados. Você pode gastar uma ação de movimento para lembrar um alvo em alcance curto de realizar uma ação em seu próximo turno. Ele deverá fazer a ação e receberá +2 em seu teste para realizá-la. Porém, caso queira, pode resistir ao efeito com um teste de Vontade (DT PRE +1 por vez que falhou neste teste).'},
  'Dançarino':{pericias:'Acrobacia e Artes',poder:'Música De Batalha',desc:'Vivendo no ritmo da música, você trabalhou usufruindo de seus passos mirabolantes e corpo flexível. Tal propensão artística e acrobática foram são o necessário para que se destaque contra o Paranormal.',poder_desc:'Conforme a música se intensifica, seu ritmo acelera. Ao gastar 2 PE e uma ação de movimento, você assume uma postura de luta dançante. Até o fim da cena, pode realizar ataques utilizando Artes no lugar da perícia indicada. RITMO ESGUIO. A música está tocando e você não tem como ficar parado. Você pode utilizar a Esquiva mesmo que não seja treinado em Reflexos. Além disso, substitui Reflexos por Artes para contabilizar sua Esquiva e ao realizar um teste de Reflexos, pode gastar 1 PE para utilizar Artes no lugar.'},
  'Delinquente':{pericias:'Crime e Vontade',poder:'Caminhos Pouco Ortodoxos',desc:'Você cresceu como um jovem revoltado, realizando pequenos delitos por rebeldia, ou por puro caos. Talvez tenha arrumado algum problema com a Ordem, ou acabou se encontrando com um de seus agentes ao fazer um delito, mas de uma forma ou outra, estas habilidades foram reconhecidas pela organização.',poder_desc:'Acostumado a tentar fazer as coisas de seu jeito, você acabou aprendendo formas de burlar a lei para conseguir o que quer. Você pode gastar uma ação de interlúdio e 2 PE para, com atos ilegais, reproduzir o efeito do poder de uma outra origem, que gaste uma ação de interlúdio ou menos para ser utilizado. Caso o uso envolva algum teste, ele será feito com Crime. REBELDIA INSTITUCIONAL. Sua rebeldia incansável te desloca da sociedade, mas te motiva a seguir seu próprio caminho. Você pode gastar 1 PE para somar sua Presença em uma rolagem de dano.'},
  'Desafiador':{pericias:'Atletismo e Vontade',poder:'Buscando Por Adrenalina',desc:'Você vivia buscando por emoção, sendo um alpinista, parkoureiro ou praticante de esportes radicais, como skydiving. Esta busca por adrenalina constante e falta de medo em relação as consequências de tais ações lhe tornaram o candidato perfeito para missões na Ordem, onde enfrentar seus medos seria algo mais do que necessário.',poder_desc:'Você está sempre buscando por adrenalina, se arriscando ao máximo. Sempre que sofre um dano Massivo e é bem-sucedido em sua resistência, recebe 1d6 PE temporários até o fim da cena. Este efeito só é ativado em situações de perigo real. SEM MEDO DO PERIGO. Você não tem medo do que está em sua frente, sempre o enfrentando de forma direta. Por isso, tem imunidade as condições abalado e apavorado e quando falha em um teste contra um efeito de medo, pode gastar 2 PE para rolá-lo novamente.'},
  'Designer De Produtos':{pericias:'Artes e Tecnologia PROJETO ERGONÔMICO',poder:'Poder de Origem',desc:'Você trabalhava desenvolvendo a forma de produtos, como brinquedos, ferramentas, produtos de decoração, ou bens de consumo. Tal capacidade de projeção e design, atraíram a atenção da Ordem, permitindo que criasse ferramentas para desbravar todas as capacidades do Outro Lado.',poder_desc:'Digamos que a escolhida para ser removida foi o deslocamento, quando uma outra pessoa utilizar o item, ela sofrerá -6m de deslocamento, em vez do normal. PROTÓTIPO. Antes de um produto se tornar vendável, é preciso de muitos testes e os seus são feitos em campo. Escolha um item de até categoria I para ser seu protótipo. Em 25, 45, 65 e 85% de NEX, você pode adicionar um dos benefícios a seguir para o item escolhido. Não é possível trocar o item escolhido e caso ele seja destruído, você deverá gastar 6 meses em Folga da Ordem para recriá-lo. DANOSO. O item possui uma capacidade de causar danos. Ele funciona como uma arma simples de uma mão e pode causar 2d10 de dano corpo a corpo ou 2d8 de dano em um alvo em alcance curto (escolha um dentre os dois). O tipo de dano deve ser definido conforme o objeto criado. MODULAR. O item possui uma capacidade especial e única, como absorver a umidade do ar e poder simular o ritual Transfigurar Água. Este benefício só pode ser adquirido em 85%. MOTIVADOR. Escolha uma habilidade ou ritual, enquanto estiver empunhando ou vestindo o item, ela terá seu gasto em PE diminuído em 1. UTILITÁRIO. Enquanto estiver empunhando ou vestindo o item, você recebe +2 em testes de uma perícia à sua escolha.'},
  'Deslocado No Tempo':{pericias:'Atualidades ou Sobrevivência, e Percepção',poder:'O Passado Está Presente',desc:'Por alguma anomalia no tempo ou em sua vida, você está fora do momento que deveria viver. Seja por ter ficado aprisionado e preservado em gelo, ou por ter sido enviado ao passado por alguma maravilha da ciência, está enorme peculiaridade atraiu a atenção de organizações Paranormais. ESPECIAL. Ao utilizar a regra de O Potencial Comum, está origem não poderá ser escolhida sozinha. Além disso, caso escolha a habilidade O Passado Está Presente, não poderá escolher a perícia Atualidades.',poder_desc:'Você possui conhecimentos geracionais que foram passados geração por geração, mas se perderam com o passar do tempo, como combinações curativas de ervas, receitas irrecuperáveis, ou até mesmo técnicas como a produção do aço damasco. Ao realizar um teste de Artes, Medicina, Ocultismo, Religião ou um teste para fabricar itens, pode uma vez por cena substituir o teste por um teste de Sobrevivência. UM DESLUMBRANTE FUTURO. Você já sabe o que aconteceu, tudo estava registrado na história em seu tempo. Ao fazer um teste de perícia baseada em Intelecto, pode gastar 2 PE para substituí-la por Atualidades. Além disso, quando uma ação de grande impacto na história está prestes a ocorrer, você fica Pasmo por uma rodada, tendo uma visão do futuro que você não viveu, mas que seu eu desta nova linha do tempo viverá.'},
  'Diarista':{pericias:'Atletismo e Percepção',poder:'Ao Seu Dispor',desc:'Você trabalhou grande parte de sua vida cuidando de uma casa ou família, trabalhando como um empregado doméstico ou mordomo. Tendo sempre vivido em um ambiente garboso e luxuoso para todos ao seu redor, menos para você e os demais funcionários. Sendo necessário trabalhar até a exaustão e lidar com tarefas intermináveis e ricos ingratos, você de alguma maneira extraiu um caminho para longe deste lugar, se conectando ao Paranormal.',poder_desc:'Treinado para suprir as necessidades de seus chefes e os auxiliar, você se tornou um ótimo ajudante. Sempre que fornecer um bônus numérico não paranormal para um aliado, pode gastar 2 PE para aumentar o bônus em +1 (ou em +1,5m para deslocamento). CUIDADO IMPECÁVEL. Pela sua grande experiência cuidando e limpando a maior variedade de coisas, você cuida extremamente bem do que é seu. Quando entra em uma cena de combate todos seus itens estão tinindo. Você recebe +2 no teste de ataque e rolagem de dano em seu primeiro ataque da cena, ou +2 de Defesa caso esteja usando uma proteção. Em cenas de investigação, receberá +2 no primeiro teste que utilizar os bônus de um acessório. Este bônus não retorna diretamente na próxima cena, ele deve ser recuperado em uma cena de interlúdio, gastando uma ação para polir.'},
  'Enigmático':{pericias:'Investigação e Vontade',poder:'Cifra De Cesar',desc:'Você passava seu tempo livre resolvendo enigmas, realizando pesquisas e passando horas batendo cabeça com seus amigos em busca de uma solução. Conforme tais capacidades cresceram e se destacaram, a Ordem foi atraída por sua presença.',poder_desc:'Você já decifrou dezenas de mensagens encriptadas, tendo um repertório vasto sobre tais assuntos. Ao gastar uma ação de interlúdio, pode realizar um teste de Investigação para decifrar um texto encriptado ou em outro idioma. A DT será 20 para uma frase, 25 para um parágrafo e 30 para uma página. Para documentos maiores, é necessário gastar sua Folga da Ordem para realizar o teste. ENIGMA DO MILÊNIO. Quando você resolve um enigma, se motiva para continuar e avançar ainda mais. A cada teste bem-sucedido que realizar em uma cena de investigação, recebe um bônus de +1 em seus testes (máximo igual ao seu Intelecto).'},
  'Entregador':{pericias:'Atletismo e Diplomacia',poder:'Clientes Fieis',desc:'Sobrevivendo nas ruas perigosas e ingratas das grandes cidades enquanto vaga em alta velocidade para adquirir trocados suficientes para se sustentar, você foi resiliente e persistiu, atraindo os olhares do Paranormal. ESPECIAL. Por algum motivo, canídeos (ou semelhantes, como o Nidere) causam +1 em rolagens de dano contra você.',poder_desc:'Aqueles tomados pelo consumismo acabaram por virar figurinhas carimbadas em seu dia a dia, recebendo produtos entregues por você todas as semanas. Tendo este contato tão distante, mas próximo, lhe permitiu obter informações simples, mas úteis. Você pode gastar uma ação de interlúdio para realizar um teste de Diplomacia e adquirir informações sobre uma pessoa que viva no bairro em que trabalha (escolha três bairros para formarem sua área de atuação). É possível adquirir um novo bairro ao gastar 2 meses de sua Folga da Ordem. ROTINA INGRATA. Pelas incansáveis horas que precisou passar trabalhando, faça chuva ou faça sol, você se tornou mais resistente. Você recebe +2 em testes de resistência contra efeitos que já tenham lhe atingido antes.'},
  'Espadachim':{pericias:'Luta e Reflexos',poder:'Caminho Da Espada',desc:'Você trabalhava como um esgrimista, professor de artes marciais ou treinava com espadas para manter a tradição de sua família. Treinando de forma incansável, elevou sua capacidade de luta ao extremo, se tornando um membro a ser cobiçado por organizações Paranormais.',poder_desc:'Você segue o caminho de um espadachim, tendo um código próprio para a utilização de sua lâmina. Defina um código (que deve ser aprovado pela pessoa narrando), como só atacar criaturas paranormais, enquanto permanecer com seu código inabalável, você recebe +2 em testes de ataque e rolagens de dano com espadas. Ao descumprir o código, irá além de perder os bônus, ficar Alquebrado até o fim da missão. TEMPO DE TREINO. Você é proficiente em utilizar todos os tipos de espadas e recebe proficiência em Proteções Leves. Caso receba novamente estas proficiências, irá receber, respectivamente, +1 em testes de ataque com espadas ou +1 em Defesa ao usar proteções.'},
  'Espião':{pericias:'Enganação e Furtividade',poder:'Retirada Tática',desc:'Seja para o governo, máfia ou para outra instituição secreta, você se tornou um espião. Uma ferramenta para adquirir informações úteis para as mais poderosas organizações, sendo um membro valioso para Organizações Paranormais.',poder_desc:'Lutar nem sempre é a melhor opção, às vezes é preferível realizar “retiradas estratégicas”. Caso esteja machucado, pode gastar uma ação completa e 2 PE para criar um plano de fuga. Você recebe, até o fim da cena, +3m de deslocamento e uma ação de movimento extra todos os turnos. VIVENDO NAS SOMBRAS. Tendo treinado para ser imperceptível e se misturar dentre os demais, um espião não pode admitir erros. Uma vez por missão, pode gastar 1 PE para mudar o resultado da rolagem de um teste de Enganação ou Furtividade para 20 (este não é um 20 natural). Este uso é recuperado ao participar de uma cena de interlúdio.'},
  'Espiritualizado':{pericias:'Ocultismo e Religião',poder:'Fé Ancestral',desc:'Você é uma pessoa muito espiritualizada, tendo um trabalho relacionado a tais crenças, como um tarólogo ou vidente. Por anos, se conectou de forma cada vez mais profunda com o sobrenatural, até que desvendou suas verdadeiras capacidades.',poder_desc:'Você pode consultar seus ancestrais ou espíritos para lhe guiar em suas buscas. Ao gastar uma ação padrão pode fazer uma pergunta para o universo, que será respondida com sim, não ou inconclusivo. Alternativamente, pode fazer isso para pedir por proteção de seus ancestrais. Caso esteja em um local em que pessoas tenham morrido recentemente, elas podem interferir nos resultados de tal pergunta. Sempre que utiliza esta habilidade, sofre 1d6 de perda de Sanidade +1d6 por vez que a utilizou na mesma missão. SABERES FUTUROS. Você é capaz de utilizar suas conexões espirituais para tentar prever o futuro, lhe permitindo realizar uma pergunta sobre ele, te preparando para poder planejar melhor suas ações. gaste uma ação de movimento e 1 PE, para rolar 1d6, em qualquer resultado diferente de 6, você soma sua Presença no próximo teste feito que tenha correlação com a pergunta na rodada. Alternativamente, pode usar isso para somar sua Presença em sua Defesa até o início de seu próximo turno.'},
  'Famoso Da Internet':{pericias:'Atualidades e Tecnologia',poder:'Coordenação Perfeita',desc:'Você adquiriu fama na internet, seja por aparecer em vídeos que fizeram sucesso, ou por feitos deslumbrantes em jogos, esta fama lhe trouxe contatos inusitados.',poder_desc:'Sua capacidade em jogos te proveram fama, além de reflexos excepcionais. Você recebe +2 em Reflexos e pode gastar 1 PE para usar Agilidade em vez do respectivo atributo em testes de Percepção ou Tecnologia. PÚBLICO NICHADO. Trabalhando em meios nichados, onde uma boa quantia de dinheiro era transitada, você conseguiu com certa facilidade adquirir parcerias e descobrir podres de pessoas em seu nicho. Escolha um nicho, como, por exemplo, futebol. Você recebe +2 em todos os testes direcionados ao seu nicho (como no caso futebol) e pode como uma ação de interlúdio estabelecer contato com uma pessoa relevante desta indústria (um jornalista ou dirigente de time).'},
  'Fanático':{pericias:'Uma perícia de Intelecto relacionada a sua fixação e Vontade',poder:'Discussões Revigorantes',desc:'Você é uma pessoa fanática por algo, seja uma banda, série, pessoa ou qualquer assunto minimamente interessante. Por esse motivo, conhece de tudo sobre este algo, sendo um verdadeiro especialista no assunto.',poder_desc:'Caso esteja falando sobre sua fixação, você pode utilizar Intelecto no lugar de Presença para testes de Diplomacia, Enganação ou Intimidação. Além disso, sempre que passar em um destes testes, recupera 1 PE. HIPERFIXAÇÃO. Escolha um assunto para ser o foco de sua fixação. Você pode utilizar os mesmos efeitos que Perito para testes relacionados com este assunto.'},
  'Ferreiro':{pericias:'Fortitude e Profissão (Armeiro)',poder:'Armas Bem-Feitas',desc:'Você era um armeiro, trabalhando na criação de armas, principalmente para coleções ou para roupagens específicas. Para abastecer os arsenais da Ordem, foi chamado para forjar ainda mais itens.',poder_desc:'Você já fez muitas armas, tendo uma grande bagagem em relação a forja de tais objetos. Por isso, recebe +2 em testes de Profissão (Armeiro) e ao fabricar itens, pode sofrer -10 no teste para fabricar dois itens em vez de apenas 1. Bônus para fabricar e nos itens fabricados por você. CONHECENDO SUA PRÓPRIA OBRA. Sabendo exatamente a capacidade de cada material utilizado em suas criações, você tem um controle sobre elas superior ao das demais pessoas. Ao empunhar uma arma feita por você, recebe +1 em testes de ataque e dano, além disso, ao utilizar uma proteção feita por você, recebe +1 em Defesa.'},
  'Festeiro':{pericias:'Artes e Iniciativa',poder:'Até Cair',desc:'Você vivia na gandaia, se divertindo durante as noitadas de forma consideravelmente irresponsável. Sua alegria e espírito incansável contagiaram todos ao seu redor, atraindo atenção e amigos.',poder_desc:'Acostumado com consumos elevados de álcool e substâncias tão prejudiciais quanto, você consegue se manter de pé independente do que ocorrer. Sempre que sofrer um dano que iria lhe reduzir para 0 PV, pode gastar 2 PE (+1 por uso na mesma missão) para fazer um teste de Vigor (DT 15 + 1 para cada 10 de dano sofrido). Se passar, você fica com 1 PV em vez de ser reduzido a 0. VIRANDO O COPO. Nenhuma bebida sozinha é capaz de te derrubar, afinal, você já bebeu todas. Você é capaz de utilizar um item consumível com uma ação menor que o normal (completa para padrão, padrão para movimento, movimento para livre).'},
  'Filósofo':{pericias:'Ciências e Religião',poder:'Autoconsciência',desc:'Você era um estudante de filosofia, passando seus dias desbravando a nossa existência e a sociedade que criamos. Em tais pesquisas e reflexões, se deparou com algo incompreensível, um conceito que revoga tudo que você tinha como verdades.',poder_desc:'Você já refletiu muito sobre o mundo e sua existência, sabendo o quão profundo estes conhecimentos podem atingir sua mente. Por isso, pode sacrificar 1d6 de Sanidade para receber 2 de RD até o fim da cena. É possível aumentar o bônus em +2 ao sacrificar +1d6 de Sanidade (máximo de dados igual à seu Intelecto). REFLEXÃO PROFUNDA. Das profundezas de sua mente, você é capaz de refletir sobre suas ações e se motivar para executá-las. Ao gastar uma ação padrão e 1d4 de Sanidade, você fecha seus olhos, enxergando apenas a verdade. Até o início de seu próximo turno, você fica cego. No momento que perder esta condição, irá receber 1d4 PE temporários e +1d20 em atributos mentais até o fim da cena.'},
  'Físico Nuclear':{pericias:'Ciências e Forti-    tude',poder:'Eu Virei A Morte',desc:'Você era um físico nuclear, trabalhando diariamente com as interações atômicas e suas propriedades. Tais estudos lhe levaram a decifrar segredos da realidade, se deparando com o Outro Lado.',poder_desc:'Ao se preparar para enfrentar o Paranormal, desenvolveu utilizou de seu conhecimento para desenvolver uma capacidade única. Você pode gastar uma ação de interlúdio para modificar um ritual ou um item. Faça um teste de Ciências (DT 15 +5 por categoria do item ou círculo do ritual). Se passar, todo o dano de Energia causado por aquele ritual ou item será mudado para Químico. Além disso, ao causar dano Químico, o dado de dano irá aumentar em uma categoria (d10 para d12, d8 para d10, d6 para d8, etc). Por exemplo se causava 6d10 de dano, irá passar a causar 6d12. MATERIAIS RADIOATIVOS. Em múltiplos experimentos você teve de lidar com radiação sendo expelida dos experimentos, lhe fornecendo resistência para tal. Você recebe +2 em testes de Fortitude e 5 + Vigor de RD Químico.'},
  'Fisioterapeuta':{pericias:'Atletismo e Medicina',poder:'Exercícios Preventivos',desc:'Você trabalhava realizando fisioterapia em pessoas, fazendo massagens ou outros métodos semelhantes de relaxamento, tirando o estresse do corpo das pessoas. Talvez tenha adentrado na Ordem para cuidar dos membros feridos, ou para se vingar das feridas que fizeram em você.',poder_desc:'Para prevenir que lesões ocorram, treinos podem ser feitos para preparar o físico de seus aliados. Caso você e um aliado gastem uma ação de interlúdio, você pode fazer uma sessão de fisioterapia/massagem em um personagem, para prepará-lo para a ação. Ele recebe +2 em testes baseados em atributos físicos na próxima cena de combate ou perseguição. RELAXAMENTO CORPORAL. Você faz uma massagem rápida em um aliado, adjacente. Gaste uma ação de movimento e 2 PE, o alvo recebe uma quantia de PV temporários igual ao seu valor de Intelecto. Além disso, caso ele esteja sob efeito das condições Debilitado ou Exausto, elas mudam respectivamente para Fraco e Fatigado. Caso esteja sob as condições Fraco ou Fatigado, irá perdê-las.'},
  'Forasteiro':{pericias:'Profissão e Sociedade',poder:'Aprendendo Novas Culturas',desc:'Vindo de outro país, você estava deslocado em uma nova cultura, que por algum motivo lhe atraiu ao ponto de fazê-lo permanecer nesta nação. De alguma forma, suas aventuras neste novo país te levaram a conhecer o Paranormal.',poder_desc:'Advindo de outra nação, você precisou se preparar e se adaptar para os pontos mais imprevisíveis de sua viajem. Uma vez por cena, pode ao realizar um teste de perícia gastar 1 PE para se tornar treinado nela. Além disso, recebe +2 espaços em seu inventário. EQUIPAMENTO IMPORTADO. Escolha um item à sua escolha que seja incomum de ser encontrado no Brasil e possa ser adquirido facilmente em seu país. O primeiro destes itens que você ou um aliado adquirir em uma missão tem sua categoria diminuída em um.'},
  'Gerente':{pericias:'Diplomacia e Intimidação',poder:'Estagiário',desc:'Você era líder de um setor ou empresa, liderando dezenas de funcionários que trabalhavam à sua disposição. Seu tempo e contatos no mercado acabaram por levá-lo a conhecer o Paranormal.',poder_desc:'Você sempre tem um funcionário ao seu dispor para lhe acompanhar. Uma vez por missão, pode gastar 1 minuto para fazer uma ligação, em 1d4+1 cenas, você receberá um aliado de um tipo à sua escolha que o acompanhará até o fim da missão. Sempre que você sofrer dano, role 1d20, caso a rolagem seja 5 ou menos, o aliado irá te abandonar. Se o resultado for 1, ele sofrerá o dano em seu lugar, o anulando e morrendo. Caso seu aliado morra, você não poderá usar essa habilidade por 1d3 missões. FAÇAM DIREITO!. Comandar faz parte de seu trabalho, conseguindo extrair um desempenho primoroso de seus funcionários. Você pode gastar 2 PE para fornecer +1 em testes de perícia para aliados dentro do alcance ou +2 para um aliado no alcance à sua escolha até o fim da cena. O alcance desta habilidade é definido pela ação gasta para utilizá-la. Caso seja uma ação de movimento, o alcance será curto. Para uma ação padrão, será médio e para uma completa, será longo.'},
  'Guerrilheiro':{pericias:'Luta ou Pontaria, e Sobrevivência',poder:'Guerra Na Mata',desc:'Você era um membro de uma organização militarizada não governamental, que guerreava pela justiça de sua população. Graças a esta vontade por justiça, foi recrutado para ajudar o povo de outra maneira, enfrentando o paranormal.',poder_desc:'Acostumado a lutar em floresta densas, em combates de resistência, enfraquecendo seus inimigos. Você recebe +2 em testes para criar armadilhas, e em florestas, recebe +2 em Furtividade e pode substituir testes de Investigação por Sobrevivência. LUTANDO POR UM IDEAL. Para lutar em ambientes tão hostis, é preciso estar preparado para se defender. Por isso, recebe Proficiência em Proteções Pesadas.'},
  'Guia Turístico':{pericias:'Atualidades e Sociedade',poder:'Apresentando A Cidade',desc:'Você trabalhava como um guia turístico, mostrando cidades, museus e pontos turísticos para os visitantes, aprimorando suas experiências nestes locais. Provavelmente em uma destas apresentações, se deparou com algo incomum, um fenômeno inexplicável que mudou sua vida para sempre.',poder_desc:'Acostumado a estudar previamente locais para poder apresentá-los, sabendo exatamente onde e como adquirir as informações que deseja. Ao receber uma missão, pode utilizar o tempo durante a viagem para se preparar para o local onde acreditam que a missão irá se passar. Ao fazer isso, recebe a capacidade de, enquanto permanecer no local previamente determinado, poder, ao realizar um teste de Atualidades, Diplomacia, Enganação, Investigação, Sobrevivência ou Sociedade, gastar 1 PE para receber +1d20. JOIAS OCULTAS. Guias turísticos são ótimos em convencer pessoas a visitar locais em suas viagens ou até mesmo contar para moradores locais de lugares pouco conhecidos de onde vivem, joias ocultas em meio a confusão da cidade. Por isso, pode gastar 2 PE para substituir testes de Diplomacia e Enganação por Atualidades.'},
  'Historiador':{pericias:'Investigação e Sociedade',poder:'Relíquias Do Passado',desc:'Apaixonado pela história de nosso mundo, você a vasculhou em seu trabalho, adquirindo um grande conhecimento sobre nosso passado. Estes saberes aprofundados lhe tornaram uma peça valiosa para a Ordem.',poder_desc:'Pelo seu costume em mexer em objetos históricos de extrema importância e delicadeza, a Ordem confia um pouco mais em você do que nos demais. Por isso, tem acesso a objetos amaldiçoados uma patente abaixo do comum para os demais agentes. Caso já tenha atingido a patente comum para os adquirir, pode solicitar uma vez a cada 1d4-1 missões um item amaldiçoado de até categoria II para levar sem ser contabilizado em seu limite. SOLO CONHECIDO. O estudo da história lhe proporcionou um vasto conhecimento sobre as guerras e diferentes estratégias utilizadas nelas. Ao gastar 2 PE, pode substituir testes de Tática por Sociedade. Além disso, ao utilizar Analisar o Terreno, também fornece +2 em testes de ataque para aqueles que usufruírem do bônus descoberto pelo teste.'},
  'Hoteleiro':{pericias:'Atualidades e Percepção',poder:'Certo, Senhor',desc:'Trabalhando em diversos hotéis você presenciou muitos eventos memoráveis. Dentre eles, algo fez sua vida mudar, talvez uma motivação simples ter surgido, ou um acontecimento inexplicável. De qualquer maneira, isso te levou a conhecer o Paranormal.',poder_desc:'Para agradar os ricos tão exigentes, era comum que você tivesse que de alguma maneira inexplicável, conseguir vagas para eles em locais que não deveriam ser possíveis. Ao gastar uma ação de interlúdio e 2 PE, pode conseguir entradas para seu grupo em qualquer restaurante ou grande evento. Entretanto, fazer isso exige utilizar de recursos muitas vezes caros. Na próxima missão que realizar, terá seu limite de crédito diminuído em uma categoria. SUÍTE PRESIDENCIAL. Acostumado a trabalhar para o conforto dos demais, você sabe como preparar um bom descanso. Sempre que você usa a ação descansar em uma cena de interlúdio, todos que também a utilizarem irão recuperar uma quantia extra de PE igual ao seu valor de Presença.'},
  'Humorista':{pericias:'Diplomacia e Enganação',poder:'Cotidiano Fascinante',desc:'Você trabalhava com humor, se apresentando em bares, casas de show, teatros e até mesmo na televisão. Sua maneira de contar histórias e piadas melhoravam o clima nos locais em que estava, animando aqueles ao seu redor. Sendo uma forte ajuda para manter aqueles que encontram com o Paranormal, sãos.',poder_desc:'Acostumado a observar o cotidiano e transformar o caos do mundo em humor, você extraí o melhor do mais simples. Sempre que um aliado rola 1 natural em um teste, você recupera 1 de Sanidade. QUAL A GRAÇA?. Você sabe tirar risadas das mais diversas situações. Caso esteja em um momento de pouca tensão (cenas de interlúdio, tempo entre cenas), pode gastar 4 PE para contar uma piada para seu grupo. Faça um teste de Diplomacia ou Enganação, todos em alcance curto recuperam 1 de Sanidade para cada 10 pontos que possuir no resultado de seu teste (máximo igual a sua Presença). É possível utilizar este efeito em uma cena de tensão gastando uma ação padrão, mas caso o clima não esteja propício, todos ao invés de ganhar Sanidade, perderão (Vontade oposta ao resultado do teste anula).'},
  'Ilusionista':{pericias:'Artes e Enganação',poder:'Mãos Astutas',desc:'Você era um mágico, mimico ou Ilusionista, utilizando suas mãos ágeis para realizar truques ilusórios, enganando seus oponentes. Por esta capacidade e certa afinidade com o místico, encontrar o Paranormal não foi nenhuma surpresa.',poder_desc:'Graças aos seus movimentos rápidos e céleres, tem facilidade em fazer truques. Você recebe +1 em Agilidade (máximo 3) e uma Manifestação Primária à sua escolha. TRUQUES SORRATEIROS. Ilusões e truques fazem parte de seu cotidiano, ludibriando pessoas para o entretenimento delas mesmas. Tais habilidades lhe fornecem +2 para fintar e permitem gastar 1 PE para substituir Crime por Artes.'},
  'Ilustrador':{pericias:'Artes e Pontaria',poder:'Gravura Detalhada',desc:'Aqueles capazes de trazer a vida, seus pensamentos e visões mais obscuras e lindas. Uma das profissões mais antigas e importantes para o registro da história humana e igualmente para o estudo do Paranormal.',poder_desc:'Por suas capacidades de ilustração precisas, você é capaz de criar relatórios com ilustrações detalhadas, registrando todas as manifestações que acabaram por se deparar em suas missões. Por isso, recebe +1 PP por missão. Além disso, por tais técnicas, rituais que tenham símbolos desenhados por você tem sua DT aumentada em +1. INSPIRAÇÃO DESLUMBRANTE. As belas visões de sua vida lhe fazem torná-la em arte. Uma vez por missão, pode definir algo belo que presencie como uma visão inspiradora, algo tão belo que deve ser registrado. Você recupera 1d6 PE, mas em sua próxima cena de interlúdio deve gastar uma ação para ilustrar sua visão. Se fizer isso, recupera o uso desta habilidade.'},
  'Incitador Do Paranormal':{pericias:'Artes e Enganação',poder:'Proteção Improvável',desc:'Você fazia algum tipo de produção que incitava o Paranormal a se alastrar pelo mundo (mesmo que não fosse sua intenção). Talvez você fosse um artista, religioso ou político, mas tais histórias mirabolantes inventadas por sua mente, ou alastradas por suas ações, causaram grandes problemas para a realidade. ESPECIAL. Caso escolha esta origem e esteja utilizando O Potencial Comum, não poderá adquiri-la individualmente.',poder_desc:'Por ser um meio de propagação do Outro Lado, ele de alguma maneira tenta lhe proteger, para que permaneça o expandindo. Você recebe, contra efeitos paranormais, RD 5 e +5 em testes de Vontade. Entretanto, esta bonificação perdura por muito pouco. A partir do momento em que começa a enfrentar o Paranormal, este benefício será retirado de você (troque o poder por Vem Pro Pai). Normalmente isso ocorre ao atingir 5% de NEX. VEM PRO PAI. Você criou criaturas, então por qual motivo teme-las? Escolha um elemento, para ter sido o principal abordado em suas histórias. Contra criaturas que tenham este como seu principal elemento, você recebe +5 em testes de Vontade.'},
  'Juiz':{pericias:'Investigação e    Sociedade',poder:'Arbitragem Justa',desc:'Você era um juiz, talvez em esportes, ou até mesmo em uma corte. Passando o dia arbitrando casos ou jogos, você já teve que lidar com todos os tipos de pessoas tendo que tomar decisões independente de seus sentimentos.',poder_desc:'A justiça deve prevalecer, independente das ações dos outros. Afinal, você jurou fazer isso. Sempre que um teste oposto ocorrer em alcance médio, você deve gastar 1 PE para torná-lo o mais justo possível igualando os bônus numéricos que os membros dos testes possuírem. Caso a diferença dos bônus seja 5 ou mais, aquele com maior bônus receberá -2 e o com maior receberá +2. Se não fizer isso, irá perder 1 de Sanidade. JURISPRUDÊNCIA. Decisões precisam ser tomadas a partir do embasamento em ações que ocorreram no passado, se não os mesmos erros que ocorreram no passado podem ser realizados no futuro. Sempre que realiza um teste, pode gastar 3 PE para utilizar novamente o mesmo resultado na rolagem que teve no seu último teste com aquela perícia. Só é possível utilizar novamente esta habilidade em uma perícia, caso você faça uma nova rolagem.'},
  'Linguista':{pericias:'Intuição e Sociedade',poder:'Escritas Ancestrais',desc:'Você trabalhava com linguagens, como um estudante de linguagens, tradutor, editor, etc. Estudando sobre elas, descobriu algo estranho, a linguagem do Outro Lado, os sigilos.',poder_desc:'Você tem um vasto estudo sobre linguagens antigas, sabendo bem como os povos mais ligados ao Paranormal se comunicavam. Você recebe +5 em testes de Sociedade para Decifrar Idiomas e pode utilizar este uso para tentar ler sigilos do outro lado, porém a DT é aumentada em 10 e perde 1 de Sanidade por palavra lida. PADRÕES DE FALA. Tendo desbravado os segredos da língua, sabe como se comunicar de forma previamente estruturada e assertiva. Você pode substituir testes de Diplomacia por Sociedade. Além disso, recebe +1d20 em testes de Sociedade.'},
  'Marido Troféu':{pericias:'Atletismo e Atualidades',poder:'Beleza Desinteressante',desc:'Por ter casado com alguém de grande sucesso que dispensa sua necessidade de realizar trabalhos domésticos ou de qualquer tipo, você teve uma grande quantia de tempo para explorar seus “hobbies”, desde que não te atrapalhassem para sempre manter um físico atraente.',poder_desc:'Por ter sido tratado de forma completamente superficial por tanto tempo, sua Presença passou a ser ignorada, por mais bela que ela fosse. Sempre que uma ameaça tiver múltiplos alvos, você sempre será a última opção possível — exceto quando for o alvo mais óbvio, como, por exemplo, quando tiver sido a maior fonte de dano a ela. ESCULPIDO NO ÓCIO. Você possui um belíssimo corpo, esculpido no tempo livre adquirido enquanto seu cônjuge trabalhava. Por isso, recebe +1 em Presença (máximo 3).'},
  'Mascote':{pericias:'Artes e Acrobacia',poder:'Entrando No Personagem',desc:'Vivendo oculto, fantasiado de um ser que motiva os demais a todo momento e que adquire toda a glória por suas ações, você fez fama, mas nunca foi reconhecido por isso. Ou era o que pensava, até o Paranormal reconhecer o seu potencial.',poder_desc:'Para tornar suas apresentações mais únicas e fiéis, você desenvolveu uma persona para assumir enquanto as realiza. Quando usa Impressionar, você também recebe tais bônus para testes de Acrobacia, Atletismo, Luta, Pontaria e Reflexos. LEVANTANDO O CLIMA. Tendo animado o público em jogos completamente desinteressantes. Uma vez por cena, pode gastar uma ação completa e 3 PE para recuperar 1d4 x sua Presença em Sanidade de um alvo em alcance curto.'},
  'Mecânico':{pericias:'Profissão (Engenheiro) e Tecnologia',poder:'Só Uns Ajustes',desc:'Você passava seus dias consertando automóveis e máquinas motorizadas, muitas vezes as customizando. Por seu trabalho exemplar, acabou se aproximando de organizações secretas, podendo lidar com máquinas mais complexas.',poder_desc:'Você está acostumado a fazer pequenas gambiarras em automóveis para que seus clientes menos afortunados possam continuar rodando enquanto não podem bancar mudanças permanentes. Por isso, caso um item quebre, você pode gastar uma ação completa e 2 PE para remenda-lo. Sempre que utilizar um objeto remendado, existe 25% de chance dele quebrar (1 em 1d4). TURBINANDO. Não há nada que não possa melhorar, principalmente quando falamos de veículos. Você pode definir um veículo para ser seu projeto pessoal, ao levá-lo em missão, o custo em créditos base dele será considerado 50% menor. Além disso, pode gastar sua Folga da Ordem para aprimorá-lo. Faça um teste de Profissão (Engenheiro) (DT 20 +10 por uso anterior). A cada vez que passa, pode adicionar uma modificação no veículo sem que ela aumente seu crédito.'},
  'Meretriz':{pericias:'Diplomacia e Fortitude',poder:'Resistindo Às Adversidades',desc:'A profissão mais antiga da sociedade humana, tendo sido praticada desde o primórdio do convívio social. Tendo trabalhado na maior variedade possível de meios ou locais para conquistar novos clientes, você tem uma adaptabilidade de se invejar, além de uma perseverança admirável.',poder_desc:'Em seu trabalho você precisou lidar com muitas adversidades, passando fome, Frio, ou qualquer outro evento mirabolante que por algum motivo ocorreu com você. Você recebe +2 em testes para resistir a efeitos climáticos, doenças, fome e sede. Além disso, você recebe RD 5 a Frio. SÓ NO AMOR. Para atrair clientes, você dominou a arte da sedução, sendo irresistível. Você recebe +2 em testes de perícias baseadas em Presença contra seres que possam se sentir atraídos por você. Além disso, sempre que realiza um teste oposto com Diplomacia, Enganação ou Intimidação e supera o teste do alvo em 5 pontos ou mais, a atitude dele é aumentada em uma categoria em relação à você.'},
  'Miliciano':{pericias:'Crime e Diplomacia',poder:'Recebendo Com Juros',desc:'Você possui ou possuiu muito dinheiro e fez disso uma maneira de adquirir poder ou influência. Utilizando de meios não muito legais, mas efetivos, você fez seu nome correr pelas ruas até que alcançasse os ouvidos das organizações Paranormais.',poder_desc:'Você é capaz de emprestar parte de seus bens, para exigir com juros em um futuro próximo. Ao iniciar uma missão, pode escolher sacrificar um de seus espaços de item de uma categoria, não o gastando para receber um item nesta missão. Na próxima missão que realizar, irá receber um item extra de uma categoria acima da que emprestou. O item recebido não é de sua escolha, ele é rolado aleatoriamente entre quatro itens diferentes que você deve entregar para a pessoa narrando. É possível sacrificar múltiplos espaços de item por missão, mas não se pode sacrificar espaços em uma missão que você tenha recebido itens por essa habilidade. SORTE NO JOGO. Ministrando casas de aposta, ou até mesmo o Jogo do Bicho, você colocou a sorte de muitos em jogo para beneficiar à sua. Sempre que você e um aliado realizarem um mesmo teste, você pode gastar 1 PE para que ele sofra -1d20 em seu teste e você recebe +1d20. Você pode usar isso em múltiplos aliados para aumentar o seu bônus (máximo igual à metade de sua Presença).'},
  'Modelo':{pericias:'Artes e Intimidação',poder:'Beleza Ofuscante',desc:'Seu corpo é belo, sua postura, exemplar e seu olhar, penetrante. Vivendo das aparências fez seu nome de maneira glamorosa, chamando a atenção de todos e os deslumbrando.',poder_desc:'Sua beleza incomparável distrai as pessoas, como se fosse impossível para elas focarem quando estão perto de você. Na primeira vez que uma pessoa te vê, ela fica ofuscada por 1d4 rodadas. É possível, ao gastar uma ação padrão e 2 PE, fazer um teste de Diplomacia oposto ao teste de Vontade de um alvo Ofuscado para deixá-lo Pasmo por 1 rodada. Modelos são imunes a esta habilidade. OLHAR MATADOR. Seu olhar é tão intimidador que dispensa suas palavras. Por isso, recebe +1d20 em testes de Intimidação e os usos desta perícia tem suas ações diminuídas em um passo para você (completa para padrão, padrão para movimento, etc).'},
  'Muquirana':{pericias:'Diplomacia e Sobrevivência',poder:'Pão Duro',desc:'Você não gosta de desperdiçar seu dinheiro, afinal trabalhou tanto conquista-lo. Muitos diriam que isso te faz chato, outros que é simplesmente um sobrevivente do sistema, mas para a Ordem, você é um agente útil, principalmente em momentos de crise.',poder_desc:'Por se recusar a desperdiçar qualquer mísero resquício de produtos, você consegue usá-los até um ponto que seria impensável. Qualquer item de uso único com você recebe um segundo uso (caso seja possível justificar isso). VAI ME NEGAR UM PRATO DE COMIDA?. Mesmo não necessitando que outros te forneçam seus próprios recursos, sua cara-de-pau em pedi-los nunca foi um impedimento. Uma vez por cena você pode realizar um teste de Diplomacia contrário a um teste de Vontade de uma pessoa em alcance curto. Caso vença, poderá utilizar uma habilidade sem gastar seu custo em PE, tendo eles gastos pelo ser (caso ele não possua PE, ficará Fatigado em vez disso). A cada vez que usa esta habilidade com um mesmo alvo, ele adquire +5 para resistir a este efeito.'},
  'Musicista':{pericias:'Artes e Percepção',poder:'Ouvido Treinado',desc:'A música sempre guiou sua vida como um maestro guia uma orquestra, lhe levando aos seus momentos de ápice mais deslumbrantes. Em um destes momentos, você acabou por se deparar com os perigos do Outro Lado, e o show teve que ser parado momentaneamente.',poder_desc:'Elevando sua adição ao máximo para pegar cada mísero detalhe nas produções que escutava, você tornou seu ouvido extremamente sensível. Você recebe +2 em testes de Percepção para Ouvir. Caso esteja de olhos fechados, este bônus aumenta para +5. VOZEIRÃO. Você possui uma voz poderosa. O alcance de todos os usos de perícias de Presença tem seu alcance aumentados em um passo para você (toque para curto, curto para médio, médio para longo, etc). Esta habilidade pode afetar outras habilidades que façam sentido, como as da trilha Comandante de Campo.'},
  'Nutricionista':{pericias:'Ciências e Medicina',poder:'Alimentação Equilibrada',desc:'Trabalhando para cuidar da saúde de pessoas, você planejava rotinas alimentícias e ajudava as pessoas a adequá-las para suas vidas, tornando-as mais saudáveis. De alguma maneira inimaginável, isto te levou a encontrar o Paranormal, mesmo que sua origem não tenha nenhuma ligação direta à isso.',poder_desc:'Tendo conhecimento aprimorado sobre a composição dos alimentos, é capaz de criar refeições mais balanceadas e saudáveis. Sempre que um aliado utiliza a ação de interlúdio Alimentar-se, ele irá receber além dos bônus uma quantia de PV temporários igual ao seu Intelecto. NUTRIÇÃO. Assim como atletas de diferentes esportes possuem dietas e rotinas de treino diferentes, para se adequar a seus esportes, os membros de organizações Paranormais também podem. Caso você e um aliado gastem o Folga da Ordem, vocês podem criar um plano alimentício e de preparação que será seguido durante este período. Por 1d3 missões, este aliado irá receber +2 em uma perícia à sua escolha relacionada ao treino.'},
  'Olheiro':{pericias:'Intuição e Percepção',poder:'Em Busca De Novos Talentos',desc:'Você trabalhava para algum time de esporte ou seleção, buscando pelas melhores joias brutas para serem lapidadas e utilizadas por sua equipe. Tal capacidade de seleção e observação lhe tornaram uma opção chamativa para ser um futuro recrutador de membros para a Ordem.',poder_desc:'Quando encontra um novo talento, pode fazer com que ele lhe auxilie, gerando um membro promissor para a organização. Ao gastar uma ação de movimento e 1 PE, pode analisar uma pessoa, identificando suas principais qualidades e qual tipo de aliado ela poderia se tornar (atributos e perícias que possui os maiores valores). Ao gastar uma ação de interlúdio, pode recrutar uma pessoa já analisada para a Ordem, se ela aceitar, você poderá em suas próximas missões gastar um espaço de item de categoria I para levá-la como um aliado na missão. LAPIDAR O DIAMANTE. Conhecendo bem os talentos à sua volta, você é capaz de dar direções para lapidá-los. Ao gastar sua Folga da Ordem, você pode direcionar um aliado para um treinamento específico. Se ele gastar o Folga da Ordem dele, para seguir esta recomendação, poderá adquirir um benefício entre: se tornar treinado em uma nova perícia, aumentar seu bônus de uma perícia em +1 ou, caso gaste três vezes a Folga da Ordem, receber um poder extra de sua classe. Alternativamente, caso esteja utilizando a regra alternativa Evolução Natural, você irá fornecer 1 Ponto de Treino extra para ele caso passe.'},
  'Pacifista':{pericias:'Diplomacia e Sociedade',poder:'A Única Opção',desc:'Você estava em busca de um mundo de paz, tentando transformar nossa sociedade em um lugar melhor, você se deparou com o maior impedimento para tal, o Paranormal. Se dedicando para o solucionar, você vem se esforçando para fazer isso de forma não violenta. ESPECIAL. Um personagem que possua esta origem faz de tudo para manter a paz, evitando ao máximo usufruir de métodos violentos. Caso realize algum ato de violência, fica Alquebrado, a cada vez que recebe esta condição novamente, o gasto de PE aumenta em +1.',poder_desc:'Por repudiarem a violência, aqueles que buscam a paz, reduzem todos os danos ao qual são capazes. Por isso, podem ao gastar uma ação completa e 3 PE tentar convencer um ser a não utilizar a violência. Faça um teste de Diplomacia (ou Adestramento para animais e criaturas) contrário a Vontade do alvo. Se o vencer, ele irá reduzir o bônus numérico de seus ataques à metade até o fim da cena. Seres hostis recebem +5 em testes para resistir a esta habilidade e caso passem ficam imunes a este efeito até o fim da missão. FÚRIA DE UM PACIFISTA. Em momentos onde a paz não é uma solução, não existirão palavras bonitas capazes de impedir uma bomba prestes a explodir. Em um momento único de pura fúria, os pacifistas são capazes de liberar toda a raiva que negligenciaram para manter seu ideal vivo e explodir em puro ódio. Quando um aliado morre, você pode reduzir voluntariamente seus PE e Sanidade para 1, sucumbindo a fúria. Durante as próximas 5 rodadas, você +5 em testes, recebe uma ação padrão extra em cada turno, todo dano que sofrer é reduzido à metade e todo dano que causar é maximizado. Entretanto, perderá 1d8 de Sanidade permanente e, até o fim da missão, não poderá mais recuperar PE ou Sanidade.'},
  'Padeiro':{pericias:'Diplomacia e Profissão (Cozinheiro)',poder:'Deixe Fermentar',desc:'Você era um padeiro, trabalhando em uma grande padaria ou tendo a sua própria. Passando o dia fazendo pães e todos os tipos de alimentos vendidos em tais lugares, se acostumou com o calor do forno e com a calmaria no tratamento das massas, para que sempre ficassem fofinhas e suculentas. De alguma maneira, isso te levou ao Paranormal, seja por sorte, ou muito provavelmente por azar.',poder_desc:'Você está acostumado a preparar alimentos por longas horas, deixando o fermento agir por bastante tempo. Caso gaste uma ação de interlúdio, todos que utilizarem a ação de interlúdio alimentar-se nesta cena receberão o dobro dos bônus advindos da refeição especial. ESPERAR CALMAMENTE. Em seus dias passava um bom tempo apenas esperando o resultado do que se esforçou tanto para fazer, torcendo para que fosse satisfatório. Isso e por algum motivo estranho o grande número de brigas que ocorrem em padarias, lhe tornaram alguém muito calmo, capaz de lidar bem com situações de estresse. Caso um aliado adjacente tenha sido alvo de um efeito mental desde seu último turno, você pode gastar uma ação padrão e 2 PE para utilizar a ação acalmar nele (DT igual a do efeito que o alvo falhou + a diferença entre o resultado dele e a DT). Se passar, remove quaisquer bônus, condições e penalidades, provenientes do efeito mental que ainda estejam afetando o alvo.'},
  'Pai/Mãe Solo':{pericias:'Fortitude e Vontade',poder:'Não Posso Desistir',desc:'Você teve que conciliar, os cuidados de sua casa, a criação de seus filhos e uma jornada de trabalho completa, lutando todos os dias para se manter sempre firme. Mesmo que a situação não fosse das melhores, você sempre se manteve persistente, sendo um exemplo de resiliência.',poder_desc:'Tudo que faz é por seus filhos e nada, nem mesmo o Paranormal é capaz de impedir de continuar tentando. Sempre que falha em um teste de Vontade, pode gastar 2 PE para rolar ele novamente, tendo +2 neste segundo teste. JORNADA TRIPLA. Acostumado a ter pouco tempo para descansar e muito o que fazer, você de alguma maneira tirava tempo de onde parecia ser impossível. Em uma cena de interlúdio, você pode gastar 2 PE para ter uma ação extra.'},
  'Pescador':{pericias:'Enganação e Fortitude',poder:'Esperando A Maré',desc:'Você trabalhava em um navio pesqueiro, era um pescador por “hobby” ou pescava para sua sobrevivência. Em tais jornadas de pesca, se deparou com fenômenos inimagináveis, que ninguém acreditaria, ou quase ninguém…',poder_desc:'Acostumado a passar muito tempo somente esperando para que possam finalmente agir, pescadores costumam ser pacientes e atentos. Caso comece uma cena sendo o último da iniciativa, recebe uma ação de movimento extra em seu primeiro turno. Além disso, possui +2 contra efeitos de calor e frio extremo. HISTÓRIAS DE PESCADOR. Conhecidos por suas histórias místicas de aventuras em alto mar, os pescadores têm a capacidade de fascinar facilmente as pessoas. Você é capaz de, ao gastar uma Ação Padrão e 3 PE, fazer um teste de Enganação oposto a Vontade de um ser em alcance curto. Se passar, ele fica Pasmo até o início de seu próximo turno, se falhar, ele ficará imune a esta habilidade por 1 dia. Se já tiver utilizado esta habilidade contra este ser nessa cena, o gasto em PE irá diminuir para 1. Não é possível utilizar esta habilidade em combate.'},
  'Pesquisador Paranormal':{pericias:'Ciências e Ocul-  tismo',poder:'Experimentos Elementais',desc:'Você era um pesquisador ou um simples curioso que acabou por se deparar com manifestações muito pequenas do Paranormal. Ávido por estudá-las acabou por tentar entender seus fundamentos, o que afetou sua mente.',poder_desc:'Você chegou a ter contato com um elemento, estudando e compreendendo suas propriedades. Escolha um elemento Paranormal, você recebe +2 em testes para resistir a efeitos dele, RD 2 a dano deste tipo e +1 de DT ao utilizar rituais deste elemento. Entretanto, por tais experimentos, sua mente foi danificada, por isso, perde 2d4 de Sanidade permanente. PROTO-OCULTISTA. Estudando os conceitos mais básicos do Paranormal, você foi capaz de reproduzir alguns de seus poderes. Escolha uma manifestação primária, você sabe utilizá-la normalmente. Além disso, para cada poder paranormal que adquirir, recebe uma nova manifestação primária, que deve possuir o mesmo elemento do poder recebido.'},
  'Político':{pericias:'Crime e Enganação',poder:'Favores Políticos',desc:'Você era uma figura pública, tendo sido eleito pelo povo por algum motivo que talvez nem mesmo você saiba. Entretanto, isso acabou por lhe trazer diversos benefícios, tendo com isso, descoberto a existência da Ordem.',poder_desc:'Uma vez por missão você é capaz de pedir algum favor para outro político do qual conheça os podres. Como, por exemplo, conseguir o contato de um famoso, arranjar uma viagem para Paris às custas do governo ou semelhante. Para isso, deve contar a ideia ao mestre, que deve classificá-la como Simples, Plausível, Improvável ou Impossível. Caso seja simples, conseguirá realizá-la sem problemas. Se for Plausível, tem 50% de chance de que ela possa ocorrer. Para uma ideia Improvável, existe 20% de chance de conseguir e para uma Impossível, apenas 5%. MANIPULADOR DE INFORMAÇÕES. Para convencer tanto seus eleitores quanto outros políticos de aceitar suas propostas e discursos, você aprendeu as artes da sagacidade e manipulação de sua fala. Por isso, pode ao realizar um teste de Adestramento, Artes, Atualidades, Diplomacia, Intimidação ou Sociedade contrário a um ser, pode gastar 2 PE para substituí-lo por um teste de Enganação.'},
  'Porteiro':{pericias:'Diplomacia e Percepção',poder:'Boca De Túmulo',desc:'Você trabalha em portarias de apartamentos, condomínios, prédios empresariais ou até mesmo em grandes mansões. Em tais locais, nunca foi uma figura de destaque, sendo apenas um observador que está lá para regulamentar as entradas e saídas do local. Talvez por isso, tenha visto mais do que deveria, descobrindo segredos indesejados.',poder_desc:'Mesmo sabendo tantos segredos, você não costuma revelá-los, para sempre manter a confiança daqueles que passam por sua portaria. Sua boca é um túmulo, por isso, recebe +5 em testes para manter informações ocultas. OUVIDOS NAS PAREDES. Por mais que não esteja lá todos os dias para acompanhar as vidas das pessoas, você acaba sabendo de tudo, pois as informações vêm naturalmente para você. Você recebe +5 em testes de Persuasão.'},
  'Powerlifter':{pericias:'Atletismo e Vontade',poder:'Força De Vontade',desc:'Você era um levantador de peso profissional, utilizando de sua força para extrair o máximo de si. Por tais demonstrações de força, foi convocado para a Ordem, para utilizá-la por um bem maior.',poder_desc:'Quando os músculos não são o suficiente, sua vontade prevalece, fazendo superar o limite de suas forças. Caso falhe em um teste de Força ou de uma perícia baseada em Força, pode gastar 2 PE para somar sua Presença ao resultado do teste. MÚSCULOS REFORÇADOS. Você recebe +1 em Força (máximo 3) e recebe +2 espaços em seu inventário.'},
  'Praieiro':{pericias:'Atletismo e Fortitude',poder:'Fritando No Sol',desc:'Você vivia em praias, passando o dia pegando sol, surfando ou trabalhando de alguma maneira lá. Em tais rotinas consideravelmente calmas, viveu aventuras inesquecíveis.',poder_desc:'Acostumado a passar horas no Sol, pegar um bronzezinho não vai ser o que vai te matar. Por isso, recebe RD 5 a Energia e Fogo, +2 em testes para resistir a Calor Extremo e ao Descansar em um local ensolarado, recupera PV como se fosse de uma categoria de descanso melhor. TÁ DANDO ONDA. Você já mergulhou em muitas praias, foi derrubado na água por ondas e até já se afogou algumas vezes, mas todas estas experiências lhe forneceram uma afinidade especial com a água. Você consegue segurar o triplo de seu fôlego na água e pode gastar uma ação de movimento para passar parte das rodadas que ainda tem de fôlego para um aliado adjacente (máximo igual ao Vigor dele). Por fim, passa automaticamente em testes para nadar e caso esteja na água recebe +2 em Iniciativa.'},
  'Prodígio':{pericias:'Intuição e Percepção',poder:'Mente Poderosa',desc:'Você é um gênio, tendo nascido com uma capacidade de aprendizado e raciocínio fora do comum. Por esta capacidade, acabou por descobrir o Paranormal sem muitas dificuldades.',poder_desc:'Você recebe +1 em Intelecto (máximo 3) e todos os poderes têm um pré-requisito de NEX 15% menor para você. PADRÕES LÓGICOS. Você tem uma análise precisa sobre os comportamentos humanos, podendo enxergar seus padrões. Sempre que passa em um teste de perícia baseada em atributos mentais contra um alvo, recebe +1 em tais testes contra ele (bônus máximo igual ao seu Intelecto), entretanto, se falhar, o bônus retorna como -2 (tendo que passar em testes para retornar a escala 0).'},
  'Profissional De R.H.':{pericias:'Intuição e Investigação',poder:'Amenização',desc:'Você trabalhava na área de recursos humanos em uma empresa, tendo como foco a gestão das relações entre membros da mesma e a contratação de novos funcionários. Para selecionar novos membros, você foi convocado como um membro da Ordem.',poder_desc:'Acostumados a entregar noticias ruins, você sabe como amenizar situações. Caso um aliado em alcance curto sofra dano mental, você pode gastar 3 PE para reduzir o dano que ele iria sofrer para o mínimo (como se tivesse rolado 1 em todos os dados de dano). Cada ser só pode ser atingido por esta habilidade uma vez por missão. MELHOR PARA A FUNÇÃO. Para se contratar pessoas, é preciso realizar a difícil tarefa de definir quem será o melhor para a função. Ao utilizar uma habilidade, pode gastar 1 PE para saber exatamente quem será a pessoa mais útil no alcance dela para utilizá-la (apenas pessoas que você seja capaz de ver podem ser alvo deste efeito). Caso o jogador não saiba como definir isso, é recomendado perguntar ao mestre e ao grupo (pois o personagem tem esta capacidade, mas o jogador pode não ter).'},
  'Profissional Incomum':{pericias:'Atualidades e Sobrevivência',poder:'Combinação Única',desc:'Você trabalhava em algum emprego extremamente incomum, como ser uma sereia profissional, manobrista de navios, ou até mesmo ser um limpador de esqueletos de dinossauros. Esta profissão extremamente incomum pode não ter lhe fornecido nenhuma capacidade muito relevante, mas de alguma maneira lhe fez se deparar com o Paranormal.',poder_desc:'Por estar em um trabalho tão único, tem uma combinação singular de habilidades. Escolha duas perícias de acordo ao seu trabalho, você se torna treinado nelas. SUPER ESPECIALIZAÇÃO. Defina um tema detalhado para representar o que você fazia em seu trabalho. Você pode escolher uma habilidade de uma origem à sua escolha conforme o tema escolhido. Por exemplo, caso defina o tema como fingir ser uma sereia, poderá pegar um poder dentre as origens Cosplayer, Mergulhador e Praieiro. Alternativamente, pode em vez disso, ter a capacidade de ao gastar 2 PE receber +5 em testes diretamente correlacionados a sua profissão incomum.'},
  'Publicitário':{pericias:'Ciências e Diplomacia',poder:'Análise De Mercado',desc:'Você era um publicitário trabalhando para fortalecer o nome de sua empresa ou marca. Com isso, aprendeu diversas técnicas para a melhoria da imagem, que podem acabar por ser úteis em missões realizadas em grandes centros.',poder_desc:'Ao analisar o público alvo que está lidando, você tem uma noção boa do que tem interesse. Ao gastar 1 PE e uma ação de movimento, você pode analisar as pessoas ao seu redor, sabendo quais as classes sociais e faixa etária mais prováveis de você estar lidando. Caso faça isso, recebe +1d6 em qualquer teste de Artes, Diplomacia, Enganação ou Intimidação que realizar até o fim desta rodada. FORTALECENDO A IMAGEM. Você sabe como vender um produto e isso pode ajudar ainda mais aqueles que tem o carisma para colocar isso em prática. Ao gastar uma ação de interlúdio, pode preparar um aliado para um discurso. Faça um teste de Ciências (DT 25), se passar, o aliado irá receber +1d6 no próximo teste de Diplomacia que realizar. Este bônus aumenta em +1d6 para cada 10 pontos que superar a DT.'},
  'Químico':{pericias:'Ciências e Profissão (Químico)',poder:'Desequilíbrio Químico',desc:'Em meio a bibliotecas e laboratórios, você estudava os principais fenômenos químicos, decifrando os segredos de nosso mundo. Talvez por isso, tenha desvendado um dos segredos que mais tentam guardar, o Paranormal.',poder_desc:'Ao estudar as fórmulas de objetos, rituais ou semelhantes, você é capaz de alterá-las. Caso gaste sua Folga da Ordem estudando um item, ritual ou manifestação primária, pode realizar um teste de Ciências (DT 20 +5 por círculo que o ritual possuir ou por categoria do item). Se passar, poderá ao utilizar aquele ritual, manifestação primária ou item, você poderá trocar seu tipo de dano para Frio, Fogo ou Químico ao gastar uma ação padrão e 2 PE. Só é possível utilizar este efeito caso o dano original seja de Eletricidade, Fogo, Frio, Paranormal ou Químico. QUÍMICA DO BEM. Em suas experiências mirabolantes, conseguiu desenvolver fórmulas capazes de replicar os principais remédios e venenos. Você pode criar venenos como se fossem itens (DT do teste igual a DT para resistir ao Veneno +5). Além disso, pode produzir dois medicamentos ao gastar apenas uma ação de interlúdio.'},
  'Radialista':{pericias:'Artes e Diplomacia',poder:'Desenrolando O Assunto',desc:'Você trabalhava em um programa de rádio ou podcast, espalhando sua voz por todo o mundo, levando suas opiniões até eles. Talvez por causa desta influência, ou por seu programa proliferar medos e auxiliar no afinamento da membrana, você chamou a atenção da Ordem.',poder_desc:'Acostumado a realizar entrevistas, instigando os entrevistados a falarem mais sobre o que você quer, ou para ajudá-los em seus raciocínios, você sabe como tirar todo o potencial da fala das pessoas. Caso ajude um aliado em um teste de Diplomacia, Enganação ou Intimidação, você pode gastar 3 PE para rolar dois testes para o ajudá-lo (que serão cumulativos). Entretanto, deve ser o único a auxiliar em tais casos. PALAVRAS PROFUNDAS. Quando você fala, suas palavras atingem os demais de maneira mais profunda e chocante. Habilidades utilizadas por você, que dependam do uso da voz, tem sua DT aumentada em +2 e caso gaste +2 PE ao utilizar uma delas, o bônus ou penalidade fornecido por ela será aumentado em 1 (exceto em habilidades que forneçam atributos).'},
  'Reabilitado':{pericias:'Sobrevivência e Vontade',poder:'Já Estive Pior',desc:'Você passou grande parte de sua vida aprisionado por instituições governamentais, seja em reais prisões ou apenas programas de reabilitação. De qualquer maneira, não foram momentos fáceis, tendo muitas vezes que lidar com a precarização de tais lugares e o abuso de poder dos responsáveis por eles. Entretanto, você foi capaz de se reabilitar e retornar para a sociedade.',poder_desc:'Uma vez por missão, pode reduzir uma perda de Sanidade que iria sofrer à metade. Casorealize a ação relaxar, recupera o uso desta habilidade. VIVENDO DE MIGALHAS. Por toda a comida de péssima qualidade que teve de ingerir, você se acostumou com muito pouco. Em cenas de interlúdio, qualquer comida que coma, contará como uma das comidas especiais (Veja capítulo 4 Regras de Jogo). Caso coma uma comida especial, ela recebe um segundo efeito à sua escolha.'},
  'Rejeitado':{pericias:'Furtividade e Vontade',poder:'Presença Ignorável',desc:'Você foi rejeitado durante toda sua vida, seja por sua aparência ou comportamento não conformista com os padrões da sociedade. Tendo problemas para se encaixar, você acabou por recorrer ao isolamento, vivendo uma vida solitária por proteção própria.',poder_desc:'Você nunca chamou muita atenção, mas em alguns momentos isso acabava sendo algo bom. Por isso, recebe +2 em testes de Furtividade e em testes de resistência caso seja o único alvo de uma habilidade. SEM ESPERANÇAS. Você já não tem mais esperança de se encaixar neste mundo, apenas seguindo sua vida como pode. Por isso, sofre -1d20 em testes de Diplomacia, mas ao sofrer dano mental, pode abdicar de fazer o teste para resistir, falhando automaticamente para receber RD 10 ao dano.'},
  'Revisor':{pericias:'Artes e Sociedade',poder:'Ações Revistas',desc:'Você trabalhava como revisor em uma editora, jornal, revista, empresa de comunicação ou como um freelancer. Por isso, é uma pessoa propicia para o trabalho na documentação de missões.',poder_desc:'Caso um aliado falhe em realizar uma ação, você pode gastar uma ação de movimento e 2 PE para analisar o que ele fez de errado e indicar como melhorar. Até o fim da cena, ele recebe +1d20 em testes para realizar aquela ação em específico. REVISÃO COMPLETA. Se estiver próximo do fim de uma missão, em uma cena de interlúdio, você pode revisar todas as pistas que seu grupo adquiriu até agora, organizando e estruturando uma base para o relatório da missão. Ao fazer isso, o grupo irá receber +1d4 PP além do normal, mas apenas caso a missão seja um sucesso.'},
  'Roteirista':{pericias:'Atualidades e uma perícia entre Ciências, Religião e Ocultismo',poder:'Escrevendo Minha Própria História',desc:'Depois de passar tanto tempo escrevendo histórias fictícias, sobre pessoas irreais, heróis fantásticos ou até mesmo descrevendo a vida de cachorros para que todos chorem no final, chegou o momento de escrever sua própria história. E nela, você é o protagonista.',poder_desc:'Tendo estudado as principais estruturas de roteiro e maiores clichês deste ramo, você sabe quando alguma cena marcante está por vir. Como se soubesse que o universo de alguma maneira funciona com um mínimo roteiro. Você pode uma vez por missão identificar características de roteiro em uma cena, apresentando pelo menos duas delas. Ao fazer isso, pode passar automaticamente em um teste à sua escolha relacionado às características. Por exemplo, caso o grupo esteja tentando encontrar um assassino, pode citar um objeto no cenário como uma arma de Tchekov e o fato de a todo momento ter uma pessoa suspeita acompanhando e guiando o grupo para tentar descobrir se ele é o assassino. Se realizar duas cenas de interlúdio esta habilidade poderá ser utilizada novamente. SEGUINDO O ROTEIRO. Acostumado a escrever roteiros detalhados e bem-estruturados, você não costuma improvisar. No início de seu primeiro turno em uma cena, pode gastar 3 PE para definir detalhadamente o que irá fazer até o fim da cena. A cada turno que passar seguindo este roteiro, irá receber +1 em seus testes até o fim da cena, ou até deixar de segui-lo.'},
  'Selvagem':{pericias:'Fortitude e Furtividade',poder:'Bote Do Predador',desc:'Você não cresceu em meio a sociedade, vivendo na natureza, sobrevivendo das presas que conseguia caçar. Vivendo na natureza, a chance de se encontrar com o Paranormal era menor, mas não nula e infelizmente você foi selecionado neste sorteio caótico e injusto.',poder_desc:'Acostumado a caçar em emboscadas, você sabe como finalizar seus alvos com botes matadores. Caso uma pessoa não possa te ver (ou detectar sua presença com outros sentidos), você pode gastar uma ação completa e 1 PE para realizar um bote. Você faz uma investida, porém o ataque realizado conta como uma ação agredir, permitindo múltiplos ataques sejam realizados por este gatilho. Os bônus de investida são adicionados nestes ataques. Por fim, recebe +1d20 de Furtividade em terrenos naturais. METABOLISMO REFORÇADO. Por viver em locais tão hostis para seu corpo, não tendo nenhum tratamento para se recuperar, seu sistema imunológico se tornou cada vez mais eficaz. Por isso, recebe +1 em Vigor (máximo 3) e ao falhar em um teste para resistir a doenças ou venenos, pode gastar 2 PE para rolá-lo novamente.'},
  'Singularidade':{pericias:'Fortitude e Ocultismo',poder:'Anomalia Energética',desc:'Você é uma pessoa impossível, seu nascimento desafia a própria maneira que a interação do Paranormal com a realidade ocorre. Algum elemento Paranormal é simplesmente negado por seu ser. Tendo tais propriedades únicas, você se torna um chamariz do Outro Lado, se encontrando com ele de maneira casual e cotidiana. ESPECIAL. Caso esteja utilizando a regra do Potencial Comum, esta origem deve obrigatoriamente ser escolhida junto de outra.',poder_desc:'Não existe energia ou caos em sua vida, tudo já aparenta ter sido decidido pelo Outro Lado. Você não possui PE, em vez disso, você deve sempre que utilizar uma habilidade em uma cena, rolar um dado. Caso o resultado seja 5 ou menos, você consegue utiliza-la, com limite de PE igual ao que seu NEX possuiria. O dado rolado é 1d4, mas a cada vez que utilizar este efeito o dado usado muda (1d4 muda para 1d6, 1d6 para 1d8, 1d8 para 1d10, 1d12 para 1d20). Se dormir, o dado irá retornar para duas formas anteriores, por exemplo, 1d20 se tornará 1d10. CONHECIMENTO RARO. As informações não ficam registradas em sua mente por muito tempo, elas apenas adentram e fogem de lá rapidamente. No início de cada missão deve definir quais perícias é treinado, veterano e expert, conforme seu NEX e classe. Entretanto, recebe uma perícia treinada a menos por classe. EXCEDENDO A MORTE. Todas as histórias precisam de um fim, mas a sua parece ser interminável. Você é incapaz de morrer. Sempre que entra em morrendo, você perde 1 de Sanidade Permanente para cada rodada que terminar nessa condição. Caso perca as 3 rodadas, você irá ficar inconsciente por 1d4 dias acordando totalmente recuperado. Mas perdendo 2d4 de 1d6 de Sanidade Permanente no processo. Além disso, ao atingir 28 anos você irá parar de envelhercer naturalmente. SANGUE ÚNICO. Seu Sangue possui propriedades especiais calmantes. Você recebe +2 em testes de Vontade. Além disso, pode, uma vez por cena, como uma ação padrão adquirir a condição Sangrando e passar seu sangue em um ser adjacente. Ele irá recuperar 1d4 de Sanidade. Entretanto, caso não esteja com seu valor total de PV, irá atrair todos os seres ligados ao Paranormal a até 1km e sempre ser o alvo prioritário de habilidades utilizadas por criaturas.'},
  'Sobrevivente Oprimido':{pericias:'Atletismo e Fortitude',poder:'Doce Liberdade',desc:'Você era um Escravo, Minerador, ou Sucateiro, trabalhando de forma sub-humana, com quase nenhum direito ou liberdade. De alguma maneira, se libertou deste estado, talvez graças ao Paranormal, ou para enfrentá-lo.',poder_desc:'Você esteve preso por tempo demais, seja fisicamente por correntes ou algemas, ou figurativamente pelos laços abusivos que tinha. Isso despertou em você um desejo insaciável se libertar destas amarras. Você recebe +5 em testes para resistir a efeitos que forneçam as condições de Agarrado, Atordoado, Enredado, Paralisado e Petrificado. EXTRAÇÃO MINERAL. Acostumado a um trabalho braçal intenso, você desenvolveu perfeitamente seus músculos para uma função específica. Ao realizar um crítico contra uma criatura, pode gastar 3 PE para que ela fique vulnerável até o início de seu próximo turno. Além disso, este ataque faz pequenas partes da criatura serem derrubadas, que podem, caso recolhidas, serem utilizadas como um componente ritualístico.'},
  'Sub Empregado':{pericias:'Diplomacia e Profissão',poder:'Persistência Necessária',desc:'Você é um trabalhador como todos os outros, mas a excentricidades do mercado atual te forçaram a seguir um caminho de pequenas negociações com baixíssimas rendas. Mesmo tendo que lidar com tais condições precárias, foi capaz de se desenvolver e chamar atenção de lugares incomuns.',poder_desc:'Por sua necessidade de trabalhar mais que todos, desenvolveu a maior das persistências. A cada vez que falha em tentar algo contra um ser, se torna melhor naquilo. Sempre que ao utilizar um uso de perícia contra um alvo e falhar, aumenta em +1 o seu bônus ao realizar este uso contra ele. POR CONTA PRÓPRIA. Você já está acostumado a viver sozinho, tendo que se virar para fazer com que as coisas funcionassem em sua vida. Caso não tenha aliados adjacentes à você, recebe +1 em Defesa. Se não tiver aliados em alcance curto, recebe +2 e se não tiver aliados em alcance extremo, recebe +5.'},
  'Tatuador':{pericias:'Artes e Fortitude',poder:'Ilustração Irregular',desc:'Você trabalhava marcando permanentemente a pele das pessoas, registrando memórias preciosas em suas peles para que nunca esquecessem. Tal peculiaridade, lhe tornou um membro útil para Ordem, afinal muitos Ocultistas precisam registrar seus rituais em seus corpos.',poder_desc:'Para lidar com a difícil tarefa de desenhar em superfícies tão irregulares como a pele humana, você tem um controle e velocidade ímpares em suas mãos. Você pode gastar sua Folga da Ordem para realizar uma tatuagem de um símbolo paranormal, utilizando de componentes ritualísticos. Ao fazer isso, sempre terá o símbolo com você, não necessitando de componentes para conjurá-lo. Caso esteja utilizando a regra de Conjuração Simbólica, pode ao invés disso, ter a ação necessária para desenhar um símbolo reduzida em um passo (completa para padrão, padrão para movimento, etc). PULSO FIRME. Acostumado a passar horas tatuando, você acabou adquirindo um pulso extremamente firme. Você recebe +2 em testes de Artes. Além disso, caso esteja tentando se segurar em um objeto ou se estiver sendo alvo de uma manobra enquanto está empunhando um objeto, você irá receber +1d20 em testes para resistir a estes efeitos.'},
  'Tripulante':{pericias:'Acrobacia e Vontade',poder:'Poder de Origem',desc:'Você era um trabalhador em navios de cruzeiro, pesqueiros, militares ou até mesmo piratas. Por isso, se acostumou as viagens marítimas, desbravando os mares deste mundo, lidando com seus perigos amedrontadores e lendas de outros mundos.',poder_desc:''},
  'Tripulante':{pericias:'Artes e Enganação',poder:'Controle De Voz',desc:'Você era um trabalhador em navios de cruzeiro, pesqueiros, militares ou até mesmo piratas. Por isso, se acostumou as viagens marítimas, desbravando os mares deste mundo, lidando com seus perigos amedrontadores e lendas de outros mundos. PERÍCIAS TREINADAS. Acrobacia e Vontade. LUTANDO PELO POVO. Como um membro da marinha ou guarda-costeira você viaja pelo mar brandindo a justiça de seu país, seja em guerras contra outros países, ou de piratas causando o caos pelas águas. Em situações como estas, suas maiores forças afloram, conseguindo se sobressair mesmo em emboscadas e com desvantagem numérica. Caso esteja em desvantagem em uma cena de combate, você recebe 2 PV temporários para cada ser que os inimigos possuírem de vantagem numérica. VIVENDO EM ALTO MAR. Tripulantes passam a maior parte de suas vidas no mar, causando a eles algumas mudanças em sua percepção de mundo. Por isso, enquanto estiverem em uma embarcação, recebem +2 em testes de Luta, Acrobacia, Atletismo, Crime, Reflexos, Percepção, Pontaria e Vontade. Entretanto, enquanto estiverem em terra firme, sofrem -2 em Acrobacia, Atletismo e Reflexos. Além disso, possuem a capacidade de segurar o fôlego pelo triplo de tempo embaixo da água.',poder_desc:'Você é capaz de controlar sua voz perfeitamente, podendo fazê-la se propagar sem que você mexa sua boca. Ao utilizar uma ação que necessite de sua fala, você pode gastar 2 PE para que ela não seja considerada uma ação hostil. MANIPULAÇÃO SONORA. A partir de uma habilidade extrema para manipular suas cordas vocais, você consegue modificá-la, para poder interpretar diferentes personagens. Por isso, recebe +2 em testes de Enganação e caso estejam apenas ouvindo sua voz, este bônus irá aumentar para +10.'},
  'Vigia':{pericias:'Iniciativa e Percepção',poder:'Desafiar O Perigo',desc:'Você trabalhava na guarda de uma pessoa, local ou organização, vigiando e a protegendo. Por tais capacidades, foi recrutado para proteger algo ainda mais valioso, a realidade.',poder_desc:'A determinação cega muitas vezes pode ser imprudente, mas é sempre capaz de lhe trazer poder. Você recebe -2 em Defesa e em testes de Reflexos, porém recebe +2 em Vontade e nas demais perícias físicas. ESSA É PELA EQUIPE. Por ter sempre se dedicado à proteção do seu contratante, você se tornou um mestre nisso. Uma vez por cena, quando um aliado, que não está imóvel, é atingido por um efeito, você pode gastar uma reação e 2 PE para correr até ele e empurrá-lo. Ele não será afetado pelo efeito, mas ambos irão ficar caídos. É possível resistir a esta habilidade com um teste de manobra contrário. VENTRÍLOQUO Você era um ventríloquo, talvez por hobbie ou como sua profissão, treinando diariamente para projetar sua voz de maneira imperceptível. Por alguma experiência que teve, se ligou ao Paranormal.'},

  // Origens existentes no dropdown com dados do livro oficial
  'Acadêmico':{
    pericias:'Ciências e Investigação',
    poder:'Saber é Poder',
    desc:'Pesquisador, professor ou cientista. Seu conhecimento teórico aprofundado sobre o mundo natural (e sobrenatural) é seu maior trunfo dentro da Ordem.',
    poder_desc:'Uma vez por cena, pode gastar 2 PE para realizar um teste de Ciências no lugar de qualquer outra perícia intelectual.'
  },
  'Agente de Saúde':{
    pericias:'Ciências e Medicina',
    poder:'Técnicas Medicinais',
    desc:'Médico, enfermeiro, paramédico ou socorrista. Você salva vidas em situações extremas.',
    poder_desc:'Pode usar Medicina como ação de movimento. Uma vez por cena, ao curar, remove uma condição negativa além dos PV.'
  },
  'Artista':{
    pericias:'Artes e Enganação',
    poder:'Magnum Opus',
    desc:'Músico, ator, pintor, escritor. Usa criatividade e carisma para resolver problemas.',
    poder_desc:'1x/missão, determine que uma pessoa reconhece seu trabalho. +5 em testes de Presença contra ela.'
  },
  'Atleta':{
    pericias:'Acrobacia e Atletismo',
    poder:'110%',
    desc:'Esportista de elite, seu corpo é uma máquina perfeitamente treinada. Supera obstáculos físicos.',
    poder_desc:'Gaste 2 PE para +5 em testes de Força ou Agilidade (exceto Luta/Pontaria).'
  },
  'Criminoso':{
    pericias:'Crime e Furtividade',
    poder:'O Crime Compensa',
    desc:'Ladrão, hacker ou vigarista. Conhece os cantos escuros da sociedade.',
    poder_desc:'Ao final da missão, escolha um item para levar à próxima missão sem contar no limite.'
  },
  'Lutador':{
    pericias:'Luta e Reflexos',
    poder:'Mão Pesada',
    desc:'Praticante de artes marciais ou brigão de rua. Seus punhos são armas letais.',
    poder_desc:'+2 em rolagens de dano corpo a corpo.'
  },
  'Mercenário':{
    pericias:'Iniciativa e Intimidação',
    poder:'Posição de Combate',
    desc:'Soldado de aluguel, segurança privado ou ex-militar. Pragmático e eficiente.',
    poder_desc:'Na primeira rodada de combate, gaste 2 PE para uma ação de movimento extra.'
  },
  'Operário':{
    pericias:'Fortitude e Profissão',
    poder:'Ferramenta de Trabalho',
    desc:'Construtor, mecânico ou trabalhador manual. Corpo forjado pelo trabalho duro.',
    poder_desc:'Escolha uma arma simples ou tática usável como ferramenta. +1 ataque, dano e margem com ela.'
  },
  'Policial':{
    pericias:'Percepção e Pontaria',
    poder:'Patrulha',
    desc:'Policial civil, militar ou agente federal. Treinado para proteger e servir.',
    poder_desc:'+2 na Defesa.'
  },
  'Religioso':{
    pericias:'Religião e Vontade',
    poder:'Acalentar',
    desc:'Padre, pastor, monge ou adepto de qualquer fé. Sua crença é um escudo contra o Outro Lado.',
    poder_desc:'+5 em Religião para acalmar. Quando acalma, alvo recupera 1d6 + Presença de Sanidade.'
  },
  'Trambiqueiro':{
    pericias:'Crime e Enganação',
    poder:'Impostor',
    desc:'Vigarista, charlatão ou manipulador nato. Faz qualquer um acreditar em qualquer coisa.',
    poder_desc:'1x/cena, gaste 2 PE para substituir qualquer teste de perícia por Enganação.'
  },
  'Abençoado':{
    pericias:'Religião e Vontade',
    poder:'Crença Reforçada',
    desc:'Abençoado pela fé, banhado por este conceito. Protege-se do Paranormal com a própria mente.',
    poder_desc:'Bônus de Dedicar Sua Fé ou Ritos de Fé são +1 em você. 1x/cena, gaste 1d4 SAN para rolar novamente um teste.'
  },
  'Amnésico':{
    pericias:'Ocultismo e Percepção',
    poder:'Lampejos do Passado',
    desc:'Você não sabe quem era antes. Fragmentos de memória afloram nos piores momentos — ou nos melhores. Sua identidade é um mistério, inclusive para você mesmo.',
    poder_desc:'1x/cena, declare que tem uma informação ou habilidade de seu passado. O Mestre decide o que você lembra, mas nunca algo inútil.'
  },
  'Chef':{
    pericias:'Ciências e Intuição',
    poder:'Sustento e Conforto',
    desc:'Cozinheiro profissional, confeiteiro ou chefe de cozinha. Sua habilidade de improvisar com recursos limitados vai muito além da culinária.',
    poder_desc:'Ao preparar uma refeição durante um interlúdio, você e aliados que comerem recuperam +1d6 de Sanidade e removem a condição Fatigado.'
  },
  'Cultista Arrependido':{
    pericias:'Ocultismo e Religião',
    poder:'Conhecimento Proibido',
    desc:'Você fez parte de um culto ao Paranormal e sobreviveu para contar. Carrega cicatrizes — físicas e mentais — mas também um conhecimento que poucos possuem.',
    poder_desc:'1x/cena, gaste 2 PE para revelar uma fraqueza ou informação sobre uma criatura ou ritual que você reconheça como parte de sua formação ocultista.'
  },
  'Desgarrado':{
    pericias:'Atletismo e Sobrevivência',
    poder:'Andarilho',
    desc:'Sem lar fixo, sem raízes. Você aprendeu a se virar em qualquer ambiente, seja no asfalto ou no mato. Cada lugar é potencialmente um abrigo ou uma armadilha.',
    poder_desc:'Ignora penalidades de terreno difícil natural. 1x/missão, encontra um recurso útil (comida, abrigo, rota de fuga) onde outros não veriam nada.'
  },
  'Engenheiro':{
    pericias:'Ciências e Tecnologia',
    poder:'Improviso Técnico',
    desc:'Engenheiro civil, mecânico, elétrico ou de qualquer área. Sua mente analítica transforma problemas complexos em soluções práticas.',
    poder_desc:'Gaste 1 PE para improvisiar um dispositivo simples ou modificar um equipamento. Teste de Ciências (DT 15) — sucesso fornece +5 no próximo uso relacionado.'
  },
  'Executivo':{
    pericias:'Diplomacia e Intuição',
    poder:'Networking',
    desc:'CEO, diretor ou alto executivo corporativo. Sabe como as engrenagens do poder real giram e como aproveitá-las a seu favor.',
    poder_desc:'1x/missão, acione um contato corporativo para obter informações reservadas, recursos financeiros ou acesso a locais restritos.'
  },
  'Investigador':{
    pericias:'Investigação e Intuição',
    poder:'Evidência Crucial',
    desc:'Detetive particular, jornalista investigativo ou pesquisador do paranormal. Você encontra conexões onde todos os outros veem apenas caos.',
    poder_desc:'1x/cena, após examinar uma cena, faça um teste de Investigação. Com sucesso, o Mestre deve revelar uma pista importante que você não perceberia de outra forma.'
  },
  'Magnata':{
    pericias:'Diplomacia e Enganação',
    poder:'Poder do Dinheiro',
    desc:'Herdeiro, empresário bilionário ou traficante de influência. Seu dinheiro abre portas que estão fechadas para todos os outros.',
    poder_desc:'1x/missão, declare que comprou, subornnou ou providenciou algo de valor até Categoria II. O item ou serviço chega até você antes do fim da cena.'
  },
  'Militar':{
    pericias:'Pontaria e Tática',
    poder:'Disciplina Militar',
    desc:'Soldado, veterano de guerra ou oficial das forças armadas. Treinamento exaustivo te preparou para situações que fariam qualquer civil entrar em colapso.',
    poder_desc:'1x/cena, gaste 2 PE para ignorar uma condição negativa até o fim de seu próximo turno.'
  },
  'Servidor Público':{
    pericias:'Atualidades e Diplomacia',
    poder:'Burocracia a Meu Favor',
    desc:'Funcionário público, político ou agente governamental. Conhece os trâmites legais e burocráticos — e como contorná-los quando necessário.',
    poder_desc:'1x/missão, consiga documentos, autorizações ou acesso oficial a um local ou informação restrita sem testes, desde que haja tempo hábil.'
  },
  'Teórico da Conspiração':{
    pericias:'Ocultismo e Investigação',
    poder:'Sempre Soube',
    desc:'Você nunca acreditou na versão oficial dos fatos. Ironicamente, agora sabe que estava mais certo do que imaginava. Sua paranoia é um trunfo.',
    poder_desc:'1x/cena, declare que já pesquisou sobre a ameaça ou local atual. O Mestre fornece uma informação verdadeira que seu personagem teria obtido antes da missão.'
  },
  'TI':{
    pericias:'Tecnologia e Ciências',
    poder:'Hackear o Sistema',
    desc:'Desenvolvedor, analista de segurança ou hacker. No mundo conectado, quem controla a informação controla tudo.',
    poder_desc:'Gaste 2 PE para acessar sistemas digitais, câmeras, registros ou comunicações eletrônicas. Teste de Tecnologia — a DT varia com a segurança do alvo.'
  },
  'Trabalhador Rural':{
    pericias:'Fortitude e Sobrevivência',
    poder:'Filho da Terra',
    desc:'Agricultor, criador de gado, madeireiro. Seu corpo endurecido e seu conhecimento da natureza te preparam para o que a civilização esqueceu.',
    poder_desc:'+2 em testes de Fortitude. Em ambientes naturais, você e aliados próximos não precisam fazer testes para sobrevivência básica (alimentação, orientação, abrigo).'
  },
  'Universitário':{
    pericias:'Atualidades e qualquer perícia de Conhecimento',
    poder:'Pesquisa Aprofundada',
    desc:'Estudante de graduação ou pós-graduação. Sua imersão acadêmica te deu ferramentas para absorver conhecimento com rapidez impressionante.',
    poder_desc:'1x/missão, após dedicar um interlúdio estudando um tema, trate sua perícia relacionada como Expert para aquele assunto até o fim da missão.'
  },
  'Vítima':{
    pericias:'Percepção e Vontade',
    poder:'Nunca Mais',
    desc:'Você sobreviveu a algo horrível — e esse trauma te transformou. Onde outros veem o inimaginável como impossível, você já sabe que é real.',
    poder_desc:'Quando Abalado ou Apavorado, pode gastar 1 PE para ignorar a condição por 1 rodada. Além disso, +2 em testes de Vontade contra efeitos de Medo.'
  }
};

function renderOrigemDesc(){
  const orig=(document.getElementById('f-origem')||{}).value||'';
  const el=document.getElementById('origem-desc');
  if(!el)return;
  const o=ORIGENS_DB[orig];
  if(o){
    el.innerHTML=`<b style="color:var(--gold-light)">${o.poder}</b> &nbsp;|&nbsp; <span style="color:var(--crimson)"><span class="sym-el sym-conhecimento" title="Conhecimento"></span> ${o.pericias}</span><br>${o.desc}<br><span style="color:var(--white-ash);font-size:.9em">⬝ ${o.poder_desc}</span><div class="desc-click-hint">Ver em tela cheia</div>`;
    el.style.display='block';
    el.onclick=()=>abrirDescPopup(orig, `<b style="color:var(--gold-light)">${o.poder}</b><br><span style="color:var(--crimson-mid)">Perícias: ${o.pericias}</span><br><br>${o.desc}<br><br>${o.poder_desc}`, {subtitulo:'» Origem'});
  } else {
    el.style.display='none';
    el.onclick=null;
  }
}

/* ══════════════════════════════════════════════
   ATRIBUTOS, PV/SAN/PE E ATUALIZAÇÃO DA FICHA
══════════════════════════════════════════════ */
/* Atualiza a barrinha visual de PV/SAN/PE (rework visual da Ficha).
   Também troca a cor da barra (normal → âmbar → vermelho pulsante)
   conforme o percentual restante, pra dar aviso visual de perigo. */
function _updateVitalBars(){
  const c = userChar(currentUser);
  if(!c) return;
  [['pv','pvMax'],['san','sanMax'],['esf','esfMax']].forEach(([k,maxK])=>{
    const bar = document.getElementById('bar-'+k);
    if(!bar) return;
    const max = c[maxK]||1;
    const pct = Math.max(0, Math.min(100, ((c[k]||0)/max)*100));
    bar.style.width = pct+'%';
    bar.classList.remove('warn','crit');
    if(pct <= 25) bar.classList.add('crit');
    else if(pct <= 50) bar.classList.add('warn');
  });
}

/* Recolhe/expande a calculadora de "Receber Dano", que agora vive
   dentro do mesmo painel da barra de vida. Estado é lembrado por
   navegador (localStorage), então cada Mestre/jogador guarda a
   própria preferência. */
function toggleDmgCalc(force){
  const body = document.getElementById('dmg-calc-body');
  const btn  = document.getElementById('btn-dmg-toggle');
  if(!body) return;
  const estaAberto = body.style.display !== 'none';
  const abrir = (typeof force === 'boolean') ? force : !estaAberto;
  body.style.display = abrir ? 'block' : 'none';
  if(btn) btn.textContent = abrir ? '▾' : '▸';
  try{ localStorage.setItem('mp_dmgCalcCollapsed', abrir ? '0' : '1'); }catch(e){}
}
(function(){
  function _initDmgCalcCollapse(){
    let colapsado = false;
    try{ colapsado = localStorage.getItem('mp_dmgCalcCollapsed') === '1'; }catch(e){}
    if(typeof toggleDmgCalc === 'function') toggleDmgCalc(!colapsado);
  }
  document.addEventListener('DOMContentLoaded', ()=> setTimeout(_initDmgCalcCollapse, 60));
})();

function adjStat(stat,d){
  const c=userChar(currentUser);
  c[stat]=Math.max(0,Math.min(c[stat+'Max'],c[stat]+d));
  document.getElementById('s-'+stat).textContent=c[stat];
  _updateVitalBars();
  saveDB();_publishMyStatus();
  if(stat==='pv' && typeof checarMorte==='function') checarMorte(currentUser);
}
function adjMax(stat,d){
  const c=userChar(currentUser);
  c[stat+'Max']=Math.max(1,c[stat+'Max']+d);
  c[stat]=Math.min(c[stat],c[stat+'Max']);
  document.getElementById('s-'+stat).textContent=c[stat];
  document.getElementById('s-'+stat+'max').textContent=c[stat+'Max'];
  _updateVitalBars();
  saveDB();_publishMyStatus();
}
 
/* ══════════════════════════════════════════════
   ATTRS — roda hexagonal (layout inspirado na ficha oficial:
   ATRIBUTOS no centro, os 5 atributos nos vértices ao redor)
══════════════════════════════════════════════ */
const ATTRS=['Agilidade','Força','Intelecto','Presença','Vigor'];
const ATTR_ABBR={Agilidade:'AGI',Força:'FOR',Intelecto:'INT',Presença:'PRE',Vigor:'VIG'};
const ATTR_FULL={AGI:'Agilidade',FOR:'Força',INT:'Intelecto',PRE:'Presença',VIG:'Vigor'};
// Posições em % dentro do wrap (topo, esquerda) — formam o hexágono da ficha oficial
const ATTR_POS={
  Agilidade:{top:'2%', left:'50%'},   // topo
  Força:    {top:'30%',left:'6%'},    // superior-esquerda
  Intelecto:{top:'30%',left:'94%'},   // superior-direita
  Presença: {top:'82%',left:'18%'},   // inferior-esquerda
  Vigor:    {top:'82%',left:'82%'},   // inferior-direita
};
function renderAttrs(){
  const el=document.getElementById('attr-list');if(!el)return;
  el.innerHTML='';
  const c=userChar(currentUser);
  const wrap=document.createElement('div');
  wrap.className='attr-hex-wrap';
  wrap.innerHTML=`
    <svg class="attr-hex-bg" viewBox="0 0 280 240" preserveAspectRatio="xMidYMid meet">
      <polygon points="140,6 262,74 262,178 140,234 18,178 18,74" fill="none" stroke="var(--blood-deep)" stroke-width="1.4"/>
      <polygon points="140,30 234,84 234,168 140,214 46,168 46,84" fill="none" stroke="var(--crimson)" stroke-width="0.6" opacity="0.3"/>
    </svg>
    <div class="attr-hex-center">ATRIBUTOS</div>`;
  ATTRS.forEach(a=>{
    const vv=c.attrs[a]||1;
    const pos=ATTR_POS[a];
    const node=document.createElement('div');
    node.className='attr-node';
    node.style.top=pos.top;node.style.left=pos.left;
    node.innerHTML=`
      <div class="attr-node-circle"><span class="attr-node-val">${vv}</span></div>
      <div class="attr-node-label">${ATTR_ABBR[a]}</div>
      <div class="attr-node-adj">
        <button class="adj" onclick="adjAttr('${a}',-1)">−</button>
        <button class="adj" onclick="adjAttr('${a}',1)">+</button>
      </div>`;
    wrap.appendChild(node);
  });
  el.appendChild(wrap);
}
function adjAttr(a,d){
  const c=userChar(currentUser);
  c.attrs[a]=Math.max(1,Math.min(5,(c.attrs[a]||1)+d));
  renderAttrs();
  // Dados/Bônus das perícias e a Defesa dependem dos atributos — atualiza junto
  if(typeof renderPericias==='function') renderPericias();
  if(typeof renderDefesa==='function') renderDefesa();
  recalcMaxStats();
  saveDB();
}

/* ══════════════════════════════════════════════
   CÁLCULO AUTOMÁTICO DE PV / SAN / PE
   Fórmulas do livro Ordem Paranormal v1.3:

   NEX degraus: 5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,99
   Cada degrau acima do 1º (NEX 5%) adiciona bônus progressivo.

   COMBATENTE  : PV = 20 + VIG + (4+VIG) * degrau
                 SAN= 12 + 3*degrau
                 PE = 2 + PRE + (2+PRE)*degrau
   ESPECIALISTA: PV = 16 + VIG + (3+VIG)*degrau
                 SAN= 16 + 4*degrau
                 PE = 3 + PRE + (3+PRE)*degrau
   OCULTISTA   : PV = 12 + VIG + (2+VIG)*degrau
                 SAN= 20 + 5*degrau
                 PE = 4 + PRE + (4+PRE)*degrau

   Origens adicionam bônus fixos de PV/SAN/PE.
   Trilhas de Ocultista (Conduíte, Flagelador, etc.) modificam PE base.
══════════════════════════════════════════════ */

const NEX_DEGRAUS=[5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,99];

function nexDegrau(nex){
  // Retorna índice do degrau atual (0-based, começa em NEX 5%)
  const n=parseInt(nex)||5;
  let idx=0;
  for(let i=0;i<NEX_DEGRAUS.length;i++){if(n>=NEX_DEGRAUS[i])idx=i;}
  return idx; // 0 = NEX 5%, 19 = NEX 99%
}

// Bônus de origem em PV/SAN/PE
const ORIGEM_BONUS={
  'Acadêmico':        {pv:0, san:4, pe:0},
  'Agente de Saúde':  {pv:4, san:0, pe:0},
  'Amnésico':         {pv:0, san:0, pe:2},
  'Artista':          {pv:0, san:2, pe:2},
  'Atleta':           {pv:4, san:0, pe:0},
  'Chef':             {pv:2, san:2, pe:0},
  'Criminoso':        {pv:0, san:0, pe:4},
  'Cultista Arrependido':{pv:0,san:0,pe:4},
  'Desgarrado':       {pv:2, san:2, pe:0},
  'Engenheiro':       {pv:0, san:0, pe:4},
  'Executivo':        {pv:0, san:4, pe:0},
  'Investigador':     {pv:0, san:4, pe:0},
  'Lutador':          {pv:4, san:0, pe:0},
  'Magnata':          {pv:0, san:4, pe:0},
  'Mercenário':       {pv:4, san:0, pe:0},
  'Militar':          {pv:4, san:0, pe:0},
  'Operário':         {pv:4, san:0, pe:0},
  'Policial':         {pv:2, san:2, pe:0},
  'Religioso':        {pv:0, san:4, pe:0},
  'Servidor Público': {pv:0, san:2, pe:2},
  'Teórico da Conspiração':{pv:0,san:4,pe:0},
  'TI':               {pv:0, san:0, pe:4},
  'Trabalhador Rural':{pv:4, san:0, pe:0},
  'Trambiqueiro':     {pv:0, san:0, pe:4},
  'Universitário':    {pv:0, san:4, pe:0},
  'Vítima':           {pv:0, san:4, pe:0},
  // Legado (index.html antigo)
  'Abastado':         {pv:0, san:4, pe:0},
  'Artista':          {pv:0, san:2, pe:2},
  'Detetive':         {pv:0, san:4, pe:0},
  'Exorcista':        {pv:0, san:0, pe:4},
  'Inventor':         {pv:0, san:0, pe:4},
  'Soldado':          {pv:4, san:0, pe:0},
};

// Trilhas que alteram PE extra no cálculo
const TRILHA_PE_BONUS={
  'Conduíte':           2, // Ocultista: canal amplificado
  'Flagelador':        -2, // Gasta PV em vez de PE
  'Graduado':           0,
  'Intuitivo':          2,
  'Lâmina Paranormal': -2,
};

function calcMaxStats(c){
  const vig = (c.attrs&&c.attrs['Vigor'])||1;
  const pre = (c.attrs&&c.attrs['Presença'])||1;
  const classe = c.classe||'Combatente';
  const nex = parseInt(c.nex)||5;
  const deg = nexDegrau(nex);
  const orig = c.origem||'';
  const trilha = c.trilha||'';

  let pvBase, pvNex, sanBase, sanNex, peBase, peNex;

  if(classe==='Combatente'){
    pvBase  = 20 + vig;
    pvNex   = (4 + vig) * deg;
    sanBase = 12;
    sanNex  = 3 * deg;
    peBase  = 2 + pre;
    peNex   = (2 + pre) * deg;
  } else if(classe==='Especialista'){
    pvBase  = 16 + vig;
    pvNex   = (3 + vig) * deg;
    sanBase = 16;
    sanNex  = 4 * deg;
    peBase  = 3 + pre;
    peNex   = (3 + pre) * deg;
  } else if(classe.indexOf('Criatura Paranormal de ')===0){
    // Classe travada, liberada só ao reviver como criatura paranormal
    // (ver morte.js). PV alto e resistente feito besta, mas a
    // Sanidade sofre — a humanidade ficou pra trás no Véu.
    pvBase  = 24 + vig;
    pvNex   = (5 + vig) * deg;
    sanBase = 8;
    sanNex  = 2 * deg;
    peBase  = 3 + pre;
    peNex   = (3 + pre) * deg;
  } else { // Ocultista e qualquer outro
    pvBase  = 12 + vig;
    pvNex   = (2 + vig) * deg;
    sanBase = 20;
    sanNex  = 5 * deg;
    peBase  = 4 + pre;
    peNex   = (4 + pre) * deg;
  }

  const ob = ORIGEM_BONUS[orig]||{pv:0,san:0,pe:0};
  const trilhaExtra = TRILHA_PE_BONUS[trilha]||0;

  return {
    pvMax : pvBase + pvNex + ob.pv,
    sanMax: sanBase + sanNex + ob.san,
    esfMax: peBase + peNex + ob.pe + trilhaExtra,
  };
}

function recalcMaxStats(silent){
  if(!currentUser) return;
  const c=userChar(currentUser);
  const calc = calcMaxStats(c);

  // Guarda flag de se era manual antes
  if(c._manualStats) return; // modo manual: não recalcula

  const oldPvMax  = c.pvMax;
  const oldSanMax = c.sanMax;
  const oldEsfMax = c.esfMax;

  c.pvMax  = calc.pvMax;
  c.sanMax = calc.sanMax;
  c.esfMax = calc.esfMax;

  // Ajusta valores atuais proporcionalmente se máximo mudou
  if(oldPvMax  && calc.pvMax  !== oldPvMax)  c.pv  = Math.min(c.pv,  c.pvMax);
  if(oldSanMax && calc.sanMax !== oldSanMax) c.san = Math.min(c.san, c.sanMax);
  if(oldEsfMax && calc.esfMax !== oldEsfMax) c.esf = Math.min(c.esf, c.esfMax);

  // Atualiza UI
  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('s-pv',    c.pv);
  setEl('s-pvmax', c.pvMax);
  setEl('s-san',   c.san);
  setEl('s-sanmax',c.sanMax);
  setEl('s-esf',   c.esf);
  setEl('s-esfmax',c.esfMax);
  _updateVitalBars();

  // Atualiza badge de cálculo automático
  const badge = document.getElementById('calc-badge');
  if(badge){
    badge.innerHTML=`<span style="color:#22aa66">⚙ Auto</span> PV:${c.pvMax} SAN:${c.sanMax} PE:${c.esfMax}`;
    badge.style.display='block';
  }
  if(!silent) saveDB();
}

function toggleManualStats(){
  if(!currentUser) return;
  const c=userChar(currentUser);
  c._manualStats = !c._manualStats;
  const btn=document.getElementById('btn-manual-stats');
  const badge=document.getElementById('calc-badge');
  if(c._manualStats){
    if(btn){btn.textContent='MANUAL';btn.style.borderColor='rgba(196,154,0,0.6)';btn.style.color='var(--gold-light)';}
    if(badge){badge.innerHTML='<span style="color:#c49a00">✎ Manual</span>';badge.style.display='block';}
    toast('Modo manual: PV/SAN/PE não serão recalculados automaticamente.','#c49a00');
  } else {
    if(btn){btn.textContent='AUTO';btn.style.borderColor='rgba(139,0,0,0.4)';btn.style.color='var(--white-dust)';}
    recalcMaxStats();
    toast('Modo automático: PV/SAN/PE calculados pelas regras.','#22aa66');
  }
  saveDB();
}
/* ══════════════════════════════════════════════
   ATUALIZAÇÃO AUTOMÁTICA DE FICHA
   Pisca visualmente o que mudou após ações
══════════════════════════════════════════════ */

/* Mapa id-elemento → campo do personagem */
const _STAT_EL_MAP = {
  'pv':  's-pv',
  'san': 's-san',
  'esf': 's-esf',
};

function _flashStatChanges(antes, depois){
  Object.entries(_STAT_EL_MAP).forEach(([key, elId])=>{
    if(antes[key] === depois[key]) return;
    const el = document.getElementById(elId);
    if(!el) return;
    const gained = depois[key] > antes[key];
    const flash  = gained ? '#22ff88' : '#ff4444';
    el.style.transition = 'color .1s';
    el.style.color = flash;
    // Mostra delta flutuante
    const delta = depois[key] - antes[key];
    _showFloatingDelta(el, delta, gained);
    setTimeout(()=>{ el.style.color = ''; el.style.transition = ''; }, 900);
  });
}

function _showFloatingDelta(anchor, delta, gained){
  const sign = delta > 0 ? '+' : '';
  const col  = gained ? '#22ff88' : '#ff5555';
  const d = document.createElement('div');
  d.textContent = sign + delta;
  d.style.cssText = `position:fixed;font-family:'Cinzel Decorative',serif;font-size:16px;font-weight:700;color:${col};pointer-events:none;z-index:9999;text-shadow:0 0 8px ${col};transition:all .8s ease;opacity:1`;
  // Position near the anchor element
  const rect = anchor.getBoundingClientRect();
  d.style.left = (rect.left + rect.width/2 - 12) + 'px';
  d.style.top  = (rect.top - 4) + 'px';
  document.body.appendChild(d);
  requestAnimationFrame(()=>{
    d.style.transform = 'translateY(-28px)';
    d.style.opacity   = '0';
  });
  setTimeout(()=> d.remove(), 900);
}

/* Sincroniza os números exibidos (PV/SAN/PE atuais e máximos) com o personagem.
   NOTA (rework): esta função era chamada em 3 lugares mas nunca existia,
   o que quebrava aplicarDano/aplicarCura/usarRitual com ReferenceError.
   Corrigido aqui. */
function renderStats(){
  const c = userChar(currentUser);
  const setEl=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val;};
  setEl('s-pv',    c.pv);
  setEl('s-pvmax', c.pvMax);
  setEl('s-san',   c.san);
  setEl('s-sanmax',c.sanMax);
  setEl('s-esf',   c.esf);
  setEl('s-esfmax',c.esfMax);
  _updateVitalBars();
}

/* Chama _flashStatChanges + renderStats de uma vez (uso externo) */
function atualizarFicha(antes){
  const c = userChar(currentUser);
  renderStats();
  if(antes) _flashStatChanges(antes, { pv: c.pv, san: c.san, esf: c.esf });
  saveDB();
  _publishMyStatus();
}

/* ══════════════════════════════════════════════
   PERÍCIAS, CONDIÇÕES E HABILIDADES/PODERES
══════════════════════════════════════════════ */
/* ══════════════════════════════════════════════
   PERÍCIAS
══════════════════════════════════════════════ */
const PERICIAS=[
  {nome:'Acrobacia',attr:'AGI'},
  {nome:'Artes',attr:'PRE'},
  {nome:'Atletismo',attr:'FOR'},
  {nome:'Atualidades',attr:'INT'},
  {nome:'Ciências',attr:'INT'},
  {nome:'Crime',attr:'AGI'},
  {nome:'Diplomacia',attr:'PRE'},
  {nome:'Enganação',attr:'PRE'},
  {nome:'Fortitude',attr:'VIG'},
  {nome:'Furtividade',attr:'AGI'},
  {nome:'Iniciativa',attr:'AGI'},
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
  {nome:'Sobrevivência',attr:'INT'},
  {nome:'Tática',attr:'INT'},
  {nome:'Tecnologia',attr:'INT'},
  {nome:'Vontade',attr:'PRE'}
];
const GRAUS=[{label:'—',val:0},{label:'Treinado',val:5},{label:'Veterano',val:10},{label:'Expert',val:15}];

/* Linha da tabela: PERÍCIA | DADOS (valor do atributo) | BÔNUS (total) | TREINO (grau, clicável) | OUTROS (input) */
function _buildPericiaEl(nome, attr, custom){
  const c=userChar(currentUser);
  if(!c.pericias) c.pericias={};
  if(!c.periciasOutros) c.periciasOutros={};
  const grau=c.pericias[nome]||0;
  const grauIdx=GRAUS.findIndex(g=>g.val===grau);
  const next=GRAUS[(grauIdx+1)%GRAUS.length];
  const isOn=grau>0;
  const attrVal=(c.attrs&&c.attrs[ATTR_FULL[attr]])||1;
  const outros=c.periciasOutros[nome]||0;
  const bonus=attrVal+grau+outros;

  const row=document.createElement('div');
  row.className='pericia-row'+(isOn?' on':'');

  const nomeCell=document.createElement('div');
  nomeCell.className='pericia-col-nome';
  nomeCell.textContent=nome;

  const dadosCell=document.createElement('div');
  dadosCell.className='pericia-col-dados';
  dadosCell.innerHTML=`${attrVal}<span class="pericia-attr-tag">${attr}</span>`;

  const bonusCell=document.createElement('div');
  bonusCell.className='pericia-col-bonus';
  bonusCell.textContent=(bonus>=0?'+':'')+bonus;

  const treinoCell=document.createElement('div');
  treinoCell.className='pericia-col-treino';
  treinoCell.title='Avançar grau → '+next.label+' ('+(grau>0?GRAUS[grauIdx].label:'Destreinado')+' atual)';
  treinoCell.innerHTML=`<span class="pericia-treino-btn">${grau}</span>`;
  treinoCell.onclick=()=>{
    const cur=c.pericias[nome]||0;
    const idx=GRAUS.findIndex(g=>g.val===cur);
    c.pericias[nome]=GRAUS[(idx+1)%GRAUS.length].val;
    renderPericias();saveDB();
  };

  const outrosCell=document.createElement('div');
  outrosCell.className='pericia-col-outros';
  const outrosInp=document.createElement('input');
  outrosInp.type='number';outrosInp.value=outros;outrosInp.className='pericia-outros-inp';
  outrosInp.title='Bônus circunstancial (talento, equipamento, etc.)';
  outrosInp.oninput=(e)=>{
    const val=parseInt(e.target.value)||0;
    c.periciasOutros[nome]=val;
    const novoBonus=attrVal+grau+val;
    bonusCell.textContent=(novoBonus>=0?'+':'')+novoBonus;
    saveDB();
  };
  outrosCell.appendChild(outrosInp);

  row.appendChild(nomeCell);
  row.appendChild(dadosCell);
  row.appendChild(bonusCell);
  row.appendChild(treinoCell);
  row.appendChild(outrosCell);

  if(custom){
    const del=document.createElement('button');
    del.className='del-btn pericia-del';del.textContent='×';del.title='Remover perícia';
    del.onclick=(e)=>{e.stopPropagation();delPericia(nome);};
    row.appendChild(del);
  }
  return row;
}
function renderPericias(){
  const el=document.getElementById('pericias-wrap');if(!el)return;
  el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.pericias) c.pericias={};
  if(!c.periciasCust) c.periciasCust=[];
  if(!c.periciasOutros) c.periciasOutros={};
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
  if(c.periciasOutros) delete c.periciasOutros[nome];
  renderPericias();saveDB();toast('Perícia removida.');
}

/* ══════════════════════════════════════════════
   DEFESA / PROTEÇÃO
   Defesa = 10 + AGI + bônus da armadura equipada
══════════════════════════════════════════════ */
function calcDefesa(c){
  const agi=(c.attrs&&c.attrs['Agilidade'])||1;
  let bonusArm=0;
  if(c.armaduraEquipada && typeof ITENS_DB!=='undefined'){
    const arm=ITENS_DB.find(i=>i.id===c.armaduraEquipada);
    if(arm&&arm.defesa) bonusArm=parseInt(arm.defesa)||0;
  }
  return 10+agi+bonusArm;
}
function renderDefesa(){
  if(!currentUser) return;
  const c=userChar(currentUser);
  const defEl=document.getElementById('s-defesa');
  if(defEl) defEl.textContent=calcDefesa(c);
  const protEl=document.getElementById('s-protecao');
  if(protEl){
    let nome='Nenhuma';
    if(c.armaduraEquipada && typeof ITENS_DB!=='undefined'){
      const arm=ITENS_DB.find(i=>i.id===c.armaduraEquipada);
      if(arm) nome=arm.nome;
    }
    protEl.textContent=nome;
  }
}

/* ══════════════════════════════════════════════
   ATAQUES
   Lista automaticamente as armas carregadas no Inventário
   (usando ITENS_DB para dano/crítico/alcance) e permite
   registrar ataques manuais (armas caseiras, improvisadas etc.)
══════════════════════════════════════════════ */
const TESTE_POR_SUBTIPO={fogo:'Pontaria',branca:'Luta'};
function _buildAtaqueRow(arma,teste,dano,especial,customIdx){
  const row=document.createElement('div');
  row.className='ataque-row';
  row.innerHTML=`<div class="ataque-col-arma">${arma}</div>
    <div class="ataque-col-teste">${teste||'—'}</div>
    <div class="ataque-col-dano">${dano||'—'}</div>
    <div class="ataque-col-especial">${especial||'—'}</div>`;
  if(customIdx!=null){
    const del=document.createElement('button');
    del.className='del-btn';del.textContent='×';del.title='Remover ataque';
    del.style.cssText='position:absolute;right:-2px;top:-2px;font-size:12px;background:rgba(10,0,8,0.9)';
    del.onclick=()=>delAtaqueCustom(customIdx);
    row.appendChild(del);
  }
  return row;
}
function renderAtaques(){
  const el=document.getElementById('ataques-wrap');if(!el)return;
  el.innerHTML='';
  if(!currentUser) return;
  const c=userChar(currentUser);
  if(!c.ataquesCust) c.ataquesCust=[];

  const armasInv=(typeof ITENS_DB!=='undefined')
    ? (c.inv||[]).map(it=>it.dbId?ITENS_DB.find(i=>i.id===it.dbId):null).filter(it=>it&&it.tipo==='arma')
    : [];

  if(!armasInv.length && !c.ataquesCust.length){
    el.innerHTML='<div style="color:var(--white-dust);font-size:12px;padding:6px 0;font-family:\'Courier Prime\',monospace">Nenhuma arma no inventário. Adicione uma abaixo, ou carregue armas na aba Inventário.</div>';
    return;
  }
  armasInv.forEach(arm=>{
    const teste=TESTE_POR_SUBTIPO[arm.subTipo]||'Luta';
    const especial=[arm.crit?`Crít ${arm.crit}`:'',arm.alcance?`Alc ${arm.alcance}`:'',(arm.habilidades&&arm.habilidades.length)?arm.habilidades.map(h=>h.nome).join(', '):''].filter(Boolean).join(' | ');
    el.appendChild(_buildAtaqueRow(arm.nome,teste,arm.dam||'—',especial,null));
  });
  c.ataquesCust.forEach((a,i)=>el.appendChild(_buildAtaqueRow(a.arma,a.teste,a.dano,a.especial,i)));
}
function addAtaqueCustom(){
  const arma=document.getElementById('atq-arma').value.trim();
  if(!arma){toast('⛧ Digite o nome da arma.');return;}
  const c=userChar(currentUser);
  if(!c.ataquesCust) c.ataquesCust=[];
  c.ataquesCust.push({
    arma,
    teste:document.getElementById('atq-teste').value.trim()||'Luta',
    dano:document.getElementById('atq-dano').value.trim(),
    especial:document.getElementById('atq-especial').value.trim()
  });
  ['atq-arma','atq-teste','atq-dano','atq-especial'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  renderAtaques();saveDB();toast('Ataque adicionado.');
}
function delAtaqueCustom(i){
  const c=userChar(currentUser);
  if(!c.ataquesCust) return;
  c.ataquesCust.splice(i,1);
  renderAtaques();saveDB();
}
 
/* ══════════════════════════════════════════════
   CONDITIONS
══════════════════════════════════════════════ */
const CONDS=['Abalado','Apavorado','Inconsciente','Sangrando','Exausto','Paralisado','Maldito','Alucinando','Perturbado'];
function renderConds(){
  const el=document.getElementById('cond-grid');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.conds) c.conds={};
  CONDS.forEach(co=>{
    const b=document.createElement('button');
    b.className='cond-chip'+(c.conds[co]?' on':'');
    b.textContent=co;
    b.onclick=()=>{c.conds[co]=!c.conds[co];renderConds();saveDB();};
    el.appendChild(b);
  });
}
 
/* ══════════════════════════════════════════════
   HABS
══════════════════════════════════════════════ */
function renderHabs(){
  const el=document.getElementById('hab-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.habs) c.habs=[];
  if(!c.habs.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px;padding:4px 0">Nenhuma habilidade registrada.</div>';return;}
  c.habs.forEach((h,i)=>{
    const row=document.createElement('div');row.className='list-item';
    const cls=h.t==='p'?'badge-p':h.t==='r'?'badge-r':'badge-h';
    const lbl=h.t==='p'?'Paranormal':h.t==='r'?'Ritual':'Habilidade';
    const descHtml = h.desc ? `<div class="desc-click" onclick="_verDescHabFicha(${i})" style="font-size:14px;line-height:1.6;color:var(--white-dust);margin-top:3px;font-family:'Courier Prime',monospace">${h.desc}<div class="desc-click-hint">Ver em tela cheia</div></div>` : '';
    row.innerHTML=`<div class="list-body"><span class="badge ${cls}">${lbl}</span>${h.nome}${descHtml}</div>
      <button class="del-btn" onclick="delHab(${i})">×</button>`;
    el.appendChild(row);
  });
}
function _verDescHabFicha(i){
  const c=userChar(currentUser);
  const h=c.habs && c.habs[i]; if(!h || !h.desc) return;
  const lbl=h.t==='p'?'⛧ Poder Paranormal':h.t==='r'?'⛧ Ritual':'⚔ Habilidade';
  abrirDescPopup(h.nome, h.desc, {subtitulo:lbl});
}
function addHab(){
  const n=document.getElementById('hab-inp').value.trim();if(!n)return;
  const c=userChar(currentUser);
  if(!c.habs) c.habs=[];
  c.habs.push({nome:n,t:document.getElementById('hab-tipo').value,desc:document.getElementById('hab-desc').value.trim()});
  document.getElementById('hab-inp').value='';document.getElementById('hab-desc').value='';
  renderHabs();saveDB();toast('Habilidade adicionada.');
}
function delHab(i){const c=userChar(currentUser);c.habs.splice(i,1);renderHabs();saveDB();}

/* ══════════════════════════════════════════════
   SISTEMA DE DANO & ARMADURA (RD, aplicar dano/cura)
══════════════════════════════════════════════ */
/* ══════════════════════════════════════════════
   SISTEMA DE DANO & ARMADURA
══════════════════════════════════════════════ */

/* ── Tipos de dano ── */
const TIPOS_DANO = {
  B:  { nome:'Balístico',    emoji:'◈', cor:'#d4a044', grupo:'fisico' },
  F:  { nome:'Físico',       emoji:'†',  cor:'#cc6644', grupo:'fisico' },
  E:  { nome:'Energia',      emoji:'⚛',  cor:'#66aaff', grupo:'paranormal' },
  M:  { nome:'Morte',        emoji:'☠',  cor:'#aa55cc', grupo:'paranormal' },
  S:  { nome:'Sangue',       emoji:'◉',  cor:'#cc2244', grupo:'paranormal' },
  K:  { nome:'Conhecimento', emoji:'▤',  cor:'#44ccaa', grupo:'paranormal' },
  Me: { nome:'Medo',         emoji:'‼',  cor:'#cc9922', grupo:'paranormal' },
};

/* Ícone a mostrar na calculadora de dano: pros 5 elementos "de verdade"
   (Energia/Morte/Sangue/Conhecimento/Medo) usa o mesmo símbolo SVG que
   aparece nas abas de Elementos/Rituais/Relíquias, em vez de emoji. */
const DMG_CALC_ICON = {
  E:  '<span class="sym-el sym-energia" style="width:1.5em;height:1.5em;vertical-align:-5px"></span>',
  M:  '<span class="sym-el sym-morte" style="width:1.5em;height:1.5em;vertical-align:-5px"></span>',
  S:  '<span class="sym-el sym-sangue" style="width:1.5em;height:1.5em;vertical-align:-5px"></span>',
  K:  '<span class="sym-el sym-conhecimento" style="width:1.5em;height:1.5em;vertical-align:-5px"></span>',
  Me: '<span class="sym-el sym-medo" style="width:1.5em;height:1.5em;vertical-align:-5px"></span>',
};
function dmgCalcIcone(tipoKey){ return DMG_CALC_ICON[tipoKey] || (TIPOS_DANO[tipoKey]?TIPOS_DANO[tipoKey].emoji:''); }

/* Qual tipo de rdTipo de armadura protege cada tipo de dano:
   - null  → protege QUALQUER dano físico (B e F)
   - 'B'   → só balístico
   - 'F'   → só físico (armas brancas)
   - 'paranormal' → todos os paranormais (E, M, S, K, Me)
   - key específico (ex: 'Me') → só aquele */
function calcularRD(armadura, tipoDano){
  if(!armadura || !armadura.rd) return 0;
  const rdTipo = armadura.rdTipo;
  const rd     = parseInt(armadura.rd) || 0;

  if(rdTipo === null || rdTipo === undefined){
    // proteção geral física: cobre B e F
    return (tipoDano==='B'||tipoDano==='F') ? rd : 0;
  }
  if(rdTipo === 'paranormal'){
    return (['E','M','S','K','Me'].includes(tipoDano)) ? rd : 0;
  }
  // tipo específico exato
  return rdTipo === tipoDano ? rd : 0;
}

let _dmgTipoAtual = 'F'; // padrão: Físico

function selecionarTipoDano(btn){
  _dmgTipoAtual = btn.dataset.tipo;
  document.querySelectorAll('.dmg-tipo-btn').forEach(b=>{
    const td = TIPOS_DANO[b.dataset.tipo];
    const ativo = b.dataset.tipo === _dmgTipoAtual;
    b.style.background  = ativo ? `rgba(${hexToRgb(td.cor)},0.18)` : 'rgba(19,18,13,0.85)';
    b.style.borderColor = ativo ? td.cor : 'rgba(93,8,8,0.45)';
    b.style.transform   = ativo ? 'scale(1.04)' : 'scale(1)';
  });
  // Mostra qual RD se aplica
  mostrarPreviewRD();
}

function hexToRgb(hex){
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '100,100,100';
}

function mostrarPreviewRD(){
  const c  = userChar(currentUser);
  const arm = c.armaduraEquipada ? ITENS_DB.find(i=>i.id===c.armaduraEquipada) : null;
  const rd  = calcularRD(arm, _dmgTipoAtual);
  const el  = document.getElementById('dmg-resultado');
  if(!el) return;
  if(arm && rd > 0){
    const td = TIPOS_DANO[_dmgTipoAtual];
    el.style.display='block';
    el.innerHTML=`<span style="color:var(--white-dust)">Armadura: <b style="color:var(--gold-light)">${arm.nome}</b> — RD <b style="color:var(--gold-light)">${rd}</b> contra ${dmgCalcIcone(_dmgTipoAtual)} ${td.nome}</span>`;
  } else if(arm){
    const td = TIPOS_DANO[_dmgTipoAtual];
    el.style.display='block';
    el.innerHTML=`<span style="color:var(--white-dust)">Armadura <b style="color:var(--gold-light)">${arm.nome}</b> não protege contra ${dmgCalcIcone(_dmgTipoAtual)} ${td.nome} — RD <b style="color:var(--crimson-mid)">0</b></span>`;
  } else {
    el.style.display='none';
  }
}

function aplicarDano(){
  const raw = parseInt(document.getElementById('dmg-valor').value)||0;
  if(raw <= 0){ toast('Insira um valor de dano maior que 0.'); return; }
  const c   = userChar(currentUser);
  const arm = c.armaduraEquipada ? ITENS_DB.find(i=>i.id===c.armaduraEquipada) : null;
  const rd  = calcularRD(arm, _dmgTipoAtual);
  const td  = TIPOS_DANO[_dmgTipoAtual];
  const danoFinal = Math.max(0, raw - rd);
  const pvAtual   = c.pv ?? 0;
  const pvNovo    = Math.max(0, pvAtual - danoFinal);

  const antes = { pv: c.pv, san: c.san, esf: c.esf };
  c.pv = pvNovo;
  atualizarFicha(antes);
  flashSave('save-ficha');
  if(typeof checarMorte === 'function') checarMorte(currentUser);

  const el = document.getElementById('dmg-resultado');
  el.style.display='block';
  let html = `<div style="margin-bottom:8px;font-size:13px;color:${td.cor};font-family:'Cinzel',serif;font-weight:700;letter-spacing:.08em">${dmgCalcIcone(_dmgTipoAtual)} Dano ${td.nome.toUpperCase()} registrado</div>`;
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin-bottom:10px">`;
  html += `<div style="background:rgba(15,12,10,0.9);border:1px solid var(--blood-deep);padding:8px 10px"><span style="color:var(--white-dust);font-size:9px;letter-spacing:.06em">DANO BRUTO</span><br><b style="color:var(--crimson-mid);font-size:17px">${raw}</b></div>`;
  if(rd > 0){
    html += `<div style="background:rgba(15,12,10,0.9);border:1px solid rgba(164,110,0,0.4);padding:8px 10px"><span style="color:var(--white-dust);font-size:9px;letter-spacing:.06em">RD ARMADURA</span><br><b style="color:var(--gold-light);font-size:17px">−${rd}</b></div>`;
  } else if(arm){
    html += `<div style="background:rgba(15,12,10,0.9);border:1px solid rgba(90,20,20,.3);padding:8px 10px"><span style="color:var(--white-dust);font-size:9px;letter-spacing:.06em">RD ARMADURA</span><br><b style="color:#665;font-size:17px">−0</b><div style="font-size:9px;color:var(--white-dust);margin-top:2px">sem proteção</div></div>`;
  }
  html += `<div style="background:rgba(15,12,10,0.9);border:1px solid ${danoFinal>0?'var(--blood-deep)':'rgba(0,214,97,.4)'};padding:8px 10px"><span style="color:var(--white-dust);font-size:9px;letter-spacing:.06em">DANO FINAL</span><br><b style="color:${danoFinal>0?'var(--crimson-mid)':'#22cc66'};font-size:17px">${danoFinal}</b></div>`;
  html += `<div style="background:rgba(15,12,10,0.9);border:1px solid rgba(0,214,97,.3);padding:8px 10px"><span style="color:var(--white-dust);font-size:9px;letter-spacing:.06em">PV RESTANTE</span><br><b style="color:${pvNovo<=0?'var(--crimson-hot)':pvNovo<(c.pvMax||10)*0.3?'var(--gold-light)':'#22cc66'};font-size:17px">${pvNovo}</b></div>`;
  html += '</div>';
  if(rd > 0) html += `<div style="font-size:11px;color:var(--white-ash)">🛡 ${arm.nome} absorveu ${rd} de dano ${td.nome}.</div>`;
  if(pvNovo <= 0) html += `<div style="margin-top:8px;padding:8px 12px;background:rgba(148,11,11,0.16);border:1px solid var(--blood-deep);color:var(--crimson-hot);font-size:11px;letter-spacing:.04em">⚠ AGENTE INCAPACITADO — PV chegou a 0!</div>`;
  else if(pvNovo < (c.pvMax||10)*0.3) html += `<div style="margin-top:8px;font-size:11px;color:var(--gold-light)">⚠ Estado crítico — menos de 30% de PV restante.</div>`;
  el.innerHTML = html;
}

function aplicarCura(){
  const val = parseInt(document.getElementById('dmg-valor').value)||0;
  if(val<=0){ toast('Insira um valor de cura maior que 0.'); return; }
  const c = userChar(currentUser);
  const pvMax  = c.pvMax || 10;
  const antes  = { pv: c.pv, san: c.san, esf: c.esf };
  c.pv = Math.min(pvMax, (c.pv||0) + val);
  atualizarFicha(antes);
  if(typeof checarMorte==='function') checarMorte(currentUser);
  flashSave('save-ficha');
  const el = document.getElementById('dmg-resultado');
  el.style.display='block';
  el.innerHTML = `<span style="color:#22cc66;font-size:13px;font-family:'Cinzel',serif">✚ Curado ${val} PV → PV atual: <b>${c.pv}</b>/${pvMax}</span>`;
}


