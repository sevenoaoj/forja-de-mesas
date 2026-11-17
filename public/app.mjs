import {lootPlacement,lootPreview,createLootRewards} from './loot.mjs';
import {renderSheetResource,sheetColorsForm,sheetColorsPayload,createResourceAnimations} from './sheet-resources.mjs';
import {renderInventory,sheetInventory,itemEditor,itemGrantForm,itemDetails,itemManageForm,updateItemAccent} from './inventory.mjs';
import {createSheetHistoryController} from './sheet-history-controller.mjs';
import {createAccessStorage,restoreCampaignIdentity} from './player-access.mjs';
import {createInlineSheetEditor} from './sheet-inline.mjs';
import {sheetTemplateLibrary,sheetTemplateSaveForm,sheetTemplateEditForm,sheetTemplateApplyForm,downloadSheetTemplate} from './sheet-templates.mjs';
import {renderJournal,journalEditor,journalFormData} from './journal.mjs';
import {renderSceneManager,renderSceneCards} from './scenes.mjs';
import {renderTokenAppearance,updateTokenAppearance} from './token-editor.mjs';
import {createSheetMosaic,renderSheetMosaic,renderSheetLayoutEditor,sheetThemeStyle,sheetFieldTone} from './sheet-mosaic.mjs';
import {renderGmScreen,renderGmCards,gmCardEditor,gmCategories,visibleGmCards,gmPartyFieldsEditor} from './gm-screen.mjs';
import {createDiceDisplay,createNarrationDisplay} from './rolls.mjs';
import {narrationComposer,narrationFormData,updateNarrationComposer} from './narration.mjs';
import {dndCatalog,dndAbilities,dndClasses,dndBackgrounds,dndWeapons,dndModifier,dndDerived,dndBook,dndAttribution} from './dnd.mjs';
import {dndCreation,dndFormData,updateDndCreation,dndCatalogShell,renderDndResults} from './dnd-ui.mjs';
import {newCampaign, colors, characterColorNames, icons, rollFormulaLimit, sheetFields, sheetValue, skillValues, inviteOrigin,resolveSheetFormula,displaySheetFormula,sheetPresets,sheetPreset,sheetSkillTest,sheetSavedRollFormula} from './model.mjs';
import {emptyAudio,soundPresets} from './media.mjs';
import {campaignAudio} from './audio.mjs';
import {createSoundboardLibrary,createSoundboardDock} from './soundboard.mjs';
import {normalizeSoundboard} from './soundboard-model.mjs';
import {createMusicLibrary,createMusicDock,createAudioPopover} from './music.mjs';
import {createTabletop} from './table.mjs';
import {createTableLive} from './table-live.mjs';
import {normalizeTable,mapGrid,normalizeVision} from './table-model.mjs';

const $ = (selector,root=document) => root.querySelector(selector);
const dialog = $('#dialog');
const main = $('#main');
const lobby = {master:true, rev:0, state:newCampaign('',false)};
const pages = {
  home:['Visão geral','home'],
  sheets:['Fichas','sheets','Crie e personalize seus personagens.','violet'],
  table:['Mesa virtual','table','Explore mapas, mova tokens e role dados.','jade'],
  shield:['Escudo do mestre','shield','Consulte fichas e organize a sessão.','gold'],
  inventory:['Inventário','sheets','Prepare itens e organize os equipamentos dos personagens.','jade'],
  journal:['Diário','library','Organize pistas, locais e missões da campanha.','gold'],
  library:['Biblioteca','library','Consulte os livros de regras da campanha.','blue'],
  audio:['Áudio','audio','Toque músicas e efeitos na sessão.','rose']
};
const paths = {
  home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/>',
  sheets:'<path d="M7 3h7l4 4v14H6V3zM14 3v5h4M9 12h6m-6 4h6"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16m6-16v16"/>',
  shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  library:'<path d="M12 6v15M3 4c4 0 6 0 9 2 3-2 5-2 9-2v15c-4 0-6 0-9 2-3-2-5-2-9-2z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  invite:'<path d="M9 7H7a4 4 0 0 0 0 8h2m6-8h2a4 4 0 0 1 0 8h-2m-7-4h8"/>',
  arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
  audio:'<path d="M10 18V5l10-2v13M10 7l10-2"/><ellipse cx="6.5" cy="18.5" rx="3.5" ry="2.5"/><ellipse cx="16.5" cy="16.5" rx="3.5" ry="2.5"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 16h.01m-4-4h.01"/>'
};
const svg = name => '<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
const esc = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const button = (label,action,style='',icon='',id='') => '<button type="button" class="btn '+style+'" data-act="'+action+'" data-id="'+esc(id)+'">'+(icon?svg(icon):'')+esc(label)+'</button>';
const input = (name,label,value='',type='text',extra='') => '<label>'+label+'<input type="'+type+'" name="'+name+'" value="'+esc(value)+'" '+extra+'></label>';
const area = (name,label,value='',extra='') => '<label>'+label+'<textarea name="'+name+'" '+extra+'>'+esc(value)+'</textarea></label>';
const submit = label => '<div class="actions"><button class="btn primary" type="submit">'+label+'</button></div>';
const empty = text => '<p class="empty">'+text+'</p>';
const accessStorage=createAccessStorage();
const read=key=>accessStorage.read(key);
let credentials = null;
let current = lobby;
let stateReceivedAt=performance.now();
let page = 'home';
let audioPane='music';
let gmView={query:'',category:'all'},gmIdentity='';
let backupDownloading=false;
let inventoryView={scope:'',query:''};
let journalView={query:'',kind:'all',collapsed:[]},journalIdentity='';
const gmNoteDrafts=new Map();
let sheetId='',sheetViewer='';
let sheetView;
const portraitCache=new Map();
let portraitIdentity;
let epoch = 0;
let noticeTimer;
let audioSyncing=false,campaignRefresh=null;
let reconnectingAccess=null;
let rollIdentity='',latestRollRevision=-1,latestRollVersion='';
let sceneRevision=-1,sceneIdentity='';
let sceneSelectionVersion=0,scenePanelSignature='';
let gmSceneId='',sceneUI={open:false,session:'all',query:''};
const sheetMosaic=createSheetMosaic({render,report:toast});
const resourceAnimations=createResourceAnimations();
const diceDisplay=createDiceDisplay($('#dice-display'));
const narrationDisplay=createNarrationDisplay($('#narration-display'),{report:toast,acknowledge:async id=>{
  const access=credentials;
  if(!access)throw new Error('Abra a campanha para confirmar a leitura.');
  const row=await post('/'+access.id+'/action',{action:'narrationRead',data:{id}},access);
  if(credentials===access)narrationDisplay.sync(row);
}});
const lootRewards=createLootRewards({dialog,current:()=>currentView(),access:()=>credentials,modal,ui:gmUI});
const inlineSheet=createInlineSheetEditor(main,{report:toast,allowed:()=>page==='sheets'&&!sheetMosaic.editing,
  settled:()=>{if(page==='sheets')render();},save:async data=>{
    const access=credentials;
    const row=await post('/'+access.id+'/action',{action:'sheetValue',data},access);
    if(credentials===access&&row.rev>=current.rev)setCurrent(row);
  }
});
const audioPopover=createAudioPopover($('#audio-controls'));
const musicLibrary=createMusicLibrary();
const soundboardLibrary=createSoundboardLibrary();
const soundboardDock=createSoundboardDock($('#master-soundboard'),{esc,button});
const musicDock=createMusicDock($('#master-playlist'),{esc,button});
const audioPlayer = campaignAudio($('#audio-dock'),id=>request(campaignPath()+'/asset/'+id),toast,(command,data={})=>action('track',{command,...data}));
const tableLive=createTableLive({request,onEvent:receiveTableEvent,onStatus:status=>tabletop.setConnectionStatus?.(status)});
const tabletop = createTabletop({
  action,
  realtime:event=>{if(!current.master||current.state.sceneId===current.state.activeSceneId)tableLive.send({...event,sceneId:current.state.sceneId});},
  openCharacter:openSheet,
  openLoot:id=>handlers.lootOpen(id),
  report:toast,
  requestAsset:id=>request(campaignPath()+'/asset/'+id)
});

function toast(message) {
  const target = $(dialog.open?'#dialog-notice':'#notice');
  $('#notice').textContent = '';
  $('#dialog-notice').textContent = '';
  target.textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(()=>target.textContent='',4800);
}

async function request(path, options={}, access=credentials) {
  const headers = new Headers(options.headers);
  if (access?.key) headers.set('Authorization','Bearer '+access.key);
  if(access?.id===credentials?.id&&access?.key===credentials?.key&&current.master&&gmSceneId&&/^\/[^/?]+(?:\/(?:sync|events))?(?:\?|$)/.test(path)){const url=new URL(path,'http://forja');if(!url.searchParams.has('scene'))url.searchParams.set('scene',access.sceneId||gmSceneId);path=url.pathname+url.search;}
  const response = await fetch('/api/campaigns'+path,{...options,headers});
  if (!response.ok) {
    const body = await response.json().catch(()=>({}));
    throw Object.assign(new Error(body.error || 'Não foi possível acessar a mesa.'),{status:response.status});
  }
  return response;
}
const campaignPath = () => '/'+credentials.id;
const post = (path,data,access) => request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)},access).then(response=>response.json());

function setCurrent(row) {
  if(inlineSheet.editing&&(row.id!==current.id||!row.master&&!row.state.characters.some(c=>c.id===inlineSheet.characterId&&c.access==='full')))inlineSheet.cancel();
  const nextSceneIdentity=(row.id||'')+'/'+(credentials?.key||'');
  if(sceneIdentity===nextSceneIdentity&&row.rev<latestRollRevision)row={...row,state:{...row.state,rolls:current.state.rolls}};
  if(sceneIdentity!==nextSceneIdentity){sceneIdentity=nextSceneIdentity;sceneRevision=-1;gmSceneId='';sceneUI={open:false,session:'all',query:''};}
  if(row.rev<sceneRevision&&current.id===row.id)row={...row,state:{...row.state,table:current.state.table,tokens:current.state.tokens,map:current.state.map,scene:current.state.scene,sceneId:current.state.sceneId,activeSceneId:current.state.activeSceneId,sessionName:current.state.sessionName,sceneLibrary:current.state.sceneLibrary}};
  else sceneRevision=row.rev;
  current=row;
  if(sceneUI.session!=='all'&&!row.state.sceneLibrary?.sessions.some(session=>session.id===sceneUI.session))sceneUI.session='all';
  if(row.master)gmSceneId=row.state.sceneId||gmSceneId;
  stateReceivedAt=performance.now();
}

function syncTableConnection(){
  tableLive.connect(credentials&&!current.needsCharacter?{...credentials,sceneId:current.master?gmSceneId:undefined}:null);
  tabletop.setConnectionStatus?.(tableLive.status);
}
function syncSceneOrganizer(){
  if(page!=='table'||!current.master)return;
  const signature=JSON.stringify([current.state.sceneLibrary,current.state.sceneId,sceneUI]);if(signature===scenePanelSignature)return;
  if(document.activeElement?.matches?.('[data-scene-search],[data-scene-session]'))return;
  const panel=main.querySelector('[data-scene-organizer]');if(!panel?.matches?.('[data-scene-organizer]'))return;
  panel.outerHTML=renderSceneManager(currentView(),sceneUI);scenePanelSignature=signature;applyPortraits();
}
function syncCurrentTable(){
  if(page!=='table'||current.needsCharacter||!tabletop.syncScene?.({...currentView(),rev:Math.max(current.rev,sceneRevision)}))return false;
  audioPlayer.sync(currentView());musicDock.sync(currentView());soundboardDock.sync(currentView());audioPopover.sync(currentView());observeRolls(currentView());syncSceneOrganizer();applyPortraits();return true;
}
function receiveTableEvent(event){
  if(!credentials)return;
  if(event.type==='scene'){
    if(event.id!==current.id||event.rev<sceneRevision)return;
    if(current.master&&gmSceneId&&event.state?.sceneId!==gmSceneId&&event.state?.sceneLibrary?.scenes.some(scene=>scene.id===gmSceneId))return;
    sceneRevision=event.rev;
    current={...current,state:{...current.state,...event.state}};
    if(current.master&&event.state?.sceneId)gmSceneId=event.state.sceneId;
    const row={...currentView(),rev:event.rev,rollVersion:event.rollVersion};
    observeRolls(row);
    if(page==='table'){if(!tabletop.syncScene?.(row)&&!tabletop.isInteracting()&&!dialog.open)render();else syncSceneOrganizer();}
    if(event.needsCharacter!==undefined&&(event.needsCharacter!==current.needsCharacter||event.characterId!==current.characterId))refresh();
  }else if(event.type==='tokenPreview'&&page==='table'&&(!event.sceneId||event.sceneId===current.state.sceneId))tabletop.receiveRealtime?.(event);
  else if(event.type==='closed'){tableLive.disconnect();refresh();}
}

function currentView() {
  return {...current,serverTime:current.serverTime
    ? current.serverTime+performance.now()-stateReceivedAt : Date.now()};
}

function remember(row,access) {
  const list = read('forja.campaigns') || {};
  list[access.id] = {...access,name:row.state.name,master:row.master};
  accessStorage.write('forja.campaigns',list);
  accessStorage.write('forja.active',access.id);
  if(!row.master){const keys=read('forja.memberKeys')||{};keys[access.id]=access.key;accessStorage.write('forja.memberKeys',keys);}
  accessStorage.write('forja.forgotten',(read('forja.forgotten')||[]).filter(id=>id!==access.id));
}

