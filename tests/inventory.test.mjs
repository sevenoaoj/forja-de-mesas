import test from 'node:test';
import assert from 'node:assert/strict';
import {mutateInventory,inventoryView} from '../inventory-model.mjs';
import {publicState} from '../access.mjs';
import {newCampaign} from '../model.mjs';
import {renderInventory,itemDetails,sheetInventory} from '../public/inventory.mjs';
import {renderJournal} from '../public/journal.mjs';
import {api} from '../api.mjs';
const master={master:true},alice={memberId:'alice'},bob={memberId:'bob'};
const seed=()=>({...newCampaign('Teste',true),characters:[{id:'a',name:'Ana',ownerId:'alice'},{id:'b',name:'Beto',ownerId:'bob'},{id:'hidden',name:'Oculto',ownerId:'alice',hidden:true}],journal:[{id:'j',version:1,title:'Relíquia',body:'História',gmNotes:'SEGREDO DIÁRIO',audience:'private'}]});
function prepare(s,data={}){mutateInventory(s,'itemSave',{name:'Poção',weight:0.5,gmNotes:'SEGREDO ITEM',journalId:'j',...data},master);return s.inventory.at(-1);}
function grant(s,e,characterId='a'){mutateInventory(s,'itemGrant',{id:e.id,version:e.version,characterId,quantity:3},master);return s.inventory.at(-1);}
test('catálogo privado, cópias independentes e filtragem de segredos e vínculos',()=>{
 const s=seed(),template=prepare(s);assert.deepEqual(inventoryView(s,alice),[]);const instance=grant(s,template);grant(s,template,'b');grant(s,template,'hidden');
 const safe=publicState(s,alice).inventory;assert.equal(safe.length,1);assert.equal(safe[0].id,instance.id);assert.equal(safe[0].gmNotes,undefined);assert.equal(safe[0].sourceId,undefined);assert.equal(safe[0].journalId,'');assert.deepEqual(inventoryView(s,{guest:true}),[]);
 s.journal[0].audience='selected';s.journal[0].recipientIds=['a'];assert.equal(inventoryView(s,alice)[0].journalId,'j');assert.equal(inventoryView(s,bob)[0].journalId,'');
 mutateInventory(s,'itemSave',{id:template.id,version:1,name:'Poção melhorada',weight:2},master);assert.equal(s.inventory.find(e=>e.id===instance.id).name,'Poção');
 mutateInventory(s,'itemDelete',{id:template.id,version:2},master);assert.equal(s.inventory.length,0);
});
test('portador gerencia apenas quantidade, equipamento e notas com conflito de versão',()=>{
 const s=seed(),e=grant(s,prepare(s));const before=JSON.stringify(s);
 for(const action of ['itemSave','itemGrant','itemDelete','itemManage'])assert.throws(()=>mutateInventory(s,action,{id:e.id,version:1},bob),{status:403});
 assert.throws(()=>mutateInventory(s,'itemManage',{id:e.id,version:0},alice),{status:409});assert.equal(JSON.stringify(s),before);
 mutateInventory(s,'itemManage',{id:e.id,version:1,quantity:2,equipped:true,notes:'Meu item',name:'hack',gmNotes:'hack'},alice);const updated=s.inventory.at(-1);assert.equal(updated.name,'Poção');assert.equal(updated.gmNotes,'SEGREDO ITEM');assert.equal(updated.quantity,2);assert.equal(updated.version,2);
 assert.throws(()=>mutateInventory(s,'itemManage',{id:e.id,version:2,quantity:0,equipped:true},alice),{status:400});
 s.characters[0].hidden=true;assert.throws(()=>mutateInventory(s,'itemManage',{id:e.id,version:2,quantity:1,equipped:false},alice),{status:403});
});
test('validações são atômicas e retratos recusam esquemas executáveis',()=>{
 const s=seed();for(const data of [{name:''},{accent:'red'},{accent:'#123'},{accent:{value:'#ffffff'}},{accent:'#abcdef;display:none'},{kind:'__proto__'},{portrait:'https://example.com/new.png'},{portrait:{id:'forged'}},{portrait:'javascript:alert(1)'},{portrait:'data:image/svg+xml,evil'},{weight:-1},{weight:'NaN'},{journalId:'missing'}])assert.throws(()=>prepare(s,data),{status:400});assert.equal(s.inventory,undefined);
 const e=prepare(s);for(const data of [{characterId:'missing'},{characterId:'a',quantity:1.5},{characterId:'a',quantity:0}])assert.throws(()=>mutateInventory(s,'itemGrant',{id:e.id,version:1,...data},master),{status:400});assert.equal(s.inventory.length,1);
 const before=JSON.stringify(s);s.inventory=Array.from({length:1000},(_,i)=>({...e,id:String(i)}));assert.throws(()=>prepare(s),{status:413});assert.equal(s.inventory.length,1000);assert.ok(before);
});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,head:(a,b,c)=>a+b+c,button:(label,act,style,icon,id)=>'<button data-act="'+act+'" data-id="'+esc(id)+'">'+esc(label)+'</button>'};
test('interface escapa conteúdo, busca sem acentos e integra ficha e diário sem segredos',()=>{
 const s=seed(),template=prepare(s,{name:'Poção <script>',description:'<img src=x>'});template.portrait='https://example.com/potion.png';const e=grant(s,template);s.journal[0].audience='all';const row={master:false,state:publicState(s,alice)},safe=row.state.inventory[0];
 const html=renderInventory(row,ui,{scope:'all',query:'pocao'});assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(sheetInventory(s.characters[0],row,ui).includes('1,5 kg'));
 const details=itemDetails(safe,row,ui);assert.ok(details.includes('História'));assert.ok(!details.includes('SEGREDO'));assert.ok(!details.includes('itemEdit'));assert.ok(details.includes('&lt;img'));
 assert.ok(renderJournal(row,ui).includes('data-act="itemOpen"'));s.journal[0].audience='private';const privateRow={master:false,state:publicState(s,alice)};assert.ok(!itemDetails(privateRow.state.inventory[0],privateRow,ui).includes('História'));
});
test('API persiste inventário, aplica permissões e mantém versões entre requisições',async()=>{
 const rows=new Map(),store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const campaign=await(await call('','POST',null,{name:'Itens',example:true})).json(),key='a'.repeat(64);
 await call('/'+campaign.id+'/join','POST',campaign.invite,{key});const act=(action,data,gm=false)=>call('/'+campaign.id+'/action','POST',gm?campaign.key:key,{action,data});
 await act('characterClaim',{id:'lyra'});let response=await act('itemSave',{name:'Espada',gmNotes:'Privado'},true);assert.equal(response.status,200);let template=(await response.json()).state.inventory[0];
 assert.equal((await act('itemSave',{name:'Hack'})).status,403);response=await act('itemGrant',{id:template.id,version:1,characterId:'lyra',quantity:1},true);assert.equal(response.status,200);
 const view=await(await call('/'+campaign.id,'GET',key)).json();assert.equal(view.state.inventory.length,1);const item=view.state.inventory[0];assert.equal(item.gmNotes,undefined);
 assert.equal((await act('itemManage',{id:item.id,version:1,quantity:1,equipped:true})).status,200);assert.equal((await act('itemManage',{id:item.id,version:1,quantity:0,equipped:false})).status,409);
 const latest=await(await call('/'+campaign.id,'GET',key)).json();assert.equal(latest.state.inventory[0].equipped,true);
});

