import {copyFile,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {staticFiles,staticContentType,sharedServerModules} from './manifest.mjs';

const output = new URL('./dist/server/',import.meta.url);
const metadata = new URL('./dist/.openai/',import.meta.url);
await Promise.all([mkdir(output,{recursive:true}),mkdir(metadata,{recursive:true})]);

const assets = Object.fromEntries(await Promise.all(Object.entries(staticFiles).map(async ([url,path])=>[
  url,[staticContentType(path),(await readFile(new URL(path,import.meta.url))).toString('base64')]
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
  ...[...sharedServerModules,'worker.mjs'].map(file=>
    copyFile(new URL(file,import.meta.url),new URL(file==='worker.mjs'?'index.js':file,output)))
]);
