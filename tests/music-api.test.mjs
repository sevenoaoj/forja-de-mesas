import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {audioView,changeMusic,musicCommand,normalizeMusic} from '../music-model.mjs';
import {effectiveTrack,musicGain,elapsed} from '../media.mjs';

const videoA='M7lc1UVf-VE';
const videoB='bHQqvYy5KYo';

async function room() {
  const rows=new Map();
  const store={
    async get(id){return structuredClone(rows.get(id));},
    async create(row){rows.set(row.id,structuredClone(row));},
    async save(row){
      await Promise.resolve();
      if (rows.get(row.id).rev!==row.rev) return false;
      rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;
    }
  };
  const request=(path,method,key,data)=>api(new Request('http://local/api/campaigns'+path,{
    method,headers:key?{Authorization:'Bearer '+key}:{},body:data===undefined?undefined:JSON.stringify(data)
  }),store);
  const master=await (await request('','POST',null,{name:'Sessão musical',example:true})).json();
  const base='/'+master.id;
  const member='d'.repeat(64);
  await request(base+'/join','POST',master.invite,{key:member});
  await request(base+'/action','POST',member,{action:'characterClaim',data:{id:'lyra'}});
  return {
    master,member,rows,
    action:(action,data={},key=master.key)=>request(base+'/action','POST',key,{action,data}),
    view:async(key=master.key)=>(await request(base,'GET',key)).json(),
    sync:async(key=master.key)=>(await request(base+'/sync','GET',key)).json()
  };
}

function repertoire() {
  const audio={clips:[],cues:[],track:null};
  changeMusic(audio,'musicSessionSave',{name:'Sessão preparada pelo mestre'});
  const sessionId=audio.music.activeSessionId;
  changeMusic(audio,'musicTrackSave',{sessionId,url:videoA,title:'Música A',tag:'Exploração'});
  changeMusic(audio,'musicTrackSave',{sessionId,url:videoB,title:'Música B',tag:'Tensão'});
  return {audio,sessionId,first:audio.music.sessions[0].tracks[0].id,second:audio.music.sessions[0].tracks[1].id};
}

test('legado é normalizado sem alterar estado e repertório começa vazio',()=>{
  const legacy={clips:[],cues:[],track:{video:videoA,title:'Escolhida antes',position:0,playing:true,changed:10}};
  const before=structuredClone(legacy);
  assert.deepEqual(normalizeMusic(legacy),{sessions:[],activeSessionId:'',fadeIn:3,fadeOut:3,volume:70});
  assert.deepEqual(legacy,before);
  assert.equal(audioView(legacy,true).track.title,'Escolhida antes');
  assert.deepEqual(audioView(undefined,false).music,{fadeIn:3,fadeOut:3,volume:70});
});

test('mestre prepara, reordena e edita músicas sem começar a reprodução',async()=>{
  const r=await room();
  assert.equal((await r.action('musicSessionSave',{name:'A próxima sessão'})).status,200);
  let view=await r.view();
  const sessionId=view.state.audio.music.activeSessionId;
  assert.equal((await r.action('musicTrackSave',{sessionId,url:videoA,title:'Primeira',tag:'Calma'})).status,200);
  assert.equal((await r.action('musicTrackSave',{sessionId,url:videoB,title:'Segunda',tag:'Combate'})).status,200);
  view=await r.view();
  assert.equal(view.state.audio.track,null);
  const [first,second]=view.state.audio.music.sessions[0].tracks;
  await r.action('musicTrackMove',{sessionId,id:second.id,direction:-1});
  await r.action('musicTrackSave',{sessionId,id:first.id,url:videoA,title:'Primeira renomeada',tag:''});
  view=await r.view();
  assert.deepEqual(view.state.audio.music.sessions[0].tracks.map(track=>track.id),[second.id,first.id]);
  assert.equal(view.state.audio.music.sessions[0].tracks[1].title,'Primeira renomeada');
  await r.action('track',{command:'loadSaved',sessionId,id:first.id});
  view=await r.view();
  assert.deepEqual(view.state.audio.track.source,{sessionId,itemId:first.id});
  const playing=structuredClone(view.state.audio.track);
  await r.action('musicTrackDelete',{sessionId,id:first.id});
  await r.action('musicSessionDelete',{id:sessionId});
  view=await r.view();
  assert.deepEqual(view.state.audio.track,playing);
  assert.deepEqual(view.state.audio.music.sessions,[]);
});

