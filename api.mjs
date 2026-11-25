import {resolveTokenPath} from './token-motion.mjs';
import {strongEtag,matchesIfNoneMatch} from './etag.mjs';
import {mutateSharing,sharingView} from './player-sharing.mjs';
import {itemPortraits} from './item-assets.mjs';
import {mutateLoot} from './loot-model.mjs';
import {requestJson} from './request-json.mjs';
import {exportCampaignBackup,importCampaignBackup} from './campaign-backup.mjs';
import {soundboardActions,mutateSoundboard,normalizeSoundboard,sessionSounds,removeSoundFromBoards} from './soundboard-model.mjs';
import {installSoundPack} from './sound-pack-import.mjs';
import {recordItemDelivery,mutateInventory,inventoryView,commitInventory} from './inventory-model.mjs';
import {mutateJournal} from './journal-model.mjs';
import {browserSessionKey,lastBrowserCampaign,rememberBrowserSession} from './browser-session.mjs';
import {mutateNarration,narrationView} from './narration-model.mjs';
import {mutateChat,messageView,messageVersion} from './chat-model.mjs';
import {mutateSheetTemplates,readableSheetTemplate,sheetTemplateCharacter} from './sheet-template-model.mjs';
import {captureSheetChanges,recordSheetChanges,mutateSheetHistory} from './sheet-history.mjs';
import {removeSessionMaterial,sceneLibrary,sceneProjection,sceneSummary,sceneMaps,sceneTokenPortraits,withScene,mutateScenes,activeSceneId} from './scene-model.mjs';
import {validateSheetAppearance,sheetAppearance} from './sheet-layout.mjs';
import {mutateSessionLog} from './session-log.mjs';
import {mutateGmScreen,gmScreenActions,gmBoard} from './gm-screen-model.mjs';
import {dndCharacter,dndFields,dndAdd,dndDerived,dndCatalog,dndSpellFormula,dndBook,syncDndSpellSlots} from './dnd.mjs';
import {primaryCharacterResource,injuredPortrait,requestedTest,sheetRequestOptions,cinematicStyle,cinematicDisplayMs,campaignParties,tokenCharacterId,outsideParty,stressRegionsFor,bodyStressWithHead,newCampaign,characterType,isPlayerCharacter,playerVisionSource, colors, characterColorHex, rollFormulaLimit, sheetFields, sheetValue,parseDiceFormula,resolveSheetFormula,displaySheetFormula,sheetPreset,sheetAttributeTest,sheetSkillTest,sheetSavedRollFormula} from './model.mjs';
import {emptyAudio,soundPresets,audioDelay} from './media.mjs';
import {musicActions,changeMusic,musicCommand,audioView} from './music-model.mjs';
import {investigationInbox,explorationActions,mutateExploration,explorationView,ambientAt} from './exploration-model.mjs';
import {normalizeTable,playerSight,mutateTable,tableView,tableSceneActions} from './table-model.mjs';
import {canAssist,checkVersion,checkRequestView,cinematicView,accessFor,ownedCharacter,requireOwnCharacter,authorizeAction,publicState,rollView,rollVersion} from './access.mjs';

const json = (value, status = 200) => Response.json(value, {status, headers:{'Cache-Control':'no-store'}});
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const str = (value, max) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const uid = () => crypto.randomUUID();
const key = () => uid().replaceAll('-', '') + uid().slice(0,8);
const int = (value, max) => Math.max(0,Math.min(max,Math.round(Number(value)||0)));
const color = value => colors.includes(value) ? value : colors[0];
function emblemData(value){
 if(!value)return '';
 if(typeof value!=='string'||value.length>28000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+=*$/.test(value))fail(400,'Emblema PNG inválido.');
 return value;
}
const privateActions = new Set(['assistDecide','checkPhysical','regionTravelDecision','mediaCheckStart','campaignSheetTheme','checkCreate','checkClose','cinematicSave','cinematicForget','cinematicStart','cinematicStop','cinematicDelete','partySave','partyDelete','characterParty','gmResourceChange','bodyStressConfig','settings','schema','notes','initiative','tokenAdd','tokenDelete','tableSceneLife','bookDelete','track','soundPlay','soundDelete','characterType','characterVisibility','characterRelease','sheetMasteryRefresh',...musicActions,...soundboardActions,...gmScreenActions]);
const updateList = (list, entry) => list.some(item => item.id === entry.id)
  ? list.map(item => item.id === entry.id ? entry : item) : [...list, entry];
const validTypes = new Set(['text','number','counter','long','check']);
const soundTypes = ['audio/mpeg','audio/wav','audio/x-wav','audio/wave','audio/ogg','audio/webm','audio/mp4','audio/aac','audio/flac','audio/x-flac','audio/x-m4a'];
const imageTypes = ['image/png','image/jpeg','image/webp','image/gif'];

function changeAudio(state, action, data) {
  const audio = state.audio ??= emptyAudio();
  const now = Date.now();
  if (changeMusic(audio,action,data)) return;
  if(mutateSoundboard(audio,action,data))return;
  if (action === 'soundDelete') {
    removeSoundFromBoards(audio,data.id);
    audio.clips = audio.clips.filter(clip=>clip.id!==data.id);
    audio.cues = audio.cues.filter(cue=>cue.sound!==data.id);
    return;
  }
  if (action === 'soundPlay') {
    if (!sessionSounds(audio).some(sound=>sound.id===data.id)) fail(404,'Adicione este efeito à sessão ativa do soundboard antes de tocar.');
    audio.cues = [...audio.cues.filter(cue=>now-cue.at<15_000),{id:uid(),sound:data.id,at:now+audioDelay,volume:normalizeSoundboard(audio).volume}].slice(-24);
    return;
  }
  musicCommand(audio,data,now);
}

function findCharacter(state,id) {
  const character=state.characters.find(item=>item.id===id);
  if (!character) fail(404,'Ficha indisponível.');
  return character;
}

function injuryRule(state,character,resource,threshold){
  if(!sheetFields(state,character).some(f=>f.type==='counter'&&f.id===resource))fail(400,'Escolha um recurso de vida da ficha.');
  if(threshold==null||String(threshold).trim()===''||!Number.isInteger(Number(threshold))||threshold<0||threshold>100)fail(400,'Escolha uma porcentagem de 0 a 100.');
  return {resource,threshold:Number(threshold)};
}

function sheetAction(state,action,data,master) {
  const character=findCharacter(state,data.id);
  if(action==='dndAdd') {dndAdd(character,data.entryId,{allowExtra:data.allowExtra===true});return;}
  if(action==='dndRest') {
    if(!character.dnd||!['short','long'].includes(data.kind))fail(400,'Descanso inválido.');
    for(const recovery of character.dnd.recovery||[]) {
      const field=sheetFields(state,character).find(f=>f.id===recovery.id&&f.type==='counter');if(!field)continue;
      const [now,max]=String(sheetValue(character,field)).split('/').map(Number);
      if(!Number.isFinite(max)||max<0)continue;
      if(data.kind==='long'||recovery.short==='all')character.values[field.id]=max+'/'+max;
      else if(recovery.short==='one')character.values[field.id]=Math.min(max,now+1)+'/'+max;
    }
    return;
  }
  if (action==='sheetMastery') {
    const mastery=character.masteries?.find(item=>item.id===data.masteryId);
    const attribute=sheetFields(state,character).find(field=>field.id===data.attributeId&&field.type==='number');
    const parsed=parseDiceFormula(data.die);
    if(!mastery||!attribute||parsed.terms.length!==1||parsed.terms[0].count!==1||parsed.modifier!==0||parsed.terms[0].sign!==1) fail(400,'Selecione um atributo e um único dado para a maestria.');
    mastery.name=str(data.name,80)||'Maestria em '+attribute.label;
    mastery.attributeId=attribute.id;mastery.die=parsed.formula;
    return;
  }
  if (action==='sheetCounter') {
    const field=sheetFields(state,character).find(field=>field.id===data.field && field.type==='counter');
    if (!field) fail(400,'Contador inválido.');
    character.values??={};
    if(data.current!==undefined||data.maximum!==undefined) {
      const current=Number(data.current),maximum=Number(data.maximum);
      if(!['number','string'].includes(typeof data.current)||!['number','string'].includes(typeof data.maximum)||!String(data.current).trim()||!String(data.maximum).trim()||!Number.isFinite(current)||!Number.isFinite(maximum)||current<0||maximum<0||maximum>1000000||current>maximum) fail(400,'Use um valor atual entre zero e o máximo, até 1000000.');
      character.values[field.id]=current+'/'+maximum;return;
    }
    let delta;
    if (data.delta!==undefined) {
      if (data.step!==undefined||!Number.isSafeInteger(data.delta)||Math.abs(data.delta)>1_000_000) fail(400,'Contador inválido.');
      delta=data.delta;
    } else {
      if (![1,-1].includes(data.step)) fail(400,'Contador inválido.');
      delta=data.step;
    }
    const [value,limit]=sheetValue(character,field).split('/');
    const max=Number(limit);
    if (!limit || !Number.isFinite(max) || max<0) fail(400,'Defina o valor máximo na edição da ficha.');
    const next=Math.min(max,Math.max(0,(Number(value)||0)+delta));
    character.values[field.id]=next+'/'+limit;
    return;
  }
  if(action==='injurySettings'){
    if(data.remove===true){delete character.injury;return;}
    if(!character.injury?.image)fail(400,'Envie um retrato de pouca vida.');
    Object.assign(character.injury,injuryRule(state,character,data.resource,data.threshold));
    return;
  }
  if (action==='sheetPortraitDelete') {
    delete character.portrait;
    return;
  }
  if (action==='sheetFields') {
    if (data.layout===true) {
      if(!Array.isArray(data.fields)||data.fields.length>100) fail(400,'Use até 100 campos por ficha.');
      if(data.labelChanges!==undefined){
        if(!master)fail(403,'Somente o mestre pode renomear campos do modelo nesta ficha.');
        if(!state.sheetModelVersion||!Array.isArray(data.labelChanges)||data.labelChanges.length>100)fail(400,'Alterações de nome inválidas.');
        const labels={...character.fieldLabels};
        for(const change of data.labelChanges){
          const field=state.fields.find(item=>item.id===change?.id);
          if(!field||field.label!==change.modelLabel||(labels[field.id]??'')!==change.previous)fail(409,'Um nome mudou. Reabra a ficha antes de salvar.');
          if(typeof change.label!=='string'||change.label.length>80)fail(400,'Use até 80 caracteres no nome do campo.');
          const label=change.label.trim();
          if(label&&label!==field.label)labels[field.id]=label;
          else delete labels[field.id];
        }
        if(Object.keys(labels).length)character.fieldLabels=labels;
        else delete character.fieldLabels;
      }
      const known=new Set(sheetFields(state,character).map(field=>field.id));
      const seen=new Set();
      const layout=data.fields.map(field=>{
        const id=str(field?.id,60),label=str(field?.label,80);
        if((!known.has(id)&&!/^local-[a-f0-9]{32}$/.test(id))||seen.has(id)||!label||!validTypes.has(field.type)) fail(400,'Campo inválido ou duplicado.');
        seen.add(id);
        return {id,label,group:str(field.group,80)||'Geral',type:field.type,initial:str(field.initial,2000)};
      });
      if(state.sheetModelVersion){
        for(const field of state.fields)seen.add(field.id);
      }
      character.layout=state.sheetModelVersion?layout.filter(field=>!state.fields.some(shared=>shared.id===field.id)):layout;
      delete character.fields;
      character.values=Object.fromEntries(Object.entries(character.values||{}).filter(([id])=>seen.has(id)));
      return;
    }
    if (!Array.isArray(data.fields) || data.fields.length>40) fail(400,'Use até 40 campos próprios.');
    const seen=new Set(state.fields.map(field=>field.id));
    character.fields=data.fields.map(field=>{
      const id=str(field?.id,60);
      const label=str(field?.label,80);
      if (!/^local-[a-f0-9]{32}$/.test(id) || seen.has(id) || !label || !validTypes.has(field.type)) fail(400,'Campo próprio inválido ou duplicado.');
      seen.add(id);
      return {id,label,group:str(field.group,80)||'Geral',type:field.type,initial:str(field.initial,2000)};
    });
    for (const id of Object.keys(character.values)) {
      if (id.startsWith('local-') && !seen.has(id)) delete character.values[id];
    }
    return;
  }
  const category=data.category;
  if (!['skills','abilities','rollButtons'].includes(category)) fail(400,'Tipo de item inválido.');
  const entries=character[category]||[];
  const existing=entries.find(item=>item.id===data.entry);
  if (data.entry && !existing) fail(404,'Item indisponível.');
  if (data.operation==='delete' && existing) {
    character[category]=entries.filter(item=>item!==existing);
    return;
  }
  if (data.operation==='favorite' && existing && category==='skills') {
    existing.favorite=!existing.favorite;
    return;
  }
  if (data.operation!=='save') fail(400,'Operação inválida.');
  const name=str(data.name,80);
  if (!name) fail(400,'Informe um nome.');
  if (!existing && entries.length>=60) fail(409,'Limite de 60 itens por categoria atingido.');
  const id=existing?.id||uid();
  const number=value=>Math.max(-999,Math.min(999,Math.trunc(Number(value)||0)));
  const attribute=sheetFields(state,character).find(field=>field.id===data.attribute && field.type==='number')?.id||'';
  if(category==='rollButtons') {
    const resolved=resolveSheetFormula(data.formula,state,character);
    character.rollButtons=updateList(entries,{id,name,formula:resolved.template});
    return;
  }
  const entry=category==='skills'
    ? {id,name,attribute,base:number(data.base),bonus:number(data.bonus),other:number(data.other),favorite:data.favorite===true,...(character.dnd?{rank:[0,1,2].includes(Number(data.rank))?Number(data.rank):existing?.rank||0}:{})}
    : {id,name,description:str(data.description,4000)};
  if(category==='abilities'){
    const shape=data.effectShape??existing?.effectShape;
    if(shape){
      const length=Number(data.effectLength??existing?.effectLength);
      if(!['cone','beam','burst'].includes(shape)||!Number.isFinite(length)||length<=0||length>10000)fail(400,'Escolha um alcance válido para a área.');
      Object.assign(entry,{effectShape:shape,effectLength:length});
    }
  }
  character[category]=updateList(entries,entry);
}

