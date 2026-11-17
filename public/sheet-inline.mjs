export function createInlineSheetEditor(root,{save,report,settled,allowed=()=>true}={}){
 let active=null,pending=null;
 function restore(edit){edit.target.innerHTML=edit.html;edit.target.classList.remove('is-editing');}
 async function finish(cancel=false){
  const edit=active;if(!edit||edit.saving)return;
  if(cancel){active=null;restore(edit);return;}
  if(!edit.control.checkValidity()){edit.control.reportValidity();edit.control.focus();return;}
  const value=edit.type==='check'?String(edit.control.checked):edit.control.value;
  if(value===edit.before){active=null;restore(edit);return;}
  edit.saving=true;edit.control.disabled=true;
  try{
   await save({id:edit.id,field:edit.field,property:edit.property,category:edit.target.dataset.inlineCategory,entry:edit.target.dataset.inlineEntry,before:edit.before,value});
   if(active===edit){
    active=null;restore(edit);settled?.();
    const next=pending;pending=null;
    if(next)start([...root.querySelectorAll('[data-sheet-inline]')].find(node=>['inlineCharacter','inlineField','inlineProperty','inlineCategory','inlineEntry'].every(key=>node.dataset[key]===next[key])));
   }
  }catch(error){
   if(active!==edit)return;
   pending=null;edit.saving=false;edit.control.disabled=false;edit.control.focus();report?.(error.message);
  }
 }
 function start(target){
  if(!target||!allowed())return;
  if(active){if(active.target!==target)pending={...target.dataset};return;}
  const type=target.dataset.inlineType||'text';
  const control=document.createElement(type==='long'?'textarea':type==='color'?'select':'input');
  const before=target.dataset.inlineValue||'';
  if(type==='color')for(const [value,label] of Object.entries(JSON.parse(target.dataset.inlineOptions))){const option=document.createElement('option');option.value=value;option.textContent=label;control.append(option);}
  else if(type!=='long')control.type=type==='check'?'checkbox':type==='number'?'number':'text';
  if(type==='number')control.step='any';
  if(type==='counter')control.placeholder='Atual/máximo, como 8/10';
  if(type==='check')control.checked=before==='true';else control.value=before;
  control.maxLength=type==='name'||type==='concept'?80:4000;
  control.setAttribute('aria-label',target.getAttribute('aria-label')||'Editar valor');
  control.setAttribute('data-inline-control','');
  if(type==='long')control.rows=5;
  const edit={target,control,type,before,id:target.dataset.inlineCharacter,field:target.dataset.inlineField,property:target.dataset.inlineProperty,html:target.innerHTML,saving:false};
  active=edit;target.classList.add('is-editing');target.replaceChildren(control);control.focus();control.select?.();
 }
 root.addEventListener('click',event=>{if(!event.target.closest('[data-inline-control]'))start(event.target.closest('[data-sheet-inline]'));});
 root.addEventListener('keydown',event=>{
  if(active&&event.target===active.control){
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(true);}
   else if(event.key==='Enter'&&!event.isComposing&&(active.type!=='long'||event.ctrlKey||event.metaKey)){event.preventDefault();finish();}
  }else if(['Enter',' '].includes(event.key)&&event.target.matches('[data-sheet-inline]')){event.preventDefault();start(event.target);}
 });
 root.addEventListener('focusout',event=>{if(active&&event.target===active.control)finish();});
 root.addEventListener('change',event=>{if(active&&event.target===active.control&&['check','color'].includes(active.type))finish();});
 return {get editing(){return Boolean(active);},get characterId(){return active?.id;},cancel(){pending=null;if(active){const edit=active;active=null;restore(edit);}}};
}
