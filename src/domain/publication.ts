import type { AppData, AppUser, AssemblyEvent } from './types';
import { uid } from './format';
import { can } from './rules';
import { teamRole } from './team';

export function publishDepartment(data: AppData, event: AssemblyEvent, departmentId: string, user: AppUser): AppData {
  const next = structuredClone(data);
  const previous = next.publications.filter(p => p.eventId === event.id && p.departmentId === departmentId).sort((a, b) => b.version - a.version)[0];
  const at = new Date().toISOString();
  next.shifts = next.shifts.map(s => s.eventId === event.id && s.departmentId === departmentId ? { ...s, status: 'published' } : s);
  const publishProgram = can(user, data, 'publish', event.id, 'platform');
  if (publishProgram) {
    next.program = next.program.map(p => p.eventId === event.id ? { ...p, status: 'published' } : p);
    next.plans = next.plans.map(p => p.eventId === event.id ? { ...p, status: 'published' } : p);
  }
  const latestProgram = next.publications.filter(p => p.eventId === event.id).sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const shifts=next.shifts.filter(s=>s.eventId===event.id&&s.departmentId===departmentId);
  const candidates=data.candidates.filter(c=>c.eventId===event.id&&c.departmentId===departmentId);
  const memberIds=new Set([...shifts.flatMap(s=>[s.personId,...s.substituteIds]),...candidates.filter(c=>['responsible','assistant'].includes(teamRole(c))).map(c=>c.personId)]);
  const team=data.persons.filter(p=>memberIds.has(p.id)).map(p=>({personId:p.id,name:p.name,role:teamRole(candidates.find(c=>c.personId===p.id)||{})}));
  const publication = {
    id: `pub-${event.id}-${departmentId}-v${(previous?.version ?? 0) + 1}`,
    eventId: event.id, departmentId, version: (previous?.version ?? 0) + 1, publishedAt: at, publishedBy: user.name,
    department: structuredClone(data.departments.find(d => d.id === departmentId)),
    team,
    shifts: structuredClone(shifts),
    program: structuredClone(publishProgram ? next.program.filter(p => p.eventId === event.id) : latestProgram?.program ?? []).map(p => ({ ...p, speakerEmail: '' })),
    plans: structuredClone(publishProgram ? next.plans.filter(p => p.eventId === event.id) : latestProgram?.plans ?? []),
  };
  next.publications.push(publication);
  next.notices.push({ id: uid(), eventId: event.id, departmentId, title: `Publicada la versión ${publication.version}`, body: 'Consulta los turnos y el programa actualizados.', createdAt: at, readBy: [] });
  return next;
}

/** Published operational information never contains contact addresses or private notes. */
export function publishedData(data: AppData, user: AppUser, eventId: string): AppData {
  const active = data.grants.filter(g => g.active && (g.uid === user.uid || g.email.toLowerCase() === user.email.toLowerCase()) && (g.eventId === eventId || g.eventId === '*'));
  const allowed = new Set(active.map(g => g.departmentId));
  const all = data.publications.filter(p => p.eventId === eventId && (user.role === 'admin' || allowed.has('*') || allowed.has(p.departmentId)));
  const pubs = [...new Set(all.map(p => p.departmentId))].map(id => all.filter(p => p.departmentId === id).sort((a,b) => b.version - a.version)[0]);
  const latest = [...pubs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const own = user.role === 'volunteer';
  const shifts = pubs.flatMap(p => p.shifts).filter(s => !own || s.personId === user.personId || s.substituteIds.includes(user.personId));
  const ids = new Set(shifts.flatMap(s => [s.personId, ...s.substituteIds]));
  ids.add(user.personId);
  const event = data.events.find(e => e.id === eventId);
  return {
    ...data, events: data.events.filter(e => e.id === eventId), venues: data.venues.filter(v => v.id === event?.venueId),
    departments: data.departments.map(d => pubs.find(p => p.departmentId === d.id)?.department ?? { id:d.id, name:d.name, icon:d.icon }),
    persons: data.persons.filter(p => ids.has(p.id)).map(p => {const {hearingStatus:_hearingStatus,notificationEmail:_notificationEmail,...person}=p;return {...person,phone:'',email:'',gmail:'',notes:'',source:undefined};}),
    congregations: [], candidates: [], shifts, program: (latest?.program ?? []).map(p => ({ ...p, speakerEmail: '' })),
    plans: latest?.plans ?? [], publications: pubs.map(p => ({ ...p, shifts: p.shifts.filter(s => !own || s.personId === user.personId || s.substituteIds.includes(user.personId)), program: p.program.map(item => ({ ...item, speakerEmail: '' })) })),
    templates: [], communications: [], audit: [], grants: [], meetings: [],
    meetingPublications: (data.meetingPublications||[]).filter(m=>m.eventId===eventId&&(user.role==='admin'||m.departmentIds.some(d=>allowed.has(d)||allowed.has('*')))&&(!own||m.recipientIds.includes(user.personId))).map(m=>({...m,additionalPersonIds:[],recipientIds:own?[user.personId]:m.recipientIds})),
    notices: data.notices.filter(n => n.eventId === eventId && (!n.personId || n.personId === '*' || n.personId === user.personId) && (!n.departmentId || n.departmentId === '*' || allowed.has('*') || allowed.has(n.departmentId) || user.role === 'admin')),
  };
}
