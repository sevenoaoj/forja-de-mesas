import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {newCampaign,sheetFields,resolveSheetFormula,displaySheetFormula,parseDiceFormula} from '../model.mjs';

async function room() {
  const rows=new Map();
  const store={
    async create(row){rows.set(row.id,structuredClone(row));},
    async get(id){return structuredClone(rows.get(id));},
    async save(row){await Promise.resolve();if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}
  };
  const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
  const created=await(await call('','POST',null,{name:'Fichas',example:true})).json();
  const member='a'.repeat(64);
  await call('/'+created.id+'/join','POST',created.invite,{key:member});
  const act=(action,data,master=false)=>call('/'+created.id+'/action','POST',master?created.key:member,{action,data});
  await act('characterClaim',{id:'lyra'});
  return {act,rows,id:created.id,view:async(master=false)=>(await call('/'+created.id,'GET',master?created.key:member)).json()};
}
const local=(digit,label,type='number',initial='0',group='Atributos')=>({id:'local-'+digit.repeat(32),label,type,initial,group});

// Values are substituted without evaluating code, and IDs keep links stable after renaming.
test('expressões vinculam nomes e IDs, acompanham mudanças e aceitam atributos negativos',()=>{
  const state=newCampaign('Teste',true),character=state.characters[0];
  let result=resolveSheetFormula('2d6 + forca - Agilidade',state,character);
  assert.equal(result.formula,'2d6+1-3');
  assert.equal(result.template,'2d6+@{f1}-@{f2}');
  character.values.f1='-2';
  result=resolveSheetFormula(result.template,state,character);
  assert.equal(result.formula,'2d6-2-3');
  assert.equal(resolveSheetFormula('1d20 - @{f1}',state,character).formula,'1d20+2');
  state.fields[0].label='Vigor';
  assert.equal(displaySheetFormula(result.template,state,character),'2d6+Vigor-Agilidade');
  assert.equal(resolveSheetFormula('1d7+Vitalidade',state,character).formula,'1d7+18');
  assert.deepEqual(parseDiceFormula('2d6+1d10-3').terms,[{sign:1,count:2,faces:6},{sign:1,count:1,faces:10}]);
  for(const value of ['0d6','51d6','1d1','1d1001','2d6+eval(1)','2d6+Inexistente','2d6*Força']) assert.throws(()=>resolveSheetFormula(value,state,character),error=>error.status===400);
  assert.throws(()=>resolveSheetFormula('2d6+Vigor',state,null),/Escolha uma ficha/);
  character.values.f1='1.5';
  assert.throws(()=>resolveSheetFormula('2d6+Vigor',state,character),/inteiro/);
  character.layout=[{...state.fields[0],initial:'0'},{...state.fields[0],id:'different',initial:'2'}];
  assert.throws(()=>resolveSheetFormula('2d6+Vigor',state,character),/mesmo nome/);
});

test('estrutura própria pode remover atributos herdados, ordenar seções e adicionar múltiplos recursos',async()=>{
  const r=await room(),before=await r.view(true);
  const a=local('1','Intelecto','number','4');
  const mana=local('2','Mana','counter','8/12','Recursos');
  const stamina=local('3','Fôlego','counter','5/5','Recursos');
  const layout=[mana,a,stamina,...before.state.fields.filter(field=>!['f1','f2'].includes(field.id))];
  let response=await r.act('sheetFields',{id:'lyra',layout:true,fields:layout});
  assert.equal(response.status,200);
  let view=await response.json(),own=view.state.characters.find(c=>c.id==='lyra');
  assert.deepEqual(sheetFields(view.state,own).map(f=>f.id),layout.map(f=>f.id));
  assert.equal(sheetFields(view.state,own).filter(f=>f.type==='counter').length,3);
  assert.equal(own.values.f1,undefined);
  assert.equal(view.state.fields.length,before.state.fields.length);
  assert.equal(view.state.characters.find(c=>c.id==='dorian').layout,undefined);
  response=await r.act('sheetCounter',{id:'lyra',field:mana.id,step:-1});
  assert.equal(response.status,200);
  own=(await response.json()).state.characters.find(c=>c.id==='lyra');
  assert.equal(own.values[mana.id],'7/12');
  await r.act('sheetCounter',{id:'lyra',field:stamina.id,current:2,maximum:20});
  own=(await r.view()).state.characters.find(c=>c.id==='lyra');
  assert.equal(own.values[stamina.id],'2/20');
  assert.equal(own.values[mana.id],'7/12');
  assert.equal((await r.act('sheetCounter',{id:'lyra',field:mana.id,current:13,maximum:12})).status,400);
  assert.equal((await r.act('sheetFields',{id:'dorian',layout:true,fields:[]})).status,403);
  assert.equal((await r.act('sheetFields',{id:'lyra',layout:true,fields:[a,a]})).status,400);
  await r.act('schema',{fields:[{id:'new-model',label:'Modelo novo',group:'Geral',type:'text',initial:''}]},true);
  view=await r.view();own=view.state.characters.find(c=>c.id==='lyra');
  assert.equal(sheetFields(view.state,own).length,layout.length);
  assert.equal(sheetFields(view.state,view.state.characters.find(c=>c.id==='dorian')).length,1);
});

