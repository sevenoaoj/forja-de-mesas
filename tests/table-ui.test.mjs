import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newCampaign} from '../model.mjs';
import {mutateTable,normalizeTable} from '../table-model.mjs';

const source=await readFile(new URL('../public/table.mjs',import.meta.url),'utf8');
const modelURL=new URL('../table-model.mjs',import.meta.url).href;
const {createTabletop}=await import('data:text/javascript;base64,'+
  Buffer.from(source.replace("'./loot.mjs'",JSON.stringify(new URL('../public/loot.mjs',import.meta.url).href)).replace("'./table-vision.mjs'",JSON.stringify(new URL('../public/table-vision.mjs',import.meta.url).href)).replace("'./token-icons.mjs'",JSON.stringify(new URL('../token-icons.mjs',import.meta.url).href)).replace("'./table-rolls.mjs'",JSON.stringify(new URL('../public/table-rolls.mjs',import.meta.url).href)).replace("'./rolls.mjs'",JSON.stringify(new URL('../public/rolls.mjs',import.meta.url).href)).replace("'./table-model.mjs'",JSON.stringify(modelURL)).replace("'./model.mjs'",JSON.stringify(new URL('../model.mjs',import.meta.url).href))).toString('base64'));

class Element extends EventTarget {
  constructor(dataset={}) {
    super();
    this.dataset=dataset;
    this.style={setProperty(name,value){this[name]=value;}};
    const classes=new Set();
    this.classList={toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)};
    this.innerHTML='';
    this.textContent='';
    this.hidden=false;
    this.captures=new Set();
  }
  closest(selector) {
    if (selector==='[data-table-token]' && this.dataset.tableToken) return this;
    const attributes={
      '[data-table-tool]':'tableTool','[data-table-zoom]':'tableZoom',
      '[data-table-action]':'tableAction','[data-table-select]':'tableSelect',
      '[data-table-character]':'tableCharacter','[data-table-move]':'tableMove',
      '[data-table-sheet-roll]':'tableSheetRoll','[data-table-roll-attribute]':'tableRollAttribute',
      '[data-table-skill-roll]':'tableSkillRoll','[data-table-roll-resource]':'tableRollResource',
      '[data-table-roll-tab]':'tableRollTab','[data-table-insert-field]':'tableInsertField'
    };
    return this.dataset[attributes[selector]] ? this : null;
  }
  matches(selector) {return selector.split(',').some(item=>{const match=/^\[data-([a-z-]+)\]$/.exec(item.trim());return match&&Object.hasOwn(this.dataset,match[1].replace(/-([a-z])/g,(_,ch)=>ch.toUpperCase()));});}
  querySelectorAll(){return [];}
  setAttribute(name,value) {this[name]=value;}
  replaceChildren() {this.innerHTML='';}
  setPointerCapture(id) {this.captures.add(id);}
  hasPointerCapture(id) {return this.captures.has(id);}
  releasePointerCapture(id) {this.captures.delete(id);}
  focus() {document.activeElement=this;}
}

function fixture({master=true,columns=16,rows=10,distance='euclidean',failMove=false,remountOnAction=false,holdRotations=false}={}) {
  const row={id:'test-room',rev:0,master,state:newCampaign('Teste',true)};
  mutateTable(row.state,'tableSettings',{grid:{columns,rows,size:2,distance}},true);
  const nodes=new Map();
  const get=selector=>{
    if (!nodes.has(selector)) nodes.set(selector,new Element());
    return nodes.get(selector);
  };
  const root=new Element();
  root.querySelector=get;
  const viewport=get('.vtt-viewport');
  viewport.clientWidth=800;
  viewport.clientHeight=500;
  viewport.getBoundingClientRect=()=>({left:0,top:0,width:800,height:500});
  const world=get('.vtt-world');
  world.getBoundingClientRect=()=>{
    const transform=/translate\(([-.\d]+)px,([-.\d]+)px\) scale\(([-.\d]+)\)/.exec(world.style.transform);
    const [,x=0,y=0,zoom=1]=transform||[];
    return {
      left:(parseFloat(world.style.left)||0)+Number(x),
      top:(parseFloat(world.style.top)||0)+Number(y),
      width:parseFloat(world.style.width)*zoom,
      height:parseFloat(world.style.width)*rows/columns*zoom
    };
  };
  const tokens=row.state.tokens.map(token=>new Element({tableToken:token.id}));
  root.querySelectorAll=selector=>selector==='[data-table-token]' ? tokens : [];
  root.contains=node=>tokens.includes(node)||[...nodes.values()].includes(node);
  const calls=[];
  const reports=[],previews=[],rotationResolvers=[],openedLoot=[];
  const controller=createTabletop({
    action:async(name,data)=>{
      calls.push({name,data});
      if(name==='tokenRotate'&&holdRotations)await new Promise(resolve=>rotationResolvers.push(resolve));
      if (failMove && name==='tokenMove') throw new Error('Área ainda coberta.');
      mutateTable(row.state,name,data,master);
      if (remountOnAction) {
        document.activeElement=null;
        controller.dispose();
        controller.render(row);
        controller.mount(root,row);
      }
    },
    realtime:event=>previews.push(event),
    openCharacter(){},openLoot:id=>openedLoot.push(id),report:message=>reports.push(message),
    requestAsset:async()=>new Response('')
  });
  controller.render(row);
  controller.mount(root,row);
  const dispatch=(target,type,properties={},actualTarget=target)=>{
    const event=new Event(type,{cancelable:true});
    Object.defineProperties(event,Object.fromEntries(Object.entries({
      button:0,pointerId:1,...properties,target:actualTarget
    }).map(([key,value])=>[key,{value}])));
    target.dispatchEvent(event);
    return event;
  };
  const click=dataset=>dispatch(root,'click',{},new Element(dataset));
  const point=(x,y)=>{
    const box=world.getBoundingClientRect();
    return {clientX:box.left+x/columns*box.width,clientY:box.top+y/rows*box.height};
  };
  return {row,root,viewport,world,tokens,calls,reports,previews,controller,get,dispatch,click,point,rotationResolvers,openedLoot};
}

globalThis.document={activeElement:null};

test('régua mantém a medida ao soltar e respeita a regra da campanha',()=>{
  for (const [distance,result] of [['euclidean','10 m'],['chebyshev','8 m'],['manhattan','14 m']]) {
    const f=fixture({distance});
    f.click({tableTool:'measure'});
    f.dispatch(f.viewport,'pointerdown',f.point(1,1));
    f.dispatch(f.viewport,'pointermove',f.point(4,5));
    f.dispatch(f.viewport,'pointerup',f.point(4,5));
    assert.match(f.get('[data-table-help]').textContent,new RegExp(result));
    assert.ok(f.get('.vtt-preview').innerHTML.includes('<line'));
    assert.equal(f.controller.isInteracting(),false);
    assert.equal(f.calls.length,0);
    f.controller.dispose();
    f.get('.vtt-preview').replaceChildren();
    f.controller.render(f.row);
    f.controller.mount(f.root,f.row);
    assert.match(f.get('[data-table-help]').textContent,new RegExp(result));
    assert.ok(f.get('.vtt-preview').innerHTML.includes('<line'));
    f.controller.dispose();
  }
});

