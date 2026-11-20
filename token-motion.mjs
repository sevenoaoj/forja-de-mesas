// The stored position is the top-left of a circular token, in grid cells.
const epsilon=1e-8;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function slideToken(start,target,size,table){
 const radius=size/2,maxX=table.grid.columns-size,maxY=table.grid.rows-size;
 const goal={x:clamp(target.x,0,maxX),y:clamp(target.y,0,maxY)};
 if(!table.walls?.length)return goal;
 let x=start.x+radius,y=start.y+radius,dx=goal.x-start.x,dy=goal.y-start.y;
 // After the first contact, spend the remaining motion along the tangent.
 // Additional contacts handle corners and the edges of the map.
 for(let pass=0;pass<5&&Math.hypot(dx,dy)>epsilon;pass++){
  let time=1,nx=0,ny=0;
  function hit(t,hx,hy){
   if(t>=-epsilon&&t<time&&dx*hx+dy*hy < -epsilon){time=Math.max(0,t);nx=hx;ny=hy;}
  }
  if(dx<0)hit((radius-x)/dx,1,0);
  if(dx>0)hit((maxX+radius-x)/dx,-1,0);
  if(dy<0)hit((radius-y)/dy,0,1);
  if(dy>0)hit((maxY+radius-y)/dy,0,-1);
  for(const w of table.walls){
   if(w.open)continue;
   if(Math.max(x,x+dx)+radius<Math.min(w.x,w.toX)||Math.min(x,x+dx)-radius>Math.max(w.x,w.toX)
    ||Math.max(y,y+dy)+radius<Math.min(w.y,w.toY)||Math.min(y,y+dy)-radius>Math.max(w.y,w.toY))continue;
   const wx=w.toX-w.x,wy=w.toY-w.y,length=Math.hypot(wx,wy);
   if(length<epsilon)continue;
   const tx=wx/length,ty=wy/length,ax=x-w.x,ay=y-w.y;
   const side=-ax*ty+ay*tx,speed=-dx*ty+dy*tx;
   // A wall drawn through an existing token must still let it move away.
   if(side*speed<0){
    const sign=Math.sign(side),t=Math.max(0,(sign*radius-side)/speed);
    const along=(ax+t*dx)*tx+(ay+t*dy)*ty;
    if(along>=0&&along<=length)hit(t,-ty*sign,tx*sign);
   }
   // Sweep against the two round ends of the expanded segment.
   for(const end of [0,1]){
    const ex=ax-end*wx,ey=ay-end*wy,approach=ex*dx+ey*dy;
    if(approach>=0)continue;
    const a=dx*dx+dy*dy,c=ex*ex+ey*ey-radius*radius,disc=approach*approach-a*c;
    if(disc<=0)continue;
    const t=c<=0?0:c/(-approach+Math.sqrt(disc));
    if(t>=time)continue;
    const hx=ex+t*dx,hy=ey+t*dy,h=Math.hypot(hx,hy);
    if(h>epsilon)hit(t,hx/h,hy/h);
   }
  }
  x+=time*dx;y+=time*dy;
  if(time===1)break;
  const inward=dx*nx+dy*ny;
  dx=(1-time)*(dx-inward*nx);dy=(1-time)*(dy-inward*ny);
 }
 return {x:clamp(x-radius,0,maxX),y:clamp(y-radius,0,maxY)};
}

export function resolveTokenPath(token,target,table,path=[],snap=false){
 if(!Array.isArray(path)||path.length>64)throw Object.assign(new Error('Trajeto do token inválido.'),{status:400});
 const size=Number(token.size)||1;
 let at=token;
 for(const p of path){
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))throw Object.assign(new Error('Posição do trajeto inválida.'),{status:400});
  at=slideToken(at,p,size,table);
 }
 at=slideToken(at,target,size,table);
 return snap?slideToken(at,{x:Math.round(at.x),y:Math.round(at.y)},size,table):at;
}
