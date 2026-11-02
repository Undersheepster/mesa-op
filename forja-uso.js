/* ════════════════════════════════════════════════════════════
   FORJA-USO.JS — uso das criações no dia a dia
   • Ataque completo: dano + dano adicional + crítico + RD por tipo
   • Controle de munição por item da mochila
   • Painel de ação: botão Editar, versões Discente/Verdadeiro
   Carregar depois de forja.js e forja-ritual.js.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const U = window.fjUtil;
const {E,TD,parseCrit,rollExpr} = U;
const cc = () => userChar(currentUser);
const logRoll = (label,ctx,total)=>{
  if(!db.rolls) db.rolls={}; if(!db.rolls[currentUser]) db.rolls[currentUser]=[];
  const h=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  db.rolls[currentUser].unshift({h,label,ctx:ctx||'',total,ts:Date.now(),user:currentUser});
  if(db.rolls[currentUser].length>50) db.rolls[currentUser].length=50;
};

/* Rola uma arma (principal + adicionais). No crítico multiplica só os DADOS. */
window.fjRolarArma = function(dbItem, o){
  o=o||{}; const crit=!!o.crit; const mult = crit ? (dbItem.crit?parseCrit(dbItem.crit).x:2) : 1;
  const c=cc(); const arm = c.armaduraEquipada ? ITENS_DB.find(i=>i.id===c.armaduraEquipada) : null;
  const comps=[{expr:dbItem.dam,tipo:dbItem.tipoDano||'F'},...(dbItem.danoExtra||[])];
  const parts=comps.map(cp=>{
    const r=rollExpr(cp.expr,mult); let rd = typeof calcularRD==='function'?calcularRD(arm,cp.tipo):0;
    if(rd>0 && o.rdIgnora) rd=Math.max(0,rd-o.rdIgnora);
    return {expr:cp.expr,tipo:cp.tipo,rolls:r.rolls,bruto:r.total,rd,final:Math.max(0,r.total-rd)};
  });
  return {parts,mult,crit,arm,
    bruto:parts.reduce((a,p)=>a+p.bruto,0), rd:parts.reduce((a,p)=>a+Math.min(p.bruto,p.rd),0), final:parts.reduce((a,p)=>a+p.final,0)};
};

const FM = () => window.FJ_MUN;
function ammoMax(it,db){ return it.ammoMax!=null ? it.ammoMax : (db&&db.municao?db.municao.max:0); }
function ammoCur(it,db){ const m=ammoMax(it,db); return it.ammo==null?m:Math.min(it.ammo,m); }
const calOf = db => (db&&db.municao&&db.municao.calibre)||'';
function carregada(it,db){ if(!calOf(db)||!it.ammoTipo) return null; return ITENS_DB.find(x=>x.id===it.ammoTipo)||null; }
function ammoLabel(it,db){
  const am=carregada(it,db); if(!am) return 'comum';
  if(am.variante&&am.variante!=='comum') return FM().varLabel(am.variante);
  return (am.munMod||(am.danoExtra&&am.danoExtra.length)) ? am.nome : 'comum';
}
let _pick=null; // {idx,uma} — escolhendo qual munição carregar

