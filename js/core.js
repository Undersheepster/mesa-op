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
  },
  'Artista':{
    pericias:'Diplomacia e Profissão (Artes)',
    poder:'Magnum Opus',
    desc:'Músico, ator, pintor, escritor. Você criou obras que tocam a alma humana — e talvez algo além dela. Usa criatividade e carisma para resolver problemas.',
    poder_desc:'Uma vez por missão, pode apresentar uma performance ou obra de arte para mudar a atitude de um grupo de NPCs (DT definida pelo Mestre). Sucesso: todos ficam Amigáveis por 1 hora.'
  },
  'Atleta':{
    pericias:'Atletismo e Fortitude',
    poder:'110%',
    desc:'Esportista de elite, corredor, nadador, escalador. Seu corpo é uma máquina perfeitamente treinada. Supera obstáculos físicos que paralisariam qualquer outro.',
    poder_desc:'Uma vez por cena, pode gastar 2 PE para ignorar os efeitos de uma condição física (Lento, Fatigado, Imobilizado) por 1 rodada. Recebe +2 em testes de Atletismo.'
  },
  'Camponês':{
    pericias:'Adestramento e Sobrevivência',
    poder:'Trilhas e Rumos',
    desc:'Criado no campo, floresta ou interior. Conhece os ritmos da natureza, rastrea animais e sobrevive em ambientes onde outros morreriam em horas.',
    poder_desc:'Não sofre penalidade em deslocamento e Sobrevivência por clima ruim ou terreno difícil natural. Uma vez por missão, pode guiar o grupo por um caminho alternativo evitando uma ameaça.'
  },
  'Criminoso':{
    pericias:'Crime e Furtividade',
    poder:'O Crime Compensa',
    desc:'Ladrão, hacker, vigarista ou traficante reformado. Conhece os cantos escuros da sociedade. Na Ordem, sua experiência com o submundo é surpreendentemente valiosa.',
    poder_desc:'Uma vez por cena, pode gastar 1 PE para acessar o mercado negro local. Obtém um item de categoria I sem custo de Prestígio (disponibilidade a critério do Mestre). +2 em testes de Crime.'
  },
  'Detetive':{
    pericias:'Investigação e Percepção',
    poder:'Olhos Aguçados',
    desc:'Investigador particular, perito forense ou policial federal. Resolve mistérios onde outros veem apenas caos. Entrou na Ordem ao se deparar com um caso impossível.',
    poder_desc:'Uma vez por cena, ao fazer um teste para procurar pistas, pode gastar 1 PE para receber +5 nesse teste. Se já for treinado em Investigação, recebe +1d20 em vez do bônus fixo.'
  },
  'Exorcista':{
    pericias:'Intuição e Religião',
    poder:'Exorcismo',
    desc:'Praticante de rituais religiosos de purificação. Enfrenta entidades do Outro Lado com fé e conhecimento ancestral. Chamado pela Ordem por suas habilidades únicas.',
    poder_desc:'Pode realizar um exorcismo (ação completa, Intuição ou Religião DT 20) em um ser possuído ou local amaldiçoado. Sucesso: remove a influência paranormal por 1 cena. +2 em testes contra efeitos de possessão.'
  },
  'Inventor':{
    pericias:'Profissão e Tecnologia',
    poder:'Ferramentas Favoritas',
    desc:'Engenheiro, maker ou cientista aplicado. Constrói soluções onde não existem. Seus gadgets improvisados já salvaram mais vidas do que qualquer arma convencional.',
    poder_desc:'Possui um kit de ferramentas pessoal. Uma vez por missão, pode criar um gadget improvisado (DT 15, Tecnologia) com efeito prático definido pelo Mestre. Itens tecnológicos que usa têm categoria reduzida em 1.'
  },
  'Lutador':{
    pericias:'Luta e Reflexos',
    poder:'Mão Pesada',
    desc:'Praticante de artes marciais, boxeador ou brigão de rua. Seus punhos são armas letais. Entrou na Ordem após um confronto com algo que não deveria existir.',
    poder_desc:'Recebe +2 em rolagens de dano com ataques corpo a corpo. Uma vez por cena, ao acertar um ataque desarmado, pode gastar 1 PE para aplicar uma manobra (derrubar, desarmar ou empurrar) gratuitamente.'
  },
  'Mercenário':{
    pericias:'Tática e Luta ou Pontaria (à escolha)',
    poder:'Posição de Combate',
    desc:'Soldado de aluguel, segurança privado ou ex-militar que trabalha por dinheiro. Pragmático e eficiente. Não faz perguntas — exceto sobre o pagamento.',
    poder_desc:'No início de cada combate, pode declarar uma posição tática (Ataque, Defesa ou Flanqueio). Dependendo da posição: +2 em testes de ataque, +2 na Defesa, ou +1d20 em ataques flanqueando, respectivamente.'
  },
  'Operário':{
    pericias:'Fortitude e Profissão (trabalhos braçais)',
    poder:'Ferramentas da Profissão',
    desc:'Construtor, mecânico, minerador ou trabalhador manual. Corpo forjado pelo trabalho duro. Conhece estruturas, máquinas e como quebrar (ou consertar) qualquer coisa.',
    poder_desc:'Possui proficiência com ferramentas de trabalho como armas improvisadas (+1 dano). Uma vez por missão, pode usar seu conhecimento profissional para resolver um problema estrutural ou mecânico automaticamente.'
  },
  'Policial':{
    pericias:'Atletismo e Pontaria',
    poder:'Patrulha T.I.',
    desc:'Policial civil, militar ou agente federal. Treinado para proteger e servir — mas o paranormal quebrou todas as suas certezas sobre o que realmente ameaça a cidade.',
    poder_desc:'Recebe +2 em testes de Pontaria com armas de fogo. Uma vez por missão, pode invocar recursos policiais (suporte, informações de registro, acesso a locais restritos) com uma ligação (DT 15 Diplomacia).'
  },
  'Religioso':{
    pericias:'Intuição e Religião',
    poder:'Devoção',
    desc:'Padre, pastor, monge, rabino ou adepto de qualquer fé. Sua crença é um escudo contra o Outro Lado. A Ordem o procurou porque sabe que a fé tem poder real.',
    poder_desc:'Recebe resistência a efeitos paranormais de medo e possessão (+2 em testes de Vontade contra esses efeitos). Uma vez por cena, pode usar Religião para confortar um aliado, restaurando 1d6 de Sanidade.'
  },
  'Soldado':{
    pericias:'Fortitude e Tática',
    poder:'Veterano de Guerra',
    desc:'Militar de carreira, ex-combatente ou veterano de conflitos armados. Disciplinado, resiliente e treinado para operar sob pressão extrema em qualquer ambiente.',
    poder_desc:'Não pode ser Surpreendido em combate. Uma vez por cena, pode gastar 2 PE para permitir que um aliado em alcance curto use sua reação como ação livre (reposicionamento tático).'
  },
  'Trambiqueiro':{
    pericias:'Enganação e Intuição',
    poder:'Papo Furado',
    desc:'Vigarista, charlatão ou manipulador nato. Faz qualquer um acreditar em qualquer coisa. Na Ordem, sua habilidade de improvisar histórias e disfarces vale tanto quanto uma pistola.',
    poder_desc:'Uma vez por cena, pode relançar um teste de Enganação ou Diplomacia falho, aceitando o novo resultado. Além disso, recebe +2 em testes de Enganação e +1 em Intuição para detectar mentiras de outros.'
  }
};

