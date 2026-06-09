const appToken = {};
    const f=FURNITURE[mapStructures[hitStr].preset];
    if(confirm('Remover estrutura "'+(f&&f.label||mapStructures[hitStr].preset)+'"?')){
      mapStructures.splice(hitStr,1);
      if(selectedStruct===hitStr)selectedStruct=null;
      else if(selectedStruct>hitStr)selectedStruct--;
      fullRedraw();saveStructures();
    }
  }
}
 
// ══════════════════════════════════════════════
//  RENDER ENGINE — fundo separado dos tokens
//  bgCanvas: offscreen, recebe apenas traços/edições
//  Render: sempre limpa o main canvas e compõe
//  bgCanvas + estruturas + tokens em uma passada
// ══════════════════════════════════════════════
let _bgCanvas = null;   // offscreen — só traços/edições
let _rafPending = false;
 
function _getBgCanvas(){
  const mc = document.getElementById('map-canvas');
  if(!mc) return null;
  if(!_bgCanvas){
    _bgCanvas = document.createElement('canvas');
    _bgCanvas.width = mc.width;
    _bgCanvas.height = mc.height;
  }
  return _bgCanvas;
}
 
// Chame sempre que o tamanho do main canvas mudar
function _syncBgSize(){
  const mc = document.getElementById('map-canvas');
  if(!mc || !_bgCanvas) return;
  if(_bgCanvas.width !== mc.width || _bgCanvas.height !== mc.height){
    const tmp = document.createElement('canvas');
    tmp.width = mc.width; tmp.height = mc.height;
    tmp.getContext('2d').drawImage(_bgCanvas, 0, 0);
    _bgCanvas.width = mc.width; _bgCanvas.height = mc.height;
    _bgCanvas.getContext('2d').drawImage(tmp, 0, 0);
  }
}
 
// Devolve o contexto 2d do bgCanvas (para desenhar traços)
function getBgCtx(){
  const bg = _getBgCanvas();
  return bg ? bg.getContext('2d') : null;
}
 
// ── Histórico: snapshots do bgCanvas ──
function mapPushHistory(){
  const bg = _getBgCanvas();
  if(!bg) return;
  mapHistory.push(bg.toDataURL());
  if(mapHistory.length > 30) mapHistory.shift();
}
 
// ── Compõe e exibe: bg + grid + estruturas + tokens ──
function _compose(){
  if(!mapCtx) return;
  const mc = document.getElementById('map-canvas');
  if(!mc) return;
  const bg = _getBgCanvas();
  mapCtx.clearRect(0, 0, mc.width, mc.height);
  if(bg) mapCtx.drawImage(bg, 0, 0);
  drawMapGrid();
  drawAllStructures();
  _drawTokens(mc);
}
 
// Versão com rAF (chamadas normais — não durante drag)
function fullRedraw(){
  if(_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(()=>{
    _rafPending = false;
    _compose();
  });
}
 
// Versão síncrona imediata — usada somente durante drag para evitar lag
function fullRedrawSync(){
  _compose();
}
 
// ── Undo: restaura bg a partir do histórico ──
function mapUndo(){
  if(mapHistory.length <= 1) return;
  mapHistory.pop();
  const last = mapHistory[mapHistory.length - 1];
  if(!last){ fullRedraw(); return; }
  const img = new Image();
  img.onload = ()=>{
    const bg = _getBgCanvas();
    if(!bg) return;
    const bgCtx = bg.getContext('2d');
    bgCtx.clearRect(0, 0, bg.width, bg.height);
    bgCtx.drawImage(img, 0, 0);
    fullRedraw();
  };
  img.src = last;
}
 
// ══════════════════════════════════════════════════════════════
//  SINCRONIZAÇÃO DO MAPA — ARQUITETURA SIMPLIFICADA


appToken._compose = _compose;
appToken._getBgCanvas = _getBgCanvas;
appToken._syncBgSize = _syncBgSize;
appToken.fullRedraw = fullRedraw;
appToken.fullRedrawSync = fullRedrawSync;
appToken.getBgCtx = getBgCtx;
appToken.mapPushHistory = mapPushHistory;
appToken.mapUndo = mapUndo;
Object.assign(window, appToken);
