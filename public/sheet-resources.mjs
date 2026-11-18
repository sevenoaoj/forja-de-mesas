import {sheetResourceStyle,sheetAppearance} from '../sheet-layout.mjs';
import {sheetFields} from '../model.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function resourceStatus(value,style){
 const [current,maximum]=String(value).split('/').map(Number);
 const valid=Number.isFinite(current)&&Number.isFinite(maximum)&&maximum>0;
 const ratio=valid?Math.max(0,Math.min(1,current/maximum)):0;
 return {ratio,critical:Boolean(valid&&style.critical&&ratio*100<=style.criticalAt)};
}

export function renderSheetResource(character,field,value,{inline,step,editControl,resourceStyle}){
 const style=resourceStyle||sheetResourceStyle(character,field),status=resourceStatus(value,style);
 const [amount,limit]=String(value).split('/'),bounded=Boolean(limit)&&Number.isFinite(Number(limit))&&Number(limit)>=0;
 return '<div data-sheet-tone="resources" class="sheet-resource" data-sheet-resource="'+esc(character.id+'/'+field.id)+'" style="--resource-color:'+esc(style.color)+'"><div class="sheet-resource-heading"><strong>'+esc(field.label)+'</strong><span class="resource-critical-label" '+(status.critical?'':'hidden')+'>Crítico</span>'+(editControl??'<button type="button" class="resource-color-button" data-act="sheetColors" data-id="'+esc(field.id)+'" aria-label="Personalizar '+esc(field.label)+'" title="Cor e alerta de '+esc(field.label)+'"><span aria-hidden="true"></span></button>')+'</div><div class="resource-meter '+(status.critical?'is-critical':'')+'" style="--resource-ratio:'+status.ratio+'"><span class="resource-fill" aria-hidden="true"></span>'+step(-1,'−',!bounded||Number(amount)<=0)+inline('<span>'+esc(amount||'0')+' / '+esc(limit||'—')+'</span>')+step(1,'+',!bounded||Number(amount)>=Number(limit))+'</div></div>';
}

export function sheetColorsForm(state,character){
 const appearance=sheetAppearance(state,character);
 return '<input type="hidden" name="expectedVersion" value="'+(character.appearance?.version||0)+'"><label class="sheet-color-picker">Destaque da ficha<input type="color" name="accent" value="'+esc(appearance.options.accent)+'"></label><p class="muted">Escolha a cor de cada barra e quando o recurso deve entrar em estado crítico. O alerta inclui uma indicação textual e uma pulsação vermelha suave.</p><div class="resource-style-list">'+sheetFields(state,character).filter(field=>field.type==='counter').map(field=>{
  const style=sheetResourceStyle(character,field),id=esc(field.id);
  return '<fieldset class="resource-style-row"><legend>'+esc(field.label)+'</legend><div class="resource-style-controls"><label class="sheet-color-picker">Cor da barra<input type="color" name="resource-color:'+id+'" value="'+esc(style.color)+'" data-resource-picker="'+id+'"></label><label>Limite crítico (%)<input type="number" name="resource-critical-at:'+id+'" value="'+style.criticalAt+'" min="0" max="100" step="1" required></label><label class="check-line"><input type="checkbox" name="resource-critical:'+id+'" '+(style.critical?'checked':'')+'>Alerta crítico</label></div></fieldset>';
 }).join('')+'</div><p class="muted">As animações respeitam a preferência de movimento reduzido do seu dispositivo. Máximo zero não ativa o alerta.</p><div class="actions"><button type="button" class="btn" data-act="close">Cancelar</button><button type="submit" class="btn primary">Salvar cores</button></div>';
}

export function sheetColorsPayload(state,character,data){
 const appearance=sheetAppearance(state,character);
 appearance.options.accent=data.accent;
 appearance.options.resources=Object.fromEntries(sheetFields(state,character).filter(field=>field.type==='counter').map(field=>[field.id,{color:data['resource-color:'+field.id],critical:data['resource-critical:'+field.id]==='on',criticalAt:Number(data['resource-critical-at:'+field.id])}]));
 return {id:character.id,expectedVersion:Number(data.expectedVersion),appearance};
}

// Read the on-screen transform before a rerender, including an unfinished animation.
// The new fill already has its final transform; WAAPI bridges from the old frame.
export function createResourceAnimations({getStyle=node=>globalThis.getComputedStyle(node),reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches}={}){
 return {
  capture(root){
   const previous=new Map();
   for(const resource of root.querySelectorAll('[data-sheet-resource]')){
    const fill=resource.querySelector('.resource-fill');
    if(fill)previous.set(resource.dataset.sheetResource,getStyle(fill).transform);
   }
   return previous;
  },
  restore(root,previous){
   if(reducedMotion())return;
   for(const resource of root.querySelectorAll('[data-sheet-resource]')){
    const fill=resource.querySelector('.resource-fill'),from=previous.get(resource.dataset.sheetResource);
    if(!fill?.animate||!from)continue;
    const to=getStyle(fill).transform;
    if(from!==to)fill.animate([{transform:from},{transform:to}],{duration:480,easing:'cubic-bezier(.22,.61,.36,1)'});
   }
  }
 };
}
