import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {effectiveTrack} from '../media.mjs';

async function room() {
  const rows=new Map(),assets=new Map();
  const store={
    async create(row){rows.set(row.id,structuredClone(row));},
    async get(id){return structuredClone(rows.get(id));},
    async save(row){
      await Promise.resolve();
      if (rows.get(row.id).rev!==row.rev) return false;
      rows.set(row.id,structuredClone({...row,rev:row.rev+1}));
      return true;
    },
    async putAsset(key,blob){assets.set(key,blob);},
    async getAsset(key){return assets.get(key);},
    async deleteAsset(key){assets.delete(key);}
  };
  const request=(path,method,key,body,headers={})=>api(new Request('http://app/api/campaigns'+path,{
    method,headers:{...(key?{Authorization:'Bearer '+key}:{}),...headers},
    body:body===undefined?undefined:JSON.stringify(body)
  }),store);
  const created=await (await request('','POST',null,{name:'Mesa privada',example:true})).json();
  const base='/'+created.id;
  const action=(key,action,data={})=>request(base+'/action','POST',key,{action,data});
  const view=async key=>(await request(base,'GET',key)).json();
  async function join(seed) {
    const key=seed.repeat(64);
    const response=await request(base+'/join','POST',created.invite,{key});
    assert.equal(response.status,200);
    return key;
  }
  return {created,rows,store,assets,request,base,action,view,join};
}

test('convite mostra resumos e exige identidade e personagem antes de editar',async()=>{
  const r=await room();
  const guest=await r.view(r.created.invite);
  assert.equal(guest.role,'guest');
  assert.equal(guest.needsCharacter,true);
  assert.equal(guest.state.characters[0].values,undefined);
  assert.equal((await r.action(r.created.invite,'character',{name:'Tentativa'})).status,403);
  const a=await r.join('a');
  const waiting=await r.view(a);
  assert.equal(waiting.needsCharacter,true);
  assert.equal((await r.action(a,'roll',{formula:'1d20'})).status,403);
  assert.equal((await r.action(a,'characterClaim',{id:'lyra'})).status,200);
  const selected=await r.view(a);
  assert.equal(selected.needsCharacter,false);
  assert.equal(selected.characterId,'lyra');
  assert.equal(selected.state.characters.find(c=>c.id==='lyra').values.f1,'1');
  const other=selected.state.characters.find(c=>c.id==='dorian');
  for (const key of ['values','fields','skills','abilities','ownerId']) assert.equal(other[key],undefined,key);
  assert.equal(other.access,'summary');
  assert.equal(selected.state.members,undefined);
  const master=await r.view(r.created.key);
  assert.equal(master.state.members,undefined);
  assert.ok(!JSON.stringify(master).includes(a));
  assert.equal((await r.view(a)).characterId,'lyra');
});

