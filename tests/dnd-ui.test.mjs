import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/dnd-ui.mjs',import.meta.url),'utf8');
const {dndCreation,dndFormData,updateDndCreation,dndCatalogShell,renderDndResults}=await import('data:text/javascript;base64,'+Buffer.from(source.replace("'./model.mjs'",JSON.stringify(new URL('../model.mjs',import.meta.url).href)).replace("'./dnd.mjs'",JSON.stringify(new URL('../dnd.mjs',import.meta.url).href))).toString('base64'));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ui={esc,input:(name,label,value='',type='text',extra='')=>'<label>'+esc(label)+'<input name="'+name+'" value="'+esc(value)+'" '+extra+'></label>',select:(name,label,options,value)=>'<label>'+label+'<select name="'+name+'">'+Object.entries(options).map(([id,text])=>'<option value="'+esc(id)+'" '+(id===value?'selected':'')+'>'+esc(text)+'</option>').join('')+'</select></label>',button:(label,action,style,icon,id)=>'<button data-act="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>'};
test('criador orienta quatro etapas e mostra os valores finais antes de salvar',()=>{
 const html=dndCreation(ui,{name:'Maga <Teste>'});
 assert.equal((html.match(/<fieldset data-dnd-step=/g)||[]).length,4);
 assert.ok(html.includes('Maga &lt;Teste&gt;'));assert.ok(html.includes('nível 1'));assert.ok(!html.includes('narrative'));
 const values={classId:'wizard',backgroundId:'sage',speciesId:'dwarf',scoreMethod:'array',boost2:'int',boost1:'wis','score-str':8,'score-dex':12,'score-con':13,'score-int':15,'score-wis':14,'score-cha':10};
 const nodes=new Map();
 const form={querySelector(selector){const name=/\[name="?([^"\]]+)/.exec(selector)?.[1];const key=name||selector;if(!nodes.has(key))nodes.set(key,{value:values[name],dataset:{},innerHTML:'',textContent:''});return nodes.get(key);},querySelectorAll(selector){return selector==='[data-dnd-skill]:checked'?[{value:'insight'},{value:'investigation'}]:[];}};
 updateDndCreation(form,ui,true,true);
 const draft=dndFormData(form);assert.equal(draft.scores.int,15);assert.equal(draft.classId,'wizard');
 assert.ok(nodes.get('[data-dnd-review]').innerHTML.includes('8/8'));
 assert.ok(nodes.get('[data-dnd-review]').innerHTML.includes('17'));
 assert.ok(nodes.get('[data-dnd-skills]').innerHTML.includes('Escolha mais 2'));
});
test('consulta filtra por texto, categoria e classe e permite opções adicionais explícitas',()=>{
 const character={id:'mine',name:'Minha maga',dnd:{classId:'wizard'},access:'full',abilities:[]};
 const row={master:false,state:{characters:[character,{id:'other',name:'Privada',dnd:{classId:'cleric'},access:'summary'}]}};
 const html=dndCatalogShell(row,ui,'mine');assert.ok(html.includes('Minha maga'));assert.ok(!html.includes('Privada'));
 assert.ok(!renderDndResults(row,ui,'curar','spells','mine').includes('Curar Ferimentos'));
 const extra=renderDndResults(row,ui,'curar','spells','mine',true);assert.ok(extra.includes('Curar Ferimentos'));assert.ok(extra.includes('mine/spell-cure-wounds'));
 const secret=renderDndResults(row,ui,'curar','spells','other',true);assert.ok(!secret.includes('data-act="dndAdd"'));
 assert.ok(renderDndResults(row,ui,'vantagem','rules','mine').includes('Vantagem e desvantagem'));
});
