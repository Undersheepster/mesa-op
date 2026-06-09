const appMestre = {};
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
appMestre._doFbConnect = _doFbConnect;
appMestre._drawStatePreview = _drawStatePreview;
appMestre._loadStateImages = _loadStateImages;
appMestre._whenFbReady = _whenFbReady;
appMestre.broadcastMessage = broadcastMessage;
appMestre.clearStateImage = clearStateImage;
appMestre.closeModal = closeModal;
appMestre.copyMainToState = copyMainToState;
appMestre.cycleTokenState = cycleTokenState;
appMestre.drawAllStructures = drawAllStructures;
appMestre.drawFurnitureObj = drawFurnitureObj;
appMestre.fbConnect = fbConnect;
appMestre.fbKickPlayer = fbKickPlayer;
appMestre.fbSendBroadcast = fbSendBroadcast;
appMestre.hitTestStruct = hitTestStruct;
appMestre.loadPlayerNote = loadPlayerNote;
appMestre.loadStateImage = loadStateImage;
appMestre.loadStructures = loadStructures;
appMestre.mestreDeleteAgent = mestreDeleteAgent;
appMestre.mestreEditVitals = mestreEditVitals;
appMestre.mestreRollFor = mestreRollFor;
appMestre.mestreViewChar = mestreViewChar;
appMestre.openModal = openModal;
appMestre.openStateImageModal = openStateImageModal;
appMestre.placeMyToken = placeMyToken;
appMestre.placePreset = placePreset;
appMestre.populateMestre = populateMestre;
appMestre.populateRollFilterSelect = populateRollFilterSelect;
appMestre.renderAllRolls = renderAllRolls;
appMestre.renderMestreInbox = renderMestreInbox;
appMestre.renderOnlineList = renderOnlineList;
appMestre.saveMestreNotes = saveMestreNotes;
appMestre.saveMestreVitals = saveMestreVitals;
appMestre.savePlayerNote = savePlayerNote;
appMestre.saveStructures = saveStructures;
appMestre.setTokenState = setTokenState;
appMestre.toast = toast;
appMestre.toggleOnlinePopup = toggleOnlinePopup;
appMestre._doFbConnect = _doFbConnect;
appMestre._drawStatePreview = _drawStatePreview;
appMestre._loadStateImages = _loadStateImages;
appMestre._qDebounce = _qDebounce;
appMestre._stateCooldown = _stateCooldown;
appMestre._whenFbReady = _whenFbReady;
appMestre.broadcastMessage = broadcastMessage;
appMestre.clearStateImage = clearStateImage;
appMestre.closeModal = closeModal;
appMestre.copyMainToState = copyMainToState;
appMestre.currentTokenState = currentTokenState;
appMestre.cycleTokenState = cycleTokenState;
appMestre.draggingStruct = draggingStruct;
appMestre.drawAllStructures = drawAllStructures;
appMestre.drawFurnitureObj = drawFurnitureObj;
appMestre.fbConnect = fbConnect;
appMestre.fbKickPlayer = fbKickPlayer;
appMestre.fbSendBroadcast = fbSendBroadcast;
appMestre.FURNITURE = FURNITURE;
appMestre.hitTestStruct = hitTestStruct;
appMestre.loadPlayerNote = loadPlayerNote;
appMestre.loadStateImage = loadStateImage;
appMestre.loadStructures = loadStructures;
appMestre.mapStructures = mapStructures;
appMestre.mestreDeleteAgent = mestreDeleteAgent;
appMestre.mestreEditVitals = mestreEditVitals;
appMestre.mestreRollFor = mestreRollFor;
appMestre.mestreViewChar = mestreViewChar;
appMestre.openModal = openModal;
appMestre.openStateImageModal = openStateImageModal;
appMestre.placeMyToken = placeMyToken;
appMestre.placePreset = placePreset;
appMestre.placingPreset = placingPreset;
appMestre.populateMestre = populateMestre;
appMestre.populateRollFilterSelect = populateRollFilterSelect;
appMestre.qKeyDown = qKeyDown;
appMestre.renderAllRolls = renderAllRolls;
appMestre.renderMestreInbox = renderMestreInbox;
appMestre.renderOnlineList = renderOnlineList;
appMestre.saveMestreNotes = saveMestreNotes;
appMestre.saveMestreVitals = saveMestreVitals;
appMestre.savePlayerNote = savePlayerNote;
appMestre.saveStructures = saveStructures;
appMestre.selectedStruct = selectedStruct;
appMestre.setTokenState = setTokenState;
appMestre.stateImages = stateImages;
appMestre.toast = toast;
appMestre.toastTimer = toastTimer;
appMestre.toggleOnlinePopup = toggleOnlinePopup;
appMestre.TOKEN_STATES = TOKEN_STATES;
appMestre.updateMapToolbarVisibility = updateMapToolbarVisibility;
Object.assign(window, appMestre);
