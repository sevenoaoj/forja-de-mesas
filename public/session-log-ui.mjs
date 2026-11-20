function audienceOptions(state){
 return {gm:'Só o mestre',all:'Toda a mesa',...Object.fromEntries((state.parties||[]).map(group=>[group.id,group.name]))};
}
const audienceLabel=(state,entry)=>audienceOptions(state)[entry.audience]||'Grupo removido';
export function clockPanel(row,ui,manage=false){
 const {esc,button}=ui,clocks=row.state.sessionLog?.clocks||[];
 if(!manage&&!clocks.length)return '';
 return '<section class="panel session-clocks"><div class="section-head"><h2>Relógios de progresso</h2>'+
  (manage?button('Criar relógio','clockEdit','small'):'')+'</div>'+
  (clocks.length?'<div class="clock-list">'+clocks.map(c=>{
   const filled=100*c.value/c.segments,divide=360/c.segments;
   return '<article class="clock-card"><span aria-hidden="true" class="clock-face" data-clock-face="'+esc(c.id)+'" style="--filled:'+filled+'%;--divide:'+divide+'deg"></span><div><strong>'+esc(c.title)+'</strong><small>'+c.value+' / '+c.segments+(c.value===c.segments?' · Completo':'')+(row.master?' · '+esc(audienceLabel(row.state,c)):'')+'</small></div>'+
    (row.master?'<div class="actions">'+(c.value>0?button('−1','clockStep','small','','-'+c.id):'')+(c.value<c.segments?button('+1','clockStep','small','','+'+c.id):'')+button('Editar','clockEdit','small','',c.id)+'</div>':'')+'</article>';
  }).join('')+'</div>':'<p>Marque o avanço de um objetivo ou a aproximação de um perigo.</p>')+'</section>';
}
export function clockEditor(state,entry,ui){
 const {input,select,submit,button}=ui;
 return input('id','',entry?.id||'','hidden')+input('version','',entry?.version||0,'hidden')+
  input('title','Objetivo ou perigo',entry?.title||'','text','maxlength="100" required placeholder="Alerta da guarda"')+
  '<div class="form-grid">'+select('segments','Segmentos',{4:'4',6:'6',8:'8'},String(entry?.segments||6))+input('value','Segmentos preenchidos',entry?.value||0,'number','min="0" max="8" required')+'</div>'+
  select('audience','Quem acompanha',audienceOptions(state),entry?.audience||'gm')+submit('Salvar relógio')+(entry?button('Excluir relógio','logRemove','small danger','','clock/'+entry.id):'');
}
export function recapPanel(row,ui,manage=false,filter=''){
 const {esc,button}=ui,entries=(row.state.sessionLog?.recaps||[]).filter(e=>!manage||!filter||e.audience===filter).sort((a,b)=>b.at-a.at);
 if(!entries.length&&!manage)return '';
 function card(e){
  const state=row.state,scene=state.sceneLibrary?.scenes.find(s=>s.id===e.sceneId);
  const links=[...(e.sceneId?[(row.master&&scene?button(scene.name,'recapScene','small','',scene.id):!row.master?button('Abrir cena na mesa','nav','small','','table'):'')]:[]),
   ...e.notes.map(id=>{const n=state.journal?.find(n=>n.id===id);return n?button(n.title,'recapNote','small','',id):'';}),
   ...e.items.map(id=>{const item=state.inventory?.find(item=>item.id===id);return item?button(item.name,'itemOpen','small','',id):'';})];
  const goals=(e.clockIds||[]).map(id=>state.sessionLog.clocks.find(clock=>clock.id===id)).filter(Boolean);
  const progress=goals.length?'<ul>'+goals.map(clock=>'<li>'+esc(clock.title)+' · '+clock.value+' / '+clock.segments+'</li>').join('')+'</ul>':'';
  return '<article class="recap-entry"><small>'+esc(e.sessionName)+(e.sceneName?' · '+esc(e.sceneName):'')+(row.master?' · '+esc(audienceLabel(state,e)):'')+'</small><h3>'+esc(e.title)+'</h3><p>'+esc(e.body)+'</p>'+progress+'<div class="actions">'+links.join('')+(manage?button('Editar resumo','recapEdit','small','',e.id):'')+'</div></article>';
 }
 return '<section class="panel session-recaps"><div class="section-head"><h2>Onde paramos</h2>'+(manage?button('Registrar passagem','recapEdit','small'):'')+'</div>'+(manage&&row.state.parties?.length?'<label>Ver resumos<select data-recap-filter>'+Object.entries({'':'Todos os públicos',...audienceOptions(row.state)}).map(([id,name])=>'<option value="'+esc(id)+'" '+(id===filter?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>':'')+
  (entries.length?card(entries[0])+(entries.length>1?'<details><summary>Resumos anteriores ('+(entries.length-1)+')</summary>'+entries.slice(1).map(card).join('')+'</details>':''):'<p>Registre o que o grupo descobriu e o que ficou para a próxima sessão.</p>')+'</section>';
}
export function recapEditor(row,entry,sessionId,ui,defaultAudience){
 const {esc,input,area,select,button,submit}=ui,state=row.state,lib=state.sceneLibrary;
 const session=lib.sessions.find(s=>s.id===(entry?.sessionId||sessionId))||lib.sessions[0];
 function choices(field,label,list,title){
  return '<details><summary>'+label+'</summary>'+((list||[]).map(item=>'<label class="check"><input type="checkbox" name="'+field+'" value="'+esc(item.id)+'" '+(entry?.[field]?.includes(item.id)?'checked':'')+'> '+esc(item[title])+'</label>').join('')||'<p>Nenhum material disponível.</p>')+'</details>';
 }
 return input('id','',entry?.id||'','hidden')+input('version','',entry?.version||0,'hidden')+input('sessionId','',session.id,'hidden')+'<p>'+esc(session.name)+'</p>'+
  input('title','Título',entry?.title||'','text','maxlength="100" required')+area('body','Descobertas e objetivos pendentes',entry?.body||'','maxlength="4000" required rows="5"')+
  select('audience','Quem pode ler',audienceOptions(state),entry?.audience||defaultAudience||'gm')+
  select('linkedSceneId','Cena vinculada',{'':'Sem cena',...Object.fromEntries(lib.scenes.filter(s=>s.sessionId===session.id).map(s=>[s.id,s.name]))},entry?.sceneId||'')+
  choices('clockIds','Incluir objetivos dos relógios',state.sessionLog?.clocks,'title')+choices('notes','Vincular pistas, missões e notas',state.journal,'title')+choices('items','Vincular itens',state.inventory,'name')+
  '<p class="muted">Cada jogador verá os links para materiais aos quais tem acesso.</p>'+submit('Guardar resumo')+(entry?button('Excluir resumo','logRemove','small danger','','recap/'+entry.id):'');
}
