import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dataDirectory} from '../data-directory.mjs';
import {backupData} from '../data-backup.mjs';

const project=fileURLToPath(new URL('../',import.meta.url));
const root=dataDirectory({projectDir:project}),path=resolve(root,'forja.sqlite');
if(!existsSync(path)){console.error('Banco não encontrado: '+path);process.exit(1);}
const db=new DatabaseSync(path,{readOnly:true});
try{
 const id=process.argv[2];
 if(!id||id==='--list'){
  for(const row of db.prepare('SELECT id,state FROM campaigns').all()){
   const state=JSON.parse(row.state);console.log(row.id+' · '+state.name+' · '+(state.characters?.length||0)+' personagem(ns) · '+(state.sceneLibrary?.scenes?.length||1)+' cena(s)');
  }
  console.log('Recuperar mestre: npm run recover -- ID-DA-CAMPANHA');
  console.log('Recuperar jogador: npm run recover -- ID-DA-CAMPANHA --character=NOME-OU-ID');
 }else{
  const row=db.prepare('SELECT id,owner,state FROM campaigns WHERE id=?').get(id);
  if(!row)throw new Error('Campanha não encontrada. Execute npm run recover -- --list.');
  const state=JSON.parse(row.state),selection=process.argv.slice(3).find(arg=>arg.startsWith('--character='))?.slice('--character='.length);
  let token=row.owner,character;
  if(selection){
   const matches=state.characters.filter(c=>c.id===selection||c.name===selection);
   if(matches.length!==1)throw new Error('Escolha o ID de um único personagem da campanha.');
   character=matches[0];const member=state.members?.find(m=>m.id===character.ownerId);
   if(!member)throw new Error('O personagem não possui jogador vinculado. Entre pelo convite e escolha a ficha existente.');
   token=member.key;
  }
  const output=resolve(project,'.recovery');await mkdir(output,{recursive:true,mode:0o700});
  const backup=await backupData(db,root,{destination:resolve(output,'backups')});
  const file=resolve(output,row.id+(character?'-'+character.id:'')+'-'+Date.now()+'.acesso.txt');
  await writeFile(file,row.id+'.'+token+'\n',{mode:0o600,flag:'wx'});
  console.log('Campanha preservada: '+JSON.parse(row.state).name);
  console.log('Backup do banco e arquivos: '+backup);
  console.log('Código de '+(character?'jogador ('+character.name+')':'mestre')+' salvo em: '+file);
  console.log('Entregue somente este código ao responsável correspondente. Na tela inicial, use Recuperar acesso.');
 }
}catch(error){console.error(error.message);process.exitCode=1;}
finally{db.close();}
