const appMapa = {};
/* ══════════════════════════════════════════════
   MAP
══════════════════════════════════════════════ */
let mapCtx,mapTool='wall',mapDrawing=false,mapLX=0,mapLY=0;
let mapHistory=[],mapTokens=[];
let mapStartX=0,mapStartY=0;
let mapBgImage=null; // stored background separate from tokens
 
// Token interaction state
let selectedToken=null; // index into mapTokens
let draggingToken=false;
let rotatingToken=false;
let rotateStartAngle=0;
let rotateMouseStart=0;
 
const GRID_SIZE=40;
 
// Aplica bg remoto no canvas (pode ser chamado antes ou depois do initMap)
function applyRemoteBg(dataUrl){
  if(!dataUrl) return;
  const canvas = document.getElementById('map-canvas');
  // Se o mapa ainda não foi aberto, guarda pra aplicar quando abrir
  window._pendingRemoteBg = dataUrl;
  if(!canvas || !mapCtx) return;
  const img = new Image();
  img.onload = () => {
    const bg = _getBgCanvas();
    if(!bg) return;
    const ctx2 = bg.getContext('2d');
    ctx2.clearRect(0,0,bg.width,bg.height);
    ctx2.drawImage(img,0,0,bg.width,bg.height);
    mapPushHistory();
    fullRedraw();
  };
  img.src = dataUrl;
}

function initMap(){
  const canvas=document.getElementById('map-canvas');
  if(!canvas)return;
  if(canvas._init)return;
  canvas._init=true;
  const wrap=document.getElementById('map-canvas-wrap');
  canvas.width=wrap.offsetWidth||900;
  canvas.height=Math.round(canvas.width*0.6);
  mapCtx=canvas.getContext('2d');
  // Reseta o bgCanvas para as novas dimensoes
  _bgCanvas=null;
  mapHistory=[];
  mapTokens=[];
  // Carrega mapa compartilhado
  // Prioridade: bg pendente do Firebase > shared local > mapa base (só Mestre)
  const bgToLoad = window._pendingRemoteBg || db.maps['shared'] || (isMestre ? db.maps[currentUser] : null);
  window._pendingRemoteBg = null;
  if(bgToLoad){
    const img=new Image();
    img.onload=()=>{
      const bg=_getBgCanvas();
      bg.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      mapPushHistory();
      loadMapTokens();
      loadStructures();
      fullRedraw();
    };
    img.src=bgToLoad;
  }else{
    if(isMestre) drawBaseMap();
    mapPushHistory();
    loadMapTokens();
    loadStructures();
    fullRedraw();
  }
  canvas.addEventListener('mousedown',mapDown);
  canvas.addEventListener('mousemove',mapMove);
  canvas.addEventListener('mousemove',mapHoverCheck);
  canvas.addEventListener('mouseup',mapUp);
  canvas.addEventListener('mouseleave',mapUp);
  canvas.addEventListener('wheel',mapWheel,{passive:false});
  canvas.addEventListener('contextmenu',mapRightClick);
  canvas.addEventListener('touchstart',e=>{e.preventDefault();mapDown(e.touches[0]);},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();mapMove(e.touches[0]);},{passive:false});
  canvas.addEventListener('touchend',e=>{mapUp();},{passive:false});
}
 
function mapPosRaw(e){
  const canvas=document.getElementById('map-canvas');
  const r=canvas.getBoundingClientRect();
  const sx=canvas.width/r.width,sy=canvas.height/r.height;
  return{x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy};
}
 
function mapPos(e){
  const p=mapPosRaw(e);
  if(document.getElementById('map-snap')?.checked){
    return{x:Math.round(p.x/GRID_SIZE)*GRID_SIZE, y:Math.round(p.y/GRID_SIZE)*GRID_SIZE};
  }
  return p;
}
 
