import {mutateInventory,recordItemDelivery} from './inventory-model.mjs';
import {sceneLibrary} from './scene-model.mjs';
import {isPlayerCharacter,tokenCharacterId} from './model.mjs';
import {pointRevealed} from './fog-geometry.mjs';
import {pointInVision,visionSector,wallBlocksRay} from './vision-model.mjs';
import {normalizeTable} from './table-model.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export const explorationActions=new Set(['explorePlace','exploreRemove','exploreInvestigate','exploreDecide','exploreConfigure','exploreReveal','soundOcclusion']);
export const discoveryKey=c=>c&&(c.party?'party:'+c.party:'character:'+c.id);
function listeners(state,character){
 if(!character)return [];
 return (state.tokens||[]).filter(t=>!t.hidden&&tokenCharacterId(state,t)===character.id);
}
function distance(source,token){
 const half=(Number(token.size)||1)/2;
 return Math.hypot(source.x-token.x-half,source.y-token.y-half);
}
function sightAndReach(clue,tokens,table){
 if(table.fog?.mode!=='war'&&!pointRevealed(table.fog,clue))return false;
 return tokens.some(t=>{
  if(clue.bounds){const {w,h}=clue.bounds,size=(Number(t.size)||1)/2;if(Math.abs(t.x+size-clue.x)>w/2||Math.abs(t.y+size-clue.y)>h/2)return false;}
  else if(distance(clue,t)>clue.radius)return false;
  const sector=visionSector(t,table.grid);
  if(table.darkness?.enabled||table.fog?.enabled&&table.fog.mode==='war')return pointInVision(clue,sector,table.walls);
  return pointInVision(clue,{...sector,angle:360,enabled:true,radius:Infinity},table.walls);
 });
}
function checked(value,max){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)fail(400,'Posição ou alcance inválido.');
 return value;
}
export function explorationView(state,character,master,table){
 const points=state.table?.exploration||[];
 if(master)return points;
 const output=[],tokens=listeners(state,character),audience=discoveryKey(character);
 for(const clue of points){
  if(!sightAndReach(clue,tokens,table))continue;
  if(clue.kind==='sound'){
   if(state.audio?.clips?.some(c=>c.id===clue.clipId))output.push({id:clue.id,kind:'sound',x:clue.x,y:clue.y,label:'Som local'});
   continue;
  }
  if(clue.kind!=='clue')continue;
  const note=state.journal?.find(n=>n.id===clue.noteId);
  const personal='character:'+character.id;
  const discovery=clue.discoveries?.find(d=>d.target===personal)||clue.discoveries?.find(d=>d.target===audience);
  const found=discovery||(!clue.discoveries&&note?.discoveredBy?.some(k=>k===audience||k===personal));
  const revealedId=discovery?discovery.noteId:note?.id;
  output.push({id:clue.id,kind:'clue',x:clue.x,y:clue.y,label:clue.label,radius:clue.radius,mode:clue.mode,found:!!found,pending:clue.pending?.some(p=>p.audience===audience),...(found?{description:clue.description||'',...(revealedId?{noteId:revealedId}:{})}:{})});
 }
 return output;
}
// Measure from the edge of the listening token to each intersecting segment.
// A second, distant wall still muffles the source when the listener hugs the first.
function blockingWallProximity(listener,sound,half,walls){
 const dx=sound.x-listener.x,dy=sound.y-listener.y;
 let leastProximity=null;
 for(const wall of walls){
  if(!wallBlocksRay(listener,dx,dy,wall))continue;
  const wx=wall.toX-wall.x,wy=wall.toY-wall.y;
  const t=Math.max(0,Math.min(1,((listener.x-wall.x)*wx+(listener.y-wall.y)*wy)/(wx*wx+wy*wy)));
  const gap=Math.max(0,Math.hypot(listener.x-wall.x-t*wx,listener.y-wall.y-t*wy)-half);
  const proximity=Math.max(0,1-gap/3);
  const eased=proximity*proximity*(3-2*proximity);
  leastProximity=Math.min(leastProximity??1,eased);
 }
 return leastProximity;
}
export function ambientAt(state,character,master){
 const sounds=(state.table?.exploration||[]).filter(p=>p.kind==='sound');
 if(!sounds.length)return [];
 const tokens=master?(state.tokens||[]).filter(t=>!t.hidden&&state.characters?.some(c=>isPlayerCharacter(c)&&c.ownerId&&tokenCharacterId(state,t)===c.id)):listeners(state,character);
 const output=[];
 for(const sound of sounds){
  if(!state.audio?.clips?.some(c=>c.id===sound.clipId))continue;
  let gain=0,cutoffHz=0;
  for(const token of tokens){
   const fraction=1-distance(sound,token)/sound.radius;if(fraction<=0)continue;
   const half=(Number(token.size)||1)/2;
   const listener={x:token.x+half,y:token.y+half};
   const proximity=blockingWallProximity(listener,sound,half,state.table.walls||[]);
   const transmission=proximity===null?1:.45+.37*proximity;
   const level=fraction*fraction*transmission;
   if(level>gain){
    gain=level;
    cutoffHz=proximity!==null&&sound.muffle!==false?Math.round(2400+5000*proximity):0;
   }
  }
  if(gain>.001)output.push({id:sound.id,sound:sound.clipId,volume:Math.round(gain*100),muffled:cutoffHz>0,...(cutoffHz?{cutoffHz}:{}),at:sound.at});
 }
 return output;
}
export function investigationInbox(state){
 const lib=sceneLibrary(state),out=[];
 for(const scene of lib.scenes){
  const table=scene.id===lib.activeId?state.table:scene.table;
  for(const p of table?.exploration||[])for(const req of p.pending||[]){
   const character=state.characters.find(c=>c.id===req.characterId);
   out.push({id:req.id||p.id+'/'+req.audience,pointId:p.id,sceneId:scene.id,label:p.label,name:character?.name||'Personagem'});
  }
 }
 return out;
}
function rewardsFor(rules){
 return rules?.rewards??(rules?.itemId?[{itemId:rules.itemId,dc:rules.dc,quantity:rules.quantity}]:[]);
}
function validReward(r){
 return r&&typeof r.itemId==='string'&&r.itemId.length>0&&r.itemId.length<=100&&Number.isInteger(r.dc)&&Math.abs(r.dc)<=999&&Number.isInteger(r.quantity)&&r.quantity>=1&&r.quantity<=999;
}
function clueRules(state,data){
 const test=data.test||'',dc=data.dc??10,rewards=rewardsFor({...data,dc,quantity:data.quantity??1});
 if(typeof test!=='string'||test.length>180||!Number.isInteger(dc)||Math.abs(dc)>999)fail(400,'Confira o teste e a dificuldade.');
 if(!Array.isArray(rewards)||!rewards.every(validReward)||new Set(rewards.map(r=>r.itemId)).size!==rewards.length)fail(400,'Confira a quantidade e o resultado mínimo de cada item. Use uma linha por item.');
 if(rewards.some(r=>!state.inventory?.some(i=>i.id===r.itemId&&!i.characterId)))fail(400,'Escolha itens disponíveis no catálogo.');
 return {test,dc,rewards:rewards.map(({itemId,quantity,dc})=>({itemId,quantity,dc}))};
}
function recordDiscovery(point,target,note){
 point.discoveries=[...(point.discoveries||[]).filter(d=>d.target!==target),{target,noteId:note?.id||''}];
 if(note&&!note.discoveredBy?.includes(target)){note.discoveredBy=[...(note.discoveredBy||[]),target];note.version++;}
}
function clueContent(state,data){
 const noteId=data.noteId||'',description=data.description??'';
 if(noteId&&!state.journal?.some(n=>n.id===noteId))fail(400,'A anotação selecionada está indisponível.');
 if(typeof description!=='string'||description.length>8000)fail(400,'A descrição da pista comporta até 8.000 caracteres.');
 return {noteId,description:description.trim()};
}
export function mutateExploration(state,action,data,access){
 const table=normalizeTable(state),points=table.exploration||[];
 const character=access.memberId&&state.characters.find(c=>c.ownerId===access.memberId&&!c.hidden&&isPlayerCharacter(c));
 const audience=discoveryKey(character);
 if(!access.master&&action!=='exploreInvestigate')fail(403,'A preparação é exclusiva do mestre.');
 if(action==='explorePlace'){
  if(points.length>=96)fail(409,'A cena comporta até 96 pontos de exploração.');
  const base={id:crypto.randomUUID(),kind:data.kind,x:checked(data.x,table.grid.columns),y:checked(data.y,table.grid.rows),radius:checked(data.radius,80)};
  if(base.radius<.25)fail(400,'Informe pelo menos um quarto de célula de alcance.');
  if(data.kind==='region'){
   const w=checked(data.bounds?.w,table.grid.columns),h=checked(data.bounds?.h,table.grid.rows);
   const label=typeof data.label==='string'?data.label.trim():'';
   if(!w||!h||!label||label.length>80)fail(400,'Informe uma área e um nome para o gatilho.');
   const event=data.event||'alert';
   if(!['alert','scene','cinematic'].includes(event))fail(400,'Evento de região inválido.');
   if(event==='scene'&&(!sceneLibrary(state).scenes.some(s=>s.id===data.target)||data.target===data.sceneId))fail(400,'Escolha outra cena.');
   if(event==='cinematic'&&!state.cinematicCues?.some(c=>c.id===data.target))fail(400,'Cinemática indisponível.');
   points.push({...base,bounds:{w,h},label,event,...(event!=='alert'?{target:data.target}:{})});
  }else if(data.kind==='clue'){
   if(data.bounds){const w=checked(data.bounds.w,table.grid.columns),h=checked(data.bounds.h,table.grid.rows);if(!w||!h)fail(400,'Região vazia.');base.bounds={w,h};if(data.destination){if(!sceneLibrary(state).scenes.some(s=>s.id===data.destination))fail(400,'Cena de destino indisponível.');base.destination=data.destination;}}
   if(!['auto','approve'].includes(data.mode)||typeof data.label!=='string'||!data.label.trim()||data.label.length>80)fail(400,'Informe o nome no mapa e o modo de investigação.');
   const rules=clueRules(state,data);
   points.push({...base,label:data.label.trim(),...clueContent(state,data),discoveries:[],mode:rules.test||rules.rewards.length?'approve':data.mode,pending:[],rules});
  }else if(data.kind==='sound'&&state.audio?.clips?.some(c=>c.id===data.clipId)){
   if(data.muffle!==undefined&&typeof data.muffle!=='boolean')fail(400,'Configuração do filtro de paredes inválida.');
   points.push({...base,clipId:data.clipId,muffle:data.muffle!==false,at:Date.now()});
  }else fail(400,'Escolha um arquivo do soundboard.');
 }else{
  const point=points.find(p=>p.id===data.id);if(!point)fail(404,'Ponto indisponível.');
  if(point.kind==='clue'&&!point.discoveries){
   const oldNote=state.journal?.find(n=>n.id===point.noteId);
   point.discoveries=(oldNote?.discoveredBy||[]).map(target=>({target,noteId:oldNote.id}));
  }
  if(action==='exploreRemove'){
   const ids=new Set(point.pending?.map(r=>r.checkId));
   if(state.checkRequests)state.checkRequests.splice(0,state.checkRequests.length,...state.checkRequests.filter(c=>!ids.has(c.id)));
   points.splice(points.indexOf(point),1);
  }else if(action==='soundOcclusion'){
   if(point.kind!=='sound'||typeof data.muffle!=='boolean')fail(400,'Escolha uma fonte de som local.');
   point.muffle=data.muffle;
  }else if(action==='exploreConfigure'){
   if(point.kind!=='clue'||point.pending?.length)fail(409,'Resolva os pedidos pendentes antes de editar a pista.');
   if(point.rules?.itemId&&point.awarded?.length&&!point.awards?.some(a=>a.itemId===point.rules.itemId)){
    point.awards=[...(point.awards||[]),{itemId:point.rules.itemId,targets:point.awarded}];delete point.awarded;
   }
   Object.assign(point,clueContent(state,{...point,...data}));
   point.rules=clueRules(state,data);
   if(point.rules.test||point.rules.rewards.length)point.mode='approve';
  }
  else{
   const note=state.journal?.find(n=>n.id===point.noteId);
   if(point.kind!=='clue')fail(404,'Registro indisponível.');
   if(action==='exploreInvestigate'){
    if(!character||!sightAndReach(point,listeners(state,character),table))fail(403,'Aproxime seu token e mantenha a pista visível.');
    if((point.discoveries?.map(d=>d.target)??note?.discoveredBy)?.some(key=>key===audience||key==='character:'+character.id))return;
    if(point.mode==='approve'){
     if(!point.pending.some(p=>p.audience===audience)){
      const request={id:crypto.randomUUID(),audience,characterId:character.id};
      point.pending.push(request);
     }
    }else{
     recordDiscovery(point,audience,note);
    }
   }else{
    const request=action==='exploreDecide'?point.pending.find(p=>p.audience===data.audience&&(!data.requestId||p.id===data.requestId)):point.pending.find(p=>p.characterId===data.characterId);
    if(action==='exploreDecide'&&(!request||typeof data.grant!=='boolean'))fail(409,'Este pedido já foi tratado.');
    const recipient=state.characters.find(c=>c.id===(request?request.characterId:data.characterId)&&isPlayerCharacter(c)&&!c.hidden);
    if(data.grant!==false){
     if(!recipient)fail(400,'Escolha um personagem de jogador visível.');
     const target=data.scope==='individual'?'character:'+recipient.id:discoveryKey(recipient);
     if(request&&data.scope!=='individual'&&target!==request.audience)fail(409,'O grupo mudou. Revele individualmente ou recuse o pedido.');
     const revealed=data.noteId?state.journal?.find(n=>n.id===data.noteId):data.noteId===''?null:note;
     if(data.noteId&&!revealed)fail(404,'A nota selecionada foi removida.');
     const total=data.total;
     if(total!=null&&(!Number.isInteger(total)||Math.abs(total)>1000000))fail(400,'Informe um resultado inteiro válido.');
     const rules=point.rules;
     if(data.reward===true&&rewardsFor(rules).length&&total==null)fail(400,'Informe o resultado do teste para entregar as recompensas.');
     const items=[];
     for(const reward of rewardsFor(rules)){
      const previous=point.awards?.find(a=>a.itemId===reward.itemId);
      const targets=previous?.targets??(rules.itemId===reward.itemId?point.awarded:[])??[];
      if(total==null||total<reward.dc||targets.includes(target)||targets.includes(recipient.id)||data.reward===false)continue;
      const item=state.inventory?.find(i=>i.id===reward.itemId&&!i.characterId);
      if(!item)fail(409,'Uma recompensa foi removida do catálogo. Revise a configuração ou revele sem entregar os itens.');
      mutateInventory(state,'itemGrant',{id:item.id,version:item.version,characterId:recipient.id,quantity:reward.quantity},{master:true});
      items.push(state.inventory.at(-1));
      const updated={itemId:item.id,targets:[...targets,target,recipient.id]};
      point.awards=[...(point.awards||[]).filter(a=>a.itemId!==item.id),updated];
     }
     recordItemDelivery(state,recipient,items,{location:point.label});
     recordDiscovery(point,target,revealed);
    }
    if(request){
     point.pending.splice(point.pending.indexOf(request),1);
     const index=request.checkId?state.checkRequests?.findIndex(c=>c.id===request.checkId):-1;
     if(index>=0)state.checkRequests.splice(index,1);
    }
   }
  }
 }
 state.table={...state.table,exploration:points};
}

