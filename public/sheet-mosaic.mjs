import {createSheetPacking} from './sheet-packing.mjs';
import {sheetModules,sheetAppearance,validateSheetAppearance,tileIds,moveTile,reorderTile,removeTile,changeSplit,splitAt,sheetLayoutTemplate,sheetModuleTone,sheetFieldTone,sheetThemeVariables,sheetToneDefaults} from '../sheet-layout.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const directions={left:'à esquerda',right:'à direita',top:'acima',bottom:'abaixo',center:'trocar posições',before:'antes',after:'depois'};
export {sheetFieldTone};
export function sheetThemeStyle(state,character){return Object.entries(sheetThemeVariables(sheetAppearance(state,character).options)).map(([key,value])=>key+':'+value).join(';');}
const toneNames={attributes:'Atributos',resources:'Recursos',skills:'Perícias',abilities:'Habilidades',dice:'Dados e rolagens',story:'História e notas'};
export function dropEdge(rect,x,y){const px=(x-rect.left)/rect.width,py=(y-rect.top)/rect.height;const distances=[['left',px],['right',1-px],['top',py],['bottom',1-py]].sort((a,b)=>a[1]-b[1]);return distances[0][1]<.27?distances[0][0]:'center';}
export function renderSheetMosaic(state,character,appearance,{editing=false,renderModule}={}){
 const catalog=new Map(sheetModules(state,character).map(module=>[module.id,module])),grid=appearance.options.layout!=='tiling',ids=tileIds(appearance.tree);
 function leaf(id){const module=catalog.get(id);if(!module)return '';const style=appearance.tiles[id]||{},title=style.title||module.title,tone=sheetModuleTone(id,state,character),accent=style.accent||'var(--tone-'+tone+')',span=style.span||(['identity','skills'].includes(id)||module.weight===3&&id.startsWith('field:')?2:1);
  const step=(direction,label,symbol)=>'<button type="button" class="sheet-tile-button" data-sheet-step="'+esc(id)+'" data-direction="'+direction+'" aria-label="'+label+' '+esc(title)+'" '+(ids.indexOf(id)+(direction)<0||ids.indexOf(id)+direction>=ids.length?'disabled':'')+'>'+symbol+'</button>';
  return '<section class="sheet-node-leaf" data-sheet-leaf="'+esc(id)+'" data-span="'+span+'" data-sheet-tone="'+tone+'" aria-label="'+esc(title)+'" '+'style="--section-accent:'+accent+';'+(grid?'grid-column:span '+Math.min(span,appearance.options.columns||3):'')+'"'+'><header class="sheet-tile-header">'+(editing?'<button type="button" class="sheet-drag-handle" data-sheet-drag="'+esc(id)+'" aria-label="Mover '+esc(title)+'" title="Arraste para mudar a ordem">⠿</button>':'')+'<h2>'+esc(title)+'</h2>'+(editing?step(-1,'Mover para antes','↑')+step(1,'Mover para depois','↓')+'<button type="button" class="sheet-tile-button" data-sheet-config="'+esc(id)+'" aria-label="Opções de '+esc(title)+'" aria-expanded="false">⋯</button>':'<button type="button" class="sheet-tile-button" data-sheet-fold="'+esc(id)+'" aria-expanded="'+!style.collapsed+'" aria-label="Recolher ou expandir '+esc(title)+'">'+(style.collapsed?'＋':'−')+'</button>')+'</header>'+(editing?'<div class="sheet-block-options" data-sheet-block-options hidden><label>Título<input data-mosaic-title="'+esc(id)+'" value="'+esc(style.title||'')+'" maxlength="80" placeholder="'+esc(module.title)+'"></label>'+(grid?'<label>Largura<select data-mosaic-span="'+esc(id)+'">'+[[1,'Normal'],[2,'Largo'],[3,'Linha inteira']].map(([n,text])=>'<option value="'+n+'" '+(span===n?'selected':'')+'>'+text+'</option>').join('')+'</select></label>':'')+'<label>Cor do bloco<input type="color" data-mosaic-block-accent="'+esc(id)+'" value="'+esc(style.accent||appearance.options.tones?.[tone]||appearance.options.accent)+'"></label><button type="button" class="btn small" data-mosaic-block-inherit="'+esc(id)+'">Usar cor da seção</button><div class="actions"><button type="button" class="btn small" data-sheet-fold="'+esc(id)+'">'+(style.collapsed?'Expandir':'Recolher')+'</button><button type="button" class="btn small" data-sheet-hide="'+esc(id)+'">Ocultar bloco</button></div></div>':'')+'<div class="sheet-tile-content" '+(style.collapsed?'hidden':'')+'>'+renderModule(id)+'</div></section>';
 }
 function node(tree,path=''){
  if(!tree)return '<p class="mosaic-empty">Nenhum bloco visível. Abra “Mostrar ou ocultar blocos” no editor para reativar.</p>';
  if(tree.tile)return leaf(tree.tile);
  return '<div class="sheet-node-split axis-'+tree.axis+'" data-sheet-split="'+path+'" style="--split-a:'+tree.ratio+'fr;--split-b:'+(1-tree.ratio)+'fr">'+node(tree.first,path+'0')+'<div class="sheet-split-bar" '+(editing?'role="separator" tabindex="0" aria-label="Redimensionar divisão" aria-orientation="'+(tree.axis==='x'?'vertical':'horizontal')+'" aria-valuemin="20" aria-valuemax="80" aria-valuenow="'+Math.round(tree.ratio*100)+'" data-sheet-resize="'+path+'"':'aria-hidden="true"')+'>'+(editing?'<button type="button" data-sheet-axis="'+path+'" aria-label="Alternar divisão horizontal ou vertical" title="Alternar direção da divisão">⇄</button>':'')+'</div>'+node(tree.second,path+'1')+'</div>';
 }
 const o=appearance.options;
 return '<div class="sheet-mosaic '+(grid?'layout-grid ':'layout-tiling ')+(editing?'is-arranging':'')+'" data-sheet-mosaic data-columns="'+(o.columns||3)+'" data-font="'+o.font+'" data-density="'+o.density+'" data-background="'+o.background+'" data-portrait-shape="'+o.portrait+'" style="'+Object.entries(sheetThemeVariables(o)).map(([key,value])=>key+':'+value).join(';')+';--mosaic-gap:'+o.gap+'px;--mosaic-radius:'+o.radius+'px;--mosaic-height:'+o.height+'px;--mosaic-columns:'+(o.columns||3)+'"><div class="'+(grid?'sheet-mosaic-grid':'sheet-mosaic-canvas')+'">'+(grid?(ids.length?ids.map(leaf).join(''):node(null)):node(appearance.tree))+'</div></div>'+(editing?'<div class="mosaic-mobile-actions"><button type="button" class="btn small" data-act="sheetLayoutUndo" >Desfazer</button><button type="button" class="btn small" data-act="sheetLayoutDiscard">Cancelar</button><button type="button" class="btn primary small" data-act="sheetLayoutSave">Salvar aparência</button></div>':'');
}
export function renderSheetLayoutEditor(state,character,appearance,canUndo){
 const catalog=sheetModules(state,character),o=appearance.options,selected=tileIds(appearance.tree),grid=o.layout!=='tiling';
 const select=(key,label,values)=>'<label>'+label+'<select data-mosaic-option="'+key+'">'+Object.entries(values).map(([id,text])=>'<option value="'+id+'" '+(String(o[key])===id?'selected':'')+'>'+text+'</option>').join('')+'</select></label>';
 const input=(key,label,type,min,max,step)=>'<label>'+label+'<input type="'+type+'" data-mosaic-option="'+key+'" value="'+o[key]+'" '+(min!==undefined?'min="'+min+'" max="'+max+'" step="'+step+'"':'')+'></label>';
 const choices=selected.map(id=>'<option value="'+esc(id)+'">'+esc(appearance.tiles[id]?.title||catalog.find(m=>m.id===id)?.title)+'</option>').join('');
 return '<div class="mosaic-edit-heading"><div><strong>Organizando sua ficha</strong><p>'+(grid?'Arraste pela alça para qualquer espaço da ficha. Os blocos abrem espaço em tempo real. Use ↑ ↓ para mover e ⋯ para ajustar.':'Modo avançado: solte nas bordas para dividir ou no centro para trocar. Arraste as divisórias para redimensionar.')+'</p></div><div class="actions"><button type="button" class="btn small" data-act="sheetLayoutUndo" '+(canUndo?'':'disabled')+'>Desfazer</button><button type="button" class="btn small" data-act="sheetLayoutDiscard">Cancelar</button><button type="button" class="btn primary small" data-act="sheetLayoutSave">Salvar aparência</button></div></div><section class="sheet-layout-editor" data-sheet-layout-editor><div class="mosaic-quick-setup">'+select('layout','Organização',{grid:'Simples · ajuste automático',tiling:'Mosaico avançado · divisórias'})+(grid?select('columns','Colunas no computador',{'3':'3 colunas','2':'2 colunas','1':'1 coluna'}):'')+'</div><p class="mosaic-status" data-sheet-layout-status role="status" aria-live="polite">As alterações só serão aplicadas ao salvar.</p><div class="mosaic-editor-sections"><details data-mosaic-section="appearance"><summary>Cores e estilo</summary><div class="sheet-accent-swatches">'+['#c4b5fd','#7dd3fc','#6ee7b7','#fbbf24','#f9a8d4','#fda4af','#fdba74','#a5b4fc'].map(color=>'<button type="button" data-mosaic-accent="'+color+'" style="background:'+color+'" aria-label="Usar destaque '+color+'" title="'+color+'"></button>').join('')+'</div><div class="mosaic-options">'+input('accent','Cor de destaque','color')+select('background','Fundo',{illustration:'Ilustração da Forja',plain:'Liso',parchment:'Pergaminho',midnight:'Meia-noite'})+select('font','Tipografia',{system:'Padrão',serif:'Serifada',mono:'Monoespaçada'})+select('portrait','Retrato',{rounded:'Arredondado',circle:'Circular',square:'Quadrado'})+'</div><details class="mosaic-fine-tuning"><summary>Cores por seção · nas duas visualizações</summary><div class="mosaic-options">'+Object.entries(toneNames).map(([key,name])=>'<label>'+name+'<input type="color" data-mosaic-tone="'+key+'" value="'+(o.tones?.[key]||sheetToneDefaults[key])+'"></label>').join('')+'</div></details><details class="mosaic-fine-tuning"><summary>Mais ajustes</summary><div class="mosaic-options">'+select('density','Densidade',{comfortable:'Confortável',compact:'Compacta'})+input('gap','Espaço entre blocos','number',4,24,1)+input('radius','Cantos','number',0,24,1)+(!grid?input('height','Altura do mosaico','number',600,4000,50):'')+'</div></details></details><details data-mosaic-section="modules"><summary>Mostrar ou ocultar blocos · '+selected.length+' de '+catalog.length+'</summary><label class="mosaic-library-search">Buscar bloco<input type="search" data-mosaic-module-search placeholder="Nome do campo ou bloco"></label><div class="mosaic-module-library">'+catalog.map(module=>'<label class="check" data-mosaic-library-item="'+esc(module.title.toLocaleLowerCase('pt-BR'))+'"><input type="checkbox" data-mosaic-visible="'+esc(module.id)+'" '+(selected.includes(module.id)?'checked':'')+'>'+esc(module.title)+'</label>').join('')+'</div><p class="muted">Ocultar não apaga informações. A visão padronizada continua mostrando todos os campos.</p></details>'+(!grid?'<details data-mosaic-section="move"><summary>Mover sem arrastar e modelos</summary><form data-sheet-move-form><label>Mover bloco<select name="source">'+choices+'</select></label><label>Posição<select name="edge">'+Object.entries(directions).filter(([id])=>!['before','after'].includes(id)).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label><label>Em relação a<select name="target">'+choices+'</select></label><button type="submit" class="btn small">Mover bloco</button></form><div class="actions"><button type="button" class="btn small" data-mosaic-template="balanced">Três colunas</button><button type="button" class="btn small" data-mosaic-template="focus">Retrato lateral</button><button type="button" class="btn small" data-mosaic-template="stack">Coluna única</button></div></details>':'')+'</div></section>';
}
export function createSheetMosaic({render,report,document:doc=globalThis.document,packingFactory=createSheetPacking}){
 let context='',state,character,draft=null,expectedVersion=0,history=[],root,events,gesture,openSections=new Set(),libraryScroll=0,configuredTile='',moduleQuery='',packer,ghost,dragFrame;
 function sync(nextState,nextCharacter,key){if(context!==key){draft=null;history=[];openSections=new Set();libraryScroll=0;configuredTile='';moduleQuery='';context=key;}state=nextState;character=nextCharacter;if(draft)draft=sheetAppearance(state,{...character,appearance:draft});}
 function update(change,rerender=true){if(!draft)return;try{const next=structuredClone(draft);change(next);const validated=validateSheetAppearance(next,state,character);history.push(structuredClone(draft));history=history.slice(-30);draft=validated;if(rerender)render();else{patchAppearance();changeStatus('Alterações no rascunho · salve quando terminar.');}}catch(error){report(error.message);}}
 function patchAppearance(){
  const canvas=root?.querySelector('[data-sheet-mosaic]');if(!canvas||!draft)return;const o=draft.options;
  Object.assign(canvas.dataset,{font:o.font,density:o.density,background:o.background,portraitShape:o.portrait,columns:String(o.columns)});
  for(const [key,value] of Object.entries({...sheetThemeVariables(o),'--mosaic-gap':o.gap+'px','--mosaic-radius':o.radius+'px','--mosaic-height':o.height+'px','--mosaic-columns':String(o.columns)}))canvas.style.setProperty(key,value);
  const catalog=new Map(sheetModules(state,character).map(module=>[module.id,module]));
  for(const leaf of root.querySelectorAll('[data-sheet-leaf]')){
   const id=leaf.dataset.sheetLeaf,style=draft.tiles[id]||{},module=catalog.get(id);if(!module)continue;
   const title=style.title||module.title,span=style.span||(['identity','skills'].includes(id)||module.weight===3&&id.startsWith('field:')?2:1);
   leaf.style.setProperty('--section-accent',style.accent||'var(--tone-'+sheetModuleTone(id,state,character)+')');leaf.querySelector('h2').textContent=title;leaf.setAttribute('aria-label',title);leaf.dataset.span=String(span);
   if(o.layout==='grid')leaf.style.gridColumn='span '+Math.min(span,o.columns);
  }
  const picker=root.querySelector('[data-mosaic-option="accent"]');if(picker&&doc.activeElement!==picker)picker.value=o.accent;
  for(const undo of root.querySelectorAll('[data-act="sheetLayoutUndo"]'))undo.disabled=!history.length;
  packer?.refresh();
 }
 function filterLibrary(){const normalize=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR'),query=normalize(moduleQuery);for(const item of root.querySelectorAll('[data-mosaic-library-item]'))item.hidden=!normalize(item.dataset.mosaicLibraryItem).includes(query);}
 function rememberUI(){
  if(!root||!draft)return;
  const sections=[...root.querySelectorAll('[data-mosaic-section]')];
  if(sections.length)openSections=new Set(sections.filter(section=>section.open).map(section=>section.dataset.mosaicSection));
  const library=root.querySelector('.mosaic-module-library');if(library)libraryScroll=library.scrollTop||0;
  const search=root.querySelector('[data-mosaic-module-search]');if(typeof search?.value==='string')moduleQuery=search.value;
 }
 function cleanup(){if(!root)return;for(const target of root.querySelectorAll('[data-drop-edge]'))delete target.dataset.dropEdge;for(const target of root.querySelectorAll('.is-dragging'))target.classList.remove('is-dragging');}
 function cancel(){stopDragFrame();if(gesture?.live)packer?.cancel();removeGhost();if(gesture?.kind==='resize'){gesture.element.style.setProperty('--split-a',gesture.before.ratio+'fr');gesture.element.style.setProperty('--split-b',(1-gesture.before.ratio)+'fr');}cleanup();gesture=null;}
 function changeStatus(message){const target=root.querySelector('[data-sheet-layout-status]');if(target)target.textContent=message;}
 function pointerDown(event){
  if(!draft||event.button!==0||gesture)return;
  const handle=event.target.closest('[data-sheet-drag]'),bar=event.target.closest('[data-sheet-resize]');
  if(event.target.closest('[data-sheet-axis]'))return;
  if(handle){event.preventDefault();handle.setPointerCapture(event.pointerId);gesture={kind:'move',pointer:event.pointerId,id:handle.dataset.sheetDrag,x:event.clientX,y:event.clientY,handle};}
  else if(bar){event.preventDefault();bar.setPointerCapture(event.pointerId);const path=bar.dataset.sheetResize,element=bar.closest('[data-sheet-split]'),before=splitAt(draft.tree,path);gesture={kind:'resize',pointer:event.pointerId,path,element,before,ratio:before.ratio,rect:element.getBoundingClientRect()};}
 }
 function stopDragFrame(){if(dragFrame!==undefined)globalThis.cancelAnimationFrame?.(dragFrame);dragFrame=undefined;}
 function removeGhost(){ghost?.remove();ghost=null;}
 function livePreview(autoScroll=true){
  dragFrame=undefined;const g=gesture;if(!g?.live)return;
  if(ghost){ghost.style.left=Math.min(g.lastX+14,(globalThis.innerWidth||1200)-210)+'px';ghost.style.top=(g.lastY+14)+'px';}
  g.previewOrder=packer.preview(g.id,g.lastX,g.lastY);g.valid=Boolean(g.previewOrder);
  if(g.valid)changeStatus('Prévia de encaixe · solte para confirmar. Escape cancela.');
  if(autoScroll){const win=doc.defaultView||globalThis.window,height=win?.innerHeight||globalThis.innerHeight||900,step=g.lastY<60?-14:g.lastY>height-60?14:0;
   if(step&&win?.scrollBy&&globalThis.requestAnimationFrame){const before=win.scrollY;win.scrollBy({top:step,left:0,behavior:'instant'});if(win.scrollY!==before)dragFrame=globalThis.requestAnimationFrame(()=>livePreview());}}
 }
 function pointerMove(event){
  if(!gesture||gesture.pointer!==event.pointerId)return;
  if(gesture.kind==='resize'){const g=gesture,value=g.before.axis==='x'?(event.clientX-g.rect.left)/g.rect.width:(event.clientY-g.rect.top)/g.rect.height;g.ratio=Math.max(.2,Math.min(.8,value));g.element.style.setProperty('--split-a',g.ratio+'fr');g.element.style.setProperty('--split-b',(1-g.ratio)+'fr');return;}
  if(!gesture.live&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<6)return;
  if(packer&&draft.options.layout==='grid'){
   if(!gesture.live){gesture.live=true;packer.begin();gesture.handle.closest('[data-sheet-leaf]').classList.add('is-dragging');
    if(doc.createElement&&doc.body?.appendChild){ghost=doc.createElement('div');ghost.className='sheet-drag-ghost';ghost.setAttribute('aria-hidden','true');ghost.textContent=draft.tiles[gesture.id]?.title||sheetModules(state,character).find(m=>m.id===gesture.id)?.title||'Bloco';doc.body.appendChild(ghost);}}
   gesture.lastX=event.clientX;gesture.lastY=event.clientY;
   if(dragFrame===undefined){if(globalThis.requestAnimationFrame)dragFrame=globalThis.requestAnimationFrame(()=>livePreview());else livePreview();}return;
  }
  cleanup();gesture.handle.closest('[data-sheet-leaf]').classList.add('is-dragging');
  const target=doc.elementFromPoint(event.clientX,event.clientY)?.closest('[data-sheet-leaf]');
  gesture.target=null;
  if(!target||!root.contains(target)||target.dataset.sheetLeaf===gesture.id)return;
  const rect=target.getBoundingClientRect(),edge=draft.options.layout==='tiling'?dropEdge(rect,event.clientX,event.clientY):event.clientY<rect.top+rect.height/2?'before':'after';target.dataset.dropEdge=edge;gesture.target=target.dataset.sheetLeaf;gesture.edge=edge;
  changeStatus('Soltar: '+directions[edge]+' · '+(draft.tiles[gesture.target]?.title||sheetModules(state,character).find(m=>m.id===gesture.target)?.title));
 }
 function pointerUp(event){
  if(!gesture||gesture.pointer!==event.pointerId)return;
  if(gesture.live){if(Number.isFinite(event.clientX)){gesture.lastX=event.clientX;gesture.lastY=event.clientY;}stopDragFrame();livePreview(false);const g=gesture,order=g.valid?packer.finish():null;if(!order)packer.cancel();cleanup();removeGhost();gesture=null;
   if(order&&order.join('\0')!==tileIds(draft.tree).join('\0'))update(next=>{next.tree=sheetLayoutTemplate(order.map(id=>({id,weight:1})),'stack');});return;
  }
  const g=gesture;cleanup();gesture=null;if(g.kind==='resize')update(next=>{next.tree=changeSplit(next.tree,g.path,{ratio:g.ratio});});else if(g.target)update(next=>{next.tree=['before','after'].includes(g.edge)?reorderTile(next.tree,g.id,g.target,g.edge):moveTile(next.tree,g.id,g.target,g.edge);});
 }

 function restoreBlockOptions(){
  if(!root)return;for(const leaf of root.querySelectorAll('[data-sheet-leaf]')){
   const panel=leaf.querySelector('[data-sheet-block-options]'),button=leaf.querySelector('[data-sheet-config]');
   if(panel)panel.hidden=leaf.dataset.sheetLeaf!==configuredTile;if(button)button.setAttribute('aria-expanded',String(leaf.dataset.sheetLeaf===configuredTile));
  }
 }
 function mount(nextRoot){events?.abort();cancel();packer?.dispose();packer=null;root=nextRoot;if(!root)return;for(const section of root.querySelectorAll('[data-mosaic-section]'))section.open=openSections.has(section.dataset.mosaicSection);const library=root.querySelector('.mosaic-module-library');if(library)library.scrollTop=libraryScroll;const search=root.querySelector('[data-mosaic-module-search]');if(search)search.value=moduleQuery;filterLibrary();restoreBlockOptions();if(root.querySelector('[data-sheet-mosaic]')?.classList?.contains?.('layout-grid'))packer=packingFactory(root.querySelector('.sheet-mosaic-grid'),{settings:()=>draft?.options||sheetAppearance(state,character).options});for(const undo of root.querySelectorAll('[data-act="sheetLayoutUndo"]'))undo.disabled=!history.length;events=new AbortController();const options={signal:events.signal};
  root.addEventListener('pointerdown',pointerDown,options);root.addEventListener('pointermove',pointerMove,options);root.addEventListener('pointerup',pointerUp,options);root.addEventListener('pointercancel',cancel,options);
  root.addEventListener('click',event=>{
   const swatch=event.target.closest('[data-mosaic-accent]');if(swatch&&draft)update(next=>{next.options.accent=swatch.dataset.mosaicAccent;},false);
   const inherit=event.target.closest('[data-mosaic-block-inherit]');if(inherit&&draft)update(next=>{const id=inherit.dataset.mosaicBlockInherit;if(next.tiles[id])delete next.tiles[id].accent;},false);
   const config=event.target.closest('[data-sheet-config]');if(config&&draft){configuredTile=configuredTile===config.dataset.sheetConfig?'':config.dataset.sheetConfig;restoreBlockOptions();packer?.refresh();}
   const step=event.target.closest('[data-sheet-step]');if(step&&draft){const ids=tileIds(draft.tree),id=step.dataset.sheetStep,direction=Number(step.dataset.direction),target=ids[ids.indexOf(id)+direction];if(target)update(next=>{next.tree=reorderTile(next.tree,id,target,direction<0?'before':'after');});}

   const fold=event.target.closest('[data-sheet-fold]');if(fold){const id=fold.dataset.sheetFold;if(draft)update(next=>{next.tiles[id]={...next.tiles[id],collapsed:!next.tiles[id]?.collapsed};});else{const body=fold.closest('[data-sheet-leaf]').querySelector('.sheet-tile-content');body.hidden=!body.hidden;fold.setAttribute('aria-expanded',String(!body.hidden));fold.textContent=body.hidden?'＋':'−';packer?.refresh();}}
   const hide=event.target.closest('[data-sheet-hide]');if(hide&&draft)update(next=>{const id=hide.dataset.sheetHide;next.tree=removeTile(next.tree,id);next.hidden.push(id);});
   const axis=event.target.closest('[data-sheet-axis]');if(axis&&draft)update(next=>{const path=axis.dataset.sheetAxis;next.tree=changeSplit(next.tree,path,{axis:splitAt(next.tree,path).axis==='x'?'y':'x'});});
   const template=event.target.closest('[data-mosaic-template]');if(template&&draft)update(next=>{const visible=new Set(tileIds(next.tree));next.tree=sheetLayoutTemplate(sheetModules(state,character).filter(m=>visible.has(m.id)),template.dataset.mosaicTemplate);});
  },options);
  root.addEventListener('input',event=>{
   if(event.target.matches('[data-mosaic-module-search]')){
    moduleQuery=event.target.value;filterLibrary();
   }
  },options);
  root.addEventListener('change',event=>{
   if(!draft)return;const node=event.target;
   if(node.matches('[data-mosaic-option]'))update(next=>{next.options[node.dataset.mosaicOption]=['gap','radius','height','columns'].includes(node.dataset.mosaicOption)?Number(node.value):node.value;},node.dataset.mosaicOption==='layout');
   if(node.matches('[data-mosaic-tone]'))update(next=>{next.options.tones={...next.options.tones,[node.dataset.mosaicTone]:node.value};},false);
   if(node.matches('[data-mosaic-block-accent]'))update(next=>{const id=node.dataset.mosaicBlockAccent;next.tiles[id]={...next.tiles[id],accent:node.value};},false);
   if(node.matches('[data-mosaic-span]'))update(next=>{next.tiles[node.dataset.mosaicSpan]={...next.tiles[node.dataset.mosaicSpan],span:Number(node.value)};},false);
   if(node.matches('[data-mosaic-title]'))update(next=>{next.tiles[node.dataset.mosaicTitle]={...next.tiles[node.dataset.mosaicTitle],title:node.value};},false);
   if(node.matches('[data-mosaic-visible]'))update(next=>{const id=node.dataset.mosaicVisible;if(node.checked){next.hidden=next.hidden.filter(hidden=>hidden!==id);if(!tileIds(next.tree).includes(id))next.tree=next.tree?{axis:'y',ratio:.7,first:next.tree,second:{tile:id}}:{tile:id};}else{next.tree=removeTile(next.tree,id);next.hidden=[...new Set([...next.hidden,id])];}});
  },options);
  root.addEventListener('submit',event=>{if(!draft||!event.target.matches('[data-sheet-move-form]'))return;event.preventDefault();const form=event.target;if(form.elements.source.value===form.elements.target.value){changeStatus('Escolha módulos diferentes para mover.');return;}update(next=>{next.tree=moveTile(next.tree,form.elements.source.value,form.elements.target.value,form.elements.edge.value);});},options);
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&gesture){event.preventDefault();cancel();return;}const bar=event.target.closest('[data-sheet-resize]');if(!bar||!draft)return;const path=bar.dataset.sheetResize,node=splitAt(draft.tree,path),delta={ArrowLeft:-.05,ArrowUp:-.05,ArrowRight:.05,ArrowDown:.05}[event.key];if(delta||['Home','End'].includes(event.key)){event.preventDefault();update(next=>{next.tree=changeSplit(next.tree,path,{ratio:event.key==='Home'?.2:event.key==='End'?.8:node.ratio+delta});});root.querySelector('[data-sheet-resize="'+path+'"]').focus();}},options);
 }
 return {sync,mount,begin(){draft=sheetAppearance(state,character);expectedVersion=character.appearance?.version||0;history=[];render();},undo(){if(history.length){draft=sheetAppearance(state,{...character,appearance:history.pop()});render();}},discard(){draft=null;history=[];render();},payload(){return {id:character.id,expectedVersion,appearance:structuredClone(draft)};},finish(){draft=null;history=[];},get editing(){return Boolean(draft);},get appearance(){return draft||sheetAppearance(state,character);},get canUndo(){return history.length>0;},isInteracting:()=>Boolean(gesture),dispose(){rememberUI();events?.abort();cancel();packer?.dispose();packer=null;root=null;}};
}
