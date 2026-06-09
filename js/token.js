const appToken = {};
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
 

appToken.buildTokenControls = buildTokenControls;
appToken.clearTokImg = clearTokImg;
appToken.drawToken = drawToken;
appToken.exportToken = exportToken;
appToken.exportTokenJSON = exportTokenJSON;
appToken.importTokenJSON = importTokenJSON;
appToken.loadTokImg = loadTokImg;
appToken.BGS = BGS;
appToken.buildTokenControls = buildTokenControls;
appToken.clearTokImg = clearTokImg;
appToken.drawToken = drawToken;
appToken.exportToken = exportToken;
appToken.exportTokenJSON = exportTokenJSON;
appToken.ICONS = ICONS;
appToken.importTokenJSON = importTokenJSON;
appToken.loadTokImg = loadTokImg;
appToken.markActiveSwatches = markActiveSwatches;
appToken.RINGS = RINGS;
appToken.tokImgData = tokImgData;
Object.assign(window, appToken);
