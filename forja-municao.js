/* ════════════════════════════════════════════════════════════
   FORJA-MUNICAO.JS — Sistema de munições para armas de fogo
   ────────────────────────────────────────────────────────────
   • Calibres (catálogo) e variantes de munição (perfurante,
     expansiva, incendiária...). Tudo editável na Forja.
   • Munição vira ITEM da mochila (tipo 'municao'): cada unidade
     na mochila = 1 bala. Armas com calibre consomem dessa reserva
     ao recarregar, e o tipo carregado altera dano/crítico/RD.
   • Semeia o Arsenal com "Munição <calibre>" (comum) e dá um
     perfil de munição às armas de fogo já existentes.

   Carregar DEPOIS de app.js e ANTES de forja.js.
   Funções que mexem na ficha (recarregar, atacar) ficam em
   forja-uso.js; aqui só dados + funções puras.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* cat = categoria base da caixa; cap = capacidade típica da arma;
   caixa = quantas balas vêm numa compra; rec = modo de recarga padrão */
const CALIBRES = [
  {id:'9mm',   l:'9mm',             cat:'0', cap:15, caixa:30},
  {id:'38',    l:'.38',             cat:'0', cap:6,  caixa:24},
  {id:'44',    l:'.44 Magnum',      cat:'I', cap:6,  caixa:18},
  {id:'45',    l:'.45 ACP',         cat:'I', cap:8,  caixa:24},
  {id:'556',   l:'5,56 mm',         cat:'I', cap:30, caixa:60},
  {id:'762',   l:'7,62 mm',         cat:'I', cap:20, caixa:40},
  {id:'308',   l:'.308 Win',        cat:'II',cap:5,  caixa:20},
  {id:'50',    l:'.50 BMG',         cat:'II',cap:5,  caixa:10},
  {id:'cal12', l:'Calibre 12',      cat:'I', cap:2,  caixa:12, rec:'unitaria'},
  {id:'dardo', l:'Dardos',          cat:'0', cap:6,  caixa:12},
  {id:'antecarga',l:'Bala de antecarga',cat:'0',cap:1,caixa:6,  rec:'unitaria'},
  {id:'granada',l:'Granada 40 mm',  cat:'II',cap:1,  caixa:4,  rec:'unitaria'},
  {id:'foguete',l:'Foguete',        cat:'II',cap:1,  caixa:2,  rec:'unitaria'},
  /* itens que já existem no Arsenal (só ganham o campo calibre) */
  {id:'bola-canhao',l:'Bola de Canhão',cat:'0',cap:1,caixa:1,rec:'unitaria',existente:'bola-canhao'},
  {id:'missil',     l:'Míssil',        cat:'III',cap:1,caixa:1,rec:'unitaria',existente:'missil'},
];
const calById = id => CALIBRES.find(c=>c.id===id)||null;

const slug = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30);
/* sel = id do catálogo | 'custom' | ''  ·  txt = nome livre (calibre 'custom') */
function calKey(sel, txt){
  if(!sel) return '';
  if(sel==='custom'){ const s=slug(txt); return s?('x-'+s):''; }
  return sel;
}
function calLabel(key, fallback){
  const c=calById(key); if(c) return c.l;
  return fallback || (key&&key.startsWith('x-')?key.slice(2).replace(/-/g,' '):'') || '';
}
/* inverso, para preencher o formulário a partir de um item salvo */
function calSel(key){ if(!key) return ''; return calById(key)?key:'custom'; }
const calRec = key => (calById(key)||{}).rec || 'carregador';

/* ───────── variantes (presets) ─────────
   mod: dm = degraus de dano · cm = margem de ameaça (+n = crítico n números mais cedo)
        atq = bônus no ataque · rdIgnora = RD ignorada (negativo = armadura vale mais)
        tipoDano = força o tipo de dano da arma
   cat: soma na categoria do calibre */
