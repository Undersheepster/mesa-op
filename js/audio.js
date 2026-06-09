const appAudio = {};
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


appMestre._ctx = _ctx;
appMestre._doFbConnect = _doFbConnect;
appMestre._drawStatePreview = _drawStatePreview;
appMestre._initCtx = _initCtx;
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
appMestre.playClick = playClick;
appMestre.playHover = playHover;
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
appMestre.updateMapToolbarVisibility = updateMapToolbarVisibility;
Object.assign(window, appMestre);

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


appAudio._bass = _bass;
appAudio._bell = _bell;
appAudio._boot = _boot;
appAudio._brush = _brush;
appAudio._drumPattern = _drumPattern;
appAudio._makeReverb = _makeReverb;
appAudio._modulateDrones = _modulateDrones;
appAudio._pad = _pad;
appAudio._pianoChord = _pianoChord;
appAudio._pianoNote = _pianoNote;
appAudio._scheduleSection = _scheduleSection;
appAudio._setCursorScale = _setCursorScale;
appAudio._startAmbience = _startAmbience;
appAudio._tick = _tick;
appAudio._voxWhisper = _voxWhisper;
appAudio.playTyping = playTyping;
Object.assign(window, appAudio);

appAudio._bass = _bass;
appAudio._bell = _bell;
appAudio._boot = _boot;
appAudio._brush = _brush;
appAudio._ctx = _ctx;
appAudio._drumPattern = _drumPattern;
appAudio._makeReverb = _makeReverb;
appAudio._modulateDrones = _modulateDrones;
appAudio._pad = _pad;
appAudio._pianoChord = _pianoChord;
appAudio._pianoNote = _pianoNote;
appAudio._scheduleSection = _scheduleSection;
appAudio._setCursorScale = _setCursorScale;
appAudio._startAmbience = _startAmbience;
appAudio._tick = _tick;
Object.assign(window, );
