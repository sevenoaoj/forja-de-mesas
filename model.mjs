import {dndDerived,dndModifier,dndSpellFormula,dndCatalog} from './dnd.mjs';
export const rollFormulaLimit = 240;

export const fields = [
  {id:'f1', group:'Atributos', label:'Força', type:'number', initial:'2'},
  {id:'f2', group:'Atributos', label:'Agilidade', type:'number', initial:'3'},
  {id:'f3', group:'Atributos', label:'Presença', type:'number', initial:'1'},
  {id:'f4', group:'Recursos', label:'Vitalidade', type:'counter', initial:'18/22'},
  {id:'f5', group:'História', label:'Antecedentes', type:'long', initial:''},
  {id:'f6', group:'Equipamento', label:'Inventário', type:'long', initial:''}
];

export const sheetPresets=[{
  id:'herdeiros-destino',name:'Os Herdeiros do Destino',
  description:'Poder, Astúcia e Essência; testes de 2d6 + atributo; maestria por sessão; história e anotações.',
  fields:[
    {id:'hd-age',group:'Identificação',label:'Idade',type:'number',initial:''},
    {id:'hd-bending',group:'Identificação',label:'Dobra',type:'text',initial:''},
    {id:'hd-power',group:'Atributos',label:'Poder',type:'number',initial:'0'},
    {id:'hd-cunning',group:'Atributos',label:'Astúcia',type:'number',initial:'0'},
    {id:'hd-essence',group:'Atributos',label:'Essência',type:'number',initial:'0'},
    {id:'hd-equipment',group:'Equipamentos',label:'Itens e efeitos',type:'long',initial:''},
    {id:'hd-story',group:'História',label:'História do personagem',type:'long',initial:''},
    {id:'hd-notes',group:'Anotações',label:'Notas da campanha',type:'long',initial:''}
  ],
  rollButtons:[
    {id:'hd-test-power',name:'Teste de Poder',formula:'2d6+@{hd-power}'},
    {id:'hd-test-cunning',name:'Teste de Astúcia',formula:'2d6+@{hd-cunning}'},
    {id:'hd-test-essence',name:'Teste de Essência',formula:'2d6+@{hd-essence}'}
  ],
  masteries:[{id:'hd-mastery',name:'Maestria em Essência',attributeId:'hd-essence',die:'1d4',remaining:1}]
}];

export function sheetPreset(id) {
  const preset=sheetPresets.find(item=>item.id===id);
  return preset?structuredClone(preset):null;
}

export const icons = ['◈', '✦', '✷', '✧', '⬢', '✣'];
export const characterColors = {"violet": {"name": "Violeta", "hex": "#bd94ff"}, "jade": {"name": "Jade", "hex": "#9de5cb"}, "gold": {"name": "Âmbar", "hex": "#ffdb9e"}, "rose": {"name": "Rosa", "hex": "#ffb7d9"}, "blue": {"name": "Azul", "hex": "#bdd1ff"}, "red": {"name": "Vermelho", "hex": "#f87171"}, "crimson": {"name": "Carmesim", "hex": "#e64b70"}, "coral": {"name": "Coral", "hex": "#fb9382"}, "orange": {"name": "Laranja", "hex": "#fb923c"}, "copper": {"name": "Cobre", "hex": "#dba273"}, "yellow": {"name": "Amarelo", "hex": "#fde047"}, "lime": {"name": "Lima", "hex": "#bef264"}, "green": {"name": "Verde", "hex": "#4ade80"}, "emerald": {"name": "Esmeralda", "hex": "#34d399"}, "teal": {"name": "Verde-petróleo", "hex": "#2dd4bf"}, "cyan": {"name": "Ciano", "hex": "#67e8f9"}, "sky": {"name": "Azul-céu", "hex": "#7dd3fc"}, "indigo": {"name": "Índigo", "hex": "#a5b4fc"}, "purple": {"name": "Púrpura", "hex": "#d8b4fe"}, "magenta": {"name": "Magenta", "hex": "#e879f9"}, "fuchsia": {"name": "Fúcsia", "hex": "#f472b6"}, "silver": {"name": "Prata", "hex": "#cbd5e1"}, "ivory": {"name": "Marfim", "hex": "#f5edd4"}, "slate": {"name": "Ardósia", "hex": "#94a3b8"}};
export const colors = Object.keys(characterColors);
export const characterColorNames=Object.fromEntries(Object.entries(characterColors).map(([key,value])=>[key,value.name]));
export const characterColorHex=color=>characterColors[color]?.hex||characterColors.violet.hex;

