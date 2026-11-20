import {lootEffect} from './loot.mjs';
import {lightShape,renderDarkness,updateDarkness,renderVisionCones,updateVisionCones,visionSources,tokenInVision,normalizeRotation} from './table-vision.mjs';
import {tokenIconSvg} from './token-icons.mjs';
import {renderTableRollPanel,renderTableRollContent,renderFreeRollPreview,tableRollPreview,tableRollTabs} from './table-rolls.mjs';
import {renderRollHistory} from './rolls.mjs';
import {pointRevealed,slideToken,conditionSummary,normalizeTable,pingNames,mapPixelsPerCell} from './table-model.mjs';
import {colors,sheetFields,sheetValue,skillValues,displaySheetFormula,rollFormulaLimit,sheetTestBase,sheetAttributeTest,sheetSkillTest,sheetSavedRollFormula} from './model.mjs';

const escape = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons = {
  region:'<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><path d="M8 12h8m-4-4v8"/>',
  select:'<path d="m5 3 14 9-7 1-3 7z"/>',
  pan:'<path d="M8 12V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 4-3 6-6 6h-2c-2 0-3-1-4-3l-5-7a2 2 0 0 1 3-2l2 2"/>',
  measure:'<path d="m3 15 12-12 6 6L9 21zM8 10l3 3m1-7 3 3M4 14l3 3"/>',
  ping:'<circle cx="12" cy="10" r="3"/><path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0z"/>',
  draw:'<path d="m4 16 12-12 4 4L8 20H4zM13 7l4 4"/>',
  clue:'<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6"/>',
  sound:'<path d="M3 9h4l5-4v14l-5-4H3z M15 8q4 4 0 8m3-11q7 7 0 14"/>',
  lights:'<circle cx="12" cy="12" r="4"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4M4 4l3 3m10 10 3 3M4 20l3-3M17 7l3-3"/>',
  walls:'<path d="M2 5h20v14H2zM2 12h20M9 5v7m7 0v7"/>',
  fog:'<path d="M5 16a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5 5 0 1 1 2 10M3 19h18M7 22h10"/>',
  zoomIn:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
  zoomOut:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M7 10h6"/>',
  fit:'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/>',
  cones:'<path d="M12 20 3 4h18Z"/><path d="M12 20V4"/>',
  sharedVision:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 4v3"/>',
  darkness:'<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/>',
  settings:'<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  dice:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01m8 8h.01m-4-4h.01"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-7 5 7"/>',
  flag:'<path d="M5 22V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
const button = (label,act,id='',glyph='') => '<button type="button" class="btn small" data-act="'+act+'" data-id="'+escape(id)+'">'+(glyph?icon(glyph):'')+escape(label)+'</button>';
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

function drawingShape(drawing, extra='') {
  const {x,y,toX,toY,kind,color} = drawing;
  const common = ' fill="none" stroke="'+escape(color)+'" stroke-width="0.06" '+extra;
  if(['cone','burst','beam'].includes(kind)){
    const dx=toX-x,dy=toY-y,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),paint=' fill="'+escape(color)+'" fill-opacity=".22" stroke="'+escape(color)+'" stroke-width=".07"';
    if(kind==='burst')return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'"'+paint+'/>';
    if(kind==='beam')return '<line x1="'+x+'" y1="'+y+'" x2="'+toX+'" y2="'+toY+'" stroke="'+escape(color)+'" stroke-opacity=".5" stroke-width="1"/>';
    const edge=a=>(x+r*Math.cos(a))+' '+(y+r*Math.sin(a));
    return '<path d="M'+x+' '+y+' L'+edge(angle-Math.PI/6)+' A'+r+' '+r+' 0 0 1 '+edge(angle+Math.PI/6)+' Z"'+paint+'/>';
  }
  if (kind==='freehand') {
    const points=Array.isArray(drawing.points)?drawing.points:[];
    return '<polyline points="'+points.map(point=>point.x+','+point.y).join(' ')+'"'+common+' stroke-linecap="round" stroke-linejoin="round"/>';
  }
  if (kind==='line') return '<line x1="'+x+'" y1="'+y+'" x2="'+toX+'" y2="'+toY+'"'+common+'/>';
  const left=Math.min(x,toX),top=Math.min(y,toY),width=Math.abs(toX-x),height=Math.abs(toY-y);
  if (kind==='circle') return '<ellipse cx="'+(left+width/2)+'" cy="'+(top+height/2)+'" rx="'+width/2+'" ry="'+height/2+'"'+common+'/>';
  return '<rect x="'+left+'" y="'+top+'" width="'+width+'" height="'+height+'"'+common+'/>';
}

function fogStrokeShape(stroke,color){
 if(stroke.kind==='rectangle')return '<rect x="'+stroke.x+'" y="'+stroke.y+'" width="'+stroke.width+'" height="'+stroke.height+'" fill="'+color+'"/>';
 if(stroke.points.length===1)return '<circle cx="'+stroke.points[0].x+'" cy="'+stroke.points[0].y+'" r="'+stroke.radius+'" fill="'+color+'"/>';
 return '<path d="'+stroke.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+(stroke.radius*2)+'" stroke-linecap="round" stroke-linejoin="round"/>';
}

export function renderAtmosphere({weather,tone,level,toneOpacity=100}){
  const counts={rain:[32,64,98],snow:[22,42,68],embers:[14,28,46],storm:[56,82,110],dust:[16,30,46]};
  const count=counts[weather]?.[{light:0,medium:1,heavy:2}[level]]||0;
  // Stable samples keep the field in place when the scene is redrawn.
  const fraction=value=>value-Math.floor(value);
  const particles=Array.from({length:count},(_,i)=>{
    const depth=fraction((i+1)*0.618034),phase=fraction((i+1)*0.754878);
    const x=fraction((i+1)*0.569841+0.17)*100;
    const seconds=({rain:1.25,snow:10,embers:7,storm:0.9,dust:6}[weather])/(0.6+depth);
    const style='left:'+x.toFixed(2)+'%;--dust-x:'+x.toFixed(2)+'%;--period:'+seconds.toFixed(2)+'s;--delay:-'+(phase*seconds).toFixed(2)+'s;--phase:'+(phase*100).toFixed(1)+'%;--scale:'+(0.45+depth*0.95).toFixed(2)+';--alpha:'+(0.28+depth*0.68).toFixed(2)+';--sway:'+(8+depth*19).toFixed(1)+'px';
    return '<i style="'+style+'"></i>';
  }).join('');
  const ripples=['rain','storm'].includes(weather)?Array.from({length:Math.floor(count/6)},(_,i)=>
    '<b style="left:'+(fraction(i*0.618034+0.21)*100).toFixed(1)+'%;top:'+(fraction(i*0.414214+0.31)*100).toFixed(1)+'%;--period:'+(1.7+fraction(i*0.732)*2).toFixed(2)+'s;--delay:-'+(i*0.79).toFixed(2)+'s"></b>').join(''):'';
  const lightning=weather==='storm'?'<svg class="vtt-lightning" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M70 -4 66 7 69 6 62 18 65 16 58 30 M65 13 71 12 74 15" fill="none" stroke="#e5eaff" stroke-width="1.7" vector-effect="non-scaling-stroke"/></svg>':'';
  const strength=Math.min(100,Math.max(0,Number(toneOpacity)||0))/100;
  return '<div style="--tone-opacity:'+strength+'" class="vtt-atmosphere" data-weather="'+escape(weather)+'" data-tone="'+escape(tone)+'" data-level="'+escape(level)+'" aria-hidden="true"><span class="vtt-tone"></span>'+lightning+particles+ripples+'</div>';
}

