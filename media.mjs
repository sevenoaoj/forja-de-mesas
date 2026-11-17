export const soundPresets = [
  {id:'door',name:'Porta rangendo',icon:'◫'},
  {id:'thunder',name:'Trovão',icon:'ϟ'},
  {id:'steps',name:'Passos',icon:'⋯'},
  {id:'bell',name:'Sino',icon:'◈'},
  {id:'spell',name:'Magia',icon:'✦'},
  {id:'impact',name:'Impacto',icon:'✷'}
];

export function youtubeVideo(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const validId = /^[\w-]{11}$/;
  if (validId.test(text)) return text;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : 'https://'+text);
  } catch {
    return null;
  }
  const [,section,video,extra] = url.pathname.split('/');
  const host = url.hostname.toLowerCase();
  let id;
  if (['youtu.be','www.youtu.be'].includes(host) && !video) id = section;
  if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','www.youtube-nocookie.com'].includes(host)) {
    if (section==='watch' && !video) id = url.searchParams.get('v');
    else if (['shorts','live','embed'].includes(section) && !extra) id = video;
  }
  return id && validId.test(id) ? id : null;
}

export function emptyAudio() {
  return {clips:[], cues:[], track:null};
}

export const elapsed = (track, now) => {
  const position=track.position+(track.playing ? Math.max(0,now-track.changed)/1000 : 0);
  return track.loop&&Number.isFinite(track.duration)&&track.duration>0 ? ((position%track.duration)+track.duration)%track.duration : position;
};

export const audioDelay=1200;

export function effectiveTrack(track,now) {
  if (!track) return null;
  if (track.changed>now) return track.previous||null;
  return track.stopped?null:track;
}

export function musicGain(track,now) {
  if (!track) return 0;
  const clamp=value=>Math.max(0,Math.min(1,value));
  const fade=track.fade;
  if (now<track.changed) {
    const previous=track.previous;
    if (!previous?.playing||previous.stopped) return 0;
    const from=clamp(previous.gain??1);
    if (!fade||now<fade.start||!fade.outMs) return from;
    return from*(1-clamp((now-fade.start)/fade.outMs));
  }
  if (track.stopped||!track.playing) return 0;
  if (fade?.inMs>0) {const from=clamp(fade.fromGain??0);return from+(1-from)*clamp((now-track.changed)/fade.inMs);}
  return clamp(track.gain??1);
}
