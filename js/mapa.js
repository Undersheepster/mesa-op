const appMapa = {};
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
 
/* ══════════════════════════════════════════════
   MESTRE
══════════════════════════════════════════════ */
function populateMestre(){
  if(!isMestre)return;
  populateRollFilterSelect();
  renderAllRolls();
  const el=document.getElementById('players-panel');el.innerHTML='';
  const sel=document.getElementById('mestre-sel-player');sel.innerHTML='';
  const users=Object.keys(db.users).filter(u=>u!=='billy');
  if(!users.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px;padding:12px 0">Nenhum agente registrado ainda.</div>';return;}
  users.forEach(u=>{
    const c=db.characters[u]||defaultChar();
    const pvPct=c.pvMax?Math.round((c.pv/c.pvMax)*100):100;
    const sanPct=c.sanMax?Math.round((c.san/c.sanMax)*100):100;
    const activeConds=Object.entries(c.conds||{}).filter(([k,v])=>v).map(([k])=>k);
    const card=document.createElement('div');card.className='player-card';
    card.innerHTML=`
      <div class="player-avatar" style="border-color:${c.token?.ring||'#8b0000'}">${c.token?.imgData?`<img src="${c.token.imgData}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:ICONS[c.token?.icon||'skull']||'☠'}</div>
      <div class="player-info">
        <div class="player-name">${c.nome||u} <span style="font-size:11px;color:var(--white-dust);font-family:'Oswald',sans-serif;letter-spacing:.06em">${c.classe||'—'} · NEX ${c.nex||5}%</span></div>
        <div class="player-class">${c.trilha||'Sem trilha definida'}</div>
        <div class="player-vitals">
          <span class="vital-mini pv">PV <span>${c.pv}/${c.pvMax}</span></span>
          <span class="vital-mini san">SAN <span>${c.san}/${c.sanMax}</span></span>
          <span class="vital-mini esf">ESF <span>${c.esf}/${c.esfMax}</span></span>
          <span style="font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace">NEX ${c.nex}%</span>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <div style="flex:1;background:rgba(30,0,20,.6);height:4px"><div style="height:100%;background:#cc2222;width:${pvPct}%"></div></div>
          <div style="flex:1;background:rgba(20,30,20,.6);height:4px"><div style="height:100%;background:#22aa88;width:${sanPct}%"></div></div>
        </div>
        ${activeConds.length?`<div class="player-conds">${activeConds.map(co=>`<span class="pcond">${co}</span>`).join('')}</div>`:''}
      </div>
      <div class="player-actions">
        <button onclick="mestreRollFor('${u}')">Rolar para agente ↗</button>
        <button onclick="mestreViewChar('${u}')">Ver ficha completa</button>
        <button onclick="mestreEditVitals('${u}')">Editar vitais</button>
        <button onclick="mestreDeleteAgent('${u}')" style="border-color:#5a0000;color:#cc4444">🗑 Remover ficha</button>
      </div>`;
    el.appendChild(card);
    const opt=document.createElement('option');opt.value=u;opt.textContent=c.nome||u;sel.appendChild(opt);
  });
}
 
function loadPlayerNote(){
  const u=document.getElementById('mestre-sel-player').value;
  sv('mestre-player-note',(db.mestre.playerNotes||{})[u]||'');
}
function savePlayerNote(){
  const u=document.getElementById('mestre-sel-player').value;
  if(!db.mestre.playerNotes)db.mestre.playerNotes={};
  db.mestre.playerNotes[u]=document.getElementById('mestre-player-note').value;
  saveDB();
}
function saveMestreNotes(){db.mestre.notes=document.getElementById('mestre-notes').value;saveDB();}
function mestreRollFor(u){
  const f=20;const r=Math.floor(Math.random()*f)+1;
  const msg=`[Mestre] Rolou D20 para ${u}: ${r}`;
  if(!db.mestre.messages)db.mestre.messages=[];
  db.mestre.messages.unshift({txt:msg,h:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});
  saveDB();renderMestreInbox();toast(msg);
}
function mestreViewChar(u){
  const c=db.characters[u]||defaultChar();
  openModal('Ficha: '+(c.nome||u),`<div style="font-family:'Courier Prime',monospace;font-size:13px;line-height:2;color:var(--white-bone)">
    <div><b>Nome:</b> ${c.nome||'—'}</div><div><b>Classe:</b> ${c.classe}</div><div><b>NEX:</b> ${c.nex}%</div>
    <div><b>Trilha:</b> ${c.trilha||'—'}</div><div><b>PV:</b> ${c.pv}/${c.pvMax}</div>
    <div><b>Sanidade:</b> ${c.san}/${c.sanMax}</div><div><b>Esforço:</b> ${c.esf}/${c.esfMax}</div>
    <div><b>Atributos:</b> ${Object.entries(c.attrs||{}).map(([k,v])=>k+' '+v).join(', ')}</div>
    <div><b>Habilidades:</b> ${(c.habs||[]).map(h=>h.nome).join(', ')||'—'}</div>
    <div><b>Itens:</b> ${(c.inv||[]).map(i=>i.nome).join(', ')||'—'}</div>
    <div><b>Rituais:</b> ${(c.rituais||[]).map(r=>r.nome).join(', ')||'—'}</div>
  </div>`);
}
function mestreEditVitals(u){
  const c=db.characters[u]||defaultChar();
  openModal('Editar vitais: '+(c.nome||u),`<div style="display:flex;flex-direction:column;gap:12px">
    ${['pv','pvMax','san','sanMax','esf','esfMax'].map(k=>`
      <div class="field"><label>${k}</label><input id="mv-${k}" type="number" value="${c[k]||0}" style="background:rgba(20,0,15,.8);border:1px solid var(--blood-deep);color:var(--white-bone);padding:7px 10px;font-size:13px;outline:none"></div>
    `).join('')}
    <button class="btn-add" onclick="saveMestreVitals('${u}')">Salvar</button>
  </div>`);
}
function saveMestreVitals(u){
  const c=db.characters[u]||defaultChar();
  ['pv','pvMax','san','sanMax','esf','esfMax'].forEach(k=>{const e=document.getElementById('mv-'+k);if(e)c[k]=parseInt(e.value)||0;});
  db.characters[u]=c;saveDB();closeModal();populateMestre();toast('Vitais de '+(c.nome||u)+' atualizados.');
}
function mestreDeleteAgent(u){
  const c=db.characters[u]||{};
  const nome=c.nome||u;
  if(!confirm(`⚠ Remover ficha de "${nome}" permanentemente?\n\nIsso apaga todos os dados do agente: ficha, token, inventário, rituais, rolagens.\nEsta ação não pode ser desfeita.`))return;
  delete db.users[u];
  delete db.characters[u];
  if(db.rolls)delete db.rolls[u];
  if(db.mestre&&db.mestre.playerNotes)delete db.mestre.playerNotes[u];
  // Bloqueia sync remoto por mais tempo para evitar que o Firebase restaure o agente deletado
  _isSaving=true;
  clearTimeout(_saveDbTimer);
  // Força envio imediato ao Firebase (sem debounce)
  _ensureDB();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  if(window._fbPut){
    window._fbPut('gamedata',{
      users: db.users||{},
      characters: db.characters||{},
      rolls: db.rolls||{},
      mestre: db.mestre||{},
      mapbg: (db.maps&&db.maps['shared'])||null,
      mapbgTs: Date.now()
    });
  }
  setTimeout(()=>{ _isSaving=false; }, 8000);
  populateMestre();
  toast(`Ficha de ${nome} removida.`);
}
function broadcastMessage(){
  const msg=prompt('Mensagem para todos os agentes:');
  if(!msg)return;
  if(!db.mestre.messages)db.mestre.messages=[];
  db.mestre.messages.unshift({txt:'[Broadcast] '+msg,h:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});
  saveDB();renderMestreInbox();toast('Mensagem enviada.');
}
function renderAllRolls(){
  const el=document.getElementById('all-rolls-log');if(!el)return;
  const filterUser=document.getElementById('roll-filter-player')?.value||'';
  const allRolls=[];
  Object.entries(db.rolls||{}).forEach(([u,rolls])=>{
    if(filterUser&&u!==filterUser)return;
    (rolls||[]).forEach(r=>allRolls.push({...r,user:u}));
  });
  // Sort newest first
  allRolls.sort((a,b)=>(b.ts||0)-(a.ts||0));
  const summary=document.getElementById('roll-summary');
  if(summary)summary.textContent=`${allRolls.length} rolagem(ns) registrada(s)`;
  el.innerHTML='';
  if(!allRolls.length){el.innerHTML='<div style="color:var(--white-dust);font-size:12px;padding:8px 0">Nenhuma rolagem registrada ainda.</div>';return;}
  allRolls.slice(0,80).forEach(r=>{
    const c=db.characters[r.user]||{};
    const name=c.nome||r.user;
    const pct=r.total/(r.maxVal||20);
    const col=r.total<=4?'#cc4444':r.total>=(r.maxVal||20)?'#22cc88':'var(--white-bone)';
    const d=document.createElement('div');d.className='log-line';
    d.style.cssText='align-items:center;gap:10px;padding:6px 0';
    d.innerHTML=`<span class="log-tag" style="min-width:38px">${r.h||'—'}</span>
      <span style="min-width:80px;color:var(--gold-light);font-size:11px;font-family:'Oswald',sans-serif">${name}</span>
      <span style="flex:1;color:var(--white-ash)">${r.label||'Rolagem'}${r.ctx?' <span style="color:var(--white-dust);font-size:10px">('+r.ctx+')</span>':''}</span>
      <span style="font-family:'Cinzel Decorative',serif;font-size:16px;color:${col};min-width:30px;text-align:right">${r.total}</span>`;
    el.appendChild(d);
  });
}
 
function populateRollFilterSelect(){
  const sel=document.getElementById('roll-filter-player');if(!sel)return;
  sel.innerHTML='<option value="">Todos os agentes</option>';
  Object.keys(db.users).filter(u=>u!=='billy').forEach(u=>{
    const c=db.characters[u]||{};
    const opt=document.createElement('option');opt.value=u;opt.textContent=c.nome||u;sel.appendChild(opt);
  });
}
 
function renderMestreInbox(){
  const el=document.getElementById('mestre-inbox');if(!el)return;
  const msgs=db.mestre.messages||[];el.innerHTML='';
  if(!msgs.length){el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Nenhuma mensagem.</div>';return;}
  msgs.slice(0,20).forEach(m=>{
    const d=document.createElement('div');d.className='log-line';
    d.innerHTML=`<span class="log-tag">${m.h}</span> ${m.txt}`;el.appendChild(d);
  });
}
 
/* ══════════════════════════════════════════════
   MODAL / TOAST
══════════════════════════════════════════════ */
function openModal(title,bodyHTML){
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-body').innerHTML=bodyHTML;
  document.getElementById('modal-bg').classList.add('open');
}
function closeModal(){document.getElementById('modal-bg').classList.remove('open');}
let toastTimer=null;
function toast(msg){
  const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}
 
/* ══════════════════════════════════════════════
   TOKEN STATES (Comum / Arma / Lanterna / Morrendo)
══════════════════════════════════════════════ */
const TOKEN_STATES={
  comum:{label:'Comum',desc:'Estado normal do agente.',ring:'#8b0000',icon:'eye',cond:'',overlay:null},
  arma:{label:'Com Arma',desc:'Agente em combate, empunhando arma.',ring:'#cc4400',icon:'bolt',cond:'ARMADO',overlay:'🔫'},
  lanterna:{label:'Lanterna',desc:'Agente com lanterna — emite um cone de luz à frente no mapa.',ring:'#c49a00',icon:'moon',cond:'',overlay:'🔦',light:true},
  morrendo:{label:'Morrendo',desc:'Agente em estado crítico / inconsciente.',ring:'#3a0000',icon:'skull',cond:'MORRENDO',overlay:'<span class="sym-el sym-morte" title="Morte"></span>'},
};
let currentTokenState='comum';
// Imagens por estado: stateImages[state] = Image object (ou null)
let stateImages={comum:null,arma:null,lanterna:null,morrendo:null};

function openStateImageModal(){
  const stateLabels=Object.entries(TOKEN_STATES).map(([k,v])=>`
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--blood-deep)">
      <div style="min-width:64px;text-align:center">
        <canvas id="state-prev-${k}" width="64" height="64" style="border-radius:50%;border:3px solid ${v.ring}"></canvas>
      </div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:${v.ring==='#3a0000'?'#cc4444':v.ring};margin-bottom:4px">${v.label}</div>
        <div style="font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace;margin-bottom:6px">${v.desc}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <label style="padding:5px 10px;background:transparent;border:1px solid var(--crimson);color:var(--crimson-mid);font-family:'Cinzel',serif;font-size:10px;letter-spacing:.1em;cursor:pointer;text-transform:uppercase">
            Carregar foto
            <input type="file" accept="image/*" style="display:none" onchange="loadStateImage('${k}',event)">
          </label>
          <button class="btn-add" onclick="clearStateImage('${k}')" style="font-size:10px;padding:5px 10px;border-color:var(--blood-deep);color:var(--white-dust)">Remover foto</button>
          <button class="btn-add" onclick="copyMainToState('${k}')" style="font-size:10px;padding:5px 10px;border-color:rgba(138,106,0,.5);color:var(--gold-light)">Usar foto principal</button>
        </div>
      </div>
    </div>`).join('');
  openModal('Fotos por Estado do Token',`
    <div style="font-size:12px;color:var(--white-ash);font-family:'Courier Prime',monospace;padding:8px 10px;border-left:2px solid var(--crimson);margin-bottom:14px;line-height:1.6">
      Defina uma imagem diferente para cada estado do personagem no mapa.<br>
      Se não houver foto no estado, será usada a foto principal do token.
    </div>
    ${stateLabels}
  `);
  // Renderizar previews depois do modal abrir
  setTimeout(()=>{
    Object.keys(TOKEN_STATES).forEach(k=>_drawStatePreview(k));
  },80);
}

function _drawStatePreview(state){
  const cv=document.getElementById('state-prev-'+state);if(!cv)return;
  const ctx=cv.getContext('2d');const W=64,cx=32,cy=32,R=30;
  const st=TOKEN_STATES[state];
  const ring=st.ring;
  ctx.clearRect(0,0,W,W);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,R-2,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#0f000c';ctx.fillRect(0,0,W,W);
  const img=stateImages[state]||(state===currentTokenState?tokImgData:null)||tokImgData;
  if(img){ctx.drawImage(img,0,0,W,W);}
  else{
    ctx.fillStyle=ring+'33';ctx.beginPath();ctx.arc(cx,cy,20,0,Math.PI*2);ctx.fill();
    ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ring;
    ctx.fillText(ICONS[st.icon||'skull']||'☠',cx,cy);
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,R-2,0,Math.PI*2);ctx.strokeStyle=ring;ctx.lineWidth=4;ctx.stroke();
}

function loadStateImage(state,e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      stateImages[state]=img;
      // Salva no token do personagem
      const c=userChar(currentUser);
      if(!c.token)c.token={};
      if(!c.token.stateImgs)c.token.stateImgs={};
      c.token.stateImgs[state]=ev.target.result;
      _drawStatePreview(state);
      drawToken();saveDB();
      toast('Foto do estado "'+TOKEN_STATES[state].label+'" atualizada.');
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value='';
}

function clearStateImage(state){
  stateImages[state]=null;
  const c=userChar(currentUser);
  if(c.token&&c.token.stateImgs)delete c.token.stateImgs[state];
  _drawStatePreview(state);drawToken();saveDB();
  toast('Foto do estado "'+TOKEN_STATES[state].label+'" removida.');
}

function copyMainToState(state){
  if(!tokImgData){toast('⛧ Nenhuma foto principal carregada.');return;}
  stateImages[state]=tokImgData;
  const c=userChar(currentUser);
  if(!c.token)c.token={};
  if(!c.token.stateImgs)c.token.stateImgs={};
  c.token.stateImgs[state]=c.token.imgData||null;
  if(!c.token.stateImgs[state]){toast('⛧ A foto principal não está salva ainda. Carregue uma imagem primeiro.');return;}
  _drawStatePreview(state);drawToken();saveDB();
  toast('Foto principal copiada para estado "'+TOKEN_STATES[state].label+'".');
}

function _loadStateImages(){
  const c=userChar(currentUser);
  const stateImgs=(c.token&&c.token.stateImgs)||{};
  Object.keys(TOKEN_STATES).forEach(k=>{
    if(stateImgs[k]){
      const img=new Image();
      img.onload=()=>{stateImages[k]=img;if(k===currentTokenState)drawToken();};
      img.src=stateImgs[k];
    }else{stateImages[k]=null;}
  });
}
 
let _stateCooldown=false;
function setTokenState(state){
  if(!TOKEN_STATES[state])return;
  if(_stateCooldown)return; // evita duplo-clique acidental
  _stateCooldown=true;
  setTimeout(()=>{ _stateCooldown=false; }, 300);
  currentTokenState=state;
  const c=userChar(currentUser);
  const st=TOKEN_STATES[state];
  if(!c.token)c.token={};
  c.token.cond=st.cond;
  // update state buttons
  document.querySelectorAll('.state-btn').forEach(b=>b.classList.remove('active-state'));
  const btn=document.getElementById('state-btn-'+state);
  if(btn)btn.classList.add('active-state');
  // description
  const desc=document.getElementById('state-description');
  if(desc)desc.textContent='→ '+st.desc;
  // also update tok-cond selector if visible
  const sel=document.getElementById('tok-cond');
  if(sel)sel.value=st.cond||'';
  drawToken();
  saveDB();
  // update map token if exists — também sincroniza estado no token do mapa
  const myTok=mapTokens.find(t=>t.isPlayer && t.owner===currentUser);
  if(myTok){ myTok.state=state; saveMapData(); }
  redrawMapWithTokens();
  toast('Estado: '+st.label);
}
 
// Q key: pressionar UMA VEZ cicla o estado (debounce 400ms para não disparar múltiplas vezes)
let qKeyDown=false; // mantido para compatibilidade com mapHoverCheck
let _qDebounce=false;
document.addEventListener('keydown',e=>{
  if((e.key==='q'||e.key==='Q')&&!e.repeat&&!_qDebounce){
    _qDebounce=true;
    qKeyDown=true;
    cycleTokenState();
    setTimeout(()=>{ _qDebounce=false; qKeyDown=false; },400);
  }
});
 
function cycleTokenState(){
  const states=Object.keys(TOKEN_STATES);
  const idx=states.indexOf(currentTokenState);
  const next=states[(idx+1)%states.length];
  setTokenState(next);
}
 
function placeMyToken(){
  const c=userChar(currentUser);
  const tok=c.token||{};
  const st=TOKEN_STATES[currentTokenState]||TOKEN_STATES.comum;
  // Inicializa o mapa se ainda não foi aberto
  if(!mapCtx){ initMap(); }
  const canvas=document.getElementById('map-canvas');
  if(!canvas){ toast('Erro: canvas do mapa não encontrado.'); return; }
  const cx=canvas.width/2,cy=canvas.height/2;
  // Remove apenas o token deste usuário (não os de outros players)
  mapTokens=mapTokens.filter(t=>!(t.isPlayer && t.owner===currentUser));
  mapTokens.push({
    x:cx, y:cy,
    name:(c.nome||currentUser).slice(0,4),
    col:tok.ring||'#1fc8a0',
    r:GRID_SIZE/2-4,
    isPlayer:true,
    owner:currentUser,
    state:currentTokenState,
    angle:0
  });
  // Garante que o mapa está visível para o player ver o próprio token
  if(!document.getElementById('tab-mapa')?.classList.contains('active')){
    showTab('mapa', document.querySelector('.tab-btn[onclick*="mapa"]'));
  }
  redrawMapWithTokens();renderMapTokList();saveMapData();
  toast('⭐ Token colocado no mapa — estado: '+st.label);
}
 
 
 
let placingPreset=null;
 
// ── FURNITURE DEFINITIONS ──
const FURNITURE={
  mesa:      {w:80, h:48, fill:'#8b5e2e44',stroke:'#8b5e2e',label:'Mesa',   shape:'rect'},
  cadeira:   {w:28, h:28, fill:'#6e4a2044',stroke:'#6e4a20',label:'Cad',    shape:'rect'},
  sofa:      {w:90, h:36, fill:'#4a5a8a44',stroke:'#4a5a8a',label:'Sofa',   shape:'rect'},
  cama:      {w:70, h:110,fill:'#3a5a6a44',stroke:'#3a5a6a',label:'Cama',   shape:'rect'},
  armario:   {w:56, h:24, fill:'#5a3a2044',stroke:'#5a3a20',label:'Arm.',   shape:'rect'},
  estante:   {w:80, h:16, fill:'#7a5a3044',stroke:'#7a5a30',label:'Est.',   shape:'rect'},
  geladeira: {w:28, h:36, fill:'#4a7a8a44',stroke:'#4a7a8a',label:'Gel.',   shape:'rect'},
  pia:       {w:36, h:28, fill:'#6a8a9a44',stroke:'#6a8a9a',label:'Pia',    shape:'rect'},
  porta:     {w:8,  h:40, fill:'#8b000044',stroke:'#8b0000',label:'',       shape:'door'},
  janela:    {w:8,  h:36, fill:'#5b9cf644',stroke:'#5b9cf6',label:'',       shape:'window'},
  escada:    {w:60, h:40, fill:'#9a8a6a44',stroke:'#9a8a6a',label:'Esc',    shape:'stair'},
  caixa:     {w:28, h:28, fill:'#8a6a0044',stroke:'#8a6a00',label:'Cx',     shape:'rect'},
  barril:    {w:24, h:24, fill:'#5a4a2044',stroke:'#5a4a20',label:'',       shape:'circle'},
  computador:{w:32, h:24, fill:'#3a5a9a44',stroke:'#3a5a9a',label:'PC',     shape:'rect'},
  altar:     {w:60, h:44, fill:'#8b000066',stroke:'#cc0000',label:'Altar',  shape:'rect'},
  pentagrama:{w:60, h:60, fill:'#bb88ff22',stroke:'#bb88ff',label:'',       shape:'penta'},
  vela:      {w:10, h:10, fill:'#c49a0066',stroke:'#c49a00',label:'',       shape:'circle'},
  portal:    {w:50, h:50, fill:'#534ab766',stroke:'#7c6fff',label:'Portal', shape:'circle'},
};
 
// ── STRUCTURE OBJECTS (array de objetos clicaveis e arrastaveis) ──
let mapStructures=[];
let selectedStruct=null;
let draggingStruct=false;
 
function hitTestStruct(px,py){
  for(let i=mapStructures.length-1;i>=0;i--){
    const s=mapStructures[i];
    const f=FURNITURE[s.preset];if(!f)continue;
    const dx=px-s.x,dy=py-s.y;
    if(f.shape==='circle'||f.shape==='penta'){
      if(Math.hypot(dx,dy)<=f.w/2+8)return i;
    }else{
      const hw=f.w/2+6,hh=f.h/2+6;
      if(dx>=-hw&&dx<=hw&&dy>=-hh&&dy<=hh)return i;
    }
  }
  return -1;
}
 
function placePreset(name){
  if(!isMestre){toast('⛧ Apenas o Mestre pode adicionar objetos ao mapa.');return;}
  placingPreset=name;
  const canvas=document.getElementById('map-canvas');
  if(canvas)canvas.style.cursor='copy';
  toast('Clique no mapa para posicionar: '+(FURNITURE[name]&&FURNITURE[name].label||name));
}
 
function drawFurnitureObj(ctx,s,isSelected){
  const f=FURNITURE[s.preset];if(!f)return;
  const x=s.x,y=s.y,cx2=x-f.w/2,cy2=y-f.h/2;
  ctx.save();
  ctx.translate(x,y);ctx.rotate(s.angle||0);ctx.translate(-x,-y);
  ctx.globalAlpha=0.85;
  const stroke=isSelected?'#ffffc8':f.stroke;
  const lw=isSelected?2.5:1.5;
  if(f.shape==='circle'){
    ctx.beginPath();ctx.arc(x,y,f.w/2,0,Math.PI*2);
    ctx.fillStyle=f.fill;ctx.fill();
    ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();
  }else if(f.shape==='penta'){
    ctx.beginPath();
    for(let i=0;i<5;i++){
      const a1=i*Math.PI*4/5-Math.PI/2,a2=((i+2)%5)*Math.PI*4/5-Math.PI/2;
      ctx.moveTo(x+Math.cos(a1)*f.w/2,y+Math.sin(a1)*f.h/2);
      ctx.lineTo(x+Math.cos(a2)*f.w/2,y+Math.sin(a2)*f.h/2);
    }
    ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,f.w/2,0,Math.PI*2);
    ctx.strokeStyle=f.stroke+'80';ctx.lineWidth=0.8;ctx.stroke();
  }else if(f.shape==='door'){
    ctx.fillStyle=f.fill;ctx.fillRect(cx2,cy2,f.w,f.h);
    ctx.strokeStyle=stroke;ctx.lineWidth=lw+0.5;ctx.strokeRect(cx2,cy2,f.w,f.h);
    ctx.beginPath();ctx.arc(cx2,cy2,f.h,0,Math.PI/2);ctx.strokeStyle=f.stroke+'80';ctx.lineWidth=0.8;ctx.stroke();
  }else if(f.shape==='window'){
    ctx.fillStyle=f.fill;ctx.fillRect(cx2,cy2,f.w,f.h);
    ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.strokeRect(cx2,cy2,f.w,f.h);
    ctx.beginPath();ctx.moveTo(cx2,cy2+f.h/2);ctx.lineTo(cx2+f.w,cy2+f.h/2);ctx.stroke();
  }else if(f.shape==='stair'){
    ctx.strokeStyle=stroke;ctx.lineWidth=1.2;
    const steps=5,sw=f.w/steps;
    for(let i=0;i<=steps;i++){ctx.beginPath();ctx.moveTo(cx2+i*sw,cy2);ctx.lineTo(cx2+i*sw,cy2+f.h);ctx.stroke();}
    ctx.strokeRect(cx2,cy2,f.w,f.h);
  }else{
    ctx.fillStyle=f.fill;ctx.fillRect(cx2,cy2,f.w,f.h);
    ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.strokeRect(cx2,cy2,f.w,f.h);
  }
  // halo de selecao
  if(isSelected){
    ctx.setLineDash([4,3]);
    ctx.strokeStyle='rgba(255,255,160,0.5)';ctx.lineWidth=1;
    const hw=f.w/2+10,hh=f.h/2+10;
    if(f.shape==='circle'||f.shape==='penta'){
      ctx.beginPath();ctx.arc(x,y,f.w/2+10,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.strokeRect(x-hw,y-hh,hw*2,hh*2);
    }
    ctx.setLineDash([]);
  }
  if(f.label){
    ctx.globalAlpha=0.75;
    ctx.fillStyle=isSelected?'#ffffc8':'rgba(200,190,190,0.7)';
    ctx.font='10px "Cinzel",serif';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f.label,x,y);
  }
  ctx.restore();
}
 
function drawAllStructures(){
  if(!mapCtx)return;
  mapStructures.forEach((s,i)=>drawFurnitureObj(mapCtx,s,i===selectedStruct));
}
 
function saveStructures(){
  if(!db.maps) db.maps={};
  db.maps['shared_structs']=JSON.stringify(mapStructures);
  // Salva só os structs no localStorage sem disparar o fbSaveDB pesado (que inclui bg do mapa)
  try{ localStorage.setItem('op_db', JSON.stringify(db)); }catch(e){}
  fbPublishMap(); // publica em tempo real via SSE (leve, só JSON)
}
function loadStructures(){
  try{const d=db.maps['shared_structs']||db.maps[currentUser+'_structs'];mapStructures=d?JSON.parse(d):[];}
  catch(e){mapStructures=[];}
}
 

/* ══════════════════════════════════════════════
   FIREBASE — PRESENÇA E TEMPO REAL
══════════════════════════════════════════════ */

// Executa cb() quando o módulo Firebase estiver pronto.
// Se já estiver pronto, executa imediatamente.
function _whenFbReady(cb){
  if(window._fbReady){
    cb();
  } else {
    window.addEventListener('fb-module-ready', cb, { once: true });
  }
}

function fbConnect(user, isMestreFlag){
  _whenFbReady(()=>{
    // Verifica se Firebase está configurado (fbSetPresence existe mas fbInit pode retornar null)
    if(!window.fbSetPresence){
      console.warn('[Firebase] funções não disponíveis');
      return;
    }
    _doFbConnect(user, isMestreFlag);
  });
}

function _doFbConnect(user, isMestreFlag){
  // Monitora estado de conexão real e atualiza indicador visual
  if(window.fbWatchConnection){
    window.fbWatchConnection(connected => {
      const statusEl = document.getElementById('fb-status');
      if(statusEl){
        statusEl.style.display = '';
        statusEl.textContent = connected ? '● ONLINE' : '○ OFFLINE';
        statusEl.style.color = connected ? 'rgba(34,204,102,0.8)' : 'rgba(200,80,80,0.8)';
        statusEl.style.borderColor = connected ? 'rgba(34,204,102,0.35)' : 'rgba(200,80,80,0.35)';
      }
    });
  }

  // Grava presença no Firebase
  window.fbSetPresence(user, isMestreFlag);

  // Escuta lista de presença — todos os usuários (polling a cada 3s)
  if(window.fbWatchPresence){
    window.fbWatchPresence(presence => {
      renderOnlineList(presence);
    });
  }

  // Todos: escuta broadcasts do Mestre
  if(window.fbWatchBroadcast){
    window.fbWatchBroadcast(data => {
      if(!data || data.from === user) return;
      const el = document.getElementById('broadcast-incoming');
      const txt = document.getElementById('broadcast-text');
      if(el && txt){
        txt.textContent = data.msg;
        el.classList.add('show');
        setTimeout(()=>el.classList.remove('show'), 8000);
      }
    });
  }

  // Todos: escuta kick do próprio usuário
  if(!isMestreFlag && window.fbWatchKick){
    window.fbWatchKick(user, ()=>{
      toast('⛧ Você foi desconectado pelo Mestre.');
      setTimeout(()=>doLogout(), 2000);
    });
  }

  // Todos: recebe tokens + structs em tempo real (JSON leve)
  if(window.fbWatchMap){
    window.fbWatchMap(data => {
      // Anti-eco: ignora se o sid for o meu (eu que publiquei)
      if(data.sid && data.sid === window._mySessionId) return;
      try{
        const newTokens = JSON.parse(data.tokens || '[]');
        const newStructs = JSON.parse(data.structs || '[]');
        // Tokens: se estou arrastando o meu agora, preserva posição local
        const myTok = draggingToken && !isMestreFlag
          ? mapTokens.find(t=>t.isPlayer && t.owner===user)
          : null;
        mapTokens = newTokens;
        if(myTok){
          const idx = mapTokens.findIndex(t=>t.isPlayer && t.owner===user);
          if(idx>=0) mapTokens[idx]=myTok; else mapTokens.push(myTok);
        }
        // Estruturas: todos recebem sempre
        if(!draggingStruct) mapStructures = newStructs;
        fullRedraw();
        renderMapTokList();
      }catch(e){ console.warn('[mapa] sync err:',e); }
    });
  }

  // Todos: recebe bg do mapa quando Mestre salva (separado dos tokens)
  if(window.fbWatchBg){
    let _lastBgTs=0;
    window.fbWatchBg(data=>{
      if(!data || !data.ts) return;
      if(data.ts <= _lastBgTs) return;
      _lastBgTs = data.ts;
      if(!data.data) return;
      // Anti-eco: ignora se fui eu que publiquei
      if(data.sid && data.sid === window._mySessionId) return;
      // Salva local sem disparar fbSaveDB (evita loop)
      if(!db.maps) db.maps={};
      db.maps['shared'] = data.data;
      try{ localStorage.setItem('op_db', JSON.stringify(db)); }catch(e){}
      const bgImg=new Image();
      bgImg.onload=()=>{
        const bg=_getBgCanvas();
        if(!bg) return;
        const ctx2=bg.getContext('2d');
        ctx2.clearRect(0,0,bg.width,bg.height);
        ctx2.drawImage(bgImg,0,0,bg.width,bg.height);
        mapPushHistory();
        fullRedraw();
      };
      bgImg.src=data.data;
    });
  }
}

function renderOnlineList(presence){
  const entries = Object.values(presence || {});

  // ── Atualiza indicador da topbar (visível para todos) ──
  const indicator = document.getElementById('online-indicator');
  const countEl   = document.getElementById('online-count');
  const popupList = document.getElementById('online-popup-list');
  if(indicator){
    if(entries.length > 0){
      indicator.style.display = '';
      if(countEl) countEl.textContent = entries.length;
    } else {
      indicator.style.display = 'none';
    }
  }
  if(popupList){
    if(!entries.length){
      popupList.innerHTML = '<span style="color:var(--white-dust);font-size:12px">Nenhum agente online.</span>';
    } else {
      popupList.innerHTML = '';
      entries.forEach(p => {
        const sinceStr = p.since ? new Date(p.since).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '--:--';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:7px;font-size:12px;font-family:"Oswald",sans-serif;letter-spacing:.05em;color:'+(p.isMestre?'#c49a00':'var(--white-ash)');
        row.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#22cc66;flex-shrink:0;display:inline-block"></span><span>${p.isMestre?'⛧ ':''}${p.user}</span><span style="font-size:10px;color:var(--white-dust);margin-left:auto">${sinceStr}</span>`;
        popupList.appendChild(row);
      });
    }
  }

  // ── Atualiza painel da aba Mestre ──
  const el = document.getElementById('online-list');
  if(!el) return;
  if(!entries.length){
    el.innerHTML = '<span style="color:var(--white-dust);font-size:12px">Nenhum agente online.</span>';
    return;
  }
  el.innerHTML = '';
  entries.forEach(p => {
    const card = document.createElement('div');
    card.className = 'online-card' + (p.isMestre ? ' mestre-card' : '');
    const sinceStr = p.since ? new Date(p.since).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '--:--';
    const kickBtn = (isMestre && !p.isMestre && p.user !== currentUser)
      ? `<button class="kick-btn" onclick="fbKickPlayer('${p.user}')" title="Desconectar agente">✕</button>`
      : '';
    card.innerHTML = `<span class="o-dot"></span><span>${p.isMestre ? '⛧ ' : ''}${p.user}</span><span style="font-size:10px;color:var(--white-dust);margin-left:4px">${sinceStr}</span>${kickBtn}`;
    el.appendChild(card);
  });
}

