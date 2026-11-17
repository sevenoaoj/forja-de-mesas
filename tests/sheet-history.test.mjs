import test from 'node:test';
import assert from 'node:assert/strict';
import {newCampaign,sheetFields} from '../model.mjs';
import {publicState} from '../access.mjs';
import {sheetAppearance} from '../sheet-layout.mjs';
import {captureSheetChanges,recordSheetChanges,mutateSheetHistory,isSheetHistoryRelevant,sheetHistoryLimits} from '../sheet-history.mjs';
import {renderSheetHistory,renderSheetHistoryRestore} from '../public/sheet-history.mjs';
const master={master:true},owner={master:false,memberId:'one'},other={master:false,memberId:'two'};
function fixture(){const state=newCampaign('Histórico',true),character=state.characters[0];character.ownerId='one';return {state,character};}
function change(state,action,data,mutation,access=owner){const captured=captureSheetChanges(state,action,data,access);mutation();recordSheetChanges(state,captured,{action,data,access});}
function restore(state,character,entry=character.sheetHistory.entries[0],access=owner){return mutateSheetHistory(state,'sheetHistoryRestore',{id:character.id,entryId:entry.id,expectedVersion:character.sheetHistory.version},access);}
test('não migra fichas antigas nem registra ações sem alteração de conteúdo',()=>{
 const {state,character}=fixture();assert.equal(renderSheetHistory(character).includes('próximas alterações'),true);
 assert.equal(isSheetHistoryRelevant('ping'),false);assert.deepEqual(captureSheetChanges(state,'ping',{},owner),[]);
 change(state,'character',{id:character.id},()=>{});assert.equal(character.sheetHistory,undefined);
 assert.equal(mutateSheetHistory(state,'ping',{},owner),false);
});
test('recupera campos, valores, perícias, habilidades e fórmulas, preservando acesso e foto atuais',()=>{
 const {state,character}=fixture();character.portrait={url:'old.png'};character.skills=[{id:'s',name:'Percepção',attribute:'f1',bonus:2}];character.abilities=[{id:'a',name:'Proteção',description:'original'}];character.rollButtons=[{id:'r',name:'Ataque',formula:'2d6+{f1}'}];
 const old=structuredClone(character),field=sheetFields(state,character)[0];
 change(state,'sheetTemplateApply',{characterId:character.id},()=>{character.name='Novo nome';character.layout=[{id:'new',label:'Outro',type:'text',group:'Geral',initial:''}];character.values={new:'Teste'};character.skills=[];character.abilities=[];character.rollButtons=[];});
 const entry=character.sheetHistory.entries[0];assert.match(entry.summary,/Nome/);assert.equal(entry.before.ownerId,undefined);assert.equal(entry.before.portrait,undefined);assert.equal(entry.before.sheetHistory,undefined);
 character.portrait={url:'current.png'};character.hidden=true;character.ownerId='new-owner';
 assert.equal(restore(state,character,entry,master),true);
 assert.equal(character.name,old.name);assert.deepEqual(character.skills,old.skills);assert.deepEqual(character.abilities,old.abilities);assert.deepEqual(character.rollButtons,old.rollButtons);assert.equal(character.values[field.id],old.values[field.id]??field.initial);
 assert.deepEqual(character.portrait,{url:'current.png'});assert.equal(character.hidden,true);assert.equal(character.ownerId,'new-owner');assert.equal(character.sheetHistory.version,2);assert.equal(character.sheetHistory.entries[0].restoredFrom,entry.id);
 assert.equal(character.sheetHistory.entries[0].before.name,'Novo nome');
});
test('autorização de restauração é revalidada para dono/mestre e histórico não vaza no resumo',()=>{
 const {state,character}=fixture();change(state,'character',{id:character.id},()=>character.name='Alterado');
 assert.throws(()=>restore(state,character,undefined,other),e=>e.status===403);assert.throws(()=>restore(state,character,undefined,{master:false,guest:true}),e=>e.status===403);
 const view=publicState(state,other);assert.equal(view.characters.find(c=>c.id===character.id).sheetHistory,undefined);
 assert.ok(publicState(state,owner).characters.find(c=>c.id===character.id).sheetHistory);assert.ok(publicState(state,master).characters.find(c=>c.id===character.id).sheetHistory);
 character.hidden=true;assert.throws(()=>restore(state,character),e=>e.status===403);assert.equal(restore(state,character,undefined,master),true);
});
test('restauração rejeita histórico obsoleto, preserva organização e invalida rascunhos de aparência',()=>{
 const {state,character}=fixture();character.appearance=sheetAppearance(state,character);character.appearance.version=5;
 change(state,'sheetAppearance',{id:character.id},()=>{character.appearance.options.accent='#123456';character.appearance.version++;});
 const entry=character.sheetHistory.entries[0],expectedVersion=character.sheetHistory.version;
 change(state,'sheetCounter',{id:character.id},()=>character.values.f1='2');
 assert.throws(()=>mutateSheetHistory(state,'sheetHistoryRestore',{id:character.id,entryId:entry.id,expectedVersion},owner),e=>e.status===409);
 restore(state,character,entry);assert.equal(character.appearance.version,7);assert.notEqual(character.appearance.options.accent,'#123456');
 assert.throws(()=>restore(state,character,entry),e=>e.status===409);assert.throws(()=>mutateSheetHistory(state,'sheetHistoryRestore',{id:character.id,entryId:'missing',expectedVersion:character.sheetHistory.version},owner),e=>e.status===404);
});
test('schema compartilhado registra apenas afetados e restauração não muda fichas alheias',()=>{
 const {state,character}=fixture(),other=state.characters[1];other.layout=structuredClone(state.fields);const saved=structuredClone(state.fields);
 change(state,'schema',{},()=>{state.fields[0].label='Alteração de campanha';state.fields[0].initial='99';},master);
 assert.ok(character.sheetHistory);assert.equal(other.sheetHistory,undefined);restore(state,character,undefined,master);
 assert.deepEqual(character.layout,saved);assert.equal(state.fields[0].label,'Alteração de campanha');assert.deepEqual(other.layout,saved);
});
test('consumo de maestria em rolagens e restauração geral da sessão possuem histórico',()=>{
 const {state,character}=fixture();character.masteries=[{id:'m',name:'Essência',remaining:1,die:'1d4',attributeId:'f1'}];
 change(state,'roll',{masteryId:'m'},()=>character.masteries[0].remaining--);assert.match(character.sheetHistory.entries[0].summary,/Maestrias/);
 change(state,'sheetMasteryRefresh',{},()=>character.masteries[0].remaining=1,master);assert.equal(character.sheetHistory.version,2);
});
test('retenção limita revisões e tamanho, sem interromper edição de ficha grande',()=>{
 const {state,character}=fixture();for(let i=0;i<25;i++)change(state,'character',{id:character.id},()=>character.name='Nome '+i);
 assert.equal(character.sheetHistory.version,25);assert.equal(character.sheetHistory.entries.length,20);
 character.layout=Array.from({length:40},(_,i)=>({id:'long'+i,label:'Notas '+i,group:'História',type:'long',initial:''}));character.values=Object.fromEntries(character.layout.map(field=>[field.id,'á'.repeat(2000)]));
 change(state,'character',{id:character.id},()=>character.name='Ficha grande');
 assert.equal(character.sheetHistory.entries[0].before,undefined);assert.match(character.sheetHistory.entries[0].unavailable,/tamanho/);assert.throws(()=>restore(state,character),e=>e.status===409);
 assert.ok(new TextEncoder().encode(JSON.stringify(character.sheetHistory)).length<=sheetHistoryLimits.characterBytes);
});
test('orçamento total remove cópias antigas sem reiniciar versões',()=>{
 const state=newCampaign('Orçamento');state.fields=[{id:'notes',label:'Notas',type:'long',group:'História',initial:''}];
 state.characters=Array.from({length:15},(_,i)=>({id:String(i),name:'Personagem '+i,color:'Violeta',values:{notes:'x'.repeat(30000)}}));
 for(const character of state.characters)for(let i=0;i<3;i++)change(state,'character',{id:character.id},()=>character.name+='!',master);
 const total=state.characters.reduce((sum,c)=>sum+new TextEncoder().encode(JSON.stringify(c.sheetHistory)).length,0);assert.ok(total<=sheetHistoryLimits.campaignBytes);assert.ok(state.characters.every(c=>c.sheetHistory.version===3));assert.ok(state.characters.some(c=>c.sheetHistory.entries.some(e=>!e.before)));
});
test('interface exibe resumos, formulário versionado e escapa texto de usuário',()=>{
 const {state,character}=fixture();change(state,'character',{id:character.id},()=>character.name='<script>alert(1)</script>');
 const html=renderSheetHistory(character),entry=character.sheetHistory.entries[0];assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('data-entry="'+entry.id+'"'));assert.ok(!html.includes('"layout":'));
 const form=renderSheetHistoryRestore(character,entry.id);assert.ok(form.includes('name="expectedVersion" value="1"'));assert.ok(form.includes('data-form="sheetHistoryRestore"'));assert.equal(renderSheetHistory({...character,access:'summary'}),'');assert.throws(()=>renderSheetHistoryRestore({...character,access:'summary'},entry.id));
});

test('campos com IDs herdados do protótipo preservam apenas valores próprios',()=>{
 const {state,character}=fixture();character.layout=[{id:'__proto__',label:'Campo',type:'text',group:'Geral',initial:'inicial'}];character.values=Object.fromEntries([['__proto__','antes']]);
 change(state,'character',{id:character.id},()=>character.values=Object.fromEntries([['__proto__','depois']]));restore(state,character);assert.equal(Object.hasOwn(character.values,'__proto__'),true);assert.equal(character.values.__proto__,'antes');assert.equal(Object.getPrototypeOf(character.values),Object.prototype);
});
