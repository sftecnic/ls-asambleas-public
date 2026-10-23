import Filters from './Filters';
import {useViewState} from './ViewState';
import {useEffect,useState} from 'react';
import {CalendarDays,History,MapPin,Search,UserRound,Users,X} from 'lucide-react';
import type {PanelProps} from '../domain/types';
import {eventPeriod,eventYear,historyChanges,historyEvents,historyScope,personExperience,type HistoryFilters} from '../domain/history';
import {teamRole,teamRoleLabels} from '../domain/team';
import {dateLabel,timeLabel,toLocalInput} from '../domain/format';
import {AttendanceSummary} from './AttendanceControl';
import {DepartmentIcon,Empty} from './UI';
import {ShiftPost} from './ShiftPost';
import '../styles/history.css';

const emptyFilters:HistoryFilters={year:'',eventId:'',departmentId:'',personId:'',query:''};
export default function HistoryPanel({data,user,initialPersonId=''}:Pick<PanelProps,'data'|'user'>&{initialPersonId?:string}){
  const [filters,setFilters]=useViewState<HistoryFilters>('history.filters',{...emptyFilters,personId:initialPersonId});
  const [view,setView]=useViewState<'services'|'changes'>('history.view','services'),[limit,setLimit]=useState(8);
  useEffect(()=>{if(initialPersonId){setView('services');setFilters({...emptyFilters,personId:initialPersonId});}},[initialPersonId]);
  useEffect(()=>setLimit(view==='services'?8:40),[filters,view]);
  const scope=historyScope(data,user),groups=historyEvents(data,user,filters),changes=historyChanges(data,user,filters);
  const peopleIds=new Set([...scope.shifts,...scope.candidates].map(row=>row.personId));
  const people=data.persons.filter(person=>peopleIds.has(person.id)||person.id===filters.personId).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const years=[...new Set([...scope.events.map(eventYear),...historyChanges(data,user,emptyFilters).map(row=>data.events.find(event=>event.id===row.eventId)?.startDate.slice(0,4)||row.at.slice(0,4))])].sort().reverse();
  const auditEvents=data.events.filter(event=>historyChanges(data,user,emptyFilters).some(change=>change.eventId===event.id));
  const selectableEvents=view==='changes'?auditEvents:scope.events;
  const visible=groups.slice(0,limit),visibleYears=[...new Set(visible.map(group=>group.year))];
  const set=(key:keyof HistoryFilters,value:string)=>setFilters(current=>({...current,[key]:value,...(key==='year'?{eventId:''}:{})}));
  const selectedPerson=data.persons.find(person=>person.id===filters.personId);
  const experience=selectedPerson?personExperience(data,user,selectedPerson.id):undefined;
  const actorName=(actor:string)=>{const grant=data.grants.find(g=>g.uid===actor||g.email===actor);return data.persons.find(p=>p.id===grant?.personId)?.name||grant?.email||actor;};
  const departments=data.departments.filter(department=>[...scope.shifts,...scope.candidates].some(row=>row.departmentId===department.id));
  return <div className="history-panel">
    <div className="history-view-switch" role="group" aria-label="Contenido del histórico">
      <button className="btn" aria-pressed={view==='services'} onClick={()=>{setView('services');set('query','');}}><Users size={20} aria-hidden="true"/>Participaciones</button>
      <button className="btn" aria-pressed={view==='changes'} onClick={()=>{setView('changes');setFilters(current=>({...current,query:'',departmentId:'',personId:''}));}}><History size={20} aria-hidden="true"/>Cambios</button>
    </div>
    <div className="history-filters no-print">
      <label className="field">Año<select name="history-year" autoComplete="off" value={filters.year} onChange={e=>set('year',e.target.value)}><option value="">Todos los años</option>{years.map(year=><option key={year}>{year}</option>)}</select></label>
      <label className="field">Evento<select name="history-event" autoComplete="off" value={filters.eventId} onChange={e=>set('eventId',e.target.value)}><option value="">Todos los eventos</option>{selectableEvents.filter(event=>!filters.year||eventYear(event)===filters.year).map(event=><option key={event.id} value={event.id}>{dateLabel(event.startDate)} · {event.title} · {data.venues.find(v=>v.id===event.venueId)?.city||'Sin sede'}</option>)}</select></label>
    </div><Filters label="Filtros del histórico" active={[
      ...(filters.year?[{label:filters.year,clear:()=>set('year','')}]:[]),
      ...(filters.eventId?[{label:data.events.find(e=>e.id===filters.eventId)?.title||'Evento',clear:()=>set('eventId','')}]:[]),
      ...(filters.departmentId?[{label:data.departments.find(d=>d.id===filters.departmentId)?.name||'Departamento',clear:()=>set('departmentId','')}]:[]),
      ...(filters.personId?[{label:selectedPerson?.name||'Persona',clear:()=>set('personId','')}]:[]),
      ...(filters.query?[{label:filters.query,clear:()=>set('query','')}]:[])
    ]} onClear={()=>setFilters(emptyFilters)}><div className="history-filters">
      {view==='services'&&<><label className="field">Departamento<select name="history-department" autoComplete="off" value={filters.departmentId} onChange={e=>set('departmentId',e.target.value)}><option value="">Todos los departamentos</option>{departments.map(department=><option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <label className="field">Persona<select name="history-person" autoComplete="off" value={filters.personId} onChange={e=>set('personId',e.target.value)}><option value="">Todas las personas</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label></>}
      <label className="field history-search"><span><Search size={18} aria-hidden="true"/>{view==='services'?'Nombre o puesto':'Buscar cambio'}</span><input type="search" name="history-search" autoComplete="off" value={filters.query} onChange={e=>set('query',e.target.value)}/></label>
      {Object.values(filters).some(Boolean)&&<button className="btn history-clear" onClick={()=>setFilters(emptyFilters)}><X size={18} aria-hidden="true"/>Limpiar filtros</button>}
    </div></Filters>
    {view==='services'&&selectedPerson&&experience&&<div className="history-person-summary"><UserRound size={28} aria-hidden="true"/><div><h3>{selectedPerson.name}</h3><p>{data.congregations.find(c=>c.id===selectedPerson.congregationId)?.name||'Congregación sin indicar'}</p><p>Trayectoria completa · {experience.assignedEvents} {experience.assignedEvents===1?'evento anterior':'eventos anteriores'} con turno · {experience.presentEvents} con presencia registrada</p></div></div>}
    {view==='services'?<>
      <p className="small history-results" role="status">{groups.length} {groups.length===1?'evento':'eventos'} · {new Set(groups.flatMap(group=>group.departments.flatMap(department=>department.people.map(person=>person.personId)))).size} personas</p>
      {visibleYears.map(year=><section className="history-year" key={year} aria-labelledby={`history-year-${year}`}><h3 id={`history-year-${year}`}>{year}</h3>{visible.filter(group=>group.year===year).map(group=>{
        const venue=data.venues.find(venue=>venue.id===group.event.venueId);
        return <section className="history-event" key={group.event.id} aria-labelledby={`history-event-${group.event.id}`}>
          <header className="history-event-heading"><div><h4 id={`history-event-${group.event.id}`}>{group.event.title}</h4><p><CalendarDays size={18} aria-hidden="true"/>{dateLabel(group.event.startDate)}{group.event.endDate!==group.event.startDate?`–${dateLabel(group.event.endDate)}`:''}</p>{venue&&<p><MapPin size={18} aria-hidden="true"/>{venue.name} · {venue.city}</p>}</div><span className="history-period">{eventPeriod(group.event)}{group.event.archived?' · Archivado':''}</span></header>
          {group.departments.map(department=><section className="history-department" key={department.id}><h5><DepartmentIcon department={data.departments.find(d=>d.id===department.id)} size={22}/>{data.departments.find(d=>d.id===department.id)?.name||'Departamento no disponible'}</h5>
            {department.people.map(person=><article className="history-person" key={person.personId}><div className="history-person-heading"><h6>{person.person?.name||'Persona no disponible'}</h6>{!filters.personId&&<button className="btn btn-ghost no-print" aria-label={`Ver trayectoria de ${person.person?.name||'esta persona'}`} onClick={()=>setFilters({...emptyFilters,personId:person.personId})}><UserRound size={18} aria-hidden="true"/>Ver trayectoria</button>}</div>
              {person.candidates.length>0&&<p className="small">{[...new Set(person.candidates.map(candidate=>teamRoleLabels[teamRole(candidate)]))].join(' · ')}{person.candidates.some(candidate=>candidate.reserve)?' · Reserva':''}</p>}
              {person.shifts.map(shift=><div className="history-assignment" key={shift.id}><div><ShiftPost departmentId={department.id} department={data.departments.find(d=>d.id===department.id)} role={shift.role}/><p>{dateLabel(shift.startsAt,{day:'numeric',month:'long',timeZone:group.event.timezone})} · {Number(toLocalInput(shift.startsAt,group.event.timezone).slice(11,13))>=13?'Tarde':'Mañana'} · {timeLabel(shift.startsAt,group.event.timezone)}–{timeLabel(shift.endsAt,group.event.timezone)}</p>{shift.replacementFor&&<span className="small">Sustitución</span>}</div><AttendanceSummary value={shift.attendance}/></div>)}
              {!person.shifts.length&&<p className="small">Sin turno asignado</p>}
            </article>)}
          </section>)}
        </section>;
      })}</section>)}
      {!groups.length&&<Empty>No hay participaciones con estos filtros.</Empty>}
    </>:<div className="history-changes">{changes.slice(0,limit).map(change=><article key={change.id}><CalendarDays size={20} aria-hidden="true"/><div><h3>{change.action}</h3><p>{data.events.find(event=>event.id===change.eventId)?.title||'Gestión general'}</p><p>{actorName(change.actor)} · {dateLabel(change.at)} · {timeLabel(change.at)}</p></div></article>)}{!changes.length&&<Empty>No hay cambios con estos filtros.</Empty>}</div>}
    {(view==='services'?groups.length:changes.length)>limit&&<button className="btn no-print" onClick={()=>setLimit(current=>current+(view==='services'?8:40))}>Ver más</button>}
  </div>;
}