window.fjAtacar = function(idx, crit, modo){
  const c=cc(), it=c.inv[idx]; if(!it) return;
  const db=ITENS_DB.find(x=>x.id===it.dbId); if(!db||!db.dam) return;
  const F=FM(), rajada = modo==='rajada' && F.podeRajada(db);
  const max=ammoMax(it,db), am=carregada(it,db);
  if(max>0){
    let gasto=db.municao?db.municao.gasto:1; if(rajada) gasto=Math.max(3,gasto);
    const cur=ammoCur(it,db);
    if(cur<gasto){ toast(rajada?`Munição insuficiente para rajada (precisa de ${gasto}).`:'Sem munição! Recarregue a arma.','#ee3000'); return; }
    it.ammo=cur-gasto;
  }
  const eff=F.efetiva(db,am,{rajada});
  const r=fjRolarArma(eff,{crit,rdIgnora:eff.rdIgnora});
  const td=TD(eff.tipoDano), cor=td?td.cor:'#ee3000';
  const mods = am ? F.resumoMod(am) : [];
  const el=document.getElementById('inv-action-resultado');
  if(el){
    el.style.display='block';
    let h=`<div style="margin-bottom:6px;color:${cor};font-family:'IM Fell English SC',serif;font-size:13px">${r.crit?'CRÍTICO — ':''}${rajada?'RAJADA — ':''}${td?fjDot(td):''} <b>${E(db.nome)}</b>${eff.teste?` <span style="font-size:10px;color:var(--white-dust)">(teste: ${E(eff.teste)}${eff.bonusAtq?(eff.bonusAtq>0?' +':' ')+eff.bonusAtq:''})</span>`:''}</div>`;
    if(am) h+=`<div style="font-size:10px;color:#d4a044;margin-bottom:4px">${E(am.nome)}${mods.length?' — '+E(mods.join(' · ')):''}</div>`;
    r.parts.forEach((p,i)=>{ const t=TD(p.tipo); h+=`<div style="display:flex;gap:8px;flex-wrap:wrap;font-family:'Courier Prime',monospace;font-size:11px;margin-bottom:2px"><span style="color:${t?t.cor:cor}">${i?'+ ':''}${t?fjDot(t)+' ':''}${E(p.expr)}${r.mult>1?' ×'+r.mult+' dados':''}</span><span style="color:var(--white-dust)">[${p.rolls.join(', ')}]</span><span>= <b style="color:${t?t.cor:cor}">${p.bruto}</b></span>${p.rd?`<span style="color:#3af">−RD ${Math.min(p.bruto,p.rd)}</span>`:''}</div>`; });
    h+=`<div style="margin-top:6px;font-family:'Courier Prime',monospace;font-size:12px">Bruto <b style="color:${cor}">${r.bruto}</b>${r.rd?` · −RD <b style="color:#3af">${r.rd}</b>`:''} · Final <b style="color:${r.final>0?cor:'#9fc26b'};font-size:17px">${r.final}</b></div>`;
    if(r.rd&&r.arm) h+=`<div style="font-size:10px;color:#77aadd;margin-top:3px">${E(r.arm.nome)} absorveu parte do dano.${eff.rdIgnora>0?' (munição ignora '+eff.rdIgnora+' RD)':''}</div>`;
    if(max>0){ const left=ammoCur(it,db); h+=`<div style="font-size:10px;color:${left?'#d4a044':'#ee3000'};margin-top:3px">Munição: ${left}/${max}${left?'':' — arma vazia, recarregue'}</div>`; }
    el.innerHTML=h;
  }
  logRoll(`[Arma${r.crit?' CRÍT':''}${rajada?' RAJADA':''}] ${db.nome}${am?' ('+ammoLabel(it,db)+')':''}: ${r.parts.map(p=>p.expr).join(' + ')} = ${r.bruto}${r.rd?` → ${r.final} (RD −${r.rd})`:''}`, td?td.nome:'', r.final);
  saveDB(); if(typeof renderLog==='function') renderLog();
  fjAmmoRefresh(idx);
  if(typeof renderInvUnificado==='function') renderInvUnificado();
  toast(`${r.crit?'Crítico! ':(rajada?'Rajada: ':'')}${db.nome}: ${r.bruto}${r.rd?` −${r.rd}RD = ${r.final}`:''}`);
};
/* compat: botão antigo */
window.rolarDanoArmaInv_v2 = function(dbId){
  const c=cc(); const idx=(c.inv||[]).findIndex(i=>i.dbId===dbId); if(idx>=0) fjAtacar(idx,false);
};

/* ── botões de ataque (refletem a munição carregada) ── */
function atkBtnsHTML(idx){
  const c=cc(), it=c.inv[idx]; if(!it) return '';
  const db=ITENS_DB.find(x=>x.id===it.dbId); if(!db||db.tipo!=='arma'||!db.dam) return '';
  const F=FM(), am=carregada(it,db), eff=F.efetiva(db,am);
  const td=TD(eff.tipoDano), cor=td?td.cor:'#ee3000';
  const mk=(txt,fn)=>`<button onclick="${fn}" style="padding:8px 16px;background:rgba(${hex(cor)},0.15);border:1px solid rgba(${hex(cor)},0.5);color:${cor};font-family:'IM Fell English SC',serif;font-size:11px;letter-spacing:.08em;cursor:var(--cur-pointer,pointer)">${txt}</button>`;
  const extras=(eff.danoExtra||[]).map(e=>'+'+e.expr).join(' ');
  let h=mk(`Atacar — ${E(eff.dam)} ${E(extras)}`,`fjAtacar(${idx},false)`)+mk(`Crítico (×${eff.critX}${eff.critM<20?' · '+eff.critM+'+':''})`,`fjAtacar(${idx},true)`);
  if(F.podeRajada(db)){ const g=Math.max(3,(db.municao&&db.municao.gasto)||1), rj=F.efetiva(db,am,{rajada:true}); h+=mk(`Rajada (−${g}) — ${E(rj.dam)}`,`fjAtacar(${idx},false,'rajada')`); }
  return h;
}