test('repertório futuro é privado e jogadores não controlam sessões, faixas ou configurações',async()=>{
  const r=await room();
  await r.action('musicSessionSave',{name:'Encontro secreto'});
  const sessionId=(await r.view()).state.audio.music.activeSessionId;
  await r.action('musicTrackSave',{sessionId,url:videoA,title:'Tema do inimigo secreto',tag:'Spoiler'});
  assert.equal((await r.sync()).state.audio.music.sessions,undefined);
  assert.equal((await r.sync()).master,true);
  for (const key of [r.member,r.master.invite]) {
    const view=await r.view(key),sync=await r.sync(key);
    assert.equal(view.state.audio.music.sessions,undefined);
    assert.equal(view.state.audio.music.activeSessionId,undefined);
    assert.equal(sync.state.audio.music.sessions,undefined);
    assert.ok(!JSON.stringify(view).includes('Encontro secreto'));
    assert.ok(!JSON.stringify(sync).includes('inimigo secreto'));
    for (const action of ['musicSessionSave','musicSessionDelete','musicSessionSelect','musicTrackSave','musicTrackDelete','musicTrackMove','musicSettings']) {
      assert.equal((await r.action(action,{id:sessionId,name:'Tentativa',sessionId},key)).status,403,action);
    }
    assert.equal((await r.action('track',{command:'loadSaved',sessionId,id:'x'},key)).status,403);
  }
});

test('sessões concorrentes são preservadas e selecionar sessão não toca música',async()=>{
  const r=await room();
  const replies=await Promise.all([r.action('musicSessionSave',{name:'A'}),r.action('musicSessionSave',{name:'B'})]);
  assert.ok(replies.every(response=>response.status===200));
  const sessions=(await r.view()).state.audio.music.sessions;
  assert.equal(sessions.length,2);
  await r.action('musicSessionSelect',{id:sessions[0].id});
  assert.equal((await r.view()).state.audio.track,null);
  await r.action('musicSessionSave',{id:sessions[0].id,name:'Renomeada'});
  assert.equal((await r.view()).state.audio.music.sessions[0].name,'Renomeada');
});

test('validação rejeita números, links, campos e limites inválidos sem alterar estado',()=>{
  const {audio,sessionId,first}=repertoire();
  const before=structuredClone(audio);
  for (const data of [{fadeIn:-1},{fadeOut:31},{volume:101},{volume:'NaN'},{fadeIn:null},{fadeOut:''}]) {
    assert.throws(()=>changeMusic(audio,'musicSettings',data),error=>error.status===400);
  }
  for (const data of [{url:'https://example.com',title:'X'},{url:videoA,title:''},{url:videoA,title:'x'.repeat(101)},{url:videoA,title:'X',tag:'x'.repeat(51)}]) {
    assert.throws(()=>changeMusic(audio,'musicTrackSave',{sessionId,...data}),error=>error.status===400);
  }
  assert.throws(()=>changeMusic(audio,'musicSessionSave',{id:false,name:'Inválida'}),error=>error.status===400);
  assert.throws(()=>changeMusic(audio,'musicTrackSave',{sessionId,id:false,url:videoA,title:'Inválida'}),error=>error.status===400);
  assert.throws(()=>changeMusic(audio,'musicTrackMove',{sessionId,id:first,direction:0}),error=>error.status===400);
  assert.throws(()=>musicCommand(audio,{command:'loadSaved',sessionId,id:'missing'},1000),error=>error.status===404);
  assert.deepEqual(audio,before);
  const sessions=Array.from({length:20},(_,index)=>({id:String(index),name:'Sessão',tracks:[]}));
  assert.throws(()=>changeMusic({music:{sessions}},'musicSessionSave',{name:'Outra'}),error=>error.status===409);
  const full={music:{sessions:[{id:'full',name:'Sessão',tracks:Array.from({length:100},(_,index)=>({id:String(index),video:videoA,title:'Faixa',tag:''}))}]}};
  assert.throws(()=>changeMusic(full,'musicTrackSave',{sessionId:'full',url:videoA,title:'Outra'}),error=>error.status===409);
});

test('troca aplica fade-out no mesmo estado anterior e fade-in apenas na faixa escolhida',()=>{
  const {audio,sessionId,first,second}=repertoire();
  const initial=musicCommand(audio,{command:'loadSaved',sessionId,id:first},1000);
  assert.equal(initial.changed,2200);
  assert.deepEqual(initial.fade,{start:2200,outMs:0,inMs:3000});
  assert.equal(musicGain(initial,2200),0);
  assert.equal(musicGain(initial,3700),.5);
  const next=musicCommand(audio,{command:'loadSaved',sessionId,id:second},10000);
  assert.equal(next.changed,14200);
  assert.deepEqual(next.fade,{start:11200,outMs:3000,inMs:3000});
  assert.equal(effectiveTrack(next,14199).video,videoA);
  assert.equal(effectiveTrack(next,14200).video,videoB);
  assert.equal(musicGain(next,12700),.5);
  assert.equal(musicGain(next,14200),0);
  assert.equal(musicGain(next,15700),.5);
  assert.equal(musicGain(next,17200),1);
});

