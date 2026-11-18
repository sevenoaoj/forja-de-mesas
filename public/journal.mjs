const kinds={note:'Anotação',item:'Inventário',clue:'Pista',character:'Personagem',place:'Local',quest:'Missão'};
const norm=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export function visibleJournal(row,view={}){return (row.state.journal||[]).filter(e=>(!view.kind||view.kind==='all'||e.kind===view.kind)&&norm(e.title+' '+e.body+(row.master?' '+e.gmNotes:'')).includes(norm(view.query)));}
export function renderJournal(row,ui,view={}){
 const {esc,button,head}=ui,entries=visibleJournal(row,view),all=row.state.journal||[];
 return head('Diário da campanha',row.master?'Prepare pistas e acompanhe os registros dos personagens.':'Suas anotações, inventário e descobertas da campanha.',button(row.master?'Novo documento':'Novo registro','journalEdit','primary','plus'))+
 '<section class="journal-toolbar"><label>Buscar no diário<input type="search" data-journal-search value="'+esc(view.query||'')+'" placeholder="Título ou conteúdo" autocomplete="off"></label><label>Categoria<select data-journal-kind><option value="all">Todas</option>'+Object.entries(kinds).map(([id,label])=>'<option value="'+id+'" '+(view.kind===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label></section><div class="journal-grid">'+(entries.length?entries.map(e=>{
 const sharing=e.audience==='all'?'Visível para todos':e.audience==='selected'?'Compartilhado com '+(e.recipientIds||[]).length+' personagem(ns)':e.authorName?'Autor e mestre':'Só mestre';
 const editable=row.master||e.canEdit;
 const collapsed=view.collapsed?.includes(e.id);
 return '<article class="panel journal-entry journal-'+e.kind+'"><header><div><p class="journal-meta">'+esc(kinds[e.kind])+' · '+esc(e.authorName||'Mestre')+(e.kind==='quest'?' · '+(e.status==='completed'?'Concluída':'Em andamento'):'')+'</p><h2>'+esc(e.title)+'</h2></div><button type="button" class="btn small ghost" data-act="journalCollapse" data-id="'+esc(e.id)+'" aria-expanded="'+!collapsed+'" aria-label="'+esc((collapsed?'Expandir ':'Recolher ')+e.title)+'">'+(collapsed?'＋':'−')+'</button></header>'+
 (!collapsed?'<p class="journal-body">'+esc(e.body||'Sem conteúdo.')+'</p>'+(row.master&&e.gmNotes?'<details class="journal-secret"><summary>Segredo do mestre</summary><p class="journal-body">'+esc(e.gmNotes)+'</p></details>':''):'')+
 (!collapsed?'<div class="actions">'+(row.state.inventory||[]).filter(item=>item.journalId===e.id).map(item=>button('Item: '+item.name,'itemOpen','small','',item.id)).join('')+'</div>':'')+
 (editable?'<footer><span class="journal-sharing '+(e.audience==='private'?'is-private':'')+'">'+sharing+'</span><div class="actions">'+button('Editar','journalEdit','small','',e.id)+(e.audience!=='private'?button('Recolher da mesa','journalHide','small','',e.id):button('Mostrar a todos','journalShow','small','',e.id))+(e.kind==='quest'?button(e.status==='completed'?'Reabrir missão':'Concluir missão','journalStatus','small','',e.id):'')+button('Excluir','journalDelete','small danger','',e.id)+'</div></footer>':'')+'</article>';
 }).join(''):'<div class="panel journal-empty"><h2>'+(all.length?'Nenhum resultado':'O diário está começando')+'</h2><p>'+(all.length?'Tente outra busca ou categoria.':row.master?'Crie uma pista, um personagem, um local ou uma missão. Tudo começa privado.':'Crie seu primeiro registro: uma anotação da sessão, uma lembrança ou um item do inventário.')+'</p></div>')+'</div>';
}
export function journalEditor(entry,row,ui){
 const {esc,input,select,area,submit}=ui;
 return '<input type="hidden" name="id" value="'+esc(entry?.id||'')+'"><input type="hidden" name="version" value="'+(entry?.version||0)+'">'+input('title','Título',entry?.title||'','text','required maxlength="120"')+'<div class="form-grid">'+select('kind','Categoria',kinds,entry?.kind||'note')+select('status','Estado (somente missões)',{active:'Em andamento',completed:'Concluída'},entry?.status||'active')+'</div>'+area('body','Conteúdo compartilhável',entry?.body||'','rows="8"')+(row.master?'<details class="journal-secret" '+(entry?.gmNotes?'open':'')+'><summary>Segredo do mestre · nunca compartilhado</summary>'+area('gmNotes','Notas privadas',entry?.gmNotes||'','maxlength="8000" rows="5"')+'</details>':'')+select('audience','Quem pode ler',{private:row.master&&!entry?.authorName?'Só mestre':'Autor e mestre',all:'Todos os jogadores',selected:'Personagens escolhidos'},entry?.audience||'private')+'<fieldset class="journal-recipients"><legend>Personagens escolhidos</legend><p class="muted">Esta seleção só é usada na opção “Personagens escolhidos”. Quem controlar a ficha poderá ler.</p>'+row.state.characters.filter(c=>!c.hidden).map(c=>'<label class="check"><input type="checkbox" name="recipientIds" value="'+esc(c.id)+'" '+(entry?.recipientIds?.includes(c.id)?'checked':'')+'>'+esc(c.name)+'</label>').join('')+'</fieldset><p class="muted">Registros privados ficam disponíveis ao autor e ao mestre. Ao salvar com compartilhamento, o conteúdo fica disponível no diário dos destinatários. Recolher interrompe o acesso futuro; não desfaz o que já foi lido.</p>'+submit('Salvar documento');
}
export function journalFormData(form){return {id:form.get('id')||undefined,version:Number(form.get('version')),title:form.get('title'),kind:form.get('kind'),body:form.get('body'),gmNotes:form.get('gmNotes'),audience:form.get('audience'),recipientIds:form.getAll('recipientIds'),status:form.get('status')};}

