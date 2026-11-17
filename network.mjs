import {networkInterfaces} from 'node:os';
import {inviteOrigin} from './model.mjs';

export function serverOptions(env=process.env,args=process.argv.slice(2)) {
  const port=Number(env.PORT??3000);
  if (!Number.isInteger(port) || port<0 || port>65535) throw new Error('PORT deve ser uma porta entre 0 e 65535.');
  const host=args.includes('--local') ? '127.0.0.1' : args.includes('--lan') ? '0.0.0.0' : env.HOST||'0.0.0.0';
  const publicUrl=env.FORJA_PUBLIC_URL && inviteOrigin(env.FORJA_PUBLIC_URL);
  if (env.FORJA_PUBLIC_URL && !publicUrl) throw new Error('FORJA_PUBLIC_URL deve ser um endereço HTTP ou HTTPS público válido.');
  return {host,port,...(publicUrl?{publicUrl}:{})};
}

export function connectionInfo({host,port,publicUrl},interfaces) {
  if (publicUrl) return {localOnly:false,publicUrl,urls:[publicUrl]};
  const localOnly=['127.0.0.1','localhost','::1'].includes(host);
  if (localOnly) return {localOnly,urls:[]};
  if (!['0.0.0.0','::'].includes(host)) {
    return {localOnly,urls:['http://'+(host.includes(':')?'['+host+']':host)+':'+port]};
  }
  try {
    interfaces ??= networkInterfaces();
  } catch {
    return {localOnly,urls:[]};
  }
  const addresses=Object.entries(interfaces).flatMap(([name,entries])=>
    (entries||[]).filter(entry=>!entry.internal && (entry.family==='IPv4'||entry.family===4))
      .map(entry=>({address:entry.address,virtual:/^(docker|br-|veth|virbr|tun|tap|wg|tailscale|zt|nordlynx)/i.test(name)}))
  );
  const physical=addresses.filter(entry=>!entry.virtual);
  const advertised=physical.length ? physical : addresses;
  return {localOnly,urls:[...new Set(advertised.map(entry=>'http://'+entry.address+':'+port))]};
}
