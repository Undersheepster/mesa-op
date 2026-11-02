/* ════════════════════════════════════════════════════════════
   FORJA-RITUAL.JS — Escrita de Rituais (formulário do criador)
   Depende de forja.js (window.FJ / window.fjUI).
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const U = window.fjUI, FJ = window.FJ;
const {F,E,cleanName,cleanTxt,clone,getP,setP,diceStats,TD,tdOrder,toastF,curChar} = U;

const ELEMS = ['Sangue','Morte','Energia','Conhecimento','Medo'];
const ELEM_SYM = {Sangue:'sym-sangue',Morte:'sym-morte',Energia:'sym-energia',Conhecimento:'sym-conhecimento',Medo:'sym-medo'};
const ELEM_COL = {Sangue:'#dd0000',Morte:'#8a7ab0',Energia:'#a60df2',Conhecimento:'#c8a000',Medo:'#2f7fe0'};
const ELEM_DANO = {Sangue:'S',Morte:'M',Energia:'E',Conhecimento:'K',Medo:'Me'};
const PE_CIRC = {1:2,2:4,3:6,4:10};
const OPC = {
  exec:['Livre','Reação','Movimento','Padrão','Completa'],
  alcance:['Pessoal','Toque','Curto','Médio','Longo','Extremo'],
  alvo:['Você','1 Ser','1 pessoa','Seres escolhidos','1 objeto','Área: esfera 6m de raio','Área: cone 9m','Área: linha 30m'],
  dur:['Instantânea','1 rodada','Cena','Sustentada','1 dia','Permanente'],
  resist:[['—','Nenhuma'],'Fortitude parcial','Fortitude anula','Fortitude reduz à metade','Reflexos parcial','Reflexos reduz à metade','Vontade parcial','Vontade anula'],
};
const ordc = n => n+'º círculo';

function newState(){
  return { nome:'', elem:'Sangue', circ:1, pe:null, exec:'Padrão', alcance:'Curto', alvo:'1 Ser', dur:'Instantânea', resist:'—',
    dam:'', tipoDano:'S', _tdManual:false, isBuff:false, podeAlvo:false, efeito:'',
    disc:{on:false,pe:2,circ:2,txt:'',dam:''}, verd:{on:false,pe:5,circ:3,afin:true,txt:'',dam:''},
    sum:{on:false,rows:[]} };
}
/* ── sumonáveis vinculados ── */
const SUM = () => window.FJ_SUM || {find:()=>null,list:()=>[]};
const SUM_EM = [['sempre','Sempre que conjurar'],['disc','A partir do Discente'],['verd','Só no Verdadeiro']];
function scaleDice(expr,f){
  if(!expr) return '';
  return String(expr).replace(/\s+/g,'').replace(/(\d+)(d\d+)?/gi,(m,n,d)=> String(+n*f)+(d||''));
}
function build(extra, st){
  const parts=[]; if(extra.pe!=null) parts.push('+'+extra.pe+' PD'); if(extra.circ) parts.push(ordc(extra.circ)); if(extra.afin) parts.push('afinidade');
  const pre='('+parts.join(', ')+')';
  let txt=cleanTxt(extra.txt);
  if(!txt && extra.dam) txt='O dano passa a ser '+extra.dam+'.';
  return txt ? pre+' '+txt : '';
}
const nl2br = s => cleanTxt(s).replace(/\r?\n/g,'<br>');

