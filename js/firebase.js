const appFirebase = {};
// ══════════════════════════════════════════════
//  FIREBASE — REST API + SSE
// ══════════════════════════════════════════════

function _fbCfg(){
  try { return JSON.parse(localStorage.getItem('op_firebase_config') || 'null'); } catch(e){ return null; }
}
function _fbBase(){
  const c = _fbCfg();
  return c && c.databaseURL ? c.databaseURL.replace(/\/$/, '') : null;
}

// PUT simples — sem AbortController (confiável)
async function _fbPut(path, data){
  const base = _fbBase(); if(!base) return null;
  try{
    const r = await fetch(base + '/' + path + '.json', {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    return r.ok ? r.json() : null;
  }catch(e){ return null; }
}

async function _fbDelete(path){
  const base = _fbBase(); if(!base) return;
  try{ await fetch(base + '/' + path + '.json', { method: 'DELETE' }); }catch(e){}
}

async function _fbGet(path){
  const base = _fbBase(); if(!base) return null;
  try {
    const r = await fetch(base + '/' + path + '.json');
    if(!r.ok) return null;
    return await r.json();
  } catch(e){ return null; }
}

// SSE — push real do Firebase
const _sseConnections = {};
function _fbSSE(path, cb){
  const base = _fbBase(); if(!base) return;
  if(_sseConnections[path]){ try{ _sseConnections[path].close(); }catch(e){} }
  const es = new EventSource(base + '/' + path + '.json');
  _sseConnections[path] = es;
  let _localState = null; // mantém estado completo do nó
  es.addEventListener('put', e => {
    try{
      const msg = JSON.parse(e.data);
      if(msg.path === '/'){
        _localState = msg.data; // replace total
      } else {
        // update parcial por path (ex: "/ts")
        if(!_localState) _localState = {};
        const parts = msg.path.replace(/^\//,'').split('/');
        let obj = _localState;
        for(let i=0;i<parts.length-1;i++){
          if(!obj[parts[i]]) obj[parts[i]]={};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length-1]] = msg.data;
      }
      cb(_localState);
    }catch(err){}
  });
  es.addEventListener('patch', e => {
    try{
      const msg = JSON.parse(e.data);
      if(!_localState) _localState = {};
      // patch: merge no path indicado
      Object.assign(_localState, msg.data || {});
      cb(_localState);
    }catch(err){}
  });
  es.onerror = () => {
    try{ es.close(); }catch(e){}
    delete _sseConnections[path];
    setTimeout(()=>_fbSSE(path, cb), 3000);
  };
}

// POLL
const _polls = {};
function _fbPoll(path, cb, ms){
  if(_polls[path]) clearInterval(_polls[path]);
  const run = async () => { cb(await _fbGet(path)); };
  run();
  _polls[path] = setInterval(run, ms || 4000);
}

// ── PRESENÇA ──
window.fbSetPresence = async function(user, isMestre){
  const base = _fbBase(); if(!base) return;
  await _fbPut('presence/' + user, { user, isMestre: !!isMestre, since: Date.now(), online: true });
  window.addEventListener('beforeunload', () => {
    const b = _fbBase();
    if(b) navigator.sendBeacon(b + '/presence/' + user + '.json',
      new Blob([JSON.stringify(null)], {type:'application/json'}));
  });
};
window.fbRemovePresence = async function(user){ await _fbDelete('presence/' + user); };
window.fbWatchPresence = function(cb){ _fbPoll('presence', d => cb(d || {}), 4000); };
window.fbWatchConnection = function(cb){
  const check = async () => {
    const base = _fbBase(); if(!base){ cb(false); return; }
    try { cb((await fetch(base+'/presence.json?shallow=true',{cache:'no-store'})).ok); }
    catch(e){ cb(false); }
  };
  check(); setInterval(check, 10000);
};

// ── BROADCAST ──
window.fbBroadcast = async function(msg, from){ await _fbPut('broadcast',{msg,from,ts:Date.now()}); };
window.fbWatchBroadcast = function(cb){
  let last=0; _fbPoll('broadcast', d=>{ if(d&&d.ts>last){last=d.ts;cb(d);} }, 4000);
};

// ── KICK ──
window.fbKick = async function(user){
  // Grava o kick E remove a presença imediatamente
  await Promise.all([
    _fbPut('kicks/'+user, {ts:Date.now()}),
    _fbDelete('presence/'+user)
  ]);
};
window.fbWatchKick = function(user, cb){
  // Usa SSE para resposta instantânea ao invés de polling
  let fired=false;
  _fbSSE('kicks/'+user, d=>{
    if(d && d.ts && !fired){ fired=true; cb(); }
  });
};

// ── GAMEDATA ──
let _saveDbTimer=null;
window.fbSaveDB = function(dbObj){
  clearTimeout(_saveDbTimer);
  _saveDbTimer = setTimeout(()=>{
    _fbPut('gamedata',{
      users: dbObj.users||{},
      characters: dbObj.characters||{},
      rolls: dbObj.rolls||{},
      mestre: dbObj.mestre||{},
      mapbg: (dbObj.maps&&dbObj.maps['shared'])||null,
      mapbgTs: Date.now()
    });
  }, 1500);
};
window.fbWatchDB = function(cb){
  let last=''; _fbPoll('gamedata', d=>{
    if(!d) return; const s=JSON.stringify(d);
    if(s!==last){last=s;cb(d);}
  }, 5000);
};
window.fbLoadDB = async function(){ return await _fbGet('gamedata'); };

// ── MAPA: mapstate (tokens+structs) via SSE push ──
// Durante drag: PUT imediato a cada mousemove (movimento real-time para outros players)
// Fora de drag: throttle leve de 80ms para evitar spam em operações em batch
let _msTimer=null, _msPending=null, _msLastSent=0, _msSending=false;
window.fbSaveMap = function(mapKey, mapData){
  if(mapKey==='bg'){
    _fbPut('mapbg',{data:mapData.data||'',ts:mapData.ts||Date.now(),sid:mapData.sid||''});
    return;
  }
  const payload = { tokens:mapData.tokens||'[]', structs:mapData.structs||'[]', ts:mapData.ts||Date.now(), sid:mapData.sid||'' };
  const flush = window.fbSaveMap._flush;
  window.fbSaveMap._flush = false;
  clearTimeout(_msTimer);

  // Drag ativo ou flush explícito → PUT imediato, sem esperar
  if(draggingToken || draggingStruct || flush){
    _msLastSent = Date.now();
    _fbPut('mapstate', payload);
    return;
  }
  // Fora de drag → throttle 80ms
  _msPending = payload;
  const wait = Math.max(0, 80-(Date.now()-_msLastSent));
  _msTimer = setTimeout(()=>{
    _msLastSent = Date.now();
    _fbPut('mapstate', _msPending);
    _msPending = null;
  }, wait);
};

window.fbWatchMap = function(cb){
  let lastTs=0;
  const wrapped = data => {
    if(!data) return;
    if(!data.ts){ cb(data); return; } // sem ts: passa sempre
    if(data.ts < lastTs - 5000) lastTs=0; // reconexão: reseta
    if(data.ts <= lastTs) return;
    lastTs=data.ts; cb(data);
  };
  // Guarda o wrapped para reconexão
  window._fbWatchMapCb = wrapped;
  _fbSSE('mapstate', wrapped);
};
window.fbWatchBg = function(cb){
  let lastTs=0;
  const wrapped = data => {
    if(!data || !data.ts) return;
    if(data.ts < lastTs - 5000) lastTs=0;
    if(data.ts <= lastTs) return;
    lastTs=data.ts; cb(data);
  };
  _fbSSE('mapbg', wrapped);
};

window.fbTestConfig = async function(cfg){
  try {
    const r = await fetch(cfg.databaseURL.replace(/\/$/,'')+'/presence.json?shallow=true');
    return r.ok ? {ok:true} : {ok:false,err:'HTTP '+r.status};
  } catch(e){ return {ok:false,err:e.message}; }
};

window._fbReady = true;
window.dispatchEvent(new CustomEvent('fb-module-ready'));


appFirebase._fbBase = _fbBase;
appFirebase._fbCfg = _fbCfg;
appFirebase._fbDelete = _fbDelete;
appFirebase._fbGet = _fbGet;
appFirebase._fbPoll = _fbPoll;
appFirebase._fbPut = _fbPut;
appFirebase._fbSSE = _fbSSE;
Object.assign(window, appFirebase);
