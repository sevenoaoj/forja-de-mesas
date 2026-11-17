import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiceDisplay,rollDiceList,renderDiceRoll,renderRollHistory,rollHighlight,rollAccent} from '../public/rolls.mjs';
function fixture(reduced=false) {
 const jobs=new Map(),nodes=new Map(),classes=new Set();let id=0,writes=0;
 const root={hidden:true,addEventListener(){},classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},toggle(name,on){if(on)classes.add(name);else classes.delete(name);}},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:''});return nodes.get(selector);}};
 let html='';Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;writes++;nodes.clear();}});
 const display=createDiceDisplay(root,{schedule:(fn,ms)=>{const key=++id;jobs.set(key,{fn,ms});return key;},cancel:key=>jobs.delete(key),reducedMotion:()=>reduced});
 const run=()=>{const [key,job]=jobs.entries().next().value;jobs.delete(key);job.fn();};
 return {root,display,classes,jobs,run,get writes(){return writes;}};
}
const roll=(id,total=9)=>({id,actor:'Jogador',formula:'2d6+2',total,modifier:2,visibility:'public',rolledBy:'player',groups:[{faces:6,sign:1,dice:[3,4]}]});
const row=(rev,rolls,master=false,id='room')=>({id,master,rev,state:{rolls}});
test('anima o resultado recebido uma vez, sem reproduzir o histórico ao entrar',()=>{
 const f=fixture(),old=roll('old'),fresh=roll('new');
 f.display.sync(row(1,[old]));assert.equal(f.root.hidden,true);
 f.display.sync(row(2,[fresh,old]));assert.equal(f.root.hidden,false);assert.ok(f.classes.has('is-rolling'));
 const writes=f.writes;f.display.sync(row(2,[fresh,old]));assert.equal(f.writes,writes);
 f.run();assert.equal(f.root.querySelector('[data-dice-result]').textContent,'Resultado: 9 · modificador +2');
 assert.ok(f.classes.has('is-settled'));assert.ok(!f.classes.has('is-rolling'));
 f.run();assert.equal(f.root.hidden,true);
 f.display.sync(row(1,[roll('stale')]));assert.equal(f.root.hidden,true);
});
test('filtra dados privados, limpa animação revogada e troca de papel sem deixar valores no DOM',()=>{
 const f=fixture();f.display.sync(row(1,[]));
 const privateRoll={...roll('private'),visibility:'gm',rolledBy:'master',actor:'Mestre'};
 f.display.sync(row(2,[privateRoll]));assert.equal(f.root.hidden,true);
 const publicRoll=roll('public');f.display.sync(row(3,[publicRoll]));assert.equal(f.root.hidden,false);
 f.display.sync(row(4,[]));assert.equal(f.root.hidden,true);assert.equal(f.jobs.size,0);assert.equal(f.root.innerHTML,'');
 f.display.sync(row(5,[privateRoll],true));f.display.sync(row(6,[{...privateRoll,id:'next-private'}],true));
 assert.equal(f.root.hidden,false);assert.ok(f.root.innerHTML.includes('Rolagem privada'));
 f.display.sync(row(6,[],false));assert.equal(f.root.hidden,true);assert.equal(f.root.innerHTML,'');
});
test('redução de movimento revela sem giro e desativação não acumula animações',()=>{
 const f=fixture(true);f.display.sync(row(1,[]));f.display.sync(row(2,[roll('one')]));
 assert.ok(!f.classes.has('is-rolling'));assert.match(f.root.querySelector('[data-dice-result]').textContent,/Resultado: 9/);
 f.display.setEnabled(false);assert.equal(f.root.hidden,true);
 f.display.sync(row(3,[roll('two'),roll('one')]));f.display.setEnabled(true);f.display.sync(row(3,[roll('two'),roll('one')]));
 assert.equal(f.root.hidden,true);
 f.display.sync(row(4,[roll('three'),roll('two'),roll('one')]));assert.equal(f.root.hidden,false);
 f.display.clear();
});
test('vantagem destaca só um dado aproveitado e dados personalizados preservam seus valores',()=>{
 const value={...roll('kept'),groups:[{faces:20,sign:1,dice:[18,18],kept:[18],keep:'kh1'},{faces:7,sign:-1,dice:[5]}]};
 assert.deepEqual(rollDiceList(value).map(d=>[d.value,d.kept,d.sign]),[[18,true,1],[18,false,1],[5,true,-1]]);
 const html=renderDiceRoll(value);assert.ok(html.includes('is-discarded'));assert.ok(html.includes('d7'));assert.ok(html.includes('>18</span>'));
 const huge={...roll('many'),groups:[{faces:6,sign:1,dice:Array(50).fill(1)}]};
 assert.equal((renderDiceRoll(huge).match(/class="dice-throw"/g)||[]).length,16);assert.ok(renderDiceRoll(huge).includes('+34 dados no histórico'));
});
test('histórico protege rolagens privadas e oferece cálculo detalhado com texto escapado',()=>{
 const publicRoll={...roll('public'),actor:'<Jogador>'},privateRoll={...roll('secret'),visibility:'gm',rolledBy:'master',actor:'Segredo'};
 const player=renderRollHistory(row(1,[privateRoll,publicRoll]));assert.ok(!player.includes('Segredo'));assert.ok(player.includes('&lt;Jogador&gt;'));assert.ok(player.includes('Ver dados e cálculo'));
 const master=renderRollHistory(row(1,[privateRoll,publicRoll],true));assert.ok(master.includes('Só mestre'));assert.ok(master.includes('Segredo'));
});

