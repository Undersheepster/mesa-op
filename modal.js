/* ════════════════════════════════════════════════════════════
   MODAL.JS — Popup universal de detalhes/fichas
   ────────────────────────────────────────────────────────────
   Ponto único usado por TODAS as funções "ver X" do projeto
   (verItem, verElemento, npcFichaView, verCriatura, verReliquia,
   verAgente): em vez de cada uma escrever num painel inline
   dentro da própria aba, todas chamam abrirModalDetalhe(html)
   e o conteúdo aparece como um popup centralizado por cima de
   tudo, com botão de fechar, clique fora e tecla Esc.

   Precisa ser o PRIMEIRO script carregado (antes de app.js,
   criaturas.js, agentes.js, danos-tab.js), já que essas funções
   dependem dele existir no momento em que forem chamadas.
   ════════════════════════════════════════════════════════════ */

function abrirModalDetalhe(html){
  const body = document.getElementById('universal-modal-body');
  const overlay = document.getElementById('universal-modal-overlay');
  if(!body || !overlay) return;
  body.innerHTML = html;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  overlay.scrollTop = 0;
  const content = document.getElementById('universal-modal-content');
  if(content) content.scrollTop = 0;
}

function fecharModalDetalhe(){
  const overlay = document.getElementById('universal-modal-overlay');
  if(!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') fecharModalDetalhe();
});

/* ── Popup genérico de DESCRIÇÃO (letras grandes) ──────────────
   Usado para abrir em popup qualquer texto de descrição que hoje
   aparece só "espremido" dentro de uma aba (poderes, rituais,
   trilhas, habilidades, elementos, itens do baú, etc). Sempre usa
   fonte bem maior que o padrão das listas, para facilitar a leitura.
   ─ titulo: texto do cabeçalho
   ─ corpoHtml: HTML do corpo (pode ter <br>, <b>, etc.)
   ─ opts: { cor, subtitulo, extra } (todos opcionais) */
function abrirDescPopup(titulo, corpoHtml, opts){
  opts = opts || {};
  const cor = opts.cor || 'var(--gold-light)';
  abrirModalDetalhe(`
    <div style="font-family:'Cinzel',serif;font-size:19px;color:${cor};letter-spacing:.03em;margin-bottom:4px">${titulo || ''}</div>
    ${opts.subtitulo ? `<div style="font-size:11px;letter-spacing:.12em;color:var(--white-dust);font-family:'Oswald',sans-serif;text-transform:uppercase;margin-bottom:14px">${opts.subtitulo}</div>` : '<div style="margin-bottom:14px"></div>'}
    <div class="desc-popup-text">${corpoHtml}</div>
    ${opts.extra || ''}
  `);
}

/* Escapa aspas simples para uso seguro dentro de onclick="...('...')" */
function _escDescAttr(s){
  return String(s == null ? '' : s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
}
