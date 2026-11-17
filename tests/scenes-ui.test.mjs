import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSceneManager,renderSceneCards} from '../public/scenes.mjs';
const row={master:true,state:{sceneId:'prep',sceneLibrary:{version:1,activeId:'live',sessions:[{id:'s1',name:'Sessão 1',date:'2026-11-15'},{id:'s2',name:'Sessão 2',date:''}],scenes:[{id:'live',name:'Praça',sessionId:'s1',notes:'',map:null,tokenCount:3},{id:'prep',name:'Cripta secreta',sessionId:'s2',notes:'Pista & <perigo>',map:{id:'secret-map',width:1400,height:700},tokenCount:2},{id:'other',name:'Torre',sessionId:'s2',notes:'Espírito ancestral',map:null,tokenCount:0}]}}};
test('organizador distingue preparação privada da cena pública e oferece ações explícitas',()=>{
 const html=renderSceneManager(row,{open:true,session:'all'});assert.ok(html.includes('Preparação privada · jogadores continuam em Praça'));assert.ok(html.includes('Mostrar esta cena à mesa'));assert.ok(html.includes('Na mesa dos jogadores'));assert.ok(html.includes('Aberta pelo mestre'));assert.ok(html.includes('data-scene-map="secret-map"'));assert.ok(html.includes('Pista &amp; &lt;perigo&gt;'));assert.ok(!html.includes('Pista & <perigo>'));
 assert.ok(html.includes('Nova sessão'));assert.ok(html.includes('Nova cena'));assert.ok(html.includes('15/11/2026'));assert.ok(html.includes('sceneShift'));assert.equal(renderSceneManager({...row,master:false},{open:true}),'');
});
test('filtro combina sessão e busca sem acentos sem revelar outra categoria',()=>{
 const filtered=renderSceneCards(row,{session:'s2',query:'espirito'});assert.ok(filtered.includes('Torre'));assert.ok(!filtered.includes('Cripta secreta'));assert.ok(!filtered.includes('Praça'));assert.ok(!filtered.includes('Sessão 1'));
 const empty=renderSceneCards(row,{query:'inexistente'});assert.ok(empty.includes('Nenhuma cena encontrada'));
});
test('organizador recolhido mantém contexto sem renderizar miniaturas ou notas',()=>{
 const html=renderSceneManager(row,{open:false});assert.ok(html.includes('Cripta secreta'));assert.ok(html.includes('aria-expanded="false"'));assert.ok(!html.includes('data-scene-map'));assert.ok(!html.includes('Pista'));assert.ok(!html.includes('scene-manager-body'));
});
