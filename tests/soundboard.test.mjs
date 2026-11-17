import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {api} from '../api.mjs';
import {normalizeSoundboard,mutateSoundboard,sessionSounds} from '../soundboard-model.mjs';
import {readAudioZip,crc32} from '../zip-audio.mjs';
import {soundPacks} from '../sound-catalog.mjs';
import {renderSoundboard,createSoundboardDock} from '../public/soundboard.mjs';

function wav(){const data=new Uint8Array(46),v=new DataView(data.buffer);for(const [at,str]of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<str.length;i++)data[at+i]=str.charCodeAt(i);v.setUint32(4,38,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,2,true);return data;}
function zip(entries,compressed=false){
 const locals=[],central=[];let offset=0;
 for(const [name,data]of entries){const filename=Buffer.from(name),payload=compressed?deflateRawSync(data):Buffer.from(data),local=Buffer.alloc(30),index=Buffer.alloc(46),crc=crc32(data);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(compressed?8:0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(payload.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
 index.writeUInt32LE(0x02014b50);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt16LE(compressed?8:0,10);index.writeUInt32LE(crc,16);index.writeUInt32LE(payload.length,20);index.writeUInt32LE(data.length,24);index.writeUInt16LE(filename.length,28);index.writeUInt32LE(offset,42);
 locals.push(local,filename,payload);central.push(index,filename);offset+=local.length+filename.length+payload.length;}
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,directory,end]);
}
async function room(){
 const rows=new Map(),assets=new Map();let failWrite=false;
 const store={get:async id=>structuredClone(rows.get(id)),create:async row=>rows.set(row.id,structuredClone(row)),save:async row=>{if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;},putAsset:async(key,blob)=>{if(failWrite&&assets.size)throw Object.assign(new Error('Disco indisponível'),{status:503});assets.set(key,blob);},getAsset:async key=>assets.get(key),deleteAsset:async key=>assets.delete(key)};
 const call=(path,method='GET',key,body,headers={})=>api(new Request('http://app/api/campaigns'+path,{method,headers:{...headers,...(key?{Authorization:'Bearer '+key}:{})},body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body)}),store);
 const created=await(await call('','POST',null,{name:'Sons',example:true})).json(),base='/'+created.id;
 const action=(action,data={},key=created.key)=>call(base+'/action','POST',key,{action,data});
 return {rows,assets,created,base,call,action,failWrites(){failWrite=true;}};
}
async function good(response){assert.equal(response.status,200,await response.clone().text());return response.json();}

test('sessões guardam pacotes, escolhas avulsas e favoritos sem misturar preparações',()=>{
 const audio={clips:[{id:'a',name:'Porta',packId:'rpg'},{id:'b',name:'Espada',packId:'rpg'},{id:'c',name:'Meu arquivo'}],cues:[]};
 assert.ok(sessionSounds(audio).some(s=>s.id==='bell'));assert.ok(sessionSounds(audio).some(s=>s.id==='c'));
 mutateSoundboard(audio,'soundboardSessionSave',{name:'Ruínas'});const first=normalizeSoundboard(audio).activeSessionId;assert.deepEqual(sessionSounds(audio),[]);
 mutateSoundboard(audio,'soundboardPackToggle',{packId:'rpg',enabled:true});mutateSoundboard(audio,'soundboardPick',{id:'a',enabled:true});mutateSoundboard(audio,'soundboardFavorite',{id:'a',enabled:true});
 mutateSoundboard(audio,'soundboardPackToggle',{packId:'rpg',enabled:false});assert.deepEqual(sessionSounds(audio).map(s=>s.id),['a']);
 mutateSoundboard(audio,'soundboardSessionSave',{name:'Taverna'});assert.deepEqual(sessionSounds(audio),[]);
 mutateSoundboard(audio,'soundboardSessionSelect',{id:first});assert.deepEqual(sessionSounds(audio).map(s=>s.id),['a']);assert.deepEqual(normalizeSoundboard(audio).sessions.find(s=>s.id===first).favorites,['a']);
 const restored=JSON.parse(JSON.stringify(audio));assert.deepEqual(normalizeSoundboard(restored),normalizeSoundboard(audio));
});

