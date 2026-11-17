import test from 'node:test';
import assert from 'node:assert/strict';
import {api,sceneView} from '../api.mjs';
import {accessFor} from '../access.mjs';
import {visionSources} from '../vision-model.mjs';
import {characterType,playerVisionSource} from '../model.mjs';
async function room(){
 const rows=new Map(),store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await call('','POST',null,{name:'Personagens e NPCs',example:true})).json(),base='/'+created.id,one='a'.repeat(64),two='b'.repeat(64);
 const action=(action,data,key=created.key)=>call(base+'/action','POST',key,{action,data}),view=async(key=created.key)=>(await call(base,'GET',key)).json();
 for(const [key,id]of [[one,'lyra'],[two,'dorian']]){await call(base+'/join','POST',created.invite,{key});await action('characterClaim',{id},key);}
 return {rows,store,created,base,one,two,call,action,view};
}
async function ok(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
test('mestre define NPC; convidados não escolhem NPC e jogadores não alteram o tipo',async()=>{
 const r=await room();await ok(await r.action('characterType',{id:'mira',characterType:'npc'}));const row=await r.view(r.one),npc=row.state.characters.find(c=>c.id==='mira');assert.equal(npc.characterType,'npc');assert.equal(npc.available,false);assert.equal(npc.access,'summary');assert.equal(npc.values,undefined);
 assert.equal((await r.action('characterClaim',{id:'mira'},r.one)).status,404);assert.equal((await r.action('characterType',{id:'lyra',characterType:'npc'},r.one)).status,403);
 assert.equal((await r.action('character',{id:'lyra',name:'Lyra',characterType:'npc'},r.one)).status,403);assert.equal((await r.action('characterType',{id:'mira',characterType:'bad'})).status,400);
 const saved=await ok(await r.action('character',{name:'Goblin',characterType:'npc'}));assert.equal(saved.state.characters.at(-1).characterType,'npc');assert.equal((await r.view(r.two)).state.characters.at(-1).available,false);
});
test('visão do grupo reúne fichas distintas e personagens sem vínculo; NPCs e tokens ocultos não fornecem visão',async()=>{
 const r=await room();await ok(await r.action('characterType',{id:'mira',characterType:'npc'}));
 let row=await ok(await r.action('character',{name:'Terceiro herói',characterType:'player'}));const id=row.state.characters.at(-1).id;
 await ok(await r.action('tokenAdd',{name:'Herói sem jogador vinculado',characterId:id,x:10,y:2}));await ok(await r.action('tokenAdd',{name:'Independente',x:12,y:5}));await ok(await r.action('tableSettings',{darkness:{enabled:true,mode:'group'}}));
 const sourceIds=view=>visionSources(view).map(t=>t.characterId).sort();for(const key of [r.one,r.two]){
  row=await r.view(key);assert.deepEqual(sourceIds(row),['lyra','dorian',id].sort());assert.equal(row.state.characters.find(c=>c.id===(key===r.one?'dorian':'lyra')).values,undefined);
  const raw=r.rows.get(r.created.id),stream=sceneView(raw,accessFor(raw,key));assert.deepEqual(sourceIds({...row,state:stream.state}),sourceIds(row));
  const poll=await(await r.call(r.base+'/sync?table=1','GET',key)).json();assert.deepEqual(sourceIds(poll),sourceIds(row));
 }
 await ok(await r.action('characterRelease',{id:'dorian'}));assert.ok(sourceIds(await r.view(r.one)).includes('dorian'));
 await ok(await r.action('tokenUpdate',{id:'dorian',hidden:true}));assert.equal(sourceIds(await r.view(r.one)).includes('dorian'),false);
 await ok(await r.action('tableSettings',{darkness:{mode:'individual'}}));assert.deepEqual(sourceIds(await r.view(r.one)),['lyra']);
});
test('converter personagem vinculado em NPC revoga controle e exclui sua visão para o grupo',async()=>{
 const r=await room();await ok(await r.action('tableSettings',{darkness:{enabled:true,mode:'group'}}));await ok(await r.action('characterType',{id:'dorian',characterType:'npc'}));
 assert.equal(r.rows.get(r.created.id).state.characters.find(c=>c.id==='dorian').ownerId,undefined);const own=await r.view(r.two);assert.equal(own.characterId,null);assert.equal(own.needsCharacter,true);assert.equal((await r.action('tokenMove',{id:'dorian',x:7,y:5},r.two)).status,403);
 assert.equal(visionSources(await r.view(r.one)).some(t=>t.characterId==='dorian'),false);await ok(await r.action('characterType',{id:'dorian',characterType:'player'}));assert.equal((await r.view(r.one)).state.characters.find(c=>c.id==='dorian').available,true);
});
test('classificação sobrevive ao backup; fichas antigas continuam jogadores sem depender de ownerId',async()=>{
 const r=await room();await ok(await r.action('characterType',{id:'mira',characterType:'npc'}));const response=await r.call(r.base+'/backup','GET',r.created.key);assert.equal(response.status,200);
 const imported=await api(new Request('http://app/api/campaigns/import',{method:'POST',body:await response.arrayBuffer()}),r.store);assert.equal(imported.status,201,await imported.clone().text());const copy=await imported.json();assert.equal(copy.state.characters.find(c=>c.id==='mira').characterType,'npc');
 const raw=r.rows.get(copy.id).state;assert.equal(raw.characters.find(c=>c.id==='lyra').ownerId,undefined);assert.equal(playerVisionSource(raw,raw.tokens.find(t=>t.id==='lyra')),true);assert.equal(playerVisionSource(raw,raw.tokens.find(t=>t.id==='mira')),false);assert.equal(characterType({name:'Antigo'}),'player');
});
