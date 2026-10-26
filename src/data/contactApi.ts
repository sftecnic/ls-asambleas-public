import {getAuth} from 'firebase/auth';
import {tourServiceUrl} from './tourApi';
import {validateLeadershipContacts,type LeadershipContact} from '../domain/whatsapp';

export async function fetchLeadershipContacts(eventId:string,signal:AbortSignal):Promise<LeadershipContact[]>{
 if(!tourServiceUrl)throw new Error('Los contactos del departamento están pendientes de conectar.');
 const user=getAuth().currentUser;if(!user)throw new Error('Vuelve a iniciar sesión.');
 const response=await fetch(tourServiceUrl+'/contacts/leadership?event='+encodeURIComponent(eventId),{headers:{Authorization:'Bearer '+await user.getIdToken()},cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
 if(!response.ok)throw new Error(response.status===403?'No tienes acceso a estos contactos.':'No se pudieron cargar los contactos del departamento.');
 const result=await response.json();if(result.eventId!==eventId)throw new Error('Los contactos pertenecen a otro evento.');
 validateLeadershipContacts(result.contacts);return result.contacts;
}
