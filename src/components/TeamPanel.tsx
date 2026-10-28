import Filters from './Filters';
import {useViewState} from './ViewState';
import {DepartmentIcon,SectionTabs} from './UI';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, CheckCheck, ChevronRight, CircleUserRound, Clock3, ContactRound, Mail, Pencil, Plus, Search, ShieldCheck, Star, TriangleAlert, UserCheck, UserPlus, Users, History, BookUser, X } from 'lucide-react';
import type { AppData, Candidate, Grant, PanelProps, Person, HearingStatus } from '../domain/types';
import { hasCapability, isEmail, isGmail } from '../domain/mail';
import { isAdmin } from '../domain/rules';
import { groupPeople, matchesTeamFilter, sortTeamGroups, teamRole, teamRoleLabels, teamView, type TeamFilter } from '../domain/team';
import Correspondence from './Correspondence';
import DirectoryPanel from './DirectoryPanel';
import HomeFocus from './HomeFocus';
import {attentionIds,type HomeIntent} from '../domain/homeDashboard';
import {AffiliationFields} from './AffiliationFields';
import {affiliationLabel} from '../domain/circuits';
import {HearingField,ProfileFilters,ProfileSummary,ServiceFields,ServiceDetails} from './PersonProfile';
import {canReadProfile,canEditService,profileMatches,emptyProfileFilters,serviceFilterChips} from '../domain/personProfile';
import '../styles/team.css';
import {PersonName,PersonContactActions} from './PersonContact';
import {personFingerprint} from '../domain/personRecords';


const committeeLabels = {proposed:'Sin solicitar',pending:'Pendiente',approved:'Aprobado',denied:'No aprobado'};
const availabilityLabels = {unknown:'Sin consultar',invited:'Pendiente',accepted:'Aceptado',declined:'No disponible'};

function Dialog({title,eyebrow,children,onClose,footer,titleAction}:{title:string;eyebrow?:string;children:ReactNode;onClose:()=>void;footer?:ReactNode;titleAction?:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const prior=document.activeElement as HTMLElement|null;if(titleAction&&closeButton.current)closeButton.current.autofocus=true;ref.current?.showModal();if(titleAction)closeButton.current?.focus({preventScroll:true});return()=>{ref.current?.close();prior?.focus();};},[]);
  return <dialog ref={ref} className="team-dialog" aria-labelledby="team-detail-heading" onCancel={e=>{e.preventDefault();onClose();}}><header className="team-dialog-heading"><div className="team-heading-icon"><ContactRound size={25}/></div><div>{eyebrow&&<span className="team-eyebrow">{eyebrow}</span>}<div className="modal-title-contact"><h2 id="team-detail-heading">{title}</h2>{titleAction}</div></div><button className="team-icon-button" ref={closeButton} aria-label="Cerrar ficha" onClick={onClose}><X/></button></header><div className="team-dialog-content">{children}</div>{footer&&<footer className="team-dialog-footer">{footer}</footer>}</dialog>;
}

function Status({state,label}:{state:'neutral'|'pending'|'good'|'bad';label:string}) {
  const Icon=state==='good'?Check:state==='pending'?Clock3:state==='bad'?X:Pencil;
  return <span className={`team-status ${state}`}><Icon size={16}/>{label}</span>;
}

