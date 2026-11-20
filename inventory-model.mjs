import {removeSessionMaterial} from './scene-model.mjs';
import {journalView} from './journal-model.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
import {inventoryKinds as itemKinds,readingKinds,canEquipKind} from './model.mjs';
export {itemKinds};

const owned=(state,item,access)=>!access.guest&&access.memberId&&(state.characters||[]).some(c=>c.id===item.characterId&&!c.hidden&&c.ownerId===access.memberId);
// A stack shares its charge pool. Old consumables have one use per unit.
export function chargeFields(item,quantity=item.quantity??1){
 if(item.kind!=='consumable')return {};
 const usesPerUnit=item.usesPerUnit??1,capacity=quantity*usesPerUnit;
 const oldQuantity=item.quantity??1,remaining=item.uses??oldQuantity*usesPerUnit;
 return {usesPerUnit,uses:Math.min(capacity,remaining+Math.max(0,quantity-oldQuantity)*usesPerUnit)};
}
export function recordItemDelivery(state,character,items,context){
 if(!character?.ownerId||!items.length)return;
 (state.investigationReceipts??=[]).push({id:crypto.randomUUID(),memberId:character.ownerId,characterId:character.id,...context,
  items:items.map(({id,name,kind,quantity,accent,portrait})=>({itemId:id,name,kind,quantity,accent,portrait:portrait||''}))});
}
function removeCatalogReferences(state,id){
 removeSessionMaterial(state,'item',id);
 for(const scene of [state,...(state.sceneLibrary?.scenes||[])]){
  for(const point of scene.table?.exploration||[]){
   const rules=point.rules;
   if(rules?.rewards)rules.rewards=rules.rewards.filter(r=>r.itemId!==id);
   if(rules?.itemId===id)rules.itemId='';
  }
 }
}
export function inventoryView(state,access){if(access.master)return structuredClone(state.inventory||[]).map(e=>({...e,equipped:canEquipKind(e.kind)&&!!e.equipped,...chargeFields(e)}));const readable=new Set(journalView(state,access).map(e=>e.id));return (state.inventory||[]).filter(e=>owned(state,e,access)).map(e=>{const {gmNotes,sourceId,...safe}=e;return {...safe,equipped:canEquipKind(e.kind)&&!!e.equipped,...chargeFields(e),journalId:readable.has(e.journalId)?e.journalId:''};});}
const actions=new Set(['itemSave','itemGrant','itemDelete','itemManage','itemUse']);
const numeric=(value,label,max,integer=false)=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>max||integer&&!Number.isInteger(n))fail(400,label+' inválido.');return n;};
export function mutateInventory(state,action,data={},access={}){
 if(!actions.has(action))return false;
 const entries=state.inventory||[],old=entries.find(e=>e.id===data.id);
 if(!['itemManage','itemDelete','itemUse'].includes(action)&&!access.master)fail(403,'Somente o mestre prepara, entrega e remove itens.');
 if(['itemManage','itemDelete','itemUse'].includes(action)&&!access.master&&(!old||!owned(state,old,access)))fail(403,'Você pode gerenciar apenas seu inventário.');
 if(data.id&&!old)fail(404,'Item indisponível.');
 if(old&&old.version!==data.version)fail(409,'Este item mudou. Abra novamente antes de salvar.');
 let next;
 if(action==='itemSave'){
  if(data.portrait!==undefined&&data.portrait!=='')fail(400,'Envie a imagem do item pelo campo de arquivo. URLs não são aceitas.');
  if(data.removePortrait!==undefined&&typeof data.removePortrait!=='boolean')fail(400,'Opção de retrato inválida.');
  if(data.accent!==undefined&&(typeof data.accent!=='string'||!/^#[0-9a-f]{6}$/i.test(data.accent)))fail(400,'Escolha uma cor de destaque válida.');
  const name=clean(data.name,120),kind=data.kind||'gear';if(!name||!Object.hasOwn(itemKinds,kind))fail(400,'Informe nome e categoria válidos.');
  const journalId=clean(data.journalId,100);if(journalId&&!state.journal?.some(e=>e.id===journalId))fail(400,'Documento do diário indisponível.');
  const entry={id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,characterId:old?.characterId||null,...(old?.sourceId?{sourceId:old.sourceId}:{}),name,kind,accent:data.accent?.toLowerCase()||old?.accent||'#dfbb73',portrait:data.removePortrait?'':old?.portrait||'',description:clean(data.description,8000),properties:clean(data.properties,4000),gmNotes:clean(data.gmNotes,8000),rarity:clean(data.rarity,80),weight:numeric(data.weight??0,'Peso',1000000),value:clean(data.value,120),journalId,quantity:old?.quantity??1,equipped:canEquipKind(kind)&&!!old?.equipped,notes:old?.notes||''};
  if(Object.hasOwn(readingKinds,kind)||kind==='custom'){
   const content=data.content??old?.content??'';
   if(typeof content!=='string'||content.length>24000)fail(400,'O conteúdo deve ter até 24.000 caracteres.');
   if(kind==='phone'){
    const photos=data.photos??old?.photos??[];
    if(!Array.isArray(photos)||photos.length>6||photos.some(p=>!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>255||typeof p.src!=='string'||p.src.length>150000||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+=*$/.test(p.src))||new Set(photos.map(p=>p.name)).size!==photos.length)fail(400,'Álbum de fotos inválido.');
    if(photos.length)entry.photos=photos.map(({name,src})=>({name,src}));
   }
   entry.content=content.trim();
   entry.origin=clean(data.origin??old?.origin,160);
   if(kind==='custom'){
    entry.categoryName=clean(data.categoryName??old?.categoryName,60);
    if(!entry.categoryName)fail(400,'Informe o nome da categoria personalizada.');
   }
  }
  if(kind==='consumable'){
   entry.usesPerUnit=numeric(data.usesPerUnit??old?.usesPerUnit??1,'Usos por unidade',9999,true);
   if(!entry.usesPerUnit)fail(400,'Informe pelo menos um uso por unidade.');
   const spent=old?.characterId&&old.kind==='consumable'?old.quantity*(old.usesPerUnit??1)-chargeFields(old).uses:0;
   entry.uses=Math.max(0,entry.quantity*entry.usesPerUnit-spent);
  }
  next=old?entries.map(e=>e===old?entry:e):[...entries,entry];
 }else if(action==='itemGrant'){
  if(!old||old.characterId)fail(400,'Selecione um item do catálogo.');
  if(!state.characters?.some(c=>c.id===data.characterId))fail(400,'Selecione uma ficha da campanha.');
  const quantity=numeric(data.quantity??1,'Quantidade',999999,true);if(!quantity)fail(400,'Entregue pelo menos uma unidade.');
  next=[...entries,{...structuredClone(old),id:crypto.randomUUID(),sourceId:old.id,...chargeFields(old,quantity),version:1,characterId:data.characterId,quantity,equipped:false,notes:''}];
 }else if(action==='itemDelete'){
  if(!old)fail(404,'Item indisponível.');
  const source=old.sourceId||old.id;
  next=access.master?entries.filter(e=>e.id!==source&&e.sourceId!==source):entries.filter(e=>e!==old);
  if(access.master)removeCatalogReferences(state,source);
  if(state.investigationReceipts){
   const removed=new Set(entries.filter(e=>!next.includes(e)).map(e=>e.id));
   state.investigationReceipts=state.investigationReceipts.map(r=>({...r,items:r.items.filter(i=>!removed.has(i.itemId))})).filter(r=>r.items.length);
  }
 }else if(action==='itemUse'){
  if(!old?.characterId||old.kind!=='consumable'||![1,-1].includes(data.delta))fail(400,'Escolha um consumível e uma alteração de um uso.');
  const {uses,usesPerUnit}=chargeFields(old),remaining=uses+data.delta;
  if(remaining<0||remaining>old.quantity*usesPerUnit)fail(409,'A barra de usos já atingiu o limite.');
  next=entries.map(e=>e===old?{...e,usesPerUnit,uses:remaining,version:e.version+1}:e);
 }else{
  if(!old?.characterId)fail(400,'Selecione um item de inventário.');
  if(typeof data.equipped!=='boolean')fail(400,'Estado de equipamento inválido.');
  if(data.equipped&&!canEquipKind(old.kind))fail(400,'Somente equipamentos, armas e armaduras podem ser equipados.');
  const quantity=numeric(data.quantity,'Quantidade',999999,true);if(data.equipped&&!quantity)fail(400,'Um item sem unidades não pode ser equipado.');
  next=entries.map(e=>e===old?{...e,version:e.version+1,...chargeFields(e,quantity),quantity,equipped:data.equipped,notes:clean(data.notes,4000)}:e);
 }
 commitInventory(state,next);return true;
}

export {publicItemToken} from './loot-data.mjs';
export function commitInventory(state,entries){
 if(entries.length>1000||new TextEncoder().encode(JSON.stringify(entries)).length>512*1024)fail(413,'O inventário suporta até 1000 itens e 512 KB por campanha.');
 state.inventory=entries;
}