function mapDown(e){
  const p=mapPos(e);
 
  // Place furniture preset -> agora cria objeto clicavel
  if(placingPreset){
    mapStructures.push({preset:placingPreset,x:p.x,y:p.y,angle:0});
    placingPreset=null;
    selectedStruct=mapStructures.length-1;
    document.getElementById('map-canvas').style.cursor='crosshair';
    fullRedraw();saveStructures();return;
  }
 
  // Erase: verifica token e estrutura
  if(mapTool==='erase'){
    const hitTok=mapTokens.findIndex(t=>Math.hypot(t.x-p.x,t.y-p.y)<=t.r+6);
    if(hitTok>=0){
      if(!isMestre){toast('⛧ Apenas o Mestre pode remover tokens.');return;}
      mapTokens.splice(hitTok,1);if(selectedToken===hitTok)selectedToken=null;else if(selectedToken>hitTok)selectedToken--;fullRedraw();renderMapTokList();saveMapData();return;
    }
    const hitStr=hitTestStruct(p.x,p.y);
    if(hitStr>=0){
      if(!isMestre){toast('⛧ Apenas o Mestre pode remover objetos.');return;}
      mapStructures.splice(hitStr,1);if(selectedStruct===hitStr)selectedStruct=null;else if(selectedStruct>hitStr)selectedStruct--;fullRedraw();saveStructures();return;
    }
    if(!isMestre){return;}
    selectedToken=null;selectedStruct=null;
    mapDrawing=true;mapStartX=p.x;mapStartY=p.y;mapLX=p.x;mapLY=p.y;mapPushHistory();return;
  }
 
  // Check token hit first (usa posicao raw para hit test preciso)
  const pRaw=mapPosRaw(e);
  const hitIdx=mapTokens.findIndex(t=>Math.hypot(t.x-pRaw.x,t.y-pRaw.y)<=t.r+6);
  if(hitIdx>=0){
    const hitTok=mapTokens[hitIdx];
    // Players so podem arrastar seu proprio token (owner)
    if(!isMestre && !(hitTok.isPlayer && hitTok.owner===currentUser)){
      toast('⛧ Você só pode mover seu próprio token.');
      selectedToken=hitIdx;renderMapTokList();fullRedraw();return;
    }
    selectedToken=hitIdx;selectedStruct=null;
    draggingToken=true;
    hitTok._dragOX=pRaw.x-hitTok.x; hitTok._dragOY=pRaw.y-hitTok.y;
    hitTok._lastX=undefined; hitTok._lastY=undefined;
    renderMapTokList();fullRedraw();return;
  }
 
  // Check structure hit
  const hitStr=hitTestStruct(pRaw.x,pRaw.y);
  if(hitStr>=0){
    selectedStruct=hitStr;selectedToken=null;
    if(isMestre){
      draggingStruct=true;
      const s=mapStructures[hitStr];
      s._dragOX=pRaw.x-s.x; s._dragOY=pRaw.y-s.y;
    }
    renderMapTokList();fullRedraw();return;
  }
 
  // Deselect tudo com select tool
  if(mapTool==='select'){selectedToken=null;selectedStruct=null;renderMapTokList();fullRedraw();return;}
 
  selectedToken=null;selectedStruct=null;
  mapDrawing=true;mapStartX=p.x;mapStartY=p.y;mapLX=p.x;mapLY=p.y;
 
  if(mapTool==='text'){
    if(!isMestre){toast('⛧ Apenas o Mestre pode adicionar texto.');return;}
    const txt=prompt('Texto para o mapa:');
    if(txt){
      const bgCtx2=getBgCtx();
      if(bgCtx2){
        bgCtx2.fillStyle=document.getElementById('map-color').value;
        bgCtx2.font='13px "Cinzel",serif';bgCtx2.textAlign='left';bgCtx2.textBaseline='middle';
        bgCtx2.fillText(txt,p.x,p.y);
      }
    }
    mapDrawing=false;mapPushHistory();saveMapData();return;
  }
  if(mapTool==='token-place'){
    if(!isMestre){toast('⛧ Apenas o Mestre pode colocar tokens avulsos. Use ⭐ Meu Token.');return;}
    const name=prompt('Nome do token (ex: PJ1, Inimigo):','');
    const col=document.getElementById('map-color').value;
    const c=userChar(currentUser);
    const isPlayer=!!(name&&(name.toLowerCase()===currentUser||(c.nome&&name.toLowerCase().includes(c.nome.toLowerCase()))));
    mapTokens.push({x:p.x,y:p.y,name:name||'?',col,r:GRID_SIZE/2-4,isPlayer,state:'comum',angle:0});
    mapDrawing=false;fullRedraw();renderMapTokList();saveMapData();return;
  }
  if(!isMestre){return;}
  mapPushHistory();
}
 
