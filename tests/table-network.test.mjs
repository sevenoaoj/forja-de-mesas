import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createTableLive} from '../public/table-live.mjs';
const waitFor=async(predicate)=>{const until=Date.now()+4000;while(!predicate()){if(Date.now()>until)throw new Error('Evento da mesa não chegou pelo HTTP.');await new Promise(resolve=>setTimeout(resolve,10));}};
test('servidor Linux transmite dois arrastes HTTP simultâneos e confirma ambas as posições',async t=>{
 const probe=createServer();
 const allowed=await new Promise((resolve,reject)=>{probe.once('error',error=>['EPERM','EACCES'].includes(error.code)?resolve(false):reject(error));probe.listen(0,'127.0.0.1',()=>probe.close(()=>resolve(true)));});
 if(!allowed){t.skip('O ambiente bloqueia a abertura de portas TCP locais.');return;}
 const directory=await mkdtemp(join(tmpdir(),'forja-live-network-'));
 const child=spawn(process.execPath,['server.mjs','--local'],{cwd:new URL('../',import.meta.url),env:{...process.env,FORJA_DATA_DIR:directory,PORT:'0'},stdio:['ignore','pipe','pipe']});
 const lives=[];t.after(async()=>{for(const live of lives)live.disconnect();if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited.catch(()=>{});}await rm(directory,{recursive:true,force:true});});
 let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
 await waitFor(()=>/http:\/\/localhost:\d+/.test(output)||child.exitCode!==null);if(child.exitCode!==null){await new Promise(resolve=>setImmediate(resolve));if(/EPERM|operation not permitted/.test(output+errors)){t.skip('O ambiente bloqueia a abertura de portas TCP locais.');return;}assert.fail(JSON.stringify({exit:child.exitCode,output,errors}));}
 const origin=output.match(/http:\/\/localhost:(\d+)/)[0].replace('localhost','127.0.0.1');
 const call=async(path,options={},access)=>{const response=await fetch(origin+'/api/campaigns'+path,{...options,headers:{...options.headers,...(access?{Authorization:'Bearer '+access.key}:{})}});if(!response.ok)throw Object.assign(new Error(await response.text()),{status:response.status});return response;};
 const post=(path,body,access)=>call(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},access).then(r=>r.json());
 const campaign=await post('',{name:'Teste simultâneo HTTP',example:true}),base='/'+campaign.id,gm={id:campaign.id,key:campaign.key};
 const players=['a','b'].map(key=>({id:campaign.id,key:key.repeat(64)}));
 for(const [index,access] of players.entries()){await post(base+'/join',{key:access.key},{key:campaign.invite});await post(base+'/action',{action:'characterClaim',data:{id:index?'dorian':'lyra'}},access);}
 const events=[[],[]];for(const [index,access] of players.entries()){const live=createTableLive({request:call,onEvent:e=>events[index].push(e)});lives.push(live);live.connect(access);}
 await waitFor(()=>events.every(list=>list.some(e=>e.type==='scene')));
 const started=performance.now();
 for(const [index,live] of lives.entries())live.send({type:'tokenPreview',id:index?'dorian':'lyra',dragId:'http-'+index,seq:1,phase:'move',x:index?8.2:5.2,y:index?5.2:4.2});
 await waitFor(()=>events.every(list=>new Set(list.filter(e=>e.type==='tokenPreview').map(e=>e.id)).size===2));
 t.diagnostic('Duas prévias recebidas pelos dois clientes em '+Math.round(performance.now()-started)+' ms no servidor local de teste.');
 const before=await(await call(base,{},gm)).json();assert.equal(before.state.tokens.find(token=>token.id==='lyra').x,4);
 await Promise.all(players.map((access,index)=>post(base+'/action',{action:'tokenMove',data:{id:index?'dorian':'lyra',dragId:'http-'+index,x:index?8:5,y:index?5:4}},access)));
 await waitFor(()=>events.every(list=>list.filter(e=>e.type==='scene').some(e=>e.state.tokens.find(t=>t.id==='lyra')?.x===5&&e.state.tokens.find(t=>t.id==='dorian')?.x===8)));
});
