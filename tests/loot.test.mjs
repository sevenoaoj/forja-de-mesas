import test from 'node:test';
import assert from 'node:assert/strict';
import {api,sceneView} from '../api.mjs';
import {accessFor,publicState} from '../access.mjs';
import {pointRevealed} from '../fog-geometry.mjs';
import {createLootRewards,lootPreview,lootPlacement,lootEffect} from '../public/loot.mjs';
async function room(){
 const rows=new Map();let conflict;
 const store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){await Promise.resolve();if(conflict){const fn=conflict;conflict=null;const current=structuredClone(rows.get(row.id));fn(current);current.rev++;rows.set(row.id,current);return false;}if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;},async deleteAsset(){}};
 const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await call('','POST',null,{name:'Tesouros',example:true})).json(),base='/'+created.id,one='a'.repeat(64),two='b'.repeat(64);
 const action=(action,data,key=created.key)=>call(base+'/action','POST',key,{action,data}),view=async(key=created.key)=>(await call(base,'GET',key)).json();
 for(const [key,id]of [[one,'lyra'],[two,'dorian']]){await call(base+'/join','POST',created.invite,{key});await action('characterClaim',{id},key);}
 await action('tokenMove',{id:'dorian',x:5,y:4});
 await action('itemSave',{name:'Espada da aurora',kind:'weapon',accent:'#4488ff',description:'Revela seu poder ao portador.',properties:'1d8 + luz',gmNotes:'Segredo absoluto',rarity:'Rara',weight:2,value:'100 PO'});
 const item=(await view()).state.inventory[0];
 return {store,rows,created,base,one,two,item,call,action,view,race(fn){conflict=fn;},async place(extra={}){const row=await good(await action('lootPlace',{itemId:item.id,version:item.version,quantity:3,x:5,y:4,...extra}));return row.state.tokens.find(t=>t.kind==='item');}};
}
async function good(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
test('mestre prepara drop oculto, revela resumo sem segredos e coleta entrega ficha privada ao portador',async()=>{
 const r=await room(),drop=await r.place();assert.equal(drop.hidden,true);assert.equal((await r.view(r.one)).state.tokens.some(t=>t.id===drop.id),false);
 assert.equal(JSON.stringify(publicState(r.rows.get(r.created.id).state,accessFor(r.rows.get(r.created.id),r.one))).includes('Segredo absoluto'),false);
 await good(await r.action('tokenUpdate',{id:drop.id,hidden:false}));const revealed=await r.view(r.one),token=revealed.state.tokens.find(t=>t.id===drop.id);
 assert.equal(r.item.accent,'#4488ff');assert.equal(token.loot.item.accent,r.item.accent);assert.equal(token.loot.item.name,r.item.name);assert.equal(token.loot.item.description,undefined);assert.equal(token.loot.item.gmNotes,undefined);assert.equal(token.canMove,false);assert.equal(token.vision.enabled,false);
 const row=await good(await r.action('lootCollect',{id:drop.id,version:1},r.one));assert.ok(row.pickup.itemId);assert.equal(row.state.tokens.some(t=>t.id===drop.id),false);
 const own=row.state.inventory.find(i=>i.id===row.pickup.itemId);assert.equal(own.accent,r.item.accent);assert.equal(own.characterId,'lyra');assert.equal(own.quantity,3);assert.equal(own.description,r.item.description);assert.equal(own.gmNotes,undefined);assert.equal(own.sourceId,undefined);
 assert.equal((await r.view(r.two)).state.inventory.length,0);assert.equal((await r.view()).state.inventory.find(i=>i.id===own.id).gmNotes,'Segredo absoluto');assert.equal((await r.view()).state.inventory.filter(i=>!i.characterId).length,1);
 const raw=r.rows.get(r.created.id),event=sceneView(raw,accessFor(raw,r.two));assert.equal(event.state.tokens.some(t=>t.id===drop.id),false);assert.equal(event.state.table.lootEvents.length,1);assert.equal(JSON.stringify(event).includes('1d8 + luz'),false);
});
test('duas coletas concorrentes transferem uma única cópia e rejeitam o perdedor sem duplicar',async()=>{
 const r=await room(),drop=await r.place({revealed:true});const result=await Promise.all([r.action('lootCollect',{id:drop.id,version:1},r.one),r.action('lootCollect',{id:drop.id,version:1},r.two)]);
 assert.deepEqual(result.map(r=>r.status).sort(),[200,409]);const raw=r.rows.get(r.created.id);assert.equal(raw.state.inventory.filter(i=>i.characterId).length,1);assert.equal(raw.state.table.lootEvents.length,1);
});
test('alcance, névoa, visão, propriedade e revelação são revalidados no servidor',async()=>{
 const r=await room(),drop=await r.place();assert.equal((await r.action('lootCollect',{id:drop.id,version:1},r.one)).status,403);
 await good(await r.action('tokenUpdate',{id:drop.id,hidden:false}));assert.equal((await r.action('lootCollect',{id:drop.id,version:1,characterId:'dorian'},r.one)).status,403);
 assert.equal((await r.action('lootCollect',{id:drop.id,version:1},r.created.invite)).status,403);assert.equal((await r.action('lootPlace',{itemId:r.item.id,version:1},r.one)).status,403);
 await good(await r.action('tokenMove',{id:'lyra',x:0,y:0}));assert.equal((await r.action('lootCollect',{id:drop.id,version:1},r.one)).status,400);
 await good(await r.action('tokenMove',{id:'lyra',x:4,y:4}));await good(await r.action('tableFog',{enabled:true,operation:'reset'}));assert.equal((await r.action('lootCollect',{id:drop.id,version:1},r.one)).status,403);
 await good(await r.action('tableFog',{enabled:false}));await good(await r.action('tableSettings',{darkness:{enabled:true}}));await good(await r.action('tokenUpdate',{id:'lyra',rotation:270,vision:{range:9,angle:40}}));assert.equal((await r.action('lootCollect',{id:drop.id,version:1},r.one)).status,403);
 await good(await r.action('tokenRotate',{id:'lyra',rotation:90},r.one));assert.equal((await r.action('lootCollect',{id:drop.id,version:1},r.one)).status,200);
});
test('snapshot de loot independe de editar ou remover o catálogo e tentativas antigas são recusadas',async()=>{
 const r=await room(),drop=await r.place({revealed:true});assert.equal((await r.action('lootCollect',{id:drop.id,version:7},r.one)).status,409);
 await good(await r.action('itemSave',{...r.item,name:'Nome alterado',version:r.item.version}));await good(await r.action('itemDelete',{id:r.item.id,version:r.item.version+1}));
 const row=await good(await r.action('lootCollect',{id:drop.id,version:1},r.one));assert.equal(row.state.inventory.find(i=>i.id===row.pickup.itemId).name,'Espada da aurora');
});
test('preparação de outra cena fica privada e coleta precisa pertencer à cena ativa do jogador',async()=>{
 const r=await room();await good(await r.action('sceneCreate',{name:'Baú secreto',sessionId:'session-initial'}));const scene=(await r.view()).state.sceneLibrary.scenes.at(-1);
 const drop=await r.place({sceneId:scene.id,revealed:true});assert.equal((await r.view(r.one)).state.tokens.some(t=>t.id===drop.id),false);assert.equal((await r.action('lootCollect',{id:drop.id,version:1,sceneId:scene.id},r.one)).status,409);
 await good(await r.action('sceneActivate',{id:scene.id}));await good(await r.action('tokenAdd',{name:'Lyra',characterId:'lyra',x:4,y:4}));assert.equal((await r.action('lootCollect',{id:drop.id,version:1,sceneId:scene.id},r.one)).status,200);
});
test('falha de inventário cheio preserva o item no mapa e retry de CAS não contorna ocultação',async()=>{
 const r=await room(),drop=await r.place({revealed:true});const raw=r.rows.get(r.created.id);raw.state.inventory=Array.from({length:1000},(_,i)=>({...r.item,id:String(i)}));const before=structuredClone(raw.state);
 assert.equal((await r.action('lootCollect',{id:drop.id,version:1},r.one)).status,413);assert.deepEqual(r.rows.get(r.created.id).state,before);
 raw.state.inventory=[r.item];r.race(row=>row.state.tokens.find(t=>t.id===drop.id).hidden=true);assert.equal((await r.action('lootCollect',{id:drop.id,version:1},r.one)).status,403);assert.equal(r.rows.get(r.created.id).state.inventory.filter(i=>i.characterId).length,0);
});
test('token comum não pode receber loot forjado e coleta pelo mestre é entregue apenas à ficha escolhida',async()=>{
 const r=await room();assert.equal((await r.action('tokenUpdate',{id:'lyra',kind:'item',loot:{quantity:5}})).status,400);
 const drop=await r.place();const row=await good(await r.action('lootCollect',{id:drop.id,version:1,characterId:'dorian'}));assert.equal(row.state.inventory.find(i=>i.id===row.pickup.itemId).characterId,'dorian');assert.equal((await r.view(r.one)).state.table.lootEvents.length,0);
});
test('ponto da névoa respeita ordem dos pincéis e retângulos',()=>{
 const fog={enabled:true,revealed:[{x:0,y:0,width:4,height:4}],strokes:[{kind:'brush',operation:'hide',radius:.5,points:[{x:1,y:1},{x:3,y:1}]},{kind:'rectangle',operation:'reveal',x:1,y:0,width:1,height:2}]};
 assert.equal(pointRevealed(fog,{x:2.5,y:1}),false);assert.equal(pointRevealed(fog,{x:1.5,y:1}),true);assert.equal(pointRevealed(fog,{x:7,y:7}),false);assert.equal(pointRevealed({enabled:false},{x:7,y:7}),true);
});
class Dialog extends EventTarget{constructor(){super();this.open=false;this.dataset={};}close(){this.open=false;this.dispatchEvent(new Event('close'));}}
test('ficha coletada abre só uma vez, espera outro modal fechar e descarta outra campanha',async()=>{
 const dialog=new Dialog(),owner={id:'campaign'},other={id:'other'},jobs=[],shown=[];let active=owner;const row={state:{inventory:[{id:'item',name:'Relíquia',kind:'quest'}]}};
 const ui={esc:s=>String(s),button:()=>''};const rewards=createLootRewards({dialog,current:()=>row,access:()=>active,ui:()=>ui,modal:(title,body)=>{shown.push({title,body});dialog.open=true;},schedule:fn=>jobs.push(fn)});
 dialog.open=true;rewards.enqueue('item',owner);rewards.enqueue('item',owner);assert.equal(jobs.length,1);jobs.shift()();assert.equal(shown.length,0);dialog.close();await Promise.resolve();assert.equal(shown.length,1);assert.match(shown[0].title,/Item coletado/);assert.equal(dialog.dataset.lootReward,'true');dialog.close();await Promise.resolve();assert.equal(shown.length,1);
 rewards.enqueue('new',owner);active=other;row.state.inventory.push({id:'new',name:'Outro'});jobs.shift()();assert.equal(shown.length,1);
});

test('backup e restauração preservam item ainda no chão sem repetir eventos de coleta',async()=>{
 const r=await room(),drop=await r.place();const response=await r.call(r.base+'/backup','GET',r.created.key);assert.equal(response.status,200);
 const restored=await api(new Request('http://app/api/campaigns/import',{method:'POST',body:await response.arrayBuffer()}),r.store);assert.equal(restored.status,201,await restored.clone().text());const copy=await restored.json();
 assert.equal(copy.state.tokens.find(t=>t.id===drop.id).loot.item.gmNotes,'Segredo absoluto');assert.equal(copy.state.tokens.find(t=>t.id===drop.id).hidden,true);assert.deepEqual(copy.state.table.lootEvents,[]);
});

test('prévia pública não revela descrição e formulário de colocação escapa texto e versões',()=>{
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ui={esc,button:()=>'',input:(name,label,value)=>'<input name="'+name+'" value="'+esc(value)+'">',select:()=>'<select></select>',submit:()=>'<button>Coletar</button>'},token={id:'drop',name:'<Poção>',loot:{version:1,quantity:'<img>',item:{name:'<Poção>',description:'Spoiler',gmNotes:'Segredo',portrait:'javascript:evil()'}}};
 const preview=lootPreview(token,{master:false,characterId:'hero',state:{characters:[{id:'hero',access:'full'}]}},ui);assert.ok(!preview.includes('Spoiler'));assert.ok(!preview.includes('Segredo'));assert.ok(!preview.includes('javascript:'));assert.match(preview,/&lt;img&gt;/);
 const form=lootPlacement({master:true,state:{table:{grid:{columns:10,rows:10}},characters:[],inventory:[{id:'a',name:'<Nome>',version:'1" onclick="evil()'}]}},ui);assert.match(form,/&lt;Nome&gt;/);assert.match(form,/data-version="1&quot; onclick=&quot;evil\(\)"/);assert.ok(!form.includes(' onclick="'));
});
