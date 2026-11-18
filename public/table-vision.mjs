import {characterColorHex} from '../model.mjs';
import {recordExploration,exploredRowsPath,explorationRows,visionSector,sectorPath,visionSources,tokenInVision,normalizeRotation} from '../vision-model.mjs';
export {visionSources,tokenInVision,normalizeRotation};
const localPath=source=>sectorPath({...source,x:0,y:0,rotation:0});
const placement=source=>'translate('+source.x+' '+source.y+')';
const turn=source=>'rotate('+source.rotation+')';
// Each closed segment casts a wedge away from this observer. Keep all wedges
// wound alike so overlapping shadows remain opaque under the nonzero fill rule.
function shadowPath(source,walls,grid){
 const far=Math.hypot(grid.columns,grid.rows)+2,paths=[];
 for(const wall of walls){
  if(wall.open)continue;
  let ax=wall.x-source.x,ay=wall.y-source.y,bx=wall.toX-source.x,by=wall.toY-source.y;
  const cross=ax*by-ay*bx;
  if(Math.abs(cross)<1e-10)continue;
  if(cross<0){[ax,bx]=[bx,ax];[ay,by]=[by,ay];}
  const fa=far/Math.hypot(ax,ay),fb=far/Math.hypot(bx,by);
  const point=(x,y)=> (source.x+x).toFixed(5)+' '+(source.y+y).toFixed(5);
  paths.push('M'+point(ax,ay)+' L'+point(ax*fa,ay*fa)+' A'+far+' '+far+' 0 0 1 '+point(bx*fb,by*fb)+' L'+point(bx,by)+' Z');
 }
 return paths.join(' ');
}
function wallMask(id,token,table){
 const s=visionSector(token,table.grid),{columns,rows}=table.grid;
 return '<mask id="'+id+'" maskUnits="userSpaceOnUse" x="0" y="0" width="'+columns+'" height="'+rows+'"><rect width="'+columns+'" height="'+rows+'" fill="white"/><path data-wall-shadow="" data-origin="'+s.x+','+s.y+'" fill="black" d="'+shadowPath(s,table.walls,table.grid)+'"/></mask>';
}
function clipWalls(id,token,table,shape){
 if(!token||!table.walls?.length)return shape;
 return '<defs>'+wallMask(id,token,table)+'</defs><g mask="url(#'+id+')">'+shape+'</g>';
}
function moveShadows(host,tokens,table){
 if(!table.walls?.length)return;
 const nodes=host.querySelectorAll('[data-wall-shadow]');
 nodes.forEach((node,i)=>{
  const s=visionSector(tokens[i],table.grid),origin=s.x+','+s.y;
  if(node.dataset.origin===origin)return;
  node.dataset.origin=origin;
  node.setAttribute('d',shadowPath(s,table.walls,table.grid));
 });
}
const geometrySignatures=new WeakMap();
function geometrySignature(items){
 if(!items?.length)return '';
 if(!geometrySignatures.has(items))geometrySignatures.set(items,JSON.stringify(items));
 return geometrySignatures.get(items);
}
export function lightShape(light){
 return light.angle&&light.angle<360
  ? '<path d="'+sectorPath({...light,enabled:true})+'"'
  : '<circle cx="'+light.x+'" cy="'+light.y+'" r="'+light.radius+'"';
}
function sceneLighting(id,table,restrictLocal,restrictGlobal){
 const clip=(markup,mask)=>mask?'<g mask="url(#'+mask+')">'+markup+'</g>':markup;
 const defs=[],cuts=[],colors=[];
 for(const [index,l] of (table.lights||[]).entries()){
  const key=id+'-light-'+index;
  const shape=lightShape(l);
  const stops='<stop stop-opacity=".88"/><stop offset=".35" stop-opacity=".68"/><stop offset="1" stop-opacity="0"/>';
  for(const [suffix,color] of [['cut','black'],['tint',l.color]])
   defs.push('<radialGradient id="'+key+suffix+'" gradientUnits="userSpaceOnUse" cx="'+l.x+'" cy="'+l.y+'" r="'+l.radius+'">'+stops.replaceAll('<stop ','<stop stop-color="'+color+'" ')+'</radialGradient>');
  let mask='';
  if(table.walls?.length){
   defs.push('<mask id="'+key+'" maskUnits="userSpaceOnUse" x="0" y="0" width="'+table.grid.columns+'" height="'+table.grid.rows+'"><rect width="100%" height="100%" fill="white"/><path fill="black" d="'+shadowPath(l,table.walls,table.grid)+'"/></mask>');
   mask=' mask="url(#'+key+')"';
  }
  const observer=l.scope==='local'&&restrictLocal?id+'-lit':restrictGlobal?id+'-unobstructed':null;
  cuts.push(clip(shape+mask+' fill="url(#'+key+'cut)"/>',observer));
  colors.push(clip(shape+mask+' stroke="none" opacity=".44" fill="url(#'+key+'tint)"/>',observer));
 }
 const tint=colors.join('');
 if(!tint||table.atmosphere?.weather!=='mist')return {defs:defs.join(''),cuts:cuts.join(''),colors:tint};

 // A single seamless tile modulates the colored light already clipped by sight and walls.
 const strength={light:.38,medium:.66,heavy:.95}[table.atmosphere.level]??.66;
 const bounds='x="0" y="0" width="'+table.grid.columns+'" height="'+table.grid.rows+'"';
 defs.push(`<filter id="${id}-vapor-noise" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency=".19 .48" numOctaves="3" stitchTiles="stitch" seed="21"/>
 <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.2 0 0 0 -.65"/></filter>
 <pattern id="${id}-vapor-tile" patternUnits="userSpaceOnUse" width="12" height="8"><rect width="12" height="8" filter="url(#${id}-vapor-noise)"/></pattern>
 <mask id="${id}-vapor" maskUnits="userSpaceOnUse" ${bounds} style="mask-type:alpha"><rect ${bounds} fill="url(#${id}-vapor-tile)"/></mask>
 <g id="${id}-lit-air">${tint}</g>`);
 const illuminated='<use href="#'+id+'-lit-air"/>';
 return {defs:defs.join(''),cuts:cuts.join(''),colors:illuminated+'<g mask="url(#'+id+'-vapor)" opacity="'+strength+'">'+illuminated+'</g>'};
}
function selectedSource(row,tokens,selected,preview=false){if(row.master&&(!preview||row.state.table?.darkness?.mode==='group'))return null;const token=tokens.find(t=>t.id===selected);return token&&(row.master||token.characterId===row.characterId)?token:null;}
export function renderDarkness(row,table,tokens,{selected='',preview=false}={}){
 const war=table.fog?.enabled&&table.fog.mode==='war';
 if(!table.darkness.enabled&&!war&&!table.lights?.length)return '';
 const {columns,rows}=table.grid,sources=visionSources(row,tokens,{selected,preview});
 const id='vision-'+String(row.id||'table').replace(/[^a-z0-9_-]/gi,'');
 const playerView=!row.master||preview;
 const restrictLocal=!war&&playerView&&table.lights?.some(l=>l.scope==='local');
 const restrictGlobal=!war&&playerView&&table.walls?.some(w=>!w.open)&&table.lights?.some(l=>l.scope!=='local');
 const light=sceneLighting(id,table,restrictLocal,restrictGlobal);
 const bounds='x="0" y="0" width="'+columns+'" height="'+rows+'"';
 const opening=()=>'<svg class="vtt-darkness" viewBox="0 0 '+columns+' '+rows+'" preserveAspectRatio="none" stroke="none" stroke-width="0" aria-hidden="true">';
 if(!war&&!table.darkness.enabled&&!restrictLocal&&!restrictGlobal)return opening()+'<defs>'+light.defs+'</defs>'+light.colors+'</svg>';
 const rowsSeen=war?rememberedRows(row,table,sources):[];
 const path=exploredRowsPath(rowsSeen,table.grid);
 const atmosphere=war?`<radialGradient id="${id}-mist" cx=".32" cy=".24" r=".93"><stop stop-color="#343245"/><stop offset=".55" stop-color="#202434"/><stop offset="1" stop-color="#101522"/></radialGradient>
 <filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".58" numOctaves="2" seed="4"/></filter>
 <filter id="${id}-edge" filterUnits="userSpaceOnUse" x="0" y="0" width="${columns}" height="${rows}"><feGaussianBlur stdDeviation=".16"/></filter>
 <clipPath id="${id}-explored"><path data-memory-clip="" d="${path}"/></clipPath>`:'';
 const memoryShade=Math.round(90+63*(table.darkness.enabled?(table.darkness.level??100)/100:1));
 const memory=war?`<g clip-path="url(#${id}-explored)"><g filter="url(#${id}-edge)"><path data-memory-fill="" d="${path}" fill="rgb(${memoryShade},${memoryShade},${memoryShade})"/></g></g>`:'';

 const cuts=sources.map((token,i)=>{const s=visionSector(token,table.grid);return '<radialGradient id="'+id+'-'+i+'" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="'+Math.max(.001,s.radius)+'"><stop offset="0" stop-color="black"/><stop offset=".88" stop-color="black"/><stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient>';}).join('');
 const holes=sources.map((token,i)=>{const s=visionSector(token,table.grid);return clipWalls(id+'-wall-'+i,token,table,'<g data-vision-source="'+i+'" transform="'+placement(s)+'" stroke="none" stroke-width="0"><path data-vision-cone="" transform="'+turn(s)+'" d="'+localPath(s)+'" fill="url(#'+id+'-'+i+')" stroke="none"/><circle cx="0" cy="0" r="'+s.base+'" fill="black" stroke="none"/></g>');}).join('');
 const chosen=selectedSource(row,tokens,selected,preview),s=chosen?visionSector(chosen,table.grid):null;
 // Share the live, wall-clipped sight geometry between the fog cutout and the light tint.
 const useSight=war||restrictLocal||restrictGlobal;
 const sight=useSight?'<g id="'+id+'-sight">'+holes+'</g><mask id="'+id+'-lit" maskUnits="userSpaceOnUse" x="0" y="0" width="'+columns+'" height="'+rows+'" style="mask-type:alpha"><use href="#'+id+'-sight"/></mask>':'';
 // Global lights ignore sight distance and facing, but use each observer's wall shadows.
 const globalMask=restrictGlobal?'<mask id="'+id+'-unobstructed" maskUnits="userSpaceOnUse" '+bounds+'>'+sources.map((_,i)=>'<rect '+bounds+' fill="white" mask="url(#'+id+'-wall-'+i+')"/>').join('')+'</mask>':'';
 if(!war&&!table.darkness.enabled)return opening()+'<defs>'+light.defs+cuts+sight+globalMask+'</defs>'+light.colors+'</svg>';
 const sightCut=useSight?'<use href="#'+id+'-sight"/>':holes;
 const tint=war?'<g mask="url(#'+id+'-lit)">'+light.colors+'</g>':light.colors;
 return '<svg class="vtt-darkness" viewBox="0 0 '+columns+' '+rows+'" preserveAspectRatio="none" stroke="none" stroke-width="0" aria-hidden="true"><defs>'+atmosphere+light.defs+cuts+sight+globalMask+'<mask id="'+id+'" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="'+columns+'" height="'+rows+'" style="mask-type:luminance" stroke="none" stroke-width="0"><rect width="'+columns+'" height="'+rows+'" fill="white" stroke="none"/>'+memory+(war?'':light.cuts)+sightCut+(war?'<g data-memory-reveals="" clip-path="url(#'+id+'-explored)" filter="url(#'+id+'-edge)"></g>':'')+'</mask></defs><g class="vtt-darkness-cover" stroke="none"><rect width="'+columns+'" height="'+rows+'" fill="'+(war?'url(#'+id+'-mist)':'#090b14')+'" fill-opacity="'+(war?1:(table.darkness.level??100)/100)+'" stroke="none" mask="url(#'+id+')"/>'+(war?'<g mask="url(#'+id+')"><rect width="'+columns+'" height="'+rows+'" filter="url(#'+id+'-grain)" opacity=".055"/></g>':'')+'</g>'+tint+(s?clipWalls(id+'-outline-wall',chosen,table,'<g data-vision-outline="" transform="'+placement(s)+' '+turn(s)+'"><path class="vtt-vision-outline" d="'+localPath(s)+'" fill="none" stroke="#c5b5ff" stroke-width="1" vector-effect="non-scaling-stroke"/></g>'):'')+'</svg>';
}
function rememberedRows(row,table,sources){
 const ids=row.master?sources.map(token=>token.characterId):Object.keys(table.fog.memory||{});
 return explorationRows(table.fog.memory,new Set(ids),table.grid);
}

