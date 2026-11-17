import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {database} from '../storage.mjs';
import {api} from '../api.mjs';
async function setup() {
 const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../drizzle/0001_campaigns.sql',import.meta.url),'utf8'));
 const assets=new Map();
 const store=database({first:(sql,args)=>db.prepare(sql).get(...args),run:(sql,args)=>Number(db.prepare(sql).run(...args).changes)},{async putAsset(key,blob){assets.set(key,blob);},async getAsset(key){return assets.get(key);},async deleteAsset(key){assets.delete(key);},async deleteCampaignAssets(id){for(const key of assets.keys())if(key.startsWith(id+'/'))assets.delete(key);}});
 const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await call('','POST',null,{name:'Teste descartável'})).json();
 return {db,store,assets,call,created};
}
test('campanha começa vazia e exclusão exige criador e confirmação do nome',async()=>{
 const r=await setup(),base='/'+r.created.id;
 try {
  assert.equal(r.created.state.characters.length,0);
  assert.equal(r.created.state.example,false);
  assert.equal((await r.call(base,'DELETE',r.created.invite,{name:r.created.state.name})).status,403);
  assert.equal((await r.call(base,'DELETE',r.created.key,{name:'outro nome'})).status,400);
  assert.ok(await r.store.get(r.created.id));
  r.assets.set(r.created.id+'/book',new Blob(['book']));
  r.assets.set(r.created.id+'/map',new Blob(['map']));
  r.assets.set('other/asset',new Blob(['keep']));
  const response=await r.call(base,'DELETE',r.created.key,{name:r.created.state.name});
  assert.equal(response.status,200);
  assert.equal((await response.json()).deleted,r.created.id);
  assert.equal(await r.store.get(r.created.id),null);
  assert.equal((await r.call(base,'GET',r.created.invite)).status,403);
  assert.equal((await r.call(base+'/join','POST',r.created.invite,{key:'a'.repeat(64)})).status,403);
  assert.deepEqual([...r.assets.keys()],['other/asset']);
 } finally {r.db.close();}
});
test('exclusão concorrente é rejeitada antes de apagar a campanha ou seus arquivos',async()=>{
 const r=await setup();
 try {
  const stale=await r.store.get(r.created.id);
  const fresh=structuredClone(stale);fresh.state.notes='mudou';assert.equal(await r.store.save(fresh),true);
  assert.equal(await r.store.remove(stale),false);
  assert.ok(await r.store.get(stale.id));
 } finally {r.db.close();}
});

test('SRD só é importado pelo mestre, é compartilhado e não é baixado duas vezes',async()=>{
 const r=await setup(),base='/'+r.created.id,originalFetch=globalThis.fetch;let downloads=0;
 globalThis.fetch=async()=>{downloads++;return new Response('%PDF-1.7\nSRD fixture',{headers:{'Content-Type':'application/pdf'}});};
 try {
  assert.equal((await r.call(base+'/srd','POST',r.created.invite)).status,403);
  assert.equal(downloads,0);
  let response=await r.call(base+'/srd','POST',r.created.key);
  assert.equal(response.status,200);
  const row=await response.json(),book=row.state.books[0];
  assert.equal(book.source,'srd-5.2.1');assert.equal(r.assets.size,1);
  assert.equal((await r.call(base+'/asset/'+book.id,'GET',r.created.invite)).status,200);
  response=await r.call(base+'/srd','POST',r.created.key);
  assert.equal(response.status,200);assert.equal(downloads,1);assert.equal(r.assets.size,1);
 } finally {globalThis.fetch=originalFetch;r.db.close();}
});
test('falha no download do livro não cria arquivo ou referência inválida',async()=>{
 const r=await setup(),originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response('<html>erro</html>');
 try {
  assert.equal((await r.call('/'+r.created.id+'/srd','POST',r.created.key)).status,502);
  assert.equal(r.assets.size,0);assert.equal((await r.store.get(r.created.id)).state.books.length,0);
 } finally {globalThis.fetch=originalFetch;r.db.close();}
});
