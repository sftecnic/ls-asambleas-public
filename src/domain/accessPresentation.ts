import type {AppData, AppUser, Capability, Grant} from './types';
import {can, isAdmin} from './rules';
import {isGmail} from './mail';

export const permissionInfo: Record<Capability, {label: string; description: string; detail: string}> = {
  view: {label: 'Consultar', description: 'Ver la información disponible para este acceso.', detail: 'Consulta muestra las publicaciones y convocatorias autorizadas. Gestión también permite consultar los borradores de su ámbito.'},
  edit: {label: 'Editar equipo y reuniones', description: 'Preparar el equipo y las reuniones.', detail: 'Incluye propuestas, aprobaciones y disponibilidad. En Plataforma, también programa y planos. Para cambiar nombramiento y precursorado necesita además Gestionar datos personales.'},
  assign: {label: 'Organizar turnos', description: 'Asignar, sustituir y marcar asistencia.', detail: 'Puede preparar turnos y corregir Presente, Ausente o Sin marcar. No publica los turnos por sí solo.'},
  publish: {label: 'Publicar y convocar', description: 'Publicar cambios y confirmar convocatorias.', detail: 'Incluye turnos, reuniones e invitaciones de Calendar; en Plataforma, programa y planos. Confirmar una convocatoria puede avisar a sus invitados.'},
  contacts: {label: 'Gestionar datos personales', description: 'Consultar y modificar datos de las fichas autorizadas.', detail: 'Incluye teléfono, correo, Gmail, notas y Sorda/Oyente. Puede consultar nombramiento, precursorado y circuito de servicio; para modificarlos necesita también Editar equipo y reuniones.'},
  manageAccess: {label: 'Dar permisos', description: 'Dar o retirar acceso en este departamento.', detail: 'Solo puede dar los permisos que ya tiene, en esta asamblea y departamento. No concede administración general.'},
};
export const permissionOrder: Capability[] = ['view', 'edit', 'assign', 'publish', 'contacts', 'manageAccess'];
export type AccessMode = 'consult' | 'manage';
export function accessLabel(role: Grant['role']) {return role === 'admin' ? 'Administración general' : role === 'volunteer' ? 'Consulta' : 'Gestión';}
export function managementRole(initial?: Grant): Grant['role'] {return initial?.role === 'responsible' ? 'responsible' : 'assistant';}
export function permissionChanges(before: Capability[], after: Capability[]) {
  return {added: permissionOrder.filter(c => after.includes(c) && !before.includes(c)), removed: permissionOrder.filter(c => before.includes(c) && !after.includes(c))};
}
export function canReadPersonGmail(data: AppData, user: AppUser, personId: string) {
  return isAdmin(user, data) || data.candidates.some(c => c.personId === personId && can(user, data, 'contacts', c.eventId, c.departmentId));
}
/** A blank private field may be redacted; never describe that as a missing Gmail. */
export function accessEligibility(data: AppData, user: AppUser, personId: string, eventId: string, departmentId: string, general = false, initial?: Grant): string[] {
  if (!personId) return ['Elige una persona.'];
  if (initial?.active) return [];
  const person = data.persons.find(p => p.id === personId);
  if (general && initial && !person) return [];
  const issues: string[] = [];
  if (!general) {
    const candidate = data.candidates.find(c => c.personId === personId && c.eventId === eventId && c.departmentId === departmentId);
    if (candidate?.committee !== 'approved') issues.push('Falta la aprobación del comité.');
    if (candidate?.availability !== 'accepted') issues.push('El voluntario debe aceptar la participación.');
  }
  if (!canReadPersonGmail(data, user, personId)) issues.push('No puedes consultar el Gmail de esta ficha. Pide a administración que revise o conceda el acceso.');
  else if (!isGmail(person?.gmail || '')) issues.push('Falta un Gmail válido. Complétalo en la ficha de la persona.');
  else if (initial && person?.gmail.toLowerCase().trim() !== initial.email.toLowerCase().trim()) issues.push('El Gmail de la ficha ha cambiado. Revisa el acceso con administración.');
  if (!initial && data.grants.some(g => g.personId === personId && g.eventId === (general ? '*' : eventId) && g.departmentId === (general ? '*' : departmentId))) issues.push('Esta persona ya tiene un acceso. Abre Cambiar permisos en su ficha de acceso.');
  return issues;
}
