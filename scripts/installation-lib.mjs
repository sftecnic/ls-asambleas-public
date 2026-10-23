import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';

export const versions={firebase:'15.34.1',wrangler:'4.152.0'};
export function validateInstallation(value){
 const keys=['projectId','adminEmail','adminName','apiKey','appId','cloudflareAccountId','workerName','workerSubdomain','region'];
 if(Object.keys(value).some(key=>!keys.includes(key)))throw new Error('Configuración desconocida. No guardes claves privadas ni tokens en installation.local.json.');
 const c={...value,region:value.region||'europe-southwest1',adminName:value.adminName||'Administración'};
 const checks={projectId:/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/,adminEmail:/^[^\s@]+@gmail\.com$/,apiKey:/^[A-Za-z0-9_-]{20,100}$/,appId:/^1:\d+:web:[a-fA-F0-9]+$/,cloudflareAccountId:/^[a-f0-9]{32}$/,workerName:/^[a-z][a-z0-9-]{2,50}$/,workerSubdomain:/^[a-z0-9][a-z0-9-]{0,60}$/,region:/^[a-z][a-z0-9-]{2,40}$/};
 for(const [key,re] of Object.entries(checks))if(typeof c[key]!=='string'||!re.test(c[key]))throw new Error(`Revisa ${key} en la configuración.`);
 if(typeof c.adminName!=='string'||c.adminName.length>160||/[\r\n]/.test(c.adminName))throw new Error('Nombre de administración no válido.');
 c.adminEmail=c.adminEmail.toLowerCase();return c;
}
export async function loadInstallation(){return validateInstallation(JSON.parse(await readFile('installation.local.json','utf8')));}
export const origin=c=>`https://${c.projectId}.firebaseapp.com`;
export const workerUrl=c=>`https://${c.workerName}.${c.workerSubdomain}.workers.dev`;
export function generatedConfiguration(c,base){
 const firebase={...base,auth:{providers:{googleSignIn:{oAuthBrandDisplayName:'LS Asambleas',supportEmail:c.adminEmail}}},firestore:{...base.firestore,location:c.region}};
 const worker={name:c.workerName,account_id:c.cloudflareAccountId,main:'index.ts',compatibility_date:'2026-10-23',workers_dev:true,triggers:{crons:['* * * * *']},vars:{FIREBASE_PROJECT_ID:c.projectId,APP_ORIGIN:origin(c)},queues:{producers:[{binding:'MEETING_QUEUE',queue:`${c.workerName}-mail`}],consumers:[{queue:`${c.workerName}-mail`,max_batch_size:1,max_batch_timeout:1,max_retries:3,max_concurrency:2}]},observability:{enabled:false}};
 const env=`VITE_FIREBASE_API_KEY=${c.apiKey}\nVITE_FIREBASE_PROJECT_ID=${c.projectId}\nVITE_FIREBASE_APP_ID=${c.appId}\nVITE_FIREBASE_AUTH_DOMAIN=${c.projectId}.firebaseapp.com\nVITE_MEETING_SERVICE_URL=${workerUrl(c)}\n`;
 return {'firebase.local.json':JSON.stringify(firebase,null,2)+'\n','worker/wrangler.local.jsonc':JSON.stringify(worker,null,2)+'\n','.env.production.local':env};
}
export async function writeOnce(path,content){
 try{const old=await readFile(path,'utf8');if(old!==content)throw new Error(`Ya existe ${path} con otros valores. Se conserva. Revisa y respalda el archivo antes de cambiarlo.`);return false;}catch(e){if(e.code!=='ENOENT')throw e;}
 await writeFile(path,content,{flag:'wx',mode:0o600});return true;
}
export async function cliPath(name){
 const packageName=name==='firebase'?'firebase-tools':'wrangler',version=versions[name],cache=resolve('.tools/npm-cache/_npx');
 let entries=[];try{entries=await readdir(cache);}catch{}
 for(const dir of entries){const root=join(cache,dir,'node_modules',packageName);try{const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));if(pkg.version===version)return join(root,name==='firebase'?'lib/bin/firebase.js':'bin/wrangler.js');}catch{}}
 throw new Error(`Instala la herramienta: npx.cmd --cache .tools/npm-cache -y ${packageName}@${version} --version (en macOS/Linux: npx).`);
}
export async function runCli(name,args,{input,capture=false,env={}}={}){
 const path=await cliPath(name);
 return new Promise((done,fail)=>{const child=spawn(process.execPath,[path,...args],{windowsHide:true,env:{...process.env,...env},stdio:[input?'pipe':'ignore',capture?'pipe':'inherit',capture?'pipe':'inherit']});let result='';if(capture)child.stdout.on('data',v=>{result+=v;if(result.length>2_000_000)child.kill();});if(capture)child.stderr.resume();child.once('error',fail);child.once('close',code=>code===0?done(result):fail(new Error(`${name}: operación detenida (código ${code}). Comprueba la sesión y el paso de la guía.`)));if(input)child.stdin.end(input);});
}
export async function cloudflareSession(c){
 const auth=JSON.parse(await runCli('wrangler',['auth','token','--json'],{capture:true}));
 if(!auth.token)throw new Error('Cloudflare requiere una sesión OAuth o token temporal. Vuelve a iniciar sesión.');
 const api=async(path,init={})=>{const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.cloudflareAccountId}${path}`,{...init,headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'}});const body=await r.json();if(!r.ok||!body.success)throw new Error(`Cloudflare HTTP ${r.status} en ${path}. Revisa cuenta, sesión y permisos; no se ha contratado ningún plan.`);return body.result;};
 // Billing must be observable, never inferred from a successful Worker deployment.
 const subscriptions=await api('/subscriptions');
 if(!Array.isArray(subscriptions))throw new Error('No se pudo verificar el plan gratuito de Cloudflare.');
 for(const sub of subscriptions){if(['canceled','cancelled','expired'].includes(String(sub.state||sub.status).toLowerCase()))continue;const plan=sub.rate_plan||{};if(Number(sub.price||0)>0||Number(plan.public_name?.match(/\$(\d+)/)?.[1]||0)>0||!/(free|gratuit)/i.test(`${plan.id||''} ${plan.public_name||''}`))throw new Error('Hay una suscripción que no se puede confirmar como gratuita. No se despliega; revisa Billing → Subscriptions.');}
 return api;
}
export async function progress(checks){await mkdir('.tools',{recursive:true});await writeFile('.tools/installation-progress.json',JSON.stringify({at:new Date().toISOString(),checks},null,2)+'\n');}