test('cor do item é validada, preservada nas cópias e legível no inventário',()=>{
 const s=seed(),template=prepare(s,{accent:'#12ABEF'});assert.equal(template.accent,'#12abef');const copy=grant(s,template);assert.equal(copy.accent,'#12abef');
 mutateInventory(s,'itemSave',{id:template.id,version:1,name:'Poção azul',accent:'#331199'},master);assert.equal(s.inventory.find(e=>e.id===copy.id).accent,'#12abef');
 mutateInventory(s,'itemSave',{id:template.id,version:2,name:'Poção azul'},master);assert.equal(s.inventory[0].accent,'#331199');
 const row={master:false,state:publicState(s,alice)};assert.match(renderInventory(row,ui,{scope:'all'}),/--item-accent:#12abef/);assert.match(itemDetails(row.state.inventory[0],row,ui),/--item-glow:18,171,239/);
});

test('consumível antigo tem um uso por unidade e a barra respeita os limites',()=>{
 const s=seed(),template=prepare(s,{kind:'consumable'}),copy=grant(s,template);
 delete copy.uses;delete copy.usesPerUnit;
 assert.equal(inventoryView(s,alice)[0].uses,3);
 const step=delta=>mutateInventory(s,'itemUse',{id:copy.id,version:s.inventory.at(-1).version,delta},alice);
 assert.throws(()=>step(1),{status:409});step(-1);step(-1);step(-1);
 assert.throws(()=>step(-1),{status:409});step(1);
 assert.equal(inventoryView(s,alice)[0].uses,1);assert.equal(inventoryView(s,alice)[0].quantity,3);
});

test('celular entrega mensagens consultáveis e categorias próprias conservam o conteúdo',()=>{
 const s=seed(),phone=prepare(s,{kind:'phone',origin:'Arquivo 7',content:'Ana\nAbra <o cofre>\n\nRui\nCheguei.'});
 grant(s,phone);
 const e=inventoryView(s,alice)[0],html=itemDetails(e,{state:{journal:[]},characterId:'a'},ui);
 assert.match(html,/reading-phone/);assert.match(html,/<summary>Ana<\/summary>/);assert.match(html,/Abra &lt;o cofre&gt;/);
 assert.match(html,/<summary>Rui<\/summary>/);assert.doesNotMatch(html,/SEGREDO ITEM/);
 assert.deepEqual(inventoryView(s,bob),[]);
 const custom=prepare(s,{kind:'custom',categoryName:'Fita cassete',content:'Transcrição'});
 assert.match(itemDetails(custom,{state:{journal:[]},master:true},ui),/Transcrição/);
 assert.throws(()=>prepare(s,{kind:'custom'}),/categoria/);
});

test('álbum do celular acompanha a entrega, aparece na conversa e permanece privado',()=>{
 const state=seed(),photo={name:'cais.jpg',src:'data:image/jpeg;base64,/9j/2Q=='};
 const phone=prepare(state,{kind:'phone',photos:[photo],content:'Ana\n[foto:cais.jpg]\n>Recebi.'});
 grant(state,phone);
 const item=inventoryView(state,alice)[0],html=itemDetails(item,{state:{journal:[]},characterId:'a'},ui);
 assert.deepEqual(item.photos,[photo]);assert.match(html,/phone-bubble sent/);
 assert.equal((html.match(/data-phone-photo="0"/g)||[]).length,2);
 assert.deepEqual(inventoryView(state,bob),[]);
 assert.throws(()=>prepare(state,{kind:'phone',photos:[{...photo,src:'https://invalid.example/photo.jpg'}]}),/Álbum/);
});