test('arraste salva uma única posição e cancelamento restaura o token',async()=>{
  const f=fixture();
  f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);
  assert.equal(f.controller.isInteracting(),true);
  f.dispatch(f.viewport,'pointermove',f.point(6.5,5.5));
  f.dispatch(f.viewport,'pointerup',f.point(6.5,5.5));
  await Promise.resolve();
  assert.equal(typeof f.calls[0].data.dragId,'string');assert.deepEqual({...f.calls[0],data:{...f.calls[0].data,dragId:undefined}},{name:'tokenMove',data:{id:'lyra',x:6,y:5,dragId:undefined}});
  assert.equal(f.calls.length,1);
  assert.equal(f.controller.isInteracting(),false);
  f.dispatch(f.viewport,'pointerdown',f.point(6.5,5.5),f.tokens[0]);
  f.dispatch(f.viewport,'pointermove',f.point(8.5,6.5));
  f.dispatch(f.viewport,'pointercancel',f.point(8.5,6.5));
  assert.equal(f.calls.length,1);
  assert.equal(f.tokens[0].style.left,6/16*100+'%');
  f.controller.dispose();
});

test('zoom local persiste no remontar e ajustar cabe em mapas verticais',()=>{
  const f=fixture({columns:4,rows:80});
  assert.ok(parseFloat(f.world.style.width)*80/4<=500);
  f.click({tableZoom:'in'});
  assert.equal(f.get('[data-table-zoom-label]').textContent,'125%');
  f.controller.dispose();
  f.controller.render(f.row);
  f.controller.mount(f.root,f.row);
  assert.equal(f.get('[data-table-zoom-label]').textContent,'125%');
  f.click({tableZoom:'fit'});
  assert.equal(f.get('[data-table-zoom-label]').textContent,'100%');
  f.controller.dispose();
});

test('remontar não duplica eventos e jogador vê controles permitidos',async()=>{
  const f=fixture({master:false});
  f.controller.dispose();
  const markup=f.controller.render(f.row);
  assert.ok(!markup.includes('data-table-tool="fog"'));
  assert.ok(!markup.includes('data-table-tool="draw"'));
  assert.ok(!markup.includes('data-act="tableSettings"'));
  f.controller.mount(f.root,f.row);
  f.click({tableTool:'ping'});
  f.dispatch(f.viewport,'pointerdown',f.point(2,3));
  await Promise.resolve();
  assert.equal(f.calls.filter(call=>call.name==='tablePing').length,1);
  assert.equal(f.reports.length,0);
  f.controller.dispose();
});

test('movimento rejeitado restaura a posição visual sem exigir revisão nova',async()=>{
  const f=fixture({master:false,failMove:true});
  f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);
  f.dispatch(f.viewport,'pointermove',f.point(7.5,6.5));
  f.dispatch(f.viewport,'pointerup',f.point(7.5,6.5));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.tokens[0].style.left,4/16*100+'%');
  assert.equal(f.tokens[0].style.top,4/10*100+'%');
  assert.equal(f.reports.length,1);
  f.controller.dispose();
});

test('clique foca token e movimentos sucessivos por teclado preservam foco',async()=>{
  const f=fixture({remountOnAction:true});
  f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);
  f.dispatch(f.viewport,'pointerup',f.point(4.5,4.5));
  assert.equal(document.activeElement,f.tokens[0]);
  for (const step of [1,2]) {
    f.dispatch(f.viewport,'keydown',{key:'ArrowRight'},document.activeElement);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(f.row.state.tokens[0].x,4+step);
    assert.equal(document.activeElement,f.tokens[0]);
  }
  f.controller.dispose();
});

