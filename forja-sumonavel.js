/* ════════════════════════════════════════════════════════════
   FORJA-SUMONAVEL.JS — Criação de Sumonáveis + painel de Sumonados
   ────────────────────────────────────────────────────────────
   • Novo "kind" da Forja (forja.js): formulário, pré-visualização,
     biblioteca (editar / duplicar / invocar / excluir) e export/import.
   • Rituais autorais (forja-ritual.js) podem vincular sumonáveis.
     Ao conjurar o ritual, os sumonáveis entram no painel "Sumonados"
     da aba Rituais, com PV, ataques rolados e botão de dispensar.
   • Dados na ficha:
       c.customSumonaveis = [ modelos criados pelo jogador ]
       c.sumonados        = [ cópias ativas (snapshot + PV atual) ]
   Carregar DEPOIS de forja.js / forja-ritual.js / forja-uso.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const U = window.fjUI, FJ = window.FJ;
const {F,E,cleanName,cleanTxt,clone,uid,getP,setP,diceStats,rollExpr,parseCrit,TD,tdOrder,toastF,curChar} = U;

const ELEMS = ['Sangue','Morte','Energia','Conhecimento','Medo'];
const ELEM_SYM = {Sangue:'sym-sangue',Morte:'sym-morte',Energia:'sym-energia',Conhecimento:'sym-conhecimento',Medo:'sym-medo'};
const ELEM_COL = {Sangue:'#dd0000',Morte:'#8a7ab0',Energia:'#a60df2',Conhecimento:'#c8a000',Medo:'#2f7fe0'};
const ELEM_DANO = {Sangue:'S',Morte:'M',Energia:'E',Conhecimento:'K',Medo:'Me'};
const ACCENT = '#4fd1a5';
const TAMANHOS = ['Minúsculo','Pequeno','Médio','Grande','Enorme','Colossal'];
const ATTRS = [['FIS','Físico'],['EMO','Emoção'],['MEN','Mente']];
/* sumonáveis salvos com 5 atributos (AGI/FOR/INT/PRE/VIG) → FIS (o maior dos três físicos) / EMO / MEN */
function sumAttrs(a){
  a = a || {};
  const n = v => (typeof v === 'number' && !isNaN(v));
  const fis = [a.AGI, a.FOR, a.VIG].filter(n);
  return {
    FIS: n(a.FIS) ? a.FIS : (fis.length ? Math.max(...fis) : 0),
    EMO: n(a.EMO) ? a.EMO : (n(a.PRE) ? a.PRE : 0),
    MEN: n(a.MEN) ? a.MEN : (n(a.INT) ? a.INT : 0),
  };
}
const ICONES = ['cranio','osso','fantasma','aranha','morcego','serpente','olho','gota','vela','corrente','fogo','lua','garra','chifre','tumulo','raio'];
const CONTROLE = ['Age no turno do conjurador','Age por conta própria (Mestre decide)','Obedece ordens do conjurador'];
/* valores sugeridos conforme o "poder" (equivale ao círculo do ritual) */
const AUTO = {
  1:{pv:15,def:13,desl:9, bonus:8, dam:'1d6+2'},
  2:{pv:30,def:16,desl:9, bonus:12,dam:'2d6+3'},
  3:{pv:50,def:19,desl:12,bonus:16,dam:'3d8+4'},
  4:{pv:80,def:22,desl:12,bonus:20,dam:'4d10+5'},
};
const HAB_MODELOS = [
  {nome:'Voo',desc:'Pode voar, com deslocamento igual ao terrestre.'},
  {nome:'Regeneração',desc:'Recupera 2 PV no início de cada um de seus turnos.'},
  {nome:'Visão no Escuro',desc:'Ignora camuflagem causada por escuridão.'},
  {nome:'Sem Mente',desc:'Imune a efeitos mentais e de medo.'},
  {nome:'Vínculo',desc:'Se o conjurador ficar inconsciente, o sumonável desaparece.'},
  {nome:'Explosão Final',desc:'Ao chegar a 0 PV, explode: 2d6 de dano de seu elemento em alcance curto.'},
];
const MAX_ATIVOS = 30;
const fmtB = n => (n>=0?'+':'')+n;
const dmgEl = el => ELEM_DANO[el]||'F';

