import type {ReactNode} from 'react';
import {useViewState} from './ViewState';
import HomeFocus from './HomeFocus';
import {attentionIds,type HomeIntent} from '../domain/homeDashboard';
import {UpcomingMeetings} from './MeetingsPanel';
import { useRef,useState } from 'react';
import { Plus, Sunrise, Sun, Clock3, Pencil, MapPin, List, LayoutGrid } from 'lucide-react';
import type { PanelProps, Shift } from '../domain/types';
import { can } from '../domain/rules';
import { dateLabel, timeLabel, toLocalInput } from '../domain/format';
import { DepartmentIcon, Empty, Status } from './UI';
import { publicationTeam, teamRole, teamRoleLabels } from '../domain/team';
import { compareShiftPosts } from '../domain/shiftPosts';
import { ShiftPost } from './ShiftPost';
import ShiftEditor from './ShiftEditor';
import {AttendanceControl} from './AttendanceControl';
import {attendanceState,type EditableAttendance} from '../domain/attendance';
import '../styles/shifts.css';
import {PersonName} from './PersonContact';

/** A repeated majority can be shared; ties keep their details on each card. */
function sharedShift(shifts:Shift[],key:(shift:Shift)=>string):Shift|undefined {
  const counts=new Map<string,{shift:Shift;count:number}>();
  for(const shift of shifts){const value=key(shift),entry=counts.get(value);counts.set(value,{shift,count:(entry?.count??0)+1});}
  return [...counts.values()].find(entry=>entry.count>1&&entry.count>shifts.length/2)?.shift;
}
interface ShiftContext {time?:Shift;point?:string;timeId:string;pointId:string}