function renderOrigemDesc(){
  const orig=(document.getElementById('f-origem')||{}).value||'';
  const el=document.getElementById('origem-desc');
  if(!el)return;
  const o=ORIGENS_DB[orig];
  if(o){
    el.innerHTML=`<b style="color:var(--gold-light)">${o.poder}</b> &nbsp;|&nbsp; <span style="color:var(--crimson)"><span class="sym-el sym-conhecimento" title="Conhecimento"></span> ${o.pericias}</span><br>${o.desc}<br><span style="color:var(--white-ash);font-size:10.5px">⬝ ${o.poder_desc}</span>`;
    el.style.display='block';
  } else {
    el.style.display='none';
  }
}
 
/* ══════════════════════════════════════════════
   POPULATE / AUTO-SAVE
══════════════════════════════════════════════ */
function populateAll(){
  const c=userChar(currentUser);
  sv('f-nome',c.nome);sv('f-classe',c.classe);sv('f-nex',c.nex);sv('f-origem',c.origem);sv('f-trilha',c.trilha);sv('f-historia',c.historia);
  sv('m-nome',c.opNome);sv('m-local',c.opLocal);sv('m-ameaca',c.opAmeaca);sv('m-ent',c.opEnt);sv('m-resumo',c.opResumo);
  document.getElementById('s-pv').textContent=c.pv;document.getElementById('s-pvmax').textContent=c.pvMax;
  document.getElementById('s-san').textContent=c.san;document.getElementById('s-sanmax').textContent=c.sanMax;
  document.getElementById('s-esf').textContent=c.esf;document.getElementById('s-esfmax').textContent=c.esfMax;
  renderAttrs();renderPericias();renderConds();renderHabs();renderInv();renderRit();renderPistas();renderNotas();renderLog();loadTrilhaSelects();renderClasseDesc();renderOrigemDesc();
  buildTokenControls();
  if(isMestre){sv('mestre-notes',db.mestre.notes||'');populateMestre();}
}
 
