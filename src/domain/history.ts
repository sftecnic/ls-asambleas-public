import type {AppData,AppUser,AssemblyEvent,Candidate,Person,Shift} from './types';
import {can,isAdmin} from './rules';
import {teamRole,teamRoleLabels,searchKey} from './team';
import {attendanceState} from './attendance';
import {compareShiftPosts} from './shiftPosts';
import {toLocalInput} from './format';

export interface HistoryFilters {year:string;eventId:string;departmentId:string;personId:string;query:string}
export interface HistoryPerson {personId:string;person?:Person;candidates:Candidate[];shifts:Shift[]}
export interface HistoryEvent {event:AssemblyEvent;year:string;departments:{id:string;people:HistoryPerson[]}[]}
export const eventYear=(event:AssemblyEvent)=>event.startDate.slice(0,4);
export function eventPeriod(event:AssemblyEvent,now=Date.now()){
  const today=toLocalInput(new Date(now).toISOString(),event.timezone).slice(0,10);
  return event.startDate>today?'Próximo':event.endDate<today?'Anterior':'En curso';
}
export function historyScope(data:AppData,user:AppUser){
  const allowed=(row:{eventId:string;departmentId:string})=>can(user,data,'view',row.eventId,row.departmentId);
  const shifts=data.shifts.filter(allowed),candidates=data.candidates.filter(c=>allowed(c)&&(teamRole(c)==='supervisor'||c.committee==='approved'&&c.availability==='accepted'));
  const eventIds=new Set([...shifts,...candidates].map(row=>row.eventId));
  const events=data.events.filter(event=>eventIds.has(event.id)).sort((a,b)=>b.startDate.localeCompare(a.startDate)||a.id.localeCompare(b.id));
  return {shifts,candidates,events};
}
export function historyEvents(data:AppData,user:AppUser,filters:HistoryFilters):HistoryEvent[]{
  const scope=historyScope(data,user),query=searchKey(filters.query);
  return scope.events.filter(event=>(!filters.year||eventYear(event)===filters.year)&&(!filters.eventId||event.id===filters.eventId)).map(event=>{
    const candidates=scope.candidates.filter(c=>c.eventId===event.id),shifts=scope.shifts.filter(s=>s.eventId===event.id);
    const ids=[...new Set([...candidates,...shifts].map(row=>row.departmentId))];
    const departments=ids.filter(id=>!filters.departmentId||id===filters.departmentId).sort((a,b)=>(data.departments.find(d=>d.id===a)?.name||a).localeCompare(data.departments.find(d=>d.id===b)?.name||b,'es')).map(id=>{
      const people=[...new Set([...candidates,...shifts].filter(row=>row.departmentId===id).map(row=>row.personId))].filter(personId=>!filters.personId||personId===filters.personId).map(personId=>({personId,person:data.persons.find(p=>p.id===personId),candidates:candidates.filter(c=>c.departmentId===id&&c.personId===personId),shifts:shifts.filter(s=>s.departmentId===id&&s.personId===personId).sort(compareShiftPosts)})).filter(row=>!query||searchKey([row.person?.name,...(row.person?.aliases||[]),...row.shifts.map(s=>s.role),...row.candidates.map(c=>teamRoleLabels[teamRole(c)])].join(' ')).includes(query));
      people.sort((a,b)=>(a.person?.name||'').localeCompare(b.person?.name||'','es')||a.personId.localeCompare(b.personId));
      return {id,people};
    }).filter(department=>department.people.length);
    return {event,year:eventYear(event),departments};
  }).filter(group=>group.departments.length);
}
export function personExperience(data:AppData,user:AppUser,personId:string,now=Date.now()){
  const scope=historyScope(data,user),past=scope.events.filter(event=>eventPeriod(event,now)==='Anterior'),ids=new Set(past.map(event=>event.id));
  const assignments=scope.shifts.filter(s=>s.personId===personId&&ids.has(s.eventId)&&s.attendance!=='replaced');
  const present=assignments.filter(s=>attendanceState(s.attendance)==='present'&&Date.parse(s.endsAt)<=now);
  return {assignedEvents:new Set(assignments.map(s=>s.eventId)).size,presentEvents:new Set(present.map(s=>s.eventId)).size};
}
export function historyChanges(data:AppData,user:AppUser,filters:Pick<HistoryFilters,'year'|'eventId'|'query'>){
  return data.audit.filter(row=>{
    if(!isAdmin(user,data)&&!can(user,data,'view',row.eventId,'*'))return false;
    const event=data.events.find(event=>event.id===row.eventId),year=event?eventYear(event):row.at.slice(0,4);
    return (!filters.year||year===filters.year)&&(!filters.eventId||row.eventId===filters.eventId)&&(!filters.query||searchKey(`${row.action} ${row.actor}`).includes(searchKey(filters.query)));
  }).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
