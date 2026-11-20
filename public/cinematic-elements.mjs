// All motion is sampled from scene time so reconnecting clients join the same gesture.
const tau=Math.PI*2;
const clamp=value=>Math.min(1,Math.max(0,value));
const ease=value=>{const x=clamp(value);return x*x*(3-2*x);};
const noise=index=>{const n=Math.sin(index*83.71+1.17)*43758.5453;return n-Math.floor(n);};

function polygon(ctx,points,color){
 ctx.beginPath();ctx.moveTo(...points[0]);
 for(const point of points.slice(1))ctx.lineTo(...point);
 ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function gradient(ctx,x,y,xx,yy,colors){
 const paint=ctx.createLinearGradient(x,y,xx,yy);
 colors.forEach((color,i)=>paint.addColorStop(i/(colors.length-1),color));
 return paint;
}
function ember(ctx,x,y,r,color){
 ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,r*.56,r,-.42,0,tau);ctx.fill();
}

function fire(ctx,w,h,p){
 const size=Math.min(w,h),front=h*(1.32-1.85*ease(p)),clock=p*12;
 const wash=ctx.createLinearGradient(0,front-size*.3,0,front+size*.23);
 wash.addColorStop(0,'rgba(238,78,12,0)');wash.addColorStop(1,'rgba(248,95,16,.38)');
 ctx.fillStyle=wash;ctx.fillRect(0,0,w,h);
 const layers=[['#bc352b','#59152a'],['#ff9139','#bb3020'],['#fff29a','#ff972a']];
 for(const [layer,colors] of layers.entries()){
  const pitch=size*(.16-layer*.021),base=front+size*layer*.105;
  ctx.fillStyle=gradient(ctx,0,base-size*.3,0,base+size*.25,colors);
  ctx.beginPath();ctx.moveTo(-pitch,h+size);
  for(let i=-1;i<Math.ceil(w/pitch)+1;i++){
   const x=i*pitch,phase=clock+i*2.3+layer;
   const root=base+Math.sin(phase*.68)*pitch*.24;
   const tip=root-pitch*(1.15+.75*noise(i+layer*30)+.65*Math.sin(phase));
   const lean=pitch*(.45+.6*Math.sin(phase*.79));
   ctx.lineTo(x,root);
   ctx.bezierCurveTo(x+pitch*.07,root-pitch*.55,x+lean+pitch*.32,tip+pitch*.43,x+lean,tip);
   ctx.bezierCurveTo(x+lean+pitch*.72,tip+pitch*.32,x+pitch*.53,root-pitch*.38,x+pitch,base);
  }
  ctx.lineTo(w+pitch,h+size);ctx.closePath();ctx.fill();
 }
 // Slender tongues fold back into the hot core while the leading edge climbs.
 for(let i=0;i<16;i++){
  const x=w*noise(i+68),y=front+size*(.18+.56*noise(i+13));
  const sway=size*.05*Math.sin(clock+i);
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.bezierCurveTo(x-size*.08,y-size*.09,x+sway+size*.08,y-size*.14,x+sway,y-size*.27);
  ctx.bezierCurveTo(x+sway+size*.13,y-size*.12,x-size*.03,y-size*.07,x,y);
  ctx.fillStyle='rgba(255,231,134,.36)';ctx.fill();
 }
 for(let i=0;i<70;i++){
  const age=(p*1.7+noise(i))%1;
  const x=w*noise(i+99)+size*.06*Math.sin(age*4+i);
  ember(ctx,x,front-size*(.1+age*.65),size*(.0015+.005*noise(i+77))*(1-age*.7),i%3?'#ffb65a':'#fff2ad');
 }
}

