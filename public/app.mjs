import {clockPanel,clockEditor,recapPanel,recapEditor} from './session-log-ui.mjs';
import {lootPlacement,lootPreview,createLootRewards,flyRewardToInventory} from './loot.mjs';
import {renderSheetResource,sheetColorsForm,sheetColorsPayload,createResourceAnimations} from './sheet-resources.mjs';
import {phoneClick,preparePhonePhotos,updateReadingFields,renderInventory,sheetInventory,itemEditor,itemGrantForm,itemDetails,itemManageForm,itemPortrait,itemTheme,updateItemAccent} from './inventory.mjs';
import {createSheetHistoryController} from './sheet-history-controller.mjs';
import {createAccessStorage,restoreCampaignIdentity} from './player-access.mjs';
import {createInlineSheetEditor} from './sheet-inline.mjs';
import {sheetTemplateLibrary,sheetTemplateSaveForm,sheetTemplateEditForm,sheetTemplateApplyForm,downloadSheetTemplate} from './sheet-templates.mjs';
import {noteReader,collectMarkdown,journalEntries,renderJournal,journalEditor,journalFormData} from './journal.mjs';
import {renderSceneManager,renderSceneCards} from './scenes.mjs';
import {renderTokenAppearance,updateTokenAppearance} from './token-editor.mjs';
import {createSheetMosaic,renderSheetMosaic,renderSheetLayoutEditor,sheetThemeStyle,sheetFieldTone} from './sheet-mosaic.mjs';
import {mountVaultCanvas,prepSession,prepList,renderGmScreen,renderGmCards,gmCardEditor,gmTableRow,combatAudience,gmCategories,visibleGmCards,gmPartyFieldsEditor,initiativeRollSpec,rollDiceFormulaLocal} from './gm-screen.mjs';
import {createDiceDisplay,createNarrationDisplay,rollVisibilityOptions,rollVisibilityBadge,canRepeatRoll,repeatRollPayload} from './rolls.mjs';
import {createCinematicStage} from './cinematic.mjs';
import {narrationComposer,narrationFormData,updateNarrationComposer} from './narration.mjs';
import {dndCatalog,dndAbilities,dndClasses,dndBackgrounds,dndWeapons,dndModifier,dndDerived,dndBook,dndAttribution,dndCharacterSpellSlots} from './dnd.mjs';
import {dndCreation,dndFormData,updateDndCreation,dndCatalogShell,renderDndResults} from './dnd-ui.mjs';
import {tokenCharacterId,sheetRequestOptions,requestedTest,cinematicStyle,captionSpeeds,cinematicTransitions,cinematicReveals,stressRegionsFor,bodyStressWithHead,newCampaign, colors, characterColorNames, icons, rollFormulaLimit, sheetFields, sheetValue, skillValues, inviteOrigin,resolveSheetFormula,displaySheetFormula,sheetPresets,sheetPreset,sheetSkillTest,sheetSavedRollFormula} from './model.mjs';
import {emptyAudio,soundPresets} from './media.mjs';
import {campaignAudio} from './audio.mjs';
import {createSoundboardLibrary,createSoundboardDock} from './soundboard.mjs';
import {normalizeSoundboard} from './soundboard-model.mjs';
import {createMusicLibrary,createMusicDock,createAudioPopover} from './music.mjs';
import {createTabletop,renderAtmosphere} from './table.mjs';
import {createTokenMicrophone} from './token-voice.mjs';
import {createTableLive} from './table-live.mjs';
import {normalizeTable,mapGrid,normalizeVision,weatherNames,sceneTones,weatherLevels} from './table-model.mjs';

const $ = (selector,root=document) => root.querySelector(selector);
const dialog = $('#dialog');
const main = $('#main');
dialog.addEventListener('cancel',()=>flyRewardToInventory(dialog));
const lobby = {master:true, rev:0, state:newCampaign('',false)};
const pages = {
  home:['Visão geral','home'],
  sheets:['Fichas','sheets','Crie e personalize seus personagens.','violet'],
  table:['Mesa virtual','table','Explore mapas, mova tokens e role dados.','jade'],
  shield:['Escudo do mestre','shield','Consulte fichas e organize a sessão.','gold'],
  inventory:['Inventário','backpack','Prepare itens e organize os equipamentos dos personagens.','jade'],
  journal:['Diário','library','Organize pistas, locais e missões da campanha.','gold'],
  library:['Biblioteca','library','Consulte os livros de regras da campanha.','blue'],
  audio:['Áudio','audio','Toque músicas e efeitos na sessão.','rose'],
  settings:['Configurações','settings','Personalize as cores da interface.','violet'],
};
const paths = {
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  settings:'<path d="M3 7h6m5 0h7M3 17h11m5 0h2"/><circle cx="11" cy="7" r="2.5"/><circle cx="16" cy="17" r="2.5"/>',
  home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/>',
  backpack:'<path d="M9 6V5a3 3 0 0 1 6 0v1"/><rect x="4.5" y="6" width="15" height="16" rx="4"/><path d="M7 11h10m-1-1v3"/><rect x="8" y="15" width="8" height="4" rx="1.5"/>',
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
const gmDraftKey=id=>'forja.gmNoteDraft.'+id;
function readGmNoteDraft(id){
  if(!id)return undefined;
  if(gmNoteDrafts.has(id))return gmNoteDrafts.get(id);
  try{
    const saved=globalThis.sessionStorage?.getItem(gmDraftKey(id));
    if(typeof saved==='string'){gmNoteDrafts.set(id,saved);return saved;}
  }catch{}
  return undefined;
}
function writeGmNoteDraft(id,value){
  if(!id)return;
  gmNoteDrafts.set(id,value);
  try{globalThis.sessionStorage?.setItem(gmDraftKey(id),value);}catch{}
}
function clearGmNoteDraft(id){
  if(!id)return;
  gmNoteDrafts.delete(id);
  try{globalThis.sessionStorage?.removeItem(gmDraftKey(id));}catch{}
}
function hasUnsavedGmNoteDraft(){
  if(!current?.master||!current.id)return false;
  const draft=readGmNoteDraft(current.id);
  return typeof draft==='string'&&draft!==(current.state?.notes||'');
}
let sheetId='',sheetViewer='';
let sheetView;
const portraitCache=new Map();
let portraitIdentity;
let epoch = 0;
let noticeTimer;
let audioSyncing=false,campaignRefresh=null;
let campaignEtag={key:'',value:''};
const campaignEtagKey=(access=credentials,sceneId=current.master?access?.sceneId||gmSceneId:'')=>
  access?.id&&access?.key?access.id+'\0'+access.key+'\0'+(sceneId||''):'';
function clearCampaignEtag(){campaignEtag={key:'',value:''};}
let reconnectingAccess=null;
let checkingBrowserSession=false,entryError='',openingCampaign=0;
const invitePattern=/^#mesa=([\da-f-]{36})\.([\da-f]{40}|[\da-f]{64})$/;
let rollIdentity='',latestRollRevision=-1,latestRollVersion='',latestMessageRevision=-1,latestMessageVersion='';
let sceneRevision=-1,sceneIdentity='';
let checkStamp='';
let sceneSelectionVersion=0,scenePanelSignature='';
let gmSceneId='',sceneUI={open:false,session:'all',query:''};
const sheetMosaic=createSheetMosaic({render,report:toast});
const resourceAnimations=createResourceAnimations();
const diceDisplay=createDiceDisplay($('#dice-display'));
let preloadSession=null,preloadStatus=null;
const preloadBlobs=new Map();
function cachedMedia(id){return preloadSession?.owner===credentials&&preloadBlobs.get(id);}
async function mediaCheckSync(check,access){
 if(current.master){
   preloadStatus=check;
   const list=dialog.querySelector('[data-media-check]');
   if(list)list.innerHTML=(check?.players||[]).map(p=>'<p>'+esc(p.name)+' · '+esc(p.status)+'</p>').join('')||'Nenhum participante confirmado.';
   return;
 }
 if(!check){preloadSession=null;preloadBlobs.clear();return;}
 if(preloadSession?.owner===access&&preloadSession.id===check.id)return;
 const session=preloadSession={owner:access,id:check.id};preloadBlobs.clear();
 let status='Carregado';
 try{for(const id of check.assets){
   const blob=await request('/'+access.id+'/asset/'+id,{},access).then(r=>r.blob());
   if(preloadSession!==session||credentials!==access)return;
   preloadBlobs.set(id,blob);
 }}catch{status='Falhou';}
 if(preloadSession===session&&credentials===access)try{await post('/'+access.id+'/action',{action:'mediaCheckReport',data:{id:check.id,status}},access);}catch{if(preloadSession===session)preloadSession=null;}
}
const cinematicStage=createCinematicStage($('#cinematic-stage'),{
  load:(id,signal)=>cachedMedia(id)?Promise.resolve(cachedMedia(id)):request(campaignPath()+'/asset/'+id,{signal}).then(r=>r.blob()),
  trackVolume:()=>audioPlayer.musicVolume/100,trackEnabled:()=>audioPlayer.enabled&&!audioPlayer.blocked,
  stop:id=>action('cinematicStop',{id}),report:toast
});
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
const speechTimers=new Map();
function showSpeech(ids,active){
  const affected=new Set(ids);
  for(const node of main.querySelectorAll('[data-table-token]')){
    if(affected.has(node.dataset.tableToken))node.classList.toggle('is-speaking',active);
  }
  for(const id of affected){
    clearTimeout(speechTimers.get(id));speechTimers.delete(id);
    if(active)speechTimers.set(id,setTimeout(()=>showSpeech([id],false),2600));
  }
}
function micLabel(){return mic.session?(mic.session.stream?'Desativar microfone do token':'Cancelar ativação do microfone'):'Animar token por fala';}
const mic=createTokenMicrophone({
  publish:(identity,active)=>post('/'+identity.access.id+'/voice',{active,sceneId:identity.scene,...(identity.tokenId?{tokenId:identity.tokenId}:{})},identity.access),
  changed(){
    const button=main.querySelector('[data-act=tokenMicrophone]');
    if(button){button.textContent=micLabel();button.setAttribute('aria-pressed',String(!!mic.session));}
    if(current.characterId)showSpeech(current.state.tokens.filter(t=>t.characterId===current.characterId).map(t=>t.id),!!mic.session?.active);
  },
  failed:message=>toast(message)
});
globalThis.addEventListener?.('pagehide',()=>mic.stop());
const tableLive=createTableLive({request,onEvent:receiveTableEvent,onStatus:status=>tabletop.setConnectionStatus?.(status)});
const tabletop = createTabletop({
  microphoneControl:()=>'<button type="button" class="btn small mic-token" data-act="tokenMicrophone" aria-pressed="'+!!mic.session+'">'+micLabel()+'</button>',
  action,
  realtime:event=>{if(!current.master||current.state.sceneId===current.state.activeSceneId)tableLive.send({...event,sceneId:current.state.sceneId});},
  openCharacter:openSheet,
  quickInspect:id=>openQuickDrawer(id,'summary'),
  uploadTokenPortraits,
  openLoot:id=>handlers.lootOpen(id),
  placePoint:openPointPlacement,explorationChanged:scheduleMotionSync,
  confirm:confirmTableAction,
  report:toast,
  requestAsset:id=>cachedMedia(id)?Promise.resolve(new Response(cachedMedia(id))):request(campaignPath()+'/asset/'+id)
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
  const {allowNotModified=false,...fetchOptions}=options;
  const headers = new Headers(fetchOptions.headers);
  if (access?.key) headers.set('Authorization','Bearer '+access.key);
  if(access?.id===credentials?.id&&access?.key===credentials?.key&&current.master&&gmSceneId&&/^\/[^/?]+(?:\/(?:sync|events))?(?:\?|$)/.test(path)){const url=new URL(path,'http://forja');if(!url.searchParams.has('scene'))url.searchParams.set('scene',access.sceneId||gmSceneId);path=url.pathname+url.search;}
  const response = await fetch('/api/campaigns'+path,{...fetchOptions,headers});
  if (allowNotModified && response.status === 304) return response;
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
  if(sceneIdentity!==nextSceneIdentity||(row.state?.sceneId||'')!==(current.state?.sceneId||''))clearCampaignEtag();
  if(sceneIdentity===nextSceneIdentity&&row.rev<latestRollRevision)row={...row,state:{...row.state,rolls:current.state.rolls}};
  if(sceneIdentity===nextSceneIdentity&&row.rev<latestMessageRevision)row={...row,state:{...row.state,messages:current.state.messages}};
  if(sceneIdentity!==nextSceneIdentity){preloadStatus=null;preloadSession=null;preloadBlobs.clear();checkStamp='';sceneIdentity=nextSceneIdentity;sceneRevision=-1;gmSceneId='';sceneUI={open:false,session:'all',query:''};}
  if(row.rev<sceneRevision&&current.id===row.id)row={...row,state:{...row.state,checkRequests:current.state.checkRequests,sessionLog:{...row.state.sessionLog,clocks:current.state.sessionLog?.clocks||[]},table:current.state.table,tokens:current.state.tokens,map:current.state.map,scene:current.state.scene,sceneId:current.state.sceneId,activeSceneId:current.state.activeSceneId,sessionName:current.state.sessionName,sceneLibrary:current.state.sceneLibrary}};
  else {sceneRevision=row.rev;checkStamp=row.checkVersion||'';}
  if(mic.session&&(mic.session.identity.access!==credentials||(mic.session.identity.tokenId?!row.master||!row.state.tokens.some(t=>t.id===mic.session.identity.tokenId):mic.session.identity.character!==row.characterId)||mic.session.identity.scene!==row.state.sceneId))mic.stop();
  if(current.id!==row.id||current.state.sceneId!==row.state.sceneId)showSpeech([...speechTimers.keys()],false);
  current=row;cinematicStage.sync(row);updateInvestigationAlert(row);scheduleSharedExpiry(row);showInvestigationReceipt(row);
  if(sceneUI.session!=='all'&&!row.state.sceneLibrary?.sessions.some(session=>session.id===sceneUI.session))sceneUI.session='all';
  if(row.master)gmSceneId=row.state.sceneId||gmSceneId;
  stateReceivedAt=performance.now();
}

function syncTableConnection(){
  tableLive.connect(credentials&&!current.needsCharacter?{...credentials,sceneId:current.master?gmSceneId:undefined}:null);
  tabletop.setConnectionStatus?.(tableLive.status);
}
function syncClockList(){
  const host=main.querySelector('[data-clock-list]');
  if(!host?.matches?.('[data-clock-list]'))return;
  const html=clockPanel(current,gmUI(),page==='shield');
  if(host.dataset.clockMarkup===html)return;
  const previous=new Map([...host.querySelectorAll('[data-clock-face]')].map(el=>[el.dataset.clockFace,el.style.getPropertyValue('--filled')]));
  host.innerHTML=html;host.dataset.clockMarkup=html;
  for(const el of host.querySelectorAll('[data-clock-face]')){
    const old=previous.get(el.dataset.clockFace),value=el.style.getPropertyValue('--filled');
    if(old&&value!==old&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{'--filled':old},{'--filled':value}],{duration:320});
  }
}
function syncSceneOrganizer(){
  syncClockList();
  if(page==='shield'&&tableVisible()){syncPrepHeader();return;}
  if(page!=='table'||!current.master)return;
  const signature=JSON.stringify([current.state.sceneLibrary,current.state.sceneId,sceneUI]);if(signature===scenePanelSignature)return;
  if(document.activeElement?.matches?.('[data-scene-search],[data-scene-session]'))return;
  const panel=main.querySelector('[data-scene-organizer]');if(!panel?.matches?.('[data-scene-organizer]'))return;
  panel.outerHTML=renderSceneManager(currentView(),sceneUI);scenePanelSignature=signature;applyPortraits();
}
function syncCurrentTable(){
  if(!tableVisible()||current.needsCharacter||!tabletop.syncScene?.({...currentView(),rev:Math.max(current.rev,sceneRevision)}))return false;
  audioPlayer.sync(currentView());musicDock.sync(currentView());soundboardDock.sync(currentView());audioPopover.sync(currentView());observeRolls(currentView());syncSceneOrganizer();applyPortraits();return true;
}
function receiveTableEvent(event){
  if(!credentials)return;
  if(event.type==='voice'){if(event.sceneId===current.state.sceneId&&tableVisible())showSpeech(event.ids,event.active);return;}
  if(event.type==='scene'){
    if(event.id!==current.id||event.rev<sceneRevision)return;
    if(current.master&&gmSceneId===current.state.activeSceneId&&event.state?.activeSceneId&&gmSceneId!==event.state.activeSceneId){void viewScene(event.state.activeSceneId);return;}
    if(current.master&&gmSceneId&&event.state?.sceneId!==gmSceneId&&event.state?.sceneLibrary?.scenes.some(scene=>scene.id===gmSceneId))return;
    if(event.checkVersion&&event.state?.checkRequests)checkStamp=event.checkVersion;
    const changedScene=event.state?.sceneId!==current.state.sceneId;
    if(changedScene){mic.stop();showSpeech([...speechTimers.keys()],false);}
    sceneRevision=event.rev;
    current={...current,state:{...current.state,...event.state}};
    if(event.state?.sessionClocks&&current.state.sessionLog){
      current.state.sessionLog={...current.state.sessionLog,clocks:event.state.sessionClocks};syncClockList();
    }
    if(current.master&&event.state?.sceneId)gmSceneId=event.state.sceneId;
    const row={...currentView(),rev:event.rev,rollVersion:event.rollVersion,messageVersion:event.messageVersion,checkVersion:checkStamp};
    observeRolls(row);updateInvestigationAlert(current);showInvestigationReceipt(row);
    if(tableVisible()){if(!tabletop.syncScene?.(row)&&(changedScene||!tabletop.isInteracting()&&!dialog.open))render();else syncSceneOrganizer();}
    if(event.needsCharacter!==undefined&&(event.needsCharacter!==current.needsCharacter||event.characterId!==current.characterId))refresh();
  }else if(event.type==='tokenPreview'&&tableVisible()&&(!event.sceneId||event.sceneId===current.state.sceneId))tabletop.receiveRealtime?.(event);
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

async function openCampaign(access,{automatic=false}={}) {
  const version=++epoch;
  openingCampaign=version;
  checkingBrowserSession=false;
  reconnectingAccess=access;
  if(!credentials&&!automatic){entryError='';render();}
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  const fetchEntry=(path,options,identity)=>request(path,{...options,signal:controller.signal},identity);
  try{
    const restored=await restoreCampaignIdentity(access,{
      request:fetchEntry,
      post:(path,data,identity)=>fetchEntry(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)},identity).then(r=>r.json()),
      read,write:(key,value)=>accessStorage.write(key,value),
      makeKey:()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')
    });
    if(epoch!==version)return;
    reconnectingAccess=null;entryError='';
    credentials=restored.access;
    setCurrent(restored.row);
    sheetId='';
    remember(restored.row,credentials);
    if(invitePattern.test(location.hash))history.replaceState(null,'',location.pathname+location.search);
    render();
  }catch(error){
    if(epoch!==version)return;
    if(!credentials){
      const message=error.status===403||error.status===404?'O acesso ou a campanha está indisponível. Confira o convite com o mestre ou use seu código de recuperação.':
        'A conexão com o servidor falhou. Confira sua rede e tente novamente.';
      if(message!==entryError){entryError=message;render();}
    }else reconnectingAccess=null;
    throw error;
  }finally{clearTimeout(timeout);if(openingCampaign===version)openingCampaign=0;}
}

async function createCampaign(name,withExample=false,resetPage=true,ruleset='free',sheetModel='standard') {
  ++epoch;
  const row = await post('',{name,example:false,ruleset,sheetModel},null);
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
  if(row.rev<current.rev)return ['lootCollect','checkRespond','exploreInvestigate'].includes(name)?row:undefined;
  if(current.master&&gmSceneId===current.state.activeSceneId&&row.state.activeSceneId&&row.state.activeSceneId!==gmSceneId){await viewScene(row.state.activeSceneId);return row;}
  if(current.master&&gmSceneId&&row.state.sceneId!==gmSceneId&&row.state.sceneLibrary?.scenes.some(scene=>scene.id===gmSceneId)){refresh();return row;}
  setCurrent(row);
  if(name==='journalSave'&&data.canvasPoint){gmView.folder='';gmView.prepQuery='';gmView.selectedNotes=[row.state.journal.at(-1).id];}
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
  const hasCharacters=state.characters.some(c=>c.characterType!=='npc');
  const guidance=available.length?'Selecione uma ficha disponível ou crie seu personagem.':
    hasCharacters?'As fichas visíveis já estão vinculadas. Crie seu personagem ou recupere sua ficha com seu código privado.':'Crie seu personagem para começar a jogar nesta campanha.';
  return head('Escolha seu personagem',guidance,
    button('Já tenho um personagem','campaignRecover','small')+(state.sheetModelVersion?'':button('Usar modelo salvo','sheetTemplates','small'))+button('Criar meu personagem','character','primary','plus'))+
    '<div class="card-grid">'+available.map((character,i)=>
      '<button class="card character-card" data-act="characterClaim" data-id="'+esc(character.id)+'">'+avatar(character,i)+
      '<span><strong>'+esc(character.name)+'</strong><p class="muted">'+esc(character.concept||'Personagem disponível')+'</p></span></button>'
    ).join('')+'</div>';
}

function head(title,desc,actions='') {
  return '<div class="page-head"><div><h1>'+title+'</h1><p class="subtitle">'+desc+'</p></div><div class="actions">'+actions+'</div></div>';
}

function home(state) {
  const playerSheets=(state.characters||[]).filter(c=>c.characterType!=='npc'&&!c.hidden);
  const claimedCount=playerSheets.filter(c=>c.claimed).length;
  const availableCount=Math.max(0,playerSheets.length-claimedCount);
  const partySummary=current.master&&playerSheets.length
    ?'<p class="muted">'+claimedCount+'/'+playerSheets.length+' ficha(s) de jogador vinculada(s)'+(availableCount?' · '+availableCount+' disponível(is) para convite':'')+'.</p>'
    :'';
  return '<section class="hero"><div class="hero-copy"><span class="hero-tag">✧ '+esc(state.system||'Sistema livre')+'</span><h1>'+esc(state.name)+'</h1>'+
    (state.description?'<p>'+esc(state.description)+'</p>':'<p>Cena atual · '+esc(state.scene)+'</p>')+partySummary+
    '<div class="actions">'+button('Abrir mesa virtual','nav','primary','arrow','table')+(current.master?button('Convidar jogadores','invite','','invite')+button('Editar campanha','settings'):'')+'</div></div></section>'+
    recapPanel(current,gmUI())+
    '<section class="block"><div class="section-head"><h2>Ferramentas da campanha</h2></div><div class="feature-grid">'+Object.keys(pages).filter(key=>key!=='home'&&(key!=='shield'||current.master)).map(feature).join('')+'</div></section>'+
    '<section class="block"><div class="section-head"><h2>Personagens</h2>'+button('Ver fichas','nav','ghost small','arrow','sheets')+'</div>'+characterCards([...state.characters].sort((a,b)=>Number(b.id===current.characterId)-Number(a.id===current.characterId)).slice(0,3))+'</section>';
}

function rollDetails(roll) {
  const dice = roll.groups
    ? roll.groups.map(group=>(group.sign<0?'−':'')+group.dice.length+'d'+group.faces+' ['+group.dice.join(', ')+']'+(group.kept?' → '+group.kept.join(', '):'')).join(' · ')
    : roll.dice.join(', ');
  return (roll.mastery?esc(roll.mastery.name)+' '+esc(roll.mastery.die)+' · ':'')+dice+(roll.modifier?' · '+(roll.modifier>0?'+':'')+roll.modifier:'');
}

function rollListItem(roll, showActor=false, detailed=true) {
  const view=currentView(),badge=rollVisibilityBadge(roll);
  const title=showActor?roll.actor:(roll.label||roll.expression||roll.formula);
  const info=showActor
    ? (roll.label?esc(roll.label)+' · ':'')+esc(roll.expression||roll.formula)+(roll.expression?' = '+esc(roll.formula):'')+' · '+rollDetails(roll)
    : (detailed&&roll.expression?esc(roll.formula)+' · ':'')+rollDetails(roll);
  const repeat=canRepeatRoll(roll,view)?'<button type="button" class="btn small ghost roll-repeat-btn" data-act="rollRepeat" data-id="'+esc(roll.id)+'">↻ Rolar novamente</button>':'';
  return '<li class="'+(badge.privateRoll?'is-private':'')+(badge.secret?' is-secret':'')+'"><div><div class="roll-list-meta"><b>'+esc(title)+'</b><span class="roll-feed-privacy'+(badge.secret?' is-secret':'')+'">'+badge.label+'</span></div><div class="muted">'+info+'</div></div><div class="roll-list-side"><strong>'+esc(roll.total)+'</strong>'+repeat+'</div></li>';
}

function dice(state, visibility=current.master?'gm':'public') {
  return '<section class="panel"><h2>Dados</h2><form class="stack" data-form="roll">'+input('formula','Expressão','1d20','text','required maxlength="'+rollFormulaLimit+'"')+
    input('actor','Nome na rolagem',read('forja.actor')||(current.master?'Mestre':'Jogador'),'text','maxlength="60"')+
    select('visibility','Visibilidade da rolagem',rollVisibilityOptions(current.master),['public','gm'].includes(visibility)?visibility:(current.master?'gm':'public'))+
    submit('Rolar dados')+'</form></section><section class="panel"><h2>Histórico</h2>'+
    (state.rolls.length?'<ul class="roll-list">'+state.rolls.map(r=>rollListItem(r,true,true)).join('')+'</ul>':'<p class="muted">As rolagens da mesa aparecem aqui.</p>')+'</section>';
}

