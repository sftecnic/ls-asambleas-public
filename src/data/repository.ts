import {meetingRequest,loadMeetingData} from './meetingApi';
import {applyMeetingCommand} from '../domain/meetings';
import type {MeetingCommand} from '../domain/types';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserSessionPersistence, getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signInWithRedirect, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { collection, doc, getDocFromServer, getDocsFromServer, initializeFirestore, memoryLocalCache, onSnapshot, query, runTransaction, serverTimestamp, where, type DocumentData, type DocumentReference, type QueryConstraint } from 'firebase/firestore';
import { emptyData, type AppData, type AppUser, type CollectionName, type Grant, type Person, type Row, type Shift } from '../domain/types';
import { can, changesBetween, emailKey, grantId, isAdmin, same, validateChange } from '../domain/rules';
import { startAuthDiagnostics } from './authDiagnostics';
import {personContactFields as privateFields,mergePersonContact,nextDocumentRevision,assertPersonContactUnchanged,assertCommitteeContactUnchanged} from '../domain/personRecords';

const env = import.meta.env;
export const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);
const DEMO_KEY = 'ls-asambleas:demo:v1';
export interface Repository {
  readonly mode: 'demo' | 'firebase';
  signIn(): Promise<AppUser>;
  signOut(): Promise<void>;
  currentUser(onProgress?: (phase: string) => void): Promise<AppUser | null>;
  loadData(user: AppUser): Promise<AppData>;
  meetingCommand(command:MeetingCommand,user:AppUser):Promise<AppData>;
  subscribe(user: AppUser, onData: (data: AppData) => void, onError?: (error: Error) => void): () => void;
  commit(before: AppData, next: AppData, description: string, user: AppUser, eventId: string, dependencies?:{collection:CollectionName;id:string;revision:number}[]): Promise<AppData>;
}
const clone = <T>(data: T): T => structuredClone(data);
const id = () => crypto.randomUUID();
function withReadDeadline<T>(request: Promise<T>, phase: string, onTimeout?: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { onTimeout?.(); } catch { /* Diagnostics must never prevent the visible timeout. */ }
      reject(new Error(`No se ha completado «${phase}» en 20 segundos. Comprueba la conexión y vuelve a intentarlo.`));
    }, 20_000);
    request.then(value => { clearTimeout(timeout); resolve(value); }, error => { clearTimeout(timeout); reject(error); });
  });
}
function online() { if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Sin conexión. Conecta a internet para guardar. No se han puesto cambios en cola.'); }
function rows(data: AppData, name: CollectionName): Row[] { return data[name]; }
function applyRows(data: AppData, name: CollectionName, value: Row[]) { (data as unknown as Record<string, Row[]>)[name] = value; }
function readStored(seed: AppData): AppData { try { const s = localStorage.getItem(DEMO_KEY); return s ? {...emptyData(),...JSON.parse(s)} : {...emptyData(),...clone(seed)}; } catch { return clone(seed); } }
const demoUser: AppUser = { uid: 'demo-admin', email: 'admin@example.test', name: 'Elena Vidal', personId: 'p-admin', role: 'admin' };

function demoRepository(seed: AppData): Repository {
  let memory = readStored(seed);
  const listeners = new Set<(data: AppData) => void>();
  const emit = () => listeners.forEach(fn => fn(clone(memory)));
  return {
    mode: 'demo',
    async meetingCommand(command,user){online();const save=async()=>{const next=applyMeetingCommand(readStored(memory),user,command);const pub=next.meetingPublications.find(m=>m.id===(command.action==='cancel'?command.meetingId:command.meeting.id));if(command.action!=='save'&&pub)for(const personId of pub.recipientIds)next.notices.push({id:crypto.randomUUID(),eventId:pub.eventId,personId,title:command.action==='cancel'?'Reunión cancelada':'Reunión confirmada',body:pub.title,createdAt:pub.publishedAt,readBy:[],meetingId:pub.id,meetingVersion:pub.version});next.audit.push({id:crypto.randomUUID(),eventId:command.action==='cancel'?command.eventId:command.meeting.eventId,actor:user.name,at:new Date().toISOString(),action:'Actualizó una reunión'});localStorage.setItem(DEMO_KEY,JSON.stringify(next));memory=next;emit();return clone(next);};return navigator.locks?navigator.locks.request(DEMO_KEY,save):save();},
    signIn: async () => clone(demoUser), signOut: async () => {}, currentUser: async () => clone(demoUser),
    loadData: async () => clone(memory),
    subscribe: (_user, onData) => {
      listeners.add(onData);
      const storage = (event: StorageEvent) => { if (event.key === DEMO_KEY && event.newValue) { memory = JSON.parse(event.newValue); emit(); } };
      if (typeof window !== 'undefined') window.addEventListener('storage', storage);
      return () => { listeners.delete(onData); if (typeof window !== 'undefined') window.removeEventListener('storage', storage); };
    },
    async commit(before, next, description, user, eventId, dependencies=[]) {
      const save = async () => {
      online(); validateChange(before, next, user, eventId);
      const latest = readStored(memory);
      for(const dependency of dependencies){const actual=latest[dependency.collection].find(r=>r.id===dependency.id);if(!actual||(actual.revision||0)!==dependency.revision)throw new Error('Han cambiado datos relacionados. Vuelve a revisar la importación.');}
      const validationBase = clone(latest);
      const changes = changesBetween(before, next);
      for (const change of changes) {
        const current = rows(latest, change.collection).find(r => r.id === change.id);
        if (!same(current, change.before)) throw new Error('Otra persona ha cambiado estos datos. Recarga y revisa antes de guardar.');
        applyRows(latest, change.collection, [...rows(latest, change.collection).filter(r => r.id !== change.id), ...(change.after ? [clone(change.after)] : [])]);
      }
      // Recheck against the newest local state, including other events and tabs.
      validateChange(validationBase, latest, user, eventId);
      for (const change of changes) { const row = rows(latest, change.collection).find(r => r.id === change.id); if (row) row.revision = (change.before?.revision || 0) + 1; }
      latest.audit.push({ id: id(), eventId, actor: user.name, at: new Date().toISOString(), action: description.slice(0, 300) });
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(latest)); } catch { throw new Error('No se ha podido guardar en este navegador. Revisa el espacio disponible.'); }
      memory = latest; emit(); return clone(memory);
      };
      return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(DEMO_KEY, save) : save();
    },
  };
}