async function openCampaign(access) {
  const version = ++epoch;
  reconnectingAccess=access;
  const restored=await restoreCampaignIdentity(access,{request,post,read,write:(key,value)=>accessStorage.write(key,value),makeKey:()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')});
  if (epoch !== version) return;
  const {row}=restored;access=restored.access;
  reconnectingAccess=null;
  credentials = access;
  setCurrent(row);
  sheetId='';
  remember(row,access);
  render();
}

async function createCampaign(name,withExample=false,resetPage=true,ruleset='free') {
  ++epoch;
  const row = await post('',{name,example:false,ruleset},null);
  reconnectingAccess=null;
  credentials = {id:row.id,key:row.key};
  setCurrent(row);
  remember(row,credentials);
  if (resetPage) {page = 'home';sheetId='';}
  render();
}

async function ensureCampaign() {
  if (credentials) return;
  createDialog();
  throw new Error('Crie ou abra uma campanha para continuar.');
}

async function action(name,data) {
  await ensureCampaign();
  const access = credentials;
  const row = await post(campaignPath()+'/action',{action:name,data:{...data,sceneId:data?.sceneId||current.state.sceneId}},access);
  if(credentials!==access)return;
  // Preserve the private pickup receipt if a newer scene snapshot arrived first.
  if(row.rev<current.rev)return name==='lootCollect'?row:undefined;
  if(current.master&&gmSceneId&&row.state.sceneId!==gmSceneId&&row.state.sceneLibrary?.scenes.some(scene=>scene.id===gmSceneId)){refresh();return row;}
  setCurrent(row);
  if(name==='roll'&&data?.masteryId&&sheetView) sheetView.mastery='';
  if (name === 'settings') remember(row,access);
  if(name.startsWith('scene')||name.startsWith('session')||!syncCurrentTable())render();
  return row;
}

function feature(key) {
  const [label,icon,desc,color] = pages[key];
  return '<button type="button" class="feature" data-act="nav" data-id="'+key+'"><span class="feature-icon '+color+'">'+svg(icon)+'</span><h3>'+label+'</h3><p>'+desc+'</p></button>';
}

function avatar(character,index) {
  return '<span class="avatar '+esc(character.color)+'" aria-hidden="true"><span>'+icons[index%icons.length]+'</span>'+(character.portrait?'<img alt="" hidden data-portrait="'+esc(character.portrait.id)+'">':'')+'</span>';
}

function characterCards(characters) {
  return characters.length ? '<div class="card-grid">'+characters.map((c,i)=>{
    const full=current.master||c.access==='full';
    const content=avatar(c,i)+'<span><strong>'+esc(c.name)+'</strong><p class="muted">'+esc(c.concept||'Personagem')+'</p>'+
      '<small class="count-tag">'+(c.characterType==='npc'?'NPC':'Jogador')+'</small>'+
      (c.hidden?'<small class="count-tag">Oculta dos jogadores</small>':'')+
      (!current.master&&!full&&c.characterType!=='npc'?'<small class="muted">Personagem de outro jogador</small>':'')+'</span>';
    return full ? '<button class="card character-card" data-act="character" data-id="'+esc(c.id)+'">'+content+'</button>'
      : '<article class="card character-card">'+content+'</article>';
  }).join('')+'</div>' : empty('Nenhuma ficha criada nesta campanha.');
}

function chooseCharacter(state) {
  const available=state.characters.filter(character=>character.characterType!=='npc'&&character.available);
  return head('Escolha seu personagem','Selecione uma ficha disponível ou crie seu personagem. O vínculo fica salvo no servidor e seu acesso é lembrado neste navegador.',
    button('Já tenho um personagem','campaignRecover','small')+button('Usar modelo salvo','sheetTemplates','small')+button('Criar meu personagem','character','primary','plus'))+
    '<div class="card-grid">'+available.map((character,i)=>
      '<button class="card character-card" data-act="characterClaim" data-id="'+esc(character.id)+'">'+avatar(character,i)+
      '<span><strong>'+esc(character.name)+'</strong><p class="muted">'+esc(character.concept||'Personagem disponível')+'</p></span></button>'
    ).join('')+'</div>'+(!available.length?empty('Sua ficha pode continuar vinculada ao acesso anterior. Use seu código de jogador ou peça ao mestre o código em “Recuperar acesso do jogador”, na ficha existente.'):'');
}

function head(title,desc,actions='') {
  return '<div class="page-head"><div><h1>'+title+'</h1><p class="subtitle">'+desc+'</p></div><div class="actions">'+actions+'</div></div>';
}

function home(state) {
  return '<section class="hero"><div class="hero-copy"><span class="hero-tag">✧ '+esc(state.system||'Sistema livre')+'</span><h1>'+esc(state.name)+'</h1>'+
    (state.description?'<p>'+esc(state.description)+'</p>':'<p>Cena atual · '+esc(state.scene)+'</p>')+
    '<div class="actions">'+button('Abrir mesa virtual','nav','primary','arrow','table')+(current.master?button('Backup da campanha','campaignAccess')+button('Editar campanha','settings'):'')+'</div></div></section>'+
    '<section class="block"><div class="section-head"><h2>Ferramentas da campanha</h2></div><div class="feature-grid">'+Object.keys(pages).filter(key=>key!=='home'&&(key!=='shield'||current.master)).map(feature).join('')+'</div></section>'+
    '<section class="block"><div class="section-head"><h2>Personagens</h2>'+button('Ver fichas','nav','ghost small','arrow','sheets')+'</div>'+characterCards([...state.characters].sort((a,b)=>Number(b.id===current.characterId)-Number(a.id===current.characterId)).slice(0,3))+'</section>';
}

function rollDetails(roll) {
  const dice = roll.groups
    ? roll.groups.map(group=>(group.sign<0?'−':'')+group.dice.length+'d'+group.faces+' ['+group.dice.join(', ')+']'+(group.kept?' → '+group.kept.join(', '):'')).join(' · ')
    : roll.dice.join(', ');
  return (roll.mastery?esc(roll.mastery.name)+' '+esc(roll.mastery.die)+' · ':'')+dice+(roll.modifier?' · '+(roll.modifier>0?'+':'')+roll.modifier:'');
}

function dice(state) {
  return '<section class="panel"><h2>Dados</h2><form class="stack" data-form="roll">'+input('formula','Expressão','1d20','text','required maxlength="'+rollFormulaLimit+'"')+
    input('actor','Nome na rolagem',read('forja.actor')||(current.master?'Mestre':'Jogador'),'text','maxlength="60"')+
    submit('Rolar dados')+'</form></section><section class="panel"><h2>Histórico</h2>'+
    (state.rolls.length?'<ul class="roll-list">'+state.rolls.map(r=>'<li><div><b>'+esc(r.actor)+'</b><div class="muted">'+(r.label?esc(r.label)+' · ':'')+esc(r.expression||r.formula)+(r.expression?' = '+esc(r.formula):'')+' · '+rollDetails(r)+'</div></div><strong>'+r.total+'</strong></li>').join('')+'</ul>':'<p class="muted">As rolagens da mesa aparecem aqui.</p>')+'</section>';
}

function table() {
  return renderSceneManager(currentView(),sceneUI)+tabletop.render(currentView());
}

function gmUI(){return {esc,button,input,area,select,submit,head};}
function gmCard(id){return current.state.gmScreen?.cards.find(card=>card.id===id);}
function shield() {
  if(gmIdentity!==current.id){gmIdentity=current.id;gmView={query:'',category:'all'};}
  return renderGmScreen(currentView(),gmUI(),{...gmView,notes:gmNoteDrafts.get(current.id)});
}

function library(state) {
  const srd=state.books.find(book=>book.source==='srd-5.2.1');
  return '<section class="panel block dnd-book-card"><div><h2>D&D 2024 · SRD 5.2.1</h2><p class="muted">Regras públicas: consultas rápidas em português e PDF oficial completo em inglês.</p></div><div class="actions">'+button('Consultar regras','dndReference','primary')+(srd?button('Abrir cópia local','book','','',srd.id):button('Abrir livro oficial','dndBook'))+(current.master&&!srd?button('Salvar livro para esta mesa','dndBookImport','small'):'')+'</div></section>'+head('Biblioteca','Livros de regras disponíveis para os participantes.',current.master?button('Adicionar PDF','upload','primary','plus','pdf'):'')+
    (state.books.length?'<div class="card-grid">'+state.books.map(book=>'<article class="card library-card"><span class="feature-icon blue">'+svg('library')+'</span><h3>'+esc(book.name)+'</h3><p class="muted">PDF · '+(book.size/1024/1024).toLocaleString('pt-BR',{maximumFractionDigits:2})+' MB</p><div class="actions">'+button('Abrir PDF','book','small','',''+book.id)+(current.master?button('Remover','bookDelete','small danger','',book.id):'')+'</div></article>').join('')+'</div>':empty('A biblioteca está vazia.'));
}

function audioScreen(state) {
  return head('Áudio da campanha','Prepare a trilha e os efeitos de cada sessão.',
    button(audioPlayer.enabled&&!audioPlayer.blocked?'Silenciar nesta aba':'Ativar áudio','audioToggle',audioPlayer.enabled&&!audioPlayer.blocked?'':'primary','audio'))+
    '<nav class="audio-tabs" aria-label="Áudio da campanha">'+button('Música','audioPane',audioPane==='music'?'primary':'small','','music')+button('Soundboard','audioPane',audioPane==='soundboard'?'primary':'small','','soundboard')+'</nav>'+
    (audioPane==='soundboard'?soundboardLibrary.render(currentView(),{esc,button,input,select,submit,empty}):musicLibrary.render(currentView(),{esc,button,input,select,submit,empty}));
}

const diceFaces = [2,4,6,8,10,12,20,100];

function currentSheet() {
  return current.state.characters.find(character=>character.id===sheetId);
}

function openSheet(id) {
  const character=current.state.characters.find(character=>character.id===id);
  if (!character||!current.master&&character.access!=='full') return;
  const viewer=current.id+'/'+id+'/'+Boolean(current.master);
  if (sheetId!==id||sheetViewer!==viewer) {
    sheetViewer=viewer;
    sheetView={editing:true,tab:'skills',query:'',favorites:false,dice:[],formula:'',bonus:'',layoutView:read('forja.sheet.reading.'+(current.master?'master':'player'))||(current.master?'standard':character.appearance?'custom':'standard')};
  }
  sheetId=id;
  page='sheets';
  render();
  main.focus({preventScroll:true});
  window.scrollTo({top:0});
}

function sheetControl(label,actionName,id,extra='') {
  return '<button type="button" class="sheet-icon-button" aria-label="'+label+'" title="'+label+'" data-act="'+actionName+'" data-id="'+esc(id)+'" '+extra+'>';
}

function sheetFieldValue(character,field) {
  const value = sheetValue(character,field);
  const label = esc(field.label);
  const editable=!(character.dnd&&(['dd-class','dd-species','dd-background'].includes(field.id)||dndDerived(character,field.id)!==null));
  const inline=content=>editable?inlineValue(character,field.id,field.type,value,content,field.label):content;
  if (field.type==='number') return '<div data-sheet-tone="'+sheetFieldTone(field)+'" class="stat-tile stat-'+esc(field.id)+'">'+inline('<strong>'+esc(value||'—')+'</strong>')+'<span>'+label+'</span>'+(character.dnd&&/^dd-(str|dex|con|int|wis|cha)$/.test(field.id)?'<small>Mod. '+(dndModifier(character,field.id.slice(3))>=0?'+':'')+dndModifier(character,field.id.slice(3))+'</small>':'')+'</div>';
  if (field.type==='counter') {
    const step = (direction,icon,disabled) => sheetControl(direction>0?'Aumentar '+label:'Diminuir '+label,'sheetCounter',field.id,
      'data-step="'+direction+'" '+(disabled?'disabled':''))+icon+'</button>';
    return renderSheetResource(character,field,value,{inline,step});
  }
  const text = field.type==='check' ? (value==='true'?'✓ Marcado':'□ Desmarcado') : esc(value||'—');
  return '<div data-sheet-tone="'+sheetFieldTone(field)+'" class="sheet-value"><strong>'+label+'</strong>'+inline('<p>'+text+'</p>')+'</div>';
}

function inlineValue(character,field,type,value,content,label,property='',category='',entry=''){
 return '<div class="sheet-inline" data-sheet-inline tabindex="0" role="button" aria-label="Editar '+esc(label)+'" title="Clique para editar · Enter salva · Escape cancela" data-inline-category="'+esc(category)+'" data-inline-entry="'+esc(entry)+'" data-inline-character="'+esc(character.id)+'" data-inline-field="'+esc(field)+'" data-inline-property="'+esc(property)+'" data-inline-type="'+esc(type)+'" data-inline-value="'+esc(value)+'"'+(type==='color'?' data-inline-options="'+esc(JSON.stringify(colorNames))+'"':'')+'>'+content+'</div>';
}
function inlineIdentity(character){
 return inlineValue(character,'','name',character.name,'<h1>'+esc(character.name)+'</h1>','nome','name')+
 inlineValue(character,'','concept',character.concept||'','<p class="muted">'+esc(character.concept||'Conceito do personagem')+'</p>','conceito','concept')+
 '<button type="button" class="btn small sheet-accent-button" data-act="sheetColors"><span aria-hidden="true"></span>Destaque da ficha</button>';
}

function sheetPortraitMarkup(character){
  return '<div class="sheet-portrait"><span aria-hidden="true">'+esc(character.name[0]?.toUpperCase()||'✧')+'</span>'+
    (character.portrait?'<img alt="" data-portrait="'+esc(character.portrait.id)+'" hidden>':'')+'</div>';
}

function sheetGeneral(character,state) {
  const fields=sheetFields(state,character);
  const groupBy = Map.groupBy(fields,field=>field.group);
  const sections = [...groupBy].map(([group,groupFields])=>{
    const numbers=groupFields.filter(field=>field.type==='number');
    return '<section class="sheet-section"><h3>'+esc(group)+'</h3>'+
      (numbers.length?'<div class="stat-grid">'+numbers.map(field=>sheetFieldValue(character,field)).join('')+'</div>':'')+
      groupFields.filter(field=>field.type!=='number').map(field=>sheetFieldValue(character,field)).join('')+'</section>';
  }).join('');
  const portrait=sheetPortraitMarkup(character);
  const editing = sheetView.editing ? '<div class="actions">'+
    button('Personalizar ficha','sheetFields','small')+button('Adicionar atributo','sheetFields','small','plus','number')+button('Adicionar recurso','sheetFields','small','plus','counter')+
    (current.master&&character.claimed?button('Recuperar acesso do jogador','characterAccess','small')+button('Liberar personagem','characterRelease','small'):'')+button(character.portrait?'Trocar retrato':'Enviar retrato','sheetPortrait','small')+
    (character.portrait?button('Remover retrato','sheetPortraitDelete','small danger'):'')+'</div>' : '';
  return '<section class="sheet-panel" data-sheet-tone="identity"><div class="sheet-panel-header"><h2>Geral</h2></div>'+
    '<div class="sheet-identity">'+portrait+'<div>'+inlineIdentity(character)+'</div></div>'+
    '<div class="sheet-body">'+(character.dnd?'<div class="actions">'+button('Regras e magias','dndReference','small','',character.id)+button('Descansar','dndRest','small','',character.id)+'</div>':'')+editing+sections+(sections?'':'<p class="muted">Adicione campos no modo de edição.</p>')+'</div></section>';
}

function normalizeSearch(value) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
}

function sheetSkillList(character,state) {
  const query=normalizeSearch(sheetView.query.trim());
  const skills=[...(character.skills||[])].filter(skill=>normalizeSearch(skill.name).includes(query));
  if (sheetView.favorites) skills.sort((a,b)=>Number(b.favorite)-Number(a.favorite));
  const fields=sheetFields(state,character);
  return skills.length ? '<div class="skill-table"><div class="skill-table-head"><span>Perícia</span><span>Base</span><span>Bônus</span><span>Outros</span><span>Total</span></div>'+
    skills.map(skill=>{
      const {base,bonus,other,total}=skillValues(character,skill,state);
      const attribute=fields.find(field=>field.id===skill.attribute);
      return '<div class="skill-row'+(skill.favorite?' favorite':'')+'"><div class="skill-name">'+
        sheetControl(skill.favorite?'Desmarcar favorita':'Marcar favorita','sheetFavorite',skill.id,'aria-pressed="'+skill.favorite+'"')+(skill.favorite?'★':'☆')+'</button>'+
        '<div>'+inlineValue(character,'','name',skill.name,'<strong>'+esc(skill.name)+'</strong>','nome da perícia','name','skills',skill.id)+(attribute?'<small>'+esc(attribute.label)+'</small>':'')+'</div></div>'+
        (skill.attribute?'<span>'+base+'</span>':inlineValue(character,'','number',String(skill.base||0),'<span>'+base+'</span>','base','base','skills',skill.id))+(character.dnd?'<span>'+bonus+'</span>':inlineValue(character,'','number',String(skill.bonus||0),'<span>'+bonus+'</span>','bônus','bonus','skills',skill.id))+inlineValue(character,'','number',String(skill.other||0),'<span>'+other+'</span>','outros modificadores','other','skills',skill.id)+
        '<button class="skill-total" type="button" data-act="sheetSkillRoll" data-id="'+esc(skill.id)+'" title="Rolar teste de '+esc(skill.name)+'" aria-label="Rolar teste de '+esc(skill.name)+'">'+total+'</button>'+
        (sheetView.editing?'<div class="skill-edit">'+button('Vínculo e opções','sheetSkill','small','',skill.id)+'</div>':'')+'</div>';
    }).join('')+'</div>' : '<p class="sheet-empty">'+(query?'Nenhuma perícia encontrada.':'Nenhuma perícia cadastrada.')+'</p>';
}

function sheetAbilitiesMarkup(character){return ((character.abilities||[]).length?character.abilities.map(ability=>'<article class="ability-card">'+inlineValue(character,'','name',ability.name,'<h3>'+esc(ability.name)+'</h3>','nome da habilidade','name','abilities',ability.id)+
      inlineValue(character,'','long',ability.description||'','<p>'+esc(ability.description||'Adicionar descrição')+'</p>','descrição da habilidade','description','abilities',ability.id)+(ability.sourcePage?'<a class="btn small" href="'+dndBook+'#page='+ability.sourcePage+'" target="_blank" rel="noopener noreferrer">Ver no livro ↗</a>':'')+(character.dnd&&ability.id.startsWith('spell-')?button('Conjurar','dndCast','small primary','',character.id+'/'+ability.id):'')+
      (sheetView.editing?button('Opções da habilidade','sheetAbility','small','',ability.id):'')+'</article>').join(''):'<p class="sheet-empty">Nenhuma habilidade cadastrada.</p>');}

function sheetCompetencies(character,state) {
  const isSkills=sheetView.tab==='skills';
  const tabs = ['skills','abilities'].map((key,i)=>'<button class="sheet-tab" type="button" data-act="sheetTab" data-id="'+key+'" aria-pressed="'+(sheetView.tab===key)+'">'+['Perícias','Habilidades'][i]+'</button>').join('');
  const body = isSkills
    ? input('sheet-search','Buscar perícia',sheetView.query,'search','data-skill-search autocomplete="off" placeholder="Nome da perícia"')+
      '<label class="check skill-filter"><input type="checkbox" data-skill-favorites '+(sheetView.favorites?'checked':'')+'> Favoritas primeiro</label>'+
      '<div id="sheet-skills">'+sheetSkillList(character,state)+'</div>'
    : sheetAbilitiesMarkup(character);
  return '<section class="sheet-panel" data-sheet-tone="'+(isSkills?'skills':'abilities')+'"><div class="sheet-panel-header"><div class="sheet-tabs" aria-label="Competências">'+tabs+'</div></div>'+
    '<div class="sheet-body">'+(sheetView.editing?'<div>'+button(isSkills?'Nova perícia':'Nova habilidade',isSkills?'sheetSkill':'sheetAbility','small','plus')+'</div>':'')+body+'</div></section>';
}

function masteryMarkup(character) {
  const masteries=character.masteries||[];
  if(!masteries.length)return '';
  return '<section class="sheet-section sheet-masteries"><h3>Maestria da sessão</h3>'+masteries.map(m=>'<div class="sheet-mastery-card"><div><strong>'+esc(m.name)+'</strong><span>'+esc(m.die)+' · '+(m.remaining>0?'Disponível':'Usada nesta sessão')+'</span></div>'+(sheetView.editing?button('Configurar','sheetMasteryEdit','small','',m.id):'')+'</div>').join('')+
    '<label>Adicionar maestria ao próximo teste<select data-sheet-mastery><option value="">Sem maestria</option>'+masteries.map(m=>'<option value="'+esc(m.id)+'" '+(sheetView.mastery===m.id?'selected ':'')+(m.remaining<1?'disabled':'')+'>'+esc(m.name)+' + '+esc(m.die)+(m.remaining<1?' · usada':'')+'</option>').join('')+'</select></label><p class="muted">Um uso por sessão, no atributo vinculado. Selecione a maestria antes de rolar.</p>'+
    (current.master?button('Renovar para nova sessão','sheetMasteryRefresh','small','',character.id):'')+'</section>';
}

function sheetSavedRolls(character,state){
  return '<section class="sheet-section sheet-saved-rolls"><div class="sheet-section-heading"><h3>Rolagens personalizadas</h3>'+button('Nova rolagem','sheetRollEdit','small','plus')+'</div>'+
    ((character.rollButtons||[]).length?'<div class="saved-roll-grid">'+character.rollButtons.map(roll=>'<div class="saved-roll-card"><button type="button" class="saved-roll" data-act="sheetSavedRoll" data-id="'+esc(roll.id)+'"><strong>'+esc(roll.name)+'</strong><small>'+esc(displaySheetFormula(sheetSavedRollFormula(character,roll),state,character))+'</small></button>'+(sheetView.editing?button('Configurar rolagem','sheetRollEdit','small','',roll.id):'')+'</div>').join('')+'</div>':'<p class="muted">Crie atalhos como Ataque: 2d6 + Força ou um dado de faces personalizadas, como 1d7.</p>')+'</section>';
}

function sheetDice(character,state) {
  const dice = diceFaces.map(faces=>'<button type="button" data-act="sheetDie" data-id="'+faces+'" class="die-button die-'+faces+'" aria-label="Adicionar d'+faces+'"><span>'+faces+'</span></button>').join('');
  const history = state.rolls.filter(roll=>roll.characterId===character.id||!roll.characterId&&roll.actor===character.name).slice(0,5);
  const saved=sheetSavedRolls(character,state);
  return '<section class="sheet-panel" data-sheet-tone="dice"><div class="sheet-panel-header"><h2>Dados</h2></div><div class="sheet-body">'+
    '<p class="muted sheet-roll-visibility">'+(current.master?'Rolagens visíveis somente para você, mestre.':'Rolagens compartilhadas com a mesa.')+'</p>'+masteryMarkup(character)+saved+'<div class="die-grid">'+dice+'</div><form class="stack" data-form="sheetRoll">'+
    select('mode','Modo do teste de d20',{normal:'Normal',advantage:'Vantagem (melhor de 2d20)',disadvantage:'Desvantagem (pior de 2d20)'},sheetView.rollMode||'normal').replace('<select ','<select data-sheet-roll-mode ')+input('formula','Expressão',sheetView.formula,'text','data-sheet-formula required maxlength="'+rollFormulaLimit+'" placeholder="Ex. 2d6 + Força"')+
    '<div class="sheet-dice-settings">'+input('bonus','Bônus',sheetView.bonus,'number','data-sheet-bonus step="1" min="-9999" max="9999" placeholder="0"')+
    sheetControl('Remover último dado','sheetUndo','','')+'↶</button>'+
    sheetControl('Limpar rolagem','sheetClear','','')+'×</button></div>'+
    '<button class="btn primary sheet-roll-button" type="submit">'+svg('dice')+'Rolar dados</button></form>'+
    (history.length?'<section class="sheet-section"><h3>Últimas rolagens</h3><ul class="roll-list">'+history.map(roll=>
      '<li><div><b>'+esc(roll.label||roll.expression||roll.formula)+'</b><div class="muted">'+(roll.expression?esc(roll.formula)+' · ':'')+rollDetails(roll)+'</div></div><strong>'+roll.total+'</strong></li>').join('')+'</ul></section>':'')+'</div></section>';
}

function sheetFreeDice(character){
  const dice=diceFaces.map(faces=>'<button type="button" data-act="sheetDie" data-id="'+faces+'" class="die-button die-'+faces+'" aria-label="Adicionar d'+faces+'"><span>'+faces+'</span></button>').join('');
  return '<div class="die-grid">'+dice+'</div><form class="stack" data-form="sheetRoll">'+
    select('mode','Modo do teste de d20',{normal:'Normal',advantage:'Vantagem (melhor de 2d20)',disadvantage:'Desvantagem (pior de 2d20)'},sheetView.rollMode||'normal').replace('<select ','<select data-sheet-roll-mode ')+input('formula','Expressão',sheetView.formula,'text','data-sheet-formula required maxlength="'+rollFormulaLimit+'" placeholder="Ex. 2d6 + Força"')+
    '<div class="sheet-dice-settings">'+input('bonus','Bônus',sheetView.bonus,'number','data-sheet-bonus step="1" min="-9999" max="9999" placeholder="0"')+
    sheetControl('Remover último dado','sheetUndo','','')+'↶</button>'+
    sheetControl('Limpar rolagem','sheetClear','','')+'×</button></div>'+
    '<button class="btn primary sheet-roll-button" type="submit">'+svg('dice')+'Rolar dados</button></form>';
}
function sheetModuleContent(id,character,state){
  if(id.startsWith('field:')){const field=sheetFields(state,character).find(field=>field.id===id.slice(6));return field?sheetFieldValue(character,field):'';}
  if(id==='identity')return '<div class="mosaic-identity">'+inlineIdentity(character)+(character.dnd?button('Regras e magias','dndReference','small','',character.id)+button('Descansar','dndRest','small','',character.id):'')+'</div>';
  if(id==='portrait')return '<div class="mosaic-portrait">'+sheetPortraitMarkup(character)+(sheetView.editing?button(character.portrait?'Trocar retrato':'Enviar retrato','sheetPortrait','small'):'')+'</div>';
  if(id==='skills')return (sheetView.editing?button('Nova perícia','sheetSkill','small','plus'):'')+input('sheet-search','Buscar perícia',sheetView.query,'search','data-skill-search autocomplete="off" placeholder="Nome da perícia"')+'<label class="check skill-filter"><input type="checkbox" data-skill-favorites '+(sheetView.favorites?'checked':'')+'> Favoritas primeiro</label><div id="sheet-skills">'+sheetSkillList(character,state)+'</div>';
  if(id==='abilities')return (sheetView.editing?button('Nova habilidade','sheetAbility','small','plus'):'')+sheetAbilitiesMarkup(character);
  if(id==='rolls')return sheetSavedRolls(character,state);
  if(id==='dice')return '<p class="muted sheet-roll-visibility">'+(current.master?'Rolagens privadas do mestre.':'Rolagens compartilhadas com a mesa.')+'</p>'+sheetFreeDice(character);
  if(id==='masteries')return masteryMarkup(character);
  if(id==='history'){const history=state.rolls.filter(roll=>roll.characterId===character.id||!roll.characterId&&roll.actor===character.name).slice(0,10);return history.length?'<ul class="roll-list">'+history.map(roll=>'<li><div><b>'+esc(roll.label||roll.expression||roll.formula)+'</b><div class="muted">'+rollDetails(roll)+'</div></div><strong>'+roll.total+'</strong></li>').join('')+'</ul>':'<p class="muted">Nenhuma rolagem deste personagem.</p>';}
  return '';
}

function sheets(state) {
  const character=currentSheet();
  if (!character) return head('Fichas universais','Crie um personagem ou abra sua ficha para jogar.',
    button('Modelos salvos','sheetTemplates','small')+button('Criar personagem D&D','dndCreate','small')+(current.master?button('Editar modelo','schema')+(state.characters.some(c=>c.masteries?.length)?button('Nova sessão: renovar maestrias','sheetMasteryRefresh'):''):'')+button(current.master?'Nova ficha':'Minha ficha','character','primary','plus'))+characterCards(state.characters);
  sheetMosaic.sync(state,character,current.id+'/'+character.id+'/'+Boolean(current.master));
  const custom=sheetMosaic.editing||sheetView.layoutView==='custom';
  const viewButton=(id,label)=>'<button type="button" class="btn small '+(custom===(id==='custom')?'primary':'')+'" data-act="sheetReadingView" data-id="'+id+'" aria-pressed="'+(custom===(id==='custom'))+'" '+(sheetMosaic.editing?'disabled':'')+'>'+label+'</button>';
  const toolbar='<div class="sheet-toolbar"><div>'+button('‹ Todas as fichas','sheetBack','ghost small')+(!character.dnd?button('Salvar como modelo','sheetTemplateSave','small','',character.id):'')+button('Modelos salvos','sheetTemplates','small')+button('Histórico','sheetHistory','small','',character.id)+'<p class="muted sheet-campaign">'+esc(state.name)+'</p></div><div class="actions">'+viewButton('custom','Personalizada')+viewButton('standard','Padronizada')+(sheetMosaic.editing?'':button('Cores e recursos','sheetColors','small'))+(sheetMosaic.editing?'<button type="button" class="btn small" disabled>Organizando</button>':button('Organizar','sheetLayoutBegin','small'))+(current.master?button(character.characterType==='npc'?'Tipo: NPC':'Tipo: Jogador','characterType','small')+button(character.hidden?'Mostrar aos jogadores':'Ocultar dos jogadores','characterVisibility','small'):'')+'</div></div>';
  const editing=custom&&sheetView.editing?'<div class="actions mosaic-data-actions">'+button('Personalizar campos','sheetFields','small')+button('Adicionar atributo','sheetFields','small','plus','number')+button('Adicionar recurso','sheetFields','small','plus','counter')+button(character.portrait?'Trocar retrato':'Enviar retrato','sheetPortrait','small')+'</div>':'';
  return toolbar+(custom?'<p class="sheet-view-note">Visualização personalizada · Clique nos valores para editar. Enter salva; Escape cancela. Para textos longos, use Ctrl+Enter ou saia do campo.</p>'+editing+(sheetMosaic.editing?renderSheetLayoutEditor(state,character,sheetMosaic.appearance,sheetMosaic.canUndo):'')+renderSheetMosaic(state,character,sheetMosaic.appearance,{editing:sheetMosaic.editing,renderModule:id=>sheetModuleContent(id,character,state)}):'<p class="sheet-view-note">Visualização padronizada · Clique em um valor para editar. Enter salva; Escape cancela. Recursos usam atual/máximo, como 8/10.</p><div class="sheet-stage theme-'+esc(character.color)+'" style="'+sheetThemeStyle(state,character)+'" aria-label="Ficha de '+esc(character.name)+'">'+sheetGeneral(character,state)+sheetCompetencies(character,state)+sheetDice(character,state)+'</div>')+(character.access==='full'||current.master?sheetInventory(character,currentView(),gmUI()):'');
}

const screens = {
  home,
  sheets,
  table, shield, library, inventory:()=>renderInventory(currentView(),gmUI(),inventoryView), journal:()=>renderJournal(currentView(),gmUI(),journalView), audio:audioScreen
};

function campaignList() {
  const list=Object.values(read('forja.campaigns')||{});
  return list.length?'<div class="stack">'+list.map(item=>'<div class="campaign-list-row">'+button(item.name+' · '+(item.master?'Mestre':'Jogador'),'switch','','',item.id)+button(item.master?'Apagar':'Remover da lista',item.master?'campaignDelete':'campaignForget','small danger','',item.id)+'</div>').join('')+'</div>':'<p class="empty">Você ainda não tem campanhas salvas neste navegador.</p>';
}

function forgetCampaign(id) {
  const list=read('forja.campaigns')||{};delete list[id];accessStorage.write('forja.campaigns',list);
  const members=read('forja.memberKeys')||{};delete members[id];accessStorage.write('forja.memberKeys',members);
  if(read('forja.active')===id)accessStorage.remove('forja.active');
  accessStorage.write('forja.forgotten',[...new Set([...(read('forja.forgotten')||[]),id])]);
  if(reconnectingAccess?.id===id)reconnectingAccess=null;
}

function renderLobby() {
  inlineSheet.cancel();narrationDisplay.sync(lobby);
  tableLive.disconnect();
  sheetMosaic.dispose();
  tabletop.dispose();musicLibrary.dispose();soundboardLibrary.dispose();sheetId='';
  $('#campaign-name').textContent='Escolher campanha';$('#breadcrumb').textContent='Campanhas';$('#profile').textContent='Sua mesa de RPG';
  $('#navigation').innerHTML='';$('#header-actions').innerHTML=button('Nova campanha','create','primary','plus');
  main.innerHTML=head('Suas campanhas','Crie uma campanha ou abra uma das suas mesas.',button('Importar backup','campaignImport')+button('Recuperar acesso','campaignRecover')+button('Nova campanha','create','primary','plus'))+campaignList();
  audioPlayer.sync(lobby);musicDock.sync(lobby);soundboardDock.sync(lobby);audioPopover.sync(lobby);diceDisplay.sync(lobby);narrationDisplay.sync(lobby);rollIdentity='';latestRollRevision=-1;latestRollVersion='';applyPortraits();
}

function render() {
  if(inlineSheet.editing)return;
  if(!credentials) {renderLobby();return;}
  if (!current.master && page==='shield') page='home';
  const {state} = current;
  if(journalIdentity!==current.id){journalIdentity=current.id;inventoryView={scope:'',query:''};journalView={query:'',kind:'all',collapsed:[]};}
  if (sheetId&&!current.master&&!state.characters.some(character=>character.id===sheetId&&character.access==='full')) sheetId='';
  $('#campaign-name').textContent = state.name;
  $('#profile').innerHTML = current.master ? 'Mestre da mesa<small>'+'Campanha ativa'+'</small>' : esc(state.characters.find(character=>character.id===current.characterId)?.name||'Jogador')+'<small>'+(current.needsCharacter?'Escolha seu personagem':'Personagem vinculado')+'</small>';
  $('#breadcrumb').textContent = pages[page][0];
  $('#navigation').innerHTML = Object.entries(pages).filter(([key])=>key!=='shield'||current.master).map(([key,[label,icon]])=>
    '<button class="nav-btn" data-act="nav" data-id="'+key+'" '+(current.needsCharacter?'disabled ':'')+(key===page?'aria-current="page"':'')+'>'+svg(icon)+'<span class="nav-text">'+label+'</span><span class="nav-mobile-text">'+({home:'Início',sheets:'Fichas',table:'Mesa',shield:'Mestre',library:'Livros',inventory:'Itens',journal:'Diário',audio:'Áudio'}[key])+'</span></button>'
  ).join('');
  $('#header-actions').innerHTML = (current.master?button('Backup e acesso','campaignAccess','small')+button('Mensagem privada','narrationCompose','small')+button('Convidar jogadores','invite','','invite'):button('Meu acesso','campaignAccess','small'))+button('Nova campanha','create','primary','plus');
  const previousResources=resourceAnimations.capture(main);
  tabletop.dispose();musicLibrary.dispose();soundboardLibrary.dispose();sheetMosaic.dispose();
  main.innerHTML = current.needsCharacter?chooseCharacter(state):screens[page](state);
  resourceAnimations.restore(main,previousResources);
  scenePanelSignature=JSON.stringify([current.state.sceneLibrary,current.state.sceneId,sceneUI]);
  if(page==='sheets'&&currentSheet())sheetMosaic.mount(main);
  if (page==='table'&&!current.needsCharacter) tabletop.mount(main,currentView());
  if (page==='audio'&&!current.needsCharacter){musicLibrary.mount(main,currentView());soundboardLibrary.mount(main);}
  audioPlayer.setView(page==='audio'&&!current.needsCharacter);
  audioPlayer.sync(currentView());
  musicDock.sync(currentView());soundboardDock.sync(currentView());audioPopover.sync(currentView());
  observeRolls(currentView());
  applyPortraits();
  syncTableConnection();
}

function observeRolls(row) {
  if(row.id===current.id)narrationDisplay.sync(row);
  const identity=(row.id||'')+'/'+Boolean(row.master);
  if(identity!==rollIdentity){rollIdentity=identity;latestRollRevision=-1;latestRollVersion='';}
  if(row.id!==current.id||row.rev<current.rev||row.rev<latestRollRevision)return;
  if(row.rollVersion)latestRollVersion=row.rollVersion;
  if(!Array.isArray(row.state?.rolls))return;
  latestRollRevision=row.rev;
  current.state.rolls=row.state.rolls;
  diceDisplay.sync(row);
  tabletop.syncRolls(row);
}

function applyPortraits(scope=main) {
  const access=credentials;
  const identity=access?access.id+'/'+access.key:'';
  const allowed=new Set([...(current.state.inventory||[]).flatMap(item=>item.portrait?.id?[item.portrait.id]:[]),...current.state.tokens.flatMap(token=>token.loot?.item?.portrait?.id?[token.loot.item.portrait.id]:[]),...current.state.tokens.flatMap(token=>token.portrait?[token.portrait.id]:[]),...current.state.characters.flatMap(character=>character.portrait?[character.portrait.id]:[]),...((current.master?current.state.sceneLibrary?.scenes||[]:[]).flatMap(scene=>scene.map?[scene.map.id]:[])),...(current.state.map?[current.state.map.id]:[])]);
  for(const [id,entry] of portraitCache) {
    if(identity!==portraitIdentity||!allowed.has(id)) {
      portraitCache.delete(id);
      entry.then(url=>URL.revokeObjectURL(url)).catch(()=>{});
    }
  }
  portraitIdentity=identity;
  if(!access)return;
  for(const picture of scope.querySelectorAll('[data-portrait]')) {
    const id=picture.dataset.portrait||picture.dataset.sceneMap;
    if(!allowed.has(id))continue;
    let pending=portraitCache.get(id);
    if(!pending) {
      pending=request('/'+access.id+'/asset/'+id,{},access).then(response=>response.blob()).then(blob=>URL.createObjectURL(blob));
      portraitCache.set(id,pending);
    }
    pending.then(url=>{
      if(portraitCache.get(id)!==pending||portraitIdentity!==identity||!scope.contains(picture))return;
      picture.onload=()=>{picture.hidden=false;};
      picture.onerror=()=>{picture.hidden=true;};
      picture.src=url;
    }).catch(()=>{if(portraitCache.get(id)===pending)portraitCache.delete(id);});
  }
}

function modal(title,content,form) {
  delete dialog.dataset.lootReward;
  dialog.style.removeProperty('--item-accent');
  delete dialog.dataset.itemView;
  $('#dialog-notice').textContent = '';
  $('#dialog-content').innerHTML = '<div class="dialog-head"><h2 id="dialog-title">'+title+'</h2><button type="button" class="btn small ghost" data-act="close" aria-label="Fechar">✕</button></div>'+
    (form?'<form class="stack" data-form="'+form+'">'+content+'</form>':content);
  if (!dialog.open) dialog.showModal();
  applyPortraits(dialog);
}

const select = (name,label,options,value) => '<label>'+label+'<select name="'+name+'">'+Object.entries(options).map(([key,text])=>
  '<option value="'+esc(key)+'" '+(value===key?'selected':'')+'>'+esc(text)+'</option>').join('')+'</select></label>';
const colorNames = characterColorNames;
const fieldTypes = {text:'Texto curto',number:'Número',counter:'Contador atual/máximo',long:'Texto longo',check:'Caixa de seleção'};

function fieldInput(field,value) {
  const id = 'value-'+esc(field.id);
  const label = esc(field.label);
  if (field.type==='long') return area(id,label,value,'maxlength="4000"');
  if (field.type==='check') return '<label class="check"><input name="'+id+'" type="checkbox" value="true" '+(value==='true'?'checked':'')+'>'+label+'</label>';
  if (field.type==='counter') {
    const [now='',max=''] = value.split('/');
    return '<fieldset><legend>'+label+'</legend><div class="form-grid">'+input(id+'-now','Atual',now,'number','step="any"')+input(id+'-max','Máximo',max,'number','step="any"')+'</div></fieldset>';
  }
  return input(id,label,value,field.type==='number'?'number':'text',field.type==='number'?'step="any"':'maxlength="4000"');
}

function openDndCreation(draft={}) {
  modal('Criar personagem D&D 2024',(current.master?select('characterType','Tipo de ficha',{player:'Personagem de jogador',npc:'NPC · personagem do mestre'},draft.characterType||'player'):'')+dndCreation({input,select,esc,button},draft),'dndCreate');
  const form=$('[data-form=dndCreate]',dialog);
  if(form){updateDndCreation(form,{esc},true,true);dndStep(0);}
}

function updateDndReference() {
  const root=$('[data-dnd-results]',dialog);if(!root)return;
  root.innerHTML=renderDndResults(currentView(),{esc,button},$('[name=dndQuery]',dialog)?.value||'',$('[name=dndCategory]',dialog)?.value||'',$('[name=dndTarget]',dialog)?.value||'',Boolean($('[name=dndAllSpells]',dialog)?.checked));
}

function dndStep(direction) {
  const form=$('[data-form=dndCreate]',dialog);if(!form)return;
  const step=Number(form.dataset.step)||0;
  const currentStep=$('[data-dnd-step="'+step+'"]',form);
  if(direction>0)for(const input of currentStep.querySelectorAll('input,select'))if(!input.checkValidity()){input.reportValidity();return;}
  const next=Math.max(0,Math.min(3,step+direction));form.dataset.step=next;
  form.querySelectorAll('[data-dnd-step]').forEach(section=>{section.hidden=Number(section.dataset.dndStep)!==next;});
  $('[data-act=dndBack]',form).hidden=next===0;$('[data-act=dndNext]',form).hidden=next===3;$('[data-dnd-finish]',form).hidden=next!==3;
  $('[data-dnd-step-label]',form).textContent=(next+1)+' · '+['Identidade e origem','Atributos','Proficiências e escolhas','Revisão'][next];
  updateDndCreation(form,{esc});
}

function editCharacter(id,presetId='',draft={}) {
  const preset=!id?sheetPreset(presetId):null;
  const character = current.state.characters.find(item=>item.id===id) || {...draft,...(preset?{layout:preset.fields}:{})};
  const groups = Map.groupBy(sheetFields(current.state,character),field=>field.group);
  modal(id?'Ficha de '+esc(character.name):'Nova ficha',
    '<input type="hidden" name="id" value="'+esc(id)+'">'+(!id?select('preset','Modelo da ficha',{'':'Modelo da campanha',...Object.fromEntries(sheetPresets.map(p=>[p.id,p.name])),'dnd-2024':'D&D 2024 · criação guiada'},presetId).replace('<select ','<select data-character-preset ')+(preset?'<p class="muted">'+esc(preset.description)+'</p>':''):'')+'<div class="form-grid">'+input('name','Nome',character.name,'text','required maxlength="80"')+
    input('concept','Conceito ou classe',character.concept,'text','maxlength="80"')+'</div>'+(current.master?select('characterType','Tipo de ficha',{player:'Personagem de jogador',npc:'NPC · personagem do mestre'},character.characterType||'player'):'')+select('color','Cor da ficha e dos dados',colorNames,character.color)+'<p class="muted">24 cores disponíveis. Um destaque personalizado em Organizar → Cores e estilo tem prioridade na cor dos dados.</p>'+
    [...groups].map(([group,fields])=>'<fieldset><legend>'+esc(group)+'</legend>'+fields.map(field=>{const computed=character.dnd&&(['dd-class','dd-species','dd-background'].includes(field.id)||dndDerived(character,field.id)!==null);return fieldInput(field,String(sheetValue(character,field))).replace('<input ',computed?'<input readonly ':'<input ');}).join('')+'</fieldset>').join('')+
    (current.master?'<label class="check"><input type="checkbox" name="hidden" '+(character.hidden?'checked':'')+'> Ocultar completamente esta ficha dos jogadores</label>':'')+
    submit('Salvar ficha')+(id&&current.master?'<div>'+button('Remover ficha','characterDelete','danger small','',id)+'</div>':''),'character');
}

function rollReferenceName(id) {
  const fields=sheetFields(current.state,currentSheet());
  const field=fields.find(item=>item.id===id);
  if(!field)return id;
  return !/[{}|]/.test(field.label)&&fields.filter(item=>normalizeSearch(item.label)===normalizeSearch(field.label)).length===1?field.label:id;
}

function editSavedRoll(id) {
  const character=currentSheet();
  const entry=(character.rollButtons||[]).find(item=>item.id===id);
  const fields=sheetFields(current.state,character).filter(field=>['number','counter'].includes(field.type));
  modal(entry?'Editar rolagem':'Nova rolagem personalizada',
    '<input type="hidden" name="entry" value="'+esc(entry?.id||'')+'">'+input('name','Nome',entry?.name||'','text','required maxlength="80" placeholder="Ex.: Ataque, Cura, Sorte"')+
    input('formula','Expressão',entry?.formula.replace(/@\{([^{}]+)\}/g,(_,reference)=>{const [id,mode]=reference.split('|');return '@{'+rollReferenceName(id)+(mode?'|'+mode:'')+'}';})||'2d6','text','required data-saved-formula maxlength="'+rollFormulaLimit+'" placeholder="2d6 + Força"')+
    (fields.length?'<div class="roll-reference-builder">'+select('reference','Atributo ou recurso',Object.fromEntries(fields.map(field=>[field.id,field.label+' ('+sheetValue(character,field)+')'])),fields[0].id)+button('Inserir na expressão','rollInsertReference','small')+'</div>':'<p class="muted">Adicione atributos para vinculá-los às rolagens.</p>')+
    '<p class="muted">Use somas e subtrações de dados e atributos, por exemplo 2d6 + Força ou 1d20 + Agilidade - 2. Os valores são consultados novamente a cada rolagem.</p><p class="formula-preview" data-saved-formula-preview role="status" aria-live="polite"></p>'+
    submit('Salvar rolagem')+(entry?button('Remover rolagem','sheetEntryDelete','small danger','','rollButtons/'+entry.id):''),'savedRoll');
  updateSavedRollPreview();
}

function updateSavedRollPreview() {
  const preview=$('[data-saved-formula-preview]',dialog);
  const field=$('[data-saved-formula]',dialog);
  if(!preview||!field||!currentSheet())return;
  try {
    const resolved=resolveSheetFormula(field.value,current.state,currentSheet());
    preview.textContent='Expressão atual: '+resolved.formula+(resolved.bindings.length?' · '+resolved.bindings.map(item=>item.label+' = '+item.value).join(', '):'');
    preview.classList.toggle('invalid',false);
  } catch(error) {preview.textContent=error.message;preview.classList.toggle('invalid',true);}
}

function newField(prefix='') {
  const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  return {id:prefix+id,group:'Geral',label:'',type:'text',initial:''};
}

function schemaRow(field=newField()) {
  return '<div class="field-row" data-field="'+esc(field.id)+'">'+input('group','Seção',field.group,'text','maxlength="80"')+
    input('label','Nome do campo',field.label,'text','required maxlength="80"')+select('type','Tipo',fieldTypes,field.type)+
    input('initial','Valor inicial',field.initial,'text','maxlength="2000" placeholder="Ex.: 2 ou 10/10"')+'<div class="field-row-actions">'+button('↑','fieldMove','small','','up')+button('↓','fieldMove','small','','down')+button('Remover','fieldDelete','small danger')+'</div>'+'</div>';
}

function initiativeRow(entry={name:'',value:''}) {
  return '<div class="form-grid" data-entry>'+input('name','Participante',entry.name,'text','required maxlength="80"')+
    input('value','Iniciativa',entry.value,'number','required min="-999" max="999"')+button('Remover','initiativeDelete','small danger')+'</div>';
}

function createDialog() {
  modal('Nova campanha',input('name','Nome da campanha','','text','required maxlength="100"')+
    select('ruleset','Sistema',{'free':'Sistema livre','dnd-2024':'D&D 2024 · SRD 5.2.1'},'free')+submit('Criar campanha'),'create');
}

function editSheetEntry(category,id) {
  const character=currentSheet();
  const skill=category==='skills';
  const entry=(character[category]||[]).find(item=>item.id===id);
  const fields=sheetFields(current.state,character).filter(field=>field.type==='number');
  const attributes={'':'Base manual',...Object.fromEntries(fields.map(field=>[field.id,field.label]))};
  const label=skill?'perícia':'habilidade';
  const number=(name,label)=>input(name,label,entry?.[name]??0,'number','min="-999" max="999" step="1"');
  const details=skill
    ? select('attribute','Atributo relacionado',attributes,entry?.attribute||'')+(character.dnd?select('rank','Proficiência',{0:'Sem proficiência',1:'Proficiente',2:'Especialização'},String(entry?.rank||0)):'')+
      '<p class="muted">Ao selecionar um atributo, o valor dele será usado como base.</p>'+
      '<div class="form-grid">'+number('base','Base manual')+number('bonus','Bônus')+number('other','Outros')+'</div>'+
      '<label class="check"><input type="checkbox" name="favorite" value="true" '+(entry?.favorite?'checked':'')+'> Favorita</label>'
    : area('description','Descrição',entry?.description,'maxlength="4000"');
  modal((entry?'Editar ':'Nova ')+label,'<input type="hidden" name="category" value="'+category+'"><input type="hidden" name="entry" value="'+esc(entry?.id)+'">'+
    input('name','Nome',entry?.name,'text','required maxlength="80"')+details+submit('Salvar')+
    (entry?'<div>'+button('Remover '+label,'sheetEntryDelete','small danger','',category+'/'+entry.id)+'</div>':''),'sheetEntry');
}

function readFields(form) {
  return [...form.querySelectorAll('[data-field]')].map(row=>{
    const field = name=>$('[name='+name+']',row).value;
    return {id:row.dataset.field,group:field('group'),label:field('label'),type:field('type'),initial:field('initial')};
  });
}

function sheetActionOptions(formula,character){
  const resolved=resolveSheetFormula(formula,current.state,character),mastery=character.masteries?.find(m=>m.id===sheetView.mastery&&m.remaining>0&&resolved.bindings.some(binding=>binding.id===m.attributeId));
  return {...(mastery?{masteryId:mastery.id}:{}),...(/^1?d20(?:[+\-]|$)/i.test(resolved.formula)&&sheetView.rollMode&&sheetView.rollMode!=='normal'?{mode:sheetView.rollMode}:{})};
}

function setSheetFormula(formula,focus=false) {
  sheetView.formula=formula;
  const field=$('[data-sheet-formula]',main);
  if (!field) return;
  field.value=formula;
  if (focus) field.focus();
}

function tableTokenForm(token={}) {
  const characters=Object.fromEntries(current.state.characters.map(character=>[character.id,character.name+' · '+(character.characterType==='npc'?'NPC':'Jogador')]));
  const hidden='<input type="hidden" name="id" value="'+esc(token.id)+'"><input type="hidden" name="sceneId" value="'+esc(current.state.sceneId)+'">';
  return hidden+select('characterId','Ficha vinculada',{'':'Token independente',...characters},token.characterId||'')+
    input('name','Nome no mapa',token.name,'text','maxlength="80" placeholder="Usar nome da ficha vinculada"')+
    renderTokenAppearance(token,current.state.characters)+
    select('size','Tamanho em células',{1:'1 × 1',2:'2 × 2',3:'3 × 3',4:'4 × 4'},String(token.size||1))+
    '<fieldset class="token-vision-settings"><legend>Campo de visão</legend><label class="check"><input type="checkbox" name="visionEnabled" '+(normalizeVision(token.vision).enabled?'checked':'')+'> Este token enxerga na escuridão</label><div class="form-grid">'+input('visionRange','Alcance ('+normalizeTable(current.state).grid.unit+')',normalizeVision(token.vision).range,'number','required min="0" max="10000" step="any"')+input('visionAngle','Abertura do campo (graus)',normalizeVision(token.vision).angle,'number','required min="1" max="360" step="any"')+input('rotation','Direção (0° norte, 90° leste)',token.rotation||0,'number','required min="0" max="359" step="1"')+'</div><p class="muted">Use 360° para visão circular ou 120° para um cone. A direção pode ser alterada na mesa sem mudar o alcance.</p></fieldset>'+
    input('statuses','Condições',token.statuses?.join(', '),'text','maxlength="148" placeholder="Ex. Ferido, Envenenado"')+
    '<p class="muted">Separe até seis condições por vírgulas.</p>'+
    '<label class="check"><input type="checkbox" name="locked" '+(token.locked?'checked':'')+'> Bloquear movimentação pelos jogadores</label>'+
    '<label class="check"><input type="checkbox" name="hidden" '+(token.hidden?'checked':'')+'> Ocultar dos jogadores</label>'+
    submit(token.id?'Salvar token':'Adicionar token')+
    (token.id?'<div>'+button('Remover token','tokenDelete','danger small','',token.id)+'</div>':'');
}

function sceneEditor(id=''){
  const lib=current.state.sceneLibrary,scene=lib.scenes.find(item=>item.id===id),sessions=Object.fromEntries(lib.sessions.map(item=>[item.id,item.name]));
  modal(scene?'Editar cena':'Nova cena',input('id','',id,'hidden')+input('expectedVersion','',lib.version,'hidden')+input('name','Nome da cena',scene?.name||'','text','required maxlength="100" placeholder="Ex. Vila · praça central"')+select('sessionId','Sessão',sessions,scene?.sessionId||(sceneUI.session!=='all'?sceneUI.session:lib.sessions[0].id))+area('notes','Anotações privadas do mestre',scene?.notes||'','maxlength="2000"')+'<p class="muted">Criar ou preparar uma cena não muda o mapa dos jogadores.</p>'+submit(scene?'Salvar cena':'Criar e preparar')+(scene?'<div class="actions">'+button('Apagar cena','sceneDelete','small danger','',scene.id)+'</div>':''),'sceneEditor');
}
function sessionEditor(id=''){
  const lib=current.state.sceneLibrary,session=lib.sessions.find(item=>item.id===id);
  modal(session?'Editar sessão':'Nova sessão',input('id','',id,'hidden')+input('expectedVersion','',lib.version,'hidden')+input('name','Nome da sessão',session?.name||'','text','required maxlength="100" placeholder="Ex. Sessão 2 · Ecos na floresta"')+input('date','Data (opcional)',session?.date||'','date')+area('notes','Anotações privadas',session?.notes||'','maxlength="2000"')+submit(session?'Salvar sessão':'Criar sessão')+(session?'<div>'+button('Apagar sessão','sessionDelete','small danger','',session.id)+'</div>':''),'sessionEditor');
}
async function viewScene(id){
  const version=++sceneSelectionVersion;
  const access=credentials;const row=await request('/'+access.id+'?scene='+encodeURIComponent(id),{},access).then(response=>response.json());
  if(credentials!==access||version!==sceneSelectionVersion)return;tabletop.dispose();sceneRevision=row.rev;gmSceneId=row.state.sceneId;setCurrent(row);render();
}

function combatRow(entry={}) {
  const tokenOptions={'':'Participante sem token',...Object.fromEntries(current.state.tokens.map(token=>[token.id,token.name]))};
  return '<fieldset data-combat-entry="'+esc(entry.id||newField().id)+'"><legend>Participante</legend>'+
    select('tokenId','Token no mapa',tokenOptions,entry.tokenId||'')+
    '<div class="form-grid">'+input('name','Nome',entry.name,'text','maxlength="80" placeholder="Usar nome do token"')+
    input('value','Iniciativa',entry.value??0,'number','required min="-999" max="999" step="1"')+'</div>'+
    '<div>'+button('Remover participante','tableCombatRemove','small danger')+'</div></fieldset>';
}

function editCombat() {
  const {combat}=normalizeTable(current.state);
  modal('Combate da mesa',input('sceneId','',current.state.sceneId,'hidden')+'<p class="muted">A ordem de combate é compartilhada com os jogadores. Participantes ligados a tokens ocultos ficam visíveis ao mestre.</p>'+
    '<div id="combat-rows" class="stack">'+combat.entries.map(combatRow).join('')+'</div>'+
    '<div class="actions">'+button('Adicionar participante','tableCombatAdd','small','plus')+
    button('Adicionar tokens da mesa','tableCombatTokens','small')+
    (current.state.initiative?.length?button('Importar iniciativa do escudo','tableCombatImport','small'):'')+'</div>'+
    submit('Salvar ordem de combate'),'tableCombat');
}

function tokenData(data) {
  const character=current.state.characters.find(character=>character.id===data.characterId);
  return {
    id:data.id,sceneId:data.sceneId,name:data.name.trim()||character?.name||'Token',
    color:data.color,icon:data.icon||'auto',size:Number(data.size),characterId:data.characterId,
    hidden:data.hidden==='on',locked:data.locked==='on',removePortrait:data.removePortrait==='on',rotation:Number(data.rotation??0),vision:{enabled:data.visionEnabled==='on',range:Number(data.visionRange??9),angle:Number(data.visionAngle??120)},
    statuses:data.statuses.split(',').map(status=>status.trim()).filter(Boolean)
  };
}

function musicSession(id) {
  return current.state.audio?.music?.sessions?.find(session=>session.id===id);
}

function editMusicSession(id) {
  const session=musicSession(id);
  if (id&&!session) return;
  modal(session?'Editar sessão':'Preparar sessão',
    '<input type="hidden" name="id" value="'+esc(id)+'">'+
    input('name','Nome da sessão',session?.name,'text','required maxlength="100" autocomplete="off"')+
    submit(session?'Salvar nome':'Criar sessão'),'musicSession');
}

function editMusicTrack(key) {
  const [sessionId,id]=key.split('/');
  const session=musicSession(sessionId);
  if (!session) return;
  const track=session.tracks.find(track=>track.id===id);
  if (id&&!track) return;
  modal(track?'Editar música':'Adicionar música',
    '<input type="hidden" name="sessionId" value="'+esc(sessionId)+'"><input type="hidden" name="id" value="'+esc(id)+'">'+
    input('url','Link do YouTube',track?'https://www.youtube.com/watch?v='+track.video:'','text','required maxlength="2000" autocomplete="off"')+
    input('title','Nome na sessão',track?.title,'text','required maxlength="100" autocomplete="off"')+
    input('tag','Etiqueta (opcional)',track?.tag,'text','maxlength="50" autocomplete="off"')+
    '<label class="check"><input type="checkbox" name="loop" '+(track?.loop?'checked':'')+'> Repetir esta música ao terminar</label>'+
    submit(track?'Salvar música':'Adicionar ao repertório'),'musicTrack');
}

function musicItemKey(key) {
  const [sessionId,id]=key.split('/');
  return {sessionId,id};
}

const sheetHistoryController=createSheetHistoryController({current:()=>current,character:()=>currentSheet(),modal,action,ui:gmUI});
const handlers = {
  ...sheetHistoryController.handlers,
  tableTokenMessage(id){
    if(!current.master)return;
    const token=current.state.tokens.find(token=>token.id===id);
    const character=current.state.characters.find(character=>character.id===token?.characterId&&character.claimed&&!character.hidden);
    if(!character)throw new Error('Este token precisa estar vinculado à ficha de um jogador.');
    handlers.narrationCompose(character.id);
  },
  narrationCompose(characterId){
    if(!current.master)return;
    const composer=narrationComposer(currentView(),gmUI(),read('forja.narrationStyle.'+current.id),characterId);
    modal('Mensagem privada do mestre',composer.content,composer.hasRecipients?'narration':undefined);
    updateNarrationComposer($('[data-form=narration]',dialog));
  },
  narrationPreview(){const form=$('[data-form=narration]',dialog);if(form){const data=narrationFormData(new FormData(form));narrationDisplay.preview({...data,title:data.title||'Você percebe algo…',body:data.body||'Um sussurro atravessa sua mente…'});}},
  lootPlace(id){if(current.master)modal('Colocar item na mesa',lootPlacement(currentView(),gmUI(),id),current.state.inventory?.some(item=>!item.characterId)?'lootPlace':undefined);},
  lootOpen(id){const token=current.state.tokens.find(t=>t.id===id&&t.kind==='item');if(token){modal('Coletar item',lootPreview(token,currentView(),gmUI()),'lootCollect');dialog.dataset.itemView='true';}},
  inventoryForSheet(id){inventoryView={scope:id,query:''};page='inventory';render();},
  itemOpen(id){const e=current.state.inventory?.find(e=>e.id===id);if(e){modal('Detalhes do item',itemDetails(e,currentView(),gmUI()));dialog.dataset.itemView='true';}},
  itemEdit(id){if(!current.master)return;const e=current.state.inventory?.find(e=>e.id===id);modal(e?'Editar item':'Preparar item',itemEditor(e,currentView(),gmUI()),'itemSave');},
  itemGrant(id){const e=current.state.inventory?.find(e=>e.id===id);if(e&&current.master)modal('Entregar item',itemGrantForm(e,currentView(),gmUI()),'itemGrant');},
  itemManage(id){const e=current.state.inventory?.find(e=>e.id===id);if(e)modal(esc(e.name),itemManageForm(e,gmUI()),'itemManage');},
  itemDelete(id){const e=current.state.inventory?.find(e=>e.id===id);if(e&&current.master)modal('Excluir item','<input type="hidden" name="id" value="'+esc(id)+'"><input type="hidden" name="version" value="'+e.version+'"><p>Excluir '+esc(e.name)+'? As outras cópias permanecem disponíveis.</p>'+submit('Excluir item'),'itemDelete');},
  journalEdit(id){const entry=current.state.journal?.find(e=>e.id===id);if(id&&(!entry||!current.master&&!entry.canEdit))return;modal(entry?'Editar documento':'Novo documento',journalEditor(entry,currentView(),gmUI()),'journal');},
  journalCollapse(id){journalView.collapsed=journalView.collapsed.includes(id)?journalView.collapsed.filter(x=>x!==id):[...journalView.collapsed,id];render();},
  async journalShow(id){const e=current.state.journal?.find(e=>e.id===id);if(e)await action('journalPublish',{id,version:e.version,audience:'all'});},
  async journalHide(id){const e=current.state.journal?.find(e=>e.id===id);if(e)await action('journalPublish',{id,version:e.version,audience:'private'});},
  async journalStatus(id){const e=current.state.journal?.find(e=>e.id===id);if(e)await action('journalStatus',{id,version:e.version,status:e.status==='completed'?'active':'completed'});},
  journalDelete(id){const e=current.state.journal?.find(e=>e.id===id);if(e)modal('Excluir documento','<input type="hidden" name="id" value="'+esc(id)+'"><input type="hidden" name="version" value="'+e.version+'"><p>Excluir permanentemente '+esc(e.title)+'?</p>'+submit('Excluir documento'),'journalDelete');},
  sheetTemplates(){modal('Modelos de fichas',sheetTemplateLibrary(currentView(),gmUI()));},
  sheetTemplateSave(id){const c=current.state.characters.find(c=>c.id===id);if(c&&!c.dnd)modal('Salvar estrutura como modelo',sheetTemplateSaveForm(c,gmUI()),'sheetTemplateSave');},
  sheetTemplateImport(){modal('Importar modelo','<p class="muted">Selecione um arquivo .forja.json exportado pela Forja. O modelo começa privado.</p><label>Arquivo JSON<input type="file" name="file" accept=".json,application/json" required></label>'+submit('Importar modelo'),'sheetTemplateImport');},
  sheetTemplateEdit(id){const item=current.state.sheetTemplates?.items.find(x=>x.id===id);if(item?.canEdit)modal('Editar modelo',sheetTemplateEditForm(item,gmUI()),'sheetTemplateEdit');},
  sheetTemplateApply(id){const item=current.state.sheetTemplates?.items.find(x=>x.id===id);if(item)modal('Aplicar modelo · confirmar substituição',sheetTemplateApplyForm(item,currentView(),gmUI()),'sheetTemplateApply');},
  sheetTemplateCreate(id){const item=current.state.sheetTemplates?.items.find(x=>x.id===id);if(!item)return;if(!current.master&&!current.needsCharacter&&current.characterId){toast('Você já tem uma ficha. Use “Aplicar a uma ficha” para trocar a estrutura.');return;}modal('Criar personagem · '+esc(item.name),'<input type="hidden" name="templateId" value="'+esc(id)+'">'+input('name','Nome do personagem','','text','required maxlength="80"')+input('concept','Conceito ou classe','','text','maxlength="160"')+select('color','Cor',colorNames,'violet')+submit('Criar personagem'),'sheetTemplateCreate');},
  sheetTemplateExport(id){const item=current.state.sheetTemplates?.items.find(x=>x.id===id);if(item)downloadSheetTemplate(item);},
  sheetTemplateDelete(id){const item=current.state.sheetTemplates?.items.find(x=>x.id===id);if(item?.canEdit)modal('Excluir modelo','<input type="hidden" name="id" value="'+esc(id)+'"><input type="hidden" name="expectedVersion" value="'+item.version+'"><p>Excluir '+esc(item.name)+'? Fichas já criadas continuam intactas.</p>'+submit('Excluir modelo'),'sheetTemplateDelete');},
  sheetReadingView(value){if(!['custom','standard'].includes(value)||sheetMosaic.editing)return;sheetView.layoutView=value;localStorage.setItem('forja.sheet.reading.'+(current.master?'master':'player'),JSON.stringify(value));render();},
  sheetLayoutBegin(){sheetView.layoutView='custom';sheetMosaic.begin();},
  sheetLayoutUndo(){sheetMosaic.undo();},
  async sheetLayoutDiscard(){const access=credentials;try{const row=await request('/'+access.id,{},access).then(response=>response.json());if(credentials===access&&row.rev>=current.rev)setCurrent(row);}catch(error){toast(error.message);}sheetMosaic.discard();},
  async sheetLayoutSave(){const payload=sheetMosaic.payload();const row=await action('sheetAppearance',payload);if(row){sheetMosaic.finish();sheetView.layoutView='custom';render();toast('Aparência salva. A visão padronizada continua disponível.');}},
  gmPartyFields(id){const character=current.state.characters.find(c=>c.id===id);if(character)modal('Resumo de '+esc(character.name),gmPartyFieldsEditor(character,currentView(),gmUI()),'gmPartyFields');},
  gmCardEdit(id){modal(id?'Editar cartão':'Novo cartão privado',gmCardEditor(gmCard(id),currentView(),gmUI()),'gmCard');},
  gmCardDelete(id){const card=gmCard(id);if(!card)return;modal('Remover este cartão?', '<p>'+esc(card.title)+'</p><input type="hidden" name="id" value="'+esc(id)+'"><input type="hidden" name="version" value="'+card.version+'">'+submit('Remover cartão'),'gmCardDelete');},
  gmCardPin(id){const card=gmCard(id);if(card)return action('gmCardPin',{id,pinned:!card.pinned});},
  gmCardCollapse(id){const card=gmCard(id);if(card)return action('gmCardCollapse',{id,collapsed:!card.collapsed});},
  gmCardMove(key){const [id,direction]=key.split('/'),card=gmCard(id);if(!card)return;const group=visibleGmCards(currentView(),gmView).filter(item=>Boolean(item.pinned)===Boolean(card.pinned)),step=direction==='up'?-1:1,target=group[group.indexOf(card)+step];if(target)return action('gmCardMove',{id,direction:step,targetId:target.id});},
  gmTableRoll(id){return action('gmTableRoll',{id});},
  gmCategory(id){if(!(id in gmCategories))return;gmView.category=id;render();},
  gmCombatNext(direction){return action('combatNext',{direction:Number(direction)});},
  gmResource(key){const [id,field,step]=key.split('/');return action('sheetCounter',{id,field,step:Number(step)});},
  gmCharacterRoll(key){const [characterId,rollId]=key.split('/'),character=current.state.characters.find(c=>c.id===characterId);if(character)return action('roll',{characterId,rollId,actor:character.name});},
  async gmReference(id){
    const card=gmCard(id);if(!card)return;
    if(card.targetKind==='character')return openSheet(card.targetId);
    if(card.targetKind==='book')return handlers.book(card.targetId,null,card.page);
    const entry=dndCatalog.find(entry=>entry.id===card.targetId);if(!entry)return toast('Referência indisponível.');
    modal(esc(entry.name),'<p class="gm-card-text">'+esc(entry.description)+'</p><p class="muted">Resumo adaptado do SRD 5.2.1 · página '+entry.page+'</p>'+button('Ver página no livro','gmRuleBook','primary','',entry.page));
  },
  gmRuleBook(page){const local=current.state.books.find(book=>book.source==='srd-5.2.1');if(local)return handlers.book(local.id,null,Number(page));modal('Livro oficial','<a class="btn primary" href="'+dndBook+'#page='+Number(page)+'" target="_blank" rel="noopener noreferrer">Abrir SRD na página '+Number(page)+' ↗</a>');},
  nav(key) {if(current.needsCharacter)return;page=key;if(key==='sheets') {if(!current.master&&current.characterId)return openSheet(current.characterId);sheetId='';}render();main.focus({preventScroll:true});window.scrollTo({top:0});},
  close() {dialog.close();},
  create:createDialog,
  campaigns() {modal('Suas campanhas',campaignList()+button('Importar backup','campaignImport')+button('Recuperar acesso','campaignRecover')+button('Nova campanha','create','primary','plus'));},
  campaignImport(){modal('Importar backup da campanha','<p>Selecione o arquivo <strong>.forja</strong> salvo no seu computador. A importação cria uma nova campanha, sem substituir nenhuma existente.</p><label>Backup da campanha<input type="file" name="file" accept=".forja,application/octet-stream" required></label><p class="muted">Inclui fichas, cenas, mapas, biblioteca e efeitos enviados. Limite: 100 MB por arquivo. Após restaurar, envie o novo convite e peça aos jogadores que escolham suas fichas novamente. A música começa parada.</p>'+submit('Restaurar como nova campanha'),'campaignImport');},
  async campaignBackup(){
    if(!current.master||!credentials)return;
    if(backupDownloading){toast('O backup já está sendo preparado.');return;}
    backupDownloading=true;
    try{
    const access=credentials,name=current.state.name;toast('Preparando o backup completo. Aguarde o download terminar.');
    const response=await request('/'+access.id+'/backup',{},access);
    let blob;try{blob=await response.blob();}catch{throw new Error('Não foi possível concluir o backup. Verifique os arquivos da campanha e tente novamente.');}
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(name.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,60)||'campanha')+'-'+new Date().toISOString().slice(0,10)+'.forja';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup pronto. Guarde o arquivo .forja no seu computador.');
    }finally{backupDownloading=false;}
  },
  campaignRecover(){modal('Recuperar acesso à campanha',area('code','Código de recuperação ou link de acesso','','required rows="3" autocomplete="off"')+'<p class="muted">Cole o código de “Meu acesso”, “Backup e acesso” ou o código do seu personagem fornecido pelo mestre. Isso reabre a campanha existente.</p>'+submit('Reabrir campanha'),'campaignRecover');},
  campaignAccess(){
    if(!credentials)return;
    modal('Backup e acesso à campanha',(current.master?'<h3>Backup completo</h3><p>Salve a campanha, fichas, cenas e arquivos no seu computador. O arquivo inclui as notas privadas do mestre.</p>'+button('Baixar backup completo','campaignBackup','primary')+button('Importar backup','campaignImport')+'<hr>':'')+'<h3>Código de acesso</h3>'+input('accessCode','Código privado de acesso',credentials.id+'.'+credentials.key,'text','readonly autocomplete="off"')+'<p class="muted">Guarde este código em um lugar privado. Ele permite recuperar seu acesso após trocar de endereço ou navegador. Quem possuir um código de mestre terá controle da campanha.</p>'+button('Baixar código','campaignAccessDownload','primary')+'<p class="muted">Este arquivo recupera o acesso; as campanhas e arquivos continuam no servidor e em seus backups.</p>');
  },
  campaignAccessDownload(){
    if(!credentials)return;
    const url=URL.createObjectURL(new Blob([credentials.id+'.'+credentials.key+'\n'],{type:'text/plain'}));
    const link=document.createElement('a');link.href=url;link.download='acesso-campanha.forja.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  async characterAccess(){
    if(!current.master||!sheetId)return;
    const result=await post(campaignPath()+'/player-access',{characterId:sheetId});
    modal('Recuperar acesso de '+esc(result.name),input('playerCode','Código privado do jogador',result.code,'text','readonly autocomplete="off"')+'<p class="muted">Entregue somente ao jogador de '+esc(result.name)+'. Ele deve abrir “Recuperar acesso” e colar o código. Isso mantém a ficha, o diário e as mensagens vinculados à identificação original.</p>'+button('Baixar código do jogador','characterAccessDownload','primary'));
  },
  characterAccessDownload(){
    const code=$('[name=playerCode]',dialog)?.value;if(!code)return;
    const url=URL.createObjectURL(new Blob([code+'\n'],{type:'text/plain'})),link=document.createElement('a');link.href=url;link.download='acesso-jogador.forja.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  async switch(id) {
    const access=read('forja.campaigns')?.[id];
    if(access) {page='home';await openCampaign({id,key:access.key});dialog.close();}
  },
  campaignForget(id) {forgetCampaign(id);if(credentials?.id===id){credentials=null;setCurrent(lobby);}dialog.close();render();},
  async campaignDelete(id) {
    const item=read('forja.campaigns')?.[id];if(!item?.master)return;
    const row=await request('/'+id,{},item).then(response=>response.json());
    item.name=row.state.name;
    modal('Apagar campanha','<input type="hidden" name="id" value="'+esc(id)+'"><p>Esta ação apaga '+esc(item.name)+', suas fichas, mapas, livros e áudios enviados. Os convites deixarão de funcionar.</p>'+input('name','Digite o nome da campanha para confirmar','','text','required autocomplete="off"')+submit('Apagar definitivamente'),'campaignDelete');
  },
  async invite() {
    await ensureCampaign();
    let origins=[location.origin].filter(value=>inviteOrigin(value));
    let message='';
    {
      try {
        const response=await fetch('/api/connection');
        if (response.ok) {
          const info=await response.json();
          const detected=Array.isArray(info.urls) ? info.urls.map(inviteOrigin).filter(Boolean) : [];
          const publicOrigin=inviteOrigin(info.publicUrl);
          origins=[...new Set([...(publicOrigin?[publicOrigin]:[]),...origins,...detected])];
          if (info.localOnly && !origins.length) message='O servidor está em modo local. Configure um endereço público para jogar pela internet ou reinicie com --lan para a rede local.';
        }
      } catch { /* The current origin remains available when hosted without this endpoint. */ }
      if (!origins.length && !message) message='Informe o endereço público da mesa ou o IP do PC com a porta para gerar o convite.';
    }
    const address=origins[0]||inviteOrigin(read('forja.inviteOrigin'))||'';
    const url=address ? address+'/#mesa='+current.id+'.'+current.invite : '';
    const originOptions=origins.length>1
      ? select('inviteOrigin','Endereços detectados',Object.fromEntries(origins.map(origin=>[origin,origin])),origins[0]) : '';
    modal('Convidar jogadores','<div class="stack"><p class="muted">Quem tiver este link pode entrar como jogador, escolher ou criar um personagem e consultar os materiais da campanha.</p>'+
      (message?'<p class="muted">'+esc(message)+'</p>':'')+originOptions+
      input('inviteAddress','Endereço de acesso à mesa',address,'url','placeholder="https://mesa.example.com" autocomplete="off"')+
      '<p class="muted">Para jogar pela internet, use o endereço público do seu servidor. Na rede local, use o IP do PC com a porta. Compartilhe o convite completo abaixo.</p>'+
      input('invite','Link de convite',url,'text','readonly')+
      '<div>'+button('Copiar convite','copy','primary','invite')+'</div></div>');
    $('[data-act=copy]',dialog).disabled=!url;
  },
  async copy() {
    const field = $('[name=invite]',dialog);
    if (!field.value) return toast('Informe um endereço de rede válido para o convite.');
    field.select();
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(field.value);
      toast('Convite copiado.');
    } else {
      toast('Link selecionado. Toque e segure para copiar, ou use Ctrl+C.');
    }
  },
  dndCreate() {openDndCreation();},
  dndUniversal() {editCharacter('');},
  dndNext() {dndStep(1);},
  dndBack() {dndStep(-1);},
  dndSuggested() {
    const form=$('[data-form=dndCreate]',dialog),cls=dndClasses.find(c=>c.id===$('[name=classId]',form).value);
    Object.keys(dndAbilities).forEach((id,index)=>{$('[name=score-'+id+']',form).value=cls.array[index];});
    updateDndCreation(form,{esc});
  },
  dndReference(id) {modal('D&D 2024 · regras e habilidades',dndCatalogShell(currentView(),{input,select,esc,button},id));updateDndReference();},
  async dndBookImport(id,node) {
    const access=credentials;node.disabled=true;
    try {const row=await request('/'+access.id+'/srd',{method:'POST'},access).then(response=>response.json());
      if(credentials===access&&row.rev>=current.rev){setCurrent(row);render();toast('Livro salvo na biblioteca e disponível para toda a mesa.');}
    } finally {node.disabled=false;}
  },
  dndBook() {modal('Livro de regras · SRD 5.2.1','<p>PDF oficial completo em inglês. Requer acesso à internet.</p><p><a class="btn primary" href="'+dndBook+'" target="_blank" rel="noopener noreferrer">Abrir ou baixar PDF oficial ↗</a></p><iframe class="pdf-frame" title="SRD 5.2.1" src="'+dndBook+'"></iframe><details><summary>Créditos e licença</summary><p>'+esc(dndAttribution)+'</p></details>');},
  async dndAdd(key) {const [id,entryId]=key.split('/');await action('dndAdd',{id,entryId,allowExtra:Boolean($('[name=dndAllSpells]',dialog)?.checked)});updateDndReference();},
  async dndCast(key) {const [id,entryId]=key.split('/');await action('dndCast',{id,entryId,mode:sheetView?.rollMode||'normal'});toast('Magia conjurada. Confira o resultado e o recurso na ficha.');},
  dndRest(id) {modal('Descanso de D&D','<input type="hidden" name="id" value="'+esc(id)+'">'+select('kind','Descanso',{short:'Curto · recursos configurados',long:'Longo · PV e recursos configurados'},'short')+'<p class="muted">O descanso curto não cura automaticamente: gaste Dados de Vida e role a cura. O longo restaura PV, Dados de Vida e os recursos configurados. Confirme as condições de descanso e outros efeitos com o mestre.</p>'+submit('Concluir descanso'),'dndRest');},
  settings() {
    const state = current.state;
    modal('Editar campanha',input('name','Nome',state.name,'text','required maxlength="100"')+input('system','Sistema',state.system,'text','maxlength="80"')+
      '<p class="muted">Organize os mapas em Cenas e sessões, na mesa virtual.</p>'+area('description','Descrição',state.description,'maxlength="800"')+submit('Salvar campanha'),'settings');
  },
  character(id) {if (id) openSheet(id);else if(current.master||current.needsCharacter) {if(current.needsCharacter&&!audioPlayer.enabled)audioPlayer.toggle();if(current.state.ruleset==='dnd-2024')openDndCreation();else editCharacter('');}else openSheet(current.characterId);},
  async characterClaim(id) {
    if (!audioPlayer.enabled||audioPlayer.blocked) audioPlayer.toggle();
    const row=await action('characterClaim',{id});
    if (row?.characterId) openSheet(row.characterId);
  },
  characterRelease() {confirmDelete('characterRelease',sheetId,'Liberar este personagem para outro jogador?');},
  characterVisibility() {return action('characterVisibility',{id:sheetId,hidden:!currentSheet().hidden});},
  sheetBack() {sheetId='';render();main.focus({preventScroll:true});},
  editSheet() {editCharacter(sheetId);},
  sheetTab(tab) {
    sheetView.tab=tab;render();
    $('[data-act=sheetTab][aria-pressed=true]',main)?.focus();
  },
  sheetFields(kind) {
    const fields=sheetFields(current.state,currentSheet());
    if(['number','counter'].includes(kind)) fields.push({...newField('local-'),type:kind,group:kind==='number'?'Atributos':'Recursos',label:kind==='number'?'Novo atributo':'Novo recurso',initial:kind==='number'?'0':'10/10'});
    modal('Personalizar ficha','<p class="muted">Adicione, remova, renomeie e ordene os atributos, recursos e seções desta ficha. Ao salvar, sua estrutura passa a ser independente do modelo da campanha. As demais fichas continuam como estão.</p>'+
      '<p class="muted">Número cria um atributo. Contador cria um recurso com valor atual/máximo, como 10/10. Campos numéricos podem ser usados nas rolagens salvas.</p>'+
      '<div class="stack" id="schema-rows">'+fields.map(schemaRow).join('')+'</div>'+
      '<div class="actions">'+button('Adicionar atributo','localFieldAdd','small','plus','number')+button('Adicionar recurso','localFieldAdd','small','plus','counter')+button('Outro campo','localFieldAdd','small','plus')+'</div>'+submit('Salvar estrutura da ficha'),'sheetFields');
  },
  localFieldAdd(kind) {
    const field=newField('local-');
    if(['number','counter'].includes(kind)) Object.assign(field,{type:kind,group:kind==='number'?'Atributos':'Recursos',label:kind==='number'?'Novo atributo':'Novo recurso',initial:kind==='number'?'0':'10/10'});
    $('#schema-rows').insertAdjacentHTML('beforeend',schemaRow(field));
  },
  sheetColors(fieldId) {
    const character=currentSheet();if(!character||sheetMosaic.editing)return;
    modal('Cores e recursos',sheetColorsForm(current.state,character),'sheetColors');
    if(fieldId)[...dialog.querySelectorAll('[data-resource-picker]')].find(node=>node.dataset.resourcePicker===fieldId)?.focus();
  },
  sheetResource(id) {
    const field=sheetFields(current.state,currentSheet()).find(item=>item.id===id&&item.type==='counter');
    if(!field)return;
    const [amount='',maximum='']=String(sheetValue(currentSheet(),field)).split('/');
    modal('Ajustar '+esc(field.label),'<input type="hidden" name="field" value="'+esc(id)+'"><div class="form-grid">'+input('current','Atual',amount,'number','required min="0" max="1000000" step="any"')+input('maximum','Máximo',maximum,'number','required min="0" max="1000000" step="any"')+'</div>'+submit('Salvar recurso'),'sheetResource');
  },
  sheetRollEdit(id) {editSavedRoll(id);},
  sheetSavedRoll(rollId) {const character=currentSheet(),roll=character.rollButtons?.find(r=>r.id===rollId);if(!roll)return;const formula=sheetSavedRollFormula(character,roll);return action('roll',{rollId,characterId:sheetId,actor:character.name,...sheetActionOptions(formula,character)});},
  sheetMasteryEdit(id) {
    const character=currentSheet(),mastery=character.masteries?.find(m=>m.id===id);
    if(!mastery)return;
    const fields=sheetFields(current.state,character).filter(f=>f.type==='number');
    modal('Configurar maestria','<input type="hidden" name="masteryId" value="'+esc(id)+'">'+input('name','Nome',mastery.name,'text','required maxlength="80"')+select('attributeId','Atributo vinculado',Object.fromEntries(fields.map(f=>[f.id,f.label])),mastery.attributeId)+input('die','Dado extra',mastery.die,'text','required maxlength="8" placeholder="1d4"')+'<p class="muted">O uso desta sessão continua '+(mastery.remaining>0?'disponível':'gasto')+'. A renovação fica com o mestre.</p>'+submit('Salvar maestria'),'sheetMastery');
  },
  sheetMasteryRefresh(id) {return action('sheetMasteryRefresh',id?{id}:{});},
  rollInsertReference() {
    const field=$('[name=formula]',dialog),reference=$('[name=reference]',dialog)?.value;
    if(!reference)return;
    const separator=field.value.trim()&&!/[+-]\s*$/.test(field.value)?' + ':'';
    field.value+=separator+'@{'+rollReferenceName(reference)+'}';field.focus();updateSavedRollPreview();
  },
  async sheetCounter(field,node) {
    const step=Number(node.dataset.step);
    await action('sheetCounter',{id:sheetId,field,step});
    const controls=[...main.querySelectorAll('[data-act=sheetCounter]')].filter(control=>control.dataset.id===field);
    (controls.find(control=>Number(control.dataset.step)===step&&!control.disabled)||controls.find(control=>!control.disabled))?.focus();
  },
  sheetSkill(id) {editSheetEntry('skills',id);},
  sheetAbility(id) {editSheetEntry('abilities',id);},
  async sheetFavorite(entry) {
    await action('sheetEntry',{id:sheetId,category:'skills',entry,operation:'favorite'});
    [...main.querySelectorAll('[data-act=sheetFavorite]')].find(button=>button.dataset.id===entry)?.focus();
  },
  sheetEntryDelete(key) {
    const [category,entry]=key.split('/');
    modal(category==='skills'?'Remover esta perícia?':category==='rollButtons'?'Remover esta rolagem?':'Remover esta habilidade?',
      '<input type="hidden" name="category" value="'+category+'"><input type="hidden" name="entry" value="'+esc(entry)+'">'+submit('Confirmar remoção'),'sheetEntryDelete');
  },
  sheetPortrait() {
    modal('Retrato do personagem','<p class="muted">Envie uma imagem PNG, JPG, WebP ou GIF de até 3 MB.</p>'+
      '<input type="hidden" name="kind" value="portrait"><input type="hidden" name="character" value="'+esc(sheetId)+'">'+
      '<label>Imagem<input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required></label>'+submit('Enviar retrato'),'upload');
  },
  sheetPortraitDelete() {confirmDelete('sheetPortraitDelete',sheetId,'Remover o retrato?');},
  sheetDie(faces) {
    if (!diceFaces.includes(Number(faces))) return;
    const before=sheetView.formula;
    const formula=(before.trim()?before.trim()+'+':'')+'1d'+faces;
    if (formula.length>rollFormulaLimit) return toast('A expressão atingiu o limite de caracteres.');
    sheetView.dice.push(before);
    setSheetFormula(formula);
  },
  sheetUndo() {
    if (sheetView.dice.length) setSheetFormula(sheetView.dice.pop());
    else setSheetFormula(sheetView.formula.replace(/(?:^\s*\d{0,2}d\d{1,4}|[+-]\s*(?:\d{0,2}d\d{1,4}|\d+))\s*$/i,'').trimEnd());
  },
  sheetClear() {
    sheetView.dice=[];sheetView.bonus='';setSheetFormula('');
    $('[data-sheet-bonus]',main).value='';
  },
  sheetSkillRoll(id) {
    const character=currentSheet(),skill=character.skills?.find(skill=>skill.id===id);if(!skill)return;
    const formula=sheetSkillTest(current.state,character,id).formula;
    return action('roll',{skillId:id,characterId:sheetId,actor:character.name,...sheetActionOptions(formula,character)});
  },
  schema() {
    modal('Modelo da ficha','<p class="muted">O modelo é compartilhado pelas fichas que ainda o seguem. Fichas com estrutura personalizada mantêm seus próprios campos. Ao remover um campo, ele deixa de aparecer nas fichas que seguem o modelo.</p>'+
      '<div class="stack" id="schema-rows">'+current.state.fields.map(schemaRow).join('')+'</div>'+
      '<div>'+button('Adicionar campo','fieldAdd','small','plus')+'</div>'+submit('Salvar modelo'),'schema');
  },
  fieldAdd() {$('#schema-rows').insertAdjacentHTML('beforeend',schemaRow());},
  fieldDelete(id,node) {node.closest('[data-field]').remove();},
  fieldMove(direction,node) {
    const row=node.closest('[data-field]');
    if(direction==='up') row.previousElementSibling?.before(row);
    else row.nextElementSibling?.after(row);
    node.focus();
  },
  initiative() {
    modal('Ordem de iniciativa','<div id="initiative-rows" class="stack">'+current.state.initiative.map(initiativeRow).join('')+'</div>'+
      '<div>'+button('Adicionar participante','initiativeAdd','small','plus')+'</div>'+submit('Salvar iniciativa'),'initiative');
  },
  initiativeAdd() {$('#initiative-rows').insertAdjacentHTML('beforeend',initiativeRow());},
  initiativeDelete(id,node) {node.closest('[data-entry]').remove();},
  scenesToggle(){sceneUI.open=!sceneUI.open;render();},
  sceneNew(){sceneEditor();},
  sceneEdit:sceneEditor,
  sessionEdit:sessionEditor,
  sceneView:viewScene,
  async sceneActivate(id){await action('sceneActivate',{id});if(gmSceneId!==id)await viewScene(id);toast('Cena compartilhada com os jogadores.');},
  async sceneDuplicate(id){const before=new Set(current.state.sceneLibrary.scenes.map(scene=>scene.id));const row=await action('sceneDuplicate',{id});const created=row?.state.sceneLibrary.scenes.find(scene=>!before.has(scene.id));if(created)await viewScene(created.id);},
  sceneShift(value){const [id,direction]=value.split('/');return action('sceneMove',{id,direction:Number(direction)});},
  sceneDelete(id){if(id===current.state.activeSceneId){toast('Mostre outra cena à mesa antes de apagar esta.');return;}confirmDelete('sceneDelete',id,'Apagar esta cena, seus tokens, desenhos e névoa?');},
  sessionDelete(id){confirmDelete('sessionDelete',id,'Apagar esta sessão vazia? Mova suas cenas para outra sessão antes de continuar.');},
  tokenAdd() {modal('Novo token',tableTokenForm(),'tableToken');},
  tableTokenAdd() {modal('Novo token',tableTokenForm(),'tableToken');},
  tableTokenEdit(id) {
    const token=current.state.tokens.find(token=>token.id===id);
    if (token) modal('Editar token',tableTokenForm(token),'tableToken');
  },
  tableSettings() {
    const {grid,fog,darkness}=normalizeTable(current.state);
    modal('Configurar mesa',input('sceneId','',current.state.sceneId,'hidden')+
      (current.state.map?.width?'<p class="muted">Imagem '+current.state.map.width+' × '+current.state.map.height+' px · grade atual '+grid.columns+' × '+grid.rows+'.</p>':'')+
      select('gridMode','Dimensionamento',{image:'Automático pela imagem',manual:'Colunas e linhas manuais'},grid.mode)+
      input('cellPixels','Pixels da imagem por célula',grid.cellPixels,'number','required min="10" max="4096" step="1"')+
      '<p class="muted">No modo automático, a grade acompanha a imagem. As células são quadradas e a imagem mantém suas proporções. Use o tamanho das casas do mapa, por exemplo 70 ou 100 px. Bordas incompletas recebem espaço adicional.</p><div class="form-grid">'+
      input('columns','Colunas',grid.columns,'number','required min="4" max="80" step="1"')+
      input('rows','Linhas',grid.rows,'number','required min="4" max="80" step="1"')+
      input('size','Unidades por célula',grid.size,'number','required min="0.1" max="100" step="any"')+
      input('unit','Unidade',grid.unit,'text','required maxlength="12" placeholder="m, pés, casas"')+'</div>'+
      select('distance','Regra de distância',{
        euclidean:'Linha reta (euclidiana)',chebyshev:'Diagonal vale uma célula',manhattan:'Somar distâncias dos eixos'
      },grid.distance||'euclidean')+
      '<label class="check"><input type="checkbox" name="visible" '+(grid.visible?'checked':'')+'> Exibir grade</label>'+
      '<label class="check"><input type="checkbox" name="snap" '+(grid.snap?'checked':'')+'> Encaixar tokens nas células</label>'+
      '<label class="check"><input type="checkbox" name="fogEnabled" '+(fog.enabled?'checked':'')+'> Ativar névoa de exploração</label>'+
      '<p class="muted">A névoa cobre visualmente as áreas ainda desconhecidas. A imagem original do mapa continua acessível aos participantes.</p>'+
      '<fieldset class="token-vision-settings"><legend>Escuridão e visão dos tokens</legend><label class="check"><input type="checkbox" name="darknessEnabled" '+(darkness.enabled?'checked':'')+'> Ativar escuridão nesta cena</label>'+select('visionMode','Quem compartilha a visão',{individual:'Cada jogador vê por seus próprios tokens',group:'Todos os personagens jogadores compartilham visão'},darkness.mode)+'<p class="muted">Configure o alcance e o ângulo ao editar cada token. A névoa manual continua cobrindo áreas. Paredes desenhadas na imagem não bloqueiam a visão automaticamente.</p></fieldset>'+
      submit('Salvar configuração'),'tableSettings');
  },
  tableCombat:editCombat,
  tableCombatAdd() {$('#combat-rows').insertAdjacentHTML('beforeend',combatRow());},
  tableCombatRemove(id,node) {node.closest('[data-combat-entry]').remove();},
  tableCombatTokens() {
    const present=new Set([...dialog.querySelectorAll('[data-combat-entry]')].map(row=>$('[name=tokenId]',row).value));
    const additions=current.state.tokens.filter(token=>!present.has(token.id));
    $('#combat-rows').insertAdjacentHTML('beforeend',additions.map(token=>combatRow({name:token.name,tokenId:token.id})).join(''));
  },
  tableCombatImport() {
    $('#combat-rows').insertAdjacentHTML('beforeend',(current.state.initiative||[]).map(combatRow).join(''));
  },
  tableRoll() {modal('Dados da mesa',dice(current.state));},
  audioToggle() {
    const activating=!audioPlayer.enabled||audioPlayer.blocked;
    audioPlayer.toggle();
    if (activating&&!current.needsCharacter) page='audio';
    if (page==='audio') {render();if(activating) window.scrollTo({top:0});}
    else audioPlayer.sync(currentView());
  },
  musicSessionNew() {editMusicSession('');},
  musicSessionEdit(id) {editMusicSession(id);},
  musicSessionSelect(id) {return action('musicSessionSelect',{id});},
  musicSessionDelete(id) {
    modal('Excluir esta sessão do repertório?',
      '<input type="hidden" name="id" value="'+esc(id)+'">'+submit('Confirmar exclusão'),'musicSessionDelete');
  },
  musicTrackNew(id) {editMusicTrack(id);},
  musicTrackEdit(key) {editMusicTrack(key);},
  musicTrackDelete(key) {
    const {sessionId,id}=musicItemKey(key);
    modal('Remover esta música do repertório?',
      '<input type="hidden" name="sessionId" value="'+esc(sessionId)+'"><input type="hidden" name="id" value="'+esc(id)+'">'+
      submit('Confirmar remoção'),'musicTrackDelete');
  },
  musicTrackUp(key) {return action('musicTrackMove',{...musicItemKey(key),direction:-1});},
  musicTrackDown(key) {return action('musicTrackMove',{...musicItemKey(key),direction:1});},
  musicLoop(){const track=current.state.audio?.track;if(track)return action('track',{command:'setLoop',loop:!track.loop,expectedCommandId:track.commandId});},
  musicTrackPlay(key) {
    if (!audioPlayer.enabled||audioPlayer.blocked) audioPlayer.toggle();
    return action('track',{command:'loadSaved',...musicItemKey(key)});
  },
  musicSettings() {
    const music=current.state.audio?.music||{fadeIn:3,fadeOut:3,volume:70};
    modal('Transições e volume da mesa',
      '<div class="form-grid">'+input('fadeIn','Fade-in em segundos',music.fadeIn,'number','required min="0" max="30" step="any"')+
      input('fadeOut','Fade-out em segundos',music.fadeOut,'number','required min="0" max="30" step="any"')+'</div>'+
      input('volume','Volume do mestre (%)',music.volume,'number','required min="0" max="100" step="1"')+
      '<p class="muted">Use zero para desativar os fades. O volume do mestre é combinado com o ajuste de cada participante.</p>'+
      submit('Salvar ajustes'),'musicSettings');
  },
  trackCommand(command) {return action('track',{command});},
  audioPane(id){if(['music','soundboard'].includes(id)){audioPane=id;render();}},
  soundboardOpen(){audioPane='soundboard';page='audio';render();},
  soundboardTab(tab){soundboardLibrary.setTab(tab);render();},
  soundboardSessionNew(){modal('Nova sessão do soundboard',input('name','Nome da sessão','','text','required maxlength="100"')+submit('Criar sessão'),'soundboardSession');},
  soundboardSessionEdit(id){const session=normalizeSoundboard(current.state.audio).sessions.find(s=>s.id===id);if(session)modal('Renomear sessão','<input type="hidden" name="id" value="'+esc(id)+'">'+input('name','Nome',session.name,'text','required maxlength="100"')+submit('Salvar sessão'),'soundboardSession');},
  soundboardSessionDelete(id){confirmDelete('soundboardSessionDelete',id,'Excluir esta seleção de sons? Os arquivos da campanha serão preservados.');},
  soundboardStop(){return action('soundboardStop',{});},
  soundPreview(id){return audioPlayer.preview(id);},
  soundFavorite(id){const sb=normalizeSoundboard(current.state.audio),session=sb.sessions.find(s=>s.id===sb.activeSessionId);return action('soundboardFavorite',{id,enabled:!session.favorites.includes(id)});},
  soundLoop(id){const sb=normalizeSoundboard(current.state.audio);if(!audioPlayer.enabled)audioPlayer.toggle();return action('soundLoop',{id,enabled:!sb.loops.some(c=>c.sound===id)});},
  async soundPackInstall(id,node){
    if(!current.master||node?.disabled)return;
    const access=credentials,session=normalizeSoundboard(current.state.audio).activeSessionId;
    if(node){node.disabled=true;node.textContent='Baixando pacote…';}
    toast('Baixando e instalando o pacote no servidor. Aguarde.');
    try{const row=await post('/'+access.id+'/sound-pack?pack='+encodeURIComponent(id)+'&session='+encodeURIComponent(session),{});if(credentials===access){setCurrent(row);render();toast('Pacote instalado e ativado na sessão escolhida.');}}
    finally{if(node){node.disabled=false;node.textContent='Baixar e ativar nesta sessão';}}
  },
  soundPackImport(){modal('Importar pacote ZIP',input('name','Nome do pacote','','text','required maxlength="100"')+input('author','Autor ou biblioteca','','text','maxlength="100"')+input('source','Página da fonte (opcional)','','url','maxlength="500"')+select('license','Licença do pacote',{'Arquivo próprio':'Arquivos próprios','CC0-1.0':'CC0 / domínio público','CC-BY-4.0':'CC BY 4.0 (com crédito)','Outra licença autorizada':'Outra licença que permite este uso'},'Arquivo próprio')+'<label>Pacote de áudio<input type="file" name="file" accept=".zip,application/zip" required></label><p class="muted">Até 32 MB por ZIP; até 8 MB por áudio. O autor e a licença ficam registrados. Apenas os áudios são importados.</p>'+submit('Importar e ativar nesta sessão'),'soundPackImport');},
  soundPlay(id) {
    if (!audioPlayer.enabled) {
      audioPlayer.toggle();
      render();
    }
    return action('soundPlay',{id});
  },
  soundDelete(id) {confirmDelete('soundDelete',id,'Remover este efeito do soundboard?');},
  upload(kind) {
    if (kind==='sound') {
      modal('Enviar efeito sonoro','<p class="muted">Envie um arquivo de áudio de até 8 MB.</p>'+
        '<input type="hidden" name="kind" value="sound"><label>Arquivo<input name="file" type="file" accept="audio/*" required></label>'+submit('Enviar efeito'),'upload');
      return;
    }
    const pdf = kind==='pdf';
    modal(pdf?'Adicionar PDF':'Enviar mapa','<p class="muted">'+(pdf?'PDF de até 24 MB. O arquivo fica disponível aos jogadores da campanha.':'PNG, JPG, WebP ou GIF de até 8 MB. A grade será criada pelas dimensões da imagem, sem deformá-la.')+'</p>'+
      '<input type="hidden" name="kind" value="'+kind+'">'+(!pdf?input('sceneId','',current.state.sceneId,'hidden'):'')+'<label>Arquivo<input name="file" type="file" accept="'+(pdf?'application/pdf':'image/png,image/jpeg,image/webp,image/gif')+'" required></label>'+(!pdf?input('cellPixels','Pixels por célula',100,'number','required min="10" max="4096" step="1"')+'<p class="muted" data-map-info role="status">Selecione a imagem para calcular a grade.</p>':'')+submit('Enviar arquivo'),'upload');
  },
  async book(id,node,pageNumber) {
    const book = current.state.books.find(item=>item.id===id);
    if (!book) return;
    const response = await request(campaignPath()+'/asset/'+id);
    const url = URL.createObjectURL(await response.blob());
    const pageUrl=url+'#page='+Math.max(1,Math.min(10000,Math.trunc(Number(pageNumber)||1)));
    modal(esc(book.name),'<a class="btn primary" href="'+pageUrl+'" target="_blank" rel="noopener">Abrir em outra aba</a><iframe class="pdf-frame" title="'+esc(book.name)+'" src="'+pageUrl+'"></iframe>');
    dialog.addEventListener('close',()=>setTimeout(()=>URL.revokeObjectURL(url),60000),{once:true});
  },
  characterType(){const c=currentSheet();if(!current.master||!c)return;modal('Tipo de ficha',input('id','',c.id,'hidden')+select('characterType','Este personagem é',{player:'Personagem de jogador',npc:'NPC · personagem do mestre'},c.characterType||'player')+'<p class="muted">No modo compartilhado, os tokens visíveis de todos os personagens jogadores fornecem visão ao grupo. NPCs não fornecem visão e não podem ser escolhidos pelo convite. Transformar em NPC libera o vínculo com o jogador. A visibilidade da ficha é configurada separadamente.</p>'+submit('Salvar tipo'),'characterType');},
  characterDelete(id) {confirmDelete('characterDelete',id,'Remover esta ficha?');},
  tokenDelete(id) {confirmDelete('tokenDelete',id,'Remover este token?');},
  bookDelete(id) {confirmDelete('bookDelete',id,'Remover este PDF da biblioteca?');}
};

