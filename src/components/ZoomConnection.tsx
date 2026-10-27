import {useState} from 'react';
import {Copy,Video} from 'lucide-react';
import type {Meeting} from '../domain/types';
import {safeMeetingUrl} from '../domain/meetings';
export default function ZoomConnection({meeting}:{meeting:Meeting}){
 const [notice,setNotice]=useState('');
 const copy=async(label:string,value:string)=>{try{await navigator.clipboard.writeText(value);setNotice(label+' copiado.');}catch{setNotice('No se pudo copiar. Selecciona el dato para copiarlo.');}};
 return <section className="stack" aria-label="Acceso a Zoom">{meeting.zoomUrl&&safeMeetingUrl(meeting.zoomUrl)&&<a className="btn btn-primary no-print" href={meeting.zoomUrl} target="_blank" rel="noopener noreferrer"><Video size={22} aria-hidden="true"/>Entrar en Zoom</a>}{meeting.zoomMeetingId&&<div><strong>Número de reunión</strong><p>{meeting.zoomMeetingId}</p><button type="button" className="btn no-print" onClick={()=>void copy('Número',meeting.zoomMeetingId!)}><Copy size={20}/>Copiar número</button></div>}{meeting.zoomPasscode&&<div><strong>Código de acceso</strong><p>{meeting.zoomPasscode}</p><button type="button" className="btn no-print" onClick={()=>void copy('Código',meeting.zoomPasscode!)}><Copy size={20}/>Copiar código</button></div>}{notice&&<p role="status" className="small no-print">{notice}</p>}</section>;
}
