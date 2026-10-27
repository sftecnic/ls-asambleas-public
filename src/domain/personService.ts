import type {Appointment,Person,RegularPioneer} from './types';

export type PersonService=Pick<Person,'appointment'|'regularPioneer'>;
export const appointmentOptions=[['unknown','Sin indicar'],['none','Ninguno'],['ministerial-servant','Siervo ministerial'],['elder','Anciano'],['circuit-overseer','Superintendente de circuito']] as const;
export const pioneerOptions=[['unknown','Sin indicar'],['yes','Sí'],['no','No'],['not-applicable','No aplica']] as const;
export const appointmentLabel=(value?:Appointment)=>appointmentOptions.find(([key])=>key===(value??'unknown'))?.[1]??'Sin indicar';
export const pioneerLabel=(value?:RegularPioneer)=>pioneerOptions.find(([key])=>key===(value??'unknown'))?.[1]??'Sin indicar';

export function serviceError(person:PersonService):string{
 if(person.appointment!==undefined&&!appointmentOptions.some(([key])=>key===person.appointment))return 'Selecciona un nombramiento válido.';
 if(person.regularPioneer!==undefined&&!pioneerOptions.some(([key])=>key===person.regularPioneer))return 'Selecciona una opción válida de precursor regular.';
 if(person.appointment==='circuit-overseer'&&person.regularPioneer!=='not-applicable')return 'Para un superintendente de circuito, Precursor regular debe ser «No aplica».';
 if(person.appointment!=='circuit-overseer'&&person.regularPioneer==='not-applicable')return '«No aplica» se reserva al superintendente de circuito.';
 return '';
}
/** Form action only: import and validation must report conflicts, never repair silently. */
export function selectAppointment(person:PersonService,appointment:Appointment):PersonService{
 return {appointment,...(appointment==='circuit-overseer'?{regularPioneer:'not-applicable' as const}:person.regularPioneer==='not-applicable'?{regularPioneer:'unknown' as const}:{})};
}
export function serviceBadge(person:PersonService):string{
 if(person.appointment==='circuit-overseer')return 'SC';
 return [person.appointment==='elder'?'A':person.appointment==='ministerial-servant'?'SM':'',person.regularPioneer==='yes'?'PR':''].filter(Boolean).join(' · ');
}
