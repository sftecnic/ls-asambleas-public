import type {Person,Congregation} from './types';

/** Private documents have their own revisions; only business fields join the person. */
export function personContactFields(person:Partial<Person>={}){
 return {phone:person.phone??'',email:person.email??'',gmail:person.gmail??'',notes:person.notes??'',
  ...(person.hearingStatus===undefined?{}:{hearingStatus:person.hearingStatus}),
  ...(person.notificationEmail===undefined?{}:{notificationEmail:person.notificationEmail}),
  ...(person.appointment===undefined?{}:{appointment:person.appointment}),
  ...(person.regularPioneer===undefined?{}:{regularPioneer:person.regularPioneer}),
  ...(person.serviceCircuit===undefined?{}:{serviceCircuit:person.serviceCircuit})};
}
export function mergePersonContact(person:Person,contact?:Partial<Person>):Person{return {...person,...personContactFields(contact)};}
export function nextDocumentRevision(record?:{revision?:number}){return Number(record?.revision||0)+1;}
export function assertPersonContactUnchanged(before:Person|undefined,current?:Partial<Person>){
 if(before?JSON.stringify(personContactFields(before))!==JSON.stringify(personContactFields(current)):!!current)throw new Error('Otra persona ha modificado los datos privados de esta ficha. Recarga y revisa los cambios.');
}
export function assertCommitteeContactUnchanged(before:Congregation|undefined,current?:{committeeEmail?:string}){
 if(before?(before.committeeEmail||'')!==(current?.committeeEmail||''):!!current)throw new Error('Otra persona ha modificado el correo del comité. Recarga y revisa los cambios.');
}
/** Stable form baseline also detects private-only updates with the same public revision. */
export function personFingerprint(person?:Person|null){return person?JSON.stringify(Object.entries(person).sort(([a],[b])=>a.localeCompare(b))):'';}
