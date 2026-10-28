import {useEffect, useRef, useState, type FormEvent, type SetStateAction} from 'react';
import {Eye, Pencil, CalendarDays, Send, ContactRound, UserRoundCog, ShieldCheck, ShieldOff, Plus, Search, ArrowLeft, ArrowRight, Save, Check, Minus, LockKeyhole, Users, MapPin} from 'lucide-react';
import type {AppData, AssemblyEvent, Capability, Grant, PanelProps} from '../domain/types';
import {can, capabilities, grantId, isAdmin} from '../domain/rules';
import {dateLabel} from '../domain/format';
import {accessEligibility, accessLabel, canReadPersonGmail, managementRole, permissionChanges, permissionInfo, permissionOrder, type AccessMode} from '../domain/accessPresentation';
import {DepartmentIcon, Empty, ErrorMessage, Modal, Status} from './UI';
import {useUnsavedChanges} from './useUnsavedChanges';
import {useViewState} from './ViewState';
import '../styles/access.css';

const icons = {view: Eye, edit: Pencil, assign: CalendarDays, publish: Send, contacts: ContactRound, manageAccess: UserRoundCog};
type AccessContext = Pick<PanelProps, 'data' | 'event' | 'user' | 'online'>;
function EventScope({data, event}: {data: AppData; event: AssemblyEvent}) {
  const venue = data.venues.find(v => v.id === event.venueId);
  if (!event.id) return <p className="access-hint">Crea primero una asamblea en Más → Eventos.</p>;
  return <div className="access-event"><strong>{event.title}</strong><span><CalendarDays size={18} aria-hidden="true"/>{dateLabel(event.startDate)}{event.endDate !== event.startDate ? ` – ${dateLabel(event.endDate)}` : ''}</span><span><MapPin size={18} aria-hidden="true"/>{venue?.city || 'Localidad sin indicar'}</span></div>;
}
function CapabilityList({values}: {values: Capability[]}) {
  return <ul className="access-cap-list">{permissionOrder.filter(c => values.includes(c)).map(cap => {const Icon = icons[cap]; return <li key={cap}><Icon size={19} aria-hidden="true"/>{permissionInfo[cap].label}</li>;})}</ul>;
}

export default function AccessPanel({data, event, user, online, onSave}: AccessContext & {onSave: (grant: Grant) => Promise<void>}) {
  const admin = isAdmin(user, data);
  const departments = data.departments.filter(d => admin || can(user, data, 'manageAccess', event.id, d.id));
  const [query, setQuery] = useViewState('access.search', '');
  const [department, setDepartment] = useViewState('access.department', '');
  const [editing, setEditing] = useViewState<{initial?: Grant; general: boolean; draftId: string} | undefined>('access.open-editor', undefined);
  const [notice, setNotice] = useState('');
  const search = query.trim().toLocaleLowerCase('es');
  const eventGrants = data.grants.filter(g => g.eventId === event.id && g.role !== 'admin' && departments.some(d => d.id === g.departmentId) && (!department || g.departmentId === department) && `${data.persons.find(p => p.id === g.personId)?.name || ''} ${g.email}`.toLocaleLowerCase('es').includes(search)).sort((a,b) => (data.persons.find(p => p.id === a.personId)?.name || a.email).localeCompare(data.persons.find(p => p.id === b.personId)?.name || b.email, 'es'));
  const admins = admin ? data.grants.filter(g => g.role === 'admin' && g.eventId === '*' && g.departmentId === '*') : [];
  function row(grant: Grant) {return <article className="access-row" key={grant.id}>
    <div className="access-row-main"><h3>{data.persons.find(p => p.id === grant.personId)?.name || grant.email}</h3><p className="access-email">{grant.email}</p>
      {grant.role !== 'admin' && <p className="access-department"><DepartmentIcon department={data.departments.find(d => d.id === grant.departmentId)}/>{data.departments.find(d => d.id === grant.departmentId)?.name || 'Departamento no disponible'}<span>{accessLabel(grant.role)}</span></p>}
      {grant.role === 'admin' ? <p>Todos los permisos. Todas las asambleas y departamentos.</p> : <CapabilityList values={grant.capabilities}/>}
    </div><div className="access-row-actions"><Status kind={grant.active ? 'good' : 'draft'}>{grant.active ? 'Puede entrar' : 'Acceso retirado'}</Status><button className="btn" disabled={!online} onClick={() => setEditing({initial: grant, general: grant.role === 'admin', draftId: crypto.randomUUID()})}><Pencil size={20} aria-hidden="true"/>Cambiar permisos</button></div>
  </article>;}
  return <div className="access-panel">
    {notice && <div className="message success" role="status"><Check size={22} aria-hidden="true"/>{notice}</div>}
    <section aria-label="Permisos de esta asamblea"><div className="access-heading"><EventScope data={data} event={event}/><button className="btn btn-primary" disabled={!online || !event.id} onClick={() => setEditing({general: false, draftId: crypto.randomUUID()})}><Plus size={20} aria-hidden="true"/>Dar acceso</button></div>
      <div className="access-filters"><label className="field"><span><Search size={19} aria-hidden="true"/>Buscar persona o Gmail</span><input type="search" name="access-search" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off"/></label><label className="field">Departamento<select name="access-department" value={department} onChange={e => setDepartment(e.target.value)}><option value="">Todos los autorizados</option>{departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label></div>
      <div className="access-list">{eventGrants.map(row)}{!eventGrants.length && <Empty>No hay accesos con esta selección.</Empty>}</div>
    </section>
    {admin && <section className="access-general" aria-labelledby="access-general-heading"><div className="access-heading"><div><h2 id="access-general-heading"><ShieldCheck size={25} aria-hidden="true"/>Administración general</h2><p>Todas las asambleas y departamentos.</p></div><button className="btn" disabled={!online} onClick={() => setEditing({general: true, draftId: crypto.randomUUID()})}><Plus size={20} aria-hidden="true"/>Añadir administrador</button></div><div className="access-list">{admins.map(row)}</div></section>}
    {editing && <AccessEditor {...{data, event, user, online}} draftId={editing.draftId} initial={editing.initial} general={editing.general} initialDepartment={department} onClose={() => setEditing(undefined)} onSave={async grant => {await onSave(grant); setNotice('Permisos guardados. La persona debe recargar la página para aplicar el acceso actualizado.');}}/>}
  </div>;
}

