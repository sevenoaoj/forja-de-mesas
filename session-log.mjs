import {campaignParties} from './model.mjs';
import {sceneLibrary} from './scene-model.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const audiences=new Set(['gm','all']);
const validText=(text,max)=>typeof text==='string'&&text.trim().length>0&&text.length<=max;
function visible(entry,master,character){
  return master||Boolean(character&&(entry.audience==='all'||entry.audience!=='gm'&&entry.audience===character.party));
}
export function sessionLogView(state,master,character,journal,inventory){
  const log=state.sessionLog||{};
  const clocks=(log.clocks||[]).filter(entry=>visible(entry,master,character));
  const recaps=(log.recaps||[]).filter(entry=>visible(entry,master,character)).map(entry=>({...entry,
    notes:entry.notes.filter(id=>journal.some(note=>note.id===id)),
    clockIds:(entry.clockIds||[]).filter(id=>clocks.some(clock=>clock.id===id)),
    items:entry.items.filter(id=>inventory.some(item=>item.id===id)),
    sceneId:master||entry.sceneId===state.activeSceneId?entry.sceneId:'',
  }));
  return {clocks,recaps};
}
const commands=new Set(['clockSave','clockStep','clockDelete','recapSave','recapDelete']);
export function mutateSessionLog(state,action,data,master){
  if(!commands.has(action))return false;
  if(!master)fail(403,'Somente o mestre organiza relógios e resumos.');
  const clock=action.startsWith('clock'),log=state.sessionLog??={clocks:[],recaps:[]};
  const entries=clock?log.clocks:log.recaps,old=entries.find(e=>e.id===data.id);
  if(data.id&&!old)fail(404,'Registro indisponível.');
  if(old&&data.version!==old.version)fail(409,'O registro mudou. Confira o valor atual antes de continuar.');
  if(action.endsWith('Delete')||action==='clockStep'){
    if(!old)fail(404,'Registro indisponível.');
    if(action.endsWith('Delete'))entries.splice(entries.indexOf(old),1);
    else {
      if(![-1,1].includes(data.step)||old.value+data.step<0||old.value+data.step>old.segments)fail(400,'Ajuste fora do relógio.');
      old.value+=data.step;old.version++;
    }
    return true;
  }
  if(!validText(data.title,100))fail(400,'Informe um título de até 100 caracteres.');
  if(!audiences.has(data.audience)&&!campaignParties(state).some(g=>g.id===data.audience))fail(400,'Escolha o público do registro.');
  if(!old&&entries.length>=(clock?40:120))fail(409,'O limite de registros foi atingido.');
  const entry={id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,title:data.title.trim(),audience:data.audience};
  if(clock){
    if(![4,6,8].includes(data.segments)||!Number.isInteger(data.value)||data.value<0||data.value>data.segments)fail(400,'Confira as divisões e o progresso do relógio.');
    Object.assign(entry,{segments:data.segments,value:data.value});
  }else{
    const lib=sceneLibrary(state),session=lib.sessions.find(s=>s.id===data.sessionId);
    if(!session||data.linkedSceneId&&!lib.scenes.some(s=>s.id===data.linkedSceneId&&s.sessionId===session.id))fail(400,'Selecione uma sessão e uma cena dela.');
    if(!validText(data.body,4000))fail(400,'Escreva um resumo de até 4000 caracteres.');
    for(const [field,list] of [['notes',state.journal],['items',state.inventory],['clockIds',log.clocks]]){
      const refs=data[field]??[];
      if(!Array.isArray(refs)||refs.length>30||refs.some(id=>!(list||[]).some(e=>e.id===id)))fail(400,'Confira os materiais vinculados ao resumo.');
      entry[field]=[...new Set(refs)];
    }
    Object.assign(entry,{sessionId:session.id,sessionName:session.name,sceneId:data.linkedSceneId||'',sceneName:lib.scenes.find(s=>s.id===data.linkedSceneId)?.name||'',body:data.body.trim(),at:Date.now()});
  }
  if(old)entries.splice(entries.indexOf(old),1,entry);else entries.push(entry);
  return true;
}
export function validateSessionLog(log){
  if(log===undefined)return;
  for(const [key,limit] of [['clocks',40],['recaps',120]]){
    const entries=log?.[key];
    if(!Array.isArray(entries)||entries.length>limit)fail(400,'Registro de sessão inválido no backup.');
    const ids=new Set();
    for(const e of entries){
      if(!e||!validText(e.id,80)||ids.has(e.id)||!validText(e.audience,80)||!validText(e.title,100)||!Number.isSafeInteger(e.version)||e.version<1)fail(400,'Registro de sessão inválido no backup.');
      ids.add(e.id);
      if(key==='clocks'){
        if(![4,6,8].includes(e.segments)||!Number.isInteger(e.value)||e.value<0||e.value>e.segments)fail(400,'Relógio inválido no backup.');
      }else if(!validText(e.body,4000)||!validText(e.sessionName,100)||!validText(e.sessionId,80)||typeof e.sceneId!=='string'||!Number.isFinite(e.at)||[e.notes,e.items,e.clockIds??[]].some(refs=>!Array.isArray(refs)||refs.length>30||refs.some(id=>!validText(id,100))))fail(400,'Resumo inválido no backup.');
    }
  }
}
