import {createContext,lazy,Suspense,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {Compass,RefreshCw} from 'lucide-react';
import type {AppData,AppUser} from '../domain/types';
import {authorizedTours,demoTourCatalog,type DepartmentTour} from '../domain/tours';
import {fetchTours,fetchTourImage} from '../data/tourApi';
import {DepartmentIcon} from './UI';
import '../styles/tours-entry.css';

const TourDialog=lazy(()=>import('./TourDialog'));
interface ToursContext {tours:DepartmentTour[];loading:boolean;error:string;retry:()=>void;open:(id:string)=>void;loadImage:(tourId:string,id:string,signal:AbortSignal)=>Promise<Blob>}
const Context=createContext<ToursContext|null>(null);
export function useTours(){return useContext(Context);}
export function ToursProvider({eventId,user,data,online,demo,children}:{eventId:string;user:AppUser;data:AppData;online:boolean;demo:boolean;children:ReactNode}){
 const [tours,setTours]=useState<DepartmentTour[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[active,setActive]=useState<string>();
 const scope=JSON.stringify([data.events.find(e=>e.id===eventId)?.venueId,data.grants.filter(g=>g.email.trim().toLowerCase()===user.email.trim().toLowerCase())]);
 // A provider is keyed by account/event. No media or view state survives that boundary.
 useEffect(()=>{const abort=new AbortController();setActive(undefined);setTours([]);setError('');setLoading(true);if(!online){setLoading(false);return;}
  const run=demo?Promise.resolve(authorizedTours(demoTourCatalog(),data,user,eventId)):fetchTours(eventId,abort.signal);
  void run.then(value=>{if(!abort.signal.aborted)setTours(value);}).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'No se pudieron cargar los recorridos.');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();
 },[eventId,user.uid,demo,online,retry,scope]);
 useEffect(()=>{if(!online)setActive(undefined);},[online]);
 const loadImage=useCallback(async(tourId:string,id:string,signal:AbortSignal)=>{
  if(!navigator.onLine)throw new Error('Conéctate para ver el recorrido.');
  if(demo){const response=await fetch(id==='demo-panorama'?'/tour-demo/panorama.svg':'/tour-demo/detail.svg',{signal});if(!response.ok)throw new Error('No se pudo cargar la demostración.');return response.blob();}
  return fetchTourImage(eventId,tourId,id,signal);
 },[eventId,demo]);
 const value=useMemo(()=>({tours,loading,error,retry:()=>setRetry(n=>n+1),open:(id:string)=>{if(online&&tours.some(t=>t.id===id))setActive(id);},loadImage}),[tours,loading,error,online,loadImage]);
 const tour=tours.find(t=>t.id===active);
 return <Context.Provider value={value}>{children}{tour&&<Suspense fallback={<p className="tour-opening" role="status">Abriendo recorrido…</p>}><TourDialog key={tour.id} tour={tour} venueName={data.venues.find(v=>v.id===tour.venueId)?.name||''} eventTitle={data.events.find(e=>e.id===eventId)?.title||''} onClose={()=>setActive(undefined)}/></Suspense>}</Context.Provider>;
}
export function TourButton({departmentId,beforeOpen}:{departmentId:string;beforeOpen?:()=>void}){
 const ctx=useTours(),tour=ctx?.tours.find(t=>t.departmentId===departmentId);if(!tour||!ctx)return null;
 return <button className="btn" onClick={()=>{beforeOpen?.();requestAnimationFrame(()=>ctx.open(tour.id));}}><Compass size={21} aria-hidden="true"/>Conocer departamento</button>;
}
export function TourLinks({data,departmentIds}:{data:AppData;departmentIds?:string[]}){
 const ctx=useTours();if(!ctx)return null;
 if(ctx.error)return <div className="tour-entry-error no-print" role="status"><span>{ctx.error}</span><button className="btn" onClick={ctx.retry}><RefreshCw size={20} aria-hidden="true"/>Reintentar recorridos</button></div>;
 const tours=ctx.tours.filter(t=>!departmentIds||departmentIds.includes(t.departmentId));if(!tours.length)return null;
 return <section className="tour-entries no-print" aria-labelledby="tour-entries-title"><h2 id="tour-entries-title"><Compass size={24} aria-hidden="true"/>Conocer departamento</h2><div className="tour-entry-list">{tours.map(t=><button className="tour-entry" key={t.id} onClick={()=>ctx.open(t.id)}><DepartmentIcon department={data.departments.find(d=>d.id===t.departmentId)}/><span><strong>{t.title}</strong><small>Explorar 360°</small></span><Compass size={23} aria-hidden="true"/></button>)}</div></section>;
}
export function useTourImage(tourId:string,id:string){
 const load=useTours()!.loadImage,[url,setUrl]=useState(''),[blob,setBlob]=useState<Blob>(),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const abort=new AbortController();let address='';setUrl('');setBlob(undefined);setError('');void load(tourId,id,abort.signal).then(blob=>{if(abort.signal.aborted)return;address=URL.createObjectURL(blob);setBlob(blob);setUrl(address);}).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'No se pudo cargar la imagen.');});return()=>{abort.abort();if(address)URL.revokeObjectURL(address);};},[tourId,id,revision,load]);
 return {url,blob,error,retry:()=>setRevision(n=>n+1)};
}