function calc(st){
  const auto={pe:PE_CIRC[st.circ]||2};
  const pe = st.pe==null||st.pe===''?auto.pe:Number(st.pe);
  const o={ nome:cleanName(st.nome), elem:st.elem, circ:Number(st.circ), exec:cleanTxt(st.exec)||'Padrão', alcance:cleanTxt(st.alcance)||'—',
    alvo:cleanTxt(st.alvo)||'—', dur:cleanTxt(st.dur)||'—', resist:cleanTxt(st.resist)||'—', pe,
    efeito: nl2br(st.efeito)||'(sem descrição)', disc:'—', verd:'—' };
  if(st.isBuff){ o.isBuff=true; if(st.podeAlvo) o.podeAlvo=true; }
  const dam=cleanTxt(st.dam).replace(/\s+/g,'');
  if(dam){ o.dam=dam; o.tipoDano=st.tipoDano||ELEM_DANO[st.elem]; }
  if(st.disc.on){ const t=build(st.disc,st); if(t) o.disc=t; if(st.disc.dam && diceStats(st.disc.dam)) o.damDisc=st.disc.dam.replace(/\s+/g,''); o.discPE=Number(st.disc.pe)||0; }
  if(st.verd.on){ const t=build(st.verd,st); if(t) o.verd=t; if(st.verd.dam && diceStats(st.verd.dam)) o.damVerd=st.verd.dam.replace(/\s+/g,''); o.verdPE=Number(st.verd.pe)||0; }
  if(st.sum && st.sum.on){
    const rows=(st.sum.rows||[]).filter(r=>r&&r.id&&SUM().find(r.id)).map(r=>({id:r.id, nome:SUM().find(r.id).nome, qtd:Math.max(1,Math.min(20,parseInt(r.qtd)||1)), em:r.em||'sempre'}));
    if(rows.length) o.sumonaveis=rows;
  }
  return {obj:o,auto};
}

function find(nome){ const c=curChar(); return (c.customRituais||[]).find(r=>r.nome===nome); }
function stateFrom(o){
  if(o._forja) return Object.assign(newState(), clone(o._forja));
  const st=newState(); st.nome=o.nome; st.elem=o.elem; st.circ=o.circ||1; st.pe=o.pe; st.exec=o.exec; st.alcance=o.alcance; st.alvo=o.alvo; st.dur=o.dur; st.resist=o.resist||'—';
  st.dam=o.dam||''; st.tipoDano=o.tipoDano||ELEM_DANO[o.elem]; st.isBuff=!!o.isBuff; st.podeAlvo=!!o.podeAlvo; st.efeito=String(o.efeito||'').replace(/<br>/g,'\n');
  if(o.disc&&o.disc!=='—'){ st.disc.on=true; st.disc.txt=o.disc.replace(/^\([^)]*\)\s*/,''); }
  if(o.verd&&o.verd!=='—'){ st.verd.on=true; st.verd.txt=o.verd.replace(/^\([^)]*\)\s*/,''); }
  if(o.sumonaveis&&o.sumonaveis.length){ st.sum.on=true; st.sum.rows=o.sumonaveis.map(r=>({id:r.id,qtd:r.qtd||1,em:r.em||'sempre'})); }
  return st;
}

function combo(label,p,vals,ph){ return F.f(label, F.input(p,ph||'',{max:80})+F.quick(p,vals)); }

