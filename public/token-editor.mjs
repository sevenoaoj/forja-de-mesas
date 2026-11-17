import {characterColors,characterColorHex} from '../model.mjs';
import {tokenIcons,tokenIconIds,tokenIconSvg} from '../token-icons.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const filePreviews=new WeakMap();
function preview(token,characters){
 const character=characters.find(c=>c.id===token.characterId),name=token.name?.trim()||character?.name||'Token',icon=tokenIconIds.has(token.icon)?token.icon:'auto';
 const portrait=icon==='auto'&&(token.portrait?.id||character?.portrait?.id),local=icon==='auto'&&token.portraitUrl;
 const symbol=tokenIconSvg(icon)||'<span class="token-preview-initial">'+esc(name[0]?.toUpperCase()||'✦')+'</span>';
 return '<div class="token-editor-preview" style="--token-editor-color:'+characterColorHex(token.color)+'" aria-hidden="true">'+symbol+(local?'<img alt="" src="'+esc(local)+'">':portrait?'<img alt="" hidden data-portrait="'+esc(portrait)+'">':'')+'</div><div class="token-preview-description"><strong>'+esc(name)+'</strong><span>'+esc(characterColors[token.color]?.name||characterColors.violet.name)+' · '+esc(tokenIcons[icon]?.label||(icon==='initial'?'Inicial do nome':local||token.portrait?'Retrato importado':portrait?'Retrato da ficha':'Inicial automática'))+'</span></div>';
}
export function renderTokenAppearance(token={},characters=[]){
 const color=characterColors[token.color]?token.color:'violet',icon=tokenIconIds.has(token.icon)?token.icon:'auto';
 const choices=[['auto','Automático','<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/></svg>'],['initial','Inicial','<span class="token-choice-initial">A</span>'],...Object.entries(tokenIcons).map(([id,item])=>[id,item.label,tokenIconSvg(id)])];
 return '<section class="token-appearance-editor" data-token-appearance data-token-portrait="'+esc(token.portrait?.id||'')+'"><div class="token-preview-row" data-token-preview>'+preview({...token,color,icon},characters)+'</div><label>Importar retrato<input type="file" name="tokenPortrait" accept="image/png,image/jpeg,image/webp,image/gif"></label><p class="muted">PNG, JPEG, WebP ou GIF, até 3 MB. Automático usa o retrato importado antes do retrato da ficha.</p>'+(token.portrait?'<label class="check"><input type="checkbox" name="removePortrait"> Remover retrato importado</label>':'')+'<fieldset class="token-color-picker"><legend>Cor do token</legend><div class="token-color-grid">'+Object.entries(characterColors).map(([id,item])=>'<label class="token-color-choice" title="'+item.name+'"><input type="radio" name="color" value="'+id+'" '+(color===id?'checked':'')+'><span class="token-color-swatch" style="--choice-color:'+item.hex+'" aria-hidden="true"></span><span class="token-choice-sr">'+item.name+'</span></label>').join('')+'</div><p class="muted">Escolha pela amostra; a prévia mostra a combinação.</p></fieldset><fieldset class="token-icon-picker"><legend>Símbolo</legend><div class="token-icon-grid">'+choices.map(([id,label,svg])=>'<label class="token-icon-choice" title="'+label+'"><input type="radio" name="icon" value="'+id+'" '+(icon===id?'checked':'')+'><span>'+svg+'<small>'+label+'</small></span></label>').join('')+'</div><p class="muted">Automático usa o retrato importado, o da ficha ou a inicial. Escolher um símbolo substitui o retrato.</p><a class="token-icon-credit" href="/FONT-AWESOME-LICENSE.txt" target="_blank" rel="noopener">Ícones Font Awesome · licença e créditos ↗</a></fieldset></section>';
}
export function updateTokenAppearance(container,characters=[]){
 const editor=container?.querySelector('[data-token-appearance]');if(!editor)return false;
 const read=name=>container.querySelector('[name="'+name+'"]')?.value||'';
 const color=editor.querySelector('[name="color"]:checked')?.value||'violet',icon=editor.querySelector('[name="icon"]:checked')?.value||'auto';
 const file=container.querySelector('[name="tokenPortrait"]')?.files?.[0],removed=container.querySelector('[name="removePortrait"]')?.checked;
 let portraitUrl=file&&!removed?filePreviews.get(file):'';
 if(file&&!removed&&!portraitUrl&&file.size<=3*1024*1024&&['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){
   filePreviews.set(file,'pending');const reader=new FileReader();
   reader.onload=()=>{filePreviews.set(file,reader.result);if(container.querySelector('[name="tokenPortrait"]')?.files?.[0]===file)updateTokenAppearance(container,characters);};reader.readAsDataURL(file);
 }
 if(portraitUrl==='pending')portraitUrl='';
 const target=editor.querySelector('[data-token-preview]');if(target)target.innerHTML=preview({name:read('name'),characterId:read('characterId'),color,icon,portrait:!removed&&editor.dataset?.tokenPortrait?{id:editor.dataset.tokenPortrait}:null,portraitUrl},characters);
 return true;
}
