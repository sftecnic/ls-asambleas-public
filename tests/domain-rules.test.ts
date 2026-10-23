import { describe, expect, it } from 'vitest';
import { createDemoData } from '../src/seed';
import { can, findShiftConflicts, validateChange, validateData } from '../src/domain/rules';
import type { AppUser, Shift } from '../src/domain/types';

const admin: AppUser = { uid: 'demo-admin', email: 'admin@example.test', name: 'Elena Vidal', personId: 'p-admin', role: 'admin' };
const volunteer: AppUser = { uid: 'demo-volunteer', email: 'voluntario@example.test', name: 'Lucía', personId: 'p1', role: 'volunteer' };
describe('Reglas de coordinación', () => {
  it('rechaza aprobación y aceptación confundidas', () => {
    const data = createDemoData(); data.candidates[1].availability = 'accepted';
    expect(() => validateData(data)).toThrow('comité');
  });
  it('rechaza una misma persona con turno concurrente en otro evento', () => {
    const before = createDemoData(), next = structuredClone(before);
    next.shifts.push({ ...next.shifts[0], id: 'other-event', eventId: 'e2' });
    expect(() => validateChange(before, next, admin, 'e2')).toThrow('otro turno');
  });
  it('admite límites contiguos y repetir en la tarde', () => {
    const shift = createDemoData().shifts[0];
    const adjacent: Shift = { ...shift, id: 'adjacent', startsAt: shift.endsAt, endsAt: '2027-04-10T12:00:00.000Z' };
    expect(findShiftConflicts([shift, adjacent])).toHaveLength(0);
  });
  it('sustituir conserva el turno previsto y libera sólo la reserva del sustituido', () => {
    const before = createDemoData(), next = structuredClone(before);
    next.shifts[0].attendance = 'replaced';
    next.shifts.push({ ...next.shifts[0], id: 'replacement', personId: 'p2', attendance: 'planned', replacementFor: next.shifts[0].id });
    expect(() => validateChange(before, next, admin, 'e1')).not.toThrow();
    expect(next.shifts[0].personId).toBe('p1');
  });
  it('ignora el rol del cliente como fuente de autorización', () => {
    const data = createDemoData();
    expect(can({ ...volunteer, role: 'admin' }, data, 'manageAccess', 'e1', 'video')).toBe(false);
    data.grants[1].active = false;
    expect(can(volunteer, data, 'view', 'e1', 'video')).toBe(false);
  });
  it('no permite delegar publicar sin poseer ese permiso', () => {
    const before = createDemoData();
    before.grants[1].role = 'responsible'; before.grants[1].capabilities = ['view', 'manageAccess'];
    const next = structuredClone(before); next.grants[1].capabilities.push('publish');
    expect(() => validateChange(before, next, volunteer, 'e1')).toThrow('delegar');
  });
  it('conserva publicaciones anteriores y requiere una nueva versión', () => {
    const before = createDemoData(), next = structuredClone(before);
    next.publications[0].version++;
    expect(() => validateChange(before, next, admin, 'e1')).toThrow('versión nueva');
  });
  it('no permite borrar al último administrador ni falsificar histórico', () => {
    const before = createDemoData(), next = structuredClone(before); next.grants[0].active = false;
    expect(() => validateChange(before, next, admin, 'e1')).toThrow('administradora');
    const forged = structuredClone(before); forged.audit[0].actor = 'Otra persona';
    expect(() => validateChange(before, forged, admin, 'e1')).toThrow('histórico');
  });
  it('impide asociar un Gmail a dos personas', () => {
    const data = createDemoData(); data.persons[2].gmail = data.persons[1].gmail.toUpperCase();
    expect(() => validateData(data)).toThrow('dos personas');
  });
  it('el responsable modifica contactos vinculados a su candidatura, sin permiso global', () => {
    const before = createDemoData(); before.grants[1].role = 'responsible'; before.grants[1].capabilities = ['view', 'edit', 'contacts'];
    const next = structuredClone(before); next.persons.find(p => p.id === 'p1')!.phone = '600000000';
    expect(() => validateChange(before, next, volunteer, 'e1')).not.toThrow();
    const other = structuredClone(before); other.persons.find(p => p.id === 'p3')!.phone = '600000000';
    expect(() => validateChange(before, other, volunteer, 'e1')).toThrow('candidatura');
  });
  it('rechaza días inexistentes aunque Date.parse los normalice', () => {
    const data = createDemoData(); data.events[0].startDate = '2027-02-31';
    expect(() => validateData(data)).toThrow('fechas');
  });
});
