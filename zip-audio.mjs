const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export const packLimit=32*1024*1024;
const types={ogg:'audio/ogg',mp3:'audio/mpeg',wav:'audio/wav',flac:'audio/flac',m4a:'audio/mp4'};
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
async function inflate(bytes,max){
 let stream;try{stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{fail('Este servidor não oferece leitura de ZIP deflate. Atualize o Node ou envie os áudios individualmente.');}
 const reader=stream.getReader(),chunks=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>max){await reader.cancel();fail('Arquivo expandido excede o tamanho declarado.');}chunks.push(next.value);}}catch(error){if(error.status)throw error;fail('Não foi possível descompactar o ZIP.');}
 const result=new Uint8Array(size);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
}
export async function readAudioZip(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>packLimit||bytes.length<22)fail('Use um ZIP de áudio de até 32 MB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(view.getUint32(at,true)===0x06054b50&&at+22+view.getUint16(at+20,true)===bytes.length){end=at;break;}
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))fail('ZIP inválido ou dividido em volumes.');
 const count=view.getUint16(end+10,true),directorySize=view.getUint32(end+12,true),directory=view.getUint32(end+16,true);
 if(count>1500||directory+directorySize>end)fail('O ZIP contém arquivos demais ou um índice inválido.');
 let at=directory,total=0;const entries=[],names=new Set();
 for(let i=0;i<count;i++){
  if(at+46>directory+directorySize||view.getUint32(at,true)!==0x02014b50)fail('Índice ZIP inválido.');
  const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),crc=view.getUint32(at+16,true),compressed=view.getUint32(at+20,true),size=view.getUint32(at+24,true),length=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),offset=view.getUint32(at+42,true);
  if(at+46+length+extra+comment>directory+directorySize||flags&1||![0,8].includes(method))fail('ZIP criptografado, corrompido ou com compressão incompatível.');
  const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+length));at+=46+length+extra+comment;
  if(name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||/^[a-z]:/i.test(name)||name.includes('\0'))fail('O ZIP contém um caminho inválido.');
  total+=size;if(total>64*1024*1024)fail('O conteúdo expandido excede 64 MB.');
  const ext=name.split('.').at(-1).toLowerCase();if(!types[ext]||name.startsWith('__MACOSX/')||name.split('/').at(-1).startsWith('.'))continue;
  if(!size||size>8*1024*1024||entries.length>=500)fail('Use até 500 áudios de no máximo 8 MB cada.');
  const key=name.toLowerCase();if(names.has(key))fail('O ZIP contém arquivos de áudio duplicados.');names.add(key);
  entries.push({name,method,crc,compressed,size,offset,type:types[ext]});
 }
 if(!entries.length)fail('Nenhum arquivo OGG, MP3, WAV, FLAC ou M4A encontrado no ZIP.');
 const sounds=[];
 for(const entry of entries){
  const {offset,compressed,method,size}=entry;
  if(offset+30>directory||view.getUint32(offset,true)!==0x04034b50||view.getUint16(offset+8,true)!==method)fail('Cabeçalho de arquivo ZIP inválido.');
  const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);
  if(start+compressed>directory)fail('Arquivo ZIP truncado.');
  const data=method===0?bytes.slice(start,start+compressed):await inflate(bytes.subarray(start,start+compressed),size);
  if(data.length!==size||crc32(data)!==entry.crc)fail('O ZIP contém áudio corrompido.');
  const signature=new TextDecoder().decode(data.subarray(0,12));
  const valid=entry.type==='audio/ogg'?signature.startsWith('OggS'):entry.type==='audio/wav'?signature.startsWith('RIFF')&&signature.slice(8,12)==='WAVE':entry.type==='audio/flac'?signature.startsWith('fLaC'):entry.type==='audio/mp4'?signature.slice(4,8)==='ftyp':signature.startsWith('ID3')||data[0]===255&&(data[1]&224)===224;
  if(!valid)fail('O arquivo '+entry.name+' não corresponde ao formato de áudio declarado.');
  sounds.push({...entry,data});
 }
 return sounds;
}
