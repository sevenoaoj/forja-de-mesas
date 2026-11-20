import {inventoryKinds as kinds,readingKinds,canEquipKind} from '../model.mjs';
const readable=kind=>Object.hasOwn(readingKinds,kind)||kind==='custom';
// Miniatures use the same silhouette in the backpack and in the pickup dialog.
const itemArt={
 gear:'<path fill="#97613f" d="M33 27v-5q0-12 15-12t15 12v5h-7v-5q0-6-8-6t-8 6v5z"/><rect x="17" y="26" width="62" height="55" rx="10" fill="#af7951"/><path fill="#d1a277" d="M15 28q32-10 66 0l-4 21-29 9-29-9z"/><path fill="#624437" d="M29 47h8v25h-8zm30 0h8v25h-8z"/><path fill="#ecca84" d="M27 53h12v8H27zm30 0h12v8H57z"/>',
 weapon:'<path fill="#c9d8df" d="m32 57 40-43 12-3-3 15-41 39z"/><path stroke="#77939e" d="m38 59 37-39"/><path fill="#805348" d="m16 73 16-19 9 8-17 19z"/><path stroke="#daae7b" d="m22 69 7 4m-2-10 7 4"/><path fill="#dfb86d" d="m22 49 5-5 25 23-5 6zM12 76l5-6 12 11-5 6z"/>',
 armor:'<path fill="#8298ab" d="m22 24 15-8q11 12 22 0l15 8 10 19-15 8-5 27q-16 10-32 0l-5-27-15-8z"/><path fill="#c1ced4" d="m32 26 6-5q10 9 20 0l6 5 3 20-8 23-11 6-11-6-8-23z"/><path fill="#91a8b8" d="m48 40 18-9 1 15-8 23-11 6z"/><path d="m15 39 13 6m40 0 13-6m-46 33 13 6 13-6"/>',
 consumable:'<path fill="#c1a07d" d="m37 12 22 0-2 13H39z"/><path fill="#d0e9df" d="M35 24h26v7h-5v10c0 8 18 12 18 29 0 12-10 15-26 15s-26-3-26-15c0-17 18-21 18-29V31h-5z"/><path fill="#63ab94" d="M30 61q10-5 18 0t17 0q5 6 4 11-1 9-21 9t-21-9q-1-5 3-11z"/><path stroke="#fff8da" stroke-width="4" d="m33 55 7-7"/><circle cx="56" cy="69" r="3" fill="#bcdfbf" stroke="none"/>',
 treasure:'<path fill="#905d3d" d="M13 47q0-23 15-23h40q15 0 15 23v29l-35 6-35-6z"/><path fill="#bc824b" d="M14 47q0-21 14-21h40q14 0 14 21l-34 6z"/><path fill="#dfb962" d="m13 46 35 5 35-5v8l-35 6-35-6zM24 27l7-2-3 22-7-1zm42-2 7 2 3 19-7 1z"/><rect x="42" y="49" width="13" height="17" rx="3" fill="#f2d486"/><path d="M48 55v5"/>',
 quest:'<g transform="rotate(38 48 48)"><path fill="#c99e57" d="M44 40h8v37h12v8H44z"/><path fill="#e9c778" fill-rule="evenodd" d="M48 9c7 0 10 5 11 9 9 1 13 8 9 15-3 6-12 9-20 14-8-5-17-8-20-14-4-7 0-14 9-15 1-4 4-9 11-9zm0 9-7 10 7 10 7-10z"/><path stroke="#f9e1aa" d="M47 50v22"/></g>',
 note:'<g transform="rotate(-7 48 48)"><path fill="#f2d28a" d="M20 16h57v43L59 78H20z"/><path fill="#cba35f" d="M59 78V59h18"/><path d="m31 34 32-2m-31 12 22-1m-21 10 15-1"/></g>',
 letter:'<path fill="#e1c49e" d="M9 29h78v49H9z"/><path d="m10 77 28-25m48 25L59 52"/><path fill="#f7e2bf" d="m9 29 39 31 39-31z"/><circle cx="48" cy="58" r="9" fill="#984744"/><path stroke="#edbe94" d="m45 58 3-4 3 4-3 4z"/>',
 bookPage:'<path fill="#a87e4d" d="M10 21q18-8 38 0 20-8 38 0v54q-18-6-38 1-20-7-38-1z"/><path fill="#eee0b9" d="M14 17q18-5 34 3 16-8 34-3v53q-18-4-34 3-16-7-34-3z"/><path d="M48 21v51M22 31l18 2m-18 8 18 2m16-10 17-2m-17 12 17-2"/><path fill="#973b43" d="M62 17v24l4-5 4 4V16"/>',
 diaryPage:'<rect x="22" y="12" width="55" height="72" rx="4" fill="#70503d"/><path fill="#e7d5b4" d="M28 15h45v64H28z"/><path d="M35 29h28m-28 10h26m-26 10h20m-20 10h25M18 24h11m-11 15h11m-11 15h11m-11 15h11"/>',
 phone:'<rect x="27" y="7" width="43" height="82" rx="9" fill="#23313e"/><rect x="31" y="16" width="35" height="61" rx="3" fill="#416a75"/><path fill="#d6eae5" d="M35 26h23v11H41l-6 4z"/><path fill="#96cebb" d="M43 47h19v15l-5-4H43z"/><path stroke="#abc4c8" d="M44 82h10"/>',
 photo:'<g transform="rotate(7 48 48)"><path fill="#f2eade" d="M17 12h63v73H17z"/><path fill="#82989e" d="M22 18h53v48H22z"/><circle cx="61" cy="31" r="6" fill="#f4d29d"/><path fill="#425850" d="m22 60 18-22 12 16 7-8 16 16v4H22z"/><path d="m31 75 29-1"/></g>',
 record:'<path fill="#b68e59" d="M9 28h29l6 6h43v44H9z"/><path fill="#f0e7d6" d="M19 19h53v49H19z"/><path d="M27 30h33m-33 8h25"/><path fill="#d6b582" d="m9 44 77-2-4 37H14z"/><path fill="#f4e4c4" d="M21 53h31v10H21z"/>',
 custom:'<path fill="currentColor" d="m13 48 36-35 28 2 3 29-37 37z"/><circle cx="65" cy="29" r="4" fill="#352e32"/><path d="m28 49 17 17m-11-24 16 16"/>'
};
function itemIcon(kind){
 return Object.hasOwn(itemArt,kind)?'<svg class="document-miniature" viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke="#443b34" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">'+itemArt[kind]+'</svg>':'◇';
}
export function updateReadingFields(form){
 const kind=form.elements.kind.value;
 form.querySelector('[data-item-reading]').hidden=!readable(kind);
 form.querySelector('[data-item-category]').hidden=kind!=='custom';
 form.elements.categoryName.required=kind==='custom';
 form.querySelector('[data-phone-help]').hidden=kind!=='phone';
}
const photoSource=value=>typeof value==='string'&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+=*$/.test(value);
function phoneReader(e,esc){
 const photos=(e.photos||[]).filter(p=>photoSource(p?.src));
 const thumb=(photo,i)=>'<button type="button" class="phone-thumb" data-phone-photo="'+i+'" aria-label="Ampliar '+esc(photo.name)+'"><img loading="lazy" alt="'+esc(photo.name)+'" src="'+photo.src+'"></button>';
 const chats=new Map();
 for(const block of (e.content||'').split(/\r?\n\s*\r?\n/).filter(Boolean)){
   const [first,...lines]=block.split(/\r?\n/),contact=lines.length?first:'Mensagens';
   if(!chats.has(contact))chats.set(contact,[]);
   const bubbles=chats.get(contact);
   for(const line of lines.length?lines:[first]){
     const outgoing=line.startsWith('>'),message=outgoing?line.slice(1).trim():line;
     const index=photos.findIndex(p=>message==='[foto:'+p.name+']');
     bubbles.push('<div class="phone-bubble '+(outgoing?'sent':'')+'">'+(index>=0?thumb(photos[index],index):esc(message))+'</div>');
   }
 }
 const apps='<nav aria-label="Aplicativos"><button type="button" data-phone-app="messages" aria-pressed="true">Mensagens</button><button type="button" data-phone-app="photos" aria-pressed="false">Fotos · '+photos.length+'</button></nav>';
 return '<section data-document="phone" class="item-reading reading-phone"><h4>'+esc(e.origin||e.name)+'</h4>'+apps+'<div data-phone-screen="messages">'+([...chats].map(([name,lines])=>'<details><summary>'+esc(name)+'</summary>'+lines.join('')+'</details>').join('')||'<p>Nenhuma conversa.</p>')+'</div><div data-phone-screen="photos" hidden><div class="phone-gallery">'+(photos.map(thumb).join('')||'<p>Nenhuma foto.</p>')+'</div></div><div data-phone-viewer hidden><button type="button" data-phone-back>‹ Voltar</button><img alt=""><p></p></div></section>';
}
export function phoneClick(target){
 const phone=target.closest('.reading-phone');if(!phone)return;
 const button=target.closest('button');if(!button)return;
 const viewer=phone.querySelector('[data-phone-viewer]'),nav=phone.querySelector('nav');
 if(button.hasAttribute('data-phone-photo')){
   const image=button.querySelector('img');viewer.querySelector('img').src=image.src;viewer.querySelector('img').alt=image.alt;viewer.querySelector('p').textContent=image.alt;
   phone.querySelector('[data-phone-screen]:not([hidden])').hidden=true;nav.hidden=true;viewer.hidden=false;viewer.querySelector('button').focus();return;
 }
 const app=button.dataset.phoneApp||nav.querySelector('[aria-pressed=true]').dataset.phoneApp;
 viewer.hidden=true;nav.hidden=false;
 for(const tab of nav.querySelectorAll('button'))tab.setAttribute('aria-pressed',String(tab.dataset.phoneApp===app));
 for(const screen of phone.querySelectorAll('[data-phone-screen]'))screen.hidden=screen.dataset.phoneScreen!==app;
 if(button.hasAttribute('data-phone-back'))nav.querySelector('[aria-pressed=true]').focus();
}
export async function preparePhonePhotos(form,item){
 const existing=(item?.photos||[]).filter((_,i)=>!form.querySelector('[data-remove-photo="'+i+'"]')?.checked);
 const files=[...form.elements.phoneFiles.files];
 if(existing.length+files.length>6)throw new Error('Escolha até seis fotos por celular.');
 for(const file of files){
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('Use fotos PNG, JPG ou WebP de até 12 MB.');
   if(existing.some(p=>p.name===file.name))throw new Error('Escolha fotos com nomes diferentes.');
   const image=await createImageBitmap(file);
   try{
     const canvas=document.createElement('canvas');let scale=Math.min(1,960/Math.max(image.width,image.height)),src;
     do{canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);src=canvas.toDataURL('image/jpeg',.8);scale*=.8;}while(src.length>150000);
     existing.push({name:file.name,src});
   }finally{image.close();}
 }
 return existing;
}
function readingCard(e,esc){
 if(e.kind==='phone')return phoneReader(e,esc);
 if(!readable(e.kind)||!e.content&&!e.origin)return '';
 return '<section data-document="'+esc(e.kind)+'" class="item-reading '+(e.kind==='diaryPage'?'reading-diary':'reading-paper')+'"><h4>'+esc(e.categoryName||kinds[e.kind])+'</h4>'+(e.origin?'<small>'+esc(e.origin)+'</small>':'')+'<p>'+esc(e.content||'')+'</p></section>';
}
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const hidden=(e,esc)=>'<input type="hidden" name="id" value="'+esc(e?.id||'')+'"><input type="hidden" name="version" value="'+(e?.version||0)+'">';
export const itemAccent=e=>/^#[0-9a-f]{6}$/i.test(e?.accent||'')?e.accent.toLowerCase():'#dfbb73';
export function itemTheme(e){const color=itemAccent(e);return '--item-accent:'+color+';--item-glow:'+[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',');}
export function updateItemAccent(root){const picker=root.querySelector('[data-item-accent]'),preview=root.querySelector('[data-item-accent-preview]');if(picker&&preview)preview.setAttribute('style',itemTheme({accent:picker.value}));}
export const itemPortrait=(e,esc)=>e.portrait&&typeof e.portrait==='object'&&e.portrait.id?'<img class="item-portrait" hidden data-portrait="'+esc(e.portrait.id)+'" alt="Retrato de '+esc(e.name)+'">':/^https?:\/\//i.test(e.portrait||'')?'<img class="item-portrait" src="'+esc(e.portrait)+'" alt="Retrato de '+esc(e.name)+'" loading="lazy" referrerpolicy="no-referrer">':'<div class="item-portrait item-placeholder" aria-hidden="true">'+itemIcon(e.kind)+'</div>';
export function itemIdentity(e,ui){const {esc}=ui;return '<header class="item-identity" '+(readable(e.kind)?'data-document="'+esc(e.kind)+'" ':'')+'style="'+itemTheme(e)+'"><div class="item-art">'+itemPortrait(e,esc)+'</div><p class="item-category">'+esc(e.categoryName||kinds[e.kind]||e.kind||'Item')+(e.rarity?' <span aria-hidden="true">·</span> '+esc(e.rarity):'')+'</p><h3 class="item-name">'+esc(e.name)+'</h3></header>';}
function usageBar(e,ui,controls=false,restore=false){
 if(e.kind!=='consumable')return '';
 const max=(e.usesPerUnit??1)*(e.quantity??1),value=Number(e.uses??max);
 const control=(delta,label,disabled)=>'<button type="button" class="btn small '+(delta<0?'primary':'')+'" data-act="itemUse" data-id="'+ui.esc(e.id)+'" data-version="'+ui.esc(e.version)+'" data-delta="'+delta+'" aria-label="'+label+' · '+ui.esc(e.name)+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
 return '<div class="item-uses"><span>'+(value?'Usos disponíveis':'Esgotado')+' <strong>'+value+' / '+max+'</strong></span><div><progress aria-label="Usos disponíveis" max="'+(max||1)+'" value="'+value+'"></progress></div>'+
   (controls?'<div class="actions">'+control(-1,'Consumir 1 uso',value<=0)+(restore?control(1,'Restaurar 1 uso',value>=max):'')+'</div>':'')+'</div>';
}
function equipControl(e,row,{esc}){
 if(!canEquipKind(e.kind)||!e.characterId||(!row.master&&row.characterId!==e.characterId)||(!e.quantity&&!e.equipped))return '';
 const label=e.equipped?'Desequipar':'Equipar';
 return '<button type="button" class="btn small" data-act="itemEquip" data-id="'+esc(e.id)+'" data-version="'+esc(e.version)+'" data-equip="'+(!e.equipped)+'" aria-label="'+label+' '+esc(e.name)+'">'+label+'</button>';
}
export function inventoryCards(items,row,ui){
 if(!items.length||items.every(e=>!e.characterId))return storedItemCards(items,row,ui);
 const equipped=items.filter(e=>e.equipped),consumables=items.filter(e=>e.kind==='consumable'),stored=items.filter(e=>!e.equipped&&e.kind!=='consumable');
 const worn=equipped.map(e=>{
   const owner=row.master?row.state.characters?.find(c=>c.id===e.characterId)?.name:'';
   return '<li style="'+itemTheme(e)+'"><button type="button" class="worn-item" data-act="itemOpen" data-id="'+ui.esc(e.id)+'">'+itemPortrait(e,ui.esc)+'<span><strong>'+ui.esc(e.name)+'</strong><small>'+ui.esc([owner,e.categoryName||kinds[e.kind]].filter(Boolean).join(' · '))+'</small></span></button>'+equipControl(e,row,ui)+'</li>';
 }).join('');
 return '<section class="worn-section"><h3>Equipados <small>'+equipped.length+'</small></h3>'+(worn?'<ul>'+worn+'</ul>':'<p class="muted">Nenhum item equipado nesta seleção.</p>')+'</section>'+
   (consumables.length?'<h3 class="pack-heading">Consumíveis <small>'+consumables.length+'</small></h3>'+storedItemCards(consumables,row,ui):'')+
   (stored.length?'<h3 class="pack-heading">Na mochila <small>'+stored.length+'</small></h3>'+storedItemCards(stored,row,ui):'');
}
function storedItemCards(items,row,ui){const {esc,button}=ui;return '<div class="inventory-grid">'+(items.length?items.map(e=>'<article class="panel item-card" style="'+itemTheme(e)+'">'+itemIdentity(e,ui)+usageBar(e,ui,!!e.characterId&&(row.master||row.characterId===e.characterId))+'<p class="item-excerpt">'+esc(e.description||'Este item ainda não tem descrição.')+'</p><div class="item-card-footer"><p class="item-stock">'+(!e.characterId?'Catálogo do mestre':'<strong>'+esc(e.quantity)+' un.</strong> · '+(e.weight*e.quantity).toLocaleString('pt-BR')+' kg'+(e.equipped?' · <span class="item-equipped">Equipado</span>':''))+'</p><div class="actions">'+equipControl(e,row,ui)+button('Abrir item','itemOpen','small','',e.id)+(row.master&&!e.characterId?button('Entregar','itemGrant','small primary','',e.id)+button('Colocar na mesa','lootPlace','small','',e.id):'')+'</div></div></article>').join(''):'<p class="panel muted">Nenhum item aqui. '+(row.master?'Prepare um item no catálogo e entregue a uma ficha.':'O mestre pode entregar itens à sua ficha.')+'</p>')+'</div>';}
export function renderInventory(row,ui,view={}){const {esc,head,button}=ui;const options=(row.state.characters||[]).filter(c=>row.master||c.access==='full');const scope=view.scope|| (row.master?'catalog':'all');let items=(row.state.inventory||[]).filter(e=>scope==='catalog'?!e.characterId:scope==='all'?!!e.characterId:e.characterId===scope).filter(e=>norm([e.name,e.description,e.properties,e.categoryName||kinds[e.kind],e.origin].join(' ')).includes(norm(view.query)));
 return head('Inventário',row.master?'Prepare itens no catálogo e entregue cópias independentes às fichas.':'Equipamentos e descobertas do seu personagem.',row.master?button('Preparar item','itemEdit','primary','plus'):'')+'<div class="journal-toolbar"><label>Buscar item<input type="search" data-inventory-search value="'+esc(view.query||'')+'" placeholder="Nome, descrição ou propriedades"></label><label>Inventário<select data-inventory-scope>'+(row.master?'<option value="catalog" '+(scope==='catalog'?'selected':'')+'>Catálogo do mestre</option>':'')+'<option value="all" '+(scope==='all'?'selected':'')+'>Itens nas fichas</option>'+options.map(c=>'<option value="'+esc(c.id)+'" '+(scope===c.id?'selected':'')+'>'+esc(c.name)+(c.hidden?' · oculta':'')+'</option>').join('')+'</select></label></div><div data-inventory-results>'+inventoryCards(items,row,ui)+'</div>';}
