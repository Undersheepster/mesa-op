const appCore = {};
/* ══════════════════════════════════════════════
   DATA LAYER — Firebase (online) + localStorage (fallback)
══════════════════════════════════════════════ */
const DB_KEY = 'op_mesa_v5';
let db = {};
let currentUser = null;
let isMestre = false;
let _fbWatching = false; // evita loop de sync

/* ── Firebase Setup Screen ── */
function checkFirebaseSetup(){
  const cfg = localStorage.getItem('op_firebase_config');
  let hasCfg = false;
  try { const c = JSON.parse(cfg); hasCfg = c && c.apiKey && c.apiKey !== 'AIzaSyPLACEHOLDER'; } catch(e){}
  if(!hasCfg){
    // Mostra tela de configuração
    document.getElementById('screen-firebase').style.display = 'flex';
    document.getElementById('screen-login').classList.remove('active');
  }
}

function saveFirebaseConfig(){
  const apiKey = document.getElementById('cfg-apiKey').value.trim();
  const databaseURL = document.getElementById('cfg-dbUrl').value.trim();
  const projectId = document.getElementById('cfg-projectId').value.trim();
  const appId = document.getElementById('cfg-appId').value.trim();
  const messagingSenderId = document.getElementById('cfg-senderId').value.trim();
  const errEl = document.getElementById('cfg-err');
  if(!apiKey || !databaseURL || !projectId){
    errEl.textContent = 'Preencha API Key, Database URL e Project ID.'; return;
  }
  errEl.textContent = 'Testando conexão...';
  const cfg = {
    apiKey, databaseURL, projectId,
    authDomain: projectId + '.firebaseapp.com',
    storageBucket: projectId + '.appspot.com',
    messagingSenderId: messagingSenderId || '000000000000',
    appId: appId || '1:000000000000:web:000000000000000000'
  };
  localStorage.setItem('op_firebase_config', JSON.stringify(cfg));
  errEl.style.color = '#22cc66';
  errEl.textContent = '⛧ Configuração salva! Recarregando...';
  setTimeout(()=>location.reload(), 1200);
}

function skipFirebaseSetup(){
  document.getElementById('screen-firebase').style.display = 'none';
  document.getElementById('screen-login').classList.add('active');
}

async function testFirebaseNow(){
  const diagEl = document.getElementById('cfg-diag');
  diagEl.style.display = 'block';
  diagEl.textContent = '⏳ Testando...\n';

  const cfg = {
    apiKey:    document.getElementById('cfg-apiKey').value.trim()    || (()=>{try{return JSON.parse(localStorage.getItem('op_firebase_config')||'{}').apiKey}catch(e){return ''}})(),
    databaseURL: document.getElementById('cfg-dbUrl').value.trim()   || (()=>{try{return JSON.parse(localStorage.getItem('op_firebase_config')||'{}').databaseURL}catch(e){return ''}})(),
    projectId: document.getElementById('cfg-projectId').value.trim() || (()=>{try{return JSON.parse(localStorage.getItem('op_firebase_config')||'{}').projectId}catch(e){return ''}})(),
  };

  const log = msg => { diagEl.textContent += msg + '\n'; };

  if(!cfg.apiKey)      { log('❌ API Key vazia'); return; }
  if(!cfg.databaseURL) { log('❌ Database URL vazia'); return; }
  if(!cfg.projectId)   { log('❌ Project ID vazio'); return; }

  log('✓ Campos preenchidos');
  log('📡 API Key: ' + cfg.apiKey.substring(0,12) + '...');
  log('📡 Database: ' + cfg.databaseURL);

  // Tenta conectar via fetch direto ao REST API do Firebase
  // (não precisa do SDK — funciona para testar se o banco está acessível)
  try {
    log('🔌 Testando acesso ao banco...');
    const url = cfg.databaseURL.replace(/\/$/, '') + '/presence.json?shallow=true&timeout=5s';
    const resp = await fetch(url);
    if(resp.ok){
      const data = await resp.json();
      log('✅ Banco acessível! Dados de presença: ' + JSON.stringify(data));
      log('');
      log('👥 Se aparece null = ninguém online ainda (normal)');
      log('👥 Se aparece nomes = esses usuários estão online');
      diagEl.style.color = '#22cc88';
    } else {
      const txt = await resp.text();
      log('❌ Erro HTTP ' + resp.status + ': ' + txt);
      if(resp.status === 401 || txt.includes('Permission denied')){
        log('');
        log('⚠️  REGRAS DO FIREBASE BLOQUEANDO!');
        log('   Vá em Firebase Console → Realtime Database');
        log('   → Regras → e cole isso:');
        log('   { "rules": { ".read": true, ".write": true } }');
        log('   (modo de teste — válido por 30 dias)');
      }
      diagEl.style.color = '#cc6644';
    }
  } catch(e) {
    log('❌ Falha na conexão: ' + e.message);
    log('');
    log('Possíveis causas:');
    log('• Database URL incorreta');
    log('• Projeto Firebase não existe mais');
    log('• Bloqueio de rede/firewall');
    diagEl.style.color = '#cc6644';
  }
}

