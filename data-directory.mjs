import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// All launchers use the same durable default. Keep legacy source installs intact.
export function dataDirectory({env=process.env,projectDir=fileURLToPath(new URL('./',import.meta.url)),cwd=process.cwd(),home=homedir(),exists=existsSync}={}){
 if(env.FORJA_DATA_DIR)return resolve(cwd,env.FORJA_DATA_DIR);
 const persistent=resolve(env.XDG_DATA_HOME||resolve(home,'.local/share'),'forja-de-mesas');
 const legacy=resolve(projectDir,'.data');
 const hasPersistent=exists(resolve(persistent,'forja.sqlite')),hasLegacy=exists(resolve(legacy,'forja.sqlite'));
 if(hasPersistent&&hasLegacy&&persistent!==legacy)throw new Error('Há dois bancos de campanhas: '+persistent+' e '+legacy+'. Defina FORJA_DATA_DIR com o diretório correto; nenhum banco foi alterado.');
 return hasLegacy?legacy:persistent;
}
