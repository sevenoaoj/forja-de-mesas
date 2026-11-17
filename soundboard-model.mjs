import {soundPresets} from './media.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const unique=items=>[...new Set(Array.isArray(items)?items.filter(id=>typeof id==='string'&&id.length<=100):[])];
export const soundboardActions=new Set(['soundboardSessionSave','soundboardSessionDelete','soundboardSessionSelect','soundboardPackToggle','soundboardPick','soundboardFavorite','soundboardSettings','soundboardStop','soundLoop']);
export function normalizeSoundboard(audio={}){
 const value=audio.soundboard||{};
 const sessions=(Array.isArray(value.sessions)?value.sessions:[]).slice(0,20).filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string').map(s=>({id:s.id,name:s.name.slice(0,100),packs:unique(s.packs),sounds:unique(s.sounds),favorites:unique(s.favorites)}));
 if(!sessions.length)sessions.push({id:'default',name:'Mesa principal',packs:['basic','uploads'],sounds:[],favorites:[]});
 const activeSessionId=sessions.some(s=>s.id===value.activeSessionId)?value.activeSessionId:sessions[0].id;
 return {sessions,activeSessionId,volume:typeof value.volume==='number'&&Number.isFinite(value.volume)?Math.max(0,Math.min(100,value.volume)):80,stopVersion:Number.isSafeInteger(value.stopVersion)?value.stopVersion:0,loops:Array.isArray(value.loops)?value.loops.slice(0,4):[]};
}
export function soundLibrary(audio={}){return [...soundPresets.map(s=>({...s,packId:'basic',category:'Essenciais',author:'Forja de Mesas',license:'Original',synthetic:true})),...(audio.clips||[]).map(c=>({...c,packId:c.packId||'uploads',category:c.category||'Meus arquivos'}))];}
export function sessionSounds(audio,sessionId){const sb=normalizeSoundboard(audio),session=sb.sessions.find(s=>s.id===(sessionId||sb.activeSessionId))||sb.sessions[0];return soundLibrary(audio).filter(s=>session.packs.includes(s.packId)||session.sounds.includes(s.id));}
export function soundboardView(audio,master,includeLibrary=true){const board=normalizeSoundboard(audio);return master&&includeLibrary?board:{volume:board.volume,stopVersion:board.stopVersion,loops:board.loops};}
export function mutateSoundboard(audio,action,data){
 if(!soundboardActions.has(action))return false;
 const sb=normalizeSoundboard(audio),session=sb.sessions.find(s=>s.id===(data.sessionId||sb.activeSessionId));
 if(!session)fail(404,'Sessão do soundboard indisponível.');
 const library=soundLibrary(audio),ids=new Set(library.map(s=>s.id));
 if(action==='soundboardSessionSave'){
  const name=typeof data.name==='string'?data.name.trim():'';if(!name||name.length>100)fail(400,'Use um nome de sessão de até 100 caracteres.');
  if(data.id){const existing=sb.sessions.find(s=>s.id===data.id);if(!existing)fail(404,'Sessão indisponível.');existing.name=name;}
  else{if(sb.sessions.length>=20)fail(409,'Use até 20 sessões do soundboard.');const id=crypto.randomUUID();sb.sessions.push({id,name,packs:[],sounds:[],favorites:[]});sb.activeSessionId=id;sb.loops=[];sb.stopVersion++;audio.cues=[];}
 }else if(action==='soundboardSessionDelete'){
  if(sb.sessions.length===1)fail(409,'Mantenha pelo menos uma sessão.');
  if(!sb.sessions.some(s=>s.id===data.id))fail(404,'Sessão indisponível.');
  sb.sessions=sb.sessions.filter(s=>s.id!==data.id);if(sb.activeSessionId===data.id){sb.activeSessionId=sb.sessions[0].id;sb.loops=[];sb.stopVersion++;audio.cues=[];}
 }else if(action==='soundboardSessionSelect'){
  if(!sb.sessions.some(s=>s.id===data.id))fail(404,'Sessão indisponível.');if(sb.activeSessionId!==data.id){sb.activeSessionId=data.id;sb.loops=[];sb.stopVersion++;audio.cues=[];}
 }else if(action==='soundboardPackToggle'){
  if(typeof data.enabled!=='boolean')fail(400,'Seleção inválida.');
  if(!['basic','uploads',...library.map(s=>s.packId)].includes(data.packId))fail(404,'Instale o pacote antes de ativá-lo.');
  session.packs=data.enabled?unique([...session.packs,data.packId]):session.packs.filter(id=>id!==data.packId);
 }else if(['soundboardPick','soundboardFavorite'].includes(action)){
  if(!ids.has(data.id)||typeof data.enabled!=='boolean')fail(400,'Som ou seleção inválidos.');
  const key=action==='soundboardPick'?'sounds':'favorites';session[key]=data.enabled?unique([...session[key],data.id]):session[key].filter(id=>id!==data.id);
 }else if(action==='soundboardSettings'){
  if(typeof data.volume!=='number'||!Number.isFinite(data.volume)||data.volume<0||data.volume>100)fail(400,'Use volume entre 0 e 100.');sb.volume=data.volume;
 }else if(action==='soundboardStop'){
  sb.stopVersion++;sb.loops=[];audio.cues=[];
 }else if(action==='soundLoop'){
  if(typeof data.enabled!=='boolean'||!ids.has(data.id))fail(400,'Som inválido.');
  if(data.enabled){
   if(!sessionSounds(audio).some(s=>s.id===data.id))fail(403,'Adicione este som à sessão ativa antes de tocar.');
   if(soundPresets.some(s=>s.id===data.id))fail(400,'A repetição é disponível para arquivos de áudio.');
   if(!sb.loops.some(c=>c.sound===data.id)){if(sb.loops.length>=4)fail(409,'Use até quatro efeitos em repetição ao mesmo tempo.');sb.loops.push({id:crypto.randomUUID(),sound:data.id,at:Date.now()+1200});}
  }else sb.loops=sb.loops.filter(c=>c.sound!==data.id);
 }
 const active=sb.sessions.find(s=>s.id===sb.activeSessionId),allowed=new Set(library.filter(s=>active.packs.includes(s.packId)||active.sounds.includes(s.id)).map(s=>s.id));
 sb.loops=sb.loops.filter(c=>allowed.has(c.sound));
 audio.soundboard=sb;return true;
}
export function removeSoundFromBoards(audio,id){const sb=normalizeSoundboard(audio);for(const s of sb.sessions){s.sounds=s.sounds.filter(x=>x!==id);s.favorites=s.favorites.filter(x=>x!==id);}sb.loops=sb.loops.filter(c=>c.sound!==id);audio.soundboard=sb;}