function confirmDelete(actionName,id,message) {
  modal(message,'<input type="hidden" name="id" value="'+esc(id)+'"><input type="hidden" name="action" value="'+actionName+'">'+submit('Confirmar remoção'),'delete');
}

const forms = {
  soundboardSession:data=>action('soundboardSessionSave',data),
  async soundPackImport(data,form){
    const file=form.elements.file.files[0];if(!file||file.size>32*1024*1024)throw new Error('Selecione um ZIP de até 32 MB.');
    const access=credentials,session=normalizeSoundboard(current.state.audio).activeSessionId;
    const headers={'Content-Type':'application/zip'};for(const field of ['name','author','source','license'])headers['X-Pack-'+field[0].toUpperCase()+field.slice(1)]=encodeURIComponent(data[field]||'');
    const response=await request('/'+access.id+'/sound-pack?session='+encodeURIComponent(session),{method:'POST',headers,body:file});
    const row=await response.json();if(credentials===access){setCurrent(row);render();}
  },
  async campaignImport(data,form){
    const file=form.elements.file.files[0];if(!file||file.size>100_000_000)throw new Error('Selecione um backup .forja de até 100 MB.');
    const response=await request('/import',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file},null);
    const row=await response.json();++epoch;reconnectingAccess=null;credentials={id:row.id,key:row.key};page='home';sheetId='';setCurrent(row);remember(row,credentials);render();
  },
  async campaignRecover(data){
    const value=String(data.code||'').trim();
    const match=/(?:^|#mesa=)([\da-f-]{36})\.([\da-f]{40}|[\da-f]{64})$/.exec(value);
    if(!match)throw new Error('Cole o código completo ou um link válido da campanha.');
    await openCampaign({id:match[1],key:match[2]});
  },
  async narration(data,form){const message=narrationFormData(new FormData(form));await action('narrationSend',message);localStorage.setItem('forja.narrationStyle.'+current.id,JSON.stringify(message.style));},
  ...sheetHistoryController.forms,
  async itemSave(data,form){
    const file=form.elements?.portraitFile?.files?.[0],{portraitFile,portrait,...fields}=data;
    const payload={...fields,version:Number(data.version),id:data.id||undefined,removePortrait:data.removePortrait==='on'};
    if(!file?.size)return action('itemSave',payload);
    if(file.size>3*1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('Selecione PNG, JPG, WebP ou GIF de até 3 MB.');
    const body=new FormData();body.set('data',JSON.stringify(payload));body.set('file',file,file.name);
    const access=credentials,response=await request('/'+access.id+'/item-portrait',{method:'POST',headers:{'X-Scene-Id':current.state.sceneId||''},body},access),row=await response.json();
    if(credentials===access&&row.rev>=current.rev){setCurrent(row);if(!syncCurrentTable())render();}return row;
  },
  lootPlace(data,form){return action('lootPlace',{...data,version:Number(form.elements.itemId.selectedOptions[0].dataset.version),quantity:Number(data.quantity),x:Number(data.x),y:Number(data.y),revealed:data.revealed==='on'});},
  async lootCollect(data){const owner=credentials,row=await action('lootCollect',{...data,version:Number(data.version)});if(row?.pickup?.itemId&&credentials===owner){if(!row.master)lootRewards.enqueue(row.pickup.itemId,owner);else toast('Item entregue ao inventário da ficha escolhida.');}},
  itemGrant(data){return action('itemGrant',{...data,version:Number(data.version),quantity:Number(data.quantity)});},
  itemManage(data){return action('itemManage',{...data,version:Number(data.version),quantity:Number(data.quantity),equipped:data.equipped==='on'});},
  itemDelete(data){return action('itemDelete',{id:data.id,version:Number(data.version)});},
  journal(data,form){return action('journalSave',journalFormData(new FormData(form)));},
  journalDelete(data){return action('journalDelete',{id:data.id,version:Number(data.version)});},
  sheetTemplateSave(data){return action('sheetTemplateSave',{...data,shared:data.shared==='on',includeAbilities:data.includeAbilities==='on',includeAppearance:data.includeAppearance==='on'});},
  async sheetTemplateImport(data,form){const file=form.elements.file.files[0];if(!file||file.size>100*1024)throw new Error('Selecione um arquivo JSON de até 100 KB.');let bundle;try{bundle=JSON.parse(await file.text());}catch{throw new Error('O arquivo não contém JSON válido.');}return action('sheetTemplateImport',{bundle,shared:false});},
  sheetTemplateEdit(data){return action('sheetTemplateUpdate',{...data,expectedVersion:Number(data.expectedVersion),shared:data.shared==='on'});},
  sheetTemplateDelete(data){return action('sheetTemplateDelete',{id:data.id,expectedVersion:Number(data.expectedVersion)});},
  async sheetTemplateApply(data,form){const expectedHistoryVersion=Number(form.elements.characterId.selectedOptions[0].dataset.historyVersion);const row=await action('sheetTemplateApply',{templateId:data.templateId,characterId:data.characterId,expectedVersion:Number(data.expectedVersion),expectedHistoryVersion});if(row)openSheet(data.characterId);},
  async sheetTemplateCreate(data){const row=await action('character',data);if(row)openSheet(row.characterId||row.state.characters.at(-1).id);},
  create:data=>createCampaign(data.name,false,true,data.ruleset||'free'),
  async campaignDelete(data) {
    const access=read('forja.campaigns')?.[data.id];if(!access?.master)return;
    const result=await request('/'+access.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.name})},access).then(response=>response.json());
    forgetCampaign(access.id);
    if(credentials?.id===access.id){++epoch;credentials=null;setCurrent(lobby);page='home';sheetId='';}
    render();
    toast(result.cleanupPending?'Campanha apagada. Alguns arquivos precisam de limpeza no servidor.':'Campanha apagada.');
  },
  settings:data=>action('settings',data),
  dndRest:data=>action('dndRest',data),
  async dndCreate(data,form) {
    const config=dndFormData(form);
    const row=await action('character',{name:data.name,color:data.color||'blue',concept:dndClasses.find(c=>c.id===config.classId)?.name||'',...(current.master?{characterType:data.characterType||'player'}:{}),dnd:config});
    const character=row?.state.characters.find(c=>c.id===row.characterId)||row?.state.characters.at(-1);
    if(character)openSheet(character.id);
  },
  gmPartyFields(data,form){return action('gmPartyFields',{id:data.id,fields:[...form.querySelectorAll('[name=fields]:checked')].map(field=>field.value)});},
  gmCard(data){const [targetKind,targetId]=(data.target||'').split('/');return action('gmCardSave',{...data,version:Number(data.version),wide:data.wide==='on',targetKind,targetId,page:Number(data.page)});},
  gmCardDelete:data=>action('gmCardDelete',{id:data.id,version:Number(data.version)}),
  async notes(data){const id=current.id;await action('notes',data);gmNoteDrafts.delete(id);if(page==='shield'&&current.id===id)render();},
  musicSession:data=>action('musicSessionSave',data),
  musicSessionDelete:data=>action('musicSessionDelete',data),
  musicTrack:data=>action('musicTrackSave',{...data,loop:data.loop==='on'}),
  musicTrackDelete:data=>action('musicTrackDelete',data),
  musicSettings:data=>action('musicSettings',{fadeIn:Number(data.fadeIn),fadeOut:Number(data.fadeOut),volume:Number(data.volume)}),
  track(data) {
    if (!audioPlayer.enabled||audioPlayer.blocked) audioPlayer.toggle();
    return action('track',{...data,command:'load'});
  },
  roll(data) {
    localStorage.setItem('forja.actor',JSON.stringify(data.actor));
    return action('roll',data);
  },
  delete:data=>action(data.action,{id:data.id}),
  schema(data,form) {return action('schema',{fields:readFields(form)});},
  sheetFields(data,form) {return action('sheetFields',{id:sheetId,layout:true,fields:readFields(form)});},
  sheetMastery:data=>action('sheetMastery',{...data,id:sheetId}),
  sheetColors:data=>action('sheetAppearance',sheetColorsPayload(current.state,currentSheet(),data)),
  sheetResource:data=>action('sheetCounter',{id:sheetId,field:data.field,current:data.current,maximum:data.maximum}),
  savedRoll:data=>action('sheetEntry',{...data,id:sheetId,category:'rollButtons',operation:'save'}),
  sheetEntry(data) {return action('sheetEntry',{...data,id:sheetId,operation:'save',favorite:data.favorite==='true'});},
  sheetEntryDelete(data) {return action('sheetEntry',{...data,id:sheetId,operation:'delete'});},
  sheetRoll(data) {
    const bonus=Number(data.bonus)||0;
    const formula=data.formula.trim()+(bonus>0?'+'+bonus:bonus<0?String(bonus):'');
    return action('roll',{formula,actor:currentSheet().name,characterId:sheetId,...sheetActionOptions(formula,currentSheet())});
  },
  initiative(data,form) {
    const entries = [...form.querySelectorAll('[data-entry]')].map(row=>({name:$('[name=name]',row).value,value:$('[name=value]',row).value}));
    return action('initiative',{entries});
  },
  characterType:data=>action('characterType',{id:data.id,characterType:data.characterType}),
  async character(data) {
    const existing=current.state.characters.find(item=>item.id===data.id);
    const preset=!existing?sheetPreset(data.preset):null;
    const values = Object.fromEntries(sheetFields(current.state,preset?{layout:preset.fields}:existing).flatMap(field=>{
      const name = 'value-'+field.id;
      const before=sheetValue(existing,field);
      const value=field.type==='counter'
        ? (data[name+'-now']||'')+'/'+(data[name+'-max']||'')
        : data[name]??(field.type==='check'?'false':before);
      return existing && value===before ? [] : [[field.id,value]];
    }));
    const row=await action('character',{...data,values,...(current.master?{hidden:data.hidden==='on'}:{})});
    if (!data.id && row) openSheet(row.characterId||row.state.characters.at(-1).id);
  },
  tableSettings(data) {
    return action('tableSettings',{sceneId:data.sceneId,grid:{
      mode:data.gridMode,cellPixels:Number(data.cellPixels),columns:Number(data.columns),rows:Number(data.rows),size:Number(data.size),unit:data.unit,distance:data.distance,
      visible:data.visible==='on',snap:data.snap==='on'
    },fogEnabled:data.fogEnabled==='on',darkness:{enabled:data.darknessEnabled==='on',mode:data.visionMode||'individual'}});
  },
  async sceneEditor(data){
    const before=new Set(current.state.sceneLibrary.scenes.map(scene=>scene.id));const row=await action(data.id?'sceneUpdate':'sceneCreate',{...data,expectedVersion:Number(data.expectedVersion)});
    if(!data.id&&row){const created=row.state.sceneLibrary.scenes.find(scene=>!before.has(scene.id));if(created)await viewScene(created.id);}
  },
  async sessionEditor(data){await action(data.id?'sessionUpdate':'sessionCreate',{...data,expectedVersion:Number(data.expectedVersion)});sceneUI.open=true;render();},
  async tableToken(data) {
    const file=data.tokenPortrait;
    if(!file?.size)return action(data.id?'tokenUpdate':'tokenAdd',tokenData(data));
    if(file.size>3*1024*1024)throw new Error('O retrato deve ter até 3 MB.');
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('Escolha uma imagem PNG, JPEG, WebP ou GIF.');
    await readMapDimensions(file);
    await ensureCampaign();const access=credentials;
    const response=await request(campaignPath()+'/token-portrait',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Scene-Id':data.sceneId,'X-Token-Data':encodeURIComponent(JSON.stringify(tokenData(data)))},body:file});
    const row=await response.json();if(credentials===access&&row.rev>=current.rev){setCurrent(row);if(!syncCurrentTable())render();}
  },
  tableCombat(data,form) {
    const entries=[...form.querySelectorAll('[data-combat-entry]')].map(row=>{
      const tokenId=$('[name=tokenId]',row).value;
      const token=current.state.tokens.find(token=>token.id===tokenId);
      return {id:row.dataset.combatEntry,tokenId,
        name:$('[name=name]',row).value.trim()||token?.name||'Participante',
        value:Number($('[name=value]',row).value)};
    }).sort((a,b)=>b.value-a.value);
    const {combat}=normalizeTable(current.state);
    const activeId=combat.entries[combat.active]?.id;
    const active=entries.findIndex(entry=>entry.id===activeId);
    return action('combatSet',{sceneId:data.sceneId,entries,active:Math.max(0,active),round:combat.round});
  },
  async upload({kind,file,character,cellPixels,sceneId}) {
    await ensureCampaign();
    const access = credentials;
    const mapHeaders=kind==='map'?{'X-Scene-Id':sceneId||current.state.sceneId||''}:{};
    if (kind==='map') {
      const dimensions=await readMapDimensions(file);
      Object.assign(mapHeaders,{'X-Map-Width':String(dimensions.width),'X-Map-Height':String(dimensions.height),'X-Grid-Cell-Size':String(cellPixels||100)});
    }
    const response = await request(campaignPath()+'/'+kind,{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),...mapHeaders,...(character?{'X-Character-Id':character}:{})},body:file});
    const row = await response.json();
    if (credentials===access && row.rev>=current.rev) {setCurrent(row);render();}
  }
};

