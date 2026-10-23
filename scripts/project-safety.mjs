import { readFile } from 'node:fs/promises';

export function argumentsMap(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    if (!argv[index].startsWith('--')) throw new Error('Argumento no válido. Usa --nombre valor.');
    args[argv[index].slice(2)] = argv[index + 1]?.startsWith('--') || !argv[index + 1] ? true : argv[++index];
  }
  return args;
}
export function accessToken() {
  const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (!token) throw new Error('Falta GOOGLE_OAUTH_ACCESS_TOKEN temporal. No guardes credenciales en archivos ni en VITE_*.');
  return token;
}
export async function googleApi(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) throw new Error(`Google API devolvió HTTP ${response.status}; operación detenida.`);
  return response.json();
}
export async function verifyProject(project, configPath = new URL('../firebase.json', import.meta.url)) {
  if (typeof project !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) throw new Error('Especifica --project con el ID exacto de Firebase.');
  const firebase = JSON.parse(await readFile(configPath, 'utf8'));
  if (Object.keys(firebase).some(key => !['hosting', 'firestore', 'auth', 'emulators'].includes(key))) throw new Error('Configuración inesperada: sólo Hosting clásico, Auth Google y Firestore están permitidos.');
  if (firebase.auth) {
    const auth = firebase.auth;
    if (Object.keys(auth).some(key => !['providers', 'authorizedDomains'].includes(key)) || !auth.providers || Object.keys(auth.providers).some(key => key !== 'googleSignIn')) throw new Error('Sólo se permite Google Authentication, sin SMS ni otros proveedores.');
    const google = auth.providers.googleSignIn;
    if (!google || Object.keys(google).some(key => !['oAuthBrandDisplayName', 'supportEmail'].includes(key)) || typeof google.oAuthBrandDisplayName !== 'string' || typeof google.supportEmail !== 'string') throw new Error('Configuración de Google Authentication inesperada.');
  }
  const billing = await googleApi(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`);
  if (billing.billingEnabled !== false || billing.billingAccountName) throw new Error('El proyecto tiene facturación vinculada o no se pudo confirmar su ausencia. No se permite continuar.');
  const database = await googleApi(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`);
  if (database.databaseEdition !== 'STANDARD' || database.type !== 'FIRESTORE_NATIVE') throw new Error('Se requiere Firestore Standard en modo nativo.');
  return { project, billing: 'sin cuenta vinculada', edition: database.databaseEdition, location: database.locationId };
}
export const documentValue = value => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(documentValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, documentValue(entry)])) } };
};