function openFirebaseSettings(){
  const cfg = localStorage.getItem('op_firebase_config');
  try {
    const c = JSON.parse(cfg||'{}');
    document.getElementById('cfg-apiKey').value = c.apiKey||'';
    document.getElementById('cfg-dbUrl').value = c.databaseURL||'';
    document.getElementById('cfg-projectId').value = c.projectId||'';
    document.getElementById('cfg-appId').value = c.appId||'';
    document.getElementById('cfg-senderId').value = c.messagingSenderId||'';
  } catch(e){}
  document.getElementById('cfg-err').textContent='';
  document.getElementById('screen-firebase').style.display = 'flex';
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.remove('active');
}

/* ── Load: localStorage imediato, Firebase em background (nunca bloqueia) ── */
function loadDB(){
  try{const d=localStorage.getItem(DB_KEY);if(d)db=JSON.parse(d);}catch(e){db={};}
  _ensureDB();
  // Firebase sincroniza em background — não bloqueia a tela de login
  _syncFromFirebase();
}

function _syncFromFirebase(){
  const doSync = () => {
    if(!window.fbLoadDB) return;
    window.fbLoadDB().then(remote => {
      if(!remote) return;
      Object.assign(db.users, remote.users||{});
      // Merge personagens garantindo que arrays nunca fiquem undefined
      const remChars = remote.characters || {};
      // Remove personagens locais que foram deletados remotamente
      Object.keys(db.characters).forEach(u => {
        if(!remChars[u] && !(db.users[u])) delete db.characters[u];
      });
      Object.keys(remChars).forEach(u => {
        const def = defaultChar();
        db.characters[u] = Object.assign({}, def, db.characters[u]||{}, remChars[u]);
        // Garante que arrays existam
        const c = db.characters[u];
        if(!c.habs)     c.habs=[];
        if(!c.inv)      c.inv=[];
        if(!c.rituais)  c.rituais=[];
        if(!c.pistaList) c.pistaList=[];
        if(!c.notas)    c.notas=[];
        if(!c.conds)    c.conds={};
        if(!c.attrs)    c.attrs={Agilidade:1,Força:1,Intelecto:1,Presença:1,Vigor:1};
        if(!c.token)    c.token=def.token;
      });
      Object.assign(db.rolls, remote.rolls||{});
      if(remote.mestre) db.mestre = Object.assign({notes:'',playerNotes:{},messages:[]}, remote.mestre);
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      console.log('[DB] Sincronizado com Firebase');
    }).catch(e => console.warn('[DB] Firebase indisponível:', e));
  };
  if(window._fbReady){ doSync(); }
  else { window.addEventListener('fb-module-ready', doSync, { once: true }); }
}

function _ensureDB(){
  if(!db.users) db.users={};
  if(!db.characters) db.characters={};
  if(!db.maps) db.maps={};
  if(!db.mestre) db.mestre={notes:'',playerNotes:{},messages:[]};
  if(!db.rolls) db.rolls={};
}

function saveDB(){
  _ensureDB();
  _isSaving=true;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  if(window.fbSaveDB) window.fbSaveDB(db);
  // Limpa flag após tempo suficiente para o Firebase processar
  setTimeout(()=>{ _isSaving=false; }, 3000);
}