/* ── munição ── */
function ammoHTML(idx){
  const c=cc(), it=c.inv[idx]; if(!it) return '';
  const db=ITENS_DB.find(x=>x.id===it.dbId); if(!db||db.tipo!=='arma') return '';
  const max=ammoMax(it,db);
  if(!max){
    return db.subTipo==='fogo'||db.alcance ? `<div class="fj-ammo"><span style="font-size:11px;color:var(--white-dust)">Sem controle de munição</span><button class="fj-mini" onclick="fjAmmoConfig(${idx})">Controlar munição</button></div>` : '';
  }
  const F=FM(), cal=calOf(db), cur=ammoCur(it,db), pct=Math.round(cur/max*100);
  const nomeCal = cal ? F.calLabel(cal,db.municao&&db.municao.nome) : (db.municao&&db.municao.nome)||'';
  let h=`<div class="fj-ammo"><span><b>${cur}/${max}</b> <span style="font-size:10px;color:var(--white-dust)">${E(nomeCal)}${cal?' · '+E(ammoLabel(it,db)):''}</span></span>
    <div class="fj-ammo-bar"><i style="width:${pct}%${pct<=25?';background:#ee3000':''}"></i></div>
    <button class="fj-mini" onclick="fjAmmo(${idx},-1)" title="Gastar 1 bala (sem atacar)">−1</button><button class="fj-mini" onclick="fjAmmo(${idx},1)" title="${cal?'Inserir 1 bala da mochila':'Adicionar 1'}">+1</button>
    <button class="fj-mini" onclick="fjRecarregar(${idx})">${FJI.svg('recarregar')}Recarregar</button>${cal?`<button class="fj-mini" onclick="fjDescarregar(${idx})" title="Devolve as balas à mochila">${FJI.svg('ejetar')}Descarregar</button>`:''}<button class="fj-mini" onclick="fjAmmoConfig(${idx})" title="Alterar capacidade">${FJI.svg('engrenagem')}</button>`;
  if(cal){ const rs=F.reserva(c,cal); h+=`<div class="fj-ammo-res">Reserva na mochila: <b style="color:${rs?'#d4a044':'#ee3000'}">${rs}</b> ${E(nomeCal)}${db.municao.recarga==='unitaria'?' · recarga um por vez':''}</div>`; }
  h+='</div>';
  if(_pick && _pick.idx===idx && cal){
    const grupos={}; F.stacksFor(c,cal).forEach(s=>{ const g=grupos[s.db.id]||(grupos[s.db.id]={db:s.db,n:0}); g.n+=(s.it.qtd==null?1:s.it.qtd); });
    h+=`<div class="fj-ammo-pick"><div class="fj-l">Carregar qual munição?</div>${Object.values(grupos).map(g=>{ const rs=F.resumoMod(g.db); return `<button class="fj-mini" onclick="fjRecarregar(${idx},'${g.db.id}',${_pick.uma?'true':'false'})">${E(g.db.nome)} <b>×${g.n}</b>${rs.length?` <small>${E(rs.slice(0,2).join(' · '))}</small>`:''}</button>`; }).join('')}<button class="fj-mini" onclick="fjPickCancel(${idx})">Cancelar</button></div>`;
  }
  return h;
}
window.fjAmmoRefresh = function(idx){
  const b=document.getElementById('fj-ammo-box'); if(b) b.innerHTML=ammoHTML(idx);
  const a=document.getElementById('fj-atk-box'); if(a) a.innerHTML=atkBtnsHTML(idx);
};
window.fjPickCancel = function(idx){ _pick=null; fjAmmoRefresh(idx); };
window.fjAmmo = function(idx,d){
  const c=cc(), it=c.inv[idx]; const db=ITENS_DB.find(x=>x.id===it.dbId); const max=ammoMax(it,db);
  if(d>0 && calOf(db)) return fjRecarregar(idx,null,true);
  it.ammo=Math.max(0,Math.min(max,ammoCur(it,db)+d)); saveDB(); fjAmmoRefresh(idx); renderInvUnificado();
};

/* Recarrega gastando balas da mochila (calibre da arma).
   ammoId: qual munição usar · uma: inserir só 1 bala. Sem calibre = recarga livre. */
