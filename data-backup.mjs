import {mkdir,readdir,cp,rename,rm,writeFile,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function backupData(db,root,{destination=resolve(root,'backups'),keep=5}={}){
 await mkdir(destination,{recursive:true,mode:0o700});
 const name=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8);
 const stage=resolve(destination,'.pending-'+name),target=resolve(destination,name);
 await mkdir(stage,{mode:0o700});
 try{
  // SQLite makes a consistent snapshot, including commits still in a WAL file.
  db.prepare('VACUUM INTO ?').run(resolve(stage,'forja.sqlite'));
  await chmod(resolve(stage,'forja.sqlite'),0o600);
  for(const entry of await readdir(root,{withFileTypes:true})){
   if(entry.isDirectory()&&/^[a-f0-9-]{36}$/.test(entry.name))await cp(resolve(root,entry.name),resolve(stage,entry.name),{recursive:true,errorOnExist:true,force:false});
  }
  await writeFile(resolve(stage,'backup.json'),JSON.stringify({format:'forja-backup-v1',createdAt:new Date().toISOString()},null,2),{mode:0o600});
  await rename(stage,target);
  const previous=(await readdir(destination,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d{4}-\d\d-\d\dT[\d-]+Z-[a-f0-9]{8}$/.test(e.name)).map(e=>e.name).sort().reverse();
  for(const old of previous.slice(keep))await rm(resolve(destination,old),{recursive:true,force:true});
  return target;
 }catch(error){await rm(stage,{recursive:true,force:true});throw error;}
}
