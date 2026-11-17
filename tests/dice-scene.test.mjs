import test from 'node:test';
import assert from 'node:assert/strict';
import {diceMesh,createDiceScene,dicePose,projectedDice,startDiceScene} from '../public/dice-scene.mjs';
const die=(faces,value)=>({faces,value,kept:true,sign:1});
test('geometrias têm faces fechadas, normais externas e polígonos corretos',()=>{
 for(const [sides,vertices]of [[4,3],[6,4],[8,3],[10,4],[12,5],[20,3]]) {
  const mesh=diceMesh(sides);assert.equal(mesh.faces.length,sides);
  const edges=new Map();
  for(const face of mesh.faces){assert.equal(face.ids.length,vertices);assert.ok(face.d>0);for(let i=0;i<face.ids.length;i++){const key=[face.ids[i],face.ids[(i+1)%face.ids.length]].sort((a,b)=>a-b).join();edges.set(key,(edges.get(key)||0)+1);}}
  assert.ok([...edges.values()].every(n=>n===2));
 }
});
test('face final mostra exatamente o valor recebido, inclusive em dados personalizados',()=>{
 for(const faces of [4,6,8,10,12,20,7,1000])for(const value of [1,faces]) {
  const scene=createDiceScene([die(faces,value)],700,280,'final');
  const result=projectedDice(scene,0,1).faces.find(f=>f.result);
  assert.ok(result);assert.equal(result.label,String(value));assert.ok(result.fontSize>8);
  assert.equal(dicePose(scene,0,1).height,0);
 }
});
test('d100 usa dezenas e unidades e conserva 100 como 00 mais 0',()=>{
 for(const [value,labels]of [[100,['00','0']],[1,['00','1']],[79,['70','9']]]){
  const scene=createDiceScene([die(100,value)],700,280,'percentile');assert.equal(scene.items.length,2);
  assert.deepEqual(scene.items.map((_,i)=>projectedDice(scene,i,1).faces.find(f=>f.result).label),labels);
 }
});
test('trajetórias são estáveis por rolagem, variadas e finitas em telas pequenas',()=>{
 const dice=[4,6,8,10,12,20,100].map(n=>die(n,n));
 const scene=createDiceScene(dice,300,230,'same');assert.deepEqual(scene,createDiceScene(dice,300,230,'same'));
 assert.notEqual(scene.items[0].speed,scene.items[1].speed);
 for(let p=0;p<=100;p++)for(let i=0;i<scene.items.length;i++){
  const {pose,faces}=projectedDice(scene,i,p/100);assert.ok(pose.height>=0);assert.ok(Math.abs(Math.hypot(...pose.orientation)-1)<1e-7);
  for(const face of faces)assert.ok(face.points.flat().every(Number.isFinite));
 }
 for(const item of scene.items){assert.ok(item.endX>0&&item.endX<300);assert.ok(item.endY>0&&item.endY<230);}
});
test('renderizador termina com o resultado e libera a animação ao fechar',()=>{
 const jobs=new Map(),labels=[];let next=0;
 const gradient={addColorStop(){}};
 const ctx=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,fillText:text=>labels.push(text)},{get:(o,key)=>o[key]||(()=>{})});
 const canvas={clientWidth:700,clientHeight:280,getContext:()=>ctx};
 const motion=startDiceScene(canvas,[die(20,18)],{request:fn=>{jobs.set(++next,fn);return next;},cancel:id=>jobs.delete(id)});
 assert.equal(canvas.hidden,false);assert.equal(jobs.size,1);labels.length=0;motion.finish();assert.ok(labels.includes('18'));assert.equal(jobs.size,0);
 motion.dispose();const count=labels.length;motion.finish();assert.equal(labels.length,count);
 assert.equal(startDiceScene({},[]),null);
});
test('numeração permanece fixa por face durante o giro e entre resultados distintos',()=>{
 for(const sides of [4,6,8,10,12,20,100]){
  const seen=new Map();
  for(const value of [1,sides]){
   const scene=createDiceScene([die(sides,value)],700,280,'fixed-faces');
   for(let step=0;step<=100;step++)for(let i=0;i<scene.items.length;i++)for(const face of projectedDice(scene,i,step/100).faces){
    const key=i+':'+face.id;
    if(seen.has(key))assert.equal(face.label,seen.get(key));else seen.set(key,face.label);
    assert.ok(face.textTransform.every(Number.isFinite));
   }
  }
 }
});
test('face do resultado termina centralizada e sua orientação não salta na revelação',()=>{
 for(const [width,height]of [[700,280],[300,230],[500,150]])for(const sides of [4,6,8,10,12,20]){
  const scene=createDiceScene([die(sides,sides)],width,height,'center');
  const result=projectedDice(scene,0,1).faces.find(f=>f.result);
  assert.ok(Math.abs(result.center[0]-width/2)<1e-7);
  assert.ok(Math.abs(result.center[1]-(height/2-8))<1e-7);
  assert.ok(result.textTransform[0]>0);assert.ok(result.textTransform[3]>0);
  for(const phase of [.91,.94]){
   const before=projectedDice(scene,0,phase-1e-7).faces.find(f=>f.result);
   const after=projectedDice(scene,0,phase+1e-7).faces.find(f=>f.result);
   assert.ok(before&&after);
   assert.ok(before.textTransform.every((v,i)=>Math.abs(v-after.textTransform[i])<.01));
  }
 }
 const pair=createDiceScene([die(20,7),die(20,17)],700,280,'pair');
 const centers=pair.items.map((_,i)=>projectedDice(pair,i,1).faces.find(f=>f.result).center);
 assert.ok(Math.abs((centers[0][0]+centers[1][0])/2-350)<1e-7);
});

test('face sorteada ganha destaque enquanto números vizinhos recuam sem trocar de valor',()=>{
 const scene=createDiceScene([die(20,17)],700,280,'screenshot');
 const faces=projectedDice(scene,0,1).faces,result=faces.find(face=>face.result),neighbors=faces.filter(face=>!face.result);
 assert.equal(result.label,'17');assert.equal(result.labelOpacity,1);assert.ok(result.labelScale>1);
 assert.ok(neighbors.length>0);assert.ok(neighbors.every(face=>face.labelOpacity<.2&&face.labelScale<1));
 const early=projectedDice(scene,0,.8).faces;
 assert.ok(early.every(face=>face.labelOpacity===1&&face.labelScale===1));
});

test('todos os tipos de dado seguem a mesma cor sem alterar trajetória ou resultado',()=>{
 const dice=[4,6,8,10,12,20,100].map(n=>die(n,n));
 const cyan=createDiceScene(dice,700,280,'same','#00ffff'),red=createDiceScene(dice,700,280,'same','#ff0000'),silver=createDiceScene(dice,700,280,'same','#aaaaaa');
 assert.ok(cyan.items.every(item=>item.color==='#00ffff'&&item.hue===180&&item.saturation===100));
 assert.ok(red.items.every(item=>item.hue===0));assert.ok(silver.items.every(item=>item.saturation===0));
 for(let i=0;i<cyan.items.length;i++){assert.deepEqual(projectedDice(cyan,i,1).pose,projectedDice(red,i,1).pose);assert.deepEqual(projectedDice(cyan,i,1).faces.map(f=>f.label),projectedDice(red,i,1).faces.map(f=>f.label));}
});
