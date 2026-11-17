import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/audio.mjs',import.meta.url),'utf8');
const mediaURL=new URL('../media.mjs',import.meta.url).href;
const {campaignAudio}=await import('data:text/javascript;base64,'+
  Buffer.from(source.replace("'./media.mjs'",JSON.stringify(mediaURL))).toString('base64'));

class Element {
  constructor() {this.nodes=new Map();this.dataset={};this.classList={toggle(){}};}
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector,new Element());
    return this.nodes.get(selector);
  }
  replaceChildren(...nodes) {this.children=nodes;}
}

const players=[];
let holdReady=false;
let timeOffset=0;
const realPerformance=globalThis.performance;
globalThis.performance={now:()=>realPerformance.now()+timeOffset};
class Player {
  constructor(host,options) {
    this.calls=[];this.options=options;this.state=-1;this.time=0;
    players.push(this);
    assert.match(options.videoId,/^[\w-]{11}$/);
    this.ready=()=>options.events.onReady({target:this});
    if(!holdReady) queueMicrotask(this.ready);
  }
  getIframe(){return {};}
  setVolume(value){this.volume=value;}
  loadVideoById(value){this.calls.push(['load',value]);this.time=value.startSeconds;this.state=1;queueMicrotask(()=>this.options.events.onStateChange({data:1}));}
  cueVideoById(value){this.calls.push(['cue',value]);this.time=value.startSeconds;this.state=5;}
  seekTo(time){this.time=time;this.calls.push(['seek',time]);}
  playVideo(){this.state=1;this.calls.push(['play']);queueMicrotask(()=>this.options.events.onStateChange({data:1}));}
  pauseVideo(){this.state=2;this.calls.push(['pause']);}
  stopVideo(){this.state=0;this.calls.push(['stop']);}
  getCurrentTime(){return this.time;}
  getPlayerState(){return this.state;}
  destroy(){this.destroyed=true;}
}

const sounds=[];
function audioNode() {
  return {
    connect(){return this;},stop(){},start(time){sounds.push(time);},
    frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
    gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}}
  };
}
class AudioContext {
  constructor(){this.currentTime=100;}
  createGain(){return audioNode();}
  createOscillator(){return audioNode();}
  resume(){return Promise.resolve();}
}
globalThis.window={YT:{Player},AudioContext};
globalThis.location={origin:'http://192.168.0.211:3000'};
globalThis.document={querySelector:()=>new Element(),createElement:()=>new Element()};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const track={video:'M7lc1UVf-VE',title:'Trilha',playing:true,position:2,changed:1000,commandId:'start'};
const row=(rev,current,master=false,time=5000,cues=[])=>({
  id:'room',rev,master,serverTime:time,state:{audio:{track:current,clips:[],cues}}
});

test('dois clientes reproduzem a mesma posição e pausam sem recriar o player',async()=>{
  const aDock=new Element(),bDock=new Element(),errors=[];
  const a=campaignAudio(aDock,()=>{},message=>errors.push(message));
  const b=campaignAudio(bDock,()=>{},message=>errors.push(message));
  a.sync(row(1,track,true),false);b.sync(row(1,track),false);
  assert.equal(players.length,0);
  a.toggle();b.toggle();
  await flush();
  assert.equal(players.length,2);
  const [master,player]=players;
  assert.equal(master.state,1);
  assert.equal(player.state,1);
  assert.ok(Math.abs(master.time-player.time)<.1);
  assert.ok(Math.abs(player.time-6)<.1);
  assert.equal(aDock.querySelector('[data-audio-master]').hidden,false);
  assert.equal(bDock.querySelector('[data-audio-master]').hidden,true);
  const paused={...track,playing:false,position:7,changed:6000,commandId:'pause',previous:track};
  a.sync(row(2,paused,true,5500),false);
  b.sync(row(2,paused,false,5500),false);
  assert.equal(master.state,1);
  assert.equal(player.state,1);
  a.sync(row(2,paused,true,6100),false);
  b.sync(row(2,paused,false,6100),false);
  assert.equal(master.state,2);
  assert.equal(player.state,2);
  assert.equal(players.length,2);
  assert.equal(errors.length,0);
  a.dispose();b.dispose();
});

