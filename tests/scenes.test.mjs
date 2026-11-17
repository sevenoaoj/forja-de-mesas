import test from 'node:test';
import assert from 'node:assert/strict';
import {api,sceneView} from '../api.mjs';
import {createTableRealtime} from '../table-realtime.mjs';
import {activeSceneId,sceneProjection,sceneSummary} from '../scene-model.mjs';
import {accessFor} from '../access.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function room(t){
 const rows=new Map(),assets=new Map();
 const store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){await Promise.resolve();if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;},async putAsset(key,blob){assets.set(key,blob);},async getAsset(key){return assets.get(key);},async deleteAsset(key){assets.delete(key);}};
 store.realtime=createTableRealtime({sceneView});t.after(()=>store.realtime.dispose());
 const call=(path,method,key,body,headers={},signal)=>api(new Request('http://app/api/campaigns'+path,{method,headers:{...(key?{Authorization:'Bearer '+key}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal}),store);
 const created=await(await call('','POST',null,{name:'Cenas',example:true})).json(),base='/'+created.id,member='a'.repeat(64);await call(base+'/join','POST',created.invite,{key:member});await call(base+'/action','POST',member,{action:'characterClaim',data:{id:'lyra'}});
 const act=(action,data={},key=created.key)=>call(base+'/action','POST',key,{action,data});
 const view=(scene='',key=created.key)=>call(base+(scene?'?scene='+encodeURIComponent(scene):''),'GET',key).then(r=>r.json());
 const make=async(name='Casa secreta')=>{const result=await(await act('sceneCreate',{name})).json();return result.state.sceneLibrary.scenes.find(s=>s.name===name).id;};
 const map=async(scene)=>api(new Request('http://app/api/campaigns'+base+'/map',{method:'POST',headers:{Authorization:'Bearer '+created.key,'Content-Type':'image/png','X-File-Name':'casa-secreta.png','X-Map-Width':'1400','X-Map-Height':'700','X-Scene-Id':scene},body:new Uint8Array([137,80,78,71])}),store);
 const listen=async(key,scene='')=>{const controller=new AbortController(),response=await call(base+'/events'+(scene?'?scene='+scene:''),'GET',key,undefined,{},controller.signal),events=[],reader=response.body.getReader();const done=(async()=>{let text='';while(true){const r=await reader.read();if(r.done)break;text+=new TextDecoder().decode(r.value);let at;while((at=text.indexOf('\n\n'))>=0){const block=text.slice(0,at);text=text.slice(at+2);if(block.startsWith('data: '))events.push(JSON.parse(block.slice(6)));}}})();t.after(()=>{controller.abort();return done;});await flush();return events;};
 return {rows,store,assets,created,base,member,call,act,view,make,map,listen,row:()=>rows.get(created.id)};
}
test('campanha antiga é preservada e o catálogo inicial não grava nem duplica seu mundo',async t=>{
 const r=await room(t),before=structuredClone(r.row()),gm=await r.view();assert.equal(gm.state.sceneLibrary.scenes.length,1);assert.equal(gm.state.sceneId,'scene-initial');assert.equal(gm.state.tokens.length,3);assert.deepEqual(r.row(),before);assert.equal(r.row().state.sceneLibrary,undefined);
 const player=await r.view('',r.member);assert.equal(player.state.sceneLibrary,undefined);assert.equal(player.state.sceneId,'scene-initial');
});
test('preparar cena privada isola mapa, grade, névoa e tokens sem expor catálogo ou arquivo aos jogadores',async t=>{
 const r=await room(t),scene=await r.make(),initial=activeSceneId(r.row().state);assert.equal((await r.map(scene)).status,201);
 await r.act('tokenAdd',{sceneId:scene,name:'Inimigo preparado',color:'red',icon:'paw'});await r.act('tableFog',{sceneId:scene,enabled:true,operation:'reveal',kind:'brush',radius:.7,points:[{x:2.5,y:2.5}]});
 const gm=await r.view(scene);assert.equal(gm.state.scene,'Casa secreta');assert.equal(gm.state.tokens.length,1);assert.equal(gm.state.table.fog.strokes.length,1);assert.equal(gm.state.table.grid.columns,14);
 assert.equal(r.row().state.map,null);assert.equal(r.row().state.tokens.length,3);assert.equal(activeSceneId(r.row().state),initial);
 const publicView=await r.view(scene,r.member);assert.equal(publicView.state.sceneId,initial);assert.ok(!JSON.stringify(publicView).includes('Casa secreta'));assert.ok(!JSON.stringify(publicView).includes('Inimigo preparado'));assert.equal(publicView.state.sceneLibrary,undefined);
 assert.equal((await r.call(r.base+'/asset/'+gm.state.map.id,'GET',r.member)).status,404);assert.equal((await r.call(r.base+'/asset/'+gm.state.map.id,'GET',r.created.key)).status,200);
});
test('trocar de cena restaura posições, desenhos, névoa e combate; recursos da ficha continuam globais',async t=>{
 const r=await room(t),initial=activeSceneId(r.row().state);await r.act('tokenMove',{id:'lyra',x:2,y:2});await r.act('tableDrawingAdd',{kind:'freehand',color:'#abcdef',points:[{x:1,y:1},{x:3,y:2}]});await r.act('combatSet',{entries:[{name:'Lyra',value:15,tokenId:'lyra'}]});
 const before=await r.view(),second=await r.make('Floresta');await r.act('sceneActivate',{id:second});assert.equal((await r.view('',r.member)).state.sceneId,second);assert.equal(r.row().state.tokens.length,0);
 await r.act('sheetCounter',{id:'lyra',field:'f4',step:-1},r.member);await r.act('tokenAdd',{name:'Árvore',color:'jade'});await r.act('sceneActivate',{id:initial});const restored=await r.view();
 assert.deepEqual(restored.state.tokens,before.state.tokens);assert.deepEqual(restored.state.table.drawings,before.state.table.drawings);assert.deepEqual(restored.state.table.combat,before.state.table.combat);assert.equal(restored.state.characters[0].values.f4,'17/22');assert.equal(sceneProjection(r.row().state,second).tokens[0].name,'Árvore');
 const activeRecord=r.row().state.sceneLibrary.scenes.find(s=>s.id===initial);assert.equal(activeRecord.tokens,undefined);assert.equal(activeRecord.table,undefined);
});
test('sessões agrupam cenas, permitem reordenação e exigem mover conteúdo antes de apagar',async t=>{
 const r=await room(t);await r.act('sessionCreate',{name:'Sessão 2',date:'2026-11-13',notes:'Segredo do mestre'});let state=(await r.view()).state;const session=state.sceneLibrary.sessions.find(s=>s.name==='Sessão 2');
 const a=await r.make('A'),b=await r.make('B');await r.act('sceneMove',{id:a,sessionId:session.id});await r.act('sceneMove',{id:b,sessionId:session.id});await r.act('sceneMove',{id:b,direction:-1});
 state=(await r.view()).state;assert.deepEqual(state.sceneLibrary.scenes.filter(s=>s.sessionId===session.id).map(s=>s.id),[b,a]);assert.equal((await r.act('sessionDelete',{id:session.id})).status,409);
 await r.act('sceneMove',{id:a,sessionId:'session-initial'});await r.act('sceneMove',{id:b,sessionId:'session-initial'});assert.equal((await r.act('sessionDelete',{id:session.id})).status,200);
 assert.equal((await r.act('sessionCreate',{name:'Inválida',date:'2026-02-31'})).status,400);assert.equal((await r.act('sceneCreate',{name:'Invadir'},r.member)).status,403);assert.equal((await r.act('sceneActivate',{id:a},r.member)).status,403);
});
test('duplicar compartilha arquivo com segurança e substituir mapa não apaga o mapa das outras cenas',async t=>{
 const r=await room(t),scene=await r.make();await r.map(scene);await r.act('tokenAdd',{sceneId:scene,name:'Guarda',color:'gold'});const source=await r.view(scene),mapId=source.state.map.id;
 const result=await(await r.act('sceneDuplicate',{id:scene})).json(),copy=result.state.sceneLibrary.scenes.find(s=>s.name.includes('cópia'));assert.ok(copy);assert.equal(copy.map.id,mapId);
 await r.map(scene);assert.ok(r.assets.has(r.created.id+'/'+mapId));assert.equal((await r.call(r.base+'/asset/'+mapId,'GET',r.created.key)).status,200);
 await r.act('sceneDelete',{id:copy.id});assert.ok(!r.assets.has(r.created.id+'/'+mapId));assert.equal((await r.act('sceneDelete',{id:activeSceneId(r.row().state)})).status,409);
});
test('cena antiga em ação de jogador é recusada após mudança e versão de organização evita sobrescrita',async t=>{
 const r=await room(t),scene=await r.make('Outra');const version=sceneSummary(r.row().state).version;await r.act('sceneUpdate',{id:scene,name:'Novo',expectedVersion:version});assert.equal((await r.act('sceneUpdate',{id:scene,name:'Antigo',expectedVersion:version})).status,409);
 await r.act('sceneActivate',{id:scene});assert.equal((await r.act('tablePing',{sceneId:'scene-initial',x:1,y:1},r.member)).status,409);assert.equal((await r.act('tokenAdd',{sceneId:'missing',name:'X'})).status,404);
});
test('SSE mantém preparação privada do mestre e leva jogadores para a cena ativada',async t=>{
 const r=await room(t),scene=await r.make(),player=await r.listen(r.member),gm=await r.listen(r.created.key,scene);
 assert.equal(gm.find(e=>e.type==='scene').state.sceneId,scene);assert.equal(player.find(e=>e.type==='scene').state.sceneId,'scene-initial');
 await r.act('tokenAdd',{sceneId:scene,name:'Monstro reservado',color:'red'});await flush();assert.ok(!JSON.stringify(player).includes('Monstro reservado'));assert.ok(gm.some(e=>e.state?.tokens.some(t=>t.name==='Monstro reservado')));
 await r.act('sceneActivate',{id:scene});await flush();assert.equal(player.filter(e=>e.type==='scene').at(-1).state.sceneId,scene);assert.equal(player.filter(e=>e.type==='scene').at(-1).state.sceneLibrary,undefined);
 const response=await r.call(r.base+'/preview','POST',r.created.key,{type:'tokenPreview',sceneId:'scene-initial',id:'lyra',x:4,y:4,dragId:'late-frame',seq:1,phase:'move'});assert.equal(response.status,409);
});

test('troca entre cenas com o mesmo mapa e tokens aposenta prévias antigas',async t=>{
 const r=await room(t),initial=activeSceneId(r.row().state),player=await r.listen(r.member);
 const copied=await(await r.act('sceneDuplicate',{id:initial})).json(),copy=copied.state.sceneLibrary.scenes.find(scene=>scene.id!==initial);
 assert.equal((await r.call(r.base+'/preview','POST',r.member,{type:'tokenPreview',sceneId:initial,id:'lyra',x:5,y:4,dragId:'old-scene-drag',seq:1,phase:'move'})).status,200);
 await r.act('sceneActivate',{id:copy.id});await flush();assert.ok(player.some(event=>event.type==='tokenPreview'&&event.dragId==='old-scene-drag'&&event.phase==='cancel'));
 assert.equal(player.filter(event=>event.type==='scene').at(-1).state.sceneId,copy.id);
 assert.equal((await r.call(r.base+'/preview','POST',r.member,{type:'tokenPreview',sceneId:initial,id:'lyra',x:6,y:4,dragId:'old-scene-drag',seq:2,phase:'move'})).status,409);
});
