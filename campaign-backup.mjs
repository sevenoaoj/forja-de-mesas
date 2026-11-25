import {validateExploration} from './exploration-model.mjs';
import {cinematicStyle,campaignParties,stressRegionsFor} from './model.mjs';
import {validateSessionLog} from './session-log.mjs';
import {itemPortraits} from './item-assets.mjs';
import {validConditionTimer} from './table-model.mjs';
import {sceneMaps,sceneTokenPortraits} from './scene-model.mjs';
import {validateMessages} from './chat-model.mjs';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const magic=encoder.encode('FORJA-BACKUP/1\n');
export const backupLimit=100_000_000;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const object=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const hash=async bytes=>new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const mime=new Set(['video/mp4','video/webm','application/pdf','image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4','audio/x-wav','audio/flac','audio/wave','audio/aac','audio/x-flac','audio/x-m4a']);
function validateState(state){
 if(!object(state)||typeof state.name!=='string'||!state.name.trim()||state.name.length>100)fail(400,'O backup não contém uma campanha válida.');
 validateSessionLog(state.sessionLog);
 validateMessages(state.messages);
 for(const key of ['characters','fields','tokens','books','rolls','initiative'])if(!Array.isArray(state[key]))fail(400,'Estrutura da campanha inválida: '+key+'.');
 if(state.characters.length>100||state.books.length>30)fail(400,'O backup excede os limites da campanha.');
 for(const key of ['characters','fields','tokens']){
  const ids=new Set();for(const item of state[key]){if(!object(item)||typeof item.id!=='string'||!item.id||ids.has(item.id))fail(400,'Itens inválidos ou duplicados no backup.');ids.add(item.id);}
 }
 for(const c of state.characters){if(typeof c.name!=='string'||!object(c.values))fail(400,'Ficha inválida no backup.');for(const key of ['layout','skills','abilities','rollButtons','masteries'])if(c[key]!==undefined&&!Array.isArray(c[key]))fail(400,'Estrutura de ficha inválida.');}
 if(state.parties!==undefined&&!Array.isArray(state.parties))fail(400,'Lista de grupos inválida no backup.');
 const partyIds=new Set();
 for(const group of campaignParties(state)){
  if(!group||!(['a','b'].includes(group.id)||uuid(group.id))||partyIds.has(group.id)||typeof group.name!=='string'||!group.name.trim()||group.name.length>80)fail(400,'Grupo inválido no backup.');
  partyIds.add(group.id);
 }
 for(const {party,partyRevealed,bodyStress} of state.characters){
  if(party!==undefined&&!partyIds.has(party)||partyRevealed!==undefined&&typeof partyRevealed!=='boolean')fail(400,'Grupo de personagem inválido no backup.');
  if(bodyStress===undefined)continue;
  if(typeof bodyStress?.enabled!=='boolean'||!object(bodyStress.regions))fail(400,'Estresse corporal inválido no backup.');
  if(bodyStress.mode!==undefined&&!['simple','complex'].includes(bodyStress.mode))fail(400,'Modo de segmentação inválido no backup.');
  for(const key of Object.keys(stressRegionsFor('complex'))){
   if(!Object.hasOwn(bodyStress.regions,key)){
    if(!Object.hasOwn(stressRegionsFor(bodyStress.mode),key))continue;
    if(bodyStress.mode===undefined&&key==='head')continue;
   }
   const part=bodyStress.regions[key];
   if(!Number.isInteger(part?.limit)||part.limit<1||part.limit>99||!Number.isInteger(part.value)||part.value<0||part.value>part.limit)fail(400,'Região corporal inválida no backup.');
  }
 }
 if(state.cinematicLibrary!==undefined&&(!Array.isArray(state.cinematicLibrary)||state.cinematicLibrary.length>60||state.cinematicLibrary.some(a=>!a||(!mime.has(a.type)||a.type==='application/pdf')||typeof a.name!=='string')))fail(400,'Biblioteca de cinemáticas inválida.');
 if(state.cinematicCues!==undefined){
  if(!Array.isArray(state.cinematicCues)||state.cinematicCues.length>60)fail(400,'Preparações de cinemática inválidas.');
  const ids=new Set();
  for(const cue of state.cinematicCues){
   if(!uuid(cue?.id)||ids.has(cue.id)||typeof cue.name!=='string'||!cue.name.trim()||cue.name.length>80||typeof cue.text!=='string'||cue.text.length>240||typeof cue.party!=='string'||typeof cue.mediaId!=='string'||cue.mediaId&&!state.cinematicLibrary?.some(a=>a.id===cue.mediaId&&!a.type.startsWith('audio/'))||!Number.isInteger(cue.intro)||cue.intro<0||cue.intro>30||!Number.isInteger(cue.duration)||cue.duration<1||cue.duration>600)fail(400,'Preparação de cinemática inválida.');
   if(cue.soundtrackId!==undefined&&(typeof cue.soundtrackId!=='string'||cue.soundtrackId&&!state.cinematicLibrary?.some(a=>a.id===cue.soundtrackId&&a.type.startsWith('audio/'))))fail(400,'Trilha da cinemática inválida.');
   cinematicStyle(cue);
   ids.add(cue.id);
  }
 }
 if(state.audio!==undefined&&(!object(state.audio)||!Array.isArray(state.audio.clips)||!Array.isArray(state.audio.cues)))fail(400,'Estrutura de áudio inválida.');
 if(state.inventory!==undefined&&!Array.isArray(state.inventory))fail(400,'Inventário inválido.');
 if(state.journal!==undefined&&!Array.isArray(state.journal))fail(400,'Diário inválido.');
 if(state.sheetTemplates!==undefined&&(!object(state.sheetTemplates)||!Array.isArray(state.sheetTemplates.items)))fail(400,'Modelos inválidos.');
 if(state.sceneLibrary!==undefined){const lib=state.sceneLibrary;if(!object(lib)||!Array.isArray(lib.scenes)||!Array.isArray(lib.sessions)||!lib.scenes.length||!lib.scenes.some(s=>s.id===lib.activeId))fail(400,'Organização das cenas inválida.');for(const scene of lib.scenes)if(!object(scene)||scene.tokens!==undefined&&!Array.isArray(scene.tokens))fail(400,'Cena inválida.');}
 const worlds=[state,...(state.sceneLibrary?.scenes||[])];
 const items=[...(state.inventory||[]),...worlds.flatMap(scene=>(scene.tokens||[]).filter(t=>t?.kind==='item').map(t=>t.loot?.item))];
 for(const item of items){
  if(item?.usesPerUnit===undefined&&item?.uses===undefined)continue;
  const capacity=item.usesPerUnit,quantity=item.quantity??1;
  if(item.kind!=='consumable'||!Number.isInteger(capacity)||capacity<1||capacity>9999||!Number.isInteger(quantity)||quantity<0||!Number.isInteger(item.uses)||item.uses<0||item.uses>quantity*capacity)fail(400,'Barra de usos inválida no backup.');
 }
 validateExploration(state);
 for(const scene of [state,...(state.sceneLibrary?.scenes||[])]){
  for(const token of scene.tokens||[]){
   const saved=token?.conditionSchedule;if(saved===undefined)continue;
   if(!Array.isArray(saved)||saved.length>24||!saved.every(validConditionTimer))fail(400,'Duração de condição inválida no backup.');
  }
 }
 // Data is consumed by existing editors: reject prototype keys and excessive nesting.
 let nodes=0;function walk(value,depth=0){if(++nodes>500000||depth>50)fail(400,'Estrutura do backup excessivamente complexa.');if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))fail(400,'O backup contém uma chave não permitida.');walk(child,depth+1);}}
 walk(state);
 const limit=state.sceneLibrary?8_000_000:1_500_000;
 if(encoder.encode(JSON.stringify(state)).length>limit)fail(413,'A campanha do backup excede o limite de armazenamento.');

}
export function backupAssets(state){
 const items=[...(state.cinematicLibrary||[]),...itemPortraits(state),...sceneMaps(state),...sceneTokenPortraits(state),...state.books,...(state.audio?.clips||[]),...state.characters.flatMap(c=>[c.portrait,c.injury?.image])].filter(Boolean),byId=new Map();
 let total=0;
 for(const item of items){if(!uuid(item.id)||!mime.has(item.type)||!Number.isSafeInteger(item.size)||item.size<=0||item.size>40*1024*1024)fail(400,'Referência de arquivo inválida no backup.');const old=byId.get(item.id);if(old&&(old.size!==item.size||old.type!==item.type))fail(400,'Referências de arquivo conflitantes.');if(!old){byId.set(item.id,{id:item.id,type:item.type,size:item.size});total+=item.size;}}
 if(total>90_000_000||byId.size>1200)fail(413,'O backup suporta até 90 MB de arquivos por campanha.');return [...byId.values()];
}
function portableState(source){
 const state=structuredClone(source);state.members=[];delete state.cinematicRun;delete state.checkRequests;delete state.materialShares;delete state.investigationReceipts;
 if(state.messages!==undefined)state.messages=[];
 if(state.table?.lootEvents)state.table.lootEvents=[];for(const scene of state.sceneLibrary?.scenes||[])if(scene.table?.lootEvents)scene.table.lootEvents=[];
 for(const c of state.characters)delete c.ownerId;
 for(const item of state.sheetTemplates?.items||[])item.owner='gm';
 if(state.audio){state.audio.track=null;state.audio.cues=[];if(state.audio.soundboard)state.audio.soundboard.loops=[];}
 return state;
}
export function exportCampaignBackup(row,store){
 const state=portableState(row.state);validateState(state);const assets=backupAssets(state);
 const header=encoder.encode(JSON.stringify({format:'forja-campaign-backup',version:1,createdAt:new Date().toISOString(),state,assets}));
 async function* chunks(){
  yield magic;yield encoder.encode(String(header.length).padStart(8,'0')+'\n');yield header;yield await hash(header);
  for(const asset of assets){const body=await store.getAsset(row.id+'/'+asset.id);if(!body)fail(409,'Um arquivo da campanha está ausente. Confira os uploads antes de salvar o backup.');const bytes=new Uint8Array(await new Response(body).arrayBuffer());if(bytes.length!==asset.size)fail(409,'Um arquivo mudou durante o backup. Tente novamente.');yield bytes;yield await hash(bytes);}
 }
 const iterator=chunks();return new Response(new ReadableStream({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value);}catch(error){controller.error(error);}},cancel(){return iterator.return();}}),{headers:{'Content-Type':'application/octet-stream','Content-Length':String(magic.length+9+header.length+32+assets.reduce((size,asset)=>size+asset.size+32,0)),'Content-Disposition':'attachment; filename="campanha-'+row.id+'.forja"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
async function boundedReader(request){
 if(Number(request.headers.get('Content-Length'))>backupLimit)fail(413,'Use um backup de até 100 MB.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Selecione o arquivo de backup.');let pending=new Uint8Array(),total=0;
 return {async take(size){const output=new Uint8Array(size);let offset=0;while(offset<size){if(!pending.length){const next=await reader.read();if(next.done)fail(400,'Backup incompleto ou corrompido. Baixe uma nova cópia.');total+=next.value.length;if(total>backupLimit)fail(413,'Use um backup de até 100 MB.');pending=next.value;}const count=Math.min(size-offset,pending.length);output.set(pending.subarray(0,count),offset);pending=pending.subarray(count);offset+=count;}return output;},async end(){if(pending.length||!(await reader.read()).done)fail(400,'O backup contém dados extras inesperados.');},async cancel(){await reader.cancel().catch(()=>{});}};
}
export async function importCampaignBackup(request,store,{makeRow,validate=()=>{}}){
 const reader=await boundedReader(request);let row;const written=[];
 try{
  if(!same(await reader.take(magic.length),magic))fail(400,'Selecione um backup .forja da campanha; o arquivo de acesso não é um backup.');
  const lengthText=decoder.decode(await reader.take(9));if(!/^\d{8}\n$/.test(lengthText))fail(400,'Cabeçalho do backup inválido.');const length=Number(lengthText);if(length<2||length>8_100_000)fail(413,'Cabeçalho do backup excede o limite.');
  const bytes=await reader.take(length),checksum=await reader.take(32);if(!same(await hash(bytes),checksum))fail(400,'O conteúdo do backup está corrompido.');
  let bundle;try{bundle=JSON.parse(decoder.decode(bytes));}catch{fail(400,'O conteúdo do backup não é válido.');}
  if(bundle?.format!=='forja-campaign-backup'||bundle.version!==1)fail(400,'Versão de backup não suportada.');
  validateState(bundle.state);const state=portableState(bundle.state),expected=backupAssets(state);
  if(!Array.isArray(bundle.assets)||JSON.stringify(bundle.assets)!==JSON.stringify(expected))fail(400,'A lista de arquivos não corresponde à campanha.');
  row=makeRow(state);try{validate(row);}catch{fail(400,'Não foi possível interpretar a campanha deste backup.');}
  for(const asset of expected){const bytes=await reader.take(asset.size),checksum=await reader.take(32);if(!same(await hash(bytes),checksum))fail(400,'Um arquivo do backup está corrompido.');const key=row.id+'/'+asset.id;written.push(key);await store.putAsset(key,new Blob([bytes],{type:asset.type}));}
  await reader.end();await store.create(row);return row;
 }catch(error){await Promise.allSettled(written.map(key=>store.deleteAsset(key)));throw error;}
 finally{await reader.cancel();}
}