function table() {
  return renderSceneManager(currentView(),sceneUI)+'<div data-clock-list>'+clockPanel(current,gmUI())+'</div>'+tabletop.render(currentView());
}

function setSessionMaterial(key,attached){
  if(!current.master)return;
  const split=key.indexOf(':'),session=prepSession(current,gmView);
  if(session)return action('sessionMaterial',{sessionId:session.id,kind:key.slice(0,split),id:key.slice(split+1),attached});
}
function gmUI(){return {esc,button,input,area,select,submit,head};}
function gmCard(id){return current.state.gmScreen?.cards.find(card=>card.id===id);}
let expandedTable=false;
function setExpandedTable(value){
  expandedTable=value;
  document.documentElement.classList.toggle('table-expanded',value);
}
function leaveExpandedTable(){
  if(!expandedTable)return;
  setExpandedTable(false);
  if(document.fullscreenElement===document.documentElement)document.exitFullscreen().catch(()=>{});
}
document.addEventListener('fullscreenchange',()=>{
  if(expandedTable&&!document.fullscreenElement)setExpandedTable(false);
});
document.addEventListener('keydown',event=>{
  if(expandedTable&&event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('dialog[open], :popover-open, #dice-display:not([hidden])'))leaveExpandedTable();
});
function tableVisible(){return page==='table'||page==='shield'&&current.master&&gmView.map===current.state.sceneId&&Boolean(gmView.map);}
function prepMapControls(){
  const session=prepSession(current,gmView),refs=session?.materials||[];
  const buttons=refs.flatMap(ref=>{
    const entry=ref.kind==='character'?current.state.characters.find(c=>c.id===ref.id):ref.kind==='item'?current.state.inventory?.find(i=>i.id===ref.id):current.state.journal?.find(n=>n.id===ref.id);
    return entry?[button(ref.kind==='character'?'Colocar '+entry.name:ref.kind==='item'?'Colocar '+entry.name:'Ler '+entry.title,{character:'prepToken',item:'lootPlace',note:'prepRead'}[ref.kind],'small','',entry.id)]:[];
  });
  const live=current.state.sceneId===current.state.activeSceneId;
  const active=current.state.sceneLibrary?.scenes.find(scene=>scene.id===current.state.activeSceneId);
  const audience=live?'Cena ao vivo. Alterações no mapa e na iniciativa são compartilhadas com os jogadores.':
    'Mapa e iniciativa privados. '+(active?'Os jogadores continuam em <strong>'+esc(active.name)+'</strong>. ':'')+'As fichas dos personagens são compartilhadas entre cenas.';
  return button('Verificar carregamento','mediaCheckDesk','small')+button('‹ Voltar ao roteiro','prepReturn','small')+'<h2>'+esc(current.state.sessionName)+' · '+esc(current.state.scene)+'</h2><p>'+audience+'</p>'+
    (live?button('Preparar uma cópia privada','prepMapCopy','small','',current.state.sceneId):button('Mostrar esta cena aos jogadores','sceneActivate','small','',current.state.sceneId))+
    '<details data-prep-tools><summary>Materiais do roteiro</summary><div class="actions">'+buttons.join('')+button('Criar NPC','prepNpc','small','plus')+button('Criar item','prepItem','small','plus')+'</div></details>';
}
function syncPrepHeader(){
 const host=main.querySelector('[data-prep-header]');if(!host)return;
 const html=prepMapControls();if(host.dataset.signature===html)return;
 const open=host.querySelector('details')?.open;host.innerHTML=html;host.dataset.signature=html;
 if(open)host.querySelector('details').open=true;
}
function prepNoteContent(note){
 const id=note.id;
    const linked=(note.characterIds||[]).map(key=>current.state.characters.find(c=>c.id===key)).filter(Boolean).map(c=>button(c.name,'prepOpenSheet','small','',c.id)).concat((current.state.inventory||[]).filter(i=>!i.characterId&&i.journalId===id).map(i=>button(i.name,'itemOpen','small','',i.id)));
    return '<div data-open-note="'+esc(id)+'">'+(gmView.trail?.length?button('‹ Nota anterior','prepBack','small'):'')+'</div>'+noteReader(note,current.state.journal,gmUI())+(note.sourcePath?button(note.inJournal?'Retirar do diário':'Adicionar ao diário','vaultMembership','small','',id):'')+(current.state.gmScreen?.cards?.some(card=>card.targetKind==='journal'&&card.targetId===id&&card.pinned)?'<small>Fixada no escudo</small>':button('Fixar no escudo','vaultPin','small','',id))+'<section><h3>Materiais da nota</h3><div class="actions">'+linked.join('')+button('Criar NPC desta nota','prepNpc','small','',id)+button('Criar item desta nota','prepItem','small','',id)+'</div></section>';
}
function ensureGmView(){
  if(gmIdentity!==current.id){gmIdentity=current.id;gmView={query:'',category:'all'};}
}
function shield() {
  ensureGmView();
  if(tableVisible())return '<section class="panel prep-map-header" data-prep-header>'+prepMapControls()+'</section>'+tabletop.render(currentView());
  const note=gmView.prepTab==='note'&&current.state.journal?.find(n=>n.id===gmView.openNote);
  const vaultReader=note?'<section class="panel vault-reader" tabindex="-1" data-vault-reader><header><h2>'+esc(note.title)+'</h2>'+button('Fechar leitura','vaultClose','small')+'</header>'+prepNoteContent(note)+'</section>':'';
  return renderGmScreen(currentView(),gmUI(),{sessionTools:'<div data-clock-list>'+clockPanel(current,gmUI(),true)+'</div>'+recapPanel(current,gmUI(),true,gmView.recapFilter),...gmView,vaultReader,notes:readGmNoteDraft(current.id)});
}

function eligibleCheckSheets(){
  return current.state.characters.filter(c=>c.claimed&&!c.hidden&&c.characterType!=='npc');
}
function checkRecipientFields(key,mode='sheet',allowFallback=false){
  const all=eligibleCheckSheets();
  if(mode==='free')return all.map(c=>'<label class="check"><input type="checkbox" name="recipients" value="'+esc(c.id)+'" checked>'+esc(c.name)+'</label>').join('');
  const sheets=allowFallback?all:all.filter(c=>sheetRequestOptions(current.state,c).filter(o=>o.key===key).length===1);
  return sheets.map(c=>{
    const hasMatch=sheetRequestOptions(current.state,c).filter(o=>o.key===key).length===1;
    return '<label class="check"><input type="checkbox" name="recipients" value="'+esc(c.id)+'" checked>'+esc(c.name)+(!hasMatch&&allowFallback?' <small class="muted">· 1d20 puro</small>':'')+'</label>';
  }).join('');
}
function helpText(help){
  return help?'<small>Ajuda de '+esc(help.name)+' · '+esc(help.reason)+(help.effect?' · '+(help.effect==='advantage'?'vantagem':'+'+esc(help.effect)):' · aguardando o mestre')+'</small>':'';
}
function checkCards(row){
  const checks=row.state.checkRequests||[];
  if(row.master)return checks.map(check=>'<article class="check-card"><header><strong>'+esc(check.label)+'</strong><small>'+check.targets.filter(t=>t.result).length+'/'+check.targets.length+' responderam</small></header>'+
    (check.dc!=null?'<small>CD '+esc(check.dc)+'</small>':'')+
    '<ul>'+check.targets.map(t=>'<li>'+esc(t.name)+' · '+(t.result?'<strong>'+esc(t.result.total)+'</strong> <small>('+esc(t.result.formula)+')</small>'+(check.dc!=null?(t.result.total>=check.dc?' · atingiu a CD':' · abaixo da CD'):''):'Aguardando')+helpText(t.help)+(t.help&&!t.help.effect&&!t.result?button('Avaliar ajuda','assistDecide','small','',check.id+'/'+t.characterId):'')+(!t.result&&(!t.help||t.help.effect)?button('Registrar dados físicos','checkPhysical','small','',check.id+'/'+t.characterId):'')+'</li>').join('')+'</ul>'+
    button('Encerrar pedido','checkClose','small','',check.id)+'</article>').join('');
  const own=current.state.characters.find(c=>c.id===row.characterId&&c.access==='full');
  if(!own)return '';
  return checks.map(check=>{
    const offers=(check.allies||[]).map(a=>'<article class="check-card"><strong>'+esc(check.label)+'</strong>'+ (a.offered?'<small>'+esc(a.name)+' · '+(a.effect?'Ajuda aceita':'Oferta enviada ao mestre')+'</small>':button('Ajudar '+a.name,'assistOffer','small','',check.id+'/'+a.id))+'</article>').join('');
    const target=check.targets[0];if(!target)return offers;
    if(target.result)return offers+'<details class="check-card"><summary>'+esc(check.label)+' · Resultado '+esc(target.result.total)+'</summary><p>'+esc(target.result.formula)+(target.result.physical?'':' · '+rollDetails(target.result))+helpText(target.help)+'</p></details>';
    let test;
    try{test=resolveSheetFormula(requestedTest(current.state,own,target).formula,current.state,own);}catch{}
    const mastery=(own.masteries||[]).filter(m=>m.remaining>0&&test?.bindings.some(f=>f.id===m.attributeId));
    return offers+'<article class="check-card" data-check-id="'+esc(check.id)+'"><header><strong>'+esc(check.label)+'</strong><small>Teste pedido pelo mestre</small></header>'+
      (test?'<p>'+esc(test.formula)+(check.dc!=null?' · CD '+esc(check.dc):'')+'</p>'+
       (mastery.length?select('checkMastery','Maestria',Object.fromEntries([['','Sem maestria'],...mastery.map(m=>[m.id,m.name+' + '+m.die])]),''):'')+
       helpText(target.help)+(target.help&&!target.help.effect?'':button('Rolar','checkRespond','small primary','',check.id)):'<p>Este teste foi removido da sua ficha. Avise o mestre.</p>')+'</article>';
  }).join('');
}
function syncCheckCards(row){
  const host=row.master?main.querySelector('[data-gm-checks]'):$('#check-inbox');
  if(!host)return;
  const html=row.id&&!row.needsCharacter?checkCards(row):'';
  if(host.dataset?.content===html)return;
  host.innerHTML=html;host.hidden=!html;
  if(host.dataset)host.dataset.content=html;
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
    sheetView={editing:true,tab:'skills',query:'',favorites:false,dice:[],formula:'',bonus:'',visibility:current.master?'gm':'public',rollMode:'normal',mastery:'',layoutView:read('forja.sheet.reading.'+(current.master?'master':'player'))||(current.master?'standard':character.appearance?'custom':'standard')};
  }
  gmView.sheetReturn=page==='shield'&&current.master?id:'';
  sheetId=id;
  page='sheets';
  render();
  main.focus({preventScroll:true});
  window.scrollTo({top:0});
}

function openQuickDrawer(id, tab='summary') {
  const viewRow=currentView();
  const character=(viewRow.state.characters||[]).find(c=>c.id===id);
  if (!character) return;
  const full=Boolean(viewRow.master||character.access==='full');
  const allowedTabs=full?['summary','skills','inventory','journal']:['summary','journal'];
  const activeTab=allowedTabs.includes(tab)?tab:'summary';
  const tabLabels={summary:'Resumo',skills:'Perícias e habilidades',inventory:'Inventário',journal:'Diário'};
  const nav='<div class="quick-drawer-tabs" role="tablist" aria-label="Consulta rápida da ficha">'+allowedTabs.map(key=>
    '<button type="button" class="btn small'+(key===activeTab?' primary':' ghost')+'" role="tab" aria-selected="'+(key===activeTab)+'" data-act="quickDrawerTab" data-id="'+esc(character.id+'/'+key)+'">'+tabLabels[key]+'</button>'
  ).join('')+'</div>';
  let body='';
  if (activeTab==='summary') {
    const tokenOnMap=(viewRow.state.tokens||[]).find(t=>t.characterId===character.id);
    const activeConds=tokenOnMap?conditionSummary(tokenOnMap):'';
    const header='<div class="quick-drawer-head"><strong>'+esc(character.name)+'</strong>'+(character.concept?'<small class="muted">'+esc(character.concept)+'</small>':'')+(activeConds?'<small>Condições: '+esc(activeConds)+'</small>':'')+'</div>';
    if (!full) {
      body=header+'<p class="muted">Visualização pública do aliado. Atributos e recursos privados permanecem ocultos.</p>';
    } else {
      const fields=sheetFields(viewRow.state,character);
      const cards=fields.map(field=>{
        const raw=sheetValue(character,field);
        const display=field.type==='check'?(raw==='true'?'✓ Marcado':'□ Desmarcado'):(raw||'—');
        return '<div class="quick-drawer-card"><small>'+esc(field.label)+'</small><strong>'+esc(display)+'</strong></div>';
      }).join('');
      body=header+(cards?'<div class="quick-drawer-grid">'+cards+'</div>':'<p class="muted">Nenhum campo preenchido nesta ficha.</p>');
    }
  } else if (activeTab==='skills') {
    const skills=(character.skills||[]).map(skill=>{
      const {total}=skillValues(character,skill,viewRow.state);
      const signed=(total>=0?'+':'')+total;
      return '<li><span><strong>'+esc(skill.name)+'</strong></span><button type="button" class="btn small" data-act="quickSkillRoll" data-id="'+esc(character.id+'/'+skill.id)+'">Rolar '+signed+'</button></li>';
    }).join('');
    const abilities=(character.abilities||[]).map(ab=>
      '<li><div><strong>'+esc(ab.name)+'</strong>'+(ab.description?'<p class="muted">'+esc(ab.description)+'</p>':'')+'</div></li>'
    ).join('');
    body='<section class="quick-drawer-section"><h3>Perícias</h3>'+(skills?'<ul class="quick-drawer-list">'+skills+'</ul>':'<p class="muted">Nenhuma perícia cadastrada.</p>')+'</section>'+
      '<section class="quick-drawer-section"><h3>Habilidades e magias</h3>'+(abilities?'<ul class="quick-drawer-list">'+abilities+'</ul>':'<p class="muted">Nenhuma habilidade cadastrada.</p>')+'</section>';
  } else if (activeTab==='inventory') {
    const items=(viewRow.state.inventory||[]).filter(item=>item.characterId===character.id);
    body=items.length
      ?'<ul class="quick-drawer-list">'+items.map(item=>'<li><div><strong>'+esc(item.name)+'</strong><small class="muted">Qtd. '+esc(item.quantity??1)+(item.equipped?' · Equipado':'')+'</small></div>'+button('Ver','itemOpen','small','',item.id)+'</li>').join('')+'</ul>'
      :'<p class="muted">Nenhum item no inventário deste personagem.</p>';
  } else if (activeTab==='journal') {
    const notes=(viewRow.state.journal||[]).filter(note=>(note.characterIds||[]).includes(character.id));
    body=notes.length
      ?'<ul class="quick-drawer-list">'+notes.map(note=>'<li><div><strong>'+esc(note.title||'Sem título')+'</strong>'+(note.body?'<p class="muted">'+esc(note.body.slice(0,220))+(note.body.length>220?'…':'')+'</p>':'')+'</div></li>').join('')+'</ul>'
      :'<p class="muted">Nenhuma nota do diário vinculada a este personagem.</p>';
  }
  const footer='<div class="actions quick-drawer-footer">'+(full?'<button type="button" class="btn primary small" data-act="quickOpenFullSheet" data-id="'+esc(character.id)+'">Abrir ficha completa ↗</button>':'')+'<button type="button" class="btn small" data-act="close">Fechar</button></div>';
  modal(esc(character.name)+' · Consulta rápida',nav+'<div class="quick-drawer-body" data-quick-drawer="'+esc(character.id)+'">'+body+'</div>'+footer);
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
  const stress=bodyStressWithHead(character.bodyStress),labels=stressRegionsFor(stress?.mode);
  const marks=stress?.enabled?Object.entries(stress.regions).filter(([key,part])=>labels[key]&&part.limit>0&&part.value>=part.limit).map(([key])=>'<button class="stress-mark" data-act="bodyStressSelect" data-id="'+esc(key)+'">'+esc(labels[key])+' no limite</button>').join(''):'';
  return '<div class="sheet-portrait"><span aria-hidden="true">'+esc(character.name[0]?.toUpperCase()||'✧')+'</span>'+
    (character.portrait?'<img alt="" data-portrait="'+esc(character.portrait.id)+'" hidden>':'')+'</div>'+marks;
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
        '<button class="skill-total" type="button" data-act="sheetSkillRoll" data-id="'+esc(skill.id)+'" title="Rolar teste de '+esc(skill.name)+'" aria-label="Rolar teste de '+esc(skill.name)+'">Rolar '+(total>=0?'+':'')+total+'</button>'+
        (sheetView.editing?'<div class="skill-edit">'+button('Vínculo e opções','sheetSkill','small','',skill.id)+'</div>':'')+'</div>';
    }).join('')+'</div>' : '<p class="sheet-empty">'+(query?'Nenhuma perícia encontrada.':'Nenhuma perícia cadastrada.')+'</p>';
}

function sheetAbilitiesMarkup(character){
  const fields=character.dnd?sheetFields(current.state,character):[];
  return ((character.abilities||[]).length?character.abilities.map(ability=>{
    const spell=character.dnd&&ability.id.startsWith('spell-')?dndCatalog.find(e=>e.id===ability.id&&e.category==='spells'):null;
    const slots=spell?.level>0?dndCharacterSpellSlots(character,fields,spell.level).filter(s=>s.current>0):[];
    const showSlotPicker=slots.length>1||slots.length===1&&slots[0].level>spell.level;
    const castControls=character.dnd&&ability.id.startsWith('spell-')
      ? (showSlotPicker?'<select data-sheet-cast-slot="'+esc(ability.id)+'" aria-label="Círculo para '+esc(ability.name)+'">'+slots.map(s=>'<option value="'+s.level+'">'+s.level+'º círculo ('+s.current+'/'+s.maximum+')'+(s.level>spell.level?' · superior':'')+'</option>').join('')+'</select>':'')+
        button('Conjurar','dndCast','small primary','',character.id+'/'+ability.id)
      : '';
    return '<article class="ability-card">'+inlineValue(character,'','name',ability.name,'<h3>'+esc(ability.name)+'</h3>','nome da habilidade','name','abilities',ability.id)+
      inlineValue(character,'','long',ability.description||'','<p>'+esc(ability.description||'Adicionar descrição')+'</p>','descrição da habilidade','description','abilities',ability.id)+(ability.sourcePage?'<a class="btn small" href="'+dndBook+'#page='+ability.sourcePage+'" target="_blank" rel="noopener noreferrer">Ver no livro ↗</a>':'')+castControls+
      button('Área na mesa','abilityArea','small','',ability.id)+(sheetView.editing?button('Opções da habilidade','sheetAbility','small','',ability.id):'')+'</article>';
  }).join(''):'<p class="sheet-empty">Nenhuma habilidade cadastrada.</p>');
}

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
    select('visibility','Visibilidade da rolagem',rollVisibilityOptions(current.master),sheetView.visibility||(current.master?'gm':'public')).replace('<select ','<select data-sheet-roll-visibility ')+masteryMarkup(character)+saved+'<div class="die-grid">'+dice+'</div><form class="stack" data-form="sheetRoll">'+
    select('mode','Modo do teste de d20',{normal:'Normal',advantage:'Vantagem (melhor de 2d20)',disadvantage:'Desvantagem (pior de 2d20)'},sheetView.rollMode||'normal').replace('<select ','<select data-sheet-roll-mode ')+input('formula','Expressão',sheetView.formula,'text','data-sheet-formula required maxlength="'+rollFormulaLimit+'" placeholder="Ex. 2d6 + Força"')+
    '<div class="sheet-dice-settings">'+input('bonus','Bônus',sheetView.bonus,'number','data-sheet-bonus step="1" min="-9999" max="9999" placeholder="0"')+
    sheetControl('Remover último dado','sheetUndo','','')+'↶</button>'+
    sheetControl('Limpar rolagem','sheetClear','','')+'×</button></div>'+
    '<button class="btn primary sheet-roll-button" type="submit">'+svg('dice')+'Rolar dados</button></form>'+
    (history.length?'<section class="sheet-section"><h3>Últimas rolagens</h3><ul class="roll-list">'+history.map(roll=>rollListItem(roll,false,true)).join('')+'</ul></section>':'')+'</div></section>';
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
  if(id==='dice')return select('visibility','Visibilidade da rolagem',rollVisibilityOptions(current.master),sheetView.visibility||(current.master?'gm':'public')).replace('<select ','<select data-sheet-roll-visibility ')+sheetFreeDice(character);
  if(id==='masteries')return masteryMarkup(character);
  if(id==='history'){const history=state.rolls.filter(roll=>roll.characterId===character.id||!roll.characterId&&roll.actor===character.name).slice(0,10);return history.length?'<ul class="roll-list">'+history.map(roll=>rollListItem(roll,false,false)).join('')+'</ul>':'<p class="muted">Nenhuma rolagem deste personagem.</p>';}
  return '';
}

// The figure faces the viewer. Reflect the right limbs around x=140 for its left side.
const stressShapes={
  head:[
    'M124 27 Q123 10 140 9 Q157 10 156 27 L154 39 L146 48 Q140 52 134 48 L126 39 Z',
    'M134 52 Q140 55 146 52 L149 60 L140 65 L131 60 Z'
  ],
  torso:[
    'M129 62 L139 68 L151 62 L163 68 Q169 79 161 98 L153 111 Q140 118 127 111 L119 98 Q111 79 117 68 Z',
    'M126 115 Q140 121 154 115 L158 134 L153 145 L140 155 L127 145 L122 134 Z'
  ],
  arm:[
    'M113 67 Q104 62 98 71 L92 84 L99 92 L113 83 Z',
    'M91 86 L98 94 Q88 109 75 114 L68 107 Q74 93 91 86 Z',
    'M65 110 L72 117 Q63 131 48 137 L41 131 Q50 116 65 110 Z'
  ],
  hand:[
    'M38 133 L46 140 L39 150 L29 157 Q24 158 26 151 L31 143 L25 146 Q22 146 25 141 Z'
  ],
  leg:[
    'M121 141 L137 157 L136 172 Q135 185 129 198 L117 197 Q110 176 115 154 Z',
    'M117 201 L129 202 L128 211 L118 213 L114 208 Z',
    'M116 217 L128 215 Q130 231 123 247 L114 247 Q110 229 116 217 Z'
  ],
  foot:[
    'M114 251 L123 251 L124 260 L120 264 L102 264 Q99 261 105 257 Z'
  ]
};
function stressLevel({value,limit}) {
  if(!value)return ['clear','Sem estresse'];
  return value===limit?['full','No limite']:['marked','Com estresse'];
}
function bodyStressPanel(character) {
  const stress=bodyStressWithHead(character.bodyStress);
  if(!stress?.enabled)return '';
  const stressRegions=stressRegionsFor(stress.mode);
  const selected=Object.hasOwn(stressRegions,sheetView.stressRegion)?sheetView.stressRegion:'torso';
  const regions=Object.entries(stressRegions);
  const figure=regions.map(([key,label])=>{
    const shape=key.replace(/^(left|right)/,'').toLowerCase();
    let segments=stressShapes[shape];
    if(stress.mode!=='complex'&&shape==='arm')segments=segments.concat(stressShapes.hand);
    if(stress.mode!=='complex'&&shape==='leg')segments=segments.concat(stressShapes.foot);
    const paths=segments.map(d=>'<path d="'+d+'"/>').join('');
    return '<g class="stress-part" data-act="bodyStressSelect" data-id="'+key+'" data-level="'+stressLevel(stress.regions[key])[0]+'" data-selected="'+(key===selected)+'"'+(key.startsWith('left')?' transform="translate(280 0) scale(-1 1)"':'')+'><title>'+label+'</title>'+paths+'</g>';
  }).join('');
  const rows=regions.map(([key,label])=>{
    const part=stress.regions[key],[level,status]=stressLevel(part);
    return '<button type="button" class="stress-region" data-act="bodyStressSelect" data-id="'+key+'" data-level="'+level+'" aria-pressed="'+(key===selected)+'"><span class="stress-dot"></span><span>'+label+'</span><b>'+part.value+' / '+part.limit+'</b><small>'+status+'</small></button>';
  }).join('');
  const active=stress.regions[selected],label=stressRegions[selected];
  const step=(delta,title,disabled)=>sheetControl(title+' · '+label,'bodyStressStep',selected,'data-step="'+delta+'" '+(disabled?'disabled':''))+(delta>0?'+':'−')+'</button>';
  return '<section class="panel stress-panel"><header><h2>Estresse corporal</h2>'+(stress.regions.torso.value===stress.regions.torso.limit?'<strong class="stress-alert">Fora de ação</strong>':'')+'</header><div class="stress-layout"><div class="stress-screen"><svg viewBox="0 0 280 275" aria-hidden="true"><defs><pattern id="stress-hatch" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#863f48"/><path d="M0 5L5 0" stroke="#d78986"/></pattern></defs><g class="stress-axis"><path d="M140 2V273 M7 136H273"/><circle cx="140" cy="136" r="94"/></g>'+figure+'<g class="stress-orientation"><text x="23" y="100">D</text><text x="247" y="100">E</text></g></svg></div><div class="stress-list" data-mode="'+(stress.mode==='complex'?'complex':'simple')+'">'+rows+'</div></div><div class="stress-adjust"><strong>'+label+'</strong><div>'+step(-1,'Recuperar estresse',active.value===0)+'<output>'+active.value+' / '+active.limit+'</output>'+step(1,'Marcar estresse',active.value===active.limit)+'</div></div></section>';
}