test('pinça amplia e navega sem confirmar movimento acidental de token',async()=>{
  const f=fixture();
  f.dispatch(f.viewport,'pointerdown',{...f.point(4.5,4.5),pointerType:'touch'},f.tokens[0]);
  f.dispatch(f.viewport,'pointermove',{...f.point(5.5,4.5),pointerType:'touch'});
  assert.notEqual(f.tokens[0].style.left,4/16*100+'%');
  f.dispatch(f.viewport,'pointerdown',{...f.point(9.5,4.5),pointerId:2,pointerType:'touch'});
  assert.equal(f.tokens[0].style.left,4/16*100+'%');
  f.dispatch(f.viewport,'pointermove',{...f.point(11.5,4.5),pointerId:2,pointerType:'touch'});
  assert.equal(f.get('[data-table-zoom-label]').textContent,'150%');
  f.dispatch(f.viewport,'pointerup',{clientX:700,clientY:250,pointerId:2,pointerType:'touch'});
  f.dispatch(f.viewport,'pointerup',{clientX:300,clientY:250,pointerType:'touch'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.calls.length,0);
  assert.equal(f.controller.isInteracting(),false);
  f.controller.dispose();
});

test('botões de toque movem o token selecionado e respeitam bloqueio',async()=>{
  const f=fixture({master:false});
  f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);
  f.dispatch(f.viewport,'pointerup',f.point(4.5,4.5));
  assert.match(f.get('[data-table-selection]').innerHTML,/data-table-move="right"/);
  f.click({tableMove:'right'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.row.state.tokens[0].x,5);
  f.row.state.tokens[0].locked=true;
  f.click({tableMove:'right'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.calls.length,1);
  f.controller.dispose();
});


test('prévia da névoa coincide com a área aplicada, diferencia ocultar e cancela com Escape',async()=>{
  const f=fixture();
  f.click({tableTool:'fog'});
  const mode=new Element({fogShape:''});mode.value='rectangle';f.dispatch(f.root,'change',{},mode);
  f.dispatch(f.viewport,'pointerdown',f.point(1.2,1.4));
  f.dispatch(f.viewport,'pointermove',f.point(4.8,5.2));
  assert.match(f.get('.vtt-preview').innerHTML,/width="4" height="5"/);
  assert.match(f.get('.vtt-preview').innerHTML,/fill="#9ce4cd"/);
  assert.match(f.get('[data-table-help]').textContent,/Revelar 4 × 5/);
  f.dispatch(f.viewport,'pointerup',f.point(4.8,5.2));
  await Promise.resolve();
  assert.deepEqual(f.calls[0],{name:'tableFog',data:{operation:'reveal',enabled:true,x:1,y:1,width:4,height:5}});
  const selector=new Element({tableFog:''});selector.value='hide';
  f.dispatch(f.root,'change',{},selector);
  f.dispatch(f.viewport,'pointerdown',{...f.point(16,10),button:2});
  f.dispatch(f.viewport,'pointermove',f.point(16,10));
  assert.match(f.get('.vtt-preview').innerHTML,/x="15" y="9" width="1" height="1"/);
  assert.match(f.get('.vtt-preview').innerHTML,/fill="#ffbd87"/);
  f.dispatch(f.viewport,'keydown',{key:'Escape'});
  f.dispatch(f.viewport,'pointerup',f.point(16,10));
  assert.equal(f.calls.length,1);
  assert.equal(f.get('.vtt-preview').innerHTML,'');
  f.controller.dispose();
});

test('opacidade e prévia do mestre são locais e não alteram o mapa dos jogadores',()=>{
  const f=fixture();
  f.click({tableAction:'fogPreview'});
  assert.equal(f.world.classList.contains('is-player-preview'),true);
  const range=new Element({fogOpacity:''});range.value='35';
  f.dispatch(f.root,'input',{},range);
  assert.equal(f.world.style['--vtt-fog-opacity'],.35);
  assert.equal(f.calls.length,0);
  const markup=f.controller.render(f.row);
  assert.match(markup,/is-player-preview/);
  assert.match(markup,/--vtt-fog-opacity:0.35/);
  const player=f.controller.render({...f.row,master:false});
  assert.ok(!player.includes('data-table-action="fogPreview"'));
  assert.ok(!player.includes('class="vtt-world is-master'));
  f.controller.dispose();
});

test('mapa mantém a proporção e a calibração com bordas parciais em ambos os modos',async()=>{
  const f=fixture();
  f.row.state.map={id:'map',width:1333,height:777};
  mutateTable(f.row.state,'tableSettings',{grid:{mode:'image',cellPixels:100}},true);
  f.controller.dispose();
  const markup=f.controller.render(f.row);
  assert.match(markup,/aspect-ratio:14\/8/);
  f.controller.mount(f.root,f.row);
  await new Promise(resolve=>setImmediate(resolve));
  let sizes=f.get('.vtt-map').style['background-size'].split(' ').map(parseFloat);
  assert.ok(Math.abs(sizes[0]/100*1400-1333)<.001);
  assert.ok(Math.abs(sizes[1]/100*800-777)<.001);
  mutateTable(f.row.state,'tableSettings',{grid:{mode:'manual',columns:12,rows:12}},true);
  f.controller.dispose();f.controller.render(f.row);f.controller.mount(f.root,f.row);
  await new Promise(resolve=>setImmediate(resolve));
  sizes=f.get('.vtt-map').style['background-size'].split(' ').map(parseFloat);
  assert.ok(Math.abs(sizes[0]/sizes[1]-1333/777)<.001);
  assert.equal(f.reports.length,0);
  f.controller.dispose();
});


test('mesa executa rolagem salva com maestria e troca recursos ao selecionar token vinculado',async()=>{
  const f=fixture();
  const lyra=f.row.state.characters[0];
  lyra.rollButtons=[{id:'attack',name:'Golpe da ficha',formula:'2d6+@{f1}'}];
  lyra.masteries=[{id:'mastery',name:'Maestria de Força',attributeId:'f1',die:'1d4',remaining:1}];
  f.controller.render(f.row);
  f.click({tableSelect:'lyra'});
  assert.ok(f.get('[data-table-rolls]').innerHTML.includes('Golpe da ficha'));
  const mastery=new Element({tableRollMastery:''});mastery.value='mastery';
  f.dispatch(f.root,'change',{},mastery);
  f.click({tableSheetRoll:'attack'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls[0],{name:'roll',data:{rollId:'attack',characterId:'lyra',actor:'Lyra Vesper',masteryId:'mastery'}});
  f.click({tableSelect:'dorian'});
  assert.ok(!f.get('[data-table-rolls]').innerHTML.includes('Golpe da ficha'));
  f.click({tableRollResource:'f4',step:'-1'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls[1],{name:'sheetCounter',data:{id:'dorian',field:'f4',step:-1}});
  f.controller.dispose();
});

test('rolagem livre e perícia usam a ficha selecionada e preservam a visão do mapa',async()=>{
  const f=fixture({remountOnAction:true});
  f.click({tableSelect:'lyra'});
  f.click({tableZoom:'in'});
  const before=f.world.style.transform;
  f.click({tableRollAttribute:'f1'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls[0],{name:'roll',data:{attributeId:'f1',characterId:'lyra',actor:'Lyra Vesper',testDice:'1d20'}});
  f.click({tableRollTab:'free'});
  f.click({tableInsertField:'f1'});
  assert.equal(f.get('[data-table-roll-formula]').value,'1d20+@{f1}');
  const formula=new Element({tableRollFormula:''});formula.value='2d6 + Força';
  f.dispatch(f.root,'input',{},formula);
  f.dispatch(f.root,'submit',{},new Element({tableRollForm:''}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls[1],{name:'roll',data:{formula:'2d6 + Força',characterId:'lyra',actor:'Lyra Vesper'}});
  assert.equal(f.world.style.transform,before);
  f.click({tableSkillRoll:'athletics'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls[2],{name:'roll',data:{skillId:'athletics',characterId:'lyra',actor:'Lyra Vesper',testDice:'1d20'}});
  f.controller.dispose();
});

test('jogador recebe dados da própria ficha ao selecionar token de outro personagem',()=>{
  const f=fixture({master:false});
  f.row.characterId='lyra';f.row.state.characters[0].access='full';
  f.row.state.characters[0].rollButtons=[{id:'mine',name:'Minha rolagem',formula:'1d20'}];
  for(const c of f.row.state.characters.slice(1)) {c.access='summary';c.rollButtons=[{id:'secret',name:'Segredo alheio',formula:'10d6'}];}
  f.controller.render(f.row);
  f.click({tableSelect:'dorian'});
  const content=f.get('[data-table-rolls]').innerHTML;
  assert.ok(content.includes('Minha rolagem'));
  assert.ok(!content.includes('Segredo alheio'));
  assert.ok(!content.includes('value="dorian"'));
  const selector=new Element({tableRollCharacter:''});selector.value='dorian';
  f.dispatch(f.root,'change',{},selector);
  assert.ok(f.get('[data-table-rolls]').innerHTML.includes('Minha rolagem'));
  f.controller.dispose();
});


test('histórico fica abaixo do mapa e recebe novas rolagens sem remontar a cena',()=>{
 const f=fixture();
 const html=f.controller.render(f.row);
 assert.ok(html.indexOf('vtt-viewport')<html.indexOf('data-table-roll-history'));
 assert.ok(html.indexOf('data-table-roll-history')<html.indexOf('vtt-inspector'));
 assert.ok(!html.includes('vtt-sheet-roll-history'));
 f.click({tableZoom:'in'});const transform=f.world.style.transform;
 f.controller.syncRolls({id:f.row.id,rev:2,state:{rolls:[{id:'roll',actor:'Mestre',formula:'1d20',total:17,dice:[17],visibility:'gm',rolledBy:'master'}]}});
 assert.ok(f.get('[data-table-roll-history]').innerHTML.includes('17'));
 assert.ok(f.get('[data-table-roll-history]').innerHTML.includes('Só mestre'));
 assert.equal(f.world.style.transform,transform);
 f.controller.dispose();
});

test('cliques em atributos não acumulam bônus e alternar categorias preserva expressão livre',async()=>{
 const f=fixture();f.click({tableSelect:'lyra'});
 f.click({tableRollAttribute:'f1'});await new Promise(resolve=>setImmediate(resolve));
 f.click({tableRollAttribute:'f2'});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.calls[0].data.attributeId,'f1');assert.equal(f.calls[1].data.attributeId,'f2');assert.equal(f.calls[1].data.formula,undefined);
 f.click({tableRollTab:'free'});const field=new Element({tableRollFormula:''});field.value='2d6 + Força';f.dispatch(f.root,'input',{},field);
 f.click({tableRollTab:'resources'});assert.ok(f.get('[data-table-rolls]').innerHTML.includes('Vitalidade'));
 f.click({tableRollTab:'free'});assert.ok(f.get('[data-table-rolls]').innerHTML.includes('2d6 + Força'));
 f.controller.dispose();
});
test('maestria selecionada só acompanha atributo elegível e base dos testes pode ser alterada sem editar a ficha',async()=>{
 const f=fixture(),character=f.row.state.characters[0];character.masteries=[{id:'essence',name:'Maestria',attributeId:'f3',die:'1d4',remaining:1}];
 f.click({tableSelect:'lyra'});const mastery=new Element({tableRollMastery:''});mastery.value='essence';f.dispatch(f.root,'change',{},mastery);
 const base=new Element({tableTestBase:''});base.value='2d6';f.dispatch(f.root,'change',{},base);
 f.click({tableRollAttribute:'f1'});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.calls[0].data.testDice,'2d6');assert.equal(f.calls[0].data.masteryId,undefined);
 f.click({tableRollAttribute:'f3'});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls[1].data.masteryId,'essence');
 f.controller.dispose();
});


test('desenho livre é padrão e preserva curvas que terminam no início',async()=>{
 const f=fixture();f.click({tableTool:'draw'});
 f.dispatch(f.viewport,'pointerdown',f.point(2,2));
 for(const [x,y] of [[3,2],[3,3],[2,3],[2,2]])f.dispatch(f.viewport,'pointermove',f.point(x,y));
 assert.match(f.get('.vtt-preview').innerHTML,/<polyline/);
 f.dispatch(f.viewport,'pointerup',f.point(2,2));await Promise.resolve();
 assert.equal(f.calls[0].name,'tableDrawingAdd');assert.equal(f.calls[0].data.kind,'freehand');assert.equal(f.calls[0].data.points.length,5);
 assert.equal(f.row.state.table.drawings[0].points.length,5);f.controller.dispose();
});
test('desenho longo respeita orçamento e retém o final; Escape descarta',async()=>{
 const f=fixture();f.click({tableTool:'draw'});f.dispatch(f.viewport,'pointerdown',f.point(1,1));
 for(let i=0;i<900;i++)f.dispatch(f.viewport,'pointermove',f.point(1+i%2,1+i/100));
 f.dispatch(f.viewport,'pointerup',f.point(2,9.99));await Promise.resolve();
 assert.ok(f.calls[0].data.points.length<=600);assert.deepEqual(f.calls[0].data.points.at(-1),{x:2,y:9.99});
 f.click({tableTool:'draw'});f.dispatch(f.viewport,'pointerdown',f.point(2,2));f.dispatch(f.viewport,'pointermove',f.point(3,3));f.dispatch(f.viewport,'keydown',{key:'Escape'});f.dispatch(f.viewport,'pointerup',f.point(3,3));
 assert.equal(f.calls.length,1);f.controller.dispose();
});
test('névoa alterna botão direito no mouse e oferece seleção explícita para toque',async()=>{
 const f=fixture();f.click({tableTool:'fog'});
 f.dispatch(f.viewport,'pointerdown',{...f.point(2,2),button:2});f.dispatch(f.viewport,'pointermove',{...f.point(3,4),button:2});
 assert.match(f.get('[data-table-help]').textContent,/Ocultar/);f.dispatch(f.viewport,'pointerup',{...f.point(3,4),button:2});await Promise.resolve();
 assert.equal(f.calls[0].data.operation,'hide');
 const select=new Element({tableFog:''});select.value='hide';f.dispatch(f.root,'change',{},select);
 f.dispatch(f.viewport,'pointerdown',{...f.point(2,2),pointerType:'touch'});f.dispatch(f.viewport,'pointerup',{...f.point(3,3),pointerType:'touch'});await Promise.resolve();
 assert.equal(f.calls[1].data.operation,'hide');
 f.dispatch(f.viewport,'pointerdown',f.point(2,2));f.dispatch(f.viewport,'pointerup',f.point(3,3));await Promise.resolve();assert.equal(f.calls[2].data.operation,'reveal');
 const menu=f.dispatch(f.viewport,'contextmenu');
 f.controller.dispose();
});
test('arraste transmite posição contínua e a confirmação usa o mesmo dragId',async()=>{
 const f=fixture();f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);
 f.dispatch(f.viewport,'pointermove',f.point(5.1,5.2));assert.equal(f.calls.length,0);assert.equal(f.previews[0].phase,'move');assert.ok(Math.abs(f.previews[0].x-4.6)<.0001);
 f.dispatch(f.viewport,'pointerup',f.point(5.1,5.2));await Promise.resolve();
 assert.equal(f.previews.at(-1).phase,'end');assert.equal(f.calls[0].data.dragId,f.previews[0].dragId);assert.equal(f.calls[0].data.x,5);assert.ok(f.previews.at(-1).seq>f.previews[0].seq);
 f.dispatch(f.viewport,'pointerdown',f.point(5.5,5.5),f.tokens[0]);f.dispatch(f.viewport,'pointermove',f.point(6.5,5.5));f.dispatch(f.viewport,'pointercancel',f.point(6.5,5.5));
 assert.equal(f.previews.at(-1).phase,'cancel');f.controller.dispose();
});
test('movimento remoto e snapshot atualizam outro token durante o arraste local',()=>{
 const f=fixture();f.click({tableZoom:'in'});const camera=f.world.style.transform;
 f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);f.dispatch(f.viewport,'pointermove',f.point(5.5,5.5));const own=f.tokens[0].style.left;
 f.controller.receiveRealtime({type:'tokenPreview',id:'dorian',dragId:'remote',seq:1,phase:'move',x:10.3,y:3.7,at:100});
 assert.equal(f.tokens[1].style.left,10.3/16*100+'%');assert.equal(f.tokens[0].style.left,own);
 f.controller.receiveRealtime({type:'tokenPreview',id:'dorian',dragId:'remote',seq:0,phase:'move',x:1,y:1,at:100});assert.equal(f.tokens[1].style.left,10.3/16*100+'%');
 const next=structuredClone(f.row);next.rev=1;next.state.tokens[1].x=11;
 assert.equal(f.controller.syncScene(next),true);assert.equal(f.controller.isInteracting(),true);assert.equal(f.tokens[0].style.left,own);assert.equal(f.world.style.transform,camera);assert.equal(f.tokens[1].style.left,11/16*100+'%');
 f.controller.receiveRealtime({type:'tokenPreview',id:'dorian',dragId:'remote',seq:2,phase:'cancel',at:101});assert.equal(f.tokens[1].style.left,11/16*100+'%');
 f.dispatch(f.viewport,'pointercancel',f.point(5.5,5.5));f.controller.dispose();
});
test('mudança estrutural exige remontagem e perda de permissão cancela gesto local',()=>{
 const f=fixture({master:false});f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);f.dispatch(f.viewport,'pointermove',f.point(5.5,5.5));
 const next=structuredClone(f.row);next.rev=1;next.state.tokens[0].canMove=false;assert.equal(f.controller.syncScene(next),true);assert.equal(f.controller.isInteracting(),false);assert.equal(f.previews.at(-1).phase,'cancel');
 const changed=structuredClone(next);changed.rev=2;changed.state.map={id:'new-map'};assert.equal(f.controller.syncScene(changed),false);f.controller.dispose();
});
test('ping tem nome escapado, dura no máximo1500ms e não reinicia após snapshots/remontagem',()=>{
 const f=fixture();const next=structuredClone(f.row);next.rev=1;next.serverTime=Date.now();next.state.table.pings=[{id:'p1',at:next.serverTime,x:2,y:3,name:'Ana <script>'},{id:'old',at:next.serverTime-2000,x:2,y:3,name:'Antigo'}];
 f.controller.syncScene(next);const layer=f.get('.vtt-pings'),markup=layer.innerHTML;assert.match(markup,/Ana &lt;script&gt;/);assert.ok(!markup.includes('Antigo'));assert.match(markup,/--ping-age:-0ms/);
 f.controller.syncScene({...next,rev:2});assert.equal(layer.innerHTML,markup);
 f.controller.dispose();layer.replaceChildren();f.controller.render(next);f.controller.mount(f.root,next);assert.equal(layer.innerHTML,'');f.controller.dispose();
});
test('fog contém base opaca e máscara conservadora de suavização só na revelação',()=>{
 const f=fixture();mutateTable(f.row.state,'tableFog',{operation:'reveal',enabled:true,x:1,y:1,width:4,height:4},true);
 const markup=f.controller.render({...f.row,master:false});assert.match(markup,/vtt-fog-cover/);assert.match(markup,/feTurbulence/);assert.match(markup,/vtt-fog-test-room-revealed/);assert.match(markup,/feMorphology/);assert.ok(!markup.includes('class="vtt-fog-hatch"'));f.controller.dispose();
});

test('trocar mapa durante arraste cancela o gesto e não confirma posição na cena nova',()=>{
 const f=fixture();f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);f.dispatch(f.viewport,'pointermove',f.point(7.5,5.5));
 const next=structuredClone(f.row);next.rev=1;next.state.map={id:'replacement',width:1000,height:1000};
 assert.equal(f.controller.syncScene(next),false);assert.equal(f.controller.isInteracting(),false);assert.equal(f.previews.at(-1).phase,'cancel');
 f.dispatch(f.viewport,'pointerup',f.point(7.5,5.5));assert.equal(f.calls.length,0);f.controller.dispose();
});
test('status ao vivo sobrevive à remontagem e saída cancela preview pendente',()=>{
 const f=fixture();f.controller.setConnectionStatus('live');assert.equal(f.get('[data-table-connection]').textContent,'Ao vivo');
 f.controller.dispose();f.controller.render(f.row);f.controller.mount(f.root,f.row);assert.equal(f.get('[data-table-connection]').dataset.state,'live');
 f.dispatch(f.viewport,'pointerdown',f.point(4.5,4.5),f.tokens[0]);f.dispatch(f.viewport,'pointermove',f.point(7.5,5.5));f.controller.dispose();assert.equal(f.previews.at(-1).phase,'cancel');
});

