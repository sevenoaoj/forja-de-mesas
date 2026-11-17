import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {newCampaign,sheetFields} from '../model.mjs';
import {defaultSheetAppearance,sheetAppearance,validateSheetAppearance,sheetResourceStyle} from '../sheet-layout.mjs';
import {resourceStatus,renderSheetResource,sheetColorsForm,sheetColorsPayload,createResourceAnimations} from '../public/sheet-resources.mjs';

function fixture(){
 const state=newCampaign('Recursos',true),character=state.characters[0],field=sheetFields(state,character).find(field=>field.type==='counter');
 return {state,character,field};
}

test('cores e alertas são independentes por recurso, compatíveis com fichas antigas e removem campos excluídos',()=>{
 const {state,character,field}=fixture(),before=structuredClone(character);
 assert.deepEqual(sheetResourceStyle(character,field),{color:'#6ee7b7',critical:true,criticalAt:25});
 const appearance=defaultSheetAppearance(state,character);
 appearance.options.resources={[field.id]:{color:'#12ABEF',critical:false,criticalAt:15}};
 character.appearance=validateSheetAppearance(appearance,state,character);
 assert.equal(sheetResourceStyle(character,field).color,'#12abef');
 assert.equal(sheetResourceStyle(character,{id:'another'}).color,'#6ee7b7');
 assert.deepEqual(character.values,before.values);
 character.layout=sheetFields(state,character).filter(item=>item.id!==field.id);
 assert.deepEqual(sheetAppearance(state,character).options.resources,{});
});

test('validação recusa CSS injetado, campos alheios e limites críticos inválidos',()=>{
 const {state,character,field}=fixture(),appearance=defaultSheetAppearance(state,character);
 const valid={color:'#112233',critical:true,criticalAt:25};
 for(const style of [null,[],{...valid,color:'red;display:none'},{...valid,critical:'true'},{...valid,criticalAt:101},{...valid,criticalAt:-1},{...valid,criticalAt:NaN},{...valid,criticalAt:2.5}]){
  assert.throws(()=>validateSheetAppearance({...appearance,options:{...appearance.options,resources:{[field.id]:style}}},state,character),error=>error.status===400);
 }
 for(const resources of [[],null,{'unknown':valid}])assert.throws(()=>validateSheetAppearance({...appearance,options:{...appearance.options,resources}},state,character),error=>error.status===400);
});

test('estado crítico inclui vazio e o limite exato, nunca máximo zero, e pode ser desativado',()=>{
 const style={critical:true,criticalAt:25};
 for(const value of ['0/40','10/40'])assert.equal(resourceStatus(value,style).critical,true);
 for(const value of ['11/40','0/0','8','abc/40'])assert.equal(resourceStatus(value,style).critical,false);
 assert.equal(resourceStatus('1/40',{...style,critical:false}).critical,false);
 assert.equal(resourceStatus('1/40',{...style,criticalAt:0}).critical,false);
 assert.equal(resourceStatus('0/40',{...style,criticalAt:0}).critical,true);
 assert.equal(resourceStatus('50/40',style).ratio,1);
});

test('formulário usa pickers nativos e salva cores mantendo organização, dados e versão',()=>{
 const {state,character,field}=fixture();character.appearance=defaultSheetAppearance(state,character);
 const html=sheetColorsForm(state,character);
 assert.match(html,/type="color" name="accent"/);assert.ok(html.includes('resource-color:'+field.id));assert.match(html,/Limite crítico/);
 const data={accent:'#aa55cc',expectedVersion:'0'};
 for(const item of sheetFields(state,character).filter(item=>item.type==='counter')){
  data['resource-color:'+item.id]='#3377ff';data['resource-critical:'+item.id]='on';data['resource-critical-at:'+item.id]='20';
 }
 const payload=sheetColorsPayload(state,character,data);
 assert.deepEqual(payload.appearance.tree,character.appearance.tree);assert.equal(payload.expectedVersion,0);
 assert.equal(payload.appearance.options.resources[field.id].criticalAt,20);
 assert.equal(character.appearance.options.accent===data.accent,false);
 const resource=renderSheetResource(character,{...field,label:'<Recurso>'},'1/40',{inline:content=>content,step:()=>''});
 assert.ok(resource.includes('&lt;Recurso&gt;'));assert.ok(resource.includes('is-critical'));assert.ok(resource.includes('Crítico'));assert.ok(resource.includes('resource-fill'));
});

test('animação continua do frame atual ao recriar DOM e respeita movimento reduzido',()=>{
 const calls=[];
 const resource=(key,transform)=>({dataset:{sheetResource:key},querySelector:()=>({transform,animate:(...args)=>calls.push(args)})});
 const root=nodes=>({querySelectorAll:()=>nodes});
 const animations=createResourceAnimations({getStyle:node=>({transform:node.transform}),reducedMotion:()=>false});
 const previous=animations.capture(root([resource('hero/hp','matrix(0.8,0,0,1,0,0)')]));
 animations.restore(root([resource('hero/hp','matrix(0.2,0,0,1,0,0)'),resource('other/hp','matrix(0.5,0,0,1,0,0)')]),previous);
 assert.equal(calls.length,1);assert.equal(calls[0][0][0].transform,'matrix(0.8,0,0,1,0,0)');assert.equal(calls[0][1].duration,480);
 animations.restore(root([resource('hero/hp','matrix(0.8,0,0,1,0,0)')]),previous);assert.equal(calls.length,1);
 createResourceAnimations({reducedMotion:()=>true}).restore(root([resource('hero/hp','changed')]),previous);assert.equal(calls.length,1);
});

test('API persiste cores, protege ficha alheia e recusa versão antiga sem perder layout',async()=>{
 const rows=new Map(),store={async create(row){rows.set(row.id,structuredClone(row));},async get(id){return structuredClone(rows.get(id));},async save(row){if(rows.get(row.id).rev!==row.rev)return false;rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}};
 const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)}),store);
 const master=await(await call('','POST',null,{name:'Cores',example:true})).json(),base='/'+master.id,member='c'.repeat(64);
 await call(base+'/join','POST',master.invite,{key:member});await call(base+'/action','POST',member,{action:'characterClaim',data:{id:'lyra'}});
 const character=rows.get(master.id).state.characters[0],state=rows.get(master.id).state,field=sheetFields(state,character).find(field=>field.type==='counter');
 const appearance=sheetAppearance(state,character);appearance.options.accent='#bb66dd';appearance.options.resources={[field.id]:{color:'#ff9955',critical:true,criticalAt:30}};
 const act=(id,key=member,expectedVersion=0)=>call(base+'/action','POST',key,{action:'sheetAppearance',data:{id,expectedVersion,appearance}});
 assert.equal((await act('dorian')).status,403);
 const saved=await act('lyra');assert.equal(saved.status,200);
 const own=(await saved.json()).state.characters[0];assert.deepEqual(own.appearance.options.resources,appearance.options.resources);assert.deepEqual(own.values,character.values);assert.equal(own.sheetHistory.entries.length>0,true);
 assert.equal((await act('lyra')).status,409);
 assert.equal((await act('lyra',master.invite)).status,403);
 const guest=await(await call(base,'GET',master.invite)).json();assert.equal(guest.state.characters[0].appearance,undefined);
 const loaded=await(await call(base,'GET',master.key)).json();assert.equal(loaded.state.characters[0].appearance.options.accent,'#bb66dd');
});
