import test from 'node:test';
import assert from 'node:assert/strict';
import {api,sceneView} from '../api.mjs';
import {createTableRealtime} from '../table-realtime.mjs';
import {accessFor} from '../access.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('publicação reutiliza projeção por acesso e cena sem compartilhar dados entre jogadores',async()=>{
 const {newCampaign}=await import('../model.mjs');
 const row={id:'test',rev:1,owner:'gm',player:'guest',state:newCampaign('Mesa',true)};
 row.state.members=[{id:'a',key:'alice'},{id:'b',key:'bob'}];
 let calls=0;
 const hub=createTableRealtime({sceneView:(row,access,sceneId)=>{calls++;return {rev:row.rev,who:access.master?'gm':access.memberId,sceneId};},setTimer:()=>1,clearTimer(){}});
 const readers=[];
 try{
  for(const [key,scene] of [['alice'],['alice'],['bob'],['gm','one'],['gm','two']]){
   const reader=hub.connect(row,key,undefined,scene).body.getReader();readers.push(reader);
   await reader.read();await reader.read();
  }
  calls=0;hub.publish({...row,rev:2});assert.equal(calls,4);
  const events=await Promise.all(readers.map(async reader=>new TextDecoder().decode((await reader.read()).value)));
  assert.equal(events[0],events[1]);assert.match(events[0],/"who":"a"/);assert.match(events[2],/"who":"b"/);
  assert.match(events[3],/"sceneId":"one"/);assert.match(events[4],/"sceneId":"two"/);
 }finally{await Promise.all(readers.map(reader=>reader.cancel()));hub.dispose();}
});

test('conexão já abortada não deixa timer ativo e cliente lento tem fila limitada por bytes',async()=>{
 const row={id:'test',rev:1,owner:'gm',player:'guest',state:{}};
 let timers=0;
 const hub=createTableRealtime({sceneView:()=>({padding:'x'.repeat(6_100_000)}),setTimer:()=>{timers++;return 1;},clearTimer(){timers--;}});
 const abort=new AbortController();abort.abort();
 const response=hub.connect(row,'gm',abort.signal);
 assert.equal((await response.body.getReader().read()).done,true);
 assert.equal(hub.connectionCount,0);assert.equal(timers,0);
 const slow=hub.connect(row,'gm');
 assert.equal(hub.connectionCount,1);assert.equal(timers,1);
 hub.publish({...row,rev:2});
 assert.equal(hub.connectionCount,1);
 hub.publish({...row,rev:3});
 assert.equal(hub.connectionCount,0);assert.equal(timers,0);
 await slow.body.cancel();hub.dispose();
});

