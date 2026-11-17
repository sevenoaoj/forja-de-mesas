import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {backupLimit} from '../campaign-backup.mjs';
import {mutateScenes} from '../scene-model.mjs';
async function fixture(){
 const rows=new Map(),assets=new Map();let failWrite=false,failCreate=false;
 const store={async get(id){return structuredClone(rows.get(id));},async create(row){if(failCreate)throw new Error('disk full');rows.set(row.id,structuredClone(row));},async save(row){rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;},async putAsset(key,blob){assets.set(key,blob);if(failWrite)throw new Error('upload failed');},async getAsset(key){return assets.get(key)||null;},async deleteAsset(key){assets.delete(key);}};
 const call=(path='',{key,method='GET',body,headers={}}={})=>api(new Request('http://app/api/campaigns'+path,{method,headers:{...headers,...(key?{Authorization:'Bearer '+key}:{})},body,...(body instanceof ReadableStream?{duplex:'half'}:{})}),store);
 const created=await(await call('',{method:'POST',body:JSON.stringify({name:'Campanha a guardar',example:true})})).json();
 const state=rows.get(created.id).state;
 state.inventory=[{id:'prepared',version:1,name:'Relíquia',characterId:null,gmNotes:'Segredo item',quantity:1,weight:2},{id:'owned',version:1,name:'Relíquia',characterId:'lyra',sourceId:'prepared',journalId:'clue',portrait:'https://example.com/item.png',quantity:2,weight:2}];
 state.notes='Segredo do mestre';state.members=[{id:'member-one',key:'a'.repeat(64)}];state.characters[0].ownerId='member-one';state.characters[1].hidden=true;state.characters[0].portrait={id:crypto.randomUUID(),name:'Herói.png',type:'image/png',size:4};
 state.map={id:crypto.randomUUID(),name:'Mapa.webp',type:'image/webp',size:5};
 state.books=[{id:crypto.randomUUID(),name:'Regras.pdf',type:'application/pdf',size:6}];
 state.audio={clips:[{id:crypto.randomUUID(),name:'Efeito.ogg',type:'audio/ogg',size:7}],cues:[{id:'old-cue'}],track:{video:'abcdefghijk',playing:true},music:{sessions:[{id:'night',name:'Noite',tracks:[]}],selected:'night'}};
 state.journal=[{id:'clue',version:1,title:'Pista',body:'Texto',kind:'clue',audience:'selected',recipientIds:['lyra'],gmNotes:'Só mestre'}];
 state.sheetTemplates={version:1,items:[{id:'tpl',version:1,name:'Privado',owner:'member-one',shared:false,fields:state.fields,skills:[],abilities:[],rollButtons:[],masteries:[]}]};
 mutateScenes(state,'sessionCreate',{name:'Sessão 2'},true);const sessionId=state.sceneLibrary.sessions.at(-1).id;mutateScenes(state,'sceneCreate',{name:'Castelo secreto',sessionId},true);const scene=state.sceneLibrary.scenes.at(-1);scene.map={id:crypto.randomUUID(),name:'Castelo.png',type:'image/png',size:8};
 const refs=[state.map,state.books[0],state.audio.clips[0],state.characters[0].portrait,scene.map];for(const [i,asset]of refs.entries())assets.set(created.id+'/'+asset.id,new Blob([new Uint8Array(asset.size).fill(i+1)],{type:asset.type}));
 return {rows,assets,store,call,created,state,refs,failWrite(){failWrite=true;},failCreate(){failCreate=true;},async download(key=created.key){return call('/'+created.id+'/backup',{key});},async archive(){return new Uint8Array(await(await this.download()).arrayBuffer());},async restore(bytes,headers={}){return call('/import',{method:'POST',body:bytes,headers});}};
}
async function rewriteHeader(bytes,change){const offset=new TextEncoder().encode('FORJA-BACKUP/1\n').length,length=Number(new TextDecoder().decode(bytes.slice(offset,offset+9))),start=offset+9;const bundle=JSON.parse(new TextDecoder().decode(bytes.slice(start,start+length)));change(bundle);const header=new TextEncoder().encode(JSON.stringify(bundle));return new Uint8Array(await new Blob([bytes.slice(0,offset),new TextEncoder().encode(String(header.length).padStart(8,'0')+'\n'),header,new Uint8Array(await crypto.subtle.digest('SHA-256',header)),bytes.slice(start+length+32)]).arrayBuffer());}
test('backup completo restaura como cópia com arquivos, cenas privadas e novos acessos',async()=>{
 const r=await fixture(),original=structuredClone(r.rows.get(r.created.id)),response=await r.download();assert.equal(response.status,200);assert.match(response.headers.get('Content-Disposition'),/\.forja/);
 const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(Number(response.headers.get('Content-Length')),bytes.length);assert.equal(new TextDecoder().decode(bytes).includes('a'.repeat(64)),false);assert.equal(new TextDecoder().decode(bytes).includes(r.created.key),false);
 const restored=await r.restore(bytes);assert.equal(restored.status,201,await restored.clone().text());const copy=await restored.json();assert.notEqual(copy.id,r.created.id);assert.notEqual(copy.key,r.created.key);assert.notEqual(copy.invite,r.created.invite);assert.equal(copy.state.name,original.state.name);assert.equal(copy.state.notes,'Segredo do mestre');assert.equal(copy.state.characters[1].hidden,true);assert.equal(copy.state.journal[0].gmNotes,'Só mestre');assert.equal(copy.state.sceneLibrary.scenes.length,2);
 const raw=r.rows.get(copy.id);assert.deepEqual(raw.state.members,[]);assert.ok(raw.state.characters.every(c=>!c.ownerId));assert.equal(raw.state.sheetTemplates.items[0].owner,'gm');assert.equal(raw.state.audio.track,null);assert.deepEqual(raw.state.audio.cues,[]);assert.equal(raw.state.audio.music.sessions[0].name,'Noite');
 for(const asset of r.refs)assert.deepEqual(new Uint8Array(await r.assets.get(copy.id+'/'+asset.id).arrayBuffer()),new Uint8Array(await r.assets.get(r.created.id+'/'+asset.id).arrayBuffer()));
 assert.deepEqual(r.rows.get(r.created.id),original);assert.equal((await r.call('/'+copy.id,{key:r.created.key})).status,403);
 // A restored master can immediately export again.
 assert.equal((await r.call('/'+copy.id+'/backup',{key:copy.key})).status,200);
});
test('somente mestre exporta: convite, jogador e visitante não recebem dados',async()=>{
 const r=await fixture();for(const key of [null,r.created.invite,'a'.repeat(64),'bad'])assert.equal((await r.download(key)).status,403);
});
test('arquivo de acesso, versão inválida, excesso e arquivos truncados são recusados sem gravar campanha',async()=>{
 const r=await fixture(),bytes=await r.archive(),size=r.assets.size;
 for(const bad of [new TextEncoder().encode(r.created.id+'.'+r.created.key),bytes.slice(0,20),bytes.slice(0,-1),await rewriteHeader(bytes,b=>b.version=99),new Uint8Array([...bytes,1])]){const result=await r.restore(bad);assert.equal(result.status,400,await result.clone().text());assert.equal(r.rows.size,1);assert.equal(r.assets.size,size);}
 assert.equal((await r.restore(bytes,{'Content-Length':String(backupLimit+1)})).status,413);
});
test('checksum detecta corrupção de estado e arquivos, removendo uploads parciais',async()=>{
 const r=await fixture(),bytes=await r.archive(),size=r.assets.size;
 const header=bytes.slice();header[40]^=1;assert.equal((await r.restore(header)).status,400);
 const asset=bytes.slice();asset[asset.length-34]^=1;assert.equal((await r.restore(asset)).status,400);assert.equal(r.assets.size,size);assert.equal(r.rows.size,1);
});
test('manifesto não aceita path traversal, arquivos extras, MIME inválido ou estrutura incompatível',async()=>{
 const r=await fixture(),bytes=await r.archive();
 for(const change of [b=>b.state.books[0].id='../../forja.sqlite',b=>b.assets.push(b.assets[0]),b=>b.state.books[0].type='text/html',b=>b.state.characters={},b=>b.state.sceneLibrary.activeId='absent',b=>b.state.characters[0].values=JSON.parse('{"__proto__":{}}')]){
  const result=await r.restore(await rewriteHeader(bytes,change));assert.equal(result.status,400,await result.clone().text());assert.equal(r.rows.size,1);
 }
});
test('falha em upload ou criação limpa apenas a cópia incompleta, sem apagar dados originais',async()=>{
 for(const trigger of ['failWrite','failCreate']){const r=await fixture(),bytes=await r.archive(),size=r.assets.size;r[trigger]();const log=console.error;console.error=()=>{};let response;try{response=await r.restore(bytes);}finally{console.error=log;}assert.equal(response.status,500);assert.equal(r.rows.size,1);assert.equal(r.assets.size,size);}
});
test('backup detecta arquivo ausente ou tamanho divergente em vez de gerar recuperação incompleta',async()=>{
 for(const missing of [true,false]){const r=await fixture(),key=r.created.id+'/'+r.refs[0].id;if(missing)r.assets.delete(key);else r.assets.set(key,new Blob(['wrong size']));const response=await r.download();await assert.rejects(response.arrayBuffer());}
});
test('campanha vazia sem uploads pode ser exportada e restaurada',async()=>{
 const r=await fixture(),created=await(await r.call('',{method:'POST',body:JSON.stringify({name:'Vazia'})})).json(),file=await(await r.call('/'+created.id+'/backup',{key:created.key})).arrayBuffer();assert.equal((await r.restore(file)).status,201);
});

test('transporte em streams funciona com uploads do storage hospedado e cabeçalho fragmentado',async()=>{
 const r=await fixture();r.store.getAsset=async key=>r.assets.get(key)?.stream()||null;
 const bytes=await r.archive();let offset=0,reads=0;
 const stream=new ReadableStream({pull(controller){if(offset===bytes.length){controller.close();return;}const count=[1,2,7,67][reads++%4];controller.enqueue(bytes.slice(offset,offset+count));offset=Math.min(offset+count,bytes.length);}});
 const response=await r.restore(stream);assert.equal(response.status,201,await response.clone().text());assert.ok(reads>100);
 const copy=await response.json();for(const asset of r.refs)assert.equal(r.assets.get(copy.id+'/'+asset.id).size,asset.size);
});

test('backup preserva catálogo, cópias, retratos e vínculos do inventário',async()=>{const r=await fixture();const response=await r.restore(await r.archive());assert.equal(response.status,201);const restored=await response.json();assert.deepEqual(r.rows.get(restored.id).state.inventory,r.state.inventory);});