/* ── Inicia escuta em tempo real de mudanças remotas ── */
let _isSaving=false;
function startRemoteSync(){
  if(_fbWatching) return;
  const doSync = () => {
    if(!window.fbWatchDB) return;
    _fbWatching = true;
    setTimeout(()=>{
      window.fbWatchDB(remote => {
        if(!remote) return;
        if(_isSaving) return;
        const prevUsers = JSON.stringify(Object.keys(db.users||{}));
        // Substitui completamente em vez de fazer merge aditivo — respeita deleções
        db.users = Object.assign({}, remote.users||{});
        // Merge com sanitização de arrays
        const remChars = remote.characters || {};
        Object.keys(remChars).forEach(u => {
          const def = defaultChar();
          db.characters[u] = Object.assign({}, def, db.characters[u]||{}, remChars[u]);
          const c = db.characters[u];
          if(!c.habs)      c.habs=[];
          if(!c.inv)       c.inv=[];
          if(!c.rituais)   c.rituais=[];
          if(!c.pistaList) c.pistaList=[];
          if(!c.notas)     c.notas=[];
          if(!c.conds)     c.conds={};
          if(!c.attrs)     c.attrs={Agilidade:1,Força:1,Intelecto:1,Presença:1,Vigor:1};
          if(!c.token)     c.token=def.token;
        });
        Object.assign(db.rolls, remote.rolls||{});
        // Remove personagens locais de usuários que foram deletados remotamente
        Object.keys(db.characters).forEach(u => {
          if(!db.users[u]) delete db.characters[u];
        });
        if(remote.mestre){
          db.mestre = Object.assign({notes:'',playerNotes:{},messages:[]}, remote.mestre);
        }
        // Aplica bg do mapa compartilhado se mudou e não sou o Mestre
        if(!isMestre && remote.mapbg && remote.mapbg !== (db.maps&&db.maps['shared'])){
          if(!db.maps) db.maps={};
          db.maps['shared'] = remote.mapbg;
          applyRemoteBg(remote.mapbg);
        }
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        if(isMestre && JSON.stringify(Object.keys(db.users||{})) !== prevUsers){
          if(document.getElementById('tab-mestre').classList.contains('active')) populateMestre();
        }
      });
    }, 2000);
  };
  if(window._fbReady){ doSync(); }
  else { window.addEventListener('fb-module-ready', doSync, { once: true }); }
}
 
function userChar(u){return db.characters[u]||(db.characters[u]=defaultChar());}
function saveChar(){if(!currentUser)return;db.characters[currentUser]=Object.assign(userChar(currentUser),getFormChar());saveDB();}
 
function defaultChar(){
  return{
    nome:'',classe:'Combatente',nex:5,origem:'',trilha:'',historia:'',
    pv:10,pvMax:10,san:12,sanMax:12,esf:8,esfMax:8,
    attrs:{Agilidade:1,Força:1,Intelecto:1,Presença:1,Vigor:1},
    conds:{},habs:[],inv:[],rituais:[],pistaList:[],notas:[],
    opNome:'',opLocal:'',opAmeaca:'Baixo',opEnt:'',opResumo:'',
    token:{ring:'#8b0000',bg:'#0f000c',icon:'skull',label:'',cond:'',showHp:false,ringSize:5,textColor:'#e8e0e0',imgData:null}
  };
}
 
function getFormChar(){
  return{
    nome:v('f-nome'),classe:v('f-classe'),nex:parseInt(v('f-nex'))||5,
    origem:v('f-origem'),trilha:v('f-trilha'),historia:v('f-historia'),
    opNome:v('m-nome'),opLocal:v('m-local'),opAmeaca:v('m-ameaca'),opEnt:v('m-ent'),opResumo:v('m-resumo')
  };
}
 
function v(id){const e=document.getElementById(id);return e?e.value:'';}
function sv(id,val){const e=document.getElementById(id);if(e)e.value=(val===undefined||val===null)?'':val;}
 
/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
 
// Credenciais do Mestre — pode ter múltiplos logins de mestre
const MESTRE_CREDENTIALS = [
  { user: 'devil',  pass: 'mestre123' },
  { user: 'mestre', pass: 'mestre123' },
  { user: 'billy',  pass: 'eu sou billy' },
  { user: 'billy',  pass: 'eusoubilly' },
  { user: 'master', pass: 'master123' },
  { user: 'dm',     pass: 'dm123' },
];
 
function isMestreCredential(user, pass){
  return MESTRE_CREDENTIALS.some(c => c.user === user && c.pass === pass);
}
 
function doLogin(){
  const user=document.getElementById('li-user').value.trim().toLowerCase();
  const pass=document.getElementById('li-pass').value.trim();
  document.getElementById('li-err').textContent='';
  if(!user||!pass){document.getElementById('li-err').textContent='Preencha todos os campos.';return;}
 
  // Verifica credenciais de Mestre (hardcoded)
  if(isMestreCredential(user, pass)){
    loginAs(user, true, true);
    return;
  }
 
  // Verifica se é mestre salvo no banco (criado via cadastro especial)
  if(db.users[user] && db.users[user].isMestre && db.users[user].pass === btoa(pass)){
    loginAs(user, true, false);
    return;
  }
 
  // Login de jogador normal
  if(!db.users[user]){document.getElementById('li-err').textContent='Agente não encontrado.';return;}
  if(db.users[user].pass!==btoa(pass)){document.getElementById('li-err').textContent='Senha incorreta.';return;}
  loginAs(user,false,false);
}
 