function validateActionAccess(state,action,data,access){
  authorizeAction(state,access,action,data);
  if(privateActions.has(action)&&!access.master)fail(403,'Ação reservada ao mestre.');
  if(action==='gmCardSave'&&data.kind==='reference'&&data.targetKind==='rule'&&!dndCatalog.some(entry=>entry.id===data.targetId))fail(400,'Regra indisponível.');
}

function prepareMaterial(state,data,access,kind,id){
  if(!data.prepSession)return;
  if(!access.master||data.id)fail(403,'A preparação cria materiais como mestre.');
  mutateScenes(state,'sessionMaterial',{sessionId:data.prepSession,id,kind,attached:true},true);
  if(data.prepNote&&kind==='character'){
    const note=state.journal?.find(entry=>entry.id===data.prepNote);
    if(!note)fail(409,'A anotação de origem foi removida.');
    note.characterIds=[...(note.characterIds||[]).filter(key=>state.characters.some(c=>c.id===key)),id];
    note.version++;
  }
}

function createCheckRequest(state,data){
  const ids=data.characterIds;
  if(!Array.isArray(ids)||!ids.length||ids.length>60||new Set(ids).size!==ids.length)fail(400,'Escolha até 60 personagens diferentes.');
  const dc=data.dc??null;
  if(dc!==null&&(!Number.isInteger(dc)||Math.abs(dc)>999))fail(400,'Confira a dificuldade.');
  const isFree=data.mode==='free'||data.freeFormula!==undefined;
  let label='',targets;
  if(isFree){
    const parsed=parseDiceFormula(data.freeFormula??data.formula);
    if(data.label!==undefined&&(typeof data.label!=='string'||!data.label.trim()||data.label.trim().length>80))fail(400,'Informe um nome de 1 a 80 caracteres para o teste.');
    label=data.label!==undefined?data.label.trim():('Teste · '+parsed.formula);
    targets=ids.map(id=>{
      const c=state.characters.find(c=>c.id===id&&c.ownerId&&!c.hidden&&isPlayerCharacter(c));
      if(!c)fail(409,'Um dos personagens já não está disponível.');
      return {characterId:c.id,name:c.name,memberId:c.ownerId,kind:'free',formula:parsed.formula,label,result:null};
    });
  }else{
    const hasCustomFallback=data.fallbackFormula!==undefined&&data.fallbackFormula!==null&&data.fallbackFormula!=='';
    if(hasCustomFallback&&typeof data.fallbackFormula!=='string')fail(400,'Fórmula alternativa inválida.');
    const useFallback=data.allowFallback===true||hasCustomFallback;
    const fallback=hasCustomFallback?parseDiceFormula(data.fallbackFormula).formula:'1d20';
    if(useFallback&&(typeof data.test!=='string'||!/^(?:attribute|skill|saved):.+/.test(data.test)))fail(400,'Escolha um teste válido.');
    targets=ids.map(id=>{
      const c=state.characters.find(c=>c.id===id&&c.ownerId&&!c.hidden&&isPlayerCharacter(c));
      if(!c)fail(409,'Um dos personagens já não está disponível.');
      const matches=sheetRequestOptions(state,c).filter(o=>o.key===data.test);
      if(matches.length===1){
        const option=matches[0];label=option.name;
        return {characterId:c.id,name:c.name,memberId:c.ownerId,kind:option.kind,testId:option.id,result:null};
      }
      if(!useFallback)fail(400,'O teste precisa ter um nome único em cada ficha selecionada.');
      return {characterId:c.id,name:c.name,memberId:c.ownerId,kind:'free',formula:fallback,label:'',result:null};
    });
    if(!label){
      label=state.characters.flatMap(c=>sheetRequestOptions(state,c)).find(o=>o.key===data.test)?.name||str(data.label,80)||'Teste ('+fallback+')';
    }
    for(const target of targets)if(target.kind==='free'&&!target.label)target.label=label;
  }
  const checks=state.checkRequests??=[];
  if(checks.length>=30)fail(409,'Encerre um pedido anterior para abrir espaço.');
  const request={id:uid(),label,targets,dc,...(data.allowHelp===true?{allowHelp:true}:{}),showDc:data.showDc===true,closed:false};
  checks.unshift(request);return request.id;
}

function makeSheetRoll(state,data,access,help){
  const {master}=access;
  const own=ownedCharacter(state,access);
  if(!master&&data.characterId&&data.characterId!==own?.id) fail(403,'Você pode rolar apenas pela própria ficha.');
  const character=master&&data.characterId ? findCharacter(state,data.characterId) : own;
  const button=data.rollId?(character?.rollButtons||[]).find(item=>item.id===data.rollId):null;
  if(data.rollId&&!button) fail(404,'Rolagem salva indisponível.');
  if([data.rollId,data.attributeId,data.skillId].filter(Boolean).length>1)fail(400,'Escolha apenas uma rolagem da ficha.');
  if((data.attributeId||data.skillId)&&!character)fail(400,'Escolha uma ficha para testar.');
  const test=data.attributeId?sheetAttributeTest(state,character,data.attributeId,data.testDice):data.skillId?sheetSkillTest(state,character,data.skillId,data.testDice):null;
  const resolved=resolveSheetFormula(button?sheetSavedRollFormula(character,button):test?.formula??data.formula,state,character);
  let formula=resolved.formula;
  if(data.mode&&data.mode!=='normal') {
    if(!['advantage','disadvantage'].includes(data.mode)||!/^1?d20(?:[+-]|$)/.test(formula))fail(400,'Vantagem e desvantagem se aplicam a um teste com um d20.');
    formula=formula.replace(/^1?d20/,'2d20'+(data.mode==='advantage'?'kh1':'kl1'));
  }
  const mastery=data.masteryId?character?.masteries?.find(item=>item.id===data.masteryId):null;
  if(data.masteryId) {
    if(!mastery) fail(400,'Maestria indisponível.');
    if(mastery.remaining<1) fail(409,'A maestria já foi usada nesta sessão.');
    if(!resolved.bindings.some(field=>field.id===mastery.attributeId)) fail(400,'Esta maestria só pode ser usada em testes do atributo vinculado.');
    formula+='+'+mastery.die;
  }
  if(help&&help.effect!=='advantage')formula+='+'+help.effect;
  const result=rollDice(formula);
  if(help)result.help={name:help.name,effect:help.effect};
  if(data.mode&&data.mode!=='normal')result.mode=data.mode;
  if(mastery) {mastery.remaining--;result.mastery={name:mastery.name,die:mastery.die};}
  if(button) result.label=button.name;
  else if(test)result.label=test.label;
  else {const label=str(data.label,80);if(label)result.label=label;}
  if(resolved.bindings.length) {
    result.expression=displaySheetFormula(resolved.template,state,character);
    result.bindings=resolved.bindings;
  }
  const visibility=['public','gm'].includes(data.visibility)?data.visibility:(master?'gm':'public');
  return {id:uid(),at:Date.now(),rolledBy:master?'master':'player',visibility,actor:master?str(data.actor,60)||'Mestre':own.name,
    ...(character?{characterId:character.id,diceColor:sheetAppearance(state,character).options.accent}:{}),kind:button&&(button.id==='dd-initiative'||/^iniciativa$/i.test(button.name?.trim()))?'initiative':'check',...result};
}

