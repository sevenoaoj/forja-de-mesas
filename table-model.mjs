import {resolveTokenPath,slideToken} from './token-motion.mjs';
export {slideToken};
import {publicItemToken} from './loot-data.mjs';
import {visionSources,tokenInVision,recordExploration,normalizeVision,normalizeDarkness,normalizeRotation} from './vision-model.mjs';
export {normalizeVision,normalizeDarkness,normalizeRotation} from './vision-model.mjs';
import {tokenIconIds} from './token-icons.mjs';
export {pointRevealed} from './fog-geometry.mjs';
import {normalizeFogStrokes} from './fog-geometry.mjs';
import {outsideParty,playerVisionSource,tokenCharacterId,isPlayerCharacter,colors} from './model.mjs';

const palette = new Set(colors);
const drawingKinds = new Set(['cone','burst','beam','line','rectangle','circle','freehand']);
export const weatherNames={clear:'Céu limpo',rain:'Chuva',snow:'Neve',embers:'Brasas',storm:'Tempestade',mist:'Neblina',dust:'Poeira ao vento'};
export const sceneTones={natural:'Original do mapa',dawn:'Amanhecer',dusk:'Crepúsculo',moon:'Luar',sun:'Sol a pino',forest:'Bosque',ice:'Gélido',sepia:'Sépia'};
export const pingNames={point:'Apontar',danger:'Perigo',gather:'Reunir aqui',clue:'Pista'};
const weatherLevels={light:'Leve',medium:'Moderada',heavy:'Intensa'};
export {weatherLevels};
const distanceModes = new Set(['euclidean','chebyshev','manhattan']);
const tableActions = new Set([
  'tableEffect','tableAtmosphere','tableLightSet','tableLightDelete','tableWallAdd','tableWallDelete','tableDoorSet','tableSettings','tableFog','tableDrawingAdd','tableDrawingDelete','tableDrawingClear',
  'tablePing','tokenCondition','tokenPatrol','tableSceneLife','tokenAdd','tokenMove','tokenRotate','tokenUpdate','tokenDelete','combatSet','combatNext','combatEndOwn'
]);
export const tableSceneActions=tableActions;
const sharedActions = new Set(['tableEffect','tablePing','tokenMove','tokenRotate','combatEndOwn']);
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

function seededFraction(seed, index) {
  let x = (Math.imul((Number(seed) || 0) + 1, 2654435761) ^ Math.imul((index || 0) + 1, 2246822519)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 1 | x);
  x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

const ambientPalette = [...palette];
const ambientIcons = ['auto', 'initial', 'shield', 'magic', 'target', 'hammer', 'healer', 'leaf', 'music', 'rogue', 'fist', 'book', 'compass', 'anchor', 'balance'].filter(id => tokenIconIds.has(id));
export const ambientPresets = Object.freeze({
  stroll: Object.freeze({label: 'Cidadão passeando', mode: 'wander', speed: 0.6, pause: 8, activity: 'Passeando', ambient: true}),
  play: Object.freeze({label: 'Crianças brincando', mode: 'wander', speed: 2.2, pause: 1.5, activity: 'Brincando', ambient: true}),
  idle: Object.freeze({label: 'Estacionário vivo', mode: 'idle', speed: 0.5, pause: 6, activity: 'Conversando', ambient: true}),
  guard: Object.freeze({label: 'Guarda em ronda', mode: 'return', speed: 1.1, pause: 3, activity: 'Em ronda', ambient: false}),
  passerby: Object.freeze({label: 'Transeuntes (entrar e sair)', mode: 'pass', speed: 1, pause: 0, cooldown: 15, varyAppearance: true, activity: 'Caminhando', ambient: true})
});

export function pointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonBounds(area, grid = null) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of area) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return null;
  const x = grid ? clamp(minX, 0, grid.columns) : minX;
  const y = grid ? clamp(minY, 0, grid.rows) : minY;
  const width = grid ? clamp(maxX - minX, 0, grid.columns - x) : maxX - minX;
  const height = grid ? clamp(maxY - minY, 0, grid.rows - y) : maxY - minY;
  return {x, y, width, height};
}

