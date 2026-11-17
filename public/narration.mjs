import {narrationFonts,narrationPresets,narrationStyle,narrationContrast,defaultNarrationStyle} from '../narration-style.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function applyNarrationStyle(root,value){
 const style=narrationStyle(value);
 for(const [key,val] of Object.entries({text:style.textColor,background:style.backgroundColor,accent:style.accentColor,font:narrationFonts[style.font].family,size:style.size+'px',align:style.align}))root.style?.setProperty('--narration-'+key,val);
 return style;
}
export function narrationFormData(form){
 const get=name=>form.get(name);
 return {characterId:get('characterId'),title:get('title'),body:get('body'),style:{
  textColor:get('textColor'),backgroundColor:get('backgroundColor'),accentColor:get('accentColor'),
  font:get('font'),effect:get('effect'),speed:Number(get('speed')),size:Number(get('size')),align:get('align')
 }};
}
export function narrationComposer(row,ui,saved,characterId){
 const {input,select,area,submit,button}=ui,style=narrationStyle(saved||defaultNarrationStyle);
 const recipients=row.state.characters.filter(c=>c.claimed&&!c.hidden);
 const history=[...(row.state.narrations||[])].sort((a,b)=>b.at-a.at).slice(0,20);
 const content=recipients.length?select('characterId','Enviar somente para',Object.fromEntries(recipients.map(c=>[c.id,c.name])),(recipients.find(c=>c.id===characterId)||recipients[0]).id)+
  input('title','Título (opcional)','','text','maxlength="120" placeholder="Você percebe algo…"')+
  area('body','Narração privada','','required maxlength="4000" rows="6" placeholder="Um sussurro atravessa sua mente…"')+
  '<fieldset class="narration-options"><legend>Como a mensagem aparece</legend>'+select('preset','Atmosfera',Object.fromEntries(Object.entries(narrationPresets).map(([id,p])=>[id,p.label])),'candle')+
  '<div class="form-grid">'+select('font','Fonte',Object.fromEntries(Object.entries(narrationFonts).map(([id,p])=>[id,p.label])),style.font)+
  select('size','Tamanho do texto',{'20':'Confortável','24':'Grande','28':'Dramático','32':'Muito grande'},String(style.size))+
  select('effect','Entrada do texto',{typewriter:'Caractere por caractere',instant:'Texto completo'},style.effect)+
  input('speed','Velocidade (caracteres/s)',style.speed,'number','min="8" max="80" step="1" required')+
  select('align','Alinhamento',{center:'Centralizado',left:'À esquerda'},style.align)+'</div><div class="narration-colors">'+
  input('textColor','Texto',style.textColor,'color')+input('backgroundColor','Fundo',style.backgroundColor,'color')+input('accentColor','Destaque do mestre',style.accentColor,'color')+'</div></fieldset>'+
  '<section class="narration-preview-card" data-narration-mini aria-label="Prévia da aparência"><p class="narration-eyebrow">MENSAGEM DO MESTRE</p><h3 data-narration-mini-title>Você percebe algo…</h3><p data-narration-mini-body>Um sussurro atravessa sua mente…</p></section><p class="muted" data-narration-contrast role="status"></p>'+
  '<div class="actions">'+button('Prévia com animação','narrationPreview','small')+'</div><p class="muted">Só o destinatário recebe a mensagem. Ele pode revelar o texto inteiro e confirmar a leitura quando terminar.</p>'+submit('Enviar mensagem privada'):
  '<p class="muted">Um jogador precisa entrar pelo convite e escolher um personagem para receber mensagens.</p>';
 return {content:content+(history.length?'<details><summary>Mensagens recentes</summary><div class="narration-history">'+history.map(m=>'<article><strong>'+esc(m.characterName)+' · '+(m.readAt?'Leitura confirmada':'Aguardando leitura')+'</strong><h3>'+esc(m.title)+'</h3><p>'+esc(m.body)+'</p></article>').join('')+'</div></details>':''),hasRecipients:Boolean(recipients.length)};
}
export function updateNarrationComposer(form,{preset=false}={}){
 if(!form)return;
 const field=name=>form.querySelector('[name="'+name+'"]');
 if(preset){const selection=narrationPresets[field('preset')?.value];if(selection)for(const key of ['textColor','backgroundColor','accentColor','font'])if(field(key))field(key).value=selection[key];}
 const mini=form.querySelector('[data-narration-mini]');if(!mini)return;
 const data=narrationFormData(new FormData(form)),style=applyNarrationStyle(mini,data.style);
 mini.querySelector('[data-narration-mini-title]').textContent=data.title?.trim()||'Você percebe algo…';
 mini.querySelector('[data-narration-mini-body]').textContent=data.body?.trim()||'Um sussurro atravessa sua mente…';
 const warning=form.querySelector('[data-narration-contrast]');
 if(warning)warning.textContent=narrationContrast(style.textColor,style.backgroundColor)<4.5||narrationContrast(style.accentColor,style.backgroundColor)<3?'Aumente o contraste das cores antes de enviar.':'A prévia mostra a aparência que o jogador receberá.';
 if(field('speed'))field('speed').readOnly=style.effect==='instant';
}
export function createNarrationDisplay(root,{acknowledge=async()=>{},report=()=>{},schedule=setTimeout,cancel=clearTimeout,reducedMotion=()=>Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)}={}){
 let identity='',revision=-1,messages=[],active=null,busy=false,timer,writing=false,parts=[],position=0,paused=false;
 const dismissed=new Set();
 const node=selector=>root.querySelector?.(selector);
 function stopTimer(){if(timer!==undefined)cancel(timer);timer=undefined;writing=false;paused=false;}
 function hide(){stopTimer();if(root.open)root.close?.();root.hidden=true;root.innerHTML='';active=null;}
 function reveal(){
  if(!active)return;stopTimer();
  const text=node('[data-narration-text]');if(text)text.textContent=active.body;
  const skip=node('[data-narration-reveal]');if(skip)skip.hidden=true;
  const status=node('[data-narration-status]');if(status)status.textContent='Mensagem completa';
 }
 function step(){
  timer=undefined;if(!active||!writing)return;
  if(globalThis.document?.hidden){paused=true;return;}
  paused=false;position++;
  const text=node('[data-narration-text]'),area=node('.narration-copy');
  const follow=area&&area.scrollTop>=Math.max(0,(text?.offsetHeight||0)-area.clientHeight)-24;
  if(text)text.textContent=parts.slice(0,position).join('');
  if(follow)area.scrollTop=Math.max(0,text.offsetHeight-area.clientHeight);
  if(position>=parts.length){reveal();return;}
  const char=parts[position-1],pause=/[.!?…]/u.test(char)?4:/[,;:\n]/u.test(char)?2:1;
  timer=schedule(step,1000/active.style.speed*pause);
 }
 function show(message){
  active={...message,style:narrationStyle(message.style||{effect:'instant'})};
  applyNarrationStyle(root,active.style);
  const animate=active.style.effect==='typewriter'&&!reducedMotion();
  root.innerHTML='<button type="button" class="dice-dismiss narration-dismiss" data-narration-dismiss aria-label="Fechar mensagem">×</button><header class="narration-heading"><span class="narration-seal" aria-hidden="true">✦</span><p class="narration-eyebrow">'+(active.preview?'PRÉVIA · MENSAGEM DO MESTRE':'MENSAGEM DO MESTRE')+'</p><p class="narration-recipient">Uma narração privada para você</p></header><h2 id="narration-heading">'+esc(active.title||'Uma mensagem do mestre')+'</h2><div class="narration-copy"><p class="narration-space" aria-hidden="true">'+esc(active.body)+'</p><p class="narration-body" data-narration-text aria-hidden="true">'+(animate?'':esc(active.body))+'</p><p class="narration-accessible">'+esc(active.body)+'</p></div><footer class="narration-footer"><span class="narration-status" data-narration-status role="status">'+(animate?'A mensagem está sendo escrita…':'Mensagem completa')+'</span><div class="actions"><button class="btn" type="button" data-narration-reveal '+(animate?'':'hidden')+'>Revelar texto completo</button><button class="btn primary" type="button" data-narration-dismiss>'+(active.preview?'Fechar prévia':'Entendido')+'</button></div><p>Só você e o mestre recebem esta mensagem.</p></footer>';
  root.hidden=false;
  if(!root.open)root.showModal?.();
  if(animate){
   parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('pt-BR',{granularity:'grapheme'}).segment(active.body)].map(p=>p.segment):Array.from(active.body);
   position=0;writing=true;timer=schedule(step,1000/active.style.speed);
  }
 }
 function next(){
  if(active||busy||globalThis.document?.hidden)return;
  const message=messages.find(m=>!m.readAt&&!dismissed.has(m.id));
  if(message)show(message);else hide();
 }
 async function dismiss(){
  if(!active||busy)return;
  if(writing){reveal();return;}
  const message=active,key=identity;
  if(message.preview){hide();next();return;}
  busy=true;
  const status=node('[data-narration-status]');if(status)status.textContent='Confirmando leitura…';
  try{await acknowledge(message.id);if(identity!==key)return;dismissed.add(message.id);hide();}
  catch(error){if(identity===key){if(status)status.textContent='Leitura não confirmada. Tente novamente.';report(error.message);}}
  finally{busy=false;if(identity===key)next();}
 }
 root.addEventListener('click',event=>{
  if(event.target.closest('[data-narration-reveal]')){reveal();return;}
  if(event.target.closest('[data-narration-dismiss]'))dismiss();
 });
 root.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
 return {
  sync(row){
   // Audio polls may omit characterId. Omission is not a change of recipient.
   const base=row.id+'/'+Boolean(row.master);
   const recipient=Object.hasOwn(row,'characterId')?(row.characterId||''):identity.startsWith(base+'/')?identity.slice(base.length+1):'';
   const key=base+'/'+recipient;
   if(identity!==key){hide();identity=key;revision=-1;messages=[];dismissed.clear();}
   if(row.rev<revision||!Array.isArray(row.state?.narrations))return;
   revision=row.rev;messages=row.master?[]:row.state.narrations;
   if(active&&!active.preview&&!busy&&!messages.some(m=>m.id===active.id&&!m.readAt))hide();
   next();
  },
  preview(message){hide();show({...message,preview:true});},
  resume(){if(active&&writing&&reducedMotion()){reveal();return;}if(active&&paused){step();return;}next();}
 };
}