function toggleOnlinePopup(){
  const popup = document.getElementById('online-popup');
  if(!popup) return;
  popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
}
// Fecha popup ao clicar fora
document.addEventListener('click', e => {
  const popup = document.getElementById('online-popup');
  const indicator = document.getElementById('online-indicator');
  if(popup && indicator && !popup.contains(e.target) && !indicator.contains(e.target)){
    popup.style.display = 'none';
  }
});

function fbSendBroadcast(){
  if(!isMestre){toast('⛧ Apenas o Mestre pode enviar broadcasts.');return;}
  const inp = document.getElementById('broadcast-input');
  const msg = inp ? inp.value.trim() : '';
  if(!msg){toast('Digite uma mensagem.');return;}
  if(!window.fbBroadcast){toast('Firebase não conectado.');return;}
  window.fbBroadcast(msg, currentUser);
  if(inp) inp.value = '';
  toast('⛧ Mensagem enviada a todos.');
}

function fbKickPlayer(user){
  if(!isMestre){return;}
  if(!confirm('Desconectar o agente "' + user + '"?'))return;
  if(!window.fbKick){toast('Firebase não conectado.');return;}
  window.fbKick(user);
  toast('Agente ' + user + ' desconectado.');
}

function updateMapToolbarVisibility(){
  const mestreOnlyIds=['tool-wall','tool-pencil','tool-rect','tool-circle','tool-line','tool-text','tool-token','tool-erase'];
  mestreOnlyIds.forEach(id=>{
    const btn=document.getElementById(id);
    if(btn) btn.style.display=isMestre?'':'none';
  });
  const presetBtns=document.querySelectorAll('.preset-btn');
  presetBtns.forEach(b=>b.style.display=isMestre?'':'none');
  const presetLabels=document.querySelectorAll('.preset-group-label');
  presetLabels.forEach(l=>l.style.display=isMestre?'':'none');
  ['mapUndo','mapClear','mapReset'].forEach(fn=>{
    document.querySelectorAll('.tool-btn').forEach(b=>{
      if(b.getAttribute('onclick')&&b.getAttribute('onclick').includes(fn))
        b.style.display=isMestre?'':'none';
    });
  });
  let hint=document.getElementById('map-player-hint');
  if(!isMestre){
    if(!hint){
      hint=document.createElement('div');hint.id='map-player-hint';
      hint.style.cssText='padding:6px 14px;background:rgba(50,0,30,0.7);border:1px solid var(--blood-deep);font-size:11px;color:var(--white-dust);font-family:"Courier Prime",monospace;border-top:none';
      hint.textContent='⛧ Modo Agente — você pode mover seu token. Todos os jogadores veem o mapa em tempo real.';
      const toolbar=document.querySelector('.map-toolbar');
      if(toolbar&&toolbar.parentElement)toolbar.parentElement.insertBefore(hint,toolbar.nextSibling);
    }
    hint.style.display='';
  } else {
    if(hint) hint.style.display='none';
  }
}

