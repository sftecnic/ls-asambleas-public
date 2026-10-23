import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,Replace,Trash2,Users} from 'lucide-react';
import type {PanelProps,Shift} from '../domain/types';
import {can} from '../domain/rules';
import {fromLocalInput,timeLabel,toLocalInput,uid} from '../domain/format';
import {shiftPostSuggestions} from '../domain/shiftPosts';
import {ErrorMessage,Modal} from './UI';
import {useUnsavedChanges} from './useUnsavedChanges';

type EditorProps=PanelProps&{day:string;shift?:Shift;initialDepartmentId?:string;departments:string[];onClose:()=>void};
type CloseGuard={registerClose:(close:()=>void)=>void};

export default function ShiftEditor(props:EditorProps){
  const [replacing,setReplacing]=useState(false),[returning,setReturning]=useState(false);
  const closeGuard=useRef(props.onClose);
  const registerClose=useCallback((close:()=>void)=>{closeGuard.current=close;},[]);
  return <Modal title={replacing?'Sustituir persona':props.shift?'Editar turno':'Añadir turno'} onClose={()=>closeGuard.current()}>
    {replacing&&props.shift
      ?<Replacement {...props} shift={props.shift} registerClose={registerClose} onBack={()=>{setReturning(true);setReplacing(false);}}/>
      :<ShiftForm {...props} registerClose={registerClose} focusReplacement={returning} onReplace={()=>setReplacing(true)}/>}
  </Modal>;
}

