import {characterColorNames} from './model.mjs';
import {dndAbilities,dndClasses,dndBackgrounds,dndSpecies,dndSkills,dndWeapons,dndCharacter,dndCatalog,dndBook,dndAttribution} from './dnd.mjs';
export function dndCreation(ui,draft={}) {
 const {input,select,esc,button}=ui;
 const cls=dndClasses.find(c=>c.id==='fighter');
 return '<p class="muted">D&D 2024 · SRD 5.2.1 · personagem de nível 1. A ficha calcula testes e recursos; escolhas adicionais de classe, espécie, talentos e equipamento ficam indicadas para revisão no livro.</p>'+
 '<nav class="dnd-steps" aria-label="Etapas"><span data-dnd-step-label>1 · Identidade e origem</span></nav>'+
 '<fieldset data-dnd-step="0"><legend>1 · Identidade e origem</legend>'+input('name','Nome',draft.name||'','text','required maxlength="80"')+
 select('classId','Classe',Object.fromEntries(dndClasses.map(c=>[c.id,c.name])),'fighter')+select('speciesId','Espécie',Object.fromEntries(dndSpecies.map(s=>[s.id,s.name])),'human')+select('backgroundId','Antecedente',Object.fromEntries(dndBackgrounds.map(b=>[b.id,b.name])),'soldier')+'<p class="dnd-help" data-dnd-origin-help></p></fieldset>'+
 '<fieldset data-dnd-step="1" hidden><legend>2 · Atributos</legend>'+select('scoreMethod','Método',{array:'Distribuição padrão: 15, 14, 13, 12, 10, 8',manual:'Valores definidos com o mestre'},'array')+button('Usar sugestão da classe','dndSuggested','small')+'<div class="form-grid">'+Object.entries(dndAbilities).map(([id,name],index)=>input('score-'+id,name,cls.array[index],'number','required min="3" max="18" step="1"')).join('')+'</div><p class="muted">Distribua a sequência sem repetir valores. No método manual, combine os valores com o mestre.</p>'+select('boostMode','Bônus do antecedente',{split:'+2 em um atributo e +1 em outro',three:'+1 nos três atributos permitidos'},'split')+'<div class="form-grid" data-dnd-split-boost><label>+2 do antecedente<select name="boost2" data-dnd-boost2></select></label><label>+1 do antecedente<select name="boost1" data-dnd-boost1></select></label></div><p class="muted">Escolha dois atributos diferentes permitidos pelo antecedente.</p></fieldset>'+
 '<fieldset data-dnd-step="2" hidden><legend>3 · Proficiências e escolhas</legend><div data-dnd-skills></div><div data-dnd-expertise></div>'+select('weapon','Arma para criar atalhos de ataque e dano',{'':'Escolher depois',...Object.fromEntries(dndWeapons.map(w=>[w.id,w.name]))},'')+'<p class="muted">O atalho não concede o equipamento. Confira no livro o equipamento inicial e registre armadura, escudo e inventário.</p>'+select('magicAbility','Atributo de magia adicional (talentos/origem)',{'':'Escolher depois',int:'Inteligência',wis:'Sabedoria',cha:'Carisma'},'')+input('choices','Linhagem, talento humano, ordens e outras escolhas','','text','maxlength="2000" placeholder="Registre aqui as opções da sua classe e espécie"')+'</fieldset>'+
 '<fieldset data-dnd-step="3" hidden><legend>4 · Revisão</legend><div class="dnd-review" data-dnd-review role="status"></div><p class="muted">CA inicial sem armadura. Atualize-a ao equipar armadura ou escudo. Magias podem ser consultadas e adicionadas após criar a ficha.</p>'+select('color','Cor da ficha',characterColorNames,draft.color||'blue')+'</fieldset>'+
 '<div class="actions dnd-wizard-actions">'+button('Anterior','dndBack','small')+button('Próxima etapa','dndNext','primary')+'<button type="submit" class="btn primary" data-dnd-finish hidden>Criar personagem</button></div>'+button('Usar ficha universal','dndUniversal','ghost small');
}
export function dndFormData(form) {
 const value=name=>form.querySelector('[name="'+name+'"]')?.value;
 return {classId:value('classId'),speciesId:value('speciesId'),backgroundId:value('backgroundId'),scoreMethod:value('scoreMethod'),boostMode:value('boostMode'),scores:Object.fromEntries(Object.keys(dndAbilities).map(id=>[id,Number(value('score-'+id))])),boost2:value('boost2'),boost1:value('boost1'),skills:[...form.querySelectorAll('[data-dnd-skill]:checked')].map(input=>input.value),expertise:[...form.querySelectorAll('[data-dnd-expertise-choice]:checked')].map(input=>input.value),weapon:value('weapon'),magicAbility:value('magicAbility'),choices:value('choices')||''};
}
export function updateDndCreation(form,ui,originChanged=false,classChanged=false) {
 const {esc}=ui;
 const cls=dndClasses.find(c=>c.id===form.querySelector('[name=classId]')?.value)||dndClasses[4];
 const bg=dndBackgrounds.find(b=>b.id===form.querySelector('[name=backgroundId]')?.value)||dndBackgrounds[3];
 const species=dndSpecies.find(s=>s.id===form.querySelector('[name=speciesId]')?.value)||dndSpecies[6];
 form.querySelector('[data-dnd-origin-help]').textContent=cls.description+' '+species.description+' Antecedente: '+bg.name+' · '+bg.feat+'.';
 const split=form.querySelector('[data-dnd-split-boost]');if(split)split.hidden=form.querySelector('[name=boostMode]')?.value==='three';
 if(originChanged) {
   for(const [selector,index]of [['[data-dnd-boost2]',0],['[data-dnd-boost1]',1]])form.querySelector(selector).innerHTML=bg.abilities.map((id,i)=>'<option value="'+id+'" '+(i===index?'selected':'')+'>'+esc(dndAbilities[id])+'</option>').join('');
 }
 if(originChanged||classChanged)form.querySelector('[data-dnd-skills]').innerHTML='<p>Perícias recebidas: '+bg.skills.map(id=>esc(dndSkills.find(s=>s[0]===id)[1])).join(', ')+'. Escolha mais '+cls.count+':</p><div class="dnd-skill-choices">'+cls.skills.filter(id=>!bg.skills.includes(id)).map(id=>'<label class="check"><input type="checkbox" value="'+id+'" data-dnd-skill>'+esc(dndSkills.find(s=>s[0]===id)[1])+'</label>').join('')+'</div>';
 const proficient=[...bg.skills,...form.querySelectorAll('[data-dnd-skill]:checked')].map(item=>typeof item==='string'?item:item.value);
 const expertise=form.querySelector('[data-dnd-expertise]');
 const signature=proficient.join(',')+cls.id;
 if(expertise.dataset.signature!==signature) {
   expertise.dataset.signature=signature;
   expertise.innerHTML=cls.id==='rogue'?'<p>Escolha duas especializações:</p><div class="dnd-skill-choices">'+proficient.map(id=>'<label class="check"><input type="checkbox" value="'+id+'" data-dnd-expertise-choice>'+esc(dndSkills.find(s=>s[0]===id)[1])+'</label>').join('')+'</div>':'';
 }
 try {
   const built=dndCharacter(dndFormData(form));
   form.querySelector('[data-dnd-review]').innerHTML='<h3>'+esc(cls.name)+' · '+esc(species.name)+'</h3><p>'+esc(bg.name)+' · Proficiência +2 · PV '+esc(built.values['dd-hp'])+'</p><div class="dnd-score-preview">'+Object.entries(dndAbilities).map(([id,label])=>'<span>'+esc(label)+' <strong>'+built.values['dd-'+id]+'</strong> ('+(Math.floor((Number(built.values['dd-'+id])-10)/2)>=0?'+':'')+Math.floor((Number(built.values['dd-'+id])-10)/2)+')</span>').join('')+'</div><p>Revise no livro as escolhas indicadas em Habilidades antes de jogar.</p>';
 } catch(error){form.querySelector('[data-dnd-review]').textContent=error.message;}
}
export function dndCatalogShell(row,ui,selected='') {
 const characters=row.state.characters.filter(c=>c.dnd&&(row.master||c.access==='full'));
 return '<div class="dnd-catalog"><div class="form-grid">'+ui.input('dndQuery','Buscar regras, habilidades ou magias','','search','data-dnd-query placeholder="Ex.: vantagem, guerreiro, curar"')+ui.select('dndCategory','Categoria',{'':'Todas',classes:'Classes',species:'Espécies',backgrounds:'Antecedentes',spells:'Magias · seleção rápida',weapons:'Armas · seleção rápida',rules:'Regras'},'')+ui.select('dndTarget','Adicionar à ficha',{'':'Só consultar',...Object.fromEntries(characters.map(c=>[c.id,c.name]))},selected||characters[0]?.id||'')+'</div><p class="muted">Consultas rápidas em português adaptadas do SRD 5.2.1. O livro completo está em inglês. As magias e armas abaixo são uma seleção inicial; consulte todas as opções no PDF.</p><label class="check"><input type="checkbox" name="dndAllSpells"> Mostrar magias de outras classes (talentos e opções adicionais)</label><div data-dnd-results></div><p class="muted"><a href="'+dndBook+'" target="_blank" rel="noopener noreferrer">Livro oficial completo · SRD 5.2.1 ↗</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p><details><summary>Créditos e licença</summary><p>'+ui.esc(dndAttribution)+'</p><p>Resumos e traduções adaptados para a Forja. Não é uma tradução oficial.</p></details></div>';
}
export function renderDndResults(row,ui,query='',category='',target='',allSpells=false) {
 const normal=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 const character=row.state.characters.find(c=>c.id===target&&c.dnd&&(row.master||c.access==='full'));
 const entries=dndCatalog.filter(entry=>(entry.category!=='spells'||!character||allSpells||entry.classes.includes(character.dnd.classId))&&(!category||entry.category===category)&&normal(entry.name+' '+(entry.english||'')+' '+entry.description).includes(normal(query)));
 return '<p class="muted">'+entries.length+' referências</p>'+entries.map(entry=>'<article class="dnd-reference-card"><div><h3>'+ui.esc(entry.name)+(entry.level!==undefined?' <small>'+(entry.level===0?'Truque':'Círculo '+entry.level)+'</small>':'')+'</h3><p>'+ui.esc(entry.description)+'</p></div><div class="actions"><a class="btn small" href="'+dndBook+'#page='+entry.page+'" target="_blank" rel="noopener noreferrer">Ver seção no livro ↗</a>'+(character?(character.abilities||[]).some(a=>a.id===entry.id)?'<span class="count-tag">Na ficha</span>':ui.button('Adicionar à ficha','dndAdd','small','',character.id+'/'+entry.id):'')+'</div></article>').join('');
}