// ══════════════════════════════════════════════
//  SONS DE UI — Web Audio API
// ══════════════════════════════════════════════
(function(){
  let _actx = null;
  let _ready = false;
  let _ambNodes = [];
  let _muted = false; // controle global de mute

  function _initCtx(){
    if(_actx) return;
    try{
      _actx = new (window.AudioContext||window.webkitAudioContext)();
      if(_actx.state==='suspended'){
        _actx.resume().then(()=>{ _ready=true; _startAmbience(); }).catch(()=>{ _ready=true; _startAmbience(); });
      } else {
        _ready = true;
        _startAmbience();
      }
    }catch(e){}
  }

  function _ctx(){
    if(!_actx) return null;
    if(_actx.state==='suspended') _actx.resume().catch(()=>{});
    return _actx;
  }

  // ── SOM DE HOVER ──
  function playHover(){
    if(_muted) return;
    const ctx=_ctx(); if(!ctx) return;
    const t=ctx.currentTime;
    const o1=ctx.createOscillator(), g1=ctx.createGain();
    o1.type='sine';
    o1.frequency.setValueAtTime(880,t);
    o1.frequency.exponentialRampToValueAtTime(300,t+0.07);
    g1.gain.setValueAtTime(0.07,t);
    g1.gain.exponentialRampToValueAtTime(0.0001,t+0.1);
    o1.connect(g1); g1.connect(ctx.destination);
    o1.start(t); o1.stop(t+0.1);
    const o2=ctx.createOscillator(), g2=ctx.createGain();
    o2.type='triangle';
    o2.frequency.setValueAtTime(160,t);
    o2.frequency.exponentialRampToValueAtTime(55,t+0.06);
    g2.gain.setValueAtTime(0.04,t);
    g2.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
    o2.connect(g2); g2.connect(ctx.destination);
    o2.start(t); o2.stop(t+0.08);
  }

  // ── SOM DE CLICK ──
  function playClick(){
    if(_muted) return;
    const ctx=_ctx(); if(!ctx) return;
    const t=ctx.currentTime;
    const o1=ctx.createOscillator(), g1=ctx.createGain();
    o1.type='sine';
    o1.frequency.setValueAtTime(220,t);
    o1.frequency.exponentialRampToValueAtTime(55,t+0.1);
    g1.gain.setValueAtTime(0.15,t);
    g1.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
    o1.connect(g1); g1.connect(ctx.destination);
    o1.start(t); o1.stop(t+0.14);
    const o2=ctx.createOscillator(), g2=ctx.createGain();
    o2.type='sawtooth';
    o2.frequency.setValueAtTime(400,t);
    g2.gain.setValueAtTime(0.03,t);
    g2.gain.exponentialRampToValueAtTime(0.0001,t+0.05);
    o2.connect(g2); g2.connect(ctx.destination);
    o2.start(t); o2.stop(t+0.05);
  }

  // ── SOM DE DADOS ──
  // Simula o chacoalhar + queda de dado com ruído sintético
  window.playDiceRoll = function(faces){
    if(_muted) return;
    const ctx=_ctx(); if(!ctx) return;
    const t=ctx.currentTime;
    const masterGain=ctx.createGain();
    masterGain.gain.setValueAtTime(1,t);
    masterGain.connect(ctx.destination);

    // Fase 1: chacoalhar (ruído rítmico 0–0.5s)
    const shakeCount = 6 + Math.floor(Math.random()*4);
    for(let i=0;i<shakeCount;i++){
      const st=t + i*(0.07+Math.random()*0.04);
      // Ruído branco via oscilador de alta freq + filtro
      const buf=ctx.createBuffer(1,ctx.sampleRate*0.06,ctx.sampleRate);
      const data=buf.getChannelData(0);
      for(let j=0;j<data.length;j++) data[j]=(Math.random()*2-1)*0.8;
      const src=ctx.createBufferSource();
      src.buffer=buf;
      const filt=ctx.createBiquadFilter();
      filt.type='bandpass';
      filt.frequency.value=1800+Math.random()*1200;
      filt.Q.value=0.8;
      const g=ctx.createGain();
      const vol=0.12+Math.random()*0.08;
      g.gain.setValueAtTime(vol,st);
      g.gain.exponentialRampToValueAtTime(0.0001,st+0.055);
      src.connect(filt); filt.connect(g); g.connect(masterGain);
      src.start(st); src.stop(st+0.06);
    }

    // Fase 2: impacto final — dado batendo na mesa (0.5s)
    const impactT = t + 0.42 + Math.random()*0.1;
    // Bump grave
    const bump=ctx.createOscillator(), bGain=ctx.createGain();
    bump.type='sine';
    bump.frequency.setValueAtTime(160,impactT);
    bump.frequency.exponentialRampToValueAtTime(40,impactT+0.18);
    bGain.gain.setValueAtTime(0.35,impactT);
    bGain.gain.exponentialRampToValueAtTime(0.0001,impactT+0.22);
    bump.connect(bGain); bGain.connect(masterGain);
    bump.start(impactT); bump.stop(impactT+0.22);
    // Click seco do impacto
    const clkBuf=ctx.createBuffer(1,ctx.sampleRate*0.03,ctx.sampleRate);
    const clkData=clkBuf.getChannelData(0);
    for(let j=0;j<clkData.length;j++) clkData[j]=(Math.random()*2-1)*Math.exp(-j/200);
    const clkSrc=ctx.createBufferSource(); clkSrc.buffer=clkBuf;
    const clkFilt=ctx.createBiquadFilter(); clkFilt.type='highpass'; clkFilt.frequency.value=800;
    const clkGain=ctx.createGain();
    clkGain.gain.setValueAtTime(0.5,impactT);
    clkGain.gain.exponentialRampToValueAtTime(0.0001,impactT+0.03);
    clkSrc.connect(clkFilt); clkFilt.connect(clkGain); clkGain.connect(masterGain);
    clkSrc.start(impactT); clkSrc.stop(impactT+0.03);

    // Fase 3: rolagem pós-impacto (dado girando)
    const rollCount = 3 + Math.floor(Math.random()*3);
    for(let i=0;i<rollCount;i++){
      const st2 = impactT + 0.06 + i*0.09;
      const ticBuf=ctx.createBuffer(1,ctx.sampleRate*0.02,ctx.sampleRate);
      const ticData=ticBuf.getChannelData(0);
      for(let j=0;j<ticData.length;j++) ticData[j]=(Math.random()*2-1)*Math.exp(-j/80);
      const ticSrc=ctx.createBufferSource(); ticSrc.buffer=ticBuf;
      const ticFilt=ctx.createBiquadFilter(); ticFilt.type='bandpass';
      ticFilt.frequency.value=2200+Math.random()*800; ticFilt.Q.value=1.5;
      const ticG=ctx.createGain();
      const tvol=0.18*Math.pow(0.55,i);
      ticG.gain.setValueAtTime(tvol,st2);
      ticG.gain.exponentialRampToValueAtTime(0.0001,st2+0.02);
      ticSrc.connect(ticFilt); ticFilt.connect(ticG); ticG.connect(masterGain);
      ticSrc.start(st2); ticSrc.stop(st2+0.025);
    }

    // Fase 4: tom final diferente por tipo de dado (D4=agudo, D20=grave)
    const freqMap={4:600,6:480,8:400,10:340,12:280,20:200,100:150};
    const finalFreq = freqMap[faces]||300;
    const finalT = impactT + 0.06 + rollCount*0.09 + 0.04;
    const fin=ctx.createOscillator(), fGain=ctx.createGain();
    fin.type='triangle';
    fin.frequency.setValueAtTime(finalFreq,finalT);
    fin.frequency.exponentialRampToValueAtTime(finalFreq*0.6,finalT+0.25);
    fGain.gain.setValueAtTime(0.08,finalT);
    fGain.gain.exponentialRampToValueAtTime(0.0001,finalT+0.3);
    fin.connect(fGain); fGain.connect(masterGain);
    fin.start(finalT); fin.stop(finalT+0.3);
  };

  // ── AMBIENTAÇÃO INVESTIGATIVA — ORDEM PARANORMAL ──
  function _startAmbience(){
    const ctx=_ctx(); if(!ctx) return;
    const sliderEl = document.getElementById('ambience-vol');
    const targetVol = sliderEl ? (parseInt(sliderEl.value)/100)*0.10 : 0.055;

    const master=ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(targetVol, ctx.currentTime+12);
    master.connect(ctx.destination);
    window._ambienceMaster = master;
    window._ambienceCtx = ctx;

    // ── Reverb longo e etéreo (sala abandonada / corredor de delegacia) ──
    function _makeReverb(decaySec=4.5, wet=0.55){
      const rLen = Math.floor(ctx.sampleRate * decaySec);
      const rBuf = ctx.createBuffer(2, rLen, ctx.sampleRate);
      for(let ch=0; ch<2; ch++){
        const d = rBuf.getChannelData(ch);
        for(let i=0; i<rLen; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/rLen, 1.6);
      }
      const conv = ctx.createConvolver(); conv.buffer = rBuf;
      const dryG = ctx.createGain(); dryG.gain.value = 1-wet;
      const wetG = ctx.createGain(); wetG.gain.value = wet;
      return { conv, dryG, wetG,
        connect(src, dest){
          src.connect(dryG); dryG.connect(dest);
          src.connect(conv); conv.connect(wetG); wetG.connect(dest);
        }
      };
    }

    const mainReverb = _makeReverb(4.8, 0.52);
    mainReverb.dryG.connect(master);
    mainReverb.wetG.connect(master);

    // ── Bus de piano/melodia ──
    const pianoMaster = ctx.createGain(); pianoMaster.gain.value=0.09;
    pianoMaster.connect(mainReverb.conv);
    pianoMaster.connect(mainReverb.dryG);
    window._ambienceGuitarMaster = pianoMaster;

    // ── Bus de percussão suave ──
    const drumMaster = ctx.createGain(); drumMaster.gain.value=0.045;
    drumMaster.connect(master);
    window._ambienceDrumMaster = drumMaster;

    // ── Bus de pads/atmosfera ──
    const padMaster = ctx.createGain(); padMaster.gain.value=0.07;
    padMaster.connect(mainReverb.conv);
    padMaster.connect(mainReverb.dryG);

    // ── Bus de voz espectral ──
    const voxMaster = ctx.createGain(); voxMaster.gain.value=0.045;
    voxMaster.connect(mainReverb.conv);
    voxMaster.connect(mainReverb.dryG);

    // ─────────────────────────────────────────────
    //  DRONE LAYERS — base investigativa sutil
    //  Am natural — A C E G — clima melancólico/tenso
    //  A=110Hz, C=130.8Hz, E=164.8Hz, G=196Hz
    // ─────────────────────────────────────────────

    // Drone 1: A1 (55Hz) — presença sombria de fundo, muito suave
    const d1=ctx.createOscillator(), d1g=ctx.createGain();
    d1.type='sine'; d1.frequency.value=55.0;
    const d1f=ctx.createBiquadFilter(); d1f.type='lowpass'; d1f.frequency.value=120; d1f.Q.value=0.7;
    const d1lfo=ctx.createOscillator(), d1lfog=ctx.createGain();
    d1lfo.type='sine'; d1lfo.frequency.value=0.06; d1lfog.gain.value=0.06;
    d1lfo.connect(d1lfog); d1lfog.connect(d1g.gain); d1lfo.start();
    d1g.gain.value=0.14; d1.connect(d1f); d1f.connect(d1g); d1g.connect(master); d1.start();

    // Drone 2: E2 (82.4Hz) — quinta justa — cria harmonia melancólica
    const d2=ctx.createOscillator(), d2g=ctx.createGain();
    d2.type='sine'; d2.frequency.value=82.4;
    const d2lfo=ctx.createOscillator(), d2lfog=ctx.createGain();
    d2lfo.type='sine'; d2lfo.frequency.value=0.09; d2lfog.gain.value=0.5;
    d2lfo.connect(d2lfog); d2lfog.connect(d2.frequency); d2lfo.start();
    d2g.gain.value=0.08; d2.connect(d2g); d2g.connect(master); d2.start();

    // Drone 3: C3 (130.8Hz) — terça menor — cor sombria mas não agressiva
    const d3=ctx.createOscillator(), d3g=ctx.createGain();
    d3.type='sine'; d3.frequency.value=130.8;
    const d3lfo=ctx.createOscillator(), d3lfog=ctx.createGain();
    d3lfo.type='sine'; d3lfo.frequency.value=0.034; d3lfog.gain.value=0.3;
    d3lfo.connect(d3lfog); d3lfog.connect(d3.frequency); d3lfo.start();
    d3g.gain.value=0.05;
    const d3f=ctx.createBiquadFilter(); d3f.type='lowpass'; d3f.frequency.value=400;
    d3.connect(d3f); d3f.connect(d3g); d3g.connect(padMaster); d3.start();

    // Drone 4: shimmer etéreo G3 (196Hz) — sétima menor, tensão suave
    const d4=ctx.createOscillator(), d4g=ctx.createGain();
    d4.type='sine'; d4.frequency.value=196.0;
    const d4lfo=ctx.createOscillator(), d4lfog=ctx.createGain();
    d4lfo.type='sine'; d4lfo.frequency.value=0.027; d4lfog.gain.value=1.2;
    d4lfo.connect(d4lfog); d4lfog.connect(d4.frequency); d4lfo.start();
    d4g.gain.value=0.038;
    const d4hp=ctx.createBiquadFilter(); d4hp.type='highpass'; d4hp.frequency.value=160;
    d4.connect(d4hp); d4hp.connect(d4g); d4g.connect(padMaster); d4.start();

    // Camada de ruído: chuva fraca / estática de rádio / sala fria
    const bufSize=ctx.sampleRate*8;
    const nBuf=ctx.createBuffer(2,bufSize,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){
      const nd2=nBuf.getChannelData(ch);
      for(let i=0;i<bufSize;i++) nd2[i]=Math.random()*2-1;
    }
    const nSrc=ctx.createBufferSource(); nSrc.buffer=nBuf; nSrc.loop=true;
    const nf1=ctx.createBiquadFilter(); nf1.type='bandpass'; nf1.frequency.value=2800; nf1.Q.value=0.18; // chuva leve
    const nf2=ctx.createBiquadFilter(); nf2.type='lowpass';  nf2.frequency.value=5000;
    const ng=ctx.createGain(); ng.gain.value=0.028;
    const nLfo=ctx.createOscillator(), nLfog=ctx.createGain();
    nLfo.type='sine'; nLfo.frequency.value=0.025; nLfog.gain.value=0.012;
    nLfo.connect(nLfog); nLfog.connect(ng.gain); nLfo.start();
    nSrc.connect(nf1); nf1.connect(nf2); nf2.connect(ng); ng.connect(master); nSrc.start();

    // ─────────────────────────────────────────────
    //  VOZ ESPECTRAL — sussurros distantes, etéreos
    // ─────────────────────────────────────────────
    function _voxWhisper(t, freqBase, durSec, vol=0.06){
      const formants=[freqBase, freqBase*1.5, freqBase*2.4];
      formants.forEach((f,i)=>{
        const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f;
        const fm=ctx.createOscillator(); fm.type='sine'; fm.frequency.value=2.2+i*0.4;
        const fmg=ctx.createGain(); fmg.gain.value=f*0.010;
        fm.connect(fmg); fmg.connect(o.frequency); fm.start(t);
        const bf=ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=f; bf.Q.value=18;
        const g=ctx.createGain();
        const fadeIn=durSec*0.35, fadeOut=durSec*0.45;
        g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(vol/(i+1.5), t+fadeIn);
        g.gain.setValueAtTime(vol/(i+1.5), t+durSec-fadeOut);
        g.gain.linearRampToValueAtTime(0, t+durSec);
        o.connect(bf); bf.connect(g); g.connect(voxMaster);
        o.start(t); o.stop(t+durSec+0.1); fm.stop(t+durSec+0.1);
      });
    }

    // ─────────────────────────────────────────────
    //  PRIMITIVAS INSTRUMENTAIS — INVESTIGAÇÃO
    // ─────────────────────────────────────────────

    // Piano elétrico sombrio — nota única com envelope suave (Rhodes-like)
    function _pianoNote(freq, t, dur, vol=0.18){
      const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=freq;
      // Harmônico suave — corpo do piano elétrico
      const o2=ctx.createOscillator(); o2.type='triangle'; o2.frequency.value=freq*2;
      const o3=ctx.createOscillator(); o3.type='sine'; o3.frequency.value=freq*3.02; // leve detuning
      const g=ctx.createGain(), g2=ctx.createGain(), g3=ctx.createGain();
      // Ataque suave de piano + decaimento lento
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol, t+0.015);
      g.gain.exponentialRampToValueAtTime(vol*0.45, t+dur*0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      g2.gain.setValueAtTime(0,t); g2.gain.linearRampToValueAtTime(vol*0.35, t+0.012);
      g2.gain.exponentialRampToValueAtTime(0.0001, t+dur*0.6);
      g3.gain.setValueAtTime(0,t); g3.gain.linearRampToValueAtTime(vol*0.08, t+0.01);
      g3.gain.exponentialRampToValueAtTime(0.0001, t+dur*0.2);
      o.connect(g); g.connect(pianoMaster);
      o2.connect(g2); g2.connect(pianoMaster);
      o3.connect(g3); g3.connect(pianoMaster);
      o.start(t); o.stop(t+dur+0.1);
      o2.start(t); o2.stop(t+dur+0.1);
      o3.start(t); o3.stop(t+dur+0.1);
    }

    // Acorde de piano etéreo — vários sons suaves em sequência
    function _pianoChord(freqs, t, dur, vol=0.12){
      freqs.forEach((freq, i)=>{
        _pianoNote(freq, t + i*0.045, dur, vol/(1+i*0.15));
      });
    }

    // Pad de sintetizador atmosférico — sustain longo, suave
    function _pad(freq, t, dur, vol=0.06){
      const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=freq;
      const o2=ctx.createOscillator(); o2.type='sine'; o2.frequency.value=freq*1.004; // chorus leve
      const lfo=ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value=0.18;
      const lg=ctx.createGain(); lg.gain.value=freq*0.004;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t);
      const g=ctx.createGain(), g2=ctx.createGain();
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol, t+dur*0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      g2.gain.setValueAtTime(0,t); g2.gain.linearRampToValueAtTime(vol*0.6, t+dur*0.28);
      g2.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(padMaster);
      o2.connect(g2); g2.connect(padMaster);
      o.start(t); o.stop(t+dur+0.1);
      o2.start(t); o2.stop(t+dur+0.1); lfo.stop(t+dur+0.1);
    }

    // Sino / glockenspiel etéreo — toque único, decay longo
    function _bell(freq, t, vol=0.14, dur=3.5){
      const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=freq;
      const o2=ctx.createOscillator(); o2.type='sine'; o2.frequency.value=freq*2.756;
      const o3=ctx.createOscillator(); o3.type='sine'; o3.frequency.value=freq*5.40;
      [o,o2,o3].forEach((osc,i)=>{
        const g=ctx.createGain();
        const v=vol/Math.pow(i+1, 1.8);
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v, t+0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t+dur*(1-i*0.25));
        osc.connect(g); g.connect(pianoMaster); osc.start(t); osc.stop(t+dur+0.1);
      });
    }

    // Nota de contrabaixo suave — ancoragem harmônica discreta
    function _bass(freq, t, dur, vol=0.10){
      const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=freq;
      const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=200;
      const g=ctx.createGain();
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+0.06);
      g.gain.exponentialRampToValueAtTime(vol*0.5, t+dur*0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t+dur+0.1);
    }

    // ─────────────────────────────────────────────
    //  PERCUSSÃO SUAVE — investigação
    // ─────────────────────────────────────────────

    // Hi-hat suavíssimo de escova — textura de jazz/noir
    function _brush(t, vol=0.08){
      const dur=0.12;
      const bLen=Math.floor(ctx.sampleRate*dur);
      const bBuf=ctx.createBuffer(1,bLen,ctx.sampleRate);
      const bd=bBuf.getChannelData(0);
      for(let i=0;i<bLen;i++) bd[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*0.04));
      const bs=ctx.createBufferSource(); bs.buffer=bBuf;
      const bf=ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=5000; bf.Q.value=0.6;
      const bg=ctx.createGain(); bg.gain.setValueAtTime(vol,t); bg.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      bs.connect(bf); bf.connect(bg); bg.connect(drumMaster); bs.start(t); bs.stop(t+dur+0.01);
    }

    // Bump de contrabaixo (pizzicato suave) — groove discreto
    function _tick(t, vol=0.12){
      const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=80;
      o.frequency.setValueAtTime(90,t); o.frequency.exponentialRampToValueAtTime(62,t+0.08);
      const g=ctx.createGain();
      g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
      o.connect(g); g.connect(drumMaster); o.start(t); o.stop(t+0.18);
    }

    // ─────────────────────────────────────────────
    //  PROGRESSÃO HARMÔNICA — Am investigativo
    //  Am → F → C → G → Em → Am (loop com variações)
    //  A=110, C=130.8, E=164.8, F=174.6, G=196, B=246.9
    // ─────────────────────────────────────────────
    const BPM=58; // lento, contemplativo
    const BEAT=60/BPM;
    const MEAS=BEAT*4;

    // Progressões de acordes para piano etéreo
    const PROGRESSIONS=[
      // ── 0: ABERTURA — Am → F → C → G ──
      {
        name:'abertura', nBars:8, bpm:56,
        chords:[
          { t:0,        freqs:[110.0, 130.8, 164.8], dur:MEAS*1.8, vol:0.10 }, // Am
          { t:MEAS*2,   freqs:[87.3,  130.8, 174.6], dur:MEAS*1.8, vol:0.09 }, // F
          { t:MEAS*4,   freqs:[130.8, 164.8, 196.0], dur:MEAS*1.8, vol:0.09 }, // C
          { t:MEAS*6,   freqs:[98.0,  123.5, 196.0], dur:MEAS*1.8, vol:0.09 }, // G
        ],
        pads:[
          { t:0,      freq:110.0, dur:MEAS*4.5, vol:0.05 },
          { t:MEAS*4, freq:130.8, dur:MEAS*4.5, vol:0.05 },
        ],
        bass:[
          { t:0,      freq:55.0,  dur:MEAS*2, vol:0.07 },
          { t:MEAS*2, freq:43.65, dur:MEAS*2, vol:0.07 },
          { t:MEAS*4, freq:65.4,  dur:MEAS*2, vol:0.07 },
          { t:MEAS*6, freq:49.0,  dur:MEAS*2, vol:0.07 },
        ],
        bells:[
          { t:MEAS*1+BEAT, freq:440.0, vol:0.08, dur:4.0 },
          { t:MEAS*5+BEAT*2, freq:523.3, vol:0.07, dur:3.5 },
        ],
        melody:[
          { t:MEAS*0.5,   freq:220.0, dur:BEAT*1.8 },
          { t:MEAS*0.5+BEAT*2, freq:246.9, dur:BEAT*1.5 },
          { t:MEAS*1+BEAT*1, freq:261.6, dur:BEAT*2.0 },
          { t:MEAS*4.5,   freq:261.6, dur:BEAT*2.0 },
          { t:MEAS*5+BEAT, freq:246.9, dur:BEAT*1.5 },
          { t:MEAS*6.5,   freq:220.0, dur:BEAT*3.0 },
        ],
        vox:[
          { t:MEAS*3, freq:110.0, dur:7.0, vol:0.04 },
          { t:MEAS*7, freq:82.4,  dur:6.0, vol:0.03 },
        ],
        drums:'suave',
      },
      // ── 1: INVESTIGAÇÃO — Am → Em → F → Am ──
      {
        name:'investigacao', nBars:8, bpm:58,
        chords:[
          { t:0,        freqs:[110.0, 130.8, 164.8], dur:MEAS*1.9, vol:0.09 }, // Am
          { t:MEAS*2,   freqs:[82.4,  123.5, 164.8], dur:MEAS*1.9, vol:0.09 }, // Em
          { t:MEAS*4,   freqs:[87.3,  130.8, 174.6], dur:MEAS*1.9, vol:0.09 }, // F
          { t:MEAS*6,   freqs:[110.0, 130.8, 164.8], dur:MEAS*1.9, vol:0.10 }, // Am
        ],
        pads:[
          { t:BEAT,     freq:164.8, dur:MEAS*3, vol:0.04 },
          { t:MEAS*4.5, freq:174.6, dur:MEAS*3, vol:0.04 },
        ],
        bass:[
          { t:0,        freq:55.0,  dur:MEAS*2, vol:0.08 },
          { t:MEAS*2,   freq:41.2,  dur:MEAS*2, vol:0.07 },
          { t:MEAS*4,   freq:43.65, dur:MEAS*2, vol:0.07 },
          { t:MEAS*6,   freq:55.0,  dur:MEAS*2, vol:0.08 },
        ],
        bells:[
          { t:MEAS*2+BEAT*3, freq:329.6, vol:0.09, dur:3.2 },
          { t:MEAS*6+BEAT,   freq:392.0, vol:0.07, dur:4.0 },
        ],
        melody:[
          { t:BEAT*1.5,     freq:246.9, dur:BEAT*1.2 },
          { t:BEAT*3,       freq:261.6, dur:BEAT*2.5 },
          { t:MEAS*2+BEAT,  freq:246.9, dur:BEAT*1.5 },
          { t:MEAS*3+BEAT*2,freq:220.0, dur:BEAT*2.8 },
          { t:MEAS*4+BEAT*2,freq:261.6, dur:BEAT*1.8 },
          { t:MEAS*7,       freq:220.0, dur:BEAT*4.0 },
        ],
        vox:[
          { t:MEAS*1.5, freq:110.0, dur:8.0, vol:0.035 },
          { t:MEAS*5,   freq:82.4,  dur:7.5, vol:0.030 },
        ],
        drums:'suave',
      },
      // ── 2: SILÊNCIO TENSO — drones + sinais ──
      {
        name:'silencio', nBars:6, bpm:52,
        chords:[
          { t:MEAS,     freqs:[110.0, 164.8], dur:MEAS*2.5, vol:0.06 },
          { t:MEAS*4,   freqs:[98.0,  146.8], dur:MEAS*2.0, vol:0.05 },
        ],
        pads:[
          { t:0,        freq:110.0, dur:MEAS*3, vol:0.055 },
          { t:MEAS*2,   freq:130.8, dur:MEAS*2, vol:0.045 },
          { t:MEAS*4,   freq:82.4,  dur:MEAS*2.5, vol:0.05 },
        ],
        bass:[
          { t:MEAS*0.5, freq:55.0, dur:MEAS*3, vol:0.06 },
          { t:MEAS*4,   freq:49.0, dur:MEAS*2, vol:0.05 },
        ],
        bells:[
          { t:0,        freq:523.3, vol:0.09, dur:5.5 },
          { t:MEAS*3,   freq:440.0, vol:0.07, dur:4.5 },
          { t:MEAS*5.5, freq:392.0, vol:0.08, dur:5.0 },
        ],
        melody:[
          { t:MEAS*1.5, freq:220.0, dur:BEAT*3.5 },
          { t:MEAS*4+BEAT*2, freq:196.0, dur:BEAT*4.5 },
        ],
        vox:[
          { t:0,        freq:110.0, dur:9.0,  vol:0.045 },
          { t:MEAS*2.5, freq:130.8, dur:8.0,  vol:0.035 },
          { t:MEAS*5,   freq:82.4,  dur:10.0, vol:0.040 },
        ],
        drums:'minimo',
      },
      // ── 3: REVELAÇÃO — Dm → Bb → F → C → Am ──
      {
        name:'revelacao', nBars:8, bpm:60,
        chords:[
          { t:0,        freqs:[73.4,  87.3,  110.0], dur:MEAS*1.8, vol:0.10 }, // Dm
          { t:MEAS*2,   freqs:[58.27, 87.3,  116.5], dur:MEAS*1.8, vol:0.10 }, // Bb
          { t:MEAS*4,   freqs:[87.3,  130.8, 174.6], dur:MEAS*1.8, vol:0.09 }, // F
          { t:MEAS*6,   freqs:[65.4,  98.0,  130.8], dur:MEAS*1.8, vol:0.09 }, // C/G
        ],
        pads:[
          { t:BEAT*0.5, freq:146.8, dur:MEAS*4,  vol:0.05 },
          { t:MEAS*4.5, freq:174.6, dur:MEAS*3.5,vol:0.05 },
        ],
        bass:[
          { t:0,        freq:36.7,  dur:MEAS*2, vol:0.09 },
          { t:MEAS*2,   freq:29.14, dur:MEAS*2, vol:0.08 },
          { t:MEAS*4,   freq:43.65, dur:MEAS*2, vol:0.08 },
          { t:MEAS*6,   freq:32.7,  dur:MEAS*2, vol:0.07 },
        ],
        bells:[
          { t:MEAS*1+BEAT*2, freq:587.3, vol:0.08, dur:3.5 },
          { t:MEAS*3+BEAT,   freq:523.3, vol:0.07, dur:4.0 },
          { t:MEAS*7,        freq:440.0, vol:0.09, dur:4.5 },
        ],
        melody:[
          { t:BEAT,          freq:293.7, dur:BEAT*1.5 },
          { t:BEAT*2.8,      freq:261.6, dur:BEAT*1.8 },
          { t:MEAS+BEAT*2,   freq:246.9, dur:BEAT*2.5 },
          { t:MEAS*3+BEAT,   freq:261.6, dur:BEAT*2.0 },
          { t:MEAS*5+BEAT*2, freq:293.7, dur:BEAT*1.5 },
          { t:MEAS*7+BEAT,   freq:246.9, dur:BEAT*3.5 },
        ],
        vox:[
          { t:MEAS*2,   freq:73.4,  dur:7.0, vol:0.04 },
          { t:MEAS*6.5, freq:110.0, dur:8.0, vol:0.035 },
        ],
        drums:'suave',
      },
    ];

    // ─────────────────────────────────────────────
    //  PADRÕES DE PERCUSSÃO SUAVES
    // ─────────────────────────────────────────────
    function _drumPattern(pattern, barStart, barIdx, beat){
      switch(pattern){
        case 'suave': {
          // Escova discreta em cada pulso — noir/jazz investigativo
          const b=barStart;
          _brush(b, 0.07);
          _brush(b+beat,   0.05);
          _brush(b+beat*2, 0.07);
          _brush(b+beat*3, 0.05);
          // Bump de baixo no 1 e no 3 — alternado
          if(barIdx%2===0) _tick(b, 0.10);
          if(barIdx%2===1) _tick(b+beat*2, 0.09);
          // Variação suave a cada 4 compassos
          if(barIdx%4===3){
            _brush(b+beat*1.5, 0.06);
            _brush(b+beat*3.5, 0.06);
          }
          break;
        }
        case 'minimo': {
          // Apenas 1-2 brushes por compasso — quase só silêncio
          const b=barStart;
          if(barIdx%3===0) _brush(b, 0.05);
          if(barIdx%3===2) _brush(b+beat*2, 0.05);
          break;
        }
      }
    }

    // ─────────────────────────────────────────────
    //  MÁQUINA DE SEÇÕES
    // ─────────────────────────────────────────────
    const SECTION_ORDER=[0,1,2,1,3,0,2,1,0,3,1,2,0,1,3,2,1,0];
    let _secIdx=0, _barInSec=0;
    let _nextBar=ctx.currentTime+10; // fade-in suave antes de entrar

    // Modulação dos drones conforme a seção
    function _modulateDrones(secName, t){
      const gainMap={abertura:0.12, investigacao:0.14, silencio:0.10, revelacao:0.16};
      const d3Map   ={abertura:0.04, investigacao:0.05, silencio:0.03, revelacao:0.06};
      const d4Map   ={abertura:0.035,investigacao:0.04, silencio:0.05, revelacao:0.038};
      if(d1g){ d1g.gain.cancelScheduledValues(t); d1g.gain.linearRampToValueAtTime(gainMap[secName]||0.12, t+4); }
      if(d3g){ d3g.gain.cancelScheduledValues(t); d3g.gain.linearRampToValueAtTime(d3Map[secName]||0.04, t+5); }
      if(d4g){ d4g.gain.cancelScheduledValues(t); d4g.gain.linearRampToValueAtTime(d4Map[secName]||0.035, t+6); }
    }

    function _scheduleSection(){
      const now=ctx.currentTime;
      if(_nextBar-now>2.5) return;

      const secDef=PROGRESSIONS[SECTION_ORDER[_secIdx%SECTION_ORDER.length]];
      const beat=60/(secDef.bpm||BPM);
      const meas=beat*4;

      if(_barInSec===0){
        const sStart=_nextBar;
        _modulateDrones(secDef.name, sStart);

        // Acordes de piano
        (secDef.chords||[]).forEach(c=>{
          _pianoChord(c.freqs, sStart+c.t, c.dur, c.vol||0.09);
        });
        // Pads atmosféricos
        (secDef.pads||[]).forEach(p=>{
          _pad(p.freq, sStart+p.t, p.dur, p.vol||0.05);
        });
        // Baixo suave
        (secDef.bass||[]).forEach(b=>{
          _bass(b.freq, sStart+b.t, b.dur, b.vol||0.07);
        });
        // Sinos etéreos
        (secDef.bells||[]).forEach(b=>{
          _bell(b.freq, sStart+b.t, b.vol||0.10, b.dur||3.5);
        });
        // Melodia de piano
        (secDef.melody||[]).forEach(n=>{
          _pianoNote(n.freq, sStart+n.t, n.dur||BEAT*1.5, n.vol||0.14);
        });
        // Vozes espectrais sutis
        (secDef.vox||[]).forEach(v=>{
          _voxWhisper(sStart+v.t, v.freq, v.dur, v.vol||0.04);
        });
      }

      _drumPattern(secDef.drums, _nextBar, _barInSec, beat);
      _nextBar += meas;
      _barInSec++;

      if(_barInSec>=secDef.nBars){
        _barInSec=0;
        _secIdx++;
      }
    }

    const _sectionInterval=setInterval(_scheduleSection, 1400);
    _scheduleSection();
    window._ambienceGuitarInterval=_sectionInterval;
    window._ambienceDrumInterval=null;
  }

  // REMOVIDO — seções antigas de doom metal substituídas pela trilha investigativa
  // Placeholder para evitar referências quebradas:
  const _OLD_SECTION_STUB = null;
  // [bloco de seções antigas removido]

  // Volume da ambientação — exposto globalmente, chamado pelo slider
  window.setAmbienceVolume = function(v){
    const ctx = window._ambienceCtx;
    const m = window._ambienceMaster;
    if(!m || !ctx) return;
    const vol = Math.max(0, Math.min(0.12, v));
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.setTargetAtTime(vol, ctx.currentTime, 0.4);
    // Guitarra e bateria escalam junto (volumes relativos fixos)
    const gm = window._ambienceGuitarMaster;
    const dm = window._ambienceDrumMaster;
    const ratio = vol / 0.12; // 0..1
    if(gm){ gm.gain.cancelScheduledValues(ctx.currentTime); gm.gain.setTargetAtTime(0.13 * ratio, ctx.currentTime, 0.4); }
    if(dm){ dm.gain.cancelScheduledValues(ctx.currentTime); dm.gain.setTargetAtTime(0.11 * ratio, ctx.currentTime, 0.4); }
  };

  // ── CURSOR JS — cobre elementos com onclick dinâmico ──
  // Aplica cursor de pentagrama a qualquer elemento que tenha onclick mas não seja coberto pelo CSS
  const CURSOR_PENTA = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'28\' height=\'28\' viewBox=\'0 0 28 28\'%3E%3Cpolygon points=\'14,3 16.9,10.8 25.1,10.8 18.6,15.7 21,23.5 14,18.9 7,23.5 9.4,15.7 2.9,10.8 11.1,10.8\' fill=\'none\' stroke=\'%23cc0000\' stroke-width=\'1.4\' stroke-linejoin=\'round\'/%3E%3Ccircle cx=\'14\' cy=\'14\' r=\'2.5\' fill=\'%238b0000\' opacity=\'0.7\'/%3E%3C/svg%3E") 14 14, pointer';
  function _applyCursors(){
    document.querySelectorAll('[onclick]:not(button):not(input):not(select)').forEach(el=>{
      if(!el.style.cursor) el.style.cursor = CURSOR_PENTA;
    });
  }
  // Aplica ao carregar e sempre que o DOM mudar (ex: lista de online, tokens)
  const _cursorObs = new MutationObserver(()=>_applyCursors());
  if(document.body) _cursorObs.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded', _applyCursors);

  // ── LISTENERS ──
  const SEL='button,.tab-btn,.btn-ritual,.btn-add,.die-btn,.tool-btn,.preset-btn,.cond-chip,.state-btn,.adj,.sadj,.swatch,.icon-opt,.del-btn,.online-card,.map-token-item,a[onclick],.login-toggle a,.kick-btn';
  let _lastEl=null;

  // ── SOM DE DIGITAÇÃO (typewriter suave) ──
  let _typingThrottle = 0;
  function playTyping(){
    const ctx=_ctx(); if(!ctx) return;
    const now = Date.now();
    if(now - _typingThrottle < 60) return; // no máximo 1 som a cada 60ms
    _typingThrottle = now;
    const t=ctx.currentTime;
    // Click seco grave + clique mecânico
    const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.025),ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*0.003));
    const src=ctx.createBufferSource(); src.buffer=buf;
    const filt=ctx.createBiquadFilter(); filt.type='bandpass';
    filt.frequency.value=900+Math.random()*400; filt.Q.value=1.2;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.055+Math.random()*0.02, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.025);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t+0.03);
  }

  // ── MUTE GLOBAL ──
  window.toggleMuteAll = function(){
    _muted = !_muted;
    const btn = document.getElementById('mute-all-btn');
    if(btn) btn.textContent = _muted ? '🔇' : '🔊';
    // Silencia/restaura ambientação + guitarra + bateria
    const m = window._ambienceMaster;
    const ctx2 = window._ambienceCtx;
    const gm = window._ambienceGuitarMaster;
    const dm = window._ambienceDrumMaster;
    if(m && ctx2){
      const sl=document.getElementById('ambience-vol');
      const ratio = sl ? parseInt(sl.value)/100 : 0.55;
      const vol = _muted ? 0 : ratio * 0.12;
      const gVol = _muted ? 0 : ratio * 0.13;
      const dVol = _muted ? 0 : ratio * 0.11;
      m.gain.cancelScheduledValues(ctx2.currentTime);
      m.gain.setTargetAtTime(vol, ctx2.currentTime, 0.3);
      if(gm){ gm.gain.cancelScheduledValues(ctx2.currentTime); gm.gain.setTargetAtTime(gVol, ctx2.currentTime, 0.3); }
      if(dm){ dm.gain.cancelScheduledValues(ctx2.currentTime); dm.gain.setTargetAtTime(dVol, ctx2.currentTime, 0.3); }
    }
  };

  // Expõe flag de mute para as funções de som
  function _isMuted(){ return _muted; }

  // Listener de digitação em todos os inputs/textareas
  document.addEventListener('keydown', function(e){
    if(_muted) return;
    const tag = e.target.tagName;
    if((tag==='INPUT'&&e.target.type!=='range'&&e.target.type!=='checkbox'&&e.target.type!=='radio')||tag==='TEXTAREA'){
      if(e.key.length===1||e.key==='Backspace'||e.key==='Delete'||e.key==='Space') playTyping();
    }
  },{passive:true});

  document.addEventListener('click', function _boot(){
    _initCtx();
    document.removeEventListener('click',_boot);
  },{once:true});

  document.addEventListener('mouseover', e=>{
    const el=e.target.closest(SEL);
    if(el && el!==_lastEl){ _lastEl=el; if(_ready) playHover(); }
    if(!el) _lastEl=null;
  },{passive:true});

  document.addEventListener('mousedown', e=>{
    if(!_ready) _initCtx();
    const el=e.target.closest(SEL);
    if(el) playClick();
  },{passive:true});
})();

