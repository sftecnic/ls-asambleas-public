import type { AppData, AppUser } from './domain/types';
import { publishedData } from './domain/publication';

export interface OfflineCopy { id: string; user: AppUser; eventId: string; savedAt: string; data: AppData; version: string }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open('ls-asambleas-operativo', 1); request.onupgradeneeded = () => request.result.createObjectStore('copies', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function operation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => { const tx = db.transaction('copies', mode); const request = run(tx.objectStore('copies')); let result: T; request.onsuccess = () => { result = request.result; }; tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(tx.error); }; });
}
export function makeOfflineCopy(data: AppData, user: AppUser, eventId: string): OfflineCopy {
  const operational = publishedData(data, user, eventId);
  if (!operational.publications.length && !operational.meetingPublications.length) throw new Error('Primero publica la información del evento.');
  return { id: `${user.uid}:${eventId}`, user: { ...user, email: '' }, eventId, savedAt: new Date().toISOString(), data: operational, version: [...operational.meetingPublications.map(m=>`Reunión: v${m.version}`),...operational.publications.map(p => `${operational.departments.find(d=>d.id===p.departmentId)?.name??'Departamento'}: v${p.version}`)].join(' · ') };
}
export async function saveOfflineCopy(data: AppData, user: AppUser, eventId: string) { const copy = makeOfflineCopy(data, user, eventId); await operation('readwrite', store => store.put(copy)); return copy; }
export async function listOfflineCopies() { return operation<OfflineCopy[]>('readonly', store => store.getAll()); }
export async function clearOfflineCopies() { await operation('readwrite', store => store.clear()); }