/* ═══════════════ ESTADO / CÁLCULO ═══════════════ */
function newRow(path){
  if(path==='ataques'){ const el=FJ.st&&FJ.st.elem; return {nome:'',bonus:null,dam:null,tipoDano:dmgEl(el),alcance:'Corpo a corpo',crit:''}; }
  return {nome:'',desc:''};
}
function newState(){
  return { nome:'', icone:'', elem:'Sangue', tamanho:'Médio', natureza:'', poder:1,
    pv:null, def:null, desl:null, rd:0, rdTxt:'', resist:'', pericias:'', controle:CONTROLE[0],
    attrs:{FIS:1,EMO:0,MEN:0},
    ataques:[ {nome:'Ataque',bonus:null,dam:null,tipoDano:'S',alcance:'Corpo a corpo',crit:''} ],
    habs:[], desc:'' };
}
function calc(st){
  const auto = Object.assign({}, AUTO[st.poder]||AUTO[1]);
  const num=(v,a)=> (v==null||v==='') ? a : Number(v);
  const o = {
    nome:cleanName(st.nome), icone:String(st.icone||'').slice(0,4), elem:st.elem||'', tamanho:st.tamanho||'Médio',
    natureza:cleanName(st.natureza), poder:Number(st.poder)||1,
    pv:Math.max(1,num(st.pv,auto.pv)), def:num(st.def,auto.def), desl:Math.max(0,num(st.desl,auto.desl)),
    rd:Math.max(0,Number(st.rd)||0), rdTxt:cleanTxt(st.rdTxt), resist:cleanTxt(st.resist), pericias:cleanTxt(st.pericias),
    controle:cleanTxt(st.controle)||CONTROLE[0],
    attrs:{}, desc:cleanTxt(st.desc),
  };
  const _sa=sumAttrs(st.attrs);
  ATTRS.forEach(([k])=>{ o.attrs[k]=Number(_sa[k])||0; });
  o.ataques=(st.ataques||[]).filter(a=>a&&cleanName(a.nome)).map(a=>({
    nome:cleanName(a.nome), bonus:num(a.bonus,auto.bonus),
    dam:String(a.dam==null||a.dam===''?auto.dam:a.dam).replace(/\s+/g,''),
    tipoDano:a.tipoDano||dmgEl(st.elem), alcance:cleanTxt(a.alcance)||'Corpo a corpo', crit:cleanTxt(a.crit)
  }));
  o.habs=(st.habs||[]).filter(h=>h&&cleanName(h.nome)).map(h=>({nome:cleanName(h.nome),desc:cleanTxt(h.desc)}));
  return {obj:o, auto};
}
function find(id){ const c=curChar(); return c?(c.customSumonaveis||[]).find(s=>s.id===id):null; }
function stateFrom(o){
  if(o._forja){ const _s=Object.assign(newState(), clone(o._forja)); _s.attrs=sumAttrs(_s.attrs); return _s; }
  const st=newState(); // importado sem _forja: reconstrói
  ['nome','icone','elem','tamanho','natureza','poder','pv','def','desl','rd','rdTxt','resist','pericias','controle','desc'].forEach(k=>{ if(o[k]!=null) st[k]=o[k]; });
  st.attrs=Object.assign(st.attrs,sumAttrs(o.attrs));
  st.ataques=(o.ataques||[]).map(a=>({nome:a.nome,bonus:a.bonus,dam:a.dam,tipoDano:a.tipoDano||'F',alcance:a.alcance||'',crit:a.crit||''}));
  st.habs=clone(o.habs||[]);
  return st;
}
const accentOf = o => (o&&o.elem&&ELEM_COL[o.elem]) || ACCENT;

