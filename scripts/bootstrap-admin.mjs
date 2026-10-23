import { argumentsMap, documentValue, googleApi, verifyProject, accessToken } from './project-safety.mjs';

// Explicit one-time bootstrap. No "first user wins" path exists in the app/rules.
// This uses a temporary operator OAuth token, never a service-account key file.
const args = argumentsMap();
try {
  const email = String(args.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@gmail\.com$/.test(email)) throw new Error('Indica el Gmail confirmado de administración con --email.');
  if (!args.project) throw new Error('Indica --project.');
  if (!args.apply) {
    console.log('Preparado para añadir UN administrador explícito. Se requieren --apply y un token temporal para escribir.');
    console.log('La ejecución comprobará que no hay facturación vinculada, que Firestore es Standard y que no existe administración previa.');
    process.exit(0);
  }
  const checked = await verifyProject(args.project,args.config);
  const root = `projects/${checked.project}/databases/(default)/documents`;
  const existing = await fetch(`https://firestore.googleapis.com/v1/${root}/system/administrators`, { headers: { Authorization: `Bearer ${accessToken()}` } });
  if (existing.status !== 404) throw new Error('El registro de administración ya existe o no puede comprobarse. Bootstrap cancelado.');
  const personId = 'admin-initial', id = `${email}~*~*`, now = new Date().toISOString();
  const capabilities = ['view', 'edit', 'assign', 'publish', 'manageAccess', 'contacts'];
  const grant = { id, email, personId, eventId: '*', departmentId: '*', role: 'admin', capabilities, active: true, revision: 1, _deleted: false, _candidateId: '' };
  const records = {
    [`grants/${id}`]: grant,
    [`memberships/${email}~*`]: { email, eventId: '*', scopes: { '*': id }, changedDepartment: '*', grantId: id },
    'system/administrators': { emails: [email], changedEmail: email },
    [`persons/${personId}`]: { id: personId, name: String(args.name || 'Administración'), congregationId: '', source: 'Alta explícita', revision: 1, _deleted: false },
    [`personContacts/${personId}`]: { id: personId, phone: '', email: '', gmail: email, notes: '', revision: 1, _deleted: false, _scopeEvent: '*', _scopeDepartment: '*' },
    [`gmailOwners/${email}`]: { email, personId, active: true, _scopeEvent: '*', _scopeDepartment: '*' },
    'revisions/global': { actor: 'bootstrap', at: now },
    'departments/video': { id: 'video', name: 'Audio y vídeo', icon: 'video', instructions: '', trainingUrl: '', revision: 1, _deleted: false },
    'departments/platform': { id: 'platform', name: 'Plataforma', icon: 'platform', instructions: '', trainingUrl: '', revision: 1, _deleted: false },
    'departments/makeup': { id: 'makeup', name: 'Maquillaje', icon: 'makeup', instructions: '', trainingUrl: '', revision: 1, _deleted: false },
    'templates/committee': { id: 'committee', name: 'Aprobación del comité', kind: 'committee', subject: 'Colaboración en {{evento}} — {{persona}}', body: 'Queridos hermanos de {{congregacion}}:\n\nProponemos a {{persona}} para colaborar en {{departamento}} en {{evento}}, el {{fecha}}, en {{sede}}.\n\n¿Cuenta con la aprobación del comité?\n\nMuchas gracias.', revision: 1, _deleted: false },
    'templates/volunteer': { id: 'volunteer', name: 'Disponibilidad', kind: 'volunteer', subject: 'Invitación a colaborar — {{evento}}', body: 'Hola, {{persona}}:\n\nNos gustaría contar contigo en {{departamento}} para {{evento}}, el {{fecha}} en {{sede}}.\n\n¿Estás disponible y aceptas colaborar? Si aceptas, indícanos tu correo Gmail para darte acceso.\n\nMuchas gracias.', revision: 1, _deleted: false },
    'templates/speaker': { id: 'speaker', name: 'Material del discurso', kind: 'speaker', subject: 'Material — {{discurso}}', body: 'Hola, {{discursante}}:\n\nTu intervención «{{discurso}}» será el {{fecha}} a las {{hora}}, en {{evento}}.\n\nPor favor, sube el archivo de tu intervención a esta carpeta:\n{{drive}}\n\nMuchas gracias.', revision: 1, _deleted: false },
    'templates/reminder': { id: 'reminder', name: 'Recordatorio', kind: 'reminder', subject: 'Recordatorio — {{evento}}', body: 'Hola, {{persona}}:\n\nRecuerda consultar tus turnos actualizados de {{evento}}, el {{fecha}} en {{sede}}.\n\nMuchas gracias.', revision: 1, _deleted: false },
  };
  const writes = Object.entries(records).map(([path, value]) => ({ update: { name: `${root}/${path}`, fields: documentValue(value).mapValue.fields }, currentDocument: { exists: false } }));
  await googleApi(`https://firestore.googleapis.com/v1/projects/${checked.project}/databases/(default)/documents:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
  console.log('Administración inicial creada. Habilita Google Authentication y entra con el Gmail confirmado. No se han vinculado cuentas de facturación.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