async function readMapDimensions(file) {
  if (typeof createImageBitmap==='function') {
    const image=await createImageBitmap(file);
    const size={width:image.width,height:image.height};image.close();
    return size;
  }
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Não foi possível abrir a imagem do mapa.'));image.src=url;});
    return {width:image.naturalWidth,height:image.naturalHeight};
  } finally {URL.revokeObjectURL(url);}
}

async function updateMapImport() {
  const fileInput=$('[name=file]',dialog);
  const file=fileInput?.files?.[0];
  const info=$('[data-map-info]',dialog);
  if (!file||!info) return;
  try {
    const dimensions=await readMapDimensions(file);
    if (fileInput.files[0]!==file||!dialog.contains(info)) return;
    const grid=mapGrid(dimensions,Number($('[name=cellPixels]',dialog)?.value)||100);
    info.textContent=dimensions.width+' × '+dimensions.height+' px → '+grid.columns+' colunas × '+grid.rows+' linhas · '+grid.cellPixels+' px por célula.';
  } catch {info.textContent='Esta imagem não pôde ser aberta. Escolha outro arquivo.';}
}

dialog.addEventListener('input',()=>{updateItemAccent(dialog);if(updateTokenAppearance(dialog,current.state.characters))applyPortraits(dialog);});
dialog.addEventListener('change',event=>{
  if(event.target.name==='tokenPortrait'&&event.target.files?.[0]){const auto=dialog.querySelector('[name="icon"][value="auto"]');if(auto)auto.checked=true;const remove=dialog.querySelector('[name="removePortrait"]');if(remove)remove.checked=false;}
  if(event.target.name==='removePortrait'&&event.target.checked){const file=dialog.querySelector('[name="tokenPortrait"]');if(file)file.value='';}
  if(updateTokenAppearance(dialog,current.state.characters))applyPortraits(dialog);
  if(event.target.name==='kind'&&event.target.closest('[data-form=gmCard]')){const reference=$('[data-gm-reference]',dialog);if(reference)reference.hidden=event.target.value!=='reference';}
  if(event.target.matches('[name=dndCategory],[name=dndTarget],[name=dndAllSpells]'))updateDndReference();
  const dndForm=event.target.closest('[data-form=dndCreate]');if(dndForm)updateDndCreation(dndForm,{esc},event.target.name==='backgroundId',event.target.name==='classId');
  if(event.target.matches('[data-character-preset]')) {
    const draft=Object.fromEntries(['name','concept','color','characterType'].map(key=>[key,$('[name='+key+']',dialog)?.value]));
    if(event.target.value==='dnd-2024')openDndCreation(draft);else editCharacter('',event.target.value,draft);
  }
  if(event.target.matches('[name=file],[name=cellPixels]')) updateMapImport();
});

