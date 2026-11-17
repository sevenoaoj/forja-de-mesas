import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {newCampaign,sheetFields} from '../model.mjs';
import {sheetModules,tileIds,defaultSheetAppearance,sheetAppearance,validateSheetAppearance,moveTile,reorderTile,removeTile,changeSplit,splitAt,sheetLayoutTemplate,sheetThemeVariables,sheetToneDefaults} from '../sheet-layout.mjs';
import {renderSheetMosaic,renderSheetLayoutEditor,sheetThemeStyle,dropEdge,createSheetMosaic} from '../public/sheet-mosaic.mjs';
const state=newCampaign('Layout',true),character=state.characters[0];
test('modelos em mosaico incluem todos os campos e módulos uma única vez',()=>{
 const modules=sheetModules(state,character),expected=modules.map(module=>module.id).sort();
 for(const kind of ['balanced','focus','stack']){
  assert.equal(sheetLayoutTemplate([],kind),null);
  const appearance=defaultSheetAppearance(state,character);appearance.tree=sheetLayoutTemplate(modules,kind);
  const validated=validateSheetAppearance(appearance,state,character);
  assert.deepEqual(tileIds(validated.tree).sort(),expected);
  assert.equal(new Set(tileIds(validated.tree)).size,modules.length);
 }
});
test('mover por bordas, trocar no centro e redimensionar conservam módulos e valores',()=>{
 const before=structuredClone(character),appearance=defaultSheetAppearance(state,character),ids=tileIds(appearance.tree).sort();
 for(const edge of ['left','right','top','bottom','center']){
  const tree=moveTile(appearance.tree,'portrait','field:f1',edge);assert.deepEqual(tileIds(tree).sort(),ids);
  assert.deepEqual(tileIds(removeTile(tree,'portrait')).sort(),ids.filter(id=>id!=='portrait'));
  assert.deepEqual(validateSheetAppearance({...appearance,tree},state,character).hidden,[]);
 }
 const next=changeSplit(appearance.tree,'',{ratio:.9,axis:'y'});assert.equal(splitAt(next,'').ratio,.8);assert.equal(next.axis,'y');assert.equal(appearance.tree.axis,'x');
 assert.deepEqual(character,before);
});
test('ocultar e adicionar campos preserva dados, remove módulos obsoletos e mostra novos campos',()=>{
 const appearance=defaultSheetAppearance(state,character);appearance.tree=removeTile(appearance.tree,'field:f1');appearance.hidden=['field:f1'];
 const custom={...structuredClone(character),appearance};let updated=sheetAppearance(state,custom);
 assert.ok(!tileIds(updated.tree).includes('field:f1'));assert.equal(custom.values.f1,'1');
 custom.layout=[...sheetFields(state,character).filter(field=>field.id!=='f2'),{id:'new',label:'Novo recurso',type:'counter',group:'Recursos',initial:'1/2'}];
 updated=sheetAppearance(state,custom);assert.ok(tileIds(updated.tree).includes('field:new'));assert.ok(!tileIds(updated.tree).includes('field:f2'));assert.ok(!tileIds(updated.tree).includes('field:f1'));
 assert.ok(sheetFields(state,custom).some(field=>field.id==='f1'));
});
test('validação rejeita módulos duplicados, CSS externo, divisões inválidas e árvores profundas',()=>{
 const appearance=defaultSheetAppearance(state,character);
 for(const patch of [
  {tree:{axis:'x',ratio:.5,first:{tile:'portrait'},second:{tile:'portrait'}}},
  {tree:{tile:'alheio'}},{hidden:['portrait']},{options:{...appearance.options,accent:'red; background:url(https://evil)'}},
  {options:{...appearance.options,font:'url(https://evil)'}},{options:{...appearance.options,height:99999}},{tiles:{portrait:{title:'x'.repeat(81)}}}
 ])assert.throws(()=>validateSheetAppearance({...appearance,...patch},state,character),error=>error.status===400);
 let deep={tile:'portrait'};for(let i=0;i<26;i++)deep={axis:'x',ratio:.5,first:deep,second:{tile:'identity'}};
 assert.throws(()=>validateSheetAppearance({...appearance,tree:deep},state,character),error=>error.status===400);
});
async function room(){
 const rows=new Map(),store={async get(id){return structuredClone(rows.get(id));},async create(row){rows.set(row.id,structuredClone(row));},async save(row){await Promise.resolve();if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const request=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await request('','POST',null,{name:'Personalização',example:true})).json(),base='/'+created.id;
 const member='e'.repeat(64);await request(base+'/join','POST',created.invite,{key:member});
 const action=(action,data,key=member)=>request(base+'/action','POST',key,{action,data});await action('characterClaim',{id:'lyra'});
 const view=async(key=member)=>(await request(base,'GET',key)).json();
 return {rows,created,member,base,request,action,view};
}
test('jogador salva sua organização, mestre recebe a mesma e outros jogadores recebem só resumo',async()=>{
 const r=await room(),before=(await r.view()).state.characters[0];const appearance=defaultSheetAppearance(state,before);appearance.tree=moveTile(appearance.tree,'portrait','field:f1','right');appearance.hidden=['field:f2'];appearance.tree=removeTile(appearance.tree,'field:f2');appearance.options.font='serif';appearance.options.accent='#123456';
 const reply=await r.action('sheetAppearance',{id:'lyra',expectedVersion:0,appearance});assert.equal(reply.status,200);
 const own=(await reply.json()).state.characters[0];assert.equal(own.appearance.version,1);assert.deepEqual(own.values,before.values);assert.deepEqual(own.skills,before.skills);assert.equal(own.color,before.color);
 const master=(await r.view(r.created.key)).state.characters[0];assert.deepEqual(master.appearance,own.appearance);
 const guest=await r.view(r.created.invite);assert.equal(guest.state.characters[0].appearance,undefined);
 assert.equal((await r.action('sheetAppearance',{id:'dorian',expectedVersion:0,appearance})).status,403);
 assert.equal((await r.action('sheetAppearance',{id:'lyra',expectedVersion:0,appearance},r.created.invite)).status,403);
 assert.equal((await r.action('sheetAppearance',{id:'lyra',expectedVersion:0,appearance})).status,409);
 // Appearance changes do not intercept existing resource, mastery, or field actions.
 assert.equal((await r.action('sheetCounter',{id:'lyra',field:'f4',step:-1})).status,200);
 assert.equal((await r.view()).state.characters[0].values.f4,'17/22');
});
test('edições concorrentes preservam a primeira aparência salva e não mudam valores',async()=>{
 const r=await room(),appearance=defaultSheetAppearance(state,character);
 const replies=await Promise.all([r.action('sheetAppearance',{id:'lyra',expectedVersion:0,appearance}),r.action('sheetAppearance',{id:'lyra',expectedVersion:0,appearance:{...appearance,options:{...appearance.options,font:'mono'}}})]);
 assert.deepEqual(replies.map(reply=>reply.status).sort(),[200,409]);assert.equal((await r.view()).state.characters[0].values.f1,'1');
});
test('renderização escapa títulos e oferece controles de toque/teclado e módulos ocultos',()=>{
 const appearance=defaultSheetAppearance(state,character);appearance.options.layout='tiling';appearance.tiles.portrait={title:'<script>Foto</script>'};
 const html=renderSheetMosaic(state,character,appearance,{editing:true,renderModule:id=>'<p>'+id+'</p>'});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('data-sheet-drag="portrait"'));assert.ok(html.includes('role="separator"'));assert.ok(html.includes('data-sheet-resize=""'));
 const tools=renderSheetLayoutEditor(state,character,appearance,true);assert.ok(tools.includes('data-mosaic-visible="field:f1"'));assert.ok(tools.includes('data-sheet-move-form'));assert.ok(tools.includes('Salvar aparência'));
 const rect={left:0,top:0,width:100,height:100};assert.equal(dropEdge(rect,5,50),'left');assert.equal(dropEdge(rect,50,5),'top');assert.equal(dropEdge(rect,95,50),'right');assert.equal(dropEdge(rect,50,95),'bottom');assert.equal(dropEdge(rect,50,50),'center');
});
class Node extends EventTarget{
 constructor(dataset={}){super();this.dataset=dataset;this.style={setProperty(key,value){this[key]=value;}};this.classes=new Set();this.classList={add:key=>this.classes.add(key),remove:key=>this.classes.delete(key)};this.hidden=false;}
 closest(selector){const match=/^\[data-([a-z-]+)\]$/.exec(selector);if(match){const key=match[1].replace(/-([a-z])/g,(_,ch)=>ch.toUpperCase());if(Object.hasOwn(this.dataset,key))return this;}return this.parent?.closest(selector)||null;}
 matches(selector){return this.closest(selector)===this;}
 setPointerCapture(id){this.pointer=id;}
 setAttribute(key,value){this[key]=value;}
 focus(){this.focused=true;}
 getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
}
function editorFixture(mode='tiling',packingFactory){
 const root=new Node(),leafA=new Node({sheetLeaf:'portrait'}),leafB=new Node({sheetLeaf:'field:f1'}),handle=new Node({sheetDrag:'portrait'}),split=new Node({sheetSplit:''}),bar=new Node({sheetResize:''}),status=new Node();
 handle.parent=leafA;bar.parent=split;
 const all=[leafA,leafB,handle,split,bar,status];let renders=0;const errors=[];
 root.contains=node=>all.includes(node);root.querySelectorAll=selector=>selector==='[data-drop-edge]'?all.filter(node=>node.dataset.dropEdge):selector==='.is-dragging'?all.filter(node=>node.classes.has('is-dragging')):[];
 const canvas=new Node();canvas.classList.contains=name=>name==='layout-grid';
 root.querySelector=selector=>selector==='[data-sheet-layout-status]'?status:packingFactory&&['[data-sheet-mosaic]','.sheet-mosaic-grid'].includes(selector)?canvas:bar;
 const doc={elementFromPoint:()=>leafB};
 const controller=createSheetMosaic({render:()=>renders++,report:message=>errors.push(message),document:doc,...(packingFactory?{packingFactory}:{})});
 const legacy={...character,appearance:{...defaultSheetAppearance(state,character),options:{...defaultSheetAppearance(state,character).options,layout:mode}}};controller.sync(state,legacy,'room/lyra');controller.begin();controller.mount(root);
 const fire=(type,target,extra={})=>{const event=new Event(type,{cancelable:true});Object.defineProperties(event,{target:{value:target},...Object.fromEntries(Object.entries(extra).map(([key,value])=>[key,{value}]))});root.dispatchEvent(event);return event;};
 return {controller,root,leafA,leafB,handle,bar,split,status,fire,errors,get renders(){return renders;}};
}
test('arraste por ponteiro mostra encaixe e salva uma única movimentação, com desfazer',()=>{
 const f=editorFixture(),before=structuredClone(f.controller.appearance.tree);
 f.fire('pointerdown',f.handle,{button:0,pointerId:1,clientX:0,clientY:0});
 f.fire('pointermove',f.handle,{pointerId:1,clientX:95,clientY:50});assert.equal(f.leafB.dataset.dropEdge,'right');assert.ok(f.status.textContent.includes('à direita'));
 f.fire('pointerup',f.handle,{pointerId:1});assert.equal(f.controller.canUndo,true);assert.equal(f.leafB.dataset.dropEdge,undefined);
 assert.deepEqual(f.controller.appearance.tree,moveTile(before,'portrait','field:f1','right'));assert.equal(f.controller.payload().expectedVersion,0);
 f.controller.undo();assert.deepEqual(f.controller.appearance.tree,before);assert.deepEqual(f.errors,[]);f.controller.dispose();
});
test('divisória redimensiona por toque/teclado, cancelamento restaura e remontagem não duplica eventos',()=>{
 const f=editorFixture(),initial=f.controller.appearance.tree.ratio;
 f.controller.mount(f.root);
 f.fire('pointerdown',f.bar,{button:0,pointerId:4,clientX:30,clientY:50});f.fire('pointermove',f.bar,{pointerId:4,clientX:70,clientY:50});assert.equal(f.split.style['--split-a'],'0.7fr');
 f.fire('pointercancel',f.bar,{pointerId:4});assert.equal(f.split.style['--split-a'],initial+'fr');assert.equal(f.controller.canUndo,false);
 f.fire('pointerdown',f.bar,{button:0,pointerId:5,clientX:30,clientY:50});f.fire('pointermove',f.bar,{pointerId:5,clientX:70,clientY:50});f.fire('pointerup',f.bar,{pointerId:5});assert.equal(f.controller.appearance.tree.ratio,.7);
 f.fire('keydown',f.bar,{key:'Home'});assert.equal(f.controller.appearance.tree.ratio,.2);assert.equal(f.bar.focused,true);
 f.controller.undo();assert.equal(f.controller.appearance.tree.ratio,.7);f.controller.undo();assert.equal(f.controller.appearance.tree.ratio,initial);assert.equal(f.controller.canUndo,false);assert.deepEqual(f.errors,[]);f.controller.dispose();
});
test('ocultar, reativar, renomear e mudar opções é um rascunho reversível',()=>{
 const f=editorFixture(),before=structuredClone(character),visible=new Node({mosaicVisible:'portrait'});visible.checked=false;
 f.fire('change',visible);assert.ok(!tileIds(f.controller.appearance.tree).includes('portrait'));visible.checked=true;f.fire('change',visible);assert.ok(tileIds(f.controller.appearance.tree).includes('portrait'));
 const title=new Node({mosaicTitle:'portrait'});title.value='Minha foto';f.fire('change',title);assert.equal(f.controller.appearance.tiles.portrait.title,'Minha foto');
 const color=new Node({mosaicOption:'accent'});color.value='#ffd700';f.fire('change',color);assert.equal(f.controller.appearance.options.accent,'#ffd700');
 assert.deepEqual(character,before);f.controller.discard();assert.equal(f.controller.editing,false);assert.equal(f.controller.appearance.tiles.portrait,undefined);f.controller.dispose();
});
test('aparência e recurso salvos simultaneamente preservam ambos os resultados',async()=>{
 const r=await room(),appearance=defaultSheetAppearance(state,character);
 const replies=await Promise.all([r.action('sheetAppearance',{id:'lyra',expectedVersion:0,appearance}),r.action('sheetCounter',{id:'lyra',field:'f4',step:-1})]);
 assert.ok(replies.every(reply=>reply.status===200));const own=(await r.view()).state.characters[0];assert.equal(own.appearance.version,1);assert.equal(own.values.f4,'17/22');
});
test('campos alterados durante a organização são reconciliados, inclusive após desfazer',()=>{
 const f=editorFixture(),title=new Node({mosaicTitle:'portrait'});title.value='Foto';f.fire('change',title);
 const changed={...structuredClone(character),layout:[...sheetFields(state,character).filter(field=>field.id!=='f1'),{id:'new',label:'Novo',group:'Geral',type:'text',initial:''}]};
 f.controller.sync(state,changed,'room/lyra');assert.ok(!tileIds(f.controller.appearance.tree).includes('field:f1'));assert.ok(tileIds(f.controller.appearance.tree).includes('field:new'));
 f.controller.undo();assert.ok(!tileIds(f.controller.appearance.tree).includes('field:f1'));assert.ok(tileIds(f.controller.appearance.tree).includes('field:new'));f.controller.dispose();
});