function water(ctx,w,h,p){
 const u=Math.min(w,h), advance=w*(-.22+1.7*ease(p));
 // The face and overhanging lip share an anchor, but steepen at different rates.
 for(let layer=0;layer<3;layer++){
  const roll=p*5+layer*.9;
  const x=advance-u*layer*.11, y=h*(.22+.12*layer)+u*.055*Math.sin(roll);
  const curl=u*(.23+.07*Math.sin(roll));
  ctx.beginPath();ctx.moveTo(-w,-h);ctx.lineTo(x-u*.30,-h);
  ctx.bezierCurveTo(x-u*.25,y-u*.9,x-u*.47,y-curl*.43,x-u*.03,y-curl*.68);
  ctx.bezierCurveTo(x+curl*1.1,y-curl*1.5,x+curl*1.22,y+curl*.26,x+curl*.48,y+curl*.18);
  ctx.bezierCurveTo(x+curl*.91,y-curl*.49,x+curl*.10,y-curl*.53,x+curl*.11,y);
  ctx.bezierCurveTo(x+curl*.04,y+curl,x+u*.7,h*.8,x+u*.52,h+u*.2);
  ctx.lineTo(-w,h+u);ctx.closePath();
  const palette=[['#c7fff2','#2fbdc7','#14608a'],['#67e4dc','#208eaf','#184c80'],['#40baca','#17658d','#142e5e']][layer];
  ctx.fillStyle=gradient(ctx,x,y-curl,x-u*.38,y+u*.58,palette);ctx.fill();
  ctx.strokeStyle=layer?'rgba(164,245,236,.62)':'#dbfff3';ctx.lineWidth=u*(layer ? .003 : .007);ctx.stroke();
  for(let j=0;j<9;j++){
   const d=u*(.05+j*.07);
   ctx.beginPath();ctx.moveTo(x-d-u*.35,y-curl*.40);
   ctx.bezierCurveTo(x-d+u*.25,y-curl*1.15,x-d-u*.14,y+u*.12,x-d+u*.22,y+u*(.35+.05*Math.sin(roll+j)));
   ctx.strokeStyle='rgba(180,255,248,'+(.12+(j%3)*.06)+')';ctx.lineWidth=u*(.001+j%3*.001);ctx.stroke();
  }
  if(layer===0)for(let j=0;j<44;j++){
   const t=(noise(j)+p*1.8)%1;
   const dx=curl*(.32+t*(.55+noise(j+50))),dy=curl*(-.66-Math.sin(t*Math.PI)*(.34+noise(j+81))+.48*t);
   ember(ctx,x+dx,y+dy,u*(.0018+.006*noise(j+124))*(1-.7*t),'#d1fff2');
  }
 }
}

function earth(ctx,w,h,p){
 const u=Math.min(w,h);
 for(let row=0;row<2;row++){
  const count=Math.ceil(w/(u*(row ? .27 : .21))),width=w/count;
  for(let i=-1;i<=count;i++){
   const id=i+row*47,cut=width*(.25+noise(id)*.35),rim=u*(.018+.025*noise(id+4));
   const start=.04+.21*Math.abs(i/count-.48)+noise(id+6)*.15+row*.10;
   const t=clamp((p-start)/.49);
   const lift=ease(t)+.045*Math.sin(Math.PI*3*t)*Math.sin(Math.PI*t);
   const x=i*width+row*width*.27;
   const y=h*(1.08-lift*(row ? .82 : 1.25))+u*.08*noise(id+7);
   ctx.save();ctx.translate(x,y);
   const face=gradient(ctx,0,0,width*.7,h*.75,row?['#b38157','#70432e','#392c30']:['#97826a','#554b48','#302e38']);
   polygon(ctx,[[0,rim],[cut,0],[width+1,rim*.46],[width+1,h*1.5],[0,h*1.5]],face);
   polygon(ctx,[[0,rim],[cut,0],[width+1,rim*.46],[width*.63,rim*1.7],[width*.26,rim*1.35]],row?'#e0b57a':'#cbb794');
   polygon(ctx,[[width*.63,rim*1.7],[width+1,rim*.46],[width+1,h*1.5],[width*.67,h*1.5],[width*.78,h*.28]],row?'#64412f':'#524945');
   ctx.strokeStyle='rgba(42,30,30,.56)';ctx.lineWidth=Math.max(1,u*.0035);
   ctx.beginPath();ctx.moveTo(cut,rim*1.4);ctx.lineTo(cut-width*.09,h*.13);ctx.lineTo(cut+width*.05,h*.19);ctx.lineTo(cut-width*.03,h*.31);ctx.stroke();
   for(let k=0;k<5;k++){
    const sy=h*(.09+.078*k+.035*noise(id+k));
    polygon(ctx,[[0,sy],[width*.23,sy-rim*.64],[width*.58,sy-rim*.78],[width*.28,sy-rim*.31]],'rgba(240,208,155,.21)');
   }
   for(let k=0;k<3;k++){
    const sy=h*(.16+k*.26+.09*noise(id+k*12)),offset=rim*(.5+noise(k-id));
    polygon(ctx,[[0,sy],[width*.27,sy-offset],[width*.48,sy+rim*.25],[width*.73,sy-rim*.86],[width+1,sy-rim*.43],[width+1,sy],[width*.73,sy-rim*.57],[width*.48,sy+rim*.56],[width*.26,sy-offset+rim*.28],[0,sy+rim*.55]],'rgba(38,27,29,.46)');
   }
   if(t>.42&&t<.98){
    const dustAge=(t-.42)/.56;
    for(let k=0;k<6;k++){
     const dx=width*noise(id+k*8)+(noise(id+k)-.5)*width*dustAge;
     const dy=rim*(1-dustAge)-dustAge*u*(.03+.07*noise(id+k*14)),r=u*(.012+.045*dustAge);
     const dust=ctx.createRadialGradient(dx,dy,0,dx,dy,r);
     dust.addColorStop(0,'rgba(214,181,142,'+(.24*Math.sin(Math.PI*dustAge))+')');dust.addColorStop(1,'rgba(214,181,142,0)');
     ctx.fillStyle=dust;ctx.fillRect(dx-r,dy-r,r*2,r*2);
    }
   }
   if(t>0&&t<1)for(let k=0;k<7;k++){
    const age=clamp((t-noise(id+k)*.26)/.7),r=u*(.004+.012*noise(id+k*7))*(1-age);
    ctx.save();ctx.translate(width*noise(id+k*13)+(noise(id-k)-.5)*u*.24*age,-u*Math.sin(age*Math.PI)*(.10+.19*noise(k+id)));ctx.rotate(age*4+k);
    polygon(ctx,[[-r,0],[0,-r*.8],[r*.72,-r*.31],[r*.64,r*.72]],'#c9a475');ctx.restore();
   }
   ctx.restore();
  }
 }
}

