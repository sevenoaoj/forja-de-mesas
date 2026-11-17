import test from 'node:test';
import assert from 'node:assert/strict';
import {newCampaign,resolveSheetFormula} from '../model.mjs';
import {mutateSheetTemplates,sheetTemplatesView,readableSheetTemplate,sheetTemplateCharacter,exportSheetTemplate} from '../sheet-template-model.mjs';
const gm={master:true},alice={memberId:'alice'},bob={memberId:'bob'};
const field=(id='power',type='number',initial='2')=>({id,label:'Poder',type,initial,group:'Atributos'});
const template=(extra={})=>({name:'Sistema universal',fields:[field()],rollButtons:[{id:'test-power',name:'Poder',formula:'2d6+@{power}'}],...extra});
const seed=()=>({...newCampaign('Teste',false),characters:[{id:'a',name:'Segredo Alice',concept:'Conceito secreto',ownerId:'alice',color:'jade',portrait:{id:'portrait'},story:'História privada',layout:[field()],values:{power:'9'},skills:[],abilities:[{id:'skill1',name:'Segredo',description:'História pessoal'}],masteries:[],rollButtons:[{id:'test-power',name:'Poder',formula:'2d6+@{power}'}]},{id:'b',name:'Beto',ownerId:'bob',layout:[field('speed')],values:{speed:'3'},skills:[]}]});
const imported=(s,t=template(),access=gm,extra={})=>{mutateSheetTemplates(s,'sheetTemplateImport',{bundle:{format:'forja-sheet-template',version:1,template:t},...extra},access);return s.sheetTemplates.items.at(-1);};
test('captura só estrutura, sem valores atuais, identidade ou habilidades sem consentimento',()=>{
 const s=seed();mutateSheetTemplates(s,'sheetTemplateSave',{characterId:'a',name:'Meu sistema'},alice);const e=s.sheetTemplates.items[0];
 assert.equal(e.fields[0].initial,'2');assert.deepEqual(e.abilities,[]);for(const key of ['values','story','portrait','ownerId','concept'])assert.equal(e[key],undefined);assert.equal(e.name,'Meu sistema');assert.ok(!JSON.stringify(e).includes('História pessoal'));
 const exported=exportSheetTemplate(e);assert.equal(exported.template.owner,undefined);assert.equal(exported.template.shared,undefined);assert.equal(exported.template.version,undefined);
});
test('capturar aparência e habilidades é explícito; exportação elimina metadados importados',()=>{
 const s=seed();mutateSheetTemplates(s,'sheetTemplateSave',{characterId:'a',name:'Visual',includeAbilities:true,includeAppearance:true},alice);const e=s.sheetTemplates.items[0];assert.equal(e.abilities.length,1);assert.ok(e.appearance);
 const exported=exportSheetTemplate({...e,ownerId:'roubado',story:'oculto',values:{power:'99'},portrait:{id:'x'}});for(const key of ['ownerId','story','values','portrait'])assert.equal(exported.template[key],undefined);
});
test('modelos privados só aparecem ao autor e mestre; compartilhados permitem uso sem edição',()=>{
 const s=seed(),e=imported(s,template(),alice);assert.equal(sheetTemplatesView(s,bob).items.length,0);assert.equal(sheetTemplatesView(s,gm).items.length,1);assert.throws(()=>readableSheetTemplate(s,bob,e.id),{status:403});
 mutateSheetTemplates(s,'sheetTemplateUpdate',{id:e.id,expectedVersion:1,name:e.name,shared:true},alice);
 assert.equal(sheetTemplatesView(s,bob).items[0].canEdit,false);assert.equal(sheetTemplatesView(s,bob).items[0].owner,undefined);
 assert.throws(()=>mutateSheetTemplates(s,'sheetTemplateDelete',{id:e.id,expectedVersion:2},bob),{status:403});
 mutateSheetTemplates(s,'sheetTemplateUpdate',{id:e.id,expectedVersion:2,name:e.name,shared:false},alice);assert.equal(sheetTemplatesView(s,bob).items.length,0);
});
test('aplicar preserva identidade e restaura valores iniciais; versão, posse e D&D são protegidos',()=>{
 const s=seed(),e=imported(s,template(),gm,{shared:true}),c=s.characters[0];const identity=Object.fromEntries(['id','name','concept','ownerId','portrait','story','color'].map(k=>[k,structuredClone(c[k])]));
 const apply=(access=alice,data={})=>mutateSheetTemplates(s,'sheetTemplateApply',{templateId:e.id,characterId:'a',expectedVersion:1,expectedHistoryVersion:0,...data},access);
 assert.throws(()=>apply(bob),{status:403});assert.throws(()=>apply(alice,{expectedVersion:0}),{status:409});assert.throws(()=>apply(alice,{expectedHistoryVersion:1}),{status:409});c.dnd={level:1};assert.throws(()=>apply(),{status:400});delete c.dnd;
 apply();for(const key of Object.keys(identity))assert.deepEqual(c[key],identity[key]);assert.equal(c.values.power,'2');assert.equal(resolveSheetFormula(c.rollButtons[0].formula,s,c).formula,'2d6+2');
 c.layout[0].label='Pessoal';assert.equal(s.sheetTemplates.items[0].fields[0].label,'Poder');
});
test('importação rejeita esquema malicioso, referências inválidas e expressões não suportadas',()=>{
 const invalid=[{fields:[]},{fields:[field(),field()]},{fields:[{...field(),type:'html'}]},{fields:[{...field(),id:'<script>'}]},{fields:[{...field(),initial:'Infinity'}]}, {fields:[field('health','counter','10/2')]},{skills:[{id:'s',name:'Teste',attribute:'missing'}]}, {rollButtons:[{id:'r',name:'Teste',formula:'2d6+@{missing}'}]},{rollButtons:[{id:'r',name:'Teste',formula:'process.exit()'}]},{rollButtons:[{id:'r',name:'Teste',formula:'99d1000'}]},{masteries:[{id:'m',name:'Maestria',attributeId:'power',die:'2d6'}]},{masteries:[{id:'m',name:'Maestria',attributeId:'missing',die:'1d4'}]}];
 for(const extra of invalid){const s=seed(),before=JSON.stringify(s);assert.throws(()=>imported(s,template(extra)));assert.equal(JSON.stringify(s),before);}
});
test('texto inicial privado é removido; recursos e maestrias ficam renovados',()=>{
 const e=template({fields:[field(),field('story','long','SEGREDO'),field('name','text','NOME PRIVADO'),field('check','check','true'),field('hp','counter','1/12')],masteries:[{id:'m',name:'Maestria',attributeId:'power',die:'1d4',remaining:0}]});const c=sheetTemplateCharacter(e);
 assert.equal(c.layout[1].initial,'');assert.equal(c.layout[2].initial,'');assert.equal(c.layout[3].initial,'false');assert.equal(c.layout[4].initial,'12/12');assert.equal(c.masteries[0].remaining,1);
});
test('orçamento por modelo e biblioteca rejeita sem alterar estado existente',()=>{
 const s=seed();assert.throws(()=>imported(s,template({abilities:Array.from({length:30},(_,i)=>({id:'ability'+i,name:'Teste',description:'x'.repeat(4000)}))})),{status:413});assert.equal(s.sheetTemplates,undefined);
 const heavy=template({abilities:Array.from({length:12},(_,i)=>({id:'ability'+i,name:'Teste',description:'x'.repeat(4000)}))});for(let i=0;i<8;i++)imported(s,heavy);const before=JSON.stringify(s);
 assert.throws(()=>imported(s,heavy),{status:413});assert.equal(JSON.stringify(s),before);
 const e=s.sheetTemplates.items[0];assert.throws(()=>mutateSheetTemplates(s,'sheetTemplateUpdate',{id:e.id,expectedVersion:1,name:'Overwrite',shared:'true'},gm),{status:400});assert.equal(JSON.stringify(s),before);
});
test('convidado não pode importar ou capturar e limite total evita abuso',()=>{
 const s=seed();assert.throws(()=>imported(s,template(),{guest:true}),{status:403});for(let i=0;i<30;i++)imported(s);assert.throws(()=>imported(s),{status:409});
});

test('prévia de aplicação limita destinos editáveis e captura versões antes da confirmação',async()=>{
 const {sheetTemplateApplyForm,sheetTemplateLibrary}=await import('../public/sheet-templates.mjs');
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ui={esc,select:()=>'',submit:()=>'<button>Aplicar</button>',button:()=>''};
 const s=seed(),e=imported(s);s.characters[0].access='full';s.characters[0].sheetHistory={version:8};s.characters[1].access='summary';s.characters.push({...s.characters[0],id:'dd',dnd:{}});
 const html=sheetTemplateApplyForm(e,{master:false,state:s},ui);assert.ok(html.includes('data-history-version="8"'));assert.ok(html.includes('value="a"'));assert.ok(!html.includes('value="b"'));assert.ok(!html.includes('value="dd"'));assert.ok(html.includes('required'));
 const libraryHtml=sheetTemplateLibrary({state:{sheetTemplates:{items:[{...e,name:'<script>bad</script>'}]}}},ui);assert.ok(!libraryHtml.includes('<script>'));assert.ok(libraryHtml.includes('&lt;script&gt;'));
});