test('rolagem salva consulta o atributo atual no servidor e mantém o vínculo após renomear',async()=>{
  const r=await room();
  let response=await r.act('sheetEntry',{id:'lyra',category:'rollButtons',operation:'save',name:'Ataque',formula:'2d6 + Força'});
  assert.equal(response.status,200);
  let view=await response.json(),own=view.state.characters.find(c=>c.id==='lyra');
  const saved=own.rollButtons[0];
  assert.equal(saved.formula,'2d6+@{f1}');
  await r.act('character',{id:'lyra',name:'Lyra',values:{f1:'7'}});
  response=await r.act('roll',{characterId:'lyra',rollId:saved.id,formula:'99d1000'});
  assert.equal(response.status,200);
  view=await response.json();
  assert.equal(view.state.rolls[0].formula,'2d6+7');
  assert.equal(view.state.rolls[0].label,'Ataque');
  assert.equal(view.state.rolls[0].modifier,7);
  assert.ok(view.state.rolls[0].total>=9&&view.state.rolls[0].total<=19);
  const layout=sheetFields(view.state,view.state.characters.find(c=>c.id==='lyra')).map(field=>field.id==='f1'?{...field,label:'Potência'}:field);
  await r.act('sheetFields',{id:'lyra',layout:true,fields:layout});
  response=await r.act('roll',{rollId:saved.id});
  assert.equal(response.status,200);
  view=await response.json();
  assert.equal(view.state.rolls[0].expression,'2d6+Potência');
  assert.equal((await r.act('roll',{characterId:'dorian',rollId:saved.id})).status,403);
  assert.equal((await r.act('sheetEntry',{id:'dorian',category:'rollButtons',operation:'save',name:'Invadir',formula:'1d6'})).status,403);
  assert.equal((await r.act('sheetEntry',{id:'lyra',category:'rollButtons',operation:'save',name:'Erro',formula:'1d20+inexistente'})).status,400);
  await r.act('sheetFields',{id:'lyra',layout:true,fields:layout.filter(f=>f.id!=='f1')});
  const count=(await r.view()).state.rolls.length;
  assert.equal((await r.act('roll',{rollId:saved.id})).status,400);
  assert.equal((await r.view()).state.rolls.length,count);
});

test('fichas legadas mantêm seus campos e rolagens numéricas continuam funcionando',async()=>{
  const state=newCampaign('Teste',true),character=state.characters[0];
  character.fields=[local('a','Defesa','number','10')];
  assert.equal(sheetFields(state,character).length,state.fields.length+1);
  const r=await room();
  let response=await r.act('sheetFields',{id:'lyra',fields:[local('b','Sorte','number','3')]});
  assert.equal(response.status,200);
  const view=await response.json(),own=view.state.characters.find(c=>c.id==='lyra');
  assert.equal(sheetFields(view.state,own).length,view.state.fields.length+1);
  assert.equal((await r.act('roll',{formula:'1d20+1d10-2'})).status,200);
  assert.equal((await r.act('sheetCounter',{id:'lyra',field:'f4',step:-1})).status,200);
  assert.equal((await r.act('sheetFields',{id:'lyra',layout:true,fields:[]})).status,200);
  const empty=await r.view();
  assert.deepEqual(sheetFields(empty.state,empty.state.characters.find(c=>c.id==='lyra')),[]);
});

async function heir(r) {
  await r.act('characterRelease',{id:'lyra'},true);
  const response=await r.act('character',{preset:'herdeiros-destino',name:'Anuki',concept:'Dobrador de água',color:'rose',values:{'hd-age':'22','hd-bending':'Água (sangue)','hd-power':'2','hd-cunning':'0','hd-essence':'1'}});
  assert.equal(response.status,200);
  const row=await response.json();
  return row.state.characters.find(c=>c.id===row.characterId);
}

