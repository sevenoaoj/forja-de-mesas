import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventDecoder,createTableLive} from '../public/table-live.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function scheduler(){let now=1000,index=0;const timers=new Map();return {now:()=>now,setTimer(fn,ms){const id=++index;timers.set(id,{fn,at:now+ms});return id;},clearTimer(id){timers.delete(id);},get size(){return timers.size;},async advance(ms){const end=now+ms;for(let guard=0;guard<100;guard++){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await settle();}now=end;await settle();}};}
function fixture({unsupported=false,slowPost=false}={}){
 const events=[],statuses=[],calls=[],clock=scheduler();let source,resolvePost;
 const request=async(path,options,access)=>{calls.push({path,options,access});if(path.endsWith('/preview')){if(slowPost)await new Promise(resolve=>resolvePost=resolve);return new Response(null,{status:204});}
  if(unsupported)throw Object.assign(new Error('Sem stream'),{status:503});
  const body=new ReadableStream({start(controller){source=controller;options.signal.addEventListener('abort',()=>{try{controller.close();}catch{}},{once:true});}});
  return new Response(body,{headers:{'Content-Type':'text/event-stream'}});
 };
 const live=createTableLive({request,onEvent:event=>events.push(event),onStatus:status=>statuses.push(status),...clock});
 return {live,clock,events,statuses,calls,emit(value){source.enqueue(new TextEncoder().encode(value));},finish(){source.close();},resolvePost(){resolvePost?.();}};
}
test('SSE decodifica comentários, linhas divididas, CRLF e dados JSON multilinha',()=>{
 const events=[],decode=createEventDecoder(event=>events.push(event));
 const source=': heartbeat\r\nevent: scene\r\ndata: {"type":"scene",\r\ndata: "name":"João"}\r\n\r\ndata: inválido\n\ndata: {"type":"tokenPreview"}\n\n';
 for(const char of source)decode(char);assert.deepEqual(events,[{type:'scene',name:'João'},{type:'tokenPreview'}]);
});
test('limite SSE também conta linhas data já consumidas de um evento incompleto',()=>{
 const decode=createEventDecoder(()=>{}),line='data: '+ ' '.repeat(8192)+'\n';
 assert.throws(()=>{for(let n=0;n<1500;n++)decode(line);},/excedeu o limite/);
});
test('stream inválido aborta a requisição antiga antes de agendar reconexão',async()=>{
 const f=fixture();f.live.connect({id:'room',key:'secret'});await settle();
 f.emit('x'.repeat(12000001));await settle();
 assert.equal(f.live.status,'reconnecting');assert.equal(f.calls[0].options.signal.aborted,true);
 await f.clock.advance(500);assert.equal(f.calls.length,2);f.live.disconnect();
});
test('conecta uma vez, recebe eventos sem polling e separa campanhas ao cancelar',async()=>{
 const f=fixture(),access={id:'room',key:'secret'};f.live.connect(access);await settle();assert.equal(f.live.connected,true);assert.equal(f.calls[0].path,'/room/events');assert.equal(f.calls[0].access,access);assert.equal(f.calls[0].options.signal.aborted,false);
 f.live.connect({...access});assert.equal(f.calls.length,1);
 f.emit('data: {"type":"scene","rev":2}\n\n');await settle();assert.deepEqual(f.events,[{type:'scene',rev:2}]);
 f.live.disconnect();await settle();assert.equal(f.calls[0].options.signal.aborted,true);assert.equal(f.clock.size,0);assert.equal(f.live.connected,false);
});
test('prévia mantém só a posição recente, limita tráfego e prioriza fim sobre movimento pendente',async()=>{
 const f=fixture();f.live.connect({id:'room',key:'secret'});await settle();
 for(let seq=1;seq<=20;seq++)f.live.send({type:'tokenPreview',id:'hero',dragId:'drag',seq,x:seq,y:1,phase:'move'});
 await f.clock.advance(0);let posts=f.calls.filter(c=>c.path.endsWith('/preview'));assert.equal(posts.length,1);assert.equal(JSON.parse(posts[0].options.body).seq,20);
 f.live.send({type:'tokenPreview',id:'hero',dragId:'drag',seq:21,x:21,y:1,phase:'move'});await f.clock.advance(20);assert.equal(f.calls.filter(c=>c.path.endsWith('/preview')).length,1);
 f.live.send({type:'tokenPreview',id:'hero',dragId:'drag',seq:22,x:21,y:1,phase:'end'});await f.clock.advance(0);posts=f.calls.filter(c=>c.path.endsWith('/preview'));assert.equal(posts.length,2);assert.equal(JSON.parse(posts[1].options.body).phase,'end');f.live.disconnect();
});
test('uma requisição em voo nunca cria fila de posições obsoletas',async()=>{
 const f=fixture({slowPost:true});f.live.connect({id:'room',key:'secret'});await settle();
 f.live.send({type:'tokenPreview',id:'hero',dragId:'drag',seq:1,phase:'move'});await f.clock.advance(0);
 for(let seq=2;seq<=50;seq++)f.live.send({type:'tokenPreview',id:'hero',dragId:'drag',seq,phase:'move'});
 await f.clock.advance(100);assert.equal(f.calls.filter(c=>c.path.endsWith('/preview')).length,1);
 f.resolvePost();await settle();await f.clock.advance(0);const posts=f.calls.filter(c=>c.path.endsWith('/preview'));assert.equal(posts.length,2);assert.equal(JSON.parse(posts[1].options.body).seq,50);f.live.disconnect();f.resolvePost();await settle();
});
test('queda reconecta com nova cena; servidor sem stream usa polling sem tempestade de tentativas',async()=>{
 const f=fixture();f.live.connect({id:'room',key:'secret'});await settle();f.finish();await settle();assert.equal(f.live.status,'reconnecting');await f.clock.advance(499);assert.equal(f.calls.length,1);await f.clock.advance(1);assert.equal(f.calls.length,2);assert.equal(f.live.connected,true);f.live.disconnect();
 const fallback=fixture({unsupported:true});fallback.live.connect({id:'room',key:'secret'});await settle();assert.equal(fallback.live.status,'polling');await fallback.clock.advance(29000);assert.equal(fallback.calls.length,1);fallback.live.send({type:'tokenPreview'});assert.equal(fallback.calls.length,1);fallback.live.disconnect();assert.equal(fallback.clock.size,0);
});
test('quedas logo após headers SSE preservam backoff e uma conexão estável o reinicia',async()=>{
 const f=fixture();f.live.connect({id:'room',key:'secret'});await settle();
 for(const delay of [500,1000,2000]){
  f.finish();await settle();const before=f.calls.length;
  await f.clock.advance(delay-1);assert.equal(f.calls.length,before);
  await f.clock.advance(1);assert.equal(f.calls.length,before+1);
 }
 await f.clock.advance(10000);f.finish();await settle();const before=f.calls.length;
 await f.clock.advance(499);assert.equal(f.calls.length,before);await f.clock.advance(1);assert.equal(f.calls.length,before+1);f.live.disconnect();
});

