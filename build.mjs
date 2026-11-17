import {copyFile,mkdir,readFile,writeFile,rm} from 'node:fs/promises';

const output = new URL('./dist/server/',import.meta.url);
const metadata = new URL('./dist/.openai/',import.meta.url);
await Promise.all([mkdir(output,{recursive:true}),mkdir(metadata,{recursive:true})]);

const files = {
  '/loot-data.mjs':['loot-data.mjs','text/javascript; charset=utf-8'],
  '/loot.mjs':['public/loot.mjs','text/javascript; charset=utf-8'],
  '/sheet-resources.mjs':['public/sheet-resources.mjs','text/javascript; charset=utf-8'],
  '/table-vision.mjs':['public/table-vision.mjs','text/javascript; charset=utf-8'],
  '/vision-model.mjs':['vision-model.mjs','text/javascript; charset=utf-8'],
  '/soundboard.mjs':['public/soundboard.mjs','text/javascript; charset=utf-8'],
  '/soundboard-model.mjs':['soundboard-model.mjs','text/javascript; charset=utf-8'],
  '/sound-catalog.mjs':['sound-catalog.mjs','text/javascript; charset=utf-8'],
  '/soundboard.css':['public/soundboard.css','text/css; charset=utf-8'],
  '/player-access.mjs':['public/player-access.mjs','text/javascript; charset=utf-8'],
  '/narration.mjs':['public/narration.mjs','text/javascript; charset=utf-8'],
  '/narration-style.mjs':['narration-style.mjs','text/javascript; charset=utf-8'],
  '/sheet-inline.mjs':['public/sheet-inline.mjs','text/javascript; charset=utf-8'],
  '/sheet-history-controller.mjs':['public/sheet-history-controller.mjs','text/javascript; charset=utf-8'],
  '/sheet-template-model.mjs':['sheet-template-model.mjs','text/javascript; charset=utf-8'],
  '/sheet-templates.mjs':['public/sheet-templates.mjs','text/javascript; charset=utf-8'],
  '/sheet-history.mjs':['public/sheet-history.mjs','text/javascript; charset=utf-8'],
  '/inventory.mjs':['public/inventory.mjs','text/javascript; charset=utf-8'],
  '/inventory.css':['public/inventory.css','text/css; charset=utf-8'],
  '/journal.mjs':['public/journal.mjs','text/javascript; charset=utf-8'],
  '/sheet-templates.css':['public/sheet-templates.css','text/css; charset=utf-8'],
  '/sheet-history.css':['public/sheet-history.css','text/css; charset=utf-8'],
  '/journal.css':['public/journal.css','text/css; charset=utf-8'],
  '/':['public/index.html','text/html; charset=utf-8'],
  '/gm-screen.mjs':['public/gm-screen.mjs','text/javascript; charset=utf-8'],
  '/gm-screen.css':['public/gm-screen.css','text/css; charset=utf-8'],
  '/sheet-layout.mjs':['sheet-layout.mjs','text/javascript; charset=utf-8'],
  '/sheet-mosaic.mjs':['public/sheet-mosaic.mjs','text/javascript; charset=utf-8'],
  '/sheet-packing.mjs':['public/sheet-packing.mjs','text/javascript; charset=utf-8'],
  '/sheet-mosaic.css':['public/sheet-mosaic.css','text/css; charset=utf-8'],
  '/app.mjs':['public/app.mjs','text/javascript; charset=utf-8'],
  '/table-rolls.mjs':['public/table-rolls.mjs','text/javascript; charset=utf-8'],
  '/table-live.mjs':['public/table-live.mjs','text/javascript; charset=utf-8'],
  '/token-editor.mjs':['public/token-editor.mjs','text/javascript; charset=utf-8'],
  '/token-icons.mjs':['token-icons.mjs','text/javascript; charset=utf-8'],
  '/FONT-AWESOME-LICENSE.txt':['public/FONT-AWESOME-LICENSE.txt','text/plain; charset=utf-8'],
  '/scenes.mjs':['public/scenes.mjs','text/javascript; charset=utf-8'],
  '/table.mjs':['public/table.mjs','text/javascript; charset=utf-8'],
  '/fog-geometry.mjs':['fog-geometry.mjs','text/javascript; charset=utf-8'],
  '/scene-model.mjs':['scene-model.mjs','text/javascript; charset=utf-8'],
  '/table-model.mjs':['table-model.mjs','text/javascript; charset=utf-8'],
  '/table.css':['public/table.css','text/css; charset=utf-8'],
  '/music.mjs':['public/music.mjs','text/javascript; charset=utf-8'],
  '/music.css':['public/music.css','text/css; charset=utf-8'],
  '/audio.mjs':['public/audio.mjs','text/javascript; charset=utf-8'],
  '/media.mjs':['media.mjs','text/javascript; charset=utf-8'],
  '/rolls.mjs':['public/rolls.mjs','text/javascript; charset=utf-8'],
  '/dice-scene.mjs':['public/dice-scene.mjs','text/javascript; charset=utf-8'],
  '/rolls.css':['public/rolls.css','text/css; charset=utf-8'],
  '/dnd.mjs':['dnd.mjs','text/javascript; charset=utf-8'],
  '/dnd-ui.mjs':['public/dnd-ui.mjs','text/javascript; charset=utf-8'],
  '/dnd.css':['public/dnd.css','text/css; charset=utf-8'],
  '/model.mjs':['model.mjs','text/javascript; charset=utf-8'],
  '/style.css':['public/style.css','text/css; charset=utf-8'],
  '/cover.webp':['public/cover.webp','image/webp']
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url,[path,type]])=>[
  url,[type,(await readFile(new URL(path,import.meta.url))).toString('base64')]
])));

// Validate browser import URLs as well as the presence of each bundled file.
for(const [path,[type,base64]]of Object.entries(assets))if(type.startsWith('text/javascript')){
  const code=Buffer.from(base64,'base64').toString('utf8');
  for(const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/g)){
    const dependency=new URL(match[1],'https://forja'+path).pathname;
    if(!Object.hasOwn(assets,dependency))throw new Error('Dependência do navegador ausente: '+path+' → '+dependency);
  }
}

await Promise.all([
  copyFile(new URL('./.openai/hosting.json',import.meta.url),new URL('hosting.json',metadata)).catch(async error=>{
    if(error.code!=='ENOENT')throw error;
    // A fresh clone can build the Worker without machine-specific hosting metadata.
    await rm(new URL('hosting.json',metadata),{force:true});
  }),
  writeFile(new URL('assets.mjs',output),'export default '+JSON.stringify(assets)+';\n'),
  ...['item-assets.mjs','loot-data.mjs','loot-model.mjs','request-json.mjs','vision-model.mjs','inventory-model.mjs','soundboard-model.mjs','sound-catalog.mjs','sound-pack-import.mjs','zip-audio.mjs','campaign-backup.mjs','browser-session.mjs','sheet-template-model.mjs','sheet-history.mjs','journal-model.mjs','narration-model.mjs','narration-style.mjs','scene-model.mjs','token-icons.mjs','fog-geometry.mjs','table-realtime.mjs','sheet-layout.mjs','gm-screen-model.mjs','dnd.mjs','api.mjs','music-model.mjs','access.mjs','model.mjs','table-model.mjs','media.mjs','storage.mjs','worker.mjs'].map(file=>
    copyFile(new URL(file,import.meta.url),new URL(file==='worker.mjs'?'index.js':file,output)))
]);
