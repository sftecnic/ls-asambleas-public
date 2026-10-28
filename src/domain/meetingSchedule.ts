import type {AppData,AppUser,AssemblyEvent,Meeting,MeetingPublication,Venue} from './types';
import {can} from './rules';

export interface MeetingScheduleRow {
  key:string;
  event:AssemblyEvent;
  venue?:Venue;
  meeting:Meeting|MeetingPublication;
  pub?:MeetingPublication;
  draft?:Meeting;
}

/** Presentation projection only. Match the existing meeting service's audience rules. */
export function meetingScheduleRows(data:AppData,user:AppUser,options:{publishedOnly?:boolean;offlineEventId?:string}={}):MeetingScheduleRow[] {
  const result:MeetingScheduleRow[]=[];
  for(const event of data.events.filter(e=>!e.archived&&(!options.offlineEventId||e.id===options.offlineEventId))){
    const manager=(m:Meeting)=>user.role!=='volunteer'&&m.departmentIds.some(d=>can(user,data,'edit',event.id,d)||can(user,data,'publish',event.id,d));
    const pubs=data.meetingPublications.filter(m=>m.eventId===event.id&&(options.offlineEventId||manager(m)||(m.recipientIds.includes(user.personId)&&m.departmentIds.some(d=>can(user,data,'view',event.id,d)))));
    const drafts=options.publishedOnly||options.offlineEventId?[]:data.meetings.filter(m=>m.eventId===event.id&&manager(m));
    for(const id of new Set([...pubs,...drafts].map(m=>m.id))){
      const publication=pubs.find(m=>m.id===id),draft=drafts.find(m=>m.id===id);
      const pub=publication&&!manager(publication)?{...publication,additionalPersonIds:[],recipientIds:publication.recipientIds.filter(id=>id===user.personId)}:publication;
      // The published date and departments remain authoritative until confirmation.
      result.push({key:`${event.id}:${id}`,event,venue:data.venues.find(v=>v.id===event.venueId),meeting:pub||draft!,pub,draft});
    }
  }
  return result.sort((a,b)=>(instant(a.meeting.startsAt)-instant(b.meeting.startsAt))||a.key.localeCompare(b.key));
}

const instant=(value:string)=>Number.isFinite(Date.parse(value))?Date.parse(value):Number.MAX_SAFE_INTEGER;
export function meetingDay(value:string,timezone:string):string {
  if(!Number.isFinite(Date.parse(value)))return '';
  return new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
export function meetingInProgress(meeting:Meeting|MeetingPublication,now:number):boolean {
  return 'version' in meeting&&meeting.status==='confirmed'&&Date.parse(meeting.startsAt)<=now&&Date.parse(meeting.startsAt)+meeting.duration*60000>now;
}
export function initialMeetingMonth(rows:MeetingScheduleRow[],fallbackDate:string,timezone:string,now=Date.now()):string {
  const dated=rows.filter(r=>meetingDay(r.meeting.startsAt,timezone));
  const next=dated.find(r=>meetingInProgress(r.meeting,now)||Date.parse(r.meeting.startsAt)>=now);
  return (next?meetingDay(next.meeting.startsAt,timezone):dated.length?meetingDay(dated.at(-1)!.meeting.startsAt,timezone):fallbackDate).slice(0,7);
}
export function shiftMeetingMonth(month:string,offset:number):string {
  const [year,m]=month.split('-').map(Number);
  return new Date(Date.UTC(year,m-1+offset,1)).toISOString().slice(0,7);
}
export function meetingMonthDays(month:string):(string|null)[] {
  const [year,m]=month.split('-').map(Number),first=new Date(Date.UTC(year,m-1,1));
  const offset=(first.getUTCDay()+6)%7,count=new Date(Date.UTC(year,m,0)).getUTCDate();
  const days:(string|null)[]=Array(offset).fill(null);
  for(let day=1;day<=count;day++)days.push(`${month}-${String(day).padStart(2,'0')}`);
  while(days.length%7)days.push(null);
  return days;
}
export function groupMeetingDays(rows:MeetingScheduleRow[],timezone:string):Map<string,MeetingScheduleRow[]> {
  const groups=new Map<string,MeetingScheduleRow[]>();
  for(const row of rows){const day=meetingDay(row.meeting.startsAt,timezone);const group=groups.get(day)||[];group.push(row);groups.set(day,group);}
  return groups;
}
