import {sheetFields,sheetValue,skillValues,sheetTestAttributes,sheetAttributeTest,sheetSkillTest,sheetSavedRollFormula,resolveSheetFormula,rollFormulaLimit} from '../model.mjs';
import {dndCatalog,dndCharacterSpellSlots} from '../dnd.mjs';
import {rollVisibilityOptions} from './rolls.mjs';
export function dndSpellHasRoll(id){return Boolean(dndCatalog.find(entry=>entry.id===id&&entry.category==='spells')?.formula);}
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normal=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const signed=value=>(value>=0?'+':'')+value;
export const tableRollTabs={tests:'Testes',actions:'Ações',resources:'Recursos',free:'Livre'};
export function tableRollPreview(formula,state,character,{mode='normal',masteryId=''}={}){
 try{
  const resolved=resolveSheetFormula(formula,state,character);
  let expression=resolved.formula;
  const d20=/^1?d20(?:[+-]|$)/.test(expression);
  if(d20&&mode!=='normal')expression=expression.replace(/^1?d20/,'2d20'+(mode==='advantage'?'kh1':'kl1'));
  const mastery=character.masteries?.find(m=>m.id===masteryId&&m.remaining>0&&resolved.bindings.some(binding=>binding.id===m.attributeId));
  if(mastery)expression+='+'+mastery.die;
  return {...resolved,expression,d20,mastery};
 }catch(error){return {error:error.message};}
}
const safeTest=fn=>{try{return fn();}catch(error){return {formula:'',error:error.message};}};
function rollButton(name,formula,attribute,id,row,character,view){
 const preview=tableRollPreview(formula,row.state,character,view);
 return '<button type="button" class="vtt-roll-choice" '+attribute+'="'+esc(id)+'" '+(preview.error?'disabled ':'')+'title="'+esc(preview.error||name+' · '+preview.expression)+'"><span>'+esc(name)+'</span><small>'+esc(preview.error||preview.expression)+(preview.mastery?' · maestria':'')+'</small></button>';
}
export function renderFreeRollPreview(row,character,view){
 const result=tableRollPreview(view.formula,row.state,character,view);
 return result.error?'<span class="vtt-roll-error">'+esc(result.error)+'</span>':'Será rolado: <strong>'+esc(result.expression)+'</strong>'+(result.mastery?' · '+esc(result.mastery.name):'');
}
export function renderTableRollContent(row,character,view){
 const fields=sheetFields(row.state,character),buttons=character.rollButtons||[],match=text=>normal(text).includes(normal(view.query));
 if(view.tab==='resources'){
  const resources=fields.filter(field=>field.type==='counter');
  const attributes=new Set(sheetTestAttributes(row.state,character).map(field=>field.id));
  const info=fields.filter(field=>field.type==='number'&&!attributes.has(field.id));
  return '<p class="vtt-roll-hint">Estes valores são recursos e informações da ficha. Ajustá-los não rola dados.</p><div class="vtt-sheet-resources">'+resources.map(field=>'<div><span>'+esc(field.label)+'<strong>'+esc(sheetValue(character,field))+'</strong></span><div>'+[-1,1].map(step=>'<button type="button" class="btn small" data-table-roll-resource="'+esc(field.id)+'" data-step="'+step+'" aria-label="'+(step>0?'Aumentar ':'Diminuir ')+esc(field.label)+'">'+(step>0?'+':'−')+'</button>').join('')+'</div></div>').join('')+'</div>'+(info.length?'<h3 class="vtt-roll-subtitle">Informações da ficha</h3><dl class="vtt-sheet-info">'+info.map(field=>'<div><dt>'+esc(field.label)+'</dt><dd>'+esc(sheetValue(character,field))+'</dd></div>').join('')+'</dl>':'')+(!resources.length&&!info.length?'<p class="vtt-empty">Nenhum recurso cadastrado nesta ficha.</p>':'')+'<button type="button" class="btn small" data-table-character="'+esc(character.id)+'">Editar na ficha</button>';
 }
 if(view.tab==='free'){
  return '<p class="vtt-roll-hint">Monte uma expressão sem alterar seus testes salvos. Exemplo: 2d6 + Força.</p><form data-table-roll-form><label>Expressão<input type="text" data-table-roll-formula value="'+esc(view.formula)+'" maxlength="'+rollFormulaLimit+'" required placeholder="1d20+3 ou 2d6 + Poder"></label><div class="vtt-roll-preview" data-table-roll-preview aria-live="polite">'+renderFreeRollPreview(row,character,view)+'</div><button class="btn primary" type="submit">Rolar expressão</button></form><details class="vtt-roll-field-list"><summary>Inserir um valor da ficha</summary><p class="vtt-roll-hint">Insere uma referência na expressão livre. Atributos de D&D usam o modificador.</p><div>'+fields.filter(field=>['number','counter'].includes(field.type)).map(field=>'<button type="button" class="btn small" data-table-insert-field="'+esc(field.id)+'">'+esc(field.label)+'</button>').join('')+'</div></details>';
 }
 if(view.tab==='actions'){
  const spells=character.dnd?(character.abilities||[]).map(a=>dndCatalog.find(entry=>entry.id===a.id&&entry.category==='spells')).filter(Boolean).filter(spell=>match(spell.name)):[];
  const rolls=buttons.filter(roll=>!character.dnd||!/^dd-(check|save)-/.test(roll.id)).filter(roll=>match(roll.name));
  const attacks=rolls.filter(roll=>!roll.dndSpell),spellRolls=rolls.filter(roll=>roll.dndSpell);
  return '<p class="vtt-roll-hint">Ataques, danos e rolagens salvas. Vantagem só altera testes com um d20.</p>'+(attacks.length?'<div class="vtt-roll-choices">'+attacks.map(roll=>rollButton(roll.name,sheetSavedRollFormula(character,roll),'data-table-sheet-roll',roll.id,row,character,view)).join('')+'</div>':'')+(spells.length?'<h3 class="vtt-roll-subtitle">Conjurar magias</h3>'+spells.map(spell=>{
    return '<article class="vtt-cast-choice"><div><strong>'+esc(spell.name)+'</strong><small>'+
      (spell.level
        ? (()=>{
          const slots=dndCharacterSpellSlots(character,fields,spell.level),available=slots.filter(s=>s.current>0);
          if(!available.length)return 'Sem espaços de '+spell.level+'º círculo'+(slots.some(s=>s.level>spell.level)?' ou superior':'');
          const picked=available.find(s=>s.level===Number(view.castSlots?.[spell.id]))?.level??available[0].level;
          return 'Gasta 1 espaço de '+picked+'º círculo';
        })()
        : 'Truque · sem gastar espaço')+'</small></div>'+
      (spell.level?(()=>{
        const slots=dndCharacterSpellSlots(character,fields,spell.level),available=slots.filter(s=>s.current>0);
        const picked=available.find(s=>s.level===Number(view.castSlots?.[spell.id]))?.level??available[0]?.level??spell.level;
        const showPicker=available.length>1||available.length===1&&available[0].level>spell.level;
        return '<div class="vtt-cast-controls">'+(showPicker?'<select class="vtt-cast-slot" data-table-cast-slot="'+esc(spell.id)+'" aria-label="Círculo para '+esc(spell.name)+'">'+available.map(s=>'<option value="'+s.level+'" '+(s.level===picked?'selected':'')+'>'+s.level+'º ('+s.current+'/'+s.maximum+')'+(s.level>spell.level?' ↑':'')+'</option>').join('')+'</select>':'')+'<button type="button" class="btn small" data-table-dnd-cast="'+esc(spell.id)+'" data-slot-level="'+picked+'" '+(!available.length?'disabled':'')+'>Conjurar</button></div>';
      })():'<button type="button" class="btn small" data-table-dnd-cast="'+esc(spell.id)+'">Conjurar</button>')+'</article>';
  }).join(''):'')+(spellRolls.length?'<details class="vtt-roll-spell-dice"><summary>Dados das magias · sem gastar espaço</summary><p class="vtt-roll-hint">Use para rolar o dano ou efeito de uma magia já conjurada. Estes botões não consomem espaços.</p><div class="vtt-roll-choices">'+spellRolls.map(roll=>rollButton(roll.name,sheetSavedRollFormula(character,roll),'data-table-sheet-roll',roll.id,row,character,view)).join('')+'</div></details>':'')+(!attacks.length&&!spells.length&&!spellRolls.length?'<p class="vtt-empty">Nenhuma ação encontrada. Adicione ataques e rolagens personalizadas na ficha.</p>':'');
 }
 const attributes=sheetTestAttributes(row.state,character).filter(field=>match(field.label));
 const saves=character.dnd?buttons.filter(roll=>/^dd-save-/.test(roll.id)&&match(roll.name)):[];
 const custom=!character.dnd?buttons.filter(roll=>match(roll.name)):[];
 const skills=(character.skills||[]).filter(skill=>match(skill.name)).sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite)));
 return '<p class="vtt-roll-hint">Clique para rolar o teste completo. Cada clique usa somente o atributo escolhido.</p>'+(!character.dnd?'<label class="vtt-test-base">Dados-base dos testes<input type="text" data-table-test-base value="'+esc(view.base)+'" maxlength="16" placeholder="2d6 ou 1d20"></label>':'')+(attributes.length?'<h3 class="vtt-roll-subtitle">Atributos'+(character.dnd?' · modificadores':'')+'</h3><div class="vtt-sheet-attributes">'+attributes.map(field=>{
  const test=safeTest(()=>sheetAttributeTest(row.state,character,field.id,view.base)),preview=tableRollPreview(test.formula,row.state,character,view),binding=preview.bindings?.find(binding=>binding.id===field.id);
  return '<button type="button" data-table-roll-attribute="'+esc(field.id)+'" '+(preview.error?'disabled':'')+' title="'+esc(preview.error||test.label+' · '+preview.expression)+'"><span>'+esc(field.label)+'</span><strong>'+esc(binding?signed(binding.value):'—')+'</strong><small>'+esc(preview.error?'Corrija os dados-base':preview.expression)+'</small>'+(character.dnd?'<small>Pontuação '+esc(sheetValue(character,field))+'</small>':'')+'</button>';
 }).join('')+'</div>':'')+(saves.length?'<h3 class="vtt-roll-subtitle">Salvaguardas</h3><div class="vtt-roll-choices">'+saves.map(roll=>rollButton(roll.name,roll.formula,'data-table-sheet-roll',roll.id,row,character,view)).join('')+'</div>':'')+(skills.length?'<h3 class="vtt-roll-subtitle">Perícias</h3><div class="vtt-roll-choices">'+skills.map(skill=>{
  const test=safeTest(()=>sheetSkillTest(row.state,character,skill.id,view.base));
  return rollButton(skill.name+' '+signed(skillValues(character,skill,row.state).total),test.formula,'data-table-skill-roll',skill.id,row,character,view);
 }).join('')+'</div>':'')+(custom.length?'<h3 class="vtt-roll-subtitle">Rolagens salvas</h3><div class="vtt-roll-choices">'+custom.map(roll=>rollButton(roll.name,sheetSavedRollFormula(character,roll),'data-table-sheet-roll',roll.id,row,character,view)).join('')+'</div>':'')+(!attributes.length&&!saves.length&&!skills.length&&!custom.length?'<p class="vtt-empty">Nenhum teste encontrado. Na ficha, agrupe os atributos em “Atributos” ou crie uma rolagem personalizada.</p>':'');
}
export function renderTableRollPanel(row,character,characters,view){
 if(!character)return '<p class="vtt-empty">Crie uma ficha para usar seus dados na mesa.</p>';
 const options=(values,current)=>Object.entries(values).map(([id,label])=>'<option value="'+esc(id)+'" '+(id===current?'selected':'')+'>'+esc(label)+'</option>').join('');
 const masteries=character.masteries||[];
 const visibility=['public','gm'].includes(view.visibility)?view.visibility:(row.master?'gm':'public');
 return '<div class="vtt-roller-identity"><div><small>'+(row.master?'Ficha selecionada':'Seu personagem')+'</small><strong>'+esc(character.name)+'</strong></div><button type="button" class="btn small" data-table-character="'+esc(character.id)+'">Ficha ↗</button></div>'+(row.master&&characters.length>1?'<label>Trocar personagem<select data-table-roll-character>'+options(Object.fromEntries(characters.map(c=>[c.id,c.name])),character.id)+'</select></label>':'')+'<label>Visibilidade da rolagem<select data-table-roll-visibility>'+options(rollVisibilityOptions(row.master),visibility)+'</select></label><nav class="vtt-roll-tabs" aria-label="Categorias de dados">'+Object.entries(tableRollTabs).map(([id,label])=>'<button type="button" data-table-roll-tab="'+id+'" aria-pressed="'+(view.tab===id)+'">'+label+'</button>').join('')+'</nav>'+(view.tab!=='resources'?'<div class="vtt-roll-options"><label>Teste de d20<select data-table-roll-mode>'+options({normal:'Normal',advantage:'Vantagem',disadvantage:'Desvantagem'},view.mode)+'</select></label>'+(masteries.length?'<label>Maestria · só no atributo vinculado<select data-table-roll-mastery><option value="">Sem maestria</option>'+masteries.map(m=>'<option value="'+esc(m.id)+'" '+(m.id===view.masteryId?'selected ':'')+(m.remaining<1?'disabled':'')+'>'+esc(m.name+' + '+m.die+(m.remaining<1?' · usada':''))+'</option>').join('')+'</select></label>':'')+'</div>':'')+(['tests','actions'].includes(view.tab)?'<label>Buscar '+(view.tab==='tests'?'teste':'ação')+'<input type="search" data-table-roll-search value="'+esc(view.query)+'" placeholder="Nome do teste ou ação"></label>':'')+'<div class="vtt-roll-content" data-table-roll-content>'+renderTableRollContent(row,character,view)+'</div>';
}