test('grade simples é o padrão e não apresenta divisórias nem exige altura fixa',()=>{
 const appearance=defaultSheetAppearance(state,character);assert.equal(appearance.options.layout,'grid');
 const html=renderSheetMosaic(state,character,appearance,{editing:true,renderModule:id=>'<p>'+id+'</p>'});
 assert.ok(html.includes('sheet-mosaic-grid'));assert.ok(!html.includes('sheet-mosaic-canvas'));assert.ok(!html.includes('data-sheet-resize'));
 assert.ok(html.includes('data-sheet-step="portrait"'));assert.ok(html.includes('data-mosaic-span="portrait"'));
 const editor=renderSheetLayoutEditor(state,character,appearance,true);assert.ok(editor.includes('Simples · ajuste automático'));assert.ok(!editor.includes('data-mosaic-option="height"'));assert.ok(!editor.includes('data-sheet-move-form'));
});
test('aparências anteriores abrem na grade sem perder a árvore, módulos ocultos ou títulos',()=>{
 const old=defaultSheetAppearance(state,character);delete old.options.layout;delete old.options.columns;old.tiles.portrait={title:'Meu retrato'};old.hidden=['field:f1'];old.tree=removeTile(old.tree,'field:f1');
 const before=structuredClone(old),appearance=sheetAppearance(state,{...character,appearance:old});assert.equal(appearance.options.layout,'grid');assert.deepEqual(appearance.tree,before.tree);assert.deepEqual(appearance.hidden,before.hidden);assert.deepEqual(old,before);
 const advanced=validateSheetAppearance({...appearance,options:{...appearance.options,layout:'tiling'}},state,character);assert.deepEqual(advanced.tree,before.tree);assert.equal(advanced.tiles.portrait.title,'Meu retrato');
});
test('reordenação simples move antes/depois sem duplicar ou perder blocos',()=>{
 const tree=defaultSheetAppearance(state,character).tree,original=tileIds(tree);
 for(const placement of ['before','after']){
  const next=reorderTile(tree,'portrait','field:f1',placement),ids=tileIds(next);
  assert.deepEqual([...ids].sort(),[...original].sort());assert.equal(ids.indexOf('portrait'),ids.indexOf('field:f1')+(placement==='before'?-1:1));
 }
 assert.deepEqual(reorderTile(tree,'portrait','portrait'),tree);assert.deepEqual(reorderTile(tree,'sumiu','portrait'),tree);
});
test('setas reorganizam no modo simples e respeitam o início/fim da lista',()=>{
 const f=editorFixture('grid'),step=new Node({sheetStep:'portrait',direction:'-1'});
 f.fire('click',step);assert.equal(tileIds(f.controller.appearance.tree)[0],'portrait');const renders=f.renders;
 f.fire('click',step);assert.equal(f.renders,renders);
 step.dataset.direction='1';f.fire('click',step);assert.equal(tileIds(f.controller.appearance.tree)[1],'portrait');
 f.controller.undo();assert.equal(tileIds(f.controller.appearance.tree)[0],'portrait');assert.deepEqual(f.errors,[]);f.controller.dispose();
});
test('arraste simples indica antes/depois e só confirma a ordem ao soltar',()=>{
 const f=editorFixture('grid'),before=structuredClone(f.controller.appearance.tree);
 f.fire('pointerdown',f.handle,{button:0,pointerId:1,clientX:0,clientY:0});f.fire('pointermove',f.handle,{pointerId:1,clientX:50,clientY:90});
 assert.equal(f.leafB.dataset.dropEdge,'after');assert.deepEqual(f.controller.appearance.tree,before);
 f.fire('pointerup',f.handle,{pointerId:1});assert.deepEqual(f.controller.appearance.tree,reorderTile(before,'portrait','field:f1','after'));f.controller.dispose();
});
test('ajustes de largura, cor e título preservam a tela e podem ser desfeitos',()=>{
 const f=editorFixture('grid'),before=f.renders,span=new Node({mosaicSpan:'portrait'});span.value='3';f.fire('change',span);
 const title=new Node({mosaicTitle:'portrait'});title.value='Foto';f.fire('change',title);
 const color=new Node({mosaicOption:'accent'});color.value='#112233';f.fire('change',color);
 assert.equal(f.renders,before);assert.equal(f.controller.appearance.tiles.portrait.span,3);assert.equal(f.controller.payload().appearance.options.accent,'#112233');
 f.controller.undo();assert.notEqual(f.controller.appearance.options.accent,'#112233');assert.equal(f.controller.appearance.tiles.portrait.span,3);f.controller.dispose();
});
test('servidor conserva larguras válidas e rejeita modos, larguras e colunas inválidos',async()=>{
 const r=await room(),appearance=defaultSheetAppearance(state,character);appearance.tiles.portrait={span:3};appearance.options.columns=2;
 const reply=await r.action('sheetAppearance',{id:'lyra',expectedVersion:0,appearance});assert.equal(reply.status,200);const own=(await reply.json()).state.characters[0];assert.equal(own.appearance.tiles.portrait.span,3);assert.equal(own.appearance.options.columns,2);
 for(const options of [{layout:'arbitrary'},{columns:0},{columns:4},{columns:1.5}])assert.throws(()=>validateSheetAppearance({...appearance,options:{...appearance.options,...options}},state,character),error=>error.status===400);
 for(const span of [0,4,'3'])assert.throws(()=>validateSheetAppearance({...appearance,tiles:{portrait:{span}}},state,character),error=>error.status===400);
});

