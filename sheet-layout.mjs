import {sheetFields,characterColorHex} from './model.mjs';
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const clamp=n=>Math.max(.2,Math.min(.8,n));
export const sheetToneDefaults={attributes:'#7dd3fc',resources:'#6ee7b7',skills:'#a5b4fc',abilities:'#fbbf24',dice:'#c4b5fd',story:'#f9a8d4'};
export function sheetResourceStyle(character,field){
 const options=character.appearance?.options,style=options?.resources?.[field.id];
 return {color:style?.color||options?.tones?.resources||sheetToneDefaults.resources,critical:style?.critical??true,criticalAt:style?.criticalAt??25};
}
export function sheetFieldTone(field){
 const group=String(field.group||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 return field.type==='counter'||/recursos|vitalidade/.test(group)?'resources':/identifica|informa/.test(group)?'identity':field.type==='number'?'attributes':field.type==='long'?'story':'identity';
}
export function sheetModuleTone(id,state,character){
 if(id.startsWith('field:')){const field=sheetFields(state,character).find(field=>field.id===id.slice(6));return field?sheetFieldTone(field):'identity';}
 return ({skills:'skills',abilities:'abilities',dice:'dice',rolls:'dice',masteries:'resources',history:'story'})[id]||'identity';
}
export function sheetThemeVariables(options){return {'--sheet-accent':options.accent,'--sheet-bright':options.accent,'--sheet-deep':'color-mix(in srgb,'+options.accent+' 26%,#21152e)','--sheet-glow':options.accent+'33','--tone-identity':options.accent,...Object.fromEntries(Object.entries({...sheetToneDefaults,...options.tones}).map(([key,value])=>['--tone-'+key,value]))};}

export function sheetModules(state,character){
 return [{id:'identity',title:'Personagem',weight:2},{id:'portrait',title:'Retrato',weight:3},...sheetFields(state,character).map(field=>({id:'field:'+field.id,title:field.label,group:field.group,weight:field.type==='long'?3:1.5})),{id:'skills',title:'Perícias',weight:5},{id:'abilities',title:'Habilidades',weight:4},{id:'rolls',title:'Rolagens salvas',weight:3},{id:'dice',title:'Dados livres',weight:4},...((character.masteries||[]).length?[{id:'masteries',title:'Maestria',weight:2}]:[]),{id:'history',title:'Últimas rolagens',weight:3}];
}
export function tileIds(tree){return !tree?[]:tree.tile?[tree.tile]:[...tileIds(tree.first),...tileIds(tree.second)];}
function stack(modules,axis='y'){
 if(!modules.length)return null;if(modules.length===1)return modules[0].tree||{tile:modules[0].id};
 const at=Math.ceil(modules.length/2),first=modules.slice(0,at),second=modules.slice(at),weight=list=>list.reduce((n,m)=>n+m.weight,0);
 return {axis,ratio:clamp(weight(first)/weight(modules)),first:stack(first,axis),second:stack(second,axis)};
}
export function sheetLayoutTemplate(modules,kind='balanced'){
 if(!modules.length)return null;
 if(kind==='stack')return stack(modules);
 if(kind==='focus'){
  const first=modules.filter(m=>['identity','portrait'].includes(m.id)),rest=modules.filter(m=>!['identity','portrait'].includes(m.id));
  return first.length&&rest.length?{axis:'x',ratio:.3,first:stack(first),second:stack(rest)}:stack(modules);
 }
 const left=modules.filter(m=>['portrait','identity'].includes(m.id)||m.id.startsWith('field:')&&m.weight<3),middle=modules.filter(m=>['skills','abilities'].includes(m.id)||m.id.startsWith('field:')&&m.weight>=3),right=modules.filter(m=>!left.includes(m)&&!middle.includes(m));
 const leftRows=left.filter(m=>!m.id.startsWith('field:'));
 const fields=left.filter(m=>m.id.startsWith('field:'));
 for(let i=0;i<fields.length;i+=3){const row=fields.slice(i,i+3);leftRows.push({tree:stack(row,'x'),weight:Math.max(...row.map(m=>m.weight))});}
 const columns=[leftRows,middle,right].filter(list=>list.length).map(list=>stack(list));
 return columns.length===1?columns[0]:{axis:'x',ratio:columns.length===2?.5:.34,first:columns[0],second:columns.length===2?columns[1]:{axis:'x',ratio:.55,first:columns[1],second:columns[2]}};
}
export function defaultSheetAppearance(state,character){
 const modules=sheetModules(state,character);
 return {version:0,tree:sheetLayoutTemplate(modules),hidden:[],tiles:{},options:{layout:'grid',columns:3,tones:{...sheetToneDefaults},resources:{},accent:characterColorHex(character.color),background:'illustration',font:'system',density:'comfortable',portrait:'rounded',gap:12,radius:12,height:Math.min(4000,Math.max(1000,Math.ceil(Math.ceil(modules.reduce((n,m)=>n+m.weight,0)/3)*85/50)*50))}};
}
function prune(tree,valid,seen=new Set()){
 if(!tree)return null;
 if(tree.tile){if(!valid.has(tree.tile)||seen.has(tree.tile))return null;seen.add(tree.tile);return {tile:tree.tile};}
 const first=prune(tree.first,valid,seen),second=prune(tree.second,valid,seen);
 return !first?second:!second?first:{axis:tree.axis,ratio:tree.ratio,first,second};
}
export function sheetAppearance(state,character){
 const defaults=defaultSheetAppearance(state,character),saved=character.appearance;
 if(!saved)return defaults;
 const modules=sheetModules(state,character),ids=new Set(modules.map(m=>m.id)),hidden=(saved.hidden||[]).filter(id=>ids.has(id)),valid=new Set([...ids].filter(id=>!hidden.includes(id)));
 let tree=prune(saved.tree,valid);const present=new Set(tileIds(tree)),missing=modules.filter(m=>valid.has(m.id)&&!present.has(m.id));
 if(missing.length)tree=tree?{axis:'x',ratio:.65,first:tree,second:stack(missing)}:stack(missing);
 const counters=new Set(sheetFields(state,character).filter(field=>field.type==='counter').map(field=>field.id));
 return {...defaults,...saved,tree,hidden,tiles:Object.fromEntries(Object.entries(saved.tiles||{}).filter(([id])=>ids.has(id))),options:{...defaults.options,...saved.options,resources:Object.fromEntries(Object.entries(saved.options?.resources||{}).filter(([id])=>counters.has(id))),tones:{...defaults.options.tones,...saved.options?.tones}}};
}
export function validateSheetAppearance(value,state,character){
 if(!value||typeof value!=='object')fail('Aparência inválida.');
 const modules=sheetModules(state,character),ids=new Set(modules.map(m=>m.id)),seen=new Set();let count=0;
 function node(value,depth=0){
  if(value===null)return null;
  if(!value||typeof value!=='object'||depth>24||++count>255)fail('Mosaico muito complexo. Use até 24 níveis de divisão.');
  if(typeof value.tile==='string'){
   if(!ids.has(value.tile)||seen.has(value.tile))fail('Módulo inválido ou repetido.');seen.add(value.tile);return {tile:value.tile};
  }
  if(!['x','y'].includes(value.axis)||typeof value.ratio!=='number'||!Number.isFinite(value.ratio)||value.ratio<.2||value.ratio>.8)fail('Divisão inválida.');
  const first=node(value.first,depth+1),second=node(value.second,depth+1);if(!first||!second)fail('Uma divisão precisa de dois módulos.');
  return {axis:value.axis,ratio:value.ratio,first,second};
 }
 const tree=node(value.tree),hidden=value.hidden;
 if(!Array.isArray(hidden)||hidden.length>ids.size||new Set(hidden).size!==hidden.length||hidden.some(id=>!ids.has(id)||seen.has(id)))fail('Lista de módulos ocultos inválida.');
 const options=value.options||{},defaults=defaultSheetAppearance(state,character).options;
 const choice=(key,values)=>{const selected=options[key]??defaults[key];if(!values.includes(selected))fail('Opção visual inválida: '+key);return selected;};
 const number=(key,min,max)=>{const number=options[key]??defaults[key];if(!Number.isInteger(number)||number<min||number>max)fail('Medida inválida: '+key);return number;};
 const accent=options.accent??defaults.accent;if(typeof accent!=='string'||!/^#[\da-f]{6}$/i.test(accent))fail('Cor inválida.');
 const tones=Object.fromEntries(Object.keys(sheetToneDefaults).map(key=>{const color=options.tones?.[key]??sheetToneDefaults[key];if(typeof color!=='string'||!/^#[\da-f]{6}$/i.test(color))fail('Cor de seção inválida.');return [key,color];}));
 const counters=new Set(sheetFields(state,character).filter(field=>field.type==='counter').map(field=>field.id));
 if(options.resources!==undefined&&(!options.resources||typeof options.resources!=='object'||Array.isArray(options.resources)))fail('Estilo de recursos inválido.');
 const resources=Object.fromEntries(Object.entries(options.resources||{}).map(([id,style])=>{
  if(!counters.has(id)||!style||typeof style!=='object'||Array.isArray(style)||typeof style.color!=='string'||!/^#[\da-f]{6}$/i.test(style.color)||typeof style.critical!=='boolean'||!Number.isInteger(style.criticalAt)||style.criticalAt<0||style.criticalAt>100)fail('Cor ou limite crítico de recurso inválido.');
  return [id,{color:style.color.toLowerCase(),critical:style.critical,criticalAt:style.criticalAt}];
 }));
 const entries=Object.entries(value.tiles||{});if(entries.length>ids.size)fail('Muitos módulos.');
 const tiles=Object.fromEntries(entries.map(([id,style])=>{
  if(!ids.has(id)||!style||typeof style!=='object')fail('Estilo de módulo inválido.');
  if(style.title!==undefined&&(typeof style.title!=='string'||style.title.length>80))fail('Título de módulo inválido.');
  if(style.span!==undefined&&![1,2,3].includes(style.span))fail('Largura de bloco inválida.');
  if(style.accent!==undefined&&style.accent!==''&&(typeof style.accent!=='string'||!/^#[\da-f]{6}$/i.test(style.accent)))fail('Cor de bloco inválida.');
  return [id,{...(style.accent?{accent:style.accent}:{}),title:(style.title||'').trim(),collapsed:style.collapsed===true,...(style.span?{span:style.span}:{})}];
 }));
 const appearance={tree,hidden:[...hidden],tiles,options:{tones,resources,layout:choice('layout',['grid','tiling']),columns:number('columns',1,3),accent,background:choice('background',['illustration','plain','parchment','midnight']),font:choice('font',['system','serif','mono']),density:choice('density',['comfortable','compact']),portrait:choice('portrait',['rounded','circle','square']),gap:number('gap',4,24),radius:number('radius',0,24),height:number('height',600,4000)}};
 // New fields not included by an older editor are always retained as visible modules.
 return sheetAppearance(state,{...character,appearance});
}
export function removeTile(tree,id){
 if(!tree)return null;if(tree.tile)return tree.tile===id?null:structuredClone(tree);
 const first=removeTile(tree.first,id),second=removeTile(tree.second,id);
 return !first?second:!second?first:{...tree,first,second};
}
export function moveTile(tree,source,target,edge='center'){
 if(source===target||!tileIds(tree).includes(source)||!tileIds(tree).includes(target))return structuredClone(tree);
 if(!['left','right','top','bottom','center'].includes(edge))fail('Destino inválido.');
 function swap(node){if(node.tile)return {tile:node.tile===source?target:node.tile===target?source:node.tile};return {...node,first:swap(node.first),second:swap(node.second)};}
 if(edge==='center')return swap(tree);
 const result=removeTile(tree,source),before=['left','top'].includes(edge);
 function insert(node){if(node.tile)return node.tile!==target?node:{axis:['left','right'].includes(edge)?'x':'y',ratio:.5,first:{tile:before?source:target},second:{tile:before?target:source}};return {...node,first:insert(node.first),second:insert(node.second)};}
 return insert(result);
}
export function splitAt(tree,path){let node=tree;for(const side of path){if(!['0','1'].includes(side)||node?.tile)return null;node=side==='0'?node?.first:node?.second;}return node;}
export function changeSplit(tree,path,change){
 const next=structuredClone(tree),node=splitAt(next,path);if(!node||node.tile)return next;
 if(change.axis)node.axis=change.axis;if(change.ratio!==undefined)node.ratio=clamp(change.ratio);return next;
}

export function reorderTile(tree,source,target,placement='before'){
 const ids=tileIds(tree);if(source===target||!ids.includes(source)||!ids.includes(target))return structuredClone(tree);
 if(!['before','after'].includes(placement))fail('Posição inválida.');
 ids.splice(ids.indexOf(source),1);ids.splice(ids.indexOf(target)+(placement==='after'?1:0),0,source);
 return sheetLayoutTemplate(ids.map(id=>({id,weight:1})),'stack');
}
