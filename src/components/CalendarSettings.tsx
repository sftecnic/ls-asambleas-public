import {useEffect,useState} from 'react';
import {CalendarDays,Link,Send,Unplug,Check} from 'lucide-react';
import {configured} from '../data/repository';
import {meetingRequest} from '../data/meetingApi';
import {ErrorMessage,Status} from './UI';
type Settings={email:string;connected:boolean;enabled:boolean;tested:boolean};
export default function CalendarSettings({online}:{online:boolean}){
 const [settings,setSettings]=useState<Settings>({email:'',connected:false,enabled:false,tested:false}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>setSettings(configured?await meetingRequest<Settings>('/calendar/settings'):{email:'admin@example.test',connected:true,enabled:false,tested:false});
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 const action=async(kind:string,body:unknown={})=>{setBusy(true);setError('');setNotice('');try{if(!configured){setNotice('Demostración: no se envían invitaciones.');return;}const result=await meetingRequest<any>('/calendar/'+kind,body);if(result.url){window.location.assign(result.url);return;}await load();setNotice(kind==='test'?'Prueba creada. Revisa tu calendario y su invitación.':'Cambios guardados.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="card stack" aria-label="Conexión de Calendar"><h2><CalendarDays size={24} aria-hidden="true"/>Google Calendar</h2><p>{settings.email||'Cuenta pendiente de conectar'}</p><Status kind={settings.enabled?'good':'draft'}>{settings.enabled?'Activo':settings.connected?'Conectado · Sin activar':'Sin conectar'}</Status><p className="small">Calendar envía las invitaciones. Gmail conserva los recordatorios.</p><ErrorMessage message={error}/>{notice&&<p role="status">{notice}</p>}<div className="actions no-print"><button className="btn" disabled={!online||busy} onClick={()=>void action('connect')}><Link size={20}/>{settings.connected?'Volver a conectar':'Conectar Calendar'}</button>{settings.connected&&<><button className="btn" disabled={!online||busy} onClick={()=>void action('test')}><Send size={20}/>Crear prueba</button><button className="btn" disabled={!online||busy} onClick={()=>void action('disconnect')}><Unplug size={20}/>Desconectar Calendar</button><button className="btn btn-primary" disabled={!online||busy||!settings.tested} onClick={()=>void action('settings',{enabled:!settings.enabled})}><Check size={20}/>{settings.enabled?'Pausar Calendar':'Activar Calendar'}</button></>}</div></section>;
}
