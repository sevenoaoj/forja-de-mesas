import test from 'node:test';
import assert from 'node:assert/strict';
import {serverOptions,connectionInfo} from '../network.mjs';

test('servidor aceita LAN por padrão e respeita modo local e porta',()=>{
  assert.deepEqual(serverOptions({},[]),{host:'0.0.0.0',port:3000});
  assert.deepEqual(serverOptions({},['--local']),{host:'127.0.0.1',port:3000});
  assert.deepEqual(serverOptions({HOST:'127.0.0.1'},['--lan']),{host:'0.0.0.0',port:3000});
  assert.deepEqual(serverOptions({HOST:'192.168.1.10',PORT:'4321'},[]),{host:'192.168.1.10',port:4321});
  assert.throws(()=>serverOptions({PORT:'invalida'},[]));
  assert.throws(()=>serverOptions({PORT:'65536'},[]));
});

test('convites usam o IP do PC e priorizam rede física sobre interfaces virtuais',()=>{
  const interfaces={
    docker0:[{family:'IPv4',address:'172.17.0.1',internal:false}],
    lo:[{family:'IPv4',address:'127.0.0.1',internal:true}],
    wlan0:[{family:'IPv4',address:'192.168.1.35',internal:false},{family:'IPv6',address:'fe80::1234',internal:false}]
  };
  const info=connectionInfo({host:'0.0.0.0',port:3000},interfaces);
  assert.deepEqual(info,{localOnly:false,urls:['http://192.168.1.35:3000']});
  assert.deepEqual(connectionInfo({host:'127.0.0.1',port:3000},interfaces),{localOnly:true,urls:[]});
  assert.deepEqual(connectionInfo({host:'0.0.0.0',port:3000},{}),{localOnly:false,urls:[]});
});

test('diagnóstico distingue serviço local funcionando de falha pelo IP da rede',async()=>{
  const {diagnose}=await import('../diagnostics.mjs');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    if (url.startsWith('http://127.0.0.1')) return Response.json({service:'forja-de-mesas'});
    throw Object.assign(new Error('timeout'),{name:'TimeoutError'});
  };
  try {
    const lines=[];
    const results=await diagnose({host:'0.0.0.0',port:3000},
      {localOnly:false,urls:['http://192.168.1.35:3000']},line=>lines.push(line));
    assert.deepEqual(results.map(result=>result.ok),[true,false]);
    assert.ok(lines.some(line=>line.includes('responde localmente')));
    assert.ok(lines.some(line=>line.includes('não confirma o caminho')));
  } finally {globalThis.fetch=originalFetch;}
});

test('diagnóstico reconhece versões anteriores sem endpoint de saúde',async()=>{
  const {diagnose}=await import('../diagnostics.mjs');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>url.endsWith('/api/health')
    ? new Response('',{status:404}) : new Response('<title>Forja de Mesas — RPG</title>');
  try {
    const results=await diagnose({host:'127.0.0.1',port:3000},{localOnly:true,urls:[]},()=>{});
    assert.equal(results[0].ok,true);
  } finally {globalThis.fetch=originalFetch;}
});

test('convite rejeita localhost e aceita o IP com a porta do servidor',async()=>{
  const {inviteOrigin}=await import('../model.mjs');
  for (const value of ['http://localhost:3000','127.0.1.1:3000','http://0.0.0.0:3000','http://[::1]:3000']) {
    assert.equal(inviteOrigin(value),null,value);
  }
  assert.equal(inviteOrigin('192.168.0.211:3000'),'http://192.168.0.211:3000');
  assert.equal(inviteOrigin('http://192.168.0.211:3000/#mesa=chave'),'http://192.168.0.211:3000');
  assert.equal(inviteOrigin('https://mesa.example.com/#mesa=chave'),'https://mesa.example.com');
});

test('domínio público configurado gera convites mesmo com servidor restrito ao PC',()=>{
  const options=serverOptions({FORJA_PUBLIC_URL:'https://mesa.example.com/'},['--local']);
  assert.equal(options.host,'127.0.0.1');
  assert.equal(options.publicUrl,'https://mesa.example.com');
  assert.deepEqual(connectionInfo(options,{}),{localOnly:false,publicUrl:options.publicUrl,urls:[options.publicUrl]});
  for (const publicUrl of ['http://localhost:3000','javascript:alert(1)','https://user:secret@example.com']) {
    assert.throws(()=>serverOptions({FORJA_PUBLIC_URL:publicUrl},[]));
  }
});