// ── CURSOR OLHO OCULTISTA ──
(function(){
  const cursor = document.createElement('div');
  cursor.id = 'eye-cursor';
  cursor.style.cssText = 'position:fixed;top:0;left:0;width:48px;height:48px;pointer-events:none;z-index:99999;margin-left:-24px;margin-top:-24px;';
  document.body.appendChild(cursor);

  // Olho fechado — linhas finas, estilo gravura ocultista, sem gore
  const eyeClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <filter id="cf" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- pálpebra superior — curva elegante -->
  <path d="M8 24 Q16 16 24 15.5 Q32 16 40 24" fill="none" stroke="#8b0000" stroke-width="1.3" stroke-linecap="round" filter="url(#cf)"/>
  <!-- pálpebra inferior — curva espelhada mais suave -->
  <path d="M8 24 Q16 30 24 30.5 Q32 30 40 24" fill="none" stroke="#8b0000" stroke-width="1.3" stroke-linecap="round" filter="url(#cf)"/>
  <!-- linha central da pálpebra fechada -->
  <path d="M8 24 Q24 24.5 40 24" fill="none" stroke="#5c0000" stroke-width="0.6" stroke-linecap="round" opacity="0.55"/>
  <!-- cílios superiores — traços finos e irregulares -->
  <line x1="13" y1="20.5" x2="11.5" y2="15.5" stroke="#6b0000" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="17.5" y1="18.2" x2="16.5" y2="13" stroke="#6b0000" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="22" y1="17" x2="21.5" y2="11.5" stroke="#6b0000" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="24" y1="16.5" x2="24" y2="11" stroke="#6b0000" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="26" y1="17" x2="26.5" y2="11.5" stroke="#6b0000" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="30.5" y1="18.2" x2="31.5" y2="13" stroke="#6b0000" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="35" y1="20.5" x2="36.5" y2="15.5" stroke="#6b0000" stroke-width="0.9" stroke-linecap="round"/>
  <!-- canto esquerdo — ponto de lacrimejamento -->
  <ellipse cx="8" cy="24" rx="1.5" ry="1" fill="#3d0000" opacity="0.6"/>
  <!-- canto direito -->
  <ellipse cx="40" cy="24" rx="1.5" ry="1" fill="#3d0000" opacity="0.6"/>
  <!-- raio decorativo ao redor — estilo ocultista -->
  <circle cx="24" cy="24" r="21" fill="none" stroke="#3d0000" stroke-width="0.5" stroke-dasharray="2 4" opacity="0.35"/>
</svg>`;

  // Olho aberto — olho de provid\u00eancia, geom\u00e9trico, ocultista
  const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <radialGradient id="og" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#0a0000"/>
      <stop offset="40%" stop-color="#3d0000"/>
      <stop offset="75%" stop-color="#7a0000"/>
      <stop offset="100%" stop-color="#8b0000"/>
    </radialGradient>
    <radialGradient id="pg" cx="42%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#1a0000"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <filter id="of" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="oc">
      <path d="M8 24 Q16 13 24 12.5 Q32 13 40 24 Q32 35 24 35.5 Q16 35 8 24Z"/>
    </clipPath>
  </defs>
  <!-- c\u00edrculo externo decorativo pontilhado — s\u00edmbolo ocultista -->
  <circle cx="24" cy="24" r="22" fill="none" stroke="#5c0000" stroke-width="0.5" stroke-dasharray="1.5 3.5" opacity="0.5" filter="url(#of)"/>
  <!-- tri\u00e2ngulo sutil — olho da provid\u00eancia -->
  <polygon points="24,4 44,40 4,40" fill="none" stroke="#3d0000" stroke-width="0.6" opacity="0.3"/>
  <!-- forma do olho — amendoado cl\u00e1ssico -->
  <path d="M8 24 Q16 13 24 12.5 Q32 13 40 24 Q32 35 24 35.5 Q16 35 8 24Z" fill="#0a0003" stroke="#8b0000" stroke-width="1.2" filter="url(#of)"/>
  <!-- esclera — leve gradiente escuro -->
  <path d="M8 24 Q16 13 24 12.5 Q32 13 40 24 Q32 35 24 35.5 Q16 35 8 24Z" fill="#0d0005"/>
  <!-- \u00edris — c\u00edrculo com gradiente vermelho-escuro -->
  <circle cx="24" cy="24" r="9" fill="url(#og)" stroke="#5c0000" stroke-width="0.8" filter="url(#of)"/>
  <!-- linhas radiais da \u00edris — estilo gravura, discretas -->
  <g clip-path="url(#oc)" opacity="0.35">
    <line x1="24" y1="15" x2="24" y2="33" stroke="#8b0000" stroke-width="0.5"/>
    <line x1="15" y1="24" x2="33" y2="24" stroke="#8b0000" stroke-width="0.5"/>
    <line x1="17.6" y1="17.6" x2="30.4" y2="30.4" stroke="#6b0000" stroke-width="0.4"/>
    <line x1="30.4" y1="17.6" x2="17.6" y2="30.4" stroke="#6b0000" stroke-width="0.4"/>
    <line x1="16.5" y1="20.5" x2="31.5" y2="27.5" stroke="#5c0000" stroke-width="0.3"/>
    <line x1="16.5" y1="27.5" x2="31.5" y2="20.5" stroke="#5c0000" stroke-width="0.3"/>
    <line x1="20.5" y1="15.5" x2="27.5" y2="32.5" stroke="#5c0000" stroke-width="0.3"/>
    <line x1="27.5" y1="15.5" x2="20.5" y2="32.5" stroke="#5c0000" stroke-width="0.3"/>
  </g>
  <!-- anel da \u00edris interna -->
  <circle cx="24" cy="24" r="6.5" fill="none" stroke="#2d0000" stroke-width="1" opacity="0.7"/>
  <!-- pupila — oval escura, levemente alongada -->
  <ellipse cx="24" cy="24" rx="3.5" ry="4.2" fill="url(#pg)"/>
  <!-- reflexo delicado — ponto de luz minimalista -->
  <circle cx="22.5" cy="21.5" r="1.2" fill="rgba(200,100,100,0.18)"/>
  <!-- p\u00e1lpebra superior — linha de contorno -->
  <path d="M8 24 Q16 13 24 12.5 Q32 13 40 24" fill="none" stroke="#8b0000" stroke-width="1.4" stroke-linecap="round"/>
  <!-- p\u00e1lpebra inferior -->
  <path d="M8 24 Q16 35 24 35.5 Q32 35 40 24" fill="none" stroke="#6b0000" stroke-width="1.2" stroke-linecap="round"/>
  <!-- c\u00edlios superiores -->
  <line x1="13" y1="19" x2="10.5" y2="13.5" stroke="#4a0000" stroke-width="1" stroke-linecap="round"/>
  <line x1="17.5" y1="16" x2="16" y2="10.5" stroke="#4a0000" stroke-width="1" stroke-linecap="round"/>
  <line x1="22" y1="14.5" x2="21.5" y2="9" stroke="#4a0000" stroke-width="1" stroke-linecap="round"/>
  <line x1="24" y1="14" x2="24" y2="8.5" stroke="#4a0000" stroke-width="1.1" stroke-linecap="round"/>
  <line x1="26" y1="14.5" x2="26.5" y2="9" stroke="#4a0000" stroke-width="1" stroke-linecap="round"/>
  <line x1="30.5" y1="16" x2="32" y2="10.5" stroke="#4a0000" stroke-width="1" stroke-linecap="round"/>
  <line x1="35" y1="19" x2="37.5" y2="13.5" stroke="#4a0000" stroke-width="1" stroke-linecap="round"/>
  <!-- cantos do olho -->
  <ellipse cx="8" cy="24" rx="1.8" ry="1.2" fill="#3d0000" opacity="0.7"/>
  <ellipse cx="40" cy="24" rx="1.8" ry="1.2" fill="#3d0000" opacity="0.7"/>
  <!-- aura sutil -->
  <path d="M8 24 Q16 13 24 12.5 Q32 13 40 24 Q32 35 24 35.5 Q16 35 8 24Z" fill="none" stroke="#8b0000" stroke-width="4" opacity="0.1" filter="url(#of)"/>
</svg>`;

  cursor.innerHTML = eyeClosed;

  let _cx = 0, _cy = 0;
  function _setCursorScale(scale){
    cursor.style.transform = scale !== 1 ? 'scale(' + scale + ')' : '';
  }

  document.addEventListener('mousemove', e => {
    _cx = e.clientX; _cy = e.clientY;
    cursor.style.left = _cx + 'px';
    cursor.style.top  = _cy + 'px';
  }, { passive: true });

  const CLICKSEL = 'a,button,input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"],select,[onclick],[role="button"],[tabindex],.tab-btn,.btn-ritual,.btn-add,.die-btn,.tool-btn,.preset-btn,.cond-chip,.state-btn,.adj,.sadj,.swatch,.icon-opt,.del-btn,.online-card,.map-token-item,.kick-btn,label';
  let _open = false;

  document.addEventListener('mouseover', e => {
    const over = e.target.closest(CLICKSEL);
    if(over && !_open){ _open=true; cursor.innerHTML=eyeOpen; _setCursorScale(1.18); }
    else if(!over && _open){ _open=false; cursor.innerHTML=eyeClosed; _setCursorScale(1); }
  }, { passive: true });

  document.addEventListener('mousedown', () => { _setCursorScale(_open?0.9:0.85); }, { passive: true });
  document.addEventListener('mouseup',   () => { _setCursorScale(_open?1.18:1); }, { passive: true });
  document.addEventListener('mouseleave', () => { cursor.style.opacity='0'; });
  document.addEventListener('mouseenter', () => { cursor.style.opacity='1'; });

  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{cursor:none!important}';
  document.head.appendChild(s);
})();