test('ZIP verifica deflate, integridade, caminhos e áudio real antes de importar',async()=>{
 for(const compressed of [false,true]){const files=await readAudioZip(zip([['Audio/doorOpen.wav',wav()]],compressed));assert.equal(files.length,1);assert.equal(files[0].type,'audio/wav');assert.deepEqual([...files[0].data],[...wav()]);}
 await assert.rejects(readAudioZip(zip([['../escape.wav',wav()]])),/caminho inválido/);
 await assert.rejects(readAudioZip(zip([['fake.wav',new TextEncoder().encode('not audio')]])),/não corresponde/);
 const broken=zip([['door.wav',wav()]]);broken[40]^=1;await assert.rejects(readAudioZip(broken),/corrompido/);
});

test('pacote oficial é instalado uma vez, preserva créditos e entra na sessão escolhida',async()=>{
 const r=await room(),originalFetch=globalThis.fetch;let downloads=0;
 globalThis.fetch=async url=>{downloads++;assert.equal(url,soundPacks[0].archive);return new Response(zip([['Audio/doorOpen.wav',wav()],['Audio/footstep.wav',wav()]],true));};
 try{
 const row=await good(await r.call(r.base+'/sound-pack?pack=kenney-rpg','POST',r.created.key,{}));
 assert.equal(row.state.audio.clips.length,2);assert.equal(r.assets.size,2);assert.equal(row.state.audio.packs[0].license,'CC0-1.0');assert.ok(sessionSounds(row.state.audio).some(s=>s.name==='Porta abrir'));
 await good(await r.call(r.base+'/sound-pack?pack=kenney-rpg','POST',r.created.key,{}));assert.equal(downloads,1);assert.equal(r.assets.size,2);
 const member='a'.repeat(64);await good(await r.call(r.base+'/join','POST',r.created.invite,{key:member}));await good(await r.action('characterClaim',{id:'lyra'},member));
 assert.equal((await r.call(r.base+'/sound-pack?pack=kenney-rpg','POST',member,{})).status,403);
 const player=await good(await r.call(r.base,'GET',member));assert.equal(player.state.audio.soundboard.sessions,undefined);assert.equal(player.state.audio.packs,undefined);
 }finally{globalThis.fetch=originalFetch;}
});

test('falha de download ou gravação mantém a campanha e limpa arquivos incompletos',async()=>{
 const r=await room(),before=JSON.stringify(r.rows.get(r.created.id)),originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>{throw new Error('Sem internet');};
 try{assert.equal((await r.call(r.base+'/sound-pack?pack=kenney-rpg','POST',r.created.key,{})).status,502);assert.equal(JSON.stringify(r.rows.get(r.created.id)),before);assert.equal(r.assets.size,0);}finally{globalThis.fetch=originalFetch;}
 r.failWrites();const response=await r.call(r.base+'/sound-pack','POST',r.created.key,zip([['a.wav',wav()],['b.wav',wav()]]),{'X-Pack-Name':'Meu pacote'});assert.equal(response.status,503);assert.equal(r.assets.size,0);assert.equal(JSON.stringify(r.rows.get(r.created.id)),before);
});

