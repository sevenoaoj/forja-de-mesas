import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {backupAssets,exportCampaignBackup,importCampaignBackup} from '../campaign-backup.mjs';
import {normalizeTable,tokenVisible,mapGrid,mutateTable,patrolSample} from '../table-model.mjs';

async function mesa() {
  const rows=new Map();
  const assets=new Map();
  const store={
    async getAsset(path){return assets.get(path);},
    async putAsset(path,blob){assets.set(path,blob);},
    async deleteAsset(path){assets.delete(path);},
    async create(row) {rows.set(row.id,structuredClone(row));},
    async get(id) {return structuredClone(rows.get(id));},
    async save(row) {
      await Promise.resolve();
      if (rows.get(row.id).rev!==row.rev) return false;
      rows.set(row.id,structuredClone({...row,rev:row.rev+1}));
      return true;
    }
  };
  const call=(path,method,key,body)=>api(new Request('http://local/api/campaigns'+path,{
    method,headers:key?{Authorization:'Bearer '+key}:{},body:body?JSON.stringify(body):undefined
  }),store);
  const response=await call('','POST',null,{name:'Mesa de teste',example:true});
  const created=await response.json();
  const memberKey='1'.repeat(64);
  await call('/'+created.id+'/join','POST',created.invite,{key:memberKey});
  await call('/'+created.id+'/action','POST',memberKey,{action:'characterClaim',data:{id:'lyra'}});
  return {
    id:created.id,rows,assets,store,
    sync:async rev=>(await call('/'+created.id+'/sync?table=1&patrolRev='+rev,'GET',memberKey)).json(),
    asset:(id,master=true)=>call('/'+created.id+'/asset/'+id,'GET',master?created.key:memberKey),
    uploadToken:(data,options={})=>api(new Request('http://local/api/campaigns/'+created.id+'/token-portrait',{method:'POST',headers:{Authorization:'Bearer '+(options.master===false?memberKey:created.key),'Content-Type':options.type||'image/png','X-File-Name':encodeURIComponent('Retrato da criatura.png'),'X-Token-Data':encodeURIComponent(JSON.stringify(data)),...(data.sceneId?{'X-Scene-Id':data.sceneId}:{})},body:options.body||new Uint8Array([137,80,78,71])}),store),
    upload:(headers,master=true)=>api(new Request('http://local/api/campaigns/'+created.id+'/map',{method:'POST',headers:{Authorization:'Bearer '+(master?created.key:memberKey),'Content-Type':'image/png',...headers},body:new Uint8Array([137,80,78,71])}),store),
    act:(action,data,master=true)=>call('/'+created.id+'/action','POST',master?created.key:memberKey,{action,data}),
    view:async(master=true)=>(await call('/'+created.id,'GET',master?created.key:memberKey)).json()
  };
}

test('normaliza campanha antiga sem alterar dados e mantém posições',async()=>{
  const state={};
  assert.equal(normalizeTable(state).grid.columns,16);
  assert.equal(state.table,undefined);
  const room=await mesa();
  const view=await room.view(false);
  assert.equal(view.state.tokens[0].x,4);
  assert.equal(view.state.tokens[0].size,1);
  assert.equal(view.state.table.fog.enabled,false);
  assert.equal(room.rows.get(room.id).state.table,undefined);
});

test('névoa mantém tokens rastreáveis e somente ocultação manual e bloqueio restringem movimento',async()=>{
  const room=await mesa();
  assert.equal((await room.act('tokenUpdate',{id:'lyra',hidden:true})).status,200);
  assert.equal((await room.act('combatSet',{entries:[{name:'Lyra secreta',value:20,tokenId:'lyra'},{name:'Dorian',value:10,tokenId:'dorian'}]})).status,200);
  let player=await room.view(false);
  assert.ok(player.state.tokens.every(token=>token.id!=='lyra'));
  assert.ok(player.state.table.combat.entries.every(entry=>entry.name!=='Lyra secreta'));
  assert.equal(player.state.table.combat.active,-1);
  assert.equal((await room.act('tokenMove',{id:'lyra',x:1,y:1},false)).status,403);
  assert.equal((await room.act('tokenUpdate',{id:'lyra',hidden:false,locked:true})).status,200);
  assert.equal((await room.act('tokenMove',{id:'lyra',x:1,y:1},false)).status,403);
  assert.equal((await room.act('tableFog',{enabled:true})).status,200);
  player=await room.view(false);
  assert.equal(player.state.tokens.length,3);
  assert.equal((await room.act('tableFog',{operation:'reveal',x:0,y:0,width:16,height:10})).status,200);
  assert.equal((await room.act('tokenUpdate',{id:'lyra',locked:false})).status,200);
  assert.equal((await room.act('tokenMove',{id:'lyra',x:1,y:1},false)).status,200);
  assert.equal((await room.act('tableFog',{operation:'hide',x:0,y:0,width:2,height:2})).status,200);
  assert.equal((await room.act('tokenMove',{id:'lyra',x:2,y:2},false)).status,200);
  assert.equal((await room.act('tokenMove',{id:'dorian',x:0,y:0},false)).status,403);
  assert.equal((await room.act('tokenMove',{id:'dorian',x:2,y:2},false)).status,403);
});