document.addEventListener('click',async event=>{
  const node = event.target.closest('[data-act]');
  if (!node) return;
  try {await handlers[node.dataset.act]?.(node.dataset.id,node);}
  catch(error) {toast(error.message);}
});

main.addEventListener('change',event=>{if(event.target.matches('[data-sheet-mastery]'))sheetView.mastery=event.target.value;if(event.target.matches('[data-sheet-roll-mode]'))sheetView.rollMode=event.target.value;});

main.addEventListener('input',event=>{
  const field=event.target;
  if (field.matches('[data-effect-volume]')) audioPlayer.setVolume(field.value/100);
  if (field.matches('[data-sheet-formula]')) {sheetView.formula=field.value;sheetView.dice=[];}
  if (field.matches('[data-sheet-bonus]')) sheetView.bonus=field.value;
  if (field.matches('[data-skill-search],[data-skill-favorites]')) {
    if (field.matches('[data-skill-search]')) sheetView.query=field.value;
    else sheetView.favorites=field.checked;
    $('#sheet-skills',main).innerHTML=sheetSkillList(currentSheet(),current.state);
  }
});

function updateInviteAddress() {
  const address=inviteOrigin($('[name=inviteAddress]',dialog)?.value);
  const field=$('[name=invite]',dialog);
  if (!field) return;
  field.value=address ? address+'/#mesa='+current.id+'.'+current.invite : '';
  $('[data-act=copy]',dialog).disabled=!address;
  if (address) localStorage.setItem('forja.inviteOrigin',JSON.stringify(address));
}

