const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
export const normalizeRotation=value=>((finite(value,0)%360)+360)%360;
export function normalizeVision(value={}){return {enabled:value?.enabled!==false,range:clamp(finite(value?.range,9),0,10000),angle:clamp(finite(value?.angle,120),1,360)};}
export function normalizeDarkness(value={}){return {level:clamp(finite(value?.level,100),0,100),enabled:value?.enabled===true,mode:['group','teams'].includes(value?.mode)?value.mode:'individual',...(value?.teams?{teams:value.teams}:{})};}
export function visionSector(token,grid){const vision=normalizeVision(token.vision),size=Number(token.size)||1;return {x:Number(token.x)+size/2,y:Number(token.y)+size/2,radius:vision.range/Math.max(.1,Number(grid.size)||1.5),angle:vision.angle,rotation:normalizeRotation(token.rotation),enabled:vision.enabled,base:size*.57};}
export function visionSources(row,tokens=row.state.tokens||[],{preview=false,selected=''}={}){
 if(!row.master&&!row.characterId)return [];
 const visible=tokens.filter(token=>!token.hidden);
 const darkness=row.state.table?.darkness;
 if(darkness?.mode==='teams'&&(!row.master||preview)){
  const characterId=row.master?visible.find(token=>token.id===selected)?.characterId:row.characterId;
  const team=darkness.teams?.[characterId];
  return visible.filter(token=>characterId&&token.visionSource&&(token.characterId===characterId||team&&darkness.teams?.[token.characterId]===team));
 }
 if(row.master){if(preview&&normalizeDarkness(row.state.table?.darkness).mode==='group')return visible.filter(token=>token.visionSource===true);const chosen=visible.find(token=>token.id===selected);if(chosen)return [chosen];return visible.filter(token=>token.visionSource===true);}
 if(normalizeDarkness(row.state.table?.darkness).mode==='group')return visible.filter(token=>token.visionSource===true||row.characterId&&token.characterId===row.characterId);
 return visible.filter(token=>Boolean(row.characterId&&token.characterId===row.characterId));
}
export function pointInVision(point,source,walls=[]){
 const dx=point.x-source.x,dy=point.y-source.y,distance=Math.hypot(dx,dy);
 if(distance>source.base){
  if(!source.enabled||distance>source.radius+1e-8)return false;
  if(source.angle<360){
   const bearing=normalizeRotation(Math.atan2(dy,dx)*180/Math.PI+90);
   if(Math.abs(((bearing-source.rotation+540)%360)-180)>source.angle/2+1e-8)return false;
  }
 }
 return !walls.some(w=>{
   if(w.open)return false;
   const ex=w.toX-w.x,ey=w.toY-w.y,det=dx*ey-dy*ex;
   if(Math.abs(det)<1e-10)return false;
   const ax=w.x-source.x,ay=w.y-source.y;
   const along=(ax*ey-ay*ex)/det,across=(ax*dy-ay*dx)/det;
   return along>1e-8&&along<1-1e-8&&across>=-1e-8&&across<=1+1e-8;
 });
}
export function tokenInVision(token,sources,grid,walls=[]){const size=Number(token.size)||1;return sources.some(source=>pointInVision({x:Number(token.x)+size/2,y:Number(token.y)+size/2},visionSector(source,grid),walls));}
export function sectorPath(source){
 if(!source.enabled||source.radius<=0)return '';
 const n=v=>Number(v.toFixed(5)),r=source.radius;
 if(source.angle>=360)return 'M '+n(source.x-r)+' '+n(source.y)+' a '+n(r)+' '+n(r)+' 0 1 0 '+n(r*2)+' 0 a '+n(r)+' '+n(r)+' 0 1 0 '+n(-r*2)+' 0';
 const start=(source.rotation-90-source.angle/2)*Math.PI/180,end=start+source.angle*Math.PI/180;
 return 'M '+n(source.x)+' '+n(source.y)+' L '+n(source.x+r*Math.cos(start))+' '+n(source.y+r*Math.sin(start))+' A '+n(r)+' '+n(r)+' 0 '+(source.angle>180?1:0)+' 1 '+n(source.x+r*Math.cos(end))+' '+n(source.y+r*Math.sin(end))+' Z';
}

// Each bit represents a visited grid cell. Row masks keep campaign saves compact.
export function recordExploration(fog,token,grid,walls){
 const sector=visionSector(token,grid),radius=Math.max(sector.base,sector.enabled?sector.radius:0);
 fog.memory??={};
 const rows=fog.memory[token.characterId]??=[];
 for(let y=Math.max(0,Math.floor(sector.y-radius));y<Math.min(grid.rows,Math.ceil(sector.y+radius));y++){
  let bits=BigInt('0x'+(rows[y]||'0'));
  for(let x=Math.max(0,Math.floor(sector.x-radius));x<Math.min(grid.columns,Math.ceil(sector.x+radius));x++){
   const bit=1n<<BigInt(x);
   if(!(bits&bit)&&pointInVision({x:x+.5,y:y+.5},sector,walls))bits|=bit;
  }
  if(bits)rows[y]=bits.toString(16);
 }
}
export function explorationRows(memory,ids,grid){
 const rows=[];
 for(let y=0;y<grid.rows;y++){
  let bits=0n;
  for(const id of ids){const row=memory?.[id]?.[y];if(typeof row==='string'&&/^[a-f0-9]{1,20}$/.test(row))bits|=BigInt('0x'+row);}
  rows.push(bits);
 }
 return rows;
}

export function exploredRowsPath(rows,grid){
 const path=[];
 for(const [y,bits] of rows.entries()){
  for(let x=0;x<grid.columns;x++)if(bits&(1n<<BigInt(x))){
   const start=x;while(x+1<grid.columns&&(bits&(1n<<BigInt(x+1))))x++;
   path.push('M'+start+' '+y+'h'+(x-start+1)+'v1H'+start+'Z');
  }
 }
 return path.join('');
}

export function explorationPath(memory,ids,grid){
 return exploredRowsPath(explorationRows(memory,ids,grid),grid);
}
