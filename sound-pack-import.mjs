import {soundPacks,soundLabel,soundCategory} from './sound-catalog.mjs';
import {readAudioZip,packLimit} from './zip-audio.mjs';
import {normalizeSoundboard,mutateSoundboard} from './soundboard-model.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export async function boundedPackBytes(response){
 if(Number(response.headers.get('Content-Length'))>packLimit)fail(413,'Use um pacote ZIP de até 32 MB.');
 const reader=response.body?.getReader();if(!reader)fail(400,'Envie um pacote ZIP.');
 const chunks=[];let total=0;
 while(true){const next=await reader.read();if(next.done)break;total+=next.value.length;if(total>packLimit){await reader.cancel();fail(413,'O pacote excede 32 MB.');}chunks.push(next.value);}
 const result=new Uint8Array(total);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
}
export async function installSoundPack(request,store,row,{update,fetcher=fetch}={}){
 const url=new URL(request.url),catalog=soundPacks.find(p=>p.id===url.searchParams.get('pack'));
 let pack,bytes;
 if(url.searchParams.has('pack')){
  if(!catalog)fail(404,'Pacote de sons indisponível.');
  pack=catalog;
  if(!(row.state.audio?.clips||[]).some(c=>c.packId===pack.id)){
   try{const response=await fetcher(pack.archive,{signal:AbortSignal.timeout(45000),redirect:'error'});if(!response.ok)throw new Error('HTTP '+response.status);bytes=await boundedPackBytes(response);}
   catch(error){if(error.status)throw error;fail(502,'Não foi possível baixar o pacote do Kenney. Tente novamente ou baixe o ZIP na página da fonte e use “Importar pacote ZIP”.');}
  }
 }else{
  let name,author,source,license;
  try{for(const field of ['Name','Author','Source','License']){const value=decodeURIComponent(request.headers.get('X-Pack-'+field)||'').trim();if(value.length>500)fail(400,'Metadados do pacote muito longos.');if(field==='Name')name=value;if(field==='Author')author=value;if(field==='Source')source=value;if(field==='License')license=value;}}
  catch(error){if(error.status)throw error;fail(400,'Metadados do pacote inválidos.');}
  if(!name||name.length>100)fail(400,'Informe um nome de pacote de até 100 caracteres.');
  if(source){try{const link=new URL(source);if(!['https:','http:'].includes(link.protocol)||link.username||link.password)throw new Error();}catch{fail(400,'Informe um link HTTP ou HTTPS da fonte.');}}
  pack={id:'custom-'+crypto.randomUUID(),name,author:author||'Importado pelo mestre',source,license:license||'Licença informada pelo mestre'};
  bytes=await boundedPackBytes(request);
 }
 const files=bytes?await readAudioZip(bytes):[];
 // Prefer compressed OGG when a pack supplies the same recording in WAV and OGG.
 const ogg=new Set(files.filter(f=>f.type==='audio/ogg').map(f=>f.name.split('/').at(-1).replace(/\.[^.]+$/,'').toLowerCase()));
 const selected=files.filter(f=>f.type!=='audio/wav'||!ogg.has(f.name.split('/').at(-1).replace(/\.[^.]+$/,'').toLowerCase()));
 const assets=selected.map(file=>({id:crypto.randomUUID(),name:soundLabel(file.name),type:file.type,size:file.data.length,packId:pack.id,category:soundCategory(file.name),originalName:file.name.split('/').at(-1),author:pack.author,license:pack.license,source:pack.source,data:file.data}));
 const written=[];let inserted=false;
 try{
  for(const asset of assets){const key=row.id+'/'+asset.id;written.push(key);await store.putAsset(key,new Blob([asset.data],{type:asset.type}));}
  const updated=await update(store,row,state=>{
   inserted=false;state.audio??={clips:[],cues:[],track:null};
   if(!state.audio.clips.some(c=>c.packId===pack.id)){
    if(!assets.length)fail(409,'O pacote mudou durante o download. Tente instalar novamente.');
    if(state.audio.clips.length+assets.length>600)fail(409,'Use até 600 sons por campanha.');
    if(state.audio.clips.reduce((sum,c)=>sum+c.size,0)+assets.reduce((sum,c)=>sum+c.size,0)>64*1024*1024)fail(413,'O soundboard suporta até 64 MB de arquivos.');
    state.audio.clips.push(...assets.map(({data,...asset})=>asset));
    state.audio.packs=[...(state.audio.packs||[]).filter(p=>p.id!==pack.id),{id:pack.id,name:pack.name,author:pack.author,source:pack.source,license:pack.license,installedAt:new Date().toISOString()}];inserted=true;
   }
   const sessionId=url.searchParams.get('session')||normalizeSoundboard(state.audio).activeSessionId;
   mutateSoundboard(state.audio,'soundboardPackToggle',{sessionId,packId:pack.id,enabled:true});
  });
  if(!inserted)await Promise.all(written.map(key=>store.deleteAsset(key).catch(()=>{})));
  return updated;
 }catch(error){await Promise.all(written.map(key=>store.deleteAsset(key).catch(()=>{})));throw error;}
}
