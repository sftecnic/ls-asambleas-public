import {describe,it,expect} from 'vitest';
import {nextService} from './home';
import type {Shift} from './types';
const shift=(id:string,startsAt:string,endsAt:string,attendance:Shift['attendance']='planned'):Shift=>({id,startsAt,endsAt,attendance,eventId:'e',departmentId:'d',personId:'p',role:'Cámara',meetingPoint:'',status:'published',substituteIds:[]});
describe('next service',()=>{
  const now=Date.parse('2027-04-10T10:00:00Z');
  it('skips an ended morning service and selects the future service',()=>{const old=shift('old','2027-04-10T08:00:00Z','2027-04-10T09:00:00Z'),future=shift('future','2027-04-10T12:00:00Z','2027-04-10T14:00:00Z');expect(nextService([old,future],now)?.id).toBe('future');});
  it('selects an ongoing service before later ones regardless of input order',()=>{const active=shift('active','2027-04-10T09:00:00Z','2027-04-10T11:00:00Z','present'),later=shift('later','2027-04-10T12:00:00Z','2027-04-10T14:00:00Z');expect(nextService([later,active],now)?.id).toBe('active');});
  it('does not advertise absent or replaced assignments as upcoming',()=>{const rows=(['absent','replaced'] as const).map(status=>shift(status,'2027-04-10T12:00:00Z','2027-04-10T14:00:00Z',status));expect(nextService(rows,now)).toBeUndefined();});
  it('treats a legacy completed assignment as present without mutating it',()=>{const legacy=shift('legacy','2027-04-10T09:00:00Z','2027-04-10T11:00:00Z','completed');expect(nextService([legacy],now)?.id).toBe('legacy');expect(legacy.attendance).toBe('completed');});
  it('treats the exact end time as finished and leaves the source unchanged',()=>{const rows=[shift('later','2027-04-10T12:00:00Z','2027-04-10T14:00:00Z'),shift('ended','2027-04-10T09:00:00Z','2027-04-10T10:00:00Z')];expect(nextService(rows,now)?.id).toBe('later');expect(rows[0].id).toBe('later');});
});
