// Dependency-free polyhedral dice renderer. Outcomes always come from the server.
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const mul=(a,n)=>a.map(v=>v*n);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1));
const average=points=>mul(points.reduce(add,[0,0,0]),1/points.length);
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const cache=new Map();
export const camera=norm([0,.85,1]);
const up=[0,camera[2],-camera[1]],light=norm([-.45,1,.65]);
function hull(vertices) {
 const faces=[],planes=new Set(),epsilon=1e-5;
 for(let a=0;a<vertices.length-2;a++)for(let b=a+1;b<vertices.length-1;b++)for(let c=b+1;c<vertices.length;c++) {
  let n=cross(sub(vertices[b],vertices[a]),sub(vertices[c],vertices[a]));if(Math.hypot(...n)<epsilon)continue;
  n=norm(n);let d=dot(n,vertices[a]);
  const distances=vertices.map(v=>dot(n,v)-d);
  if(distances.some(x=>x>epsilon)&&distances.some(x=>x< -epsilon))continue;
  if(distances.some(x=>x>epsilon)){n=mul(n,-1);d=-d;}
  const key=[...n,d].map(v=>Math.round(v*10000)).join(',');if(planes.has(key))continue;planes.add(key);
  const ids=vertices.map((v,i)=>Math.abs(dot(n,v)-d)<epsilon?i:-1).filter(i=>i>=0);
  const center=average(ids.map(i=>vertices[i])),u=norm(sub(vertices[ids[0]],center)),v=cross(n,u);
  ids.sort((a,b)=>Math.atan2(dot(sub(vertices[a],center),v),dot(sub(vertices[a],center),u))-Math.atan2(dot(sub(vertices[b],center),v),dot(sub(vertices[b],center),u)));
  const textU=norm(sub(vertices[ids[0]],center)),textV=cross(n,textU);
  const inset=Math.min(...ids.map((id,j)=>Math.hypot(...cross(sub(center,vertices[id]),norm(sub(vertices[ids[(j+1)%ids.length]],vertices[id]))))));
  faces.push({ids,normal:n,center,d,textU,textV,inset});
 }
 return {vertices,faces};
}
function normalized(vertices) {const radius=Math.max(...vertices.map(v=>Math.hypot(...v)));return vertices.map(v=>mul(v,1/radius));}
function dual(mesh) {return hull(normalized(mesh.faces.map(face=>mul(face.normal,1/face.d))));}
export function diceMesh(sides) {
 const kind=[4,6,8,10,12,20].includes(sides)?sides:20;
 if(cache.has(kind))return cache.get(kind);
 let vertices;
 if(kind===4)vertices=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
 if(kind===6)vertices=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x,y,z])));
 if(kind===8)vertices=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 if(kind===20||kind===12) {
  const p=(1+Math.sqrt(5))/2;
  vertices=[-1,1].flatMap(a=>[-p,p].flatMap(b=>[[0,a,b],[a,b,0],[b,0,a]]));
 }
 let mesh;
 if(kind===10) {
  const anti=hull(Array.from({length:10},(_,i)=>{const ring=i<5?1:-1,angle=(i%5)*Math.PI*2/5+(ring<0?Math.PI/5:0);return [Math.cos(angle),ring*.62,Math.sin(angle)];}));
  mesh=dual(anti);
 } else {mesh=hull(normalized(vertices));if(kind===12)mesh=dual(mesh);}
 cache.set(kind,mesh);return mesh;
}
const qMultiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qAxis=(axis,angle)=>[...mul(norm(axis),Math.sin(angle/2)),Math.cos(angle/2)];
const rotate=(v,q)=>qMultiply(qMultiply(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]).slice(0,3);
function align(a,b) {
 const cosine=dot(a,b);
 if(cosine< -.9999)return qAxis(norm(cross(a,Math.abs(a[0])<.8?[1,0,0]:[0,1,0])),Math.PI);
 const axis=cross(a,b),q=[...axis,1+cosine],length=Math.hypot(...q);return q.map(n=>n/length);
}
function slerp(a,b,t) {
 let cosine=dot(a,b);if(cosine<0){b=mul(b,-1);cosine=-cosine;}
 if(cosine>.9995){const q=a.map((n,i)=>n+(b[i]-n)*t);return mul(q,1/Math.hypot(...q));}
 const angle=Math.acos(Math.min(1,cosine)),sine=Math.sin(angle);
 return a.map((n,i)=>(n*Math.sin((1-t)*angle)+b[i]*Math.sin(t*angle))/sine);
}
function seeded(text) {
 let state=2166136261;for(const char of String(text)){state^=char.charCodeAt(0);state=Math.imul(state,16777619);}
 return ()=>{state+=0x6D2B79F5;let n=state;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};
}
export function diceDuration(count){return 2050+Math.min(count,16)*32;}
export function diceMaterial(color='#bd94ff') {
 const hex=/^#[a-f0-9]{6}$/i.test(color)?color:'#bd94ff';
 const [r,g,b]=[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,light=(max+min)/2;
 let hue=0;if(delta)hue=(max===r?((g-b)/delta+6)%6:max===g?(b-r)/delta+2:(r-g)/delta+4)*60;
 return {color:hex,hue,saturation:delta?delta/(1-Math.abs(2*light-1))*100:0,lightness:light*100};
}
export function createDiceScene(dice,width,height,seed='roll',color='#bd94ff') {
 const random=seeded(seed),material=diceMaterial(color),expanded=[];
 for(const die of dice) {
  if(die.faces===100) {
   const n=die.value%100;
   expanded.push({...die,faces:10,value:Math.floor(n/10)*10,percentile:'tens',caption:(die.sign<0?'− ':'')+'d100 · dezenas'}, {...die,faces:10,value:n%10,percentile:'ones',caption:(die.sign<0?'− ':'')+'d100 · unidades'});
  } else expanded.push({...die,caption:(die.sign<0?'− ':'')+'d'+die.faces});
 }
 const columns=Math.max(1,Math.ceil(Math.sqrt(expanded.length*width/height))),rows=Math.ceil(expanded.length/columns)||1;
 const radius=Math.min(57,width/(columns*2.7),height/(rows*2.7));
 const items=expanded.map((die,i)=>{
  const mesh=diceMesh(die.faces),axis=norm([random()-.5,random()-.5,random()-.5]);
  // Face numbering is fixed on the mesh. Rotate the requested face into view.
  const resultFace=die.percentile==='tens'?die.value/10:die.percentile==='ones'?die.value:(die.value-1)%mesh.faces.length;
  const landingNormal=norm(add(camera,[.16,up[1]*.22,up[2]*.22])),face=mesh.faces[resultFace];
  const aligned=align(face.normal,landingNormal),currentUp=rotate(face.textV,aligned);
  const desiredUp=norm(sub(up,mul(landingNormal,dot(up,landingNormal))));
  const twist=Math.atan2(dot(landingNormal,cross(currentUp,desiredUp)),dot(currentUp,desiredUp));
  const target=qMultiply(qAxis(landingNormal,twist),aligned);
  const row=Math.floor(i/columns),inRow=Math.min(columns,expanded.length-row*columns),col=i%columns;
  const spacingX=Math.min(width/columns,radius*2.65),spacingY=Math.min(height/rows,radius*2.65);
  // Center the visible result faces, rather than the hidden centers of the solids.
  const center=rotate(face.center,target),perspective=510/(510-dot(center,camera)*radius);
  const endX=width/2+(col-(inRow-1)/2)*spacingX-center[0]*radius*perspective;
  const endY=height/2-8+(row-(rows-1)/2)*spacingY+dot(center,up)*radius*perspective;
  const initial=qAxis(norm([random(),random(),random()]),random()*Math.PI*2);
  return {die,mesh,axis,target,initial,radius,resultFace,endX,endY,launchX:width*(.04+random()*.14),launchY:height*(.75+random()*.18),lift:radius*(1.4+random()*.8),velocity:160+random()*100,speed:17+random()*9,delay:i*24,...material};
 });
 return {width,height,items};
}
function bounce(item,seconds) {
 let height=item.lift,velocity=item.velocity,t=seconds,impact=0;
 for(let n=0;n<7;n++) {
  const hit=(velocity+Math.sqrt(velocity*velocity+2*1550*height))/1550;
  if(t<=hit)return {height:Math.max(0,height+velocity*t-775*t*t),impact};
  t-=hit;impact=seconds-t;velocity=Math.sqrt(velocity*velocity+2*1550*height)*.43;height=0;
  if(velocity<12)return {height:0,impact};
 }
 return {height:0,impact};
}
export function dicePose(scene,index,progress) {
 const item=scene.items[index],duration=diceDuration(scene.items.length),elapsed=Math.max(0,progress*duration-item.delay),seconds=elapsed/1000;
 const phase=clamp(elapsed/(duration-item.delay)),travel=1-Math.pow(1-clamp(phase/.92),3);
 const air=bounce(item,seconds),height=air.height*(1-smooth((phase-.76)/.24));
 const angle=item.speed*(1-Math.exp(-1.05*seconds))/1.05;
 const spin=qMultiply(qAxis(item.axis,angle),item.initial);
 const orientation=slerp(spin,item.target,smooth((phase-.64)/.36));
 return {x:item.launchX+(item.endX-item.launchX)*travel,y:item.launchY+(item.endY-item.launchY)*travel,height,orientation,phase,seconds,impact:air.impact};
}
export function projectedDice(scene,index,progress) {
 const item=scene.items[index],pose=dicePose(scene,index,progress);
 const transformed=item.mesh.vertices.map(v=>rotate(v,pose.orientation));
 const project=v=>{const perspective=510/(510-dot(v,camera)*item.radius);return [pose.x+v[0]*item.radius*perspective,pose.y-dot(v,up)*item.radius*perspective-pose.height*.84];};
 const faces=item.mesh.faces.flatMap((face,i)=>{
  const normal=rotate(face.normal,pose.orientation);if(dot(normal,camera)<.025)return [];
  const points=face.ids.map(id=>project(transformed[id])),center=average(face.ids.map(id=>transformed[id]));
  const p=project(center);
  let label=item.die.percentile==='tens'?String(i*10).padStart(2,'0'):String(item.die.percentile==='ones'?i:i+1);
  // Custom face counts use an illustrative solid, preserving the requested result.
  if(item.die.faces!==item.mesh.faces.length&&!item.die.percentile)label=String(i===item.resultFace?item.die.value:i%item.die.faces+1);
  const size=Math.min(.6,face.inset*(label.length>1?1:1.35));
  const u=mul(rotate(face.textU,pose.orientation),size/2),v=mul(rotate(face.textV,pose.orientation),size/2);
  const left=project(sub(center,u)),right=project(add(center,u)),top=project(add(center,v)),bottom=project(sub(center,v));
  const textTransform=[right[0]-left[0],right[1]-left[1],bottom[0]-top[0],bottom[1]-top[1]];
  const emphasis=smooth((progress-.82)/.18),result=i===item.resultFace;
  const labelOpacity=result?1:1-emphasis*.84,labelScale=result?1+emphasis*.14:1-emphasis*.22;
  const shade=Math.max(0,dot(normal,light)),shine=Math.pow(Math.max(0,dot(normal,norm(add(light,camera)))),22);
  return [{id:i,points,center:p,depth:dot(center,camera),light:26+shade*28+shine*16+emphasis*(result?12:-9),label,labelOpacity,labelScale,emphasis,textTransform,fontSize:Math.hypot(...textTransform.slice(2)),result}];
 }).sort((a,b)=>a.depth-b.depth);
 return {item,pose,faces};
}
export function startDiceScene(canvas,dice,{seed='roll',color='#bd94ff',duration=diceDuration(dice.length),reduced=false,request=globalThis.requestAnimationFrame?.bind(globalThis),cancel=globalThis.cancelAnimationFrame?.bind(globalThis)}={}) {
 if(!canvas?.getContext||!request&&!reduced)return null;
 let ctx;try{ctx=canvas.getContext('2d',{alpha:false});}catch{return null;}if(!ctx)return null;
 let scene,frame,disposed=false,started=null,finished=false,lastProgress=0;
 function resize() {
  const width=Math.max(220,canvas.clientWidth||650),height=Math.max(140,canvas.clientHeight||260),ratio=Math.min(globalThis.devicePixelRatio||1,2);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  scene=createDiceScene(dice,width,height,seed,color);
 }
 function draw(progress) {
  lastProgress=progress;
  const {width,height}=scene;
  const ground=ctx.createRadialGradient(width*.5,height*.45,5,width*.5,height*.5,width*.7);ground.addColorStop(0,'#25313b');ground.addColorStop(.65,'#18202a');ground.addColorStop(1,'#10131d');ctx.fillStyle=ground;ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#aec1d50d';ctx.lineWidth=1;
  for(let y=20;y<height;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
  const objects=scene.items.map((_,i)=>projectedDice(scene,i,progress));
  for(const {item,pose}of objects) {
   const spread=1+pose.height/180;ctx.save();ctx.translate(pose.x,pose.y+item.radius*.25);ctx.scale(1,.38);ctx.beginPath();ctx.ellipse(0,0,item.radius*.82*spread,item.radius*.82*spread,0,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,'+(.36/(1+pose.height/100))+')';ctx.filter='blur('+Math.min(10,2+pose.height/22)+'px)';ctx.fill();ctx.restore();
  }
  objects.sort((a,b)=>a.pose.y-b.pose.y);
  for(const {item,pose,faces}of objects) {
   const discarded=!item.die.kept&&progress>.9;ctx.save();ctx.globalAlpha=discarded ? .33 : 1;
   if(progress>.88&&item.die.selection&&item.die.kept){ctx.shadowColor='#8dedd2';ctx.shadowBlur=13;}
   for(const face of faces) {
    ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    const fill=ctx.createLinearGradient(face.center[0]-item.radius,face.center[1]-item.radius,face.center[0]+item.radius,face.center[1]+item.radius);fill.addColorStop(0,'hsl('+item.hue+' '+item.saturation+'% '+Math.min(90,Math.max(10,item.lightness+face.light-51))+'%)');fill.addColorStop(1,'hsl('+item.hue+' '+item.saturation+'% '+Math.max(5,Math.min(82,item.lightness+face.light-67))+'%)');ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=face.result&&face.emphasis>.01?'rgba(255,224,160,'+(.55+face.emphasis*.4)+')':'hsla('+item.hue+' '+item.saturation+'% 86% / .35)';ctx.lineWidth=face.result ? .9+face.emphasis*1.1 : .8;ctx.stroke();
    ctx.shadowBlur=0;
    if(face.fontSize>1){
     ctx.save();ctx.clip();ctx.globalAlpha*=face.labelOpacity;ctx.transform(...face.textTransform,...face.center);ctx.scale(face.labelScale,face.labelScale);
     ctx.fillStyle=face.result&&face.emphasis>.5?'#fff2cb':'#fff9ee';ctx.font='800 1px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
     ctx.fillText(face.label,0,0);
     if(discarded&&face.result){ctx.strokeStyle='#ddd2e7';ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(-.4,0);ctx.lineTo(.4,0);ctx.stroke();}
     ctx.restore();
    }
   }
   if(progress>.94){ctx.fillStyle=discarded?'#847f92':'#cdd6e1';ctx.font='11px system-ui,sans-serif';ctx.textAlign='center';const result=faces.find(face=>face.result);ctx.fillStyle=discarded?'#847f92':'#f5dfb7';ctx.fillText((item.die.caption||'dado')+' = '+(result?.label??item.die.value),result?.center[0]??pose.x,pose.y+item.radius+14);}
   ctx.restore();
  }
 }
 function tick(time) {if(disposed||finished)return;if(started===null)started=time;const progress=clamp((time-started)/duration);draw(progress);if(progress<1)frame=request(tick);else finished=true;}
 canvas.hidden=false;resize();draw(reduced?1:0);
 if(!reduced)frame=request(tick);else finished=true;
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(disposed)return;resize();draw(finished?1:lastProgress);}):null;observer?.observe(canvas);
 return {finish(){if(disposed)return;finished=true;if(frame!==undefined)cancel?.(frame);draw(1);},dispose(){disposed=true;if(frame!==undefined)cancel?.(frame);observer?.disconnect();}};
}