test('rolagens consecutivas entram em fila e não são repetidas na sincronização',()=>{
 const f=fixture();f.display.sync(row(1,[]));
 const first={...roll('first',11),actor:'Primeiro'},second={...roll('second',15),actor:'Segundo'};
 f.display.sync(row(2,[first]));f.display.sync(row(3,[second,first]));
 assert.ok(f.root.innerHTML.includes('Primeiro'));
 f.run();assert.match(f.root.querySelector('[data-dice-result]').textContent,/11/);
 f.run();assert.ok(f.root.innerHTML.includes('Segundo'));
 f.display.sync(row(3,[second,first]));
 f.run();assert.match(f.root.querySelector('[data-dice-result]').textContent,/15/);
 f.run();assert.equal(f.root.hidden,true);assert.equal(f.jobs.size,0);
});

test('extremos naturais consideram apenas o d20 aproveitado e ignoram total e modificador',()=>{
 const make=(dice,kept,sign=1)=>({...roll('extreme'),total:20,modifier:19,groups:[{faces:20,dice,...(kept?{kept}:{}),sign}]});
 assert.equal(rollHighlight(make([1])).tone,'low');
 assert.equal(rollHighlight(make([20])).tone,'high');
 assert.equal(rollHighlight(make([1,20],[20])).tone,'high');
 assert.equal(rollHighlight(make([1,20],[1])).tone,'low');
 assert.equal(rollHighlight(make([20,14],[14])),null);
 assert.equal(rollHighlight(make([1,14],[14])),null);
 assert.equal(rollHighlight(make([10])),null);
 assert.equal(rollHighlight(make([1,20])),null);
 assert.equal(rollHighlight(make([20],null,-1)),null);
 assert.equal(rollHighlight({...make([20]),groups:[{faces:6,dice:[6]}]}),null);
});
test('pulso aparece apenas na revelação e é removido ao fechar ou mudar de acesso',()=>{
 const f=fixture();f.display.sync(row(1,[]));
 const critical={...roll('natural20'),groups:[{faces:20,dice:[20]}]};
 f.display.sync(row(2,[critical]));assert.ok(!f.classes.has('dice-high'));
 f.run();assert.ok(f.classes.has('dice-high'));
 assert.equal(f.root.querySelector('[data-dice-natural]').textContent,'20 natural · máximo do d20');
 assert.equal(f.root.querySelector('[data-dice-natural]').hidden,false);
 f.run();assert.ok(!f.classes.has('dice-high'));
 const minimum={...roll('natural1'),groups:[{faces:20,dice:[1]}]};
 f.display.sync(row(3,[minimum,critical]));f.run();assert.ok(f.classes.has('dice-low'));
 f.display.sync(row(4,[],true));assert.ok(!f.classes.has('dice-low'));assert.equal(f.root.hidden,true);
});

test('dois jogadores e mestre mostram o mesmo popup público com a cor registrada',()=>{
 const displays=[fixture(),fixture(),fixture()];displays.forEach((f,i)=>f.display.sync(row(1,[],i===2)));
 const shared={...roll('shared'),characterId:'hero',diceColor:'#67e8f9',kind:'check'};
 displays.forEach((f,i)=>f.display.sync(row(2,[shared],i===2)));
 assert.ok(displays.every(f=>!f.root.hidden));assert.ok(displays.every(f=>f.root.innerHTML===displays[0].root.innerHTML));assert.ok(displays[0].root.innerHTML.includes('--dice-accent:#67e8f9'));
 displays.forEach(f=>f.display.clear());
});
test('iniciativa permanece no histórico sem popup nem interromper outro resultado',()=>{
 const f=fixture();f.display.sync(row(1,[]));const initiative={...roll('init'),kind:'initiative',label:'Iniciativa'};
 f.display.sync(row(2,[initiative]));assert.equal(f.root.hidden,true);assert.ok(renderRollHistory(row(2,[initiative])).includes('Iniciativa'));
 const normal=roll('normal');f.display.sync(row(3,[normal,initiative]));assert.equal(f.root.hidden,false);const writes=f.writes;
 f.display.sync(row(4,[{...initiative,id:'other'},normal,initiative]));assert.equal(f.writes,writes);f.run();f.run();assert.equal(f.root.hidden,true);
 assert.equal(rollAccent({...normal,diceColor:'red;display:none'}),'#bd94ff');
});

test('popup de iniciativa aparece apenas para o autor, sem repetição na sincronização',()=>{
 const owner=fixture(),other=fixture(),gm=fixture(),initiative={...roll('owner-init'),characterId:'hero',kind:'initiative',label:'Iniciativa'};
 const viewers=[{f:owner,master:false,characterId:'hero'},{f:other,master:false,characterId:'another'},{f:gm,master:true,characterId:null}];
 for(const {f,master,characterId} of viewers){f.display.sync({...row(1,[],master),characterId});f.display.sync({...row(2,[initiative],master),characterId});}
 assert.equal(owner.root.hidden,false);assert.ok(owner.root.innerHTML.includes('Iniciativa'));assert.equal(other.root.hidden,true);assert.equal(gm.root.hidden,true);
 const writes=owner.writes;owner.display.sync({...row(2,[initiative]),characterId:'hero'});assert.equal(owner.writes,writes);
 const privateInitiative={...initiative,id:'gm-init',characterId:'hero',rolledBy:'master',visibility:'gm'};
 gm.display.sync(row(3,[privateInitiative,initiative],true));assert.equal(gm.root.hidden,false);
 viewers.forEach(({f})=>f.display.clear());
});
