import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {createDemoData} from '../src/seed';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as unknown },
  setPersistence: vi.fn(), popup: vi.fn(), redirect: vi.fn(), redirectResult: vi.fn(), signOut: vi.fn(),
  authState: vi.fn(), read: vi.fn(), transaction: vi.fn(), providerParameters: vi.fn(),
}));
vi.mock('firebase/app', () => ({ getApps: () => [], initializeApp: (config: unknown) => config, getApp: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: () => mocks.auth,
  browserSessionPersistence: 'session',
  GoogleAuthProvider: class { setCustomParameters(value: unknown) { mocks.providerParameters(value); } },
  setPersistence: mocks.setPersistence, signInWithPopup: mocks.popup, signInWithRedirect: mocks.redirect,
  getRedirectResult: mocks.redirectResult, signOut: mocks.signOut, onAuthStateChanged: mocks.authState,
}));
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}), memoryLocalCache: () => ({}),
  collection: (_db: unknown, name: string) => name, query: (path: unknown) => path,
  where: vi.fn(), getDocsFromServer: mocks.read, getDocFromServer: vi.fn(),
  doc: (_db: unknown, name: string, id: string) => ({ name, id }),
  onSnapshot: vi.fn(), runTransaction: mocks.transaction, serverTimestamp: vi.fn(),
}));
const domain = 'demo-ls-asambleas.firebaseapp.com';
const googleUser = { uid: 'approved-user', email: 'admin@example.test', emailVerified: true, displayName: 'Administración', providerData: [{ providerId: 'google.com' }] };
const grant = { id: 'admin@example.test~*~*', uid: googleUser.uid, email: googleUser.email, personId: 'admin', role: 'admin', active: true, eventId: '*', departmentId: '*', capabilities: ['view'] };

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'public-test-key');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-ls-asambleas');
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'public-test-app');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', domain);
  vi.stubGlobal('location', { origin: `https://${domain}` });
  vi.stubGlobal('navigator', { onLine: true });
  mocks.auth.currentUser = null;
  mocks.setPersistence.mockResolvedValue(undefined);
  mocks.redirect.mockRejectedValue(new Error('navigation-started'));
  mocks.redirectResult.mockResolvedValue(null);
  mocks.popup.mockResolvedValue({ user: googleUser });
  mocks.signOut.mockImplementation(async () => { mocks.auth.currentUser = null; });
  mocks.authState.mockImplementation((_auth, callback) => { queueMicrotask(() => callback(mocks.auth.currentUser)); return vi.fn(); });
  mocks.read.mockResolvedValue({ docs: [{ id: grant.id, data: () => grant }] });
  mocks.transaction.mockImplementation(async (_db, body) => body({ get: async () => ({ exists: () => true, data: () => ({ uid: googleUser.uid }) }), set: vi.fn() }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function repository() { return (await import('../src/data/repository')).createRepository(); }

describe('Acceso Google: regreso en el mismo origen', () => {
  it('inicia redirect con sesión por pestaña y no depende de una ventana emergente', async () => {
    const repo = await repository();
    await expect(repo.signIn()).rejects.toThrow('navigation-started');
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.auth, 'session');
    expect(mocks.setPersistence.mock.invocationCallOrder[0]).toBeLessThan(mocks.redirect.mock.invocationCallOrder[0]);
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.popup).not.toHaveBeenCalled();
  });
  it('en localhost conserva popup y verifica la invitación existente', async () => {
    vi.stubGlobal('location', { origin: 'http://localhost:5173' });
    const repo = await repository();
    expect(await repo.signIn()).toMatchObject({ uid: googleUser.uid, personId: 'admin', role: 'admin' });
    expect(mocks.popup).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('espera el retorno de Google antes de leer la sesión y consume un único resultado', async () => {
    let complete!: () => void;
    mocks.redirectResult.mockImplementation(() => new Promise(resolve => { complete = () => { mocks.auth.currentUser = googleUser; resolve({ user: googleUser }); }; }));
    const repo = await repository(), firstProgress = vi.fn(), secondProgress = vi.fn();
    const first = repo.currentUser(firstProgress), duplicate = repo.currentUser(secondProgress);
    expect(mocks.authState).not.toHaveBeenCalled();
    complete();
    expect(await first).toMatchObject({ uid: googleUser.uid, role: 'admin' });
    expect(await duplicate).toEqual(await first);
    expect(mocks.redirectResult).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(firstProgress).toHaveBeenCalledWith('Recibiendo respuesta de Google…');
    expect(secondProgress).toHaveBeenCalledWith('Recibiendo respuesta de Google…');
    expect(secondProgress).toHaveBeenCalledWith('Acceso comprobado');
    await repo.signOut();
    expect(await repo.currentUser()).toBeNull();
  });
  it('muestra errores del retorno en vez de aparentar que el usuario cerró una ventana', async () => {
    mocks.redirectResult.mockRejectedValue(new Error('auth/unauthorized-domain'));
    await expect((await repository()).currentUser()).rejects.toThrow('auth/unauthorized-domain');
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('no concede acceso a un Google válido sin invitación al volver del redirect', async () => {
    mocks.auth.currentUser = googleUser;
    mocks.read.mockResolvedValue({ docs: [] });
    await expect((await repository()).currentUser()).rejects.toThrow('todavía no tiene acceso');
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('sin conexión no inicia ni popup ni redirect', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect((await repository()).signIn()).rejects.toThrow('Sin conexión');
    expect(mocks.popup).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('si Google no responde termina la espera e identifica el paso, sin consultar datos', async () => {
    const repo = await repository(); vi.useFakeTimers();
    mocks.redirectResult.mockReturnValue(new Promise(() => {}));
    const progress = vi.fn(), rejected = expect(repo.currentUser(progress)).rejects.toThrow('Recibiendo respuesta de Google');
    await vi.advanceTimersByTimeAsync(20_000); await rejected;
    expect(progress).toHaveBeenCalledWith('Recibiendo respuesta de Google…');
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('si una lectura de permisos no responde termina antes de cualquier escritura', async () => {
    const repo = await repository(); vi.useFakeTimers();
    mocks.auth.currentUser = googleUser;
    mocks.read.mockReturnValue(new Promise(() => {}));
    const progress = vi.fn(), rejected = expect(repo.currentUser(progress)).rejects.toThrow('Leyendo permisos');
    await vi.advanceTimersByTimeAsync(20_000); await rejected;
    expect(progress).toHaveBeenCalledWith('Leyendo permisos…');
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
  it('una transacción iniciada conserva la espera y no se abandona por el límite de lecturas', async () => {
    const repo = await repository(); vi.useFakeTimers();
    mocks.auth.currentUser = googleUser;
    let complete!: () => void;
    mocks.transaction.mockImplementation(() => new Promise(resolve => { complete = () => resolve(undefined); }));
    const progress = vi.fn(); let settled = false;
    const task = repo.currentUser(progress).then(user => { settled = true; return user; });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(progress).toHaveBeenLastCalledWith('Vinculando perfil…');
    expect(settled).toBe(false);
    expect(mocks.signOut).not.toHaveBeenCalled();
    complete();
    expect(await task).toMatchObject({ uid: googleUser.uid });
  });
});

describe('Guardado Firebase con histórico cargado desde el servidor',()=>{
  it('separa la clasificación privada y la conserva cuando un cliente antiguo no la incluye',async()=>{
    const data=createDemoData(),user={uid:googleUser.uid,email:googleUser.email,name:'Administración',personId:'p-admin',role:'admin' as const};
    data.grants=[{...grant,personId:user.personId} as typeof data.grants[number]];
    const stored=new Map<string,Record<string,unknown>>();
    for(const [name,rows] of Object.entries(data))for(const row of rows)stored.set(`${name}/${row.id}`,{...row,revision:1});
    stored.set('personContacts/p2',{id:'p2',phone:'',email:data.persons[2].email,gmail:'',notes:'',hearingStatus:'deaf',revision:1,_scopeEvent:'e1',_scopeDepartment:'video'});
    mocks.auth.currentUser=googleUser;
    mocks.read.mockImplementation(async(name:string)=>({docs:[...stored].filter(([key])=>key.startsWith(`${name}/`)).map(([key,value])=>({id:key.slice(name.length+1),data:()=>value}))}));
    const writes:{name:string;id:string;value:Record<string,unknown>}[]=[];
    mocks.transaction.mockImplementation(async(_db,body)=>body({get:async(ref:{name:string;id:string})=>({exists:()=>stored.has(`${ref.name}/${ref.id}`),data:()=>stored.get(`${ref.name}/${ref.id}`)}),set:(ref:{name:string;id:string},value:Record<string,unknown>)=>writes.push({...ref,value})}));
    const repo=await repository(),before=await repo.loadData(user),next=structuredClone(before);
    expect(before.persons.find(p=>p.id==='p2')?.hearingStatus).toBe('deaf');
    const person=next.persons.find(p=>p.id==='p2')!;delete person.hearingStatus;person.name='Nombre actualizado';
    await repo.commit(before,next,'Editó ficha antigua',user,'e1');
    expect(writes.find(w=>w.name==='persons'&&w.id==='p2')?.value).not.toHaveProperty('hearingStatus');
    expect(writes.find(w=>w.name==='personContacts'&&w.id==='p2')?.value.hearingStatus).toBe('deaf');
    writes.length=0;person.hearingStatus='unknown';await repo.commit(before,next,'Dejó clasificación sin indicar',user,'e1');
    expect(writes.find(w=>w.name==='personContacts'&&w.id==='p2')?.value.hearingStatus).toBe('unknown');
  });
  it('registra asistencia sin confundir el Timestamp del histórico con una edición',async()=>{
    const {Timestamp}=await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
    const data=createDemoData(),user={uid:googleUser.uid,email:googleUser.email,name:'Administración',personId:'p-admin',role:'admin' as const};
    data.grants=[{...grant,personId:user.personId} as typeof data.grants[number]];
    const rawAudit={...data.audit[0],actorUid:googleUser.uid,atServer:new Timestamp(1792680000,123456000),changes:['shifts/s1']};
    const stored=new Map<string,Record<string,unknown>>();
    for(const [name,rows] of Object.entries(data))for(const row of rows)stored.set(`${name}/${row.id}`,{...row,revision:1});
    stored.set(`audit/${rawAudit.id}`,rawAudit);
    mocks.auth.currentUser=googleUser;
    mocks.read.mockImplementation(async(name:string)=>({docs:[...stored].filter(([key])=>key.startsWith(`${name}/`)).map(([key,value])=>({id:key.slice(name.length+1),data:()=>value}))}));
    const writes:{name:string;id:string;value:Record<string,unknown>}[]=[];
    mocks.transaction.mockImplementation(async(_db,body)=>body({
      get:async(ref:{name:string;id:string})=>({exists:()=>stored.has(`${ref.name}/${ref.id}`),data:()=>stored.get(`${ref.name}/${ref.id}`)}),
      set:(ref:{name:string;id:string},value:Record<string,unknown>)=>writes.push({...ref,value}),
    }));
    const repo=await repository(),before=await repo.loadData(user),next=structuredClone(before);
    next.shifts[0].attendance='present';
    const saved=await repo.commit(before,next,'Presencia registrada',user,'e1');
    expect(saved.shifts[0].attendance).toBe('present');
    expect(writes.filter(w=>w.name==='shifts')).toHaveLength(1);
    expect(writes.filter(w=>w.name==='audit')).toHaveLength(1);
    expect(writes.find(w=>w.name==='audit')?.id).not.toBe(rawAudit.id);
    expect(writes.some(w=>w.name==='personDays')).toBe(false);
    expect(before.audit[0]).not.toHaveProperty('atServer');
    expect(rawAudit.atServer).toBeInstanceOf(Timestamp);
    expect(saved.audit.slice(0,before.audit.length)).toEqual(before.audit);
    const forged=structuredClone(before);forged.audit[0].actor='Actor falso';
    const calls=mocks.transaction.mock.calls.length;
    await expect(repo.commit(before,forged,'Alteración no permitida',user,'e1')).rejects.toThrow('histórico');
    expect(mocks.transaction).toHaveBeenCalledTimes(calls);
  });
});
