import {emptyAudio,elapsed,soundPresets,effectiveTrack,musicGain,youtubeVideo} from './media.mjs';

let apiPromise;
function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;
    const timeout=setTimeout(()=>{
      apiPromise=null;
      script.remove();
      reject(new Error('O YouTube não respondeu. Verifique sua conexão e tente ativar o áudio novamente.'));
    },15000);
    window.onYouTubeIframeAPIReady=()=>{
      clearTimeout(timeout);
      previous?.();
      resolve(window.YT);
    };
    const script=document.createElement('script');
    script.src='https://www.youtube.com/iframe_api';
    script.onerror=()=>{
      clearTimeout(timeout);apiPromise=null;script.remove();
      reject(new Error('Não foi possível conectar ao YouTube.'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

export function campaignAudio(dock,fetchClip,report,control) {
  const frameSlot=dock.querySelector('[data-youtube]');
  const consent=document.querySelector('#audio-consent');
  const localControls=document.querySelector('#audio-controls');
  let audioPage=true;
  let playbackStarted=false;
  let context;
  let gain;
  let enabled=false;
  let blocked=false;
  let volume=.65;
  let musicVolume=65;
  let campaign;
  let latest;
  let seen=new Set();
  let generation=0;
  let clock={server:Date.now(),local:performance.now()};
  let transitionTimer;
  let volumeTimer;
  let appliedVolume;
  let localEntry;
  let player;
  let playerReady=false;
  let visibility;
  let playerVisible=typeof IntersectionObserver==='undefined';
  let preparing;
  let readyTimeout;
  let playerFailed=false;
  let playerAttempt=0;
  let failure='';
  let loadedVideo;
  let appliedCommand;
  let appliedPlaying;
  let retryAfter=0;
  let lastSeek=0;
  let endedCommand;
  let durationReported;
  const sources=new Set();
  const decoded=new Map();
  const loopSources=new Map(),previewSources=new Set(),failedLoops=new Set();
  let lastStopVersion,synthOutput,localSynth=false;

  const serverNow=()=>clock.server+performance.now()-clock.local;
  const currentTrack=()=>effectiveTrack(latest?.state.audio?.track,serverNow());
  function graph() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      context = new Audio();
      gain = context.createGain();
      gain.gain.value = enabled ? volume : 0;
      gain.connect(context.destination);
    }
    return context;
  }

  function trackSource(source) {
    sources.add(source);
    if(localSynth)previewSources.add(source);
    source.onended=()=>{sources.delete(source);previewSources.delete(source);};
    return source;
  }

  function stopEffects() {
    for (const source of sources) {try {source.stop();} catch {}}
    sources.clear();loopSources.clear();previewSources.clear();failedLoops.clear();
  }

  function tone(at,duration,start,end,level,type='sine') {
    const source = trackSource(context.createOscillator());
    const envelope = context.createGain();
    source.type=type;
    source.frequency.setValueAtTime(start,at);
    source.frequency.exponentialRampToValueAtTime(end,at+duration);
    envelope.gain.setValueAtTime(0.001,at);
    envelope.gain.exponentialRampToValueAtTime(level,at+Math.min(0.03,duration/4));
    envelope.gain.exponentialRampToValueAtTime(0.001,at+duration);
    source.connect(envelope).connect(synthOutput||gain);
    source.start(at);
    source.stop(at+duration);
  }

  function noise(at,duration,frequency,level) {
    const buffer = context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*(1-i/samples.length);
    const source = trackSource(context.createBufferSource());
    source.buffer=buffer;
    const filter=context.createBiquadFilter();
    filter.frequency.value=frequency;
    const levelNode=context.createGain();
    levelNode.gain.value=level;
    source.connect(filter).connect(levelNode).connect(synthOutput||gain);
    source.start(at);
  }

  const synth = {
    door(t) {tone(t,.7,86,190,.08,'sawtooth');tone(t+.12,.65,270,140,.045,'triangle');},
    thunder(t) {noise(t,1.7,145,.65);tone(t,1.3,61,29,.19);},
    steps(t) {for (let i=0;i<4;i++) noise(t+i*.24,.14,520,.45);},
    bell(t) {tone(t,1.2,670,665,.22);tone(t,.75,1510,1510,.07);},
    spell(t) {for (let i=0;i<4;i++) tone(t+i*.09,.55,390*1.25**i,600*1.25**i,.1);},
    impact(t) {noise(t,.24,900,.6);tone(t,.33,122,42,.23);}
  };

  async function clipBuffer(id) {
    if (!decoded.has(id)) {
      if (decoded.size>=16) decoded.delete(decoded.keys().next().value);
      const promise=fetchClip(id).then(response=>response.arrayBuffer()).then(bytes=>context.decodeAudioData(bytes));
      decoded.set(id,promise);
      promise.catch(()=>decoded.delete(id));
    }
    return decoded.get(id);
  }

  async function play(cue,clips,{local=false,loop=false}={}) {
    if (!graph()) throw new Error('Seu navegador não oferece reprodução de efeitos sonoros.');
    const scheduled=()=>context.currentTime+(local?0:Math.max(0,(cue.at-serverNow())/1000));
    const target=context.createGain();target.gain.value=(cue.volume??100)/100*(local?volume:1);target.connect(local?context.destination:gain);
    if (soundPresets.some(sound=>sound.id===cue.sound)) {
      synthOutput=target;localSynth=local;
      try{synth[cue.sound](scheduled());}finally{synthOutput=null;localSynth=false;}
      return;
    }
    if (!clips.some(clip=>clip.id===cue.sound)) return;
    const active=generation,buffer=await clipBuffer(cue.sound);
    if ((!local&&!enabled)||generation!==active) return;
    const late=local?0:Math.max(0,(serverNow()-cue.at)/1000);
    if (!loop&&late>=buffer.duration) return;
    const source=trackSource(context.createBufferSource());
    if(local)previewSources.add(source);
    source.buffer=buffer;source.loop=loop;source.effectGain=target;
    if(loop&&cue.id.startsWith('ambient:')&&context.createBiquadFilter){
      const filter=context.createBiquadFilter();
      filter.type='lowpass';filter.Q.value=.707;
      filter.frequency.value=ambientCutoff(cue);
      source.connect(filter).connect(target);source.wallFilter=filter;
    }else source.connect(target);
    source.start(scheduled(),loop?late%buffer.duration:late);
    return source;
  }
  function ambientCutoff(cue){return Math.min(cue.muffled?(cue.cutoffHz??2400):20000,(context.sampleRate||44100)*.48);}
  function smoothParam(param,value){
    if(param.setTargetAtTime)param.setTargetAtTime(value,context.currentTime,.08);
    else param.value=value;
  }
  function applyLoop(entry){
    const source=entry.source;if(!source)return;
    if(entry.ambient){
      smoothParam(source.effectGain.gain,entry.level/100);
      if(source.wallFilter)smoothParam(source.wallFilter.frequency,ambientCutoff(entry));
    }else source.effectGain.gain.value=entry.level/100;
  }
  function syncLoops(audio){
    const ambient=(audio.ambient||[]).map(c=>({...c,id:'ambient:'+c.id}));
    const loops=[...(audio.soundboard?.loops||[]),...ambient],allowed=new Set(loops.map(c=>c.id));
    for(const [id,entry] of loopSources)if(!allowed.has(id)){try{entry.source?.stop();}catch{}loopSources.delete(id);}
    for(const id of failedLoops)if(!allowed.has(id))failedLoops.delete(id);
    if(!enabled)return;
    for(const cue of loops){
      const level=(audio.soundboard?.volume??80)*(cue.id.startsWith('ambient:')?cue.volume/100:1);
      const existing=loopSources.get(cue.id);
      if(existing){
        if(existing.level!==level||existing.muffled!==cue.muffled||existing.cutoffHz!==cue.cutoffHz){
          existing.level=level;existing.muffled=cue.muffled;existing.cutoffHz=cue.cutoffHz;applyLoop(existing);
        }
        continue;
      }
      if(failedLoops.has(cue.id))continue;
      const entry={source:null,level,muffled:cue.muffled,cutoffHz:cue.cutoffHz,ambient:cue.id.startsWith('ambient:')};loopSources.set(cue.id,entry);
      play({...cue,volume:level},entry.ambient?[{id:cue.sound}]:(audio.clips||[]),{loop:true}).then(source=>{
        if(loopSources.get(cue.id)===entry){entry.source=source;applyLoop(entry);}
        else{try{source?.stop();}catch{}}
      }).catch(error=>{if(loopSources.get(cue.id)===entry){loopSources.delete(cue.id);failedLoops.add(cue.id);report(error.message||'Não foi possível repetir o efeito.');}});
    }
  }

  function applyMusicVolume() {
    clearTimeout(volumeTimer);
    if (!playerReady) return;
    const pending=latest?.state.audio?.track;
    const now=serverNow();
    const sharedVolume=latest?.state.audio?.music?.volume??100;
    const entryGain=localEntry?.video===loadedVideo
      ? localEntry.playingAt===null?0:Math.min(1,(performance.now()-localEntry.playingAt)/200)
      : 1;
    const value=enabled?Math.round(musicVolume*sharedVolume/100*musicGain(pending,now)*entryGain):0;
    if (value!==appliedVolume) {
      player.setVolume(value);
      appliedVolume=value;
    }
    const fade=pending?.fade;
    const canonicalFade=fade&&now<pending.changed+fade.inMs;
    const entryFade=localEntry?.playingAt!==null&&entryGain<1;
    if (enabled&&(canonicalFade||entryFade)) {
      const delay=entryFade?25:now<fade.start?Math.min(250,fade.start-now):50;
      volumeTimer=setTimeout(applyMusicVolume,Math.max(10,delay));
    }
  }

  function status() {
    const track=currentTrack();
    const displayed=track||(latest?.state.audio?.track?.stopped?null:latest?.state.audio?.track);
    if (consent) {
      consent.hidden=!latest?.id||(enabled&&!blocked);
      const text=consent.querySelector('[data-audio-consent-text]');
      if (text) text.textContent=failure||(blocked
        ? 'O navegador bloqueou o som. Toque para liberar o áudio nesta aba.'
        : 'Ative o áudio para ouvir a trilha e os efeitos compartilhados da mesa.');
    }
    dock.hidden=!audioPage||!latest?.id||!displayed;
    frameSlot.hidden=!enabled;
    dock.classList.toggle('audience',!latest?.master);
    const workspace=document.querySelector('.workspace');
    const controlsVisible=Boolean(latest?.id&&!latest?.needsCharacter);
    workspace?.classList.toggle('has-audio-controls',controlsVisible);
    if (localControls) {
      localControls.hidden=!controlsVisible;
      const toggle=localControls.querySelector('[data-act=audioToggle]');
      toggle.textContent=enabled&&!blocked?'Silenciar':'Ativar som';
      toggle.ariaPressed=String(enabled&&!blocked);
      const slider=localControls.querySelector('[data-music-volume]');
      slider.value=musicVolume;
      const effects=localControls.querySelector('[data-overlay-effect-volume]');if(effects)effects.value=Math.round(volume*100);
      const launcher=localControls.querySelector('[data-audio-panel-toggle]');
      if(launcher){launcher.title=enabled&&!blocked?'Controles de áudio · som ativado':'Controles de áudio · som silenciado';launcher.classList.toggle('is-muted',!enabled||blocked);}
    }
    const playerStatus=dock.querySelector('[data-player-status]');
    if (playerStatus) {
      playerStatus.textContent=failure||(enabled&&displayed&&!playerReady?'Carregando player do YouTube…':'');
      playerStatus.hidden=!playerStatus.textContent;
    }
    dock.querySelector('[data-track-title]').textContent=latest?.master?(displayed?.title||'Áudio da mesa'):'Trilha da mesa';
    const sourceLink=dock.querySelector('[data-youtube-link]');
    sourceLink.hidden=!latest?.master;
    sourceLink.href=latest?.master&&track?'https://www.youtube.com/watch?v='+track.video:'#';
    const localButton=dock.querySelector('[data-act=audioToggle]');
    if (localButton) {
      const label=enabled&&!blocked?'Silenciar nesta aba':'Ativar áudio';
      localButton.textContent=latest?.master?label:(enabled&&!blocked?'🔊':'🔇');
      localButton.ariaLabel=label;
      localButton.title=label;
    }
    const masterControls=dock.querySelector('[data-audio-master]');
    if (masterControls) {
      masterControls.hidden=!latest?.master;
      const playButton=masterControls.querySelector('[data-audio-play]');
      if (playButton) {
        playButton.textContent=track?.playing?'Pausar na mesa':'Retomar na mesa';
        playButton.dataset.id=track?.playing?'pause':'play';
      }
    }
  }

  async function preparePlayer() {
    if (player||preparing||playerFailed||!enabled||!latest?.state.audio?.track) return preparing;
    const active=generation;
    const attemptId=++playerAttempt;
    const currentAttempt=()=>active===generation&&attemptId===playerAttempt;
    const attempt=youtubeAPI().then(YT=>{
      if (!currentAttempt()||!enabled) return;
      const host=document.createElement('div');
      frameSlot.replaceChildren(host);
      player=new YT.Player(host,{
        videoId:currentTrack()?.video||latest.state.audio.track.video,
        width:'100%',height:'100%',
        playerVars:{origin:location.origin,playsinline:1,controls:0,disablekb:1,autoplay:0},
        events:{
          onReady(event) {
            if (!currentAttempt()) return;
            clearTimeout(readyTimeout);
            player=event.target;playerReady=true;playerFailed=false;failure='';loadedVideo=null;
            const iframe=player.getIframe();
            iframe.referrerPolicy='strict-origin-when-cross-origin';
            iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
            iframe.title='YouTube — áudio compartilhado da mesa';
            if (typeof IntersectionObserver!=='undefined') {
              visibility?.disconnect();
              playerVisible=false;
              visibility=new IntersectionObserver(entries=>{
                if (!currentAttempt()) return;
                const visible=entries[0]?.intersectionRatio>.5;
                if (visible===playerVisible) return;
                playerVisible=visible;
                if (!visible&&!playbackStarted) {
                  appliedCommand=null;
                  if(localEntry)localEntry.playingAt=null;
                }
                reconcile();
              },{threshold:[0,.51,1]});
              visibility.observe(iframe);
            }
            appliedVolume=undefined;
            applyMusicVolume();
            reconcile();
          },
          onAutoplayBlocked() {if(!currentAttempt())return;blocked=true;status();},
          onStateChange(event) {
            if (!currentAttempt()) return;
            if (event.data===1) {
              playbackStarted=true;
              if (localEntry?.video===loadedVideo&&localEntry.playingAt===null) localEntry.playingAt=performance.now();
              blocked=false;applyMusicVolume();status();
              reconcile();
            }
            const track=currentTrack();
            const pending=latest?.state.audio?.track;
            if(event.data===0&&track?.playing&&pending?.commandId===track.commandId){
              const url=player.getVideoUrl?.();if(url&&youtubeVideo(url)!==track.video)return;
              const duration=track.duration||videoDuration(track);
              if(track.loop&&Number.isFinite(duration)&&duration>0){reconcile();return;}
              if(latest?.master&&endedCommand!==track.commandId){
                endedCommand=track.commandId;
                control?.(track.loop?'ended':'stop',{expectedCommandId:track.commandId})?.catch(error=>{if(error.status!==409)report(error.message);});
              }
            }
          },
          onError(event) {
            if (!currentAttempt()) return;
            clearTimeout(readyTimeout);
            playerFailed=!playerReady;
            failure={
              2:'O YouTube recusou o identificador do vídeo (erro 2).',
              5:'O YouTube não conseguiu reproduzir este vídeo no navegador (erro 5).',
              100:'Este vídeo foi removido ou está privado (erro 100).',
              101:'Este vídeo não permite reprodução incorporada (erro 101).',
              150:'Este vídeo não permite reprodução incorporada (erro 150).',
              153:'O YouTube recusou a identificação do player (erro 153).'
            }[event.data]||'O YouTube não conseguiu carregar o vídeo (erro '+event.data+').';
            blocked=true;status();report(failure);
          }
        }
      });
      if (!playerReady) readyTimeout=setTimeout(()=>{
        if (!currentAttempt()||playerReady) return;
        playerFailed=true;blocked=true;
        failure='O player do YouTube demorou para carregar. Toque em Ativar áudio para tentar novamente.';
        status();report(failure);
      },15000);
    }).catch(error=>{
      if (!currentAttempt()) return;
      playerFailed=true;failure=error.message;blocked=true;status();report(failure);
    }).finally(()=>{if(preparing===attempt)preparing=null;});
    preparing=attempt;
    return attempt;
  }

  function videoDuration(track){
    if(loadedVideo!==track?.video)return 0;
    const url=player.getVideoUrl?.();if(url&&youtubeVideo(url)!==track.video)return 0;
    const duration=player.getDuration?.();return Number.isFinite(duration)&&duration>0?duration:0;
  }
  function reconcile() {
    clearTimeout(transitionTimer);
    const pending=latest?.state.audio?.track;
    const now=serverNow();
    if (pending?.changed>now) transitionTimer=setTimeout(reconcile,pending.changed-now+5);
    const track=effectiveTrack(pending,now);
    status();
    if (!enabled) return;
    if (!playerReady) {preparePlayer();return;}
    applyMusicVolume();
    if(track&&latest?.master&&track.commandId===pending?.commandId&&loadedVideo===track.video&&durationReported!==track.commandId&&player.getPlayerState()===1&&control){
      const duration=videoDuration(track);
      if(Number.isFinite(duration)&&duration>0&&duration<=86400){
        const commandId=track.commandId;durationReported=commandId;
        control('duration',{duration,expectedCommandId:commandId})?.catch(error=>{if(durationReported===commandId)durationReported=null;if(error.status!==409)report(error.message);});
      }
    }
    if (!track) {
      if (loadedVideo) player.stopVideo();
      loadedVideo=null;appliedCommand=null;appliedPlaying=undefined;localEntry=null;
      return;
    }
    const canPlay=playerVisible||playbackStarted;
    const localDuration=videoDuration(track);
    const timing=track.loop&&!track.duration&&loadedVideo===track.video&&Number.isFinite(localDuration)&&localDuration>0?{...track,duration:localDuration}:track;
    const expected=elapsed(timing,now),repeat=track.playing&&track.loop&&Number.isFinite(timing.duration)&&timing.duration>0;
    const command=track.commandId||String(track.changed);
    const changed=appliedCommand!==command;
    if (loadedVideo!==track.video) {
      loadedVideo=track.video;localEntry={video:track.video,playingAt:null};blocked=false;failure='';
      applyMusicVolume();
      if (track.playing&&canPlay) player.loadVideoById({videoId:track.video,startSeconds:expected});
      else player.cueVideoById({videoId:track.video,startSeconds:expected});
      appliedCommand=canPlay?command:null;appliedPlaying=track.playing;lastSeek=performance.now();retryAfter=canPlay?performance.now()+1500:0;
      status();
      return;
    }
    const state=player.getPlayerState();
    if (!canPlay) {appliedCommand=null;return;}
    if(changed&&track.playing&&appliedPlaying===false){
      // A seek on a paused, off-screen embed may buffer without resuming.
      // Reuse the existing iframe and start at the shared resume position instead.
      appliedCommand=command;appliedPlaying=true;blocked=false;failure='';
      localEntry={video:track.video,playingAt:null};applyMusicVolume();
      lastSeek=performance.now();retryAfter=performance.now()+1500;
      player.loadVideoById({videoId:track.video,startSeconds:expected});
      status();return;
    }
    if (changed||repeat&&state===0||[1,2].includes(state)&&Math.abs((player.getCurrentTime()||0)-expected)>1.5&&performance.now()-lastSeek>2000) {
      player.seekTo(expected,true);
      lastSeek=performance.now();
    }
    if (track.playing) {
      if (!blocked&&state!==1&&state!==3&&(state!==0||changed||repeat)&&(changed||repeat&&state===0||performance.now()>retryAfter)) {
        player.playVideo();retryAfter=performance.now()+1500;
      }
    } else if (changed||state===1||state===3) player.pauseVideo();
    appliedCommand=command;appliedPlaying=track.playing;
  }

  function sync(row) {
    if (latest&&latest.id===row.id&&(latest.rev>row.rev||latest.rev===row.rev&&latest.serverTime>row.serverTime)) {
      row=latest;
    } else {
      clock={server:row.serverTime||Date.now(),local:performance.now()};
    }
    if (row.id!==campaign) {
      playbackStarted=false;
      campaign=row.id;seen=new Set();generation++;decoded.clear();stopEffects();lastStopVersion=undefined;
      clearTimeout(readyTimeout);clearTimeout(volumeTimer);appliedVolume=undefined;playerFailed=false;failure='';localEntry=null;
      visibility?.disconnect();playerVisible=typeof IntersectionObserver==='undefined';
      player?.destroy();player=null;playerReady=false;preparing=null;loadedVideo=null;appliedCommand=null;appliedPlaying=undefined;
    }
    latest=row;
    const audio=row.state.audio||emptyAudio();
    const version=audio.soundboard?.stopVersion??0;
    if(lastStopVersion!==undefined&&version!==lastStopVersion){generation++;stopEffects();}
    lastStopVersion=version;
    const now=serverNow();
    syncLoops(audio);
    for (const cue of audio.cues) {
      if (seen.has(cue.id)) continue;
      if (now-cue.at>2000) {seen.add(cue.id);continue;}
      if (!enabled) continue;
      seen.add(cue.id);
      play(cue,audio.clips).catch(error=>report(error.message||'Não foi possível reproduzir o efeito sonoro.'));
    }
    if (seen.size>60) seen=new Set(audio.cues.map(cue=>cue.id));
    reconcile();
  }

  return {
    syncAmbient(ambient){if(latest&&enabled)syncLoops({...latest.state.audio,ambient});},
    dispose() {
      clearTimeout(transitionTimer);clearTimeout(readyTimeout);clearTimeout(volumeTimer);
      generation++;stopEffects();visibility?.disconnect();player?.destroy();decoded.clear();
    },
    async preview(id){
      if(!latest?.master)throw new Error('A pré-escuta é exclusiva do mestre.');
      for(const source of previewSources){try{source.stop();}catch{}}previewSources.clear();
      if(!graph())throw new Error('Seu navegador não oferece áudio.');
      await context.resume();
      return play({sound:id,at:serverNow(),volume:100},latest.state.audio?.clips||[],{local:true});
    },
    get musicVolume() {return musicVolume;},
    get enabled() {return enabled;},
    get blocked() {return blocked;},
    get volume() {return volume;},
    sync,
    setView(visible) {audioPage=Boolean(visible);status();},
    toggle() {
      enabled=!enabled||blocked;
      blocked=false;
      if (enabled) {
        if (playerFailed) {
          playerAttempt++;
          clearTimeout(readyTimeout);
          visibility?.disconnect();playerVisible=typeof IntersectionObserver==='undefined';
          player?.destroy();player=null;playerReady=false;playerFailed=false;loadedVideo=null;failure='';
        }
        if (graph()) context.resume().catch(()=>{blocked=true;status();});
        applyMusicVolume();
        if (playerReady&&playerVisible&&currentTrack()?.playing) player.playVideo();
        reconcile();
      } else {
        generation++;stopEffects();
        if (playerReady) player.pauseVideo();
        if (gain) gain.gain.value=0;
        clearTimeout(transitionTimer);clearTimeout(volumeTimer);applyMusicVolume();
      }
      if (gain) gain.gain.value=enabled?volume:0;
      if(enabled&&latest)syncLoops(latest.state.audio||emptyAudio());
      status();
    },
    setVolume(value) {
      volume=Math.max(0,Math.min(1,Number(value)));
      if (gain&&enabled) gain.gain.value=volume;
      status();
    },
    setMusicVolume(value) {
      musicVolume=Math.max(0,Math.min(100,Number(value)));
      const slider=dock.querySelector('[data-music-volume]');
      if (slider) slider.value=musicVolume;
      applyMusicVolume();status();
    }
  };
}
