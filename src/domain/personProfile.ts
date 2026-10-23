import type {HearingStatus,Person} from './types';

export const hearingOptions=[['unknown','Sin indicar'],['deaf','Sorda'],['hearing','Oyente']] as const;
export const hearingLabel=(person:Pick<Person,'hearingStatus'>)=>hearingOptions.find(([value])=>value===(person.hearingStatus??'unknown'))?.[1]??'Sin indicar';
export const validHearingStatus=(value:unknown):value is HearingStatus=>hearingOptions.some(([key])=>key===value);
import type {AppData,AppUser,Person as ProfilePerson} from './types';
import {can,isAdmin} from './rules';
import {personMatches} from './team';

export interface ProfileFilters {congregationId:string;hearingStatus:string;query:string}
export const canReadProfile=(data:AppData,user:AppUser,personId:string)=>isAdmin(user,data)||data.candidates.some(c=>c.personId===personId&&can(user,data,'contacts',c.eventId,c.departmentId));
export function profileMatches(data:AppData,person:ProfilePerson,filters:ProfileFilters,authorized:boolean){
  return (!filters.congregationId||person.congregationId===filters.congregationId)
    &&(!filters.hearingStatus||authorized&&(person.hearingStatus??'unknown')===filters.hearingStatus)
    &&personMatches(person,filters.query,data.congregations.find(c=>c.id===person.congregationId)?.name);
}
export function profileStats(people:ProfilePerson[],authorizedIds:Set<string>){
  const unique=[...new Map(people.map(p=>[p.id,p])).values()],visible=unique.filter(p=>authorizedIds.has(p.id));
  return {total:unique.length,visible:visible.length,deaf:visible.filter(p=>p.hearingStatus==='deaf').length,hearing:visible.filter(p=>p.hearingStatus==='hearing').length,unknown:visible.filter(p=>!p.hearingStatus||p.hearingStatus==='unknown').length};
}