async function fixture(t){
 const rows=new Map();let time=10000;
 const store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){await Promise.resolve();if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const hub=createTableRealtime({sceneView,now:()=>time,setTimer:()=>({unref(){}}),clearTimer(){}});store.realtime=hub;t.after(()=>hub.dispose());
 const call=(path,method,key,body,signal)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body?JSON.stringify(body):undefined,signal}),store);
 const created=await (await call('','POST',null,{name:'Live',example:true})).json(),base='/'+created.id,a='a'.repeat(64),b='b'.repeat(64);
 for(const [key,id] of [[a,'lyra'],[b,'dorian']]){await call(base+'/join','POST',created.invite,{key});await call(base+'/action','POST',key,{action:'characterClaim',data:{id}});}
 async function listen(key){const abort=new AbortController(),response=await call(base+'/events','GET',key,null,abort.signal);assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/text\/event-stream/);const events=[],reader=response.body.getReader();const pumping=(async()=>{let text='';while(true){const {done,value}=await reader.read();if(done)break;text+=new TextDecoder().decode(value);let at;while((at=text.indexOf('\n\n'))!==-1){const block=text.slice(0,at);text=text.slice(at+2);if(block.startsWith('data: '))events.push(JSON.parse(block.slice(6)));}}})();t.after(()=>{abort.abort();return pumping;});await flush();return {events,abort,pumping};}
 return {rows,store,hub,created,a,b,base,call,listen,advance(ms){time+=ms;hub.tick();},act:(action,data,key=created.key)=>call(base+'/action','POST',key,{action,data}),preview:(id,x,y,key=a,extra={})=>call(base+'/preview','POST',key,{type:'tokenPreview',id,x,y,dragId:'drag-'+id,seq:1,phase:'move',...extra}),row:()=>rows.get(created.id)};
}
test('conexão autorizada recebe snapshot imediato filtrado e fecha ao desconectar',async t=>{
 const f=await fixture(t);await f.act('tokenUpdate',{id:'dorian',hidden:true});const p=await f.listen(f.a),gm=await f.listen(f.created.key);
 assert.equal(p.events[0].type,'ready');const scene=p.events.find(e=>e.type==='scene');assert.deepEqual(Object.keys(scene.state).sort(),['activeSceneId','journalVersion','map','narrations','rolls','scene','sceneId','sessionName','sheetTemplatesVersion','table','tokens']);assert.ok(!scene.state.tokens.some(token=>token.id==='dorian'));assert.equal(scene.state.tokens[0].canMove,true);assert.equal(scene.state.characters,undefined);assert.ok(gm.events.find(e=>e.type==='scene').state.tokens.some(token=>token.id==='dorian'));
 assert.equal((await f.call(f.base+'/events','GET','invalid')).status,403);assert.equal(f.hub.connectionCount,2);p.abort.abort();await p.pumping;assert.equal(f.hub.connectionCount,1);
});
test('dois jogadores recebem prévias simultâneas sem gravações e finais persistem separadamente',async t=>{
 const f=await fixture(t),p=await f.listen(f.a),q=await f.listen(f.b),before=structuredClone(f.row());
 const responses=await Promise.all([f.preview('lyra',5.3,4.4,f.a),f.preview('dorian',7.2,5.3,f.b)]);assert.ok(responses.every(r=>r.status===200));await flush();
 for(const stream of [p,q])assert.deepEqual(stream.events.filter(e=>e.type==='tokenPreview').map(e=>e.id).sort(),['dorian','lyra']);assert.deepEqual(f.row(),before);
 const replies=await Promise.all([f.act('tokenMove',{id:'lyra',x:5,y:4,dragId:'drag-lyra'},f.a),f.act('tokenMove',{id:'dorian',x:7,y:5,dragId:'drag-dorian'},f.b)]);assert.ok(replies.every(r=>r.status===200));await flush();
 const scene=p.events.filter(e=>e.type==='scene').at(-1);assert.equal(scene.state.tokens.find(t=>t.id==='lyra').x,5);assert.equal(scene.state.tokens.find(t=>t.id==='dorian').x,7);
 const n=p.events.length;await f.preview('lyra',4.1,4,f.a,{seq:99});await flush();assert.equal(p.events.length,n);
});
test('ocultação manual e propriedade são respeitadas enquanto névoa não interrompe prévias',async t=>{
 const f=await fixture(t),p=await f.listen(f.a),gm=await f.listen(f.created.key);
 assert.equal((await f.preview('dorian',7,5,f.a)).status,403);
 await f.preview('lyra',5,4);await flush();await f.act('tokenUpdate',{id:'lyra',hidden:true});await flush();
 assert.ok(p.events.some(e=>e.type==='tokenPreview'&&e.id==='lyra'&&e.phase==='cancel'&&e.x===undefined));assert.equal((await f.preview('lyra',6,4)).status,403);
 const count=p.events.filter(e=>e.type==='tokenPreview'&&e.x!==undefined).length;
 await f.preview('lyra',6,4,f.created.key,{dragId:'master-hidden'});await flush();assert.equal(p.events.filter(e=>e.type==='tokenPreview'&&e.x!==undefined).length,count);assert.ok(gm.events.some(e=>e.dragId==='master-hidden'));
 await f.act('tokenUpdate',{id:'lyra',hidden:false});await f.act('tableFog',{enabled:true});await f.act('tableFog',{operation:'reveal',x:4,y:4,width:2,height:2});
 assert.equal((await f.preview('lyra',8,4,f.a,{dragId:'fog-player'})).status,200);
 await f.preview('lyra',4.2,4,f.created.key,{dragId:'fog-master'});await flush();await f.preview('lyra',8,4,f.created.key,{dragId:'fog-master',seq:2});await flush();
 const last=p.events.filter(e=>e.type==='tokenPreview'&&e.dragId==='fog-master').at(-1);assert.equal(last.phase,'move');assert.equal(last.x,8);
});
test('TTL, cancelamento, sequência e reconexão não ressuscitam movimentos antigos',async t=>{
 const f=await fixture(t),p=await f.listen(f.a);await f.preview('lyra',5,4);await f.preview('lyra',6,4,f.a,{seq:0});await flush();assert.equal(p.events.filter(e=>e.type==='tokenPreview').length,1);
 const reconnect=await f.listen(f.b);assert.ok(reconnect.events.some(e=>e.type==='tokenPreview'&&e.x===5));
 f.advance(1900);await flush();assert.equal(p.events.filter(e=>e.type==='tokenPreview').at(-1).phase,'cancel');
 const n=p.events.filter(e=>e.type==='tokenPreview').length;await f.preview('lyra',7,4,f.a,{seq:10});await flush();assert.equal(p.events.filter(e=>e.type==='tokenPreview').length,n);
 await f.preview('lyra',6,4,f.a,{dragId:'new'});await f.preview('lyra',6,4,f.a,{dragId:'new',phase:'cancel',seq:2});await flush();assert.equal(p.events.filter(e=>e.type==='tokenPreview').at(-1).phase,'cancel');
});
test('ação final aposenta dragId mesmo se nenhum frame havia chegado',async t=>{
 const f=await fixture(t),p=await f.listen(f.a);await f.act('tokenMove',{id:'lyra',x:6,y:4,dragId:'late'},f.a);await f.preview('lyra',5,4,f.a,{dragId:'late'});await flush();assert.equal(p.events.filter(e=>e.type==='tokenPreview').length,0);assert.equal(p.events.filter(e=>e.type==='scene').at(-1).state.tokens.find(t=>t.id==='lyra').x,6);
});
test('finalizar movimento entrega posição canônica antes de liberar a prévia, inclusive ao voltar à origem',async t=>{
 const f=await fixture(t),p=await f.listen(f.a);
 for(const [dragId,x] of [['placement',5],['return-to-origin',5]]){
  await f.preview('lyra',7.3,4,f.a,{dragId});await flush();const start=p.events.length;
  assert.equal((await f.act('tokenMove',{id:'lyra',x,y:4,dragId},f.a)).status,200);await flush();
  const events=p.events.slice(start),snapshot=events.findIndex(e=>e.type==='scene'),cancel=events.findIndex(e=>e.type==='tokenPreview'&&e.dragId===dragId&&e.phase==='cancel');
  assert.ok(snapshot>=0&&cancel>snapshot,'o cliente deve conhecer a posição persistida antes de restaurar o token');
  assert.equal(events[snapshot].state.tokens.find(token=>token.id==='lyra').x,x);
 }
});
test('requisição com snapshot antigo não rebaixa permissões nem estado da sala',async t=>{
 const f=await fixture(t),p=await f.listen(f.a),old=structuredClone(f.row()),access=accessFor(old,f.a);
 await f.act('tokenUpdate',{id:'lyra',hidden:true});const stale=f.hub.connect(old,f.b);const reader=stale.body.getReader();await reader.read();const value=(await reader.read()).value;assert.ok(!new TextDecoder().decode(value).includes('Lyra Vesper'));await reader.cancel();
 assert.throws(()=>f.hub.preview(old,access,{type:'tokenPreview',id:'lyra',x:5,y:4,dragId:'old',seq:1,phase:'move'}),e=>e.status===403);
});
test('commit que chega após publicação mais recente libera prévia usando o snapshot atual',async t=>{
 const f=await fixture(t),p=await f.listen(f.a);await f.preview('lyra',7,4);const older=structuredClone(f.row());
 await f.act('tokenMove',{id:'dorian',x:8,y:5},f.b);await flush();const start=p.events.length;
 f.hub.commitToken(older,'lyra','drag-lyra');f.hub.publish(older);await flush();
 const events=p.events.slice(start),snapshot=events.findIndex(e=>e.type==='scene'),cancel=events.findIndex(e=>e.phase==='cancel'&&e.id==='lyra');
 assert.ok(snapshot>=0&&cancel>snapshot);assert.equal(events[snapshot].rev,f.row().rev);assert.equal(events[snapshot].state.tokens.find(token=>token.id==='dorian').x,8);
});
test('fallback de sync entrega a mesma cena filtrada sem hub em Workers',async t=>{
 const f=await fixture(t);await f.act('tokenUpdate',{id:'dorian',hidden:true});delete f.store.realtime;
 const scene=await (await f.call(f.base+'/sync?table=1','GET',f.a)).json();assert.ok(scene.state.tokens.every(t=>t.id!=='dorian'));assert.ok(scene.state.table);assert.equal((await f.call(f.base+'/events','GET',f.a)).status,503);
});
test('mudança de grade invalida prévias e frames atrasados do mapa anterior',async t=>{
 const f=await fixture(t),p=await f.listen(f.a);await f.preview('lyra',5,4);await f.act('tableSettings',{grid:{snap:false}});await flush();assert.ok(p.events.some(e=>e.type==='tokenPreview'&&e.phase==='cancel'));
 const count=p.events.filter(e=>e.type==='tokenPreview').length;await f.preview('lyra',6,4,f.a,{seq:2});await flush();assert.equal(p.events.filter(e=>e.type==='tokenPreview').length,count);
});
test('limites de taxa e conexões contêm emissores excessivos sem impedir finalização',async t=>{
 const f=await fixture(t),p=await f.listen(f.a);for(let seq=0;seq<60;seq++){await f.preview('lyra',5,4,f.a,{seq});await flush();}assert.equal(p.events.filter(e=>e.type==='tokenPreview').length,40);
 assert.equal((await f.preview('lyra',5,4,f.a,{seq:61,phase:'cancel'})).status,200);await flush();assert.equal(p.events.filter(e=>e.type==='tokenPreview').at(-1).phase,'cancel');
 await f.listen(f.a);await f.listen(f.a);await f.listen(f.a);assert.equal((await f.call(f.base+'/events','GET',f.a)).status,429);
});
test('preview malformado não cria sessão residual nem derruba manutenção de outras campanhas',async t=>{
 const f=await fixture(t),p=await f.listen(f.a);const created=await(await f.call('','POST',null,{name:'Outra',example:true})).json();
 assert.equal((await f.call('/'+created.id+'/preview','POST',created.key,{type:'bad'})).status,400);assert.doesNotThrow(()=>f.advance(11000));await flush();assert.equal(f.hub.connectionCount,1);
});

