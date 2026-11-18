import {playerVisionSource} from './model.mjs';
import {withScene} from './scene-model.mjs';
import {mutateTable,normalizeTable} from './table-model.mjs';
import {commitInventory} from './inventory-model.mjs';
import {pointRevealed} from './fog-geometry.mjs';
import {visionSources,tokenInVision} from './vision-model.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export const lootActions=new Set(['lootPlace','lootCollect']);
export function mutateLoot(state,action,data,access){
 if(!lootActions.has(action))return false;
 if(action==='lootPlace'&&!access.master)fail(403,'Somente o mestre coloca itens na mesa.');
 if(access.guest||!access.master&&!access.memberId)fail(403,'Entre na campanha e escolha seu personagem.');
 const draft=structuredClone(state);let result={};
 withScene(draft,data.sceneId,access.master,world=>{
  if(action==='lootPlace'){
   const item=(draft.inventory||[]).find(e=>e.id===data.itemId&&!e.characterId);if(!item)fail(404,'Selecione um item do catálogo do mestre.');
   if(data.version!==item.version)fail(409,'O item mudou. Abra novamente antes de posicionar.');
   const quantity=Number(data.quantity??1);if(!Number.isInteger(quantity)||quantity<1||quantity>999999)fail(400,'Quantidade inválida.');
   if(data.revealed!==undefined&&typeof data.revealed!=='boolean')fail(400,'Visibilidade inválida.');
   mutateTable(world,'tokenAdd',{name:typeof data.name==='string'&&data.name.trim()?data.name.trim().slice(0,80):item.name.slice(0,80),color:'gold',icon:({weapon:'hammer',armor:'shield',consumable:'flask',treasure:'gem',quest:'key',gear:'compass'}[item.kind]||'gem'),x:data.x,y:data.y,hidden:data.revealed!==true,vision:{enabled:false,range:0,angle:360}},true);
   const token=world.tokens.at(-1);token.kind='item';token.characterId='';token.loot={version:1,quantity,item:structuredClone(item)};result={tokenId:token.id};
  }else{
   const token=world.tokens.find(t=>t.id===data.id&&t.kind==='item'&&t.loot);if(!token)fail(409,'Este item já foi coletado ou removido.');
   if(data.version!==token.loot.version)fail(409,'O item mudou. Abra novamente para coletar.');
   if(!Number.isInteger(token.loot.quantity)||token.loot.quantity<1||token.loot.quantity>999999||!token.loot.item||typeof token.loot.item.name!=='string')fail(400,'Este item precisa ser revisado pelo mestre.');
   if(!Number.isInteger(token.loot.quantity)||token.loot.quantity<1||token.loot.quantity>999999||!token.loot.item||typeof token.loot.item.name!=='string')fail(400,'O conteúdo deste item está inválido. Peça ao mestre para posicioná-lo novamente.');
   const character=draft.characters.find(c=>access.master?c.id===data.characterId:!c.hidden&&c.ownerId===access.memberId);
   if(!character||!access.master&&data.characterId&&data.characterId!==character.id)fail(403,'Você só pode coletar para o seu personagem.');
   const table=normalizeTable(world),x=Number(token.x)+Number(token.size||1)/2,y=Number(token.y)+Number(token.size||1)/2;
   const ownTokens=world.tokens.filter(t=>t.kind!=='item'&&!t.hidden&&t.characterId===character.id);
   const nearby=ownTokens.find(t=>Math.max(Math.abs(Number(t.x)+Number(t.size||1)/2-x),Math.abs(Number(t.y)+Number(t.size||1)/2-y))<=(Number(t.size||1)+Number(token.size||1))/2+1+.00001);
   if(!access.master){
    if(token.hidden)fail(403,'O mestre ainda não revelou este item.');
    if(!nearby)fail(400,'Aproxime um token do seu personagem até uma célula do item para coletar.');
    if(table.fog.mode!=='war'&&!pointRevealed(table.fog,{x,y}))fail(403,'Este item está encoberto pela névoa.');
    const tokens=world.tokens.map(t=>({...t,visionSource:playerVisionSource(draft,t)}));
    if((table.darkness.enabled||table.fog.enabled&&table.fog.mode==='war')&&!tokenInVision(token,visionSources({master:false,characterId:character.id,state:{...world,table}},tokens),table.grid,table.walls))fail(403,'Este item está fora do campo de visão.');
   }
   const copy={...structuredClone(token.loot.item),id:crypto.randomUUID(),sourceId:token.loot.item.id,version:1,characterId:character.id,quantity:token.loot.quantity,equipped:false,notes:''};
   commitInventory(draft,[...(draft.inventory||[]),copy]);
   world.tokens=world.tokens.filter(t=>t.id!==token.id);
   const event={id:crypto.randomUUID(),tokenId:token.id,at:Date.now(),x,y,toX:nearby?Number(nearby.x)+Number(nearby.size||1)/2:x,toY:nearby?Number(nearby.y)+Number(nearby.size||1)/2:y,public:!token.hidden&&!character.hidden};
   world.table={...table,lootEvents:[...(table.lootEvents||[]),event].slice(-12)};result={itemId:copy.id,eventId:event.id};
  }
 });
 for(const key of ['tokens','table','inventory','sceneLibrary'])if(draft[key]!==undefined)state[key]=draft[key];
 return result;
}
