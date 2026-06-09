const appDados = {};
/* ══════════════════════════════════════════════
   TOKEN
══════════════════════════════════════════════ */
const RINGS=['#8b0000','#cc0000','#1fc8a0','#5b9cf6','#c49a00','#bb88ff','#d45486','#e8e0e0','#ff6600','#00ccaa'];
const BGS=['#0f000c','#050005','#0a1a0a','#0a0a1a','#1a0a00','#050010','#1a0010','#000000'];
const ICONS={skull:'☠',eye:'<span class="sym-el sym-medo" title="Medo"></span>',flame:'🔥',bolt:'<span class="sym-el sym-energia" title="Energia"></span>',moon:'🌙',star:'★',shield:'⛊',ghost:'👻',blood:'<span class="sym-el sym-sangue" title="Sangue"></span>',rune:'⛧'};
let tokImgData=null;
 
function buildTokenControls(){
  const c=userChar(currentUser);
  const tok=c.token||{};
  const rs=document.getElementById('ring-swatches');
  if(rs&&!rs.dataset.built){
    rs.dataset.built='1';rs.innerHTML='';
    RINGS.forEach(col=>{
      const d=document.createElement('div');d.className='swatch';d.style.background=col;d.title=col;
      d.onclick=()=>{c.token.ring=col;rs.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));d.classList.add('active');drawToken();saveDB();};
      rs.appendChild(d);
    });
  }
  const bs=document.getElementById('bg-swatches');
  if(bs&&!bs.dataset.built){
    bs.dataset.built='1';bs.innerHTML='';
    BGS.forEach(col=>{
      const d=document.createElement('div');d.className='swatch';d.style.cssText=`background:${col};border:1px solid rgba(255,255,255,0.15)`;d.title=col;
      d.onclick=()=>{c.token.bg=col;bs.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));d.classList.add('active');drawToken();saveDB();};
      bs.appendChild(d);
    });
  }
  const io=document.getElementById('icon-opts');
  if(io&&!io.dataset.built){
    io.dataset.built='1';io.innerHTML='';
    Object.entries(ICONS).forEach(([k,em])=>{
      const d=document.createElement('div');d.className='icon-opt';d.textContent=em;d.title=k;
      d.onclick=()=>{c.token.icon=k;io.querySelectorAll('.icon-opt').forEach(x=>x.classList.remove('active'));d.classList.add('active');drawToken();saveDB();};
      io.appendChild(d);
    });
  }
  sv('tok-label',tok.label||'');sv('tok-cond',tok.cond||'');
  if(document.getElementById('tok-hp'))document.getElementById('tok-hp').checked=tok.showHp||false;
  if(document.getElementById('tok-ring-size'))document.getElementById('tok-ring-size').value=tok.ringSize||5;
  if(document.getElementById('tok-text-color'))document.getElementById('tok-text-color').value=tok.textColor||'#e8e0e0';
  if(tok.imgData&&!tokImgData){
    const img=new Image();img.onload=()=>{tokImgData=img;drawToken();};img.src=tok.imgData;
  }
  _loadStateImages();
  markActiveSwatches();
}
 
function markActiveSwatches(){
  const c=userChar(currentUser);const tok=c.token||{};
  document.querySelectorAll('#ring-swatches .swatch').forEach(s=>{s.classList.toggle('active',s.style.background===tok.ring||s.title===tok.ring);});
  document.querySelectorAll('#bg-swatches .swatch').forEach(s=>{s.classList.toggle('active',s.title===tok.bg);});
  document.querySelectorAll('#icon-opts .icon-opt').forEach(s=>{s.classList.toggle('active',s.title===tok.icon);});
}
 
