import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTokenAppearance,updateTokenAppearance} from '../public/token-editor.mjs';
import {tokenIcons,tokenIconIds,tokenIconSvg} from '../token-icons.mjs';
import {colors} from '../model.mjs';
test('paleta exibe todas as amostras e galeria usa vetores com nomes acessíveis',()=>{
 const html=renderTokenAppearance({name:'<Heroína>',color:'cyan',icon:'shield'});
 assert.equal((html.match(/name="color"/g)||[]).length,colors.length);assert.equal((html.match(/name="icon"/g)||[]).length,32);
 assert.match(html,/name="color" value="cyan" checked/);assert.match(html,/name="icon" value="shield" checked/);assert.ok(html.includes('&lt;Heroína&gt;'));assert.ok(!html.includes('<Heroína>'));
 assert.ok(html.includes('token-color-swatch'));assert.ok(html.includes('data-token-preview'));assert.ok(html.includes('/FONT-AWESOME-LICENSE.txt'));
 for(const [id,item] of Object.entries(tokenIcons)){assert.ok(tokenIconIds.has(id));assert.ok(item.label);const svg=tokenIconSvg(id);assert.match(svg,/viewBox="0 0 \d+ 1792"/);assert.match(svg,/<path d="/);assert.ok(!svg.includes('<script'));}
 assert.equal(tokenIconSvg('<img>'),'');
});
test('prévia muda cor e símbolo e só automático usa retrato',()=>{
 const target={innerHTML:''},fields={name:{value:'Heroína'},characterId:{value:'hero'}},choice={color:'jade',icon:'magic'};
 const editor={querySelector:selector=>selector==='[data-token-preview]'?target:{value:selector.includes('"color"')?choice.color:choice.icon}};
 const container={querySelector:selector=>selector==='[data-token-appearance]'?editor:fields[selector.match(/name="(\w+)"/)?.[1]]};
 const characters=[{id:'hero',name:'Outra',portrait:{id:'portrait'}}];assert.equal(updateTokenAppearance(container,characters),true);assert.ok(target.innerHTML.includes('#9de5cb'));assert.ok(target.innerHTML.includes('token-symbol-svg'));assert.ok(!target.innerHTML.includes('data-portrait'));
 choice.icon='auto';updateTokenAppearance(container,characters);assert.ok(target.innerHTML.includes('data-portrait="portrait"'));choice.icon='initial';updateTokenAppearance(container,characters);assert.ok(!target.innerHTML.includes('data-portrait'));assert.ok(target.innerHTML.includes('>H</span>'));
 assert.equal(updateTokenAppearance({querySelector:()=>null}),false);
});


test('retrato importado tem prioridade sobre a ficha e mantém símbolos disponíveis',()=>{
 const token={name:'Guarda',characterId:'hero',portrait:{id:'custom'},icon:'auto'};
 const characters=[{id:'hero',portrait:{id:'sheet'}}];
 let html=renderTokenAppearance(token,characters);
 assert.match(html,/name="tokenPortrait" accept="image\/png,image\/jpeg,image\/webp,image\/gif"/);
 assert.match(html,/name="removePortrait"/);assert.match(html,/data-portrait="custom"/);assert.ok(!html.includes('data-portrait="sheet"'));
 html=renderTokenAppearance({...token,icon:'shield'},characters);assert.ok(!html.includes('data-portrait="custom"'));assert.match(html,/name="icon" value="shield" checked/);
});