function mapMove(e){
  const p=mapPos(e);
  const pRaw=mapPosRaw(e);   // sempre livre, para drag
  const canvas=document.getElementById('map-canvas');
 
  // Dragging a selected token — movimento LIVRE (sem snap)
  if(draggingToken && selectedToken!==null && mapTokens[selectedToken]){
    const t=mapTokens[selectedToken];
    const nx=pRaw.x-(t._dragOX||0), ny=pRaw.y-(t._dragOY||0);
    if(t._lastX!==undefined) t.angle=Math.atan2(ny-t._lastY, nx-t._lastX);
    t._lastX=t.x; t._lastY=t.y;
    t.x=nx; t.y=ny;
    fullRedrawSync();
    fbPublishMap(); // publica direto, sem throttle, para movimento instantâneo
    canvas.style.cursor='grabbing';return;
  }
 
  // Dragging a selected structure — movimento LIVRE (sem snap)
  if(draggingStruct && selectedStruct!==null && mapStructures[selectedStruct]){
    const s=mapStructures[selectedStruct];
    const nx=pRaw.x-(s._dragOX||0), ny=pRaw.y-(s._dragOY||0);
    s.x=nx; s.y=ny;
    fullRedrawSync();
    const dx=nx-(s._pubX||nx), dy=ny-(s._pubY||ny);
    if(Math.hypot(dx,dy)>=2){ s._pubX=nx; s._pubY=ny; fbPublishMap(); }
    canvas.style.cursor='grabbing';return;
  }
 
  // Hover cursor change
  if(!mapDrawing){
    const hitTok=mapTokens.findIndex(t=>Math.hypot(t.x-p.x,t.y-p.y)<=t.r+6);
    if(hitTok>=0 && mapTool!=='erase'){canvas.style.cursor='grab';return;}
    const hitStr=hitTestStruct(p.x,p.y);
    if(hitStr>=0 && mapTool!=='erase'){canvas.style.cursor='grab';return;}
    if(placingPreset){canvas.style.cursor='copy';return;}
    canvas.style.cursor='crosshair';
  }
 
  if(!mapDrawing)return;
  const sz=parseInt(document.getElementById('map-sz').value)||4;
  const col=document.getElementById('map-color').value;
  const op=parseInt(document.getElementById('map-op').value)/100;
  // Todos os traços vão para o bgCanvas — tokens nunca são desenhados nele
  const bgCtx=getBgCtx();
  if(!bgCtx)return;
 
  if(mapTool==='pencil'||mapTool==='wall'){
    bgCtx.globalAlpha=op;
    bgCtx.beginPath();bgCtx.moveTo(mapLX,mapLY);bgCtx.lineTo(p.x,p.y);
    bgCtx.strokeStyle=col;bgCtx.lineWidth=sz;bgCtx.lineCap='round';bgCtx.lineJoin='round';bgCtx.stroke();
    bgCtx.globalAlpha=1;
    fullRedrawSync();
  }else if(mapTool==='erase'){
    bgCtx.clearRect(p.x-sz*2,p.y-sz*2,sz*4,sz*4);
    fullRedrawSync();
  }else if(mapTool==='rect'){
    // Preview: restaura bgCanvas do ultimo snapshot, desenha shape temporario, compoe
    const last=mapHistory[mapHistory.length-1];
    if(last){
      const img=new Image();
      img.onload=()=>{
        bgCtx.clearRect(0,0,_bgCanvas.width,_bgCanvas.height);
        bgCtx.drawImage(img,0,0);
        bgCtx.globalAlpha=op;
        bgCtx.fillStyle=col+'44';bgCtx.strokeStyle=col;bgCtx.lineWidth=sz*0.5;
        bgCtx.fillRect(mapStartX,mapStartY,p.x-mapStartX,p.y-mapStartY);
        bgCtx.strokeRect(mapStartX,mapStartY,p.x-mapStartX,p.y-mapStartY);
        bgCtx.globalAlpha=1;
        fullRedrawSync();
      };
      img.src=last;
    }
  }else if(mapTool==='circle'){
    const last=mapHistory[mapHistory.length-1];
    if(last){
      const img=new Image();
      img.onload=()=>{
        bgCtx.clearRect(0,0,_bgCanvas.width,_bgCanvas.height);
        bgCtx.drawImage(img,0,0);
        bgCtx.globalAlpha=op;
        const rx=Math.abs(p.x-mapStartX)/2,ry=Math.abs(p.y-mapStartY)/2;
        const ex=(mapStartX+p.x)/2,ey=(mapStartY+p.y)/2;
        bgCtx.beginPath();bgCtx.ellipse(ex,ey,rx||1,ry||1,0,0,Math.PI*2);
        bgCtx.fillStyle=col+'33';bgCtx.fill();
        bgCtx.strokeStyle=col;bgCtx.lineWidth=sz*0.5;bgCtx.stroke();
        bgCtx.globalAlpha=1;
        fullRedrawSync();
      };
      img.src=last;
    }
  }else if(mapTool==='line'){
    const last=mapHistory[mapHistory.length-1];
    if(last){
      const img=new Image();
      img.onload=()=>{
        bgCtx.clearRect(0,0,_bgCanvas.width,_bgCanvas.height);
        bgCtx.drawImage(img,0,0);
        bgCtx.globalAlpha=op;
        bgCtx.beginPath();bgCtx.moveTo(mapStartX,mapStartY);bgCtx.lineTo(p.x,p.y);
        bgCtx.strokeStyle=col;bgCtx.lineWidth=sz;bgCtx.lineCap='round';bgCtx.stroke();
        bgCtx.globalAlpha=1;
        fullRedrawSync();
      };
      img.src=last;
    }
  }
  mapLX=p.x;mapLY=p.y;
}
 
function mapUp(){
  if(draggingToken){
    draggingToken=false;
    if(selectedToken!==null && mapTokens[selectedToken]){
      const t=mapTokens[selectedToken];
      delete t._lastX;delete t._lastY;delete t._dragOX;delete t._dragOY;delete t._pubX;delete t._pubY;delete t._rafPub;
    }
    fullRedraw();
    // Força publicação imediata da posição final (sem throttle) para todos verem
    if(window.fbSaveMap){
      try{
        window.fbSaveMap._flush = true;
        window.fbSaveMap('main',{
          tokens: JSON.stringify(mapTokens),
          structs: JSON.stringify(mapStructures),
          ts: Date.now(),
          sid: _mySessionId
        });
      }catch(e){}
    }
    saveMapData();
    document.getElementById('map-canvas').style.cursor='crosshair';return;
  }
  if(draggingStruct){
    draggingStruct=false;
    if(selectedStruct!==null && mapStructures[selectedStruct]){
      const s=mapStructures[selectedStruct];
      delete s._dragOX;delete s._dragOY;delete s._pubX;delete s._pubY;
    }
    fullRedraw();saveStructures();
    document.getElementById('map-canvas').style.cursor='crosshair';return;
  }
  if(mapDrawing){mapDrawing=false;mapPushHistory();saveMapData();_publishBgNow();}
}
 
// Scroll wheel = rotate selected token or structure
function mapWheel(e){
  e.preventDefault();
  const delta=e.deltaY>0?0.15:-0.15;
  if(selectedToken!==null && mapTokens[selectedToken]){
    mapTokens[selectedToken].angle=(mapTokens[selectedToken].angle||0)+delta;
    fullRedraw();saveMapData();return;
  }
  if(selectedStruct!==null && mapStructures[selectedStruct]){
    mapStructures[selectedStruct].angle=(mapStructures[selectedStruct].angle||0)+delta;
    fullRedraw();saveStructures();
  }
}
 
