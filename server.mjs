import {createServer} from 'node:http';
import {realpathSync} from 'node:fs';
import {readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {api,sceneView} from './api.mjs';
import {strongEtag,matchesIfNoneMatch,staticAssetHeaders} from './etag.mjs';
import {staticFiles,staticContentType} from './manifest.mjs';
import {createTableRealtime} from './table-realtime.mjs';
import {database} from './storage.mjs';
import {serverOptions,connectionInfo} from './network.mjs';
import {dataDirectory} from './data-directory.mjs';
import {backupData} from './data-backup.mjs';
import {fileURLToPath} from 'node:url';

const staticEtags = new Map();

export async function serveStatic(request, pathname = new URL(request.url).pathname) {
  if (!Object.hasOwn(staticFiles, pathname)) return new Response('Página não encontrada.', {status:404});
  const relativePath = staticFiles[pathname];
  const fileUrl = new URL('./' + relativePath, import.meta.url);
  const info = await stat(fileUrl, {bigint:true}).catch(() => null);
  if (!info?.isFile()) return new Response('Página não encontrada.', {status:404});
  const stamp = info.size + ':' + info.mtimeNs + ':' + info.ctimeNs;
  let cached = staticEtags.get(pathname);
  let bytes = null;
  if (!cached || cached.stamp !== stamp) {
    bytes = await readFile(fileUrl).catch(() => null);
    if (!bytes) return new Response('Página não encontrada.', {status:404});
    cached = {stamp, etag: await strongEtag(bytes), contentType: staticContentType(relativePath)};
    staticEtags.set(pathname, cached);
  }
  if (['GET','HEAD'].includes(request.method) && matchesIfNoneMatch(request.headers.get('if-none-match'), cached.etag, {allowWildcard:true})) {
    return new Response(null, {status:304, headers:staticAssetHeaders(cached.etag)});
  }
  bytes ??= await readFile(fileUrl).catch(() => null);
  if (!bytes) return new Response('Página não encontrada.', {status:404});
  return new Response(request.method === 'HEAD' ? null : bytes, {
    headers:staticAssetHeaders(cached.etag, cached.contentType)
  });
}

const isMain = Boolean(process.argv[1]) && (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (isMain) {
  const options=serverOptions();

  if (process.argv.includes('--diagnose')) {
    const {diagnose}=await import('./diagnostics.mjs');
    const results=await diagnose(options);
    process.exit(results.some(result=>result.ok)?0:1);
  }

  const root = dataDirectory({projectDir:fileURLToPath(new URL('./',import.meta.url))});
  await mkdir(root,{recursive:true});
  const db = new DatabaseSync(resolve(root,'forja.sqlite'));
  db.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
  if(!process.argv.includes('--check')&&db.prepare("SELECT 1 FROM sqlite_master WHERE name='campaigns'").get()&&db.prepare('SELECT 1 FROM campaigns LIMIT 1').get()){
   console.log('Backup das campanhas: '+await backupData(db,root));
  }
  db.exec(await readFile(new URL('./drizzle/0001_campaigns.sql',import.meta.url),'utf8'));
  const store = database({
    first:(sql,args)=>db.prepare(sql).get(...args),
    run:(sql,args)=>Number(db.prepare(sql).run(...args).changes)
  },{
    async putAsset(key,blob) {
      const path = resolve(root,key);
      await mkdir(resolve(path,'..'),{recursive:true});
      await writeFile(path,new Uint8Array(await blob.arrayBuffer()));
    },
    getAsset:key=>readFile(resolve(root,key)).catch(()=>null),
    deleteAsset:key=>rm(resolve(root,key),{force:true}),
    deleteCampaignAssets:id=>rm(resolve(root,id),{recursive:true,force:true})
  });

  store.realtime=createTableRealtime({sceneView});

  async function handle(request) {
    const url = new URL(request.url);
    if (url.pathname==='/api/health' && request.method==='GET') {
      return Response.json({ok:true,service:'forja-de-mesas'},{headers:{'Cache-Control':'no-store'}});
    }
    if (url.pathname==='/api/connection' && request.method==='GET') {
      return Response.json(connectionInfo(options),{headers:{'Cache-Control':'no-store'}});
    }
    if (url.pathname.startsWith('/api/')) return api(request,store);
    return serveStatic(request, url.pathname);
  }

  async function serve(req,res) {
    const url = new URL(req.url,'http://localhost');
    const controller=new AbortController();
    res.once('close',()=>controller.abort());
    const body = ['GET','HEAD'].includes(req.method) ? undefined : Readable.toWeb(req);
    const response = await handle(new Request(url,{method:req.method,headers:req.headers,body,duplex:'half',signal:controller.signal}));
    const headers=Object.fromEntries(response.headers);
    const cookies=response.headers.getSetCookie();
    if(cookies.length)headers['set-cookie']=cookies;
    res.writeHead(response.status,headers);
    if (response.body && req.method !== 'HEAD') {const stream=Readable.fromWeb(response.body);res.once('close',()=>stream.destroy());stream.on('error',error=>{if(!res.writableEnded)res.destroy(error);});stream.pipe(res);}
    else res.end();
  }

  if (process.argv.includes('--check')) {
    for (const path of Object.keys(staticFiles)) {
      const response = await handle(new Request('http://localhost'+path));
      if (!response.ok || !response.headers.get('ETag')) throw new Error('Arquivo indisponível: '+path);
      const cached = await handle(new Request('http://localhost'+path,{headers:{'If-None-Match':response.headers.get('ETag')}}));
      if (cached.status !== 304) throw new Error('ETag inválido em: '+path);
    }
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='campaigns'").get()) {
      throw new Error('O banco da Forja não foi inicializado.');
    }
    console.log('Forja de Mesas: runtime, arquivos e banco OK.');
    db.close();
  } else {
    const {port,host}=options;
    const server = createServer((req,res)=>serve(req,res).catch(error=>{
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }));
    server.on('error',error=>{
      console.error('Não foi possível iniciar o servidor: '+error.message);
      if (error.code==='EADDRINUSE') console.error('A porta está ocupada. Encerre a instância anterior ou defina outra PORT.');
      process.exitCode=1;
    });
    server.listen(port,host,()=>{
      options.port=server.address().port;
      console.log('Forja de Mesas no PC: http://localhost:'+options.port);
      console.log('Dados persistentes: '+root);
      if (options.publicUrl) console.log('Endereço público configurado para os convites: '+options.publicUrl);
      const info=connectionInfo(options);
      if (info.localOnly) console.log('Acesso somente neste computador. Use --lan para conectar o celular.');
      else {
        for (const url of info.urls) console.log('No celular, conectado à mesma rede: '+url);
        if (!info.urls.length) console.log('Rede habilitada. No celular, use http://IP-DO-PC:'+options.port+' na mesma rede Wi-Fi.');
      }
    });
  }
}
