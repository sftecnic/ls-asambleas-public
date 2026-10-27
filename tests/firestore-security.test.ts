import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, setLogLevel, updateDoc, where, writeBatch, type Firestore } from 'firebase/firestore';

const run = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
setLogLevel('silent');
const adminEmail = 'admin@example.test', managerEmail = 'manager@example.test', volunteerEmail = 'volunteer@example.test';
const caps = ['view', 'edit', 'assign', 'publish', 'manageAccess', 'contacts'];
const grant = (email: string, personId: string, eventId: string, departmentId: string, role: string, capabilities = caps) => ({ id: `${email}~${eventId}~${departmentId}`, email, personId, eventId, departmentId, role, capabilities, active: true, revision: 1, _deleted: false, _candidateId: '' });
const iso = '2027-04-10T08:00:00.000Z';
const shift = (id: string, eventId = 'e1', startsAt = iso, endsAt = '2027-04-10T10:00:00.000Z') => ({ id, eventId, departmentId: 'video', personId: 'p1', role: 'Cámara', startsAt, endsAt, meetingPoint: 'Mesa', status: 'draft', attendance: 'planned', substituteIds: [] });
const reservation = (s: ReturnType<typeof shift>) => ({ id: s.id, eventId: s.eventId, departmentId: s.departmentId, startsAt: s.startsAt, endsAt: s.endsAt });

