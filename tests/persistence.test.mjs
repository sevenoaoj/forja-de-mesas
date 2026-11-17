import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {dataDirectory} from '../data-directory.mjs';
import {backupData} from '../data-backup.mjs';
import {database} from '../storage.mjs';
import {api} from '../api.mjs';

test('diretório padrão persiste entre atualizações e iniciadores; bancos divergentes exigem escolha explícita',()=>{
 const defaults={env:{},home:'/home/player',projectDir:'/app/forja',exists:()=>false};
 const expected='/home/player/.local/share/forja-de-mesas';
 assert.equal(dataDirectory({...defaults,cwd:'/app/forja'}),expected);
 assert.equal(dataDirectory({...defaults,cwd:'/tmp/runtime',projectDir:'/tmp/runtime'}),expected);
 assert.equal(dataDirectory({...defaults,env:{XDG_DATA_HOME:'/dados'}}),'/dados/forja-de-mesas');
 assert.equal(dataDirectory({...defaults,env:{FORJA_DATA_DIR:'./campaigns'},cwd:'/mnt'}),'/mnt/campaigns');
 const exists=p=>p==='/app/forja/.data/forja.sqlite';
 assert.equal(dataDirectory({...defaults,exists}),'/app/forja/.data');
 assert.throws(()=>dataDirectory({...defaults,exists:()=>true}),/dois bancos/);
 assert.equal(dataDirectory({...defaults,env:{FORJA_DATA_DIR:expected},exists:()=>true}),expected);
});

test('campanha e sessões sobrevivem a fechamento do SQLite e backup inclui WAL e arquivos',async()=>{
 const root=await mkdtemp(join(tmpdir(),'forja-persistence-'));
 let db;
 try{
  const path=join(root,'forja.sqlite');db=new DatabaseSync(path);db.exec(await readFile(new URL('../drizzle/0001_campaigns.sql',import.meta.url),'utf8'));db.exec('PRAGMA journal_mode=WAL');
  const store=database({first:(sql,args)=>db.prepare(sql).get(...args),run:(sql,args)=>Number(db.prepare(sql).run(...args).changes)},{});
  const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body?JSON.stringify(body):undefined}),store);
  const campaign=await(await call('','POST',null,{name:'Sessão persistente'})).json();
  const base='/'+campaign.id;
  const created=await call(base+'/action','POST',campaign.key,{action:'sessionCreate',data:{name:'As ruínas',date:'2026-11-16',expectedVersion:0}});assert.equal(created.status,200,await created.clone().text());
  await mkdir(join(root,campaign.id));await writeFile(join(root,campaign.id,'mapa'),'imagem do mapa');
  const snapshot=await backupData(db,root,{keep:2});
  const backup=new DatabaseSync(join(snapshot,'forja.sqlite'),{readOnly:true});
  assert.equal(JSON.parse(backup.prepare('SELECT state FROM campaigns WHERE id=?').get(campaign.id).state).sceneLibrary.sessions.at(-1).name,'As ruínas');backup.close();
  assert.equal(await readFile(join(snapshot,campaign.id,'mapa'),'utf8'),'imagem do mapa');
  await backupData(db,root,{keep:2});await backupData(db,root,{keep:2});
  assert.equal((await readdir(join(root,'backups'))).length,2);
  db.close();db=new DatabaseSync(path);
  const reopened=await(await call(base,'GET',campaign.key)).json();
  assert.equal(reopened.state.name,'Sessão persistente');assert.equal(reopened.state.sceneLibrary.sessions.at(-1).name,'As ruínas');assert.equal(reopened.master,true);
 }finally{db?.close();await rm(root,{recursive:true,force:true});}
});
