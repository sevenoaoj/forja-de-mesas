import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {database} from '../storage.mjs';
import {api} from '../api.mjs';
import {createAccessStorage,restoreCampaignIdentity} from '../public/player-access.mjs';

async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'forja-player-session-')),path=join(directory,'forja.sqlite');
 const schema=await readFile(new URL('../drizzle/0001_campaigns.sql',import.meta.url),'utf8');
 let db=new DatabaseSync(path);db.exec(schema);db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 t.after(async()=>{db.close();await rm(directory,{recursive:true,force:true});});
 const store=database({first:(sql,args)=>db.prepare(sql).get(...args),run:(sql,args)=>Number(db.prepare(sql).run(...args).changes)},{});
 const call=(path,method='GET',key,body,headers={})=>api(new Request('https://mesa.example.com/api/campaigns'+path,{method,headers:{...headers,...(key?{Authorization:'Bearer '+key}:{})},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const master=await(await call('','POST',null,{name:'Sessão do Gabriel',example:true})).json(),base='/'+master.id;
 const member='a'.repeat(64),response=await call(base+'/join','POST',master.invite,{key:member});
 const cookieHeaders=response.headers.getSetCookie(),cookie=cookieHeaders.map(c=>c.split(';')[0]).join('; ');
 assert.equal(response.status,200);
 assert.equal((await call(base+'/action','POST',member,{action:'characterClaim',data:{id:'lyra'}})).status,200);
 return {master,base,member,cookie,cookieHeaders,call,store,restart(){db.close();db=new DatabaseSync(path);db.exec(schema);},raw:()=>JSON.parse(db.prepare('SELECT state FROM campaigns WHERE id=?').get(master.id).state)};
}

test('reiniciar banco preserva jogador, personagem, diário e cookie; convite não cria outra identidade',async t=>{
 const f=await fixture(t);
 await f.call(f.base+'/action','POST',f.member,{action:'character',data:{id:'lyra',name:'Gabriel',values:{f1:'7'},color:'jade'}});
 await f.call(f.base+'/action','POST',f.member,{action:'journalSave',data:{title:'Inventário de Gabriel',body:'Duas poções',kind:'item'}});
 const before=f.raw(),owner=before.characters.find(c=>c.id==='lyra').ownerId;
 for(let attempt=0;attempt<5;attempt++){f.restart();assert.deepEqual(f.raw(),before);}
 const response=await f.call(f.base+'/session','GET',f.master.invite,undefined,{Cookie:f.cookie});
 const restored=await response.json();assert.equal(response.status,200);assert.equal(restored.key,f.member);assert.equal(restored.characterId,'lyra');assert.equal(restored.master,false);
 const character=restored.state.characters.find(c=>c.id==='lyra');assert.equal(character.name,'Gabriel');assert.equal(character.values.f1,'7');assert.equal(restored.state.journal[0].body,'Duas poções');
 assert.equal(f.raw().characters.find(c=>c.id==='lyra').ownerId,owner);assert.equal(f.raw().members.length,1);
 const again=await f.call(f.base+'/join','POST',f.master.invite,{key:'b'.repeat(64)},{Cookie:f.cookie});
 assert.equal((await again.json()).characterId,'lyra');assert.equal(f.raw().members.length,1);
 assert.equal(f.cookieHeaders.length,2);for(const header of f.cookieHeaders){assert.match(header,/HttpOnly/);assert.match(header,/Max-Age=31536000/);assert.match(header,/Secure/);assert.match(header,/SameSite=Lax/);}
});

test('cookie recupera sessão com armazenamento local vazio antes de gerar nova chave',async t=>{
 const f=await fixture(t);f.restart();let newKeys=0,joins=0;
 const request=async(path,options,access)=>{const response=await f.call(path,'GET',access?.key,undefined,{Cookie:f.cookie});if(!response.ok)throw Object.assign(new Error('Sessão indisponível'),{status:response.status});return response;};
 const result=await restoreCampaignIdentity({id:f.master.id,key:f.master.invite},{request,post:()=>{joins++;},read:()=>null,write(){},makeKey:()=>{newKeys++;return 'b'.repeat(64);}});
 assert.equal(result.access.key,f.member);assert.equal(result.row.characterId,'lyra');assert.equal(newKeys,0);assert.equal(joins,0);
 const index=await(await f.call('/session','GET',null,undefined,{Cookie:f.cookie})).json();assert.equal(index.id,f.master.id);
 const noKey=await restoreCampaignIdentity({id:index.id},{request,read:()=>null});assert.equal(noKey.row.characterId,'lyra');
});

test('sessão não libera mutações por cookie, nem acesso a outra campanha ou recuperação por outro jogador',async t=>{
 const f=await fixture(t),headers={Cookie:f.cookie};
 assert.equal((await f.call(f.base+'/action','POST',null,{action:'characterRelease',data:{id:'lyra'}},headers)).status,403);
 assert.equal((await f.call('/00000000-0000-0000-0000-000000000000/session','GET',null,undefined,headers)).status,401);
 assert.equal((await f.call(f.base+'/player-access','POST',f.member,{characterId:'lyra'})).status,403);
 assert.equal((await f.call(f.base+'/session','GET',null,undefined,{...headers,'Sec-Fetch-Site':'cross-site'})).status,403);
 const recovered=await(await f.call(f.base+'/player-access','POST',f.master.key,{characterId:'lyra'})).json();
 assert.equal(recovered.code,f.master.id+'.'+f.member);
 const existing=await(await f.call(f.base+'/session','GET',f.member)).json();assert.equal(existing.characterId,'lyra');assert.equal(existing.master,false);
 const ownView=await(await f.call(f.base,'GET',f.member)).json();assert.equal(ownView.state.members,undefined);assert.ok(!JSON.stringify(ownView).includes(f.member));
});

test('armazenamento bloqueado mantém acesso em memória e chave secundária evita nova identidade',async()=>{
 const storage=createAccessStorage(()=>({getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}}));
 assert.equal(storage.write('forja.active','campaign'),false);assert.equal(storage.read('forja.active'),'campaign');storage.remove('forja.active');assert.equal(storage.read('forja.active'),null);
 const member='a'.repeat(64);let submitted;
 const result=await restoreCampaignIdentity({id:'campaign',key:'invite'},{
  request:async path=>{if(path.endsWith('/session'))throw Object.assign(new Error('Servidor anterior'),{status:404});return Response.json({role:'guest'});},
  read:key=>key==='forja.campaigns'?{campaign:{key:member}}:null,write(){},makeKey(){throw new Error('Não deveria gerar outra identificação.');},
  post:async(path,data)=>{submitted=data.key;return {key:member,characterId:'gabriel'};}
 });
 assert.equal(submitted,member);assert.equal(result.access.key,member);
});