function mediaCheckView(state,access){
  const check=state.mediaCheck;
  if(!check||Date.now()>check.until)return null;
  const own=ownedCharacter(state,access);
  if(!access.master&&(!own||!check.players.some(p=>p.id===own.id&&p.owner===access.memberId)||check.party&&own.party!==check.party))return null;
  return {id:check.id,assets:check.assets,...(access.master?{players:check.players.map(({name,status})=>({name,status}))}:{})};
}
function mutate(state, action, data, access) {
  const {master}=access;
  validateActionAccess(state,action,data,access);
  if(action==='regionTravelDecision'){
    const region=state.table?.exploration?.find(p=>p.travelRequest?.id===data.id);
    if(!region||typeof data.approve!=='boolean')fail(409,'Este pedido de passagem já foi encerrado.');
    const target=region.travelRequest.target;
    delete region.travelRequest;
    if(data.approve)mutateScenes(state,'sceneActivate',{id:target},true);
    else region.travelQuietUntil=Date.now()+30000;
    return;
  }
  if(action==='mediaCheckStart'){
    const cue=data.cue&&state.cinematicCues?.find(c=>c.id===data.cue);
    if(data.cue&&!cue)fail(404,'Preparação indisponível.');
    const map=sceneProjection(state,data.sceneId).map;
    const assets=cue?[cue.mediaId,cue.soundtrackId].filter(Boolean):[map?.id].filter(Boolean);
    if(!assets.length)fail(400,'Selecione um mapa ou uma preparação com mídia.');
    state.mediaCheck={id:uid(),assets:[...new Set(assets)],party:cue?.party||'',until:Date.now()+600000,players:state.characters.filter(c=>c.ownerId&&!c.hidden&&(!cue?.party||c.party===cue.party)).map(c=>({id:c.id,owner:c.ownerId,name:c.name,status:'Aguardando'}))};return;
  }
  if(action==='mediaCheckReport'){
    if(!mediaCheckView(state,access)||state.mediaCheck.id!==data.id||!['Carregado','Falhou'].includes(data.status))fail(409,'Teste encerrado.');
    const player=state.mediaCheck.players.find(p=>p.owner===access.memberId);if(!player)fail(403,'Participante indisponível.');
    player.status=data.status;return;
  }
  if(action==='investigationReceiptRead'){
    const own=ownedCharacter(state,access);
    if(!own)fail(403,'Escolha seu personagem.');
    state.investigationReceipts=(state.investigationReceipts||[]).filter(r=>!(r.id===data.id&&r.characterId===own.id&&r.memberId===access.memberId));
    return;
  }
  if(mutateSharing(state,action,data,ownedCharacter(state,access)))return;
  if(mutateSessionLog(state,action,data,master))return;
  if(mutateNarration(state,action,data,access))return;
  if(mutateChat(state,action,data,access))return;
  if(mutateInventory(state,action,data,access)){
    if(action==='itemGrant')recordItemDelivery(state,state.characters.find(c=>c.id===data.characterId),[state.inventory.at(-1)],{from:'Mestre'});
    if(action==='itemSave'&&data.prepSession)prepareMaterial(state,data,access,'item',state.inventory.at(-1).id);
    return;
  }
  const lootResult=mutateLoot(state,action,data,access);if(lootResult)return lootResult;
  if(mutateJournal(state,action,data,access)){
    if(action==='journalDelete')removeSessionMaterial(state,'note',data.id);
    if(action==='journalDelete'&&state.gmScreen){
      if(state.gmScreen.notePositions)delete state.gmScreen.notePositions[data.id];
      if(state.gmScreen.noteEdges)state.gmScreen.noteEdges=state.gmScreen.noteEdges.filter(edge=>edge.from!==data.id&&edge.to!==data.id);
    }
    if(action==='journalSave'&&!data.id&&data.canvasPoint){
      const note=state.journal.at(-1);
      mutateGmScreen(state,'gmCanvasLayout',{changes:[{id:note.id,x:data.canvasPoint.x,y:data.canvasPoint.y}]},master);
    }
    return;
  }
  if(mutateSheetTemplates(state,action,data,access))return;
  if(mutateSheetHistory(state,action,data,access))return;
  if(mutateGmScreen(state,action,data,master))return;
  if(mutateScenes(state,action,data,master))return;
  if(explorationActions.has(action)){
    return withScene(state,data.sceneId,master,world=>{
      mutateExploration(world,action,data,access);
      if(world!==state){
        if(world.inventory)state.inventory=world.inventory;
        if(world.investigationReceipts)state.investigationReceipts=world.investigationReceipts;
      }
    });
  }
  if(tableSceneActions.has(action)){
    const actor=ownedCharacter(state,access);
    const liveMove=action==='tokenMove'&&(!data.sceneId||data.sceneId===activeSceneId(state));
    const oldEntries=liveMove?new Map((state.table?.exploration||[]).map(p=>[p.id,p.lastEntry?.id])):null;
    withScene(state,data.sceneId,master,world=>mutateTable(world,action,data,master,master?'Mestre':actor?.name,actor?.id));
    if(liveMove){
      const entered=(state.table?.exploration||[]).filter(p=>p.lastEntry&&oldEntries.get(p.id)!==p.lastEntry.id);
      for(const region of entered){
        if(region.event==='cinematic'){
          const cue=state.cinematicCues?.find(c=>c.id===region.target);
          if(cue)mutate(state,'cinematicStart',cue,{master:true});
        }
        const destination=region.event==='scene'?region.target:region.bounds&&region.destination;
        if(destination&&sceneSummary(state).scenes.some(s=>s.id===destination)){
          if(!region.travelRequest&&!(region.travelQuietUntil>Date.now()))
            region.travelRequest={id:uid(),name:region.lastEntry.name,target:destination};
        }
      }
    }
    return;
  }
  if(soundboardActions.has(action)){changeAudio(state,action,data);return;}
  if (musicActions.has(action)) {changeAudio(state,action,data);return;}
  switch (action) {
    case 'sheetValue': {
      const character=findCharacter(state,data.id);
      if(data.category){
        if(!['skills','abilities','rollButtons'].includes(data.category))fail(400,'Categoria inválida.');
        const entry=character[data.category]?.find(e=>e.id===data.entry);
        if(!entry)fail(404,'Item indisponível.');
        const properties=data.category==='skills'?['name','base','bonus','other']:data.category==='abilities'?['name','description']:['name'];
        if(!properties.includes(data.property))fail(400,'Informação indisponível.');
        const before=String(entry[data.property]??(['base','bonus','other'].includes(data.property)?0:''));
        if(data.before!==before)fail(409,'Esta informação mudou em outra aba. Atualize a ficha antes de salvar.');
        if(typeof data.value!=='string')fail(400,'Valor inválido.');
        if(['base','bonus','other'].includes(data.property)){
          if(character.dnd&&data.property==='bonus'||data.property==='base'&&entry.attribute)fail(400,'Este valor é calculado pelo atributo ou sistema.');
          const value=Number(data.value);
          if(!data.value.trim()||!Number.isInteger(value)||Math.abs(value)>999)fail(400,'Use um número inteiro entre -999 e 999.');
          entry[data.property]=value;
        }else{
          const limit=data.property==='description'?4000:80;
          if(data.value.length>limit||data.property==='name'&&!data.value.trim())fail(400,'Preencha o campo e respeite o limite de '+limit+' caracteres.');
          entry[data.property]=data.value.trim();
        }
      }else if(['name','concept','color'].includes(data.property)){
        if(character[data.property]!==data.before)fail(409,'Este campo mudou em outra aba. Atualize a ficha antes de salvar.');
        if(data.property==='name'&&(!str(data.value,80)))fail(400,'Informe o nome do personagem.');
        if(data.property==='color'&&!colors.includes(data.value))fail(400,'Cor inválida.');
        if(data.property==='color'&&character.appearance?.options?.accent===characterColorHex(character.color))character.appearance={...character.appearance,version:(character.appearance.version||0)+1,options:{...character.appearance.options,accent:characterColorHex(data.value)}};
        character[data.property]=data.property==='color'?data.value:str(data.value,80);
      }else{
        const field=sheetFields(state,character).find(f=>f.id===data.field);
        if(!field)fail(400,'Campo indisponível.');
        if(character.dnd&&(['dd-class','dd-species','dd-background'].includes(field.id)||dndDerived(character,field.id)!==null))fail(400,'Este campo é calculado pelo sistema.');
        const before=String(sheetValue(character,field));
        if(before!==data.before)fail(409,'Este campo mudou em outra aba. Atualize a ficha antes de salvar.');
        if(typeof data.value!=='string'||data.value.length>4000)fail(400,'Use até 4000 caracteres.');
        const value=data.value.trim();
        if(field.type==='number'&&(value===''||!Number.isFinite(Number(value))))fail(400,'Informe um número válido.');
        if(field.type==='check'&&!['true','false'].includes(value))fail(400,'Marcação inválida.');
        if(field.type==='counter'){
          const parts=value.split('/'),[now,max]=parts.map(Number);
          if(parts.length!==2||parts.some(p=>!p.trim())||!Number.isFinite(now)||!Number.isFinite(max)||now<0||max<0||max>1000000||now>max)fail(400,'Use atual/máximo, com atual entre zero e o máximo (até 1000000).');
        }
        if(character.dnd&&field.id==='dd-level'&&(!Number.isInteger(Number(value))||Number(value)<1||Number(value)>20))fail(400,'O nível deve estar entre 1 e 20.');
        if(character.dnd&&/^dd-(str|dex|con|int|wis|cha)$/.test(field.id)&&(!Number.isInteger(Number(value))||Number(value)<1||Number(value)>30))fail(400,'Atributos devem estar entre 1 e 30.');
        character.values??={};character.values[field.id]=value;
        if(character.dnd&&field.id==='dd-level')syncDndSpellSlots(character,Number(value));
      }
      break;
    }
    case 'gmResourceChange': {
      const character=findCharacter(state,data.id);
      const resources=(state.gmResources??={})[character.id]??=[];
      const resource=resources.find(item=>item.id===data.resourceId);
      if(data.resourceId&&!resource)fail(404,'Recurso privado não encontrado.');
      if(data.operation==='step'||data.operation==='delta'||(data.operation===undefined&&data.delta!==undefined)){
        if(!resource)fail(400,'Ajuste inválido.');
        let delta;
        if(data.delta!==undefined){
          if(data.step!==undefined||!Number.isSafeInteger(data.delta)||Math.abs(data.delta)>1_000_000)fail(400,'Ajuste inválido.');
          delta=data.delta;
        }else{
          if(![1,-1].includes(data.step))fail(400,'Ajuste inválido.');
          delta=data.step;
        }
        if(data.version!==undefined&&(!Number.isSafeInteger(Number(data.version))||resource.version!==Number(data.version)))fail(409,'Este recurso mudou. Abra o editor novamente.');
        resource.current=Math.max(0,Math.min(resource.maximum,resource.current+delta));
        resource.version++;
        break;
      }
      if(resource&&resource.version!==Number(data.version))fail(409,'Este recurso mudou. Abra o editor novamente.');
      if(data.operation==='delete'&&resource){
        state.gmResources[character.id]=resources.filter(item=>item.id!==resource.id);
        break;
      }
      if(data.operation!=='save')fail(400,'Operação inválida.');
      if(!resource&&resources.length>=100)fail(409,'Limite de 100 recursos privados por ficha.');
      const name=str(data.name,80),{current,maximum}=data;
      if(!name||![current,maximum].every(Number.isSafeInteger)||current<0||current>maximum||maximum>1000000)fail(400,'Informe um nome e valores inteiros entre zero e o máximo de 1000000.');
      if(typeof data.color!=='string'||!/^#[a-f0-9]{6}$/i.test(data.color))fail(400,'Cor inválida.');
      state.gmResources[character.id]=updateList(resources,{id:resource?.id||uid(),name,current,maximum,color:data.color,version:(resource?.version||0)+1});
      break;
    }
    case 'settings':
      state.name = str(data.name,100) || state.name;
      state.system = str(data.system,80);
      state.description = str(data.description,800);
      state.scene = str(data.scene,100) || state.scene;
      if(state.sceneLibrary){const active=state.sceneLibrary.scenes.find(item=>item.id===state.sceneLibrary.activeId);if(active)active.name=state.scene;}
      break;
    case 'schema': {
      if (!Array.isArray(data.fields) || data.fields.length > 100) fail(400,'Use até 100 campos.');
      if(data.expectedVersion!==undefined&&data.expectedVersion!==(state.sheetModelVersion||0))fail(409,'O modelo mudou em outra aba. Reabra o editor.');
      const previous=state.fields;
      const seen = new Set();
      state.fields = data.fields.map(field => {
        const id = field?.id || uid();
        if(typeof id!=='string'||!/^[\w:-]{1,60}$/.test(id)||id in Object.prototype)fail(400,'Identificador de campo inválido.');
        if (seen.has(id) || !str(field.label,80) || !validTypes.has(field.type)) fail(400,'Campo inválido ou duplicado.');
        seen.add(id);
        return {id,label:str(field.label,80),group:str(field.group,80)||'Geral',type:field.type,initial:str(field.initial,2000)};
      });
      if(state.sheetModelVersion||data.expectedVersion!==undefined){
        if(state.ruleset==='dnd-2024'&&dndFields().some(core=>!state.fields.some(f=>f.id===core.id&&f.type===core.type)))fail(400,'Mantenha os campos do sistema D&D e seus tipos.');
        for(const character of state.characters){
          const prior=sheetFields({...state,fields:previous},character);
          character.values ||= {};
          for(const field of [...prior,...state.fields])character.values[field.id] ??= field.initial;
          for(const field of prior){
            if(state.fields.some(shared=>shared.id===field.id&&shared.type!==field.type))fail(409,'O tipo de '+field.label+' é usado em uma ficha. Adicione um novo campo com outro nome.');
          }
          // Retired fields stay on existing sheets with their original values.
          character.layout=prior.filter(field=>!seen.has(field.id));
          const labels={...character.fieldLabels};
          for(const id of Object.keys(labels))if(!seen.has(id))delete labels[id];
          if(!state.sheetModelVersion)for(const field of prior){
            const inherited=previous.find(item=>item.id===field.id);
            if(inherited&&seen.has(field.id)&&inherited.label!==field.label)labels[field.id]=field.label;
          }
          if(Object.keys(labels).length)character.fieldLabels=labels;
          else delete character.fieldLabels;
          delete character.fields;
        }
        if(data.source){
          const preset=sheetPreset(data.source);
          const starter=preset||sheetTemplateCharacter(readableSheetTemplate(state,access,data.source));
          const {skills,abilities,rollButtons,masteries,appearance}=starter;
          state.sheetStarter={skills,abilities,rollButtons,masteries,appearance};
        }
        if(state.sheetStarter){
          const starter=state.sheetStarter;
          const numbers=new Set(state.fields.filter(field=>field.type==='number').map(field=>field.id));
          starter.skills=starter.skills?.filter(skill=>!skill.attribute||numbers.has(skill.attribute));
          starter.masteries=starter.masteries?.filter(item=>numbers.has(item.attributeId));
          starter.rollButtons=starter.rollButtons?.filter(item=>Array.from(item.formula.matchAll(/@\{([^}]+)\}/g),match=>match[1]).every(id=>seen.has(id)));
          if(data.source)for(const character of state.characters){
            for(const key of ['skills','abilities','rollButtons','masteries']){
              const entries=character[key]||[];
              const existing=new Set(entries.map(entry=>entry.id));
              character[key]=[...entries,...structuredClone((starter[key]||[]).filter(entry=>!existing.has(entry.id)))];
            }
          }
        }
        state.sheetModelVersion=(state.sheetModelVersion||0)+1;
      }
      break;
    }
    case 'characterClaim': {
      if (master) fail(400,'O mestre já tem acesso às fichas.');
      const character=findCharacter(state,data.id);
      if (character.hidden||!isPlayerCharacter(character)||outsideParty(character,ownedCharacter(state,access))) fail(404,'Personagem indisponível.');
      const own=ownedCharacter(state,access);
      if (own&&own.id!==character.id) fail(409,'Você já escolheu um personagem.');
      if (character.ownerId&&character.ownerId!==access.memberId) fail(409,'Este personagem já foi escolhido por outro jogador.');
      character.ownerId=access.memberId;
      break;
    }
    case 'cinematicForget':
      state.cinematicCues=(state.cinematicCues||[]).filter(c=>c.id!==data.id);
      break;
    case 'cinematicSave':
    case 'cinematicStart': {
      const {mediaId='',soundtrackId='',party='',intro,duration}=data;
      if(mediaId&&!state.cinematicLibrary?.some(a=>a.id===mediaId&&!a.type.startsWith('audio/')))fail(404,'Mídia indisponível.');
      if(soundtrackId&&!state.cinematicLibrary?.some(a=>a.id===soundtrackId&&a.type.startsWith('audio/')))fail(404,'Trilha indisponível.');
      if(party&&!campaignParties(state).some(g=>g.id===party))fail(400,'Grupo indisponível.');
      if(!Number.isInteger(intro)||intro<0||intro>30||!Number.isInteger(duration)||duration<1||duration>600)fail(400,'Confira os tempos de entrada e revelação.');
      const text=str(data.text,240);
      if(!mediaId&&!text)fail(400,'Escolha uma mídia ou escreva uma revelação.');
      const style=cinematicStyle(data);
      if(action==='cinematicSave'){
        const name=str(data.name,80),cues=state.cinematicCues??=[];
        if(!name)fail(400,'Dê um nome à cinemática para guardá-la.');
        if(data.id&&!cues.some(c=>c.id===data.id))fail(409,'Esta cinemática foi excluída.');
        if(!data.id&&cues.length>=60)fail(409,'A campanha comporta 60 cinemáticas preparadas.');
        state.cinematicCues=updateList(cues,{id:data.id||uid(),name,text,mediaId,soundtrackId,party,intro,duration,...style});
        break;
      }
      const startedAt=Date.now(),revealAt=startedAt+intro*1000;
      state.cinematicRun={id:uid(),mediaId,soundtrackId,party,text,...style,startedAt,revealAt,endsAt:revealAt+cinematicDisplayMs(duration,text,style.captionSpeed)};
      break;
    }
    case 'cinematicStop':
      if(state.cinematicRun?.id===data.id)delete state.cinematicRun;
      break;
    case 'cinematicDelete':
      if(state.cinematicRun&&[state.cinematicRun.mediaId,state.cinematicRun.soundtrackId].includes(data.id)&&state.cinematicRun.endsAt>Date.now())fail(409,'Encerre a exibição antes de excluir a mídia.');
      if(state.cinematicCues?.some(c=>c.mediaId===data.id||c.soundtrackId===data.id))fail(409,'Remova esta mídia das cinemáticas preparadas antes de excluí-la.');
      state.cinematicLibrary=(state.cinematicLibrary||[]).filter(a=>a.id!==data.id);
      break;
    case 'partySave': {
      const parties=campaignParties(state);
      const current=data.id?parties.find(p=>p.id===data.id):null;
      if(data.id&&!current)fail(404,'Grupo indisponível.');
      const name=typeof data.name==='string'?data.name.trim():'';
      if(!name||name.length>80)fail(400,'Informe um nome de até 80 caracteres.');
      if(parties.some(p=>p.id!==current?.id&&p.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))fail(409,'Já existe um grupo com esse nome.');
      const emblem=emblemData(data.emblem??current?.emblem);
      state.parties=updateList(parties,{id:current?.id||uid(),name,...(emblem?{emblem}:{})});
      break;
    }
    case 'partyDelete': {
      const parties=campaignParties(state);
      if(!parties.some(p=>p.id===data.id))fail(404,'Grupo indisponível.');
      state.parties=parties.filter(p=>p.id!==data.id);
      for(const character of state.characters){
        if(character.party===data.id){delete character.party;delete character.partyRevealed;}
      }
      break;
    }
    case 'characterParty': {
      const character=findCharacter(state,data.id);
      const parties=campaignParties(state);
      if(!isPlayerCharacter(character)||(data.party!==''&&!parties.some(p=>p.id===data.party))||typeof data.revealed!=='boolean')fail(400,'Configuração de grupo inválida.');
      state.parties=parties;
      if(data.party){character.party=data.party;character.partyRevealed=data.revealed;}
      else {delete character.party;delete character.partyRevealed;}
      break;
    }
    case 'characterVisibility': {
      if (typeof data.hidden!=='boolean') fail(400,'Visibilidade inválida.');
      const character=findCharacter(state,data.id);
      character.hidden=data.hidden;
      if (data.hidden) delete character.ownerId;
      break;
    }
    case 'characterType': {
      if(!['player','npc'].includes(data.characterType))fail(400,'Tipo de ficha inválido.');
      const character=findCharacter(state,data.id);character.characterType=data.characterType;if(!isPlayerCharacter(character))delete character.ownerId;
      break;
    }
    case 'characterRelease': {
      delete findCharacter(state,data.id).ownerId;
      break;
    }
    case 'character': {
      const old = data.id ? findCharacter(state,data.id) : null;
      if (!old && state.characters.length >= 100) fail(409,'Limite de fichas atingido.');
      const name = str(data.name,80);
      if (!name) fail(400,'Informe o nome do personagem.');
      if(!old&&[Boolean(data.dnd),Boolean(data.preset),Boolean(data.templateId)].filter(Boolean).length>1)fail(400,'Escolha apenas um modelo de ficha.');
      const template=!old&&data.templateId?sheetTemplateCharacter(readableSheetTemplate(state,access,data.templateId)):null;
      const dnd=!old&&data.dnd?dndCharacter(data.dnd):null;
      const preset=!old&&data.preset?sheetPreset(data.preset):null;
      if(!old&&data.preset&&!preset) fail(400,'Modelo de ficha indisponível.');
      if(state.sheetModelVersion&&!old&&!master&&(data.templateId||data.preset||Boolean(data.dnd)!==(state.ruleset==='dnd-2024')))fail(400,'Crie o personagem com o modelo da campanha.');
      const base=old||template||dnd||(preset?{layout:preset.fields,preset:preset.id,rollButtons:preset.rollButtons,masteries:preset.masteries}:structuredClone(state.sheetStarter||null));
      const values = Object.fromEntries(sheetFields(state,base).map(field => [
        field.id, str(data.values?.[field.id] ?? base?.values?.[field.id] ?? field.initial, 4000)
      ]));
      if(base?.dnd) {
        const level=Number(values['dd-level']);
        if(!Number.isInteger(level)||level<1||level>20)fail(400,'O nível de D&D deve estar entre 1 e 20.');
        for(const id of ['str','dex','con','int','wis','cha']) {
          const value=Number(values['dd-'+id]);
          if(!Number.isInteger(value)||value<1||value>30)fail(400,'Atributos de D&D devem estar entre 1 e 30.');
        }
      }
      if (!master&&data.hidden!==undefined) fail(403,'Somente o mestre pode alterar a visibilidade.');
      if (data.hidden!==undefined&&typeof data.hidden!=='boolean') fail(400,'Visibilidade inválida.');
      if(data.characterType!==undefined&&!['player','npc'].includes(data.characterType))fail(400,'Tipo de ficha inválido.');
      if(!master&&data.characterType!==undefined)fail(403,'Somente o mestre pode definir o tipo da ficha.');
      const type=master?data.characterType??characterType(old):'player';
      const character={...base,characterType:type,id:old?.id||uid(),name,concept:str(data.concept,80),color:color(data.color),values,
        hidden:master?(data.hidden??old?.hidden??false):false};
      if(old?.dnd&&Number(values['dd-level'])!==Number(old.values?.['dd-level']||1))syncDndSpellSlots(character,Number(values['dd-level']));
      if(old?.appearance?.options&&old.color!==character.color&&old.appearance.options.accent===characterColorHex(old.color)){character.appearance={...old.appearance,version:(old.appearance.version||0)+1,options:{...old.appearance.options,accent:characterColorHex(character.color)}};}
      delete character.presentation;
      if (!old&&!master) character.ownerId=access.memberId;
      if (character.hidden||!isPlayerCharacter(character)) delete character.ownerId;
      state.characters = updateList(state.characters,character);
      prepareMaterial(state,data,access,'character',character.id);
      break;
    }
    case 'sheetMasteryRefresh': {
      const characters=data.id?[findCharacter(state,data.id)]:state.characters;
      for(const character of characters) for(const mastery of character.masteries||[]) mastery.remaining=1;
      break;
    }
    case 'dndCast': {
      const character=findCharacter(state,data.id);
      const spell=dndCatalog.find(e=>e.id===data.entryId&&e.category==='spells');
      if(!character.dnd||!spell||!character.abilities?.some(a=>a.id===spell.id))fail(400,'Adicione a magia à ficha antes de conjurar.');
      let usedSlot=spell.level;
      if(spell.level===0&&data.slotLevel!==undefined&&data.slotLevel!==0)fail(400,'Truques não consomem espaços de magia.');
      if(spell.level>0) {
        usedSlot=data.slotLevel===undefined?spell.level:data.slotLevel;
        if(!Number.isInteger(usedSlot)||usedSlot<spell.level||usedSlot>9)fail(400,'Escolha um círculo válido para conjurar esta magia.');
        const field=sheetFields(state,character).find(f=>f.id==='dd-slot-'+usedSlot&&f.type==='counter');
        const [now,max]=String(field?sheetValue(character,field):'0/0').split('/').map(Number);
        if(!field||!Number.isFinite(now)||now<1)fail(409,'Sem espaços de '+usedSlot+'º círculo. Use os controles da ficha para recursos concedidos por talentos.');
        character.values??={};
        character.values[field.id]=(now-1)+'/'+max;
      }
      if(spell.formula) {
        const formula=dndSpellFormula(character,spell,spell.kind==='attack'?'attack':'effect',usedSlot);
        mutate(state,'roll',{characterId:character.id,actor:character.name,formula,mode:spell.kind==='attack'?data.mode:'normal',...(data.visibility!==undefined?{visibility:data.visibility}:{})},access);
        state.rolls[0].label='Conjurar · '+spell.name+(usedSlot>spell.level?' ('+usedSlot+'º círculo)':'');
      }
      break;
    }
    case 'bodyStressConfig': {
      const character=findCharacter(state,data.id);
      if(typeof data.enabled!=='boolean')fail(400,'Escolha se o estresse corporal está ativo.');
      if(!data.enabled){
        if(character.bodyStress)character.bodyStress.enabled=false;
        break;
      }
      const previous=bodyStressWithHead(character.bodyStress);
      const mode=data.mode??previous?.mode??'simple';
      if(!['simple','complex'].includes(mode))fail(400,'Modo de segmentação inválido.');
      const regions={...previous?.regions};
      for(const [key,label] of Object.entries(stressRegionsFor(mode))){
        const limit=data.mode===undefined && data.limits?.[key]===undefined && key==='head'
          ? regions.head?.limit??3 : data.limits?.[key];
        const value=regions[key]?.value??0;
        if(!Number.isInteger(limit)||limit<1||limit>99)fail(400,'Informe um limite entre 1 e 99 para '+label+'.');
        if(limit<value)fail(409,'O limite de '+label+' precisa comportar o estresse já marcado.');
        regions[key]={limit,value};
      }
      character.bodyStress={enabled:true,mode,regions};
      break;
    }
    case 'bodyStressStep': {
      const character=findCharacter(state,data.id);
      if(!character.bodyStress?.enabled)fail(409,'O estresse corporal está desativado nesta ficha.');
      character.bodyStress=bodyStressWithHead(character.bodyStress);
      if(!Object.hasOwn(stressRegionsFor(character.bodyStress.mode),data.region)||![-1,1].includes(data.step))fail(400,'Ajuste de estresse inválido.');
      const region=character.bodyStress.regions[data.region],next=region.value+data.step;
      if(next<0||next>region.limit)fail(409,'A região já atingiu o limite desse ajuste.');
      region.value=next;
      break;
    }
    case 'sheetAppearance': {
      const character=findCharacter(state,data.id);
      if(data.expectedVersion!==(character.appearance?.version||0))fail(409,'A aparência foi alterada em outra aba. Descarte o rascunho para carregar a versão atual antes de editar.');
      const appearance=validateSheetAppearance(data.appearance,state,character);
      character.appearance={...appearance,version:(character.appearance?.version||0)+1};
      break;
    }
    case 'dndAdd':
    case 'dndRest':
    case 'sheetMastery':
    case 'sheetCounter':
    case 'sheetFields':
    case 'injurySettings':
    case 'sheetPortraitDelete':
    case 'sheetEntry':
      sheetAction(state,action,data,master);
      break;
    case 'characterDelete':
      if (!master) fail(403,'Ação reservada ao mestre.');
      state.characters = state.characters.filter(item=>item.id!==data.id);
      removeSessionMaterial(state,'character',data.id);
      if(state.gmResources)delete state.gmResources[data.id];
      state.tokens = state.tokens.map(token=>token.characterId===data.id ? {...token,characterId:''} : token);
      for(const scene of state.sceneLibrary?.scenes||[])if(scene.tokens)scene.tokens=scene.tokens.map(token=>token.characterId===data.id?{...token,characterId:''}:token);
      break;
    case 'gmTableRoll': {
      const card=gmBoard(state).cards.find(card=>card.id===data.id&&card.kind==='table');
      if(!card||card.items.length<2)fail(404,'Tabela indisponível.');
      const available=card.items.filter(item=>!card.noRepeat||!item.drawn);
      if(!available.length)fail(409,'Todas as entradas já saíram. Reinicie os sorteios.');
      const faces=available.reduce((sum,item)=>sum+(item.weight??1),0);
      const total=randomDie(faces);
      const result={formula:'1d'+faces,total,modifier:0,dice:[total],groups:[{faces,sign:1,dice:[total]}]};
      let remaining=total;
      const entry=available.find(item=>{remaining-=item.weight??1;return remaining<=0;});
      if(card.noRepeat){entry.drawn=true;card.version++;}
      const roll={id:uid(),at:Date.now(),rolledBy:'master',visibility:'gm',actor:'Mestre',kind:'table',...result,label:card.title+' · '+entry.text};
      state.rolls=[roll,...state.rolls];
      const counts={public:0,gm:0};
      state.rolls=state.rolls.filter(item=>++counts[item.visibility==='public'?'public':'gm']<=40);
      card.lastRoll={rollId:roll.id,at:roll.at,index:card.items.indexOf(entry)+1,text:entry.text};
      break;
    }
    case 'campaignSheetTheme':
      if(data.style==='classic'){delete state.sheetTheme;break;}
      if(!['medieval','future','noir'].includes(data.style)||!/^#[0-9a-f]{6}$/i.test(data.trimColor))fail(400,'Escolha um estilo e uma cor de moldura válidos.');
      state.sheetTheme={style:data.style,name:str(data.name,60),trimColor:data.trimColor};
      if(data.emblem)state.sheetTheme.emblem=emblemData(data.emblem);
      if(['grain','grid','lines'].includes(data.texture)){
        state.sheetTheme.texture=data.texture;
        state.sheetTheme.intensity=Math.max(0,Math.min(100,Number(data.intensity)||0));
      }
      break;
    case 'notes':
      state.notes = str(data.text,12000);
      break;
    case 'initiative':
      if (!Array.isArray(data.entries) || data.entries.length > 100) fail(400,'Use até 100 participantes.');
      state.initiative = data.entries.map(entry=>({name:str(entry.name,80),value:Math.max(-999,int(Number(entry.value)+999,1998)-999)}))
        .filter(entry=>entry.name);
      break;
    case 'bookDelete':
      state.books = state.books.filter(item=>item.id!==data.id);
      break;
    case 'track':
    case 'soundPlay':
    case 'soundDelete':
      changeAudio(state,action,data);
      break;
    case 'checkCreate': createCheckRequest(state,data);break;
    case 'assistOffer':
    case 'assistDecide':
    case 'checkPhysical': {
      const check=state.checkRequests?.find(c=>c.id===data.id&&!c.closed&&(action==='checkPhysical'||c.allowHelp));
      const t=check?.targets.find(t=>t.characterId===data.target);
      if(!t||t.result)fail(409,'Este teste não está disponível para ajuda.');
      if(action==='assistOffer'){
        const helper=ownedCharacter(state,access);
        if(!canAssist(state,helper,t))fail(403,'Você só pode ajudar outro personagem aliado.');
        if(t.help)fail(409,'Já existe uma oferta para este teste.');
        const reason=str(data.reason,240);if(!reason)fail(400,'Descreva como vai ajudar.');
        t.help={id:uid(),helper:helper.id,name:helper.name,reason};break;
      }
      if(action==='checkPhysical'){
        if(t.help&&!t.help.effect)fail(409,'Decida sobre a ajuda antes de registrar o resultado.');
        if(!Number.isInteger(data.total)||Math.abs(data.total)>100000)fail(400,'Informe o total final dos dados físicos.');
        t.result={id:uid(),total:data.total,formula:'Dados físicos',physical:true,...(t.help?{help:{name:t.help.name,effect:t.help.effect}}:{})};break;
      }
      if(!t.help||t.help.id!==data.offer||t.help.effect)fail(409,'A oferta já mudou.');
      if(data.effect==='decline'){delete t.help;break;}
      if(!canAssist(state,state.characters.find(c=>c.id===t.help.helper),t))fail(409,'O aliado não está disponível.');
      if(!/^(?:[1-9]|10|1d(?:4|6|8|10|12|20)|advantage)$/.test(data.effect))fail(400,'Escolha um efeito válido.');
      if(data.effect==='advantage'){
        const c=findCharacter(state,t.characterId),formula=resolveSheetFormula(requestedTest(state,c,t).formula,state,c).formula;
        if(!/^1?d20(?:[+-]|$)/.test(formula))fail(400,'Vantagem exige um teste com d20.');
      }
      t.help.effect=data.effect;break;
    }
    case 'checkClose':
      state.checkRequests=(state.checkRequests||[]).filter(check=>check.id!==data.id);
      break;
    case 'checkRespond':
    case 'roll': {
      let requestTarget;
      if(action==='checkRespond'){
        const check=state.checkRequests?.find(check=>check.id===data.id);
        const own=ownedCharacter(state,access);
        requestTarget=check?.targets.find(t=>t.characterId===own?.id&&t.memberId===access.memberId);
        if(master||!requestTarget||check.closed)fail(403,'Pedido indisponível.');
        if(requestTarget.result)break;
        if(requestTarget.help&&!requestTarget.help.effect)fail(409,'Aguarde a decisão do mestre sobre a ajuda.');
        if(requestTarget.kind==='free'){
          data={formula:requestTarget.formula,label:requestTarget.label||check.label,characterId:own.id,masteryId:data.masteryId,mode:requestTarget.help?.effect==='advantage'?'advantage':undefined};
        }else{
          const inputKey={attribute:'attributeId',skill:'skillId',saved:'rollId'}[requestTarget.kind];
          data={[inputKey]:requestTarget.testId,characterId:own.id,masteryId:data.masteryId,mode:requestTarget.help?.effect==='advantage'?'advantage':undefined};
        }
      }
      const roll=makeSheetRoll(state,data,access,requestTarget?.help);
      if(requestTarget){
        if(requestTarget.help)roll.label=(roll.label||'Teste')+' · ajuda de '+requestTarget.help.name;
        requestTarget.result={...roll,visibility:'requested'};break;
      }
      state.rolls.unshift(roll);
      const counts={public:0,gm:0};
      state.rolls=state.rolls.filter(roll=>++counts[roll.visibility==='public'?'public':'gm']<=40);
      break;
    }
    default: fail(400,'Ação desconhecida.');
  }
}

function rollDice(value) {
  const {formula,terms,modifier}=parseDiceFormula(value);

  const groups = terms.map(({count,faces,sign,keep})=>{
    const dice=Array.from({length:count},()=>randomDie(faces));
    return {faces,sign,dice,...(keep?{keep,kept:[keep==='kh1'?Math.max(...dice):Math.min(...dice)]}:{})};
  });
  const total = groups.reduce((sum,group)=>sum+group.sign*(group.kept||group.dice).reduce((a,b)=>a+b,0),modifier);
  return {formula,groups,dice:groups.flatMap(group=>group.dice),modifier,total};
}

function randomDie(faces) {
  const buffer = new Uint32Array(1);
  const limit = 2**32 - (2**32 % faces);
  do { crypto.getRandomValues(buffer); } while(buffer[0] >= limit);
  return buffer[0] % faces + 1;
}

function exploreDuringMove(state,character,params){
  if(!character||!state.table?.exploration?.length||params.get('exploreScene')!==activeSceneId(state))return;
  const token=state.tokens.find(t=>t.id===params.get('moving')&&!t.hidden&&!t.locked&&tokenCharacterId(state,t)===character.id);
  if(!token)return;
  const values=['x','y','rotation'].map(key=>params.get(key));
  if(values.some(value=>!value?.trim()||!Number.isFinite(Number(value))))return;
  const [x,y,rotation]=values.map(Number),table=normalizeTable(state),size=Number(token.size)||1;
  if(x<0||y<0||x>table.grid.columns-size||y>table.grid.rows-size||rotation<0||rotation>=360)return;
  let path;
  if(params.has('path')){try{path=JSON.parse(params.get('path'));}catch{return;}}
  const position=resolveTokenPath(token,{x,y},table,path);
  const moving={...state,tokens:state.tokens.map(t=>t===token?{...t,...position,rotation}:t)};
  return {points:explorationView(moving,character,false,table),ambient:ambientAt(moving,character,false)};
}

function projectedTable(scoped,access,own){
  const table=tableView(scoped,access.master);
  if(scoped.table?.exploration)table.table.exploration=explorationView(scoped,own,access.master,table.table);
  if(table.tokens.some(t=>t.motion)||table.table.hasPatrols)table.table.hasPatrols=true;
  table.tokens=table.tokens.map(token=>({...token,visionSource:playerVisionSource(scoped,token)}));
  if (!access.master) {
    const darkness=table.table.darkness,teams=darkness.teams||{},team=teams[own?.id];
    const sees=playerSight(scoped,table.table,own?.id);
    const unseen=new Set();
    table.tokens=table.tokens.filter(token=>{
      if(sees(token))return true;
      unseen.add(token.id);
      return false;
    });
    if(unseen.size){
      const combat=table.table.combat,active=combat.entries[combat.active];
      combat.entries=combat.entries.filter(e=>!unseen.has(e.tokenId));
      combat.active=combat.entries.indexOf(active);
      table.table.lootEvents=table.table.lootEvents.filter(e=>!unseen.has(e.tokenId));
    }
    const partyById=new Map(scoped.characters.map(c=>[c.id,c]));
    const allowed=id=>!!own&&!outsideParty(partyById.get(id),own)&&(own.id===id||darkness.mode==='group'||darkness.mode==='teams'&&team&&teams[id]===team);
    if(darkness.teams)darkness.teams=Object.fromEntries(Object.entries(teams).filter(([id])=>allowed(id)));
    if(table.table.fog.memory)table.table.fog.memory=Object.fromEntries(Object.entries(table.table.fog.memory).filter(([id])=>allowed(id)));
    const rivals=new Map(scoped.characters.filter(c=>outsideParty(c,own)).map(c=>[c.id,c]));
    const concealedNames=new Set([...rivals.values()].filter(c=>!own?.party||!c.partyRevealed).map(c=>c.name));
    const visibleCharacters=new Set(scoped.characters.filter(c=>!c.hidden&&!rivals.has(c.id)).map(c=>c.id));
    const rivalTokens=new Map(table.tokens.filter(t=>rivals.has(t.characterId)).map(t=>[t.id,rivals.get(t.characterId)]));
    for(const entry of table.table.combat.entries){
      const rival=rivalTokens.get(entry.tokenId);
      if(rival)entry.name=own?.party&&rival.partyRevealed?rival.name:'???';
      else if(concealedNames.has(entry.name))entry.name='???';
    }
    for(const ping of table.table.pings){
      const rival=rivals.get(ping.characterId);
      if(rival){ping.name=own?.party&&rival.partyRevealed?rival.name:'???';delete ping.characterId;}
      else if(!ping.characterId&&concealedNames.has(ping.name))ping.name='???';
    }
    table.tokens=table.tokens.map(token=>({
      ...token,
      ...(rivalTokens.has(token.id)?{name:own?.party&&rivalTokens.get(token.id).partyRevealed?rivalTokens.get(token.id).name:'???',visionSource:false,portrait:undefined}:{}),
      characterId:visibleCharacters.has(token.characterId)?token.characterId:'',
      canMove:Boolean(own&&token.characterId===own.id&&!token.locked&&!token.hidden)
    }));
  }
  const linked=new Map(scoped.characters.map(c=>[c.id,c]));
  const canViewResource=charId=>Boolean(charId&&(access.master||!access.guest&&own&&charId===own.id));
  const tokenById=new Map();
  for(const token of table.tokens){
    tokenById.set(token.id,token);
    if(token.kind==='item')continue;
    const c=linked.get(token.characterId);
    if(c){
      token.linkedPortrait=(injuredPortrait(scoped,c)||token.portrait||c.portrait)?.id||null;
      if(canViewResource(c.id)){
        const bar=primaryCharacterResource(scoped,c);
        if(bar)token.resourceBar=bar;
      }
    }
  }
  for(const entry of table.table.combat.entries){
    const token=entry.tokenId?tokenById.get(entry.tokenId):null;
    if(token?.resourceBar)entry.resourceBar={...token.resourceBar};
  }
  return table;
}

function view(row,access,sceneId) {
  const scoped=sceneProjection(row.state,access.master?sceneId:undefined);
  const state=publicState(scoped,access);
  if(access.master){state.sceneLibrary=sceneSummary(row.state);state.investigations=investigationInbox(row.state);
    const requests=(row.state.table?.exploration||[]).filter(p=>p.travelRequest&&state.sceneLibrary.scenes.some(s=>s.id===p.travelRequest.target)).map(p=>({...p.travelRequest,label:p.label,destination:state.sceneLibrary.scenes.find(s=>s.id===p.travelRequest.target).name}));
    if(requests.length)state.travelRequests=requests;}
  state.audio={...audioView(row.state.audio,access.master),ambient:ambientAt(row.state,ownedCharacter(row.state,access),access.master)};
  const own=ownedCharacter(scoped,access);
  const table=projectedTable(scoped,access,own);
  Object.assign(state,table);
  return {id:row.id,rev:row.rev,checkVersion:checkVersion(state.checkRequests),messageVersion:messageVersion(state.messages||[]),master:access.master,
    role:access.master?'master':access.guest?'guest':'player',
    characterId:own?.id||null,needsCharacter:!access.master&&!own,
    serverTime:Date.now(),state,...(access.master?{invite:row.player}:{})};
}

export async function campaignViewEtag(row,access,requestedScene,now=Date.now()) {
  const identity=access.master?'master:'+(row.player||''):access.guest?'guest':'member:'+access.memberId;
  const lib=sceneLibrary(row.state);
  const effectiveScene=access.master?(requestedScene||''):'';
  const scene=lib.scenes.find(s=>s.id===(effectiveScene||lib.activeId))||lib.scenes.find(s=>s.id===lib.activeId);
  const tokens=(scene?.id===lib.activeId?row.state.tokens:scene?.tokens)||[];
  const table=(scene?.id===lib.activeId?row.state.table:scene?.table)||{};
  const characters=row.state.characters||[];
  const hasActivePatrol=tokens.some(t=>t?.patrol?.started&&t.kind!=='item'&&(!t.characterId||characters.some(c=>c.id===t.characterId&&!isPlayerCharacter(c))));
  const cinematic=row.state.cinematicRun&&now<row.state.cinematicRun.endsAt?row.state.cinematicRun.id:'';
  const shares=!access.master&&!access.guest?(row.state.materialShares||[]).filter(g=>g&&g.until>now).map(g=>g.id).join(','):'';
  const pings=(table.pings||[]).filter(p=>p&&Number.isFinite(p.at)&&now-p.at<1500&&p.at<=now+1000).map(p=>p.id).join(',');
  const loot=(table.lootEvents||[]).filter(e=>e&&Number.isFinite(e.at)&&now-e.at<3000&&e.at<=now+1000).map(e=>e.id).join(',');
  return strongEtag([
    'v1',row.id,row.rev,identity,lib.activeId||'',scene?.id||'',effectiveScene,
    cinematic,shares,pings,loot,hasActivePatrol?'patrol:'+now:''
  ].join('\0'));
}

const toolVersion=items=>rollVersion((items||[]).map(item=>({id:item.id+':'+item.version})));

export function sceneView(row,access,sceneId){
  const visible=view(row,access,sceneId);
  return {type:'scene',checkVersion:checkVersion(visible.state.checkRequests),id:visible.id,rev:visible.rev,master:visible.master,characterId:visible.characterId,needsCharacter:visible.needsCharacter,serverTime:visible.serverTime,rollVersion:rollVersion(visible.state.rolls||[]),messageVersion:messageVersion(visible.state.messages||[]),state:{checkRequests:visible.state.checkRequests,...(access.master?{investigations:visible.state.investigations,travelRequests:visible.state.travelRequests||[]}:{investigationReceipts:visible.state.investigationReceipts}),sessionClocks:visible.state.sessionLog.clocks,cinematic:visible.state.cinematic,scene:visible.state.scene,sceneId:visible.state.sceneId,activeSceneId:visible.state.activeSceneId,sessionName:visible.state.sessionName,...(visible.master?{sceneLibrary:visible.state.sceneLibrary}:{}),journalVersion:toolVersion(visible.state.journal),sheetTemplatesVersion:toolVersion(visible.state.sheetTemplates?.items),narrations:visible.state.narrations||[],messages:visible.state.messages||[],rolls:visible.state.rolls||[],table:visible.state.table,tokens:visible.state.tokens,map:visible.state.map||null}};
}

async function update(store, row, operation,commit=null) {
  for (let attempt=0; attempt<5; attempt++) {
    operation(row.state);
    if (await store.save(row)){const updated={...row,rev:row.rev+1};if(commit&&(!commit.sceneId||commit.sceneId===activeSceneId(updated.state)))store.realtime?.commitToken(updated,commit.id,commit.dragId,commit.action==='tokenRotate');store.realtime?.publish(updated);return updated;}
    row = await store.get(row.id);
    if(!row)fail(404,'A campanha foi apagada.');
  }
  fail(409,'A mesa mudou durante a edição. Tente novamente.');
}

function campaignAssets(state){return [...(state.cinematicLibrary||[]),...itemPortraits(state),...sceneTokenPortraits(state),...sceneMaps(state),...(state.books||[]),...(state.audio?.clips||[]),...(state.characters||[]).flatMap(c=>[c.portrait,c.injury?.image])].filter(Boolean);}

async function uploadItemPortrait(request,store,row,access){
  if(!access.master)fail(403,'Somente o mestre pode enviar o retrato de um item.');
  const max=3*1024*1024+1_500_000+32768;if(Number(request.headers.get('Content-Length'))>max)fail(413,'A imagem deve ter até 3 MB.');
  const reader=request.body?.getReader();if(!reader)fail(400,'Selecione uma imagem.');const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'A imagem deve ter até 3 MB.');}chunks.push(value);}
  let form;try{form=await new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();}catch{fail(400,'Envie a imagem e os dados do item pelo formulário.');}
  const file=form.get('file'),raw=form.get('data');if(!(file instanceof Blob)||!file.size||file.size>3*1024*1024)fail(413,'Selecione uma imagem de até 3 MB.');
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>1_500_000)fail(400,'Dados do item inválidos.');let data;try{data=JSON.parse(raw);}catch{fail(400,'Dados do item inválidos.');}if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Dados do item inválidos.');
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer()),type=file.type.toLowerCase();
  const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,gif=new TextDecoder().decode(bytes.slice(0,6)).match(/^GIF8[79]a$/),webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
  if(!({'image/png':png,'image/jpeg':jpeg,'image/gif':gif,'image/webp':webp}[type]))fail(415,'Use uma imagem PNG, JPG, WebP ou GIF válida.');
  const asset={id:uid(),name:str(file.name,180)||'Retrato do item',type,size:file.size};
  try{
    await store.putAsset(row.id+'/'+asset.id,new Blob([await file.arrayBuffer()],{type}));
    const before=itemPortraits(row.state);const updated=await update(store,row,state=>{mutate(state,'itemSave',data,access);const item=data.id?state.inventory.find(i=>i.id===data.id):state.inventory.at(-1);item.portrait=asset;commitInventory(state,state.inventory);});
    const retained=new Set(campaignAssets(updated.state).map(a=>a.id));await Promise.allSettled(before.filter(a=>!retained.has(a.id)).map(a=>store.deleteAsset(row.id+'/'+a.id)));return updated;
  }catch(error){await store.deleteAsset(row.id+'/'+asset.id).catch(()=>{});throw error;}
}