function doRegister(){
  const user=document.getElementById('rg-user').value.trim().toLowerCase();
  const pass=document.getElementById('rg-pass').value;
  const pass2=document.getElementById('rg-pass2').value;
  document.getElementById('rg-err').textContent='';
  if(!user||!pass){document.getElementById('rg-err').textContent='Preencha todos os campos.';return;}
  if(pass.length<4){document.getElementById('rg-err').textContent='Senha muito curta (mín. 4 caracteres).';return;}
  if(pass!==pass2){document.getElementById('rg-err').textContent='Senhas não coincidem.';return;}
  if(user==='billy'){document.getElementById('rg-err').textContent='Este codinome está reservado.';return;}
  if(db.users[user]){document.getElementById('rg-err').textContent='Codinome já em uso.';return;}
  db.users[user]={pass:btoa(pass),createdAt:Date.now()};
  saveDB();
  loginAs(user,false,false);
}
 
function loginAs(user,roleFlag,skipDB){
  currentUser=user;
  isMestre=!!roleFlag;
  if(!skipDB&&!db.users[user]){
    db.users[user]={pass:btoa(''),createdAt:Date.now()};
    saveDB();
  }
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  document.getElementById('topbar-username').textContent=user;
  document.getElementById('topbar-role').innerHTML=isMestre?
    '<span class="role-badge role-mestre">Mestre</span>':
    '<span class="role-badge role-player">Agente</span>';
  const mestreTab=document.getElementById('tab-mestre-btn');
  if(mestreTab) mestreTab.style.display=isMestre?'':'none';
  populateAll();
  showTab('ficha',document.querySelector('.tab-btn'));
  // Mostra o próprio usuário imediatamente no painel (antes do Firebase responder)
  renderOnlineList({ [user]: { user, isMestre: !!roleFlag, since: Date.now(), online: true } });
  // Mostra o indicador de online na topbar
  const ind = document.getElementById('online-indicator');
  if(ind) ind.style.display = '';
  fbConnect(user, isMestre);
  startRemoteSync();
  toast('Bem-vindo, '+user+(isMestre?' — Mestre da mesa.':'.'));
}
 
function doLogout(){
  if(currentUser && window.fbRemovePresence) window.fbRemovePresence(currentUser);
  saveChar();currentUser=null;isMestre=false;
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
  document.getElementById('li-pass').value='';document.getElementById('li-err').textContent='';
}
 
function showRegister(){document.getElementById('login-form').style.display='none';document.getElementById('register-form').style.display='block';}
function showLogin(){document.getElementById('register-form').style.display='none';document.getElementById('login-form').style.display='block';}
 
function openMestreModal(){
  const m=document.getElementById('modal-mestre');
  m.style.display='flex';
  document.getElementById('m-user').value='';
  document.getElementById('m-pass').value='';
  document.getElementById('m-err').textContent='';
  setTimeout(()=>document.getElementById('m-user').focus(),50);
}
function closeMestreModal(){
  document.getElementById('modal-mestre').style.display='none';
}
function doMestreLogin(){
  const mUserEl=document.getElementById('m-user');
  const mPassEl=document.getElementById('m-pass');
  const mErrEl=document.getElementById('m-err');
  if(!mUserEl||!mPassEl||!mErrEl){console.error('Elementos do modal de mestre nao encontrados');return;}
  const u=mUserEl.value.trim().toLowerCase();
  const p=mPassEl.value.trim();
  if(!u||!p){mErrEl.textContent='Preencha todos os campos.';return;}
  if(isMestreCredential(u,p)){
    closeMestreModal();
    loginAs(u,true,true);
  } else {
    mErrEl.textContent='Credenciais invalidas.';
    mPassEl.value='';
    mPassEl.focus();
  }
}
function quickMestreLogin(){ openMestreModal(); }
 
function renderTrilhaInfo(){
  const trilha=(document.getElementById('f-trilha')||{}).value||'';
  const el=document.getElementById('trilha-info');
  if(!el)return;
  el.textContent=trilha?'Trilha: '+trilha:'';
}

