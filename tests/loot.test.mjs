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

test('investigação exige proximidade e autorização, esconde o diário e as decisões de grupos rivais',async()=>{
 const r=await room();
 const group=(await good(await r.action('partySave',{name:'Os navegantes'}))).state.parties.at(-1);
 await good(await r.action('characterParty',{id:'lyra',party:group.id,revealed:false}));
 const note=(await good(await r.action('journalSave',{title:'O código da porta',kind:'clue',body:'Fale com Rita',gmNotes:'Traição futura',audience:'private'}))).state.journal.at(-1);
 await good(await r.action('tokenMove',{id:'lyra',x:1,y:1}));
 const add={kind:'clue',noteId:note.id,label:'Inscrição',mode:'approve',x:1.5,y:1.5,radius:1.5};
 const point=(await good(await r.action('explorePlace',add))).state.table.exploration.at(-1);
 assert.equal((await r.action('explorePlace',add,r.one)).status,403);
 const nearby=(await r.view(r.one)).state.table.exploration[0];assert.equal(nearby.noteId,undefined);
 assert.deepEqual((await r.view(r.two)).state.table.exploration,[]);
 assert.equal((await r.action('exploreInvestigate',{id:point.id},r.two)).status,403);
 await good(await r.action('exploreInvestigate',{id:point.id},r.one));
 let master=await r.view();const pending=master.state.table.exploration[0].pending;
 assert.equal(pending.length,1);assert.equal(pending[0].audience,'party:'+group.id);
 assert.equal((await r.action('exploreDecide',{id:point.id,audience:pending[0].audience,grant:true},r.one)).status,403);
 await good(await r.action('exploreDecide',{id:point.id,audience:pending[0].audience,grant:true}));
 const discovered=(await r.view(r.one)).state.journal.find(n=>n.id===note.id);
 assert.equal(discovered.body,'Fale com Rita');assert.equal(discovered.gmNotes,undefined);
 assert.equal((await r.view(r.two)).state.journal.some(n=>n.id===note.id),false);
 const rival=await r.view(r.two);assert.ok(!JSON.stringify(rival.state.table.exploration).includes(note.id));
 await good(await r.action('characterParty',{id:'dorian',party:group.id,revealed:false}));assert.equal((await r.view(r.two)).state.journal.some(n=>n.id===note.id),true);
 await good(await r.action('characterParty',{id:'dorian',party:'',revealed:false}));assert.equal((await r.view(r.two)).state.journal.some(n=>n.id===note.id),false);
});
test('som localizado usa o token próprio, alcance, volume atenuado e portas da cena ativa',async()=>{
 const r=await room();const raw=r.rows.get(r.created.id);raw.state.audio={cues:[],clips:[]};raw.state.audio.clips=[{id:'audio-fonte',name:'Fonte',type:'audio/wav',size:40}];
 await good(await r.action('tokenMove',{id:'lyra',x:1,y:1}));await good(await r.action('tokenMove',{id:'dorian',x:12,y:9}));
 const point=(await good(await r.action('explorePlace',{kind:'sound',clipId:'audio-fonte',x:3.5,y:1.5,radius:5}))).state.table.exploration.at(-1);
 const volume=async key=>(await good(await r.call(r.base+'/sync','GET',key))).state.audio.ambient;
 const clear=await volume(r.one);assert.equal(clear.length,1);assert.equal(clear[0].volume,36);assert.equal(clear[0].x,undefined);assert.deepEqual(await volume(r.two),[]);
 const wall=(await good(await r.action('tableWallAdd',{kind:'door',x:2,y:0,toX:2,toY:3}))).state.table.walls.at(-1);
 const dimmed=await volume(r.one);assert.ok(dimmed[0].volume<clear[0].volume);assert.equal(dimmed[0].muffled,true);
 assert.equal(dimmed[0].cutoffHz,7400);assert.equal(dimmed[0].volume,Math.round(clear[0].volume*.82));
 // Keep source and listener fixed; only the distance to the blocking surface changes.
 const second=(await good(await r.action('tableWallAdd',{kind:'door',x:3,y:0,toX:3,toY:3}))).state.table.walls.at(-1);
 const farther=await volume(r.one);assert.ok(farther[0].cutoffHz<dimmed[0].cutoffHz);assert.ok(farther[0].volume<dimmed[0].volume);
 await good(await r.action('tableDoorSet',{id:second.id,open:true}));assert.deepEqual(await volume(r.one),dimmed);
 assert.equal((await r.action('soundOcclusion',{id:point.id,muffle:false},r.one)).status,403);
 await good(await r.action('soundOcclusion',{id:point.id,muffle:false}));assert.equal((await volume(r.one))[0].muffled,false);
 await good(await r.action('soundOcclusion',{id:point.id,muffle:true}));
 await good(await r.action('tableDoorSet',{id:wall.id,open:true}));assert.deepEqual(await volume(r.one),clear);
 await good(await r.action('exploreRemove',{id:point.id}));assert.deepEqual(await volume(r.one),[]);
});