/* ═══════════════ KIND DA FORJA ═══════════════ */
const kind = {
  accent:ACCENT, icon:'cranio',
  get primary(){ return FJI.svg('cranio')+(FJ.afterClose ? 'Registrar e voltar ao ritual' : 'Registrar e invocar agora'); },
  title:'Criação de Sumonáveis', editTitle:'Editar sumonável',
  sub:'Crie criaturas, espíritos e servos que seus rituais podem invocar',
  libTitle:'Bestiário de Sumonáveis', libSub:'Sumonáveis criados por você', libEmpty:'Nenhum sumonável ainda. Use “Criar novo” para escrever o primeiro.',
  newState, stateFrom, find, calc, newRow,
  accentOf:(st)=>accentOf(st),
  libList:()=>{ const c=curChar(); return c?(c.customSumonaveis||[]):[]; },

  formHTML(st){
    let h='';
    h+=F.sec('I','Identidade',
      F.f('Nome do sumonável *',F.input('nome','Ex: Cão de Lodo',{max:60}))+
      F.f('Ícone',`<div class="fj-chips">${ICONES.map(i=>`<button type="button" class="fj-chip ico" data-set="icone" data-v="${i}" data-toggleoff title="${i}">${FJI.svg(i)}</button>`).join('')}</div>`)+
      F.f('Elemento',`<div class="fj-chips">${ELEMS.map(e=>`<button type="button" class="fj-chip big" data-set="elem" data-v="${e}" style="--cc:${ELEM_COL[e]}"><span class="sym-el ${ELEM_SYM[e]}"></span>${e}</button>`).join('')}<button type="button" class="fj-chip big" data-set="elem" data-v="">Nenhum</button></div>`)+
      `<div class="fj-row">${F.f('Tamanho',F.chips('tamanho',TAMANHOS.map(t=>({v:t,l:t}))))}</div>`+
      `<div class="fj-row">${F.f('Natureza',F.input('natureza','Ex: Morto-vivo, Espírito, Besta...',{max:40}))}${F.f('Poder <span style="opacity:.6">(sugere os números)</span>',F.chips('poder',[1,2,3,4].map(n=>({v:n,l:n+'º',t:'Equivale ao '+n+'º círculo'})),{n:true}))}</div>`
    );
    h+=F.sec('II','Atributos & defesa',
      `<div class="fj-row fj-row5">${ATTRS.map(([k,l])=>F.f(l,F.step('attrs.'+k,{min:0,max:20}))).join('')}</div>`+
      `<div class="fj-row">${F.f('Pontos de Vida',F.step('pv',{auto:'pv',min:1,max:999}),F.badge('pv'))}${F.f('Defesa',F.step('def',{auto:'def',min:0,max:60}),F.badge('def'))}${F.f('Deslocamento (m)',F.step('desl',{auto:'desl',min:0,max:60}),F.badge('desl'))}</div>`+
      `<div class="fj-row">${F.f('RD (redução de dano)',F.step('rd',{min:0,max:50}))}${F.f('RD contra...',F.input('rdTxt','Ex: balístico, físico, tudo',{max:60}))}</div>`+
      F.f('Resistências / imunidades / vulnerabilidades',F.input('resist','Ex: imune a Morte; vulnerável a Energia',{max:140}))+
      F.f('Perícias',F.input('pericias','Ex: Luta +10, Percepção +8, Furtividade +6',{max:140})),
      'Os valores com selo AUTO seguem o “poder” escolhido. Mexeu em qualquer um? Vira MANUAL (o botão de reiniciar volta ao automático).'
    );
    h+=F.sec('III','Ataques',
      (st.ataques||[]).map((a,i)=>`<div class="fj-list-row" data-row="ataques"><div class="fj-lr-main">
        <div class="fj-lr-2"><input class="fj-in" data-b="ataques.${i}.nome" placeholder="Nome (ex: Garras)" maxlength="40" autocomplete="off">${F.ovInput(`ataques.${i}.bonus`,'+8',{t:'num',type:'number',auto:'bonus',min:-20,maxv:60})}</div>
        <div class="fj-lr-3">${F.ovInput(`ataques.${i}.dam`,'2d6+3',{auto:'dam'})}<select data-b="ataques.${i}.tipoDano">${tdOrder.map(k=>`<option value="${k}">${TD(k).nome}</option>`).join('')}</select><input class="fj-in" data-b="ataques.${i}.alcance" placeholder="Alcance" maxlength="30" autocomplete="off"></div>
        <input class="fj-in" data-b="ataques.${i}.crit" placeholder="Crítico (opcional): 19, x3 ou 19/x3 — padrão 20/x2" maxlength="12" autocomplete="off">
      </div><button type="button" class="fj-rm" data-rm="ataques:${i}">×</button></div>`).join('')+
      `<button type="button" class="fj-add" data-add="ataques">＋ Novo ataque</button>`,
      'Campos de bônus e dano vazios usam o valor AUTO do poder. No painel de sumonados cada ataque ganha botões de rolagem.'
    );
    h+=F.sec('IV','Habilidades',
      (st.habs||[]).map((x,i)=>`<div class="fj-list-row" data-row="habs"><div class="fj-lr-main"><input class="fj-in" data-b="habs.${i}.nome" placeholder="Nome da habilidade" maxlength="40"><textarea data-b="habs.${i}.desc" rows="2" placeholder="O que ela faz..."></textarea></div><button type="button" class="fj-rm" data-rm="habs:${i}">×</button></div>`).join('')+
      `<button type="button" class="fj-add" data-add="habs">＋ Nova habilidade</button>`+
      F.f('Modelos prontos <span style="opacity:.6">(clique para adicionar e editar)</span>',`<div class="fj-chips">${HAB_MODELOS.map((m,i)=>`<button type="button" class="fj-chip" data-act="sum-hab" data-i="${i}" title="${E(m.desc)}">${E(m.nome)}</button>`).join('')}</div>`)
    );
    h+=F.sec('V','Comportamento & descrição',
      F.f('Quem controla',F.chips('controle',CONTROLE.map(t=>({v:t,l:t}))))+
      F.f('Descrição / lore',`<textarea data-b="desc" rows="3" placeholder="Aparência, origem, como surge no ritual..."></textarea>`)
    );
    return h;
  },

  afterRefresh(st){
    // selects com data-b (tipo de dano dos ataques) precisam do valor do estado
    document.getElementById('fj-body').querySelectorAll('select[data-b]').forEach(s=>{ if(document.activeElement!==s){ const v=getP(st,s.dataset.b); if(v!=null && s.value!==String(v)) s.value=String(v); } });
  },
  onSet(st,p,v){
    // trocar o elemento sugere o tipo de dano dos ataques que ainda estão no padrão do elemento antigo
  },
  onAct(a,el,st){
    if(a==='sum-hab'){ const m=HAB_MODELOS[+el.dataset.i]; st.habs=st.habs||[]; if(!st.habs.some(h=>h.nome===m.nome)) st.habs.push({nome:m.nome,desc:m.desc}); FJ.dirty=true; FJ.rerender(); return true; }
    return false;
  },

  previewHTML(st,cc){ return statBlock(cc.obj,true); },
  summary(st,cc){ const o=cc.obj; return `<b>${E(o.nome||'Sem nome')}</b> · ${o.elem||'sem elemento'} · PV ${o.pv} · DEF ${o.def}${o.ataques.length?' · '+o.ataques.length+' ataque'+(o.ataques.length>1?'s':''):''}`; },

  validate(st,editId){
    const n=cleanName(st.nome); if(!n) return 'Dê um nome ao sumonável.';
    const c=curChar(); const low=n.toLowerCase();
    if((c.customSumonaveis||[]).some(s=>s.nome.toLowerCase()===low && s.id!==editId)) return 'Você já tem um sumonável com esse nome.';
    const o=calc(st).obj;
    for(const a of (st.ataques||[])){ if(!cleanName(a.nome)) continue; const d=(a.dam==null||a.dam==='')?o.ataques.find(x=>x.nome===cleanName(a.nome)).dam:a.dam; if(!diceStats(d)) return `Dano inválido no ataque “${cleanName(a.nome)}” (use algo como 2d6+3).`; }
    return null;
  },
  save(st,editId,addBag){
    const c=curChar(); if(!c.customSumonaveis) c.customSumonaveis=[];
    const calcd=calc(st).obj; let obj;
    if(editId){
      obj=c.customSumonaveis.find(s=>s.id===editId);
      Object.keys(obj).forEach(k=>delete obj[k]); Object.assign(obj,calcd,{id:editId});
    } else { obj=Object.assign(calcd,{id:uid()}); c.customSumonaveis.push(obj); }
    obj._custom=true; obj._owner=currentUser; obj._forja=clone(st);
    FJ.lastSumSaved=obj.id;
    let msg=editId?`${obj.nome} atualizado.`:`${obj.nome} registrado no bestiário!`;
    if(addBag && !FJ.afterClose){ invocar(obj.id,1,{origem:'manual'}); msg=`${obj.nome} registrado e invocado!`; }
    return {obj,msg};
  },
  remove(id){
    const c=curChar();
    c.customSumonaveis=(c.customSumonaveis||[]).filter(s=>s.id!==id);
    // tira o vínculo dos rituais autorais que usavam este sumonável
    (c.customRituais||[]).forEach(r=>{
      if(r.sumonaveis) { r.sumonaveis=r.sumonaveis.filter(x=>x.id!==id); if(!r.sumonaveis.length) delete r.sumonaveis; }
      if(r._forja&&r._forja.sum&&r._forja.sum.rows) r._forja.sum.rows=r._forja.sum.rows.filter(x=>x.id!==id);
    });
  },
  addToBag:(id)=>{ invocar(id,1,{origem:'manual'}); },
  libCard(o){
    const cor=accentOf(o), inB=((curChar().sumonados)||[]).filter(s=>s.sid===o.id).length;
    const q=E(o.id);
    return `<div class="fj-lib-card" style="--c:${cor}"><div class="fj-lib-top"><div class="fj-lib-ico">${FJI.html(o.icone,'cranio')}</div><div style="min-width:0"><div class="fj-lib-name">${E(o.nome)}</div><div class="fj-lib-meta"><b>${o.elem||'—'}</b><span>${E(o.tamanho)}</span><span>PV ${o.pv}</span><span>DEF ${o.def}</span><span>${o.poder}º poder</span></div></div></div>
      <div class="fj-lib-meta">${(o.ataques||[]).map(a=>`<span>${FJI.svg('espada')}${E(a.nome)} ${E(a.dam)}</span>`).join('')}${inB?`<span>${FJI.svg('cranio')}${inB} ativo(s)</span>`:''}</div>
      <div class="fj-lib-act"><button class="fj-btn sm" data-act="lib-edit" data-id="${q}">${FJI.svg('editar')}Editar</button><button class="fj-btn sm" data-act="lib-dup" data-id="${q}">${FJI.svg('duplicar')}Duplicar</button><button class="fj-btn sm" data-act="lib-bag" data-id="${q}">${FJI.svg('cranio')}Invocar</button><button class="fj-btn sm danger" data-act="lib-del" data-id="${q}">${FJI.svg('lixo')}</button></div></div>`;
  },
};
FJ.kinds.sumonavel=kind;

