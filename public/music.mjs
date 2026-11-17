function normalize(value) {
  return String(value||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu,'');
}

function musicState(row) {
  const audio=row.state.audio||{};
  const music=audio.music||{};
  const sessions=Array.isArray(music.sessions)?music.sessions:[];
  return {
    track:audio.track,
    sessions,
    session:sessions.find(session=>session.id===music.activeSessionId)||sessions[0],
    fadeIn:music.fadeIn??3,
    fadeOut:music.fadeOut??3,
    volume:music.volume??70
  };
}

function playbackState(track,now) {
  if (!track) return {title:'Nenhuma música selecionada',label:'Aguardando o mestre escolher uma faixa.',transition:false};
  const scheduled=track.changed>now;
  const outgoing=scheduled&&track.fade?.outMs>0&&now>=track.fade.start;
  const incoming=!scheduled&&track.playing&&!track.stopped&&track.fade?.inMs>0&&now<track.changed+track.fade.inMs;
  if (track.stopped) {
    return scheduled
      ? {title:track.title,label:outgoing?'Encerrando com fade out…':'Encerramento programado para a mesa.',transition:true}
      : {title:'Trilha encerrada',label:'O mestre pode escolher outra faixa quando quiser.',transition:false};
  }
  const label=scheduled
    ? outgoing?(track.playing?'Trocando de faixa com fade out…':'Pausando com fade out…'):'Preparando reprodução compartilhada…'
    : incoming?'Entrando com fade in…':track.playing?'Tocando para a mesa':'Pausada na mesa';
  return {title:track.title||'Música do YouTube',label,transition:scheduled||incoming};
}

function nowPlaying(row,ui,now) {
  const {esc,button}=ui;
  const {track,fadeIn,fadeOut,volume}=musicState(row);
  const playback=playbackState(track,now);
  const controls=row.master&&track&&!track.stopped
    ? '<div class="music-playback-controls">'+
      button(track.playing?'Pausar na mesa':'Retomar na mesa','trackCommand','primary small','',track.playing?'pause':'play')+
      button('Reiniciar','trackCommand','small','','restart')+
      '<button type="button" class="btn small'+(track.loop?' primary':'')+'" data-act="musicLoop" aria-pressed="'+Boolean(track.loop)+'">↻ Repetir: '+(track.loop?'ativado':'desativado')+'</button>'+
      button('Encerrar','trackCommand','small danger','','stop')+'</div>':'';
  const previous=track?.previous;
  const source=row.master&&playback.transition&&previous?.title&&previous.video!==track.video&&!track.stopped
    ? '<p class="music-previous">Saindo de '+esc(previous.title)+'</p>':'';
  return '<div class="music-now-heading"><div><p class="music-overline">TOCANDO AGORA</p><h2>'+esc(!row.master&&track&&!track.stopped?'Trilha da mesa':playback.title)+'</h2></div>'+
    (row.master?button('Volume e fades','musicSettings','small'):'')+'</div>'+
    '<p class="music-playback-state'+(playback.transition?' is-transitioning':'')+'" role="status">'+esc(playback.label)+'</p>'+source+controls+
    (row.master?'<p class="music-settings-summary">Volume da mesa '+esc(volume)+'% <span>·</span> Entrada '+esc(fadeIn)+' s <span>·</span> Saída '+esc(fadeOut)+' s</p>':'');
}