test('botão do meio move a câmera em todas as ferramentas sem executar a ferramenta selecionada',()=>{
 for(const master of [true,false])for(const tool of (master?['select','pan','measure','ping','draw','fog']:['select','pan','measure','ping'])){
  const f=fixture({master});f.click({tableTool:tool});const before=f.world.style.transform,positions=structuredClone(f.row.state.tokens);
  const down=f.dispatch(f.viewport,'pointerdown',{button:1,clientX:200,clientY:180},f.tokens[0]);
  assert.equal(down.defaultPrevented,true);assert.equal(f.viewport.dataset.panning,'true');
  f.dispatch(f.viewport,'pointermove',{button:1,clientX:280,clientY:220});assert.notEqual(f.world.style.transform,before);
  assert.equal(f.viewport.dataset.tool,tool);f.dispatch(f.viewport,'pointerup',{button:1,clientX:280,clientY:220});
  assert.equal(f.viewport.dataset.panning,undefined);assert.equal(f.controller.isInteracting(),false);assert.deepEqual(f.calls,[]);assert.deepEqual(f.previews,[]);assert.deepEqual(f.row.state.tokens,positions);
  for(const type of ['mousedown','auxclick'])assert.equal(f.dispatch(f.viewport,type,{button:1}).defaultPrevented,true);
  f.controller.dispose();
 }
});