const VARIANTES = [
  {id:'comum', l:'Comum', d:'Sem modificadores.', cat:0, mod:{}, extras:[], habs:[]},
  {id:'perfurante', l:'Perfurante', d:'Ignora 2 de RD do alvo.', cat:1, mod:{rdIgnora:2}, extras:[],
    habs:[{nome:'Perfurante',desc:'Ignora 2 pontos de RD do alvo.'}]},
  {id:'expansiva', l:'Expansiva', d:'+1 degrau de dano, mas a RD do alvo conta +2.', cat:1, mod:{dm:1,rdIgnora:-2}, extras:[],
    habs:[{nome:'Expansiva',desc:'Deforma ao atingir: +1 degrau de dano. Armaduras são mais eficazes contra ela (RD +2).'}]},
  {id:'subsonica', l:'Subsônica', d:'−1 degrau de dano; disparo discreto.', cat:1, mod:{dm:-1}, extras:[],
    habs:[{nome:'Subsônica',desc:'Disparo bem mais discreto; com silenciador não faz barulho perceptível.'}]},
  {id:'tracante', l:'Traçante', d:'+1 no ataque; revela o atirador.', cat:1, mod:{atq:1}, extras:[],
    habs:[{nome:'Traçante',desc:'Deixa um rastro luminoso: +1 no ataque, mas revela a posição do atirador.'}]},
  {id:'precisao', l:'Precisão', d:'Margem de ameaça +1.', cat:1, mod:{cm:1}, extras:[],
    habs:[{nome:'Precisão',desc:'Fabricada com tolerância mínima: a margem de ameaça da arma aumenta em 1.'}]},
  {id:'incendiaria', l:'Incendiária', d:'+1d6 de dano adicional.', cat:2, mod:{}, extras:[{expr:'1d6',tipo:'F'}],
    habs:[{nome:'Incendiária',desc:'O alvo pode pegar fogo (efeito a critério do mestre). Perigosa perto de materiais inflamáveis.'}]},
  {id:'explosiva', l:'Explosiva', d:'+1d8 de dano adicional.', cat:2, mod:{}, extras:[{expr:'1d8',tipo:'F'}],
    habs:[{nome:'Explosiva',desc:'Detona ao impacto: o estilhaçar pode ferir quem estiver colado ao alvo (a critério do mestre).'}]},
  {id:'borracha', l:'Borracha', d:'−2 degraus; dano não letal.', cat:0, mod:{dm:-2,tipoDano:'F'}, extras:[],
    habs:[{nome:'Não letal',desc:'O dano é não letal: o alvo fica inconsciente em vez de morrer.'}]},
  {id:'paranormal', l:'Paranormal', d:'+1d6 de dano de um elemento.', cat:2, mod:{}, extras:[{expr:'1d6',tipo:'S'}],
    habs:[{nome:'Gravada',desc:'Marcada com símbolo ritualístico: o dano adicional conta como paranormal. Troque o elemento em Dano adicional.'}]},
];
const variante = id => VARIANTES.find(v=>v.id===id)||null;
const varLabel = id => (variante(id)||{}).l || (id&&id!=='custom'?id:'');

/* ───────── cálculo do disparo ───────── */
function addDie(expr){ return String(expr).replace(/(\d+)d(\d+)/i,(m,n,f)=>(+n+1)+'d'+f); }

/* Arma "efetiva": a arma + os efeitos da munição carregada (+ rajada).
   Não altera os objetos do banco; devolve uma cópia. */
function efetiva(db, am, o){
  o=o||{};
  const U=window.fjUI, mod=(am&&am.munMod)||{};
  let dam=db.dam;
  if(mod.dm) dam=U.ladderShift(dam,mod.dm);
  if(o.rajada) dam=addDie(dam);
  const c=U.parseCrit(db.crit||'20');
  const m=Math.max(15,Math.min(20,c.m-(+mod.cm||0)));
  return Object.assign({},db,{
    dam, critM:m, critX:c.x, crit:U.fmtCrit(m,c.x),
    tipoDano: mod.tipoDano||db.tipoDano||'F',
    danoExtra:[...(db.danoExtra||[]),...((am&&am.danoExtra)||[])],
    bonusAtq:(+db.bonusAtq||0)+(+mod.atq||0)+(o.rajada?2:0),
    rdIgnora:+mod.rdIgnora||0,
    _ammo:am||null
  });
}
const podeRajada = db => !!(db && db.municao && (db.municao.rajada || (db.habilidades||[]).some(h=>/rajada/i.test(h.nome))));

/* Texto curto dos efeitos de uma munição (chips / pré-visualização) */
function resumoMod(am){
  const m=(am&&am.munMod)||{}, out=[];
  if(m.dm) out.push((m.dm>0?'+':'')+m.dm+' degrau'+(Math.abs(m.dm)>1?'s':'')+' de dano');
  if(m.rdIgnora) out.push(m.rdIgnora>0?'ignora '+m.rdIgnora+' RD':'RD alvo +'+(-m.rdIgnora));
  if(m.cm) out.push('ameaça '+(m.cm>0?'+':'')+m.cm);
  if(m.atq) out.push((m.atq>0?'+':'')+m.atq+' ataque');
  if(m.tipoDano&&window.fjUI&&window.fjUI.TD(m.tipoDano)) out.push('dano '+window.fjUI.TD(m.tipoDano).nome);
  (am&&am.danoExtra||[]).forEach(e=>out.push('+'+e.expr));
  return out;
}

