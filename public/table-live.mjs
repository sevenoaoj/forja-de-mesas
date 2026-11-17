// Authenticated SSE: credentials stay in headers, never in invitation/query URLs.
export function createEventDecoder(receive){
 let buffer='',data=[],dataLength=0;
 function line(value){
  if(value===''){const payload=data;data=[];dataLength=0;if(payload.length){let event;try{event=JSON.parse(payload.join('\n'));}catch{return;}receive(event);}return;}
  if(value.startsWith(':'))return;
  const at=value.indexOf(':'),field=at<0?value:value.slice(0,at);let content=at<0?'':value.slice(at+1);if(content.startsWith(' '))content=content.slice(1);
  if(field==='data'){dataLength+=content.length+1;if(dataLength>12000000)throw new Error('Evento da mesa excedeu o limite.');data.push(content);}
 }
 return chunk=>{buffer+=chunk;if(buffer.length+dataLength>12000000)throw new Error('Evento da mesa excedeu o limite.');
  let at;while((at=buffer.search(/[\r\n]/))>=0){if(buffer[at]==='\r'&&at===buffer.length-1)break;const length=buffer[at]==='\r'&&buffer[at+1]==='\n'?2:1;line(buffer.slice(0,at));buffer=buffer.slice(at+length);}
 };
}

export function createTableLive({request,onEvent,onStatus=()=>{},setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout,now=()=>Date.now(),interval=50}={}){
 let access=null,identity='',generation=0,streamController,reader,retryTimer,watchdog,sendTimer,posting=false,pending=new Map(),postController,lastSent=0,retries=0,status='offline';
 let previewFrame=null;const incoming=new Map();
 function drainPreviews(){const events=[...incoming.values()];incoming.clear();for(const event of events)onEvent(event);}
 function deliver(event){
  if(event.type!=='tokenPreview'){drainPreviews();onEvent(event);return;}
  const old=incoming.get(event.id);if(old&&old.dragId===event.dragId&&old.seq>=event.seq)return;
  incoming.set(event.id,event);
  if(previewFrame!==null)return;
  const version=generation;previewFrame=true;
  const paint=()=>{if(version!==generation)return;previewFrame=null;drainPreviews();};
  if(typeof globalThis.requestAnimationFrame==='function')previewFrame=globalThis.requestAnimationFrame(paint);else queueMicrotask(paint);
 }
 function setStatus(value){if(value!==status){status=value;onStatus(value);}}
 function stopIO(){clearTimer(retryTimer);clearTimer(watchdog);clearTimer(sendTimer);retryTimer=watchdog=sendTimer=undefined;streamController?.abort();reader?.cancel().catch(()=>{});reader=null;postController?.abort();pending.clear();incoming.clear();if(previewFrame!==null)globalThis.cancelAnimationFrame?.(previewFrame);previewFrame=null;posting=false;}
 function disconnect(){generation++;identity='';access=null;stopIO();setStatus('offline');}
 function connect(next){
  if(!next){disconnect();return;}const key=next.id+'/'+next.key+'/'+(next.sceneId||'');if(key===identity)return;
  disconnect();access=next;identity=key;retries=0;open(generation);
 }
 function keepAlive(controller,delay=35000){clearTimer(watchdog);watchdog=setTimer(()=>controller.abort(),delay);}
 async function open(version){
  if(version!==generation||!access)return;const captured=access,controller=new AbortController();streamController=controller;
  setStatus(retries?'reconnecting':'connecting');keepAlive(controller,8000);let unsupported=false,forbidden=false,connectedAt;
  try{
   const response=await request('/'+captured.id+'/events',{signal:controller.signal,headers:{Accept:'text/event-stream'}},captured);
   if(version!==generation)return;
   if(!response.body?.getReader||!response.headers.get('content-type')?.includes('text/event-stream')){unsupported=true;throw new Error('Streaming indisponível.');}
   setStatus('live');connectedAt=now();keepAlive(controller);
   const decoder=new TextDecoder(),decode=createEventDecoder(event=>{if(version===generation)deliver(event);});
   const localReader=response.body.getReader();reader=localReader;
   try{while(version===generation){const {value,done}=await localReader.read();if(done)break;keepAlive(controller);decode(decoder.decode(value,{stream:true}));}}finally{localReader.releaseLock();if(reader===localReader)reader=null;}
  }catch(error){unsupported||=[404,405,501,503].includes(error.status);forbidden=[401,403].includes(error.status);}
  finally{
   controller.abort();
   if(version!==generation)return;clearTimer(watchdog);watchdog=undefined;
   if(forbidden){setStatus('offline');return;}
   // A 200 response alone is not a stable connection: immediate stream drops
   // must retain their backoff rather than reconnecting every 500 ms forever.
   if(connectedAt!==undefined&&now()-connectedAt>=10000)retries=0;
   setStatus(unsupported?'polling':'reconnecting');retries++;const delay=unsupported?30000:Math.min(10000,500*2**Math.min(retries-1,5));
   retryTimer=setTimer(()=>open(version),delay);
  }
 }
 async function flush(version){
  sendTimer=undefined;if(posting||!pending.size||version!==generation||!access)return;
  const entry=[...pending].find(([,event])=>event.phase!=='move')||pending.entries().next().value;const [key,event]=entry;pending.delete(key);posting=true;lastSent=now();const captured=access,controller=new AbortController();postController=controller;const timeout=setTimer(()=>controller.abort(),2000);
  try{await request('/'+captured.id+'/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),signal:controller.signal},captured);}catch{/* Final placement uses the persisted action; stale previews expire server-side. */}
  finally{clearTimer(timeout);if(version!==generation)return;posting=false;postController=null;schedule();}
 }
 function schedule(){if(posting||!pending.size||sendTimer!==undefined)return;const wait=[...pending.values()].every(event=>event.phase==='move')?Math.max(0,interval-(now()-lastSent)):0;sendTimer=setTimer(()=>flush(generation),wait);}
 function send(event){
  if(!access||status!=='live'||event?.type!=='tokenPreview')return;
  const key=event.id+'/'+event.dragId,old=pending.get(key);
  if(old&&(old.seq>=event.seq||old.phase!=='move'&&event.phase==='move'))return;
  if(!old&&pending.size>=64){const discard=[...pending].find(([,value])=>value.phase==='move');if(!discard)return;pending.delete(discard[0]);}
  pending.set(key,{...event});
  if(event.phase!=='move'&&sendTimer!==undefined){clearTimer(sendTimer);sendTimer=undefined;}schedule();
 }
 return {connect,disconnect,send,reconnect(){if(access){const target=access;disconnect();connect(target);}},get connected(){return status==='live';},get status(){return status;}};
}
