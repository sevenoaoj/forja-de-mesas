import {sheetFields} from './model.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export const gmScreenActions=new Set(['gmPartyFields','gmCardSave','gmCardDelete','gmCardPin','gmCardMove','gmCardToggle','gmCardCollapse','gmTableRoll']);
export function gmBoard(state){return state.gmScreen||{cards:[]};}
export function mutateGmScreen(state,action,data,master){
 if(!gmScreenActions.has(action))return false;
 if(!master)fail(403,'O escudo é reservado ao mestre.');
 if(action==='gmTableRoll')return false;
 const board=state.gmScreen??={cards:[]},cards=board.cards;
 if(action==='gmPartyFields'){
  const character=state.characters.find(character=>character.id===data.id);
  if(!character)fail(404,'Ficha indisponível.');
  const valid=new Set(sheetFields(state,character).filter(field=>field.type==='number').map(field=>field.id));
  if(!Array.isArray(data.fields)||data.fields.length>8||new Set(data.fields).size!==data.fields.length||data.fields.some(id=>!valid.has(id)))fail(400,'Escolha até oito campos numéricos da ficha.');
  board.partyFields??={};board.partyFields[character.id]=[...data.fields];return true;
 }
 const old=cards.find(card=>card.id===data.id);
 if(data.id&&!old)fail(404,'Cartão indisponível.');
 if(action==='gmCardSave'){
  if(old&&data.version!==old.version)fail(409,'Este cartão mudou. Abra a edição novamente para preservar as alterações.');
  if(!old&&cards.length>=80)fail(409,'Use até 80 cartões por campanha.');
  if(!['note','checklist','table','reference'].includes(data.kind)||!['session','rules','world'].includes(data.category))fail(400,'Tipo ou categoria inválida.');
  const title=text(data.title,100);if(!title)fail(400,'Informe um título.');
  const card={id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,title,kind:data.kind,category:data.category,pinned:old?.pinned||false,collapsed:old?.collapsed||false,wide:data.wide===true,body:text(data.body,6000)};
  if(['checklist','table'].includes(card.kind)){
   const lines=card.body.split('\n').map(line=>line.trim()).filter(Boolean);
   if(lines.length>100||card.kind==='table'&&lines.length<2)fail(400,'Use até 100 linhas; tabelas precisam de pelo menos duas entradas.');
   card.items=lines.map(line=>({id:crypto.randomUUID(),text:line.replace(/^\[[ xX]\]\s*/,''),done:card.kind==='checklist'&&/^\[[xX]\]/.test(line)}));
   delete card.body;
  }
  if(card.kind==='reference'){
   if(!['book','character','rule'].includes(data.targetKind))fail(400,'Referência inválida.');
   if(data.targetKind==='book'&&!state.books.some(book=>book.id===data.targetId)||data.targetKind==='character'&&!state.characters.some(character=>character.id===data.targetId))fail(404,'A referência não está mais disponível.');
   // Rule IDs are validated by the API against the local SRD catalog.
   card.targetKind=data.targetKind;card.targetId=text(data.targetId,100);card.page=Math.max(1,Math.min(10000,Math.trunc(Number(data.page)||1)));
  }
  if(old)cards.splice(cards.indexOf(old),1,card);else cards.push(card);
 }else{
  if(!old)fail(404,'Cartão indisponível.');
  if(action==='gmCardDelete'){
   if(data.version!==old.version)fail(409,'Este cartão mudou. Confira o conteúdo antes de remover.');
   board.cards=cards.filter(card=>card!==old);
  }else if(action==='gmCardToggle'){
   const item=old.kind==='checklist'&&old.items.find(item=>item.id===data.itemId);
   if(!item||typeof data.done!=='boolean')fail(400,'Tarefa inválida.');
   item.done=data.done;old.version++;
  }else if(action==='gmCardPin')old.pinned=data.pinned===true;
  else if(action==='gmCardCollapse')old.collapsed=data.collapsed===true;
  else if(action==='gmCardMove'){
   if(![-1,1].includes(data.direction))fail(400,'Direção inválida.');
   const group=cards.filter(card=>Boolean(card.pinned)===Boolean(old.pinned)),next=data.targetId?group.find(card=>card.id===data.targetId):group[group.indexOf(old)+data.direction];
   if(data.targetId&&!next)fail(400,'Destino de ordenação inválido.');
   if(next){const a=cards.indexOf(old),b=cards.indexOf(next);[cards[a],cards[b]]=[cards[b],cards[a]];}
  }
 }
 return true;
}