run('Firestore: autorización real y concurrencia', () => {
  let env: RulesTestEnvironment;
  const client = (uid: string, email: string, extra = {}) => env.authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra }).firestore();
  beforeAll(async () => { const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':'); env = await initializeTestEnvironment({ projectId: 'demo-ls-asambleas', firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } }); }, 30000);
  afterAll(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore(), batch = writeBatch(db);
      const grants = [grant(adminEmail, 'admin', '*', '*', 'admin'), grant(managerEmail, 'manager', 'e1', 'video', 'responsible'), grant(volunteerEmail, 'p1', 'e1', 'video', 'volunteer', ['view'])];
      for (const g of grants) {
        batch.set(doc(db, 'grants', g.id), g);
        batch.set(doc(db, 'profiles', g.email), { email: g.email, uid: g.personId, personId: g.personId, primaryGrantId: g.id });
        batch.set(doc(db, 'memberships', `${g.email}~${g.eventId}`), { email: g.email, eventId: g.eventId, scopes: { [g.departmentId]: g.id }, changedDepartment: g.departmentId, grantId: g.id });
      }
      batch.set(doc(db, 'system', 'administrators'), { emails: [adminEmail], changedEmail: adminEmail });
      batch.set(doc(db, 'persons', 'p1'), { id: 'p1', name: 'Persona', congregationId: 'c1', revision: 1 });
      batch.set(doc(db, 'personContacts', 'p1'), { id: 'p1', email: 'private@example.test', gmail: volunteerEmail, phone: '000', notes: 'Privado', revision: 1, _scopeEvent: 'global', _scopeDepartment: '*' });
      batch.set(doc(db, 'personContacts', 'p2'), { id: 'p2', email: 'secret@example.test', gmail: '', phone: '000', notes: 'Privado', revision: 1, _scopeEvent: 'e2', _scopeDepartment: 'video' });
      batch.set(doc(db, 'candidates', 'contact-candidate'), { id: 'contact-candidate', eventId: 'e1', departmentId: 'video', personId: 'p1', committee: 'proposed', availability: 'unknown', access: 'none', reserve: false, revision: 1, _deleted: false });
      batch.set(doc(db, 'contactAccess', `${managerEmail}~p1`), { email: managerEmail, personId: 'p1', eventId: 'e1', departmentId: 'video', candidateId: 'contact-candidate' });
      batch.set(doc(db, 'shifts', 'draft'), { ...shift('draft'), revision: 1 });
      batch.set(doc(db, 'publications', 'pub1'), { id: 'pub1', eventId: 'e1', departmentId: 'video', shifts: [], program: [], plans: [], version: 1 });
      batch.set(doc(db, 'publications', 'other'), { id: 'other', eventId: 'e1', departmentId: 'makeup', shifts: [], program: [], plans: [], version: 1 });
      await batch.commit();
    });
  });
  function meta(auditId: string, uid = 'admin', revision = 1) { return { revision, _audit: auditId, _actor: uid, _at: serverTimestamp(), _deleted: false }; }
  function audit(batch: ReturnType<typeof writeBatch>, db: Firestore, auditId: string, uid = 'admin') { batch.set(doc(db, 'audit', auditId), { id: auditId, eventId: 'e1', actor: uid, actorUid: uid, at: iso, atServer: serverTimestamp(), action: 'Prueba de turno', changes: [] }); }
  function addShift(db: Firestore, s: ReturnType<typeof shift>, entries: ReturnType<typeof reservation>[], auditId = crypto.randomUUID(), uid = 'admin') {
    const batch = writeBatch(db); audit(batch, db, auditId, uid);
    batch.set(doc(db, 'shifts', s.id), { ...s, ...meta(auditId, uid) });
    batch.set(doc(db, 'personDays', 'p1~2027-04-10'), { personId: 'p1', day: '2027-04-10', entries, mutation: { shiftId: s.id, before: null, after: reservation(s) }, _audit: auditId, _actor: uid, _at: serverTimestamp() });
    return batch.commit();
  }
  it('clasificación privada: valida opciones, impide borrado y no la publica en persons',async()=>{
    await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'gmailOwners',volunteerEmail),{email:volunteerEmail,personId:'p1',active:true}));
    const db=client('admin',adminEmail);
    for(const value of ['deaf','hearing','unknown']){
      const current=await getDoc(doc(db,'personContacts','p1')),batch=writeBatch(db),id=crypto.randomUUID();audit(batch,db,id);
      batch.update(doc(db,'personContacts','p1'),{hearingStatus:value,...meta(id,'admin',current.data()!.revision+1)});await assertSucceeds(batch.commit());
    }
    const current=await getDoc(doc(db,'personContacts','p1'));
    for(const value of ['invalid',123,null]){
      const batch=writeBatch(db),id=crypto.randomUUID();audit(batch,db,id);batch.update(doc(db,'personContacts','p1'),{hearingStatus:value,...meta(id,'admin',current.data()!.revision+1)});await assertFails(batch.commit());
      const create=writeBatch(db),newId=crypto.randomUUID();audit(create,db,newId);create.set(doc(db,'personContacts',newId),{id:newId,email:'',gmail:'',phone:'',notes:'',hearingStatus:value,_scopeEvent:'global',_scopeDepartment:'*',...meta(newId)});await assertFails(create.commit());
    }
    const {hearingStatus:_status,...legacy}=current.data()!;const remove=writeBatch(db);audit(remove,db,'drop');remove.set(doc(db,'personContacts','p1'),{...legacy,...meta('drop','admin',current.data()!.revision+1)});await assertFails(remove.commit());
    const leak=writeBatch(db);audit(leak,db,'leak');leak.update(doc(db,'persons','p1'),{hearingStatus:'deaf',...meta('leak','admin',2)});await assertFails(leak.commit());
    const denied=client('p1',volunteerEmail);await assertFails(getDoc(doc(denied,'personContacts','p1')));
    const manager=client('manager',managerEmail),edit=writeBatch(manager);audit(edit,manager,'permitted','manager');edit.update(doc(manager,'personContacts','p1'),{hearingStatus:'deaf',...meta('permitted','manager',current.data()!.revision+1)});await assertSucceeds(edit.commit());
  });
  it('servicio privado: creación y actualización validan opciones y exclusividad de SC',async()=>{
    await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'gmailOwners',volunteerEmail),{email:volunteerEmail,personId:'p1',active:true}));
    const db=client('admin',adminEmail);
    await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'persons','p1'),{congregationId:''}));
    const valid=[{appointment:'unknown',regularPioneer:'unknown'},{appointment:'none',regularPioneer:'no'},{appointment:'none',regularPioneer:'yes'},{appointment:'ministerial-servant',regularPioneer:'yes'},{appointment:'elder',regularPioneer:'yes'},{appointment:'circuit-overseer',regularPioneer:'not-applicable'}];
    const invalid=[{appointment:'admin',regularPioneer:'no'},{appointment:null,regularPioneer:'no'},{appointment:123,regularPioneer:'no'},{appointment:'elder',regularPioneer:true},{appointment:'elder',regularPioneer:'not-applicable'},{appointment:'circuit-overseer',regularPioneer:'yes'},{appointment:'circuit-overseer',regularPioneer:'no'},{appointment:'circuit-overseer',regularPioneer:'unknown'}];
    for(const [values,allowed] of [...valid.map(v=>[v,true] as const),...invalid.map(v=>[v,false] as const)]){
      const id=crypto.randomUUID(),create=writeBatch(db);audit(create,db,id);create.set(doc(db,'persons',id),{id,name:'Persona de ejemplo',congregationId:'',...meta(id)});create.set(doc(db,'personContacts',id),{id,email:'',gmail:'',phone:'',notes:'',_scopeEvent:'e1',_scopeDepartment:'video',...values,...meta(id)});
      await (allowed?assertSucceeds(create.commit()):assertFails(create.commit()));
      const current=await getDoc(doc(db,'personContacts','p1')),update=writeBatch(db),a=crypto.randomUUID();audit(update,db,a);update.update(doc(db,'personContacts','p1'),{...values,...meta(a,'admin',current.data()!.revision+1)});
      await (allowed?assertSucceeds(update.commit()):assertFails(update.commit()));
    }
  });
  it('clientes antiguos no borran el servicio guardado ni lo filtran al directorio operativo',async()=>{
    const db=client('admin',adminEmail);await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),'personContacts','p1'),{gmail:'',appointment:'elder',regularPioneer:'yes'});});
    const current=(await getDoc(doc(db,'personContacts','p1'))).data()!;
    for(const key of ['appointment','regularPioneer']){const body={...current};delete body[key];const batch=writeBatch(db),id=crypto.randomUUID();audit(batch,db,id);batch.set(doc(db,'personContacts','p1'),{...body,...meta(id,'admin',2)});await assertFails(batch.commit());}
    for(const collection of ['persons','publications']){const batch=writeBatch(db),id=crypto.randomUUID();audit(batch,db,id);batch.update(doc(db,collection,collection==='persons'?'p1':'pub1'),{appointment:'elder',regularPioneer:'yes',...meta(id,'admin',2)});await assertFails(batch.commit());}
    const preserve=writeBatch(db);audit(preserve,db,'keep-service');preserve.update(doc(db,'personContacts','p1'),{phone:'600000000',...meta('keep-service','admin',2)});await assertSucceeds(preserve.commit());expect((await getDoc(doc(db,'personContacts','p1'))).data()).toMatchObject({appointment:'elder',regularPioneer:'yes'});
  });
  it('el servicio requiere contactos y edición en el mismo ámbito y no concede acceso al voluntario',async()=>{
    await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await updateDoc(doc(db,'personContacts','p1'),{gmail:'',appointment:'none',regularPioneer:'unknown'});});
    const manager=client('manager',managerEmail),write=async()=>{const current=(await getDoc(doc(manager,'personContacts','p1'))).data()!;const b=writeBatch(manager),id=crypto.randomUUID();audit(b,manager,id,'manager');b.update(doc(manager,'personContacts','p1'),{appointment:'elder',regularPioneer:'yes',...meta(id,'manager',current.revision+1)});return b.commit();};
    await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'grants',`${managerEmail}~e1~video`),{capabilities:['view','contacts']}));await assertSucceeds(getDoc(doc(manager,'personContacts','p1')));await assertFails(write());
    await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'grants',`${managerEmail}~e1~*`),grant(managerEmail,'manager','e1','*','assistant',['view','edit'])));await assertSucceeds(write());
    await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'grants',`${managerEmail}~e1~*`),{active:false}));
    await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'grants',`${managerEmail}~e1~video`),{capabilities:caps}));await assertSucceeds(write());
    const volunteer=client('p1',volunteerEmail);await assertFails(getDoc(doc(volunteer,'personContacts','p1')));const b=writeBatch(volunteer);audit(b,volunteer,'invent-sc','p1');b.update(doc(volunteer,'personContacts','p1'),{appointment:'circuit-overseer',regularPioneer:'not-applicable',...meta('invent-sc','p1',3)});await assertFails(b.commit());
    const other=writeBatch(manager);audit(other,manager,'other-service','manager');other.update(doc(manager,'personContacts','p2'),{appointment:'elder',regularPioneer:'yes',...meta('other-service','manager',2)});await assertFails(other.commit());
  });

  it('circuitos privados del SC, conservación y colecciones del servidor protegidas',async()=>{
    const db=client('admin',adminEmail),b=writeBatch(db);audit(b,db,'sc-circuit');
    b.update(doc(db,'persons','p1'),{congregationId:'',...meta('sc-circuit','admin',2)});
    b.update(doc(db,'personContacts','p1'),{gmail:'',appointment:'circuit-overseer',regularPioneer:'not-applicable',serviceCircuit:'CIRCUITO-01B',...meta('sc-circuit','admin',2)});await assertSucceeds(b.commit());
    const leak=writeBatch(db);audit(leak,db,'sc-leak');leak.update(doc(db,'persons','p1'),{serviceCircuit:'CIRCUITO-01B',...meta('sc-leak','admin',3)});await assertFails(leak.commit());
    const congregation=writeBatch(db);audit(congregation,db,'sc-congregation');congregation.update(doc(db,'persons','p1'),{congregationId:'c1',...meta('sc-congregation','admin',3)});await assertFails(congregation.commit());
    const saved=(await getDoc(doc(db,'personContacts','p1'))).data()!,{serviceCircuit:_,...old}=saved;const legacy=writeBatch(db);audit(legacy,db,'old-sc');legacy.set(doc(db,'personContacts','p1'),{...old,...meta('old-sc','admin',3)});await assertFails(legacy.commit());
    for(const collection of ['calendarSystem','calendarLinks','calendarDrafts'])for(const clientDb of [db,client('manager',managerEmail),client('p1',volunteerEmail)]){await assertFails(getDoc(doc(clientDb,collection,'private')));await assertFails(setDoc(doc(clientDb,collection,'fake'),{id:'fake'}));}
  });
  it('congregaciones: circuito opcional válido y clientes antiguos no lo borran',async()=>{
    const db=client('admin',adminEmail),b=writeBatch(db);audit(b,db,'new-circuit');b.set(doc(db,'congregations','circuit-c'),{id:'circuit-c',name:'Congregación ficticia',circuit:'CIRCUITO-01B',...meta('new-circuit')});await assertSucceeds(b.commit());
    for(const fields of [{circuit:123},{}]){const bad=writeBatch(db),id=crypto.randomUUID();audit(bad,db,id);bad.set(doc(db,'congregations','circuit-c'),{id:'circuit-c',name:'Congregación ficticia',...fields,...meta(id,'admin',2)});await assertFails(bad.commit());}
    const volunteer=client('p1',volunteerEmail),denied=writeBatch(volunteer);denied.update(doc(volunteer,'congregations','circuit-c'),{circuit:'CIRCUITO-01A'});await assertFails(denied.commit());
  });
  it('valida alias y cargos sin convertirlos en permisos',async()=>{
    const db=client('manager',managerEmail),batch=writeBatch(db);audit(batch,db,'roles','manager');
    batch.update(doc(db,'persons','p1'),{aliases:['Nombre anterior'],...meta('roles','manager',2)});
    batch.update(doc(db,'candidates','contact-candidate'),{teamRole:'supervisor',...meta('roles','manager',2)});
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(db,'publications','other')));
    const volunteer=client('p1',volunteerEmail),bad=writeBatch(volunteer);audit(bad,volunteer,'escalate','p1');
    bad.update(doc(volunteer,'candidates','contact-candidate'),{teamRole:'responsible',...meta('escalate','p1',3)});
    await assertFails(bad.commit());
  });
  it('rechaza alias mal tipados o excesivos y cargos desconocidos en creación y actualización',async()=>{
    const db=client('admin',adminEmail);
    for(const aliases of [[123],Array(11).fill('Alias'),['x'.repeat(161)]]){
      const batch=writeBatch(db),id=crypto.randomUUID();audit(batch,db,id);
      batch.update(doc(db,'persons','p1'),{aliases,...meta(id,'admin',2)});await assertFails(batch.commit());
      const create=writeBatch(db),newId=crypto.randomUUID();audit(create,db,newId);
      create.set(doc(db,'persons',newId),{id:newId,name:'Persona',congregationId:'c1',aliases,...meta(newId)});await assertFails(create.commit());
    }
    const batch=writeBatch(db);audit(batch,db,'bad-role');batch.update(doc(db,'candidates','contact-candidate'),{teamRole:'admin',...meta('bad-role','admin',2)});await assertFails(batch.commit());
  });
  it('niega login no verificado y perfiles que inventen acceso', async () => {
    await assertFails(getDoc(doc(client('p1', volunteerEmail, { email_verified: false }), 'persons', 'p1')));
    const db = client('intruder', 'intruder@example.test');
    await assertFails(setDoc(doc(db, 'profiles', 'intruder@example.test'), { email: 'intruder@example.test', uid: 'intruder', personId: 'admin', primaryGrantId: `${adminEmail}~*~*` }));
  });
  it('voluntario ve publicación de su departamento, nunca borrador, contactos ni otro departamento', async () => {
    const db = client('p1', volunteerEmail);
    await assertSucceeds(getDoc(doc(db, 'publications', 'pub1')));
    await assertFails(getDoc(doc(db, 'publications', 'other')));
    await assertFails(getDoc(doc(db, 'shifts', 'draft')));
    await assertFails(getDoc(doc(db, 'personContacts', 'p1')));
    await assertSucceeds(getDocs(query(collection(db, 'publications'), where('eventId', '==', 'e1'), where('departmentId', '==', 'video'))));
    await assertFails(getDocs(query(collection(db, 'publications'), where('eventId', '==', 'e1'))));
  });
  it('los contactos requieren ámbito y el permiso vigente', async () => {
    const db = client('manager', managerEmail);
    await assertSucceeds(getDoc(doc(db, 'personContacts', 'p1')));
    await assertFails(getDoc(doc(db, 'personContacts', 'p2')));
    await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'grants', `${managerEmail}~e1~video`), { active: false }));
    await assertFails(getDoc(doc(db, 'personContacts', 'p1')));
  });
  it('no se puede elevar el propio rol o fabricar administración', async () => {
    const db = client('p1', volunteerEmail);
    await assertFails(updateDoc(doc(db, 'grants', `${volunteerEmail}~e1~video`), { role: 'admin', capabilities: caps }));
    await assertFails(setDoc(doc(db, 'grants', `${volunteerEmail}~*~*`), grant(volunteerEmail, 'p1', '*', '*', 'admin')));
  });
  it('una cuenta administrativa independiente se vincula sin crear una persona y conserva el respaldo', async () => {
    const email='institution@example.test',principal='account-institution',g=grant(email,principal,'*','*','admin');
    const db=client('admin',adminEmail),batch=writeBatch(db);audit(batch,db,'institution');
    batch.set(doc(db,'grants',g.id),{...g,...meta('institution')});
    batch.set(doc(db,'memberships',`${email}~*`),{email,eventId:'*',scopes:{'*':g.id},changedDepartment:'*',grantId:g.id});
    batch.set(doc(db,'system','administrators'),{emails:[adminEmail,email],changedEmail:email});
    await assertSucceeds(batch.commit());
    const institutional=client('institution-uid',email);
    await assertSucceeds(setDoc(doc(institutional,'profiles',email),{email,uid:'institution-uid',personId:principal,primaryGrantId:g.id}));
    const bind=writeBatch(institutional);audit(bind,institutional,'bind','institution-uid');
    bind.update(doc(institutional,'grants',g.id),{uid:'institution-uid',revision:2,_actor:'institution-uid',_audit:'bind',_at:serverTimestamp()});
    await assertSucceeds(bind.commit());
    await assertSucceeds(getDoc(doc(institutional,'personContacts','p1')));
    expect((await getDoc(doc(db,'persons',principal))).exists()).toBe(false);
    expect((await getDoc(doc(db,'grants',`${adminEmail}~*~*`))).data()?.active).toBe(true);
    await assertFails(setDoc(doc(client('other-uid',email),'profiles',email),{email,uid:'other-uid',personId:principal,primaryGrantId:g.id}));
  });
  it('rechaza turnos sin reserva atómica incluso para administración', async () => {
    const db = client('admin', adminEmail), batch = writeBatch(db); audit(batch, db, 'a');
    batch.set(doc(db, 'shifts', 's1'), { ...shift('s1'), ...meta('a') });
    await assertFails(batch.commit());
  });
  it('acepta reserva válida y rechaza solape entre eventos', async () => {
    const db = client('admin', adminEmail), first = shift('s1');
    await assertSucceeds(addShift(db, first, [reservation(first)]));
    const other = shift('s2', 'e2', '2027-04-10T09:00:00.000Z', '2027-04-10T11:00:00.000Z');
    await assertFails(addShift(db, other, [reservation(first), reservation(other)]));
    const adjacent = shift('s3', 'e2', '2027-04-10T10:00:00.000Z', '2027-04-10T12:00:00.000Z');
    await assertSucceeds(addShift(db, adjacent, [reservation(first), reservation(adjacent)]));
    expect((await getDoc(doc(db, 'personDays', 'p1~2027-04-10'))).data()?.entries).toHaveLength(2);
  });
  it('no permite saltar reservas antiguas ni cambiar histórico publicado', async () => {
    const db = client('admin', adminEmail), first = shift('s1');
    await assertSucceeds(addShift(db, first, [reservation(first)]));
    const other = shift('s2', 'e2', '2027-04-10T09:00:00.000Z', '2027-04-10T11:00:00.000Z');
    await assertFails(addShift(db, other, [reservation(other)]));
    await assertFails(updateDoc(doc(db, 'publications', 'pub1'), { version: 2 }));
    const db2 = client('manager', managerEmail);
    await assertFails(updateDoc(doc(db2, 'personDays', 'p1~2027-04-10'), { entries: [] }));
  });
  it('responsable puede guardar un turno de su departamento', async () => {
    const db = client('manager', managerEmail), s = shift('manager-shift');
    await assertSucceeds(addShift(db, s, [reservation(s)], 'manager-audit', 'manager'));
  });
  it('una invitación aprobada admite sólo el primer UID propio y activa su candidatura', async () => {
    const db = client('p1', volunteerEmail);
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'candidates', 'ca1'), { id: 'ca1', eventId: 'e1', departmentId: 'video', personId: 'p1', committee: 'approved', availability: 'accepted', access: 'invited', reserve: false, revision: 1, _deleted: false }));
    const batch = writeBatch(db); audit(batch, db, 'login', 'p1');
    batch.update(doc(db, 'grants', `${volunteerEmail}~e1~video`), { uid: 'p1', ...meta('login', 'p1', 2) });
    batch.update(doc(db, 'candidates', 'ca1'), { access: 'active', ...meta('login', 'p1', 2) });
    await assertSucceeds(batch.commit());
    const stolen = client('other-uid', volunteerEmail);
    await assertFails(getDoc(doc(stolen, 'publications', 'pub1')));
  });
  it('responsable delega consulta con aprobación y Gmail, nunca permisos ajenos', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore(), batch = writeBatch(db);
      batch.set(doc(db, 'candidates', 'new-candidate'), { id: 'new-candidate', eventId: 'e1', departmentId: 'video', personId: 'new-person', committee: 'approved', availability: 'accepted', access: 'invited', reserve: false, revision: 1, _deleted: false });
      batch.set(doc(db, 'gmailOwners', 'new@example.test'), { email: 'new@example.test', personId: 'new-person', active: true });
      await batch.commit();
    });
    const db = client('manager', managerEmail), batch = writeBatch(db), g = { ...grant('new@example.test', 'new-person', 'e1', 'video', 'volunteer', ['view']), _candidateId: 'new-candidate' };
    audit(batch, db, 'invite', 'manager');
    batch.set(doc(db, 'grants', g.id), { ...g, ...meta('invite', 'manager') });
    batch.set(doc(db, 'memberships', 'new@example.test~e1'), { email: 'new@example.test', eventId: 'e1', scopes: { video: g.id }, changedDepartment: 'video', grantId: g.id });
    await assertSucceeds(batch.commit());
  });
  it('admite las lecturas transaccionales de una invitación todavía inexistente', async () => {
    const db = client('manager', managerEmail);
    await assertSucceeds(runTransaction(db, async tx => {
      const [g, m] = await Promise.all([tx.get(doc(db, 'grants', 'new@example.test~e1~video')), tx.get(doc(db, 'memberships', 'new@example.test~e1'))]);
      expect(g.exists()).toBe(false); expect(m.exists()).toBe(false);
    }));
  });
  it('la publicación y su última versión se guardan juntas; el voluntario lee sólo su cabecera', async () => {
    const db = client('manager', managerEmail), batch = writeBatch(db); audit(batch, db, 'publication', 'manager');
    batch.set(doc(db, 'publications', 'new-pub'), { id: 'new-pub', eventId: 'e1', departmentId: 'video', department: { id: 'video', name: 'Audio y vídeo', icon: 'video', instructions: 'Llegar 30 minutos antes.', trainingUrl: '' }, team: [{personId:'p1',name:'Persona',role:'assistant'}], version: 1, publishedAt: iso, publishedBy: 'Responsable', shifts: [], program: [], plans: [], ...meta('publication', 'manager') });
    batch.set(doc(db, 'publicationHeads', 'e1~video'), { eventId: 'e1', departmentId: 'video', version: 1, publicationId: 'new-pub' });
    batch.set(doc(db, 'revisions', 'public~e1'), { actor: 'manager', at: serverTimestamp(), departmentId: 'video' });
    await assertSucceeds(batch.commit());
    const volunteer = client('p1', volunteerEmail);
    expect((await assertSucceeds(getDoc(doc(volunteer,'publications','new-pub')))).data()?.team).toEqual([{personId:'p1',name:'Persona',role:'assistant'}]);
    const edit=writeBatch(db);audit(edit,db,'edit-publication','manager');
    edit.update(doc(db,'publications','new-pub'),{team:[],...meta('edit-publication','manager',2)});await assertFails(edit.commit());
    await assertSucceeds(getDocs(query(collection(volunteer, 'publicationHeads'), where('eventId', '==', 'e1'), where('departmentId', '==', 'video'))));
    await assertSucceeds(getDoc(doc(volunteer, 'revisions', 'public~e1')));
    await assertFails(getDocs(query(collection(volunteer, 'publicationHeads'), where('eventId', '==', 'e1'))));
    await assertFails(updateDoc(doc(db, 'publicationHeads', 'e1~video'), { version: 2 }));
  });
  it('limita el equipo opcional de una publicación y conserva el formato anterior',async()=>{
    const db=client('manager',managerEmail);
    for(const team of [{personId:'p1'},Array(151).fill({personId:'p1',name:'Persona',role:'volunteer'})]){
      const id=crypto.randomUUID(),batch=writeBatch(db);audit(batch,db,id,'manager');
      batch.set(doc(db,'publications',id),{id,eventId:'e1',departmentId:'video',team,version:1,publishedAt:iso,publishedBy:'Responsable',shifts:[],program:[],plans:[],...meta(id,'manager')});
      await assertFails(batch.commit());
    }
    const id='legacy-without-team',batch=writeBatch(db);audit(batch,db,id,'manager');
    batch.set(doc(db,'publications',id),{id,eventId:'e1',departmentId:'video',version:1,publishedAt:iso,publishedBy:'Responsable',shifts:[],program:[],plans:[],...meta(id,'manager')});
    await assertSucceeds(batch.commit());
  });
  it('no admite degradar al último administrador para eludir su protección', async () => {
    const db = client('admin', adminEmail), batch = writeBatch(db); audit(batch, db, 'demote');
    batch.update(doc(db, 'grants', `${adminEmail}~*~*`), { role: 'volunteer', capabilities: ['view'], ...meta('demote', 'admin', 2) });
    await assertFails(batch.commit());
  });
  it('dos asignaciones concurrentes no pueden ocupar la misma persona', async () => {
    const firstDb = client('admin', adminEmail), secondDb = client('manager', managerEmail), a = shift('race-a'), b = shift('race-b');
    const result = await Promise.allSettled([addShift(firstDb, a, [reservation(a)], 'race-audit-a'), addShift(secondDb, b, [reservation(b)], 'race-audit-b', 'manager')]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await getDoc(doc(firstDb, 'personDays', 'p1~2027-04-10'))).data()?.entries).toHaveLength(1);
  });
  it('admite los 16 intervalos prometidos y rechaza el decimoséptimo', async () => {
    const toIso = (minute: number) => new Date(Date.UTC(2027, 3, 10, 0, minute)).toISOString();
    const entries = Array.from({ length: 15 }, (_, i) => reservation(shift(`existing-${i}`, 'e1', toIso(i * 30), toIso(i * 30 + 20))));
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'personDays', 'p1~2027-04-10'), { personId: 'p1', day: '2027-04-10', entries }));
    const db = client('admin', adminEmail), sixteenth = shift('sixteenth', 'e1', toIso(450), toIso(470));
    await assertSucceeds(addShift(db, sixteenth, [...entries, reservation(sixteenth)]));
    const seventeenth = shift('seventeenth', 'e1', toIso(480), toIso(500));
    await assertFails(addShift(db, seventeenth, [...entries, reservation(sixteenth), reservation(seventeenth)]));
  });
  it('no se puede fabricar autorización de contacto para otra persona o departamento', async () => {
    const db = client('manager', managerEmail);
    await assertFails(setDoc(doc(db, 'contactAccess', `${managerEmail}~p2`), { email: managerEmail, personId: 'p2', eventId: 'e1', departmentId: 'video', candidateId: 'contact-candidate' }));
    await assertFails(setDoc(doc(db, 'contactAccess', `${managerEmail}~p1`), { email: managerEmail, personId: 'p1', eventId: 'e2', departmentId: 'video', candidateId: 'contact-candidate' }));
    await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'candidates', 'contact-candidate'), { _deleted: true }));
    await assertFails(getDoc(doc(db, 'personContacts', 'p1')));
  });
  it('responsable da de alta una persona y candidatura sin necesitar acceso global a contactos', async () => {
    const db = client('manager', managerEmail), batch = writeBatch(db); audit(batch, db, 'new-person', 'manager');
    batch.set(doc(db, 'persons', 'new-person'), { id: 'new-person', name: 'Persona propuesta', congregationId: 'c1', ...meta('new-person', 'manager') });
    batch.set(doc(db, 'candidates', 'new-person-candidate'), { id: 'new-person-candidate', personId: 'new-person', eventId: 'e1', departmentId: 'video', committee: 'proposed', availability: 'unknown', access: 'none', reserve: false, ...meta('new-person', 'manager') });
    batch.set(doc(db, 'contactAccess', `${managerEmail}~new-person`), { email: managerEmail, personId: 'new-person', eventId: 'e1', departmentId: 'video', candidateId: 'new-person-candidate' });
    batch.set(doc(db, 'personContacts', 'new-person'), { id: 'new-person', phone: '', email: 'new@example.test', gmail: '', notes: '', _scopeEvent: 'e1', _scopeDepartment: '*', ...meta('new-person', 'manager') });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(db, 'personContacts', 'new-person')));
    await assertFails(getDoc(doc(client('p1', volunteerEmail), 'personContacts', 'new-person')));
  });
  it('bootstrap explícito permite primer login admin y vincula el UID sin autoalta de privilegios', async () => {
    await env.withSecurityRulesDisabled(async ctx => { await deleteDoc(doc(ctx.firestore(), 'profiles', adminEmail)); });
    const db = client('fresh-google-admin', adminEmail);
    await assertSucceeds(runTransaction(db, async tx => {
      await tx.get(doc(db, 'profiles', adminEmail));
      tx.set(doc(db, 'profiles', adminEmail), { email: adminEmail, uid: 'fresh-google-admin', personId: 'admin', primaryGrantId: `${adminEmail}~*~*` });
    }));
    const batch = writeBatch(db); audit(batch, db, 'admin-login', 'fresh-google-admin');
    batch.update(doc(db, 'grants', `${adminEmail}~*~*`), { uid: 'fresh-google-admin', ...meta('admin-login', 'fresh-google-admin', 2) });
    batch.set(doc(db, 'revisions', 'global'), { actor: 'fresh-google-admin', at: serverTimestamp() });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDocs(collection(db, 'personContacts')));
    await assertFails(getDoc(doc(client('different-admin-uid', adminEmail), 'publications', 'pub1')));
  });
  it('reuniones: ningún cliente lee tokens ni escribe publicaciones o trabajos del servicio', async () => {
    for(const name of ['meetings','meetingPublications','meetingVersions','meetingTasks','meetingDeliveries','meetingSystem','meetingOAuth']){
      await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),name,'secret'),{id:'secret',encryptedToken:'private-token'});});
      for(const db of [client('admin',adminEmail),client('manager',managerEmail),client('p1',volunteerEmail)]){
        await assertFails(getDoc(doc(db,name,'secret')));await assertFails(getDocs(collection(db,name)));await assertFails(setDoc(doc(db,name,'fake'),{id:'fake'}));
      }
    }
  });
  it('correo para avisos: solo contactos autorizados, formato y conservación', async () => {
    await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'gmailOwners',volunteerEmail),{email:volunteerEmail,personId:'p1',active:true}));
    const db=client('manager',managerEmail),batch=writeBatch(db);audit(batch,db,'notification-email','manager');
    batch.update(doc(db,'personContacts','p1'),{notificationEmail:'avisos@example.test',...meta('notification-email','manager',2)});await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(client('p1',volunteerEmail),'personContacts','p1')));
    const invalid=writeBatch(db);audit(invalid,db,'invalid-email','manager');invalid.update(doc(db,'personContacts','p1'),{notificationEmail:'x'.repeat(255),...meta('invalid-email','manager',3)});await assertFails(invalid.commit());
  });
  it('aviso de reunión: el destinatario puede marcar leído sin alterar la reunión',async()=>{
    await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'notices','meeting-notice'),{id:'meeting-notice',eventId:'e1',departmentId:'*',personId:'p1',title:'Reunión confirmada',body:'Formación',createdAt:iso,readBy:[],meetingId:'meeting-1',meetingVersion:1,revision:1,_deleted:false});});
    const db=client('p1',volunteerEmail);await assertSucceeds(getDoc(doc(db,'notices','meeting-notice')));
    const read=writeBatch(db);audit(read,db,'read-meeting','p1');read.update(doc(db,'notices','meeting-notice'),{readBy:['p1'],...meta('read-meeting','p1',2)});await assertSucceeds(read.commit());
    const hijack=writeBatch(db);audit(hijack,db,'hijack-meeting','p1');hijack.update(doc(db,'notices','meeting-notice'),{meetingId:'another-meeting',...meta('hijack-meeting','p1',3)});await assertFails(hijack.commit());
  });
  it('publica 40 turnos sin releer 40 reservas y sin permiso de editar horarios', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore(), batch = writeBatch(db);
      batch.update(doc(db, 'grants', `${managerEmail}~e1~video`), { capabilities: ['view', 'publish'] });
      for (let i = 0; i < 40; i++) batch.set(doc(db, 'shifts', `bulk-${i}`), { ...shift(`bulk-${i}`), personId: `person-${i}`, revision: 1, _deleted: false });
      await batch.commit();
    });
    const db = client('manager', managerEmail), batch = writeBatch(db); audit(batch, db, 'bulk-publish', 'manager');
    for (let i = 0; i < 40; i++) batch.update(doc(db, 'shifts', `bulk-${i}`), { status: 'published', ...meta('bulk-publish', 'manager', 2) });
    await assertSucceeds(batch.commit());
    const forbidden = writeBatch(db); audit(forbidden, db, 'bulk-edit', 'manager');
    forbidden.update(doc(db, 'shifts', 'bulk-0'), { role: 'Otro puesto', ...meta('bulk-edit', 'manager', 3) });
    await assertFails(forbidden.commit());
  });
});
