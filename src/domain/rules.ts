import { type AppData, type AppUser, type Capability, type CollectionName, type Grant, type Row, type Shift } from './types';
import { isPublishedTeamMember } from './team';
import {serviceError} from './personService';

export const capabilities: Capability[] = ['view', 'edit', 'assign', 'publish', 'manageAccess', 'contacts'];
export const emailKey = (email: string) => email.trim().toLowerCase();
export const grantId = (grant: Pick<Grant, 'email' | 'eventId' | 'departmentId'>) => `${emailKey(grant.email)}~${grant.eventId}~${grant.departmentId}`;
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const isAdmin = (user: AppUser, data: AppData) => data.grants.some(g => g.active && emailKey(g.email) === emailKey(user.email) && (!g.uid || g.uid === user.uid) && g.role === 'admin' && g.eventId === '*' && g.departmentId === '*');

/** Roles shown in the interface never authorize an operation; current grants do. */
export function can(user: AppUser, data: AppData, capability: Capability, eventId: string, departmentId = '*'): boolean {
  return data.grants.some(g => g.active && emailKey(g.email) === emailKey(user.email) && (!g.uid || g.uid === user.uid)
    && ((g.role === 'admin' && g.eventId === '*' && g.departmentId === '*')
      || ((g.eventId === '*' || g.eventId === eventId) && (g.departmentId === '*' || g.departmentId === departmentId) && g.capabilities.includes(capability))));
}

export type DataChange = { collection: CollectionName; id: string; before?: Row; after?: Row };
export function changesBetween(before: AppData, next: AppData): DataChange[] {
  const changes: DataChange[] = [];
  for (const collection of Object.keys(before) as CollectionName[]) {
    const old = new Map<string, Row>(before[collection].map(r => [r.id, r]));
    const fresh = new Map<string, Row>(next[collection].map(r => [r.id, r]));
    for (const id of new Set([...old.keys(), ...fresh.keys()])) {
      if (!same(old.get(id), fresh.get(id))) changes.push({ collection, id, before: old.get(id), after: fresh.get(id) });
    }
  }
  return changes;
}

export function overlapping(a: Pick<Shift, 'startsAt' | 'endsAt'>, b: Pick<Shift, 'startsAt' | 'endsAt'>): boolean {
  return Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);
}
export function findShiftConflicts(shifts: Shift[]): [Shift, Shift][] {
  const result: [Shift, Shift][] = [];
  for (let i = 0; i < shifts.length; i++) for (let j = i + 1; j < shifts.length; j++) {
    const a = shifts[i], b = shifts[j];
    if (a.personId && a.personId === b.personId && a.attendance !== 'replaced' && b.attendance !== 'replaced' && overlapping(a, b)) result.push([a, b]);
  }
  return result;
}
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const validInstant = (value: string) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validDate = (value: string) => /^\d{4}-\d\d-\d\d$/.test(value) && validInstant(`${value}T00:00:00.000Z`);

