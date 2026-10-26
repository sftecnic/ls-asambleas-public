import type {AppUser,Grant} from '../src/domain/types';
import {emptyData} from '../src/domain/types';
import {authorizedTours,tourAssets,tourIdPattern,validateTourCatalog,type TourCatalog} from '../src/domain/tours';
import type {Store} from './store';

export interface TourAssetsBinding {fetch(request:Request|string):Promise<Response>}
export class TourHttpError extends Error {constructor(message:string,public status:number){super(message);}}
const catalogs=new WeakMap<TourAssetsBinding,Promise<TourCatalog>>();
async function catalog(binding:TourAssetsBinding){
 let pending=catalogs.get(binding);if(!pending){pending=(async()=>{const r=await binding.fetch('https://assets.local/__tour_catalog.json');if(!r.ok)throw new TourHttpError('Los recorridos no están disponibles.',503);const result=await r.json();validateTourCatalog(result);return result;})();catalogs.set(binding,pending);pending.catch(()=>catalogs.delete(binding));}return pending;
}
export async function handleTourRequest(request:Request,store:Store,user:AppUser,grants:Grant[],binding?:TourAssetsBinding){
 if(request.method!=='GET')throw new TourHttpError('Acción no permitida.',405);
 const url=new URL(request.url),eventId=url.searchParams.get('event')||'';
 if(!eventId||eventId.length>240||eventId.includes('/'))throw new TourHttpError('Evento no válido.',400);
 const event=await store.get('events/'+eventId);if(!event||event._deleted)throw new TourHttpError('No hay acceso a este recorrido.',403);
 const data={...emptyData(),events:[event as any],grants};
 // Check the event before looking up private assets, even when the catalog is empty.
 if(!grants.some(g=>g.active&&(g.eventId==='*'&&g.role==='admin'||g.eventId===eventId)&&g.capabilities.includes('view')))throw new TourHttpError('No hay acceso a este recorrido.',403);
 const available=binding?authorizedTours(await catalog(binding),data,user,eventId):[];
 if(url.pathname==='/tours')return Response.json({tours:available},{headers:{'Cache-Control':'no-store'}});
 const match=/^\/tours\/([^/]+)\/media\/([^/]+)$/.exec(url.pathname);
 if(!match||!match.slice(1).every(id=>tourIdPattern.test(id)))throw new TourHttpError('Imagen no disponible.',404);
 const tour=available.find(t=>t.id===match[1]);if(!tour||!tourAssets(tour).has(match[2])||!binding)throw new TourHttpError('No hay acceso a esta imagen.',403);
 const asset=await binding.fetch('https://assets.local/media/'+match[2]+'.webp');if(!asset.ok)throw new TourHttpError('No se pudo cargar la imagen.',404);
 const response=new Response(asset.body,{status:200,headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'cross-origin'}});
 return response;
}
