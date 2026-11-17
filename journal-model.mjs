const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export const journalKinds={note:'Anotação',item:'Inventário',clue:'Pista',character:'Personagem',place:'Local',quest:'Missão'};
export const journalBudgetBytes=512*1024;
const commit=(state,entries)=>{if(new TextEncoder().encode(JSON.stringify(entries)).length>journalBudgetBytes)fail(413,'O diário excede 512 KB. Reduza documentos ou remova anotações antigas.');state.journal=entries;};
export const journalActions=new Set(['journalSave','journalDelete','journalPublish','journalStatus']);
export function journalView(state,access){
 const entries=Array.isArray(state.journal)?state.journal:[];
 if(access.master)return structuredClone(entries);
 if(!access.memberId||access.guest)return [];
 const own=new Set((state.characters||[]).filter(c=>!c.hidden&&c.ownerId===access.memberId).map(c=>c.id));
 return entries.filter(e=>e.authorId===access.memberId||e.audience==='all'||e.audience==='selected'&&e.recipientIds?.some(id=>own.has(id))).map(e=>({id:e.id,version:e.version,title:e.title,kind:e.kind,body:e.body,status:e.status,updatedAt:e.updatedAt,authorName:e.authorName||'Mestre',canEdit:e.authorId===access.memberId,...(e.authorId===access.memberId?{audience:e.audience,recipientIds:e.recipientIds}:{} )}));
}
function sharing(state,data){
 const audience=data.audience??'private';
 if(!['private','all','selected'].includes(audience))fail(400,'Escolha quem pode ler o documento.');
 const ids=audience==='selected'?data.recipientIds:[];
 if(!Array.isArray(ids)||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>!(state.characters||[]).some(c=>c.id===id&&!c.hidden)))fail(400,'Escolha personagens visíveis da campanha.');
 if(audience==='selected'&&!ids.length)fail(400,'Selecione pelo menos um personagem.');
 return {audience,recipientIds:[...ids]};
}
export function mutateJournal(state,action,data={},access={}){
 if(!journalActions.has(action))return false;
 const entries=state.journal||[],old=entries.find(e=>e.id===data.id);
 if(!access.master&&(access.guest||!access.memberId||!state.characters?.some(c=>!c.hidden&&c.ownerId===access.memberId)||old?.authorId!==access.memberId&&data.id))fail(403,'Você pode editar apenas seus próprios registros no diário.');
 if(data.id&&!old)fail(404,'Documento indisponível.');
 if(old&&data.version!==old.version)fail(409,'Este documento mudou. Abra novamente para preservar as alterações.');
 if(action==='journalSave'){
  if(!old&&entries.length>=200)fail(409,'Use até 200 documentos por campanha.');
  const title=clean(data.title,120),kind=data.kind??'note';
  if(!title)fail(400,'Informe um título.');
  if(!Object.hasOwn(journalKinds,kind))fail(400,'Categoria inválida.');
  const status=data.status??'active';if(!['active','completed'].includes(status))fail(400,'Estado de missão inválido.');
  const author=state.characters?.find(c=>!c.hidden&&c.ownerId===access.memberId);
  const entry={id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,title,kind,body:clean(data.body,16000),gmNotes:access.master?clean(data.gmNotes,8000):old?.gmNotes||'',...sharing(state,data),...(old?.authorId?{authorId:old.authorId,authorName:old.authorName}:!access.master?{authorId:access.memberId,authorName:author.name}:{}),status:kind==='quest'?status:'active',updatedAt:new Date().toISOString()};
  commit(state,old?entries.map(e=>e===old?entry:e):[...entries,entry]);
 }else{
  if(!old)fail(404,'Documento indisponível.');
  if(action==='journalDelete')commit(state,entries.filter(e=>e!==old));
  else{
   const change=action==='journalPublish'?sharing(state,data):{status:data.status};
   if(action==='journalStatus'&&(old.kind!=='quest'||!['active','completed'].includes(data.status)))fail(400,'Selecione uma missão e um estado válido.');
   commit(state,entries.map(e=>e===old?{...e,...change,version:e.version+1,updatedAt:new Date().toISOString()}:e));
  }
 }
 return true;
}
