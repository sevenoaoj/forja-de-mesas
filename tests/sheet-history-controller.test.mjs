import test from 'node:test';
import assert from 'node:assert/strict';
import {createSheetHistoryController} from '../public/sheet-history-controller.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fixture(){
 const own={id:'own',name:'Ana <b>',access:'full',sheetHistory:{version:3,entries:[{id:'entry',version:3,at:0,summary:'Nome alterado',actor:'Ana',before:{}}]}};
 const row={master:false,characterId:'own',state:{characters:[own,{id:'other',name:'Beto',access:'summary'}]}};
 const dialogs=[],calls=[],controller=createSheetHistoryController({current:()=>row,character:()=>own,ui:()=>({esc}),modal:(...args)=>dialogs.push(args),action:async(...args)=>{calls.push(args);return row;}});
 return {controller,row,own,dialogs,calls};
}
test('histórico abre diretamente e escapa nome; resumos de outros personagens são recusados',()=>{
 const f=fixture();f.controller.handlers.sheetHistory();assert.equal(f.dialogs[0][0],'Histórico de Ana &lt;b&gt;');assert.ok(f.dialogs[0][1].includes('class="sheet-history" open'));
 assert.throws(()=>f.controller.handlers.sheetHistory('other'),/acesso completo/);assert.throws(()=>f.controller.handlers.sheetHistory('missing'),/acesso completo/);
});
test('restauração abre confirmação versionada e envia versão numérica da ficha correta',async()=>{
 const f=fixture();f.controller.handlers.sheetHistoryRestore('own',{dataset:{entry:'entry'}});assert.ok(f.dialogs[0][1].includes('name="expectedVersion" value="3"'));
 const result=await f.controller.forms.sheetHistoryRestore({id:'own',entryId:'entry',expectedVersion:'3'});assert.equal(result,f.row);assert.deepEqual(f.calls,[['sheetHistoryRestore',{id:'own',entryId:'entry',expectedVersion:3}]]);
});
test('versão inválida, cópia removida e perda de propriedade não enviam restauração',async()=>{
 const f=fixture(),restore=data=>f.controller.forms.sheetHistoryRestore({id:'own',entryId:'entry',expectedVersion:'3',...data});
 await assert.rejects(restore({expectedVersion:'not-a-number'}),/Versão inválida/);await assert.rejects(restore({entryId:'removed'}),/indisponível/);
 f.row.characterId='other';await assert.rejects(restore({}),/acesso completo/);assert.deepEqual(f.calls,[]);
 f.row.master=true;await restore({});assert.equal(f.calls.length,1);
});