const CLASSES_DESC={
  Combatente:'⚔ Especialista em combate direto. Usa armas e táticas militares para enfrentar o paranormal. Possui maior bônus em ataques, manobras e resistência a dano. Ideal para jogadores que preferem ação direta e confronto físico.',
  Especialista:'🔍 Profissional altamente treinado em uma área específica — tiro de precisão, espionagem, medicina ou tecnologia. Versátil e eficiente em missões que exigem habilidade técnica além do combate puro.',
  Ocultista:'🔮 Agente com afinidade paranormal inata. Conjura rituais do Outro Lado para atacar, defender e manipular a realidade. Depende de PE para seus poderes, mas é o mais versátil em termos de magia.',
  Investigador:'🕵 Mestre da análise e dedução. Descobre segredos, resolve mistérios e extrai informações em situações onde a força falha. Recebe bônus em perícias intelectuais e sociais de investigação.',
  Fiel:'✝ Guiado por uma crença ou devoção profunda que concede proteção contra o paranormal. Possui habilidades únicas de proteção, cura e resistência a entidades do Outro Lado.',
  Mundano:'👤 Pessoa comum arrastada para o mundo do paranormal. Sem treinamento especial, mas com resiliência e sorte extraordinárias. Ganha PE e habilidades especiais ao sobreviver situações impossíveis.'
};

function renderClasseDesc(){
  const cls=(document.getElementById('f-classe')||{}).value||'';
  const el=document.getElementById('classe-desc');
  if(!el)return;
  if(cls&&CLASSES_DESC[cls]){el.textContent=CLASSES_DESC[cls];el.style.display='block';}
  else{el.style.display='none';}
}

const ORIGENS_DB={
  'Abastado':{
    pericias:'Atualidades e Diplomacia',
    poder:'Patrocinador da Ordem',
    desc:'Você vem de família rica ou possui grande fortuna pessoal. Dinheiro abre portas que força bruta fecha. Financia operações da Ordem com recursos próprios.',
    poder_desc:'Uma vez por missão, pode gastar créditos pessoais para adquirir qualquer item de categoria I ou II sem custo de Prestígio. Aliados recebem +1 em testes de Diplomacia quando você está presente.'
  },
  'Acadêmico':{
    pericias:'Ciências e Investigação',
    poder:'Saber é Poder',
    desc:'Pesquisador, professor ou cientista. Seu conhecimento teórico aprofundado sobre o mundo natural (e sobrenatural) é seu maior trunfo dentro da Ordem.',
    poder_desc:'Uma vez por cena, pode gastar 2 PE para realizar um teste de Ciências no lugar de qualquer outra perícia intelectual. O resultado se aplica como se usasse a perícia original.'
  },
  'Agente de Saúde':{
    pericias:'Ciências e Medicina',
    poder:'Técnicas Medicinais',
    desc:'Médico, enfermeiro, paramédico ou socorrista. Você salva vidas em situações extremas. Na Ordem, mantém seus aliados funcionais no campo.',
    poder_desc:'Pode usar Medicina como ação de movimento (em vez de ação padrão). Uma vez por cena, ao curar um aliado, pode remover uma condição negativa além dos PV curados.'


appCore._ensureDB = _ensureDB;
appCore._syncFromFirebase = _syncFromFirebase;
appCore.checkFirebaseSetup = checkFirebaseSetup;
appCore.closeMestreModal = closeMestreModal;
appCore.defaultChar = defaultChar;
appCore.doLogin = doLogin;
appCore.doLogout = doLogout;
appCore.doMestreLogin = doMestreLogin;
appCore.doRegister = doRegister;
appCore.getFormChar = getFormChar;
appCore.isMestreCredential = isMestreCredential;
appCore.loadDB = loadDB;
appCore.loginAs = loginAs;
appCore.openFirebaseSettings = openFirebaseSettings;
appCore.openMestreModal = openMestreModal;
appCore.quickMestreLogin = quickMestreLogin;
appCore.renderClasseDesc = renderClasseDesc;
appCore.renderTrilhaInfo = renderTrilhaInfo;
appCore.saveChar = saveChar;
appCore.saveDB = saveDB;
appCore.saveFirebaseConfig = saveFirebaseConfig;
appCore.showLogin = showLogin;
appCore.showRegister = showRegister;
appCore.skipFirebaseSetup = skipFirebaseSetup;
appCore.startRemoteSync = startRemoteSync;
appCore.sv = sv;
appCore.testFirebaseNow = testFirebaseNow;
appCore.userChar = userChar;
appCore.v = v;
Object.assign(window, appCore);