test('rolagem pública envia mesma cor e resultado aos clientes; mestre privado continua filtrado',async t=>{
 const f=await fixture(t),p=await f.listen(f.a),q=await f.listen(f.b),gm=await f.listen(f.created.key);
 await f.act('character',{id:'lyra',name:'Lyra Vesper',concept:'Arcanista',color:'cyan'},f.a);
 const result=await(await f.act('roll',{formula:'2d6+1',diceColor:'#ff0000'},f.a)).json(),roll=result.state.rolls[0];
 assert.equal(roll.diceColor,'#67e8f9');await flush();
 for(const stream of [p,q,gm]){const scene=stream.events.filter(e=>e.type==='scene').at(-1);assert.deepEqual(scene.state.rolls[0],roll);assert.ok(scene.rollVersion);}
 const secret=await(await f.act('roll',{formula:'1d20',characterId:'lyra'})).json();await flush();
 for(const stream of [p,q])assert.ok(!JSON.stringify(stream.events).includes(secret.state.rolls[0].id));
});

test('PC e celular recebem a mesma posição sob névoa e reconexão restaura snapshot completo',async t=>{
 const f=await fixture(t),pc=await f.listen(f.a),phone=await f.listen(f.a);
 await f.act('tableFog',{enabled:true,operation:'reset'});await f.preview('lyra',8.25,4.3,f.a,{dragId:'through-fog'});await flush();
 for(const client of [pc,phone]){assert.equal(client.events.filter(e=>e.type==='scene').at(-1).state.tokens.length,3);assert.ok(client.events.some(e=>e.type==='tokenPreview'&&e.dragId==='through-fog'&&e.x===8.25));}
 await f.act('tableFog',{operation:'hide',kind:'brush',radius:2,points:[{x:8,y:4}]});await flush();for(const client of [pc,phone])assert.ok(!client.events.some(e=>e.dragId==='through-fog'&&e.phase==='cancel'));
 await f.act('tokenMove',{id:'lyra',x:8,y:4,dragId:'through-fog'},f.a);await flush();
 for(const client of [pc,phone])assert.equal(client.events.filter(e=>e.type==='scene').at(-1).state.tokens.find(t=>t.id==='lyra').x,8);
 phone.abort.abort();await phone.pumping;const resumed=await f.listen(f.a);assert.equal(resumed.events.find(e=>e.type==='scene').state.tokens.find(t=>t.id==='lyra').x,8);
 await f.act('tokenUpdate',{id:'lyra',hidden:true});await flush();for(const client of [pc,resumed])assert.ok(client.events.filter(e=>e.type==='scene').at(-1).state.tokens.every(t=>t.id!=='lyra'));
 await f.act('tokenUpdate',{id:'lyra',hidden:false});await flush();for(const client of [pc,resumed])assert.equal(client.events.filter(e=>e.type==='scene').at(-1).state.tokens.find(t=>t.id==='lyra').x,8);
});

