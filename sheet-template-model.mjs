import {sheetFields,parseDiceFormula,resolveSheetFormula,rollFormulaLimit} from './model.mjs';
import {sheetAppearance,validateSheetAppearance} from './sheet-layout.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const name=value=>{const result=text(value,80);if(!result)fail(400,'Informe o nome do modelo.');return result;};
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_:-]{1,60}$/.test(value);
const number=value=>{if(!Number.isFinite(Number(value))||Math.abs(Number(value))>1000000)fail(400,'Valor numérico inválido no modelo.');return String(Number(value));};
const owner=access=>access.master?'gm':access.memberId;
const mayEdit=(item,access)=>access.master||Boolean(access.memberId&&item.owner===access.memberId);
const mayRead=(item,access)=>item.shared===true||mayEdit(item,access);
export const sheetTemplateActions=new Set(['sheetTemplateSave','sheetTemplateImport','sheetTemplateUpdate','sheetTemplateDelete','sheetTemplateApply']);
const library=state=>state.sheetTemplates||{version:0,items:[]};
function characterFor(state,access,id){const c=state.characters.find(c=>c.id===id);if(!c||!access.master&&(!access.memberId||c.ownerId!==access.memberId||c.hidden))fail(403,'Você pode usar apenas sua própria ficha.');if(c.dnd)fail(400,'Use a criação guiada para fichas de D&D. Estes modelos são universais.');return c;}
export function readableSheetTemplate(state,access,id){const item=library(state).items.find(item=>item.id===id);if(!item||!mayRead(item,access))fail(403,'Modelo indisponível para este acesso.');return item;}
function entries(value,kind){
 if(value===undefined)return [];if(!Array.isArray(value)||value.length>60)fail(400,'Use até 60 itens de cada tipo no modelo.');
 const seen=new Set();return value.map(item=>{if(!item||!validId(item.id)||seen.has(item.id))fail(400,'Identificador de item inválido ou duplicado.');seen.add(item.id);return kind(item);});
}
function canonical(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Modelo inválido.');
 if(!Array.isArray(value.fields)||!value.fields.length||value.fields.length>100)fail(400,'O modelo precisa ter de 1 a 100 campos.');
 const seen=new Set(),fields=value.fields.map(field=>{
  if(!field||!validId(field.id)||seen.has(field.id)||!['text','number','counter','long','check'].includes(field.type)||!text(field.label,80))fail(400,'Campo inválido ou duplicado no modelo.');seen.add(field.id);
  let initial='';if(field.type==='number')initial=number(field.initial||0);if(field.type==='check')initial='false';
  if(field.type==='counter'){const match=/^(\d+)\/(\d+)$/.exec(String(field.initial||'0/0'));if(!match||Number(match[2])>1000000||Number(match[1])>Number(match[2]))fail(400,'Recurso inválido no modelo.');initial=match[2]+'/'+match[2];}
  return {id:field.id,label:text(field.label,80),group:text(field.group,80)||'Geral',type:field.type,initial};
 });
 const attributes=new Set(fields.filter(f=>f.type==='number').map(f=>f.id));
 const skills=entries(value.skills,item=>{if(item.attribute&&!attributes.has(item.attribute))fail(400,'Perícia aponta para um atributo inexistente.');const numeric=key=>{const n=Number(item[key]||0);if(!Number.isInteger(n)||Math.abs(n)>999)fail(400,'Bônus de perícia inválido.');return n;};return {id:item.id,name:name(item.name),attribute:item.attribute||'',base:numeric('base'),bonus:numeric('bonus'),other:numeric('other'),favorite:item.favorite===true};});
 const abilities=entries(value.abilities,item=>({id:item.id,name:name(item.name),description:text(item.description,4000)}));
 const draft={layout:fields,values:Object.fromEntries(fields.map(f=>[f.id,f.initial])),skills,abilities};
 const rollButtons=entries(value.rollButtons,item=>{if(typeof item.formula!=='string'||item.formula.length>rollFormulaLimit)fail(400,'Rolagem inválida no modelo.');const resolved=resolveSheetFormula(item.formula,{fields},draft);parseDiceFormula(resolved.formula);return {id:item.id,name:name(item.name),formula:resolved.template};});
 const masteries=entries(value.masteries,item=>{if(!attributes.has(item.attributeId))fail(400,'Maestria aponta para atributo inexistente.');const parsed=parseDiceFormula(item.die);if(parsed.modifier||parsed.terms.length!==1||parsed.terms[0].count!==1||parsed.terms[0].sign<0||parsed.terms[0].keep)fail(400,'Use um dado para a maestria.');return {id:item.id,name:name(item.name),attributeId:item.attributeId,die:parsed.formula,remaining:1};});
 const result={name:name(value.name),description:text(value.description,500),fields,skills,abilities,rollButtons,masteries};
 if(value.appearance){result.appearance=validateSheetAppearance(value.appearance,{fields},{...draft,masteries,rollButtons});result.appearance.version=0;}
 if(new TextEncoder().encode(JSON.stringify(result)).length>65536)fail(413,'O modelo excede 64 KB. Reduza descrições ou quantidade de itens.');return result;
}
export function sheetTemplateCharacter(template){const value=canonical(template);return {layout:structuredClone(value.fields),skills:value.skills,abilities:value.abilities,rollButtons:value.rollButtons,masteries:value.masteries,...(value.appearance?{appearance:value.appearance}:{})};}
export function sheetTemplatesView(state,access){const lib=library(state);return {version:lib.version,items:lib.items.filter(item=>mayRead(item,access)).map(item=>{const {owner,...data}=item;return {...data,canEdit:mayEdit(item,access)};})};}
export function exportSheetTemplate(template){return {format:'forja-sheet-template',version:1,template:canonical(template)};}
export function mutateSheetTemplates(state,action,data,access){
 if(!sheetTemplateActions.has(action))return false;if(access.guest||!owner(access))fail(403,'Entre na campanha para organizar modelos.');
 const lib=structuredClone(library(state));
 if(action==='sheetTemplateSave'||action==='sheetTemplateImport'){
  if(lib.items.length>=30)fail(409,'Limite de 30 modelos nesta campanha.');
  let candidate;
  if(action==='sheetTemplateSave'){
   const source=characterFor(state,access,data.characterId);candidate={name:data.name,description:data.description,fields:sheetFields(state,source),skills:source.skills,rollButtons:source.rollButtons,masteries:source.masteries,abilities:data.includeAbilities===true?source.abilities:[],...(data.includeAppearance===true?{appearance:sheetAppearance(state,source)}:{})};
  }else{if(data.bundle?.format!=='forja-sheet-template'||data.bundle.version!==1)fail(400,'Arquivo de modelo incompatível.');candidate=data.bundle.template;}
  const normalized=canonical(candidate);lib.items.push({...normalized,id:crypto.randomUUID(),version:1,owner:owner(access),shared:data.shared===true,createdAt:Date.now()});
 }else{
  const permitted=readableSheetTemplate(state,access,data.templateId||data.id),item=lib.items.find(item=>item.id===permitted.id);
  if(action==='sheetTemplateApply'){
   const target=characterFor(state,access,data.characterId);
   if(!Number.isInteger(data.expectedHistoryVersion)||data.expectedHistoryVersion!==(target.sheetHistory?.version||0))fail(409,'A ficha mudou. Revise o modelo antes de aplicá-lo.');
   if(data.expectedVersion!==item.version)fail(409,'O modelo foi alterado. Abra a prévia novamente.');
   const base=sheetTemplateCharacter(item),appearanceVersion=(target.appearance?.version||0)+1;
   const common=state.sheetModelVersion?state.fields:[];
   const sharedIds=new Set(common.map(field=>field.id));
   target.layout=base.layout.filter(field=>!sharedIds.has(field.id));delete target.fields;
   target.values=Object.fromEntries([...target.layout.map(field=>[field.id,field.initial]),...common.map(field=>[field.id,target.values?.[field.id]??field.initial])]);
   for(const key of ['skills','abilities','rollButtons','masteries'])target[key]=base[key];delete target.preset;
   target.appearance={...(base.appearance||sheetAppearance(state,{...target,appearance:undefined})),version:appearanceVersion};
   return true;
  }
  if(!mayEdit(item,access))fail(403,'Você não pode editar este modelo.');
  if(data.expectedVersion!==item.version)fail(409,'O modelo foi alterado em outra aba. Atualize.');
  if(action==='sheetTemplateDelete')lib.items=lib.items.filter(template=>template!==item);
  else{if(typeof data.shared!=='boolean')fail(400,'Compartilhamento inválido.');item.name=name(data.name);item.description=text(data.description,500);item.shared=data.shared;item.version++;}
 }
 if(new TextEncoder().encode(JSON.stringify(lib)).length>384*1024)fail(413,'Biblioteca de modelos cheia. Remova um modelo ou reduza suas descrições.');
 lib.version++;state.sheetTemplates=lib;return true;
}
