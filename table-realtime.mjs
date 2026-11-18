import {activeSceneId,sceneLibrary} from './scene-model.mjs';
import {ownedCharacter,accessFor,authorizeAction} from './access.mjs';
import {playerSight,normalizeTable,normalizeToken,tokenVisible} from './table-model.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const encoder=new TextEncoder();
const sceneKey=row=>JSON.stringify([activeSceneId(row.state),row.state.map?.id,normalizeTable(row.state).grid]);
const validId=value=>typeof value==='string'&&/^[\w:-]{1,80}$/.test(value);
// Process-local live scene channel. Persistent state always comes from the campaign store.
export function createTableRealtime({sceneView,now=Date.now,setTimer=setInterval,clearTimer=clearInterval,previewTTL=1800,maxConnections=500}={}){
 const rooms=new Map();let timer;
 function roomFor(id){let room=rooms.get(id);if(!room){room={id,clients:new Set(),previews:new Map(),commits:[],retired:new Map(),rates:new Map(),row:null};rooms.set(id,room);}return room;}
 function release(room){if(!room.clients.size&&!room.previews.size){rooms.delete(room.id);if(!rooms.size&&timer){clearTimer(timer);timer=undefined;}}}
 function close(client){if(client.closed)return;client.closed=true;client.signal?.removeEventListener('abort',client.abort);client.room.clients.delete(client);try{client.controller.close();}catch{}release(client.room);}
 function encode(data){return encoder.encode('data: '+JSON.stringify(data)+'\n\n');}
 function sendBytes(client,bytes){if(client.closed)return;try{if(client.controller.desiredSize<0){close(client);return;}client.controller.enqueue(bytes);}catch{close(client);}}
 function send(client,data){sendBytes(client,encode(data));}
 function cancelPreview(room,preview){for(const client of room.clients)if(client.seen.delete(preview.id))send(client,{type:'tokenPreview',id:preview.id,dragId:preview.dragId,seq:preview.seq+1,phase:'cancel',at:now()});}
 function allowed(room,preview){
  const access=accessFor(room.row,preview.key);if(!access||preview.sceneId&&preview.sceneId!==activeSceneId(room.row.state))return false;
  try{authorizeAction(room.row.state,access,'tokenMove',{id:preview.id});}catch{return false;}
  const table=normalizeTable(room.row.state),token=room.row.state.tokens.find(token=>token.id===preview.id);
  return Boolean(token&&(access.master||!token.locked&&tokenVisible(normalizeToken(token,table.grid),table)));
 }
 function distribute(room,preview){
  const table=normalizeTable(room.row.state),raw=room.row.state.tokens.find(token=>token.id===preview.id);
  if(!raw)return;
  const token=normalizeToken({...raw,x:preview.x,y:preview.y},table.grid);
  const {key,expires,...event}=preview,bytes=encode(event),visible=tokenVisible(normalizeToken(raw,table.grid),table)&&tokenVisible(token,table);
  for(const client of room.clients){
   const access=accessFor(room.row,client.key);if(!access){close(client);continue;}
   const viewing=access.master&&sceneLibrary(room.row.state).scenes.some(scene=>scene.id===client.sceneId)?client.sceneId:activeSceneId(room.row.state);
   const sees=access.master?null:playerSight(room.row.state,table,ownedCharacter(room.row.state,access)?.id);
   if(viewing===activeSceneId(room.row.state)&&(access.master||visible&&sees(raw)&&sees(token))){
    client.seen.add(preview.id);sendBytes(client,bytes);
   }else if(client.seen.delete(preview.id))send(client,{type:'tokenPreview',id:preview.id,dragId:preview.dragId,seq:preview.seq,phase:'cancel',at:now()});
  }
 }
 function tick(){
  for(const room of rooms.values()){
   for(const [id,preview] of room.previews)if(preview.expires<=now()||!allowed(room,preview)){cancelPreview(room,preview);room.previews.delete(id);room.retired.set(preview.dragId,now()+5000);}
   for(const [id,until] of room.retired)if(until<=now())room.retired.delete(id);
   for(const [id,rate] of room.rates)if(rate.until+5000<=now())room.rates.delete(id);
   if(now()-(room.heartbeat||0)>10000){room.heartbeat=now();for(const client of room.clients)send(client,{type:'heartbeat',at:now()});}
   release(room);
  }
 }
 function ensureTimer(){if(rooms.size&&timer===undefined){timer=setTimer(tick,250);timer?.unref?.();}}
 function publish(row){
  const room=rooms.get(row.id);if(!room)return;
  if(room.row&&room.row.rev>row.rev){if(!room.commits.length)return;row=room.row;}
  if(room.row&&sceneKey(room.row)!==sceneKey(row)){for(const preview of room.previews.values()){cancelPreview(room,preview);room.retired.set(preview.dragId,now()+5000);}room.previews.clear();}
  room.row=row;
  for(const [id,preview] of room.previews)if(!allowed(room,preview)){cancelPreview(room,preview);room.previews.delete(id);room.retired.set(preview.dragId,now()+5000);}
  // Tabs sharing credentials and scene receive exactly the same projection.
  const snapshots=new Map();
  for(const client of room.clients){
   const access=accessFor(row,client.key);if(!access){close(client);continue;}
   const identity=JSON.stringify([client.key,client.sceneId]);
   if(!snapshots.has(identity))snapshots.set(identity,encode(sceneView(row,access,client.sceneId)));
   sendBytes(client,snapshots.get(identity));
  }
  // A released preview restores the client's canonical position. Deliver the new
  // snapshot first, including when a drag returns to its original coordinates.
  for(const preview of room.commits)cancelPreview(room,preview);room.commits=[];
  // Reapply transient positions after a persistent scene update (e.g. another token finishes).
  for(const preview of room.previews.values())distribute(room,preview);
 }
 return {
  connect(row,key,signal,sceneId){
   if(!accessFor(row,key))fail(403,'Acesso indisponível.');
   if([...rooms.values()].reduce((sum,room)=>sum+room.clients.size,0)>=maxConnections)fail(429,'Limite de conexões ao vivo atingido.');
   const room=roomFor(row.id);if([...room.clients].filter(client=>client.key===key).length>=4)fail(429,'Feche outras abas da mesa para conectar.');
   if(!room.row||room.row.rev<=row.rev)room.row=row;row=room.row;if(!accessFor(row,key))fail(403,'Acesso indisponível.');let client;
   const body=new ReadableStream({start(controller){
    client={controller,key,room,signal,sceneId:accessFor(row,key)?.master?sceneId:undefined,seen:new Set(),closed:false};client.abort=()=>close(client);room.clients.add(client);signal?.addEventListener('abort',client.abort,{once:true});
    if(signal?.aborted){close(client);return;}
    send(client,{type:'ready',id:row.id,serverTime:now()});send(client,sceneView(row,accessFor(row,key),client.sceneId));
    for(const preview of room.previews.values())if(preview.expires>now())distribute(room,preview);
   },cancel(){close(client);}},{highWaterMark:12_000_000,size:chunk=>chunk.byteLength});
   ensureTimer();return new Response(body,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no','Connection':'keep-alive'}});
  },
  preview(row,access,data){
   const key=access.master?row.owner:row.state.members.find(member=>member.id===access.memberId)?.key;
   let room=rooms.get(row.id);if(room?.row&&room.row.rev>row.rev){row=room.row;access=accessFor(row,key);if(!access)fail(403,'Acesso indisponível.');}
   if(!data||data.type!=='tokenPreview'||!validId(data.id)||!validId(data.dragId)||!Number.isSafeInteger(data.seq)||data.seq<0||!['move','end','cancel'].includes(data.phase))fail(400,'Prévia inválida.');
   if(data.sceneId&&data.sceneId!==activeSceneId(row.state))fail(409,'A cena mudou. Aguarde a sincronização.');
   authorizeAction(row.state,access,'tokenMove',data);
   const table=normalizeTable(row.state),raw=row.state.tokens.find(token=>token.id===data.id);if(!raw)fail(404,'Token indisponível.');
   const token=normalizeToken(raw,table.grid);if(!access.master&&(token.locked||!tokenVisible(token,table)))fail(403,'Token indisponível.');
   if(data.phase!=='cancel'&&(!Number.isFinite(data.x)||!Number.isFinite(data.y)||data.x<0||data.y<0||data.x>table.grid.columns-token.size||data.y>table.grid.rows-token.size))fail(400,'Posição de prévia inválida.');
   if(data.rotation!==undefined&&(!Number.isFinite(data.rotation)||data.rotation<0||data.rotation>=360))fail(400,'Rotação de prévia inválida.');
   room??=roomFor(row.id);if(!room.row||room.row.rev<=row.rev)room.row=row;
   const actor=access.master?'master':access.memberId,rate=room.rates.get(actor)||{count:0,until:now()+1000};if(now()>rate.until){rate.count=0;rate.until=now()+1000;}room.rates.set(actor,rate);
   if(++rate.count>40&&data.phase==='move')return;
   if(room.retired.has(data.dragId))return;
   const previous=room.previews.get(data.id);if(previous&&previous.dragId===data.dragId&&previous.seq>=data.seq)return;
   if(previous&&previous.dragId!==data.dragId){cancelPreview(room,previous);room.retired.set(previous.dragId,now()+5000);}
   if(data.phase==='cancel'){if(previous){cancelPreview(room,previous);room.previews.delete(data.id);}room.retired.set(data.dragId,now()+5000);release(room);return;}
   // Look up the bearer internally; it is never serialized to recipients.
   const preview={type:'tokenPreview',id:data.id,x:data.x,y:data.y,...(data.rotation!==undefined?{rotation:data.rotation}:{}),dragId:data.dragId,seq:data.seq,phase:data.phase,at:now(),sceneId:activeSceneId(row.state),key,expires:now()+previewTTL};
   room.previews.set(data.id,preview);distribute(room,preview);ensureTimer();
  },publish,
  commitToken(row,id,dragId,rotationOnly=false){const room=rooms.get(row.id);if(!room)return;const preview=room.previews.get(id);if(rotationOnly){if(!validId(dragId))return;if(preview&&preview.dragId!==dragId){room.retired.set(dragId,now()+5000);return;}}if(preview){room.commits.push(preview);room.previews.delete(id);room.retired.set(preview.dragId,now()+5000);}if(validId(dragId))room.retired.set(dragId,now()+5000);},
  closeCampaign(id){const room=rooms.get(id);if(!room)return;room.previews.clear();for(const client of [...room.clients]){send(client,{type:'closed',id});close(client);}rooms.delete(id);if(!rooms.size&&timer){clearTimer(timer);timer=undefined;}},
  dispose(){for(const id of [...rooms.keys()])this.closeCampaign(id);},
  get connectionCount(){return [...rooms.values()].reduce((sum,room)=>sum+room.clients.size,0);},
  tick
 };
}
