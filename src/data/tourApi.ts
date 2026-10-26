import {getAuth} from 'firebase/auth';
import {meetingServiceUrl} from './meetingApi';
import {validateTourCatalog,type DepartmentTour} from '../domain/tours';
export const tourServiceUrl=(import.meta.env.VITE_TOUR_SERVICE_URL||meetingServiceUrl).replace(/\/$/,'');

async function request(path:string,signal:AbortSignal){
 if(!navigator.onLine)throw new Error('Conéctate para ver el recorrido.');
 const current=getAuth().currentUser;if(!current)throw new Error('Vuelve a iniciar sesión.');
 const r=await fetch(tourServiceUrl+path,{headers:{Authorization:`Bearer ${await current.getIdToken()}`},signal:AbortSignal.any([signal,AbortSignal.timeout(30000)]),cache:'no-store'});
 if(!r.ok)throw new Error(r.status===403?'No tienes acceso a este recorrido.':'No se pudo cargar el recorrido. Inténtalo de nuevo.');return r;
}
export async function fetchTours(eventId:string,signal:AbortSignal){
 if(!tourServiceUrl)return [];
 const r=await request('/tours?event='+encodeURIComponent(eventId),signal),data=await r.json();validateTourCatalog({format:1,tours:data.tours});return data.tours as DepartmentTour[];
}
export async function fetchTourImage(eventId:string,tourId:string,id:string,signal:AbortSignal){
 const r=await request(`/tours/${encodeURIComponent(tourId)}/media/${encodeURIComponent(id)}?event=${encodeURIComponent(eventId)}`,signal);return r.blob();
}
