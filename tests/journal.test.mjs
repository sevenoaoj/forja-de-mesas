import test from 'node:test';
import assert from 'node:assert/strict';
import {mutateJournal,journalView} from '../journal-model.mjs';
import {renderJournal,journalEditor,journalFormData} from '../public/journal.mjs';
const master={master:true},alice={memberId:'alice'},bob={memberId:'bob'};
const seed=()=>({characters:[{id:'a',name:'Ana',ownerId:'alice'},{id:'b',name:'Beto',ownerId:'bob'},{id:'secret',name:'Dragão',hidden:true}],journal:[]});
const save=(state,data={})=>{mutateJournal(state,'journalSave',{title:'Pista',body:'Leia a inscrição',gmNotes:'É uma armadilha',...data},master);return state.journal.at(-1);};
test('documentos novos são privados e não expõem seus segredos',()=>{
 const s=seed();save(s);assert.deepEqual(journalView(s,alice),[]);assert.equal(journalView(s,master)[0].gmNotes,'É uma armadilha');
});
test('permissões selecionadas, convidados e personagens ocultos são filtrados no servidor',()=>{
 const s=seed(),e=save(s,{audience:'selected',recipientIds:['a']});
 assert.equal(journalView(s,alice).length,1);assert.deepEqual(journalView(s,bob),[]);assert.deepEqual(journalView(s,{guest:true}),[]);
 const safe=journalView(s,alice)[0];assert.equal(safe.gmNotes,undefined);assert.equal(safe.recipientIds,undefined);assert.equal(safe.audience,undefined);
 s.characters[0].hidden=true;assert.deepEqual(journalView(s,alice),[]);
 assert.throws(()=>mutateJournal(s,'journalPublish',{id:e.id,version:e.version,audience:'selected',recipientIds:['secret']},master),{status:400});
});
test('compartilhar para todos e recolher atualiza versão e preserva notas privadas',()=>{
 const s=seed(),e=save(s);mutateJournal(s,'journalPublish',{id:e.id,version:1,audience:'all'},master);
 assert.equal(journalView(s,bob).length,1);assert.equal(s.journal[0].version,2);assert.equal(s.journal[0].gmNotes,e.gmNotes);
 mutateJournal(s,'journalPublish',{id:e.id,version:2,audience:'private'},master);assert.deepEqual(journalView(s,bob),[]);
});
test('autorizações e conflitos recusam alterações sem mutar a campanha',()=>{
 const s=seed(),e=save(s);const before=JSON.stringify(s);
 for(const action of ['journalSave','journalDelete','journalPublish','journalStatus'])assert.throws(()=>mutateJournal(s,action,{id:e.id,version:1},alice),{status:403});
 assert.throws(()=>mutateJournal(s,'journalSave',{id:e.id,version:0,title:'Sobrescrita'},master),{status:409});
 assert.throws(()=>mutateJournal(s,'journalDelete',{id:e.id,version:0},master),{status:409});assert.equal(JSON.stringify(s),before);
});
test('missões mantêm estado explícito e edição concorrente segura',()=>{
 const s=seed(),e=save(s,{kind:'quest'});mutateJournal(s,'journalStatus',{id:e.id,version:1,status:'completed'},master);assert.equal(s.journal[0].status,'completed');
 assert.throws(()=>mutateJournal(s,'journalStatus',{id:e.id,version:1,status:'active'},master),{status:409});
 mutateJournal(s,'journalDelete',{id:e.id,version:2},master);assert.equal(s.journal.length,0);
});
test('seleções inválidas e tipos desconhecidos não criam documentos',()=>{
 const s=seed();for(const data of [{audience:'selected',recipientIds:[]},{audience:'selected',recipientIds:['none']},{kind:'__proto__'},{title:' '}])assert.throws(()=>save(s,data),{status:400});assert.equal(s.journal.length,0);
});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,head:(a,b,c)=>a+b+c,button:()=>'',input:()=>'',select:()=>'',area:(n,l,v)=>esc(v),submit:()=>''};
test('renderização escapa texto e busca ignora acentos; jogador não vê segredo nem controles',()=>{
 const s=seed();save(s,{title:'Missão <img src=x onerror=alert(1)>',body:'PÓRTÃO Poção',gmNotes:'SEGREDO',audience:'all'});
 const safe={master:false,state:{journal:journalView(s,alice)}};const html=renderJournal(safe,ui,{query:'portao'});
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('SEGREDO'));assert.ok(!html.includes('journalEdit'));
 assert.ok(renderJournal(safe,ui,{query:'pocao'}).includes('&lt;img'));
 const editor=journalEditor(s.journal[0],{master:true,state:s},ui);assert.ok(editor.includes('nunca compartilhado'));
});
test('formulário mantém versão numérica e múltiplos destinatários',()=>{
 const f=new FormData();f.set('version','7');f.append('recipientIds','a');f.append('recipientIds','b');const data=journalFormData(f);assert.equal(data.version,7);assert.deepEqual(data.recipientIds,['a','b']);
});

test('orçamento agregado do diário rejeita excesso em UTF-8 sem perder documentos',()=>{
 const s=seed();let reached=false;for(let i=0;i<100;i++){const before=JSON.stringify(s);try{save(s,{title:'Documento '+i,body:'世'.repeat(16000),gmNotes:'x'.repeat(8000)});}catch(error){assert.equal(error.status,413);assert.equal(JSON.stringify(s),before);reached=true;break;}}assert.equal(reached,true);
});
