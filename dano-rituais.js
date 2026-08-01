/* ════════════════════════════════════════════════════════════
   DANO-RITUAIS.JS — Patches de dano nos Rituais
   ────────────────────────────────────────────────────────────
   Arquivo ISOLADO do app.js de propósito.

   Por quê: este arquivo injeta os campos `dam` e `tipoDano`
   em entradas já existentes de RITUAIS_DB (que é declarado lá
   no app.js). Para isso funcionar, ele PRECISA rodar depois
   que RITUAIS_DB já existir.

   Regra de ouro: este <script> é carregado no index.html
   LOGO APÓS o <script src="app.js">. Nunca mova este arquivo
   para antes do app.js, e nunca cole este código de volta
   dentro do app.js — foi exatamente fazer isso (colocar este
   bloco antes da declaração de RITUAIS_DB) que quebrou o site
   inteiro numa versão anterior (ReferenceError de TDZ em
   `const RITUAIS_DB`, que travava todo o app.js e impedia até
   o cursor e a música de inicializar).

   Se precisar adicionar/editar danos de rituais, mexa só aqui.
   ════════════════════════════════════════════════════════════ */

/* Mapa elemento → tipoDano paranormal (usado também como fallback) */
const ELEM_TIPO_DANO = {
  'Sangue':      'S',
  'Morte':       'M',
  'Energia':     'E',
  'Conhecimento':'K',
  'Medo':        'Me',
};

function patchRituaisDano(){
  const patches = {
    // ── Sangue ──
    'Perfurar Pele':         { dam:'2d6+2',  tipoDano:'S' },
    'Flagelo de Sangue':     { dam:'4d8',    tipoDano:'S' },
    'Hemofagia':             { dam:'2d6',    tipoDano:'S' },
    'Contágio de Sangue':    { dam:'3d8',    tipoDano:'S' },
    'Dilúvio de Sangue':     { dam:'6d10',   tipoDano:'S' },
    'Forma Bestial':         { dam:'2d8',    tipoDano:'S' },
    // ── Morte ──
    'Decadência':            { dam:'2d8+2',  tipoDano:'M' },
    'Garras do Abismo':      { dam:'2d6',    tipoDano:'M' },
    'Apodrecer':             { dam:'2d8+2',  tipoDano:'M' },
    'Poeira da Podridão':    { dam:'3d6',    tipoDano:'M' },
    'Tentáculos de Lodo':    { dam:'2d8',    tipoDano:'M' },
    'Derreter Sangue':       { dam:'5d8+5',  tipoDano:'M' },
    'Sugada Mortal':         { dam:'4d8',    tipoDano:'M' },
    'Tempestade de Cinzas':  { dam:'4d6',    tipoDano:'M' },
    'Apocalipse da Entropia':{ dam:'5d8',    tipoDano:'M' },
    // ── Energia ──
    'Eletrocussão':          { dam:'3d6',    tipoDano:'E' },
    'Explosão Caótica':      { dam:'4d6+4',  tipoDano:'E' },
    'Deflagração de Energia':{ dam:'6d10',   tipoDano:'E' },
    'Milagre Ionizante':     { dam:'6d8',    tipoDano:'E' },
    'Queimar Distorção':     { dam:'5d6',    tipoDano:'E' },
    'Rajada Ionizante':      { dam:'10d6',   tipoDano:'E' },
    'Tempestade de Energia': { dam:'8d10',   tipoDano:'E' },
    'Pulso Eletromagnético': { dam:'3d6',    tipoDano:'E' },
    // ── Conhecimento ──
    'Raio Cognitivo':        { dam:'2d8',    tipoDano:'K' },
    'Sobrecarga Mental':     { dam:'4d8',    tipoDano:'K' },
    'Ruptura Cognitiva':     { dam:'6d8',    tipoDano:'K' },
    'Paradoxo Ontológico':   { dam:'8d10',   tipoDano:'K' },
    // ── Medo ──
    'Pesadelo Tangível':     { dam:'2d8',    tipoDano:'Me' },
    'Gritar no Vazio':       { dam:'3d8',    tipoDano:'Me' },
    'Incarnação do Terror':  { dam:'4d8',    tipoDano:'Me' },
    'Catástrofe Fóbica':     { dam:'6d10',   tipoDano:'Me' },
  };

  if (typeof RITUAIS_DB === 'undefined') {
    console.error('[dano-rituais.js] RITUAIS_DB não está definido ainda. Verifique a ordem dos <script> no index.html (app.js deve vir ANTES deste arquivo).');
    return;
  }

  RITUAIS_DB.forEach(r => {
    const p = patches[r.nome];
    if(p){ r.dam = p.dam; r.tipoDano = p.tipoDano; }
    // Para rituais sem patch explícito, herda tipoDano do elemento
    else if(ELEM_TIPO_DANO[r.elem] && !r.tipoDano) {
      // Detecta dano no efeito pelo padrão "Xd Y de dano de Elemento"
      const m = r.efeito.match(/(\d+d\d+(?:[+-]\d+)?)\s+de\s+dano\s+de\s+\w+/i);
      if(m){ r.dam = m[1]; r.tipoDano = ELEM_TIPO_DANO[r.elem]; }
    }
  });
}

// Executa imediatamente — seguro aqui porque este arquivo só é
// carregado DEPOIS do app.js no index.html (ver comentário acima).
patchRituaisDano();