function trackRow(track,index,tracks,sessionId,row,ui) {
  const {esc,button}=ui;
  const key=sessionId+'/'+track.id;
  const active=row.state.audio?.track;
  const current=active&&!active.stopped&&active.source?.sessionId===sessionId&&active.source?.itemId===track.id;
  const status=current?'<span class="music-track-current">'+(active.playing?'Faixa atual':'Pausada')+'</span>':'';
  const move=(direction,label,symbol,disabled)=>'<button type="button" class="btn small" data-act="musicTrack'+direction+'" data-id="'+esc(key)+'" aria-label="'+esc(label+' '+track.title)+'" '+(disabled?'disabled':'')+'>'+symbol+'</button>';
  return '<li class="music-track'+(current?' is-current':'')+'" data-music-row data-music-search="'+esc(normalize(track.title+' '+(track.tag||'')))+'" data-music-tag-value="'+esc(track.tag||'')+'">'+
    '<div class="music-track-info"><span class="music-note" aria-hidden="true">♫</span><div><h3>'+esc(track.title||'Música do YouTube')+'</h3>'+
    '<div class="music-track-meta">'+(track.tag?'<span class="music-tag">'+esc(track.tag)+'</span>':'')+(track.loop?'<span class="music-tag">↻ Repetir</span>':'')+status+'</div></div></div>'+
    '<div class="music-track-actions">'+button(current&&active.playing?'Reiniciar':'Tocar','musicTrackPlay','small primary','',key)+
    '<details class="music-track-menu"><summary aria-label="Opções de '+esc(track.title)+'">Mais</summary><div class="music-track-menu-body">'+
      button('Editar faixa','musicTrackEdit','small','',key)+
      '<div class="music-order-controls">'+move('Up','Mover para cima','↑',index===0)+move('Down','Mover para baixo','↓',index===tracks.length-1)+'</div>'+
      button('Remover faixa','musicTrackDelete','small danger','',key)+'</div></details></div></li>';
}