window.fjRecarregar = function(idx, ammoId, uma){
  const c=cc(), it=c.inv[idx]; if(!it) return;
  const db=ITENS_DB.find(x=>x.id===it.dbId); if(!db) return;
  const F=FM(), max=ammoMax(it,db), cal=calOf(db);
  if(!cal){ it.ammo=max; saveDB(); fjAmmoRefresh(idx); renderInvUnificado(); toast('Arma recarregada.'); return; }
  if(!ammoId){
    const ids=[...new Set(F.stacksFor(c,cal).map(s=>s.db.id))];
    if(!ids.length){ toast(`Sem munição ${F.calLabel(cal,db.municao.nome)} na mochila.`,'#ee3000'); return; }
    if(ids.length>1){ _pick={idx,uma:!!uma}; fjAmmoRefresh(idx); return; }
    ammoId=ids[0];
  }
  _pick=null;
  const unit = db.municao.recarga==='unitaria' || !!uma;
  const curId = it.ammoTipo || F.comumId(cal);
  let cur=ammoCur(it,db);
  if(ammoId!==curId && cur>0){
    if(unit){ toast('Descarregue a arma antes de trocar o tipo de munição.','#ee3000'); fjAmmoRefresh(idx); return; }
    F.devolver(c,curId,cur); cur=0;
  }
  if(max-cur<=0){ toast('A arma já está cheia.'); fjAmmoRefresh(idx); return; }
  const stack=c.inv.find(x=>x.dbId===ammoId && (x.qtd==null?1:x.qtd)>0);
  if(!stack){ toast('Munição indisponível.','#ee3000'); fjAmmoRefresh(idx); return; }
  const disp=stack.qtd==null?1:stack.qtd, take=Math.min(unit?1:(max-cur),disp);
  stack.qtd=disp-take; it.ammo=cur+take; it.ammoTipo=ammoId;
  if(stack.qtd<=0) c.inv.splice(c.inv.indexOf(stack),1);   // pode deslocar o índice da arma
  saveDB(); renderInvUnificado();
  const am=ITENS_DB.find(x=>x.id===ammoId);
  toast(`${take} × ${am?am.nome:'munição'} — ${it.ammo}/${max}`,'#d4a044');
  abrirActionPanel('inv', c.inv.indexOf(it));
};
window.fjDescarregar = function(idx){
  const c=cc(), it=c.inv[idx]; if(!it) return;
  const db=ITENS_DB.find(x=>x.id===it.dbId); if(!db) return;
  const cur=ammoCur(it,db), cal=calOf(db);
  if(!cur){ toast('A arma já está vazia.'); return; }
  if(cal) FM().devolver(c, it.ammoTipo||FM().comumId(cal), cur);
  it.ammo=0; it.ammoTipo=null; _pick=null;
  saveDB(); fjAmmoRefresh(idx); renderInvUnificado();
  toast(`${cur} bala(s) devolvida(s) à mochila.`,'#d4a044');
};
window.fjAmmoConfig = function(idx){
  const c=cc(), it=c.inv[idx]; const db=ITENS_DB.find(x=>x.id===it.dbId);
  const v=prompt('Capacidade de munição desta arma (0 = não controlar):', ammoMax(it,db)||6); if(v===null) return;
  const n=Math.max(0,Math.min(999,parseInt(v)||0)); it.ammoMax=n; it.ammo=Math.min(ammoCur(it,db),n)||0; if(!n) it.ammoTipo=null;
  saveDB(); fjAmmoRefresh(idx); renderInvUnificado();
};

/* ── item de munição na mochila: ajustar balas / carregar em arma compatível ── */
function munBoxHTML(idx, it, db){
  const c=cc(), F=FM(), n=it.qtd==null?1:it.qtd;
  const armas=c.inv.map((x,i)=>({x,i,d:x.dbId?ITENS_DB.find(y=>y.id===x.dbId):null}))
    .filter(w=>w.d&&w.d.tipo==='arma'&&w.d.municao&&w.d.municao.calibre===db.calibre);
  return `<div class="fj-ammo"><span><b>${n}</b> bala${n>1?'s':''} <span style="font-size:10px;color:var(--white-dust)">${E(db.calibreNome||F.calLabel(db.calibre))}</span></span>
    <button class="fj-mini" onclick="fjMunQtd(${idx},-10)">−10</button><button class="fj-mini" onclick="fjMunQtd(${idx},-1)">−1</button><button class="fj-mini" onclick="fjMunQtd(${idx},1)">+1</button><button class="fj-mini" onclick="fjMunQtd(${idx},10)">+10</button>
    <button class="fj-mini" onclick="fjMunSet(${idx})" title="Definir quantidade exata">${FJI.svg('engrenagem')}</button>
    ${armas.length?`<div class="fj-ammo-pick"><div class="fj-l">Carregar em arma da mochila</div>${armas.map(w=>`<button class="fj-mini" onclick="fjRecarregar(${w.i},'${db.id}')">${FJI.svg('recarregar')}${E(w.x.nome)}</button>`).join('')}</div>`:`<div class="fj-ammo-res">Nenhuma arma deste calibre na mochila.</div>`}</div>`;
}
window.fjMunQtd = function(idx,d){
  const c=cc(), it=c.inv[idx]; if(!it) return;
  it.qtd=(it.qtd==null?1:it.qtd)+d;
  if(it.qtd<=0){ removerInvItem('inv',idx); return; }
  saveDB(); renderInvUnificado(); abrirActionPanel('inv',idx);
};
window.fjMunSet = function(idx){
  const c=cc(), it=c.inv[idx]; if(!it) return;
  const v=prompt('Quantidade exata de balas:', it.qtd==null?1:it.qtd); if(v===null) return;
  const n=Math.max(0,Math.min(9999,parseInt(v)||0));
  if(!n){ removerInvItem('inv',idx); return; }
  it.qtd=n; saveDB(); renderInvUnificado(); abrirActionPanel('inv',idx);
};

