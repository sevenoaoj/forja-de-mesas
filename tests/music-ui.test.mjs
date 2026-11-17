import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusicLibrary,renderMusic,createMusicDock,renderMusicDockLibrary,createAudioPopover} from '../public/music.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ui={
  esc,
  button:(label,action,style,icon,id)=>'<button data-act="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>',
  input:(name,label,value,type,extra)=>'<label>'+label+'<input name="'+name+'" value="'+esc(value)+'" '+extra+'></label>',
  select:(name,label,options,value)=>'<label>'+label+'<select name="'+name+'">'+Object.entries(options).map(([key,text])=>'<option value="'+esc(key)+'" '+(key===value?'selected':'')+'>'+esc(text)+'</option>').join('')+'</select></label>'
};
const row={
  id:'room',master:true,serverTime:5000,
  state:{audio:{track:null,music:{sessions:[{id:'session',name:'Sessão do mestre',tracks:[
    {id:'one',video:'M7lc1UVf-VE',title:'Águas distantes',tag:'Calma'},
    {id:'two',video:'bHQqvYy5KYo',title:'Escolha <privada>',tag:'Segredo'}
  ]}],activeSessionId:'session',fadeIn:3,fadeOut:3,volume:70}}}
};

class Element extends EventTarget {
  constructor(dataset={}){super();this.dataset=dataset;this.hidden=false;this.innerHTML='';this.textContent='';}
  matches(selector){return selector==='[data-music-search-input]'&&this.dataset.input||selector==='[data-music-tag-filter]'&&this.dataset.tag;}
}
function root() {
  const nodes=new Map();
  const container=new Element();
  const rows=[
    new Element({musicSearch:'aguas distantes calma',musicTagValue:'Calma'}),
    new Element({musicSearch:'escolha <privada> segredo',musicTagValue:'Segredo'})
  ];
  container.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector);};
  container.querySelectorAll=selector=>selector==='[data-music-row]'?rows:[];
  function dispatch(type,dataset,value) {
    const target=new Element(dataset);target.value=value;
    const event=new Event(type);
    Object.defineProperty(event,'target',{value:target});
    container.dispatchEvent(event);
  }
  return {container,rows,nodes,dispatch};
}

test('biblioteca vazia orienta cadastro manual e o jogador recebe apenas a faixa atual',()=>{
  const empty=renderMusic({id:'room',master:true,state:{audio:{}}},ui);
  assert.ok(empty.includes('Criar sessão'));
  assert.ok(!empty.includes('musicTrackPlay'));
  const master=renderMusic(row,ui);
  assert.ok(master.includes('data-act="musicTrackPlay"'));
  assert.ok(master.includes('Escolha &lt;privada&gt;'));
  const player=renderMusic({...row,master:false},ui);
  assert.ok(!player.includes('Sessão do mestre'));
  assert.ok(!player.includes('privada'));
  assert.ok(!player.includes('musicSessionNew'));
  assert.ok(!player.includes('musicSettings'));
  const active=structuredClone(row);
  active.master=false;
  active.state.audio.track={video:'M7lc1UVf-VE',title:'Nome secreto',playing:true,position:0,changed:1000,commandId:'play'};
  const playing=renderMusic(active,ui);
  assert.ok(playing.includes('Trilha da mesa'));
  assert.ok(!playing.includes('Nome secreto'));
});

test('busca sem acentos e filtro persistem por sessão após atualização',()=>{
  const library=createMusicLibrary();
  const f=root();
  library.render(row,ui);library.mount(f.container,row);
  f.dispatch('input',{input:true},'ÁGUAS');
  assert.equal(f.rows[0].hidden,false);
  assert.equal(f.rows[1].hidden,true);
  library.dispose();
  const rendered=library.render(row,ui);
  assert.ok(rendered.includes('value="ÁGUAS"'));
  library.mount(f.container,row);
  assert.equal(f.rows[1].hidden,true);
  f.dispatch('input',{input:true},'');
  f.dispatch('change',{tag:true},'Segredo');
  assert.equal(f.rows[0].hidden,true);
  assert.equal(f.rows[1].hidden,false);
  library.dispose();
  const changed=structuredClone(row);
  changed.state.audio.music.sessions[0].tracks.pop();
  library.render(changed,ui);library.mount(f.container,changed);
  assert.equal(f.rows[0].hidden,false);
  library.dispose();
});


test('playlist compacta filtra faixas, marca a atual e fica reservada ao mestre',()=>{
  const current=structuredClone(row);
  current.state.audio.track={video:'bHQqvYy5KYo',title:'Escolha <privada>',playing:true,changed:1000,source:{sessionId:'session',itemId:'two'}};
  const html=renderMusicDockLibrary(current,ui,'segredo');
  assert.ok(html.includes('Escolha &lt;privada&gt;'));
  assert.ok(!html.includes('Águas distantes'));
  assert.ok(html.includes('aria-current="true"'));
  assert.ok(html.includes('Reiniciar'));
  assert.ok(html.includes('data-id="session/two"'));
  assert.equal(renderMusicDockLibrary({...current,master:false},ui),'');
  assert.ok(renderMusicDockLibrary(row,ui,'aguas').includes('Águas distantes'));
});

