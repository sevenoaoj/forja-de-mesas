// Native variable-height packing with gap filling. No external runtime dependencies.
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const contains=(a,b)=>a.x<=b.x&&a.y<=b.y&&a.x+a.w>=b.x+b.w&&a.y+a.h>=b.y+b.h;
export function packSheetBlocks(items,width,columns=3,gap=12){
 columns=Math.max(1,Math.min(3,Math.trunc(columns)||1));width=Math.max(1,width);gap=Math.max(0,gap);
 const unit=Math.max(1,(width-gap*(columns-1))/columns);let free=[{x:0,y:0,w:columns,h:Infinity}];const positions=[];
 for(const item of items){
  const span=Math.max(1,Math.min(columns,Math.trunc(item.span)||1)),height=Math.max(1,Number(item.height)||1);
  const slot=free.filter(rect=>rect.w>=span&&rect.h>=height+gap).sort((a,b)=>a.y-b.y||a.x-b.x)[0];
  const rect={x:slot.x,y:slot.y,w:span,h:height+gap};
  positions.push({id:item.id,x:rect.x*(unit+gap),y:rect.y,width:unit*span+gap*(span-1),height,span});
  const next=[];
  for(const space of free){
   if(!intersects(space,rect)){next.push(space);continue;}
   if(rect.x>space.x)next.push({...space,w:rect.x-space.x});
   if(rect.x+rect.w<space.x+space.w)next.push({...space,x:rect.x+rect.w,w:space.x+space.w-rect.x-rect.w});
   if(rect.y>space.y)next.push({...space,h:rect.y-space.y});
   if(rect.y+rect.h<space.y+space.h)next.push({...space,y:rect.y+rect.h,h:space.y+space.h===Infinity?Infinity:space.y+space.h-rect.y-rect.h});
  }
  free=next.filter((space,i)=>space.w>0&&space.h>0&&!next.some((other,j)=>j!==i&&contains(other,space)&&(other.x!==space.x||other.y!==space.y||other.w!==space.w||other.h!==space.h||j<i)));
 }
 return {positions,height:positions.reduce((max,item)=>Math.max(max,item.y+item.height),0),width,columns};
}
const distance=(rect,x,y)=>Math.hypot(Math.max(rect.x-x,0,x-rect.x-rect.width),Math.max(rect.y-y,0,y-rect.y-rect.height));
export function packedDropOrder(items,source,x,y,width,columns,gap,currentLayout){
 const original=items.map(item=>item.id),base=items.filter(item=>item.id!==source),dragged=items.find(item=>item.id===source);if(!dragged)return original;
 const candidates=new Set([Math.max(0,original.indexOf(source)),0,base.length]);
 if(items.length<=40)for(let i=0;i<=base.length;i++)candidates.add(i);
 else for(const rect of [...currentLayout.positions].filter(rect=>rect.id!==source).sort((a,b)=>distance(a,x,y)-distance(b,x,y)).slice(0,6)){const at=base.findIndex(item=>item.id===rect.id);candidates.add(at);candidates.add(at+1);}
 let best=original,bestScore=Infinity;
 for(const index of candidates){
  const next=[...base];next.splice(Math.min(index,base.length),0,dragged);
  const layout=packSheetBlocks(next,width,columns,gap),rect=layout.positions.find(item=>item.id===source);
  const score=distance(rect,x,y)*100+Math.hypot(rect.x+rect.width/2-x,rect.y+rect.height/2-y);
  if(score<bestScore-.1){bestScore=score;best=next.map(item=>item.id);}
 }
 return best;
}
export function createSheetPacking(container,{settings,request=globalThis.requestAnimationFrame?.bind(globalThis),cancel=globalThis.cancelAnimationFrame?.bind(globalThis),reducedMotion=()=>Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches),viewportWidth=()=>globalThis.innerWidth||1200}={}){
 if(!container?.querySelectorAll||!container.getBoundingClientRect)return null;
 const nodes=[...container.querySelectorAll('[data-sheet-leaf]')];if(!nodes.length)return null;
 const byId=new Map(nodes.map(node=>[node.dataset.sheetLeaf,node])),animations=new Map();let order=[...byId.keys()],original=null,layout={positions:[],height:0},metrics=[],frame,disposed=false;
 function refresh(animate=true){
  if(disposed)return;const width=container.getBoundingClientRect().width;if(!width)return;
  const config=settings(),columns=viewportWidth()<=730||width<=560?1:Math.min(config.columns||3,width<=850?2:3),gap=config.gap||12,unit=(width-gap*(columns-1))/columns;
  const before=new Map(nodes.map(node=>[node.dataset.sheetLeaf,node.getBoundingClientRect()]));
  for(const node of nodes){const span=Math.max(1,Math.min(columns,Number(node.dataset.span)||1));node.style.width=(unit*span+gap*(span-1))+'px';}
  metrics=order.map(id=>{const node=byId.get(id);return {id,span:Number(node.dataset.span)||1,height:node.offsetHeight||node.getBoundingClientRect().height||1};});
  const next=packSheetBlocks(metrics,width,columns,gap),previous=new Map(layout.positions.map(rect=>[rect.id,rect]));
  container.classList.add('is-packed');container.style.height=next.height+'px';
  for(const rect of next.positions){
   const node=byId.get(rect.id),old=previous.get(rect.id);node.style.left=rect.x+'px';node.style.top=rect.y+'px';
   if(!old||Math.abs(old.x-rect.x)<.5&&Math.abs(old.y-rect.y)<.5)continue;
   const from=before.get(rect.id);animations.get(rect.id)?.cancel();
   if(animate&&!reducedMotion()&&node.animate){const to=node.getBoundingClientRect();const animation=node.animate([{transform:'translate('+ (from.left-to.left)+'px,'+(from.top-to.top)+'px)'},{transform:'translate(0,0)'}],{duration:200,easing:'cubic-bezier(.2,.8,.2,1)'});animations.set(rect.id,animation);}
  }
  layout=next;
 }
 function schedule(){if(frame!==undefined||disposed)return;if(request)frame=request(()=>{frame=undefined;refresh();});else refresh();}
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;observer?.observe(container);for(const node of nodes)observer?.observe(node);
 refresh(false);
 return {refresh,begin(){original=[...order];},preview(id,clientX,clientY){
  const rect=container.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
  if(x< -20||x>rect.width+20||y< -25||y>Math.max(rect.height,layout.height)+70)return null;
  const config=settings(),next=packedDropOrder(metrics,id,x,y,layout.width,layout.columns,config.gap||12,layout);
  if(next.join('\0')!==order.join('\0')){order=next;refresh();}
  return [...order];
 },cancel(){if(original){order=original;original=null;refresh();}},finish(){original=null;return [...order];},get layout(){return layout;},dispose(){disposed=true;observer?.disconnect();if(frame!==undefined)cancel?.(frame);for(const animation of animations.values())animation.cancel();animations.clear();}};
}
