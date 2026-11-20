import {sharingView} from './player-sharing.mjs';
import {cinematicStyle,campaignParties,outsideParty,tokenCharacterId,characterType,isPlayerCharacter} from './model.mjs';
import {sessionLogView} from './session-log.mjs';
import {inventoryView,publicItemToken} from './inventory-model.mjs';
import {journalView} from './journal-model.mjs';
import {sheetTemplatesView} from './sheet-template-model.mjs';
import {narrationView} from './narration-model.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

export function accessFor(row,key) {
  if (key===row.owner) return {master:true};
  if (key===row.player) return {master:false,guest:true};
  const member=row.state.members?.find(member=>member.key===key);
  return member ? {master:false,memberId:member.id} : null;
}

export function ownedCharacter(state,access) {
  return access.memberId ? state.characters.find(character=>!character.hidden&&isPlayerCharacter(character)&&character.ownerId===access.memberId) : null;
}

export function requireOwnCharacter(state,access,id) {
  const character=state.characters.find(character=>character.id===id);
  if (!character || !access.master&&(character.hidden||!isPlayerCharacter(character)||!access.memberId||character.ownerId!==access.memberId)) {
    fail(403,'Você pode acessar os detalhes apenas do seu personagem.');
  }
  return character;
}

export function authorizeAction(state,access,action,data) {
  if (access.master) return;
  if (access.guest) fail(403,'Entre na campanha e escolha um personagem.');
  if (action==='characterClaim') return;
  if (action==='character'&&!data.id) {
    if (ownedCharacter(state,access)) fail(409,'Você já possui um personagem nesta campanha.');
    return;
  }
  const own=ownedCharacter(state,access);
  if (!own) fail(403,'Escolha ou crie seu personagem para entrar na mesa.');
  if (['character','sheetValue','sheetAppearance','bodyStressStep','sheetCounter','sheetFields','sheetPortraitDelete','sheetHistoryRestore','sheetEntry','sheetMastery','dndAdd','dndRest','dndCast'].includes(action)) {
    requireOwnCharacter(state,access,data.id);
  }
  if (action==='tokenMove'||action==='tokenRotate') {
    const token=state.tokens.find(token=>token.id===data.id);
    if (!token || tokenCharacterId(state,token)!==own.id) fail(403,'Você pode mover apenas os tokens do seu personagem.');
  }
}

function fullCharacter(character) {
  const {ownerId,presentation,...data}=character;
  return {...data,characterType:characterType(character),access:'full',claimed:Boolean(ownerId)};
}

export function rollView(state,master,viewer) {
  if(master)return state.rolls||[];
  const hidden=state.characters.filter(character=>character.hidden||outsideParty(character,viewer));
  const ids=new Set(hidden.map(c=>c.id)),names=new Set(hidden.map(c=>c.name));
  return (state.rolls||[]).filter(roll=>roll.rolledBy==='player'&&roll.visibility==='public'&&(roll.characterId?!ids.has(roll.characterId):!names.has(roll.actor)));
}

export function rollVersion(rolls) {
  let hash=2166136261;
  for(const roll of rolls)for(const char of String(roll.id||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return rolls.length+'-'+(hash>>>0).toString(36);
}

export function checkRequestView(state,access){
  const viewer=ownedCharacter(state,access);
  if(!viewer&&!access.master)return [];
  return (state.checkRequests||[]).flatMap(check=>{
    const targets=check.targets.filter(target=>access.master||target.characterId===viewer.id&&target.memberId===access.memberId);
    if(!targets.length||!access.master&&check.closed)return [];
    return [{id:check.id,label:check.label,closed:check.closed,
      ...(access.master||check.showDc?{dc:check.dc}:{}),
      targets:targets.map(({memberId,...target})=>{
        if(!access.master||!target.result)return target;
        const {id,formula,total}=target.result;
        return {...target,result:{id,formula,total}};
      })}];
  });
}
// Requests are immutable after creation except for each participant's single result.
export function checkVersion(checks){
  return rollVersion(checks.flatMap(check=>[check,...check.targets.map(t=>({id:t.result?.id||t.characterId}))]));
}
export function cinematicView(state,access){
  const run=state.cinematicRun;
  if(!run||Date.now()>=run.endsAt)return null;
  const viewer=ownedCharacter(state,access);
  if(!access.master&&(!viewer||run.party&&viewer.party!==run.party))return null;
  const asset=state.cinematicLibrary?.find(a=>a.id===run.mediaId);
  return {id:run.id,text:run.text,soundtrackId:run.soundtrackId||'',...cinematicStyle(run),startedAt:run.startedAt,revealAt:run.revealAt,endsAt:run.endsAt,media:asset?{id:asset.id,type:asset.type}:null};
}
export function publicState(state,access) {
  const {mediaCheck,investigationReceipts,materialShares,sessionLog,cinematicCues,cinematicRun,cinematicLibrary,parties,gmResources,sheetStarter,members,notes,initiative,gmScreen,sceneLibrary,inventory,journal,sheetTemplates,narrations,...base}=state;
  const shared={...base,checkRequests:checkRequestView(state,access),cinematic:cinematicView(state,access),tokens:(base.tokens||[]).filter(t=>access.master||!t.hidden).map(t=>publicItemToken(t,access.master)),...(base.table?{table:{...base.table,...(!access.master&&base.table.exploration?{exploration:[]}:{}),lootEvents:(base.table.lootEvents||[]).filter(e=>access.master||e.public!==false)}}:{}),inventory:inventoryView(state,access),narrations:narrationView(state,access),journal:journalView(state,access),sheetTemplates:sheetTemplatesView(state,access)};
  shared.sessionLog=sessionLogView(state,access.master,ownedCharacter(state,access),shared.journal,shared.inventory);
  if (access.master) return {...shared,cinematicCues:cinematicCues||[],cinematicLibrary:cinematicLibrary||[],parties:campaignParties(state),gmResources:gmResources||{},characters:state.characters.map(fullCharacter),notes,initiative,gmScreen};
  const own=ownedCharacter(state,access);
  return {
    ...shared,...(own?.party&&campaignParties(state).find(g=>g.id===own.party)?.emblem?{partyEmblem:campaignParties(state).find(g=>g.id===own.party).emblem}:{}),sharing:sharingView(state,own),
    investigationReceipts:own?(investigationReceipts||[]).filter(r=>r.characterId===own.id&&r.memberId===access.memberId).map(({id,location,from,items})=>({id,location,from,items})):[],
    characters:state.characters.filter(character=>!character.hidden&&!outsideParty(character,own)).map(character=>
      isPlayerCharacter(character)&&character.ownerId===access.memberId&&access.memberId ? fullCharacter(character) : {
        id:character.id,name:character.name,concept:character.concept,color:character.color,
        portrait:character.portrait,characterType:characterType(character),access:'summary',available:isPlayerCharacter(character)&&!character.ownerId
      }),
    rolls:rollView(state,false,own)
  };
}
