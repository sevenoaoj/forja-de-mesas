import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {itemPortraits} from '../item-assets.mjs';
import {itemEditor,itemDetails} from '../public/inventory.mjs';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2xQAAAAASUVORK5CYII=','base64'));
async function room(){
 const rows=new Map(),assets=new Map();let failPut=false;
 const store={async get(id){return structuredClone(rows.get(id));},async create(row){rows.set(row.id,structuredClone(row));},async save(row){if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;},async putAsset(key,blob){assets.set(key,blob);if(failPut)throw new Error('disco indisponível');},async getAsset(key){return assets.get(key)||null;},async deleteAsset(key){assets.delete(key);}};
 const call=(path,method,key,body,headers={})=>api(new Request('http://app/api/campaigns'+path,{method,headers:{...headers,...(key?{Authorization:'Bearer '+key}:{})},body}),store);
 const created=await(await call('','POST',null,JSON.stringify({name:'Imagens dos itens',example:true}))).json(),base='/'+created.id,one='a'.repeat(64),two='b'.repeat(64);
 const action=(action,data,key=created.key)=>call(base+'/action','POST',key,JSON.stringify({action,data}));
 for(const [key,id]of [[one,'lyra'],[two,'dorian']]){await call(base+'/join','POST',created.invite,JSON.stringify({key}));await action('characterClaim',{id},key);}
 return {rows,assets,store,created,base,one,two,call,action,failPut(){failPut=true;},async view(key=created.key){return(await call(base,'GET',key)).json();},upload(data={name:'Poção',kind:'consumable'},file=new Blob([png],{type:'image/png'}),key=created.key){const form=new FormData();form.set('data',JSON.stringify(data));form.set('file',file,'pocao.png');return call(base+'/item-portrait','POST',key,form);},asset(id,key=created.key){return call(base+'/asset/'+id,'GET',key);}};
}
async function good(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json();}
const fields=item=>{const {portrait,...data}=item;return data;};
test('mestre cria item e envia imagem em uma operação; somente portador ou loot revelado permite acesso',async()=>{
 const r=await room(),row=await good(await r.upload(),201),item=row.state.inventory[0],image=item.portrait;
 assert.equal(image.type,'image/png');assert.equal(image.size,png.length);assert.equal((await r.asset(image.id)).status,200);assert.equal((await r.asset(image.id,r.one)).status,404);assert.equal((await r.asset(image.id,r.two)).status,404);
 await good(await r.action('itemGrant',{id:item.id,version:item.version,characterId:'lyra',quantity:1}));assert.equal((await r.asset(image.id,r.one)).status,200);assert.equal((await r.asset(image.id,r.two)).status,404);
 const placed=await good(await r.action('lootPlace',{itemId:item.id,version:item.version,x:5,y:4,revealed:true})),drop=placed.state.tokens.find(t=>t.kind==='item');assert.equal(drop.loot.item.portrait.id,image.id);assert.equal((await r.asset(image.id,r.two)).status,200);
 await good(await r.action('tokenUpdate',{id:drop.id,hidden:true}));assert.equal((await r.asset(image.id,r.two)).status,404);
 assert.deepEqual(new Uint8Array(await(await r.asset(image.id)).arrayBuffer()),png);
});
test('trocar imagem não apaga a usada por cópias ou snapshots; limpeza acontece na última referência',async()=>{
 const r=await room();let row=await good(await r.upload(),201),item=row.state.inventory[0],oldId=item.portrait.id;
 row=await good(await r.action('itemGrant',{id:item.id,version:item.version,characterId:'lyra',quantity:1}));const copy=row.state.inventory.find(i=>i.characterId);
 row=await good(await r.upload({...fields(item),name:'Poção nova'}),201);item=row.state.inventory.find(i=>i.id===item.id);assert.notEqual(item.portrait.id,oldId);assert.equal((await r.asset(oldId,r.one)).status,200);
 await good(await r.action('itemDelete',{id:copy.id,version:copy.version},r.one));assert.equal(r.assets.has(r.created.id+'/'+oldId),false);
 await good(await r.action('itemSave',{...fields(item),removePortrait:true}));assert.equal(itemPortraits(r.rows.get(r.created.id).state).length,0);assert.equal(r.assets.size,0);
});
test('imagem de recompensa continua após apagar catálogo e coletar item, com acesso privado ao portador',async()=>{
 const r=await room(),row=await good(await r.upload(),201),item=row.state.inventory[0];
 const placed=await good(await r.action('lootPlace',{itemId:item.id,version:item.version,x:5,y:4,revealed:true})),drop=placed.state.tokens.find(t=>t.kind==='item');await good(await r.action('itemDelete',{id:item.id,version:item.version}));assert.equal(r.assets.size,1);
 const collected=await good(await r.action('lootCollect',{id:drop.id,version:1},r.one));assert.equal(collected.state.inventory.find(i=>i.id===collected.pickup.itemId).portrait.id,item.portrait.id);assert.equal((await r.asset(item.portrait.id,r.one)).status,200);assert.equal((await r.asset(item.portrait.id,r.two)).status,404);
});
test('jogadores não enviam imagem; URL ou referência forjada não substituem upload',async()=>{
 const r=await room();for(const key of [r.one,r.two,r.created.invite])assert.equal((await r.upload({name:'Tentativa'},undefined,key)).status,403);
 for(const portrait of ['https://example.com/a.png',{id:crypto.randomUUID(),type:'image/png',size:10}])assert.equal((await r.action('itemSave',{name:'Forjado',portrait})).status,400);
 assert.equal(r.assets.size,0);assert.equal((await r.view()).state.inventory.length,0);
});
test('tipo, assinatura e tamanho são conferidos, e falhas não deixam imagem órfã nem item parcial',async()=>{
 const r=await room();assert.equal((await r.upload({name:'SVG'},new Blob(['<svg/>'],{type:'image/svg+xml'}))).status,415);assert.equal((await r.upload({name:'Falso'},new Blob(['não é png'],{type:'image/png'}))).status,415);assert.equal((await r.upload({name:'Grande'},new Blob([new Uint8Array(3*1024*1024+1)],{type:'image/png'}))).status,413);
 assert.equal((await r.upload({name:''})).status,400);assert.equal(r.assets.size,0);assert.equal((await r.view()).state.inventory.length,0);
 const row=await good(await r.upload(),201),item=row.state.inventory[0];assert.equal((await r.upload({...fields(item),version:0})).status,409);assert.equal(r.assets.size,1);
 r.failPut();const error=console.error;console.error=()=>{};try{assert.equal((await r.upload({name:'Falha'})).status,500);}finally{console.error=error;}assert.equal(r.assets.size,1);
});
test('backup inclui retratos do inventário e de cenas privadas, preservando os bytes na restauração',async()=>{
 const r=await room(),row=await good(await r.upload(),201),item=row.state.inventory[0];
 await good(await r.action('sceneCreate',{name:'Sala privada',sessionId:'session-initial'}));const scene=(await r.view()).state.sceneLibrary.scenes.at(-1);await good(await r.action('lootPlace',{itemId:item.id,version:item.version,sceneId:scene.id,x:1,y:1}));await good(await r.action('itemDelete',{id:item.id,version:item.version}));
 const response=await r.call(r.base+'/backup','GET',r.created.key);assert.equal(response.status,200);const restored=await api(new Request('http://app/api/campaigns/import',{method:'POST',body:await response.arrayBuffer()}),r.store),copy=await good(restored,201);
 assert.equal(itemPortraits(r.rows.get(copy.id).state).length,1);assert.deepEqual(new Uint8Array(await r.assets.get(copy.id+'/'+item.portrait.id).arrayBuffer()),png);
});
test('formulário pede arquivo e imagem local usa carregamento autenticado, sem campo de URL',()=>{
 const ui={esc:v=>String(v??''),input:(name,label,value)=>'<input name="'+name+'" value="'+String(value??'')+'">',area:()=>'',select:()=>'',submit:()=>'',button:()=>''},row={master:true,state:{journal:[]}},item={id:'i',name:'Poção',kind:'consumable',portrait:{id:'image-id'},weight:0};
 const html=itemEditor(item,row,ui);assert.match(html,/type="file" name="portraitFile"/);assert.match(html,/data-portrait="image-id"/);assert.doesNotMatch(html,/URL do retrato|name="portrait"|type="url"/);assert.match(itemDetails(item,row,ui),/data-portrait="image-id"/);
});
