import type {AppUser,Grant,Candidate,Person} from '../src/domain/types';
import {emptyData} from '../src/domain/types';
import {can} from '../src/domain/rules';
import {hasEventView,leadershipContacts} from '../src/domain/whatsapp';
import {TourHttpError} from './tours';
import type {Store,RecordData} from './store';

/** Read-only projection: never return an entire private contact document. */
export async function handleLeadershipContacts(request:Request,store:Store,user:AppUser,grants:Grant[]){
 if(request.method!=='GET')throw new TourHttpError('Acción no permitida.',405);
 const params=new URL(request.url).searchParams,eventId=params.get('event')||'';
 const includeHearingStatus=params.get('include')==='hearingStatus';
 if(!eventId.trim()||eventId.length>240||eventId.includes('/')||eventId==='*')throw new TourHttpError('Evento no válido.',400);
 if(!hasEventView(user,grants,eventId))throw new TourHttpError('No tienes acceso a estos contactos.',403);
 const event=await store.get('events/'+eventId);
 if(!event||event._deleted)throw new TourHttpError('No tienes acceso a estos contactos.',403);
 const scope={...emptyData(),grants};
 const groups=await Promise.all(['responsible','assistant'].map(role=>store.query('candidates',[{field:'eventId',op:'EQUAL',value:eventId},{field:'teamRole',op:'EQUAL',value:role}],501)));
 if(groups.some(rows=>rows.length>500))throw new TourHttpError('Hay demasiados contactos para esta consulta.',503);
 const candidates=groups.flat().filter(c=>!c._deleted&&c.eventId===eventId&&['responsible','assistant'].includes(c.teamRole)&&can(user,scope,'view',eventId,c.departmentId)&&c.committee==='approved'&&c.availability==='accepted');
 const ids=[...new Set(candidates.map(c=>c.personId))].filter(id=>typeof id==='string'&&id.length<=240&&!id.includes('/'));
 const persons:Person[]=[];
 // Bounded batches; no private document is requested for an unauthorized department.
 for(let start=0;start<ids.length;start+=20){
  const batch=ids.slice(start,start+20),paths=batch.flatMap(id=>['persons/'+id,'personContacts/'+id]);
  const rows=await store.getMany(paths);
  for(let i=0;i<batch.length;i++){
   const person=rows[i*2],contact=rows[i*2+1] as RecordData|null;
   if(!person||person._deleted)continue;
   persons.push({id:batch[i],name:person.name,phone:contact&&!contact._deleted?contact.phone||'':'',...(includeHearingStatus&&contact&&!contact._deleted?{hearingStatus:contact.hearingStatus}:{})} as Person);
  }
 }
 const contacts=leadershipContacts({...scope,persons,candidates:candidates as Candidate[]},user,eventId,{includeHearingStatus});
 return Response.json({eventId,contacts},{headers:{'Cache-Control':'private, no-store'}});
}