export function generateWanderPoints(bounds, tokenSize, table, seed, startPoint = null, steps = 10, area = null) {
  const maxX = Math.max(0, table.grid.columns - tokenSize);
  const maxY = Math.max(0, table.grid.rows - tokenSize);
  const hasPoly = Array.isArray(area) && area.length >= 3;
  // Quando há polígono livre desenhado no mapa, permite coordenadas onde o centro do token fique dentro do desenho
  const minX = clamp(hasPoly ? bounds.x - tokenSize / 2 : bounds.x, 0, maxX);
  const minY = clamp(hasPoly ? bounds.y - tokenSize / 2 : bounds.y, 0, maxY);
  const hiX = clamp(hasPoly ? bounds.x + bounds.width - tokenSize / 2 : bounds.x + bounds.width - tokenSize, minX, maxX);
  const hiY = clamp(hasPoly ? bounds.y + bounds.height - tokenSize / 2 : bounds.y + bounds.height - tokenSize, minY, maxY);
  const spanX = hiX - minX, spanY = hiY - minY;
  const insideZone = pos => {
    if (pos.x < minX - 1e-6 || pos.x > hiX + 1e-6 || pos.y < minY - 1e-6 || pos.y > hiY + 1e-6) return false;
    if (!hasPoly) return true;
    return pointInPolygon({x: pos.x + tokenSize / 2, y: pos.y + tokenSize / 2}, area);
  };
  const segmentInside = (from, to) => {
    if (!hasPoly) return true;
    for (const t of [0.25, 0.5, 0.75, 1]) {
      if (!insideZone({x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t})) return false;
    }
    return true;
  };
  let start = null;
  if (startPoint) {
    const clamped = {x: clamp(startPoint.x, minX, hiX), y: clamp(startPoint.y, minY, hiY)};
    if (insideZone(clamped)) start = clamped;
  }
  if (!start) {
    for (let i = 0; i < 80 && !start; i++) {
      const cand = {x: minX + spanX * seededFraction(seed, i * 2 + 1), y: minY + spanY * seededFraction(seed, i * 2 + 2)};
      if (insideZone(cand)) start = cand;
    }
  }
  if (!start && hasPoly) {
    const cx = area.reduce((s, p) => s + p.x, 0) / area.length - tokenSize / 2;
    const cy = area.reduce((s, p) => s + p.y, 0) / area.length - tokenSize / 2;
    const centroid = {x: clamp(cx, minX, hiX), y: clamp(cy, minY, hiY)};
    if (insideZone(centroid)) start = centroid;
    else {
      for (const v of area) {
        const cand = {x: clamp((v.x - tokenSize / 2) * 0.8 + centroid.x * 0.2, minX, hiX), y: clamp((v.y - tokenSize / 2) * 0.8 + centroid.y * 0.2, minY, hiY)};
        if (insideZone(cand)) { start = cand; break; }
      }
    }
  }
  if (!start) start = {x: minX + spanX * 0.5, y: minY + spanY * 0.5};
  const points = [start];
  let current = start;
  const maxAttempts = hasPoly ? steps * 14 : steps * 4;
  for (let attempt = 0; attempt < maxAttempts && points.length < steps; attempt++) {
    const candidate = {
      x: minX + spanX * seededFraction(seed, attempt * 2 + 101),
      y: minY + spanY * seededFraction(seed, attempt * 2 + 102)
    };
    if (!insideZone(candidate)) continue;
    const reached = slideToken(current, candidate, tokenSize, table);
    const boundedReached = {x: clamp(reached.x, minX, hiX), y: clamp(reached.y, minY, hiY)};
    if (!insideZone(boundedReached) || !segmentInside(current, boundedReached)) continue;
    if (Math.hypot(boundedReached.x - current.x, boundedReached.y - current.y) >= 0.35) {
      points.push(boundedReached);
      current = boundedReached;
    }
  }
  return points;
}

function patrolSegments(route) {
  const points = route.points, segments = [];
  const pauseSec = Number.isFinite(route.pause) && route.pause > 0 ? clamp(route.pause, 0, 60) : 0;
  const seed = Number.isInteger(route.seed) ? route.seed : 0;
  if (route.mode === 'idle') {
    const origin = points[0];
    const baseRot = normalizeRotation(route.baseRotation || 0);
    const baseMs = Math.max(2, pauseSec || 5) * 1000;
    for (let i = 0; i < 6; i++) {
      const delta = (seededFraction(seed, i * 2 + 3) - 0.5) * 70;
      const factor = 0.65 + 0.7 * seededFraction(seed, i * 2 + 4);
      segments.push({kind: 'wait', a: origin, rotation: normalizeRotation(baseRot + delta), duration: Math.round(baseMs * factor)});
    }
    const activeMs = segments.reduce((sum, s) => sum + s.duration, 0);
    return {segments, activeMs};
  }
  let stopIndex = 0;
  const addLeg = (a, b, allowPause) => {
    const dx = b.x - a.x, dy = b.y - a.y, duration = Math.hypot(dx, dy) * 1000 / route.speed;
    if (duration <= 0) return;
    const rotation = normalizeRotation(Math.atan2(dy, dx) * 180 / Math.PI + 90);
    segments.push({kind: 'move', a, dx, dy, rotation, duration});
    if (allowPause && pauseSec > 0) {
      const factor = 0.6 + 0.8 * seededFraction(seed, stopIndex++);
      segments.push({kind: 'wait', a: b, rotation, duration: Math.round(pauseSec * 1000 * factor)});
    }
  };
  if (route.mode === 'pass') {
    for (let i = 1; i < points.length; i++) addLeg(points[i - 1], points[i], i < points.length - 1);
    const activeMs = segments.reduce((sum, s) => sum + s.duration, 0);
    const cooldownSec = Number.isFinite(route.cooldown) ? clamp(route.cooldown, 2, 300) : 15;
    const firstRot = segments[0]?.rotation ?? 0;
    segments.push({kind: 'absent', a: points[0], rotation: firstRot, duration: Math.round(cooldownSec * 1000)});
    return {segments, activeMs};
  }
  for (let i = 1; i < points.length; i++) addLeg(points[i - 1], points[i], true);
  if (route.mode === 'loop') addLeg(points.at(-1), points[0], true);
  else for (let i = points.length - 1; i > 0; i--) addLeg(points[i], points[i - 1], true);
  const activeMs = segments.reduce((sum, s) => sum + s.duration, 0);
  return {segments, activeMs};
}