// Legacy sheets remain player characters until the GM explicitly classifies them.
export const characterType=character=>character?.characterType==='npc'?'npc':'player';
export const isPlayerCharacter=character=>characterType(character)==='player';
export function playerVisionSource(state,token){return token.kind!=='item'&&!token.hidden&&(state.characters||[]).some(c=>c.id===tokenCharacterId(state,token)&&!c.hidden&&isPlayerCharacter(c));}

export function newCampaign(name, example = false) {
  const characters = example ? [
    {id:'lyra', name:'Lyra Vesper', concept:'Arcanista', color:'violet', values:{f1:'1', f2:'3', f3:'4', f4:'18/22'}},
    {id:'dorian', name:'Dorian Vale', concept:'Sentinela', color:'jade', values:{f1:'4', f2:'2', f3:'1', f4:'25/28'}},
    {id:'mira', name:'Mira Ashford', concept:'Exploradora', color:'gold', values:{f1:'2', f2:'4', f3:'2', f4:'20/20'}}
  ].map(character=>({...character,
    skills:[
      {id:'perception',name:'Percepção',attribute:'f3',base:0,bonus:1,other:0,favorite:true},
      {id:'stealth',name:'Furtividade',attribute:'f2',base:0,bonus:0,other:0,favorite:false},
      {id:'athletics',name:'Atletismo',attribute:'f1',base:0,bonus:0,other:0,favorite:false}
    ],
    abilities:character.id==='lyra' ? [{id:'arcana',name:'Sentir magia',description:'Percebe vestígios de magia em objetos e lugares próximos.'}] : []
  })) : [];
  return {
    name, system:example ? 'Fantasia sombria' : 'Sistema livre',
    description:example ? 'A névoa desceu sobre o vale. Em algum lugar além da floresta, as ruínas de Véu Partido ainda guardam seus segredos.' : '',
    scene:example ? 'Ruínas de Véu Partido' : 'Primeira cena', example,
    fields:structuredClone(fields), characters,
    tokens:example ? characters.map((c,i)=>({id:c.id,name:c.name,color:c.color,characterId:c.id,x:4+i*2,y:4+i%2})) : [],
    map:null, books:[], rolls:[], notes:'', initiative:[]
  };
}

export function sheetFields(state,character) {
  return character?.layout ? [...character.layout] : [...(state.fields||[]),...(character?.fields||[])];
}

export function sheetValue(character,field) {
  return dndDerived(character,field.id) ?? character?.values?.[field.id] ?? field.initial;
}

export function skillValues(character,skill,state) {
  const field=sheetFields(state,character).find(field=>field.id===skill.attribute && field.type==='number');
  const bounded=value=>Math.max(-999,Math.min(999,Math.trunc(Number(value)||0)));
  const base=bounded(field ? character.dnd&&/^dd-(str|dex|con|int|wis|cha)$/.test(field.id)?dndModifier(character,field.id.slice(3)):sheetValue(character,field) : skill.base);
  const bonus=bounded(skill.bonus)+(character.dnd?(skill.rank||0)*Number(dndDerived(character,'dd-prof')):0);
  const other=bounded(skill.other);
  return {base,bonus,other,total:base+bonus+other};
}