test('painel permanece aberto e preserva sessão, busca e volume durante sincronizações parciais',()=>{
  const originalDocument=globalThis.document;
  globalThis.document={activeElement:null};
  const nodes=new Map();
  const root=new Element();
  root.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector);};
  root.querySelector('.music-dock-panel').scrollTop=45;
  const search=root.querySelector('[data-playlist-search]');
  const volume=root.querySelector('[data-playlist-volume]');
  const library=root.querySelector('[data-playlist-library]');
  const current=structuredClone(row);
  current.rev=1;
  current.state.audio.music.sessions.push({id:'second',name:'Segunda sessão',tracks:[{id:'three',title:'Ação escolhida',video:'M7lc1UVf-VE',tag:'Combate'}]});
  current.state.audio.music.activeSessionId='second';
  const dock=createMusicDock(root,ui);
  try {
    dock.sync(current);root.open=true;
    assert.ok(library.innerHTML.includes('Ação escolhida'));
    search.value='COMBATE';
    const event=new Event('input');Object.defineProperty(event,'target',{value:search});root.dispatchEvent(event);
    document.activeElement=volume;volume.value='25';
    dock.sync({...current,rev:2,state:{audio:{track:null,music:{volume:60,fadeIn:4,fadeOut:2}}}});
    assert.equal(root.open,true);
    assert.equal(search.value,'COMBATE');
    assert.ok(library.innerHTML.includes('Ação escolhida'));
    assert.ok(!library.innerHTML.includes('Águas distantes'));
    assert.equal(root.querySelector('.music-dock-panel').scrollTop,45);
    assert.equal(volume.value,'25');
    document.activeElement=null;
    dock.sync({...current,rev:2,state:{audio:{track:null,music:{volume:60}}}});
    assert.equal(volume.value,60);
    dock.sync({...current,id:'another',rev:1,state:{audio:{music:{volume:70}}}});
    assert.equal(root.open,false);
    assert.ok(!library.innerHTML.includes('Ação escolhida'));
    dock.sync({...current,master:false});
    assert.equal(root.hidden,true);
    assert.equal(library.innerHTML,'');
    assert.equal(root.querySelector('[data-playlist-now]').innerHTML,'');
  } finally {globalThis.document=originalDocument;}
});

test('repetição aparece nos controles apenas para o mestre e identifica faixas preparadas',()=>{
 const active=structuredClone(row);active.state.audio.track={video:'M7lc1UVf-VE',title:'Trilha',loop:true,playing:true,changed:1000,position:0};active.state.audio.music.sessions[0].tracks[0].loop=true;
 const html=renderMusic(active,ui);assert.ok(html.includes('Repetir: ativado'));assert.ok(html.includes('aria-pressed="true"'));assert.ok(html.includes('↻ Repetir'));
 const audience=renderMusic({...active,master:false},ui);assert.ok(!audience.includes('musicLoop'));assert.ok(!audience.includes('Repetir:'));
});
test('botão de áudio abre e fecha opções, preserva abertura no sync e limpa ao trocar de campanha ou papel',()=>{
 const root=new EventTarget(),doc=new EventTarget(),panel={hidden:false},playlist={open:true};
 const trigger={attributes:{},setAttribute(name,value){this.attributes[name]=value;},focus(){this.focused=true;}};
 const target=selector=>({closest:value=>value===selector});
 root.querySelector=selector=>selector==='[data-audio-panel]'?panel:selector==='[data-audio-panel-toggle]'?trigger:playlist;
 root.contains=node=>node===trigger||node.inside;
 const fire=(where,type,node,extra={})=>{const event=new Event(type,{cancelable:true});Object.defineProperties(event,{target:{value:node},...Object.fromEntries(Object.entries(extra).map(([k,v])=>[k,{value:v}]))});where.dispatchEvent(event);};
 const popover=createAudioPopover(root,{document:doc});assert.equal(panel.hidden,true);assert.equal(popover.open,false);
 popover.sync(row);fire(root,'click',target('[data-audio-panel-toggle]'));assert.equal(popover.open,true);assert.equal(trigger.attributes['aria-expanded'],'true');
 popover.sync({...row,rev:2});assert.equal(popover.open,true);
 fire(doc,'click',{inside:true});assert.equal(popover.open,true);
 fire(doc,'click',{});assert.equal(popover.open,false);
 fire(root,'click',target('[data-audio-panel-toggle]'));fire(doc,'keydown',{}, {key:'Escape'});assert.equal(popover.open,false);assert.equal(trigger.focused,true);
 fire(root,'click',target('[data-audio-panel-toggle]'));popover.sync({...row,id:'another'});assert.equal(popover.open,false);assert.equal(playlist.open,false);
 fire(root,'click',target('[data-audio-panel-toggle]'));popover.sync({...row,id:'another',master:false});assert.equal(popover.open,false);
 fire(root,'click',target('[data-audio-panel-toggle]'));fire(root,'click',target('[data-audio-panel-close]'));assert.equal(popover.open,false);
});