/* ═══════════════ FICHA TÉCNICA (preview / detalhes) ═══════════════ */
function statBlock(o, compactNoWm){
  const cor=accentOf(o);
  const meta=[o.elem||'Sem elemento', o.tamanho, o.natureza, o.poder+'º poder'].filter(Boolean).join(' · ');
  const _sa2=sumAttrs(o.attrs);
  const attrs=ATTRS.map(([k,l])=>`<span class="fj-pill">${l} <b>${_sa2[k]||0}</b></span>`).join('');
  const atks=(o.ataques||[]).map(a=>{ const t=TD(a.tipoDano), s=diceStats(a.dam);
    return `<div class="fj-hab"><b>${E(a.nome)}</b> ${fmtB(+a.bonus||0)} · <span style="color:${t?t.cor:cor}">${FJI.svg('dado')}${E(a.dam)} ${t?fjDot(t)+' '+t.nome:''}</span> · ${E(a.alcance)}${a.crit?' · crít '+E(a.crit):''}${s?` <small style="opacity:.7">(média ${s.avg.toFixed(1).replace('.',',')})</small>`:' <span style="color:#ee6060">dano inválido</span>'}</div>`; }).join('');
  const habs=(o.habs||[]).map(h=>`<div class="fj-hab"><b>${E(h.nome)}.</b> ${E(h.desc)}</div>`).join('');
  return `<div class="fj-card sum" style="--c:${cor}">${o.elem&&!compactNoWm?'':''}${o.elem?`<span class="fj-wm sym-el ${ELEM_SYM[o.elem]}"></span>`:''}
    <div class="fj-card-top"><div class="fj-card-ico">${FJI.html(o.icone,'cranio')}</div><div style="min-width:0"><div class="fj-card-name ${o.nome?'':'empty'}">${E(o.nome||'Sem nome')}</div><div class="fj-card-meta">${E(meta)}</div></div></div>
    <div class="fj-stats"><div class="fj-stat"><span>PV</span><b class="dm">${o.pv}</b></div><div class="fj-stat"><span>Defesa</span><b>${o.def}</b></div><div class="fj-stat"><span>Desloc.</span><b>${o.desl}m</b></div></div>
    <div class="fj-pills">${attrs}${o.rd?`<span class="fj-pill c">RD ${o.rd}${o.rdTxt?' · '+E(o.rdTxt):''}</span>`:''}${o.resist?`<span class="fj-pill">${E(o.resist)}</span>`:''}${o.pericias?`<span class="fj-pill">${E(o.pericias)}</span>`:''}</div>
    ${atks?`<div class="fj-card-sec"><h4>Ataques</h4>${atks}</div>`:''}
    ${habs?`<div class="fj-card-sec"><h4>Habilidades</h4>${habs}</div>`:''}
    <div class="fj-card-sec"><h4>Controle</h4><div class="fj-hab">${E(o.controle||CONTROLE[0])}</div></div>
    ${o.desc?`<div class="fj-lore">${E(o.desc)}</div>`:''}</div>`;
}

