import type { AppData, Candidate, Person, Publication, PublishedTeamMember, TeamRole } from './types';

export type TeamFilter='all'|'committee'|'availability'|'ready'|'reserve';
export const teamRoleLabels:Record<TeamRole,string>={responsible:'Responsable',assistant:'Auxiliar',volunteer:'Voluntario',supervisor:'Supervisor'};
export const teamRoleOrder:Record<TeamRole,number>={responsible:0,assistant:1,volunteer:2,supervisor:3};
export function isPublishedTeamMember(value:unknown):value is PublishedTeamMember {
  if(!value||typeof value!=='object')return false;
  const row=value as Record<string,unknown>;
  return Object.keys(row).every(key=>['personId','name','role'].includes(key))
    &&typeof row.personId==='string'&&row.personId.length>0&&row.personId.length<=240
    &&typeof row.name==='string'&&row.name.trim().length>0&&row.name.length<=160
    &&typeof row.role==='string'&&Object.hasOwn(teamRoleOrder,row.role);
}
export const publicationTeam=(publication:Publication):PublishedTeamMember[]=>Array.isArray(publication.team)?publication.team.filter(isPublishedTeamMember):[];
export const teamRole=(candidate:Pick<Candidate,'teamRole'>):TeamRole=>candidate.teamRole||'volunteer';
export const searchKey=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();
export function personMatches(person:Person,query:string,congregation=''):boolean {
  return [person.name,...(person.aliases||[]),congregation].some(value=>searchKey(value).includes(searchKey(query)));
}
export function matchesTeamFilter(c:Candidate,filter:TeamFilter):boolean {
  return filter==='all'||filter==='committee'&&['proposed','pending'].includes(c.committee)
    ||filter==='availability'&&c.committee==='approved'&&['unknown','invited'].includes(c.availability)
    ||filter==='ready'&&c.committee==='approved'&&c.availability==='accepted'||filter==='reserve'&&c.reserve;
}
export function groupPeople(rows:Candidate[]):{personId:string;candidates:Candidate[]}[] {
  const groups=new Map<string,Candidate[]>();
  rows.forEach(c=>groups.set(c.personId,[...(groups.get(c.personId)||[]),c]));
  return [...groups].map(([personId,candidates])=>({personId,candidates}));
}
export function sortTeamGroups(data:AppData,groups:ReturnType<typeof groupPeople>) {
  const order=(group:typeof groups[number])=>Math.min(...group.candidates.map(c=>teamRoleOrder[teamRole(c)]));
  return [...groups].sort((a,b)=>order(a)-order(b)||(data.persons.find(p=>p.id===a.personId)?.name||'').localeCompare(data.persons.find(p=>p.id===b.personId)?.name||'','es'));
}
export function teamView(data:AppData,eventId:string,departmentId='',query='') {
  const scoped=data.candidates.filter(c=>c.eventId===eventId&&(!departmentId||c.departmentId===departmentId)).filter(c=>{
    const person=data.persons.find(p=>p.id===c.personId);
    return !query.trim()||Boolean(person&&personMatches(person,query,data.congregations.find(g=>g.id===person.congregationId)?.name));
  });
  const operational=scoped.filter(c=>teamRole(c)!=='supervisor');
  const counts=Object.fromEntries((['all','committee','availability','ready','reserve'] as const).map(filter=>[filter,new Set(operational.filter(c=>matchesTeamFilter(c,filter)).map(c=>c.personId)).size])) as Record<TeamFilter,number>;
  return {operational,supervisors:groupPeople(scoped.filter(c=>teamRole(c)==='supervisor')),counts};
}