dialog.addEventListener('input',event=>{
  const narrationForm=event.target.closest('[data-form=narration]');if(narrationForm)updateNarrationComposer(narrationForm);
  if(event.target.matches('[data-dnd-query]'))updateDndReference();
  const dndForm=event.target.closest('[data-form=dndCreate]');if(dndForm)updateDndCreation(dndForm,{esc});
  if(event.target.matches('[data-saved-formula]')) updateSavedRollPreview();
  if (event.target.name==='inviteAddress') updateInviteAddress();
});

dialog.addEventListener('change',event=>{
  const narrationForm=event.target.closest('[data-form=narration]');if(narrationForm)updateNarrationComposer(narrationForm,{preset:event.target.name==='preset'});
  if (event.target.name==='inviteOrigin') {
    $('[name=inviteAddress]',dialog).value=event.target.value;
    updateInviteAddress();
  }
});

document.addEventListener('submit',async event=>{
  const form = event.target;
  if (!forms[form.dataset.form]) return;
  event.preventDefault();
  const submitter = event.submitter || $('[type=submit]',form);
  if (submitter) submitter.disabled=true;
  try {
    await forms[form.dataset.form](Object.fromEntries(new FormData(form)),form);
    if (dialog.contains(form)) {
      if (form.dataset.form==='roll') {
        const formula=form.elements.formula.value;
        const actor=form.elements.actor.value;
        modal('Dados da mesa',dice(current.state));
        $('[name=formula]',dialog).value=formula;
        $('[name=actor]',dialog).value=actor;
        $('[type=submit]',dialog)?.focus();
      } else dialog.close();
    }
    if (!['roll','sheetRoll','create','campaignDelete','lootCollect'].includes(form.dataset.form)) toast('Alterações salvas.');
  } catch(error) {toast(error.message);}
  finally {if (submitter) submitter.disabled=false;}
});

