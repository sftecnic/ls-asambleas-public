import {Users} from 'lucide-react';
import type {AppData,Appointment,HearingStatus,Person,RegularPioneer} from '../domain/types';
import {hearingOptions,profileStats,type ProfileFilters as Filters} from '../domain/personProfile';
import '../styles/profiles.css';
import {appointmentOptions,pioneerOptions,appointmentLabel,pioneerLabel,selectAppointment,type PersonService} from '../domain/personService';

export function ServiceFields({value,onChange,disabled=false}:{value:PersonService;onChange:(patch:PersonService)=>void;disabled?:boolean}){
 const circuit=value.appointment==='circuit-overseer';
 return <fieldset className="person-service-fields no-print" disabled={disabled}><legend>Servicio actual</legend><label className="team-field">Nombramiento<select name="person-appointment" value={value.appointment??'unknown'} onChange={event=>onChange(selectAppointment(value,event.target.value as Appointment))}>{appointmentOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="team-field">Precursor regular<select name="person-pioneer" disabled={circuit} value={value.regularPioneer??'unknown'} onChange={event=>onChange({regularPioneer:event.target.value as RegularPioneer})}>{pioneerOptions.filter(([key])=>circuit?key==='not-applicable':key!=='not-applicable').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></fieldset>;
}
export function ServiceDetails({person}:{person:PersonService}){
 return <dl className="person-service-details no-print"><div><dt>Nombramiento actual</dt><dd>{appointmentLabel(person.appointment)}</dd></div><div><dt>Precursor regular</dt><dd>{pioneerLabel(person.regularPioneer)}</dd></div></dl>;
}

export function HearingField({value,onChange,disabled=false}:{value?:HearingStatus;onChange:(value:HearingStatus)=>void;disabled?:boolean}){
  return <label className="team-field">Sorda u oyente<select name="person-hearing" autoComplete="off" value={value??'unknown'} disabled={disabled} onChange={e=>onChange(e.target.value as HearingStatus)}>{hearingOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>;
}
export function ProfileFilters({data,value,onChange,canFilterPrivate}:{data:AppData;value:Filters;onChange:(value:Filters)=>void;canFilterPrivate:boolean}){
  return <div className="profile-filters">
    <label className="team-field">Congregación<select name="profile-congregation" autoComplete="off" value={value.congregationId} onChange={e=>onChange({...value,congregationId:e.target.value})}><option value="">Todas las congregaciones</option>{[...data.congregations].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {canFilterPrivate&&<label className="team-field">Sorda u oyente<select name="profile-hearing" autoComplete="off" value={value.hearingStatus} onChange={e=>onChange({...value,hearingStatus:e.target.value})}><option value="">Todas las personas</option>{hearingOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
    {canFilterPrivate&&<><label className="team-field">Nombramiento<select name="profile-appointment" value={value.appointment||''} onChange={e=>onChange({...value,appointment:e.target.value})}><option value="">Todos los nombramientos</option>{appointmentOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="team-field">Precursor regular<select name="profile-pioneer" value={value.regularPioneer||''} onChange={e=>onChange({...value,regularPioneer:e.target.value})}><option value="">Todas las opciones</option>{pioneerOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>}
  </div>;
}
export function ProfileSummary({people,authorizedIds,label='Personas'}:{people:Person[];authorizedIds:Set<string>;label?:string}){
  const stats=profileStats(people,authorizedIds);
  return <section className="profile-summary" aria-label={`Estadísticas: ${label}`}>
    <dl><div><dt><Users size={18} aria-hidden="true"/>{label}</dt><dd>{stats.total}</dd></div>{stats.visible>0&&([['Sordas',stats.deaf],['Oyentes',stats.hearing],['Sin indicar',stats.unknown]] as const).map(([title,count])=><div key={title}><dt>{title}</dt><dd>{count}<small>{new Intl.NumberFormat('es-ES',{style:'percent',maximumFractionDigits:1}).format(count/stats.visible)}</small></dd></div>)}</dl>
    {stats.visible<stats.total&&<p className="small">Clasificación visible: {stats.visible} de {stats.total} personas.</p>}
  </section>;
}
export function PersonFields({data,person,onChange,serviceEditable=true}:{data:AppData;person:Person;onChange:(person:Person)=>void;serviceEditable?:boolean}){
  return <div className="profile-form">
    <label className="team-field">Nombre completo<input name="person-name" autoComplete="name" required value={person.name} onChange={e=>onChange({...person,name:e.target.value})}/></label>
    <label className="team-field">Congregación<select name="person-congregation" autoComplete="off" required value={person.congregationId} onChange={e=>onChange({...person,congregationId:e.target.value})}><option value="">Seleccionar congregación</option>{data.congregations.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <HearingField value={person.hearingStatus} onChange={hearingStatus=>onChange({...person,hearingStatus})}/>
    <ServiceFields value={person} disabled={!serviceEditable} onChange={patch=>onChange({...person,...patch})}/>
    <div className="team-field-grid"><label className="team-field">Teléfono<input name="person-phone" type="tel" autoComplete="tel" placeholder="+34 600 123 456" value={person.phone} onChange={e=>onChange({...person,phone:e.target.value})}/></label><label className="team-field">Correo de contacto<input name="person-email" type="email" spellCheck={false} autoComplete="email" value={person.email} onChange={e=>onChange({...person,email:e.target.value})}/></label></div>
    <label className="team-field">Correo para avisos<input type="email" maxLength={254} value={person.notificationEmail||''} placeholder={person.gmail||person.email||'nombre@gmail.com'} onChange={e=>onChange({...person,notificationEmail:e.target.value.trim()})}/><small>Si queda vacío, se usará Gmail o el correo de contacto.</small></label>
    <label className="team-field">Otros nombres (uno por línea)<textarea name="person-aliases" autoComplete="off" rows={2} value={(person.aliases||[]).join('\n')} onChange={e=>onChange({...person,aliases:e.target.value.split('\n')})}/></label>
    <label className="team-field">Notas privadas<textarea name="person-notes" autoComplete="off" rows={3} value={person.notes} onChange={e=>onChange({...person,notes:e.target.value})}/></label>
  </div>;
}