const kind = {
  accent:'#c46bff', icon:'sigilo', primary:FJI.svg('sigilo')+'Escrever e levar no inventário',
  title:'Escrita de Rituais', editTitle:'Editar ritual', sub:'Crie rituais autorais — eles entram desbloqueados no seu grimório',
  libTitle:'Grimório Autoral', libSub:'Rituais criados por você', libEmpty:'Nenhum ritual autoral ainda. Use “Criar novo” para escrever o primeiro.',
  newState, stateFrom, find, calc,
  accentOf:(st)=>ELEM_COL[st.elem]||'#c46bff',
  newRow:(path)=> path==='sum.rows' ? {id:'',qtd:1,em:'sempre'} : {},
  libList:()=>{ const c=curChar(); return c?(c.customRituais||[]):[]; },

  formHTML(st){
    let h='';
    h+=F.sec('I','Identidade',
      F.f('Nome do ritual *',F.input('nome','Ex: Grilhões de Cinza',{max:60}))+
      F.f('Elemento',`<div class="fj-chips">${ELEMS.map(e=>`<button type="button" class="fj-chip big" data-set="elem" data-v="${e}" style="--cc:${ELEM_COL[e]}"><span class="sym-el ${ELEM_SYM[e]}"></span>${e}</button>`).join('')}</div>`)+
      `<div class="fj-row">${F.f('Círculo',F.chips('circ',[1,2,3,4].map(n=>({v:n,l:n+'º'})),{n:true}))}${F.f('Custo (PD)',F.step('pe',{min:0,max:99}),F.badge('pe'))}</div>`
    );
    h+=F.sec('II','Conjuração',
      `<div class="fj-row">${combo('Execução','exec',OPC.exec)}${combo('Alcance','alcance',OPC.alcance)}</div>`+
      `<div class="fj-row">${combo('Alvo / Área','alvo',OPC.alvo)}${combo('Duração','dur',OPC.dur)}</div>`+
      combo('Resistência','resist',OPC.resist,'—')
    );
    h+=F.sec('III','Efeito',
      F.f('Descrição do efeito',`<textarea data-b="efeito" rows="5" placeholder="O que o ritual faz. Para curas use o formato “recupera 3d8+3 PV” — o app aplica a cura automaticamente."></textarea>`)+
      F.toggle('isBuff','Efeito benéfico (buff / cura)')+
      (st.isBuff?F.toggle('podeAlvo','Pode ser usado em aliados online'):''),
      ''
    ).replace('data-tog="isBuff"','data-tog="isBuff" data-rerender="1"');
    h+=F.sec('IV','Dano',
      F.dice('dam','Dano base',{nobadge:true,ph:'ex: 3d6+3 (vazio = sem dano)'})+
      F.f('Tipo de dano',F.tipoDano('tipoDano')),
      'Rituais com dano ganham botão “Rolar” no inventário, no grimório e na aba Danos (com a RD da armadura aplicada).'
    );
    const dd=st.disc, vv=st.verd;
    h+=F.sec('V','Discente & Verdadeiro',
      `<div style="margin-bottom:10px"><button type="button" class="fj-btn sm" data-act="suggest">${FJI.svg('sugerir')}Sugerir a partir do custo e do dano</button></div>`+
      F.toggle('disc.on','Versão Discente (mais PD, mais poder)').replace('data-tog','data-rerender="1" data-tog')+
      (dd.on?`<div class="fj-sub-box"><div class="fj-row">${F.f('PD extra',F.input('disc.pe','2',{t:'num',type:'number',min:0,maxv:99}))}${F.f('Requer círculo',F.input('disc.circ','2',{t:'num',type:'number',min:0,maxv:4}))}${F.f('Dano (opcional)',F.input('disc.dam','ex: 5d6'))}</div>${F.f('O que muda',`<textarea data-b="disc.txt" rows="2" placeholder="Muda o alvo para área, aumenta o dano..."></textarea>`)}</div>`:'')+
      F.toggle('verd.on','Versão Verdadeiro (afinidade)').replace('data-tog','data-rerender="1" data-tog')+
      (vv.on?`<div class="fj-sub-box"><div class="fj-row">${F.f('PD extra',F.input('verd.pe','5',{t:'num',type:'number',min:0,maxv:99}))}${F.f('Requer círculo',F.input('verd.circ','3',{t:'num',type:'number',min:0,maxv:4}))}${F.f('Dano (opcional)',F.input('verd.dam','ex: 8d6'))}</div>${F.toggle('verd.afin','Exige afinidade com o elemento')}${F.f('O que muda',`<textarea data-b="verd.txt" rows="2" placeholder="Versão máxima do ritual..."></textarea>`)}</div>`:''),
      'Se informar um dano, aparece um botão extra de rolagem para essa versão.'
    );
    /* VI — sumonáveis */
    const lib=SUM().list(), sm=st.sum||{on:false,rows:[]};
    let sb=F.toggle('sum.on','Este ritual invoca sumonáveis').replace('data-tog','data-rerender="1" data-tog');
    if(sm.on){
      sb+=`<div class="fj-sub-box">`+
        (sm.rows||[]).map((r,i)=>{
          const aviso = (r.em==='disc'&&!st.disc.on)?'A versão Discente está desligada (seção V) — este sumonável nunca será invocado.'
                      : (r.em==='verd'&&!st.verd.on)?'A versão Verdadeiro está desligada (seção V) — este sumonável nunca será invocado.':'';
          return `<div class="fj-list-row" data-row="sum.rows"><div class="fj-lr-main">
            <div class="fj-lr-sum"><select data-b="sum.rows.${i}.id"><option value="">— escolher sumonável —</option>${lib.map(m=>`<option value="${E(m.id)}">${E(m.nome)} · PV ${m.pv}</option>`).join('')}</select>
              <input class="fj-in" data-b="sum.rows.${i}.qtd" data-t="num" type="number" min="1" max="20" placeholder="Qtd" title="Quantos são invocados" autocomplete="off"></div>
            <select data-b="sum.rows.${i}.em" data-rerender="1">${SUM_EM.map(([v,l])=>`<option value="${v}">${l}${v==='disc'?' (+'+(+st.disc.pe||0)+' PD)':v==='verd'?' (+'+(+st.verd.pe||0)+' PD)':''}</option>`).join('')}</select>
            ${aviso?`<div class="fj-hint" style="color:#ee9060;margin:0">${aviso}</div>`:''}
          </div><button type="button" class="fj-rm" data-rm="sum.rows:${i}">×</button></div>`; }).join('')+
        `<button type="button" class="fj-add" data-add="sum.rows">＋ Vincular sumonável</button>`+
        `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button type="button" class="fj-btn sm" data-act="sum-new">${FJI.svg('mais')}Criar novo sumonável</button><button type="button" class="fj-btn sm" data-act="sum-lib">${FJI.svg('livro')}Ver meus sumonáveis</button></div>`+
        (lib.length?'':`<div class="fj-hint" style="margin:0 0 8px">Você ainda não criou nenhum sumonável. Use “Criar novo sumonável” — ao salvar você volta para este ritual com ele já vinculado.</div>`)+
        `</div>`;
    }
    h+=F.sec('VI','Sumonáveis',sb,'Ao conjurar o ritual, os sumonáveis vinculados entram no painel “Sumonados” (aba Rituais), com PV, ataques e botão de dispensar. A versão define quando cada um aparece, conforme o PD extra gasto.');
    return h;
  },

  onSet(st,p,v){
    if(p==='elem' && !st._tdManual) st.tipoDano=ELEM_DANO[v];
    if(p==='tipoDano') st._tdManual=true;
  },
  onAct(a,el,st){
    if(a==='suggest'){
      const base=calc(st).obj;
      st.disc.on=true; st.disc.pe=Math.max(2,Math.round(base.pe)||2); st.disc.circ=Math.min(4,(+st.circ||1)+1);
      st.verd.on=true; st.verd.pe=Math.max(5,Math.round((base.pe||2)*2.5)); st.verd.circ=Math.min(4,(+st.circ||1)+2); st.verd.afin=true;
      if(st.dam && diceStats(st.dam)){ st.disc.dam=scaleDice(st.dam,2); st.verd.dam=scaleDice(st.dam,3); }
      FJ.dirty=true; toastF('Valores sugeridos — ajuste o texto do que muda.');
      FJ.rerender();
      return true;
    }
    if(a==='sum-new' || a==='sum-lib'){
      // guarda o ritual em edição, abre a criação de sumonáveis e volta para cá ao fechar
      const snap={st:clone(st), editId:FJ.editId};
      FJ.lastSumSaved=null;
      FJ.afterClose=()=>{
        const novo=FJ.lastSumSaved; FJ.lastSumSaved=null;
        window.fjOpen('ritual', snap.editId?{edit:snap.editId}:{fresh:true});
        if(!FJ.st) return;
        FJ.st=snap.st; FJ.dirty=true;
        if(novo){ FJ.st.sum.on=true; FJ.st.sum.rows=(FJ.st.sum.rows||[]).filter(r=>r.id); FJ.st.sum.rows.push({id:novo,qtd:1,em:'sempre'}); }
        FJ.notice=''; FJ.rerender();
        if(novo) toastF('Sumonável criado e vinculado ao ritual.','#4fd1a5');
      };
      FJ.dirty=false;
      if(a==='sum-new') window.fjOpen('sumonavel',{fresh:true}); else window.fjOpen('sumonavel',{view:'lib'});
      return true;
    }
    return false;
  },

  previewHTML(st,calc){
    const r=calc.obj, cor=ELEM_COL[r.elem]||'#c46bff', td=r.dam?TD(r.tipoDano):null;
    const c=curChar();
    return `<div class="fj-card rit" style="--c:${cor}"><span class="fj-wm sym-el ${ELEM_SYM[r.elem]}"></span>
      <div class="fj-card-top"><div class="fj-card-ico"><span class="sym-el ${ELEM_SYM[r.elem]}" style="width:30px;height:30px;display:block;background-size:contain"></span></div>
        <div style="min-width:0"><div class="fj-card-name ${r.nome?'':'empty'}">${E(r.nome||'Sem nome')}</div><div class="fj-card-meta">${r.elem} · ${r.circ}º círculo${r.isBuff?' · buff':''}</div></div></div>
      <div class="fj-stats"><div class="fj-stat"><span>Custo</span><b class="dm">${r.pe} PD</b></div><div class="fj-stat"><span>Execução</span><b style="font-size:15px">${E(r.exec)}</b></div><div class="fj-stat"><span>Duração</span><b style="font-size:15px">${E(r.dur)}</b></div></div>
      <div class="fj-pills"><span class="fj-pill">Alcance: ${E(r.alcance)}</span><span class="fj-pill">Alvo: ${E(r.alvo)}</span>${r.resist!=='—'?`<span class="fj-pill c">Resist.: ${E(r.resist)}</span>`:''}${td?`<span class="fj-pill c" style="--c:${td.cor}">${FJI.svg('dado')}${E(r.dam)} ${fjDot(td)} ${td.nome}</span>`:''}</div>
      <div class="fj-ef">${r.efeito}</div>
      ${r.disc!=='—'?`<div class="fj-ef-sub" style="color:#a2bbd5"><i style="color:#33b2ff">DISCENTE</i>${r.disc}${r.damDisc?` <b style="color:${td?td.cor:cor}">${FJI.svg('dado')}${E(r.damDisc)}</b>`:''}</div>`:''}
      ${r.verd!=='—'?`<div class="fj-ef-sub" style="color:#d5bba2"><i style="color:var(--gold-light)">VERDADEIRO</i>${r.verd}${r.damVerd?` <b style="color:${td?td.cor:cor}">${FJI.svg('dado')}${E(r.damVerd)}</b>`:''}</div>`:''}
      ${r.sumonaveis?`<div class="fj-ef-sub" style="color:#9fe3cf"><i style="color:#4fd1a5">SUMONA</i>${r.sumonaveis.map(x=>{const m=SUM().find(x.id); return `${FJI.html(m&&m.icone,'cranio')} <b>${E(x.nome)}</b>${x.qtd>1?' ×'+x.qtd:''}${x.em==='disc'?' <small>(Discente+)</small>':x.em==='verd'?' <small>(Verdadeiro)</small>':''}`;}).join(' · ')}</div>`:''}
      ${r.dam?`<div class="fj-avg">${(function(){const s=diceStats(r.dam);return s?`<span>Dano <b>${s.min}–${s.max}</b></span><span>média <b>${s.avg.toFixed(1).replace('.',',')}</b></span>`:'<span style="color:#ee6060">Dano inválido</span>';})()}</div>`:''}
    </div>`;
  },
  summary(st,calc){ const r=calc.obj; return `<b>${E(r.nome||'Sem nome')}</b> · ${r.elem} ${r.circ}º · ${r.pe} PD${r.dam?' · '+E(r.dam):''}`; },

  validate(st,editId){
    const n=cleanName(st.nome); if(!n) return 'Dê um nome ao ritual.';
    const c=curChar(); const low=n.toLowerCase();
    if(RITUAIS_DB.some(r=>!r._custom && r.nome.toLowerCase()===low)) return 'Já existe um ritual oficial com esse nome.';
    if((c.customRituais||[]).some(r=>r.nome.toLowerCase()===low && r.nome!==editId)) return 'Você já tem um ritual com esse nome.';
    if(cleanTxt(st.dam) && !diceStats(st.dam)) return 'Dano inválido (use algo como 3d6+3).';
    if(st.sum && st.sum.on){
      const rows=st.sum.rows||[];
      if(!rows.length) return 'Vincule ao menos um sumonável (ou desligue “invoca sumonáveis”).';
      if(rows.some(r=>!r.id||!SUM().find(r.id))) return 'Escolha um sumonável em cada linha da seção VI (ou remova a linha vazia).';
    }
    return null;
  },
  save(st,editId,addBag){
    const c=curChar(); if(!c.customRituais) c.customRituais=[];
    if(!c.rituaisAprendidos) c.rituaisAprendidos={};
    const calcd=calc(st).obj; let obj;
    if(editId){
      obj=c.customRituais.find(r=>r.nome===editId);
      if(editId!==calcd.nome){
        (c.rituais||[]).forEach(x=>{ if(x.nome===editId) x.nome=calcd.nome; });
        if(c.rituaisAprendidos[editId]){ c.rituaisAprendidos[calcd.nome]=true; delete c.rituaisAprendidos[editId]; }
      }
      Object.keys(obj).forEach(k=>delete obj[k]); Object.assign(obj,calcd);
    } else { obj=calcd; c.customRituais.push(obj); }
    obj._custom=true; obj._owner=currentUser; obj._forja=clone(st);
    c.rituaisAprendidos[obj.nome]=true;
    let msg=editId?`${obj.nome} atualizado.`:`${obj.nome} inscrito no grimório!`;
    if(addBag){ addToBag(obj.nome); msg=`${obj.nome} inscrito no grimório e levado no inventário!`; }
    return {obj,msg};
  },
  remove(nome){
    const c=curChar();
    c.customRituais=(c.customRituais||[]).filter(r=>r.nome!==nome);
    c.rituais=(c.rituais||[]).filter(r=>r.nome!==nome);
    if(c.rituaisAprendidos) delete c.rituaisAprendidos[nome];
  },
  addToBag:(nome)=>addToBag(nome),
  libCard(o){
    const cor=ELEM_COL[o.elem]||'#c46bff', td=o.dam?TD(o.tipoDano):null;
    const inBag=((curChar().rituais)||[]).some(r=>r.nome===o.nome);
    const q=E(o.nome);
    return `<div class="fj-lib-card" style="--c:${cor}"><div class="fj-lib-top"><div class="fj-lib-ico"><span class="sym-el ${ELEM_SYM[o.elem]}" style="width:22px;height:22px;display:block;background-size:contain"></span></div><div style="min-width:0"><div class="fj-lib-name">${q}</div><div class="fj-lib-meta"><b>${o.elem}</b><span>${o.circ}º círculo</span><span>${o.pe} PD</span>${td?`<span>${FJI.svg('dado')}${E(o.dam)} ${fjDot(td)}</span>`:''}</div></div></div>
      <div class="fj-lib-meta"><span>${E(o.exec)}</span><span>${E(o.alcance)}</span><span>${E(o.dur)}</span>${o.sumonaveis?`<span style="color:#4fd1a5">${FJI.svg('cranio')}sumona ${o.sumonaveis.map(x=>E(x.nome)+(x.qtd>1?' ×'+x.qtd:'')).join(', ')}</span>`:''}${inBag?'<span>'+FJI.svg('mochila')+'no inventário</span>':''}</div>
      <div class="fj-lib-act"><button class="fj-btn sm" data-act="lib-edit" data-id="${q}">${FJI.svg('editar')}Editar</button><button class="fj-btn sm" data-act="lib-dup" data-id="${q}">${FJI.svg('duplicar')}Duplicar</button><button class="fj-btn sm" data-act="lib-bag" data-id="${q}">${FJI.svg('mochila')}+ Inventário</button><button class="fj-btn sm danger" data-act="lib-del" data-id="${q}">${FJI.svg('lixo')}</button></div></div>`;
  },
};
FJ.kinds.ritual=kind;

