import {soundboardView,normalizeSoundboard} from './soundboard-model.mjs';
import {emptyAudio,youtubeVideo,audioDelay,effectiveTrack,elapsed,musicGain} from './media.mjs';

export const musicActions=new Set([
  'musicSessionSave','musicSessionDelete','musicSessionSelect','musicTrackSave',
  'musicTrackDelete','musicTrackMove','musicSettings'
]);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const uid=()=>crypto.randomUUID();
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const normalizedNumber=(value,fallback,max)=>typeof value==='number'&&Number.isFinite(value)
  ? Math.max(0,Math.min(max,value)):fallback;

function uniqueEntries(entries) {
  const seen=new Set();
  return entries.filter(entry=>{
    if (!entry.id||seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function settingsFor(value={}) {
  return {
    fadeIn:normalizedNumber(value.fadeIn,3,30),
    fadeOut:normalizedNumber(value.fadeOut,3,30),
    volume:normalizedNumber(value.volume,70,100)
  };
}

export function normalizeMusic(audio) {
  const value=audio?.music||{};
  const sessions=uniqueEntries((Array.isArray(value.sessions)?value.sessions:[]).slice(0,20)
    .filter(session=>session&&typeof session==='object').map(session=>({
      id:clean(session.id,80),name:clean(session.name,100)||'Sessão',
      tracks:uniqueEntries((Array.isArray(session.tracks)?session.tracks:[]).slice(0,100)
        .filter(track=>track&&typeof track==='object'&&youtubeVideo(track.video)).map(track=>({
          id:clean(track.id,80),video:youtubeVideo(track.video),
          title:clean(track.title,100)||'Música do YouTube',tag:clean(track.tag,50),loop:track.loop===true
        })))
    })));
  const activeSessionId=sessions.some(session=>session.id===value.activeSessionId)
    ? value.activeSessionId:sessions[0]?.id||'';
  return {sessions,activeSessionId,...settingsFor(value)};
}

function playerTrack(track) {
  if (!track) return track;
  const {title,source,previous,...shared}=track;
  return {...shared,title:'Trilha da mesa',...(previous?{previous:playerTrack(previous)}:{previous:null})};
}

export function audioView(value,master,{includeLibrary=true}={}) {
  const audio=value||emptyAudio();
  const needed=new Set([...(audio.cues||[]).map(c=>c.sound),...normalizeSoundboard(audio).loops.map(c=>c.sound)]);
  const clips=master&&includeLibrary?audio.clips||[]:(audio.clips||[]).filter(c=>needed.has(c.id));
  const {packs,...base}=audio;
  return {...base,clips,soundboard:soundboardView(audio,master,includeLibrary),...(master&&includeLibrary?{packs:audio.packs||[]}:{}),...(!master?{credits:(audio.packs||[]).map(({author,license,source})=>({author,license,source}))}:{}),
    track:master?audio.track:playerTrack(audio.track),
    music:master&&includeLibrary?normalizeMusic(audio):settingsFor(audio.music||{})};
}

function text(value,label,max,optional=false) {
  if (optional&&value===undefined) return '';
  if (typeof value!=='string'||value.trim().length>max||!optional&&!value.trim()) fail(400,label+' inválido.');
  return value.trim();
}

function number(value,label,max) {
  if (value===null||value===''||!['number','string'].includes(typeof value)||!Number.isFinite(Number(value))) fail(400,label+' inválido.');
  const parsed=Number(value);
  if (parsed<0||parsed>max) fail(400,label+' fora do intervalo permitido.');
  return parsed;
}

function optionalId(value) {
  if (value===undefined||value==='') return '';
  if (typeof value!=='string'||value.length>80||!value.trim()) fail(400,'Identificador inválido.');
  return value;
}

function findSession(music,id) {
  if (typeof id!=='string'||!id||id.length>80) fail(400,'Identificador de sessão inválido.');
  const session=music.sessions.find(session=>session.id===id);
  if (!session) fail(404,'Sessão musical indisponível.');
  return session;
}

function findTrack(session,id) {
  if (typeof id!=='string'||!id||id.length>80) fail(400,'Identificador de música inválido.');
  const track=session.tracks.find(track=>track.id===id);
  if (!track) fail(404,'Música indisponível nesta sessão.');
  return track;
}

export function changeMusic(audio,action,data) {
  if (!musicActions.has(action)) return false;
  const music=normalizeMusic(audio);
  if (action==='musicSettings') {
    for (const [field,label,max] of [['fadeIn','Fade-in',30],['fadeOut','Fade-out',30],['volume','Volume da mesa',100]]) {
      if (data[field]!==undefined) music[field]=number(data[field],label,max);
    }
  } else if (action==='musicSessionSave') {
    const name=text(data.name,'Nome da sessão',100);
    const id=optionalId(data.id);
    if (id) findSession(music,id).name=name;
    else {
      if (music.sessions.length>=20) fail(409,'Limite de 20 sessões musicais atingido.');
      const createdId=uid();
      music.sessions.push({id:createdId,name,tracks:[]});
      music.activeSessionId=createdId;
    }
  } else if (action==='musicSessionDelete') {
    findSession(music,data.id);
    music.sessions=music.sessions.filter(session=>session.id!==data.id);
    if (music.activeSessionId===data.id) music.activeSessionId=music.sessions[0]?.id||'';
  } else if (action==='musicSessionSelect') {
    music.activeSessionId=findSession(music,data.id).id;
  } else {
    const session=findSession(music,data.sessionId);
    if (action==='musicTrackSave') {
      const video=youtubeVideo(text(data.url,'Link do YouTube',2000));
      if (!video) fail(400,'Cole o link de um vídeo do YouTube.');
      const title=text(data.title,'Nome da música',100);
      const tag=text(data.tag,'Marcador da música',50,true);
      if(data.loop!==undefined&&typeof data.loop!=='boolean')fail(400,'Repetição inválida.');
      const id=optionalId(data.id),loop=data.loop??(id?findTrack(session,id).loop:false);
      if (id) Object.assign(findTrack(session,id),{video,title,tag,loop});
      else {
        if (session.tracks.length>=100) fail(409,'Limite de 100 músicas por sessão atingido.');
        session.tracks.push({id:uid(),video,title,tag,loop});
      }
    } else if (action==='musicTrackDelete') {
      findTrack(session,data.id);
      session.tracks=session.tracks.filter(track=>track.id!==data.id);
    } else if (action==='musicTrackMove') {
      if (![1,-1].includes(data.direction)) fail(400,'Direção inválida.');
      const track=findTrack(session,data.id);
      const from=session.tracks.indexOf(track);
      const to=Math.max(0,Math.min(session.tracks.length-1,from+data.direction));
      session.tracks.splice(from,1);
      session.tracks.splice(to,0,track);
    }
  }
  audio.music=music;
  return true;
}

function snapshot(track,gain) {
  if (!track) return null;
  const {previous,fade,...value}=track;
  return {...value,gain};
}

export function musicCommand(audio,data,now=Date.now()) {
  if (!['load','loadSaved','play','pause','restart','stop','setLoop','duration','ended'].includes(data.command)) fail(400,'Comando inválido.');
  if (data.expectedCommandId!==undefined) {
    const expected=text(data.expectedCommandId,'Identificador do comando',80);
    if (expected!==audio.track?.commandId) fail(409,'A música já foi alterada.');
  }
  if(['duration','ended'].includes(data.command)&&!data.expectedCommandId)fail(400,'Informe o comando atual.');
  if(data.command==='duration'){
    if(!audio.track||audio.track.stopped)fail(409,'Não há música ativa.');
    const duration=number(data.duration,'Duração',86400);if(duration<=0)fail(400,'Duração inválida.');
    audio.track={...audio.track,duration};return audio.track;
  }
  if(data.command==='setLoop'){
    if(typeof data.loop!=='boolean')fail(400,'Repetição inválida.');
    if(!audio.track||audio.track.stopped)fail(409,'Carregue uma música primeiro.');
    const track=audio.track;
    // Disabling after several cycles must retain the current point in the song.
    if(track.loop&&!data.loop&&track.changed<=now){
      const gain=musicGain(track,now),position=elapsed(track,now);
      const remaining=Math.max(0,track.changed+(track.fade?.inMs||0)-now);
      audio.track={...track,position,changed:now,commandId:uid(),previous:null,gain,
        fade:{start:now,outMs:0,inMs:remaining,fromGain:gain}};
    }
    audio.track={...audio.track,loop:data.loop};
    const source=track.source;
    if(source){const music=normalizeMusic(audio),saved=music.sessions.find(s=>s.id===source.sessionId)?.tracks.find(t=>t.id===source.itemId);if(saved){saved.loop=data.loop;audio.music=music;}}
    return audio.track;
  }
  const ended=data.command==='ended';
  if(ended)data={...data,command:audio.track?.loop?'restart':'stop'};
  const music=normalizeMusic(audio);
  const current=effectiveTrack(audio.track,now);
  const previous=snapshot(current,musicGain(audio.track,now));
  const start=now+audioDelay;
  const outMs=!ended&&current?.playing?music.fadeOut*1000:0;
  const changed=start+outMs;
  let target;
  if (data.command==='loadSaved') {
    const session=findSession(music,data.sessionId);
    const track=findTrack(session,data.id);
    target={video:track.video,title:track.title,position:0,loop:track.loop,source:{sessionId:session.id,itemId:track.id}};
  } else if (data.command==='load') {
    const video=youtubeVideo(text(data.url,'Link do YouTube',2000));
    if (!video) fail(400,'Cole o link de um vídeo do YouTube.');
    const title=text(data.title,'Nome da música',100,true)||'Música do YouTube';
    target={video,title,position:0,loop:data.loop===true};
  } else {
    const track=current||audio.track;
    if (!track) fail(409,'Carregue uma música primeiro.');
    const {previous,fade,gain,...value}=track;
    target={...value,position:data.command==='restart'?0:elapsed(track,changed)};
  }
  const playing=!['pause','stop'].includes(data.command);
  audio.track={...target,playing,stopped:data.command==='stop',changed,commandId:uid(),previous,
    fade:{start,outMs,inMs:playing&&!ended?music.fadeIn*1000:0}};
  audio.music=music;
  return audio.track;
}
