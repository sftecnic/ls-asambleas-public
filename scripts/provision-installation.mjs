import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {argumentsMap,verifyProject,googleApi} from './project-safety.mjs';
import {loadInstallation,generatedConfiguration,runCli,cloudflareSession,workerUrl} from './installation-lib.mjs';
const args=argumentsMap();
try{
 const c=await loadInstallation(),base=JSON.parse(await readFile('config/firebase.example.json','utf8'));
 for(const [path,text] of Object.entries(generatedConfiguration(c,base)))if(await readFile(path,'utf8')!==text)throw new Error(`${path} no corresponde a la instalación. Revisa antes de desplegar.`);
 await verifyProject(c.projectId,'firebase.local.json');
 const action=args.action,actions=['queue','worker','service','oauth','firebase'];if(!actions.includes(action))throw new Error('Usa --action queue|worker|service|oauth|firebase.');
 console.log(`Destino confirmado: Firebase ${c.projectId}, Cloudflare ${c.cloudflareAccountId}, Worker ${c.workerName}.`);
 if(!args.apply){console.log(`Comprobación de coste y destino superada. Para ejecutar ${action}, añade --apply.`);process.exit(0);}
 if(action==='firebase'){
  const only=args.only||'hosting,firestore:rules,firestore:indexes';if(!['hosting','auth','firestore:rules,firestore:indexes','hosting,firestore:rules,firestore:indexes'].includes(only))throw new Error('--only no permitido. Nunca se despliega Functions, App Hosting ni Storage.');
  if(only.includes('hosting'))await new Promise((ok,fail)=>{const child=spawn(process.execPath,['node_modules/typescript/bin/tsc','-b'],{stdio:'inherit',windowsHide:true});child.once('error',fail);child.once('close',code=>code===0?ok():fail(new Error('TypeScript no compila.')));});
  if(only.includes('hosting')){const {build}=await import('vite');await build();await import('./build-service-worker.mjs');}
  await runCli('firebase',['deploy','--config','firebase.local.json','--project',c.projectId,'--only',only,'--non-interactive']);
 }else{
  const api=await cloudflareSession(c),env={CLOUDFLARE_ACCOUNT_ID:c.cloudflareAccountId},config=['--config','worker/wrangler.local.jsonc'];
  if(action==='queue'){
   const name=`${c.workerName}-mail`,existing=await api('/queues');
   if(!existing.some(q=>q.queue_name===name))await api('/queues',{method:'POST',body:JSON.stringify({queue_name:name})});
   console.log('Cola disponible; no se han creado duplicados.');
  }
  if(action==='worker'){
   const queues=await api('/queues');if(!queues.some(q=>q.queue_name===`${c.workerName}-mail`))throw new Error('Primero ejecuta --action queue.');
   await runCli('wrangler',['deploy',...config],{env});
   console.log('Worker desplegado. Hasta conectar y probar el remitente no se activan convocatorias.');
  }
  if(['service','oauth'].includes(action)){
   const secrets=await api(`/workers/scripts/${c.workerName}/secrets`),names=new Set(secrets.map(s=>s.name));
   const bulk=values=>runCli('wrangler',['secret','bulk',...config],{input:JSON.stringify(values),env});
   if(action==='oauth'){
    if(names.has('GOOGLE_CLIENT_ID')&&names.has('GOOGLE_CLIENT_SECRET')){console.log('OAuth ya está configurado. Se conserva. Para cambiar de remitente, usa la aplicación.');process.exit(0);}
    if(names.has('GOOGLE_CLIENT_ID')||names.has('GOOGLE_CLIENT_SECRET'))throw new Error('OAuth está incompleto. Revisa los secretos antes de sustituirlos.');
    if(!args.file)throw new Error('Indica --file con la ruta del JSON OAuth descargado de tu proyecto.');
    const web=JSON.parse(await readFile(args.file,'utf8')).web;
    if(!web?.client_id||!web.client_secret||web.project_id!==c.projectId||!web.redirect_uris?.includes(workerUrl(c)+'/oauth/callback'))throw new Error('El cliente OAuth web debe pertenecer a este proyecto y contener el retorno exacto.');
    await bulk({GOOGLE_CLIENT_ID:web.client_id,GOOGLE_CLIENT_SECRET:web.client_secret});console.log('OAuth guardado en secretos de Cloudflare. No se ha conectado todavía ningún Gmail.');
   }else{
    await googleApi(`https://serviceusage.googleapis.com/v1/projects/${c.projectId}/services/gmail.googleapis.com:enable`,{method:'POST',body:'{}'});
    if(names.has('FIREBASE_SERVICE_ACCOUNT')&&names.has('TOKEN_ENCRYPTION_KEY')){console.log('Secretos del servicio ya presentes. No se rotan ni sobrescriben. Comprueba el servicio en la aplicación.');process.exit(0);}
    if(names.has('FIREBASE_SERVICE_ACCOUNT')||names.has('TOKEN_ENCRYPTION_KEY'))throw new Error('Falta un secreto del servicio. Se detiene para no perder el acceso al Gmail cifrado. Revisa la recuperación en la guía.');
    const id='ls-meetings-worker',email=`${id}@${c.projectId}.iam.gserviceaccount.com`,root=`https://iam.googleapis.com/v1/projects/${c.projectId}`;
    const accounts=await googleApi(root+'/serviceAccounts');if(!accounts.accounts?.some(a=>a.email===email))await googleApi(root+'/serviceAccounts',{method:'POST',body:JSON.stringify({accountId:id,serviceAccount:{displayName:'LS Asambleas · reuniones'}})});
    const resource=`https://cloudresourcemanager.googleapis.com/v1/projects/${c.projectId}`,policy=await googleApi(resource+':getIamPolicy',{method:'POST',body:'{}'}),member=`serviceAccount:${email}`;
    if(!policy.bindings?.some(b=>b.role==='roles/datastore.user'&&!b.condition&&b.members.includes(member))){const bindings=policy.bindings||[],entry=bindings.find(b=>b.role==='roles/datastore.user'&&!b.condition);if(entry)entry.members.push(member);else bindings.push({role:'roles/datastore.user',members:[member]});await googleApi(resource+':setIamPolicy',{method:'POST',body:JSON.stringify({policy:{...policy,bindings}})});}
    const keys=await googleApi(`${root}/serviceAccounts/${email}/keys?keyTypes=USER_MANAGED`);if(keys.keys?.length)throw new Error('Existe una clave del servicio pero faltan secretos. No se crea otra. Revisa la clave y la recuperación manual.');
    const key=await googleApi(`${root}/serviceAccounts/${email}/keys`,{method:'POST',body:JSON.stringify({privateKeyType:'TYPE_GOOGLE_CREDENTIALS_FILE',keyAlgorithm:'KEY_ALG_RSA_2048'})});
    try{await bulk({FIREBASE_SERVICE_ACCOUNT:Buffer.from(key.privateKeyData,'base64').toString('utf8'),TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64url')});}catch(e){
     // Outcome may be uncertain: keep the key so a successful partial upload remains recoverable.
     throw new Error('No se confirmó la carga. Revisa los secretos y la clave de la cuenta de servicio antes de reintentar; no se ha rotado la clave. '+e.message);
    }
    console.log('Servicio preparado. La clave se ha transferido en memoria; no se ha escrito en el repositorio.');
   }
  }
 }
}catch(e){console.error(e.message);process.exitCode=1;}
