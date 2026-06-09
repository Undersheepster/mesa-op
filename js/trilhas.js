const appTrilhas = {};
/* ══════════════════════════════════════════════
   TRILHAS
══════════════════════════════════════════════ */
const TRILHAS_DATA = {
  Combatente: {
    Aniquilador: {
      desc: 'Especialista em maximizar o dano de uma arma favorita, executando técnicas secretas devastadoras.',
      habs: [
        {nex:'10%', nome:'A Favorita', desc:'Escolha uma arma favorita. A categoria dela é reduzida em I.'},
        {nex:'40%', nome:'Técnica Secreta', desc:'A categoria da arma favorita é reduzida em II. Gaste 2 PE ao atacar para aplicar efeitos: Amplo (atinge alvo adicional adjacente) ou Destruidor (+1 no multiplicador de crítico). +2 PE por efeito adicional.'},
        {nex:'65%', nome:'Técnica Sublime', desc:'Novos efeitos disponíveis: Letal (+2 na margem de ameaça, pode ser escolhido duas vezes para +5) e Perfurante (ignora até 5 pontos de RD do alvo).'},
        {nex:'99%', nome:'Técnica Perfeita', desc:'A arma favorita tem seu multiplicador de crítico aumentado em +1 permanentemente e a margem de ameaça reduzida em –2.'}
      ]
    },
    'Comandante de Campo': {
      desc: 'Líder tático que inspira aliados, concedendo ações e vantagens estratégicas no campo de batalha.',
      habs: [
        {nex:'10%', nome:'Inspirar Aliados', desc:'Gaste 1 PE e uma ação de movimento para que um aliado em alcance curto ganhe +1d20 em seu próximo teste até o início do seu próximo turno.'},
        {nex:'40%', nome:'Manobra Coordenada', desc:'Gaste 1 PE por aliado (limite: Intelecto). No próximo turno dos aliados afetados, eles ganham uma ação de movimento adicional.'},
        {nex:'65%', nome:'Encontrar Fraqueza', desc:'Gaste 2 PE e uma ação de movimento: teste de Tática (DT 30). Se passar, recebe informação que concede vantagem mecânica contra o ser. Pode substituir atributo-base por INT nos ataques.'},
        {nex:'99%', nome:'Oficial de Operações', desc:'Gaste uma ação padrão e 5 PE para que cada aliado em alcance longo receba uma ação completa extra no turno.'}
      ]
    },
    Guerreiro: {
      desc: 'Combatente versátil que domina múltiplas técnicas de batalha corpo a corpo, com foco em bônus de ataque e manobras táticas.',
      habs: [
        {nex:'10%', nome:'Técnicas de Batalha', desc:'Escolha Luta ou Atletismo como perícia treinada. Uma vez por rodada, quando acerta um ataque corpo a corpo, pode gastar 1 PE para realizar uma manobra (derrubar, desarm. etc.) gratuitamente.'},
        {nex:'40%', nome:'Golpe Poderoso', desc:'Quando usa Ataque Especial corpo a corpo, pode escolher causar o bônus como dano adicional em vez de bônus no teste. Além disso, manobras que exigem teste usam +5 no teste.'},
        {nex:'65%', nome:'Ímpeto Guerreiro', desc:'Uma vez por turno, quando derruba ou atordoa um inimigo, pode realizar um ataque adicional como ação livre contra ele ou outro inimigo adjacente.'},
        {nex:'99%', nome:'Fúria Guerreira', desc:'Quando usa Ataque Especial, o bônus de dano ou teste é dobrado. Além disso, acertos críticos em ataques corpo a corpo permitem uma manobra gratuita sem teste.'}
      ]
    },
    'Operações Especiais': {
      desc: 'Agente ágil treinado para operações táticas, com alta iniciativa, mobilidade e ataques furtivos.',
      habs: [
        {nex:'10%', nome:'Iniciativa Aprimorada', desc:'Recebe +5 em testes de Iniciativa. Quando age antes de um inimigo que ainda não agiu, seus ataques contra ele têm margem de ameaça aumentada em +2.'},
        {nex:'40%', nome:'Movimento Tático', desc:'Pode se mover como ação livre uma vez por rodada (até metade do deslocamento) sem provocar ataques de oportunidade. Pode gastar 2 PE para mover o deslocamento total como ação livre.'},
        {nex:'65%', nome:'Ataque Surpresa', desc:'Se agir antes do alvo na iniciativa, seus ataques têm +1d20 e +1 no multiplicador de crítico contra esse alvo até ele agir.'},
        {nex:'99%', nome:'Operador de Elite', desc:'Sempre age em primeiro na iniciativa em caso de empate. Quando faz um acerto crítico, pode realizar um segundo ataque como ação livre (1× por rodada).'}
      ]
    },
    'Tropa de Choque': {
      desc: 'Tanque defensivo que absorve dano e protege aliados, com altíssima resistência física.',
      habs: [
        {nex:'10%', nome:'Resistência de Choque', desc:'Recebe Fortitude ou Intimidação como perícia treinada. Recebe resistência a dano 2 para todos os tipos de dano físico.'},
        {nex:'40%', nome:'Proteção Absoluta', desc:'Uma vez por rodada, quando um aliado adjacente for alvo de um ataque, pode gastar 1 PE para redirecionar o ataque para você. Sua RD aumenta para 5.'},
        {nex:'65%', nome:'Muralha Viva', desc:'Quando fica Machucado, sua RD aumenta para 10 e recebe +2 na Defesa. Aliados adjacentes recebem +2 na Defesa enquanto você estiver de pé.'},
        {nex:'99%', nome:'Inquebrável', desc:'Sua RD aumenta para 15. Quando sua vida cai a 0, pode gastar 5 PE para continuar de pé com 1 PV (1× por missão). Aliados em alcance curto são imunes a efeitos de medo enquanto você estiver ativo.'}
      ]
    }
  },
  Especialista: {
    'Atirador de Elite': {
      desc: 'Especialista em abates à distância com uma única bala certeira, enfraquecendo inimigos com precisão cirúrgica.',
      habs: [
        {nex:'10%', nome:'Um Tiro, Uma Morte', desc:'Recebe treinamento em Pontaria (ou +2 se já treinado). Ao mirar antes de atirar, recebe +5 no teste de ataque e +2 na margem de ameaça nesse disparo.'},
        {nex:'40%', nome:'Disparo Debilitante', desc:'Quando acerta um ataque com arma de fogo, pode gastar 2 PE para debilitar o alvo: ele sofre –1d20 em seu próximo teste de ataque. Pode mirar como ação de movimento.'},
        {nex:'65%', nome:'Atirador Aguçado', desc:'Recebe +10 em Percepção para detectar inimigos. Não pode ser Surpreso nem Vulnerável. O alcance de todas as armas de fogo aumenta em uma categoria.'},
        {nex:'99%', nome:'Mira Perfeita', desc:'Quando realiza um ataque à distância, pode gastar 2 PE para transformar um erro em acerto ou um acerto em crítico.'}
      ]
    },
    Infiltrador: {
      desc: 'Agente das sombras que usa furtividade e golpes cirúrgicos para eliminar alvos desprevenidos.',
      habs: [
        {nex:'10%', nome:'Ataque Furtivo', desc:'Recebe treinamento em Furtividade. Quando ataca um inimigo Desprevenido ou Flanqueado, causa 1d6 de dano extra. Pode se mover sem penalidade em Furtividade.'},
        {nex:'40%', nome:'Assassinato', desc:'Gaste 3 PE e uma ação de movimento para dobrar os dados do Ataque Furtivo contra um alvo analisado até o fim do seu próximo turno.'},
        {nex:'65%', nome:'Golpe Fatal', desc:'Uma vez por inimigo por cena, gaste 3 PE para atacar um alvo Desprevenido com +1d20 e dano do Ataque Furtivo maximizado.'},
        {nex:'99%', nome:'Assassino Perfeito', desc:'Ataques Furtivos são multiplicados em acerto crítico. Ao usar Assassinato, recebe ambas as opções de bônus (Letalidade e Furtividade aprimoradas).'}
      ]
    },
    'Médico de Campo': {
      desc: 'Suporte vital do grupo, especializando em cura, estabilização e manter aliados em combate.',
      habs: [
        {nex:'10%', nome:'Primeiros Socorros', desc:'Recebe treinamento em Medicina. Pode usar Medicina como ação de movimento (normalmente é ação padrão). Testes de Medicina recebem +2.'},
        {nex:'40%', nome:'Triage', desc:'Quando cura um aliado, pode gastar 2 PE para remover uma condição negativa (Abalado, Sangrando etc.) além da cura. Pode estabilizar Mortalmente Feridos como ação livre com 1 PE.'},
        {nex:'65%', nome:'Cirurgião de Campo', desc:'Uma vez por missão por aliado, quando um aliado cairia Inconsciente, pode gastar 4 PE como reação para mantê-lo com 1 PV.'},
        {nex:'99%', nome:'Médico Milagroso', desc:'Quando usa Medicina para curar, cura o máximo possível de PV (sem rolar dados). Pode usar essa habilidade em si mesmo uma vez por cena.'}
      ]
    },
    Negociador: {
      desc: 'Especialista em interação social que usa palavras como armas, controlando NPCs e evitando confrontos.',
      habs: [
        {nex:'10%', nome:'Palavras como Armas', desc:'Recebe treinamento em Diplomacia ou Enganação. Uma vez por cena, pode relançar um teste social falhado (aceita o novo resultado).'},
        {nex:'40%', nome:'Pressão Psicológica', desc:'Gaste 2 PE para fazer um teste de Intimidação ou Diplomacia oposto. Se vencer, o alvo fica Abalado até o fim da cena ou realiza uma ação a seu pedido.'},
        {nex:'65%', nome:'Rede de Contatos', desc:'No início de cada missão, pode declarar um contato local. Uma vez por missão, esse contato fornece informação útil ou item de categoria I sem custo de Prestígio.'},
        {nex:'99%', nome:'Mestre das Palavras', desc:'Pode gastar 5 PE para fazer um humano acreditar em qualquer informação por até 24h (Vontade DT 30 evita). Falha automática em desastres contra testes sociais.'}
      ]
    },
    Técnico: {
      desc: 'Gênio em tecnologia e gadgets, que resolve problemas com dispositivos, hackeamento e improviso.',
      habs: [
        {nex:'10%', nome:'Engenhoca', desc:'Recebe treinamento em Tecnologia. Uma vez por missão, pode criar um gadget improvisado com materiais disponíveis (efeito a critério do Mestre, DT 15).'},
        {nex:'40%', nome:'Hackear Avançado', desc:'Recebe +5 em Tecnologia. Pode hackear sistemas em metade do tempo normal. Uma vez por cena, pode gastar 2 PE para acessar automaticamente qualquer sistema de segurança DT ≤ 20.'},
        {nex:'65%', nome:'Engenharia de Campo', desc:'Pode construir armadilhas ou dispositivos em interlúdio (efeito e DT definidos pelo Mestre). Dispositivos tecnológicos usados por você têm –1 em sua categoria efetiva.'},
        {nex:'99%', nome:'Gênio Técnico', desc:'Uma vez por missão, pode criar um item tecnológico de categoria II ou menos a partir do zero. Pode gastar 5 PE para anular qualquer efeito tecnológico ou eletrônico em alcance curto.'}
      ]
    }
  },
  Ocultista: {
    Conduíte: {
      desc: 'Canal vivo do Outro Lado que amplifica e canaliza energia paranormal com maior intensidade e alcance.',
      habs: [
        {nex:'10%', nome:'Canal Aberto', desc:'Recebe +1 em testes para ativar rituais e pode usar rituais do 1º círculo gastando 1 PE a menos (mínimo 1).'},
        {nex:'40%', nome:'Amplificação Paranormal', desc:'Ao ativar um ritual, pode gastar +2 PE para aumentar seu efeito (dano +1d8, cura +1d8, alcance dobrado, duração dobrada — à escolha do jogador).'},
        {nex:'65%', nome:'Conduíte Puro', desc:'Rituais de seu elemento de afinidade custam –2 PE. Quando usa um ritual com sucesso crítico, recupera 1d6 PE.'},
        {nex:'99%', nome:'Vórtice Paranormal', desc:'Uma vez por cena, pode ativar um ritual como ação livre gastando o dobro do custo em PE. Rituais do seu elemento nunca falham criticamente.'}
      ]
    },
    Flagelador: {
      desc: 'Ocultista que usa rituais de sacrifício e dor própria para potencializar seus poderes paranormais.',
      habs: [
        {nex:'10%', nome:'Sacrifício Ritual', desc:'Pode gastar PV em vez de PE para ativar rituais (1 PV = 1 PE). Recebe treinamento em Ocultismo (ou +2 se já treinado).'},
        {nex:'40%', nome:'Rito Vingativo', desc:'Quando for abatido, um ritual automático abate também quem o derrubou (Vontade DT 25 evita). Nenhum dos dois pode ser levantado até o fim da cena.'},
        {nex:'65%', nome:'Pacto de Sangue', desc:'Ao iniciar uma cena, pode gastar X PV para receber X PE bônus (máx. igual ao seu NEX ÷ 10). Rituais ativados com esses PE bônus têm +5 em seu teste.'},
        {nex:'99%', nome:'Martírio Paranormal', desc:'Quando está Machucado, todos os seus rituais causam dano máximo e custam –3 PE. Efeitos paranormais contra você têm sua DT reduzida em –5.'}
      ]
    },
    Graduado: {
      desc: 'Ocultista versado e equilibrado, mestre em rituais de múltiplos elementos com grande versatilidade.',
      habs: [
        {nex:'10%', nome:'Estudioso do Oculto', desc:'Aprende um ritual adicional de qualquer elemento ao escolher esta trilha. Recebe +2 em testes de Ocultismo.'},
        {nex:'40%', nome:'Versatilidade Ritual', desc:'Pode usar rituais de qualquer elemento sem precisar de afinidade, porém com custo de PE aumentado em +2. Uma vez por cena, escolha entre +1d20 no ataque ou +10 na Defesa.'},
        {nex:'65%', nome:'Domínio Acadêmico', desc:'Rituais fora do seu elemento de afinidade custam +1 PE em vez de +2. Aprende mais dois rituais de qualquer elemento.'},
        {nex:'99%', nome:'Grande Ocultista', desc:'Uma vez por rodada pode usar Versatilidade sem custo adicional. Rituais do seu elemento de afinidade têm seu círculo reduzido em 1 para fins de custo.'}
      ]
    },
    Intuitivo: {
      desc: 'Ocultista que percebe o paranormal instintivamente, com alta iniciativa e capacidade de reagir ao Outro Lado.',
      habs: [
        {nex:'10%', nome:'Sexto Sentido', desc:'Recebe +5 em Iniciativa e +5 em Percepção. Não pode ser Surpreso por criaturas paranormais.'},
        {nex:'40%', nome:'Percepção Paranormal', desc:'Pode sentir a presença de criaturas ou rituais paranormais em alcance médio mesmo sem linha de visão (Ocultismo DT 15). Uma vez por cena, pode agir na iniciativa de qualquer outro personagem.'},
        {nex:'65%', nome:'Reação Instintiva', desc:'Uma vez por rodada, quando um aliado for alvo de um ataque paranormal, pode gastar 2 PE como reação para tentar cancelar o efeito (Ocultismo oposto ao efeito).'},
        {nex:'99%', nome:'Consciência Total', desc:'Nunca é pego de surpresa. Recebe uma reação adicional por rodada, que só pode ser usada contra efeitos paranormais. Sua Iniciativa nunca pode ser reduzida por efeitos externos.'}
      ]
    },
    'Lâmina Paranormal': {
      desc: 'Ocultista combatente que infunde suas armas e ataques com energia paranormal devastadora.',
      habs: [
        {nex:'10%', nome:'Arma Imbuída', desc:'Pode gastar 1 PE para imbuir uma arma com energia paranormal por uma cena. Ataques com essa arma causam dano paranormal adicional igual ao seu Intelecto.'},
        {nex:'40%', nome:'Golpe Ritual', desc:'Quando acerta um ataque com arma imbuída, pode ativar um ritual de 1º círculo como parte do ataque gastando os PE normais. O alvo é afetado pelo ritual automaticamente.'},
        {nex:'65%', nome:'Lâmina do Outro Lado', desc:'Arma imbuída tem margem de ameaça aumentada em +2 e o dano extra aumenta para 2× Intelecto. Rituais ativados com Golpe Ritual têm –1 no custo em PE.'},
        {nex:'99%', nome:'Avatar de Guerra', desc:'Uma vez por cena, pode gastar 6 PE para que todos os seus ataques nessa rodada sejam automáticos críticos com arma imbuída. Rituais de batalha concedem +1d20 nas jogadas de ataque.'}
      ]
    }
  },
  Investigador: {
    'Trilha do Investigador': {
      desc: 'Detetive nato que combina análise forense, intuição e perícia social para resolver qualquer mistério.',
      habs: [
        {nex:'10%', nome:'Olhos de Detetive', desc:'Recebe +2 em Investigação, Percepção e Intuição. Uma vez por cena, ao examinar uma cena de crime ou local suspeito, o Mestre fornece uma pista adicional.'},
        {nex:'40%', nome:'Dedução Fulminante', desc:'Gaste 2 PE e uma ação de movimento para analisar um ser visível. Descobre uma fraqueza ou informação tática (critério do Mestre). Recebe +1d20 em testes contra esse alvo na cena.'},
        {nex:'65%', nome:'Reconstituição de Cena', desc:'Ao passar 10 minutos em um local, pode reconstituir os eventos das últimas 24h (Investigação DT 20). Sucesso crítico aumenta para 72h.'},
        {nex:'99%', nome:'Mente Superior', desc:'Nunca pode ser enganado por Enganação abaixo de 30. Uma vez por missão, pode fazer uma pergunta direta ao Mestre sobre qualquer evento ou ser investigado e recebe a verdade.'}
      ]
    },
    'Trilha do Detetive': {
      desc: 'Investigador de campo especializado em operações encobertas, disfarces e extração de informação.',
      habs: [
        {nex:'10%', nome:'Identidade Falsa', desc:'Recebe treinamento em Enganação. Pode criar e manter identidades falsas convincentes. +5 em testes de Enganação e Diplomacia ao usar um disfarce preparado.'},
        {nex:'40%', nome:'Interrogatório', desc:'Gaste 1 PE para realizar um interrogatório eficiente (5 min). O alvo deve fazer um teste de Vontade (DT 15 + seu Intelecto) ou revelar uma informação verdadeira involuntariamente.'},
        {nex:'65%', nome:'Rede de Informantes', desc:'No início de cada missão, pode declarar 2 contatos em locais relevantes. Cada contato pode fornecer uma informação ou serviço menor gratuitamente (critério do Mestre).'},
        {nex:'99%', nome:'Fantasma de Campo', desc:'Pode entrar e sair de qualquer local com segurança comum sem testes (apenas seguranças paranormais exigem teste). Uma vez por missão, obtém acesso irrestrito a arquivos ou sistemas de uma organização.'}
      ]
    },
    'Trilha do Jornalista': {
      desc: 'Repórter investigativo obcecado pela verdade, capaz de infiltrar qualquer meio social e registrar o paranormal.',
      habs: [
        {nex:'10%', nome:'Fonte Confiável', desc:'Recebe treinamento em Diplomacia. Uma vez por missão, pode invocar uma fonte jornalística que fornece informação privilegiada sobre a situação atual.'},
        {nex:'40%', nome:'Pressão da Mídia', desc:'Gaste 2 PE para usar a ameaça de exposição midiática como ferramenta social. NPCs não-paranormais ficam Abalados e cooperativos (Vontade DT 20 evita por 1 cena).'},
        {nex:'65%', nome:'Registro Documentado', desc:'Pode usar seu registro de eventos (fotos, vídeos, anotações) como prova. Uma vez por missão, pode mudar a atitude de um grupo ou organização com base em evidências coletadas.'},
        {nex:'99%', nome:'A Verdade Vem à Tona', desc:'Uma vez por missão, ao revelar uma informação crucial, todos os aliados na cena recebem +1d20 em seus próximos testes. NPCs com lealdade ao antagonista podem mudar de lado (Vontade DT 25).'}
      ]
    },
    'Trilha do Arqueólogo': {
      desc: 'Especialista em civilizações antigas e artefatos, capaz de decifrar o passado para compreender o paranormal.',
      habs: [
        {nex:'10%', nome:'Conhecimento Ancestral', desc:'Recebe treinamento em Ocultismo ou Ciências. +3 em testes para identificar artefatos, símbolos e rituais de origem antiga. Pode determinar o elemento de um ritual inativo ao examiná-lo.'},
        {nex:'40%', nome:'Ler o Passado', desc:'Ao tocar um artefato ou local com história paranormal, recebe visões do passado (similar ao ritual Eco do Passado) sem custo de PE, 1 vez por cena.'},
        {nex:'65%', nome:'Profanador de Tumbas', desc:'Ignora armadilhas não-paranormais em locais históricos (percepção automática). Sabe instintivamente a DT de rituais selados ou armadilhas paranormais ao examiná-los.'},
        {nex:'99%', nome:'Guardião da Memória', desc:'Uma vez por missão, pode ativar as memórias latentes de um local, revelando todos os eventos importantes que ocorreram ali nos últimos 100 anos (Mestre decide os detalhes).'}
      ]
    },
    'Trilha do Cientista': {
      desc: 'Especialista em ciências naturais que aplica método científico para analisar e combater fenômenos paranormais.',
      habs: [
        {nex:'10%', nome:'Análise Racional', desc:'Recebe treinamento em Ciências ou Tecnologia. Uma vez por cena, pode gastar uma ação de movimento para analisar um ser paranormal e descobrir sua resistência, pontos fracos ou tipo de dano (Ciências DT 15).'},
        {nex:'40%', nome:'Hipótese Testada', desc:'Ao repetir um teste de perícia em que falhou, recebe +5 (pois "aprendeu com o erro"). Pode usar Ciências no lugar de Ocultismo para identificar rituais e entidades.'},
        {nex:'65%', nome:'Equipamento Adaptado', desc:'Pode modificar equipamentos comuns para servir contra o paranormal (1 interlúdio + Tecnologia DT 20). O equipamento ganha propriedades específicas determinadas pelo Mestre.'},
        {nex:'99%', nome:'Protocolo de Contenção', desc:'Uma vez por missão, pode criar um protocolo científico que, aplicado a uma situação específica, garante vantagem automática (+1d20) a todos os aliados na cena para aquela situação.'}
      ]
    },
    'Trilha do Acadêmico': {
      desc: 'Erudito das ciências do Outro Lado, com vasto conhecimento teórico sobre entidades, rituais e ocultismo.',
      habs: [
        {nex:'10%', nome:'Biblioteca Mental', desc:'Recebe +3 em Ocultismo e Ciências. Uma vez por cena, pode "consultar" seu conhecimento acadêmico para receber informação relevante sobre um ser ou fenômeno paranormal (Ocultismo DT 15).'},
        {nex:'40%', nome:'Teórico Aplicado', desc:'Pode preparar "contra-medidas" estudando uma entidade ou ritual por 10 min. Aliados recebem +2 em testes contra aquele alvo específico na missão.'},
        {nex:'65%', nome:'Publicação Proibida', desc:'Conhece rituais suprimidos e teorias proibidas. Pode identificar rituais de qualquer elemento sem teste e sabe automaticamente o efeito de rituais inimigos ao vê-los sendo conjurados.'},
        {nex:'99%', nome:'Suma Ocultista', desc:'Uma vez por missão, pode fazer uma pergunta sobre qualquer aspecto do Outro Lado, entidades ou ocultismo e recebe a resposta completa e verdadeira (Mestre decide os limites da informação).'}
      ]
    }
  },
  Fiel: {
    'Trilha da Fé': {
      desc: 'Seguidor devoto cuja crença inabalável manifesta proteção sobrenatural contra as trevas.',
      habs: [
        {nex:'10%', nome:'Proteção Divina', desc:'Recebe resistência a dano paranormal 5. Uma vez por cena, pode gastar 1 PE para que um aliado em alcance curto ignore o próximo efeito paranormal que o atingiria.'},
        {nex:'40%', nome:'Oração de Cura', desc:'Gaste 2 PE e uma ação padrão para curar um aliado em alcance curto em 3d8+3 PV. Pode ser usada em si mesmo. Uma vez por cena, a cura remove também uma condição negativa.'},
        {nex:'65%', nome:'Aura Sagrada', desc:'Seres do Outro Lado sofrem –1d20 em testes contra você e seus aliados em alcance curto. Entidades com Medo alto ficam Abaladas ao se aproximar a alcance curto de você.'},
        {nex:'99%', nome:'Milagre', desc:'Uma vez por missão, pode invocar um milagre — o Mestre deve conceder um efeito positivo poderoso e imediato (revivar um aliado, banir uma entidade, remover uma maldição, etc.).'}
      ]
    },
    'Trilha do Exorcista': {
      desc: 'Especialista em purificação e banimento de entidades do Outro Lado através de fé e rituais sagrados.',
      habs: [
        {nex:'10%', nome:'Palavras Sagradas', desc:'Recebe treinamento em Ocultismo (ou +2 se já treinado). Ao usar Ocultismo para banir ou identificar entidades, recebe +5 no teste. Entidades Apavoradas por você não podem se aproximar.'},
        {nex:'40%', nome:'Banimento Sagrado', desc:'Gaste 2 PE e uma ação padrão para tentar banir uma entidade do Outro Lado (Ocultismo oposto ao Vontade da entidade). Se vencer: banida por 1 hora. Crítico: banimento permanente.'},
        {nex:'65%', nome:'Círculo de Proteção', desc:'Gaste 3 PE e 1 minuto para criar um círculo sagrado de 6m de raio. Entidades não-convidadas não podem entrar (Vontade DT 25 para tentar). O círculo dura 1 hora.'},
        {nex:'99%', nome:'Exorcismo Maior', desc:'Uma vez por missão, pode realizar um exorcismo total em um ser possuído ou local amaldiçoado (10 min, Ocultismo DT 30). Sucesso remove completamente a influência paranormal.'}
      ]
    },
    'Trilha do Protetor': {
      desc: 'Guardião sagrado que sacrifica sua própria segurança para proteger os inocentes do paranormal.',
      habs: [
        {nex:'10%', nome:'Escudo de Fé', desc:'Uma vez por rodada, quando um aliado adjacente for alvo de um ataque, pode gastar 1 PE para se interpor, redirecionando metade do dano para si mesmo. Recebe resistência a dano paranormal 5.'},
        {nex:'40%', nome:'Imposição das Mãos', desc:'Ao tocar um aliado, pode transferir até 10 PV de seus próprios PV para ele como ação de movimento (sem custo de PE). Pode usar em si mesmo para remover uma condição negativa gastando 2 PE.'},
        {nex:'65%', nome:'Bênção Protetora', desc:'Gaste 3 PE para abençoar um aliado. Ele recebe +3 na Defesa, +3 em testes de resistência e resistência a dano paranormal 5 por toda a cena.'},
        {nex:'99%', nome:'Sacrifício Sagrado', desc:'Uma vez por missão, ao cair Inconsciente, pode gastar todos os PE restantes para se estabilizar com 1 PV e conceder a todos os aliados em alcance médio +1d20 em todos os testes até o fim da cena.'}
      ]
    }
  },
  Mundano: {
    'Trilha do Mundano': {
      desc: 'Pessoa comum que sobrevive ao paranormal por pura teimosia, sorte e instinto humano indomável.',
      habs: [
        {nex:'10%', nome:'Sobrevivente', desc:'Recebe +5 PV máximos. Uma vez por cena, quando seria reduzido a 0 PV, pode gastar 2 PE para ficar com 1 PV em vez disso.'},
        {nex:'40%', nome:'Sorte de Novato', desc:'Uma vez por rodada, ao falhar em um teste, pode relançar os dados e aceitar o melhor resultado (1× por rodada). Ao usar isso, recupera 1 PE.'},
        {nex:'65%', nome:'Instinto de Sobrevivência', desc:'Nunca pode ser Surpreendido. Quando está Machucado, recebe +2 em todos os testes de ataque e +1d20 em testes de Fortitude.'},
        {nex:'99%', nome:'O Improvável Herói', desc:'Uma vez por missão, em um momento de desespero total, pode declarar "Não é assim que termina". Todos os seus testes nessa rodada são automáticos sucessos críticos.'}
      ]
    },
    'Trilha do Sobrevivente': {
      desc: 'Veterano do paranormal que aprendeu a sobreviver usando o ambiente, o improviso e a adaptação constante.',
      habs: [
        {nex:'10%', nome:'MacGyver', desc:'Recebe treinamento em Tecnologia ou Atletismo. Uma vez por cena, pode criar um item improvisado com materiais disponíveis para resolver um problema específico (DT 15, efeito a critério do Mestre).'},
        {nex:'40%', nome:'Adaptação Rápida', desc:'Ao enfrentar um tipo de ameaça pela segunda vez na missão, recebe +2 em todos os testes contra ela. Ao terceira vez, +5.'},
        {nex:'65%', nome:'Cicatrizes do Campo', desc:'Cada vez que cai a 0 PV e sobrevive, ganha um bônus permanente de +1 PV máximo e +1 em testes de Fortitude (máx. 5 vezes por missão).'},
        {nex:'99%', nome:'Impossível de Matar', desc:'Ao usar a habilidade Sobrevivente de cair com 1 PV, além do efeito normal, fica com PV iguais à metade do máximo. Uma vez por campanha, pode sobreviver a um efeito que deveria matar instantaneamente.'}
      ]
    }
  }
};

