import {readFile,writeFile,mkdir,lstat,readdir,chmod} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const normalize=bytes=>Buffer.from(Buffer.from(bytes).toString('utf8').replace(/\r\n/g,'\n'));
export function safePath(root,path){
 if(typeof path!=='string'||!path||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..')||/^[\/]|:/.test(path))throw new Error('Ruta de skill no válida.');
 const result=resolve(root,path);if(!result.startsWith(resolve(root)+sep))throw new Error('Ruta fuera de skills.');return result;
}
async function noLinks(root,path){
 let current=resolve(root);
 for(const part of relative(root,path).split(sep)){
  current=resolve(current,part);try{if((await lstat(current)).isSymbolicLink())throw new Error('No se escriben enlaces simbólicos: '+current);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
}
function sourceUrl(url){
 const parsed=new URL(url);
 if(parsed.origin!=='https://raw.githubusercontent.com'||!/^\/[^/]+\/[^/]+\/[a-f0-9]{40}\//.test(parsed.pathname))throw new Error('La fuente debe ser GitHub y un commit fijo.');
 return parsed.href;
}
export async function checkSkills(root=project,restore=false,fetcher=fetch){
 const lock=JSON.parse(await readFile(resolve(root,'.agents/skills-lock.json'),'utf8'));
 if(lock.format!==1||!Array.isArray(lock.skills))throw new Error('Manifiesto de skills no válido.');
 const issues=[],missing=[];let checked=0;
 for(const skill of lock.skills){
  if(!/^[a-z0-9-]+$/.test(skill.name)||!/^[a-f0-9]{40}$/.test(skill.commit))throw new Error('Identidad o versión de skill no válida.');
  const base=safePath(root,`.agents/skills/${skill.name}`);await noLinks(root,base);
  for(const required of ['SKILL.md',skill.licenseFile,...skill.required])if(!Object.hasOwn(skill.files,required))throw new Error(`Falta ${skill.name}/${required} en el manifiesto.`);
  for(const [path,entry] of Object.entries(skill.files)){
   const target=safePath(base,path);await noLinks(root,target);sourceUrl(entry.url);
   let bytes;try{bytes=await readFile(target);}catch(e){if(e.code!=='ENOENT')throw e;}
   if(!bytes){missing.push({skill:skill.name,path,target,entry});continue;}
   if(digest(normalize(bytes))!==entry.sha256)issues.push(`${skill.name}/${path}: modificado; no se sobrescribe.`);
   checked++;
  }
  try{const content=await readFile(resolve(base,'SKILL.md'),'utf8');if(!/^---\r?\n/.test(content)||!/^name:\s*\S+/m.test(content)||!/^description:\s*\S+/m.test(content))issues.push(`${skill.name}: faltan metadatos.`);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 // A mismatch blocks the entire restoration before any download or write.
 if(restore&&issues.length)return {checked,restored:0,issues,missing:missing.length};
 let restored=0;
 for(const file of missing){
  if(!restore){issues.push(`${file.skill}/${file.path}: falta. Ejecuta npm run skills:restore.`);continue;}
  const response=await fetcher(sourceUrl(file.entry.url),{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`No se pudo recuperar ${file.skill}/${file.path} (${response.status}).`);
  let bytes=normalize(await response.arrayBuffer());
  for(const patch of file.entry.replacements||[])bytes=Buffer.from(bytes.toString('utf8').split(patch.from).join(patch.to));
  if(digest(bytes)!==file.entry.sha256)throw new Error(`La fuente de ${file.path} no coincide con la versión fijada.`);
  await noLinks(root,file.target);await mkdir(dirname(file.target),{recursive:true});await writeFile(file.target,bytes,{flag:'wx'});
  if(file.entry.executable&&process.platform!=='win32')await chmod(file.target,0o755);
  restored++;
 }
 return {checked,restored,issues,missing:missing.length};
}

export async function syncUser(target,root=project){
 if(!target)throw new Error('Indica --dest con la carpeta personal de skills.');
 const report=await checkSkills(root);if(report.issues.length)throw new Error(report.issues.join('\n'));
 const lock=JSON.parse(await readFile(resolve(root,'.agents/skills-lock.json'),'utf8'));
 const writes=[];
 for(const skill of lock.skills)for(const [path,entry] of Object.entries(skill.files)){
  const output=safePath(resolve(target),`${skill.name}/${path}`);await noLinks(resolve(target),output);
  const bytes=await readFile(safePath(root,`.agents/skills/${skill.name}/${path}`));
  try{const old=await readFile(output);if(digest(normalize(old))!==entry.sha256)throw new Error(`La copia personal difiere: ${skill.name}/${path}. Revisa antes de reemplazarla.`);}catch(e){if(e.code!=='ENOENT')throw e;writes.push({output,bytes,executable:entry.executable});}
 }
 for(const {output,bytes,executable} of writes){await mkdir(dirname(output),{recursive:true});await writeFile(output,bytes,{flag:'wx'});if(executable&&process.platform!=='win32')await chmod(output,0o755);}
 return writes.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const command=process.argv[2]||'check';
  if(command==='sync-user'){const idx=process.argv.indexOf('--dest');if(idx<0)throw new Error('Falta --dest.');console.log(`Copia personal: ${await syncUser(process.argv[idx+1])} archivos añadidos.`);}
  else if(command==='check'||command==='restore'){const result=await checkSkills(project,command==='restore');console.log(`${result.checked} archivos comprobados; ${result.restored} recuperados.`);for(const issue of result.issues)console.error(issue);if(result.issues.length)process.exitCode=1;else console.log('Skills completas y versiones correctas.');}
  else throw new Error('Usa check, restore o sync-user.');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
