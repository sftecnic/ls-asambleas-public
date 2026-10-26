import {authenticate} from './auth';
import {FirestoreStore,type Store} from './store';
import {handleTourRequest,TourHttpError,type TourAssetsBinding} from './tours';

/** Optional, separate deployment for photographs. No mail, cron, queue or write endpoint. */
export interface TourEnv {
 FIREBASE_PROJECT_ID:string;
 FIREBASE_SERVICE_ACCOUNT:string;
 APP_ORIGIN:string;
 TOUR_ASSETS:TourAssetsBinding;
}
export async function serveTours(request:Request,env:TourEnv,store?:Store):Promise<Response>{
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(origin===env.APP_ORIGIN)headers['Access-Control-Allow-Origin']=env.APP_ORIGIN;
 const json=(value:unknown,status:number)=>Response.json(value,{status,headers});
 if(origin&&origin!==env.APP_ORIGIN)return json({error:'Origen no autorizado.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization'}});
 if(request.method!=='GET')return json({error:'Acción no permitida.'},405);
 if(url.pathname==='/health')return json({ok:true,service:'ls-asambleas-tours',project:env.FIREBASE_PROJECT_ID},200);
 if(url.pathname!=='/tours'&&!url.pathname.startsWith('/tours/'))return json({error:'No disponible.'},404);
 if(!request.headers.get('Authorization')?.startsWith('Bearer '))return json({error:'Inicia sesión para continuar.'},401);
 try{
  const db=store||new FirestoreStore(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT));
  const {user,grants}=await authenticate(request,env.FIREBASE_PROJECT_ID,db);
  const response=await handleTourRequest(request,db,user,grants,env.TOUR_ASSETS);
  const out=new Response(response.body,response);for(const [key,value]of Object.entries(headers))out.headers.set(key,value);
  if(response.headers.has('Cache-Control'))out.headers.set('Cache-Control',response.headers.get('Cache-Control')!);
  return out;
 }catch(error){
  if(error instanceof TourHttpError)return json({error:error.message},error.status);
  return json({error:'No se pudo comprobar el acceso. Renueva la sesión o inténtalo de nuevo.'},401);
 }
}
export default {fetch(request:Request,env:TourEnv){return serveTours(request,env);}};