interface AccessDraft {department: string; personId: string; mode: AccessMode; role: Grant['role']; selected: Capability[]; active: boolean; step: number}
export function AccessEditor({initial, general, initialDepartment, draftId, data, event, user, online, onSave, onClose}: AccessContext & {initial?: Grant; general: boolean; initialDepartment?: string; draftId: string; onSave: (grant: Grant) => Promise<void>; onClose: () => void}) {
  const admin = isAdmin(user, data);
  const departments = data.departments.filter(d => admin || can(user, data, 'manageAccess', event.id, d.id));
  const defaults: AccessDraft = {department: initial?.departmentId || initialDepartment || departments[0]?.id || '', personId: initial?.personId || '', mode: initial && initial.role !== 'volunteer' ? 'manage' : 'consult', role: initial?.role || (general ? 'admin' : 'volunteer'), selected: initial?.capabilities || ['view'], active: initial?.active ?? true, step: 1};
  // Session memory only: reconnect restores the draft; sign-out clears ViewState.
  const [draft, setDraft] = useViewState<AccessDraft | undefined>('access.draft.' + draftId, undefined);
  const {department, personId, mode, role, selected, active, step} = draft || defaults;
  function field<K extends keyof AccessDraft>(key: K, value: SetStateAction<AccessDraft[K]>) {setDraft(previous => {const current = previous || defaults; return {...current, [key]: typeof value === 'function' ? (value as (v: AccessDraft[K]) => AccessDraft[K])(current[key]) : value};});}
  const setDepartment = (v: string) => field('department', v), setPersonId = (v: string) => field('personId', v), setMode = (v: AccessMode) => field('mode', v), setRole = (v: Grant['role']) => field('role', v), setSelected = (v: SetStateAction<Capability[]>) => field('selected', v), setActive = (v: boolean) => field('active', v), setStep = (v: number) => field('step', v);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null), errorFocus = useRef<HTMLDivElement>(null);
  const snapshot = JSON.stringify({department, personId, role, selected: [...selected].sort(), active});
  const baseline = useRef(JSON.stringify({department: defaults.department, personId: defaults.personId, role: defaults.role, selected: [...defaults.selected].sort(), active: defaults.active}));
  const finish = () => {setDraft(undefined); onClose();};
  const allowClose = useUnsavedChanges(snapshot !== baseline.current, busy, finish);
  const close = () => {if (allowClose()) finish();};
  useEffect(() => {heading.current?.focus();}, [step]);
  useEffect(() => {if (error) errorFocus.current?.focus();}, [error]);
  const person = data.persons.find(p => p.id === personId);
  const email = initial?.email || (canReadPersonGmail(data, user, personId) ? person?.gmail.trim().toLowerCase() || '' : '');
  const accountOnly = general && initial && !person;
  const people = general ? data.persons : data.persons.filter(p => p.id === initial?.personId || data.candidates.some(c => c.personId === p.id && c.eventId === event.id && c.departmentId === department));
  const allowed = permissionOrder.filter(cap => admin || can(user, data, cap, event.id, department));
  const issues = active ? accessEligibility(data, user, personId, event.id, department, general, initial) : personId ? [] : ['Elige una persona.'];
  const effective = general ? [...capabilities] : selected;
  const changes = permissionChanges(initial?.active ? initial.capabilities : [], active ? effective : []);
  const modeChanged = !!initial && accessLabel(initial.role) !== accessLabel(role);
  const invalidDelegation = !admin && (general || effective.some(cap => !can(user, data, cap, event.id, department)));
  function changeMode(next: AccessMode) {
    setMode(next); setRole(next === 'consult' ? 'volunteer' : managementRole(initial));
    if (next === 'consult') setSelected(['view']);
    else setSelected(values => values.includes('view') ? values : ['view', ...values]);
  }
  function changeActive(value: boolean) {
    setActive(value);
    if (value) setSelected(values => values.includes('view') ? values : ['view', ...values]);
  }
  function nextStep() {setError(''); if (step === 1 && issues.length) {setError(issues.join(' ')); return;} setStep(general ? 3 : Math.min(3, step + 1));}
  async function submit(e: FormEvent) {
    e.preventDefault(); if (step !== 3) {nextStep(); return;} if (pending.current || !online) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (issues.length) throw new Error(issues.join(' '));
      if (invalidDelegation || (!admin && !can(user, data, 'manageAccess', event.id, department))) throw new Error('Solo puedes dar los permisos que tienes en este departamento. Pide ayuda a administración.');
      if (active && !effective.includes('view')) throw new Error('Un acceso activo necesita Consultar.');
      if (initial?.role === 'admin' && !active && data.grants.filter(g => g.active && g.role === 'admin').length === 1) throw new Error('Debe quedar al menos una persona administradora.');
      const grant: Grant = {...initial, id: initial?.id || '', email, personId, eventId: initial?.eventId || (general ? '*' : event.id), departmentId: initial?.departmentId || (general ? '*' : department), role, capabilities: effective, active};
      grant.id = initial?.id || grantId(grant);
      if (!initial && data.grants.some(g => g.id === grant.id)) throw new Error('Este acceso ya existe. Abre Cambiar permisos.');
      await onSave(grant); finish();
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'No se ha guardado. Conservamos tus cambios; vuelve a intentarlo.');}
    finally {pending.current = false; setBusy(false);}
  }
  return <Modal title={general ? 'Administración general' : initial ? 'Cambiar permisos' : 'Dar acceso'} onClose={close} wide>
    <form className="access-form" onSubmit={e => void submit(e)} aria-busy={busy}>
      <ol className="access-steps" aria-label="Pasos">{(general ? [[1, 'Cuenta'], [3, 'Revisar']] : [[1, 'Persona'], [2, 'Acciones'], [3, 'Revisar']]).map(([number, title], index) => <li key={number} aria-current={step === number ? 'step' : undefined}><span>{index + 1}</span>{title}</li>)}</ol>
      {error && <div ref={errorFocus} tabIndex={-1}><ErrorMessage message={error}/></div>}
      <h3 ref={heading} tabIndex={-1} className="access-step-title">{step === 1 ? general ? 'Cuenta administradora' : 'Persona y departamento' : step === 2 ? 'Qué puede hacer' : 'Revisar permisos'}</h3>
      {general ? <div className="access-global-scope"><ShieldCheck size={25} aria-hidden="true"/><div><strong>Todas las asambleas y departamentos</strong><p>Puede gestionar toda la aplicación, los datos personales y los permisos.</p></div></div> : <EventScope data={data} event={event}/>}
      {step === 1 && <>
        {!general && <label className="field">Departamento<select name="access-department" value={department} disabled={!!initial || busy} onChange={e => {setDepartment(e.target.value); setPersonId('');}}><option value="" disabled>Elegir…</option>{departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>}
        {accountOnly ? <label className="field">Cuenta administrativa<input type="email" name="admin-account" autoComplete="off" spellCheck={false} value={email} readOnly/></label> : <label className="field">Persona<select name="access-person" value={personId} disabled={!!initial || busy} onChange={e => setPersonId(e.target.value)}><option value="">Elegir…</option>{people.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}
        {personId && <div className="access-eligibility" aria-live="polite">{email && !accountOnly && <p className="access-email">{email}</p>}{issues.length ? issues.map(issue => <Status kind="pending" key={issue}>{issue}</Status>) : <Status kind="good">{initial ? 'Cuenta vinculada' : general ? 'Gmail disponible' : 'Comité aprobado · Participación aceptada · Gmail disponible'}</Status>}</div>}
        {!people.length && !accountOnly && <Empty>Añade primero la persona al equipo de este departamento.</Empty>}
        {general && <label className="admin-check"><input type="checkbox" checked={active} disabled={busy} onChange={e => changeActive(e.target.checked)}/>Puede entrar</label>}
      </>}
      {step === 2 && <>
        <div className="access-identity"><Users size={22} aria-hidden="true"/><div><strong>{person?.name || email}</strong><span>{data.departments.find(d => d.id === department)?.name}</span></div></div>
        <fieldset className="access-mode"><legend>Tipo de acceso</legend>{(['consult','manage'] as const).map(value => <label key={value} className={mode === value ? 'is-selected' : ''}><input type="radio" name="access-mode" value={value} checked={mode === value} disabled={busy} onChange={() => changeMode(value)}/>{value === 'consult' ? <Eye size={24} aria-hidden="true"/> : <UserRoundCog size={24} aria-hidden="true"/>}<span><strong>{value === 'consult' ? 'Consulta' : 'Gestión'}</strong><small>{value === 'consult' ? 'Publicaciones y convocatorias autorizadas.' : 'Elegir acciones en este departamento.'}</small></span></label>)}</fieldset>
        <fieldset className="access-capabilities"><legend>Acciones permitidas</legend>{permissionOrder.filter(cap => mode === 'manage' || selected.includes(cap)).map(cap => {
          const Icon = icons[cap], locked = cap === 'view' || !allowed.includes(cap) || mode === 'consult';
          return <div className={`access-capability ${selected.includes(cap) ? 'is-selected' : ''}`} key={cap}><label><input type="checkbox" checked={selected.includes(cap)} disabled={busy || locked} onChange={e => setSelected(values => e.target.checked ? [...values, cap] : values.filter(c => c !== cap))}/><Icon size={24} aria-hidden="true"/><span><strong>{permissionInfo[cap].label}</strong><small>{permissionInfo[cap].description}</small>{cap === 'view' && <small className="access-locked"><LockKeyhole size={15} aria-hidden="true"/>Incluido</small>}{!allowed.includes(cap) && <small>No puedes conceder este permiso.</small>}</span></label><details><summary>Qué incluye</summary><p>{permissionInfo[cap].detail}</p></details></div>;
        })}</fieldset>
        <label className="admin-check"><input type="checkbox" checked={active} disabled={busy} onChange={e => changeActive(e.target.checked)}/>{active ? <ShieldCheck size={21} aria-hidden="true"/> : <ShieldOff size={21} aria-hidden="true"/>}Puede entrar</label>
        {!active && <Status kind="pending">Se retirará este acceso. Sus otros accesos se conservan.</Status>}
      </>}
      {step === 3 && <>
        <dl className="access-review"><div><dt>Persona</dt><dd>{person?.name || email}</dd></div><div><dt>Gmail</dt><dd>{email}</dd></div>{!general && <div><dt>Departamento</dt><dd>{data.departments.find(d => d.id === department)?.name}</dd></div>}<div><dt>Acceso</dt><dd>{accessLabel(role)}{modeChanged && <small>Antes: {accessLabel(initial!.role)}</small>}</dd></div></dl>
        <Status kind={active ? 'good' : 'pending'}>{active ? 'Puede entrar' : 'Se retirará este acceso'}</Status>
        {changes.added.length > 0 && <section className="access-delta"><h4><Plus size={20} aria-hidden="true"/>Se añade</h4><CapabilityList values={changes.added}/></section>}
        {changes.removed.length > 0 && <section className="access-delta"><h4><Minus size={20} aria-hidden="true"/>Se retira</h4><CapabilityList values={changes.removed}/></section>}
        {active && <section className="access-delta"><h4><Check size={20} aria-hidden="true"/>Podrá hacer</h4><CapabilityList values={effective}/></section>}
        {!changes.added.length && !changes.removed.length && !modeChanged && <p className="access-hint">Las acciones se mantienen.</p>}
        {general && <p className="access-hint">Este cambio afecta al acceso general, no solo a la asamblea seleccionada.</p>}
        {invalidDelegation && <Status kind="pending">Hay permisos que no puedes conceder. Vuelve a Acciones o pide ayuda a administración.</Status>}
        <p className="access-hint">La persona deberá recargar la página para aplicar el acceso actualizado.</p>
      </>}
      {!online && <Status kind="pending">Conéctate para guardar. Tus cambios siguen aquí.</Status>}
      <div className="modal-actions access-actions"><button type="button" className="btn" disabled={busy} onClick={step === 1 ? close : () => {setError(''); setStep(general ? 1 : step - 1);}}><ArrowLeft size={20} aria-hidden="true"/>{step === 1 ? 'Cancelar' : 'Volver'}</button>{step < 3 ? <button className="btn btn-primary" disabled={busy || (step === 1 && !!issues.length)}>{step === 2 || general ? 'Revisar' : 'Continuar'}<ArrowRight size={20} aria-hidden="true"/></button> : <button className="btn btn-primary" disabled={busy || !online || invalidDelegation}><Save size={20} aria-hidden="true"/>{busy ? 'Guardando…' : 'Guardar permisos'}</button>}</div>
    </form>
  </Modal>;
}
