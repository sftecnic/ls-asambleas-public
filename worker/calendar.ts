import {emptyData,type AppUser,type AssemblyEvent,type Grant,type MeetingPublication,type Person} from '../src/domain/types';
import {can,isAdmin} from '../src/domain/rules';
import {calendarAudience,calendarEnd,calendarSnapshot,googleCalendarBody,calendarReminders,validateCalendarEvent,type CalendarKind,type CalendarSnapshot,type CalendarResponse} from '../src/domain/calendar';
import {context} from './service';
import {hash,type RecordData,type Store} from './store';
export type CalendarTransport=(method:string,path:string,body?:unknown,etag?:string)=>Promise<any>;
const eq=(field:string,value:unknown)=>({field,op:'EQUAL' as const,value});
const key=(kind:CalendarKind,id:string)=>`${kind}~${id}`;
export function calendarTarget(kind:unknown,id:unknown):asserts kind is CalendarKind{if(!['event','meeting'].includes(String(kind))||typeof id!=='string'||!/^[\w-]{1,240}$/.test(id))throw Error('Convocatoria no válida.');}
export async function sourceContext(store:Store,kind:CalendarKind,id:string,grants:Grant[]=[],draft=false){
 const meeting=kind==='meeting'?await store.get('meetingPublications/'+id):null,eventId=kind==='meeting'?meeting?.eventId:id;
 if(!eventId)throw Error('Convocatoria no disponible.');
 const data=await context(store,eventId,grants);data.venues=(await store.getMany(data.events.map(e=>'venues/'+e.venueId))).filter(Boolean) as any;
 if(kind==='meeting')data.meetingPublications=[meeting as MeetingPublication];
 if(draft&&kind==='event'){const d=await store.get('calendarDrafts/'+key(kind,id));if(d)data.events=[d.event as AssemblyEvent];data.venues=(await store.getMany(data.events.map(e=>'venues/'+e.venueId))).filter(Boolean) as any;}
 return data;
}
function manager(user:AppUser,grants:Grant[],s:CalendarSnapshot){return isAdmin(user,{...emptyData(),grants})||(s.kind==='meeting'&&s.departmentIds.every(d=>can(user,{...emptyData(),grants},'publish',s.eventId,d)));}
async function currentGrants(store:Store,user:AppUser){return (await store.query('grants',[eq('email',user.email)])).filter(g=>g.active&&!g._deleted&&(!g.uid||g.uid===user.uid)) as Grant[];}
async function peopleFor(store:Store,s:CalendarSnapshot){const p=await store.getMany(s.recipientIds.map(id=>'persons/'+id)),c=await store.getMany(s.recipientIds.map(id=>'personContacts/'+id));return p.map((p,i)=>({gmail:'',email:'',phone:'',notes:'',...p,...c[i],id:s.recipientIds[i]}) as Person);}
export async function stageCalendar(tx:Store,snapshot:CalendarSnapshot,now:string){
 const id=key(snapshot.kind,snapshot.sourceId),old=await tx.get('calendarLinks/'+id),generation=old?.generation||1;
 const audience=calendarAudience(await peopleFor(tx,snapshot));
 const responses=Object.fromEntries(audience.filter(p=>old?.audience?.find((a:RecordData)=>a.personId===p.personId)?.email===p.email&&old?.responses?.[p.personId]).map(p=>[p.personId,old!.responses[p.personId]]));
 if(audience.filter(p=>!p.issue).length>200)throw Error('Calendar admite hasta 200 invitados por convocatoria.');
 tx.put('calendarLinks/'+id,{...old,id,kind:snapshot.kind,eventId:snapshot.eventId,sourceId:snapshot.sourceId,snapshot,audience,generation,version:(old?.version||0)+1,status:'pending',dueAt:now,attempts:0,updatedAt:now,error:'',responses,force:false});
 if(snapshot.kind==='event')for(const personId of snapshot.recipientIds){
  const noticeId=await hash(`${id}|${(old?.version||0)+1}|${personId}|notice`);tx.put('notices/'+noticeId,{id:noticeId,eventId:snapshot.eventId,personId,title:snapshot.status==='cancelled'?'Convocatoria cancelada':'Asamblea confirmada',body:snapshot.title,createdAt:now,readBy:[],revision:1,_deleted:false});
  if(snapshot.status==='confirmed')for(const r of calendarReminders(snapshot,now)){const deliveryId=await hash(`${id}|${(old?.version||0)+1}|${personId}|${r.kind}`);tx.put('meetingDeliveries/'+deliveryId,{id:deliveryId,eventId:snapshot.eventId,meetingId:snapshot.sourceId,calendarKey:id,version:(old?.version||0)+1,personId,reason:r.kind,status:'pending',dueAt:r.at,attempts:0,createdAt:now});}
 }
}
export async function previewCalendar(store:Store,user:AppUser,grants:Grant[],kind:CalendarKind,id:string,origin:string){
 const data=await sourceContext(store,kind,id,grants,true),snapshot=calendarSnapshot(data,kind,id,origin),old=await store.get('calendarLinks/'+key(kind,id));
 if(!manager(user,grants,snapshot))throw Error('No tienes permiso para convocar.');
 const audience=calendarAudience(await peopleFor(store,snapshot)).map(p=>{const visible=isAdmin(user,data)||data.candidates.some(c=>c.personId===p.personId&&can(user,data,'contacts',c.eventId,c.departmentId));return visible?p:{...p,email:''};});return {snapshot,audience,version:old?.version||0,draftRevision:(await store.get('calendarDrafts/'+key(kind,id)))?.revision||0};
}
export async function saveEventDraft(store:Store,user:AppUser,event:AssemblyEvent,now:string){
 const grants=await currentGrants(store,user);if(!isAdmin(user,{...emptyData(),grants}))throw Error('Administración requerida.');calendarTarget('event',event?.id);
 const old=await store.get('calendarLinks/'+key('event',event.id));if(!old||old.snapshot.status==='cancelled')return {handled:false};
 if(event.archived)throw Error('Cancela primero la convocatoria de Calendar antes de archivar.');
 const cleanKeys=['id','revision','title','type','startDate','endDate','venueId','section','timezone','archived','startsAt','endsAt','draftRevision'];if(Object.keys(event).some(k=>!cleanKeys.includes(k)))throw Error('Datos de evento no admitidos.');
 validateCalendarEvent(event);if(!event.title.trim()||event.endDate<event.startDate||!await store.get('venues/'+event.venueId))throw Error('Revisa las fechas y la sede.');
 await store.atomic(async tx=>{const live=await tx.get('events/'+event.id);if(!live||(live.revision||0)!==(event.revision||0))throw Error('El evento ha cambiado. Recarga.');const draft=await tx.get('calendarDrafts/'+key('event',event.id));if((draft?.revision||0)!==((event as any).draftRevision||0))throw Error('Otra persona ha cambiado el borrador. Vuelve a abrirlo.');const {draftRevision:_,...clean}=event as AssemblyEvent&{draftRevision?:number};tx.put('calendarDrafts/'+key('event',event.id),{id:event.id,event:clean,revision:(draft?.revision||0)+1,at:now,actor:user.uid});});return {handled:true};
}
export async function calendarCommand(store:Store,user:AppUser,input:RecordData,origin:string,now:string){
 const {kind,id,action}=input;calendarTarget(kind,id);if(!['confirm','cancel','restore','recreate'].includes(action))throw Error('Operación no válida.');
 await store.atomic(async tx=>{
  const grants=await currentGrants(tx,user),data=await sourceContext(tx,kind,id,grants,true),s=calendarSnapshot(data,kind,id,origin),old=await tx.get('calendarLinks/'+key(kind,id)),connection=await tx.get('calendarSystem/connection');
  if(!manager(user,grants,s))throw Error('No tienes permiso para convocar.');if((old?.version||0)!==input.expectedVersion)throw Error('La convocatoria ha cambiado. Actualiza.');
  if(!connection?.enabled||!connection.encryptedToken)throw Error('Conecta y activa Calendar antes de convocar.');
  if(action==='confirm'&&(s.startsAt||s.startDate+'T23:59:59.999Z')<=now)throw Error('Para convocar, elige una fecha futura.');
  if(kind==='event'&&action==='confirm'){const draft=await tx.get('calendarDrafts/'+key(kind,id));if((draft?.revision||0)!==(input.draftRevision||0))throw Error('El borrador ha cambiado. Revisa otra vez.');}
  if(action==='cancel'){s.status='cancelled';s.recipientIds=old?.snapshot.recipientIds||s.recipientIds;}
  if((action==='restore'||action==='recreate')&&old?.snapshot)Object.assign(s,old.snapshot);
  if(action==='recreate'&&old?.status!=='conflict')throw Error('Solo se recrea una convocatoria en conflicto.');
  const auditId=crypto.randomUUID();
  if(kind==='event'&&action==='confirm'){
   const e=data.events[0],live=await tx.get('events/'+e.id);if(!live||(live.revision||0)!==(e.revision||0))throw Error('El evento ha cambiado. Recarga.');
   tx.put('events/'+e.id,{...live,...e,revision:(live.revision||0)+1,_actor:user.uid,_at:now,_audit:auditId});tx.remove('calendarDrafts/'+key(kind,id));
  }
  await stageCalendar(tx,s,now);
  // Store implementations do not expose pending writes through get: explicitly retain recreation metadata.
  if(action==='restore'||action==='recreate'||action==='confirm'&&old?.snapshot.status==='cancelled')tx.put('calendarLinks/'+key(kind,id),{...old,id:key(kind,id),kind,eventId:s.eventId,sourceId:id,snapshot:s,audience:calendarAudience(await peopleFor(tx,s)),generation:(old?.generation||1)+(action==='recreate'||old?.snapshot.status==='cancelled'?1:0),googleCreated:action==='recreate'||old?.snapshot.status==='cancelled'?false:old?.googleCreated,lastBody:action==='recreate'||old?.snapshot.status==='cancelled'?null:old?.lastBody,responses:action==='recreate'||old?.snapshot.status==='cancelled'?{}:old?.responses||{},version:(old?.version||0)+1,status:'pending',dueAt:now,attempts:0,error:'',force:true,updatedAt:now});
  tx.put('audit/'+auditId,{id:auditId,eventId:s.eventId,actor:user.name,actorUid:user.uid,at:now,action:`Calendar: ${action} · ${s.title}`});
  tx.put('revisions/global',{actor:user.uid,at:now});tx.put('revisions/'+s.eventId,{actor:user.uid,at:now});
 });
}
export async function calendarView(store:Store,user:AppUser,grants:Grant[],kind:CalendarKind,id:string){
 const data=await sourceContext(store,kind,id,grants),s=calendarSnapshot(data,kind,id,''),link=await store.get('calendarLinks/'+key(kind,id)),admin=isAdmin(user,data),managed=s.departmentIds.filter(d=>can(user,data,'edit',s.eventId,d)||can(user,data,'publish',s.eventId,d));
 const visible=admin?new Set(s.recipientIds):new Set(data.candidates.filter(c=>managed.includes(c.departmentId)||c.personId===user.personId&&can(user,data,'view',s.eventId,c.departmentId)).map(c=>c.personId));
 if(!admin&&!managed.length&&(!s.recipientIds.includes(user.personId)||!visible.has(user.personId)))throw Error('No tienes acceso a esta convocatoria.');
 const names=await store.getMany((link?.audience||[]).filter((p:RecordData)=>visible.has(p.personId)).map((p:RecordData)=>'persons/'+p.personId));
 return {status:link?.status||'draft',error:link?.error||'',version:link?.version||0,lastCheckedAt:link?.lastCheckedAt||'',canManage:manager(user,grants,s),snapshot:link?.snapshot?{...link.snapshot,recipientIds:undefined}:null,responses:(link?.audience||[]).filter((p:RecordData)=>visible.has(p.personId)).map((p:RecordData,i:number)=>({personId:p.personId,name:names[i]?.name||p.name,status:p.issue||(!(link?.responses?.[p.personId])&&link?.status!=='synced'?'pending':link?.responses?.[p.personId]?.status||'needsAction'),observedAt:link?.responses?.[p.personId]?.observedAt||''}))};
}
export class CalendarError extends Error{constructor(message:string,public status=0){super(message);}}
const managedBody=(b:any)=>JSON.stringify({summary:b.summary||'',description:b.description||'',location:b.location||'',start:b.start,end:b.end,emails:(b.attendees||[]).map((a:any)=>a.email.toLowerCase()).sort(),guestsCanModify:!!b.guestsCanModify,guestsCanInviteOthers:!!b.guestsCanInviteOthers,guestsCanSeeOtherGuests:!!b.guestsCanSeeOtherGuests});
async function googleId(link:RecordData){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`ls|${link.snapshot.appOrigin}|${link.id}|${link.generation}`))),b=>b.toString(16).padStart(2,'0')).join('');}
async function saveResponses(tx:Store,link:RecordData,remote:any,now:string){
 const responses:RecordData={};
 for(const p of link.audience||[]){if(p.issue)continue;const status:CalendarResponse=remote.attendees?.find((a:any)=>a.email.toLowerCase()===p.email)?.responseStatus||'needsAction',old=link.responses?.[p.personId];responses[p.personId]={status,observedAt:old?.status===status?old.observedAt:now};
  if(old?.status!==status){const historyId=await hash(`${link.id}|${p.personId}|${now}`);tx.put('calendarResponseHistory/'+historyId,{id:historyId,eventId:link.eventId,sourceId:link.sourceId,kind:link.kind,personId:p.personId,status,observedAt:now});}
  if(status==='declined'&&old?.status!=='declined'){tx.put('revisions/global',{at:now,actor:'calendar'});
   const candidates=await tx.query('candidates',[eq('eventId',link.eventId)]),departments=candidates.filter(c=>c.personId===p.personId&&link.snapshot.departmentIds.includes(c.departmentId)).map(c=>c.departmentId);
   const grants=await tx.query('grants',[],500),leaders=[...new Set(grants.filter(g=>g.active&&!g._deleted&&(g.eventId==='*'&&g.departmentId==='*'&&g.role==='admin'||g.eventId===link.eventId&&(g.departmentId==='*'||departments.includes(g.departmentId))&&(g.capabilities.includes('edit')||g.capabilities.includes('publish')))).map(g=>g.personId))];
   for(const personId of leaders){const noticeId=await hash(`calendar-no|${link.id}|${p.personId}|${now}|${personId}`);tx.put('notices/'+noticeId,{id:noticeId,eventId:link.eventId,personId,title:'Respuesta: No',body:`${p.name} · ${link.snapshot.title}`,createdAt:now,readBy:[],revision:1,_deleted:false});}
  }
 }
 return responses;
}
export async function processCalendar(store:Store,id:string,api:CalendarTransport,now:string){
 const lease=crypto.randomUUID();const claimed=await store.atomic(async tx=>{const l=await tx.get('calendarLinks/'+id);if(!l||l.status!=='pending'||l.dueAt>now||l.leaseUntil>now)return null;tx.put('calendarLinks/'+id,{...l,lease,leaseUntil:new Date(Date.parse(now)+120000).toISOString()});return l;});if(!claimed)return;
 try{
  const path='/calendars/primary/events/'+await googleId(claimed);let remote:any=null;
  try{remote=await api('GET',path);}catch(e){if(!(e instanceof CalendarError)||![404,410].includes(e.status))throw e;}
  if(claimed.snapshot.status!=='cancelled'&&claimed.googleCreated&&(!remote||remote.status==='cancelled')&&!claimed.force)throw new CalendarError('La convocatoria se eliminó en Calendar. Revisa antes de recrearla.',409);
  const desired=googleCalendarBody(claimed.snapshot,claimed.audience.filter((p:RecordData)=>!p.issue).map((p:RecordData)=>p.email),id);
  if(remote&&claimed.lastBody&&!claimed.force&&managedBody(remote)!==claimed.lastBody&&managedBody(remote)!==managedBody(desired))throw new CalendarError('Hay cambios directos en Calendar. Revisa y usa los datos de la aplicación.',409);
  if(claimed.snapshot.status==='cancelled'){if(remote&&remote.status!=='cancelled')await api('DELETE',path+'?sendUpdates=all',undefined,remote.etag);}
  else if(!remote){try{remote=await api('POST','/calendars/primary/events?sendUpdates=all',{...desired,id:await googleId(claimed)});}catch(e){if(e instanceof CalendarError&&e.status===409)remote=await api('GET',path);else throw e;}}
  else if(managedBody(remote)!==managedBody(desired))remote=await api('PUT',path+'?sendUpdates=all',{...desired,attendees:desired.attendees.map(a=>({...remote.attendees?.find((old:any)=>old.email.toLowerCase()===a.email),...a}))},remote.etag);
  await store.atomic(async tx=>{const live=await tx.get('calendarLinks/'+id);if(live?.lease!==lease)return;const responses=await saveResponses(tx,live,remote||{},now);tx.put('calendarLinks/'+id,{...live,googleCreated:true,lastBody:managedBody(remote||desired),status:live.version===claimed.version?'synced':'pending',appliedVersion:claimed.version,responses,lastCheckedAt:now,error:'',leaseUntil:'',lease:'',googleEventId:await googleId(claimed)});});
 }catch(e){await store.atomic(async tx=>{const live=await tx.get('calendarLinks/'+id);if(live?.lease!==lease)return;const conflict=e instanceof CalendarError&&e.status===409,permanent=e instanceof CalendarError&&[400,401,403].includes(e.status),attempts=(live.attempts||0)+1;tx.put('calendarLinks/'+id,{...live,status:conflict?'conflict':permanent||attempts>=6?'error':'pending',attempts,dueAt:new Date(Date.parse(now)+Math.min(3600000,60000*2**attempts)).toISOString(),error:e instanceof Error?e.message:'Calendar no respondió.',lease:'',leaseUntil:''});});}
}
export async function syncCalendar(store:Store,api:CalendarTransport,origin:string,now:string,onlyId?:string){
 const links=onlyId?[await store.get('calendarLinks/'+onlyId)].filter(Boolean) as RecordData[]:await store.query('calendarLinks',[],500);
 for(const link of links){if(link.snapshot.status!=='confirmed'||calendarEnd(link.snapshot)<new Date(Date.parse(now)-7*86400000).toISOString())continue;
  try{
   const revision=JSON.stringify(await store.get('revisions/global'));
   if(revision!==link.audienceRevision){const data=await sourceContext(store,link.kind,link.sourceId),s=calendarSnapshot(data,link.kind,link.sourceId,origin),audience=calendarAudience(await peopleFor(store,s));
   if(JSON.stringify(audience)!==JSON.stringify(link.audience)&&s.status==='confirmed'&&calendarEnd(s)>now){await store.atomic(async tx=>{const live=await tx.get('calendarLinks/'+link.id);if(live?.version===link.version)await stageCalendar(tx,{...link.snapshot,recipientIds:s.recipientIds},now);});continue;}}
   if(link.status!=='synced')continue;
   let remote;try{remote=await api('GET','/calendars/primary/events/'+await googleId(link));}catch(e){if(e instanceof CalendarError&&[404,410].includes(e.status))throw new CalendarError('La convocatoria se eliminó en Calendar.',409);throw e;}
   if(remote.status==='cancelled'||managedBody(remote)!==link.lastBody)throw new CalendarError('Hay cambios directos en Calendar. Revisa la convocatoria.',409);
   await store.atomic(async tx=>{const live=await tx.get('calendarLinks/'+link.id);if(!live||live.version!==link.version||live.status!=='synced')return;const responses=await saveResponses(tx,live,remote,now);tx.put('calendarLinks/'+link.id,{...live,responses,lastCheckedAt:now,error:'',audienceRevision:revision});});
  }catch(e){await store.atomic(async tx=>{const live=await tx.get('calendarLinks/'+link.id);if(!live)return;tx.put('calendarLinks/'+link.id,{...live,...(e instanceof CalendarError&&e.status===409?{status:'conflict'}:{}),error:e instanceof Error?e.message:'No se pudieron actualizar las respuestas.'});});}
 }
}