export function sheetInventory(character,row,ui){const items=(row.state.inventory||[]).filter(e=>e.characterId===character.id);return '<section class="panel sheet-inventory"><header><h2>Inventário</h2>'+ui.button('Gerenciar inventário','inventoryForSheet','small','',character.id)+'<p class="muted">'+items.reduce((n,e)=>n+e.quantity,0)+' unidades · '+items.reduce((n,e)=>n+e.quantity*e.weight,0).toLocaleString('pt-BR')+' kg</p></header>'+inventoryCards(items,row,ui)+'</section>';}
export function itemEditor(e,row,ui){const {esc,input,area,select,submit}=ui;return hidden(e,esc)+input('name','Nome do item',e?.name||'','text','required maxlength="120"')+'<div class="item-accent-editor"><label>Cor dos destaques<input type="color" name="accent" data-item-accent value="'+itemAccent(e)+'"></label><div class="item-accent-preview" data-item-accent-preview style="'+itemTheme(e)+'"><span>Prévia do destaque</span></div></div><label>Retrato do item<input type="file" name="portraitFile" accept="image/png,image/jpeg,image/webp,image/gif"></label><p class="muted">Envie uma imagem do computador. PNG, JPG, WebP ou GIF, até 3 MB.</p>'+(e?.portrait?itemPortrait(e,esc)+'<label class="check"><input type="checkbox" name="removePortrait"> Remover retrato atual</label>':'')+'<div class="form-grid">'+select('kind','Categoria',kinds,e?.kind||'gear')+'<div data-item-uses-field '+(e?.kind==='consumable'?'':'hidden')+'>'+input('usesPerUnit','Usos por unidade',e?.usesPerUnit??1,'number','min="1" max="9999" step="1" required '+(e?.kind==='consumable'?'':'disabled'))+'</div>'+input('rarity','Raridade',e?.rarity||'','text','maxlength="80"')+input('weight','Peso por unidade (kg)',e?.weight||0,'number','min="0" max="1000000" step="0.001" required')+input('value','Valor e moeda',e?.value||'','text','maxlength="120" placeholder="Ex.: 50 PO"')+'</div>'+'<div data-item-category '+(e?.kind==='custom'?'':'hidden')+'>'+input('categoryName','Nome da categoria',e?.categoryName||'','text','maxlength="60" list="known-item-categories"')+'<datalist id="known-item-categories">'+[...new Set((row.state.inventory||[]).filter(i=>i.kind==='custom'&&i.categoryName).map(i=>i.categoryName))].map(label=>'<option value="'+esc(label)+'"></option>').join('')+'</datalist></div><div data-item-reading '+(readable(e?.kind)?'':'hidden')+'>'+input('origin','Autor, origem ou data (opcional)',e?.origin||'','text','maxlength="160"')+'<div data-phone-help '+(e?.kind==='phone'?'':'hidden')+'><label>Fotos do celular<input type="file" multiple name="phoneFiles" accept="image/jpeg,image/png,image/webp"></label>'+(e?.photos||[]).map((p,i)=>'<label><input type="checkbox" data-remove-photo="'+i+'"> Remover '+esc(p.name)+'</label>').join('')+'<small>Até seis fotos. Comece cada conversa pelo nome do contato e separe conversas com uma linha em branco. Use uma linha por mensagem, &gt; para respostas do dono e [foto:nome.jpg] para anexar uma foto da galeria.</small></div>'+area('content','Conteúdo que o portador pode ler',e?.content||'','rows="8" maxlength="24000"')+'</div>'+area('description','Descrição',e?.description||'','rows="5" maxlength="8000"')+area('properties','Propriedades, efeitos e regras',e?.properties||'','rows="4" maxlength="4000"')+select('journalId','Documento relacionado no diário',{'':'Sem vínculo',...Object.fromEntries((row.state.journal||[]).map(j=>[j.id,j.title]))},e?.journalId||'')+'<p class="muted">O vínculo respeita as permissões do diário. Compartilhe o documento separadamente.</p>'+area('gmNotes','Segredos do mestre',e?.gmNotes||'','rows="4" maxlength="8000"')+'<p class="muted">Alterar um item não altera as cópias já entregues.</p>'+submit('Salvar item');}
export function itemGrantForm(e,row,ui){const {esc,input,select,submit}=ui;return hidden(e,esc)+'<p>Entregar uma cópia de <strong>'+esc(e.name)+'</strong>. O original permanece no catálogo.</p>'+select('characterId','Ficha destinatária',Object.fromEntries(row.state.characters.map(c=>[c.id,c.name+(c.hidden?' · oculta':'')])),'')+input('quantity','Quantidade',1,'number','min="1" max="999999" step="1" required')+submit('Entregar à ficha');}
export function itemDetails(e,row,ui){const {esc,button}=ui;const journal=row.state.journal?.find(j=>j.id===e.journalId);return '<article class="item-details" style="'+itemTheme(e)+'">'+itemIdentity(e,ui)+usageBar(e,ui,Boolean(e.characterId)&&(row.master||row.characterId===e.characterId),true)+'<section class="item-description" aria-label="Descrição do item"><p class="journal-body">'+esc(e.description||'Sem descrição.')+'</p></section>'+readingCard(e,esc)+(e.properties?'<section class="item-properties"><h4>Propriedades e efeitos</h4><p class="journal-body">'+esc(e.properties)+'</p></section>':'')+'<dl class="item-facts"><div><dt>Peso por unidade</dt><dd>'+esc(e.weight)+' kg</dd></div><div><dt>Valor</dt><dd>'+esc(e.value||'—')+'</dd></div>'+(e.characterId?'<div><dt>Quantidade</dt><dd>'+esc(e.quantity)+' unidades</dd></div><div><dt>Local</dt><dd>'+(e.equipped?'Equipado':'Na mochila')+'</dd></div>':'')+'</dl>'+(e.characterId&&e.notes?'<section class="item-properties"><h4>Suas anotações</h4><p class="journal-body">'+esc(e.notes)+'</p></section>':'')+(journal?'<aside class="panel"><h3>Diário · '+esc(journal.title)+'</h3><p class="journal-body">'+esc(journal.body)+'</p></aside>':'')+(row.master&&e.gmNotes?'<details class="journal-secret"><summary>Segredos do mestre</summary><p class="journal-body">'+esc(e.gmNotes)+'</p></details>':'')+'<div class="actions item-detail-actions">'+equipControl(e,row,ui)+(e.characterId?button('Quantidade e anotações','itemManage','primary','',e.id):'')+(!row.master&&e.characterId===row.characterId&&e.characterId?button('Compartilhar por tempo limitado','shareMaterial','small','','item/'+e.id)+(e.quantity>0?button('Entregar a um aliado','playerTransfer','small','',e.id):''):'')+(row.master?button('Editar ficha do item','itemEdit','','',e.id)+(!e.characterId?button('Entregar','itemGrant','','',e.id)+button('Colocar na mesa','lootPlace','','',e.id):'')+button('Excluir de todos os inventários','itemDelete','danger','',e.id):row.characterId&&e.characterId===row.characterId?button('Descartar item','itemDelete','danger','',e.id):'')+'</div></article>';}
export function itemManageForm(e,ui){const {esc,input,area,submit}=ui;return hidden(e,esc)+input('quantity','Quantidade (0 para esgotado)',e.quantity,'number','required min="0" max="999999" step="1"')+(canEquipKind(e.kind)?'<label class="check"><input type="checkbox" name="equipped" '+(e.equipped?'checked':'')+'>Equipado</label>':'')+area('notes','Anotações do portador',e.notes||'','maxlength="4000" rows="5"')+submit('Salvar inventário');}