test('canal ao vivo entrega narração privada só ao personagem destinatário',async t=>{
 const f=await fixture(t),a=await f.listen(f.a),b=await f.listen(f.b),gm=await f.listen(f.created.key);
 const response=await f.act('narrationSend',{characterId:'lyra',title:'Segredo',body:'Você reconhece a marca.'});assert.equal(response.status,200);
 await flush();
 const latest=client=>client.events.filter(e=>e.type==='scene').at(-1).state.narrations;
 assert.equal(latest(a)[0].body,'Você reconhece a marca.');assert.deepEqual(latest(b),[]);assert.equal(latest(gm).length,1);
 const id=latest(a)[0].id;
 assert.equal((await f.act('narrationRead',{id},f.b)).status,403);
 assert.equal((await f.act('narrationRead',{id},f.a)).status,200);
 await flush();assert.deepEqual(latest(a),[]);assert.ok(latest(gm)[0].readAt);
});

test('ângulos ao vivo chegam aos dois jogadores; commit encerra prévia e rejeita pacotes atrasados',async t=>{
 const f=await fixture(t),one=await f.listen(f.a),two=await f.listen(f.b);
 assert.equal((await f.preview('lyra',4,4,f.a,{rotation:123,dragId:'turn'})).status,200);await flush();
 for(const client of [one,two])assert.equal(client.events.filter(e=>e.type==='tokenPreview').at(-1).rotation,123);assert.equal(f.row().state.tokens[0].rotation,undefined);
 assert.equal((await f.act('tokenRotate',{id:'lyra',rotation:123,dragId:'turn'},f.a)).status,200);await flush();
 for(const client of [one,two]){const events=client.events,snapshot=events.findLastIndex(e=>e.type==='scene');assert.equal(events[snapshot].state.tokens.find(t=>t.id==='lyra').rotation,123);assert.equal(events[snapshot+1].phase,'cancel');}
 const before=two.events.length;await f.preview('lyra',4,4,f.a,{rotation:45,dragId:'turn',seq:99});await flush();assert.equal(two.events.length,before);
 assert.equal((await f.preview('dorian',6,5,f.a,{rotation:45})).status,403);
 for(const rotation of [-1,360,'90',null])assert.equal((await f.preview('lyra',4,4,f.a,{rotation,dragId:'bad'})).status,400);
});