let saveTimer=null;
function autoSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveChar();flashSave('save-ficha');flashSave('save-missao');},800);}
 
function flashSave(id){const e=document.getElementById(id);if(e){e.textContent='⛧ Salvo.';setTimeout(()=>e.textContent='',2000);}}
 
/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
function showTab(t,btn){
  document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  if(btn)btn.classList.add('active');
  if(t==='mapa'){setTimeout(initMap,60);}
  if(t==='token'){setTimeout(()=>{buildTokenControls();drawToken();},60);}
  if(t==='mestre'&&isMestre){populateMestre();}
}
 
/* ══════════════════════════════════════════════
   STATS
══════════════════════════════════════════════ */
function adjStat(stat,d){
  const c=userChar(currentUser);
  c[stat]=Math.max(0,Math.min(c[stat+'Max'],c[stat]+d));
  document.getElementById('s-'+stat).textContent=c[stat];
  saveDB();drawToken();
}
function adjMax(stat,d){
  const c=userChar(currentUser);
  c[stat+'Max']=Math.max(1,c[stat+'Max']+d);
  c[stat]=Math.min(c[stat],c[stat+'Max']);
  document.getElementById('s-'+stat).textContent=c[stat];
  document.getElementById('s-'+stat+'max').textContent=c[stat+'Max'];
  saveDB();
}
 
/* ══════════════════════════════════════════════
   ATTRS
══════════════════════════════════════════════ */
const ATTRS=['Agilidade','Força','Intelecto','Presença','Vigor'];
function renderAttrs(){
  const el=document.getElementById('attr-list');el.innerHTML='';
  const c=userChar(currentUser);
  ATTRS.forEach(a=>{
    const vv=c.attrs[a]||1;
    const row=document.createElement('div');row.className='attr-row';
    row.innerHTML=`<span class="attr-name">${a}</span>
      <div class="attr-track"><div class="attr-fill" style="width:${vv*20}%"></div></div>
      <span class="attr-val">${vv}</span>
      <button class="adj" onclick="adjAttr('${a}',-1)">−</button>
      <button class="adj" onclick="adjAttr('${a}',1)">+</button>`;
    el.appendChild(row);
  });
}
function adjAttr(a,d){const c=userChar(currentUser);c.attrs[a]=Math.max(1,Math.min(5,(c.attrs[a]||1)+d));renderAttrs();saveDB();}
 
