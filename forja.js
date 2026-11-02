/* ════════════════════════════════════════════════════════════
   FORJA.JS — Forja de Armas/Itens + Escrita de Rituais (núcleo)
   ────────────────────────────────────────────────────────────
   Substitui o antigo modal "Criar" (que gerava itens só em
   memória). Agora:
   • Criações são salvas na ficha (c.customItens / c.customRituais),
     sincronizam com o Supabase e sobrevivem a recarregar a página.
   • Cada criação entra em ITENS_DB / RITUAIS_DB (só do usuário
     atual, marcadas com _custom) — assim todo o resto do app
     (inventário, ataques, aba Danos, grimório) continua funcionando.
   • Tudo é editável depois (biblioteca), duplicável e exportável.

   Carregar DEPOIS de app.js / ficha.js / dano-rituais.js /
   danos-tab.js. O formulário de rituais está em forja-ritual.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ───────── utilitários ───────── */
const E = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanName = s => String(s==null?'':s).replace(/[<>"\\]/g,'').replace(/\s+/g,' ').trim();
const cleanTxt  = s => String(s==null?'':s).replace(/[<>]/g,'').trim();
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => 'custom_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const getP = (o,p) => p.split('.').reduce((a,k)=>a==null?a:a[k], o);
const setP = (o,p,v) => { const ks=p.split('.'); let a=o; for(let i=0;i<ks.length-1;i++){ if(a[ks[i]]==null) a[ks[i]]={}; a=a[ks[i]]; } a[ks[ks.length-1]]=v; };
const rgb = h => (typeof hexToRgb==='function') ? hexToRgb(h) : '200,60,40';
const toastF = (m,c)=>{ if(typeof toast==='function') toast(m,c); };
const curChar = () => (typeof userChar==='function' && currentUser) ? userChar(currentUser) : null;

/* ───────── dados ───────── */
const DICE_RE = /^\s*(\d+d\d+|\d+)(\s*[+-]\s*(\d+d\d+|\d+))*\s*$/i;
function diceStats(expr, mult){
  expr = String(expr||'').trim();
  if(!expr || !DICE_RE.test(expr)) return null;
  mult = mult||1;
  const re=/([+-]?)\s*(\d+)(?:d(\d+))?/gi; let m, min=0,max=0,avg=0,dice=0;
  while((m=re.exec(expr.replace(/\s+/g,'')))){
    const sg = m[1]==='-'?-1:1;
    if(m[3]){ const n=+m[2]*mult, f=+m[3]; dice+=n; if(sg>0){min+=n;max+=n*f;avg+=n*(f+1)/2;} else {min-=n*f;max-=n;avg-=n*(f+1)/2;} }
    else { const v=sg*(+m[2]); min+=v;max+=v;avg+=v; }
  }
  return {min:Math.max(0,min),max:Math.max(0,max),avg:Math.max(0,avg),dice};
}
const LADDER = ['1d3','1d4','1d6','1d8','1d10','1d12','2d6','2d8','2d10','2d12','3d8','3d10','4d8','4d10','5d8','6d8','6d10','8d10','10d10'];
function ladderShift(expr, d){
  const i = LADDER.indexOf(String(expr).trim());
  if(i<0){ // expressão fora da escada: soma/subtrai bônus fixo
    const m = String(expr).trim().match(/^(.*?)([+-]\d+)?$/);
    const flat = (parseInt(m&&m[2])||0)+d;
    return (m&&m[1]||expr)+(flat?(flat>0?'+':'')+flat:'');
  }
  return LADDER[Math.max(0,Math.min(LADDER.length-1,i+d))];
}
/* Rola uma expressão multiplicando só a quantidade de DADOS (crítico). */
function rollExpr(expr, mult){
  mult = mult||1;
  const s = String(expr||'').replace(/\s+/g,'');
  const re=/([+-]?)(\d+)(?:d(\d+))?/gi; let m,total=0; const rolls=[];
  while((m=re.exec(s))){
    const sg = m[1]==='-'?-1:1;
    if(m[3]){ const n=(+m[2])*mult, f=+m[3]; for(let i=0;i<n;i++){ const r=Math.floor(Math.random()*f)+1; rolls.push(r); total+=sg*r; } }
    else total+=sg*(+m[2]);
  }
  return {total:Math.max(0,total),rolls};
}
function parseCrit(s){
  let m=20,x=2;
  String(s||'').split('/').forEach(p=>{ p=p.trim(); if(/^x\d+$/i.test(p)) x=+p.slice(1); else if(/^\d+$/.test(p)) m=+p; });
  return {m,x};
}
function fmtCrit(m,x){
  if(m>=20) return 'x'+x;
  return x===2 ? String(m) : m+'/x'+x;
}

/* ───────── tabelas do assistente (herdadas do criador antigo) ───────── */
const CATS = ['0','I','II','III','IV','V'];
const catShift = (b,mod)=> CATS[Math.max(0,Math.min(CATS.length-1, CATS.indexOf(String(b))+mod))];
const BASE = {
  leve:   { branca:{dam:'1d4', m:19,x:2,esp:1,maos:'1',cat:'0'},  fogo:{dam:'1d10',m:18,x:2,esp:1,maos:'1',cat:'I'} },
  media:  { branca:{dam:'1d8', m:19,x:2,esp:1,maos:'1',cat:'I'},  fogo:{dam:'2d6', m:19,x:2,esp:2,maos:'2',cat:'I'} },
  pesada: { branca:{dam:'1d10',m:20,x:3,esp:2,maos:'2',cat:'I'},  fogo:{dam:'2d10',m:19,x:2,esp:2,maos:'2',cat:'II'} },
};
const PROP = {
  equilibrada:{l:'Equilibrada',dm:0,cm:0,d:'Sem ajustes'},
  precisa:    {l:'Precisa',dm:-1,cm:1,d:'−1 dado · margem de crítico −1'},
  brutal:     {l:'Brutal',dm:1,cm:0,d:'+1 degrau de dano',hab:{nome:'Golpe Brutal',desc:'Em acerto crítico, ignora metade da RD do alvo.'}},
  rapida:     {l:'Rápida',dm:-1,cm:0,d:'−1 degrau · ágil',hab:{nome:'Ágil',desc:'Arma leve e precisa. Luta e Pontaria usam o mesmo atributo (Físico), então não há troca de atributo no ataque.'}},
  arremesso:  {l:'Arremesso',dm:0,cm:0,d:'Alcance curto',alc:'Curto',hab:{nome:'Arremesso',desc:'Pode ser arremessada como ataque à distância (alcance curto). Após o arremesso, a arma cai no chão.'}},
};
const MAT = {
  comum:{l:'Comum',dm:0,cm:0,cat:0},
  refinado:{l:'Refinado',dm:0,cm:1,cat:1},
  pesado:{l:'Pesado',dm:1,cm:0,cat:1},
  paranormal:{l:'Paranormal',dm:0,cm:0,cat:1,hab:{nome:'Essência Paranormal',desc:'O dano conta como paranormal para fins de imunidades e resistências.'}},
  improvisado:{l:'Improvisado',dm:-1,cm:0,cat:-1},
};
const ARM_BASE = { minima:{def:1,rd:1,esp:1,cat:'0'}, leve:{def:3,rd:2,esp:2,cat:'0'}, media:{def:5,rd:4,esp:3,cat:'I'}, completa:{def:8,rd:6,esp:5,cat:'II'} };
const ARM_MAT  = { couro:{rd:0,cat:0}, kevlar:{rd:1,cat:0}, metal:{rd:2,cat:1}, paranormal:{rd:1,cat:1} };

const HAB_MODELOS = [
  {nome:'Arremesso',desc:'Pode ser arremessada como ataque à distância (alcance curto). Após o arremesso, a arma cai no chão.'},
  {nome:'Ágil',desc:'Arma leve e precisa. Luta e Pontaria usam o mesmo atributo (Físico), então não há troca de atributo no ataque.'},
  {nome:'Oculta',desc:'Pode ser escondida no corpo. +5 em testes para ocultar a arma.'},
  {nome:'Silenciosa',desc:'Não faz barulho perceptível. Ideal para furtividade.'},
  {nome:'Sangramento',desc:'Em acerto crítico, a vítima sangra: +1d4 de dano no início de cada turno dela até receber cuidados.'},
  {nome:'Perfurante',desc:'Ignora 2 pontos de RD do alvo.'},
  {nome:'Rajada',desc:'Gasta 3 munições para atacar com +2 no teste e +1 dado de dano.'},
  {nome:'Recarga Lenta',desc:'Recarregar custa uma ação completa.'},
  {nome:'Alongada',desc:'Ataca alvos a até 3m de distância em corpo a corpo.'},
  {nome:'Duas Mãos Opcional',desc:'Com as duas mãos: +1 de dano por dado.'},
  {nome:'Essência Paranormal',desc:'O dano conta como paranormal para fins de imunidades e resistências.'},
  {nome:'Amaldiçoada',desc:'Cada vez que causa dano, o usuário faz teste de Vontade ou perde 1 de Sanidade.'},
];
const ICONES = ['espada','adaga','machado','martelo','arco','pistola','bomba','tesoura','corrente','tridente','osso','gota','cranio','sigilo','raio','olho','vela','escudo','amuleto','garra'];
const TIPOS = {
  'arma-branca':{l:'Arma Branca',ico:'espada',db:'arma',sub:'branca'},
  'arma-fogo':  {l:'Arma de Fogo',ico:'pistola',db:'arma',sub:'fogo'},
  'explosivo':  {l:'Explosivo',ico:'bomba',db:'explosivo'},
  'municao':    {l:'Munição',ico:'bala',db:'municao'},
  'armadura':   {l:'Armadura',ico:'escudo',db:'armadura'},
  'item-comum': {l:'Item Comum',ico:'caixa',db:'item-comum'},
  'equipamento':{l:'Equipamento',ico:'engrenagem',db:'equipamento'},
  'paranormal': {l:'Paranormal',ico:'sigilo',db:'paranormal'},
};
const isArma = t => t==='arma-branca'||t==='arma-fogo';
const fjDot = t => t ? `<i class="fj-dot" style="--d:${t.cor}"></i>` : '';
window.fjDot = fjDot;
const TD = k => (typeof TIPOS_DANO!=='undefined' && TIPOS_DANO[k]) || null;
const tdOrder = ['F','B','E','M','S','K','Me'];

/* ═══════════════════════════════════════════
   PERSISTÊNCIA / HIDRATAÇÃO
═══════════════════════════════════════════ */
function syncCustom(){
  if(typeof ITENS_DB==='undefined'||typeof RITUAIS_DB==='undefined') return;
  for(let i=ITENS_DB.length-1;i>=0;i--) if(ITENS_DB[i]._custom) ITENS_DB.splice(i,1);
  for(let i=RITUAIS_DB.length-1;i>=0;i--) if(RITUAIS_DB[i]._custom) RITUAIS_DB.splice(i,1);
  const c = curChar(); if(!c) return;
  (c.customItens||[]).forEach(it=>{ it._custom=true; ITENS_DB.push(it); });
  (c.customRituais||[]).forEach(r=>{ r._custom=true; RITUAIS_DB.push(r); });
}
window.fjSyncCustom = syncCustom;

/* ═══════════════════════════════════════════
   ESTADO DO ITEM + CÁLCULO
═══════════════════════════════════════════ */
function newItemState(tipo){
  const st = {
    tipo: tipo||'arma-branca', nome:'', icone:'', desc:'', qtd:1,
    peso:'media', proposito:'equilibrada', material:'comum',
    dam:null, critM:null, critX:null, cat:null, espacos:null, maos:null, alcance:null, area:null,
    tipoDano:'F', teste:null, bonusAtq:0,
    extras:[], municaoMax:0, municaoGasto:1, municaoNome:'', municaoCalibre:'', municaoRecarga:'', municaoRajada:false,
    calibre:'', calibreNome:'', variante:'comum', mun:{dm:0,cm:0,atq:0,rdIgnora:0,tipoDano:''},
    habs:[],
    arm:{cobertura:'media',material:'kevlar',rdTipo:'null',def:null,rd:null},
  };
  if(st.tipo==='municao'){ st.calibre='9mm'; st.qtd=30; munAutoNome(st); }
  return st;
}

function calcItem(st){
  const T = TIPOS[st.tipo]||TIPOS['item-comum'];
  const auto = {};
  const out = { tipo:T.db };
  const habs = (st.habs||[]).filter(h=>cleanName(h.nome)).map(h=>({nome:cleanName(h.nome),desc:cleanTxt(h.desc)}));
  if(isArma(st.tipo)){
    const sub = T.sub;
    const b = (BASE[st.peso]||BASE.media)[sub];
    const p = PROP[st.proposito]||PROP.equilibrada, mt = MAT[st.material]||MAT.comum;
    auto.dam   = ladderShift(b.dam, p.dm+mt.dm);
    auto.critM = Math.max(15,Math.min(20,b.m-p.cm-mt.cm));
    auto.critX = b.x;
    auto.cat   = catShift(b.cat, mt.cat);
    auto.espacos = b.esp;
    auto.maos  = b.maos;
    auto.alcance = p.alc||'';
    auto.teste = sub==='fogo'?'Pontaria':'Luta';
    const ef = k => st[k]==null||st[k]==='' ? auto[k] : st[k];
    out.subTipo=sub; out.peso=st.peso;
    out.dam=ef('dam'); out.cat=String(ef('cat')); out.espacos=+ef('espacos')||0; out.maos=ef('maos');
    const cm=+ef('critM'), cx=+ef('critX'); out.crit=fmtCrit(cm,cx); out.critM=cm; out.critX=cx;
    const alc = st.alcance==null ? auto.alcance : st.alcance; if(alc) out.alcance=alc;
    out.tipoDano=st.tipoDano||'F';
    out.teste=ef('teste'); if(+st.bonusAtq) out.bonusAtq=+st.bonusAtq;
    const ex=(st.extras||[]).filter(e=>diceStats(e.expr)).map(e=>({expr:e.expr.trim(),tipo:e.tipo||out.tipoDano}));
    if(ex.length) out.danoExtra=ex;
    if(+st.municaoMax>0){
      const FM=window.FJ_MUN||null, sel=st.municaoCalibre||'';
      const ck = FM ? FM.calKey(sel, st.municaoNome) : '';
      const mn = cleanName(st.municaoNome) || (ck&&FM?FM.calLabel(ck):'');
      out.municao={max:+st.municaoMax,gasto:Math.max(1,+st.municaoGasto||1),nome:mn};
      if(ck){ out.municao.calibre=ck; if((st.municaoRecarga||FM.calRec(ck))==='unitaria') out.municao.recarga='unitaria'; }
      if(st.municaoRajada) out.municao.rajada=true;
    }
    // habilidades automáticas do assistente (que o usuário não removeu): só se ainda não existe uma de mesmo nome
    const auH=[]; if(p.hab) auH.push(p.hab); if(mt.hab) auH.push(mt.hab);
    out.habilidades = [...auH.filter(a=>!habs.some(h=>h.nome.toLowerCase()===a.nome.toLowerCase())), ...habs];
  } else if(st.tipo==='explosivo'){
    auto.dam='4d6'; auto.cat='I'; auto.espacos=1; auto.area='6m (esfera)';
    const ef = k => st[k]==null||st[k]==='' ? auto[k] : st[k];
    out.dam=ef('dam'); out.cat=String(ef('cat')); out.espacos=+ef('espacos')||0; out.area=ef('area');
    out.tipoDano=st.tipoDano||'F';
    const cm=+(st.critM||20), cx=+(st.critX||2); if(cx!==2||cm<20) out.crit=fmtCrit(cm,cx);
    out.habilidades=habs;
  } else if(st.tipo==='municao'){
    const FM=window.FJ_MUN;
    const ck = FM ? FM.calKey(st.calibre, st.calibreNome) : '';
    const cinfo = (FM&&FM.cal(ck))||{}, vv=(FM&&FM.variante(st.variante))||{cat:0};
    auto.cat = catShift(cinfo.cat||'0', vv.cat||0); auto.espacos=1;
    out.calibre=ck; out.calibreNome=(FM?FM.calLabel(ck,cleanName(st.calibreNome)):cleanName(st.calibreNome));
    out.variante=st.variante||'comum';
    out.cat=String(st.cat==null||st.cat===''?auto.cat:st.cat); out.espacos=+(st.espacos==null||st.espacos===''?auto.espacos:st.espacos)||0;
    const m=st.mun||{}, mm={};
    ['dm','cm','atq','rdIgnora'].forEach(k=>{ if(+m[k]) mm[k]=+m[k]; });
    if(m.tipoDano) mm.tipoDano=m.tipoDano;
    if(Object.keys(mm).length) out.munMod=mm;
    const ex=(st.extras||[]).filter(e=>diceStats(e.expr)).map(e=>({expr:e.expr.trim(),tipo:e.tipo||'F'}));
    if(ex.length) out.danoExtra=ex;
    out.habilidades=habs;
  } else if(st.tipo==='armadura'){
    const a=st.arm||{}; const b=ARM_BASE[a.cobertura]||ARM_BASE.media, m=ARM_MAT[a.material]||ARM_MAT.kevlar;
    auto.def=b.def; auto.rd=b.rd+m.rd; auto.cat=catShift(b.cat,m.cat); auto.espacos=b.esp;
    const def = a.def==null?auto.def:a.def, rd=a.rd==null?auto.rd:a.rd;
    out.defesa=(def>=0?'+':'')+def; out.rd=String(rd); out.rdTipo = (a.rdTipo==='null'||a.rdTipo==null)?null:a.rdTipo;
    out.cat=String(st.cat==null||st.cat===''?auto.cat:st.cat); out.espacos=+(st.espacos==null||st.espacos===''?auto.espacos:st.espacos)||0;
    out.habilidades=habs;
  } else {
    auto.cat='0'; auto.espacos=1;
    out.cat=String(st.cat==null||st.cat===''?'0':st.cat); out.espacos=+(st.espacos==null||st.espacos===''?1:st.espacos)||0;
    out.habilidades=habs;
  }
  if(out.habilidades && !out.habilidades.length) delete out.habilidades;
  out.nome = cleanName(st.nome)||'';
  out.desc = cleanTxt(st.desc)||'';
  if(st.icone){ const ic=FJI.fromLegacy(st.icone); if(ic) out.icone = ic; }
  return {obj:out, auto};
}

function accentOf(obj){
  if(obj.tipo==='arma'||obj.tipo==='explosivo'){ const t=TD(obj.tipoDano); return t?t.cor:'#ee3000'; }
  if(obj.tipo==='armadura') return '#0d8cf2';
  return typeof _invTipoCor==='function' ? _invTipoCor(obj.tipo) : '#c8a000';
}
const MAOS_L = {'1':'1 mão','2':'2 mãos','v':'Versátil'};
const maosLabel = m => MAOS_L[m]||'1 mão';
window.fjMaosLabel = maosLabel;

function critMult(obj){ return obj.crit ? parseCrit(obj.crit).x : 2; }

/* ═══════════════════════════════════════════
   MOTOR DO MODAL (genérico p/ item e ritual)
═══════════════════════════════════════════ */
const FJ = { kind:null, view:'forge', st:null, editId:null, dirty:false, drafts:{}, notice:'', kinds:{} };
window.FJ = FJ;
FJ.rerender = ()=>renderForge();
const K = () => FJ.kinds[FJ.kind];

function ensureShell(){
  if(document.getElementById('fj-overlay')) return;
  const ov=document.createElement('div'); ov.id='fj-overlay'; ov.className='fj-overlay';
  ov.innerHTML=`<div class="fj-modal" role="dialog" aria-modal="true" aria-labelledby="fj-title">
    <div class="fj-head">
      <div class="fj-head-ico" id="fj-head-ico"></div>
      <div class="fj-head-txt"><div class="fj-title" id="fj-title"></div><div class="fj-sub" id="fj-sub"></div></div>
      <div class="fj-tabs" id="fj-tabs"></div>
      <button class="fj-x" data-act="close" aria-label="Fechar">×</button>
    </div>
    <div class="fj-body" id="fj-body"></div>
    <div class="fj-foot" id="fj-foot"></div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', onClick);
  ov.addEventListener('input', onInput);
  ov.addEventListener('change', onInput);
  ov.addEventListener('mousedown', e=>{ if(e.target===ov) ov._down=true; else ov._down=false; });
  ov.addEventListener('click', e=>{ if(e.target===ov && ov._down) tryClose(); });
  document.addEventListener('keydown', e=>{
    if(!ov.classList.contains('on')) return;
    if(e.key==='Escape'){ e.preventDefault(); tryClose(); }
    else if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); if(FJ.view==='forge') doSave(true); }
  });
}

function open(kind, opts){
  opts=opts||{};
  ensureShell(); syncCustom();
  FJ.kind=kind; FJ.view=opts.view||'forge'; FJ.editId=null; FJ.notice='';
  const k=K();
  if(opts.edit && k.find(opts.edit)){ FJ.st=k.stateFrom(k.find(opts.edit)); FJ.editId=opts.edit; }
  else if(opts.tipo || opts.fresh || !FJ.drafts[kind]) FJ.st=k.newState(opts.tipo);
  else { FJ.st=FJ.drafts[kind]; if(opts.view!=='lib') FJ.notice='Rascunho anterior restaurado.'; }
  FJ.dirty=false;
  document.getElementById('fj-overlay').classList.add('on');
  document.body.style.overflow='hidden';
  render();
  if(FJ.view==='forge') setTimeout(()=>{ const n=document.querySelector('#fj-body [data-b="nome"]'); if(n && !FJ.editId) n.focus(); },60);
}
function close(){
  const ov=document.getElementById('fj-overlay'); if(ov) ov.classList.remove('on');
  document.body.style.overflow='';
  FJ.st=null; FJ.editId=null; FJ.dirty=false;
  const cb=FJ.afterClose; FJ.afterClose=null;          // ex.: voltar ao ritual depois de criar um sumonável
  if(cb) setTimeout(cb,30);
}
function tryClose(){
  if(FJ.view==='forge' && FJ.dirty && FJ.st){
    const k=K();
    if(!FJ.editId && cleanName(FJ.st.nome)){ FJ.drafts[FJ.kind]=clone(FJ.st); toastF('Rascunho guardado — reabra para continuar.'); }
    else if(FJ.editId && !confirm('Descartar as alterações não salvas?')) return;
  }
  close();
}

function render(){
  const k=K(); const modal=document.querySelector('#fj-overlay .fj-modal');
  modal.style.setProperty('--fj-acc', k.accent);
  document.getElementById('fj-head-ico').innerHTML=FJI.svg(k.icon,{w:1.5});
  document.getElementById('fj-title').textContent = FJ.view==='lib' ? k.libTitle : (FJ.editId?k.editTitle:k.title);
  document.getElementById('fj-sub').textContent = FJ.view==='lib' ? k.libSub : k.sub;
  const n=k.libList().length;
  document.getElementById('fj-tabs').innerHTML =
    `<button class="fj-tab ${FJ.view==='forge'?'on':''}" data-act="view" data-v="forge">${FJI.svg(FJ.editId?'editar':'forja')}${FJ.editId?'Editando':'Forjar'}</button>`+
    `<button class="fj-tab ${FJ.view==='lib'?'on':''}" data-act="view" data-v="lib">${FJI.svg('livro')}Biblioteca <i class="fj-tab-n">${n}</i></button>`;
  if(FJ.view==='lib') renderLib(); else renderForge();
}

function renderForge(){
  const k=K(), body=document.getElementById('fj-body'), top=body.scrollTop;
  body.innerHTML = (FJ.notice?`<div class="fj-notice"><span>${FJI.svg('nota')}${E(FJ.notice)}</span><button class="fj-btn sm" data-act="discard-draft">Começar do zero</button></div>`:'')+
    `<div class="fj-grid"><div class="fj-col-form">${k.formHTML(FJ.st)}</div>
     <div class="fj-col-prev"><div class="fj-prev-lbl">Pré-visualização</div><div class="fj-prev-wrap" id="fj-prev"></div></div></div>`;
  body.scrollTop=top;
  renderFoot(); refresh();
}
function renderFoot(){
  const k=K(), f=document.getElementById('fj-foot');
  if(FJ.view==='lib'){
    f.innerHTML=`<div class="fj-foot-sum">${k.libList().length} criaç${k.libList().length===1?'ão':'ões'} guardada${k.libList().length===1?'':'s'} nesta ficha</div>
      <button class="fj-btn" data-act="close">Fechar</button><button class="fj-btn pri" data-act="new">＋ Criar novo</button>`;
  } else {
    f.innerHTML=`<div class="fj-foot-sum" id="fj-sum"></div>
      <button class="fj-btn" data-act="close">Cancelar</button>
      <button class="fj-btn" data-act="save" data-bag="0" title="Guarda na biblioteca sem levar na mochila">${FJI.svg('salvar')}${FJ.editId?'Salvar alterações':'Só salvar'}</button>
      ${FJ.editId?'':`<button class="fj-btn pri" data-act="save" data-bag="1" title="Ctrl+Enter">${k.primary}</button>`}`;
  }
}

/* sincroniza controles com o estado (sem recriar o formulário) */
function refresh(){
  const k=K(), st=FJ.st; if(!st) return;
  const calc=k.calc(st);
  const prev=document.getElementById('fj-prev'); if(prev) prev.innerHTML=k.previewHTML(st,calc);
  const sum=document.getElementById('fj-sum'); if(sum) sum.innerHTML=k.summary(st,calc);
  const modal=document.querySelector('#fj-overlay .fj-modal'); if(modal && k.accentOf) modal.style.setProperty('--fj-acc',k.accentOf(st,calc));
  const body=document.getElementById('fj-body');
  body.querySelectorAll('[data-set]').forEach(b=>{
    const v=getP(st,b.dataset.set); b.classList.toggle('on', String(v)===b.dataset.v);
  });
  body.querySelectorAll('[data-tog]').forEach(b=>b.classList.toggle('on', !!getP(st,b.dataset.tog)));
  body.querySelectorAll('[data-b]').forEach(i=>{
    if(document.activeElement===i) return;
    const v=getP(st,i.dataset.b); const nv = v==null?'':String(v); if(i.value!==nv) i.value=nv;
  });
  body.querySelectorAll('[data-ov]').forEach(i=>{
    const p=i.dataset.ov, v=getP(st,p), a=(calc.auto||{})[i.dataset.auto||p];
    const man = !(v==null||(v===''&&i.dataset.allowempty==null));
    if(document.activeElement!==i) i.value = man ? v : (a==null?'':a);
    const bd=body.querySelector(`[data-badge="${p}"]`); if(bd){ bd.textContent=man?'MANUAL':'AUTO'; bd.classList.toggle('man',man); }
  });
  body.querySelectorAll('[data-dicehint]').forEach(el=>{
    const p=el.dataset.dicehint; const v=getP(st,p); const expr = (v==null||v==='')?(calc.auto||{})[p]:v;
    const s=diceStats(expr); const inp=body.querySelector(`[data-ov="${p}"]`);
    if(inp) inp.classList.toggle('bad', !!(expr && !s));
    if(!expr){ el.innerHTML='<span>Sem dano — deixe vazio para rituais só de efeito</span>'; return; }
    el.innerHTML = s ? `mín <b>${s.min}</b> · média <b>${s.avg.toFixed(1).replace('.',',')}</b> · máx <b>${s.max}</b>` : '<span style="color:#ee6060">Use o formato 2d8+3 (soma vários: 1d6+1d4+2)</span>';
  });
  if(k.afterRefresh) k.afterRefresh(st,calc);
}

/* ───── eventos ───── */
function markDirty(){ FJ.dirty=true; }
function onInput(e){
  const t=e.target, st=FJ.st; if(!st||FJ.view!=='forge') return;
  let p=t.dataset.b||t.dataset.ov; if(!p) return;
  let v=t.value;
  if(t.dataset.t==='num'){ v = v===''?null:Number(v); if(v!=null&&isNaN(v)) v=null;
    if(v!=null&&t.hasAttribute('min')) v=Math.max(+t.min,v); if(v!=null&&t.hasAttribute('max')) v=Math.min(+t.max,v); }
  if(t.dataset.ov!=null && v==='' && t.dataset.allowempty==null) v=null;
  if(t.dataset.b!=null && t.dataset.t==='num' && v==null) v=0;
  setP(st,p,v); markDirty();
  if(t.dataset.rerender){ renderForge(); return; }
  refresh();
}
function onClick(e){
  const el=e.target.closest('[data-act],[data-set],[data-tog],[data-step],[data-dice],[data-reset],[data-add],[data-rm],[data-quick],[data-habm],[data-tpl]');
  if(!el||!document.getElementById('fj-overlay').contains(el)) return;
  const st=FJ.st, k=K();
  if(el.dataset.act){
    const a=el.dataset.act;
    if(a==='close') return tryClose();
    if(a==='view'){ FJ.view=el.dataset.v; render(); return; }
    if(a==='new'){ FJ.view='forge'; FJ.editId=null; FJ.st=k.newState(); FJ.notice=''; FJ.dirty=false; render(); return; }
    if(a==='discard-draft'){ delete FJ.drafts[FJ.kind]; FJ.st=k.newState(); FJ.notice=''; FJ.dirty=false; render(); return; }
    if(a==='save') return doSave(el.dataset.bag==='1');
    if(a.startsWith('lib-')) return libAction(a.slice(4), el.dataset.id);
    if(k.onAct && k.onAct(a,el,st)) return;
    return;
  }
  if(!st) return;
  if(el.dataset.set){ let v=el.dataset.v; if(el.dataset.n!=null) v=Number(v); const cur=getP(st,el.dataset.set); if(el.dataset.toggleoff!=null && String(cur)===String(v)) v=null; setP(st,el.dataset.set,v); if(k.onSet) k.onSet(st,el.dataset.set,v); markDirty(); if(el.dataset.rerender) renderForge(); else refresh(); return; }
  if(el.dataset.tog){ setP(st,el.dataset.tog,!getP(st,el.dataset.tog)); markDirty(); if(el.dataset.rerender) renderForge(); else refresh(); return; }
  if(el.dataset.step){ const p=el.dataset.step, calc=k.calc(st); const cur=getP(st,p); const a=(calc.auto||{})[el.dataset.auto||p];
    let base = (cur==null||cur==='')?a:cur; base=Number(base)||0;
    let nv = base+Number(el.dataset.d); if(el.dataset.min!=null) nv=Math.max(+el.dataset.min,nv); if(el.dataset.max!=null) nv=Math.min(+el.dataset.max,nv);
    setP(st,p,nv); markDirty(); refresh(); return; }
  if(el.dataset.dice){ const p=el.dataset.dice, calc=k.calc(st); const cur=getP(st,p); const a=(calc.auto||{})[p]; const base=(cur==null||cur==='')?(a||'1d6'):cur;
    setP(st,p,ladderShift(base,Number(el.dataset.d))); markDirty(); refresh(); return; }
  if(el.dataset.reset){ setP(st,el.dataset.reset,null); markDirty(); refresh(); return; }
  if(el.dataset.quick){ const [p,v]=el.dataset.quick.split('|'); setP(st,p,v); markDirty(); refresh(); return; }
  if(el.dataset.add){ const list=getP(st,el.dataset.add)||[]; list.push(k.newRow(el.dataset.add)); setP(st,el.dataset.add,list); markDirty(); renderForge();
    setTimeout(()=>{ const rows=document.querySelectorAll(`#fj-body [data-row="${el.dataset.add}"]`); const last=rows[rows.length-1]; if(last){ const i=last.querySelector('input,textarea'); if(i) i.focus(); } },30); return; }
  if(el.dataset.rm){ const [p,i]=el.dataset.rm.split(':'); const list=getP(st,p)||[]; list.splice(+i,1); markDirty(); renderForge(); return; }
  if(el.dataset.habm){ const m=HAB_MODELOS[+el.dataset.habm]; st.habs=st.habs||[]; if(!st.habs.some(h=>h.nome===m.nome)) st.habs.push({nome:m.nome,desc:m.desc}); markDirty(); renderForge(); return; }
  if(el.dataset.tpl){ if(k.applyTemplate) k.applyTemplate(st, el.dataset.tpl); markDirty(); renderForge(); return; }
}

/* ───── salvar ───── */
function doSave(addBag){
  const k=K(), st=FJ.st; if(!st) return;
  const err=k.validate(st, FJ.editId);
  if(err){ toastF(err,'#ee3000'); const n=document.querySelector('#fj-body [data-b="nome"]'); if(n) n.focus(); return; }
  const res=k.save(st, FJ.editId, addBag);
  delete FJ.drafts[FJ.kind];
  FJ.dirty=false;
  syncCustom();
  if(typeof renderInvUnificado==='function') renderInvUnificado();
  if(typeof renderAtaques==='function') renderAtaques();
  if(typeof renderRituaisTab==='function') renderRituaisTab();
  if(typeof renderArmaduraEquipada==='function') renderArmaduraEquipada();
  if(typeof saveDB==='function') saveDB();
  if(typeof flashSave==='function') flashSave('save-inv');
  toastF(res.msg, k.accent);
  close();
}

/* ───── biblioteca ───── */
function renderLib(){
  const k=K(), body=document.getElementById('fj-body');
  const list=k.libList();
  const q=(FJ.libQ||'').toLowerCase();
  const shown=list.filter(o=>!q||(o.nome||'').toLowerCase().includes(q));
  body.innerHTML=`<div class="fj-lib-head">
      <input class="fj-in" id="fj-libq" placeholder="Buscar nas suas criações..." value="${E(FJ.libQ||'')}">
      <button class="fj-btn sm" data-act="lib-export">${FJI.svg('exportar')}Exportar código</button>
      <button class="fj-btn sm" data-act="lib-importbox">${FJI.svg('importar')}Importar</button>
    </div>
    <div id="fj-io"></div>
    ${shown.length?`<div class="fj-lib-grid">${shown.map(o=>k.libCard(o)).join('')}</div>`:`<div class="fj-empty">${list.length?'Nada encontrado.':k.libEmpty}</div>`}`;
  const qi=document.getElementById('fj-libq'); if(qi) qi.addEventListener('input',()=>{ FJ.libQ=qi.value; const pos=qi.selectionStart; renderLib(); const n=document.getElementById('fj-libq'); n.focus(); n.setSelectionRange(pos,pos); });
  renderFoot();
}
function libAction(a,id){
  const k=K(), c=curChar();
  if(a==='edit'){ FJ.st=k.stateFrom(k.find(id)); FJ.editId=id; FJ.view='forge'; FJ.notice=''; FJ.dirty=false; render(); }
  else if(a==='dup'){ const o=k.find(id); const st=k.stateFrom(o); st.nome=cleanName(st.nome)+' (cópia)'; FJ.st=st; FJ.editId=null; FJ.view='forge'; FJ.notice='Duplicado — ajuste e salve.'; FJ.dirty=true; render(); }
  else if(a==='del'){ if(confirm('Excluir esta criação definitivamente? Ela também sai da mochila/grimório.')){ k.remove(id); syncCustom(); refreshOutside(); render(); toastF('Criação excluída.'); } }
  else if(a==='bag'){ k.addToBag(id); syncCustom(); refreshOutside(); render(); }
  else if(a==='export'){ exportCodes(); }
  else if(a==='importbox'){
    const io=document.getElementById('fj-io');
    io.innerHTML=`<div class="fj-io"><div class="fj-l">Cole o código exportado por outro agente</div><textarea class="fj-in" id="fj-io-ta" placeholder="HXT1:..."></textarea><div style="margin-top:8px;display:flex;gap:6px"><button class="fj-btn pri sm" data-act="lib-import">Importar</button><button class="fj-btn sm" data-act="lib-render">Cancelar</button></div></div>`;
  }
  else if(a==='render'){ renderLib(); }
  else if(a==='import'){ importCodes(document.getElementById('fj-io-ta').value); }
}
function refreshOutside(){
  if(typeof renderInvUnificado==='function') renderInvUnificado();
  if(typeof renderAtaques==='function') renderAtaques();
  if(typeof renderRituaisTab==='function') renderRituaisTab();
  if(typeof renderArmaduraEquipada==='function') renderArmaduraEquipada();
  if(typeof saveDB==='function') saveDB();
}
function exportCodes(){
  const c=curChar(); if(!c) return;
  const pack={v:1,itens:(c.customItens||[]).map(stripForExport),rituais:(c.customRituais||[]).map(stripForExport),sumonaveis:(c.customSumonaveis||[]).map(stripForExport)};
  const code='HXT1:'+btoa(unescape(encodeURIComponent(JSON.stringify(pack))));
  const io=document.getElementById('fj-io');
  io.innerHTML=`<div class="fj-io"><div class="fj-l">Código de exportação (itens + rituais + sumonáveis) — envie para outro agente</div><textarea class="fj-in" readonly id="fj-io-ta">${code}</textarea><div style="margin-top:8px"><button class="fj-btn pri sm" data-act="lib-render">Fechar</button></div></div>`;
  const ta=document.getElementById('fj-io-ta'); ta.focus(); ta.select();
  try{ navigator.clipboard.writeText(code).then(()=>toastF('Código copiado!')); }catch(e){}
}
const stripForExport = o => { const c=clone(o); delete c._custom; delete c._owner; return c; };
function importCodes(txt){
  const c=curChar(); if(!c) return;
  try{
    txt=String(txt||'').trim(); if(!txt.startsWith('HXT1:')) throw new Error('formato');
    const pack=JSON.parse(decodeURIComponent(escape(atob(txt.slice(5)))));
    let ni=0,nr=0,ns=0; const idmap={};
    (pack.itens||[]).forEach(o=>{ if(!o||!o.nome||!o.tipo) return; o.id=uid(); o._custom=true; (c.customItens=c.customItens||[]).push(sanitizeObj(o)); ni++; });
    // sumonáveis primeiro: os rituais importados apontam para os novos ids
    (pack.sumonaveis||[]).forEach(o=>{ if(!o||!o.nome||!o.pv) return;
      let n=cleanName(o.nome), base=n, i=2; const taken=x=>(c.customSumonaveis||[]).some(s=>s.nome.toLowerCase()===x.toLowerCase());
      while(taken(n)) n=base+' '+(i++);
      const old=o.id; o.id=uid(); if(old) idmap[old]=o.id; o.nome=n; if(o._forja) o._forja.nome=n;
      o._custom=true; o._owner=currentUser; (c.customSumonaveis=c.customSumonaveis||[]).push(sanitizeObj(o)); ns++; });
    (pack.rituais||[]).forEach(o=>{ if(!o||!o.nome||!o.elem) return;
      (o.sumonaveis||[]).forEach(r=>{ if(idmap[r.id]) r.id=idmap[r.id]; });
      if(o._forja&&o._forja.sum&&o._forja.sum.rows) o._forja.sum.rows.forEach(r=>{ if(idmap[r.id]) r.id=idmap[r.id]; });
      let n=cleanName(o.nome), base=n, i=2; const taken=x=>RITUAIS_DB.some(r=>r.nome.toLowerCase()===x.toLowerCase()&&!(r._custom&&!(c.customRituais||[]).includes(r)))||(c.customRituais||[]).some(r=>r.nome.toLowerCase()===x.toLowerCase());
      while(taken(n)) n=base+' '+(i++);
      o.nome=n; o._custom=true; o._owner=currentUser; (c.customRituais=c.customRituais||[]).push(sanitizeObj(o));
      if(!c.rituaisAprendidos) c.rituaisAprendidos={}; c.rituaisAprendidos[n]=true; nr++; });
    syncCustom(); refreshOutside(); render();
    toastF(`Importado: ${ni} item(ns), ${nr} ritual(is), ${ns} sumonável(is).`);
  }catch(e){ toastF('Código inválido.','#ee3000'); }
}
function sanitizeObj(o){ // remove < > de todas as strings
  const walk=v=>{ if(typeof v==='string') return v.replace(/[<>]/g,''); if(Array.isArray(v)) return v.map(walk); if(v&&typeof v==='object'){ const r={}; Object.keys(v).forEach(k=>r[k]=walk(v[k])); return r; } return v; };
  const r=walk(o); if(r.nome) r.nome=r.nome.replace(/["\\]/g,''); return r;
}

/* ═══════════════════════════════════════════
   COMPONENTES DE FORMULÁRIO
═══════════════════════════════════════════ */
const F = {
  sec:(n,t,inner,hint)=>`<section class="fj-sec"><h3><span class="fj-n">${n}</span>${t}</h3>${hint?`<p class="fj-hint">${hint}</p>`:''}${inner}</section>`,
  f:(l,inner,extra)=>`<div class="fj-f"><div class="fj-l"><span>${l}</span>${extra||''}</div>${inner}</div>`,
  input:(p,ph,o)=>{o=o||{};return `<input class="fj-in" data-b="${p}" ${o.t?`data-t="${o.t}"`:''} ${o.rerender?'data-rerender="1"':''} placeholder="${E(ph||'')}" ${o.max?`maxlength="${o.max}"`:''} ${o.type?`type="${o.type}"`:''} ${o.min!=null?`min="${o.min}"`:''} ${o.maxv!=null?`max="${o.maxv}"`:''} autocomplete="off">`;},
  ovInput:(p,ph,o)=>{o=o||{};return `<input class="fj-in" data-ov="${p}" ${o.allowempty?'data-allowempty="1"':''} ${o.auto?`data-auto="${o.auto}"`:''} ${o.t?`data-t="${o.t}"`:''} ${o.list?`list="${o.list}"`:''} placeholder="${E(ph||'')}" autocomplete="off" ${o.type?`type="${o.type}"`:''} ${o.min!=null?`min="${o.min}"`:''} ${o.maxv!=null?`max="${o.maxv}"`:''}>`;},
  badge:p=>`<span><span class="fj-badge" data-badge="${p}">AUTO</span><button type="button" class="fj-reset" data-reset="${p}" title="Voltar ao automático">${FJI.svg('recarregar')}</button></span>`,
  chips:(p,opts,o)=>{o=o||{};return `<div class="fj-chips">${opts.map(x=>`<button type="button" class="fj-chip ${o.ico?'ico':''} ${o.big?'big':''}" data-set="${p}" data-v="${E(x.v)}" ${o.n?'data-n':''} ${o.rerender?'data-rerender="1"':''} ${o.off?'data-toggleoff':''} ${x.c?`style="--cc:${x.c}"`:''} ${x.t?`title="${E(x.t)}"`:''}>${x.l}${x.s?`<small>${x.s}</small>`:''}</button>`).join('')}</div>`;},
  quick:(p,vals)=>`<div class="fj-chips" style="margin-top:5px">${vals.map(v=>{const a=Array.isArray(v)?v:[v,v];return `<button type="button" class="fj-chip" data-quick="${p}|${E(a[0])}">${E(a[1])}</button>`;}).join('')}</div>`,
  step:(p,o)=>{o=o||{};return `<div class="fj-step"><button type="button" data-step="${p}" ${o.auto?`data-auto="${o.auto}"`:''} data-d="-1" ${o.min!=null?`data-min="${o.min}"`:''} ${o.max!=null?`data-max="${o.max}"`:''}>−</button>${F.ovInput(p,'',{t:'num',type:'number',auto:o.auto,min:o.min,maxv:o.max})}<button type="button" data-step="${p}" ${o.auto?`data-auto="${o.auto}"`:''} data-d="1" ${o.min!=null?`data-min="${o.min}"`:''} ${o.max!=null?`data-max="${o.max}"`:''}>+</button></div>`;},
  toggle:(p,l,o)=>`<div class="fj-toggle" data-tog="${p}" ${o&&o.rerender?'data-rerender="1"':''}><span class="fj-sw"></span><span>${l}</span></div>`,
  dice:(p,label,opts)=>F.f(label, `<div class="fj-step"><button type="button" data-dice="${p}" data-d="-1" title="Diminuir degrau">−</button>${F.ovInput(p,(opts&&opts.ph)||'ex: 2d8+3',{allowempty:opts&&opts.nobadge})}<button type="button" data-dice="${p}" data-d="1" title="Aumentar degrau">+</button></div><div class="fj-dice-info" data-dicehint="${p}"></div>`, opts&&opts.nobadge?'':F.badge(p)),
  tipoDano:(p)=>F.chips(p, tdOrder.map(k=>{const t=TD(k); return {v:k,l:`${fjDot(t)}${t.nome}`,c:t.cor};})),
};
window.fjUI = {F,E,cleanName,cleanTxt,clone,uid,getP,setP,diceStats,ladderShift,rollExpr,parseCrit,fmtCrit,TD,tdOrder,rgb,toastF,curChar,syncCustom,HAB_MODELOS,ICONES,accentOf};

/* ═══════════════════════════════════════════
   KIND: ITEM (armas, explosivos, armaduras, itens)
═══════════════════════════════════════════ */
function itemFind(id){ const c=curChar(); return (c.customItens||[]).find(i=>i.id===id); }
function stateFromItem(o){
  if(o._forja){ const st0=Object.assign(newItemState(o._forja.tipo), clone(o._forja)); st0.icone=FJI.fromLegacy(st0.icone); return st0; }
  // criação sem _forja (importada): reconstrói
  const st=newItemState(); fillFromDb(st,o); return st;
}
function tipoFromDb(o){ if(o.tipo==='arma') return o.subTipo==='fogo'?'arma-fogo':'arma-branca'; if(o.tipo==='protecao') return 'armadura'; return TIPOS[o.tipo]?o.tipo:'item-comum'; }
function fillFromDb(st,o){
  st.tipo=tipoFromDb(o); st.peso=o.peso||'media'; st.desc=o.desc||''; st.icone=FJI.fromLegacy(o.icone)||'';
  st.dam=o.dam||null; if(o.crit){ const c=parseCrit(o.crit); st.critM=c.m; st.critX=c.x; }
  st.cat=o.cat!=null?String(o.cat):null; st.espacos=o.espacos!=null?o.espacos:null; st.maos=o.maos||null; st.alcance=o.alcance!=null?o.alcance:(o.tipo==='arma'?'':null);
  st.area=o.area||null; st.tipoDano=o.tipoDano&&TD(o.tipoDano)?o.tipoDano:'F';
  st.habs=(o.habilidades||[]).map(h=>({nome:h.nome,desc:h.desc}));
  st.proposito='equilibrada'; st.material='comum';
  if(o.tipo==='armadura'||o.tipo==='protecao'){ st.arm={cobertura:'media',material:'couro',rdTipo:o.rdTipo==null?'null':o.rdTipo,def:parseInt(o.defesa)||0,rd:parseInt(o.rd)||0}; }
  if(o.teste) st.teste=o.teste; if(o.bonusAtq) st.bonusAtq=o.bonusAtq;
  if(o.danoExtra) st.extras=o.danoExtra.map(e=>({expr:e.expr,tipo:e.tipo}));
  if(o.municao){ st.municaoMax=o.municao.max; st.municaoGasto=o.municao.gasto||1; st.municaoNome=o.municao.nome||'';
    const FM=window.FJ_MUN; st.municaoCalibre = FM?FM.calSel(o.municao.calibre):''; st.municaoRecarga=o.municao.recarga||''; st.municaoRajada=!!o.municao.rajada; }
  if(o.tipo==='municao'){ const FM=window.FJ_MUN; st.calibre=FM?FM.calSel(o.calibre):''; st.calibreNome=o.calibreNome||''; st.variante=o.variante||'comum';
    st.mun=Object.assign({dm:0,cm:0,atq:0,rdIgnora:0,tipoDano:''},o.munMod||{}); }
}

function extrasHTML(st){
  return F.f('Dano adicional <span style="opacity:.6">(ex.: +1d6 de Fogo)</span>',
    (st.extras||[]).map((e,i)=>`<div class="fj-list-row" data-row="extras"><div class="fj-lr-main"><div class="fj-lr-2"><input class="fj-in" data-b="extras.${i}.expr" placeholder="1d6" autocomplete="off"><select data-b="extras.${i}.tipo">${tdOrder.map(k=>`<option value="${k}">${TD(k).nome}</option>`).join('')}</select></div></div><button type="button" class="fj-rm" data-rm="extras:${i}">×</button></div>`).join('')+
    `<button type="button" class="fj-add" data-add="extras">＋ Adicionar dano adicional</button>`);
}
/* nome automático da munição (só enquanto o usuário não escreveu o dele) */
function munAutoNome(st){
  const FM=window.FJ_MUN; if(!FM) return;
  const cl=FM.calLabel(FM.calKey(st.calibre,st.calibreNome),cleanName(st.calibreNome))||'';
  const vl=(st.variante&&st.variante!=='comum')?FM.varLabel(st.variante):'';
  const auto=('Munição '+cl+(vl?' '+vl:'')).trim();
  if(!st.nome||st.nome===st._autoNome) st.nome=auto;
  st._autoNome=auto;
}
function munApplyVariante(st,id){
  const FM=window.FJ_MUN, v=FM&&FM.variante(id); if(!v) return;
  st.variante=id;
  st.mun=Object.assign({dm:0,cm:0,atq:0,rdIgnora:0,tipoDano:''},v.mod||{});
  st.extras=clone(v.extras||[]); st.habs=clone(v.habs||[]); st.cat=null;
  munAutoNome(st);
}

const itemKind = {
  accent:'#ee8822', icon:'forja', primary:FJI.svg('forja')+'Forjar e levar na mochila',
  title:'Forja de Armas & Itens', editTitle:'Editar criação', sub:'Tudo é editável — o assistente só sugere os números',
  libTitle:'Biblioteca de Itens', libSub:'Suas armas, armaduras e itens autorais', libEmpty:'Você ainda não forjou nada. Use “Criar novo” para começar.',
  newState:newItemState, stateFrom:stateFromItem, find:itemFind, calc:calcItem,
  accentOf:(st,calc)=>accentOf(calc.obj),
  newRow:(path)=> path==='extras'?{expr:'1d6',tipo:'S'}:{nome:'',desc:''},
  libList:()=>{ const c=curChar(); return c?(c.customItens||[]):[]; },

  formHTML(st){
    const A=isArma(st.tipo), EX=st.tipo==='explosivo', AR=st.tipo==='armadura', MU=st.tipo==='municao';
    const FM=window.FJ_MUN||{CALIBRES:[],VARIANTES:[]};
    let h='';
    /* I — identidade */
    h+=F.sec('I','Identidade',
      F.f('Nome do item *',F.input('nome','Ex: Espada de Ossos',{max:60}))+
      F.f('Tipo',F.chips('tipo',Object.keys(TIPOS).map(k=>({v:k,l:FJI.svg(TIPOS[k].ico)+TIPOS[k].l})),{rerender:true}))+
      F.f('Ícone',`<div class="fj-chips">${ICONES.map(i=>`<button type="button" class="fj-chip ico" data-set="icone" data-v="${i}" data-toggleoff title="${i}">${FJI.svg(i)}</button>`).join('')}</div>`)+
      (isArma(st.tipo)||EX||AR||MU ? F.f('Basear em item existente',`<select data-tpl-sel id="fj-tplsel"><option value="">— escolher para copiar os valores —</option>${templateOptions(st.tipo)}</select>`) : '')
    );
    /* II — combate */
    if(A){
      h+=F.sec('II','Assistente de balanceamento',
        F.f('Peso / tamanho',F.chips('peso',[{v:'leve',l:'Leve',s:'1 mão · rápida'},{v:'media',l:'Média',s:'versátil'},{v:'pesada',l:'Pesada',s:'2 mãos · poderosa'}],{big:true}))+
        F.f('Propósito',F.chips('proposito',Object.keys(PROP).map(k=>({v:k,l:PROP[k].l,t:PROP[k].d}))))+
        F.f('Material',F.chips('material',Object.keys(MAT).map(k=>({v:k,l:MAT[k].l}))))
      ,'Sugere dano, crítico e categoria. Qualquer campo abaixo pode ser sobrescrito — o selo AUTO muda para MANUAL.');
    }
    if(A||EX){
      h+=F.sec(A?'III':'II','Dano',
        F.dice('dam','Dano principal')+
        F.f('Tipo de dano',F.tipoDano('tipoDano'))+
        F.f('Dano adicional <span style="opacity:.6">(ex.: +1d6 de Sangue)</span>',
          (st.extras||[]).map((e,i)=>`<div class="fj-list-row" data-row="extras"><div class="fj-lr-main"><div class="fj-lr-2"><input class="fj-in" data-b="extras.${i}.expr" placeholder="1d6" autocomplete="off"><select data-b="extras.${i}.tipo">${tdOrder.map(k=>`<option value="${k}">${TD(k).nome}</option>`).join('')}</select></div></div><button type="button" class="fj-rm" data-rm="extras:${i}">×</button></div>`).join('')+
          `<button type="button" class="fj-add" data-add="extras">＋ Adicionar dano adicional</button>`)
      );
      let cr='';
      if(A){
        cr=`<div class="fj-row">${F.f('Margem de ameaça',F.step('critM',{min:15,max:20}),F.badge('critM'))}${F.f('Multiplicador',F.step('critX',{min:2,max:6}),F.badge('critX'))}</div>`+
          `<div class="fj-row">${F.f('Perícia de ataque',F.ovInput('teste','Luta / Pontaria...',{list:'fj-testes'}),F.badge('teste'))}${F.f('Bônus no ataque',F.input('bonusAtq','0',{t:'num',type:'number',min:-20,maxv:30}))}</div>`+
          F.f('Alcance',F.ovInput('alcance','Corpo a corpo',{allowempty:1})+F.quick('alcance',[['','C/C'],'Curto','Médio','Longo','Extremo']),F.badge('alcance'))+
          F.f('Empunhadura',F.chips('maos',[{v:'1',l:'1 mão'},{v:'2',l:'2 mãos'},{v:'v',l:'Versátil'}],{off:true}))+
          `<div class="fj-row">${F.f('Categoria',`<select data-ov="cat"><option value="">Automática</option>${CATS.slice(0,5).map(c=>`<option value="${c}">Cat ${c}</option>`).join('')}</select>`,F.badge('cat'))}${F.f('Espaços',F.step('espacos',{min:0,max:99}),F.badge('espacos'))}</div>`;
      } else {
        cr=`<div class="fj-row">${F.f('Área de efeito',F.ovInput('area','6m (esfera)',{}),F.badge('area'))}${F.f('Categoria',`<select data-ov="cat"><option value="">Automática</option>${CATS.slice(0,5).map(c=>`<option value="${c}">Cat ${c}</option>`).join('')}</select>`,F.badge('cat'))}${F.f('Espaços',F.step('espacos',{min:0,max:99}),F.badge('espacos'))}</div>`;
      }
      h+=F.sec(A?'IV':'III',A?'Combate':'Explosão',cr);
      if(A){
        const calChips=[{v:'',l:'Livre',t:'Sem calibre: recarga livre, sem gastar munição da mochila'},...FM.CALIBRES.map(c=>({v:c.id,l:c.l})),{v:'custom',l:'Outro...'}];
        const semCal=!st.municaoCalibre||st.municaoCalibre==='custom';
        h+=F.sec('V','Munição',
          F.f('Calibre',F.chips('municaoCalibre',calChips,{rerender:true}))+
          `<div class="fj-row">${F.f('Capacidade',F.input('municaoMax','0 = não controla',{t:'num',type:'number',min:0,maxv:999}))}${F.f('Gasto por ataque',F.input('municaoGasto','1',{t:'num',type:'number',min:1,maxv:99}))}${semCal?F.f(st.municaoCalibre==='custom'?'Nome do calibre':'Rótulo (opcional)',F.input('municaoNome',st.municaoCalibre==='custom'?'Ex: Flecha de ossos':'Ex: flechas',{max:30})):''}</div>`+
          (st.municaoCalibre?F.f('Recarga',F.chips('municaoRecarga',[{v:'',l:'Padrão do calibre'},{v:'carregador',l:'Carregador',s:'enche tudo de uma vez'},{v:'unitaria',l:'Um por vez',s:'cartucho a cartucho'}])):'')+
          F.toggle('municaoRajada','Permite rajada <span style="opacity:.65">(gasta 3 munições · +1 dado de dano · +2 no teste)</span>'),
          'Com calibre definido, recarregar gasta balas da mochila (item de Munição do mesmo calibre) e o tipo carregado muda o dano. Sem calibre, a recarga é livre.');
      }
    }
    if(AR){
      h+=F.sec('II','Proteção',
        `<div class="fj-row">${F.f('Cobertura',F.chips('arm.cobertura',[{v:'minima',l:'Mínima'},{v:'leve',l:'Leve'},{v:'media',l:'Média'},{v:'completa',l:'Completa'}]))}</div>`+
        F.f('Material',F.chips('arm.material',[{v:'couro',l:'Couro/Tecido'},{v:'kevlar',l:'Kevlar'},{v:'metal',l:'Metal'},{v:'paranormal',l:'Paranormal'}]))+
        F.f('Protege contra',`<select data-b="arm.rdTipo"><option value="null">Físico geral (B+F)</option><option value="B">Balístico</option><option value="F">Físico</option><option value="paranormal">Paranormal (todos)</option>${['E','M','S','K','Me'].map(k=>`<option value="${k}">${TD(k).nome}</option>`).join('')}</select>`)+
        `<div class="fj-row">${F.f('Defesa (bônus)',F.step('arm.def',{auto:'def',min:0,max:30}),F.badge('arm.def'))}${F.f('RD',F.step('arm.rd',{auto:'rd',min:0,max:50}),F.badge('arm.rd'))}${F.f('Categoria',`<select data-ov="cat"><option value="">Automática</option>${CATS.slice(0,5).map(c=>`<option value="${c}">Cat ${c}</option>`).join('')}</select>`,F.badge('cat'))}${F.f('Espaços',F.step('espacos',{min:0,max:99}),F.badge('espacos'))}</div>`);
    }
    if(!A&&!EX&&!AR&&!MU){
      h+=F.sec('II','Propriedades',`<div class="fj-row">${F.f('Categoria',`<select data-ov="cat"><option value="">Padrão (0)</option>${CATS.slice(0,5).map(c=>`<option value="${c}">Cat ${c}</option>`).join('')}</select>`)}${F.f('Espaços',F.step('espacos',{min:0,max:99}),F.badge('espacos'))}${F.f('Quantidade ao forjar',F.input('qtd','1',{t:'num',type:'number',min:1,maxv:99}))}</div>`);
    }
    if(EX) h+=F.sec('IV','Quantidade',`<div class="fj-row">${F.f('Quantidade ao forjar',F.input('qtd','1',{t:'num',type:'number',min:1,maxv:99}))}</div>`);
    if(MU){
      const calChips=[...FM.CALIBRES.map(c=>({v:c.id,l:c.l})),{v:'custom',l:'Outro...'}];
      h+=F.sec('II','Munição',
        F.f('Calibre',F.chips('calibre',calChips,{rerender:true}))+
        (st.calibre==='custom'?F.f('Nome do calibre',F.input('calibreNome','Ex: Flecha de ossos',{max:30})):'')+
        F.f('Variante <span style="opacity:.6">(preenche os efeitos abaixo — tudo editável)</span>',`<div class="fj-chips">${FM.VARIANTES.map(v=>`<button type="button" class="fj-chip ${st.variante===v.id?'on':''}" data-act="mun-preset" data-v="${v.id}" title="${E(v.d)}">${E(v.l)}</button>`).join('')}</div>`)+
        `<div class="fj-row">${F.f('Balas ao forjar',F.input('qtd','30',{t:'num',type:'number',min:1,maxv:999}))}${F.f('Categoria',`<select data-ov="cat"><option value="">Automática</option>${CATS.slice(0,5).map(c=>`<option value="${c}">Cat ${c}</option>`).join('')}</select>`,F.badge('cat'))}</div>`,
        'Na mochila, cada unidade é uma bala. Armas do mesmo calibre gastam daqui ao recarregar.');
      h+=F.sec('III','Efeitos no disparo',
        `<div class="fj-row">${F.f('Dano (degraus)',F.input('mun.dm','0',{t:'num',type:'number',min:-4,maxv:4}))}${F.f('Crítico mais cedo (+n)',F.input('mun.cm','0',{t:'num',type:'number',min:-3,maxv:5}))}</div>`+
        `<div class="fj-row">${F.f('Bônus no ataque',F.input('mun.atq','0',{t:'num',type:'number',min:-10,maxv:10}))}${F.f('Ignora RD',F.input('mun.rdIgnora','0',{t:'num',type:'number',min:-10,maxv:20}))}</div>`+
        F.f('Tipo de dano',F.chips('mun.tipoDano',[{v:'',l:'Da arma'},...tdOrder.map(k=>({v:k,l:`${fjDot(TD(k))}${TD(k).nome}`,c:TD(k).cor}))])),
        'Degrau: +1 sobe o dado (1d8 → 1d10). RD negativa = a armadura do alvo protege mais. Esses efeitos valem enquanto a munição estiver carregada.');
      h+=F.sec('IV','Dano adicional', extrasHTML(st));
    }
    /* habilidades */
    const secN = A?'VI':(EX?'V':(MU?'V':'III'));
    h+=F.sec(secN,'Habilidades & efeitos',
      (st.habs||[]).map((x,i)=>`<div class="fj-list-row" data-row="habs"><div class="fj-lr-main"><input class="fj-in" data-b="habs.${i}.nome" placeholder="Nome da habilidade" maxlength="40"><textarea data-b="habs.${i}.desc" rows="2" placeholder="O que ela faz..."></textarea></div><button type="button" class="fj-rm" data-rm="habs:${i}">×</button></div>`).join('')+
      `<button type="button" class="fj-add" data-add="habs">＋ Nova habilidade</button>`+
      F.f('Modelos prontos <span style="opacity:.6">(clique para adicionar e editar)</span>',`<div class="fj-chips">${HAB_MODELOS.map((m,i)=>`<button type="button" class="fj-chip" data-habm="${i}" title="${E(m.desc)}">${E(m.nome)}</button>`).join('')}</div>`)
    );
    h+=F.sec(A?'VII':(EX?'VI':(MU?'VI':'IV')),'Descrição / Lore',`<textarea data-b="desc" rows="3" placeholder="Origem, aparência, detalhes..."></textarea>`);
    h+=`<datalist id="fj-testes"><option>Luta</option><option>Pontaria</option><option>Ocultismo</option><option>Atletismo</option><option>Acrobacia</option></datalist>`;
    return h;
  },
  afterRefresh(st){
    const body=document.getElementById('fj-body');
    body.querySelectorAll('select[data-b]').forEach(s=>{ if(document.activeElement!==s){ const v=getP(st,s.dataset.b); if(v!=null) s.value=String(v); } });
    // select de dano adicional precisa do valor do estado
    const sel=document.getElementById('fj-tplsel'); if(sel && !sel._bound){ sel._bound=true; sel.addEventListener('change',()=>{ if(sel.value){ applyTemplate(FJ.st, sel.value); FJ.dirty=true; renderForge(); } }); }
  },
  applyTemplate:(st,id)=>applyTemplate(st,id),
  onSet(st,path,v){
    const FM=window.FJ_MUN; if(!FM) return;
    if(path==='tipo'){
      if(v==='municao'){ if(!st.calibre) st.calibre='9mm'; if((+st.qtd||1)<=1) st.qtd=30; if(!st.variante) st.variante='comum'; munAutoNome(st); }
      else if(st.qtd===30) st.qtd=1;
    }
    else if(path==='calibre') munAutoNome(st);
    else if(path==='municaoCalibre'){ const c=FM.cal(v); if(c && !(+st.municaoMax)) st.municaoMax=c.cap; }
  },
  onAct(a,el,st){
    if(a==='mun-preset'){ munApplyVariante(st,el.dataset.v); markDirty(); renderForge(); return true; }
    return false;
  },

  previewHTML(st,calc){ return itemCardHTML(calc.obj, st); },
  summary(st,calc){ const o=calc.obj; const td=TD(o.tipoDano); return `<b>${E(o.nome||'Sem nome')}</b>${o.dam?` · ${E(o.dam)}${td?' '+fjDot(td):''}`:''}${o.crit?` · crít ${E(o.crit)}`:''}${o.defesa?` · DEF ${E(o.defesa)} RD ${E(o.rd)}`:''}${o.calibreNome?` · ${E(o.calibreNome)}${window.FJ_MUN&&o.variante&&o.variante!=='comum'?' '+E(window.FJ_MUN.varLabel(o.variante)):''} · ${st.qtd||1} bala(s)`:''} · cat ${E(o.cat)}`; },
  validate(st,editId){
    if(!cleanName(st.nome)) return 'Dê um nome ao item.';
    if(st.tipo==='municao'){ const FM=window.FJ_MUN; if(!FM||!FM.calKey(st.calibre,st.calibreNome)) return 'Escolha o calibre (ou dê um nome ao calibre personalizado).'; }
    if(isArma(st.tipo)||st.tipo==='explosivo'){ const c=calcItem(st).obj; if(!diceStats(c.dam)) return 'Dano principal inválido (use algo como 2d8+3).'; }
    return null;
  },
  save(st,editId,addBag){
    const c=curChar(); if(!c.customItens) c.customItens=[];
    const calc=calcItem(st).obj;
    let obj;
    if(editId){
      obj=c.customItens.find(i=>i.id===editId);
      Object.keys(obj).forEach(k=>delete obj[k]);
      Object.assign(obj,calc,{id:editId});
    } else { obj=Object.assign(calc,{id:uid()}); c.customItens.push(obj); }
    obj._custom=true; obj._forja=clone(st); obj._forja.qtd=st.qtd||1;
    if(!obj.desc) obj.desc = defaultDesc(obj);
    // atualiza entradas da mochila que apontam para este item
    (c.inv||[]).forEach(it=>{ if(it.dbId===obj.id){ it.nome=obj.nome; it.desc=obj.desc; if(obj.municao){ it.ammoMax=obj.municao.max; if(it.ammo>obj.municao.max||it.ammo==null) it.ammo=obj.municao.max; } } });
    let msg=editId?`${obj.nome} atualizado.`:`${obj.nome} guardado na biblioteca.`;
    if(addBag){ addToBag(obj.id, st.qtd||1); msg=`${obj.nome} forjado e adicionado à mochila!`; }
    return {obj,msg};
  },
  remove(id){
    const c=curChar();
    c.customItens=(c.customItens||[]).filter(i=>i.id!==id);
    c.inv=(c.inv||[]).filter(it=>it.dbId!==id);
    if(c.armaduraEquipada===id) delete c.armaduraEquipada;
  },
  addToBag:(id,q)=>addToBag(id,q),
  libCard(o){
    const cor=accentOf(o), td=TD(o.tipoDano);
    const inBag=((curChar().inv)||[]).filter(i=>i.dbId===o.id).reduce((a,i)=>a+(i.qtd||1),0);
    const stats=[o.dam?`<b>${E(o.dam)}</b>${td?' '+fjDot(td):''}`:'', o.crit?`crít ${E(o.crit)}`:'', o.alcance?`${E(o.alcance)}`:'', o.defesa?`DEF <b>${E(o.defesa)}</b>`:'', o.rd?`RD <b>${E(o.rd)}</b>`:'', o.calibreNome?`<b>${E(o.calibreNome)}</b>`:'', o.municao&&o.municao.calibre?`${o.municao.max} ${E(o.municao.nome||'')}`:'', `Cat ${E(o.cat)}`].filter(Boolean).join('<span>·</span>');
    return `<div class="fj-lib-card" style="--c:${cor}"><div class="fj-lib-top"><div class="fj-lib-ico">${itemIcon(o)}</div><div style="min-width:0"><div class="fj-lib-name">${E(o.nome)}</div><div class="fj-lib-meta">${stats}</div></div></div>
      <div class="fj-lib-meta"><span>${typeof _invTipoLabel==='function'?_invTipoLabel(o.tipo):o.tipo}</span>${inBag?`<span>${FJI.svg('mochila')}×${inBag} na mochila</span>`:''}</div>
      <div class="fj-lib-act"><button class="fj-btn sm" data-act="lib-edit" data-id="${o.id}">${FJI.svg('editar')}Editar</button><button class="fj-btn sm" data-act="lib-dup" data-id="${o.id}">${FJI.svg('duplicar')}Duplicar</button><button class="fj-btn sm" data-act="lib-bag" data-id="${o.id}">${FJI.svg('mochila')}+ Mochila</button><button class="fj-btn sm danger" data-act="lib-del" data-id="${o.id}">${FJI.svg('lixo')}</button></div></div>`;
  },
};
FJ.kinds.item=itemKind;

function itemIcon(o){ return FJI.itemHtml(o); }
window.fjItemIcon=itemIcon;
function defaultDesc(o){ return o.tipo==='arma'?`Arma customizada (${o.subTipo==='fogo'?'de fogo':'branca'}).`:o.tipo==='armadura'?'Armadura customizada.':o.tipo==='explosivo'?'Explosivo customizado.':o.tipo==='municao'?'Munição customizada ('+(o.calibreNome||'calibre livre')+'). Cada unidade na mochila é uma bala.':'Item customizado.'; }

function templateOptions(tipo){
  const T=TIPOS[tipo]; if(!T||typeof ITENS_DB==='undefined') return '';
  const list=ITENS_DB.filter(i=>!i._custom && (T.db==='armadura'?(i.tipo==='armadura'||i.tipo==='protecao'):i.tipo===T.db) && (!T.sub||i.subTipo===T.sub)).sort((a,b)=>a.nome.localeCompare(b.nome,'pt'));
  return list.map(i=>`<option value="${E(i.id)}">${E(i.nome)}${i.dam?' — '+E(i.dam):''}${i.rd?' — RD '+E(i.rd):''}</option>`).join('');
}
function applyTemplate(st,id){
  const o=ITENS_DB.find(i=>i.id===id); if(!o) return;
  const keepNome=st.nome, keepTipo=st.tipo;
  const fresh=newItemState(keepTipo); Object.assign(st,fresh); fillFromDb(st,o);
  st.tipo=keepTipo;
  st.nome = keepNome || (o.nome+' (variante)');
  if(st.tipo==='municao'){ // munição: caixa do modelo e nome automático (a menos que o usuário já tenha escrito o dele)
    st.qtd=o.pacote||30;
    st.nome = (keepNome && keepNome!==fresh._autoNome) ? keepNome : '';
    st._autoNome=''; munAutoNome(st);
  }
  if(isArma(st.tipo)&&st.alcance==null) st.alcance='';
}
function addToBag(id,qtd){
  const c=curChar(); const o=(c.customItens||[]).find(i=>i.id===id); if(!o) return;
  qtd=Math.max(1,parseInt(qtd)||1);
  if(!c.inv) c.inv=[];
  const stack=(o.tipo==='item-comum'||o.tipo==='equipamento'||o.tipo==='explosivo'||o.tipo==='municao');
  const ex=c.inv.find(x=>x.dbId===id);
  if(ex&&stack){ ex.qtd=(ex.qtd||1)+qtd; }
  else { const e={nome:o.nome,desc:o.desc,qtd:stack?qtd:1,dbId:id}; if(o.municao){ e.ammoMax=o.municao.max; e.ammo=o.municao.max; } c.inv.push(e); if(!stack&&qtd>1){ for(let i=1;i<qtd;i++) c.inv.push(Object.assign({},e)); } }
  toastF(o.tipo==='municao'?`${qtd} × ${o.nome} na mochila.`:`${o.nome} na mochila.`,'#ee8822');
}

/* ───── cartão de pré-visualização do item ───── */
function itemCardHTML(o, st){
  const cor=accentOf(o), td=TD(o.tipoDano);
  const T=TIPOS[st.tipo]||{};
  const meta=[T.l, o.peso?({leve:'Leve',media:'Média',pesada:'Pesada'}[o.peso]):'', 'Cat '+o.cat].filter(Boolean).join(' · ');
  let stats='';
  if(o.tipo==='arma'||o.tipo==='explosivo'){
    stats=`<div class="fj-stats"><div class="fj-stat"><span>Dano</span><b class="dm">${E(o.dam)}</b><small>${td?fjDot(td)+' '+td.nome:''}</small></div>
      <div class="fj-stat"><span>${o.tipo==='arma'?'Crítico':'Área'}</span><b>${E(o.tipo==='arma'?o.crit:(o.area||'—'))}</b><small>${o.tipo==='arma'?'ameaça / mult.':'de efeito'}</small></div>
      <div class="fj-stat"><span>${o.tipo==='arma'?'Alcance':'Crítico'}</span><b>${E(o.tipo==='arma'?(o.alcance||'C/C'):(o.crit||'—'))}</b><small>${o.tipo==='arma'?maosLabel(o.maos):''}</small></div></div>`;
  } else if(o.tipo==='armadura'){
    stats=`<div class="fj-stats"><div class="fj-stat"><span>Defesa</span><b class="dm">${E(o.defesa)}</b></div><div class="fj-stat"><span>RD</span><b>${E(o.rd)}</b><small>${o.rdTipo==null?'Físico geral':o.rdTipo==='paranormal'?'Paranormal':(TD(o.rdTipo)?TD(o.rdTipo).nome:E(o.rdTipo))}</small></div><div class="fj-stat"><span>Espaços</span><b>${o.espacos}</b></div></div>`;
  }
  if(o.tipo==='municao'){
    const FM=window.FJ_MUN, rs=FM?FM.resumoMod(o):[], m=o.munMod||{};
    stats=`<div class="fj-stats"><div class="fj-stat"><span>Calibre</span><b class="dm">${E(o.calibreNome||'—')}</b><small>${E(FM?FM.varLabel(o.variante):'')}</small></div>
      <div class="fj-stat"><span>Dano</span><b>${m.dm?(m.dm>0?'+':'')+m.dm:'—'}</b><small>${m.dm?'degrau'+(Math.abs(m.dm)>1?'s':''):'da arma'}</small></div>
      <div class="fj-stat"><span>RD</span><b>${m.rdIgnora?(m.rdIgnora>0?'−'+m.rdIgnora:'+'+(-m.rdIgnora)):'—'}</b><small>${m.rdIgnora>0?'ignorada':(m.rdIgnora<0?'a mais no alvo':'normal')}</small></div></div>`;
  }
  const pills=[];
  if(o.tipo==='municao'){
    const m=o.munMod||{};
    if(m.cm) pills.push(`<span class="fj-pill">ameaça ${m.cm>0?'+':''}${m.cm}</span>`);
    if(m.atq) pills.push(`<span class="fj-pill">${m.atq>0?'+':''}${m.atq} ataque</span>`);
    if(m.tipoDano&&TD(m.tipoDano)) pills.push(`<span class="fj-pill c" style="--c:${TD(m.tipoDano).cor}">${fjDot(TD(m.tipoDano))} ${TD(m.tipoDano).nome}</span>`);
    pills.push(`<span class="fj-pill c" style="--c:#d4a044">${st.qtd||1} bala${(st.qtd||1)>1?'s':''}</span>`);
  }
  if(o.tipo==='arma'){ pills.push(`<span class="fj-pill c">${E(o.teste||'Luta')}${o.bonusAtq?(o.bonusAtq>0?' +':' ')+o.bonusAtq:''}</span>`); pills.push(`<span class="fj-pill">${o.espacos} esp.</span>`); }
  else if(o.tipo!=='armadura'&&o.tipo!=='municao') pills.push(`<span class="fj-pill">${o.espacos} esp.</span>`);
  (o.danoExtra||[]).forEach(e=>{ const t=TD(e.tipo); pills.push(`<span class="fj-pill c" style="--c:${t?t.cor:cor}">+${E(e.expr)} ${t?fjDot(t)+' '+t.nome:''}</span>`); });
  if(o.municao){ pills.push(`<span class="fj-pill c" style="--c:#d4a044">${FJI.svg('pistola')}${o.municao.max} ${E(o.municao.nome||'munições')}${o.municao.gasto>1?' (−'+o.municao.gasto+'/ataque)':''}</span>`);
    if(o.municao.recarga==='unitaria') pills.push(`<span class="fj-pill">recarga: um por vez</span>`);
    if(o.municao.rajada) pills.push(`<span class="fj-pill c" style="--c:#ee8822">rajada (−3)</span>`); }
  if(st.qtd>1&&(o.tipo==='item-comum'||o.tipo==='equipamento'||o.tipo==='explosivo')) pills.push(`<span class="fj-pill">×${st.qtd}</span>`);
  let avg='';
  if(o.dam){
    const s=diceStats(o.dam), x=critMult(o); let tot={min:0,max:0,avg:0}, totc={max:0,avg:0};
    const comps=[{expr:o.dam},...(o.danoExtra||[])];
    comps.forEach(cp=>{ const a=diceStats(cp.expr), b=diceStats(cp.expr,x); if(a){ tot.min+=a.min; tot.max+=a.max; tot.avg+=a.avg; } if(b){ totc.max+=b.max; totc.avg+=b.avg; } });
    if(s) avg=`<div class="fj-avg"><span>Total <b>${tot.min}–${tot.max}</b></span><span>média <b>${tot.avg.toFixed(1).replace('.',',')}</b></span>${o.tipo==='arma'?`<span>crítico (×${x}) média <b>${totc.avg.toFixed(1).replace('.',',')}</b> · máx <b>${totc.max}</b></span>`:''}</div>`;
  }
  const habs=(o.habilidades||[]).map(h=>`<div class="fj-hab"><b>${E(h.nome)}.</b> ${E(h.desc)}</div>`).join('');
  return `<div class="fj-card" style="--c:${cor}">
    <div class="fj-card-top"><div class="fj-card-ico">${itemIcon(o)}</div><div style="min-width:0"><div class="fj-card-name ${o.nome?'':'empty'}">${E(o.nome||'Sem nome')}</div><div class="fj-card-meta">${E(meta)}</div></div></div>
    ${stats}${pills.length?`<div class="fj-pills">${pills.join('')}</div>`:''}
    ${habs?`<div class="fj-card-sec"><h4>Habilidades</h4>${habs}</div>`:''}
    ${o.desc?`<div class="fj-lore">${E(o.desc)}</div>`:''}${avg}</div>`;
}
window.fjItemCardHTML = itemCardHTML;

/* ═══════════════════════════════════════════
   API PÚBLICA
═══════════════════════════════════════════ */
window.abrirForja = (tipo)=>open('item',{tipo:tipo||undefined});
window.abrirForjaBiblioteca = (kind)=>open(kind||'item',{view:'lib'});
window.fjOpen = open;
window.fjEditarItem = id=>open('item',{edit:id});
window.fjEditarRitual = nome=>open('ritual',{edit:nome});
window.abrirCriarItemModal = ()=>open('item');     // compat. com o botão antigo
window.fjUtil = {parseCrit,fmtCrit,rollExpr,diceStats,maosLabel,TD,E,clone,uid,cleanName,cleanTxt,accentOf};

})();