async function upload(request, store, row, kind,access) {
  const max = ({cinematic:32,pdf:24,map:8,sound:8,portrait:3,'token-portrait':3})[kind]*1024*1024;
  let tokenData;
  if(kind==='token-portrait'){
    try{tokenData=JSON.parse(decodeURIComponent(request.headers.get('X-Token-Data')||''));}catch{fail(400,'Dados do token inválidos.');}
    if(!tokenData||typeof tokenData!=='object'||Array.isArray(tokenData))fail(400,'Dados do token inválidos.');
    tokenData.sceneId=request.headers.get('X-Scene-Id')||undefined;
  }
  const characterId=request.headers.get('X-Character-Id');
  if (kind==='portrait') requireOwnCharacter(row.state,access,characterId);
  if (Number(request.headers.get('Content-Length')) > max) fail(413,'Arquivo muito grande.');
  const reader = request.body?.getReader();
  if (!reader) fail(400,'Selecione um arquivo.');
  let size = 0;
  const chunks = [];
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); fail(413,'Arquivo muito grande.'); }
    chunks.push(value);
  }
  const type = (request.headers.get('Content-Type')||'').split(';')[0].toLowerCase();
  const blob = new Blob(chunks, {type});
  const valid = kind === 'pdf' ? type === 'application/pdf' && await blob.slice(0,5).text() === '%PDF-'
    : (kind==='cinematic'?[...imageTypes,'video/mp4','video/webm',...soundTypes]:kind==='sound' ? soundTypes : imageTypes).includes(type) && size>0;
  if (!valid) fail(415,'Formato de arquivo inválido.');
  let name;
  try { name = decodeURIComponent(request.headers.get('X-File-Name') || ''); } catch { fail(400,'Nome de arquivo inválido.'); }
  const asset = {id:uid(),name:str(name,180)||'Arquivo',type,size};
  if (kind==='map'&&(request.headers.has('X-Map-Width')||request.headers.has('X-Map-Height'))) {
    for (const [key,header] of [['width','X-Map-Width'],['height','X-Map-Height']]) {
      const value=Number(request.headers.get(header));
      if (!Number.isInteger(value)||value<1||value>32768) fail(400,'Dimensões do mapa inválidas.');
      asset[key]=value;
    }
  }
  const cellPixels=Number(request.headers.get('X-Grid-Cell-Size')||100);
  if (kind==='map'&&(!Number.isInteger(cellPixels)||cellPixels<10||cellPixels>4096)) fail(400,'Use de 10 a 4096 pixels por célula.');
  const path = row.id+'/'+asset.id;
  await store.putAsset(path,blob);
  try {
    let replacedAsset;
    const updated = await update(store,row,state=>{
      if(kind==='cinematic'){
        const library=state.cinematicLibrary??=[];
        if(library.length>=60)fail(409,'A biblioteca comporta 60 mídias de cinemática.');
        library.push(asset);
      }else if (kind==='pdf') {
        if (state.books.length >= 30) fail(409,'Limite de 30 livros atingido.');
        state.books.push(asset);
      } else if (kind==='sound') {
        const audio = state.audio ??= emptyAudio();
        if (audio.clips.length >= 600) fail(409,'Limite de 600 efeitos por campanha atingido.');
        audio.clips.push(asset);mutateSoundboard(audio,'soundboardPick',{id:asset.id,enabled:true});
      } else if (kind==='token-portrait') {
        const appendPool=request.headers.get('X-Portrait-Pool')==='append';
        if(appendPool&&tokenData.id){
          replacedAsset=undefined;
          withScene(state,tokenData.sceneId,true,world=>{
            const token=world.tokens.find(item=>item.id===tokenData.id);
            if(!token||token.kind==='item')fail(404,'Token indisponível.');
            const existing=Array.isArray(token.portraits)?[...token.portraits]:token.portrait?[token.portrait]:[];
            if(existing.length>=12)fail(409,'Use até 12 imagens por galeria de figurante.');
            existing.push(asset);
            token.portraits=existing;
            token.portrait??=asset;
            token.icon='auto';
          });
        }else{
          const action=tokenData.id?'tokenUpdate':'tokenAdd';
          replacedAsset=undefined;
          if(tokenData.id)withScene(state,tokenData.sceneId,true,world=>{replacedAsset=world.tokens.find(item=>item.id===tokenData.id)?.portrait?.id;});
          mutate(state,action,tokenData,access);
          withScene(state,tokenData.sceneId,true,world=>{
            const token=tokenData.id?world.tokens.find(item=>item.id===tokenData.id):world.tokens.at(-1);
            token.portrait=asset;
            if(!tokenData.icon||tokenData.icon==='auto')token.icon='auto';
          });
        }
      } else if (kind==='portrait') {
        const character=requireOwnCharacter(state,access,characterId);
        if(request.headers.get('X-Portrait-Variant')==='injury'){
          const rule=injuryRule(state,character,decodeURIComponent(request.headers.get('X-Life-Resource')||''),request.headers.get('X-Life-Threshold'));
          replacedAsset=character.injury?.image?.id;character.injury={...rule,image:asset};
        }else{replacedAsset=character.portrait?.id;character.portrait=asset;}
      } else {
        withScene(state,request.headers.get('X-Scene-Id'),true,world=>{
          replacedAsset=world.map?.id;world.map=asset;
          mutateTable(world,'tableSettings',{grid:{mode:'image',cellPixels}},true);
          delete world.table.fog.memory;world.table.fog.revealed=[];world.table.fog.strokes=[];world.table.fog.history=[];
        });
      }
    });
    if (replacedAsset&&!campaignAssets(updated.state).some(item=>item.id===replacedAsset)) await store.deleteAsset(row.id+'/'+replacedAsset).catch(()=>{});
    return updated;
  } catch (error) {
    await store.deleteAsset(path).catch(()=>{});
    throw error;
  }
}