/* ══════════════════════════════════════════════
   PERÍCIAS
══════════════════════════════════════════════ */
const PERICIAS=[
  {nome:'Atletismo',attr:'FOR'},
  {nome:'Atualidades',attr:'INT'},
  {nome:'Ciências',attr:'INT'},
  {nome:'Diplomacia',attr:'PRE'},
  {nome:'Enganação',attr:'PRE'},
  {nome:'Fortitude',attr:'VIG'},
  {nome:'Furtividade',attr:'AGI'},
  {nome:'Intimidação',attr:'PRE'},
  {nome:'Intuição',attr:'PRE'},
  {nome:'Investigação',attr:'INT'},
  {nome:'Luta',attr:'FOR'},
  {nome:'Medicina',attr:'INT'},
  {nome:'Ocultismo',attr:'INT'},
  {nome:'Percepção',attr:'PRE'},
  {nome:'Pilotagem',attr:'AGI'},
  {nome:'Pontaria',attr:'AGI'},
  {nome:'Prestidigitação',attr:'AGI'},
  {nome:'Profissão',attr:'INT'},
  {nome:'Reflexos',attr:'AGI'},
  {nome:'Religião',attr:'INT'},
  {nome:'Tática',attr:'INT'},
  {nome:'Tecnologia',attr:'INT'},
  {nome:'Vontade',attr:'PRE'}
];
const GRAUS=[{label:'—',val:0},{label:'Treinado',val:5},{label:'Veterano',val:10},{label:'Expert',val:15}];
function _buildPericiaEl(nome, attr, custom){
  const c=userChar(currentUser);
  if(!c.pericias) c.pericias={};
  const grau=c.pericias[nome]||0;
  const grauIdx=GRAUS.findIndex(g=>g.val===grau);
  const next=GRAUS[(grauIdx+1)%GRAUS.length];
  const isOn=grau>0;
  const wrap=document.createElement('div');
  wrap.style.cssText='display:flex;align-items:center;gap:4px;padding:5px 7px;border:1px solid '+(isOn?'rgba(139,0,0,0.6)':'rgba(58,0,0,0.35)')+';background:'+(isOn?'rgba(139,0,0,0.12)':'transparent')+';transition:all .15s;';
  // clickable main area
  const main=document.createElement('div');
  main.style.cssText='display:flex;align-items:center;gap:4px;flex:1;cursor:pointer;user-select:none;min-width:0';
  main.title='Avançar grau → '+next.label;
  main.innerHTML=`<span style="font-size:10px;font-family:'Oswald',sans-serif;letter-spacing:.05em;color:${isOn?'var(--crimson-hot)':'var(--white-dust)'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</span>`+
    `<span style="font-size:9px;font-family:'Courier Prime',monospace;color:${isOn?'var(--crimson-mid)':'var(--white-dust)'};white-space:nowrap;margin-left:2px">${attr}${grau>0?' +'+grau:''}</span>`+
    (grau>0?`<span style="font-size:8px;font-family:'Oswald',sans-serif;color:var(--gold-light);letter-spacing:.03em;margin-left:2px">${GRAUS[grauIdx].label}</span>`:'');
  main.onclick=()=>{
    const cur=c.pericias[nome]||0;
    const idx=GRAUS.findIndex(g=>g.val===cur);
    c.pericias[nome]=GRAUS[(idx+1)%GRAUS.length].val;
    renderPericias();saveDB();
  };
  wrap.appendChild(main);
  if(custom){
    const del=document.createElement('button');
    del.className='del-btn';del.textContent='×';del.title='Remover perícia';
    del.style.cssText='font-size:14px;padding:0 2px;flex-shrink:0';
    del.onclick=(e)=>{e.stopPropagation();delPericia(nome);};
    wrap.appendChild(del);
  }
  return wrap;
}
function renderPericias(){
  const el=document.getElementById('pericias-wrap');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.pericias) c.pericias={};
  if(!c.periciasCust) c.periciasCust=[];
  // built-in
  PERICIAS.forEach(p=>el.appendChild(_buildPericiaEl(p.nome,p.attr,false)));
  // custom
  c.periciasCust.forEach(p=>el.appendChild(_buildPericiaEl(p.nome,p.attr,true)));
}
function addPericia(){
  const nome=document.getElementById('per-inp-nome').value.trim();
  if(!nome){toast('⛧ Digite o nome da perícia.');return;}
  const attr=document.getElementById('per-inp-attr').value;
  const c=userChar(currentUser);
  if(!c.periciasCust) c.periciasCust=[];
  const existe=PERICIAS.some(p=>p.nome.toLowerCase()===nome.toLowerCase())||c.periciasCust.some(p=>p.nome.toLowerCase()===nome.toLowerCase());
  if(existe){toast('⛧ Perícia já existe.');return;}
  c.periciasCust.push({nome,attr});
  document.getElementById('per-inp-nome').value='';
  renderPericias();saveDB();toast('Perícia adicionada.');
}
function delPericia(nome){
  const c=userChar(currentUser);
  if(!c.periciasCust) return;
  c.periciasCust=c.periciasCust.filter(p=>p.nome!==nome);
  if(c.pericias) delete c.pericias[nome];
  renderPericias();saveDB();toast('Perícia removida.');
}
 
