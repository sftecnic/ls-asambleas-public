import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkSkills,digest,normalize,safePath,syncUser} from '../scripts/skills.mjs';
const source='https://raw.githubusercontent.com/example/skills/'+'a'.repeat(40)+'/';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'ls-skills-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const files={'SKILL.md':'---\nname: sample\ndescription: Example\n---\n','LICENSE':'MIT\n','reference.md':'Fixed reference\n'};
 const skill={name:'sample',commit:'a'.repeat(40),licenseFile:'LICENSE',required:['reference.md'],files:Object.fromEntries(Object.entries(files).map(([path,content])=>[path,{sha256:digest(Buffer.from(content)),url:source+path}]))};
 await mkdir(join(root,'.agents'),{recursive:true});await writeFile(join(root,'.agents/skills-lock.json'),JSON.stringify({format:1,skills:[skill]}));
 const fetcher=async url=>new Response(files[new URL(url).pathname.split('/').at(-1)],{status:200});return {root,files,fetcher};
}
test('complete pinned skills are included in this checkout',async()=>assert.deepEqual((await checkSkills()).issues,[]));
test('restoration is idempotent and validates Windows line endings',async t=>{
 const {root,fetcher}=await fixture(t);assert.equal((await checkSkills(root,true,fetcher)).restored,3);
 await writeFile(join(root,'.agents/skills/sample/LICENSE'),'MIT\r\n');
 const second=await checkSkills(root,true,()=>{throw Error('Unexpected network');});assert.equal(second.restored,0);assert.deepEqual(second.issues,[]);
});
test('a modified file blocks all recovery without overwriting local work',async t=>{
 const {root,fetcher}=await fixture(t);await checkSkills(root,true,fetcher);await writeFile(join(root,'.agents/skills/sample/LICENSE'),'Changed');await rm(join(root,'.agents/skills/sample/reference.md'));
 const report=await checkSkills(root,true,()=>{throw Error('No download when modified');});assert.equal(report.restored,0);assert.equal(report.issues.length,1);assert.equal(await readFile(join(root,'.agents/skills/sample/LICENSE'),'utf8'),'Changed');
});
test('wrong bytes never become a restored file',async t=>{
 const {root}=await fixture(t);await assert.rejects(checkSkills(root,true,async()=>new Response('unexpected')),/no coincide/);
 await assert.rejects(readFile(join(root,'.agents/skills/sample/SKILL.md')), {code:'ENOENT'});
});
test('traversal, absolute paths and mutable URLs are rejected',async t=>{
 for(const path of ['../escape','/absolute','C:/data','nested/../../a','nested\\a'])assert.throws(()=>safePath(tmpdir(),path));
 const {root}=await fixture(t),path=join(root,'.agents/skills-lock.json'),lock=JSON.parse(await readFile(path,'utf8'));lock.skills[0].files['SKILL.md'].url='https://raw.githubusercontent.com/example/skills/main/SKILL.md';await writeFile(path,JSON.stringify(lock));await assert.rejects(checkSkills(root,true),/commit fijo/);
});
test('personal synchronization preserves a different installed skill',async t=>{
 const {root,fetcher}=await fixture(t);await checkSkills(root,true,fetcher);const target=join(root,'personal');assert.equal(await syncUser(target,root),3);assert.equal(await syncUser(target,root),0);
 await writeFile(join(target,'sample/LICENSE'),'Keep');await assert.rejects(syncUser(target,root),/copia personal difiere/);assert.equal(await readFile(join(target,'sample/LICENSE'),'utf8'),'Keep');
});
test('checksums normalize line endings only',()=>{assert.equal(digest(normalize('a\r\nb')),digest(normalize('a\nb')));assert.notEqual(digest(normalize('a\nb')),digest(normalize('a\nb ')));});
