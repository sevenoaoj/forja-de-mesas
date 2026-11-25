import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {newCampaign} from '../model.mjs';
import {mutateGmScreen} from '../gm-screen-model.mjs';
import {renderGmScreen,renderGmCards,gmCardEditor,prepList,initiativeRollSpec,rollDiceFormulaLocal} from '../public/gm-screen.mjs';
import {canRepeatRoll} from '../public/rolls.mjs';
import {dndCharacter} from '../dnd.mjs';
async function room(){
 const rows=new Map();
 const store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){await Promise.resolve();if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const request=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await request('','POST',null,{name:'Escudo',example:true})).json(),base='/'+created.id;
 const action=(action,data={},key=created.key)=>request(base+'/action','POST',key,{action,data});
 const view=async(key=created.key)=>(await request(base,'GET',key)).json();
 const save=async data=>{const response=await action('gmCardSave',{kind:'note',category:'session',title:'Segredo do mestre',body:'O duque é o vilão',...data});assert.equal(response.status,200);return response.json();};
 return {created,base,rows,request,action,view,save};
}
test('cartões são persistentes, organizáveis e preservam anotações e fichas antigas',async()=>{
 const r=await room();await r.action('notes',{text:'Notas anteriores'});
 let state=(await r.save({title:'Primeiro'})).state;const first=state.gmScreen.cards[0];
 state=(await r.save({title:'Segundo',kind:'checklist',body:'[ ] Pista\n[x] Cena pronta'})).state;const second=state.gmScreen.cards[1];
 assert.equal(state.notes,'Notas anteriores');assert.equal(state.characters.length,3);
 assert.deepEqual(second.items.map(item=>item.done),[false,true]);
 await r.action('gmCardMove',{id:second.id,direction:-1,targetId:first.id});
 await r.action('gmCardPin',{id:first.id,pinned:true});await r.action('gmCardCollapse',{id:first.id,collapsed:true});
 state=(await r.view()).state;assert.equal(state.gmScreen.cards[0].id,second.id);assert.equal(state.gmScreen.cards[1].pinned,true);assert.equal(state.gmScreen.cards[1].collapsed,true);
 const response=await r.action('gmCardSave',{...first,title:'Renomeado',body:'Atualização'});assert.equal(response.status,200);
 assert.equal((await r.action('gmCardSave',{...first,title:'Edição antiga'})).status,409);
 const fresh=(await r.view()).state.gmScreen.cards.find(card=>card.id===first.id);
 assert.equal(fresh.pinned,true);assert.equal(fresh.collapsed,true);
 assert.equal((await r.action('gmCardDelete',{id:first.id,version:1})).status,409);
 assert.equal((await r.action('gmCardDelete',{id:first.id,version:fresh.version})).status,200);
 assert.equal((await r.view()).state.gmScreen.cards.length,1);
});
test('tarefas usam estado explícito, rejeitam itens inválidos e protegem edições simultâneas',async()=>{
 const r=await room(),card=(await r.save({kind:'checklist',body:'[ ] Investigar\n[ ] Descansar'})).state.gmScreen.cards[0];
 const data={id:card.id,itemId:card.items[0].id,done:true};
 assert.equal((await r.action('gmCardToggle',data)).status,200);await r.action('gmCardToggle',data);
 assert.equal((await r.view()).state.gmScreen.cards[0].items[0].done,true);
 assert.equal((await r.action('gmCardSave',{...card,body:'Texto antigo'})).status,409);
 assert.equal((await r.action('gmCardToggle',{...data,itemId:'inexistente'})).status,400);
 const current=(await r.view()).state.gmScreen.cards[0];
 const responses=await Promise.all([r.action('gmCardSave',{...current,body:'A'}),r.action('gmCardSave',{...current,body:'B'})]);
 assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
});
test('jogadores e convites nunca recebem cartões, tarefas, referências ou resultados secretos',async()=>{
 const r=await room();await r.save({kind:'table',body:'Segredo alfa\nSegredo beta'});
 const member='a'.repeat(64);await r.request(r.base+'/join','POST',r.created.invite,{key:member});await r.action('characterClaim',{id:'lyra'},member);
 const card=(await r.view()).state.gmScreen.cards[0];
 const sync=async key=>(await r.request(r.base+'/sync','GET',key)).json();
 const before=(await sync(member)).rollVersion;
 await r.action('gmTableRoll',{id:card.id});
 for(const key of [member,r.created.invite]){
  assert.equal((await r.view(key)).state.gmScreen,undefined);
  const result=await r.action('roll',{formula:'1d6'},key);
  if(result.status===200)assert.ok(!JSON.stringify(await result.json()).includes('Segredo'));
  for(const action of ['gmPartyFields','gmCardSave','gmCardDelete','gmCardPin','gmCardMove','gmCardToggle','gmCardCollapse','gmTableRoll'])assert.equal((await r.action(action,{...card},key)).status,403,action);
 }
 const after=await sync(member);assert.ok(!JSON.stringify(after).includes('Segredo'));
 // Player's own roll can change the version; private table rolls alone must not.
 const version=after.rollVersion;await r.action('gmTableRoll',{id:card.id});assert.equal((await sync(member)).rollVersion,version);assert.ok(before);
});
test('sorteio usa o servidor, armazena a entrada escolhida e integra o histórico privado',async()=>{
 const r=await room(),card=(await r.save({kind:'table',title:'Encontro secreto',body:'Patrulha\nMercador\nViajante'})).state.gmScreen.cards[0];
 const response=await r.action('gmTableRoll',{id:card.id});assert.equal(response.status,200);
 const row=await response.json(),roll=row.state.rolls[0],last=row.state.gmScreen.cards[0].lastRoll;
 assert.equal(roll.formula,'1d3');assert.equal(roll.rolledBy,'master');assert.equal(roll.visibility,'gm');assert.equal(roll.kind,'table');
 assert.equal(canRepeatRoll(roll,row),false);
 assert.equal(last.rollId,roll.id);assert.equal(last.text,card.items[roll.total-1].text);assert.ok(roll.label.includes(last.text));
 assert.equal((await r.action('gmTableRoll',{id:'sumiu'})).status,404);
 assert.equal((await r.action('gmCardSave',{title:'Inválida',kind:'table',category:'session',body:'Só uma'})).status,400);
 const bigEntries=Array.from({length:11},(_,i)=>({text:'Entrada '+(i+1),weight:100}));
 const bigCard=(await r.save({kind:'table',title:'Tabela grande',entries:bigEntries})).state.gmScreen.cards.at(-1);
 const bigResponse=await r.action('gmTableRoll',{id:bigCard.id});assert.equal(bigResponse.status,200);
 const bigRow=await bigResponse.json(),bigRoll=bigRow.state.rolls[0];
 assert.equal(bigRoll.formula,'1d1100');assert.equal(bigRoll.kind,'table');assert.equal(canRepeatRoll(bigRoll,bigRow),false);
});
test('referências validam destinos e preservam o número da página',async()=>{
 const r=await room();
 const row=await r.save({kind:'reference',targetKind:'character',targetId:'lyra',page:8});assert.equal(row.state.gmScreen.cards[0].targetId,'lyra');
 const ref={kind:'reference',category:'rules',title:'Regra',targetKind:'rule',targetId:'rule-advantage'};
 const {dndCatalog}=await import('../dnd.mjs');ref.targetId=dndCatalog.find(item=>item.category==='rules').id;
 assert.equal((await r.action('gmCardSave',ref)).status,200);
 assert.equal((await r.action('gmCardSave',{...ref,targetId:'regra-falsa'})).status,400);
 assert.equal((await r.action('gmCardSave',{...ref,targetKind:'book',targetId:'livro-falso'})).status,404);
 const stored=r.rows.get(r.created.id);stored.state.books=[{id:'book',name:'Meu livro',size:1}];
 const withBook=await r.save({kind:'reference',targetKind:'book',targetId:'book',page:42});assert.equal(withBook.state.gmScreen.cards.at(-1).page,42);
});
test('combate do escudo usa a mesma rodada e ordem já existente na mesa',async()=>{
 const r=await room();assert.equal((await r.action('combatSet',{entries:[{name:'A',value:12},{name:'B',value:7}],active:0,round:1})).status,200);
 await r.action('combatNext',{direction:1});let row=await r.view();assert.equal(row.state.table.combat.active,1);
 await r.action('combatNext',{direction:1});row=await r.view();assert.equal(row.state.table.combat.round,2);assert.equal(row.state.table.combat.active,0);
});
test('validação limita o tamanho do escudo e recusa ações privadas antes de alterar o estado',()=>{
 const state=newCampaign('Livre');
 assert.throws(()=>mutateGmScreen(state,'gmCardSave',{},false),error=>error.status===403);assert.equal(state.gmScreen,undefined);
 assert.throws(()=>mutateGmScreen(state,'gmCardSave',{title:'x',category:'outro',kind:'note'},true),error=>error.status===400);
 for(let i=0;i<80;i++)mutateGmScreen(state,'gmCardSave',{title:'N'+i,category:'world',kind:'note'},true);
 assert.throws(()=>mutateGmScreen(state,'gmCardSave',{title:'81',category:'world',kind:'note'},true),error=>error.status===409);
});
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ui={esc,button:(label,act,style,icon,id)=>'<button data-act="'+act+'" data-id="'+esc(id)+'">'+esc(label)+'</button>',head:title=>'<h1>'+title+'</h1>',input:(name,label,value)=>'<input name="'+name+'" value="'+esc(value)+'">',area:(name,label,value)=>'<textarea name="'+name+'">'+esc(value)+'</textarea>',submit:label=>'<button>'+label+'</button>',select:(name,label,options)=>'<select name="'+name+'">'+Object.entries(options).map(([id,text])=>'<option value="'+esc(id)+'">'+esc(text)+'</option>').join('')+'</select>'};
test('interface filtra sem acentos, escapa segredos e dá prioridade aos fixados',()=>{
 const state=newCampaign('Livre',true);state.gmScreen={cards:[{id:'1',title:'Abertura',body:'Revelação <script>',category:'session',kind:'note'},{id:'2',title:'NPC fixado',body:'Rival',category:'world',kind:'note',pinned:true}]};
 const row={master:true,state};const html=renderGmCards(row,ui);assert.ok(html.indexOf('NPC fixado')<html.indexOf('Abertura'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(renderGmCards(row,ui,{query:'revelacao'}).includes('Abertura'));assert.ok(!renderGmCards(row,ui,{category:'world'}).includes('Abertura'));
 assert.equal(renderGmScreen({...row,master:false},ui),'');assert.equal(renderGmCards({...row,master:false},ui),'');
 const screen=renderGmScreen(row,ui,{notes:'Rascunho'});assert.ok(screen.includes('Fichas à mão'));assert.ok(screen.includes('Vitalidade'));assert.ok(screen.includes('Rascunho não salvo'));
 const editor=gmCardEditor(null,row,ui);assert.ok(editor.includes('Referência vinculada'));assert.ok(editor.includes('Ficha · Lyra Vesper'));
});

test('mestre escolhe atributos do resumo e preferências ficam privadas',async()=>{
 const r=await room();assert.equal((await r.action('gmPartyFields',{id:'lyra',fields:['f3']})).status,200);
 const row=await r.view();assert.deepEqual(row.state.gmScreen.partyFields.lyra,['f3']);
 assert.equal((await r.view(r.created.invite)).state.gmScreen,undefined);
 assert.equal((await r.action('gmPartyFields',{id:'lyra',fields:['f5']})).status,400);
 assert.equal((await r.action('gmPartyFields',{id:'lyra',fields:['f3','f3']})).status,400);
 assert.equal((await r.action('gmPartyFields',{id:'sumiu',fields:[]})).status,404);
});

test('roteiros reutilizam materiais sem publicar cenas ou notas importadas',async()=>{
 const r=await room(),files=[{path:'Cofre/Pistas/Carta.md',body:'[[Porto]]'},{path:'Cofre/Porto.md',body:'Mapa privado'}];
 let response=await r.action('journalImport',{files});assert.equal(response.status,200);
 const {journal,sceneLibrary}= (await response.json()).state;
 const note=journal.find(n=>n.sourcePath===files[0].path);
 assert.equal(note.body,files[0].body);assert.equal(note.audience,'private');
 await r.action('journalSave',{...note,body:'Alterada na Forja'});
 await r.action('journalImport',{files});let state=(await r.view()).state;
 assert.equal(state.journal.length,journal.length);assert.equal(state.journal.find(e=>e.id===note.id).body,'Alterada na Forja');
 assert.equal((await r.action('journalImport',{files:[{path:'nova.md',body:'ok'},{path:'invalida.md',body:null}]})).status,400);
 assert.equal((await r.view()).state.journal.length,journal.length);
 await r.action('sessionCreate',{name:'A emboscada'});state=(await r.view()).state;
 const session=state.sceneLibrary.sessions.at(-1),ref={sessionId:session.id,id:note.id,kind:'note',attached:true};
 assert.equal((await r.action('sessionMaterial',ref)).status,200);await r.action('sessionMaterial',ref);
 state=(await r.view()).state;assert.deepEqual(state.sceneLibrary.sessions.at(-1).materials,[{id:note.id,kind:'note'}]);
 assert.equal(state.activeSceneId,sceneLibrary.activeId);
 const guest=(await r.view(r.created.invite)).state;
 assert.equal(guest.sceneLibrary,undefined);assert.ok(!JSON.stringify(guest).includes('Cofre/Pistas'));
 assert.equal((await r.action('sessionMaterial',ref,r.created.invite)).status,403);
 assert.equal((await r.action('journalImport',{files},r.created.invite)).status,403);
 await r.action('sessionMaterial',{...ref,attached:false});assert.deepEqual((await r.view()).state.sceneLibrary.sessions.at(-1).materials,[]);
});

test('criação pelo escudo salva material, origem e roteiro na mesma operação',async()=>{
 const r=await room(),created=await (await r.action('journalImport',{files:[{path:'Mundo/Cais.md',body:'Um segredo'}]})).json();
 const note=created.state.journal.at(-1),prepSession=created.state.sceneLibrary.sessions[0].id;
 const npc={name:'Guarda',characterType:'npc',hidden:true,prepSession,prepNote:note.id};
 const row=await (await r.action('character',npc)).json(),c=row.state.characters.at(-1);
 assert.equal(c.hidden,true);assert.deepEqual(row.state.journal.at(-1).characterIds,[c.id]);
 const response=await r.action('itemSave',{name:'Chave',journalId:note.id,prepSession});
 assert.equal(response.status,200);
 const state=(await response.json()).state;
 assert.deepEqual(state.sceneLibrary.sessions[0].materials,[{id:c.id,kind:'character'},{id:state.inventory.at(-1).id,kind:'item'}]);
 assert.equal((await r.action('character',{...npc,prepSession:'missing'})).status,400);
 assert.equal((await r.view()).state.characters.length,state.characters.length);
});

test('atualização do cofre preserva identidade, edição local, revisão e compartilhamento',async()=>{
 const r=await room(),path='Cofre/Porto.md',save=(body,version)=>r.action('journalImport',{files:[{path,body,version}]});
 const old=(await (await save('primeira')).json()).state.journal.at(-1);
 const updated=(await (await save('segunda',old.version)).json()).state.journal.at(-1);
 assert.equal(updated.id,old.id);assert.equal(updated.body,'segunda');
 assert.equal((await save('atrasada',old.version)).status,409);
 await r.action('journalSave',{...updated,body:'Alteração na mesa'});
 const local=(await r.view()).state.journal.at(-1);
 assert.equal((await save('terceira',local.version)).status,409);assert.equal((await r.view()).state.journal.at(-1).body,'Alteração na mesa');
 const otherPath='Cofre/Pista.md';
 const other=(await (await r.action('journalImport',{files:[{path:otherPath,body:'pista'}]})).json()).state.journal.at(-1);
 await r.action('journalPublish',{id:other.id,version:other.version,audience:'all'});
 assert.equal((await r.action('journalImport',{files:[{path:otherPath,body:'segredo',version:other.version+1}]})).status,409);
});

test('cartões do cofre conservam posição, acesso privado e referência única após reimportação',async()=>{
 const r=await room(),path='Campanha/Locais/Cais.md';
 const result=await r.action('journalImport',{files:[{path,body:'Primeira versão'}]});
 const note=(await result.json()).state.journal.at(-1),position={id:note.id,x:400,y:150};
 assert.equal((await r.action('gmNotePosition',position,r.created.invite)).status,403);
 assert.equal((await r.action('gmNotePosition',{...position,x:-1})).status,400);
 await r.action('gmNotePosition',position);await r.action('gmNotePin',{id:note.id});await r.action('gmNotePin',{id:note.id});
 await r.action('journalImport',{files:[{path,version:note.version,body:'Segunda versão'}]});
 const state=(await r.view()).state;
 assert.deepEqual(state.gmScreen.notePositions[note.id],{x:400,y:150});
 assert.equal(state.gmScreen.cards.filter(c=>c.targetId===note.id&&c.pinned).length,1);
 assert.equal(state.journal.find(n=>n.id===note.id).body,'Segunda versão');
 assert.equal((await r.view(r.created.invite)).state.gmScreen,undefined);
});

test('canvas salva movimentos em conjunto, tamanho e cor sem perder campos anteriores',async()=>{
 const r=await room();
 const imported=await r.action('journalImport',{files:[{path:'Cais.md',body:'Local'},{path:'Pista.md',body:'Pista'}]});
 const [a,b]=(await imported.json()).state.journal.slice(-2);
 const layout=changes=>r.action('gmCanvasLayout',{changes});
 assert.equal((await layout([{id:a.id,x:-240,y:-90},{id:b.id,x:550,y:100}])).status,200);
 assert.equal((await layout([{id:a.id,width:340,height:220,color:'#ea8044'}])).status,200);
 assert.equal((await layout([{id:a.id,x:987},{id:b.id,width:0}])).status,400);
 assert.deepEqual((await r.view()).state.gmScreen.notePositions[a.id],{x:-240,y:-90,width:340,height:220,color:'#ea8044'});
 const edge={from:a.id,to:b.id,label:'Leva até'};
 assert.equal((await r.action('gmCanvasEdge',edge,r.created.invite)).status,403);
 assert.equal((await r.action('gmCanvasEdge',edge)).status,200);
 await r.action('gmCanvasEdge',{...edge,label:'Próxima pista'});
 assert.deepEqual((await r.view()).state.gmScreen.noteEdges,[{...edge,label:'Próxima pista'}]);
 await r.action('gmCanvasEdge',{...edge,remove:true});
 assert.deepEqual((await r.view()).state.gmScreen.noteEdges,[]);
});

test('apagar material remove o vínculo de todas as sessões e mantém as outras referências',async()=>{
 const r=await room(),sessionId='session-initial';
 const second=(await(await r.action('sessionCreate',{name:'Outra sessão'})).json()).state.sceneLibrary.sessions.at(-1).id;
 for(const session of [sessionId,second]){
  for(const id of ['lyra','dorian']){
   assert.equal((await r.action('sessionMaterial',{sessionId:session,kind:'character',id,attached:true})).status,200);
  }
 }
 const before=(await r.view()).state.sceneLibrary.version;
 const deleted=await(await r.action('characterDelete',{id:'lyra'})).json();
 assert.equal(deleted.state.sceneLibrary.version,before+1);
 for(const session of deleted.state.sceneLibrary.sessions)assert.deepEqual(session.materials,[{kind:'character',id:'dorian'}]);
});

test('sorteios ponderados usam os intervalos dos pesos e preservam o ciclo ao editar',async()=>{
 const r=await room();
 const entries=[{text:'Patrulha',weight:3},{text:'Fantasma',weight:1}];
 let card=(await r.save({kind:'table',entries,noRepeat:true})).state.gmScreen.cards[0];
 const draw=()=>r.action('gmTableRoll',{id:card.id});
 let row=await (await draw()).json();
 card=row.state.gmScreen.cards[0];
 assert.equal(row.state.rolls[0].formula,'1d4');
 assert.equal(card.lastRoll.index,row.state.rolls[0].total<=3?1:2);
 const picked=card.items.find(item=>item.drawn);
 card=(await r.save({...card,entries:card.items.map(item=>({...item,text:item.text+'!'}))})).state.gmScreen.cards[0];
 assert.equal(card.items.find(item=>item.id===picked.id).drawn,true);
 const replies=await Promise.all([draw(),draw()]);
 assert.deepEqual(replies.map(reply=>reply.status).sort(),[200,409]);
 row=await (await r.view());
 card=row.state.gmScreen.cards[0];
 assert.ok(card.items.every(item=>item.drawn));
 const html=renderGmCards(row,ui);
 assert.ok(html.includes('0 de 2 disponíveis'));assert.ok(!html.includes('Sortear em segredo'));
 assert.equal((await r.action('gmTableReset',{id:card.id,version:card.version-1})).status,409);
 assert.equal((await r.action('gmTableReset',{id:card.id,version:card.version},r.created.invite)).status,403);
 const reset=await r.action('gmTableReset',{id:card.id,version:card.version});
 assert.ok((await reset.json()).state.gmScreen.cards[0].items.every(item=>!item.drawn));
 for(const weight of [0,1.5,101]){
  assert.equal((await r.action('gmCardSave',{kind:'table',title:'Inválida',category:'world',entries:[entries[0],{text:'Teste',weight}]})).status,400);
 }
});

test('roteiro segue a ordem do mestre em novas visitas e recusa reordenar uma versão antiga',async()=>{
 const r=await room(),sessionId='session-initial';
 const add=id=>r.action('sessionMaterial',{sessionId,kind:'character',id,attached:true});
 await add('lyra');await add('dorian');
 const row=await r.view(),version=row.state.sceneLibrary.version;
 const plan=prepList(row,ui,{prepTab:'plan'});
 assert.ok(plan.indexOf('data-prep-material="character:lyra"')<plan.indexOf('data-prep-material="character:dorian"'));
 assert.match(plan,/aria-label="Subir Lyra Vesper no roteiro" disabled/);
 const move={sessionId,id:'dorian',kind:'character',direction:-1,expectedVersion:version};
 assert.equal((await r.action('sessionMaterialMove',move,r.created.invite)).status,403);
 const responses=await Promise.all([r.action('sessionMaterialMove',move),r.action('sessionMaterialMove',move)]);
 assert.deepEqual(responses.map(res=>res.status).sort(),[200,409]);
 const reopened=await r.view();
 assert.deepEqual(reopened.state.sceneLibrary.sessions[0].materials.map(ref=>ref.id),['dorian','lyra']);
 const reordered=prepList(reopened,ui,{prepTab:'plan'});
 assert.ok(reordered.indexOf('data-prep-material="character:dorian"')<reordered.indexOf('data-prep-material="character:lyra"'));
 assert.equal((await r.action('sessionMaterialMove',{...move,expectedVersion:version+1})).status,409);
});

test('preparação identifica o alcance da edição e do combate antes de abrir o mapa',async()=>{
 const r=await room(),row=await r.view();
 const live=renderGmScreen(row,ui);
 assert.ok(live.includes('Preparar cópia privada'));assert.ok(live.includes('Editar mapa ao vivo'));
 assert.ok(live.includes('Ordem ao vivo.'));
 const response=await r.action('sceneDuplicate',{id:row.state.sceneId,expectedVersion:row.state.sceneLibrary.version});
 const copy=(await response.json()).state.sceneLibrary.scenes.at(-1);
 const viewed=await(await r.request(r.base+'?scene='+copy.id,'GET',r.created.key)).json(),prepared=renderGmScreen(viewed,ui);
 assert.ok(prepared.includes('Editar mapa privado'));assert.ok(prepared.includes('Ordem privada desta cena.'));
 assert.ok(!prepared.includes('Editar mapa ao vivo'));assert.equal((await r.view(r.created.invite)).state.sceneId,row.state.sceneId);
});

test('escudo oferece seletor de visibilidade e helpers de iniciativa rápida cobrem D&D, livre e fallback',()=>{
 const state=newCampaign('Iniciativa',true);
 const screen=renderGmScreen({master:true,state},ui);
 assert.ok(screen.includes('Rolagem rápida'));
 assert.ok(screen.includes('<select name="visibility">'));
 assert.ok(screen.includes('Privada (só mestre)'));
 assert.ok(screen.includes('Pública (mesa)'));
 const sage=dndCharacter({classId:'wizard',speciesId:'human',backgroundId:'sage',scoreMethod:'array',scores:{str:8,dex:14,con:13,int:15,wis:12,cha:10},boost2:'int',boost1:'wis',skills:['insight','investigation']});
 const criminal=dndCharacter({classId:'rogue',speciesId:'human',backgroundId:'criminal',scoreMethod:'array',scores:{str:8,dex:14,con:13,int:12,wis:10,cha:15},boost2:'dex',boost1:'con',skills:['acrobatics','athletics','deception','perception'],expertise:['stealth','perception']});
 const dndNoButton={...sage,rollButtons:[]};
 const withInitSkill={id:'skill-char',name:'Ágil',values:{f2:'3'},skills:[{id:'init',name:'Iniciativa',attribute:'f2',base:0,bonus:2,other:0}]};
 assert.equal(initiativeRollSpec(state,sage),'1d20+2');
 assert.equal(initiativeRollSpec(state,criminal),'1d20+3+2');
 assert.equal(initiativeRollSpec(state,dndNoButton),'1d20+2');
 assert.equal(initiativeRollSpec(state,withInitSkill),'1d20+3+2');
 assert.equal(initiativeRollSpec(state,state.characters[0]),'1d20+3');
 assert.equal(initiativeRollSpec(state,null),'1d20');
 const rolled=rollDiceFormulaLocal('1d20+3');
 assert.equal(rolled.formula,'1d20+3');
 assert.equal(rolled.modifier,3);
 assert.equal(rolled.dice.length,1);
 assert.ok(rolled.dice[0]>=1&&rolled.dice[0]<=20);
 assert.equal(rolled.total,rolled.dice[0]+3);
});
