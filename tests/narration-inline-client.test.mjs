import {narrationComposer} from '../public/narration.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNarrationDisplay} from '../public/rolls.mjs';
import {createInlineSheetEditor} from '../public/sheet-inline.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Node extends EventTarget{
 constructor(dataset={}){super();this.dataset=dataset;this.innerHTML='';this.hidden=true;this.value='';this.classList={add(){},remove(){}};}
 closest(selector){return selector==='[data-sheet-inline]'&&this.dataset.sheetInline!==undefined?this:selector==='[data-inline-control]'&&this.control?this:null;}
 matches(selector){return this.closest(selector)!==null;}
 getAttribute(name){return name==='aria-label'?'Editar campo':null;}
 setAttribute(name){if(name==='data-inline-control')this.control=true;}
 replaceChildren(control){this.child=control;}
 focus(){} select(){} checkValidity(){return true;} reportValidity(){}
 querySelectorAll(){return this.targets||[];}
}
function emit(root,type,target,extra={}){const e=new Event(type,{cancelable:true});Object.defineProperty(e,'target',{value:target});Object.assign(e,extra);root.dispatchEvent(e);}

test('narração exibe pendentes ao reconectar, escapa conteúdo e só avança após confirmação',async()=>{
 const root=new Node(),calls=[],display=createNarrationDisplay(root,{acknowledge:async id=>calls.push(id)});
 const message=id=>({id,title:'<sussurro>',body:'Você ouve <uma voz>.',readAt:null});
 const row=(rev,messages,master=false)=>({id:'room',characterId:'hero',rev,master,state:{narrations:messages}});
 display.sync(row(2,[message('one'),message('two')]));
 assert.equal(root.hidden,false);assert.match(root.innerHTML,/&lt;uma voz&gt;/);
 const first=root.innerHTML;display.sync(row(1,[]));assert.equal(root.innerHTML,first);
 emit(root,'click',{closest:selector=>selector==='[data-narration-dismiss]'});await tick();assert.deepEqual(calls,['one']);assert.equal(root.hidden,false);
 emit(root,'click',{closest:selector=>selector==='[data-narration-dismiss]'});await tick();assert.deepEqual(calls,['one','two']);assert.equal(root.hidden,true);
 display.sync(row(3,[message('one'),message('two')]));assert.equal(root.hidden,true);
 display.sync(row(4,[message('three')],true));assert.equal(root.hidden,true);assert.equal(root.innerHTML,'');
});
test('narração mantém mensagem e permite tentar novamente quando confirmação falha',async()=>{
 const root=new Node(),errors=[];let fail=true;
 const display=createNarrationDisplay(root,{report:e=>errors.push(e),acknowledge:async()=>{if(fail)throw new Error('Sem conexão');}});
 display.sync({id:'room',characterId:'hero',rev:1,state:{narrations:[{id:'one',title:'Título',body:'Pista'}]}});
 emit(root,'click',{closest:selector=>selector==='[data-narration-dismiss]'});await tick();assert.equal(root.hidden,false);assert.deepEqual(errors,['Sem conexão']);
 fail=false;emit(root,'click',{closest:selector=>selector==='[data-narration-dismiss]'});await tick();assert.equal(root.hidden,true);
});
test('edição direta salva com Enter ou ao sair, cancela com Escape e conserva rascunho na falha',async()=>{
 const original=globalThis.document;globalThis.document={createElement:()=>new Node()};
 try{
  const root=new Node(),calls=[],errors=[];let failure=false,settles=0;
  const target=new Node({sheetInline:'',inlineCharacter:'hero',inlineField:'power',inlineType:'number',inlineValue:'2'});target.innerHTML='<strong>2</strong>';
  const editor=createInlineSheetEditor(root,{save:async data=>{if(failure)throw new Error('Conflito');calls.push(data);},report:e=>errors.push(e),settled:()=>settles++});
  emit(root,'click',target);assert.equal(editor.editing,true);target.child.value='5';
  emit(root,'keydown',target.child,{key:'Enter'});await tick();assert.equal(calls[0].before,'2');assert.equal(calls[0].value,'5');assert.equal(editor.editing,false);assert.equal(settles,1);
  emit(root,'click',target);target.child.value='8';emit(root,'keydown',target.child,{key:'Escape'});assert.equal(editor.editing,false);assert.equal(calls.length,1);
  emit(root,'click',target);target.child.value='9';failure=true;emit(root,'focusout',target.child);await tick();assert.equal(editor.editing,true);assert.equal(target.child.value,'9');assert.equal(target.child.disabled,false);assert.deepEqual(errors,['Conflito']);
  failure=false;emit(root,'focusout',target.child);await tick();assert.equal(calls.at(-1).value,'9');assert.equal(editor.editing,false);
 }finally{globalThis.document=original;}
});