test('escolha concorrente é exclusiva e criar personagem associa ao jogador',async()=>{
  const r=await room();
  const a=await r.join('a'),b=await r.join('b');
  const responses=await Promise.all([r.action(a,'characterClaim',{id:'lyra'}),r.action(b,'characterClaim',{id:'lyra'})]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  const selectedA=(await r.view(a)).characterId==='lyra';
  const winner=selectedA?a:b,loser=selectedA?b:a;
  assert.equal((await r.action(winner,'character',{name:'Segundo personagem'})).status,409);
  const created=await r.action(loser,'character',{name:'Novo herói',values:{f1:'7'}});
  assert.equal(created.status,200);
  const state=await created.json();
  assert.ok(state.characterId);
  assert.equal(state.state.characters.find(c=>c.id===state.characterId).values.f1,'7');
  assert.equal((await r.action(winner,'characterClaim',{id:'dorian'})).status,409);
});

test('jogador não altera ficha, retrato nem tokens de outro personagem',async()=>{
  const r=await room();
  const a=await r.join('a');
  await r.action(a,'characterClaim',{id:'lyra'});
  for (const [action,data] of [
    ['character',{id:'dorian',name:'Invadido'}],
    ['sheetFields',{id:'dorian',fields:[]}],
    ['sheetCounter',{id:'dorian',field:'f4',step:-1}],
    ['sheetEntry',{id:'dorian',category:'skills',operation:'save',name:'Invadida'}],
    ['sheetPortraitDelete',{id:'dorian'}],
    ['tokenMove',{id:'dorian',x:1,y:1}],
    ['characterVisibility',{id:'dorian',hidden:true}],
    ['characterRelease',{id:'dorian'}]
  ]) assert.equal((await r.action(a,action,data)).status,403,action);
  const portrait=await api(new Request('http://app/api/campaigns'+r.base+'/portrait',{
    method:'POST',headers:{Authorization:'Bearer '+a,'Content-Type':'image/webp','X-Character-Id':'dorian'},body:'bytes'
  }),r.store);
  assert.equal(portrait.status,403);
  assert.equal((await r.action(a,'character',{id:'lyra',name:'Lyra',values:{f1:'8'}})).status,200);
  assert.equal((await r.action(a,'tokenMove',{id:'lyra',x:1,y:1})).status,200);
});

test('ficha oculta some de resumos, detalhes, retratos e rolagens e o mestre pode liberar ficha',async()=>{
  const r=await room();
  const a=await r.join('a'),b=await r.join('b');
  await r.action(a,'characterClaim',{id:'lyra'});
  const raw=r.rows.get(r.created.id);
  raw.state.characters.find(c=>c.id==='lyra').portrait={id:'11111111-1111-1111-1111-111111111111',name:'Segredo',type:'image/webp',size:1};
  r.assets.set(r.created.id+'/11111111-1111-1111-1111-111111111111',new Blob(['x']));
  await r.action(a,'roll',{formula:'1d20'});
  assert.equal((await r.action(r.created.key,'characterVisibility',{id:'lyra',hidden:true})).status,200);
  for (const key of [a,b,r.created.invite]) {
    const view=await r.view(key);
    assert.ok(view.state.characters.every(c=>c.id!=='lyra'));
    assert.ok(view.state.rolls.every(roll=>roll.characterId!=='lyra'));
    const asset=await r.request(r.base+'/asset/11111111-1111-1111-1111-111111111111','GET',key);
    assert.equal(asset.status,404);
  }
  assert.equal((await r.view(a)).needsCharacter,true);
  assert.equal((await r.action(b,'characterClaim',{id:'lyra'})).status,404);
  const master=await r.view(r.created.key);
  assert.equal(master.state.characters.find(c=>c.id==='lyra').hidden,true);
  await r.action(r.created.key,'characterVisibility',{id:'lyra',hidden:false});
  await r.action(b,'characterClaim',{id:'lyra'});
  await r.action(r.created.key,'characterRelease',{id:'lyra'});
  assert.equal((await r.view(b)).needsCharacter,true);
  assert.equal((await r.action(a,'characterClaim',{id:'lyra'})).status,200);
});

test('somente o mestre controla trilha e soundboard e todos recebem os mesmos horários',async()=>{
  const r=await room();
  const a=await r.join('a');
  await r.action(a,'characterClaim',{id:'lyra'});
  for (const [action,data] of [
    ['track',{command:'load',url:'M7lc1UVf-VE'}],['track',{command:'pause'}],['soundPlay',{id:'door'}],['soundDelete',{id:'x'}]
  ]) assert.equal((await r.action(a,action,data)).status,403,action);
  await r.action(r.created.key,'track',{command:'load',url:'M7lc1UVf-VE'});
  await r.action(r.created.key,'soundPlay',{id:'door'});
  const master=await (await r.request(r.base+'/sync','GET',r.created.key)).json();
  const player=await (await r.request(r.base+'/sync','GET',a)).json();
  assert.deepEqual(master.state.audio.cues,player.state.audio.cues);
  assert.equal(master.state.audio.track.video,player.state.audio.track.video);
  assert.equal(master.state.audio.track.changed,player.state.audio.track.changed);
  assert.equal(player.state.audio.track.title,'Trilha da mesa');
  const track=player.state.audio.track;
  assert.ok(track.changed>player.serverTime);
  assert.ok(player.state.audio.cues[0].at>player.serverTime);
  assert.equal(effectiveTrack(track,track.changed-1),null);
  assert.equal(effectiveTrack(track,track.changed),track);
  const raw=r.rows.get(r.created.id);
  raw.state.audio.track={...track,changed:Date.now()-5000};
  const paused=await (await r.action(r.created.key,'track',{command:'pause'})).json();
  const pause=paused.state.audio.track;
  assert.equal(effectiveTrack(pause,pause.changed-1).playing,true);
  assert.equal(effectiveTrack(pause,pause.changed).playing,false);
  assert.ok(pause.position>=6);
});

test('tokens antigos de exemplo seguem a ficha e vínculos removidos continuam independentes',async()=>{
  const r=await room();
  const stored=r.rows.get(r.created.id);
  delete stored.state.tokens.find(token=>token.id==='lyra').characterId;
  const a=await r.join('a');
  await r.action(a,'characterClaim',{id:'lyra'});
  assert.equal((await r.view(a)).state.tokens.find(token=>token.id==='lyra').canMove,true);
  assert.equal((await r.action(a,'tokenMove',{id:'lyra',x:1,y:1})).status,200);
  await r.action(r.created.key,'tokenUpdate',{id:'lyra',characterId:''});
  assert.equal((await r.action(a,'tokenMove',{id:'lyra',x:2,y:2})).status,403);
});

test('rolagens do mestre e legado sem autor ficam fora das respostas dos jogadores',async()=>{
 const r=await room(),a=await r.join('a'),b=await r.join('b');
 await r.action(a,'characterClaim',{id:'lyra'});await r.action(b,'characterClaim',{id:'dorian'});
 const stored=r.rows.get(r.created.id);
 stored.state.rolls=[{id:'legacy-private',actor:'Lyra Vesper',formula:'1d20+7777',total:7778,dice:[1]}];
 const privateResponse=await r.action(r.created.key,'roll',{formula:'1d20+9999',actor:'Lyra Vesper',characterId:'lyra',visibility:'public',rolledBy:'player'});
 assert.equal(privateResponse.status,200);
 const privateRoll=(await privateResponse.json()).state.rolls[0];
 assert.equal(privateRoll.visibility,'gm');assert.equal(privateRoll.rolledBy,'master');
 const publicResponse=await r.action(a,'roll',{formula:'2d6+3',actor:'Mestre',visibility:'gm',rolledBy:'master'});
 const publicRoll=(await publicResponse.json()).state.rolls[0];
 assert.equal(publicRoll.visibility,'public');assert.equal(publicRoll.rolledBy,'player');assert.equal(publicRoll.actor,'Lyra Vesper');
 for(const key of [a,b,r.created.invite]) {
   const full=await r.view(key);
   assert.deepEqual(full.state.rolls.map(roll=>roll.id),[publicRoll.id]);
   const sync=await(await r.request(r.base+'/sync','GET',key)).json();
   assert.deepEqual(sync.state.rolls.map(roll=>roll.id),[publicRoll.id]);
   assert.ok(!JSON.stringify(sync).includes(privateRoll.id));
   assert.ok(!JSON.stringify(full).includes('7777'));
   assert.ok(!JSON.stringify(full).includes('9999'));
 }
 const actionResult=await(await r.action(b,'tablePing',{x:1,y:1})).json();
 assert.deepEqual(actionResult.state.rolls.map(roll=>roll.id),[publicRoll.id]);
 assert.equal((await r.view(r.created.key)).state.rolls.length,3);
});

test('rolagens privadas não substituem o histórico público nem geram eventos para jogadores',async()=>{
 const r=await room(),a=await r.join('a');await r.action(a,'characterClaim',{id:'lyra'});
 await r.action(a,'roll',{formula:'1d6'});
 const before=await(await r.request(r.base+'/sync','GET',a)).json();
 for(let i=0;i<43;i++)assert.equal((await r.action(r.created.key,'roll',{formula:'1d20+9'})).status,200);
 const unchanged=await(await r.request(r.base+'/sync?rollVersion='+before.rollVersion,'GET',a)).json();
 assert.equal(unchanged.rollVersion,before.rollVersion);assert.equal(unchanged.state.rolls,undefined);
 const master=await r.view(r.created.key),player=await r.view(a);
 assert.equal(master.state.rolls.length,41);assert.equal(player.state.rolls.length,1);
 assert.equal(player.state.rolls[0].id,before.state.rolls[0].id);
 await r.action(r.created.key,'characterVisibility',{id:'lyra',hidden:true});
 const withdrawn=await(await r.request(r.base+'/sync?rollVersion='+before.rollVersion,'GET',a)).json();
 assert.deepEqual(withdrawn.state.rolls,[]);assert.notEqual(withdrawn.rollVersion,before.rollVersion);
});


test('conjuração feita pelo mestre também permanece privada',async()=>{
 const r=await room(),a=await r.join('a');await r.action(a,'characterClaim',{id:'lyra'});
 const response=await r.action(r.created.key,'character',{name:'Conjurador',dnd:{classId:'wizard',speciesId:'dwarf',backgroundId:'sage',scoreMethod:'array',scores:{str:8,dex:12,con:13,int:15,wis:14,cha:10},boost2:'int',boost1:'wis',skills:['insight','investigation']}});
 const id=(await response.json()).state.characters.at(-1).id;
 await r.action(r.created.key,'dndAdd',{id,entryId:'spell-fire-bolt'});
 const cast=await(await r.action(r.created.key,'dndCast',{id,entryId:'spell-fire-bolt'})).json();
 assert.equal(cast.state.rolls[0].rolledBy,'master');assert.equal(cast.state.rolls[0].visibility,'gm');
 assert.deepEqual((await r.view(a)).state.rolls,[]);
 assert.deepEqual((await(await r.request(r.base+'/sync','GET',a)).json()).state.rolls,[]);
});

test('paleta ampliada e destaque personalizado determinam a cor confiável da rolagem',async()=>{
 const r=await room(),a=await r.join('a');await r.action(a,'characterClaim',{id:'lyra'});
 for(const color of ['cyan','red','emerald','ivory','slate']){
  const saved=await(await r.action(a,'character',{id:'lyra',name:'Lyra Vesper',concept:'Arcanista',color})).json();assert.equal(saved.state.characters[0].color,color);
  const roll=await(await r.action(a,'roll',{formula:'1d20',diceColor:'#000000'})).json();assert.match(roll.state.rolls[0].diceColor,/^#[a-f0-9]{6}$/i);assert.notEqual(roll.state.rolls[0].diceColor,'#000000');
 }
 const {defaultSheetAppearance}=await import('../sheet-layout.mjs'),current=(await r.view(a)).state,character=current.characters.find(c=>c.id==='lyra');
 const appearance=defaultSheetAppearance(current,character);appearance.options.accent='#123abc';
 assert.equal((await r.action(a,'sheetAppearance',{id:'lyra',expectedVersion:0,appearance})).status,200);
 const result=await(await r.action(a,'roll',{formula:'2d6'})).json();assert.equal(result.state.rolls[0].diceColor,'#123abc');
 await r.action(a,'character',{id:'lyra',name:'Lyra Vesper',color:'gold'});const custom=await(await r.action(a,'roll',{formula:'2d6'})).json();assert.equal(custom.state.rolls[0].diceColor,'#123abc');
 const button=await r.action(a,'sheetEntry',{id:'lyra',category:'rollButtons',operation:'save',name:'Iniciativa',formula:'1d20'});assert.equal(button.status,200);
 const own=(await button.json()).state.characters.find(c=>c.id==='lyra');const initiative=own.rollButtons.find(b=>b.name==='Iniciativa');
 const rolled=await(await r.action(a,'roll',{rollId:initiative.id})).json();assert.equal(rolled.state.rolls[0].kind,'initiative');
});

test('grupos rivais separam fichas e rolagens; revelar nome não concede acesso à ficha',async()=>{
 const r=await room(),master=r.created.key,a=await r.join('a'),b=await r.join('b');
 assert.deepEqual((await r.view(master)).state.parties,[]);
 assert.equal((await r.action(a,'partySave',{name:'Ilhas'})).status,403);
 const create=async name=>(await(await r.action(master,'partySave',{name})).json()).state.parties.at(-1).id;
 const north=await create('Norte'),south=await create('Sul'),west=await create('Oeste');
 assert.equal((await r.view(a)).state.parties,undefined);
 const assign=(id,party,revealed=false,key=master)=>r.action(key,'characterParty',{id,party,revealed});
 await r.action(a,'characterClaim',{id:'lyra'});await r.action(b,'characterClaim',{id:'dorian'});
 assert.equal((await assign('lyra',north)).status,200);
 assert.equal((await assign('dorian',south)).status,200);
 assert.equal((await assign('dorian',north,true,b)).status,403);
 await r.action(b,'roll',{formula:'1d6'});
 await r.action(b,'tablePing',{x:1,y:1});
 for(const key of [a,r.created.invite]){
  const {state}=await r.view(key);
  assert.ok(!state.characters.some(c=>c.id==='dorian'));
  const marker=state.tokens.find(t=>t.id==='dorian');
  assert.equal(marker.name,'???');assert.equal(marker.characterId,'');assert.equal(marker.canMove,false);
  assert.equal(state.table.pings.at(-1).name,'???');
  assert.ok(!state.rolls.some(roll=>roll.characterId==='dorian'));
 }
 assert.equal((await r.view(b)).state.characters.find(c=>c.id==='dorian').access,'full');
 const d=(await r.view(master)).state.characters.find(c=>c.id==='dorian');
 await assign('dorian',south,true);
 const sync=await(await r.request(r.base+'/sync?table=1','GET',a)).json();
 assert.equal(sync.state.tokens.find(t=>t.id==='dorian').name,d.name);
 assert.ok(!sync.state.rolls.some(roll=>roll.characterId==='dorian'));
 assert.ok(!(await r.view(a)).state.characters.some(c=>c.id==='dorian'));
 await assign('dorian',north);
 assert.equal((await r.view(a)).state.characters.find(c=>c.id==='dorian').access,'summary');
 await assign('mira',west);
 const newcomer=await r.join('c');
 assert.equal((await r.action(newcomer,'characterClaim',{id:'mira'})).status,404);
 const privateCode=async()=>(await(await r.request(r.base+'/player-access','POST',master,{characterId:'mira',reserve:true})).json()).code;
 const code=await privateCode();assert.equal(await privateCode(),code);
 assert.equal((await r.view(code.split('.')[1])).characterId,'mira');
 await r.action(master,'partySave',{id:west,name:'Ilhas'});
 assert.equal((await r.view(master)).state.characters.find(c=>c.id==='mira').party,west);
 await r.action(master,'partyDelete',{id:west});
 assert.equal((await r.view(master)).state.characters.find(c=>c.id==='mira').party,undefined);
 assert.ok((await r.view(a)).state.characters.some(c=>c.id==='mira'));
 assert.equal((await assign('mira',west)).status,400);
});


test('grupos antigos só aparecem quando usados e preservam os nomes já revelados',async()=>{
 const r=await room(),key=r.created.key;
 const legacy=r.rows.get(r.created.id).state.characters[0];
 legacy.party='a';legacy.partyRevealed=true;
 assert.deepEqual((await r.view(key)).state.parties,[{id:'a',name:'Grupo A'}]);
 await r.action(key,'partySave',{id:'a',name:'Vigias'});
 const updated=(await r.view(key)).state;
 assert.deepEqual(updated.parties,[{id:'a',name:'Vigias'}]);
 assert.equal(updated.characters[0].partyRevealed,true);
});

test('cinemática experimental protege preparação, mídia e transmissão por grupo',async()=>{
 const r=await room(),gm=r.created.key,player=await r.join('a'),rival=await r.join('b');
 await r.action(player,'characterClaim',{id:'lyra'});await r.action(rival,'characterClaim',{id:'dorian'});
 const group=(await(await r.action(gm,'partySave',{name:'Vigias'})).json()).state.parties[0].id;
 await r.action(gm,'characterParty',{id:'lyra',party:group,revealed:false});
 const upload=(key,type='image/gif')=>api(new Request('http://app/api/campaigns'+r.base+'/cinematic',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':type},body:'GIF89a'}),r.store);
 assert.equal((await upload(player)).status,403);
 const asset=(await(await upload(gm)).json()).state.cinematicLibrary[0];
 const track=(await(await upload(gm,'audio/ogg')).json()).state.cinematicLibrary.at(-1);
 const music=key=>r.request(r.base+'/asset/'+track.id,'GET',key);
 const get=key=>r.request(r.base+'/asset/'+asset.id,'GET',key);
 const config={captionSpeed:'dramatic',transition:'ink',reveal:'slit',revealSeconds:1.5,accent:'#637590',background:'#041528',lettering:'#ffcc99',name:'Final secreto',text:'O tempo acordou',intro:4,duration:15,mediaId:asset.id,soundtrackId:track.id,party:group};
 assert.equal((await get(player)).status,404);
 for(const invalid of [{captionSpeed:'unknown'},{transition:'unknown'},{reveal:'unknown'},{revealSeconds:-1},{accent:'blue'}]){
  assert.equal((await r.action(gm,'cinematicSave',{...config,...invalid})).status,400);
 }
 assert.equal((await music(player)).status,404);
 assert.equal((await r.action(gm,'cinematicSave',{...config,soundtrackId:asset.id})).status,404);
 assert.equal((await r.action(gm,'cinematicSave',{...config,mediaId:track.id})).status,404);
 const saved=(await(await r.action(gm,'cinematicSave',config)).json()).state.cinematicCues.at(-1);
 for(const field of ['captionSpeed','soundtrackId','reveal','transition','revealSeconds','accent','background','lettering'])assert.equal(saved[field],config[field]);
 assert.equal((await r.view(player)).state.cinematicCues,undefined);
 assert.equal((await r.action(player,'cinematicStart',config)).status,403);
 const run=(await(await r.action(gm,'cinematicStart',config)).json()).state.cinematic;
 const sync=async key=>(await(await r.request(r.base+'/sync','GET',key)).json()).state.cinematic;
 const presentation=await sync(player);for(const field of ['captionSpeed','soundtrackId','reveal','transition','revealSeconds','accent','background','lettering'])assert.equal(presentation[field],config[field]);
 assert.equal(presentation.id,run.id);assert.equal(run.revealAt-run.startedAt,4000);
 assert.equal((await get(player)).status,200);
 assert.equal((await music(player)).status,200);
 for(const key of [rival,r.created.invite]){assert.equal(await sync(key),null);assert.equal((await music(key)).status,404);assert.equal((await get(key)).status,404);}
 await r.action(gm,'cinematicStop',{id:'exibição anterior'});assert.equal((await sync(player)).id,run.id);
 await r.action(gm,'cinematicStop',{id:run.id});assert.equal(await sync(player),null);assert.equal((await music(player)).status,404);
 assert.equal((await get(player)).status,404);
});

test('relógios e passagem de sessão respeitam público, versão e acesso ao material original',async()=>{
 const r=await room(),gm=r.created.key,a=await r.join('a'),b=await r.join('b');
 await r.action(a,'characterClaim',{id:'lyra'});await r.action(b,'characterClaim',{id:'dorian'});
 const group=(await(await r.action(gm,'partySave',{name:'Expedição'})).json()).state.parties.at(-1).id;
 await r.action(gm,'characterParty',{id:'lyra',party:group,revealed:false});
 const clock={title:'Alarme do cais',audience:group,segments:4,value:2};
 assert.equal((await r.action(a,'clockSave',clock)).status,403);
 const saved=(await(await r.action(gm,'clockSave',clock)).json()).state.sessionLog.clocks.at(-1);
 const step={id:saved.id,version:saved.version,step:1};
 assert.equal((await r.action(gm,'clockStep',step)).status,200);
 assert.equal((await r.action(gm,'clockStep',step)).status,409);
 assert.equal((await r.view(a)).state.sessionLog.clocks[0].value,3);
 const entry=(await(await r.action(gm,'journalSave',{kind:'note',title:'Segredo do mestre',body:'Não compartilhar',audience:'private'})).json()).state.journal.at(-1);
 const data={title:'Ao anoitecer',body:'A guarda ouviu o sino.',audience:group,sessionId:'session-initial',linkedSceneId:'scene-initial',notes:[entry.id]};
 const response=await r.action(gm,'recapSave',data);
 assert.equal(response.status,200);const recap=(await response.json()).state.sessionLog.recaps[0];assert.deepEqual(recap.notes,[entry.id]);
 const player=(await r.view(a)).state.sessionLog.recaps[0];
 assert.equal(player.body,data.body);assert.equal(player.sceneId,data.linkedSceneId);assert.deepEqual(player.notes,[]);
 for(const key of [b,r.created.invite])assert.deepEqual((await r.view(key)).state.sessionLog,{clocks:[],recaps:[]});
 await r.action(gm,'partyDelete',{id:group});
 assert.deepEqual((await r.view(a)).state.sessionLog,{clocks:[],recaps:[]});
});

test('pedidos coletivos respeitam os destinatários e a CD privada, mesmo em requisições concorrentes',async()=>{
 const r=await room(),gm=r.created.key,a=await r.join('a'),b=await r.join('b'),c=await r.join('c');
 await r.action(a,'characterClaim',{id:'lyra'});
 await r.action(b,'characterClaim',{id:'dorian'});
 const config={characterIds:['lyra','dorian'],test:'attribute:forca',dc:19};
 assert.equal((await r.action(a,'checkCreate',config)).status,403);
 assert.equal((await r.action(gm,'checkCreate',{...config,test:'attribute:nivel'})).status,400);
 const request=(await(await r.action(gm,'checkCreate',config)).json()).state.checkRequests[0];
 assert.equal(request.targets.length,2);
 const own=(await r.view(a)).state.checkRequests[0];
 assert.deepEqual(own.targets.map(t=>t.characterId),['lyra']);
 assert.equal(own.dc,undefined);assert.equal(own.targets[0].memberId,undefined);
 for(const key of [c,r.created.invite])assert.deepEqual((await r.view(key)).state.checkRequests,[]);
 assert.equal((await r.action(c,'checkRespond',{id:request.id})).status,403);
 const responses=await Promise.all([1,2].map(()=>r.action(a,'checkRespond',{id:request.id,formula:'1d10000',mode:'advantage',characterId:'dorian'})));
 for(const response of responses)assert.equal(response.status,200);
 const results=await Promise.all(responses.map(async response=>(await response.json()).state.checkRequests[0].targets[0].result));
 assert.equal(results[0].id,results[1].id);assert.equal(results[0].formula,'1d20+1');
 const partial=async key=>(await(await r.request(r.base+'/sync?table=1','GET',key)).json()).state;
 assert.deepEqual((await partial(b)).checkRequests[0].targets.map(t=>t.result),[null]);
 assert.deepEqual((await partial(a)).rolls,[]);assert.deepEqual((await partial(gm)).rolls,[]);
 const snapshot=await r.view(gm);
 const unchanged=await(await r.request(r.base+'/sync?table=1&checks='+snapshot.checkVersion,'GET',gm)).json();
 assert.equal(unchanged.state.checkRequests,undefined);
 const report=snapshot.state.checkRequests[0];assert.equal(report.targets[0].result.groups,undefined);assert.equal(report.targets[0].result.id,results[0].id);assert.equal(report.dc,19);
 await r.action(gm,'characterRelease',{id:'lyra'});await r.action(c,'characterClaim',{id:'lyra'});
 assert.deepEqual((await partial(c)).checkRequests,[]);assert.equal((await r.action(c,'checkRespond',{id:request.id})).status,403);
 assert.equal((await r.action(b,'checkClose',{id:request.id})).status,403);await r.action(gm,'checkClose',{id:request.id});
 assert.deepEqual((await partial(b)).checkRequests,[]);
});

test('pedido de Essência usa a maestria da própria ficha uma única vez',async()=>{
 const r=await room(),gm=r.created.key,a=await r.join('a');
 const sheet=(await(await r.action(gm,'character',{name:'Anuki',preset:'herdeiros-destino',values:{'hd-essence':'2'}})).json()).state.characters.at(-1);
 await r.action(a,'characterClaim',{id:sheet.id});
 const check=(await(await r.action(gm,'checkCreate',{characterIds:[sheet.id],test:'attribute:essencia',dc:8,showDc:true})).json()).state.checkRequests[0];
 const send=()=>r.action(a,'checkRespond',{id:check.id,masteryId:'hd-mastery'});
 const out=await(await send()).json();
 assert.equal(out.state.checkRequests[0].dc,8);assert.equal(out.state.checkRequests[0].targets[0].result.formula,'2d6+2+1d4');
 const retry=await(await send()).json();assert.equal(retry.state.checkRequests[0].targets[0].result.id,out.state.checkRequests[0].targets[0].result.id);
 assert.equal(retry.state.characters.find(x=>x.id===sheet.id).masteries[0].remaining,0);
});