async function refresh(force=false) {
  const access = credentials||reconnectingAccess;
  if (!access) return;
  if(campaignRefresh?.access===access&&!force)return;
  campaignRefresh?.controller.abort();
  const task={access,controller:new AbortController()};campaignRefresh=task;
  const timeout=setTimeout(()=>task.controller.abort(),6000);
  try {
    if(!credentials&&reconnectingAccess===access){await openCampaign(access);toast('Conexão restabelecida. Seu acesso foi mantido.');return;}
    const row = await request('/'+access.id,{signal:task.controller.signal},access).then(response=>response.json());
    if (credentials!==access || row.rev<current.rev) return;
    if(current.master&&gmSceneId&&row.state.sceneId!==gmSceneId&&row.state.sceneLibrary?.scenes.some(scene=>scene.id===gmSceneId))return;
    if (row.characterId!==current.characterId||row.needsCharacter!==current.needsCharacter||
        sheetId&&!current.master&&!row.state.characters.some(character=>character.id===sheetId&&character.access==='full')) {
      dialog.close();setCurrent(row);render();return;
    }
    if(!force&&row.rev===current.rev&&sceneRevision<=current.rev)return;
    audioPlayer.sync(row);
    musicDock.sync(row);soundboardDock.sync(row);audioPopover.sync(row);
    observeRolls(row);
    if(page==='table'&&!current.needsCharacter){setCurrent(row);if(!syncCurrentTable()&&!tabletop.isInteracting()&&!dialog.open)render();return;}
    const editing = main.contains(document.activeElement) && document.activeElement.matches('input,textarea,select,[data-table-token],iframe');
    if (row.rev>current.rev && !inlineSheet.editing && !editing && !tabletop.isInteracting() && !(page==='sheets'&&currentSheet()&&sheetMosaic.editing) && !sheetMosaic.isInteracting() && !dialog.open) {setCurrent(row);render();}
  } catch(error) {if([403,404].includes(error.status)&&credentials===access){reconnectingAccess=access;credentials=null;dialog.close();setCurrent(lobby);render();toast('Campanha temporariamente indisponível. Seu acesso foi preservado; a reconexão será automática quando o servidor voltar.');}}
  finally {clearTimeout(timeout);if(campaignRefresh===task)campaignRefresh=null;}
}