/* ───────── reserva na mochila ───────── */
const getDb = id => (typeof ITENS_DB!=='undefined') ? ITENS_DB.find(x=>x.id===id) : null;
const isMunicao = db => !!(db && db.calibre && db.tipo!=='arma');
function stacksFor(c, calibre){
  return (c.inv||[]).map((it,idx)=>({it,idx,db:it.dbId?getDb(it.dbId):null}))
    .filter(s=>isMunicao(s.db) && s.db.calibre===calibre && (s.it.qtd==null?1:s.it.qtd)>0);
}
function reserva(c, calibre){ return stacksFor(c,calibre).reduce((a,s)=>a+(s.it.qtd==null?1:s.it.qtd),0); }
function comumId(calibre){
  const cal=calById(calibre);
  if(cal&&cal.existente) return cal.existente;
  return 'mun-'+calibre+'-comum';
}
function devolver(c, dbId, n){
  if(!dbId||n<=0) return;
  const db=getDb(dbId); if(!db) return;
  if(!c.inv) c.inv=[];
  const ex=c.inv.find(x=>x.dbId===dbId);
  if(ex) ex.qtd=(ex.qtd==null?1:ex.qtd)+n;
  else c.inv.push({nome:db.nome,desc:db.desc,qtd:n,dbId});
}

/* ───────── semeia o Arsenal ───────── */
/* Perfil de munição das armas de fogo que já existem (ids do ITENS_DB). */
const PERFIL = {
  'pistola':           {calibre:'9mm',max:15},
  'pistola-silenciada':{calibre:'9mm',max:15},
  'submetralhadora':   {calibre:'9mm',max:30,rajada:true},
  'revolver':          {calibre:'38', max:6},
  'pistola-pesada':    {calibre:'44', max:8},
  'espingarda':        {calibre:'cal12',max:2},
  'fuzil-caca':        {calibre:'308',max:5},
  'fuzil-assalto':     {calibre:'556',max:30,rajada:true},
  'carabina':          {calibre:'556',max:20},
  'rifle-tatico':      {calibre:'762',max:20},
  'fuzil-precisao':    {calibre:'308',max:5},
  'metralhadora':      {calibre:'762',max:100,rajada:true},
  'bazuca':            {calibre:'foguete',max:1},
  'bacamarte':         {calibre:'antecarga',max:1},
  'mosquete':          {calibre:'antecarga',max:1},
  'pistola-dardos':    {calibre:'dardo',max:6},
  'zarabatana':        {calibre:'dardo',max:1,recarga:'unitaria'},
  'lanca-granadas':    {calibre:'granada',max:1},
  'canhao-torre':      {calibre:'bola-canhao',max:1},
  'lanca-misseis':     {calibre:'missil',max:1},
};
function semear(){
  if(typeof ITENS_DB==='undefined') return;
  CALIBRES.forEach(cal=>{
    if(cal.existente){ const it=getDb(cal.existente); if(it && !it.calibre) it.calibre=cal.id; return; }
    const id='mun-'+cal.id+'-comum';
    if(getDb(id)) return;
    ITENS_DB.push({id,nome:'Munição '+cal.l,tipo:'municao',calibre:cal.id,calibreNome:cal.l,variante:'comum',
      cat:cal.cat,espacos:1,pacote:cal.caixa,
      desc:'Caixa com '+cal.caixa+' unidades de '+cal.l+'. Cada unidade na mochila é uma bala: recarregue uma arma desse calibre para gastá-las. Variantes especiais (perfurante, expansiva, incendiária...) são criadas na Forja.'});
  });
  ITENS_DB.forEach(i=>{
    if(i.tipo!=='arma'||i.municao) return;
    const p=PERFIL[i.id]; if(!p) return;
    const cal=calById(p.calibre);
    i.municao={max:p.max,gasto:1,nome:cal?cal.l:'',calibre:p.calibre};
    const rec=p.recarga||(cal&&cal.rec); if(rec==='unitaria') i.municao.recarga='unitaria';
    if(p.rajada) i.municao.rajada=true;
  });
}
semear();

window.FJ_MUN = {
  CALIBRES, VARIANTES, PERFIL,
  cal:calById, calKey, calLabel, calSel, calRec,
  variante, varLabel, efetiva, podeRajada, resumoMod, addDie,
  isMunicao, stacksFor, reserva, comumId, devolver, getDb, slug
};
})();
