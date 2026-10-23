import type {Shift} from './types';
import {attendanceState} from './attendance';

/** An active service comes first, followed by upcoming services. Finished or unavailable services remain in history. */
export function nextService(shifts:Shift[],now=Date.now()):Shift|undefined{
  return shifts.filter(shift=>!['replaced','absent'].includes(attendanceState(shift.attendance))&&Date.parse(shift.endsAt)>now)
    .sort((a,b)=>a.startsAt.localeCompare(b.startsAt))[0];
}
