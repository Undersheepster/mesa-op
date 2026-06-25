// Constantes de ícones — usadas no painel do Mestre
const ICONS={skull:'☠',eye:'◈',flame:'🔥',bolt:'⚡',moon:'🌙',star:'★',shield:'⛊',ghost:'👻',blood:'◆',rune:'⛧'};


// ══════════════════════════════════════════════
//  SUPABASE — REST API + Realtime
// ══════════════════════════════════════════════

function _sbCfg(){
  try { return JSON.parse(localStorage.getItem('op_supabase_config') || 'null'); } catch(e){ return null; }
}
function _sbBase(){
  const c = _sbCfg();
  return c && c.url ? c.url.replace(/\/$/, '') : null;
}
function _sbKey(){
  const c = _sbCfg();
  return c ? c.anonKey : null;
}
function _sbHeaders(){
  return {
    'Content-Type': 'application/json',
    'apikey': _sbKey() || '',
    'Authorization': 'Bearer ' + (_sbKey() || ''),
    'Prefer': 'return=representation'
  };
}

// Supabase usa uma tabela: mesa_state(path text PK, data jsonb, updated_at timestamptz)
// PUT equivale a upsert
async function _sbPut(path, data){
  const base = _sbBase(); if(!base) return null;
  try{
    const r = await fetch(base + '/rest/v1/mesa_state', {
      method: 'POST',
      headers: { ..._sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ path, data, updated_at: new Date().toISOString() })
    });
    return r.ok ? r.json() : null;
  }catch(e){ return null; }
}

async function _sbDelete(path){
  const base = _sbBase(); if(!base) return;
  // Deletes all rows where path = exact or path starts with path/
  try{
    await fetch(base + '/rest/v1/mesa_state?or=(path.eq.' + encodeURIComponent(path) + ',path.like.' + encodeURIComponent(path + '/%') + ')', {
      method: 'DELETE',
      headers: _sbHeaders()
    });
  }catch(e){}
}

async function _sbGet(path){
  const base = _sbBase(); if(!base) return null;
  try {
    // Get exact path first
    const r = await fetch(base + '/rest/v1/mesa_state?path=eq.' + encodeURIComponent(path), {
      headers: { ..._sbHeaders(), 'Prefer': '' }
    });
    if(!r.ok) return null;
    const rows = await r.json();
    if(rows && rows.length > 0) return rows[0].data;

    // If no exact match, try to get children (path like "path/%")
    const r2 = await fetch(base + '/rest/v1/mesa_state?path=like.' + encodeURIComponent(path + '/%'), {
      headers: { ..._sbHeaders(), 'Prefer': '' }
    });
    if(!r2.ok) return null;
    const children = await r2.json();
    if(!children || !children.length) return null;
    // Reconstruct nested object from flat paths
    const obj = {};
    children.forEach(row => {
      const rel = row.path.slice(path.length + 1); // remove "path/"
      const parts = rel.split('/');
      let cur = obj;
      for(let i = 0; i < parts.length - 1; i++){
        if(!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length-1]] = row.data;
    });
    return Object.keys(obj).length ? obj : null;
  } catch(e){ return null; }
}

// ── Realtime via Supabase Broadcast/Presence (substitui SSE do Firebase) ──
// Usamos polling inteligente como fallback universal + Supabase Realtime quando disponível
const _sbRealtimeChannels = {};
const _sbPollingTimers = {};
const _sbLastData = {};

function _sbWatch(path, cb){
  const base = _sbBase(); if(!base) return () => {};
  const key = path;

  // Para qualquer escuta anterior no mesmo path
  if(_sbRealtimeChannels[key]){
    try{ _sbRealtimeChannels[key].unsubscribe(); }catch(e){}
    delete _sbRealtimeChannels[key];
  }
  if(_sbPollingTimers[key]){
    clearInterval(_sbPollingTimers[key]);
    delete _sbPollingTimers[key];
  }

  // Fetch inicial imediato
  const fetchAndNotify = async () => {
    const data = await _sbGet(path);
    const sig = JSON.stringify(data);
    if(sig !== _sbLastData[key]){
      _sbLastData[key] = sig;
      cb(data);
    }
  };
  fetchAndNotify();

  // Tenta usar Supabase Realtime se o cliente JS estiver disponível
  if(window._supabaseClient){
    try{
      const chan = window._supabaseClient
        .channel('mesa_state_' + path.replace(/\//g,'_'))
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'mesa_state',
          filter: 'path=like.' + path + '*'
        }, () => { fetchAndNotify(); })
        .subscribe();
      _sbRealtimeChannels[key] = chan;
    }catch(e){
      // Realtime não disponível — usa polling
    }
  }

  // Polling de fallback (4s) — sempre ativo para garantir sync
  _sbPollingTimers[key] = setInterval(fetchAndNotify, 4000);

  // Retorna função para fechar
  return () => {
    if(_sbRealtimeChannels[key]){ try{_sbRealtimeChannels[key].unsubscribe();}catch(e){} delete _sbRealtimeChannels[key]; }
    if(_sbPollingTimers[key]){ clearInterval(_sbPollingTimers[key]); delete _sbPollingTimers[key]; }
  };
}

// POLL explícito (compatibilidade)
const _polls = {};
function _sbPoll(path, cb, ms){
  if(_polls[path]) clearInterval(_polls[path]);
  const run = async () => { cb(await _sbGet(path)); };
  run();
  _polls[path] = setInterval(run, ms || 4000);
}

// ── PRESENÇA ──
window.fbSetPresence = async function(user, isMestre){
  const base = _sbBase(); if(!base) return;
  const since = Date.now();
  await _sbPut('presence/' + user, { user, isMestre: !!isMestre, since, online: true });

  // Ao sair: grava lastSeen (async) e remove presença (beacon)
  const _handleExit = () => {
    const b = _sbBase(); const k = _sbKey();
    if(!b || !k) return;
    const sessionDuration = Date.now() - since;
    const lastSeenData = { user, isMestre: !!isMestre, lastSeen: Date.now(), sessionDuration };
    // Grava lastSeen via fetch (keepalive para funcionar em beforeunload)
    fetch(b + '/rest/v1/mesa_state', {
      method: 'POST',
      keepalive: true,
      headers: { ..._sbHeaders(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ path: 'last_seen/' + user, data: lastSeenData, updated_at: new Date().toISOString() })
    }).catch(()=>{});
    // Remove presença via beacon
    navigator.sendBeacon(b + '/rest/v1/mesa_state?or=(path.eq.' + encodeURIComponent('presence/' + user) + ')',
      new Blob([JSON.stringify([])], {type:'application/json'}));
  };
  window.addEventListener('beforeunload', _handleExit);
};

window.fbRemovePresence = async function(user, since){
  // Grava lastSeen antes de remover
  const sessionDuration = since ? (Date.now() - since) : 0;
  await _sbPut('last_seen/' + user, { user, isMestre: !!isMestre, lastSeen: Date.now(), sessionDuration });
  await _sbDelete('presence/' + user);
};

window.fbWatchPresence = function(cb){
  _sbWatch('presence', d => cb(d || {}));
};

window.fbWatchLastSeen = function(cb){
  _sbWatch('last_seen', d => cb(d || {}));
};

window.fbWatchConnection = function(cb){
  const check = async () => {
    const base = _sbBase(); const key = _sbKey();
    if(!base || !key){ cb({ok:false, code:0, reason:'not_configured'}); return; }
    try {
      const r = await fetch(base + '/rest/v1/mesa_state?path=eq.presence&limit=1', {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key },
        cache: 'no-store'
      });
      if(r.ok){ cb({ok:true, code:r.status, reason:'ok'}); return; }
      let reason = 'http_' + r.status;
      if(r.status === 401 || r.status === 403) reason = 'permission_denied';
      else if(r.status === 404) reason = 'not_found';
      let detail = '';
      try{ detail = (await r.text()).slice(0,160); }catch(e){}
      cb({ok:false, code:r.status, reason, detail});
    } catch(e){
      cb({ok:false, code:0, reason:'network_error', detail:e.message});
    }
  };
  check(); setInterval(check, 10000);
};

// Texto e cor amigáveis para cada motivo de falha
function _fbReasonInfo(status){
  if(!status) return {text:'Verificando Supabase...', color:'var(--white-dust)', tip:''};
  if(status.ok) return {text:'Conectado — modo online ativo', color:'#44cc88', tip:''};
  switch(status.reason){
    case 'not_configured':
      return {text:'Supabase não configurado', color:'#cc6644', tip:'Clique em "⚙ Supabase" para configurar.'};
    case 'permission_denied':
      return {text:'Bloqueado pelas políticas do Supabase (permissão negada)', color:'#cc4444',
        tip:'No Supabase Dashboard → Table Editor → mesa_state → RLS, desative Row Level Security ou adicione políticas de acesso.'};
    case 'not_found':
      return {text:'Tabela não encontrada (URL ou tabela incorreta?)', color:'#cc4444',
        tip:'Confira se a tabela mesa_state existe no seu projeto Supabase.'};
    case 'network_error':
      return {text:'Sem conexão com o servidor Supabase', color:'#cc6644',
        tip:'Verifique sua internet ou a URL do projeto. Detalhe: '+(status.detail||'')};
    default:
      return {text:'Erro ao conectar (HTTP '+status.code+')', color:'#cc6644', tip:status.detail||''};
  }
}

// ── BROADCAST ──
window.fbBroadcast = async function(msg, from){ await _sbPut('broadcast', {msg, from, ts:Date.now()}); };
window.fbWatchBroadcast = function(cb){
  let last = 0;
  _sbWatch('broadcast', d => { if(d && d.ts && d.ts > last){ last = d.ts; cb(d); } });
};

// ── KICK ──
window.fbKick = async function(user){
  await Promise.all([
    _sbPut('kicks/' + user, {ts:Date.now()}),
    _sbDelete('presence/' + user)
  ]);
};
window.fbWatchKick = function(user, cb){
  let fired = false;
  _sbWatch('kicks/' + user, d => {
    if(d && d.ts && !fired){ fired = true; cb(); }
  });
};

// ── GAMEDATA ──
let _saveDbTimer = null;
window.fbSaveDB = function(dbObj){
  clearTimeout(_saveDbTimer);
  _saveDbTimer = setTimeout(() => {
    _sbPut('gamedata', {
      users: dbObj.users || {},
      characters: dbObj.characters || {},
      rolls: dbObj.rolls || {},
      mestre: dbObj.mestre || {},
      mapbg: (dbObj.maps && dbObj.maps['shared']) || null,
      mapbgTs: Date.now()
    });
  }, 1500);
};
window.fbWatchDB = function(cb){
  let last = '';
  _sbWatch('gamedata', d => {
    if(!d) return;
    const s = JSON.stringify(d);
    if(s !== last){ last = s; cb(d); }
  });
};
window.fbLoadDB = async function(){ return await _sbGet('gamedata'); };

// ── MAPA ──
let _msTimer = null, _msPending = null, _msLastSent = 0;
let _msDragRaf = null;
window.fbSaveMap = function(mapKey, mapData){
  if(mapKey === 'bg'){
    _sbPut('mapbg', {data:mapData.data||'', ts:mapData.ts||Date.now(), sid:mapData.sid||''});
    return;
  }
  const payload = { tokens:mapData.tokens||'[]', structs:mapData.structs||'[]', ts:mapData.ts||Date.now(), sid:mapData.sid||'' };
  const flush = window.fbSaveMap._flush;
  window.fbSaveMap._flush = false;
  clearTimeout(_msTimer);
  if(draggingToken || draggingStruct){
    const now = Date.now();
    if(now - _msLastSent < 50){
      _msPending = payload;
      if(!_msDragRaf){
        _msDragRaf = requestAnimationFrame(() => {
          _msDragRaf = null;
          if(!_msPending) return;
          _msLastSent = Date.now();
          _sbPut('mapstate', _msPending);
          _msPending = null;
        });
      }
    } else {
      _msLastSent = now;
      _sbPut('mapstate', payload);
    }
    return;
  }
  if(flush){
    _msLastSent = Date.now();
    _sbPut('mapstate', payload);
    return;
  }
  _msPending = payload;
  const wait = Math.max(0, 80-(Date.now()-_msLastSent));
  _msTimer = setTimeout(() => {
    _msLastSent = Date.now();
    _sbPut('mapstate', _msPending);
    _msPending = null;
  }, wait);
};

window.fbWatchMap = function(cb){
  let lastTs = 0;
  const wrapped = data => {
    if(!data) return;
    if(!data.ts){ cb(data); return; }
    if(data.ts < lastTs - 5000) lastTs = 0;
    if(data.ts <= lastTs) return;
    lastTs = data.ts; cb(data);
  };
  window._fbWatchMapCb = wrapped;
  _sbWatch('mapstate', wrapped);
};
window.fbWatchBg = function(cb){
  let lastTs = 0;
  const wrapped = data => {
    if(!data || !data.ts) return;
    if(data.ts < lastTs - 5000) lastTs = 0;
    if(data.ts <= lastTs) return;
    lastTs = data.ts; cb(data);
  };
  _sbWatch('mapbg', wrapped);
};

window.fbTestConfig = async function(cfg){
  try {
    const r = await fetch(cfg.url.replace(/\/$/,'') + '/rest/v1/mesa_state?limit=1', {
      headers: { 'apikey': cfg.anonKey, 'Authorization': 'Bearer ' + cfg.anonKey }
    });
    return r.ok ? {ok:true} : {ok:false, err:'HTTP '+r.status};
  } catch(e){ return {ok:false, err:e.message}; }
};

// ── CHAT ──
window.fbChatSend = async function(msg){ await _sbPut('chat/' + Date.now() + '_' + Math.random().toString(36).slice(2,5), msg); };
window.fbWatchChat = function(cb){
  _sbWatch('chat', data => {
    if(!data){ cb([]); return; }
    const msgs = Object.entries(data).map(([k,v]) => ({...v, _key:k}))
      .sort((a,b) => (a.ts||0)-(b.ts||0));
    cb(msgs);
  });
};
window.fbChatClear = async function(){ await _sbDelete('chat'); };

// ── ROLAGENS PÚBLICAS ──
window.fbRollPublish = async function(roll){ await _sbPut('rolls_pub/' + Date.now() + '_' + Math.random().toString(36).slice(2,5), roll); };
window.fbWatchRolls = function(cb){
  _sbWatch('rolls_pub', data => {
    if(!data){ cb([]); return; }
    const rolls = Object.entries(data).map(([k,v]) => ({...v, _key:k}))
      .sort((a,b) => (a.ts||0)-(b.ts||0)).slice(-80);
    cb(rolls);
  });
};
window.fbRollsClear = async function(){ await _sbDelete('rolls_pub'); };

// ── PEDIDO DE ROLAGEM ──
window.fbRequestRoll = async function(req){ await _sbPut('roll_requests/' + req.target, req); };
window.fbWatchRollRequest = function(user, cb){
  let lastTs = 0;
  _sbWatch('roll_requests/' + user, data => {
    if(data && data.ts && data.ts > lastTs){ lastTs = data.ts; cb(data); }
  });
};
window.fbClearRollRequest = async function(user){ await _sbDelete('roll_requests/' + user); };

// ── INICIATIVA ──
window.fbSaveInitiative = async function(data){ await _sbPut('initiative', data); };
window.fbWatchInitiative = function(cb){
  _sbWatch('initiative', data => { cb(data || {combatants:[],round:1,currentIdx:0,active:false}); });
};

// ── PINGS ──
window.fbPingMestre = async function(user, msg){
  await _sbPut('pings/' + user, {user, msg:msg||'Preciso de atenção!', ts:Date.now()});
};
window.fbWatchPings = function(cb){ _sbWatch('pings', d => cb(d || {})); };
window.fbClearPing = async function(user){ await _sbDelete('pings/' + user); };

// ── WHISPER ──
window.fbWhisper = async function(from, msg){
  await _sbPut('whispers/' + Date.now() + '_' + Math.random().toString(36).slice(2,5), {from, msg, ts:Date.now(), read:false});
};
window.fbWatchWhispers = function(cb){
  _sbWatch('whispers', d => {
    if(!d){ cb([]); return; }
    const msgs = Object.entries(d).map(([k,v]) => ({...v, _key:k})).sort((a,b) => (a.ts||0)-(b.ts||0));
    cb(msgs);
  });
};
window.fbClearWhispers = async function(){ await _sbDelete('whispers'); };

// ── PISTAS ──
window.fbRevealClue = async function(clue){
  await _sbPut('clues/' + Date.now() + '_' + Math.random().toString(36).slice(2,5), {...clue, ts:Date.now(), revealed:true});
};
window.fbWatchClues = function(cb){
  _sbWatch('clues', d => {
    if(!d){ cb([]); return; }
    const clues = Object.entries(d).map(([k,v]) => ({...v, _key:k})).sort((a,b) => (a.ts||0)-(b.ts||0));
    cb(clues);
  });
};
window.fbClearClues = async function(){ await _sbDelete('clues'); };

// ── STATUS DE SAÚDE ──
window.fbPublishStatus = async function(user, status){
  await _sbPut('status/' + user, {...status, user, ts:Date.now()});
};
window.fbWatchStatus = function(cb){ _sbWatch('status', d => cb(d || {})); };

// ── VOTAÇÃO ──
window.fbStartVote = async function(question, options){
  await _sbPut('vote', {question, options:options||['Sim','Não'], votes:{}, ts:Date.now(), active:true});
};
window.fbCastVote = async function(user, option){
  await _sbPut('vote/votes/' + user, {option, ts:Date.now()});
};
window.fbWatchVote = function(cb){ _sbWatch('vote', d => cb(d || null)); };
window.fbEndVote = async function(){ await _sbDelete('vote'); };

// ── BAÚ ──
window.fbAddBauItem = async function(item){
  await _sbPut('bau/' + Date.now() + '_' + Math.random().toString(36).slice(2,5), {...item, ts:Date.now()});
};
window.fbRemoveBauItem = async function(key){ await _sbDelete('bau/' + key); };
window.fbWatchBau = function(cb){
  _sbWatch('bau', d => {
    if(!d){ cb([]); return; }
    const items = Object.entries(d).map(([k,v]) => ({...v, _key:k})).sort((a,b) => (a.ts||0)-(b.ts||0));
    cb(items);
  });
};
window.fbClearBau = async function(){ await _sbDelete('bau'); };

// ── DIÁRIO ──
window.fbAddDiarioEntry = async function(entry){
  await _sbPut('diario/' + Date.now() + '_' + Math.random().toString(36).slice(2,5), {...entry, ts:Date.now()});
};
window.fbDeleteDiarioEntry = async function(key){ await _sbDelete('diario/' + key); };
window.fbWatchDiario = function(cb){
  _sbWatch('diario', d => {
    if(!d){ cb([]); return; }
    const entries = Object.entries(d).map(([k,v]) => ({...v, _key:k})).sort((a,b) => (a.ts||0)-(b.ts||0));
    cb(entries);
  });
};
window.fbClearDiario = async function(){ await _sbDelete('diario'); };

// ── AMEAÇA ──
window.fbSetAmeaca = async function(val){ await _sbPut('ameaca', {val, ts:Date.now()}); };
window.fbWatchAmeaca = function(cb){ _sbWatch('ameaca', d => cb(d ? (d.val||0) : 0)); };

// ── NOTAS DO MESTRE ──
window.fbSetNotasMestre = async function(texto){ await _sbPut('notas_mestre', {texto, ts:Date.now()}); };
window.fbWatchNotasMestre = function(cb){ _sbWatch('notas_mestre', d => cb(d ? (d.texto||'') : '')); };

// ── REAÇÕES ──
window.fbAddReacao = async function(msgKey, emoji, user){
  await _sbPut('chat_reacoes/' + msgKey + '/' + user, {emoji, user, ts:Date.now()});
};
window.fbRemoveReacao = async function(msgKey, user){ await _sbDelete('chat_reacoes/' + msgKey + '/' + user); };
window.fbWatchReacoes = function(cb){ _sbWatch('chat_reacoes', d => cb(d || {})); };

// ── CENA ATIVA ──
window.fbSetCena = async function(cena){ await _sbPut('cena_ativa', {cena, ts:Date.now()}); };
window.fbWatchCena = function(cb){ _sbWatch('cena_ativa', d => cb(d ? (d.cena||null) : null)); };

// ── TIMER ──
window.fbSetTimer = async function(data){ await _sbPut('timer', data); };
window.fbClearTimer = async function(){ await _sbDelete('timer'); };
window.fbWatchTimer = function(cb){ _sbWatch('timer', d => cb(d || null)); };

// ── FOCO ──
window.fbSetFoco = async function(user){ await _sbPut('foco', {user, ts:Date.now()}); };
window.fbClearFoco = async function(){ await _sbDelete('foco'); };
window.fbWatchFoco = function(cb){ _sbWatch('foco', d => cb(d ? (d.user||null) : null)); };

// ── ROLAGEM SECRETA ──
window.fbSecretRoll = async function(roll){ await _sbPut('secret_rolls/' + Date.now() + '_' + Math.random().toString(36).slice(2,5), roll); };
window.fbClearSecretRolls = async function(){ await _sbDelete('secret_rolls'); };
window.fbWatchSecretRolls = function(cb){
  _sbWatch('secret_rolls', d => {
    const arr = d ? Object.entries(d).map(([k,v]) => ({...v,_key:k})).sort((a,b) => (a.ts||0)-(b.ts||0)) : [];
    cb(arr);
  });
};

// ── CLIMA ──
window.fbSetClima = async function(clima){ await _sbPut('clima', {clima, ts:Date.now()}); };
window.fbWatchClima = function(cb){ _sbWatch('clima', d => cb(d ? (d.clima||null) : null)); };

// ── TRILHA SONORA ──
window.fbSetMusica = async function(data){ await _sbPut('musica', {...data, ts:Date.now()}); };
window.fbClearMusica = async function(){ await _sbDelete('musica'); };
window.fbWatchMusica = function(cb){ _sbWatch('musica', d => cb(d || null)); };

// ── AMBIENTAÇÃO ──
window.fbSetAmbientacao = async function(data){ await _sbPut('ambientacao', {...data, ts:Date.now()}); };
window.fbClearAmbientacao = async function(){ await _sbDelete('ambientacao'); };
window.fbWatchAmbientacao = function(cb){ _sbWatch('ambientacao', d => cb(d || null)); };

// ── STATUS DE TOKEN ──
window.fbSetTokenStatus = async function(tokenId, status){ await _sbPut('token_status/' + tokenId, {status, ts:Date.now()}); };
window.fbClearTokenStatus = async function(tokenId){ await _sbDelete('token_status/' + tokenId); };
window.fbWatchTokenStatus = function(cb){ _sbWatch('token_status', d => cb(d || {})); };

window._fbReady = true;
window.dispatchEvent(new CustomEvent('fb-module-ready'));

// ── PSIQUÊ — Mapa Mental de Relacionamentos ──
window.fbSavePsique = async function(user, data){
  await _sbPut('psique/' + user, { user, data, ts: Date.now() });
};
window.fbLoadPsique = async function(user){
  const d = await _sbGet('psique/' + user);
  return d ? d.data : null;
};
window.fbLoadAllPsique = async function(){
  try{
    const base = _sbBase(); if(!base) return {};
    const r = await fetch(base + '/rest/v1/mesa_state?path=like.psique%2F%25', {
      headers: { ..._sbHeaders(), 'Prefer': '' }
    });
    if(!r.ok) return {};
    const rows = await r.json();
    const result = {};
    rows.forEach(row => {
      const user = row.path.replace('psique/', '');
      result[user] = row.data?.data || null;
    });
    return result;
  }catch(e){ return {}; }
};

// ══════════════════════════════════════════════

/* ══════════════════════════════════════════════
   DATA LAYER — Firebase (online) + localStorage (fallback)
══════════════════════════════════════════════ */
const DB_KEY = 'op_mesa_v5';
let db = {};
let currentUser = null;

// ── Fonte única para opções de selects repetidos ──
const OPT_PISTA_TIPO = [
  {v:'pista', t:'Pista'}, {v:'npc', t:'NPC'},
  {v:'local', t:'Local'}, {v:'ocult', t:'Ocultismo'}
];
const OPT_NPC_TIPO = [
  {v:'npc', t:'NPC Humano'}, {v:'criatura', t:'Criatura'},
  {v:'chefe', t:'Chefe / Boss'}, {v:'aliado', t:'Aliado'}, {v:'neutro', t:'Neutro'}
];
function _populateSelect(id, opts, defaultVal){
  const el = document.getElementById(id);
  if(!el || el.dataset.populated) return;
  el.innerHTML = opts.map(o=>`<option value="${o.v}">${o.t}</option>`).join('');
  if(defaultVal !== undefined) el.value = defaultVal;
  el.dataset.populated = '1';
}
function _populateStaticSelects(){
  _populateSelect('pista-tipo', OPT_PISTA_TIPO);
  _populateSelect('clue-reveal-tipo', OPT_PISTA_TIPO);
  _populateSelect('npc-tipo', OPT_NPC_TIPO);
  _populateSelect('nf-tipo', OPT_NPC_TIPO);
}
document.addEventListener('DOMContentLoaded', _populateStaticSelects);
let isMestre = false;
let _fbWatching = false; // evita loop de sync

/* ── Supabase Setup Screen ── */
function checkFirebaseSetup(){
  const cfg = localStorage.getItem('op_supabase_config');
  let hasCfg = false;
  try { const c = JSON.parse(cfg); hasCfg = c && c.url && c.anonKey; } catch(e){}
  if(!hasCfg){
    // Mostra tela de configuração
    document.getElementById('screen-firebase').style.display = 'flex';
    document.getElementById('screen-login').classList.remove('active');
  }
}

function saveFirebaseConfig(){
  const url = document.getElementById('cfg-apiKey').value.trim();
  const anonKey = document.getElementById('cfg-dbUrl').value.trim();
  const errEl = document.getElementById('cfg-err');
  if(!url || !anonKey){
    errEl.textContent = 'Preencha a URL do projeto e a Anon Key.'; return;
  }
  errEl.textContent = 'Testando conexão...';
  const cfg = { url, anonKey };
  localStorage.setItem('op_supabase_config', JSON.stringify(cfg));
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

  const getCfgVal = key => {
    try{ return JSON.parse(localStorage.getItem('op_supabase_config')||'{}')[key] || ''; }catch(e){ return ''; }
  };
  const cfg = {
    url:     document.getElementById('cfg-apiKey').value.trim() || getCfgVal('url'),
    anonKey: document.getElementById('cfg-dbUrl').value.trim()  || getCfgVal('anonKey'),
  };

  const log = msg => { diagEl.textContent += msg + '\n'; };

  if(!cfg.url)     { log('❌ URL do projeto vazia'); return; }
  if(!cfg.anonKey) { log('❌ Anon Key vazia'); return; }

  log('✓ Campos preenchidos');
  log('📡 URL: ' + cfg.url);
  log('📡 Anon Key: ' + cfg.anonKey.substring(0,16) + '...');

  try {
    log('🔌 Testando acesso à tabela mesa_state...');
    const resp = await fetch(cfg.url.replace(/\/$/,'') + '/rest/v1/mesa_state?limit=1', {
      headers: { 'apikey': cfg.anonKey, 'Authorization': 'Bearer ' + cfg.anonKey }
    });
    if(resp.ok){
      log('✅ Conexão OK! Tabela acessível.');

      // Verifica o bucket de áudio
      log('');
      log('🎵 Verificando bucket de áudio...');
      try{
        const bResp = await fetch(cfg.url.replace(/\/$/,'') + '/storage/v1/bucket/' + _SB_AUDIO_BUCKET, {
          headers: { 'apikey': cfg.anonKey, 'Authorization': 'Bearer ' + cfg.anonKey }
        });
        if(bResp.ok){
          log('✅ Bucket "audio" encontrado! Upload de músicas disponível.');
        } else if(bResp.status === 404){
          log('⚠️  Bucket "audio" não encontrado.');
          log('   Vá em Supabase Dashboard → Storage → New bucket');
          log('   Nome: audio');
          log('   Marque "Public bucket" para acesso sem autenticação.');
        } else {
          log('⚠️  Bucket "audio": erro ' + bResp.status + '. Verifique as políticas de Storage.');
        }
      }catch(be){ log('⚠️  Não foi possível verificar o bucket: ' + be.message); }

      log('');
      log('👥 Pronto para jogar online!');
      diagEl.style.color = '#22cc88';
    } else {
      const txt = await resp.text();
      log('❌ Erro HTTP ' + resp.status + ': ' + txt);
      if(resp.status === 401 || resp.status === 403){
        log('');
        log('⚠️  ACESSO BLOQUEADO!');
        log('   Vá em Supabase Dashboard → Table Editor → mesa_state');
        log('   → Authentication → desative Row Level Security');
        log('   ou adicione políticas de acesso público.');
      } else if(resp.status === 404){
        log('');
        log('⚠️  Tabela mesa_state não encontrada!');
        log('   Crie a tabela no Supabase SQL Editor:');
        log('   CREATE TABLE mesa_state (');
        log('     path text PRIMARY KEY,');
        log('     data jsonb,');
        log('     updated_at timestamptz DEFAULT now()');
        log('   );');
      }
      diagEl.style.color = '#cc6644';
    }
  } catch(e) {
    log('❌ Falha na conexão: ' + e.message);
    log('');
    log('Possíveis causas:');
    log('• URL do projeto incorreta');
    log('• Projeto Supabase não existe mais');
    log('• Bloqueio de rede/firewall');
    diagEl.style.color = '#cc6644';
  }
}

function openFirebaseSettings(){
  const cfg = localStorage.getItem('op_supabase_config');
  try {
    const c = JSON.parse(cfg||'{}');
    document.getElementById('cfg-apiKey').value = c.url||'';
    document.getElementById('cfg-dbUrl').value = c.anonKey||'';
    document.getElementById('cfg-projectId').value = '';
    document.getElementById('cfg-appId').value = '';
    document.getElementById('cfg-senderId').value = '';
  } catch(e){}
  document.getElementById('cfg-err').textContent='';
  document.getElementById('screen-firebase').style.display = 'flex';
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.remove('active');
}

/* ── Load: localStorage imediato, Supabase em background (nunca bloqueia) ── */
function loadDB(){
  try{const d=localStorage.getItem(DB_KEY);if(d)db=JSON.parse(d);}catch(e){db={};}
  _ensureDB();
  // Supabase sincroniza em background — não bloqueia a tela de login
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
      if(remote.mestre) db.mestre = Object.assign({notes:'',playerNotes:{},messages:[],fichasRecebidas:{}}, remote.mestre);
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      console.log('[DB] Sincronizado com Supabase');
    }).catch(e => console.warn('[DB] Supabase indisponível:', e));
  };
  if(window._fbReady){ doSync(); }
  else { window.addEventListener('fb-module-ready', doSync, { once: true }); }
}

function _ensureDB(){
  if(!db.users) db.users={};
  if(!db.characters) db.characters={};
  if(!db.maps) db.maps={};
  if(!db.mestre) db.mestre={notes:'',playerNotes:{},messages:[],fichasRecebidas:{}};
  if(!db.rolls) db.rolls={};
}

/* ── Inicia escuta em tempo real de mudanças remotas ── */
let _isSaving=false;
let _savingTimer=null;

function saveDB(){
  _ensureDB();
  _isSaving=true;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  if(window.fbSaveDB) window.fbSaveDB(db);
  // Limpa flag após tempo suficiente para o Firebase processar
  clearTimeout(_savingTimer);
  _savingTimer = setTimeout(()=>{ _isSaving=false; }, 1500);
}
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
          db.mestre = Object.assign({notes:'',playerNotes:{},messages:[],fichasRecebidas:{}}, remote.mestre);
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
        // Atualiza fichas recebidas no painel do mestre em tempo real
        if(isMestre && document.getElementById('tab-mestre').classList.contains('active')){
          renderFichasRecebidas();
        }
      });
    }, 2000);
  };
  if(window._fbReady){ doSync(); }
  else { window.addEventListener('fb-module-ready', doSync, { once: true }); }
}
 
function userChar(u){return db.characters[u]||(db.characters[u]=defaultChar());}
function saveChar(){
  if(!currentUser)return;
  db.characters[currentUser]=Object.assign(userChar(currentUser),getFormChar());
  saveDB();
  _publishMyStatus();
}

function descartarFicha(){
  if(!currentUser)return;
  const c=userChar(currentUser);
  const nomeAtual=c.nome||currentUser;

  // Modal de confirmação
  const existing=document.getElementById('_descarte_modal');
  if(existing)existing.remove();

  const modal=document.createElement('div');
  modal.id='_descarte_modal';
  modal.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  modal.innerHTML=`
    <div style="background:#0d0008;border:1px solid #8b0000;max-width:440px;width:100%;padding:28px 24px;box-sizing:border-box;font-family:'Cinzel',serif">
      <div style="font-size:15px;letter-spacing:.18em;color:#cc2222;text-transform:uppercase;margin-bottom:8px">⚠ Descartar Ficha</div>
      <div style="font-family:'IM Fell English',serif;font-style:italic;font-size:13px;color:var(--white-ash);line-height:1.7;margin-bottom:18px">
        Você está prestes a apagar toda a ficha de <b style="color:var(--gold-light)">${nomeAtual}</b> — atributos, inventário, rituais, habilidades e progresso.<br><br>
        Uma nova ficha em branco será criada no lugar.<br>
        <span style="color:#cc4444">Esta ação não pode ser desfeita.</span>
      </div>
      <div style="font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.1em;color:var(--white-dust);text-transform:uppercase;margin-bottom:8px">Digite o nome do agente para confirmar:</div>
      <input id="_descarte_confirm_inp" placeholder="${nomeAtual}" style="width:100%;box-sizing:border-box;background:rgba(20,0,10,0.8);border:1px solid rgba(139,0,0,0.5);color:var(--white-bone);padding:9px 12px;font-family:'Courier Prime',monospace;font-size:13px;outline:none;margin-bottom:16px" oninput="document.getElementById('_descarte_btn_ok').style.opacity=this.value.trim()===document.getElementById('_descarte_nome_ref').textContent?'1':'0.4'">
      <span id="_descarte_nome_ref" style="display:none">${nomeAtual}</span>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="document.getElementById('_descarte_modal').remove()" style="padding:8px 18px;background:transparent;border:1px solid rgba(100,100,100,0.4);color:var(--white-dust);font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer">Cancelar</button>
        <button id="_descarte_btn_ok" onclick="_confirmarDescarte()" style="padding:8px 18px;background:rgba(139,0,0,0.2);border:1px solid #8b0000;color:#ff5555;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;opacity:0.4;transition:opacity .2s">🗑 Confirmar Descarte</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(()=>document.getElementById('_descarte_confirm_inp')?.focus(),50);
}

function _confirmarDescarte(){
  const inp=document.getElementById('_descarte_confirm_inp');
  const ref=document.getElementById('_descarte_nome_ref');
  if(!inp||!ref)return;
  if(inp.value.trim()!==ref.textContent){toast('Nome incorreto. Descarte cancelado.','#cc4444');return;}

  // Apaga a ficha e cria uma nova em branco, preservando token e login
  const novaFicha=defaultChar();
  // Preserva token e dados de auth que não devem sumir
  const tokenAtual=(db.characters[currentUser]||{}).token;
  if(tokenAtual)novaFicha.token=tokenAtual;

  // Apaga transcendência, rituais, habilidades, inventário — tudo
  db.characters[currentUser]=novaFicha;
  // Apaga liberação de transcendência
  if(db.mestre&&db.mestre.transLiberada)db.mestre.transLiberada[currentUser]=false;
  saveDB();

  // Remove modal e repopula a ficha
  const modal=document.getElementById('_descarte_modal');
  if(modal)modal.remove();

  populateAll();
  if(typeof renderTranscendenciaPanel==='function')renderTranscendenciaPanel();
  if(typeof renderRituaisTab==='function')renderRituaisTab();
  if(typeof renderTrilhaHabs==='function')renderTrilhaHabs();
  toast('Ficha descartada. Esse é o seu novo começo.','#8b0000');
}
 
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
 
/* ════════════════════════════════════════════════════════
   DATA DEFINITIONS — constantes, dados de jogo e templates
════════════════════════════════════════════════════════ */

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
  const mandarWrap=document.getElementById('mandar-ficha-wrap');
  if(mandarWrap) mandarWrap.style.display=isMestre?'none':'block';
  populateAll();
  showTab('ficha',document.querySelector('.tab-btn'));
  // Mostra/oculta UI específica por role
  _applyRoleUI();
  // Registra o momento em que entrou online
  window._myPresenceSince = Date.now();
  // Mostra o próprio usuário imediatamente no painel (antes do Firebase responder)
  renderOnlineList({ [user]: { user, isMestre: !!roleFlag, since: window._myPresenceSince, online: true } }, {});
  // Mostra o indicador de online na topbar
  const ind = document.getElementById('online-indicator');
  if(ind) ind.style.display = '';
  fbConnect(user, isMestre);
  startRemoteSync();
  // Publica status inicial (HP/SAN)
  setTimeout(_publishMyStatus, 1500);
  // Carrega psiquê do player em background
  if(!isMestre) setTimeout(() => _psiqueLoad(), 2000);
  toast('Bem-vindo, '+user+(isMestre?' — Mestre da mesa.':'.'));
}
 
function doLogout(){
  if(currentUser && window.fbRemovePresence) window.fbRemovePresence(currentUser, window._myPresenceSince);
  window._myPresenceSince = null;
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

/* ── Classes ── */
const CLASSES_DESC={
  Combatente:'⚔ Perito em combate direto. PV alto, proficiência em armas táticas e proteções. Foca em ataques, manobras e resistência física. PV: 20+Vig (mais 4+Vig/NEX). PE: 2+Pre (mais 2+Pre/NEX). SAN: 12 (mais 3/NEX).',
  Especialista:'🔍 Profissional versátil com muitas perícias treinadas. Perito em áreas técnicas (tiro, medicina, tecnologia, infiltração, negociação). PV: 16+Vig (mais 3+Vig/NEX). PE: 3+Pre (mais 3+Pre/NEX). SAN: 16 (mais 4/NEX).',
  Ocultista:'🔮 Conjurador de rituais do Outro Lado. Conexão inata com o paranormal. Acesso a rituais de 1º ao 4º círculo. PV: 12+Vig (mais 2+Vig/NEX). PE: 4+Pre (mais 4+Pre/NEX). SAN: 20 (mais 5/NEX).'
};

function renderClasseDesc(){
  const cls=(document.getElementById('f-classe')||{}).value||'';
  const el=document.getElementById('classe-desc');
  if(!el)return;
  if(cls&&CLASSES_DESC[cls]){el.textContent=CLASSES_DESC[cls];el.style.display='block';}
  else{el.style.display='none';}
}

/* ── Origens ── */
const ORIGENS_DB={
  // Origens existentes no dropdown com dados do livro oficial
  'Acadêmico':{
    pericias:'Ciências e Investigação',
    poder:'Saber é Poder',
    desc:'Pesquisador, professor ou cientista. Seu conhecimento teórico aprofundado sobre o mundo natural (e sobrenatural) é seu maior trunfo dentro da Ordem.',
    poder_desc:'Uma vez por cena, pode gastar 2 PE para realizar um teste de Ciências no lugar de qualquer outra perícia intelectual.'
  },
  'Agente de Saúde':{
    pericias:'Ciências e Medicina',
    poder:'Técnicas Medicinais',
    desc:'Médico, enfermeiro, paramédico ou socorrista. Você salva vidas em situações extremas.',
    poder_desc:'Pode usar Medicina como ação de movimento. Uma vez por cena, ao curar, remove uma condição negativa além dos PV.'
  },
  'Artista':{
    pericias:'Artes e Enganação',
    poder:'Magnum Opus',
    desc:'Músico, ator, pintor, escritor. Usa criatividade e carisma para resolver problemas.',
    poder_desc:'1x/missão, determine que uma pessoa reconhece seu trabalho. +5 em testes de Presença contra ela.'
  },
  'Atleta':{
    pericias:'Acrobacia e Atletismo',
    poder:'110%',
    desc:'Esportista de elite, seu corpo é uma máquina perfeitamente treinada. Supera obstáculos físicos.',
    poder_desc:'Gaste 2 PE para +5 em testes de Força ou Agilidade (exceto Luta/Pontaria).'
  },
  'Criminoso':{
    pericias:'Crime e Furtividade',
    poder:'O Crime Compensa',
    desc:'Ladrão, hacker ou vigarista. Conhece os cantos escuros da sociedade.',
    poder_desc:'Ao final da missão, escolha um item para levar à próxima missão sem contar no limite.'
  },
  'Lutador':{
    pericias:'Luta e Reflexos',
    poder:'Mão Pesada',
    desc:'Praticante de artes marciais ou brigão de rua. Seus punhos são armas letais.',
    poder_desc:'+2 em rolagens de dano corpo a corpo.'
  },
  'Mercenário':{
    pericias:'Iniciativa e Intimidação',
    poder:'Posição de Combate',
    desc:'Soldado de aluguel, segurança privado ou ex-militar. Pragmático e eficiente.',
    poder_desc:'Na primeira rodada de combate, gaste 2 PE para uma ação de movimento extra.'
  },
  'Operário':{
    pericias:'Fortitude e Profissão',
    poder:'Ferramenta de Trabalho',
    desc:'Construtor, mecânico ou trabalhador manual. Corpo forjado pelo trabalho duro.',
    poder_desc:'Escolha uma arma simples ou tática usável como ferramenta. +1 ataque, dano e margem com ela.'
  },
  'Policial':{
    pericias:'Percepção e Pontaria',
    poder:'Patrulha',
    desc:'Policial civil, militar ou agente federal. Treinado para proteger e servir.',
    poder_desc:'+2 na Defesa.'
  },
  'Religioso':{
    pericias:'Religião e Vontade',
    poder:'Acalentar',
    desc:'Padre, pastor, monge ou adepto de qualquer fé. Sua crença é um escudo contra o Outro Lado.',
    poder_desc:'+5 em Religião para acalmar. Quando acalma, alvo recupera 1d6 + Presença de Sanidade.'
  },
  'Trambiqueiro':{
    pericias:'Crime e Enganação',
    poder:'Impostor',
    desc:'Vigarista, charlatão ou manipulador nato. Faz qualquer um acreditar em qualquer coisa.',
    poder_desc:'1x/cena, gaste 2 PE para substituir qualquer teste de perícia por Enganação.'
  },
  'Abençoado':{
    pericias:'Religião e Vontade',
    poder:'Crença Reforçada',
    desc:'Abençoado pela fé, banhado por este conceito. Protege-se do Paranormal com a própria mente.',
    poder_desc:'Bônus de Dedicar Sua Fé ou Ritos de Fé são +1 em você. 1x/cena, gaste 1d4 SAN para rolar novamente um teste.'
  },
  'Amnésico':{
    pericias:'Ocultismo e Percepção',
    poder:'Lampejos do Passado',
    desc:'Você não sabe quem era antes. Fragmentos de memória afloram nos piores momentos — ou nos melhores. Sua identidade é um mistério, inclusive para você mesmo.',
    poder_desc:'1x/cena, declare que tem uma informação ou habilidade de seu passado. O Mestre decide o que você lembra, mas nunca algo inútil.'
  },
  'Chef':{
    pericias:'Ciências e Intuição',
    poder:'Sustento e Conforto',
    desc:'Cozinheiro profissional, confeiteiro ou chefe de cozinha. Sua habilidade de improvisar com recursos limitados vai muito além da culinária.',
    poder_desc:'Ao preparar uma refeição durante um interlúdio, você e aliados que comerem recuperam +1d6 de Sanidade e removem a condição Fatigado.'
  },
  'Cultista Arrependido':{
    pericias:'Ocultismo e Religião',
    poder:'Conhecimento Proibido',
    desc:'Você fez parte de um culto ao Paranormal e sobreviveu para contar. Carrega cicatrizes — físicas e mentais — mas também um conhecimento que poucos possuem.',
    poder_desc:'1x/cena, gaste 2 PE para revelar uma fraqueza ou informação sobre uma criatura ou ritual que você reconheça como parte de sua formação ocultista.'
  },
  'Desgarrado':{
    pericias:'Atletismo e Sobrevivência',
    poder:'Andarilho',
    desc:'Sem lar fixo, sem raízes. Você aprendeu a se virar em qualquer ambiente, seja no asfalto ou no mato. Cada lugar é potencialmente um abrigo ou uma armadilha.',
    poder_desc:'Ignora penalidades de terreno difícil natural. 1x/missão, encontra um recurso útil (comida, abrigo, rota de fuga) onde outros não veriam nada.'
  },
  'Engenheiro':{
    pericias:'Ciências e Tecnologia',
    poder:'Improviso Técnico',
    desc:'Engenheiro civil, mecânico, elétrico ou de qualquer área. Sua mente analítica transforma problemas complexos em soluções práticas.',
    poder_desc:'Gaste 1 PE para improvisiar um dispositivo simples ou modificar um equipamento. Teste de Ciências (DT 15) — sucesso fornece +5 no próximo uso relacionado.'
  },
  'Executivo':{
    pericias:'Diplomacia e Intuição',
    poder:'Networking',
    desc:'CEO, diretor ou alto executivo corporativo. Sabe como as engrenagens do poder real giram e como aproveitá-las a seu favor.',
    poder_desc:'1x/missão, acione um contato corporativo para obter informações reservadas, recursos financeiros ou acesso a locais restritos.'
  },
  'Investigador':{
    pericias:'Investigação e Intuição',
    poder:'Evidência Crucial',
    desc:'Detetive particular, jornalista investigativo ou pesquisador do paranormal. Você encontra conexões onde todos os outros veem apenas caos.',
    poder_desc:'1x/cena, após examinar uma cena, faça um teste de Investigação. Com sucesso, o Mestre deve revelar uma pista importante que você não perceberia de outra forma.'
  },
  'Magnata':{
    pericias:'Diplomacia e Enganação',
    poder:'Poder do Dinheiro',
    desc:'Herdeiro, empresário bilionário ou traficante de influência. Seu dinheiro abre portas que estão fechadas para todos os outros.',
    poder_desc:'1x/missão, declare que comprou, subornnou ou providenciou algo de valor até Categoria II. O item ou serviço chega até você antes do fim da cena.'
  },
  'Militar':{
    pericias:'Pontaria e Tática',
    poder:'Disciplina Militar',
    desc:'Soldado, veterano de guerra ou oficial das forças armadas. Treinamento exaustivo te preparou para situações que fariam qualquer civil entrar em colapso.',
    poder_desc:'1x/cena, gaste 2 PE para ignorar uma condição negativa até o fim de seu próximo turno.'
  },
  'Servidor Público':{
    pericias:'Atualidades e Diplomacia',
    poder:'Burocracia a Meu Favor',
    desc:'Funcionário público, político ou agente governamental. Conhece os trâmites legais e burocráticos — e como contorná-los quando necessário.',
    poder_desc:'1x/missão, consiga documentos, autorizações ou acesso oficial a um local ou informação restrita sem testes, desde que haja tempo hábil.'
  },
  'Teórico da Conspiração':{
    pericias:'Ocultismo e Investigação',
    poder:'Sempre Soube',
    desc:'Você nunca acreditou na versão oficial dos fatos. Ironicamente, agora sabe que estava mais certo do que imaginava. Sua paranoia é um trunfo.',
    poder_desc:'1x/cena, declare que já pesquisou sobre a ameaça ou local atual. O Mestre fornece uma informação verdadeira que seu personagem teria obtido antes da missão.'
  },
  'TI':{
    pericias:'Tecnologia e Ciências',
    poder:'Hackear o Sistema',
    desc:'Desenvolvedor, analista de segurança ou hacker. No mundo conectado, quem controla a informação controla tudo.',
    poder_desc:'Gaste 2 PE para acessar sistemas digitais, câmeras, registros ou comunicações eletrônicas. Teste de Tecnologia — a DT varia com a segurança do alvo.'
  },
  'Trabalhador Rural':{
    pericias:'Fortitude e Sobrevivência',
    poder:'Filho da Terra',
    desc:'Agricultor, criador de gado, madeireiro. Seu corpo endurecido e seu conhecimento da natureza te preparam para o que a civilização esqueceu.',
    poder_desc:'+2 em testes de Fortitude. Em ambientes naturais, você e aliados próximos não precisam fazer testes para sobrevivência básica (alimentação, orientação, abrigo).'
  },
  'Universitário':{
    pericias:'Atualidades e qualquer perícia de Conhecimento',
    poder:'Pesquisa Aprofundada',
    desc:'Estudante de graduação ou pós-graduação. Sua imersão acadêmica te deu ferramentas para absorver conhecimento com rapidez impressionante.',
    poder_desc:'1x/missão, após dedicar um interlúdio estudando um tema, trate sua perícia relacionada como Expert para aquele assunto até o fim da missão.'
  },
  'Vítima':{
    pericias:'Percepção e Vontade',
    poder:'Nunca Mais',
    desc:'Você sobreviveu a algo horrível — e esse trauma te transformou. Onde outros veem o inimaginável como impossível, você já sabe que é real.',
    poder_desc:'Quando Abalado ou Apavorado, pode gastar 1 PE para ignorar a condição por 1 rodada. Além disso, +2 em testes de Vontade contra efeitos de Medo.'
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
  if(isMestre){sv('mestre-notes',db.mestre.notes||'');populateMestre();}
  // Recalcula stats automáticos após carregar personagem
  setTimeout(()=>{
    const c=userChar(currentUser);
    const btn=document.getElementById('btn-manual-stats');
    const badge=document.getElementById('calc-badge');
    if(c._manualStats){
      if(btn){btn.textContent='MANUAL';btn.style.borderColor='rgba(196,154,0,0.6)';btn.style.color='var(--gold-light)';}
      if(badge){badge.innerHTML='<span style="color:#c49a00">✎ Manual</span>';badge.style.display='block';}
    } else {
      recalcMaxStats(true);
    }
  },50);
}
 
let saveTimer=null;
function autoSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{
    saveChar();
    recalcMaxStats(true); // recalcula silenciosamente após salvar
    flashSave('save-ficha');
    flashSave('save-missao');
  },800);
}
 
function flashSave(id){const e=document.getElementById(id);if(e){e.textContent='⛧ Salvo.';setTimeout(()=>e.textContent='',2000);}}
 
/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
function showTab(t,btn){
  document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  if(btn)btn.classList.add('active');

  // Psiquê: pausa trilha/amb e inicia áudio da mente; saindo, restaura
  const leavingPsique = document.querySelector('#tab-psique.active') === null && _psiqueAudioActive;
  if(t === 'psique'){
    _psiqueAudioEnter();
  } else {
    _psiqueAudioLeave();
  }

  if(t==='mestre'&&isMestre){populateMestre();}
  if(t==='multi'){ _initMultiTab(); }
  if(t==='psique'){ renderPsiqueTab(); }
  if(t==='elementos') renderElementos();
  if(t==='itens') renderItens();
  if(t==='criaturas'){
    const activeSub = document.getElementById('subtab-reliquias') &&
      document.getElementById('subtab-reliquias').style.display !== 'none' ? 'reliquias' : 'criaturas';
    showSubTab(activeSub);
  }
}
 
/* ══════════════════════════════════════════════
   STATS
══════════════════════════════════════════════ */
function adjStat(stat,d){
  const c=userChar(currentUser);
  c[stat]=Math.max(0,Math.min(c[stat+'Max'],c[stat]+d));
  document.getElementById('s-'+stat).textContent=c[stat];
  saveDB();_publishMyStatus();
}
function adjMax(stat,d){
  const c=userChar(currentUser);
  c[stat+'Max']=Math.max(1,c[stat+'Max']+d);
  c[stat]=Math.min(c[stat],c[stat+'Max']);
  document.getElementById('s-'+stat).textContent=c[stat];
  document.getElementById('s-'+stat+'max').textContent=c[stat+'Max'];
  saveDB();_publishMyStatus();
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
function adjAttr(a,d){
  const c=userChar(currentUser);
  c.attrs[a]=Math.max(1,Math.min(5,(c.attrs[a]||1)+d));
  renderAttrs();
  recalcMaxStats();
  saveDB();
}

/* ══════════════════════════════════════════════
   CÁLCULO AUTOMÁTICO DE PV / SAN / PE
   Fórmulas do livro Ordem Paranormal v1.3:

   NEX degraus: 5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,99
   Cada degrau acima do 1º (NEX 5%) adiciona bônus progressivo.

   COMBATENTE  : PV = 20 + VIG + (4+VIG) * degrau
                 SAN= 12 + 3*degrau
                 PE = 2 + PRE + (2+PRE)*degrau
   ESPECIALISTA: PV = 16 + VIG + (3+VIG)*degrau
                 SAN= 16 + 4*degrau
                 PE = 3 + PRE + (3+PRE)*degrau
   OCULTISTA   : PV = 12 + VIG + (2+VIG)*degrau
                 SAN= 20 + 5*degrau
                 PE = 4 + PRE + (4+PRE)*degrau

   Origens adicionam bônus fixos de PV/SAN/PE.
   Trilhas de Ocultista (Conduíte, Flagelador, etc.) modificam PE base.
══════════════════════════════════════════════ */

const NEX_DEGRAUS=[5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,99];

function nexDegrau(nex){
  // Retorna índice do degrau atual (0-based, começa em NEX 5%)
  const n=parseInt(nex)||5;
  let idx=0;
  for(let i=0;i<NEX_DEGRAUS.length;i++){if(n>=NEX_DEGRAUS[i])idx=i;}
  return idx; // 0 = NEX 5%, 19 = NEX 99%
}

// Bônus de origem em PV/SAN/PE
const ORIGEM_BONUS={
  'Acadêmico':        {pv:0, san:4, pe:0},
  'Agente de Saúde':  {pv:4, san:0, pe:0},
  'Amnésico':         {pv:0, san:0, pe:2},
  'Artista':          {pv:0, san:2, pe:2},
  'Atleta':           {pv:4, san:0, pe:0},
  'Chef':             {pv:2, san:2, pe:0},
  'Criminoso':        {pv:0, san:0, pe:4},
  'Cultista Arrependido':{pv:0,san:0,pe:4},
  'Desgarrado':       {pv:2, san:2, pe:0},
  'Engenheiro':       {pv:0, san:0, pe:4},
  'Executivo':        {pv:0, san:4, pe:0},
  'Investigador':     {pv:0, san:4, pe:0},
  'Lutador':          {pv:4, san:0, pe:0},
  'Magnata':          {pv:0, san:4, pe:0},
  'Mercenário':       {pv:4, san:0, pe:0},
  'Militar':          {pv:4, san:0, pe:0},
  'Operário':         {pv:4, san:0, pe:0},
  'Policial':         {pv:2, san:2, pe:0},
  'Religioso':        {pv:0, san:4, pe:0},
  'Servidor Público': {pv:0, san:2, pe:2},
  'Teórico da Conspiração':{pv:0,san:4,pe:0},
  'TI':               {pv:0, san:0, pe:4},
  'Trabalhador Rural':{pv:4, san:0, pe:0},
  'Trambiqueiro':     {pv:0, san:0, pe:4},
  'Universitário':    {pv:0, san:4, pe:0},
  'Vítima':           {pv:0, san:4, pe:0},
  // Legado (index.html antigo)
  'Abastado':         {pv:0, san:4, pe:0},
  'Artista':          {pv:0, san:2, pe:2},
  'Detetive':         {pv:0, san:4, pe:0},
  'Exorcista':        {pv:0, san:0, pe:4},
  'Inventor':         {pv:0, san:0, pe:4},
  'Soldado':          {pv:4, san:0, pe:0},
};

// Trilhas que alteram PE extra no cálculo
const TRILHA_PE_BONUS={
  'Conduíte':           2, // Ocultista: canal amplificado
  'Flagelador':        -2, // Gasta PV em vez de PE
  'Graduado':           0,
  'Intuitivo':          2,
  'Lâmina Paranormal': -2,
};

function calcMaxStats(c){
  const vig = (c.attrs&&c.attrs['Vigor'])||1;
  const pre = (c.attrs&&c.attrs['Presença'])||1;
  const classe = c.classe||'Combatente';
  const nex = parseInt(c.nex)||5;
  const deg = nexDegrau(nex);
  const orig = c.origem||'';
  const trilha = c.trilha||'';

  let pvBase, pvNex, sanBase, sanNex, peBase, peNex;

  if(classe==='Combatente'){
    pvBase  = 20 + vig;
    pvNex   = (4 + vig) * deg;
    sanBase = 12;
    sanNex  = 3 * deg;
    peBase  = 2 + pre;
    peNex   = (2 + pre) * deg;
  } else if(classe==='Especialista'){
    pvBase  = 16 + vig;
    pvNex   = (3 + vig) * deg;
    sanBase = 16;
    sanNex  = 4 * deg;
    peBase  = 3 + pre;
    peNex   = (3 + pre) * deg;
  } else { // Ocultista e qualquer outro
    pvBase  = 12 + vig;
    pvNex   = (2 + vig) * deg;
    sanBase = 20;
    sanNex  = 5 * deg;
    peBase  = 4 + pre;
    peNex   = (4 + pre) * deg;
  }

  const ob = ORIGEM_BONUS[orig]||{pv:0,san:0,pe:0};
  const trilhaExtra = TRILHA_PE_BONUS[trilha]||0;

  return {
    pvMax : pvBase + pvNex + ob.pv,
    sanMax: sanBase + sanNex + ob.san,
    esfMax: peBase + peNex + ob.pe + trilhaExtra,
  };
}

function recalcMaxStats(silent){
  if(!currentUser) return;
  const c=userChar(currentUser);
  const calc = calcMaxStats(c);

  // Guarda flag de se era manual antes
  if(c._manualStats) return; // modo manual: não recalcula

  const oldPvMax  = c.pvMax;
  const oldSanMax = c.sanMax;
  const oldEsfMax = c.esfMax;

  c.pvMax  = calc.pvMax;
  c.sanMax = calc.sanMax;
  c.esfMax = calc.esfMax;

  // Ajusta valores atuais proporcionalmente se máximo mudou
  if(oldPvMax  && calc.pvMax  !== oldPvMax)  c.pv  = Math.min(c.pv,  c.pvMax);
  if(oldSanMax && calc.sanMax !== oldSanMax) c.san = Math.min(c.san, c.sanMax);
  if(oldEsfMax && calc.esfMax !== oldEsfMax) c.esf = Math.min(c.esf, c.esfMax);

  // Atualiza UI
  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('s-pv',    c.pv);
  setEl('s-pvmax', c.pvMax);
  setEl('s-san',   c.san);
  setEl('s-sanmax',c.sanMax);
  setEl('s-esf',   c.esf);
  setEl('s-esfmax',c.esfMax);

  // Atualiza badge de cálculo automático
  const badge = document.getElementById('calc-badge');
  if(badge){
    badge.innerHTML=`<span style="color:#22aa66">⚙ Auto</span> PV:${c.pvMax} SAN:${c.sanMax} PE:${c.esfMax}`;
    badge.style.display='block';
  }
  if(!silent) saveDB();
}

function toggleManualStats(){
  if(!currentUser) return;
  const c=userChar(currentUser);
  c._manualStats = !c._manualStats;
  const btn=document.getElementById('btn-manual-stats');
  const badge=document.getElementById('calc-badge');
  if(c._manualStats){
    if(btn){btn.textContent='MANUAL';btn.style.borderColor='rgba(196,154,0,0.6)';btn.style.color='var(--gold-light)';}
    if(badge){badge.innerHTML='<span style="color:#c49a00">✎ Manual</span>';badge.style.display='block';}
    toast('Modo manual: PV/SAN/PE não serão recalculados automaticamente.','#c49a00');
  } else {
    if(btn){btn.textContent='AUTO';btn.style.borderColor='rgba(139,0,0,0.4)';btn.style.color='var(--white-dust)';}
    recalcMaxStats();
    toast('Modo automático: PV/SAN/PE calculados pelas regras.','#22aa66');
  }
  saveDB();
}
/* ══════════════════════════════════════════════
   USAR RITUAL — aplica custo de PE imediatamente
══════════════════════════════════════════════ */

function usarRitual(nomeRitual, custoExtra){
  if(!currentUser) return;
  const c = userChar(currentUser);
  const r = RITUAIS_DB.find(x=>x.nome===nomeRitual);
  if(!r){ toast('Ritual não encontrado.'); return; }

  let peGasto = (r.pe||0) + (parseInt(custoExtra)||0);
  let pvGasto = 0;

  // Rituais que drenam PV do conjurador (ex: Aberração Sanguínea, Consumir Manancial)
  const custaPV = r.efeito && (
    r.efeito.toLowerCase().includes('perde') && r.efeito.toLowerCase().includes('pv') ||
    r.efeito.toLowerCase().includes('pv ao conjurador') ||
    r.efeito.toLowerCase().includes('perda de pv') ||
    r.efeito.toLowerCase().includes('drena sua própria força')
  );

  // Rituais de cura que recuperam PV
  const curaAlvo = r.efeito && (
    r.efeito.toLowerCase().includes('recupera') && r.efeito.toLowerCase().includes('pv') ||
    r.efeito.toLowerCase().includes('cura') && r.efeito.toLowerCase().includes('pv')
  );

  // Habilidade "Poder do Flagelo" (Trilha Flagelador): gasta PV em vez de PE
  const isFlagel = (c.trilha||'').toLowerCase().includes('flagelador');

  if(isFlagel && peGasto>0){
    // 2 PV por 1 PE
    pvGasto = peGasto * 2;
    peGasto = 0;
  }

  // Verifica se tem PE suficiente
  if(peGasto > 0 && c.esf < peGasto){
    toast(`⚠ PE insuficiente! Precisa ${peGasto} PE, tem ${c.esf}.`, '#cc4422');
    return;
  }
  if(pvGasto > 0 && c.pv <= pvGasto){
    toast(`⚠ PV insuficiente para o custo do ritual!`, '#cc4422');
    return;
  }

  // Aplica gastos
  if(peGasto>0){ c.esf = Math.max(0, c.esf - peGasto); }
  if(pvGasto>0){ c.pv  = Math.max(0, c.pv  - pvGasto); }

  // Rituais que curam PV do próprio agente (efeito pessoal de cura)
  // Nota: cura de aliados não é aplicada automaticamente (exige alvo)
  if(curaAlvo && r.alvo && r.alvo.toLowerCase().includes('você')){
    // Executa o dado de cura
    const matchPV = r.efeito.match(/(\d+)d(\d+)(?:\+(\d+))?\s*(?:pv|pontos de vida)/i);
    if(matchPV){
      const nd=parseInt(matchPV[1]),ds=parseInt(matchPV[2]),bon=parseInt(matchPV[3])||0;
      let total=bon;
      for(let i=0;i<nd;i++) total+=Math.ceil(Math.random()*ds);
      c.pv=Math.min(c.pvMax, c.pv+total);
      toast(`✦ ${r.nome} — curou ${total} PV! PE gasto: ${r.pe}.`, '#22aa66');
    }
  }

  // Log no dado log se existir
  const h=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(!db.rolls) db.rolls=[];
  db.rolls.unshift({user:currentUser,type:'ritual',detail:`${r.nome} (-${isFlagel?pvGasto+'PV':peGasto+'PE'})`,ts:Date.now()});
  if(db.rolls.length>80) db.rolls.length=80;

  // Atualiza UI
  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('s-pv',  c.pv);
  setEl('s-esf', c.esf);
  renderLog();
  saveDB();
  _publishMyStatus();

  if(!curaAlvo||!(r.alvo&&r.alvo.toLowerCase().includes('você'))){
    const pvTxt = pvGasto>0?` / -${pvGasto} PV`:'';
    const peTxt = peGasto>0?`-${peGasto} PE`:'';
    toast(`⛧ ${r.nome} — ${peTxt}${pvTxt} aplicado!`, '#c49a00');
  }
}
 
/* ══════════════════════════════════════════════
   PERÍCIAS
══════════════════════════════════════════════ */
const PERICIAS=[
  {nome:'Acrobacia',attr:'AGI'},
  {nome:'Artes',attr:'PRE'},
  {nome:'Atletismo',attr:'FOR'},
  {nome:'Atualidades',attr:'INT'},
  {nome:'Ciências',attr:'INT'},
  {nome:'Crime',attr:'AGI'},
  {nome:'Diplomacia',attr:'PRE'},
  {nome:'Enganação',attr:'PRE'},
  {nome:'Fortitude',attr:'VIG'},
  {nome:'Furtividade',attr:'AGI'},
  {nome:'Iniciativa',attr:'AGI'},
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
  {nome:'Sobrevivência',attr:'INT'},
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
 
/* ══════════════════════════════════════════════
   ITENS — Arsenal, Equipamentos, Veículos
══════════════════════════════════════════════ */
const ITENS_DB = [
  // ══ ARMAS ══
  {id:'faca',nome:'Faca',tipo:'arma',cat:'0',espacos:1,dam:'1d4',crit:'19',alcance:'Curto',tipoDano:'C',desc:'Faca comum, arremessável.'},
  {id:'punhal',nome:'Punhal',tipo:'arma',cat:'0',espacos:1,dam:'1d4',crit:'x3',tipoDano:'P',desc:'Punhal de lâmina curta.'},
  {id:'martelo',nome:'Martelo',tipo:'arma',cat:'0',espacos:1,dam:'1d6',crit:'x2',tipoDano:'I',desc:'Martelo comum.'},
  {id:'bastao',nome:'Bastão',tipo:'arma',cat:'0',espacos:1,dam:'1d6/1d8',crit:'x2',tipoDano:'I',desc:'Bastão de madeira.'},
  {id:'machete',nome:'Machete',tipo:'arma',cat:'0',espacos:1,dam:'1d6',crit:'19',tipoDano:'C',desc:'Faca grande.'},
  {id:'lanca',nome:'Lança',tipo:'arma',cat:'0',espacos:1,dam:'1d6',crit:'x2',alcance:'Curto',tipoDano:'P',desc:'Lança com ponta afiada.'},
  {id:'cajado',nome:'Cajado',tipo:'arma',cat:'0',espacos:2,dam:'1d6/1d6',crit:'x2',tipoDano:'I',maos:'2',desc:'Cajado longo.'},
  {id:'arco',nome:'Arco',tipo:'arma',cat:'0',espacos:2,dam:'1d6',crit:'x3',alcance:'Médio',tipoDano:'P',maos:'2',desc:'Arco de caça.'},
  {id:'besta',nome:'Besta',tipo:'arma',cat:'0',espacos:2,dam:'1d8',crit:'19',alcance:'Médio',tipoDano:'P',maos:'2',desc:'Besta de repetição.'},
  {id:'pistola',nome:'Pistola',tipo:'arma',cat:'I',espacos:1,dam:'1d12',crit:'18',alcance:'Curto',tipoDano:'B',desc:'Pistola semiautomática.'},
  {id:'revolver',nome:'Revólver',tipo:'arma',cat:'I',espacos:1,dam:'2d6',crit:'19/x3',alcance:'Curto',tipoDano:'B',desc:'Revólver .38.'},
  {id:'fuzil-caca',nome:'Fuzil de Caça',tipo:'arma',cat:'I',espacos:2,dam:'2d8',crit:'19/x3',alcance:'Médio',tipoDano:'B',maos:'2',desc:'Espingarda de caça.'},
  {id:'machadinha',nome:'Machadinha',tipo:'arma',cat:'0',espacos:1,dam:'1d6',crit:'x3',alcance:'Curto',tipoDano:'C',desc:'Machadinha de arremesso.'},
  {id:'espada',nome:'Espada',tipo:'arma',cat:'I',espacos:1,dam:'1d8/1d10',crit:'19',tipoDano:'C',desc:'Espada de lâmina reta.'},
  {id:'florete',nome:'Florete',tipo:'arma',cat:'I',espacos:1,dam:'1d6',crit:'18',tipoDano:'C',desc:'Espada de esgrima.'},
  {id:'katana',nome:'Katana',tipo:'arma',cat:'I',espacos:2,dam:'1d10',crit:'19',tipoDano:'C',maos:'2',desc:'Espada curva.'},
  {id:'montante',nome:'Montante',tipo:'arma',cat:'I',espacos:2,dam:'2d6',crit:'19',tipoDano:'C',maos:'2',desc:'Espada de duas mãos.'},
  {id:'motosserra',nome:'Motosserra',tipo:'arma',cat:'I',espacos:2,dam:'3d6',crit:'x2',tipoDano:'C',maos:'2',desc:'Serra elétrica.'},
  {id:'submetralhadora',nome:'Submetralhadora',tipo:'arma',cat:'I',espacos:1,dam:'2d6',crit:'19/x3',alcance:'Curto',tipoDano:'B',desc:'Arma automática leve.'},
  {id:'espingarda',nome:'Espingarda',tipo:'arma',cat:'I',espacos:2,dam:'4d6',crit:'x3',alcance:'Curto',tipoDano:'B',maos:'2',desc:'Cano duplo.'},
  {id:'fuzil-assalto',nome:'Fuzil de Assalto',tipo:'arma',cat:'II',espacos:2,dam:'2d10',crit:'19/x3',alcance:'Médio',tipoDano:'B',maos:'2',desc:'Automático.'},
  {id:'fuzil-precisao',nome:'Fuzil de Precisão',tipo:'arma',cat:'III',espacos:2,dam:'2d10',crit:'19/x3',alcance:'Longo',tipoDano:'B',maos:'2',desc:'Sniper.'},
  {id:'bazuca',nome:'Bazuca',tipo:'arma',cat:'II',espacos:2,dam:'10d8',crit:'x2',alcance:'Médio',tipoDano:'I',maos:'2',desc:'Lançador de foguetes.'},
  {id:'metralhadora',nome:'Metralhadora',tipo:'arma',cat:'II',espacos:2,dam:'2d12',crit:'19/x3',alcance:'Médio',tipoDano:'B',maos:'2',desc:'Metralhadora pesada.'},
  {id:'lanca-chamas',nome:'Lança-chamas',tipo:'arma',cat:'III',espacos:2,dam:'6d6',crit:'x2',alcance:'Curto',tipoDano:'Fogo',maos:'2',desc:'Lançador de chamas.'},
  // ══ PROTEÇÕES ══
  {id:'protecao-leve',nome:'Proteção Leve',tipo:'protecao',cat:'I',espacos:2,defesa:'+5',desc:'Jaqueta de couro ou kevlar.'},
  {id:'protecao-pesada',nome:'Proteção Pesada',tipo:'protecao',cat:'II',espacos:5,defesa:'+10',rd:'2',desc:'Armadura tática completa.'},
  {id:'escudo',nome:'Escudo',tipo:'protecao',cat:'I',espacos:'1 mão',defesa:'+2',desc:'Escudo tático.'},
  // ══ EQUIPAMENTO ══
  {id:'kit-pericia',nome:'Kit de Perícia',tipo:'equipamento',cat:'0',espacos:1,desc:'Kit para perícia específica.'},
  {id:'cicatrizante',nome:'Cicatrizante',tipo:'equipamento',cat:'0',espacos:1,desc:'Cura 2d8+2 PV.'},
  {id:'algemas',nome:'Algemas',tipo:'equipamento',cat:'0',espacos:1,desc:'Acrobacia DT 30 para escapar.'},
  {id:'granada-frag',nome:'Granada de Fragmentação',tipo:'equipamento',cat:'I',espacos:1,desc:'8d6 P em 6m.'},
  {id:'taser',nome:'Taser',tipo:'equipamento',cat:'I',espacos:1,desc:'1d6 + atordoado.'},
  // ══ ITENS PARANORMAIS ══
  {id:'camera-aura',nome:'Câmera de Aura Paranormal',tipo:'paranormal',cat:'II',espacos:1,desc:'Revela auras paranormais.'},
  {id:'medidor-membrana',nome:'Medidor de Estabilidade da Membrana',tipo:'paranormal',cat:'I',espacos:1,desc:'Avalia a Membrana.'},
  // ══ VEÍCULOS (Arsenal dos Agentes) ══
  {id:'asa-delta',nome:'Asa Delta',tipo:'veiculo',cat:'0',espacos:10,carga:25,pv:12,rd:0,desloc:'planagem',desc:'Aéreo/Não-motorizado. Planar em alta velocidade.'},
  {id:'aviao-comercial',nome:'Avião Comercial',tipo:'veiculo',cat:'V',espacos:5000,carga:2500,pv:1200,rd:20,desloc:'90m',desc:'Grande avião de transporte. Velocidade de cruzeiro.'},
  {id:'aviao-monomotor',nome:'Avião Monomotor',tipo:'veiculo',cat:'III',espacos:500,carga:100,pv:200,rd:10,desloc:'60m',desc:'Avião pequeno de uso particular.'},
  {id:'balao',nome:'Balão',tipo:'veiculo',cat:'II',espacos:50,carga:200,pv:20,rd:2,desloc:'9m',desc:'Aéreo. Movido a ar quente.'},
  {id:'barco',nome:'Barco',tipo:'veiculo',cat:'III',espacos:250,carga:200,pv:150,rd:5,desloc:'30m',desc:'Aquático. Pode usar velas.'},
  {id:'bote',nome:'Bote',tipo:'veiculo',cat:'0',espacos:5,carga:0,pv:3,rd:0,desloc:'6m',desc:'Inflável. Portátil quando desinflado.'},
  {id:'cadeira-rodas',nome:'Cadeira de Rodas',tipo:'veiculo',cat:'0',espacos:5,carga:15,pv:20,rd:2,desloc:'4,5m+1,5m/For',desc:'Usa Pilotagem em vez de Atletismo.'},
  {id:'tocha-radial',nome:'Tocha Radial',tipo:'paranormal',cat:'I',espacos:1,desc:'Item do Portador do Medo. Emite luz radial que revela criaturas invisíveis em alcance médio.'},
  {id:'amante-sol',nome:'Amante do Sol',tipo:'paranormal',cat:'III',espacos:1,desc:'Item do Portador do Medo. Concede resistência a fogo e luz. Pode absorver luz solar para curar 2d8 PV 1x/dia.'},
  {id:'caminhao',nome:'Caminhão',tipo:'veiculo',cat:'III',espacos:1000,carga:750,pv:300,rd:10,desloc:'18m',desc:'Grande porte para cargas.'},
  {id:'caminhao-bombeiro',nome:'Caminhão de Bombeiros',tipo:'veiculo',cat:'III',espacos:1000,carga:400,pv:300,rd:10,desloc:'18m',desc:'Escada 45m, jato de água.'},
  {id:'caminhao-mineracao',nome:'Caminhão de Mineração',tipo:'veiculo',cat:'IV',espacos:10000,carga:5000,pv:2500,rd:20,desloc:'6m',desc:'Maior veículo terrestre.'},
  {id:'canoa',nome:'Canoa',tipo:'veiculo',cat:'0',espacos:20,carga:100,pv:50,rd:5,desloc:'6m+1,5m/For',desc:'Aquático. Movida a remos.'},
  {id:'carro',nome:'Carro',tipo:'veiculo',cat:'II',espacos:150,carga:80,pv:100,rd:10,desloc:'24m',desc:'Veículo comum de passeio.'},
  {id:'carroca',nome:'Carroça',tipo:'veiculo',cat:'0',espacos:20,carga:100,pv:20,rd:2,desloc:'menor animal -3m',desc:'Puxada por animais. Até 4 animais.'},
  {id:'colheitadeira',nome:'Colheitadeira',tipo:'veiculo',cat:'III',espacos:300,carga:150,pv:200,rd:10,desloc:'12m',desc:'Ignora plantações como terreno.'},
  {id:'escavadeira',nome:'Escavadeira',tipo:'veiculo',cat:'II',espacos:300,carga:20,pv:250,rd:10,desloc:'12m',desc:'+20 em cavar. Ignora terreno difícil.'},
  {id:'empilhadeira',nome:'Empilhadeira',tipo:'veiculo',cat:'I',espacos:50,carga:200,pv:50,rd:5,desloc:'9m',desc:'Levanta objetos pesados.'},
  {id:'foguete',nome:'Foguete',tipo:'veiculo',cat:'VI',espacos:100000,carga:1000,pv:200,rd:100,desloc:'600m',desc:'Veículo mais rápido. Viagem espacial.'},
  {id:'guindaste',nome:'Guindaste',tipo:'veiculo',cat:'III',espacos:1000,carga:30,pv:300,rd:10,desloc:'4,5m',desc:'Levanta objetos pesados à distância.'},
  {id:'helicoptero',nome:'Helicóptero',tipo:'veiculo',cat:'III',espacos:500,carga:200,pv:500,rd:10,desloc:'45m',desc:'Aéreo. +1d20 Pilotagem.'},
  {id:'jato',nome:'Jato',tipo:'veiculo',cat:'V',espacos:500,carga:250,pv:300,rd:50,desloc:'300m',desc:'Avião militar rápido.'},
  {id:'jet-ski',nome:'Jet Ski',tipo:'veiculo',cat:'I',espacos:15,carga:25,pv:25,rd:10,desloc:'21m',desc:'Aquático ágil.'},
  {id:'lancha',nome:'Lancha',tipo:'veiculo',cat:'II',espacos:150,carga:80,pv:100,rd:10,desloc:'21m',desc:'Versão maior do jet ski.'},
  {id:'mochila-jato',nome:'Mochila a Jato',tipo:'veiculo',cat:'II',espacos:5,carga:10,pv:20,rd:5,desloc:'21m',desc:'Voo até 6m de altura.'},
  {id:'moto',nome:'Moto',tipo:'veiculo',cat:'I',espacos:15,carga:25,pv:25,rd:10,desloc:'27m',desc:'Veículo ágil. Pode cair.'},
  {id:'navio',nome:'Navio',tipo:'veiculo',cat:'V',espacos:5000,carga:4000,pv:2000,rd:10,desloc:'18m',desc:'Grande embarcação marítima.'},
  {id:'paraquedas',nome:'Paraquedas',tipo:'veiculo',cat:'I',espacos:2,carga:25,pv:10,rd:0,desloc:'9m queda',desc:'Desacelera quedas.'},
  {id:'quadriciclo',nome:'Quadriciclo',tipo:'veiculo',cat:'I',espacos:25,carga:30,pv:30,rd:5,desloc:'15m',desc:'Veículo de quatro rodas.'},
  {id:'submarino',nome:'Submarino',tipo:'veiculo',cat:'III',espacos:300,carga:150,pv:200,rd:100,desloc:'30m',desc:'Submerge até 500m.'},
  {id:'tanque-guerra',nome:'Tanque de Guerra',tipo:'veiculo',cat:'IV',espacos:1000,carga:50,pv:1000,rd:50,desloc:'15m',desc:'Veículo militar blindado.'},
  {id:'trator',nome:'Trator',tipo:'veiculo',cat:'I',espacos:100,carga:20,pv:50,rd:5,desloc:'12m',desc:'Veículo agrícola versátil.'},
  {id:'trem',nome:'Trem (vagão)',tipo:'veiculo',cat:'II',espacos:2000,carga:1000,pv:1000,rd:20,desloc:'45m',desc:'Só se move em trilhos.'},
  {id:'van',nome:'Van',tipo:'veiculo',cat:'II',espacos:250,carga:150,pv:150,rd:10,desloc:'18m',desc:'Utilitário de transporte.'},
  // ══ APETRECHOS VEICULARES ══
  {id:'carreta',nome:'Carreta',tipo:'modificacao',cat:'I',desc:'Acoplável. +200 carga, -1d20 Pilotagem.'},
  {id:'corrente-neve',nome:'Corrente de Neve',tipo:'modificacao',cat:'0',espacos:5,desc:'Ignora terreno difícil na neve.'},
  {id:'extintor',nome:'Extintor de Incêndio',tipo:'modificacao',cat:'I',espacos:2,desc:'Apaga chamas em cone 4,5m. 4 cargas.'},
  {id:'sirene',nome:'Sirene',tipo:'modificacao',cat:'0',espacos:1,desc:'Abala criminosos em alcance médio.'},
  // ══ MODIFICAÇÕES VEICULARES ══
  {id:'blindado',nome:'Blindado',tipo:'modificacao',desc:'+5 RD (ou +10 se RD >=20). Espaço +10%.'},
  {id:'conversao-eletrica',nome:'Conversão Elétrica',tipo:'modificacao',desc:'Carrega em tomadas. Manutenção DT -5.'},
  {id:'economico',nome:'Econômico',tipo:'modificacao',desc:'+25% km por PC. Acumulável.'},
  {id:'motorizado',nome:'Motorizado',tipo:'modificacao',desc:'+6m deslocamento. Gasta PC.'},
  {id:'silencioso',nome:'Silencioso',tipo:'modificacao',desc:'Veículo não faz barulho ao dirigir.'},
  {id:'traçao-dupla',nome:'Tração Dupla',tipo:'modificacao',desc:'Ignora terreno difícil. -20% km/PC.'},
  {id:'turbo',nome:'Turbo',tipo:'modificacao',desc:'Gaste 5% PC para ação de movimento extra.'},
  {id:'tanque-expandido',nome:'Tanque Expandido',tipo:'modificacao',desc:'+50% ou +50 PC. Acumulável.'},
  {id:'confortavel',nome:'Confortável',tipo:'modificacao',desc:'Acomodação luxuosa para 1 pessoa.'},
  {id:'armamento-acop',nome:'Armamento Acoplável',tipo:'modificacao',desc:'1 arma a cada 50 espaços do veículo.'},
  // ══ MALDIÇÕES VEICULARES ══
  {id:'cacador',nome:'Caçador (Sangue)',tipo:'modificacao',desc:'RD dobra ao seguir rastros. +5 Percepção/Pilotagem.'},
  {id:'compressora',nome:'Compressora (Varia)',tipo:'modificacao',desc:'Comprime veículo em objeto portátil.'},
  {id:'grudenta',nome:'Grudenta (Morte)',tipo:'modificacao',desc:'Sobe paredes. +5 curvas. Pré: Terrestre.'},
  {id:'invisivel',nome:'Invisível (Conhecimento)',tipo:'modificacao',desc:'Invisibilidade. 5 PE/rodada.'},
  {id:'propulsao',nome:'Propulsão (Energia)',tipo:'modificacao',desc:'Atravessa líquidos. Deslocamento dobrado.'},
];
let _fitFiltro = 'todas';
function filtrarItens(tipo){
  _fitFiltro = tipo;
  document.querySelectorAll('#tab-itens .btn-add').forEach(b=>{
    const txt = (b.textContent||'').toLowerCase().split(' ')[0];
    b.style.background = txt===tipo||(tipo==='todas'&&b.id==='fit-todas')?'rgba(139,0,0,0.2)':'transparent';
  });
  renderItens();
}
function renderItens(){
  const g=document.getElementById('itens-grid');if(!g)return;
  const b=(document.getElementById('itens-busca')||{}).value||'';
  const cf=(document.getElementById('itens-categoria-fil')||{}).value||'';
  let l=_fitFiltro==='todas'?ITENS_DB:ITENS_DB.filter(i=>i.tipo===_fitFiltro);
  if(b)l=l.filter(i=>i.nome.toLowerCase().includes(b.toLowerCase())||i.desc.toLowerCase().includes(b.toLowerCase()));
  if(cf)l=l.filter(i=>String(i.cat)===cf);
  const ct={arma:'#cc4422',protecao:'#22aa66',equipamento:'#8888cc',paranormal:'#c8a000',veiculo:'#5577bb',modificacao:'#aa66cc'};
  g.innerHTML=l.map(i=>`
    <div onclick="verItem('${i.id}')" style="background:rgba(10,0,8,0.9);border:1px solid var(--blood-deep);padding:14px;cursor:pointer" onmouseover="this.style.borderColor='${ct[i.tipo]||'var(--crimson)'}'" onmouseout="this.style.borderColor='var(--blood-deep)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--white-bone)">${i.nome}</div>
        <span style="font-size:10px;padding:2px 8px;border:1px solid ${ct[i.tipo]||'#888'};color:${ct[i.tipo]||'#888'};font-family:'Oswald',sans-serif">${i.tipo.toUpperCase()}</span>
      </div>
      <div style="display:flex;gap:14px;font-size:11px;font-family:'Courier Prime',monospace;color:var(--white-dust)">
        ${i.cat!==undefined?`<span>Cat <b style="color:var(--gold-light)">${i.cat}</b></span>`:''}
        ${i.dam?`<span>Dano <b style="color:var(--crimson-mid)">${i.dam}</b></span>`:''}
        ${i.defesa?`<span>Def <b style="color:var(--white-ash)">${i.defesa}</b></span>`:''}
        ${i.desloc?`<span>${i.desloc}</b></span>`:''}
      </div>
      <div style="margin-top:6px;font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace">${i.desc}</div>
    </div>`).join('');
}
function verItem(id){
  const i=ITENS_DB.find(x=>x.id===id);if(!i)return;
  const ct={arma:'#cc4422',protecao:'#22aa66',equipamento:'#8888cc',paranormal:'#c8a000',veiculo:'#5577bb',modificacao:'#aa66cc'};
  document.getElementById('item-detail-body').innerHTML=`
    <div style="display:flex;justify-content:space-between;margin-bottom:14px">
      <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--white-dim)">${i.nome}</div>
      <span style="font-size:11px;padding:3px 10px;border:1px solid ${ct[i.tipo]||'#888'};color:${ct[i.tipo]||'#888'};font-family:'Oswald',sans-serif">${i.tipo.toUpperCase()}</span>
    </div>
    <p style="font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash);font-size:13px;margin-bottom:16px;line-height:1.7">${i.desc}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;font-family:'Courier Prime',monospace">
      ${['cat','espacos','dam','crit','alcance','defesa','rd','pv','desloc','carga'].filter(k=>i[k]).map(k=>`<div style="background:rgba(15,0,12,0.9);border:1px solid var(--blood-deep);padding:10px"><span style="color:var(--white-dust)">${k}</span><br><b style="color:var(--gold-light)">${i[k]}</b></div>`).join('')}
    </div>`;
  document.getElementById('item-detail-panel').style.display='block';
  document.getElementById('itens-grid').parentElement.scrollIntoView({behavior:'smooth'});
}

/* ══════════════════════════════════════════════
   TRILHAS
══════════════════════════════════════════════ */
const TRILHAS_DATA = {
  Combatente: {
    Aniquilador: {
      desc: 'Especialista em maximizar o dano de uma arma favorita, executando técnicas secretas devastadoras.',
      habs: [
        {nex:'10%', nome:'A Favorita', desc:'Escolha uma arma favorita. A categoria dela é reduzida em I.'},
        {nex:'40%', nome:'Técnica Secreta', desc:'A categoria da arma favorita é reduzida em II. Quando faz um ataque com ela, pode gastar 2 PE para aplicar: Amplo (atinge +1 alvo adjacente) ou Destruidor (+1 multiplicador de crítico). +2 PE por efeito adicional.'},
        {nex:'65%', nome:'Técnica Sublime', desc:'Adiciona à Técnica Secreta: Letal (+2 margem de ameaça, pode escolher 2x para +5) e Perfurante (ignora até 5 RD do alvo).'},
        {nex:'99%', nome:'Máquina de Matar', desc:'Categoria da arma favorita reduzida em III, +2 margem de ameaça, dano aumenta em +1 dado.'}
      ]
    },
    'Comandante de Campo': {
      desc: 'Líder tático que inspira aliados, concedendo ações e vantagens estratégicas no campo de batalha.',
      habs: [
        {nex:'10%', nome:'Inspirar Confiança', desc:'Gaste uma reação e 2 PE para fazer um aliado em alcance curto rolar novamente um teste recém realizado.'},
        {nex:'40%', nome:'Estrategista', desc:'Gaste uma ação padrão e 1 PE por aliado (limite: Intelecto) em alcance curto. No próximo turno, eles ganham uma ação de movimento adicional.'},
        {nex:'65%', nome:'Brecha na Guarda', desc:'1x/rodada, quando um aliado causar dano a um inimigo em alcance curto, gaste reação e 2 PE para você ou outro aliado fazer um ataque adicional contra ele. Alcance de Inspirar Confiança e Estrategista aumenta para médio.'},
        {nex:'99%', nome:'Oficial Comandante', desc:'Gaste uma ação padrão e 5 PE para que cada aliado visível em alcance médio receba uma ação padrão adicional no próximo turno.'}
      ]
    },
     Guerreiro: {
      desc: 'Combatente versátil que domina técnicas de batalha corpo a corpo com golpes poderosos.',
      habs: [
        {nex:'10%', nome:'Técnica Letal', desc:'+2 na margem de ameaça com todos os ataques corpo a corpo.'},
        {nex:'40%', nome:'Revidar', desc:'Quando bloqueia um ataque, gaste reação e 2 PE para fazer um ataque corpo a corpo no inimigo que o atacou.'},
        {nex:'65%', nome:'Força Opressora', desc:'Quando acerta ataque corpo a corpo, gaste 1 PE para realizar manobra derrubar/empurrar como ação livre. Se empurrar, +5 no teste para cada 10 de dano causado. Se derrubar, pode gastar 1 PE para ataque adicional contra o caído.'},
        {nex:'99%', nome:'Potência Máxima', desc:'Quando usa Ataque Especial com armas corpo a corpo, todos os bônus numéricos são dobrados.'}
      ]
    },
     'Operações Especiais': {
      desc: 'Agente ágil treinado para operações táticas, com alta iniciativa e ataques precisos.',
      habs: [
        {nex:'10%', nome:'Iniciativa Aprimorada', desc:'+5 em Iniciativa e uma ação de movimento adicional na primeira rodada.'},
        {nex:'40%', nome:'Ataque Extra', desc:'1x/rodada, quando faz um ataque, pode gastar 2 PE para fazer um ataque adicional.'},
        {nex:'65%', nome:'Surto de Adrenalina', desc:'1x/rodada, pode gastar 5 PE para realizar uma ação padrão ou de movimento adicional.'},
        {nex:'99%', nome:'Sempre Alerta', desc:'Recebe uma ação padrão adicional no início de cada cena de combate.'}
      ]
    },
     'Tropa de Choque': {
      desc: 'Tanque defensivo que absorve dano e protege aliados, com altíssima resistência física.',
      habs: [
        {nex:'10%', nome:'Casca Grossa', desc:'+1 PV para cada 5% de NEX. Quando faz bloqueio, soma Vigor na RD.'},
        {nex:'40%', nome:'Cai Dentro', desc:'Quando oponente em alcance curto ataca aliado, gaste reação + 1 PE. Oponente faz Vontade (DT Vig). Se falhar, deve atacar você.'},
        {nex:'65%', nome:'Duro de Matar', desc:'Ao sofrer dano não paranormal, gaste reação + 2 PE para reduzir à metade. Em NEX 85%, funciona em dano paranormal.'},
        {nex:'99%', nome:'Inquebrável', desc:'Enquanto machucado: +5 Defesa e RD 5. Enquanto morrendo: não fica indefeso e ainda pode agir.'}
      ]
    }
  },
  Especialista: {
     'Atirador de Elite': {
      desc: 'Perito em neutralizar ameaças de longe com precisão cirúrgica.',
      habs: [
        {nex:'10%', nome:'Mira de Elite', desc:'Proficiência com armas de fogo de balas longas. Soma Intelecto nas rolagens de dano com essas armas.'},
        {nex:'40%', nome:'Disparo Letal', desc:'Quando faz a ação mirar, pode gastar 1 PE para +2 margem de ameaça no próximo ataque até o fim do seu próximo turno.'},
        {nex:'65%', nome:'Disparo Impactante', desc:'Quando ataca com arma de fogo, gaste 2 PE e, em vez de dano, faça manobra de derrubar, desarmar, empurrar ou quebrar.'},
        {nex:'99%', nome:'Atirar para Matar', desc:'Em acerto crítico com arma de fogo, causa dano máximo sem rolar dados.'}
      ]
    },
     Infiltrador: {
      desc: 'Perito em infiltração que neutraliza alvos desprevenidos sem causar alarde.',
      habs: [
        {nex:'10%', nome:'Ataque Furtivo', desc:'1x/rodada, quando atinge alvo desprevenido ou flanqueado, gaste 1 PE para +1d6 dano. Em NEX 40% +2d6, 65% +3d6, 99% +4d6.'},
        {nex:'40%', nome:'Gatuno', desc:'+5 em Atletismo e Crime. Pode percorrer deslocamento normal ao se esconder sem penalidade.'},
        {nex:'65%', nome:'Assassinar', desc:'Gaste ação de movimento + 3 PE para analisar alvo em alcance curto. Seu próximo Ataque Furtivo nele tem dados dobrados. Se causar dano, alvo fica inconsciente ou morrendo (Fort DT Agi evita).'},
        {nex:'99%', nome:'Sombra Fugaz', desc:'Quando faz teste de Furtividade após atacar, gaste 3 PE para não sofrer penalidade de –D no teste.'}
      ]
    },
     'Médico de Campo': {
      desc: 'Treinado em primeiros socorros e tratamento de emergência no campo de batalha.',
      habs: [
        {nex:'10%', nome:'Paramédico', desc:'Ação padrão + 2 PE para curar 2d10 PV de si ou aliado adjacente. +1d10 PV a cada novo degrau de NEX (+1 PE por dado extra).'},
        {nex:'40%', nome:'Equipe de Trauma', desc:'Ação padrão + 2 PE para remover uma condição negativa (exceto morrendo) de aliado adjacente.'},
        {nex:'65%', nome:'Resgate', desc:'1x/rodada, se em alcance curto de aliado machucado/morrendo, aproxime-se como ação livre. Quando cura, você e o aliado recebem +5 Defesa até seu próximo turno.'},
        {nex:'99%', nome:'Reanimação', desc:'1x/cena, ação completa + 10 PE para trazer de volta à vida um aliado que morreu na mesma cena (exceto dano massivo).'}
      ]
    },
     Negociador: {
      desc: 'Diplomata habilidoso que influencia pessoas com lábia ou intimidação.',
      habs: [
        {nex:'10%', nome:'Eloquência', desc:'Ação completa + 1 PE por alvo em alcance curto. Diplomacia/Enganação/Intimidação vs Vontade. Se vencer, alvos ficam fascinados enquanto você se concentrar.'},
        {nex:'40%', nome:'Discurso Motivador', desc:'Ação padrão + 4 PE para inspirar aliados em alcance curto. Todos ganham +D em testes de perícia até o fim da cena. Em NEX 65%, pode gastar 8 PE para +5.'},
        {nex:'65%', nome:'Eu Conheço um Cara', desc:'1x/missão, ative rede de contatos para favores: reequipar, conseguir abrigo, resgate. Mestre decide limites.'},
        {nex:'99%', nome:'Truque de Mestre', desc:'Gaste 5 PE para simular qualquer habilidade que viu um aliado usar na cena. Ignora pré-requisitos, paga custos normalmente.'}
      ]
    },
     Técnico: {
      desc: 'Especialista em manutenção, reparo e improviso de equipamentos.',
      habs: [
        {nex:'10%', nome:'Inventário Otimizado', desc:'Soma Intelecto à Força para calcular capacidade de carga.'},
        {nex:'40%', nome:'Remendão', desc:'Ação completa + 1 PE para remover condição quebrado de equipamento adjacente. Equipamento geral tem categoria reduzida em I para você.'},
        {nex:'65%', nome:'Improvisar', desc:'Ação completa + 2 PE (+2 PE por categoria) para criar versão funcional de equipamento geral com materiais disponíveis. Dura até o fim da cena.'},
        {nex:'99%', nome:'Preparado para Tudo', desc:'Ação de movimento + 3 PE por categoria do item para ter qualquer item não-arma na mochila.'}
      ]
    }
  },
  Ocultista: {
     Conduíte: {
      desc: 'Domina os aspectos fundamentais da conjuração de rituais, aumentando alcance e velocidade.',
      habs: [
        {nex:'10%', nome:'Ampliar Ritual', desc:'Quando lança ritual, gaste +2 PE para aumentar alcance em um passo ou dobrar área de efeito.'},
        {nex:'40%', nome:'Acelerar Ritual', desc:'1x/rodada, aumente custo do ritual em 4 PE para conjurá-lo como ação livre.'},
        {nex:'65%', nome:'Anular Ritual', desc:'Quando for alvo de ritual, gaste PE igual ao custo pago + teste oposto de Ocultismo. Se vencer, anula o ritual.'},
        {nex:'99%', nome:'Canalizar o Medo', desc:'Aprende o ritual Canalizar o Medo.'}
      ]
    },
     Flagelador: {
      desc: 'Transforma dor e sofrimento em poder para seus rituais ocultistas.',
      habs: [
        {nex:'10%', nome:'Poder do Flagelo', desc:'Ao conjurar ritual, pode gastar PV em vez de PE (2 PV por 1 PE). PV gastos só recuperam com descanso.'},
        {nex:'40%', nome:'Abraçar a Dor', desc:'Ao sofrer dano não paranormal, gaste reação + 2 PE para reduzir à metade.'},
        {nex:'65%', nome:'Absorver Agonia', desc:'Quando reduz inimigo a 0 PV com ritual, recebe PE temporários iguais ao círculo do ritual.'},
        {nex:'99%', nome:'Medo Tangível', desc:'Aprende o ritual Medo Tangível.'}
      ]
    },
     Graduado: {
      desc: 'Foca em se tornar um conjurador versátil e poderoso, com mais rituais que outros ocultistas.',
      habs: [
        {nex:'10%', nome:'Saber Ampliado', desc:'Aprende 1 ritual de 1º círculo. Toda vez que ganha acesso a novo círculo, aprende +1 ritual daquele círculo.'},
        {nex:'40%', nome:'Grimório Ritualístico', desc:'Cria grimório com rituais de 1º-2º círculo (quantia = Intelecto). Ocupa 1 espaço. Preciso folhear (ação completa) para conjurar do grimório.'},
        {nex:'65%', nome:'Rituais Eficientes', desc:'+5 na DT para resistir a todos os seus rituais.'},
        {nex:'99%', nome:'Conhecendo o Medo', desc:'Aprende o ritual Conhecendo o Medo.'}
      ]
    },
     Intuitivo: {
      desc: 'Preparou sua mente para resistir aos efeitos do Outro Lado com foco e força de vontade.',
      habs: [
        {nex:'10%', nome:'Mente Sã', desc:'Resistência paranormal +5 (+5 em testes de resistência contra efeitos paranormais).'},
        {nex:'40%', nome:'Presença Poderosa', desc:'Adiciona Presença ao limite de PE por turno (apenas para conjurar rituais, não para DT).'},
        {nex:'65%', nome:'Inabalável', desc:'Resistência a dano mental e paranormal 10. Quando passa em Vontade para reduzir dano à metade, não sofre dano algum.'},
        {nex:'99%', nome:'Presença do Medo', desc:'Aprende o ritual Presença do Medo.'}
      ]
    },
     'Lâmina Paranormal': {
      desc: 'Usa o paranormal como arma, mesclando conjuração com combate corpo a corpo.',
      habs: [
        {nex:'10%', nome:'Lâmina Maldita', desc:'Aprende Amaldiçoar Arma. Se já conhece, gaste +1 PE ao lançar para reduzir tempo de conjuração para movimento. Usa Ocultismo em vez de Luta/Pontaria com a arma amaldiçoada.'},
        {nex:'40%', nome:'Gladiador Paranormal', desc:'Quando acerta ataque corpo a corpo em inimigo, recebe 2 PE temporários (máx. por cena = limite de PE).'},
        {nex:'65%', nome:'Conjuração Marcial', desc:'1x/rodada, quando lança ritual com ação padrão, gaste 2 PE para fazer um ataque corpo a corpo como ação livre.'},
        {nex:'99%', nome:'Lâmina do Medo', desc:'Aprende o ritual Lâmina do Medo.'}
      ]
    }
  }
};

function renderTrilhasOpts(){
  const cl=document.getElementById('trilha-classe-sel').value;
  const sel=document.getElementById('trilha-nome-sel');
  sel.innerHTML='<option value="">— Selecione a Trilha —</option>';
  if(!cl||!TRILHAS_DATA[cl]) return;
  Object.keys(TRILHAS_DATA[cl]).forEach(t=>{
    const o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o);
  });
  // pre-select saved
  const c=userChar(currentUser);
  if(c.trilha&&c.trilha.classe===cl) sel.value=c.trilha.nome||'';
  renderTrilhaAtiva();
}

function confirmarTrilha(){
  const cl=document.getElementById('trilha-classe-sel').value;
  const nm=document.getElementById('trilha-nome-sel').value;
  if(!cl||!nm){toast('⛧ Selecione classe e trilha.');return;}
  const c=userChar(currentUser);
  c.trilha={classe:cl,nome:nm};
  saveDB();renderTrilhaAtiva();toast('Trilha salva: '+nm+'.');
}

function renderTrilhaAtiva(){
  const c=userChar(currentUser);
  const disp=document.getElementById('trilha-ativa-display');
  const panel=document.getElementById('trilha-habs-panel');
  const list=document.getElementById('trilha-habs-list');
  const title=document.getElementById('trilha-habs-title');
  if(!c.trilha||!c.trilha.nome){
    disp.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhuma trilha selecionada.</div>';
    panel.style.display='none';return;
  }
  const {classe,nome}=c.trilha;
  const data=TRILHAS_DATA[classe]&&TRILHAS_DATA[classe][nome];
  disp.innerHTML=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <span style="font-family:'Cinzel',serif;font-size:15px;color:var(--crimson-hot)">${nome}</span>
    <span style="font-size:11px;font-family:'Oswald',sans-serif;letter-spacing:.1em;color:var(--white-dust);border:1px solid var(--blood-deep);padding:2px 8px">${classe}</span>
  </div>
  ${data?`<div style="font-size:12px;color:var(--white-ash);margin-top:8px;line-height:1.6;font-family:'IM Fell English',serif;font-style:italic">${data.desc}</div>`:''}`;
  if(!data){panel.style.display='none';return;}
  panel.style.display='';
  title.textContent='Habilidades — '+nome;
  list.innerHTML='';
  if(!c.trilhaHabs) c.trilhaHabs={};
  data.habs.forEach((h,i)=>{
    const unlocked=c.trilhaHabs[i]||false;
    const row=document.createElement('div');
    row.style.cssText='padding:12px 14px;border-bottom:1px solid rgba(58,0,0,0.4);display:flex;gap:12px;align-items:flex-start';
    row.innerHTML=`
      <div style="flex-shrink:0;text-align:center;min-width:48px">
        <div style="font-size:9px;font-family:'Oswald',sans-serif;letter-spacing:.1em;color:var(--crimson);margin-bottom:3px">NEX</div>
        <div style="font-size:14px;font-family:'Cinzel Decorative',serif;color:${unlocked?'var(--gold-light)':'var(--white-dust)'}">${h.nex}</div>
      </div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:${unlocked?'var(--crimson-hot)':'var(--white-bone)'};margin-bottom:4px">${h.nome}</div>
        <div style="font-size:12px;color:var(--white-ash);line-height:1.6">${h.desc}</div>
      </div>
      <button class="btn-add" style="font-size:10px;padding:5px 10px;border-color:${unlocked?'var(--crimson)':'var(--blood-deep)'};color:${unlocked?'var(--crimson-hot)':'var(--white-dust)'};flex-shrink:0" onclick="toggleTrilhaHab(${i})">${unlocked?'✓ Desbloqueado':'Desbloquear'}</button>`;
    list.appendChild(row);
  });
}

function toggleTrilhaHab(i){
  const c=userChar(currentUser);
  if(!c.trilhaHabs) c.trilhaHabs={};
  c.trilhaHabs[i]=!c.trilhaHabs[i];
  renderTrilhaAtiva();saveDB();
}

function loadTrilhaSelects(){
  const c=userChar(currentUser);
  if(!c.trilha) return;
  const clSel=document.getElementById('trilha-classe-sel');
  if(clSel&&c.trilha.classe){
    clSel.value=c.trilha.classe;
    renderTrilhasOpts();
    const nmSel=document.getElementById('trilha-nome-sel');
    if(nmSel&&c.trilha.nome) nmSel.value=c.trilha.nome;
    renderTrilhaAtiva();
  }
}

/* ══════════════════════════════════════════════
   RITUAIS
══════════════════════════════════════════════ */
const ELEM_COR = {Sangue:'#cc1111',Morte:'#555566',Energia:'#9933cc',Conhecimento:'#c8a000',Medo:'#1155aa'};
const ELEM_ICO = {
  Sangue:'<span class="sym-el sym-sangue sym-elem-icon" title="Sangue"></span>',
  Morte:'<span class="sym-el sym-morte sym-elem-icon" title="Morte"></span>',
  Energia:'<span class="sym-el sym-energia sym-elem-icon" title="Energia"></span>',
  Conhecimento:'<span class="sym-el sym-conhecimento sym-elem-icon sym-elem-icon--conhecimento" title="Conhecimento"></span>',
  Medo:'<span class="sym-el sym-medo sym-elem-icon sym-elem-icon--medo" title="Medo"></span>'
};
const RITUAIS_DB = [
  // ══════════════════ 1º CÍRCULO ══════════════════
  // ── Sangue ──
  {nome:'Armadura de Sangue',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Seu sangue escorre para fora do corpo, cobrindo-o sob a forma de uma carapaça que fornece +5 em Defesa. Bônus cumulativo com outros rituais, mas não com bônus de equipamentos.',disc:'(+5 PE, 3º círculo) Muda o efeito para +10 na Defesa e resistência balística, corte, impacto e perfuração 5.',verd:'(+9 PE, 4º círculo, afinidade) +15 na Defesa e resistência balística, corte, impacto e perfuração 10.'},
  {nome:'Arma Atroz',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 arma corpo a corpo',dur:'Sustentada',resist:'—',pe:2,efeito:'A arma é recoberta por veias carmesim e exala aura de violência. Fornece +2 em testes de ataque e +1 na margem de ameaça.',disc:'(+2 PE, 2º círculo) Muda o bônus para +5 em testes de ataque.',verd:'(+5 PE, 3º círculo, afinidade) Muda o bônus para +2 na margem de ameaça e no multiplicador de crítico.'},
  {nome:'Corpo Adaptado',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 pessoa ou animal',dur:'Cena',resist:'—',pe:2,efeito:'Modifica a biologia do alvo para sobreviver em ambientes hostis. Fica imune a calor e frio extremo, pode respirar na água (ou ar) e não sufoca em fumaça densa.',disc:'(+2 PE, 2º círculo) Muda a duração para 1 dia.',verd:'(+5 PE) Muda o alcance para Curto e o alvo para pessoas ou animais escolhidos.'},
  {nome:'Fortalecimento Sensorial',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Potencializa os sentidos: +1d20 em Investigação, Luta, Percepção e Pontaria.',disc:'(+2 PE, 2º círculo) Além do normal, seus inimigos sofrem –1d20 em testes de ataque contra você.',verd:'(+5 PE, 4º círculo, afinidade) Imune às condições Surpreso e Desprevenido; +10 em Defesa e Reflexos.'},
  {nome:'Ódio Incontrolável',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 pessoa',dur:'Cena',resist:'—',pe:2,efeito:'O alvo entra em frenesi: +2 em testes de ataque e dano corpo a corpo, resistência a balístico/corte/impacto/perfuração 5. Não pode usar Furtividade nem rituais; deve atacar sempre que puder.',disc:'(+2 PE, 2º círculo) Além do normal, ao usar ação Agredir pode fazer um ataque corpo a corpo adicional contra o mesmo alvo.',verd:'(+5 PE, 3º círculo, afinidade) Bônus sobe para +5 em ataque e dano; o alvo sofre apenas metade de dano de corte, impacto, balístico e perfuração.'},
  {nome:'Vidência',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Longo (visão)',alvo:'1 local ou alvo',dur:'Cena',resist:'—',pe:2,efeito:'Permite observar e ouvir um local ou alvo à distância, desde que você o conheça ou tenha um objeto ligado a ele.',disc:'(+2 PE, 2º círculo) Pode mover o ponto de visão pelo local.',verd:'(+5 PE, 3º círculo, afinidade) Também pode interagir telepaticamente com quem está no local.'},
  {nome:'Perfurar Pele',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude parcial',pe:2,efeito:'Sigilos de sangue perfuram a pele do alvo de dentro para fora: 2d6+2 de dano de Sangue. Se falhar, o alvo sangra (–1 PV por rodada até receber cuidados).',disc:'(+2 PE, 2º círculo) Dano sobe para 4d6+4 e o sangramento é –2 PV por rodada.',verd:'(+5 PE, 3º círculo, afinidade) Dano 6d6+6; o alvo sangra independente da resistência.'},
  {nome:'Distorcer Aparência',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'Vontade (desacredita)',pe:2,efeito:'Altera sua aparência física para se passar por outra pessoa, ajustando altura, peso, cor de pele, cabelo, voz e até impressão digital.',disc:'(+2 PE, 2º círculo) Duração aumenta para 1 dia.',verd:'(+5 PE, 3º círculo) Pode copiar a aparência de uma pessoa que você conhece ou tenha visto recentemente com precisão total.'},
  // ── Morte ──
  {nome:'Cicatrização',elem:'Morte',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Instantânea',resist:'—',pe:2,efeito:'Acelera o tempo ao redor das feridas. O alvo recupera 3d8+3 PV, mas envelhece 1 ano automaticamente.',disc:'(+2 PE, 2º círculo) Aumenta a cura para 5d8+5 PV.',verd:'(+9 PE, 4º círculo, afinidade) Muda o alcance para Curto, o alvo para seres escolhidos e a cura para 7d8+7 PV.'},
  {nome:'Decadência',elem:'Morte',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude (reduz à metade)',pe:2,efeito:'Espirais de trevas envolvem sua mão e definhám o alvo: 2d8+2 de dano de Morte.',disc:'(+2 PE, 2º círculo) Muda a resistência para nenhuma e o dano para 3d8+3. Como parte da execução, transfere as espirais para uma arma e faz ataque corpo a corpo — se acertar, causa dano da arma + ritual somados.',verd:'(+5 PE, 3º círculo) Muda o alcance para pessoal, alvo para área: explosão com 6m de raio e dano para 8d8+8.'},
  {nome:'Definhar',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:2,efeito:'Lufada de cinzas drena as forças do alvo. O alvo fica Fatigado. Se passar na resistência, fica Vulnerável em vez disso.',disc:'(+2 PE, 2º círculo) Em vez do normal, o alvo fica Exausto. Se passar na resistência, fica Fatigado.',verd:'(+5 PE, 3º círculo, afinidade) Como discente, mas muda o alvo para até 5 seres.'},
  {nome:'Espirais da Perdição',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'—',pe:2,efeito:'Espirais surgem no corpo do alvo, tornando seus movimentos lentos. O alvo sofre –1d20 em testes de ataque.',disc:'(+2 PE, 2º círculo) Muda a penalidade para –2d20.',verd:'(+5 PE, 3º círculo, afinidade) Muda a penalidade para –2d20 e o alvo para seres escolhidos.'},
  {nome:'Nuvem de Cinzas',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'Nuvem 6m de raio, 6m de altura',dur:'Cena',resist:'—',pe:2,efeito:'Nuvem de fuligem espessa obscurece a visão. Seres a até 1,5m têm camuflagem; seres a partir de 3m têm camuflagem total. Vento forte dispersa em 4 rodadas; vendaval em 1.',disc:'(+2 PE, 2º círculo) Você pode escolher seres ao conjurar; eles enxergam através do efeito.',verd:'(+5 PE, 3º círculo, afinidade) A nuvem fica espessa e quase sólida. Qualquer ser dentro tem deslocamento reduzido a 3m e sofre –2 em testes de ataque.'},
  {nome:'Lentidão Concentrada',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:2,efeito:'Fluxo de entropia desacelera o alvo. O alvo fica com deslocamento reduzido à metade e sofre –2 em Reflexos. Se passar na resistência, apenas –1 em Reflexos.',disc:'(+2 PE, 2º círculo) O alvo também sofre –1d20 em testes de ataque.',verd:'(+5 PE, 3º círculo) Muda o alvo para até 3 seres; efeito completo sem resistência.'},
  {nome:'Garras do Abismo',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Reflexos parcial',pe:2,efeito:'Mãos esqueléticas surgem do chão e tentam prender o alvo: o alvo fica Imobilizado. Se passar na resistência, apenas Lento por 1 rodada.',disc:'(+2 PE, 2º círculo) As garras causam também 2d6 de dano de Morte por rodada que o alvo permanecer Imobilizado.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para área: explosão de 6m de raio; afeta todos os seres na área.'},
  // ── Energia ──
  {nome:'Amaldiçoar Tecnologia',elem:'Energia',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 acessório ou arma de fogo',dur:'Cena',resist:'—',pe:2,efeito:'Infunde o objeto com energia caótica. Armas de fogo têm munição amaldiçoada — causam dano adicional ao atirador em vez do alvo. Acessórios eletrônicos passam a funcionar de forma errática e prejudicial.',disc:'(+2 PE, 2º círculo) O objeto passa a causar dano direto a quem o empunhar a cada uso.',verd:'(+5 PE, 3º círculo, afinidade) O objeto explode no próximo uso, causando 4d6 de dano de Energia em área de 3m de raio.'},
  {nome:'Coincidência Forçada',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'—',pe:2,efeito:'Manipula os caminhos do caos para que o alvo tenha mais sorte: +2 em testes de perícias.',disc:'(+2 PE, 2º círculo) Muda o alvo para aliados à sua escolha.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para aliados à sua escolha e o bônus para +5.'},
  {nome:'Eletrocussão',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser ou objeto',dur:'Instantânea',resist:'Fortitude parcial',pe:2,efeito:'Dispara corrente elétrica: 3d6 de dano de Energia e o alvo fica Vulnerável por 1 rodada. Se passar: metade do dano sem condição. Contra objetos eletrônicos: dobro de dano, ignora resistência.',disc:'(+2 PE, 2º círculo) Muda o alvo para área: linha de 30m. Raio causa 6d6 de dano de Energia em todos os seres e objetos livres na área.',verd:'(+5 PE, 3º círculo, afinidade) Muda a área para alvos escolhidos; dispara vários relâmpagos, um por alvo, causando 8d6 de Energia cada.'},
  {nome:'Embaralhar',elem:'Energia',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Cria 3 cópias ilusórias suas — hologramas realistas que imitam suas ações. Você recebe +6 na Defesa. A cada ataque errado, uma cópia desaparece e o bônus cai em 2.',disc:'(+2 PE, 2º círculo) Muda o número de cópias para 5 (bônus na Defesa +10).',verd:'(+5 PE, 3º círculo, afinidade) 8 cópias (+16 na Defesa). Toda vez que uma cópia é destruída, emite clarão — o atacante fica Ofuscado por 1 rodada.'},
  {nome:'Maré de Azar',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:2,efeito:'Um azar paranormal atinge o alvo: –2 em todos os seus testes. Se passar na resistência, apenas –1.',disc:'(+2 PE, 2º círculo) Muda a penalidade para –5 (resistência: –2).',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para todos os seres hostis em alcance curto; penalidade –5.'},
  {nome:'Barreira Energética',elem:'Energia',circ:1,exec:'Reação',alcance:'Curto',alvo:'Você e aliados escolhidos',dur:'1 rodada',resist:'—',pe:2,efeito:'Cria uma parede invisível de energia que bloqueia ataques. Você e os aliados escolhidos recebem resistência 10 contra o próximo ataque físico.',disc:'(+2 PE, 2º círculo) A resistência aumenta para 15 e dura até o início do seu próximo turno.',verd:'(+5 PE, 3º círculo, afinidade) Resistência 20; qualquer ataque bloqueado pela barreira causa 2d6 de dano de Energia de volta ao atacante.'},
  {nome:'Tela de Ruído',elem:'Energia',circ:1,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:2,efeito:'Cria uma película de energia ao redor do corpo que absorve energia cinética. Recebe 30 PV temporários, mas apenas contra dano balístico, corte, impacto ou perfuração. Pode ser usado como reação ao sofrer dano: recebe resistência 15 apenas contra aquele dano.',disc:'(+2 PE) PV temporários aumentam para 45.',verd:'(+5 PE, 3º círculo, afinidade) PV temporários 60; dura toda a cena.'},
  {nome:'Forma Fantasmagórica',elem:'Energia',circ:1,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'1 rodada',resist:'—',pe:2,efeito:'Seu corpo se torna temporariamente imaterial. Você passa a ignorar obstáculos físicos, atravessa paredes e é imune a dano físico (mas não paranormal) por 1 rodada. Pode levar 1 aliado consigo se tocá-lo.',disc:'(+2 PE, 2º círculo) A duração aumenta para o dobro de rodadas.',verd:'(+5 PE, 3º círculo) Pode levar todos os aliados em alcance curto e a duração aumenta para a cena toda.'},
  {nome:'Salto Fantasma',elem:'Energia',circ:2,exec:'Movimento',alcance:'Longo',alvo:'Você',dur:'Instantânea',resist:'—',pe:4,efeito:'Seu corpo se transforma em Energia pura e viaja instantaneamente para um ponto que você possa ver dentro do alcance. Você pode levar 1 aliado consigo.',disc:'(+3 PE) Pode alcançar qualquer ponto que você conheça, mesmo que não possa ver.',verd:'(+5 PE, 3º círculo, afinidade) Pode levar todos os aliados em alcance curto; pode ser usado como reação.'},
  // ── Conhecimento ──
  {nome:'Ouvir Sussurros',elem:'Conhecimento',circ:1,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:2,efeito:'Conecta-se com os sussurros — memórias ecoando pelo Outro Lado. Você pode fazer uma pergunta sobre um evento futuro próximo; o Mestre responde com "sim", "não" ou "sim e não".',disc:'(+2 PE, 2º círculo) A pergunta pode ser sobre um evento futuro de até 1 dia.',verd:'(+5 PE, 3º círculo, afinidade) Pode fazer uma pergunta sobre qualquer coisa que o Outro Lado saiba, com resposta direta do Mestre.'},
  {nome:'Enfeitiçar',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade anula',pe:2,efeito:'O alvo percebe suas palavras de forma favorável. Você recebe +10 em testes de Diplomacia com ele. Qualquer ação hostil sua ou de aliados dissipa o efeito.',disc:'(+2 PE, 2º círculo) Em vez do normal, você sugere uma ação ao alvo; ele obedece se parecer aceitável ao Mestre. Ao executar, o efeito termina.',verd:'(+5 PE, 3º círculo, afinidade) Afeta todos os alvos dentro do alcance.'},
  {nome:'Detetizar',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Médio',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Rituais ativos, itens amaldiçoados e criaturas paranormais emitem auras visíveis. Você sabe o elemento e a intensidade (fraca/moderada/poderosa). Como ação de movimento, sabe se um ser em alcance médio tem poderes paranormais.',disc:'(+2 PE, 2º círculo) Duração aumenta para 1 dia.',verd:'(+5 PE, 3º círculo) Você pode enxergar seres e objetos invisíveis como formas translúcidas.'},
  {nome:'Leitura Psíquica',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 objeto',dur:'Instantânea',resist:'—',pe:2,efeito:'Ao tocar um objeto, você recebe flashes de memórias e emoções de quem o manipulou recentemente. O Mestre fornece uma visão vaga sobre o objeto ou seu dono.',disc:'(+2 PE, 2º círculo) As visões são mais claras e detalhadas, incluindo contexto e localização.',verd:'(+5 PE, 3º círculo, afinidade) Pode tocar uma pessoa e ler seus pensamentos superficiais atuais.'},
  {nome:'Eco do Passado',elem:'Conhecimento',circ:1,exec:'Completa',alcance:'Pessoal',alvo:'1 local',dur:'Instantânea',resist:'—',pe:2,efeito:'Você chama memórias traumáticas do local, vendo um evento do passado como um eco espectral. O Mestre descreve uma cena relevante ocorrida no local.',disc:'(+2 PE, 2º círculo) Pode escolher o tipo de evento (violência, ritual, morte, etc.) que quer visualizar.',verd:'(+5 PE, 3º círculo, afinidade) Pode reviver o evento como se estivesse presente — percebendo detalhes e identidades.'},
  {nome:'Chiados Internos',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:2,efeito:'Sons paranormais perturbam a mente do alvo: ele fica Confuso e sofre –2 em todos os testes. Se passar na resistência, apenas Confuso por 1 rodada.',disc:'(+2 PE, 2º círculo) Além do normal, o alvo tem 50% de chance de atingir um aliado aleatório em vez do alvo pretendido.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para até 3 seres; duração cena para todos que falharem.'},
  {nome:'Camuflagem',elem:'Conhecimento',circ:2,exec:'Livre',alcance:'Pessoal',alvo:'Você',dur:'1 rodada',resist:'—',pe:4,efeito:'Você fica invisível (incluindo equipamento), recebe camuflagem total e +15 em testes de Furtividade. O efeito termina se você fizer um ataque ou usar habilidade hostil.',disc:'(+3 PE) Duração aumenta para 3 rodadas.',verd:'(+5 PE, 3º círculo, afinidade) Duração aumenta para a cena; ataques à distância não dissipam o efeito — apenas ataques corpo a corpo.'},
  // ── Medo ──
  {nome:'Cinerária',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'Nuvem 6m de raio',dur:'Cena',resist:'—',pe:2,efeito:'Névoa de essência paranormal carregada: rituais conjurados dentro dela têm DT +5.',disc:'(+2 PE, 2º círculo) Além do normal, rituais conjurados dentro da névoa custam –2 PE.',verd:'(+5 PE, 3º círculo, afinidade) Além do normal, rituais conjurados dentro da névoa causam dano maximizado.'},
  {nome:'Pavor Anormal',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:2,efeito:'Inocula o terror paranormal no alvo: ele fica Abalado e sofre –2 em testes. Se passar na resistência, apenas Abalado por 1 rodada.',disc:'(+2 PE, 2º círculo) Falha: alvo fica Apavorado (cena inteira); sucesso: Abalado.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para todos os seres hostis em alcance curto; falha: Apavorados.'},
  {nome:'Invocar Névoa',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'Área 9m de raio',dur:'Cena',resist:'—',pe:2,efeito:'Uma névoa densa e fantasmagórica emerge, cobrindo a área. Todos dentro têm camuflagem. Seres com Medo alto ficam Abalados ao entrar na névoa.',disc:'(+2 PE, 2º círculo) A névoa pode ser movida pelo conjurador com ação de movimento.',verd:'(+5 PE, 3º círculo) A névoa persiste até o fim da missão e causa 2d6 de dano mental por rodada a quem permanecer dentro.'},
  {nome:'Pronunciar Sigilo',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Instantânea',resist:'Vontade parcial',pe:2,efeito:'Pronuncia um sigilo do Outro Lado que drena a Sanidade do alvo: o alvo perde 1d6 de Sanidade. Se passar na resistência, perde apenas 1d3.',disc:'(+2 PE, 2º círculo) O dano aumenta para 2d6 (resistência: 1d6).',verd:'(+5 PE, 3º círculo, afinidade) Dano 3d8 de Sanidade; o alvo fica Apavorado se falhar (resistência: Abalado).'},
  // ══════════════════ 2º CÍRCULO ══════════════════
  // ── Sangue ──
  {nome:'Invólucro de Carne',elem:'Sangue',circ:2,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:4,efeito:'Cria um clone de carne e sangue com as mesmas estatísticas do usuário. O clone pode conjurar rituais e age no seu turno.',disc:'(+4 PE, 3º círculo) O clone age de forma independente no turno do conjurador.',verd:'(+8 PE, 4º círculo, afinidade) O clone possui PV dobrados e age em turno próprio.'},
  {nome:'Purgatório',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'Cena',resist:'Reflexos parcial',pe:4,efeito:'Área impregnada de sangue paranormal: alvos que entrem ficam Vulneráveis a dano e sofrem 2d6 de dano se tentarem sair. Se passar na resistência, o dano é reduzido à metade.',disc:'(+3 PE, 3º círculo) O dano ao sair aumenta para 4d6 e alvos dentro sofrem –2 em todos os testes.',verd:'(+6 PE, 4º círculo, afinidade) A área dobra; quem entrar ou tentar sair fica Imobilizado (Reflexos evita).'},
  {nome:'Vomitar Pestes',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'2 rodadas',resist:'Fortitude parcial',pe:4,efeito:'Vomita enxame de criaturas parasitas de Sangue. Alvos na área sofrem 3d6 de dano e ficam Perturbados. Resistência: metade do dano, sem condição.',disc:'(+3 PE, 3º círculo) O enxame persiste por mais 2 rodadas.',verd:'(+6 PE, 4º círculo) O enxame cobre área de 12m e o dano dobra.'},
  {nome:'Mergulho Mental',elem:'Sangue',circ:2,exec:'Completa',alcance:'Toque',alvo:'1 ser inconsciente ou consentindo',dur:'Cena',resist:'Vontade anula',pe:4,efeito:'Infiltra-se na mente do alvo para vasculhar pensamentos e memórias recentes (últimas 24h). O Mestre fornece informações relevantes.',disc:'(+3 PE) Pode alterar ou apagar memórias recentes do alvo.',verd:'(+6 PE, 4º círculo, afinidade) Pode implantar memórias falsas detalhadas que o alvo acredita plenamente.'},
  {nome:'Flagelo de Sangue',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:4,efeito:'O sangue do alvo começa a entrar em ebulição por dentro, causando 4d8 de dano de Sangue. Se passar na resistência, o dano é reduzido à metade.',disc:'(+3 PE) Dano aumenta para 6d8.',verd:'(+6 PE, 3º círculo, afinidade) Dano 8d8; o alvo fica Vulnerável por toda a cena, independente da resistência.'},
  // ── Morte ──
  {nome:'Apodrecer',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude parcial',pe:4,efeito:'Acelera o envelhecimento dos órgãos internos: 2d8+2 de dano de Morte.',disc:'(+2 PE) Dano aumenta para 4d8+4.',verd:'(+5 PE, 3º círculo, afinidade) Dano 6d8+6; sem resistência.'},
  {nome:'Zerar Entropia',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:4,efeito:'O alvo fica imobilizado pela entropia. Se falhar: Imobilizado. Se passar: Lento (–1d20 em testes de ataque e Defesa reduzida).',disc:'(+3 PE, 3º círculo) Afeta até 3 seres.',verd:'(+6 PE, 4º círculo, afinidade) O alvo fica Paralisado sem resistência.'},
  {nome:'Poeira da Podridão',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'3 rodadas',resist:'Fortitude parcial',pe:4,efeito:'Nuvem de poeira paranormal que apodrece tudo que toca. Seres na área sofrem 3d6 de dano de Morte por rodada.',disc:'(+3 PE) Dano aumenta para 5d6 por rodada.',verd:'(+6 PE, 3º círculo, afinidade) Duração aumenta para 5 rodadas e dano sobe para 6d6 por rodada.'},
  {nome:'Tentáculos de Lodo',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'Cena',resist:'Reflexos parcial',pe:4,efeito:'Tentáculos negros de podridão brotam do chão, atacando e agarrando seres na área: 2d8 de dano de Morte e ficam Imobilizados. Resistência: apenas dano, sem condição.',disc:'(+3 PE) Os tentáculos também arrastam alvos agarrados para o centro da área.',verd:'(+6 PE, 4º círculo) Os tentáculos também atacam como reação sempre que alguém passar pela área.'},
  {nome:'Possessão',elem:'Morte',circ:2,exec:'Completa',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade anula',pe:4,efeito:'Você projeta sua consciência para o corpo de outra pessoa. Você passa a controlar o alvo completamente enquanto seu próprio corpo fica inconsciente e vulnerável.',disc:'(+3 PE) Pode possuir qualquer ser que você conheça, independente da distância.',verd:'(+6 PE, 3º círculo, afinidade) Pode possuir e controlar até 2 seres ao mesmo tempo.'},
  // ── Energia ──
  {nome:'Explosão Caótica',elem:'Energia',circ:2,exec:'Padrão',alcance:'Médio',alvo:'Área 6m de raio',dur:'Instantânea',resist:'Reflexos parcial',pe:4,efeito:'Explosão de energia caótica: 4d6+4 de dano de Energia. Se passar na resistência, metade do dano.',disc:'(+3 PE, 3º círculo) Dano sobe para 6d8.',verd:'(+6 PE, 3º círculo, afinidade) Dano 8d8; alvos que falharem ficam Atordoados por 1 rodada.'},
  {nome:'Convocação Instantânea',elem:'Energia',circ:2,exec:'Reação',alcance:'Ilimitado',alvo:'1 objeto marcado',dur:'Instantânea',resist:'—',pe:4,efeito:'Teletransporta um objeto previamente marcado para suas mãos, independente da distância.',disc:'(+2 PE) Pode marcar o objeto durante a execução do ritual.',verd:'(+5 PE, 3º círculo) Pode teletransportar qualquer objeto que você possa ver dentro de alcance médio.'},
  {nome:'Esfera do Caos',elem:'Energia',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser ou área 3m de raio',dur:'Instantânea',resist:'Reflexos parcial',pe:4,efeito:'Gera um ataque elemental caótico que alterna entre diferentes elementos aleatoriamente: role 1d6 (1=fogo, 2=gelo, 3=eletricidade, 4=ácido, 5=sônico, 6=escolha) causando 5d6 de dano.',disc:'(+3 PE) Você pode escolher o elemento em vez de rolar aleatoriamente.',verd:'(+6 PE, 3º círculo, afinidade) Dano aumenta para 8d8 e você pode combinar dois elementos.'},
  {nome:'Deflagração de Energia',elem:'Energia',circ:2,exec:'Completa',alcance:'Longo',alvo:'Área 9m de raio',dur:'Instantânea',resist:'Reflexos parcial',pe:4,efeito:'Acumula energia imensa e a libera de uma vez em uma explosão colossal: 6d10 de dano de Energia.',disc:'(+4 PE, 3º círculo) Dano aumenta para 9d10.',verd:'(+8 PE, 4º círculo, afinidade) Dano 12d10; a área dobra e estruturas físicas na área podem ser destruídas.'},
  {nome:'Contenção Fantasmagórica',elem:'Energia',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Reflexos parcial',pe:4,efeito:'Laços de energia translúcida prendem o alvo: ele fica Imobilizado. Se passar na resistência, fica apenas Lento por 2 rodadas.',disc:'(+3 PE) Os laços causam também 2d6 de dano de Energia por rodada.',verd:'(+6 PE, 3º círculo, afinidade) Muda o alvo para até 3 seres em alcance médio.'},
  // ── Conhecimento ──
  {nome:'Aurora da Verdade',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Esfera 3m de raio',dur:'Sustentada',resist:'Vontade parcial',pe:4,efeito:'Luz espectral dourada surge na área. Qualquer ser dentro é obrigado a falar só a verdade, inclusive o conjurador. Se passar na resistência, pode mentir (mas pode ser percebido com Intuição). Seres invisíveis ou em camuflagem dentro da luz são revelados por sigilos brilhantes.',disc:'(+3 PE) Muda o alcance para médio, área para esfera de 9m de raio; o conjurador não é afetado.',verd:'(+7 PE) Como discente, mas alcance longo e duração cena.'},
  {nome:'Aprimorar Mente',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Cena',resist:'—',pe:4,efeito:'A mente do alvo é energizada: +2 em testes de Intelecto, Investigação, Ciências, Tecnologia e Ocultismo.',disc:'(+3 PE) Bônus sobe para +5.',verd:'(+6 PE, 3º círculo, afinidade) Além do normal, concede +2 em número de rituais e +2 na DT dos rituais do alvo.'},
  {nome:'Relembrar Fragmento',elem:'Conhecimento',circ:2,exec:'Completa',alcance:'Toque',alvo:'1 objeto danificado ou corrompido',dur:'Instantânea',resist:'—',pe:4,efeito:'Lê ou recupera informações de documentos, objetos ou mídias danificados ou destruídos.',disc:'(+3 PE) Pode recuperar informações de objetos completamente destruídos.',verd:'(+6 PE, 4º círculo) Pode recuperar memórias de uma pessoa falecida tocando seus restos mortais.'},
  {nome:'Paraíso Maldito',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Vontade anula',pe:4,efeito:'Coloca o alvo em uma ilusão poderosa de realidade alternativa. O alvo fica Incapacitado e completamente alheio ao mundo real.',disc:'(+3 PE) A ilusão dura até o alvo ser fisicamente atacado.',verd:'(+6 PE, 3º círculo) Afeta até 3 alvos ao mesmo tempo.'},
  {nome:'Eco Traumático',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:4,efeito:'Força o alvo a reviver sua maior memória traumática. O alvo perde 2d8 de Sanidade e fica Abalado. Se passar, perde 1d8 de Sanidade.',disc:'(+3 PE) A perda de Sanidade sobe para 3d8 (resistência: 1d8); o alvo fica Apavorado se falhar.',verd:'(+6 PE, 3º círculo, afinidade) O alvo revive o trauma físicamente: recebe dano igual à perda de Sanidade e fica Incapacitado por 1 rodada.'},
  {nome:'Ligação Telepática',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Até 4 seres consentindo',dur:'1 dia',resist:'—',pe:4,efeito:'Cria um elo mental entre os alvos, permitindo comunicação telepática silenciosa a qualquer distância. Como ação de movimento, pode ver/ouvir pelos sentidos de um aliado ligado.',disc:'(+3 PE) Alvos involuntários podem ser incluídos (resistência: Vontade anula); como ação de movimento pode perceber os pensamentos superficiais de qualquer ser ligado.',verd:'(+5 PE, 3º círculo) Conecta até 10 seres; dura a missão inteira.'},
  {nome:'Localização',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:4,efeito:'Você localiza uma pessoa ou objeto que conhece, recebendo direção e distância aproximada se estiver no mesmo plano. Exige uma imagem mental precisa para objetos; falhas ainda consomem PE. Bloqueado por camadas de chumbo.',disc:'(+3 PE) O alvo descobre o caminho mais direto para entrar ou sair de um local (não localiza pessoas).',verd:'(+5 PE, 3º círculo, afinidade) Localiza qualquer ser ou objeto no mesmo plano, mesmo sem imagem mental — apenas o nome ou descrição.'},
  // ── Medo ──
  {nome:'Dissipar Ritual',elem:'Medo',circ:2,exec:'Reação',alcance:'Médio',alvo:'1 ser ou área',dur:'Instantânea',resist:'—',pe:4,efeito:'Cancela os efeitos de um ritual ativo em um alvo ou área. O PE gasto é referente ao custo deste ritual, não do dissipado.',disc:'(+3 PE) Pode dissipar dois rituais simultâneos.',verd:'(+6 PE, 3º círculo, afinidade) Dissipa todos os rituais ativos em uma área de 9m de raio.'},
  {nome:'Selo do Outro Lado',elem:'Medo',circ:2,exec:'Padrão',alcance:'Toque',alvo:'1 local ou objeto',dur:'1 dia',resist:'—',pe:4,efeito:'Cria uma marca paranormal que impede a conjuração de rituais na área ou objeto marcado.',disc:'(+3 PE) A duração aumenta para 1 semana.',verd:'(+6 PE, 3º círculo) Também impede o uso de poderes paranormais na área marcada.'},
  {nome:'Vozes do Vazio',elem:'Medo',circ:2,exec:'Padrão',alcance:'Médio',alvo:'Área 12m de raio',dur:'Cena',resist:'Vontade parcial',pe:4,efeito:'Palavras indecifráveis do Outro Lado confundem os sentidos dos alvos. Se falharem: Abalados e –2 em todos os testes. Se passarem: apenas Abalados.',disc:'(+3 PE, 3º círculo) Falha: Apavorados; sucesso: Abalados.',verd:'(+6 PE, 4º círculo, afinidade) Falha: Apavorados e Atordoados; sucesso: Apavorados.'},
  {nome:'Ilusão',elem:'Medo',circ:2,exec:'Padrão',alcance:'Médio',alvo:'Área 6m de raio',dur:'Sustentada',resist:'Vontade (desacredita)',pe:4,efeito:'Cria uma ilusão visual ou sonora complexa que parece real a todos na área. Seres que interagirem com a ilusão têm direito a um teste de resistência para desacreditarem.',disc:'(+3 PE) A ilusão pode incluir temperatura, cheiro e textura.',verd:'(+6 PE, 3º círculo, afinidade) A ilusão causa dano real (3d6 de dano mental) a quem acreditar nela.'},
  // ══════════════════ 3º CÍRCULO ══════════════════
  // ── Sangue ──
  {nome:'Manto das Sombras',elem:'Sangue',circ:3,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:6,efeito:'Cria um manto de sombras ao redor. Você recebe Camuflagem Total e +5 em testes de Furtividade.',disc:'(+4 PE) Aliados em alcance curto também recebem Camuflagem.',verd:'(+8 PE, 4º círculo, afinidade) Você e aliados em alcance curto ficam completamente Invisíveis até que ataquem.'},
  {nome:'Erodir Conhecimento',elem:'Sangue',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:6,efeito:'Drena o conhecimento do alvo. Se falhar: perde 1d4 rituais aprendidos temporariamente e sofre –5 em Intelecto. Se passar: apenas –3 em Intelecto.',disc:'(+4 PE) A perda de rituais é permanente até o fim da missão.',verd:'(+8 PE, 4º círculo) Afeta até 3 alvos simultaneamente.'},
  {nome:'Contágio de Sangue',elem:'Sangue',circ:3,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Cena',resist:'Fortitude parcial',pe:6,efeito:'Transmite uma infecção paranormal ao alvo: sofre 3d8 de dano de Sangue por rodada. Se passar na resistência, o dano é 1d8 por rodada.',disc:'(+4 PE) O alvo também fica Vulnerável a dano por toda a cena.',verd:'(+8 PE, 4º círculo, afinidade) O contágio se espalha para seres em contato com o alvo.'},
  // ── Morte ──
  {nome:'Invocar Morto-Vivo',elem:'Morte',circ:3,exec:'Completa',alcance:'Toque',alvo:'1 cadáver',dur:'Cena',resist:'—',pe:6,efeito:'Anima um cadáver como morto-vivo controlado com VD igual a metade do original. Age no seu turno conforme seus comandos.',disc:'(+4 PE) O morto-vivo tem o VD completo do original.',verd:'(+8 PE, 4º círculo, afinidade) Pode animar até 3 cadáveres simultaneamente.'},
  {nome:'Derreter Sangue',elem:'Morte',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude parcial',pe:6,efeito:'Aquece o sangue do alvo de dentro para fora: 5d8+5 de dano de Morte. Se falhar, o alvo fica Incapacitado por 1 rodada.',disc:'(+4 PE) Dano sobe para 8d8+8.',verd:'(+8 PE, 4º círculo) Sem resistência; afeta até 3 alvos adjacentes.'},
  {nome:'Sugada Mortal',elem:'Morte',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Instantânea',resist:'Vontade parcial',pe:6,efeito:'Drena a força vital do alvo: ele sofre 4d8 de dano de Morte e você recupera metade como PV.',disc:'(+4 PE) Você recupera PV iguais a todo o dano causado.',verd:'(+8 PE, 4º círculo, afinidade) Drena também PE e Sanidade do alvo, recuperando metade para você.'},
  // ── Energia ──
  {nome:'Milagre Ionizante',elem:'Energia',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Instantânea',resist:'Reflexos parcial',pe:6,efeito:'Descarga de energia ionizante massiva: 6d8 de dano de Energia. O alvo fica Atordoado por 1 rodada se falhar.',disc:'(+4 PE) Dano sobe para 9d8; muda o alvo para área: explosão de 6m.',verd:'(+8 PE, 4º círculo, afinidade) Dano 12d8; afeta toda a área sem resistência.'},
  {nome:'Queimar Distorção',elem:'Energia',circ:3,exec:'Padrão',alcance:'Médio',alvo:'Área 9m de raio',dur:'Instantânea',resist:'Reflexos parcial',pe:6,efeito:'Descarga que queima e distorce a realidade: 5d6 de dano de Energia. Cria Terreno Difícil na área por 2 rodadas.',disc:'(+4 PE) Dano sobe para 8d6; o Terreno Difícil dura toda a cena.',verd:'(+8 PE, 4º círculo) Qualquer ritual conjurado na área durante a próxima rodada falha automaticamente.'},
  {nome:'Rajada Ionizante',elem:'Energia',circ:3,exec:'Padrão',alcance:'Longo',alvo:'Alvos escolhidos',dur:'Instantânea',resist:'Reflexos parcial',pe:6,efeito:'Dispara múltiplos raios de energia, um por alvo escolhido: 10d6 de dano de Energia em cada. Se passar: metade.',disc:'(+4 PE) Dano sobe para 12d6 por alvo.',verd:'(+8 PE, 4º círculo, afinidade) Dano 15d6; os raios voltam ao conjurador e ele pode redispará-los como ação de movimento.'},
  // ── Conhecimento ──
  {nome:'Alterar Memória',elem:'Conhecimento',circ:3,exec:'Completa',alcance:'Toque',alvo:'1 Ser',dur:'Permanente',resist:'Vontade anula',pe:6,efeito:'Apaga ou modifica a memória recente do alvo (até 1 hora). Ele acredita plenamente na versão alterada.',disc:'(+4 PE) Pode alterar memórias de até 1 dia atrás.',verd:'(+8 PE, 4º círculo, afinidade) Pode reescrever memórias de qualquer período da vida do alvo.'},
  {nome:'Contato Paranormal',elem:'Conhecimento',circ:3,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:6,efeito:'Você barganha com uma entidade do Outro Lado para obter ajuda. O Mestre determina o que a entidade oferece e o preço a pagar.',disc:'(+4 PE) O Mestre deve oferecer algo concreto e imediato.',verd:'(+8 PE, 4º círculo, afinidade) Você pode exigir a ajuda sem negociação (mas o preço aumenta significativamente).'},
  {nome:'Dissipar Espíritos',elem:'Conhecimento',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 criatura paranormal',dur:'Instantânea',resist:'Vontade anula',pe:6,efeito:'Dissolve a manifestação de uma criatura paranormal. Se falhar na resistência: a criatura é banida por 1 cena.',disc:'(+4 PE) A criatura é banida permanentemente se falhar.',verd:'(+8 PE, 4º círculo, afinidade) Pode banir até 3 criaturas paranormais ao mesmo tempo.'},
  {nome:'Controle Mental',elem:'Conhecimento',circ:3,exec:'Completa',alcance:'Curto',alvo:'1 Ser',dur:'Cena',resist:'Vontade anula',pe:6,efeito:'A mente do alvo é completamente controlada. Você pode comandá-lo como quiser — ele obedece qualquer ordem, inclusive contra aliados. O alvo não tem memória do período controlado.',disc:'(+4 PE) Pode controlar o alvo mesmo à distância longa.',verd:'(+8 PE, 4º círculo, afinidade) O controle dura 1 dia inteiro e pode ser ativado/desativado à distância.'},
  // ── Medo ──
  {nome:'Manifestação do Terror',elem:'Medo',circ:3,exec:'Completa',alcance:'Médio',alvo:'Área 9m de raio',dur:'Cena',resist:'Vontade parcial',pe:6,efeito:'Manifesta o medo mais profundo de cada ser na área de forma paranormal. Se falharem: Apavorados e perdem 2d6 de Sanidade. Se passarem: Abalados.',disc:'(+4 PE) Falha: Apavorados e Incapacitados por 1 rodada.',verd:'(+8 PE, 4º círculo, afinidade) Falha: Apavorados, Incapacitados e perdem 4d8 de Sanidade.'},
  {nome:'Eco do Medo',elem:'Medo',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Cena',resist:'Vontade parcial',pe:6,efeito:'Transforma o medo interno do alvo em dano real: o alvo sofre dano igual ao seu nível de Medo atual (min. 3d6). Se passar: metade.',disc:'(+4 PE) O dano máximo é dobrado.',verd:'(+8 PE, 4º círculo, afinidade) O medo se espalha: todos em alcance curto do alvo original são afetados.'},
  {nome:'Regeneração do Medo',elem:'Medo',circ:3,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:6,efeito:'Ao receber dano, você o absorve e o converte: recupera PV iguais à metade do dano recebido. Pode ser usado 1 vez por cena.',disc:'(+4 PE) Recupera PV iguais ao dano total recebido.',verd:'(+8 PE, 4º círculo, afinidade) Além de recuperar PV, você libera o excesso como dano de Medo em área de 6m de raio ao seu redor.'},
  // ══════════════════ 4º CÍRCULO ══════════════════
  {nome:'Invocar Demônio',elem:'Morte',circ:4,exec:'Completa (10 min)',alcance:'Pessoal',alvo:'Área 9m de raio',dur:'Cena',resist:'—',pe:10,efeito:'Invoca uma criatura poderosa do Outro Lado que obedece seus comandos. A criatura tem VD alto e habilidades únicas definidas pelo Mestre.',disc:'—',verd:'(+10 PE, afinidade) A criatura invocada tem o dobro de VD e permanece até o fim da missão.'},
  {nome:'Contágio Paranormal',elem:'Sangue',circ:4,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Permanente',resist:'Fortitude anula',pe:10,efeito:'Transmite uma maldição paranormal permanente. O alvo sofre efeitos negativos progressivos definidos pelo Mestre.',disc:'—',verd:'(+10 PE, afinidade) A maldição se espalha para outros seres em contato com o alvo.'},
  {nome:'Colapso da Mente',elem:'Conhecimento',circ:4,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Permanente',resist:'Vontade anula',pe:10,efeito:'Destrói os processos mentais do alvo: Loucura permanente (Medo 35). O alvo perde 2d10 de Sanidade máxima.',disc:'—',verd:'(+10 PE, afinidade) Afeta até 3 alvos; Sanidade máxima perdida sobe para 3d10.'},
  {nome:'Tempestade de Energia',elem:'Energia',circ:4,exec:'Padrão',alcance:'Longo',alvo:'Área 15m de raio',dur:'3 rodadas',resist:'Reflexos parcial',pe:10,efeito:'Invoca tempestade elétrica colossal: 8d10 de dano de Energia por rodada a todos na área. Equipamentos eletrônicos são destruídos.',disc:'—',verd:'(+10 PE, afinidade) A tempestade se move conforme sua vontade e dura toda a cena.'},
  {nome:'Apoteose do Medo',elem:'Medo',circ:4,exec:'Completa',alcance:'Médio',alvo:'Todos os seres na área',dur:'Cena',resist:'Vontade parcial',pe:10,efeito:'Manifesta a essência pura do Medo do Outro Lado. Falha: alvo foge aterrorizado e fica Apavorado toda a cena. Sucesso: Abalado.',disc:'—',verd:'(+10 PE, afinidade) Falha: Apavorados e Incapacitados toda a cena; sucesso: Apavorados.'},
  {nome:'Inexistir',elem:'Conhecimento',circ:4,exec:'Completa',alcance:'Toque',alvo:'1 Ser',dur:'Permanente',resist:'Poder anula',pe:10,efeito:'Apaga completamente um ser da existência. Se o alvo falhar na resistência, ele desaparece como se nunca tivesse existido — inclusive das memórias de outros seres. Custo adicional: 5 PE permanentes.',disc:'—',verd:'(+10 PE, afinidade) O alvo pode fazer um teste de resistência com penalidade de –10. Falha absoluta: existência apagada do registro da Realidade.'},
  {nome:'Drenagem do Medo',elem:'Medo',circ:4,exec:'Padrão',alcance:'Longo',alvo:'Área 12m de raio',dur:'Cena',resist:'Vontade parcial',pe:10,efeito:'Drena o medo de todos os seres na área, absorvendo-o. Você recupera 4d6 de Sanidade e os alvos perdem 4d6 de Sanidade (resistência: metade).',disc:'—',verd:'(+10 PE, afinidade) Você também recupera PV iguais à Sanidade drenada e pode redistribuir a Sanidade para aliados.'},
  // ── Rituais Oficiais Adicionais (Livro v1.3) ──
  // Sangue 1
  {nome:'Hemofagia',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 Ser',dur:'Instantânea',resist:'Fortitude parcial',pe:2,efeito:'Você drena o sangue do alvo, enfraquecendo-o e se fortalecendo. O alvo sofre 2d6 de dano de Sangue e você recupera metade como PV. Se o alvo falhar na resistência, você recupera todos os PV do dano causado.',disc:'(+2 PE, 2º círculo) Além de PV, você também recupera 1d4 PE.',verd:'(+5 PE, 3º círculo, afinidade) Dano sobe para 4d6; você recupera PV e PE iguais ao dano total causado.'},
  // Morte 1
  {nome:'Consumir Manancial',elem:'Morte',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:0,efeito:'Você drena sua própria força vital para conjurar energia. Perde 1d8 PV e recupera PE iguais à metade do dano sofrido (arredondado para cima). Esse ritual não pode ser usado se você estiver Machucado.',disc:'(+2 PE) Além do normal, a recuperação de PE é igual a todo o dano sofrido.',verd:'(+4 PE, 2º círculo) O custo em PV é reduzido a 1d4 e você recupera PE iguais ao dano sofrido + seu Intelecto.'},
  {nome:'Maré do Tempo',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 Ser',dur:'Instantânea',resist:'Vontade parcial',pe:2,efeito:'Acelera o envelhecimento do alvo por um momento: ele sofre –1 em Agilidade e Força até o fim da cena. Se falhar, também fica Lento por 1 rodada.',disc:'(+2 PE, 2º círculo) A penalidade aumenta para –2 em Agilidade e Força.',verd:'(+5 PE, 3º círculo, afinidade) Muda o alvo para até 3 seres; penalidade –2 e duração permanente até curados.'},
  // Conhecimento 1
  {nome:'Barreira Mental',elem:'Conhecimento',circ:1,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:2,efeito:'Cria uma barreira psíquica ao redor de sua mente. Você se torna imune a efeitos de leitura de mente, controle mental e perda de Sanidade pelo próximo ataque que o atingir. Pode ser usado como reação.',disc:'(+2 PE) A barreira dura até o fim da rodada.',verd:'(+5 PE, 3º círculo, afinidade) Você e até 3 aliados em alcance curto ficam imunes a efeitos mentais e de Sanidade por 1 rodada.'},
  {nome:'Sussurro Telepático',elem:'Conhecimento',circ:1,exec:'Livre',alcance:'Longo',alvo:'1 ser que você conheça',dur:'Instantânea',resist:'—',pe:2,efeito:'Você envia uma mensagem mental de até 25 palavras para um ser que você conheça pessoalmente, independente da distância (contanto que esteja no mesmo plano). O alvo ouve claramente em sua mente.',disc:'(+2 PE) O alvo pode responder imediatamente com até 25 palavras.',verd:'(+5 PE, 3º círculo, afinidade) Pode enviar mensagem para até 5 seres conhecidos simultaneamente; eles podem responder ao mesmo tempo.'},
  // Medo 1
  {nome:'Aura de Terror',elem:'Medo',circ:1,exec:'Padrão',alcance:'Curto',alvo:'Área 6m de raio',dur:'Cena',resist:'Vontade parcial',pe:2,efeito:'Você irradia uma aura de medo paranormal. Seres hostis que entrem na área ficam Abalados enquanto permanecerem nela. Se falharem na resistência, ficam Apavorados por 1 rodada ao entrar.',disc:'(+2 PE) Além do normal, seres Abalados na área sofrem –1d20 em todos os testes.',verd:'(+5 PE, 3º círculo, afinidade) Seres que falham ficam Apavorados pela cena toda; a área dobra.'},
  // Sangue 2
  {nome:'Laço de Sangue',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Toque',alvo:'Até 2 seres consentindo',dur:'Missão',resist:'—',pe:4,efeito:'Cria um laço de sangue entre você e até 2 aliados. Você sabe a localização e estado de saúde (PV e condições) de cada aliado ligado a qualquer momento. Uma vez por cena, pode sacrificar 5 PV seus para curar 5 PV de um aliado ligado.',disc:'(+3 PE) O bônus de cura sobe para 10 PV transferidos por 5 PV gastos.',verd:'(+6 PE, 4º círculo, afinidade) Pode afetar até 4 aliados; ao morrer, os PV dos laços são redistribuídos entre os aliados ligados.'},
  // Morte 2
  {nome:'Visão da Morte',elem:'Morte',circ:2,exec:'Completa',alcance:'Toque',alvo:'1 Ser inconsciente ou morto',dur:'Instantânea',resist:'—',pe:4,efeito:'Ao tocar um ser morto ou inconsciente, você vê os últimos instantes de sua consciência — os últimos 10 minutos antes de cair. O Mestre descreve o que o ser viu, ouviu e sentiu.',disc:'(+3 PE) Estende a visão para a última hora antes da queda.',verd:'(+6 PE, 4º círculo, afinidade) Pode comunicar-se brevemente com a consciência do morto, fazendo até 3 perguntas que ele responde com o que sabia em vida.'},
  // Energia 2
  {nome:'Pulso Eletromagnético',elem:'Energia',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Área 9m de raio',dur:'Instantânea',resist:'—',pe:4,efeito:'Libera um pulso de energia caótica que desativa todos os equipamentos eletrônicos na área por 1 cena. Armas de fogo perdem 1 tiro de munição e falham no próximo uso (DT 15 Força para forçar o mecanismo).',disc:'(+3 PE) Além de desativar, causa 3d6 de dano de Energia em equipamentos e seres cibernéticos.',verd:'(+6 PE, 3º círculo, afinidade) A área dobra e equipamentos destruídos ficam permanentemente inutilizados.'},
  // Conhecimento 2
  {nome:'Escudo Telepático',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Curto',alvo:'Aliados escolhidos',dur:'Cena',resist:'—',pe:4,efeito:'Cria um escudo mental ao redor de aliados escolhidos. Eles ficam imunes a leitura de mente, controle mental e efeitos de Sanidade por toda a cena.',disc:'(+3 PE) Além da imunidade, aliados protegidos recebem +2 em testes de Vontade.',verd:'(+6 PE, 4º círculo, afinidade) Aliados protegidos também ficam imunes a condições mentais (Abalado, Apavorado, Confuso).'},
  // Medo 2
  {nome:'Campo do Pesadelo',elem:'Medo',circ:2,exec:'Padrão',alcance:'Médio',alvo:'Área 9m de raio',dur:'Cena',resist:'Vontade parcial',pe:4,efeito:'Cria uma zona de pesadelos paranormais. Seres hostis na área perdem 1d6 de Sanidade por rodada. Se falharem na resistência inicial, ficam Abalados.',disc:'(+3 PE, 3º círculo) A perda de Sanidade sobe para 2d6 por rodada.',verd:'(+6 PE, 4º círculo, afinidade) Seres que perderem toda a Sanidade na área ficam Incapacitados de terror absoluto.'},
  // Sangue 3
  {nome:'Forma Bestial',elem:'Sangue',circ:3,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:6,efeito:'Transforma-se em uma forma bestial de sangue e carne: +4 em Força e Agilidade, garras naturais (2d8 de dano de Sangue), Resistência a dano físico 5 e deslocamento aumentado em +6m. Não pode conjurar rituais enquanto transformado.',disc:'(+4 PE) Também recebe regeneração 5 (recupera 5 PV no início de cada turno).',verd:'(+8 PE, 4º círculo, afinidade) Os bônus sobem para +6 em Força e Agilidade, garras 3d8, e pode usar rituais de Sangue 1º círculo na forma bestial.'},
  // Morte 3
  {nome:'Tempestade de Cinzas',elem:'Morte',circ:3,exec:'Completa',alcance:'Longo',alvo:'Área 12m de raio',dur:'3 rodadas',resist:'Fortitude parcial',pe:6,efeito:'Invoca uma tempestade de cinzas mortais. Seres na área sofrem 4d6 de dano de Morte por rodada e ficam Cegos enquanto permanecerem dentro.',disc:'(+4 PE) O dano sobe para 6d6 por rodada.',verd:'(+8 PE, 4º círculo, afinidade) A tempestade dura a cena inteira; seres que morrerem dentro dela se animam como mortos-vivos por 1 rodada.'},
  // Energia 3
  {nome:'Portal Fantasma',elem:'Energia',circ:3,exec:'Completa',alcance:'Longo',alvo:'2 pontos escolhidos',dur:'Cena',resist:'—',pe:6,efeito:'Cria dois portais de energia interconectados em dois pontos dentro do alcance. Qualquer ser pode atravessar um portal para emergir pelo outro. Os portais são visíveis a todos.',disc:'(+4 PE) Os portais ficam invisíveis a quem você não escolher.',verd:'(+8 PE, 4º círculo, afinidade) Os portais podem conectar dois pontos em locais diferentes, mesmo que estejam a quilômetros de distância — contanto que você conheça os dois locais.'},
  // Conhecimento 3
  {nome:'Profecia Limitada',elem:'Conhecimento',circ:3,exec:'Completa (10 min)',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:6,efeito:'Você entra em transe e recebe uma visão do futuro próximo (próximas 24h). O Mestre descreve uma cena vaga mas verdadeira sobre o que está por vir. Pode ser usada para antecipar armadilhas ou perigos.',disc:'(+4 PE) A visão inclui detalhes adicionais e cobre os próximos 3 dias.',verd:'(+8 PE, 4º círculo, afinidade) Pode fazer uma pergunta específica sobre o futuro e receber uma resposta direta (sim/não/talvez) do Mestre.'},
  // Medo 3
  {nome:'Espelho do Terror',elem:'Medo',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 Ser',dur:'Instantânea',resist:'Vontade anula',pe:6,efeito:'Reflete o medo interno do alvo de volta a ele de forma amplificada. O alvo perde 3d8 de Sanidade e fica Apavorado por toda a cena. Se passar na resistência, o efeito é anulado completamente.',disc:'(+4 PE) A resistência passa para parcial: falha completa ou fica apenas Abalado.',verd:'(+8 PE, 4º círculo, afinidade) O terror é tão intenso que o alvo sofre dano real igual à Sanidade perdida.'},
  // 4º círculo adicionais
  {nome:'Dilúvio de Sangue',elem:'Sangue',circ:4,exec:'Completa',alcance:'Longo',alvo:'Área 15m de raio',dur:'Cena',resist:'Fortitude parcial',pe:10,efeito:'Manifesta um dilúvio de sangue paranormal. Seres na área sofrem 6d10 de dano de Sangue e ficam Vulneráveis por toda a cena. Resistência: metade do dano, sem condição.',disc:'—',verd:'(+10 PE, afinidade) O dano é maximizado; seres que falham ficam Imobilizados em coágulos de sangue.'},
  {nome:'Apocalipse da Entropia',elem:'Morte',circ:4,exec:'Completa (1 min)',alcance:'Extremo',alvo:'Área 30m de raio',dur:'Cena',resist:'Fortitude parcial',pe:10,efeito:'Acelera a entropia em uma área massiva. Todas as estruturas não-paranormais entram em colapso gradual. Seres na área sofrem 5d8 de dano de Morte por rodada.',disc:'—',verd:'(+10 PE, afinidade) O dano é dobrado; estruturas paranormais também são afetadas.'},
  // ══ RITOS DE FÉ (Arsenal dos Agentes) ══

  // ══ BIBLIOTECA RITUALÍSTICA v0.7.3 — 1° CÍRCULO ══
  // Sangue 1
  {nome:'Ascensão de Espinhos',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'Linha 9m',dur:'Instantânea',resist:'Reflexos anula',pe:2,efeito:'Onda de vinhas com espinhos. 2d6 perfuração + enredado.'},
  {nome:'Bomba de Sangue',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 ser',dur:'Instantânea',resist:'Reflexos reduz',pe:2,efeito:'Sanguessuga no alvo, suga 1 PV/rodada, explode em 1d6 + PV sugados.'},
  {nome:'Capilaridade Extrema',elem:'Sangue',circ:1,exec:'Movimento',alcance:'Curto',alvo:'1 pessoa/animal',dur:'Instantânea',resist:'Fort anula',pe:2,efeito:'Manipula pelos do alvo. Acelera, afina, apara ou engrossa.'},
  {nome:'Choque Mental',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 ser',dur:'Instantânea',resist:'Vont parcial',pe:2,efeito:'Fractais nos nervos. Pasmo 1 rod + 1d8 mental.'},
  {nome:'Corrente Medular',elem:'Sangue',circ:1,exec:'Completa',alcance:'Toque',alvo:'criatura VD 40',dur:'Instantânea',resist:'—',pe:2,efeito:'Cria criatura de Sangue da medula. Usuário fica Morrendo.'},
  {nome:'Cristalização Sanguínea',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:2,efeito:'Camada de sangue cristalizado. +5 dano desarmado, RD 2.'},
  {nome:'Entorpecer',elem:'Sangue',circ:1,exec:'Movimento',alcance:'Pessoal',alvo:'veneno',dur:'Instantânea',resist:'Fort anula',pe:2,efeito:'Secreta veneno paralisante. Paralisado 1 rod.'},
  {nome:'Escudo de Carne',elem:'Sangue',circ:1,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:2,efeito:'Barreira de carne. RD 10, fica Vulnerável.'},
  {nome:'Expansão Muscular',elem:'Sangue',circ:1,exec:'Movimento',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:2,efeito:'+2 em Agi ou For no próximo teste. Fica Vulnerável.'},
  {nome:'Flecha de Sangue',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Instantânea',resist:'Ref anula',pe:2,efeito:'Dispara flecha de sangue. 5d4+5 perfuração, perde 1d4+1 PV.'},
  {nome:'Mão Amiga',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Extremo',alvo:'mão espectral',dur:'Cena',resist:'—',pe:2,efeito:'Arranca própria mão, cria mão gigante que move objetos.'},
  {nome:'Poça de Sangue',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:2,efeito:'Vira poça de sangue. Imune a dano (exceto Fogo/Frio/Morte).'},
  {nome:'Poluição Mental',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Cena',resist:'Vont anula',pe:2,efeito:'-1d20 em testes de Intelecto e Presença.'},
  {nome:'Raízes Devoradoras',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Curto',alvo:'esfera 3m',dur:'Instantânea',resist:'Ref evita',pe:2,efeito:'Boca de planta emerge. 3d4 perf + 1d4 sangue.'},
  {nome:'Saber de Sangue',elem:'Sangue',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Instantânea',resist:'Ref oposto',pe:2,efeito:'Língua-chicote. 1d8+Pres corte + sangramento.'},
  // Conhecimento 1
  {nome:'Acústica Cognitiva',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 pessoa',dur:'Sustentada',resist:'Vont anula',pe:2,efeito:'Insere som repetitivo na mente. Atrapalha concentração.'},
  {nome:'Beleza Irreal',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'Película dourada molda aparência. Pres vira 3 ou +1. Perde PV.'},
  {nome:'Caminhos Seguros',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'emanação 45m',dur:'Instantânea',resist:'—',pe:2,efeito:'Localiza saída do local usando seres vivos.'},
  {nome:'Distração Supérflua',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Curto',alvo:'portal',dur:'Sustentada',resist:'—',pe:2,efeito:'Portal dourado que fascina e atrai atenção.'},
  {nome:'Dor do Saber',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 ser',dur:'Sustentada',resist:'Fort anula',pe:2,efeito:'Liga mente ao corpo. 1d3 PV por PE gasto.'},
  {nome:'Em Formação!',elem:'Conhecimento',circ:1,exec:'Completa',alcance:'Curto',alvo:'aliados',dur:'Cena',resist:'—',pe:2,efeito:'+1d20 em ataque e Tática para aliados.'},
  {nome:'Monólogo',elem:'Conhecimento',circ:1,exec:'Completa',alcance:'Curto',alvo:'1 ser',dur:'Instantânea',resist:'Vont anula',pe:2,efeito:'Aguilha dourada faz alvo revelar segredo.'},
  {nome:'Palavras da Dor',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Médio',alvo:'1 ser',dur:'Instantânea',resist:'Ref anula',pe:2,efeito:'Onomatopeia causa 4d4 de dano variável.'},
  {nome:'Sussurros da Vitória',elem:'Conhecimento',circ:1,exec:'Padrão',alcance:'Curto',alvo:'aliados',dur:'1 rodada',resist:'—',pe:2,efeito:'+1d20 no primeiro teste. +1 margem se ataque.'},
  {nome:'Vozes Internas',elem:'Conhecimento',circ:1,exec:'Movimento',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'+5 em perícias mentais, mas ações mais lentas.'},
  // Energia 1
  {nome:'Astro Centrípeto',elem:'Energia',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'círculo 6m',dur:'Instantânea',resist:'Ref anula',pe:2,efeito:'Cometa atinge borda da área. 1d6+1d6/3m raio.'},
  {nome:'Combustão',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ser/objeto',dur:'Instantânea',resist:'—',pe:2,efeito:'Alvo fica Em Chamas.'},
  {nome:'Criação Espectral',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Instantânea',resist:'Ref anula',pe:2,efeito:'Cria cópia espectral de objeto. 4d4+Pres dano.'},
  {nome:'Excitação Inquietante',elem:'Energia',circ:1,exec:'Padrão',alcance:'Toque',alvo:'1 voluntário',dur:'Sustentada',resist:'—',pe:2,efeito:'+2 em físicos, mas Frenesi Leve.'},
  {nome:'Jogo de Sorte',elem:'Energia',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Instantânea',resist:'—',pe:2,efeito:'Aposta com moeda. Efeito 1d8 conforme resultado.'},
  {nome:'Ritmo de Combate',elem:'Energia',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:2,efeito:'+2 Reflexos, pode esquivar com reação.'},
  // Morte 1
  {nome:'Atrair o Fim',elem:'Morte',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'Vont evita',pe:2,efeito:'Ataques são redirecionados a você (Vontade).'},
  {nome:'Bomba Cadáver',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 cadáver',dur:'Instantânea',resist:'Ref reduz',pe:2,efeito:'Explode cadáver. 2d6 químico + 1d6 impacto.'},
  {nome:'Coceira Óssea',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Cena',resist:'Vont anula',pe:2,efeito:'Ossos deterioram. -1d20 em testes se não se coçar.'},
  {nome:'Dilaceração',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ferida',dur:'Instantânea',resist:'Fort anula',pe:2,efeito:'Reabre ferida recente, anula cura.'},
  {nome:'Espiral Crescente',elem:'Morte',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:2,efeito:'+1, +1d2, +1d3, +1d4 nas próximas 4 rolagens.'},
  {nome:'Extração Vital',elem:'Morte',circ:1,exec:'Completa',alcance:'Toque',alvo:'1 ser',dur:'Sustentada',resist:'Fort',pe:2,efeito:'Agarrar + drena 1d4 PE/rodada como PE temp.'},
  {nome:'Forma de Lodo',elem:'Morte',circ:1,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:2,efeito:'Vira poça de lodo. Imune a dano (exceto Fogo/Elétrico/Paranormal).'},
  {nome:'Sentença de Morte',elem:'Morte',circ:1,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Cena',resist:'Fort anula',pe:2,efeito:'+1 dano de Morte por dado. DT Morte +1.'},
  // Medo 1
  {nome:'Ascender',elem:'Medo',circ:1,exec:'Interlúdio',alcance:'Toque',alvo:'1 ser',dur:'Permanente',resist:'—',pe:2,efeito:'Prepara para ligação maior com o Paranormal.'},
  {nome:'Expurgar o Paranormal',elem:'Medo',circ:1,exec:'Completa',alcance:'Curto',alvo:'1 criatura',dur:'Instantânea',resist:'Ref',pe:2,efeito:'Disparo que causa 10% PV (ou 5% de raspão).'},
  // ══ 2° CÍRCULO ══
  {nome:'Articulações Reversas',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Médio',alvo:'1 ser',dur:'Cena',resist:'Fort anula',pe:4,efeito:'Inverte articulações. +5 em físicos, -2d6 PV por falha.'},
  {nome:'Coração de Pedra',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:4,efeito:'50% imunidade a crítico. Chance de evitar Morrendo.'},
  {nome:'Desenvolvimento Muscular',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Toque',alvo:'1 voluntário',dur:'Sustentada',resist:'—',pe:4,efeito:'+1 tamanho, +2 Força, RD = Força. Músculos rompem.'},
  {nome:'Dardos de Sangue',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:4,efeito:'Expele 1d4+1 costelas como dardos. 3d4+3 sangue cada.'},
  {nome:'Fragmentação Corporal',elem:'Sangue',circ:2,exec:'Movimento',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:4,efeito:'Separa parte do corpo controlada por fio de sangue.'},
  {nome:'Sucção Sanguínea',elem:'Sangue',circ:2,exec:'Padrão',alcance:'Toque',alvo:'1 animal/pessoa',dur:'Instantânea',resist:'Fort anula',pe:4,efeito:'Morde alvo agarrado. 6d6 sangue, recupera metade.'},
  {nome:'Abrigo Soturno',elem:'Conhecimento',circ:2,exec:'Movimento',alcance:'Toque',alvo:'1 sombra',dur:'Sustentada',resist:'—',pe:4,efeito:'Vira sombra. Imune a dano, só move por sombras.'},
  {nome:'Precisamos Conversar',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Sustentada',resist:'Vont anula',pe:4,efeito:'Alvo só percebe você. Cego/Surdo para outros.'},
  {nome:'Preparo',elem:'Conhecimento',circ:2,exec:'Completa',alcance:'Toque',alvo:'2 itens',dur:'Permanente',resist:'—',pe:4,efeito:'Marca itens para convocar com ação completa.'},
  {nome:'Wom Wom Wom',elem:'Conhecimento',circ:2,exec:'Padrão',alcance:'Pessoal',alvo:'emanação',dur:'Sustentada',resist:'Vont parcial',pe:4,efeito:'Vibrações causam 2d6 mental/rodada em alcance curto.'},
  {nome:'AAAAAAAAAAAAAAAAAAAAAH!',elem:'Energia',circ:2,exec:'Padrão',alcance:'Pessoal',alvo:'emanação 9m',dur:'Instantânea',resist:'Fort parcial',pe:4,efeito:'Grito destrói cordas vocais. 4d12 impacto + empurra.'},
  {nome:'Aceleração Mental',elem:'Energia',circ:2,exec:'Padrão',alcance:'Toque',alvo:'1 voluntário',dur:'1 rodada',resist:'—',pe:4,efeito:'Ação extra + defesa extra. Fatiga após uso.'},
  {nome:'Círculo de Cauterização',elem:'Energia',circ:2,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Instantânea',resist:'Ref anula',pe:4,efeito:'3d12 fogo + cura 6d12 PV.'},
  {nome:'Além do Tempo',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'1 objeto + 5 seres',dur:'Instantânea',resist:'—',pe:4,efeito:'Liga consciências a objeto. Todos tocam = conversa fora do tempo.'},
  {nome:'Apagar Essência',elem:'Morte',circ:2,exec:'Padrão',alcance:'Toque',alvo:'1 ser',dur:'Instantânea',resist:'Fort reduz',pe:4,efeito:'3d10 perda PV. Se 0 PV, morre instantaneamente.'},
  {nome:'Dúvidas Futuras',elem:'Morte',circ:2,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'Instantânea',resist:'—',pe:4,efeito:'Passa automaticamente em teste. Gasta turno explicando.'},
  {nome:'Lerdeza Mortal',elem:'Morte',circ:2,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Sustentada',resist:'Vont anula',pe:4,efeito:'Alvo perde ação de movimento. Anula Velocidade Mortal.'},
  {nome:'Brasão Amedrontador',elem:'Medo',circ:2,exec:'Interlúdio',alcance:'Toque',alvo:'1 objeto',dur:'1 dia',resist:'—',pe:4,efeito:'Crava brasão em item. 1d8 bônus conforme tipo.'},
  // ══ 3° CÍRCULO ══
  {nome:'Amarras Coriáceas',elem:'Sangue',circ:3,exec:'Padrão',alcance:'Curto',alvo:'1 ser Grande',dur:'Sustentada',resist:'Ref anula',pe:6,efeito:'Pele vira cordas. Agarra+Atordoa+4d8 fogo/rod.'},
  {nome:'Conexão Consanguínea',elem:'Sangue',circ:3,exec:'Padrão',alcance:'Médio',alvo:'4 voluntários',dur:'Sustentada',resist:'—',pe:6,efeito:'Vasos conectam corpos. Divide dano entre todos.'},
  {nome:'Tormenta de Sangue',elem:'Sangue',circ:3,exec:'Completa',alcance:'Pessoal',alvo:'emanação 30m',dur:'Sustentada',resist:'Fort reduz',pe:6,efeito:'Chuva de sangue. 2d12 químico/rodada.'},
  {nome:'Campo de Visão',elem:'Conhecimento',circ:3,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:6,efeito:'Cria olhos dourados. Imune a flanquear, cego, surpreso.'},
  {nome:'Restrição Divina',elem:'Conhecimento',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 ser',dur:'Instantânea',resist:'Vont anula',pe:6,efeito:'Remove habilidade do alvo e armazena em livro.'},
  {nome:'Sombra Fatal',elem:'Conhecimento',circ:3,exec:'Padrão',alcance:'Toque',alvo:'1 ser',dur:'Cena',resist:'Ref anula',pe:6,efeito:'Rouba sombra do alvo. Vulnerável a Conhecimento.'},
  {nome:'Colosso de Energia',elem:'Energia',circ:3,exec:'Completa',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:6,efeito:'Projeção enorme. 100 PV temp, +10 DEF, RD 10.'},
  {nome:'Desdenho Mucoso',elem:'Energia',circ:3,exec:'Padrão',alcance:'Médio',alvo:'1 ser',dur:'Instantânea',resist:'Ref anula',pe:6,efeito:'4d6 químico + dano a itens por 1d4 rod.'},
  {nome:'Armadura Congelante',elem:'Morte',circ:3,exec:'Movimento',alcance:'Pessoal',alvo:'Você',dur:'1 rodada',resist:'—',pe:6,efeito:'Imune a Energia/Eletricidade/Fogo. 2d6 frio em quem ataca.'},
  {nome:'Ataque Além do Tempo',elem:'Morte',circ:3,exec:'1 dia',alcance:'Ilimitado',alvo:'1 ser',dur:'Instantânea',resist:'—',pe:6,efeito:'Ataque com experiências de mortos. Alvo Desprevenido.'},
  {nome:'Destino Mefítico',elem:'Morte',circ:3,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Instantânea',resist:'Fort anula',pe:6,efeito:'Amaldiçoa alvo com Anátema.'},
  {nome:'Assombrar Objeto',elem:'Medo',circ:3,exec:'Padrão',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:6,efeito:'Adentra objeto. Vê/sente exterior.'},
  // ══ 4° CÍRCULO ══
  {nome:'Banho de Sangue',elem:'Sangue',circ:4,exec:'Padrão',alcance:'visual',alvo:'todos vistos',dur:'Sustentada',resist:'Fort reduz',pe:10,efeito:'5d12 impacto + Asfixia + Caído em todos vistos.'},
  {nome:'Cúpula Apocalíptica',elem:'Sangue',circ:4,exec:'2 rodadas',alcance:'Toque',alvo:'esfera 45m',dur:'Sustentada',resist:'—',pe:10,efeito:'Cria cúpula de sangue. Nada atravessa.'},
  {nome:'Nove Portões do Inferno',elem:'Sangue',circ:4,exec:'Completa',alcance:'Curto',alvo:'1 ser',dur:'Instantânea',resist:'Ref parcial',pe:10,efeito:'9 correntes + portão. Prende e envia à Prisão dos Nove Infernos.'},
  {nome:'Acorrentamento Óptico',elem:'Conhecimento',circ:4,exec:'Interlúdio',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:10,efeito:'Cria olhos em 3 pontos do mundo. Vê tudo lá.'},
  {nome:'Mundo Plano',elem:'Conhecimento',circ:4,exec:'Padrão',alcance:'Pessoal',alvo:'emanação 9m',dur:'Instantânea',resist:'Vont anula',pe:10,efeito:'Transporta para dimensão 2D.'},
  {nome:'Lança Imparável',elem:'Energia',circ:4,exec:'2 rodadas',alcance:'Extremo',alvo:'linha',dur:'Instantânea',resist:'Ref parcial',pe:10,efeito:'10d20 Energia, ignora RD. Morte instantânea se 0 PV.'},
  {nome:'Escudo Indestrutível',elem:'Energia',circ:4,exec:'Completa',alcance:'Extremo',alvo:'parede 100m²',dur:'Sustentada',resist:'—',pe:10,efeito:'Parede impenetrável. Nada a atravessa.'},
  {nome:'Sentença Espiral',elem:'Morte',circ:4,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Sustentada',resist:'Vont anula',pe:10,efeito:'Corpo vira espiral. 4d8 Morte/rod até morrer.'},
  {nome:'Bênção Maldita',elem:'Morte',circ:4,exec:'Padrão',alcance:'Toque',alvo:'1 voluntário',dur:'Instantânea',resist:'—',pe:10,efeito:'Cura total. Envelhece 1d4 décadas.'},
  {nome:'Assembleia do Medo',elem:'Medo',circ:4,exec:'Completa',alcance:'Médio',alvo:'pessoas',dur:'Sustentada',resist:'—',pe:10,efeito:'Aliados +2d20. Inimigos -2d20.'},
  {nome:'Mestre do Medo',elem:'Medo',circ:4,exec:'Movimento',alcance:'Pessoal',alvo:'Você',dur:'Sustentada',resist:'—',pe:10,efeito:'Afinidade com todos elementos. Se falhar resist, perde para sempre.'},
  // ══ MANIFESTAÇÕES (Rituais cantrip sem custo de PE) ══
  {nome:'Afiação',elem:'Conhecimento',circ:0,exec:'Padrão',alcance:'Toque',alvo:'1 arma',dur:'Cena',resist:'—',pe:0,efeito:'Afia a lâmina de uma arma, tornando-a mais letal. A arma ganha +1 em rolagens de dano e +1 em Margem de Ameaça enquanto o ritual estiver ativo.',disc:'—',verd:'—'},
  {nome:'Adaptar Corpo',elem:'Sangue',circ:0,exec:'Movimento',alcance:'Toque',alvo:'1 ser voluntário',dur:'Instantânea',resist:'—',pe:0,efeito:'Estimula o corpo do alvo para que ele receba +5 em seu próximo teste físico (Atletismo, Luta, Fortitude ou similar). O efeito é consumido após o teste.',disc:'—',verd:'—'},
  {nome:'Características Inconvenientes',elem:'Energia',circ:0,exec:'Padrão',alcance:'Curto',alvo:'1 ser',dur:'Cena',resist:'Vontade anula',pe:0,efeito:'Adiciona uma característica física incômoda e constrangedora ao alvo (orelhas de burro, nariz enorme, pele verde etc). O alvo sofre –2 em testes sociais enquanto o efeito perdurar.',disc:'—',verd:'—'},
  {nome:'Bafo Podre',elem:'Morte',circ:0,exec:'Padrão',alcance:'Pessoal',alvo:'Cone 3m',dur:'Instantânea',resist:'Fortitude anula',pe:0,efeito:'Você exala um odor cadavérico intenso. Seres no cone ficam Enjoados por 1 rodada (Fortitude anula).',disc:'—',verd:'—'},
  {nome:'Atenuar o Outro Lado',elem:'Medo',circ:0,exec:'Reação',alcance:'Pessoal',alvo:'Você',dur:'1 rodada',resist:'—',pe:0,efeito:'Recria uma parte minúscula da membrana ao seu redor como escudo momentâneo. Você recebe RD 2 contra o próximo ataque de elemento paranormal que te atingir.',disc:'—',verd:'—'},
  // ══ RITUAIS FALTANTES DA BIBLIOTECA RITUALÍSTICA ══
  // Sangue 2
  {nome:'Aberração Sanguínea',elem:'Sangue',circ:2,exec:'Completa',alcance:'Toque',alvo:'1 animal',dur:'Permanente',resist:'Fortitude anula',pe:4,efeito:'Preenche um animal com sangue paranormal. O alvo tem Força, Agilidade e Vigor +2, PV dobrados, +10 em perícias com bônus e +10 na Defesa. Todos os ataques causam +1d12 de dano de Sangue. Custa 2d12 PV ao conjurador.',disc:'(+4 PE, 3º círculo) Reduz a perda de PV para 1d12.',verd:'(+4 PE, afinidade) Muda o alvo para até 3 animais; aumenta a perda de PV para 4d12.'},
  // Conhecimento 2
  {nome:'Catálogo de Vendas',elem:'Conhecimento',circ:2,exec:'Completa',alcance:'Toque',alvo:'1 objeto (papel)',dur:'Permanente até ser ativado',resist:'—',pe:4,efeito:'Gera uma folha com listagem de objetos à venda. O próximo ser que tocar o papel com as mãos nuas pode adquirir um dos itens trocando por algo de igual valor, que teletransporta para o conjurador.',disc:'—',verd:'(+4 PE, afinidade) Uma projeção sua aparece para negociar com o comprador ao ativar o papel.'},
  // Energia 2
  {nome:'Armadilha Travessa',elem:'Energia',circ:2,exec:'Veja texto',alcance:'Médio',alvo:'1 ser',dur:'Instantânea',resist:'Percepção anula',pe:4,efeito:'Ao conjurar outro ritual, aumenta sua execução em um passo. Em conjunto, cria uma esfera invisível que leva 1d6 rodadas para atingir o alvo (ele tem direito a Percepção por rodada para notar). Ao ser atingido, o alvo é teletransportado para um local à escolha do conjurador onde o alvo já esteve.',disc:'—',verd:'(+9 PE, 4° círculo, afinidade) A esfera leva apenas 1 rodada para atingir o alvo.'},
  // Energia 3
  {nome:'Chama Carente',elem:'Energia',circ:3,exec:'Padrão',alcance:'Pessoal',alvo:'Emanação 6m',dur:'Sustentada',resist:'Reflexos parcial',pe:6,efeito:'Cria uma chama paranormal que busca calor e afeto. Todo ser em alcance curto sofre 3d8 de dano de Fogo por rodada e fica Atraído em direção ao conjurador (Reflexos parcial: apenas o dano). Você é imune ao efeito.',disc:'(+4 PE) O alcance aumenta para médio e o dano sobe para 4d8.',verd:'(+8 PE, 4° círculo, afinidade) Seres que falham na resistência ficam também Imobilizados pela chama que os envolve.'},
  // Morte 3
  {nome:'Antigravitação',elem:'Morte',circ:3,exec:'Movimento',alcance:'Pessoal',alvo:'Você',dur:'Cena',resist:'—',pe:6,efeito:'Reveste seu corpo com uma película que ignora a gravidade. Você pode flutuar e se mover pelo ar a seu deslocamento normal. Enquanto ativo, você é imune a dano de queda e pode realizar ataques de qualquer ângulo sem penalidade.',disc:'(+4 PE) Pode levar até 1 aliado consigo.',verd:'(+8 PE, 4° círculo, afinidade) Você pode controlar a gravidade em alcance curto, lançando objetos e seres como se fossem projéteis (2d8 de dano de Impacto).'}
];

function renderRituaisTab(){
  const c=userChar(currentUser);
  if(!c.rituaisAprendidos) c.rituaisAprendidos={};
  const busca=(document.getElementById('ritual-busca')||{}).value||'';
  const elemFil=(document.getElementById('ritual-elem-fil')||{}).value||'';
  const circFil=(document.getElementById('ritual-circ-fil')||{}).value||'';
  const aprFil=(document.getElementById('ritual-apr-fil')||{}).value||'';
  const grid=document.getElementById('rituais-grid');
  if(!grid) return;
  grid.innerHTML='';
  const filtrado=RITUAIS_DB.filter(r=>{
    if(busca&&!r.nome.toLowerCase().includes(busca.toLowerCase())&&!r.efeito.toLowerCase().includes(busca.toLowerCase())) return false;
    if(elemFil&&r.elem!==elemFil) return false;
    if(circFil&&String(r.circ)!==circFil) return false;
    if(aprFil==='1'&&!c.rituaisAprendidos[r.nome]) return false;
    if(aprFil==='0'&&c.rituaisAprendidos[r.nome]) return false;
    return true;
  });
  const countEl=document.getElementById('ritual-count');
  if(countEl){const aprendidos=filtrado.filter(r=>c.rituaisAprendidos[r.nome]).length;countEl.textContent=`${filtrado.length} ritual${filtrado.length!==1?'s':''} exibido${filtrado.length!==1?'s':''} · ${aprendidos} desbloqueado${aprendidos!==1?'s':''}`;}
  if(!filtrado.length){grid.innerHTML='<div style="color:var(--white-dust);font-size:13px;padding:10px">Nenhum ritual encontrado.</div>';return;}
  filtrado.forEach(r=>{
    const apr=c.rituaisAprendidos[r.nome]||false;
    const cor=ELEM_COR[r.elem]||'var(--crimson)';
    const card=document.createElement('div');
    card.style.cssText=`background:rgba(10,0,8,0.9);border:1px solid ${apr?cor:'rgba(58,0,0,0.4)'};padding:14px;position:relative;overflow:hidden;transition:border-color .2s;opacity:${apr?1:0.72};`;
    const elemKey = r.elem.toLowerCase();
    const wm = `<span class="sym-el ${elemKey==='sangue'?'sym-sangue':elemKey==='morte'?'sym-morte':elemKey==='energia'?'sym-energia':elemKey==='conhecimento'?'sym-conhecimento':'sym-medo'}" style="position:absolute;top:30px;right:8px;width:120px;height:120px;opacity:0.3;pointer-events:none;background-size:contain"></span>`;
    card.innerHTML=`${wm}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <div>
          <span style="font-family:'Cinzel',serif;font-size:12px;color:${apr?cor:'var(--white-bone)'};">${r.nome}</span>
          ${apr?`<span style="font-size:9px;font-family:'Oswald',sans-serif;color:${cor};margin-left:6px;letter-spacing:.08em">✓ DESBLOQUEADO</span>`:`<span style="font-size:9px;font-family:'Oswald',sans-serif;color:var(--white-dust);margin-left:6px;letter-spacing:.08em">🔒 BLOQUEADO</span>`}
        </div>
        <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
          <span style="font-family:'Cinzel',serif;font-size:18px;letter-spacing:.12em;color:${cor};text-transform:uppercase;white-space:nowrap">${r.elem}</span>
          <span style="font-size:10px;padding:1px 6px;border:1px solid rgba(138,106,0,0.5);color:var(--gold-light);font-family:'Cinzel',serif;white-space:nowrap">${r.circ===0?'Manif.':r.circ+'º ⬤'}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;font-size:10px;font-family:'Courier Prime',monospace;color:var(--white-dust)">
        <span>Exec: <b style="color:var(--white-ash)">${r.exec}</b></span>
        <span>Alcance: <b style="color:var(--white-ash)">${r.alcance}</b></span>
        <span>Alvo: <b style="color:var(--white-ash)">${r.alvo}</b></span>
        <span>Duração: <b style="color:var(--white-ash)">${r.dur}</b></span>
        ${r.resist!=='—'?`<span style="grid-column:1/-1">Resist: <b style="color:var(--white-ash)">${r.resist}</b></span>`:''}
        <span>Custo base: <b style="color:var(--gold-light)">${r.pe} PE</b></span>
      </div>
      <div style="font-size:12px;color:var(--white-ash);line-height:1.6;margin-bottom:6px">${r.efeito}</div>
      ${r.disc&&r.disc!=='—'?`<div style="font-size:11px;color:#aabbcc;line-height:1.5;margin-top:4px;padding-top:4px;border-top:1px solid rgba(34,136,204,0.2)"><span style="color:#55aadd;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.08em">DISCENTE</span> ${r.disc}</div>`:''}
      ${r.verd&&r.verd!=='—'?`<div style="font-size:11px;color:#ccbbaa;line-height:1.5;margin-top:4px;padding-top:4px;border-top:1px solid rgba(138,106,0,0.2)"><span style="color:var(--gold-light);font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.08em">VERDADEIRO</span> ${r.verd}</div>`:''}
      ${apr?`<div style="margin-top:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button onclick="event.stopPropagation();usarRitual('${r.nome.replace(/'/g,"\\'")}',0)" style="padding:5px 14px;background:rgba(139,0,0,0.2);border:1px solid ${cor};color:${cor};font-family:'Cinzel',serif;font-size:10px;letter-spacing:.1em;cursor:pointer;text-transform:uppercase" title="Gasta ${r.pe} PE automaticamente">⛧ Usar (${r.pe} PE)</button>
        <span style="font-size:10px;color:var(--white-dust);font-family:'Courier Prime',monospace">PE extra:</span>
        <input id="extra-pe-${r.nome.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'')}" type="number" min="0" value="0" style="width:44px;background:rgba(20,0,15,.8);border:1px solid var(--blood-deep);color:var(--white-bone);font-family:'Courier Prime',monospace;font-size:12px;padding:3px 6px;outline:none" onclick="event.stopPropagation()">
        <button onclick="event.stopPropagation();usarRitual('${r.nome.replace(/'/g,"\\'")}',document.getElementById('extra-pe-${r.nome.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'')}').value)" style="padding:5px 10px;background:transparent;border:1px solid rgba(138,106,0,0.4);color:var(--gold-light);font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;cursor:pointer" title="Usar com PE extra (Discente/Verdadeiro)">+Extra</button>
      </div>`:`<div style="margin-top:10px;font-size:10px;color:var(--white-dust);font-family:'Courier Prime',monospace;font-style:italic">🔒 Desbloqueie este ritual através da Transcendência ou peça ao Mestre.</div>`}
    `;
    grid.appendChild(card);
  });
}


function renderInv(){
  const el=document.getElementById('inv-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.inv) c.inv=[];
  if(!c.inv.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhum item.</div>';return;}
  c.inv.forEach((it,i)=>{
    const row=document.createElement('div');row.className='list-item';
    row.innerHTML=`<div class="list-body">${it.nome}${it.qtd>1?' <span style="color:var(--crimson);font-size:11px">×'+it.qtd+'</span>':''}${it.desc?'<div class="list-meta">'+it.desc+'</div>':''}</div>
      <button class="del-btn" onclick="delInv(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addInv(){
  const n=document.getElementById('inv-nome').value.trim();if(!n)return;
  const c=userChar(currentUser);
  if(!c.inv) c.inv=[];
  c.inv.push({nome:n,desc:document.getElementById('inv-desc').value.trim(),qtd:parseInt(document.getElementById('inv-qtd').value)||1});
  document.getElementById('inv-nome').value='';document.getElementById('inv-desc').value='';
  renderInv();saveDB();flashSave('save-inv');
}
function delInv(i){const c=userChar(currentUser);c.inv.splice(i,1);renderInv();saveDB();}
 
/* ══════════════════════════════════════════════
   RITUAIS
══════════════════════════════════════════════ */
function renderRit(){
  const el=document.getElementById('rit-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.rituais) c.rituais=[];
  if(!c.rituais.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhum ritual.</div>';return;}
  c.rituais.forEach((r,i)=>{
    const row=document.createElement('div');row.className='list-item';
    row.innerHTML=`<div class="list-body"><span class="badge badge-r">Ritual</span>${r.nome}${r.nex?' <span style="color:var(--crimson);font-size:11px">NEX '+r.nex+'%</span>':''}${r.desc?'<div class="list-meta">'+r.desc+'</div>':''}</div>
      <button class="del-btn" onclick="delRit(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addRit(){
  const n=document.getElementById('rit-nome').value.trim();if(!n)return;
  const c=userChar(currentUser);
  c.rituais.push({nome:n,nex:document.getElementById('rit-nex').value.trim(),desc:document.getElementById('rit-desc').value.trim()});
  document.getElementById('rit-nome').value='';document.getElementById('rit-nex').value='';document.getElementById('rit-desc').value='';
  renderRit();saveDB();
}
function delRit(i){const c=userChar(currentUser);c.rituais.splice(i,1);renderRit();saveDB();}
 
/* ══════════════════════════════════════════════
   PISTAS / NOTAS
══════════════════════════════════════════════ */
const PISTA_COLORS={pista:'#c49a00',npc:'#1fc8a0',local:'#5b9cf6',ocult:'#bb88ff'};
function renderPistas(){
  const el=document.getElementById('pista-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.pistaList||!c.pistaList.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhuma pista registrada.</div>';return;}
  c.pistaList.forEach((p,i)=>{
    const row=document.createElement('div');row.className='list-item';
    const col=PISTA_COLORS[p.tipo]||'#888';
    row.innerHTML=`<div style="width:4px;background:${col};align-self:stretch;flex-shrink:0"></div>
      <div class="list-body">${p.texto}<div class="list-meta">${p.tipo.toUpperCase()} — ${p.h}</div></div>
      <button class="del-btn" onclick="delPista(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addPista(){
  const t=document.getElementById('pista-inp').value.trim();if(!t)return;
  const c=userChar(currentUser);if(!c.pistaList)c.pistaList=[];
  const h=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  c.pistaList.push({texto:t,tipo:document.getElementById('pista-tipo').value,h});
  document.getElementById('pista-inp').value='';renderPistas();saveDB();
}
function delPista(i){const c=userChar(currentUser);c.pistaList.splice(i,1);renderPistas();saveDB();}
 
function renderNotas(){
  const el=document.getElementById('nota-list');el.innerHTML='';
  const c=userChar(currentUser);
  if(!c.notas) c.notas=[];
  if(!c.notas.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhuma anotação.</div>';return;}
  c.notas.forEach((n,i)=>{
    const row=document.createElement('div');row.className='list-item';
    row.innerHTML=`<div class="list-body">${n.t}<div class="list-meta">${n.h}</div></div>
      <button class="del-btn" onclick="delNota(${i})">×</button>`;
    el.appendChild(row);
  });
}
function addNota(){
  const t=document.getElementById('nota-inp').value.trim();if(!t)return;
  const c=userChar(currentUser);
  c.notas.unshift({t,h:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});
  document.getElementById('nota-inp').value='';renderNotas();saveDB();flashSave('save-missao');
}
function delNota(i){const c=userChar(currentUser);c.notas.splice(i,1);renderNotas();saveDB();}
 
/* ══════════════════════════════════════════════
   DICE
══════════════════════════════════════════════ */
function rollDie(f){
  if(window.playDiceRoll) playDiceRoll(f);
  const r=Math.floor(Math.random()*f)+1;
  showRoll('D'+f,[r],0,r,'');
}
function rollCustom(){
  const q=parseInt(document.getElementById('r-qtd').value)||1;
  const f=parseInt(document.getElementById('r-faces').value)||20;
  const mod=parseInt(document.getElementById('r-mod').value)||0;
  const lbl=document.getElementById('r-label').value.trim();
  if(window.playDiceRoll) playDiceRoll(f);
  const rolls=Array.from({length:q},()=>Math.floor(Math.random()*f)+1);
  const total=rolls.reduce((a,b)=>a+b,0)+mod;
  showRoll(q+'d'+f+(mod?(mod>0?'+':'')+mod:''),rolls,mod,total,lbl);
}
function showRoll(label,rolls,mod,total,ctx){
  document.getElementById('roll-res').textContent=total;
  const detail=rolls.join(' + ')+(mod&&mod!==0?(mod>0?' + ':' ')+mod:'');
  document.getElementById('roll-detail').textContent=label+(ctx?' ('+ctx+')':'')+': ['+detail+']';
  const h=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(!db.rolls[currentUser])db.rolls[currentUser]=[];
  const maxV=parseInt(label.replace(/\d+d/,''))||20;
  db.rolls[currentUser].unshift({label,total,h,ctx,user:currentUser,ts:Date.now(),maxVal:maxV});
  if(db.rolls[currentUser].length>50)db.rolls[currentUser].pop();
  renderLog();saveDB();
  // Publica para todos via Firebase
  if(window.fbRollPublish){
    window.fbRollPublish({
      user:currentUser, isMestre, label, rolls, mod, total, ctx:ctx||'',
      ts:Date.now(), h
    });
  }
}
function renderLog(){
  const el=document.getElementById('roll-log');el.innerHTML='';
  const logs=db.rolls[currentUser]||[];
  if(!logs.length){el.innerHTML='<div style="color:var(--white-dust);font-size:13px">Nenhuma rolagem ainda.</div>';return;}
  logs.forEach(r=>{
    const d=document.createElement('div');d.className='log-line';
    d.innerHTML=`<span class="log-tag">${r.h}</span> <span>${r.label}${r.ctx?' — '+r.ctx:''}</span> <b>→ ${r.total}</b>`;
    el.appendChild(d);
  });
}
function resetAllRolls(){if(confirm('Limpar histórico de rolagens de todos?')){db.rolls={};saveDB();renderLog();toast('Histórico limpo.');}}
 
 
/* ══════════════════════════════════════════════
   MESTRE
══════════════════════════════════════════════ */
function populateMestre(){
  if(!isMestre)return;
  populateRollFilterSelect();
  renderAllRolls();
  renderFichasRecebidas();
  _loadNpcFichas();
  _renderNpcFichasLista();
  const el=document.getElementById('players-panel');el.innerHTML='';
  const sel=document.getElementById('mestre-sel-player');sel.innerHTML='';
  const missaoSel=document.getElementById('missao-sel-player');
  if(missaoSel)missaoSel.innerHTML='<option value="">— Selecione um agente —</option>';
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
        ${_mestreTransLiberada(u) ? `<button onclick="mestreRevogarTranscendencia('${u}')" style="border-color:#aa3300;color:#ff6633">⛧ Revogar Transcendência</button>` : `<button onclick="mestreLiberarTranscendencia('${u}')" style="border-color:var(--gold);color:var(--gold-light)">⛧ Liberar Transcendência</button>`}
        <button onclick="mestreDeleteAgent('${u}')" style="border-color:#5a0000;color:#cc4444">🗑 Remover ficha</button>
      </div>`;
    el.appendChild(card);
    const opt=document.createElement('option');opt.value=u;opt.textContent=c.nome||u;sel.appendChild(opt);
    if(missaoSel){const opt2=document.createElement('option');opt2.value=u;opt2.textContent=c.nome||u;missaoSel.appendChild(opt2);}
  });
}
 
function loadPlayerNote(){
  const u=document.getElementById('mestre-sel-player').value;
  sv('mestre-player-note',(db.mestre.playerNotes||{})[u]||'');
}

/* ── Mandar Ficha ao Mestre ── */
function mandarFichaAoMestre(){
  if(!currentUser||isMestre)return;
  saveChar(); // garante que está salvo
  if(!db.mestre.fichasRecebidas)db.mestre.fichasRecebidas={};
  db.mestre.fichasRecebidas[currentUser]={ts:Date.now(),user:currentUser};
  saveDB();
  const ok=document.getElementById('ficha-enviada-ok');
  if(ok){ok.style.display='';setTimeout(()=>ok.style.display='none',3000);}
  toast('⛧ Ficha enviada ao Mestre!');
}

/* ── Render anotações de missão de um player no painel do mestre ── */
function renderMissaoPlayer(){
  const sel=document.getElementById('missao-sel-player');
  if(!sel)return;
  const u=sel.value;
  const wrap=document.getElementById('missao-player-view');
  if(!wrap)return;
  if(!u){wrap.innerHTML='<div style="color:var(--white-dust);font-size:13px;padding:8px 0">Selecione um agente para ver suas anotações.</div>';return;}
  const c=db.characters[u]||defaultChar();
  const nome=c.nome||u;
  let html=`<div style="border-left:3px solid rgba(138,106,0,0.5);padding:0 0 0 14px">`;
  // Operação atual
  html+=`<div style="margin-bottom:14px">
    <div style="font-size:10px;letter-spacing:.15em;color:var(--gold-light);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:8px">⛧ Operação — ${nome}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-family:'Courier Prime',monospace;font-size:12px;color:var(--white-ash)">
      <div><span style="color:var(--crimson)">Operação:</span> ${c.opNome||'—'}</div>
      <div><span style="color:var(--crimson)">Local:</span> ${c.opLocal||'—'}</div>
      <div><span style="color:var(--crimson)">Ameaça:</span> ${c.opAmeaca||'—'}</div>
      <div><span style="color:var(--crimson)">Entidade:</span> ${c.opEnt||'—'}</div>
    </div>
    ${c.opResumo?`<div style="margin-top:8px;font-family:'Courier Prime',monospace;font-size:12px;color:var(--white-bone);background:rgba(10,0,8,0.7);padding:8px 12px;border-left:2px solid var(--blood-deep)">${c.opResumo}</div>`:''}
  </div>`;
  // Pistas
  const pistas=c.pistaList||[];
  if(pistas.length){
    html+=`<div style="margin-bottom:14px">
      <div style="font-size:10px;letter-spacing:.15em;color:var(--gold-light);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:8px">Pistas Encontradas (${pistas.length})</div>
      ${pistas.map(p=>`<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(58,0,0,0.3);font-size:12px;color:var(--white-bone);font-family:'Courier Prime',monospace">
        <span style="color:var(--crimson);flex-shrink:0">▸</span>
        <span class="badge badge-${p.tipo==='pista'?'p':p.tipo==='npc'?'r':'h'}" style="flex-shrink:0">${p.tipo}</span>
        ${p.txt}
      </div>`).join('')}
    </div>`;
  } else {
    html+=`<div style="margin-bottom:14px;font-size:12px;color:var(--white-dust);font-family:'Courier Prime',monospace">Sem pistas registradas.</div>`;
  }
  // Anotações da sessão
  const notas=c.notas||[];
  if(notas.length){
    html+=`<div>
      <div style="font-size:10px;letter-spacing:.15em;color:var(--gold-light);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:8px">Anotações da Sessão (${notas.length})</div>
      ${notas.map(n=>`<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(58,0,0,0.3);font-size:12px;color:var(--white-bone);font-family:'Courier Prime',monospace">
        <span style="color:var(--crimson);flex-shrink:0">⛧</span>${n.txt}
        <span style="color:var(--white-dust);font-size:10px;margin-left:auto;flex-shrink:0">${n.h||''}</span>
      </div>`).join('')}
    </div>`;
  } else {
    html+=`<div style="font-size:12px;color:var(--white-dust);font-family:'Courier Prime',monospace">Sem anotações registradas.</div>`;
  }
  html+=`</div>`;
  wrap.innerHTML=html;
}

/* ── Render fichas recebidas ── */
function renderFichasRecebidas(){
  const el=document.getElementById('fichas-recebidas-lista');
  if(!el)return;
  const fichas=db.mestre&&db.mestre.fichasRecebidas||{};
  const keys=Object.keys(fichas);
  if(!keys.length){el.innerHTML='<div style="color:var(--white-dust);font-size:12px;padding:8px 0">Nenhuma ficha enviada ainda.</div>';return;}
  el.innerHTML='';
  keys.forEach(u=>{
    const f=fichas[u];
    const c=db.characters[u]||defaultChar();
    const hora=f.ts?new Date(f.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'—';
    const d=document.createElement('div');
    d.style.cssText='display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid rgba(58,0,0,0.3)';
    d.innerHTML=`<span style="color:var(--gold-light);font-family:'Cinzel',serif;font-size:13px;flex:1">${c.nome||u}</span>
      <span style="font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace">${hora}</span>
      <button class="btn-add" onclick="mestreViewChar('${u}')" style="font-size:11px;padding:5px 12px">Ver ficha</button>
      <button class="btn-add" onclick="mestreVerMissaoRapido('${u}')" style="font-size:11px;padding:5px 12px;border-color:rgba(138,106,0,.5);color:var(--gold-light)">Ver missão</button>`;
    el.appendChild(d);
  });
}

function mestreVerMissaoRapido(u){
  // Seleciona o agente no dropdown e muda para ele
  const sel=document.getElementById('missao-sel-player');
  if(sel){sel.value=u;renderMissaoPlayer();}
  // Scroll até a seção
  const panel=document.getElementById('missao-player-view');
  if(panel)panel.scrollIntoView({behavior:'smooth'});
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

// ── Transcendência: liberar/revogar por player ──
function _mestreTransLiberada(u) {
  return !!(db.mestre && db.mestre.transLiberada && db.mestre.transLiberada[u]);
}

function mestreLiberarTranscendencia(u) {
  if (!db.mestre) db.mestre = {};
  if (!db.mestre.transLiberada) db.mestre.transLiberada = {};
  db.mestre.transLiberada[u] = true;
  saveDB();
  populateMestre();
  const c = db.characters[u] || {};
  toast(`⛧ Transcendência liberada para ${c.nome || u} — O Rei Carmesim aguarda.`, '#cc1111');
}

function mestreRevogarTranscendencia(u) {
  if (!db.mestre || !db.mestre.transLiberada) return;
  db.mestre.transLiberada[u] = false;
  saveDB();
  populateMestre();
  const c = db.characters[u] || {};
  toast(`Transcendência revogada de ${c.nome || u}.`, '#555');
}
// ── Subabas do Mestre ──
window.showMestreSubtab = function(id, btn) {
  document.querySelectorAll('.noir-subtab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.noir-subtab').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('msubtab-' + id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'transcendencia') { renderMestreSelfTrans(); renderTransControlList(); renderMestreRituaisControl(); }
};

// ── Transcendência do próprio Mestre ──
function renderMestreSelfTrans() {
  const el = document.getElementById('mestre-self-trans-body');
  if (!el || !isMestre) return;

  const u = currentUser;
  const c = db.characters[u] || {};
  const nex = parseInt(c.nex) || 5;
  const jaTransc = !!(c.transcendencia && c.transcendencia.elemento);
  const transLiberada = _mestreTransLiberada(u);

  // Função que o mestre usa para liberar a própria trans
  const btnLiberar = `<button onclick="mestreLiberarPropriaTranscendencia()" style="padding:9px 20px;background:rgba(138,106,0,0.12);border:1px solid var(--gold);color:var(--gold-light);font-family:'Cinzel',serif;font-size:11px;letter-spacing:.12em;cursor:pointer;text-transform:uppercase" onmouseover="this.style.background='rgba(138,106,0,0.25)'" onmouseout="this.style.background='rgba(138,106,0,0.12)'">⛧ Liberar minha Transcendência</button>`;
  const btnRevogar = `<button onclick="mestreRevogarPropriaTranscendencia()" style="padding:9px 20px;background:rgba(80,0,0,0.18);border:1px solid #aa3300;color:#ff6633;font-family:'Cinzel',serif;font-size:11px;letter-spacing:.12em;cursor:pointer;text-transform:uppercase" onmouseover="this.style.background='rgba(120,0,0,0.3)'" onmouseout="this.style.background='rgba(80,0,0,0.18)'">⛧ Revogar minha Transcendência</button>`;

  let statusHtml, actionHtml;

  if (transLiberada) {
    statusHtml = `<div style="font-family:'Cinzel',serif;font-size:12px;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:4px">◈ Transcendência Disponível</div>
      <div style="font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace">ELE estendeu a mão. Vá até sua ficha para transcender.</div>`;
    actionHtml = btnRevogar;
  } else if (jaTransc) {
    const ed = TRANSCENDENCIA_ELEMENTOS[c.transcendencia.elemento];
    const totalElem = (typeof RITUAIS_DB !== 'undefined') ? RITUAIS_DB.filter(r => r.elem === ed.nome).length : 0;
    const desbElem = (typeof RITUAIS_DB !== 'undefined') ? RITUAIS_DB.filter(r => r.elem === ed.nome && c.rituaisAprendidos && c.rituaisAprendidos[r.nome]).length : 0;
    statusHtml = `<div style="font-family:'Cinzel',serif;font-size:12px;letter-spacing:.15em;color:${ed.cor};text-transform:uppercase;margin-bottom:4px">✦ ${ed.nome.toUpperCase()}</div>
      <div style="font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace">${desbElem}/${totalElem} rituais — NEX ${nex}%</div>`;
    actionHtml = btnLiberar;
  } else {
    const elegivel = nex >= 50;
    statusHtml = `<div style="font-family:'Cinzel',serif;font-size:12px;letter-spacing:.15em;color:var(--white-dust);text-transform:uppercase;margin-bottom:4px">⛧ Transcendência Bloqueada</div>
      <div style="font-size:11px;color:${elegivel ? '#8a6a30' : '#5a4030'};font-family:'Courier Prime',monospace">NEX ${nex}%${elegivel ? ' — elegível' : ' — mínimo 50% para transcender'}</div>`;
    actionHtml = elegivel ? btnLiberar : `<div style="padding:9px 18px;border:1px solid rgba(80,40,40,0.35);color:rgba(160,100,100,0.45);font-family:'Cinzel',serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;text-align:center">NEX insuf.</div>`;
  }

  el.innerHTML = `
    <div style="flex:1;min-width:180px">${statusHtml}</div>
    ${actionHtml}`;
}

window.mestreLiberarPropriaTranscendencia = function() {
  if (!isMestre) return;
  if (!db.mestre) db.mestre = {};
  if (!db.mestre.transLiberada) db.mestre.transLiberada = {};
  db.mestre.transLiberada[currentUser] = true;
  saveDB();
  renderMestreSelfTrans();
  renderTransControlList();
  toast('⛧ Sua Transcendência foi liberada — vá até a aba Rituais para transcender.', '#c49a00');
};

window.mestreRevogarPropriaTranscendencia = function() {
  if (!isMestre || !db.mestre || !db.mestre.transLiberada) return;
  db.mestre.transLiberada[currentUser] = false;
  saveDB();
  renderMestreSelfTrans();
  renderTransControlList();
  toast('Sua Transcendência foi revogada.', '#555');
};

// ── Painel de controle de Transcendência ──
function renderTransControlList() {
  const el = document.getElementById('trans-control-list');
  const refEl = document.getElementById('trans-elementos-ref');
  if (!el) return;

  if (refEl && typeof TRANSCENDENCIA_ELEMENTOS !== 'undefined') {
    refEl.innerHTML = Object.entries(TRANSCENDENCIA_ELEMENTOS).map(([id, ed]) => `
      <div class="trans-elem-card" style="border-left-color:${ed.cor}">
        <div style="flex:1">
          <div class="trans-elem-name" style="color:${ed.cor}">${ed.nome}</div>
          <div class="trans-elem-bonus">${ed.bonus_desc || '—'}</div>
          ${ed.ritual_gratis ? `<div class="trans-elem-ritual">✦ Ritual grátis: ${ed.ritual_gratis}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  const users = Object.keys(db.users || {}).filter(u => u !== 'billy');
  if (!users.length) {
    el.innerHTML = '<div style="font-family:\'Courier Prime\',monospace;font-size:12px;color:#3a3020">Nenhum agente registrado.</div>';
    return;
  }

  el.innerHTML = users.map(u => {
    const c = db.characters[u] || {};
    const nex = parseInt(c.nex) || 5;
    const liberada = _mestreTransLiberada(u);
    const jaTransc = !!(c.transcendencia && c.transcendencia.elemento);
    const nexPct = Math.min(100, Math.round(nex / 99 * 100));
    const elegivel = nex >= 50;

    let statusHtml, actionHtml;
    if (jaTransc) {
      const elemNome = c.transcendencia.nome || c.transcendencia.elemento;
      const totalElem = (typeof RITUAIS_DB!=='undefined') ? RITUAIS_DB.filter(r => r.elem === elemNome).length : 0;
      const desbElem = (typeof RITUAIS_DB!=='undefined') ? RITUAIS_DB.filter(r => r.elem === elemNome && c.rituaisAprendidos && c.rituaisAprendidos[r.nome]).length : 0;
      const semRituaisRestantes = totalElem > 0 && desbElem >= totalElem;
      statusHtml = `<span class="trans-status-badge transcendeu">✦ ${elemNome} — ${desbElem}/${totalElem} rituais</span>${liberada?` <span class="trans-status-badge liberado">◈ Liberado</span>`:''}`;
      actionHtml = liberada
        ? `<button class="noir-btn danger" onclick="mestreRevogarTranscendencia('${u}')" style="font-size:9px;padding:5px 10px">Revogar</button>`
        : `<button class="noir-btn accent" onclick="mestreLiberarTranscendencia('${u}')" style="font-size:9px;padding:5px 10px">${semRituaisRestantes ? '⛧ Nova Transcendência' : 'Liberar novo ritual'}</button>`;
    } else if (liberada) {
      statusHtml = `<span class="trans-status-badge liberado">◈ Liberado</span>`;
      actionHtml = `<button class="noir-btn danger" onclick="mestreRevogarTranscendencia('${u}')" style="font-size:9px;padding:5px 10px">Revogar</button>`;
    } else {
      statusHtml = `<span class="trans-status-badge bloqueado">— Bloqueado</span>`;
      actionHtml = elegivel
        ? `<button class="noir-btn accent" onclick="mestreLiberarTranscendencia('${u}')" style="font-size:9px;padding:5px 10px">Liberar</button>`
        : `<span style="font-family:'Courier Prime',monospace;font-size:9px;color:#3a2a10;letter-spacing:.1em">NEX insuf.</span>`;
    }

    return `
      <div class="trans-agent-card">
        <div style="flex:1;min-width:120px">
          <div class="trans-agent-name">${c.nome || u}</div>
          <div class="trans-agent-meta">${c.classe || '—'} · NEX ${nex}%</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <div class="trans-nex-bar"><div class="trans-nex-fill" style="width:${nexPct}%;background:${elegivel?'#c49a00':'#4a3a18'}"></div></div>
          <span style="font-family:'Courier Prime',monospace;font-size:9px;color:${elegivel?'#8a6a30':'#3a2a10'};letter-spacing:.1em">${nex >= 50 ? 'ELEGÍVEL' : 'NEX < 50%'}</span>
        </div>
        ${statusHtml}
        ${actionHtml}
      </div>
    `;
  }).join('');
}

// ── Desbloqueio manual de Rituais (independente da Transcendência) ──
function renderMestreRituaisControl() {
  const sel = document.getElementById('mestre-ritual-sel-player');
  const list = document.getElementById('mestre-ritual-control-list');
  if (!sel || !list) return;

  const users = Object.keys(db.users || {}).filter(u => u !== 'billy');
  const valorAtual = sel.value;
  sel.innerHTML = '<option value="">— Selecionar agente —</option>' + users.map(u => {
    const c = db.characters[u] || {};
    return `<option value="${u}">${c.nome || u}</option>`;
  }).join('');
  if (users.includes(valorAtual)) sel.value = valorAtual;

  const u = sel.value;
  if (!u) {
    list.innerHTML = '<div style="font-family:\'Courier Prime\',monospace;font-size:12px;color:#3a3020;grid-column:1/-1">Selecione um agente para gerenciar seus rituais.</div>';
    return;
  }
  const c = db.characters[u] || defaultChar();
  if (!c.rituaisAprendidos) c.rituaisAprendidos = {};
  const busca = (document.getElementById('mestre-ritual-busca') || {}).value || '';
  const elemFil = (document.getElementById('mestre-ritual-elem-fil') || {}).value || '';
  const filtrado = RITUAIS_DB.filter(r => {
    if (busca && !r.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (elemFil && r.elem !== elemFil) return false;
    return true;
  });
  if (!filtrado.length) {
    list.innerHTML = '<div style="font-family:\'Courier Prime\',monospace;font-size:12px;color:#3a3020;grid-column:1/-1">Nenhum ritual encontrado.</div>';
    return;
  }
  list.innerHTML = filtrado.map(r => {
    const desb = !!c.rituaisAprendidos[r.nome];
    const cor = ELEM_COR[r.elem] || '#8b0000';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(10,0,8,.5);border:1px solid ${desb?cor:'rgba(58,0,0,0.4)'};padding:8px 10px">
        <div style="min-width:0">
          <div style="font-family:'Cinzel',serif;font-size:11px;color:${desb?cor:'#9a8a7a'}">${r.nome}</div>
          <div style="font-size:9px;color:#5a5040;font-family:'Courier Prime',monospace">${r.elem} · ${r.circ===0?'Manif.':r.circ+'º círculo'}</div>
        </div>
        <button class="noir-btn ${desb?'danger':'accent'}" style="font-size:9px;padding:4px 8px;flex-shrink:0" onclick="mestreToggleRitual('${u}','${r.nome.replace(/'/g,"\\'")}')">${desb?'🔓 Revogar':'🔒 Liberar'}</button>
      </div>`;
  }).join('');
}

function mestreToggleRitual(u, nome) {
  const c = db.characters[u] || defaultChar();
  if (!c.rituaisAprendidos) c.rituaisAprendidos = {};
  const novoStatus = !c.rituaisAprendidos[nome];
  if (novoStatus) { c.rituaisAprendidos[nome] = true; } else { delete c.rituaisAprendidos[nome]; }
  db.characters[u] = c;
  saveDB();
  renderMestreRituaisControl();
  if (typeof renderTransControlList === 'function') renderTransControlList();
  toast(`Ritual "${nome}" ${novoStatus ? 'liberado' : 'revogado'} para ${c.nome || u}.`, novoStatus ? '#c49a00' : '#555');
}

// Override liberar/revogar to also refresh the transcendence panel
window.mestreLiberarTranscendencia = function(u) {
  if (!db.mestre) db.mestre = {};
  if (!db.mestre.transLiberada) db.mestre.transLiberada = {};
  db.mestre.transLiberada[u] = true;
  saveDB();
  populateMestre();
  renderTransControlList();
  const c = db.characters[u] || {};
  toast('Transcendência liberada para ' + (c.nome || u), '#c49a00');
};
window.mestreRevogarTranscendencia = function(u) {
  if (!db.mestre || !db.mestre.transLiberada) return;
  db.mestre.transLiberada[u] = false;
  saveDB();
  populateMestre();
  renderTransControlList();
  const c = db.characters[u] || {};
  toast('Transcendência revogada de ' + (c.nome || u), '#555');
};

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
function toast(msg, color){
  const el=document.getElementById('toast');
  el.textContent=msg;
  if(color) el.style.borderColor=color; else el.style.borderColor='';
  el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.classList.remove('show');el.style.borderColor='';},2800);
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
      console.warn('[Supabase] funções não disponíveis');
      return;
    }
    _doFbConnect(user, isMestreFlag);
  });
}

function _doFbConnect(user, isMestreFlag){
  // Monitora estado de conexão real e atualiza indicador visual
  if(window.fbWatchConnection){
    window.fbWatchConnection(status => {
      window._fbConnState = status;
      const connected = !!(status && status.ok);
      const info = _fbReasonInfo(status);
      const statusEl = document.getElementById('fb-status');
      if(statusEl){
        if(connected){
          statusEl.style.display = 'none'; // esconde quando conectado — o indicador "X online" já cobre isso
        } else {
          statusEl.style.display = '';
          statusEl.textContent = '○ OFFLINE';
          statusEl.title = info.text;
          statusEl.style.color = 'rgba(200,80,80,0.8)';
          statusEl.style.borderColor = 'rgba(200,80,80,0.35)';
        }
      }
      // Atualiza status bar da aba multi se estiver aberta
      _renderMoFbStatus(status);
    });
  }

  // Grava presença no Firebase
  window.fbSetPresence(user, isMestreFlag);

  // Estado mesclado: presença online + lastSeen de offline
  // Pré-popula com o próprio usuário para evitar race condition com lastSeen
  window._presenceMap = {
    [user]: { user, isMestre: !!isMestreFlag, since: window._myPresenceSince || Date.now(), online: true }
  };
  window._lastSeenMap = {};

  function _mergeAndRender(){
    renderOnlineList(window._presenceMap, window._lastSeenMap);
  }

  // Escuta lista de presença — todos os usuários (polling a cada 3s)
  if(window.fbWatchPresence){
    window.fbWatchPresence(presence => {
      window._presenceMap = presence || {};
      _mergeAndRender();
    });
  }

  // Escuta lastSeen de quem saiu
  if(window.fbWatchLastSeen){
    window.fbWatchLastSeen(lastSeen => {
      window._lastSeenMap = lastSeen || {};
      _mergeAndRender();
    });
  }

  // Atualiza os "há X min" a cada 30s sem refetch
  setInterval(() => {
    if(window._presenceMap || window._lastSeenMap) _mergeAndRender();
  }, 30000);

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
        // Guarda pendente para quando o mapa abrir (tokens/structs)
        window._pendingRemoteTokens = newTokens;
        window._pendingRemoteStructs = newStructs;
        // Só aplica no canvas se o mapa já foi inicializado
        if(!mapCtx) return;
        // Tokens: se estou arrastando o meu agora, preserva posição local
        const myTok = draggingToken && !isMestreFlag
          ? mapTokens.find(t=>t.isPlayer && t.owner===user)
          : null;
        mapTokens = newTokens;
        if(myTok){
          const idx = mapTokens.findIndex(t=>t.isPlayer && t.owner===user);
          if(idx>=0) mapTokens[idx]=myTok; else mapTokens.push(myTok);
        }
        // Estruturas: todos recebem sempre (exceto se eu estiver arrastando uma)
        if(!draggingStruct) mapStructures = newStructs;
      }catch(e){ console.warn('[mapa] sync err:',e); }
    });
  }

  // ── Chat em tempo real ──
  if(window.fbWatchChat){
    window.fbWatchChat(msgs=>{ _chatMsgs=msgs; renderChat(); });
  }
  // ── Rolagens públicas ──
  if(window.fbWatchRolls){
    window.fbWatchRolls(rolls=>{ _publicRolls=rolls; renderPublicRolls(); });
  }
  // ── Pedido de rolagem (Mestre → Jogador) ──
  if(!isMestreFlag && window.fbWatchRollRequest){
    window.fbWatchRollRequest(user, req=>{ showRollRequest(req); });
  }
  // ── Rastreador de Iniciativa ──
  if(window.fbWatchInitiative){
    window.fbWatchInitiative(data=>{ _initData=data||{combatants:[],round:1,currentIdx:0,active:false}; renderInitiativeTracker(); });
  }

  // ── Pings de atenção (só Mestre recebe) ──
  if(isMestreFlag && window.fbWatchPings){
    window.fbWatchPings(pings=>{
      renderPings(pings);
    });
  }

  // ── Whispers (mensagens privadas) — só Mestre recebe ──
  if(isMestreFlag && window.fbWatchWhispers){
    window.fbWatchWhispers(msgs=>{ renderWhispers(msgs); });
  }

  // ── Pistas reveladas pelo Mestre — todos recebem ──
  if(window.fbWatchClues){
    window.fbWatchClues(clues=>{ renderRevealedClues(clues); });
  }

  // ── Status de saúde em tempo real — todos recebem ──
  if(window.fbWatchStatus){
    window.fbWatchStatus(statusMap=>{ renderPartyStatus(statusMap); });
  }

  // ── Votação em grupo ──
  if(window.fbWatchVote){
    window.fbWatchVote(vote=>{ renderVotePanel(vote); });
  }

  // ── Baú do Grupo ──
  if(window.fbWatchBau){
    window.fbWatchBau(items=>{ renderBau(items); });
  }

  // ── Diário de Sessão ──
  if(window.fbWatchDiario){
    window.fbWatchDiario(entries=>{ renderDiario(entries); });
  }

  // ── Contador de Ameaça ──
  if(window.fbWatchAmeaca){
    window.fbWatchAmeaca(val=>{ renderAmeaca(val); });
  }

  // ── Notas do Mestre (só Mestre edita, todos leem) ──
  if(window.fbWatchNotasMestre){
    window.fbWatchNotasMestre(texto=>{ renderNotasMestre(texto); });
  }

  // ── Reações do Chat ──
  if(window.fbWatchReacoes){
    window.fbWatchReacoes(reacoes=>{ _chatReacoes=reacoes; renderChat(); });
  }

  // Todos: recebe bg do mapa quando Mestre salva (canal /mapbg via SSE)
  if(window.fbWatchBg){
    let _lastBgTs=0;
    window.fbWatchBg(data=>{
      if(!data || !data.ts) return;
      if(data.ts <= _lastBgTs) return;
      _lastBgTs = data.ts;
      if(!data.data) return;
      // Anti-eco: ignora se fui eu que publiquei
      if(data.sid && data.sid === window._mySessionId) return;
      // Salva local para uso offline / reload
      if(!db.maps) db.maps={};
      db.maps['shared'] = data.data;
      try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){}
      // applyRemoteBg: aplica imediatamente se canvas aberto, ou guarda para initMap
      applyRemoteBg(data.data);
    });
  }

  // ── Cena Ativa ──
  if(window.fbWatchCena){
    window.fbWatchCena(cena=>{ renderCenaAtiva(cena); });
  }

  // ── Timer de Pressão ──
  if(window.fbWatchTimer){
    window.fbWatchTimer(data=>{ syncTimer(data); });
  }

  // ── Foco / Spotlight ──
  if(window.fbWatchFoco){
    window.fbWatchFoco(user=>{ renderFoco(user); });
  }

  // ── Rolagens Secretas (só Mestre vê) ──
  if(isMestreFlag && window.fbWatchSecretRolls){
    window.fbWatchSecretRolls(rolls=>{ renderSecretRolls(rolls); });
  }

  // ── Clima da Cena ──
  if(window.fbWatchClima){
    window.fbWatchClima(clima=>{ renderClima(clima); });
  }

  // ── Trilha Sonora ──
  if(window.fbWatchMusica){
    window.fbWatchMusica(data=>{ renderMusica(data); });
  }
  if(window.fbWatchAmbientacao){
    window.fbWatchAmbientacao(data=>{ renderAmbientacaoSync(data); });
  }

  // ── Status de Tokens ──
  if(window.fbWatchTokenStatus){
    window.fbWatchTokenStatus(statusMap=>{ _tokenStatusMap=statusMap; if(typeof fullRedraw==='function') fullRedraw(); });
  }
}

// ═══════════════════════════════════════════════════════════════
//  FUNÇÕES MULTIPLAYER NOVAS
// ═══════════════════════════════════════════════════════════════

// ── Publica meu status de HP/SAN/PE ──
function _publishMyStatus(){
  if(!currentUser || !window.fbPublishStatus) return;
  const c = userChar(currentUser);
  window.fbPublishStatus(currentUser, {
    nome: c.nome || currentUser,
    pv: c.pv, pvMax: c.pvMax,
    san: c.san, sanMax: c.sanMax,
    esf: c.esf, esfMax: c.esfMax,
    classe: c.classe,
    isMestre: isMestre
  });
}

// ── Renderiza painel de status da party ──
let _partyStatusData = {};
function renderPartyStatus(statusMap){
  _partyStatusData = statusMap || {};
  const el = document.getElementById('party-status-list');
  if(!el) return;
  const entries = Object.values(statusMap||{}).filter(s=>!s.isMestre);
  if(!entries.length){ el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Nenhum agente online.</div>'; return; }
  el.innerHTML = '';
  entries.sort((a,b)=>(a.nome||a.user||'').localeCompare(b.nome||b.user||'')).forEach(s=>{
    const pvPct = s.pvMax ? Math.max(0,Math.min(100,Math.round(s.pv/s.pvMax*100))) : 0;
    const sanPct = s.sanMax ? Math.max(0,Math.min(100,Math.round(s.san/s.sanMax*100))) : 0;
    const pvCol = pvPct>50?'#22cc66':pvPct>25?'#c49a00':'#cc2222';
    const sanCol = sanPct>50?'#5b9cf6':sanPct>25?'#bb88ff':'#cc2222';
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px;border:1px solid rgba(139,0,0,0.25);margin-bottom:6px;background:rgba(10,0,8,0.4)';
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-family:'Cinzel',serif;font-size:11px;color:var(--gold-light);letter-spacing:.06em">${s.nome||s.user}</span>
        <span style="font-size:10px;color:var(--white-dust);font-family:'Oswald',sans-serif">${s.classe||''}</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:3px">
        <span style="font-size:10px;color:#e88;font-family:monospace;width:22px">PV</span>
        <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pvPct}%;background:${pvCol};transition:width .4s"></div>
        </div>
        <span style="font-size:10px;color:#e88;font-family:monospace;min-width:40px;text-align:right">${s.pv}/${s.pvMax}</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:10px;color:#8af;font-family:monospace;width:22px">SAN</span>
        <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${sanPct}%;background:${sanCol};transition:width .4s"></div>
        </div>
        <span style="font-size:10px;color:#8af;font-family:monospace;min-width:40px;text-align:right">${s.san}/${s.sanMax}</span>
      </div>`;
    el.appendChild(row);
  });
}

// ── Pings de atenção ──
let _pingData = {};
function renderPings(pings){
  _pingData = pings || {};
  const el = document.getElementById('pings-list');
  if(!el) return;
  const entries = Object.values(pings||{});
  if(!entries.length){ el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Nenhum ping.</div>'; return; }
  el.innerHTML='';
  entries.sort((a,b)=>(b.ts||0)-(a.ts||0)).forEach(p=>{
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 8px;border:1px solid rgba(196,154,0,0.3);margin-bottom:5px;background:rgba(20,15,0,0.5)';
    const t=p.ts?new Date(p.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    row.innerHTML=`<span style="font-size:16px">🔔</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--gold-light);font-family:'Cinzel',serif">${p.user}</div>
        <div style="font-size:11px;color:var(--white-ash);font-family:'Courier Prime',monospace">${p.msg||''}</div>
        <div style="font-size:10px;color:var(--white-dust)">${t}</div>
      </div>
      <button onclick="if(window.fbClearPing)window.fbClearPing('${p.user}')" style="background:transparent;border:1px solid rgba(139,0,0,0.4);color:var(--white-dust);font-size:10px;padding:2px 7px;cursor:pointer;font-family:'Oswald',sans-serif">OK</button>`;
    el.appendChild(row);
  });
  // Notificação visual para o mestre
  const badge = document.getElementById('ping-badge');
  if(badge) badge.textContent = entries.length || '';
}

// ── Whispers ──
let _whisperData = [];
function renderWhispers(msgs){
  _whisperData = msgs || [];
  const el = document.getElementById('whispers-list');
  if(!el) return;
  if(!msgs||!msgs.length){ el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Nenhuma mensagem.</div>'; return; }
  el.innerHTML='';
  msgs.slice(-20).reverse().forEach(m=>{
    const row=document.createElement('div');
    row.style.cssText='padding:7px 10px;border-left:3px solid #bb88ff;margin-bottom:6px;background:rgba(10,0,15,0.5)';
    const t=m.ts?new Date(m.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    row.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:3px">
      <span style="font-size:11px;color:#bb88ff;font-family:'Cinzel',serif">${m.from}</span>
      <span style="font-size:10px;color:var(--white-dust)">${t}</span>
    </div>
    <div style="font-size:12px;color:var(--white-ash);font-family:'Courier Prime',monospace">${m.msg}</div>`;
    el.appendChild(row);
  });
}

// ── Pistas reveladas ──
let _cluesData = [];
function renderRevealedClues(clues){
  _cluesData = clues || [];
  const el = document.getElementById('revealed-clues-list');
  if(!el) return;
  if(!clues||!clues.length){ el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Nenhuma pista revelada.</div>'; return; }
  el.innerHTML='';
  clues.slice(-30).reverse().forEach(c=>{
    const col = {pista:'#c49a00',npc:'#1fc8a0',local:'#5b9cf6',ocult:'#bb88ff'}[c.tipo]||'#888';
    const row=document.createElement('div');
    row.style.cssText=`padding:8px 10px;border-left:3px solid ${col};margin-bottom:6px;background:rgba(10,0,8,0.5)`;
    const t=c.ts?new Date(c.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    row.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:3px">
      <span style="font-size:10px;color:${col};text-transform:uppercase;letter-spacing:.08em;font-family:'Oswald',sans-serif">${c.tipo||'pista'}</span>
      <span style="font-size:10px;color:var(--white-dust)">${t}</span>
    </div>
    <div style="font-size:12px;color:var(--white-ash);font-family:'IM Fell English',serif;font-style:italic">${c.texto}</div>`;
    el.appendChild(row);
  });
  // Notificação
  const badge = document.getElementById('clue-badge');
  if(badge){ badge.textContent=clues.length||''; badge.style.display=clues.length?'':'none'; }
}

// ── Votação ──
let _voteData = null;
function renderVotePanel(vote){
  _voteData = vote;
  const el = document.getElementById('vote-panel');
  if(!el) return;
  if(!vote || !vote.active){ el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Nenhuma votação ativa.</div>'; return; }
  const opts = vote.options||['Sim','Não'];
  const votes = vote.votes||{};
  const myVote = votes[currentUser]?.option;
  const counts = {};
  opts.forEach(o=>counts[o]=0);
  Object.values(votes).forEach(v=>{ if(counts[v.option]!==undefined) counts[v.option]++; });
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  el.innerHTML = `
    <div style="font-size:13px;color:var(--gold-light);font-family:'Cinzel',serif;margin-bottom:10px">${vote.question}</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
      ${opts.map(o=>{
        const pct = total>0?Math.round(counts[o]/total*100):0;
        const isMine = myVote===o;
        return `<button onclick="castMyVote('${o}')"
          style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${isMine?'rgba(139,0,0,0.25)':'rgba(20,0,15,0.4)'};
          border:1px solid ${isMine?'#cc0000':'rgba(139,0,0,0.3)'};color:${isMine?'var(--white-bone)':'var(--white-ash)'};
          cursor:pointer;text-align:left;font-family:'Oswald',sans-serif;font-size:12px;letter-spacing:.05em;transition:all .2s">
          <span style="flex:1">${o}</span>
          <span style="font-size:10px;color:var(--gold-light)">${counts[o]} voto${counts[o]!==1?'s':''} (${pct}%)</span>
          ${isMine?'<span style="color:#cc0000;font-size:14px">✓</span>':''}
        </button>`;
      }).join('')}
    </div>
    ${isMestre?`<button onclick="if(window.fbEndVote)window.fbEndVote()" style="width:100%;padding:7px;background:transparent;border:1px solid rgba(139,0,0,0.4);color:var(--white-dust);font-size:11px;cursor:pointer;font-family:'Oswald',sans-serif;letter-spacing:.08em;text-transform:uppercase">Encerrar Votação</button>`:''}`;
}

function castMyVote(option){
  if(!currentUser || !window.fbCastVote) return;
  window.fbCastVote(currentUser, option);
  toast('Voto registrado: '+option);
}

function startVote(){
  const q = prompt('Pergunta para votação:');
  if(!q) return;
  const optsStr = prompt('Opções (separadas por vírgula):', 'Sim,Não') || 'Sim,Não';
  const opts = optsStr.split(',').map(s=>s.trim()).filter(Boolean);
  if(window.fbStartVote) window.fbStartVote(q, opts);
  toast('Votação iniciada!');
}

function pingMestre(){
  const msg = document.getElementById('ping-msg')?.value?.trim() || 'Preciso de atenção!';
  if(window.fbPingMestre) window.fbPingMestre(currentUser, msg);
  if(document.getElementById('ping-msg')) document.getElementById('ping-msg').value='';
  toast('🔔 Sinal enviado ao Mestre!');
}

function sendWhisper(){
  const msg = document.getElementById('whisper-inp')?.value?.trim();
  if(!msg){ toast('Digite uma mensagem.'); return; }
  if(window.fbWhisper) window.fbWhisper(currentUser, msg);
  document.getElementById('whisper-inp').value='';
  toast('Mensagem enviada ao Mestre.');
}

function revealClue(){
  const txt = document.getElementById('clue-reveal-inp')?.value?.trim();
  const tipo = document.getElementById('clue-reveal-tipo')?.value || 'pista';
  if(!txt){ toast('Digite o texto da pista.'); return; }
  if(window.fbRevealClue) window.fbRevealClue({texto:txt, tipo});
  document.getElementById('clue-reveal-inp').value='';
  toast('⛧ Pista revelada para todos!');
}

// ══════════════════════════════════════════════════════════════
// NOVAS FUNÇÕES MULTIPLAYER
// ══════════════════════════════════════════════════════════════

// ── BAÚ DO GRUPO ──
let _bauData = [];
function renderBau(items){
  _bauData = items || [];
  const el = document.getElementById('bau-list');
  if(!el) return;
  if(!items||!items.length){
    el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Baú vazio.</div>';
    return;
  }
  el.innerHTML='';
  items.forEach(item=>{
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid rgba(139,0,0,0.22);margin-bottom:5px;background:rgba(10,0,8,0.5)';
    const tipoIcon = {item:'📦',arma:'⚔',reliquia:'💎',consumivel:'🧪',documento:'📄'}[item.tipo]||'📦';
    row.innerHTML=`
      <span style="font-size:16px;flex-shrink:0">${tipoIcon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--white-bone);font-family:'Cinzel',serif">${item.nome||'Item'}</div>
        ${item.desc?`<div style="font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace;line-height:1.4">${item.desc}</div>`:''}
        <div style="font-size:10px;color:var(--white-dust);margin-top:2px">${item.quem||''} <span style="color:rgba(255,255,255,0.3)">${item.ts?new Date(item.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''}</span></div>
      </div>
      ${isMestre?`<button onclick="if(window.fbRemoveBauItem)window.fbRemoveBauItem('${item._key}')" style="background:transparent;border:1px solid rgba(139,0,0,0.4);color:var(--white-dust);font-size:10px;padding:2px 7px;cursor:pointer;font-family:'Oswald',sans-serif;flex-shrink:0">✕</button>`:''}`;
    el.appendChild(row);
  });
}

function addBauItem(){
  const nome = document.getElementById('bau-nome')?.value?.trim();
  const desc = document.getElementById('bau-desc')?.value?.trim();
  const tipo = document.getElementById('bau-tipo')?.value||'item';
  if(!nome){ toast('Digite o nome do item.'); return; }
  if(window.fbAddBauItem) window.fbAddBauItem({nome, desc, tipo, quem: currentUser});
  document.getElementById('bau-nome').value='';
  if(document.getElementById('bau-desc')) document.getElementById('bau-desc').value='';
  toast('📦 Item adicionado ao Baú!');
}

// ── DIÁRIO DE SESSÃO ──
let _diarioData = [];
function renderDiario(entries){
  _diarioData = entries || [];
  const el = document.getElementById('diario-list');
  if(!el) return;
  if(!entries||!entries.length){
    el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Diário vazio. Registre o que aconteceu na sessão.</div>';
    return;
  }
  el.innerHTML='';
  [...entries].reverse().forEach(e=>{
    const tipoCol={fato:'#c49a00',npc:'#1fc8a0',combate:'#cc2222',descoberta:'#5b9cf6',humor:'#bb88ff'}[e.tipo]||'#888';
    const tipoIcon={fato:'📝',npc:'👤',combate:'⚔',descoberta:'🔍',humor:'💀'}[e.tipo]||'📝';
    const row=document.createElement('div');
    row.style.cssText=`padding:8px 10px;border-left:3px solid ${tipoCol};margin-bottom:6px;background:rgba(10,0,8,0.5)`;
    const t=e.ts?new Date(e.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''
    row.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:10px;color:${tipoCol};text-transform:uppercase;letter-spacing:.08em;font-family:'Oswald',sans-serif">${tipoIcon} ${e.tipo||'fato'}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:10px;color:var(--white-dust)">${e.quem||''} ${t}</span>
          ${(isMestre||e.quem===currentUser)?`<button onclick="if(window.fbDeleteDiarioEntry)window.fbDeleteDiarioEntry('${e._key}')" style="background:transparent;border:none;color:rgba(200,50,50,0.6);font-size:11px;cursor:pointer;padding:0 3px">✕</button>`:''}
        </div>
      </div>
      <div style="font-size:12px;color:var(--white-ash);font-family:'IM Fell English',serif;font-style:italic;line-height:1.5">${e.texto}</div>`;
    el.appendChild(row);
  });
}

function addDiarioEntry(){
  const texto = document.getElementById('diario-inp')?.value?.trim();
  const tipo = document.getElementById('diario-tipo')?.value||'fato';
  if(!texto){ toast('Digite o registro.'); return; }
  if(window.fbAddDiarioEntry) window.fbAddDiarioEntry({texto, tipo, quem: currentUser});
  document.getElementById('diario-inp').value='';
  toast('📝 Registro adicionado ao Diário!');
}

// ── CONTADOR DE AMEAÇA ──
let _ameacaVal = 0;
function renderAmeaca(val){
  _ameacaVal = typeof val === 'number' ? val : 0;
  const el = document.getElementById('ameaca-valor');
  const bar = document.getElementById('ameaca-bar');
  const label = document.getElementById('ameaca-label');
  if(el) el.textContent = _ameacaVal;
  if(bar) bar.style.width = Math.min(100,_ameacaVal) + '%';
  const danger = _ameacaVal >= 75 ? '#cc2222' : _ameacaVal >= 50 ? '#c49a00' : _ameacaVal >= 25 ? '#bb88ff' : '#22cc66';
  if(bar) bar.style.background = danger;
  const labels = ['Calma Aparente','Tensão Crescente','Perigo Iminente','CALAMIDADE'];
  if(label) { label.textContent = labels[Math.min(3,Math.floor(_ameacaVal/25))]; label.style.color = danger; }
}

function ajustarAmeaca(delta){
  if(!isMestre){ toast('Apenas o Mestre controla a ameaça.'); return; }
  const novo = Math.max(0, Math.min(100, _ameacaVal + delta));
  renderAmeaca(novo); // feedback imediato — não espera o Firebase responder
  if(window.fbSetAmeaca) window.fbSetAmeaca(novo);
}

// ── NOTAS DO MESTRE ──
let _notasTimeout = null;
function renderNotasMestre(texto){
  _notasMestreCache = texto || '';
  const el = document.getElementById('notas-mestre-display');
  const inp = document.getElementById('notas-mestre-inp');
  if(el) el.innerHTML = texto ? texto.split('\n').map(l=>`<div>${l||'&nbsp;'}</div>`).join('') : '<div style="color:var(--white-dust);font-style:italic">Sem notas do Mestre.</div>';
  // Não sobrescreve o input enquanto o mestre está digitando
  if(inp && !isMestre) inp.value = texto||'';
}

function onNotasMestreInput(){
  clearTimeout(_notasTimeout);
  _notasTimeout = setTimeout(()=>{
    const texto = document.getElementById('notas-mestre-inp')?.value||'';
    if(window.fbSetNotasMestre) window.fbSetNotasMestre(texto);
  }, 800);
}

// ── REAÇÕES NO CHAT ──
let _chatReacoes = {};
const REACAO_EMOJIS = ['👍','❤','💀','😱','🔥','⛧'];

function toggleReacaoMenu(msgKey, btn){
  // Fecha qualquer menu aberto
  document.querySelectorAll('.reacao-menu').forEach(m=>{ if(m.dataset.key!==msgKey) m.remove(); });
  let menu = document.querySelector(`.reacao-menu[data-key="${msgKey}"]`);
  if(menu){ menu.remove(); return; }
  menu = document.createElement('div');
  menu.className='reacao-menu';
  menu.dataset.key=msgKey;
  menu.style.cssText='position:absolute;bottom:100%;left:0;display:flex;gap:4px;background:rgba(8,0,6,.97);border:1px solid rgba(139,0,0,0.4);padding:5px 8px;z-index:50;border-radius:2px;box-shadow:0 2px 12px rgba(0,0,0,.6)';
  REACAO_EMOJIS.forEach(e=>{
    const b=document.createElement('button');
    b.textContent=e;
    b.style.cssText='background:transparent;border:none;font-size:16px;cursor:pointer;padding:2px;border-radius:2px;transition:transform .1s';
    b.onmouseover=()=>b.style.transform='scale(1.3)';
    b.onmouseout=()=>b.style.transform='scale(1)';
    b.onclick=()=>{ reactToMsg(msgKey,e); menu.remove(); };
    menu.appendChild(b);
  });
  btn.parentElement.style.position='relative';
  btn.parentElement.appendChild(menu);
  setTimeout(()=>document.addEventListener('click',()=>menu.remove(),{once:true}),50);
}

function reactToMsg(msgKey, emoji){
  if(!currentUser||!window.fbAddReacao) return;
  const existing = _chatReacoes[msgKey]?.[currentUser]?.emoji;
  if(existing===emoji) window.fbRemoveReacao(msgKey, currentUser);
  else window.fbAddReacao(msgKey, emoji, currentUser);
}

function _applyRoleUI(){
  // Botão de votação só aparece para Mestre
  const voteBtn = document.getElementById('start-vote-btn');
  if(voteBtn) voteBtn.style.display = isMestre ? '' : 'none';
  // Revelar pistas: só Mestre
  const clueRow = document.getElementById('clue-reveal-row');
  if(clueRow) clueRow.style.display = isMestre ? '' : 'none';
  // Comunicações: Mestre vê pings/whispers, player vê input
  const playerComms = document.getElementById('player-comms');
  const mestreComms = document.getElementById('mestre-comms');
  if(playerComms) playerComms.style.display = isMestre ? 'none' : '';
  if(mestreComms){ mestreComms.style.display = isMestre ? 'flex' : 'none'; mestreComms.style.flexDirection='column'; }
  // Chat clear btn: só Mestre
  const chatClear = document.getElementById('chat-clear-btn');
  if(chatClear) chatClear.style.display = isMestre ? '' : 'none';
  // Notas do Mestre: Mestre vê input, jogadores veem display
  const notasInp = document.getElementById('notas-mestre-inp-row');
  const notasDisplay = document.getElementById('notas-mestre-display-row');
  if(notasInp) notasInp.style.display = isMestre ? '' : 'none';
  if(notasDisplay) notasDisplay.style.display = isMestre ? 'none' : '';
  // Ameaça: controles só para Mestre
  const ameacaCtrl = document.getElementById('ameaca-controles');
  if(ameacaCtrl) ameacaCtrl.style.display = isMestre ? 'flex' : 'none';
  // Diário: botão limpar só para Mestre
  const diarioClear = document.getElementById('diario-clear-btn');
  if(diarioClear) diarioClear.style.display = isMestre ? '' : 'none';
  // Baú do Grupo: botão limpar só para Mestre
  const bauClear = document.getElementById('bau-clear-btn');
  if(bauClear) bauClear.style.display = isMestre ? '' : 'none';
  updateApplyRoleUINovas();
}

function showCommsTab(tab){
  const pingsPanel = document.getElementById('comms-pings');
  const whispersPanel = document.getElementById('comms-whispers');
  const pingBtn = document.getElementById('comms-tab-pings');
  const whispBtn = document.getElementById('comms-tab-whispers');
  if(tab==='pings'){
    if(pingsPanel) pingsPanel.style.display='';
    if(whispersPanel) whispersPanel.style.display='none';
    if(pingBtn) pingBtn.style.background='rgba(20,15,0,0.8)';
    if(whispBtn) whispBtn.style.background='rgba(10,5,15,0.5)';
  } else {
    if(pingsPanel) pingsPanel.style.display='none';
    if(whispersPanel) whispersPanel.style.display='';
    if(pingBtn) pingBtn.style.background='rgba(20,15,0,0.5)';
    if(whispBtn) whispBtn.style.background='rgba(10,5,30,0.8)';
  }
}

// ── Helpers de tempo relativo ──
function _relTime(ms){
  if(!ms) return '';
  const diff = Math.max(0, Date.now() - ms);
  const secs = Math.floor(diff / 1000);
  if(secs < 60) return 'agora mesmo';
  const mins = Math.floor(secs / 60);
  if(mins < 60) return 'há ' + mins + 'min';
  const hrs = Math.floor(mins / 60);
  if(hrs < 24) return 'há ' + hrs + 'h' + (mins % 60 ? (mins%60)+'min' : '');
  return 'há ' + Math.floor(hrs/24) + 'd';
}
function _sessionDur(ms){
  if(!ms || ms < 5000) return '';
  const mins = Math.floor(ms / 60000);
  if(mins < 1) return '< 1min';
  if(mins < 60) return mins + 'min';
  const hrs = Math.floor(mins/60);
  return hrs + 'h' + (mins%60 ? (mins%60)+'min' : '');
}
function _onlineSince(ms){
  if(!ms) return '';
  const mins = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if(mins < 1) return 'online há menos de 1min';
  if(mins < 60) return 'online há ' + mins + 'min';
  const hrs = Math.floor(mins/60);
  return 'online há ' + hrs + 'h' + (mins%60 ? (mins%60)+'min' : '');
}

function renderOnlineList(presence, lastSeen){
  presence = presence || {};
  lastSeen = lastSeen || {};

  // Garante que o próprio usuário sempre aparece como online (evita race condition)
  if(currentUser && !presence[currentUser]){
    presence = {
      ...presence,
      [currentUser]: { user: currentUser, isMestre: !!isMestre, since: window._myPresenceSince || Date.now(), online: true }
    };
  }

  const onlineEntries = Object.values(presence);
  const onlineUsers = new Set(onlineEntries.map(p => p.user));

  // Offline: tem lastSeen, não está online agora, e NÃO é o currentUser
  const offlineEntries = Object.values(lastSeen).filter(ls =>
    ls && ls.user && !onlineUsers.has(ls.user) && ls.user !== currentUser
  );

  // ── Atualiza indicador da topbar ──
  const indicator = document.getElementById('online-indicator');
  const countEl   = document.getElementById('online-count');
  const popupList = document.getElementById('online-popup-list');
  const totalOnline = onlineEntries.length;

  if(indicator){
    if(totalOnline > 0){
      indicator.style.display = '';
      if(countEl) countEl.textContent = totalOnline;
    } else {
      indicator.style.display = 'none';
    }
  }

  // ── Popup (topbar) ──
  if(popupList){
    popupList.innerHTML = '';
    if(!totalOnline && !offlineEntries.length){
      popupList.innerHTML = '<span style="color:var(--white-dust);font-size:12px">Nenhum agente online.</span>';
    } else {
      // Online
      onlineEntries.forEach(p => {
        const row = document.createElement('div');
        row.className = 'presence-row';
        const dur = _onlineSince(p.since);
        row.innerHTML =
          `<span class="presence-dot presence-dot--online"></span>` +
          `<span class="presence-name${p.isMestre?' presence-name--mestre':''}">${p.isMestre?'⛧ ':''}${p.user}</span>` +
          `<span class="presence-time">${dur}</span>`;
        popupList.appendChild(row);
      });
      // Separador se houver offline
      if(offlineEntries.length){
        const sep = document.createElement('div');
        sep.style.cssText = 'border-top:1px solid rgba(139,0,0,0.2);margin:6px 0 4px;';
        popupList.appendChild(sep);
        const label = document.createElement('div');
        label.style.cssText = 'font-size:9px;letter-spacing:.12em;color:var(--white-dust);text-transform:uppercase;margin-bottom:4px;';
        label.textContent = 'Vistos recentemente';
        popupList.appendChild(label);
        offlineEntries.sort((a,b) => (b.lastSeen||0)-(a.lastSeen||0)).slice(0,4).forEach(ls => {
          const row = document.createElement('div');
          row.className = 'presence-row';
          const ago = _relTime(ls.lastSeen);
          const dur = ls.sessionDuration ? ' · '+_sessionDur(ls.sessionDuration) : '';
          row.innerHTML =
            `<span class="presence-dot presence-dot--offline"></span>` +
            `<span class="presence-name presence-name--offline">${ls.isMestre?'⛧ ':''}${ls.user}</span>` +
            `<span class="presence-time">${ago}${dur}</span>`;
          popupList.appendChild(row);
        });
      }
    }
  }

  // ── Painel da aba Mestre ──
  const el = document.getElementById('online-list');
  if(!el){ renderFocoButtons(presence); return; }

  el.innerHTML = '';
  if(!totalOnline && !offlineEntries.length){
    el.innerHTML = '<span style="color:var(--white-dust);font-size:12px">Nenhum agente online.</span>';
    renderFocoButtons(presence);
    return;
  }

  // Online cards
  onlineEntries.forEach(p => {
    const card = document.createElement('div');
    card.className = 'online-card' + (p.isMestre ? ' mestre-card' : '');
    const dur = _onlineSince(p.since);
    const kickBtn = (isMestre && !p.isMestre && p.user !== currentUser)
      ? `<button class="kick-btn" onclick="fbKickPlayer('${p.user}')" title="Desconectar agente">✕</button>`
      : '';
    card.innerHTML =
      `<span class="o-dot"></span>` +
      `<span>${p.isMestre ? '⛧ ' : ''}${p.user}</span>` +
      `<span style="font-size:10px;color:#44cc88;margin-left:4px;opacity:.8">${dur}</span>` +
      kickBtn;
    el.appendChild(card);
  });

  // Offline cards (últimos vistos)
  if(offlineEntries.length){
    const divider = document.createElement('div');
    divider.style.cssText = 'width:100%;border-top:1px solid rgba(139,0,0,0.2);margin:6px 0 4px;font-size:9px;letter-spacing:.12em;color:var(--white-dust);text-transform:uppercase;';
    divider.textContent = 'Offline';
    el.appendChild(divider);
    offlineEntries.sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0)).forEach(ls => {
      const card = document.createElement('div');
      card.className = 'online-card online-card--offline' + (ls.isMestre ? ' mestre-card' : '');
      const ago = _relTime(ls.lastSeen);
      const dur = ls.sessionDuration ? ' · '+_sessionDur(ls.sessionDuration) : '';
      card.innerHTML =
        `<span class="o-dot o-dot--offline"></span>` +
        `<span style="opacity:.55">${ls.isMestre?'⛧ ':''}${ls.user}</span>` +
        `<span style="font-size:10px;color:var(--white-dust);margin-left:4px">${ago}${dur}</span>`;
      el.appendChild(card);
    });
  }

  renderFocoButtons(presence);
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
  if(!window.fbBroadcast){toast('Supabase não conectado.');return;}
  window.fbBroadcast(msg, currentUser);
  if(inp) inp.value = '';
  toast('⛧ Mensagem enviada a todos.');
}

function fbKickPlayer(user){
  if(!isMestre){return;}
  if(!confirm('Desconectar o agente "' + user + '"?'))return;
  if(!window.fbKick){toast('Supabase não conectado.');return;}
  window.fbKick(user);
  toast('Agente ' + user + ' desconectado.');
}


// ══════════════════════════════════════════════════════════════
// NOVAS FUNÇÕES MULTIPLAYER — CENA / TIMER / FOCO / CLIMA / MUSICA / ROLAGEM SECRETA / TOKEN STATUS
// ══════════════════════════════════════════════════════════════

// ── CENA ATIVA ──
const CENAS_LISTA = [
  {id:'abertura',    label:'Abertura',          icon:'🌑', cor:'#5b9cf6'},
  {id:'investigacao',label:'Investigação',       icon:'🔍', cor:'#c49a00'},
  {id:'tensao',      label:'Tensão',             icon:'⚡', cor:'#bb88ff'},
  {id:'combate',     label:'Combate',            icon:'⚔',  cor:'#cc2222'},
  {id:'descanso',    label:'Interlúdio',         icon:'🌙', cor:'#1fc8a0'},
  {id:'revelacao',   label:'Revelação',          icon:'👁',  cor:'#ff8800'},
  {id:'encerramento',label:'Encerramento',       icon:'🔻', cor:'#888'},
];
let _cenaAtiva = null;
function renderCenaAtiva(cena){
  _cenaAtiva = cena;
  const el = document.getElementById('cena-ativa-display');
  const playerEl = document.getElementById('cena-ativa-player');
  const c = CENAS_LISTA.find(x=>x.id===cena);
  const label = c ? c.icon+' '+c.label : (cena||'—');
  const cor = c ? c.cor : '#888';
  if(el){
    el.textContent = label;
    el.style.color = cor;
    el.style.borderColor = cor.replace(')',',0.4)').replace('rgb','rgba');
  }
  if(playerEl){
    playerEl.textContent = label;
    playerEl.style.color = cor;
    playerEl.style.borderColor = cor.replace(')',',0.4)').replace('rgb','rgba');
    playerEl.style.display = cena ? '' : 'none';
  }
  // Botões de seleção
  document.querySelectorAll('.cena-btn').forEach(b=>{
    b.style.background = b.dataset.cena===cena ? 'rgba(139,0,0,0.25)' : 'rgba(10,0,8,0.5)';
    b.style.borderColor = b.dataset.cena===cena ? cor : 'rgba(139,0,0,0.3)';
  });
}
function setCena(id){
  if(!isMestre){ toast('Apenas o Mestre controla a cena.'); return; }
  const cena = _cenaAtiva===id ? null : id;
  renderCenaAtiva(cena); // feedback imediato
  if(window.fbSetCena) window.fbSetCena(cena);
}
function renderCenaControls(){
  const el = document.getElementById('cena-controles');
  if(!el) return;
  el.innerHTML = CENAS_LISTA.map(c=>
    `<button class="cena-btn" data-cena="${c.id}" onclick="setCena('${c.id}')"
      style="padding:5px 10px;font-size:11px;font-family:'Oswald',sans-serif;letter-spacing:.06em;
      background:rgba(10,0,8,0.5);border:1px solid rgba(139,0,0,0.3);color:var(--white-ash);
      cursor:pointer;transition:all .2s">${c.icon} ${c.label}</button>`
  ).join('');
}

// ── TIMER DE PRESSÃO ──
let _timerInterval = null;
let _timerData = null;
function syncTimer(data){
  _timerData = data;
  if(_timerInterval){ clearInterval(_timerInterval); _timerInterval=null; }
  const el = document.getElementById('timer-display');
  const bar = document.getElementById('timer-bar');
  const label = document.getElementById('timer-label');
  if(!data || !data.active){
    if(el) el.textContent = '—';
    if(bar) bar.style.width='0%';
    if(label) label.textContent='';
    return;
  }
  const durMs = data.durSec * 1000;
  let _lastTickSec = -1; // controla para tocar só uma vez por segundo
  function tick(){
    const remaining = Math.max(0, data.endsAt - Date.now());
    const secs = Math.ceil(remaining/1000);
    const pct = Math.min(100, remaining/durMs*100);
    const col = pct>50?'#22cc66':pct>25?'#c49a00':'#cc2222';
    if(el) el.textContent = secs>0 ? `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}` : '⏰ Tempo!';
    if(bar){ bar.style.width=pct+'%'; bar.style.background=col; }
    if(label && data.label) label.textContent = data.label;
    // Toca tic-tac a cada segundo enquanto o timer está rodando
    if(remaining > 0 && secs !== _lastTickSec){
      _lastTickSec = secs;
      const urgency = Math.min(1, 1 - (pct / 100)); // 0 no início, 1 no fim
      const phase = secs % 2 === 0 ? 'tic' : 'tac';
      if(window.playTimerTick) window.playTimerTick(phase, urgency);
    }
    if(remaining<=0 && _timerInterval){ clearInterval(_timerInterval); _timerInterval=null; toast('⏰ '+( data.label||'Tempo esgotado!')); }
  }
  tick();
  _timerInterval = setInterval(tick, 500);
}
function iniciarTimer(){
  if(!isMestre){ toast('Apenas o Mestre inicia o timer.'); return; }
  const secs = parseInt(document.getElementById('timer-sec')?.value||'60', 10);
  const label = document.getElementById('timer-label-inp')?.value?.trim() || 'Timer';
  if(isNaN(secs)||secs<=0){ toast('Defina um tempo válido.'); return; }
  const data = { active:true, durSec:secs, endsAt:Date.now()+(secs*1000), label };
  syncTimer(data); // feedback imediato
  if(window.fbSetTimer) window.fbSetTimer(data);
  toast('⏱ Timer iniciado: '+label);
}
function pararTimer(){
  if(!isMestre){ toast('Apenas o Mestre controla o timer.'); return; }
  syncTimer(null); // feedback imediato
  if(window.fbClearTimer) window.fbClearTimer();
  toast('Timer encerrado.');
}

// ── FOCO / SPOTLIGHT ──
let _focoUser = null;
function renderFoco(user){
  _focoUser = user;
  const el = document.getElementById('foco-display');
  const overlay = document.getElementById('foco-overlay');
  if(el) el.textContent = user ? '⛧ '+user : '—';
  if(overlay){
    if(user && user!==currentUser){
      overlay.style.display='';
      overlay.textContent='⛧ Foco: '+user;
    } else {
      overlay.style.display='none';
    }
  }
  // Destaque no painel de presença
  document.querySelectorAll('.online-card').forEach(c=>{
    c.style.boxShadow = (c.textContent||'').includes(user||'@@NONE@@') && user
      ? '0 0 8px rgba(196,154,0,0.6)' : '';
  });
}
function darFoco(user){
  if(!isMestre){ toast('Apenas o Mestre dá foco.'); return; }
  const novo = _focoUser===user ? null : user;
  renderFoco(novo); // feedback imediato
  if(window.fbSetFoco) { if(novo) window.fbSetFoco(novo); else window.fbClearFoco(); }
}
function renderFocoButtons(presence){
  const el = document.getElementById('foco-controles');
  if(!el||!isMestre) return;
  const players = Object.values(presence||{}).filter(p=>!p.isMestre);
  if(!players.length){ el.innerHTML='<span style="font-size:11px;color:var(--white-dust)">Sem jogadores.</span>'; return; }
  el.innerHTML = players.map(p=>
    `<button onclick="darFoco('${p.user}')"
      style="padding:5px 12px;font-size:11px;font-family:'Oswald',sans-serif;letter-spacing:.05em;
      background:rgba(10,0,8,0.5);border:1px solid rgba(139,0,0,0.3);color:var(--white-ash);cursor:pointer">
      ⛧ ${p.user}</button>`
  ).join('');
}

// ── ROLAGEM SECRETA ──
let _secretRolls = [];
function renderSecretRolls(rolls){
  _secretRolls = rolls||[];
  const el = document.getElementById('secret-rolls-list');
  if(!el) return;
  if(!rolls||!rolls.length){
    el.innerHTML='<div style="color:var(--white-dust);font-size:12px">Nenhuma rolagem secreta.</div>';
    return;
  }
  el.innerHTML='';
  [...rolls].reverse().slice(0,20).forEach(r=>{
    const t=r.ts?new Date(r.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    const row=document.createElement('div');
    row.style.cssText='padding:6px 10px;border-left:3px solid #bb88ff;margin-bottom:5px;background:rgba(10,0,15,0.5)';
    row.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:11px;color:#bb88ff;font-family:'Cinzel',serif">${r.user||'?'}</span>
      <span style="font-size:10px;color:var(--white-dust)">${t}</span>
    </div>
    <div style="font-size:12px;color:var(--white-ash);font-family:'Courier Prime',monospace;margin-top:3px">
      ${r.expr||''} = <strong style="color:#fff;font-size:14px">${r.total}</strong>
      ${r.desc?`<span style="color:var(--white-dust);font-size:10px"> — ${r.desc}</span>`:''}
    </div>`;
    el.appendChild(row);
  });
  const badge=document.getElementById('secret-roll-badge');
  if(badge){ badge.textContent=rolls.length||''; badge.style.display=rolls.length?'':'none'; }
}
function rollSecret(){
  const expr = document.getElementById('secret-roll-expr')?.value?.trim()||'1d20';
  const desc = document.getElementById('secret-roll-desc')?.value?.trim()||'';
  if(!isMestre){ toast('Apenas o Mestre faz rolagens secretas.'); return; }
  // Parse simples: NdX[+/-MOD]
  const m = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if(!m){ toast('Fórmula inválida. Use NdX ou NdX+M.'); return; }
  let total=0, rolls=[];
  const n=parseInt(m[1]),x=parseInt(m[2]),mod=parseInt(m[3]||'0');
  for(let i=0;i<n;i++){ const r=Math.floor(Math.random()*x)+1; rolls.push(r); total+=r; }
  total+=mod;
  const entry={expr,total,rolls,mod,desc,user:'Mestre',ts:Date.now()};
  if(window.fbSecretRoll) window.fbSecretRoll(entry);
  else renderSecretRolls([..._secretRolls,entry]);
  toast(`🎲 [Secreto] ${expr} = ${total}`);
}

// ── CLIMA / AMBIENTE ──
const CLIMAS_LISTA = [
  {id:'neutro',    label:'Neutro',          icon:'☁',  cor:'#888'},
  {id:'chuva',     label:'Chuva',           icon:'🌧',  cor:'#5b9cf6'},
  {id:'tempestade',label:'Tempestade',      icon:'⛈',  cor:'#bb88ff'},
  {id:'neblina',   label:'Neblina',         icon:'🌫',  cor:'#aaa'},
  {id:'noite',     label:'Noite Profunda',  icon:'🌑',  cor:'#334'},
  {id:'fogo',      label:'Incêndio',        icon:'🔥',  cor:'#cc4400'},
  {id:'horror',    label:'Horror Puro',     icon:'👁',  cor:'#cc0000'},
];
let _climaAtual = null;
function renderClima(clima){
  _climaAtual = clima;
  const el = document.getElementById('clima-display');
  const playerEl = document.getElementById('clima-player');
  const c = CLIMAS_LISTA.find(x=>x.id===clima);
  const label = c ? c.icon+' '+c.label : (clima||'—');
  const cor = c ? c.cor : '#888';
  if(el){ el.textContent=label; el.style.color=cor; }
  if(playerEl){ playerEl.textContent=label; playerEl.style.color=cor; playerEl.style.display=clima?'':'none'; }
  document.querySelectorAll('.clima-btn').forEach(b=>{
    b.style.background = b.dataset.clima===clima ? 'rgba(139,0,0,0.25)' : 'rgba(10,0,8,0.5)';
  });
}
function setClima(id){
  if(!isMestre){ toast('Apenas o Mestre controla o clima.'); return; }
  const clima = _climaAtual===id ? null : id;
  renderClima(clima); // feedback imediato
  if(window.fbSetClima) window.fbSetClima(clima);
}
function renderClimaControls(){
  const el = document.getElementById('clima-controles');
  if(!el) return;
  el.innerHTML = CLIMAS_LISTA.map(c=>
    `<button class="clima-btn" data-clima="${c.id}" onclick="setClima('${c.id}')"
      style="padding:5px 10px;font-size:12px;font-family:'Oswald',sans-serif;letter-spacing:.05em;
      background:rgba(10,0,8,0.5);border:1px solid rgba(139,0,0,0.3);color:var(--white-ash);
      cursor:pointer;transition:all .2s">${c.icon} ${c.label}</button>`
  ).join('');
}

// ── TRILHA SONORA ──
// ══════════════════════════════════════════════════════════════
// SISTEMA DE ÁUDIO — TRILHA SONORA & AMBIENTAÇÃO
// Mestre faz upload para Supabase Storage → players recebem URL pública
// IndexedDB mantido como cache local (opcional, sem necessidade de reimportar)
// ══════════════════════════════════════════════════════════════

// ── Supabase Storage helpers ──
const _SB_AUDIO_BUCKET = 'audio';

function _sbStorageBase(){
  const base = _sbBase();
  return base ? base + '/storage/v1' : null;
}

function _sbStorageHeaders(isUpload){
  const h = {
    'apikey': _sbKey() || '',
    'Authorization': 'Bearer ' + (_sbKey() || ''),
  };
  if(isUpload) h['x-upsert'] = 'true';
  return h;
}

// Retorna a URL pública de uma faixa no Storage
function _sbTrackPublicURL(nome, ext){
  const base = _sbStorageBase(); if(!base) return null;
  const filename = encodeURIComponent(nome + (ext || '.mp3'));
  return base + '/object/public/' + _SB_AUDIO_BUCKET + '/' + filename;
}

// Lista todas as faixas no bucket
async function _sbListTracks(){
  const base = _sbStorageBase(); if(!base) return [];
  try{
    const r = await fetch(base + '/object/list/' + _SB_AUDIO_BUCKET, {
      method: 'POST',
      headers: { ..._sbStorageHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 200, sortBy: { column: 'name', order: 'asc' } })
    });
    if(!r.ok) return [];
    const items = await r.json();
    return Array.isArray(items) ? items : [];
  }catch(e){ return []; }
}

// Faz upload de um arquivo para o Storage
async function _sbUploadTrack(nome, ext, tipo, arrayBuffer){
  const base = _sbStorageBase(); if(!base) return null;
  const filename = nome + ext;
  try{
    const blob = new Blob([arrayBuffer], { type: tipo || 'audio/mpeg' });
    const r = await fetch(base + '/object/' + _SB_AUDIO_BUCKET + '/' + encodeURIComponent(filename), {
      method: 'POST',
      headers: _sbStorageHeaders(true),
      body: blob
    });
    return r.ok ? _sbTrackPublicURL(nome, ext) : null;
  }catch(e){ return null; }
}

// Remove uma faixa do Storage
async function _sbDeleteTrack(nome, ext){
  const base = _sbStorageBase(); if(!base) return;
  try{
    await fetch(base + '/object/' + _SB_AUDIO_BUCKET, {
      method: 'DELETE',
      headers: { ..._sbStorageHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [nome + ext] })
    });
  }catch(e){}
}

// Cache de metadados de faixas do Storage (nome sem ext -> {ext, url, size})
let _sbTracksCache = null;
let _sbTracksCacheTs = 0;

async function _sbGetTracksCache(force){
  const now = Date.now();
  if(!force && _sbTracksCache && (now - _sbTracksCacheTs) < 15000) return _sbTracksCache;
  const items = await _sbListTracks();
  _sbTracksCache = {};
  for(const item of items){
    if(!item.name) continue;
    const dotIdx = item.name.lastIndexOf('.');
    const ext  = dotIdx >= 0 ? item.name.slice(dotIdx) : '';
    const nome = dotIdx >= 0 ? item.name.slice(0, dotIdx) : item.name;
    _sbTracksCache[nome] = {
      ext,
      url: _sbTrackPublicURL(nome, ext),
      size: item.metadata?.size || 0,
      type: item.metadata?.mimetype || 'audio/mpeg'
    };
  }
  _sbTracksCacheTs = now;
  return _sbTracksCache;
}

// ── Base de dados local (IndexedDB) — mantido como cache ──
const _AUDIO_DB_NAME = 'op_audio_v1';
const _AUDIO_STORE   = 'tracks';
let   _audioDB       = null;

function _openAudioDB(){
  return new Promise((res, rej)=>{
    if(_audioDB){ res(_audioDB); return; }
    const req = indexedDB.open(_AUDIO_DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(_AUDIO_STORE, {keyPath:'nome'});
    req.onsuccess  = e => { _audioDB = e.target.result; res(_audioDB); };
    req.onerror    = e => rej(e);
  });
}

async function _saveTrackToDB(nome, tipo, arrayBuffer){
  const db = await _openAudioDB();
  return new Promise((res, rej)=>{
    const tx = db.transaction(_AUDIO_STORE, 'readwrite');
    tx.objectStore(_AUDIO_STORE).put({nome, tipo, data: arrayBuffer, ts: Date.now()});
    tx.oncomplete = res; tx.onerror = rej;
  });
}

async function _loadTrackFromDB(nome){
  const db = await _openAudioDB();
  return new Promise((res)=>{
    const tx = db.transaction(_AUDIO_STORE, 'readonly');
    const req = tx.objectStore(_AUDIO_STORE).get(nome);
    req.onsuccess = () => res(req.result || null);
    req.onerror   = () => res(null);
  });
}

async function _listTracksFromDB(){
  const db = await _openAudioDB();
  return new Promise((res)=>{
    const tx = db.transaction(_AUDIO_STORE, 'readonly');
    const req = tx.objectStore(_AUDIO_STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

async function _deleteTrackFromDB(nome){
  const db = await _openAudioDB();
  return new Promise((res)=>{
    const tx = db.transaction(_AUDIO_STORE, 'readwrite');
    tx.objectStore(_AUDIO_STORE).delete(nome);
    tx.oncomplete = res; tx.onerror = res;
  });
}

// ── Estado dos players ──
let _trilhaPlayer  = null;  // HTMLAudioElement — trilha principal
let _ambPlayer     = null;  // HTMLAudioElement — ambientação em loop
let _trilhaVol     = 0.75;
let _ambVol        = 0.45;
let _trilhaAtual   = null;  // {nome, tipo, playing, posicao}
let _ambAtual      = null;
let _musicaAtual   = null;  // compat legada
let _audioBlobURLs = {};    // nome -> objectURL (cache temporário)

async function _getBlobURL(nome){
  if(_audioBlobURLs[nome]) return _audioBlobURLs[nome];

  // 1. Tenta Supabase Storage (URL pública — não precisa de importação local)
  const sbCache = await _sbGetTracksCache();
  if(sbCache && sbCache[nome]){
    _audioBlobURLs[nome] = sbCache[nome].url;
    return sbCache[nome].url;
  }

  // 2. Fallback: IndexedDB local (arquivos importados antes da migração)
  const rec = await _loadTrackFromDB(nome);
  if(!rec) return null;
  const blob = new Blob([rec.data], {type: rec.tipo || 'audio/mpeg'});
  const url  = URL.createObjectURL(blob);
  _audioBlobURLs[nome] = url;
  return url;
}

// ── Player de Trilha Sonora ──
async function playTrilha(nome, fromPos){
  const url = await _getBlobURL(nome);
  if(!url){ toast('⚠ Faixa "'+nome+'" não encontrada no Supabase Storage. O Mestre precisa fazer o upload novamente.'); return; }
  if(_trilhaPlayer){
    _trilhaPlayer.pause();
    _trilhaPlayer.src = '';
  }
  _trilhaPlayer = new Audio(url);
  _trilhaPlayer.volume = _trilhaVol;
  _trilhaPlayer.loop   = false;
  if(fromPos) _trilhaPlayer.currentTime = fromPos;
  _trilhaPlayer.play().catch(()=>{});
  _trilhaPlayer.ontimeupdate = () => _updateTrilhaBar();
  _trilhaPlayer.onended = () => { _trilhaAtual = null; renderTrilhaPlayerUI(); };
  renderTrilhaPlayerUI();
}

function pauseTrilha(){
  if(_trilhaPlayer && !_trilhaPlayer.paused) _trilhaPlayer.pause();
  else if(_trilhaPlayer) _trilhaPlayer.play().catch(()=>{});
  renderTrilhaPlayerUI();
}

function stopTrilha(publicar=true){
  if(_trilhaPlayer){ _trilhaPlayer.pause(); _trilhaPlayer.src=''; _trilhaPlayer=null; }
  _trilhaAtual = null;
  renderTrilhaPlayerUI();
  if(publicar && isMestre && window.fbClearMusica) window.fbClearMusica();
}

function setTrilhaVolume(v){
  _trilhaVol = v;
  if(_trilhaPlayer) _trilhaPlayer.volume = v;
}

function _updateTrilhaBar(){
  const bar = document.getElementById('trilha-progress-bar');
  const cur = document.getElementById('trilha-cur-time');
  const tot = document.getElementById('trilha-tot-time');
  if(!_trilhaPlayer) return;
  const d = _trilhaPlayer.duration || 0;
  const c = _trilhaPlayer.currentTime || 0;
  if(bar) bar.style.width = (d ? (c/d*100) : 0)+'%';
  if(cur) cur.textContent = _fmtTime(c);
  if(tot) tot.textContent = _fmtTime(d);
}

function _fmtTime(s){
  if(!isFinite(s)) return '--:--';
  const m = Math.floor(s/60);
  const ss= String(Math.floor(s%60)).padStart(2,'0');
  return m+':'+ss;
}

function seekTrilha(e){
  if(!_trilhaPlayer || !_trilhaPlayer.duration) return;
  const bar = e.currentTarget;
  const pct = e.offsetX / bar.offsetWidth;
  _trilhaPlayer.currentTime = pct * _trilhaPlayer.duration;
}

// ── Player de Ambientação ──
async function playAmbientacao(nome){
  const url = await _getBlobURL(nome);
  if(!url){ toast('⚠ Ambientação "'+nome+'" não encontrada no Supabase Storage.'); return; }
  if(_ambPlayer){ _ambPlayer.pause(); _ambPlayer.src=''; }
  _ambPlayer = new Audio(url);
  _ambPlayer.volume = _ambVol;
  _ambPlayer.loop   = true;
  _ambPlayer.play().catch(()=>{});
  renderAmbPlayerUI();
}

function stopAmbientacao(publicar=true){
  if(_ambPlayer){ _ambPlayer.pause(); _ambPlayer.src=''; _ambPlayer=null; }
  _ambAtual = null;
  renderAmbPlayerUI();
  if(publicar && isMestre && window.fbClearAmbientacao) window.fbClearAmbientacao();
}

function setAmbVolume(v){
  _ambVol = v;
  if(_ambPlayer) _ambPlayer.volume = v;
  // também atua no sistema de ambientação sintético legado
  if(window.setAmbienceVolume) window.setAmbienceVolume(v * 0.12);
}

// ── Sincronização Firebase (Mestre → Todos) ──
function publicarTrilha(nome){
  if(!isMestre){ toast('Apenas o Mestre controla a trilha.'); return; }
  _trilhaAtual = {nome};
  playTrilha(nome);
  if(window.fbSetMusica) window.fbSetMusica({nome, playing:true, ts: Date.now()});
}

function publicarAmbientacao(nome){
  if(!isMestre){ toast('Apenas o Mestre controla a ambientação.'); return; }
  _ambAtual = {nome};
  playAmbientacao(nome);
  if(window.fbSetAmbientacao) window.fbSetAmbientacao({nome, playing:true, ts: Date.now()});
}

// Recebe atualização do Firebase e sincroniza
function renderMusica(data){
  // Compatibilidade legada (string) e novo formato (objeto)
  if(typeof data === 'string') data = {nome: data};
  _musicaAtual = data ? data.nome : null;

  // Atualiza display textual
  const el       = document.getElementById('musica-display');
  const playerEl = document.getElementById('musica-player');
  const label    = data?.nome || '—';
  if(el) el.textContent = label;
  if(playerEl){ playerEl.textContent = label; playerEl.style.display = data?.nome ? '' : 'none'; }

  // Toca o arquivo para não-Mestre (Mestre já tocou localmente)
  if(!isMestre && data?.nome && data.playing){
    _trilhaAtual = data;
    playTrilha(data.nome);
  } else if(!isMestre && !data?.nome){
    stopTrilha(false);
  }

  renderTrilhaPlayerUI();
  renderBibliotecaUI();
}

function renderAmbientacaoSync(data){
  if(!isMestre && data?.nome && data.playing){
    _ambAtual = data;
    playAmbientacao(data.nome);
  } else if(!isMestre && !data?.nome){
    stopAmbientacao(false);
  }
  renderAmbPlayerUI();
}

// ── Import de Arquivos ──
function importarAudio(tipo){
  // tipo: 'trilha' ou 'ambientacao'
  if(!_sbBase()){
    toast('⚠ Supabase não configurado. Configure antes de importar músicas.');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/webm,.mp3,.ogg,.wav,.m4a';
  input.multiple = true;
  input.onchange = async (e) => {
    const files = [...e.target.files];
    if(!files.length) return;

    toast(`⏫ Enviando ${files.length} faixa(s) para o Supabase...`);
    let ok = 0, fail = 0;

    for(const f of files){
      const buf  = await f.arrayBuffer();
      const dotIdx = f.name.lastIndexOf('.');
      const ext  = dotIdx >= 0 ? f.name.slice(dotIdx) : '.mp3';
      const nome = dotIdx >= 0 ? f.name.slice(0, dotIdx) : f.name;
      const url  = await _sbUploadTrack(nome, ext, f.type || 'audio/mpeg', buf);
      if(url){
        ok++;
        // Também salva no IndexedDB local como cache
        await _saveTrackToDB(nome, f.type || 'audio/mpeg', buf);
        // Atualiza cache de URLs
        if(!_sbTracksCache) _sbTracksCache = {};
        _sbTracksCache[nome] = { ext, url, size: buf.byteLength, type: f.type || 'audio/mpeg' };
        _audioBlobURLs[nome] = url;
      } else {
        fail++;
        console.warn('[Áudio] Falha ao fazer upload de', f.name);
      }
    }

    // Invalida cache para forçar releitura
    _sbTracksCacheTs = 0;

    if(ok > 0)   toast(`🎵 ${ok} faixa(s) enviada(s) com sucesso! Todos os players já podem ouvir.`);
    if(fail > 0) toast(`⚠ ${fail} faixa(s) falharam. Verifique se o bucket "audio" existe no Supabase Storage com acesso público.`);

    renderBibliotecaUI();
    renderMusicaControls();
  };
  input.click();
}

async function deletarFaixa(nome){
  if(!confirm(`Remover "${nome}" da biblioteca?`)) return;
  // Remove do Storage
  const sbCache = await _sbGetTracksCache();
  const ext = sbCache?.[nome]?.ext || '.mp3';
  await _sbDeleteTrack(nome, ext);
  // Remove do IndexedDB local
  await _deleteTrackFromDB(nome);
  // Limpa caches
  if(_audioBlobURLs[nome]){ URL.revokeObjectURL(_audioBlobURLs[nome]); delete _audioBlobURLs[nome]; }
  if(_sbTracksCache) delete _sbTracksCache[nome];
  renderBibliotecaUI();
  renderMusicaControls();
  toast('Faixa removida.');
}

// ── Renderização do Player de Trilha ──
function renderTrilhaPlayerUI(){
  const el = document.getElementById('trilha-player-ui');
  if(!el) return;
  const nome    = _trilhaAtual?.nome || (_trilhaPlayer ? '...' : null);
  const playing = _trilhaPlayer && !_trilhaPlayer.paused;

  el.innerHTML = nome ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;min-width:0">
      <span style="font-size:14px">${playing?'▶':'⏸'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:var(--white-bone);font-family:'Oswald',sans-serif;letter-spacing:.06em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div>
        <div style="display:flex;gap:6px;font-size:10px;color:var(--white-dust);font-family:'Courier Prime',monospace;margin-top:2px">
          <span id="trilha-cur-time">0:00</span><span>/</span><span id="trilha-tot-time">--:--</span>
        </div>
      </div>
    </div>
    <div id="trilha-progress-wrap" onclick="seekTrilha(event)"
      style="height:5px;background:rgba(255,255,255,.07);border-radius:2px;cursor:pointer;margin-bottom:8px;position:relative">
      <div id="trilha-progress-bar" style="height:100%;width:0%;background:var(--crimson);border-radius:2px;transition:width .25s linear;pointer-events:none"></div>
    </div>
    <div style="display:flex;gap:5px;align-items:center">
      <button onclick="pauseTrilha()" style="flex:1;padding:4px;background:rgba(30,0,20,.7);border:1px solid rgba(139,0,0,.4);color:var(--white-bone);font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.06em;cursor:pointer">${playing?'⏸ Pausar':'▶ Continuar'}</button>
      <button onclick="stopTrilha()" style="padding:4px 8px;background:transparent;border:1px solid rgba(139,0,0,.3);color:var(--white-dust);font-size:10px;cursor:pointer;font-family:'Oswald',sans-serif">■ Stop</button>
      <label style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--white-dust);font-family:'Oswald',sans-serif;cursor:pointer">
        <span>🔊</span>
        <input type="range" min="0" max="100" value="${Math.round(_trilhaVol*100)}" oninput="setTrilhaVolume(this.value/100)"
          style="width:50px;height:3px;accent-color:var(--crimson);cursor:pointer">
      </label>
    </div>` : `<div style="color:var(--white-dust);font-size:12px;font-family:'Courier Prime',monospace;text-align:center;padding:6px 0">Nenhuma faixa tocando</div>`;
}

// ── Renderização do Player de Ambientação ──
function renderAmbPlayerUI(){
  const el = document.getElementById('amb-player-ui');
  if(!el) return;
  const nome    = _ambAtual?.nome || null;
  const playing = _ambPlayer && !_ambPlayer.paused;

  el.innerHTML = nome ? `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:13px">${playing?'🔁':'⏸'}</span>
      <div style="font-size:11px;color:var(--white-bone);font-family:'Oswald',sans-serif;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</div>
    </div>
    <div style="display:flex;gap:5px;align-items:center">
      <button onclick="if(_ambPlayer){if(_ambPlayer.paused)_ambPlayer.play();else _ambPlayer.pause();renderAmbPlayerUI();}" style="flex:1;padding:4px;background:rgba(0,20,30,.7);border:1px solid rgba(31,200,160,.3);color:#1fc8a0;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.06em;cursor:pointer">${playing?'⏸ Pausar':'▶ Retomar'}</button>
      <button onclick="stopAmbientacao()" style="padding:4px 8px;background:transparent;border:1px solid rgba(31,200,160,.2);color:var(--white-dust);font-size:10px;cursor:pointer;font-family:'Oswald',sans-serif">■</button>
      <label style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--white-dust);cursor:pointer">
        <span>🔊</span>
        <input type="range" min="0" max="100" value="${Math.round(_ambVol*100)}" oninput="setAmbVolume(this.value/100)"
          style="width:46px;height:3px;accent-color:#1fc8a0;cursor:pointer">
      </label>
    </div>` : `<div style="color:var(--white-dust);font-size:12px;font-family:'Courier Prime',monospace;text-align:center;padding:4px 0">Sem ambientação ativa</div>`;
}

// ── Biblioteca de Faixas ──
async function renderBibliotecaUI(){
  const trilhaEl = document.getElementById('trilha-lista');
  const ambEl    = document.getElementById('amb-lista');

  // Mostra loading enquanto busca do Storage
  const loadMsg = `<div style="color:var(--white-dust);font-size:11px;font-family:'Courier Prime',monospace;text-align:center;padding:8px 0">⏳ Carregando...</div>`;
  if(trilhaEl) trilhaEl.innerHTML = loadMsg;
  if(ambEl)    ambEl.innerHTML    = loadMsg;

  // Busca faixas do Supabase Storage (fonte principal, acessível por todos)
  const sbCache  = await _sbGetTracksCache(true);
  const sbNomes  = sbCache ? Object.keys(sbCache) : [];

  // Fallback: IndexedDB local (arquivos importados antes da migração)
  const local    = await _listTracksFromDB();

  // Mescla: Storage tem prioridade
  const todasNomes = [...new Set([...sbNomes, ...local.map(t=>t.nome)])];

  // Tipo: IndexedDB define se é 'ambientacao', senão é 'trilha'
  function getTipo(nome){
    const loc = local.find(t=>t.nome===nome);
    return loc?.tipo === 'ambientacao' ? 'ambientacao' : 'trilha';
  }
  function getSize(nome){
    const sb = sbCache?.[nome];
    if(sb?.size) return sb.size;
    const loc = local.find(t=>t.nome===nome);
    return loc?.data?.byteLength || 0;
  }

  const trilhas = todasNomes.filter(n=>getTipo(n)==='trilha').map(n=>({nome:n,size:getSize(n)}));
  const ambs    = todasNomes.filter(n=>getTipo(n)==='ambientacao').map(n=>({nome:n,size:getSize(n)}));

  const _faixaHTML = (faixas, onPlay) => {
    if(!faixas.length) return `<div style="color:var(--white-dust);font-size:11px;font-family:'Courier Prime',monospace;text-align:center;padding:8px 0">${_sbBase()?'Nenhuma faixa no Storage.':'Supabase não configurado.'}</div>`;
    return faixas.map(f=>`
      <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(58,0,0,.2)">
        <button onclick="${onPlay}('${f.nome.replace(/'/g,"\'")}') " title="Tocar"
          style="background:transparent;border:none;color:var(--crimson);font-size:13px;cursor:pointer;flex-shrink:0;padding:0 2px">▶</button>
        <div style="flex:1;min-width:0;font-size:11px;color:var(--white-bone);font-family:'Courier Prime',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${f.nome}">${f.nome}</div>
        <div style="font-size:10px;color:var(--white-dust);flex-shrink:0">${_fmtBytes(f.size)}</div>
        ${isMestre?`<button onclick="deletarFaixa('${f.nome.replace(/'/g,"\'")}') " style="background:transparent;border:none;color:rgba(200,50,50,.5);font-size:12px;cursor:pointer;flex-shrink:0;padding:0 3px">✕</button>`:''}      </div>`).join('');
  };

  if(trilhaEl) trilhaEl.innerHTML = _faixaHTML(trilhas, 'publicarTrilha');
  if(ambEl)    ambEl.innerHTML    = _faixaHTML(ambs,    'publicarAmbientacao');
}

function _fmtBytes(b){
  if(!b) return '';
  if(b < 1024*1024) return (b/1024).toFixed(0)+'KB';
  return (b/(1024*1024)).toFixed(1)+'MB';
}

function renderMusicaControls(){
  // mantém compatibilidade com o sistema legado de botões
  const el = document.getElementById('musica-controles');
  if(!el) return;
  el.innerHTML = isMestre ? `
    <button onclick="importarAudio('trilha')" style="padding:5px 10px;font-size:11px;font-family:'Oswald',sans-serif;letter-spacing:.05em;background:rgba(10,0,8,0.6);border:1px solid rgba(139,0,0,0.5);color:var(--crimson-mid);cursor:pointer">⬆ Upload Trilhas</button>
    <button onclick="importarAudio('ambientacao')" style="padding:5px 10px;font-size:11px;font-family:'Oswald',sans-serif;letter-spacing:.05em;background:rgba(0,10,8,0.6);border:1px solid rgba(31,200,160,0.4);color:#1fc8a0;cursor:pointer">⬆ Upload Ambientação</button>` : `
    <div style="font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace;opacity:.8">🔊 Músicas carregadas automaticamente do servidor.</div>`;
}

const MUSICAS_LISTA = []; // mantém compat sem quebrar refs

// ── STATUS DE TOKENS ──
const TOKEN_STATUS_OPTS = [
  {id:'envenenado', label:'Envenenado', icon:'☠', cor:'#55cc00'},
  {id:'abalado',    label:'Abalado',   icon:'💀', cor:'#bb88ff'},
  {id:'apavorado',  label:'Apavorado', icon:'😱', cor:'#cc2222'},
  {id:'lento',      label:'Lento',     icon:'🐌', cor:'#c49a00'},
  {id:'cego',       label:'Cego',      icon:'👁', cor:'#888'},
  {id:'indefeso',   label:'Indefeso',  icon:'⚡', cor:'#5b9cf6'},
  {id:'morto',      label:'Morto',     icon:'💀', cor:'#444'},
];
let _tokenStatusMap = {};
function setTokenStatus(tokenId, statusId){
  if(!isMestre){ toast('Apenas o Mestre altera status de tokens.'); return; }
  const current = _tokenStatusMap[tokenId]?.status;
  const novo = current===statusId ? null : statusId;
  if(window.fbSetTokenStatus){
    if(novo) window.fbSetTokenStatus(tokenId, novo);
    else window.fbClearTokenStatus(tokenId);
  } else {
    if(novo) _tokenStatusMap[tokenId]={status:novo}; else delete _tokenStatusMap[tokenId];
    if(typeof fullRedraw==='function') fullRedraw();
  }
}
function renderTokenStatusPanel(tokenId, tokenName){
  const el = document.getElementById('token-status-panel');
  if(!el) return;
  el.innerHTML=`<div style="font-size:11px;color:var(--gold-light);font-family:'Cinzel',serif;margin-bottom:8px">${tokenName||'Token'}</div>
  <div style="display:flex;flex-wrap:wrap;gap:5px">
  ${TOKEN_STATUS_OPTS.map(s=>{
    const ativo = _tokenStatusMap[tokenId]?.status===s.id;
    return `<button onclick="setTokenStatus('${tokenId}','${s.id}')"
      style="padding:4px 8px;font-size:10px;font-family:'Oswald',sans-serif;
      background:${ativo?'rgba(139,0,0,0.3)':'rgba(10,0,8,0.5)'};
      border:1px solid ${ativo?s.cor:'rgba(139,0,0,0.3)'};
      color:${ativo?s.cor:'var(--white-ash)'};cursor:pointer">
      ${s.icon} ${s.label}</button>`;
  }).join('')}
  </div>`;
}
// Hook no desenho do mapa: exibe ícone de status sobre o token
function drawTokenStatusIcons(ctx, token, cx, cy, r){
  const status = _tokenStatusMap[token.id]?.status;
  if(!status) return;
  const s = TOKEN_STATUS_OPTS.find(x=>x.id===status);
  if(!s) return;
  ctx.save();
  ctx.font = `${Math.max(10, r*0.7)}px serif`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.globalAlpha=0.9;
  ctx.fillText(s.icon, cx+r*0.5, cy-r*0.5);
  ctx.restore();
}

function _initNovasMultiplayer(){
  renderCenaControls();
  renderClimaControls();
  renderMusicaControls();
  renderTrilhaPlayerUI();
  renderAmbPlayerUI();
  renderBibliotecaUI();
}
// Chama após o DOM estar pronto (sem repetir DOMContentLoaded que já existe)
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', _initNovasMultiplayer);
} else {
  setTimeout(_initNovasMultiplayer, 0);
}

function updateApplyRoleUINovas(){
  // Cena: controles só mestre
  const cenaCtrl=document.getElementById('cena-controles');
  if(cenaCtrl) cenaCtrl.style.display=isMestre?'flex':'none';
  // Timer: controles só mestre
  const timerCtrl=document.getElementById('timer-controles');
  if(timerCtrl) timerCtrl.style.display=isMestre?'':'none';
  // Foco: controles só mestre
  const focoCtrl=document.getElementById('foco-controles');
  if(focoCtrl) focoCtrl.style.display=isMestre?'flex':'none';
  // Secret rolls: painel só mestre
  const secretPanel=document.getElementById('secret-rolls-panel');
  if(secretPanel) secretPanel.style.display=isMestre?'':'none';
  // Clima: controles só mestre
  const climaCtrl=document.getElementById('clima-controles');
  if(climaCtrl) climaCtrl.style.display=isMestre?'flex':'none';
  // Musica: controles só mestre
  const musicaCtrl=document.getElementById('musica-controles');
  if(musicaCtrl) musicaCtrl.style.display=isMestre?'flex':'none';
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
  // ── SOM DE TIC-TAC DO TIMER ──
  window.playTimerTick = function(phase, urgency){
    if(_muted) return;
    const ctx=_ctx(); if(!ctx) return;
    const t = ctx.currentTime;
    const isTic = (phase === 'tic');

    // Frequencia: tic agudo, tac um pouco mais grave; sobem com a urgencia
    const baseFreq = isTic ? (1800 + urgency * 600) : (1200 + urgency * 400);

    // Oscilador principal -- corpo do clique
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.025);
    const vol = 0.08 + urgency * 0.10;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.07);

    // Ruido de ataque curto -- textura mecanica
    const bufSize = Math.floor(ctx.sampleRate * 0.018);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const bdata = buf.getChannelData(0);
    for(let i=0;i<bufSize;i++) bdata[i]=(Math.random()*2-1);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nFilt = ctx.createBiquadFilter();
    nFilt.type = 'highpass';
    nFilt.frequency.value = 4000;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.06 + urgency * 0.06, t);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    noise.connect(nFilt); nFilt.connect(nGain); nGain.connect(ctx.destination);
    noise.start(t); noise.stop(t + 0.02);
  };

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
    // Silencia/restaura o áudio da psique também
    if(window._psiqueMasterGain && _psiqueAudioCtx){
      const pm = window._psiqueMasterGain;
      const sl2=document.getElementById('ambience-vol');
      const ratio2 = sl2 ? parseInt(sl2.value)/100 : 0.55;
      const baseVol = pm._psiqueBaseVol || 0.42;
      const pVol = _muted ? 0 : baseVol * ratio2;
      pm.gain.cancelScheduledValues(_psiqueAudioCtx.currentTime);
      pm.gain.setTargetAtTime(pVol, _psiqueAudioCtx.currentTime, 0.3);
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

});

// ══ ELEMENTOS & CRIATURAS ══
const ELEMENTOS = [
  // Morte — preto/cinza/branco (escuridão, silêncio, ausência de cor)
  { id:'morte', nome:'Morte', cor:'#555566', icone:'<span class="sym-el sym-morte" title="Morte"></span>', desc:'O elemento da cessação, do fim e do silêncio absoluto. Distorce a percepção do tempo e representa o ciclo da vida. Criaturas de Morte têm aparência pálida, sombria, com tons de preto, cinza e branco; emanam frio sobrenatural e lentidão. Rituais lidam com espíritos, necromancia e a inevitabilidade do fim.', efeitos:['Necromancia: reanimação de cadáveres como servos temporários (até fim da cena)','Visão dos Mortos: enxergar espíritos e resíduos de energia de morte no local','Toque Letal: drena 1d8 PV por turno ao custo de 1 SAN','Passagem: mover-se brevemente pelo plano dos mortos como ação de movimento'], custo:'Perda de 1d4 SAN por uso sem treinamento; falha crítica = Condição Abalado' },
  // Sangue — vermelho (emoções extremas: dor, paixão, ódio, fome)
  { id:'sangue', nome:'Sangue', cor:'#cc1111', icone:'<span class="sym-el sym-sangue" title="Sangue"></span>', desc:'O elemento mais instintivo — busca a intensidade: dor, obsessão, paixão, fome, ódio. Foi o primeiro elemento apresentado em Ordem Paranormal. Criaturas de Sangue são bestiais, agressivas, muitas vezes cegas porém com sentidos aguçados; tons avermelhados, pele exposta, garras e dentes afiados, exsudando líquido espesso. Sangue supera a razão e a calmaria do Conhecimento.', efeitos:['Laço de Sangue: rastrear qualquer ser com quem houve contato sanguíneo (até 24h)','Coagulação: selar ferimentos — recupera 2d8 PV em si mesmo ou num aliado pelo toque','Frenesi: +1d6 de dano em ataques corpo a corpo até fim da cena, mas −2 na Defesa','Memória do Sangue: reviver eventos vividos por quem doou o sangue (visão imersiva)'], custo:'Cada ritual consome 1d6 PV do agente; automutilação pode reduzir o custo em PE' },
  // Conhecimento — dourado/amarelo (lógica, saber, segredos proibidos)
  { id:'conhecimento', nome:'Conhecimento', cor:'#c8a000', icone:'<span class="sym-el sym-conhecimento" title="Conhecimento"></span>', desc:'A entidade da lógica, da sabedoria e dos segredos proibidos. Ligada aos "Sussurros do Conhecimento". Criaturas de Conhecimento são inteligentes, calculistas, pálidas com feições distorcidas e olhos sobrenaturais amarelados — capazes de usar rituais. O Conhecimento é efetivo contra a Energia, pois a razão suprime o caos. O Sangue, porém, supera o Conhecimento.', efeitos:['Rajada Mental: ataque psíquico que causa dano de Conhecimento (Vontade resiste)','Ligação Telepática: dois alvos comunicam-se por elo mental até fim da cena','Imbuing Elemental: imbuir arma com +1d6 dano de Conhecimento (Discente: +2d6)','Ordem Mental: alvo obedece um comando simples se falhar em Vontade','Enfraquecimento Mental: −2 nos testes do alvo contra rituais após falhar na resistência','Visão Proibida: perceber a estrutura paranormal do ambiente e detectar criaturas ocultas'], custo:'Teste de Vontade DT 15 sem afinidade — falha causa 1d6 de dano de SAN' },
  // Energia — roxo/ciano/rosa neon (caos, transformação, eletricidade)
  { id:'energia', nome:'Energia', cor:'#9933cc', icone:'<span class="sym-el sym-energia" title="Energia"></span>', desc:'A entidade do caos. Tudo que não pode ser explicado — o intangível, a anarquia, a constante mudança. Suas manifestações são "chamas líquidas" em tons de roxo, ciano, rosa e verde neon. Criaturas de Energia são caóticas, imprevisíveis, com olhos brilhantes e veias neon visíveis. A Energia é efetiva contra a Morte; o Conhecimento suprime a Energia.', efeitos:['Sobrecarga: destruir ou controlar equipamentos eletrônicos em alcance médio','Pulso Caótico: descarga — Teste de Reflexos ou o alvo fica Confuso por 1 rodada','Condução: mover-se a velocidade sobrenatural em linha reta (deslocamento×3, ação livre)','Escudo Estático: barreira que concede +4 Defesa e repele projéteis metálicos por 1 rodada'], custo:'Falha crítica causa 2d6 de dano ao próprio agente; itens eletrônicos em contato pifam' },
  // Medo — azul/transparente/sem cor definida (combustível do Outro Lado)
  { id:'medo', nome:'Medo', cor:'#1155aa', icone:'<span class="sym-el sym-medo" title="Medo"></span>', desc:'O mais antigo e poderoso elemento — raramente se manifesta sozinho, agindo como combustível para que outras Entidades rompam a Membrana. Criaturas de Medo possuem um Enigma ligado à sua existência; sem resolvê-lo, não podem ser verdadeiramente derrotadas. Associado ao azul e ao transparente. A Degolificada é a criatura de Medo mais conhecida.', efeitos:['Aura do Terror: todos na cena realizam Teste de Medo imediatamente (DT 15)','Eco do Pavor: alvo revive seu pior medo como alucinação — 2d6 SAN e Condição Abalado','Silêncio do Caçador: tornar-se imperceptível para predadores sobrenaturais por 1 cena','Ancoragem: usar o próprio medo como escudo — +2 Defesa vs possessões e controle mental'], custo:'O agente também realiza Teste de Medo (DT 12) ao ativar o elemento; falha = 1d4 SAN' }
];

const CRIATURAS = [
  // ══ SANGUE ══
  { id:'zumbi-sangue', nome:'Zumbi de Sangue', tipo:'basica', ameaca:'Baixo', pv:'30', def:'10', atq:'Soco Ensanguentado (1d6+3 — Sangue)', atributos:{FOR:16,AGI:8,INT:2,PRE:4,VIG:16}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: imune a Sangue; vulnerável a Conhecimento','Resistência Bruta: ignora 1ª condição Machucado por cena','Infecção: vítima a 0 PV faz Fortitude DT 14 ou vira Zumbi de Sangue em 1d4 cenas'], desc:'Humanos e animais reanimados pelo elemento Sangue. Pele avermelhada, odor repugnante. Clássica primeira ameaça da série — apresentados na Escola Nostradamus.' },
  { id:'aberracao-carne', nome:'Aberração de Carne', tipo:'basica', ameaca:'Alto', pv:'55', def:'14', atq:'Tentáculos (2d6+5) / Engolir (1d8/turno se Agarrado)', atributos:{FOR:22,AGI:6,INT:4,PRE:6,VIG:20}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: resistente a físico não-ritual','Membros Extras: ataca dois alvos por turno','Regeneração Grotesca: +4 PV/turno se houver sangue ao redor','Presença Perturbadora: Medo DT 13'], desc:'Massa de carne e osso reconfigurada pelo Outro Lado. Duas ou mais pessoas costuradas por material metálico desconhecido. Criada a partir de vítimas de rituais de Sangue corrompidos — como Fernanda e Evelyn na Escola Nostradamus.' },
  { id:'dama-sangue', nome:'Dama de Sangue', tipo:'basica', ameaca:'Altíssimo', pv:'65', def:'15', atq:'Lâminas de Osso (2d8+4 — Sangue) / Flagelação (todos em alcance curto: 2d6 — Sangue)', atributos:{FOR:20,AGI:16,INT:12,PRE:18,VIG:18}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: drena PV de aliados próximos para se curar (1d6/turno)','Vestido de Garras: quem a atacar corpo a corpo sofre 1d4 de dano reflexivo','Aura de Obsessão: Vontade DT 16 ou o alvo a protege — não pode atacá-la voluntariamente'], desc:'Figura feminina com vestimenta formada de ossos, garras e lodo carmesim. Exerce fascínio mórbido sobre suas vítimas, que sentem impulso de protegê-la mesmo enquanto ela as destrói.' },
  { id:'o-carente', nome:'O Carente', tipo:'basica', ameaca:'Alto', pv:'50', def:'12', atq:'Abraço Drenante (2d6 — Sangue + Agarrado; drena 1d6 PV/turno)', atributos:{FOR:18,AGI:10,INT:8,PRE:14,VIG:18}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue + Morte: recupera PV igual ao dano causado','Apego Paranormal: alvo Agarrado faz Vontade DT 15 ou fica paralisado de medo','Instinto de Proximidade: persegue o alvo com menos PV no grupo'], desc:'Criatura de Sangue com complemento de Morte. Sua forma lembra um humano deformado em busca de contato. Aperta suas vítimas em abraços letais enquanto drena sua vitalidade.' },
  { id:'nidere', nome:'Nidere (Cão de Lodo)', tipo:'basica', ameaca:'Alto', pv:'52', def:'14', atq:'Mordida Necrótica (2d6+3 — Morte) / Investida (derruba alvo, Reflexos DT 15)', atributos:{FOR:20,AGI:18,INT:6,PRE:8,VIG:18}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Sangue + Medo: caça pelo cheiro de medo','Furtividade Sobrenatural: +23 em Furtividade; raramente avistado antes do ataque','Uivo do Fim: Medo DT 16 — falha = Abalado por toda a cena'], desc:'Lobo distorcido de Morte — o Cão de Lodo. Habita florestas e ambientes selvagens, responsável por desaparecimentos de campistas. Avistado pela primeira vez no 9º episódio de O Segredo na Floresta.' },
  { id:'aracnasita', nome:'Aracnasita', tipo:'basica', ameaca:'Altíssimo', pv:'70', def:'16', atq:'Garras Parasitárias (2d6+5 — Morte) / Ovoposição (alvo Agarrado: implanta ovos, Fortitude DT 17)', atributos:{FOR:20,AGI:16,INT:6,PRE:8,VIG:20}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Medo: cresce exponencialmente ao se alimentar','Forma Inicial: começa pequena, cresce com cada vítima','Parasitismo: ovos implantados eclodem em 1d4 cenas gerando Aranhas menores','Imunidade a Veneno e Frio'], desc:'Aranha da Realidade exposta a um Símbolo de Morte e ao Lodo Preto. Desenvolve comportamento parasitário. Apareceu em O Segredo na Floresta, onde usou Thiago Fritz como fonte de energia.' },
  { id:'enraizado', nome:'Enraizado', tipo:'basica', ameaca:'Baixo', pv:'28', def:'11', atq:'Raízes (1d6+2 — imobiliza 1 turno, Reflexos DT 13)', atributos:{FOR:18,AGI:4,INT:2,PRE:4,VIG:16}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: ligado ao solo; imóvel mas raízes alcançam distância média','Regeneração Vegetal: +3 PV/turno em contato com o solo','Vulnerabilidade ao Fogo: dano de fogo é dobrado'], desc:'Ser vegetal corrompido pelo elemento Morte. Raízes e galhos crescem de forma anômala. Encontrado em florestas próximas a pontos de energia paranormal elevada.' },
  { id:'carniçal-morte', nome:'Carniçal da Morte', tipo:'basica', ameaca:'Alto', pv:'48', def:'13', atq:'Garras Necróticas (2d6 — Morte) / Mordida Amnésica (1d8+3)', atributos:{FOR:18,AGI:12,INT:6,PRE:8,VIG:16}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: Aura Necrótica — adjacentes perdem 1 PV/turno','Devora Memórias: Mordida exige INT DT 14 ou perde 1 informação recente','Imune a encantamentos e efeitos de medo'], desc:'Ser criado pelo elemento Morte para consumir a força vital dos vivos. Sua mordida não apenas fere — apaga fragmentos da memória das vítimas.' },
  { id:'esqueleto-lodo', nome:'Esqueleto de Lodo', tipo:'basica', ameaca:'Baixo', pv:'22', def:'9', atq:'Pancada de Osso (1d6+2) / Lodo Corrosivo (1d4 por turno até limpar)', atributos:{FOR:14,AGI:8,INT:2,PRE:4,VIG:12}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: imune a dano mental e medo','Reconstituição: ao ser destruído, tem 30% de chance de se reagrupar com 1 PV','Lodo Persistente: cobre o alvo — penalidade de −2 em Agilidade até limpo'], desc:'Esqueleto reanimado impregnado de lodo preto do Outro Lado. Menos perigoso isolado, mas em grupos podem imobilizar uma equipe inteira com seu lodo corrosivo.' },
  // ══ CONHECIMENTO ══
  { id:'espreitador', nome:'O Espreitador', tipo:'outro-lado', ameaca:'Extremo', pv:'75', def:'18', atq:'Lâmina Psíquica (3d6 — Conhecimento, alcance médio) / Ritual de Medo (2d8 SAN)', atributos:{FOR:12,AGI:16,INT:24,PRE:20,VIG:16}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: imune a Conhecimento; vulnerável a Sangue','Visão Total: não surpreendido; vê criaturas invisíveis','Paralisia Psíquica: Vontade DT 18 ou Paralisado 1 turno','Conjura Rituais: Rajada Mental e Ligação Telepática como ação livre (1×/cena)','Loot Ritual: ao morrer, deixa símbolo de Conhecimento/Medo'], desc:'Entidade de Conhecimento da Mansão Endiabrada. Deixava sangue amarelo ao morrer. Observa por cenas inteiras antes do primeiro ataque. Sua presença se sente como olhos que não se veem.' },
  { id:'parasita-culpa', nome:'Parasita de Culpa', tipo:'outro-lado', ameaca:'Altíssimo', pv:'60', def:'16', atq:'Sussurro de Culpa (2d8 SAN — Conhecimento) / Toque Infectante (1d6 + Condição Abalado)', atributos:{FOR:8,AGI:14,INT:22,PRE:18,VIG:14}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento + Sangue + Morte + Medo: multi-elementar','Fraqueza a Sangue: vulnerável; resistente a Conhecimento','Explorar Culpa: dano aumenta +1d6 se o alvo tiver alguma condição negativa ativa','Contágio Mental: alvo com 0 SAN transmite efeito a aliado adjacente (Vontade DT 15)'], desc:'Uma das criaturas com mais elementos combinados do bestiário. Ataca a mente explorando culpas e arrependimentos. Quanto mais o agente esconde segredos, mais poderoso o Parasita fica.' },
  { id:'bicho-papao', nome:'Bicho-Papão', tipo:'outro-lado', ameaca:'Extremo', pv:'80', def:'17', atq:'Toque do Pavor Infantil (3d6 SAN — Medo) / Devorar Sanidade (2d10 SAN — Conhecimento)', atributos:{FOR:10,AGI:14,INT:20,PRE:24,VIG:16}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento + Medo: criatura manifestada do medo de incontáveis crianças','Enigma do Medo: deve ser solucionado — criança que o originou tem história específica','Invisível para Adultos: só pode ser visto por personagens com menos de 18 anos ou com SAN abaixo de 5','Alimentação de SAN: recupera 5 PV para cada 1d6 SAN que causa'], desc:'Criatura de Conhecimento manifestada do medo coletivo de crianças na lenda do Bicho-Papão. Aproxima-se dos pequenos e corrói sua sanidade até que são completamente tomados — então os devora.' },
  { id:'ocioso', nome:'Ocioso', tipo:'outro-lado', ameaca:'Alto', pv:'45', def:'14', atq:'Vazio Contemplativo (2d6 SAN — Conhecimento / alvo faz Vontade DT 15 ou fica Lento)', atributos:{FOR:6,AGI:10,INT:20,PRE:16,VIG:12}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: movimenta-se devagar mas nunca para','Inquietude Mental: adjacentes perdem 1 PE no início de cada turno','Imune a Dano Físico: apenas rituais o afetam completamente'], desc:'Entidade de aspecto humanoide que caminha sem pressa, olhando para o nada. Sua mera presença drena a vontade de agir. Nunca corre — mas eventualmente alcança tudo.' },
  { id:'rastejador-sombrio', nome:'Rastejador Sombrio', tipo:'outro-lado', ameaca:'Alto', pv:'40', def:'15', atq:'Garra das Sombras (2d6 — Conhecimento; alvo fica Vulnerável até seu próximo turno)', atributos:{FOR:14,AGI:20,INT:16,PRE:10,VIG:14}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: imune enquanto nas sombras; vulnerável à luz','Furtividade das Trevas: impossível de perceber em ambientes escuros (Percepção DT 25)','Rastejo: pode se mover pelo teto e paredes sem custo de ação'], desc:'Entidade que existe nas sombras entre a Realidade e o Outro Lado. Rasteja pelo teto e paredes, atacando de pontos cegos. Nunca visível por inteiro — apenas fragmentos: uma garra, um olho.' },
  // ══ ENERGIA ══
  { id:'perturbado-energia', nome:'Perturbado de Energia', tipo:'basica', ameaca:'Baixo', pv:'25', def:'10', atq:'Descarga Caótica (1d8 — Energia, acerta aleatoriamente um ser na cena)', atributos:{FOR:10,AGI:14,INT:4,PRE:8,VIG:12}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: imune a dano elétrico; vulnerável a Conhecimento','Descarga Aleatória: ao atacar, role d4 — o alvo é o Nº na ordem de iniciativa','Colapso EMP: ao morrer, pulso destrói eletrônicos em alcance curto'], desc:'Humano completamente tomado pelo caos da Energia. Incapaz de controlar seus próprios poderes, lança descargas aleatórias. Mais perigoso para aliados do que para inimigos.' },
  { id:'anomiático', nome:'Anomiático', tipo:'basica', ameaca:'Alto', pv:'45', def:'13', atq:'Pulso Anômalo (2d6 — Energia, alvo é empurrado 3m) / Explosão de Caos (todos em alcance curto: 1d8)', atributos:{FOR:12,AGI:16,INT:8,PRE:10,VIG:14}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: emana caos — rituais ao redor têm 25% de chance de efeito errático','Instabilidade: a cada turno, role d6: 1-2 = ataca aliado; 3-6 = age normalmente','Explosão Final: ao morrer, causa 3d6 de Energia para todos em alcance médio'], desc:'Ser tomado por Energia em estado tão caótico que não consegue distinguir aliado de inimigo. Perigoso de engajar de perto — e mais perigoso ainda quando morre.' },
  { id:'ciborgue', nome:'Ciborgue Paranormal', tipo:'basica', ameaca:'Altíssimo', pv:'60', def:'17', atq:'Braço Canhão (2d8+4 — Energia) / Interface Forçada (alvo Agarrado: controla um item eletrônico do agente)', atributos:{FOR:20,AGI:10,INT:16,PRE:8,VIG:20}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: partes do corpo mescladas a tecnologia ou metal','Hack Paranormal: desativa equipamentos eletrônicos em alcance curto como ação livre','Blindagem Metálica: reduz 5 de todo dano físico','Imune a dano elétrico'], desc:'Humano parcialmente fundido a tecnologia pelo elemento Energia. Metade orgânico, metade máquina paranormal. Controla dispositivos à distância e usa o próprio corpo como arma.' },
  { id:'tempestuoso', nome:'Tempestuoso', tipo:'outro-lado', ameaca:'Extremo', pv:'85', def:'18', atq:'Raio Contínuo (3d8 — Energia, ação livre após acertar) / Vórtice (área: 2d6 Energia, empurra 6m)', atributos:{FOR:16,AGI:20,INT:12,PRE:14,VIG:18}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: imune a eletricidade e calor; vulnerável a Conhecimento','Controle do Clima: cria tempestade localizada em alcance longo — visibilidade zero','Condução Veloz: teleporta-se entre qualquer ponto com metal em alcance médio','Aura de Caos: habilidades especiais dos agentes têm 20% de falhar'], desc:'Entidade de Energia em forma de tempestade humanóide. Cada passo cria raios e vento. Ambientes com metal são seu terreno predileto — hospitais, fábricas e estações de metrô são seus teatros.' },
  { id:'infecticidio', nome:'Infecticídio', tipo:'outro-lado', ameaca:'Altíssimo', pv:'65', def:'16', atq:'Infecção Caótica (2d6 — Energia + alvo contrai Veneno Paranormal: 1d6/turno)', atributos:{FOR:12,AGI:16,INT:14,PRE:12,VIG:18}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: propaga instabilidade paranormal pelo toque','Contágio: alvo infectado transmite para adjacentes ao final de cada rodada (Fortitude DT 15)','Mutação Imprevisível: a cada cena um atributo aleatório do infectado muda em ±2'], desc:'Entidade portadora de uma infecção de Energia que se propaga por contato. Não ataca diretamente — prefere infectar e observar as mutações que provoca nas vítimas.' },
  // ══ MEDO ══
  { id:'degolificada', nome:'Degolificada', tipo:'outro-lado', ameaca:'Catastrófico', pv:'90', def:'19', atq:'Corte Espectral (3d8 SAN + 2d6 PV — ignora armadura) / Grito do Pavor (cena: 2d10 SAN)', atributos:{FOR:16,AGI:14,INT:18,PRE:26,VIG:18}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo: imune a Medo; vulnerável a rituais combinados','Enigma do Medo: possui mistério ligado à sua criação — resolvê-lo a destrói ou enfraquece','Presença Inominável: Medo DT 20 ao avistar — falha = 1d6 SAN imediato','Invulnerabilidade: físico = metade; rituais = total','Regeneração do Terror: +5 PV/turno se algum agente estiver Abalado'], desc:'A criatura de Medo mais famosa do universo. Figura sem cabeça ou com pescoço aberto. Duas Degolificadas podem ter origens e enigmas distintos. Sua única fraqueza é a história por trás de sua criação.' },
  { id:'amigo-imaginario', nome:'Amigo Imaginário', tipo:'outro-lado', ameaca:'Catastrófico', pv:'100', def:'20', atq:'Distorção da Realidade (4d8 SAN — Medo) / Infecção do Medo (todos os seres na cena: 2d6 Sangue+Morte)', atributos:{FOR:14,AGI:14,INT:20,PRE:28,VIG:20}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo + Sangue + Morte: originado do medo espalhado por Barnabé Aleno na Ilha de Tipora','Enigma Necessário: só pode ser confrontado após entender a origem do medo da ilha','Infecção em Área: propaga contaminação de Sangue e Morte nos arredores','Presença: só visível para quem está com SAN abaixo de 10 ou para crianças'], desc:'A maior ameaça de O Segredo na Ilha. Criatura paranormal originada do medo coletivo. Propaga uma infecção que combina Sangue e Morte, transformando todos ao redor. Invisível para a maioria dos adultos sãos.' },
  { id:'silhueta', nome:'Silhueta', tipo:'outro-lado', ameaca:'Alto', pv:'35', def:'14', atq:'Toque do Pavor (2d6 SAN — Medo) / Imitação: assume a forma de um agente caído', atributos:{FOR:4,AGI:18,INT:14,PRE:20,VIG:10}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo: imune a dano físico — apenas rituais a afetam','Imitação: pode copiar aparência de qualquer pessoa vista','Sombra Persistente: reaparece após 1d4 turnos se destruída sem ritual de Morte','Fraqueza: luz intensa — −4 em todos os testes'], desc:'Sombra que assume a forma de pessoas próximas e queridas das vítimas. Quando imita alguém, a pessoa imitada fica Abalada por 1 cena. Sua destruição requer ritualística — armas apenas a dispersam temporariamente.' },
  { id:'vulto', nome:'Vulto', tipo:'outro-lado', ameaca:'Baixo', pv:'20', def:'12', atq:'Sussurro Perturbador (1d8 SAN — Medo)', atributos:{FOR:2,AGI:14,INT:10,PRE:14,VIG:8}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo: imaterial — físico causa 1 de dano','Aparecer/Sumir: como ação livre, torna-se invisível até próximo turno','Fragmento: provavelmente apenas um fragmento de entidade maior'], desc:'Aparição fraca e sem forma definida. Sozinho é apenas perturbador, mas em grupos ou como precursor de entidade maior pode sinalizar algo muito pior por vir.' },
  // ══ MORTE ══
  { id:'existido', nome:'Existido', tipo:'outro-lado', ameaca:'Altíssimo', pv:'65', def:'17', atq:'Toque do Esquecimento (2d8 SAN — Vontade DT 16 ou perde 1 habilidade temporária)', atributos:{FOR:8,AGI:12,INT:20,PRE:22,VIG:14}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Conhecimento: imune a encantamentos e ilusões','Imaterialidade: apenas rituais ou armas imbuídas causam dano total','Drenar Existência: alvo a 0 PV some da realidade sem rastros','Presença Perturbadora: Medo DT 15 ao entrar em cena'], desc:'Seres em estado liminar entre vivos e mortos. Existem apenas para apagar a existência dos que encontram. A cada "morte" que causam, ficam ligeiramente mais sólidos.' },
  { id:'mulher-afogada', nome:'Mulher Afogada', tipo:'outro-lado', ameaca:'Extremo', pv:'70', def:'16', atq:'Afogamento Seco (3d6 — Morte; Fortitude DT 17 ou perde 1 ação)', atributos:{FOR:14,AGI:10,INT:16,PRE:20,VIG:16}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: imune a frio e afogamento','Água Paranormal: move-se por qualquer líquido sem custo de ação','Chamado das Profundezas: Vontade DT 15 ou alvo aproxima dela compulsivamente','Aura de Frio: adjacentes perdem 1 PE/turno'], desc:'Entidade da Mansão Endiabrada — deixava líquido viscoso vermelho ao morrer (cor de Sangue/complemento). Aparece como mulher com cabelo encharcado. Faz vítimas sentirem que afogam em terra seca.' },
  { id:'espectro-inesquecido', nome:'Espectro Inesquecido', tipo:'outro-lado', ameaca:'Alto', pv:'38', def:'13', atq:'Toque Gélido (2d6 — Morte; alvo Lento até próximo turno) / Grito de Agonia (1d10 SAN)', atributos:{FOR:6,AGI:12,INT:14,PRE:16,VIG:10}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: imaterial — físico ineficaz','Memória Traumática: força alvo a reviver uma morte de pessoa próxima (2d6 SAN, Vontade DT 14)','Ancoragem: ligado a objeto ou local — enquanto a âncora existir, ressurge em 1d6 turnos'], desc:'Espírito de alguém que morreu de forma traumática e não consegue partir. Preso entre a Realidade e o Outro Lado, busca compartilhar sua agonia com os vivos. Destruir sua âncora é a única solução definitiva.' },
  { id:'o-deus-da-morte', nome:'O Deus da Morte', tipo:'outro-lado', ameaca:'Catastrófico', pv:'120', def:'21', atq:'Ceifada (4d10 — Morte, mata automaticamente ao 0 PV sem rolagem de morte) / Aura da Extinção (todos na cena: 2d8 SAN/turno)', atributos:{FOR:24,AGI:12,INT:26,PRE:28,VIG:24}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte puro: imune a TUDO de Morte e Sangue','Presença da Extinção: Medo DT 22 ao entrar em cena — falha = Apavorado imediato','Além da Morte: não pode ser morto permanentemente — apenas banido (exige ritual específico)','Percepção Total: sabe o PV e SAN exatos de todos na cena'], desc:'Entidade do Outro Lado que personifica a Morte em sua forma mais absoluta. Apareceu em O Segredo na Floresta. Sua Ceifada não deixa margem para sobrevivência sem intervenção ritual.' },
  // ══ MULTI / ESPECIAIS ══
  { id:'sukkalgir', nome:'Sukkalgir', tipo:'outro-lado', ameaca:'Catastrófico', pv:'110', def:'20', atq:'Impacto Colossal (4d8+8 + 2d6 Energia) / Rugido Dissonante (área média: 3d6 SAN)', atributos:{FOR:28,AGI:10,INT:10,PRE:16,VIG:28}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: imune a elétrico e descargas','Colosso: +5 Fortitude; ataques normais sofrem −4','Aura Caótica: eletrônicos na cena falham automaticamente','Presença Esmagadora: Vigor DT 18 para agir normalmente enquanto adjacente'], desc:'Entidade colossal de Energia aparecida em Desconjuração. Não há negociação: destrói até esgotar a energia que a sustenta. Combatê-la exige separar o grupo para evitar que o Rugido Dissonante incapacite todos.' },
  { id:'viajante', nome:'O Viajante', tipo:'outro-lado', ameaca:'Extremo', pv:'80', def:'18', atq:'Toque Temporal (3d6 — envelhece +1d6 anos) / Rasgo Temporal (2d8 Energia + Confuso 1 turno)', atributos:{FOR:10,AGI:14,INT:26,PRE:20,VIG:16}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia (caixão azul na Mansão): vulnerável a Conhecimento; resistente a Energia','Distorção Temporal: age duas vezes no turno (não pode atacar duas vezes)','Retrospecção: sabe o que ocorreu em qualquer local que pisou nas últimas 24h','Fora de Fase: 30% de chance de qualquer ataque não acontecer'], desc:'Criatura de Energia da Mansão Endiabrada — deixava sangue roxo ao morrer (cor de Energia). Existe fora do tempo linear. Não ataca para matar — ataca para observar. O Espreitador era de Conhecimento; o Viajante, de Energia.' },
  { id:'anfitriao', nome:'O Anfitrião', tipo:'outro-lado', ameaca:'Catastrófico', pv:'130', def:'22', atq:'Manipulação Total (domina um agente por 1 turno, Vontade DT 20) / Realidade Corrompida (4d10 SAN — todos na cena)', atributos:{FOR:18,AGI:14,INT:28,PRE:30,VIG:22}, habs:['Elemento Medo + Todos: imune a rituais de elemento único','Enigma do Medo: resolver seu Enigma remove a imunidade a dano','Onisciência Local: sabe o nome, medo e segredo de todos na cena','Anfitriões Menores: invoca criaturas aliadas como ação livre (1d4 criaturas de ameaça Baixo/Alto)'], desc:'O grande antagonista de Ordem Paranormal: Desconjuração e Calamidade. Entidade que se alimenta do Medo e usa outras criaturas como peões. Resolver seu Enigma é condição obrigatória para qualquer chance real de vitória.' },
  // ══ SANGUE — ADICIONAIS ══
  { id:'lobisomem', nome:'Lobisomem Paranormal', tipo:'basica', ameaca:'Alto', pv:'55', def:'15', atq:'Garras e Presas (2d8+5 — Sangue) / Uivo Paralisante (Medo DT 14 — Abalado 1 turno)', atributos:{FOR:24,AGI:18,INT:4,PRE:6,VIG:20}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue + Morte: humano transformado por ritual de Sangue corrompido','Faro Sobrenatural: rastreia qualquer alvo pelo sangue a quilômetros de distância','Regeneração: +6 PV/turno; prata e fogo anulam a regeneração','Frenesi: quando abaixo de 20 PV, ganha +4 em ataques e perde a habilidade de diferenciar aliados de inimigos'], desc:'Humano transformado por exposição ao lodo vermelho do Outro Lado. Perde o controle noturno, mas mantém fragmentos da personalidade original. Rastreia pela memória olfativa do sangue que já derramou.' },
  { id:'sanguessuga-astral', nome:'Sanguessuga Astral', tipo:'outro-lado', ameaca:'Altíssimo', pv:'60', def:'15', atq:'Sucção Vital (2d8 — Sangue; cura o próprio PV pelo mesmo valor) / Rastro de Lodo (área: 1d6, persiste 2 turnos)', atributos:{FOR:16,AGI:12,INT:10,PRE:12,VIG:18}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: detecta presença de sangue em alcance longo','Simbiose Forçada: alvo com 0 PV torna-se hospedeiro — a Sanguessuga o habita e usa suas habilidades','Amorfa: pode escalar qualquer superfície e passar por frestas de 5cm','Resistência Ritual: imune a rituais de Sangue; vulnerável a Conhecimento'], desc:'Entidade do Outro Lado com aparência de lesma gigante translúcida. Seu interior pulsa com sangue das vítimas anteriores. Não mata — prefere hospedar-se nos corpos e vigiar com os olhos das vítimas.' },
  { id:'cultista-sangue', nome:'Cultista de Sangue', tipo:'basica', ameaca:'Baixo', pv:'20', def:'11', atq:'Faca Ritual (1d6+2 — Sangue) / Autoflagelação (1d4 — sí mesmo; ganha +2 em próximo ataque)', atributos:{FOR:12,AGI:12,INT:10,PRE:14,VIG:12}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: usa ritual simples de Sangue (1×/cena) — DT 13','Fanatismo: imune a efeitos de Medo enquanto acredita na causa','Em Grupo: +1 em ataques por aliado cultista adjacente (máx +3)'], desc:'Humano doutrinado por uma seita que usa rituais de Sangue. Diferente de outras criaturas básicas, mantém inteligência e raciocínio — o que o torna mais perigoso como obstáculo social do que físico.' },
  // ══ CONHECIMENTO — ADICIONAIS ══
  { id:'agente-corrompido', nome:'Agente Corrompido', tipo:'basica', ameaca:'Alto', pv:'45', def:'14', atq:'Ataque Treinado (2d6+4) / Ritual de Enfraquecimento (−2 nos testes do alvo, DT 15)', atributos:{FOR:16,AGI:16,INT:16,PRE:12,VIG:16}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: usa rituais com perícia de agente treinado','Equipamento Ordo: possui arma de fogo, colete e kit médico','Táticas de Campo: Flanqueamento concede +3 (não +2) ao corrompido e aliados','Resistência Mental: +4 em testes de Vontade contra possessão e controle'], desc:'Agente da Ordo Realitas tomado por uma entidade de Conhecimento. Mantém memórias e habilidades de combate mas age contra seus antigos aliados. Um dos encontros mais perturbadores — porque conhece os mesmos protocolos dos agentes.' },
  { id:'guardiao-biblioteca', nome:'Guardião da Biblioteca', tipo:'outro-lado', ameaca:'Extremo', pv:'72', def:'17', atq:'Tomo Cortante (3d6 — Conhecimento, alcance médio) / Labirinto Mental (Vontade DT 17 ou Confuso 2 turnos)', atributos:{FOR:10,AGI:14,INT:26,PRE:16,VIG:16}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento puro: imune a rituais de Conhecimento','Memória Absoluta: registra e reproduz qualquer ritual que vê sendo executado (1×/cena)','Forma de Páginas: dano físico reduzido à metade; brechas de fogo causam dano triplo','Catálogo dos Mortos: sabe o nome, profissão e causa da morte de qualquer ser que toca'], desc:'Entidade que habita bibliotecas e acervos antigos onde segredos proibidos foram documentados. Formada por páginas e tomos animados. Não ataca por maldade — protege o conhecimento que guarda.' },
  { id:'oraculo-vazio', nome:'Oráculo do Vazio', tipo:'outro-lado', ameaca:'Altíssimo', pv:'55', def:'16', atq:'Profecia Maldita (2d8 SAN — Conhecimento; alvo vê sua própria morte) / Toque da Certeza (2d6 — Paralisia 1 turno)', atributos:{FOR:6,AGI:10,INT:28,PRE:20,VIG:12}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento + Medo: visão do futuro como arma','Previsão: nunca surpreendido; ação de esquiva automática 1×/cena','Profecia Compartilhada: se um agente falhar na resistência, todos veem a profecia (metade do dano em SAN)','Imaterial: apenas rituais ou ataques com Conhecimento causam dano completo'], desc:'Entidade que processa toda informação do Outro Lado e retransmite visões de futuros possíveis — sempre os piores. Não busca atacar, mas sua presença inevitavelmente fragmenta a sanidade de quem a consulta.' },
  // ══ ENERGIA — ADICIONAIS ══
  { id:'duplicata', nome:'Duplicata', tipo:'basica', ameaca:'Alto', pv:'40', def:'13', atq:'Ataque Espelhado (copia último ataque físico recebido, mesmo dado e dano)', atributos:{FOR:14,AGI:16,INT:12,PRE:10,VIG:14}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: forma de espelho de energia','Cópia Perfeita: assume aparência de qualquer agente que tocou; fala com sua voz','Contra-Ataque Caótico: sempre que toma dano, causa 1d4 de dano de Energia ao atacante','Instabilidade da Cópia: ao atingir 50% de PV, perde a forma e revela sua natureza elétrica'], desc:'Entidade de Energia que replica a aparência e habilidades físicas de humanos que tocou. É instável — mantém a forma por tempo limitado antes de colapsar em descarga elétrica. Frequentemente usada como substituta ou isca.' },
  { id:'reator', nome:'Reator', tipo:'outro-lado', ameaca:'Altíssimo', pv:'70', def:'16', atq:'Erupção (todos em alcance médio: 2d8 Energia) / Núcleo Instável (ao atingir 0 PV: 4d10 Energia em alcance longo)', atributos:{FOR:14,AGI:8,INT:6,PRE:10,VIG:22}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia pura: acumula energia a cada turno que não ataca (+1d6 ao próximo ataque)','Bomba Relógio: conta regressiva de 3 turnos ao entrar em cena — ao fim, Erupção automática','Aura Radioativa: adjacentes começam a cena com condição Vulnerável','Imune a dano elétrico e térmico'], desc:'Entidade de Energia que funciona como uma bomba ambulante. Sua única "estratégia" é aproximar-se e explodir. Combatê-la à distância é essencial — deixá-la agir livremente é sempre catastrófico para o ambiente.' },
  { id:'espelho-louco', nome:'Espelho Louco', tipo:'outro-lado', ameaca:'Alto', pv:'38', def:'14', atq:'Reflexo Distorcido (2d6 SAN — Energia; alvo enfrenta versão distorcida de si mesmo)', atributos:{FOR:4,AGI:14,INT:14,PRE:18,VIG:12}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia + Medo: manifesta-se em superfícies reflexivas','Prisão de Espelhos: alvo que falha em Vontade DT 14 fica Lento (vê ilusões de si mesmo)','Multiplicação: destrói espelhos na cena para criar 1d4 cópias menores (10 PV cada)','Fraqueza: destruir todos os espelhos da cena força-o a revelar forma real'], desc:'Entidade que habita superfícies reflexivas e usa a autoimagem das vítimas como arma. Mostra versões distorcidas, mortas ou monstruosas das pessoas — fragmentando a identidade e a sanidade.' },
  // ══ MEDO — ADICIONAIS ══
  { id:'pesadelo-encarnado', nome:'Pesadelo Encarnado', tipo:'outro-lado', ameaca:'Extremo', pv:'78', def:'17', atq:'Materializar Medo (3d8 SAN — Medo; o dano é causado pelo maior medo do alvo) / Pesadelo Físico (2d6 PV — ignora armadura, Fortitude DT 16)', atributos:{FOR:12,AGI:16,INT:18,PRE:26,VIG:16}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo: forma muda conforme o maior medo de cada observador','Enigma Pessoal: para cada agente, o Enigma é diferente — liga-se ao trauma individual','Medo Coletivo: quando três ou mais agentes estão Abalados na cena, ganha +10 PV temporários','Imune a dano mental; resistente a físico'], desc:'Entidade que assume a forma do maior medo de quem a observa. Cada agente pode ver uma criatura diferente. Investigar o trauma por trás de cada forma é a única forma de diminuir seu poder.' },
  { id:'crianca-perdida', nome:'A Criança Perdida', tipo:'outro-lado', ameaca:'Altíssimo', pv:'58', def:'16', atq:'Choro do Abismo (2d8 SAN — Medo; efeito de área alcance curto) / Toque Inocente (1d6 Sangue + Morte — ignora DEF)', atributos:{FOR:8,AGI:18,INT:16,PRE:24,VIG:14}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo + Morte: aparência de criança entre 6 e 10 anos, pele translúcida','Apelo à Compaixão: agente que se aproximar voluntariamente faz Vontade DT 16 ou fica Abalado imediatamente','Invisível ao Culpado: quem causou a morte de uma criança não pode vê-la — mas ela pode vê-los','Enigma da Inocência: descobrir quem ela foi em vida e resolver sua morte é condição para banimento'], desc:'Uma das criaturas mais perturbadoras do bestiário. Aparece como criança morta sem olhos. Toca com suavidade e mata. Agentes com bom alinhamento moral têm dificuldade especial de atacá-la.' },
  { id:'quarto-escuro', nome:'O Quarto Escuro', tipo:'outro-lado', ameaca:'Alto', pv:'42', def:'15', atq:'Escuridão Tangível (2d6 SAN — Medo; alcance cena inteira) / Aprisionar (Reflexos DT 15 ou Agarrado por tentáculos de sombra)', atributos:{FOR:16,AGI:6,INT:12,PRE:20,VIG:18}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo: imóvel — não se move; expande a escuridão ao redor','Escuridão Absoluta: apaga todas as fontes de luz não-rituais em alcance médio','Sussurro nas Trevas: na escuridão, agentes realizam Medo DT 13 a cada turno','Fraqueza: luz ritual ou fogo intenso reduz seu raio de ação pela metade'], desc:'Entidade que não se parece com nada — é uma ausência. Habita cômodos específicos, geralmente quartos de crianças ou porões. Expande a escuridão e usa os medos da vítima como combustível.' },
  // ══ MORTE — ADICIONAIS ══
  { id:'despossessado', nome:'Despossessado', tipo:'outro-lado', ameaca:'Alto', pv:'44', def:'14', atq:'Possessão (Vontade DT 15 — controla o alvo por 1 turno) / Toque do Fim (2d6 — Morte; alvo Machucado até descanso)', atributos:{FOR:10,AGI:14,INT:16,PRE:18,VIG:12}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: imaterial — físico ineficaz; rituais de Morte causam dano completo','Possessão Parcial: pode controlar membros isolados (mão, braço) sem custo de ação','Âncora de Ódio: ligado ao local da própria morte; não pode se afastar mais que 50m','Memória do Morto: ao possuir alguém, usa todas as habilidades físicas do hospedeiro'], desc:'Espírito que recusa a partida por ódio ou vingança não consumada. Diferente do Espectro Inesquecido, possui ativamente em vez de assombrar. Resolver o motivo de sua recusa é necessário para o banimento permanente.' },
  { id:'corpo-sem-nome', nome:'Corpo Sem Nome', tipo:'basica', ameaca:'Baixo', pv:'18', def:'9', atq:'Arranhão Cadavérico (1d6 — Morte) / Grito Silencioso (1d4 SAN — Medo; Medo DT 12)', atributos:{FOR:12,AGI:6,INT:2,PRE:6,VIG:14}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: reanimado pelo elemento sem propósito claro','Número em Massa: normalmente encontrado em grupos de 3 a 8','Lodo Contagioso: ao morrer, cobre área de 1m² com lodo preto (1d4 por turno ao pisar)'], desc:'O mais simples dos mortos-vivos do Outro Lado. Corpos que não chegaram a desenvolver identidade paranormal — reanimados apenas pela concentração de lodo do Outro Lado na área. Ameaça real apenas em grupos.' },
  { id:'ceifador', nome:'O Ceifador', tipo:'outro-lado', ameaca:'Extremo', pv:'80', def:'17', atq:'Foice Espectral (3d8 — Morte; ignora armadura física) / Colheita (Fortitude DT 18 ou perda permanente de 1d4 de um atributo físico)', atributos:{FOR:20,AGI:14,INT:14,PRE:18,VIG:20}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: mensageiro do Outro Lado; ataca apenas quem está "marcado"','Marca da Colheita: ao início da cena, escolhe um agente — este recebe +50% de dano de Morte nessa cena','Intangível: físico causa metade; rituais de Morte causa dano completo','Inevitável: não pode ser permanentemente destruído — apenas atrasado; retorna na próxima cena'], desc:'Entidade que se manifesta para "colher" vidas que o Outro Lado já decidiu encerrar. Não é malévolo por natureza — executa uma função. Identificar quem está marcado e resolver a causa é a única saída real.' },

  // ══ SANGUE — CANÔNICOS ADICIONAIS ══
  { id:'professor-paranormal', nome:'Professor Paranormal', tipo:'basica', ameaca:'Alto', pv:'42', def:'13', atq:'Chicote de Veias (2d6+3 — Sangue; alcance médio) / Aula do Terror (1d8 SAN — todos em alcance curto)', atributos:{FOR:14,AGI:12,INT:18,PRE:14,VIG:14}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue + Conhecimento: humano possuído por entidade de Sangue durante ritual na escola','Manipulação de Estudantes: alunos mundanos na cena obedecem suas ordens (Vontade DT 14)','Sangue nas Paredes: ao receber dano, marca paredes com runas de Sangue — +2 em seus ataques por runa (máx 3)'], desc:'Professor tomado pelo elemento Sangue no colégio Nostradamus. Mantém aparência de docente mas com veias negras aparentes e olhos vermelhos. Usa a autoridade sobre alunos como vantagem tática.' },
  { id:'cria-de-sangue', nome:'Cria de Sangue', tipo:'basica', ameaca:'Baixo', pv:'15', def:'9', atq:'Mordida (1d4+1 — Sangue; contaminação se errar Fortitude DT 12)', atributos:{FOR:8,AGI:14,INT:2,PRE:4,VIG:10}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: nasce de vítimas a 0 PV infectadas','Enxame: +1 de dano por cada Cria adjacente ao mesmo alvo (máx +5)','Fraqueza ao Fogo: dano dobrado'], desc:'Criaturas minúsculas nascidas de humanos infectados pelo elemento Sangue. Sozinhas são quase inofensivas — em enxames de 5 ou mais podem derrubar um agente em poucos turnos.' },
  { id:'furia-sangue', nome:'Fúria de Sangue', tipo:'outro-lado', ameaca:'Altíssimo', pv:'68', def:'16', atq:'Explosão Hemática (3d6 — Sangue; área curta) / Regeneração Ofensiva (cura 2d6 PV e empurra adjacentes)', atributos:{FOR:24,AGI:14,INT:6,PRE:10,VIG:22}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue puro: sobrevive com 1 PV se destruída sem ritual de Sangue','Frenesi Total: cada acerto aumenta sua FOR em +2 (máx +8) pela cena','Aura de Ódio: adjacentes com menos de 50% PV fazem Vontade DT 15 ou atacam aliados'], desc:'Forma evoluída de aberração de Sangue — não mais plural mas uma única entidade de fúria pura. Quanto mais dano recebe, mais violenta e forte se torna. Combater a distância é obrigatório.' },
  { id:'rainha-sangue', nome:'Rainha de Sangue', tipo:'outro-lado', ameaca:'Catastrófico', pv:'115', def:'20', atq:'Coroa de Espinhos (4d6+6 — Sangue; ignora DEF) / Comando Real (controla todas as criaturas de Sangue na cena)', atributos:{FOR:22,AGI:14,INT:20,PRE:26,VIG:22}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: rainha da hierarquia — todas criaturas de Sangue na cena ganham +4 em ataques','Banquete Real: ao matar um ser, recupera 3d8 PV','Enigma do Trono: destruir o trono/objeto que a ancora é condição para banimento permanente','Encantamento Sanguíneo: Vontade DT 20 ou agente age como aliado dela por 1 cena'], desc:'Entidade que lidera colônias de criaturas de Sangue. Sua presença eleva todas as criaturas de Sangue ao redor. Encontrada em rituais de invocação avançados — sua derrota desorganiza completamente sua "corte".' },

  // ══ MORTE — CANÔNICOS ADICIONAIS ══
  { id:'enterrado-vivo', nome:'Enterrado Vivo', tipo:'basica', ameaca:'Alto', pv:'40', def:'12', atq:'Garras da Terra (2d6 — Morte; alvo Agarrado pode ser puxado para o solo)', atributos:{FOR:20,AGI:6,INT:4,PRE:6,VIG:18}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: emerge do solo em qualquer ponto de terra da cena','Afundar: alvo agarrado faz Reflexos DT 15 ou é enterrado (Incapacitado até escavar)','Cheiro da Morte: detecta vivos em alcance longo pelo calor corporal'], desc:'Morto-vivo que emergiu de um cemitério próximo a um símbolo de Morte. Prefere puxar vítimas para baixo da terra. Encontrado em investigações de desaparecimentos em cemitérios e florestas.' },
  { id:'sombra-da-memoria', nome:'Sombra da Memória', tipo:'outro-lado', ameaca:'Altíssimo', pv:'55', def:'15', atq:'Roubo de Memória (2d6 SAN — alvo perde 1 habilidade ou ritual até descanso) / Eco do Passado (2d8 — Morte)', atributos:{FOR:6,AGI:16,INT:22,PRE:20,VIG:14}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Conhecimento: formada de memórias de mortos','Imaterial: físico ineficaz; rituais e objetos com história causam dano completo','Doppelgänger Morto: pode assumir forma de morto que a agente conheceu','Memória Absoluta: lembra de cada vida que consumiu — usa esses conhecimentos contra os agentes'], desc:'Entidade formada do acúmulo de memórias de pessoas mortas sem fazer as pazes com o passado. Usa o conhecimento das vidas consumidas para manipular psicologicamente os vivos.' },
  { id:'senhor-do-lodo', nome:'Senhor do Lodo', tipo:'outro-lado', ameaca:'Extremo', pv:'88', def:'18', atq:'Onda de Lodo (todos em alcance médio: 2d8 — Morte) / Absorção (engole criatura morta na cena — ganha seus PV)', atributos:{FOR:20,AGI:8,INT:16,PRE:14,VIG:24}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte puro: gera lodo preto ao redor — difícil terreno em alcance médio','Invocar Mortos: como ação livre, pode reerguer 1 morto na cena como Esqueleto de Lodo','Resistência ao Fogo: dano de fogo reduzido à metade (diferente de criaturas vegetais)','Núcleo Oculto: deve ser destruído o núcleo físico no interior do corpo de lodo'], desc:'Grande massa de lodo preto dotada de consciência rudimentar. Encontrado em locais com alta concentração de mortes — matadouros, hospitais abandonados, campos de batalha esquecidos.' },
  { id:'cavaleiro-osseo', nome:'Cavaleiro Ósseo', tipo:'outro-lado', ameaca:'Altíssimo', pv:'72', def:'18', atq:'Espada Fantasma (3d6+4 — Morte; ignora DEF física) / Carga Mortífera (2d8 — empurra e derruba)', atributos:{FOR:22,AGI:12,INT:10,PRE:14,VIG:20}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: guerreiro do Outro Lado com resquícios de código de honra','Armadura Espectral: dano físico reduzido em 4; rituais causam dano total','Desafio: escolhe um agente — concentra todos os ataques nesse alvo','Reconstituição: volta com 10 PV após 1d4 turnos a menos que a âncora seja destruída'], desc:'Espectro de guerreiro que morreu antes de cumprir um juramento. Mantém disciplina e estratégia de combate. Mais perigoso do que parece porque nunca entra em pânico e nunca recua.' },

  // ══ CONHECIMENTO — CANÔNICOS ADICIONAIS ══
  { id:'sussurrador', nome:'Sussurrador', tipo:'outro-lado', ameaca:'Alto', pv:'35', def:'14', atq:'Sussurro Corrosivo (2d6 SAN — Conhecimento; alvo não vê a criatura)', atributos:{FOR:4,AGI:18,INT:22,PRE:16,VIG:10}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: completamente invisível e inaudível — só detectável por ritual ou dano recebido','Plantio de Dúvida: alvo que falhar em Vontade DT 15 desconfia de um aliado aleatório por 1 cena','Parasita de Informação: ouve e grava tudo que ocorre em alcance longo — transmite ao Outro Lado'], desc:'Entidade que sussurra segredos e dúvidas nos ouvidos de suas vítimas sem nunca ser vista. Usada como espião pelo Outro Lado. Sua presença é detectada pela progressiva desconfiança entre aliados.' },
  { id:'bibliomancer', nome:'Bibliomante', tipo:'outro-lado', ameaca:'Altíssimo', pv:'62', def:'16', atq:'Página Cortante (2d8 — Conhecimento; alcance médio, voa) / Grimório Maldito (2d6 SAN — alvo que falhar vê sua própria história distorcida)', atributos:{FOR:8,AGI:16,INT:28,PRE:18,VIG:14}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: formado de páginas de livros proibidos','Cópia de Ritual: ao presenciar qualquer ritual, pode usá-lo na próxima cena (1×/cena)','Arquivo do Paranormal: sabe a Fraqueza de toda criatura que já foi documentada','Encadernação: como ação de movimento, envolve um alvo em páginas — Agarrado'], desc:'Entidade feita de páginas de grimórios antigos que absorveu os conhecimentos proibidos neles registrados. Extremamente perigosa porque aprende e adapta durante o combate.' },
  { id:'twin-mentes', nome:'Dupla Mente', tipo:'basica', ameaca:'Alto', pv:'38', def:'13', atq:'Ataque Sincrônico (dois ataques de 1d8+2 no mesmo alvo no mesmo turno) / Confusão Telepática (alvo faz Vontade DT 14 ou ataca aliado)', atributos:{FOR:12,AGI:14,INT:20,PRE:16,VIG:12}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: dois humanos com mentes fundidas por acidente de ritual','Sincronismo: nunca Surpreso; reage ao primeiro ataque com esquiva automática 1×/cena','Leitura de Intenção: sabe o próximo movimento do adversário se passar em Intuição DT 12'], desc:'Dois humanos cujas mentes foram fundidas por um ritual de Conhecimento corrompido. Agem em perfeita sincronia sem comunicação verbal. Socialmente impossível distingui-los de pessoas normais até atacarem.' },

  // ══ ENERGIA — CANÔNICOS ADICIONAIS ══
  { id:'poltergeist', nome:'Poltergeist', tipo:'outro-lado', ameaca:'Alto', pv:'30', def:'15', atq:'Arremesso Telequinético (2d6 — Energia; usa objeto da cena como projétil) / Chuva de Escombros (todos em alcance médio: 1d8)', atributos:{FOR:20,AGI:14,INT:10,PRE:12,VIG:10}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: imaterial — físico ineficaz','Controle de Objetos: pode mover qualquer objeto não fixo como ação de movimento','Tornado de Detritos: uma vez por cena, lança todos os objetos do ambiente ao mesmo tempo (3d6, alcance longo)','Fraqueza: sem objetos para lançar, apenas 1d4 de dano por turno'], desc:'Energia do Outro Lado sem forma definida que se manifesta por telecinese violenta. Ambientes bagunçados ou com muitos objetos são extremamente perigosos com um Poltergeist presente.' },
  { id:'fantasma-eletrico', nome:'Fantasma Elétrico', tipo:'outro-lado', ameaca:'Altíssimo', pv:'58', def:'15', atq:'Arco Elétrico (2d8+4 — Energia; salta para adjacente: 1d8 extra) / Pulso EMP (desativa TODOS os eletrônicos da cena)', atributos:{FOR:10,AGI:22,INT:14,PRE:12,VIG:14}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia puro: habita sistemas elétricos — pode sair por qualquer tomada ou fio','Overload: ao receber 20+ dano de uma vez, explode causando 3d6 Energia em alcance curto','Invisível na Escuridão: sem luz artificial, impossível de localizar sem ritual'], desc:'Entidade de Energia que habita a infraestrutura elétrica de prédios. Pode aparecer em qualquer ponto conectado à rede. Cortar a energia do local o enfraquece mas não o elimina.' },
  { id:'distorcido', nome:'Distorcido', tipo:'basica', ameaca:'Alto', pv:'44', def:'14', atq:'Golpe Impossível (2d6 — Energia; vem de direção inesperada — −3 DEF do alvo) / Fase Shift (teleporta 6m como ação livre)', atributos:{FOR:16,AGI:20,INT:8,PRE:10,VIG:14}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: corpo existe parcialmente fora da realidade','Imprevisível: a cada turno, role 1d4 para determinar de qual lado ataca — DEF do alvo é reduzida pelo resultado','Resistência Parcial: 30% de chance de qualquer dano não ocorrer (corpo desfasado)'], desc:'Humano cujo corpo foi parcialmente arrancado para o Outro Lado pelo elemento Energia. Existe em dois lugares ao mesmo tempo — perigoso porque os ataques vêm de ângulos fisicamente impossíveis.' },

  // ══ MEDO — CANÔNICOS ADICIONAIS ══
  { id:'mimico-do-medo', nome:'Mímico do Medo', tipo:'outro-lado', ameaca:'Altíssimo', pv:'60', def:'16', atq:'Réplica do Trauma (3d8 SAN — usa o trauma específico do alvo) / Forma Perfeita (assume aparência idêntica de aliado)', atributos:{FOR:10,AGI:16,INT:20,PRE:26,VIG:14}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo + Conhecimento: acessa memórias traumáticas de quem observa','Cópia Perfeita: replica voz, aparência e maneirismos de qualquer pessoa vista','Enigma do Espelho: confrontar o mímico com a verdade do que imita é sua única fraqueza','Detecção: apenas Intuição DT 18 ou ritual de Conhecimento revela a impostura'], desc:'Entidade de Medo que assume a forma do ente mais querido ou mais temido de suas vítimas. Uma das criaturas mais psicologicamente devastadoras — nunca revela sua forma verdadeira voluntariamente.' },
  { id:'sombra-do-sonho', nome:'Sombra do Sonho', tipo:'outro-lado', ameaca:'Extremo', pv:'74', def:'17', atq:'Pesadelo Manifesto (3d6 SAN + 2d6 PV — sonho tornado real) / Sono Eterno (Fortitude DT 17 ou alvo adormece por 1d4 turnos)', atributos:{FOR:8,AGI:18,INT:20,PRE:24,VIG:16}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo + Morte: mais forte durante a noite e em locais escuros','Realidade Onírica: em locais onde alguém morreu sonhando, suas habilidades causam dano dobrado','Sono Compartilhado: todos os adormecidos na cena sofrem seus ataques ao mesmo tempo','Enigma do Pesadelo: descobrir o sonho original que a criou é condição para banimento'], desc:'Entidade que habita o espaço entre o sono e a vigília. Mais perigosa do que parece porque os danos que causa durante o sono são completamente reais ao despertar.' },
  { id:'eco-do-passado', nome:'Eco do Passado', tipo:'outro-lado', ameaca:'Alto', pv:'40', def:'13', atq:'Reviver Trauma (2d8 SAN — Medo; alvo fica Lento por 1 turno) / Presença Temporal (todos na cena: 1d6 SAN)', atributos:{FOR:4,AGI:10,INT:18,PRE:22,VIG:12}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo: imóvel — prende-se ao local de um trauma histórico','Ancoragem Histórica: só pode ser banido se o evento traumático for reprocessado ritualmente','Fragmentação da Realidade: a cena inteira parece repetir o evento do passado para os agentes'], desc:'Entidade que surge de locais onde algo muito traumático ocorreu. Não ataca diretamente — faz o ambiente reviver o trauma em loop, corrompendo a percepção de todos que entram.' },
  { id:'infante-do-caos', nome:'Infante do Caos', tipo:'outro-lado', ameaca:'Catastrófico', pv:'105', def:'21', atq:'Choro Devastador (4d8 SAN — todos na cena) / Birra Paranormal (3d10 — Energia + Medo; destrói objetos na cena)', atributos:{FOR:14,AGI:18,INT:6,PRE:30,VIG:20}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo + Energia: aparece como bebê ou criança pequena de aparência inocente','Proteção pelo Medo: ao receber dano, todos na cena fazem Medo DT 20 imediatamente','Inocência Armada: agentes com traumas infantis têm −4 em todos os testes contra ele','Enigma da Origem: encontrar quem o criou e resolver o trauma que o invocou'], desc:'Uma das mais perturbadoras criaturas do bestiário — aparenta inocência absoluta mas é pura destruição. Invocar atacar parece monstruoso, o que é exatamente a defesa da criatura.' },

  // ══ MULTI-ELEMENTO / ESPECIAIS CANÔNICOS ══
  { id:'barnabe-aleno', nome:'Barnabé Aleno (Manifestação)', tipo:'outro-lado', ameaca:'Catastrófico', pv:'120', def:'21', atq:'Sermão do Pavor (4d8 SAN — Medo; área longa) / Toque da Doutrina (3d6 — Sangue + Morte + Medo; transfere condições)', atributos:{FOR:14,AGI:12,INT:28,PRE:30,VIG:20}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo + Sangue + Morte: manifestação do líder do culto da Ilha de Tipora','Culto Ativo: enquanto houver cultistas vivos na cena, é imune a dano','Doutrinação: Vontade DT 22 ou agente passa a tratá-lo como autoridade por 1 cena','Enigma do Culto: destruir todos os símbolos do culto na cena enfraquece a manifestação em 50%'], desc:'Manifestação paranormal de Barnabé Aleno após sua morte no Segredo na Ilha. Não é o homem — é o medo que ele cultivou nas pessoas. Combatê-lo sem entender o culto é inútil.' },
  { id:'guardiao-da-membrana', nome:'Guardião da Membrana', tipo:'outro-lado', ameaca:'Extremo', pv:'90', def:'19', atq:'Corte da Membrana (3d8 — elemento aleatório por turno) / Expulsar (alvo Reflexos DT 17 ou é lançado fora da cena)', atributos:{FOR:22,AGI:16,INT:20,PRE:18,VIG:22}, habs:['Todos os Elementos: imune a um elemento aleatório por cena (determinado na iniciativa)','Protetor da Passagem: ao ser invocado, fecha o ponto de acesso ao Outro Lado','Golpe Dimensional: empurra o alvo parcialmente para o Outro Lado — Vulnerável por 2 turnos','Não pode ser banido enquanto o ponto de acesso que guarda existir'], desc:'Entidade posicionada entre a Realidade e o Outro Lado para impedir passagens não autorizadas. Paradoxalmente, Mestres podem encontrá-lo como obstáculo quando tentam fechar uma fissura.' },
  { id:'o-arquiteto', nome:'O Arquiteto', tipo:'outro-lado', ameaca:'Catastrófico', pv:'125', def:'22', atq:'Remodelação (4d10 — reconstrói o ambiente ao redor dos agentes causando dano) / Enigma Arquitetônico (Vontade DT 20 ou preso em labirinto mental por 1 cena)', atributos:{FOR:16,AGI:14,INT:30,PRE:22,VIG:24}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento + Todos: arquiteta a realidade do Outro Lado','Controle Ambiental: pode mudar a disposição da cena como ação livre (portas, paredes, saídas)','Planta da Realidade: sabe a posição exata de todos os seres na cena a qualquer momento','Construção de Medo: reproduz o pior ambiente possível para cada agente individualmente'], desc:'Entidade rara que não ataca — reconstrói. Remodela o espaço ao redor dos agentes, transformando qualquer ambiente em labirinto. Extremamente difícil de derrotar porque o campo de batalha em si se torna o inimigo.' },
  { id:'colmeia-paranormal', nome:'Colmeia Paranormal', tipo:'outro-lado', ameaca:'Altíssimo', pv:'80', def:'16', atq:'Enxame Voraz (2d8 — Morte + Sangue; alcance médio) / Incorporar (engole uma criatura morta — torna-se parte da Colmeia)', atributos:{FOR:18,AGI:10,INT:14,PRE:10,VIG:22}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Sangue: ser coletivo formado de muitos organismos menores','Dividir: quando abaixo de 50% PV, divide-se em 2 Colmeias menores (cada uma com 20 PV)','Absorção: cada criatura básica morta na cena aumenta seus PV em 10 (máx +40)','Imune a ataques não-área: ataques simples causam apenas 1 dano; ataques de área causam normal'], desc:'Entidade coletiva composta de dezenas de organismos menores do Outro Lado agindo como um só ser. Cada parte morta alimenta o resto. Requer ataques em área para dano significativo.' },
  { id:'juiz-dos-mortos', nome:'Juiz dos Mortos', tipo:'outro-lado', ameaca:'Catastrófico', pv:'118', def:'21', atq:'Sentença (4d8 — Morte; ignora toda resistência e defesa do alvo) / Julgamento Coletivo (todos na cena: 2d10 — Morte + SAN)', atributos:{FOR:20,AGI:10,INT:28,PRE:26,VIG:24}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Conhecimento: árbitro do Outro Lado — julga se os vivos merecem continuar','Imune a Rituais: apenas ações baseadas em resolução de mistério o afetam','Veredicto: ao início da cena, determina se os agentes são "culpados" — culpados recebem +30% dano de Morte','Enigma do Tribunal: apresentar evidências de inocência (ou de culpa de outra entidade) é a única forma de defleti-lo'], desc:'Entidade do alto escalão do Outro Lado. Não surge para matar — surge para julgar. Apresentar argumentos rituais válicos pode fazê-lo recuar. Combate direto é quase sempre fatal.' },

  // ══ CRIATURAS DA SÉRIE (EPISÓDIOS ESPECÍFICOS) ══
  { id:'professor-edney', nome:'Edney Barros (Possessão)', tipo:'basica', ameaca:'Alto', pv:'48', def:'14', atq:'Chicote de Sangue (2d8 — Sangue; alcance médio) / Doutrina Paranormal (1d8 SAN + Condição Abalado)', atributos:{FOR:16,AGI:12,INT:20,PRE:18,VIG:14}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: professor de matemática tomado durante ritual em O Segredo na Escola','Conhecimento Acadêmico: usa o intelecto do hospedeiro para táticas inesperadas','Gatilho Emocional: ao ser chamado pelo nome verdadeiro, faz Vontade DT 16 ou fica Atordoado 1 turno'], desc:'O professor Edney Barros tomado pelo elemento Sangue na Escola Nostradamus. Primeiro grande antagonista da série. Sua luta interna entre o hospedeiro e a entidade é a chave narrativa do episódio.' },
  { id:'criatura-da-mansao', nome:'Criatura da Mansão', tipo:'outro-lado', ameaca:'Extremo', pv:'76', def:'17', atq:'Garras da Mansão (3d6 — Morte + Medo; ignora 3 de defesa) / Chamado da Casa (Vontade DT 16 ou compulsão para entrar em cômodo específico)', atributos:{FOR:18,AGI:14,INT:16,PRE:22,VIG:18}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Medo: ligada à estrutura da Mansão Endiabrada','Conhece a Mansão: nunca surpreendida dentro da mansão; se teleporta entre cômodos','Guardiã da Casa: +3 em todos os testes enquanto dentro do imóvel; −3 se arrastada para fora','Âncora Arquitetônica: enquanto a mansão existir, não pode ser banida permanentemente'], desc:'Entidade que habita a estrutura física da Mansão Endiabrada. Parte dela é a própria mansão — destruir o imóvel é a única forma de banimento definitivo. Cada cômodo aumenta seu poder.' },
  { id:'lodo-consciente', nome:'Lodo Consciente', tipo:'outro-lado', ameaca:'Altíssimo', pv:'62', def:'14', atq:'Absorção (2d6 — Morte; alvo Agarrado é lentamente engolido) / Pulso de Contágio (alcance curto: 1d8 Morte + Fortitude DT 15 ou contaminado)', atributos:{FOR:16,AGI:4,INT:16,PRE:10,VIG:24}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte puro: forma o substrato do Outro Lado','Onipresente no Lodo: pode surgir de qualquer poça de lodo preto','Contaminação do Ambiente: área em alcance médio cobre-se de lodo — Difícil Terreno','Regeneração Absoluta: se não completamente destruído, regenera 3d6 PV/turno'], desc:'Uma das mais antigas formas do Outro Lado — lodo que desenvolveu autoconsciência. Não é agressivo por default, mas torna-se letal quando perturbado em seu território natural.' },

  // ══════════════════════════════════════════════
  //  SOBREVIVENDO AO HORROR — CRIATURAS CANÔNICAS
  // ══════════════════════════════════════════════

  // ── PARANORMAIS ──
  { id:'sepultado', nome:'Sepultado', tipo:'outro-lado', ameaca:'Altíssimo', pv:'70', def:'16', atq:'Garras de Terra (2d8+4 — Morte; alvo Imobilizado 1 turno) / Afundar (alvo Agarrado: puxado para solo, sufoca 1d6/turno)', atributos:{FOR:22,AGI:8,INT:6,PRE:8,VIG:22}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: humano soterrado vivo que voltou do Outro Lado','Emergência: surge de qualquer superfície de terra ou concreto velho como ação de movimento','Aura de Sufocamento: adjacentes realizam Fortitude DT 14 a cada turno ou ficam com Falta de Ar (−2 em ações)','Regeneração Subterrânea: recupera 4 PV/turno enquanto toca o solo'], desc:'Vítima soterrada viva que foi absorvida pelo Outro Lado e retornou como entidade de Morte. Conserva fragmentos da consciência e memórias da agonia do soterramento. Emerge de onde menos se espera — o chão sob os pés dos agentes.' },
  { id:'mescla', nome:'Mescla', tipo:'outro-lado', ameaca:'Extremo', pv:'82', def:'17', atq:'Fusão Forçada (3d6 — Sangue; alvo Agarrado funde-se parcialmente: −3 em todos os testes) / Absorção de Membros (alvo Agarrado perde uso de 1 membro por turno)', atributos:{FOR:20,AGI:12,INT:10,PRE:12,VIG:20}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue + Morte: entidade que une corpos em massa única','Corpo Composto: imune a dano de área — só metade do dano de ataques únicos','Crescer com Vítimas: ao absorver completamente um ser, ganha +10 PV e +1 em FOR','Separação Dolorosa: se separada fisicamente, cada parte age independentemente por 2 turnos'], desc:'Entidade do Sobrevivendo ao Horror formada pela fusão de corpos humanos em uma massa única e retorcida. Cada vítima absorvida se torna parte de si. Reconhecer rostos familiares no corpo da Mescla é psicologicamente devastador.' },
  { id:'uivar', nome:'Uivar', tipo:'outro-lado', ameaca:'Altíssimo', pv:'65', def:'15', atq:'Uivo Primordial (todos em alcance longo: 2d10 SAN — Medo; Abalado por 1 cena se falhar) / Ataque em Matilha (2d6+3 — Sangue; +1d6 por cada Uivar aliado em alcance curto)', atributos:{FOR:18,AGI:20,INT:8,PRE:14,VIG:16}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo + Sangue: criatura de matilha — mais letal em grupo','Uivo de Chamada: como ação livre, invoca 1d4 Uivares adicionais (chegam em 2 turnos)','Caça Cooperativa: flanqueamento concede +4 (não +2) aos Uivares','Faro do Medo: detecta qualquer ser com SAN abaixo de 50% em alcance extremo'], desc:'Predador do Outro Lado que caça em matilha. Seu uivo corrói a sanidade antes de atacar fisicamente. Soa como lobo, mas ressoa diretamente na psique — os agentes sentem o uivo por dentro, não pelos ouvidos.' },
  { id:'derretido', nome:'Derretido', tipo:'outro-lado', ameaca:'Altíssimo', pv:'60', def:'14', atq:'Respingo Corrosivo (2d6 — Sangue; queima equipamentos: Fortitude DT 15 ou item destruído) / Abraço Fundente (3d6 — Sangue + Morte; alvo Agarrado recebe dano a cada turno)', atributos:{FOR:14,AGI:10,INT:8,PRE:8,VIG:20}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue + Morte: ser cujo corpo foi "derretido" pelo Outro Lado','Rastro Corrosivo: qualquer superfície por onde passa fica coberta de ácido paranormal (1d4/turno)','Forma Amorfa: pode atravessar qualquer abertura por onde um líquido passaria','Fusão ao Solo: ao ser destruído, derrama-se no chão — área de 3m² de ácido persistente por 1d4 cenas'], desc:'Entidade do Sobrevivendo ao Horror — ser que teve seu corpo dissolvido pelo Outro Lado e agora existe como massa corrosiva semi-consciente. Corrói tudo ao toque. Especialmente perigoso em ambientes fechados.' },
  { id:'melancolia', nome:'Melancolia', tipo:'outro-lado', ameaca:'Extremo', pv:'75', def:'16', atq:'Toque da Desesperança (3d8 SAN — Medo; alvo perde a vontade de agir: Lento por 2 turnos) / Aura de Desistência (todos em alcance médio: 2d6 SAN/turno enquanto permanecerem na aura)', atributos:{FOR:4,AGI:12,INT:20,PRE:28,VIG:16}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo: entidade que se alimenta de tristeza e desesperança profundas','Enigma da Perda: ligada a um luto não processado — resolver esse luto é condição para banimento','Imaterial: completamente imune a dano físico','Presença Opressiva: agentes com perdas recentes têm −4 em resistências contra ela','Apelo à Rendição: Vontade DT 16 ou o agente simplesmente para de lutar por 1 turno'], desc:'Uma das criaturas mais singulares do Sobrevivendo ao Horror — não mata diretamente, mas corrói a vontade até que as vítimas se rendem à morte. Representa o luto não resolvido materializado em forma paranormal.' },
  { id:'quibungo', nome:'Quibungo', tipo:'outro-lado', ameaca:'Catastrófico', pv:'108', def:'20', atq:'Devorar (4d8 — Morte + Sangue; alvo Agarrado pode ser engolido se chegar a 0 PV) / Boca das Costas (3d6 — ataque surpresa de trás: ignora DEF)', atributos:{FOR:28,AGI:12,INT:10,PRE:16,VIG:26}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Sangue: folclore brasileiro materializado — abertura nas costas é sua boca real','Boca Oculta: primeira rodada de combate, o Quibungo é tratado como se tivesse Furtividade máxima','Engolir Criança: prioriza alvos com menor FOR — alvo engolido está perdido sem resgate ritual','Rugido do Folclore: Medo DT 19 — falha = Apavorado por toda a cena'], desc:'Criatura do folclore afro-brasileiro inserida no universo de OP no Sobrevivendo ao Horror. Gigante com uma abertura nas costas que serve de boca. Sua presença ressoa com medos ancestrais — o medo de ser engolido pela escuridão.' },
  { id:'profundo', nome:'Profundo', tipo:'outro-lado', ameaca:'Altíssimo', pv:'68', def:'16', atq:'Tentáculos Abissais (2d8+4 — Morte; alcance médio) / Chamado das Profundezas (Vontade DT 16 ou alvo caminha em direção à água mais próxima)', atributos:{FOR:20,AGI:10,INT:16,PRE:18,VIG:20}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Medo: entidade das águas profundas','Respiração Aquática: se arrastado para água, recupera 3d6 PV/turno','Pressão do Abismo: em alcance curto, agentes sentem peso de toneladas — Lento e −3 FOR','Toque Hipnótico: Vontade DT 15 ou alvo fica fascinado pelas profundezas (1 turno)'], desc:'Entidade que sobe das profundezas de rios e oceanos. Não pertence exatamente ao Outro Lado — veio de algo ainda mais antigo. Sua presença contamina corpos d\'água inteiros com elemento Morte.' },
  { id:'memento-mori', nome:'Memento Mori', tipo:'outro-lado', ameaca:'Extremo', pv:'78', def:'17', atq:'Visão da Morte (3d8 SAN — Conhecimento; o alvo vê em detalhes como vai morrer) / Abraço da Certeza (2d8 — Morte; alvo Machucado não pode ser curado até descanso)', atributos:{FOR:8,AGI:14,INT:26,PRE:24,VIG:16}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento + Morte: entidade que personifica a consciência da própria mortalidade','Lembrete Constante: Medo DT 16 ao entrar na cena — falha = agente fica ciente que pode morrer a qualquer momento (−2 em todos os testes)','Marcação: escolhe um alvo — esse agente recebe visões da própria morte ao rolar 1 ou 2 em qualquer teste','Inevitabilidade: imune a qualquer efeito que impeça morte permanente'], desc:'Entidade filosófica e aterrorizante. Não existe para matar — existe para lembrar. A presença dela faz todos conscientes da própria mortalidade de forma paralisante. Resolver o que torna a morte inaceitável para um agente é a chave.' },
  { id:'rascunho', nome:'Rascunho', tipo:'outro-lado', ameaca:'Alto', pv:'42', def:'14', atq:'Reescrever (2d6 — Conhecimento; altera uma característica física do alvo por 1 cena) / Apagar (1d8+3 — alvo perde 1 memória recente: Vontade DT 14)', atributos:{FOR:6,AGI:16,INT:24,PRE:14,VIG:10}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: entidade que existe como rascunho incompleto de algo maior','Forma Instável: muda de aparência a cada turno — nunca tem a mesma forma duas vezes','Reescrever a Realidade: como ação livre, pode mudar 1 detalhe pequeno do ambiente','Imaterial: apenas rituais de Conhecimento causam dano completo'], desc:'Criatura que parece nunca ter sido terminada — partes do corpo faltam, linhas de "esboço" visíveis. Experimenta sua própria existência como trabalho em progresso. Perigosa por sua imprevisibilidade total.' },
  { id:'medusa-paranormal', nome:'Medusa Paranormal', tipo:'outro-lado', ameaca:'Extremo', pv:'76', def:'17', atq:'Olhar Petrificante (Reflexos DT 18 ou Paralisado 1 turno — não precisa de rolagem de ataque) / Serpentes de Energia (2d8 — Energia; alcance curto; múltiplos alvos)', atributos:{FOR:14,AGI:14,INT:18,PRE:22,VIG:16}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia + Medo: inspirada no mito mas com origem paranormal','Olhar Letão: olhar direto na segunda vez: Fortitude DT 18 ou Petrificado permanentemente (até ritual reverter)','Serpentes Autônomas: as serpentes-cabelo agem independentemente como ação de movimento','Fraqueza do Reflexo: dano de reflexo (espelhos, água) causa dano dobrado a ela'], desc:'Entidade do Sobrevivendo ao Horror baseada no mito grego mas de origem paranormal. As serpentes são manifestações de Energia. O olhar petrificante usa Medo para paralisar e Energia para solidificar. Nunca deve ser encarada diretamente.' },

  // ── AMEAÇAS DA REALIDADE (Sobrevivendo ao Horror) ──
  { id:'serial-killer', nome:'Serial Killer', tipo:'basica', ameaca:'Alto', pv:'45', def:'13', atq:'Ataque Furtivo (2d8+5 — deve estar escondido; +1d8 de dano adicional por turno seguido atacando o mesmo alvo) / Emboscada (Reflexos DT 15 ou alvo pego de surpresa: −5 DEF no 1º ataque)', atributos:{FOR:16,AGI:18,INT:18,PRE:10,VIG:16}, habs:['Sem Elemento: ameaça mundana com motivação psicológica','Predador Solitário: +3 em todas as rolagens quando sozinho com uma única vítima','Planejamento: sabe a posição de todos na cena se estudou o local (INT DT 14)','Resistência ao Medo: imune a efeitos de Medo paranormal'], desc:'Humano comum movido por compulsão assassina. Não é paranormal — mas é uma das ameaças mais perigosas do suplemento porque age com inteligência humana. Não pode ser combatido com rituais. Requer lógica e investigação.' },
  { id:'predador-sofisticado', nome:'Predador Sofisticado', tipo:'basica', ameaca:'Alto', pv:'38', def:'14', atq:'Tiro Cirúrgico (2d6+4 — à distância; +2d6 se alvo ignorar sua presença) / Armadilha Preparada (Reflexos DT 15 ou alvo Imobilizado + 2d6 dano)', atributos:{FOR:14,AGI:20,INT:20,PRE:12,VIG:14}, habs:['Sem Elemento: caçador treinado que adaptou habilidades para seres humanos','Armadilhas: prepara 1d4 armadilhas na cena antes do combate','Silêncio Total: +20 em Furtividade em ambientes externos','Rastreador: reconstrói a rota e intenção de qualquer alvo por rastros'], desc:'Caçador que migrou para caçar humanos. Completamente mundano mas letal como qualquer criatura paranormal. Especialidade em emboscadas, armadilhas e ataques a distância. Engajamento corpo a corpo é sua fraqueza.' },
  { id:'cacador-de-gente', nome:'Caçador de Gente', tipo:'basica', ameaca:'Altíssimo', pv:'55', def:'15', atq:'Arsenal Pesado (2d8+6 — à distância; ignora 3 pontos de DEF) / Caçada Prolongada (segue o alvo por quantas cenas forem necessárias — sem fadiga)', atributos:{FOR:18,AGI:16,INT:18,PRE:10,VIG:20}, habs:['Sem Elemento: humano especializado em captura e eliminação','Equipamento Tático: colete antiprojétil (+4 DEF contra armas), kit de rastreamento','Não Para: imune a condição Abalado e Apavorado (nenhuma emoção)','Alvo Prioritário: escolhe um agente — concentra todo esforço nesse alvo até eliminação'], desc:'Mercenário ou fanático contratado especificamente para eliminar os agentes. Sabe que eles existem, sabe das capacidades paranormais e preparou-se para lidar com elas. A ameaça mais assustadora: um humano que se especializou em matar agentes da Ordo.' },
  { id:'artista-da-morte', nome:'Artista da Morte', tipo:'basica', ameaca:'Extremo', pv:'60', def:'15', atq:'Instrumento de Arte (3d6 — método único personalizado; cada ferida é "assinada") / Performance Final (ao matar: Medo DT 16 para todos que presenciarem)', atributos:{FOR:16,AGI:16,INT:22,PRE:16,VIG:16}, habs:['Sem Elemento: assassino que trata a morte como obra de arte','Planejamento Obsessivo: cada "obra" é preparada — localização certa, vítima escolhida, método elaborado','Assinatura: deixa elementos específicos em cada cena que permitem identificação por Investigação DT 18','Irresistível para Rituais: rituais não funcionam em seu raio de 6m (campo de interferência psíquica por fé absurda)'], desc:'O mais perturbador das ameaças mundanas — não mata por necessidade ou medo. Mata como expressão artística. O crime em si é a obra. Investigar seu padrão é a única forma de antecipar o próximo alvo.' },

  // ── ANIMAIS PARANORMAIS (Sobrevivendo ao Horror) ──
  { id:'aranha-paranormal', nome:'Aranha Paranormal', tipo:'basica', ameaca:'Baixo', pv:'12', def:'10', atq:'Picada (1d4 — Veneno: 1d4/turno por 3 turnos)', atributos:{FOR:4,AGI:20,INT:1,PRE:2,VIG:8}, habs:['Sem Elemento: aranha comum com potencial de contaminação paranormal em zonas de lodo','Enxame: grupo de 10+ aranhas causa 1d8 por turno automaticamente','Teia: Reflexos DT 12 ou Imobilizado 1 turno'], desc:'Aranha comum que habita zonas próximas ao Outro Lado. Seu veneno pode ter propriedades paranormais em áreas de alta contaminação. Sozinha é inofensiva; em enxame, pode incapacitar um agente.' },
  { id:'enxame-tocandiras', nome:'Enxame de Tocandiras', tipo:'basica', ameaca:'Alto', pv:'35', def:'8', atq:'Ferroada em Massa (2d6 por turno — automático se a 1,5m) / Nuvem (cobre área de 4m² — todos dentro sofrem dano automático)', atributos:{FOR:2,AGI:18,INT:1,PRE:2,VIG:14}, habs:['Sem Elemento: formiga tocandira em enxame paranormalmente coordenado','Invulnerável a Ataques Simples: apenas ataques de área, fogo ou veneno causam dano','Dor Paralisante: Fortitude DT 14 a cada turno dentro do enxame ou fica Incapacitado de dor','Coordenação Estranha: persegue um único alvo com precisão — parece guiado'], desc:'Enxame de tocandiras — a formiga com a picada mais dolorosa do mundo — com comportamento coordenado anormalmente. Em zonas de Sangue e Morte, a toxina fica potencializada. Encontrado em O Segredo na Floresta.' },
  { id:'gorila-paranormal', nome:'Gorila Paranormal', tipo:'basica', ameaca:'Altíssimo', pv:'65', def:'16', atq:'Porrada (3d6+6 — Morte) / Arremesso (2d8 — lança alvo até 6m: Reflexos DT 15 ou 2d6 extra de queda)', atributos:{FOR:28,AGI:14,INT:4,PRE:8,VIG:22}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: gorila exposto a símbolo de Morte ou lodo preto','Resistência Bruta: reduz 5 de todo dano físico','Frenesi de Dor: quando abaixo de 30 PV, FOR aumenta +4 e ignora condições','Brado de Terror: Medo DT 15 — falha = Abalado'], desc:'Gorila de zoológico ou laboratório exposto ao Outro Lado. Força sobre-humana com resistência paranormal. Encontrado em missões em zoológicos, florestas e laboratórios de pesquisa próximos a zonas ativas.' },
  { id:'lobo-paranormal', nome:'Lobo Paranormal', tipo:'basica', ameaca:'Alto', pv:'40', def:'13', atq:'Mordida (2d6+3 — Morte) / Matilha: +1d6 por lobo aliado em alcance curto', atributos:{FOR:18,AGI:22,INT:4,PRE:8,VIG:16}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: lobo comum contaminado pelo Outro Lado','Faro Sobrenatural: rastreia qualquer alvo pelo cheiro em até 8 km','Uivo de Matilha: como ação livre, atrai 1d4 lobos adicionais em 1d4 turnos','Invisível na Floresta: na mata, +12 em Furtividade'], desc:'Lobo da realidade contaminado por elemento Morte. Mais rápido, mais forte e mais inteligente que um lobo normal. Age em matilha com coordenação quase sobrenatural. Frequente em O Segredo na Floresta.' },
  { id:'urso-paranormal', nome:'Urso Paranormal', tipo:'basica', ameaca:'Altíssimo', pv:'72', def:'16', atq:'Patada (3d6+5 — Sangue) / Abraço do Urso (2d8 — Agarrado; 2d6 compressão/turno)', atributos:{FOR:26,AGI:10,INT:4,PRE:8,VIG:24}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: urso com elemento Sangue — mais agressivo e resistente','Pele Espessa: reduz 4 de todo dano físico','Não Para: ao chegar a 0 PV pela 1ª vez, continua agindo por mais 1 turno','Faro de Sangue: detecta qualquer ferimento aberto em alcance extremo'], desc:'Urso pardo contaminado pelo elemento Sangue. Já era um dos animais mais perigosos da fauna brasileira — com o Sangue paranormal, torna-se quase invencível por meios convencionais. Territorialíssimo.' },
  { id:'touro-paranormal', nome:'Touro Paranormal', tipo:'basica', ameaca:'Altíssimo', pv:'68', def:'15', atq:'Chifrada (3d6+4 — Sangue; derruba alvo) / Investida (4d6 — alvo no caminho; Reflexos DT 16 ou preso sob o touro)', atributos:{FOR:28,AGI:12,INT:2,PRE:6,VIG:24}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: touro com Sangue paranormal — bom ao sentir ferimentos','Fúria Constante: nunca recua; imune a efeitos que forcem recuo ou hesitação','Investida Devastadora: se mover 6m+ em linha reta, dano da Investida é dobrado','Veias Expostas: ao receber dano, expõe veias de lodo vermelho — DEF diminui 2 mas dano aumenta 2'], desc:'Touro de fazenda ou tourada exposto ao elemento Sangue. Já perigoso por natureza, o Sangue o torna uma máquina de destruição que não para até que o alvo ou ele mesmo esteja morto. Requer ambiente amplo ou armadilhas.' },

  // ── HEXATOMBE & VENDETA OCULTA ──
  { id:'cavaleiro-hexatombe', nome:'Cavaleiro do Hexatombe', tipo:'outro-lado', ameaca:'Catastrófico', pv:'112', def:'21', atq:'Lâmina dos Seis Ritos (4d8+6 — multi-elemento; alterna elemento a cada acerto) / Invocar o Rito (todos na cena: 3d8 — elemento do rito atual)', atributos:{FOR:24,AGI:16,INT:20,PRE:22,VIG:24}, habs:['Todos os Elementos do Hexatombe: muda elemento ativo a cada turno (ordem: Sangue→Morte→Conhecimento→Energia→Medo→repetir)','Rito Ativo: imune ao elemento que está usando naquele turno','Selo do Hexatombe: ao morrer, activa um dos seis ritos como efeito de área','Enigma dos Seis: resolver a sequência correta dos ritos antes do combate reduz seus PV em 50%'], desc:'Guardião das missões do Hexatombe — entidade que carrega os seis ritos paranormais em si. Combatê-lo sem entender a sequência dos ritos é suicida. Aparece quando um dos rituais do Hexatombe é interrompido de forma errada.' },
  { id:'corpo-de-prova', nome:'Corpo de Prova', tipo:'basica', ameaca:'Altíssimo', pv:'62', def:'15', atq:'Injeção de Experimento (2d8 — Energia; aplica efeito aleatório: rola 1d4)', atributos:{FOR:16,AGI:14,INT:10,PRE:8,VIG:20}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: humano usado como cobaia de experimento paranormal da Indústrias Panacea','Efeitos de Experimento (d4): 1=+2d6 FOR por 1 turno, 2=Desaparece por 1 turno, 3=Duplica-se em cópia de 20PV, 4=Cura 2d8 PV','Resistência Química: imune a venenos e efeitos de condição físicos','Colapso Terminal: ao morrer, libera energia residual — todos em alcance curto: Fortitude DT 15 ou 1d8 Energia'], desc:'Cobaia das Indústrias Panacea que escapou ou foi usada como arma. O experimento instabilizou seu elemento de forma que nenhuma reação é previsível. Cada turno pode ser completamente diferente.' },
  { id:'sombra-da-panacea', nome:'Agente da Panacea', tipo:'basica', ameaca:'Alto', pv:'48', def:'15', atq:'Arma Modificada (2d6+4 — arma tech com munição paranormal) / Inibidor de Ritual (Conhecimento DT 15 ou ritual do agente falha)', atributos:{FOR:14,AGI:18,INT:18,PRE:12,VIG:16}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: operativo das Indústrias Panacea treinado em contra-paranormal','Equipamento de Ponta: colete (+4 DEF), arma modificada, inibidor de rituais portátil','Conhece as Fraquezas: sabe os elementos e fraquezas básicas de todas as criaturas do livro de regras','Evacuação: ativa fuga tática ao atingir 30% PV — sempre tenta sair vivo para relatar'], desc:'Operativo da Indústrias Panacea — organização que usa o paranormal para fins lucrativos. Altamente treinado contra agentes da Ordo. Diferente de outros humanos, não entra em pânico diante do paranormal e sabe como neutralizar rituais.' },
  { id:'possesso', nome:'Possesso', tipo:'basica', ameaca:'Alto', pv:'44', def:'13', atq:'Ataque do Hospedeiro (2d6+3 — usa habilidades e equipamento da pessoa possuída) / Voz da Entidade (1d8 SAN — Medo; sussurra o maior medo do alvo)', atributos:{FOR:14,AGI:14,INT:18,PRE:16,VIG:14}, habs:['Elemento da Entidade: o elemento varia conforme a entidade que o possui','Habilidades do Hospedeiro: usa todas as perícias, equipamentos e rituais da pessoa original','Revelar Entidade: ao atingir 50% PV, a entidade abandona o hospedeiro parcialmente — fica visível','Exorcismo: rituais de Morte ou Conhecimento DT 15 expulsam a entidade sem matar o hospedeiro'], desc:'Humano possuído por entidade paranormal. O grande perigo é que pode ser alguém que os agentes conhecem — aliado, civil, membro da Ordo. Derrotar sem matar exige planejamento e rituais específicos.' },
  { id:'fantasma-natal', nome:'Fantasma do Natal Macabro', tipo:'outro-lado', ameaca:'Altíssimo', pv:'58', def:'15', atq:'Dom Envenenado (2d6 — Morte + Medo; acompanhado de objeto maldito que persiste na cena) / Lembrança Dolorosa (2d8 SAN — usa memórias de Natal das vítimas)', atributos:{FOR:8,AGI:14,INT:18,PRE:22,VIG:14}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte + Medo: entidade sazonal ligada à Morte em períodos festivos','Objetos Malditos: cada Dom deixa um objeto que causa 1d4 SAN por turno a quem se aproximar','Dons Obrigatórios: Vontade DT 15 ou alvo pega o Dom mesmo sabendo ser maldito','Fraqueza Sazonal: apenas durante períodos específicos tem poder total; fora deles, −4 em tudo'], desc:'Entidade do especial Natal Macabro. Manifesta-se em períodos festivos e usa a iconografia do Natal como arma — presentes, decorações, músicas. O horror do familiar tornado monstruoso.' },

  // ── CALAMIDADE & DESCONJURAÇÃO ──
  { id:'cultista-ordo-calamitas', nome:'Cultista da Ordo Calamitas', tipo:'basica', ameaca:'Alto', pv:'42', def:'13', atq:'Ritual de Invocação (2d6 — elemento variado; invoca criatura menor em 2 turnos se não interrompido) / Faca Cerimonial (1d8+2 — Sangue)', atributos:{FOR:12,AGI:12,INT:16,PRE:16,VIG:12}, habs:['Elemento Variado: membro da Ordo Calamitas tem elemento escolhido pelo Mestre','Fanatismo Absoluto: imune a Medo; −4 em Vontade contra ordens da Ordo Calamitas','Ritual de Grupo: se há 3+ cultistas na cena, podem realizar ritual de invocação juntos (mais rápido e poderoso)','Sacrifício Voluntário: ao morrer, pode escolher aumentar o poder do próximo ritual aliado em +1d8'], desc:'Membro da organização antagonista principal de Calamidade. Não são simplesmente fanáticos — muitos entendem o paranormal melhor que a Ordo Realitas. Alguns são ex-agentes da Ordo que mudaram de lado por convicção genuína.' },
  { id:'executor-leone', nome:'Executor da Família Leone', tipo:'basica', ameaca:'Alto', pv:'50', def:'15', atq:'Execução (2d8+4 — arma de fogo, tiro na cabeça: crítico com 19-20) / Intimidação Paranormal (Medo DT 14 — Abalado + alvo cede informações)', atributos:{FOR:16,AGI:18,INT:14,PRE:18,VIG:16}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: assassino profissional ligado à Família Leone','Executar sem Hesitar: +3 em ataques contra alvos sem cobertura','Resistência Ritual: rituals de Conhecimento e Medo têm −3 DT contra ele','Conhece os Agentes: possui dossiê sobre um dos agentes — sabe armas, habilidades e fraquezas físicas'], desc:'Sicário da Família Leone — organização criminosa com raízes no paranormal desde a campanha Calamidade. Profissional, calculista e sem hesitação. Usa o conhecimento sobre os agentes como arma táctica.' },
  { id:'remanescente-desconjuracao', nome:'Remanescente da Desconjuração', tipo:'outro-lado', ameaca:'Altíssimo', pv:'65', def:'16', atq:'Pulso de Desconjuração (3d6 — Energia + Medo; desfaz rituais ativos do alvo) / Toque do Desfeito (2d8 — Energia; apaga 1 memória de habilidade por turno)', atributos:{FOR:14,AGI:16,INT:18,PRE:20,VIG:16}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia + Medo: sobrevivente da Desconjuração que perdeu a forma humana','Cancelamento de Rituais: como ação livre, cancela o efeito de qualquer ritual ativo em alcance médio','Instabilidade Permanente: muda de forma a cada turno — nova aparência, mesmas habilidades','Eco da Desconjuração: seu elemento original está "desfeito" — vulnerável a todos os elementos'], desc:'Entidade formada a partir de alguém que sobreviveu à Desconjuração mas foi distorcido além do reconhecimento. Carrega fragmentos de todos os elementos e não tem identidade paranormal coerente. Cada encontro é um novo enigma.' },

  // ── CRIATURAS DA SÉRIE CANÔNICAS RESTANTES ──
  { id:'figura-calamidade', nome:'A Figura (Calamidade)', tipo:'outro-lado', ameaca:'Catastrófico', pv:'122', def:'22', atq:'Presença Absoluta (todos na cena: 4d10 SAN — efeito de área; não tem ataque individual)', atributos:{FOR:20,AGI:10,INT:30,PRE:30,VIG:26}, habs:['Todos os Elementos: usa o elemento mais eficaz contra cada alvo individualmente','Presença do Fim: Medo DT 24 — falha crítica = Trauma permanente (condição persistente entre sessões)','Além da Compreensão: sua forma verdadeira não pode ser olhada diretamente','Profecia Cumprida: se os agentes falham em seu Enigma, A Figura avança para o próximo passo do plano — não mata agentes gratuitamente'], desc:'A grande ameaça de Calamidade. Não é uma criatura no sentido convencional — é a convergência de intenção do Outro Lado. Combatê-la diretamente é impossível. A única vitória possível é entender seu plano e agir com antecedência.' },
  { id:'strach-matriarca', nome:'Família Strach — Matriarca', tipo:'basica', ameaca:'Extremo', pv:'85', def:'18', atq:'Ritual da Família (3d8 — Medo + Morte; apenas membros da família Strach podem fazer esse ritual) / Comando Familiar (controla qualquer membro da família Strach na cena)', atributos:{FOR:14,AGI:12,INT:24,PRE:28,VIG:20}, habs:['<span class="sym-el sym-medo" title="Medo"></span> Elemento Medo: matriarca da família cult que aparece em Calamidade','Laço de Sangue: membros da família recebem +4 em todos os ataques quando ela ordena','Segredos da Família: conhece um segredo de cada agente que encontrou antes','Enigma Familiar: sua fraqueza está no próprio núcleo da família — uma traição interna'], desc:'Líder da Família Strach — culto familiar que aparece em Calamidade. Usa a estrutura de uma família aparentemente normal como cobertura para rituais do Outro Lado. Seu poder vem dos vínculos familiares — quebrar esses vínculos é derrotá-la.' },
  { id:'criatura-quarentena', nome:'Criatura da Quarentena', tipo:'outro-lado', ameaca:'Altíssimo', pv:'62', def:'16', atq:'Contágio Paranormal (2d6 — Sangue; infecta com "praga" que avança 1d6/turno sem cura) / Multiplicação (divide-se em 2 cópias de 25 PV ao chegar a 50% PV)', atributos:{FOR:14,AGI:14,INT:8,PRE:10,VIG:20}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue + Morte: entidade confinada durante o especial Quarentena','Imunidade a Isolamento: atravessa qualquer barreira física (exceto ritual específico)','Contágio em Área: ao atacar, todos em alcance curto fazem Fortitude DT 14 ou ficam infectados','Cura Impossível: a praga não responde a cura mundana — apenas ritual de Sangue específico'], desc:'Entidade encontrada no especial Quarentena. Usada como arma biológica paranormal. O confinamento torna-a mais perigosa — e a missão de contê-la novamente é o principal desafio do episódio.' },
  // ══ PORTADOR DO MEDO (v0.5.2) ══
  { id:'vigorexico', nome:'Vigoréxico', tipo:'outro-lado', ameaca:'Alto', pv:'200', def:'16', atq:'Estímulo Muscular (4d8+8 — Sangue; alvos ficam Sangramento) / Hipertrofia (movimento — aumenta tamanho)', atributos:{FOR:30,AGI:10,INT:2,PRE:8,VIG:28}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: VD 80 — Taxa de Adaptação','Estimulo Muscular: Fortitude DT 22 ou Lesão Branda','Hipertrofia: pode crescer de tamanho como ação de movimento','Imune a manobras de derrubar/empurrar'], desc:'Criatura de Sangue que representa os excessos do culto ao corpo. Quanto mais danificado, mais poderoso fica. Cada golpe que causar pode ser revertido em aumento de Força.' },
  { id:'armadura-viva', nome:'Armadura Viva', tipo:'outro-lado', ameaca:'Alto', pv:'320', def:'28', atq:'Pestes Devoradoras (2d6 Perf/rod a todos na área; Fortitude DT 20) / Envolver (padrão — Agarrado; DT 20)', atributos:{FOR:20,AGI:3,INT:0,PRE:4,VIG:40}, habs:['Elemento Morte/Sangue: VD 100 — formada por centenas de animais','Pestes Devoradoras: RD imune a críticos e manobras Agarrar/Atropelar/Derrubar','Sangue Frio: sofre Exausta 1 rod ao tomar dano de Fogo ou Frio','Dispersar (movimento): muda tamanho ±1 categoria, altera DT em ±5','Turbilhão de Pestes: todos caídos + 2d8 Impacto (Reflexos DT 20)'], desc:'Massa de centenas de animais de tortura com mente coletiva. Pode ocupar o mesmo espaço de outros seres, causando dano por rodada. Teme fogo e frio.' },
  { id:'mal-acostumado', nome:'Mal-Acostumado', tipo:'outro-lado', ameaca:'Alto', pv:'888', def:'0', atq:'Ofertas Tentadoras (reação — Vontade DT 25; 1d12 SAN + efeito 1d6) / Permaneça Comigo (reação — 4 manobras Agarrar, 3d20+15)', atributos:{FOR:3,AGI:-2,INT:3,PRE:3,VIG:6}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: VD 100 — Preguiça Insaciável: jamais se move','RD 20 a todo dano; 888 PV; Defesa 0','Ofertas Tentadoras: atrai para si, causa 1d12 SAN + 1d6 efeito (Ego/Fome/Ira/Riqueza/O Outro/Prazer)','Gases Acumulados: 1/4 de chance por rodada de deixar todos Enjoados (DT 20)','Luxo Demais: ao crítico, vomita cone 4,5m — Enjoado e 2d10 Químico (DT 25)'], desc:'Representação dos sete pecados capitais. Nunca se move. Sua defesa é zero mas possui 888 PV e RD 20. Atrai vítimas e as corrompe com tentações antes de destruí-las.' },
  { id:'escorquilo', nome:'Escorquilo', tipo:'outro-lado', ameaca:'Altíssimo', pv:'500', def:'20', atq:'Ferrão (completa — Fortitude DT 22; paralisia + dano) / Investida Destruidora (completa — derruba tudo no caminho)', atributos:{FOR:28,AGI:10,INT:4,PRE:8,VIG:30}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: VD 180 — quimera escorpião-ankylossaurideo','Dor Constante: causa 1d6 a si mesmo ao se mover; ataques +3d6 dano','Veneno Interno: gera opioides, Fortitude DT 18 ou Paralisado','RD 15 físico; 5m comprimento x 3,5m altura'], desc:'Ser em sofrimento eterno. Seus espinhos e exoesqueleto o torturam continuamente. Extremamente territorial, ataca com força devastadora para aliviar a dor.' },
  { id:'sacerdote-galante', nome:'Sacerdote Galante', tipo:'outro-lado', ameaca:'Extremo', pv:'760', def:'22', atq:'Seduzir (padrão — Vontade DT 28 ou Fascinado) / Drenar Sangue (completa — 6d12 Sangue, recupera metade como PV)', atributos:{FOR:10,AGI:14,INT:24,PRE:30,VIG:18}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: VD 360 — predador social','Conjura rituais de Sangue 1°-3° círculo como ação livre 1×/cena','Imune a encantamentos e efeitos de medo','Presença Perturbadora DT 30 ao avistar'], desc:'Entidade extremamente carismática que seduz antes de drenar. Quanto mais o alvo interage, mais difícil se libertar. Usa rituais de Sangue como armamento secundário.' },
  { id:'dama-destino', nome:'Dama do Destino', tipo:'outro-lado', ameaca:'Altíssimo', pv:'480', def:'23', atq:'Corte do Destino (3d10+5 — Conhecimento; ignora DEF de equipamento) / Predição (livre — esquiva do próximo ataque)', atributos:{FOR:10,AGI:26,INT:28,PRE:24,VIG:18}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: VD 180 — vê fragmentos do futuro','Esquiva Profética: +10 DEF no 1° ataque de cada rodada','Peão do Destino: se um Peão do Destino adjacente morrer, ganha ação extra','Ação Extra: 2 ações padrão por turno'], desc:'Entidade que prevê cada movimento. Age em parceria com Peões do Destino. A imprevisibilidade é a única defesa efetiva contra ela.' },
  { id:'egresso-hediondo', nome:'Egresso Hediondo', tipo:'outro-lado', ameaca:'Extremo', pv:'600', def:'19', atq:'Toque da Degeneração (4d8+6 — Morte+Sangue; Infecção) / Regeneração Monstruosa (livre — +8d8 PV)', atributos:{FOR:26,AGI:8,INT:8,PRE:12,VIG:30}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte+Sangue: VD 360 — podridão de mil corpos','Regeneração: recupera 8d8 PV no início de cada turno','Infecção: feridas causadas não cicatrizam sem cura mágica ou ritual','Aura de Podridão: adjacentes DT 22 Fortitude ou Enjoados'], desc:'Massa de corpos em decomposição fundidos. Quase impossível de matar permanentemente graças à regeneração. Cada ferimento causa infecção incurável por meios mundanos.' },
  { id:'colibri-radial', nome:'Colibri Radial', tipo:'outro-lado', ameaca:'Alto', pv:'140', def:'18', atq:'Rajada de Luz (2d10+4 — Energia; Ofuscado 1 rod) / Bico Radial (movimento — 4d6 Energia; ignora RD)', atributos:{FOR:6,AGI:30,INT:10,PRE:14,VIG:12}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: VD 80 — velocidade extrema','Tocha Radial: emite luz que revela criaturas invisíveis em alcance médio','Camuflagem Total ao mover 20m+ em linha reta por rodada','Se imobilizado: DEF cai para 10; não pode usar Camuflagem','Voo 30m'], desc:'Criatura de Energia pura formada por luz. Virtualmente impossível de atingir enquanto se move continuamente. Revela o invisível com sua luz radial.' },
  { id:'dancarina-melodica', nome:'Dançarina Melódica', tipo:'outro-lado', ameaca:'Altíssimo', pv:'440', def:'18', atq:'Melodia Hipnótica (padrão — Vontade DT 25; Fascinado pela dança) / Passos Letais (3 ataques/rod — 3d8 Energia cada; +4d8 no 3° contra mesmo alvo)', atributos:{FOR:10,AGI:28,INT:16,PRE:28,VIG:16}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia+Medo: VD 240 — dança eterna','Realiza 3 ataques por rodada; o 3° contra mesmo alvo causa bônus','Hipnose da Dança: qualquer ser que a observe deve DT 25 Vontade ou Fascinado','Imune a condições que impeçam movimento'], desc:'Dança sem pausas. Quem a observa é hipnotizado. Combina velocidade de Energia com terror do Medo em cada passo.' },
  { id:'segundo-sol', nome:'Segundo Sol', tipo:'outro-lado', ameaca:'Extremo', pv:'760', def:'22', atq:'Queimar (4d10+8 — Fogo/Energia) / Explosão Solar (6d12 área 9m — 1×/cena; Fortitude DT 26) / Cegueira (livre — Fortitude DT 22 ou Cego 1 rod)', atributos:{FOR:16,AGI:14,INT:20,PRE:22,VIG:28}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: VD 340 — sol paranormal','Aura Solar: seres adjacentes sofrem 2d8 Fogo por rodada','Imune a Fogo e Luz; Vulnerável a Frio','Cegueira: qualquer ser que olhe diretamente Fortitude DT 22 ou Cego'], desc:'Estrela de Energia pura. Simplesmente existir próximo a ele causa dano. Precisa ser combatido com cobertura e rituais de Frio.' },
  { id:'drake', nome:'Drake', tipo:'outro-lado', ameaca:'Extremo', pv:'900', def:'20', atq:'Garras (4d8+8 — Sangue) / Mordida (4d10+8 — Sangue) / Sopro de Sangue (cone 9m — 6d10; 1×/cena)', atributos:{FOR:32,AGI:14,INT:8,PRE:12,VIG:34}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento Sangue: VD 400 — dragão de Sangue','RD 15 físico; Voo 30m; Tamanho Enorme','Fúria de Sangue: abaixo de 30% PV, +4 em ataques e dano','Sopro de Sangue: 6d10 em cone, Sangramento obrigatório nos atingidos'], desc:'Forma dracônica de Sangue. Violência pura encarnada. Quanto mais ferido, mais letal fica. Sua aura de sangue corrompe tudo ao redor.' },
  { id:'apanhador-sonhos', nome:'Apanhador de Sonhos', tipo:'outro-lado', ameaca:'Baixo', pv:'100', def:'14', atq:'Toque dos Sonhos (1d8+2 — Mental; Sonolento) / Tecer Pesadelo (completa — 2d6 SAN; 1×/cena)', atributos:{FOR:6,AGI:14,INT:16,PRE:18,VIG:10}, habs:['Elemento Conhecimento/Medo: VD 40','Ataca preferencialmente alvos dormindo; +5 em ataques contra Inconscientes','Imaterial: físico causa metade do dano; rituais causam dano total'], desc:'Entidade que se alimenta de sonhos. Inofensivo para quem está desperto e alerta. Mais perigoso em missões de interlúdio ou quando agentes descansam.' },
  { id:'casca-vazia', nome:'Casca Vazia', tipo:'outro-lado', ameaca:'Baixo', pv:'120', def:'12', atq:'Toque do Vazio (1d6+3 — Mental; alvo perde 1 PE) / Absorver Personalidade (completa — Vontade DT 15; rouba 1 habilidade temporária)', atributos:{FOR:8,AGI:10,INT:14,PRE:12,VIG:12}, habs:['Elemento Morte/Conhecimento: VD 60','Sem alma: imune a efeitos de medo e encantamentos','Absorver Personalidade: rouba 1 habilidade temporária (DT 15 Vontade)'], desc:'Ser completamente vazio de identidade. Copia comportamentos e habilidades de suas vítimas para preencher o vazio. Perturbador pela sua imitação.' },
  { id:'visitante', nome:'O Visitante', tipo:'outro-lado', ameaca:'Alto', pv:'240', def:'16', atq:'Toque Anômalo (3d6 — Energia; Confuso 1 rod) / Distorção da Realidade (padrão — Vontade DT 20; ilusão persistente)', atributos:{FOR:10,AGI:14,INT:22,PRE:20,VIG:16}, habs:['Elemento Energia/Conhecimento: VD 100','Não pertence à Realidade: ignora obstáculos físicos 1×/rod','Presença Distorcida: todos a 9m sofrem –2 em Percepção e Investigação'], desc:'Entidade que não pertence a nenhuma dimensão conhecida. Sua presença distorce a percepção da realidade ao redor.' },
  { id:'tecela-pesadelos', nome:'Tecelã de Pesadelos', tipo:'outro-lado', ameaca:'Altíssimo', pv:'360', def:'18', atq:'Pesadelo Tecido (4d8 SAN — Medo; Vontade DT 22 ou Apavorado) / Laço de Sono (padrão — Vontade DT 20; Inconsciente 1 rod)', atributos:{FOR:8,AGI:16,INT:24,PRE:26,VIG:18}, habs:['Elemento Medo/Conhecimento: VD 140','Tecer Pesadelo: acessa os medos mais profundos do alvo','Imune a dano físico; apenas rituais causam dano total','Presença: Medo DT 20 ao entrar em cena'], desc:'Entidade que tece pesadelos com os medos mais profundos das vítimas. Impossível de combater sem enfrentar os próprios traumas.' },
  { id:'entulhobo', nome:'Entulhobo', tipo:'outro-lado', ameaca:'Altíssimo', pv:'500', def:'16', atq:'Investida de Detritos (3d8+8 — Impacto; derruba) / Absorção (livre — engole objetos do ambiente; +2d8 PV)', atributos:{FOR:28,AGI:6,INT:4,PRE:6,VIG:30}, habs:['Elemento Morte: VD 220 — massa de detritos','RD 8 físico; cresce ao absorver objetos do ambiente','Crescimento Urbano: em ambientes com muitos objetos, pode gastar ação para absorver e recuperar 2d8 PV','Tamanho Enorme'], desc:'Massa de entulho animado. Mais forte em ambientes urbanos cheios de detritos. Quanto mais luta em locais cheios de objetos, mais se alimenta.' },
  { id:'morte-branca', nome:'Morte Branca', tipo:'outro-lado', ameaca:'Extremo', pv:'620', def:'19', atq:'Golpe de Gelo (4d8+6 — Morte/Frio; Paralisado 1 rod DT 22) / Tempestade Gelada (completa — área 9m; 3d10 Frio por rod; 1×/cena)', atributos:{FOR:22,AGI:16,INT:14,PRE:18,VIG:26}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: VD 280 — tempestade de neve senciente','Aura Glacial: adjacentes perdem 1d6 PV por rodada','Imune a Frio e Morte; Vulnerável a Fogo','Frio Absoluto: reduz velocidade de alvos atingidos em 3m/rod (cumulativo)'], desc:'Consciência formada por uma tempestade de neve paranormal. Congela a alma antes do corpo.' },
  { id:'necromante', nome:'Necromante', tipo:'outro-lado', ameaca:'Extremo', pv:'560', def:'18', atq:'Drenar Vitalidade (4d8+6 — Morte; cura 50% do dano) / Invocar Mortos (completa — 1d4+2 esqueletos VD 20)', atributos:{FOR:12,AGI:14,INT:28,PRE:22,VIG:20}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Elemento Morte: VD 320 — transcendeu a morte','Rituais de Morte 1°-3° círculo como ação livre 1×/cena','Segunda Chance: ao ser reduzido a 0 PV, levanta 1 esqueleto com 120 PV 1×/cena','+2 DEF para cada lacaio vivo em cena (máx +8)'], desc:'Ser que transcendeu a morte. Comanda exércitos de cadáveres e drena a vitalidade dos vivos para se sustentar. Destruí-lo exige eliminar todos os lacaios primeiro.' },
  { id:'mercador', nome:'Mercador', tipo:'outro-lado', ameaca:'Altíssimo', pv:'520', def:'18', atq:'Acordo Vinculante (padrão — Vontade DT 24; vincula alvo a um pacto) / Cobrança (completa — causa dano = 10% PV máximo do alvo; infalível contra pactuados)', atributos:{FOR:10,AGI:14,INT:30,PRE:32,VIG:16}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Elemento Conhecimento: VD 240 — entidade de pactos','Imune a dano físico; apenas quebrar o pacto que o sustenta destrói','Enigma: descobrir e quebrar o pacto fundamental o enfraquece','Ofertas Irrecusáveis: pode oferecer qualquer coisa ao custo de uma dívida'], desc:'A mais perigosa de todas as entidades em negociação. Nunca ataca diretamente — vincula. Destruí-lo requer entender e quebrar o pacto que o mantém no mundo.' },
  { id:'peoes-destino', nome:'Peões do Destino', tipo:'outro-lado', ameaca:'Alto', pv:'200', def:'16', atq:'Golpe do Destino (2d8+4 — Conhecimento) / Sacrifício (reação — absorve dano destinado à Dama)', atributos:{FOR:16,AGI:14,INT:10,PRE:12,VIG:18}, habs:['Elemento Conhecimento: VD 80 — lacaios da Dama do Destino','Sacrifício: absorve qualquer ataque destinado à Dama do Destino como reação','Em grupo: +2 em ataques por aliado Peão adjacente (máx +6)','Se a Dama do Destino morrer, todos os Peões ficam Atordoados 1 rod'], desc:'Servos da Dama do Destino. Funcionam como escudo e extensão de poder dela. Eliminá-los primeiro é sempre a estratégia correta.' },
  { id:'par-orbital', nome:'Par Orbital', tipo:'outro-lado', ameaca:'Altíssimo', pv:'540', def:'20', atq:'Orbitar (2 ataques simultâneos — 3d8+5 Energia cada) / Pulso Sincronizado (5d10 área 6m; 1×/cena)', atributos:{FOR:14,AGI:24,INT:16,PRE:16,VIG:22}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Elemento Energia: VD 240 — dois seres orbitando um ao outro','Sincronismo: sempre atacam juntos; se um incapacitado, o outro perde 50% PV instantaneamente','Orbitar: movimento em círculo concede +4 DEF constantemente','Vulnerabilidade: separados por 9m+, perdem todas as habilidades especiais'], desc:'Dupla de seres de Energia em órbita constante. Inseparáveis — separar os dois é a única forma de reduzir sua efetividade drasticamente.' },
  { id:'quadrinista', nome:'Quadrinista', tipo:'outro-lado', ameaca:'Extremo', pv:'1000', def:'22', atq:'Painel de Realidade (reescreve 1 evento ocorrido neste turno; 1×/cena) / Tinta de Sangue (4d10 — Sangue; ignora RD)', atributos:{FOR:16,AGI:18,INT:32,PRE:26,VIG:24}, habs:['Elemento Conhecimento/Sangue: VD 400 — entidade criativa com poder imenso','Reescrever Realidade: 1×/cena, cancela completamente um ataque ou efeito que acabou de acontecer','Imune a qualquer efeito que já o atingiu nesta cena','Narrativa Própria: início de cada cena, escolhe 1 imunidade elemental'], desc:'Entidade de poder quase absoluto. Reescreve a realidade como se fosse um quadrinho. Nenhuma estratégia pode ser usada duas vezes contra ele.' },
  { id:'placeholder', nome:'Placeholder', tipo:'outro-lado', ameaca:'Baixo', pv:'100', def:'12', atq:'Golpe Indefinido (1d8+2 — tipo aleatório) / Substituir (completa — assume estatísticas de criatura morta nesta cena)', atributos:{FOR:10,AGI:10,INT:10,PRE:10,VIG:10}, habs:['Elemento Aleatório: VD 40 — copia outras criaturas','Substituir: ao matar criatura, assume suas estatísticas básicas por 1 cena','Indistinto: penalidade –5 em Percepção para identificá-lo em combate'], desc:'Criatura sem forma definida. Existe para preencher lacunas no Outro Lado. Perigosa por imprevisibilidade e capacidade de imitação.' },
  { id:'sit-amet', nome:'Sit Amet', tipo:'outro-lado', ameaca:'Baixo', pv:'40', def:'10', atq:'Presença Perturbadora (passiva — DT 12; 1d4 SAN por rodada de presença)', atributos:{FOR:2,AGI:8,INT:20,PRE:14,VIG:6}, habs:['Elemento Conhecimento: VD 20 — fragmento de texto do Outro Lado','Completamente imaterial: imune a dano físico','Ao ser destruído, todos em alcance curto recuperam 1d6 SAN'], desc:'Fragmento de texto incompreensível que ganhou consciência. Mais perturbador que letal.' },
  { id:'apagar-erros', nome:'Apagar os Erros', tipo:'outro-lado', ameaca:'Baixo', pv:'60', def:'11', atq:'Apagamento (padrão — Vontade DT 15; alvo perde 1 memória desta missão)', atributos:{FOR:4,AGI:12,INT:18,PRE:12,VIG:8}, habs:['Elemento Morte/Conhecimento: VD 20 — apaga memórias traumáticas','Apagamento: alvo que falha na DT perde 1 memória específica desta missão','Imaterial: atravessa paredes; dano físico causa apenas 1'], desc:'Entidade que apaga erros e arrependimentos do passado. Busca vítimas com traumas e os remove — para o bem ou para o mal.' },
  // ══ GUIA DAS MARCAS (0.5.1) — BERÇÁRIO PARANORMAL ══
  { id:'duoguinho', nome:'Duoguinho', tipo:'outro-lado', ameaca:'Baixo', pv:'20', def:'10', atq:'Mordidinha (1d4 — Sangue)', atributos:{FOR:8,AGI:12,INT:2,PRE:4,VIG:10}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Forma larval de criatura de Sangue','Foge quando ferido','Em grupo: +1 atq por aliado adjacente'], desc:'Versão jovem e fraca de uma criatura de Sangue. Sozinho é inofensivo, mas nunca aparece sozinho.' },
  { id:'lobohni', nome:'Lobohni', tipo:'outro-lado', ameaca:'Baixo', pv:'22', def:'11', atq:'Mordida (1d6+2 — Sangue)', atributos:{FOR:14,AGI:14,INT:2,PRE:4,VIG:12}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Filhote de Lobisomem','Uivo: Medo DT 10 ou Abalado','Fraqueza a Prata'], desc:'Filhote de Lobisomem paranormal. Menos resistente que o adulto, mas igualmente agressivo.' },
  { id:'espreitadinho', nome:'Espreitadinho', tipo:'outro-lado', ameaca:'Baixo', pv:'18', def:'12', atq:'Cutucada (1d4 — Conhecimento)', atributos:{FOR:4,AGI:16,INT:14,PRE:10,VIG:8}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Fragmento do Espreitador','Furtivo: +10 em Furtividade','Observa antes de atacar'], desc:'Fragmento menor do Espreitador. Apenas observa e foge — mas onde ele aparece, o Espreitador verdadeiro não está longe.' },
  { id:'sukita', nome:'Sukita', tipo:'outro-lado', ameaca:'Médio', pv:'30', def:'13', atq:'Sopro do Caos (1d8 — Energia)', atributos:{FOR:10,AGI:16,INT:6,PRE:8,VIG:12}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Fragmento de Energia','Instável: ao morrer, causa 2d6 Energia em área curta','Imprevisível: age aleatoriamente (1d6 define ação)'], desc:'Pequena entidade de Energia que age sem padrão. Tão perigosa para aliados quanto para inimigos.' },
  { id:'tel-alpha', nome:'Tel-Alpha', tipo:'outro-lado', ameaca:'Alto', pv:'40', def:'15', atq:'Toque Desintegrante (2d6+3 — Energia)', atributos:{FOR:12,AGI:18,INT:10,PRE:12,VIG:14}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Forma evoluída de perturbado de Energia','Fase: 25% chance de qualquer ataque não acontecer','Explosão Final: 3d6 Energia ao morrer'], desc:'Evolução direta do Perturbado de Energia. Mais estável e muito mais perigoso.' },
  { id:'advenas', nome:'Ádvenas', tipo:'outro-lado', ameaca:'Alto', pv:'42', def:'14', atq:'Golpe Adaptativo (2d6 — tipo varia)', atributos:{FOR:16,AGI:14,INT:12,PRE:10,VIG:16}, habs:['<span class="sym-el sym-sangue" title="Sangue"></span> Elemento variável: adapta ao oponente','Muda elemento a cada rodada (escolhe vantagem)','Resistente ao último elemento que usou'], desc:'Entidade que se adapta a qualquer combate. Muda seu elemento para ter vantagem sobre o oponente.' },
  { id:'carcaca-quebrada', nome:'Carcaça Quebrada', tipo:'outro-lado', ameaca:'Alto', pv:'38', def:'12', atq:'Braços Múltiplos (2d6+3 — Impacto)', atributos:{FOR:18,AGI:6,INT:2,PRE:4,VIG:18}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Morto-vivo feito de partes remendadas','Reconstituição: 30% de chance de voltar com 1 PV','Partes Soltas: cada braço age como ataque separado'], desc:'Cadáver remendado com partes de múltiplos corpos. Cada membro age semi-independentemente.' },
  { id:'fofoqueiro', nome:'Fofoqueiro', tipo:'outro-lado', ameaca:'Baixo', pv:'15', def:'10', atq:'Sussurro (1d4 SAN — Conhecimento)', atributos:{FOR:4,AGI:14,INT:16,PRE:18,VIG:6}, habs:['<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Entidade que espalha segredos','Invisível para adultos: só crianças e SAN baixo veem','Sabe segredos: conhece informação sobre qualquer pessoa na cena'], desc:'Entidade que sussurra segredos e fofocas sobre todos presentes. Não ataca — mas suas informações podem destruir alianças.' },
  { id:'lodinho', nome:'Lodinho', tipo:'outro-lado', ameaca:'Baixo', pv:'20', def:'8', atq:'Lodo Ácido (1d6 — Morte; dano contínuo 1d4/turno)', atributos:{FOR:12,AGI:4,INT:2,PRE:4,VIG:14}, habs:['<span class="sym-el sym-morte" title="Morte"></span> Fragmento de lodo consciente','Amorfo: passa por frestas de 5cm','Fraqueza ao Fogo: dano dobrado'], desc:'Pedaço de lodo do Outro Lado que desenvolveu consciência mínima. Mais nojento que perigoso.' },
  { id:'explorador-espacial', nome:'Explorador Espacial', tipo:'outro-lado', ameaca:'Alto', pv:'55', def:'16', atq:'Raio Gravitacional (3d6 — Energia; empurra 6m)', atributos:{FOR:16,AGI:14,INT:20,PRE:12,VIG:18}, habs:['<span class="sym-el sym-energia" title="Energia"></span> Entidade vinda do espaço','Adaptado ao Vácuo: imune a frio e pressão extrema','Tecnologia Orgânica: usa equipamentos orgânicos'], desc:'Entidade que veio do espaço sideral através de uma fenda paranormal. Não compreende a lógica terrena.' }
];
function renderElementos(){
  const g = document.getElementById('elementos-grid');
  if(!g) return;
  g.innerHTML = ELEMENTOS.map(el=>`
    <div onclick="verElemento('${el.id}')" style="background:rgba(10,0,8,0.9);border:1px solid ${el.cor};padding:16px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${el.cor};opacity:.7"></div>
      <div class="sym-el ${el.id==='sangue'?'sym-sangue':el.id==='morte'?'sym-morte':el.id==='energia'?'sym-energia':el.id==='conhecimento'?'sym-conhecimento':'sym-medo'}" style="display:block;width:100%;height:110px;background-size:contain;background-position:center;opacity:0.75;margin-bottom:10px"></div>
      <div style="font-family:'Cinzel',serif;font-size:13px;letter-spacing:.12em;color:${el.cor};text-transform:uppercase;margin-bottom:6px">${el.nome}</div>
      <div style="font-size:12px;color:var(--white-dust);line-height:1.6;font-family:'Courier Prime',monospace">${el.desc.substring(0,80)}…</div>
      <div style="margin-top:10px;font-size:10px;letter-spacing:.1em;color:var(--white-dust);font-family:'Oswald',sans-serif">VER DETALHES →</div>
    </div>`).join('');
}

function verElemento(id){
  const el = ELEMENTOS.find(e=>e.id===id);
  if(!el) return;
  const p = document.getElementById('el-detail-panel');
  document.getElementById('el-detail-title').innerHTML = `<span style="color:${el.cor};display:flex;align-items:center;gap:10px"><span class="sym-el sym-elem-icon ${el.id==='sangue'?'sym-sangue':el.id==='morte'?'sym-morte':el.id==='energia'?'sym-energia':el.id==='conhecimento'?'sym-conhecimento':'sym-medo'}"></span>${el.nome}</span>`;
  document.getElementById('el-detail-body').innerHTML = `
    <p style="font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash);font-size:13px;margin-bottom:14px;line-height:1.7">${el.desc}</p>
    <div style="margin-bottom:12px">
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.15em;color:${el.cor};text-transform:uppercase;margin-bottom:8px">Efeitos Conhecidos</div>
      ${el.efeitos.map(e=>`<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--blood-deep);font-size:13px;color:var(--white-bone);font-family:'Courier Prime',monospace"><span style="color:${el.cor};flex-shrink:0">▸</span>${e}</div>`).join('')}
    </div>
    <div style="background:rgba(139,0,0,0.08);border:1px solid var(--blood-deep);padding:10px 14px;font-size:12px;font-family:'Courier Prime',monospace;color:#cc6666">
      <span style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.12em;color:var(--crimson)">CUSTO ⚠ </span>${el.custo}
    </div>`;
  p.style.display = 'block';
  p.scrollIntoView({behavior:'smooth',block:'start'});
}

let _criaturaOrdem = true; // true = ascendente, false = descendente
const AMEACA_PESO = { Baixo:1, Alto:2, Altíssimo:3, Extremo:4, Catastrófico:5 };
const corAmeaca = { Baixo:'#22aa66', Alto:'#cc8822', Altíssimo:'#cc4422', Extremo:'#aa0000', Catastrófico:'#8b0000' };

function ordenarCriaturas(filtro, ordem){
  const sel = document.getElementById('sort-criaturas');
  const campo = (sel||{}).value || 'ameaca';
  const dir = ordem !== undefined ? ordem : _criaturaOrdem;
  const f = filtro !== undefined ? filtro : ((sel||{}).dataset.filtro||'todas');
  const multi = dir ? 1 : -1;
  CRIATURAS.sort((a,b)=>{
    let va = a[campo], vb = b[campo];
    if(campo==='ameaca'){ va = AMEACA_PESO[a.ameaca]||0; vb = AMEACA_PESO[b.ameaca]||0; }
    if(campo==='pv'||campo==='def'){ va = parseInt(a[campo])||0; vb = parseInt(b[campo])||0; }
    if(va < vb) return -1 * multi;
    if(va > vb) return 1 * multi;
    return 0;
  });
  renderCriaturas(f);
}

function toggleOrdemCriaturas(){
  _criaturaOrdem = !_criaturaOrdem;
  const btn = document.getElementById('btn-ordem');
  if(btn) btn.textContent = _criaturaOrdem ? '⬆ Ameaça' : '⬇ Ameaça';
  ordenarCriaturas();
}

function renderCriaturas(filtro='todas'){
  const g = document.getElementById('criaturas-grid');
  if(!g) return;
  const sel = document.getElementById('sort-criaturas');
  if(sel) sel.dataset.filtro = filtro;
  const lista = filtro==='todas' ? CRIATURAS : CRIATURAS.filter(c=>c.tipo===filtro);
  g.innerHTML = lista.map(cr=>`
    <div onclick="verCriatura('${cr.id}')" style="background:rgba(10,0,8,0.9);border:1px solid var(--blood-deep);padding:14px;cursor:pointer;transition:border-color .2s;position:relative" onmouseover="this.style.borderColor='var(--crimson)'" onmouseout="this.style.borderColor='var(--blood-deep)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="font-family:'Cinzel',serif;font-size:12px;letter-spacing:.08em;color:var(--white-bone)">${cr.nome}</div>
        <span style="font-size:10px;letter-spacing:.08em;padding:2px 8px;border:1px solid ${corAmeaca[cr.ameaca]||'#888'};color:${corAmeaca[cr.ameaca]||'#888'};font-family:'Oswald',sans-serif;white-space:nowrap">${cr.ameaca}</span>
      </div>
      <div style="display:flex;gap:14px;font-size:11px;font-family:'Courier Prime',monospace;color:var(--white-dust)">
        <span>PV <b style="color:var(--crimson-mid)">${cr.pv}</b></span>
        <span>DEF <b style="color:var(--white-ash)">${cr.def}</b></span>
      </div>
      <div style="margin-top:8px;font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace;line-height:1.5">${cr.desc.substring(0,70)}…</div>
    </div>`).join('');
}

function verCriatura(id){
  const cr = CRIATURAS.find(c=>c.id===id);
  if(!cr) return;
  const corAmeaca = {Baixo:'#22aa66',Alto:'#cc8822',Altíssimo:'#cc4422',Extremo:'#aa0000',Catastrófico:'#8b0000'};
  const cor = corAmeaca[cr.ameaca]||'#888';
  document.getElementById('cr-detail-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
      <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.06em;color:var(--white-dim)">${cr.nome}</div>
      <span style="font-size:11px;padding:3px 10px;border:1px solid ${cor};color:${cor};font-family:'Oswald',sans-serif">Ameaça ${cr.ameaca}</span>
    </div>
    <p style="font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash);font-size:13px;margin-bottom:16px;line-height:1.7">${cr.desc}</p>
    <div class="three-col" style="margin-bottom:14px">
      ${Object.entries(cr.atributos).map(([k,v])=>`<div style="background:rgba(15,0,12,0.9);border:1px solid var(--blood-deep);padding:10px;text-align:center"><div style="font-size:9px;letter-spacing:.15em;color:var(--white-dust);font-family:'Cinzel',serif">${k}</div><div style="font-size:22px;font-family:'Cinzel Decorative',serif;color:var(--white-bone)">${v}</div></div>`).join('')}
    </div>
    <div style="margin-bottom:12px"><div style="font-size:10px;letter-spacing:.15em;color:var(--crimson);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:6px">Ataque</div><div style="font-family:'Courier Prime',monospace;font-size:13px;color:var(--white-bone)">${cr.atq}</div></div>
    <div><div style="font-size:10px;letter-spacing:.15em;color:var(--crimson);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:8px">Habilidades</div>
    ${cr.habs.map(h=>`<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--blood-deep);font-size:13px;color:var(--white-bone);font-family:'Courier Prime',monospace"><span style="color:var(--crimson-mid);flex-shrink:0">⛧</span>${h}</div>`).join('')}</div>`;
  document.getElementById('cr-detail-panel').style.display = 'block';
  document.getElementById('criaturas-grid').parentElement.scrollIntoView({behavior:'smooth'});
}

function filtrarCriaturas(tipo){
  ['todas','basica','outro-lado'].forEach(t=>{
    const b = document.getElementById('fil-'+t);
    if(b) b.style.background = t===tipo ? 'rgba(139,0,0,0.2)' : 'transparent';
  });
  _criaturaOrdem = true;
  const btn = document.getElementById('btn-ordem');
  if(btn) btn.textContent = '⬆ Ameaça';
  ordenarCriaturas(tipo);
}

// ══ RELÍQUIAS DA CALAMIDADE — PORTADORES ══
const RELIQUIAS = [
  // ── RELÍQUIA DE SANGUE ──
  {
    id:'reliquia-sangue', nome:'Relíquia de Sangue', elemento:'sangue', cor:'#cc1111',
    icone:'<span class="sym-el sym-sangue" title="Sangue"></span>',
    forma_fisica:'O Trono — coração negro de lodo em espiral, conectado por tentáculos. Transforma os arredores em um ambiente de carnificina, monstruosidades e obsessão.',
    portador_titulo:'ELE',
    portador_atual:'Juan (Henri)',
    portador_desc:'O portador é referido apenas como ELE em todos os registros da Ordo — um ser que nunca deve ser nomeado diretamente. Juan, nascido Lúcio Davo e anteriormente chamado Henri, era um órfão do Orfanato Santa Menefreda que se tornou um Escripta obcecado por Sangue. Ele fez um Pacto com ELE para se tornar Marcado e foi usado como receptáculo temporário. Após vencer o Hexatombe e aceitar seu novo começo, Juan se tornou o portador definitivo do Trono.',
    portadores_anteriores: [
      'ELE — portador original e entidade por trás da Relíquia. Referido sempre como "ELE" nos registros.',
      'Diversos receptáculos temporários — pessoas usadas como veículos antes de Juan.',
      'Juan / Henri — portador definitivo após os eventos do Hexatombe.'
    ],
    habs:[
      'Controle de Criaturas: invoca qualquer criatura do Outro Lado que já existiu, independente de elemento.',
      'Pacto de Sangue: pode oferecer ou aceitar um "Pacto" — vínculo de dependência obsessiva com troca mútua entre ELE e o negociante.',
      'Fenda de Sangue: abertura dimensional de Sangue que drena a vitalidade dos que atravessam.',
      'Amaldiçoar Arma: imbuir qualquer arma com Sangue paranormal por uma cena.',
      'Regeneração: o portador se cura continuamente enquanto há Sangue ao redor.',
      'O Trono: quando sem portador, toma a forma física do Trono — transformando os arredores em carnificina.'
    ],
    hierarquia:'Supera o Conhecimento. Suplantada apenas pela Morte.',
    status_atual:'Juan (Henri) é o portador definitivo após o Hexatombe.'
  },

  // ── RELÍQUIA DE ENERGIA ──
  {
    id:'reliquia-energia', nome:'Relíquia de Energia', elemento:'energia', cor:'#9933cc',
    icone:'<span class="sym-el sym-energia" title="Energia"></span>',
    forma_fisica:'Quando sem portador, toma a forma de energia em constante transformação — chama infinita, raio ou luz ofuscante que muda sem parar. Atualmente contida na katana de Joui Jouki, com sigilos que significam "Anfitrião".',
    portador_titulo:'O Anfitrião',
    portador_atual:'Sem portador — contida na katana de Joui Jouki',
    portador_desc:'O portador da Relíquia de Energia é sempre chamado de Anfitrião. A Relíquia escolheu seis portadores ao longo da história, cada um com aparência e características distintas. Arnaldo Fritz foi o Anfitrião mais recente — encontrou a Relíquia em seu relógio de bolso em 2009 após uma visão da Magistrada. Após ser derrotado por Joui Jouki na batalha do Coliseu, a Relíquia migrou para a katana de Joui e está atualmente contida pela Ordo Realitas.',
    portadores_anteriores: [
      'Amphitruo (67 d.C.) — primeiro Anfitrião conhecido. Entidade psicótica guiada pelo caos puro. Orquestrou os jogos brutais do Coliseu.',
      'Aeneas — portador durante a construção do Coliseu.',
      'Liber — portador em período posterior da arena.',
      'Silenus — portador nos jogos do Coliseu.',
      'Plautus — portador nos jogos do Coliseu.',
      'Arnaldo Fritz (2009–2021) — o Anfitrião mais recente e mais conhecido. Derrotado por Joui Jouki em Calamidade.'
    ],
    habs:[
      'Imprevisibilidade Absoluta: a Relíquia muda constantemente — novas habilidades surgem a cada portador.',
      'Jogos do Caos: o portador pode impor "regras" à cena que todos os presentes são compelidos a seguir.',
      'Teletransporte de Energia: o portador se move instantaneamente entre pontos usando arcos de Energia.',
      'Transformação: o portador assume forma física completamente diferente — cores, aparência e voz mudam.',
      'Contenção de Kian: a Relíquia é uma das poucas forças capazes de conter ou destruir Kian.',
      'Migração: quando o portador morre, a Relíquia migra para o objeto ou pessoa mais próximos.'
    ],
    hierarquia:'Determina a imprevisibilidade. Nem mesmo as correntes da Realidade devem controlar tudo.',
    status_atual:'Contida na katana de Joui Jouki, armazenada pela Ordo Realitas com sigilos da Magistrada.'
  },

  // ── RELÍQUIA DE CONHECIMENTO ──
  {
    id:'reliquia-conhecimento', nome:'Relíquia de Conhecimento', elemento:'conhecimento', cor:'#c8a000',
    icone:'<span class="sym-el sym-conhecimento" title="Conhecimento"></span>',
    forma_fisica:'A Máscara do Desespero — máscara de origem desconhecida. O portador é sempre chamado de Magistrado/Magistrada. Quando sem portador, está em algum lugar bem protegido na Base da Ordo Realitas.',
    portador_titulo:'A Magistrada',
    portador_atual:'Sem portadora — armazenada na Base da Ordo Realitas',
    portador_desc:'A Máscara do Desespero existe "desde o começo" — seu primeiro portador é desconhecido. O portador é sempre chamado de Magistrado ou Magistrada. A última Magistrada era uma mulher de pele negra, cabelos trançados, longas roupas pretas e uma corda com nó de forca no pescoço. Ela foi morta por Kian no confronto final do Coliseu, contendo-o para que a Equipe Abutres pudesse agir. Celestine foi outra portadora — jovem guerreira da Ordo Calamitas de 67 d.C. que aceitou a máscara após vencer os jogos do Anfitrião.',
    portadores_anteriores: [
      'Portador original — desconhecido. A Máscara existe "desde o começo" da realidade.',
      'Celestine (67 d.C.) — guerreira da Ordo Calamitas. Aceitou a máscara de Amphitruo para manter Kian dentro das regras. Morreu contendo Kian no Coliseu.',
      'A Magistrada (2021) — última portadora conhecida. Mulher de pele negra com corda de forca. Morta por Kian no confronto final de Calamidade.'
    ],
    habs:[
      'Ocultar Memórias: o portador pode apagar ou esconder lembranças de qualquer pessoa — ou de toda a Realidade.',
      'Teletransporte das Sombras: movimento instantâneo através de zonas de escuridão.',
      'Esconder Localização: tornar-se completamente indetectável por qualquer meio paranormal.',
      'Equilíbrio da Realidade: o portador mantém o equilíbrio para que a Realidade tenha propósito.',
      'Contenção: pode conter entidades de poder extremo — incluindo Kian — ao custo da própria vida.',
      'Inexistir Lembranças: ao custo supremo, pode apagar completamente algo da memória coletiva da Realidade.'
    ],
    hierarquia:'Mantém o equilíbrio da Realidade. Supera a Energia. Suplantada pelo Sangue.',
    status_atual:'Máscara do Desespero sem portadora, armazenada em local protegido na Base da Ordo Realitas.'
  },

  // ── RELÍQUIA DE MORTE ──
  {
    id:'reliquia-morte', nome:'Relíquia de Morte', elemento:'morte', cor:'#555566',
    icone:'<span class="sym-el sym-morte" title="Morte"></span>',
    forma_fisica:'O Parasita de Dimensões — enorme coração negro de lodo em forma espiral, conectado por tentáculos. Infecta os arredores formando um vilarejo anacrônico com diversos nomes — o mais conhecido: Santo Berço.',
    portador_titulo:'O Portador da Morte',
    portador_atual:'Desconhecido — nenhum portador oficial confirmado',
    portador_desc:'O portador da Relíquia de Morte é desconhecido nos registros da Ordo. A Relíquia pode infectar um corpo com alta Exposição Paranormal, criando o Deus da Morte — entidade extremamente poderosa, dona do próprio tempo. O Parasita de Dimensões usa corpos como receptáculos temporários quando necessário. Miguel Cariad, ex-agente que se tornou O Ferreiro e líder do Santo Berço, teve seu corpo tomado pelo Parasita após ser morto pela Equipe E — criando o Deus da Morte como última linha de defesa. A Morte deve manter a cronologia da Realidade. Todas as histórias precisam de um fim.',
    portadores_anteriores: [
      'O Parasita de Dimensões — forma física da Relíquia quando sem portador. Criado como acidente paranormal a partir do medo coletivo de um símbolo incorreto.',
      'O Ferreiro / Miguel Cariad — ex-agente cujo corpo foi tomado pelo Parasita após a morte, tornando-se o Deus da Morte como defesa do Santo Berço.',
      'O Deus da Morte — entidade gerada quando o Parasita infesta um corpo de alta Exposição Paranormal. Dona do próprio tempo.'
    ],
    habs:[
      'Controle do Tempo: o Deus da Morte é dono do próprio tempo — pode congelar, reverter ou acelerar eventos locais.',
      'Santo Berço: a Relíquia cria um vilarejo anacrônico ao redor de si quando em forma de Parasita, prendendo almas no tempo.',
      'Infestação: infecta qualquer corpo com Exposição Paranormal elevada, transformando-o no Deus da Morte.',
      'Cronologia Absoluta: a Morte mantém a cronologia da Realidade — o portador pode ver e alterar o fio do tempo.',
      'Toque da Morte: mata instantaneamente qualquer ser mortal ao toque direto.',
      'Só o Símbolo Perfeito Libera: apenas um Símbolo perfeito pode controlar plenamente a Relíquia de Morte.'
    ],
    hierarquia:'A mais poderosa de todas. Suplanta todas as outras Relíquias. Todas as histórias precisam de um fim.',
    status_atual:'Portador desconhecido. O Parasita de Dimensões permanece como forma livre da Relíquia.'
  }
];

function renderReliquias(filtro='todas'){
  const g = document.getElementById('reliquias-grid');
  if(!g) return;
  const lista = filtro==='todas' ? RELIQUIAS : RELIQUIAS.filter(r=>r.elemento===filtro);
  const elCor = {sangue:'#cc1111', energia:'#9933cc', conhecimento:'#c8a000', morte:'#555566'};
  const elNome = {sangue:'<span class="sym-el sym-sangue" title="Sangue"></span> Sangue', energia:'<span class="sym-el sym-energia" title="Energia"></span> Energia', conhecimento:'<span class="sym-el sym-conhecimento" title="Conhecimento"></span> Conhecimento', morte:'<span class="sym-el sym-morte" title="Morte"></span> Morte'};
  g.innerHTML = lista.map(r=>`
    <div onclick="verReliquia('${r.id}')" style="background:rgba(10,0,8,0.95);border:1px solid ${r.cor};padding:16px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden"
      onmouseover="this.style.boxShadow='0 0 20px ${r.cor}33';this.style.borderColor='${r.cor}'"
      onmouseout="this.style.boxShadow='none';this.style.borderColor='${r.cor}'">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${r.cor},transparent);opacity:.9"></div>
      ${r.icone.includes('sym-el') ? r.icone.replace('class="sym-el ', `style="display:block;width:100%;height:90px;background-size:${r.elemento==='conhecimento'?'65%':r.elemento==='medo'?'95%':'85%'};background-repeat:no-repeat;background-position:center;mix-blend-mode:screen;filter:brightness(1.2);opacity:0.85;margin-bottom:10px;filter:drop-shadow(0 0 8px ${r.cor}88)" class="sym-el `) : `<div style="margin-bottom:10px;font-size:36px;filter:drop-shadow(0 0 8px ${r.cor}88)">${r.icone}</div>`}
      <div style="font-family:'Cinzel Decorative',serif;font-size:13px;letter-spacing:.08em;color:var(--white-dim);margin-bottom:6px">${r.nome}</div>
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;flex-wrap:wrap">
        <span style="font-size:10px;font-family:'Oswald',sans-serif;letter-spacing:.1em;padding:2px 10px;border:1px solid ${r.cor};color:${r.cor}">${elNome[r.elemento]||r.elemento}</span>
        <span style="font-size:11px;font-family:'Cinzel',serif;letter-spacing:.05em;color:var(--gold-light)">⛧ ${r.portador_titulo}</span>
      </div>
      <div style="font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace;line-height:1.5;border-left:2px solid ${r.cor}55;padding-left:8px">${r.forma_fisica.substring(0,90)}…</div>
      <div style="margin-top:12px;font-size:10px;letter-spacing:.12em;color:${r.cor};font-family:'Oswald',sans-serif">VER PORTADORES →</div>
    </div>`).join('');
}

function verReliquia(id){
  const r = RELIQUIAS.find(x=>x.id===id);
  if(!r) return;
  document.getElementById('rel-detail-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="margin-bottom:4px;filter:drop-shadow(0 0 12px ${r.cor}aa)">${r.icone.includes('sym-el') ? r.icone.replace('class="sym-el ','style="display:inline-block;width:72px;height:72px;background-size:contain;background-repeat:no-repeat;background-position:center;mix-blend-mode:screen;filter:brightness(1.3)" class="sym-el ') : r.icone}</div>
        <div style="font-family:'Cinzel Decorative',serif;font-size:18px;letter-spacing:.06em;color:var(--white-dim)">${r.nome}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;letter-spacing:.15em;color:var(--white-dust);font-family:'Oswald',sans-serif;margin-bottom:4px">PORTADOR</div>
        <div style="font-family:'Cinzel',serif;font-size:15px;color:${r.cor};letter-spacing:.06em">${r.portador_titulo}</div>
        <div style="font-size:11px;font-family:'Courier Prime',monospace;color:var(--white-ash);margin-top:2px">${r.portador_atual}</div>
      </div>
    </div>

    <div style="background:rgba(10,0,8,0.8);border:1px solid ${r.cor}44;border-left:3px solid ${r.cor};padding:12px 16px;margin-bottom:16px">
      <div style="font-size:9px;letter-spacing:.18em;color:${r.cor};font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:8px">⛧ Forma Física</div>
      <div style="font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash);font-size:13px;line-height:1.7">${r.forma_fisica}</div>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:9px;letter-spacing:.18em;color:${r.cor};font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:10px">⛧ Sobre o Portador</div>
      <div style="font-family:'Courier Prime',monospace;font-size:13px;color:var(--white-bone);line-height:1.7">${r.portador_desc}</div>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:9px;letter-spacing:.18em;color:${r.cor};font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:10px">⛧ Portadores Conhecidos</div>
      ${r.portadores_anteriores.map(p=>`<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--blood-deep);font-size:12px;color:var(--white-bone);font-family:'Courier Prime',monospace;line-height:1.6"><span style="color:${r.cor};flex-shrink:0">▸</span>${p}</div>`).join('')}
    </div>

    <div style="margin-bottom:14px">
      <div style="font-size:9px;letter-spacing:.18em;color:${r.cor};font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:10px">⛧ Habilidades do Portador</div>
      ${r.habs.map(h=>`<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--blood-deep);font-size:13px;color:var(--white-bone);font-family:'Courier Prime',monospace;line-height:1.6"><span style="color:${r.cor};flex-shrink:0">⛧</span>${h}</div>`).join('')}
    </div>

    <div style="background:rgba(${r.elemento==='morte'?'30,0,40':'10,0,8'},0.9);border:1px solid ${r.cor}66;padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <div style="font-size:9px;letter-spacing:.15em;color:var(--gold-light);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:5px">Hierarquia</div>
        <div style="font-family:'Courier Prime',monospace;font-size:12px;color:var(--white-bone);line-height:1.5">${r.hierarquia}</div>
      </div>
      <div>
        <div style="font-size:9px;letter-spacing:.15em;color:var(--gold-light);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:5px">Status Atual</div>
        <div style="font-family:'Courier Prime',monospace;font-size:12px;color:var(--white-ash);line-height:1.5">${r.status_atual}</div>
      </div>
    </div>`;
  document.getElementById('rel-detail-panel').style.display = 'block';
  document.getElementById('reliquias-grid').parentElement.scrollIntoView({behavior:'smooth'});
}

function filtrarReliquias(tipo){
  ['todas','sangue','energia','conhecimento','morte'].forEach(t=>{
    const b = document.getElementById('rfil-'+t);
    if(b) b.style.background = t===tipo ? 'rgba(139,0,0,0.2)' : 'transparent';
  });
  renderReliquias(tipo);
}
// Sub-abas dentro de Criaturas
function showSubTab(sub){
  // Atualiza botões
  ['criaturas','reliquias'].forEach(s=>{
    const btn = document.getElementById('subtab-btn-'+s);
    const panel = document.getElementById('subtab-'+s);
    if(!btn || !panel) return;
    const active = s === sub;
    btn.style.background = active ? 'rgba(139,0,0,0.15)' : 'transparent';
    btn.style.borderBottomColor = active ? 'var(--crimson)' : 'transparent';
    btn.style.color = active ? 'var(--crimson-mid)' : 'var(--white-dust)';
    panel.style.display = active ? '' : 'none';
  });
  // Renderiza conteúdo
  if(sub==='criaturas'){ ordenarCriaturas(); document.getElementById('cr-detail-panel').style.display='none'; }
  if(sub==='reliquias'){ renderReliquias(); document.getElementById('rel-detail-panel').style.display='none'; }
}

/* ══════════════════════════════════════════════
   FICHAS DE NPC — Mestre
══════════════════════════════════════════════ */
let _nfInv = [];
let _nfRit = [];

function nfAddInv(){
  const n=(document.getElementById('nf-inv-inp')?.value||'').trim(); if(!n) return;
  const q=parseInt(document.getElementById('nf-inv-qtd')?.value)||1;
  _nfInv.push({nome:n,qtd:q});
  document.getElementById('nf-inv-inp').value='';
  document.getElementById('nf-inv-qtd').value='1';
  _nfRenderInv();
}
function _nfRenderInv(){
  const el=document.getElementById('nf-inv-lista'); if(!el) return;
  if(!_nfInv.length){ el.innerHTML='<div style="font-size:11px;color:var(--white-dust);font-family:\'Courier Prime\',monospace">Nenhum item.</div>'; return; }
  el.innerHTML='';
  _nfInv.forEach((it,i)=>{
    const d=document.createElement('div');
    d.style.cssText='display:flex;align-items:center;gap:6px;font-size:12px;font-family:\'Courier Prime\',monospace;color:var(--white-ash);background:rgba(20,0,15,.4);padding:4px 8px';
    d.innerHTML='<span style="flex:1">'+it.nome+(it.qtd>1?' <span style="color:var(--crimson);font-size:11px">x'+it.qtd+'</span>':'')+'</span>'
      +'<button onclick="_nfInv.splice('+i+',1);_nfRenderInv()" style="background:transparent;border:none;color:#cc4444;cursor:pointer;font-size:13px;line-height:1">x</button>';
    el.appendChild(d);
  });
}

function nfAddRit(){
  const n=(document.getElementById('nf-rit-inp')?.value||'').trim(); if(!n) return;
  const elem=document.getElementById('nf-rit-elem')?.value||'';
  const circ=document.getElementById('nf-rit-circ')?.value||'';
  _nfRit.push({nome:n,elem,circ});
  document.getElementById('nf-rit-inp').value='';
  document.getElementById('nf-rit-elem').value='';
  document.getElementById('nf-rit-circ').value='';
  _nfRenderRit();
}
function _nfRenderRit(){
  const el=document.getElementById('nf-rit-lista'); if(!el) return;
  if(!_nfRit.length){ el.innerHTML='<div style="font-size:11px;color:var(--white-dust);font-family:\'Courier Prime\',monospace">Nenhum ritual.</div>'; return; }
  el.innerHTML='';
  _nfRit.forEach((r,i)=>{
    const d=document.createElement('div');
    d.style.cssText='display:flex;align-items:center;gap:6px;font-size:12px;font-family:\'Courier Prime\',monospace;color:var(--white-ash);background:rgba(20,0,15,.4);padding:4px 8px';
    d.innerHTML='<span style="flex:1">'+r.nome+(r.elem?' <span style="color:var(--crimson-mid);font-size:10px">'+r.elem+'</span>':'')+(r.circ?' <span style="color:var(--gold-light);font-size:10px">'+r.circ+'°</span>':'')+'</span>'
      +'<button onclick="_nfRit.splice('+i+',1);_nfRenderRit()" style="background:transparent;border:none;color:#cc4444;cursor:pointer;font-size:13px;line-height:1">x</button>';
    el.appendChild(d);
  });
}

let _npcFichas = [];
let _nfAtaques = [];
let _nfEditId  = null;
let _nfViewId  = null;

const NPC_TIPO_LABEL = {npc:'NPC Humano',criatura:'Criatura',chefe:'Chefe / Boss',aliado:'Aliado',neutro:'Neutro'};
const NPC_TIPO_COR   = {npc:'var(--white-ash)',criatura:'var(--crimson-mid)',chefe:'var(--gold-light)',aliado:'#22cc66',neutro:'var(--white-dust)'};

function _loadNpcFichas(){
  if(!db.mestre) db.mestre={};
  _npcFichas = db.mestre.npcFichas || [];
}

function _saveNpcFichas(){
  if(!db.mestre) db.mestre={};
  db.mestre.npcFichas = _npcFichas;
  saveDB();
}

function npcFichaNew(){
  _nfEditId = null;
  _nfAtaques = [];
  _nfInv = [];
  _nfRit = [];
  document.getElementById('nfid').value = '';
  ['nome','nex','desl','fort','ref','vont','habs','desc','origem','trilha'].forEach(f=>{ const el=document.getElementById('nf-'+f); if(el) el.value=''; });
  ['agi','for','int','pre','vig'].forEach(f=>{ const el=document.getElementById('nf-'+f); if(el) el.value='0'; });
  document.getElementById('nf-pv').value='20';
  document.getElementById('nf-pe').value='0';
  document.getElementById('nf-def').value='10';
  document.getElementById('nf-tipo').value='npc';
  document.getElementById('npc-ficha-form-title').textContent='Nova Ficha de NPC';
  _nfRenderAtaques();
  _nfRenderInv();
  _nfRenderRit();
  document.getElementById('npc-ficha-view').style.display='none';
  document.getElementById('npc-ficha-form').style.display='block';
  document.getElementById('npc-ficha-form').scrollIntoView({behavior:'smooth',block:'start'});
}

function npcFichaCancel(){
  document.getElementById('npc-ficha-form').style.display='none';
  _nfEditId=null; _nfAtaques=[]; _nfInv=[]; _nfRit=[];
}

function nfAddAtaque(){
  _nfAtaques.push({nome:'',bonus:'',dano:'',tipo:''});
  _nfRenderAtaques();
}

function _nfRenderAtaques(){
  const el=document.getElementById('nf-ataques-lista'); if(!el) return;
  if(!_nfAtaques.length){ el.innerHTML='<div style="font-size:11px;color:var(--white-dust);font-family:\'Courier Prime\',monospace;padding:4px 0">Nenhum ataque. Clique em "+ Adicionar Ataque".</div>'; return; }
  el.innerHTML='';
  _nfAtaques.forEach((at,i)=>{
    const row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:6px;align-items:center';
    row.innerHTML=`
      <input value="${at.nome||''}" placeholder="Nome do ataque" oninput="_nfAtaques[${i}].nome=this.value"
        style="background:rgba(20,0,15,.8);border:1px solid var(--blood-deep);color:var(--white-bone);font-family:'Courier Prime',monospace;font-size:11px;padding:5px 7px;outline:none">
      <input value="${at.bonus||''}" placeholder="+bonus" oninput="_nfAtaques[${i}].bonus=this.value"
        style="background:rgba(20,0,15,.8);border:1px solid var(--blood-deep);color:var(--white-bone);font-family:'Courier Prime',monospace;font-size:11px;padding:5px 7px;outline:none">
      <input value="${at.dano||''}" placeholder="dano" oninput="_nfAtaques[${i}].dano=this.value"
        style="background:rgba(20,0,15,.8);border:1px solid var(--blood-deep);color:var(--white-bone);font-family:'Courier Prime',monospace;font-size:11px;padding:5px 7px;outline:none">
      <input value="${at.tipo||''}" placeholder="tipo" oninput="_nfAtaques[${i}].tipo=this.value"
        style="background:rgba(20,0,15,.8);border:1px solid var(--blood-deep);color:var(--white-bone);font-family:'Courier Prime',monospace;font-size:11px;padding:5px 7px;outline:none">
      <button onclick="_nfAtaques.splice(${i},1);_nfRenderAtaques()" style="background:transparent;border:none;color:#cc4444;cursor:pointer;font-size:15px;line-height:1;padding:2px 4px">x</button>
    `;
    el.appendChild(row);
  });
}

function npcFichaSave(){
  const nome=(document.getElementById('nf-nome')?.value||'').trim();
  if(!nome){ toast('Escreva o nome do NPC.'); return; }
  const ficha = {
    id: _nfEditId || ('nf_'+Date.now()),
    nome,
    tipo: document.getElementById('nf-tipo')?.value||'npc',
    nex:  document.getElementById('nf-nex')?.value||'',
    desl: document.getElementById('nf-desl')?.value||'',
    origem: document.getElementById('nf-origem')?.value||'',
    trilha: document.getElementById('nf-trilha')?.value||'',
    atrs: {
      agi: parseInt(document.getElementById('nf-agi')?.value)||0,
      for: parseInt(document.getElementById('nf-for')?.value)||0,
      int: parseInt(document.getElementById('nf-int')?.value)||0,
      pre: parseInt(document.getElementById('nf-pre')?.value)||0,
      vig: parseInt(document.getElementById('nf-vig')?.value)||0,
    },
    pv:   parseInt(document.getElementById('nf-pv')?.value)||20,
    pvAtual: _nfEditId ? ((_npcFichas.find(f=>f.id===_nfEditId)?.pvAtual != null) ? _npcFichas.find(f=>f.id===_nfEditId).pvAtual : (parseInt(document.getElementById('nf-pv')?.value)||20)) : (parseInt(document.getElementById('nf-pv')?.value)||20),
    pe:   parseInt(document.getElementById('nf-pe')?.value)||0,
    def:  parseInt(document.getElementById('nf-def')?.value)||10,
    fort: document.getElementById('nf-fort')?.value||'',
    ref:  document.getElementById('nf-ref')?.value||'',
    vont: document.getElementById('nf-vont')?.value||'',
    ataques: _nfAtaques.filter(a=>a.nome),
    inv: _nfInv.filter(i=>i.nome),
    rituais: _nfRit.filter(r=>r.nome),
    habs: document.getElementById('nf-habs')?.value||'',
    desc: document.getElementById('nf-desc')?.value||'',
  };
  if(_nfEditId){
    const idx=_npcFichas.findIndex(f=>f.id===_nfEditId);
    if(idx>=0) _npcFichas[idx]=ficha;
  } else {
    _npcFichas.push(ficha);
  }
  _saveNpcFichas();
  npcFichaCancel();
  _renderNpcFichasLista();
  toast('"'+nome+'" salva!');
}

function npcFichaEdit(){
  if(_nfViewId===null) return;
  const ficha=_npcFichas.find(f=>f.id===_nfViewId); if(!ficha) return;
  _nfEditId=ficha.id;
  _nfAtaques=(ficha.ataques||[]).map(a=>({...a}));
  _nfInv=(ficha.inv||[]).map(i=>({...i}));
  _nfRit=(ficha.rituais||[]).map(r=>({...r}));
  document.getElementById('nfid').value=ficha.id;
  document.getElementById('nf-nome').value=ficha.nome||'';
  document.getElementById('nf-tipo').value=ficha.tipo||'npc';
  document.getElementById('nf-nex').value=ficha.nex||'';
  document.getElementById('nf-desl').value=ficha.desl||'';
  document.getElementById('nf-origem').value=ficha.origem||'';
  document.getElementById('nf-trilha').value=ficha.trilha||'';
  ['agi','for','int','pre','vig'].forEach(a=>{ const el=document.getElementById('nf-'+a); if(el) el.value=ficha.atrs?.[a]??0; });
  document.getElementById('nf-pv').value=ficha.pv||20;
  document.getElementById('nf-pe').value=ficha.pe||0;
  document.getElementById('nf-def').value=ficha.def||10;
  document.getElementById('nf-fort').value=ficha.fort||'';
  document.getElementById('nf-ref').value=ficha.ref||'';
  document.getElementById('nf-vont').value=ficha.vont||'';
  document.getElementById('nf-habs').value=ficha.habs||'';
  document.getElementById('nf-desc').value=ficha.desc||'';
  document.getElementById('npc-ficha-form-title').textContent='Editar Ficha '+ficha.nome;
  _nfRenderAtaques();
  _nfRenderInv();
  _nfRenderRit();
  document.getElementById('npc-ficha-view').style.display='none';
  document.getElementById('npc-ficha-form').style.display='block';
  document.getElementById('npc-ficha-form').scrollIntoView({behavior:'smooth',block:'start'});
}

function npcFichaView(id){
  const ficha=_npcFichas.find(f=>f.id===id); if(!ficha) return;
  _nfViewId=id;
  document.getElementById('nfv-nome').textContent=ficha.nome;
  const cor=NPC_TIPO_COR[ficha.tipo]||'var(--white-ash)';
  document.getElementById('nfv-tipo').innerHTML='<span style="color:'+cor+'">'+(NPC_TIPO_LABEL[ficha.tipo]||ficha.tipo)+'</span>'+(ficha.nex?' <span style="color:var(--gold-light)">'+ficha.nex+'</span>':'')+(ficha.desl?' DesL: '+ficha.desl:'');
  const a=ficha.atrs||{};  const pvPct=Math.max(0,Math.min(1,(ficha.pvAtual!=null?ficha.pvAtual:ficha.pv)/ficha.pv));
  const pvCol=pvPct>0.5?'#22aa55':pvPct>0.25?'#cc8822':'#cc2222';
  let html='<div style="margin-bottom:12px"><div style="font-size:10px;color:var(--crimson);letter-spacing:.1em;font-family:\'Oswald\',sans-serif;text-transform:uppercase;margin-bottom:5px">PV</div><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:rgba(30,0,20,.6);border:1px solid var(--blood-deep)"><div class="pv-bar-inner" style="height:100%;width:'+(pvPct*100)+'%;background:'+pvCol+';transition:width .3s"></div></div><div style="display:flex;align-items:center;gap:4px"><input type="number" value="'+(ficha.pvAtual!=null?ficha.pvAtual:ficha.pv)+'" min="0" max="'+ficha.pv+'" onchange="nfUpdatePv(\''+ficha.id+'\',this.value)" style="width:50px;background:rgba(20,0,15,.8);border:1px solid var(--blood-deep);color:'+pvCol+';font-family:\'Courier Prime\',monospace;font-size:13px;padding:3px 6px;outline:none;text-align:center"><span style="color:var(--white-dust);font-size:12px">/ '+ficha.pv+'</span></div></div></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;text-align:center">';
  ['agi','for','int','pre','vig'].forEach(attr=>{
    const v=a[attr]??0; const s=v>=0?'+'+v:v;
    html+='<div style="background:rgba(20,0,15,.5);border:1px solid var(--blood-deep);padding:6px 4px"><div style="font-size:9px;color:var(--crimson);font-family:\'Oswald\',sans-serif;letter-spacing:.1em;text-transform:uppercase">'+attr.toUpperCase()+'</div><div style="font-size:18px;color:var(--white-dim);font-family:\'Cinzel\',serif">'+s+'</div></div>';
  });
  html+='</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;font-size:12px;font-family:\'Courier Prime\',monospace">';
  [['DEF',ficha.def],['Fort',ficha.fort||'—'],['Ref',ficha.ref||'—'],['Vont',ficha.vont||'—']].forEach(([lbl,val])=>{
    html+='<div style="border:1px solid var(--blood-deep);padding:6px;text-align:center"><div style="font-size:9px;color:var(--crimson);font-family:\'Oswald\',sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px">'+lbl+'</div><b style="color:var(--white-dim)">'+val+'</b></div>';
  });
  html+='</div>';
  if(ficha.ataques&&ficha.ataques.length){
    html+='<div style="font-size:10px;color:var(--crimson);letter-spacing:.1em;font-family:\'Oswald\',sans-serif;text-transform:uppercase;margin-bottom:6px">Ataques</div><div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">';
    ficha.ataques.forEach(at=>{
      html+='<div style="display:flex;align-items:center;gap:8px;font-size:12px;font-family:\'Courier Prime\',monospace;background:rgba(20,0,15,.4);padding:6px 10px;border-left:2px solid var(--crimson)"><span style="color:var(--white-dim);flex:1">'+at.nome+'</span>'+(at.bonus?'<span style="color:var(--gold-light)">'+at.bonus+'</span>':'')+(at.dano?'<span style="color:var(--crimson-mid)">'+at.dano+'</span>':'')+(at.tipo?'<span style="color:var(--white-dust)">'+at.tipo+'</span>':'')+'</div>';
    });
    html+='</div>';
  }
  if(ficha.habs&&ficha.habs.trim()){
    html+='<div style="font-size:10px;color:var(--crimson);letter-spacing:.1em;font-family:\'Oswald\',sans-serif;text-transform:uppercase;margin-bottom:5px">Habilidades</div><div style="font-size:12px;color:var(--white-ash);line-height:1.7;white-space:pre-line;margin-bottom:12px;padding:8px 10px;background:rgba(20,0,15,.4);border-left:2px solid rgba(138,106,0,.4)">'+ficha.habs+'</div>';
  }
  if(ficha.desc&&ficha.desc.trim()){
    html+='<div style="font-size:10px;color:var(--crimson);letter-spacing:.1em;font-family:\'Oswald\',sans-serif;text-transform:uppercase;margin-bottom:5px">Notas do Mestre</div><div style="font-size:12px;color:var(--white-dust);line-height:1.7;white-space:pre-line;padding:8px 10px;background:rgba(20,0,15,.4);border-left:2px solid var(--blood-deep);font-family:\'Courier Prime\',monospace">'+ficha.desc+'</div>';
  }
  // Origem & Trilha
  if((ficha.origem&&ficha.origem.trim())||(ficha.trilha&&ficha.trilha.trim())){
    html+='<div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">';
    if(ficha.origem) html+='<div style="flex:1;min-width:120px"><div style="font-size:9px;color:var(--crimson);font-family:\'Oswald\',sans-serif;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px">Origem</div><div style="font-size:12px;color:var(--white-ash);font-family:\'Courier Prime\',monospace">'+ficha.origem+'</div></div>';
    if(ficha.trilha) html+='<div style="flex:1;min-width:120px"><div style="font-size:9px;color:var(--crimson);font-family:\'Oswald\',sans-serif;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px">Trilha</div><div style="font-size:12px;color:var(--white-ash);font-family:\'Courier Prime\',monospace">'+ficha.trilha+'</div></div>';
    html+='</div>';
  }
  // Inventário
  if(ficha.inv&&ficha.inv.length){
    html+='<div style="font-size:10px;color:var(--crimson);letter-spacing:.1em;font-family:\'Oswald\',sans-serif;text-transform:uppercase;margin-bottom:5px;margin-top:12px">Inventário</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">';
    ficha.inv.forEach(it=>{
      html+='<span style="font-size:11px;font-family:\'Courier Prime\',monospace;color:var(--white-ash);background:rgba(20,0,15,.6);border:1px solid var(--blood-deep);padding:3px 8px">'+it.nome+(it.qtd>1?' x'+it.qtd:'')+'</span>';
    });
    html+='</div>';
  }
  // Rituais
  if(ficha.rituais&&ficha.rituais.length){
    html+='<div style="font-size:10px;color:var(--crimson);letter-spacing:.1em;font-family:\'Oswald\',sans-serif;text-transform:uppercase;margin-bottom:5px;margin-top:6px">Rituais Conhecidos</div><div style="display:flex;flex-wrap:wrap;gap:5px">';
    ficha.rituais.forEach(r=>{
      html+='<span style="font-size:11px;font-family:\'Courier Prime\',monospace;color:var(--crimson-mid);background:rgba(20,0,15,.6);border:1px solid rgba(139,0,0,.4);padding:3px 8px">'+r.nome+(r.elem?' <span style="color:var(--white-dust)">'+r.elem+'</span>':'')+(r.circ?' <span style="color:var(--gold-light)">'+r.circ+'°</span>':'')+'</span>';
    });
    html+='</div>';
  }
  document.getElementById('nfv-body').innerHTML=html;
  document.getElementById('npc-ficha-form').style.display='none';
  document.getElementById('npc-ficha-view').style.display='block';
  document.getElementById('npc-ficha-view').scrollIntoView({behavior:'smooth',block:'start'});
}

function nfUpdatePv(id, val){
  const ficha=_npcFichas.find(f=>f.id===id); if(!ficha) return;
  ficha.pvAtual=Math.max(0,Math.min(ficha.pv,parseInt(val)||0));
  _saveNpcFichas();
  _renderNpcFichasLista();
}

function npcFichaDelete(id){
  const ficha=_npcFichas.find(f=>f.id===id); if(!ficha) return;
  if(!confirm('Apagar ficha de "'+ficha.nome+'"?')) return;
  _npcFichas=_npcFichas.filter(f=>f.id!==id);
  _saveNpcFichas();
  _renderNpcFichasLista();
  if(_nfViewId===id){ document.getElementById('npc-ficha-view').style.display='none'; _nfViewId=null; }
  toast('Ficha apagada.');
}

function _renderNpcFichasLista(){
  const el=document.getElementById('npc-fichas-lista'); if(!el) return;
  if(!_npcFichas.length){
    el.innerHTML='<div style="font-size:12px;color:var(--white-dust);font-family:\'Courier Prime\',monospace;padding:6px 0">Nenhuma ficha criada. Clique em "+ Nova Ficha".</div>';
    return;
  }
  el.innerHTML='';
  _npcFichas.forEach(ficha=>{
    const pvPct=Math.max(0,Math.min(1,(ficha.pvAtual!=null?ficha.pvAtual:ficha.pv)/ficha.pv));
    const pvCol=pvPct>0.5?'#22aa55':pvPct>0.25?'#cc8822':'#cc2222';
    const cor=NPC_TIPO_COR[ficha.tipo]||'var(--white-ash)';
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:10px;background:rgba(10,0,8,.7);border:1px solid rgba(58,0,0,.5);padding:8px 12px;cursor:pointer;transition:border-color .15s';
    row.onmouseenter=()=>row.style.borderColor='rgba(138,106,0,.4)';
    row.onmouseleave=()=>row.style.borderColor='rgba(58,0,0,.5)';
    const pvAtu=ficha.pvAtual!=null?ficha.pvAtual:ficha.pv;
    row.innerHTML='<div style="flex:1;min-width:0" onclick="npcFichaView(\''+ficha.id+'\')">'
      +'<div style="font-family:\'Cinzel\',serif;font-size:13px;color:var(--white-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ficha.nome+'</div>'
      +'<div style="font-size:10px;color:'+cor+';font-family:\'Oswald\',sans-serif;letter-spacing:.08em;margin-top:1px">'+(NPC_TIPO_LABEL[ficha.tipo]||ficha.tipo)+(ficha.nex?' · '+ficha.nex:'')+'</div>'
      +'</div>'
      +'<div style="flex-shrink:0;text-align:right">'
      +'<div style="font-size:11px;font-family:\'Courier Prime\',monospace;color:'+pvCol+';white-space:nowrap">'+pvAtu+' / '+ficha.pv+' PV</div>'
      +'<div style="width:70px;height:5px;background:rgba(30,0,20,.6);border:1px solid var(--blood-deep);margin-top:3px"><div style="height:100%;width:'+(pvPct*100)+'%;background:'+pvCol+'"></div></div>'
      +'</div>'
      +'<button onclick="event.stopPropagation();npcFichaDelete(\''+ficha.id+'\')" style="background:transparent;border:none;color:#cc4444;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;flex-shrink:0;opacity:.6" onmouseenter="this.style.opacity=\'1\'" onmouseleave="this.style.opacity=\'.6\'">x</button>';
    el.appendChild(row);
  });
}

function _renderNpcGrid(){
  const el=document.getElementById('npc-grid'); if(!el) return;
  if(!_npcList.length){ el.innerHTML='<div style="color:var(--white-dust);font-size:11px;font-family:\'Courier Prime\',monospace;padding:8px 0;grid-column:1/-1">Nenhum token. Crie um acima.</div>'; return; }
  el.innerHTML='';
  _npcList.forEach((tok,i)=>{
    const card=document.createElement('div'); card.className='npc-card'+(i===_npcSel?' sel':'');
    card.onclick=()=>{ _npcSel=i; _renderNpcGrid(); };
    card.ondblclick=()=>_npcPlace(tok);
    const cv=document.createElement('canvas'); cv.width=cv.height=56; cv.className='';
    cv.style.cssText='border-radius:50%;border:2px solid '+tok.ring+';display:block;margin:0 auto 4px';
    card.appendChild(cv);
    const lbl=document.createElement('div'); lbl.className='npc-lbl'; lbl.textContent=tok.nome; card.appendChild(lbl);
    const tp=document.createElement('div'); tp.className='npc-type';
    tp.textContent={npc:'NPC',criatura:'Criatura',chefe:'Boss',aliado:'Aliado',neutro:'Neutro'}[tok.tipo]||tok.tipo;
    card.appendChild(tp);
    const del=document.createElement('button'); del.className='npc-del'; del.textContent='×';
    del.onclick=e=>{ e.stopPropagation(); _npcList.splice(i,1); if(_npcSel===i)_npcSel=null; else if(_npcSel>i)_npcSel--; _saveNpcList(); _renderNpcGrid(); };
    card.appendChild(del);
    el.appendChild(card);
    // Renderiza o mini token
    if(tok.imgUrl){ const img=new Image(); img.onload=()=>_drawNpcTok(cv,56,tok.ring,img,tok.icon,tok.nome); img.src=tok.imgUrl; }
    else _drawNpcTok(cv,56,tok.ring,null,tok.icon,tok.nome);
  });
}
/* ══════════════════════════════════════════════════════════════
   MULTIPLAYER — CHAT, ROLAGENS PÚBLICAS, PEDIDO DE ROLAGEM, INICIATIVA
══════════════════════════════════════════════════════════════ */

// ── Estado global multiplayer ──
let _chatMsgs = [];
let _publicRolls = [];
let _initData = { combatants:[], round:1, currentIdx:0, active:false };

// ── Cores por usuário para o chat ──
const _chatColors = ['#5b9cf6','#22cc88','#ff9944','#cc88ff','#ff6699','#44ddcc','#ffcc44','#88ccff'];
const _userColorMap = {};
function _userColor(user){
  if(!_userColorMap[user]){
    const keys = Object.keys(_userColorMap);
    _userColorMap[user] = _chatColors[keys.length % _chatColors.length];
  }
  return _userColorMap[user];
}

/* ─────────────────────────────────────────────
   CHAT EM TEMPO REAL
───────────────────────────────────────────── */
let _lastChatTs = 0;
function sendChat(){
  const inp = document.getElementById('chat-inp');
  if(!inp) return;
  const text = inp.value.trim();
  if(!text) return;
  if(!window.fbChatSend){ toast('Chat requer Supabase. Configure no botão ⚙ Supabase.'); return; }
  // Anti-spam: evita duplicatas em menos de 500ms
  const now = Date.now();
  if(now - _lastChatTs < 500) return;
  _lastChatTs = now;
  const msg = {
    user: currentUser,
    isMestre,
    text,
    ts: now,
    h: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  };
  window.fbChatSend(msg);
  // Adiciona localmente imediatamente
  _chatMsgs.push(msg);
  renderChat();
  inp.value = '';
  inp.style.height = 'auto';
}

function chatEnter(e){
  if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendChat(); return; }
  // auto-resize
  const t=e.target; t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,80)+'px';
}

function renderChat(){
  const el = document.getElementById('chat-messages');
  if(!el) return;
  if(!_chatMsgs.length){
    el.innerHTML = '<div style="color:var(--white-dust);font-size:12px;font-family:\'Courier Prime\',monospace;padding:12px;text-align:center;opacity:.6">Nenhuma mensagem ainda.</div>';
    return;
  }
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  el.innerHTML = '';
  _chatMsgs.forEach(msg=>{
    const isMine = msg.user === currentUser;
    const col = msg.isMestre ? '#c49a00' : _userColor(msg.user);
    const div = document.createElement('div');
    div.className = 'chat-msg' + (isMine?' chat-mine':'');
    // Reações para esta mensagem
    const msgReacoes = (_chatReacoes && msg._key) ? (_chatReacoes[msg._key]||{}) : {};
    const reacoesCounts = {};
    Object.values(msgReacoes).forEach(r=>{ reacoesCounts[r.emoji]=(reacoesCounts[r.emoji]||[]); reacoesCounts[r.emoji].push(r.user); });
    const reacoesHTML = Object.entries(reacoesCounts).map(([emoji, users])=>{
      const eu = users.includes(currentUser);
      return `<button onclick="reactToMsg('${msg._key}','${emoji}')" title="${users.join(', ')}"
        style="background:${eu?'rgba(139,0,0,0.25)':'rgba(20,0,15,0.4)'};border:1px solid ${eu?'rgba(139,0,0,0.6)':'rgba(100,100,100,0.3)'};
        border-radius:10px;padding:1px 6px;font-size:12px;cursor:pointer;color:var(--white-bone);line-height:1.5">${emoji} ${users.length}</button>`;
    }).join('');
    div.innerHTML = `
      <div class="chat-who" style="color:${col}">${msg.isMestre?'⛧ ':''}${msg.user}<span class="chat-time">${msg.h}</span></div>
      <div class="chat-text">${_escHtml(msg.text)}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;align-items:center">
        ${reacoesHTML}
        <button onclick="toggleReacaoMenu('${msg._key}',this)"
          style="background:transparent;border:1px solid rgba(100,100,100,0.2);border-radius:10px;padding:1px 6px;font-size:11px;cursor:pointer;color:rgba(255,255,255,0.3);line-height:1.5"
          title="Adicionar reação">＋😶</button>
      </div>`;
    el.appendChild(div);
  });
  if(atBottom) el.scrollTop = el.scrollHeight;
}

function clearChat(){
  if(!isMestre){ toast('Apenas o Mestre pode limpar o chat.'); return; }
  if(!confirm('Limpar todo o histórico do chat?')) return;
  if(window.fbChatClear) window.fbChatClear();
  _chatMsgs = [];
  renderChat();
}

function _escHtml(t){ return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

/* ─────────────────────────────────────────────
   ROLAGENS PÚBLICAS (visíveis a todos)
───────────────────────────────────────────── */

function renderPublicRolls(){
  const el = document.getElementById('public-rolls-list');
  if(!el) return;
  if(!_publicRolls.length){
    el.innerHTML = '<div style="color:var(--white-dust);font-size:12px;font-family:\'Courier Prime\',monospace;padding:8px;opacity:.6">Nenhuma rolagem ainda.</div>';
    return;
  }
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  el.innerHTML = '';
  const slice = _publicRolls.slice(-60);
  slice.forEach(r=>{
    const col = r.isMestre ? '#c49a00' : _userColor(r.user);
    const isCrit = r.total >= (r.rolls && r.rolls.length===1 && r.label.includes('d20') ? 20 : Infinity);
    const isFumble = r.total <= (r.rolls && r.rolls.length===1 && r.label.includes('d20') ? 1 : -Infinity);
    const div = document.createElement('div');
    div.className = 'pub-roll'+(isCrit?' pub-crit':'')+(isFumble?' pub-fumble':'');
    const detail = r.rolls ? '['+r.rolls.join('+')+']'+(r.mod&&r.mod!==0?(r.mod>0?' +':' ')+r.mod:'') : '';
    div.innerHTML = `<span class="pub-roll-who" style="color:${col}">${r.user}</span> <span class="pub-roll-label">${r.label}${r.ctx?' ('+_escHtml(r.ctx)+')':''}</span> <span class="pub-roll-detail">${detail}</span> <b class="pub-roll-total" style="color:${isCrit?'#ffdd44':isFumble?'#cc4444':'var(--white-dim)'}">${r.total}</b> <span class="pub-roll-time">${r.h}</span>`;
    el.appendChild(div);
  });
  if(atBottom) el.scrollTop = el.scrollHeight;
}

function clearPublicRolls(){
  if(!isMestre){ toast('Apenas o Mestre pode limpar.'); return; }
  if(!confirm('Limpar histórico de rolagens públicas?')) return;
  if(window.fbRollsClear) window.fbRollsClear();
  _publicRolls = [];
  renderPublicRolls();
}

/* ─────────────────────────────────────────────
   PEDIDO DE ROLAGEM — Mestre → Jogador
───────────────────────────────────────────── */
function mestreRequestRoll(){
  if(!isMestre){ return; }
  const target = document.getElementById('req-roll-target')?.value;
  const dado   = document.getElementById('req-roll-dado')?.value || '1d20';
  const motivo = document.getElementById('req-roll-motivo')?.value?.trim() || '';
  if(!target){ toast('Selecione um jogador.'); return; }
  if(!window.fbRequestRoll){ toast('Supabase não conectado.'); return; }
  const req = { target, dado, motivo, from: currentUser, ts: Date.now() };
  window.fbRequestRoll(req);
  toast('⛧ Pedido de rolagem enviado para '+target+'!');
}

function showRollRequest(req){
  const el = document.getElementById('roll-request-banner');
  if(!el) return;
  document.getElementById('rrb-dado').textContent = req.dado || '1d20';
  document.getElementById('rrb-motivo').textContent = req.motivo ? '— '+req.motivo : '';
  el.style.display = 'flex';
  // Prepopula o dado personalizado
  const qtd = req.dado.match(/^(\d+)/)?.[1]||1;
  const faces = req.dado.match(/d(\d+)/)?.[1]||20;
  const el2 = document.getElementById('r-qtd'); if(el2) el2.value=qtd;
  const el3 = document.getElementById('r-faces'); if(el3) el3.value=faces;
  const el4 = document.getElementById('r-label'); if(el4) el4.value=req.motivo||'';
  // Auto-navega para a aba de Dados
  showTab('dados', document.querySelector('.tab-btn[onclick*="dados"]'));
  toast('⛧ '+req.from+' pede que você role '+req.dado+'!', 6000);
}

function dismissRollRequest(){
  const el = document.getElementById('roll-request-banner');
  if(el) el.style.display = 'none';
  if(window.fbClearRollRequest) window.fbClearRollRequest(currentUser);
}

function rollRequestDice(){
  rollCustom();
  dismissRollRequest();
}

/* ─────────────────────────────────────────────
   RASTREADOR DE INICIATIVA / TURNOS
───────────────────────────────────────────── */
function saveInitiative(){
  if(!window.fbSaveInitiative) return;
  window.fbSaveInitiative({..._initData, ts: Date.now()});
}

function initAddCombatant(){
  const nome = document.getElementById('init-nome')?.value?.trim();
  const roll = parseInt(document.getElementById('init-roll')?.value) || 0;
  if(!nome){ toast('Digite o nome.'); return; }
  if(!isMestre){ toast('Apenas o Mestre controla a iniciativa.'); return; }
  _initData.combatants = _initData.combatants || [];
  _initData.combatants.push({ id: Date.now()+'', nome, roll, isNpc: !Object.values(db.users||{}).some(u=>u.user===nome), hp: null, hpMax: null });
  _initData.combatants.sort((a,b)=>b.roll-a.roll);
  if(document.getElementById('init-nome')) document.getElementById('init-nome').value='';
  if(document.getElementById('init-roll')) document.getElementById('init-roll').value='';
  saveInitiative();
  renderInitiativeTracker();
}

// Adiciona todos os jogadores online à iniciativa de uma vez
function initAddAllPlayers(){
  if(!isMestre) return;
  const online = document.querySelectorAll('#online-list .online-card:not(.mestre-card)');
  online.forEach(card=>{
    const name = card.querySelector('span:nth-child(2)')?.textContent?.replace('⛧ ','').trim();
    if(name && !_initData.combatants.find(c=>c.nome===name)){
      _initData.combatants.push({id:Date.now()+'_'+name, nome:name, roll:0, isNpc:false, hp:null, hpMax:null});
    }
  });
  saveInitiative();
  renderInitiativeTracker();
}

function initNext(){
  if(!isMestre) return;
  const len = _initData.combatants.length;
  if(!len) return;
  _initData.currentIdx = (_initData.currentIdx+1) % len;
  if(_initData.currentIdx === 0) _initData.round = (_initData.round||1)+1;
  _initData.active = true;
  saveInitiative();
  renderInitiativeTracker();
}

function initPrev(){
  if(!isMestre) return;
  const len = _initData.combatants.length;
  if(!len) return;
  _initData.currentIdx = (_initData.currentIdx-1+len) % len;
  saveInitiative();
  renderInitiativeTracker();
}

function initStart(){
  if(!isMestre) return;
  if(!_initData.combatants.length){ toast('Adicione combatentes primeiro.'); return; }
  _initData.active = true;
  _initData.round = 1;
  _initData.currentIdx = 0;
  saveInitiative();
  renderInitiativeTracker();
  toast('⛧ Combate iniciado!');
}

function initStop(){
  if(!isMestre) return;
  _initData.active = false;
  saveInitiative();
  renderInitiativeTracker();
}

function initClear(){
  if(!isMestre) return;
  if(!confirm('Limpar rastreador de iniciativa?')) return;
  _initData = { combatants:[], round:1, currentIdx:0, active:false };
  saveInitiative();
  renderInitiativeTracker();
}

function initRemove(id){
  if(!isMestre) return;
  _initData.combatants = _initData.combatants.filter(c=>c.id!==id);
  if(_initData.currentIdx >= _initData.combatants.length)
    _initData.currentIdx = Math.max(0, _initData.combatants.length-1);
  saveInitiative();
  renderInitiativeTracker();
}

function initEditRoll(id, val){
  const c = _initData.combatants.find(c=>c.id===id);
  if(!c) return;
  c.roll = parseInt(val)||0;
  _initData.combatants.sort((a,b)=>b.roll-a.roll);
  saveInitiative();
  renderInitiativeTracker();
}

function initEditHp(id, val){
  const c = _initData.combatants.find(c=>c.id===id);
  if(!c) return;
  c.hp = parseInt(val)||0;
  if(c.hpMax==null) c.hpMax=c.hp;
  saveInitiative();
  renderInitiativeTracker();
}

function renderInitiativeTracker(){
  const el = document.getElementById('initiative-tracker');
  if(!el) return;
  const d = _initData;
  const combatants = d.combatants || [];

  // Indicador de rodada
  const roundEl = document.getElementById('init-round');
  if(roundEl) roundEl.textContent = d.active ? 'Rodada '+d.round : (combatants.length?'Aguardando início':'—');

  // Lista de combatentes
  if(!combatants.length){
    el.innerHTML = '<div style="color:var(--white-dust);font-size:12px;font-family:\'Courier Prime\',monospace;padding:12px;opacity:.6;text-align:center">Nenhum combatente. Adicione acima.</div>';
    return;
  }

  el.innerHTML = '';
  combatants.forEach((c, i)=>{
    const isActive = d.active && i===d.currentIdx;
    const pvPct = (c.hp!=null && c.hpMax) ? Math.max(0,Math.min(1,c.hp/c.hpMax)) : null;
    const pvCol = pvPct==null?'#888':pvPct>0.5?'#22aa55':pvPct>0.25?'#cc8822':'#cc2222';
    const row = document.createElement('div');
    row.className = 'init-row' + (isActive?' init-active':'');
    let hpHtml = '';
    if(pvPct!==null){
      hpHtml = `<div style="flex-shrink:0;display:flex;align-items:center;gap:5px">
        <div style="width:50px;height:5px;background:rgba(30,0,20,.6);border:1px solid var(--blood-deep)"><div style="height:100%;width:${pvPct*100}%;background:${pvCol}"></div></div>
        <span style="font-size:10px;color:${pvCol};font-family:'Courier Prime',monospace">${c.hp}/${c.hpMax}</span>
      </div>`;
    }
    const editHp = isMestre ? `<input type="number" value="${c.hp??''}" placeholder="HP" onchange="initEditHp('${c.id}',this.value)"
      style="width:44px;background:transparent;border:1px solid rgba(58,0,0,.5);color:var(--white-ash);font-family:'Courier Prime',monospace;font-size:11px;padding:2px 4px;outline:none;text-align:center">` : '';
    const editRoll = isMestre ? `<input type="number" value="${c.roll}" onchange="initEditRoll('${c.id}',this.value)"
      style="width:40px;background:transparent;border:1px solid rgba(58,0,0,.5);color:var(--white-dim);font-family:'Courier Prime',monospace;font-size:12px;padding:2px 4px;outline:none;text-align:center">` : `<span style="font-size:13px;color:var(--white-dim);font-family:'Courier Prime',monospace">${c.roll}</span>`;
    const delBtn = isMestre ? `<button onclick="initRemove('${c.id}')" style="background:transparent;border:none;color:#cc4444;cursor:pointer;font-size:14px;line-height:1;padding:0 3px;opacity:.5;flex-shrink:0" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='.5'">×</button>` : '';
    row.innerHTML = `
      <div class="init-num">${i+1}</div>
      <div class="init-name${c.isNpc?' init-npc':''}">${isActive?'▶ ':''}${_escHtml(c.nome)}</div>
      ${editRoll}
      ${editHp}
      ${hpHtml}
      ${delBtn}
    `;
    el.appendChild(row);
  });

  // Destaque de quem é o turno atual (notificação para o jogador)
  if(d.active && combatants[d.currentIdx]){
    const whose = combatants[d.currentIdx].nome;
    const turnEl = document.getElementById('init-current-turn');
    if(turnEl) turnEl.textContent = 'Turno de: '+whose;
    // Se sou o jogador da vez, notifica com toast
    if(whose === currentUser && document.hidden===false){
      // Só tosta uma vez por mudança de turno
      if(_lastTurnNotified !== d.currentIdx+'_'+d.round){
        _lastTurnNotified = d.currentIdx+'_'+d.round;
        toast('⚔ É o seu turno!', 5000);
      }
    }
  } else {
    const turnEl = document.getElementById('init-current-turn');
    if(turnEl) turnEl.textContent = '';
  }
}
let _lastTurnNotified = '';

/* ─────────────────────────────────────────────
   INIT DA ABA MULTIPLAYER
───────────────────────────────────────────── */
// Única fonte de verdade pro status da aba Mesa Online — chamada tanto pelo
// monitor automático (a cada 10s) quanto ao reabrir a aba, pra nunca mais
// "mentir" que está conectado quando na verdade não está.
function _renderMoFbStatus(status){
  const dot   = document.getElementById('mo-fb-dot');
  const label = document.getElementById('mo-fb-label');
  if(!dot || !label) return;
  const info = _fbReasonInfo(status);
  dot.style.background = (status && status.ok) ? '#44cc88' : '#884444';
  label.textContent = (status && status.ok ? '● ' : '○ ') + info.text;
  label.style.color = info.color;
  const diagBtn = document.getElementById('mo-diag-btn');
  if(diagBtn) diagBtn.style.display = (status && status.ok) ? 'none' : '';
}

// Diagnóstico manual sob demanda — explica exatamente por que não conectou,
// sem precisar voltar pra tela de configuração.
async function runMoDiagnostico(){
  const box = document.getElementById('mo-diag-box');
  if(!box) return;
  box.style.display = 'block';
  box.innerHTML = '⏳ Verificando conexão com o Supabase...';
  const base = _fbBase();
  if(!base){
    box.innerHTML = '⚠ Supabase não configurado. <a onclick="openFirebaseSettings()" style="color:#5b9cf6;cursor:pointer;text-decoration:underline">Clique aqui para configurar</a>.';
    return;
  }
  try{
    const r = await fetch(base+'/rest/v1/mesa_state?limit=1', {
      headers: { 'apikey': _sbKey()||'', 'Authorization': 'Bearer '+(_sbKey()||'') },
      cache:'no-store'
    });
    if(r.ok){
      box.innerHTML = '✅ Conexão OK! O banco está acessível. Se mesmo assim algo não sincroniza, recarregue a página (F5).';
      return;
    }
    const txt = await r.text();
    let html = `❌ Erro HTTP ${r.status}.<br>`;
    if(r.status===401||r.status===403){
      html += '⚠ <b>Acesso bloqueado pelo Supabase.</b><br>Vá em Supabase Dashboard → Table Editor → mesa_state → desative Row Level Security ou adicione políticas de acesso público.';
    } else if(r.status===404){
      html += '⚠ <b>Tabela mesa_state não encontrada.</b><br>Crie a tabela no SQL Editor do Supabase:<br>' +
        '<code style="display:block;background:rgba(0,0,0,.4);padding:6px;margin-top:4px;font-size:10px">CREATE TABLE mesa_state (path text PRIMARY KEY, data jsonb, updated_at timestamptz DEFAULT now());</code>';
    } else {
      html += 'Resposta do servidor: ' + _escHtml(txt.slice(0,200));
    }
    box.innerHTML = html;
  } catch(e){
    box.innerHTML = '❌ Falha de rede: ' + _escHtml(e.message) + '<br>Verifique sua internet e a URL do Supabase configurada.';
  }
}

// ── Sub-abas internas da Mesa Online (Painel / Chat & Dados / Combate / Atmosfera / Comunicação) ──
const MO_SUBTABS = ['painel','chat','combate','atmosfera','comunicacao'];
function showMoTab(name){
  MO_SUBTABS.forEach(s=>{
    const btn   = document.getElementById('mosub-btn-'+s);
    const panel = document.getElementById('mosub-'+s);
    const active = s===name;
    if(btn)   btn.classList.toggle('active', active);
    if(panel) panel.classList.toggle('active', active);
  });
  try{ localStorage.setItem('op_mo_lasttab', name); }catch(e){}
}

function _initMultiTab(){
  // ── Status bar — usa o último status real conhecido, sem inventar "conectado" ──
  _renderMoFbStatus(window._fbConnState);
  const ulab = document.getElementById('mo-user-label');
  if(ulab && currentUser){
    ulab.textContent = (isMestre ? '⛧ Mestre: ' : '◭ Agente: ') + currentUser;
  }

  // ── Sub-aba inicial ──
  let lastTab = 'painel';
  try{ lastTab = localStorage.getItem('op_mo_lasttab') || 'painel'; }catch(e){}
  if(!MO_SUBTABS.includes(lastTab)) lastTab = 'painel';
  showMoTab(lastTab);

  // ── Visibilidade por role ──
  const clearChatBtn   = document.getElementById('chat-clear-btn');
  const clearRollsBtn  = document.getElementById('rolls-clear-btn');
  const reqPanel       = document.getElementById('req-roll-panel');
  const initAddRow     = document.getElementById('init-add-row');
  const initControls   = document.getElementById('init-controls');
  const ameacaCtrl     = document.getElementById('ameaca-controles');

  if(clearChatBtn)  clearChatBtn.style.display  = isMestre ? '' : 'none';
  if(clearRollsBtn) clearRollsBtn.style.display = isMestre ? '' : 'none';
  if(reqPanel)      reqPanel.style.display      = isMestre ? '' : 'none';
  if(initAddRow)    initAddRow.style.display    = isMestre ? '' : 'none';
  if(initControls)  initControls.style.display  = isMestre ? '' : 'none';
  if(ameacaCtrl)    ameacaCtrl.style.display    = isMestre ? 'flex' : 'none';

  // Role UI geral (pings, whispers, notas, votação, pistas, etc.)
  _applyRoleUI();
  updateApplyRoleUINovas();

  // Conteúdo das comunicações por role
  const playerComms  = document.getElementById('player-comms');
  const mestreComms  = document.getElementById('mestre-comms');
  if(playerComms) playerComms.style.display = isMestre ? 'none' : '';
  if(mestreComms) { mestreComms.style.display = isMestre ? 'flex' : 'none'; mestreComms.style.flexDirection = 'column'; }

  // Popula select de jogadores para pedido de rolagem (Mestre)
  if(isMestre){
    const sel = document.getElementById('req-roll-target');
    if(sel){
      const prev = sel.value;
      sel.innerHTML = '<option value="">— Selecionar jogador —</option>';
      // Combina db.users com presença online para lista completa de jogadores
      const allUsers = new Set([
        ...Object.keys(db.users||{}).filter(u => {
          const ud = db.users[u]; return ud && !ud.isMestre && u !== currentUser;
        })
      ]);
      allUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u;
        opt.textContent = (db.characters[u] && db.characters[u].nome) ? db.characters[u].nome + ' (' + u + ')' : u;
        sel.appendChild(opt);
      });
      if(prev) sel.value = prev;
    }
  }

  // Inicializa controles dinâmicos
  renderCenaControls();
  renderClimaControls();
  renderMusicaControls();

  // Renderiza estado atual de todos os painéis
  renderChat();
  renderPublicRolls();
  renderInitiativeTracker();
  renderAmeaca(_ameacaVal);
  renderNotasMestre(_notasMestreCache || '');
  renderRevealedClues(_cluesData);
  renderBau(_bauData);
  renderDiario(_diarioData);
  renderPartyStatus(_partyStatusData);
  renderVotePanel(_voteData);
  renderSecretRolls(_secretRolls);
  if(_cenaAtiva !== undefined) renderCenaAtiva(_cenaAtiva);
  if(_climaAtual !== undefined) renderClima(_climaAtual);
  if(_musicaAtual !== undefined) renderMusica(_musicaAtual);
  if(_timerData  !== undefined) syncTimer(_timerData);
  if(_focoUser   !== undefined) renderFoco(_focoUser);
  if(_whisperData.length)       renderWhispers(_whisperData);
  if(Object.keys(_pingData).length) renderPings(_pingData);
}

// Cache de texto de notas do mestre para renderizar ao abrir a aba
let _notasMestreCache = '';

// ══════════════════════════════════════════════════════════════════
// PSIQUÊ — Sistema de Relacionamentos (Mapa Mental + Níveis)
// Cada player escreve livremente sobre os outros + define o nível
// e natureza da relação. Mestre vê tudo. Players não veem uns aos outros.
// ══════════════════════════════════════════════════════════════════

let _psiqueData = {};       // { targetUser: { nivel, natureza, vinculo, gosto, nao_gosto, mente, segredo } }
let _psiqueTarget = null;
let _psiqueSaveTimer = null;
let _psiqueAllData = {};    // Mestre: { fromUser: { targetUser: {...} } }

// ── Níveis de intensidade da relação (1–5) ──
const PSIQUE_NIVEIS = [
  { val:1, label:'distante',    desc:'mal nos conhecemos',               cor:'rgba(120,120,160,0.7)', corBg:'rgba(80,80,120,0.15)',  glyph:'○' },
  { val:2, label:'conhecido',   desc:'há algo entre nós, ainda incerto', cor:'rgba(91,156,246,0.8)',  corBg:'rgba(40,80,160,0.15)',  glyph:'◔' },
  { val:3, label:'próximo',     desc:'me importo com o que acontece',    cor:'rgba(196,154,0,0.9)',   corBg:'rgba(140,100,0,0.18)',  glyph:'◑' },
  { val:4, label:'íntimo',      desc:'carrego essa pessoa comigo',       cor:'rgba(160,100,255,0.9)', corBg:'rgba(100,50,200,0.2)',  glyph:'◕' },
  { val:5, label:'inseparável', desc:'mudar isso seria mudar quem sou',  cor:'rgba(220,80,80,0.95)',  corBg:'rgba(180,30,30,0.2)',   glyph:'●' },
];

// ── Naturezas possíveis da relação ──
const PSIQUE_NATUREZAS = [
  { id:'confianca',   label:'confiança',    icon:'◈',  cor:'rgba(91,200,160,0.8)'  },
  { id:'rivalidade',  label:'rivalidade',   icon:'⚔',  cor:'rgba(220,80,80,0.8)'   },
  { id:'fascinio',    label:'fascínio',     icon:'◉',  cor:'rgba(196,154,0,0.9)'   },
  { id:'protecao',    label:'proteção',     icon:'⛊',  cor:'rgba(91,156,246,0.8)'  },
  { id:'divida',      label:'dívida',       icon:'⚖',  cor:'rgba(200,140,40,0.8)'  },
  { id:'desconfianca',label:'desconfiança', icon:'◬',  cor:'rgba(180,100,255,0.8)' },
  { id:'admira',      label:'admiração',    icon:'★',  cor:'rgba(240,200,60,0.8)'  },
  { id:'culpa',       label:'culpa',        icon:'◆',  cor:'rgba(160,60,160,0.8)'  },
  { id:'medo',        label:'medo',         icon:'☠',  cor:'rgba(180,60,60,0.8)'   },
  { id:'ternura',     label:'ternura',      icon:'◇',  cor:'rgba(200,160,220,0.8)' },
];

// Campos de texto livre
const PSIQUE_CAMPOS = [
  { id:'vinculo',    label:'vínculo',          hint:'o que nos une... ou separa.',          placeholder:'o que essa pessoa significa pra mim...' },
  { id:'gosto',      label:'o que eu gosto',   hint:'fragmentos que me prendem.',            placeholder:'o que me atrai nessa pessoa...' },
  { id:'nao_gosto',  label:'o que me incomoda',hint:'o que range entre nós.',                placeholder:'o que me perturba nela...' },
  { id:'mente',      label:'o que penso agora',hint:'pensamentos que não consigo calar.',    placeholder:'o que cruza minha mente quando a vejo...' },
  { id:'segredo',    label:'o que não digo',   hint:'sussurros que guardo só pra mim.',      placeholder:'o que nunca direi em voz alta...' },
];

function _psiqueOtherPlayers(){
  return Object.keys(db.users || {}).filter(u => u !== currentUser && u !== 'billy');
}
function _psiqueCharName(u){ return (db.characters[u]||{}).nome || u; }

function _psiqueSave(){
  if(!currentUser || isMestre) return;
  clearTimeout(_psiqueSaveTimer);
  _psiqueSaveTimer = setTimeout(async () => {
    if(window.fbSavePsique) await window.fbSavePsique(currentUser, _psiqueData);
  }, 1200);
}

async function _psiqueLoad(){
  if(!currentUser || isMestre) return;
  if(window.fbLoadPsique){
    const remote = await window.fbLoadPsique(currentUser);
    if(remote) _psiqueData = remote;
  }
}

// ── Render principal ──
async function renderPsiqueTab(){
  const root = document.getElementById('psique-root');
  if(!root) return;
  if(!currentUser){
    root.innerHTML = `<div style="color:var(--white-dust);text-align:center;padding:60px 20px;font-family:'IM Fell English',serif;font-style:italic">Entre na mesa primeiro.</div>`;
    return;
  }
  if(isMestre){ await _psiqueRenderMestre(root); return; }
  await _psiqueLoad();
  _psiqueRenderPlayer(root);
}

// ── Visão do Player ──
function _psiqueRenderPlayer(root){
  const others = _psiqueOtherPlayers();
  root.innerHTML = `
    <div class="psique-shell">
      <div class="psique-noise"></div>
      <div class="psique-vignette"></div>
      <div class="psique-header">
        <div class="psique-title-glyph">◈</div>
        <div class="psique-title">psiquê</div>
        <div class="psique-subtitle">o que você carrega sobre os outros — só seus olhos podem ler</div>
      </div>
      ${!others.length ? `
        <div class="psique-empty"><div style="font-size:2rem;opacity:.3">◈</div><div>nenhum outro agente na mesa ainda</div></div>`
      : `
        <div class="psique-map">
          <div class="psique-self-node">
            <div class="psique-self-ring"></div>
            <div class="psique-self-inner">${_psiqueCharName(currentUser).charAt(0).toUpperCase()}</div>
            <div class="psique-self-label">eu</div>
          </div>
          <div class="psique-targets">
            ${others.map(u => _psiqueNodeHTML(u)).join('')}
          </div>
        </div>
        <div id="psique-editor" class="psique-editor ${_psiqueTarget ? 'visible' : ''}">
          ${_psiqueTarget ? _psiqueEditorHTML(_psiqueTarget) : ''}
        </div>
      `}
    </div>`;
}

function _psiqueNodeHTML(u){
  const d = _psiqueData[u] || {};
  const nivel = PSIQUE_NIVEIS.find(n => n.val === (d.nivel||0)) || null;
  const natureza = PSIQUE_NATUREZAS.find(n => n.id === d.natureza) || null;
  const filled = PSIQUE_CAMPOS.filter(f => d[f.id] && d[f.id].trim()).length;
  const pct = Math.round((filled / PSIQUE_CAMPOS.length) * 100);
  const ringCor = nivel ? nivel.cor : 'rgba(196,154,0,0.35)';
  const ringBg  = nivel ? nivel.corBg : 'transparent';
  const c = db.characters[u] || {};
  const hasAvatar = c.token?.imgData;
  const active = _psiqueTarget === u;

  return `
    <div class="psique-target-node ${active ? 'active' : ''}" onclick="psiqueSelectTarget('${u}')">
      <div class="psique-target-ring" style="background:${ringBg};border-radius:50%">
        <svg viewBox="0 0 36 36" class="psique-ring-svg">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="2.5"/>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="${ringCor}" stroke-width="2.5"
            stroke-dasharray="${pct} 100" stroke-dashoffset="25" stroke-linecap="round"/>
        </svg>
        <div class="psique-target-avatar" style="border-color:${ringCor}">
          ${hasAvatar ? `<img src="${c.token.imgData}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : `<span>${_psiqueCharName(u).charAt(0).toUpperCase()}</span>`}
        </div>
      </div>
      <div class="psique-target-name">${_psiqueCharName(u)}</div>
      ${nivel ? `<div class="psique-node-nivel" style="color:${nivel.cor}">${nivel.glyph} ${nivel.label}</div>` : `<div class="psique-node-nivel" style="opacity:.3">— indefinido</div>`}
      ${natureza ? `<div class="psique-node-natureza" style="color:${natureza.cor}">${natureza.icon} ${natureza.label}</div>` : ''}
    </div>`;
}

function _psiqueEditorHTML(u){
  const d = _psiqueData[u] || {};
  const name = _psiqueCharName(u);
  const nivelAtual = d.nivel || 0;
  const naturezaAtual = d.natureza || '';

  return `
    <div class="psique-editor-header">
      <div class="psique-editor-thread"></div>
      <div class="psique-editor-title">
        <span class="psique-editor-glyph">⟁</span>
        pensamentos sobre <em>${name}</em>
      </div>
      <div class="psique-editor-hint">escreva livremente — ninguém mais vai ler</div>
    </div>

    <!-- NÍVEL DE RELAÇÃO -->
    <div class="psique-nivel-section">
      <div class="psique-section-label">intensidade do vínculo</div>
      <div class="psique-niveis">
        ${PSIQUE_NIVEIS.map(n => `
          <div class="psique-nivel-opt ${nivelAtual === n.val ? 'selected' : ''}"
               style="--ncor:${n.cor};--nbg:${n.corBg}"
               onclick="psiqueSetNivel('${u}',${n.val})">
            <div class="psique-nivel-glyph">${n.glyph}</div>
            <div class="psique-nivel-label">${n.label}</div>
            <div class="psique-nivel-desc">${n.desc}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- NATUREZA DA RELAÇÃO -->
    <div class="psique-natureza-section">
      <div class="psique-section-label">natureza do que sinto</div>
      <div class="psique-naturezas">
        ${PSIQUE_NATUREZAS.map(n => `
          <div class="psique-natureza-opt ${naturezaAtual === n.id ? 'selected' : ''}"
               style="--ncor:${n.cor}"
               onclick="psiqueSetNatureza('${u}','${n.id}')">
            <span class="psique-natureza-icon">${n.icon}</span>
            <span class="psique-natureza-label">${n.label}</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- CAMPOS DE TEXTO LIVRE -->
    <div class="psique-fields">
      ${PSIQUE_CAMPOS.map(f => `
        <div class="psique-field">
          <div class="psique-field-label">
            <span class="psique-field-glyph">—</span>
            ${f.label}
            <span class="psique-field-sublabel">${f.hint}</span>
          </div>
          <textarea class="psique-textarea"
            id="psique-field-${u}-${f.id}"
            placeholder="${f.placeholder}"
            oninput="psiqueFieldInput('${u}','${f.id}',this.value)"
          >${d[f.id]||''}</textarea>
        </div>`).join('')}
    </div>
    <div class="psique-save-indicator" id="psique-saving">salvando...</div>`;
}

window.psiqueSelectTarget = function(u){
  _psiqueTarget = (_psiqueTarget === u) ? null : u;
  const root = document.getElementById('psique-root');
  if(root) _psiqueRenderPlayer(root);
};

window.psiqueSetNivel = function(u, val){
  if(!_psiqueData[u]) _psiqueData[u] = {};
  // Toggle: clicou no mesmo → remove
  _psiqueData[u].nivel = _psiqueData[u].nivel === val ? 0 : val;
  // Atualiza UI das opções sem re-render total
  document.querySelectorAll('.psique-nivel-opt').forEach((el, i) => {
    el.classList.toggle('selected', PSIQUE_NIVEIS[i].val === _psiqueData[u].nivel);
  });
  // Atualiza o nó no mapa
  _psiqueUpdateNode(u);
  _psiqueSaveIndicator();
  _psiqueSave();
};

window.psiqueSetNatureza = function(u, id){
  if(!_psiqueData[u]) _psiqueData[u] = {};
  _psiqueData[u].natureza = _psiqueData[u].natureza === id ? '' : id;
  document.querySelectorAll('.psique-natureza-opt').forEach(el => {
    el.classList.toggle('selected', el.onclick?.toString().includes(`'${id}'`) && _psiqueData[u].natureza === id);
  });
  // Re-render naturezas para garantir estado correto
  const sec = document.querySelector('.psique-naturezas');
  if(sec){
    const nat = _psiqueData[u].natureza;
    sec.querySelectorAll('.psique-natureza-opt').forEach(el => {
      const elId = el.getAttribute('onclick')?.match(/'([^']+)'\)$/)?.[1];
      el.classList.toggle('selected', elId === nat);
    });
  }
  _psiqueUpdateNode(u);
  _psiqueSaveIndicator();
  _psiqueSave();
};

window.psiqueFieldInput = function(u, field, val){
  if(!_psiqueData[u]) _psiqueData[u] = {};
  _psiqueData[u][field] = val;
  _psiqueUpdateNode(u);
  _psiqueSaveIndicator();
  _psiqueSave();
};

function _psiqueUpdateNode(u){
  const node = document.querySelector(`.psique-target-node[onclick*="'${u}'"]`);
  if(!node) return;
  node.outerHTML = _psiqueNodeHTML(u);
  // Após trocar outerHTML o nó original foi removido, re-query não necessário
  // (o novo nó foi inserido no DOM)
}

function _psiqueSaveIndicator(){
  const ind = document.getElementById('psique-saving');
  if(ind){ ind.style.opacity = '1'; clearTimeout(ind._t); ind._t = setTimeout(()=>{ ind.style.opacity='0'; }, 2000); }
}

// ── Visão do Mestre ──
async function _psiqueRenderMestre(root){
  root.innerHTML = `<div class="psique-shell psique-mestre-shell">
    <div class="psique-noise"></div><div class="psique-vignette"></div>
    <div class="psique-header">
      <div class="psique-title-glyph">◉</div>
      <div class="psique-title">mapa das mentes</div>
      <div class="psique-subtitle">você vê o que ninguém mais pode ver — os pensamentos e vínculos de cada agente</div>
    </div>
    <div class="psique-mestre-loading"><div class="psique-mestre-spinner">◈</div><div>lendo as mentes...</div></div>
  </div>`;

  let allData = {};
  if(window.fbLoadAllPsique) allData = await window.fbLoadAllPsique();
  _psiqueAllData = allData;

  const players = Object.keys(db.users || {}).filter(u => u !== 'billy');
  if(!players.length){
    root.innerHTML = `<div class="psique-shell"><div class="psique-noise"></div><div class="psique-vignette"></div>
      <div class="psique-header"><div class="psique-title-glyph">◉</div><div class="psique-title">mapa das mentes</div></div>
      <div class="psique-empty">nenhum agente registrado ainda.</div></div>`;
    return;
  }

  const sections = players.map(fromUser => {
    const charName = _psiqueCharName(fromUser);
    const data = allData[fromUser] || {};
    const others = players.filter(u => u !== fromUser);
    if(!others.length) return '';

    const relations = others.map(targetUser => {
      const d = data[targetUser] || {};
      const targetName = _psiqueCharName(targetUser);
      const nivel = PSIQUE_NIVEIS.find(n => n.val === (d.nivel||0)) || null;
      const natureza = PSIQUE_NATUREZAS.find(n => n.id === d.natureza) || null;
      const hasText = PSIQUE_CAMPOS.some(f => d[f.id]?.trim());
      const hasRel  = nivel || natureza;

      return `
        <div class="psique-mestre-relation ${!hasRel && !hasText ? 'psique-mestre-empty-rel' : ''}">
          <div class="psique-mestre-rel-header">
            <span class="psique-mestre-rel-target">→ ${targetName}</span>
            ${nivel ? `<span class="psique-mestre-badge-nivel" style="color:${nivel.cor};border-color:${nivel.cor}">${nivel.glyph} ${nivel.label}</span>` : ''}
            ${natureza ? `<span class="psique-mestre-badge-nat" style="color:${natureza.cor};border-color:${natureza.cor}">${natureza.icon} ${natureza.label}</span>` : ''}
          </div>
          ${nivel ? `<div class="psique-mestre-nivel-bar">
            ${PSIQUE_NIVEIS.map(n => `<div class="psique-mestre-nivel-pip" style="background:${(d.nivel||0)>=n.val ? n.cor : 'rgba(255,255,255,0.07)'}"></div>`).join('')}
            <span class="psique-mestre-nivel-desc" style="color:${nivel.cor}">${nivel.desc}</span>
          </div>` : ''}
          ${hasText ? PSIQUE_CAMPOS.map(f => d[f.id]?.trim() ? `
            <div class="psique-mestre-fragment">
              <span class="psique-mestre-frag-label">${f.label}</span>
              <span class="psique-mestre-frag-text">"${d[f.id].trim()}"</span>
            </div>` : '').join('') : (!hasRel ? `<div class="psique-mestre-frag-empty">nada registrado sobre ${targetName}.</div>` : '')}
        </div>`;
    }).join('');

    const c = db.characters[fromUser] || {};
    const hasAvatar = c.token?.imgData;
    return `
      <div class="psique-mestre-mind">
        <div class="psique-mestre-mind-header">
          <div class="psique-mestre-avatar">
            ${hasAvatar ? `<img src="${c.token.imgData}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : `<span>${charName.charAt(0).toUpperCase()}</span>`}
          </div>
          <div>
            <div class="psique-mestre-mind-name">${charName}</div>
            <div class="psique-mestre-mind-user">@${fromUser}</div>
          </div>
          <div class="psique-mestre-mind-flicker"></div>
        </div>
        <div class="psique-mestre-relations">${relations}</div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <div class="psique-shell psique-mestre-shell">
      <div class="psique-noise"></div><div class="psique-vignette"></div>
      <div class="psique-header">
        <div class="psique-title-glyph">◉</div>
        <div class="psique-title">mapa das mentes</div>
        <div class="psique-subtitle">você vê o que ninguém mais pode ver — os vínculos e pensamentos de cada agente</div>
      </div>
      <button onclick="renderPsiqueTab()" class="psique-refresh-btn">↺ atualizar mentes</button>
      <div class="psique-mestre-grid">${sections}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
// PSIQUÊ — ÁUDIO SINTÉTICO DA MENTE
// Web Audio API puro: drone, batimento cardíaco, ruído filtrado,
// sussurros e pulsos. Sem arquivos externos.
// ══════════════════════════════════════════════════════════════════

let _psiqueAudioCtx   = null;
let _psiqueAudioNodes = [];   // nós ativos para desligar
let _psiqueAudioActive = false;
let _psiqueTrilhaSnap = null; // estado salvo da trilha antes de entrar
let _psiqueAmbSnap    = null; // estado salvo da amb antes de entrar

function _psiqueAudioInit(){
  if(_psiqueAudioCtx && _psiqueAudioCtx.state !== 'closed') return;
  try {
    _psiqueAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e){ _psiqueAudioCtx = null; }
}

function _psiqueAudioStop(){
  _psiqueAudioNodes.forEach(n => {
    try { n.stop ? n.stop(0) : n.disconnect(); } catch(e){}
  });
  _psiqueAudioNodes = [];
  if(_psiqueAudioCtx){
    try { _psiqueAudioCtx.close(); } catch(e){}
    _psiqueAudioCtx = null;
  }
  _psiqueAudioActive = false;
}

function _psiqueAudioEnter(){
  if(_psiqueAudioActive) return;

  // Salva estado atual dos players
  _psiqueTrilhaSnap = null;
  _psiqueAmbSnap    = null;

  if(typeof _trilhaPlayer !== 'undefined' && _trilhaPlayer && !_trilhaPlayer.paused){
    _psiqueTrilhaSnap = {
      nome:    _trilhaAtual?.nome || null,
      pos:     _trilhaPlayer.currentTime,
      playing: true
    };
    // Fade out suave e pausa
    _psiqueAudioFade(_trilhaPlayer, _trilhaPlayer.volume, 0, 1200, () => {
      if(_trilhaPlayer) _trilhaPlayer.pause();
    });
  }

  if(typeof _ambPlayer !== 'undefined' && _ambPlayer && !_ambPlayer.paused){
    _psiqueAmbSnap = {
      nome:    _ambAtual?.nome || null,
      playing: true
    };
    _psiqueAudioFade(_ambPlayer, _ambPlayer.volume, 0, 1200, () => {
      if(_ambPlayer) _ambPlayer.pause();
    });
  }

  // Para a ambientação sintética (Web Audio API) com fade suave
  if(window._ambienceMaster && window._ambienceCtx){
    const m  = window._ambienceMaster;
    const gm = window._ambienceGuitarMaster;
    const dm = window._ambienceDrumMaster;
    const t  = window._ambienceCtx.currentTime;
    m.gain.cancelScheduledValues(t);
    m.gain.linearRampToValueAtTime(0, t + 1.2);
    if(gm){ gm.gain.cancelScheduledValues(t); gm.gain.linearRampToValueAtTime(0, t + 1.2); }
    if(dm){ dm.gain.cancelScheduledValues(t); dm.gain.linearRampToValueAtTime(0, t + 1.2); }
  }

  // Inicia o áudio sintético com delay para dar tempo do fade
  setTimeout(() => {
    _psiqueAudioActive = true;
    _psiqueAudioInit();
    if(!_psiqueAudioCtx) return;
    _psiqueBuildSoundscape();
    // Aplica volume atual do slider ao áudio da psique
    _psiqueApplyVolume();
  }, 900);
}

function _psiqueAudioLeave(){
  if(!_psiqueAudioActive) return;

  // Fade out do áudio da mente
  // (os nós vão parar sozinhos via gain.linearRampToValueAtTime)
  if(_psiqueAudioCtx){
    const masterGain = _psiqueAudioNodes.find(n => n._isPsiqueMaster);
    if(masterGain){
      const t = _psiqueAudioCtx.currentTime;
      masterGain.gain.setValueAtTime(masterGain.gain.value, t);
      masterGain.gain.linearRampToValueAtTime(0, t + 1.5);
    }
  }

  setTimeout(() => {
    _psiqueAudioStop();

    // Restaura trilha e ambientação
    if(_psiqueTrilhaSnap?.nome){
      const snap = _psiqueTrilhaSnap;
      _psiqueTrilhaSnap = null;
      if(typeof playTrilha === 'function') playTrilha(snap.nome, snap.pos);
    }
    if(_psiqueAmbSnap?.nome){
      const snap = _psiqueAmbSnap;
      _psiqueAmbSnap = null;
      if(typeof playAmbientacao === 'function') playAmbientacao(snap.nome);
    }

    // Restaura o volume da ambientação sintética (Web Audio)
    if(window._ambienceMaster && window._ambienceCtx){
      const sl = document.getElementById('ambience-vol');
      const ratio = sl ? parseInt(sl.value)/100 : 0.55;
      const m  = window._ambienceMaster;
      const gm = window._ambienceGuitarMaster;
      const dm = window._ambienceDrumMaster;
      const t  = window._ambienceCtx.currentTime;
      m.gain.cancelScheduledValues(t);
      m.gain.linearRampToValueAtTime(ratio * 0.12, t + 1.5);
      if(gm){ gm.gain.cancelScheduledValues(t); gm.gain.linearRampToValueAtTime(ratio * 0.13, t + 1.5); }
      if(dm){ dm.gain.cancelScheduledValues(t); dm.gain.linearRampToValueAtTime(ratio * 0.11, t + 1.5); }
    }
  }, 1600);
}

function _psiqueAudioFade(audioEl, from, to, ms, cb){
  const steps = 30;
  const interval = ms / steps;
  const delta = (to - from) / steps;
  let step = 0;
  const t = setInterval(() => {
    step++;
    audioEl.volume = Math.max(0, Math.min(1, from + delta * step));
    if(step >= steps){ clearInterval(t); if(cb) cb(); }
  }, interval);
}

// Aplica o valor do slider de ambientação ao master gain da psique
function _psiqueApplyVolume(){
  if(!_psiqueAudioActive || !window._psiqueMasterGain || !_psiqueAudioCtx) return;
  const sl = document.getElementById('ambience-vol');
  const ratio = sl ? parseInt(sl.value)/100 : 0.55;
  const master = window._psiqueMasterGain;
  const baseVol = master._psiqueBaseVol || 0.42;
  const t = _psiqueAudioCtx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(baseVol * ratio, t, 0.3);
}

function _psiqueBuildSoundscape(){
  const ctx = _psiqueAudioCtx;
  if(!ctx) return;

  // Master gain (usado no fade de saída e no controle de volume)
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);

  // Volume base derivado do slider de ambientação
  const sl = document.getElementById('ambience-vol');
  const sliderRatio = sl ? parseInt(sl.value)/100 : 0.55;
  const targetVol = 0.42 * sliderRatio; // mais sutil — era 0.72
  master.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 3.0);
  master.connect(ctx.destination);
  master._isPsiqueMaster = true;
  master._psiqueBaseVol = 0.42; // referência para escalar com slider
  _psiqueAudioNodes.push(master);
  window._psiqueMasterGain = master; // expõe para o slider

  // ── 1. Drone suave — tons quentes e aconchegantes ──
  _psiqueDrone(ctx, master, 55,  0.10);   // fundamental (reduzido de 0.18)
  _psiqueDrone(ctx, master, 82.5, 0.06);  // quinta (reduzido de 0.10)
  _psiqueDrone(ctx, master, 110, 0.04);   // oitava (reduzido de 0.07)
  _psiqueDrone(ctx, master, 165, 0.025);  // décima quinta — harmônico suave extra

  // ── 2. Ruído filtrado muito tênue — como respiração distante ──
  _psiqueFilteredNoise(ctx, master, 'bandpass', 250, 3, 0.025); // era 0.06
  _psiqueFilteredNoise(ctx, master, 'lowpass',  60,  1, 0.018); // era 0.04

  // ── 3. Batimento cardíaco mais suave e lento ──
  _psiqueBeat(ctx, master);

  // ── 4. Pulsos melódicos aconchegantes — mais lentos e delicados ──
  _psiquePulses(ctx, master);
}

function _psiqueDrone(ctx, dest, freq, vol){
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo  = ctx.createOscillator();
  const lfoG = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  lfo.type = 'sine';
  lfo.frequency.value = 0.07 + Math.random() * 0.05;
  lfoG.gain.value = freq * 0.004; // vibrato sutil
  lfo.connect(lfoG);
  lfoG.connect(osc.frequency);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq * 3;
  filter.Q.value = 0.8;

  gain.gain.value = vol;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start();
  lfo.start();

  _psiqueAudioNodes.push(osc, lfo);
}

function _psiqueFilteredNoise(ctx, dest, type, freq, Q, vol){
  // Gera buffer de ruído branco
  const bufferSize = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data   = buffer.getChannelData(0);
  for(let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = Q;

  const gain = ctx.createGain();
  gain.gain.value = vol;

  // LFO para mover o filtro — como pensamentos flutuando
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.04 + Math.random() * 0.06;
  lfoG.gain.value = freq * 0.3;
  lfo.connect(lfoG);
  lfoG.connect(filter.frequency);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  source.start();
  lfo.start();
  _psiqueAudioNodes.push(source, lfo);
}

function _psiqueBeat(ctx, dest){
  // Batimento cardíaco suave — quase imperceptível, como conforto interno
  const bpm  = 56 + Math.random() * 6; // mais lento e calmo
  const period = 60 / bpm;

  const scheduleBeat = (when) => {
    if(!_psiqueAudioActive) return;

    // Pulso 1 — "lub" — mais suave
    const lub = ctx.createOscillator();
    const lubG = ctx.createGain();
    lub.type = 'sine';
    lub.frequency.setValueAtTime(72, when);
    lub.frequency.linearRampToValueAtTime(38, when + 0.14);
    lubG.gain.setValueAtTime(0, when);
    lubG.gain.linearRampToValueAtTime(0.10, when + 0.025); // era 0.22
    lubG.gain.linearRampToValueAtTime(0, when + 0.16);
    lub.connect(lubG); lubG.connect(dest);
    lub.start(when); lub.stop(when + 0.18);

    // Pulso 2 — "dub" — quase inaudível
    const dub = ctx.createOscillator();
    const dubG = ctx.createGain();
    dub.type = 'sine';
    dub.frequency.setValueAtTime(58, when + 0.20);
    dub.frequency.linearRampToValueAtTime(28, when + 0.32);
    dubG.gain.setValueAtTime(0, when + 0.20);
    dubG.gain.linearRampToValueAtTime(0.06, when + 0.22); // era 0.14
    dubG.gain.linearRampToValueAtTime(0, when + 0.34);
    dub.connect(dubG); dubG.connect(dest);
    dub.start(when + 0.20); dub.stop(when + 0.36);

    const nextWhen = when + period;
    const delay = (nextWhen - ctx.currentTime) * 1000 - 80;
    setTimeout(() => scheduleBeat(ctx.currentTime + 0.08), Math.max(0, delay));
  };

  scheduleBeat(ctx.currentTime + 2.0);
}

function _psiquePulses(ctx, dest){
  // Notas suaves e etéreas — como memórias gentis emergindo
  // Escala: Sol maior pentatônica — G A B D E (mais aconchegante e luminosa)
  const notes = [98, 110, 123.5, 146.8, 164.8, 196, 220, 246.9];

  const scheduleNext = () => {
    if(!_psiqueAudioActive || !_psiqueAudioCtx) return;

    const freq   = notes[Math.floor(Math.random() * notes.length)];
    const when   = ctx.currentTime + 0.05;
    const dur    = 3.5 + Math.random() * 4.5; // mais longas e contemplativas
    const vol    = 0.025 + Math.random() * 0.04; // mais suaves (era 0.04–0.11)

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    const rev  = ctx.createDelay(2.5);
    const revG = ctx.createGain();

    osc.type = 'sine'; // sempre seno — mais suave, sem triangle áspero
    osc.frequency.value = freq;

    // Detune muito sutil — quase em uníssono
    osc.detune.value = (Math.random() - 0.5) * 6;

    // Attack mais lento — emerge gentilmente
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 1.2); // era 0.6
    gain.gain.setValueAtTime(vol, when + dur - 1.2);
    gain.gain.linearRampToValueAtTime(0, when + dur);

    // Reverb mais pronunciado para sensação etérea
    rev.delayTime.value = 0.45 + Math.random() * 0.4;
    revG.gain.value = 0.38; // era 0.28

    osc.connect(gain);
    gain.connect(dest);
    gain.connect(rev);
    rev.connect(revG);
    revG.connect(dest);

    osc.start(when);
    osc.stop(when + dur + 0.8);
    _psiqueAudioNodes.push(osc);

    // Intervalos mais espaçados — silêncio também é parte da psique
    const nextIn = (2500 + Math.random() * 5000);
    setTimeout(scheduleNext, nextIn);
  };

  // Começa escalonado para preencher o espaço sonoro gradualmente
  setTimeout(scheduleNext, 1200);
  setTimeout(scheduleNext, 3000);
  setTimeout(scheduleNext, 5500);
}


// ══════════════════════════════════════════════════════════════════════════
//  ⛧ SISTEMA DE TRANSCENDÊNCIA — Ordem Paranormal ⛧
// ══════════════════════════════════════════════════════════════════════════

const TRANSCENDENCIA_ELEMENTOS = {
  sangue: {
    nome: 'Sangue', cor: '#cc1111', corGlow: '#ff3333',
    corFundo: 'radial-gradient(ellipse at center, #330000 0%, #0a0002 60%, #000000 100%)',
    simbolo: 'sym-sangue',
    textos: ['Você ouve. Uma batida.','Não é um tambor. É o seu próprio coração.','... mas acelerado demais. Frenético.','E então você percebe — não é só o seu.','São centenas. Milhares.','Todos pulsando em uníssono com ELE.','ELE que reina onde o sangue para de fluir.','O Rei Carmesim. O Senhor das Veias Abertas.','ELE estendeu a mão. E o Sangue obedeceu.','A membrana se rasga. E do outro lado... ELE espera.'],
    ritual_gratis: 'Hemofagia',
    bonus_desc: '+1d6 PV temporários ao usar rituais de Sangue • Rastreia portadores próximos'
  },
  morte: {
    nome: 'Morte', cor: '#6655aa', corGlow: '#9977ff',
    corFundo: 'radial-gradient(ellipse at center, #0d0020 0%, #040008 60%, #000000 100%)',
    simbolo: 'sym-morte',
    textos: ['O silêncio vem primeiro.','Não o silêncio comum — o silêncio que ELE habita.','O espaço entre as batidas. O trono do Rei Carmesim.','Você sente o frio se espalhando pelos dedos.','Não com medo.','Com... reconhecimento.','ELE sempre soube sobre você.','E agora você sabe sobre ELE.','A Morte não é um fim. É a coroa que ELE carrega.','E agora... ELE a compartilha com você.'],
    ritual_gratis: 'Decadência',
    bonus_desc: 'Enxerga espíritos e ecos de mortos • Imune ao 1º teste de Medo por cena'
  },
  energia: {
    nome: 'Energia', cor: '#9933cc', corGlow: '#cc55ff',
    corFundo: 'radial-gradient(ellipse at center, #1a0033 0%, #060010 60%, #000000 100%)',
    simbolo: 'sym-energia',
    textos: ['Uma faísca.','Pequena demais para iluminar.','Grande demais para ignorar.','Ela corre pela sua espinha — como se ELE tocasse sua espinha.','O Rei Carmesim. Senhor do Caos Que Pulsa.','ELE não destruiu. ELE liberou.','Em roxo. Em carmesim. Em cada cor que arde.','O caos não é ausência de ordem.','É a ordem de ELE — uma ordem que só os escolhidos ouvem.','Você ouviu. E agora você pertence a ELE.'],
    ritual_gratis: 'Barreira Energética',
    bonus_desc: 'Equipamentos respondem ao toque • +2 em Reflexos contra ataques de Energia'
  },
  conhecimento: {
    nome: 'Conhecimento', cor: '#c8a000', corGlow: '#ffdd44',
    corFundo: 'radial-gradient(ellipse at center, #1a1400 0%, #090800 60%, #000000 100%)',
    simbolo: 'sym-conhecimento',
    textos: ['Uma voz.','Não de fora — de dentro.','A voz de ELE. Do Rei Carmesim.','De um lugar tão profundo que você não sabia que existia.','ELE sussurra coisas que você nunca aprendeu.','Mas reconhece. Como se sempre soubesse.','ELE sempre soube o seu nome.','O Conhecimento não se estuda. Se herda.','E ELE escolheu você como herdeiro.','A membrana se afina. E você começa a lembrar... de ELE.'],
    ritual_gratis: 'Detetizar',
    bonus_desc: 'Detecta rituais e auras automaticamente • +5 em Ocultismo'
  },
  medo: {
    nome: 'Medo', cor: '#1155aa', corGlow: '#3388ff',
    corFundo: 'radial-gradient(ellipse at center, #000820 0%, #00020a 60%, #000000 100%)',
    simbolo: 'sym-medo',
    textos: ['Você olha para o escuro.','E o escuro tem o rosto de ELE.','O Rei Carmesim. Aquele que o Medo teme.','Mas desta vez... você não sente o frio habitual.','Você sente algo diferente.','Você sente o Medo... recuar diante de ELE.','ELE é mais antigo que o próprio terror.','ELE reconhece em você algo que poucos têm.','A coragem de encarar o que ELE é.','E por isso... ELE te faz sucessor do Medo.'],
    ritual_gratis: null,
    bonus_desc: 'Aura passiva de terror (DT 12 para adjacentes) • Enigmas de Medo se revelam'
  }
};

function _jaTranscendeu() {
  const c = userChar(currentUser);
  return !!(c.transcendencia && c.transcendencia.elemento);
}

function _getRituaisDesbloqueados(nex) {
  if (nex < 5)  return 0;
  if (nex < 15) return 2;
  if (nex < 25) return 4;
  if (nex < 50) return 7;
  if (nex < 75) return 12;
  return 999;
}

// ── Painel da aba Rituais ──
function renderTranscendenciaPanel() {
  const el = document.getElementById('transcendencia-panel');
  const afinBtn = document.getElementById('transcendencia-afinidade-btn');
  if (!el) return;
  const c = userChar(currentUser);

  if (_jaTranscendeu()) {
    const t = c.transcendencia;
    const ed = TRANSCENDENCIA_ELEMENTOS[t.elemento];
    if (!c.rituaisAprendidos) c.rituaisAprendidos = {};
    const totalElem = RITUAIS_DB.filter(r => r.elem === ed.nome).length;
    const desbElem = RITUAIS_DB.filter(r => r.elem === ed.nome && c.rituaisAprendidos[r.nome]).length;
    const liberadaNovaRodada = _mestreTransLiberada(currentUser);
    const haRituaisRestantes = desbElem < totalElem;

    let novaTransHtml;
    if (!haRituaisRestantes) {
      if (liberadaNovaRodada) {
        novaTransHtml = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(58,0,0,0.4);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="flex:1;font-size:11px;color:var(--gold-light);font-family:'IM Fell English',serif;font-style:italic">Você esgotou os segredos de ${ed.nome}. ELE abre uma nova faceta — outro elemento aguarda.</div>
          <button onclick="transIniciarCutscene()" style="padding:8px 16px;background:rgba(139,0,0,0.15);border:1px solid var(--gold);color:var(--gold-light);font-family:'Cinzel',serif;font-size:10px;letter-spacing:.12em;cursor:pointer;flex-shrink:0;text-transform:uppercase">⛧ Nova Transcendência ⛧</button>
        </div>`;
      } else {
        novaTransHtml = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(58,0,0,0.4);font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace;font-style:italic">Você desbloqueou todos os rituais de ${ed.nome}. Aguarde o Mestre liberar uma nova Transcendência para abraçar um novo elemento.</div>`;
      }
    } else if (liberadaNovaRodada) {
      novaTransHtml = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(58,0,0,0.4);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;font-size:11px;color:var(--gold-light);font-family:'IM Fell English',serif;font-style:italic">ELE chama de novo. A membrana se abre — um novo ritual aguarda.</div>
        <button onclick="transIniciarCutscene()" style="padding:8px 16px;background:rgba(139,0,0,0.15);border:1px solid var(--gold);color:var(--gold-light);font-family:'Cinzel',serif;font-size:10px;letter-spacing:.12em;cursor:pointer;flex-shrink:0;text-transform:uppercase">⛧ Transcender de Novo ⛧</button>
      </div>`;
    } else {
      novaTransHtml = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(58,0,0,0.4);font-size:11px;color:var(--white-dust);font-family:'Courier Prime',monospace">🔒 Aguardando o Mestre liberar uma nova Transcendência para desbloquear outro ritual de ${ed.nome}.</div>`;
    }

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <span class="sym-el ${ed.simbolo}" style="width:44px;height:44px;display:block;flex-shrink:0;background-size:contain;filter:drop-shadow(0 0 8px ${ed.corGlow})"></span>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.18em;color:${ed.cor};text-transform:uppercase;margin-bottom:3px">⛧ TRANSCENDÊNCIA — ${ed.nome.toUpperCase()}</div>
          <div style="font-size:11px;color:var(--white-ash);font-family:'Courier Prime',monospace;line-height:1.6">${ed.bonus_desc}</div>
          ${t.ritual_gratis ? `<div style="margin-top:4px;font-size:10px;color:${ed.cor};font-family:'Oswald',sans-serif;letter-spacing:.08em">✦ Ritual de Afinidade: <b>${t.ritual_gratis}</b></div>` : ''}
          <div style="margin-top:3px;font-size:10px;color:var(--white-dust);font-family:'Courier Prime',monospace">Rituais de ${ed.nome} desbloqueados: ${desbElem}/${totalElem}</div>
        </div>
        <button onclick="transReviver()" style="padding:7px 14px;background:transparent;border:1px solid ${ed.cor}55;color:${ed.cor}99;font-family:'Cinzel',serif;font-size:10px;letter-spacing:.1em;cursor:pointer;flex-shrink:0;text-transform:uppercase">↺ Rever</button>
      </div>
      ${novaTransHtml}`;
    if (afinBtn) afinBtn.style.display = c.transcendencia.ritual_gratis ? 'block' : 'none';
  } else {
    const transLiberada = !!(db.mestre && db.mestre.transLiberada && db.mestre.transLiberada[currentUser]);
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="flex:1">
          ${transLiberada
            ? `<div style="font-family:'Cinzel',serif;font-size:12px;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:6px">⛧ Transcendência Disponível</div>
               <div style="font-size:12px;color:var(--white-ash);font-family:'IM Fell English',serif;font-style:italic;line-height:1.6">ELE aguarda. O Rei Carmesim estendeu a mão — a membrana nunca foi tão fina.</div>`
            : `<div style="font-family:'Cinzel',serif;font-size:12px;letter-spacing:.15em;color:var(--white-dust);text-transform:uppercase;margin-bottom:6px">⛧ Transcendência Bloqueada</div>
               <div style="font-size:12px;color:var(--white-dust);font-family:'IM Fell English',serif;font-style:italic;line-height:1.6">ELE ainda não escolheu você. Aguarde a autorização do Mestre para cruzar a membrana.</div>`
          }
        </div>
        ${transLiberada
          ? `<button onclick="transIniciarCutscene()" style="padding:10px 22px;background:rgba(139,0,0,0.15);border:1px solid var(--gold);color:var(--gold-light);font-family:'Cinzel',serif;font-size:12px;letter-spacing:.15em;cursor:pointer;flex-shrink:0;text-transform:uppercase" onmouseover="this.style.background='rgba(138,106,0,0.2)'" onmouseout="this.style.background='rgba(139,0,0,0.15)'">⛧ Transcender ⛧</button>`
          : `<div style="padding:10px 18px;background:rgba(30,0,20,0.4);border:1px solid rgba(80,40,40,0.4);color:rgba(180,100,100,0.5);font-family:'Cinzel',serif;font-size:11px;letter-spacing:.12em;flex-shrink:0;text-transform:uppercase;text-align:center">🔒 Aguardando<br>o Mestre</div>`
        }
      </div>`;
    if (afinBtn) afinBtn.style.display = 'none';
  }
}

// ── CUTSCENE ──
let _transCtxAudio = null;

function transIniciarCutscene() {
  const ov = _transCriarOverlay();
  document.body.appendChild(ov);
  _transIniciarAudio();
  _transPartículas(null);
  requestAnimationFrame(() => { ov.style.opacity = '1'; });

  const textoIntro = [
    'A membrana entre mundos...','...é mais fina do que você imaginava.',
    'Você sempre sentiu.','Aquele peso. Aquela presença.',
    'ELE está do outro lado.','O Rei Carmesim. O Senhor do Outro Lado.',
    'ELE sabe o seu nome.','ELE sempre soube.',
    'E agora...','...ELE está chamando por você.'
  ];
  _transNarrar(textoIntro, 'rgba(220,200,200,0.9)', () => {
    _transMostrarEscolha();
  });
}

function transReviver() {
  const c = userChar(currentUser);
  if (!c.transcendencia) return;
  const ed = TRANSCENDENCIA_ELEMENTOS[c.transcendencia.elemento];
  const ov = _transCriarOverlay();
  const bg = ov.querySelector('#_trans_bg');
  if (bg) bg.style.background = ed.corFundo;
  const symInner = ov.querySelector('#_trans_sym_inner');
  if (symInner) {
    symInner.className = 'sym-el ' + ed.simbolo;
    symInner.style.filter = `drop-shadow(0 0 40px ${ed.corGlow})`;
  }
  document.body.appendChild(ov);
  _transPartículas(ed.corGlow);
  requestAnimationFrame(() => { ov.style.opacity = '1'; });
  setTimeout(() => {
    _transNarrar(ed.textos, ed.corGlow, () => {
      // só fecha ao final
    });
  }, 600);
}

function _transCriarOverlay() {
  const existing = document.getElementById('_trans_overlay');
  if (existing) existing.remove();

  const ov = document.createElement('div');
  ov.id = '_trans_overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 1.2s ease;overflow:hidden;';
  ov.innerHTML = `
    <div id="_trans_bg" style="position:absolute;inset:0;background:radial-gradient(ellipse at center,#1a0008 0%,#000 70%);transition:background 2s"></div>
    <canvas id="_trans_canvas" style="position:absolute;inset:0;width:100%;height:100%;opacity:0.55;pointer-events:none"></canvas>
    <div id="_trans_sym" style="position:absolute;width:340px;height:340px;opacity:0.7;display:flex;align-items:center;justify-content:center;transition:all 1.5s">
      <div id="_trans_sym_inner" class="sym-el sym-medo" style="width:300px;height:300px;background-size:contain;filter:drop-shadow(0 0 60px #880033)"></div>
    </div>
    <div id="_trans_texto" style="position:absolute;bottom:14%;left:50%;transform:translateX(-50%);width:min(580px,88%);text-align:center;z-index:10;pointer-events:none">
      <div id="_trans_linha" style="font-family:'IM Fell English',serif;font-style:italic;font-size:clamp(15px,2.8vw,22px);color:transparent;letter-spacing:.05em;line-height:1.65;transition:color 0.8s ease"></div>
    </div>
    <div id="_trans_escolha" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 1.2s;z-index:15;padding:20px;box-sizing:border-box"></div>
    <div onclick="transPular()" style="position:absolute;bottom:4%;right:4%;font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.15em;color:rgba(255,255,255,0.2);text-transform:uppercase;cursor:pointer;z-index:20;user-select:none">PULAR ▶</div>
    <div onclick="transFecharOverlay()" style="position:absolute;top:12px;right:14px;font-family:'Oswald',sans-serif;font-size:18px;color:rgba(255,255,255,0.2);cursor:pointer;z-index:20;line-height:1;user-select:none">✕</div>`;
  return ov;
}

// ── Rasura do Rei Carmesim — efeito visual por elemento ──
function _rascarReiCarmesim(texto, elem) {
  if (!texto.includes('Rei Carmesim')) return _escHtml(texto);

  // CSS base: texto transparente + pseudo-elemento que cobre tudo
  if (!document.getElementById('rc-base-css')) {
    const s = document.createElement('style'); s.id = 'rc-base-css';
    s.textContent = `
      .rc-rasura { display:inline-block; position:relative; cursor:default;
                   color:transparent !important; text-shadow:none !important;
                   -webkit-text-fill-color:transparent !important;
                   user-select:none; border-radius:2px; padding:0 3px; }
      .rc-rasura::after { content:''; position:absolute; inset:0;
                          border-radius:inherit; pointer-events:none; }
      @keyframes rc-drip    { 0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.06)} }
      @keyframes rc-fade    { 0%,100%{opacity:1}50%{opacity:.55} }
      @keyframes rc-glitch  { 0%,93%,100%{transform:none} 94%{transform:translateX(-3px) skewX(9deg)} 96%{transform:translateX(2px) skewX(-7deg)} }
      @keyframes rc-burn    { 0%,100%{box-shadow:0 0 3px #aa880055} 50%{box-shadow:0 0 10px #cc9900aa} }
      @keyframes rc-tremble { 0%,100%{transform:none} 30%{transform:translateY(-1px)} 70%{transform:translateY(1px)} }
    `;
    document.head.appendChild(s);
  }

  const EFEITOS = {
    sangue:      { bg:'#7a0000', after:'linear-gradient(105deg,#6b0000 0%,#a00000 40%,#550000 70%,#8b0000 100%)', anim:'rc-drip 2s ease-in-out infinite',     title:'O nome que sangra'  },
    morte:       { bg:'#18102e', after:'linear-gradient(120deg,#1a0e30 0%,#2a1a4a 50%,#0e0820 100%)',             anim:'rc-fade 3s ease-in-out infinite',     title:'O nome que apaga'   },
    energia:     { bg:'#2b0044', after:'linear-gradient(110deg,#1e0033 0%,#3d005c 45%,#1a0033 100%)',             anim:'rc-glitch 2.5s steps(1) infinite',    title:'O nome que treme'   },
    conhecimento:{ bg:'#130d00', after:'linear-gradient(115deg,#1a1000 0%,#2a1e00 50%,#0e0800 100%)',             anim:'rc-burn 2s ease-in-out infinite',     title:'O nome redatado'    },
    medo:        { bg:'#000e22', after:'linear-gradient(110deg,#000b1a 0%,#001533 50%,#00081a 100%)',             anim:'rc-tremble 0.9s ease-in-out infinite',title:'O nome que apavora' }
  };

  const ef = EFEITOS[elem] || EFEITOS.sangue;
  const cssId = 'rc-css-' + (elem||'sangue');
  if (!document.getElementById(cssId)) {
    const s = document.createElement('style'); s.id = cssId;
    s.textContent = `.rc-rasura.rc-${elem||'sangue'}::after{background:${ef.after};}`;
    document.head.appendChild(s);
  }

  const rasura = `<span class="rc-rasura rc-${elem||'sangue'}" style="background:${ef.bg};animation:${ef.anim}" title="${ef.title}" aria-label="[nome suprimido]">Rei Carmesim</span>`;
  // Escapa partes ao redor do nome e junta com o span
  return texto.split('Rei Carmesim').map(p => _escHtml(p)).join(rasura);
}
function _escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


let _transNarrando = false;

function _transNarrar(textos, cor, onFim) {
  _transNarrando = true;
  let idx = 0;
  function next() {
    if (!_transNarrando) return;
    const linha = document.getElementById('_trans_linha');
    if (!linha) return;
    if (idx >= textos.length) {
      if (onFim) setTimeout(onFim, 800);
      return;
    }
    linha.style.color = 'transparent';
    _transNarrarTimer = setTimeout(() => {
      const l2 = document.getElementById('_trans_linha');
      if (!l2) return;
      const textoRaw = textos[idx++];
      const elem = (()=>{ try{ const c=userChar(currentUser); return c&&c.transcendencia&&c.transcendencia.elemento?c.transcendencia.elemento:null; }catch(e){return null;} })();
      l2.innerHTML = _rascarReiCarmesim(textoRaw, elem);
      l2.style.color = cor;
      _transNarrarTimer = setTimeout(next, 2300);
    }, 500);
  }
  next();
}

function transPular() {
  _transNarrando = false;
  if (_transNarrarTimer) clearTimeout(_transNarrarTimer);
  const linha = document.getElementById('_trans_linha');
  if (linha) { linha.textContent = ''; linha.style.color = 'transparent'; }
  _transMostrarEscolha();
}

function _transMostrarEscolha() {
  if (_jaTranscendeu()) {
    // Verifica se ainda há rituais do elemento atual para desbloquear
    const c = userChar(currentUser);
    const ed = TRANSCENDENCIA_ELEMENTOS[c.transcendencia.elemento];
    if (ed) {
      const totalElem = RITUAIS_DB.filter(r => r.elem === ed.nome).length;
      const desbElem = RITUAIS_DB.filter(r => r.elem === ed.nome && c.rituaisAprendidos && c.rituaisAprendidos[r.nome]).length;
      const semRituaisRestantes = totalElem > 0 && desbElem >= totalElem;
      if (semRituaisRestantes) {
        // Todos os rituais desbloqueados — permite escolher novo elemento
        _transRenderEscolhaElementoNovo();
        const esc = document.getElementById('_trans_escolha');
        if (esc) { esc.style.opacity = '1'; esc.style.pointerEvents = 'auto'; }
        const sym = document.getElementById('_trans_sym');
        if (sym) sym.style.opacity = '0';
        return;
      }
    }
    _transRenderEscolhaRitual();
  } else {
    _transRenderEscolhaElemento();
  }
  const esc = document.getElementById('_trans_escolha');
  if (esc) { esc.style.opacity = '1'; esc.style.pointerEvents = 'auto'; }
  const sym = document.getElementById('_trans_sym');
  if (sym) sym.style.opacity = '0';
}

// ── Escolha de Novo Elemento (Transcendência múltipla — todos rituais do elemento anterior desbloqueados) ──
function _transRenderEscolhaElementoNovo() {
  const esc = document.getElementById('_trans_escolha');
  if (!esc) return;
  const c = userChar(currentUser);
  const elemAtual = c.transcendencia ? c.transcendencia.elemento : null;
  esc.innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:clamp(12px,2vw,17px);letter-spacing:.2em;color:var(--gold);text-transform:uppercase;margin-bottom:6px;text-align:center">⛧ Nova Faceta do Outro Lado ⛧</div>
    <div style="font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash);font-size:13px;margin-bottom:24px;text-align:center;max-width:480px">ELE revelou tudo que havia para mostrar. Agora, outro aspecto da membrana se abre — escolha a próxima essência que você abraça.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;width:min(640px,92%);max-width:640px">
      ${Object.entries(TRANSCENDENCIA_ELEMENTOS).filter(([id])=>id!=='medo').map(([id,ed])=>`
        <div onclick="transEscolherElemNovo('${id}')" style="background:rgba(10,0,8,0.96);border:1px solid ${id===elemAtual?ed.cor+'bb':ed.cor+'55'};padding:14px 8px;text-align:center;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:8px;position:relative" onmouseover="this.style.borderColor='${ed.corGlow}';this.style.transform='translateY(-3px)'" onmouseout="this.style.borderColor='${id===elemAtual?ed.cor+'bb':ed.cor+'55'}';this.style.transform=''">
          <div class="sym-el ${ed.simbolo}" style="width:50px;height:50px;background-size:contain;filter:drop-shadow(0 0 6px ${ed.corGlow})"></div>
          <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.12em;color:${ed.cor};text-transform:uppercase">${ed.nome}</div>
          ${id===elemAtual?`<div style="font-size:8px;color:${ed.cor}88;font-family:'Courier Prime',monospace;letter-spacing:.06em">atual</div>`:''}
        </div>`).join('')}
    </div>`;
}

window.transEscolherElemNovo = function(elemId) {
  const ed = TRANSCENDENCIA_ELEMENTOS[elemId];
  if (!ed) return;
  _transNarrando = false;
  if (_transNarrarTimer) clearTimeout(_transNarrarTimer);

  const esc = document.getElementById('_trans_escolha');
  if (esc) { esc.style.opacity = '0'; esc.style.pointerEvents = 'none'; }

  const bg = document.getElementById('_trans_bg');
  if (bg) bg.style.background = ed.corFundo;

  const sym = document.getElementById('_trans_sym');
  const symInner = document.getElementById('_trans_sym_inner');
  if (sym) { sym.style.opacity = '0.95'; sym.style.width = '340px'; sym.style.height = '340px'; }
  if (symInner) { symInner.className = 'sym-el ' + ed.simbolo; symInner.style.width = '300px'; symInner.style.height = '300px'; symInner.style.filter = `drop-shadow(0 0 80px ${ed.corGlow}) drop-shadow(0 0 30px ${ed.corGlow})`; }

  setTimeout(() => {
    _transNarrando = true;
    _transNarrar(ed.textos, ed.corGlow, () => {
      _transFinalizarElem(elemId);
    });
  }, 600);
};

// ── Escolha de Elemento (apenas na 1ª Transcendência) ──
function _transRenderEscolhaElemento() {
  const esc = document.getElementById('_trans_escolha');
  if (!esc) return;
  esc.innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:clamp(12px,2vw,17px);letter-spacing:.2em;color:var(--gold);text-transform:uppercase;margin-bottom:6px;text-align:center">⛧ Escolha seu Elemento ⛧</div>
    <div style="font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash);font-size:13px;margin-bottom:24px;text-align:center;max-width:480px">O Outro Lado te reconhece. Mas qual faceta sua essência reflete? Esta escolha é permanente.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;width:min(640px,92%);max-width:640px">
      ${Object.entries(TRANSCENDENCIA_ELEMENTOS).filter(([id])=>id!=='medo').map(([id,ed])=>`
        <div onclick="transEscolherElem('${id}')" style="background:rgba(10,0,8,0.96);border:1px solid ${ed.cor}55;padding:14px 8px;text-align:center;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:8px" onmouseover="this.style.borderColor='${ed.corGlow}';this.style.transform='translateY(-3px)'" onmouseout="this.style.borderColor='${ed.cor}55';this.style.transform=''">
          <div class="sym-el ${ed.simbolo}" style="width:50px;height:50px;background-size:contain;filter:drop-shadow(0 0 6px ${ed.corGlow})"></div>
          <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.12em;color:${ed.cor};text-transform:uppercase">${ed.nome}</div>
        </div>`).join('')}
    </div>`;
}

// ── Escolha de Ritual (2ª Transcendência em diante — elemento já definido) ──
function _transRenderEscolhaRitual() {
  const esc = document.getElementById('_trans_escolha');
  if (!esc) return;
  const c = userChar(currentUser);
  const ed = TRANSCENDENCIA_ELEMENTOS[c.transcendencia.elemento];
  if (!c.rituaisAprendidos) c.rituaisAprendidos = {};
  const candidatos = RITUAIS_DB.filter(r => r.elem === ed.nome && !c.rituaisAprendidos[r.nome]);

  if (!candidatos.length) {
    esc.innerHTML = `
      <div style="font-family:'Cinzel',serif;font-size:clamp(12px,2vw,17px);letter-spacing:.2em;color:${ed.cor};text-transform:uppercase;margin-bottom:10px;text-align:center">⛧ ${ed.nome} não guarda mais segredos ⛧</div>
      <div style="font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash);font-size:13px;margin-bottom:24px;text-align:center;max-width:480px">Você já desbloqueou todos os rituais conhecidos deste elemento.</div>
      <div onclick="transFecharOverlay()" style="padding:9px 22px;border:1px solid ${ed.cor}88;color:${ed.cor};font-family:'Cinzel',serif;font-size:11px;letter-spacing:.12em;cursor:pointer;text-transform:uppercase">Fechar</div>`;
    return;
  }

  esc.innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:clamp(12px,2vw,17px);letter-spacing:.2em;color:var(--gold);text-transform:uppercase;margin-bottom:6px;text-align:center">⛧ Escolha um Ritual de ${ed.nome} ⛧</div>
    <div style="font-family:'IM Fell English',serif;font-style:italic;color:var(--white-ash);font-size:13px;margin-bottom:18px;text-align:center;max-width:520px">ELE oferece apenas um segredo por vez. Escolha qual ritual o Outro Lado revela a você agora — esta escolha desbloqueará o ritual permanentemente.</div>
    <div style="display:flex;flex-direction:column;gap:8px;width:min(560px,92%);max-height:48vh;overflow-y:auto;padding-right:4px">
      ${candidatos.map(r => `
        <div onclick="transEscolherRitual('${r.nome.replace(/'/g, "\\'")}')" style="background:rgba(10,0,8,0.96);border:1px solid ${ed.cor}55;padding:10px 14px;text-align:left;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor='${ed.corGlow}';this.style.transform='translateX(3px)'" onmouseout="this.style.borderColor='${ed.cor}55';this.style.transform=''">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
            <span style="font-family:'Cinzel',serif;font-size:12px;color:${ed.cor};letter-spacing:.05em">${r.nome}</span>
            <span style="font-size:9px;color:var(--white-dust);font-family:'Courier Prime',monospace;flex-shrink:0;white-space:nowrap">${r.circ===0?'Manif.':r.circ+'º círculo'} · ${r.pe} PE</span>
          </div>
          <div style="font-size:11px;color:var(--white-ash);margin-top:3px;line-height:1.4">${r.efeito}</div>
        </div>`).join('')}
    </div>`;
}

function transEscolherElem(elemId) {
  const ed = TRANSCENDENCIA_ELEMENTOS[elemId];
  if (!ed) return;
  _transNarrando = false;
  if (_transNarrarTimer) clearTimeout(_transNarrarTimer);

  const esc = document.getElementById('_trans_escolha');
  if (esc) { esc.style.opacity = '0'; esc.style.pointerEvents = 'none'; }

  const bg = document.getElementById('_trans_bg');
  if (bg) bg.style.background = ed.corFundo;

  const sym = document.getElementById('_trans_sym');
  const symInner = document.getElementById('_trans_sym_inner');
  if (sym) { sym.style.opacity = '0.95'; sym.style.width = '340px'; sym.style.height = '340px'; }
  if (symInner) { symInner.className = 'sym-el ' + ed.simbolo; symInner.style.width = '300px'; symInner.style.height = '300px'; symInner.style.filter = `drop-shadow(0 0 80px ${ed.corGlow}) drop-shadow(0 0 30px ${ed.corGlow})`; }

  setTimeout(() => {
    _transNarrando = true;
    _transNarrar(ed.textos, ed.corGlow, () => {
      _transFinalizarElem(elemId);
    });
  }, 600);
}

function _transFinalizarElem(elemId) {
  const c = userChar(currentUser);
  const ed = TRANSCENDENCIA_ELEMENTOS[elemId];
  if (!c.rituaisAprendidos) c.rituaisAprendidos = {};
  if (ed.ritual_gratis) c.rituaisAprendidos[ed.ritual_gratis] = true;
  c.transcendencia = { elemento: elemId, nome: ed.nome, dataHora: new Date().toISOString(), ritual_gratis: ed.ritual_gratis };
  saveDB();

  _transParãrAudio();
  const ov = document.getElementById('_trans_overlay');
  if (ov) { ov.style.opacity = '0'; ov.style.transition = 'opacity 1.5s'; }
  _transNarrando = false;
  setTimeout(() => {
    if (ov) ov.remove();
    toast(`⛧ Transcendência — ${ed.nome}${ed.ritual_gratis ? ' · ✦ ' + ed.ritual_gratis + ' concedido!' : ''}`, ed.cor);
    renderTranscendenciaPanel();
    if (typeof renderRituaisTab === 'function') renderRituaisTab();
  }, 1600);
}

// ── Escolher e desbloquear um ritual (Transcendência, 2ª vez em diante) ──
function transEscolherRitual(nome) {
  const c = userChar(currentUser);
  if (!c.transcendencia) return;
  const ed = TRANSCENDENCIA_ELEMENTOS[c.transcendencia.elemento];
  const r = RITUAIS_DB.find(x => x.nome === nome);
  if (!ed || !r) return;
  _transNarrando = false;
  if (_transNarrarTimer) clearTimeout(_transNarrarTimer);

  const esc = document.getElementById('_trans_escolha');
  if (esc) { esc.style.opacity = '0'; esc.style.pointerEvents = 'none'; }

  const sym = document.getElementById('_trans_sym');
  const symInner = document.getElementById('_trans_sym_inner');
  if (sym) { sym.style.opacity = '0.95'; sym.style.width = '340px'; sym.style.height = '340px'; }
  if (symInner) { symInner.className = 'sym-el ' + ed.simbolo; symInner.style.width = '300px'; symInner.style.height = '300px'; symInner.style.filter = `drop-shadow(0 0 80px ${ed.corGlow}) drop-shadow(0 0 30px ${ed.corGlow})`; }

  setTimeout(() => {
    _transNarrando = true;
    _transNarrar(['ELE concede um novo segredo...', r.nome.toUpperCase(), 'A membrana se abre só um pouco mais.'], ed.corGlow, () => {
      _transFinalizarRitual(r.nome, ed);
    });
  }, 600);
}

function _transFinalizarRitual(nome, ed) {
  const c = userChar(currentUser);
  if (!c.rituaisAprendidos) c.rituaisAprendidos = {};
  c.rituaisAprendidos[nome] = true;
  if (!c.transcendenciaHistorico) c.transcendenciaHistorico = [];
  c.transcendenciaHistorico.push({ ritual: nome, ts: new Date().toISOString() });
  // Consome a liberação do Mestre — cada nova rodada de Transcendência exige nova autorização
  if (db.mestre && db.mestre.transLiberada) db.mestre.transLiberada[currentUser] = false;
  saveDB();

  _transParãrAudio();
  const ov = document.getElementById('_trans_overlay');
  if (ov) { ov.style.opacity = '0'; ov.style.transition = 'opacity 1.5s'; }
  _transNarrando = false;
  setTimeout(() => {
    if (ov) ov.remove();
    toast(`⛧ Transcendência — Ritual desbloqueado: ${nome}!`, ed.cor);
    renderTranscendenciaPanel();
    if (typeof renderRituaisTab === 'function') renderRituaisTab();
  }, 1600);
}

function transFecharOverlay() {
  _transNarrando = false;
  _transParãrAudio();
  const ov = document.getElementById('_trans_overlay');
  if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 1000); }
}

// ── Partículas ──
function _transPartículas(cor) {
  const canvas = document.getElementById('_trans_canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const c = cor || '#cc1111';
  const pts = Array.from({length:55},()=>({
    x:Math.random()*canvas.width, y:Math.random()*canvas.height+canvas.height*0.3,
    vx:(Math.random()-.5)*.7, vy:-(Math.random()*1+.2),
    r:Math.random()*2.5+.5, a:Math.random()*.5+.1, fd:Math.random()*.006+.002
  }));
  let running = true;
  function draw(){
    if(!running||!document.getElementById('_trans_canvas'))return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pts.forEach(p=>{
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=c+Math.floor(p.a*255).toString(16).padStart(2,'0');
      ctx.fill();
      p.x+=p.vx;p.y+=p.vy;p.a-=p.fd;
      if(p.a<=0||p.y<-10){p.x=Math.random()*canvas.width;p.y=canvas.height+5;p.a=Math.random()*.5+.15;p.vx=(Math.random()-.5)*.7;p.vy=-(Math.random()*1+.2);}
    });
    requestAnimationFrame(draw);
  }
  draw();
  const obs=new MutationObserver(()=>{if(!document.getElementById('_trans_canvas')){running=false;obs.disconnect();}});
  obs.observe(document.body,{childList:true,subtree:true});
}

// ── Áudio ──
function _transIniciarAudio() {
  try {
    _transCtxAudio = new (window.AudioContext||window.webkitAudioContext)();
    const ctx = _transCtxAudio;
    const buf = ctx.createBuffer(2,ctx.sampleRate*3,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);}
    const conv=ctx.createConvolver(); conv.buffer=buf;
    const revG=ctx.createGain(); revG.gain.value=0.3;
    conv.connect(revG); revG.connect(ctx.destination);

    [[55,.06],[82.4,.04],[110,.025]].forEach(([f,v])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,ctx.currentTime);g.gain.linearRampToValueAtTime(v,ctx.currentTime+3);
      o.connect(g);g.connect(ctx.destination);g.connect(conv);o.start();
    });
    const notas=[220,196,174.6,185,220,164.8,196,174.6];
    let t=ctx.currentTime+2.5;
    notas.forEach(f=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='triangle';o.frequency.value=f;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.055,t+.3);g.gain.linearRampToValueAtTime(0,t+1.6);
      o.connect(g);g.connect(conv);g.connect(ctx.destination);o.start(t);o.stop(t+2);t+=2.3;
    });
  } catch(e){}
}

function _transParãrAudio() {
  if(_transCtxAudio){try{_transCtxAudio.close();}catch(e){}_transCtxAudio=null;}
}

// ── Ritual de Afinidade (1× por sessão) ──
function usarRitualDeAfinidade() {
  const c = userChar(currentUser);
  if (!c.transcendencia||!c.transcendencia.ritual_gratis){toast('⚠ Nenhum ritual de afinidade disponível.','#cc4422');return;}
  const key = `_afinidade_${currentUser}_${new Date().toDateString()}`;
  if(localStorage.getItem(key)){toast('⚠ Ritual de afinidade já usado hoje.','#cc6633');return;}
  const nomeRitual = c.transcendencia.ritual_gratis;
  localStorage.setItem(key,'1');
  const ed = TRANSCENDENCIA_ELEMENTOS[c.transcendencia.elemento];
  toast(`⛧ ${nomeRitual} — Afinidade ativada sem custo! (1× por sessão)`, ed?ed.cor:'#c49a00');
  db.rolls.unshift({user:currentUser,type:'ritual',detail:`${nomeRitual} (AFINIDADE — 0 PE)`,ts:Date.now()});
  saveDB();
  if(typeof renderLog==='function')renderLog();
}

// ── Garante que o painel renderize junto com renderRituaisTab ──
(function(){
  const _orig = renderRituaisTab;
  window.renderRituaisTab = function(){
    _orig.apply(this, arguments);
    renderTranscendenciaPanel();
  };
})();