test('soundboard é reproduzido nos clientes ativados uma única vez por evento',async()=>{
  const a=campaignAudio(new Element(),()=>{},()=>{});
  const b=campaignAudio(new Element(),()=>{},()=>{});
  a.sync(row(1,null),false);b.sync(row(1,null),false);
  a.toggle();b.toggle();
  const cue={id:'cue-1',sound:'door',at:6200};
  const before=sounds.length;
  a.sync(row(2,null,false,5000,[cue]),false);
  b.sync(row(2,null,false,5000,[cue]),false);
  assert.equal(sounds.length,before+4);
  assert.ok(Math.abs(sounds[before]-sounds[before+2])<.02);
  a.sync(row(2,null,false,5100,[cue]),false);
  b.sync(row(2,null,false,5100,[cue]),false);
  assert.equal(sounds.length,before+4);
  a.dispose();b.dispose();
});

test('bloqueio de autoplay aparece e nova ativação tenta liberar o player',async()=>{
  const dock=new Element();
  const control=campaignAudio(dock,()=>{},()=>{});
  control.sync(row(1,track),false);
  control.toggle();
  await flush();
  const player=players.at(-1);
  player.options.events.onAutoplayBlocked();
  assert.equal(control.blocked,true);
  control.toggle();
  assert.equal(control.enabled,true);
  assert.equal(control.blocked,false);
  timeOffset+=250;
  control.setMusicVolume(25);
  assert.equal(player.volume,25);
  control.dispose();
});

test('sincronizações durante carregamento preservam o mesmo iframe até onReady',async()=>{
  holdReady=true;
  const before=players.length;
  const control=campaignAudio(new Element(),()=>{},()=>{});
  try {
    control.sync(row(1,track),false);
    control.toggle();
    await flush();
    const loading=players.at(-1);
    for (let i=0;i<5;i++) {
      control.sync(row(1,track,false,5100+i*400),false);
      await flush();
    }
    assert.equal(players.length,before+1);
    assert.equal(loading.options.videoId,track.video);
    assert.equal(loading.calls.length,0);
    loading.ready();
    await flush();
    assert.equal(loading.state,1);
    assert.equal(loading.calls.filter(call=>call[0]==='load').length,1);
  } finally {control.dispose();holdReady=false;}
});

test('erro de inicialização fica visível e nova ativação cria uma tentativa única',async()=>{
  holdReady=true;
  const dock=new Element(),messages=[];
  const control=campaignAudio(dock,()=>{},message=>messages.push(message));
  try {
    control.sync(row(1,track),false);
    control.toggle();
    await flush();
    const broken=players.at(-1);
    broken.options.events.onError({data:153});
    assert.match(dock.querySelector('[data-player-status]').textContent,/153/);
    const beforeRetry=players.length;
    control.sync(row(1,track,false,5200),false);
    await flush();
    assert.equal(players.length,beforeRetry);
    control.toggle();
    await flush();
    assert.equal(broken.destroyed,true);
    assert.equal(players.length,beforeRetry+1);
    broken.ready();
    assert.equal(broken.calls.length,0);
    players.at(-1).ready();
    await flush();
    assert.equal(players.at(-1).state,1);
    broken.options.events.onAutoplayBlocked();
    assert.equal(control.blocked,false);
    assert.equal(messages.length,1);
  } finally {control.dispose();holdReady=false;}
});

