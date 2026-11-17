const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
export const normalizeRotation=value=>((finite(value,0)%360)+360)%360;
export function normalizeVision(value={}){return {enabled:value?.enabled!==false,range:clamp(finite(value?.range,9),0,10000),angle:clamp(finite(value?.angle,120),1,360)};}
export function normalizeDarkness(value={}){return {enabled:value?.enabled===true,mode:value?.mode==='group'?'group':'individual'};}
export function visionSector(token,grid){const vision=normalizeVision(token.vision),size=Number(token.size)||1;return {x:Number(token.x)+size/2,y:Number(token.y)+size/2,radius:vision.range/Math.max(.1,Number(grid.size)||1.5),angle:vision.angle,rotation:normalizeRotation(token.rotation),enabled:vision.enabled,base:size*.57};}
export function visionSources(row,tokens=row.state.tokens||[],{preview=false,selected=''}={}){
 const visible=tokens.filter(token=>!token.hidden);
 if(row.master){if(preview&&normalizeDarkness(row.state.table?.darkness).mode==='group')return visible.filter(token=>token.visionSource===true);const chosen=visible.find(token=>token.id===selected);if(chosen)return [chosen];return visible.filter(token=>token.visionSource===true);}
 if(normalizeDarkness(row.state.table?.darkness).mode==='group')return visible.filter(token=>token.visionSource===true||row.characterId&&token.characterId===row.characterId);
 return visible.filter(token=>Boolean(row.characterId&&token.characterId===row.characterId));
}
export function pointInVision(point,source){
 const dx=point.x-source.x,dy=point.y-source.y,distance=Math.hypot(dx,dy);
 if(distance<=source.base)return true;
 if(!source.enabled||distance>source.radius+1e-8)return false;
 if(source.angle>=360)return true;
 const bearing=normalizeRotation(Math.atan2(dy,dx)*180/Math.PI+90),delta=Math.abs(((bearing-source.rotation+540)%360)-180);
 return delta<=source.angle/2+1e-8;
}
export function tokenInVision(token,sources,grid){const size=Number(token.size)||1;return sources.some(source=>pointInVision({x:Number(token.x)+size/2,y:Number(token.y)+size/2},visionSector(source,grid)));}
export function sectorPath(source){
 if(!source.enabled||source.radius<=0)return '';
 const n=v=>Number(v.toFixed(5)),r=source.radius;
 if(source.angle>=360)return 'M '+n(source.x-r)+' '+n(source.y)+' a '+n(r)+' '+n(r)+' 0 1 0 '+n(r*2)+' 0 a '+n(r)+' '+n(r)+' 0 1 0 '+n(-r*2)+' 0';
 const start=(source.rotation-90-source.angle/2)*Math.PI/180,end=start+source.angle*Math.PI/180;
 return 'M '+n(source.x)+' '+n(source.y)+' L '+n(source.x+r*Math.cos(start))+' '+n(source.y+r*Math.sin(start))+' A '+n(r)+' '+n(r)+' 0 '+(source.angle>180?1:0)+' 1 '+n(source.x+r*Math.cos(end))+' '+n(source.y+r*Math.sin(end))+' Z';
}