/* ═══════════════ SUMONADOS ATIVOS ═══════════════ */
const LAST = {};   // uid -> html do último resultado de rolagem
const OPEN = {};   // uid -> detalhes abertos
let PICK = '';
const cc = () => curChar();

function invocar(id, qtd, ctx){
  const c=cc(); const m=find(id); if(!c||!m) return 0;
  if(!c.sumonados) c.sumonados=[];
  qtd=Math.max(1,Math.min(20,parseInt(qtd)||1)); let feitos=0;
  for(let i=0;i<qtd;i++){
    if(c.sumonados.length>=MAX_ATIVOS){ toastF(`Limite de ${MAX_ATIVOS} sumonados ativos.`,'#ee3000'); break; }
    const ja=c.sumonados.filter(s=>s.sid===id).length;
    const nome = (qtd>1||ja>0) ? `${m.nome} #${ja+1}` : m.nome;
    c.sumonados.push({
      uid:'sm_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), sid:id, nome, base:m.nome,
      icone:m.icone||'', elem:m.elem, tamanho:m.tamanho, natureza:m.natureza, poder:m.poder,
      pv:m.pv, pvMax:m.pv, def:m.def, desl:m.desl, rd:m.rd||0, rdTxt:m.rdTxt||'', resist:m.resist||'', pericias:m.pericias||'',
      controle:m.controle||CONTROLE[0], attrs:sumAttrs(m.attrs), ataques:clone(m.ataques||[]), habs:clone(m.habs||[]), desc:m.desc||'',
      origem:(ctx&&ctx.origem)||'manual', quando:Date.now(),
    });
    feitos++;
  }
  if(feitos){ saveDB(); renderSumonados(); if(!(ctx&&ctx.silencioso)) toastF(`${m.nome}${feitos>1?' ×'+feitos:''} invocado.`,accentOf(m)); }
  return feitos;
}
window.fjSumInvocar = invocar;

