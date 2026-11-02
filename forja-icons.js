/* ════════════════════════════════════════════════════════════
   FORJA-ICONS.JS — ícones de traço (SVG inline) da Forja
   Substitui todos os emojis. Cada ícone herda `currentColor`.
   API:
     FJI.svg('espada')            → <svg class="fji">…</svg>
     FJI.html(valor, padrao)      → aceita nome, emoji legado ou vazio
     FJI.fromLegacy(valorAntigo)  → nome do ícone (ex.: 'adaga')
   Carregar ANTES de forja.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const P = {
  /* ── armas e itens ── */
  espada:  '<path d="M20 4v4.5L11 17.5 6.5 13 15.5 4z"/><path d="M4 20l3.5-3.5"/><path d="M5.5 11.5 12.5 18.5"/>',
  adaga:   '<path d="M18 3l3 3-6.5 6.5-3-3z"/><path d="M11.5 9.5 7 14"/><path d="M5.5 12.5l6 6"/><path d="M4 20l3-3"/>',
  machado: '<path d="M7 21 15 5"/><path d="M13 4c4-1.5 7.5.5 8 4.5-3.5 1-6-.5-8-4.5z"/><path d="M13 4c-.5 3 .5 6 3 8"/>',
  martelo: '<rect x="3.5" y="4" width="12" height="6" rx="1"/><path d="M9.5 10v11"/><path d="M15.5 6H19v2.5h-3.5"/>',
  arco:    '<path d="M5 3c10 2 16 8 16 18"/><path d="M5 3 21 21"/><path d="M12 12l-7 7"/><path d="M5 19h3.5M5 19v-3.5"/>',
  pistola: '<path d="M3 7h15v4.5h-6l-.8 5H7.5l1-5H3z"/><path d="M18 9h3"/><path d="M13 11.5v2.5"/>',
  bomba:   '<circle cx="10.5" cy="14.5" r="6.5"/><path d="M15 9.5l3-3"/><path d="M18 3v3M21.5 6.5h-3M20.2 3.8l-1.4 1.4"/>',
  tesoura: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8 8l12 9.5M8 16l12-9.5"/>',
  corrente:'<path d="M10 14l-2 2a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0"/><path d="M14 10l2-2a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0"/><path d="M9.5 14.5l5-5"/>',
  tridente:'<path d="M12 21V8"/><path d="M6 4v4.5a6 6 0 0 0 12 0V4"/><path d="M12 3v5"/><path d="M9.5 21h5"/>',
  osso:    '<path d="M6.2 5.2a2.2 2.2 0 1 0-3 3L4 9l11 11 .8.8a2.2 2.2 0 1 0 3-3L18 17 7 6z"/>',
  gota:    '<path d="M12 3c4 5 6.5 8.2 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 11.2 8 8 12 3z"/><path d="M9 15a3 3 0 0 0 2.5 3"/>',
  cranio:  '<path d="M12 3a8 8 0 0 0-8 8c0 3.2 1.6 4.8 3.2 5.8V20h9.6v-3.2C18.4 15.8 20 14.2 20 11a8 8 0 0 0-8-8z"/><circle cx="8.8" cy="11.5" r="1.8"/><circle cx="15.2" cy="11.5" r="1.8"/><path d="M10.2 20v-3M13.8 20v-3"/>',
  sigilo:  '<circle cx="12" cy="12" r="9"/><path d="M12 3l5.3 16.3L3.4 9.2h17.2L6.7 19.3z"/>',
  raio:    '<path d="M13.5 2 5 13.5h6L10 22l9-12h-6z"/>',
  olho:    '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  vela:    '<path d="M9 21V11h6v10"/><path d="M7 21h10"/><path d="M12 2.5c2.3 2.2 2.3 4.3 0 5.7-2.3-1.400-2.300-3.500 0-5.700z"/>',
  escudo:  '<path d="M12 3l8 3v6c0 5-3.800 8-8 9-4.200-1-8-4-8-9V6z"/><path d="M12 7v10"/>',
  amuleto: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r="1.500"/>',
  garra:   '<path d="M5 4c3 5 3 11 0 16"/><path d="M11 3c3 5.500 3 12.500 0 18"/><path d="M17 4c3 5 3 11 0 16"/>',
  /* ── criaturas ── */
  fantasma:'<path d="M5 21V11a7 7 0 0 1 14 0v10l-3.500-2.500L12 21l-3.500-2.500z"/><circle cx="9.500" cy="11" r="1.100"/><circle cx="14.500" cy="11" r="1.100"/>',
  aranha:  '<ellipse cx="12" cy="14" rx="3.200" ry="4"/><circle cx="12" cy="8.500" r="1.800"/><path d="M9 12 4 8M9 14H2.500M9 16l-5 4M10 18l-2 3M15 12l5-4M15 14h6.500M15 16l5 4M14 18l2 3"/>',
  morcego: '<path d="M12 7c-2-2.500-6-3.500-10-2.500 1.200 2.500 1 5 2.500 7 1.500-.8 2.800-.5 3.500.8 1 1.700 2.200 3 4 4 1.800-1 3-2.300 4-4 .7-1.300 2-1.600 3.500-.8 1.500-2 1.300-4.500 2.500-7-4-1-8 0-10 2.500z" transform="translate(0 .5)"/><path d="M10 11l.5 2M14 11l-.5 2"/>',
  serpente:'<path d="M18.500 4.500C14 3 8 4.500 8 8c0 4 8 3 8 7 0 3.500-5 5-9.500 3.500"/><circle cx="19" cy="5" r="1" fill="currentColor" stroke="none"/>',
  fogo:    '<path d="M12 3c.8 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.200 2-4.200.2 2 1 3 2 3C11 9 10 7 12 3z"/>',
  lua:     '<path d="M20 14.500A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500z"/>',
  chifre:  '<path d="M4.500 3.500c-.5 4 1.500 6.500 4 7.500"/><path d="M19.500 3.500c.5 4-1.500 6.500-4 7.500"/><path d="M7 11h10v4.200a5 5 0 0 1-10 0z"/><path d="M10 15h.01M14 15h.01"/>',
  tumulo:  '<path d="M6 21V10a6 6 0 0 1 12 0v11z"/><path d="M12 9v7M9.500 11.500h5"/><path d="M3 21h18"/>',
  /* ── interface ── */
  forja:   '<path d="M4 7h14a3 3 0 0 1-3 4h-1.500l1 3h2V18H7v-4h2l1-3H8a4 4 0 0 1-4-4z"/><path d="M5 21h14"/>',
  bala:    '<path d="M9 21V10c0-3 1.500-5 3-6.500 1.500 1.500 3 3.500 3 6.500v11z"/><path d="M9 17h6"/>',
  caixa:   '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  engrenagem:'<circle cx="12" cy="12" r="3.200"/><circle cx="12" cy="12" r="6.500"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
  editar:  '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.500 6.500l4 4"/>',
  duplicar:'<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  mochila: '<path d="M7 9a5 5 0 0 1 10 0v11H7z"/><path d="M7 14h10M10 4.200V3h4v1.200"/><path d="M10 17h4"/>',
  lixo:    '<path d="M4.500 7h15M9 7V4h6v3M6.500 7l1 13.500h9l1-13.500"/><path d="M10 11v6M14 11v6"/>',
  salvar:  '<path d="M5 4h12l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  exportar:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  importar:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  livro:   '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h12"/><path d="M9 8h6"/>',
  dado:    '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.500" cy="8.500" r=".9" fill="currentColor" stroke="none"/><circle cx="15.500" cy="8.500" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="8.500" cy="15.500" r=".9" fill="currentColor" stroke="none"/><circle cx="15.500" cy="15.500" r=".9" fill="currentColor" stroke="none"/>',
  aviso:   '<path d="M12 3.500 22 20.500H2z"/><path d="M12 10v5M12 17.800v.2"/>',
  recarregar:'<path d="M20 12a8 8 0 1 1-2.500-5.800"/><path d="M20 4v5h-5"/>',
  ejetar:  '<path d="M12 5l7 8H5z"/><path d="M5 18h14"/>',
  mais:    '<path d="M12 5v14M5 12h14"/>',
  fechar:  '<path d="M6 6l12 12M18 6 6 18"/>',
  coracao: '<path d="M12 20S4 14.500 4 9a4.200 4.200 0 0 1 8-1.800A4.200 4.200 0 0 1 20 9c0 5.500-8 11-8 11z"/>',
  impacto: '<path d="M12 2l2 6 6-2-3.200 5L22 14l-6.200 1 1.200 6-5-4-5 4 1.200-6L2 14l5.200-3L4 6l6 2z"/>',
  sugerir: '<path d="M4 20 16 8"/><path d="M14 4l1 2.500L17.500 7.500 15 8.500 14 11l-1-2.500-2.500-1L13 6.500z"/><path d="M19 13l.7 1.800 1.800.7-1.800.7L19 18l-.7-1.800-1.800-.7 1.800-.7z"/>',
  seta:    '<path d="M4 12h15M14 7l5 5-5 5"/>',
  nota:    '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  hex:     '<path d="M12 2.500l8.500 5v9L12 21.500l-8.500-5v-9z"/>',
};