export default function TeamPanel(props:PanelProps&{initialIntent?:HomeIntent;onShowHistory?:(id:string)=>void}) {
  const {data,event,user,onChange,canEdit,online}=props;
  const [search,setSearch]=useViewState('team.search','');
  const [homeIntent,setHomeIntent]=useState(props.initialIntent);
  const [directory,setDirectory]=useViewState('team.directory',false);
  const [profileFilters,setProfileFilters]=useViewState('team.profile',{...emptyProfileFilters});
  const authorizedIds=new Set(data.persons.filter(p=>canReadProfile(data,user,p.id)).map(p=>p.id));
  const [filter,setFilter]=useViewState<TeamFilter>('team.situation','all');
  const [departmentFilter,setDepartmentFilter]=useViewState('team.department',props.initialIntent?.departmentIds.length===1?props.initialIntent.departmentIds[0]:'','departamento');
  useEffect(()=>{if(props.initialIntent){setSearch('');setFilter('all');setProfileFilters({...emptyProfileFilters});setDirectory(false);}},[props.initialIntent]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [detailTab,setDetailTab]=useState<'data'|'team'|'access'>('data');
  const detailOpener=useRef('');
  const [composeId,setComposeId]=useState<string|null>(null);
  const [adding,setAdding]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [gmail,setGmail]=useState('');
  const [editingPerson,setEditingPerson]=useState<Person|null>(null);
  const editingBaseline=useRef('');
  const [mode,setMode]=useState<'existing'|'new'>('existing');
  const [existingPersonId,setExistingPersonId]=useState('');
  const [departmentId,setDepartmentId]=useState(data.departments[0]?.id||'');
  const [newPerson,setNewPerson]=useState<Omit<Person,'id'>>({name:'',congregationId:data.congregations[0]?.id||'',phone:'',email:'',gmail:'',notes:'',hearingStatus:'unknown' as HearingStatus});
  const candidates=data.candidates.filter(c=>c.eventId===event.id);
  const candidate=selectedId?candidates.find(c=>c.id===selectedId):undefined;
  const person=data.persons.find(p=>p.id===candidate?.personId);
  const congregation=data.congregations.find(c=>c.id===person?.congregationId);
  useEffect(()=>{
    const dirty=Boolean(editingPerson&&person&&JSON.stringify(editingPerson)!==JSON.stringify(person));
    const guard=(e:Event)=>{if(busy||dirty&&!window.confirm('¿Descartar los cambios de la ficha?'))e.preventDefault();};
    const unload=(e:BeforeUnloadEvent)=>{if(busy||dirty)e.preventDefault();};
    window.addEventListener('ls:before-navigate',guard);window.addEventListener('beforeunload',unload);
    return()=>{window.removeEventListener('ls:before-navigate',guard);window.removeEventListener('beforeunload',unload);};
  },[editingPerson,person,busy]);
  const canContacts=hasCapability(data,user,event.id,'contacts',candidate?.departmentId);
  const canEditContacts=isAdmin(user,data)||Boolean(person&&data.candidates.some(c=>c.personId===person.id&&hasCapability(data,user,c.eventId,'contacts',c.departmentId)));
  const canAccess=hasCapability(data,user,event.id,'manageAccess',candidate?.departmentId);
  const canWork=canEdit&&online&&!busy&&hasCapability(data,user,event.id,'edit',candidate?.departmentId);
  const allowedDepartments=data.departments.filter(d=>hasCapability(data,user,event.id,'edit',d.id));
  const canAddContacts=hasCapability(data,user,event.id,'contacts',departmentId);
  const homeIds=homeIntent?.filter?new Set(attentionIds(data,event.id,homeIntent)):null;
  const view=useMemo(()=>teamView({...data,candidates:data.candidates.filter(c=>{const p=data.persons.find(p=>p.id===c.personId);return (!homeIntent||homeIntent.departmentIds.includes(c.departmentId))&&(!homeIds||homeIds.has(c.id))&&p&&profileMatches(data,p,profileFilters,authorizedIds.has(p.id));})},event.id,departmentFilter,search),[data,event.id,departmentFilter,search,profileFilters,user,homeIntent]);
  const visible=sortTeamGroups(data,groupPeople(view.operational.filter(c=>matchesTeamFilter(c,filter))));
  const counts=view.counts;
  function closeDetail(){if(busy)return;if(editingPerson&&person&&JSON.stringify(editingPerson)!==JSON.stringify(person)&&!window.confirm('¿Descartar los cambios de la ficha?'))return;setSelectedId(null);setEditingPerson(null);setError('');requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(`button[data-team-candidate="${CSS.escape(detailOpener.current)}"]`)?.focus());}
  function closeAdd(){if(busy)return;if(mode==='new'&&(newPerson.name||newPerson.email||newPerson.phone)&&!window.confirm('¿Cerrar la propuesta? Los datos escritos se conservarán mientras estés en Equipo.'))return;setAdding(false);setError('');}
  function openDetail(c:Candidate){if(!selectedId){detailOpener.current=c.id;setDetailTab(homeIntent?.filter==='committee'||homeIntent?.filter==='availability'?'team':'data');}setSelectedId(c.id);setGmail(data.persons.find(p=>p.id===c.personId)?.gmail||'');setEditingPerson(null);setError('');}
  async function save(next:AppData,description:string){setBusy(true);setError('');try{await onChange(next,description);return true;}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');return false;}finally{setBusy(false);}}
  async function updateCandidate(patch:Partial<Candidate>,description:string){if(!candidate||!canWork)return;await save({...data,candidates:data.candidates.map(c=>c.id===candidate.id?{...c,...patch}:c)},description);}
  function prepareMail(){if(!candidate||!canContacts)return;setComposeId(candidate.id);setSelectedId(null);setEditingPerson(null);setError('');}
  async function setCommittee(value:'approved'|'denied') {
    if(!candidate||!canWork)return;
    if(value==='denied'&&data.shifts.some(s=>s.personId===candidate.personId&&s.eventId===event.id&&s.departmentId===candidate.departmentId&&s.status==='published'&&s.attendance!=='replaced')){setError('Esta persona tiene turnos publicados. Sustitúyelos antes de retirar la aprobación.');return;}
    if(value==='denied'&&!window.confirm('¿Registrar que el comité no aprueba esta propuesta? Se retirará su acceso a este departamento.'))return;
    const next={...data,candidates:data.candidates.map(c=>c.id===candidate.id?{...c,committee:value,...(value==='denied'?{availability:'unknown' as const,access:'none' as const}:{})}:c),grants:value==='denied'?data.grants.map(g=>g.personId===candidate.personId&&g.eventId===event.id&&g.departmentId===candidate.departmentId?{...g,active:false}:g):data.grants};
    await save(next,value==='approved'?'Registró aprobación del comité':'Registró propuesta no aprobada');
  }
  async function grantAccess(){
    if(!candidate||!person||!canAccess||!canEditContacts||!canWork)return;
    if(candidate.committee!=='approved'||candidate.availability!=='accepted'){setError('Primero registra aprobación y aceptación.');return;}
    const email=gmail.trim().toLowerCase();
    if(!isGmail(email)){setError('Introduce una dirección de Gmail válida.');return;}
    if(data.grants.some(g=>g.email.toLowerCase()===email&&g.personId!==person.id)){setError('Este Gmail ya está vinculado a otra persona. Revisa la dirección.');return;}
    const existing=data.grants.find(g=>g.email.toLowerCase()===email&&g.personId===person.id&&g.eventId===event.id&&g.departmentId===candidate.departmentId);
    const grant:Grant=existing?{...existing,active:true}:{id:crypto.randomUUID(),email,personId:person.id,eventId:event.id,departmentId:candidate.departmentId,role:'volunteer',capabilities:['view'],active:true};
    const next={...data,persons:data.persons.map(p=>p.id===person.id?{...p,gmail:email}:p),grants:existing?data.grants.map(g=>g.id===grant.id?grant:g):[...data.grants,grant],candidates:data.candidates.map(c=>c.id===candidate.id?{...c,access:existing?.uid?'active' as const:'invited' as const}:c)};
    await save(next,'Autorizó acceso del voluntario');
  }
  async function savePerson(){
    if(!editingPerson||!canEditContacts||!canWork)return;
    if(personFingerprint(person)!==editingBaseline.current){setError('La ficha ha cambiado. Cierra y vuelve a abrirla antes de guardar.');return;}
    if(!editingPerson.name.trim()||editingPerson.appointment!=='circuit-overseer'&&!editingPerson.congregationId){setError('Completa nombre y congregación.');return;}
    if(editingPerson.email&&!isEmail(editingPerson.email)){setError('Revisa el correo de contacto.');return;}
    if(await save({...data,persons:data.persons.map(p=>p.id===editingPerson.id?{...editingPerson,name:editingPerson.name.trim(),aliases:[...new Set((editingPerson.aliases||[]).map(a=>a.trim()).filter(Boolean))],email:editingPerson.email.trim()}:p)},'Actualizó una ficha de contacto'))setEditingPerson(null);
  }
  async function addCandidate(){
    if(!canWork)return;
    if(mode==='new'&&!canAddContacts){setError('Crear una ficha requiere permiso de contactos en este departamento.');return;}
    if(!departmentId||!allowedDepartments.some(d=>d.id===departmentId)){setError('Elige un departamento autorizado.');return;}
    const p:Person|undefined=mode==='existing'?data.persons.find(p=>p.id===existingPersonId):{id:crypto.randomUUID(),...newPerson,name:newPerson.name.trim(),email:canAddContacts?newPerson.email.trim():'',phone:canAddContacts?newPerson.phone:'',notes:''};
    if(!p?.name||p.appointment!=='circuit-overseer'&&!p.congregationId){setError('Elige una persona o completa nombre y congregación.');return;}
    if(p.email&&!isEmail(p.email)){setError('Revisa el correo de contacto.');return;}
    if(data.candidates.some(c=>c.eventId===event.id&&c.personId===p.id&&c.departmentId===departmentId)){setError('Esta persona ya está propuesta en este departamento.');return;}
    const proposed:Candidate={id:crypto.randomUUID(),eventId:event.id,personId:p.id,departmentId,committee:'proposed',availability:'unknown',access:'none',reserve:false};
    if(await save({...data,persons:mode==='new'?[...data.persons,p]:data.persons,candidates:[...data.candidates,proposed]},'Propuso un voluntario')){setAdding(false);setExistingPersonId('');setNewPerson({...newPerson,name:'',phone:'',email:'',gmail:'',notes:'',hearingStatus:'unknown',appointment:undefined,regularPioneer:undefined,serviceCircuit:undefined});}
  }
  function renderCard(group:ReturnType<typeof groupPeople>[number],supervisor=false) {
    const p=data.persons.find(p=>p.id===group.personId);
    const congregation=data.congregations.find(g=>g.id===p?.congregationId);
    return <article className="team-person-card" key={group.personId}>
      <div className="team-person-top"><div className="team-avatar" aria-hidden="true">{p?.name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('')||'?'}</div><div className="team-person-title"><PersonName as="h2" personId={group.personId} name={p?.name||'Persona no disponible'}/><p>{p?affiliationLabel(data,p,canReadProfile(data,user,p.id)):'Sin indicar'}</p></div>{group.candidates.some(c=>c.reserve)&&<span className="team-reserve"><Star size={15}/>Reserva</span>}</div>
      {group.candidates.map(c=>{
        const department=data.departments.find(d=>d.id===c.departmentId);

        return <div key={c.id} className="team-participation"><div className="team-person-department"><strong><DepartmentIcon department={department} size={20}/>{department?.name||'Departamento'}</strong><span>{teamRoleLabels[teamRole(c)]}</span></div>
          {!supervisor&&<div className="team-status-pair"><div><span>Comité</span><Status state={c.committee==='approved'?'good':c.committee==='denied'?'bad':c.committee==='pending'?'pending':'neutral'} label={committeeLabels[c.committee]}/></div><div><span>Voluntario</span><Status state={c.availability==='accepted'?'good':c.availability==='declined'?'bad':c.availability==='invited'?'pending':'neutral'} label={availabilityLabels[c.availability]}/></div></div>}
          <button className="team-person-action" aria-label={`Ver ficha de ${p?.name||'persona'}${group.candidates.length>1?` · ${department?.name}`:''}`} data-team-candidate={c.id} onClick={()=>openDetail(c)}>Ver ficha<ChevronRight size={20}/></button>
        </div>;
      })}
    </article>;
  }
  const committeeState=candidate?.committee==='approved'?'good':candidate?.committee==='denied'?'bad':candidate?.committee==='pending'?'pending':'neutral';

  return <section className="team-panel" aria-labelledby="team-heading"><HomeFocus intent={homeIntent} onClear={()=>setHomeIntent(undefined)}/>
    <div className="team-page-heading"><div><h1 id="team-heading">{directory?'Directorio':'Equipo'} <span>{directory?data.persons.length:counts.all}</span></h1></div>{!directory&&canEdit&&allowedDepartments.length>0&&<button className="team-button team-button-primary" disabled={!online} onClick={()=>{if(!allowedDepartments.some(d=>d.id===departmentId))setDepartmentId(allowedDepartments[0].id);setAdding(true);setError('');}}><UserPlus size={21}/>Proponer</button>}</div>
    <div className="team-view-switch" role="group" aria-label="Vista de personas"><button className="team-button" aria-pressed={!directory} onClick={()=>setDirectory(false)}><Users size={20} aria-hidden="true"/>Equipo del evento</button><button className="team-button" aria-pressed={directory} onClick={()=>setDirectory(true)}><BookUser size={20} aria-hidden="true"/>Directorio</button></div>
    {directory?<DirectoryPanel {...props}/>:<>
    <div className="team-primary-filters"><label className="team-search"><Search size={21}/><input aria-label="Buscar persona o congregación" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre o congregación"/></label><label className="team-department-filter team-field">Departamento del equipo<select autoComplete="off" name="team-department-filter" value={departmentFilter} onChange={e=>{setHomeIntent(undefined);setDepartmentFilter(e.target.value);}}><option value="">Todos los departamentos</option>{data.departments.filter(d=>candidates.some(c=>c.departmentId===d.id)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
    <Filters active={[
      ...(filter!=='all'?[{label:({committee:'Por aprobar',availability:'Respuesta',ready:'Aceptados',reserve:'Reservas'} as const)[filter],clear:()=>setFilter('all')}]:[]),
      ...serviceFilterChips(profileFilters,setProfileFilters),
      ...(profileFilters.congregationId?[{label:data.congregations.find(c=>c.id===profileFilters.congregationId)?.name||'Congregación',clear:()=>setProfileFilters({...profileFilters,congregationId:''})}]:[]),
      ...(profileFilters.hearingStatus?[{label:profileFilters.hearingStatus==='deaf'?'Sorda':profileFilters.hearingStatus==='hearing'?'Oyente':'Sin indicar',clear:()=>setProfileFilters({...profileFilters,hearingStatus:''})}]:[])
    ]} onClear={()=>{setHomeIntent(undefined);setFilter('all');setProfileFilters({...emptyProfileFilters});}}>
    <div className="team-filters" aria-label="Filtrar equipo">{([['all','Todos',Users],['committee','Por aprobar',ShieldCheck],['availability','Respuesta',Mail],['ready','Aceptados',UserCheck],['reserve','Reservas',Star]] as const).map(([key,label,Icon])=><button key={key} className={filter===key?'selected':''} aria-pressed={filter===key} onClick={()=>{setHomeIntent(undefined);setFilter(key);}}><Icon size={18}/>{label}<span>{counts[key]}</span></button>)}</div><ProfileFilters data={data} value={profileFilters} onChange={setProfileFilters} canFilterPrivate={authorizedIds.size>0}/></Filters>
    <ProfileSummary people={visible.map(group=>data.persons.find(p=>p.id===group.personId)!).filter(Boolean)} authorizedIds={authorizedIds} label="Equipo"/>

    {!online&&<p className="team-feedback warning"><Clock3 size={20}/>Sin conexión · solo consulta</p>}
    <div className="team-person-list">{visible.map(group=>renderCard(group))}</div>
    {view.supervisors.length>0&&<section className="team-supervision" aria-labelledby="supervision-heading"><h2 id="supervision-heading"><ShieldCheck size={24} aria-hidden="true"/>Supervisión</h2><ProfileSummary people={view.supervisors.map(group=>data.persons.find(p=>p.id===group.personId)!).filter(Boolean)} authorizedIds={authorizedIds} label="Supervisión"/><div className="team-person-list">{view.supervisors.map(group=>renderCard(group,true))}</div></section>}
    {visible.length===0&&<div className="team-empty"><Users size={42}/><h2>{search?'No encontramos coincidencias':'Sin personas en esta lista'}</h2><p>{search?'Prueba con otro nombre.':'Las propuestas aparecerán aquí.'}</p>{search&&<button className="team-button" onClick={()=>setSearch('')}>Limpiar búsqueda</button>}</div>}
    </>}
    {candidate&&person&&<Dialog title={person.name} titleAction={<PersonContactActions personId={person.id} name={person.name} departmentId={candidate.departmentId}/>} eyebrow={data.departments.find(d=>d.id===candidate.departmentId)?.name} onClose={closeDetail} footer={<button className="team-button" onClick={closeDetail}><ArrowLeft size={19}/>Volver</button>}>
      {candidates.filter(c=>c.personId===person.id).length>1&&<label className="team-field">Departamento de esta ficha<select autoComplete="off" name="team-detail-department" value={candidate.id} disabled={busy||Boolean(editingPerson)} onChange={e=>{const c=candidates.find(c=>c.id===e.target.value);if(c)openDetail(c);}}>{candidates.filter(c=>c.personId===person.id).map(c=><option key={c.id} value={c.id}>{data.departments.find(d=>d.id===c.departmentId)?.name}</option>)}</select></label>}
      <SectionTabs id="person-detail" label="Secciones de la ficha" value={detailTab} disabled={busy} onChange={setDetailTab} items={[{value:'data',label:'Datos',icon:<ContactRound size={20} aria-hidden="true"/>},{value:'team',label:'Equipo',icon:<Users size={20} aria-hidden="true"/>},{value:'access',label:'Acceso',icon:<ShieldCheck size={20} aria-hidden="true"/>}]}/>
      <div className="person-detail-tab" role="tabpanel" id="person-detail-panel-data" aria-labelledby="person-detail-tab-data" tabIndex={0} hidden={detailTab!=='data'}>
      {props.onShowHistory&&<button className="team-button" onClick={()=>props.onShowHistory?.(person.id)}><History size={20} aria-hidden="true"/>Ver trayectoria</button>}
      <section className="team-detail-section"><div className="team-section-title"><ContactRound size={22}/><h3>Datos personales</h3>{canEditContacts&&canEdit&&!editingPerson&&<button className="team-copy-button" disabled={!online} onClick={()=>{editingBaseline.current=personFingerprint(person);setEditingPerson({...person});}}><Pencil size={17}/>Editar</button>}</div>
        {editingPerson?<><HearingField value={editingPerson.hearingStatus} onChange={hearingStatus=>setEditingPerson({...editingPerson,hearingStatus})}/><ServiceFields value={editingPerson} disabled={!canEditService(data,user,editingPerson.id)} onChange={patch=>setEditingPerson({...editingPerson,...patch})}/><label className="team-field">Nombre<input value={editingPerson.name} onChange={e=>setEditingPerson({...editingPerson,name:e.target.value})} autoComplete="name"/></label><AffiliationFields data={data} person={editingPerson} disabled={!canEditService(data,user,editingPerson.id)} onChange={patch=>setEditingPerson({...editingPerson,...patch})}/><div className="team-field-grid"><label className="team-field">Teléfono<input type="tel" autoComplete="tel" placeholder="+34 600 123 456" value={editingPerson.phone} onChange={e=>setEditingPerson({...editingPerson,phone:e.target.value})}/></label><label className="team-field">Correo de contacto<input type="email" autoComplete="email" value={editingPerson.email} onChange={e=>setEditingPerson({...editingPerson,email:e.target.value})}/></label></div><label className="team-field">Correo para avisos<input type="email" maxLength={254} value={editingPerson.notificationEmail||''} placeholder={editingPerson.gmail||editingPerson.email||'nombre@gmail.com'} onChange={e=>setEditingPerson({...editingPerson,notificationEmail:e.target.value.trim()})}/></label><label className="team-field">Otros nombres (uno por línea)<textarea name="person-aliases" autoComplete="off" rows={2} value={(editingPerson.aliases||[]).join('\n')} onChange={e=>setEditingPerson({...editingPerson,aliases:e.target.value.split('\n')})}/></label><label className="team-field">Notas privadas<textarea rows={3} value={editingPerson.notes} onChange={e=>setEditingPerson({...editingPerson,notes:e.target.value})}/></label><div className="team-action-row"><button className="team-button" onClick={()=>setEditingPerson(null)}>Cancelar</button><button className="team-button team-button-primary" disabled={!canWork} onClick={savePerson}><Check size={19}/>Guardar ficha</button></div></>:<dl className="team-contact-list"><div><dt>Congregación</dt><dd>{congregation?.name||'Sin indicar'}</dd></div>{Boolean(person.aliases?.length)&&<div><dt>Otros nombres</dt><dd>{person.aliases?.join(', ')}</dd></div>}{canContacts&&<><div><dt>Teléfono</dt><dd>{person.phone?<a href={`tel:${person.phone.replace(/[^+\d]/g,'')}`}>{person.phone}</a>:'Sin indicar'}</dd></div><div><dt>Correo</dt><dd>{person.email?<a href={`mailto:${person.email}`}>{person.email}</a>:'Sin indicar'}</dd></div>{person.notes&&<div><dt>Notas privadas</dt><dd>{person.notes}</dd></div>}</>}</dl>}
      </section>
      {!editingPerson&&canContacts&&<ServiceDetails person={person}/>}
      </div>
      <div className="person-detail-tab" role="tabpanel" id="person-detail-panel-team" aria-labelledby="person-detail-tab-team" tabIndex={0} hidden={detailTab!=='team'}>
      <label className="team-field">Cargo en este departamento<select autoComplete="off" name="team-role" value={teamRole(candidate)} disabled={!canWork} onChange={e=>void updateCandidate({teamRole:e.target.value as Candidate['teamRole']},'Actualizó el cargo en el departamento')}>{Object.entries(teamRoleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small>Los permisos se gestionan en Más → Permisos.</small></label>
      {teamRole(candidate)!=='supervisor'&&<>
      <div className="team-progress" aria-label="Proceso de incorporación">{[['Propuesta',true],['Comité',candidate.committee==='approved'],['Aceptación',candidate.availability==='accepted'],['Acceso',candidate.access!=='none']].map(([label,done])=><div key={String(label)} className={done?'done':''}>{done?<Check size={17}/>:<span className="team-progress-dot"/>}<span>{label}</span></div>)}</div>
      <section className="team-detail-section"><div className="team-section-title"><ShieldCheck size={22}/><h3>Aprobación del comité</h3><Status state={committeeState} label={committeeLabels[candidate.committee]}/></div>
        {canEdit&&<div className="team-action-row">{candidate.committee==='proposed'&&<button className="team-button team-button-primary" disabled={!canWork||!canContacts} onClick={prepareMail}><Mail size={19}/>Preparar correo</button>}{['pending','proposed'].includes(candidate.committee)&&<><button className="team-button" disabled={!canWork} onClick={()=>setCommittee('approved')}><Check size={19}/>Aprobado</button><button className="team-button" disabled={!canWork} onClick={()=>setCommittee('denied')}><X size={19}/>No aprobado</button></>}{candidate.committee==='denied'&&<button className="team-button" disabled={!canWork} onClick={()=>updateCandidate({committee:'proposed'},'Reabrió una propuesta')}>Reabrir propuesta</button>}</div>}
      </section>
      <section className="team-detail-section"><div className="team-section-title"><UserCheck size={22}/><h3>Voluntario</h3><Status state={candidate.availability==='accepted'?'good':candidate.availability==='declined'?'bad':candidate.availability==='invited'?'pending':'neutral'} label={availabilityLabels[candidate.availability]}/></div>
        {canEdit&&candidate.committee==='approved'&&<div className="team-action-row">{candidate.availability==='unknown'&&<button className="team-button team-button-primary" disabled={!canWork||!canContacts} onClick={prepareMail}><Mail size={19}/>Consultar disponibilidad</button>}{['unknown','invited'].includes(candidate.availability)&&<><button className="team-button" disabled={!canWork} onClick={()=>updateCandidate({availability:'accepted'},'Registró aceptación del voluntario')}><Check size={19}/>Acepta</button><button className="team-button" disabled={!canWork} onClick={()=>updateCandidate({availability:'declined'},'Registró indisponibilidad del voluntario')}><X size={19}/>No disponible</button></>}{candidate.availability==='declined'&&<button className="team-button" disabled={!canWork} onClick={()=>updateCandidate({availability:'unknown'},'Volvió a consultar disponibilidad')}>Volver a consultar</button>}</div>}
        <label className="team-check"><input type="checkbox" checked={candidate.reserve} disabled={!canWork} onChange={e=>updateCandidate({reserve:e.target.checked},e.target.checked?'Marcó una reserva':'Retiró marca de reserva')}/><Star size={18}/>Disponible como reserva</label>
      </section>
      </>}
      {data.communications.some(c=>c.personId===person.id&&c.eventId===event.id)&&<section className="team-detail-section"><div className="team-section-title"><Mail size={22}/><h3>Correos registrados</h3></div><ul className="team-mail-log">{data.communications.filter(c=>c.personId===person.id&&c.eventId===event.id).slice().reverse().map(c=><li key={c.id}><CheckCheck size={18}/><div><strong>{c.subject}</strong><time dateTime={c.sentAt}>{new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short',timeZone:event.timezone}).format(new Date(c.sentAt))}</time></div></li>)}</ul></section>}
      </div>
      <div className="person-detail-tab" role="tabpanel" id="person-detail-panel-access" aria-labelledby="person-detail-tab-access" tabIndex={0} hidden={detailTab!=='access'}>
      <section className="team-detail-section"><div className="team-section-title"><CircleUserRound size={22}/><h3>Acceso a la aplicación</h3><Status state={candidate.access==='active'?'good':candidate.access==='invited'?'pending':'neutral'} label={candidate.access==='active'?'Activo':candidate.access==='invited'?'Autorizado':'Sin acceso'}/></div>
        {teamRole(candidate)!=='supervisor'&&candidate.committee==='approved'&&candidate.availability==='accepted'&&canAccess&&<><label className="team-field">Cuenta de Gmail<input type="email" value={gmail} onChange={e=>setGmail(e.target.value)} placeholder="nombre@gmail.com" autoComplete="email" disabled={!online||busy||!canEditContacts||candidate.access!=='none'}/></label>{candidate.access==='none'&&<button className="team-button team-button-primary" disabled={!canWork||!canEditContacts} onClick={grantAccess}><UserPlus size={20}/>Dar acceso</button>}{candidate.access==='invited'&&<p className="team-small">Podrá entrar con Google usando esta dirección.</p>}</>}
        {teamRole(candidate)!=='supervisor'&&!(candidate.committee==='approved'&&candidate.availability==='accepted')&&<p className="team-small">Se habilita tras aprobación y aceptación.</p>}
      {teamRole(candidate)==='supervisor'&&<p className="team-small">Los permisos se gestionan en Más → Permisos.</p>}</section></div>
      {error&&<p className="team-feedback error" role="alert"><TriangleAlert size={20}/>{error}</p>}
    </Dialog>}
    {adding&&<Dialog title="Proponer persona" eyebrow="Equipo" onClose={closeAdd} footer={<><button className="team-button" onClick={closeAdd}>Cancelar</button><button className="team-button team-button-primary" disabled={!canWork} onClick={addCandidate}><Plus size={20}/>{busy?'Guardando…':'Añadir propuesta'}</button></>}>
      <div className="team-segment"><button aria-pressed={mode==='existing'} onClick={()=>setMode('existing')} className={mode==='existing'?'selected':''}><Users size={19}/>Del directorio</button><button aria-pressed={mode==='new'} disabled={!canAddContacts} onClick={()=>setMode('new')} className={mode==='new'?'selected':''}><UserPlus size={19}/>Nueva persona</button></div>
      {mode==='existing'?<label className="team-field">Persona<select value={existingPersonId} onChange={e=>setExistingPersonId(e.target.value)}><option value="">Seleccionar persona</option>{data.persons.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(p=><option value={p.id} key={p.id}>{p.name} · {data.congregations.find(c=>c.id===p.congregationId)?.name}</option>)}</select></label>:<><HearingField value={newPerson.hearingStatus} onChange={hearingStatus=>setNewPerson({...newPerson,hearingStatus})}/><ServiceFields value={newPerson} onChange={patch=>setNewPerson({...newPerson,...patch})}/><label className="team-field">Nombre completo<input autoComplete="name" value={newPerson.name} onChange={e=>setNewPerson({...newPerson,name:e.target.value})}/></label><AffiliationFields data={data} person={newPerson} onChange={patch=>setNewPerson({...newPerson,...patch})}/><label className="team-field">Correo de contacto<input type="email" autoComplete="email" disabled={!canAddContacts||!online} value={newPerson.email} onChange={e=>setNewPerson({...newPerson,email:e.target.value})}/></label><label className="team-field">Teléfono<input type="tel" autoComplete="tel" disabled={!canAddContacts||!online} value={newPerson.phone} onChange={e=>setNewPerson({...newPerson,phone:e.target.value})}/></label></>}
      <label className="team-field">Departamento<select value={departmentId} onChange={e=>setDepartmentId(e.target.value)}>{allowedDepartments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      {error&&<p className="team-feedback error" role="alert"><TriangleAlert size={20}/>{error}</p>}
    </Dialog>}
    {composeId&&<Correspondence data={data} event={event} user={user} onChange={onChange} candidate={data.candidates.find(c=>c.id===composeId)} onClose={()=>setComposeId(null)} online={online} canEdit={canEdit}/>}
  </section>;
}
