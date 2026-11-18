import {campaignParties,outsideParty,tokenCharacterId,characterType,isPlayerCharacter} from './model.mjs';
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

export function publicState(state,access) {
  const {parties,gmResources,sheetStarter,members,notes,initiative,gmScreen,sceneLibrary,inventory,journal,sheetTemplates,narrations,...base}=state;
  const shared={...base,tokens:(base.tokens||[]).filter(t=>access.master||!t.hidden).map(t=>publicItemToken(t,access.master)),...(base.table?{table:{...base.table,lootEvents:(base.table.lootEvents||[]).filter(e=>access.master||e.public!==false)}}:{}),inventory:inventoryView(state,access),narrations:narrationView(state,access),journal:journalView(state,access),sheetTemplates:sheetTemplatesView(state,access)};
  if (access.master) return {...shared,parties:campaignParties(state),gmResources:gmResources||{},characters:state.characters.map(fullCharacter),notes,initiative,gmScreen};
  const own=ownedCharacter(state,access);
  return {
    ...shared,
    characters:state.characters.filter(character=>!character.hidden&&!outsideParty(character,own)).map(character=>
      isPlayerCharacter(character)&&character.ownerId===access.memberId&&access.memberId ? fullCharacter(character) : {
        id:character.id,name:character.name,concept:character.concept,color:character.color,
        portrait:character.portrait,characterType:characterType(character),access:'summary',available:isPlayerCharacter(character)&&!character.ownerId
      }),
    rolls:rollView(state,false,own)
  };
}