/* chips extras na linha do inventário */
window.fjInvChips = function(it, db){
  let h='';
  if(db&&db.tipo==='arma'){ const m=ammoMax(it,db); if(m) h+=`<span style="color:#d4a044">${ammoCur(it,db)}/${m}${calOf(db)?' · '+E(ammoLabel(it,db)):''}</span>`; if(db.danoExtra&&db.danoExtra.length) h+=`<span>+${db.danoExtra.length} dano</span>`; }
  if(db&&FM().isMunicao(db)){
    h+=`<span style="color:#d4a044">${E(db.calibreNome||FM().calLabel(db.calibre))}</span>`;
    FM().resumoMod(db).slice(0,2).forEach(t=>{ h+=`<span>${E(t)}</span>`; });
  }
  if(db&&db._custom) h+=`<span class="fj-custom-tag">AUTORAL</span>`;
  return h;
};

/* depois que abrirActionPanel monta o painel */
window.fjAfterActionPanel = function(src, idx, it, db, rit){
  const btns=document.getElementById('inv-action-btns'); if(!btns) return;
  ['fj-ammo-box','fj-mun-box'].forEach(id=>{ const o=document.getElementById(id); if(o) o.remove(); }); // evita caixas duplicadas ao reabrir o painel
  if(src==='inv' && db && db.tipo==='arma' && db.dam){
    [...btns.children].forEach(b=>{ if(b.getAttribute && (b.getAttribute('onclick')||'').includes('rolarDanoArmaInv_v2')) b.remove(); });
    btns.insertAdjacentHTML('afterbegin', `<span id="fj-atk-box" style="display:contents">${atkBtnsHTML(idx)}</span>`);
    const box=document.createElement('div'); box.id='fj-ammo-box'; box.style.cssText='width:100%'; box.innerHTML=ammoHTML(idx);
    btns.parentNode.insertBefore(box, btns);
  }
  if(src==='inv' && db && FM().isMunicao(db)){
    const box=document.createElement('div'); box.id='fj-mun-box'; box.style.cssText='width:100%'; box.innerHTML=munBoxHTML(idx,it,db);
    btns.parentNode.insertBefore(box, btns);
  }
  if(src==='ritual' && rit){
    const nome=rit.nome.replace(/'/g,"\\'");
    if(rit.damDisc) btns.insertAdjacentHTML('beforeend',`<button class="fj-mini" onclick="fjRolarRitualVersao('${nome}','disc')" style="padding:8px 12px">${FJI.svg('dado')}Discente ${E(rit.damDisc)}</button>`);
    if(rit.damVerd) btns.insertAdjacentHTML('beforeend',`<button class="fj-mini" onclick="fjRolarRitualVersao('${nome}','verd')" style="padding:8px 12px">${FJI.svg('dado')}Verdadeiro ${E(rit.damVerd)}</button>`);
  }
  // editar (autorais)
  if(src==='inv' && db && db._custom) btns.insertAdjacentHTML('beforeend',`<button class="fj-mini" onclick="fjEditarItem('${db.id}')" style="padding:8px 12px">${FJI.svg('editar')}Editar</button>`);
  if(src==='ritual' && rit && rit._custom) btns.insertAdjacentHTML('beforeend',`<button class="fj-mini" onclick="fjEditarRitual('${rit.nome.replace(/'/g,"\\'")}')" style="padding:8px 12px">${FJI.svg('editar')}Editar</button>`);
};
function hex(h){ return (typeof hexToRgb==='function')?hexToRgb(h):'200,60,40'; }
})();