export function inviteOrigin(value) {
  if (typeof value!=='string' || !value.trim()) return null;
  try {
    const url=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value.trim()) ? value.trim() : 'http://'+value.trim());
    const host=url.hostname.toLowerCase();
    const loopback=host==='localhost'||host.endsWith('.localhost')||host==='localhost.localdomain'||
      /^127\./.test(host)||['0.0.0.0','[::]','[::1]'].includes(host);
    if (!['http:','https:'].includes(url.protocol)||loopback||url.username||url.password) return null;
    return url.origin;
  } catch {return null;}
}

export function tokenCharacterId(state,token) {
  if (token.characterId!==undefined) return token.characterId;
  return state.characters.some(character=>character.id===token.id)?token.id:'';
}


const formulaError=message=>{throw Object.assign(new Error(message),{status:400});};
const normalizedName=value=>String(value).trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR');

export function parseDiceFormula(value) {
  const invalid=()=>formulaError('Use dados e somas, como 2d6+3 ou 1d20+1d10 (até 50 dados de 2 a 1000 faces).');
  if(typeof value!=='string'||value.length>rollFormulaLimit) invalid();
  const formula=value.replace(/\s/g,'').toLowerCase();
  if(!/^\d{0,2}d\d{1,4}(?:k[hl]1)?(?:[+-](?:\d{0,2}d\d{1,4}(?:k[hl]1)?|\d{1,4}))*$/.test(formula)) invalid();
  let modifier=0,totalDice=0;
  const terms=formula.split(/(?=[+-])/).flatMap(term=>{
    const match=/^([+-]?)(\d{0,2})d(\d{1,4})(k[hl]1)?$/.exec(term);
    if(!match){modifier+=Number(term);return [];}
    const [,sign,quantity,sides,keep]=match;
    const count=Number(quantity||1),faces=Number(sides);totalDice+=count;
    if(count<1||totalDice>50||faces<2||faces>1000||keep&&count<2) invalid();
    return [{sign:sign==='-'?-1:1,count,faces,...(keep?{keep}:{})}];
  });
  return {formula,terms,modifier};
}