/* emojis / glifos legados (itens e sumonáveis já salvos) → ícone */
const LEGACY = {
  '\u{2694}':'espada','\u{1F5E1}':'adaga','\u{1FA93}':'machado','\u{1F528}':'martelo','\u{1F3F9}':'arco','\u{1F52B}':'pistola','\u{1F4A3}':'bomba','\u{1F52A}':'adaga',
  '\u{26D3}':'corrente','\u{1F531}':'tridente','\u{1F9B4}':'osso','\u{1FA78}':'gota','\u{2620}':'cranio','\u{26E7}':'sigilo','\u{26A1}':'raio','\u{1F441}':'olho',
  '\u{1F56F}':'vela','\u{1F6E1}':'escudo','\u{1F9FF}':'amuleto','\u{2702}':'tesoura','\u{1F47B}':'fantasma','\u{1F43A}':'garra','\u{1F577}':'aranha','\u{1F987}':'morcego',
  '\u{1F40D}':'serpente','\u{1F525}':'fogo','\u{1F311}':'lua','\u{1F400}':'garra','\u{1F982}':'aranha','\u{1F479}':'chifre','\u{1F9DF}':'tumulo','\u{1FAB2}':'aranha','\u{1F419}':'corrente',
  '\u{25C8}':'pistola','\u{2297}':'bomba','\u{25CF}':'bala','\u{25A5}':'caixa','\u{25A6}':'caixa','\u{2692}':'forja','\u{2756}':'sigilo','\u{1F4A5}':'impacto',
};
const strip = s => String(s||'').replace(/️/g,'').trim();