function renderTrilhasOpts(){
  const cl=document.getElementById('trilha-classe-sel').value;
  const sel=document.getElementById('trilha-nome-sel');
  sel.innerHTML='<option value="">— Selecione a Trilha —</option>';
  if(!cl||!TRILHAS_DATA[cl]) return;
  Object.keys(TRILHAS_DATA[cl]).forEach(t=>{
    const o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o);
  });
  // pre-select saved
  const c=userChar(currentUser);
  if(c.trilha&&c.trilha.classe===cl) sel.value=c.trilha.nome||'';
  renderTrilhaAtiva();
}

function confirmarTrilha(){
  const cl=document.getElementById('trilha-classe-sel').value;
  const nm=document.getElementById('trilha-nome-sel').value;
  if(!cl||!nm){toast('⛧ Selecione classe e trilha.');return;}
  const c=userChar(currentUser);
  c.trilha={classe:cl,nome:nm};
  saveDB();renderTrilhaAtiva();toast('Trilha salva: '+nm+'.');
}

function renderTrilhaAtiva(){
  const c=userChar(currentUser);
  const disp=document.getElementById('trilha-ativa-display');
  const panel=document.getElementById('trilha-habs-panel');
  const list=document.getElementById('trilha-habs-list');
  const title=document.getElementById('trilha-habs-title');
  if(!c.trilha||!c.trilha.nome){
    disp.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhuma trilha selecionada.</div>';
    panel.style.display='none';return;
  }
  const {classe,nome}=c.trilha;
  const data=TRILHAS_DATA[classe]&&TRILHAS_DATA[classe][nome];
  disp.innerHTML=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <span style="font-family:'Cinzel',serif;font-size:15px;color:var(--crimson-hot)">${nome}</span>
    <span style="font-size:11px;font-family:'Oswald',sans-serif;letter-spacing:.1em;color:var(--white-dust);border:1px solid var(--blood-deep);padding:2px 8px">${classe}</span>
  </div>
  ${data?`<div style="font-size:12px;color:var(--white-ash);margin-top:8px;line-height:1.6;font-family:'IM Fell English',serif;font-style:italic">${data.desc}</div>`:''}`;
  if(!data){panel.style.display='none';return;}
  panel.style.display='';
  title.textContent='Habilidades — '+nome;
  list.innerHTML='';
  if(!c.trilhaHabs) c.trilhaHabs={};
  data.habs.forEach((h,i)=>{
    const unlocked=c.trilhaHabs[i]||false;
    const row=document.createElement('div');
    row.style.cssText='padding:12px 14px;border-bottom:1px solid rgba(58,0,0,0.4);display:flex;gap:12px;align-items:flex-start';
    row.innerHTML=`
      <div style="flex-shrink:0;text-align:center;min-width:48px">
        <div style="font-size:9px;font-family:'Oswald',sans-serif;letter-spacing:.1em;color:var(--crimson);margin-bottom:3px">NEX</div>
        <div style="font-size:14px;font-family:'Cinzel Decorative',serif;color:${unlocked?'var(--gold-light)':'var(--white-dust)'}">${h.nex}</div>
      </div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:${unlocked?'var(--crimson-hot)':'var(--white-bone)'};margin-bottom:4px">${h.nome}</div>
        <div style="font-size:12px;color:var(--white-ash);line-height:1.6">${h.desc}</div>
      </div>
      <button class="btn-add" style="font-size:10px;padding:5px 10px;border-color:${unlocked?'var(--crimson)':'var(--blood-deep)'};color:${unlocked?'var(--crimson-hot)':'var(--white-dust)'};flex-shrink:0" onclick="toggleTrilhaHab(${i})">${unlocked?'✓ Desbloqueado':'Desbloquear'}</button>`;
    list.appendChild(row);
  });
}

function toggleTrilhaHab(i){
  const c=userChar(currentUser);
  if(!c.trilhaHabs) c.trilhaHabs={};
  c.trilhaHabs[i]=!c.trilhaHabs[i];
  renderTrilhaAtiva();saveDB();
}

function loadTrilhaSelects(){
  const c=userChar(currentUser);
  if(!c.trilha) return;
  const clSel=document.getElementById('trilha-classe-sel');
  if(clSel&&c.trilha.classe){
    clSel.value=c.trilha.classe;
    renderTrilhasOpts();
    const nmSel=document.getElementById('trilha-nome-sel');
    if(nmSel&&c.trilha.nome) nmSel.value=c.trilha.nome;
    renderTrilhaAtiva();
  }
}


appTrilhas.confirmarTrilha = confirmarTrilha;
appTrilhas.loadTrilhaSelects = loadTrilhaSelects;
appTrilhas.renderTrilhaAtiva = renderTrilhaAtiva;
appTrilhas.renderTrilhasOpts = renderTrilhasOpts;
appTrilhas.confirmarTrilha = confirmarTrilha;
appTrilhas.loadTrilhaSelects = loadTrilhaSelects;
appTrilhas.renderTrilhaAtiva = renderTrilhaAtiva;
appTrilhas.renderTrilhasOpts = renderTrilhasOpts;
appTrilhas.toggleTrilhaHab = toggleTrilhaHab;
appTrilhas.TRILHAS_DATA = TRILHAS_DATA;
Object.assign(window, appTrilhas);
