/* ════════════════════════════════════════════════════════════
   PODERES.JS — Aba de Poderes Paranormais (Arsenal dos Agentes)
   Lista os poderes de PODERES_DB (app.js), filtráveis por
   elemento, com marcação de "conhecido" salva em
   c.poderesAprendidos[nome] = true.
   ════════════════════════════════════════════════════════════ */

let _poderesFiltroElem = 'todos';
let _poderesCategoria = 'paranormais';

function _elemColorPoder(elem){
  const map = { Sangue:'#c22a2a', Morte:'#7a5cd6', Energia:'#cc55ff', Conhecimento:'#e0b800', Medo:'#2a70d6' };
  return map[elem] || 'var(--gold-light)';
}

function renderPoderesTab(){
  if(typeof PODERES_DB === 'undefined' || !currentUser) return;
  const c = userChar(currentUser);
  if(!c.poderesAprendidos) c.poderesAprendidos = {};

  const filtroWrap = document.getElementById('poderes-filtro-elem');
  if(filtroWrap){
    const cats = [['paranormais','⛧ Paranormais'],['gerais','⚔ Gerais']];
    const catBtns = cats.map(([k,label])=>{
      const ativo = _poderesCategoria===k;
      return `<button class="noir-btn ${ativo?'accent':''}" style="font-size:10px;padding:6px 10px" onclick="_poderesCategoria='${k}';renderPoderesTab()">${label}</button>`;
    }).join('');
    let elemBtns = '';
    if(_poderesCategoria==='paranormais'){
      const elems = ['todos','Sangue','Morte','Energia','Conhecimento','Medo'];
      elemBtns = '<span style="width:1px;background:var(--blood-deep);margin:0 4px"></span>' + elems.map(e => {
        const cor = e==='todos' ? 'var(--white-ash)' : _elemColorPoder(e);
        return `<button class="noir-btn" style="border-color:${cor};color:${cor};font-size:10px;padding:6px 10px" onclick="_poderesFiltroElem='${e}';renderPoderesTab()">${e==='todos'?'Todos':e}</button>`;
      }).join('');
    }
    filtroWrap.innerHTML = catBtns + elemBtns;
  }

  const lista = document.getElementById('poderes-lista');
  if(!lista) return;

  if(_poderesCategoria==='gerais'){
    if(typeof PODERES_GERAIS_DB === 'undefined'){ lista.innerHTML=''; return; }
    lista.innerHTML = PODERES_GERAIS_DB.map((p,idx)=>{
      const sabido = !!c.poderesAprendidos[p.nome];
      return `<div style="background:rgba(20,17,14,0.85);border:1px solid ${sabido?'var(--gold-light)':'var(--blood-deep)'};padding:9px 12px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <span style="font-family:'Cinzel',serif;font-size:12px;color:${sabido?'var(--gold-light)':'var(--white-bone)'}">${p.nome}</span>
          <input type="checkbox" ${sabido?'checked':''} onchange="_togglePoderAprendido('${p.nome.replace(/'/g,"\\'")}')" title="Marcar como conhecido">
        </div>
        <div style="font-size:9px;color:var(--white-dust);font-family:'Courier Prime',monospace;margin-top:3px">Pré-requisito: ${p.prereq}</div>
        <div class="desc-click" onclick="_verDescPoderGeral(${idx})" style="font-size:14px;color:var(--white-ash);line-height:1.6;margin-top:5px">${p.desc}
          <div class="desc-click-hint">Ver em tela cheia</div>
        </div>
      </div>`;
    }).join('');
    return;
  }

  const itens = PODERES_DB.filter(p => _poderesFiltroElem==='todos' || p.elem===_poderesFiltroElem);
  const porElem = {};
  itens.forEach(p => { (porElem[p.elem] = porElem[p.elem] || []).push(p); });

  lista.innerHTML = Object.keys(porElem).sort().map(elem => {
    const cor = _elemColorPoder(elem);
    const grupo = porElem[elem].sort((a,b)=> a.circ - b.circ || a.nome.localeCompare(b.nome));
    return `
      <div style="margin-bottom:14px">
        <div style="font-family:'Cinzel',serif;font-size:12px;letter-spacing:.12em;color:${cor};text-transform:uppercase;margin:10px 0 6px;border-bottom:1px solid ${cor}33;padding-bottom:4px">${elem}</div>
        ${grupo.map(p => {
          const sabido = !!c.poderesAprendidos[p.nome];
          const idx = PODERES_DB.indexOf(p);
          return `<div style="background:rgba(20,17,14,0.85);border:1px solid ${sabido?cor:'var(--blood-deep)'};padding:9px 12px;margin-bottom:6px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
              <span style="font-family:'Cinzel',serif;font-size:12px;color:${sabido?cor:'var(--white-bone)'}">${p.nome}</span>
              <span style="display:flex;align-items:center;gap:8px">
                <span style="font-size:9px;color:var(--white-dust);font-family:'Courier Prime',monospace">Círc. ${p.circ}${p.prereq?' · '+p.prereq:''}</span>
                <input type="checkbox" ${sabido?'checked':''} onchange="_togglePoderAprendido('${p.nome.replace(/'/g,"\\'")}')" title="Marcar como conhecido">
              </span>
            </div>
            <div class="desc-click" onclick="_verDescPoderParanormal(${idx})" style="font-size:14px;color:var(--white-ash);line-height:1.6;margin-top:5px">${p.desc}
              ${p.afinidade ? `<div style="font-size:11px;color:${cor};line-height:1.5;margin-top:5px"><b>Afinidade:</b> ${p.afinidade}</div>` : ''}
              <div class="desc-click-hint">Ver em tela cheia</div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }).join('') || '<div style="font-family:\'Courier Prime\',monospace;font-size:12px;color:var(--white-dust)">Nenhum poder encontrado.</div>';
}

/* Abre a descrição completa de um Poder Paranormal em popup, com letras grandes */
function _verDescPoderParanormal(idx){
  const p = PODERES_DB[idx]; if(!p) return;
  const cor = _elemColorPoder(p.elem);
  let extra = `<div style="font-size:12px;color:var(--white-dust);font-family:'Courier Prime',monospace;margin-top:10px">Círculo ${p.circ}${p.prereq?' · Pré-requisito: '+p.prereq:''}</div>`;
  let corpo = p.desc;
  if(p.afinidade) corpo += `<br><br><b>Afinidade:</b> ${p.afinidade}`;
  abrirDescPopup(p.nome, corpo, {cor, subtitulo:'⛧ Poder Paranormal — '+p.elem, extra});
}

/* Abre a descrição completa de um Poder Geral em popup, com letras grandes */
function _verDescPoderGeral(idx){
  const p = PODERES_GERAIS_DB[idx]; if(!p) return;
  const extra = `<div style="font-size:12px;color:var(--white-dust);font-family:'Courier Prime',monospace;margin-top:10px">Pré-requisito: ${p.prereq}</div>`;
  abrirDescPopup(p.nome, p.desc, {cor:'var(--gold-light)', subtitulo:'⚔ Poder Geral', extra});
}

function _togglePoderAprendido(nome){
  if(!currentUser) return;
  const c = userChar(currentUser);
  if(!c.poderesAprendidos) c.poderesAprendidos = {};
  if(c.poderesAprendidos[nome]) delete c.poderesAprendidos[nome];
  else c.poderesAprendidos[nome] = true;
  saveDB();
  renderPoderesTab();
}
