import {sheetFields} from './model.mjs';
import {ownedCharacter,requireOwnCharacter} from './access.mjs';
import {validateSheetAppearance,sheetAppearance} from './sheet-layout.mjs';

export const sheetHistoryLimits=Object.freeze({entries:20,snapshotBytes:64*1024,characterBytes:96*1024,campaignBytes:384*1024});
export const sheetHistoryActions=new Set(['character','sheetValue','schema','sheetFields','sheetCounter','sheetEntry','sheetMastery','sheetMasteryRefresh','sheetAppearance','dndAdd','dndRest','dndCast','roll','sheetTemplateApply']);
export const isSheetHistoryRelevant=action=>sheetHistoryActions.has(action);
const editable=['name','concept','color','skills','abilities','rollButtons','masteries','dnd','preset','appearance'];
const clone=value=>structuredClone(value);
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const compact=value=>String(value??'').replace(/\s+/g,' ').slice(0,100);
const version=character=>Number.isSafeInteger(character.sheetHistory?.version)&&character.sheetHistory.version>=0?character.sheetHistory.version:0;
function snapshot(state,character){
 const result={layout:clone(sheetFields(state,character)),values:{}};
 result.values=Object.fromEntries(result.layout.map(field=>[field.id,Object.hasOwn(character.values||{},field.id)?character.values[field.id]:field.initial??'']));
 for(const key of editable)if(character[key]!==undefined)result[key]=clone(character[key]);
 result.appearance=clone(sheetAppearance(state,character));delete result.appearance.version;
 return result;
}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
export function captureSheetChanges(state,action,data={},access={}){
 if(!isSheetHistoryRelevant(action)||action==='roll'&&!data.masteryId)return [];
 let characters;
 if(action==='schema'||action==='sheetMasteryRefresh'&&!data.id)characters=state.characters;
 else if(action==='roll')characters=[access.master?state.characters.find(c=>c.id===data.characterId):ownedCharacter(state,access)].filter(Boolean);
 else characters=state.characters.filter(c=>c.id===(action==='sheetTemplateApply'?data.characterId:data.id));
 return characters.map(character=>({id:character.id,before:snapshot(state,character),actor:access.master?'Mestre':character.name}));
}
function describe(before,after){
 const changes=[];
 for(const [key,label] of [['name','Nome'],['concept','Conceito'],['color','Cor']])if(!equal(before[key],after[key]))changes.push(label+': '+compact(before[key])+' → '+compact(after[key]));
 const old=new Map(before.layout.map(field=>[field.id,field])),next=new Map(after.layout.map(field=>[field.id,field]));
 for(const [id,field] of next){
  if(!old.has(id))changes.push('Campo adicionado: '+field.label);
  else {if(!equal(old.get(id),field))changes.push('Campo reorganizado ou configurado: '+field.label);if(!equal(before.values[id],after.values[id]))changes.push(field.label+': '+compact(before.values[id])+' → '+compact(after.values[id]));}
 }
 for(const [id,field] of old)if(!next.has(id))changes.push('Campo removido: '+field.label);
 if(equal([...old.keys()].sort(),[...next.keys()].sort())&&!equal([...old.keys()],[...next.keys()]))changes.push('Ordem dos campos alterada');
 for(const [key,label] of [['skills','Perícias'],['abilities','Habilidades'],['rollButtons','Rolagens personalizadas'],['masteries','Maestrias']])if(!equal(before[key],after[key])){
  const a=before[key]||[],b=after[key]||[],changed=b.filter(item=>!a.some(previous=>previous.id===item.id&&equal(previous,item))),removed=a.filter(item=>!b.some(next=>next.id===item.id));
  changes.push(label+': '+[...changed.map(item=>compact(item.name||'item atualizado')),...removed.map(item=>compact(item.name||'item')+' removido')].slice(0,4).join(', '));
 }
 if(!equal(before.appearance,after.appearance))changes.push('Organização e aparência da ficha alteradas');
 if(!equal(before.dnd,after.dnd)||before.preset!==after.preset)changes.push('Configuração do sistema alterada');
 return changes.length?changes.slice(0,10).map(text=>text.slice(0,240)):['Ficha atualizada'];
}
function trim(state){
 for(const character of state.characters){const history=character.sheetHistory;if(!history)continue;history.entries=history.entries.slice(0,sheetHistoryLimits.entries);while(bytes(history)>sheetHistoryLimits.characterBytes&&history.entries.length){const snapshot=history.entries.findLast(entry=>entry.before);if(snapshot){delete snapshot.before;snapshot.unavailable='O limite de armazenamento removeu esta cópia.';}else history.entries.pop();}}
 let total=()=>state.characters.reduce((sum,c)=>sum+(c.sheetHistory?bytes(c.sheetHistory):0),0);
 while(total()>sheetHistoryLimits.campaignBytes){
  const histories=state.characters.filter(c=>c.sheetHistory?.entries.length),entries=histories.flatMap(c=>c.sheetHistory.entries.map(entry=>({entry,character:c}))).sort((a,b)=>a.entry.at-b.entry.at||a.entry.version-b.entry.version);
  const oldest=entries.find(item=>item.entry.before)||entries[0];if(!oldest)break;
  if(oldest.entry.before){delete oldest.entry.before;oldest.entry.unavailable='O limite de armazenamento da campanha removeu esta cópia.';}
  else oldest.character.sheetHistory.entries=oldest.character.sheetHistory.entries.filter(entry=>entry!==oldest.entry);
 }
}
function append(state,character,before,after,{action,actor,restoredFrom}={}){
 const next=version(character)+1,details=describe(before,after),entry={id:crypto.randomUUID(),version:next,at:Date.now(),actor:compact(actor||'Mestre'),action,summary:restoredFrom?'Versão anterior restaurada':details[0],details};
 if(restoredFrom)entry.restoredFrom=restoredFrom;
 if(bytes(before)<=sheetHistoryLimits.snapshotBytes)entry.before=before;
 else entry.unavailable='Esta ficha excede o limite de tamanho para guardar uma cópia restaurável.';
 character.sheetHistory={version:next,entries:[entry,...(character.sheetHistory?.entries||[])]};trim(state);return entry;
}
export function recordSheetChanges(state,captured,{action}={}){
 for(const capture of captured||[]){const character=state.characters.find(c=>c.id===capture.id);if(!character)continue;const after=snapshot(state,character);if(!equal(capture.before,after))append(state,character,capture.before,after,{action,actor:capture.actor});}
}
export function mutateSheetHistory(state,action,data={},access={}){
 if(action!=='sheetHistoryRestore')return false;
 const character=requireOwnCharacter(state,access,data.id);
 if(!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion!==version(character))fail(409,'A ficha mudou em outra aba. Atualize o histórico antes de restaurar.');
 const entry=character.sheetHistory?.entries?.find(entry=>entry.id===data.entryId);
 if(!entry)fail(404,'Alteração indisponível no histórico.');
 if(!entry.before)fail(409,entry.unavailable||'Esta alteração não possui cópia restaurável.');
 const before=snapshot(state,character),saved=entry.before;
 // Restore only sheet content. Access, portrait and other campaign references always remain current.
 const candidate={...character};
 for(const key of editable){if(Object.hasOwn(saved,key))candidate[key]=clone(saved[key]);else delete candidate[key];}
 candidate.layout=clone(saved.layout);candidate.values=clone(saved.values);delete candidate.fields;
 candidate.appearance={...validateSheetAppearance(sheetAppearance(state,candidate),state,candidate),version:(character.appearance?.version||0)+1};
 const after=snapshot(state,candidate);
 if(equal(before,after))fail(409,'A ficha já corresponde ao conteúdo anterior desta alteração.');
 for(const key of [...editable,'layout','values']){if(Object.hasOwn(candidate,key))character[key]=candidate[key];else delete character[key];}delete character.fields;
 append(state,character,before,after,{action,actor:access.master?'Mestre':character.name,restoredFrom:entry.id});
 return true;
}