function invocarDoRitual(rit, extra){
  const feitos=[]; let cor=ACCENT;
  (rit.sumonaveis||[]).forEach(r=>{
    // discPE / verdPE só existem quando a versão está ligada no ritual (mesmo sem texto/dano próprio)
    const needDisc = rit.discPE!=null ? rit.discPE : Infinity;
    const needVerd = rit.verdPE!=null ? rit.verdPE : Infinity;
    if(r.em==='disc' && extra<needDisc) return;
    if(r.em==='verd' && extra<needVerd) return;
    const m=find(r.id); if(!m){ toastF(`O sumonável “${r.nome||'?'}” de ${rit.nome} não existe mais.`,'#ee3000'); return; }
    const n=invocar(r.id,r.qtd||1,{origem:rit.nome,silencioso:true});
    if(n){ feitos.push(`${m.nome}${n>1?' ×'+n:''}`); cor=accentOf(m); }
  });
  if(feitos.length) toastF(`${rit.nome} — invocou: ${feitos.join(', ')}`,cor);
}

function logRoll(label,ctx,total){
  if(!db.rolls) db.rolls={}; if(!db.rolls[currentUser]) db.rolls[currentUser]=[];
  const h=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  db.rolls[currentUser].unshift({h,label,ctx:ctx||'',total,ts:Date.now(),user:currentUser});
  if(db.rolls[currentUser].length>50) db.rolls[currentUser].length=50;
}
const getAtivo = id => (cc().sumonados||[]).find(s=>s.uid===id);

window.fjSumAtacar = function(id,i,modo){
  const s=getAtivo(id); if(!s) return; const a=(s.ataques||[])[i]; if(!a) return;
  if(s.pv<=0){ toastF('Este sumonado foi destruído.','#ee3000'); return; }
  const t=TD(a.tipoDano), cor=t?t.cor:accentOf(s), cm=parseCrit(a.crit);
  let crit = modo==='crit', teste='';
  if(modo==='atk'){
    const d=Math.floor(Math.random()*20)+1, tot=d+(+a.bonus||0);
    if(d>=cm.m) crit=true;
    teste=`<span>d20 [<b>${d}</b>] ${fmtB(+a.bonus||0)} = <b style="color:#fff;font-size:15px">${tot}</b></span>`;
  }
  const mult=crit?cm.x:1, r=rollExpr(a.dam,mult);
  LAST[id]=`<div class="sum-res" style="--c:${cor}">${crit?'CRÍTICO — ':''}${t?fjDot(t)+' ':''}<b>${E(a.nome)}</b> ${teste}
    <span>${FJI.svg('dado')}${E(a.dam)}${mult>1?' ×'+mult+' dados':''} [${r.rolls.join(', ')}] = <b style="color:${cor};font-size:15px">${r.total}</b> ${t?E(t.nome):''}</span></div>`;
  logRoll(`[Sumonado] ${s.nome} — ${a.nome}${crit?' CRÍT':''}: ${a.dam} = ${r.total}`, t?t.nome:'', r.total);
  saveDB(); if(typeof renderLog==='function') renderLog();
  renderSumonados();
  toastF(`${crit?'Crítico! ':''}${s.nome}: ${a.nome} ${r.total}${t?' ('+t.nome+')':''}`,cor);
};
window.fjSumPV = function(id,d){
  const s=getAtivo(id); if(!s) return; const antes=s.pv;
  s.pv=Math.max(0,Math.min(s.pvMax,s.pv+d)); saveDB(); renderSumonados();
  if(antes>0 && s.pv<=0) toastF(`${s.nome} foi destruído.`,'#ee3000');
};
window.fjSumPVSet = function(id,v){
  const s=getAtivo(id); if(!s) return; const antes=s.pv;
  s.pv=Math.max(0,Math.min(s.pvMax,parseInt(v)||0)); saveDB(); renderSumonados();
  if(antes>0 && s.pv<=0) toastF(`${s.nome} foi destruído.`,'#ee3000');
};
window.fjSumCurar = function(id){ const s=getAtivo(id); if(!s) return; s.pv=s.pvMax; saveDB(); renderSumonados(); };
window.fjSumDispensar = function(id){
  const c=cc(); const s=getAtivo(id); if(!s) return;
  c.sumonados=c.sumonados.filter(x=>x.uid!==id); delete LAST[id]; delete OPEN[id];
  saveDB(); renderSumonados(); toastF(`${s.nome} dispensado.`);
};
window.fjSumDispensarTodos = function(){
  const c=cc(); if(!(c.sumonados||[]).length) return;
  if(!confirm('Dispensar todos os sumonados ativos?')) return;
  c.sumonados=[]; Object.keys(LAST).forEach(k=>delete LAST[k]); saveDB(); renderSumonados();
};
window.fjSumToggle = function(id,open){ OPEN[id]=!!open; };
window.fjSumPick = function(v){ PICK=v; };
window.fjSumInvocarPick = function(){
  const sel=document.getElementById('sum-pick'); const id=sel?sel.value:PICK;
  const q=document.getElementById('sum-qtd');
  if(!id){ toastF('Escolha um sumonável da lista (ou crie um novo).','#ee8822'); return; }
  invocar(id, q?q.value:1, {origem:'manual'});
};