export async function api(request,store) {
  try {
    const {pathname,searchParams} = new URL(request.url);
    const requestedScene=searchParams.get('scene')||undefined;
    const method = request.method;
    if(pathname==='/api/campaigns/session'&&method==='GET'){
      if(request.headers.get('Sec-Fetch-Site')==='cross-site')fail(403,'Abra a mesa pelo endereço do servidor.');
      return json({id:lastBrowserCampaign(request)});
    }
    if(pathname==='/api/campaigns/import'&&method==='POST'){
      const row=await importCampaignBackup(request,store,{makeRow:state=>({id:uid(),owner:key(),player:key(),rev:1,state}),validate:row=>{view(row,{master:true});view(row,{master:false,guest:true});}});
      return rememberBrowserSession(request,json({...view(row,{master:true}),key:row.owner},201),row.id,row.owner);
    }
    if (pathname === '/api/campaigns' && method === 'POST') {
      const data = await requestJson(request);
      const name = str(data.name,100);
      if (!name) fail(400,'Informe o nome da campanha.');
      if(data.ruleset&&!['free','dnd-2024'].includes(data.ruleset))fail(400,'Sistema inválido.');
      const row = {id:uid(),owner:key(),player:key(),rev:1,state:newCampaign(name,data.example===true)};
      if(data.ruleset==='dnd-2024'){row.state.ruleset='dnd-2024';row.state.system='D&D 2024 · SRD 5.2.1';row.state.fields=dndFields();}
      if(data.sheetModel){
        row.state.sheetModelVersion=1;
        if(data.sheetModel==='blank')row.state.fields=[];
        else if(data.sheetModel!=='standard'){
          const preset=sheetPreset(data.sheetModel);
          if(!preset)fail(400,'Modelo indisponível.');
          row.state.fields=preset.fields;
          row.state.sheetStarter={rollButtons:preset.rollButtons,masteries:preset.masteries};
        }
        if(data.ruleset==='dnd-2024')row.state.fields=dndFields();
      }
      await store.create(row);
      return rememberBrowserSession(request,json({...view(row,{master:true}),key:row.owner},201),row.id,row.owner);
    }
    const path = /^\/api\/campaigns\/([\da-f-]{36})(?:\/(session|player-access|sound-pack|join|sync|events|voice|preview|action|cinematic|pdf|map|sound|portrait|token-portrait|asset|srd|backup|item-portrait)(?:\/([\da-f-]{36}))?)?$/.exec(pathname);
    if (!path) fail(404,'Página não encontrada.');
    const [,id,route,assetId] = path;
    const row = await store.get(id);
    const token = request.headers.get('Authorization')?.replace(/^Bearer /,'');
    const access=row&&token ? accessFor(row,token) : null;
    if(route==='session'&&method==='GET'){
      if(request.headers.get('Sec-Fetch-Site')==='cross-site')fail(403,'Abra a mesa pelo endereço do servidor.');
      const stored=browserSessionKey(request,id),storedAccess=row&&stored?accessFor(row,stored):null;
      const resume=access&&!access.guest?{access,key:token}:storedAccess&&!storedAccess.guest?{access:storedAccess,key:stored}:null;
      if(!resume)fail(401,'Nenhum acesso anterior encontrado para esta campanha.');
      return rememberBrowserSession(request,json({...view(row,resume.access,requestedScene),key:resume.key}),id,resume.key);
    }
    if (!access) fail(403,'Convite inválido ou mesa indisponível.');
    const {master}=access;
    if(method==='POST'&&route==='voice'){
      const own=ownedCharacter(row.state,access);
      if(!master&&!own)fail(403,'Escolha um personagem para usar o microfone.');
      const data=await requestJson(request,512);
      if(typeof data?.active!=='boolean'||data.sceneId!==activeSceneId(row.state))fail(400,'Estado de fala ou cena inválida.');
      if(!master&&(data.tokenId!==undefined||data.characterId!==undefined&&data.characterId!==own.id))fail(403,'A fala do jogador acompanha seu personagem.');
      if(master&&!row.state.tokens.some(t=>t.id===data.tokenId&&t.kind!=='item'))fail(400,'Escolha um token da cena ativa.');
      if(store.realtime)store.realtime.voice(row,access,data.active,data.tokenId);
      else if(store.voice)await store.voice.write(row.id,data.sceneId,master?'token/'+data.tokenId:'character/'+own.id,data.active?Date.now()+2600:0);
      else fail(503,'Indicador de fala indisponível.');
      return json({ok:true});
    }
    if(method==='POST'&&route==='item-portrait')return json(view(await uploadItemPortrait(request,store,row,access),access,request.headers.get('X-Scene-Id')||requestedScene),201);
    if(route==='player-access'&&method==='POST'){
      if(!master)fail(403,'Somente o mestre pode recuperar o acesso de outro jogador.');
      const data=await requestJson(request),character=row.state.characters.find(c=>c.id===data.characterId);
      let member=character?.ownerId&&row.state.members?.find(m=>m.id===character.ownerId);
      if(!member&&character?.party&&data.reserve===true){
        const updated=await update(store,row,state=>{
          const target=findCharacter(state,data.characterId);
          if(!target.party||target.hidden||!isPlayerCharacter(target))fail(409,'Ficha indisponível para convite privado.');
          if(target.ownerId)return;
          state.members??=[];
          if(state.members.length>=200)fail(409,'Limite de participantes atingido.');
          const player={id:uid(),key:(uid()+uid()).replaceAll('-','')};
          state.members.push(player);target.ownerId=player.id;
        });
        const owner=updated.state.characters.find(c=>c.id===data.characterId).ownerId;
        member=updated.state.members.find(m=>m.id===owner);
      }
      if(!member)fail(409,'Esta ficha não possui um jogador vinculado. Escolha-a pelo convite da campanha.');
      return json({characterId:character.id,name:character.name,code:row.id+'.'+member.key});
    }
    if(method==='POST'&&route==='sound-pack'){if(!master)fail(403,'Somente o mestre pode instalar pacotes.');return json(view(await installSoundPack(request,store,row,{update}),access));}
    if(method==='GET'&&route==='backup'){if(!master)fail(403,'Somente o mestre pode baixar o backup da campanha.');return exportCampaignBackup(row,store);}
    if(method==='GET'&&route==='events'){
      if(!store.realtime)fail(503,'Atualização contínua indisponível neste servidor.');
      return store.realtime.connect(row,token,request.signal,master?requestedScene:undefined);
    }
    if(method==='POST'&&route==='preview'){
      if(!store.realtime)fail(503,'Atualização contínua indisponível neste servidor.');
      store.realtime.preview(row,access,await requestJson(request,2048));return json({ok:true});
    }
    if(method==='POST'&&route==='srd') {
      if(!master)fail(403,'Somente o mestre pode salvar o livro na campanha.');
      if(row.state.books.some(book=>book.source==='srd-5.2.1'))return json(view(row,access));
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
      let blob;
      try {
        const response=await fetch(dndBook,{signal:controller.signal});
        if(!response.ok||!response.body)throw new Error('Download indisponível.');
        const reader=response.body.getReader(),chunks=[];let size=0;
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>40*1024*1024){await reader.cancel();throw new Error('PDF excede o limite.');}chunks.push(value);}
        blob=new Blob(chunks,{type:'application/pdf'});
        if(await blob.slice(0,5).text()!=='%PDF-')throw new Error('Resposta não é PDF.');
      } catch {fail(502,'Não foi possível baixar o SRD. Verifique a internet do servidor ou envie o PDF oficial pela biblioteca.');}
      finally {clearTimeout(timeout);}
      const asset={id:uid(),name:'D&D 2024 — SRD 5.2.1 (inglês)',type:'application/pdf',size:blob.size,source:'srd-5.2.1'};
      await store.putAsset(id+'/'+asset.id,blob);
      let added=false;
      try {
        const updated=await update(store,row,state=>{
          added=false;
          if(state.books.some(book=>book.source==='srd-5.2.1'))return;
          if(state.books.length>=30)fail(409,'Limite de livros atingido.');
          state.books.push(asset);added=true;
        });
        if(!added)await store.deleteAsset(id+'/'+asset.id);
        return json(view(updated,access));
      } catch(error){await store.deleteAsset(id+'/'+asset.id).catch(()=>{});throw error;}
    }
    if (method==='POST'&&route==='join') {
      if (!access.guest) fail(403,'Use o convite para entrar na campanha.');
      const stored=browserSessionKey(request,id),storedAccess=stored?accessFor(row,stored):null;
      if(storedAccess&&!storedAccess.guest)return rememberBrowserSession(request,json({...view(row,storedAccess),key:stored}),id,stored);
      const data=await requestJson(request);
      if (!/^[a-f0-9]{64}$/.test(data.key)) fail(400,'Identificação de jogador inválida.');
      const updated=await update(store,row,state=>{
        state.members??=[];
        if (state.members.some(member=>member.key===data.key)) return;
        if (state.members.length>=200) fail(409,'Limite de participantes atingido.');
        state.members.push({id:uid(),key:data.key});
      });
      return rememberBrowserSession(request,json({...view(updated,accessFor(updated,data.key)),key:data.key}),id,data.key);
    }
    if(method==='DELETE'&&!route) {
      if(!master)fail(403,'Somente quem criou a campanha pode apagá-la.');
      const data=await requestJson(request);
      if(data.name!==row.state.name)fail(400,'Digite o nome da campanha para confirmar a exclusão.');
      if(!await store.remove(row))fail(409,'A campanha mudou. Atualize e tente novamente.');
      store.realtime?.closeCampaign(id);
      const assets=[...(row.state.cinematicLibrary||[]),...itemPortraits(row.state),...sceneMaps(row.state),...sceneTokenPortraits(row.state),...row.state.books,...(row.state.audio?.clips||[]),...row.state.characters.flatMap(c=>[c.portrait,c.injury?.image])].filter(Boolean);
      const cleanup=store.deleteCampaignAssets?[store.deleteCampaignAssets(id)]:assets.map(asset=>store.deleteAsset(id+'/'+asset.id));
      const results=await Promise.allSettled(cleanup);
      return json({deleted:id,cleanupPending:results.some(result=>result.status==='rejected')});
    }
    if (method === 'GET' && !route) {
      const etag = await campaignViewEtag(row,access,requestedScene);
      const headers = {'Cache-Control':'private, no-cache','ETag':etag,'Vary':'Authorization, Cookie'};
      if (matchesIfNoneMatch(request.headers.get('If-None-Match'),etag)) return new Response(null,{status:304,headers});
      return Response.json(view(row,access,requestedScene),{headers});
    }
    if (method==='GET'&&route==='sync') {
      const params=new URL(request.url).searchParams;
      const character=ownedCharacter(row.state,access);
      const moving=!master&&params.has('moving')&&exploreDuringMove(row.state,character,params);
      if(params.get('motionOnly')==='1')return json({rev:row.rev,state:{movingPoints:moving?.points??null,ambient:moving?.ambient??null}});
      const rolls=rollView(row.state,master,character),version=rollVersion(rolls);
      const changed=params.get('rollVersion')!==version;
      const messages=messageView(row.state,access,character),msgVersion=messageVersion(messages);
      const messagesChanged=params.get('messageVersion')!==msgVersion;
      let scene={};
      if(params.get('table')==='1'){
        // Between campaign revisions only moving tokens and their visible initiative entries can change.
        if(params.get('patrolRev')===String(row.rev)){
          const scoped=sceneProjection(row.state,master?requestedScene:undefined);
          const projection=projectedTable(scoped,access,ownedCharacter(scoped,access));
          scene={patrolFrame:{sceneId:scoped.sceneId,tokens:projection.tokens.filter(t=>t.motion),combat:projection.table.combat}};
        }else scene=sceneView(row,access,requestedScene).state;
      }
      if(store.voice&&scene.tokens){
        const speakers=new Set(await store.voice.active(row.id,scene.sceneId));
        scene.speakingTokens=scene.tokens.filter(t=>(speakers.has('token/'+t.id)||t.characterId&&speakers.has('character/'+t.characterId))&&scene.sceneId===activeSceneId(row.state)).map(t=>t.id);
      }
      const checks=scene.checkRequests??(params.get('checkRev')===String(row.rev)?null:checkRequestView(row.state,access));
      delete scene.checkRequests;
      if(!messagesChanged&&!('table' in Object.fromEntries(params)))delete scene.messages;
      const stamp=checks?checkVersion(checks):null;
      return json({id:row.id,rev:row.rev,master,characterId:ownedCharacter(row.state,access)?.id||null,needsCharacter:!master&&!ownedCharacter(row.state,access),rollVersion:version,messageVersion:msgVersion,latestMessageVersion:msgVersion,checkVersion:stamp,serverTime:Date.now(),state:{mediaCheck:mediaCheckView(row.state,access),...(checks&&params.get('checks')!==stamp?{checkRequests:checks}:{}),cinematic:cinematicView(row.state,access),...(!master?{narrations:narrationView(row.state,access)}:{}),audio:{...audioView(row.state.audio,master,{includeLibrary:false}),ambient:moving?.ambient??ambientAt(row.state,ownedCharacter(row.state,access),master)},...(moving?{movingPoints:moving.points}:{}),...(changed?{rolls}:{}),...(messagesChanged?{messages}:{}),...scene}});
    }
    if (method === 'GET' && route === 'asset') {
      const viewer=ownedCharacter(row.state,access);
      const rivals=new Set(row.state.characters.filter(c=>outsideParty(c,viewer)).map(c=>c.id));
      const visibleCharacters=master?row.state.characters:row.state.characters.filter(character=>!character.hidden&&!rivals.has(character.id));
      const tokenPortraits=master?sceneTokenPortraits(row.state):(row.state.tokens||[]).filter(token=>!token.hidden&&!rivals.has(tokenCharacterId(row.state,token))).flatMap(token=>[token.portrait,...(Array.isArray(token.portraits)?token.portraits:[])]);
      const sharedImages=master?[]:sharingView(row.state,viewer).received.map(g=>g.material.portrait).filter(p=>p?.id);
      const itemImages=master?itemPortraits(row.state):itemPortraits({inventory:inventoryView(row.state,access),tokens:(row.state.tokens||[]).filter(t=>!t.hidden)});
      const visibleRun=cinematicView(row.state,access);
      const cineAssets=master?row.state.cinematicLibrary||[]:(row.state.cinematicLibrary||[]).filter(a=>a.id===visibleRun?.media?.id||a.id===visibleRun?.soundtrackId);
      const checkedAssets=mediaCheckView(row.state,access)?.assets||[];
      const prepared=[...sceneMaps(row.state),...(row.state.cinematicLibrary||[])].filter(a=>checkedAssets.includes(a.id));
      const asset = [...prepared,...cineAssets,...sharedImages,...itemImages,...tokenPortraits,...row.state.books,...(row.state.audio?.clips||[]),...visibleCharacters.flatMap(c=>[c.portrait,...(master||viewer?.id===c.id?[c.injury?.image]:[injuredPortrait(row.state,c)])]),...(master?sceneMaps(row.state):[row.state.map])].find(item=>item?.id===assetId);
      if (!asset) fail(404,'Arquivo indisponível.');
      const body = await store.getAsset(id+'/'+asset.id);
      if (!body) fail(404,'Arquivo indisponível.');
      return new Response(body,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
    }
    if (method === 'POST' && route === 'action') {
      const {action,data} = await requestJson(request);
      let lootResult,responseScene;
      if(typeof action!=='string'||!action||action.length>80||data!==undefined&&(!data||typeof data!=='object'||Array.isArray(data)))fail(400,'Ação ou dados inválidos.');
      let deleted,oldInjury,removedMaps=[],removedPortraits=[],removedItemPortraits=[];
      const updated = await update(store,row,state=>{
        const assets=action==='cinematicDelete'?state.cinematicLibrary:action==='bookDelete' ? state.books : action==='soundDelete' ? state.audio?.clips : null;
        deleted=assets?.find(asset=>asset.id===data?.id);
        if (['sheetPortraitDelete','characterDelete'].includes(action)) {
          deleted=state.characters.find(character=>character.id===data?.id)?.portrait;
        }
        if(['injurySettings','characterDelete'].includes(action))oldInjury=state.characters.find(c=>c.id===data?.id)?.injury?.image;
        const previousItemPortraits=itemPortraits(state);
        const previousPortraits=sceneTokenPortraits(state);
        const previousMaps=action==='sceneDelete'?sceneMaps(state):[];
        validateActionAccess(state,action,data||{},access);
        const captured=captureSheetChanges(state,action,data||{},access);
        const from=activeSceneId(state);
        lootResult=mutate(state,action,data||{},access);
        responseScene=from!==activeSceneId(state)?activeSceneId(state):data?.sceneId;
        recordSheetChanges(state,captured,{action});
        const retainedItemPortraits=new Set(itemPortraits(state).map(a=>a.id));removedItemPortraits=previousItemPortraits.filter(a=>!retainedItemPortraits.has(a.id));
        const retainedPortraits=new Set(sceneTokenPortraits(state).map(item=>item.id));removedPortraits=previousPortraits.filter(item=>!retainedPortraits.has(item.id));
        if(previousMaps.length){const retained=new Set(sceneMaps(state).map(item=>item.id));removedMaps=previousMaps.filter(item=>!retained.has(item.id));}
      },['tokenMove','tokenRotate'].includes(action)?{id:data?.id,dragId:data?.dragId,sceneId:data?.sceneId,action}:null);
      if (deleted&&!campaignAssets(updated.state).some(a=>a.id===deleted.id)) await store.deleteAsset(id+'/'+deleted.id).catch(()=>{});
      await Promise.all([...removedMaps,...removedPortraits,...removedItemPortraits,...(oldInjury?[oldInjury]:[])].filter(asset=>!campaignAssets(updated.state).some(a=>a.id===asset.id)).map(asset=>store.deleteAsset(id+'/'+asset.id).catch(()=>{})));
      return json({...view(updated,access,responseScene),...(action==='lootCollect'&&lootResult?.itemId?{pickup:lootResult}:{})});
    }
    if (method === 'POST' && ['cinematic','map','pdf','sound','portrait','token-portrait'].includes(route)) {
      if (!master && route!=='portrait') fail(403,'Somente o mestre pode enviar arquivos.');
      return json(view(await upload(request,store,row,route,access),access,request.headers.get('X-Scene-Id')),201);
    }
    fail(404,'Ação indisponível.');
  } catch (error) {
    if (!error.status && !(error instanceof SyntaxError)) console.error(error);
    return json({error:error.status ? error.message : error instanceof SyntaxError ? 'Dados inválidos.' : 'Falha ao acessar a mesa.'},error.status|| (error instanceof SyntaxError ? 400 : 500));
  }
}
