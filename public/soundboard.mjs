import {soundPacks} from '../sound-catalog.mjs';
import {normalizeSoundboard,soundLibrary,sessionSounds} from '../soundboard-model.mjs';
const safeSource=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}};
const norm=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
function sessionSelector(audio,ui){const sb=normalizeSoundboard(audio);return '<label>Sessão do soundboard<select data-soundboard-session>'+sb.sessions.map(s=>'<option value="'+ui.esc(s.id)+'" '+(s.id===sb.activeSessionId?'selected':'')+'>'+ui.esc(s.name)+'</option>').join('')+'</select></label>';}
function cards(audio,items,ui,{library=false,compact=false}={}){
 const {esc,button}=ui,sb=normalizeSoundboard(audio),session=sb.sessions.find(s=>s.id===sb.activeSessionId);
 return items.map(sound=>{
  const playing=sb.loops.some(c=>c.sound===sound.id),favorite=session.favorites.includes(sound.id),selected=session.sounds.includes(sound.id);
  return '<article class="sound-card'+(playing?' is-looping':'')+'" data-soundcard data-sound-search="'+esc(norm(sound.name+' '+(sound.category||'')+' '+(sound.originalName||'')))+'" data-sound-pack="'+esc(sound.packId)+'" data-sound-favorite="'+favorite+'">'+
   '<button type="button" class="sound-pad" data-act="soundPlay" data-id="'+esc(sound.id)+'" aria-label="Tocar '+esc(sound.name)+' para a mesa"><span aria-hidden="true">'+esc(sound.icon||'▶')+'</span><strong>'+esc(sound.name)+'</strong><small>'+esc(playing?'Em repetição':sound.category||'Efeito')+'</small></button>'+
   '<div class="sound-card-actions">'+button('Ouvir só eu','soundPreview','small','',sound.id)+'<button type="button" class="btn small" data-act="soundFavorite" data-id="'+esc(sound.id)+'" aria-pressed="'+favorite+'" aria-label="'+(favorite?'Desfavoritar ':'Favoritar ')+esc(sound.name)+'">'+(favorite?'★':'☆')+'</button>'+
   (!sound.synthetic?button(playing?'Parar loop':'Repetir','soundLoop','small'+(playing?' primary':''),'',sound.id):'')+'</div>'+
   (library?'<label class="check sound-pick"><input type="checkbox" data-soundboard-pick="'+esc(sound.id)+'" '+(selected?'checked':'')+'> Separar à mão para esta sessão</label>':'')+
   (!compact&&!sound.synthetic?'<details class="sound-credit"><summary>Origem e opções</summary><p>'+esc(sound.author||'Arquivo enviado pelo mestre')+' · '+esc(sound.license||'Arquivo próprio')+'</p>'+(sound.originalName?'<small>'+esc(sound.originalName)+'</small>':'')+(safeSource(sound.source)?'<p><a href="'+esc(safeSource(sound.source))+'" target="_blank" rel="noopener noreferrer">Página da fonte ↗</a></p>':'')+button('Remover arquivo da campanha','soundDelete','small danger','',sound.id)+'</details>':'')+'</article>';
 }).join('');
}
function packCards(audio,ui){
 const {esc,button}=ui,sb=normalizeSoundboard(audio),session=sb.sessions.find(s=>s.id===sb.activeSessionId),installed=audio.packs||[];
 const external=[...soundPacks,...installed.filter(p=>!soundPacks.some(k=>k.id===p.id))];
 const basic=[{id:'basic',name:'Essenciais da Forja',description:'Seis efeitos sintetizados, disponíveis sem download.',author:'Forja de Mesas',license:'Original',ready:true,count:6},{id:'uploads',name:'Arquivos enviados',description:'Os efeitos individuais enviados por você.',ready:true,count:(audio.clips||[]).filter(c=>!c.packId).length}];
 return '<div class="sound-pack-grid">'+[...basic,...external].map(pack=>{
  const count=soundLibrary(audio).filter(s=>s.packId===pack.id).length,ready=pack.ready||count>0;
  return '<article class="panel sound-pack-card"><p class="music-overline">'+esc(pack.author||'Pacote importado')+' · '+esc(pack.license||'Meus arquivos')+'</p><h3>'+esc(pack.name)+'</h3><p>'+esc(pack.description||'Pacote personalizado do mestre.')+'</p><p class="muted">'+(ready?count+' sons disponíveis':(pack.count||'')+' sons no pacote original · ainda não instalado')+'</p>'+
   (ready?'<label class="check"><input type="checkbox" data-soundboard-pack="'+esc(pack.id)+'" '+(session.packs.includes(pack.id)?'checked':'')+'> Usar pacote inteiro nesta sessão</label>':button('Baixar e ativar nesta sessão','soundPackInstall','primary small','',pack.id))+
   (safeSource(pack.source)?'<a href="'+esc(safeSource(pack.source))+'" target="_blank" rel="noopener noreferrer">Fonte e licença ↗</a>':'')+'</article>';
 }).join('')+'</div><details class="sound-sources"><summary>Outras bibliotecas gratuitas</summary><p><a href="https://freesound.org" target="_blank" rel="noopener noreferrer">Freesound</a> · <a href="https://opengameart.org" target="_blank" rel="noopener noreferrer">OpenGameArt</a> · <a href="https://kenney.nl/assets/category:Audio" target="_blank" rel="noopener noreferrer">Kenney</a></p><p>Importe ZIPs ou arquivos que você tem autorização de usar. A licença e o autor ficam registrados com o pacote.</p></details>';
}
export function renderSoundboard(row,ui,view={}){
 const {esc,button}=ui,audio=row.state.audio||{},sb=normalizeSoundboard(audio),session=sb.sessions.find(s=>s.id===sb.activeSessionId);
 if(!row.master)return '<section class="panel block"><h2>Soundboard da mesa</h2><p>O mestre dispara os efeitos. Ajuste o volume dos efeitos no botão flutuante de áudio.</p><details><summary>Créditos dos sons</summary>'+((audio.credits||[]).map(c=>'<p>'+esc(c.author)+' · '+esc(c.license)+(safeSource(c.source)?' · <a href="'+esc(safeSource(c.source))+'" target="_blank" rel="noopener noreferrer">Fonte ↗</a>':'')+'</p>').join('')||'<p>Efeitos originais da Forja e arquivos enviados pelo mestre.</p>')+'</details></section>';
 const tab=view.tab||'session',active=sessionSounds(audio),items=tab==='library'?soundLibrary(audio):active;
 const packs=[{id:'basic',name:'Essenciais'},{id:'uploads',name:'Arquivos enviados'},...audio.packs||[]];
 const body=tab==='packs'?packCards(audio,ui):'<div class="sound-filters"><label>Buscar som<input type="search" data-soundboard-search value="'+esc(view.query||'')+'" placeholder="Nome, categoria ou arquivo" autocomplete="off"></label><label>Pacote<select data-soundboard-filter><option value="all">Todos</option>'+packs.map(p=>'<option value="'+esc(p.id)+'" '+(view.pack===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label class="check"><input type="checkbox" data-soundboard-favorites '+(view.favorites?'checked':'')+'> Favoritos</label></div>'+
  (tab==='library'?'<p class="muted">Marque sons de vários pacotes para montar sua seleção. Escolhas avulsas continuam na sessão mesmo com o pacote inteiro desativado.</p>':'<p class="muted">'+active.length+' sons preparados. “Ouvir só eu” faz uma pré-escuta local; o botão grande toca para todos.</p>')+
  '<div class="sound-grid soundboard-grid">'+cards(audio,items.sort((a,b)=>Number(session.favorites.includes(b.id))-Number(session.favorites.includes(a.id))),ui,{library:tab==='library'})+'</div>'+
  (!items.length?'<p class="empty">Esta seleção está vazia. Ative pacotes ou escolha sons na Biblioteca.</p>':'')+'<p class="muted" data-soundboard-empty hidden>Nenhum som corresponde aos filtros.</p>';
 return '<section class="panel block soundboard-area"><div class="section-head"><div><h2>Soundboard</h2><p class="muted">Prepare os efeitos da sessão e dispare também pelo botão flutuante.</p></div><div class="actions">'+button('Enviar efeito','upload','small','plus','sound')+button('Importar pacote ZIP','soundPackImport','small')+button('Parar todos os efeitos','soundboardStop','danger small')+'</div></div><div class="sound-session-bar">'+sessionSelector(audio,ui)+'<div class="actions">'+button('Nova sessão','soundboardSessionNew','small','plus')+button('Renomear','soundboardSessionEdit','small','',session.id)+(sb.sessions.length>1?button('Excluir sessão','soundboardSessionDelete','small danger','',session.id):'')+'</div><label>Volume dos efeitos para a mesa<input data-soundboard-volume type="range" min="0" max="100" value="'+sb.volume+'"></label></div><nav class="soundboard-tabs" aria-label="Soundboard">'+[['session','Da sessão'],['library','Biblioteca'],['packs','Pacotes']].map(([id,label])=>'<button type="button" class="btn '+(tab===id?'primary':'')+'" data-act="soundboardTab" data-id="'+id+'" aria-pressed="'+(tab===id)+'">'+label+'</button>').join('')+'</nav>'+body+'</section>';
}
export function createSoundboardLibrary(){
 let identity='',view={tab:'session',query:'',pack:'all',favorites:false},events,root;
 function filter(){let shown=0;for(const card of root.querySelectorAll('[data-soundcard]')){card.hidden=Boolean(view.query&&!card.dataset.soundSearch.includes(norm(view.query))||view.pack!=='all'&&card.dataset.soundPack!==view.pack||view.favorites&&card.dataset.soundFavorite!=='true');if(!card.hidden)shown++;}const empty=root.querySelector('[data-soundboard-empty]');if(empty)empty.hidden=shown>0;}
 return {
  render(row,ui){const id=row.id+'/'+normalizeSoundboard(row.state.audio).activeSessionId;if(identity!==id){identity=id;view={tab:view.tab,query:'',pack:'all',favorites:false};}return renderSoundboard(row,ui,view);},
  setTab(tab){if(['session','library','packs'].includes(tab))view.tab=tab;},
  mount(scope){events?.abort();root=scope;events=new AbortController();const options={signal:events.signal};root.addEventListener('input',event=>{if(event.target.matches('[data-soundboard-search]')){view.query=event.target.value;filter();}},options);root.addEventListener('change',event=>{if(event.target.matches('[data-soundboard-filter]')){view.pack=event.target.value;filter();}if(event.target.matches('[data-soundboard-favorites]')){view.favorites=event.target.checked;filter();}},options);filter();},
  dispose(){events?.abort();root=null;}
 };
}
export function createSoundboardDock(root,ui){
 let row,identity='',query='',signature='';
 function update(){
  if(!row)return;
  const audio=row.state.audio,sb=normalizeSoundboard(audio),session=sb.sessions.find(s=>s.id===sb.activeSessionId);
  const signatureNext=JSON.stringify([sb,audio.clips,audio.packs]);
  if(signatureNext!==signature){
   signature=signatureNext;
   const slot=root.querySelector('[data-sound-dock-body]');
   const list=sessionSounds(audio).sort((a,b)=>Number(session.favorites.includes(b.id))-Number(session.favorites.includes(a.id)));
   slot.innerHTML=sessionSelector(audio,ui)+'<label>Buscar efeito<input data-sound-dock-search type="search" value="'+ui.esc(query)+'" autocomplete="off" placeholder="Nome do som"></label><div class="sound-dock-grid">'+cards(audio,list,ui,{compact:true})+'</div>'+(!list.length?'<p class="muted">Prepare esta sessão na aba Áudio.</p>':'')+'<p class="muted">Pré-escuta é local. O botão grande toca para a mesa.</p>'+ui.button('Parar todos os efeitos','soundboardStop','small danger')+ui.button('Preparar soundboard','soundboardOpen','small');
  }
  for(const card of root.querySelectorAll('[data-soundcard]'))card.hidden=!card.dataset.soundSearch.includes(norm(query));
 }
 root.addEventListener('input',event=>{if(event.target.matches('[data-sound-dock-search]')){query=event.target.value;update();}});
 return {sync(next){
  if(!next.id||!next.master||next.needsCharacter){root.hidden=true;root.querySelector('[data-sound-dock-body]').innerHTML='';row=null;identity='';signature='';return;}
  const key=next.id+'/'+next.master;
  if(identity!==key){identity=key;row=null;query='';signature='';}
  else if(row&&next.rev<row.rev)return;
  const incoming=next.state.audio||{},full=Array.isArray(incoming.soundboard?.sessions),old=row?.state.audio||{};
  row={...next,state:{audio:{...old,...incoming,clips:full?incoming.clips||[]:old.clips||[],packs:full?incoming.packs||[]:old.packs||[],soundboard:full?incoming.soundboard:{...old.soundboard,...incoming.soundboard}}}};
  root.hidden=false;update();
 }};
}