function cardHTML(s){
  const cor=accentOf(s), dead=s.pv<=0, pct=s.pvMax?Math.round(s.pv/s.pvMax*100):0;
  const q=s.uid;
  const atks=(s.ataques||[]).map((a,i)=>{ const t=TD(a.tipoDano);
    return `<div class="sum-atk"><div class="sum-atk-t"><b>${E(a.nome)}</b> <span>${fmtB(+a.bonus||0)}</span> · <span style="color:${t?t.cor:cor}">${FJI.svg('dado')}${E(a.dam)} ${t?fjDot(t):''}</span> <small>${E(a.alcance||'')}</small></div>
      <div class="sum-atk-b"><button class="fj-mini" onclick="fjSumAtacar('${q}',${i},'atk')" ${dead?'disabled':''}>${FJI.svg('espada')}Atacar</button><button class="fj-mini" onclick="fjSumAtacar('${q}',${i},'dano')" ${dead?'disabled':''}>${FJI.svg('dado')}Dano</button><button class="fj-mini" onclick="fjSumAtacar('${q}',${i},'crit')" ${dead?'disabled':''}>${FJI.svg('impacto')}Crít.</button></div></div>`; }).join('');
  const habs=(s.habs||[]).map(h=>`<div class="fj-hab"><b>${E(h.nome)}.</b> ${E(h.desc)}</div>`).join('');
  const _sa=sumAttrs(s.attrs);
  const attrs=ATTRS.map(([k,l])=>`${l} <b>${_sa[k]||0}</b>`).join(' · ');
  return `<div class="sum-card ${dead?'dead':''}" style="--c:${cor}">
    <div class="sum-top"><div class="sum-ico">${FJI.html(s.icone,'cranio')}</div><div class="sum-id"><div class="sum-nome">${E(s.nome)}</div><div class="sum-meta">${[s.elem,s.tamanho,s.natureza].filter(Boolean).map(E).join(' · ')}${s.origem&&s.origem!=='manual'?` · <i>de ${E(s.origem)}</i>`:''}</div></div>
      <button class="fj-rm" onclick="fjSumDispensar('${q}')" title="Dispensar">${FJI.svg('fechar')}</button></div>
    <div class="sum-hp"><div class="sum-bar"><i style="width:${pct}%${pct<=25?';background:#ee3000':''}"></i></div>
      <div class="sum-hp-r"><span class="sum-hp-n">${dead?'DESTRUÍDO':'PV'}</span>
        <button class="fj-mini" onclick="fjSumPV('${q}',-5)">−5</button><button class="fj-mini" onclick="fjSumPV('${q}',-1)">−1</button>
        <input type="number" class="sum-pvin" value="${s.pv}" min="0" max="${s.pvMax}" onchange="fjSumPVSet('${q}',this.value)"><span class="sum-pvmax">/ ${s.pvMax}</span>
        <button class="fj-mini" onclick="fjSumPV('${q}',1)">+1</button><button class="fj-mini" onclick="fjSumPV('${q}',5)">+5</button><button class="fj-mini" onclick="fjSumCurar('${q}')" title="Curar totalmente">${FJI.svg('coracao')}</button></div></div>
    <div class="sum-stats"><span>DEF <b>${s.def}</b></span><span>Desl. <b>${s.desl}m</b></span>${s.rd?`<span>RD <b>${s.rd}</b>${s.rdTxt?' '+E(s.rdTxt):''}</span>`:''}<span class="sum-at">${attrs}</span></div>
    ${atks?`<div class="sum-atks">${atks}</div>`:''}
    ${LAST[q]?LAST[q]:''}
    <details ${OPEN[q]?'open':''} ontoggle="fjSumToggle('${q}',this.open)"><summary>Detalhes</summary>
      <div class="sum-det">${s.resist?`<div class="fj-hab"><b>Resistências.</b> ${E(s.resist)}</div>`:''}${s.pericias?`<div class="fj-hab"><b>Perícias.</b> ${E(s.pericias)}</div>`:''}${habs}<div class="fj-hab"><b>Controle.</b> ${E(s.controle||'')}</div>${s.desc?`<div class="fj-lore" style="padding:4px 0">${E(s.desc)}</div>`:''}</div></details>
  </div>`;
}

