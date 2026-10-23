import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {argumentsMap} from './project-safety.mjs';
import {validateInstallation,generatedConfiguration,writeOnce,origin,workerUrl} from './installation-lib.mjs';
const args=argumentsMap();
try{
 let values;
 if(args.from)values=JSON.parse(await readFile(args.from,'utf8'));
 else{try{values=JSON.parse(await readFile('installation.local.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;const ui=createInterface({input:process.stdin,output:process.stdout});values={};try{for(const [key,prompt] of [['projectId','ID exacto de tu proyecto Firebase'],['adminEmail','Gmail de administración inicial'],['adminName','Nombre de administración'],['apiKey','apiKey de la aplicación web Firebase (configuración pública)'],['appId','appId de la aplicación web Firebase'],['cloudflareAccountId','ID de la cuenta Cloudflare'],['workerName','Nombre del Worker, por ejemplo asambleas-reuniones'],['workerSubdomain','Subdominio workers.dev de tu cuenta (sin .workers.dev)'],['region','Región de Firestore, por ejemplo europe-southwest1']])values[key]=(await ui.question(prompt+': ')).trim();}finally{ui.close();}}}
 const c=validateInstallation(values),base=JSON.parse(await readFile('config/firebase.example.json','utf8'));
 await writeOnce('installation.local.json',JSON.stringify(c,null,2)+'\n');
 for(const [path,content] of Object.entries(generatedConfiguration(c,base)))await writeOnce(path,content);
 console.log(`Configuración preparada para ${c.projectId}.\nAplicación: ${origin(c)}\nServicio: ${workerUrl(c)}\nRetorno Gmail OAuth: ${workerUrl(c)}/oauth/callback\nSiguiente: npm run setup:check. No se han creado recursos ni guardado credenciales.`);
}catch(e){console.error(e.message);process.exitCode=1;}
