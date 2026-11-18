const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const geometry=el=>({x:el.offsetLeft,y:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight});
const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
function route(a,b){
 const p=center(a),q=center(b),dx=q.x-p.x,dy=q.y-p.y;
 const horizontal=Math.abs(dx)>=Math.abs(dy),sign=Math.sign(horizontal?dx:dy)||1;
 const bend=Math.max(36,Math.abs(horizontal?dx:dy)*.4);
 if(horizontal){p.x+=sign*a.width/2;q.x-=sign*b.width/2;}else{p.y+=sign*a.height/2;q.y-=sign*b.height/2;}
 const k=horizontal?sign*bend:0,l=horizontal?0:sign*bend;
 return {d:'M '+p.x+' '+p.y+' C '+(p.x+k)+' '+(p.y+l)+' '+(q.x-k)+' '+(q.y-l)+' '+q.x+' '+q.y,x:(p.x+q.x)/2,y:(p.y+q.y)/2};
}
export function mountVaultCanvas(shell,view,{save,newNote,editEdge,editNote,report}){
 if(!shell)return;
 const pane=shell.querySelector('.vault-scroll'),plane=pane.querySelector('.vault-plane');
 const cards=new Map([...plane.querySelectorAll('[data-vault-card]')].map(el=>[el.dataset.vaultCard,el]));
 const edges=[...plane.querySelectorAll('[data-edge-from]')],hint=shell.querySelector('[data-canvas-hint]');
 const firstVisit=!view.camera;
 const cam=view.camera??={x:0,y:0,z:1},selected=new Set((view.selectedNotes||[]).filter(id=>cards.has(id))),touches=new Map();
 const navigationHint=hint.textContent;
 const marquee=pane.querySelector('.canvas-marquee'),areaTool=shell.querySelector('[data-camera="select"]');
 let gesture=null,source=null,space=false;
 const preview=document.createElementNS('http://www.w3.org/2000/svg','path');
 preview.classList.add('edge-preview');plane.querySelector('svg').append(preview);
 let hovered=null;
 function highlight(id){
  if(hovered===id)return;
  cards.get(hovered)?.classList.remove('canvas-target');
  hovered=id;cards.get(id)?.classList.add('canvas-target');
 }
 const getCard=node=>node?.closest('[data-vault-card]')?.dataset.vaultCard;
 const screen=e=>{const b=pane.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};};
 const world=p=>({x:(p.x-cam.x)/cam.z,y:(p.y-cam.y)/cam.z});
 function camera(){
  plane.style.transform='translate('+cam.x+'px,'+cam.y+'px) scale('+cam.z+')';
  pane.style.backgroundPosition=cam.x+'px '+cam.y+'px';pane.style.backgroundSize=(24*cam.z)+'px '+(24*cam.z)+'px';
  shell.querySelector('[data-scale]').textContent=Math.round(cam.z*100)+'%';
 }
 function zoom(z,at){
  const p=world(at);cam.z=clamp(z,.025,3);cam.x=at.x-p.x*cam.z;cam.y=at.y-p.y*cam.z;camera();
 }
 function fit(){
  const boxes=[...cards.values()].map(geometry);
  if(!boxes.length){Object.assign(cam,{x:0,y:0,z:1});camera();return;}
  const left=Math.min(...boxes.map(r=>r.x)),right=Math.max(...boxes.map(r=>r.x+r.width)),top=Math.min(...boxes.map(r=>r.y)),bottom=Math.max(...boxes.map(r=>r.y+r.height));
  cam.z=clamp(Math.min((pane.clientWidth-36)/(right-left),(pane.clientHeight-36)/(bottom-top)),.001,2);
  cam.x=(pane.clientWidth-(right+left)*cam.z)/2;cam.y=(pane.clientHeight-(bottom+top)*cam.z)/2;camera();
 }
 function redraw(){
  for(const edge of edges){
   const a=cards.get(edge.dataset.edgeFrom),b=cards.get(edge.dataset.edgeTo);if(!a||!b)continue;
   const {d,x,y}=route(geometry(a),geometry(b));for(const path of edge.querySelectorAll('path'))path.setAttribute('d',d);
   const text=edge.querySelector('text');text.setAttribute('x',x);text.setAttribute('y',y-6);
  }
 }
 function selection(){
  view.selectedNotes=[...selected];
  const message=source?'Escolha o ponto lateral da nota de destino. Escape cancela.':selected.size
   ?(selected.size===1?'1 cartão selecionado.':selected.size+' cartões selecionados.')+' Arraste a seleção para mover.'
   :view.areaMode?'Arraste sobre o fundo para selecionar os cartões que a área tocar.':navigationHint;
  if(hint.textContent!==message)hint.textContent=message;
  for(const [id,el] of cards){el.classList.toggle('canvas-selected',selected.has(id));el.classList.toggle('canvas-source',source===id);}
  shell.querySelector('[data-camera="arrange"]').disabled=selected.size<2;
  const color=shell.querySelector('[data-card-color]');color.disabled=!selected.size;
  if(selected.size)color.value=cards.get([...selected][0]).style.getPropertyValue('--card-tone').trim();
 }
 function choose(id,extend){
  if(!extend&&!selected.has(id))selected.clear();
  if(extend&&selected.has(id))selected.delete(id);else selected.add(id);
  selection();
 }
 function selectArea(g,pos){
  const x=Math.min(g.pos.x,pos.x),y=Math.min(g.pos.y,pos.y);
  const width=Math.abs(g.pos.x-pos.x),height=Math.abs(g.pos.y-pos.y);
  Object.assign(marquee.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});
  marquee.hidden=false;
  const a=world({x,y}),b=world({x:x+width,y:y+height});
  selected.clear();
  for(const [id,r] of g.boxes){
   if(g.base.has(id)||(r.x<=b.x&&r.y<=b.y&&r.x+r.width>=a.x&&r.y+r.height>=a.y))selected.add(id);
  }
  selection();
 }
 function arrange(){
  const boxes=[...selected].map(id=>({id,...geometry(cards.get(id))})).sort((a,b)=>a.y-b.y||a.x-b.x);
  if(boxes.length<2)return;
  const columns=Math.ceil(Math.sqrt(boxes.length)),gap=28;
  const widths=Array(columns).fill(0);
  boxes.forEach((box,i)=>{widths[i%columns]=Math.max(widths[i%columns],box.width);});
  const left=clamp(Math.min(...boxes.map(b=>b.x)),-100000,100000-widths.reduce((sum,w)=>sum+w+gap,0));
  let y=clamp(Math.min(...boxes.map(b=>b.y)),-100000,100000-Math.ceil(boxes.length/columns)*(Math.max(...boxes.map(b=>b.height))+gap));
  const changes=[];
  for(let i=0;i<boxes.length;i+=columns){
   const row=boxes.slice(i,i+columns);let x=left;
   row.forEach((box,col)=>{changes.push({id:box.id,x,y});x+=widths[col]+gap;});
   y+=Math.max(...row.map(b=>b.height))+gap;
  }
  persist(changes);
 }
 function apply(el,r){
  el.style.left=r.x+'px';el.style.top=r.y+'px';el.style.width=r.width+'px';el.style.height=r.height+'px';
 }
 async function persist(changes,onError){
  if(!changes.length)return;
  try{await save(changes);}catch(error){if(shell.isConnected)onError?.();report(error.message);}
 }
 function port(id){
  if(source&&source!==id){const from=source;source=null;selection();editEdge(from,id);return;}
  source=source===id?null:id;selection();
  hint.textContent=source?'Escolha o ponto lateral da nota de destino. Escape cancela.':'Conexão cancelada.';
 }
 function finish(commit){
  const g=gesture;gesture=null;delete shell.dataset.gesture;
  preview.removeAttribute('d');highlight(null);marquee.hidden=true;
  if(g?.mode==='area'&&!commit){selected.clear();for(const id of g.previous)selected.add(id);selection();}
  if(!g?.starts)return;
  if(!commit){for(const [id,r] of g.starts)apply(cards.get(id),r);redraw();return;}
  const changes=[];
  for(const [id,r] of g.starts){
   const next=geometry(cards.get(id)),change={id};
   for(const k of ['x','y','width','height'])if(next[k]!==r[k])change[k]=next[k];
   if(Object.keys(change).length>1)changes.push(change);
  }
  persist(changes,()=>{for(const [id,r] of g.starts)apply(cards.get(id),r);redraw();});
 }
 const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 pane.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1)return;
  const pos=screen(e),id=getCard(e.target);
  if(e.pointerType==='touch'){
   if(!gesture)touches.clear();
   touches.set(e.pointerId,pos);
  }
  if(touches.size===2){
   finish(false);const [a,b]=[...touches.values()];
   gesture={mode:'pinch',anchor:world(midpoint(a,b)),distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale:cam.z};
  }else{
   if(gesture)return;
   let mode='pan';
   if(!space&&e.button!==1){
    if(e.target.closest('[data-port]'))mode='port';
    else if(e.target.closest('button:not([data-vault-move]):not([data-size]),[data-manual-edge]'))return;
    else if(id){choose(id,e.shiftKey);if(!selected.has(id))return;mode=e.target.closest('[data-size]')?'size':'move';}
    else if(view.areaMode||e.shiftKey){mode='area';source=null;}
    else{source=null;selected.clear();selection();}
   }
   const starts=['move','size'].includes(mode)?new Map((mode==='size'?[id]:[...selected]).map(key=>[key,geometry(cards.get(key))])):null;
   gesture={mode,id,pos,pointer:e.pointerId,x:cam.x,y:cam.y,starts};
   if(mode==='area'){
    Object.assign(gesture,{base:new Set(e.shiftKey?selected:[]),previous:new Set(selected),boxes:[...cards].map(([key,el])=>[key,geometry(el)])});
    selectArea(gesture,pos);
   }
  }
  shell.dataset.gesture=gesture.mode;
  const focus=e.target.closest('button')||pane;focus.focus({preventScroll:true});
  const capture=['move','size','port'].includes(gesture.mode)?e.target:pane;
  capture.setPointerCapture(e.pointerId);e.preventDefault();
 });
 pane.addEventListener('pointermove',e=>{
  if(!gesture)return;
  const pos=screen(e),g=gesture;
  if(touches.has(e.pointerId))touches.set(e.pointerId,pos);
  if(g.mode==='pinch'){
   if(touches.size!==2)return;const [a,b]=[...touches.values()],mid=midpoint(a,b);
   cam.z=clamp(g.scale*Math.hypot(a.x-b.x,a.y-b.y)/g.distance,.025,3);cam.x=mid.x-g.anchor.x*cam.z;cam.y=mid.y-g.anchor.y*cam.z;camera();return;
  }
  if(e.pointerId!==g.pointer)return;
  const dx=pos.x-g.pos.x,dy=pos.y-g.pos.y;
  if(g.mode==='area'){selectArea(g,pos);return;}
  if(g.mode==='pan'){cam.x=g.x+dx;cam.y=g.y+dy;camera();}
  if(g.mode==='port'){
   const target=getCard(document.elementFromPoint(e.clientX,e.clientY)),p=world(pos),box=geometry(cards.get(g.id));
   highlight(target!==g.id?target:null);
   preview.setAttribute('d',route(box,hovered?geometry(cards.get(hovered)):{...p,width:0,height:0}).d);return;
  }
  if(g.starts){for(const [id,r] of g.starts){
   const next={...r};
   if(g.mode==='size'){next.width=clamp(Math.round(r.width+dx/cam.z),220,1500);next.height=clamp(Math.round(r.height+dy/cam.z),160,1500);}
   else{next.x=clamp(Math.round(r.x+dx/cam.z),-100000,100000);next.y=clamp(Math.round(r.y+dy/cam.z),-100000,100000);}
   apply(cards.get(id),next);
  }redraw();}
 });
 function release(e){
  touches.delete(e.pointerId);const g=gesture;
  if(!g||(g.pointer!==e.pointerId&&g.mode!=='pinch'))return;
  if(e.type==='pointerup'&&g.mode==='port'){
   const target=getCard(document.elementFromPoint(e.clientX,e.clientY));
   if(target&&target!==g.id){source=g.id;port(target);}else if(target===g.id)port(g.id);
  }
  finish(e.type==='pointerup');delete pane.dataset.connecting;
 }
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pane.addEventListener(name,release);
 pane.addEventListener('wheel',e=>{
  e.preventDefault();if(e.ctrlKey||e.metaKey||space)zoom(cam.z*Math.exp(-clamp(e.deltaY,-180,180)*.008),screen(e));
  else{cam.x-=e.shiftKey?e.deltaY:e.deltaX;cam.y-=e.shiftKey?0:e.deltaY;camera();}
 },{passive:false});
 function create(p){const at=world(p);newNote({x:clamp(Math.round(at.x),-100000,100000),y:clamp(Math.round(at.y),-100000,100000)});}
 pane.addEventListener('dblclick',e=>{
  if(e.target.closest('button,[data-manual-edge]'))return;
  const id=getCard(e.target);if(id)editNote(id);else create(screen(e));
 });
 shell.addEventListener('click',e=>{
  const tool=e.target.closest('[data-camera]')?.dataset.camera,mid={x:pane.clientWidth/2,y:pane.clientHeight/2};
  if(tool==='in'||tool==='out')zoom(cam.z*(tool==='in'?1.25:.8),mid);
  if(tool==='fit')fit();
  if(tool==='select'){view.areaMode=!view.areaMode;areaTool.setAttribute('aria-pressed',String(view.areaMode));selection();}
  if(tool==='arrange')arrange();
  if(tool==='add')create(mid);
  if(tool==='full'){view.canvasFull=!view.canvasFull;shell.classList.toggle('canvas-full',view.canvasFull);pane.focus();}
  const edge=e.target.closest('[data-manual-edge]');if(edge)editEdge(edge.dataset.edgeFrom,edge.dataset.edgeTo);
  if(e.detail===0&&e.target.matches('[data-port]'))port(getCard(e.target));
 });
 areaTool.setAttribute('aria-pressed',String(!!view.areaMode));
 shell.querySelector('[data-locate]').addEventListener('change',e=>{
  const id=e.target.value,card=cards.get(id);
  if(!card)return;
  const r=geometry(card),p=center(r);
  cam.z=clamp(Math.min((pane.clientWidth-32)/r.width,(pane.clientHeight-32)/r.height),.025,1.15);
  cam.x=pane.clientWidth/2-p.x*cam.z;cam.y=pane.clientHeight/2-p.y*cam.z;
  selected.clear();choose(id,false);camera();e.target.value='';
  pane.focus({preventScroll:true});
 });
 shell.querySelector('[data-card-color]').addEventListener('change',e=>persist([...selected].map(id=>({id,color:e.target.value}))));
 shell.addEventListener('keydown',e=>{
  if(e.target.matches('input,select'))return;
  if(e.key==='Escape'){finish(false);source=null;selection();view.canvasFull=false;shell.classList.remove('canvas-full');return;}
  if(e.code==='Space'&&e.target===pane){space=true;e.preventDefault();}
  if(e.code==='Digit1'&&e.shiftKey){fit();e.preventDefault();}
  const edge=e.target.closest('[data-manual-edge]');if(edge&&e.key==='Enter')editEdge(edge.dataset.edgeFrom,edge.dataset.edgeTo);
  const id=getCard(e.target),delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(id&&delta&&e.target.matches('[data-vault-move],[data-size]')){
   e.preventDefault();const r=geometry(cards.get(id)),[dx,dy]=delta;
   persist([e.target.matches('[data-size]')?{id,width:clamp(r.width+dx*16,220,1500),height:clamp(r.height+dy*16,160,1500)}:{id,x:clamp(r.x+dx*16,-100000,100000),y:clamp(r.y+dy*16,-100000,100000)}]);
  }
 });
 shell.addEventListener('keyup',()=>{space=false;});shell.addEventListener('focusout',()=>{space=false;});
 shell.classList.toggle('canvas-full',!!view.canvasFull);camera();redraw();selection();
 if(firstVisit&&cards.size&&![...cards.values()].some(el=>{
  const r=geometry(el);return r.x+r.width>0&&r.y+r.height>0&&r.x<pane.clientWidth&&r.y<pane.clientHeight;
 }))fit();
}