export function patrolCycleDuration(route) {
  return patrolSegments(route).segments.reduce((sum, s) => sum + s.duration, 0);
}

// Time, rather than a background job or an open GM tab, determines the NPC's position.
export function patrolSample(route, now, portraitOptions = null) {
  const {segments, activeMs} = patrolSegments(route);
  if (!segments.length) return {...route.points[0]};
  const total = segments.reduce((sum, s) => sum + s.duration, 0);
  if (total <= 0) return {...route.points[0]};
  const elapsed = (route.offset || 0) + (route.started ? Math.max(0, now - route.started) : 0);
  const cycle = Math.floor(elapsed / total);
  let time = elapsed % total;
  const elapsedInCycle = time;
  const activity = typeof route.activity === 'string' && route.activity.trim() ? route.activity.trim() : '';
  const pool = Array.isArray(portraitOptions?.portraits) ? portraitOptions.portraits.filter(p => p?.id) : [];
  const hasPortrait = pool.length > 0 || Boolean(portraitOptions?.portrait?.id);
  const appearance = route.mode === 'pass' && route.varyAppearance
    ? {
        color: ambientPalette[Math.floor(seededFraction(route.seed || 0, cycle * 2 + 17) * ambientPalette.length)],
        ...(pool.length > 0
          ? {portrait: pool[Math.floor(seededFraction(route.seed || 0, cycle * 2 + 43) * pool.length)], icon: 'auto'}
          : hasPortrait
            ? {icon: 'auto'}
            : {icon: ambientIcons[Math.floor(seededFraction(route.seed || 0, cycle * 2 + 31) * ambientIcons.length)] || 'auto'})
      }
    : null;
  for (const seg of segments) {
    if (time < seg.duration) {
      const remaining = seg.duration - time;
      if (seg.kind === 'absent') {
        return {
          x: seg.a.x, y: seg.a.y, rotation: seg.rotation, ambientAbsent: true,
          ...(route.started ? {motion: {at: now, ms: Math.min(1200, remaining), vx: 0, vy: 0}} : {})
        };
      }
      const fadeMs = route.mode === 'pass' ? Math.min(700, activeMs / 3) : 0;
      const ambientPhase = route.mode === 'pass' && fadeMs > 0
        ? (elapsedInCycle < fadeMs ? 'entering' : elapsedInCycle > activeMs - fadeMs ? 'exiting' : '')
        : '';
      if (seg.kind === 'wait') {
        return {
          x: seg.a.x, y: seg.a.y, rotation: seg.rotation,
          ...(appearance || {}),
          ...(ambientPhase ? {ambientPhase} : {}),
          ...(activity ? {ambientActivity: activity} : {}),
          ...(route.started ? {motion: {at: now, ms: Math.min(1200, remaining), vx: 0, vy: 0}} : {})
        };
      }
      const {a, dx, dy, duration, rotation} = seg;
      return {
        x: a.x + dx * time / duration,
        y: a.y + dy * time / duration,
        rotation,
        ...(appearance || {}),
        ...(ambientPhase ? {ambientPhase} : {}),
        ...(activity && !(route.pause > 0) ? {ambientActivity: activity} : {}),
        ...(route.started ? {motion: {at: now, ms: Math.min(1200, remaining), vx: dx / duration, vy: dy / duration}} : {})
      };
    }
    time -= seg.duration;
  }
  return {...route.points[0]};
}

