import type {Meeting} from './types';
export const zoomDetails=(m:Pick<Meeting,'zoomUrl'|'zoomMeetingId'|'zoomPasscode'>)=>['Zoom',m.zoomUrl,m.zoomMeetingId?`Número: ${m.zoomMeetingId}`:'',m.zoomPasscode?`Código: ${m.zoomPasscode}`:''].filter(Boolean).join('\n');