test('investigação integra rolagem, escolha da nota, dados físicos, entrega única e revelação sem pedido',async()=>{
 const r=await room(),group=(await good(await r.action('partySave',{name:'Patrulha'}))).state.parties.at(-1).id;
 for(const id of ['lyra','dorian'])await good(await r.action('characterParty',{id,party:group,revealed:false}));
 const note=async title=>(await good(await r.action('journalSave',{title,kind:'clue',body:title,audience:'private'}))).state.journal.at(-1);
 const clue=await note('Livro'),other=await note('Marca');await good(await r.action('tokenMove',{id:'lyra',x:1,y:1}));
 const p=(await good(await r.action('explorePlace',{kind:'clue',noteId:clue.id,label:'Mesa',mode:'auto',x:1.5,y:1.5,radius:2,test:'attribute:forca',dc:10,itemId:r.item.id,quantity:2}))).state.table.exploration[0];
 const investigation=await good(await r.action('exploreInvestigate',{id:p.id},r.one));
 assert.equal(investigation.investigationRoll,undefined);assert.equal(investigation.state.checkRequests.length,0);assert.equal(investigation.state.investigations,undefined);
 const gm=await r.view(),request=gm.state.table.exploration[0].pending[0];assert.equal(gm.state.investigations.length,1);
 assert.equal(request.roll,undefined);
 const repeat=await good(await r.action('exploreInvestigate',{id:p.id},r.one));assert.equal(repeat.investigationRoll,undefined);assert.equal((await r.view()).state.table.exploration[0].pending[0].id,request.id);
 const d={id:p.id,requestId:request.id,audience:request.audience,grant:true,scope:'individual',noteId:other.id,total:15};
 assert.equal((await r.action('exploreDecide',d,r.one)).status,403);
 const outs=await Promise.all([r.action('exploreDecide',d),r.action('exploreDecide',d)]);
 assert.deepEqual(outs.map(o=>o.status).sort(),[200,409]);assert.equal((await r.view()).state.investigations.length,0);
 assert.equal((await r.view(r.one)).state.inventory[0].quantity,2);assert.equal((await r.view(r.two)).state.journal.length,0);
 await good(await r.action('exploreReveal',{id:p.id,characterId:'lyra',scope:'group',total:20}));
 assert.equal((await r.view(r.one)).state.inventory.length,1);assert.equal((await r.view(r.two)).state.journal[0].id,clue.id);
 await good(await r.action('exploreReveal',{id:p.id,characterId:'dorian',scope:'individual',noteId:other.id}));
 assert.equal((await r.view(r.two)).state.inventory.length,0);
});

