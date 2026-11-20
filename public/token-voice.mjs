// Only the activity flag leaves this device. The analyser has no audio output.
export function createTokenMicrophone({publish,changed,failed}){
  let session;
  function stop(){
    const old=session;if(!old)return;
    session=null;clearInterval(old.timer);
    old.stream?.getTracks().forEach(track=>track.stop());
    old.context?.close().catch(()=>{});
    if(old.active||old.sentActive)queue(old,false);
    changed();
  }
  function queue(s,active){
    s.pending=active;
    if(s.busy)return;
    s.busy=true;
    void (async()=>{
      try{
        while(s.pending!==undefined){
          const value=s.pending;s.pending=undefined;s.sentActive=value;
          await publish(s.identity,value);
        }
      }catch(error){if(s===session){stop();failed(error.message);}}
      finally{s.busy=false;}
    })();
  }
  async function start(identity){
    if(session){stop();return;}
    if(!globalThis.navigator?.mediaDevices?.getUserMedia)throw Error('Para ativar o microfone, abra a mesa por HTTPS ou em localhost no PC.');
    const s=session={identity,active:false,lastVoice:-Infinity,lastSend:0,attack:0};
    changed();
    try{
      s.context=new AudioContext();
      const resume=s.context.resume();resume.catch(()=>{});
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(session!==s){stream.getTracks().forEach(t=>t.stop());return;}
      s.stream=stream;await resume;if(session!==s)return;
      const source=s.context.createMediaStreamSource(stream),analyser=s.context.createAnalyser();
      analyser.fftSize=1024;source.connect(analyser);
      const samples=new Float32Array(analyser.fftSize);
      stream.getAudioTracks()[0].onended=()=>{if(session===s)stop();};
      let floor=.003;
      s.timer=setInterval(()=>{
        analyser.getFloatTimeDomainData(samples);
        let power=0;for(const v of samples)power+=v*v;
        const level=Math.sqrt(power/samples.length),now=performance.now();
        const loud=level>Math.max(.012,floor*3);
        if(!loud&&!s.active)floor=.96*floor+.04*level;
        s.attack=loud?s.attack+1:0;
        if(s.attack>=2)s.lastVoice=now;
        const active=now-s.lastVoice<300;
        if(s.active!==active||active&&now-s.lastSend>900){
          s.active=active;s.lastSend=now;queue(s,active);changed();
        }
      },50);
      changed();
    }catch(error){
      if(session!==s)return;
      stop();throw Error(error.name==='NotAllowedError'?'O navegador não liberou o microfone. Confira a permissão do site.':'Não foi possível abrir o microfone. Confira o dispositivo e tente novamente.');
    }
  }
  return {start,stop,get session(){return session;}};
}