test('pincel de névoa é livre por padrão, mostra tamanho real e preserva coordenadas fracionárias',async()=>{
 const f=fixture();f.click({tableTool:'fog'});assert.ok(f.controller.render(f.row).includes('Pincel livre'));
 const size=new Element({fogBrush:''});size.value='120';f.dispatch(f.root,'input',{},size);assert.equal(f.get('[data-fog-brush-size]').textContent,'120 px');
 f.dispatch(f.viewport,'pointermove',f.point(2.25,3.15));assert.match(f.get('.vtt-preview').innerHTML,/r="0.6"/);
 f.dispatch(f.viewport,'pointerdown',f.point(2.25,3.15));f.dispatch(f.viewport,'pointermove',f.point(3.35,4.65));assert.match(f.get('.vtt-preview').innerHTML,/stroke-linecap="round"/);assert.match(f.get('[data-table-help]').textContent,/pincel livre/);
 f.dispatch(f.viewport,'pointerup',f.point(4.75,4.85));await Promise.resolve();
 const stroke=f.calls[0].data;assert.equal(stroke.kind,'brush');assert.equal(stroke.radius,.6);assert.deepEqual(stroke.points[0],{x:2.25,y:3.15});assert.deepEqual(stroke.points.at(-1),{x:4.75,y:4.85});assert.equal(f.calls.length,1);
 const html=f.controller.render(f.row);assert.ok(html.includes('stroke-width="1.2"'));assert.ok(html.includes('stroke="black"'));assert.ok(html.includes('stroke="white"'));
 f.controller.dispose();
});
test('clique de névoa pinta círculo, Escape cancela e botão do meio não pinta',async()=>{
 const f=fixture();f.click({tableTool:'fog'});f.dispatch(f.viewport,'pointerdown',f.point(2.2,2.2));f.dispatch(f.viewport,'pointerup',f.point(2.2,2.2));await Promise.resolve();assert.equal(f.calls[0].data.points.length,1);
 f.dispatch(f.viewport,'pointerdown',f.point(4.1,4.2));f.dispatch(f.viewport,'pointermove',f.point(5.3,5.4));f.dispatch(f.viewport,'keydown',{key:'Escape'});f.dispatch(f.viewport,'pointerup',f.point(5.3,5.4));assert.equal(f.calls.length,1);
 f.dispatch(f.viewport,'pointerdown',{...f.point(4,4),button:1});f.dispatch(f.viewport,'pointermove',{...f.point(6,6),button:1});f.dispatch(f.viewport,'pointerup',{...f.point(6,6),button:1});assert.equal(f.calls.length,1);f.controller.dispose();
});

