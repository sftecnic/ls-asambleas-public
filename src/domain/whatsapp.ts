import type {AppData,AppUser,Grant} from './types';
import {can} from './rules';
import {teamRole,teamRoleOrder} from './team';

export interface PersonReference {personId:string;name:string}
export interface LeadershipContact extends PersonReference {
 departmentId:string;
 role:'responsible'|'assistant';
 /** Canonical international number, or empty when the stored phone is unusable. */
 phone:string;
}

/** Link formatting only: never rewrites the saved contact or guesses between numbers. */
export function whatsappNumber(value:unknown):string|null {
 if(typeof value!=='string'||value.length>50||!/^[+\d\s().-]+$/.test(value))return null;
 const compact=value.replace(/[\s().-]/g,'');
 let digits:string;
 if(/^[6-9]\d{8}$/.test(compact))digits='34'+compact;
 else if(/^34[6-9]\d{8}$/.test(compact))digits=compact;
 else if(compact.startsWith('+'))digits=compact.slice(1);
 else if(compact.startsWith('00'))digits=compact.slice(2);
 else return null;
 if(!/^[1-9]\d{7,14}$/.test(digits))return null;
 if(digits.startsWith('34')&&!/^34[6-9]\d{8}$/.test(digits))return null;
 return digits;
}
export const whatsappHref=(phone:unknown)=>{const digits=whatsappNumber(phone);return digits?'https://wa.me/'+digits:null;};

export function hasEventView(user:AppUser,grants:Grant[],eventId:string){
 const data={grants} as AppData;
 return grants.some(g=>can(user,data,'view',eventId,g.departmentId));
}
export function leadershipContacts(data:AppData,user:AppUser,eventId:string):LeadershipContact[]{
 const people=new Map(data.persons.map(p=>[p.id,p]));
 const result=new Map<string,LeadershipContact>();
 for(const c of data.candidates){
  const role=teamRole(c);
  if(c.eventId!==eventId||!['responsible','assistant'].includes(role)||c.committee!=='approved'||c.availability!=='accepted'||!can(user,data,'view',eventId,c.departmentId))continue;
  const person=people.get(c.personId);if(!person)continue;
  const phone=whatsappNumber(person.phone);
  result.set(c.departmentId+'~'+c.personId,{personId:person.id,name:person.name,departmentId:c.departmentId,role:role as LeadershipContact['role'],phone:phone?'+'+phone:''});
 }
 return [...result.values()].sort((a,b)=>a.departmentId.localeCompare(b.departmentId)||teamRoleOrder[a.role]-teamRoleOrder[b.role]||a.name.localeCompare(b.name,'es')||a.personId.localeCompare(b.personId));
}

export function validateLeadershipContacts(value:unknown):asserts value is LeadershipContact[]{
 if(!Array.isArray(value)||value.length>1000)throw new Error('Respuesta de contactos no válida.');
 const seen=new Set<string>();
 for(const c of value){
  if(!c||typeof c!=='object'||Object.keys(c).some(k=>!['personId','name','departmentId','role','phone'].includes(k))||!['personId','name','departmentId'].every(k=>typeof c[k]==='string'&&c[k].trim()&&c[k].length<=240)||c.personId.includes('/')||c.departmentId.includes('/')||!['responsible','assistant'].includes(c.role)||typeof c.phone!=='string'||c.phone!==''&&(!whatsappNumber(c.phone)||c.phone!=='+'+whatsappNumber(c.phone)))throw new Error('Respuesta de contactos no válida.');
  const key=c.departmentId+'~'+c.personId;if(seen.has(key))throw new Error('Contacto duplicado.');seen.add(key);
 }
}