function air(ctx,w,h,p){
 const u=Math.min(w,h),radius=Math.hypot(w,h)*(.74-.62*ease(p));
 const cx=w*(.49+.06*Math.sin(p*4)),cy=h*(.53-.1*Math.sin(Math.PI*p));
 for(let i=0;i<40;i++){
  const angle=p*7+i*2.39996,reach=radius*(.46+.95*noise(i)),arc=.65+noise(i+56)*2.3;
  const width=u*(i%6===0 ? .026 : .002+.008*noise(i+26));
  const left=[],right=[];
  for(let k=0;k<=30;k++){
   const t=k/30,a=angle+arc*t,r=reach*(1-.65*t);
   const thickness=width*Math.sin(t*Math.PI)**1.3;
   const x=cx+r*Math.cos(a),y=cy+r*.78*Math.sin(a)+u*.09*Math.sin(a+t);
   left.push([x+thickness*Math.cos(a),y+thickness*Math.sin(a)]);
   right.push([x-thickness*Math.cos(a),y-thickness*Math.sin(a)]);
  }
  polygon(ctx,left.concat(right.reverse()),i%5?'rgba(217,255,244,.66)':'rgba(109,197,190,.84)');
 }
 for(let i=0;i<45;i++){
  const a=p*5+noise(i)*tau,r=radius*(.19+noise(i+41)*1.13);
  ember(ctx,cx+Math.cos(a)*r,cy+Math.sin(a)*r*.82,u*(.0015+.003*noise(i+34)),'#e6fff5');
 }
}

const effects={fire,water,earth,air};
export function startElement(canvas,style,run,now){
 const draw=effects[style.transition];
 if(!draw||now()>=run.revealAt)return;
 const ctx=canvas.getContext('2d');
 if(!ctx)return;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let frame,last=-Infinity;
 canvas.hidden=false;
 function paint(time){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w||!h)return;
  const ratio=Math.min(devicePixelRatio,1.5,1500/Math.max(w,h));
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
   canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
  }
  const p=motion.matches ? .78 : clamp((now()-run.startedAt)/(run.revealAt-run.startedAt));
  if(time-last>=24||motion.matches||p===1){
   ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.clearRect(0,0,w,h);
   ctx.fillStyle=style.background;ctx.globalAlpha=ease(p*1.22)*.91;ctx.fillRect(0,0,w,h);
   ctx.globalAlpha=motion.matches?1:ease(p*9);draw(ctx,w,h,p);
   // Resolve the movement into the master's palette before the reveal.
   ctx.fillStyle=style.accent;ctx.globalAlpha=ease((p-.56)/.36)*.14;ctx.fillRect(0,0,w,h);
   ctx.fillStyle=style.background;ctx.globalAlpha=ease((p-.85)/.15);ctx.fillRect(0,0,w,h);
   ctx.globalAlpha=1;last=time;
  }
  if(!motion.matches&&p<1)frame=requestAnimationFrame(paint);
 }
 function restart(){cancelAnimationFrame(frame);last=-Infinity;paint(performance.now());}
 motion.addEventListener('change',restart);window.addEventListener('resize',restart);
 paint(performance.now());
 return ()=>{
  cancelAnimationFrame(frame);motion.removeEventListener('change',restart);window.removeEventListener('resize',restart);
  canvas.hidden=true;canvas.width=canvas.height=1;
 };
}