test('player aplica volume mestre e fades na troca usando uma única instância',async()=>{
  const control=campaignAudio(new Element(),()=>{},()=>{});
  const snapshot=(rev,current,time)=>{
    const value=row(rev,current,false,time);
    value.state.audio.music={volume:80,fadeIn:3,fadeOut:3};
    return value;
  };
  const before=players.length;
  try {
    control.sync(snapshot(1,track,5000));
    control.toggle();
    await flush();
    const player=players.at(-1);
    timeOffset+=250;
    control.sync(snapshot(1,track,5250));
    assert.equal(player.volume,52);
    const next={...track,video:'bHQqvYy5KYo',changed:10000,position:0,commandId:'switch',
      previous:{...track,gain:1},fade:{start:7000,outMs:3000,inMs:3000}};
    control.sync(snapshot(2,next,8500));
    assert.equal(player.volume,26);
    control.sync(snapshot(2,next,10000));
    await flush();
    assert.equal(player.volume,0);
    timeOffset+=250;
    control.sync(snapshot(2,next,11500));
    assert.equal(player.volume,26);
    control.sync(snapshot(2,next,13000));
    assert.equal(player.volume,52);
    assert.equal(players.length,before+1);
    assert.equal(player.calls.filter(call=>call[0]==='load').length,2);
  } finally {control.dispose();}
});

test('fim de faixa durante fade não cancela a música que o mestre já escolheu',async()=>{
  const commands=[];
  const control=campaignAudio(new Element(),()=>{},()=>{},(command,data)=>{
    commands.push({command,data});return Promise.resolve();
  });
  try {
    control.sync(row(1,track,true,5000));
    control.toggle();
    await flush();
    const player=players.at(-1);
    const next={...track,video:'bHQqvYy5KYo',changed:10000,position:0,commandId:'new-choice',
      previous:{...track,gain:1},fade:{start:7000,outMs:3000,inMs:3000}};
    control.sync(row(2,next,true,8500));
    player.options.events.onStateChange({data:0});
    assert.equal(commands.length,0);
    control.sync(row(2,next,true,10000));
    await flush();
    player.options.events.onStateChange({data:0});
    player.options.events.onStateChange({data:0});
    assert.deepEqual(commands,[{command:'stop',data:{expectedCommandId:'new-choice'}}]);
  } finally {control.dispose();}
});

test('vídeo inicia visível e mantém a reprodução ao navegar para outras telas',async()=>{
  const observations=[];
  globalThis.IntersectionObserver=class {
    constructor(callback){this.callback=callback;observations.push(this);}
    observe(){}
    disconnect(){}
  };
  const dock=new Element();
  const control=campaignAudio(dock,()=>{},()=>{});
  try {
    control.setView(false);
    control.sync(row(1,track));
    assert.equal(dock.hidden,true);
    control.setView(true);
    assert.equal(dock.hidden,false);
    control.toggle();
    await flush();
    const player=players.at(-1);
    assert.equal(player.calls.filter(call=>call[0]==='load').length,0);
    assert.equal(player.calls.filter(call=>call[0]==='play').length,0);
    observations.at(-1).callback([{intersectionRatio:.8}]);
    await flush();
    assert.equal(player.state,1);
    const instanceCount=players.length;
    control.setView(false);
    observations.at(-1).callback([{intersectionRatio:0}]);
    assert.equal(dock.hidden,true);
    assert.equal(player.state,1);
    control.setMusicVolume(30);
    const next={...track,video:'bHQqvYy5KYo',changed:6000,commandId:'next'};
    control.sync(row(2,next,false,6500));
    await flush();
    assert.equal(player.state,1);
    assert.equal(player.calls.at(-1)[1].videoId,next.video);
    timeOffset+=300;
    control.sync(row(2,next,false,6800));
    assert.equal(player.volume,30);
    control.setView(true);
    assert.equal(dock.hidden,false);
    assert.equal(players.length,instanceCount);
    const paused={...next,playing:false,position:1,changed:7000,commandId:'pause'};
    control.setView(false);
    control.sync(row(3,paused,false,7100));
    assert.equal(player.state,2);
  } finally {control.dispose();delete globalThis.IntersectionObserver;timeOffset=0;}
});