export function createTabletop({action,openCharacter,openLoot=()=>{},placePoint=()=>{},explorationChanged=()=>{},report,requestAsset,realtime=()=>{}}) {
  let row;
  let table;
  let root;
  let viewport;
  let world;
  let events;
  let resize;
  let gesture;
  let selected='',routeDraft=null,sampleClock=0;
  let rotationPreview=null,localPlacement=null,visionPending=false,visionFrame=null,visionGeneration=0;
  let rotationSending=false,pendingRotation=null;
  const rotationAnimations=new Map(),drawnRotations=new Map();
  let rollingCharacter='';
  let rollingMastery='';
  let rollingMode='normal';
  let rollingTab='tests',rollingQuery='',rollingBase='1d20';
  let rollRevision=-1;
  let characterSignature='',connectionStatus='connecting';
  let historyMarkup='';
  let rollFormula='1d20';
  let tool='select';
  let shape='freehand',pingSignal='point';
  let lightColor='#ffb760',lightMode='draw',lightAngle=0,lightScope='';
  let wallMode='wall',effect='cone',effectName='',effectLength=0;
  let fogOperation='reveal';
  let fogShape='brush',fogBrushPixels=160;
  const brushRadius=()=>{const map=row?.state.map;const pixels=table.grid.mode==='manual'&&map?.width&&map?.height?Math.max(map.width/table.grid.columns,map.height/table.grid.rows):table.grid.cellPixels;return clamp(fogBrushPixels/(2*pixels),.001,8);};
  let playerPreview=false,showCones=true;
  let fogOpacity=.65;
  let migratedMap;
  let sceneMap;
  let mapDimensions;
  let drawingColor='#bd9afc';
  let zoom=1;
  let offset={x:0,y:0};
  let campaign;
  let loadedMap;
  let mapTask,previousViewport;
  let mapURL;
  const seenPings=new Set(),pingTimers=new Set(),remoteMoves=new Map(),seenLoot=new Set();
  let dragSequence=0;
  let baseWidth=800;
  let origin={x:12,y:12};
  const portraitURLs=new Map(),tokenPaint=new WeakMap();
  let tokenListKey=null,tokenListMarkup='';
  let busy=false;
  let focusAfterMove='';
  let measurement=null,measureMode='direct';
  const touches=new Map();

  function toolButton(id,label) {
    return '<button class="vtt-tool" type="button" data-table-tool="'+id+'" aria-label="'+label+'" title="'+label+'" aria-pressed="'+(tool===id)+'">'+icon(id)+'<span>'+label+'</span></button>';
  }

  const clock=()=>globalThis.performance?.now?.()??Date.now();
  const reducedVisionMotion=()=>Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  function animateRotation(id,target){
    const token=row.state.tokens.find(t=>t.id===id),from=drawnRotations.get(id)??normalizeRotation(token?.rotation),delta=((normalizeRotation(target)-from%360+540)%360)-180;
    if(typeof globalThis.requestAnimationFrame!=='function'||reducedVisionMotion()||Math.abs(delta)<.01){rotationAnimations.delete(id);return;}
    rotationAnimations.set(id,{from,to:from+delta,start:clock(),duration:110});
  }
  function displayedRotation(token){
    const target=rotationPreview?.id===token.id?rotationPreview.rotation:remoteMoves.get(token.id)?.active&&Number.isFinite(remoteMoves.get(token.id).rotation)?remoteMoves.get(token.id).rotation:normalizeRotation(token.rotation),animation=rotationAnimations.get(token.id);let angle=target;
    if(animation){const progress=Math.max(0,Math.min(1,(clock()-animation.start)/animation.duration));angle=animation.from+(animation.to-animation.from)*(1-(1-progress)**3);if(progress>=1||reducedVisionMotion()){rotationAnimations.delete(token.id);angle=target;}}
    drawnRotations.set(token.id,angle);return angle;
  }
  function remotePosition(token){
    const move=remoteMoves.get(token.id);if(!move?.active)return token;
    if(!move.from||!move.duration)return move.position||token;
    const progress=Math.min(1,Math.max(0,(clock()-move.receivedAt)/move.duration));
    return {x:move.from.x+(move.position.x-move.from.x)*progress,y:move.from.y+(move.position.y-move.from.y)*progress};
  }
  const movingRemotely=()=>[...remoteMoves.values()].some(move=>move.active&&move.duration&&clock()-move.receivedAt<move.duration);
  function patrolOffset(token){
    if(!token.motion)return {};
    const {at,ms,vx,vy}=token.motion,dt=clamp((row.serverTime||at)+clock()-sampleClock-at,0,ms);
    return {x:token.x+vx*dt,y:token.y+vy*dt};
  }
  function visualTokens(){return (row.state.tokens||[]).map(token=>({...token,...(gesture?.kind==='token'&&gesture.item.id===token.id?gesture.previewPosition||{}:localPlacement?.id===token.id?localPlacement.position:remoteMoves.get(token.id)?.active?remotePosition(token):patrolOffset(token)),rotation:displayedRotation(token)}));}
  function tokenShown(token,tokens=visualTokens(),sources=visionSources(row,tokens,{selected,preview:playerPreview})){
    return !table.darkness.enabled&&!(table.fog.enabled&&table.fog.mode==='war')||row.master&&!playerPreview||token.characterId&&token.characterId===row.characterId||tokenInVision(token,sources,table.grid,table.walls);
  }
  function queueVision(){if(visionPending)return;visionPending=true;const generation=visionGeneration;const paint=()=>{if(generation!==visionGeneration)return;visionPending=false;visionFrame=null;if(root&&world){paintVision();if(rotationAnimations.size||movingRemotely()||typeof requestAnimationFrame==='function'&&row.state.tokens.some(t=>t.motion&&(row.serverTime||t.motion.at)+clock()-sampleClock<t.motion.at+t.motion.ms))queueVision();}};if(typeof globalThis.requestAnimationFrame==='function')visionFrame=globalThis.requestAnimationFrame(paint);else queueMicrotask(paint);}
  function paintVision(){
    const tokens=visualTokens(),byId=new Map(tokens.map(token=>[token.id,token])),sources=visionSources(row,tokens,{selected,preview:playerPreview}),shown=new Map(tokens.map(token=>[token.id,tokenShown(token,tokens,sources)])),host=root.querySelector('.vtt-darkness-host');
    if(!row.master&&selected&&!tokens.some(token=>token.id===selected&&shown.get(token.id))){selected='';const selection=root.querySelector('[data-table-selection]');if(selection)selection.innerHTML=selectedMarkup();}
    const drags=new Map();
    for(const [id,move] of remoteMoves)if(move.active)drags.set(id,move.dragId);
    if(localPlacement?.dragId)drags.set(localPlacement.id,localPlacement.dragId);
    if(gesture?.kind==='token'&&gesture.moved)drags.set(gesture.item.id,gesture.dragId);
    updateDarkness(host,row,table,tokens,{selected,preview:playerPreview,drags});
    updateVisionCones(root.querySelector('.vtt-vision-cones-host'),row,table,tokens,{selected,preview:playerPreview,showCones});
    const sharing=root.querySelector('[data-table-action="visionShare"]');if(sharing){sharing.setAttribute('aria-pressed',String(table.darkness.mode==='group'));sharing.setAttribute('title',table.darkness.mode==='group'?'Voltar à visão individual dos jogadores':'Compartilhar visão entre jogadores');const label=sharing.querySelector?.('[data-vision-share-label]');if(label)label.textContent=table.darkness.mode==='teams'?'Visão: por grupos':table.darkness.mode==='group'?'Visão: compartilhada':'Visão: individual';}
    const cones=root.querySelector('[data-table-action="visionCones"]');if(cones){cones.setAttribute('aria-pressed',String(showCones));cones.disabled=!table.darkness.enabled||playerPreview;}
    for(const node of root.querySelectorAll('[data-table-token]')){
      const token=byId.get(node.dataset.tableToken);if(!token)continue;
      const previous=tokenPaint.get(node),visible=shown.get(token.id),rotation=normalizeRotation(token.rotation)+'deg';
      const left=token.x/table.grid.columns*100+'%',top=token.y/table.grid.rows*100+'%';
      if(node.style.left!==left)node.style.left=left;
      if(node.style.top!==top)node.style.top=top;
      if(previous?.rotation!==rotation)node.style.setProperty('--vtt-facing',rotation);
      if(previous?.visible!==visible){node.classList.toggle('is-out-of-vision',!visible);node.setAttribute('aria-hidden',String(!visible));node.setAttribute('tabindex',visible?'0':'-1');}
      tokenPaint.set(node,{x:token.x,y:token.y,rotation,visible});
    }
    const selectedToken=tokens.find(token=>token.id===selected);
    if(selectedToken){const output=root.querySelector('[data-facing-value]');if(output)output.textContent=(Math.round(normalizeRotation(selectedToken.rotation))%360)+'°';}
    const list=root.querySelector('[data-table-token-list]');if(list){const markup=tokenList(tokens,shown);if(list.innerHTML!==markup)list.innerHTML=markup;}
    const hint=root.querySelector('[data-vision-hint]');if(hint){hint.hidden=!table.darkness.enabled;if(table.darkness.enabled){const mode=table.darkness.mode==='teams'?'Visão por grupos':table.darkness.mode==='group'?'Visão compartilhada entre jogadores':'Visão individual';hint.textContent=row.master?(playerPreview?mode+' · Prévia dos jogadores; as guias do mestre estão ocultas.':mode+(showCones?' · Cones de todos os tokens. Tracejado indica token oculto dos jogadores.':' · Cones ocultados apenas nesta tela.')):visionSources(row,tokens).length?mode+' · Selecione seu token para ajustar a direção.':'Sem token de visão nesta cena. Peça ao mestre para vincular seu personagem a um token.';}}
  }
  function mayRotate(token){return Boolean(token&&token.kind!=='item'&&(row.master||token.characterId===row.characterId&&!token.locked&&!token.hidden&&token.canMove!==false));}
  function rotationTarget(id){return rotationPreview?.id===id?rotationPreview.rotation:row.state.tokens.find(t=>t.id===id)?.rotation||0;}
  async function rotateToken(id,rotation){
    const token=row.state.tokens.find(t=>t.id===id);if(!mayRotate(token)){if(rotationPreview?.id===id){rotationPreview=null;rotationAnimations.delete(id);queueVision();}return;}
    rotation=normalizeRotation(rotation);animateRotation(id,rotation);
    if(gesture?.kind==='token'&&gesture.item.id===id){gesture.rotation=rotation;sendTokenPreview(gesture,'move');}
    const intent={id,rotation,generation:visionGeneration,sceneId:row.state.sceneId};rotationPreview=intent;pendingRotation=intent;queueVision();
    if(rotationSending)return;
    rotationSending=true;let sent;
    try{while(pendingRotation){sent=pendingRotation;pendingRotation=null;if(sent.generation!==visionGeneration)break;if(!mayRotate(row.state.tokens.find(t=>t.id===sent.id)))continue;try{await action('tokenRotate',{id:sent.id,rotation:sent.rotation,...(sent.sceneId?{sceneId:sent.sceneId}:{})});}catch(error){if(sent.generation===visionGeneration){rotationAnimations.delete(sent.id);report(error.message);}}}}
    finally{rotationSending=false;if(rotationPreview===sent)rotationPreview=null;queueVision();}
  }

  function tokenPortrait(token){return token.kind==='item'&&token.loot?.item?.portrait?.id||(!token.icon||token.icon==='auto')&&(token.portrait?.id||row.state.characters?.find(character=>character.id===token.characterId)?.portrait?.id);}

  function activeCombatant(){
    const combat=row.state.table?.combat;
    return combat?.entries?.[combat.active];
  }

  function conditionBadges(token){
    const timed=(token.timedStatuses||[]).map(c=>{
      const fraction=c.mode==='turn'?(c.ending ? .5 : 1):c.remaining/c.total;
      const label=c.mode==='turn'?(c.ending?'até o fim deste turno':'até o fim do próximo turno'):c.remaining+' de '+c.total+' rodadas';
      return '<span class="vtt-condition" title="'+escape(c.name+' · '+label)+'"><i aria-hidden="true" style="--remaining:'+Math.round(fraction*100)+'%"></i>'+escape(c.name)+(c.mode==='rounds'?' · '+c.remaining:'')+'</span>';
    });
    return [...timed,...(token.statuses||[]).map(name=>'<span>'+escape(name)+'</span>')].slice(0,3).join('');
  }
  function tokenMarkup(token) {
    const {grid}=table;
    const size=Number(token.size)||1;
    const status=conditionBadges(token);
    return '<button type="button" class="vtt-token '+escape(token.color||'violet')+(token.hidden?' is-hidden':'')+(token.locked?' is-locked':'')+(selected===token.id?' is-selected':'')+(activeCombatant()?.tokenId===token.id?' is-active-turn':'')+(token.kind==='item'?' is-item':'')+(!tokenShown(token)?' is-out-of-vision':'')+'" '+
      'data-table-token="'+escape(token.id)+'" style="--vtt-facing:'+normalizeRotation(token.rotation)+'deg;left:'+token.x/grid.columns*100+'%;top:'+token.y/grid.rows*100+'%;width:'+size/grid.columns*100+'%;height:'+size/grid.rows*100+'%" '+
      'aria-label="'+escape([token.name,conditionSummary(token)].filter(Boolean).join(' · '))+(token.locked?' · Bloqueado':'')+(token.hidden?' · Oculto':'')+'" title="'+escape(token.name)+'">'+
      '<span '+(token.kind==='item'?'hidden ':'')+'class="vtt-token-facing" aria-hidden="true"></span><span class="vtt-token-face"><span class="vtt-token-letter">'+(tokenIconSvg(token.icon)||escape(token.name?.[0]?.toUpperCase()||'✦'))+'</span>'+
      (tokenPortrait(token)?'<img alt="" hidden data-table-token-image="'+escape(tokenPortrait(token))+'">':'')+
      (token.kind==='item'&&!tokenPortrait(token)&&/^https?:\/\//i.test(token.loot?.item?.portrait||'')?'<img alt="" hidden data-loot-portrait src="'+escape(token.loot.item.portrait)+'" referrerpolicy="no-referrer" decoding="async">':'')+'</span><span class="vtt-token-label">'+escape(token.name)+'</span>'+
      (status?'<span class="vtt-token-status">'+status+'</span>':'')+'</button>';
  }

  function fogMarkup() {
    if (!table.fog.enabled||table.fog.mode==='war') return '';
    const {columns,rows}=table.grid;
    const id='vtt-fog-'+String(row.id||'example').replace(/[^a-zA-Z0-9_-]/g,'');
    const paint=(revealed,hidden)=>table.fog.revealed.map(rect=>fogStrokeShape({...rect,kind:'rectangle'},revealed)).join('')+(table.fog.strokes||[]).map(stroke=>fogStrokeShape(stroke,stroke.operation==='reveal'?revealed:hidden)).join('');
    const holes=paint('black','white'),revealed=paint('white','black');
    const edge=Math.min(.12,...(table.fog.strokes||[]).filter(item=>item.kind==='brush').map(item=>item.radius*.18));
    const soft=Number(edge.toFixed(5)),blur=Number((edge*.8).toFixed(5)),distortion=Number((edge*1.2).toFixed(5));
    const coverage='<rect width="'+columns+'" height="'+rows+'" fill="white"/>'+holes;
    // Opaque base follows the authoritative coverage. Feathering adds fog only
    // inside revealed space; no concealed pixel is made translucent by a blur.
    return '<svg class="vtt-fog" viewBox="0 0 '+columns+' '+rows+'" preserveAspectRatio="none" aria-hidden="true"><defs>'+
      '<linearGradient id="'+id+'-tone" x2="1" y2="1"><stop stop-color="#111727"/><stop offset=".48" stop-color="#29283b"/><stop offset="1" stop-color="#101521"/></linearGradient>'+
      '<radialGradient id="'+id+'-mist"><stop stop-color="#7d739c" stop-opacity=".24"/><stop offset="1" stop-color="#6b688e" stop-opacity="0"/></radialGradient>'+
      '<filter id="'+id+'-soft" x="-20%" y="-20%" width="140%" height="140%"><feMorphology operator="dilate" radius="'+soft+'"/><feGaussianBlur stdDeviation="'+blur+'" result="edge-soft"/><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="edge-noise"/><feDisplacementMap in="edge-soft" in2="edge-noise" scale="'+distortion+'" xChannelSelector="R" yChannelSelector="G"/></filter>'+
      '<filter id="'+id+'-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 .57 0 0 0 0 .55 0 0 0 0 .72 0 0 0 .14 0"/></filter>'+
      '<mask id="'+id+'" maskUnits="userSpaceOnUse" x="0" y="0" width="'+columns+'" height="'+rows+'">'+coverage+'</mask>'+
      '<mask id="'+id+'-revealed" maskUnits="userSpaceOnUse" x="0" y="0" width="'+columns+'" height="'+rows+'"><rect width="'+columns+'" height="'+rows+'" fill="black"/>'+revealed+'</mask>'+
      '<mask id="'+id+'-feather" maskUnits="userSpaceOnUse" x="0" y="0" width="'+columns+'" height="'+rows+'"><g filter="url(#'+id+'-soft)">'+coverage+'</g></mask>'+
      '<pattern id="'+id+'-hatch" width=".5" height=".5" patternUnits="userSpaceOnUse"><path d="M0 .5 .5 0" stroke="#c8a8ef" stroke-opacity=".18" stroke-width=".025"/></pattern></defs>'+
      '<g class="vtt-fog-atmosphere"><g mask="url(#'+id+')"><rect class="vtt-fog-cover" width="'+columns+'" height="'+rows+'" fill="url(#'+id+'-tone)"/>'+
      '<ellipse cx="'+columns*.3+'" cy="'+rows*.25+'" rx="'+columns*.75+'" ry="'+rows*.65+'" fill="url(#'+id+'-mist)"/><ellipse cx="'+columns*.85+'" cy="'+rows*.8+'" rx="'+columns*.6+'" ry="'+rows*.8+'" fill="url(#'+id+'-mist)"/>'+
      '<rect width="'+columns+'" height="'+rows+'" filter="url(#'+id+'-grain)"/>'+
      (row.master?'<rect class="vtt-fog-hatch" width="'+columns+'" height="'+rows+'" fill="url(#'+id+'-hatch)"/>':'')+'</g>'+
      '<g mask="url(#'+id+'-revealed)"><rect width="'+columns+'" height="'+rows+'" fill="url(#'+id+'-tone)" mask="url(#'+id+'-feather)"/></g></g></svg>';
  }

  function lightMarkers(){
    return table.lights.map(l=>'<circle cx="'+l.x+'" cy="'+l.y+'" r=".15" fill="'+l.color+'" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke"/>').join('');
  }
  function pickLight(p){
    const bounds=world.getBoundingClientRect();
    let nearest=null,best=14;
    for(const light of table.lights){
      const d=Math.hypot((light.x-p.x)*bounds.width/table.grid.columns,(light.y-p.y)*bounds.height/table.grid.rows);
      if(d<=best){best=d;nearest=light;}
    }
    return nearest;
  }
  function lampAt(active,end){
    const distance=Math.hypot(end.x-active.start.x,end.y-active.start.y);
    return {...active.start,scope:lightScope||active.light?.scope||'global',radius:distance<.25?(active.light?.radius||3):Math.min(distance,80),
      angle:lightAngle||active.light?.angle||360,rotation:distance<.25?(active.light?.rotation||0):normalizeRotation(Math.atan2(end.y-active.start.y,end.x-active.start.x)*180/Math.PI+90)};
  }
  function wallLine(w){
    const color=w.kind==='door'?(w.open?'#77efd4':'#ffd17b'):'#c6b6ff';
    const line='x1="'+w.x+'" y1="'+w.y+'" x2="'+w.toX+'" y2="'+w.toY+'" vector-effect="non-scaling-stroke" stroke-linecap="round"';
    if(w.kind==='window')return '<line '+line+' stroke="#82daec" stroke-width="6"/><line '+line+' stroke="#184860" stroke-width="3"/><line '+line+' stroke="#d7faff" stroke-width="1" stroke-dasharray="7 4"/>';
    return '<line '+line+' stroke="#151122" stroke-width="6"/><line '+line+' stroke="'+color+'" stroke-width="3" '+(w.open?'stroke-dasharray="3 6"':'')+'/>';
  }

  // Measure picks in screen pixels so editing works at any zoom.
  function wallPick(p,endpoints=false){
    const bounds=world.getBoundingClientRect(),sx=bounds.width/table.grid.columns,sy=bounds.height/table.grid.rows;
    let best=endpoints?8:14,hit=null;
    for(const wall of table.walls){
      if(!endpoints&&wallMode==='toggle'&&wall.kind!=='door')continue;
      const dx=(wall.toX-wall.x)*sx,dy=(wall.toY-wall.y)*sy;
      const t=clamp(((p.x-wall.x)*sx*dx+(p.y-wall.y)*sy*dy)/(dx*dx+dy*dy),0,1);
      for(const fraction of endpoints?[0,1]:[t]){
        const x=wall.x+(wall.toX-wall.x)*fraction,y=wall.y+(wall.toY-wall.y)*fraction;
        const distance=Math.hypot((p.x-x)*sx,(p.y-y)*sy);
        if(distance<=best){best=distance;hit={wall,x,y};}
      }
    }
    return hit;
  }
  function wallPoint(p){const hit=wallPick(p,true);return hit?{x:hit.x,y:hit.y}:p;}

  let movingPoints=null;
  function explorationMotion(){
    if(row?.master||!root||!row?.characterId)return;
    if(gesture?.kind==='token'&&gesture.moved)return {moving:gesture.item.id,...gesture.previewPosition,...(gesture.path?.length?{path:JSON.stringify(gesture.path)}:{}),rotation:rotationTarget(gesture.item.id),exploreScene:row.state.sceneId,dragId:gesture.dragId};
    if(localPlacement)return {moving:localPlacement.id,...localPlacement.position,...(localPlacement.path?.length?{path:JSON.stringify(localPlacement.path)}:{}),rotation:rotationTarget(localPlacement.id),exploreScene:row.state.sceneId,dragId:localPlacement.dragId};
    for(const token of row.state.tokens){
      const remote=remoteMoves.get(token.id);
      if(token.characterId===row.characterId&&remote?.active&&remote.position)return {moving:token.id,...remote.position,rotation:remote.rotation??token.rotation??0,exploreScene:row.state.sceneId,dragId:remote.dragId};
    }
  }
  function syncPoints(points=null){
    if(movingPoints===points)return;
    const old=movingPoints??table.exploration??[];
    movingPoints=points;
    if(JSON.stringify(old)===JSON.stringify(points??table.exploration??[]))return;
    const markers=root?.querySelector('.vtt-points'),list=root?.querySelector('[data-point-list]');
    if(markers)markers.innerHTML=pointMarkers();
    if(list)list.innerHTML=pointsList();
  }
  function pointLabel(p){
    return p.kind==='sound'?(row.state.audio?.clips||[]).find(c=>c.id===p.clipId)?.name||'Som local':p.label;
  }
  function pointMarkers(){
    return (movingPoints??table.exploration??[]).map(p=>(row.master&&p.bounds?'<i class="region-guide" style="left:'+((p.x-p.bounds.w/2)/table.grid.columns*100)+'%;top:'+((p.y-p.bounds.h/2)/table.grid.rows*100)+'%;width:'+(p.bounds.w/table.grid.columns*100)+'%;height:'+(p.bounds.h/table.grid.rows*100)+'%"></i>':'')+'<button type="button" class="vtt-point" data-act="exploreOpen" data-id="'+escape(p.id)+'" title="'+escape(pointLabel(p))+'" aria-label="'+escape(pointLabel(p))+'" style="left:'+p.x/table.grid.columns*100+'%;top:'+p.y/table.grid.rows*100+'%">'+icon(p.kind==='region'?'region':p.kind==='sound'?'sound':'clue')+'</button>').join('');
  }
  function pointsList(){
    const points=movingPoints??table.exploration??[];
    if(!points.length)return '';
    return '<section class="vtt-side-section"><h2>'+ (row.master?'Pontos da cena':'Pontos por perto')+'</h2><div class="actions">'+points.map(p=>button(pointLabel(p)+(p.found?' · descoberta':p.pending?.length?' · '+p.pending.length+' pedido(s)':p.pending===true?' · aguardando':''),'exploreOpen',p.id,p.kind==='region'?'region':p.kind==='sound'?'sound':'clue')).join('')+'</div></section>';
  }
  function sceneMarkup() {
    const {columns,rows,visible}=table.grid;
    const drawings=table.drawings.map(item=>drawingShape(item)).join('');
    return '<div class="vtt-world'+(row.master?' is-master':'')+(row.master&&playerPreview?' is-player-preview':'')+'" style="--vtt-fog-opacity:'+fogOpacity+';aspect-ratio:'+columns+'/'+rows+';--vtt-columns:'+columns+';--vtt-rows:'+rows+'">'+
      '<div class="vtt-map" aria-hidden="true"></div>'+renderAtmosphere(table.atmosphere)+
      '<div class="vtt-grid'+(visible?'':' is-off')+'" aria-hidden="true"></div>'+
      '<svg class="vtt-drawings" viewBox="0 0 '+columns+' '+rows+'" preserveAspectRatio="none" aria-hidden="true">'+drawings+'</svg>'+
      '<div class="vtt-token-layer">'+(row.state.tokens||[]).map(tokenMarkup).join('')+'</div><div class="vtt-points">'+pointMarkers()+'</div><div class="vtt-loot-effects" aria-hidden="true"></div><div class="vtt-darkness-host">'+renderDarkness(row,table,row.state.tokens||[],{selected,preview:playerPreview})+'</div>'+fogMarkup()+'<div class="vtt-vision-cones-host">'+renderVisionCones(row,table,row.state.tokens||[],{selected,preview:playerPreview,showCones})+'</div>'+
      (row.master?'<svg class="vtt-light-markers" viewBox="0 0 '+columns+' '+rows+'" preserveAspectRatio="none" aria-hidden="true">'+lightMarkers()+'</svg>':'')+
      (row.master?'<svg class="vtt-walls" viewBox="0 0 '+columns+' '+rows+'" preserveAspectRatio="none" aria-hidden="true">'+table.walls.map(wallLine).join('')+'</svg>':'')+
      '<svg class="vtt-preview" viewBox="0 0 '+columns+' '+rows+'" preserveAspectRatio="none" aria-hidden="true"></svg>'+
      '<div class="vtt-pings" aria-hidden="true"></div></div>';
  }

  function tokenList(snapshot=visualTokens(),visibility) {
    const sources=visibility?null:visionSources(row,snapshot,{selected,preview:playerPreview});
    const tokens=snapshot.filter(token=>visibility?visibility.get(token.id):tokenShown(token,snapshot,sources));
    const key=JSON.stringify([selected,tokens.map(t=>[t.id,t.name,t.color,t.icon,t.hidden,t.locked,t.statuses,t.timedStatuses])]);if(key===tokenListKey)return tokenListMarkup;tokenListKey=key;
    return tokenListMarkup=tokens.length?'<ul class="vtt-token-list">'+tokens.map(token=>'<li><button type="button" data-table-select="'+escape(token.id)+'" class="'+(selected===token.id?'selected':'')+'">'+
      '<span class="vtt-token-swatch '+escape(token.color||'violet')+'">'+(tokenIconSvg(token.icon)||escape(token.name?.[0]||'✦'))+'</span><span><b>'+escape(token.name)+'</b>'+
      '<small>'+escape(conditionSummary(token)||(token.hidden?'Oculto':token.locked?'Bloqueado':'Na cena'))+'</small></span></button></li>').join('')+'</ul>':'<p class="vtt-empty">Nenhum token visível nesta cena.</p>';
  }

  function myCombatTurn(){
    const entry=activeCombatant();
    return Boolean(!row.master&&row.characterId&&entry?.tokenId&&row.state.tokens.some(token=>token.id===entry.tokenId&&token.characterId===row.characterId));
  }
  function combatMarkup() {
    const combat=table.combat;
    const hiddenTurn=row.state.table?.combat?.active===-1;
    const entries=combat.entries;
    const active=activeCombatant(),myTurn=myCombatTurn();
    const endTurn=myTurn?'<button type="button" class="btn primary" data-table-action="combatEndOwn" data-entry="'+escape(active.id)+'" data-round="'+combat.round+'">Encerrar meu turno</button>':'';
    return '<section class="vtt-side-section" data-table-combat><div class="vtt-side-heading"><h2>Iniciativa</h2>'+ (row.master?button('Organizar','tableCombat','','flag'):'')+'</div>'+
      (entries.length?'<div class="vtt-round">Rodada '+combat.round+(hiddenTurn?' · Turno do mestre':myTurn?' · Sua vez':'')+'</div><ol class="vtt-combat">'+entries.map((entry,index)=>'<li class="'+(!hiddenTurn && index===combat.active?'current':'')+'"><span>'+escape(entry.name)+'</span><strong>'+entry.value+'</strong>'+(!hiddenTurn && index===combat.active?'<small>Turno atual</small>':'')+'</li>').join('')+'</ol>'+(row.master?'<div class="vtt-turn-controls"><button type="button" class="btn small" data-table-action="combatPrevious" aria-label="Voltar um turno">←</button><button type="button" class="btn primary" data-table-action="combatNext">Próximo turno →</button></div>':endTurn):'<p class="vtt-empty">Organize a ordem dos participantes para acompanhar o combate.</p>')+'</section>';
  }

  function rollCharacters() {
    return (row.state.characters||[]).filter(character=>row.master||character.access==='full');
  }

  function rollCharacter() {
    const characters=rollCharacters();
    const character=characters.find(c=>c.id===rollingCharacter)||characters.find(c=>c.id===row.characterId)||characters[0];
    if(rollingCharacter!==character?.id)resetRollCharacter(character);
    rollingCharacter=character?.id||'';
    return character;
  }

  function resetRollCharacter(character){
    rollingCharacter=character?.id||'';rollingMastery='';rollingMode='normal';
    rollingTab='tests';rollingQuery='';rollingBase=sheetTestBase(character);rollFormula=rollingBase;
  }
  function rollView(){return {tab:rollingTab,query:rollingQuery,base:rollingBase,formula:rollFormula,mode:rollingMode,masteryId:rollingMastery};}
  function rollPanelContent() {
    characterSignature=JSON.stringify(row.state.characters||[]);
    return renderTableRollPanel(row,rollCharacter(),rollCharacters(),rollView());
  }
  function updateRollContent(){
    const content=root?.querySelector('[data-table-roll-content]'),character=rollCharacter();
    if(content&&character)content.innerHTML=renderTableRollContent(row,character,rollView());
  }

  function rollPanelMarkup() {
    return '<section class="vtt-side-section vtt-roll-section"><div class="vtt-side-heading"><h2>Dados da ficha</h2></div><div class="vtt-sheet-rolls" data-table-rolls tabindex="-1">'+rollPanelContent()+'</div></section>';
  }

  function updateRollPanel() {
    const panel=root?.querySelector('[data-table-rolls]');
    if(panel)panel.innerHTML=rollPanelContent();
  }

  function rollForCharacter(data) {
    const character=rollCharacter();if(!character)return;
    try{
      const test=data.attributeId?sheetAttributeTest(row.state,character,data.attributeId,rollingBase):data.skillId?sheetSkillTest(row.state,character,data.skillId,rollingBase):null;
      const saved=data.rollId?character.rollButtons?.find(roll=>roll.id===data.rollId):null;
      const formula=test?.formula||(saved?sheetSavedRollFormula(character,saved):data.formula)||'';
      const preview=tableRollPreview(formula,row.state,character,rollView());
      if(preview.error){report(preview.error);return;}
      return perform('roll',{...data,characterId:character.id,actor:character.name,
        ...(test&&!character.dnd?{testDice:rollingBase}:{}),
        ...(preview.mastery?{masteryId:preview.mastery.id}:{}),
        ...(preview.d20&&rollingMode!=='normal'?{mode:rollingMode}:{})});
    }catch(error){report(error.message);}
  }

  function routeControls(token){
    if(!row.master||token.characterId&&!row.state.characters?.some(c=>c.id===token.characterId&&c.characterType==='npc'))return '';
    const control=(key,title,disabled=false)=>'<button type="button" class="btn small" data-patrol="'+key+'" '+(disabled?'disabled':'')+'>'+title+'</button>';
    if(routeDraft?.id===token.id){
      const {points,mode,speed}=routeDraft;
      return '<div class="vtt-route-controls"><strong>Rota · '+points.length+' pontos</strong><small>Toque no mapa para marcar cada parada.</small><label>Percurso <select data-route-mode><option value="return">Ida e volta</option><option value="loop" '+(mode==='loop'?'selected':'')+'>Circuito fechado</option></select></label><label>Ritmo <select data-route-speed>'+[[.5,'Passeio'],[1,'Caminhada'],[2,'Rápido']].map(([n,label])=>'<option value="'+n+'" '+(n===speed?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+control('undo','Desfazer ponto',points.length<2)+control('start','Iniciar rota',points.length<2)+control('cancel','Cancelar')+'</div>';
    }
    return '<div class="vtt-route-controls">'+control('draw',token.patrol?'Redesenhar rota':'Traçar rota')+(token.patrol?control(token.patrol.started?'pause':'resume',token.patrol.started?'Pausar rota':'Retomar rota')+control('clear','Remover rota'):'')+'</div>';
  }
  function paintRoute(){
    const preview=root?.querySelector('.vtt-preview');
    if(!preview)return;
    if(routeDraft){
      const half=routeDraft.size/2,points=routeDraft.points.map(p=>[p.x+half,p.y+half]);
      preview.innerHTML='<polyline points="'+points.join(' ')+'" fill="none" stroke="#76e3c3" stroke-width="3" stroke-dasharray="6 3" vector-effect="non-scaling-stroke"/>'+points.map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r=".14" fill="#76e3c3"/>').join('');
    }else preview.replaceChildren();
    root.querySelector('[data-table-selection]').innerHTML=selectedMarkup();
  }
  function selectedMarkup() {
    const token=(row.state.tokens||[]).find(token=>token.id===selected);
    if (!token) return '<p class="vtt-selection-empty">Selecione um token no mapa ou na lista.</p>';
    if(token.kind==='item')return '<div class="vtt-selection"><div><strong>'+escape(token.name)+'</strong><small>Item no chão · '+escape(token.loot?.quantity||1)+' unidade(s)'+(token.hidden?' · Só o mestre':'')+'</small></div><div class="actions">'+button(row.master?'Ver item e entregar':'Coletar item','lootOpen',token.id)+(row.master?'<button type="button" class="btn small" data-table-action="tokenVisibility">'+(token.hidden?'Revelar para jogadores':'Ocultar item')+'</button>'+button('Remover da mesa','tokenDelete',token.id):'')+'</div></div>';
    const movable=row.master||(!token.locked&&!token.hidden&&token.canMove!==false);
    const movePad=movable?'<div class="vtt-move-pad" role="group" aria-label="Mover token selecionado">'+
      [['up','↑','cima'],['left','←','esquerda'],['down','↓','baixo'],['right','→','direita']].map(([direction,symbol,label])=>
        '<button type="button" class="btn" data-table-move="'+direction+'" aria-label="Mover '+escape(token.name)+' para '+label+'">'+symbol+'</button>'
      ).join('')+'</div>':'';
    return '<div class="vtt-selection"><div><strong>'+escape(token.name)+'</strong>'+(row.master&&token.realName?'<small>Nome verdadeiro · '+escape(token.realName)+'</small>':'')+'<small>'+escape((row.master?(token.hidden?'Oculto dos jogadores · ':'Compartilhado com a mesa · '):'')+(conditionSummary(token)||'Sem condições'))+'</small></div><div class="actions">'+
      (row.master&&row.state.characters?.some(c=>c.id===token.characterId&&c.party)?button('Identidade entre grupos','characterParty',token.characterId):'')+
      (row.state.characters?.some(character=>character.id===token.characterId&&character.access!=='summary')?'<button type="button" class="btn small" data-table-character="'+escape(token.characterId)+'">Abrir ficha</button>':'')+
      (row.master?'<button type="button" class="btn small" data-table-action="tokenVisibility" aria-pressed="'+Boolean(token.hidden)+'">'+(token.hidden?'Mostrar aos jogadores':'Ocultar dos jogadores')+'</button>'+button('Condições','tableConditions',token.id)+button('Editar token','tableTokenEdit',token.id)+(row.state.characters?.some(character=>character.id===token.characterId&&character.claimed&&!character.hidden)?button('Mensagem privada','tableTokenMessage',token.id):''):'')+'</div>'+routeControls(token)+movePad+(movable?'<div class="vtt-rotation-controls" role="group" aria-label="Direção do token"><button type="button" class="btn small" data-table-action="rotateLeft" aria-label="Girar 15 graus à esquerda">Q ↶</button><span>Direção <output data-facing-value>'+Math.round(normalizeRotation(token.rotation))+'°</output></span><button type="button" class="btn small" data-table-action="rotateRight" aria-label="Girar 15 graus à direita">E ↷</button><small>Q/E para girar · Ao arrastar, use a roda</small></div>':'')+(row.master&&table.darkness.enabled?'<button type="button" class="btn small" data-table-action="visionPreview" aria-pressed="'+playerPreview+'">'+(playerPreview?'Voltar à visão do mestre':table.darkness.mode==='group'?'Prévia da visão compartilhada':'Ver pela visão deste token')+'</button>':'')+'</div>';
  }

  function drawingOptions() {
    if (!row.master) return '';
    return '<div class="vtt-light-options" '+(tool==='lights'?'':'hidden')+'><label><input data-light-enabled type="checkbox" '+(table.darkness.enabled?'checked':'')+'> Escuridão ativa</label><label>Escuridão ambiente <output data-light-level-output>'+table.darkness.level+'%</output><input data-light-level type="range" min="0" max="100" value="'+table.darkness.level+'"></label><label>Emissores <select data-light-mode><option value="draw">Colocar ou ajustar</option><option value="delete" '+(lightMode==='delete'?'selected':'')+'>Apagar</option></select></label><label>Formato <select data-light-angle>'+[[0,'Atual (nova luz circular)'],[360,'Circular'],[35,'Facho estreito · 35°'],[90,'Cone amplo · 90°'],[180,'Meia-luz · 180°']].map(([n,label])=>'<option value="'+n+'" '+(n===lightAngle?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>Visibilidade <select data-light-scope>'+[['','Manter atual (nova luz global)'],['global','Global · além do alcance de visão'],['local','Local · dentro do campo de visão']].map(([value,label])=>'<option value="'+value+'" '+(value===lightScope?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>Cor <input data-light-color type="color" value="'+lightColor+'"></label></div>'+
      '<div class="vtt-wall-options" '+(tool==='walls'?'':'hidden')+'><label>Tipo de barreira <select data-wall-mode>'+[['wall','Desenhar parede'],['door','Desenhar porta fechada'],['window','Desenhar janela'],['toggle','Abrir ou fechar porta'],['delete','Excluir segmento']].map(([value,label])=>'<option value="'+value+'" '+(wallMode===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label><small>Janelas bloqueiam tokens e deixam passar visão e luz.</small></div>'+
      '<div class="vtt-drawing-options" '+(tool==='draw'?'':'hidden')+'><label>Traço<select data-table-shape><option value="freehand" '+(shape==='freehand'?'selected':'')+'>Desenho livre</option><option value="line" '+(shape==='line'?'selected':'')+'>Linha</option><option value="rectangle" '+(shape==='rectangle'?'selected':'')+'>Retângulo</option><option value="circle" '+(shape==='circle'?'selected':'')+'>Elipse</option></select></label><label>Cor<input type="color" value="'+drawingColor+'" data-table-color></label><button type="button" class="btn small danger" data-table-action="drawingUndo">Desfazer último</button><button type="button" class="btn small danger" data-table-action="tableDrawingClear">Limpar desenhos</button></div>'+
      '<div class="vtt-fog-options" '+(tool==='fog'?'':'hidden')+'><label>Formato<select data-fog-shape><option value="brush" '+(fogShape==='brush'?'selected':'')+'>Pincel livre</option><option value="rectangle" '+(fogShape==='rectangle'?'selected':'')+'>Retângulo na grade</option></select></label><label data-fog-brush-options '+(fogShape==='brush'?'':'hidden')+'>Diâmetro do pincel <output data-fog-brush-size>'+fogBrushPixels+' px</output><input type="range" data-fog-brush min="10" max="300" step="5" value="'+fogBrushPixels+'"></label><label>No toque<select data-table-fog><option value="reveal" '+(fogOperation==='reveal'?'selected':'')+'>Revelar</option><option value="hide" '+(fogOperation==='hide'?'selected':'')+'>Ocultar</option></select></label><button type="button" class="btn small" data-table-action="fogToggle">'+(table.fog.enabled?'Desativar névoa':'Ativar névoa')+'</button><button type="button" class="btn small danger" data-table-action="fogReset">Cobrir tudo</button><button type="button" class="btn small" data-table-action="fogRevealAll">Revelar tudo</button><button type="button" class="btn small" data-table-action="fogUndo" '+(table.fog.history.length?'':'disabled')+'>Desfazer névoa</button><button type="button" class="btn small" data-table-action="fogPreview" aria-pressed="'+playerPreview+'">'+(playerPreview?'Voltar à visão do mestre':'Prévia dos jogadores')+'</button><label>Opacidade para o mestre<input type="range" min="20" max="90" value="'+Math.round(fogOpacity*100)+'" data-fog-opacity></label><p class="vtt-fog-legend"><span>Verde revela</span><span>Laranja oculta</span> · Mouse: esquerdo revela, direito oculta · Esc cancela</p></div>';
  }

  function render(nextRow) {
    if (campaign!==nextRow.id) {
      rollingCharacter='';rollingMastery='';rollFormula='1d20';rollRevision=-1;historyMarkup='';
      campaign=nextRow.id;seenPings.clear();seenLoot.clear();clearRemoteMoves();resetRollCharacter();selected='';zoom=1;offset={x:0,y:0};tool='select';measurement=null;playerPreview=false;migratedMap=null;mapDimensions=null;
      for (const pending of portraitURLs.values()) pending.then(url=>URL.revokeObjectURL(url)).catch(()=>{});
      portraitURLs.clear();
      for (const cached of portraitURLs.values()) cached.then(url=>URL.revokeObjectURL(url)).catch(()=>{});
      portraitURLs.clear();
    }
    if (sceneMap!==(nextRow.state.sceneId||'')+'/'+(nextRow.state.map?.id||'')) {sceneMap=(nextRow.state.sceneId||'')+'/'+(nextRow.state.map?.id||'');zoom=1;offset={x:0,y:0};measurement=null;playerPreview=false;}
    row=nextRow;sampleClock=clock();
    table=normalizeTable(row.state);
    rollRevision=Math.max(rollRevision,row.rev||0);historyMarkup=renderRollHistory(row);
    if (!row.master && ['draw','fog'].includes(tool)) tool='select';
    if (!(row.state.tokens||[]).some(token=>token.id===selected)) selected='';
    return '<section class="vtt"><div class="vtt-heading"><div><p class="vtt-eyebrow" data-table-campaign-name>'+escape(row.state.name)+'</p><h1>Mesa virtual</h1><p class="subtitle" data-table-scene-name>'+escape([row.state.sessionName,row.state.scene].filter(Boolean).join(' · ')||'Cena atual')+'</p></div><div class="actions">'+'<button type="button" class="btn small" data-table-focus-rolls>'+icon('dice')+'Dados da ficha</button>'+(row.master?button('Ambiente','tableAtmosphere','','darkness')+button('Enviar mapa','upload','map','image')+button('Novo token','tableTokenAdd','','plus')+button('Colocar item','lootPlace','','plus'):'')+'</div></div>'+
      '<div class="vtt-layout"><div class="vtt-scene-column"><section class="vtt-stage"><div class="vtt-toolbar" role="toolbar" aria-label="Ferramentas da mesa"><div class="vtt-tools">'+
      toolButton('select','Selecionar')+toolButton('pan','Mover visão')+toolButton('measure','Medir')+toolButton('ping','Apontar')+(row.master?toolButton('draw','Desenhar')+toolButton('fog','Névoa')+toolButton('walls','Paredes, portas e janelas')+toolButton('lights','Iluminação')+toolButton('region','Região interativa')+toolButton('clue','Colocar pista')+toolButton('sound','Colocar som'):'')+'</div>'+
      '<div class="vtt-view-controls"><span class="vtt-connection" data-table-connection role="status" aria-live="polite">Conectando…</span><button class="vtt-tool" type="button" data-table-zoom="out" aria-label="Diminuir zoom" title="Diminuir zoom">'+icon('zoomOut')+'</button><span data-table-zoom-label>'+Math.round(zoom*100)+'%</span><button class="vtt-tool" type="button" data-table-zoom="in" aria-label="Aumentar zoom" title="Aumentar zoom">'+icon('zoomIn')+'</button><button class="vtt-tool" type="button" data-table-zoom="fit" aria-label="Ajustar mapa à tela" title="Ajustar mapa à tela">'+icon('fit')+'</button>'+(row.master?'<button class="vtt-tool" type="button" data-table-action="darknessToggle" aria-pressed="'+table.darkness.enabled+'" title="'+(table.darkness.enabled?'Desativar escuridão':'Ativar escuridão')+'" aria-label="'+(table.darkness.enabled?'Desativar escuridão':'Ativar escuridão')+'">'+icon('darkness')+'</button>':'')+(row.master?'<button type="button" class="vtt-tool vtt-vision-sharing" data-table-action="visionShare" aria-pressed="'+(table.darkness.mode==='group')+'" title="Compartilhar visão entre jogadores">'+icon('sharedVision')+'<span data-vision-share-label>'+(table.darkness.mode==='teams'?'Visão: por grupos':table.darkness.mode==='group'?'Visão: compartilhada':'Visão: individual')+'</span></button><button type="button" class="vtt-tool vtt-cones-control" data-table-action="visionCones" aria-pressed="'+showCones+'" title="Mostrar cones de todos os tokens, só para o mestre" '+(!table.darkness.enabled||playerPreview?'disabled':'')+'>'+icon('cones')+'<span>Cones</span></button>':'')+(row.master?'<button class="vtt-tool" type="button" data-act="tableSettings" aria-label="Configurar grade" title="Configurar grade">'+icon('settings')+'</button>':'')+'</div></div><div class="vtt-measure-options" '+(tool==='measure'?'':'hidden')+'><label>Régua <select data-measure-mode><option value="direct">Linha direta</option><option value="path" '+(measureMode==='path'?'selected':'')+'>Percurso por pontos</option></select></label><button type="button" class="btn small" data-table-action="measureUndo" '+(measureMode==='path'?'':'hidden')+'>Desfazer ponto</button><button type="button" class="btn small" data-table-action="measureClear">Limpar medida</button></div><div class="vtt-ping-options" '+(tool==='ping'?'':'hidden')+'><label>Sinal no mapa <select data-ping-signal>'+Object.entries(pingNames).map(([key,label])=>'<option value="'+key+'" '+(key===pingSignal?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+drawingOptions()+
      '<div class="vtt-viewport" tabindex="0" role="region" aria-label="Mapa interativo. Use as ferramentas para medir, apontar e movimentar tokens.">'+sceneMarkup()+
      (!row.state.map?'<p class="vtt-map-hint">'+(row.master?'Envie um mapa ou use a grade para começar.':'A cena está pronta para os tokens.')+'</p>':'')+'</div>'+
      '<div class="vtt-statusbar"><span data-table-help role="status" aria-live="polite">'+help()+'</span><span>'+table.grid.columns+' × '+table.grid.rows+' células · '+table.grid.size+' '+escape(table.grid.unit)+' / célula'+(table.fog.enabled?' · Névoa ativa':'')+'</span></div><p class="vtt-vision-hint" data-vision-hint '+(table.darkness.enabled?'':'hidden')+'>'+(row.master?'Escuridão ativa · selecione um token para inspecionar seu campo de visão.':'Escuridão ativa · sua visão acompanha seus tokens. Use os controles de direção após selecionar seu token.')+'</p><div data-table-selection>'+selectedMarkup()+'</div></section><section class="vtt-roll-feed" data-table-roll-history aria-label="Histórico de rolagens">'+historyMarkup+'</section></div>'+
      '<aside class="vtt-inspector">'+rollPanelMarkup()+'<div data-point-list>'+pointsList()+'</div><section class="vtt-side-section"><div class="vtt-side-heading"><h2>Tokens</h2><span class="vtt-count" data-table-token-count>'+ (row.state.tokens||[]).length+'</span></div>'+'<div data-table-token-list>'+tokenList()+'</div></section>'+combatMarkup()+'</aside></div></section>';
  }

  function help() {
    return ({clue:'Toque no mapa para vincular uma anotação',sound:'Toque no mapa para colocar um emissor de som',lights:lightMode==='delete'?'Toque no centro da luz para removê-la':'Toque para colocar uma luz ou arraste para apontar e definir o alcance · Comece no centro de uma luz para ajustá-la',region:'Arraste para delimitar o gatilho de entrada',effect:'Arraste da origem para mirar e definir o alcance · Solte para confirmar',walls:['wall','door','window'].includes(wallMode)?'Arraste de uma ponta à outra · Pontas próximas se conectam · Esc cancela':wallMode==='toggle'?'Toque na porta para abrir ou fechar':'Toque no segmento que deseja excluir',select:'Arraste tokens · Dois dedos movem e ampliam · Setas movem a seleção',pan:'Arraste o mapa para mudar a visão',measure:measureMode==='path'?'Toque no mapa para marcar cada ponto do percurso':'Arraste entre dois pontos para medir',ping:'Clique no mapa para apontar para o grupo',draw:shape==='freehand'?'Desenhe livremente · Esc cancela':'Arraste para desenhar uma forma',fog:(fogShape==='brush'?'Pincel livre · ':'Retângulo na grade · ')+'Mouse: esquerdo revela · direito oculta · No toque, escolha a operação · Esc cancela'})[tool]+' · Botão do meio: mover câmera';
  }

  function updateTransform() {
    if (!world || !viewport) return;
    baseWidth=Math.max(1,Math.min(viewport.clientWidth-24,(viewport.clientHeight-24)*table.grid.columns/table.grid.rows));
    origin={x:(viewport.clientWidth-baseWidth)/2,y:(viewport.clientHeight-baseWidth*table.grid.rows/table.grid.columns)/2};
    world.style.width=baseWidth+'px';
    world.style.left=origin.x+'px';
    world.style.top=origin.y+'px';
    world.style.transform='translate('+offset.x+'px,'+offset.y+'px) scale('+zoom+')';
    world.style.setProperty('--vtt-label-scale',String(1/zoom));
    updateTokenScale();
    const label=root?.querySelector('[data-table-zoom-label]');
    if (label) label.textContent=Math.round(zoom*100)+'%';
  }

  function updateTokenScale(){
    if(!root||!table)return;
    const sizes=new Map((row.state.tokens||[]).map(token=>[token.id,Number(token.size)||1]));
    for(const node of root.querySelectorAll('[data-table-token]')){
      const diameter=baseWidth*(sizes.get(node.dataset.tableToken)||1)/table.grid.columns;
      node.style.setProperty('--token-font-size',String(diameter*.46)+'px');
      node.style.setProperty('--token-border-width',String(Math.min(2,diameter*.04))+'px');
      node.style.setProperty('--token-outline-offset',String(Math.min(3,diameter*.06))+'px');
    }
  }

  function point(event, snapped=false) {
    const bounds=world.getBoundingClientRect();
    const x=clamp((event.clientX-bounds.left)/bounds.width*table.grid.columns,0,table.grid.columns);
    const y=clamp((event.clientY-bounds.top)/bounds.height*table.grid.rows,0,table.grid.rows);
    return snapped?{x:Math.floor(x),y:Math.floor(y)}:{x,y};
  }

  function setSelection(id,focus=false) {
    if(routeDraft&&routeDraft.id!==id){routeDraft=null;root.querySelector('.vtt-preview').replaceChildren();}
    selected=id;
    const linked=row.state.tokens.find(token=>token.id===id)?.characterId;
    if(rollCharacters().some(c=>c.id===linked)&&rollingCharacter!==linked) {rollingCharacter=linked;rollingMastery='';rollFormula=rollCharacter()?.preset==='herdeiros-destino'?'2d6':'1d20';}
    updateRollPanel();
    root.querySelectorAll('[data-table-token]').forEach(node=>node.classList.toggle('is-selected',node.dataset.tableToken===id));
    root.querySelectorAll('[data-table-select]').forEach(node=>node.classList.toggle('selected',node.dataset.tableSelect===id));
    root.querySelector('[data-table-selection]').innerHTML=selectedMarkup();queueVision();
    if (focus) [...root.querySelectorAll('[data-table-token]')].find(node=>node.dataset.tableToken===id)?.focus({preventScroll:true});
  }

  function restoreToken(id) {
    const token=row.state.tokens.find(token=>token.id===id);
    const node=[...(root?.querySelectorAll('[data-table-token]')||[])].find(node=>node.dataset.tableToken===id);
    if (!token || !node) return;
    node.style.left=token.x/table.grid.columns*100+'%';
    node.style.top=token.y/table.grid.rows*100+'%';queueVision();
  }

  async function perform(name,data={}) {
    if (busy) {
      if (name==='tokenMove') restoreToken(data.id);
      return;
    }
    busy=true;
    try {
      await action(name,{...data,...(row.state.sceneId?{sceneId:row.state.sceneId}:{})});
      if(name==='roll') {if(data.masteryId)rollingMastery='';updateRollPanel();}
    } catch (error) {
      if (name==='tokenMove') restoreToken(data.id);
      report(error.message);
    } finally {busy=false;}
  }

  function switchTool(next) {
    if(gesture)cancelPointer();
    if(routeDraft){routeDraft=null;root.querySelector('[data-table-selection]').innerHTML=selectedMarkup();}
    tool=next;
    measurement=null;
    root.querySelector('.vtt-preview').replaceChildren();
    root.querySelectorAll('[data-table-tool]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.tableTool===tool)));
    const ruler=root.querySelector('.vtt-measure-options');if(ruler)ruler.hidden=tool!=='measure';
    const pingOptions=root.querySelector('.vtt-ping-options');if(pingOptions)pingOptions.hidden=tool!=='ping';
    const lightOptions=root.querySelector('.vtt-light-options');
    if(lightOptions)lightOptions.hidden=tool!=='lights';
    const wallOptions=root.querySelector('.vtt-wall-options');
    if(wallOptions)wallOptions.hidden=tool!=='walls';
    const drawingOptions=root.querySelector('.vtt-drawing-options');
    const fogOptions=root.querySelector('.vtt-fog-options');
    if (drawingOptions) drawingOptions.hidden=tool!=='draw';
    if (fogOptions) fogOptions.hidden=tool!=='fog';
    root.querySelector('[data-table-help]').textContent=help();
    viewport.dataset.tool=tool;
  }

  function changeZoom(next,anchor) {
    const bounds=viewport.getBoundingClientRect();
    const x=(anchor?.x??bounds.width/2)-origin.x;
    const y=(anchor?.y??bounds.height/2)-origin.y;
    const limited=clamp(next,.4,4);
    const ratio=limited/zoom;
    offset={x:x-(x-offset.x)*ratio,y:y-(y-offset.y)*ratio};
    zoom=limited;
    updateTransform();
  }

  function paintMeasurement(points){
    const preview=root.querySelector('.vtt-preview'),status=root.querySelector('[data-table-help]');
    if(!points?.length){preview.replaceChildren();status.textContent=help();return;}
    let distance=0;
    const lines=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
      const cells=table.grid.distance==='chebyshev'?Math.max(dx,dy):table.grid.distance==='manhattan'?dx+dy:Math.hypot(dx,dy);
      distance+=cells*table.grid.size;
      lines.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#f0d89a" stroke-width="0.06"/>');
    }
    preview.innerHTML=lines.join('')+points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="0.12" fill="#f0d89a"/>').join('');
    const text=distance.toLocaleString('pt-BR',{maximumFractionDigits:2})+' '+table.grid.unit;
    const rule={chebyshev:'diagonais iguais',manhattan:'sem diagonais'}[table.grid.distance]||'linha reta';
    status.textContent=points.length===1?'Origem marcada · toque no próximo ponto':text+' · '+rule+(measureMode==='path'?' · '+lines.length+(lines.length===1?' trecho':' trechos'):'');
  }

  function updatePreview(end) {
    const preview=root.querySelector('.vtt-preview');
    if (!gesture) return;
    const start=gesture.start;
    if(gesture.kind==='lights'&&lightMode==='draw'){
      preview.innerHTML=lightShape(lampAt(gesture,end))+' fill="'+lightColor+'" fill-opacity=".24" stroke="'+lightColor+'" stroke-width="2" vector-effect="non-scaling-stroke"/>';
    }else if(gesture.kind==='walls'&&['wall','door','window'].includes(wallMode)){
      const tip=wallPoint(end);
      preview.innerHTML=wallLine({kind:wallMode,...start,toX:tip.x,toY:tip.y});
    }else if (gesture.kind==='measure') {
      paintMeasurement(measureMode==='path'?[...(measurement||[]),end]:[start,end]);
    } else if (gesture.kind==='fog') {
      const operation=gesture.operation||fogOperation;
      const color=operation==='reveal'?'#9ce4cd':'#ffbd87';
      if(gesture.fogShape==='brush'){
        preview.innerHTML='<g opacity=".32">'+fogStrokeShape({kind:'brush',points:gesture.points,radius:gesture.radius},color)+'</g><circle cx="'+end.x+'" cy="'+end.y+'" r="'+gesture.radius+'" fill="none" stroke="'+color+'" stroke-width="2" vector-effect="non-scaling-stroke"/>';
        root.querySelector('[data-table-help]').textContent=(operation==='reveal'?'Revelar':'Ocultar')+' com pincel livre · Solte para aplicar · Esc cancela';
      }else{
        const rect=fogRect(start,end);
        preview.innerHTML='<rect x="'+rect.x+'" y="'+rect.y+'" width="'+rect.width+'" height="'+rect.height+'" fill="'+color+'" fill-opacity=".24" stroke="'+color+'" stroke-width="2" stroke-dasharray="6 3" vector-effect="non-scaling-stroke"/>';
        root.querySelector('[data-table-help]').textContent=(operation==='reveal'?'Revelar':'Ocultar')+' '+rect.width+' × '+rect.height+' células · Solte para aplicar · Esc cancela';
      }
    } else if(gesture.kind==='region'||gesture.kind==='effect'){
      const dx=end.x-start.x,dy=end.y-start.y,r=Math.hypot(dx,dy);
      preview.innerHTML=drawingShape({...start,toX:end.x,toY:end.y,kind:gesture.kind==='region'?'rectangle':effect,color:'#8ad5dc'});
      if(gesture.kind==='effect'){
        const hits=visualTokens().filter(t=>{
          if(!tokenShown(t)||!row.master&&(t.hidden||table.fog.mode!=='war'&&!pointRevealed(table.fog,{x:t.x+(t.size||1)/2,y:t.y+(t.size||1)/2})))return false;
          const x=t.x+(t.size||1)/2-start.x,y=t.y+(t.size||1)/2-start.y,d=Math.hypot(x,y),along=(x*dx+y*dy)/(r||1);
          if(effect==='beam')return along>=0&&along<=r&&Math.abs(x*dy-y*dx)<=(r||1)/2;
          return d<=r&&(effect==='burst'||along>=d*Math.cos(Math.PI/6));
        });
        root.querySelector('[data-table-help]').textContent=effectName+' · '+(r*table.grid.size).toFixed(1)+' '+table.grid.unit+' · '+(hits.map(t=>t.name).join(', ')||'Nenhum alvo visível');
      }
    } else if (gesture.kind==='draw') {
      preview.innerHTML=drawingShape({kind:gesture.shape,x:start.x,y:start.y,toX:end.x,toY:end.y,color:gesture.color,points:gesture.points});
    }
  }

  function fogRect(start,end) {
    const x=clamp(Math.floor(Math.min(start.x,end.x)),0,table.grid.columns-1);
    const y=clamp(Math.floor(Math.min(start.y,end.y)),0,table.grid.rows-1);
    return {x,y,width:clamp(Math.ceil(Math.max(start.x,end.x))-x,1,table.grid.columns-x),height:clamp(Math.ceil(Math.max(start.y,end.y))-y,1,table.grid.rows-y)};
  }

  function resetGesture(keepPoints=false) {
    if(!keepPoints)syncPoints();
    queueVision();
    gesture=null;
    if(viewport)delete viewport.dataset.panning;
    root?.querySelector('.vtt-preview')?.replaceChildren();
    const label=root?.querySelector('[data-table-help]');
    if (label) label.textContent=help();
  }

  function touchPair() {
    return [...touches.values()].slice(0,2);
  }

  function touchCenter(first,second) {
    return {x:(first.x+second.x)/2,y:(first.y+second.y)/2};
  }

  function beginPinch(event) {
    if (gesture?.kind==='token') {sendTokenPreview(gesture,'cancel');restoreToken(gesture.item.id);}
    resetGesture();
    if(measureMode!=='path')measurement=null;
    else if(tool==='measure')paintMeasurement(measurement);
    const [first,second]=touchPair();
    gesture={kind:'pinch',distance:Math.max(1,Math.hypot(first.x-second.x,first.y-second.y)),
      center:touchCenter(first,second),zoom,offset:{...offset}};
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function movePinch() {
    const [first,second]=touchPair();
    if (!first||!second) return;
    const center=touchCenter(first,second);
    const distance=Math.hypot(first.x-second.x,first.y-second.y);
    zoom=clamp(gesture.zoom*distance/gesture.distance,.4,4);
    const ratio=zoom/gesture.zoom;
    const bounds=viewport.getBoundingClientRect();
    offset={
      x:center.x-bounds.left-origin.x-(gesture.center.x-bounds.left-origin.x-gesture.offset.x)*ratio,
      y:center.y-bounds.top-origin.y-(gesture.center.y-bounds.top-origin.y-gesture.offset.y)*ratio
    };
    updateTransform();
  }

  function pointerDown(event) {
    if(event.button===1){
      event.preventDefault();
      if(gesture)return;
      viewport.focus({preventScroll:true});
      gesture={kind:'pan',client:{x:event.clientX,y:event.clientY},offset:{...offset},pointer:event.pointerId};
      viewport.dataset.panning='true';
      viewport.setPointerCapture(event.pointerId);
      return;
    }
    if ((event.button!==0&&!(event.button===2&&tool==='fog'&&row.master)) || busy || event.target.closest('.vtt-map-hint')) return;
    if(gesture&&event.pointerType!=='touch')return;
    if (event.pointerType==='touch') {
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if (touches.size>=2) {beginPinch(event);return;}
    }
    viewport.focus({preventScroll:true});
    const token=event.target.closest('[data-table-token]');
    const start=point(event);
    if(event.target.closest('[data-act="exploreOpen"]'))return;
    if(row.master&&['clue','sound'].includes(tool)){placePoint(tool,start,row.state.sceneId);return;}
    if(routeDraft&&row.master&&row.state.tokens.some(t=>t.id===routeDraft.id)){
      if(routeDraft.points.length>=48){report('Use até 48 pontos.');return;}
      const size=routeDraft.size;
      routeDraft.points.push({x:clamp(start.x-size/2,0,table.grid.columns-size),y:clamp(start.y-size/2,0,table.grid.rows-size)});
      paintRoute();event.preventDefault();return;
    }
    root.querySelector('.vtt-preview').replaceChildren();
    if(tool!=='measure'||measureMode!=='path')measurement=null;
    else paintMeasurement(measurement);
    if (token && tool==='select') {
      const item=row.state.tokens.find(item=>item.id===token.dataset.tableToken);
      setSelection(item.id,true);
      if (!row.master && (item.locked||item.hidden||item.canMove===false||item.kind==='item')) return;
      clearTimeout(remoteMoves.get(item.id)?.timer);remoteMoves.delete(item.id);token.classList.toggle('is-remote-moving',false);
      gesture={kind:'token',start,token,item,moved:false,pointer:event.pointerId,dragId:globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+(++dragSequence),seq:0};
    } else if (tool==='pan' || (tool==='select' && !token)) {
      gesture={kind:'pan',client:{x:event.clientX,y:event.clientY},offset:{...offset},pointer:event.pointerId};
    } else if (tool==='ping') {
      perform('tablePing',{...start,signal:pingSignal});
      return;
    } else {
      gesture={kind:tool,start:tool==='walls'?wallPoint(start):start,pointer:event.pointerId,shape,color:drawingColor,points:tool==='fog'&&fogShape==='brush'||tool==='draw'&&shape==='freehand'?[{x:Number(start.x.toFixed(4)),y:Number(start.y.toFixed(4))}]:undefined,fogShape,radius:brushRadius(),operation:event.pointerType==='touch'?fogOperation:event.button===2?'hide':'reveal'};
      if(tool==='lights'){gesture.light=pickLight(start);if(gesture.light)gesture.start={x:gesture.light.x,y:gesture.light.y};}
      if(tool==='fog'||tool==='lights')updatePreview(start);
    }
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function pointerMove(event) {
    if (touches.has(event.pointerId)) touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (gesture?.kind==='pinch') {movePinch();return;}
    if(!gesture){if(tool==='fog'&&fogShape==='brush'&&row.master){const p=point(event);root.querySelector('.vtt-preview').innerHTML='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+brushRadius()+'" fill="#b9a0d51a" stroke="#e4d6f5" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';}return;}
    if(gesture.pointer!==event.pointerId)return;
    if (gesture.kind==='pan') {
      offset={x:gesture.offset.x+event.clientX-gesture.client.x,y:gesture.offset.y+event.clientY-gesture.client.y};
      updateTransform();
      return;
    }
    let end=point(event);
    if(gesture.kind==='effect'&&effectLength){
      const dx=end.x-gesture.start.x,dy=end.y-gesture.start.y,d=Math.hypot(dx,dy);
      if(d){const scale=effectLength/(table.grid.size*d);end={x:clamp(gesture.start.x+dx*scale,0,table.grid.columns),y:clamp(gesture.start.y+dy*scale,0,table.grid.rows)};}
    }
    gesture.end=end;
    if (gesture.kind==='token') {
      const size=Number(gesture.item.size)||1;
      let x=clamp(gesture.item.x+end.x-gesture.start.x,0,table.grid.columns-size);
      let y=clamp(gesture.item.y+end.y-gesture.start.y,0,table.grid.rows-size);
      const previous=gesture.previewPosition||gesture.item;
      const path=gesture.path??=[];
      const next=slideToken(previous,{x,y},size,table);
      if(table.walls.length){
        const direct=slideToken(path.at(-1)||gesture.item,next,size,table);
        if(Math.hypot(direct.x-next.x,direct.y-next.y)>1e-6){
          if(path.length>=64)return;
          path.push({x:previous.x,y:previous.y});
        }
      }
      x=next.x;y=next.y;
      gesture.previewPosition=next;
      if(table.fog.enabled&&table.fog.mode==='war'){
        const trail=gesture.trail??=[];
        const last=trail.at(-1)||gesture.item;
        if(Math.hypot(x-last.x,y-last.y)>=.5){
          if(trail.length===64)gesture.trail=trail.filter((_,index)=>index%2===0);
          gesture.trail.push({x,y,rotation:displayedRotation(gesture.item)});
        }
      }
      gesture.position=table.grid.snap?slideToken(next,{x:Math.round(x),y:Math.round(y)},size,table):next;
      gesture.moved=Math.abs(end.x-gesture.start.x)+Math.abs(end.y-gesture.start.y)>.03;
      gesture.token.style.left=x/table.grid.columns*100+'%';
      gesture.token.style.top=y/table.grid.rows*100+'%';queueVision();
      if(gesture.moved)sendTokenPreview(gesture,'move');
      else if(!row.master){syncPoints();explorationChanged();}
    } else {
      if(gesture.kind==='draw'&&gesture.shape==='freehand'||gesture.kind==='fog'&&gesture.fogShape==='brush')addFreehandPoint(gesture,end);
      updatePreview(end);
    }
  }

  function pointerUp(event) {
    touches.delete(event.pointerId);
    if (gesture?.kind==='pinch') {
      const remaining=[...touches.entries()][0];
      gesture=remaining ? {kind:'pan',pointer:remaining[0],client:remaining[1],offset:{...offset}} : null;
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      return;
    }
    if (!gesture || gesture.pointer!==event.pointerId) return;
    const active=gesture;
    const end=active.kind==='fog'&&active.fogShape==='brush'?point(event):active.end||point(event);
    if(active.kind==='measure'){
      if(measureMode==='path'){
        measurement??=[];
        const last=measurement.at(-1);
        if(!last||Math.hypot(last.x-end.x,last.y-end.y)>.01)measurement.push(end);
      }else measurement=[active.start,end];
      paintMeasurement(measurement);gesture=null;
    }else{
      resetGesture(active.kind==='token'&&active.moved);
      if(active.kind==='pan'&&tool==='measure')paintMeasurement(measurement);
    }
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (active.kind==='token' && active.moved) {
      focusAfterMove=active.item.id;
      active.token.style.left=active.position.x/table.grid.columns*100+'%';active.token.style.top=active.position.y/table.grid.rows*100+'%';
      sendTokenPreview(active,'end');
      localPlacement={id:active.item.id,position:active.position,path:active.path,dragId:active.dragId};queueVision();
      perform('tokenMove',{id:active.item.id,...(table.walls.length?active.previewPosition:active.position),dragId:active.dragId,...(active.path?.length?{path:active.path}:{}),...(active.trail?.length?{trail:active.trail}:{})}).finally(()=>{focusAfterMove='';localPlacement=null;syncPoints();queueVision();});
    }
    if(active.kind==='lights'&&row.master){
      if(lightMode==='delete'){if(active.light)perform('tableLightDelete',{id:active.light.id});}
      else perform('tableLightSet',{...lampAt(active,point(event)),id:active.light?.id,color:lightColor});
    }
    if(active.kind==='walls' &&row.master){
      if(['wall','door','window'].includes(wallMode)){
        const tip=wallPoint(point(event));
        if(Math.hypot(tip.x-active.start.x,tip.y-active.start.y)>.02)perform('tableWallAdd',{kind:wallMode,...active.start,toX:tip.x,toY:tip.y});
      }else{
        const hit=wallPick(point(event));
        if(hit)perform(wallMode==='delete'?'tableWallDelete':'tableDoorSet',{id:hit.wall.id,open:!hit.wall.open});
      }
    }
    if(active.kind==='region'){
      const w=Math.abs(end.x-active.start.x),h=Math.abs(end.y-active.start.y);
      if(w>.05&&h>.05)placePoint('region',{x:(active.start.x+end.x)/2,y:(active.start.y+end.y)/2,w,h},row.state.sceneId);
    }
    if(active.kind==='effect'&&Math.hypot(end.x-active.start.x,end.y-active.start.y)>.05){
      perform('tableEffect',{kind:effect,...active.start,toX:end.x,toY:end.y,color:'#8ad5dc'});switchTool('select');
    }
    if(active.kind==='draw'){
      if(active.shape==='freehand'){addFreehandPoint(active,end);if(active.points.length>1)perform('tableDrawingAdd',{kind:'freehand',points:active.points,color:active.color});}
      else if(Math.hypot(end.x-active.start.x,end.y-active.start.y)>.03)perform('tableDrawingAdd',{kind:active.shape,x:active.start.x,y:active.start.y,toX:end.x,toY:end.y,color:active.color});
    }
    if (active.kind==='fog' && row.master) {
      if(active.fogShape==='brush'){addFreehandPoint(active,end);perform('tableFog',{operation:active.operation,enabled:true,kind:'brush',radius:active.radius,points:active.points});}
      else perform('tableFog',{operation:active.operation,enabled:true,...fogRect(active.start,end)});
    }
  }

  function cancelPointer(event) {
    touches.clear();
    if (!gesture) return;
    if (gesture.kind==='token') {
      sendTokenPreview(gesture,'cancel');
      gesture.token.style.left=gesture.item.x/table.grid.columns*100+'%';
      gesture.token.style.top=gesture.item.y/table.grid.rows*100+'%';
    }
    resetGesture();
  }

  function moveTokenBy(id,direction) {
    if (busy) return;
    const item=row.state.tokens.find(item=>item.id===id);
    if (!item || (!row.master && (item.locked||item.hidden||item.canMove===false))) return;
    const step=table.grid.snap?1:.25;
    const size=Number(item.size)||1;
    focusAfterMove=item.id;
    perform('tokenMove',{id:item.id,
      x:clamp(item.x+direction[0]*step,0,table.grid.columns-size),
      y:clamp(item.y+direction[1]*step,0,table.grid.rows-size)
    }).finally(()=>{focusAfterMove='';});
  }

  function keyDown(event) {
    const token=event.target.closest('[data-table-token]');
    const item=row.state.tokens.find(t=>t.id===token?.dataset.tableToken);if(item?.kind==='item'&&['Enter',' '].includes(event.key)&&tokenShown(item)){event.preventDefault();openLoot(item.id);return;}
    if(!event.target.matches?.('input,textarea,select')&&['q','e'].includes(event.key?.toLowerCase())){event.preventDefault();const id=token?.dataset.tableToken||selected,item=row.state.tokens.find(t=>t.id===id);if(item)rotateToken(id,rotationTarget(id)+(event.key.toLowerCase()==='q'?-15:15));return;}
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if (token && direction) {
      event.preventDefault();
      moveTokenBy(token.dataset.tableToken,direction);
    }
    if (event.key==='Escape') {cancelPointer();switchTool('select');}
  }

  function mountEvents(signal) {
    root.addEventListener('click',async event=>{
      if(event.target.closest('[data-table-focus-rolls]')) {
        const panel=root.querySelector('[data-table-rolls]');
        panel?.scrollIntoView?.({block:'nearest'});panel?.focus({preventScroll:true});
      }
      const spell=event.target.closest('[data-table-dnd-cast]');
      if(spell&&rollCharacter()?.dnd)perform('dndCast',{id:rollCharacter().id,entryId:spell.dataset.tableDndCast,mode:rollingMode});
      const roll=event.target.closest('[data-table-sheet-roll]');
      if(roll)rollForCharacter({rollId:roll.dataset.tableSheetRoll});
      const tab=event.target.closest('[data-table-roll-tab]');
      if(tab&&Object.hasOwn(tableRollTabs,tab.dataset.tableRollTab)){rollingTab=tab.dataset.tableRollTab;rollingQuery='';updateRollPanel();root.querySelector('[data-table-roll-tab="'+rollingTab+'"]').focus();}
      const attribute=event.target.closest('[data-table-roll-attribute]');
      if(attribute)rollForCharacter({attributeId:attribute.dataset.tableRollAttribute});
      const insert=event.target.closest('[data-table-insert-field]');
      if(insert){
        const field=sheetFields(row.state,rollCharacter()).find(field=>field.id===insert.dataset.tableInsertField&&['number','counter'].includes(field.type));
        if(field){
          const next=rollFormula+(rollFormula.trim()&&!/[+-]\s*$/.test(rollFormula)?'+':'')+'@{'+field.id+(rollCharacter().dnd&&/^dd-(str|dex|con|int|wis|cha)$/.test(field.id)?'|mod':'')+'}';
          if(next.length>rollFormulaLimit){report('A expressão atingiu o limite de caracteres.');return;}
          rollFormula=next;const input=root.querySelector('[data-table-roll-formula]');input.value=rollFormula;input.focus();
          root.querySelector('[data-table-roll-preview]').innerHTML=renderFreeRollPreview(row,rollCharacter(),rollView());
        }
      }
      const skill=event.target.closest('[data-table-skill-roll]');
      if(skill)rollForCharacter({skillId:skill.dataset.tableSkillRoll});
      const resource=event.target.closest('[data-table-roll-resource]');
      if(resource&&rollCharacter()) perform('sheetCounter',{id:rollCharacter().id,field:resource.dataset.tableRollResource,step:Number(resource.dataset.step)});
      const toolNode=event.target.closest('[data-table-tool]');
      if (toolNode) switchTool(toolNode.dataset.tableTool);
      const selection=event.target.closest('[data-table-select]');
      if (selection) setSelection(selection.dataset.tableSelect,true);
      const character=event.target.closest('[data-table-character]');
      if (character) openCharacter(character.dataset.tableCharacter);
      const zoomButton=event.target.closest('[data-table-zoom]');
      if (zoomButton) {
        if (zoomButton.dataset.tableZoom==='fit') {zoom=1;offset={x:0,y:0};updateTransform();}
        else changeZoom(zoom*(zoomButton.dataset.tableZoom==='in'?1.25:.8));
      }
      const patrol=event.target.closest('[data-patrol]')?.dataset.patrol;
      if(patrol&&row.master){
        const token=row.state.tokens.find(t=>t.id===selected);if(!token)return;
        if(patrol==='draw'){
          switchTool('select');routeDraft={id:selected,size:token.size||1,points:[{x:token.x,y:token.y}],speed:token.patrol?.speed||1,mode:token.patrol?.mode||'return'};
        }else if(patrol==='undo')routeDraft?.points.pop();
        else if(patrol==='cancel')routeDraft=null;
        else if(patrol==='start'&&routeDraft){
          const draft=routeDraft;
          if(busy)return;
          busy=true;
          try{await action('tokenPatrol',{id:selected,operation:'start',points:draft.points,speed:draft.speed,mode:draft.mode,sceneId:row.state.sceneId});if(routeDraft===draft)routeDraft=null;}
          catch(error){report(error.message);}finally{busy=false;}
        }else perform('tokenPatrol',{id:selected,operation:patrol});
        paintRoute();return;
      }
      const movement=event.target.closest('[data-table-move]')?.dataset.tableMove;
      if (movement) moveTokenBy(selected,{up:[0,-1],left:[-1,0],down:[0,1],right:[1,0]}[movement]);
      const command=event.target.closest('[data-table-action]')?.dataset.tableAction;
      if(command==='measureUndo'||command==='measureClear'){
        if(command==='measureClear')measurement=null;else measurement?.pop();
        paintMeasurement(measurement);
      }
      else if(command==='visionShare'&&row.master)perform('tableSettings',{darkness:{mode:table.darkness.mode==='individual'?(Object.keys(table.darkness.teams||{}).length?'teams':'group'):'individual'}});
      else if(command==='visionCones'&&row.master&&table.darkness.enabled&&!playerPreview){showCones=!showCones;queueVision();}
      else if(command==='darknessToggle'&&row.master)perform('tableSettings',{darkness:{enabled:!table.darkness.enabled}});
      else if(command==='rotateLeft'||command==='rotateRight'){const token=row.state.tokens.find(t=>t.id===selected);if(token)rotateToken(token.id,rotationTarget(token.id)+(command==='rotateLeft'?-15:15));}
      else if(command==='visionPreview'&&row.master){playerPreview=!playerPreview;world.classList.toggle('is-player-preview',playerPreview);const fogPreview=root.querySelector('[data-table-action="fogPreview"]');if(fogPreview){fogPreview.setAttribute('aria-pressed',String(playerPreview));fogPreview.textContent=playerPreview?'Voltar à visão do mestre':'Prévia dos jogadores';}queueVision();root.querySelector('[data-table-selection]').innerHTML=selectedMarkup();}
      else if(command==='tokenVisibility'){if(row.master){const token=row.state.tokens.find(item=>item.id===selected);if(token)perform('tokenUpdate',{id:token.id,hidden:!token.hidden});}}
      else if (command==='drawingUndo') {
        const last=table.drawings.at(-1);
        if (last) perform('tableDrawingDelete',{id:last.id});
      } else if (command==='fogToggle') perform('tableFog',{enabled:!table.fog.enabled});
      else if (command==='fogPreview'&&row.master) {
        playerPreview=!playerPreview;world.classList.toggle('is-player-preview',playerPreview);
        const button=event.target.closest('[data-table-action]');
        button.setAttribute('aria-pressed',String(playerPreview));
        button.textContent=playerPreview?'Voltar à visão do mestre':'Prévia dos jogadores';
        root.querySelector('[data-table-selection]').innerHTML=selectedMarkup();
        root.querySelector('[data-table-help]').textContent=playerPreview?'Prévia do mapa para jogadores · As fichas e ferramentas continuam na visão do mestre':help();queueVision();
      }
      else if (command==='fogUndo') perform('tableFog',{operation:'undo'});
      else if (command==='fogRevealAll') perform('tableFog',{operation:'reveal',enabled:true,x:0,y:0,width:table.grid.columns,height:table.grid.rows});
      else if (command==='fogReset') perform('tableFog',{operation:'reset',enabled:true});
      else if(command==='combatEndOwn'){
        const {entry,round}=event.target.closest('[data-table-action]').dataset;
        perform(command,{entryId:entry,round:Number(round)});
      }
      else if (command==='combatPrevious') perform('combatNext',{direction:-1});
      else if (command) perform(command);
    },{signal});
    root.addEventListener('submit',event=>{
      if(!event.target.matches('[data-table-roll-form]'))return;
      event.preventDefault();rollForCharacter({formula:rollFormula});
    },{signal});
    root.addEventListener('input',event=>{
      if(event.target.matches('[data-light-level]'))root.querySelector('[data-light-level-output]').textContent=event.target.value+'%';
      if(event.target.matches('[data-fog-brush]')&&row.master){fogBrushPixels=clamp(Number(event.target.value)||160,10,300);root.querySelector('[data-fog-brush-size]').textContent=fogBrushPixels+' px';}
      if(event.target.matches('[data-table-roll-formula]')){rollFormula=event.target.value;root.querySelector('[data-table-roll-preview]').innerHTML=renderFreeRollPreview(row,rollCharacter(),rollView());}
      if(event.target.matches('[data-table-roll-search]')){rollingQuery=event.target.value;updateRollContent();}
      if (event.target.matches('[data-fog-opacity]')&&row.master) {
        fogOpacity=clamp(Number(event.target.value)/100,.2,.9);
        world.style.setProperty('--vtt-fog-opacity',fogOpacity);
      }
    },{signal});
    root.addEventListener('change',event=>{
      if(event.target.matches('[data-light-scope]'))lightScope=event.target.value;
      if(event.target.matches('[data-light-angle]'))lightAngle=Number(event.target.value);
      if(event.target.matches('[data-light-color]'))lightColor=event.target.value;
      if(event.target.matches('[data-measure-mode]')){
        measureMode=event.target.value==='path'?'path':'direct';measurement=null;
        root.querySelector('[data-table-action="measureUndo"]').hidden=measureMode!=='path';
        paintMeasurement(measurement);
      }
      if(event.target.matches('[data-ping-signal]'))pingSignal=event.target.value;
      if(routeDraft&&event.target.matches('[data-route-mode]'))routeDraft.mode=event.target.value;
      if(routeDraft&&event.target.matches('[data-route-speed]'))routeDraft.speed=Number(event.target.value);
      if(event.target.matches('[data-light-enabled]'))perform('tableSettings',{darkness:{enabled:event.target.checked}});
      if(event.target.matches('[data-light-level]'))perform('tableSettings',{darkness:{level:Number(event.target.value)}});
      if(event.target.matches('[data-light-mode]')){lightMode=event.target.value;root.querySelector('[data-table-help]').textContent=help();}
      if(event.target.matches('[data-wall-mode]')&&row.master){cancelPointer();wallMode=event.target.value;root.querySelector('[data-table-help]').textContent=help();}
      if(event.target.matches('[data-fog-shape]')&&row.master){cancelPointer();fogShape=event.target.value==='rectangle'?'rectangle':'brush';root.querySelector('[data-fog-brush-options]').hidden=fogShape!=='brush';root.querySelector('[data-table-help]').textContent=help();}
      if(event.target.matches('[data-table-roll-mode]')){rollingMode=['normal','advantage','disadvantage'].includes(event.target.value)?event.target.value:'normal';updateRollContent();}
      if(event.target.matches('[data-table-roll-character]')) {
        const character=rollCharacters().find(c=>c.id===event.target.value);if(character){resetRollCharacter(character);updateRollPanel();}
      }
      if(event.target.matches('[data-table-roll-mastery]')){rollingMastery=event.target.value;updateRollContent();}
      if(event.target.matches('[data-table-test-base]')){rollingBase=event.target.value;updateRollContent();}
      if (event.target.matches('[data-table-shape]')) {shape=event.target.value;root.querySelector('[data-table-help]').textContent=help();}
      if (event.target.matches('[data-table-color]')) drawingColor=event.target.value;
      if (event.target.matches('[data-table-fog]')) {fogOperation=event.target.value;root.querySelector('[data-table-help]').textContent=help();}
    },{signal});
    viewport.addEventListener('pointerdown',pointerDown,{signal});
    for(const type of ['mousedown','auxclick'])viewport.addEventListener(type,event=>{if(event.button===1)event.preventDefault();},{signal});
    viewport.addEventListener('pointermove',pointerMove,{signal});
    viewport.addEventListener('pointerleave',()=>{if(!gesture&&tool==='fog')root.querySelector('.vtt-preview').replaceChildren();},{signal});
    viewport.addEventListener('pointerup',pointerUp,{signal});
    viewport.addEventListener('pointercancel',cancelPointer,{signal});
    viewport.addEventListener('lostpointercapture',event=>{if(gesture?.pointer===event.pointerId)cancelPointer();},{signal});
    viewport.addEventListener('contextmenu',event=>{if(tool==='fog'&&row.master)event.preventDefault();},{signal});
    viewport.addEventListener('dblclick',event=>{const node=event.target.closest('[data-table-token]'),token=row.state.tokens.find(t=>t.id===node?.dataset.tableToken);if(tool==='select'&&token?.kind==='item'&&tokenShown(token)){event.preventDefault();openLoot(token.id);}},{signal});
    viewport.addEventListener('keydown',keyDown,{signal});
    viewport.addEventListener('wheel',event=>{
      event.preventDefault();
      if(gesture?.kind==='token'){
        if(event.deltaY)rotateToken(gesture.item.id,rotationTarget(gesture.item.id)+Math.sign(event.deltaY)*(event.ctrlKey?1:15));
        return;
      }
      const bounds=viewport.getBoundingClientRect();
      changeZoom(zoom*(event.deltaY<0?1.1:1/1.1),{x:event.clientX-bounds.left,y:event.clientY-bounds.top});
    },{signal,passive:false});
  }

  async function loadMap() {
    if (!row.state.map) {
      root.querySelector('.vtt-map').style.backgroundImage='none';
      return;
    }
    const key=row.id+'/'+row.state.map.id;
    if (key!==loadedMap) {
      if (mapTask?.key!==key) {
        mapTask={key,promise:requestAsset(row.state.map.id).then(response=>response.blob())};
      }
      const task=mapTask;
      const blob=await task.promise;
      if (mapTask!==task || row.id+'/'+row.state.map?.id!==key) return;
      if (loadedMap!==key) {
        if (mapURL) URL.revokeObjectURL(mapURL);
        mapURL=URL.createObjectURL(blob);
        loadedMap=key;
      }
    }
    const layer=root?.querySelector('.vtt-map');
    if (!layer) return;
    layer.style.setProperty('background-image','url("'+mapURL+'")');
    let dimensions=row.state.map;
    if (!dimensions.width||!dimensions.height) {
      if (mapDimensions?.key!==key) {
        const image=new Image();
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Não foi possível ler as dimensões do mapa.'));image.src=mapURL;});
        if (row.id+'/'+row.state.map?.id!==key) return;
        mapDimensions={key,width:image.naturalWidth,height:image.naturalHeight};
      }
      dimensions=mapDimensions;
    }
    const pixels=mapPixelsPerCell(row.state.map.width?table.grid:{...table.grid,mode:'manual'},dimensions);
    root?.querySelector('.vtt-map')?.style.setProperty('background-size',dimensions.width/(pixels*table.grid.columns)*100+'% '+dimensions.height/(pixels*table.grid.rows)*100+'%');
    if (row.master&&!busy&&!row.state.map.width&&migratedMap!==key) {
      migratedMap=key;
      await perform('tableSettings',{mapDimensions:{id:row.state.map.id,width:dimensions.width,height:dimensions.height}});
    }
  }

  async function loadPortraits() {
    for(const image of root.querySelectorAll('[data-loot-portrait]')){const token=image.closest('[data-table-token]');const show=()=>{if(root?.contains(image)){image.hidden=false;token?.classList.toggle('has-portrait',true);}};image.onload=show;image.onerror=()=>{image.hidden=true;token?.classList.toggle('has-portrait',false);};if(image.complete&&image.naturalWidth>0)show();}
    for (const node of root.querySelectorAll('[data-table-token-image]')) {
      const id=node.dataset.tableTokenImage;
      const key=row.id+'/'+id;
      let cached=portraitURLs.get(key);
      if (!cached) {
        cached=requestAsset(id).then(response=>response.blob()).then(blob=>URL.createObjectURL(blob));
        portraitURLs.set(key,cached);
      }
      try {
        const url=await cached;
        if (root?.contains(node)&&node.dataset.tableTokenImage===id) {
          const token=node.closest('[data-table-token]');
          const show=()=>{if(root?.contains(node)&&node.dataset.tableTokenImage===id){node.hidden=false;token?.classList.toggle('has-portrait',true);}};
          node.onload=show;
          node.onerror=()=>{if(node.dataset.tableTokenImage===id){node.hidden=true;token?.classList.toggle('has-portrait',false);}};
          if(node.src!==url)node.src=url;
          if(node.complete&&node.naturalWidth>0)show();
        }
      } catch {portraitURLs.delete(key);}
    }
  }

  function addFreehandPoint(active,point) {
    const last=active.points.at(-1);
    if(last&&Math.hypot(last.x-point.x,last.y-point.y)<.025)return;
    // Keep the whole gesture when the point budget is reached, including its tail.
    if(active.points.length>=600)active.points=active.points.filter((_,index)=>index%2===0);
    active.points.push({x:Number(point.x.toFixed(4)),y:Number(point.y.toFixed(4))});
  }

  function sendTokenPreview(active,phase) {
    const position=phase==='move'?active.previewPosition:phase==='end'?(table.walls.length?active.previewPosition:active.position):active.item;
    if(!position)return;
    if(!row.master&&phase!=='cancel')explorationChanged();
    try{const task=realtime({type:'tokenPreview',id:active.item.id,x:position.x,y:position.y,...(active.path?.length?{path:[...active.path]}:{}),...(Number.isFinite(active.rotation)?{rotation:active.rotation}:{}),dragId:active.dragId,seq:++active.seq,phase});task?.catch?.(()=>{});}catch{}
  }

  function clearRemoteMoves() {
    for(const move of remoteMoves.values())clearTimeout(move.timer);
    remoteMoves.clear();
  }

  function resetRealtime(){
    cancelPointer();clearRemoteMoves();
    for(const token of row?.state.tokens||[])restoreToken(token.id);
    for(const node of root?.querySelectorAll('[data-table-token]')||[])node.classList.toggle('is-remote-moving',false);
  }

  function receiveRealtime(event) {
    if(!root||!row||event?.type!=='tokenPreview')return;
    const item=row.state.tokens.find(token=>token.id===event.id);
    const node=[...root.querySelectorAll('[data-table-token]')].find(node=>node.dataset.tableToken===event.id);
    if(!item||!node||rotationPreview?.id===event.id||['token','rotate'].includes(gesture?.kind)&&gesture.item.id===event.id)return;
    if(!['move','end','cancel'].includes(event.phase))return;
    if(event.phase!=='cancel'&&(!Number.isFinite(event.x)||!Number.isFinite(event.y)||event.rotation!==undefined&&!Number.isFinite(event.rotation)))return;
    const old=remoteMoves.get(event.id),at=Number(event.at)||0,seq=Number(event.seq)||0,from=remotePosition(item),receivedAt=clock();
    if(old&&(old.dragId===event.dragId&&seq<=old.seq||at&&old.at&&at<old.at))return;
    clearTimeout(old?.timer);
    const smooth=event.phase!=='cancel'&&typeof globalThis.requestAnimationFrame==='function'&&!reducedVisionMotion();
    const move={receivedAt,from:{x:from.x,y:from.y},duration:smooth?clamp(old?receivedAt-old.receivedAt:60,40,100):0,dragId:event.dragId,seq,at,active:event.phase==='move'||event.phase==='end',...(Number.isFinite(event.rotation)?{rotation:normalizeRotation(event.rotation)}:{})};
    if(Number.isFinite(move.rotation))animateRotation(item.id,move.rotation);else if(event.phase==='cancel'&&Number.isFinite(old?.rotation))animateRotation(item.id,item.rotation);
    remoteMoves.set(event.id,move);
    node.classList.toggle('is-remote-moving',event.phase!=='cancel');
    if(event.phase==='cancel')restoreToken(event.id);
    else if(!smooth&&Number.isFinite(event.x)&&Number.isFinite(event.y)){
      const size=Number(item.size)||1;
      node.style.left=clamp(event.x,0,table.grid.columns-size)/table.grid.columns*100+'%';
      node.style.top=clamp(event.y,0,table.grid.rows-size)/table.grid.rows*100+'%';
    }
    move.position={x:clamp(event.x,0,table.grid.columns-(Number(item.size)||1)),y:clamp(event.y,0,table.grid.rows-(Number(item.size)||1))};if(move.position.x===move.from.x&&move.position.y===move.from.y)move.duration=0;
    if(move.duration&&table.walls.length){
      const reachable=slideToken(move.from,move.position,Number(item.size)||1,table);
      if(Math.hypot(reachable.x-move.position.x,reachable.y-move.position.y)>1e-6)move.duration=0;
    }
    queueVision();
    if(!row.master&&item.characterId===row.characterId)explorationChanged();
    move.timer=setTimeout(()=>{move.active=false;node.classList.toggle('is-remote-moving',false);if(!(gesture?.kind==='token'&&gesture.item.id===event.id))restoreToken(event.id);},event.phase==='move'?1800:500);
  }

  function syncScene(next) {
    if(!root||!row||next.id!==row.id||!next.state)return false;
    if(next.rev<row.rev||!Array.isArray(next.state.tokens))return true;
    const nextTable=normalizeTable(next.state);
    if(next.state.sceneId!==row.state.sceneId||next.state.map?.id!==row.state.map?.id||nextTable.grid.columns!==table.grid.columns||nextTable.grid.rows!==table.grid.rows||nextTable.grid.mode!==table.grid.mode||nextTable.grid.cellPixels!==table.grid.cellPixels||next.state.map?.width!==row.state.map?.width||next.state.map?.height!==row.state.map?.height){cancelPointer();return false;}
    const oldRotations=new Map((row.state.tokens||[]).map(t=>[t.id,t.rotation||0]));
    const wasMyTurn=myCombatTurn();
    const oldTable=table,oldPositions=new Map((row.state.tokens||[]).map(item=>[item.id,{x:item.x,y:item.y}]));
    row=next;sampleClock=clock();table=nextTable;
    const currentTokens=row.state.tokens||[];
    if(rotationPreview&&!mayRotate(currentTokens.find(t=>t.id===rotationPreview.id))){rotationAnimations.delete(rotationPreview.id);rotationPreview=null;pendingRotation=null;}
    for(const token of currentTokens)if(oldRotations.has(token.id)&&oldRotations.get(token.id)!==(token.rotation||0)&&rotationPreview?.id!==token.id)animateRotation(token.id,token.rotation);
    if(gesture?.kind==='token'){
      const fresh=currentTokens.find(item=>item.id===gesture.item.id);
      if(!fresh||JSON.stringify(oldTable.walls)!==JSON.stringify(table.walls)||!row.master&&(fresh.locked||fresh.hidden||fresh.canMove===false))cancelPointer();
    }
    const layer=root.querySelector('.vtt-token-layer');
    for(const node of root.querySelectorAll('[data-table-token]')){
      const item=currentTokens.find(item=>item.id===node.dataset.tableToken);
      if(!item){const stale=remoteMoves.get(node.dataset.tableToken);clearTimeout(stale?.timer);remoteMoves.delete(node.dataset.tableToken);node.remove?.();continue;}
      const oldPosition=oldPositions.get(item.id),remote=remoteMoves.get(item.id);
      if(remote&&oldPosition&&(oldPosition.x!==item.x||oldPosition.y!==item.y)){clearTimeout(remote.timer);remote.active=false;remote.timer=setTimeout(()=>node.classList.toggle('is-remote-moving',false),100);}
      if(!(gesture?.kind==='token'&&gesture.item.id===item.id)&&!remoteMoves.get(item.id)?.active)restoreToken(item.id);
      node.classList.toggle('is-active-turn',activeCombatant()?.tokenId===item.id);node.classList.toggle('is-hidden',item.hidden===true);node.classList.toggle('is-locked',item.locked===true);
      const size=Number(item.size)||1;node.style.width=size/table.grid.columns*100+'%';node.style.height=size/table.grid.rows*100+'%';
      for(const color of colors)node.classList.toggle(color,(item.color||'violet')===color);
      const letter=node.querySelector?.('.vtt-token-letter');if(letter){const symbol=tokenIconSvg(item.icon);if(symbol)letter.innerHTML=symbol;else letter.textContent=item.name?.[0]?.toUpperCase()||'✦';}
      const statusMarkup=conditionBadges(item),status=node.querySelector?.('.vtt-token-status');
      if(status)status.innerHTML=statusMarkup;else if(statusMarkup)node.insertAdjacentHTML?.('beforeend','<span class="vtt-token-status">'+statusMarkup+'</span>');
      const portrait=tokenPortrait(item),image=node.querySelector?.('[data-table-token-image]');
      if(portrait){if(image&&image.dataset.tableTokenImage!==portrait){image.dataset.tableTokenImage=portrait;image.hidden=true;node.classList.toggle('has-portrait',false);}else if(!image)node.querySelector?.('.vtt-token-face')?.insertAdjacentHTML?.('beforeend','<img alt="" hidden data-table-token-image="'+escape(portrait)+'">');}else{image?.remove?.();if(!node.querySelector?.('[data-loot-portrait]'))node.classList.toggle('has-portrait',false);}
      node.setAttribute('aria-label',[item.name,conditionSummary(item)].filter(Boolean).join(' · ')+(item.locked?' · Bloqueado':'')+(item.hidden?' · Oculto':''));node.setAttribute('title',item.name);
      const label=node.querySelector?.('.vtt-token-label');if(label)label.textContent=item.name;
    }
    const existing=new Set([...root.querySelectorAll('[data-table-token]')].map(node=>node.dataset.tableToken));
    for(const item of currentTokens)if(!existing.has(item.id))layer?.insertAdjacentHTML?.('beforeend',tokenMarkup(item));
    const grid=root.querySelector('.vtt-grid');grid?.classList.toggle('is-off',!table.grid.visible);
    if(row.master){
      const layer=root.querySelector('.vtt-light-markers');
      if(layer&&JSON.stringify(oldTable.lights)!==JSON.stringify(table.lights))layer.innerHTML=lightMarkers();
      const checkbox=root.querySelector('[data-light-enabled]'),level=root.querySelector('[data-light-level]'),output=root.querySelector('[data-light-level-output]');
      if(checkbox)checkbox.checked=table.darkness.enabled;
      if(level&&oldTable.darkness.level!==table.darkness.level){level.value=String(table.darkness.level);if(output)output.textContent=level.value+'%';}
    }
    if(JSON.stringify(oldTable.atmosphere)!==JSON.stringify(table.atmosphere)){const layer=root.querySelector('.vtt-atmosphere');if(layer)layer.outerHTML=renderAtmosphere(table.atmosphere);}
    if(row.master&&JSON.stringify(oldTable.walls)!==JSON.stringify(table.walls)){const layer=root.querySelector('.vtt-walls');if(layer)layer.innerHTML=table.walls.map(wallLine).join('');}
    if(JSON.stringify(oldTable.drawings)!==JSON.stringify(table.drawings))root.querySelector('.vtt-drawings').innerHTML=table.drawings.map(item=>drawingShape(item)).join('');
    if(JSON.stringify(oldTable.fog)!==JSON.stringify(table.fog)){
      const fog=root.querySelector('.vtt-fog');
      if(fog&&table.fog.enabled)fog.outerHTML=fogMarkup();
      else if(fog)fog.remove?.();
      else if(table.fog.enabled)world.insertAdjacentHTML?.('beforeend',fogMarkup());
    }
    const list=root.querySelector('[data-table-token-list]');if(list){const markup=tokenList();if(list.innerHTML!==markup)list.innerHTML=markup;}
    const combat=root.querySelector('[data-table-combat]');if(combat&&(wasMyTurn!==myCombatTurn()||JSON.stringify(oldTable.combat)!==JSON.stringify(table.combat)))combat.outerHTML=combatMarkup();
    if(!currentTokens.some(token=>token.id===selected))selected='';
    if(!(gesture?.kind==='token')&&!root.querySelector('[data-table-selection]')?.contains?.(globalThis.document?.activeElement)){const selection=root.querySelector('[data-table-selection]');if(selection)selection.innerHTML=selectedMarkup();}
    const darknessToggle=root.querySelector('[data-table-action="darknessToggle"]');if(darknessToggle){darknessToggle.setAttribute('aria-pressed',String(table.darkness.enabled));darknessToggle.setAttribute('title',table.darkness.enabled?'Desativar escuridão':'Ativar escuridão');darknessToggle.setAttribute('aria-label',table.darkness.enabled?'Desativar escuridão':'Ativar escuridão');}
    const fogToggle=root.querySelector('[data-table-action="fogToggle"]');if(fogToggle)fogToggle.textContent=table.fog.enabled?'Desativar névoa':'Ativar névoa';
    const fogUndo=root.querySelector('[data-table-action="fogUndo"]');if(fogUndo)fogUndo.disabled=!table.fog.history.length;
    if(JSON.stringify(oldTable.exploration)!==JSON.stringify(table.exploration)||oldTable.grid.columns!==table.grid.columns||oldTable.grid.rows!==table.grid.rows){
      const markers=root.querySelector('.vtt-points'),points=root.querySelector('[data-point-list]');
      if(markers)markers.innerHTML=pointMarkers();if(points)points.innerHTML=pointsList();
    }
    const count=root.querySelector('[data-table-token-count]');if(count)count.textContent=String(currentTokens.length);
    const name=root.querySelector('[data-table-campaign-name]');if(name)name.textContent=row.state.name;
    const scene=root.querySelector('[data-table-scene-name]');if(scene)scene.textContent=[row.state.sessionName,row.state.scene].filter(Boolean).join(' · ')||'Cena atual';
    const rollPanel=root.querySelector('[data-table-rolls]'),active=globalThis.document?.activeElement;
    if(characterSignature!==JSON.stringify(row.state.characters||[])&&!(rollPanel?.contains?.(active)&&active?.matches?.('input,textarea,select')))updateRollPanel();
    if(measurement&&tool==='measure')paintMeasurement(measurement);
    queueVision();updateTokenScale();paintPings();paintLoot();loadPortraits();syncRolls(next);
    return true;
  }

  function setConnectionStatus(status) {
    connectionStatus=status;
    const node=root?.querySelector('[data-table-connection]');if(!node)return;
    const label={live:'Ao vivo',connecting:'Conectando…',reconnecting:'Reconectando…',polling:'Conexão alternativa',offline:'Sem conexão'}[status]||'Conectando…';
    node.dataset.state=status;node.textContent=label;
  }

  function paintPings() {
    const layer=root?.querySelector('.vtt-pings');
    if (!layer) return;
    const now=row.serverTime||Date.now(),lifetime=1500;
    for(const ping of table.pings){
      if(seenPings.has(ping.id))continue;
      seenPings.add(ping.id);if(seenPings.size>150)seenPings.delete(seenPings.values().next().value);
      const age=Math.max(0,now-ping.at);if(age>=lifetime)continue;
      const markup='<span class="vtt-ping" data-signal="'+(ping.signal||'point')+'" data-ping-id="'+escape(ping.id)+'" style="left:'+ping.x/table.grid.columns*100+'%;top:'+ping.y/table.grid.rows*100+'%;--ping-age:-'+age+'ms"><span class="vtt-ping-ring"></span><span class="vtt-ping-dot"></span><span class="vtt-ping-name">'+(ping.signal&&ping.signal!=='point'?pingNames[ping.signal]+' · ':'')+escape(ping.name||'Participante')+'</span></span>';
      if(layer.insertAdjacentHTML)layer.insertAdjacentHTML('beforeend',markup);else layer.innerHTML+=markup;
      const timer=setTimeout(()=>{pingTimers.delete(timer);const node=[...(layer.querySelectorAll?.('[data-ping-id]')||[])].find(node=>node.dataset.pingId===ping.id);if(node)node.remove();else if(!layer.insertAdjacentHTML)layer.replaceChildren();},lifetime-age);
      pingTimers.add(timer);
    }
  }

  function paintLoot(){
    const layer=root?.querySelector('.vtt-loot-effects');if(!layer)return;
    for(const event of table.lootEvents||[]){
      if(seenLoot.has(event.id))continue;seenLoot.add(event.id);if(seenLoot.size>150)seenLoot.delete(seenLoot.values().next().value);
      if(Date.now()-event.at>1600||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)continue;
      const width=Number.parseFloat(world.style.width)||world.clientWidth||800,height=width*table.grid.rows/table.grid.columns,markup=lootEffect(event,table.grid,width,height);
      if(layer.insertAdjacentHTML)layer.insertAdjacentHTML('beforeend',markup);else layer.innerHTML+=markup;
      const timer=setTimeout(()=>{pingTimers.delete(timer);const node=[...(layer.querySelectorAll?.('[data-loot-effect]')||[])].find(node=>node.dataset.lootEffect===event.id);if(node)node.remove();else if(!layer.insertAdjacentHTML)layer.replaceChildren();},800);pingTimers.add(timer);
    }
  }

  function mount(nextRoot,nextRow) {
    if(gesture)cancelPointer();
    events?.abort();
    resize?.disconnect();
    root=nextRoot;row=nextRow;sampleClock=clock();table=normalizeTable(row.state);
    viewport=root.querySelector('.vtt-viewport');
    world=root.querySelector('.vtt-world');
    if (!viewport || !world) return;
    events=new AbortController();
    mountEvents(events.signal);
    viewport.dataset.tool=tool;
    updateTransform();
    if (focusAfterMove) {
      [...root.querySelectorAll('[data-table-token]')].find(node=>node.dataset.tableToken===focusAfterMove)?.focus({preventScroll:true});
      focusAfterMove='';
    }
    if (typeof ResizeObserver!=='undefined') {
      resize=new ResizeObserver(()=>updateTransform());
      resize.observe(viewport);
    }
    if (measurement && tool==='measure') paintMeasurement(measurement);
    paintPings();paintLoot();queueVision();
    setConnectionStatus(connectionStatus);
    loadPortraits();
    const ready=loadMap().catch(error=>{mapTask=null;report(error.message||'Não foi possível carregar o mapa.');});
    const previous=previousViewport;previousViewport=null;
    if(previous&&previous.campaign===row.id&&previous.key!==row.state.sceneId+'/'+row.state.map?.id&&viewport.animate&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
      const curtain=document.createElement('div');
      curtain.className='map-fade-curtain';curtain.inert=true;curtain.setAttribute('aria-hidden','true');
      const old=previous.node;old.classList.add('map-fade-old');curtain.append(old);viewport.append(curtain);
      const fade=old.animate([{opacity:1},{opacity:0}],{duration:240,fill:'forwards'});
      Promise.allSettled([fade.finished,ready]).then(()=>{
        old.remove();return curtain.animate([{opacity:1},{opacity:0}],{duration:320,fill:'forwards'}).finished;
      }).catch(()=>{}).finally(()=>curtain.remove());
    }
  }

  function syncRolls(next) {
    if(!root||!row||next.id!==row.id||!Array.isArray(next.state?.rolls)||next.rev<rollRevision)return;
    rollRevision=next.rev;row.state.rolls=next.state.rolls;
    const html=renderRollHistory(row);
    if(html===historyMarkup)return;
    historyMarkup=html;
    const feed=root.querySelector('[data-table-roll-history]');
    if(feed) {
      const oldList=feed.querySelector?.('.roll-feed-list'),oldTop=oldList?.scrollTop||0,oldHeight=oldList?.scrollHeight||0;
      const expanded=new Set([...feed.querySelectorAll('details[open]')].map(item=>item.closest('[data-roll-id]')?.dataset.rollId));
      feed.innerHTML=html;
      for(const item of feed.querySelectorAll('[data-roll-id]'))if(expanded.has(item.dataset.rollId)){const detail=item.querySelector('details');if(detail)detail.open=true;}
      const list=feed.querySelector?.('.roll-feed-list');if(list&&oldTop>0)list.scrollTop=Math.max(0,oldTop+list.scrollHeight-oldHeight);
    }
  }

  function dispose() {
    if(viewport&&row)previousViewport={node:viewport,campaign:row.id,key:row.state.sceneId+'/'+row.state.map?.id};
    movingPoints=null;
    routeDraft=null;
    if(gesture?.kind==='token')sendTokenPreview(gesture,'cancel');
    visionGeneration++;if(visionFrame!==null)globalThis.cancelAnimationFrame?.(visionFrame);visionFrame=null;visionPending=false;pendingRotation=null;rotationAnimations.clear();drawnRotations.clear();
    events?.abort();resize?.disconnect();for(const timer of pingTimers)clearTimeout(timer);pingTimers.clear();clearRemoteMoves();gesture=null;touches.clear();rotationPreview=null;localPlacement=null;root=null;viewport=null;world=null;
  }

  return {aim(kind,name,length=0){effect=kind;effectName=name;effectLength=length;switchTool('effect');},explorationMotion,syncPoints,render,mount,syncRolls,syncScene,receiveRealtime,resetRealtime,setConnectionStatus,isInteracting:()=>Boolean(gesture)||busy||rotationSending,dispose};
}
