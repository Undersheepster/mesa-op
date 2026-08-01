/* ════════════════════════════════════════════════════════════
   AGENTES.JS — Aba "◍ Agentes"
   ────────────────────────────────────────────────────────────
   Arquivo isolado (mesmo padrão de criaturas.js / danos-tab.js):
   lista os agentes e figuras centrais da Ordo Realitas ao longo
   das temporadas de Ordem Paranormal, com uma breve "ficha"
   (origem, função, elemento/Marca, status) e biografia resumida.

   Este NÃO é um bestiário de stat-block de combate: agentes são
   protagonistas humanos, então a "ficha" aqui é um perfil de
   personagem (função na equipe, elemento quando Marcado, status
   atual) em vez de atributos de monstro.
   ════════════════════════════════════════════════════════════ */

const corStatusAgente = {
  'Vivo':'#3a9a4a', 'Morto':'#8b0000', 'Desaparecido':'#666',
  'Marcado (hostil)':'#aa5500', 'Possuído':'#6a1b9a', 'Desconhecido':'#555'
};

const AGENTES = [
  {
    id: "senhor-verissimo",
    nome: "Senhor Veríssimo",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Líder da Ordo Realitas (São Paulo)",
    elemento: null,
    status: "Vivo",
    desc: "Homem enigmático e reservado que comanda as operações da Ordo Realitas em São Paulo há décadas. Recebe as equipes recém-formadas, distribui missões e guarda segredos que remontam à fundação da própria Ordem. Repudia abertamente o uso do Paranormal, mesmo sabendo que muitos de seus agentes se tornam Marcados. É pai de Mia e tem uma longa história pessoal com Agatha Volkomenn e Morato Vertaler.",
    ficha: {
      nex: "90%",
      desl: "12m",
      origem: "Diplomata",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 4,
        vig: 2
      },
      pv: 180,
      pe: 48,
      def: 27,
      fort: "+12",
      ref: "+12",
      vont: "+14",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+12",
          dano: "2d6+2",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Selo do Silêncio (Conhecimento)",
          elem: "",
          circ: 1
        }
      ],
      habs: "Comando de Elite: concede +2 em testes de perícia a aliados a até 9m. Décadas de experiência administrativa e de campo dentro da Ordo Realitas."
    }
  },
  {
    id: "chizue-akechi",
    nome: "Chizue Akechi",
    apelido: "Senhora Veríssimo",
    equipes: [
      "Lideranca"
    ],
    funcao: "Veterana / Liderança da Ordo Realitas",
    elemento: null,
    status: "Vivo",
    desc: "Uma das agentes mais antigas ainda vivas da Ordo Realitas, ao lado de Veríssimo, Balu e Aaron. Mãe de Naomi Akechi. Atua nos bastidores da organização, com décadas de experiência acumulada desde os primeiros anos da Ordem.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 24,
      fort: "+9",
      ref: "+10",
      vont: "+8",
      ataques: [
        {
          nome: "Katana",
          bonus: "+10",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Veterania de Combate: ignora o primeiro Ferimento Grave sofrido em uma cena."
    }
  },
  {
    id: "agatha-volkomenn",
    nome: "Agatha Volkomenn",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Agente de altíssima Exposição Paranormal / conselheira",
    elemento: "Todos",
    status: "Vivo",
    desc: "Considerada por Veríssimo como possivelmente a pessoa mais poderosa da Ordem, com uma Exposição Paranormal acumulada desde muito antes dos eventos atuais. Aparece em momentos cruciais para guiar (ou perturbar) os agentes mais novos, muitas vezes com informações que ninguém mais possui. Sua real natureza e limites nunca foram totalmente revelados.",
    ficha: {
      nex: "99%",
      desl: "15m",
      origem: "Acadêmico",
      trilha: "Especialista",
      atrs: {
        agi: 1,
        for: 0,
        int: 4,
        pre: 3,
        vig: 1
      },
      pv: 240,
      pe: 60,
      def: 29,
      fort: "+13",
      ref: "+13",
      vont: "+15",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+13",
          dano: "1d6+0",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Exposição Paranormal Extrema: pode manifestar habilidades de qualquer um dos quatro elementos. Sua real capacidade de combate nunca foi totalmente revelada."
    }
  },
  {
    id: "morato-vertaler",
    nome: "Morato Vertaler",
    apelido: null,
    equipes: [
      "Lideranca",
      "Os Cinco"
    ],
    funcao: "Ex-agente da Ordo Realitas / mentor de \"Os Cinco\"",
    elemento: "Conhecimento",
    status: "Vivo",
    desc: "Ex-membro da Ordo Realitas que se tornou caçador paranormal independente, especializado em catalogar os Alheios. Fundou e liderou o grupo \"Os Cinco\" em Varminho durante os eventos de Sinais do Outro Lado, guiando os jovens investigadores contra ameaças que a própria Ordem desconhecia.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Especialista",
      atrs: {
        agi: 1,
        for: 0,
        int: 4,
        pre: 3,
        vig: 1
      },
      pv: 120,
      pe: 34,
      def: 22,
      fort: "+8",
      ref: "+8",
      vont: "+10",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+8",
          dano: "1d6+0",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Videncia do Sinal Perdido (Conhecimento)",
          elem: "Conhecimento",
          circ: 1
        }
      ],
      habs: "Catalogador de Alheios: bônus em testes de Ocultismo e Investigação envolvendo a Categoria Transmissão."
    }
  },
  {
    id: "arnaldo-fritz",
    nome: "Arnaldo Fritz",
    apelido: "O Anfitrião",
    equipes: [
      "Lideranca"
    ],
    funcao: "Ex-agente veterano da Ordo Realitas — tornou-se O Anfitrião",
    elemento: "Energia",
    status: "Marcado (hostil)",
    desc: "Um dos agentes mais antigos e respeitados da Ordo Realitas, pai de Thiago Fritz, cuja busca obsessiva pelas Relíquias da Calamidade o corrompeu completamente até se tornar a entidade paranormal conhecida como O Anfitrião — um dos maiores traumas e traições da história recente da Ordem, revelado durante Calamidade.",
    ficha: {
      nex: "99%",
      desl: "15m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 1,
        for: 4,
        int: 0,
        pre: 1,
        vig: 4
      },
      pv: 240,
      pe: 60,
      def: 29,
      fort: "+16",
      ref: "+13",
      vont: "+13",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+13",
          dano: "1d6+4",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Energia",
          elem: "Energia",
          circ: 1
        }
      ],
      habs: "Corrompido pela busca das Relíquias da Calamidade — hoje sua forma humana é apenas uma fachada para O Anfitrião (ver Bestiário)."
    }
  },
  {
    id: "antonio-pontevedra",
    nome: "Antônio Pontevedra",
    apelido: "Balu",
    equipes: [
      "Lideranca",
      "Equipe Abutres"
    ],
    funcao: "Agente veterano aposentado, reativado para a Equipe Abutres",
    elemento: "Sangue",
    status: "Vivo",
    desc: "Agente aposentado há cinco anos da Ordo Realitas, convocado de volta à ativa por Veríssimo para integrar a Equipe Abutres durante Calamidade. Perdeu a orelha direita durante um confronto com o Titã de Sangue na Mansão Leone. Um dos membros mais velhos da Ordem ainda vivos, ao lado de Veríssimo, Chizue e Johnny Tabasco.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 24,
      fort: "+9",
      ref: "+10",
      vont: "+8",
      ataques: [
        {
          nome: "Facão de trincheira",
          bonus: "+10",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Sangue",
          elem: "Sangue",
          circ: 1
        }
      ],
      habs: "Veterano Aposentado: mesmo fora de forma, mantém reflexos de décadas de combate contra Zumbis de Sangue."
    }
  },
  {
    id: "aaron",
    nome: "Aaron",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Agente veterano de apoio tático (arco e flecha)",
    elemento: null,
    status: "Vivo",
    desc: "Um dos membros mais antigos da Ordem ainda vivos. Atua como atirador de apoio em missões de grande escala, como na guerra do Coliseu durante Calamidade, ao lado da Equipe Espiãs e da Equipe Abutres.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Atirador",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 1,
        int: 1,
        pre: 3,
        vig: 1
      },
      pv: 78,
      pe: 24,
      def: 21,
      fort: "+6",
      ref: "+8",
      vont: "+8",
      ataques: [
        {
          nome: "Arco composto",
          bonus: "+8",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Precisão Cirúrgica: ataques à distância contra alvos Desprevenidos causam dano extra."
    }
  },
  {
    id: "elizabeth-webber",
    nome: "Elizabeth Webber",
    apelido: "Liz",
    equipes: [
      "Equipe E",
      "Força D"
    ],
    funcao: "Cientista forense / agente veterana",
    elemento: "Conhecimento",
    status: "Morto",
    desc: "Uma das agentes mais promissoras da Ordo Realitas, cientista forense que sobreviveu ao pesadelo de Carpazinha ao lado da Equipe E. Depois de O Segredo na Floresta, seguiu sozinha em uma investigação sobre a misteriosa \"Ordem da Desconjuração\" e desapareceu — sendo o motivo pelo qual a Força D se formou para resgatá-la. Foi encontrada no Orfanato Santa Menefreda, mas executada por Gal logo depois do resgate.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Acadêmico",
      trilha: "Especialista",
      atrs: {
        agi: 1,
        for: 0,
        int: 4,
        pre: 2,
        vig: 1
      },
      pv: 120,
      pe: 34,
      def: 22,
      fort: "+8",
      ref: "+8",
      vont: "+9",
      ataques: [
        {
          nome: "Kit forense",
          bonus: "+8",
          dano: "2d6+0",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Conhecimento",
          elem: "Conhecimento",
          circ: 1
        }
      ],
      habs: "Perícia Forense: bônus em testes de Investigação e Medicina envolvendo cenas de crime paranormal."
    }
  },
  {
    id: "thiago-fritz",
    nome: "Thiago Fritz",
    apelido: null,
    equipes: [
      "Equipe E"
    ],
    funcao: "Agente veterano, filho de Arnaldo Fritz",
    elemento: "Energia",
    status: "Morto",
    desc: "Agente experiente e filho de Arnaldo Fritz, parte da Equipe E enviada a Carpazinha para investigar o desaparecimento da Equipe Kelvin. Vinculado a um símbolo paranormal que o fazia envelhecer, sacrificou-se detonando explosivos dentro de Santo Berço para salvar seus companheiros — mesmo já com 84 anos de idade no momento da explosão.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 1,
        for: 4,
        int: 0,
        pre: 1,
        vig: 4
      },
      pv: 120,
      pe: 34,
      def: 22,
      fort: "+11",
      ref: "+8",
      vont: "+8",
      ataques: [
        {
          nome: "Explosivos",
          bonus: "+8",
          dano: "2d6+4",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Energia",
          elem: "Energia",
          circ: 1
        }
      ],
      habs: "Marca de Envelhecimento: sofre efeitos progressivos de idade avançada ligados a um símbolo paranormal gravado em seu corpo."
    }
  },
  {
    id: "cesar-cohen",
    nome: "Cesar Oliveira Cohen",
    apelido: "Kaiser",
    equipes: [
      "Equipe E",
      "Força D"
    ],
    funcao: "Novato em O Segredo na Floresta, depois veterano na Força D — filho de Cristopher Cohen",
    elemento: "Sangue",
    status: "Morto",
    desc: "Um dos novatos que embarcou para Carpazinha na Equipe E, filho do dublê aposentado Cristopher Cohen. Cresceu como agente ao longo de O Segredo na Floresta, enfrentando pela primeira vez o horror do Carniçal Preto da Morte e de Santo Berço. Mais tarde, já com o codinome \"Kaiser\", tornou-se colega de casa de Arthur Cervero e um dos pilares emocionais da Força D em Desconjuração, morrendo em combate durante o Dia Final.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Atleta",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 21,
      fort: "+7",
      ref: "+8",
      vont: "+6",
      ataques: [
        {
          nome: "Adaga",
          bonus: "+8",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Sangue",
          elem: "Sangue",
          circ: 1
        }
      ],
      habs: "Cresceu em campo desde novato até o codinome \"Kaiser\" — versátil em combate corpo a corpo."
    }
  },
  {
    id: "cristopher-cohen",
    nome: "Cristopher Cohen",
    apelido: "Chris",
    equipes: [
      "Equipe E"
    ],
    funcao: "Dublê aposentado / agente veterano",
    elemento: "Sangue",
    status: "Vivo",
    desc: "Dublê de cinema aposentado e pai de Cesar Cohen, recrutado pela Ordo Realitas como um dos veteranos da Equipe E que investigou o desaparecimento da Equipe Kelvin em Carpazinha.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Artista",
      trilha: "Especialista",
      atrs: {
        agi: 4,
        for: 1,
        int: 1,
        pre: 2,
        vig: 1
      },
      pv: 46,
      pe: 16,
      def: 19,
      fort: "+4",
      ref: "+7",
      vont: "+5",
      ataques: [
        {
          nome: "Facas de arremesso",
          bonus: "+7",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Sangue",
          elem: "Sangue",
          circ: 1
        }
      ],
      habs: "Reflexos de Dublê: bônus em testes de Acrobacia e Reflexos ao sofrer quedas ou impactos."
    }
  },
  {
    id: "joui-jouki",
    nome: "Joui Jouki",
    apelido: null,
    equipes: [
      "Equipe E",
      "Força D",
      "Equipe Abutres"
    ],
    funcao: "Agente veterano, especialista em katana",
    elemento: "Energia",
    status: "Morto",
    desc: "Agente vindo do Japão, um dos pilares da Ordem desde O Segredo na Floresta até Calamidade. Depois de derrotar O Anfitrião, sua katana passou a abrigar a Relíquia de Energia, tornando-se uma arma lendária dentro da Ordo Realitas. Morreu em combate durante o Dia Final da Desconjuração, sendo homenageado com um túmulo ao lado de Kaiser.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Lutador",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 24,
      fort: "+9",
      ref: "+10",
      vont: "+8",
      ataques: [
        {
          nome: "Katana (abriga a Relíquia de Energia)",
          bonus: "+10",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Energia",
          elem: "Energia",
          circ: 1
        }
      ],
      habs: "Corte Relâmpago: pode realizar dois ataques corpo a corpo na mesma ação padrão."
    }
  },
  {
    id: "arthur-cervero",
    nome: "Arthur Cervero",
    apelido: "Tutu",
    equipes: [
      "Equipe E",
      "Força D",
      "Equipe Abutres"
    ],
    funcao: "Ex-motoqueiro dos Gaudérios Abutres, líder da Equipe Abutres",
    elemento: "Sangue",
    status: "Vivo",
    desc: "Ex-músico e membro da gangue de motoqueiros Gaudérios Abutres em Carpazinha, que se juntou à Ordo Realitas após perder colegas e família para o Carniçal Preto da Morte. Um dos protagonistas mais constantes da série, presente em O Segredo na Floresta, Desconjuração, Calamidade, O Segredo na Ilha e Hexatombe. Acabou nomeado líder da Equipe Abutres, criada para caçar as Relíquias da Calamidade antes de Kian.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Motoqueiro",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 24,
      fort: "+9",
      ref: "+10",
      vont: "+8",
      ataques: [
        {
          nome: "Corrente de moto / facão",
          bonus: "+10",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Sangue",
          elem: "Sangue",
          circ: 1
        }
      ],
      habs: "Líder da Equipe Abutres: concede +1d20 em testes de Iniciativa a todo o grupo em combate."
    }
  },
  {
    id: "beatrice-portinari",
    nome: "Beatrice Portinari",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Florista, recruta mais nova da equipe",
    elemento: "Morte",
    status: "Morto",
    desc: "Florista com um passado misterioso e a mais nova recruta da Ordem no início de Desconjuração. Cresceu no mesmo orfanato que Dante, o que se revelou crucial para a investigação sobre os Escriptas. Uma das baixas do Dia Final da Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Artista",
      trilha: "Especialista",
      atrs: {
        agi: 2,
        for: 1,
        int: 3,
        pre: 2,
        vig: 1
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+4",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Tesoura de jardinagem",
          bonus: "+5",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Morte",
          elem: "Morte",
          circ: 1
        }
      ],
      habs: "Recruta mais jovem da Força D, ainda desenvolvendo controle sobre sua Marca de Morte."
    }
  },
  {
    id: "erin-parker",
    nome: "Erin Parker",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Engenheira especialista em explosivos",
    elemento: "Sangue",
    status: "Vivo",
    desc: "Engenheira animada e especialista em explosões, membro havia dois anos da Equipe Brasa antes de integrar a Força D. Formou uma amizade quase fraternal com Luciano Carvalho, e foi uma das agentes que passou pelo Jogo do Anfitrião ao lado de Fernando, Johnny Tabasco e Rubens Naluti.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Engenheiro",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 1,
        int: 1,
        pre: 3,
        vig: 1
      },
      pv: 78,
      pe: 24,
      def: 21,
      fort: "+6",
      ref: "+8",
      vont: "+8",
      ataques: [
        {
          nome: "Explosivos plásticos",
          bonus: "+8",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Sangue",
          elem: "Sangue",
          circ: 1
        }
      ],
      habs: "Demolição Paranormal: bônus de dano ao usar explosivos contra estruturas ou criaturas de Sangue."
    }
  },
  {
    id: "luciano-carvalho",
    nome: "Luciano Carvalho",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Ex-militar; corpo atualmente possuído por Kian",
    elemento: "Medo",
    status: "Marcado (hostil)",
    desc: "Ex-militar e agente da Ordo Realitas que, após um ritual desesperado para salvar seu marido Fernando Carvalho, passou a dividir o mesmo corpo com ele. No final de Desconjuração, revelou-se ser o receptáculo escolhido para a consciência do ocultista Kian, que despertou e assumiu completamente o controle do corpo, matando o próprio Fernando no processo. Hoje, \"Luciano\" é essencialmente Kian.",
    ficha: {
      nex: "99%",
      desl: "15m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 240,
      pe: 60,
      def: 31,
      fort: "+14",
      ref: "+15",
      vont: "+13",
      ataques: [
        {
          nome: "Faca de combate",
          bonus: "+15",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Medo",
          elem: "Medo",
          circ: 1
        }
      ],
      habs: "Corpo Compartilhado: hoje controlado quase inteiramente pela consciência de Kian, mal contendo seus impulsos ocultistas."
    }
  },
  {
    id: "fernando-carvalho",
    nome: "Fernando Carvalho",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Cantor; dividia o corpo com o marido Luciano",
    elemento: "Energia",
    status: "Morto",
    desc: "Cantor casado com Luciano Carvalho, cuja alma ficou presa no corpo do marido após um ritual mal sucedido para salvá-lo de um estado terminal. Treinado por Erin Parker e Tristan Monteiro, tornou-se agente por direito próprio, revezando o controle do corpo com Luciano. Foi morto quando Kian despertou e assumiu definitivamente o corpo compartilhado.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Artista",
      trilha: "Especialista",
      atrs: {
        agi: 2,
        for: 1,
        int: 3,
        pre: 2,
        vig: 1
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+4",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Microfone modificado",
          bonus: "+5",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Energia",
          elem: "Energia",
          circ: 1
        }
      ],
      habs: "Voz Ressonante: pode usar Intimidação ou Diplomacia como uma ação livre uma vez por cena."
    }
  },
  {
    id: "dante",
    nome: "Dante",
    apelido: null,
    equipes: [
      "Força D",
      "Equipe Abutres"
    ],
    funcao: "Ex-ocultista, especialista em rituais",
    elemento: "Morte",
    status: "Vivo",
    desc: "Ocultista capturado pela Equipe Brasa no início de 2020, recrutado pela Força D pela necessidade de localizar o Orfanato Santa Menefreda. Tornou-se oficialmente agente e um dos maiores especialistas em rituais da Ordem, perdendo o amor de sua vida, o filho, a irmã e o melhor amigo para as mãos de Kian — o que move sua determinação obsessiva de vingança na Equipe Abutres.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Ocultista",
      trilha: "Especialista",
      atrs: {
        agi: 1,
        for: 0,
        int: 4,
        pre: 3,
        vig: 1
      },
      pv: 78,
      pe: 24,
      def: 19,
      fort: "+6",
      ref: "+6",
      vont: "+8",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+6",
          dano: "1d6+0",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Amarras da Sepultura (Morte)",
          elem: "Morte",
          circ: 1
        }
      ],
      habs: "Especialista em Rituais: pode conjurar um ritual conhecido de até 2° círculo sem gastar PE uma vez por sessão."
    }
  },
  {
    id: "rubens-naluti",
    nome: "Rubens Naluti",
    apelido: null,
    equipes: [
      "Força D",
      "Equipe Abutres"
    ],
    funcao: "Agente / \"caçador de recompensas\", Marcado",
    elemento: "Sangue",
    status: "Vivo",
    desc: "Agente da Ordo Realitas que se apresentava como \"caçador de recompensas\" junto de Johnny Tabasco enquanto investigava disfarçado O Anfitrião. Sobreviveu ao segundo Jogo do Anfitrião com uma cicatriz permanente no peito. Um dos Marcados do lado da Ordem, posteriormente parte da Equipe Abutres.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 21,
      fort: "+7",
      ref: "+8",
      vont: "+6",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+8",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Sangue",
          elem: "Sangue",
          circ: 1
        }
      ],
      habs: "Cicatriz do Anfitrião: uma vez por sessão pode ignorar completamente um efeito de Medo."
    }
  },
  {
    id: "johnny-tabasco",
    nome: "Johnny Tabasco",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente / parceiro de longa data de Rubens Naluti",
    elemento: null,
    status: "Desconhecido",
    desc: "Parceiro de longa data de Rubens Naluti, apresentando-se com ele como \"caçadores de recompensas\" durante a investigação disfarçada sobre O Anfitrião. Ficou gravemente debilitado após o segundo Jogo do Anfitrião e atualmente está internado em coma em um hospital de São Paulo — mas parece manter alguma consciência do que acontece ao seu redor.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 18,
      fort: "+5",
      ref: "+6",
      vont: "+4",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+6",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Atualmente em coma — ficha reflete seu último estado ativo conhecido."
    }
  },
  {
    id: "carina-leone",
    nome: "Carina Leone",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente furtiva, herdeira da máfia italiana Leone",
    elemento: "Sangue",
    status: "Vivo",
    desc: "Agente de altas habilidades furtivas, vinda da Itália e de uma família de caçadores paranormais ligada à máfia Leone. Enviada por seu pai para reforçar a caçada às Relíquias da Calamidade e ajudar a Ordem a derrotar Kian, tornando-se peça-chave da Equipe Abutres.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Atleta",
      trilha: "Combatente",
      atrs: {
        agi: 4,
        for: 1,
        int: 1,
        pre: 2,
        vig: 1
      },
      pv: 120,
      pe: 34,
      def: 25,
      fort: "+8",
      ref: "+11",
      vont: "+9",
      ataques: [
        {
          nome: "Adagas duplas",
          bonus: "+11",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Sangue",
          elem: "Sangue",
          circ: 1
        }
      ],
      habs: "Furtividade da Máfia: bônus em testes de Furtividade e Ladinagem; treinamento desde a infância na Mansão Leone."
    }
  },
  {
    id: "jiro-yukami",
    nome: "Jiro Yukami",
    apelido: null,
    equipes: [
      "Equipe Delta"
    ],
    funcao: "Agente de campo da Equipe Delta",
    elemento: null,
    status: "Vivo",
    desc: "Um dos três agentes experientes que compõem a Equipe Delta, uma das equipes de campo mais ativas da Ordem. Lutou na guerra do Coliseu ao lado de Naomi Akechi, Olivia Lefleur e membros da Família Leone durante Calamidade.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 21,
      fort: "+7",
      ref: "+8",
      vont: "+6",
      ataques: [
        {
          nome: "Espada curta",
          bonus: "+8",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Membro veterano da Equipe Delta, especializado em operações de resgate em zona de guerra paranormal."
    }
  },
  {
    id: "olivia-lefleur",
    nome: "Olivia Lefleur",
    apelido: null,
    equipes: [
      "Equipe Delta"
    ],
    funcao: "Agente de campo da Equipe Delta",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Equipe Delta, uma das equipes mais experientes e ativas da Ordo Realitas em campo, que reforçou o combate durante a guerra do Coliseu em Calamidade.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Artista",
      trilha: "Especialista",
      atrs: {
        agi: 2,
        for: 1,
        int: 3,
        pre: 2,
        vig: 1
      },
      pv: 78,
      pe: 24,
      def: 20,
      fort: "+6",
      ref: "+7",
      vont: "+7",
      ataques: [
        {
          nome: "Chicote",
          bonus: "+7",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Membro veterano da Equipe Delta, com treinamento de suporte tático em campo."
    }
  },
  {
    id: "naomi-akechi",
    nome: "Naomi Akechi",
    apelido: null,
    equipes: [
      "Equipe Delta"
    ],
    funcao: "Agente de campo da Equipe Delta, filha de Chizue Akechi",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Equipe Delta e filha de Chizue Akechi, uma das veteranas mais antigas da Ordem. Integrou o reforço enviado ao Coliseu durante os eventos finais de Calamidade.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 21,
      fort: "+7",
      ref: "+8",
      vont: "+6",
      ataques: [
        {
          nome: "Katana",
          bonus: "+8",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Filha de Chizue Akechi, treinada em combate com lâminas desde jovem."
    }
  },
  {
    id: "clarissa-leao",
    nome: "Clarissa Leão",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Ex-agente, integrante da Equipe Espiãs — traidora",
    elemento: "Conhecimento",
    status: "Marcado (hostil)",
    desc: "Agente que treinou intensamente após os eventos trágicos do Dia Final da Desconjuração, ganhando o respeito de Arthur Cervero por um tempo. Integrante da Equipe Espiãs ao lado de Samantha Hale e Alexia Grifo, revelou-se posteriormente uma traidora, o que fez Arthur perder todo o respeito que tinha por ela.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Especialista",
      atrs: {
        agi: 4,
        for: 1,
        int: 1,
        pre: 2,
        vig: 1
      },
      pv: 120,
      pe: 34,
      def: 25,
      fort: "+8",
      ref: "+11",
      vont: "+9",
      ataques: [
        {
          nome: "Pistola silenciada",
          bonus: "+11",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Conhecimento",
          elem: "Conhecimento",
          circ: 1
        }
      ],
      habs: "Traidora: agora usa seu treinamento de infiltração da Equipe Espiãs a serviço de Gal e dos Escriptas."
    }
  },
  {
    id: "alexandre-xande",
    nome: "Alexandre",
    apelido: "Xande",
    equipes: [
      "Os Cinco"
    ],
    funcao: "Membro de \"Os Cinco\" — especialista em ocultismo",
    elemento: null,
    status: "Morto",
    desc: "Skatista e um dos protagonistas mais jovens de toda a série, junto de Jorel Lagos. Responsável pelos conhecimentos ocultos dentro do grupo \"Os Cinco\", capaz de identificar presenças paranormais. Sacrificou-se de forma trágica ao final da investigação na Torre da TV Varminho, sendo torturado e \"derretido\" pelo Estrangeiro, perdendo todas as suas memórias e identidade.",
    ficha: {
      nex: "5%",
      desl: "9m",
      origem: "Artista",
      trilha: "Especialista",
      atrs: {
        agi: 1,
        for: 0,
        int: 4,
        pre: 3,
        vig: 1
      },
      pv: 24,
      pe: 8,
      def: 13,
      fort: "+2",
      ref: "+2",
      vont: "+4",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+2",
          dano: "1d6+0",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Sensibilidade Paranormal: consegue perceber presenças do Outro Lado antes dos colegas de equipe."
    }
  },
  {
    id: "guilherme-santos",
    nome: "Guilherme R. Santos",
    apelido: "Guizo",
    equipes: [
      "Os Cinco"
    ],
    funcao: "Membro de \"Os Cinco\" — câmera/documentarista do grupo",
    elemento: "Conhecimento",
    status: "Vivo",
    desc: "Melhor amigo de Xande e o \"câmera\" oficial do grupo \"Os Cinco\", sempre filmando os encontros paranormais que a equipe investiga em Varminho. Apaixonado por ufologia e pelo desconhecido desde a adolescência, sonhava em ter contato com o Paranormal — um desejo que se realizou plenamente durante Sinais do Outro Lado.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Especialista",
      atrs: {
        agi: 2,
        for: 1,
        int: 3,
        pre: 2,
        vig: 1
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+4",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Câmera modificada",
          bonus: "+5",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Conhecimento",
          elem: "Conhecimento",
          circ: 1
        }
      ],
      habs: "Documentarista: registra evidências paranormais que concedem bônus em testes de Investigação posteriores."
    }
  },
  {
    id: "francisco-albuquerque",
    nome: "Francisco Albuquerque",
    apelido: "Chico",
    equipes: [
      "Os Cinco"
    ],
    funcao: "Membro de \"Os Cinco\" — analista técnico",
    elemento: null,
    status: "Vivo",
    desc: "Motorista e analista técnico do grupo \"Os Cinco\", conhecido por se comunicar com charadas e \"enigmas\" que às vezes irritam seus colegas de equipe. Responsável por rastrear pistas digitais sobre o desaparecimento de Morato Vertaler.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Especialista",
      atrs: {
        agi: 2,
        for: 1,
        int: 3,
        pre: 2,
        vig: 1
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+4",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Kit de ferramentas",
          bonus: "+5",
          dano: "2d6+1",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Analista Técnico: bônus em testes de Tecnologia e Investigação digital."
    }
  },
  {
    id: "dara-venturini",
    nome: "Dara Alice Venturini",
    apelido: null,
    equipes: [
      "Os Cinco"
    ],
    funcao: "Membro de \"Os Cinco\"",
    elemento: null,
    status: "Vivo",
    desc: "Integrante do grupo \"Os Cinco\" em Varminho, presente desde a primeira investigação sobre o desaparecimento de seu mentor, Morato Vertaler, na Granja Abobrinha.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Atleta",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 18,
      fort: "+5",
      ref: "+6",
      vont: "+4",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+6",
          dano: "1d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Membro ativo de \"Os Cinco\", com bom condicionamento físico para investigações de campo."
    }
  },
  {
    id: "lirio-tellini",
    nome: "Lírio Tellini",
    apelido: null,
    equipes: [
      "Os Cinco"
    ],
    funcao: "Membro de \"Os Cinco\"",
    elemento: null,
    status: "Vivo",
    desc: "Integrante do grupo \"Os Cinco\", com uma rivalidade notória com Xande apesar do respeito mútuo entre ambos. Parte fundamental da investigação que revelou a existência dos Alheios em Varminho.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Especialista",
      atrs: {
        agi: 2,
        for: 1,
        int: 3,
        pre: 2,
        vig: 1
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+4",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+5",
          dano: "1d6+1",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Membro de \"Os Cinco\", frequentemente em atrito produtivo com Xande durante investigações."
    }
  },
  {
    id: "mia",
    nome: "Mia",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Filha do Senhor Veríssimo / protagonista de Enigma do Medo",
    elemento: "Conhecimento",
    status: "Vivo",
    desc: "Filha do Senhor Veríssimo, que cresceu à margem da Ordo Realitas mas acabou profundamente envolvida em seus mistérios mais pessoais. Protagonista central de Enigma do Medo, uma investigação independente que reabriu o caso do desaparecimento da equipe original de seu pai no Castelo Espiral.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Diplomata",
      trilha: "Especialista",
      atrs: {
        agi: 1,
        for: 0,
        int: 4,
        pre: 3,
        vig: 1
      },
      pv: 78,
      pe: 24,
      def: 19,
      fort: "+6",
      ref: "+6",
      vont: "+8",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+6",
          dano: "1d6+0",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Conhecimento",
          elem: "Conhecimento",
          circ: 1
        }
      ],
      habs: "Filha de Veríssimo: acesso a informações e recursos únicos da Ordo Realitas para sua investigação pessoal."
    }
  },
  {
    id: "sofia-besatt",
    nome: "Sofia Besatt",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da equipe original de Veríssimo no Castelo Espiral",
    elemento: null,
    status: "Desaparecido",
    desc: "Uma das agentes da equipe liderada por Veríssimo que investigou o Castelo Espiral anos atrás, missão que terminou em desaparecimento e tragédia para praticamente todo o grupo — o mistério que Mia viria a reabrir em Enigma do Medo.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola tática",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Parte da expedição original ao Castelo Espiral; especialista em reconhecimento de terreno hostil antes do desaparecimento do grupo."
    }
  },
  {
    id: "lethicia-vergeten",
    nome: "Lethicia Vergeten",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Engenheira acústica da Ordo Realitas",
    elemento: "Energia",
    status: "Marcado (hostil)",
    desc: "Engenheira acústica da equipe de Veríssimo, responsável por equipamentos de captação sonora durante a investigação do Castelo Espiral. Após os eventos catastróficos da \"Visão no Perímetro\", transformou-se na entidade conhecida como Espectro Fragmentado, guardiã de uma fenda dimensional e comandante dos E.C.O.S.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Equipamento de captação sonora modificado",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Eco Ressonante (Energia)",
          elem: "Energia",
          circ: 1
        },
        {
          nome: "Ritual menor de Energia",
          elem: "Energia",
          circ: 1
        }
      ],
      habs: "Engenheira Acústica: bônus em testes envolvendo detecção ou manipulação de som e frequências paranormais."
    }
  },
  {
    id: "amy-fiori",
    nome: "Amy Fiori",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da equipe original de Veríssimo",
    elemento: null,
    status: "Desaparecido",
    desc: "Membro da equipe original que acompanhou Veríssimo na investigação do Castelo Espiral, cujo destino final permanece um dos mistérios centrais explorados em Enigma do Medo.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Facão de expedição",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Agente de campo da expedição original ao Castelo Espiral, treinada em sobrevivência em ambientes isolados."
    }
  },
  {
    id: "roberto-monteiro",
    nome: "Roberto Monteiro",
    apelido: "Beto",
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da equipe original de Veríssimo",
    elemento: null,
    status: "Desaparecido",
    desc: "Agente da equipe original de Veríssimo, parte do grupo que adentrou o Castelo Espiral em busca de respostas sobre o paranormal na região — uma missão da qual poucos retornaram inteiros.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Espingarda tática",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Um dos agentes mais experientes da expedição original de Veríssimo, conhecido pelo apelido \"Beto\" entre os colegas."
    }
  },
  {
    id: "tristan-monteiro",
    nome: "Tristan Monteiro",
    apelido: null,
    equipes: [
      "Enigma do Medo",
      "Força D"
    ],
    funcao: "Agente veterano, treinou Fernando e Erin",
    elemento: null,
    status: "Morto",
    desc: "Agente veterano da Ordo Realitas que treinou tanto Erin Parker quanto Fernando Carvalho antes dos eventos de Desconjuração. Também esteve ligado à equipe original de Veríssimo. Sua morte foi um dos eventos emocionalmente mais marcantes vividos por Luciano e sua equipe.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 24,
      fort: "+9",
      ref: "+10",
      vont: "+8",
      ataques: [
        {
          nome: "Fuzil de precisão",
          bonus: "+10",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Treinou tanto Erin Parker quanto Fernando Carvalho — mestre de treinamento tático da Ordem."
    }
  },
  {
    id: "oswaldo-magani",
    nome: "Oswaldo Magani",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da equipe original de Veríssimo",
    elemento: null,
    status: "Desaparecido",
    desc: "Um dos agentes que integrou a expedição original de Veríssimo ao Castelo Espiral, cujo paradeiro final está entrelaçado nos mistérios revelados durante Enigma do Medo.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Machado de bombeiro",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Especialista em arrombamento e infiltração em estruturas comprometidas, essencial na expedição ao Castelo Espiral."
    }
  },
  {
    id: "jorge-laiks",
    nome: "Jorge Laiks",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da equipe original de Veríssimo",
    elemento: "Morte",
    status: "Morto",
    desc: "Agente cujo corpo acabou amalgamado ao de Yuri Strach após anos de exposição à Morte no Castelo Espiral, dando origem à entidade colossal conhecida como Tirano de Lodo — um dos destinos mais trágicos entre os agentes desaparecidos na expedição original.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Especialista",
      atrs: {
        agi: 2,
        for: 1,
        int: 3,
        pre: 2,
        vig: 1
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+4",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+5",
          dano: "1d6+1",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Ritual menor de Morte",
          elem: "Morte",
          circ: 1
        }
      ],
      habs: "Destino selado: seu corpo hoje compõe parte do Tirano de Lodo (ver Bestiário)."
    }
  },
  {
    id: "diogo-laiks",
    nome: "Diogo Laiks",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente ligado à investigação do Castelo Espiral",
    elemento: null,
    status: "Desconhecido",
    desc: "Agente relacionado à família Laiks e à investigação de longa data sobre o Castelo Espiral, cujo papel exato nos eventos de Enigma do Medo permanece um dos pontos mais nebulosos da trama.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Ligado à família Laiks e à investigação de longa data sobre o Castelo Espiral; mantém contatos dentro e fora da Ordem."
    }
  },
  {
    id: "alexsander-kothe",
    nome: "Alexsander Kothe",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Agente novato da primeira temporada (Iniciação)",
    elemento: null,
    status: "Morto",
    desc: "Um dos quatro novatos convocados para investigar o incêndio misterioso na Escola Nostradamus, marcando a primeiríssima missão registrada da série, ao lado de Elizabeth Webber, Thiago Fritz e Daniel Hartmann.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Lanterna tática / cassetete",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Um dos quatro novatos da missão fundadora da série na Escola Nostradamus; ainda em treinamento básico de campo."
    }
  },
  {
    id: "daniel-hartmann",
    nome: "Daniel Hartmann",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Agente novato da primeira temporada (Iniciação)",
    elemento: null,
    status: "Morto",
    desc: "Um dos quatro agentes novatos que formaram a primeiríssima equipe de campo da série, investigando ao lado de Elizabeth Webber, Thiago Fritz e Alexsander Kothe o incêndio paranormal na Escola Nostradamus.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Cassetete",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Um dos quatro novatos da missão fundadora da série na Escola Nostradamus; ainda em treinamento básico de campo."
    }
  },
  {
    id: "ivete-beicur",
    nome: "Ivete Beicur",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Mãe adotiva de Arthur Cervero, ligada à Ordem",
    elemento: null,
    status: "Vivo",
    desc: "Mãe adotiva de Arthur Cervero em Carpazinha, que acabou se tornando uma presença constante e querida junto à Ordo Realitas ao longo de várias temporadas, cuidando dos agentes como uma verdadeira família.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Frigideira de ferro",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Não é agente de combate, mas seu bar em Carpazinha (e depois a base \"Suvaco Seco\") serve de refúgio seguro e centro de apoio emocional para os agentes."
    }
  },
  {
    id: "francisca-parker",
    nome: "Francisca Parker",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Avó de Erin Parker — posteriormente amalgamada ao Anfitrião",
    elemento: "Energia",
    status: "Marcado (hostil)",
    desc: "Avó desaparecida de Erin Parker, cuja voz e imagem foram usadas por Arnaldo Fritz enquanto ele se transformava n'O Anfitrião, revelando uma ligação direta e trágica entre a família Parker e a corrupção do agente veterano.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Voz Emprestada (Energia)",
          elem: "Energia",
          circ: 1
        },
        {
          nome: "Ritual menor de Energia",
          elem: "Energia",
          circ: 1
        }
      ],
      habs: "Sua imagem e voz foram usadas por Arnaldo Fritz durante sua corrupção — hoje seu paradeiro real é desconhecido, possivelmente já consumida pelo Anfitrião."
    }
  },
  {
    id: "gustavo-dohmer",
    nome: "Gustavo Dohmer",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Recruta em treinamento com Elizabeth Webber",
    elemento: null,
    status: "Morto",
    desc: "Novo agente que estava sendo pessoalmente treinado por Elizabeth Webber no momento em que ela desapareceu durante sua investigação individual sobre a Ordem da Desconjuração.",
    ficha: {
      nex: "5%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 24,
      pe: 8,
      def: 14,
      fort: "+3",
      ref: "+3",
      vont: "+3",
      ataques: [
        {
          nome: "Taco de baseball",
          bonus: "+3",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Estava sendo treinado pessoalmente por Elizabeth Webber em técnicas de investigação de campo no momento do desaparecimento dela."
    }
  },
  {
    id: "layla-silva",
    nome: "Layla Silva",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente de apoio durante Desconjuração",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Ordo Realitas que prestou apoio à Força D durante os eventos de Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Agente de apoio logístico mobilizada durante a crise da Ordem da Desconjuração."
    }
  },
  {
    id: "marcela-geleerd",
    nome: "Marcela Geleerd",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente de apoio durante Desconjuração",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Ordo Realitas, parte do círculo de apoio mobilizado durante a crise da Ordem da Desconjuração, ao lado de seu parceiro Renan Geleerd.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Adaga ritualística",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Trabalha em dupla com Renan Geleerd, cobrindo pesquisa teórica enquanto ele atua em campo."
    }
  },
  {
    id: "renan-geleerd",
    nome: "Renan Geleerd",
    apelido: null,
    equipes: [
      "Força D",
      "Equipe Abutres"
    ],
    funcao: "Agente pesquisador — traduziu tábuas sumérias",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Ordo Realitas responsável por traduzir registros sumérios cruciais para a investigação da Força D, continuando a auxiliar a Ordem nos eventos de Calamidade.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Tradutor de tábuas sumérias cruciais para a investigação da Força D; conhecimento de idiomas antigos concede bônus em Investigação histórica."
    }
  },
  {
    id: "paulo-machado",
    nome: "Paulo Machado",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente de apoio durante Desconjuração",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Ordo Realitas que atuou nos bastidores da investigação sobre os Escriptas durante Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Cassetete elétrico",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Agente de apoio nos bastidores da investigação sobre os Escriptas durante Desconjuração."
    }
  },
  {
    id: "walter",
    nome: "Walter",
    apelido: null,
    equipes: [
      "Força D",
      "Lideranca"
    ],
    funcao: "Lojista e fornecedor de equipamentos da Ordem",
    elemento: null,
    status: "Vivo",
    desc: "Responsável por fornecer equipamentos e suprimentos especiais aos agentes da Ordo Realitas, presente desde os primeiros episódios da série até O Segredo na Ilha.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Espingarda (atrás do balcão)",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Fornecedor de equipamentos especiais da Ordem: concede acesso a itens raros fora do inventário padrão, mediante barganha."
    }
  },
  {
    id: "livia-takeda",
    nome: "Lívia Takeda",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Agente em missões de Vendeta Oculta",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Ordo Realitas envolvida nos casos paranormais \"Distúrbio Selvagem\" e \"Coração da Insanidade\", parte do suplemento de missões Vendeta Oculta.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Taser",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Atuou nos casos paranormais \"Distúrbio Selvagem\" e \"Coração da Insanidade\", com experiência lidando com pacientes e ambientes psiquiátricos corrompidos."
    }
  },
  {
    id: "senhor-verissimo-1980",
    nome: "Senhor Veríssimo (1980)",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Versão histórica de um Senhor Veríssimo em 1980",
    elemento: null,
    status: "Morto",
    desc: "Versão histórica de um agente que carregava o codinome \"Senhor Veríssimo\" em 1980, revelada no material de Sobrevivendo ao Horror — uma lembrança de como a identidade era usada por diferentes líderes ao longo da história da Ordem.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Revólver de época",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Versão histórica do codinome \"Senhor Veríssimo\" ativa em 1980 — sugere que a identidade pode ter sido usada por mais de uma pessoa ao longo dos anos."
    }
  },
  {
    id: "caio-leal",
    nome: "Caio Leal",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Recrutador, líder da Equipe de Aurora",
    elemento: null,
    status: "Vivo",
    desc: "Agente responsável por supervisionar a Equipe de Aurora, formada por recrutas da Ordem para investigar os estranhos desaparecimentos na cidade das flores, Aurora, durante o caso \"Os Espinhos da Aurora Escarlate\".",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Recrutador e supervisor da Equipe de Aurora: concede reroll em um teste de perícia de um aliado sob sua supervisão, uma vez por sessão."
    }
  },
  {
    id: "aniela-ukryty",
    nome: "Aniela Ukryty",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Recruta da Equipe de Aurora",
    elemento: null,
    status: "Vivo",
    desc: "Recruta da Ordo Realitas que integrou a Equipe de Aurora no caso paranormal \"Os Espinhos da Aurora Escarlate\".",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Faca de caça",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Recruta da Equipe de Aurora, ainda desenvolvendo experiência de campo no caso \"Os Espinhos da Aurora Escarlate\"."
    }
  },
  {
    id: "bruna-sampaio",
    nome: "Bruna Sampaio",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Recruta da Equipe de Aurora",
    elemento: null,
    status: "Vivo",
    desc: "Recruta da Ordo Realitas que integrou a Equipe de Aurora no caso paranormal \"Os Espinhos da Aurora Escarlate\".",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Soqueira",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Recruta da Equipe de Aurora, ainda desenvolvendo experiência de campo no caso \"Os Espinhos da Aurora Escarlate\"."
    }
  },
  {
    id: "jaime-orthuga",
    nome: "Jaime Orthuga",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Recruta da Equipe de Aurora",
    elemento: null,
    status: "Vivo",
    desc: "Recruta da Ordo Realitas que integrou a Equipe de Aurora no caso paranormal \"Os Espinhos da Aurora Escarlate\".",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Recruta da Equipe de Aurora, ainda desenvolvendo experiência de campo no caso \"Os Espinhos da Aurora Escarlate\"."
    }
  },
  {
    id: "leandro-weiss",
    nome: "Leandro Weiss",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Recruta da Equipe de Aurora",
    elemento: null,
    status: "Vivo",
    desc: "Recruta da Ordo Realitas que integrou a Equipe de Aurora no caso paranormal \"Os Espinhos da Aurora Escarlate\".",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Machadinha",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Recruta da Equipe de Aurora, ainda desenvolvendo experiência de campo no caso \"Os Espinhos da Aurora Escarlate\"."
    }
  },
  {
    id: "mauro-nunes",
    nome: "Mauro Nunes",
    apelido: null,
    equipes: [
      "Lideranca",
      "Os Cinco"
    ],
    funcao: "Agente ligado à Equipe de Aurora e a Morato Vertaler",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Ordo Realitas conectado tanto ao caso da Equipe de Aurora quanto aos eventos investigados por Morato Vertaler em Sinais do Outro Lado.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Sinal Perdido (Conhecimento)",
          elem: "",
          circ: 1
        }
      ],
      habs: "Conectado tanto à Equipe de Aurora quanto às investigações de Morato Vertaler sobre os Alheios em Varminho."
    }
  },
  {
    id: "maya-shizuri",
    nome: "Maya Shizuri",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Recruta da Equipe de Aurora",
    elemento: null,
    status: "Vivo",
    desc: "Recruta da Ordo Realitas que integrou a Equipe de Aurora no caso paranormal \"Os Espinhos da Aurora Escarlate\".",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Katana curta",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Recruta da Equipe de Aurora, ainda desenvolvendo experiência de campo no caso \"Os Espinhos da Aurora Escarlate\"."
    }
  },
  {
    id: "felix-fontana",
    nome: "Felix Fontana",
    apelido: null,
    equipes: [
      "Lideranca"
    ],
    funcao: "Diretor do Setor de Crimes Inabituais (SCI)",
    elemento: null,
    status: "Vivo",
    desc: "Diretor do SCI (Setor de Crimes Inabituais), a divisão de fachada policial criada pela própria Ordo Realitas para encobrir investigações paranormais diante de civis e autoridades.",
    ficha: {
      nex: "65%",
      desl: "12m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 120,
      pe: 34,
      def: 23,
      fort: "+9",
      ref: "+9",
      vont: "+9",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+9",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Diretor do SCI (Setor de Crimes Inabituais): concede acesso a recursos policiais e encobrimento de cena de crime paranormal, mas raramente entra em campo."
    }
  },
  {
    id: "cassiano-menta",
    nome: "Cassiano Menta",
    apelido: null,
    equipes: [
      "Equipe Delta"
    ],
    funcao: "Detetive do Condomínio Azul",
    elemento: null,
    status: "Vivo",
    desc: "Um dos três jovens adultos que se juntaram à Ordem após os eventos de Desconjuração e passaram a investigar como os \"Detetives do Condomínio Azul\".",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Taco de sinuca",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Detetive do Condomínio Azul, com faro para pequenos detalhes fora do lugar em cenas de crime domésticas."
    }
  },
  {
    id: "eduarda-flom",
    nome: "Eduarda Flom",
    apelido: null,
    equipes: [
      "Equipe Delta"
    ],
    funcao: "Detetive do Condomínio Azul",
    elemento: null,
    status: "Vivo",
    desc: "Integrante dos \"Detetives do Condomínio Azul\", equipe formada após os eventos de Desconjuração, também presente em casos investigados durante Vendeta Oculta.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Detetive do Condomínio Azul, também presente em investigações de Vendeta Oculta envolvendo casos de saúde mental corrompidos pelo paranormal."
    }
  },
  {
    id: "hugo-longo",
    nome: "Hugo Longo",
    apelido: null,
    equipes: [
      "Equipe Delta"
    ],
    funcao: "Detetive do Condomínio Azul",
    elemento: null,
    status: "Vivo",
    desc: "Integrante dos \"Detetives do Condomínio Azul\", trio de jovens agentes que começaram a investigar o paranormal após os acontecimentos de Desconjuração e do Natal Macabro.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Chave de fenda longa",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Detetive do Condomínio Azul, com conhecimento técnico de manutenção predial usado a favor das investigações."
    }
  },
  {
    id: "kurt-hemmis",
    nome: "Kurt Hemmis",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente dos Dragões Metálicos",
    elemento: null,
    status: "Morto",
    desc: "Membro da equipe \"Dragões Metálicos\" da Ordo Realitas, que atuou ao lado da Força D durante os eventos de Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Motosserra",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante dos Dragões Metálicos, equipe de apoio pesado da Ordem durante Desconjuração."
    }
  },
  {
    id: "leandro-hans",
    nome: "Leandro Hans",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente dos Dragões Metálicos",
    elemento: null,
    status: "Morto",
    desc: "Membro da equipe \"Dragões Metálicos\" da Ordo Realitas, que atuou ao lado da Força D durante os eventos de Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Machado de bombeiro",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante dos Dragões Metálicos, equipe de apoio pesado da Ordem durante Desconjuração."
    }
  },
  {
    id: "marcos-front",
    nome: "Marcos Front",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente dos Dragões Metálicos",
    elemento: null,
    status: "Morto",
    desc: "Membro da equipe \"Dragões Metálicos\" da Ordo Realitas, que atuou ao lado da Força D durante os eventos de Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Marreta",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante dos Dragões Metálicos, equipe de apoio pesado da Ordem durante Desconjuração."
    }
  },
  {
    id: "roberto-lutrijo",
    nome: "Roberto Lutrijo",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente dos Dragões Metálicos",
    elemento: null,
    status: "Morto",
    desc: "Membro da equipe \"Dragões Metálicos\" da Ordo Realitas, que atuou ao lado da Força D durante os eventos de Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Escopeta tática",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante dos Dragões Metálicos, equipe de apoio pesado da Ordem durante Desconjuração."
    }
  },
  {
    id: "leticia-mantra",
    nome: "Letícia Mantra",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente da Equipe de Pesquisa da Ordem",
    elemento: null,
    status: "Vivo",
    desc: "Integrante da Equipe de Pesquisa da Ordo Realitas, responsável pelo suporte de investigação teórica e ocultista durante os eventos de Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Grimório de anotações",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Pesquisa Acelerada (Conhecimento)",
          elem: "",
          circ: 1
        }
      ],
      habs: "Integrante da Equipe de Pesquisa: concede bônus retroativo em um teste de Ocultismo já realizado pelo grupo, uma vez por sessão."
    }
  },
  {
    id: "alexia-grifo",
    nome: "Alexia Grifo",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente da Equipe Espiãs",
    elemento: null,
    status: "Morto",
    desc: "Integrante da Equipe Espiãs da Ordo Realitas, ao lado de Clarissa Leão e Samantha Hale, morta durante o Dia Final da Desconjuração após ser forçada por Gal a explodir sua própria cabeça.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola silenciada",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da Equipe Espiãs, especializada em infiltração e reconhecimento discreto."
    }
  },
  {
    id: "samantha-hale",
    nome: "Samantha Hale",
    apelido: null,
    equipes: [
      "Força D"
    ],
    funcao: "Agente da Equipe Espiãs",
    elemento: null,
    status: "Morto",
    desc: "Integrante da Equipe Espiãs da Ordo Realitas, ferida mortalmente por Clarissa Leão sob controle mental de Gal durante o confronto final de Desconjuração.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Facas de arremesso",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da Equipe Espiãs, especializada em combate furtivo e neutralização silenciosa de alvos."
    }
  },
  {
    id: "kenan-thomas",
    nome: "Kenan Thomas",
    apelido: null,
    equipes: [
      "Equipe E"
    ],
    funcao: "Agente veterano da Equipe Kelvin",
    elemento: null,
    status: "Morto",
    desc: "Membro da Equipe Kelvin, o grupo de agentes veteranos enviado a Carpazinha antes da Equipe E, cujo desaparecimento motivou toda a investigação de O Segredo na Floresta.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 20,
      fort: "+7",
      ref: "+7",
      vont: "+7",
      ataques: [
        {
          nome: "Espingarda",
          bonus: "+7",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da veterana Equipe Kelvin, cujo desaparecimento em Carpazinha deu início à investigação de O Segredo na Floresta."
    }
  },
  {
    id: "mariana-larona",
    nome: "Mariana Larona",
    apelido: null,
    equipes: [
      "Equipe E"
    ],
    funcao: "Agente veterana da Equipe Kelvin",
    elemento: null,
    status: "Morto",
    desc: "Membro da Equipe Kelvin, o grupo de agentes veteranos que desapareceu misteriosamente em Carpazinha antes dos eventos de O Segredo na Floresta.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da veterana Equipe Kelvin, cujo desaparecimento em Carpazinha deu início à investigação de O Segredo na Floresta."
    }
  },
  {
    id: "miguel-cariad",
    nome: "Miguel Cariad",
    apelido: null,
    equipes: [
      "Equipe E"
    ],
    funcao: "Agente veterano da Equipe Kelvin",
    elemento: null,
    status: "Morto",
    desc: "Membro da Equipe Kelvin, o grupo de agentes veteranos que desapareceu misteriosamente em Carpazinha antes dos eventos de O Segredo na Floresta.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 20,
      fort: "+7",
      ref: "+7",
      vont: "+7",
      ataques: [
        {
          nome: "Facão",
          bonus: "+7",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da veterana Equipe Kelvin, cujo desaparecimento em Carpazinha deu início à investigação de O Segredo na Floresta."
    }
  },
  {
    id: "alan-portlash",
    nome: "Alan Portlash",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da Equipe Elite",
    elemento: null,
    status: "Desconhecido",
    desc: "Membro da Equipe Elite da Ordo Realitas, parte da expedição original que investigou o Castelo Espiral anos antes dos eventos de Enigma do Medo.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 20,
      fort: "+7",
      ref: "+7",
      vont: "+7",
      ataques: [
        {
          nome: "Espada longa",
          bonus: "+7",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da Equipe Elite na expedição original ao Castelo Espiral, irmão de Theo Portlash."
    }
  },
  {
    id: "calisto-besatt",
    nome: "Calisto Besatt",
    apelido: null,
    equipes: [
      "Enigma do Medo",
      "Os Cinco"
    ],
    funcao: "Agente da Equipe Elite, ligado a Sinais do Outro Lado",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Ordo Realitas que se apresentou a \"Os Cinco\" em Varminho como membro de uma organização, revelando conhecimento sobre o desaparecimento de Morato Vertaler. Também parte da Equipe Elite ligada a Enigma do Medo.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 20,
      fort: "+7",
      ref: "+7",
      vont: "+7",
      ataques: [
        {
          nome: "Bastão retrátil",
          bonus: "+7",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Rastreio Espectral (Conhecimento)",
          elem: "",
          circ: 1
        }
      ],
      habs: "Contatou \"Os Cinco\" em Varminho sobre o desaparecimento de Morato Vertaler; também vinculado à Equipe Elite de Enigma do Medo."
    }
  },
  {
    id: "fernanda-silvino",
    nome: "Fernanda Silvino",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da Equipe Elite",
    elemento: null,
    status: "Desconhecido",
    desc: "Membro da Equipe Elite da Ordo Realitas, parte da expedição original que investigou o Castelo Espiral anos antes dos eventos de Enigma do Medo.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 20,
      fort: "+7",
      ref: "+7",
      vont: "+7",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+7",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da Equipe Elite na expedição original ao Castelo Espiral."
    }
  },
  {
    id: "rossi-ferrero",
    nome: "Rossi Ferrero",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da Equipe Elite",
    elemento: null,
    status: "Desconhecido",
    desc: "Membro da Equipe Elite da Ordo Realitas (nome completo Daniel Ferrero de Rossi), parte da expedição original que investigou o Castelo Espiral anos antes dos eventos de Enigma do Medo.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 20,
      fort: "+7",
      ref: "+7",
      vont: "+7",
      ataques: [
        {
          nome: "Adaga",
          bonus: "+7",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da Equipe Elite (nome completo Daniel Ferrero de Rossi), parte da expedição original ao Castelo Espiral."
    }
  },
  {
    id: "theo-portlash",
    nome: "Theo Portlash",
    apelido: null,
    equipes: [
      "Enigma do Medo"
    ],
    funcao: "Agente da Equipe Elite",
    elemento: null,
    status: "Desconhecido",
    desc: "Membro da Equipe Elite da Ordo Realitas (nome completo Uriel Theodoro Portlash), parte da expedição original que investigou o Castelo Espiral anos antes dos eventos de Enigma do Medo.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 20,
      fort: "+7",
      ref: "+7",
      vont: "+7",
      ataques: [
        {
          nome: "Espada longa",
          bonus: "+7",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da Equipe Elite (nome completo Uriel Theodoro Portlash), irmão de Alan Portlash, parte da expedição original ao Castelo Espiral."
    }
  },
  {
    id: "samuel-norte",
    nome: "Samuel Norte",
    apelido: null,
    equipes: [
      "Enigma do Medo",
      "Força D"
    ],
    funcao: "Agente que ajudou Rubens e Johnny a investigar O Anfitrião",
    elemento: null,
    status: "Vivo",
    desc: "Agente da Ordo Realitas que auxiliou Rubens Naluti e Johnny Tabasco em suas investigações sobre O Anfitrião, também presente nos eventos ligados a Enigma do Medo.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Auxiliou Rubens Naluti e Johnny Tabasco nas investigações sobre O Anfitrião, com conhecimento tático valioso sobre a entidade."
    }
  },
  {
    id: "jasper",
    nome: "Jasper",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente da Ordem em Hexatombe",
    elemento: null,
    status: "Morto",
    desc: "Um dos cinco agentes da Ordo Realitas que passaram por um ritual para ocupar corpos de assassinos e investigar o submundo ocultista durante Hexatombe.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Corpo de assassino: adagas gêmeas",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Um dos cinco agentes que ocuparam corpos de assassinos via ritual para investigar o submundo ocultista durante Hexatombe."
    }
  },
  {
    id: "lena-viegas",
    nome: "Lena Viegas",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente da Ordem em Hexatombe",
    elemento: null,
    status: "Vivo",
    desc: "Uma dos cinco agentes da Ordo Realitas que passaram por um ritual para ocupar corpos de assassinos e investigar o submundo ocultista durante Hexatombe.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Corpo de assassino: rifle de precisão",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Uma dos cinco agentes que ocuparam corpos de assassinos via ritual para investigar o submundo ocultista durante Hexatombe."
    }
  },
  {
    id: "maria-helena-rodrigues",
    nome: "Maria Helena Rodrigues",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente da Ordem em Hexatombe",
    elemento: null,
    status: "Morto",
    desc: "Uma dos cinco agentes da Ordo Realitas que passaram por um ritual para ocupar corpos de assassinos e investigar o submundo ocultista durante Hexatombe.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Corpo de assassino: facão",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Uma dos cinco agentes que ocuparam corpos de assassinos via ritual para investigar o submundo ocultista durante Hexatombe."
    }
  },
  {
    id: "remi",
    nome: "Remi",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente da Ordem em Hexatombe",
    elemento: null,
    status: "Vivo",
    desc: "Um dos cinco agentes da Ordo Realitas que passaram por um ritual para ocupar corpos de assassinos e investigar o submundo ocultista durante Hexatombe.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Corpo de assassino: pistolas duplas",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Um dos cinco agentes que ocuparam corpos de assassinos via ritual para investigar o submundo ocultista durante Hexatombe."
    }
  },
  {
    id: "tuco-belez",
    nome: "Tuco Belez",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente da Ordem em Hexatombe",
    elemento: null,
    status: "Morto",
    desc: "Um dos cinco agentes da Ordo Realitas que passaram por um ritual para ocupar corpos de assassinos durante Hexatombe, cuja missão terminou em tragédia.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Corpo de assassino: machadinha",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Um dos cinco agentes que ocuparam corpos de assassinos via ritual durante Hexatombe, cuja missão terminou em tragédia."
    }
  },
  {
    id: "juan-henri",
    nome: "Juan",
    apelido: "Henri",
    apelido2: "Lúcio Davo",
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Ex-Escripta que se tornou o portador definitivo da Relíquia de Sangue",
    elemento: "Sangue",
    status: "Marcado (hostil)",
    desc: "Órfão do Orfanato Santa Menefreda que se tornou um Escripta obcecado por Sangue sob o nome Henri, fazendo um Pacto para se tornar Marcado. Após vencer o Hexatombe e aceitar um novo começo sob o nome Juan, tornou-se o portador definitivo do Trono — a Relíquia de Sangue — hoje amalgamado ao próprio Diabo.",
    ficha: {
      nex: "99%",
      desl: "15m",
      origem: "Religioso",
      trilha: "Especialista",
      atrs: {
        agi: 1,
        for: 0,
        int: 4,
        pre: 3,
        vig: 1
      },
      pv: 240,
      pe: 60,
      def: 29,
      fort: "+13",
      ref: "+13",
      vont: "+15",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+13",
          dano: "1d6+0",
          tipo: "físico"
        }
      ],
      rituais: [
        {
          nome: "Pacto de Sangue (1° círculo)",
          elem: "Sangue",
          circ: 1
        }
      ],
      habs: "Portador do Trono: hoje amalgamado ao próprio Diabo, controlando a Relíquia de Sangue em sua forma mais pura."
    }
  },
  {
    id: "amelie-florence",
    nome: "Amelie Florence",
    apelido: null,
    equipes: [
      "Os Cinco"
    ],
    funcao: "Investigadora em O Segredo na Ilha",
    elemento: null,
    status: "Vivo",
    desc: "Uma das investigadoras envolvidas no mistério do desaparecimento do pintor Constantino Moretti na Ilha de Tipora, durante o spin-off O Segredo na Ilha.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Lanterna / cassetete",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Investigadora do desaparecimento do pintor Constantino Moretti na Ilha de Tipora, ligada à família Florence."
    }
  },
  {
    id: "barbara-lima",
    nome: "Bárbara Lima",
    apelido: null,
    equipes: [
      "Os Cinco"
    ],
    funcao: "Investigadora em O Segredo na Ilha",
    elemento: null,
    status: "Morto",
    desc: "Uma das investigadoras envolvidas no mistério da Ilha de Tipora durante o spin-off O Segredo na Ilha, uma das baixas trágicas do caso.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Facão de mata",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Investigadora do mistério da Ilha de Tipora, uma das baixas trágicas do caso."
    }
  },
  {
    id: "milo-castello",
    nome: "Milo Castello",
    apelido: null,
    equipes: [
      "Os Cinco"
    ],
    funcao: "Investigador em O Segredo na Ilha",
    elemento: null,
    status: "Morto",
    desc: "Um dos investigadores envolvidos no mistério da Ilha de Tipora durante o spin-off O Segredo na Ilha.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Investigador do mistério da Ilha de Tipora."
    }
  },
  {
    id: "olivier-florence",
    nome: "Olivier Florence",
    apelido: null,
    equipes: [
      "Os Cinco"
    ],
    funcao: "Investigador em O Segredo na Ilha",
    elemento: null,
    status: "Vivo",
    desc: "Um dos investigadores envolvidos no mistério do desaparecimento do pintor Constantino Moretti na Ilha de Tipora.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Bengala reforçada",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Investigador do desaparecimento do pintor Constantino Moretti na Ilha de Tipora, ligado à família Florence."
    }
  },
  {
    id: "wanderley-nascimento",
    nome: "Wanderley Nascimento de Jesus Maria",
    apelido: null,
    equipes: [
      "Os Cinco"
    ],
    funcao: "Investigador em O Segredo na Ilha",
    elemento: null,
    status: "Morto",
    desc: "Um dos investigadores envolvidos no mistério da Ilha de Tipora durante o spin-off O Segredo na Ilha, uma das baixas do caso.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola disfarçada de caneta",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Metade da dupla de agentes disfarçados de corretores imobiliários (com Cavalcante Bueno), especializados em investigações discretas de propriedades suspeitas."
    }
  },
  {
    id: "cavalcante-bueno",
    nome: "Cavalcante Bueno",
    apelido: null,
    equipes: [
      "Os Cinco"
    ],
    funcao: "Agente disfarçado de corretor de imóveis",
    elemento: null,
    status: "Morto",
    desc: "Metade da dupla de Cavalcante e Wanderley, agentes que atuavam sob disfarce de corretores imobiliários para investigar o paranormal com discrição — case notável sendo o desaparecimento na Ilha de Tipora.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Pistola disfarçada de caneta",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Metade da dupla de agentes disfarçados de corretores imobiliários (com Wanderley Nascimento), especializados em investigações discretas de propriedades suspeitas."
    }
  },
  {
    id: "carla-leone",
    nome: "Carla Leone",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Psiquiatra da Família Leone, irmã mais velha de Carina",
    elemento: null,
    status: "Vivo",
    desc: "Psiquiatra e irmã mais velha de Carina Leone, enviada ao Brasil junto de outros membros da família para reforçar a Ordo Realitas após o decreto de estado de emergência paranormal causado por Kian. Por sua função, raramente participa de missões de campo.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Acadêmico",
      trilha: "Especialista",
      atrs: {
        agi: 1,
        for: 0,
        int: 4,
        pre: 2,
        vig: 1
      },
      pv: 46,
      pe: 16,
      def: 16,
      fort: "+4",
      ref: "+4",
      vont: "+5",
      ataques: [
        {
          nome: "Ataque desarmado",
          bonus: "+4",
          dano: "1d6+0",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Psiquiatra da Família Leone: raramente entra em campo, mas oferece apoio psicológico crucial à equipe."
    }
  },
  {
    id: "fabrizio-leone",
    nome: "Fabrizio Leone",
    apelido: "Zio",
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente de elite da Família Leone, primo de Carina",
    elemento: null,
    status: "Vivo",
    desc: "Agente de elite e primo de Carina Leone, enviado ao Brasil para reforçar a Ordem contra Kian. Ficou tetraplégico após ser esmagado pelo Carniçal da Esfinge durante a defesa da Mansão Leone, mas sobreviveu ao ataque.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Atleta",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 18,
      fort: "+5",
      ref: "+6",
      vont: "+4",
      ataques: [
        {
          nome: "Bastão retrátil",
          bonus: "+6",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Ficou tetraplégico após o combate contra o Carniçal da Esfinge — ficha reflete seu estado anterior ao ferimento."
    }
  },
  {
    id: "giuseppe-leone",
    nome: "Giuseppe Leone",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente de elite da Família Leone",
    elemento: null,
    status: "Vivo",
    desc: "Agente de elite italiano da Família Leone, convocado ao Brasil ao lado de Antonella, Fabrizio, Carla e Carina para reforçar o combate contra Kian e os Escriptas durante Calamidade.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 21,
      fort: "+7",
      ref: "+8",
      vont: "+6",
      ataques: [
        {
          nome: "Espingarda",
          bonus: "+8",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Agente de elite da Família Leone, treinado desde jovem no combate anti-paranormal."
    }
  },
  {
    id: "antonella-leone",
    nome: "Antonella Leone",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente de elite da Família Leone",
    elemento: null,
    status: "Vivo",
    desc: "Agente de elite da Família Leone, convocada ao Brasil para reforçar o combate contra Kian durante Calamidade, lutando ao lado de Jiro Yukami na guerra do Coliseu.",
    ficha: {
      nex: "45%",
      desl: "9m",
      origem: "Militar",
      trilha: "Combatente",
      atrs: {
        agi: 3,
        for: 3,
        int: 0,
        pre: 1,
        vig: 2
      },
      pv: 78,
      pe: 24,
      def: 21,
      fort: "+7",
      ref: "+8",
      vont: "+6",
      ataques: [
        {
          nome: "Chicote de aço",
          bonus: "+8",
          dano: "2d6+3",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Agente de elite da Família Leone, lutou ao lado de Jiro Yukami na guerra do Coliseu."
    }
  },
  {
    id: "lorenzo-leone",
    nome: "Lorenzo Leone",
    apelido: null,
    equipes: [
      "Equipe Abutres"
    ],
    funcao: "Agente da Família Leone",
    elemento: null,
    status: "Morto",
    desc: "Integrante da Família Leone que reforçou a defesa da Mansão Leone durante a invasão dos Escriptas em Calamidade, morto por uma flechada de T-Bag.",
    ficha: {
      nex: "25%",
      desl: "9m",
      origem: "Investigador",
      trilha: "Combatente",
      atrs: {
        agi: 2,
        for: 2,
        int: 2,
        pre: 2,
        vig: 2
      },
      pv: 46,
      pe: 16,
      def: 17,
      fort: "+5",
      ref: "+5",
      vont: "+5",
      ataques: [
        {
          nome: "Espingarda",
          bonus: "+5",
          dano: "1d6+2",
          tipo: "físico"
        }
      ],
      rituais: [],
      habs: "Integrante da Família Leone que ajudou a defender a Mansão Leone durante a invasão dos Escriptas em Calamidade."
    }
  }
];

function renderAgentesTab(){
  filtrarAgentes('todas');
}

function _agenteFiltroAtual(){
  const chips = document.querySelectorAll('#tab-agentes .cr-chip');
  for(const c of chips) if(c.dataset.active === 'true') return c.dataset.eq;
  return 'todas';
}

function filtrarAgentes(equipe){
  const t = equipe !== undefined ? equipe : _agenteFiltroAtual();
  if(equipe !== undefined){
    document.querySelectorAll('#tab-agentes .cr-chip').forEach(b=>{
      b.dataset.active = (b.dataset.eq === t) ? 'true' : 'false';
    });
  }

  const g = document.getElementById('agentes-grid');
  if(!g) return;
  const termo = (document.getElementById('ag-search-inp')?.value || '').trim().toLowerCase();

  let lista = t==='todas' ? AGENTES.slice() : AGENTES.filter(a=>a.equipes.includes(t));
  if(termo) lista = lista.filter(a=>a.nome.toLowerCase().includes(termo) || (a.apelido||'').toLowerCase().includes(termo));

  const count = document.getElementById('agentes-count');
  if(count) count.textContent = `${lista.length} agente${lista.length===1?'':'s'} encontrado${lista.length===1?'':'s'}`;

  if(!lista.length){
    g.innerHTML = `<div class="cr-empty">◍ Nenhum agente corresponde à busca.</div>`;
    return;
  }

  g.innerHTML = lista.map(a=>{
    const cor = corStatusAgente[a.status] || '#888';
    return `
    <div class="cr-card" onclick="verAgente('${a.id}')">
      <div class="cr-card-bar" style="background:${cor}"></div>
      <div class="cr-card-body">
        <div class="cr-card-head">
          <div class="cr-card-name">${a.nome}${a.apelido ? ` <span style="font-weight:400;opacity:.7">"${a.apelido}"</span>` : ''}</div>
          <span class="cr-badge" style="border-color:${cor};color:${cor}">${a.status}</span>
        </div>
        <div class="cr-tipo-tag">${a.funcao}</div>
        <div class="cr-stats-row">
          <span>Equipe(s) <b style="color:var(--white-ash)">${a.equipes.filter(e=>e!=='Lideranca').join(', ') || 'Liderança'}</b></span>
          <span>NEX <b style="color:var(--gold-light)">${a.ficha?.nex || '—'}</b></span>
        </div>
        <div class="cr-card-desc">${a.desc.substring(0,90)}…</div>
        <div class="cr-card-cta">VER FICHA COMPLETA →</div>
      </div>
    </div>`;
  }).join('');
}

function verAgente(id){
  const a = AGENTES.find(x=>x.id===id);
  if(!a) return;
  const cor = corStatusAgente[a.status] || '#888';
  const f = a.ficha || {};
  const at = f.atrs || {};

  let html = `
    <div class="cr-det-head">
      <div class="cr-det-name">${a.nome}${a.apelido ? ` <span style="font-weight:400;opacity:.7">"${a.apelido}"</span>` : ''}</div>
      <span class="cr-badge" style="border-color:${cor};color:${cor};font-size:11px;padding:4px 12px">${a.status}</span>
    </div>
    <div class="cr-det-tipo">${a.funcao}${f.nex?` · NEX ${f.nex}`:''}${f.desl?` · DesL ${f.desl}`:''}</div>
    <p class="cr-det-desc">${a.desc}</p>`;

  // ── PV / PE — MESMAS classes .stat-box/.snum da ficha de player ──
  html += `<div class="stat-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px">
    <div class="stat-box vital-box">
      <div class="stat-name">Pontos de Vida</div>
      <span class="snum pv">${f.pv||0}</span>
    </div>
    <div class="stat-box vital-box">
      <div class="stat-name">Pontos de Esforço</div>
      <span class="snum esf">${f.pe||0}</span>
    </div>
  </div>`;

  // ── Atributos — MESMA roda hexagonal da ficha de player (somente leitura, sem botões +/-) ──
  html += `<div class="attr-hex-wrap" style="margin-bottom:10px">
    <svg class="attr-hex-bg" viewBox="0 0 280 240" preserveAspectRatio="xMidYMid meet">
      <polygon points="140,6 262,74 262,178 140,234 18,178 18,74" fill="none" stroke="var(--blood-deep)" stroke-width="1.4"/>
      <polygon points="140,30 234,84 234,168 140,214 46,168 46,84" fill="none" stroke="var(--crimson)" stroke-width="0.6" opacity="0.3"/>
    </svg>
    <div class="attr-hex-center">ATRIBUTOS</div>`;
  ATTRS.forEach(full=>{
    const abbr = ATTR_ABBR[full];
    const pos = ATTR_POS[full];
    const v = at[abbr.toLowerCase()] ?? 0; const s = v>=0 ? '+'+v : v;
    html += `<div class="attr-node" style="top:${pos.top};left:${pos.left}">
      <div class="attr-node-circle"><span class="attr-node-val">${s}</span></div>
      <div class="attr-node-label">${abbr}</div>
    </div>`;
  });
  html += `</div>`;

  // ── Defesa / Resistências — MESMO grid .defesa-box da ficha de player ──
  html += `<div class="defesa-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">`;
  [['Defesa',f.def],['Fortitude',f.fort||'—'],['Reflexos',f.ref||'—'],['Vontade',f.vont||'—']].forEach(([lbl,val])=>{
    html += `<div class="stat-box defesa-box"><div class="stat-name">${lbl}</div><div class="defesa-val">${val}</div></div>`;
  });
  html += `</div>`;

  // ── Ataques — MESMA tabela .ataque-row da ficha de player ──
  if(f.ataques && f.ataques.length){
    html += `<div class="cr-sec-label">Ataques</div>
      <div class="ataque-table-head"><span>Arma</span><span>Teste</span><span>Dano</span><span>Especial</span></div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:16px">`;
    f.ataques.forEach(atk=>{
      html += `<div class="ataque-row">
        <div class="ataque-col-arma">${atk.nome}</div>
        <div class="ataque-col-teste">${atk.bonus||'—'}</div>
        <div class="ataque-col-dano">${atk.dano||'—'}</div>
        <div class="ataque-col-especial">${atk.tipo||'—'}</div>
      </div>`;
    });
    html += `</div>`;
  }

  // ── Habilidades — MESMO list-item/badge da ficha de player ──
  if(f.habs && f.habs.trim()){
    html += `<div class="cr-sec-label">Habilidades</div>
      <div style="margin-bottom:16px"><div class="list-item"><div class="list-body"><span class="badge badge-h">Habilidade</span><span style="white-space:pre-line">${f.habs}</span></div></div></div>`;
  }

  // Origem / Trilha
  if((f.origem&&f.origem.trim())||(f.trilha&&f.trilha.trim())){
    html += `<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      ${f.origem?`<div style="flex:1;min-width:120px"><div class="stat-name" style="text-align:left;margin-bottom:3px">Origem</div><div style="font-size:12px;color:var(--white-ash);font-family:'Courier Prime',monospace">${f.origem}</div></div>`:''}
      ${f.trilha?`<div style="flex:1;min-width:120px"><div class="stat-name" style="text-align:left;margin-bottom:3px">Trilha</div><div style="font-size:12px;color:var(--white-ash);font-family:'Courier Prime',monospace">${f.trilha}</div></div>`:''}
    </div>`;
  }

  // ── Rituais conhecidos — MESMO badge-r usado para rituais na ficha de player ──
  if(f.rituais && f.rituais.length){
    html += `<div class="cr-sec-label">Rituais Conhecidos</div>
      <div style="margin-bottom:16px">${f.rituais.map(r=>`<div class="list-item"><div class="list-body"><span class="badge badge-r">Ritual</span>${r.nome}${r.elem?` <span class="list-meta" style="display:inline">${r.elem}</span>`:''}${r.circ?` <span class="list-meta" style="display:inline;color:var(--gold-light)">${r.circ}°</span>`:''}</div></div>`).join('')}</div>`;
  }

  html += `<div class="cr-sec-label">Equipes / Temporadas</div>
    <div>${a.equipes.map(e=>`<div class="list-item"><div class="list-body">${e==='Lideranca'?'Liderança da Ordem':e}</div></div>`).join('')}</div>`;

  abrirModalDetalhe(html);
}