test('mestre e jogadores repetem no mesmo ciclo sem depender de notificação de fim do mestre',async()=>{
 const commands=[],a=campaignAudio(new Element(),()=>{},()=>{},(command,data)=>{commands.push({command,data});return Promise.resolve();}),b=campaignAudio(new Element(),()=>{},()=>{});
 try{
  const repeat={...track,loop:true,duration:10,position:0,changed:1000};
  a.sync(row(1,repeat,true,26000));b.sync(row(1,repeat,false,26000));a.toggle();b.toggle();await flush();
  const [master,guest]=players.slice(-2);assert.ok(Math.abs(master.time-5)<.1);assert.ok(Math.abs(master.time-guest.time)<.1);
  for(const player of [master,guest]){player.state=0;player.time=10;player.options.events.onStateChange({data:0});}
  await flush();assert.equal(master.state,1);assert.equal(guest.state,1);assert.ok(Math.abs(master.time-guest.time)<.1);assert.equal(commands.length,0);
  const paused={...repeat,playing:false,position:5,changed:26000,commandId:'paused-loop'};
  a.sync(row(2,paused,true,27000));b.sync(row(2,paused,false,27000));
  assert.equal(master.state,2);assert.equal(guest.state,2);
 }finally{a.dispose();b.dispose();}
});
test('somente mestre informa duração e o faz uma vez por comando atual',async()=>{
 const commands=[],a=campaignAudio(new Element(),()=>{},()=>{},(command,data)=>{commands.push({command,data});return Promise.resolve();});
 try{
  a.sync(row(1,{...track,loop:true},true));a.toggle();await flush();const player=players.at(-1);player.getDuration=()=>90;
  a.sync(row(1,{...track,loop:true},true,5500));a.sync(row(1,{...track,loop:true},true,5600));
  assert.deepEqual(commands,[{command:'duration',data:{duration:90,expectedCommandId:'start'}}]);
  a.sync(row(2,{...track,loop:true,duration:90},true,5700));assert.equal(commands.length,1);
 }finally{a.dispose();}
});

test('metadados atrasados do vídeo anterior não definem a duração da nova faixa',async()=>{
 const commands=[],a=campaignAudio(new Element(),()=>{},()=>{},(command,data)=>{commands.push({command,data});return Promise.resolve();});
 try{
  a.sync(row(1,{...track,loop:true},true));a.toggle();await flush();const player=players.at(-1);
  player.getDuration=()=>42;player.getVideoUrl=()=>'https://www.youtube.com/watch?v=bHQqvYy5KYo';
  a.sync(row(1,{...track,loop:true},true,5500));assert.equal(commands.length,0);
  player.getVideoUrl=()=>'https://www.youtube.com/watch?v='+track.video;
  a.sync(row(1,{...track,loop:true},true,5600));assert.equal(commands.length,1);assert.equal(commands[0].data.duration,42);
 }finally{a.dispose();}
});