function isResourceEditor(formName){
  return formName==='gmResourceSave'||formName==='sheetResource';
}

const resourceFormError='<p id="resource-form-error" role="alert" hidden></p>';

function validateResourceForm(form,data,focus){
  const privateResource=form.dataset.form==='gmResourceSave';
  const output=form.querySelector('#resource-form-error');
  let field='',message='';
  if(privateResource&&!data.name.trim()){
    field='name';message='Dê um nome ao recurso.';
  }else{
    for(const [key,label] of [['current','Atual'],['maximum','Máximo']]){
      const amount=Number(data[key]);
      if(!data[key].trim()||!Number.isFinite(amount)||amount<0||amount>1000000||privateResource&&!Number.isInteger(amount)){
        field=key;message='Em '+label+', informe um número '+(privateResource?'inteiro ':'')+'entre 0 e 1000000.';break;
      }
    }
    if(!field&&Number(data.current)>Number(data.maximum)){
      field='current';message='Atual precisa ser menor ou igual a Máximo ('+data.maximum+').';
    }
  }
  for(const previous of form.querySelectorAll('[aria-invalid="true"]')){
    previous.removeAttribute('aria-invalid');
    previous.removeAttribute('aria-describedby');
  }
  if(output.textContent!==message)output.textContent=message;
  output.hidden=!message;
  if(!field)return true;
  const control=form.elements.namedItem(field);
  control.setAttribute('aria-invalid','true');
  control.setAttribute('aria-describedby','resource-form-error');
  if(focus)control.focus();
  return false;
}

function restoreResourceFocus(actionName,id,step){
  const controls=[...main.querySelectorAll('[data-act='+actionName+']')].filter(control=>control.dataset.id===id&&!control.disabled);
  (controls.find(control=>Number(control.dataset.step)===step)||controls[0])?.focus({preventScroll:true});
}

function gmResourcePanel(state,character){
  const resources=state.gmResources?.[character.id]||[];
  const bars=resources.map(resource=>{
    const field={id:resource.id,label:resource.name};
    const baseKey=character.id+'/'+resource.id+'/'+resource.version;
    const editControl=button('Editar','gmResourceEdit','small','',resource.id);
    const quickBar='<div class="sheet-delta-bar">'+button('−5','gmPrivateDelta','small ghost','',baseKey+'/-5')+button('+5','gmPrivateDelta','small ghost','',baseKey+'/5')+'<form class="gm-delta-form" data-form="gmPrivateDelta"><input type="hidden" name="id" value="'+esc(character.id)+'"><input type="hidden" name="resourceId" value="'+esc(resource.id)+'"><input type="hidden" name="version" value="'+esc(resource.version)+'"><input type="number" name="amount" min="1" max="1000000" step="1" value="1" aria-label="Ajuste rápido em '+esc(resource.name)+'"><button type="submit" class="btn small ghost danger" data-sign="-1">− Dano</button><button type="submit" class="btn small ghost" data-sign="1">+ Cura</button></form></div>';
    return renderSheetResource(character,field,resource.current+'/'+resource.maximum,{
      resourceStyle:{color:resource.color,critical:true,criticalAt:20},editControl,
      inline:content=>content,
      step:(delta,icon,disabled)=>sheetControl((delta>0?'Aumentar ':'Diminuir ')+esc(resource.name),'gmResourceStep',resource.id,'data-step="'+delta+'" '+(disabled?'disabled':''))+icon+'</button>'
    })+quickBar;
  }).join('');
  return '<section class="sheet-panel"><div class="sheet-panel-header"><h2>Recursos privados do mestre</h2>'+button('Adicionar recurso privado','gmResourceEdit','small','plus')+'</div>'+ (bars?'<div class="sheet-body">'+bars+'</div>':'')+'</section>';
}

// Small line engravings share the frame color selected by the GM.
const sheetEngravings={
  medieval:'<path d="M32 5 51 12v17c0 13-9 22-19 29-10-7-19-16-19-29V12Z M32 10l14 5v14c0 10-6 18-14 24-8-6-14-14-14-24V15Z"/><path d="M32 16v25m-6-17 6-7 6 7m-14 8q0-12 8 0 8-12 8 0m-15 3h14M9 20Q0 37 17 47m38-27q9 17-8 27"/>',
  future:'<circle cx="32" cy="32" r="19" stroke-dasharray="18 4 42 6"/><ellipse cx="32" cy="32" rx="30" ry="9" transform="rotate(-32 32 32)"/><circle cx="32" cy="32" r="6"/><path d="M4 15V5h11m34 0h10v10m0 34v10H49m-34 0H5V49"/>',
  noir:'<g transform="rotate(-14 32 32)"><path d="M12 8h35v45H12z M17 13h25v23H17z M16 42h21m-21 5h13"/><path d="m20 32 6-9 4 4 4-7 6 12Z"/></g><circle cx="43" cy="39" r="11"/><path d="m51 47 10 12m-13-10 10 12"/>'
};
function emblemField(){return '<label>Enviar emblema<input name="emblemFile" type="file" accept="image/png,image/jpeg,image/webp"></label><label><input type="checkbox" name="clearEmblem"> Remover emblema atual</label>';}
async function readEmblem(data,existing){
 const file=dialog.querySelector('[name=emblemFile]')?.files?.[0];
 delete data.emblemFile;
 if(!file)return data.clearEmblem?'':existing||'';
 const bitmap=await createImageBitmap(file);
 try{
   const canvas=document.createElement('canvas'),scale=Math.min(1,64/Math.max(bitmap.width,bitmap.height));
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');
 }finally{bitmap.close();}
}
function themeMasthead(style,title,emblem){
  if(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(emblem))return '<div class="sheet-masthead"><img alt="" src="'+emblem+'"><p class="campaign-theme-name">'+esc(title)+'</p></div>';
  return '<div class="sheet-masthead"><svg aria-hidden="true" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6">'+sheetEngravings[style]+'</svg><p class="campaign-theme-name">'+esc(title)+'</p></div>';
}
function campaignThemeStart(state,showName=false){
  const base=state.sheetTheme;
  const themed=base&&['medieval','future','noir'].includes(base.style)&&/^#[0-9a-f]{6}$/i.test(base.trimColor);
  return '<div'+(themed?' class="campaign-sheet '+base.style+'" style="--frame:'+base.trimColor+';--texture-alpha:'+Math.max(0,Math.min(1,Number(base.intensity||0)/100))+'" data-texture="'+(['grain','grid','lines'].includes(base.texture)?base.texture:'')+'"':'')+'>'+(showName&&themed?themeMasthead(base.style,base.name||state.name,state.parties?.find(g=>g.id===currentSheet()?.party)?.emblem||state.partyEmblem||base.emblem):'');
}

function sheets(state) {
  const character=currentSheet();
  if (!character) return head('Fichas universais','Crie um personagem ou abra sua ficha para jogar.',
    button('Modelos salvos','sheetTemplates','small')+(current.master||!state.sheetModelVersion||state.ruleset==='dnd-2024'?button('Criar personagem D&D','dndCreate','small'):'')+(current.master?button('Grupos rivais','partyRoster','small')+button('Tema das fichas','campaignSheetTheme','small')+button('Modelo da campanha','schema')+(state.characters.some(c=>c.masteries?.length)?button('Nova sessão: renovar maestrias','sheetMasteryRefresh'):''):'')+button(current.master?'Nova ficha':'Minha ficha','character','primary','plus'))+characterCards(state.characters);
  sheetMosaic.sync(state,character,current.id+'/'+character.id+'/'+Boolean(current.master));
  const custom=sheetMosaic.editing||sheetView.layoutView==='custom';
  const viewButton=(id,label)=>'<button type="button" class="btn small '+(custom===(id==='custom')?'primary':'')+'" data-act="sheetReadingView" data-id="'+id+'" aria-pressed="'+(custom===(id==='custom'))+'" '+(sheetMosaic.editing?'disabled':'')+'>'+label+'</button>';
  const toolbar='<div class="sheet-toolbar"><div>'+button(gmView.sheetReturn===character.id?'‹ Voltar ao escudo':'‹ Todas as fichas','sheetBack','ghost small')+(current.master?(state.journal||[]).filter(n=>n.characterIds?.includes(character.id)).map(n=>button(n.title,'prepRead','small','',n.id)).join(''):'')+(!character.dnd?button('Salvar como modelo','sheetTemplateSave','small','',character.id):'')+button('Modelos salvos','sheetTemplates','small')+button('Histórico','sheetHistory','small','',character.id)+'<p class="muted sheet-campaign">'+esc(state.name)+'</p></div><div class="actions">'+viewButton('custom','Personalizada')+viewButton('standard','Padronizada')+(sheetMosaic.editing?'':button('Configurar ficha','sheetSettings','small'))+(sheetMosaic.editing?'<button type="button" class="btn small" disabled>Organizando</button>':button('Organizar blocos','sheetLayoutBegin','small'))+'</div></div>';
  const editing=custom&&sheetView.editing?'<div class="actions mosaic-data-actions">'+button('Personalizar campos','sheetFields','small')+button('Adicionar atributo','sheetFields','small','plus','number')+button('Adicionar recurso','sheetFields','small','plus','counter')+button(character.portrait?'Trocar retrato':'Enviar retrato','sheetPortrait','small')+'</div>':'';
  return toolbar+campaignThemeStart(state,true)+(custom?'<p class="sheet-view-note">Visualização personalizada · Clique nos valores para editar. Enter salva; Escape cancela. Para textos longos, use Ctrl+Enter ou saia do campo.</p>'+editing+(sheetMosaic.editing?renderSheetLayoutEditor(state,character,sheetMosaic.appearance,sheetMosaic.canUndo):'')+renderSheetMosaic(state,character,sheetMosaic.appearance,{editing:sheetMosaic.editing,renderModule:id=>sheetModuleContent(id,character,state)}):'<p class="sheet-view-note">Visualização padronizada · Clique em um valor para editar. Enter salva; Escape cancela. Recursos usam atual/máximo, como 8/10.</p><div class="sheet-stage theme-'+esc(character.color)+'" style="'+sheetThemeStyle(state,character)+'" aria-label="Ficha de '+esc(character.name)+'">'+sheetGeneral(character,state)+sheetCompetencies(character,state)+sheetDice(character,state)+'</div>')+(current.master?gmResourcePanel(state,character):'')+(character.access==='full'||current.master?bodyStressPanel(character)+sheetInventory(character,currentView(),gmUI()):'')+'</div>';
}

