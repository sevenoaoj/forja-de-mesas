import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJson} from '../request-json.mjs';
import {api} from '../api.mjs';

function streamed(chunks,headers={}){
 let cancelled=false;
 const body=new ReadableStream({pull(controller){if(chunks.length)controller.enqueue(new TextEncoder().encode(chunks.shift()));else controller.close();},cancel(){cancelled=true;}});
 return {request:new Request('http://app/api/campaigns',{method:'POST',body,duplex:'half',headers}),cancelled:()=>cancelled};
}

test('limite JSON conta bytes entre fragmentos e cancela corpo excessivo sem Content-Length',async()=>{
 const input=streamed(['{"name":"','á'.repeat(20),'"}', 'resto']);
 await assert.rejects(requestJson(input.request,30),error=>error.status===413);
 assert.equal(input.cancelled(),true);
 assert.equal(input.request.body.locked,false);
 const valid=streamed(['{"name":','"Mesa"}']);
 assert.deepEqual(await requestJson(valid.request,30),{name:'Mesa'});
});

test('JSON rejeita tamanho declarado, corpo vazio, primitivas e arrays',async()=>{
 await assert.rejects(requestJson(streamed(['{}'],{'Content-Length':'100'}).request,10),error=>error.status===413);
 for(const body of ['null','[]','true','"mesa"','42','']){
  const response=await api(new Request('http://app/api/campaigns',{method:'POST',body}),{create(){assert.fail('Não deve criar campanha.');}});
  assert.equal(response.status,400,body);
 }
});

test('API rejeita ações malformadas e excesso em streams antes de salvar',async()=>{
 let row,saves=0;
 const store={async create(value){row=structuredClone(value);},async get(){return structuredClone(row);},async save(){saves++;return true;}};
 const created=await(await api(new Request('http://app/api/campaigns',{method:'POST',body:JSON.stringify({name:'Mesa'})}),store)).json();
 const headers={Authorization:'Bearer '+created.key};
 for(const action of [{action:42},{action:'notes',data:[]},{action:'notes',data:null}]){
  const response=await api(new Request('http://app/api/campaigns/'+created.id+'/action',{method:'POST',headers,body:JSON.stringify(action)}),store);
  assert.equal(response.status,400);
 }
 const input=streamed(['{"name":"','x'.repeat(1_500_001),'"}']);
 assert.equal((await api(input.request,store)).status,413);
 assert.equal(input.cancelled(),true);
 assert.equal(saves,0);
});