function ShiftForm({data,event,user,onChange,online,day,shift,initialDepartmentId,departments,onClose,registerClose,onReplace,focusReplacement}:EditorProps&CloseGuard&{onReplace:()=>void;focusReplacement:boolean}){
  const [departmentId,setDepartmentId]=useState(shift?.departmentId??(initialDepartmentId&&departments.includes(initialDepartmentId)?initialDepartmentId:departments[0])??'');
  const [personId,setPersonId]=useState(shift?.personId??'');
  const [role,setRole]=useState(shift?.role??'');
  const [start,setStart]=useState(shift?toLocalInput(shift.startsAt,event.timezone):`${day}T10:00`);
  const [end,setEnd]=useState(shift?toLocalInput(shift.endsAt,event.timezone):`${day}T12:00`);
  const [point,setPoint]=useState(shift?.meetingPoint??'');
  const [subs,setSubs]=useState(shift?.substituteIds??[]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const replaceButton=useRef<HTMLButtonElement>(null);
  const [initialForm]=useState(()=>JSON.stringify({departmentId,personId,role,start,end,point,subs}));
  const allowClose=useUnsavedChanges(JSON.stringify({departmentId,personId,role,start,end,point,subs})!==initialForm,busy,onClose);
  useEffect(()=>{registerClose(()=>{if(allowClose())onClose();});},[allowClose,onClose,registerClose]);
  useEffect(()=>{if(focusReplacement)replaceButton.current?.focus();},[focusReplacement]);
  const candidates=data.candidates.filter(c=>c.eventId===event.id&&c.departmentId===departmentId&&c.committee==='approved'&&c.availability==='accepted');
  const eligibleIds=new Set(candidates.map(c=>c.personId));
  data.grants.filter(g=>g.active&&g.eventId===event.id&&(g.departmentId===departmentId||g.departmentId==='*')&&['responsible','assistant'].includes(g.role)).forEach(g=>eligibleIds.add(g.personId));
  const eligible=data.persons.filter(p=>eligibleIds.has(p.id));
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy||!online)return;setError('');setBusy(true);
    try{
      const startsAt=fromLocalInput(start,event.timezone),endsAt=fromLocalInput(end,event.timezone);
      if(!can(user,data,'assign',event.id,departmentId))throw new Error('No tienes permiso para asignar en este departamento.');
      if(startsAt>=endsAt)throw new Error('La hora de fin debe ser posterior al inicio.');
      if(start.slice(0,10)<event.startDate||end.slice(0,10)>event.endDate)throw new Error('El turno debe estar dentro de las fechas del evento.');
      if(!eligibleIds.has(personId))throw new Error('Selecciona una persona aprobada y disponible.');
      const conflict=data.shifts.find(s=>s.id!==shift?.id&&s.personId===personId&&s.attendance!=='replaced'&&s.startsAt<endsAt&&s.endsAt>startsAt);
      if(conflict)throw new Error(`Esta persona ya tiene un turno de ${timeLabel(conflict.startsAt,event.timezone)} a ${timeLabel(conflict.endsAt,event.timezone)}. Elige otra persona u horario.`);
      const next=structuredClone(data);
      const item:Shift={...shift,id:shift?.id??uid(),eventId:event.id,departmentId,personId,role:role.trim(),startsAt,endsAt,meetingPoint:point.trim(),status:'draft',attendance:shift?.attendance??'planned',substituteIds:subs.filter(s=>s!==personId)};
      next.shifts=[...next.shifts.filter(s=>s.id!==item.id),item];
      await onChange(next,`${shift?'Modificado':'Añadido'} turno de ${role}`);onClose();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const removeDraft=async()=>{
    if(!shift||busy||!online||!window.confirm(`¿Eliminar el borrador de ${shift.role}? El turno se retirará del borrador del evento.`))return;
    setBusy(true);setError('');
    try{
      const current=data.shifts.find(s=>s.id===shift.id);
      if(!current||current.status!=='draft'||(current.revision??0)!==(shift.revision??0))throw new Error('Este turno ha cambiado. Cierra y vuelve a abrirlo.');
      const next=structuredClone(data);next.shifts=next.shifts.filter(s=>s.id!==shift.id);
      await onChange(next,`Eliminado turno en borrador: ${shift.role}`);onClose();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <form onSubmit={save}><ErrorMessage message={error}/><fieldset disabled={busy||!online}><div className="form-grid">
    <label className="field">Departamento<select name="shift-department" autoComplete="off" value={departmentId} onChange={e=>{setDepartmentId(e.target.value);if(!shift)setPersonId('');setSubs([]);}}>{departments.map(id=><option key={id} value={id}>{data.departments.find(d=>d.id===id)?.name}</option>)}</select></label>
    <label className="field">Puesto<input required name="shift-post" autoComplete="off" maxLength={100} list="shift-roles" value={role} onChange={e=>setRole(e.target.value)}/></label><datalist id="shift-roles">{shiftPostSuggestions(departmentId,data.shifts).map(r=><option key={r}>{r}</option>)}</datalist>
    {shift?<div className="field full-width"><span>Persona</span><div className="shift-current-person"><strong>{data.persons.find(p=>p.id===shift.personId)?.name??'Persona no disponible'}</strong>{shift.attendance!=='replaced'&&<button ref={replaceButton} type="button" className="btn" onClick={()=>{if(allowClose())onReplace();}}><Replace size={18} aria-hidden="true"/>Sustituir</button>}</div></div>
      :<label className="field full-width">Persona<select required name="shift-person" autoComplete="off" value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Elegir persona</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{!eligible.length&&<small>Primero registra la aprobación y aceptación en Equipo.</small>}</label>}
    <label className="field">Inicio<input required name="shift-start" autoComplete="off" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label className="field">Fin<input required name="shift-end" autoComplete="off" type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
    <label className="field full-width">Punto de encuentro<input name="shift-meeting" autoComplete="off" value={point} maxLength={200} onChange={e=>setPoint(e.target.value)}/></label>
    <fieldset className="full-width"><legend className="icon-heading"><Users size={20} aria-hidden="true"/>Suplentes</legend>{eligible.filter(p=>p.id!==personId).map(p=><label className="check" key={p.id}><input type="checkbox" checked={subs.includes(p.id)} onChange={e=>setSubs(e.target.checked?[...subs,p.id]:subs.filter(id=>id!==p.id))}/>{p.name}</label>)}</fieldset>
  </div></fieldset><div className="modal-actions">
    {shift?.status==='draft'&&<button type="button" className="btn btn-danger" disabled={!online||busy} onClick={()=>void removeDraft()}><Trash2 size={18} aria-hidden="true"/>Eliminar borrador</button>}
    <button className="btn btn-primary" disabled={!online||busy}><Check size={20} aria-hidden="true"/>{busy?'Guardando…':'Guardar borrador'}</button>
  </div></form>;
}

function Replacement({data,event,user,onChange,online,shift,onClose,onBack,registerClose}:EditorProps&CloseGuard&{shift:Shift;onBack:()=>void}){
  const [personId,setPersonId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const select=useRef<HTMLSelectElement>(null);
  const allowClose=useUnsavedChanges(!!personId,busy,onClose);
  useEffect(()=>{registerClose(()=>{if(allowClose())onClose();});},[allowClose,onClose,registerClose]);
  useEffect(()=>{select.current?.focus();},[]);
  const eligible=data.persons.filter(p=>p.id!==shift.personId&&data.candidates.some(c=>c.personId===p.id&&c.eventId===event.id&&c.departmentId===shift.departmentId&&c.committee==='approved'&&c.availability==='accepted'));
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy||!online)return;setError('');setBusy(true);
    try{
      if(!can(user,data,'assign',event.id,shift.departmentId))throw new Error('No tienes permiso para sustituir en este departamento.');
      const current=data.shifts.find(s=>s.id===shift.id);
      if(!current||current.attendance==='replaced'||(current.revision??0)!==(shift.revision??0))throw new Error('Este turno ha cambiado. Cierra y vuelve a abrirlo.');
      if(!eligible.some(p=>p.id===personId))throw new Error('Elige una persona aprobada y disponible.');
      const conflict=data.shifts.find(s=>s.id!==shift.id&&s.personId===personId&&s.attendance!=='replaced'&&s.startsAt<shift.endsAt&&s.endsAt>shift.startsAt);
      if(conflict)throw new Error(`Esta persona ya tiene un turno de ${timeLabel(conflict.startsAt,event.timezone)} a ${timeLabel(conflict.endsAt,event.timezone)}. Elige otra persona.`);
      const next=structuredClone(data);
      next.shifts=next.shifts.map(s=>s.id===shift.id?{...s,attendance:'replaced',status:'draft'}:s);
      next.shifts.push({...shift,id:uid(),revision:undefined,personId,replacementFor:shift.id,attendance:'planned',status:'draft',substituteIds:shift.substituteIds.filter(id=>id!==personId)});
      await onChange(next,`Sustitución en ${shift.role}: ${data.persons.find(p=>p.id===personId)?.name}`);onClose();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <form onSubmit={save}><ErrorMessage message={error}/><div className="stack">
    <div className="shift-card-detail"><span className="shift-detail-label">Persona actual</span><strong>{data.persons.find(p=>p.id===shift.personId)?.name??'Persona no disponible'}</strong></div>
    <p className="muted">{shift.role} · {timeLabel(shift.startsAt,event.timezone)}–{timeLabel(shift.endsAt,event.timezone)}</p>
    <label className="field">Nueva persona<select ref={select} required name="replacement-person" autoComplete="off" disabled={!online||busy} value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Elegir persona</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.name}{shift.substituteIds.includes(p.id)?' · Suplente':''}</option>)}</select>{!eligible.length&&<small>No hay otra persona aprobada y disponible en este departamento.</small>}</label>
  </div><div className="modal-actions"><button type="button" className="btn" disabled={busy} onClick={()=>{if(allowClose())onBack();}}><ArrowLeft size={18} aria-hidden="true"/>Volver</button><button className="btn btn-primary" disabled={!online||busy||!personId}><Replace size={20} aria-hidden="true"/>{busy?'Guardando…':'Guardar sustitución'}</button></div></form>;
}
