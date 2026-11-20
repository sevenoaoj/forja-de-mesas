import {startDiceScene,diceDuration} from './dice-scene.mjs';

export {createNarrationDisplay} from './narration.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function diceEffectsEnabled() {try{return localStorage.getItem('forja.diceEffects')!=='false';}catch{return true;}}
export function rollDiceList(roll) {
  const result=[];
  for(const group of roll.groups||[]) {
    const kept=group.kept?[...group.kept]:null;
    for(const value of group.dice) {
      const index=kept?.indexOf(value)??-1;
      result.push({faces:group.faces,value,sign:group.sign||1,selection:Boolean(group.kept),kept:!kept||index>=0});
      if(index>=0)kept.splice(index,1);
    }
  }
  if(!result.length)for(const value of roll.dice||[])result.push({faces:0,value,sign:1,kept:true});
  return result;
}
// Natural extremes are a visual cue, not an automatic adjudication of success.
export function rollHighlight(roll) {
  const dice=rollDiceList(roll).filter(die=>die.faces===20&&die.kept&&die.sign>0);
  if(dice.length!==1)return null;
  const value=dice[0].value;
  return value===20?{tone:'high',label:'20 natural · máximo do d20'}:value===1?{tone:'low',label:'1 natural · mínimo do d20'}:null;
}
export function rollBreakdown(roll) {
  const groups=(roll.groups||[]).map(g=>(g.sign<0?'−':'')+g.dice.length+'d'+g.faces+' ['+g.dice.join(', ')+']'+(g.kept?' → '+g.kept.join(', '):'')).join(' · ');
  return (groups||roll.dice?.join(', ')||'')+(roll.modifier?' · '+(roll.modifier>0?'+':'')+roll.modifier:'');
}
export function renderRollHistory(row) {
  const rolls=(row.state.rolls||[]).filter(roll=>row.master||roll.rolledBy==='player'&&roll.visibility==='public');
  const items=rolls.map(roll=>{
    const privateRoll=roll.visibility!=='public'||roll.rolledBy!=='player';
    const time=Number.isFinite(roll.at)?new Date(roll.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
    return '<li class="roll-feed-card'+(privateRoll?' is-private':'')+'" data-roll-id="'+esc(roll.id)+'"><div class="roll-feed-info"><div class="roll-feed-meta"><strong>'+esc(roll.actor)+'</strong><span class="roll-feed-privacy">'+(privateRoll?'Só mestre':'Mesa')+'</span>'+(time?'<time>'+esc(time)+'</time>':'')+'</div>'+(roll.label?'<h3>'+esc(roll.label)+'</h3>':'')+'<p>'+esc(roll.expression||roll.formula)+'</p><details><summary>Ver dados e cálculo</summary><p>'+esc(roll.formula)+' · '+esc(rollBreakdown(roll))+'</p>'+(roll.mastery?'<p>'+esc(roll.mastery.name)+' · '+esc(roll.mastery.die)+'</p>':'')+'</details></div><strong class="roll-feed-total">'+esc(roll.total)+'</strong></li>';
  }).join('');
  return '<div class="roll-feed-heading"><div><h2>Histórico de rolagens</h2><p>'+(row.master?'Suas rolagens são privadas. As dos jogadores são compartilhadas.':'Aqui aparecem as rolagens dos jogadores. As do mestre são privadas.')+'</p></div><label class="check"><input type="checkbox" data-dice-effects '+(diceEffectsEnabled()?'checked':'')+'> Animar dados</label></div>'+(items?'<ol class="roll-feed-list">'+items+'</ol>':'<p class="roll-feed-empty">As próximas rolagens aparecerão aqui.</p>');
}
function dieShape(faces) {
  const outlines={4:'50,5 96,88 4,88',6:'20,10 80,10 94,24 94,78 80,92 20,92 6,78 6,24',8:'50,3 92,50 50,97 8,50',10:'50,3 90,30 90,72 50,97 10,72 10,30',12:'50,3 83,14 97,46 80,88 20,88 3,46 17,14',20:'50,3 92,27 92,73 50,97 8,73 8,27',100:'50,3 92,28 92,73 50,97 8,73 8,28'};
  const facets=faces===4?'M50 5 50 62 4 88M50 62 96 88':faces===6?'M20 10 20 78 6 78M20 78 80 78 94 78M80 10 80 78 80 92':faces===8?'M8 50H92M50 3V97M8 50 50 25 92 50 50 75Z':'M50 6 77 71 23 71ZM9 28 50 21 91 28M9 73 23 71 50 95 77 71 91 73';
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="'+(outlines[faces]||outlines[20])+'"/><path d="'+facets+'"/></svg>';
}
export const rollAccent=roll=>/^#[a-f0-9]{6}$/i.test(roll.diceColor||'')?roll.diceColor:'#bd94ff';
export function rollPopupEligible(roll,row={}) {
  const initiative=roll.kind==='initiative'||roll.kind===undefined&&/^iniciativa$/i.test(roll.label?.trim()||'');
  if(!initiative)return true;
  return roll.rolledBy==='master'?Boolean(row.master):!row.master&&Boolean(row.characterId)&&roll.characterId===row.characterId;
}
export function renderDiceRoll(roll,limit=16) {
  const dice=rollDiceList(roll),visible=dice.slice(0,limit);
  return '<div class="dice-palette" style="--dice-accent:'+rollAccent(roll)+'"><div class="dice-show-heading"><div class="dice-show-identity"><strong class="dice-show-actor">'+esc(roll.actor)+'</strong><span class="dice-show-visibility">'+(roll.visibility==='public'&&roll.rolledBy==='player'?'Mesa':'Rolagem privada')+'</span></div><button type="button" class="dice-dismiss" data-dice-dismiss aria-label="Fechar resultado">×</button></div><p class="dice-show-label">'+esc(roll.label||roll.expression||roll.formula)+'</p><div class="dice-stage"><canvas data-dice-canvas hidden aria-hidden="true"></canvas><div class="dice-toss-area" data-dice-fallback aria-hidden="true">'+visible.map((die,index)=>'<div class="dice-throw" style="--die-delay:'+index*25+'ms;--die-turn:'+((index%2?1:-1)*(380+index*17))+'deg;--die-shift:'+((index%5-2)*27)+'px"><div class="animated-die'+(!die.kept?' is-discarded':'')+'">'+dieShape(die.faces)+'<span class="die-face">'+esc(die.value)+'</span><small>'+(die.sign<0?'− ':'')+(die.faces?'d'+die.faces:'dado')+'</small></div></div>').join('')+'</div></div>'+(dice.length>visible.length?'<p class="dice-extra">+'+(dice.length-visible.length)+' dados no histórico</p>':'')+'<p class="dice-show-result" data-dice-result role="status" aria-live="polite">Rolando dados…</p><p class="dice-natural" data-dice-natural hidden></p></div>';
}
export function createDiceDisplay(root,{schedule=setTimeout,cancel=clearTimeout,reducedMotion=()=>Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)}={}) {
  let identity='',revision=-1,seen=new Set(),queue=[],active=null,enabled=diceEffectsEnabled();
  let revealTimer,hideTimer,motion;
  const stop=()=>{motion?.dispose();motion=null;cancel(revealTimer);cancel(hideTimer);root.hidden=true;root.innerHTML='';root.classList.remove('is-rolling','is-settled','has-dice-scene','dice-high','dice-low');active=null;};
  function next() {
    if(active||!queue.length||!enabled)return;
    active=queue.shift();const roll=active;
    const limit=globalThis.matchMedia?.('(max-width: 520px), (max-height: 500px)').matches?6:16;
    root.innerHTML=renderDiceRoll(roll,limit);root.style?.setProperty('--dice-accent',rollAccent(roll));root.hidden=false;
    const reduced=reducedMotion(),dice=rollDiceList(roll).slice(0,limit),duration=diceDuration(dice.length);
    motion=startDiceScene(root.querySelector('[data-dice-canvas]'),dice,{seed:roll.id,color:rollAccent(roll),duration,reduced});
    if(motion){root.classList.add('has-dice-scene');const fallback=root.querySelector('[data-dice-fallback]');if(fallback)fallback.hidden=true;}
    root.classList.toggle('is-rolling',!reduced);root.classList.toggle('is-settled',reduced);
    const reveal=()=>{
      if(active!==roll)return;
      motion?.finish();
      root.classList.remove('is-rolling');root.classList.add('is-settled');
      const highlight=rollHighlight(roll),natural=root.querySelector('[data-dice-natural]');
      if(highlight){root.classList.add('dice-'+highlight.tone);if(natural){natural.textContent=highlight.label;natural.hidden=false;}}
      const result=root.querySelector('[data-dice-result]');
      if(result)result.textContent='Resultado: '+roll.total+(roll.modifier?' · modificador '+(roll.modifier>0?'+':'')+roll.modifier:'');
      hideTimer=schedule(()=>{stop();next();},queue.length?1600:3500);
    };
    if(reduced)reveal();else revealTimer=schedule(reveal,duration);
  }
  root.addEventListener('click',event=>{if(event.target.closest('[data-dice-dismiss]')){stop();next();}});
  return {
    sync(row) {
      const key=row.id?row.id+'/'+Boolean(row.master):'';
      if(key!==identity){stop();identity=key;revision=-1;seen=new Set();queue=[];}
      if(!key||!Array.isArray(row.state?.rolls)||row.rev<revision)return;
      const rolls=row.state.rolls.filter(roll=>row.master||roll.rolledBy==='player'&&roll.visibility==='public'),allowed=new Set(rolls.map(r=>r.id));
      if(active&&active.visibility!=='requested'&&!allowed.has(active.id))stop();
      queue=queue.filter(r=>r.visibility==='requested'||allowed.has(r.id));
      if(revision<0){seen=allowed;revision=row.rev;return;}
      revision=row.rev;
      for(const roll of [...rolls].reverse()) {
        if(seen.has(roll.id))continue;seen.add(roll.id);
        if(enabled&&rollPopupEligible(roll,row)&&!globalThis.document?.hidden)queue.push(roll);
      }
      queue=queue.slice(-8);
      if(seen.size>300)seen=new Set([...seen].slice(-150));
      next();
    },
    showRequested(roll){
      if(!enabled||seen.has(roll.id))return;
      seen.add(roll.id);queue.push(roll);next();
    },
    setEnabled(value) {enabled=Boolean(value);try{localStorage.setItem('forja.diceEffects',String(enabled));}catch{}if(!enabled){queue=[];stop();}},
    clear() {queue=[];stop();},
    get enabled(){return enabled;}
  };
}
