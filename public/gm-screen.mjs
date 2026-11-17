import {sheetFields,sheetValue} from '../model.mjs';
import {normalizeTable} from '../table-model.mjs';
import {dndCatalog} from '../dnd.mjs';
export const gmCategories={all:'Tudo',session:'Sessão',rules:'Regras',world:'Personagens e mundo'};
export const gmKinds={note:'Anotação',checklist:'Lista de tarefas',table:'Tabela sorteável',reference:'Referência vinculada'};
const normal=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const cardsOf=row=>row.state.gmScreen?.cards||[];
function targetFor(card,state){
 return card.targetKind==='book'?state.books.find(book=>book.id===card.targetId):card.targetKind==='character'?state.characters.find(character=>character.id===card.targetId):dndCatalog.find(entry=>entry.id===card.targetId);
}
export function visibleGmCards(row,view={}){
 return cardsOf(row).filter(card=>(!view.category||view.category==='all'||card.category===view.category)&&normal([card.title,card.body,...(card.items||[]).map(item=>item.text),targetFor(card,row.state)?.name].join(' ')).includes(normal(view.query))).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned)));
}
export function renderGmCards(row,ui,view={}){
 if(!row.master)return '';
 const {esc,button}=ui,cards=visibleGmCards(row,view);
 return cards.length?cards.map(card=>{
  const target=card.kind==='reference'?targetFor(card,row.state):null;
  const done=(card.items||[]).filter(item=>item.done).length;
  const body=card.kind==='checklist'?'<ul class="gm-tasks">'+card.items.map(item=>'<li><label class="check"><input type="checkbox" data-gm-task="'+esc(card.id)+'" data-gm-item="'+esc(item.id)+'" '+(item.done?'checked':'')+'><span'+(item.done?' class="is-done"':'')+'>'+esc(item.text)+'</span></label></li>').join('')+'</ul><p class="gm-card-meta">'+done+'/'+card.items.length+' concluídas</p>':card.kind==='table'?(card.lastRoll?'<div class="gm-table-result"><span>Último sorteio · '+card.lastRoll.index+'</span><strong>'+esc(card.lastRoll.text)+'</strong></div>':'')+button('Sortear em segredo','gmTableRoll','small primary','',card.id)+'<details class="gm-table-entries"><summary>Ver '+card.items.length+' entradas</summary><ol>'+card.items.map(item=>'<li>'+esc(item.text)+'</li>').join('')+'</ol></details>':card.kind==='reference'?(target?'<div class="gm-reference"><span>'+esc({book:'Livro · página '+card.page,character:'Ficha'+(target.hidden?' · oculta dos jogadores':''),rule:'SRD 5.2.1 · página '+target.page}[card.targetKind])+'</span><strong>'+esc(target.name)+'</strong>'+button('Abrir referência','gmReference','small','',card.id)+'</div>':'<p class="muted">Referência removida. Edite o cartão para escolher outra.</p>')+(card.body?'<p class="gm-card-text">'+esc(card.body)+'</p>':''):'<p class="gm-card-text">'+esc(card.body||'Edite para adicionar informações.')+'</p>';
  return '<article class="gm-card'+(card.wide?' gm-wide':'')+(card.pinned?' is-pinned':'')+'"><div class="gm-card-heading"><div><p class="gm-card-meta">'+(card.pinned?'Fixado · ':'')+esc(gmKinds[card.kind])+' · '+esc(gmCategories[card.category])+'</p><h3>'+esc(card.title)+'</h3></div><button type="button" class="btn small ghost" data-act="gmCardCollapse" data-id="'+esc(card.id)+'" aria-expanded="'+!card.collapsed+'" aria-label="'+esc((card.collapsed?'Expandir ':'Recolher ')+card.title)+'">'+(card.collapsed?'＋':'−')+'</button></div>'+
   (!card.collapsed?'<div class="gm-card-content">'+body+'</div>':'')+'<div class="gm-card-actions">'+button('Editar','gmCardEdit','small ghost','',card.id)+button(card.pinned?'Desafixar':'Fixar','gmCardPin','small ghost','',card.id)+'<span class="gm-move"><button type="button" class="btn small ghost" data-act="gmCardMove" data-id="'+esc(card.id)+'/up" aria-label="Mover '+esc(card.title)+' para antes">↑</button><button type="button" class="btn small ghost" data-act="gmCardMove" data-id="'+esc(card.id)+'/down" aria-label="Mover '+esc(card.title)+' para depois">↓</button></span>'+button('Remover','gmCardDelete','small ghost danger','',card.id)+'</div></article>';
 }).join(''):'<div class="gm-empty"><h3>'+(cardsOf(row).length?'Nenhum cartão encontrado':'Seu escudo, do seu jeito')+'</h3><p>'+(cardsOf(row).length?'Mude a busca ou a categoria.':'Adicione a abertura da sessão, pistas, NPCs, tarefas e regras que você quer ter à mão.')+'</p>'+button('Adicionar cartão','gmCardEdit','primary','plus')+'</div>';
}
export function partyFieldIds(character,state){
 const fields=sheetFields(state,character).filter(field=>field.type==='number');
 const chosen=state.gmScreen?.partyFields?.[character.id];
 if(chosen)return chosen.filter(id=>fields.some(field=>field.id===id));
 const priorities=character.dnd?['dd-ac','dd-temp','dd-prof','dd-dc','dd-speed','dd-level']:[];
 return [...priorities.filter(id=>fields.some(field=>field.id===id)),...fields.filter(field=>!priorities.includes(field.id)).map(field=>field.id)].slice(0,6);
}
export function gmPartyFieldsEditor(character,row,ui){
 const selected=partyFieldIds(character,row.state),fields=sheetFields(row.state,character).filter(field=>field.type==='number');
 return '<input type="hidden" name="id" value="'+ui.esc(character.id)+'"><p class="muted">Escolha até oito atributos para o resumo. Todos os recursos continuam visíveis.</p><div class="gm-field-choices">'+fields.map(field=>'<label class="check"><input type="checkbox" name="fields" value="'+ui.esc(field.id)+'" '+(selected.includes(field.id)?'checked':'')+'>'+ui.esc(field.label)+'</label>').join('')+'</div>'+ui.submit('Salvar resumo');
}
function party(row,ui){
 const {esc,button}=ui;
 return '<section class="panel gm-party"><div class="section-head"><div><p class="gm-eyebrow">CONSULTA RÁPIDA</p><h2>Fichas à mão</h2></div>'+button('Todas as fichas','nav','small','', 'sheets')+'</div><div class="gm-party-list">'+(row.state.characters.length?row.state.characters.map(character=>{
  const fields=sheetFields(row.state,character).filter(field=>['number','counter'].includes(field.type));
  const counters=fields.filter(field=>field.type==='counter');
  const numbers=fields.filter(field=>field.type==='number');
  const selected=partyFieldIds(character,row.state),summary=selected.map(id=>numbers.find(field=>field.id===id)).filter(Boolean),other=numbers.filter(field=>!selected.includes(field.id));
  const numberLine=fields=>fields.map(field=>'<span><small>'+esc(field.label)+'</small><strong>'+esc(sheetValue(character,field))+'</strong></span>').join('');
  return '<article class="gm-character"><div class="gm-character-heading">'+(character.portrait?'<span class="avatar '+esc(character.color)+'"><img alt="" hidden data-portrait="'+esc(character.portrait.id)+'"></span>':'')+'<div><h3>'+esc(character.name)+'</h3><p>'+esc(character.concept)+(character.hidden?' · <span class="gm-secret">Oculto dos jogadores</span>':'')+'</p></div>'+button('Abrir','character','small','',character.id)+'</div>'+
   '<div class="gm-character-stats">'+numberLine(summary)+'</div>'+counters.map(field=>{
    const [value,max]=String(sheetValue(character,field)||'').split('/'),percent=Number(max)>0?Math.max(0,Math.min(100,Number(value)/Number(max)*100)):0;
    return '<div class="gm-resource"><div><span>'+esc(field.label)+'</span><strong>'+esc(value)+' / '+esc(max||'—')+'</strong><div class="actions">'+button('−','gmResource','small','',character.id+'/'+field.id+'/-1')+button('+','gmResource','small','',character.id+'/'+field.id+'/1')+'</div></div><meter min="0" max="100" value="'+percent+'" aria-label="'+esc(field.label)+'"></meter></div>';
   }).join('')+button('Configurar resumo','gmPartyFields','small ghost','',character.id)+(other.length?'<details><summary>Mais atributos</summary><div class="gm-character-stats">'+numberLine(other)+'</div></details>':'')+
   ((character.rollButtons||[]).length?'<details><summary>Rolagens da ficha · só mestre</summary><div class="actions">'+character.rollButtons.map(roll=>button(roll.name,'gmCharacterRoll','small','',character.id+'/'+roll.id)).join('')+'</div></details>':'')+'</article>';
 }).join(''):'<p class="muted">As fichas criadas na campanha aparecerão aqui, com seus atributos e recursos.</p>')+'</div></section>';
}
function combat(row,ui){
 const {esc,button}=ui,{combat}=normalizeTable(row.state);
 return '<section class="panel gm-combat"><div class="section-head"><h2>Combate da mesa</h2>'+button('Editar ordem','tableCombat','small')+'</div><p class="muted">Mesma ordem e rodada da mesa virtual.</p>'+(combat.entries.length?'<p class="gm-round">Rodada '+combat.round+'</p><ol class="gm-turns">'+combat.entries.map((entry,index)=>{
  const token=row.state.tokens.find(token=>token.id===entry.tokenId);
  return '<li'+(index===combat.active?' class="is-active" aria-current="step"':'')+'><strong>'+entry.value+'</strong><span>'+esc(entry.name)+(token?.hidden?' <small class="gm-secret">Oculto</small>':'')+(token?.statuses?.length?'<small>'+esc(token.statuses.join(' · '))+'</small>':'')+'</span>'+(index===combat.active?'<small>Em ação</small>':'')+'</li>';
 }).join('')+'</ol><div class="actions">'+button('Anterior','gmCombatNext','small','','-1')+button('Próximo turno','gmCombatNext','primary','','1')+'</div>':'<p class="gm-muted-empty">Configure a ordem para acompanhar o encontro sem abrir o mapa.</p>')+
 ((row.state.initiative||[]).length?'<details><summary>Iniciativa antiga · '+row.state.initiative.length+' participantes</summary><p class="muted">Use “Importar iniciativa do escudo” ao editar o combate para aproveitar esta preparação.</p>'+button('Editar preparação antiga','initiative','small')+'</details>':'')+'</section>';
}
export function renderGmScreen(row,ui,view={}){
 if(!row.master)return '';
 const {esc,head,button,area,input,submit}=ui;
 return head('Escudo do mestre','Sua preparação e as informações da mesa, sempre à mão.',button('Ir para a mesa','nav','','table','table')+button('Adicionar cartão','gmCardEdit','primary','plus'))+
  '<div class="gm-banner"><span class="gm-secret">Somente o mestre</span><span>'+esc(row.state.scene)+' · '+esc(row.state.system)+'</span><div class="actions">'+button('Consultar regras','dndReference','small')+button('Biblioteca','nav','small','','library')+'</div></div>'+
  '<div class="gm-layout"><div class="gm-workspace"><section class="gm-board"><div class="gm-board-toolbar">'+input('gmSearch','Buscar no escudo',view.query||'','search','data-gm-search placeholder="Pista, NPC, regra…" autocomplete="off"')+'<nav aria-label="Categorias do escudo">'+Object.entries(gmCategories).map(([id,label])=>'<button type="button" class="btn small '+((view.category||'all')===id?'primary':'ghost')+'" data-act="gmCategory" data-id="'+id+'" aria-pressed="'+((view.category||'all')===id)+'">'+label+'</button>').join('')+'</nav></div><div class="gm-card-grid" data-gm-cards>'+renderGmCards(row,ui,view)+'</div></section>'+party(row,ui)+'</div><aside class="gm-sidebar">'+combat(row,ui)+'<section class="panel gm-roll"><h2>Rolagem privada</h2><form class="stack" data-form="roll"><input type="hidden" name="actor" value="Mestre">'+input('formula','Expressão','1d20','text','required maxlength="240" placeholder="1d20+3 ou 2d6"')+submit('Rolar em segredo')+'</form>'+button('Ver histórico privado','tableRoll','small')+'</section><section class="panel gm-notes"><div class="section-head"><h2>Bloco de notas</h2></div><p class="muted">Suas anotações anteriores continuam aqui.</p><form class="stack" data-form="notes">'+area('text','Notas privadas',view.notes??row.state.notes??'','data-gm-notes maxlength="12000" rows="8"')+'<p class="gm-card-meta" data-gm-notes-status>'+(view.notes!==undefined&&view.notes!==row.state.notes?'Rascunho não salvo · preservado ao navegar nesta aba.':'Notas salvas na campanha.')+'</p>'+submit('Salvar notas')+'</form></section></aside></div>';
}
export function gmCardEditor(card,row,ui){
 const {esc,input,select,area,submit}=ui;
 const options={'':'Escolha uma referência',...Object.fromEntries(row.state.books.map(book=>['book/'+book.id,'PDF · '+book.name])),...Object.fromEntries(row.state.characters.map(character=>['character/'+character.id,'Ficha · '+character.name])),...Object.fromEntries(dndCatalog.map(entry=>['rule/'+entry.id,'SRD · '+entry.name]))};
 return '<input type="hidden" name="id" value="'+esc(card?.id||'')+'"><input type="hidden" name="version" value="'+esc(card?.version||0)+'">'+input('title','Título',card?.title||'','text','required maxlength="100"')+'<div class="form-grid">'+select('kind','Tipo de cartão',gmKinds,card?.kind||'note')+select('category','Categoria',Object.fromEntries(Object.entries(gmCategories).filter(([id])=>id!=='all')),card?.category||'session')+'</div>'+area('body','Conteúdo ou entradas, uma por linha',card?.items?card.items.map(item=>(card.kind==='checklist'?(item.done?'[x] ':'[ ] '):'')+item.text).join('\n'):card?.body||'','maxlength="6000" rows="9"')+'<p class="muted">Tarefas: marque as concluídas com [x]. Tabelas: de 2 a 100 linhas, com a mesma chance por entrada. Nas anotações, o texto é livre.</p><div data-gm-reference '+(card?.kind==='reference'?'':'hidden')+'>'+select('target','Ficha, livro ou regra',options,card?card.targetKind+'/'+card.targetId:'')+input('page','Página do PDF (para livros)',card?.page||1,'number','min="1" max="10000" step="1"')+'<p class="muted">O cartão é privado. Os PDFs da biblioteca continuam disponíveis aos jogadores.</p></div><label class="check"><input name="wide" type="checkbox" '+(card?.wide?'checked':'')+'> Cartão largo em telas grandes</label>'+submit('Salvar cartão');
}