// Right click = delete token or structure under cursor
function mapRightClick(e){
  e.preventDefault();
  const p=mapPos(e);
  const hitIdx=mapTokens.findIndex(t=>Math.hypot(t.x-p.x,t.y-p.y)<=t.r+6);
  if(hitIdx>=0){
    if(!isMestre){toast('⛧ Apenas o Mestre pode remover tokens.');return;}
    if(confirm('Remover token "'+mapTokens[hitIdx].name+'"?')){
      mapTokens.splice(hitIdx,1);
      if(selectedToken===hitIdx)selectedToken=null;
      else if(selectedToken>hitIdx)selectedToken--;
      fullRedraw();renderMapTokList();saveMapData();
    }
    return;
  }
  const hitStr=hitTestStruct(p.x,p.y);
  if(hitStr>=0){
    if(!isMestre){toast('⛧ Apenas o Mestre pode remover objetos do mapa.');return;}
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
//
//  Firebase só trafega JSON pequeno (tokens + structs).
//  bgCanvas (desenhos) é salvo no Firebase DB separadamente e
//  carregado UMA VEZ quando o mapa é aberto.
//  Durante drag/draw: só tokens+structs em tempo real (< 1KB).
// ══════════════════════════════════════════════════════════════

// ID único desta sessão — anti-eco robusto
const _mySessionId = Math.random().toString(36).slice(2);
window._mySessionId = _mySessionId;

// Publica tokens + structs (throttle feito dentro do fbSaveMap)
function fbPublishMap(){
  if(!window.fbSaveMap) return;
  try{
    window.fbSaveMap('main',{
      tokens: JSON.stringify(mapTokens),
      structs: JSON.stringify(mapStructures),
      ts: Date.now(),
      sid: _mySessionId
    });
  }catch(e){}
}

// Salva local + publica
let _bgPublishTimer = null;
let _bgPublishPending = false;

function _publishBgNow(){
  clearTimeout(_bgPublishTimer);
  _bgPublishPending = false;
  if(!window.fbSaveMap) return;
  const bg = _getBgCanvas();
  const bgData = bg ? bg.toDataURL() : '';
  if(!bgData) return;
  const ts = Date.now();
  window.fbSaveMap('bg', { data: bgData, ts, sid: _mySessionId });
}

function _scheduleBgPublish(){
  if(_bgPublishPending) return; // já agendado
  _bgPublishPending = true;
  clearTimeout(_bgPublishTimer);
  _bgPublishTimer = setTimeout(_publishBgNow, 800); // throttle: publica 800ms após o último traço
}

function saveMapData(){
  try{
    const bg=_getBgCanvas();
    if(!db.maps) db.maps={};
    const bgData = bg ? bg.toDataURL() : '';
    db.maps['shared']=bgData;
    db.maps['shared_tokens']=JSON.stringify(mapTokens);
    saveDB(); // dispara fbSaveDB que inclui mapbg no gamedata
    fbPublishMap(); // tokens+structs em tempo real via SSE
    _scheduleBgPublish(); // publica bg via SSE dedicado
  }catch(e){}
}
 
// ── Desenha todos os tokens sobre o main canvas ──
function _drawTokens(mc){
  mapTokens.forEach((t, i)=>{
    // Usa o estado guardado no token; para o token do usuário atual, pode usar currentTokenState
    const tokenState = (t.isPlayer && t.owner===currentUser) ? currentTokenState : (t.state||'comum');
    const tst = TOKEN_STATES[tokenState] || TOKEN_STATES.comum;
    const ringCol = t.isPlayer ? (tst.ring || t.col) : t.col;
    const angle = t.angle || 0;
    mapCtx.save();
    mapCtx.translate(t.x, t.y);
    // Lantern cone
    if(tokenState === 'lanterna'){
      mapCtx.save(); mapCtx.rotate(angle);
      mapCtx.beginPath(); mapCtx.moveTo(0,0);
      mapCtx.arc(0, 0, 88, -Math.PI/4.5, Math.PI/4.5);
      mapCtx.closePath();
      const g = mapCtx.createRadialGradient(0,0,t.r,0,0,88);
      g.addColorStop(0,'rgba(220,180,60,0.3)'); g.addColorStop(1,'rgba(196,154,0,0.0)');
      mapCtx.fillStyle = g; mapCtx.fill(); mapCtx.restore();
    }
    // Dying aura
    if(tokenState === 'morrendo'){
      mapCtx.beginPath(); mapCtx.arc(0,0,t.r+7,0,Math.PI*2);
      const g = mapCtx.createRadialGradient(0,0,t.r,0,0,t.r+7);
      g.addColorStop(0,'rgba(100,0,0,0.5)'); g.addColorStop(1,'rgba(100,0,0,0)');
      mapCtx.fillStyle = g; mapCtx.fill();
    }
    // Selection ring
    if(i === selectedToken){
      mapCtx.beginPath(); mapCtx.arc(0,0,t.r+9,0,Math.PI*2);
      mapCtx.strokeStyle = 'rgba(255,255,200,0.8)'; mapCtx.lineWidth = 1.5;
      mapCtx.setLineDash([5,3]); mapCtx.stroke(); mapCtx.setLineDash([]);
    }
    // Body + direction pointer
    mapCtx.save(); mapCtx.rotate(angle);
    mapCtx.beginPath(); mapCtx.arc(0,0,t.r,0,Math.PI*2);
    mapCtx.fillStyle = ringCol+'bb'; mapCtx.fill();
    mapCtx.strokeStyle = i===selectedToken ? '#ffffc8' : ringCol;
    mapCtx.lineWidth = i===selectedToken ? 2.5 : 2; mapCtx.stroke();
    mapCtx.beginPath();
    mapCtx.moveTo(t.r+1,0); mapCtx.lineTo(t.r-8,-5); mapCtx.lineTo(t.r-8,5);
    mapCtx.closePath(); mapCtx.fillStyle='rgba(255,255,255,0.7)'; mapCtx.fill();
    mapCtx.restore();
    // Overlay emoji or name
    const overlay = tst.overlay;
    if(overlay){
      mapCtx.font = `${Math.round(t.r*0.82)}px serif`;
      mapCtx.textAlign='center'; mapCtx.textBaseline='middle';
      mapCtx.fillText(overlay, 0, 0);
    } else {
      mapCtx.fillStyle='#e8e0e0';
      mapCtx.font = `bold ${t.name.length>3?9:11}px "Cinzel",serif`;
      mapCtx.textAlign='center'; mapCtx.textBaseline='middle';
      mapCtx.fillText(t.name.slice(0,4), 0, 0);
    }
    // Weapon badge
    if(tokenState === 'arma'){
      mapCtx.beginPath(); mapCtx.arc(t.r-5,-t.r+5,5,0,Math.PI*2);
      mapCtx.fillStyle='rgba(220,70,0,0.95)'; mapCtx.fill();
    }
    mapCtx.restore();
  });
  // HUD selected token
  if(selectedToken!==null && mapTokens[selectedToken]){
    const t = mapTokens[selectedToken];
    const ang = Math.round((t.angle||0)*180/Math.PI);
    const st = TOKEN_STATES[t.isPlayer?currentTokenState:(t.state||'comum')];
    mapCtx.save();
    mapCtx.fillStyle='rgba(0,0,0,0.75)';
    mapCtx.fillRect(6, mc.height-30, 300, 22);
    mapCtx.fillStyle='#c8c0c0'; mapCtx.font='10px "Courier Prime",monospace';
    mapCtx.textAlign='left'; mapCtx.textBaseline='middle';
    mapCtx.fillText('● '+t.name+'  ↻'+ang+'°  ['+(st&&st.label||'—')+']  scroll=girar · arrastar=mover · clique-dir=remover', 12, mc.height-19);
    mapCtx.restore();
  }
  // HUD selected structure
  if(selectedStruct!==null && mapStructures[selectedStruct]){
    const s = mapStructures[selectedStruct];
    const f = FURNITURE[s.preset];
    const ang = Math.round((s.angle||0)*180/Math.PI);
    mapCtx.save();
    mapCtx.fillStyle='rgba(0,0,0,0.75)';
    mapCtx.fillRect(6, mc.height-30, 320, 22);
    mapCtx.fillStyle='#c8d4a0'; mapCtx.font='10px "Courier Prime",monospace';
    mapCtx.textAlign='left'; mapCtx.textBaseline='middle';
    const hintS = isMestre
      ? '▣ '+(f&&f.label||s.preset)+'  ↻'+ang+'°  scroll=girar · arrastar=mover · clique-dir=remover · Del=apagar'
      : '▣ '+(f&&f.label||s.preset)+'  ↻'+ang+'°  [somente Mestre pode mover ou remover]';
    mapCtx.fillText(hintS, 12, mc.height-19);
    mapCtx.restore();
  }
}
 
// ── Alias para compatibilidade ──
function redrawMapWithTokens(){ _compose(); }
 
 
function mapHoverCheck(e){
  // Hover não cicla mais o estado — use Q para ciclar ou os botões na aba Token
}
 
 
function renderMapTokList(){
  const el=document.getElementById('map-tok-list');el.innerHTML='';
  if(!mapTokens.length){el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Nenhum token no mapa.</div>';return;}
  mapTokens.forEach((t,i)=>{
    const row=document.createElement('div');row.className='map-token-item';
    const isSel=i===selectedToken;
    const ang=Math.round((t.angle||0)*180/Math.PI);
    row.style.cssText=isSel?'background:rgba(139,0,0,0.15);border-left:2px solid #cc0000;padding-left:6px':'';
    row.innerHTML=`<div class="mini-token" style="border-color:${t.col};color:#e8e0e0;font-size:10px">${t.name.slice(0,2)}</div>
      <div style="flex:1;min-width:0"><div style="font-size:12px;color:${isSel?'#cc8888':'var(--white-ash)'}">${t.name}${t.isPlayer?' ⭐':''}</div>
      <div style="font-size:10px;color:var(--white-dust);font-family:monospace">↻${ang}°</div></div>
      <button title="Selecionar" onclick="selectTok(${i})" style="background:transparent;border:none;color:${isSel?'#cc0000':'var(--white-dust)'};cursor:pointer;font-size:14px">◎</button>
      <button class="del-btn" onclick="removeTok(${i})" title="Remover">×</button>`;
    el.appendChild(row);
  });
}
function selectTok(i){selectedToken=i;renderMapTokList();fullRedraw();}
 
function removeTok(i){
  if(!isMestre){toast('⛧ Apenas o Mestre pode remover tokens.');return;}
  mapTokens.splice(i,1);
  if(selectedToken===i)selectedToken=null;
  else if(selectedToken!==null&&selectedToken>i)selectedToken--;
  renderMapTokList();fullRedraw();saveMapData();
}
function loadMapTokens(){const d=db.maps['shared_tokens']||db.maps[currentUser+'_tokens'];if(d)try{mapTokens=JSON.parse(d);}catch(e){mapTokens=[];}loadStructures();}
 
function drawMapGrid(){
  const canvas=document.getElementById('map-canvas');if(!canvas||!mapCtx)return;
  const show=document.getElementById('map-grid')?.checked;
  if(!show)return;
  const W=canvas.width,H=canvas.height;
  mapCtx.save();mapCtx.globalAlpha=0.08;mapCtx.strokeStyle='#8b0000';mapCtx.lineWidth=1;
  for(let x=0;x<=W;x+=GRID_SIZE){mapCtx.beginPath();mapCtx.moveTo(x,0);mapCtx.lineTo(x,H);mapCtx.stroke();}
  for(let y=0;y<=H;y+=GRID_SIZE){mapCtx.beginPath();mapCtx.moveTo(0,y);mapCtx.lineTo(W,y);mapCtx.stroke();}
  mapCtx.restore();
}
 
function drawBaseMap(){
  const canvas=document.getElementById('map-canvas');
  const W=canvas.width,H=canvas.height;
  const ctx=getBgCtx();
  if(!ctx)return;
 
  // ── Background: dark stone floor ──
  ctx.fillStyle='#0c0008';ctx.fillRect(0,0,W,H);
  // Subtle stone texture via noise-like rectangles
  for(let i=0;i<300;i++){
    const sx=Math.random()*W,sy=Math.random()*H;
    const sw=Math.random()*30+10,sh=Math.random()*3+1;
    ctx.fillStyle=`rgba(${20+Math.random()*15},${5+Math.random()*5},${10+Math.random()*10},${0.04+Math.random()*0.06})`;
    ctx.fillRect(sx,sy,sw,sh);
  }
 
  drawMapGrid();
 
  // ── Helper to draw a room with gradient + label ──
  function room(x,y,w,h,baseColor,label,danger){
    const g=ctx.createLinearGradient(x,y,x+w,y+h);
    g.addColorStop(0,baseColor+'28');g.addColorStop(1,baseColor+'10');
    ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    // Inner border glow
    ctx.strokeStyle=baseColor+'99';ctx.lineWidth=1.5;ctx.strokeRect(x+1,y+1,w-2,h-2);
    ctx.strokeStyle=baseColor+'40';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);
    // Floor tiles hint
    ctx.save();ctx.globalAlpha=0.04;ctx.strokeStyle=baseColor;ctx.lineWidth=0.5;
    for(let tx=x;tx<x+w;tx+=20){ctx.beginPath();ctx.moveTo(tx,y);ctx.lineTo(tx,y+h);ctx.stroke();}
    for(let ty=y;ty<y+h;ty+=20){ctx.beginPath();ctx.moveTo(x,ty);ctx.lineTo(x+w,ty);ctx.stroke();}
    ctx.restore();
    // Label
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(x+4,y+4,ctx.measureText(label).width+8,16);
    ctx.fillStyle=baseColor+'dd';ctx.font='bold 10px "Cinzel",serif';
    ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(label,x+8,y+6);
    ctx.restore();
  }
 
  // ── Helper: thick wall ──
  function wall(x1,y1,x2,y2,w=4){
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
    ctx.strokeStyle='#2a0000';ctx.lineWidth=w+2;ctx.stroke();
    ctx.strokeStyle='#5c0000';ctx.lineWidth=w;ctx.stroke();
    ctx.strokeStyle='rgba(139,0,0,0.2)';ctx.lineWidth=1;ctx.stroke();
  }
 
  // ── Helper: door ──
  function door(x,y,horiz){
    const L=30;
    ctx.clearRect(horiz?x:x-2,horiz?y-2:y,horiz?L:4,horiz?4:L);
    ctx.save();ctx.strokeStyle='#8b4500';ctx.lineWidth=2;
    if(horiz){ctx.beginPath();ctx.arc(x,y,L,0,Math.PI/2);ctx.stroke();}
    else{ctx.beginPath();ctx.arc(x,y,L,-Math.PI/2,0);ctx.stroke();}
    ctx.restore();
  }
 
  // ── Helper: small furniture rect ──
  function furn(x,y,w,h,col,lbl){
    ctx.fillStyle=col+'66';ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=col+'cc';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
    if(lbl){ctx.fillStyle='rgba(200,190,190,0.5)';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lbl,x+w/2,y+h/2);}
  }
 
  // ═══ ROOMS ═══
  // Recepção  (top-left large)
  room(40,40,200,160,'#8b0000','Recepção');
  furn(60,60,70,36,'#5a3a20','Mesa Rec.');
  furn(70,66,14,24,'#4a4a6a','Cad.');
  furn(100,66,14,24,'#4a4a6a','Cad.');
  furn(130,66,14,24,'#4a4a6a','Cad.');
  furn(155,52,24,16,'#3a5a6a','Arq.');
  furn(185,52,24,16,'#3a5a6a','Arq.');
 
  // Corredor horizontal Norte
  room(240,40,120,60,'#1fc8a0','Corredor N.');
 
  // Zona Infectada
  room(240,160,120,90,'#cc2222','Zona Infectada',true);
  // blood splatter hints
  ctx.save();ctx.globalAlpha=0.18;
  [[260,180],[310,200],[320,175],[270,215]].forEach(([bx,by])=>{
    ctx.beginPath();ctx.arc(bx,by,5+Math.random()*6,0,Math.PI*2);ctx.fillStyle='#cc0000';ctx.fill();
  });ctx.restore();
 
  // Arquivo (left-bottom)
  room(40,220,180,130,'#c49a00','Arquivo');
  for(let sx=0;sx<3;sx++)furn(55+sx*44,235,38,16,'#7a5a30','Estante');
  furn(55,260,38,16,'#7a5a30','Estante');
  furn(55,280,38,16,'#7a5a30','Estante');
  furn(140,260,60,36,'#3a3a5a','Mesa');
 
  // Laboratório (center-right large)
  room(380,40,190,180,'#5b9cf6','Laboratório');
  furn(400,60,60,30,'#3a5a9a','Bancada');
  furn(470,60,60,30,'#3a5a9a','Bancada');
  furn(530,60,30,80,'#2a3a6a','Equip.');
  furn(400,100,36,24,'#4a6a3a','Micro.');
  furn(450,100,36,24,'#4a6a3a','Centr.');
  // lab glow
  ctx.save();ctx.globalAlpha=0.06;
  const lg=ctx.createRadialGradient(475,130,0,475,130,80);
  lg.addColorStop(0,'#5b9cf6');lg.addColorStop(1,'transparent');
  ctx.fillStyle=lg;ctx.fillRect(380,40,190,180);ctx.restore();
 
  // Subsolo Paranormal (wide bottom)
  room(220,310,360,100,'#bb88ff','Subsolo Paranormal');
  // pentagram
  ctx.save();ctx.translate(400,360);ctx.strokeStyle='rgba(187,136,255,0.5)';ctx.lineWidth=1.2;
  for(let i=0;i<5;i++){const a1=i*Math.PI*4/5-Math.PI/2;const a2=((i+2)%5)*Math.PI*4/5-Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(a1)*30,Math.sin(a1)*30);ctx.lineTo(Math.cos(a2)*30,Math.sin(a2)*30);ctx.stroke();}
  ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);ctx.strokeStyle='rgba(187,136,255,0.25)';ctx.stroke();
  ctx.restore();
  // paranormal glow
  ctx.save();ctx.globalAlpha=0.08;
  const pg=ctx.createRadialGradient(400,360,0,400,360,70);
  pg.addColorStop(0,'#bb88ff');pg.addColorStop(1,'transparent');
  ctx.fillStyle=pg;ctx.fillRect(220,310,360,100);ctx.restore();
 
  // Saída  (top-right)
  room(590,40,110,90,'#cc2222','⚠ Saída');
  // danger stripes
  ctx.save();ctx.globalAlpha=0.06;ctx.strokeStyle='#cc2222';ctx.lineWidth=6;
  for(let i=-90;i<110;i+=16){ctx.beginPath();ctx.moveTo(590+i,40);ctx.lineTo(590+i+80,130);ctx.stroke();}
  ctx.restore();
 
  // Acesso (center small)
  room(380,240,100,70,'#1fc8a0','Acesso');
  furn(390,252,20,20,'#2a4a3a','Escad.');
 
  // Depósito (right)
  room(490,240,160,130,'#8b0000','Depósito');
  furn(500,255,30,30,'#5a4020','Caixa');furn(540,255,30,30,'#5a4020','Caixa');
  furn(580,255,30,30,'#5a4020','Caixa');furn(500,295,30,30,'#5a4020','Caixa');
  furn(610,260,24,90,'#5a3010','Estante');
 
  // ═══ WALLS ═══
  wall(240,40,240,310);   // center-left vertical
  wall(380,40,380,240);   // center-right upper
  wall(490,240,490,370);  // right vertical
  wall(40,220,240,220);   // left horizontal mid
  wall(380,220,490,220);  // right horizontal mid
  wall(220,310,220,410);  // subsolo left
  wall(580,310,580,410);  // subsolo right
  wall(220,410,580,410);  // subsolo bottom
  wall(590,40,590,240);   // saída left
  wall(700,40,700,130);   // saída right
  wall(590,130,700,130);  // saída bottom
 
  // ═══ DOORS ═══
  door(240,120,false);  // Recepção→Corredor
  door(240,260,false);  // Recepção→Arquivo
  door(380,130,false);  // Corredor→Lab
  door(380,290,false);  // Acesso→Lab lower
  door(490,290,false);  // Acesso→Depósito
  door(310,310,true);   // Zona→Subsolo
 
  // ═══ PJ MARKERS (default positions) ═══
  const pjStarts=[
    {x:140,y:120,col:'#1fc8a0',lbl:'PJ1'},
    {x:180,y:120,col:'#5b9cf6',lbl:'PJ2'},
    {x:140,y:150,col:'#c49a00',lbl:'PJ3'},
  ];
  pjStarts.forEach(p=>{
    ctx.save();
    ctx.beginPath();ctx.arc(p.x,p.y,16,0,Math.PI*2);
    ctx.fillStyle=p.col+'44';ctx.fill();
    ctx.strokeStyle=p.col;ctx.lineWidth=2;ctx.stroke();
    // direction pointer
    ctx.fillStyle='rgba(255,255,255,0.6)';ctx.beginPath();
    ctx.moveTo(p.x+16,p.y);ctx.lineTo(p.x+8,-5+p.y);ctx.lineTo(p.x+8,5+p.y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e8e0e0';ctx.font='bold 9px "Cinzel",serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(p.lbl,p.x,p.y);ctx.restore();
  });
 
  // ═══ AMBIENT LIGHT GLOWS ═══
  ctx.save();ctx.globalAlpha=0.04;
  // Reception light
  const rg=ctx.createRadialGradient(140,120,0,140,120,90);
  rg.addColorStop(0,'#ffdd88');rg.addColorStop(1,'transparent');
  ctx.fillStyle=rg;ctx.fillRect(40,40,200,160);
  // Lab cold light
  const cl=ctx.createRadialGradient(475,130,0,475,130,90);
  cl.addColorStop(0,'#aaccff');cl.addColorStop(1,'transparent');
  ctx.fillStyle=cl;ctx.fillRect(380,40,190,180);
  ctx.restore();
 
  // ═══ COMPASS ROSE ═══
  ctx.save();ctx.translate(W-40,H-40);ctx.globalAlpha=0.25;
  ctx.strokeStyle='#8b0000';ctx.lineWidth=1;
  [[0,-14,'N'],[0,14,'S'],[14,0,'L'],[-14,0,'O']].forEach(([dx,dy,lbl])=>{
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx,dy);ctx.stroke();
    ctx.fillStyle='#cc4444';ctx.font='8px "Cinzel",serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(lbl,dx*1.5,dy*1.5);
  });
  ctx.restore();
}
 
