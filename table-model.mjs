import {publicItemToken} from './loot-data.mjs';
import {visionSources,tokenInVision,recordExploration,normalizeVision,normalizeDarkness,normalizeRotation} from './vision-model.mjs';
export {normalizeVision,normalizeDarkness,normalizeRotation} from './vision-model.mjs';
import {tokenIconIds} from './token-icons.mjs';
import {normalizeFogStrokes} from './fog-geometry.mjs';
import {outsideParty,playerVisionSource,tokenCharacterId,isPlayerCharacter,colors} from './model.mjs';

const palette = new Set(colors);
const drawingKinds = new Set(['line','rectangle','circle','freehand']);
export const weatherNames={clear:'Céu limpo',rain:'Chuva',snow:'Neve',embers:'Brasas',storm:'Tempestade',mist:'Neblina',dust:'Poeira ao vento'};
export const sceneTones={natural:'Original do mapa',dawn:'Amanhecer',dusk:'Crepúsculo',moon:'Luar',sun:'Sol a pino',forest:'Bosque',ice:'Gélido',sepia:'Sépia'};
export const pingNames={point:'Apontar',danger:'Perigo',gather:'Reunir aqui',clue:'Pista'};
const weatherLevels={light:'Leve',medium:'Moderada',heavy:'Intensa'};
export {weatherLevels};
const distanceModes = new Set(['euclidean','chebyshev','manhattan']);
const tableActions = new Set([
  'tableAtmosphere','tableLightSet','tableLightDelete','tableWallAdd','tableWallDelete','tableDoorSet','tableSettings','tableFog','tableDrawingAdd','tableDrawingDelete','tableDrawingClear',
  'tablePing','tokenPatrol','tokenAdd','tokenMove','tokenRotate','tokenUpdate','tokenDelete','combatSet','combatNext','combatEndOwn'
]);
export const tableSceneActions=tableActions;
const sharedActions = new Set(['tablePing','tokenMove','tokenRotate','combatEndOwn']);
const clean = (value,max) => typeof value==='string' ? value.trim().slice(0,max) : '';
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const number = (value,fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bounded = (value,min,max,fallback) => clamp(number(value,fallback),min,max);
const integer = (value,min,max,fallback) => Math.round(bounded(value,min,max,fallback));
const uid = () => crypto.randomUUID();
const fail = (status,message) => { throw Object.assign(new Error(message),{status}); };

export function mapGrid(map,cellPixels=100) {
  if (!map?.width||!map?.height) return null;
  const pixels=Math.max(integer(cellPixels,10,4096,100),Math.ceil(Math.max(map.width,map.height)/80));
  return {columns:clamp(Math.ceil(map.width/pixels),4,80),rows:clamp(Math.ceil(map.height/pixels),4,80),cellPixels:pixels};
}

// The map is top-left aligned. Partial cells add padding rather than stretching the image.
export function mapPixelsPerCell(grid,map){
  return grid.mode==='image'?grid.cellPixels:Math.max(map.width/grid.columns,map.height/grid.rows);
}

function normalizeGrid(value={},map) {
  const mode=value.mode==='manual'?'manual':'image';
  const automatic=mode==='image'?mapGrid(map,value.cellPixels):null;
  return {
    mode,cellPixels:automatic?.cellPixels??integer(value.cellPixels,10,4096,100),
    columns:automatic?.columns??integer(value.columns,4,80,16), rows:automatic?.rows??integer(value.rows,4,80,10),
    size:bounded(value.size,0.1,100,1.5), unit:clean(value.unit,12)||'m',
    distance:distanceModes.has(value.distance)?value.distance:'euclidean',
    visible:value.visible!==false, snap:value.snap!==false
  };
}

function region(value,grid) {
  const x=integer(value.x,0,grid.columns-1,0);
  const y=integer(value.y,0,grid.rows-1,0);
  return {id:clean(value.id,80),x,y,
    width:integer(value.width,1,grid.columns-x,1),height:integer(value.height,1,grid.rows-y,1)};
}

function eligibleForPatrol(state,token){
  return token.kind!=='item'&&(!token.characterId||state.characters?.some(c=>c.id===token.characterId&&!isPlayerCharacter(c)));
}

// Time, rather than a background job or an open GM tab, determines the NPC's position.
export function patrolSample(route,now){
  const points=route.points,legs=[];
  const add=(a,b)=>{
    const dx=b.x-a.x,dy=b.y-a.y,duration=Math.hypot(dx,dy)*1000/route.speed;
    if(duration>0)legs.push({a,dx,dy,duration});
  };
  for(let i=1;i<points.length;i++)add(points[i-1],points[i]);
  if(route.mode==='loop')add(points.at(-1),points[0]);
  else for(let i=points.length-1;i>0;i--)add(points[i],points[i-1]);
  if(!legs.length)return {...points[0]};
  const elapsed=route.offset+(route.started?Math.max(0,now-route.started):0);
  let time=elapsed%legs.reduce((sum,l)=>sum+l.duration,0);
  for(const leg of legs){
    if(time<leg.duration){
      const {a,dx,dy,duration}=leg;
      return {x:a.x+dx*time/duration,y:a.y+dy*time/duration,rotation:normalizeRotation(Math.atan2(dy,dx)*180/Math.PI+90),
        ...(route.started?{motion:{at:now,ms:Math.min(1200,duration-time),vx:dx/duration,vy:dy/duration}}:{})};
    }
    time-=leg.duration;
  }
  return {...points[0]};
}

export function normalizeToken(token,grid) {
  const size=integer(token.size,1,4,1);
  const patrol=token.patrol;
  const validRoute=patrol&&['return','loop'].includes(patrol.mode)&&Number.isFinite(patrol.speed)&&patrol.speed>=.25&&patrol.speed<=4&&Number.isFinite(patrol.started)&&Number.isFinite(patrol.offset)&&Array.isArray(patrol.points)&&patrol.points.length>=2&&patrol.points.length<=48&&patrol.points.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y));
  return {
    id:clean(token.id,80),name:clean(token.name,80)||'Token',
    ...(!token.characterId&&token.kind!=='item'&&clean(token.realName,80)?{realName:clean(token.realName,80)}:{}),
    color:palette.has(token.color)?token.color:'violet',icon:tokenIconIds.has(token.icon)?token.icon:'auto', size,
    x:bounded(token.x,0,grid.columns-size,0),y:bounded(token.y,0,grid.rows-size,0),
    hidden:token.hidden===true,locked:token.locked===true,rotation:normalizeRotation(token.rotation),vision:normalizeVision(token.vision),
    characterId:clean(token.characterId,80),
    ...(validRoute?{patrol}:{}),
    ...(token.portrait?{portrait:token.portrait}:{}),
    ...(token.kind==='item'&&token.loot?{kind:'item',loot:token.loot,characterId:'',vision:{enabled:false,range:0,angle:360}}:{}),
    statuses:Array.isArray(token.statuses) ? [...new Set(token.statuses.map(status=>clean(status,24)).filter(Boolean))].slice(0,6) : []
  };
}

