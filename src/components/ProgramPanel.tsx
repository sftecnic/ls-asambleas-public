import CalendarPanel from './CalendarPanel';
import {CalendarDays} from 'lucide-react';
import {useViewState} from './ViewState';
import HomeFocus from './HomeFocus';
import {attentionIds,type HomeIntent} from '../domain/homeDashboard';
import { useState,useRef } from 'react';
import { Plus, Pencil, Presentation, Mail, ExternalLink, Check, UserRound, FileCheck2, ClipboardCheck,ChevronDown } from 'lucide-react';
import type { PanelProps, ProgramItem, StagePlan } from '../domain/types';
import { can, isAdmin } from '../domain/rules';
import { dateLabel, timeLabel, uid, toLocalInput, fromLocalInput, safeDriveUrl } from '../domain/format';
import { Empty, ErrorMessage, Modal, Status } from './UI';
import StageEditor from './StageEditor';
import Correspondence from './Correspondence';
import {useUnsavedChanges} from './useUnsavedChanges';

export default function ProgramPanel(props: PanelProps & {initialIntent?:HomeIntent}) {
  const { data, event, user, onChange, online } = props;
  const [calendarOpen,setCalendarOpen]=useState(false);
  const volunteer = user.role === 'volunteer';
  const editable = props.canEdit && !volunteer && can(user, data, 'edit', event.id, 'platform');
  const [day, setDay] = useViewState('program.day',event.startDate,'dia');
  const [homeIntent,setHomeIntent]=useState(props.initialIntent);
  const focusedIds=homeIntent?.filter?new Set(attentionIds(data,event.id,homeIntent)):null;
  const [editing, setEditing] = useState<ProgramItem | 'new' | null>(null);
  const [stage, setStage] = useState<StagePlan | null>(null);
  const [mail, setMail] = useState<ProgramItem | null>(null);
  const program = data.program.filter(p => p.eventId === event.id && (focusedIds?focusedIds.has(p.id):toLocalInput(p.startsAt, event.timezone).startsWith(day))).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
  const venue = data.venues.find(v => v.id === event.venueId);
  const [savingId,setSavingId]=useState('');
  const [stateError,setStateError]=useState<{id:string;message:string}|null>(null);
  const stateLock=useRef(false);
  const setStatus = async (item:ProgramItem,field:'material'|'rehearsal',value:string) => {
    if(!editable||!online||stateLock.current||item[field]===value)return;
    if(!(field==='material'?['pending','received','reviewed']:['pending','ready']).includes(value))return;
    stateLock.current=true;setSavingId(item.id);setStateError(null);
    try {
      const next=structuredClone(data);
      next.program=next.program.map(p=>p.id===item.id?{...p,status:'draft',[field]:value}:p);
      await onChange(next,`Actualizado ${field==='material'?'material':'ensayo'}: ${item.title}`);
    } catch(e){setStateError({id:item.id,message:(e as Error).message});}
    finally{stateLock.current=false;setSavingId('');}
  };
  const openPlan=(item:ProgramItem)=>setStage(data.plans.find(p=>p.programItemId===item.id)??{id:uid(),eventId:event.id,programItemId:item.id,name:item.title,status:'draft',updatedAt:new Date().toISOString(),moments:[{id:uid(),title:'Inicio',instruction:'',camera:'Plano general',elements:[]}]});
  if (stage) {
    const publication = data.publications.filter(p => p.eventId === event.id && p.plans.some(plan => plan.programItemId === stage.programItemId)).sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))[0];
    const savedPublished = publication?.plans.find(p => p.programItemId === stage.programItemId);
    const published = savedPublished ? { ...savedPublished, updatedAt:publication.publishedAt } : undefined;
    return <StageEditor plan={data.plans.find(p => p.id === stage.id) ?? stage} published={published} eventLabel={`${event.title} · ${dateLabel(event.startDate)}`} venueLabel={venue ? `${venue.name} · ${venue.city}` : ''} templates={venue?.stageTemplates} onSaveTemplate={editable && isAdmin(user,data) && venue ? async template => { const next=structuredClone(data); next.venues=next.venues.map(v=>v.id===venue.id?{...v,stageTemplates:[...(v.stageTemplates??[]).filter(t=>t.id!==template.id),template]}:v); await onChange(next,`Guardada plantilla de sede: ${template.name}`); } : undefined} onClose={() => setStage(null)} canEdit={editable} canPublish={props.canPublish} online={online} onSave={async plan => { const next = structuredClone(data); next.plans = [...next.plans.filter(p => p.id !== plan.id), plan]; await onChange(next, `Guardado plano: ${plan.name}`); setStage(plan); }} />;
  }
  return <>
    {calendarOpen&&<Modal title="Calendar · Asamblea" onClose={()=>setCalendarOpen(false)}><CalendarPanel kind="event" id={event.id} data={data} user={user} online={online}/></Modal>}<HomeFocus intent={homeIntent} onClear={()=>setHomeIntent(undefined)}/>
    <div className="page-heading"><div><h1>Programa</h1><button className="btn no-print" disabled={!online} onClick={()=>setCalendarOpen(true)}><CalendarDays size={20}/>{volunteer?'Mi invitación':'Convocatoria'}</button><p>{focusedIds?'Todos los días':dateLabel(day)}</p></div>{editable && <button className="btn btn-primary no-print" disabled={!online} onClick={() => setEditing('new')}><Plus size={20} />Añadir intervención</button>}</div>
    {event.startDate !== event.endDate && <div className="toolbar no-print"><label className="field">Día<input type="date" min={event.startDate} max={event.endDate} value={day} onChange={e => {setHomeIntent(undefined);setDay(e.target.value);}} /></label></div>}
    {!program.length ? <Empty>{focusedIds?'No queda material pendiente en esta selección.':volunteer ? 'El programa todavía no está publicado.' : 'Añade la primera intervención del programa.'}</Empty> : <div className="program-list">{program.map(item => <article className={`program-row${item.kind==='break'?' program-break':''}`} key={item.id}>
      <time className="program-time" dateTime={item.startsAt}>{timeLabel(item.startsAt,event.timezone)}</time>
      <div className="program-card"><header><div><h2>{item.title}</h2>{focusedIds&&<p className="small">{dateLabel(item.startsAt,{day:'numeric',month:'long',year:'numeric',timeZone:event.timezone})}</p>}<p className="small">{item.kind==='interview'?'Entrevista':item.kind==='break'?'Descanso':item.kind==='song'?'Canción':'Discurso'} · {item.duration} minutos</p></div><Status kind={item.status==='published'?'good':'draft'}>{item.status==='published'?'Publicado':'Borrador'}</Status></header>
      {item.speaker&&<div className="details"><span><UserRound size={19} aria-hidden="true"/>{item.speaker}</span><span>{item.language==='oral'?`Oral · Intérprete: ${item.interpreter||'Pendiente'}`:'Lengua de signos española'}</span></div>}
      {item.kind!=='break'&&<div className="program-status-row"><Status kind={item.material==='reviewed'?'good':'pending'}>{item.material==='pending'?'Material pendiente':item.material==='received'?'Material recibido':'Material revisado'}</Status><Status kind={item.rehearsal==='ready'?'good':'pending'}>{item.rehearsal==='ready'?'Ensayo listo':'Ensayo pendiente'}</Status></div>}
      <div className="program-actions no-print">{item.kind!=='break'&&(editable||data.plans.some(p=>p.programItemId===item.id))&&<button className="btn" onClick={()=>openPlan(item)}><Presentation size={20} aria-hidden="true"/>Ver plano</button>}
        {(editable||item.kind!=='break'&&item.driveUrl)&&<details className="program-detail"><summary><ChevronDown size={18} aria-hidden="true"/>Detalles</summary><div className="program-detail-body">
          {editable&&item.kind!=='break'&&<div className="program-state-fields" aria-busy={savingId===item.id}>
            <label className="field"><span><FileCheck2 size={19} aria-hidden="true"/>Material</span><select aria-label={`Material de ${item.title}`} value={item.material} disabled={!online||Boolean(savingId)} onChange={e=>void setStatus(item,'material',e.target.value)}><option value="pending">Pendiente</option><option value="received">Recibido</option><option value="reviewed">Revisado</option></select></label>
            <label className="field"><span><ClipboardCheck size={19} aria-hidden="true"/>Ensayo</span><select aria-label={`Ensayo de ${item.title}`} value={item.rehearsal} disabled={!online||Boolean(savingId)} onChange={e=>void setStatus(item,'rehearsal',e.target.value)}><option value="pending">Pendiente</option><option value="ready">Listo</option></select></label>
          </div>}
          {savingId===item.id&&<p className="small" role="status">Guardando…</p>}{stateError?.id===item.id&&<ErrorMessage message={stateError.message}/>}
          <div className="button-row">{item.kind!=='break'&&item.driveUrl&&<a className="btn" href={item.driveUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={18} aria-hidden="true"/>Abrir Drive</a>}{editable&&<>{item.kind!=='break'&&<button className="btn" disabled={!online} onClick={()=>setMail(item)}><Mail size={19} aria-hidden="true"/>Correo</button>}<button className="btn" disabled={!online} onClick={()=>setEditing(item)}><Pencil size={18} aria-hidden="true"/>Editar</button></>}</div>
        </div></details>}
      </div>
    </div></article>)}</div>}
    {editing && <ProgramForm {...props} day={day} item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {mail && <Correspondence {...props} programItem={mail} kind="speaker" canEdit={editable} onClose={() => setMail(null)} />}
  </>;
}

function ProgramForm({ data, event, onChange, online, item, day, onClose }: PanelProps & { item?: ProgramItem; day: string; onClose: () => void }) {
  const [form, setForm] = useState({ title: item?.title ?? '', start: item ? toLocalInput(item.startsAt, event.timezone) : `${day}T10:00`, duration: item?.duration ?? 20, speaker: item?.speaker ?? '', speakerEmail: item?.speakerEmail ?? '', language: item?.language ?? 'LSE', interpreter: item?.interpreter ?? '', kind: item?.kind ?? 'talk', driveUrl: item?.driveUrl ?? '' });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [initialForm]=useState(()=>JSON.stringify(form));
  const allowClose=useUnsavedChanges(JSON.stringify(form)!==initialForm,busy,onClose);
  const close=()=>{if(allowClose())onClose();};
  const set = (key: string, value: string | number) => setForm(f => ({ ...f, [key]: value }));
  const submit = async (e: React.FormEvent) => { e.preventDefault();if(busy||!online)return;setError(''); setBusy(true); try { if (!safeDriveUrl(form.driveUrl)) throw new Error('Usa un enlace HTTPS de Google Drive.'); if (form.start.slice(0, 10) < event.startDate || form.start.slice(0, 10) > event.endDate) throw new Error('La intervención debe estar dentro de las fechas del evento.'); const next = structuredClone(data); const record: ProgramItem = { ...item, id: item?.id ?? uid(), eventId: event.id, title: form.title.trim(), startsAt: fromLocalInput(form.start, event.timezone), duration: Number(form.duration), speaker: form.speaker.trim(), speakerEmail: form.speakerEmail.trim(), language: form.language, interpreter: form.interpreter, kind: form.kind, driveUrl: form.driveUrl.trim(), material: item?.material ?? 'pending', rehearsal: item?.rehearsal ?? 'pending', status: 'draft' }; next.program = [...next.program.filter(p => p.id !== record.id), record]; await onChange(next, `${item ? 'Modificada' : 'Añadida'} intervención: ${record.title}`); onClose(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <Modal title={item ? 'Editar intervención' : 'Añadir intervención'} onClose={close}><form onSubmit={submit}><ErrorMessage message={error} /><fieldset disabled={busy||!online} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="form-grid">
    <label className="field full-width">Título<input autoFocus required maxLength={200} value={form.title} onChange={e => set('title', e.target.value)} /></label>
    <label className="field">Tipo<select value={form.kind} onChange={e => set('kind', e.target.value)}><option value="talk">Discurso</option><option value="interview">Entrevista</option><option value="song">Canción</option><option value="break">Descanso</option></select></label><label className="field">Duración (minutos)<input required type="number" min={1} max={240} value={form.duration} onChange={e => set('duration', Number(e.target.value))} /></label>
    <label className="field full-width">Fecha y hora<input required type="datetime-local" value={form.start} onChange={e => set('start', e.target.value)} /></label>
    <label className="field">Discursante<input value={form.speaker} onChange={e => set('speaker', e.target.value)} /></label><label className="field">Correo<input type="email" value={form.speakerEmail} onChange={e => set('speakerEmail', e.target.value)} /></label>
    <label className="field">Idioma<select value={form.language} onChange={e => set('language', e.target.value)}><option value="LSE">Lengua de signos española</option><option value="oral">Oral con intérprete</option></select></label>{form.language === 'oral' && <label className="field">Intérprete<input required value={form.interpreter} onChange={e => set('interpreter', e.target.value)} /></label>}
    <label className="field full-width">Carpeta Drive<input type="url" placeholder="https://drive.google.com/…" value={form.driveUrl} onChange={e => set('driveUrl', e.target.value)} /></label>
  </div></fieldset><div className="modal-actions"><button className="btn btn-primary" disabled={!online || busy}><Check size={20} />{busy ? 'Guardando…' : 'Guardar borrador'}</button></div></form></Modal>;
}