test('empréstimo temporário de leitura e transferência entre aliados conservam quantidade e privacidade',async()=>{
 const r=await room();
 await good(await r.action('itemGrant',{id:r.item.id,version:r.item.version,characterId:'lyra',quantity:3}));
 const item=(await r.view(r.one)).state.inventory[0];
 const share={id:item.id,kind:'item',version:item.version,target:'group',minutes:5};
 await good(await r.action('materialShare',share,r.one));
 let b=await r.view(r.two);assert.equal(b.state.inventory.length,0);assert.equal(b.state.sharing.received[0].material.name,r.item.name);assert.equal(b.state.sharing.received[0].material.gmNotes,undefined);
 assert.equal((await r.action('materialShare',share,r.two)).status,403);
 const n=(await good(await r.action('journalSave',{title:'Meu plano',body:'Texto secreto',kind:'note',audience:'private'},r.one))).state.journal[0];
 await good(await r.action('materialShare',{...share,kind:'note',id:n.id,version:n.version,target:'dorian'},r.one));
 b=await r.view(r.two);assert.equal(b.state.sharing.received.length,2);assert.equal(b.state.journal.length,0);
 const gid=b.state.sharing.received.find(g=>g.kind==='note').id;
 await good(await r.action('shareRevoke',{id:gid},r.one));assert.equal((await r.view(r.two)).state.sharing.received.length,1);
 const transfer={id:item.id,version:item.version,target:'dorian',quantity:2};
 const results=await Promise.all([r.action('playerTransfer',transfer,r.one),r.action('playerTransfer',transfer,r.one)]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
 assert.equal((await r.view(r.two)).state.inventory[0].quantity,2);assert.equal((await r.view(r.one)).state.inventory[0].quantity,1);
 const raw=r.rows.get(r.created.id);raw.state.materialShares[0].until=Date.now()-1;
 assert.equal((await r.view(r.two)).state.sharing.received.length,0);
 const rival=(await good(await r.action('partySave',{name:'Opostos'}))).state.parties.at(-1).id;
 await good(await r.action('characterParty',{id:'dorian',party:rival,revealed:false}));
 assert.notEqual((await r.action('playerTransfer',{...transfer,version:item.version+1,quantity:1},r.one)).status,200);
});

test('durante o arraste o jogador vê e ouve pontos próximos sem mover o token salvo',async()=>{
 const r=await room();
 const raw=r.rows.get(r.created.id);raw.state.audio={cues:[],clips:[{id:'audio-fonte',name:'Fonte',type:'audio/wav',size:40}]};
 await good(await r.action('tokenMove',{id:'lyra',x:1,y:1}));
 const note=(await good(await r.action('journalSave',{title:'Segredo',body:'Privado',kind:'clue',audience:'private'}))).state.journal.at(-1);
 for(const point of [{kind:'sound',clipId:'audio-fonte'},{kind:'clue',mode:'approve',label:'Examinar',noteId:note.id}]){
  await good(await r.action('explorePlace',{...point,x:7.5,y:4.5,radius:2}));
 }
 const before=await r.view(r.one);
 const sync=async(key,x)=>(await good(await r.call(r.base+'/sync?moving=lyra&rotation=0&exploreScene='+before.state.sceneId+'&x='+x+'&y=4','GET',key))).state;
 assert.deepEqual(before.state.table.exploration,[]);
 const preview=await good(await r.call(r.base+'/sync?motionOnly=1&moving=lyra&rotation=0&exploreScene='+before.state.sceneId+'&x=7&y=4','GET',r.one));
 assert.deepEqual(Object.keys(preview.state).sort(),['ambient','movingPoints']);
 assert.deepEqual(preview.state.movingPoints.map(p=>p.kind),['sound','clue']);
 const near=await sync(r.one,7);
 assert.deepEqual(near.movingPoints.map(p=>p.kind),['sound','clue']);
 assert.equal(near.movingPoints[0].clipId,undefined);assert.equal(near.movingPoints[1].noteId,undefined);
 assert.equal(near.audio.ambient[0].volume,100);
 assert.equal((await sync(r.two,7)).movingPoints,undefined);
 assert.deepEqual((await sync(r.one,1)).movingPoints,[]);
 assert.equal((await r.view(r.one)).rev,before.rev);
 const wall=(await good(await r.action('tableWallAdd',{kind:'door',x:7,y:3,toX:7,toY:6}))).state.table.walls.at(-1);
 assert.deepEqual((await sync(r.one,6)).movingPoints,[]);
 await good(await r.action('tableDoorSet',{id:wall.id,open:true}));
 assert.equal((await sync(r.one,6)).movingPoints.length,2);
});

test('ponto independente revela texto e entrega recompensas cumulativas por mínimo, uma vez cada',async()=>{
 const r=await room();await good(await r.action('tokenMove',{id:'lyra',x:1,y:1}));
 const extra=(await good(await r.action('itemSave',{name:'Anel',kind:'gear'}))).state.inventory.at(-1);
 const rewards=[{itemId:r.item.id,dc:8,quantity:2},{itemId:extra.id,dc:14,quantity:1}];
 const point=(await good(await r.action('explorePlace',{kind:'clue',mode:'auto',label:'Gaveta',description:'Um fundo falso.',x:1.5,y:1.5,radius:2,rewards}))).state.table.exploration.at(-1);
 assert.equal(point.mode,'approve');
 const asked=await good(await r.action('exploreInvestigate',{id:point.id},r.one));
 assert.equal(asked.state.table.exploration[0].description,undefined);
 const reveal=total=>r.action('exploreReveal',{id:point.id,characterId:'lyra',scope:'individual',total});
 await good(await reveal(8));
 let view=await r.view(r.one);assert.equal(view.state.table.exploration[0].description,'Um fundo falso.');assert.equal(view.state.journal.length,0);
 assert.deepEqual(view.state.inventory.map(i=>i.quantity),[2]);
 await good(await reveal(14));await good(await reveal(20));
 view=await r.view(r.one);assert.deepEqual(view.state.inventory.map(i=>i.quantity),[2,1]);assert.equal(view.state.table.exploration[0].rules,undefined);
});

test('investigação usa o total informado pelo mestre e envia um único recibo privado com todos os itens entregues',async()=>{
 const r=await room();await good(await r.action('tokenMove',{id:'lyra',x:1,y:1}));
 const extra=(await good(await r.action('itemSave',{name:'Anel',kind:'gear'}))).state.inventory.at(-1);
 const rewards=[{itemId:r.item.id,dc:-999,quantity:3},{itemId:extra.id,dc:-999,quantity:1}];
 const p=(await good(await r.action('explorePlace',{kind:'clue',mode:'approve',label:'Baú',test:'attribute:forca',rewards,x:1.5,y:1.5,radius:2}))).state.table.exploration.at(-1);
 const asked=await good(await r.action('exploreInvestigate',{id:p.id},r.one));assert.equal(asked.investigationRoll,undefined);
 const req=(await r.view()).state.table.exploration.at(-1).pending[0];
 await good(await r.action('exploreDecide',{id:p.id,requestId:req.id,audience:req.audience,grant:true,total:14}));
 const [receipt]=(await r.view(r.one)).state.investigationReceipts;
 assert.deepEqual(receipt.items.map(({name,quantity})=>({name,quantity})),[{name:r.item.name,quantity:3},{name:'Anel',quantity:1}]);assert.equal(receipt.location,'Baú');
 assert.deepEqual(receipt.items.map(i=>i.kind),[r.item.kind,extra.kind]);
 assert.equal((await r.view()).state.investigationReceipts,undefined);assert.deepEqual((await r.view(r.two)).state.investigationReceipts,[]);
 await good(await r.action('investigationReceiptRead',{id:receipt.id},r.two));
 assert.equal((await r.view(r.one)).state.investigationReceipts.length,1);
 await good(await r.action('investigationReceiptRead',{id:receipt.id},r.one));
 assert.deepEqual((await r.view(r.one)).state.investigationReceipts,[]);assert.equal((await r.view(r.one)).state.inventory.length,2);
});

test('usos acompanham as unidades nas entregas, descartes individuais e exclusão global pelo mestre',async()=>{
 const r=await room(),cat=(await good(await r.action('itemSave',{name:'Elixir',kind:'consumable',usesPerUnit:3}))).state.inventory.at(-1);
 const grant=await good(await r.action('itemGrant',{id:cat.id,version:1,quantity:3,characterId:'lyra'}));
 const copy=grant.state.inventory.at(-1);
 const use=()=>r.action('itemUse',{id:copy.id,version:1,delta:-1},r.one);
 assert.deepEqual((await Promise.all([use(),use()])).map(r=>r.status).sort(),[200,409]);
 assert.equal((await r.action('itemUse',{id:copy.id,version:2,delta:1},r.two)).status,403);
 await good(await r.action('playerTransfer',{id:copy.id,version:2,target:'dorian',quantity:1},r.one));
 const own=(await r.view(r.one)).state.inventory[0],ally=(await r.view(r.two)).state.inventory[0];
 assert.deepEqual([own.quantity,own.uses,ally.quantity,ally.uses],[2,5,1,3]);
 await good(await r.action('itemDelete',{id:own.id,version:own.version},r.one));
 assert.equal((await r.view(r.one)).state.inventory.length,0);assert.equal((await r.view(r.two)).state.inventory.length,1);
 await good(await r.action('itemGrant',{id:cat.id,version:1,quantity:1,characterId:'lyra'}));
 await good(await r.action('itemDelete',{id:ally.id,version:ally.version}));
 assert.equal((await r.view(r.one)).state.inventory.length,0);assert.equal((await r.view(r.two)).state.inventory.length,0);
 assert.deepEqual((await r.view()).state.inventory.map(i=>i.id),[r.item.id]);
});