// Keep expiry coordinates in the saved scene. A rewind of initiative restores the
// condition without replaying an action or broadcasting the expired schedule.
export function validConditionTimer(timer){
  return timer&&typeof timer.name==='string'&&timer.name.trim()&&timer.name.length<=24&&
    Number.isInteger(timer.startRound)&&timer.startRound>=1&&timer.startRound<=9999&&
    typeof timer.startEntry==='string'&&timer.startEntry.length<=80&&Number.isInteger(timer.endRound)&&timer.endRound>=timer.startRound&&timer.endRound<=9999&&
    (timer.mode==='rounds'&&timer.endRound>timer.startRound&&timer.endRound-timer.startRound<=99||
     timer.mode==='turn'&&timer.endRound-timer.startRound<=1&&typeof timer.entryId==='string'&&timer.entryId.length<=80);
}
function runningCondition(timer,combat){
  const {entries,active,round}=combat;
  if(!entries.length||round<timer.startRound)return null;
  if(round===timer.startRound&&active<entries.findIndex(e=>e.id===timer.startEntry))return null;
  if(timer.mode==='rounds'){
    const remaining=timer.endRound-round;
    return remaining>0?{name:timer.name,mode:'rounds',remaining,total:timer.endRound-timer.startRound}:null;
  }
  const target=entries.findIndex(e=>e.id===timer.entryId);
  if(target<0||round>timer.endRound||round===timer.endRound&&active>target)return null;
  return {name:timer.name,mode:'turn',ending:round===timer.endRound&&active===target};
}

export function conditionSummary(token){
  const timed=(token.timedStatuses||[]).map(c=>c.name+' · '+(c.mode==='turn'?(c.ending?'até o fim deste turno':'até o fim do próximo turno'):c.remaining+' '+(c.remaining===1?'rodada':'rodadas')));
  return [...timed,...(token.statuses||[])].join(' · ');
}

