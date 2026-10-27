import type {AppData,AssemblyEvent,MeetingPublication,Person} from './types';
import {fromLocalInput,toLocalInput} from './format';
import {meetingRecipients,meetingReminders,validEmail} from './meetings';
import {zoomDetails} from './zoom';
export type CalendarKind='event'|'meeting';
export type CalendarResponse='accepted'|'declined'|'tentative'|'needsAction';
export const calendarResponseLabels:Record<CalendarResponse,string>={accepted:'Sí',declined:'No',tentative:'Quizás',needsAction:'Sin respuesta'};
export interface CalendarSnapshot {eventId:string;kind:CalendarKind;sourceId:string;appOrigin:string;title:string;description:string;location:string;timezone:string;startDate:string;endDate:string;startsAt:string;endsAt:string;departmentIds:string[];recipientIds:string[];status:'confirmed'|'cancelled'}
export const calendarEmail=(p:Pick<Person,'gmail'|'email'|'notificationEmail'>)=>(p.gmail?.trim()||p.notificationEmail?.trim()||p.email?.trim()||'').toLowerCase();
export function calendarAudience(people:Person[]){
 const emails=people.map(p=>calendarEmail(p)),counts=new Map<string,number>();for(const email of emails)if(email)counts.set(email,(counts.get(email)||0)+1);
 return people.map((p,i)=>({personId:p.id,name:p.name,email:emails[i],issue:!validEmail(emails[i])?'missing-email':counts.get(emails[i])!>1?'shared-email':''}));
}
export function validateEventHours(e:AssemblyEvent){
 for(const value of [e.startsAt,e.endsAt])if(value!==undefined&&(typeof value!=='string'||value.length>40||value&&!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)))throw Error('Indica horas válidas en la zona del evento.');
 if(!e.startsAt&&!e.endsAt)return;
 if(!e.startsAt||!e.endsAt||!Number.isFinite(Date.parse(e.startsAt))||!Number.isFinite(Date.parse(e.endsAt))||e.endsAt<=e.startsAt||toLocalInput(e.startsAt,e.timezone).slice(0,10)!==e.startDate||toLocalInput(e.endsAt,e.timezone).slice(0,10)!==e.endDate)throw Error('Indica inicio y final dentro de las fechas de la asamblea.');
}
export function validateCalendarEvent(e:AssemblyEvent){
 for(const [field,max] of [['id',240],['title',200],['startDate',10],['endDate',10],['venueId',240],['section',200],['timezone',100]] as const)if(typeof e[field]!=='string'||e[field].length>max)throw Error('Revisa los datos del evento.');
 if(!e.title.trim()||!e.venueId||e.venueId.includes('/')||!['circuit','regional','pioneers'].includes(e.type)||typeof e.archived!=='boolean')throw Error('Completa nombre, tipo y sede.');
 for(const day of [e.startDate,e.endDate])if(!/^\d{4}-\d\d-\d\d$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00Z'))||new Date(day+'T12:00Z').toISOString().slice(0,10)!==day)throw Error('Revisa las fechas del evento.');
 if(e.endDate<e.startDate)throw Error('El final debe ser posterior al inicio.');
 try{new Intl.DateTimeFormat('es',{timeZone:e.timezone});}catch{throw Error('Zona horaria no válida.');}validateEventHours(e);
}
export function calendarSnapshot(data:AppData,kind:CalendarKind,id:string,origin:string,meeting?:MeetingPublication):CalendarSnapshot{
 const m=meeting||data.meetingPublications.find(m=>m.id===id),e=data.events.find(e=>e.id===(kind==='meeting'?m?.eventId:id));if(!e)throw Error('Evento no disponible.');validateCalendarEvent(e);
 const candidates=data.candidates.filter(c=>c.eventId===e.id&&c.committee==='approved'&&c.availability==='accepted'&&c.teamRole!=='supervisor');
 const venue=data.venues.find(v=>v.id===e.venueId),deps=kind==='meeting'?m!.departmentIds:[...new Set(candidates.map(c=>c.departmentId))];
 if(kind==='meeting'&&!m)throw Error('Reunión no disponible.');
 const recipientIds=kind==='meeting'?meetingRecipients(data,m!):[...new Set(candidates.map(c=>c.personId))].sort();
 const location=kind==='meeting'?(m!.kind==='zoom'?'Zoom':[m!.location,m!.address].filter(Boolean).join(' · ')):[venue?.name,venue?.address,venue?.city].filter(Boolean).join(' · ');
 return {eventId:e.id,kind,sourceId:id,appOrigin:origin,title:kind==='meeting'?m!.title:e.title,description:[e.title,data.departments.filter(d=>deps.includes(d.id)).map(d=>d.name).join(' · '),kind==='meeting'&&m!.kind==='zoom'?zoomDetails(m!):'',kind==='meeting'?m!.instructions:'',`${origin}/?evento=${encodeURIComponent(e.id)}${kind==='meeting'?'&reunion='+encodeURIComponent(id):''}`].filter(Boolean).join('\n\n'),location,timezone:e.timezone,startDate:kind==='meeting'?toLocalInput(m!.startsAt,e.timezone).slice(0,10):e.startDate,endDate:kind==='meeting'?toLocalInput(m!.startsAt,e.timezone).slice(0,10):e.endDate,startsAt:kind==='meeting'?m!.startsAt:e.startsAt||'',endsAt:kind==='meeting'?new Date(Date.parse(m!.startsAt)+m!.duration*60000).toISOString():e.endsAt||'',departmentIds:deps,recipientIds,status:kind==='meeting'?m!.status:'confirmed'};
}
export function calendarReminders(s:CalendarSnapshot,now:string){
 const at=s.startsAt||fromLocalInput(s.startDate+'T12:00',s.timezone);
 return meetingReminders(at,s.timezone,now).filter(r=>!!s.startsAt||r.kind==='previous-day');
}
export const calendarEnd=(s:CalendarSnapshot)=>s.endsAt||fromLocalInput(s.endDate+'T23:59',s.timezone);
export function googleCalendarBody(s:CalendarSnapshot,emails:string[],marker:string){
 const nextDay=new Date(Date.parse(s.endDate+'T12:00Z')+86400000).toISOString().slice(0,10);
 return {summary:s.title,description:s.description,location:s.location,start:s.startsAt?{dateTime:s.startsAt,timeZone:s.timezone}:{date:s.startDate},end:s.endsAt?{dateTime:s.endsAt,timeZone:s.timezone}:{date:nextDay},visibility:'private',guestsCanModify:false,guestsCanInviteOthers:false,guestsCanSeeOtherGuests:false,attendees:emails.map(email=>({email})),extendedProperties:{private:{lsAsambleas:marker}},reminders:{useDefault:false}};
}