test('pausa e parada aguardam o fade e interrupção preserva o nível atual',()=>{
  const {audio,sessionId,first,second}=repertoire();
  musicCommand(audio,{command:'loadSaved',sessionId,id:first},1000);
  const paused=musicCommand(audio,{command:'pause'},10000);
  assert.equal(paused.changed,14200);
  assert.ok(Math.abs(paused.position-12)<.001);
  assert.equal(effectiveTrack(paused,14199).playing,true);
  assert.equal(effectiveTrack(paused,14200).playing,false);
  const next=musicCommand(audio,{command:'loadSaved',sessionId,id:second},12700);
  assert.equal(next.previous.gain,.5);
  assert.equal(musicGain(next,12700),.5);
  assert.equal(next.previous.fade,undefined);
  assert.equal(next.previous.previous,undefined);
  const stopped=musicCommand(audio,{command:'stop'},20000);
  assert.equal(effectiveTrack(stopped,stopped.changed),null);
  assert.equal(musicGain(stopped,stopped.changed),0);
});

test('fade zero mantém comandos imediatos após a janela compartilhada e não há próxima automática',()=>{
  const {audio,sessionId,first}=repertoire();
  changeMusic(audio,'musicSettings',{fadeIn:0,fadeOut:0,volume:40});
  const initial=musicCommand(audio,{command:'loadSaved',sessionId,id:first},1000);
  assert.equal(initial.changed,2200);
  assert.equal(musicGain(initial,2200),1);
  const stopped=musicCommand(audio,{command:'stop'},5000);
  assert.equal(stopped.changed,6200);
  assert.equal(effectiveTrack(stopped,6200),null);
  assert.equal(audio.music.sessions[0].tracks.length,2);
  assert.equal(audio.track.source.itemId,first);
  const legacy={track:null};
  assert.equal(musicCommand(legacy,{command:'load',url:videoA,title:'   '},0).title,'Música do YouTube');
});


test('fim atrasado de uma faixa não interrompe outra escolha do mestre',async()=>{
  const r=await room();
  await r.action('track',{command:'load',url:videoA,title:'Primeira'});
  const first=(await r.view()).state.audio.track.commandId;
  await r.action('track',{command:'load',url:videoB,title:'Segunda'});
  const before=await r.view();
  const stop=await r.action('track',{command:'stop',expectedCommandId:first});
  assert.equal(stop.status,409);
  const after=await r.view();
  assert.equal(after.rev,before.rev);
  assert.deepEqual(after.state.audio.track,before.state.audio.track);
  assert.equal(after.state.audio.track.video,videoB);
  assert.equal(after.state.audio.track.stopped,false);
  const current=after.state.audio.track.commandId;
  assert.equal((await r.action('track',{command:'stop',expectedCommandId:current})).status,200);
});

test('identificador esperado inválido é rejeitado antes de alterar a música',()=>{
  const {audio,sessionId,first}=repertoire();
  musicCommand(audio,{command:'loadSaved',sessionId,id:first},1000);
  const before=structuredClone(audio);
  for (const expectedCommandId of [false,0,null,{},'', 'x'.repeat(81)]) {
    assert.throws(()=>musicCommand(audio,{command:'stop',expectedCommandId},5000),error=>error.status===400);
  }
  assert.deepEqual(audio,before);
});


test('parada condicional concorrente e escolha de faixa preservam a escolha nova',async()=>{
  const r=await room();
  await r.action('track',{command:'load',url:videoA,title:'Primeira'});
  const expectedCommandId=(await r.view()).state.audio.track.commandId;
  const replies=await Promise.all([
    r.action('track',{command:'stop',expectedCommandId}),
    r.action('track',{command:'load',url:videoB,title:'Nova escolha'})
  ]);
  assert.ok([200,409].includes(replies[0].status));
  assert.equal(replies[1].status,200);
  const track=(await r.view()).state.audio.track;
  assert.equal(track.video,videoB);
  assert.equal(track.stopped,false);
});

test('nomes preparados pelo mestre ficam fora da faixa atual enviada ao jogador',async()=>{
  const r=await room();
  await r.action('musicSessionSave',{name:'Sessão privada'});
  const sessionId=(await r.view()).state.audio.music.activeSessionId;
  await r.action('musicTrackSave',{sessionId,url:videoA,title:'Nome que revela a cena',tag:'Spoiler'});
  const id=(await r.view()).state.audio.music.sessions[0].tracks[0].id;
  await r.action('track',{command:'loadSaved',sessionId,id});
  for (const value of [await r.view(r.member),await r.sync(r.member)]) {
    assert.equal(value.state.audio.track.title,'Trilha da mesa');
    assert.equal(value.state.audio.track.source,undefined);
    assert.ok(!JSON.stringify(value).includes('Nome que revela a cena'));
  }
  assert.equal((await r.view()).state.audio.track.title,'Nome que revela a cena');
  assert.equal((await r.sync()).state.audio.track.title,'Nome que revela a cena');
  assert.equal((await r.sync()).state.audio.music.sessions,undefined);
});