// Inicialização — síncrono, nunca trava
checkFirebaseSetup();
loadDB();
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();if(isMestre)mapUndo();}
  if((e.key==='Delete'||e.key==='Backspace')&&selectedStruct!==null){
    if(!isMestre){toast('⛧ Apenas o Mestre pode remover objetos.');return;}
    e.preventDefault();
    mapStructures.splice(selectedStruct,1);
    selectedStruct=null;
    fullRedraw();saveStructures();
    toast('Estrutura removida.');
  }
});



appMapa._applyCursors = _applyCursors;
appMapa._bass = _bass;
appMapa._bell = _bell;
appMapa._boot = _boot;
appMapa._brush = _brush;
appMapa._ctx = _ctx;
appMapa._doFbConnect = _doFbConnect;
appMapa._drawStatePreview = _drawStatePreview;
appMapa._drawTokens = _drawTokens;
appMapa._drumPattern = _drumPattern;
appMapa._initCtx = _initCtx;
appMapa._isMuted = _isMuted;
appMapa._loadStateImages = _loadStateImages;
appMapa._makeReverb = _makeReverb;
appMapa._modulateDrones = _modulateDrones;
appMapa._pad = _pad;
appMapa._pianoChord = _pianoChord;
appMapa._pianoNote = _pianoNote;
appMapa._publishBgNow = _publishBgNow;
appMapa._scheduleBgPublish = _scheduleBgPublish;
appMapa._scheduleSection = _scheduleSection;
appMapa._setCursorScale = _setCursorScale;
appMapa._startAmbience = _startAmbience;
appMapa._tick = _tick;
appMapa._voxWhisper = _voxWhisper;
appMapa._whenFbReady = _whenFbReady;
appMapa.broadcastMessage = broadcastMessage;
appMapa.clearStateImage = clearStateImage;
appMapa.closeModal = closeModal;
appMapa.copyMainToState = copyMainToState;
appMapa.cycleTokenState = cycleTokenState;
appMapa.door = door;
appMapa.downloadMap = downloadMap;
appMapa.drawAllStructures = drawAllStructures;
appMapa.drawBaseMap = drawBaseMap;
appMapa.drawFurnitureObj = drawFurnitureObj;
appMapa.drawMapGrid = drawMapGrid;
appMapa.fbConnect = fbConnect;
appMapa.fbKickPlayer = fbKickPlayer;
appMapa.fbPublishMap = fbPublishMap;
appMapa.fbSendBroadcast = fbSendBroadcast;
appMapa.furn = furn;
appMapa.hitTestStruct = hitTestStruct;
appMapa.loadMapTokens = loadMapTokens;
appMapa.loadPlayerNote = loadPlayerNote;
appMapa.loadStateImage = loadStateImage;
appMapa.loadStructures = loadStructures;
appMapa.mapClear = mapClear;
appMapa.mapHoverCheck = mapHoverCheck;
appMapa.mapReset = mapReset;
appMapa.mestreDeleteAgent = mestreDeleteAgent;
appMapa.mestreEditVitals = mestreEditVitals;
appMapa.mestreRollFor = mestreRollFor;
appMapa.mestreViewChar = mestreViewChar;
appMapa.openModal = openModal;
appMapa.openStateImageModal = openStateImageModal;
appMapa.placeMyToken = placeMyToken;
appMapa.placePreset = placePreset;
appMapa.playClick = playClick;
appMapa.playHover = playHover;
appMapa.playTyping = playTyping;
appMapa.populateMestre = populateMestre;
appMapa.populateRollFilterSelect = populateRollFilterSelect;
appMapa.redrawMapWithTokens = redrawMapWithTokens;
appMapa.removeTok = removeTok;
appMapa.renderAllRolls = renderAllRolls;
appMapa.renderMapTokList = renderMapTokList;
appMapa.renderMestreInbox = renderMestreInbox;
appMapa.renderOnlineList = renderOnlineList;
appMapa.room = room;
appMapa.saveMapData = saveMapData;
appMapa.saveMestreNotes = saveMestreNotes;
appMapa.saveMestreVitals = saveMestreVitals;
appMapa.savePlayerNote = savePlayerNote;
appMapa.saveStructures = saveStructures;
appMapa.selectTok = selectTok;
appMapa.setTokenState = setTokenState;
appMapa.setTool = setTool;
appMapa.toast = toast;
appMapa.toggleOnlinePopup = toggleOnlinePopup;
appMapa.updateMapToolbarVisibility = updateMapToolbarVisibility;
appMapa.wall = wall;
Object.assign(window, appMapa);