/* ══════════════════════════════════════════════
   CONDITIONS
══════════════════════════════════════════════ */
const CONDS=['Abalado','Apavorado','Inconsciente','Sangrando','Exausto','Paralisado','Maldito','Alucinando','Perturbado'];
function renderConds(){
  const el=document.getElementById('cond-grid');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.conds) c.conds={};
  CONDS.forEach(co=>{
    const b=document.createElement('button');
    b.className='cond-chip'+(c.conds[co]?' on':'');
    b.textContent=co;
    b.onclick=()=>{c.conds[co]=!c.conds[co];renderConds();saveDB();};
    el.appendChild(b);
  });
}
 
/* ══════════════════════════════════════════════
   HABS
══════════════════════════════════════════════ */
function renderHabs(){
  const el=document.getElementById('hab-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.habs) c.habs=[];
  if(!c.habs.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px;padding:4px 0">Nenhuma habilidade registrada.</div>';return;}
  c.habs.forEach((h,i)=>{
    const row=document.createElement('div');row.className='list-item';
    const cls=h.t==='p'?'badge-p':h.t==='r'?'badge-r':'badge-h';
    const lbl=h.t==='p'?'Paranormal':h.t==='r'?'Ritual':'Habilidade';
    row.innerHTML=`<div class="list-body"><span class="badge ${cls}">${lbl}</span>${h.nome}${h.desc?'<div class="list-meta">'+h.desc+'</div>':''}</div>
      <button class="del-btn" onclick="delHab(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addHab(){
  const n=document.getElementById('hab-inp').value.trim();if(!n)return;
  const c=userChar(currentUser);
  if(!c.habs) c.habs=[];
  c.habs.push({nome:n,t:document.getElementById('hab-tipo').value,desc:document.getElementById('hab-desc').value.trim()});
  document.getElementById('hab-inp').value='';document.getElementById('hab-desc').value='';
  renderHabs();saveDB();toast('Habilidade adicionada.');
}
function delHab(i){const c=userChar(currentUser);c.habs.splice(i,1);renderHabs();saveDB();}
 

appCore._buildPericiaEl = _buildPericiaEl;
appCore._ensureDB = _ensureDB;
appCore._syncFromFirebase = _syncFromFirebase;
appCore.addHab = addHab;
appCore.addPericia = addPericia;
appCore.adjAttr = adjAttr;
appCore.adjMax = adjMax;
appCore.adjStat = adjStat;
appCore.autoSave = autoSave;
appCore.checkFirebaseSetup = checkFirebaseSetup;
appCore.closeMestreModal = closeMestreModal;
appCore.defaultChar = defaultChar;
appCore.delHab = delHab;
appCore.delPericia = delPericia;
appCore.doLogin = doLogin;
appCore.doLogout = doLogout;
appCore.doMestreLogin = doMestreLogin;
appCore.doRegister = doRegister;
appCore.flashSave = flashSave;
appCore.getFormChar = getFormChar;
appCore.isMestreCredential = isMestreCredential;
appCore.loadDB = loadDB;
appCore.loginAs = loginAs;
appCore.openFirebaseSettings = openFirebaseSettings;
appCore.openMestreModal = openMestreModal;
appCore.populateAll = populateAll;
appCore.quickMestreLogin = quickMestreLogin;
appCore.renderAttrs = renderAttrs;
appCore.renderClasseDesc = renderClasseDesc;
appCore.renderConds = renderConds;
appCore.renderHabs = renderHabs;
appCore.renderOrigemDesc = renderOrigemDesc;
appCore.renderPericias = renderPericias;
appCore.renderTrilhaInfo = renderTrilhaInfo;
appCore.saveChar = saveChar;
appCore.saveDB = saveDB;
appCore.saveFirebaseConfig = saveFirebaseConfig;
appCore.showLogin = showLogin;
appCore.showRegister = showRegister;
appCore.showTab = showTab;
appCore.skipFirebaseSetup = skipFirebaseSetup;
appCore.startRemoteSync = startRemoteSync;
appCore.sv = sv;
appCore.testFirebaseNow = testFirebaseNow;
appCore.userChar = userChar;
appCore._buildPericiaEl = _buildPericiaEl;
appCore._ensureDB = _ensureDB;
appCore._fbWatching = _fbWatching;
appCore._isSaving = _isSaving;
appCore._syncFromFirebase = _syncFromFirebase;
appCore.addHab = addHab;
appCore.addPericia = addPericia;
appCore.adjAttr = adjAttr;
appCore.adjMax = adjMax;
appCore.adjStat = adjStat;
appCore.ATTRS = ATTRS;
appCore.autoSave = autoSave;
appCore.checkFirebaseSetup = checkFirebaseSetup;
appCore.CLASSES_DESC = CLASSES_DESC;
appCore.closeMestreModal = closeMestreModal;
appCore.CONDS = CONDS;
appCore.currentUser = currentUser;
appCore.db = db;
appCore.DB_KEY = DB_KEY;
appCore.defaultChar = defaultChar;
appCore.delHab = delHab;
appCore.delPericia = delPericia;
appCore.doLogin = doLogin;
appCore.doLogout = doLogout;
appCore.doMestreLogin = doMestreLogin;
appCore.doRegister = doRegister;
appCore.flashSave = flashSave;
appCore.getFormChar = getFormChar;
appCore.GRAUS = GRAUS;
appCore.isMestre = isMestre;
appCore.isMestreCredential = isMestreCredential;
appCore.loadDB = loadDB;
appCore.loginAs = loginAs;
appCore.MESTRE_CREDENTIALS = MESTRE_CREDENTIALS;
appCore.openFirebaseSettings = openFirebaseSettings;
appCore.openMestreModal = openMestreModal;
appCore.ORIGENS_DB = ORIGENS_DB;
appCore.PERICIAS = PERICIAS;
appCore.populateAll = populateAll;
appCore.quickMestreLogin = quickMestreLogin;
appCore.renderAttrs = renderAttrs;
appCore.renderClasseDesc = renderClasseDesc;
appCore.renderConds = renderConds;
appCore.renderHabs = renderHabs;
appCore.renderOrigemDesc = renderOrigemDesc;
appCore.renderPericias = renderPericias;
appCore.renderTrilhaInfo = renderTrilhaInfo;
appCore.saveChar = saveChar;
appCore.saveDB = saveDB;
appCore.saveFirebaseConfig = saveFirebaseConfig;
appCore.saveTimer = saveTimer;
appCore.showLogin = showLogin;
appCore.showRegister = showRegister;
appCore.showTab = showTab;
appCore.skipFirebaseSetup = skipFirebaseSetup;
appCore.startRemoteSync = startRemoteSync;
appCore.sv = sv;
appCore.userChar = userChar;
appCore.v = v;
Object.assign(window, appCore);