test('repetição é salva por faixa e somente mestre pode alterá-la ou informar duração',async()=>{
 const r=await room();await r.action('musicSessionSave',{name:'Trilha'});
 const sessionId=(await r.view()).state.audio.music.activeSessionId;
 assert.equal((await r.action('musicTrackSave',{sessionId,url:videoA,title:'Ambiente',loop:true})).status,200);
 const saved=(await r.view()).state.audio.music.sessions[0].tracks[0];assert.equal(saved.loop,true);
 await r.action('track',{command:'loadSaved',sessionId,id:saved.id});let track=(await r.view()).state.audio.track;
 assert.equal(track.loop,true);
 for(const data of [{command:'setLoop',loop:false},{command:'duration',duration:120,expectedCommandId:track.commandId},{command:'ended',expectedCommandId:track.commandId}])assert.equal((await r.action('track',data,r.member)).status,403);
 assert.equal((await r.action('track',{command:'setLoop',loop:false,expectedCommandId:track.commandId})).status,200);
 assert.equal((await r.view()).state.audio.music.sessions[0].tracks[0].loop,false);
 assert.equal((await r.sync(r.member)).state.audio.track.loop,false);
});
test('relógio de repetição permanece no mesmo ciclo ao pausar, entrar tarde ou desativar',()=>{
 const {audio,sessionId,first}=repertoire();
 musicCommand(audio,{command:'loadSaved',sessionId,id:first},0);
 musicCommand(audio,{command:'duration',duration:10,expectedCommandId:audio.track.commandId},1300);
 musicCommand(audio,{command:'setLoop',loop:true},1400);
 const start=audio.track.changed;assert.ok(Math.abs(elapsed(audio.track,start+35100)-5.1)<1e-7);
 const before=elapsed(audio.track,start+35100);
 musicCommand(audio,{command:'setLoop',loop:false},start+35100);
 assert.ok(Math.abs(elapsed(audio.track,start+35100)-before)<1e-7);
 assert.ok(Math.abs(elapsed(audio.track,start+36100)-(before+1))<1e-7);
 musicCommand(audio,{command:'setLoop',loop:true},start+36100);
 musicCommand(audio,{command:'pause'},start+36100);
 const paused=effectiveTrack(audio.track,audio.track.changed+1);assert.equal(paused.playing,false);
 assert.equal(elapsed(paused,audio.track.changed+100000),paused.position);
});
test('desativar repetição conserva o fade atual e não introduz salto de volume',()=>{
 const {audio}=repertoire();musicCommand(audio,{command:'load',url:videoA,loop:true},0);
 musicCommand(audio,{command:'duration',duration:100,expectedCommandId:audio.track.commandId},1300);
 const at=audio.track.changed+1500,gain=musicGain(audio.track,at);
 musicCommand(audio,{command:'setLoop',loop:false},at);
 assert.ok(Math.abs(musicGain(audio.track,at)-gain)<1e-9);
 assert.ok(Math.abs(musicGain(audio.track,at+750)-.75)<1e-9);
});
test('duração e notificações atrasadas não modificam outra faixa; repetição sem metadados reinicia compartilhada',()=>{
 const {audio}=repertoire();musicCommand(audio,{command:'load',url:videoA,loop:true},0);
 const first=audio.track.commandId;
 for(const duration of [0,-1,null,'',false,90000])assert.throws(()=>musicCommand(audio,{command:'duration',duration,expectedCommandId:first},5000),e=>e.status===400);
 musicCommand(audio,{command:'ended',expectedCommandId:first},5000);
 assert.equal(audio.track.playing,true);assert.equal(audio.track.position,0);assert.equal(audio.track.fade.outMs,0);assert.equal(audio.track.fade.inMs,0);
 musicCommand(audio,{command:'load',url:videoB},7000);const before=structuredClone(audio.track);
 for(const command of ['ended','duration','setLoop'])assert.throws(()=>musicCommand(audio,{command,expectedCommandId:first,duration:90,loop:false},8000),e=>e.status===409);
 assert.deepEqual(audio.track,before);
 assert.throws(()=>musicCommand(audio,{command:'setLoop',loop:'true'},8000),e=>e.status===400);
});