let _rendering=false;
function renderSumonados(){
  const wrap=document.getElementById('sumonados-wrap'); if(!wrap || _rendering) return;
  _rendering=true;
  try{ renderSumonadosInner(wrap); } finally { _rendering=false; }
}
function renderSumonadosInner(wrap){
  const c=cc(); if(!c){ wrap.innerHTML=''; return; }
  // tira o foco antes de trocar o HTML (evita "blur" em cascata durante a troca)
  const ae=document.activeElement; if(ae && wrap.contains(ae) && ae.blur) ae.blur();
  const ativos=c.sumonados||[], lib=c.customSumonaveis||[];
  if(PICK && !lib.some(x=>x.id===PICK)) PICK='';
  const prevQ=(document.getElementById('sum-qtd')||{}).value||'1';
  wrap.innerHTML=`<div class="panel sum-panel"><div class="panel-title">${FJI.svg('cranio')}Sumonados${ativos.length?` <span class="sum-count">${ativos.length} ativo${ativos.length>1?'s':''}</span>`:''}</div>
    <div class="sum-barx">
      <select id="sum-pick" onchange="fjSumPick(this.value)"><option value="">${lib.length?'— invocar da biblioteca —':'— nenhum sumonável criado —'}</option>${lib.map(m=>`<option value="${E(m.id)}" ${m.id===PICK?'selected':''}>${E(m.nome)} · PV ${m.pv}</option>`).join('')}</select>
      <input id="sum-qtd" type="number" min="1" max="20" value="${E(prevQ)}" title="Quantidade">
      <button class="fj-tb-btn sumon" onclick="fjSumInvocarPick()">${FJI.svg('cranio')}Invocar</button>
      <button class="fj-tb-btn sumon" onclick="abrirForjaSumonavel()" title="Criar um novo sumonável">${FJI.svg('mais')}Criar sumonável</button>
      <button class="fj-tb-btn" onclick="abrirForjaBiblioteca('sumonavel')">${FJI.svg('livro')}Meus sumonáveis (${lib.length})</button>
      ${ativos.length?`<button class="fj-tb-btn ghost" onclick="fjSumDispensarTodos()">${FJI.svg('fechar')}Dispensar todos</button>`:''}
    </div>
    ${ativos.length?`<div class="sum-grid">${ativos.map(cardHTML).join('')}</div>`:`<div class="fj-empty" style="margin-top:8px">Nenhum sumonado ativo. Conjure um ritual que invoque sumonáveis — ou invoque direto da biblioteca acima.</div>`}
  </div>`;
}
window.renderSumonados = renderSumonados;

/* ═══════════════ GANCHOS NO APP ═══════════════ */
/* conjurar ritual → invoca os sumonáveis vinculados (só se a conjuração deu certo) */
(function(){
  const orig=window.usarRitual; if(typeof orig!=='function') return;
  window.usarRitual=function(nome,extra,alvo){
    const rolls=()=> (db.rolls&&db.rolls[currentUser])||[];
    const antes=rolls()[0];
    const ret=orig.apply(this,arguments);
    try{
      if(rolls()[0]!==antes){            // a conjuração registrou log = foi bem-sucedida
        const rit=RITUAIS_DB.find(x=>x.nome===nome);
        if(rit && rit.sumonaveis && rit.sumonaveis.length) invocarDoRitual(rit, parseInt(extra)||0);
      }
    }catch(e){ console.error('[sumonáveis]',e); }
    return ret;
  };
})();
(function(){ /* painel acompanha o grimório */
  const o1=window.renderRituaisTab;
  if(typeof o1==='function') window.renderRituaisTab=function(){ const r=o1.apply(this,arguments); renderSumonados(); return r; };
  const o2=window.showTab;
  if(typeof o2==='function') window.showTab=function(t){ const r=o2.apply(this,arguments); if(t==='rituais') renderSumonados(); return r; };
})();
document.addEventListener('DOMContentLoaded',()=>{ try{ renderSumonados(); }catch(e){} });

window.abrirForjaSumonavel = ()=>window.fjOpen('sumonavel');
window.fjEditarSumonavel = id=>window.fjOpen('sumonavel',{edit:id});
window.FJ_SUM = { find, list:()=>{ const c=curChar(); return c?(c.customSumonaveis||[]):[]; }, invocar, statBlock, accentOf, ELEM_COL };
})();