test('recortes de névoa preservam áreas externas e não ocultam tokens grandes',async()=>{
  const room=await mesa();
  await room.act('tableFog',{enabled:true,operation:'reveal',x:0,y:0,width:2,height:4});
  await room.act('tableFog',{operation:'reveal',x:2,y:0,width:2,height:4});
  await room.act('tokenUpdate',{id:'lyra',size:4});
  await room.act('tokenMove',{id:'lyra',x:0,y:0});
  let view=await room.view(false);
  assert.ok(view.state.tokens.some(token=>token.id==='lyra'));
  await room.act('tableFog',{operation:'hide',x:1,y:1,width:1,height:1});
  view=await room.view(false);
  assert.ok(view.state.tokens.some(token=>token.id==='lyra'));
  const table=(await room.view()).state.table;
  assert.equal(tokenVisible({x:0,y:0,size:1},table),true);
  assert.equal(tokenVisible({x:1,y:1,size:1},table),true);
});

test('limita geometria, permite desenho e ping e rejeita ações de mestre por jogador',async()=>{
  const room=await mesa();
  assert.equal((await room.act('tableSettings',{grid:{columns:8,rows:6,size:2,unit:'m',snap:false},fogEnabled:false})).status,200);
  assert.equal((await room.act('tokenUpdate',{id:'lyra',size:4})).status,200);
  assert.equal((await room.act('tokenMove',{id:'lyra',x:5,y:2})).status,400);
  assert.equal((await room.act('tokenMove',{id:'lyra',x:2.25,y:1.5})).status,200);
  assert.equal((await room.act('tokenMove',{id:'lyra',x:null,y:1})).status,400);
  assert.equal((await room.act('tokenAdd',{size:'NaN'})).status,400);
  assert.equal((await room.act('tableDrawingAdd',{kind:'line',x:0,y:0,toX:8,toY:6,color:'#aabbcc'})).status,200);
  assert.equal((await room.act('tableDrawingAdd',{kind:'line',x:0,y:0,toX:8,toY:6,color:'url(foo)'})).status,400);
  assert.equal((await room.act('tablePing',{x:2,y:3},false)).status,200);
  for (const action of ['tableSettings','tableFog','tableDrawingClear','tokenUpdate','tokenDelete','combatNext']) {
    assert.equal((await room.act(action,{id:'lyra'},false)).status,403);
  }
});

test('turnos concorrentes preservam a rodada e a sequência',async()=>{
  const room=await mesa();
  await room.act('combatSet',{entries:[{id:'a',name:'A',value:1},{id:'b',name:'B',value:2}]});
  const replies=await Promise.all([room.act('combatNext',{}),room.act('combatNext',{})]);
  assert.ok(replies.every(reply=>reply.status===200));
  const combat=(await room.view()).state.table.combat;
  assert.equal(combat.entries[0].id,'b');
  assert.equal(combat.active,0);
  assert.equal(combat.round,2);
});