test('tokens pequenos ajustam iniciais e bordas à grade, mantendo rótulos independentes do zoom',()=>{
 const f=fixture({columns:80,rows:10}),token=f.tokens[0];
 const diameter=parseFloat(f.world.style.width)/80;
 assert.ok(parseFloat(token.style['--token-font-size'])<diameter*.5);assert.ok(parseFloat(token.style['--token-border-width'])<1);
 const font=token.style['--token-font-size'];f.click({tableZoom:'in'});assert.equal(token.style['--token-font-size'],font);assert.ok(Number(f.world.style['--vtt-label-scale'])<1);
 f.viewport.clientWidth=400;f.click({tableZoom:'fit'});assert.ok(parseFloat(token.style['--token-font-size'])<parseFloat(font));
 const next=structuredClone(f.row);next.rev=1;next.state.tokens[0].size=3;assert.equal(f.controller.syncScene(next),true);assert.ok(parseFloat(token.style['--token-font-size'])>parseFloat(font));
 const html=f.controller.render(next);assert.match(html,/<span class="vtt-token-face"><span class="vtt-token-letter">/);assert.match(html,/<\/span><span class="vtt-token-label">/);f.controller.dispose();
});
test('retrato carregado substitui a inicial e falha de imagem restaura a identificação',async()=>{
 const f=fixture(),token=f.tokens[0],image=new Element({tableTokenImage:'portrait-test'});image.hidden=true;image.closest=()=>token;
 const original=f.root.querySelectorAll.bind(f.root),contains=f.root.contains;f.root.querySelectorAll=selector=>selector==='[data-table-token-image]'?[image]:original(selector);f.root.contains=node=>node===image||contains(node);
 token.querySelector=selector=>selector==='[data-table-token-image]'?image:null;
 const next=structuredClone(f.row);next.rev=1;next.state.characters[0].portrait={id:'portrait-test'};
 f.controller.syncScene(next);for(let i=0;i<8&&!image.onload;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(image.hidden,true);assert.equal(token.classList.contains('has-portrait'),false);assert.equal(typeof image.onload,'function');
 image.onload();assert.equal(image.hidden,false);assert.equal(token.classList.contains('has-portrait'),true);
 image.onerror();assert.equal(image.hidden,true);assert.equal(token.classList.contains('has-portrait'),false);f.controller.dispose();
});

test('símbolo escolhido substitui retrato e inicial no mapa e acompanha atualização da mesa',()=>{
 const f=fixture(),next=structuredClone(f.row);next.rev=1;next.state.characters[0].portrait={id:'portrait'};next.state.tokens[0].icon='shield';
 let html=f.controller.render(next),token=html.match(/data-table-token="lyra"[\s\S]*?<\/button>/)[0];assert.ok(token.includes('token-symbol-svg'));assert.ok(!token.includes('data-table-token-image'));
 const glyph=new Element(),image=new Element({tableTokenImage:'portrait'});let removed=false;image.remove=()=>removed=true;
 f.tokens[0].querySelector=selector=>selector==='.vtt-token-letter'?glyph:selector==='[data-table-token-image]'?image:null;
 next.rev=2;next.state.tokens[0].icon='magic';assert.equal(f.controller.syncScene(next),true);assert.ok(glyph.innerHTML.includes('token-symbol-svg'));assert.equal(removed,true);
 next.state.tokens[0].icon='initial';next.rev=3;f.controller.syncScene(next);assert.equal(glyph.textContent,'L');f.controller.dispose();
});

test('mestre alterna visibilidade diretamente na seleção sem depender da névoa',async()=>{
 const f=fixture();f.click({tableSelect:'lyra'});assert.ok(f.get('[data-table-selection]').innerHTML.includes('Ocultar dos jogadores'));
 f.click({tableAction:'tokenVisibility'});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls[0],{name:'tokenUpdate',data:{id:'lyra',hidden:true}});
 f.click({tableSelect:'lyra'});assert.ok(f.get('[data-table-selection]').innerHTML.includes('Mostrar aos jogadores'));f.click({tableAction:'tokenVisibility'});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.row.state.tokens[0].hidden,false);f.controller.dispose();
});
test('atualizações parciais ou antigas não removem tokens e retomada descarta prévias antigas',()=>{
 const f=fixture();f.click({tableZoom:'in'});const camera=f.world.style.transform,next=structuredClone(f.row);next.rev=5;f.controller.syncScene(next);
 const removed=[];for(const node of f.tokens)node.remove=()=>removed.push(node.dataset.tableToken);
 assert.equal(f.controller.syncScene({...next,rev:4,state:{...next.state,tokens:[]}}),true);assert.deepEqual(removed,[]);
 assert.equal(f.controller.syncScene({...next,rev:6,state:{rolls:[]}}),true);assert.deepEqual(removed,[]);
 f.controller.receiveRealtime({type:'tokenPreview',id:'lyra',x:9,y:6,dragId:'old-phone-frame',seq:1,phase:'move',at:1});assert.equal(f.tokens[0].style.left,9/16*100+'%');
 f.controller.resetRealtime();assert.equal(f.tokens[0].style.left,4/16*100+'%');assert.equal(f.world.style.transform,camera);assert.equal(f.tokens[0].classList.contains('is-remote-moving'),false);f.controller.dispose();
});

test('snapshot completo recria token ausente sem duplicar e snapshot atrasado não o esconde novamente',()=>{
 const f=fixture({master:false}),visible=[...f.tokens],original=f.root.querySelectorAll.bind(f.root);
 const attach=node=>{node.remove=()=>{const at=visible.indexOf(node);if(at>=0)visible.splice(at,1);};};visible.forEach(attach);
 f.root.querySelectorAll=selector=>selector==='[data-table-token]'?[...visible]:original(selector);
 f.get('.vtt-token-layer').insertAdjacentHTML=(_where,html)=>{const id=html.match(/data-table-token="([^"]+)"/)[1],node=new Element({tableToken:id});attach(node);visible.push(node);};
 const hidden=structuredClone(f.row);hidden.rev=1;hidden.state.tokens=hidden.state.tokens.filter(t=>t.id!=='lyra');f.controller.syncScene(hidden);assert.equal(visible.length,2);
 const restored=structuredClone(f.row);restored.rev=2;f.controller.syncScene(restored);f.controller.syncScene(restored);assert.equal(visible.length,3);assert.equal(visible.filter(n=>n.dataset.tableToken==='lyra').length,1);
 f.controller.syncScene(hidden);assert.equal(visible.length,3);assert.equal(visible.find(n=>n.dataset.tableToken==='lyra').style.left,4/16*100+'%');f.controller.dispose();
});


test('seleção oferece mensagem privada somente ao mestre para tokens vinculados a jogadores',()=>{
 const f=fixture();f.row.state.characters[0].claimed=true;
 f.click({tableSelect:'lyra'});assert.match(f.get('[data-table-selection]').innerHTML,/data-act="tableTokenMessage" data-id="lyra"/);
 f.click({tableSelect:'dorian'});assert.ok(!f.get('[data-table-selection]').innerHTML.includes('tableTokenMessage'));
 f.row.state.characters[0].hidden=true;f.click({tableSelect:'lyra'});assert.ok(!f.get('[data-table-selection]').innerHTML.includes('tableTokenMessage'));f.controller.dispose();
 const player=fixture({master:false});player.row.state.characters[0].claimed=true;player.click({tableSelect:'lyra'});assert.ok(!player.get('[data-table-selection]').innerHTML.includes('tableTokenMessage'));player.controller.dispose();
});

test('token independente exibe seu retrato e atualização troca a imagem sem remontar o mapa',()=>{
 const f=fixture(),next=structuredClone(f.row);next.rev=1;next.state.tokens[0].characterId='';next.state.tokens[0].portrait={id:'custom'};
 const html=f.controller.render(next);assert.match(html,/data-table-token-image="custom"/);
 const glyph=new Element(),image=new Element({tableTokenImage:'old'});
 f.tokens[0].querySelector=selector=>selector==='.vtt-token-letter'?glyph:selector==='[data-table-token-image]'?image:null;
 assert.equal(f.controller.syncScene(next),true);assert.equal(image.dataset.tableTokenImage,'custom');assert.equal(image.hidden,true);f.controller.dispose();
});

test('Q/E giram a visão e a roda livre ajusta a câmera',async()=>{
 const f=fixture();f.click({tableSelect:'lyra'});const transform=f.world.style.transform;
 for(const [key,angle] of [['e',15],['q',0]]){
  f.dispatch(f.viewport,'keydown',{key},f.tokens[0]);await Promise.resolve();await Promise.resolve();
  assert.equal(f.row.state.tokens[0].rotation,angle);
 }
 f.dispatch(f.viewport,'wheel',{deltaY:-1,clientX:100,clientY:100});
 assert.notEqual(f.world.style.transform,transform);assert.equal(f.row.state.tokens[0].rotation,0);
 assert.doesNotMatch(f.controller.render(f.row),/data-table-facing-handle|data-table-facing /);f.controller.dispose();
});

