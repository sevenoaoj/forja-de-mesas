// Shared continuous fog geometry; no dependency on the map grid's snap setting.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function normalizeFogStrokes(value,grid){
 return (Array.isArray(value)?value:[]).slice(0,150).filter(item=>item&&['brush','rectangle'].includes(item.kind)&&['reveal','hide'].includes(item.operation)).map(item=>{
  const base={id:String(item.id||'').slice(0,80),kind:item.kind,operation:item.operation};
  if(item.kind==='rectangle')return {...base,x:clamp(Number(item.x)||0,0,grid.columns),y:clamp(Number(item.y)||0,0,grid.rows),width:clamp(Number(item.width)||0,0,grid.columns),height:clamp(Number(item.height)||0,0,grid.rows)};
  return {...base,radius:clamp(Number(item.radius)||.1,.001,8),points:(Array.isArray(item.points)?item.points:[]).slice(0,600).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:clamp(p.x,0,grid.columns),y:clamp(p.y,0,grid.rows)}))};
 }).filter(item=>item.kind==='rectangle'?item.width>0&&item.height>0:item.points.length>0);
}

export function pointRevealed(fog,point){
 if(!fog?.enabled)return true;
 const inside=rect=>point.x>=rect.x&&point.y>=rect.y&&point.x<=rect.x+rect.width&&point.y<=rect.y+rect.height;
 let revealed=(fog.revealed||[]).some(inside);
 for(const stroke of fog.strokes||[]){
  let hit=stroke.kind==='rectangle'?inside(stroke):false;
  if(stroke.kind==='brush')for(let i=0;i<stroke.points.length;i++){
   const a=stroke.points[i],b=stroke.points[Math.max(0,i-1)],dx=a.x-b.x,dy=a.y-b.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((point.x-b.x)*dx+(point.y-b.y)*dy)/length)):0;
   if(Math.hypot(point.x-b.x-t*dx,point.y-b.y-t*dy)<=stroke.radius){hit=true;break;}
  }
  if(hit)revealed=stroke.operation==='reveal';
 }
 return revealed;
}
