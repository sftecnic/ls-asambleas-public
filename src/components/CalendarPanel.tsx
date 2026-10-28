import '../styles/calendar.css';
import {useEffect,useState} from 'react';
import {CalendarDays,RefreshCw,Send,XCircle,ArrowLeft} from 'lucide-react';
import type {AppData,AppUser} from '../domain/types';
import {calendarAudience,calendarSnapshot,calendarResponseLabels,type CalendarKind,type CalendarResponse} from '../domain/calendar';
import {can,isAdmin} from '../domain/rules';
import {dateLabel,timeLabel} from '../domain/format';
import {configured} from '../data/repository';
import {meetingRequest} from '../data/meetingApi';
import {ErrorMessage,Status} from './UI';
import {PersonName} from './PersonContact';
type View={status:string;error:string;version:number;lastCheckedAt:string;canManage:boolean;snapshot:any;responses:{personId:string;name:string;status:string;observedAt:string}[]};
const labels:Record<string,string>={draft:'Sin enviar',pending:'Invitación pendiente',synced:'Actualizada en Calendar',conflict:'Revisar cambios',error:'Error',...calendarResponseLabels,'missing-email':'Sin correo','shared-email':'Correo compartido'};
export default function CalendarPanel({kind,id,data,user,online=true}:{kind:CalendarKind;id:string;data?:AppData;user?:AppUser;online?:boolean}){
 const owner=kind+'~'+id+'~'+(user?.uid||'session');const [stored,setStored]=useState<{owner:string;view:View}>();const view=stored?.owner===owner?stored.view:undefined;const setView=(view:View)=>setStored({owner,view});const [review,setReview]=useState<any>(),[operation,setOperation]=useState('confirm'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const storage='ls-asambleas:demo:calendar:v1',demoId=kind+'~'+id;
 const load=async()=>{if(configured){setView(await meetingRequest<View>(`/calendar/view?kind=${kind}&id=${encodeURIComponent(id)}`));return;}const saved=JSON.parse(localStorage.getItem(storage)||'{}')[demoId];if(saved){const admin=!!data&&!!user&&isAdmin(user,data),managerIds=data&&user?new Set(data.candidates.filter(c=>can(user,data,'edit',c.eventId,c.departmentId)||can(user,data,'publish',c.eventId,c.departmentId)).map(c=>c.personId)):new Set();setView({...saved,canManage:admin||kind==='meeting'&&!!data&&!!user&&(data.meetingPublications.find(m=>m.id===id)?.departmentIds||[]).every(d=>can(user,data,'publish',saved.snapshot.eventId,d)),responses:saved.responses.filter((p:any)=>admin||managerIds.has(p.personId)||p.personId===user?.personId)});return;}setView({status:'draft',error:'',version:0,lastCheckedAt:'',canManage:!!data&&!!user&&(isAdmin(user,data)||kind==='meeting'&&(data.meetingPublications.find(m=>m.id===id)?.departmentIds||[]).every(d=>can(user,data,'publish',data.meetingPublications.find(m=>m.id===id)!.eventId,d))),snapshot:null,responses:[]});};
 useEffect(()=>{setReview(undefined);setError('');if(online)void load().catch(e=>setError(e.message));},[kind,id,online,user?.uid]);
 const prepare=async(action:string)=>{setError('');setBusy(true);try{setOperation(action);if(configured)setReview(await meetingRequest('/calendar/preview',{kind,id}));else if(data){const snapshot=calendarSnapshot(data,kind,id,location.origin);setReview({snapshot,audience:calendarAudience(data.persons.filter(p=>snapshot.recipientIds.includes(p.id))),version:view?.version||0});}}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const submit=async()=>{setBusy(true);setError('');try{if(configured)await meetingRequest('/calendar/command',{kind,id,action:operation,expectedVersion:review.version,draftRevision:review?.draftRevision||0});else{const snapshot={...review.snapshot,status:operation==='cancel'?'cancelled':'confirmed'},responses=review.audience.map((p:any)=>({personId:p.personId,name:p.name,status:p.issue||'needsAction',observedAt:''}));const next={...view!,status:'synced',snapshot,responses,version:(view?.version||0)+1,lastCheckedAt:new Date().toISOString()};localStorage.setItem(storage,JSON.stringify({...JSON.parse(localStorage.getItem(storage)||'{}'),[demoId]:next}));}setReview(undefined);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const refresh=async()=>{setBusy(true);setError('');try{if(configured)await meetingRequest('/calendar/refresh',{kind,id});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 if(!online)return <p className="small no-print">Conecta a internet para consultar las respuestas.</p>;
 return <section className="stack calendar-panel no-print" aria-label="Convocatoria y respuestas" aria-busy={busy}>
  <div className="calendar-section-heading"><h2><CalendarDays size={24} aria-hidden="true"/>{review?'Revisar convocatoria':'Invitación'}</h2>{view&&<Status kind={view.status==='synced'?'good':view.status==='error'||view.status==='conflict'?'error':'draft'}>{view.snapshot?.status==='cancelled'?'Cancelada':labels[view.status]||view.status}</Status>}</div>
  <ErrorMessage message={error||view?.error||''}/>
  {!view&&!error&&<p role="status">Consultando…</p>}
  {view&&(review?<>
   <div className="calendar-review-summary"><h3>{review.snapshot.title}</h3><p>{review.snapshot.startsAt?`${dateLabel(review.snapshot.startsAt,{timeZone:review.snapshot.timezone})} · ${timeLabel(review.snapshot.startsAt,review.snapshot.timezone)}`:`${dateLabel(review.snapshot.startDate)} — ${dateLabel(review.snapshot.endDate)} · Todo el día`}</p><p>{review.snapshot.location}</p></div>
   <details className="content-disclosure"><summary>Contenido de la invitación</summary><p className="meeting-instructions">{review.snapshot.description}</p></details>
   <h3>Convocados · {review.audience.length}</h3><ul>{review.audience.map((p:any)=><li key={p.personId}>{p.name} · {p.issue==='missing-email'?'Sin correo':p.issue==='shared-email'?'Correo compartido · Revisar':p.email||'Correo disponible'}</li>)}</ul>
   <div className="actions calendar-review-actions"><button className="btn" disabled={busy} onClick={()=>setReview(undefined)}><ArrowLeft size={20} aria-hidden="true"/>Volver</button><button className="btn btn-primary" disabled={busy||review.audience.filter((p:any)=>!p.issue).length>200} onClick={()=>void submit()}><Send size={20} aria-hidden="true"/>{busy?'Guardando…':operation==='cancel'?'Confirmar cancelación':operation==='confirm'?'Confirmar y avisar':'Guardar y avisar'}</button></div>
  </>:<>
   <div className="calendar-invitation-actions">
    {view.status==='draft'&&<p className="small">Aún no hay invitación de Calendar.</p>}
    {view.canManage&&<div className="actions"><button className="btn btn-primary" disabled={busy} onClick={()=>void prepare(view.status==='conflict'?'restore':'confirm')}><Send size={20} aria-hidden="true"/>{view.status==='draft'?'Preparar convocatoria':view.status==='conflict'?'Usar datos de la app':'Revisar convocatoria'}</button>
     {view.status==='conflict'&&<button className="btn" disabled={busy} onClick={()=>void prepare('recreate')}>Recrear convocatoria</button>}
     {view.status!=='draft'&&view.snapshot?.status!=='cancelled'&&<button className="btn" disabled={busy} onClick={()=>void prepare('cancel')}><XCircle size={20} aria-hidden="true"/>Cancelar convocatoria</button>}
    </div>}
   </div>
   {(view.status!=='draft'||view.responses.length>0)&&<section className="calendar-answer-section" aria-label="Respuestas">
    <div className="calendar-section-heading"><h3>Respuestas</h3><button className="btn" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={20} aria-hidden="true"/>{busy?'Consultando…':'Actualizar'}</button></div>
    {view.lastCheckedAt&&<p className="small">Comprobado: {dateLabel(view.lastCheckedAt)} · {timeLabel(view.lastCheckedAt)}</p>}
    <div className="calendar-counts">{Object.entries(calendarResponseLabels).map(([status,label])=><span key={status}>{label}<strong>{view.responses.filter(r=>r.status===status).length}</strong></span>)}</div>
    <div className="calendar-responses">{view.responses.map(p=><article key={p.personId}><PersonName personId={p.personId} name={p.name}/><Status kind={p.status==='accepted'?'good':p.status==='declined'?'error':'draft'}>{labels[p.status]||p.status}</Status></article>)}</div>
   </section>}
  </>)}
 </section>;
}
