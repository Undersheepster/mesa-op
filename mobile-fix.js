// ══════════════════════════════════════════════
//  MOBILE-FIX — força layout mobile via JS
// ══════════════════════════════════════════════
// Por que este arquivo existe: em alguns aparelhos as @media queries do
// style.css não estavam disparando o layout mobile (coluna única, fontes
// maiores em inputs, etc) mesmo com viewport/zoom/cache corretos — provável
// bug específico do navegador/aparelho ao calcular a largura da "layout
// viewport". Este script mede a largura REAL da tela via JS (que não sofre
// desse problema) e aplica/remove os ajustes diretamente, em vez de confiar
// só no CSS.
//
// Também mostra uma etiqueta discreta no canto (só quando o modo mobile
// está ativo) com a largura detectada, útil pra diagnosticar em qual
// largura o aparelho realmente está renderizando.

(function () {
  const MOBILE_BREAKPOINT = 1024;
  let ativo = null; // null = ainda não aplicado nenhuma vez

  function larguraReal() {
    // document.documentElement.clientWidth costuma ser mais confiável que
    // window.innerWidth em alguns navegadores (não conta a barra de rolagem).
    return Math.min(window.innerWidth || Infinity, document.documentElement.clientWidth || Infinity);
  }

  function aplicarGrid1Col(seletor) {
    document.querySelectorAll(seletor).forEach(el => {
      el.style.setProperty('grid-template-columns', '1fr', 'important');
    });
  }
  function removerGrid1Col(seletor) {
    document.querySelectorAll(seletor).forEach(el => {
      el.style.removeProperty('grid-template-columns');
    });
  }

  function aplicarModoMobile() {
    document.documentElement.classList.add('mp-mobile-forced');

    // 1) Ficha: coluna principal + lateral viram 1 coluna só
    aplicarGrid1Col('.ficha-layout');
    // 2) Outros grids de 2-4 colunas que devem virar 1 coluna em tela estreita
    aplicarGrid1Col('.four-col, .stat-grid, .defesa-grid, .cr-attr-grid, .two-col, .three-col, .token-wrap');

    // 3) Topbar: garante que quebra linha em vez de espremer tudo numa linha só
    const topbar = document.querySelector('.topbar');
    const topbarUser = document.querySelector('.topbar-user');
    if (topbar) topbar.style.setProperty('flex-wrap', 'wrap', 'important');
    if (topbarUser) {
      topbarUser.style.setProperty('flex-wrap', 'wrap', 'important');
      topbarUser.style.setProperty('justify-content', 'flex-end', 'important');
    }
    const tabNav = document.getElementById('tab-nav');
    if (tabNav) {
      tabNav.style.setProperty('order', '3', 'important');
      tabNav.style.setProperty('width', '100%', 'important');
    }

    // 4) Fonte >=16px em TODOS os campos de texto (evita zoom automático
    //    ao focar em iOS, e mantém leitura confortável em qualquer Android)
    document.querySelectorAll('input, select, textarea').forEach(el => {
      el.style.setProperty('font-size', '16px', 'important');
    });

    // 5) Botões só-ícone: aumenta a área de toque
    document.querySelectorAll('.del-btn, .modal-close, .kick-btn, .npc-del').forEach(el => {
      el.style.setProperty('padding', '9px', 'important');
    });

    _mostrarEtiquetaDebug();
  }

  function removerModoMobile() {
    document.documentElement.classList.remove('mp-mobile-forced');
    removerGrid1Col('.ficha-layout, .four-col, .stat-grid, .defesa-grid, .cr-attr-grid, .two-col, .three-col, .token-wrap');

    const topbar = document.querySelector('.topbar');
    const topbarUser = document.querySelector('.topbar-user');
    if (topbar) topbar.style.removeProperty('flex-wrap');
    if (topbarUser) { topbarUser.style.removeProperty('flex-wrap'); topbarUser.style.removeProperty('justify-content'); }
    const tabNav = document.getElementById('tab-nav');
    if (tabNav) { tabNav.style.removeProperty('order'); tabNav.style.removeProperty('width'); }

    document.querySelectorAll('input, select, textarea').forEach(el => {
      el.style.removeProperty('font-size');
    });
    document.querySelectorAll('.del-btn, .modal-close, .kick-btn, .npc-del').forEach(el => {
      el.style.removeProperty('padding');
    });

    _removerEtiquetaDebug();
  }

  function _mostrarEtiquetaDebug() {
    let el = document.getElementById('mp-mobile-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mp-mobile-debug';
      el.style.cssText = 'position:fixed;bottom:4px;left:4px;z-index:99999;background:rgba(0,0,0,.75);color:#0f0;font:10px monospace;padding:3px 6px;border-radius:3px;pointer-events:none;opacity:.85';
      document.body.appendChild(el);
    }
    el.textContent = 'mobile-fix ON — largura detectada: ' + larguraReal() + 'px';
  }
  function _removerEtiquetaDebug() {
    const el = document.getElementById('mp-mobile-debug');
    if (el) el.remove();
  }

  function verificar() {
    const w = larguraReal();
    const deveSerMobile = w <= MOBILE_BREAKPOINT;
    if (deveSerMobile === ativo) {
      // já está no modo certo — só atualiza a etiqueta de debug se visível
      if (ativo) _mostrarEtiquetaDebug();
      return;
    }
    ativo = deveSerMobile;
    if (deveSerMobile) aplicarModoMobile();
    else removerModoMobile();
  }

  // Roda assim que o DOM existir...
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificar);
  } else {
    verificar();
  }
  // ...e de novo sempre que a tela girar/redimensionar...
  window.addEventListener('resize', verificar);
  window.addEventListener('orientationchange', () => setTimeout(verificar, 200));

  // ...e sempre que novos painéis forem inseridos no DOM (ficha, atributos,
  // perícias, etc são renderizados dinamicamente por app.js/ficha.js DEPOIS
  // do carregamento inicial, então precisamos reaplicar os estilos neles).
  const observer = new MutationObserver(() => {
    if (ativo) aplicarModoMobile(); // reaplica nos elementos novos
  });
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