export function resolveSheetFormula(value,state,character) {
  if(typeof value!=='string'||value.length>rollFormulaLimit) formulaError('Expressão muito longa ou inválida.');
  const fields=sheetFields(state,character).filter(field=>['number','counter'].includes(field.type));
  const references=[];
  function reference(name) {
    if(!character) formulaError('Escolha uma ficha para usar atributos na expressão.');
    const parts=name.split('|'),lookup=parts[0].trim();let transform=parts[1];
    if(parts.length>2||transform&&!['mod','score'].includes(transform))formulaError('Transformação de atributo inválida.');
    const exact=fields.find(field=>field.id===lookup);
    const matches=exact?[exact]:fields.filter(field=>normalizedName(field.label)===normalizedName(lookup));
    if(matches.length!==1) formulaError(matches.length?'Há campos com o mesmo nome. Insira a referência pelo seletor.':'Atributo ou recurso indisponível: '+name);
    const field=matches[0];
    if(!transform&&character.dnd&&/^dd-(str|dex|con|int|wis|cha)$/.test(field.id))transform='mod';
    const raw=String(sheetValue(character,field)??'');
    const numeric=field.type==='counter'?raw.split('/')[0]:raw;
    if(transform&&(!character.dnd||field.type!=='number'))formulaError('Use |mod em um atributo de D&D.');
    const number=transform==='mod'?Math.floor((Number(numeric)-10)/2):Number(numeric);
    if(!numeric.trim()||!Number.isInteger(number)||Math.abs(number)>9999) formulaError('O campo '+field.label+' precisa de um inteiro entre -9999 e 9999 para esta rolagem.');
    const index=references.push({id:field.id,label:(transform==='mod'?'Mod. ':transform==='score'?'Pontuação ':'')+field.label,value:number,...(transform?{transform}:{})})-1;
    return '#'+index+'#';
  }
  let expression=value.replace(/@\{([^{}]+)\}/g,(_,name)=>reference(name));
  expression=expression.split(/([+-])/).map(term=>{
    const text=term.trim();
    if(!text||['+','-'].includes(text)||/^\d*d\d+(?:k[hl]1)?$/i.test(text)||/^\d+$/.test(text)||/^#\d+#$/.test(text))return text;
    return reference(text);
  }).join('');
  const template=expression.replace(/#(\d+)#/g,(_,index)=>'@{'+references[Number(index)].id+(references[Number(index)].transform?'|'+references[Number(index)].transform:'')+'}');
  if(template.length>rollFormulaLimit) formulaError('A expressão tem referências demais. Use uma expressão mais curta.');
  let resolved=expression.replace(/#(\d+)#/g,(_,index)=>String(references[Number(index)].value));
  if(references.length) resolved=resolved.replace(/([+-])([+-])/g,(_,a,b)=>a===b?'+':'-');
  const parsed=parseDiceFormula(resolved);
  return {formula:parsed.formula,template,bindings:references};
}

export function displaySheetFormula(formula,state,character) {
  return String(formula||'').replace(/@\{([^{}]+)\}/g,(_,reference)=>{const [id,transform]=reference.split('|');const name=sheetFields(state,character).find(field=>field.id===id)?.label;return name?(transform==='mod'?'Mod. ':transform==='score'?'Pontuação ':'')+name:'[campo removido]';});
}

// These definitions are shared by table previews and authoritative server rolls.
export function sheetTestBase(character){return character?.preset==='herdeiros-destino'?'2d6':'1d20';}
export function sheetTestAttributes(state,character){
 return sheetFields(state,character).filter(field=>field.type==='number'&&(character.dnd
  ? /^dd-(str|dex|con|int|wis|cha)$/.test(field.id)
  : /^(atributos?|attributes?|caracteristicas|capacidades)$/.test(normalizedName(field.group))||(character.skills||[]).some(skill=>skill.attribute===field.id)));
}
function testBase(character,value){
 const base=value===undefined?sheetTestBase(character):value;
 const parsed=parseDiceFormula(base);
 if(parsed.terms.length!==1||parsed.modifier||parsed.terms[0].keep||parsed.terms[0].sign!==1||character.dnd&&(parsed.terms[0].count!==1||parsed.terms[0].faces!==20))formulaError('Use somente os dados-base do teste, como 1d20 ou 2d6. D&D usa 1d20.');
 return parsed.terms[0].count+'d'+parsed.terms[0].faces;
}
const signedTerm=value=>value?(value>0?'+':'')+value:'';
export function sheetAttributeTest(state,character,id,base){
 const field=sheetTestAttributes(state,character).find(field=>field.id===id);
 if(!field)formulaError('Este campo não é um atributo de teste.');
 return {label:'Teste de '+field.label,formula:testBase(character,base)+'+@{'+field.id+(character.dnd?'|mod':'')+'}'};
}
export function sheetSkillTest(state,character,id,base){
 const skill=character.skills?.find(skill=>skill.id===id);
 if(!skill)formulaError('Perícia indisponível.');
 const values=skillValues(character,skill,state),linked=sheetFields(state,character).find(field=>field.id===skill.attribute&&field.type==='number');
 return {label:'Perícia · '+skill.name,formula:testBase(character,base)+(linked?'+@{'+linked.id+(character.dnd&&/^dd-(str|dex|con|int|wis|cha)$/.test(linked.id)?'|mod':'')+'}':signedTerm(values.base))+signedTerm(values.bonus)+signedTerm(values.other)};
}
export function sheetSavedRollFormula(character,button){
 if(!button?.dndSpell)return button?.formula||'';
 const spell=dndCatalog.find(entry=>entry.id===button.dndSpell.spellId);
 if(!spell)formulaError('Magia indisponível.');
 return dndSpellFormula(character,spell,button.dndSpell.part);
}