function mapClear(){
  if(!isMestre){toast('⛧ Apenas o Mestre pode limpar o mapa.');return;}
  if(!confirm('Limpar o mapa completamente?'))return;
  const bg=_getBgCanvas();
  if(bg){const bgCtx=bg.getContext('2d');bgCtx.clearRect(0,0,bg.width,bg.height);}
  mapTokens=[];selectedToken=null;selectedStruct=null;
  mapStructures=[];mapHistory=[];
  mapPushHistory();
  renderMapTokList();
  fullRedraw();
  saveMapData();
  saveStructures();
  toast('Mapa limpo.');
}
function mapReset(){
  if(!isMestre){toast('⛧ Apenas o Mestre pode restaurar o mapa base.');return;}
  if(confirm('Restaurar o mapa base?')){
    const bg=_getBgCanvas();
    if(bg){const bgCtx=bg.getContext('2d');bgCtx.clearRect(0,0,bg.width,bg.height);}
    mapTokens=[];selectedToken=null;mapStructures=[];selectedStruct=null;
    drawBaseMap();mapPushHistory();renderMapTokList();saveMapData();saveStructures();
    toast('Mapa base restaurado.');
  }
}
function downloadMap(){const a=document.createElement('a');a.download='mapa_op.png';a.href=document.getElementById('map-canvas').toDataURL();a.click();}
function setTool(t,btn){
  const mestreTools=['wall','pencil','rect','circle','line','text','erase'];
  if(!isMestre && mestreTools.includes(t)){toast('⛧ Apenas o Mestre pode usar ferramentas de edição.');return;}
  mapTool=t;
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
}
 

