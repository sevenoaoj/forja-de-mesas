import {startElement} from './cinematic-elements.mjs';
import {cinematicStyle,cinematicCaption,cinematicDisplayMs} from '../model.mjs';

function prepareCaption(caption,text,speed){
 caption.replaceChildren();
 if(!text){caption.removeAttribute('aria-label');return;}
 caption.setAttribute('aria-label',text);
 for(const {letter,delay} of cinematicCaption(text,speed)){
  const span=document.createElement('span');
  span.setAttribute('aria-hidden','true');span.textContent=letter;
  span.style.setProperty('--letter-delay',delay+'ms');caption.append(span);
 }
}

// One stage per browser. Server timestamps let reconnecting viewers enter mid-scene.
export function createCinematicStage(dialog,{load,stop,report,trackVolume=()=>.65,trackEnabled=()=>false}){
 const media=dialog.querySelector('[data-cine-media]'),caption=dialog.querySelector('h2');
 const notice=dialog.querySelector('[role=status]'),sound=dialog.querySelector('[data-cine-sound]'),exit=dialog.querySelector('[data-cine-exit]');
 let identity='',revision=-1,current=null,dismissed='',abort,url,revealTimer,endTimer,video;
 const trackButton=dialog.querySelector('[data-cine-track]');
 let track,trackUrl;
 const melt=document.querySelector('#cine-melt feDisplacementMap');
 let meltFrame,stopElement;
 function finishMelt(){
  if(meltFrame===undefined)return;
  cancelAnimationFrame(meltFrame);meltFrame=undefined;
  document.documentElement.classList.remove('cine-melting');
 }
 function close(){
  stopElement?.();stopElement=null;finishMelt();delete media.dataset.pulse;
  clearTimeout(revealTimer);clearTimeout(endTimer);abort?.abort();
  trackButton.onclick=null;trackButton.hidden=true;
  if(track){track.onloadedmetadata=null;track.onended=null;track.onerror=null;track.pause();track.removeAttribute('src');track.load();track=null;}
  if(trackUrl)URL.revokeObjectURL(trackUrl);trackUrl=null;
  if(video){video.pause();video.removeAttribute('src');video.load();video=null;}
  media.replaceChildren();if(url)URL.revokeObjectURL(url);url=null;current=null;
  if(dialog.open)dialog.close();
 }
 function reset(){close();identity='';revision=-1;dismissed='';}
 function leave(){
  if(!current)return;
  if(current.master&&!current.preview){stop(current.run.id).catch(e=>report(e.message));return;}
  dismissed=current.run.id;close();
 }
 exit.onclick=leave;
 dialog.addEventListener('cancel',e=>{e.preventDefault();leave();});
 sound.onclick=async()=>{if(!video||video.ended||media.hasAttribute('data-pulse'))return;video.muted=!video.muted;try{await video.play();}catch{notice.textContent='Reprodução indisponível neste navegador.';}sound.textContent=video?.muted?'Ativar som':'Silenciar';};
 function show(run,master,serverTime,preview=false){
  close();const at=performance.now(),now=()=>serverTime+performance.now()-at;
  if(now()>=run.endsAt)return;
  current={run,master,preview};const session=current;
  prepareCaption(caption,run.text,run.captionSpeed);notice.textContent='';sound.hidden=true;
  exit.textContent=preview?'Fechar prévia':master?'Encerrar para a mesa':'Sair da cinemática';
  const style=cinematicStyle(run);
  dialog.dataset.transition=style.transition;
  dialog.dataset.reveal=style.reveal;
  const revealSpan=Math.min(style.revealSeconds*1000,run.endsAt-run.revealAt);
  dialog.style.setProperty('--reveal-span',revealSpan+'ms');
  for(const key of ['accent','background','lettering'])dialog.style.setProperty('--cine-'+key,style[key]);
  dialog.dataset.phase='invasion';
  dialog.style.setProperty('--entry',Math.max(.1,(run.revealAt-run.startedAt)/1000)+'s');
  dialog.style.setProperty('--elapsed',-Math.max(0,now()-run.startedAt)+'ms');
  dialog.showModal();
  stopElement=startElement(dialog.querySelector('.cine-element-canvas'),style,run,now);
  if(style.transition==='fade'&&now()<run.revealAt&&melt&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   document.documentElement.classList.add('cine-melting');
   let lastFrame=-Infinity;
   function drawMelt(timestamp){
    const progress=Math.min(1,Math.max(0,(now()-run.startedAt)/(run.revealAt-run.startedAt)));
    if(timestamp-lastFrame>=32){
     melt.setAttribute('scale',String(innerHeight*1.6*progress**1.65));
     lastFrame=timestamp;
    }
    if(progress<1)meltFrame=requestAnimationFrame(drawMelt);
   }
   drawMelt(performance.now());
  }
  function pulse(startedAt){
   if(current!==session||dialog.dataset.phase!=='reveal'||media.hasAttribute('data-pulse'))return;
   media.style.setProperty('--pulse-offset',-Math.max(0,now()-startedAt)+'ms');
   media.dataset.pulse='';sound.hidden=true;
  }
  function alignVideo(){
   if(!video||video.readyState<1||dialog.dataset.phase!=='reveal')return;
   const position=Math.max(0,(now()-run.revealAt)/1000);
   if(Number.isFinite(video.duration)&&position>=video.duration){video.currentTime=video.duration;pulse(run.revealAt+video.duration*1000);return;}
   if(Math.abs(video.currentTime-position)>.35)video.currentTime=position;
   video.play().catch(()=>{if(current===session)notice.textContent='Toque em Ativar som para reproduzir o vídeo.';});
  }
  function reveal(){
   dialog.style.setProperty('--reveal-elapsed',-Math.max(0,now()-run.revealAt)+'ms');
   stopElement?.();stopElement=null;finishMelt();dialog.dataset.phase='reveal';sound.hidden=!video;alignVideo();
   if(media.querySelector('img')?.naturalWidth)pulse(run.revealAt);
  }
  if(now()>=run.revealAt)reveal();else revealTimer=setTimeout(reveal,run.revealAt-now());
  endTimer=setTimeout(()=>{dismissed=run.id;close();},Math.max(0,run.endsAt-now()));
  abort=new AbortController();
  if(run.soundtrackId){
   const audio=track=new Audio();
   audio.volume=trackVolume();
   function alignTrack(){
    const position=Math.max(0,(now()-run.startedAt)/1000);
    if(position>=audio.duration){trackButton.hidden=true;return false;}
    if(Math.abs(audio.currentTime-position)>.2)audio.currentTime=position;
    return true;
   }
   async function playTrack(){
    if(!alignTrack())return;
    try{await audio.play();if(current===session)trackButton.textContent='Silenciar trilha';}
    catch(error){
     if(current!==session)return;
     if(error.name==='NotAllowedError')trackButton.textContent='Ativar trilha';
     else{trackButton.hidden=true;if(!audio.error)report('Não foi possível reproduzir a trilha da cinemática.');return;}
    }
    if(current===session&&!audio.error)trackButton.hidden=false;
   }
   trackButton.onclick=()=>{
    if(audio.paused)playTrack();
    else{audio.pause();trackButton.textContent='Ativar trilha';}
   };
   audio.onloadedmetadata=()=>{
    if(current!==session)return;
    if(trackEnabled())playTrack();
    else {trackButton.textContent='Ativar trilha';trackButton.hidden=false;}
   };
   audio.onended=()=>{trackButton.hidden=true;};
   audio.onerror=()=>{if(current===session){trackButton.hidden=true;report('Não foi possível reproduzir a trilha da cinemática.');}};
   load(run.soundtrackId,abort.signal).then(blob=>{
    if(current===session){trackUrl=URL.createObjectURL(blob);audio.src=trackUrl;}
   }).catch(()=>{if(current===session)report('Não foi possível carregar a trilha da cinemática.');});
  }
  if(!run.media)return;
  notice.textContent='Carregando mídia…';
  load(run.media.id,abort.signal).then(blob=>{
   if(current!==session)return;
   url=URL.createObjectURL(blob);
   const movie=run.media.type.startsWith('video/'),el=document.createElement(movie?'video':'img');
   if(movie){video=el;el.onended=()=>pulse(run.revealAt+el.duration*1000);el.playsInline=true;el.muted=true;el.preload='auto';sound.hidden=dialog.dataset.phase!=='reveal';sound.textContent='Ativar som';}
   else el.alt=run.text||'Revelação da cinemática';
   el.addEventListener(movie?'loadeddata':'load',()=>{if(current===session){notice.textContent='';if(movie)alignVideo();else pulse(run.revealAt);}},{once:true});
   el.onerror=()=>{if(current===session)notice.textContent='O navegador não conseguiu exibir esta mídia.';};
   media.replaceChildren(el);el.src=url;
  }).catch(()=>{if(current===session)notice.textContent='Não foi possível carregar a mídia.';});
 }
 function sync(row){
  if(!row.id){reset();return;}
  if(identity!==row.id){reset();identity=row.id;}
  if(!Object.hasOwn(row.state||{},'cinematic')||row.rev<revision)return;
  revision=row.rev;const run=row.state.cinematic;
  if(!run){if(current&&!current.preview)close();return;}
  if(current?.run.id!==run.id&&dismissed!==run.id)show(run,row.master,row.serverTime??Date.now());
 }
 return {sync,reset,preview(config,asset){
  const now=Date.now(),revealAt=now+config.intro*1000;
  show({...cinematicStyle(config),id:'preview',startedAt:now,revealAt,endsAt:revealAt+cinematicDisplayMs(config.duration,config.text,config.captionSpeed),text:config.text,soundtrackId:config.soundtrackId,media:asset},true,now,true);
 }};
}
