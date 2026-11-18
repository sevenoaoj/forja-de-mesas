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