export function validateExploration(state){
 const ref=value=>typeof value==='string'&&value.length>0&&value.length<=100;
 const audience=value=>ref(value)&&/^(party|character):.+$/.test(value);
 for(const note of state.journal||[]){
  const found=note?.discoveredBy;
  if(found!==undefined&&(!Array.isArray(found)||!found.every(audience)||new Set(found).size!==found.length))fail(400,'Descobertas da nota inválidas no backup.');
 }
 for(const scene of [state,...(state.sceneLibrary?.scenes||[])]){
  const points=scene.table?.exploration;
  if(points===undefined)continue;
  if(!Array.isArray(points)||points.length>96)fail(400,'Pontos de exploração inválidos no backup.');
  const ids=new Set();
  for(const p of points){
   if(!p||!ref(p.id)||ids.has(p.id)||![p.x,p.y,p.radius].every(Number.isFinite)||p.x<0||p.y<0||p.radius<=0)fail(400,'Ponto de exploração inválido no backup.');
   ids.add(p.id);
   if(p.kind==='region'&&ref(p.label)&&Number.isFinite(p.bounds?.w)&&p.bounds.w>0&&Number.isFinite(p.bounds?.h)&&p.bounds.h>0&&(['scene','cinematic'].includes(p.event)?ref(p.target):p.event==='alert'))continue;
   if(p.kind==='sound'&&ref(p.clipId)&&Number.isFinite(p.at)&&(p.muffle===undefined||typeof p.muffle==='boolean'))continue;
   if(p.rules&&(typeof p.rules.test!=='string'||p.rules.test.length>180||!Number.isInteger(p.rules.dc)||Math.abs(p.rules.dc)>999||!Array.isArray(rewardsFor(p.rules))||!rewardsFor(p.rules).every(validReward)))fail(400,'Teste de investigação inválido no backup.');
   if(p.awarded!==undefined&&(!Array.isArray(p.awarded)||p.awarded.some(key=>!ref(key))))fail(400,'Registro de recompensas inválido no backup.');
   if(p.discoveries!==undefined&&(!Array.isArray(p.discoveries)||p.discoveries.some(d=>!audience(d?.target)||d.noteId&&!ref(d.noteId))))fail(400,'Descobertas inválidas no backup.');
   if(p.awards!==undefined&&(!Array.isArray(p.awards)||p.awards.some(a=>!ref(a?.itemId)||!Array.isArray(a.targets)||!a.targets.every(ref))))fail(400,'Entregas inválidas no backup.');
   if(p.kind!=='clue'||p.noteId&&!ref(p.noteId)||p.description!==undefined&&(typeof p.description!=='string'||p.description.length>8000)||!ref(p.label)||!['approve','auto'].includes(p.mode)||!Array.isArray(p.pending)||p.pending.some(r=>!audience(r?.audience)||!ref(r.characterId)))fail(400,'Configuração de pista inválida no backup.');
  }
 }
}