export function normalizeToken(token,grid) {
  const size=integer(token.size,1,4,1);
  const patrol=token.patrol;
  const minPoints=patrol?.mode==='idle'?1:2;
  const validRoute=patrol&&['return','loop','pass','wander','idle'].includes(patrol.mode)&&Number.isFinite(patrol.speed)&&patrol.speed>=.25&&patrol.speed<=4&&Number.isFinite(patrol.started)&&Number.isFinite(patrol.offset)&&Array.isArray(patrol.points)&&patrol.points.length>=minPoints&&patrol.points.length<=48&&patrol.points.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y));
  const validBounds=patrol?.mode==='wander'&&patrol.bounds&&['x','y','width','height'].every(k=>Number.isFinite(patrol.bounds[k]))&&patrol.bounds.width>0&&patrol.bounds.height>0
    ? {x:bounded(patrol.bounds.x,0,grid.columns,0),y:bounded(patrol.bounds.y,0,grid.rows,0),width:clamp(patrol.bounds.width,.5,grid.columns),height:clamp(patrol.bounds.height,.5,grid.rows)}
    : null;
  const validArea=patrol?.mode==='wander'&&Array.isArray(patrol.area)&&patrol.area.length>=3&&patrol.area.length<=64&&patrol.area.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y))
    ? patrol.area.map(p=>({x:bounded(p.x,0,grid.columns,0),y:bounded(p.y,0,grid.rows,0)}))
    : null;
  const cleanPatrol=validRoute?{
    points:patrol.points,mode:patrol.mode,speed:patrol.speed,started:patrol.started,offset:patrol.offset,
    ...(Number.isFinite(patrol.pause)&&patrol.pause>0?{pause:clamp(patrol.pause,0,60)}:{}),
    ...(patrol.mode==='pass'&&Number.isFinite(patrol.cooldown)?{cooldown:clamp(patrol.cooldown,2,300)}:{}),
    ...(validBounds?{bounds:validBounds}:{}),
    ...(validArea?{area:validArea}:{}),
    ...(patrol.mode==='idle'&&Number.isFinite(patrol.baseRotation)?{baseRotation:normalizeRotation(patrol.baseRotation)}:{}),
    ...(Number.isInteger(patrol.seed)&&patrol.seed>=0&&patrol.seed<=999999?{seed:patrol.seed}:{}),
    ...(clean(patrol.activity,32)?{activity:clean(patrol.activity,32)}:{}),
    ...(patrol.mode==='pass'&&patrol.varyAppearance===true?{varyAppearance:true}:{})
  }:null;
  const ambient=!token.characterId&&token.kind!=='item'&&token.ambient===true;
  const cleanPortraits=Array.isArray(token.portraits)
    ? token.portraits.filter(p=>p&&typeof p.id==='string'&&p.id&&typeof p.type==='string'&&Number.isFinite(p.size)).slice(0,12).map(p=>({id:clean(p.id,80),name:clean(p.name,180)||'Arquivo',type:p.type,size:p.size}))
    : [];
  return {
    id:clean(token.id,80),name:clean(token.name,80)||'Token',
    ...(!token.characterId&&token.kind!=='item'&&clean(token.realName,80)?{realName:clean(token.realName,80)}:{}),
    color:palette.has(token.color)?token.color:'violet',icon:tokenIconIds.has(token.icon)?token.icon:'auto', size,
    x:bounded(token.x,0,grid.columns-size,0),y:bounded(token.y,0,grid.rows-size,0),
    hidden:token.hidden===true,locked:token.locked===true,rotation:normalizeRotation(token.rotation),
    vision:ambient?{enabled:false,range:0,angle:360}:normalizeVision(token.vision),
    characterId:clean(token.characterId,80),
    ...(ambient?{ambient:true}:{}),
    ...(cleanPatrol?{patrol:cleanPatrol}:{}),
    ...(Array.isArray(token.conditionSchedule)?{conditionSchedule:token.conditionSchedule.filter(validConditionTimer).slice(-24)}:{}),
    ...(token.portrait?{portrait:token.portrait}:{}),
    ...(cleanPortraits.length?{portraits:cleanPortraits}:{}),
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
    .filter(w=>w&&clean(w.id,80)&&['wall','door','window'].includes(w.kind)&&[w.x,w.y,w.toX,w.toY].every(Number.isFinite))
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
  return {...(Array.isArray(value.exploration)?{exploration:structuredClone(value.exploration)}:{}),grid,atmosphere,lights,walls,fog,drawings,pings,lootEvents,darkness:normalizeDarkness(value.darkness),combat:{entries,
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
  let patrolRunning=0,patrolPaused=0;
  for(const token of allTokens){
    if(token.patrol&&eligibleForPatrol(state,token)){
      if(token.patrol.started)patrolRunning++;else patrolPaused++;
      Object.assign(token,patrolSample(token.patrol,now,token));
      token.x=clamp(token.x,0,table.grid.columns-token.size);token.y=clamp(token.y,0,table.grid.rows-token.size);
    }
    if(token.conditionSchedule){
      const timers=token.conditionSchedule.map(timer=>runningCondition(timer,table.combat)).filter(Boolean);
      if(timers.length)token.timedStatuses=timers;
      delete token.conditionSchedule;
    }
    if(!master){delete token.patrol;delete token.portraits;}
  }
  if(patrolRunning>0)table.hasPatrols=true;
  if(master){table.patrolRunning=patrolRunning;table.patrolPaused=patrolPaused;}
  const tokens=master ? allTokens : allTokens.filter(token=>tokenVisible(token,table)&&!token.ambientAbsent).map(token=>publicItemToken(token));
  if (!master) {
    delete table.exploration;delete table.fog.history;table.lootEvents=table.lootEvents.filter(e=>e.public);
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
      for(const point of table.exploration||[]){point.x=clamp(point.x*ratio,0,next.columns);point.y=clamp(point.y*ratio,0,next.rows);point.radius=clamp(point.radius*ratio,.25,80);if(point.bounds){point.bounds.w*=ratio;point.bounds.h*=ratio;}}
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

function changeCondition(token,combat,data){
  if(token.kind==='item')fail(400,'Escolha um personagem ou NPC.');
  const name=clean(data.name,24);
  if(!name||typeof data.name!=='string'||data.name.trim().length>24)fail(400,'Use um nome de até 24 caracteres.');
  const same=value=>value.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR');
  const statuses=token.statuses.filter(s=>!same(s));
  const schedule=(token.conditionSchedule||[]).filter(t=>!same(t.name));
  if(!['remove','manual','rounds','turn'].includes(data.mode))fail(400,'Duração inválida.');
  if(data.mode!=='remove'&&statuses.length+schedule.filter(t=>runningCondition(t,combat)).length>=6)fail(409,'Use até seis condições ativas.');
  if(data.mode==='manual')statuses.push(name);
  if(data.mode==='turn'||data.mode==='rounds'){
    const {round,active,entries}=combat;
    if(!entries.length)fail(409,'Organize a iniciativa antes de aplicar uma duração.');
    if(data.expectedEntry!==undefined&&(data.expectedEntry!==entries[active].id||data.expectedRound!==round))fail(409,'O turno mudou. Reabra as condições antes de aplicar a duração.');
    const timer={name,mode:data.mode,startRound:round,startEntry:entries[active].id};
    if(data.mode==='rounds')timer.endRound=round+requireRange(data.rounds,1,99,'Duração em rodadas',true);
    else{
      const next=entries.findIndex((e,i)=>e.tokenId===token.id&&i>active);
      const target=next>=0?next:entries.findIndex(e=>e.tokenId===token.id);
      if(target<0)fail(409,'Vincule o token à ordem de iniciativa para usar o fim do próximo turno.');
      timer.endRound=round+(target<=active?1:0);timer.entryId=entries[target].id;
    }
    if(timer.endRound>9999)fail(409,'A duração ultrapassa o limite de rodadas deste combate.');
    // Bound the rewind history without evicting live conditions.
    if(schedule.length>=24){const expired=schedule.findIndex(t=>!runningCondition(t,combat));if(expired>=0)schedule.splice(expired,1);}
    schedule.push(timer);
  }
  token.statuses=statuses;
  if(schedule.length)token.conditionSchedule=schedule;else delete token.conditionSchedule;
}

function changeToken(state,table,action,data,master) {
  if(data.conditionSchedule!==undefined||data.timedStatuses!==undefined)fail(400,'Use o controle de condições do token.');
  if(data.realName!==undefined&&(typeof data.realName!=='string'||data.realName.length>80))fail(400,'Use até 80 caracteres no nome verdadeiro.');
  if(data.patrol!==undefined)fail(400,'Use a ferramenta de rota.');
  if(data.loot!==undefined||data.kind!==undefined)fail(400,'Use o catálogo para colocar itens na mesa.');
  if(data.portrait!==undefined||data.portraits!==undefined)fail(400,'Envie o retrato pelo importador de imagens.');
  if(data.removePortrait!==undefined&&typeof data.removePortrait!=='boolean')fail(400,'Opção de retrato inválida.');
  if(data.removePortraitPool!==undefined&&typeof data.removePortraitPool!=='boolean')fail(400,'Opção de galeria inválida.');
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
  if(action==='tokenCondition'){changeCondition(token,table.combat,data);return;}
  if(action==='tokenPatrol'){
    if(!eligibleForPatrol(state,token))fail(400,'Escolha um NPC ou um token sem ficha.');
    const now=Date.now(),route=token.patrol;
    if(data.operation==='promote'){
      if(route){const {x,y,rotation}=patrolSample(route,now);Object.assign(token,{x,y,rotation});delete token.patrol;}
      delete token.ambient;
      return;
    }
    if(data.operation==='start'){
      if(!['loop','return','pass','wander','idle'].includes(data.mode))fail(400,'Escolha um modo de percurso válido.');
      const pause=data.pause!==undefined&&data.pause!==''?requireRange(data.pause,0,60,'Pausa'):(data.mode==='idle'?6:0);
      const cooldown=data.mode==='pass'?(data.cooldown!==undefined&&data.cooldown!==''?requireRange(data.cooldown,2,300,'Intervalo fora da cena'):15):undefined;
      const activity=data.activity!==undefined?clean(data.activity,32):'';
      const varyAppearance=data.mode==='pass'&&data.varyAppearance===true;
      const count=data.mode==='idle'?1:(data.count!==undefined&&data.count!==''?requireRange(data.count,1,6,'Quantidade de figurantes',true):1);
      if(count>1&&state.tokens.length+count-1>100)fail(409,'Limite de 100 tokens na cena atingido.');
      const baseSeed=Number.isInteger(data.seed)&&data.seed>=0&&data.seed<=999999?data.seed:Math.floor(Math.random()*900000)+1;
      const speed=data.mode==='idle'?0.5:requireRange(data.speed,.25,4,'Velocidade');
      let points,bounds,area;
      if(data.mode==='idle'){
        points=[{x:token.x,y:token.y}];
      }else if(data.mode==='wander'){
        if(Array.isArray(data.area)&&data.area.length>=3){
          if(data.area.length>64)fail(400,'Área desenhada com muitos pontos.');
          area=data.area.map(p=>({x:requireRange(p?.x,0,table.grid.columns,'Ponto X da área'),y:requireRange(p?.y,0,table.grid.rows,'Ponto Y da área')}));
          bounds=polygonBounds(area,table.grid);
          if(!bounds||bounds.width<0.5&&bounds.height<0.5)fail(400,'Desenhe uma área maior no mapa para os figurantes caminharem.');
        }else{
          if(!data.bounds||typeof data.bounds!=='object')fail(400,'Desenhe a área de vagueio livremente no mapa.');
          const bx=requireRange(data.bounds.x,0,table.grid.columns,'Início X da zona');
          const by=requireRange(data.bounds.y,0,table.grid.rows,'Início Y da zona');
          const bw=requireRange(data.bounds.width,token.size,table.grid.columns,'Largura da zona');
          const bh=requireRange(data.bounds.height,token.size,table.grid.rows,'Altura da zona');
          bounds={x:bx,y:by,width:Math.min(bw,table.grid.columns-bx),height:Math.min(bh,table.grid.rows-by)};
          if(bounds.width<token.size+0.4&&bounds.height<token.size+0.4)fail(400,'Amplie a área de vagueio para permitir movimento.');
        }
        points=generateWanderPoints(bounds,token.size,table,baseSeed,{x:token.x,y:token.y},10,area);
        if(points.length<2)fail(400,'A área desenhada é estreita demais ou bloqueada por paredes. Desenhe um espaço um pouco mais amplo.');
        token.x=points[0].x;token.y=points[0].y;
      }else{
        if(!Array.isArray(data.points)||data.points.length<2||data.points.length>48)fail(400,'Marque de 2 a 48 pontos e escolha o percurso.');
        points=data.points.map(p=>({x:requireRange(p?.x,0,table.grid.columns-token.size,'Posição X'),y:requireRange(p?.y,0,table.grid.rows-token.size,'Posição Y')}));
        if(!points.some(p=>p.x!==points[0].x||p.y!==points[0].y))fail(400,'Escolha dois lugares diferentes.');
      }
      const baseRoute={
        points,mode:data.mode,speed,started:now,offset:0,seed:baseSeed,
        ...(pause>0?{pause}:{}),
        ...(cooldown!==undefined?{cooldown}:{}),
        ...(bounds?{bounds}:{}),
        ...(area?{area}:{}),
        ...(data.mode==='idle'?{baseRotation:normalizeRotation(token.rotation)}:{}),
        ...(activity?{activity}:{}),
        ...(varyAppearance?{varyAppearance:true}:{})
      };
      token.patrol=baseRoute;
      if(data.color&&palette.has(data.color))token.color=data.color;
      if(data.icon&&tokenIconIds.has(data.icon))token.icon=data.icon;
      if((token.portrait||token.portraits?.length)&&(!data.icon||data.icon==='auto'))token.icon='auto';
      if(data.ambient===true&&!token.characterId&&token.kind!=='item'){token.ambient=true;token.vision={enabled:false,range:0,angle:360};}
      if(count>1){
        const cycleMs=Math.max(1000,patrolCycleDuration(baseRoute));
        const pool=Array.isArray(token.portraits)&&token.portraits.length?token.portraits:token.portrait?[token.portrait]:[];
        for(let i=1;i<count;i++){
          const copySeed=(baseSeed+i*7919)%999999;
          const copyPoints=data.mode==='wander'?generateWanderPoints(bounds,token.size,table,copySeed,null,10,area):points;
          const copyRoute={...baseRoute,points:copyPoints.length>=2?copyPoints:points,seed:copySeed,offset:Math.round(cycleMs*i/count)};
          const copyColor=ambientPalette[(ambientPalette.indexOf(token.color)+i)%ambientPalette.length];
          const copyPortrait=pool.length?pool[i%pool.length]:token.portrait;
          const originPoint=copyRoute.points[0];
          const copy=normalizeToken({
            id:uid(),name:token.name,color:copyColor,icon:copyPortrait?'auto':token.icon,size:token.size,
            x:originPoint.x,y:originPoint.y,hidden:token.hidden,locked:token.locked,rotation:token.rotation,
            ...(copyPortrait?{portrait:copyPortrait}:{}),
            ...(token.portraits?.length?{portraits:token.portraits}:{}),
            ambient:true,patrol:copyRoute
          },table.grid);
          state.tokens.push(copy);
        }
      }
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
    const trace=token.characterId&&table.exploration?.some(p=>p.bounds)?[token]:null;
    const moved=resolveTokenPath(token,{x,y},table,data.path,table.grid.snap,trace);
    if(table.fog.enabled&&table.fog.mode==='war'&&data.trail!==undefined&&playerVisionSource(state,token)){
      if(!Array.isArray(data.trail)||data.trail.length>64)fail(400,'Trajeto de exploração inválido.');
      let at=token;
      for(const sample of data.trail){
        const x=requireRange(sample?.x,0,table.grid.columns-token.size,'Posição X');
        const y=requireRange(sample?.y,0,table.grid.rows-token.size,'Posição Y');
        const rotation=requireRange(sample?.rotation,0,360,'Direção');
        at={...token,...resolveTokenPath(at,{x,y},table),rotation};
        recordExploration(table.fog,at,table.grid,table.walls);
      }
    }
    for(const region of table.exploration||[]){
      if(!region.bounds||!token.characterId)continue;
      const inside=p=>Math.abs(p.x+token.size/2-region.x)<=region.bounds.w/2&&Math.abs(p.y+token.size/2-region.y)<=region.bounds.h/2;
      const crosses=(a,b)=>{
        if(inside(a))return false;
        let enter=0,exit=1;
        for(const [axis,extent] of [['x',region.bounds.w],['y',region.bounds.h]]){
          const delta=b[axis]-a[axis],offset=a[axis]+token.size/2-region[axis];
          if(!delta){if(Math.abs(offset)>extent/2)return false;continue;}
          const t1=(-extent/2-offset)/delta,t2=(extent/2-offset)/delta;
          enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
        }
        return enter<=exit;
      };
      if(trace?.some((p,i)=>i>0&&crosses(trace[i-1],p)))region.lastEntry={id:uid(),name:token.name,at:Date.now()};
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
  if(data.removePortraitPool){delete token.portraits;delete token.portrait;}
  else if(data.removePortrait){
    const removedId=token.portrait?.id;
    delete token.portrait;
    if(removedId&&Array.isArray(token.portraits)){
      token.portraits=token.portraits.filter(p=>p.id!==removedId);
      if(token.portraits.length)token.portrait=token.portraits[0];else delete token.portraits;
    }
  }
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
    const activeTimers=(token.conditionSchedule||[]).filter(timer=>runningCondition(timer,table.combat));
    if(activeTimers.some(timer=>token.statuses.some(name=>name.toLowerCase()===timer.name.toLowerCase()))||activeTimers.length+token.statuses.length>6)fail(409,'Confira as condições temporárias e o limite de seis condições ativas.');

  }
  if(token.patrol&&(token.size!==originalSize||!eligibleForPatrol(state,token))){
    const {x,y}=patrolSample(token.patrol,Date.now());Object.assign(token,{x,y});delete token.patrol;
  }
  Object.assign(token,normalizeToken(token,table.grid));
}

function changeCombat(state,table,data) {
  if (!Array.isArray(data.entries) || data.entries.length>100) fail(400,'Use até 100 participantes.');
  const previous=table.combat;
  table.combat={...previous};
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
  // Ending or replacing an encounter clears its timers. Simple reordering
  // keeps clocks attached to their combatant instead of an array position.
  const sameEncounter=table.combat.entries.some(e=>previous.entries.some(old=>old.id===e.id));
  for(const token of state.tokens){
    if(!token.conditionSchedule)continue;
    if(!sameEncounter)delete token.conditionSchedule;
    else token.conditionSchedule=token.conditionSchedule.filter(timer=>timer.mode!=='turn'||table.combat.entries.some(e=>e.id===timer.entryId&&e.tokenId===token.id));
  }
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
    if(!['wall','door','window'].includes(data.kind))fail(400,'Tipo de barreira inválido.');
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
  else if (action==='tableSceneLife') {
    const now=Date.now();
    if(data.operation==='clearAmbient'){
      const removedIds=new Set(state.tokens.filter(t=>t.ambient).map(t=>t.id));
      state.tokens=state.tokens.filter(t=>!t.ambient);
      if(removedIds.size){
        const active=table.combat.entries[table.combat.active];
        table.combat.entries=table.combat.entries.filter(e=>!removedIds.has(e.tokenId));
        table.combat.active=Math.max(0,table.combat.entries.findIndex(e=>e.id===active?.id));
      }
    } else {
      if(!['pauseAll','resumeAll'].includes(data.operation))fail(400,'Operação de vida da cena inválida.');
      for(const token of state.tokens){
        if(!token.patrol||!eligibleForPatrol(state,token))continue;
        const {x,y,rotation}=patrolSample(token.patrol,now,token);Object.assign(token,{x,y,rotation});
        if(data.operation==='pauseAll'){if(token.patrol.started)token.patrol.offset+=Math.max(0,now-token.patrol.started);token.patrol.started=0;}
        else if(!token.patrol.started)token.patrol.started=now;
      }
    }
  }
  else if (action.startsWith('token')) changeToken(state,table,action,data,master);
  else if (action==='tablePing') {
    const now=Date.now();
    if(data.signal!==undefined&&(typeof data.signal!=='string'||!Object.hasOwn(pingNames,data.signal)))fail(400,'Sinal desconhecido.');
    table.pings=[...table.pings.filter(ping=>now-ping.at<1500),{
      id:uid(),...(actorCharacterId?{characterId:actorCharacterId}:{}),...(data.signal?{signal:data.signal}:{}),x:requireRange(data.x,0,table.grid.columns,'Posição X'),y:requireRange(data.y,0,table.grid.rows,'Posição Y'),at:now,name:clean(actorName,80)||'Participante'
    }].slice(-12);
  } else if (action==='tableDrawingAdd'||action==='tableEffect') {
    if(action==='tableEffect'&&(!['cone','burst','beam'].includes(data.kind)||!master&&!actorCharacterId))fail(403,'Área indisponível.');
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
