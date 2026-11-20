import {itemDetails,itemIdentity,itemAccent,itemTheme} from './inventory.mjs';
export function lootPlacement(row,ui,itemId=''){
 const {esc,input,submit}=ui,items=(row.state.inventory||[]).filter(item=>!item.characterId),grid=row.state.table?.grid||{columns:16,rows:10};
 if(!items.length)return '<p>Prepare primeiro um item no catálogo do Inventário.</p>'+ui.button('Preparar item','itemEdit','primary');
 return input('sceneId','',row.state.sceneId||'','hidden')+'<label>Item do catálogo<select name="itemId">'+items.map(item=>'<option value="'+esc(item.id)+'" data-version="'+esc(item.version)+'" '+(item.id===itemId?'selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select></label>'+input('name','Nome no mapa (opcional)','','text','maxlength="80" placeholder="Usar nome do item"')+'<div class="form-grid">'+input('quantity','Quantidade',1,'number','min="1" max="999999" step="1" required')+input('x','Coluna',Math.floor(grid.columns/2),'number','min="0" max="'+(grid.columns-1)+'" step="any" required')+input('y','Linha',Math.floor(grid.rows/2),'number','min="0" max="'+(grid.rows-1)+'" step="any" required')+'</div><label class="check"><input type="checkbox" name="revealed"> Revelar para os jogadores agora</label><p class="muted">Cria uma cópia independente do item na cena. Arraste o token para posicionar e revele quando desejar. O jogador precisa aproximar seu personagem para coletar.</p>'+submit('Colocar item na mesa');
}
export function lootPreview(token,row,ui){
 const {esc,input,select,submit}=ui,item=token.loot.item;
 const card=row.master?itemDetails(item,row,{...ui,button:()=>''}):'<div class="loot-preview" style="'+itemTheme(item)+'">'+itemIdentity({...item,name:token.name},ui)+'</div>';
 const targets=row.state.characters.filter(c=>row.master||c.id===row.characterId&&c.access==='full');
 return input('id','',token.id,'hidden')+input('version','',token.loot.version,'hidden')+input('sceneId','',row.state.sceneId||'','hidden')+card+'<p class="loot-quantity"><strong>'+esc(token.loot.quantity)+' unidade(s)</strong> · '+esc(token.name)+'</p>'+(row.master?'<p class="muted">A coleta pelo mestre entrega diretamente à ficha escolhida. O conteúdo no chão será removido.</p>'+select('characterId','Entregar para',Object.fromEntries(targets.map(c=>[c.id,c.name])),''):'<p class="muted">Aproxime um token do seu personagem até uma célula do item. Ao coletar, a ficha completa será revelada e o item irá para seu inventário.</p>')+(targets.length?submit(row.master?'Entregar e retirar da mesa':'Coletar item'):'<p>Escolha um personagem para coletar.</p>');
}
export function createLootRewards({dialog,current,access,modal,ui,schedule=setTimeout}={}){
 const seen=new Set(),queue=[];
 function flush(){
  if(dialog.open)return;
  while(queue.length){const entry=queue.shift();if(access()!==entry.access)continue;const row=current(),item=row.state.inventory?.find(item=>item.id===entry.id);if(!item)continue;
   modal('Item coletado','<p class="loot-reward-eyebrow">ADICIONADO AO INVENTÁRIO</p>'+itemDetails(item,row,ui())+'<div class="loot-reward-dismiss">'+ui().button('Continuar aventura','close','primary')+'</div>');dialog.dataset.lootReward='true';dialog.style?.setProperty('--item-accent',itemAccent(item));break;
  }
 }
 dialog.addEventListener('close',()=>{delete dialog.dataset.lootReward;dialog.style?.removeProperty('--item-accent');queueMicrotask(flush);});
 return {enqueue(id,owner){const key=owner?.id+'/'+id;if(!id||seen.has(key))return;seen.add(key);if(seen.size>200)seen.delete(seen.values().next().value);const reduce=Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);schedule(()=>{queue.push({id,access:owner});flush();},reduce?0:750);}};
}
export function lootEffect(event,grid,width,height){const x=event.x/grid.columns*100,y=event.y/grid.rows*100;return '<span class="vtt-loot-flight" data-loot-effect="'+event.id.replace(/[^a-z0-9-]/gi,'')+'" style="left:'+x+'%;top:'+y+'%;--loot-dx:'+((event.toX-event.x)/grid.columns*width)+'px;--loot-dy:'+((event.toY-event.y)/grid.rows*height)+'px" aria-hidden="true">◇<span>✦</span></span>';}

// Capture the portraits before the native dialog leaves the top layer.
export function flyRewardToInventory(dialog){
 if(dialog.dataset.lootReward!=='true'||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 let target=document.querySelector('#navigation [data-id="inventory"] .svg-icon');
 if(!target||!target.animate)return;
 const arts=[...dialog.querySelectorAll('.item-art')];
 if(!arts.length)return;
 const host=document.fullscreenElement||document.body;
 let destination=target.getBoundingClientRect(),proxy;
 if(!destination.width||destination.right<=0||destination.left>=innerWidth||destination.bottom<=0||destination.top>=innerHeight||document.fullscreenElement&&!host.contains(target)){
  proxy=document.createElement('span');proxy.className='reward-backpack';proxy.setAttribute('aria-hidden','true');
  target=target.cloneNode(true);proxy.append(target);host.append(proxy);destination=target.getBoundingClientRect();
  setTimeout(()=>proxy.remove(),1200);
 }
 const tx=destination.left+destination.width/2,ty=destination.top+destination.height/2;
 const visibleBox=dialog.getBoundingClientRect();
 const source=arts.map(art=>{
  const box=art.getBoundingClientRect();
  return {art,box:box.bottom>visibleBox.top&&box.top<visibleBox.bottom&&box.width?box:visibleBox};
 });
 source.forEach(({art,box},index)=>{
  const image=art.querySelector('img:not([hidden])'),sprite=document.createElement('span');
  sprite.className='reward-flight';sprite.setAttribute('aria-hidden','true');
  sprite.style.left=(box.left+box.width/2-22)+'px';sprite.style.top=(box.top+box.height/2-22)+'px';
  if(image){const portrait=document.createElement('img');portrait.src=image.currentSrc||image.src;portrait.alt='';sprite.append(portrait);}
  else {
   const icon=art.querySelector('.document-miniature');
   if(icon)sprite.append(icon.cloneNode(true));else sprite.textContent='◇';
  }
  host.append(sprite);
  const dx=tx-box.left-box.width/2,dy=ty-box.top-box.height/2;
  const animation=sprite.animate([{transform:'scale(1)',opacity:1},{transform:'translate('+dx*.43+'px,'+(dy*.43-32)+'px) scale(.84)',offset:.5},{transform:'translate('+dx+'px,'+dy+'px) scale(.22)',opacity:.15}],{duration:560,delay:Math.min(index,5)*45,easing:'ease-in-out',fill:'both'});
  animation.oncancel=()=>sprite.remove();
  animation.onfinish=()=>{sprite.remove();if(index===source.length-1)target.animate([{transform:'scale(1)'},{transform:'scale(1.3)'},{transform:'scale(1)'}],{duration:280});};
 });
}
