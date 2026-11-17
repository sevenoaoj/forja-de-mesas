import {renderSheetHistory,renderSheetHistoryRestore} from './sheet-history.mjs';

// Resolve permissions again at the moment of each interaction. A dialog can
// remain open while the master releases or hides a character in another tab.
export function createSheetHistoryController({current,character,modal,action,ui}={}){
 function fullCharacter(id){
  const row=current(),target=id||character()?.id;
  const found=row.state.characters.find(entry=>entry.id===target);
  if(!found||found.access==='summary'||!row.master&&row.characterId!==found.id)throw new Error('Você não tem acesso completo a esta ficha.');
  return found;
 }
 return {
  handlers:{
   sheetHistory(id){const sheet=fullCharacter(id);modal('Histórico de '+ui().esc(sheet.name),renderSheetHistory(sheet,{open:true}));},
   sheetHistoryRestore(id,node){const sheet=fullCharacter(id);modal('Restaurar ficha',renderSheetHistoryRestore(sheet,node?.dataset?.entry));}
  },
  forms:{
   async sheetHistoryRestore(data){
    const sheet=fullCharacter(data.id),expectedVersion=Number(data.expectedVersion);
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('Versão inválida. Abra novamente o histórico da ficha.');
    if(!sheet.sheetHistory?.entries?.some(entry=>entry.id===data.entryId&&entry.before))throw new Error('Cópia indisponível para restauração. Abra novamente o histórico.');
    return action('sheetHistoryRestore',{id:sheet.id,entryId:data.entryId,expectedVersion});
   }
  }
 };
}
