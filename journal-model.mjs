const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export const journalKinds={note:'Anotação',item:'Inventário',clue:'Pista',character:'Personagem',place:'Local',quest:'Missão'};
export const journalBudgetBytes=512*1024;
const commit=(state,entries)=>{if(new TextEncoder().encode(JSON.stringify(entries)).length>journalBudgetBytes)fail(413,'O diário excede 512 KB. Reduza documentos ou remova anotações antigas.');state.journal=entries;};
export const journalActions=new Set(['journalImport','journalSave','journalDelete','journalPublish','journalStatus']);
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
 if(action==='journalImport'){
  if(!access.master)fail(403,'Somente o mestre importa notas.');
  if(!Array.isArray(data.files)||!data.files.length||data.files.length>200)fail(400,'Selecione de 1 a 200 notas Markdown.');
  const entries=[...(state.journal||[])],paths=new Set(entries.map(e=>e.sourcePath));
  for(const file of data.files){
   const path=file?.path;
   if(typeof path!=='string'||path.length>512||!path.toLowerCase().endsWith('.md')||path.split('/').some(p=>!p||p.startsWith('.'))||/[\\\x00-\x1f]/.test(path))fail(400,'Caminho de nota inválido.');
   const index=entries.findIndex(e=>e.sourcePath===path),old=entries[index];
   if(paths.has(path)&&file.version===undefined)continue;
   if(file.version!==undefined&&(!old||old.version!==file.version||old.audience!=='private'||old.sourceEdited===true||old.sourceEdited===undefined&&old.version>1))
    fail(409,'A nota mudou. Selecione novamente o cofre para revisar a importação.');
   const title=path.split('/').at(-1).slice(0,-3);
   if(!title.trim()||title.length>120)fail(400,'O título da nota '+path+' deve ter de 1 a 120 caracteres.');
   if(typeof file.body!=='string')fail(400,'Conteúdo Markdown inválido.');
   if(old){entries[index]={...old,body:file.body,version:old.version+1,sourceEdited:false,updatedAt:new Date().toISOString()};continue;}
   paths.add(path);
   entries.push({id:crypto.randomUUID(),version:1,title,kind:'note',body:file.body,gmNotes:'',sourcePath:path,sourceEdited:false,audience:'private',recipientIds:[],status:'active',updatedAt:new Date().toISOString()});
  }
  if(entries.length>200)fail(409,'O diário comporta até 200 documentos. Selecione menos notas.');
  commit(state,entries);return true;
 }
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
  const body=typeof data.body==='string'?data.body:'';
  const entry={...(old?.characterIds?{characterIds:old.characterIds}:{}),...(old?.sourcePath?{sourcePath:old.sourcePath,sourceEdited:old.sourceEdited===true||old.sourceEdited===undefined&&old.version>1||body!==old.body}:{}),id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,title,kind,body,gmNotes:access.master?clean(data.gmNotes,8000):old?.gmNotes||'',...sharing(state,data),...(old?.authorId?{authorId:old.authorId,authorName:old.authorName}:!access.master?{authorId:access.memberId,authorName:author.name}:{}),status:kind==='quest'?status:'active',updatedAt:new Date().toISOString()};
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