function drawToken(){
  const canvas=document.getElementById('token-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=220,H=220,cx=110,cy=110,R=100;
  const c=userChar(currentUser);const tok=c.token||{};
  const ring=tok.ring||'#8b0000';
  const bg=tok.bg||'#0f000c';
  const ringSize=parseInt(document.getElementById('tok-ring-size')?.value||tok.ringSize||5);
  const textCol=document.getElementById('tok-text-color')?.value||tok.textColor||'#e8e0e0';
  const label=document.getElementById('tok-label')?.value||tok.label||'';
  const cond=document.getElementById('tok-cond')?.value||tok.cond||'';
  const showHp=document.getElementById('tok-hp')?.checked||tok.showHp||false;
  ctx.clearRect(0,0,W,H);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,R-ringSize/2,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // Usa imagem do estado atual, ou imagem principal
  const activeStateImg=stateImages[currentTokenState]||tokImgData;
  if(activeStateImg){ctx.drawImage(activeStateImg,0,0,W,H);}
  else{
    ctx.fillStyle=ring+'33';ctx.beginPath();ctx.arc(cx,cy,55,0,Math.PI*2);ctx.fill();
    ctx.font='62px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ring;
    ctx.fillText(ICONS[tok.icon||'skull']||'☠',cx,cy);
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,R-ringSize/2,0,Math.PI*2);
  ctx.strokeStyle=ring;ctx.lineWidth=ringSize;ctx.stroke();
  if(label){
    const lblY=H-18;
    ctx.fillStyle='rgba(0,0,0,0.72)';ctx.beginPath();ctx.rect(0,lblY-14,W,28);ctx.fill();
    ctx.fillStyle=textCol;ctx.font='bold 13px "Cinzel",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,cx,lblY);
  }
  if(cond){
    ctx.fillStyle='rgba(139,0,0,0.82)';ctx.beginPath();ctx.rect(0,0,W,22);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(cond.toUpperCase(),cx,11);
  }
  if(showHp){
    const pv=c.pv||0;const pvMax=c.pvMax||1;const pct=pv/pvMax;
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(18,H-14,W-36,8);
    ctx.fillStyle=pct>0.5?'#22aa55':pct>0.25?'#cc8822':'#cc2222';
    ctx.fillRect(18,H-14,(W-36)*pct,8);
  }
  const name=c.nome||currentUser||'Agente';
  document.getElementById('tok-name-display').textContent=name;
  tok.ring=ring;tok.bg=bg;tok.ringSize=ringSize;tok.textColor=textCol;
  tok.label=label;tok.cond=cond;tok.showHp=showHp;tok.icon=tok.icon||'skull';
  c.token=tok;
}
 
function loadTokImg(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{tokImgData=img;const c=userChar(currentUser);c.token.imgData=ev.target.result;drawToken();saveDB();};
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}
function clearTokImg(){tokImgData=null;const c=userChar(currentUser);c.token.imgData=null;drawToken();saveDB();}
function exportToken(){
  drawToken();const canvas=document.getElementById('token-canvas');
  const a=document.createElement('a');a.download='token_'+(userChar(currentUser).nome||currentUser)+'.png';a.href=canvas.toDataURL();a.click();
}
function exportTokenJSON(){
  const c=userChar(currentUser);const tok=c.token||{};
  const data=JSON.stringify({version:1,token:tok,nome:c.nome,classe:c.classe},null,2);
  const blob=new Blob([data],{type:'application/json'});
  const a=document.createElement('a');a.download='token_'+(c.nome||currentUser)+'.json';a.href=URL.createObjectURL(blob);a.click();
  toast('Token exportado como JSON.');
}
function importTokenJSON(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!data.token)throw new Error('JSON inválido');
      const c=userChar(currentUser);c.token=data.token;
      tokImgData=null;
      stateImages={comum:null,arma:null,lanterna:null,morrendo:null};
      document.getElementById('ring-swatches').removeAttribute('data-built');
      document.getElementById('bg-swatches').removeAttribute('data-built');
      document.getElementById('icon-opts').removeAttribute('data-built');
      buildTokenControls();drawToken();saveDB();
      toast('Token importado com sucesso!');
    }catch(err){toast('Erro ao importar token JSON.');}
  };
  reader.readAsText(file);
  e.target.value='';
}
 
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


appDados.applyRemoteBg = applyRemoteBg;
appDados.buildTokenControls = buildTokenControls;
appDados.clearTokImg = clearTokImg;
appDados.drawToken = drawToken;
appDados.exportToken = exportToken;
appDados.exportTokenJSON = exportTokenJSON;
appDados.importTokenJSON = importTokenJSON;
appDados.initMap = initMap;
appDados.loadTokImg = loadTokImg;
appDados.mapDown = mapDown;
appDados.mapMove = mapMove;
appDados.mapPos = mapPos;
appDados.mapPosRaw = mapPosRaw;
appDados.mapRightClick = mapRightClick;
appDados.mapUp = mapUp;
appDados.mapWheel = mapWheel;
appDados.markActiveSwatches = markActiveSwatches;
Object.assign(window, appDados);
