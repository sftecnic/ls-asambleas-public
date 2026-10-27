import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {RefreshCw,Users} from 'lucide-react';
import type {AppData,AppUser,HearingStatus} from '../domain/types';
import {can} from '../domain/rules';
import {canReadProfile,validHearingStatus} from '../domain/personProfile';
import {leadershipContacts,whatsappHref,whatsappNumber,type LeadershipContact} from '../domain/whatsapp';
import {fetchLeadershipContacts} from '../data/contactApi';
import {DepartmentIcon} from './UI';
import {HearingIndicator,ServiceBadge,WhatsAppMark} from './ContactIcons';
import type {PersonService} from '../domain/personService';
import '../styles/contacts.css';

interface ContactContext {
 eventId:string;online:boolean;contacts:LeadershipContact[];loading:boolean;error:string;
 retry:()=>void;details:(personId:string,eventId?:string,departmentId?:string)=>{href:string|null;classification:HearingStatus|null;service:PersonService|null};
 departmentName:(id:string)=>string;
 department:(id:string)=>AppData['departments'][number]|undefined;
}
const Context=createContext<ContactContext|null>(null);

/** Private contacts live only in this mounted session, never in AppData or offline copies. */
export function ContactsProvider({data,user,eventId,online,demo,children}:{data:AppData;user:AppUser;eventId:string;online:boolean;demo:boolean;children:ReactNode}){
 const [state,setState]=useState<{key:string;contacts:LeadershipContact[];error:string;loading:boolean}>({key:'',contacts:[],error:'',loading:false});
 const [refresh,setRefresh]=useState(0),lastRefresh=useRef(0);
 const ownGrants=data.grants.filter(g=>g.email.trim().toLowerCase()===user.email.trim().toLowerCase());
 const requestKey=JSON.stringify([user.uid,user.email,eventId,ownGrants,data.candidates.filter(c=>c.eventId===eventId),data.persons.map(p=>[p.id,p.revision,p.phone,p.hearingStatus])]);
 const retry=useCallback(()=>setRefresh(n=>n+1),[]);
 useEffect(()=>{
  const controller=new AbortController();
  if(!online||!eventId){setState({key:requestKey,contacts:[],error:'',loading:false});return;}
  setState(previous=>({key:requestKey,contacts:previous.key===requestKey?previous.contacts:[],error:'',loading:true}));
  const result=demo?Promise.resolve(leadershipContacts(data,user,eventId,{includeHearingStatus:true})):fetchLeadershipContacts(eventId,controller.signal);
  void result.then(contacts=>{if(!controller.signal.aborted)setState({key:requestKey,contacts,error:'',loading:false});}).catch(error=>{if(!controller.signal.aborted)setState({key:requestKey,contacts:[],error:error instanceof Error?error.message:'No se pudieron cargar los contactos.',loading:false});});
  return()=>controller.abort();
 },[requestKey,online,demo,refresh]);
 useEffect(()=>{
  const wake=()=>{if(online&&navigator.onLine&&document.visibilityState==='visible'&&Date.now()-lastRefresh.current>2000){lastRefresh.current=Date.now();retry();}};
  window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
  return()=>{window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
 },[online,retry]);
 const current=state.key===requestKey&&online;
 const contacts=useMemo(()=>current?state.contacts.filter(c=>can(user,data,'view',eventId,c.departmentId)):[],[current,state.contacts,user,data,eventId]);
 const value:ContactContext={eventId,online,contacts,loading:online&&!!eventId&&(!current||state.loading),error:current?state.error:'',retry,
  departmentName:id=>data.departments.find(d=>d.id===id)?.name||'Departamento',department:id=>data.departments.find(d=>d.id===id),
  details:(personId,contactEvent=eventId,departmentId)=>{
   const unavailable={href:null,classification:null,service:null};
   if(!online)return unavailable;
   const person=data.persons.find(p=>p.id===personId);
   const privateVisible=!!person&&canReadProfile(data,user,personId);
   const contact=privateVisible?person:contactEvent===eventId?contacts.find(c=>c.personId===personId&&(!departmentId||c.departmentId===departmentId)):undefined;
   return contact?{href:personId===user.personId?null:whatsappHref(contact.phone),classification:validHearingStatus(contact.hearingStatus)?contact.hearingStatus:'unknown',service:privateVisible&&person?{appointment:person.appointment,regularPioneer:person.regularPioneer,serviceCircuit:person.serviceCircuit}:null}:unavailable;
  }};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function PersonContactActions({personId,name,eventId,departmentId}:{personId:string;name:string;eventId?:string;departmentId?:string}){
 const context=useContext(Context),details=context?.details(personId,eventId,departmentId);
 if(!details||details.classification===null&&!details.href)return null;
 return <span className="person-contact-actions no-print">
  {details.service&&<ServiceBadge person={details.service} name={name}/>}
  {details.classification!==null&&<HearingIndicator status={details.classification} name={name}/>}
  {details.href&&<a className="person-contact-icon person-whatsapp" href={details.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Abrir WhatsApp con ${name}`} title={`Abrir WhatsApp con ${name}`}><WhatsAppMark/></a>}
 </span>;
}

/** Keeps actions outside headings so a person's accessible name stays unchanged. */
export function PersonName({personId,name,as:Tag='span',eventId,departmentId}:{personId:string;name:string;as?:'span'|'strong'|'h2'|'h3'|'h6';eventId?:string;departmentId?:string}){
 const Wrapper=Tag.startsWith('h')?'div':'span';
 return <Wrapper className="person-contact"><Tag className="person-contact-name">{name}</Tag><PersonContactActions personId={personId} name={name} eventId={eventId} departmentId={departmentId}/></Wrapper>;
}

export function DepartmentContacts({departmentId,headingLevel=2}:{departmentId?:string;headingLevel?:2|4}){
 const context=useContext(Context);if(!context||!context.eventId||!context.online)return null;
 const contacts=context.contacts.filter(c=>!departmentId||c.departmentId===departmentId),departments=[...new Set(contacts.map(c=>c.departmentId))];
 const Heading=headingLevel===4?'h4':'h2';
 return <section className="department-contacts no-print" aria-label={departmentId?'Contactos del departamento':'Contactos de tus departamentos'}>
  <Heading><Users size={22} aria-hidden="true"/>{departmentId?'Responsable y auxiliares':'Tu departamento'}</Heading>
  {context.loading&&!contacts.length?<p className="small" role="status">Cargando contactos…</p>:context.error?<div className="contact-error" role="status"><span>{context.error}</span><button className="btn" onClick={context.retry}><RefreshCw size={18} aria-hidden="true"/>Reintentar</button></div>:!contacts.length?<p className="small">Sin contactos disponibles.</p>:departments.map(id=><div key={id} className="department-contact-group">{!departmentId&&<h3><DepartmentIcon department={context.department(id)} size={20}/>{context.departmentName(id)}</h3>}{contacts.filter(c=>c.departmentId===id).map(c=><div className="department-contact-person" key={c.personId}><span className="small">{c.role==='responsible'?'Responsable':'Auxiliar'}</span><PersonName personId={c.personId} name={c.name} departmentId={id}/>{!whatsappNumber(c.phone)&&<small>Contacto no disponible</small>}</div>)}</div>)}
 </section>;
}
