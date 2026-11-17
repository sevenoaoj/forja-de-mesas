import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFogStrokes} from '../fog-geometry.mjs';
import {normalizeTable,tokenVisible,tableView} from '../table-model.mjs';
test('névoa é independente da visibilidade e só hidden do mestre retira tokens',()=>{
 const state={characters:[],tokens:[{id:'visible',name:'Visível',x:4.2,y:4.3,size:2},{id:'hidden',name:'Oculto',x:4,y:4,hidden:true}],table:{fog:{enabled:true,revealed:[],strokes:[{kind:'brush',operation:'hide',radius:1,points:[{x:4,y:4}]}]}}};
 const table=normalizeTable(state);assert.equal(tokenVisible(state.tokens[0],table),true);assert.equal(tokenVisible(state.tokens[1],table),false);
 assert.deepEqual(tableView(state,false).tokens.map(t=>t.id),['visible']);assert.deepEqual(tableView(state,true).tokens.map(t=>t.id),['visible','hidden']);
});
test('normalização preserva ordem e frações dos traços sem alterar dados de origem',()=>{
 const strokes=[{id:'a',kind:'brush',operation:'reveal',radius:.25,points:[{x:1.25,y:2.75}]},{id:'b',kind:'rectangle',operation:'hide',x:1,y:2,width:3,height:4}],before=structuredClone(strokes);
 assert.deepEqual(normalizeFogStrokes(strokes,{columns:16,rows:10}),before);assert.deepEqual(strokes,before);
 assert.deepEqual(normalizeFogStrokes([{kind:'invalid',operation:'hide'}],{columns:16,rows:10}),[]);
});