function svg(name, o){
  o = o||{};
  const body = P[name] || P.hex;
  const sz = o.size ? ` width="${o.size}" height="${o.size}"` : '';
  return `<svg class="fji${o.cls?' '+o.cls:''}" viewBox="0 0 24 24"${sz} fill="none" stroke="currentColor" stroke-width="${o.w||1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
function fromLegacy(v){
  v = strip(v); if(!v) return '';
  if(P[v]) return v;
  if(LEGACY[v]) return LEGACY[v];
  const first = Array.from(v)[0];
  return LEGACY[first] || '';
}
/* valor guardado em `icone` (nome novo ou emoji antigo) → HTML do ícone */
function html(v, padrao, o){
  const n = fromLegacy(v) || padrao || 'hex';
  return svg(n, o);
}
/* ícone padrão por tipo do item no banco (ITENS_DB) */
function doTipo(o){
  if(!o) return 'caixa';
  if(o.tipo==='arma') return o.subTipo==='fogo'?'pistola':'espada';
  return ({explosivo:'bomba',municao:'bala',armadura:'escudo',protecao:'escudo','item-comum':'caixa',equipamento:'engrenagem',paranormal:'sigilo'})[o.tipo] || 'caixa';
}
function itemHtml(o, o2){ return html(o&&o.icone, doTipo(o), o2); }

window.FJI = { svg, html, fromLegacy, doTipo, itemHtml, names:Object.keys(P) };
window.fjIconHTML = (v)=>html(v,'hex');

/* hidrata <i data-fji="nome"></i> do HTML estático */
function hidratar(root){ (root||document).querySelectorAll('[data-fji]:empty').forEach(el=>{ el.innerHTML = svg(el.dataset.fji); }); }
window.fjHidratarIcones = hidratar;
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>hidratar()); else hidratar();
})();