export function validateData(data: AppData): void {
  for (const collection of Object.keys(data) as CollectionName[]) {
    const ids = data[collection].map(r => r.id);
    assert(ids.every(id => id && !id.includes('/') && id.length <= 240), 'Hay un identificador vacío o no válido.');
    assert(new Set(ids).size === ids.length, `Hay identificadores repetidos: ${collection}.`);
  }
  const gmails = data.persons.map(p => emailKey(p.gmail)).filter(Boolean);
  assert(new Set(gmails).size === gmails.length, 'Un Gmail no puede pertenecer a dos personas.');
  for(const person of data.persons){
    const serviceIssue=serviceError(person);assert(!serviceIssue,serviceIssue);
    assert(person.aliases===undefined||(Array.isArray(person.aliases)&&person.aliases.length<=10&&person.aliases.every(a=>typeof a==='string'&&a.trim().length>0&&a.length<=160)), 'Los alias admiten hasta diez nombres de 160 caracteres.');
    assert(person.notificationEmail===undefined||typeof person.notificationEmail==='string'&&person.notificationEmail.length<=254&&(!person.notificationEmail||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.notificationEmail)),'Revisa el correo para avisos.');
    assert(person.hearingStatus===undefined||['unknown','deaf','hearing'].includes(person.hearingStatus),'Selecciona sorda, oyente o sin indicar.');
  }
  for (const department of data.departments) {
    assert((department.instructions || '').length <= 3000, 'Las instrucciones admiten hasta 3000 caracteres.');
    assert(!department.trainingUrl || /^https:\/\/(drive|docs)\.google\.com\//i.test(department.trainingUrl), 'La formación necesita un enlace HTTPS de Drive.');
  }
  for (const venue of data.venues) assert((venue.stageTemplates || []).length <= 50, 'Cada sede admite hasta 50 plantillas.');
  for (const event of data.events) {
    assert(validDate(event.startDate) && validDate(event.endDate) && event.startDate <= event.endDate, 'Revisa las fechas del evento.');
  }
  for (const candidate of data.candidates) {
    assert(candidate.teamRole===undefined||['responsible','assistant','volunteer','supervisor'].includes(candidate.teamRole),'Cargo de equipo no válido.');
    assert(candidate.availability === 'unknown' || candidate.committee === 'approved', 'Primero debe aprobar el comité.');
    assert(candidate.access === 'none' || (candidate.committee === 'approved' && candidate.availability === 'accepted'), 'Para dar acceso, el comité debe aprobar y el voluntario debe aceptar.');
  }
  for (const shift of data.shifts) {
    assert(validInstant(shift.startsAt) && validInstant(shift.endsAt) && shift.startsAt < shift.endsAt, 'El turno debe tener un inicio y un final válidos.');
    assert(shift.startsAt.slice(0, 10) === shift.endsAt.slice(0, 10), 'Divide el turno que cruza medianoche UTC en dos turnos.');
    assert(shift.personId.length > 0 && shift.role.trim().length > 0, 'El turno necesita una persona y un puesto.');
    assert(!shift.substituteIds.includes(shift.personId), 'El titular no puede ser su propio suplente.');
  }
  for (const item of data.program) {
    assert(validInstant(item.startsAt) && item.duration > 0 && item.duration <= 1440, 'Revisa la hora y duración del programa.');
    assert(!item.driveUrl || /^https:\/\/(drive|docs)\.google\.com\//i.test(item.driveUrl), 'Usa un enlace HTTPS de Google Drive.');
  }
  for (const plan of data.plans) assert(plan.moments.length >= 1 && plan.moments.length <= 50, 'El plano necesita entre 1 y 50 momentos.');
  for (const grant of data.grants) {
    assert(grant.capabilities.every(c => capabilities.includes(c)), 'Permiso no válido.');
    assert(grant.capabilities.includes('view') || !grant.active, 'Un acceso activo necesita el permiso de consulta.');
    assert(grant.role !== 'admin' || (grant.eventId === '*' && grant.departmentId === '*'), 'La administración debe tener ámbito general.');
    assert(grant.eventId !== '*' || grant.role === 'admin', 'El acceso general está reservado a la administración.');
  }
}

/** Checks only changed rows: the caller may hold a deliberately scoped view of the directory. */
export function validateChange(before: AppData, next: AppData, user: AppUser, eventId: string): void {
  validateData(next);
  const admin = isAdmin(user, before);
  const changes = changesBetween(before, next);
  for (const change of changes) {
    if (change.before && change.after) assert((change.after.revision || 0) === (change.before.revision || 0), 'La ficha abierta pertenece a una versión anterior. Recarga y revisa antes de guardar.');
    const row = (change.after || change.before) as Row & { eventId?: string; departmentId?: string; readBy?: string[] };
    const scopeEvent = row.eventId || eventId;
    const scopeDepartment = row.departmentId || (change.collection === 'plans' || change.collection === 'program' ? 'platform' : change.collection === 'communications' ? next.candidates.find(c => c.eventId === scopeEvent && c.personId === (row as Row & { personId?: string }).personId)?.departmentId || 'platform' : '*');
    if (['meetings','meetingPublications'].includes(change.collection)) throw new Error('Gestiona las reuniones desde Programa → Reuniones.');
    if (change.collection === 'audit') throw new Error('El histórico se registra automáticamente y no se puede modificar.');
    if (change.collection === 'communications' && change.before) throw new Error('El registro de un correo enviado se conserva y no puede sobrescribirse.');
    if (change.collection === 'persons' && change.before && change.after) {
      const old = change.before as AppData['persons'][number], fresh = change.after as AppData['persons'][number];
      assert(emailKey(old.gmail) === emailKey(fresh.gmail) || !next.grants.some(g => g.active && g.personId === old.id && emailKey(g.email) === emailKey(old.gmail)), 'Revoca los accesos del Gmail anterior antes de cambiarlo.');
    }
    if (change.collection === 'notices' && change.before && change.after) {
      const a = change.before as AppData['notices'][number], b = change.after as AppData['notices'][number];
      if (same({ ...a, readBy: [] }, { ...b, readBy: [] }) && b.readBy.includes(user.uid) && same(a.readBy.filter(id => id !== user.uid), b.readBy.filter(id => id !== user.uid))) continue;
    }
    if (change.collection === 'publications') {
      assert(!change.before && change.after, 'Las publicaciones se conservan; crea una versión nueva.');
      assert(can(user, before, 'publish', scopeEvent, scopeDepartment), 'No tienes permiso para publicar este departamento.');
      const publication = change.after as AppData['publications'][number];
      assert(publication.team===undefined||(Array.isArray(publication.team)&&publication.team.length<=150&&publication.team.every(isPublishedTeamMember)&&new Set(publication.team.map(p=>p.personId)).size===publication.team.length), 'Revisa los nombres y cargos del equipo publicado.');
      assert(publication.shifts.every(s => s.eventId === scopeEvent && s.departmentId === scopeDepartment && s.status === 'published'), 'La publicación contiene turnos de otro ámbito.');
      assert(publication.program.every(p => p.eventId === scopeEvent && p.status === 'published') && publication.plans.every(p => p.eventId === scopeEvent && p.status === 'published'), 'Publica solo contenido de este evento.');
      continue;
    }
    if (change.collection === 'grants') {
      const grant = row as Grant;
      const old = change.before as Grant | undefined;
      assert(admin || (can(user, before, 'manageAccess', grant.eventId, grant.departmentId) && grant.role !== 'admin' && grant.eventId !== '*' && grant.departmentId !== '*'
        && grant.capabilities.every(cap => can(user, before, cap, grant.eventId, grant.departmentId))), 'Solo puedes delegar permisos que ya tienes en tu ámbito.');
      if (old) assert(grant.email === old.email && grant.personId === old.personId && grant.eventId === old.eventId && grant.departmentId === old.departmentId, 'Revoca el acceso anterior antes de cambiar su identidad o ámbito.');
      if (change.after && grant.active && grant.role !== 'admin' && (!old || !old.active)) {
        assert(next.candidates.some(c => c.personId === grant.personId && c.eventId === grant.eventId && c.departmentId === grant.departmentId && c.committee === 'approved' && c.availability === 'accepted'), 'Falta la aprobación del comité o la aceptación del voluntario.');
        assert(next.persons.some(p => p.id === grant.personId && emailKey(p.gmail) === emailKey(grant.email)), 'El Gmail debe coincidir con la ficha de la persona.');
      }
      continue;
    }
    if (admin) continue;
    if (['shifts', 'program', 'plans'].includes(change.collection) && change.before && change.after
      && (change.after as Row & { status: string }).status === 'published' && same({ ...change.before, status: 'published' }, change.after)
      && can(user, before, 'publish', scopeEvent, scopeDepartment)) continue;
    if (['events', 'venues', 'departments', 'congregations', 'templates'].includes(change.collection)) throw new Error('Esta configuración requiere administración.');
    if (change.collection === 'persons') {
      assert(next.candidates.some(c => c.personId === row.id && can(user, before, 'contacts', c.eventId, c.departmentId)), 'Esta ficha requiere una candidatura y permiso de contactos en su departamento.');
      const old=change.before as AppData['persons'][number]|undefined,fresh=change.after as AppData['persons'][number]|undefined;
      if(old?.appointment!==fresh?.appointment||old?.regularPioneer!==fresh?.regularPioneer)assert(next.candidates.some(c=>c.personId===row.id&&can(user,before,'contacts',c.eventId,c.departmentId)&&can(user,before,'edit',c.eventId,c.departmentId)),'Modificar el servicio actual requiere contactos y edición en el mismo departamento.');
      continue;
    }
    const capability: Capability = change.collection === 'shifts' ? 'assign' : 'edit';
    assert(can(user, before, capability, scopeEvent, scopeDepartment), 'No tienes permiso para modificar este contenido.');
    if (change.before) {
      const old = change.before as Row & { eventId?: string; departmentId?: string };
      assert(old.eventId === row.eventId && old.departmentId === row.departmentId, 'No se puede mover una ficha a otro ámbito.');
    }
  }
  if (before.grants.some(g => g.active && g.role === 'admin')) assert(next.grants.some(g => g.active && g.role === 'admin'), 'Debe quedar al menos una persona administradora.');
  const changedShifts = new Set(changes.filter(c => c.collection === 'shifts').map(c => c.id));
  const conflict = findShiftConflicts(next.shifts).find(([a, b]) => changedShifts.has(a.id) || changedShifts.has(b.id));
  assert(!conflict, `Esta persona ya tiene otro turno en ese horario${conflict ? `: ${conflict[0].role} / ${conflict[1].role}` : ''}.`);
}
