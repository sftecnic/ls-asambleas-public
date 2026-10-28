import {describe,it,expect} from 'vitest';
import {createDemoData} from '../src/seed';
import type {Meeting,MeetingPublication,AppUser} from '../src/domain/types';
import {meetingScheduleRows,meetingDay,meetingInProgress,initialMeetingMonth,shiftMeetingMonth,meetingMonthDays,groupMeetingDays} from '../src/domain/meetingSchedule';
const admin:AppUser={uid:'demo-admin',email:'admin@example.test',personId:'p-admin',name:'Elena',role:'admin'};
const base:Meeting={id:'m1',eventId:'e1',departmentIds:['video'],kind:'zoom',title:'Formación',startsAt:'2027-03-10T18:00:00.000Z',duration:60,location:'',address:'',zoomUrl:'',instructions:'',sessionDate:'2027-04-10',session:'morning',additionalPersonIds:[]};
const publication=(patch:Partial<MeetingPublication>={}):MeetingPublication=>({...base,version:1,status:'confirmed',recipientIds:['p1'],publishedAt:'2027-01-01T10:00:00.000Z',publishedBy:'demo-admin',...patch});
describe('meeting schedule presentation',()=>{
 it('merges by event and meeting and keeps confirmed date and departments over draft edits',()=>{
  const data=createDemoData();data.meetings=[{...base,startsAt:'2027-05-01T08:00:00.000Z',departmentIds:['makeup']}];data.meetingPublications=[publication(),publication({eventId:'e2'})];
  const rows=meetingScheduleRows(data,admin);expect(rows).toHaveLength(2);expect(rows[0].meeting.startsAt).toBe(base.startsAt);expect(rows[0].meeting.departmentIds).toEqual(['video']);expect(rows[0].draft?.departmentIds).toEqual(['makeup']);
 });
 it('excludes archived and unauthorized events, and volunteers see only their invitations',()=>{
  const data=createDemoData();data.meetingPublications=[publication(),publication({id:'other',recipientIds:['p2']}),publication({id:'e2',eventId:'e2',recipientIds:['p1']})];data.meetings=[{...base,id:'draft',startsAt:''}];
  const volunteer:AppUser={uid:'demo-volunteer',email:'voluntario@example.test',personId:'p1',name:'Lucía',role:'volunteer'};
  expect(meetingScheduleRows(data,volunteer).map(r=>r.key)).toEqual(['e1:m1']);
  data.meetingPublications[0].recipientIds.push('p2');data.meetingPublications[0].additionalPersonIds=['p2'];
  const own=meetingScheduleRows(data,volunteer)[0].pub!;expect(own.recipientIds).toEqual(['p1']);expect(own.additionalPersonIds).toEqual([]);
  data.events[0].archived=true;expect(meetingScheduleRows(data,volunteer)).toEqual([]);
 });
 it('uses edit and publish grants rather than duties or the displayed role',()=>{
  const data=createDemoData();data.grants=data.grants.filter(g=>g.email!==admin.email);data.meetings=[base];data.meetingPublications=[publication()];
  expect(meetingScheduleRows(data,admin)).toEqual([]);
  data.grants.push({id:'g',email:admin.email,eventId:'e1',departmentId:'video',role:'assistant',capabilities:['view','edit'],active:true});expect(meetingScheduleRows(data,{...admin,role:'assistant'})).toHaveLength(1);
 });
 it('offline only uses publications from the saved event; published mode hides drafts',()=>{
  const data=createDemoData();data.meetings=[{...base,id:'draft',startsAt:''}];data.meetingPublications=[publication(),publication({eventId:'e2'})];
  expect(meetingScheduleRows(data,admin,{publishedOnly:true}).every(r=>!r.draft)).toBe(true);
  data.grants=[];const rows=meetingScheduleRows(data,admin,{offlineEventId:'e1'});expect(rows).toHaveLength(1);expect(rows[0].draft).toBeUndefined();
 });
 it('orders dates, stable ties and undated rows without inventing a date',()=>{
  const data=createDemoData();data.meetings=[{...base,id:'z',startsAt:''},{...base,id:'b'},{...base,id:'a'}];
  const rows=meetingScheduleRows(data,admin);expect(rows.map(r=>r.meeting.id)).toEqual(['a','b','z']);expect([...groupMeetingDays(rows,'Europe/Madrid').keys()]).toEqual(['2027-03-10','']);
 });
 it('chooses in-progress or next month, then most recent, then assembly month',()=>{
  const data=createDemoData();data.meetingPublications=[publication()];const rows=meetingScheduleRows(data,admin);
  expect(initialMeetingMonth(rows,'2027-04-10','Europe/Madrid',Date.parse('2027-03-10T18:30Z'))).toBe('2027-03');
  expect(initialMeetingMonth(rows,'2027-04-10','Europe/Madrid',Date.parse('2028-01-01'))).toBe('2027-03');
  expect(initialMeetingMonth([],'2027-04-10','Europe/Madrid')).toBe('2027-04');
  expect(meetingInProgress(publication(),Date.parse('2027-03-10T19:00Z'))).toBe(false);
  expect(meetingInProgress(publication({status:'cancelled'}),Date.parse('2027-03-10T18:30Z'))).toBe(false);
 });
 it('groups by the display timezone across midnight and DST fallback',()=>{
  expect(meetingDay('2026-10-24T22:30:00Z','Europe/Madrid')).toBe('2026-10-25');
  expect(meetingDay('2026-10-25T01:30:00Z','Europe/Madrid')).toBe('2026-10-25');
  expect(meetingDay('2026-10-24T22:30:00Z','Atlantic/Canary')).toBe('2026-10-24');
  expect(meetingDay('','Europe/Madrid')).toBe('');
 });
 it('builds Monday-first months, leap days and year navigation',()=>{
  expect(meetingMonthDays('2027-02')[0]).toBe('2027-02-01');expect(meetingMonthDays('2027-02')).toHaveLength(28);
  expect(meetingMonthDays('2028-02')).toContain('2028-02-29');expect(shiftMeetingMonth('2027-12',1)).toBe('2028-01');expect(shiftMeetingMonth('2027-01',-1)).toBe('2026-12');
 });
});
