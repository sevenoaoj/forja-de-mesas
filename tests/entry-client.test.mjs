import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {api} from '../api.mjs';

class Element extends EventTarget {
  constructor(dataset={}) {super();this.dataset=dataset;this.nodes=new Map();this.innerHTML='';this.textContent='';this.open=false;this.style={setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}};this.clientWidth=800;this.clientHeight=500;this.classList={toggle(){},add(){},remove(){}};}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Element());return this.nodes.get(selector);}
  setAttribute(name,value){this[name]=value;}
  querySelectorAll(){return [];}
  contains(node){return Boolean(node?.inDialog);}
  closest(selector){return selector==='[data-act]'&&this.dataset.act?this:null;}
  focus(){document.activeElement=this;}
  getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
  matches(){return false;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  replaceChildren(){this.innerHTML='';}
}

test('convite abre escolha, seleção abre só ficha própria e ocultação revoga a tela',async()=>{
  const rows=new Map(),assets=new Map();
  let portraitDownloads=0;
  const store={
    async putAsset(key,blob){assets.set(key,blob);},
    async getAsset(key){portraitDownloads++;return assets.get(key);},
    async deleteAsset(key){assets.delete(key);},
    async remove(row){if(rows.get(row.id)?.rev!==row.rev)return false;rows.delete(row.id);return true;},
    async deleteCampaignAssets(id){for(const key of assets.keys())if(key.startsWith(id+'/'))assets.delete(key);},
    async get(id){return structuredClone(rows.get(id));},
    async create(row){rows.set(row.id,structuredClone(row));},
    async save(row){rows.set(row.id,structuredClone({...row,rev:row.rev+1}));return true;}
  };
  const call=(path,method,key,body)=>api(new Request('http://app/api/campaigns'+path,{
    method,headers:key?{Authorization:'Bearer '+key}:{},body:body?JSON.stringify(body):undefined
  }),store);
  const master=await (await call('','POST',null,{name:'Mesa real',example:true})).json();
  const documentNode=new Element();
  const storage=new Map(),intervals=new Map(),networkCalls=[];
  const originalFetch=globalThis.fetch,originalInterval=globalThis.setInterval;
  const originalTimeout=globalThis.setTimeout;
  const originalFormData=globalThis.FormData;
  globalThis.document=documentNode;
  document.hidden=false;
  globalThis.location={origin:'http://192.168.0.211:3000',hostname:'192.168.0.211',pathname:'/',search:'',hash:'#mesa='+master.id+'.'+master.invite};
  globalThis.history={replaceState(){location.hash='';}};
  globalThis.window={scrollTo(){},YT:{Player:class {destroy(){}}}};
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  globalThis.setInterval=(fn,ms)=>intervals.set(ms,fn);
  globalThis.setTimeout=(fn,ms)=>{const timer=originalTimeout(fn,ms);timer.unref();return timer;};
  globalThis.fetch=(url,options={})=>{networkCalls.push({url:String(url),method:options.method||'GET'});return api(new Request(new URL(url,location.origin),options),store);};
  globalThis.FormData=class {constructor(form){this.values=form.values;}getAll(name){const value=this.values[name];return value===undefined?[]:Array.isArray(value)?value:[value];}get(name){return this.getAll(name)[0]??null;}[Symbol.iterator](){return Object.entries(this.values).flatMap(([key,value])=>Array.isArray(value)?value.map(item=>[key,item]):[[key,value]])[Symbol.iterator]();}};
  const moduleURL=source=>{
    const resolved=source.replace(/from\s+(['"])(\.{1,2}\/[^'"]+\.mjs)\1/g,(match,quote,path)=>{
      const local=new URL('../public/'+path,import.meta.url);
      return 'from '+JSON.stringify((existsSync(local)?local:new URL('../'+path,import.meta.url)).href);
    });
    return 'data:text/javascript;base64,'+Buffer.from(resolved+'\n//# sourceURL=entry-module.mjs').toString('base64');
  };
  let receiveLive;globalThis.__captureForjaLive=options=>receiveLive=options.onEvent;
  const liveModule=moduleURL("import {createTableLive as real} from "+JSON.stringify(new URL('../public/table-live.mjs',import.meta.url).href)+";export function createTableLive(options){globalThis.__captureForjaLive(options);return real(options);}");
  const code=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
  const audio=moduleURL((await readFile(new URL('../public/audio.mjs',import.meta.url),'utf8')).replace("'./media.mjs'",JSON.stringify(new URL('../media.mjs',import.meta.url).href)));
  const table=moduleURL((await readFile(new URL('../public/table.mjs',import.meta.url),'utf8')).replace("'./loot.mjs'",JSON.stringify(new URL('../public/loot.mjs',import.meta.url).href)).replace("'./table-vision.mjs'",JSON.stringify(new URL('../public/table-vision.mjs',import.meta.url).href)).replace("'./token-icons.mjs'",JSON.stringify(new URL('../token-icons.mjs',import.meta.url).href)).replace("'./table-rolls.mjs'",JSON.stringify(new URL('../public/table-rolls.mjs',import.meta.url).href)).replace("'./rolls.mjs'",JSON.stringify(new URL('../public/rolls.mjs',import.meta.url).href)).replace("'./table-model.mjs'",JSON.stringify(new URL('../table-model.mjs',import.meta.url).href)).replace("'./model.mjs'",JSON.stringify(new URL('../model.mjs',import.meta.url).href)));
  const dndUI=moduleURL((await readFile(new URL('../public/dnd-ui.mjs',import.meta.url),'utf8')).replace("'./model.mjs'",JSON.stringify(new URL('../model.mjs',import.meta.url).href)).replace("'./dnd.mjs'",JSON.stringify(new URL('../dnd.mjs',import.meta.url).href)));
  const app=code.replace("'./loot.mjs'",JSON.stringify(new URL('../public/loot.mjs',import.meta.url).href)).replace("'./sheet-resources.mjs'",JSON.stringify(new URL('../public/sheet-resources.mjs',import.meta.url).href)).replace("'./inventory.mjs'",JSON.stringify(new URL('../public/inventory.mjs',import.meta.url).href)).replace("'./soundboard.mjs'",JSON.stringify(new URL('../public/soundboard.mjs',import.meta.url).href)).replace("'./soundboard-model.mjs'",JSON.stringify(new URL('../soundboard-model.mjs',import.meta.url).href)).replace("'./player-access.mjs'",JSON.stringify(new URL('../public/player-access.mjs',import.meta.url).href)).replace("'./narration.mjs'",JSON.stringify(new URL('../public/narration.mjs',import.meta.url).href)).replace("'./sheet-inline.mjs'",JSON.stringify(new URL('../public/sheet-inline.mjs',import.meta.url).href)).replace("'./scenes.mjs'",JSON.stringify(new URL('../public/scenes.mjs',import.meta.url).href)).replace("'./token-editor.mjs'",JSON.stringify(new URL('../public/token-editor.mjs',import.meta.url).href)).replace("'./table-live.mjs'",JSON.stringify(liveModule)).replace("'./sheet-mosaic.mjs'",JSON.stringify(new URL('../public/sheet-mosaic.mjs',import.meta.url).href)).replace("'./gm-screen.mjs'",JSON.stringify(new URL('../public/gm-screen.mjs',import.meta.url).href)).replace("'./rolls.mjs'",JSON.stringify(new URL('../public/rolls.mjs',import.meta.url).href)).replace("'./dnd.mjs'",JSON.stringify(new URL('../dnd.mjs',import.meta.url).href)).replace("'./dnd-ui.mjs'",JSON.stringify(dndUI)).replace("'./model.mjs'",JSON.stringify(new URL('../model.mjs',import.meta.url).href))
    .replace("'./media.mjs'",JSON.stringify(new URL('../media.mjs',import.meta.url).href))
    .replace("'./journal.mjs'",JSON.stringify(new URL('../public/journal.mjs',import.meta.url).href))
    .replace("'./sheet-templates.mjs'",JSON.stringify(new URL('../public/sheet-templates.mjs',import.meta.url).href))
    .replace("'./sheet-history-controller.mjs'",JSON.stringify(new URL('../public/sheet-history-controller.mjs',import.meta.url).href))
    .replace("'./audio.mjs'",JSON.stringify(audio)).replace("'./music.mjs'",JSON.stringify(new URL('../public/music.mjs',import.meta.url).href)).replace("'./table.mjs'",JSON.stringify(table))
    .replace("'./table-model.mjs'",JSON.stringify(new URL('../table-model.mjs',import.meta.url).href));
  const main=document.querySelector('#main');
  const dispatch=(type,target,extra={})=>{
    const event=new Event(type,{cancelable:true});
    Object.defineProperties(event,{target:{value:target},...Object.fromEntries(Object.entries(extra).map(([key,value])=>[key,{value}]))});
    document.dispatchEvent(event);
  };
  const waitFor=async predicate=>{
    const deadline=Date.now()+2500;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>originalTimeout(resolve,2));}
    assert.ok(predicate(),document.querySelector('#notice').textContent||document.querySelector('#dialog-notice').textContent||'A tela esperada não abriu.');
  };
  try {
    const fetchCampaign=globalThis.fetch;
    let interrupt;
    globalThis.fetch=(url,options)=>String(url).endsWith('/session')
      ?new Promise((_resolve,reject)=>{interrupt=()=>reject(new TypeError('NetworkError'));})
      :fetchCampaign(url,options);
    await import(moduleURL(app));
    await waitFor(()=>Boolean(interrupt));
    assert.ok(main.innerHTML.includes('Entrando na campanha'));assert.ok(!main.innerHTML.includes('Nova campanha'));
    interrupt();await waitFor(()=>main.innerHTML.includes('Tentar novamente'));
    assert.ok(location.hash.startsWith('#mesa='));assert.ok(!main.innerHTML.includes('Nova campanha'));
    globalThis.fetch=fetchCampaign;
    const campaignBeforeJoin=rows.get(master.id),exampleCharacters=campaignBeforeJoin.state.characters;
    campaignBeforeJoin.state.characters=[];
    dispatch('click',new Element({act:'entryRetry'}));
    await waitFor(()=>main.innerHTML.includes('Escolha seu personagem'));
    assert.ok(main.innerHTML.includes('Crie seu personagem para começar'));assert.ok(!main.innerHTML.includes('vinculada ao acesso anterior'));
    assert.equal(location.hash,'');
    const audioIndicator=document.querySelector('#audio-controls').querySelector('[data-audio-panel-toggle]');
    assert.match(audioIndicator.title,/silenciado/);
    dispatch('click',new Element({act:'character'}));
    assert.match(audioIndicator.title,/silenciado/);document.querySelector('#dialog').close();
    const afterJoin=rows.get(master.id);afterJoin.state.characters=exampleCharacters;afterJoin.rev++;
    await intervals.get(2500)();
    assert.ok(!main.innerHTML.includes('1d20'));
    dispatch('click',new Element({act:'characterClaim',id:'lyra'}));
    await waitFor(()=>main.innerHTML.includes('<h1>Lyra Vesper</h1>'));
    assert.match(audioIndicator.title,/silenciado/);
    assert.ok(main.innerHTML.includes('Percepção'));assert.match(main.innerHTML,/>Rolar [+-]\d+</);
    receiveLive({type:'scene',id:master.id,rev:rows.get(master.id).rev,rollVersion:'public-live',state:{rolls:[{id:'another-player-roll',actor:'Outra jogadora',formula:'1d20',total:12,modifier:0,groups:[{faces:20,dice:[12]}],rolledBy:'player',visibility:'public',kind:'check',diceColor:'#34d399'}]}});
    const popup=document.querySelector('#dice-display');assert.equal(popup.hidden,false);assert.ok(popup.innerHTML.includes('Outra jogadora'));assert.ok(popup.innerHTML.includes('--dice-accent:#34d399'));assert.ok(main.innerHTML.includes('Percepção'));
    const dismiss=new Event('click');Object.defineProperty(dismiss,'target',{value:{closest:()=>true}});popup.dispatchEvent(dismiss);

    // Loot is collected through the actual player form and reveals the private card once.
    await call('/'+master.id+'/action','POST',master.key,{action:'itemSave',data:{name:'Medalhão encontrado',kind:'quest',description:'A inscrição secreta do portador.',gmNotes:'Plano oculto do mestre',weight:1}});
    const preparedItem=rows.get(master.id).state.inventory[0];
    await call('/'+master.id+'/action','POST',master.key,{action:'lootPlace',data:{itemId:preparedItem.id,version:preparedItem.version,quantity:1,x:5,y:4,revealed:true}});
    await intervals.get(2500)();
    const groundItem=rows.get(master.id).state.tokens.find(t=>t.kind==='item');
    dispatch('click',new Element({act:'nav',id:'table'}));
    dispatch('click',new Element({act:'lootOpen',id:groundItem.id}));assert.ok(document.querySelector('#dialog-content').innerHTML.includes('Coletar item'));assert.ok(!document.querySelector('#dialog-content').innerHTML.includes('A inscrição secreta'));
    const collection=new Element({form:'lootCollect'});collection.inDialog=true;collection.values={id:groundItem.id,version:'1',sceneId:'scene-initial'};
    // A newer table snapshot can win the race against the collection response.
    const collectFetch=globalThis.fetch;
    globalThis.fetch=async(url,options={})=>{const response=await collectFetch(url,options);if(options.body&&typeof options.body==='string'&&JSON.parse(options.body).action==='lootCollect'){await call('/'+master.id+'/action','POST',master.key,{action:'tokenMove',data:{id:'mira',x:10,y:7}});await intervals.get(2500)();}return response;};
    dispatch('submit',collection,{submitter:new Element()});
    await waitFor(()=>document.querySelector('#dialog').dataset.lootReward==='true');globalThis.fetch=collectFetch;
    assert.ok(document.querySelector('#dialog-content').innerHTML.includes('A inscrição secreta do portador.'));assert.ok(!document.querySelector('#dialog-content').innerHTML.includes('Plano oculto do mestre'));
    assert.equal(rows.get(master.id).state.tokens.some(t=>t.id===groundItem.id),false);assert.equal(rows.get(master.id).state.inventory.filter(i=>i.characterId==='lyra').length,1);
    document.querySelector('#dialog').close();dispatch('click',new Element({act:'character',id:'lyra'}));

    assert.ok(!main.innerHTML.includes('Dorian Vale'));
    await call('/'+master.id+'/action','POST',master.key,{action:'characterVisibility',data:{id:'lyra',hidden:true}});
    await intervals.get(2500)();
    assert.ok(main.innerHTML.includes('Escolha seu personagem'));
    assert.ok(!main.innerHTML.includes('Lyra Vesper'));
    dispatch('click',new Element({act:'character'}));
    const form=new Element({form:'character'});
    form.inDialog=true;
    form.values={id:'',name:'Heroína nova',concept:'Barda',color:'jade','value-f1':'4','value-f4-now':'12','value-f4-max':'12'};
    dispatch('submit',form,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('<h1>Heroína nova</h1>'));
    assert.ok(main.innerHTML.includes('data-sheet-inline'));
    assert.ok(!main.innerHTML.includes('data-act="sheetMode"'));
    assert.ok(main.innerHTML.includes('Adicionar atributo'));
    assert.ok(main.innerHTML.includes('Adicionar recurso'));
    const hero=rows.get(master.id).state.characters.find(c=>c.name==='Heroína nova');
    const mana={id:'local-'+'5'.repeat(32),label:'Mana',type:'counter',group:'Recursos',initial:'8/8'};
    const structure=rows.get(master.id).state.fields.filter(field=>field.id!=='f2').concat(mana);
    dispatch('click',new Element({act:'sheetFields'}));
    const layoutForm=new Element({form:'sheetFields'});layoutForm.inDialog=true;layoutForm.values={id:hero.id};
    layoutForm.querySelectorAll=selector=>selector!=='[data-field]'?[]:structure.map(field=>{
      const node=new Element({field:field.id});
      node.querySelector=selector=>({value:field[/name=([^\]]+)/.exec(selector)[1]]});
      return node;
    });
    dispatch('submit',layoutForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('>Mana</strong>'));
    assert.ok(!main.innerHTML.includes('>Agilidade</span>'));
    assert.ok(main.innerHTML.includes('>Vitalidade</strong>'));
    dispatch('click',new Element({act:'sheetResource',id:mana.id}));
    const resourceForm=new Element({form:'sheetResource'});resourceForm.inDialog=true;
    resourceForm.values={field:mana.id,current:'3',maximum:'12'};
    dispatch('submit',resourceForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('3 / 12'));
    assert.ok(main.innerHTML.includes('12 / 12'));
    dispatch('click',new Element({act:'sheetRollEdit'}));
    const savedForm=new Element({form:'savedRoll'});savedForm.inDialog=true;
    savedForm.values={entry:'',name:'Ataque da barda',formula:'2d6 + Força'};
    dispatch('submit',savedForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('Ataque da barda'));
    const savedRoll=rows.get(master.id).state.characters.find(c=>c.id===hero.id).rollButtons[0];
    dispatch('click',new Element({act:'sheetSavedRoll',id:savedRoll.id}));
    await waitFor(()=>rows.get(master.id).state.rolls[0]?.label==='Ataque da barda');
    assert.equal(rows.get(master.id).state.rolls[0].formula,'2d6+4');
    assert.ok(document.querySelector('#dice-display').innerHTML.includes('Mesa'));
    assert.ok(!document.querySelector('#dice-display').innerHTML.includes('Rolagem privada'));
    const valuesBeforeAppearance=structuredClone(rows.get(master.id).state.characters.find(c=>c.id===hero.id).values);
    dispatch('click',new Element({act:'sheetLayoutBegin'}));assert.ok(main.innerHTML.includes('Organizando sua ficha'));assert.ok(main.innerHTML.includes('data-sheet-drag="portrait"'));
    const photoModule=new Element({mosaicVisible:'portrait'});photoModule.checked=false;photoModule.matches=selector=>selector==='[data-mosaic-visible]';
    const photoChange=new Event('change');Object.defineProperty(photoChange,'target',{value:photoModule});main.dispatchEvent(photoChange);
    assert.ok(!main.innerHTML.includes('data-sheet-leaf="portrait"'));
    const accentOption=new Element({mosaicOption:'accent'});accentOption.value='#ffcc00';accentOption.matches=selector=>selector==='[data-mosaic-option]';
    const accentChange=new Event('change');Object.defineProperty(accentChange,'target',{value:accentOption});main.dispatchEvent(accentChange);
    dispatch('click',new Element({act:'sheetLayoutSave'}));
    await waitFor(()=>rows.get(master.id).state.characters.find(c=>c.id===hero.id).appearance?.version===1);
    assert.ok(main.innerHTML.includes('sheet-mosaic'));assert.ok(!main.innerHTML.includes('Organizando sua ficha'));
    assert.deepEqual(rows.get(master.id).state.characters.find(c=>c.id===hero.id).values,valuesBeforeAppearance);
    dispatch('click',new Element({act:'sheetReadingView',id:'standard'}));assert.ok(main.innerHTML.includes('sheet-stage'));assert.ok(main.innerHTML.includes('sheet-portrait'));assert.ok(!main.innerHTML.includes('data-sheet-leaf='));
    dispatch('click',new Element({act:'sheetReadingView',id:'custom'}));assert.ok(main.innerHTML.includes('data-sheet-leaf="identity"'));assert.ok(!main.innerHTML.includes('data-sheet-leaf="portrait"'));

    dispatch('click',new Element({act:'sheetLayoutBegin'}));
    const diceModule=new Element({mosaicVisible:'dice'});diceModule.checked=false;diceModule.matches=selector=>selector==='[data-mosaic-visible]';const diceChange=new Event('change');Object.defineProperty(diceChange,'target',{value:diceModule});main.dispatchEvent(diceChange);
    dispatch('click',new Element({act:'sheetLayoutSave'}));await waitFor(()=>rows.get(master.id).state.characters.find(c=>c.id===hero.id).appearance.version===2);
    assert.ok(!main.innerHTML.includes('data-sheet-formula'));
    dispatch('click',new Element({act:'sheetSkill'}));const modularSkillForm=new Element({form:'sheetEntry'});modularSkillForm.inDialog=true;modularSkillForm.values={category:'skills',entry:'',name:'Teste modular',attribute:'f1',base:'0',bonus:'1',other:'0',favorite:'true'};
    dispatch('submit',modularSkillForm,{submitter:new Element()});await waitFor(()=>rows.get(master.id).state.characters.find(c=>c.id===hero.id).skills?.some(skill=>skill.name==='Teste modular'));
    const modularSkill=rows.get(master.id).state.characters.find(c=>c.id===hero.id).skills.find(skill=>skill.name==='Teste modular');
    dispatch('click',new Element({act:'sheetSkillRoll',id:modularSkill.id}));await waitFor(()=>rows.get(master.id).state.rolls[0]?.label==='Perícia · Teste modular');assert.equal(rows.get(master.id).state.rolls[0].formula,'1d20+4+1');
    const bookmarks=JSON.parse(storage.get('forja.campaigns'));bookmarks[master.id]={id:master.id,key:master.key,name:'Mesa real',master:true};storage.set('forja.campaigns',JSON.stringify(bookmarks));
    dispatch('click',new Element({act:'switch',id:master.id}));await waitFor(()=>main.innerHTML.includes('<h1>Mesa real</h1>'));
    dispatch('click',new Element({act:'lootPlace',id:preparedItem.id}));assert.ok(document.querySelector('#dialog-content').innerHTML.includes('Colocar item na mesa'));
    const placeItemForm=new Element({form:'lootPlace'});placeItemForm.inDialog=true;placeItemForm.values={sceneId:'scene-initial',itemId:preparedItem.id,quantity:'2',x:'6',y:'4',name:'Um achado'};placeItemForm.elements={itemId:{selectedOptions:[{dataset:{version:String(preparedItem.version)}}]}};
    dispatch('submit',placeItemForm,{submitter:new Element()});await waitFor(()=>rows.get(master.id).state.tokens.some(t=>t.kind==='item'&&t.name==='Um achado'));
    const masterDrop=rows.get(master.id).state.tokens.find(t=>t.kind==='item');assert.equal(masterDrop.hidden,true);assert.equal(masterDrop.loot.quantity,2);

    dispatch('click',new Element({act:'character',id:hero.id}));assert.ok(main.innerHTML.includes('Visualização padronizada'));assert.ok(!main.innerHTML.includes('data-sheet-leaf='));
    dispatch('click',new Element({act:'gmResourceEdit'}));
    const resourceDialog=document.querySelector('#dialog'),privateForm=new Element({form:'gmResourceSave'});
    privateForm.inDialog=true;privateForm.values={id:hero.id,name:'Fôlego',color:'#bb4499',current:'50',maximum:'10'};
    const currentAmount=new Element(),error=privateForm.querySelector('#resource-form-error');
    privateForm.elements={namedItem:key=>key==='current'?currentAmount:null};
    const postCount=networkCalls.length;
    dispatch('submit',privateForm,{submitter:new Element()});
    assert.equal(networkCalls.length,postCount);assert.ok(resourceDialog.open);
    assert.equal(document.activeElement,currentAmount);assert.equal(currentAmount['aria-describedby'],'resource-form-error');
    assert.equal(currentAmount['aria-invalid'],'true');assert.match(error.textContent,/Atual.*Máximo.*10/);
    privateForm.values.current='2';dispatch('submit',privateForm,{submitter:new Element()});
    await waitFor(()=>rows.get(master.id).state.gmResources?.[hero.id]?.length===1&&!resourceDialog.open);
    assert.equal(error.hidden,true);
    const privateId=rows.get(master.id).state.gmResources[hero.id][0].id;
    const decrement=new Element({act:'gmResourceStep',id:privateId,step:'-1'});
    const increment=new Element({act:'gmResourceStep',id:privateId,step:'1'});
    const queryAll=main.querySelectorAll;
    main.querySelectorAll=function(selector){
      if(selector!=='[data-act=gmResourceStep]')return queryAll.call(this,selector);
      decrement.disabled=rows.get(master.id).state.gmResources[hero.id][0].current===0;
      return [decrement,increment];
    };
    dispatch('click',decrement);await waitFor(()=>document.activeElement===decrement);
    dispatch('click',decrement);await waitFor(()=>document.activeElement===increment);
    assert.equal(rows.get(master.id).state.gmResources[hero.id][0].current,0);
    main.querySelectorAll=queryAll;
    dispatch('click',new Element({act:'sheetReadingView',id:'custom'}));assert.ok(main.innerHTML.includes('data-sheet-leaf="identity"'));assert.ok(!main.innerHTML.includes('data-sheet-leaf="portrait"'));assert.equal(rows.get(master.id).state.characters.find(c=>c.id===hero.id).appearance.version,2);
    dispatch('click',new Element({act:'sheetReadingView',id:'standard'}));
    dispatch('click',new Element({act:'create'}));
    const campaignForm=new Element({form:'create'});
    campaignForm.inDialog=true;campaignForm.values={name:'Mesa sonora'};
    dispatch('submit',campaignForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('<h1>Mesa sonora</h1>'));
    dispatch('click',new Element({act:'nav',id:'audio'}));
    assert.ok(main.innerHTML.includes('Criar sessão'));
    dispatch('click',new Element({act:'musicSessionNew'}));
    const sessionForm=new Element({form:'musicSession'});
    sessionForm.inDialog=true;sessionForm.values={id:'',name:'Sessão preparada'};
    dispatch('submit',sessionForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('Sessão preparada'));
    const campaign=[...rows.values()].find(row=>row.state.name==='Mesa sonora');
    const session=campaign.state.audio.music.sessions[0];
    dispatch('click',new Element({act:'musicTrackNew',id:session.id}));
    const musicForm=new Element({form:'musicTrack'});
    musicForm.inDialog=true;
    musicForm.values={sessionId:session.id,id:'',url:'https://youtu.be/M7lc1UVf-VE',title:'Escolha do mestre',tag:'Etiqueta livre'};
    dispatch('submit',musicForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('Escolha do mestre'));
    const prepared=rows.get(campaign.id).state.audio;
    assert.equal(prepared.track,null);
    dispatch('click',new Element({act:'musicTrackPlay',id:session.id+'/'+prepared.music.sessions[0].tracks[0].id}));
    await waitFor(()=>Boolean(rows.get(campaign.id).state.audio.track?.source));
    assert.equal(rows.get(campaign.id).state.audio.track.title,'Escolha do mestre');
    dispatch('click',new Element({act:'nav',id:'sheets'}));
    dispatch('click',new Element({act:'character'}));
    assert.ok(document.querySelector('#dialog-content').innerHTML.includes('Os Herdeiros do Destino'));
    const preset=new Element();preset.value='herdeiros-destino';preset.matches=selector=>selector==='[data-character-preset]';
    const changed=new Event('change');Object.defineProperty(changed,'target',{value:preset});document.querySelector('#dialog').dispatchEvent(changed);
    assert.ok(document.querySelector('#dialog-content').innerHTML.includes('value-hd-power'));
    const heirForm=new Element({form:'character'});heirForm.inDialog=true;
    heirForm.values={id:'',preset:'herdeiros-destino',name:'Anuki',concept:'Dobrador de água',presentation:'narrative',color:'rose','value-hd-age':'22','value-hd-power':'2','value-hd-cunning':'0','value-hd-essence':'1','value-hd-bending':'Água (sangue)','value-hd-story':'Uma história longa.\nCom parágrafos e descobertas.'};
    dispatch('submit',heirForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('<h1>Anuki</h1>'));
    assert.ok(main.innerHTML.includes('sheet-stage theme-rose'));
    assert.ok(!main.innerHTML.includes('sheet-document'));
    assert.ok(!main.innerHTML.includes('Documento narrativo'));
    assert.ok(main.innerHTML.includes('>Idade</span>'));
    assert.ok(main.innerHTML.includes('>Dobra</strong>'));
    assert.ok(main.innerHTML.includes('>Equipamentos</h3>'));
    assert.ok(main.innerHTML.includes('>Anotações</h3>'));
    assert.ok(main.innerHTML.includes('Teste de Essência'));
    assert.ok(main.innerHTML.includes('Maestria em Essência'));
    assert.ok(main.innerHTML.includes('Uma história longa.\nCom parágrafos e descobertas.'));
    {
    const heir=rows.get(campaign.id).state.characters.find(c=>c.name==='Anuki'),before=structuredClone(heir);
    assert.ok(main.innerHTML.includes('data-act="sheetHistory"'));
    dispatch('click',new Element({act:'sheetTemplateSave',id:heir.id}));
    const templateForm=new Element({form:'sheetTemplateSave'});templateForm.inDialog=true;templateForm.values={characterId:heir.id,name:'Herdeiros reutilizável',description:'Estrutura da sessão',shared:'on',includeAppearance:'on'};
    dispatch('submit',templateForm,{submitter:new Element()});await waitFor(()=>rows.get(campaign.id).state.sheetTemplates?.items.length===1);await new Promise(resolve=>setImmediate(resolve));
    const template=rows.get(campaign.id).state.sheetTemplates.items[0];assert.ok(!JSON.stringify(template).includes('Uma história longa.'));
    dispatch('click',new Element({act:'sheetTemplates'}));assert.ok(document.querySelector('#dialog-content').innerHTML.includes('Herdeiros reutilizável'));
    dispatch('click',new Element({act:'sheetTemplateApply',id:template.id}));
    const applyForm=new Element({form:'sheetTemplateApply'});applyForm.inDialog=true;applyForm.values={templateId:template.id,expectedVersion:String(template.version),characterId:heir.id,confirm:'on'};applyForm.elements={characterId:{selectedOptions:[{dataset:{historyVersion:String(heir.sheetHistory?.version||0)}}]}};
    dispatch('submit',applyForm,{submitter:new Element()});await waitFor(()=>rows.get(campaign.id).state.characters.find(c=>c.id===heir.id).sheetHistory?.version===1);await new Promise(resolve=>setImmediate(resolve));
    const changed=rows.get(campaign.id).state.characters.find(c=>c.id===heir.id),entry=changed.sheetHistory.entries[0];assert.equal(changed.values['hd-story'],'');assert.equal(changed.values['hd-essence'],'0');
    dispatch('click',new Element({act:'sheetHistory',id:heir.id}));assert.ok(document.querySelector('#dialog-content').innerHTML.includes('class="sheet-history" open'));
    dispatch('click',new Element({act:'sheetHistoryRestore',id:heir.id,entry:entry.id}));assert.ok(document.querySelector('#dialog-content').innerHTML.includes('name="expectedVersion" value="1"'));
    const restoreForm=new Element({form:'sheetHistoryRestore'});restoreForm.inDialog=true;restoreForm.values={id:heir.id,entryId:entry.id,expectedVersion:'1'};
    dispatch('submit',restoreForm,{submitter:new Element()});await waitFor(()=>rows.get(campaign.id).state.characters.find(c=>c.id===heir.id).sheetHistory.version===2);await new Promise(resolve=>setImmediate(resolve));
    const restored=rows.get(campaign.id).state.characters.find(c=>c.id===heir.id);assert.deepEqual(restored.values,before.values);assert.equal(restored.hidden,before.hidden);assert.ok(main.innerHTML.includes('Uma história longa.'));
    dispatch('click',new Element({act:'nav',id:'journal'}));assert.ok(main.innerHTML.includes('Diário da campanha'));
    dispatch('click',new Element({act:'journalEdit'}));const journalForm=new Element({form:'journal'});journalForm.inDialog=true;journalForm.values={id:'',version:'0',title:'Inscrição antiga',kind:'clue',body:'A chave está no rio',gmNotes:'Armadilha secreta',audience:'private',status:'active',recipientIds:[]};
    dispatch('submit',journalForm,{submitter:new Element()});await waitFor(()=>rows.get(campaign.id).state.journal?.length===1);await new Promise(resolve=>setImmediate(resolve));
    const journal=rows.get(campaign.id).state.journal[0];assert.ok(main.innerHTML.includes('Só mestre'));assert.equal(journal.audience,'private');
    dispatch('click',new Element({act:'journalShow',id:journal.id}));await waitFor(()=>rows.get(campaign.id).state.journal[0].audience==='all');await new Promise(resolve=>setImmediate(resolve));assert.ok(main.innerHTML.includes('Visível para todos'));
    dispatch('click',new Element({act:'journalHide',id:journal.id}));await waitFor(()=>rows.get(campaign.id).state.journal[0].audience==='private');await new Promise(resolve=>setImmediate(resolve));
    dispatch('click',new Element({act:'nav',id:'sheets'}));dispatch('click',new Element({act:'character',id:heir.id}));
    }
    const masterySelect=new Element();masterySelect.value='hd-mastery';masterySelect.matches=selector=>selector==='[data-sheet-mastery]';
    const selected=new Event('change');Object.defineProperty(selected,'target',{value:masterySelect});main.dispatchEvent(selected);
    dispatch('click',new Element({act:'sheetSavedRoll',id:'hd-test-essence'}));
    await waitFor(()=>rows.get(campaign.id).state.rolls[0]?.mastery?.die==='1d4');
    assert.ok(main.innerHTML.includes('Usada nesta sessão'));
    assert.equal(rows.get(campaign.id).state.rolls[0].formula,'2d6+1+1d4');
    const anuki=rows.get(campaign.id).state.characters.find(c=>c.name==='Anuki');
    const portraitResponse=await api(new Request('http://app/api/campaigns/'+campaign.id+'/portrait',{
      method:'POST',headers:{Authorization:'Bearer '+rows.get(campaign.id).owner,'Content-Type':'image/png','X-Character-Id':anuki.id,'X-File-Name':'portrait.png'},body:new Uint8Array([137,80,78,71])
    }),store);
    assert.equal(portraitResponse.status,201);
    const withPortrait=await portraitResponse.json();
    const portraitId=withPortrait.state.characters.find(c=>c.id===anuki.id).portrait.id;
    await intervals.get(2500)();
    let pictures=[new Element({portrait:portraitId})];pictures[0].hidden=true;
    main.querySelectorAll=selector=>selector==='[data-portrait]'?pictures:[];
    main.contains=node=>pictures.includes(node);
    dispatch('click',new Element({act:'nav',id:'sheets'}));
    assert.ok(main.innerHTML.includes('data-portrait="'+portraitId+'"'));
    assert.ok(!main.innerHTML.includes('<h1>Anuki</h1>'));
    await waitFor(()=>Boolean(pictures[0].src));
    assert.equal(pictures[0].hidden,true);
    pictures[0].onload();
    assert.equal(pictures[0].hidden,false);
    const imageURL=pictures[0].src;
    pictures=[new Element({portrait:portraitId})];
    dispatch('click',new Element({act:'nav',id:'home'}));
    await waitFor(()=>Boolean(pictures[0].src));
    assert.equal(pictures[0].src,imageURL);
    assert.equal(portraitDownloads,1);
    dispatch('click',new Element({act:'campaignDelete',id:campaign.id}));
    await waitFor(()=>document.querySelector('#dialog-content').innerHTML.includes('Apagar definitivamente'));
    const deleteForm=new Element({form:'campaignDelete'});deleteForm.inDialog=true;deleteForm.values={id:campaign.id,name:'Mesa sonora'};
    dispatch('submit',deleteForm,{submitter:new Element()});
    await waitFor(()=>!rows.has(campaign.id));
    assert.ok(main.innerHTML.includes('<h1>Suas campanhas</h1>'));
    assert.ok(!main.innerHTML.includes('Ecos do Crepúsculo'));
    assert.ok(!main.innerHTML.includes('Mesa sonora'));
    assert.equal([...assets.keys()].filter(key=>key.startsWith(campaign.id+'/')).length,0);
    dispatch('click',new Element({act:'create'}));
    const dndCampaignForm=new Element({form:'create'});dndCampaignForm.inDialog=true;dndCampaignForm.values={name:'Mesa D&D',ruleset:'dnd-2024'};
    dispatch('submit',dndCampaignForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('<h1>Mesa D&amp;D</h1>'));
    dispatch('click',new Element({act:'character'}));
    assert.ok(document.querySelector('#dialog-content').innerHTML.includes('Criar personagem D&D 2024'));
    const dndForm=new Element({form:'dndCreate'});dndForm.inDialog=true;
    dndForm.values={name:'Maga do grupo',color:'blue'};
    const dndValues={classId:'wizard',speciesId:'dwarf',backgroundId:'sage',scoreMethod:'array',boost2:'int',boost1:'wis',weapon:'quarterstaff','score-str':'8','score-dex':'12','score-con':'13','score-int':'15','score-wis':'14','score-cha':'10'};
    dndForm.querySelector=selector=>{const name=/name="?([^"\]]+)/.exec(selector)?.[1];return {value:dndValues[name]};};
    dndForm.querySelectorAll=selector=>selector==='[data-dnd-skill]:checked'?[{value:'insight'},{value:'investigation'}]:[];
    dispatch('submit',dndForm,{submitter:new Element()});
    await waitFor(()=>main.innerHTML.includes('<h1>Maga do grupo</h1>'));
    assert.ok(main.innerHTML.includes('Mod. +3'));
    assert.ok(main.innerHTML.includes('Teste de Inteligência'));
    const dndRoom=[...rows.values()].find(r=>r.state.name==='Mesa D&D'),mage=dndRoom.state.characters[0];
    dispatch('click',new Element({act:'dndAdd',id:mage.id+'/spell-fire-bolt'}));
    await waitFor(()=>rows.get(dndRoom.id).state.characters[0].rollButtons.some(r=>r.id==='spell-fire-bolt-attack'));
    const mode=new Element();mode.value='advantage';mode.matches=selector=>selector==='[data-sheet-roll-mode]';
    const modeChange=new Event('change');Object.defineProperty(modeChange,'target',{value:mode});main.dispatchEvent(modeChange);
    dispatch('click',new Element({act:'sheetSavedRoll',id:'spell-fire-bolt-attack'}));
    await waitFor(()=>rows.get(dndRoom.id).state.rolls[0]?.formula==='2d20kh1+5');
    assert.ok(document.querySelector('#dice-display').innerHTML.includes('Rolagem privada'));
    dispatch('click',new Element({act:'nav',id:'shield'}));
    assert.ok(main.innerHTML.includes('Fichas à mão'));assert.ok(main.innerHTML.includes('Maga do grupo'));
    dispatch('click',new Element({act:'gmCardEdit'}));
    assert.ok(document.querySelector('#dialog-content').innerHTML.includes('Novo cartão privado'));
    const cardForm=new Element({form:'gmCard'});cardForm.inDialog=true;
    cardForm.values={id:'',version:'0',title:'Plano secreto',kind:'checklist',category:'session',body:'[ ] Encontrar a pista',target:'',page:'1'};
    dispatch('submit',cardForm,{submitter:new Element()});
    await waitFor(()=>rows.get(dndRoom.id).state.gmScreen?.cards.length===1);
    assert.ok(main.innerHTML.includes('Plano secreto'));
    const card=rows.get(dndRoom.id).state.gmScreen.cards[0],task=new Element({gmTask:card.id,gmItem:card.items[0].id});task.checked=true;task.matches=selector=>selector==='[data-gm-task]';
    dispatch('change',task);await waitFor(()=>rows.get(dndRoom.id).state.gmScreen.cards[0].items[0].done);
    const draft=new Element();draft.value='Não perder ao navegar';draft.matches=selector=>selector==='[data-gm-notes]';
    dispatch('input',draft);dispatch('click',new Element({act:'nav',id:'table'}));dispatch('click',new Element({act:'nav',id:'shield'}));
    assert.ok(main.innerHTML.includes('Não perder ao navegar'));
    const noteForm=new Element({form:'notes'});noteForm.values={text:'Notas salvas'};
    dispatch('submit',noteForm,{submitter:new Element()});await waitFor(()=>rows.get(dndRoom.id).state.notes==='Notas salvas');
    assert.ok(main.innerHTML.includes('Notas salvas'));assert.ok(!main.innerHTML.includes('Não perder ao navegar'));
    dispatch('click',new Element({act:'tableTokenAdd'}));const tokenMarkup=document.querySelector('#dialog-content').innerHTML;
    assert.ok(tokenMarkup.includes('token-color-grid'));assert.ok(tokenMarkup.includes('token-icon-grid'));assert.ok(!tokenMarkup.includes('<select name="color"'));
    const tokenForm=new Element({form:'tableToken'});tokenForm.inDialog=true;tokenForm.values={id:'',name:'Guardião',color:'cyan',icon:'shield',size:'1',characterId:mage.id,statuses:''};
    dispatch('submit',tokenForm,{submitter:new Element()});await waitFor(()=>rows.get(dndRoom.id).state.tokens.some(t=>t.name==='Guardião'&&t.icon==='shield'&&t.color==='cyan'));await new Promise(resolve=>setImmediate(resolve));
    const token=rows.get(dndRoom.id).state.tokens.find(t=>t.name==='Guardião');dispatch('click',new Element({act:'tableTokenEdit',id:token.id}));
    assert.ok(document.querySelector('#dialog-content').innerHTML.includes('name="icon" value="shield" checked'));assert.ok(document.querySelector('#dialog-content').innerHTML.includes('name="color" value="cyan" checked'));
    {
    document.querySelector('#dialog').close();dispatch('click',new Element({act:'nav',id:'table'}));assert.ok(main.innerHTML.includes('Cenas e sessões'));
    dispatch('click',new Element({act:'scenesToggle'}));assert.ok(main.innerHTML.includes('Nova sessão'));
    dispatch('click',new Element({act:'sessionEdit'}));const sceneSessionForm=new Element({form:'sessionEditor'});sceneSessionForm.inDialog=true;
    sceneSessionForm.values={id:'',expectedVersion:'0',name:'Sessão das ruínas',date:'2026-11-15',notes:'Plano secreto'};dispatch('submit',sceneSessionForm,{submitter:new Element()});
    await waitFor(()=>rows.get(dndRoom.id).state.sceneLibrary?.sessions.some(s=>s.name==='Sessão das ruínas'));await new Promise(resolve=>setImmediate(resolve));
    const sceneSession=rows.get(dndRoom.id).state.sceneLibrary.sessions.find(s=>s.name==='Sessão das ruínas');dispatch('click',new Element({act:'sceneNew'}));
    const sceneForm=new Element({form:'sceneEditor'});sceneForm.inDialog=true;sceneForm.values={id:'',expectedVersion:String(rows.get(dndRoom.id).state.sceneLibrary.version),name:'Torre secreta',sessionId:sceneSession.id,notes:'Dragão no telhado'};
    dispatch('submit',sceneForm,{submitter:new Element()});await waitFor(()=>main.innerHTML.includes('Preparação privada · jogadores continuam em'));
    const prepared=rows.get(dndRoom.id).state.sceneLibrary.scenes.find(s=>s.name==='Torre secreta');assert.ok(prepared);assert.equal(rows.get(dndRoom.id).state.sceneLibrary.activeId,'scene-initial');
    dispatch('click',new Element({act:'sceneActivate',id:prepared.id}));await waitFor(()=>rows.get(dndRoom.id).state.sceneLibrary.activeId===prepared.id);await waitFor(()=>main.innerHTML.includes('Você e os jogadores estão nesta cena.'));
    dispatch('click',new Element({act:'sceneView',id:'scene-initial'}));await waitFor(()=>main.innerHTML.includes('Preparação privada · jogadores continuam em Torre secreta'));
    assert.ok(main.innerHTML.includes('Guardião'));assert.equal(rows.get(dndRoom.id).state.tokens.length,0);
    document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));
    await call('/'+dndRoom.id+'/action','POST',rows.get(dndRoom.id).owner,{action:'tokenUpdate',data:{sceneId:'scene-initial',id:token.id,color:'red'}});
    const beforeResume=networkCalls.length;document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(()=>networkCalls.slice(beforeResume).some(c=>c.method==='GET'&&c.url.includes('/'+dndRoom.id+'?scene=scene-initial')));await new Promise(resolve=>setImmediate(resolve));
    dispatch('click',new Element({act:'tableTokenEdit',id:token.id}));assert.ok(document.querySelector('#dialog-content').innerHTML.includes('name="color" value="red" checked'));

    }
    // A temporarily empty/wrong server must never erase the browser's access keys.
    document.querySelector('#dialog').close();
    const savedAccess=storage.get('forja.campaigns'),savedActive=storage.get('forja.active');
    const healthyFetch=globalThis.fetch;
    globalThis.fetch=async()=>Response.json({error:'Campanha indisponível.'},{status:403});
    await intervals.get(2500)();
    assert.equal(storage.get('forja.campaigns'),savedAccess);assert.equal(storage.get('forja.active'),savedActive);
    assert.ok(main.innerHTML.includes('Recuperar acesso'));
    globalThis.fetch=healthyFetch;
    await intervals.get(2500)();
    assert.ok(main.innerHTML.includes('Cenas e sessões'));
    dispatch('click',new Element({act:'campaignRecover'}));
    const recovery=new Element({form:'campaignRecover'});recovery.inDialog=true;recovery.values={code:dndRoom.id+'.'+dndRoom.owner};
    dispatch('submit',recovery);await waitFor(()=>main.innerHTML.includes('Cenas e sessões'));
    assert.ok(JSON.parse(storage.get('forja.campaigns'))[dndRoom.id].master);
    // Full backup works through the UI, even when the original server row is gone.
    dispatch('click',new Element({act:'campaignAccess'}));
    assert.ok(document.querySelector('#dialog-content').innerHTML.includes('Baixar backup completo'));
    let downloaded;const originalObjectURL=URL.createObjectURL;
    const originalCreateElement=document.createElement,originalBody=document.body;
    URL.createObjectURL=blob=>{downloaded=blob;return 'blob:backup-test';};
    document.createElement=()=>({click(){},remove(){}});document.body={append(){}};
    try{dispatch('click',new Element({act:'campaignBackup'}));await waitFor(()=>downloaded instanceof Blob);}finally{URL.createObjectURL=originalObjectURL;document.createElement=originalCreateElement;document.body=originalBody;}
    document.querySelector('#dialog').close();
    rows.delete(dndRoom.id);await intervals.get(2500)();
    assert.ok(main.innerHTML.includes('Voltar às campanhas'));
    dispatch('click',new Element({act:'entryCancel'}));
    assert.ok(main.innerHTML.includes('Importar backup'));
    dispatch('click',new Element({act:'campaignImport'}));
    assert.ok(document.querySelector('#dialog-content').innerHTML.includes('sem substituir nenhuma existente'));
    const importForm=new Element({form:'campaignImport'});importForm.inDialog=true;importForm.values={};importForm.elements={file:{files:[downloaded]}};
    dispatch('submit',importForm,{submitter:new Element()});
    await waitFor(()=>[...rows.values()].some(r=>r.state.name==='Mesa D&D'&&r.id!==dndRoom.id));
    const restored=[...rows.values()].find(r=>r.state.name==='Mesa D&D');
    await waitFor(()=>JSON.parse(storage.get('forja.campaigns'))[restored.id]?.master);
    assert.equal(storage.get('forja.active'),JSON.stringify(restored.id));
    assert.equal(restored.state.sceneLibrary.scenes.length,2);
    assert.equal(restored.state.characters[0].name,mage.name);
    // The floating soundboard broadcasts from a non-audio page and preparation stays per session.
    dispatch('click',new Element({act:'nav',id:'sheets'}));
    const floating=document.querySelector('#master-soundboard');assert.equal(floating.hidden,false);
    assert.ok(floating.querySelector('[data-sound-dock-body]').innerHTML.includes('soundPlay'));
    dispatch('click',new Element({act:'soundPlay',id:'bell'}));await waitFor(()=>rows.get(restored.id).state.audio?.cues?.some(c=>c.sound==='bell'));
    assert.ok(main.innerHTML.includes('Fichas universais'));
    dispatch('click',new Element({act:'soundboardOpen'}));assert.ok(main.innerHTML.includes('data-act="soundboardTab"'));
    dispatch('click',new Element({act:'soundboardTab',id:'packs'}));assert.ok(main.innerHTML.includes('kenney-rpg'));assert.ok(main.innerHTML.includes('Baixar e ativar'));
    dispatch('click',new Element({act:'soundboardSessionNew'}));const soundSession=new Element({form:'soundboardSession'});soundSession.inDialog=true;soundSession.values={name:'Caverna preparada'};
    dispatch('submit',soundSession,{submitter:new Element()});await waitFor(()=>rows.get(restored.id).state.audio?.soundboard?.sessions.some(s=>s.name==='Caverna preparada'));
    assert.ok(!document.querySelector('#master-soundboard').querySelector('[data-sound-dock-body]').innerHTML.includes('data-act="soundPlay"'));

    // Confirmação modal para ações destrutivas da mesa sem toast prematuro.
    dispatch('click',new Element({act:'nav',id:'table'}));
    await call('/'+restored.id+'/action','POST',rows.get(restored.id).owner,{action:'tableDrawingAdd',data:{kind:'line',x:1,y:1,toX:3,toY:3,color:'#bd9afc'}});
    await intervals.get(2500)();
    assert.equal(rows.get(restored.id).state.table.drawings.length,1);
    const clearButton=new Element({tableAction:'tableDrawingClear'});
    clearButton.closest=selector=>selector==='[data-table-action]'?clearButton:null;
    const clickClear=()=>{const e=new Event('click',{cancelable:true});Object.defineProperty(e,'target',{value:clearButton});main.dispatchEvent(e);};
    clickClear();
    assert.equal(document.querySelector('#dialog').open,true);
    assert.match(document.querySelector('#dialog-content').innerHTML,/Limpar todos os desenhos\?/);
    dispatch('click',new Element({act:'close'}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(document.querySelector('#dialog').open,false);
    assert.equal(rows.get(restored.id).state.table.drawings.length,1);
    clickClear();
    document.querySelector('#notice').textContent='';
    const confirmForm=new Element({form:'tableConfirm'});confirmForm.inDialog=true;
    dispatch('submit',confirmForm,{submitter:new Element()});
    await waitFor(()=>rows.get(restored.id).state.table.drawings.length===0);
    assert.equal(document.querySelector('#dialog').open,false);
    assert.equal(document.querySelector('#notice').textContent,'');

    // Regressão: evento 'close' assíncrono atrasado de <dialog> da confirmação #1 não liquida confirmação #2 aberta em microtask.
    {
      const dialogNode=document.querySelector('#dialog');
      const originalClose=dialogNode.close;
      dialogNode.close=function(){
        this.open=false;
        originalTimeout(()=>this.dispatchEvent(new Event('close')),0);
      };
      try {
        await call('/'+restored.id+'/action','POST',rows.get(restored.id).owner,{action:'tableDrawingAdd',data:{kind:'line',x:2,y:2,toX:4,toY:4,color:'#bd9afc'}});
        await call('/'+restored.id+'/action','POST',rows.get(restored.id).owner,{action:'tableFog',data:{enabled:true,operation:'reveal',x:0,y:0,width:1,height:1}});
        await intervals.get(2500)();
        assert.equal(rows.get(restored.id).state.table.drawings.length,1);
        assert.equal(rows.get(restored.id).state.table.fog.revealed.length,1);
        const fogResetButton=new Element({tableAction:'fogReset'});
        fogResetButton.closest=selector=>selector==='[data-table-action]'?fogResetButton:null;
        const clickFogReset=()=>{const e=new Event('click',{cancelable:true});Object.defineProperty(e,'target',{value:fogResetButton});main.dispatchEvent(e);};
        const originalFetchForRace=globalThis.fetch;
        let chained=false,fogResetCalls=0;
        globalThis.fetch=(url,options={})=>{
          if(options.body&&typeof options.body==='string'){
            const parsed=JSON.parse(options.body);
            if(parsed.action==='tableDrawingClear'){chained=true;clickFogReset();}
            if(parsed.action==='tableFog'&&parsed.data?.operation==='reset')fogResetCalls++;
          }
          return originalFetchForRace(url,options);
        };
        try {
          clickClear();
          assert.equal(dialogNode.open,true);
          const firstConfirm=new Element({form:'tableConfirm'});firstConfirm.inDialog=true;
          dispatch('submit',firstConfirm,{submitter:new Element()});
          await waitFor(()=>chained);
          assert.equal(dialogNode.open,true);
          assert.match(document.querySelector('#dialog-content').innerHTML,/Cobrir todo o mapa\?/);
          await new Promise(resolve=>originalTimeout(resolve,25));
          assert.equal(dialogNode.open,true);
          assert.equal(fogResetCalls,0);
          const secondConfirm=new Element({form:'tableConfirm'});secondConfirm.inDialog=true;
          dispatch('submit',secondConfirm,{submitter:new Element()});
          await waitFor(()=>fogResetCalls===1);
          await waitFor(()=>rows.get(restored.id).state.table.fog.revealed.length===0);
          await new Promise(resolve=>originalTimeout(resolve,25));
          assert.equal(dialogNode.open,false);

          // Fechamento nativo (ex.: Esc -> dialog.close()) quando dialog.open === false liquida confirmação pendente via 'close'.
          clickFogReset();
          assert.equal(dialogNode.open,true);
          dialogNode.close();
          await new Promise(resolve=>originalTimeout(resolve,25));
          assert.equal(dialogNode.open,false);
          const strayConfirm=new Element({form:'tableConfirm'});strayConfirm.inDialog=true;
          dispatch('submit',strayConfirm,{submitter:new Element()});
          await new Promise(resolve=>originalTimeout(resolve,25));
          assert.equal(fogResetCalls,1);
        } finally {
          globalThis.fetch=originalFetchForRace;
        }
      } finally {
        dialogNode.close=originalClose;
      }
    }

    // Polling periódico é pausado em aba oculta e retomado imediatamente ao voltar à visibilidade.
    document.hidden=true;
    const hiddenCalls=networkCalls.length;
    await intervals.get(2500)();
    await intervals.get(400)();
    assert.equal(networkCalls.length,hiddenCalls);
    await new Promise(resolve=>originalTimeout(resolve,270));
    document.hidden=false;
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(()=>networkCalls.slice(hiddenCalls).some(c=>c.method==='GET'&&c.url.includes('/'+restored.id+'/sync'))&&networkCalls.slice(hiddenCalls).some(c=>c.method==='GET'&&c.url.includes('/'+restored.id)&&!c.url.includes('/sync')));

  } finally {
    delete globalThis.__captureForjaLive;
    globalThis.fetch=originalFetch;globalThis.setInterval=originalInterval;globalThis.setTimeout=originalTimeout;
    globalThis.FormData=originalFormData;
  }
});
