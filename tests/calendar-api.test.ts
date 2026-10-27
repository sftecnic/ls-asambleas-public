import {describe,it,expect,vi,afterEach} from 'vitest';
import {CalendarStore} from './fixtures/calendarStore';
import {handle} from '../worker/index';
import {emptyData} from '../src/domain/types';
import {b64} from '../worker/store';
import {decrypt} from '../worker/gmail';
const auth=vi.hoisted(()=>({run:vi.fn()}));vi.mock('../worker/auth',()=>({authenticate:auth.run}));
const user={uid:'u',email:'admin@example.test',name:'Admin ficticio',personId:'admin',role:'admin'},grant={id:'g',email:user.email,uid:'u',personId:'admin',eventId:'*',departmentId:'*',role:'admin',capabilities:['view','edit','publish'],active:true};
const env={FIREBASE_PROJECT_ID:'demo',FIREBASE_SERVICE_ACCOUNT:'',APP_ORIGIN:'https://app.example.test',SENDER_DOCUMENT:'meetingSystem/institutionalSender',ORGANIZER_EMAIL:'institution@gmail.com',GOOGLE_CLIENT_ID:'mock-client',GOOGLE_CLIENT_SECRET:'mock-secret',TOKEN_ENCRYPTION_KEY:b64(new Uint8Array(32).fill(7)),MEETING_QUEUE:{sendBatch:vi.fn()}};
afterEach(()=>vi.unstubAllGlobals());
describe('conexiones Google independientes',()=>{
 it('Calendar solicita eventos propios y el callback no sobrescribe el remitente Gmail',async()=>{
  const store=new CalendarStore();store.put('grants/g',grant);store.put('meetingSystem/institutionalSender',{email:'institution@gmail.com',encryptedToken:'original',enabled:true,tested:true});auth.run.mockResolvedValue({user,grants:[grant]});
  const response=await handle(new Request('https://worker.example.test/calendar/connect',{method:'POST'}),env,store),target=new URL((await response.json()).url);expect(target.searchParams.get('scope')).toBe('openid email https://www.googleapis.com/auth/calendar.events.owned');expect(target.searchParams.get('login_hint')).toBe('institution@gmail.com');
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('oauth2.googleapis.com/token')?{access_token:'access',refresh_token:'calendar-refresh',scope:'openid email https://www.googleapis.com/auth/calendar.events.owned'}:{email:'institution@gmail.com',email_verified:true}),{status:200,headers:{'Content-Type':'application/json'}})));
  const state=target.searchParams.get('state');const callback=await handle(new Request(`https://worker.example.test/oauth/callback?state=${state}&code=example`),env,store);expect(callback.status).toBe(303);expect((await store.get('meetingSystem/institutionalSender'))!.encryptedToken).toBe('original');const calendar=(await store.get('calendarSystem/connection'))!;expect(calendar.enabled).toBe(false);expect(await decrypt(calendar.encryptedToken,env.TOKEN_ENCRYPTION_KEY)).toBe('calendar-refresh');expect(await store.get('meetingOAuth/'+state)).toBeNull();
 });
 it('el remitente institucional no altera el documento antiguo y desconectar no revoca Calendar',async()=>{
  const store=new CalendarStore();auth.run.mockResolvedValue({user,grants:[grant]});store.put('grants/g',grant);store.put('meetingSystem/sender',{email:'previous@gmail.com',encryptedToken:'previous',enabled:true});store.put('meetingSystem/institutionalSender',{email:'institution@gmail.com',encryptedToken:'new',enabled:true});store.put('calendarSystem/connection',{encryptedToken:'calendar'});const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await handle(new Request('https://worker.example.test/sender/disconnect',{method:'POST'}),env,store);expect((await store.get('meetingSystem/sender'))!.encryptedToken).toBe('previous');expect((await store.get('calendarSystem/connection'))!.encryptedToken).toBe('calendar');expect(fetch).not.toHaveBeenCalled();
 });
 it('un voluntario no obtiene la configuración ni puede conectar o activar cuentas',async()=>{
  const store=new CalendarStore();auth.run.mockResolvedValue({user:{...user,role:'volunteer'},grants:[]});for(const path of ['/calendar/settings','/calendar/connect']){const response=await handle(new Request('https://worker.example.test'+path,path.endsWith('connect')?{method:'POST'}:{}),env,store);expect(response.status).toBe(403);}
 });
 it('la cuenta organizadora explícita prevalece sobre conexiones antiguas y rechaza otra identidad',async()=>{
  const store=new CalendarStore();store.put('grants/g',grant);store.put('meetingSystem/institutionalSender',{email:'previous@gmail.com'});store.put('calendarSystem/connection',{email:'previous@gmail.com',encryptedToken:'keep'});auth.run.mockResolvedValue({user,grants:[grant]});
  const response=await handle(new Request('https://worker.example.test/calendar/connect',{method:'POST'}),env,store),target=new URL((await response.json()).url);expect(target.searchParams.get('login_hint')).toBe('institution@gmail.com');expect(target.searchParams.get('prompt')).toBe('consent select_account');
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('oauth2.googleapis.com/token')?{access_token:'access',refresh_token:'refresh',scope:'openid email https://www.googleapis.com/auth/calendar.events.owned'}:{email:'previous@gmail.com',email_verified:true}),{status:200,headers:{'Content-Type':'application/json'}})));
  await expect(handle(new Request(`https://worker.example.test/oauth/callback?state=${target.searchParams.get('state')}&code=example`),env,store)).rejects.toThrow('Conecta Calendar con institution@gmail.com.');expect((await store.get('calendarSystem/connection'))!.encryptedToken).toBe('keep');
 });
});