interface LedgerEntry { id: string; eventId: string; departmentId: string; startsAt: string; endsAt: string }
interface Ledger { personId: string; day: string; entries: LedgerEntry[]; mutation: { shiftId: string; before: LedgerEntry | null; after: LedgerEntry | null } }
const entry = (shift: Shift): LedgerEntry => ({ id: shift.id, eventId: shift.eventId, departmentId: shift.departmentId, startsAt: shift.startsAt, endsAt: shift.endsAt });
const reserved = (s?: Shift) => Boolean(s && s.attendance !== 'replaced');
const ledgerKey = (s: Shift) => `${s.personId}~${s.startsAt.slice(0, 10)}`;
const operational = (person: Person) => { const { phone: _phone, email: _email, gmail: _gmail, notes: _notes, hearingStatus:_hearingStatus, notificationEmail:_notificationEmail, appointment:_appointment, regularPioneer:_regularPioneer, serviceCircuit:_serviceCircuit, ...rest } = person; return rest; };
// atServer is server-owned audit metadata, not editable application data.
// Its SDK Timestamp loses its JSON representation when forms clone AppData.
const clean = (raw: DocumentData): DocumentData => Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith('_') && key !== 'atServer'));
function firebaseRepository(): Repository {
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`;
  const app = getApps().length ? getApp() : initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID });
  const auth = getAuth(app);
  // Redirect keeps authentication in this tab. It must share the app origin so
  // browsers do not need third-party storage to return the Google result.
  const sameOriginAuth = typeof location !== 'undefined' && location.origin === `https://${authDomain}`;
  let redirectCompletion: Promise<void> | undefined;
  let restoringUser: Promise<AppUser | null> | undefined;
  let currentPhase = '';
  const progressListeners = new Set<(phase: string) => void>();
  const reportProgress = (phase: string) => { currentPhase = phase; progressListeners.forEach(listener => listener(phase)); };
  // Explicitly no IndexedDB persistence: private drafts, emails and contacts stay in memory.
  const db = initializeFirestore(app, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true });
  const readDoc = (reference: DocumentReference) => withReadDeadline(getDocFromServer(reference), 'Leyendo datos');
  const read = async (name: string, constraints: QueryConstraint[] = []): Promise<DocumentData[]> => {
    const snapshot = await withReadDeadline(getDocsFromServer(query(collection(db, name), ...constraints)), name === 'grants' ? 'Leyendo permisos' : 'Leyendo datos');
    return snapshot.docs.filter(d => !d.data()._deleted).map(d => ({ ...clean(d.data()), id: d.id }));
  };
  async function ownGrants(email: string): Promise<Grant[]> { return await read('grants', [where('email', '==', emailKey(email))]) as Grant[]; }
  async function resolveUser(firebaseUser: User, onProgress: (phase: string) => void = () => {}): Promise<AppUser> {
    onProgress('Comprobando cuenta de Google…');
    if (!firebaseUser.emailVerified || !firebaseUser.email || !firebaseUser.providerData.some(p => p.providerId === 'google.com')) throw new Error('Utiliza una cuenta de Google verificada.');
    onProgress('Leyendo permisos…');
    const grants = (await ownGrants(firebaseUser.email)).filter(g => g.active && (!g.uid || g.uid === firebaseUser.uid));
    if (!grants.length) throw new Error('Este Gmail todavía no tiene acceso. Contacta con tu responsable.');
    const rank = { admin: 0, responsible: 1, assistant: 2, volunteer: 3 };
    grants.sort((a, b) => rank[a.role] - rank[b.role] || Number(b.capabilities.includes('contacts')) - Number(a.capabilities.includes('contacts')));
    const first = grants[0];
    const primary = grants.find(g => g.role !== 'volunteer' && g.capabilities.includes('contacts')) || first;
    if (grants.some(g => g.personId !== first.personId)) throw new Error('El Gmail está asociado a dos personas. Administración debe revisar el acceso.');
    const user: AppUser = { uid: firebaseUser.uid, email: emailKey(firebaseUser.email), name: firebaseUser.displayName || 'Voluntario', personId: first.personId, role: first.role };
    // The profile is only a pointer to an already approved, currently active grant.
    // Its role is never an authority source in security rules.
    onProgress('Vinculando perfil…');
    await runTransaction(db, async tx => {
      const profileRef = doc(db, 'profiles', user.email);
      const profile = await tx.get(profileRef);
      if (profile.exists() && profile.data().uid !== user.uid) throw new Error('Esta invitación ya está vinculada a otra cuenta.');
      tx.set(profileRef, { email: user.email, uid: user.uid, personId: first.personId, primaryGrantId: primary.id });
    });
    for (const permission of grants) {
      onProgress('Comprobando invitación…');
      const invitations = permission.role === 'admin' ? [] : await read('candidates', [where('eventId', '==', permission.eventId), where('personId', '==', user.personId)]);
      const invitation = invitations.find(c => c.departmentId === permission.departmentId && c.access === 'invited');
      if (permission.uid && !invitation) continue;
      onProgress('Activando acceso…');
      await runTransaction(db, async tx => {
        const permissionRef = doc(db, 'grants', permission.id), current = await tx.get(permissionRef);
        const candidateRef = invitation ? doc(db, 'candidates', invitation.id) : null;
        const candidate = candidateRef ? await tx.get(candidateRef) : null;
        if (!current.exists() || !current.data().active || (current.data().uid && current.data().uid !== user.uid)) throw new Error('La invitación ya no está disponible.');
        const auditId = id(), at = new Date().toISOString();
        const metadata = { _audit: auditId, _actor: user.uid, _at: serverTimestamp() };
        if (!current.data().uid) tx.update(permissionRef, { uid: user.uid, revision: Number(current.data().revision || 0) + 1, ...metadata });
        if (candidate?.exists() && candidateRef && candidate.data().access === 'invited') tx.update(candidateRef, { access: 'active', revision: Number(candidate.data().revision || 0) + 1, ...metadata });
        tx.set(doc(db, 'audit', auditId), { id: auditId, eventId: permission.eventId, actor: user.name, actorUid: user.uid, at, action: 'Primer acceso con Google verificado', atServer: serverTimestamp(), changes: [`grants/${permission.id}`, ...(candidateRef ? [`candidates/${candidateRef.id}`] : [])] });
        tx.set(doc(db, 'revisions', permission.eventId === '*' ? 'global' : permission.eventId), { at: serverTimestamp(), actor: user.uid });
        if (permission.eventId !== '*') tx.set(doc(db, 'revisions', 'global'), { at: serverTimestamp(), actor: user.uid });
      });
    }
    onProgress('Acceso comprobado');
    return user;
  }
  async function loadData(user: AppUser): Promise<AppData> {
    online();
    const data = emptyData();
    Object.assign(data,await loadMeetingData());
    data.grants = await ownGrants(user.email);
    const active = data.grants.filter(g => g.active && (!g.uid || g.uid === user.uid));
    if (!active.length) throw new Error('Tu acceso ha sido retirado.');
    const admin = isAdmin(user, data);
    const manager = active.some(g => g.role !== 'volunteer');
    if (admin) {
      await Promise.all((Object.keys(data) as CollectionName[]).filter(name=>!['meetings','meetingPublications'].includes(name)).map(async name => { applyRows(data, name, await read(name) as Row[]); }));
      const contacts = await read('personContacts');
      data.persons = data.persons.map(p => mergePersonContact(p,contacts.find(c => c.id === p.id)));
      const committees = await read('committeeContacts');
      data.congregations = data.congregations.map(c => ({ ...c, committeeEmail: String(committees.find(v => v.id === c.id)?.committeeEmail || '') }));
      return data;
    }
    const eventIds = [...new Set(active.map(g => g.eventId).filter(e => e !== '*'))];
    const globalNames: CollectionName[] = manager ? ['persons', 'departments', 'venues', 'congregations', 'templates'] : ['departments', 'venues', 'congregations'];
    await Promise.all(globalNames.map(async name => { applyRows(data, name, await read(name) as Row[]); }));
    if (!manager) {
      const person = await readDoc(doc(db, 'persons', user.personId));
      if (person.exists()) data.persons = [{ ...clean(person.data()), id: person.id } as Person];
    }
    data.persons = data.persons.map(p => ({ ...p, phone: '', email: '', gmail: '', notes: '' }));
    data.congregations = data.congregations.map(c => ({ ...c, committeeEmail: '' }));
    if (active.some(g => g.capabilities.includes('contacts') && g.role !== 'volunteer')) {
      const committees = await read('committeeContacts');
      data.congregations = data.congregations.map(c => ({ ...c, committeeEmail: String(committees.find(v => v.id === c.id)?.committeeEmail || '') }));
    }
    for (const eventId of eventIds) {
      const event = await readDoc(doc(db, 'events', eventId));
      if (event.exists() && !event.data()._deleted) data.events.push({ ...clean(event.data()), id: event.id } as AppData['events'][number]);
      const scoped = active.filter(g => g.eventId === eventId);
      const broad = scoped.some(g => g.departmentId === '*');
      const deps = broad ? ['*'] : [...new Set(scoped.map(g => g.departmentId))];
      const eventFilter = [where('eventId', '==', eventId)];
      data.notices.push(...await read('notices', [...eventFilter, where('personId', 'in', ['*', user.personId]), ...(broad ? [] : [where('departmentId', 'in', ['*', ...deps].slice(0, 10))])]) as AppData['notices']);
      // Each query matches a granted department. UI filtering is not an access boundary.
      for (const departmentId of deps) {
        const heads = await read('publicationHeads', [...eventFilter, ...(departmentId === '*' ? [] : [where('departmentId', '==', departmentId)])]);
        for (const head of heads) {
          const publication = await readDoc(doc(db, 'publications', head.publicationId));
          if (publication.exists()) data.publications.push({ ...clean(publication.data()), id: publication.id } as AppData['publications'][number]);
        }
      }
      if (!manager) continue;
      for (const departmentId of deps) {
        if (!can(user, data, 'view', eventId, departmentId)) continue;
        const filters = [...eventFilter, ...(departmentId === '*' ? [] : [where('departmentId', '==', departmentId)])];
        for (const name of ['candidates', 'shifts'] as const) data[name].push(...await read(name, filters) as never[]);
        if (can(user, data, 'manageAccess', eventId, departmentId)) data.grants.push(...await read('grants', filters) as Grant[]);
        if (can(user, data, 'contacts', eventId, departmentId)) {
          data.communications.push(...await read('communications', [...eventFilter, ...(departmentId === '*' ? [] : [where('_scopeDepartment', '==', departmentId)])]) as AppData['communications']);
        }
      }
      if (can(user, data, 'view', eventId, 'platform')) for (const name of ['program', 'plans'] as const) data[name].push(...await read(name, eventFilter) as never[]);
      if (can(user, data, 'view', eventId, '*')) data.audit.push(...await read('audit', eventFilter) as AppData['audit']);
    }
    if (manager) {
      const candidates = data.candidates.filter(c => can(user, data, 'contacts', c.eventId, c.departmentId));
      const permittedPeople = [...new Set(candidates.map(c => c.personId))];
      const existingClaims = await read('contactAccess', [where('email', '==', user.email)]);
      const claimChanges = permittedPeople.flatMap(personId => {
        const previous = existingClaims.find(claim => claim.personId === personId);
        const candidate = candidates.find(c => c.id === previous?.candidateId) || candidates.find(c => c.personId === personId)!;
        const claim = { email: user.email, personId, eventId: candidate.eventId, departmentId: candidate.departmentId, candidateId: candidate.id };
        return previous && ['email', 'personId', 'eventId', 'departmentId', 'candidateId'].every(key => previous[key] === claim[key as keyof typeof claim]) ? [] : [claim];
      });
      // Claims contain no permissions: their candidate and grant are rechecked on
      // every private read. Five per transaction stays below rule document limits.
      for (let offset = 0; offset < claimChanges.length; offset += 5) {
        const group = claimChanges.slice(offset, offset + 5);
        await runTransaction(db, async tx => {
          await Promise.all(group.map(claim => tx.get(doc(db, 'contactAccess', `${user.email}~${claim.personId}`))));
          group.forEach(claim => tx.set(doc(db, 'contactAccess', `${user.email}~${claim.personId}`), claim));
        });
      }
      const contacts = await Promise.all(permittedPeople.map(personId => readDoc(doc(db, 'personContacts', personId))));
      for (const contact of contacts) if (contact.exists() && !contact.data()._deleted) {
        const index = data.persons.findIndex(p => p.id === contact.id);
        if (index >= 0) data.persons[index] = mergePersonContact(data.persons[index],clean(contact.data()));
      }
    }
    for (const name of Object.keys(data) as CollectionName[]) applyRows(data, name, [...new Map(rows(data, name).map(r => [r.id, r])).values()]);
    return data;
  }
  return {
    mode: 'firebase',
    async meetingCommand(command,user){await meetingRequest('/meetings/command',command);return loadData(user);},
    async signIn() {
      online(); await setPersistence(auth, browserSessionPersistence);
      const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
      if (sameOriginAuth) return signInWithRedirect(auth, provider);
      const result = await signInWithPopup(auth, provider);
      try { return await resolveUser(result.user); } catch (error) { await firebaseSignOut(auth); throw error; }
    },
    signOut: () => firebaseSignOut(auth),
    currentUser(onProgress) {
      if (onProgress) { progressListeners.add(onProgress); if (currentPhase) onProgress(currentPhase); }
      // React may request restoration twice. Consume the redirect and bind the
      // approved invitation once; a later explicit restore reads current Auth.
      restoringUser ||= (async () => {
        if (sameOriginAuth) {
          reportProgress('Recibiendo respuesta de Google…');
          redirectCompletion ||= (async () => {
            const diagnostics = startAuthDiagnostics();
            try { await withReadDeadline(getRedirectResult(auth), 'Recibiendo respuesta de Google', () => diagnostics.report()); }
            finally { diagnostics.stop(); }
          })();
          await redirectCompletion;
        }
        reportProgress('Restaurando sesión…');
        let stop = () => {};
        const state = new Promise<User | null>((resolve, reject) => { stop = onAuthStateChanged(auth, resolve, reject); });
        let current: User | null;
        try { current = await withReadDeadline(state, 'Restaurando sesión'); } finally { stop(); }
        if (!current) return null;
        try { return await resolveUser(current, reportProgress); } catch (error) { await firebaseSignOut(auth); throw error; }
      })().finally(() => { restoringUser = undefined; currentPhase = ''; progressListeners.clear(); });
      return restoringUser;
    },
    loadData,
    subscribe(user, onData, onError) {
      let alive = true, loading = false, again = false;
      const reload = async () => {
        if (!alive) return; if (loading) { again = true; return; } loading = true;
        try { const data = await loadData(user); if (alive) onData(data); } catch (e) { if (alive) onError?.(e instanceof Error ? e : new Error(String(e))); }
        finally { loading = false; if (again) { again = false; void reload(); } }
      };
      const stops: (() => void)[] = [];
      stops.push(onSnapshot(query(collection(db, 'grants'), where('email', '==', user.email)), snapshot => {
        if (snapshot.metadata.fromCache) return;
        stops.splice(1).forEach(stop => stop());
        const grants = snapshot.docs.map(d => d.data() as Grant).filter(g => g.active);
        const manager = grants.some(g => g.role !== 'volunteer');
        const events = grants.some(g => g.role === 'admin') ? ['global'] : [...new Set(grants.map(g => `${manager ? '' : 'public~'}${g.eventId}`))];
        events.forEach(eventId => stops.push(onSnapshot(doc(db, 'revisions', eventId), snap => { if (!snap.metadata.fromCache) void reload(); }, err => onError?.(err))));
        void reload();
      }, err => onError?.(err)));
      return () => { alive = false; stops.forEach(stop => stop()); };
    },
    async commit(before, input, description, user, eventId, dependencies=[]) {
      online();
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) throw new Error('Vuelve a iniciar sesión.');
      const next = clone(input);
      next.grants = next.grants.map(g => ({ ...g, id: grantId(g), email: emailKey(g.email) }));
      validateChange(before, next, user, eventId);
      const changes = changesBetween(before, next);
      if (!changes.length) return clone(before);
      if (changes.length > 150) throw new Error('Guarda en grupos de hasta 150 fichas para respetar los límites gratuitos.');
      const auditId = id();
      const at = new Date().toISOString();
      const admin = isAdmin(user, before);
      const ledgerChanges = new Map<string, { before?: Shift; after?: Shift }>();
      for (const change of changes.filter(c => c.collection === 'shifts')) {
        const old = change.before as Shift | undefined, fresh = change.after as Shift | undefined;
        if (same(old && reserved(old) ? { personId: old.personId, ...entry(old) } : null, fresh && reserved(fresh) ? { personId: fresh.personId, ...entry(fresh) } : null)) continue;
        for (const key of new Set([...(old && reserved(old) ? [ledgerKey(old)] : []), ...(fresh && reserved(fresh) ? [ledgerKey(fresh)] : [])])) {
          if (ledgerChanges.has(key)) throw new Error('Guarda por separado los cambios de horario de una misma persona y día.');
          ledgerChanges.set(key, { before: old && ledgerKey(old) === key && reserved(old) ? old : undefined, after: fresh && ledgerKey(fresh) === key && reserved(fresh) ? fresh : undefined });
        }
      }
      await runTransaction(db, async tx => {
        // All reads precede every write. Transactions fail offline; no write is queued.
        const existing = await Promise.all(changes.map(c => tx.get(doc(db, c.collection, c.id))));
        const related=await Promise.all(dependencies.map(d=>tx.get(doc(db,d.collection,d.id))));
        related.forEach((snapshot,index)=>{if(!snapshot.exists()||snapshot.data()._deleted||(snapshot.data().revision||0)!==dependencies[index].revision)throw new Error('Han cambiado datos relacionados. Vuelve a revisar la importación.');});
        const ledgerSnapshots = new Map(await Promise.all([...ledgerChanges.keys()].map(async key => [key, await tx.get(doc(db, 'personDays', key))] as const)));
        const contactChanges = changes.filter(c => c.collection === 'persons');
        const contacts = new Map(await Promise.all(contactChanges.map(async c => [c.id, await tx.get(doc(db, 'personContacts', c.id))] as const)));
        const committees = new Map(await Promise.all(changes.filter(c=>c.collection==='congregations').map(async c=>[c.id,await tx.get(doc(db,'committeeContacts',c.id))] as const)));
        const emails = [...new Set(contactChanges.flatMap(c => [emailKey((c.before as Person | undefined)?.gmail || ''), emailKey((c.after as Person | undefined)?.gmail || '')]).filter(Boolean))];
        const owners = new Map(await Promise.all(emails.map(async email => [email, await tx.get(doc(db, 'gmailOwners', email))] as const)));
        const changedGrants = changes.filter(c => c.collection === 'grants');
        const membershipKeys = [...new Set(changedGrants.map(c => { const g = (c.after || c.before) as Grant; return `${g.email}~${g.eventId}`; }))];
        const memberships = new Map(await Promise.all(membershipKeys.map(async key => [key, await tx.get(doc(db, 'memberships', key))] as const)));
        const adminChanges = changedGrants.filter(c => ((c.after || c.before) as Grant).role === 'admin');
        const adminRegistry = adminChanges.length ? await tx.get(doc(db, 'system', 'administrators')) : null;
        const publicationChanges = changes.filter(c => c.collection === 'publications' && c.after);
        const heads = new Map(await Promise.all(publicationChanges.map(async c => {
          const publication = c.after as AppData['publications'][number];
          return [c.id, await tx.get(doc(db, 'publicationHeads', `${publication.eventId}~${publication.departmentId}`))] as const;
        })));
        if (adminChanges.length > 1) throw new Error('Cambia un acceso de administración cada vez.');
        for (let index = 0; index < changes.length; index++) {
          const change = changes[index], current = existing[index];
          const revision = current.exists() ? Number(current.data().revision || 0) : 0;
          if ((change.before && (!current.exists() || revision !== (change.before.revision || 0))) || (!change.before && current.exists() && !current.data()._deleted)) throw new Error('Otra persona ha modificado esta ficha. Recarga y revisa los cambios.');
          const metadata = { revision: revision + 1, _audit: auditId, _actor: user.uid, _at: serverTimestamp(), _deleted: !change.after };
          let value: DocumentData = { ...(change.after || change.before), ...metadata };
          if (change.collection === 'persons') {
            const person = (change.after || change.before) as Person;
            value = { ...operational(person), ...metadata };
            const oldPrivate = contacts.get(change.id);
            const scopeEvent = oldPrivate?.exists() ? oldPrivate.data()._scopeEvent : eventId;
            const scopeDepartment = oldPrivate?.exists() ? oldPrivate.data()._scopeDepartment : '*';
            const contactCandidate = next.candidates.find(c => c.personId === person.id && can(user, before, 'contacts', c.eventId, c.departmentId));
            if (admin || contactCandidate) {
              assertPersonContactUnchanged(change.before as Person|undefined,oldPrivate?.exists()&&!oldPrivate.data()._deleted?oldPrivate.data():undefined);
              if (!admin && contactCandidate) tx.set(doc(db, 'contactAccess', `${user.email}~${person.id}`), { email: user.email, personId: person.id, eventId: contactCandidate.eventId, departmentId: contactCandidate.departmentId, candidateId: contactCandidate.id });
              const previousHearing=oldPrivate?.exists()?oldPrivate.data().hearingStatus:undefined;
              const previousNotificationEmail=oldPrivate?.exists()?oldPrivate.data().notificationEmail:undefined;
              const previousService=Object.fromEntries(['appointment','regularPioneer','serviceCircuit'].flatMap(key=>oldPrivate?.exists()&&oldPrivate.data()[key]!==undefined?[[key,oldPrivate.data()[key]]]:[]));
              tx.set(doc(db, 'personContacts', change.id), { id: change.id, ...(previousHearing===undefined?{}:{hearingStatus:previousHearing}), ...(previousNotificationEmail===undefined?{}:{notificationEmail:previousNotificationEmail}), ...previousService, ...privateFields(person), ...metadata, revision:nextDocumentRevision(oldPrivate?.exists()?oldPrivate.data():undefined), _scopeEvent: scopeEvent, _scopeDepartment: scopeDepartment });
              const gmail = emailKey(person.gmail), oldGmail = emailKey((change.before as Person | undefined)?.gmail || '');
              if (gmail) {
                const owner = owners.get(gmail);
                if (owner?.exists() && owner.data().personId !== person.id && owner.data().active) throw new Error('Ese Gmail pertenece a otra persona.');
                tx.set(doc(db, 'gmailOwners', gmail), { email: gmail, personId: person.id, active: Boolean(change.after), _scopeEvent: scopeEvent, _scopeDepartment: scopeDepartment, ...metadata });
              }
              if (oldGmail && oldGmail !== gmail) tx.set(doc(db, 'gmailOwners', oldGmail), { email: oldGmail, personId: person.id, active: false, _scopeEvent: scopeEvent, _scopeDepartment: scopeDepartment, ...metadata });
            }
          }
          if (change.collection === 'congregations') {
            const congregation = (change.after || change.before) as AppData['congregations'][number];
            const oldCommittee=committees.get(change.id);
            assertCommitteeContactUnchanged(change.before as AppData['congregations'][number]|undefined,oldCommittee?.exists()&&!oldCommittee.data()._deleted?oldCommittee.data():undefined);
            const { committeeEmail, ...publicCongregation } = congregation;
            value = { ...publicCongregation, ...metadata };
            tx.set(doc(db, 'committeeContacts', change.id), { id: change.id, committeeEmail, ...metadata,revision:nextDocumentRevision(oldCommittee?.exists()?oldCommittee.data():undefined) });
          }
          if (change.collection === 'grants') {
            const grant = (change.after || change.before) as Grant;
            value._candidateId = next.candidates.find(c => c.eventId === grant.eventId && c.departmentId === grant.departmentId && c.personId === grant.personId)?.id || '';
            if (!change.after) value.active = false;
          }
          if (change.collection === 'notices') value = { ...value, departmentId: value.departmentId || '*', personId: value.personId || '*' };
          if (change.collection === 'communications') {
            const mail = (change.after || change.before) as AppData['communications'][number];
            value._scopeDepartment = mail.departmentId || next.candidates.find(c => c.eventId === mail.eventId && c.personId === mail.personId)?.departmentId || 'platform';
          }
          if (change.collection === 'publications') value.program = (value.program as AppData['program']).map(p => ({ ...p, speakerEmail: '' }));
          tx.set(doc(db, change.collection, change.id), value);
          if (change.after) Object.assign(change.after, { revision: revision + 1 });
        }
        for (const [key, change] of ledgerChanges) {
          const snapshot = ledgerSnapshots.get(key)!;
          const oldEntries = snapshot.exists() ? (snapshot.data().entries as LedgerEntry[]) : [];
          const entries = oldEntries.filter(e => e.id !== change.before?.id);
          if (change.after) entries.push(entry(change.after));
          entries.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          if (entries.length > 16) throw new Error('Máximo 16 turnos por persona y día.');
          for (let i = 1; i < entries.length; i++) if (entries[i].startsAt < entries[i - 1].endsAt) throw new Error('Esta persona ya está ocupada en ese horario, posiblemente en otro evento.');
          const shift = change.after || change.before!;
          const ledger: Ledger = { personId: shift.personId, day: shift.startsAt.slice(0, 10), entries, mutation: { shiftId: shift.id, before: change.before ? entry(change.before) : null, after: change.after ? entry(change.after) : null } };
          tx.set(doc(db, 'personDays', key), { ...ledger, _audit: auditId, _actor: user.uid, _at: serverTimestamp() });
        }
        for (const key of membershipKeys) {
          const snapshot = memberships.get(key)!;
          const scopes = { ...(snapshot.exists() ? snapshot.data().scopes : {}) };
          const relevant = changedGrants.filter(c => { const g = (c.after || c.before) as Grant; return `${g.email}~${g.eventId}` === key; });
          if (relevant.length > 1) throw new Error('Cambia un departamento de acceso por persona cada vez.');
          const grant = (relevant[0].after || relevant[0].before) as Grant;
          if (relevant[0].after && grant.active) scopes[grant.departmentId] = grant.id;
          else delete scopes[grant.departmentId];
          tx.set(doc(db, 'memberships', key), { email: grant.email, eventId: grant.eventId, scopes, changedDepartment: grant.departmentId, grantId: grant.id });
        }
        if (adminChanges.length && adminRegistry) {
          const grant = (adminChanges[0].after || adminChanges[0].before) as Grant;
          const emails = new Set<string>(adminRegistry.exists() ? adminRegistry.data().emails : []);
          if (adminChanges[0].after && grant.active) emails.add(grant.email); else emails.delete(grant.email);
          if (!emails.size) throw new Error('Debe quedar al menos una persona administradora.');
          tx.set(doc(db, 'system', 'administrators'), { emails: [...emails], changedEmail: grant.email });
        }
        for (const change of publicationChanges) {
          const publication = change.after as AppData['publications'][number], previous = heads.get(change.id)!;
          if (publication.version !== (previous.exists() ? previous.data().version + 1 : 1)) throw new Error('Ya hay una publicación más reciente. Recarga antes de publicar.');
          tx.set(doc(db, 'publicationHeads', `${publication.eventId}~${publication.departmentId}`), { eventId: publication.eventId, departmentId: publication.departmentId, version: publication.version, publicationId: publication.id });
        }
        tx.set(doc(db, 'audit', auditId), { id: auditId, eventId, actor: user.name, actorUid: user.uid, at, action: description.slice(0, 300), atServer: serverTimestamp(), changes: changes.map(c => `${c.collection}/${c.id}`) });
        tx.set(doc(db, 'revisions', eventId), { at: serverTimestamp(), actor: user.uid });
        tx.set(doc(db, 'revisions', 'global'), { at: serverTimestamp(), actor: user.uid });
        const publicChanges = changes.filter(c => c.collection === 'publications' || (c.collection === 'notices' && !c.before));
        for (const scope of new Set(publicChanges.map(c => (c.after as Row & { eventId: string }).eventId))) {
          const first = publicChanges.find(c => (c.after as Row & { eventId: string }).eventId === scope)!.after as Row & { departmentId?: string };
          tx.set(doc(db, 'revisions', `public~${scope}`), { at: serverTimestamp(), actor: user.uid, departmentId: first.departmentId || '*' });
        }
      });
      next.audit.push({ id: auditId, eventId, actor: user.name, at, action: description.slice(0, 300) });
      return next;
    },
  };
}
export function createRepository(seed: AppData = emptyData()): Repository { return configured ? firebaseRepository() : demoRepository(seed); }