test('girar durante arraste não aposenta a sequência de movimento nem descarta posições seguintes',async t=>{
 const f=await fixture(t),other=await f.listen(f.b);
 await f.preview('lyra',5,4,f.a,{dragId:'walk-turn',seq:1});
 await f.act('tokenRotate',{id:'lyra',rotation:90},f.a);await flush();
 assert.equal(other.events.some(e=>e.type==='tokenPreview'&&e.dragId==='walk-turn'&&e.phase==='cancel'),false);
 await f.preview('lyra',6,4,f.a,{dragId:'walk-turn',seq:2,rotation:90});await flush();
 assert.equal(other.events.filter(e=>e.type==='tokenPreview'&&e.dragId==='walk-turn').at(-1).x,6);
 await f.act('tokenMove',{id:'lyra',x:6,y:4,dragId:'walk-turn'},f.a);await flush();
 const last=other.events.filter(e=>e.type==='scene').at(-1).state.tokens.find(t=>t.id==='lyra');assert.equal(last.x,6);assert.equal(last.rotation,90);
 assert.equal(other.events.filter(e=>e.type==='tokenPreview'&&e.dragId==='walk-turn').at(-1).phase,'cancel');
});

test('confirmação atrasada de giro aposenta só o giro e mantém o arraste mais recente',async t=>{
 const f=await fixture(t),other=await f.listen(f.b);await f.preview('lyra',5,4,f.a,{dragId:'walking',seq:1});
 await f.act('tokenRotate',{id:'lyra',rotation:45,dragId:'old-turn'},f.a);await flush();
 assert.equal(other.events.some(e=>e.type==='tokenPreview'&&e.dragId==='walking'&&e.phase==='cancel'),false);
 const before=other.events.length;await f.preview('lyra',4,4,f.a,{dragId:'old-turn',rotation:30,seq:2});await flush();assert.equal(other.events.length,before);
 await f.preview('lyra',6,4,f.a,{dragId:'walking',rotation:45,seq:2});await flush();assert.equal(other.events.at(-1).x,6);
});
