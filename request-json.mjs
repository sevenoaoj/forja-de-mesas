const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

// Content-Length is only a hint: chunked bodies must obey the same byte limit.
export async function requestJson(request,max=1_500_000){
 if(Number(request.headers.get('Content-Length'))>max)fail(413,'Dados enviados excedem o limite.');
 const reader=request.body?.getReader();
 if(!reader)fail(400,'Dados inválidos.');
 const chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>max)fail(413,'Dados enviados excedem o limite.');
   chunks.push(value);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
 const data=JSON.parse(await new Blob(chunks).text());
 if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Envie um objeto JSON válido.');
 return data;
}
