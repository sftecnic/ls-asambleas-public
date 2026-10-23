import type {Shift} from './types';

export type EditableAttendance = 'planned' | 'present' | 'absent';

/** Older completed services imply presence; reading them must not rewrite history. */
export function attendanceState(value:Shift['attendance']):EditableAttendance|'replaced'{
  return value==='completed'?'present':value;
}