test('grade reativa confirma a prévia só ao soltar e desfaz a movimentação inteira',()=>{
 let finished=0,cancelled=0,previews=0;
 const original=tileIds(defaultSheetAppearance(state,character).tree),next=[...original.filter(id=>id!=='portrait'),'portrait'];
 const f=editorFixture('grid',()=>({begin(){},preview(){previews++;return next;},finish(){finished++;return next;},cancel(){cancelled++;},dispose(){},refresh(){}}));
 const before=structuredClone(f.controller.appearance.tree);
 f.fire('pointerdown',f.handle,{button:0,pointerId:11,clientX:0,clientY:0});f.fire('pointermove',f.handle,{pointerId:11,clientX:400,clientY:300});
 assert.ok(previews>0);assert.deepEqual(f.controller.appearance.tree,before);assert.equal(f.controller.canUndo,false);
 f.fire('keydown',f.handle,{key:'Escape'});assert.ok(cancelled>0);assert.deepEqual(f.controller.appearance.tree,before);
 f.fire('pointerdown',f.handle,{button:0,pointerId:12,clientX:0,clientY:0});f.fire('pointermove',f.handle,{pointerId:12,clientX:400,clientY:300});f.fire('pointerup',f.handle,{pointerId:12});
 assert.equal(finished,1);assert.deepEqual(tileIds(f.controller.appearance.tree),next);assert.equal(f.controller.canUndo,true);
 f.controller.undo();assert.deepEqual(f.controller.appearance.tree,before);assert.equal(f.controller.canUndo,false);f.controller.dispose();
});
test('paleta por seção aparece nas duas leituras e a cor do bloco tem prioridade na personalizada',()=>{
 const appearance=defaultSheetAppearance(state,character);appearance.options.tones.attributes='#11aacc';appearance.tiles.portrait={accent:'#aabbcc'};
 const own={...character,appearance},before=structuredClone(own),custom=renderSheetMosaic(state,own,appearance,{editing:true,renderModule:id=>id});
 assert.ok(custom.includes('--tone-attributes:#11aacc'));assert.ok(custom.includes('--section-accent:#aabbcc'));assert.ok(custom.includes('data-mosaic-block-accent="portrait"'));
 const standard=sheetThemeStyle(state,own);assert.ok(standard.includes('--tone-attributes:#11aacc'));assert.deepEqual(own,before);
 const legacy=structuredClone(appearance);delete legacy.options.tones;
 assert.deepEqual(sheetAppearance(state,{...character,appearance:legacy}).options.tones,sheetToneDefaults);
 assert.equal(sheetThemeVariables(appearance.options)['--tone-resources'],sheetToneDefaults.resources);
});
test('servidor persiste cores por seção/bloco e rejeita valores que não são cores hexadecimais',async()=>{
 const r=await room(),appearance=defaultSheetAppearance(state,character);appearance.options.tones.resources='#11cc99';appearance.tiles.portrait={accent:'#ffdd66'};
 const result=await r.action('sheetAppearance',{id:'lyra',expectedVersion:0,appearance});assert.equal(result.status,200);
 const own=(await result.json()).state.characters[0];assert.equal(own.appearance.options.tones.resources,'#11cc99');assert.equal(own.appearance.tiles.portrait.accent,'#ffdd66');
 for(const color of ['red','url(evil)',42,'#1234']){
  assert.throws(()=>validateSheetAppearance({...appearance,tiles:{portrait:{accent:color}}},state,character),error=>error.status===400);
  assert.throws(()=>validateSheetAppearance({...appearance,options:{...appearance.options,tones:{dice:color}}},state,character),error=>error.status===400);
 }
 const inherit=validateSheetAppearance({...appearance,tiles:{portrait:{accent:''}}},state,character);assert.equal(inherit.tiles.portrait.accent,undefined);
});
