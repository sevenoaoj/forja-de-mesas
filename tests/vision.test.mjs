import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRotation,normalizeVision,normalizeDarkness,visionSector,pointInVision,sectorPath,visionSources,tokenInVision} from '../vision-model.mjs';
import {renderDarkness,updateDarkness,renderVisionCones,updateVisionCones} from '../public/table-vision.mjs';
import {api,sceneView} from '../api.mjs';
import {accessFor} from '../access.mjs';
import {sceneProjection} from '../scene-model.mjs';
import {normalizeTable} from '../table-model.mjs';
const grid={columns:20,rows:20,size:2,unit:'m'};
const hero={id:'hero',characterId:'hero-sheet',x:4,y:4,size:1,rotation:0,vision:{enabled:true,range:10,angle:90},visionSource:true};
test('visão circular e cone respeitam alcance, rotação, escala e fronteiras sem discretizar na grade',()=>{
 const s=visionSector(hero,grid);assert.deepEqual({x:s.x,y:s.y,radius:s.radius},{x:4.5,y:4.5,radius:5});
 assert.equal(pointInVision({x:4.5,y:.5},s),true);assert.equal(pointInVision({x:4.5,y:10},s),false);assert.equal(pointInVision({x:8,y:4.5},s),false);
 assert.equal(pointInVision({x:4.5,y:-.5001},s),false);
 assert.equal(pointInVision({x:6.5,y:2.5},s),true);
 const east=visionSector({...hero,rotation:90},grid);assert.equal(pointInVision({x:8,y:4.5},east),true);assert.equal(pointInVision({x:4.5,y:.5},east),false);
 const around=visionSector({...hero,vision:{range:10,angle:360}},grid);assert.equal(pointInVision({x:4.5,y:9.5},around),true);
 const narrow=visionSector({...hero,rotation:359,vision:{range:10,angle:6}},grid);assert.equal(pointInVision({x:4.5,y:.5},narrow),true);
 assert.equal(pointInVision({x:4.7,y:.5},narrow),false);
});
test('desativar visão mantém somente a área do token; dados antigos não ativam escuridão',()=>{
 assert.deepEqual(normalizeDarkness(),{level:100,enabled:false,mode:'individual'});assert.equal(normalizeVision().angle,120);assert.equal(normalizeRotation(-15),345);assert.equal(normalizeRotation(720),0);
 const s=visionSector({...hero,vision:{enabled:false,range:20,angle:360}},grid);assert.equal(pointInVision({x:4.5,y:4.5},s),true);assert.equal(pointInVision({x:4.5,y:1},s),false);assert.equal(sectorPath(s),'');
 assert.equal(normalizeVision({range:Infinity,angle:NaN}).range,9);assert.equal(normalizeVision({angle:600}).angle,360);
});
test('fontes individuais nunca usam o token selecionado de outro jogador; grupo só usa fontes autorizadas',()=>{
 const ally={...hero,id:'ally',characterId:'ally-sheet'},npc={...hero,id:'npc',characterId:'npc-sheet',visionSource:false},hidden={...ally,id:'hidden',hidden:true};
 const row={master:false,characterId:'hero-sheet',state:{table:{darkness:{mode:'individual'}},tokens:[hero,ally,npc,hidden]}};
 assert.deepEqual(visionSources(row,row.state.tokens,{selected:'ally'}).map(t=>t.id),['hero']);row.state.table.darkness.mode='group';assert.deepEqual(visionSources(row).map(t=>t.id),['hero','ally']);
 assert.deepEqual(visionSources({...row,master:true},row.state.tokens,{selected:'npc',preview:true}).map(t=>t.id),['hero','ally']);assert.deepEqual(visionSources({...row,master:true},row.state.tokens,{selected:'npc'}).map(t=>t.id),['npc']);
 assert.deepEqual(visionSources({...row,characterId:null}),[]);
 assert.deepEqual(visionSources({...row,characterId:null,state:{...row.state,table:{}}}),[]);
 assert.equal(tokenInVision({...ally,x:4,y:1},[hero],grid),true);assert.equal(tokenInVision({...ally,x:4,y:15},[hero],grid),false);
});
test('máscara preserva união das fontes, borda suave interna e só renderiza quando ativada',()=>{
 const row={id:'room',master:false,characterId:'hero-sheet',state:{table:{darkness:{mode:'group'}},tokens:[hero,{...hero,id:'ally',x:7,rotation:270}]}};
 const table={grid,darkness:{enabled:true,mode:'group'}};
 const markup=renderDarkness(row,table,row.state.tokens);assert.match(markup,/mask-type:luminance/);assert.match(markup,/stop-opacity="0"/);assert.doesNotMatch(markup,/stop-color="white"/);assert.match(markup,/fill="#090b14"/);assert.match(markup,/viewBox="0 0 20 20"/);assert.equal(renderDarkness(row,{...table,darkness:{enabled:false}},row.state.tokens),'');
 assert.match(sectorPath(visionSector({...hero,vision:{angle:360,range:10}},grid)),/ a /);assert.match(sectorPath(visionSector(hero,grid)),/ A /);
});
async function room(){
 const rows=new Map(),store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await call('','POST',null,{name:'Visão',example:true})).json(),member='a'.repeat(64),other='b'.repeat(64),base='/'+created.id;
 for(const [key,id]of [[member,'lyra'],[other,'dorian']]){await call(base+'/join','POST',created.invite,{key});await call(base+'/action','POST',key,{action:'characterClaim',data:{id}});}
 const action=(action,data,key=created.key)=>call(base+'/action','POST',key,{action,data}),view=async(key=created.key)=>(await call(base,'GET',key)).json();await action('characterType',{id:'mira',characterType:'npc'});return {rows,created,member,other,base,call,action,view};
}
async function ok(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
test('API configura visão por cena, preserva névoa e sincroniza giro próprio para mestre e outros jogadores',async()=>{
 const r=await room();await ok(await r.action('tableFog',{operation:'reveal',enabled:true,x:0,y:0,width:2,height:2}));const before=(await r.view()).state.table.fog;
 await ok(await r.action('tableSettings',{darkness:{enabled:true,mode:'individual'}}));assert.deepEqual((await r.view()).state.table.fog,before);
 await ok(await r.action('tokenUpdate',{id:'lyra',vision:{enabled:true,range:18,angle:100},rotation:45}));
 const own=await ok(await r.action('tokenRotate',{id:'lyra',rotation:90},r.member));assert.equal(own.state.tokens.find(t=>t.id==='lyra').rotation,90);assert.equal(own.state.tokens.find(t=>t.id==='lyra').vision.range,18);
 for(const key of [r.created.key,r.other])assert.equal((await r.view(key)).state.tokens.find(t=>t.id==='lyra').rotation,90);
 const raw=r.rows.get(r.created.id),event=sceneView(raw,accessFor(raw,r.member));assert.equal(event.state.tokens.find(t=>t.id==='lyra').rotation,90);assert.equal(event.state.table.darkness.enabled,true);
 assert.equal(event.state.tokens.find(t=>t.id==='lyra').visionSource,true);assert.equal(event.state.tokens.find(t=>t.id==='mira').visionSource,false);
 // Darkness never discards the canonical positions, even beyond the viewer's cone.
 assert.equal((await r.view(r.member)).state.tokens.length,3);
});
test('jogador não altera alcance, escuridão, tokens alheios ou bloqueados; tokenMove não injeta visão',async()=>{
 const r=await room();
 for(const [action,data,key] of [['tokenRotate',{id:'dorian',rotation:20},r.member],['tokenRotate',{id:'lyra',rotation:20},r.created.invite],['tokenUpdate',{id:'lyra',vision:{range:1000}},r.member],['tableSettings',{darkness:{enabled:true}},r.member]])assert.equal((await r.action(action,data,key)).status,403);
 await ok(await r.action('tokenMove',{id:'lyra',x:2,y:2,rotation:250,vision:{enabled:true,range:1000,angle:360}},r.member));const token=(await r.view()).state.tokens.find(t=>t.id==='lyra');assert.equal(token.rotation,0);assert.equal(token.vision.range,9);
 await ok(await r.action('tokenUpdate',{id:'lyra',locked:true}));assert.equal((await r.action('tokenRotate',{id:'lyra',rotation:90},r.member)).status,403);
 await ok(await r.action('tokenUpdate',{id:'lyra',hidden:true,locked:false}));assert.equal((await r.action('tokenRotate',{id:'lyra',rotation:90},r.member)).status,403);
});
test('configurações inválidas não gravam e cenas preparadas não alteram visão da cena ativa',async()=>{
 const r=await room();const rev=r.rows.get(r.created.id).rev;
 for(const [action,data]of [['tokenRotate',{id:'lyra',rotation:-1}],['tokenRotate',{id:'lyra',rotation:361}],['tokenUpdate',{id:'lyra',vision:{range:-1}}],['tokenUpdate',{id:'lyra',vision:{angle:0}}],['tokenUpdate',{id:'lyra',vision:{enabled:'yes'}}],['tableSettings',{darkness:{mode:'any'}}]])assert.equal((await r.action(action,data)).status,400);
 assert.equal(r.rows.get(r.created.id).rev,rev);
 await ok(await r.action('sceneCreate',{name:'Sala escura',sessionId:'session-initial'}));const scene=r.rows.get(r.created.id).state.sceneLibrary.scenes.at(-1);
 await ok(await r.action('tableSettings',{sceneId:scene.id,darkness:{enabled:true,mode:'group'}}));
 const raw=r.rows.get(r.created.id);assert.equal(normalizeTable(raw.state).darkness.enabled,false);assert.deepEqual(normalizeTable(sceneProjection(raw.state,scene.id)).darkness,{level:100,enabled:true,mode:'group'});
});

test('recorte nasce no centro e isola os traços dos ícones que criavam borda branca e afastavam o cone',()=>{
 const row={id:'stroke-proof',master:false,characterId:'hero-sheet',state:{table:{darkness:{mode:'individual'}},tokens:[hero]}};
 const markup=renderDarkness(row,{grid,darkness:{enabled:true}},[hero],{selected:'hero'});
 assert.match(markup,/<svg[^>]*stroke="none"[^>]*stroke-width="0"/);
 assert.match(markup,/<mask[^>]*stroke="none"[^>]*stroke-width="0"/);
 assert.match(markup,/data-vision-source="0" transform="translate\(4.5 4.5\)" stroke="none"/);
 assert.match(markup,/data-vision-cone="" transform="rotate\(0\)" d="M 0 0 L /);
 assert.match(markup,/<circle cx="0" cy="0"[^>]*stroke="none"/);
 assert.match(markup,/class="vtt-darkness-cover" stroke="none"><rect[^>]*stroke="none"/);
 assert.equal(pointInVision({x:4.5,y:3.7},visionSector(hero,grid)),true);
});

test('mover e girar atualizam os transforms sem recriar o SVG ou suas máscaras',()=>{
 const attrs={},cone={setAttribute:(key,value)=>attrs['cone-'+key]=value},source={dataset:{visionSource:'0'},setAttribute:(key,value)=>attrs['source-'+key]=value,querySelector:()=>cone},outline={setAttribute:(key,value)=>attrs['outline-'+key]=value};
 let writes=0;
 const host={set innerHTML(value){writes++;},querySelectorAll:()=>[source],querySelector:()=>outline};
 const row={id:'stable',master:false,characterId:'hero-sheet',state:{table:{darkness:{mode:'individual'}},tokens:[hero]}},table={grid,darkness:{enabled:true}};
 updateDarkness(host,row,table,[hero],{selected:'hero'});assert.equal(writes,1);
 updateDarkness(host,row,table,[{...hero,x:9,rotation:270}],{selected:'hero'});assert.equal(writes,1);assert.equal(attrs['source-transform'],'translate(9.5 4.5)');assert.equal(attrs['cone-transform'],'rotate(270)');assert.equal(attrs['outline-transform'],'translate(9.5 4.5) rotate(270)');
 updateDarkness(host,row,table,[{...hero,vision:{range:20,angle:90}}],{selected:'hero'});assert.equal(writes,2);
});

test('mestre vê todos os cones, inclusive tokens ocultos; jogadores e prévia não recebem essas guias',()=>{
 const hidden={...hero,id:'secret',name:'<Inimigo secreto>',hidden:true,color:'red'},ally={...hero,id:'ally',name:'Aliado',color:'jade'},blind={...hero,id:'blind',vision:{enabled:false,range:10,angle:90}};
 const row={id:'all-cones',master:true,state:{table:{darkness:{enabled:true}},tokens:[hero,hidden,ally,blind]}},table={grid,darkness:{enabled:true}};
 const html=renderVisionCones(row,table,row.state.tokens,{selected:'hero'});assert.equal((html.match(/data-vision-all=/g)||[]).length,3);assert.match(html,/&lt;Inimigo secreto&gt; · Oculto dos jogadores/);assert.match(html,/stroke-dasharray="4 4"/);assert.match(html,/stroke="#f87171"/);assert.match(html,/stroke="#9de5cb"/);
 assert.equal(renderVisionCones({...row,master:false},table,row.state.tokens),'');assert.equal(renderVisionCones(row,table,row.state.tokens,{preview:true}),'');assert.equal(renderVisionCones(row,table,row.state.tokens,{showCones:false}),'');assert.equal(renderVisionCones(row,{...table,darkness:{enabled:false}},row.state.tokens),'');
});

test('guias de todos os cones acompanham movimento e rotação sem reconstruir o SVG',()=>{
 const attributes={},node={dataset:{visionAll:'0'},setAttribute:(name,value)=>attributes[name]=value};let writes=0;
 const host={set innerHTML(value){writes++;},querySelectorAll:()=>[node]},row={id:'moving-guides',master:true,state:{table:{darkness:{enabled:true}},tokens:[hero]}},table={grid,darkness:{enabled:true}};
 updateVisionCones(host,row,table,[hero]);assert.equal(writes,1);
 updateVisionCones(host,row,table,[{...hero,x:8,y:7,rotation:30}]);assert.equal(writes,1);assert.equal(attributes.transform,'translate(8.5 7.5) rotate(30)');
 updateVisionCones(host,row,table,[hero],{preview:true});assert.equal(writes,2);
});

test('mestre libera e recolhe visão compartilhada para os dois jogadores, com modo presente no SSE',async()=>{
 const r=await room();await ok(await r.action('tableSettings',{darkness:{enabled:true,mode:'individual'}}));
 for(const [key,id] of [[r.member,'lyra'],[r.other,'dorian']]){const row=await r.view(key);assert.deepEqual(visionSources(row).map(t=>t.id),[id]);}
 await ok(await r.action('tableSettings',{darkness:{mode:'group'}}));
 for(const key of [r.member,r.other]){const row=await r.view(key);assert.equal(row.state.table.darkness.enabled,true);assert.deepEqual(visionSources(row).map(t=>t.id),['lyra','dorian']);const raw=r.rows.get(r.created.id);assert.equal(sceneView(raw,accessFor(raw,key)).state.table.darkness.mode,'group');}
 assert.equal((await r.action('tableSettings',{darkness:{mode:'individual'}},r.member)).status,403);
 await ok(await r.action('tableSettings',{darkness:{mode:'individual'}}));
 for(const [key,id] of [[r.member,'lyra'],[r.other,'dorian']])assert.deepEqual(visionSources(await r.view(key)).map(t=>t.id),[id]);
});

test('paredes recortam cada fonte separadamente, inclusive junto ao token',()=>{
 const wall={x:4,y:3,toX:5,toY:3,kind:'wall'};
 const target={...hero,y:1},ally={...hero,y:2.5};
 assert.equal(tokenInVision(target,[hero],grid,[wall]),false);
 assert.equal(tokenInVision(target,[hero,ally],grid,[wall]),true);
 assert.equal(tokenInVision(target,[hero],grid,[{...wall,open:true}]),true);
 assert.equal(pointInVision({x:4.5,y:4.1},visionSector(hero,grid),[{...wall,y:4.3,toY:4.3}]),false);
 assert.equal(pointInVision({x:6,y:2.5},visionSector(hero,grid),[wall]),true);
});

test('barreiras pertencem à cena e apenas o mestre desenha, opera e exclui portas',async()=>{
 const r=await room(),segment={kind:'door',x:1.5,y:2,toX:3,toY:3.25};
 assert.equal((await r.action('tableWallAdd',segment,r.member)).status,403);
 const added=await ok(await r.action('tableWallAdd',segment)),door=added.state.table.walls[0];
 assert.equal(door.open,false);
 assert.equal((await r.action('tableDoorSet',{id:door.id,open:true},r.member)).status,403);
 await ok(await r.action('tableDoorSet',{id:door.id,open:true}));
 assert.equal((await r.view(r.member)).state.table.walls[0].open,true);
 assert.equal((await r.action('tableWallDelete',{id:door.id},r.member)).status,403);
 await ok(await r.action('tableWallDelete',{id:door.id}));
 assert.deepEqual((await r.view(r.member)).state.table.walls,[]);
 assert.equal((await r.action('tableWallAdd',{...segment,toX:Infinity})).status,400);
});

test('iluminação ambiente e emissores persistem na cena com permissões de mestre',async()=>{
 const r=await room(),lamp={x:2,y:3,radius:2.5,color:'#bb4400'};
 for(const [name,data] of [['tableLightSet',lamp],['tableSettings',{darkness:{level:25}}],['tableLightDelete',{id:'lamp'}]])
  assert.equal((await r.action(name,data,r.member)).status,403);
 await ok(await r.action('tableSettings',{darkness:{enabled:true,level:25}}));
 const created=await ok(await r.action('tableLightSet',lamp)),id=created.state.table.lights[0].id;
 await ok(await r.action('tableLightSet',{...lamp,id,color:'#7755ff',radius:5}));
 const table=(await r.view(r.member)).state.table;
 assert.equal(table.darkness.level,25);assert.deepEqual(table.lights,[{...lamp,id,radius:5,color:'#7755ff'}]);
 assert.equal((await r.action('tableLightSet',{...lamp,radius:-1})).status,400);
 assert.equal((await r.action('tableSettings',{darkness:{level:101}})).status,400);
 await ok(await r.action('tableLightDelete',{id}));assert.deepEqual((await r.view(r.member)).state.table.lights,[]);
});

test('névoa de guerra preserva exploração por ficha e pintura manual ao reagrupar a mesa',async()=>{
 const r=await room();
 await ok(await r.action('tableFog',{enabled:true,operation:'reveal',x:1,y:1,width:2,height:2}));
 const manual=(await r.view()).state.table.fog.revealed;
 const config=teams=>({fogEnabled:true,fogMode:'war',darkness:{mode:'teams',teams}});
 await ok(await r.action('tableSettings',config({lyra:'Norte',dorian:'Sul'})));
 await ok(await r.action('tokenMove',{id:'dorian',x:15,y:9},r.other));
 let row=await r.view(r.member);
 assert.deepEqual(Object.keys(row.state.table.fog.memory),['lyra']);
 assert.ok(!row.state.tokens.some(t=>t.id==='dorian'));
 const before=(await r.view(r.other)).state.table.fog.memory.dorian;
 await ok(await r.action('tokenMove',{id:'dorian',x:1,y:1},r.other));
 const after=(await r.view(r.other)).state.table.fog.memory.dorian;
 before.forEach((bits,y)=>{if(bits)assert.equal(BigInt('0x'+bits)&BigInt('0x'+after[y]),BigInt('0x'+bits));});
 await ok(await r.action('tableSettings',config({lyra:'Norte',dorian:'Norte'})));
 row=await r.view(r.member);
 assert.deepEqual(new Set(visionSources(row).map(t=>t.characterId)),new Set(['lyra','dorian']));
 assert.ok(row.state.table.fog.memory.dorian);
 await ok(await r.action('tableSettings',{fogMode:'manual'}));
 assert.deepEqual((await r.view()).state.table.fog.revealed,manual);
 assert.equal((await r.action('tableSettings',config({}),r.other)).status,403);
});

test('facho mantém sua direção ao editar a cor e aceita voltar à emissão circular',async()=>{
 const r=await room(),lamp={x:4,y:4,radius:6,color:'#dda055'};
 const created=await ok(await r.action('tableLightSet',{...lamp,angle:35,rotation:270}));
 const id=created.state.table.lights[0].id;
 await ok(await r.action('tableLightSet',{...lamp,id,color:'#aaffee'}));
 const light=(await r.view(r.member)).state.table.lights[0];
 assert.equal(light.angle,35);assert.equal(light.rotation,270);
 assert.equal((await r.action('tableLightSet',{...lamp,id,angle:500})).status,400);
 await ok(await r.action('tableLightSet',{...lamp,id,angle:360}));
 assert.equal((await r.view(r.member)).state.table.lights[0].angle,undefined);
});

test('visibilidade é independente por emissor, preservada na edição e exclusiva do mestre',async()=>{
 const r=await room(),lamp={x:4,y:4,radius:3,color:'#ffeedd',scope:'local'};
 const created=await ok(await r.action('tableLightSet',lamp)),id=created.state.table.lights[0].id;
 await ok(await r.action('tableLightSet',{x:1,y:1,radius:2,color:'#33ff44'}));
 const {scope,...props}=lamp;
 await ok(await r.action('tableLightSet',{...props,id,radius:5}));
 const lights=(await r.view(r.member)).state.table.lights;
 assert.equal(lights[0].scope,'local');assert.equal(lights[1].scope,undefined);
 assert.equal((await r.action('tableLightSet',{...props,id,scope:'global'},r.member)).status,403);
 assert.equal((await r.action('tableLightSet',{...props,id,scope:'inválido'})).status,400);
 await ok(await r.action('tableLightSet',{...props,id,scope:'global'}));
 assert.equal((await r.view(r.member)).state.table.lights[0].scope,undefined);
});