test('grade automática acompanha mapas verticais, horizontais e dimensões incompletas',()=>{
  for (const [width,height,cellPixels,columns,rows] of [[1920,1080,100,20,11],[700,1400,70,10,20],[1333,777,100,14,8],[8000,4000,10,80,40]]) {
    const map={id:'map',width,height};
    const grid=mapGrid(map,cellPixels);
    assert.equal(grid.columns,columns);
    assert.equal(grid.rows,rows);
    assert.ok(grid.columns*grid.cellPixels>=width);
    assert.ok(grid.rows*grid.cellPixels>=height);
    assert.equal(normalizeTable({map,table:{grid:{cellPixels}}}).grid.columns,columns);
  }
  assert.equal(mapGrid(null),null);
  const state={map:{id:'map',width:700,height:1400},tokens:[],table:{grid:{cellPixels:70}}};
  mutateTable(state,'tableSettings',{grid:{mode:'manual',columns:20,rows:12}},true);
  assert.equal(state.table.grid.columns,20);
  assert.equal(state.table.grid.rows,12);
  mutateTable(state,'tableSettings',{grid:{mode:'image'}},true);
  assert.equal(state.table.grid.columns,10);
  assert.equal(state.table.grid.rows,20);
  assert.throws(()=>mutateTable(state,'tableSettings',{mapDimensions:{id:'outro',width:20,height:20}},true),error=>error.status===409);
});

test('upload compartilha dimensões e calibração, preserva células quadradas e limpa névoa antiga',async()=>{
  const room=await mesa();
  await room.act('tableFog',{operation:'reveal',enabled:true,x:0,y:0,width:4,height:4});
  await room.act('tableFog',{kind:'brush',operation:'reveal',radius:.4,points:[{x:4.25,y:3.75}]});
  let response=await room.upload({'X-Map-Width':'1400','X-Map-Height':'700','X-Grid-Cell-Size':'70'});
  assert.equal(response.status,201);
  const master=await response.json();
  assert.equal(master.state.map.width,1400);
  assert.equal(master.state.map.height,700);
  assert.equal(master.state.table.grid.columns,20);
  assert.equal(master.state.table.grid.rows,10);
  assert.equal(master.state.table.grid.cellPixels,70);
  assert.equal(master.state.table.fog.enabled,true);
  assert.deepEqual(master.state.table.fog.revealed,[]);
  assert.deepEqual(master.state.table.fog.strokes,[]);
  const player=await room.view(false);
  assert.equal(player.state.table.grid.columns,20);
  assert.equal(player.state.map.width,1400);
  response=await room.upload({'X-Map-Width':'NaN','X-Map-Height':'700'});
  assert.equal(response.status,400);
  response=await room.upload({'X-Map-Width':'100','X-Map-Height':'700','X-Grid-Cell-Size':'0'});
  assert.equal(response.status,400);
  assert.equal(room.assets.size,1);
  assert.equal((await room.upload({},false)).status,403);
});

test('desfazer névoa restaura recortes sem alterar tokens ou enviar histórico aos jogadores',async()=>{
  const room=await mesa();
  await room.act('tableFog',{enabled:true,operation:'reveal',x:0,y:0,width:16,height:10});
  const before=(await room.view()).state.table.fog;
  await room.act('tableFog',{operation:'hide',x:4,y:4,width:1,height:1});
  assert.ok((await room.view(false)).state.tokens.some(token=>token.id==='lyra'));
  assert.equal((await room.act('tableFog',{operation:'undo'},false)).status,403);
  await room.act('tableFog',{operation:'undo'});
  assert.deepEqual((await room.view()).state.table.fog.revealed,before.revealed);
  const player=await room.view(false);
  assert.ok(player.state.tokens.some(token=>token.id==='lyra'));
  assert.equal(player.state.table.fog.history,undefined);
  await room.act('tableFog',{operation:'reset',enabled:true});
  await room.act('tableFog',{operation:'undo'});
  assert.deepEqual((await room.view()).state.table.fog.revealed,before.revealed);
  for(let i=0;i<15;i++) await room.act('tableFog',{enabled:i%2===0});
  assert.equal((await room.view()).state.table.fog.history.length,10);
});