test('prévia pode ser alternada e luzes não revelam tokens fora do cone',async()=>{
 const f=fixture();f.row.state.table.darkness={enabled:true,mode:'individual',level:35};
 f.row.state.table.lights=[{id:'torch',x:6,y:5,radius:4,color:'#ffaa33'}];
 f.controller.syncScene({...f.row,rev:1});f.click({tableSelect:'lyra'});
 f.click({tableAction:'visionPreview'});await Promise.resolve();
 assert.equal(f.world.classList.contains('is-player-preview'),true);
 assert.equal(f.tokens[1].classList.contains('is-out-of-vision'),true);
 assert.match(f.get('.vtt-darkness-host').innerHTML,/fill-opacity="0.35"/);
 assert.match(f.get('.vtt-darkness-host').innerHTML,/#ffaa33/);
 f.click({tableAction:'visionPreview'});await Promise.resolve();assert.equal(f.tokens[1].classList.contains('is-out-of-vision'),false);
 f.controller.dispose();
});

test('escuridão acompanha posição local e prévia remota, mantendo máscara ativa durante sincronização',async()=>{
 const f=fixture();f.row.state.table.darkness={enabled:true,mode:'individual'};f.row.state.tokens[0].visionSource=true;f.controller.syncScene({...f.row,rev:1});f.click({tableSelect:'lyra'});
 const item=f.row.state.tokens[0];f.dispatch(f.viewport,'pointerdown',f.point(item.x+.5,item.y+.5),f.tokens[0]);f.dispatch(f.viewport,'pointermove',f.point(item.x+1.5,item.y+.5));await Promise.resolve();assert.match(f.get('.vtt-darkness-host').innerHTML,/translate\(5.5 4.5\)/);
 f.dispatch(f.viewport,'keydown',{key:'Escape'});await Promise.resolve();assert.match(f.get('.vtt-darkness-host').innerHTML,/translate\(4.5 4.5\)/);
 f.controller.receiveRealtime({type:'tokenPreview',id:'lyra',dragId:'other-device',seq:1,at:Date.now(),phase:'move',x:7,y:3});await Promise.resolve();assert.match(f.get('.vtt-darkness-host').innerHTML,/translate\(7.5 3.5\)/);f.controller.dispose();
});

test('jogador não gira outro token e lista não revela tokens além do cone individual',async()=>{
 const f=fixture({master:false});f.row.characterId='lyra';f.row.state.table.darkness={enabled:true,mode:'individual'};f.row.state.tokens[0].rotation=0;f.row.state.tokens[0].vision={enabled:true,range:8,angle:80};f.row.state.tokens[1].canMove=false;
 f.click({tableSelect:'dorian'});f.click({tableAction:'rotateRight'});await Promise.resolve();assert.equal(f.calls.length,0);
 const html=f.controller.render(f.row);assert.match(html,/is-out-of-vision/);assert.doesNotMatch(html.match(/<ul class="vtt-token-list">[\s\S]*?<\/ul>/)?.[0]||'',/Dorian/);
 f.controller.mount(f.root,f.row);f.click({tableSelect:'lyra'});f.click({tableAction:'rotateRight'});await Promise.resolve();assert.equal(f.calls.at(-1).name,'tokenRotate');f.controller.dispose();
});

test('giros rápidos acumulam a direção mais recente com no máximo uma requisição em voo',async()=>{
 const f=fixture({holdRotations:true});f.click({tableSelect:'lyra'});
 for(let i=0;i<5;i++)f.click({tableAction:'rotateRight'});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].data.rotation,15);assert.equal(f.controller.isInteracting(),true);
 f.rotationResolvers.shift()();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.calls.length,2);assert.equal(f.calls[1].data.rotation,75);
 f.rotationResolvers.shift()();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.row.state.tokens[0].rotation,75);assert.equal(f.controller.isInteracting(),false);f.controller.dispose();
});

test('pintura de visão é agrupada por quadro e usa o mesmo ângulo na arte e no cone',async()=>{
 const originalRaf=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
 const previousMatch=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});
 const frames=new Map();let serial=0,f;
 globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const frame=()=>{const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn());};
 try{
  f=fixture();f.row.state.table.darkness={enabled:true,mode:'individual'};f.controller.syncScene({...f.row,rev:1});f.click({tableSelect:'lyra'});frame();
  let paints=0;const original=f.tokens[0].style.setProperty;f.tokens[0].style.setProperty=function(key,value){if(key==='--vtt-facing')paints++;original.call(this,key,value);};
  for(let i=0;i<100;i++)f.controller.receiveRealtime({type:'tokenPreview',id:'lyra',x:4,y:4,rotation:i,seq:i+1,dragId:'test-turn',phase:'move'});
  assert.equal(frames.size,1);assert.equal(paints,0);frame();assert.equal(paints,1);
  assert.equal(f.tokens[0].style['--vtt-facing'],'99deg');assert.match(f.get('.vtt-darkness-host').innerHTML,/rotate\(99\)/);
  f.controller.dispose();assert.equal(frames.size,0);
 }finally{globalThis.matchMedia=previousMatch;f?.controller.dispose();globalThis.requestAnimationFrame=originalRaf;globalThis.cancelAnimationFrame=originalCancel;}
});

test('animação cruza o norte pelo caminho curto e conserva imagem e visão alinhadas',async()=>{
 const originalRaf=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame,originalPerformance=globalThis.performance;
 const frames=new Map();let serial=0,now=0,f;
 globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const frame=time=>{now=time;const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn(time));};
 try{
  f=fixture();f.row.state.table.darkness={enabled:true,mode:'individual'};f.controller.syncScene({...f.row,rev:1});f.click({tableSelect:'lyra'});frame(0);
  const next=structuredClone(f.row);next.rev=2;next.state.tokens[0].rotation=350;f.controller.syncScene(next);frame(150);
  assert.equal(f.tokens[0].style['--vtt-facing'],'350deg');
  f.dispatch(f.viewport,'keydown',{key:'e'},f.tokens[0]);await Promise.resolve();await Promise.resolve();f.controller.syncScene({...f.row,rev:3});
  frame(195);const middle=Number.parseFloat(f.tokens[0].style['--vtt-facing']);assert.ok(middle>350||middle<5);assert.notEqual(middle,350);assert.match(f.get('.vtt-darkness-host').innerHTML,new RegExp('rotate\\('+middle+'\\)'));
  frame(300);assert.equal(f.tokens[0].style['--vtt-facing'],'5deg');assert.equal(frames.size,0);
 }finally{f?.controller.dispose();globalThis.requestAnimationFrame=originalRaf;globalThis.cancelAnimationFrame=originalCancel;globalThis.performance=originalPerformance;}
});

test('redução de movimento aplica a orientação final sem animação intermediária',async()=>{
 const originalRaf=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame,originalMatch=globalThis.matchMedia;
 const frames=new Map();let serial=0,f;
 globalThis.matchMedia=()=>({matches:true});globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const frame=()=>{const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn());};
 try{f=fixture();f.click({tableSelect:'lyra'});frame();f.click({tableAction:'rotateRight'});await Promise.resolve();await Promise.resolve();frame();assert.equal(f.tokens[0].style['--vtt-facing'],'15deg');assert.equal(frames.size,0);}
 finally{f?.controller.dispose();globalThis.requestAnimationFrame=originalRaf;globalThis.cancelAnimationFrame=originalCancel;globalThis.matchMedia=originalMatch;}
});

test('barra do mestre libera visão entre jogadores e alterna todos os cones sem alterar a cena',async()=>{
 const f=fixture();f.row.state.table.darkness={enabled:true,mode:'individual'};f.controller.syncScene({...f.row,rev:1});
 const html=f.controller.render(f.row);assert.match(html,/data-table-action="visionShare"/);assert.match(html,/data-table-action="visionCones"/);assert.match(html,/data-vision-all="0"/);f.controller.mount(f.root,f.row);
 f.click({tableAction:'visionShare'});await Promise.resolve();await Promise.resolve();assert.equal(f.calls.at(-1).name,'tableSettings');assert.equal(f.calls.at(-1).data.darkness.mode,'group');assert.equal(f.row.state.table.darkness.enabled,true);
 f.controller.syncScene({...f.row,rev:2});await Promise.resolve();assert.equal(f.get('[data-table-action="visionShare"]')['aria-pressed'],'true');
 f.click({tableAction:'visionCones'});await Promise.resolve();assert.equal(f.get('.vtt-vision-cones-host').innerHTML,'');assert.equal(f.calls.length,1);
 f.click({tableAction:'visionCones'});await Promise.resolve();assert.match(f.get('.vtt-vision-cones-host').innerHTML,/data-vision-all=/);f.controller.dispose();
 const player=fixture({master:false});const playerHtml=player.controller.render(player.row);assert.doesNotMatch(playerHtml,/data-table-action="visionShare"|data-table-action="visionCones"/);assert.doesNotMatch(playerHtml,/data-vision-all=/);player.controller.dispose();
});

