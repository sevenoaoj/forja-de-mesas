import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {newCampaign,sheetPreset,sheetTestAttributes,sheetAttributeTest,sheetSkillTest,sheetSavedRollFormula,resolveSheetFormula} from '../model.mjs';
import {dndCharacter,dndAdd} from '../dnd.mjs';
import {renderTableRollPanel,renderTableRollContent,renderFreeRollPreview,tableRollPreview} from '../public/table-rolls.mjs';
const wizard=()=>({id:'mage',name:'Maga',...dndCharacter({classId:'wizard',speciesId:'human',backgroundId:'sage',scoreMethod:'array',scores:{str:8,dex:12,con:13,int:15,wis:14,cha:10},boost2:'int',boost1:'wis',skills:['insight','investigation']})});
const view={tab:'tests',query:'',base:'1d20',formula:'1d20',mode:'normal',masteryId:''};
async function room(character=wizard()){
 const rows=new Map(),store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const request=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const created=await(await request('','POST',null,{name:'Dados da ficha'})).json();rows.get(created.id).state.characters=[character,{...wizard(),id:'other',name:'Outra ficha'}];
 const member='d'.repeat(64);await request('/'+created.id+'/join','POST',created.invite,{key:member});await request('/'+created.id+'/action','POST',member,{action:'characterClaim',data:{id:character.id}});
 const action=(data,key=member)=>request('/'+created.id+'/action','POST',key,{action:'roll',data});
 return {rows,created,member,action};
}
test('D&D separa atributos testáveis de nível, deslocamento, PV temporários e proficiência',()=>{
 const character=wizard(),state=newCampaign('Teste');state.characters=[character];
 assert.deepEqual(sheetTestAttributes(state,character).map(f=>f.id),['dd-str','dd-dex','dd-con','dd-int','dd-wis','dd-cha']);
 const row={master:false,characterId:'mage',state};const html=renderTableRollPanel(row,character,[character],view);
 assert.ok(html.includes('data-table-roll-attribute="dd-str"'));assert.ok(html.includes('Pontuação 8'));assert.ok(html.includes('<strong>-1</strong>'));
 for(const field of ['dd-level','dd-speed','dd-temp','dd-prof','dd-ac'])assert.ok(!html.includes('data-table-roll-attribute="'+field+'"'));
 assert.ok(!html.includes('Nível'));assert.ok(!html.includes('PV temporários'));assert.ok(!html.includes('Deslocamento (pés)'));
 const resources=renderTableRollContent(row,character,{...view,tab:'resources'});assert.ok(resources.includes('Nível'));assert.ok(resources.includes('PV temporários'));assert.ok(resources.includes('Deslocamento (pés)'));assert.ok(resources.includes('Pontos de Vida'));
});
test('atributos usam modificadores e perícias incluem proficiência/especialização e bônus uma única vez',()=>{
 const character=wizard(),state=newCampaign('Teste');
 const strength=sheetAttributeTest(state,character,'dd-str');assert.equal(resolveSheetFormula(strength.formula,state,character).formula,'1d20-1');
 const skill=character.skills.find(skill=>skill.id==='investigation');skill.rank=2;skill.bonus=-1;skill.other=2;
 const result=resolveSheetFormula(sheetSkillTest(state,character,skill.id).formula,state,character);
 assert.equal(result.formula,'1d20+3+3+2'); // INT +3, expertise +4 minus 1, situational +2.
 const preview=tableRollPreview(sheetSkillTest(state,character,skill.id).formula,state,character,{mode:'advantage'});
 assert.equal(preview.expression,'2d20kh1+3+3+2');
});
test('Herdeiros usa 2d6 para atributos e perícias; idade não vira teste',()=>{
 const preset=sheetPreset('herdeiros-destino'),state=newCampaign('Herdeiros');
 const character={id:'anuki',name:'Anuki',preset:preset.id,layout:preset.fields,values:{'hd-power':'-2','hd-cunning':'0','hd-essence':'1','hd-age':'22'},skills:[{id:'bend',name:'Dobra',attribute:'hd-essence',bonus:2,other:-1}],rollButtons:preset.rollButtons,masteries:preset.masteries};
 assert.deepEqual(sheetTestAttributes(state,character).map(f=>f.id),['hd-power','hd-cunning','hd-essence']);
 assert.equal(resolveSheetFormula(sheetAttributeTest(state,character,'hd-power').formula,state,character).formula,'2d6-2');
 assert.equal(resolveSheetFormula(sheetSkillTest(state,character,'bend').formula,state,character).formula,'2d6+1+2-1');
 assert.equal(resolveSheetFormula(sheetSkillTest(state,character,'bend','3d6').formula,state,character).formula,'3d6+1+2-1');
 assert.throws(()=>sheetAttributeTest(state,character,'hd-age'),error=>error.status===400);
 const valid=tableRollPreview(sheetAttributeTest(state,character,'hd-essence').formula,state,character,{masteryId:'hd-mastery',mode:'advantage'});
 assert.equal(valid.expression,'2d6+1+1d4');assert.equal(valid.d20,false);
 const other=tableRollPreview(sheetAttributeTest(state,character,'hd-power').formula,state,character,{masteryId:'hd-mastery'});assert.equal(other.mastery,undefined);
});
test('servidor calcula atributo e perícia atuais e ignora fórmula adulterada pelo cliente',async()=>{
 const r=await room();
 let reply=await r.action({attributeId:'dd-str',formula:'50d1000',characterId:'mage'});assert.equal(reply.status,200);
 let result=(await reply.json()).state.rolls[0];assert.equal(result.formula,'1d20-1');assert.equal(result.label,'Teste de Força');assert.equal(result.total,result.dice[0]-1);
 r.rows.get(r.created.id).state.characters[0].values['dd-str']='18';
 reply=await r.action({attributeId:'dd-str',characterId:'mage'});result=(await reply.json()).state.rolls[0];assert.equal(result.formula,'1d20+4');assert.equal(result.total,result.dice[0]+4);
 reply=await r.action({skillId:'investigation',characterId:'mage',formula:'1d2+999',mode:'disadvantage'});result=(await reply.json()).state.rolls[0];assert.equal(result.formula,'2d20kl1+3+2');assert.equal(result.total,Math.min(...result.dice)+5);
 for(const data of [{attributeId:'dd-level'},{attributeId:'dd-str',testDice:'2d6'},{attributeId:'dd-str',skillId:'investigation'},{skillId:'sumiu'}])assert.equal((await r.action({...data,characterId:'mage'})).status,400);
 assert.equal((await r.action({attributeId:'dd-str',characterId:'other'})).status,403);
 reply=await r.action({attributeId:'dd-str',characterId:'mage'},r.created.key);result=(await reply.json()).state.rolls[0];assert.equal(result.visibility,'gm');
});
test('servidor aplica base Herdeiros e maestria atomicamente na perícia vinculada',async()=>{
 const preset=sheetPreset('herdeiros-destino');const character={id:'anuki',name:'Anuki',preset:preset.id,layout:preset.fields,values:{'hd-essence':'1'},skills:[{id:'bend',name:'Dobra',attribute:'hd-essence',bonus:2}],rollButtons:preset.rollButtons,masteries:preset.masteries};
 const r=await room(character);let reply=await r.action({characterId:'anuki',skillId:'bend',masteryId:'hd-mastery'});assert.equal(reply.status,200);
 const row=await reply.json(),result=row.state.rolls[0];assert.equal(result.formula,'2d6+1+2+1d4');assert.equal(result.total,result.dice.reduce((a,b)=>a+b,0)+3);
 assert.equal(row.state.characters[0].masteries[0].remaining,0);
 assert.equal((await r.action({characterId:'anuki',skillId:'bend',masteryId:'hd-mastery'})).status,409);
});
test('prévia de truque acompanha o nível e não aplica vantagem ao dano',async()=>{
 const character=wizard(),state=newCampaign('Magia');dndAdd(character,'spell-fire-bolt');character.values['dd-level']='5';
 const button=character.rollButtons.find(button=>button.id==='spell-fire-bolt-effect');
 assert.equal(button.formula,'1d10');const formula=sheetSavedRollFormula(character,button);assert.equal(formula,'2d10');
 assert.equal(tableRollPreview(formula,state,character,{mode:'advantage'}).expression,'2d10');
 const row={master:false,state};const actions=renderTableRollContent(row,character,{...view,tab:'actions'});assert.ok(actions.includes('2d10'));assert.ok(actions.includes('sem gastar espaço'));assert.ok(actions.includes('Conjurar'));
 const r=await room(character),reply=await r.action({characterId:'mage',rollId:button.id});assert.equal(reply.status,200);assert.equal((await reply.json()).state.rolls[0].formula,'2d10');
});
test('expressão livre mostra a resolução, respeita sinais e mantém referência explícita a valores informativos',()=>{
 const character=wizard(),state=newCampaign('Livre'),row={state};
 const result=renderFreeRollPreview(row,character,{...view,formula:'1d20-@{dd-str|mod}'});assert.ok(result.includes('1d20+1'));
 const free=renderTableRollContent(row,character,{...view,tab:'free'});assert.ok(free.includes('data-table-insert-field="dd-level"'));
 const invalid=renderTableRollContent(row,character,{...view,base:'banana'});assert.ok(invalid.includes('disabled'));assert.ok(!invalid.includes('<script>'));
});
test('visibilidade configurável funciona em rolagens de ficha, maestria secreta, dndCast e painel da mesa',async()=>{
 const preset=sheetPreset('herdeiros-destino');
 const character={id:'anuki',name:'Anuki',preset:preset.id,layout:preset.fields,values:{'hd-essence':'1'},skills:[{id:'bend',name:'Dobra',attribute:'hd-essence',bonus:2}],rollButtons:preset.rollButtons,masteries:preset.masteries};
 const r=await room(character);
 let reply=await r.action({characterId:'anuki',skillId:'bend',masteryId:'hd-mastery',visibility:'gm'});
 assert.equal(reply.status,200);
 const playerView=await reply.json();
 assert.deepEqual(playerView.state.rolls,[]);
 assert.equal(playerView.state.characters[0].masteries[0].remaining,0);
 assert.equal((await r.action({characterId:'anuki',skillId:'bend',masteryId:'hd-mastery',visibility:'gm'})).status,409);
 reply=await r.action({characterId:'anuki',skillId:'bend',visibility:'public'},r.created.key);
 assert.equal(reply.status,200);
 const gmPublic=(await reply.json()).state.rolls[0];
 assert.equal(gmPublic.rolledBy,'master');assert.equal(gmPublic.visibility,'public');
 reply=await r.action({formula:'1d20+2',label:'Iniciativa',visibility:'segredo'},r.created.key);
 const gmFallback=(await reply.json()).state.rolls[0];
 assert.equal(gmFallback.visibility,'gm');assert.equal(gmFallback.label,'Iniciativa');assert.equal(gmFallback.kind,'check');
 const wiz=wizard();dndAdd(wiz,'spell-fire-bolt');
 const rw=await room(wiz),request=(path,key,body)=>api(new Request('http://app/api/campaigns/'+rw.created.id+path,{method:'POST',headers:{Authorization:'Bearer '+key},body:JSON.stringify(body)}),{async get(id){return structuredClone(rw.rows.get(id));},async save(row){if(rw.rows.get(row.id).rev!==row.rev)return false;rw.rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}});
 const gmCast=await(await request('/action',rw.created.key,{action:'dndCast',data:{id:'mage',entryId:'spell-fire-bolt',visibility:'public'}})).json();
 assert.equal(gmCast.state.rolls[0].visibility,'public');assert.equal(gmCast.state.rolls[0].rolledBy,'master');
 const playerCast=await(await request('/action',rw.member,{action:'dndCast',data:{id:'mage',entryId:'spell-fire-bolt',visibility:'gm'}})).json();
 assert.equal(playerCast.state.rolls.length,1);assert.equal(playerCast.state.rolls[0].id,gmCast.state.rolls[0].id);
 const panelGm=renderTableRollPanel({master:true,state:newCampaign('Teste')},character,[character],{...view,visibility:'gm'});
 assert.ok(panelGm.includes('data-table-roll-visibility'));assert.ok(panelGm.includes('Privada (só mestre)'));
 const panelPlayer=renderTableRollPanel({master:false,state:newCampaign('Teste')},character,[character],{...view,visibility:'public'});
 assert.ok(panelPlayer.includes('data-table-roll-visibility'));assert.ok(panelPlayer.includes('Secreta (só mestre)'));
});