appMapa._compose = _compose;
appMapa._drawTokens = _drawTokens;
appMapa.applyRemoteBg = applyRemoteBg;
appMapa.downloadMap = downloadMap;
appMapa.drawBaseMap = drawBaseMap;
appMapa.drawMapGrid = drawMapGrid;
appMapa.fbPublishMap = fbPublishMap;
appMapa.fullRedraw = fullRedraw;
appMapa.fullRedrawSync = fullRedrawSync;
appMapa.getBgCtx = getBgCtx;
appMapa.initMap = initMap;
appMapa.loadMapTokens = loadMapTokens;
appMapa.mapClear = mapClear;
appMapa.mapDown = mapDown;
appMapa.mapHoverCheck = mapHoverCheck;
appMapa.mapMove = mapMove;
appMapa.mapPos = mapPos;
appMapa.mapPosRaw = mapPosRaw;
appMapa.mapPushHistory = mapPushHistory;
appMapa.mapReset = mapReset;
appMapa.mapRightClick = mapRightClick;
appMapa.mapUndo = mapUndo;
appMapa.mapUp = mapUp;
appMapa.mapWheel = mapWheel;
appMapa.redrawMapWithTokens = redrawMapWithTokens;
appMapa.removeTok = removeTok;
appMapa.renderMapTokList = renderMapTokList;
appMapa.saveMapData = saveMapData;
appMapa.selectTok = selectTok;
appMapa._compose = _compose;
appMapa._drawTokens = _drawTokens;
appMapa._getBgCanvas = _getBgCanvas;
appMapa._publishBgNow = _publishBgNow;
appMapa._scheduleBgPublish = _scheduleBgPublish;
appMapa._syncBgSize = _syncBgSize;
appMapa.applyRemoteBg = applyRemoteBg;
appMapa.downloadMap = downloadMap;
appMapa.drawBaseMap = drawBaseMap;
appMapa.drawMapGrid = drawMapGrid;
appMapa.fbPublishMap = fbPublishMap;
appMapa.fullRedraw = fullRedraw;
appMapa.fullRedrawSync = fullRedrawSync;
appMapa.getBgCtx = getBgCtx;
appMapa.initMap = initMap;
appMapa.loadMapTokens = loadMapTokens;
appMapa.mapClear = mapClear;
appMapa.mapDown = mapDown;
appMapa.mapHoverCheck = mapHoverCheck;
appMapa.mapMove = mapMove;
appMapa.mapPos = mapPos;
appMapa.mapPosRaw = mapPosRaw;
appMapa.mapPushHistory = mapPushHistory;
appMapa.mapReset = mapReset;
appMapa.mapRightClick = mapRightClick;
appMapa.mapUndo = mapUndo;
appMapa.mapUp = mapUp;
appMapa.mapWheel = mapWheel;
appMapa.redrawMapWithTokens = redrawMapWithTokens;
appMapa.removeTok = removeTok;
appMapa.renderMapTokList = renderMapTokList;
appMapa.saveMapData = saveMapData;
appMapa.selectTok = selectTok;
Object.assign(window, appMapa);
