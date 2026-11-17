export function createAccessStorage(storage=()=>globalThis.localStorage){
 const memory=new Map();
 return {
  read(key){try{const value=storage().getItem(key);if(value!==null)return JSON.parse(value);}catch{}return memory.get(key)??null;},
  write(key,value){memory.set(key,value);try{storage().setItem(key,JSON.stringify(value));return true;}catch{return false;}},
  remove(key){memory.delete(key);try{storage().removeItem(key);}catch{}}
 };
}

// A public invitation never supersedes a previously authenticated player.
export async function restoreCampaignIdentity(access,{request,post,read,write,makeKey}={}){
 let row;
 try{
  row=await request('/'+access.id+'/session',{},access).then(r=>r.json());
  if(row.key)return {row,access:{id:access.id,key:row.key}};
 }catch(error){if(![401,403,404].includes(error.status))throw error;}
 if(!access.key)throw new Error('Não foi possível recuperar sua identificação. Use o código privado do jogador ou peça ao mestre para recuperar seu acesso à ficha.');
 row=await request('/'+access.id,{},access).then(r=>r.json());
 if(row.role!=='guest')return {row,access};
 const keys=read('forja.memberKeys')||{},saved=read('forja.campaigns')?.[access.id];
 keys[access.id]??=/^[a-f0-9]{64}$/.test(saved?.key||'')?saved.key:makeKey();
 write('forja.memberKeys',keys);
 row=await post('/'+access.id+'/join',{key:keys[access.id]},access);
 return {row,access:{id:access.id,key:row.key}};
}
