import {journalView} from './journal-model.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export const itemKinds={gear:'Equipamento',weapon:'Arma',armor:'Armadura',consumable:'Consumível',treasure:'Tesouro',quest:'Objeto de missão'};

const owned=(state,item,access)=>!access.guest&&access.memberId&&(state.characters||[]).some(c=>c.id===item.characterId&&!c.hidden&&c.ownerId===access.memberId);
export function inventoryView(state,access){const readable=new Set(journalView(state,access).map(e=>e.id));return (state.inventory||[]).filter(e=>access.master||owned(state,e,access)).map(e=>{if(access.master)return structuredClone(e);const {gmNotes,sourceId,...safe}=e;return {...safe,journalId:readable.has(e.journalId)?e.journalId:''};});}
const actions=new Set(['itemSave','itemGrant','itemDelete','itemManage']);
const numeric=(value,label,max,integer=false)=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>max||integer&&!Number.isInteger(n))fail(400,label+' inválido.');return n;};
export function mutateInventory(state,action,data={},access={}){
 if(!actions.has(action))return false;
 const entries=state.inventory||[],old=entries.find(e=>e.id===data.id);
 if(action!=='itemManage'&&!access.master)fail(403,'Somente o mestre prepara, entrega e remove itens.');
 if(action==='itemManage'&&!access.master&&(!old||!owned(state,old,access)))fail(403,'Você pode gerenciar apenas seu inventário.');
 if(data.id&&!old)fail(404,'Item indisponível.');
 if(old&&old.version!==data.version)fail(409,'Este item mudou. Abra novamente antes de salvar.');
 let next;
 if(action==='itemSave'){
  if(data.portrait!==undefined&&data.portrait!=='')fail(400,'Envie a imagem do item pelo campo de arquivo. URLs não são aceitas.');
  if(data.removePortrait!==undefined&&typeof data.removePortrait!=='boolean')fail(400,'Opção de retrato inválida.');
  if(data.accent!==undefined&&(typeof data.accent!=='string'||!/^#[0-9a-f]{6}$/i.test(data.accent)))fail(400,'Escolha uma cor de destaque válida.');
  const name=clean(data.name,120),kind=data.kind||'gear';if(!name||!Object.hasOwn(itemKinds,kind))fail(400,'Informe nome e categoria válidos.');
  const journalId=clean(data.journalId,100);if(journalId&&!state.journal?.some(e=>e.id===journalId))fail(400,'Documento do diário indisponível.');
  const entry={id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,characterId:old?.characterId||null,...(old?.sourceId?{sourceId:old.sourceId}:{}),name,kind,accent:data.accent?.toLowerCase()||old?.accent||'#dfbb73',portrait:data.removePortrait?'':old?.portrait||'',description:clean(data.description,8000),properties:clean(data.properties,4000),gmNotes:clean(data.gmNotes,8000),rarity:clean(data.rarity,80),weight:numeric(data.weight??0,'Peso',1000000),value:clean(data.value,120),journalId,quantity:old?.quantity??1,equipped:old?.equipped??false,notes:old?.notes||''};
  next=old?entries.map(e=>e===old?entry:e):[...entries,entry];
 }else if(action==='itemGrant'){
  if(!old||old.characterId)fail(400,'Selecione um item do catálogo.');
  if(!state.characters?.some(c=>c.id===data.characterId))fail(400,'Selecione uma ficha da campanha.');
  const quantity=numeric(data.quantity??1,'Quantidade',999999,true);if(!quantity)fail(400,'Entregue pelo menos uma unidade.');
  next=[...entries,{...structuredClone(old),id:crypto.randomUUID(),sourceId:old.id,version:1,characterId:data.characterId,quantity,equipped:false,notes:''}];
 }else if(action==='itemDelete'){
  if(!old)fail(404,'Item indisponível.');next=entries.filter(e=>e!==old);
 }else{
  if(!old?.characterId)fail(400,'Selecione um item de inventário.');
  if(typeof data.equipped!=='boolean')fail(400,'Estado de equipamento inválido.');
  const quantity=numeric(data.quantity,'Quantidade',999999,true);if(data.equipped&&!quantity)fail(400,'Um item sem unidades não pode ser equipado.');
  next=entries.map(e=>e===old?{...e,version:e.version+1,quantity,equipped:data.equipped,notes:clean(data.notes,4000)}:e);
 }
 commitInventory(state,next);return true;
}

export {publicItemToken} from './loot-data.mjs';
export function commitInventory(state,entries){
 if(entries.length>1000||new TextEncoder().encode(JSON.stringify(entries)).length>512*1024)fail(413,'O inventário suporta até 1000 itens e 512 KB por campanha.');
 state.inventory=entries;
}
