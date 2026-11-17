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
