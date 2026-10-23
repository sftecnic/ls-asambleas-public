import { emptyData, type AppData, type StagePlan } from './domain/types';

export function createDemoData(): AppData {
  const data = emptyData();
  data.departments = [
    { id: 'video', name: 'Audio y vídeo', icon: 'video' },
    { id: 'platform', name: 'Plataforma', icon: 'platform' },
    { id: 'makeup', name: 'Maquillaje', icon: 'makeup' },
  ];
  data.venues = [
    { id: 'v1', name: 'Salón del Norte', city: 'Oviedo', address: 'Sede de demostración' },
    { id: 'v2', name: 'Salón del Este', city: 'Zaragoza', address: 'Sede de demostración' },
  ];
  data.events = [
    { id: 'e1', title: 'Asamblea de circuito', type: 'circuit', startDate: '2027-04-10', endDate: '2027-04-10', venueId: 'v1', section: 'Lengua de signos española', timezone: 'Europe/Madrid', archived: false },
    { id: 'e2', title: 'Asamblea de circuito', type: 'circuit', startDate: '2027-04-10', endDate: '2027-04-11', venueId: 'v2', section: 'Lengua de signos española', timezone: 'Europe/Madrid', archived: false },
  ];
  data.congregations = [{ id: 'c1', name: 'Norte LSE', committeeEmail: 'comite-norte@example.test' }, { id: 'c2', name: 'Centro LSE', committeeEmail: 'comite-centro@example.test' }];
  data.persons = ['Elena Vidal', 'Lucía Martín', 'David Romero', 'Sara Gil', 'Pablo Soto', 'Nuria Vega', 'Marcos León'].map((name, i) => ({
    id: i === 0 ? 'p-admin' : `p${i}`, name, congregationId: i % 2 ? 'c1' : 'c2', phone: '', email: `persona${i}@example.test`, gmail: i === 0 ? 'admin@example.test' : i === 1 ? 'voluntario@example.test' : '', notes: '', source: 'Datos ficticios',
  }));
  data.candidates = [
    { id: 'ca1', eventId: 'e1', personId: 'p1', departmentId: 'video', committee: 'approved', availability: 'accepted', access: 'active', reserve: false },
    { id: 'ca2', eventId: 'e1', personId: 'p2', departmentId: 'video', committee: 'pending', availability: 'unknown', access: 'none', reserve: false },
    { id: 'ca3', eventId: 'e1', personId: 'p3', departmentId: 'platform', committee: 'approved', availability: 'invited', access: 'none', reserve: false },
    { id: 'ca4', eventId: 'e1', personId: 'p4', departmentId: 'platform', committee: 'approved', availability: 'accepted', access: 'none', reserve: false },
    { id: 'ca5', eventId: 'e1', personId: 'p5', departmentId: 'makeup', committee: 'proposed', availability: 'unknown', access: 'none', reserve: false },
    { id: 'ca6', eventId: 'e1', personId: 'p6', departmentId: 'video', committee: 'approved', availability: 'accepted', access: 'none', reserve: true },
  ];
  data.shifts = [
    { id: 's1', eventId: 'e1', departmentId: 'video', personId: 'p1', role: 'Cámara', startsAt: '2027-04-10T08:00:00.000Z', endsAt: '2027-04-10T10:00:00.000Z', meetingPoint: 'Mesa de audio y vídeo · 09:30', status: 'published', attendance: 'planned', substituteIds: ['p6'] },
    { id: 's2', eventId: 'e1', departmentId: 'platform', personId: 'p4', role: 'Plataforma', startsAt: '2027-04-10T08:00:00.000Z', endsAt: '2027-04-10T10:00:00.000Z', meetingPoint: 'Lateral de la plataforma · 09:30', status: 'published', attendance: 'planned', substituteIds: [] },
    { id: 's3', eventId: 'e1', departmentId: 'video', personId: 'p6', role: 'Vídeo', startsAt: '2027-04-10T12:00:00.000Z', endsAt: '2027-04-10T14:00:00.000Z', meetingPoint: 'Mesa de audio y vídeo', status: 'draft', attendance: 'planned', substituteIds: [] },
  ];
  data.program = [
    { id: 'pr1', eventId: 'e1', title: 'Bienvenida', startsAt: '2027-04-10T08:00:00.000Z', duration: 10, speaker: 'Andrés Ríos', speakerEmail: 'orador@example.test', language: 'LSE', interpreter: '', kind: 'talk', driveUrl: '', material: 'reviewed', rehearsal: 'ready', status: 'published' },
    { id: 'pr2', eventId: 'e1', title: 'Aprendamos juntos', startsAt: '2027-04-10T08:10:00.000Z', duration: 25, speaker: 'Andrés Ríos', speakerEmail: 'orador@example.test', language: 'LSE', interpreter: '', kind: 'interview', driveUrl: '', material: 'pending', rehearsal: 'pending', status: 'published' },
    { id: 'pr3', eventId: 'e1', title: 'Descanso', startsAt: '2027-04-10T10:00:00.000Z', duration: 90, speaker: '', speakerEmail: '', language: 'LSE', interpreter: '', kind: 'break', driveUrl: '', material: 'reviewed', rehearsal: 'ready', status: 'published' },
  ];
  const plan: StagePlan = { id: 'pl1', eventId: 'e1', programItemId: 'pr2', name: 'Aprendamos juntos', status: 'published', updatedAt: '2027-03-18T10:00:00.000Z', moments: [{ id: 'm1', title: 'Entrevista', instruction: 'Mirar hacia el público.', camera: 'Plano general', elements: [
    { id: 'el1', kind: 'person', label: 'Andrés', x: 350, y: 260, posture: 'standing', facing: 'audience', movement: 'none' },
    { id: 'el2', kind: 'person', label: 'Sara', x: 650, y: 260, posture: 'standing', facing: 'audience', movement: 'none' },
  ] }] };
  data.plans = [plan];
  data.templates = [
    { id: 't1', name: 'Aprobación del comité', kind: 'committee', subject: 'Colaboración en {{evento}} — {{persona}}', body: 'Queridos hermanos de {{congregacion}}:\n\nProponemos a {{persona}} para colaborar en {{departamento}} en {{evento}}, el {{fecha}}, en {{sede}}.\n\n¿Cuenta con la aprobación del comité?\n\nMuchas gracias.' },
    { id: 't2', name: 'Disponibilidad', kind: 'volunteer', subject: 'Invitación a colaborar — {{evento}}', body: 'Hola, {{persona}}:\n\nNos gustaría contar contigo en {{departamento}} para {{evento}}, el {{fecha}} en {{sede}}.\n\n¿Estás disponible y aceptas colaborar? Si aceptas, indícanos tu correo Gmail para darte acceso.\n\nMuchas gracias.' },
    { id: 't3', name: 'Material del discurso', kind: 'speaker', subject: 'Material — {{discurso}}', body: 'Hola, {{discursante}}:\n\nTu intervención «{{discurso}}» será el {{fecha}} a las {{hora}}, en {{evento}}.\n\nPor favor, sube el archivo de tu intervención a esta carpeta:\n{{drive}}\n\nMuchas gracias.' },
    { id: 't4', name: 'Recordatorio', kind: 'reminder', subject: 'Recordatorio — {{evento}}', body: 'Hola, {{persona}}:\n\nRecuerda consultar tus turnos actualizados de {{evento}}, el {{fecha}} en {{sede}}.\n\nMuchas gracias.' },
  ];
  data.grants = [
    { id: 'g-admin', email: 'admin@example.test', uid: 'demo-admin', personId: 'p-admin', eventId: '*', departmentId: '*', role: 'admin', capabilities: ['view', 'edit', 'assign', 'publish', 'manageAccess', 'contacts'], active: true },
    { id: 'g-vol', email: 'voluntario@example.test', uid: 'demo-volunteer', personId: 'p1', eventId: 'e1', departmentId: 'video', role: 'volunteer', capabilities: ['view'], active: true },
  ];
  const at = '2027-03-18T10:00:00.000Z';
  data.publications = data.departments.map(dep => ({ id: `pub-e1-${dep.id}`, eventId: 'e1', departmentId: dep.id, version: 1, publishedAt: at, publishedBy: 'Elena Vidal', shifts: structuredClone(data.shifts.filter(s => s.departmentId === dep.id && s.status === 'published')), program: structuredClone(data.program), plans: structuredClone(data.plans) }));
  data.notices = [{ id: 'n1', eventId: 'e1', title: 'Turnos publicados', body: 'Ya puedes consultar tu turno y el lugar de encuentro.', createdAt: at, readBy: [] }];
  data.audit = [{ id: 'a1', eventId: 'e1', actor: 'Elena Vidal', at, action: 'Publicada la versión 1' }];
  return data;
}
