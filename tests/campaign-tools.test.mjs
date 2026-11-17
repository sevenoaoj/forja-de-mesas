import test from 'node:test';
import assert from 'node:assert/strict';
import {api,sceneView} from '../api.mjs';
import {accessFor} from '../access.mjs';
import {dndCharacter,dndClasses} from '../dnd.mjs';
async function room(){
 const rows=new Map();let conflict=null;
 const store={async get(id){return structuredClone(rows.get(id));},async create(row){rows.set(row.id,structuredClone(row));},async save(row){if(conflict){const callback=conflict;conflict=null;const newer=structuredClone(rows.get(row.id));callback(newer);newer.rev++;rows.set(row.id,newer);return false;}if(rows.get(row.id)?.rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await call('','POST',null,{name:'Ferramentas',example:true})).json(),base='/'+created.id,owner='a'.repeat(64),other='b'.repeat(64),newcomer='c'.repeat(64);
 for(const key of [owner,other,newcomer])assert.equal((await call(base+'/join','POST',created.invite,{key})).status,200);
 const action=(action,data,key=owner)=>call(base+'/action','POST',key,{action,data});
 assert.equal((await action('characterClaim',{id:'lyra'})).status,200);assert.equal((await action('characterClaim',{id:'dorian'},other)).status,200);
 return {rows,created,owner,other,newcomer,base,call,action,view:async(key=owner)=>(await call(base,'GET',key)).json(),race(callback){conflict=callback;}};
}
async function success(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
test('API registra alterações reais e permite restaurar só própria ficha, com revisão nova',async()=>{
 const r=await room(),before=await r.view(),original=before.state.characters.find(c=>c.id==='lyra');
 const changed=await success(await r.action('sheetCounter',{id:'lyra',field:'f4',step:-1})),c=changed.state.characters.find(c=>c.id==='lyra'),entry=c.sheetHistory.entries[0];
 assert.equal(c.sheetHistory.version,1);assert.match(entry.summary,/18\/22 → 17\/22/);
 const data={id:'lyra',entryId:entry.id,expectedVersion:1};assert.equal((await r.action('sheetHistoryRestore',data,r.other)).status,403);assert.equal((await r.action('sheetHistoryRestore',data,r.created.invite)).status,403);
 const restored=await success(await r.action('sheetHistoryRestore',data)),next=restored.state.characters.find(c=>c.id==='lyra');assert.equal(next.values.f4,original.values.f4);assert.equal(next.sheetHistory.version,2);assert.equal(next.sheetHistory.entries.length,2);
 assert.equal((await r.action('sheetHistoryRestore',data)).status,409);assert.equal((await r.view(r.other)).state.characters.find(c=>c.id==='lyra').sheetHistory,undefined);
});
test('captura de histórico ocorre novamente ao repetir CAS e falhas não deixam entradas',async()=>{
 const r=await room(),before=r.rows.get(r.created.id).rev;
 assert.equal((await r.action('sheetCounter',{id:'lyra',field:'f4',step:99})).status,400);assert.equal(r.rows.get(r.created.id).rev,before);
 r.race(row=>row.state.characters.find(c=>c.id==='lyra').values.f4='19/22');
 const view=await success(await r.action('sheetCounter',{id:'lyra',field:'f4',step:-1})),character=view.state.characters.find(c=>c.id==='lyra');
 assert.equal(character.values.f4,'18/22');assert.equal(character.sheetHistory.version,1);assert.equal(character.sheetHistory.entries.length,1);assert.equal(character.sheetHistory.entries[0].before.values.f4,'19/22');
});
test('modelos privados são filtrados e modelo compartilhado cria personagem com estrutura própria',async()=>{
 const r=await room();
 await success(await r.action('sheetTemplateSave',{characterId:'lyra',name:'Privado',shared:false}));await success(await r.action('sheetTemplateSave',{characterId:'lyra',name:'Sistema compartilhado',shared:true,includeAppearance:true}));
 const own=(await r.view()).state.sheetTemplates.items,privateId=own.find(t=>t.name==='Privado').id,shared=own.find(t=>t.shared);
 assert.equal(own.every(item=>!Object.hasOwn(item,'owner')),true);assert.equal((await r.view(r.other)).state.sheetTemplates.items.length,1);
 assert.equal((await r.action('character',{name:'Intruso',templateId:privateId},r.newcomer)).status,403);
 const view=await success(await r.action('character',{name:'Novo herói',templateId:shared.id,color:'blue'},r.newcomer)),character=view.state.characters.find(c=>c.name==='Novo herói');
 assert.deepEqual(character.layout,shared.fields);assert.equal(character.values.f4,'22/22');assert.equal(character.skills.length,3);assert.equal(character.access,'full');assert.equal(character.abilities.length,0);assert.equal(character.portrait,undefined);assert.equal(character.sheetHistory,undefined);assert.equal(character.name,'Novo herói');
 assert.equal((await r.action('character',{name:'Conflito',templateId:shared.id,preset:'herdeiros-destino'},r.created.key)).status,400);
});
test('aplicar modelo existente integra histórico, conflitos e restauração reversível',async()=>{
 const r=await room();await success(await r.action('sheetTemplateSave',{characterId:'lyra',name:'Base',shared:true}));const template=(await r.view()).state.sheetTemplates.items[0];
 await success(await r.action('sheetCounter',{id:'lyra',field:'f4',step:-1}));
 const apply={templateId:template.id,characterId:'lyra',expectedVersion:template.version,expectedHistoryVersion:0};assert.equal((await r.action('sheetTemplateApply',apply)).status,409);
 apply.expectedHistoryVersion=1;const changed=await success(await r.action('sheetTemplateApply',apply)),character=changed.state.characters.find(c=>c.id==='lyra');assert.equal(character.values.f4,'22/22');assert.equal(character.sheetHistory.version,2);assert.equal(character.sheetHistory.entries[0].before.values.f4,'17/22');
 const restored=await success(await r.action('sheetHistoryRestore',{id:'lyra',entryId:character.sheetHistory.entries[0].id,expectedVersion:2}));assert.equal(restored.state.characters.find(c=>c.id==='lyra').values.f4,'17/22');
});
test('diário entrega só documentos permitidos sem notas privadas em GET, ação ou sync',async()=>{
 const r=await room();
 for(const data of [{title:'Preparação oculta',body:'segredo privado',gmNotes:'anotação mestre',audience:'private'},{title:'Pista pública',body:'A torre está vazia',gmNotes:'mestre segredo',audience:'all'},{title:'Segredo de Lyra',body:'pista individual',gmNotes:'outro segredo',audience:'selected',recipientIds:['lyra']}])await success(await r.action('journalSave',data,r.created.key));
 const own=(await r.view()).state.journal,other=(await r.view(r.other)).state.journal,guest=(await r.view(r.created.invite)).state.journal;
 assert.equal(own.length,2);assert.equal(other.length,1);assert.deepEqual(guest,[]);assert.ok(own.every(e=>!Object.hasOwn(e,'gmNotes')&&!Object.hasOwn(e,'recipientIds')&&!Object.hasOwn(e,'audience')));
 assert.equal((await r.action('journalSave',{id:own[0].id,version:own[0].version,title:'Injetado',audience:'all'})).status,403);
 const actionView=await success(await r.action('sheetCounter',{id:'lyra',field:'f4',step:-1}));assert.equal(actionView.state.journal.length,2);assert.ok(!JSON.stringify(actionView).includes('mestre segredo'));
 const master=(await r.view(r.created.key)).state.journal;assert.equal(master.length,3);assert.equal(master[0].gmNotes,'anotação mestre');
});
test('snapshots SSE e sync têm apenas marcadores filtrados de diário/modelos',async()=>{
 const r=await room(),snapshot=key=>{const row=r.rows.get(r.created.id);return sceneView(row,accessFor(row,key));},original=snapshot(r.other);
 await success(await r.action('journalSave',{title:'Documento privado',body:'segredo do documento',gmNotes:'segredo mestre',audience:'private'},r.created.key));
 await success(await r.action('sheetTemplateSave',{characterId:'lyra',name:'Modelo privado invisível',shared:false}));
 const invisible=snapshot(r.other);assert.equal(invisible.state.journalVersion,original.state.journalVersion);assert.equal(invisible.state.sheetTemplatesVersion,original.state.sheetTemplatesVersion);
 await success(await r.action('journalSave',{title:'Pública',body:'conteúdo público completo',audience:'all'},r.created.key));
 await success(await r.action('sheetTemplateSave',{characterId:'lyra',name:'Compartilhado',shared:true}));
 const visible=snapshot(r.other);assert.notEqual(visible.state.journalVersion,original.state.journalVersion);assert.notEqual(visible.state.sheetTemplatesVersion,original.state.sheetTemplatesVersion);
 for(const key of [r.other,r.created.key]){const snap=snapshot(key);assert.equal(snap.state.journal,undefined);assert.equal(snap.state.sheetTemplates,undefined);assert.ok(!JSON.stringify(snap).includes('segredo'));assert.ok(!JSON.stringify(snap).includes('conteúdo público completo'));}
 const sync=await(await r.call(r.base+'/sync?table=1','GET',r.other)).json();assert.equal(sync.state.journal,undefined);assert.equal(sync.state.sheetTemplates,undefined);assert.equal(sync.state.journalVersion,visible.state.journalVersion);
});
test('homônimo oculto não esconde rolagem de personagem visível identificado',async()=>{
 const r=await room();await success(await r.action('character',{name:'Lyra Vesper',hidden:true,color:'red'},r.created.key));
 const view=await success(await r.action('roll',{formula:'1d20'}));assert.equal(view.state.rolls.length,1);assert.equal(view.state.rolls[0].characterId,'lyra');
 const row=r.rows.get(r.created.id),hidden=row.state.characters.find(c=>c.hidden);row.state.rolls.push({id:'legacy',actor:'Lyra Vesper',rolledBy:'player',visibility:'public'},{id:'hidden',actor:'Outro nome',characterId:hidden.id,rolledBy:'player',visibility:'public'});
 const player=await r.view();assert.deepEqual(player.state.rolls.map(roll=>roll.id),[view.state.rolls[0].id]);assert.equal((await r.view(r.created.key)).state.rolls.length,3);
});
test('rolagem com maestria registra consumo uma vez sem registrar rolagem comum',async()=>{
 const r=await room(),row=r.rows.get(r.created.id),character=row.state.characters.find(c=>c.id==='lyra');character.masteries=[{id:'m',name:'Maestria',attributeId:'f1',die:'1d4',remaining:1}];
 let view=await success(await r.action('roll',{attributeId:'f1'}));assert.equal(view.state.characters.find(c=>c.id==='lyra').sheetHistory,undefined);
 view=await success(await r.action('roll',{attributeId:'f1',masteryId:'m'}));const c=view.state.characters.find(c=>c.id==='lyra');assert.equal(c.sheetHistory.version,1);assert.equal(c.sheetHistory.entries.length,1);assert.equal(c.sheetHistory.entries[0].before.masteries[0].remaining,1);assert.equal(c.masteries[0].remaining,0);
});

test('conjuração aninhada registra um único consumo e preserva rolagem privada do mestre',async()=>{
 const r=await room(),cls=dndClasses.find(c=>c.id==='wizard'),config={classId:'wizard',speciesId:'dwarf',backgroundId:'sage',scoreMethod:'array',scores:Object.fromEntries(['str','dex','con','int','wis','cha'].map((id,i)=>[id,cls.array[i]])),boost2:'int',boost1:'wis',skills:cls.skills.filter(id=>!['arcana','history'].includes(id)).slice(0,cls.count)};
 Object.assign(r.rows.get(r.created.id).state.characters.find(c=>c.id==='lyra'),dndCharacter(config));
 await success(await r.action('dndAdd',{id:'lyra',entryId:'spell-cure-wounds',allowExtra:true},r.created.key));
 const cast=await success(await r.action('dndCast',{id:'lyra',entryId:'spell-cure-wounds'},r.created.key)),character=cast.state.characters.find(c=>c.id==='lyra');
 assert.equal(character.sheetHistory.version,2);assert.equal(character.sheetHistory.entries.filter(entry=>entry.action==='dndCast').length,1);assert.equal(character.sheetHistory.entries[0].before.values['dd-slot-1'],'2/2');assert.equal(character.values['dd-slot-1'],'1/2');assert.equal(cast.state.rolls.length,1);assert.equal((await r.view()).state.rolls.length,0);
 const restored=await success(await r.action('sheetHistoryRestore',{id:'lyra',entryId:character.sheetHistory.entries[0].id,expectedVersion:2}));assert.equal(restored.state.characters.find(c=>c.id==='lyra').values['dd-slot-1'],'2/2');
});

test('narração privada chega só ao destinatário em GET, sync, SSE e respostas de ações',async()=>{
 const r=await room();
 const sent=await success(await r.action('narrationSend',{characterId:'lyra',title:'Um pressentimento',body:'Você reconhece a voz.'},r.created.key));
 const message=sent.state.narrations[0];assert.ok(message.id);assert.equal(message.readAt,null);
 const raw=r.rows.get(r.created.id),owner=accessFor(raw,r.owner),other=accessFor(raw,r.other);
 assert.equal((await r.view()).state.narrations[0].body,'Você reconhece a voz.');
 for(const key of [r.other,r.created.invite,r.newcomer]){
  const full=await r.view(key),sync=await success(await r.call(r.base+'/sync','GET',key));
  assert.deepEqual(full.state.narrations,[]);assert.deepEqual(sync.state.narrations,[]);
  assert.ok(!JSON.stringify(full).includes('Você reconhece a voz.'));
 }
 assert.equal(sceneView(raw,owner).state.narrations.length,1);assert.deepEqual(sceneView(raw,other).state.narrations,[]);
 assert.equal((await success(await r.call(r.base+'/sync','GET',r.owner))).state.narrations.length,1);
 assert.equal((await r.action('narrationSend',{characterId:'dorian',body:'Invasão'})).status,403);
 assert.equal((await r.action('narrationRead',{id:message.id},r.other)).status,403);
 await success(await r.action('narrationRead',{id:message.id}));
 await success(await r.action('narrationRead',{id:message.id}));
 assert.deepEqual((await r.view()).state.narrations,[]);
 assert.ok((await r.view(r.created.key)).state.narrations[0].readAt);
});
test('narração não passa para novo dono de uma ficha e valida corpo e destinatário',async()=>{
 const r=await room();
 for(const data of [{characterId:'missing',body:'texto'},{characterId:'lyra',body:''},{characterId:'lyra',body:'a'.repeat(4001)}])assert.equal((await r.action('narrationSend',data,r.created.key)).status,400);
 await success(await r.action('narrationSend',{characterId:'lyra',body:'Segredo do jogador original'},r.created.key));
 await success(await r.action('characterRelease',{id:'lyra'},r.created.key));
 await success(await r.action('characterClaim',{id:'lyra'},r.newcomer));
 assert.deepEqual((await r.view(r.newcomer)).state.narrations,[]);
});
test('jogador mantém diário e inventário próprios sem editar documentos alheios nem notas do mestre',async()=>{
 const r=await room();
 const row=await success(await r.action('journalSave',{title:'Mochila',kind:'item',body:'2 poções',gmNotes:'Tentativa de segredo',audience:'private'}));
 const entry=row.state.journal[0];assert.equal(entry.canEdit,true);assert.equal(entry.gmNotes,undefined);
 assert.deepEqual((await r.view(r.other)).state.journal,[]);
 assert.equal((await r.action('journalSave',{id:entry.id,version:entry.version,title:'Roubo'},r.other)).status,403);
 assert.equal((await r.action('journalSave',{title:'Sem ficha'},r.newcomer)).status,403);
 const master=await r.view(r.created.key),masterEntry=master.state.journal[0];assert.equal(masterEntry.gmNotes,'');
 await success(await r.action('journalSave',{...masterEntry,gmNotes:'Uma poção é falsa'},r.created.key));
 await success(await r.action('journalSave',{...entry,version:2,body:'1 poção',gmNotes:'Apagar segredo',audience:'all'}));
 const otherEntry=(await r.view(r.other)).state.journal[0];assert.equal(otherEntry.body,'1 poção');assert.equal(otherEntry.canEdit,false);assert.equal(otherEntry.gmNotes,undefined);
 assert.equal((await r.view(r.created.key)).state.journal[0].gmNotes,'Uma poção é falsa');
 assert.equal((await r.action('journalDelete',{id:entry.id,version:1})).status,409);
 await success(await r.action('journalDelete',{id:entry.id,version:3}));assert.deepEqual((await r.view()).state.journal,[]);
});
test('edição direta aplica só um campo, registra histórico e rejeita conflito e ficha alheia',async()=>{
 const r=await room();
 const data={id:'lyra',field:'f1',before:'1',value:'5'};
 assert.equal((await r.action('sheetValue',data,r.other)).status,403);
 const result=await success(await r.action('sheetValue',data)),character=result.state.characters.find(c=>c.id==='lyra');
 assert.equal(character.values.f1,'5');assert.equal(character.values.f4,'18/22');assert.equal(character.sheetHistory.version,1);
 assert.equal((await r.action('sheetValue',{...data,value:'7'})).status,409);
 r.race(row=>row.state.characters.find(c=>c.id==='lyra').values.f1='9');
 assert.equal((await r.action('sheetValue',{...data,before:'5',value:'8'})).status,409);
 assert.equal((await r.view()).state.characters.find(c=>c.id==='lyra').values.f1,'9');
 assert.equal((await r.action('sheetValue',{id:'lyra',field:'f4',before:'18/22',value:'50/22'})).status,400);
 const named=await success(await r.action('sheetValue',{id:'lyra',property:'name',before:'Lyra Vesper',value:'Lyra da Lua'}));
 assert.equal(named.state.characters.find(c=>c.id==='lyra').name,'Lyra da Lua');
});

test('mestre configura a apresentação; servidor preserva estilo e recusa CSS livre ou cores ilegíveis',async()=>{
 const r=await room();
 const style={font:'typewriter',effect:'typewriter',textColor:'#f5e9d4',backgroundColor:'#1c1522',accentColor:'#e9c982',size:28,speed:35,align:'center'};
 const sent=await success(await r.action('narrationSend',{characterId:'lyra',body:'Uma carta aparece.',style},r.created.key));
 assert.deepEqual(sent.state.narrations[0].style,style);assert.deepEqual((await r.view()).state.narrations[0].style,style);
 for(const invalid of [{font:'url(https://example.com)'},{textColor:'red;display:none'},{textColor:'#000000',backgroundColor:'#000000'},{speed:0},{size:100},{effect:'script'}]){
  assert.equal((await r.action('narrationSend',{characterId:'lyra',body:'teste',style:{...style,...invalid}},r.created.key)).status,400);
 }
 assert.equal((await r.view(r.other)).state.narrations.length,0);
});

test('sync leve mantém a identidade do destinatário da narração',async()=>{
 const r=await room();
 await success(await r.action('narrationSend',{characterId:'lyra',body:'Só uma vez.'},r.created.key));
 const sync=await success(await r.call(r.base+'/sync','GET',r.owner));
 assert.equal(sync.characterId,'lyra');assert.equal(sync.needsCharacter,false);assert.equal(sync.state.narrations.length,1);
 const guest=await success(await r.call(r.base+'/sync','GET',r.created.invite));assert.equal(guest.characterId,null);assert.equal(guest.needsCharacter,true);assert.deepEqual(guest.state.narrations,[]);
});