export default function ShiftsPanel(props: PanelProps & {initialIntent?:HomeIntent;publishAction?:ReactNode}) {
  const { data, event, user, onChange, online } = props;
  const [day, setDay] = useViewState('shifts.day',event.startDate,'dia');
  const [department, setDepartment] = useViewState('shifts.department',props.initialIntent?.departmentIds.length===1?props.initialIntent.departmentIds[0]:'all','departamento');
  const [homeIntent,setHomeIntent]=useState(props.initialIntent);
  const focusedIds=homeIntent?.filter?new Set(attentionIds(data,event.id,homeIntent)):null;
  const [list, setList] = useViewState('shifts.list',false);
  const [editing, setEditing] = useState<Shift | 'new' | null>(null);
  const [attendanceBusy,setAttendanceBusy]=useState<string|null>(null);
  const attendanceLock=useRef(false);
  const [attendanceError,setAttendanceError]=useState<{shiftId:string;message:string}|null>(null);
  const departmentOrder:Record<string,number>={video:0,platform:1,makeup:2};
  const compareText=new Intl.Collator('es',{numeric:true,sensitivity:'base'}).compare;
  const people=new Map(data.persons.map(person=>[person.id,person]));
  const publishedView=!data.grants.length;
  const team=publishedView
    ? data.publications.filter(p=>p.eventId===event.id).flatMap(p=>publicationTeam(p).map(member=>({...member,departmentId:p.departmentId})))
    : data.candidates.filter(c=>c.eventId===event.id).map(c=>({personId:c.personId,departmentId:c.departmentId,role:teamRole(c),name:people.get(c.personId)?.name}));
  const memberFor=(personId:string,departmentId:string)=>team.find(m=>m.personId===personId&&m.departmentId===departmentId);
  const personName=(personId:string,departmentId:string)=>memberFor(personId,departmentId)?.name??people.get(personId)?.name;
  const publishedDepartments=new Set(data.publications.filter(p=>p.eventId===event.id).map(p=>p.departmentId));
  // Published/offline views contain only authorized publications and omit grants.
  const departments = data.departments.filter(d => can(user, data, 'view', event.id, d.id)||publishedView&&publishedDepartments.has(d.id)).sort((a,b)=>(departmentOrder[a.id]??3)-(departmentOrder[b.id]??3)||compareText(a.name,b.name));
  const editableDepartments = departments.filter(d => can(user, data, 'assign', event.id, d.id));
  const dutyFor=(shift:Shift)=>memberFor(shift.personId,shift.departmentId)?.role;
  const shifts = data.shifts.filter(s => s.eventId === event.id && departments.some(d=>d.id===s.departmentId) && (!homeIntent||homeIntent.departmentIds.includes(s.departmentId)) && (focusedIds?focusedIds.has(s.id):toLocalInput(s.startsAt, event.timezone).startsWith(day)) && (department === 'all' || s.departmentId === department))
    .sort(compareShiftPosts);
  const groups=departments.flatMap(dep=>{
    const dates=focusedIds?[...new Set(shifts.filter(s=>s.departmentId===dep.id).map(s=>toLocalInput(s.startsAt,event.timezone).slice(0,10)))].sort():[day];
    return dates.map(groupDay=>{
    const groupId=`${dep.id}-${groupDay}`;
    const entries=shifts.filter(s=>s.departmentId===dep.id&&toLocalInput(s.startsAt,event.timezone).startsWith(groupDay));
    const leadership=(['responsible','assistant'] as const).map(role=>({role,people:[...new Map(team.filter(m=>m.departmentId===dep.id&&m.role===role&&m.name).map(m=>[m.personId,{id:m.personId,name:m.name!}])).values()].sort((a,b)=>compareText(a.name,b.name))})).filter(group=>group.people.length);
    const point=sharedShift(entries,s=>s.meetingPoint.trim())?.meetingPoint.trim();
    const pointId=`shift-point-${groupId}`;
    const sessions=([false,true] as const).map(afternoon=>{
      const sessionShifts=entries.filter(s=>(Number(toLocalInput(s.startsAt,event.timezone).slice(11,13))>=13)===afternoon);
      return {afternoon,shifts:sessionShifts,time:sharedShift(sessionShifts,s=>`${s.startsAt}/${s.endsAt}`),
        point:point??sharedShift(sessionShifts,s=>s.meetingPoint.trim())?.meetingPoint.trim(),
        timeId:`shift-time-${groupId}-${afternoon?'afternoon':'morning'}`,pointId:point!==undefined?pointId:`${pointId}-${afternoon?'afternoon':'morning'}`};
    }).filter(session=>session.shifts.length);
    return {id:groupId,day:groupDay,department:dep,count:entries.length,leadership,point,pointId,sessions};
    });
  }).filter(group=>group.count);
  const changeAttendance = async (shift: Shift,attendance:EditableAttendance) => {
    if(!online||attendanceLock.current||shift.attendance==='replaced'||attendanceState(shift.attendance)===attendance||!can(user,data,'assign',event.id,shift.departmentId))return;
    attendanceLock.current=true;setAttendanceBusy(shift.id);setAttendanceError(null);
    try { const next = structuredClone(data); next.shifts = next.shifts.map(s => s.id === shift.id ? { ...s, attendance } : s); await onChange(next, `${attendance==='planned'?'Asistencia desmarcada':attendance==='absent'?'Ausencia registrada':'Presencia registrada'}: ${data.persons.find(p => p.id === shift.personId)?.name ?? ''}`); } catch (e) { setAttendanceError({shiftId:shift.id,message:(e as Error).message}); } finally{attendanceLock.current=false;setAttendanceBusy(null);}
  };
  const render = (shift: Shift,context:ShiftContext) => {
    const name = personName(shift.personId,shift.departmentId);
    const duty=dutyFor(shift);
    const editable = online && can(user, data, 'assign', event.id, shift.departmentId);
    const sharedTime=context.time?.startsAt===shift.startsAt&&context.time.endsAt===shift.endsAt;
    const sharedPoint=context.point!==undefined&&context.point===shift.meetingPoint.trim();
    const description=[sharedTime?context.timeId:'',sharedPoint?context.pointId:''].filter(Boolean).join(' ');
    return <article className="shift-card" key={shift.id} aria-describedby={description||undefined}>
      <header><h4><ShiftPost departmentId={shift.departmentId} department={data.departments.find(d=>d.id===shift.departmentId)} role={shift.role}/></h4><Status kind={shift.status === 'published' ? 'good' : 'draft'}>{shift.status === 'published' ? 'Publicado' : 'Borrador'}</Status></header>
      {!sharedTime&&<div className="shift-card-detail"><span className="shift-detail-label"><Clock3 size={18} aria-hidden="true"/>{context.time?'Horario propio':'Horario'}</span><div className="shift-time">{timeLabel(shift.startsAt, event.timezone)} – {timeLabel(shift.endsAt, event.timezone)}</div></div>}
      <div className="person-line"><span className="avatar" aria-hidden="true">{name?.split(' ').map(w => w[0]).slice(0, 2).join('') ?? '?'}</span><div className="shift-person-copy"><PersonName as="strong" personId={shift.personId} name={name??'Persona no disponible'} departmentId={shift.departmentId}/>{duty&&<span className="shift-person-role">{teamRoleLabels[duty]}</span>}</div></div>
      {!sharedPoint&&<div className="shift-card-detail"><span className="shift-detail-label"><MapPin size={18} aria-hidden="true"/>{context.point!==undefined?'Otro encuentro':'Encuentro'}</span><div>{shift.meetingPoint.trim() || 'Sin punto de encuentro'}</div></div>}
      {shift.substituteIds.length > 0 && <div className="small shift-substitutes">Suplentes: {shift.substituteIds.map(id=><PersonName key={id} personId={id} name={personName(id,shift.departmentId)||'Persona no disponible'} departmentId={shift.departmentId}/>)}</div>}
      <AttendanceControl value={shift.attendance} editable={editable} saving={attendanceBusy===shift.id} disabled={!!attendanceBusy}
        error={attendanceError?.shiftId===shift.id?attendanceError.message:undefined} onSelect={attendance=>void changeAttendance(shift,attendance)}/>
      {editable&&shift.attendance!=='replaced'&&<div className="shift-edit-action no-print"><button className="btn" disabled={!!attendanceBusy} onClick={()=>setEditing(shift)}><Pencil size={18} aria-hidden="true"/>Editar</button></div>}
    </article>;
  };
  return <>
    <HomeFocus intent={homeIntent} onClear={()=>setHomeIntent(undefined)}/>
    <div className="page-heading"><div><h1>Turnos</h1><p>{focusedIds?'Todos los días':dateLabel(day)}</p></div><div className="page-actions">{props.publishAction}{editableDepartments.length > 0 && <button className="btn btn-primary no-print" disabled={!online} onClick={() => setEditing('new')}><Plus size={20} />Añadir turno</button>}</div></div>
    <div className="toolbar shift-toolbar no-print"><div className="button-row"><label className="field"><span>Día</span><input aria-label="Día" name="shift-day" autoComplete="off" type="date" value={focusedIds?'':day} min={event.startDate} max={event.endDate} onChange={e => {setHomeIntent(undefined);setDay(e.target.value||event.startDate);}} /></label><label className="field"><span>Departamento</span><select aria-label="Departamento" name="shift-department" autoComplete="off" value={department} onChange={e => {setHomeIntent(undefined);setDepartment(e.target.value);}}><option value="all">Todos los departamentos</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div><button className="btn" aria-pressed={list} onClick={() => setList(!list)}>{list ? <LayoutGrid size={20} aria-hidden="true" /> : <List size={20} aria-hidden="true" />}{list ? 'Por sesión' : 'Ver lista'}</button></div>
    {!shifts.length ? <Empty>{focusedIds?'No quedan turnos con este pendiente.':department==='all'?'No hay turnos para este día.':`No hay turnos de ${departments.find(d=>d.id===department)?.name||'este departamento'} para este día.`}</Empty> : <div className="shift-departments">{groups.map(group=><section className="shift-department" key={group.id} aria-labelledby={`shift-department-${group.id}`}>
      <header className="shift-department-heading"><div className="shift-department-icon"><DepartmentIcon department={group.department} size={28}/></div><h2 id={`shift-department-${group.id}`}>{group.department.name}{focusedIds&&<span className="small"> · {dateLabel(group.day)}</span>}</h2><span className="shift-department-count">{group.count} {group.count===1?'turno':'turnos'}</span></header>
      {(group.leadership.length>0||group.point!==undefined)&&<dl className="shift-department-summary">
        {group.leadership.map(lead=><div className="shift-summary-leader" key={lead.role}><dt>{lead.role==='responsible'?(lead.people.length===1?'Responsable':'Responsables'):(lead.people.length===1?'Auxiliar':'Auxiliares')}</dt><dd>{lead.people.map(person=><PersonName key={person.id} personId={person.id} name={person.name} departmentId={group.department.id}/>)}</dd></div>)}
        {group.point!==undefined&&<div className="shift-summary-place"><dt><MapPin size={18} aria-hidden="true"/>Encuentro general</dt><dd id={group.pointId}>{group.point||'Sin punto de encuentro'}</dd></div>}
      </dl>}
      <div className={`shift-department-sessions${list?' shift-department-list':''}`}>{group.sessions.map(session=><section className="shift-session" key={String(session.afternoon)} aria-labelledby={`shift-session-${group.id}-${session.afternoon?'afternoon':'morning'}`}>
        <header className="shift-session-heading"><h3 id={`shift-session-${group.id}-${session.afternoon?'afternoon':'morning'}`}>{session.afternoon?<Sun size={22} aria-hidden="true"/>:<Sunrise size={22} aria-hidden="true"/>}{session.afternoon?'Tarde':'Mañana'}</h3>
          {session.time&&<div className="shift-session-time" id={session.timeId}><Clock3 size={18} aria-hidden="true"/><span className="visually-hidden">Horario general de {session.afternoon?'tarde':'mañana'}: </span><span className="shift-time">{timeLabel(session.time.startsAt,event.timezone)} – {timeLabel(session.time.endsAt,event.timezone)}</span></div>}
          {group.point===undefined&&session.point!==undefined&&<div className="shift-session-point" id={session.pointId}><MapPin size={18} aria-hidden="true"/><span className="visually-hidden">Encuentro general: </span><span>{session.point||'Sin punto de encuentro'}</span></div>}
        </header>
        <UpcomingMeetings data={{...data,meetingPublications:(data.meetingPublications||[]).filter(m=>m.departmentIds.includes(group.department.id))}} event={event} user={user} orientationDate={group.day} session={session.afternoon?'afternoon':'morning'}/>
        <div className="shift-session-cards">{session.shifts.map(shift=>render(shift,session))}</div>
      </section>)}</div>
    </section>)}</div>}
    {editing && <ShiftEditor {...props} day={day} initialDepartmentId={department==='all'?undefined:department} shift={editing === 'new' ? undefined : editing} departments={editableDepartments.map(d => d.id)} onClose={() => setEditing(null)} />}
  </>;
}
