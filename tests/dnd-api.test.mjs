import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {dndCharacter,dndClasses,dndSkills,dndDerived,dndSpellFormula,dndCatalog} from '../dnd.mjs';
import {sheetValue,skillValues,resolveSheetFormula,parseDiceFormula} from '../model.mjs';
const config=(classId='wizard')=>{
 const cls=dndClasses.find(c=>c.id===classId),bg=classId==='wizard'?'sage':'soldier';
 const backgroundSkills=bg==='sage'?['arcana','history']:['athletics','intimidation'];
 const skills=cls.skills.filter(id=>!backgroundSkills.includes(id)).slice(0,cls.count);
 return {classId,speciesId:'dwarf',backgroundId:bg,scoreMethod:'array',scores:Object.fromEntries(['str','dex','con','int','wis','cha'].map((id,i)=>[id,cls.array[i]])),boost2:bg==='sage'?'int':'str',boost1:bg==='sage'?'wis':'con',skills,expertise:classId==='rogue'?skills.slice(0,2):[]};
};
async function room() {
 const rows=new Map();
 const store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){await Promise.resolve();if(rows.get(row.id)?.rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const call=(path,method,key,body)=>api(new Request('http://local/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await call('','POST',null,{name:'D&D',ruleset:'dnd-2024'})).json();
 const act=(action,data,master=true)=>call('/'+created.id+'/action','POST',master?created.key:'a'.repeat(64),{action,data});
 const view=async()=>(await call('/'+created.id,'GET',created.key)).json();
 return {created,act,view,call};
}
test('12 classes criam personagens válidos de nível 1 com modificadores, perícias e recursos',()=>{
 for(const cls of dndClasses){
  const character=dndCharacter(config(cls.id));
  assert.equal(character.layout.filter(f=>f.group==='Atributos').length,6);
  assert.equal(character.skills.length,18);
  assert.equal(dndDerived(character,'dd-prof'),'2');
  assert.equal(character.rollButtons.length,13);
  assert.ok(Number(character.values['dd-hp'].split('/')[0])>0);
 }
 const wizard=dndCharacter(config());
 assert.equal(wizard.values['dd-int'],'17');
 assert.equal(wizard.values['dd-hp'],'8/8');
 assert.equal(dndDerived(wizard,'dd-dc'),'13');
 assert.equal(dndDerived(wizard,'dd-spell-attack'),'5');
 const state={fields:[]};
 assert.equal(resolveSheetFormula('1d20+@{dd-int|mod}+@{dd-prof}',state,wizard).formula,'1d20+3+2');
 assert.equal(resolveSheetFormula('1d20+Inteligência',state,wizard).formula,'1d20+3');
 assert.equal(resolveSheetFormula('1d20+@{dd-int|score}',state,wizard).formula,'1d20+17');
 assert.equal(skillValues(wizard,wizard.skills.find(s=>s.id==='arcana'),state).total,5);
 wizard.values['dd-level']='5';
 assert.equal(sheetValue(wizard,wizard.layout.find(f=>f.id==='dd-prof')),'3');
 assert.equal(skillValues(wizard,wizard.skills.find(s=>s.id==='arcana'),state).total,6);
 assert.equal(dndSpellFormula(wizard,dndCatalog.find(s=>s.id==='spell-fire-bolt')),'2d10');
});
test('criação rejeita sequência, bônus e proficiências inválidos sem criar fichas',async()=>{
 const r=await room();
 for(const options of [{scores:{...config().scores,int:14}},{boost2:'str'},{skills:['arcana','history']},{classId:'unknown'}]){
  assert.equal((await r.act('character',{name:'Inválida',dnd:{...config(),...options}})).status,400);
 }
 assert.equal((await r.view()).state.characters.length,0);
 const three=dndCharacter({...config(),boostMode:'three',boost2:undefined,boost1:undefined});
 assert.equal(three.values['dd-int'],'16');
});
test('ataques, vantagem, magia e descanso usam valores do servidor e recursos atuais',async()=>{
 const r=await room();
 let response=await r.act('character',{name:'Maga',dnd:config()});
 assert.equal(response.status,200);
 let row=await response.json(),character=row.state.characters[0];
 const id=character.id;
 assert.equal(character.values['dd-int'],'17');
 await r.act('dndAdd',{id,entryId:'spell-fire-bolt'});
 response=await r.act('roll',{characterId:id,rollId:'spell-fire-bolt-attack',mode:'advantage'});
 assert.equal(response.status,200);row=await response.json();
 assert.equal(row.state.rolls[0].formula,'2d20kh1+5');
 const roll=row.state.rolls[0],group=roll.groups[0];
 assert.equal(group.kept[0],Math.max(...group.dice));
 assert.equal(roll.total,Math.max(...group.dice)+5);
 await r.act('dndAdd',{id,entryId:'spell-cure-wounds',allowExtra:true});
 response=await r.act('dndCast',{id,entryId:'spell-cure-wounds',allowExtra:true});
 assert.equal(response.status,200);row=await response.json();
 assert.equal(row.state.characters[0].values['dd-slot-1'],'1/2');
 assert.equal(row.state.rolls[0].formula,'2d8+3');
 await r.act('dndCast',{id,entryId:'spell-cure-wounds',allowExtra:true});
 assert.equal((await r.act('dndCast',{id,entryId:'spell-cure-wounds',allowExtra:true})).status,409);
 await r.act('dndRest',{id,kind:'short'});
 assert.equal((await r.view()).state.characters[0].values['dd-slot-1'],'0/2');
 await r.act('dndRest',{id,kind:'long'});
 assert.equal((await r.view()).state.characters[0].values['dd-slot-1'],'2/2');
 assert.equal((await r.act('dndRest',{id,kind:'bad'})).status,400);
 await r.act('character',{id,name:'Maga',values:{'dd-int':'18'}});
 await r.act('roll',{characterId:id,rollId:'spell-fire-bolt-attack',mode:'disadvantage'});
 row=await r.view();assert.equal(row.state.rolls[0].formula,'2d20kl1+6');
 assert.equal(row.state.rolls[0].groups[0].kept[0],Math.min(...row.state.rolls[0].groups[0].dice));
 assert.equal((await r.act('roll',{characterId:id,rollId:'spell-fire-bolt-effect',mode:'advantage'})).status,400);
});
test('dois lançamentos disputam o último espaço sem consumir ou publicar duas vezes',async()=>{
 const r=await room();let row=await(await r.act('character',{name:'Maga',dnd:config()})).json();const id=row.state.characters[0].id;
 await r.act('dndAdd',{id,entryId:'spell-cure-wounds',allowExtra:true});
 await r.act('sheetCounter',{id,field:'dd-slot-1',current:1,maximum:2});
 const responses=await Promise.all([r.act('dndCast',{id,entryId:'spell-cure-wounds',allowExtra:true}),r.act('dndCast',{id,entryId:'spell-cure-wounds',allowExtra:true})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 row=await r.view();assert.equal(row.state.rolls.length,1);assert.equal(row.state.characters[0].values['dd-slot-1'],'0/2');
});
test('dados de retenção preservam limites e rejeitam expressões fora da gramática',()=>{
 assert.equal(parseDiceFormula('2d20kh1+3').terms[0].keep,'kh1');
 assert.equal(parseDiceFormula('2d20kl1-1').terms[0].keep,'kl1');
 for(const formula of ['1d20kh1','51d20kh1','2d20kh2','2d20;alert(1)'])assert.throws(()=>parseDiceFormula(formula));
});