function addToBag(nome){
  const c=curChar(); if(!c.rituais) c.rituais=[];
  if(!c.rituais.some(r=>r.nome===nome)) c.rituais.push({nome});
  toastF(`${nome} no inventário.`,'#c46bff');
}

window.abrirForjaRitual = ()=>window.fjOpen('ritual');
window.abrirCriarRitualModal = window.abrirForjaRitual;

/* Botões extras nos cartões do grimório (rituais autorais) */
window.fjRitualCardExtras = function(card, r){
  const nome=r.nome.replace(/'/g,"\\'");
  const div=document.createElement('div'); div.className='fj-card-actions';
  div.innerHTML=`<span class="fj-custom-tag">${FJI.svg('editar')}AUTORAL</span>
    ${r.sumonaveis?`<span class="fj-custom-tag" style="border-color:rgba(79,209,165,.6);color:#4fd1a5" title="Ao conjurar, invoca: ${E(r.sumonaveis.map(x=>x.nome+(x.qtd>1?' ×'+x.qtd:'')).join(', '))}">${FJI.svg('cranio')}SUMONA ${E(r.sumonaveis.map(x=>x.nome+(x.qtd>1?' ×'+x.qtd:'')).join(', '))}</span>`:''}
    ${r.damDisc?`<button class="fj-mini" onclick="event.stopPropagation();fjRolarRitualVersao('${nome}','disc')">${FJI.svg('dado')}Discente ${E(r.damDisc)}</button>`:''}
    ${r.damVerd?`<button class="fj-mini" onclick="event.stopPropagation();fjRolarRitualVersao('${nome}','verd')">${FJI.svg('dado')}Verdadeiro ${E(r.damVerd)}</button>`:''}
    <button class="fj-mini" onclick="event.stopPropagation();fjEditarRitual('${nome}')">${FJI.svg('editar')}Editar</button>
    <button class="fj-mini" onclick="event.stopPropagation();fjExcluirRitual('${nome}')">${FJI.svg('lixo')}Excluir</button>`;
  card.appendChild(div);
};
window.fjExcluirRitual = function(nome){
  if(!confirm('Excluir o ritual "'+nome+'" definitivamente?')) return;
  kind.remove(nome); window.fjSyncCustom(); saveDB();
  if(typeof renderRituaisTab==='function') renderRituaisTab();
  if(typeof renderInvUnificado==='function') renderInvUnificado();
  if(typeof fecharActionPanel==='function') fecharActionPanel();
  toastF('Ritual excluído.');
};
window.fjRolarRitualVersao = function(nome,v){
  const r=RITUAIS_DB.find(x=>x.nome===nome); if(!r) return;
  const dam = v==='disc'?r.damDisc:r.damVerd; if(!dam) return;
  rolarDanoRitual(nome+(v==='disc'?' (Discente)':' (Verdadeiro)'), dam, r.tipoDano||ELEM_DANO[r.elem]);
};
})();