test('retomar celular reinicia stream e cancela canal anterior sem perder a campanha selecionada',async()=>{
 const f=fixture(),access={id:'room',key:'secret',sceneId:'active'};f.live.connect(access);await settle();const original=f.calls[0].options.signal;
 f.live.reconnect();await settle();assert.equal(original.aborted,true);assert.equal(f.calls.length,2);assert.equal(f.calls[1].access.sceneId,'active');assert.equal(f.live.connected,true);
 f.emit('data: {"type":"scene","rev":9,"state":{"tokens":[{"id":"hero","x":5}]}}\n\n');await settle();assert.equal(f.events.at(-1).rev,9);f.live.disconnect();
});

test('rajada de 100 prévias é entregue uma vez por token no quadro, preservando ordem com snapshot',async()=>{
 const originalRaf=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame,frames=new Map();let serial=0,f;
 globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 try{
  f=fixture();f.live.connect({id:'room',key:'secret'});await settle();
  for(let seq=1;seq<=100;seq++)f.emit('data: '+JSON.stringify({type:'tokenPreview',id:'hero',dragId:'drag',phase:'move',seq,x:seq})+'\n\n');await settle();
  assert.equal(frames.size,1);assert.equal(f.events.length,0);for(const fn of frames.values())fn();frames.clear();assert.equal(f.events.length,1);assert.equal(f.events[0].seq,100);
  f.emit('data: '+JSON.stringify({type:'tokenPreview',id:'hero',dragId:'drag',phase:'move',seq:101})+'\n\n'+'data: {"type":"scene","rev":2}\n\n'+'data: '+JSON.stringify({type:'tokenPreview',id:'hero',dragId:'drag',phase:'cancel',seq:102})+'\n\n');await settle();
  assert.equal(f.events[1].seq,101);assert.equal(f.events[2].type,'scene');for(const fn of frames.values())fn();frames.clear();assert.equal(f.events[3].phase,'cancel');
  f.live.disconnect();assert.equal(frames.size,0);
 }finally{f?.live.disconnect();globalThis.requestAnimationFrame=originalRaf;globalThis.cancelAnimationFrame=originalCancel;}
});

test('fila lenta conserva confirmações de tokens diferentes e envia terminal antes de movimentos',async()=>{
 const f=fixture({slowPost:true});f.live.connect({id:'room',key:'secret'});await settle();
 f.live.send({type:'tokenPreview',id:'a',dragId:'a',seq:1,phase:'move'});await f.clock.advance(0);
 f.live.send({type:'tokenPreview',id:'a',dragId:'a',seq:2,phase:'end'});
 for(let seq=1;seq<=100;seq++)f.live.send({type:'tokenPreview',id:'b',dragId:'b',seq,phase:'move'});
 f.resolvePost();await settle();await f.clock.advance(0);
 let posts=f.calls.filter(c=>c.path.endsWith('/preview'));assert.equal(posts.length,2);assert.equal(JSON.parse(posts[1].options.body).phase,'end');assert.equal(JSON.parse(posts[1].options.body).id,'a');
 f.resolvePost();await settle();await f.clock.advance(50);posts=f.calls.filter(c=>c.path.endsWith('/preview'));assert.equal(posts.length,3);assert.equal(JSON.parse(posts[2].options.body).seq,100);assert.equal(JSON.parse(posts[2].options.body).id,'b');
 f.live.disconnect();f.resolvePost();await settle();
});

test('100 alterações por segundo limitam envios de movimento a 20 Hz sem atrasar fim do gesto',async()=>{
 const f=fixture();f.live.connect({id:'room',key:'secret'});await settle();
 for(let seq=1;seq<=100;seq++){f.live.send({type:'tokenPreview',id:'hero',dragId:'load',phase:'move',seq,x:seq,y:1});await f.clock.advance(10);}
 const before=f.calls.filter(c=>c.path.endsWith('/preview')).length;assert.ok(before<=21&&before>=19,String(before));
 f.live.send({type:'tokenPreview',id:'hero',dragId:'load',phase:'end',seq:101,x:100,y:1});await f.clock.advance(0);const posts=f.calls.filter(c=>c.path.endsWith('/preview'));assert.equal(posts.length,before+1);assert.equal(JSON.parse(posts.at(-1).options.body).phase,'end');f.live.disconnect();
});
