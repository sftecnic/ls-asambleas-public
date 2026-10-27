import {decrypt,type MailEnv} from './gmail';
import {CalendarError,type CalendarTransport} from './calendar';
import type {Store} from './store';
export function calendarGoogle(env:MailEnv,store:Store):CalendarTransport{
 let access='',expires=0;
 return async(method,path,body,etag)=>{
  if(!path.startsWith('/calendars/primary/events'))throw Error('Ruta Calendar no permitida.');
  const connection=await store.get('calendarSystem/connection');if(!connection?.encryptedToken)throw new CalendarError('Vuelve a conectar Calendar.',401);
  if(!access||Date.now()>=expires){
   const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:await decrypt(connection.encryptedToken,env.TOKEN_ENCRYPTION_KEY),grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)}),data:any=await r.json();
   if(!r.ok||!data.access_token)throw new CalendarError('Vuelve a conectar Calendar.',r.status>=500?503:401);access=data.access_token;expires=Date.now()+Math.max(60,(data.expires_in||300)-60)*1000;
  }
  await store.atomic(async tx=>{const day=new Date().toISOString().slice(0,10),budget=await tx.get('calendarSystem/budget'),count=budget?.day===day?budget.count:0;if(count>=10000)throw new CalendarError('Límite diario de Calendar alcanzado. Se retomará sin contratar capacidad.',429);tx.put('calendarSystem/budget',{day,count:count+1});});
  let r:Response;try{r=await fetch('https://www.googleapis.com/calendar/v3'+path,{method,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json',...(etag?{'If-Match':etag}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});}catch{throw new CalendarError('Google no confirmó el resultado. Se comprobará antes de reintentar.',503);}
  if(r.status===204)return {};
  if(!r.ok)throw new CalendarError(r.status===429?'Google ha limitado las solicitudes. Se volverá a intentar.':r.status===401?'Vuelve a conectar Calendar.':r.status===412?'La convocatoria ha cambiado en Google. Actualiza antes de guardar.':r.status===403?'Google rechazó la solicitud. Revisa permisos y cuotas.':'Calendar no pudo completar la solicitud.',r.status===412?409:r.status);
  return r.json();
 };
}
