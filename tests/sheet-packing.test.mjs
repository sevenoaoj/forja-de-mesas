import test from 'node:test';
import assert from 'node:assert/strict';
import {packSheetBlocks,packedDropOrder,createSheetPacking} from '../public/sheet-packing.mjs';

const sample=[{id:'tall',height:600},{id:'a',height:100},{id:'b',height:100},{id:'c',height:100},{id:'d',height:100},{id:'last',height:140}];
test('blocos curtos preenchem o espaço sob vizinhos sem esperar a altura do maior',()=>{
 const layout=packSheetBlocks(sample,900,3,12),at=id=>layout.positions.find(p=>p.id===id);
 assert.equal(at('c').y,112);assert.equal(at('c').x,304);assert.equal(at('d').y,112);assert.equal(layout.height,600);
});
test('até 108 blocos de larguras e alturas diferentes cabem sem sobreposição',()=>{
 for(const columns of [1,2,3])for(const seed of [1,7,39]){
  const items=Array.from({length:108},(_,i)=>({id:String(i),height:35+(i*seed*73)%550,span:1+(i*seed)%3}));
  const {positions,height}=packSheetBlocks(items,1000,columns,16);assert.equal(positions.length,108);assert.equal(new Set(positions.map(p=>p.id)).size,108);
  for(const [i,a] of positions.entries()){
   assert.ok(a.x>=0&&a.x+a.width<=1000.001);assert.ok(a.y>=0&&a.y+a.height<=height);
   for(const b of positions.slice(i+1))assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,JSON.stringify([a,b]));
  }
 }
});
test('um espaço livre aceita arraste e abre lugar mesmo sem um bloco como alvo',()=>{
 const layout=packSheetBlocks(sample,900,3,12),order=packedDropOrder(sample,'last',450,140,900,3,12,layout);
 assert.equal(order[3],'last');assert.deepEqual([...order].sort(),sample.map(p=>p.id).sort());
 const next=packSheetBlocks(order.map(id=>sample.find(p=>p.id===id)),900,3,12),source=next.positions.find(p=>p.id==='last');
 assert.equal(source.x,304);assert.equal(source.y,112);
 assert.deepEqual(packedDropOrder(order.map(id=>sample.find(p=>p.id===id)),'last',450,140,900,3,12,next),order);
});
function fixture({motion=false}={}){
 let width=900,viewport=1200,animations=0,cancelled=0;
 const nodes=sample.map(item=>({dataset:{sheetLeaf:item.id,span:'1'},style:{},offsetHeight:item.height,getBoundingClientRect(){return {left:10+(parseFloat(this.style.left)||0),top:20+(parseFloat(this.style.top)||0),width:parseFloat(this.style.width)||292,height:this.offsetHeight};},animate(){animations++;return {cancel(){cancelled++;}};}}));
 const container={querySelectorAll:()=>nodes,classList:{add(){}},style:{},getBoundingClientRect(){return {left:10,top:20,width,height:parseFloat(this.style.height)||600};}};
 const packing=createSheetPacking(container,{settings:()=>({columns:3,gap:12}),reducedMotion:()=>motion,viewportWidth:()=>viewport});
 return {packing,nodes,container,setSize(w,v){width=w;viewport=v;},get animations(){return animations;},get cancelled(){return cancelled;}};
}
test('prévia anima vizinhos antes de confirmar e cancelar restaura a composição',()=>{
 const f=fixture(),before=structuredClone(f.packing.layout);f.packing.begin();
 const order=f.packing.preview('last',460,160);assert.equal(order[3],'last');assert.ok(f.animations>0);assert.notDeepEqual(f.packing.layout,before);
 f.packing.cancel();assert.deepEqual(f.packing.layout,before);
 f.packing.begin();f.packing.preview('last',460,160);assert.equal(f.packing.finish()[3],'last');
 f.packing.dispose();assert.ok(f.cancelled>0);
});
test('refluxo acompanha alturas e telas menores; movimento reduzido não anima',()=>{
 const f=fixture({motion:true});f.packing.begin();f.packing.preview('last',460,160);assert.equal(f.animations,0);
 f.nodes[0].offsetHeight=800;f.packing.refresh();assert.equal(f.packing.layout.height,800);
 f.setSize(700,1000);f.packing.refresh();assert.equal(f.packing.layout.columns,2);
 f.setSize(400,400);f.packing.refresh();assert.equal(f.packing.layout.columns,1);
 assert.ok(f.packing.layout.positions.every(p=>p.x===0&&p.width===400));
 assert.equal(f.packing.preview('last',-100,200),null);f.packing.dispose();
});