export function normalizeTable(state) {
  const value=state.table||{};
  const grid=normalizeGrid(value.grid,state.map);
  const fog={...(value.fog?.mode==='war'?{mode:'war'}:{}),...(value.fog?.memory?{memory:value.fog.memory}:{}),enabled:value.fog?.enabled===true,strokes:normalizeFogStrokes(value.fog?.strokes,grid),revealed:(Array.isArray(value.fog?.revealed)?value.fog.revealed:[])
    .filter(item=>item && typeof item==='object').slice(0,150).map(item=>region(item,grid))};
  fog.history=(Array.isArray(value.fog?.history)?value.fog.history:[]).slice(-10).filter(item=>item&&Array.isArray(item.revealed)).map(item=>({
    enabled:item.enabled===true,strokes:normalizeFogStrokes(item.strokes,grid),revealed:item.revealed.slice(0,150).map(rect=>region(rect,grid))
  }));
  const drawings=(Array.isArray(value.drawings)?value.drawings:[]).filter(item=>item && drawingKinds.has(item.kind)).slice(0,150).map(item=>({
    id:clean(item.id,80),kind:item.kind,
    x:bounded(item.x,0,grid.columns,0),y:bounded(item.y,0,grid.rows,0),
    toX:bounded(item.toX,0,grid.columns,0),toY:bounded(item.toY,0,grid.rows,0),
    color:/^#[a-f0-9]{6}$/i.test(item.color)?item.color:'#bd9afc',
    ...(item.kind==='freehand'?{points:(Array.isArray(item.points)?item.points:[]).slice(0,600).filter(point=>point&&Number.isFinite(Number(point.x))&&Number.isFinite(Number(point.y))).map(point=>({x:bounded(point.x,0,grid.columns,0),y:bounded(point.y,0,grid.rows,0)}))}:{})
  }));
  const pings=(Array.isArray(value.pings)?value.pings:[]).filter(item=>item && Number.isFinite(item.at)&&Date.now()-item.at<1500&&item.at<=Date.now()+1000).slice(-12).map(item=>({
    id:clean(item.id,80),...(item.characterId?{characterId:clean(item.characterId,80)}:{}),...(Object.hasOwn(pingNames,item.signal)?{signal:item.signal}:{}),x:bounded(item.x,0,grid.columns,0),y:bounded(item.y,0,grid.rows,0),at:item.at,name:clean(item.name,80)||'Participante'
  }));
  const combatValue=value.combat||{};
  const entries=(Array.isArray(combatValue.entries)?combatValue.entries:[]).slice(0,100).map(entry=>({
    id:clean(entry.id,80),name:clean(entry.name,80),value:integer(entry.value,-999,999,0),tokenId:clean(entry.tokenId,80)
  })).filter(entry=>entry.name);
  const lootEvents=(Array.isArray(value.lootEvents)?value.lootEvents:[]).filter(e=>e&&Number.isFinite(e.at)&&Date.now()-e.at<3000&&e.at<=Date.now()+1000&&[e.x,e.y,e.toX,e.toY].every(Number.isFinite)).slice(-12).map(e=>({id:clean(e.id,80),tokenId:clean(e.tokenId,80),at:e.at,x:bounded(e.x,0,grid.columns,0),y:bounded(e.y,0,grid.rows,0),toX:bounded(e.toX,0,grid.columns,0),toY:bounded(e.toY,0,grid.rows,0),public:e.public!==false}));
  const walls=(Array.isArray(value.walls)?value.walls:[]).slice(0,256)
    .filter(w=>w&&clean(w.id,80)&&['wall','door'].includes(w.kind)&&[w.x,w.y,w.toX,w.toY].every(Number.isFinite))
    .map(w=>({id:clean(w.id,80),kind:w.kind,x:clamp(w.x,0,grid.columns),y:clamp(w.y,0,grid.rows),
      toX:clamp(w.toX,0,grid.columns),toY:clamp(w.toY,0,grid.rows),open:w.kind==='door'&&w.open===true}))
    .filter(w=>w.x!==w.toX||w.y!==w.toY);
  const lights=(Array.isArray(value.lights)?value.lights:[]).slice(0,48)
    .filter(l=>l&&clean(l.id,80)&&[l.x,l.y,l.radius].every(Number.isFinite)&&/^#[a-f0-9]{6}$/i.test(l.color))
    .map(l=>({id:clean(l.id,80),x:clamp(l.x,0,grid.columns),y:clamp(l.y,0,grid.rows),
      radius:clamp(l.radius,.25,80),color:l.color.toLowerCase(),...(l.scope==='local'?{scope:'local'}:{}),...(l.angle>0&&l.angle<360?{angle:bounded(l.angle,1,360,360),rotation:normalizeRotation(l.rotation)}:{})}));
  const saved=value.atmosphere||{},atmosphere={
    toneOpacity:integer(saved.toneOpacity,0,100,100),
    weather:Object.hasOwn(weatherNames,saved.weather)?saved.weather:'clear',
    tone:Object.hasOwn(sceneTones,saved.tone)?saved.tone:'natural',
    level:Object.hasOwn(weatherLevels,saved.level)?saved.level:'medium'
  };
  return {grid,atmosphere,lights,walls,fog,drawings,pings,lootEvents,darkness:normalizeDarkness(value.darkness),combat:{entries,
    active:integer(combatValue.active,-1,Math.max(0,entries.length-1),0),round:integer(combatValue.round,1,9999,1)}};
}

// Keep shared token positions synchronized under the visual fog mask.
// Only an explicit GM hide removes the token from player data.
export function tokenVisible(token) {return token.hidden!==true;}

export function playerSight(state,table,characterId){
  const restricted=table.darkness.enabled&&table.darkness.mode==='teams'||table.fog.enabled&&table.fog.mode==='war';
  if(!restricted)return ()=>true;
  const tokens=state.tokens.map(raw=>({...normalizeToken(raw,table.grid),characterId:tokenCharacterId(state,raw),visionSource:playerVisionSource(state,raw)}));
  const viewer=state.characters.find(c=>c.id===characterId);
  const rivals=new Set(state.characters.filter(c=>outsideParty(c,viewer)).map(c=>c.id));
  const sources=visionSources({characterId,state:{table}},tokens).filter(t=>!rivals.has(t.characterId));
  return token=>sources.some(source=>source.id===token.id)||tokenInVision(token,sources,table.grid,table.walls);
}

export function tableView(state,master) {
  const table=normalizeTable(state);
  if (master && table.combat.active<0) table.combat.active=0;
  const allTokens=(state.tokens||[]).map(token=>normalizeToken({...token,characterId:tokenCharacterId(state,token)},table.grid));
  const now=Date.now();
  for(const token of allTokens){
    if(token.patrol&&eligibleForPatrol(state,token)){
      Object.assign(token,patrolSample(token.patrol,now));
      token.x=clamp(token.x,0,table.grid.columns-token.size);token.y=clamp(token.y,0,table.grid.rows-token.size);
    }
    if(!master)delete token.patrol;
  }
  const tokens=master ? allTokens : allTokens.filter(token=>tokenVisible(token,table)).map(token=>publicItemToken(token));
  if (!master) {
    delete table.fog.history;table.lootEvents=table.lootEvents.filter(e=>e.public);
    const hidden=new Set(allTokens.filter(token=>!tokenVisible(token,table)).map(token=>token.id));
    const active=table.combat.entries[table.combat.active];
    const aliases=new Map(allTokens.filter(t=>t.realName).map(t=>[t.id,t.name]));
    table.combat.entries=table.combat.entries.filter(entry=>!hidden.has(entry.tokenId)).map(entry=>
      aliases.has(entry.tokenId)?{...entry,name:aliases.get(entry.tokenId)}:entry);
    const index=table.combat.entries.findIndex(entry=>entry.id===active?.id);
    table.combat.active=index;
  }
  return {table,tokens};
}

function requireNumber(value,label) {
  if (value===null || value==='' || !['number','string'].includes(typeof value) || !Number.isFinite(Number(value))) fail(400,label+' inválido.');
  return Number(value);
}

function requireRange(value,min,max,label,whole=false) {
  const result=requireNumber(value,label);
  if (result<min || result>max || whole && !Number.isInteger(result)) fail(400,label+' fora do intervalo permitido.');
  return result;
}

function validateRect(data,grid) {
  const x=requireRange(data.x,0,grid.columns-1,'Posição X',true);
  const y=requireRange(data.y,0,grid.rows-1,'Posição Y',true);
  const width=requireRange(data.width,1,grid.columns-x,'Largura',true);
  const height=requireRange(data.height,1,grid.rows-y,'Altura',true);
  return {id:uid(),x,y,width,height};
}

function subtract(rect,cut) {
  const left=Math.max(rect.x,cut.x), top=Math.max(rect.y,cut.y);
  const right=Math.min(rect.x+rect.width,cut.x+cut.width), bottom=Math.min(rect.y+rect.height,cut.y+cut.height);
  if (left>=right || top>=bottom) return [rect];
  const pieces=[
    {x:rect.x,y:rect.y,width:rect.width,height:top-rect.y},
    {x:rect.x,y:bottom,width:rect.width,height:rect.y+rect.height-bottom},
    {x:rect.x,y:top,width:left-rect.x,height:bottom-top},
    {x:right,y:top,width:rect.x+rect.width-right,height:bottom-top}
  ];
  return pieces.filter(piece=>piece.width>0 && piece.height>0).map(piece=>({id:uid(),...piece}));
}

function changeFog(table,data) {
  if(table.fog.mode==='war'&&data.operation){
    if(data.operation==='reset'){delete table.fog.memory;return;}
    fail(400,'Selecione névoa manual para pintar ou desfazer.');
  }
  if (data.operation==='undo') {
    const previous=table.fog.history.pop();
    if (previous) Object.assign(table.fog,previous);
    return;
  }
  if (data.operation||data.enabled!==undefined&&data.enabled!==table.fog.enabled) {
    table.fog.history=[...table.fog.history,{enabled:table.fog.enabled,revealed:structuredClone(table.fog.revealed),strokes:structuredClone(table.fog.strokes)}].slice(-10);
  }
  if (data.enabled!==undefined) {
    if (typeof data.enabled!=='boolean') fail(400,'Visibilidade da névoa inválida.');
    table.fog.enabled=data.enabled;
  }
  if (!data.operation) return;
  if (data.operation==='reset') { table.fog.revealed=[];table.fog.strokes=[];return; }
  if (!['reveal','hide'].includes(data.operation)) fail(400,'Operação de névoa inválida.');
  if(data.kind==='brush'){
    if(!Array.isArray(data.points)||!data.points.length||data.points.length>600)fail(400,'Use de 1 a 600 pontos no pincel.');
    const radius=requireRange(data.radius,.001,8,'Raio do pincel');
    const points=data.points.map(p=>({x:requireRange(p?.x,0,table.grid.columns,'Posição X'),y:requireRange(p?.y,0,table.grid.rows,'Posição Y')}));
    if(table.fog.strokes.length>=150||table.fog.strokes.reduce((n,item)=>n+(item.points?.length||0),0)+points.length>4000)fail(409,'Limite de traços de névoa atingido. Desfaça traços ou use Cobrir tudo para recomeçar.');
    table.fog.strokes.push({id:uid(),kind:'brush',operation:data.operation,radius,points});return;
  }
  if(data.kind!==undefined&&data.kind!=='rectangle')fail(400,'Formato de névoa inválido.');
  const rect=validateRect(data,table.grid);
  if(data.operation==='reveal'&&rect.x===0&&rect.y===0&&rect.width===table.grid.columns&&rect.height===table.grid.rows){table.fog.revealed=[rect];table.fog.strokes=[];return;}
  if(table.fog.strokes.length){if(table.fog.strokes.length>=150)fail(409,'Limite de traços de névoa atingido.');table.fog.strokes.push({...rect,kind:'rectangle',operation:data.operation});return;}
  const revealed=data.operation==='reveal' ? [...table.fog.revealed,rect] : table.fog.revealed.flatMap(item=>subtract(item,rect));
  if (revealed.length>150) fail(409,'Limite de áreas de névoa atingido. Redefina as revelações para continuar.');
  table.fog.revealed=revealed;
}

function changeSettings(state,table,data) {
  const grid=data.grid||data;
  const next={...table.grid};
  const hadMapDimensions=Boolean(state.map?.width&&state.map?.height);
  if (data.mapDimensions!==undefined) {
    if (!state.map||data.mapDimensions?.id!==state.map.id) fail(409,'O mapa mudou. Reabra a configuração.');
    const width=requireRange(data.mapDimensions.width,1,32768,'Largura da imagem',true);
    const height=requireRange(data.mapDimensions.height,1,32768,'Altura da imagem',true);
    state.map={...state.map,width,height};
  }
  if (grid.mode!==undefined) {
    if (!['image','manual'].includes(grid.mode)) fail(400,'Modo de grade inválido.');
    next.mode=grid.mode;
  }
  if (grid.cellPixels!==undefined) next.cellPixels=requireRange(grid.cellPixels,10,4096,'Pixels por célula',true);
  if (grid.columns!==undefined) next.columns=requireRange(grid.columns,4,80,'Colunas',true);
  if (grid.rows!==undefined) next.rows=requireRange(grid.rows,4,80,'Linhas',true);
  if (grid.size!==undefined) next.size=requireRange(grid.size,0.1,100,'Escala');
  if (grid.distance!==undefined) {
    if (!distanceModes.has(grid.distance)) fail(400,'Regra de distância inválida.');
    next.distance=grid.distance;
  }
  if (grid.unit!==undefined) {
    next.unit=clean(grid.unit,12);
    if (!next.unit) fail(400,'Informe a unidade da grade.');
  }
  for (const key of ['visible','snap']) {
    if (grid[key]!==undefined) {
      if (typeof grid[key]!=='boolean') fail(400,'Opção de grade inválida.');
      next[key]=grid[key];
    }
  }
  if(data.darkness!==undefined){
    if(!data.darkness||typeof data.darkness!=='object'||Array.isArray(data.darkness))fail(400,'Configuração de escuridão inválida.');
    if(data.darkness.enabled!==undefined&&typeof data.darkness.enabled!=='boolean')fail(400,'Escuridão inválida.');
    if(data.darkness.mode!==undefined&&!['individual','group','teams'].includes(data.darkness.mode))fail(400,'Modo de visão inválido.');
    if(data.darkness.level!==undefined)requireRange(data.darkness.level,0,100,"Intensidade da escuridão");
    if(data.darkness.teams!==undefined){
      const teams=data.darkness.teams;
      if(!teams||typeof teams!=='object'||Array.isArray(teams)||Object.entries(teams).some(([id,name])=>!state.characters.some(c=>c.id===id)||typeof name!=='string'||!name.trim()||name.length>40))fail(400,'Grupo de visão inválido.');
    }
    table.darkness=normalizeDarkness({...table.darkness,...data.darkness});
  }
  if(data.fogMode!==undefined){
    if(!['war','manual'].includes(data.fogMode))fail(400,'Tipo de névoa inválido.');
    table.fog.mode=data.fogMode;
  }
  if (data.fogEnabled!==undefined) {
    if (typeof data.fogEnabled!=='boolean') fail(400,'Visibilidade da névoa inválida.');
    table.fog.enabled=data.fogEnabled;
  }
  Object.assign(next,normalizeGrid(next,state.map));
  if(state.map?.width&&state.map?.height){
    // Before a legacy image reports its dimensions the client draws it using contain.
    const previous=hadMapDimensions?table.grid:{...table.grid,mode:'manual'};
    const ratio=mapPixelsPerCell(previous,state.map)/mapPixelsPerCell(next,state.map);
    if(ratio!==1){
      for(const wall of table.walls){
        wall.x*=ratio;wall.y*=ratio;wall.toX*=ratio;wall.toY*=ratio;
      }
      for(const light of table.lights){
        light.x*=ratio;light.y*=ratio;light.radius*=ratio;
      }
    }
  }
  if(next.columns!==table.grid.columns||next.rows!==table.grid.rows||data.mapDimensions)table.fog.history=[];
  if(next.columns!==table.grid.columns||next.rows!==table.grid.rows){
    for(const token of state.tokens)if(token.patrol?.points.some(p=>p.x>next.columns-token.size||p.y>next.rows-token.size))delete token.patrol;
  }
  table.grid=next;
  table.fog.revealed=table.fog.revealed.filter(rect=>rect.x<next.columns && rect.y<next.rows).map(rect=>({
    ...rect,width:Math.min(rect.width,next.columns-rect.x),height:Math.min(rect.height,next.rows-rect.y)
  }));
  table.fog.strokes=normalizeFogStrokes(table.fog.strokes,next);
  state.tokens=state.tokens.map(token=>normalizeToken(token,next));
}

function changeToken(state,table,action,data,master) {
  if(data.realName!==undefined&&(typeof data.realName!=='string'||data.realName.length>80))fail(400,'Use até 80 caracteres no nome verdadeiro.');
  if(data.patrol!==undefined)fail(400,'Use a ferramenta de rota.');
  if(data.loot!==undefined||data.kind!==undefined)fail(400,'Use o catálogo para colocar itens na mesa.');
  if(data.portrait!==undefined)fail(400,'Envie o retrato pelo importador de imagens.');
  if(data.removePortrait!==undefined&&typeof data.removePortrait!=='boolean')fail(400,'Opção de retrato inválida.');
  if(data.rotation!==undefined)requireRange(data.rotation,0,360,'Direção');
  if(data.vision!==undefined){
    if(!data.vision||typeof data.vision!=='object'||Array.isArray(data.vision))fail(400,'Visão inválida.');
    if(data.vision.enabled!==undefined&&typeof data.vision.enabled!=='boolean')fail(400,'Visão inválida.');
    if(data.vision.range!==undefined)requireRange(data.vision.range,0,10000,'Alcance');
    if(data.vision.angle!==undefined)requireRange(data.vision.angle,1,360,'Abertura');
  }
  if(data.icon!==undefined&&!tokenIconIds.has(data.icon))fail(400,'Símbolo de token inválido.');
  if (action==='tokenAdd') {
    if (state.tokens.length>=100) fail(409,'Limite de tokens atingido.');
    const size=data.size===undefined ? 1 : requireRange(data.size,1,4,'Tamanho',true);
    const x=data.x===undefined ? Math.min(5,table.grid.columns-size) : requireRange(data.x,0,table.grid.columns-size,'Posição X');
    const y=data.y===undefined ? Math.min(4,table.grid.rows-size) : requireRange(data.y,0,table.grid.rows-size,'Posição Y');
    if (data.color!==undefined && !palette.has(data.color)) fail(400,'Cor de token inválida.');
    for (const option of ['hidden','locked']) {
      if (data[option]!==undefined && typeof data[option]!=='boolean') fail(400,'Opção de token inválida.');
    }
    if (data.statuses!==undefined && (!Array.isArray(data.statuses) || data.statuses.length>6 || data.statuses.some(status=>typeof status!=='string' || !clean(status,24)))) fail(400,'Use até seis condições de token.');
    const token=normalizeToken({...data,id:uid(),size,x,y},table.grid);
    if (token.characterId && !state.characters.some(character=>character.id===token.characterId)) fail(400,'Ficha vinculada indisponível.');
    state.tokens.push(token);
    return;
  }
  const token=state.tokens.find(token=>token.id===data.id);
  if (!token) fail(404,'Token indisponível.');
  if (!master && (token.locked || !tokenVisible(token,table))) fail(403,'Este token não pode ser movido.');
  if(action==='tokenPatrol'){
    if(!eligibleForPatrol(state,token))fail(400,'Escolha um NPC ou um token sem ficha.');
    const now=Date.now(),route=token.patrol;
    if(data.operation==='start'){
      if(!Array.isArray(data.points)||data.points.length<2||data.points.length>48||!['loop','return'].includes(data.mode))fail(400,'Marque de 2 a 48 pontos e escolha o percurso.');
      const points=data.points.map(p=>({x:requireRange(p?.x,0,table.grid.columns-token.size,'Posição X'),y:requireRange(p?.y,0,table.grid.rows-token.size,'Posição Y')}));
      if(!points.some(p=>p.x!==points[0].x||p.y!==points[0].y))fail(400,'Escolha dois lugares diferentes.');
      token.patrol={points,mode:data.mode,speed:requireRange(data.speed,.25,4,'Velocidade'),started:now,offset:0};
    }else if(route){
      const {x,y,rotation}=patrolSample(route,now);Object.assign(token,{x,y,rotation});
      if(data.operation==='pause'){if(route.started)route.offset+=Math.max(0,now-route.started);route.started=0;}
      else if(data.operation==='resume'){if(!route.started)route.started=now;}
      else if(data.operation==='clear')delete token.patrol;
      else fail(400,'Operação de rota inválida.');
    }else fail(409,'Este token já não possui uma rota.');
    return;
  }
  if (action==='tokenDelete') {
    state.tokens=state.tokens.filter(item=>item!==token);
    const active=table.combat.entries[table.combat.active];
    table.combat.entries=table.combat.entries.filter(entry=>entry.tokenId!==token.id);
    const next=table.combat.entries.findIndex(entry=>entry.id===active?.id);
    table.combat.active=Math.max(0,next);
    return;
  }
  if(action==='tokenRotate'){token.rotation=normalizeRotation(requireRange(data.rotation,0,360,'Direção'));return;}
  if(action==='tokenUpdate'){
    if(data.rotation!==undefined)token.rotation=normalizeRotation(data.rotation);
    if(data.vision!==undefined)token.vision=normalizeVision({...normalizeVision(token.vision),...data.vision});
  }
  if (action==='tokenMove') {
    const x=requireRange(data.x,0,table.grid.columns-token.size,'Posição X');
    const y=requireRange(data.y,0,table.grid.rows-token.size,'Posição Y');
    const moved={...token,x:table.grid.snap?Math.round(x):x,y:table.grid.snap?Math.round(y):y};
    if(table.fog.enabled&&table.fog.mode==='war'&&data.trail!==undefined&&playerVisionSource(state,token)){
      if(!Array.isArray(data.trail)||data.trail.length>64)fail(400,'Trajeto de exploração inválido.');
      for(const sample of data.trail){
        const x=requireRange(sample?.x,0,table.grid.columns-token.size,'Posição X');
        const y=requireRange(sample?.y,0,table.grid.rows-token.size,'Posição Y');
        const rotation=requireRange(sample?.rotation,0,360,'Direção');
        recordExploration(table.fog,{...token,x,y,rotation},table.grid,table.walls);
      }
    }
    Object.assign(token,moved);delete token.patrol;
    return;
  }
  const originalSize=token.size,previousRealName=token.realName;
  if (data.name!==undefined) {
    const name=clean(data.name,80);
    if (!name) fail(400,'Informe o nome do token.');
    token.name=name;
  }
  if(data.icon!==undefined)token.icon=data.icon;
  if(data.removePortrait)delete token.portrait;
  if (data.size!==undefined) token.size=requireRange(data.size,1,4,'Tamanho',true);
  if (data.color!==undefined) {
    if (!palette.has(data.color)) fail(400,'Cor de token inválida.');
    token.color=data.color;
  }
  for (const key of ['hidden','locked']) {
    if (data[key]!==undefined) {
      if (typeof data[key]!=='boolean') fail(400,'Opção de token inválida.');
      token[key]=data[key];
    }
  }
  if (data.characterId!==undefined) {
    const id=clean(data.characterId,80);
    if (id && !state.characters.some(character=>character.id===id)) fail(400,'Ficha vinculada indisponível.');
    token.characterId=id;
  }
  if(token.characterId||token.kind==='item'||data.realName==='')delete token.realName;
  else if(data.realName!==undefined)token.realName=clean(data.realName,80);
  if(previousRealName||token.realName){
    for(const entry of table.combat.entries)if(entry.tokenId===token.id)entry.name=token.name;
  }
  if (data.statuses!==undefined) {
    if (!Array.isArray(data.statuses) || data.statuses.length>6 || data.statuses.some(status=>typeof status!=='string' || !clean(status,24))) fail(400,'Use até seis condições de token.');
    token.statuses=[...new Set(data.statuses.map(status=>clean(status,24)))];
  }
  if(token.patrol&&(token.size!==originalSize||!eligibleForPatrol(state,token))){
    const {x,y}=patrolSample(token.patrol,Date.now());Object.assign(token,{x,y});delete token.patrol;
  }
  Object.assign(token,normalizeToken(token,table.grid));
}

function changeCombat(state,table,data) {
  if (!Array.isArray(data.entries) || data.entries.length>100) fail(400,'Use até 100 participantes.');
  const seen=new Set();
  table.combat.entries=data.entries.map(entry=>{
    const id=clean(entry?.id,80)||uid();
    const name=clean(entry?.name,80);
    if (!name || seen.has(id)) fail(400,'Participante inválido ou duplicado.');
    seen.add(id);
    const tokenId=clean(entry.tokenId,80);
    if (tokenId && !state.tokens.some(token=>token.id===tokenId)) fail(400,'Token da iniciativa indisponível.');
    return {id,name,value:requireRange(entry.value,-999,999,'Iniciativa',true),tokenId};
  }).sort((a,b)=>b.value-a.value);
  table.combat.active=data.active===undefined ? 0 : requireRange(data.active,0,Math.max(0,table.combat.entries.length-1),'Turno',true);
  table.combat.round=data.round===undefined ? 1 : requireRange(data.round,1,9999,'Rodada',true);
}

export function mutateTable(state,action,data,master,actorName=master?'Mestre':'Participante',actorCharacterId=null) {
  if (!tableActions.has(action)) return false;
  if (!master && !sharedActions.has(action)) fail(403,'Ação reservada ao mestre.');
  const table=normalizeTable(state);
  if (table.combat.active<0) table.combat.active=0;
  state.tokens=(state.tokens||[]).map(token=>normalizeToken({...token,characterId:tokenCharacterId(state,token)},table.grid));
  if (action==='tableSettings') changeSettings(state,table,data);
  else if(action==='tableAtmosphere'){
    for(const [key,choices] of [['weather',weatherNames],['tone',sceneTones],['level',weatherLevels]]){
      if(typeof data[key]!=='string'||!Object.hasOwn(choices,data[key]))fail(400,'Escolha um ambiente válido.');
    }
    const toneOpacity=data.toneOpacity===undefined?table.atmosphere.toneOpacity:requireRange(data.toneOpacity,0,100,'Opacidade da tonalidade',true);
    table.atmosphere={weather:data.weather,tone:data.tone,level:data.level,toneOpacity};
  }
  else if(action==='tableLightSet'){
    const light=data.id?table.lights.find(item=>item.id===data.id):{id:uid()};
    if(!light)fail(404,'Emissor não encontrado.');
    if(!data.id&&table.lights.length>=48)fail(409,'Limite de 48 emissores nesta cena.');
    if(typeof data.color!=='string'||!/^#[a-f0-9]{6}$/i.test(data.color))fail(400,'Cor de luz inválida.');
    Object.assign(light,{color:data.color.toLowerCase(),x:requireRange(data.x,0,table.grid.columns,'Posição X'),
      y:requireRange(data.y,0,table.grid.rows,'Posição Y'),radius:requireRange(data.radius,.25,80,'Raio')});
    if(data.scope!==undefined){
      if(!['local','global'].includes(data.scope))fail(400,'Visibilidade da luz inválida.');
      light.scope=data.scope;
    }
    if(data.angle!==undefined)light.angle=requireRange(data.angle,1,360,'Abertura');
    if(data.rotation!==undefined)light.rotation=normalizeRotation(requireRange(data.rotation,0,360,'Direção'));
    if(!data.id)table.lights.push(light);
  }else if(action==='tableLightDelete'){
    table.lights=table.lights.filter(light=>light.id!==data.id);
  }
  else if(action==='tableWallAdd'){
    if(table.walls.length>=256)fail(409,'Limite de 256 segmentos nesta cena.');
    if(!['wall','door'].includes(data.kind))fail(400,'Tipo de barreira inválido.');
    const wall={id:uid(),kind:data.kind,open:false};
    for(const key of ['x','y','toX','toY'])wall[key]=requireRange(data[key],0,['x','toX'].includes(key)?table.grid.columns:table.grid.rows,'Coordenada');
    if(Math.hypot(wall.toX-wall.x,wall.toY-wall.y)<=.02)fail(400,'Marque dois pontos diferentes.');
    table.walls.push(wall);
  }else if(action==='tableWallDelete'||action==='tableDoorSet'){
    const wall=table.walls.find(w=>w.id===data.id);
    if(!wall)fail(404,'Barreira não encontrada.');
    if(action==='tableWallDelete')table.walls=table.walls.filter(w=>w!==wall);
    else{
      if(wall.kind!=='door'||typeof data.open!=='boolean')fail(400,'Estado de porta inválido.');
      wall.open=data.open;
    }
  }
  else if (action==='tableFog') changeFog(table,data);
  else if (action.startsWith('token')) changeToken(state,table,action,data,master);
  else if (action==='tablePing') {
    const now=Date.now();
    if(data.signal!==undefined&&(typeof data.signal!=='string'||!Object.hasOwn(pingNames,data.signal)))fail(400,'Sinal desconhecido.');
    table.pings=[...table.pings.filter(ping=>now-ping.at<1500),{
      id:uid(),...(actorCharacterId?{characterId:actorCharacterId}:{}),...(data.signal?{signal:data.signal}:{}),x:requireRange(data.x,0,table.grid.columns,'Posição X'),y:requireRange(data.y,0,table.grid.rows,'Posição Y'),at:now,name:clean(actorName,80)||'Participante'
    }].slice(-12);
  } else if (action==='tableDrawingAdd') {
    if (table.drawings.length>=150) fail(409,'Limite de 150 desenhos atingido.');
    if (!drawingKinds.has(data.kind) || !/^#[a-f0-9]{6}$/i.test(data.color)) fail(400,'Desenho inválido.');
    const item={id:uid(),kind:data.kind,color:data.color};
    if(data.kind==='freehand'){
      if(!Array.isArray(data.points)||data.points.length<2||data.points.length>600)fail(400,'Use de 2 a 600 pontos no desenho livre.');
      item.points=data.points.map(point=>({x:requireRange(point?.x,0,table.grid.columns,'Coordenada X'),y:requireRange(point?.y,0,table.grid.rows,'Coordenada Y')}));
      Object.assign(item,{x:item.points[0].x,y:item.points[0].y,toX:item.points.at(-1).x,toY:item.points.at(-1).y});
    }else for (const key of ['x','y','toX','toY']) item[key]=requireRange(data[key],0,key.includes('X')||key==='x'?table.grid.columns:table.grid.rows,'Coordenada');
    table.drawings.push(item);
  } else if (action==='tableDrawingDelete') table.drawings=table.drawings.filter(item=>item.id!==data.id);
  else if (action==='tableDrawingClear') table.drawings=[];
  else if (action==='combatSet') changeCombat(state,table,data);
  else if (action==='combatEndOwn'||action==='combatNext' && table.combat.entries.length) {
    if(action==='combatEndOwn'){
      const entry=table.combat.entries[table.combat.active];
      const token=state.tokens.find(item=>item.id===entry?.tokenId);
      if(!actorCharacterId||!token||token.characterId!==actorCharacterId||!tokenVisible(token,table)||!playerSight(state,table,actorCharacterId)(token))fail(403,'Só é possível encerrar o turno do seu personagem.');
      if(data.entryId!==entry.id||data.round!==table.combat.round)fail(409,'O turno já mudou.');
    }
    const direction=action==='combatEndOwn'?1:data.direction??1;
    if (![1,-1].includes(direction)) fail(400,'Direção inválida.');
    const {entries,active,round}=table.combat;
    if (direction===1) {
      table.combat.active=(active+1)%entries.length;
      if (active===entries.length-1) table.combat.round=Math.min(9999,round+1);
    } else if (active>0) table.combat.active--;
    else if (round>1) {table.combat.active=entries.length-1;table.combat.round--;}
  }
  if(table.fog.mode==='war'&&table.fog.enabled){
    const moved=action==='tokenMove'||action==='tokenRotate';
    if(moved||['tableSettings','tokenAdd','tokenUpdate','tableFog','tableDoorSet','tableWallDelete'].includes(action)){
      for(const token of state.tokens)if((!moved||token.id===data.id)&&playerVisionSource(state,token))recordExploration(table.fog,token,table.grid,table.walls);
    }
  }
  state.table=normalizeTable({...state,table});
  return true;
}