test('token de item abre interação por duplo clique ou teclado e efeito de coleta não repete nos snapshots',async()=>{
 const f=fixture();f.row.state.tokens.push({id:'drop',kind:'item',name:'Poção',x:5,y:4,size:1,loot:{version:1,quantity:1,item:{name:'Poção'}},vision:{enabled:false}});const node=new Element({tableToken:'drop'});f.tokens.push(node);
 const html=f.controller.render(f.row);assert.match(html,/is-item/);assert.match(html,/data-act="lootPlace"/);f.controller.mount(f.root,f.row);
 f.dispatch(f.viewport,'dblclick',{},node);assert.deepEqual(f.openedLoot,['drop']);f.dispatch(f.viewport,'keydown',{key:'Enter'},node);assert.deepEqual(f.openedLoot,['drop','drop']);
 f.click({tableSelect:'drop'});assert.match(f.get('[data-table-selection]').innerHTML,/data-act="lootOpen"/);
 const next=structuredClone(f.row);next.rev=1;next.state.tokens=next.state.tokens.filter(t=>t.id!=='drop');next.state.table.lootEvents=[{id:'pickup-once',tokenId:'drop',at:Date.now(),x:5.5,y:4.5,toX:4.5,toY:4.5,public:true}];
 f.controller.syncScene(next);const effect=f.get('.vtt-loot-effects').innerHTML;assert.match(effect,/data-loot-effect="pickup-once"/);f.controller.syncScene({...next,rev:2});assert.equal(f.get('.vtt-loot-effects').innerHTML,effect);
 f.controller.dispose();f.get('.vtt-loot-effects').innerHTML='';f.controller.render(next);f.controller.mount(f.root,next);assert.equal(f.get('.vtt-loot-effects').innerHTML,'');f.controller.dispose();
});

test('rotação remota atualiza cone e retrato antes do commit e cancela sem gravar',async()=>{
 const f=fixture({master:false});f.row.characterId='lyra';f.row.state.table.darkness={enabled:true,mode:'group'};for(const token of f.row.state.tokens)token.visionSource=true;f.controller.syncScene({...f.row,rev:1});await Promise.resolve();
 f.controller.receiveRealtime({type:'tokenPreview',id:'dorian',dragId:'turn',seq:1,phase:'move',x:6,y:5,rotation:123});await Promise.resolve();
 assert.match(f.get('.vtt-darkness-host').innerHTML,/rotate\(123\)/);assert.equal(f.tokens[1].style['--vtt-facing'],'123deg');assert.equal(f.row.state.tokens[1].rotation,0);
 f.controller.receiveRealtime({type:'tokenPreview',id:'dorian',dragId:'turn',seq:2,phase:'cancel'});await Promise.resolve();assert.equal(f.tokens[1].style['--vtt-facing'],'0deg');assert.equal(f.calls.length,0);f.controller.dispose();
});

test('interpolação remota mantém posição do token e origem do cone no mesmo quadro',async()=>{
 const originalRaf=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame,originalPerformance=globalThis.performance;
 const frames=new Map();let serial=0,now=0,f;
 globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const frame=time=>{now=time;const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn(time));};
 try{
  f=fixture();f.row.state.table.darkness={enabled:true,mode:'group'};f.row.state.tokens[0].visionSource=true;f.controller.syncScene({...f.row,rev:1});frame(0);
  f.controller.receiveRealtime({type:'tokenPreview',id:'lyra',dragId:'walk',seq:1,phase:'move',x:6,y:4});frame(30);
  assert.equal(f.tokens[0].style.left,5/16*100+'%');assert.match(f.get('.vtt-darkness-host').innerHTML,/translate\(5.5 4.5\)/);
  frame(60);assert.equal(f.tokens[0].style.left,6/16*100+'%');assert.match(f.get('.vtt-darkness-host').innerHTML,/translate\(6.5 4.5\)/);assert.equal(frames.size,0);
 }finally{f?.controller.dispose();globalThis.performance=originalPerformance;globalThis.requestAnimationFrame=originalRaf;globalThis.cancelAnimationFrame=originalCancel;}
});

test('rotação pelo controle durante movimento usa a mesma prévia com posição atual',async()=>{
 const f=fixture();f.click({tableSelect:'lyra'});const item=f.row.state.tokens[0];
 f.dispatch(f.viewport,'pointerdown',f.point(item.x+.5,item.y+.5),f.tokens[0]);f.dispatch(f.viewport,'pointermove',f.point(item.x+1.5,item.y+.5));
 const walk=f.previews.at(-1),camera=f.world.style.transform;f.dispatch(f.viewport,'wheel',{deltaY:1});assert.equal(f.world.style.transform,camera);
 const turn=f.previews.at(-1);assert.equal(turn.dragId,walk.dragId);assert.equal(turn.x,walk.x);assert.equal(turn.rotation,15);assert.ok(turn.seq>walk.seq);
 await Promise.resolve();await Promise.resolve();
 f.dispatch(f.viewport,'pointermove',f.point(item.x+2.5,item.y+.5));assert.equal(f.previews.at(-1).rotation,15);assert.equal(f.previews.at(-1).dragId,walk.dragId);
 f.dispatch(f.viewport,'pointerup',f.point(item.x+2.5,item.y+.5));await Promise.resolve();await Promise.resolve();assert.equal(f.row.state.tokens[0].rotation,15);assert.equal(f.row.state.tokens[0].x,6);f.controller.dispose();
});

test('mesa destaca o token ativo e oferece encerrar turno apenas à ficha vinculada',()=>{
 const f=fixture({master:false});
 f.row.characterId='lyra';f.row.state.tokens.find(t=>t.id==='lyra').characterId='lyra';
 f.row.state.table.combat={round:2,active:0,entries:[{id:'vez',name:'Lyra',value:15,tokenId:'lyra'}]};
 const html=f.controller.render(f.row);
 assert.match(html,/is-active-turn/);assert.match(html,/data-entry="vez" data-round="2"/);
 f.row.characterId='dorian';
 assert.doesNotMatch(f.controller.render(f.row),/Encerrar meu turno/);
 f.row.state.table.combat.active=-1;
 assert.doesNotMatch(f.controller.render(f.row),/is-active-turn|Encerrar meu turno/);
 f.controller.dispose();
});

test('jogador mede percurso por vários pontos, desfaz e limpa sem alterar a cena',()=>{
 const f=fixture({master:false,distance:'manhattan'});f.click({tableTool:'measure'});
 const select=new Element({measureMode:'1'});select.value='path';f.dispatch(f.root,'change',{},select);
 for(const [x,y] of [[1,1],[4,5],[2,5]]){
   f.dispatch(f.viewport,'pointerdown',f.point(x,y));f.dispatch(f.viewport,'pointerup',f.point(x,y));
 }
 assert.match(f.get('[data-table-help]').textContent,/18 m.*2 trechos/);
 f.click({tableAction:'measureUndo'});
 assert.match(f.get('[data-table-help]').textContent,/14 m.*1 trecho/);
 f.click({tableAction:'measureClear'});
 assert.equal(f.get('.vtt-preview').innerHTML,'');assert.equal(f.calls.length,0);f.controller.dispose();
});