test('desenho livre conserva pontos e rejeita traçados vazios, grandes ou fora da mesa',async()=>{
 const room=await mesa(),points=[{x:1,y:1},{x:1.25,y:1.5},{x:2,y:1.7}];
 assert.equal((await room.act('tableDrawingAdd',{kind:'freehand',points,color:'#aabbcc'})).status,200);
 const drawing=(await room.view(false)).state.table.drawings.at(-1);assert.equal(drawing.kind,'freehand');assert.deepEqual(drawing.points,points);assert.equal(drawing.toX,2);
 for(const invalid of [[],[points[0]],Array.from({length:601},()=>points[0]),[{x:1,y:1},{x:-1,y:0}],[{x:1,y:1},{x:null,y:0}]])assert.equal((await room.act('tableDrawingAdd',{kind:'freehand',points:invalid,color:'#aabbcc'})).status,400);
 assert.equal((await room.act('tableDrawingAdd',{kind:'freehand',points,color:'#aabbcc'},false)).status,403);
});
test('ping usa o autor confiável e elimina marcadores expirados',async()=>{
 const room=await mesa();await room.act('tablePing',{x:2,y:3,name:'Nome falso'},false);
 let ping=(await room.view(false)).state.table.pings.at(-1);assert.equal(ping.name,'Lyra Vesper');assert.ok(Date.now()-ping.at<1500);
 await room.act('tablePing',{x:3,y:2,name:'Outro falso'});assert.equal((await room.view(false)).state.table.pings.at(-1).name,'Mestre');
 const normalized=normalizeTable({table:{pings:[{id:'old',x:1,y:1,at:Date.now()-1600,name:'Antigo'}]}});assert.deepEqual(normalized.pings,[]);
});

test('névoa livre conserva curvas e desfaz o gesto sem esconder tokens',async()=>{
 const room=await mesa(),data={enabled:true,kind:'brush',operation:'reveal',radius:1,points:[{x:3.25,y:4.5},{x:5.25,y:4.5}]};
 assert.equal((await room.act('tableFog',data,false)).status,403);assert.equal((await room.act('tableFog',data)).status,200);
 const before=(await room.view()).state.table.fog;assert.deepEqual(before.strokes[0].points,data.points);assert.equal(before.revealed.length,0);
 assert.ok((await room.view(false)).state.tokens.some(t=>t.id==='lyra'));
 await room.act('tableFog',{kind:'brush',operation:'hide',radius:.1,points:[{x:4.5,y:4.5}]});assert.ok((await room.view(false)).state.tokens.some(t=>t.id==='lyra'));
 await room.act('tableFog',{operation:'undo'});assert.deepEqual((await room.view()).state.table.fog.strokes,before.strokes);
 assert.ok((await room.view(false)).state.tokens.some(t=>t.id==='lyra'));assert.equal((await room.view(false)).state.table.fog.history,undefined);
 await room.act('tableFog',{operation:'reset'});assert.equal((await room.view()).state.table.fog.strokes.length,0);await room.act('tableFog',{operation:'undo'});assert.deepEqual((await room.view()).state.table.fog.strokes,before.strokes);
});
test('retângulo e pincel respeitam a ordem e revelar tudo compacta os traços',async()=>{
 const room=await mesa();await room.act('tableFog',{enabled:true,operation:'reveal',x:0,y:0,width:16,height:10});
 await room.act('tableFog',{kind:'brush',operation:'hide',radius:.8,points:[{x:4.5,y:4.5}]});assert.ok((await room.view(false)).state.tokens.some(t=>t.id==='lyra'));
 await room.act('tableFog',{operation:'reveal',x:4,y:4,width:1,height:1});assert.ok((await room.view(false)).state.tokens.some(t=>t.id==='lyra'));
 await room.act('tableFog',{operation:'hide',x:4,y:4,width:1,height:1});assert.ok((await room.view(false)).state.tokens.some(t=>t.id==='lyra'));
 await room.act('tableFog',{kind:'brush',operation:'reveal',radius:1,points:[{x:4.5,y:4.5}]});assert.ok((await room.view(false)).state.tokens.some(t=>t.id==='lyra'));
 await room.act('tableFog',{operation:'reveal',x:0,y:0,width:16,height:10});const fog=(await room.view()).state.table.fog;assert.equal(fog.strokes.length,0);assert.equal(fog.revealed.length,1);
});
test('pincel rejeita raio, pontos e formatos inválidos sem gravar alterações',async()=>{
 const room=await mesa(),before=(await room.view()).rev;
 const valid={kind:'brush',operation:'reveal',radius:.3,points:[{x:1.25,y:2.75}]};
 for(const patch of [{radius:0},{radius:9},{points:[]},{points:Array(601).fill({x:1,y:1})},{points:[{x:-.1,y:1}]},{points:[{x:1,y:null}]},{kind:'unknown'}])assert.equal((await room.act('tableFog',{...valid,...patch})).status,400);
 assert.equal((await room.view()).rev,before);
});

