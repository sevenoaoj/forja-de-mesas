import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {newCampaign,sheetFields,resolveSheetFormula,displaySheetFormula,parseDiceFormula} from '../model.mjs';

async function room(options={}) {
  const rows=new Map();
  const store={
    async create(row){rows.set(row.id,structuredClone(row));},
    async get(id){return structuredClone(rows.get(id));},
    async save(row){await Promise.resolve();if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}
  };
  const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
  const created=await(await call('','POST',null,{name:'Fichas',example:true,...options})).json();
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

test('estresse corporal é opcional por ficha, com limites do mestre e ajustes privados do dono',async()=>{
  const r=await room(),id='lyra',limits={torso:2,leftArm:3,rightArm:3,leftLeg:3,rightLeg:3};
  const config=(enabled,master=true,custom=limits)=>r.act('bodyStressConfig',{id,enabled,limits:custom},master);
  const step=(region,delta,target=id)=>r.act('bodyStressStep',{id:target,region,step:delta});
  const read=async()=>(await r.view()).state.characters.find(c=>c.id===id).bodyStress;
  assert.equal(await read(),undefined);
  assert.equal((await step('torso',1)).status,409);
  assert.equal((await config(true,false)).status,403);
  assert.equal((await config(true,true,{...limits,leftLeg:0})).status,400);
  assert.equal((await config(true)).status,200);
  assert.equal((await step('torso',1,'dorian')).status,403);
  assert.equal((await step('torso',-1)).status,409);
  for(const res of await Promise.all([step('torso',1),step('torso',1)]))assert.equal(res.status,200);
  assert.deepEqual((await read()).regions.torso,{value:2,limit:2});
  assert.equal((await step('torso',1)).status,409);
  assert.equal((await config(true,true,{...limits,torso:1})).status,409);
  assert.equal((await config(false)).status,200);
  assert.equal((await step('torso',-1)).status,409);
  assert.equal((await config(true)).status,200);
  assert.equal((await read()).regions.torso.value,2);
  assert.equal((await step('torso',-1)).status,200);
  await r.act('bodyStressConfig',{id:'dorian',enabled:true,limits},true);
  assert.equal((await r.view()).state.characters.find(c=>c.id==='dorian').bodyStress,undefined);
});

test('modelo da campanha propaga campos e preserva valores e exceções individuais',async()=>{
  const r=await room();
  const original=(await r.view(true)).state.fields;
  const extra=local('a','Marca pessoal','text','Runa','História');
  assert.equal((await r.act('sheetFields',{id:'lyra',layout:true,fields:[...original,extra]})).status,200);
  const mana={id:'mana',label:'Mana',group:'Recursos',type:'counter',initial:'8/10'};
  const schema=(fields,expectedVersion,master=true)=>r.act('schema',{fields,expectedVersion},master);
  assert.equal((await schema([...original,mana],0,false)).status,403);
  assert.equal((await schema([...original,mana],0)).status,200);
  assert.equal((await schema(original,0)).status,409);
  assert.equal((await r.act('sheetCounter',{id:'lyra',field:'mana',step:-1})).status,200);
  assert.equal((await r.act('sheetFields',{id:'lyra',layout:true,fields:[extra]})).status,200);
  assert.equal((await schema([...original,{...mana,label:'Energia',initial:'5/5'}],1)).status,200);
  assert.equal((await r.act('character',{name:'Nova ficha'},true)).status,200);
  let state=(await r.view(true)).state;
  for(const c of state.characters){
    assert.equal(sheetFields(state,c).filter(f=>f.id==='mana'&&f.label==='Energia').length,1);
    assert.equal(sheetFields(state,c).some(f=>f.id===extra.id),c.id==='lyra');
    assert.equal(c.values.mana,c.name==='Nova ficha'?'5/5':c.id==='lyra'?'7/10':'8/10');
  }
  assert.equal((await schema(original,2)).status,200);
  state=(await r.view(true)).state;
  assert.ok(state.characters.every(c=>sheetFields(state,c).some(f=>f.id==='mana')));
  assert.ok(!state.fields.some(f=>f.id==='mana'));
});

test('jogador recebe o modelo escolhido na criação da campanha',async()=>{
  const r=await room({example:false,sheetModel:'herdeiros-destino'});
  assert.equal((await r.act('character',{name:'Alternativo',preset:'herdeiros-destino'})).status,400);
  const response=await r.act('character',{name:'Primeiro jogador'});
  assert.equal(response.status,200);
  const {state}=await response.json(),character=state.characters[0];
  assert.ok(sheetFields(state,character).some(field=>field.id==='hd-power'));
  assert.equal(character.rollButtons.length,3);
  assert.equal(character.masteries[0].attributeId,'hd-essence');
  assert.equal(state.sheetStarter,undefined);
});

test('segmentação preserva tronco legado e guarda mãos e pés ao simplificar',async()=>{
  const r=await room(),id='lyra';
  const legacy={torso:4,leftArm:3,rightArm:3,leftLeg:3,rightLeg:3};
  const sheet=r.rows.get(r.id).state.characters.find(c=>c.id===id);
  sheet.bodyStress={enabled:true,regions:Object.fromEntries(Object.entries(legacy).map(([k,limit])=>[k,{limit,value:k==='torso'?2:0}]))};
  const step=region=>r.act('bodyStressStep',{id,region,step:1});
  const simple={...legacy,head:2},complex={...simple,leftHand:2,rightHand:2,leftFoot:2,rightFoot:2};
  const config=(mode,limits,master=true)=>r.act('bodyStressConfig',{id,enabled:true,mode,limits},master);
  assert.equal((await step('head')).status,200);
  assert.equal((await config('complex',complex,false)).status,403);
  assert.equal((await config('complex',complex)).status,200);
  assert.equal((await step('leftHand')).status,200);
  assert.equal((await step('rightFoot')).status,200);
  assert.equal((await config('simple',simple)).status,200);
  assert.equal((await step('rightFoot')).status,400);
  const view=await(await config('complex',complex)).json();
  const {regions}=view.state.characters.find(c=>c.id===id).bodyStress;
  assert.equal(regions.head.value,1);
  assert.equal(regions.torso.value,2);
  assert.equal(regions.leftHand.value,1);
  assert.equal(regions.rightFoot.value,1);
  assert.equal(regions.rightLeg.value,0);
});

test('recurso privado permanece exclusivo do mestre durante todo o ciclo da ficha',async()=>{
  const r=await room();
  const change=(data,master=true)=>r.act('gmResourceChange',{id:'lyra',...data},master);
  const draft={operation:'save',name:'Vínculo secreto',current:9,maximum:12,color:'#893b91'};
  assert.equal((await change(draft,false)).status,403);
  const created=await change(draft);
  assert.equal(created.status,200);
  const [resource]=(await created.json()).state.gmResources.lyra;
  const key={resourceId:resource.id,version:resource.version};
  for(const data of [{...draft,...key},{...key,operation:'step',step:-1},{...key,operation:'delete'}]){
    assert.equal((await change(data,false)).status,403);
  }
  assert.equal((await r.act('sheetCounter',{id:'lyra',field:resource.id,step:-1})).status,400);
  const edited=await r.act('character',{id:'lyra',name:'Lyra',gmResources:[]});
  assert.equal(edited.status,200);
  for(const player of [await r.view(),await edited.json()]){
    assert.equal(Object.hasOwn(player.state,'gmResources'),false);
    assert.ok(!JSON.stringify(player).includes(resource.id));
    assert.ok(!JSON.stringify(player).includes(draft.name));
  }
  assert.equal((await change({...key,operation:'step',step:-1})).status,200);
  assert.equal((await change({...key,...draft})).status,409);
  let [updated]=(await r.view(true)).state.gmResources.lyra;
  assert.equal(updated.current,8);
  assert.equal((await change({...key,...draft,version:updated.version,current:13})).status,400);
  assert.equal((await change({...key,...draft,version:updated.version,name:'Outro nome'})).status,200);
  [updated]=(await r.view(true)).state.gmResources.lyra;
  assert.equal((await change({...key,version:updated.version,operation:'delete'})).status,200);
  assert.deepEqual((await r.view(true)).state.gmResources.lyra,[]);
});

test('retrato de pouca vida usa o contador escolhido e retorna ao original após a cura',async()=>{
 const r=await room(),state=r.rows.get(r.id).state,c=state.characters.find(c=>c.id==='lyra');
 const hp=sheetFields(state,c).find(f=>f.type==='counter');
 c.portrait={id:'normal'};c.injury={resource:hp.id,threshold:25,image:{id:'ferido'}};
 const portrait=async()=>{const {state}=await r.view();return [state.characters.find(c=>c.id==='lyra').portrait.id,state.tokens.find(t=>t.characterId==='lyra').linkedPortrait];};
 for(const [current,maximum,id] of [[6,20,'normal'],[5,20,'ferido'],[0,20,'ferido'],[6,20,'normal']]){
   assert.equal((await r.act('sheetCounter',{id:c.id,field:hp.id,current,maximum})).status,200);
   assert.deepEqual(await portrait(),[id,id]);
 }
 assert.equal((await r.act('injurySettings',{id:'dorian',remove:true})).status,403);
 assert.equal((await r.act('injurySettings',{id:c.id,resource:hp.id,threshold:101})).status,400);
 assert.equal((await r.act('injurySettings',{id:c.id,resource:hp.id,threshold:30})).status,200);
 assert.deepEqual(await portrait(),['ferido','ferido']);
});
