import {normalizeTable} from './table-model.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const name=value=>{const result=clean(value,100);if(!result)fail(400,'Informe um nome.');return result;};
export const sceneActions=new Set(['sessionMaterial','sessionMaterialMove','sceneCreate','sceneUpdate','sceneDuplicate','sceneDelete','sceneActivate','sceneMove','sessionCreate','sessionUpdate','sessionDelete']);
export function sceneLibrary(state){
 return state.sceneLibrary||{version:0,activeId:'scene-initial',sessions:[{id:'session-initial',name:'Sessão 1',date:'',notes:''}],scenes:[{id:'scene-initial',name:state.scene||'Primeira cena',sessionId:'session-initial',notes:''}]};
}
function ensure(state){return state.sceneLibrary??=structuredClone(sceneLibrary(state));}
export const activeSceneId=state=>sceneLibrary(state).activeId;
function record(state,id){return sceneLibrary(state).scenes.find(scene=>scene.id===(id||activeSceneId(state)));}
function world(state,scene){return scene.id===activeSceneId(state)?{map:state.map||null,tokens:state.tokens||[],table:state.table}: {map:scene.map||null,tokens:scene.tokens||[],table:scene.table};}
export function sceneProjection(state,id){
 const lib=sceneLibrary(state),scene=record(state,id)||record(state,lib.activeId),session=lib.sessions.find(item=>item.id===scene.sessionId);
 return {...state,...world(state,scene),scene:scene.id===lib.activeId?state.scene||scene.name:scene.name,sceneId:scene.id,activeSceneId:lib.activeId,sessionName:session?.name||'Sem sessão'};
}
export function sceneSummary(state){
 const lib=sceneLibrary(state);
 return {version:lib.version||0,activeId:lib.activeId,sessions:lib.sessions,scenes:lib.scenes.map(scene=>{
  const content=world(state,scene);return {id:scene.id,name:scene.id===lib.activeId?state.scene||scene.name:scene.name,sessionId:scene.sessionId,notes:scene.notes||'',map:content.map,tokenCount:content.tokens.length};
 })};
}
export function sceneMaps(state){return [...new Map([state.map,...(state.sceneLibrary?.scenes||[]).map(scene=>scene.map)].filter(Boolean).map(asset=>[asset.id,asset])).values()];}
export function sceneTokenPortraits(state){return [...new Map([...(state.tokens||[]),...(state.sceneLibrary?.scenes||[]).flatMap(scene=>scene.tokens||[])].flatMap(token=>[token?.portrait,...(Array.isArray(token?.portraits)?token.portraits:[])]).filter(Boolean).map(asset=>[asset.id,asset])).values()];}
export function removeSessionMaterial(state,kind,id){
 const library=state.sceneLibrary;
 if(!library)return;
 let changed=false;
 for(const session of library.sessions){
  const links=session.materials;
  if(!links?.some(ref=>ref.kind===kind&&ref.id===id))continue;
  session.materials=links.filter(ref=>ref.kind!==kind||ref.id!==id);
  changed=true;
 }
 if(changed)library.version++;
}
export function withScene(state,id,master,operation){
 const active=activeSceneId(state);if(!id||id===active)return operation(state);
 if(!master)fail(409,'A cena mudou. Aguarde a sincronização antes de agir.');
 const scene=record(state,id);if(!scene)fail(404,'Cena indisponível.');
 const scoped={...state,...world(state,scene),scene:scene.name};
 const result=operation(scoped);scene.map=scoped.map||null;scene.tokens=scoped.tokens||[];scene.table=scoped.table;return result;
}
function requireScene(lib,id){const scene=lib.scenes.find(item=>item.id===id);if(!scene)fail(404,'Cena indisponível.');return scene;}
function requireSession(lib,id){const session=lib.sessions.find(item=>item.id===id);if(!session)fail(400,'Sessão indisponível.');return session;}
function sessionDate(value){const date=clean(value,10);if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'Data inválida.');if(date){const parsed=new Date(date+'T12:00:00Z');if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==date)fail(400,'Data inválida.');}return date;}
export function mutateScenes(state,action,data,master){
 if(!sceneActions.has(action))return false;if(!master)fail(403,'Somente o mestre organiza cenas e sessões.');
 const lib=ensure(state);
 if(data.expectedVersion!==undefined&&data.expectedVersion!==(lib.version||0))fail(409,'A organização mudou em outra aba. Atualize antes de salvar.');
 if(action==='sessionMaterial'){
  const session=requireSession(lib,data.sessionId);
  const documents={note:state.journal,character:state.characters,item:state.inventory};
  if(!Object.hasOwn(documents,data.kind)||typeof data.attached!=='boolean')fail(400,'Material inválido.');
  const links=session.materials||[],matches=ref=>ref.kind===data.kind&&ref.id===data.id;
  if(data.attached){
   if(!documents[data.kind]?.some(e=>e.id===data.id&&(data.kind!=='item'||!e.characterId)))fail(404,'Material indisponível.');
   if(!links.some(matches)){
    if(links.length>=400)fail(409,'O roteiro comporta até 400 materiais.');
    session.materials=[...links,{kind:data.kind,id:data.id}];
   }
  }else session.materials=links.filter(ref=>!matches(ref));
 }else if(action==='sessionMaterialMove'){
  const session=requireSession(lib,data.sessionId),materials=session.materials||[];
  if(![-1,1].includes(data.direction))fail(400,'Direção inválida.');
  const index=materials.findIndex(ref=>ref.kind===data.kind&&ref.id===data.id);
  if(index<0)fail(404,'Material indisponível no roteiro.');
  const next=index+data.direction;
  if(next<0||next>=materials.length)fail(409,'O material já está no limite do roteiro.');
  [materials[index],materials[next]]=[materials[next],materials[index]];
 }else if(action==='sessionCreate'){
  if(lib.sessions.length>=40)fail(409,'Use até 40 sessões por campanha.');
  lib.sessions.push({id:crypto.randomUUID(),name:name(data.name),date:sessionDate(data.date),notes:clean(data.notes,2000)});
 }else if(action==='sessionUpdate'){
  const session=requireSession(lib,data.id);session.name=name(data.name);session.date=sessionDate(data.date);session.notes=clean(data.notes,2000);
 }else if(action==='sessionDelete'){
  requireSession(lib,data.id);if(lib.sessions.length<=1)fail(409,'Mantenha pelo menos uma sessão.');if(lib.scenes.some(scene=>scene.sessionId===data.id))fail(409,'Mova as cenas para outra sessão antes de apagar esta.');lib.sessions=lib.sessions.filter(item=>item.id!==data.id);
 }else if(action==='sceneCreate'||action==='sceneDuplicate'){
  if(lib.scenes.length>=60)fail(409,'Use até 60 cenas por campanha.');
  const source=action==='sceneDuplicate'?requireScene(lib,data.id):null;
  const sessionId=data.sessionId||source?.sessionId||record(state,lib.activeId).sessionId;requireSession(lib,sessionId);
  let content={map:null,tokens:[],table:normalizeTable({})};
  if(source){content=structuredClone(world(state,source));if(content.table){content.table.pings=[];if(content.table.fog)content.table.fog.history=[];}}
  lib.scenes.push({id:crypto.randomUUID(),name:name(data.name||(source?source.name+' · cópia':'')),sessionId,notes:source?.notes||clean(data.notes,2000),...content});
 }else if(action==='sceneUpdate'){
  const scene=requireScene(lib,data.id);scene.name=name(data.name);if(data.sessionId!==undefined){requireSession(lib,data.sessionId);scene.sessionId=data.sessionId;}if(data.notes!==undefined)scene.notes=clean(data.notes,2000);if(scene.id===lib.activeId)state.scene=scene.name;
 }else if(action==='sceneMove'){
  const scene=requireScene(lib,data.id);if(data.sessionId!==undefined){requireSession(lib,data.sessionId);scene.sessionId=data.sessionId;}
  if(data.direction!==undefined){if(![-1,1].includes(data.direction))fail(400,'Direção inválida.');const same=lib.scenes.filter(item=>item.sessionId===scene.sessionId),at=same.indexOf(scene),target=same[at+data.direction];if(target){const a=lib.scenes.indexOf(scene),b=lib.scenes.indexOf(target);[lib.scenes[a],lib.scenes[b]]=[lib.scenes[b],lib.scenes[a]];}}
 }else if(action==='sceneActivate'){
  const target=requireScene(lib,data.id);if(target.id!==lib.activeId){
   for(const p of state.table?.exploration||[]){delete p.travelRequest;delete p.travelQuietUntil;}
   const previous=requireScene(lib,lib.activeId),content=world(state,target);previous.name=state.scene||previous.name;Object.assign(previous,{map:state.map||null,tokens:state.tokens||[],table:state.table});
   state.map=content.map;state.tokens=content.tokens;state.table=content.table;state.scene=target.name;lib.activeId=target.id;
   delete target.map;delete target.tokens;delete target.table;
   if(state.table){state.table.pings=[];state.table.lootEvents=[];}
  }
 }else if(action==='sceneDelete'){
  requireScene(lib,data.id);if(data.id===lib.activeId)fail(409,'Mostre outra cena aos jogadores antes de apagar esta.');lib.scenes=lib.scenes.filter(item=>item.id!==data.id);
 }
 lib.version=(lib.version||0)+1;return true;
}