test('símbolos de token persistem, respeitam permissão e rejeitam conteúdo externo',async()=>{
 const room=await mesa();assert.equal((await room.view()).state.tokens[0].icon,'auto');
 assert.equal((await room.act('tokenUpdate',{id:'lyra',icon:'shield',color:'cyan'})).status,200);
 let token=(await room.view(false)).state.tokens.find(t=>t.id==='lyra');assert.equal(token.icon,'shield');assert.equal(token.color,'cyan');
 assert.equal((await room.act('tokenUpdate',{id:'lyra',icon:'magic'},false)).status,403);
 for(const icon of ['unknown','<svg onload=alert(1)>','https://example.com/icon.svg',null])assert.equal((await room.act('tokenUpdate',{id:'lyra',icon})).status,400);
 assert.equal((await room.act('tokenAdd',{name:'Monstro',icon:'paw',color:'red'})).status,200);assert.ok((await room.view()).state.tokens.some(t=>t.name==='Monstro'&&t.icon==='paw'));
 await room.act('tokenUpdate',{id:'lyra',icon:'initial'});token=(await room.view()).state.tokens.find(t=>t.id==='lyra');assert.equal(token.icon,'initial');
});

test('somente ocultar pelo mestre remove token e iniciativas; alterar névoa nunca muda essa decisão',async()=>{
 const room=await mesa();await room.act('tableFog',{enabled:true,operation:'reset'});
 let player=await room.view(false);assert.equal(player.state.tokens.length,3);assert.equal(player.state.tokens.find(t=>t.id==='lyra').canMove,true);
 await room.act('combatSet',{entries:[{name:'Lyra',value:20,tokenId:'lyra'},{name:'Dorian',value:10,tokenId:'dorian'}]});
 await room.act('tokenUpdate',{id:'lyra',hidden:true});await room.act('tableFog',{operation:'reveal',x:0,y:0,width:16,height:10});
 player=await room.view(false);assert.ok(player.state.tokens.every(t=>t.id!=='lyra'));assert.ok(player.state.table.combat.entries.every(e=>e.tokenId!=='lyra'));
 await room.act('tableFog',{operation:'undo'});assert.ok((await room.view(false)).state.tokens.every(t=>t.id!=='lyra'));
 await room.act('tokenUpdate',{id:'lyra',hidden:false});player=await room.view(false);assert.ok(player.state.tokens.some(t=>t.id==='lyra'));assert.ok(player.state.table.combat.entries.some(e=>e.tokenId==='lyra'));
});


test('retrato próprio é criado com o token, persiste e respeita acesso e ícones',async()=>{
 const room=await mesa();
 const result=await room.uploadToken({name:'Criatura',icon:'auto',characterId:'lyra'});assert.equal(result.status,201);
 const row=await result.json(),token=row.state.tokens.at(-1),portrait=token.portrait;
 assert.equal(portrait.name,'Retrato da criatura.png');assert.equal(portrait.type,'image/png');
 assert.equal((await room.view(false)).state.tokens.find(t=>t.id===token.id).portrait.id,portrait.id);
 assert.equal((await room.asset(portrait.id,false)).status,200);
 await room.act('tokenUpdate',{id:token.id,icon:'shield'});
 assert.equal((await room.view()).state.tokens.find(t=>t.id===token.id).portrait.id,portrait.id);
 await room.act('tokenUpdate',{id:token.id,hidden:true});assert.equal((await room.asset(portrait.id,false)).status,404);assert.equal((await room.asset(portrait.id)).status,200);
 const replacement=await room.uploadToken({id:token.id,name:'Outra criatura',icon:'auto'});assert.equal(replacement.status,201);
 const updated=(await replacement.json()).state.tokens.find(t=>t.id===token.id);
 assert.notEqual(updated.portrait.id,portrait.id);assert.equal(room.assets.has(room.id+'/'+portrait.id),false);
 await room.act('tokenUpdate',{id:token.id,removePortrait:true});assert.equal(room.assets.has(room.id+'/'+updated.portrait.id),false);
 assert.equal((await room.view()).state.tokens.find(t=>t.id===token.id).portrait,undefined);
});

test('importação de retrato é atômica, limitada e exclusiva do mestre',async()=>{
 const room=await mesa(),before=(await room.view()).state.tokens.length;
 assert.equal((await room.uploadToken({name:'Falha'},{master:false})).status,403);
 assert.equal((await room.uploadToken({name:'Falha'},{type:'image/svg+xml'})).status,415);
 assert.equal((await room.uploadToken({name:'Falha'},{body:new Uint8Array(3*1024*1024+1)})).status,413);
 assert.equal((await room.uploadToken({name:'Falha',characterId:'inexistente'})).status,400);
 assert.equal((await room.uploadToken({id:'inexistente'})).status,404);
 assert.equal((await room.act('tokenAdd',{name:'Forjado',portrait:{id:'outro'}})).status,400);
 assert.equal((await room.view()).state.tokens.length,before);assert.equal(room.assets.size,0);
});