test('modelo Herdeiros usa os painéis originais com estrutura independente e três testes sem alterar fichas existentes',async()=>{
  const r=await room(),anuki=await heir(r);
  assert.equal(anuki.presentation,undefined);
  assert.equal(anuki.layout.filter(f=>f.group==='Atributos').length,3);
  assert.equal(anuki.values['hd-age'],'22');
  assert.equal(anuki.values['hd-power'],'2');
  assert.equal(anuki.values['hd-cunning'],'0');
  assert.equal(anuki.values['hd-essence'],'1');
  assert.ok(!Object.hasOwn(anuki.values,'f1'));
  assert.equal(anuki.rollButtons.length,3);
  assert.equal(anuki.masteries[0].remaining,1);
  const view=await r.view(true);
  assert.equal(view.state.characters.find(c=>c.id==='dorian').layout,undefined);
  assert.equal((await r.act('roll',{characterId:anuki.id,rollId:'hd-test-cunning'})).status,200);
  assert.equal((await r.view()).state.characters.find(c=>c.id===anuki.id).masteries[0].remaining,1);
  const stored=r.rows.get(r.id);
  const legacy=stored.state.characters.find(c=>c.id===anuki.id);
  legacy.presentation='narrative';
  legacy.values['hd-story']='História preservada';
  legacy.values['hd-equipment']='Itens preservados';
  const visible=(await r.view()).state.characters.find(c=>c.id===anuki.id);
  assert.equal(visible.presentation,undefined);
  assert.equal(visible.values['hd-story'],'História preservada');
  assert.equal((await r.act('character',{id:anuki.id,name:'Anuki',presentation:'narrative'})).status,200);
  const updated=(await r.view()).state.characters.find(c=>c.id===anuki.id);
  assert.equal(updated.presentation,undefined);
  assert.equal(updated.values['hd-story'],'História preservada');
  assert.equal(updated.values['hd-equipment'],'Itens preservados');
  assert.equal(updated.masteries[0].remaining,1);
  assert.equal(updated.values['hd-power'],'2');
});

test('maestria acrescenta 1d4 apenas à Essência, consome um uso e somente o mestre renova',async()=>{
  const r=await room(),anuki=await heir(r);
  const masteryId='hd-mastery';
  assert.equal((await r.act('roll',{rollId:'hd-test-power',masteryId})).status,400);
  assert.equal((await r.act('roll',{formula:'2d6+@{hd-essence}+51d6',masteryId})).status,400);
  assert.equal((await r.view()).state.characters.find(c=>c.id===anuki.id).masteries[0].remaining,1);
  let response=await r.act('roll',{rollId:'hd-test-essence',masteryId});
  assert.equal(response.status,200);
  let view=await response.json();
  assert.equal(view.state.rolls[0].formula,'2d6+1+1d4');
  assert.equal(view.state.rolls[0].mastery.die,'1d4');
  assert.deepEqual(view.state.rolls[0].groups.map(group=>group.faces),[6,4]);
  assert.equal(view.state.characters.find(c=>c.id===anuki.id).masteries[0].remaining,0);
  assert.equal((await r.act('roll',{rollId:'hd-test-essence',masteryId})).status,409);
  assert.equal((await r.act('sheetMasteryRefresh',{id:anuki.id})).status,403);
  await r.act('character',{id:anuki.id,name:'Anuki',masteries:[{id:masteryId,remaining:1}]});
  await r.act('sheetMastery',{id:anuki.id,masteryId,name:'Essência treinada',attributeId:'hd-essence',die:'1d6',remaining:1});
  assert.equal((await r.view()).state.characters.find(c=>c.id===anuki.id).masteries[0].remaining,0);
  assert.equal((await r.act('sheetMastery',{id:'dorian',masteryId,attributeId:'f1',die:'1d4'})).status,403);
  assert.equal((await r.act('sheetMastery',{id:anuki.id,masteryId,attributeId:'hd-essence',die:'2d6'})).status,400);
  assert.equal((await r.act('sheetMasteryRefresh',{},true)).status,200);
  view=await r.view();
  assert.equal(view.state.characters.find(c=>c.id===anuki.id).masteries[0].remaining,1);
});

test('duas rolagens concorrentes não gastam a mesma maestria duas vezes',async()=>{
  const r=await room();await heir(r);
  const responses=await Promise.all([r.act('roll',{rollId:'hd-test-essence',masteryId:'hd-mastery'}),r.act('roll',{rollId:'hd-test-essence',masteryId:'hd-mastery'})]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  const view=await r.view();
  assert.equal(view.state.rolls.filter(roll=>roll.mastery).length,1);
  assert.equal(view.state.characters.find(c=>c.id===view.characterId).masteries[0].remaining,0);
});