test('retomar fora da aba Áudio recarrega a posição pausada no mesmo iframe para mestre e jogadores',async()=>{
 const observations=[];
 globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;observations.push(this);}observe(){}disconnect(){}};
 const a=campaignAudio(new Element(),()=>{},()=>{}),b=campaignAudio(new Element(),()=>{},()=>{});
 try{
  a.sync(row(1,track,true,5000));b.sync(row(1,track,false,5000));a.toggle();b.toggle();await flush();
  const devices=players.slice(-2),count=players.length;
  for(const observer of observations)observer.callback([{intersectionRatio:.8}]);await flush();
  a.setView(false);b.setView(false);for(const observer of observations)observer.callback([{intersectionRatio:0}]);
  const paused={...track,playing:false,position:7,changed:7000,commandId:'pause-away',previous:track};
  a.sync(row(2,paused,true,7100));b.sync(row(2,paused,false,7100));
  for(const device of devices){
   assert.equal(device.state,2);
   const seek=device.seekTo.bind(device),play=device.playVideo.bind(device);
   // Simulate a paused hidden embed that buffers after seeking and defers playVideo.
   device.seekTo=value=>{const paused=device.state===2;seek(value);if(paused)device.state=3;};
   device.playVideo=()=>{if(device.state===3){device.calls.push(['deferred-play']);return;}play();};
  }
  const resumed={...track,playing:true,position:7,changed:10000,commandId:'resume-away',previous:paused,fade:{start:10000,outMs:0,inMs:3000}};
  a.sync(row(3,resumed,true,9500));b.sync(row(3,resumed,false,9500));assert.ok(devices.every(p=>p.state===2));
  a.sync(row(3,resumed,true,11000));b.sync(row(3,resumed,false,11000));await flush();
  for(const device of devices){
   assert.equal(device.state,1);const load=device.calls.filter(call=>call[0]==='load').at(-1);
   assert.equal(load[1].videoId,track.video);assert.ok(Math.abs(load[1].startSeconds-8)<.1);
   assert.ok(!device.calls.some(call=>call[0]==='deferred-play'));
  }
  assert.ok(Math.abs(devices[0].time-devices[1].time)<.1);assert.equal(players.length,count);
  const loads=devices.map(p=>p.calls.filter(call=>call[0]==='load').length);
  timeOffset+=300;a.sync(row(3,resumed,true,11300));b.sync(row(3,resumed,false,11300));
  assert.ok(devices.every(p=>p.volume>0));assert.deepEqual(devices.map(p=>p.calls.filter(call=>call[0]==='load').length),loads);
  a.setView(true);b.setView(true);assert.equal(players.length,count);
 }finally{a.dispose();b.dispose();delete globalThis.IntersectionObserver;timeOffset=0;}
});

test('pré-escuta toca só localmente mesmo silenciado, sem player do YouTube nem comando compartilhado',async()=>{
 const created=[],beforePlayers=players.length,commands=[];
 AudioContext.prototype.decodeAudioData=async()=>({duration:2});
 AudioContext.prototype.createBufferSource=function(){const source=audioNode();source.stop=()=>{source.stopped=true;};created.push(source);return source;};
 const client=campaignAudio(new Element(),async()=>new Response(new Uint8Array([1,2,3])),()=>{},(...args)=>commands.push(args));
 client.sync({id:'preview-room',master:true,rev:1,serverTime:5000,state:{audio:{track:null,cues:[],clips:[{id:'clip',name:'Porta'}]}}});
 assert.equal(client.enabled,false);await client.preview('clip');assert.equal(created.length,1);assert.equal(players.length,beforePlayers);assert.equal(client.enabled,false);assert.deepEqual(commands,[]);
 client.dispose();assert.equal(created[0].stopped,true);
});

test('loops persistem sem duplicação, respeitam volume da mesa e parada cancela reprodução pendente',async()=>{
 const created=[],errors=[];let resolveClip;
 AudioContext.prototype.decodeAudioData=async()=>({duration:2});
 AudioContext.prototype.createBufferSource=function(){const source=audioNode();source.stop=()=>{source.stopped=true;};created.push(source);return source;};
 const client=campaignAudio(new Element(),async()=>new Response(new Uint8Array([1,2,3])),error=>errors.push(error));
 const state=(rev,loops,stopVersion=0)=>({id:'loop-room',master:true,rev,serverTime:5000,state:{audio:{track:null,cues:[],clips:[{id:'clip'}],soundboard:{loops,volume:40,stopVersion}}}});
 client.sync(state(1,[]));client.toggle();const loop={id:'loop-one',sound:'clip',at:5000};client.sync(state(2,[loop]));await flush();
 assert.equal(created.length,1);assert.equal(created[0].loop,true);assert.equal(created[0].effectGain.gain.value,.4);
 client.sync(state(3,[loop]));await flush();assert.equal(created.length,1);
 client.sync(state(4,[],1));assert.equal(created[0].stopped,true);assert.deepEqual(errors,[]);client.dispose();
 const pending=campaignAudio(new Element(),()=>new Promise(resolve=>resolveClip=resolve),error=>errors.push(error));
 pending.sync(state(1,[]));pending.toggle();pending.sync(state(2,[loop]));pending.sync(state(3,[],1));resolveClip(new Response(new Uint8Array([1])));await flush();assert.equal(created.length,1);pending.dispose();
});