test('retratos de cenas preparadas e duplicadas acompanham backup e só são apagados sem referências',async()=>{
 const room=await mesa();await room.act('sceneCreate',{name:'Preparação'});
 const scene=(await room.view()).state.sceneLibrary.scenes.find(s=>s.name==='Preparação');
 const uploaded=await room.uploadToken({sceneId:scene.id,name:'Guardião'});assert.equal(uploaded.status,201);
 const token=(await uploaded.json()).state.tokens[0],portrait=token.portrait;
 assert.equal((await room.asset(portrait.id,false)).status,404);
 assert.ok(backupAssets(room.rows.get(room.id).state).some(asset=>asset.id===portrait.id));
 const original=room.rows.get(room.id),backup=exportCampaignBackup(original,room.store);
 const restored={id:crypto.randomUUID(),state:{}};
 await importCampaignBackup(new Request('http://local',{method:'POST',body:await backup.arrayBuffer()}),room.store,{makeRow:state=>Object.assign(restored,{state})});
 assert.ok(backupAssets(restored.state).some(asset=>asset.id===portrait.id));assert.ok(room.assets.has(restored.id+'/'+portrait.id));
 await room.act('sceneDuplicate',{id:scene.id,name:'Cópia'});
 await room.act('tokenDelete',{sceneId:scene.id,id:token.id});assert.ok(room.assets.has(room.id+'/'+portrait.id));
 const copy=(await room.view()).state.sceneLibrary.scenes.find(s=>s.name==='Cópia');
 await room.act('sceneDelete',{id:copy.id});assert.equal(room.assets.has(room.id+'/'+portrait.id),false);
});