// Resolve within the imported vault first. Ambiguous short names stay as text.
// Read the common scalar, inline-list and block-list forms used by Obsidian.
export function noteProperties(body=''){
 const front=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(body);
 const tags=[],aliases=[];
 let list;
 for(const line of (front?.[1]||'').split(/\r?\n/)){
  const field=/^(tags|aliases):\s*(.*)$/i.exec(line);
  if(field)list=field[1].toLowerCase()==='tags'?tags:aliases;
  else if(!/^\s*-\s+/.test(line)){list=null;continue;}
  if(!list)continue;
  const raw=field?field[2]:line.replace(/^\s*-\s+/,'');
  for(const item of raw.replace(/^\[|\]$/g,'').split(',')){
   const value=item.trim().replace(/^["']|["']$/g,'').trim();
   if(value)list.push(value);
  }
 }
 return {tags,aliases,text:front?body.slice(front[0].length):body,front:front?.[1]||''};
}
function noteResolver(entries){
 const strip=path=>path.replace(/\.md$/i,'');
 const notes=entries.filter(e=>e.sourcePath),byPath=new Map(notes.map(e=>[strip(e.sourcePath),e]));
 const aliases=new Map(notes.map(note=>[note.id,noteProperties(note.body).aliases]));
 return (entry,target)=>{
  const source=entry.sourcePath||'';
 const root=source.includes('/')?source.split('/')[0]+'/':'';

  try{target=decodeURIComponent(target.split('#')[0]);}catch{return;}
  if(!target)return entry;
  if(/^[a-z]+:|^\/\//i.test(target))return;
  const path=strip(target),parts=source.split('/').slice(0,-1);
  for(const part of path.split('/')){if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);}
  const exact=byPath.get(parts.join('/'))||byPath.get(root+path)||byPath.get(path);
  if(exact)return exact;
  if(path.includes('/'))return;
  const matches=notes.filter(e=>e.sourcePath.startsWith(root)&&(strip(e.sourcePath.split('/').at(-1))===path||aliases.get(e.id).includes(path)));
  if(matches.length===1)return matches[0];
 };
}
const noteLinks=()=>/(!?)\[\[([^\]\n]+)\]\]|(!?)\[([^\]\n]+)\]\(([^)\n]+)\)/g;
function linkParts(match){
 const [target,label]=match[2]?.split('|')||[match[5],match[4]];
 return {target,label:label||target,embed:Boolean(match[1]||match[3])};
}
export function noteConnections(entries){
 const resolve=noteResolver(entries),edges=[];
 for(const note of entries){
  const prose=(note.body||'').split(/^\s*```.*$/m).filter((_,i)=>i%2===0).join('\n');
  const targets=new Set();
  for(const match of prose.matchAll(noteLinks())){
   const {target,embed}=linkParts(match),linked=!embed&&resolve(note,target);
   if(linked&&linked.id!==note.id)targets.add(linked.id);
  }
  for(const to of targets)edges.push({from:note.id,to});
 }
 return edges;
}
export function noteReader(entry,entries,ui){
 const {esc}=ui,resolve=noteResolver(entries);
 const incomingIds=new Set(noteConnections(entries).filter(edge=>edge.to===entry.id).map(edge=>edge.from));
 const incoming=entries.filter(note=>incomingIds.has(note.id));
 function inline(line){
  let html='',last=0;
  for(const match of line.matchAll(noteLinks())){
   html+=esc(line.slice(last,match.index));last=match.index+match[0].length;
   const {target,label,embed}=linkParts(match);
   const found=!embed&&resolve(entry,target);
   html+=found?'<button type="button" data-act="prepRead" data-id="'+esc(found.id)+'"'+(target.includes('#')?' data-jump-heading="'+esc(target.slice(target.indexOf('#')+1))+'"':'')+'>'+esc(label)+'</button>':esc(match[0]);
  }
  return html+esc(line.slice(last));
 }
 let fenced=false;
 const props=noteProperties(entry.body);
 const body=props.text.split('\n').map(line=>{
  if(/^\s*```/.test(line)){fenced=!fenced;return esc(line);}
  if(fenced)return esc(line);
  const heading=/^#{1,6}\s+(.+)$/.exec(line);
  return heading?'<strong data-note-heading="'+esc(heading[1])+'" tabindex="-1">'+inline(heading[1])+'</strong>':inline(line);
 }).join('\n');
 return (entry.sourcePath?'<p class="muted">'+esc(entry.sourcePath)+'</p>':'')+(props.front?'<details><summary>Propriedades da nota</summary><pre class="prep-reader">'+esc(props.front)+'</pre></details>':'')+
 (props.tags.length?'<div class="actions">'+props.tags.map(tag=>ui.button('#'+tag.replace(/^#/,''),'prepTag','small','',tag.replace(/^#/,''))).join('')+'</div>':'')+'<div class="prep-reader">'+(body||'Sem conteúdo.')+'</div>'+
 (entry.gmNotes?'<details><summary>Segredo do mestre</summary><p class="prep-reader">'+esc(entry.gmNotes)+'</p></details>':'')+ui.button('Editar anotação','journalEdit','small','',entry.id)+
 (incoming.length?'<section><h3>Notas que mencionam esta</h3><div class="actions">'+incoming.map(n=>ui.button(n.title,'prepRead','small','',n.id)).join('')+'</div></section>':'');
}
export async function collectMarkdown(files,existing,update=false){
 const known=new Map(existing.map(e=>[e.sourcePath,e])),pending=[],candidates=new Map();
 let skipped=0,bytes=0;const conflicts=[];
 for(const file of files){
  const path=file.webkitRelativePath||file.name;
  if(!/\.md$/i.test(path)||path.split('/').some(part=>part.startsWith('.')))continue;
  if(!update&&known.has(path)||candidates.has(path)){skipped++;continue;}
  bytes+=file.size;
  if(bytes>512*1024)throw new Error('A seleção excede 512 KB. Escolha menos arquivos Markdown.');
  candidates.set(path,file);
 }
 if([...candidates.keys()].filter(path=>!known.has(path)).length+existing.length>200)throw new Error('O diário comporta até 200 documentos. Escolha menos notas.');
 for(const [path,file] of candidates){
  const body=await file.text();
  const old=known.get(path);
  if(old&&old.body===body){skipped++;continue;}
  if(old&&(old.sourceEdited===true||old.audience!=='private'||old.sourceEdited===undefined&&old.version>1)){conflicts.push(path);continue;}
  pending.push({path,body,...(old?{version:old.version}:{})});
 }
 if(!pending.length&&!skipped&&!conflicts.length)throw new Error('Selecione uma pasta ou arquivos .md.');
 return {pending,skipped,...(update?{conflicts}:{})};
}
