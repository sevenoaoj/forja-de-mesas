import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {api,sceneView} from './api.mjs';
import {createTableRealtime} from './table-realtime.mjs';
import {database} from './storage.mjs';
import {serverOptions,connectionInfo} from './network.mjs';
import {dataDirectory} from './data-directory.mjs';
import {backupData} from './data-backup.mjs';
import {fileURLToPath} from 'node:url';

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

const staticFiles = new Map([
  ['/loot-data.mjs',['../loot-data.mjs','text/javascript; charset=utf-8']],
  ['/loot.mjs',['loot.mjs','text/javascript; charset=utf-8']],
  ['/sheet-resources.mjs',['sheet-resources.mjs','text/javascript; charset=utf-8']],
  ['/table-vision.mjs',['table-vision.mjs','text/javascript; charset=utf-8']],
  ['/vision-model.mjs',['../vision-model.mjs','text/javascript; charset=utf-8']],
  ['/soundboard.mjs',['soundboard.mjs','text/javascript; charset=utf-8']],
  ['/soundboard-model.mjs',['../soundboard-model.mjs','text/javascript; charset=utf-8']],
  ['/sound-catalog.mjs',['../sound-catalog.mjs','text/javascript; charset=utf-8']],
  ['/soundboard.css',['soundboard.css','text/css; charset=utf-8']],
  ['/player-access.mjs',['player-access.mjs','text/javascript; charset=utf-8']],
  ['/narration.mjs',['narration.mjs','text/javascript; charset=utf-8']],
  ['/narration-style.mjs',['../narration-style.mjs','text/javascript; charset=utf-8']],
  ['/sheet-inline.mjs',['sheet-inline.mjs','text/javascript; charset=utf-8']],
  ['/sheet-history-controller.mjs',['sheet-history-controller.mjs','text/javascript; charset=utf-8']],
  ['/sheet-template-model.mjs',['../sheet-template-model.mjs','text/javascript; charset=utf-8']],
  ['/sheet-templates.mjs',['sheet-templates.mjs','text/javascript; charset=utf-8']],
  ['/sheet-history.mjs',['sheet-history.mjs','text/javascript; charset=utf-8']],
  ['/inventory.mjs',['inventory.mjs','text/javascript; charset=utf-8']],
  ['/inventory.css',['inventory.css','text/css; charset=utf-8']],
  ['/journal.mjs',['journal.mjs','text/javascript; charset=utf-8']],
  ['/sheet-templates.css',['sheet-templates.css','text/css; charset=utf-8']],
  ['/sheet-history.css',['sheet-history.css','text/css; charset=utf-8']],
  ['/journal.css',['journal.css','text/css; charset=utf-8']],
  ['/',['index.html','text/html; charset=utf-8']],
  ['/rolls.mjs',['rolls.mjs','text/javascript; charset=utf-8']],
  ['/dice-scene.mjs',['dice-scene.mjs','text/javascript; charset=utf-8']],
  ['/rolls.css',['rolls.css','text/css; charset=utf-8']],
  ['/dnd.mjs',['../dnd.mjs','text/javascript; charset=utf-8']],
  ['/dnd-ui.mjs',['dnd-ui.mjs','text/javascript; charset=utf-8']],
  ['/dnd.css',['dnd.css','text/css; charset=utf-8']],
  ['/gm-screen.mjs',['gm-screen.mjs','text/javascript; charset=utf-8']],
  ['/gm-screen.css',['gm-screen.css','text/css; charset=utf-8']],
  ['/sheet-layout.mjs',['../sheet-layout.mjs','text/javascript; charset=utf-8']],
  ['/sheet-mosaic.mjs',['sheet-mosaic.mjs','text/javascript; charset=utf-8']],
  ['/sheet-packing.mjs',['sheet-packing.mjs','text/javascript; charset=utf-8']],
  ['/sheet-mosaic.css',['sheet-mosaic.css','text/css; charset=utf-8']],
  ['/app.mjs',['app.mjs','text/javascript; charset=utf-8']],
  ['/table-rolls.mjs',['table-rolls.mjs','text/javascript; charset=utf-8']],
  ['/token-editor.mjs',['token-editor.mjs','text/javascript; charset=utf-8']],
  ['/token-icons.mjs',['../token-icons.mjs','text/javascript; charset=utf-8']],
  ['/FONT-AWESOME-LICENSE.txt',['FONT-AWESOME-LICENSE.txt','text/plain; charset=utf-8']],
  ['/scenes.mjs',['scenes.mjs','text/javascript; charset=utf-8']],
  ['/table.mjs',['table.mjs','text/javascript; charset=utf-8']],
  ['/table-live.mjs',['table-live.mjs','text/javascript; charset=utf-8']],
  ['/fog-geometry.mjs',['../fog-geometry.mjs','text/javascript; charset=utf-8']],
  ['/scene-model.mjs',['../scene-model.mjs','text/javascript; charset=utf-8']],
  ['/table-model.mjs',['../table-model.mjs','text/javascript; charset=utf-8']],
  ['/table.css',['table.css','text/css; charset=utf-8']],
  ['/music.mjs',['music.mjs','text/javascript; charset=utf-8']],
  ['/music.css',['music.css','text/css; charset=utf-8']],
  ['/audio.mjs',['audio.mjs','text/javascript; charset=utf-8']],
  ['/media.mjs',['../media.mjs','text/javascript; charset=utf-8']],
  ['/model.mjs',['../model.mjs','text/javascript; charset=utf-8']],
  ['/style.css',['style.css','text/css; charset=utf-8']],
  ['/cover.webp',['cover.webp','image/webp']]
]);

async function handle(request) {
  const url = new URL(request.url);
  if (url.pathname==='/api/health' && request.method==='GET') {
    return Response.json({ok:true,service:'forja-de-mesas'},{headers:{'Cache-Control':'no-store'}});
  }
  if (url.pathname==='/api/connection' && request.method==='GET') {
    return Response.json(connectionInfo(options),{headers:{'Cache-Control':'no-store'}});
  }
  if (url.pathname.startsWith('/api/')) return api(request,store);
  const file = staticFiles.get(url.pathname);
  const bytes = file && await readFile(new URL('./public/'+file[0],import.meta.url)).catch(()=>null);
  return bytes ? new Response(bytes,{headers:{'Content-Type':file[1],'Cache-Control':'no-cache','Referrer-Policy':'strict-origin-when-cross-origin'}}) : new Response('Página não encontrada.',{status:404});
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
  for (const path of staticFiles.keys()) {
    const response = await handle(new Request('http://localhost'+path));
    if (!response.ok) throw new Error('Arquivo indisponível: '+path);
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