function syncMemory(host,row,table,sources,state,drags){
 if(!table.fog?.enabled||table.fog.mode!=='war')return;
 const trails=state.trails??=new Map();
 let changed=state.memory!==table.fog.memory;
 for(const [id,trail] of trails){
  if(drags?.get(id)!==trail.dragId){trails.delete(id);changed=true;}
 }
 for(const token of sources){
  const dragId=drags?.get(token.id);
  if(!dragId||!token.characterId||!token.visionSource)continue;
  let trail=trails.get(token.id);
  if(!trail){trail={dragId,fog:{}};trails.set(token.id,trail);}
  if(trail.last&&Math.hypot(token.x-trail.last.x,token.y-trail.last.y)<.25&&token.rotation===trail.last.rotation)continue;
  trail.last={x:token.x,y:token.y,rotation:token.rotation};
  recordExploration(trail.fog,token,table.grid,table.walls||[]);
  changed=true;
 }
 if(!changed)return;
 const rows=rememberedRows(row,table,sources);
 for(const trail of trails.values()){
  const extra=explorationRows(trail.fog.memory,Object.keys(trail.fog.memory||{}),table.grid);
  for(let y=0;y<rows.length;y++)rows[y]|=extra[y];
 }
 state.memory=table.fog.memory;
 const previous=state.rows;
 state.rows=rows;
 if(!previous||rows.every((bits,y)=>bits===previous[y]))return;
 const path=exploredRowsPath(rows,table.grid);
 host.querySelector('[data-memory-clip]').setAttribute('d',path);
 host.querySelector('[data-memory-fill]').setAttribute('d',path);
 const layer=host.querySelector('[data-memory-reveals]');
 if(rows.some((bits,y)=>previous[y]&~bits))layer.replaceChildren();
 if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const gained=exploredRowsPath(rows.map((bits,y)=>bits&~previous[y]),table.grid);
 if(!gained)return;
 const veil=host.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');
 veil.setAttribute('d',gained);
 veil.setAttribute('fill','#fff');
 layer.append(veil);
 const fade=veil.animate([{opacity:.48},{opacity:0}],{duration:620,easing:'ease-out',fill:'forwards'});
 fade.finished.then(()=>veil.remove(),()=>veil.remove());
}

