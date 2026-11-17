import {characterColorHex} from '../model.mjs';
import {visionSector,sectorPath,visionSources,tokenInVision,normalizeRotation} from '../vision-model.mjs';
export {visionSources,tokenInVision,normalizeRotation};
const localPath=source=>sectorPath({...source,x:0,y:0,rotation:0});
const placement=source=>'translate('+source.x+' '+source.y+')';
const turn=source=>'rotate('+source.rotation+')';
function selectedSource(row,tokens,selected,preview=false){if(row.master&&(!preview||row.state.table?.darkness?.mode==='group'))return null;const token=tokens.find(t=>t.id===selected);return token&&(row.master||token.characterId===row.characterId)?token:null;}
export function renderDarkness(row,table,tokens,{selected='',preview=false}={}){
 if(!table.darkness.enabled)return '';
 const {columns,rows}=table.grid,sources=visionSources(row,tokens,{selected,preview});
 const id='vision-'+String(row.id||'table').replace(/[^a-z0-9_-]/gi,'');
 const cuts=sources.map((token,i)=>{const s=visionSector(token,table.grid);return '<radialGradient id="'+id+'-'+i+'" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="'+Math.max(.001,s.radius)+'"><stop offset="0" stop-color="black"/><stop offset=".88" stop-color="black"/><stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient>';}).join('');
 const holes=sources.map((token,i)=>{const s=visionSector(token,table.grid);return '<g data-vision-source="'+i+'" transform="'+placement(s)+'" stroke="none" stroke-width="0"><path data-vision-cone="" transform="'+turn(s)+'" d="'+localPath(s)+'" fill="url(#'+id+'-'+i+')" stroke="none"/><circle cx="0" cy="0" r="'+s.base+'" fill="black" stroke="none"/></g>';}).join('');
 const chosen=selectedSource(row,tokens,selected,preview),s=chosen?visionSector(chosen,table.grid):null;
 return '<svg class="vtt-darkness" viewBox="0 0 '+columns+' '+rows+'" preserveAspectRatio="none" stroke="none" stroke-width="0" aria-hidden="true"><defs>'+cuts+'<mask id="'+id+'" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="'+columns+'" height="'+rows+'" style="mask-type:luminance" stroke="none" stroke-width="0"><rect width="'+columns+'" height="'+rows+'" fill="white" stroke="none"/>'+holes+'</mask></defs><g class="vtt-darkness-cover" stroke="none"><rect width="'+columns+'" height="'+rows+'" fill="#090b14" stroke="none" mask="url(#'+id+')"/></g>'+(s?'<g data-vision-outline="" transform="'+placement(s)+' '+turn(s)+'"><path class="vtt-vision-outline" d="'+localPath(s)+'" fill="none" stroke="#c5b5ff" stroke-width="1" vector-effect="non-scaling-stroke"/></g>':'')+'</svg>';
}
const states=new WeakMap();
// Moving or turning a token updates transforms, preserving the SVG and masks.
export function updateDarkness(host,row,table,tokens,options={}){
 if(!host)return;
 const sources=visionSources(row,tokens,options),chosen=selectedSource(row,tokens,options.selected,options.preview);
 const signature=JSON.stringify([row.id,table.darkness.enabled,table.grid.columns,table.grid.rows,table.grid.size,sources.map(t=>[t.id,t.size,t.vision]),chosen&&[chosen.id,chosen.size,chosen.vision]]);
 const state=states.get(host),nodes=[...(host.querySelectorAll?.('[data-vision-source]')||[])];
 if(!state||state.signature!==signature||table.darkness.enabled&&nodes.length!==sources.length){host.innerHTML=renderDarkness(row,table,tokens,options);states.set(host,{signature});return;}
 for(const node of nodes){const token=sources[Number(node.dataset.visionSource)];if(!token)continue;const s=visionSector(token,table.grid);node.setAttribute('transform',placement(s));node.querySelector('[data-vision-cone]')?.setAttribute('transform',turn(s));}
 if(chosen){const s=visionSector(chosen,table.grid);host.querySelector?.('[data-vision-outline]')?.setAttribute('transform',placement(s)+' '+turn(s));}
}

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function outlineTokens(row,table,tokens,options){return row.master&&table.darkness.enabled&&!options.preview&&options.showCones!==false?tokens.filter(token=>{const s=visionSector(token,table.grid);return s.enabled&&s.radius>0;}):[];}
export function renderVisionCones(row,table,tokens,options={}){
 const outlines=outlineTokens(row,table,tokens,options);if(!outlines.length)return '';
 return '<svg class="vtt-vision-cones" viewBox="0 0 '+table.grid.columns+' '+table.grid.rows+'" preserveAspectRatio="none" stroke="none" stroke-width="0" aria-hidden="true">'+outlines.map((token,index)=>{const s=visionSector(token,table.grid),selected=token.id===options.selected,color=characterColorHex(token.color);return '<g data-vision-all="'+index+'" transform="'+placement(s)+' '+turn(s)+'"><title>'+escape(token.name)+(token.hidden?' · Oculto dos jogadores':'')+'</title><path d="'+localPath(s)+'" fill="'+color+'" fill-opacity="'+(selected?'.065':'0')+'" stroke="'+color+'" stroke-opacity="'+(selected?'.95':'.5')+'" stroke-width="'+(selected?'1.8':'1')+'" '+(token.hidden?'stroke-dasharray="4 4" ':'')+'vector-effect="non-scaling-stroke"/></g>';}).join('')+'</svg>';
}
const outlineStates=new WeakMap();
export function updateVisionCones(host,row,table,tokens,options={}){
 if(!host)return;const outlines=outlineTokens(row,table,tokens,options),signature=JSON.stringify([row.id,table.grid.columns,table.grid.rows,table.grid.size,options.selected,outlines.map(t=>[t.id,t.size,t.vision,t.color,t.hidden,t.name])]),state=outlineStates.get(host),nodes=[...(host.querySelectorAll?.('[data-vision-all]')||[])];
 if(!state||signature!==state.signature||nodes.length!==outlines.length){host.innerHTML=renderVisionCones(row,table,tokens,options);outlineStates.set(host,{signature});return;}
 for(const node of nodes){const token=outlines[Number(node.dataset.visionAll)];if(!token)continue;const s=visionSector(token,table.grid);node.setAttribute('transform',placement(s)+' '+turn(s));}
}