test('jogador encerra o próprio turno uma vez, respeitando vínculos e tokens ocultos',async()=>{
 const room=await mesa();
 const entry={id:'turno',name:'Lyra',tokenId:'lyra',value:15};
 await room.act('combatSet',{entries:[entry]});
 const end=(extra={})=>room.act('combatEndOwn',{entryId:entry.id,round:1,...extra},false);
 const results=await Promise.all([end(),end()]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal((await room.view(false)).state.table.combat.round,2);
 await room.act('tokenUpdate',{id:'lyra',hidden:true});
 assert.equal((await end({round:2})).status,403);
 await room.act('combatSet',{entries:[{...entry,tokenId:''}]});
 assert.equal((await end({characterId:'lyra'})).status,403);
});

test('patrulha é privada, persistente e restrita ao mestre e a NPCs',async()=>{
 const room=await mesa();
 const created=await (await room.act('tokenAdd',{name:'Guarda',x:1,y:1})).json();
 const id=created.state.tokens.at(-1).id;
 const start={id,operation:'start',points:[{x:1,y:1},{x:6,y:1}],mode:'return',speed:1};
 assert.equal((await room.act('tokenPatrol',start,false)).status,403);
 assert.equal((await room.act('tokenPatrol',{...start,id:'lyra'})).status,400);
 assert.equal((await room.act('tokenPatrol',start)).status,200);
 const player=(await room.view(false)).state.tokens.find(t=>t.id===id);
 assert.ok(player.motion);assert.equal(player.patrol,undefined);
 const frame=(await room.sync((await room.view(false)).rev)).state.patrolFrame;
 assert.equal(frame.tokens.find(t=>t.id===id).patrol,undefined);
 assert.deepEqual(frame.tokens.map(t=>t.id),[id]);
 await room.act('tokenPatrol',{id,operation:'pause'});
 const paused=(await room.view()).state.tokens.at(-1);
 assert.equal(paused.motion,undefined);assert.equal(paused.patrol.started,0);
 await room.act('tokenPatrol',{id,operation:'resume'});
 assert.ok((await room.view()).state.tokens.at(-1).motion);
 await room.act('tokenMove',{id,x:2,y:2});
 assert.equal((await room.view()).state.tokens.at(-1).patrol,undefined);
});

test('patrulhas usam distância e tempo para percorrer esquinas, voltar e fechar circuitos',()=>{
 const route={points:[{x:0,y:0},{x:3,y:0},{x:3,y:4}],speed:1,started:1000,offset:0,mode:'return'};
 const xy=(mode,t)=>{const {x,y}=patrolSample({...route,mode},1000+t);return [x,y];};
 assert.deepEqual(xy('return',5000),[3,2]);
 assert.deepEqual(xy('return',9000),[3,2]);
 assert.deepEqual(xy('return',14000),[0,0]);
 assert.deepEqual(xy('loop',12000),[0,0]);
});

test('ambiente da cena é compartilhado, persiste e só o mestre pode alterá-lo',async()=>{
 const room=await mesa(),config={weather:'rain',tone:'dusk',level:'heavy'};
 assert.equal((await room.view()).state.table.atmosphere.weather,'clear');
 assert.equal((await room.act('tableAtmosphere',config,false)).status,403);
 assert.equal((await room.act('tableAtmosphere',config)).status,200);
 assert.equal((await room.act('tableAtmosphere',{...config,weather:'toString'})).status,400);
 assert.deepEqual((await room.view(false)).state.table.atmosphere,{...config,toneOpacity:100});
 assert.equal((await room.act('tablePing',{x:2,y:3,signal:'danger'},false)).status,200);
 assert.equal((await room.view()).state.table.pings.at(-1).signal,'danger');
});

test('tempestade e opacidade zero persistem independentemente da intensidade do clima',async()=>{
 const r=await mesa(),a={weather:'storm',tone:'ice',level:'heavy',toneOpacity:0};
 assert.equal((await r.act('tableAtmosphere',a)).status,200);
 assert.deepEqual((await r.view(false)).state.table.atmosphere,a);
 assert.equal((await r.act('tableAtmosphere',{...a,toneOpacity:101})).status,400);
});

test('paredes, porta aberta e luz acompanham os pixels da imagem ao recalibrar a grade',async()=>{
 const r=await mesa();
 await r.upload({'X-Map-Width':'1333','X-Map-Height':'777','X-Grid-Cell-Size':'100'});
 for(const segment of [{kind:'wall',x:.25,y:.5,toX:9.5,toY:4},{kind:'door',x:9.5,y:4,toX:12.75,toY:4}]){
  assert.equal((await r.act('tableWallAdd',segment)).status,200);
 }
 const door=(await r.view()).state.table.walls[1];
 await r.act('tableDoorSet',{id:door.id,open:true});
 await r.act('tableLightSet',{x:9,y:4,radius:2,angle:35,rotation:90,color:'#ff8800'});
 const original=(await r.view()).state.table;
 for(const pixels of [50,200,100]){
  assert.equal((await r.act('tableSettings',{grid:{cellPixels:pixels}})).status,200);
  const {walls,lights}= (await r.view(false)).state.table;
  assert.deepEqual(walls,original.walls.map(w=>({...w,x:w.x*100/pixels,y:w.y*100/pixels,toX:w.toX*100/pixels,toY:w.toY*100/pixels})));
  assert.equal(lights[0].x*pixels,900);assert.equal(lights[0].radius*pixels,200);
 }
 await r.act('tableSettings',{grid:{mode:'manual',columns:10,rows:10}});
 const cell=1333/10,changed=(await r.view()).state.table.walls[1];
 assert.ok(Math.abs(changed.x*cell-950)<1e-8);
 assert.equal((await r.act('tableDoorSet',{id:door.id,open:false})).status,200);
});

test('nome verdadeiro de token independente fica privado no mapa, retrato e iniciativa',async()=>{
 const r=await mesa(),secret='Duque do Eclipse',alias='Mercador de sal';
 const created=await r.uploadToken({name:secret},{});
 assert.equal(created.status,201);
 const token=(await created.json()).state.tokens.at(-1);
 await r.act('combatSet',{entries:[{id:'merchant',tokenId:token.id,name:secret,value:10}]});
 await r.act('tokenUpdate',{id:token.id,name:alias,realName:secret});
 const master=(await r.view()).state.tokens.at(-1),player=(await r.view(false)).state;
 assert.equal(master.realName,secret);assert.equal(master.name,alias);
 assert.ok(!JSON.stringify(player).includes(secret));assert.equal(player.table.combat.entries[0].name,alias);
 assert.equal(player.tokens.at(-1).name,alias);assert.equal(player.tokens.at(-1).portrait.name,'Retrato do token');
 assert.equal((await r.act('tokenUpdate',{id:token.id,realName:'Alterado'},false)).status,403);
 await r.act('tokenUpdate',{id:token.id,characterId:'lyra'});
 assert.equal((await r.view()).state.tokens.at(-1).realName,undefined);
 assert.equal((await r.view(false)).state.table.combat.entries[0].name,alias);
});

test('condições temporárias acompanham rodadas, próximo turno, retrocesso e sigilo da cena',async()=>{
 const room=await mesa();
 const apply=(id,name,mode,rounds,master=true)=>room.act('tokenCondition',{id,name,mode,rounds},master);
 const timed=async(id,master=false)=>(await room.view(master)).state.tokens.find(token=>token.id===id)?.timedStatuses||[];
 const step=direction=>room.act('combatNext',{direction});
 assert.equal((await apply('lyra','Atordoado','turn')).status,409);
 const entries=[{id:'a',tokenId:'lyra',name:'Lyra',value:15},{id:'b',tokenId:'dorian',name:'Dorian',value:3}];
 await room.act('combatSet',{entries});
 assert.equal((await apply('lyra','Queimando','rounds',2,false)).status,403);
 assert.equal((await apply('lyra','Queimando','rounds',0)).status,400);
 await apply('lyra','Ferido','manual');
 await apply('lyra','Queimando','rounds',2);
 await apply('lyra','Atordoado','turn');
 await apply('dorian','Amedrontado','turn');
 assert.deepEqual((await timed('lyra')).map(c=>c.remaining||c.mode),[2,'turn']);
 await room.act('combatEndOwn',{entryId:'a',round:1},false);
 assert.equal((await timed('dorian'))[0].ending,true);
 await step(1);
 assert.deepEqual(await timed('dorian'),[]);
 assert.deepEqual((await timed('lyra')).map(c=>c.remaining||c.ending),[1,true]);
 await step(1);
 assert.deepEqual((await timed('lyra')).map(c=>c.name),['Queimando']);
 await step(1);
 assert.deepEqual(await timed('lyra'),[]);
 await step(-1);await step(-1);
 assert.equal((await timed('lyra')).length,2);
 const lyra=(await room.view(false)).state.tokens.find(t=>t.id==='lyra');
 assert.deepEqual(lyra.statuses,['Ferido']);assert.equal(lyra.conditionSchedule,undefined);
 await room.act('tokenUpdate',{id:'lyra',hidden:true});
 assert.deepEqual(await timed('lyra'),[]);assert.equal((await timed('lyra',true)).length,2);
 await apply('lyra','Queimando','remove');
 assert.deepEqual((await timed('lyra',true)).map(c=>c.name),['Atordoado']);
 await room.act('combatSet',{entries:[]});
 await room.act('combatSet',{entries});
 assert.deepEqual(await timed('lyra',true),[]);
});

test('colisão contínua respeita tamanho, cantos, pontas e trajetos ao redor da parede',async()=>{
 const {resolveTokenPath}=await import('../token-motion.mjs');
 const wall={x:4,y:0,toX:4,toY:8};
 const grid={columns:24,rows:20},token={x:1,y:1,size:1};
 const move=(to,walls=[wall],piece=token,path=[],snap=false)=>resolveTokenPath(piece,to,{grid,walls},path,snap);
 assert.deepEqual(move({x:18,y:4}),{x:3,y:4});
 assert.deepEqual(move({x:18,y:4},[wall],{...token,size:2}),{x:2,y:4});
 assert.deepEqual(move({x:0,y:1},[wall],{...token,x:12}),{x:4,y:1});
 assert.deepEqual(move({x:12,y:12},[wall,{x:0,y:5,toX:8,toY:5}]),{x:3,y:4});
 assert.deepEqual(move({x:7,y:1},[wall],token,[{x:1,y:10},{x:7,y:10}]),{x:7,y:1});
 assert.deepEqual(move({x:8,y:1},[{...wall,x:4.8,toX:4.8}],token,[],true),{x:3.8,y:1});
 const tip=move({x:5,y:8},[wall],{...token,y:7.7});
 assert.ok(Math.hypot(tip.x+.5-4,tip.y+.5-8)>=.5-1e-8);
 assert.deepEqual(move({x:1,y:1},[wall],{...token,x:3.4}),{x:1,y:1});
});