export function renderMusic(row,ui,view={query:'',tag:''}) {
  const {esc,button,input,select}=ui;
  const state=musicState(row);
  const now=row.serverTime||Date.now();
  const playing='<section class="music-now-playing" data-music-nowplaying>'+nowPlaying(row,ui,now)+'</section>';
  if (!row.master) return '<section class="music-area">'+playing+'<p class="music-player-help">O mestre escolhe as músicas da sessão. Ative o som da mesa para acompanhar a trilha.</p></section>';
  const sessions=state.sessions;
  const session=state.session;
  const sessionList=sessions.length?'<ul class="music-session-list">'+sessions.map(item=>
    '<li><button type="button" data-act="musicSessionSelect" data-id="'+esc(item.id)+'" class="music-session-button'+(session?.id===item.id?' is-active':'')+'" aria-pressed="'+(session?.id===item.id)+'"><span>'+esc(item.name)+'</span><small>'+(item.tracks||[]).length+' '+((item.tracks||[]).length===1?'música':'músicas')+'</small></button></li>'
  ).join('')+'</ul>':'<p class="music-empty-note">Crie uma sessão para organizar suas músicas.</p>';
  const sidebar='<aside class="music-session-panel"><div class="music-section-heading"><h2>Sessões</h2>'+button('Nova sessão','musicSessionNew','small','plus')+'</div>'+sessionList+'</aside>';
  if (!session) return '<section class="music-area">'+playing+'<div class="music-library" data-music-library>'+sidebar+
    '<section class="music-repertoire-panel music-start"><span class="music-start-note" aria-hidden="true">♫</span><h2>Prepare a trilha da sua mesa</h2><p>Adicione os links do YouTube que você quer usar e escolha a faixa quando a cena pedir.</p>'+button('Criar sessão','musicSessionNew','primary','plus')+'</section></div></section>';
  const tracks=session.tracks||[];
  const tags=[...new Set(tracks.map(track=>track.tag).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const tag=tags.includes(view.tag)?view.tag:'';
  const filters=tracks.length?'<div class="music-filters">'+input('musicQuery','Buscar música',view.query,'search','data-music-search-input autocomplete="off" placeholder="Nome ou etiqueta"')+
    (tags.length?select('musicTag','Etiqueta',{'':'Todas as etiquetas',...Object.fromEntries(tags.map(value=>[value,value]))},tag).replace('<select ','<select data-music-tag-filter '):'')+'</div>':'';
  const query=normalize(view.query);
  const count=tracks.filter(track=>(!tag||track.tag===tag)&&normalize(track.title+' '+(track.tag||'')).includes(query)).length;
  return '<section class="music-area">'+playing+'<div class="music-library" data-music-library data-music-session="'+esc(session.id)+'">'+sidebar+
    '<section class="music-repertoire-panel"><div class="music-repertoire-heading"><div><p class="music-overline">REPERTÓRIO DA SESSÃO</p><h2>'+esc(session.name)+'</h2></div><div class="actions">'+
      button('Adicionar música','musicTrackNew','primary small','plus',session.id)+
      '<details class="music-session-menu"><summary aria-label="Opções da sessão '+esc(session.name)+'">Opções</summary><div class="music-track-menu-body">'+button('Renomear sessão','musicSessionEdit','small','',session.id)+button('Remover sessão','musicSessionDelete','small danger','',session.id)+'</div></details></div></div>'+filters+
    (tracks.length?'<p class="music-filter-count" data-music-filter-count>'+count+' de '+tracks.length+' '+(tracks.length===1?'música':'músicas')+'</p><ul class="music-track-list">'+tracks.map((track,index)=>trackRow(track,index,tracks,session.id,row,ui)).join('')+'</ul><p class="music-empty-note" data-music-no-match '+(count?'hidden':'')+'>Nenhuma faixa corresponde à busca.</p>':'<div class="music-empty-repertoire"><h3>Seu repertório está vazio</h3><p>Adicione músicas para escolher o que vai tocar durante a sessão.</p></div>')+
    '</section></div></section>';
}

export function createMusicLibrary() {
  const views=new Map();
  let row;
  let ui;
  let root;
  let events;
  let transitionTimer;
  let receivedAt=0;
  let serverAtMount=0;

  function viewFor(current) {
    const {session}=musicState(current);
    const key=(current.id||'example')+'/'+(session?.id||'');
    if (!views.has(key)) views.set(key,{query:'',tag:''});
    const view=views.get(key);
    if (view.tag&&!(session?.tracks||[]).some(track=>track.tag===view.tag)) view.tag='';
    return view;
  }

  function filterRows() {
    if (!root) return;
    const view=viewFor(row);
    const query=normalize(view.query);
    const rows=[...root.querySelectorAll('[data-music-row]')];
    let count=0;
    for (const item of rows) {
      const visible=(!view.tag||item.dataset.musicTagValue===view.tag)&&item.dataset.musicSearch.includes(query);
      item.hidden=!visible;
      if (visible) count++;
    }
    const counter=root.querySelector('[data-music-filter-count]');
    if (counter) counter.textContent=count+' de '+rows.length+' '+(rows.length===1?'música':'músicas');
    const empty=root.querySelector('[data-music-no-match]');
    if (empty) empty.hidden=count>0;
  }

  function updatePlayback() {
    if (!root||!row) return;
    const now=serverAtMount+performance.now()-receivedAt;
    const current=root.querySelector('[data-music-nowplaying]');
    if (current) current.innerHTML=nowPlaying(row,ui,now);
    clearTimeout(transitionTimer);
    const track=row.state.audio?.track;
    const boundary=[track?.fade?.start,track?.changed,track?.changed+(track?.fade?.inMs||0)]
      .filter(value=>Number.isFinite(value)&&value>now+1).sort((a,b)=>a-b)[0];
    if (boundary) transitionTimer=setTimeout(updatePlayback,boundary-now+5);
  }

  return {
    render(current,helpers) {
      row=current;ui=helpers;
      return renderMusic(current,helpers,viewFor(current));
    },
    mount(container,current) {
      events?.abort();clearTimeout(transitionTimer);
      root=container;row=current;receivedAt=performance.now();serverAtMount=row.serverTime||Date.now();
      if (!root.querySelector('[data-music-nowplaying]')) return;
      events=new AbortController();
      root.addEventListener('input',event=>{
        if (!event.target.matches('[data-music-search-input]')) return;
        viewFor(row).query=event.target.value;
        filterRows();
      },{signal:events.signal});
      root.addEventListener('change',event=>{
        if (!event.target.matches('[data-music-tag-filter]')) return;
        viewFor(row).tag=event.target.value;
        filterRows();
      },{signal:events.signal});
      if (row.master) filterRows();
      updatePlayback();
    },
    dispose() {
      events?.abort();clearTimeout(transitionTimer);root=null;
    }
  };
}


export function renderMusicDockLibrary(row,ui,query='') {
  if (!row.master) return '';
  const {esc,button}=ui;
  const {sessions,session,track:active}=musicState(row);
  if (!sessions.length) return '<p class="music-dock-empty">Prepare sua playlist adicionando as músicas que deseja usar.</p>'+button('Criar sessão','musicSessionNew','small');
  const selector='<label>Sessão<select data-playlist-session aria-label="Sessão da playlist">'+sessions.map(item=>'<option value="'+esc(item.id)+'" '+(item.id===session.id?'selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select></label>';
  const tracks=(session?.tracks||[]).filter(track=>normalize(track.title+' '+(track.tag||'')).includes(normalize(query)));
  const list=tracks.length?'<ul class="music-dock-tracks">'+tracks.map(track=>{
    const current=active&&!active.stopped&&active.source?.sessionId===session.id&&active.source?.itemId===track.id;
    return '<li><button type="button" class="music-dock-track'+(current?' is-current':'')+'" data-act="musicTrackPlay" data-id="'+esc(session.id+'/'+track.id)+'" '+(current?'aria-current="true"':'')+'><span><strong>'+esc(track.title)+'</strong>'+(track.tag?'<small>'+esc(track.tag)+'</small>':'')+'</span><span>'+(current&&active.playing?'Reiniciar':'Tocar')+'</span></button></li>';
  }).join('')+'</ul>':'<p class="music-dock-empty">'+((session?.tracks||[]).length?'Nenhuma faixa corresponde à busca.':'Esta sessão ainda não tem músicas.')+'</p>';
  return selector+list+button('Adicionar música','musicTrackNew','small','',session.id);
}

export function createMusicDock(root,ui) {
  const playing=root.querySelector('[data-playlist-now]');
  const library=root.querySelector('[data-playlist-library]');
  const volume=root.querySelector('[data-playlist-volume]');
  const search=root.querySelector('[data-playlist-search]');
  let row;
  let query='';
  let libraryHTML='';
  let playingHTML='';
  function update() {
    const nextLibrary=renderMusicDockLibrary(row,ui,query);
    if (nextLibrary!==libraryHTML) {
      const panel=root.querySelector('.music-dock-panel');
      const scroll=panel.scrollTop;
      library.innerHTML=nextLibrary;libraryHTML=nextLibrary;
      panel.scrollTop=scroll;
    }
    const nextPlaying=nowPlaying(row,ui,row.serverTime||Date.now());
    if(nextPlaying!==playingHTML) {playing.innerHTML=nextPlaying;playingHTML=nextPlaying;}
    if (document.activeElement!==volume) volume.value=musicState(row).volume;
  }
  function close() {root.open=false;root.querySelector('summary').focus();}
  root.addEventListener('click',event=>{if(event.target.closest('[data-playlist-close]'))close();});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&root.open) {event.preventDefault();event.stopPropagation();close();}
  });
  root.addEventListener('input',event=>{
    if (event.target===search&&row?.master) {query=search.value;update();}
  });
  return {
    sync(next) {
      if (!next.master||!next.id) {
        root.hidden=true;root.open=false;row=null;query='';search.value='';
        playing.innerHTML='';library.innerHTML='';libraryHTML='';playingHTML='';
        return;
      }
      if (row?.id!==next.id) {
        root.open=false;query='';search.value='';libraryHTML='';playingHTML='';row=null;
      } else if ((row.rev??0)>(next.rev??0)) return;
      const music=next.state.audio?.music||{};
      const sessions=Array.isArray(music.sessions)?music.sessions:row?.state.audio?.music?.sessions||[];
      row={...next,state:{audio:{...next.state.audio,music:{...row?.state.audio?.music,...music,sessions}}}};
      root.hidden=false;update();
    }
  };
}

// Persistent small launcher: opening the controls never changes playback.
export function createAudioPopover(root,{document:doc=globalThis.document}={}){
 const panel=root.querySelector('[data-audio-panel]'),trigger=root.querySelector('[data-audio-panel-toggle]');
 let identity='',opened=false;
 function setOpen(value,focus=false){
  opened=Boolean(value);panel.hidden=!opened;trigger.setAttribute('aria-expanded',String(opened));trigger.setAttribute('aria-label',opened?'Fechar controles de áudio':'Abrir controles de áudio');
  if(!opened&&focus)trigger.focus();
 }
 root.addEventListener('click',event=>{
  if(event.target.closest('[data-audio-panel-toggle]'))setOpen(!opened);
  else if(event.target.closest('[data-audio-panel-close]'))setOpen(false,true);
 });
 doc?.addEventListener?.('click',event=>{if(opened&&!root.contains(event.target))setOpen(false);});
 doc?.addEventListener?.('keydown',event=>{if(event.key==='Escape'&&opened){event.preventDefault();setOpen(false,true);}});
 setOpen(false);
 return {sync(row){const next=(row.id||'')+'/'+Boolean(row.master);if(next!==identity||row.needsCharacter){setOpen(false);root.querySelector('#master-playlist').open=false;identity=next;}},get open(){return opened;}};
}