const states=new WeakMap();
// Moving or turning a token updates transforms, preserving the SVG and masks.
export function updateDarkness(host,row,table,tokens,options={}){
 if(!host)return;
 const sources=visionSources(row,tokens,options),chosen=selectedSource(row,tokens,options.selected,options.preview);
 const signature=JSON.stringify([row.id,row.master,Boolean(options.preview),table.fog?.enabled&&table.fog.mode,row.state.sceneId,row.characterId,table.darkness.level,table.darkness.enabled,table.atmosphere?.weather==='mist'?table.atmosphere.level:null,table.grid.columns,table.grid.rows,table.grid.size,sources.map(t=>[t.id,t.characterId,t.size,t.vision]),chosen&&[chosen.id,chosen.size,chosen.vision]]);
 const state=states.get(host),nodes=[...(host.querySelectorAll?.('[data-vision-source]')||[])];
 if(!state||state.lights!==geometrySignature(table.lights)||state.walls!==geometrySignature(table.walls)||state.signature!==signature||table.darkness.enabled&&nodes.length!==sources.length){host.innerHTML=renderDarkness(row,table,tokens,options);states.set(host,{signature,memory:table.fog?.memory,rows:table.fog?.mode==='war'?rememberedRows(row,table,sources):null,lights:geometrySignature(table.lights),walls:geometrySignature(table.walls)});return;}
 syncMemory(host,row,table,sources,state,options.drags);
 moveShadows(host,chosen?[...sources,chosen]:sources,table);
 for(const node of nodes){const token=sources[Number(node.dataset.visionSource)];if(!token)continue;const s=visionSector(token,table.grid);node.setAttribute('transform',placement(s));node.querySelector('[data-vision-cone]')?.setAttribute('transform',turn(s));}
 if(chosen){const s=visionSector(chosen,table.grid);host.querySelector?.('[data-vision-outline]')?.setAttribute('transform',placement(s)+' '+turn(s));}
}

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function outlineTokens(row,table,tokens,options){return row.master&&table.darkness.enabled&&!options.preview&&options.showCones!==false?tokens.filter(token=>{const s=visionSector(token,table.grid);return s.enabled&&s.radius>0;}):[];}
export function renderVisionCones(row,table,tokens,options={}){
 const outlines=outlineTokens(row,table,tokens,options);if(!outlines.length)return '';
 return '<svg class="vtt-vision-cones" viewBox="0 0 '+table.grid.columns+' '+table.grid.rows+'" preserveAspectRatio="none" stroke="none" stroke-width="0" aria-hidden="true">'+outlines.map((token,index)=>{const s=visionSector(token,table.grid),selected=token.id===options.selected,color=characterColorHex(token.color);return clipWalls('cone-wall-'+index,token,table,'<g data-vision-all="'+index+'" transform="'+placement(s)+' '+turn(s)+'"><title>'+escape(token.name)+(token.hidden?' · Oculto dos jogadores':'')+'</title><path d="'+localPath(s)+'" fill="'+color+'" fill-opacity="'+(selected?'.065':'0')+'" stroke="'+color+'" stroke-opacity="'+(selected?'.95':'.5')+'" stroke-width="'+(selected?'1.8':'1')+'" '+(token.hidden?'stroke-dasharray="4 4" ':'')+'vector-effect="non-scaling-stroke"/></g>');}).join('')+'</svg>';
}
const outlineStates=new WeakMap();
export function updateVisionCones(host,row,table,tokens,options={}){
 if(!host)return;const outlines=outlineTokens(row,table,tokens,options),signature=JSON.stringify([row.id,table.grid.columns,table.grid.rows,table.grid.size,options.selected,outlines.map(t=>[t.id,t.size,t.vision,t.color,t.hidden,t.name])]),state=outlineStates.get(host),nodes=[...(host.querySelectorAll?.('[data-vision-all]')||[])];
 if(!state||state.walls!==geometrySignature(table.walls)||signature!==state.signature||nodes.length!==outlines.length){host.innerHTML=renderVisionCones(row,table,tokens,options);outlineStates.set(host,{signature,walls:geometrySignature(table.walls)});return;}
 moveShadows(host,outlines,table);
 for(const node of nodes){const token=outlines[Number(node.dataset.visionAll)];if(!token)continue;const s=visionSector(token,table.grid);node.setAttribute('transform',placement(s)+' '+turn(s));}
}