test('escrita revela grafemas sem reiniciar na sincronização e revelar tudo não confirma leitura',async()=>{
 const root=new Node(),nodes=new Map(),jobs=new Map(),calls=[];let serial=0,opened=0;
 root.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',hidden:false});return nodes.get(selector);};
 root.style={setProperty(){}};root.showModal=()=>{root.open=true;opened++;};root.close=()=>{root.open=false;};
 const display=createNarrationDisplay(root,{schedule:fn=>{const id=++serial;jobs.set(id,fn);return id;},cancel:id=>jobs.delete(id),reducedMotion:()=>false,acknowledge:async id=>calls.push(id)});
 const row={id:'room',characterId:'hero',rev:1,state:{narrations:[{id:'type',title:'Voz',body:'A👨‍👩‍👧‍👦é!',style:{effect:'typewriter',speed:28}}]}};
 display.sync(row);assert.equal(opened,1);assert.equal(jobs.size,1);assert.equal(nodes.get('[data-narration-text]'),undefined);
 const advance=()=>{const [id,fn]=jobs.entries().next().value;jobs.delete(id);fn();};
 advance();assert.equal(nodes.get('[data-narration-text]').textContent,'A');
 display.sync({...row,rev:2});assert.equal(jobs.size,1);assert.equal(opened,1);
 advance();assert.equal(nodes.get('[data-narration-text]').textContent,'A👨‍👩‍👧‍👦');
 emit(root,'click',{closest:selector=>selector==='[data-narration-reveal]'});assert.equal(jobs.size,0);assert.equal(nodes.get('[data-narration-text]').textContent,'A👨‍👩‍👧‍👦é!');assert.deepEqual(calls,[]);
 emit(root,'click',{closest:selector=>selector==='[data-narration-dismiss]'});await tick();assert.deepEqual(calls,['type']);assert.equal(root.open,false);
});

test('redução de movimento mostra texto completo; prévia nunca confirma mensagens no servidor',async()=>{
 const root=new Node(),jobs=[],calls=[];
 const display=createNarrationDisplay(root,{schedule:fn=>jobs.push(fn),reducedMotion:()=>true,acknowledge:async id=>calls.push(id)});
 display.preview({body:'Mensagem de exemplo',style:{effect:'typewriter'}});assert.match(root.innerHTML,/Mensagem de exemplo/);assert.equal(jobs.length,0);
 emit(root,'click',{closest:selector=>selector==='[data-narration-dismiss]'});await tick();assert.deepEqual(calls,[]);assert.equal(root.hidden,true);
});

test('consulta parcial de áudio não reinicia a narração nem a escrita entre snapshots completos',()=>{
 const root=new Node(),nodes=new Map(),jobs=new Map();let serial=0,opened=0;
 root.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',hidden:false});return nodes.get(selector);};root.style={setProperty(){}};root.showModal=()=>{root.open=true;opened++;};root.close=()=>{root.open=false;};
 const display=createNarrationDisplay(root,{schedule:fn=>{jobs.set(++serial,fn);return serial;},cancel:id=>jobs.delete(id),reducedMotion:()=>false});
 const message={id:'only-once',body:'Uma pista',style:{effect:'typewriter',speed:28}},full={id:'room',master:false,characterId:'hero',rev:1,state:{narrations:[message]}};
 display.sync(full);const [id,fn]=jobs.entries().next().value;jobs.delete(id);fn();assert.equal(nodes.get('[data-narration-text]').textContent,'U');
 for(let rev=2;rev<8;rev++){
  display.sync({id:'room',master:false,rev,state:{narrations:[message],audio:{track:null}}});
  display.sync({...full,rev});
 }
 assert.equal(opened,1);assert.equal(jobs.size,1);assert.equal(nodes.get('[data-narration-text]').textContent,'U');
 // Explicit recipient revocation still clears the message.
 display.sync({...full,rev:8,characterId:null,state:{narrations:[]}});assert.equal(root.hidden,true);assert.equal(jobs.size,0);
});

test('resposta da confirmação não abre a mensagem seguinte duas vezes',async()=>{
 const root=new Node();let opened=0,display;root.showModal=()=>{root.open=true;opened++;};root.close=()=>{root.open=false;};
 const one={id:'one',body:'Primeira'},two={id:'two',body:'Segunda'},row=(rev,narrations)=>({id:'room',master:false,characterId:'hero',rev,state:{narrations}});
 display=createNarrationDisplay(root,{acknowledge:async()=>{display.sync(row(2,[two]));await tick();}});
 display.sync(row(1,[one,two]));assert.equal(opened,1);
 emit(root,'click',{closest:selector=>selector==='[data-narration-dismiss]'});await tick();await tick();
 assert.equal(opened,2);assert.equal(root.hidden,false);assert.match(root.innerHTML,/Segunda/);
});


test('compositor preenche o destinatário escolhido pelo token',()=>{
 const selections=[],ui={input:()=>'',select:(name,label,options,value)=>{selections.push({name,options,value});return '';},area:()=>'',submit:()=>'',button:()=>''};
 const row={state:{characters:[{id:'first',name:'Primeiro',claimed:true},{id:'chosen',name:'Escolhido',claimed:true},{id:'free',name:'Livre'},{id:'hidden',name:'Oculto',claimed:true,hidden:true}]}};
 const composer=narrationComposer(row,ui,null,'chosen');assert.equal(composer.hasRecipients,true);
 const field=selections.find(field=>field.name==='characterId');assert.equal(field.value,'chosen');assert.deepEqual(Object.keys(field.options),['first','chosen']);
});
