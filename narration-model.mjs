import {narrationStyle} from './narration-style.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function narrationView(state,access){
 const messages=state.narrations||[];
 if(access.master)return structuredClone(messages);
 if(access.guest||!access.memberId)return [];
 return messages.filter(message=>!message.readAt&&message.memberId===access.memberId&&state.characters.some(c=>c.id===message.characterId&&!c.hidden&&c.ownerId===access.memberId))
  .map(({memberId,...message})=>message);
}
export function mutateNarration(state,action,data,access){
 if(!['narrationSend','narrationRead'].includes(action))return false;
 if(action==='narrationSend'){
  if(!access.master)fail(403,'Somente o mestre pode enviar narrações privadas.');
  const character=state.characters.find(c=>c.id===data.characterId&&!c.hidden&&c.ownerId);
  if(!character)fail(400,'Escolha um personagem controlado por um jogador.');
  const body=typeof data.body==='string'?data.body.trim():'';
  const title=typeof data.title==='string'?data.title.trim():'';
  if(!body||body.length>4000||title.length>120)fail(400,'Use um título de até 120 caracteres e uma mensagem de 1 a 4000 caracteres.');
  const style=narrationStyle(data.style??{},true);
  const messages=state.narrations||[];
  // Keep unread narration until acknowledged instead of silently dropping it.
  if(messages.filter(m=>!m.readAt).length>=100)fail(409,'Há 100 mensagens pendentes. Aguarde a leitura antes de enviar mais.');
  state.narrations=[...messages.filter(m=>!m.readAt),...messages.filter(m=>m.readAt).slice(-49),{
   id:crypto.randomUUID(),characterId:character.id,characterName:character.name,memberId:character.ownerId,
   title:title||'Uma mensagem do mestre',body,style,at:Date.now(),readAt:null
  }];
 }else{
  const message=(state.narrations||[]).find(m=>m.id===data.id);
  if(access.master||access.guest||!message||message.memberId!==access.memberId||!state.characters.some(c=>c.id===message.characterId&&!c.hidden&&c.ownerId===access.memberId))fail(403,'Mensagem indisponível.');
  message.readAt??=Date.now();
 }
 return true;
}