async function refreshAudio() {
  const access=credentials;
  if (!access||audioSyncing) return;
  audioSyncing=true;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4000);
  const started=performance.now();
  try {
    const row=await request('/'+access.id+'/sync?rollVersion='+encodeURIComponent(latestRollVersion)+(page==='table'&&!tableLive.connected?'&table=1':''),{signal:controller.signal},access).then(response=>response.json());
    if (access!==credentials) return;
    row.serverTime+=(performance.now()-started)/2;
    audioPlayer.sync(row);
    musicDock.sync(row);soundboardDock.sync(row);audioPopover.sync(row);
    observeRolls(row);
    if(page==='table'&&row.state?.table)receiveTableEvent({type:'scene',...row});
  } catch { /* Retry the shared timeline on the next audio poll. */ }
  finally {clearTimeout(timeout);audioSyncing=false;}
}

document.addEventListener('input',event=>{
  if(event.target.matches('[data-inventory-search]')){inventoryView.query=event.target.value;const shell=document.createElement('div');shell.innerHTML=renderInventory(currentView(),gmUI(),inventoryView);const results=$('[data-inventory-results]',main);if(results)results.innerHTML=$('[data-inventory-results]',shell).innerHTML;}
  if(event.target.matches('[data-journal-search]')){journalView.query=event.target.value;const grid=$('.journal-grid',main);if(grid){const shell=document.createElement('div');shell.innerHTML=renderJournal(currentView(),gmUI(),journalView);grid.innerHTML=$('.journal-grid',shell).innerHTML;}}
  if(event.target.matches('[data-scene-search]')){sceneUI.query=event.target.value;const cards=$('[data-scene-cards]',main);if(cards){cards.innerHTML=renderSceneCards(currentView(),sceneUI);applyPortraits();}}
  if(current.master&&page==='shield'&&event.target.matches('[data-gm-notes]')){gmNoteDrafts.set(current.id,event.target.value);const status=$('[data-gm-notes-status]',main);if(status)status.textContent='Rascunho não salvo · preservado ao navegar nesta aba.';}
  if(page==='shield'&&event.target.matches('[data-gm-search]')){gmView.query=event.target.value;const cards=$('[data-gm-cards]',main);if(cards)cards.innerHTML=renderGmCards(currentView(),gmUI(),gmView);}
  if (event.target.matches('[data-overlay-effect-volume]')) audioPlayer.setVolume(event.target.value/100);
  if (event.target.matches('[data-music-volume]')) audioPlayer.setMusicVolume(event.target.value);
});
document.addEventListener('change',async event=>{
  if(event.target.matches('[data-inventory-scope]')){inventoryView.scope=event.target.value;render();}
  if(event.target.matches('[data-journal-kind]')){journalView.kind=event.target.value;render();}
  if(event.target.matches('[data-dice-effects]'))diceDisplay.setEnabled(event.target.checked);
  try {
    if (!current.master) return;
    if(event.target.matches('[data-soundboard-session]'))await action('soundboardSessionSelect',{id:event.target.value});
    if(event.target.matches('[data-soundboard-pack]'))await action('soundboardPackToggle',{packId:event.target.dataset.soundboardPack,enabled:event.target.checked});
    if(event.target.matches('[data-soundboard-pick]'))await action('soundboardPick',{id:event.target.dataset.soundboardPick,enabled:event.target.checked});
    if(event.target.matches('[data-soundboard-volume]'))await action('soundboardSettings',{volume:Number(event.target.value)});
    if (event.target.matches('[data-playlist-session]')) await action('musicSessionSelect',{id:event.target.value});
    if (event.target.matches('[data-playlist-volume]')) {
      await action('musicSettings',{volume:Number(event.target.value)});
    }
  } catch(error) {toast(error.message);musicDock.sync(currentView());soundboardDock.sync(currentView());audioPopover.sync(currentView());}
});
let lastConnectionResume=0;
function resumeCampaignConnection(){
  if(document.hidden||!credentials&&!reconnectingAccess||Date.now()-lastConnectionResume<250)return;
  lastConnectionResume=Date.now();tabletop.resetRealtime?.();tableLive.reconnect();refresh(true);refreshAudio();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)diceDisplay.clear();else {narrationDisplay.resume();resumeCampaignConnection();}});
window.addEventListener?.('online',resumeCampaignConnection);
window.addEventListener?.('pageshow',event=>{if(event.persisted)resumeCampaignConnection();});

async function initialize() {
  render();
  const invite = /^#mesa=([\da-f-]{36})\.([\da-f]{40}|[\da-f]{64})$/.exec(location.hash);
  if (invite) history.replaceState(null,'',location.pathname+location.search);
  try {
    if (!invite) {
      const active=read('forja.active'),known=read('forja.campaigns')?.[active];
      if(known)await openCampaign(known);
      else{
        const session=await request('/session',{},null).then(response=>response.json()).catch(()=>({}));
        if(session.id&&!(read('forja.forgotten')||[]).includes(session.id))await openCampaign({id:session.id});
      }
    }
    if (invite) {
      const known = read('forja.campaigns')?.[invite[1]];
      await openCampaign({id:invite[1],key:known?.key||invite[2]});
    }
  } catch(error) {toast('Não foi possível reabrir a campanha. Seu acesso foi preservado: '+error.message);}
  setInterval(refresh,2500);
  setInterval(refreshAudio,400);
  refreshAudio();
}

initialize();

 document.addEventListener('change',async event=>{
  const node=event.target;
  if(!current.master||page!=='shield'||!node.matches('[data-gm-task]'))return;
  node.disabled=true;
  try{await action('gmCardToggle',{id:node.dataset.gmTask,itemId:node.dataset.gmItem,done:node.checked});}catch(error){node.checked=!node.checked;toast(error.message);}finally{node.disabled=false;}
 });