const themeDefaults={primary:'#b994ff',secondary:'#bd9afc'};
const theme={...themeDefaults};
try{
  const saved=JSON.parse(localStorage.getItem('forja-theme'));
  for(const key of Object.keys(theme))if(/^#[0-9a-f]{6}$/i.test(saved?.[key]))theme[key]=saved[key];
}catch{}
function applyTheme(){
  const root=document.documentElement;
  root.toggleAttribute('data-theme-custom',Object.keys(theme).some(key=>theme[key]!==themeDefaults[key]));
  root.style.setProperty('--theme-primary',theme.primary);
  root.style.setProperty('--theme-secondary',theme.secondary);
  const [r,g,b]=theme.primary.slice(1).match(/../g).map(hex=>{const n=parseInt(hex,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});
  root.style.setProperty('--theme-ink',.2126*r+.7152*g+.0722*b>.179?'#000':'#fff');
}
if(Object.keys(theme).some(key=>theme[key]!==themeDefaults[key]))applyTheme();
document.addEventListener('input',event=>{
  const key=event.target.dataset.themeColor;
  if(!Object.hasOwn(theme,key))return;
  theme[key]=event.target.value;applyTheme();
  try{localStorage.setItem('forja-theme',JSON.stringify(theme));}catch{}
});
document.addEventListener('click',event=>{
  if(!event.target.closest('[data-theme-reset]'))return;
  Object.assign(theme,themeDefaults);applyTheme();
  try{localStorage.removeItem('forja-theme');}catch{}
  render();
});
const screens = {
  settings:()=>'<h1>Configurações</h1><section class="panel"><h2>Aparência</h2><p>As cores são pessoais e ficam salvas neste navegador.</p>'+Object.entries({primary:'Cor primária · botões e ações',secondary:'Cor secundária · navegação e destaques'}).map(([key,label])=>'<label class="theme-field"><input type="color" data-theme-color="'+key+'" value="'+theme[key]+'"> '+label+'</label>').join('')+'<button class="btn" data-theme-reset>Restaurar roxo original</button></section>',
  home,
  sheets,
  table, shield, library, inventory:()=>campaignThemeStart(current.state)+sharedList('item')+renderInventory(currentView(),gmUI(),inventoryView)+'</div>', journal:()=>sharedList('note')+renderJournal(currentView(),gmUI(),journalView), audio:audioScreen
};

function campaignList() {
  const list=Object.values(read('forja.campaigns')||{});
  return list.length?'<div class="stack">'+list.map(item=>'<div class="campaign-list-row">'+button(item.name+' · '+(item.master?'Mestre':'Jogador'),'switch','','',item.id)+button(item.master?'Apagar':'Remover da lista',item.master?'campaignDelete':'campaignForget','small danger','',item.id)+'</div>').join('')+'</div>':'<p class="empty">Você ainda não tem campanhas salvas neste navegador.</p>';
}

const campaignDropdown=$('#campaign-dropdown');
function positionCampaignDropdown(){
  const anchor=$('.campaign-picker').getBoundingClientRect();
  const width=Math.min(380,innerWidth-16);
  const below=innerHeight-anchor.bottom-14,above=anchor.top-14;
  const upwards=below<180&&above>below;
  Object.assign(campaignDropdown.style,{
    width:width+'px',left:Math.max(8,Math.min(anchor.left,innerWidth-width-8))+'px',
    top:upwards?'auto':(anchor.bottom+6)+'px',bottom:upwards?(innerHeight-anchor.top+6)+'px':'auto',
    maxHeight:Math.max(0,upwards?above:below)+'px'
  });
}
campaignDropdown.addEventListener('beforetoggle',event=>{
  if(event.newState!=='open')return;
  campaignDropdown.innerHTML=campaignList()+'<div class="campaign-menu-actions">'+button('Nova campanha','create','primary small','plus')+button('Importar backup','campaignImport','small')+button('Recuperar acesso','campaignRecover','small')+'</div>';
  positionCampaignDropdown();
});
campaignDropdown.addEventListener('click',event=>{
  if(event.target.closest('[data-act]'))campaignDropdown.hidePopover();
});
function followCampaignPicker(){
  if(campaignDropdown.matches(':popover-open'))positionCampaignDropdown();
}
globalThis.addEventListener?.('resize',followCampaignPicker);
document.addEventListener('scroll',followCampaignPicker,true);

function forgetCampaign(id) {
  const list=read('forja.campaigns')||{};delete list[id];accessStorage.write('forja.campaigns',list);
  const members=read('forja.memberKeys')||{};delete members[id];accessStorage.write('forja.memberKeys',members);
  if(read('forja.active')===id)accessStorage.remove('forja.active');
  accessStorage.write('forja.forgotten',[...new Set([...(read('forja.forgotten')||[]),id])]);
  if(reconnectingAccess?.id===id)reconnectingAccess=null;
}

function renderLobby() {
  inlineSheet.cancel();cinematicStage.reset();updateInvestigationAlert(lobby);narrationDisplay.sync(lobby);syncCheckCards({...lobby,master:false});
  tableLive.disconnect();
  sheetMosaic.dispose();
  tabletop.dispose();musicLibrary.dispose();soundboardLibrary.dispose();sheetId='';
  $('#campaign-name').textContent='Escolher campanha';$('#breadcrumb').textContent='Campanhas';$('#profile').textContent='Sua mesa de RPG';
  $('#navigation').innerHTML='';$('#header-actions').innerHTML='';
  if(checkingBrowserSession||reconnectingAccess){
    const name=reconnectingAccess&&(read('forja.campaigns')||{})[reconnectingAccess.id]?.name;
    const title=name?'Entrando em '+esc(name):'Entrando na campanha';
    $('#campaign-name').textContent=name||'Conexão com a mesa';
    main.innerHTML='<section class="panel" aria-live="polite"><h1>'+title+'</h1><p>'+esc(entryError||'Conectando à mesa…')+'</p>'+
      (entryError?'<div class="actions">'+button('Tentar novamente','entryRetry','primary')+button('Recuperar acesso','campaignRecover')+button('Voltar às campanhas','entryCancel')+'</div>':'')+'</section>';
  }else main.innerHTML=head('Suas campanhas','Crie uma campanha ou abra uma das suas mesas.',button('Importar backup','campaignImport')+button('Recuperar acesso','campaignRecover')+button('Nova campanha','create','primary','plus'))+campaignList();
  audioPlayer.sync(lobby);musicDock.sync(lobby);soundboardDock.sync(lobby);audioPopover.sync(lobby);diceDisplay.sync(lobby);narrationDisplay.sync(lobby);rollIdentity='';latestRollRevision=-1;latestRollVersion='';latestMessageRevision=-1;latestMessageVersion='';applyPortraits();
}

function navigationGroups(){
  const groups=[
    [current.master?'Personagens':'Meu personagem',['sheets','inventory']],
    [current.master?'Mesa do mestre':'Minha mesa',['table',...(current.master?['shield']:[]),'home','journal','library','audio']],
    ['Preferências',['settings','campaignAccess']]
  ];
  return groups.map(([title,items])=>'<div class="nav-group" role="group" aria-label="'+title+'"><h3>'+title+'</h3>'+items.map(key=>{
    if(key==='campaignAccess')return button(current.master?'Backup e acesso':'Meu acesso','campaignAccess','nav-btn','shield');
    const [label,icon]=pages[key];
    return '<button type="button" class="nav-btn" data-act="nav" data-id="'+key+'" '+(current.needsCharacter?'disabled ':'')+(key===page?'aria-current="page"':'')+'>'+svg(icon)+'<span>'+label+'</span></button>';
  }).join('')+'</div>').join('');
}

function render() {
  if(expandedTable&&(!tableVisible()||!credentials||current.needsCharacter))leaveExpandedTable();
  if(mic.session&&(!tableVisible()||!credentials))mic.stop();
  if(inlineSheet.editing)return;
  if(!credentials) {renderLobby();return;}
  if (!current.master && page==='shield') page='home';
  const {state} = current;
  if(journalIdentity!==current.id){journalIdentity=current.id;inventoryView={scope:'',query:''};journalView={query:'',kind:'all',collapsed:[]};}
  if (sheetId&&!current.master&&!state.characters.some(character=>character.id===sheetId&&character.access==='full')) sheetId='';
  $('#campaign-name').textContent = state.name;
  $('#profile').innerHTML = current.master ? 'Mestre da mesa<small>'+'Campanha ativa'+'</small>' : esc(state.characters.find(character=>character.id===current.characterId)?.name||'Jogador')+'<small>'+(current.needsCharacter?'Escolha seu personagem':'Personagem vinculado')+'</small>';
  $('#breadcrumb').textContent = pages[page][0];
  $('#navigation').innerHTML=navigationGroups()+'<button type="button" class="nav-btn nav-more" data-act="navigationMenu" aria-haspopup="dialog">'+svg('menu')+'<span class="nav-mobile-text">Menu</span></button>';
  $('#header-actions').innerHTML = current.master?button('Cinemáticas','cinematicDesk','small')+button('Mensagem privada','narrationCompose','small')+button('Convidar jogadores','invite','','invite'):'';
  const inCanvas=page==='shield'&&gmView.prepTab==='note'&&gmView.vaultMode==='canvas';

  const focusHandle=document.activeElement?.closest('[data-vault-move],[data-size]');
  const focusNote=focusHandle?.parentElement.dataset.vaultCard;
  const previousResources=resourceAnimations.capture(main);
  tabletop.dispose();musicLibrary.dispose();soundboardLibrary.dispose();sheetMosaic.dispose();
  main.innerHTML = current.needsCharacter?chooseCharacter(state):screens[page](state);
  if(inCanvas){
    activateVaultCanvas();
    if(focusNote)main.querySelector('[data-vault-card="'+CSS.escape(focusNote)+'"] '+(focusHandle.hasAttribute('data-size')?'[data-size]':'[data-vault-move]'))?.focus({preventScroll:true});
  }
  resourceAnimations.restore(main,previousResources);
  scenePanelSignature=JSON.stringify([current.state.sceneLibrary,current.state.sceneId,sceneUI]);
  if(page==='sheets'&&currentSheet())sheetMosaic.mount(main);
  if (tableVisible()&&!current.needsCharacter) tabletop.mount(main,currentView());
  if (page==='audio'&&!current.needsCharacter){musicLibrary.mount(main,currentView());soundboardLibrary.mount(main);}
  audioPlayer.setView(page==='audio'&&!current.needsCharacter);
  audioPlayer.sync(currentView());
  musicDock.sync(currentView());soundboardDock.sync(currentView());audioPopover.sync(currentView());
  observeRolls(currentView());
  applyPortraits();
  syncTableConnection();
}

function observeRolls(row) {
  if(row.id===current.id&&Array.isArray(row.state?.checkRequests)&&row.rev>=Math.max(current.rev,sceneRevision)){
    if(row.checkVersion)checkStamp=row.checkVersion;
    current.state.checkRequests=row.state.checkRequests;
    if(row.master)syncCheckCards({...current,master:false,needsCharacter:true});
    syncCheckCards(row);
  }
  if(row.id===current.id){cinematicStage.sync(row);narrationDisplay.sync(row);}
  const identity=(row.id||'')+'/'+Boolean(row.master);
  if(identity!==rollIdentity){rollIdentity=identity;latestRollRevision=-1;latestRollVersion='';latestMessageRevision=-1;latestMessageVersion='';}
  if(row.id!==current.id)return;
  let feedUpdated=false;
  if(row.rev>=current.rev&&row.rev>=latestMessageRevision){
    if(row.messageVersion)latestMessageVersion=row.messageVersion;
    if(Array.isArray(row.state?.messages)){
      latestMessageRevision=row.rev;
      current.state.messages=row.state.messages;
      feedUpdated=true;
    }
  }
  if(row.rev>=current.rev&&row.rev>=latestRollRevision){
    if(row.rollVersion)latestRollVersion=row.rollVersion;
    if(Array.isArray(row.state?.rolls)){
      latestRollRevision=row.rev;
      current.state.rolls=row.state.rolls;
      diceDisplay.sync(row);
      feedUpdated=true;
    }
  }
  if(feedUpdated)tabletop.syncRolls({...row,state:{...row.state,rolls:current.state.rolls,messages:current.state.messages}});
}

function applyPortraits(scope=main,receiptItems=[]) {
  const access=credentials;
  const identity=access?access.id+'/'+access.key:'';
  const allowed=new Set([...receiptItems.map(i=>i.portrait?.id),...(current.state.investigationReceipts||[]).flatMap(r=>r.items.map(i=>i.portrait?.id)),...(current.state.sharing?.received||[]).map(g=>g.material?.portrait?.id),...(current.state.inventory||[]).flatMap(item=>item.portrait?.id?[item.portrait.id]:[]),...current.state.tokens.flatMap(token=>token.loot?.item?.portrait?.id?[token.loot.item.portrait.id]:[]),...current.state.tokens.flatMap(token=>token.portrait?[token.portrait.id]:[]),...current.state.characters.flatMap(c=>[c.portrait?.id,c.basePortrait?.id,c.injury?.image?.id]),...((current.master?current.state.sceneLibrary?.scenes||[]:[]).flatMap(scene=>scene.map?[scene.map.id]:[])),...(current.state.map?[current.state.map.id]:[])]);
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

let resolveTableConfirm = null;
function settleTableConfirm(confirmed) {
  const settle = resolveTableConfirm;
  resolveTableConfirm = null;
  settle?.(Boolean(confirmed));
}
dialog.addEventListener('close',()=>{if(!dialog.open)settleTableConfirm(false);});
function confirmTableAction({title,message,confirmLabel='Confirmar'}) {
  settleTableConfirm(false);
  modal(esc(title),'<p>'+esc(message)+'</p><div class="actions"><button type="button" class="btn" data-act="close">Cancelar</button><button type="submit" class="btn danger">'+esc(confirmLabel)+'</button></div>','tableConfirm');
  return new Promise(resolve=>{resolveTableConfirm=resolve;});
}

function modal(title,content,form,discovery=false) {
  settleTableConfirm(false);
  if(/^(sheet|character|dndCreate|schema$|campaignSheetTheme|bodyStressConfig|savedRoll|gmResource)/.test(form||'')||['Configurar ficha','Retrato do personagem','Modelos de fichas'].includes(title))dialog.dataset.sheetEditor='';
  else delete dialog.dataset.sheetEditor;
  delete dialog.dataset.discovery;
  const style=current?.state?.sheetTheme?.style;
  if((discovery||['Item coletado','Itens recebidos'].includes(title))&&Object.hasOwn(sheetEngravings,style))dialog.dataset.discovery=style;
  delete dialog.dataset.lootReward;
  dialog.style.removeProperty('--item-accent');
  delete dialog.dataset.inventoryId;delete dialog.dataset.inventoryVersion;delete dialog.dataset.itemView;delete dialog.dataset.sharedRead;
  $('#dialog-notice').textContent = '';
  $('#dialog-content').innerHTML = '<div class="dialog-head"><h2 id="dialog-title">'+title+'</h2><button type="button" class="btn small ghost" data-act="close" aria-label="Fechar">✕</button></div>'+
    (form?'<form class="stack" data-form="'+form+'"'+(isResourceEditor(form)?' novalidate':'')+'>'+content+'</form>':content);
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
  modal('Criar personagem D&D 2024',preparationFields(draft)+(draft.prepSession?input('prepHidden','',draft.hidden?'yes':'','hidden'):'')+(current.master?select('characterType','Tipo de ficha',{player:'Personagem de jogador',npc:'NPC · personagem do mestre'},draft.characterType||'player'):'')+dndCreation({input,select,esc,button},draft),'dndCreate');
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

function preparationFields(draft){
  return draft.prepSession?input('prepSession','',draft.prepSession,'hidden')+input('prepNote','',draft.prepNote||'','hidden'):'';
}
function editCharacter(id,presetId='',draft={}) {
  const preset=!id?sheetPreset(presetId):null;
  const character = current.state.characters.find(item=>item.id===id) || {...draft,...(preset?{layout:preset.fields}:{})};
  const groups = Map.groupBy(sheetFields(current.state,character),field=>field.group);
  modal(id?'Ficha de '+esc(character.name):draft.prepSession?'Criar NPC · '+esc(prepSession(current,gmView)?.name):'Nova ficha',
    preparationFields(draft)+
    '<input type="hidden" name="id" value="'+esc(id)+'">'+(!id&&(!current.state.sheetModelVersion||current.master)?select('preset','Modelo da ficha',{'':'Modelo da campanha',...Object.fromEntries(sheetPresets.map(p=>[p.id,p.name])),'dnd-2024':'D&D 2024 · criação guiada'},presetId).replace('<select ','<select data-character-preset ')+(preset?'<p class="muted">'+esc(preset.description)+'</p>':''):'')+'<div class="form-grid">'+input('name','Nome',character.name,'text','required maxlength="80"')+
    input('concept','Conceito ou classe',character.concept,'text','maxlength="80"')+'</div>'+(current.master?select('characterType','Tipo de ficha',{player:'Personagem de jogador',npc:'NPC · personagem do mestre'},character.characterType||'player'):'')+select('color','Cor da ficha e dos dados',colorNames,character.color)+'<p class="muted">Você pode ajustar o destaque dos dados em Configurar ficha → Cores e recursos.</p>'+
    [...groups].map(([group,fields],index)=>'<details class="character-section" '+(index===0?'open':'')+'><summary>'+esc(group)+' <small>'+fields.length+(fields.length===1?' campo':' campos')+'</small></summary><div>'+fields.map(field=>{const computed=character.dnd&&(['dd-class','dd-species','dd-background'].includes(field.id)||dndDerived(character,field.id)!==null);return fieldInput(field,String(sheetValue(character,field))).replace('<input ',computed?'<input readonly ':'<input ');}).join('')+'</div></details>').join('')+
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

const fieldMarks={number:'#',counter:'◒',text:'Aa',long:'¶',check:'✓'};
const fieldExamples={number:'Ex.: 2',counter:'Ex.: 10/10',text:'Ex.: Viajante',long:'Texto inicial (opcional)'};
function initialField(type,value){
  if(type==='check')return select('initial','Estado inicial',{false:'Desmarcado',true:'Marcado'},String(value)==='true'?'true':'false');
  return input('initial','Valor inicial',value,'text','maxlength="2000" placeholder="'+esc(fieldExamples[type])+'"');
}
function initialCaption(type,value){
  return type==='check'?(value==='true'?'Marcado':'Desmarcado'):value;
}
function schemaRow(field=newField()) {
  return '<details class="schema-card" data-field="'+esc(field.id)+'"><summary><span class="schema-mark" aria-hidden="true">'+fieldMarks[field.type]+'</span><span class="schema-caption"><strong>'+esc(field.label||'Novo campo')+'</strong><small>'+esc(field.group)+' · '+esc(fieldTypes[field.type])+'</small></span><span class="schema-value">'+esc(initialCaption(field.type,field.initial))+'</span></summary>'+
    '<div class="schema-body"><div class="form-grid">'+input('label','Nome do campo',field.label,'text','required maxlength="80"')+input('group','Seção',field.group,'text','maxlength="80"')+
    select('type','Tipo de campo',fieldTypes,field.type)+initialField(field.type,field.initial)+'</div><div class="actions">'+button('↑ Subir','fieldMove','small','','up')+button('↓ Descer','fieldMove','small','','down')+button('Remover','fieldDelete','small danger')+'</div></div></details>';
}

function openNewSchemaField(){
  const row=$('#schema-rows').lastElementChild;
  row.open=true;
  const name=row.querySelector('[name=label]');
  name.focus();
  name.select();
}

dialog.addEventListener('input',event=>{
  const row=event.target.closest('.schema-card');
  if(!row)return;
  const value=name=>row.querySelector('[name='+name+']').value;
  row.querySelector('strong').textContent=value('label')||'Novo campo';
  row.querySelector('small').textContent=(value('group')||'Geral')+' · '+fieldTypes[value('type')];
  row.querySelector('.schema-mark').textContent=fieldMarks[value('type')];
  if(event.target.name==='type'){
    const initial=row.querySelector('[name=initial]');
    initial.closest('label').outerHTML=initialField(value('type'),initial.value);
  }
  row.querySelector('.schema-value').textContent=initialCaption(value('type'),value('initial'));
});
dialog.addEventListener('paste',event=>{
  const row=event.target.closest('[data-table-entry]');
  if(!row||event.target.name!=='entryText')return;
  const lines=event.clipboardData?.getData('text/plain').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!lines||lines.length<2)return;
  event.preventDefault();
  if(row.parentElement.children.length+lines.length-1>100){toast('Use até 100 entradas.');return;}
  event.target.value=lines[0];
  row.insertAdjacentHTML('afterend',lines.slice(1).map(text=>gmTableRow({text},gmUI())).join(''));
});

dialog.addEventListener('invalid',event=>{
  const row=event.target.closest('details');
  if(row)row.open=true;
},true);

function initiativeRow(entry={name:'',value:''}) {
  return '<div class="form-grid" data-entry>'+input('name','Participante',entry.name,'text','required maxlength="80"')+
    input('value','Iniciativa',entry.value,'number','required min="-999" max="999"')+button('Remover','initiativeDelete','small danger')+'</div>';
}

function createDialog() {
  modal('Nova campanha',input('name','Nome da campanha','','text','required maxlength="100"')+
    select('sheetModel','Modelo de ficha da campanha',{standard:'Ficha universal · atributos e vitalidade',blank:'Em branco · criar meus campos',...Object.fromEntries(sheetPresets.map(p=>[p.id,p.name])),'dnd-2024':'D&D 2024 · criação guiada'},'standard')+'<p class="muted">Os jogadores começam com este modelo. Edite os campos em Fichas → Modelo da campanha.</p>'+submit('Criar campanha'),'create');
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
    : area('description','Descrição',entry?.description,'maxlength="4000"')+select('effectShape','Área de efeito',{'':'Definir ao usar',cone:'Cone de 60°',beam:'Linha',burst:'Círculo'},entry?.effectShape||'')+input('effectLength','Alcance na unidade da cena',entry?.effectLength||6,'number','min=".01" max="10000" step="any"');
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
  const resolved=resolveSheetFormula(formula,current.state,character),mastery=character.masteries?.find(m=>m.id===sheetView?.mastery&&m.remaining>0&&resolved.bindings.some(binding=>binding.id===m.attributeId));
  const visibility=['public','gm'].includes(sheetView?.visibility)?sheetView.visibility:(current.master?'gm':'public');
  return {visibility,...(mastery?{masteryId:mastery.id}:{}),...(/^1?d20(?:[+\-]|$)/i.test(resolved.formula)&&sheetView?.rollMode&&sheetView.rollMode!=='normal'?{mode:sheetView.rollMode}:{})};
}

function setSheetFormula(formula,focus=false) {
  sheetView.formula=formula;
  const field=$('[data-sheet-formula]',main);
  if (!field) return;
  field.value=formula;
  if (focus) field.focus();
}

async function uploadTokenPortraits(tokenId,fileList){
  const files=[...(fileList||[])].filter(f=>f?.size);
  if(!tokenId||!files.length)return null;
  if(files.length>12)throw new Error('Selecione até 12 imagens por vez.');
  for(const file of files){
    if(file.size>3*1024*1024)throw new Error('Cada imagem deve ter até 3 MB.');
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('Escolha imagens PNG, JPEG, WebP ou GIF.');
    await readMapDimensions(file);
  }
  await ensureCampaign();
  const access=credentials,sceneId=current.state.sceneId||'';
  let latestRow=null;
  for(const file of files){
    const response=await request(campaignPath()+'/token-portrait',{
      method:'POST',
      headers:{
        'Content-Type':file.type,
        'X-File-Name':encodeURIComponent(file.name),
        'X-Scene-Id':sceneId,
        'X-Portrait-Pool':'append',
        'X-Token-Data':encodeURIComponent(JSON.stringify({id:tokenId,sceneId}))
      },
      body:file
    },access);
    latestRow=await response.json();
    if(credentials===access&&latestRow.rev>=current.rev){setCurrent(latestRow);syncCurrentTable();}
  }
  toast(files.length===1?'Imagem adicionada ao token.':files.length+' imagens adicionadas à galeria da rota.');
  return latestRow;
}

function tableTokenForm(token={}) {
  const characters=Object.fromEntries(current.state.characters.map(character=>[character.id,character.name+' · '+(character.characterType==='npc'?'NPC':'Jogador')]));
  const hidden='<input type="hidden" name="id" value="'+esc(token.id)+'"><input type="hidden" name="sceneId" value="'+esc(current.state.sceneId)+'">';
  return hidden+select('characterId','Ficha vinculada',{'':'Token independente',...characters},token.characterId||'')+
    input('name','Nome visível aos jogadores',token.name,'text','maxlength="80" placeholder="Usar nome da ficha vinculada"')+
    '<div data-private-token-name '+(token.characterId||token.kind==='item'?'hidden':'')+'>'+input('realName','Nome verdadeiro (somente o mestre)',token.realName||'','text','maxlength="80" placeholder="Opcional"')+'</div>'+
    renderTokenAppearance(token,current.state.characters)+
    select('size','Tamanho em células',{1:'1 × 1',2:'2 × 2',3:'3 × 3',4:'4 × 4'},String(token.size||1))+
    '<fieldset class="token-vision-settings"><legend>Campo de visão</legend><label class="check"><input type="checkbox" name="visionEnabled" '+(normalizeVision(token.vision).enabled?'checked':'')+'> Este token enxerga na escuridão</label><div class="form-grid">'+input('visionRange','Alcance ('+normalizeTable(current.state).grid.unit+')',normalizeVision(token.vision).range,'number','required min="0" max="10000" step="any"')+input('visionAngle','Abertura do campo (graus)',normalizeVision(token.vision).angle,'number','required min="1" max="360" step="any"')+input('rotation','Direção (0° norte, 90° leste)',token.rotation||0,'number','required min="0" max="359" step="1"')+'</div><p class="muted">Use 360° para visão circular ou 120° para um cone. A direção pode ser alterada na mesa sem mudar o alcance.</p></fieldset>'+
    input('statuses','Condições sem prazo',token.statuses?.join(', '),'text','maxlength="148" placeholder="Ex. Ferido, Envenenado"')+
    '<p class="muted">Separe até seis condições por vírgulas.</p>'+
    '<label class="check"><input type="checkbox" name="locked" '+(token.locked?'checked':'')+'> Bloquear movimentação pelos jogadores</label>'+
    '<label class="check"><input type="checkbox" name="hidden" '+(token.hidden?'checked':'')+'> Ocultar dos jogadores</label>'+
    submit(token.id?'Salvar token':'Adicionar token')+
    (token.id?'<div>'+button('Remover token','tokenDelete','danger small','',token.id)+'</div>':'');
}

function sceneEditor(id='',preferredSession=''){
  const lib=current.state.sceneLibrary,scene=lib.scenes.find(item=>item.id===id),sessions=Object.fromEntries(lib.sessions.map(item=>[item.id,item.name]));
  modal(scene?'Editar cena':'Nova cena',input('id','',id,'hidden')+input('expectedVersion','',lib.version,'hidden')+input('name','Nome da cena',scene?.name||'','text','required maxlength="100" placeholder="Ex. Vila · praça central"')+select('sessionId','Sessão',sessions,scene?.sessionId||preferredSession||(sceneUI.session!=='all'?sceneUI.session:lib.sessions[0].id))+area('notes','Anotações privadas do mestre',scene?.notes||'','maxlength="2000"')+'<p class="muted">Criar ou preparar uma cena não muda o mapa dos jogadores.</p>'+submit(scene?'Salvar cena':'Criar e preparar')+(scene?'<div class="actions">'+button('Apagar cena','sceneDelete','small danger','',scene.id)+'</div>':''),'sceneEditor');
}
function sessionEditor(id=''){
  const lib=current.state.sceneLibrary,session=lib.sessions.find(item=>item.id===id);
  modal(session?'Editar sessão':'Nova sessão',input('id','',id,'hidden')+input('expectedVersion','',lib.version,'hidden')+input('name','Nome da sessão',session?.name||'','text','required maxlength="100" placeholder="Ex. Sessão 2 · Ecos na floresta"')+input('date','Data (opcional)',session?.date||'','date')+area('notes','Anotações privadas',session?.notes||'','maxlength="2000"')+submit(session?'Salvar sessão':'Criar sessão')+(session?'<div>'+button('Apagar sessão','sessionDelete','small danger','',session.id)+'</div>':''),'sessionEditor');
}
async function viewScene(id){
  const version=++sceneSelectionVersion;
  clearCampaignEtag();
  const access=credentials;const response=await request('/'+access.id+'?scene='+encodeURIComponent(id),{},access);
  const nextEtag=response.headers?.get?.('ETag')||'';
  const row=await response.json();
  if(credentials!==access||version!==sceneSelectionVersion)return;tabletop.dispose();sceneRevision=row.rev;gmSceneId=row.state.sceneId;setCurrent(row);
  if(nextEtag&&row.state.sceneId===id)campaignEtag={key:campaignEtagKey(access,gmSceneId),value:nextEtag};
  render();
}

function combatRow(entry={}) {
  const tokenOptions={'':'Participante sem token',...Object.fromEntries(current.state.tokens.map(token=>[token.id,token.name]))};
  return '<fieldset data-combat-entry="'+esc(entry.id||newField().id)+'"><legend>Participante</legend>'+
    select('tokenId','Token no mapa',tokenOptions,entry.tokenId||'')+
    '<div class="form-grid">'+input('name','Nome',entry.name,'text','maxlength="80" placeholder="Usar nome do token"')+
    input('value','Iniciativa',entry.value??0,'number','required min="-999" max="999" step="1"')+'</div>'+
    '<div class="actions">'+button('Rolar iniciativa','tableCombatRoll','small')+button('Remover participante','tableCombatRemove','small danger')+'</div>'+
    '<small class="muted" data-combat-roll-info></small></fieldset>';
}

function editCombat() {
  const {combat}=normalizeTable(current.state);
  modal('Combate da mesa',input('sceneId','',current.state.sceneId,'hidden')+'<p class="muted">'+combatAudience(current.state)+'</p>'+
    '<div id="combat-rows" class="stack">'+combat.entries.map(combatRow).join('')+'</div>'+
    '<div class="actions">'+button('Adicionar participante','tableCombatAdd','small','plus')+
    button('Adicionar tokens da mesa','tableCombatTokens','small')+
    button('Rolar para todos','tableCombatRollAll','small')+
    (current.state.initiative?.length?button('Importar iniciativa do escudo','tableCombatImport','small'):'')+'</div>'+
    submit('Salvar ordem de combate'),'tableCombat');
}

function rollCombatRow(rowNode) {
  if(!rowNode)return null;
  const tokenId=$('[name=tokenId]',rowNode)?.value||'';
  const token=current.state.tokens.find(t=>t.id===tokenId);
  const charId=token?tokenCharacterId(current.state,token):'';
  const character=charId?current.state.characters.find(c=>c.id===charId):null;
  const formula=initiativeRollSpec(current.state,character);
  const rolled=rollDiceFormulaLocal(formula);
  const clamped=Math.max(-999,Math.min(999,Math.trunc(rolled.total)));
  const valueInput=$('[name=value]',rowNode);
  if(valueInput)valueInput.value=String(clamped);
  const info=$('[data-combat-roll-info]',rowNode);
  if(info){
    const diceText=rolled.dice.join(', ');
    info.textContent=(character?character.name+': ':'')+rolled.formula+' → ['+diceText+']'+(rolled.modifier?(rolled.modifier>0?' + ':' − ')+Math.abs(rolled.modifier):'')+' = '+clamped;
  }
  return clamped;
}

function tokenData(data) {
  const character=current.state.characters.find(character=>character.id===data.characterId);
  return {
    id:data.id,sceneId:data.sceneId,name:data.name.trim()||character?.name||'Token',
    color:data.color,icon:data.icon||'auto',size:Number(data.size),characterId:data.characterId,...(!data.characterId?{realName:data.realName||''}:{}),
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
function clueRewards(rules={}){
 return rules.rewards??(rules.itemId?[{itemId:rules.itemId,quantity:rules.quantity,dc:rules.dc}]:[]);
}
function rewardRow(reward={}){
 const items=Object.fromEntries((current.state.inventory||[]).filter(i=>!i.characterId).map(i=>[i.id,i.name]));
 if(reward.itemId&&!items[reward.itemId])items[reward.itemId]='Item removido do catálogo';
 return '<fieldset data-clue-reward><legend>Recompensa</legend>'+select('rewardItem','Item',items,reward.itemId)+
 '<div class="form-grid">'+input('rewardDc','Resultado mínimo',reward.dc??10,'number','required min="-999" max="999"')+
 input('rewardQuantity','Quantidade',reward.quantity??1,'number','required min="1" max="999"')+'</div>'+button('Retirar recompensa','rewardRemove','small')+'</fieldset>';
}
function cluePayload(data,form){
 const rewards=[...form.querySelectorAll('[data-clue-reward]')].map(row=>({itemId:row.querySelector('select').value,quantity:Number(row.querySelector('[name=rewardQuantity]').value),dc:Number(row.querySelector('[name=rewardDc]').value)}));
 return {...data,dc:Number(data.dc??10),rewards};
}
function clueNotes(id){
 const entries=journalEntries(current).filter(n=>n.id!==id);
 const chosen=current.state.journal.find(n=>n.id===id);
 return select('noteId','Anotação vinculada (opcional)',{'':'Sem anotação',...Object.fromEntries((chosen?[chosen,...entries]:entries).map(n=>[n.id,n.title]))},chosen?.id||'');
}
function clueFields(point={}){
 const rules=point.rules||{};
 const options=Object.fromEntries(current.state.characters.filter(c=>c.access==='full'&&c.characterType==='player').flatMap(c=>sheetRequestOptions(current.state,c).map(o=>[o.key,o.name+' · '+({skill:'perícia',attribute:'atributo',saved:'rolagem'}[o.kind])])));
 if(rules.test&&!options[rules.test])options[rules.test]=rules.test;
 return area('description','Texto revelado ao investigar (opcional)',point.description||'','maxlength="8000" rows="3"')+clueNotes(point.noteId)+
 select('test','Teste ao investigar',{'':'Sem teste definido',...options},rules.test||'')+input('dc','Dificuldade do teste',rules.dc??10,'number','min="-999" max="999" required')+
 '<div data-clue-rewards>'+clueRewards(rules).map(rewardRow).join('')+'</div>'+button('Adicionar recompensa','rewardAdd','small','plus')+
 '<p class="muted">O mestre informa o resultado ao resolver o pedido. Cada item é entregue quando seu mínimo é atingido.</p>';
}
const displayedReceipts=new Set();
dialog.addEventListener('close',()=>queueMicrotask(()=>showInvestigationReceipt(current)));
function showInvestigationReceipt(row){
 if(!credentials||row.id!==credentials.id||row.master||!row.state.investigationReceipts?.length||dialog.open)return;
 const receipt=row.state.investigationReceipts.find(r=>!displayedReceipts.has(r.id));
 if(!receipt)return;
 displayedReceipts.add(receipt.id);
 const owner=credentials;
 modal('Itens recebidos','<p class="loot-reward-eyebrow">'+esc(receipt.location?'Investigação · '+receipt.location:'Entrega de '+(receipt.from||'item'))+'</p><ul class="investigation-rewards">'+receipt.items.map(i=>'<li style="'+itemTheme(i)+'"><div class="item-art">'+itemPortrait(i,esc)+'</div><strong>'+esc(i.name)+'</strong><span>× '+esc(i.quantity)+'</span></li>').join('')+'</ul><p class="muted">Adicionados ao seu inventário.</p>'+button('Continuar aventura','close','primary'));
 dialog.dataset.lootReward='true';applyPortraits(dialog,receipt.items);
 dialog.addEventListener('close',async()=>{
   if(credentials!==owner){displayedReceipts.delete(receipt.id);return;}
   try{await action('investigationReceiptRead',{id:receipt.id});}
   catch{displayedReceipts.delete(receipt.id);}
 },{once:true});
}
let investigationMarkup='';
const regionNotices=new Set();
function regionAlerts(row){
 if(!row.master)return;
 for(const p of row.state.table?.exploration||[]){
   const event=p.lastEntry;
   if(p.event==='scene'||p.destination||!event||Date.now()-event.at>15000||regionNotices.has(event.id))continue;
   regionNotices.add(event.id);if(regionNotices.size>100)regionNotices.delete(regionNotices.values().next().value);
   toast(event.name+' entrou em '+p.label);
 }
}
function updateInvestigationAlert(row){
 regionAlerts(row);
 const host=$('#investigation-inbox');if(!host)return;
 const pending=row.master?row.state?.investigations||[]:[];
 const travel=(row.master?row.state?.travelRequests||[]:[]).map(r=>'<div><strong>Pedido de troca de mapa</strong><p>'+esc(r.name)+' atravessou '+esc(r.label)+'. Levar toda a mesa para '+esc(r.destination)+'?</p>'+button('Trocar mapa','travelApprove','primary small','',r.id)+button('Recusar','travelDecline','small','',r.id)+'</div>').join('');
 const html=travel+(pending.length?'<strong>Investigação aguardando o mestre</strong>'+pending.map(r=>button(r.name+' · '+r.label,'investigationReview','small','',r.id)).join(''):'');
 if(investigationMarkup===html)return;
 investigationMarkup=html;host.innerHTML=html;host.hidden=!html;
 if(html&&host.showPopover&&!host.matches(':popover-open'))host.showPopover();
 if(!html&&host.hidePopover)host.hidePopover();
}
let shareExpiry;
function scheduleSharedExpiry(row){
 clearTimeout(shareExpiry);
 const grants=row.state.sharing?.received||[],now=row.serverTime||Date.now();
 if(dialog.dataset.sharedRead&&!grants.some(g=>g.id===dialog.dataset.sharedRead&&g.until>now))dialog.close();
 if(!grants.length)return;
 shareExpiry=setTimeout(()=>{
  if(current.id!==row.id)return;
  const time=currentView().serverTime;
  const sharing=current.state.sharing;
  if(!sharing)return;
  sharing.received=sharing.received.filter(g=>g.until>time);
  scheduleSharedExpiry({...current,serverTime:time});
  if(page==='inventory'||page==='journal')render();
 },Math.max(0,Math.min(...grants.map(g=>g.until))-now)+30);
}
function sharedList(kind){
 const grants=current.state.sharing?.received?.filter(g=>g.kind===kind&&g.until>currentView().serverTime)||[];
 return grants.length?'<section class="panel"><h2>Compartilhados comigo</h2><div class="actions">'+grants.map(g=>button((g.material.title||g.material.name)+' · '+g.from,'sharedRead','small','',g.id)).join('')+'</div></section>':'';
}
function openPointPlacement(kind,point,sceneId){
  if(kind==='region'){
    const choices={alert:'Avisar o mestre'};
    for(const scene of current.state.sceneLibrary.scenes)if(scene.id!==sceneId)choices['scene/'+scene.id]='Pedir troca de mapa · '+scene.name;
    for(const cue of current.state.cinematicCues||[])choices['cinematic/'+cue.id]='Exibir cinemática · '+cue.name;
    modal('Criar gatilho de entrada',input('label','Nome do gatilho','','text','maxlength="80" required')+select('trigger','Quando um personagem entrar',choices,'alert')+input('sceneId','',sceneId,'hidden')+Object.entries(point).map(([k,v])=>input(k,'',v,'hidden')).join('')+submit('Criar gatilho'),'regionCreate');return;
  }
  const sound=kind==='sound';
  const files=current.state.audio?.clips||[];
  const title=sound?'Colocar som local':'Colocar pista';
  if(sound&&!files.length){modal(title,'<p>Adicione um arquivo ao soundboard para usar como ambiente em repetição.</p>');return;}
  const choices=Object.fromEntries(files.map(f=>[f.id,f.name]));
  modal(title,input('kind','',kind,'hidden')+input('sceneId','',sceneId,'hidden')+input('x','',point.x,'hidden')+input('y','',point.y,'hidden')+
    (sound?select('clipId','Arquivo do soundboard',choices,files[0].id):'')+
    (sound?'<label class="check"><input type="checkbox" name="muffle" checked> Filtrar agudos atrás de paredes (experimental)</label>':input('label','Nome mostrado no mapa','Investigar','text','maxlength="80" required')+select('mode','Ao investigar',{auto:'Revelar ao grupo',approve:'Pedir autorização ao mestre'},'auto')+clueFields())+
    input('radius','Alcance em células',sound?6:2,'number','min=".25" max="80" step=".25" required')+submit('Colocar no mapa'),'explorePlace');
}
const handlers = {
  tableFullscreen(){
    if(expandedTable){leaveExpandedTable();return;}
    if(!tableVisible())return;
    setExpandedTable(true);
    main.querySelector('.vtt-heading')?.scrollIntoView({block:'start'});
    // The expanded layout also works on mobile browsers without native fullscreen.
    if(document.fullscreenEnabled&&!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});
  },
  tokenMicrophone(){
    if(mic.session){mic.stop();return;}
    if(!credentials)return;
    if(current.master){
      if(current.state.sceneId!==current.state.activeSceneId){toast('Abra a cena ativa da mesa para falar por um token.');return;}
      const tokens=current.state.tokens.filter(t=>t.kind!=='item');
      if(!tokens.length){toast('Adicione um token à cena para animá-lo por fala.');return;}
      modal('Animar token por fala',select('tokenId','Falar pelo token',Object.fromEntries(tokens.map(t=>[t.id,t.name])),tokens[0].id)+submit('Ativar microfone'),'masterMicrophone');
      return;
    }
    if(!current.characterId){toast('Escolha sua ficha para animar seu token.');return;}
    return mic.start({access:credentials,scene:current.state.sceneId,character:current.characterId});
  },
  sharedRead(id){
   const grant=current.state.sharing?.received.find(g=>g.id===id&&g.until>currentView().serverTime);if(!grant)return;
   const content=grant.kind==='note'?'<p class="journal-body">'+esc(grant.material.body)+'</p>':itemDetails(grant.material,currentView(),gmUI());
   modal(esc(grant.material.title||grant.material.name),content+'<p>Compartilhado por '+esc(grant.from)+' até '+new Date(grant.until).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.</p>');
   dialog.dataset.sharedRead=id;
  },
  shareMaterial(key){
   const [kind,id]=key.split('/'),s=current.state.sharing,entry=(kind==='note'?current.state.journal:current.state.inventory).find(e=>e.id===id);
   if(!entry||!s)return;
   const targets={...(s.peers.some(c=>c.teammate)?{group:'Meu grupo'}:{}),...Object.fromEntries(s.peers.map(c=>[c.id,c.name]))};
   const sent=s.sent.filter(g=>g.kind===kind&&g.materialId===id&&g.until>currentView().serverTime);
   modal('Compartilhar · '+esc(entry.title||entry.name),input('kind','',kind,'hidden')+input('id','',id,'hidden')+input('version','',entry.version,'hidden')+
    (Object.keys(targets).length?select('target','Quem poderá consultar',targets,Object.keys(targets)[0])+select('minutes','Duração',{'5':'5 minutos','15':'15 minutos','60':'1 hora'},'15')+submit('Compartilhar para leitura'):'<p>Não há outro jogador disponível.</p>')+
    sent.map(g=>button('Encerrar acesso · '+g.label,'shareRevoke','small','',g.id)).join(''),'materialShare');
  },
  async shareRevoke(id){await action('shareRevoke',{id});dialog.close();},
  playerTransfer(id){
   const e=current.state.inventory.find(i=>i.id===id),peers=current.state.sharing.peers.filter(c=>c.teammate);
   if(!peers.length)return toast('Nenhum outro jogador do seu grupo está disponível.');
   modal('Entregar · '+esc(e.name),input('id','',id,'hidden')+input('version','',e.version,'hidden')+
    select('target','Destinatário',Object.fromEntries(peers.map(c=>[c.id,c.name])),peers[0].id)+
    input('quantity','Quantidade a transferir',1,'number','min="1" max="'+Number(e.quantity)+'" required')+submit('Entregar item'),'playerTransfer');
  },
  async investigationReview(id){
   const req=current.state.investigations?.find(r=>r.id===id);if(!req)return;
   await viewScene(req.sceneId);
   const point=current.state.table.exploration?.find(p=>p.id===req.pointId);
   const pending=point?.pending?.find(r=>(r.id||point.id+'/'+r.audience)===id);
   if(pending)handlers.investigationResolve(point.id+'|'+pending.audience);
   else toast('Este pedido já foi resolvido.');
  },
  rewardAdd(){if(!current.state.inventory?.some(i=>!i.characterId))return toast('Crie primeiro um item no catálogo do mestre.');dialog.querySelector('[data-clue-rewards]').insertAdjacentHTML('beforeend',rewardRow());},
  rewardRemove(id,node){node.closest('[data-clue-reward]').remove();},
  investigationConfigure(id){
   const p=current.state.table.exploration.find(p=>p.id===id);
   modal('Teste e recompensa',input('id','',id,'hidden')+input('sceneId','',current.state.sceneId,'hidden')+clueFields(p)+submit('Salvar configuração'),'exploreConfigure');
  },
  investigationResolve(key){
   const [id,audience]=key.split('|'),p=current.state.table.exploration.find(p=>p.id===id);
   if(!p)return;
   const req=p.pending.find(r=>r.audience===audience),check=req&&current.state.checkRequests?.find(c=>c.id===req.checkId);
   const testLabel=current.state.characters.flatMap(c=>sheetRequestOptions(current.state,c)).find(o=>o.key===p.rules?.test)?.name;
   const characters=current.state.characters.filter(c=>c.characterType==='player'&&!c.hidden&&(!req||c.id===req.characterId));
   const rules=p.rules||{},rewards=clueRewards(rules);
   modal('Resolver investigação · '+esc(p.label),input('id','',id,'hidden')+input('sceneId','',current.state.sceneId,'hidden')+
    input('audience','',audience||'','hidden')+input('requestId','',req?.id||'','hidden')+
    select('characterId','Investigador',Object.fromEntries(characters.map(c=>[c.id,c.name])),characters[0]?.id)+
    select('scope','Revelar para',{group:'Grupo do investigador',individual:'Somente o investigador'},'group')+
    clueNotes(p.noteId)+
    (rules.test||rewards.length?'<p>'+esc(testLabel||check?.label||rules.test||'Teste da mesa')+(rules.test?' · CD '+esc(rules.dc):'')+'</p>'+input('total','Resultado informado pelo mestre','','number','min="-1000000" max="1000000" step="1" '+(rewards.length?'required':'')):'')+
    (rewards.length?'<ul>'+rewards.map(r=>'<li>Resultado '+esc(r.dc)+' ou mais · '+esc(r.quantity)+' × '+esc(current.state.inventory.find(i=>i.id===r.itemId)?.name||'Item removido')+'</li>').join('')+'</ul><label class="check"><input name="reward" type="checkbox" checked> Entregar itens cujo mínimo foi atingido</label>':'')+
    submit('Revelar pista')+(req?'<button type="submit" class="btn small" name="decision" value="deny" formnovalidate>Recusar pedido</button>':''),'investigationResolve');
  },
  exploreOpen(id){
    const p=current.state.table?.exploration?.find(p=>p.id===id);if(!p)return;
    if(p.kind==='region'&&current.master){
      const event=p.event==='scene'?'Pedir troca de mapa · '+(current.state.sceneLibrary.scenes.find(s=>s.id===p.target)?.name||'Cena excluída'):p.event==='cinematic'?'Exibir cinemática · '+(current.state.cinematicCues.find(c=>c.id===p.target)?.name||'Preparação excluída'):'Avisar o mestre';
      modal(esc(p.label),'<p>Ao entrar: '+esc(event)+'</p>'+(p.lastEntry?'<p>Última entrada: '+esc(p.lastEntry.name)+'</p>':'')+button('Excluir gatilho','exploreRemove','small danger','',id));return;
    }
    const clue=p.kind==='clue',note=current.state.journal?.find(n=>n.id===p.noteId);
    if(!current.master){
      if(!clue){modal('Som local','<p>Você encontrou a origem de um som ambiente.</p>');return;}
      if(p.found){modal(esc(note?.title||p.label),'<p class="journal-body">'+esc([p.description,note?.body].filter(Boolean).join('\n\n')||'Local investigado.')+'</p>',null,true);return;}
      modal(esc(p.label),p.pending?'<p>O mestre recebeu o pedido de investigação.</p>':'<p>'+(p.mode==='auto'?'Você poderá consultar a descoberta neste local.':'O mestre vai avaliar seu pedido para investigar.')+'</p>'+button('Investigar','exploreInvestigate','primary','',id));return;
    }
    const clip=current.state.audio?.clips?.find(c=>c.id===p.clipId);
    const requests=(p.pending||[]).map(req=>{
     const name=current.state.characters.find(c=>c.id===req.characterId)?.name||'Personagem';
     return button('Resolver pedido de '+name,'investigationResolve','primary','',p.id+'|'+req.audience);
    }).join('');
    modal(clue?esc(p.label):'Som local',(p.lastEntry?'<p>Última entrada: '+esc(p.lastEntry.name)+'</p>':'')+(p.destination?button('Levar a mesa à cena de destino','regionTravel','small','',p.destination):'')+'<p>'+esc(clue?note?.title||p.label:clip?.name)+' · '+esc(p.radius)+' células</p>'+requests+
     (clue?button('Revelar manualmente','investigationResolve','small','',p.id)+button('Configurar teste e recompensa','investigationConfigure','small','',p.id):button(p.muffle===false?'Ativar filtro de paredes (experimental)':'Desativar filtro de paredes (experimental)','soundOcclusion','small','',p.id))+
     button('Remover do mapa','exploreRemove','small danger','',id));
  },
  async soundOcclusion(id){
    const point=current.state.table.exploration.find(p=>p.id===id);
    if(point&&await action('soundOcclusion',{id,muffle:point.muffle===false}))handlers.exploreOpen(id);
  },
  async exploreInvestigate(id,node){
    if(node.disabled)return;
    node.disabled=true;
    try{
      const owner=credentials,row=await action('exploreInvestigate',{id});
      if(!row||owner!==credentials)return;
      const point=row.state.table?.exploration?.find(p=>p.id===id);
      if(point?.found){handlers.exploreOpen(id);return;}
      dialog.close();
      toast('Pedido enviado ao mestre.');
    }finally{node.disabled=false;}
  },
  async exploreRemove(id){await action('exploreRemove',{id});dialog.close();},
  clockEdit(id){modal(id?'Editar relógio':'Criar relógio',clockEditor(current.state,current.state.sessionLog?.clocks.find(e=>e.id===id),gmUI()),'clockSave');},
  clockStep(value){
    const entry=current.state.sessionLog?.clocks.find(e=>e.id===value.slice(1));
    if(entry)return action('clockStep',{id:entry.id,version:entry.version,step:value[0]==='+'?1:-1});
  },
  recapEdit(id){
    const entry=current.state.sessionLog?.recaps.find(e=>e.id===id);
    modal(entry?'Editar passagem':'Registrar passagem da sessão',recapEditor(current,entry,prepSession(current,gmView)?.id,gmUI(),gmView.recapFilter),'recapSave');
  },
  recapScene(id){page='table';return viewScene(id);},
  recapNote(id){
    const note=current.state.journal?.find(e=>e.id===id);
    if(note)modal(esc(note.title),noteReader(note,current.state.journal,gmUI()));
  },
  logRemove(value){
    const [kind,id]=value.split('/');
    const entry=current.state.sessionLog[kind==='clock'?'clocks':'recaps'].find(e=>e.id===id);
    if(entry)modal('Excluir '+(kind==='clock'?'relógio':'resumo')+'?',input('id','',id,'hidden')+input('version','',entry.version,'hidden')+'<p>'+esc(entry.title)+'</p>'+submit('Excluir'),kind+'Delete');
  },
  ...sheetHistoryController.handlers,
  checkCompose(){
    const sheets=eligibleCheckSheets();
    if(!sheets.length)return toast('É preciso um personagem controlado por jogador.');
    const options=Object.fromEntries(sheets.flatMap(c=>sheetRequestOptions(current.state,c).map(o=>[o.key,({attribute:'Atributo',skill:'Perícia',saved:'Rolagem'})[o.kind]+' · '+o.name])));
    const first=Object.keys(options)[0]||'';
    const initialMode=first?'sheet':'free';
    const modeOptions=first?{sheet:'Perícia / Atributo da ficha',free:'Fórmula livre'}:{free:'Fórmula livre'};
    modal('Pedir teste',
      select('mode','Modo do pedido',modeOptions,initialMode)+
      '<div data-check-sheet-fields '+(initialMode==='sheet'?'':'hidden')+'>'+
        (first?select('test','Teste da ficha',options,first):'')+
        '<label class="check"><input type="checkbox" name="allowFallback"> Usar 1d20 puro nas fichas sem este teste</label>'+
      '</div>'+
      '<div data-check-free-fields '+(initialMode==='free'?'':'hidden')+'>'+
        input('label','Nome do teste','Teste de Sorte','text',(initialMode==='free'?'required ':'disabled ')+'maxlength="80" placeholder="Ex.: Teste de Sorte"')+
        input('formula','Fórmula','1d20','text',(initialMode==='free'?'required ':'disabled ')+'maxlength="'+rollFormulaLimit+'" placeholder="Ex.: 1d20, 2d6+2, 1d100"')+
      '</div>'+
      '<fieldset><legend data-check-recipients-legend>'+(initialMode==='sheet'?'Participantes com este teste':'Participantes')+'</legend><div data-check-recipients>'+checkRecipientFields(first,initialMode,false)+'</div></fieldset>'+
      input('dc','Dificuldade (opcional)','','number','min="-999" max="999" step="1"')+'<label class="check"><input type="checkbox" name="showDc"> Mostrar dificuldade aos participantes</label><label class="check"><input type="checkbox" name="allowHelp"> Permitir ofertas de ajuda de aliados</label>'+submit('Enviar pedido'),'checkCreate');
  },
  assistOffer(key){
    const [id,target]=key.split('/');
    modal('Oferecer ajuda',input('id','',id,'hidden')+input('target','',target,'hidden')+input('reason','Como seu personagem ajuda?','','text','required maxlength="240"')+submit('Enviar ao mestre'),'assistOffer');
  },
  assistDecide(key){
    const [id,target]=key.split('/'),help=current.state.checkRequests.find(c=>c.id===id)?.targets.find(t=>t.characterId===target)?.help;
    if(!help)return;
    modal('Avaliar ajuda',helpText(help)+input('id','',id,'hidden')+input('target','',target,'hidden')+input('offer','',help.id,'hidden')+select('effect','Decisão',Object.fromEntries([['decline','Recusar'],['advantage','Vantagem no d20'],...['1','2','3','4','5','1d4','1d6','1d8','1d10','1d12','1d20'].map(v=>[v,'+'+v])]),'1d4')+submit('Confirmar'),'assistDecide');
  },
  checkPhysical(key){
    const [id,target]=key.split('/');
    modal('Registrar dados físicos',input('id','',id,'hidden')+input('target','',target,'hidden')+input('total','Total final, incluindo a ajuda',0,'number','required step="1"')+submit('Registrar resultado'),'checkPhysical');
  },
  checkClose(id){return action('checkClose',{id});},
  async checkRespond(id,node){
    if(node.disabled)return;node.disabled=true;
    try{
      const masteryId=node.closest('[data-check-id]').querySelector('[name=checkMastery]')?.value;
      const row=await action('checkRespond',{id,masteryId});
      const result=row?.state.checkRequests?.find(c=>c.id===id)?.targets[0]?.result;
      if(result)diceDisplay.showRequested(result);
    }finally{node.disabled=false;}
  },
  tableTokenMessage(id){
    if(!current.master)return;
    const token=current.state.tokens.find(token=>token.id===id);
    const character=current.state.characters.find(character=>character.id===token?.characterId&&character.claimed&&!character.hidden);
    if(!character)throw new Error('Este token precisa estar vinculado à ficha de um jogador.');
    handlers.narrationCompose(character.id);
  },
  cinematicDesk(selected,cue){
    if(cue instanceof Element)cue=null;
    if(!current.master)return;
    const assets=current.state.cinematicLibrary||[];
    const style=cinematicStyle(cue||{});
    const tracks=assets.filter(a=>a.type.startsWith('audio/'));
    const visuals=assets.filter(a=>!a.type.startsWith('audio/'));
    const clip=visuals.find(a=>a.id===(cue?.mediaId||selected));
    const cues=current.state.cinematicCues||[];
    const groups=Object.fromEntries([['','Toda a mesa'],...(current.state.parties||[]).map(g=>[g.id,g.name])]);
    if(cue?.party&&!Object.hasOwn(groups,cue.party))groups[cue.party]='Grupo removido · escolha outro público';
    modal('Cinemáticas · experimental',button('Verificar carregamento','mediaCheckDesk','small')+button('Preparar abertura de sessão','sessionOpening','small')+(cues.length?'<div class="actions">'+cues.map(c=>button(c.name,'cinematicLoad','small','',c.id)).join('')+'</div>':'')+
      input('id','',cue?.id||'','hidden')+input('name','Nome de preparação (só o mestre vê)',cue?.name||'','text','maxlength="80"')+select('mediaId','Mídia da revelação',Object.fromEntries([['','Somente texto'],...visuals.map(a=>[a.id,a.name])]),clip?.id||'')+
      button('Enviar mídia','cinematicUpload','small','plus')+
      select('soundtrackId','Trilha sonora desde a entrada',Object.fromEntries([['','Sem trilha'],...tracks.map(a=>[a.id,a.name])]),cue?.soundtrackId||'')+
      button('Enviar música','cinematicUpload','small','plus','audio')+
      select('captionSpeed','Velocidade da legenda',captionSpeeds,style.captionSpeed)+
      input('text','Texto da revelação (opcional)',cue?.text||'','text','maxlength="240"')+
      '<div class="form-grid">'+select('transition','Transição de entrada',cinematicTransitions,style.transition)+input('intro','Duração da entrada (s)',cue?.intro??4,'number','min="0" max="30" required')+'</div>'+
      '<div class="form-grid">'+select('reveal','Aparecimento da mídia',cinematicReveals,style.reveal)+input('revealSeconds','Duração do aparecimento (s)',style.revealSeconds,'number','min="0" max="5" step="0.1" required')+'</div>'+
      '<div class="cine-palette">'+input('accent','Cor do efeito',style.accent,'color')+input('background','Fundo',style.background,'color')+input('lettering','Texto',style.lettering,'color')+'</div>'+
      input('duration','Tempo de exibição (s, prolongado se a legenda precisar)',cue?.duration??20,'number','min="1" max="600" required')+
      select('party','Quem vai assistir',groups,cue?.party||'')+
      '<div class="actions">'+button('Prévia só para mim','cinematicPreview','small')+button('Guardar cinemática','cinematicSave','small')+(cue?.id?button('Excluir preparação','cinematicForget','small danger','',cue.id):'')+submit('Transmitir')+'</div>'+(visuals.length?button('Excluir mídia selecionada','cinematicDelete','small danger'):'')+(tracks.length?button('Excluir trilha selecionada','cinematicDelete','small danger','','audio'):''),'cinematicStart');
  },
  mediaCheckDesk(){
    modal('Verificar carregamento',select('cue','Mídia a liberar para download',Object.fromEntries([['','Mapa da cena selecionada'],...(current.state.cinematicCues||[]).map(c=>[c.id,c.name])]),'')+'<p>O mapa será enviado aos jogadores da campanha. Uma cinemática usa o público da preparação. A mídia fica acessível por dez minutos.</p><div data-media-check></div>'+submit('Iniciar teste'),'mediaCheckStart');
    mediaCheckSync(preloadStatus,credentials);
  },
  sessionOpening(){
    const scenes=current.state.sceneLibrary.scenes,images=(current.state.cinematicLibrary||[]).filter(a=>a.type.startsWith('image/'));
    modal('Abertura de sessão',select('scene','Cena da abertura',Object.fromEntries(scenes.map(sc=>[sc.id,sc.name])),current.state.sceneId)+select('mediaId','Imagem',Object.fromEntries([['','Somente texto'],...images.map(a=>[a.id,a.name])]),'')+input('phrase','Frase de abertura','','text','maxlength="150"')+submit('Preparar prévia'),'openingPrepare');
  },
  cinematicLoad(id){const cue=current.state.cinematicCues.find(c=>c.id===id);if(cue)handlers.cinematicDesk('',cue);},
  async cinematicSave(){
    const form=dialog.querySelector('[data-form=cinematicStart]');if(!form.reportValidity())return;
    const config=cinematicConfig(Object.fromEntries(new FormData(form)));
    const row=await action('cinematicSave',config);
    if(row)handlers.cinematicLoad(config.id||row.state.cinematicCues.at(-1).id);
  },
  cinematicForget(id){
    modal('Excluir preparação?',input('id','',id,'hidden')+'<p>A mídia continuará na biblioteca.</p>'+submit('Excluir preparação'),'cinematicForget');
  },
  cinematicUpload(kind){
    const draft=[...new FormData(dialog.querySelector('form'))].map(([key,value])=>input(key,'',value,'hidden')).join('');
    const music=kind==='audio';
    modal(music?'Enviar música':'Enviar mídia',draft+input('file',music?'Trilha de até 32 MB':'Imagem, GIF ou vídeo de até 32 MB','','file',music?'required accept="audio/mpeg,audio/ogg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/flac,audio/webm,.m4a"':'required accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"')+submit('Guardar na biblioteca'),'cinematicUpload');},
  cinematicPreview(){
    const form=dialog.querySelector('form');if(!form.reportValidity())return;
    const config=cinematicConfig(Object.fromEntries(new FormData(form)));
    cinematicStage.preview(config,current.state.cinematicLibrary?.find(a=>a.id===config.mediaId));
  },
  cinematicDelete(kind){
    const id=dialog.querySelector(kind==='audio'?'[name=soundtrackId]':'[name=mediaId]').value;
    const asset=current.state.cinematicLibrary?.find(a=>a.id===id);if(!asset)return toast('Selecione a mídia para excluir.');
    modal('Excluir mídia?',input('id','',id,'hidden')+'<p>'+esc(asset.name)+'</p>'+submit('Excluir mídia'),'cinematicDelete');
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
  itemOpen(id){const e=current.state.inventory?.find(e=>e.id===id);if(e){modal('Detalhes do item',itemDetails(e,currentView(),gmUI()));dialog.dataset.itemView='true';dialog.dataset.inventoryId=id;dialog.dataset.inventoryVersion=String(e.version);}},
  itemEdit(id){if(!current.master)return;const e=current.state.inventory?.find(e=>e.id===id);modal(e?'Editar item':'Preparar item',itemEditor(e,currentView(),gmUI()),'itemSave');},
  itemGrant(id){const e=current.state.inventory?.find(e=>e.id===id);if(e&&current.master)modal('Entregar item',itemGrantForm(e,currentView(),gmUI()),'itemGrant');},
  itemManage(id){const e=current.state.inventory?.find(e=>e.id===id);if(e)modal(esc(e.name),itemManageForm(e,gmUI()),'itemManage');},
  itemDelete(id){
    const item=current.state.inventory?.find(e=>e.id===id);
    if(!item||!current.master&&item.characterId!==current.characterId)return;
    const title=current.master?'Excluir de todos os inventários':'Descartar item';
    const message=current.master?'Excluir o original do catálogo e todas as cópias nos inventários dos personagens?':'Descartar as '+item.quantity+' unidade(s) deste item do seu inventário?';
    modal(title,input('id','',id,'hidden')+input('version','',item.version,'hidden')+'<p><strong>'+esc(item.name)+'</strong></p><p>'+esc(message)+'</p>'+submit(title),'itemDelete');
  },
  async itemEquip(id,node){
    const item=current.state.inventory?.find(e=>e.id===id);
    if(node.disabled||!item)return;
    const access=credentials;
    node.disabled=true;
    try{
      await action('itemManage',{id,version:Number(node.dataset.version),equipped:node.dataset.equip==='true',quantity:item.quantity,notes:item.notes||''});
      if(credentials!==access)return;
      if(dialog.open&&dialog.dataset.inventoryId===id)handlers.itemOpen(id);
      const root=dialog.open?dialog:main;
      [...root.querySelectorAll('[data-act=itemEquip]')].find(b=>b.dataset.id===id)?.focus({preventScroll:true});
    }finally{node.disabled=false;}
  },
  async itemUse(id,node){
    if(node.disabled)return;
    const ownership=credentials,version=Number(node.dataset.version);
    node.disabled=true;
    try{
      await action('itemUse',{id,version,delta:Number(node.dataset.delta)});
      if(credentials!==ownership)return;
      if(dialog.open&&dialog.dataset.inventoryId===id)handlers.itemOpen(id);
      const remaining=current.state.inventory?.find(e=>e.id===id)?.uses;
      if(Number(node.dataset.delta)<0)toast(remaining===0?'Último uso consumido.':('Uso consumido. Restam '+remaining+'.'));
    }finally{node.disabled=false;}
  },
  journalEdit(id){const entry=current.state.journal?.find(e=>e.id===id);if(id&&(!entry||!current.master&&!entry.canEdit))return;modal(entry?'Editar documento':'Novo documento',journalEditor(entry,currentView(),gmUI()),'journal');},
  journalCollapse(id){journalView.collapsed=journalView.collapsed.includes(id)?journalView.collapsed.filter(x=>x!==id):[...journalView.collapsed,id];render();},
  async journalShow(id){const e=current.state.journal?.find(e=>e.id===id);if(e)await action('journalPublish',{id,version:e.version,audience:'all'});},
  async journalHide(id){const e=current.state.journal?.find(e=>e.id===id);if(e)await action('journalPublish',{id,version:e.version,audience:'private'});},
  async journalStatus(id){const e=current.state.journal?.find(e=>e.id===id);if(e)await action('journalStatus',{id,version:e.version,status:e.status==='completed'?'active':'completed'});},
  journalDelete(id){const e=current.state.journal?.find(e=>e.id===id);if(e)modal('Excluir documento','<input type="hidden" name="id" value="'+esc(id)+'"><input type="hidden" name="version" value="'+e.version+'"><p>Excluir permanentemente '+esc(e.title)+'?</p>'+submit('Excluir documento'),'journalDelete');},
  sheetTemplates(){modal('Modelos de fichas',sheetTemplateLibrary(currentView(),gmUI()));},
  campaignSheetTheme(){
    if(!current.master)return;
    const base=current.state.sheetTheme||{};
    const choices={classic:'Original da Forja',medieval:'Medieval',future:'Futurista',noir:'Investigação noir'};
    modal('Tema das fichas da campanha','<p>O estilo e a moldura valem para todas as fichas. Cada jogador pode escolher suas cores de destaque.</p><label>Estilo<select name="style">'+Object.entries(choices).map(([id,label])=>'<option value="'+id+'" '+((base.style||'classic')===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>Nome do tema (opcional)<input name="name" maxlength="60" value="'+esc(base.name||'')+'"></label><label>Cor da moldura<input type="color" name="trimColor" value="'+(/^#[0-9a-f]{6}$/i.test(base.trimColor)?base.trimColor:'#bc9860')+'"></label>'+emblemField()+select('texture','Textura',{none:'Original',grain:'Granulado',grid:'Quadriculado',lines:'Linhas'},base.texture||'none')+input('intensity','Intensidade da textura',base.intensity??35,'range','min="0" max="100"')+'<div data-theme-sample aria-label="Prévia da ficha"><p class="campaign-theme-name"></p><section class="sheet-panel"><header class="sheet-panel-header"><h2>Identidade</h2></header><div class="sheet-identity"><div class="sheet-portrait"><span aria-hidden="true">A</span></div><h1>Ariadne</h1></div></section></div><button class="btn primary">Aplicar à campanha</button>','campaignSheetTheme');
    const form=dialog.querySelector('form'),sample=form.querySelector('[data-theme-sample]');
    function preview(){
      sample.dataset.texture=form.elements.texture.value;sample.style.setProperty('--texture-alpha',form.elements.intensity.value/100);
      sample.className='campaign-sheet '+form.elements.style.value;
      sample.style.setProperty('--frame',form.elements.trimColor.value);
      const style=form.elements.style.value,title=form.elements.namedItem('name').value.trim()||choices[style];
      sample.firstElementChild.outerHTML=Object.hasOwn(sheetEngravings,style)?themeMasthead(style,title):'<p class="campaign-theme-name">'+esc(title)+'</p>';
    }
    form.oninput=preview;preview();
  },
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
  gmTableAdd(){const rows=$('[data-table-entries]',dialog);rows.insertAdjacentHTML('beforeend',gmTableRow(null,gmUI()));rows.lastElementChild.querySelector('input').focus();},
  gmTableRemove(id,node){node.closest('[data-table-entry]').remove();},
  gmTableReset(id){return action('gmTableReset',{id,version:gmCard(id).version});},
  gmTableRoll(id){return action('gmTableRoll',{id});},
  prepOpenSheet(id){dialog.close();openSheet(id);},
  prepMap(id){if(current.master&&id===current.state.sceneId){gmView.map=id;render();}},
  prepReturn(){gmView.map='';render();},
  async prepMapCopy(id){
    const created=await handlers.sceneDuplicate(id);
    if(created&&current.master&&current.state.sceneId===created&&created!==current.state.activeSceneId){gmView.map=created;render();}
  },
  prepNpc(id){const note=current.state.journal?.find(e=>e.id===id);if(current.master)editCharacter('','',{characterType:'npc',hidden:true,name:note?.title||'',prepNote:note?.id,prepSession:prepSession(current,gmView)?.id});},
  prepItem(id){
    if(!current.master)return;
    const note=current.state.journal?.find(e=>e.id===id),session=prepSession(current,gmView);
    modal('Criar item · '+esc(session.name),input('prepSession','',session.id,'hidden')+itemEditor({name:note?.title||'',journalId:note?.id},currentView(),gmUI()),'itemSave');
  },
  async vaultMembership(id){
    const note=current.state.journal.find(n=>n.id===id);
    await action('journalMembership',{id,version:note.version,include:!note.inJournal});
    if(dialog.open)handlers.prepRead(id,null,true);
    toast(note.inJournal?'Retirada do seu diário e mantida no cofre.':'Nota adicionada ao seu diário.');
  },
  async vaultPin(id){await action('gmNotePin',{id});toast('Nota fixada no escudo.');},
  vaultOpen(){ensureGmView();dialog.close();gmView.openNote='';gmView.prepTab='note';gmView.folder='';gmView.prepQuery='';gmView.map='';page='shield';render();},
  vaultClose(){const id=gmView.openNote;gmView.openNote='';gmView.trail=[];render();main.querySelector('[data-vault-card="'+CSS.escape(id)+'"] [data-act=prepRead]')?.focus();},
  vaultFolder(path){delete gmView.camera;gmView.openNote='';gmView.folder=path;render();},
  vaultMode(id){gmView.vaultMode=id==='canvas'?'canvas':'grid';render();},
  prepTab(id){if(!current.master||!['plan','note','item','character'].includes(id))return;gmView.prepTab=id;gmView.prepQuery='';render();},
  prepNewScene(session){if(current.master)sceneEditor('',session);},
  prepTag(tag){dialog.close();page='shield';gmView.map='';gmView.prepTab='note';gmView.folder='';gmView.prepQuery='#'+tag;render();},
  prepBack(){const id=gmView.trail?.pop();if(id)handlers.prepRead(id,null,true);},
  prepRead(id,node,back=false){const note=current.state.journal?.find(e=>e.id===id);if(note&&current.master){
    const previous=dialog.open?dialog.querySelector('[data-open-note]')?.dataset.openNote:main.querySelector('[data-vault-reader] [data-open-note]')?.dataset.openNote;
    if(!previous)gmView.trail=[];else if(!back&&id!==previous)gmView.trail=[...(gmView.trail||[]).slice(-39),previous];
    let host=dialog;
    if(page==='shield'&&gmView.prepTab==='note'&&!gmView.map){
      gmView.openNote=id;render();host=main.querySelector('[data-vault-reader]');host?.focus();
    }else modal(esc(note.title),prepNoteContent(note));
    const heading=node?.dataset.jumpHeading;
    if(heading&&host)[...host.querySelectorAll('[data-note-heading]')].find(el=>el.dataset.noteHeading===heading)?.focus();
  }},
  prepToken(id){const c=current.state.characters.find(c=>c.id===id);if(current.master&&c)modal('Colocar token em '+esc(current.state.scene),tableTokenForm({characterId:c.id,name:c.name,color:c.color,hidden:true}),'tableToken');},
  prepAttach(key){return setSessionMaterial(key,true);},
  prepDetach(key){return setSessionMaterial(key,false);},
  async prepMove(key,node){
    const split=key.indexOf(':'),session=prepSession(current,gmView),direction=Number(node.dataset.step);
    const row=await action('sessionMaterialMove',{sessionId:session.id,expectedVersion:current.state.sceneLibrary.version,kind:key.slice(0,split),id:key.slice(split+1),direction});
    if(!row)return;
    const material=main.querySelector('[data-prep-material="'+CSS.escape(key)+'"]');
    (material?.querySelector('[data-step="'+direction+'"]:not(:disabled)')||material?.querySelector('[data-step]:not(:disabled)'))?.focus();
  },
  prepImport(){if(current.master)modal('Importar do Obsidian','<p>Escolha a pasta do cofre para manter os caminhos e links entre notas, ou selecione arquivos Markdown avulsos.</p><label>Pasta do cofre<input type="file" name="vault" webkitdirectory multiple></label><label>Arquivos Markdown<input type="file" name="markdown" accept=".md" multiple></label><p class="muted">As notas entram privadas no diário. Notas novas entram por padrão. Anexos e configurações ficam no computador. Até 200 documentos e 512 KB no diário ao todo.</p><label class="check"><input type="checkbox" name="update"> Atualizar também as notas privadas já importadas que não editei na Forja</label>'+submit('Importar notas privadas'),'prepImport');},
  gmCategory(id){if(!(id in gmCategories))return;gmView.category=id;render();},
  gmCombatNext(direction){return action('combatNext',{direction:Number(direction)});},
  async gmResource(key){
    const [id,field,raw]=key.split('/'),n=Number(raw);
    await action('sheetCounter',Math.abs(n)===1?{id,field,step:n}:{id,field,delta:n});
    if(page==='shield'&&!dialog.open)main.querySelector('[data-act="gmResource"][data-id="'+CSS.escape(key)+'"]')?.focus();
  },
  async gmPrivateDelta(key){
    const [id,resourceId,version,raw]=key.split('/');
    await action('gmResourceChange',{id,resourceId,version:Number(version),operation:'delta',delta:Number(raw)});
    if(page==='shield'&&!dialog.open){
      const prefix=id+'/'+resourceId+'/';
      const match=[...main.querySelectorAll('[data-act="gmPrivateDelta"]')].find(btn=>btn.dataset.id?.startsWith(prefix)&&btn.dataset.id.endsWith('/'+raw));
      match?.focus();
    }
  },
  gmCharacterRoll(key){const [characterId,rollId]=key.split('/'),character=current.state.characters.find(c=>c.id===characterId);if(character)return action('roll',{characterId,rollId,actor:character.name});},
  async gmReference(id){
    const card=gmCard(id);if(!card)return;
    if(card.targetKind==='journal'){handlers.vaultOpen();return handlers.prepRead(card.targetId);}
    if(card.targetKind==='character')return openSheet(card.targetId);
    if(card.targetKind==='book')return handlers.book(card.targetId,null,card.page);
    const entry=dndCatalog.find(entry=>entry.id===card.targetId);if(!entry)return toast('Referência indisponível.');
    modal(esc(entry.name),'<p class="gm-card-text">'+esc(entry.description)+'</p><p class="muted">Resumo adaptado do SRD 5.2.1 · página '+entry.page+'</p>'+button('Ver página no livro','gmRuleBook','primary','',entry.page));
  },
  gmRuleBook(page){const local=current.state.books.find(book=>book.source==='srd-5.2.1');if(local)return handlers.book(local.id,null,Number(page));modal('Livro oficial','<a class="btn primary" href="'+dndBook+'#page='+Number(page)+'" target="_blank" rel="noopener noreferrer">Abrir SRD na página '+Number(page)+' ↗</a>');},
  abilityArea(id){
    const ability=currentSheet()?.abilities?.find(a=>a.id===id);if(!ability)return;
    if(ability.effectShape){handlers.nav('table');tabletop.aim(ability.effectShape,ability.name,ability.effectLength);return;}
    modal('Área de '+esc(ability.name),select('shape','Formato',{cone:'Cone de 60°',burst:'Círculo',beam:'Linha de uma célula'},'cone')+input('ability','',ability.name,'hidden')+submit('Posicionar na mesa'),'abilityArea');
  },
  navigationMenu(){modal('Navegação','<div class="mobile-navigation">'+navigationGroups()+'</div>');},
  nav(key) {if(current.needsCharacter)return;if(dialog.open&&dialog.querySelector('.mobile-navigation'))dialog.close();page=key;if(key==='sheets') {if(!current.master&&current.characterId)return openSheet(current.characterId);sheetId='';}render();main.focus({preventScroll:true});window.scrollTo({top:0});},
  close() {settleTableConfirm(false);flyRewardToInventory(dialog);dialog.close();},
  create:createDialog,
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
  entryRetry(){if(!openingCampaign){if(reconnectingAccess)return openCampaign(reconnectingAccess);return lookupBrowserSession();}},
  entryCancel(){
    ++epoch;openingCampaign=0;reconnectingAccess=null;checkingBrowserSession=false;entryError='';
    if(invitePattern.test(location.hash))history.replaceState(null,'',location.pathname+location.search);
    render();
  },
  campaignRecover(){modal('Recuperar acesso à campanha',area('code','Código de recuperação ou link de acesso','','required rows="3" autocomplete="off"')+'<p class="muted">Cole o código de “Meu acesso”, “Backup e acesso” ou o código do seu personagem fornecido pelo mestre. Isso reabre a campanha existente.</p>'+submit('Reabrir campanha'),'campaignRecover');},
  campaignAccess(){
    if(!credentials)return;
    modal(current.master?'Backup e acesso à campanha':'Meu acesso',(current.master?'<h3>Backup completo</h3><p>Salve a campanha, fichas, cenas e arquivos no seu computador. O arquivo inclui as notas privadas do mestre.</p>'+button('Baixar backup completo','campaignBackup','primary')+button('Importar backup','campaignImport')+'<hr>':'')+'<h3>Código de acesso</h3>'+input('accessCode','Código privado de acesso',credentials.id+'.'+credentials.key,'text','readonly autocomplete="off"')+'<p class="muted">Guarde este código em um lugar privado. Ele permite recuperar seu acesso após trocar de endereço ou navegador. Quem possuir um código de mestre terá controle da campanha.</p>'+button('Baixar código','campaignAccessDownload','primary')+'<p class="muted">Este arquivo recupera o acesso; as campanhas e arquivos continuam no servidor e em seus backups.</p>');
  },
  campaignAccessDownload(){
    if(!credentials)return;
    const url=URL.createObjectURL(new Blob([credentials.id+'.'+credentials.key+'\n'],{type:'text/plain'}));
    const link=document.createElement('a');link.href=url;link.download='acesso-campanha.forja.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  async characterAccess(id){
    const characterId=id||sheetId;
    if(!current.master||!characterId)return;
    const result=await post(campaignPath()+'/player-access',{characterId,reserve:Boolean(id)});
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
  async dndCast(key,node) {
    const [id,entryId]=key.split('/'),spell=dndCatalog.find(e=>e.id===entryId);
    const slotSelect=node?.closest?.('.ability-card')?.querySelector?.('[data-sheet-cast-slot]')||[...(main.querySelectorAll?.('[data-sheet-cast-slot]')||[])].find(el=>el.dataset?.sheetCastSlot===entryId);
    const slotLevel=slotSelect?Number(slotSelect.value):undefined;
    const visibility=['public','gm'].includes(sheetView?.visibility)?sheetView.visibility:(current.master?'gm':'public');
    const access=credentials,isMaster=current.master;
    await action('dndCast',{id,entryId,mode:sheetView?.rollMode||'normal',visibility,...(Number.isInteger(slotLevel)&&slotLevel>=1?{slotLevel}:{})});
    if(credentials!==access)return;
    if(!isMaster&&visibility==='gm'&&spell?.formula)toast('Rolagem secreta enviada ao mestre.');
    else toast('Magia conjurada. Confira o resultado e o recurso na ficha.');
  },
  dndRest(id) {modal('Descanso de D&D','<input type="hidden" name="id" value="'+esc(id)+'">'+select('kind','Descanso',{short:'Curto · recursos configurados',long:'Longo · PV e recursos configurados'},'short')+'<p class="muted">O descanso curto não cura automaticamente: gaste Dados de Vida e role a cura. O longo restaura PV, Dados de Vida e os recursos configurados. Confirme as condições de descanso e outros efeitos com o mestre.</p>'+submit('Concluir descanso'),'dndRest');},
  settings() {
    const state = current.state;
    modal('Editar campanha',input('name','Nome',state.name,'text','required maxlength="100"')+input('system','Sistema',state.system,'text','maxlength="80"')+
      '<p class="muted">Organize os mapas em Cenas e sessões, na mesa virtual.</p>'+area('description','Descrição',state.description,'maxlength="800"')+submit('Salvar campanha'),'settings');
  },
  character(id) {if (id) openSheet(id);else if(current.master||current.needsCharacter) {if(current.state.ruleset==='dnd-2024')openDndCreation();else editCharacter('');}else openSheet(current.characterId);},
  async characterClaim(id) {
    const row=await action('characterClaim',{id});
    if (row?.characterId) openSheet(row.characterId);
  },
  characterRelease() {confirmDelete('characterRelease',sheetId,'Liberar este personagem para outro jogador?');},
  partyRoster(){
    const characters=current.state.characters.filter(c=>c.characterType!=='npc');
    const parties=current.state.parties||[];
    const sections=[...parties,{id:'',name:'Sem grupo'}].map(group=>{
      const members=characters.filter(c=>(c.party||'')===group.id);
      return '<section><h3>'+esc(group.name)+'</h3><div class="actions">'+members.map(c=>button(c.name,'characterParty','small','',c.id)).join('')+(members.length?'':'<span class="muted">Nenhum personagem</span>')+'</div>'+(group.id?button('Editar grupo','partyEdit','small','',group.id):'')+'</section>';
    });
    modal('Grupos rivais',button('Criar grupo','partyEdit','primary','plus')+(parties.length?sections.join(''):'<p class="muted">A campanha está sem grupos. Crie o primeiro para separar as fichas e identidades dos personagens.</p>'));
  },
  partyEdit(id){
    const group=current.state.parties?.find(g=>g.id===id);
    modal(group?'Editar grupo':'Criar grupo',input('id','',id||'','hidden')+input('name','Nome do grupo',group?.name||'','text','required maxlength="80"')+emblemField()+submit(group?'Salvar grupo':'Criar grupo')+(group?button('Excluir grupo','partyDeleteConfirm','small danger','',id):''),'partySave');
  },
  partyDeleteConfirm(id){
    const group=current.state.parties.find(g=>g.id===id);
    if(group)modal('Excluir '+esc(group.name)+'?',input('id','',id,'hidden')+'<p>Os personagens passarão a ficar sem grupo. Suas fichas voltarão a aparecer na lista comum da campanha.</p>'+submit('Excluir grupo'),'partyDelete');
  },
  characterParty(id){
    const c=current.state.characters.find(item=>item.id===id);
    if(!current.master||!c)return;
    modal('Grupo de '+esc(c.name),input('id','',c.id,'hidden')+select('party','Grupo do personagem',Object.fromEntries([['','Sem grupo'],...current.state.parties.map(g=>[g.id,g.name])]),c.party||'')+'<p class="muted">Os adversários veem ??? nos tokens. A ficha fica visível apenas para o próprio grupo e o mestre.</p><label class="check"><input type="checkbox" name="revealed" '+(c.partyRevealed?'checked':'')+'> Revelar o nome nos tokens para os outros grupos</label>'+submit('Salvar grupo')+(c.party&&!c.claimed&&!c.hidden?button('Gerar acesso privado para este jogador','characterAccess','small','',c.id):''),'characterParty');
  },
  async characterVisibility() {await action('characterVisibility',{id:sheetId,hidden:!currentSheet().hidden});if(dialog.open)handlers.sheetSettings();},
  sheetBack() {if(sheetId&&gmView.sheetReturn===sheetId&&current.master)page='shield';gmView.sheetReturn='';sheetId='';render();main.focus({preventScroll:true});},
  editSheet() {editCharacter(sheetId);},
  sheetTab(tab) {
    sheetView.tab=tab;render();
    $('[data-act=sheetTab][aria-pressed=true]',main)?.focus();
  },
  sheetSettings(){
    const c=currentSheet();
    const group=(title,actions)=>'<section class="settings-group"><h3>'+title+'</h3><div>'+actions+'</div></section>';
    const link=(label,act,id='')=>button(label,act,'settings-link','',id);
    modal('Configurar ficha',group(esc(c.name),link('Identidade e valores','editSheet')+link('Retrato','sheetPortrait')+link('Retrato de pouca vida','sheetInjury')+link('Campos desta ficha','sheetFields')+link('Cores e recursos','sheetColors'))+
      (current.master?group('Controles do mestre',link('Estresse corporal','bodyStressConfig')+link('Tipo de personagem','characterType')+
      (c.characterType!=='npc'&&current.state.parties?.length?link('Grupo do personagem','characterParty',c.id):'')+
      link(c.hidden?'Mostrar ficha aos jogadores':'Ocultar ficha dos jogadores','characterVisibility'))+
      group('Todas as fichas da campanha',link('Modelo de campos','schema')+link('Tema da campanha','campaignSheetTheme')):''));
  },
  sheetFields(kind) {
    const fields=sheetFields(current.state,currentSheet()).filter(field=>!current.state.sheetModelVersion||!current.state.fields.some(common=>common.id===field.id));
    if(['number','counter'].includes(kind)) fields.push({...newField('local-'),type:kind,group:kind==='number'?'Atributos':'Recursos',label:kind==='number'?'Novo atributo':'Novo recurso',initial:kind==='number'?'0':'10/10'});
    const character=currentSheet();
    const shared=current.master&&current.state.sheetModelVersion?current.state.fields:[];
    const names=shared.map(field=>{
      const value=character.fieldLabels?.[field.id]||'';
      return input('label:'+field.id,esc(field.label),value,'text','maxlength="80" data-shared-field="'+esc(field.id)+'" data-model-label="'+esc(field.label)+'" placeholder="'+esc(field.label)+'"');
    }).join('');
    modal('Campos de '+esc(character.name),input('id','',character.id,'hidden')+
      (names?'<fieldset><legend>Nomes dos campos do modelo</legend><p class="muted">Digite o nome que este personagem usa. Deixe em branco para acompanhar o nome da campanha.</p><div class="form-grid">'+names+'</div></fieldset>':'')+
      '<h3>Campos individuais</h3>'+
      '<div class="stack" id="schema-rows">'+fields.map(schemaRow).join('')+'</div>'+
      '<div class="actions">'+button('Adicionar atributo','localFieldAdd','small','plus','number')+button('Adicionar recurso','localFieldAdd','small','plus','counter')+button('Outro campo','localFieldAdd','small','plus')+'</div>'+submit('Salvar estrutura da ficha'),'sheetFields');
    if(['number','counter'].includes(kind))openNewSchemaField();
  },
  localFieldAdd(kind) {
    const field=newField('local-');
    if(['number','counter'].includes(kind)) Object.assign(field,{type:kind,group:kind==='number'?'Atributos':'Recursos',label:kind==='number'?'Novo atributo':'Novo recurso',initial:kind==='number'?'0':'10/10'});
    $('#schema-rows').insertAdjacentHTML('beforeend',schemaRow(field));
    openNewSchemaField();
  },
  bodyStressConfig() {
    const character=currentSheet(),stress=bodyStressWithHead(character.bodyStress);
    const modes={simple:'Simplificado · 6 regiões',complex:'Complexo · 10 regiões'};
    const fields=Object.entries(stressRegionsFor('complex')).map(([key,label])=>input(key,label,stress?.regions[key]?.limit??3,'number','required min="1" max="99" step="1"')).join('');
    modal('Estresse corporal','<input type="hidden" name="id" value="'+esc(character.id)+'"><label><input type="checkbox" name="enabled" '+(stress?.enabled?'checked':'')+'> Usar nesta ficha</label><p class="muted">Cada região começa sem estresse. Ao desativar, as marcações ficam guardadas.</p>'+select('mode','Segmentação do corpo',modes,stress?.mode||'simple')+'<p class="muted">No modo complexo, mãos e pés têm contadores próprios. Suas marcações ficam guardadas ao voltar ao simplificado.</p><fieldset><legend>Limite por região</legend><div class="form-grid">'+fields+'</div></fieldset>'+submit('Salvar configuração'),'bodyStressConfig');
    const mode=dialog.querySelector('[name=mode]');
    const updateFields=()=>{
      const visible=stressRegionsFor(mode.value);
      for(const field of dialog.querySelectorAll('fieldset input')){
        field.disabled=!Object.hasOwn(visible,field.name);
        field.closest('label').hidden=field.disabled;
      }
    };
    mode.addEventListener('change',updateFields);
    updateFields();
  },
  bodyStressSelect(region,node) {
    sheetView.stressRegion=region;
    const panel=node.closest('.stress-panel')||main.querySelector('.stress-panel');
    if(!panel)return;
    panel.outerHTML=bodyStressPanel(currentSheet());
    main.querySelector('.stress-region[aria-pressed=true]')?.focus({preventScroll:!!node.closest('.stress-panel')});
  },
  async bodyStressStep(region,node) {
    const step=node.dataset.step;
    await action('bodyStressStep',{id:sheetId,region,step:Number(step)});
    const panel=main.querySelector('.stress-panel');
    (panel?.querySelector('[data-step="'+step+'"]:not(:disabled)')||panel?.querySelector('[data-step]:not(:disabled)'))?.focus({preventScroll:true});
  },
  sheetColors(fieldId) {
    const character=currentSheet();if(!character||sheetMosaic.editing)return;
    modal('Cores e recursos',sheetColorsForm(current.state,character),'sheetColors');
    if(fieldId)[...dialog.querySelectorAll('[data-resource-picker]')].find(node=>node.dataset.resourcePicker===fieldId)?.focus();
  },
  gmResourceEdit(id){
    const item=current.state.gmResources?.[sheetId]?.find(entry=>entry.id===id);
    modal(item?'Editar recurso privado':'Adicionar recurso privado',
      input('id','',sheetId,'hidden')+input('resourceId','',item?.id||'','hidden')+input('version','',item?.version||0,'hidden')+
      input('name','Nome',item?.name||'','text','required maxlength="80" placeholder="Ex.: Vida oculta"')+
      '<div class="form-grid">'+input('current','Atual',item?.current??10,'number','required min="0" max="1000000" step="1"')+
      input('maximum','Máximo',item?.maximum??10,'number','required min="0" max="1000000" step="1"')+'</div>'+
      input('color','Cor da barra',item?.color||'#bd94ff','color')+resourceFormError+submit('Salvar recurso privado')+
      (item?button('Excluir recurso','gmResourceRemove','small danger','',id):''),'gmResourceSave');
  },
  gmResourceRemove(id){
    const item=current.state.gmResources?.[sheetId]?.find(entry=>entry.id===id);
    if(item)modal('Excluir recurso privado','<p>Excluir '+esc(item.name)+' desta ficha?</p>'+input('id','',sheetId,'hidden')+input('resourceId','',id,'hidden')+input('version','',item.version,'hidden')+submit('Excluir recurso'),'gmResourceDelete');
  },
  async gmResourceStep(resourceId,node){
    const step=Number(node.dataset.step),id=sheetId;
    await action('gmResourceChange',{id,resourceId,operation:'step',step});
    if(sheetId===id&&!dialog.open)restoreResourceFocus('gmResourceStep',resourceId,step);
  },
  sheetResource(id) {
    const field=sheetFields(current.state,currentSheet()).find(item=>item.id===id&&item.type==='counter');
    if(!field)return;
    const [amount='',maximum='']=String(sheetValue(currentSheet(),field)).split('/');
    modal('Ajustar '+esc(field.label),'<input type="hidden" name="field" value="'+esc(id)+'"><div class="form-grid">'+input('current','Atual',amount,'number','required min="0" max="1000000" step="any"')+input('maximum','Máximo',maximum,'number','required min="0" max="1000000" step="any"')+'</div>'+resourceFormError+submit('Salvar recurso'),'sheetResource');
  },
  sheetRollEdit(id) {editSavedRoll(id);},
  async sheetSavedRoll(rollId) {
    const character=currentSheet(),roll=character.rollButtons?.find(r=>r.id===rollId);if(!roll)return;
    const formula=sheetSavedRollFormula(character,roll),options=sheetActionOptions(formula,character);
    const access=credentials,isMaster=current.master;
    await action('roll',{rollId,characterId:sheetId,actor:character.name,...options});
    if(credentials===access&&!isMaster&&options.visibility==='gm')toast('Rolagem secreta enviada ao mestre.');
  },
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
    restoreResourceFocus('sheetCounter',field,step);
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
    const c=currentSheet(),base=c.injury?c.basePortrait:c.portrait;
    modal('Retrato do personagem',(base?'<img class="injury-preview" data-portrait="'+esc(base.id)+'" alt="Retrato habitual" hidden>':'')+'<p class="muted">Envie uma imagem PNG, JPG, WebP ou GIF de até 3 MB.</p>'+
      '<input type="hidden" name="kind" value="portrait"><input type="hidden" name="character" value="'+esc(sheetId)+'">'+
      '<label>Imagem<input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required></label>'+submit('Enviar retrato'),'upload');
  },
  sheetInjury(){
    const c=currentSheet(),rule=c.injury;
    const fields=sheetFields(current.state,c).filter(f=>f.type==='counter');
    const remove=rule?button('Remover retrato de pouca vida','injuryRemove','small danger'):'';
    if(!fields.length){modal('Retrato de pouca vida','<p>Adicione um recurso com valor atual e máximo para acompanhar a vida.</p>'+button('Adicionar recurso','sheetFields','primary','','counter')+remove);return;}
    const preferred=fields.find(f=>/vida|vitalidade|^pv$/i.test(f.label))||fields[0];
    modal('Retrato de pouca vida','<p>O retrato muda na ficha e nos tokens com retrato automático quando a vida chega ao limite. Ao recuperar vida acima dele, a imagem original volta.</p>'+
      select('resource','Recurso de vida',Object.fromEntries(fields.map(f=>[f.id,f.label])),rule?.resource||preferred.id)+
      input('threshold','Trocar com vida igual ou abaixo de (%)',rule?.threshold??25,'number','min="0" max="100" step="1" required')+
      (rule?'<img class="injury-preview" data-portrait="'+esc(rule.image.id)+'" alt="Retrato de pouca vida" hidden>':'')+
      '<label>'+ (rule?'Substituir imagem (opcional)':'Retrato de pouca vida')+'<input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" '+(rule?'':'required')+'></label><small>PNG, JPG, WebP ou GIF de até 3 MB.</small>'+submit('Salvar retrato e limite')+remove,'sheetInjury');
  },
  async injuryRemove(){await action('injurySettings',{id:sheetId,remove:true});dialog.close();},
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
  async sheetSkillRoll(id) {
    const character=currentSheet(),skill=character.skills?.find(skill=>skill.id===id);if(!skill)return;
    const formula=sheetSkillTest(current.state,character,id).formula,options=sheetActionOptions(formula,character);
    const access=credentials,isMaster=current.master;
    await action('roll',{skillId:id,characterId:sheetId,actor:character.name,...options});
    if(credentials===access&&!isMaster&&options.visibility==='gm')toast('Rolagem secreta enviada ao mestre.');
  },
  schema() {
    const state=current.state;
    const sources=[...sheetPresets,...(state.sheetTemplates?.items||[])];
    modal('Modelo da campanha',input('expectedVersion','',state.sheetModelVersion||0,'hidden')+
      '<p>Estes campos aparecem nas fichas atuais e futuras. Campos removidos do modelo ficam nas fichas existentes como campos individuais.</p>'+
      (state.ruleset==='dnd-2024'?'':select('source','Usar campos de um modelo',{'':'Campos atuais',...Object.fromEntries(sources.map(item=>[item.id,item.name]))},''))+
      '<div class="stack" id="schema-rows">'+state.fields.map(schemaRow).join('')+'</div>'+
      '<div class="actions">'+button('Atributo numérico','fieldAdd','small','plus','number')+button('Recurso atual/máximo','fieldAdd','small','plus','counter')+button('Texto','fieldAdd','small','plus','text')+'</div>'+submit('Salvar modelo da campanha'),'schema');
  },
  fieldAdd(type) {
    const field=newField();
    Object.assign(field,{type:type||'text',group:type==='number'?'Atributos':type==='counter'?'Recursos':'Geral',initial:type==='number'?'0':type==='counter'?'10/10':''});
    const rows=$('#schema-rows');
    rows.insertAdjacentHTML('beforeend',schemaRow(field));
    openNewSchemaField();
  },
  fieldDelete(id,node) {node.closest('[data-field]').remove();},
  fieldMove(direction,node) {
    const row=node.closest('[data-field]');
    if(direction==='up') row.previousElementSibling?.before(row);
    else row.nextElementSibling?.after(row);
    if(node.getClientRects().length)node.focus();else row.querySelector('summary').focus();
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
  travelApprove(id){return action('regionTravelDecision',{id,approve:true});},
  travelDecline(id){return action('regionTravelDecision',{id,approve:false});},
  regionTravel(id){dialog.close();return handlers.sceneActivate(id);},
  async sceneActivate(id){await action('sceneActivate',{id});if(gmSceneId!==id)await viewScene(id);toast('Cena compartilhada com os jogadores.');},
  async sceneDuplicate(id){const before=new Set(current.state.sceneLibrary.scenes.map(scene=>scene.id));const row=await action('sceneDuplicate',{id,expectedVersion:current.state.sceneLibrary.version});const created=row?.state.sceneLibrary.scenes.find(scene=>!before.has(scene.id));if(created){await viewScene(created.id);return created.id;}},
  sceneShift(value){const [id,direction]=value.split('/');return action('sceneMove',{id,direction:Number(direction)});},
  sceneDelete(id){if(id===current.state.activeSceneId){toast('Mostre outra cena à mesa antes de apagar esta.');return;}confirmDelete('sceneDelete',id,'Apagar esta cena, seus tokens, desenhos e névoa?');},
  sessionDelete(id){confirmDelete('sessionDelete',id,'Apagar esta sessão vazia? Mova suas cenas para outra sessão antes de continuar.');},
  tokenAdd() {modal('Novo token',tableTokenForm(),'tableToken');},
  tableTokenAdd() {modal('Novo token',tableTokenForm(),'tableToken');},
  tableConditions(id){
    const token=current.state.tokens.find(t=>t.id===id);if(!token||!current.master)return;
    const combat=normalizeTable(current.state).combat;
    const modes={manual:'Até o mestre remover'};
    if(combat.entries.length)modes.rounds='Por um número de rodadas';
    if(combat.entries.some(e=>e.tokenId===id))modes.turn='Até o fim do próximo turno deste token';
    const conditions=[...(token.statuses||[]),...(token.timedStatuses||[]).map(c=>c.name)];
    const list=conditions.map(name=>'<li>'+esc(name)+' '+button('Remover','tableConditionRemove','small danger','',name)+'</li>').join('');
    modal('Condições · '+esc(token.name),input('id','',id,'hidden')+input('sceneId','',current.state.sceneId,'hidden')+input('expectedEntry','',combat.entries[combat.active]?.id||'','hidden')+input('expectedRound','',combat.round,'hidden')+(list?'<ul>'+list+'</ul>':'')+
      input('name','Condição','','text','required maxlength="24" placeholder="Ex. Atordoado"')+select('mode','Duração',modes,'manual')+
      (modes.rounds?'<div data-condition-rounds hidden>'+input('rounds','Rodadas restantes',2,'number','min="1" max="99" step="1" required')+'<small>A contagem diminui ao iniciar uma nova rodada.</small></div>':'<p class="muted">Organize a iniciativa para acompanhar durações em combate.</p>')+
      submit('Aplicar condição'),'tableCondition');
    const picker=dialog.querySelector('[name=mode]'),rounds=dialog.querySelector('[data-condition-rounds]');
    if(rounds)picker.onchange=()=>{rounds.hidden=picker.value!=='rounds';rounds.querySelector('input').disabled=rounds.hidden;};
    if(rounds)picker.onchange();
  },
  async tableConditionRemove(name){
    const form=dialog.querySelector('[data-form=tableCondition]');
    if(!form)return;
    const data=Object.fromEntries(new FormData(form));
    if(await action('tokenCondition',{id:data.id,sceneId:data.sceneId,name,mode:'remove'}))handlers.tableConditions(data.id);
  },
  tableTokenEdit(id) {
    const token=current.state.tokens.find(token=>token.id===id);
    if (token) modal('Editar token',tableTokenForm(token),'tableToken');
  },
  tableAtmosphere(){
    const a=normalizeTable(current.state).atmosphere;
    modal('Ambiente da cena',input('sceneId','',current.state.sceneId,'hidden')+
      '<div class="atmosphere-preview" data-atmosphere-preview>'+renderAtmosphere(a)+'</div>'+
      select('tone','Tonalidade do mapa',sceneTones,a.tone)+'<label>Opacidade da tonalidade <output data-tone-value>'+a.toneOpacity+'%</output><input name="toneOpacity" type="range" min="0" max="100" step="1" value="'+a.toneOpacity+'"></label><div class="form-grid">'+select('weather','Clima',weatherNames,a.weather)+select('level','Intensidade do clima',weatherLevels,a.level)+'</div>'+submit('Aplicar à cena'),'tableAtmosphere');
    const background=main.querySelector('.vtt-map')?.style.backgroundImage;
    if(background&&background!=='none')dialog.querySelector('[data-atmosphere-preview]').style.backgroundImage=background;
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
      '<label class="check"><input type="checkbox" name="fogEnabled" '+(fog.enabled?'checked':'')+'> Ativar névoa nesta cena</label>'+
      select('fogMode','Tipo de névoa',{manual:'Manual · pincel do mestre',war:'Guerra · lembrar áreas exploradas'},fog.mode||'manual')+
      '<p class="muted">A névoa cobre visualmente as áreas ainda desconhecidas. A imagem original do mapa continua acessível aos participantes.</p>'+
      '<fieldset class="token-vision-settings"><legend>Escuridão e visão dos tokens</legend><label class="check"><input type="checkbox" name="darknessEnabled" '+(darkness.enabled?'checked':'')+'> Ativar escuridão nesta cena</label>'+select('visionMode','Quem compartilha a visão',{individual:'Cada jogador vê por seus próprios tokens',group:'Todos os personagens jogadores compartilham visão',teams:'Somente personagens do mesmo grupo'},darkness.mode)+'<details><summary>Grupos de visão</summary><p>Use o mesmo nome para reunir personagens. Sem grupo, cada um vê apenas pelos próprios tokens.</p>'+current.state.characters.filter(c=>!c.hidden).map(c=>input('team-'+esc(c.id),esc(c.name),darkness.teams?.[c.id]||'','text','maxlength="40"')).join('')+'</details><p class="muted">Configure o alcance e o ângulo ao editar cada token. A névoa manual continua cobrindo áreas. Paredes desenhadas na imagem não bloqueiam a visão automaticamente.</p></fieldset>'+
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
  tableCombatRoll(id,node) {rollCombatRow(node.closest('[data-combat-entry]'));},
  tableCombatRollAll() {
    const rows=[...dialog.querySelectorAll('#combat-rows [data-combat-entry]')];
    if(!rows.length)return toast('Adicione participantes para rolar iniciativa.');
    for(const rowNode of rows)rollCombatRow(rowNode);
    toast('Iniciativa rolada para '+rows.length+' participante(s). Confira e salve a ordem.');
  },
  tableRoll() {modal('Dados da mesa',dice(current.state));},
  async rollRepeat(id) {
    const view=currentView(),item=current.state.rolls?.find(r=>r.id===id);
    if(!item||!canRepeatRoll(item,view))return;
    const payload=repeatRollPayload(item,view),access=credentials,isMaster=current.master;
    await action('roll',payload);
    if(credentials!==access)return;
    if(!isMaster&&payload.visibility==='gm')toast('Rolagem secreta enviada ao mestre.');
    const form=dialog.open?dialog.querySelector('[data-form="roll"]'):null;
    if(form){
      const formula=form.elements.formula.value,actor=form.elements.actor.value,visibility=form.elements.visibility?.value||(current.master?'gm':'public');
      modal('Dados da mesa',dice(current.state,visibility));
      $('[name=formula]',dialog).value=formula;
      $('[name=actor]',dialog).value=actor;
      if($('[name=visibility]',dialog))$('[name=visibility]',dialog).value=visibility;
    }
  },
  quickDrawerTab(key) {
    const [id,tab]=String(key||'').split('/');
    if (id) openQuickDrawer(id,tab||'summary');
  },
  quickOpenFullSheet(id) {
    if (dialog.open) dialog.close();
    if (id) openSheet(id);
  },
  async quickSkillRoll(key) {
    const [characterId,skillId]=String(key||'').split('/');
    if (!characterId||!skillId) return;
    const visibility=current.master?'gm':'public';
    const access=credentials,isMaster=current.master;
    await action('roll',{characterId,skillId,visibility});
    if (credentials===access&&!isMaster&&visibility==='gm') toast('Rolagem secreta enviada ao mestre.');
  },
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

function cinematicConfig(data){
  if(!data.mediaId&&!data.text.trim())throw new Error('Escolha uma mídia ou escreva uma revelação.');
  return {...data,intro:Number(data.intro),duration:Number(data.duration),revealSeconds:Number(data.revealSeconds)};
}
const forms = {
  masterMicrophone({tokenId}){
    if(current.master)return mic.start({access:credentials,scene:current.state.sceneId,tokenId});
  },
  materialShare:data=>action('materialShare',{...data,version:Number(data.version),minutes:Number(data.minutes)}),
  playerTransfer:data=>action('playerTransfer',{...data,version:Number(data.version),quantity:Number(data.quantity)}),
  regionCreate(data){
    const [event,target]=data.trigger.split('/');
    return action('explorePlace',{kind:'region',label:data.label,event,target,sceneId:data.sceneId,x:Number(data.x),y:Number(data.y),bounds:{w:Number(data.w),h:Number(data.h)},radius:1});
  },
  explorePlace:(data,form)=>action('explorePlace',{...cluePayload(data,form),...(data.w?{bounds:{w:Number(data.w),h:Number(data.h)}}:{}),...(data.kind==='sound'?{muffle:data.muffle==='on'}:{}),x:Number(data.x),y:Number(data.y),radius:Number(data.radius)}),
  exploreConfigure:(data,form)=>action('exploreConfigure',cluePayload(data,form)),
  investigationResolve(data,form){return action(data.audience?'exploreDecide':'exploreReveal',{...data,grant:form.dataset.decision!=='deny',reward:data.reward==='on',total:data.total?Number(data.total):null});},
  clockSave:data=>action('clockSave',{...data,version:Number(data.version),segments:Number(data.segments),value:Number(data.value)}),
  clockDelete:data=>action('clockDelete',{id:data.id,version:Number(data.version)}),
  recapDelete:data=>action('recapDelete',{id:data.id,version:Number(data.version)}),
  recapSave(data,form){const fields=new FormData(form);return action('recapSave',{...data,version:Number(data.version),notes:fields.getAll('notes'),items:fields.getAll('items'),clockIds:fields.getAll('clockIds')});},
  assistOffer:data=>action('assistOffer',data),
  assistDecide:data=>action('assistDecide',data),
  checkPhysical:data=>action('checkPhysical',{...data,total:Number(data.total)}),
  checkCreate(data,form){
    const characterIds=new FormData(form).getAll('recipients');
    if(!characterIds.length)throw new Error('Selecione pelo menos um participante.');
    if(data.mode==='free'){
      return action('checkCreate',{mode:'free',label:data.label,formula:data.formula,allowHelp:data.allowHelp==='on',dc:data.dc===''?null:Number(data.dc),showDc:data.showDc==='on',characterIds});
    }
    return action('checkCreate',{allowHelp:data.allowHelp==='on',...(data.allowFallback==='on'?{allowFallback:true}:{}),test:data.test,dc:data.dc===''?null:Number(data.dc),showDc:data.showDc==='on',characterIds});
  },
  gmCounterDelta(data,form){
    const amount=Math.trunc(Number(data.amount));
    if(!Number.isSafeInteger(amount)||amount<1||amount>1000000)throw new Error('Informe um inteiro entre 1 e 1000000.');
    const sign=Number(form.dataset.submitSign||1);
    return action('sheetCounter',{id:data.id,field:data.field,delta:sign<0?-amount:amount});
  },
  gmPrivateDelta(data,form){
    const amount=Math.trunc(Number(data.amount));
    if(!Number.isSafeInteger(amount)||amount<1||amount>1000000)throw new Error('Informe um inteiro entre 1 e 1000000.');
    const sign=Number(form.dataset.submitSign||1);
    return action('gmResourceChange',{id:data.id,resourceId:data.resourceId,version:Number(data.version),operation:'delta',delta:sign<0?-amount:amount});
  },
  abilityArea(data){handlers.nav('table');tabletop.aim(data.shape,data.ability);},
  async mediaCheckStart(data){await action('mediaCheckStart',data);handlers.mediaCheckDesk();},
  openingPrepare(data){
    const scene=current.state.sceneLibrary.scenes.find(sc=>sc.id===data.scene);
    if(!scene)return;
    const theme=current.state.sheetTheme,style=theme?.style;
    handlers.cinematicDesk('',{name:'Abertura · '+scene.name,text:[scene.name,data.phrase].filter(Boolean).join(' — '),mediaId:data.mediaId,accent:theme?.trimColor,transition:style==='medieval'?'curtain':style==='future'?'rift':'ink',reveal:style==='future'?'sweep':'emerge',background:style==='medieval'?'#291d18':style==='future'?'#081921':'#201e1b',intro:2,duration:12});
  },
  async cinematicForget(data){await action('cinematicForget',data);handlers.cinematicDesk();},
  cinematicStart:data=>action('cinematicStart',cinematicConfig(data)),
  async cinematicDelete(data){await action('cinematicDelete',data);handlers.cinematicDesk();},
  async cinematicUpload(data,form){
    const file=form.elements.file.files[0],access=credentials;
    if(!file||file.size>32*1024*1024)throw new Error('Escolha uma mídia de até 32 MB.');
    const row=await request(campaignPath()+'/cinematic',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file},access).then(r=>r.json());
    if(credentials!==access)return;
    if(row.rev>=current.rev){setCurrent(row);render();}
    handlers.cinematicDesk('',{...data,revealSeconds:Number(data.revealSeconds),[file.type.startsWith('audio/')?'soundtrackId':'mediaId']:row.state.cinematicLibrary.at(-1)?.id});
  },
  async prepImport(data,form){
    const access=credentials;
    const {pending,skipped,conflicts=[]}=await collectMarkdown([...form.elements.vault.files,...form.elements.markdown.files],current.state.journal||[],data.update==='on');
    if(access!==credentials)throw new Error('A campanha mudou. Abra a importação novamente.');
    if(pending.length)await action('journalImport',{files:pending});
    if(credentials===access&&dialog.contains(form))modal('Importação concluída','<p>'+pending.length+' nota(s) processada(s). '+skipped+' caminho(s) inalterado(s) ou repetido(s).</p>'+(conflicts.length?'<p>Preservadas por edição local ou compartilhamento:</p><ul>'+conflicts.map(path=>'<li>'+esc(path)+'</li>').join('')+'</ul>':'')+button('Ver cartões importados','vaultOpen','primary'));
  },
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
    delete payload.phoneFiles;
    if(data.kind==='phone')payload.photos=await preparePhonePhotos(form,current.state.inventory?.find(i=>i.id===data.id));
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
  journal(data,form){return action('journalSave',{...journalFormData(new FormData(form)),...(data.canvasX!==undefined?{canvasPoint:{x:Number(data.canvasX),y:Number(data.canvasY)}}:{})});},
  vaultEdge(data,form){return action('gmCanvasEdge',{from:data.from,to:data.to,label:data.label,remove:form.dataset.remove==='true'});},
  journalDelete(data){return action('journalDelete',{id:data.id,version:Number(data.version)});},
  async campaignSheetTheme(data){data.emblem=await readEmblem(data,current.state.sheetTheme?.emblem);return action('campaignSheetTheme',data);},
  sheetTemplateSave(data){return action('sheetTemplateSave',{...data,shared:data.shared==='on',includeAbilities:data.includeAbilities==='on',includeAppearance:data.includeAppearance==='on'});},
  async sheetTemplateImport(data,form){const file=form.elements.file.files[0];if(!file||file.size>100*1024)throw new Error('Selecione um arquivo JSON de até 100 KB.');let bundle;try{bundle=JSON.parse(await file.text());}catch{throw new Error('O arquivo não contém JSON válido.');}return action('sheetTemplateImport',{bundle,shared:false});},
  sheetTemplateEdit(data){return action('sheetTemplateUpdate',{...data,expectedVersion:Number(data.expectedVersion),shared:data.shared==='on'});},
  sheetTemplateDelete(data){return action('sheetTemplateDelete',{id:data.id,expectedVersion:Number(data.expectedVersion)});},
  async sheetTemplateApply(data,form){const expectedHistoryVersion=Number(form.elements.characterId.selectedOptions[0].dataset.historyVersion);const row=await action('sheetTemplateApply',{templateId:data.templateId,characterId:data.characterId,expectedVersion:Number(data.expectedVersion),expectedHistoryVersion});if(row)openSheet(data.characterId);},
  async sheetTemplateCreate(data){const row=await action('character',data);if(row)openSheet(row.characterId||row.state.characters.at(-1).id);},
  create:data=>createCampaign(data.name,false,true,(data.sheetModel||data.ruleset)==='dnd-2024'?'dnd-2024':'free',data.sheetModel==='dnd-2024'?'standard':data.sheetModel||'standard'),
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
    const row=await action('character',{name:data.name,...(data.prepSession?{prepSession:data.prepSession,prepNote:data.prepNote,hidden:data.prepHidden==='yes'}:{}),color:data.color||'blue',concept:dndClasses.find(c=>c.id===config.classId)?.name||'',...(current.master?{characterType:data.characterType||'player'}:{}),dnd:config});
    const character=row?.state.characters.find(c=>c.id===row.characterId)||row?.state.characters.at(-1);
    if(character&&!data.prepSession)openSheet(character.id);
  },
  gmPartyFields(data,form){return action('gmPartyFields',{id:data.id,fields:[...form.querySelectorAll('[name=fields]:checked')].map(field=>field.value)});},
  gmCard(data,form){
    if(data.kind==='table'){
      data.noRepeat=data.noRepeat==='on';
      data.entries=[...form.querySelectorAll('[data-table-entry]')].map(row=>({
        id:row.dataset.tableEntry,text:$('[name=entryText]',row).value,weight:Number($('[name=entryWeight]',row).value)
      })).filter(entry=>entry.id||entry.text.trim());
    }
    const [targetKind,targetId]=(data.target||'').split('/');return action('gmCardSave',{...data,version:Number(data.version),wide:data.wide==='on',targetKind,targetId,page:Number(data.page)});},
  gmCardDelete:data=>action('gmCardDelete',{id:data.id,version:Number(data.version)}),
  async notes(data){const id=current.id;await action('notes',data);clearGmNoteDraft(id);if(page==='shield'&&current.id===id)render();},
  musicSession:data=>action('musicSessionSave',data),
  musicSessionDelete:data=>action('musicSessionDelete',data),
  musicTrack:data=>action('musicTrackSave',{...data,loop:data.loop==='on'}),
  musicTrackDelete:data=>action('musicTrackDelete',data),
  musicSettings:data=>action('musicSettings',{fadeIn:Number(data.fadeIn),fadeOut:Number(data.fadeOut),volume:Number(data.volume)}),
  track(data) {
    if (!audioPlayer.enabled||audioPlayer.blocked) audioPlayer.toggle();
    return action('track',{...data,command:'load'});
  },
  async roll(data) {
    localStorage.setItem('forja.actor',JSON.stringify(data.actor));
    const access=credentials,isMaster=current.master;
    await action('roll',data);
    const secret=credentials===access&&!isMaster&&data.visibility==='gm';
    if(secret)toast('Rolagem secreta enviada ao mestre.');
    return secret;
  },
  delete:data=>action(data.action,{id:data.id}),
  schema(data,form) {return action('schema',{fields:readFields(form),expectedVersion:Number(data.expectedVersion),source:data.source});},
  sheetFields(data,form) {
    const labelChanges=[...form.querySelectorAll('[data-shared-field]')].filter(input=>input.value.trim()!==input.defaultValue)
      .map(input=>({id:input.dataset.sharedField,previous:input.defaultValue,modelLabel:input.dataset.modelLabel,label:input.value.trim()}));
    return action('sheetFields',{id:data.id,layout:true,fields:readFields(form),...(labelChanges.length?{labelChanges}:{})});
  },
  sheetMastery:data=>action('sheetMastery',{...data,id:sheetId}),
  bodyStressConfig:data=>action('bodyStressConfig',{id:data.id,enabled:data.enabled==='on',mode:data.mode,limits:Object.fromEntries(Object.keys(stressRegionsFor(data.mode)).map(key=>[key,Number(data[key])]))}),
  sheetColors:data=>action('sheetAppearance',sheetColorsPayload(current.state,currentSheet(),data)),
  gmResourceSave:data=>action('gmResourceChange',{...data,operation:'save',current:Number(data.current),maximum:Number(data.maximum)}),
  gmResourceDelete:data=>action('gmResourceChange',{...data,operation:'delete'}),
  sheetResource:data=>action('sheetCounter',{id:sheetId,field:data.field,current:data.current,maximum:data.maximum}),
  savedRoll:data=>action('sheetEntry',{...data,id:sheetId,category:'rollButtons',operation:'save'}),
  sheetEntry(data) {return action('sheetEntry',{...data,id:sheetId,operation:'save',favorite:data.favorite==='true'});},
  sheetEntryDelete(data) {return action('sheetEntry',{...data,id:sheetId,operation:'delete'});},
  async sheetRoll(data) {
    const bonus=Number(data.bonus)||0;
    const formula=data.formula.trim()+(bonus>0?'+'+bonus:bonus<0?String(bonus):'');
    const options=sheetActionOptions(formula,currentSheet()),access=credentials,isMaster=current.master;
    await action('roll',{formula,actor:currentSheet().name,characterId:sheetId,...options});
    if(credentials===access&&!isMaster&&options.visibility==='gm')toast('Rolagem secreta enviada ao mestre.');
  },
  initiative(data,form) {
    const entries = [...form.querySelectorAll('[data-entry]')].map(row=>({name:$('[name=name]',row).value,value:$('[name=value]',row).value}));
    return action('initiative',{entries});
  },
  partySave:async data=>{data.emblem=await readEmblem(data,current.state.parties?.find(g=>g.id===data.id)?.emblem);await action('partySave',data);handlers.partyRoster();},
  partyDelete:async data=>{await action('partyDelete',data);handlers.partyRoster();},
  characterParty:data=>action('characterParty',{id:data.id,party:data.party,revealed:!!data.party&&data.revealed==='on'}),
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
    if (!data.id && row && !data.prepSession) openSheet(row.characterId||row.state.characters.at(-1).id);
  },
  tableAtmosphere(data){return action('tableAtmosphere',data);},
  tableSettings(data) {
    return action('tableSettings',{sceneId:data.sceneId,grid:{
      mode:data.gridMode,cellPixels:Number(data.cellPixels),columns:Number(data.columns),rows:Number(data.rows),size:Number(data.size),unit:data.unit,distance:data.distance,
      visible:data.visible==='on',snap:data.snap==='on'
    },fogMode:data.fogMode,fogEnabled:data.fogEnabled==='on',darkness:{enabled:data.darknessEnabled==='on',mode:data.visionMode||'individual',teams:Object.fromEntries(Object.entries(data).filter(([key,value])=>key.startsWith('team-')&&value.trim()).map(([key,value])=>[key.slice(5),value.trim()]))}});
  },
  async sceneEditor(data){
    const before=new Set(current.state.sceneLibrary.scenes.map(scene=>scene.id));const row=await action(data.id?'sceneUpdate':'sceneCreate',{...data,expectedVersion:Number(data.expectedVersion)});
    if(!data.id&&row){const created=row.state.sceneLibrary.scenes.find(scene=>!before.has(scene.id));if(created)await viewScene(created.id);}
  },
  async sessionEditor(data){
    const known=new Set(current.state.sceneLibrary.sessions.map(session=>session.id));
    const row=await action(data.id?'sessionUpdate':'sessionCreate',{...data,expectedVersion:Number(data.expectedVersion)});
    if(page==='shield'&&!data.id&&row){gmView.session=row.state.sceneLibrary.sessions.find(session=>!known.has(session.id))?.id;gmView.prepTab='plan';gmView.prepQuery='';}
    sceneUI.open=true;render();
  },
  tableCondition(data){return action('tokenCondition',{...data,rounds:Number(data.rounds),expectedRound:Number(data.expectedRound)});},
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
  async sheetInjury({file,resource,threshold}){
    if(!file?.size)return action('injurySettings',{id:sheetId,resource,threshold});
    return forms.upload({kind:'portrait',file,character:sheetId,injury:{resource,threshold}});
  },
  async upload({kind,file,character,cellPixels,sceneId,injury}) {
    await ensureCampaign();
    const access = credentials;
    const mapHeaders=kind==='map'?{'X-Scene-Id':sceneId||current.state.sceneId||''}:{};
    if (kind==='map') {
      const dimensions=await readMapDimensions(file);
      Object.assign(mapHeaders,{'X-Map-Width':String(dimensions.width),'X-Map-Height':String(dimensions.height),'X-Grid-Cell-Size':String(cellPixels||100)});
    }
    const response = await request(campaignPath()+'/'+kind,{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),...mapHeaders,...(injury?{'X-Portrait-Variant':'injury','X-Life-Resource':encodeURIComponent(injury.resource),'X-Life-Threshold':injury.threshold}:{}),...(character?{'X-Character-Id':character}:{})},body:file});
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
  if(event.target.matches('[data-form="investigationResolve"] [name="reward"]'))event.target.form.elements.total.required=event.target.checked;
  if(!event.target.matches('[data-form="itemSave"] [name="kind"]'))return;
  const field=event.target.form.querySelector('[data-item-uses-field]');
  updateReadingFields(event.target.form);
  field.hidden=event.target.value!=='consumable';
  field.querySelector('input').disabled=field.hidden;
});

dialog.addEventListener('change',event=>{
  if(event.target.name==='tokenPortrait'&&event.target.files?.[0]){const auto=dialog.querySelector('[name="icon"][value="auto"]');if(auto)auto.checked=true;const remove=dialog.querySelector('[name="removePortrait"]');if(remove)remove.checked=false;}
  if(event.target.name==='removePortrait'&&event.target.checked){const file=dialog.querySelector('[name="tokenPortrait"]');if(file)file.value='';}
  if(updateTokenAppearance(dialog,current.state.characters))applyPortraits(dialog);
  if(['test','mode','allowFallback'].includes(event.target.name)&&event.target.closest('[data-form=checkCreate]')){
    const checkForm=event.target.closest('[data-form=checkCreate]');
    const mode=$('[name=mode]',checkForm)?.value||'sheet';
    const testKey=$('[name=test]',checkForm)?.value||'';
    const allowFallback=Boolean($('[name=allowFallback]',checkForm)?.checked);
    const sheetSection=$('[data-check-sheet-fields]',checkForm),freeSection=$('[data-check-free-fields]',checkForm);
    if(sheetSection)sheetSection.hidden=mode!=='sheet';
    if(freeSection){
      freeSection.hidden=mode!=='free';
      for(const field of freeSection.querySelectorAll('input')){
        field.disabled=mode!=='free';
        field.required=mode==='free';
      }
    }
    const legend=$('[data-check-recipients-legend]',checkForm);
    if(legend)legend.textContent=mode==='sheet'&&!allowFallback?'Participantes com este teste':'Participantes';
    const recipients=$('[data-check-recipients]',checkForm);
    if(recipients)recipients.innerHTML=checkRecipientFields(testKey,mode,allowFallback);
  }
  if(event.target.name==='kind'&&event.target.closest('[data-form=gmCard]')){const reference=$('[data-gm-reference]',dialog);if(reference)reference.hidden=event.target.value!=='reference';
    const table=$('[data-gm-table]',dialog),body=$('[data-gm-body]',dialog);
    table.disabled=table.hidden=event.target.value!=='table';body.hidden=!table.hidden;}
  if(event.target.matches('[name=dndCategory],[name=dndTarget],[name=dndAllSpells]'))updateDndReference();
  const dndForm=event.target.closest('[data-form=dndCreate]');if(dndForm)updateDndCreation(dndForm,{esc},event.target.name==='backgroundId',event.target.name==='classId');
  if(event.target.name==='source'&&event.target.closest('[data-form=schema]')){
    const source=sheetPreset(event.target.value)||current.state.sheetTemplates?.items.find(item=>item.id===event.target.value);
    $('#schema-rows',dialog).innerHTML=(source?.fields||current.state.fields).map(schemaRow).join('');
  }
  if(event.target.matches('[data-character-preset]')) {
    const draft=Object.fromEntries(['name','concept','color','characterType','prepSession','prepNote'].map(key=>[key,$('[name='+key+']',dialog)?.value]));
    draft.hidden=Boolean($('[name=hidden]',dialog)?.checked);
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

main.addEventListener('change',event=>{if(event.target.matches('[data-sheet-mastery]'))sheetView.mastery=event.target.value;if(event.target.matches('[data-sheet-roll-mode]'))sheetView.rollMode=event.target.value;if(event.target.matches('[data-sheet-roll-visibility]'))sheetView.visibility=['public','gm'].includes(event.target.value)?event.target.value:(current.master?'gm':'public');});

function activateVaultCanvas(){
 const shell=page==='shield'&&gmView.vaultMode==='canvas'&&gmView.prepTab==='note'&&main.querySelector('.canvas-shell');
 if(!shell)return;
 mountVaultCanvas(shell,gmView,{
  save:changes=>action('gmCanvasLayout',{changes}),report:toast,
  editNote:id=>handlers.journalEdit(id),
  newNote(pos){modal('Nova nota no Canvas',input('canvasX','',pos.x,'hidden')+input('canvasY','',pos.y,'hidden')+journalEditor(null,currentView(),gmUI()),'journal');},
  editEdge(from,to){
   const edge=current.state.gmScreen?.noteEdges?.find(e=>e.from===from&&e.to===to);
   const title=id=>current.state.journal.find(n=>n.id===id)?.title||'Nota';
   modal(edge?'Editar conexão':'Conectar notas','<p>'+esc(title(from))+' → '+esc(title(to))+'</p>'+input('from','',from,'hidden')+input('to','',to,'hidden')+input('label','Rótulo (opcional)',edge?.label||'','text','maxlength="80"')+submit('Salvar conexão')+(edge?'<button type="submit" class="btn danger" value="remove">Remover conexão</button>':''),'vaultEdge');
  }
 });
}

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
  const resourceForm=event.target.form;
  if(isResourceEditor(resourceForm?.dataset.form)&&resourceForm.querySelector('[aria-invalid="true"]'))
    validateResourceForm(resourceForm,Object.fromEntries(new FormData(resourceForm)),false);
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
  if (form.dataset.form==='tableConfirm') {
    event.preventDefault();
    settleTableConfirm(true);
    if (dialog.contains(form) || dialog.open) dialog.close();
    return;
  }
  if (!forms[form.dataset.form]) return;
  event.preventDefault();
  const submitter = event.submitter || $('[type=submit]',form);
  if(form.dataset.form==='vaultEdge')form.dataset.remove=String(submitter?.value==='remove');
  if(['gmCounterDelta','gmPrivateDelta'].includes(form.dataset.form))form.dataset.submitSign=submitter?.dataset?.sign||'1';
  if (submitter) submitter.disabled=true;
  try {
    if(form.dataset.form==='investigationResolve')form.dataset.decision=submitter?.value||'';
    const data=Object.fromEntries(new FormData(form));
    if(isResourceEditor(form.dataset.form)&&!validateResourceForm(form,data,true))return;
    const result=await forms[form.dataset.form](data,form);
    if (dialog.contains(form)) {
      if (form.dataset.form==='roll') {
        const formula=form.elements.formula.value;
        const actor=form.elements.actor.value;
        const visibility=form.elements.visibility?.value||(current.master?'gm':'public');
        modal('Dados da mesa',dice(current.state,visibility));
        $('[name=formula]',dialog).value=formula;
        $('[name=actor]',dialog).value=actor;
        if($('[name=visibility]',dialog))$('[name=visibility]',dialog).value=visibility;
        if(result)toast('Rolagem secreta enviada ao mestre.');
        $('[type=submit]',dialog)?.focus();
      } else if(form.dataset.form==='create'&&form.elements?.sheetModel?.value==='blank'){
        page='sheets';render();handlers.schema();
      } else dialog.close();
    }
    if (!['roll','sheetRoll','create','campaignDelete','lootCollect','prepImport'].includes(form.dataset.form)) toast('Alterações salvas.');
  } catch(error) {
    if(isResourceEditor(form.dataset.form)&&dialog.contains(form)){
      const output=form.querySelector('#resource-form-error');
      output.hidden=false;output.textContent=error.message;
    }else toast(error.message);
  }
  finally {if (submitter) submitter.disabled=false;}
});

async function refresh(force=false) {
  if (!force && globalThis.document?.hidden === true) return;
  const access = credentials||reconnectingAccess;
  if (!access||!credentials&&openingCampaign) return;
  if(campaignRefresh?.access===access&&!force)return;
  campaignRefresh?.controller.abort();
  const task={access,controller:new AbortController()};campaignRefresh=task;
  const timeout=setTimeout(()=>task.controller.abort(),6000);
  try {
    if(!credentials&&reconnectingAccess===access){await openCampaign(access,{automatic:true});if(!credentials)return;toast('Conexão restabelecida. Seu acesso foi mantido.');return;}
    const sceneKey = current.master ? (access.sceneId || gmSceneId || '') : '';
    const etagKey = campaignEtagKey(access, sceneKey);
    const ifNoneMatch = !force && etagKey && campaignEtag.key === etagKey ? campaignEtag.value : '';
    const response = await request('/'+access.id,{signal:task.controller.signal,...(ifNoneMatch?{allowNotModified:true,headers:{'If-None-Match':ifNoneMatch}}:{})},access);
    if (response.status === 304) return;
    const nextEtag = response.headers?.get?.('ETag') || '';
    const row = await response.json();
    if (credentials!==access || row.rev<current.rev) return;
    if(current.master&&gmSceneId===current.state.activeSceneId&&row.state.activeSceneId&&row.state.activeSceneId!==gmSceneId){await viewScene(row.state.activeSceneId);return row;}
  if(current.master&&gmSceneId&&row.state.sceneId!==gmSceneId&&row.state.sceneLibrary?.scenes.some(scene=>scene.id===gmSceneId))return;
    const rememberEtag=()=>{if(nextEtag&&(!row.master||(row.state.sceneId||'')===sceneKey))campaignEtag={key:campaignEtagKey(access,row.master?row.state.sceneId||'':''),value:nextEtag};};
    rememberEtag();
    if (row.characterId!==current.characterId||row.needsCharacter!==current.needsCharacter||
        sheetId&&!current.master&&!row.state.characters.some(character=>character.id===sheetId&&character.access==='full')) {
      dialog.close();setCurrent(row);rememberEtag();render();return;
    }
    if(row.master&&row.rev>=sceneRevision){current.state.investigations=row.state.investigations;current.state.travelRequests=row.state.travelRequests;updateInvestigationAlert(current);}
    if(dialog.dataset.sharedRead&&!row.state.sharing?.received?.some(g=>g.id===dialog.dataset.sharedRead)){
      dialog.close();delete dialog.dataset.sharedRead;
    }
    if(dialog.open&&dialog.dataset.inventoryId){
      const item=row.state.inventory?.find(e=>e.id===dialog.dataset.inventoryId);
      if(!item)dialog.close();
      else if(String(item.version)!==dialog.dataset.inventoryVersion){setCurrent(row);rememberEtag();render();handlers.itemOpen(item.id);}
    }
    showInvestigationReceipt(row);
    if(!force&&row.rev===current.rev&&sceneRevision<=current.rev)return;
    audioPlayer.sync(row);
    musicDock.sync(row);soundboardDock.sync(row);audioPopover.sync(row);
    observeRolls(row);
    if(tableVisible()&&!current.needsCharacter){setCurrent(row);rememberEtag();if(!syncCurrentTable()&&!tabletop.isInteracting()&&!dialog.open)render();return;}
    const editing = Boolean(main.querySelector('.canvas-shell[data-gesture]')?.dataset.gesture)||main.contains(document.activeElement) && document.activeElement.matches('input,textarea,select,[data-vault-move],[data-table-token],iframe');
    if (row.rev>current.rev && !inlineSheet.editing && !editing && !tabletop.isInteracting() && !(page==='sheets'&&currentSheet()&&sheetMosaic.editing) && !sheetMosaic.isInteracting() && !dialog.open) {setCurrent(row);rememberEtag();render();}
  } catch(error) {if([403,404].includes(error.status)&&credentials===access){reconnectingAccess=access;entryError='Campanha temporariamente indisponível. A Forja tentará restabelecer a conexão.';credentials=null;dialog.close();setCurrent(lobby);render();}}
  finally {clearTimeout(timeout);if(campaignRefresh===task)campaignRefresh=null;}
}

let motionTimer,motionDirty=false,lastMotionSync=-Infinity,lastFullSync=-Infinity;
function scheduleMotionSync(){
  motionDirty=true;
  if(audioSyncing||motionTimer!==undefined)return;
  motionTimer=setTimeout(()=>{
    motionTimer=undefined;
    if(motionDirty&&credentials&&tableVisible())refreshAudio(true);
  },Math.max(0,80-(performance.now()-lastMotionSync)));
}
async function refreshAudio(fast=false) {
  if (globalThis.document?.hidden === true) return;
  const access=credentials;
  if (!access||audioSyncing) return;
  audioSyncing=true;motionDirty=false;lastMotionSync=performance.now();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4000);
  const started=performance.now();
  try {
    const patrol=tableVisible()&&tableLive.connected&&current.state.table?.hasPatrols;
    const motion=tableVisible()&&tabletop.explorationMotion?.();
    const motionOnly=fast&&motion&&started-lastFullSync<400;
    if(!motionOnly)lastFullSync=started;
    const tableQuery=motionOnly?'&motionOnly=1':patrol?'&table=1&patrolRev='+sceneRevision:tableVisible()&&!tableLive.connected?'&table=1':'';
    if(!motion)tabletop.syncPoints?.();
    const motionQuery=motion?'&'+new URLSearchParams(motion):'';
    const row=await request('/'+access.id+'/sync?checks='+encodeURIComponent(checkStamp)+'&checkRev='+Math.max(current.rev,sceneRevision)+'&rollVersion='+encodeURIComponent(latestRollVersion)+'&messageVersion='+encodeURIComponent(latestMessageVersion)+tableQuery+motionQuery,{signal:controller.signal},access).then(response=>response.json());
    if (access!==credentials) return;
    if(motion){
      const latest=tableVisible()&&tabletop.explorationMotion?.();
      if(!latest||latest.dragId!==motion.dragId||latest.exploreScene!==motion.exploreScene||row.rev<Math.max(current.rev,sceneRevision))return;
      if(Math.hypot(latest.x-motion.x,latest.y-motion.y)>1){scheduleMotionSync();return;}
      tabletop.syncPoints(row.state.movingPoints??null);
      if(motionOnly){if(row.state.ambient)audioPlayer.syncAmbient(row.state.ambient);return;}
    }
    if(tableVisible()&&Array.isArray(row.state.speakingTokens)){const ids=row.state.speakingTokens;showSpeech([...speechTimers.keys()].filter(id=>!ids.includes(id)),false);showSpeech(ids,true);}
    if(Object.hasOwn(row.state,'mediaCheck'))void mediaCheckSync(row.state.mediaCheck,access);
    row.serverTime+=(performance.now()-started)/2;
    audioPlayer.sync(row);
    musicDock.sync(row);soundboardDock.sync(row);audioPopover.sync(row);
    observeRolls(row);
    const frame=row.state?.patrolFrame;
    if(tableVisible()&&frame&&frame.sceneId===current.state.sceneId&&row.rev===sceneRevision){
      const moving=new Map(frame.tokens.map(t=>[t.id,t])),tokens=[];
      for(const old of current.state.tokens){
        if(!old.motion){tokens.push(old);continue;}
        if(moving.has(old.id)){tokens.push(moving.get(old.id));moving.delete(old.id);}
      }
      row.state={sceneId:frame.sceneId,tokens:[...tokens,...moving.values()],table:{...current.state.table,combat:frame.combat}};
    }
    if(tableVisible()&&row.state?.table)receiveTableEvent({type:'scene',...row});
  } catch { /* Retry the shared timeline on the next audio poll. */ }
  finally {clearTimeout(timeout);audioSyncing=false;if(motionDirty)scheduleMotionSync();}
}

dialog.addEventListener('input',event=>{
  if(!event.target.matches('input[name="toneOpacity"]'))return;
  const form=event.target.form;
  form.querySelector('[data-tone-value]').textContent=event.target.value+'%';
  form.querySelector('.vtt-atmosphere').style.setProperty('--tone-opacity',Number(event.target.value)/100);
});
dialog.addEventListener('change',event=>{
  if(event.target.name==='toneOpacity')return;
  const form=event.target.closest('[data-form="tableAtmosphere"]');
  if(form)form.querySelector('[data-atmosphere-preview]').innerHTML=renderAtmosphere(Object.fromEntries(new FormData(form)));
});

document.addEventListener('input',event=>{
  if(event.target.matches('[data-inventory-search]')){inventoryView.query=event.target.value;const shell=document.createElement('div');shell.innerHTML=renderInventory(currentView(),gmUI(),inventoryView);const results=$('[data-inventory-results]',main);if(results){results.innerHTML=$('[data-inventory-results]',shell).innerHTML;applyPortraits(results);}}
  if(event.target.matches('[data-journal-search]')){journalView.query=event.target.value;const grid=$('.journal-grid',main);if(grid){const shell=document.createElement('div');shell.innerHTML=renderJournal(currentView(),gmUI(),journalView);grid.innerHTML=$('.journal-grid',shell).innerHTML;}}
  if(event.target.matches('[data-scene-search]')){sceneUI.query=event.target.value;const cards=$('[data-scene-cards]',main);if(cards){cards.innerHTML=renderSceneCards(currentView(),sceneUI);applyPortraits();}}
  if(current.master&&page==='shield'&&event.target.matches('[data-gm-notes]')){writeGmNoteDraft(current.id,event.target.value);const status=$('[data-gm-notes-status]',main);if(status)status.textContent='Rascunho não salvo · protegido nesta aba.';}
  if(page==='shield'&&event.target.matches('[data-prep-search]')){gmView.prepQuery=event.target.value;$('[data-prep-list]',main).innerHTML=prepList(current,gmUI(),gmView);activateVaultCanvas();}
  if(page==='shield'&&event.target.matches('[data-gm-search]')){gmView.query=event.target.value;const cards=$('[data-gm-cards]',main);if(cards)cards.innerHTML=renderGmCards(currentView(),gmUI(),gmView);}
  if (event.target.matches('[data-overlay-effect-volume]')) audioPlayer.setVolume(event.target.value/100);
  if (event.target.matches('[data-music-volume]')) audioPlayer.setMusicVolume(event.target.value);
});
document.addEventListener('change',async event=>{
  if(event.target.matches('[data-inventory-scope]')){inventoryView.scope=event.target.value;render();}
  if(event.target.matches('[data-recap-filter]')){gmView.recapFilter=event.target.value;render();}
  if(event.target.matches('[data-journal-kind]')){journalView.kind=event.target.value;render();}
  if(event.target.matches('[data-dice-effects]'))diceDisplay.setEnabled(event.target.checked);
  try {
    if (!current.master) return;
    if(event.target.matches('[data-vault-sort]')){gmView.vaultSort=event.target.value;render();}
    if(event.target.matches('[data-prep-session]')){
      gmView.session=event.target.value;gmView.prepQuery='';
      const target=current.state.sceneLibrary.scenes.find(c=>c.sessionId===gmView.session);
      if(target)await viewScene(target.id);else{sceneSelectionVersion++;render();}
    }
    if(event.target.matches('[data-prep-scene]')&&event.target.value)await viewScene(event.target.value);
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
window.addEventListener?.('beforeunload',event=>{if(hasUnsavedGmNoteDraft()){event.preventDefault();event.returnValue='';}});

async function lookupBrowserSession(){
  const version=++epoch;
  checkingBrowserSession=true;entryError='';render();
  try{
    const session=await request('/session',{signal:AbortSignal.timeout(10000)},null).then(response=>response.json());
    if(version!==epoch)return;
    checkingBrowserSession=false;
    if(session.id&&!(read('forja.forgotten')||[]).includes(session.id))await openCampaign({id:session.id});
    else render();
  }catch(error){
    if(version!==epoch)return;
    entryError='Não foi possível consultar suas campanhas neste navegador.';render();
  }
}

async function initialize() {
  const invite=invitePattern.exec(location.hash);
  const id=invite?.[1]||read('forja.active');
  const known=id&&read('forja.campaigns')?.[id];
  try{
    if(invite||known)await openCampaign({id,key:known?.key||invite?.[2]});
    else await lookupBrowserSession();
  }catch{ /* The entry screen retains the invite and offers another attempt. */ }
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

dialog.addEventListener('click',event=>phoneClick(event.target));