test('controle de sessão impede sons não preparados e parada e loop ficam sincronizados',async()=>{
 const r=await room(),row=await good(await r.call(r.base+'/sound-pack','POST',r.created.key,zip([['rain.wav',wav()]]),{'X-Pack-Name':'Ambiente','X-Pack-Author':'Autor','X-Pack-License':'CC0-1.0'})),id=row.state.audio.clips[0].id;
 await good(await r.action('soundLoop',{id,enabled:true}));
 const playing=await good(await r.call(r.base+'/sync','GET',r.created.key));assert.equal(playing.state.audio.soundboard.loops[0].sound,id);
 const stopped=await good(await r.action('soundboardStop'));assert.equal(stopped.state.audio.soundboard.loops.length,0);assert.equal(stopped.state.audio.cues.length,0);assert.ok(stopped.state.audio.soundboard.stopVersion>0);
 await good(await r.action('soundboardSessionSave',{name:'Outra sessão'}));assert.equal((await r.action('soundPlay',{id})).status,404);assert.equal((await r.action('soundLoop',{id,enabled:true})).status,403);
});

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,button:(label,act,cls,icon,id)=>'<button data-act="'+act+'" data-id="'+esc(id)+'">'+esc(label)+'</button>'};
test('biblioteca apresenta pacotes e seleção; painel flutuante guarda biblioteca em sync parcial e se oculta para jogadores',()=>{
 const row={id:'room',rev:1,master:true,state:{audio:{clips:[{id:'a',name:'Porta <som>',packId:'rpg'}],packs:[{id:'rpg',name:'RPG'}],cues:[],soundboard:{sessions:[{id:'s',name:'Ruínas',packs:['rpg'],sounds:[],favorites:[]}],activeSessionId:'s'}}}};
 const page=renderSoundboard(row,ui,{tab:'library'});assert.match(page,/data-soundboard-pick/);assert.match(page,/Porta &lt;som&gt;/);assert.match(renderSoundboard(row,ui,{tab:'packs'}),/kenney-rpg/);
 const nodes=new Map();const root={hidden:false,addEventListener(){},querySelector(key){if(!nodes.has(key))nodes.set(key,{innerHTML:''});return nodes.get(key);},querySelectorAll(){return [];}};
 const dock=createSoundboardDock(root,ui);dock.sync(row);assert.match(nodes.get('[data-sound-dock-body]').innerHTML,/soundPlay/);assert.match(nodes.get('[data-sound-dock-body]').innerHTML,/Porta &lt;som&gt;/);
 dock.sync({id:'room',rev:2,master:true,state:{audio:{clips:[],soundboard:{volume:70,loops:[],stopVersion:0}}}});assert.match(nodes.get('[data-sound-dock-body]').innerHTML,/Porta &lt;som&gt;/);
 dock.sync({...row,master:false});assert.equal(root.hidden,true);assert.ok(!renderSoundboard({...row,master:false},ui).includes('soundPlay'));
});

test('backup completo conserva pacotes, escolhas e favoritos; cópia restaurada começa sem loops',async()=>{
 const r=await room();
 const row=await good(await r.call(r.base+'/sound-pack','POST',r.created.key,zip([['cave.wav',wav()]]),{'X-Pack-Name':'Caverna','X-Pack-License':'CC0-1.0'})),id=row.state.audio.clips[0].id;
 await good(await r.action('soundboardSessionSave',{name:'Exploração'}));await good(await r.action('soundboardPick',{id,enabled:true}));await good(await r.action('soundboardFavorite',{id,enabled:true}));await good(await r.action('soundLoop',{id,enabled:true}));
 const exported=await r.call(r.base+'/backup','GET',r.created.key);assert.equal(exported.status,200);
 const restored=await r.call('/import','POST',null,new Uint8Array(await exported.arrayBuffer()));assert.equal(restored.status,201,await restored.clone().text());
 const copy=await restored.json(),sb=normalizeSoundboard(copy.state.audio);assert.equal(sb.sessions.find(s=>s.id===sb.activeSessionId).name,'Exploração');assert.deepEqual(sb.sessions.find(s=>s.id===sb.activeSessionId).sounds,[id]);assert.deepEqual(sb.sessions.find(s=>s.id===sb.activeSessionId).favorites,[id]);assert.deepEqual(sb.loops,[]);assert.equal(copy.state.audio.packs[0].license,'CC0-1.0');
 assert.ok(r.assets.has(copy.id+'/'+id));assert.ok(r.assets.has(r.created.id+'/'+id));
});
