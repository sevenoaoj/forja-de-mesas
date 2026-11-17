import {connectionInfo} from './network.mjs';

async function probe(origin) {
  try {
    const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(2000)});
    if (response.ok) {
      const health=await response.json().catch(()=>null);
      if (health?.service==='forja-de-mesas') return {origin,ok:true};
    }
    // Earlier releases expose the application without a health endpoint.
    const page=await fetch(origin+'/',{signal:AbortSignal.timeout(2000)});
    const html=await page.text();
    if (page.ok && html.includes('<title>Forja de Mesas')) return {origin,ok:true};
    return {origin,ok:false,reason:'Outro serviço respondeu na porta (HTTP '+page.status+').'};
  } catch (error) {
    const code=error.cause?.code||error.name;
    const reason={
      ECONNREFUSED:'Conexão recusada. Verifique se o servidor está aberto nessa porta.',
      TimeoutError:'Tempo esgotado. Verifique bloqueios de rede ou firewall.',
      EACCES:'O sistema bloqueou a conexão de diagnóstico.',
      EPERM:'O sistema bloqueou a conexão de diagnóstico.'
    }[code]||String(code);
    return {origin,ok:false,reason};
  }
}

export async function diagnose(options,info=connectionInfo(options),write=console.log) {
  write('Diagnóstico de rede — Forja de Mesas');
  write('Porta configurada: '+options.port+' · endereço de escuta: '+options.host);
  write('Mantenha a janela do servidor aberta durante este teste.');
  const localHost=options.host==='::' ? '[::1]' : '127.0.0.1';
  const origins=[...new Set(['http://'+localHost+':'+options.port,...info.urls])];
  const results=await Promise.all(origins.map(probe));
  for (const result of results) write((result.ok?'OK ':'FALHA ')+result.origin+(result.reason?' — '+result.reason:''));
  if (info.localOnly) write('Modo local configurado. Inicie o servidor com --lan para receber conexões do celular.');
  else if (!info.urls.length) write('Nenhum IP de rede foi detectado. Consulte o endereço Wi-Fi/Ethernet nas configurações de rede do PC.');
  const local=results[0].ok;
  if (local && results.some(result=>result.ok && result.origin!==origins[0])) {
    write('O PC respondeu pelo endereço da rede. O acesso do celular ainda precisa ser testado.');
    write('Abra um dos endereços OK no celular usando http://, na mesma rede do PC.');
    write('Se só o celular expirar, confira a regra de entrada da porta '+options.port+' no firewall e o isolamento de dispositivos no Wi-Fi.');
  } else if (local && !info.localOnly && info.urls.length) {
    write('A Forja responde localmente, mas o teste pelos IPs da rede falhou. Confira a escuta com: ss -ltn');
    write('Reinicie o servidor com --lan e confira o firewall do PC.');
  }
  write('Este diagnóstico testa conexões a partir do PC. Ele não confirma o caminho de rede do celular.');
  return results;
}
