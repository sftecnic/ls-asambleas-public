import {useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {CircleHelp,Ear,EarOff} from 'lucide-react';
import type {HearingStatus} from '../domain/types';
import {hearingLabel} from '../domain/personProfile';
import {appointmentLabel,pioneerLabel,serviceBadge,type PersonService} from '../domain/personService';

/** Local chat/telephone pictogram, with the same 24 px stroke grid as Lucide. */
export function WhatsAppMark(){
 return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8z"/><path d="M9 7.5c-.6 2.8 2.7 6.7 5.5 7.2l1.2-1.8-2.2-1-1 1c-1.4-.7-2.4-1.8-2.9-3l.9-1.1z" strokeWidth="1.4"/></svg>;
}

function ContactHint({label,hint:content,children,className=''}:{label:string;hint:ReactNode;children:ReactNode;className?:string}){
 const [open,setOpen]=useState(false),root=useRef<HTMLSpanElement>(null),button=useRef<HTMLButtonElement>(null),hint=useRef<HTMLSpanElement>(null),id=useId();
 const timer=useRef<number|undefined>(undefined),pinned=useRef(false);
 const cancel=()=>window.clearTimeout(timer.current);
 const close=()=>{cancel();pinned.current=false;setOpen(false);};
 useLayoutEffect(()=>()=>window.clearTimeout(timer.current),[]);
 useLayoutEffect(()=>{
  if(!open)return;
  const tip=hint.current!,anchor=button.current!;
  // Native popovers escape clipped cards and modal headers; older engines keep a fixed hint.
  if(typeof tip.showPopover==='function')tip.showPopover();
  const position=()=>{
   const rect=anchor.getBoundingClientRect(),size=tip.getBoundingClientRect();
   tip.style.left=Math.max(8,Math.min(innerWidth-size.width-8,rect.left+(rect.width-size.width)/2))+'px';
   const below=rect.bottom+6;
   tip.style.top=Math.max(8,below+size.height<=innerHeight-8?below:rect.top-size.height-6)+'px';
  };
  position();
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);
  window.addEventListener('resize',position);document.addEventListener('scroll',position,true);
  return()=>{
   if(typeof tip.hidePopover==='function'&&tip.matches(':popover-open'))tip.hidePopover();
   document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);
   window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true);
  };
 },[open,label]);
 return <span className="person-hearing" ref={root} onPointerEnter={event=>{if(event.pointerType==='mouse'){cancel();setOpen(true);}}} onPointerLeave={event=>{if(event.pointerType==='mouse'&&!pinned.current&&!root.current?.contains(document.activeElement)){cancel();timer.current=window.setTimeout(()=>setOpen(false),180);}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))close();}}>
  <button ref={button} type="button" className={`person-contact-icon ${className}`} aria-label={label} aria-expanded={open} aria-controls={id} aria-describedby={open?id:undefined} onFocus={()=>{cancel();setOpen(true);}} onClick={()=>{cancel();pinned.current=true;setOpen(true);}}>{children}</button>
  <span ref={hint} id={id} role="tooltip" popover="manual" hidden={!open} className="person-contact-hint">{content}</span>
 </span>;
}

export function HearingIndicator({status,name}:{status:HearingStatus;name:string}){
 const label=hearingLabel({hearingStatus:status}),Icon={deaf:EarOff,hearing:Ear,unknown:CircleHelp}[status];
 return <ContactHint label={`Clasificación de ${name}: ${label}`} hint={label} className="person-hearing-button"><Icon size={24} aria-hidden="true"/></ContactHint>;
}

export function ServiceBadge({person,name}:{person:PersonService;name:string}){
 const code=serviceBadge(person);if(!code)return null;
 return <ContactHint label={`Servicio actual de ${name}: ${appointmentLabel(person.appointment)}; precursor regular: ${pioneerLabel(person.regularPioneer)}`} className="person-service-button" hint={<><strong>Condición actual</strong><span>Nombramiento: {appointmentLabel(person.appointment)}</span><span>Precursor regular: {pioneerLabel(person.regularPioneer)}</span></>}><span>{code}</span></ContactHint>;
}
