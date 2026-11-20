import {isPlayerCharacter,outsideParty} from './model.mjs';
import {chargeFields,commitInventory,recordItemDelivery} from './inventory-model.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const active=c=>c&&!c.hidden&&c.ownerId&&isPlayerCharacter(c);
const team=c=>c.party||'';
const knows=(note,c)=>note&&(note.authorId===c.ownerId||note.discoveredBy?.includes('character:'+c.id)||c.party&&note.discoveredBy?.includes('party:'+c.party));
function knownTo(character,viewer){
 return !outsideParty(character,viewer)||Boolean(viewer.party&&character.partyRevealed);
}
function peers(state,own){
 return state.characters.filter(c=>active(c)&&c.id!==own.id&&knownTo(c,own)&&knownTo(own,c));
}
function material(state,source,kind,id){
 if(kind==='note'){const note=state.journal?.find(n=>n.id===id);return knows(note,source)?note:null;}
 if(kind==='item')return state.inventory?.find(i=>i.id===id&&i.characterId===source.id);
}
export function sharingView(state,own){
 const result={peers:[],received:[],sent:[],notes:[]};
 if(!active(own))return result;
 result.peers=peers(state,own).map(c=>({id:c.id,name:c.name,teammate:team(c)===team(own)}));
 result.notes=(state.journal||[]).filter(n=>knows(n,own)).map(n=>n.id);
 for(const grant of state.materialShares||[]){
  if(grant.until<=Date.now())continue;
  const source=state.characters.find(c=>c.id===grant.source);
  if(!active(source)||source.ownerId!==grant.sender)continue;
  const entry=material(state,source,grant.kind,grant.materialId);if(!entry)continue;
  if(source.id===own.id){result.sent.push({id:grant.id,kind:grant.kind,materialId:entry.id,until:grant.until,label:grant.label});continue;}
  if(!knownTo(own,source)||!knownTo(source,own)||grant.group!==undefined&&(team(source)!==grant.group||team(own)!==grant.group)||!grant.recipients.some(r=>r.id===own.id&&r.member===own.ownerId))continue;
  const item=grant.kind==='note'?{title:entry.title,body:entry.body}:
   Object.fromEntries(['name','kind','accent','description','properties','photos','content','origin','categoryName','rarity','weight','value','portrait'].map(key=>[key,entry[key]]));
  result.received.push({id:grant.id,kind:grant.kind,until:grant.until,from:source.name,material:item});
 }
 return result;
}
export function mutateSharing(state,action,data,own){
 if(!['materialShare','shareRevoke','playerTransfer'].includes(action))return false;
 if(!active(own))fail(403,'Escolha sua ficha de jogador.');
 const shares=(state.materialShares||[]).filter(g=>g.until>Date.now());
 if(action==='shareRevoke'){
  const grant=shares.find(g=>g.id===data.id&&g.source===own.id&&g.sender===own.ownerId);
  if(!grant)fail(404,'Compartilhamento indisponível.');
  state.materialShares=shares.filter(g=>g!==grant);return true;
 }
 const kind=action==='playerTransfer'?'item':data.kind,entry=material(state,own,kind,data.id);
 if(!entry)fail(403,'Esse material não está disponível para esta ação.');
 if(data.version!==entry.version)fail(409,'O material mudou. Abra novamente.');
 const eligible=peers(state,own),group=data.target==='group';
 const recipients=eligible.filter(c=>group?team(c)===team(own):c.id===data.target);
 if(!recipients.length)fail(400,'Escolha outro jogador disponível.');
 if(action==='playerTransfer'){
  if(group||team(recipients[0])!==team(own))fail(403,'A entrega exige um jogador do mesmo grupo.');
  const n=data.quantity;
  if(!Number.isInteger(n)||n<1||n>entry.quantity)fail(409,'Quantidade indisponível para entrega.');
  const rest=state.inventory.filter(i=>i!==entry);
  const charges=chargeFields(entry),sent=chargeFields(entry,n);
  if(n<entry.quantity)rest.push({...entry,...(entry.kind==='consumable'?{...charges,uses:charges.uses-sent.uses}:{}),quantity:entry.quantity-n,version:entry.version+1});
  commitInventory(state,[...rest,{...entry,id:crypto.randomUUID(),characterId:recipients[0].id,version:1,...sent,quantity:n,notes:'',equipped:false}]);
  recordItemDelivery(state,recipients[0],[state.inventory.at(-1)],{from:own.name});
  return true;
 }
 if(![5,15,60].includes(data.minutes))fail(400,'Escolha o prazo do compartilhamento.');
 const label=group?'Meu grupo':recipients[0].name;
 const next=shares.filter(g=>!(g.source===own.id&&g.materialId===entry.id&&g.target===data.target&&g.kind===kind));
 if(next.length>=200)fail(409,'Encerre um compartilhamento antes de criar outro.');
 state.materialShares=[...next,{id:crypto.randomUUID(),sender:own.ownerId,source:own.id,target:data.target,label,kind,materialId:entry.id,
  until:Date.now()+data.minutes*60000,...(group?{group:team(own)}:{}),recipients:recipients.map(c=>({id:c.id,member:c.ownerId}))}];
 return true;
}
