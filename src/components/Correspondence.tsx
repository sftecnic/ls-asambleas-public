import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarClock, Check, CheckCheck, ChevronDown, Copy, FilePenLine, Mail, Save, TriangleAlert, Users, Video, X } from 'lucide-react';
import type { AppData, AppUser, AssemblyEvent, Candidate, ChangeData, MailTemplate, ProgramItem } from '../domain/types';
import { copyMail, copyText, getMailTemplates, getRecipient, initialMailSignature, isEmail, isHttpsUrl, MAIL_FIELDS, mailBlocks, mailContext, recordManualSend, renderMail, signaturePeople, usesMailSignature } from '../domain/mail';
import { can, isAdmin } from '../domain/rules';
import '../styles/team.css';

export interface CorrespondenceProps {data:AppData;event:AssemblyEvent;user:AppUser;onChange:ChangeData;candidate?:Candidate;programItem?:ProgramItem;onClose:()=>void;online:boolean;canEdit:boolean;kind?:MailTemplate['kind']}

export function Correspondence({data,event,user,onChange,candidate,programItem,onClose,online,canEdit,kind}:CorrespondenceProps) {
  const initialKind = kind || (programItem ? 'speaker' : candidate?.committee === 'approved' ? 'volunteer' : 'committee');
  const available = getMailTemplates(data).filter(t => programItem ? ['speaker','reminder'].includes(t.kind) : ['committee','volunteer'].includes(t.kind));
  const initial = available.find(t=>t.kind===initialKind) || available[0];
  const [templateId,setTemplateId] = useState(initial.id);
  const [subjectSource,setSubjectSource] = useState(initial.subject);
  const [bodySource,setBodySource] = useState(initial.body);
  const [recipient,setRecipient] = useState(getRecipient(data,initial.kind,candidate,programItem));
  const [editTemplate,setEditTemplate] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);
  const [activeField,setActiveField] = useState<'body'|'subject'>('body');
  const [deadline,setDeadline] = useState('');
  const [videoUrl,setVideoUrl] = useState('');
  const signatureDepartments=data.departments.filter(d=>can(user,data,'contacts',event.id,d.id));
  const [signature,setSignature]=useState(()=>{
    const signatureDepartmentId=candidate?.departmentId||signatureDepartments.find(d=>d.id==='video')?.id||signatureDepartments[0]?.id||'';
    return {signatureDepartmentId,...initialMailSignature(data,event.id,signatureDepartmentId,user)};
  });
  const [signatureChanged,setSignatureChanged]=useState(false);
  const people=signaturePeople(data,event.id,signature.signatureDepartmentId,user);
  const dialog = useRef<HTMLDialogElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const subjectInput = useRef<HTMLInputElement>(null);
  const template = available.find(t=>t.id===templateId) || initial;
  const context = useMemo(()=>mailContext(data,event,user,candidate,programItem,{deadline,videoUrl,...signature}),[data,event,user,candidate,programItem,deadline,videoUrl,signature]);
  const needsDeadline=/\{\{\s*fecha_limite\s*\}\}/.test(subjectSource+bodySource);
  const needsVideo=/\{\{\s*video_lse\s*\}\}/.test(subjectSource+bodySource);
  const needsSignature=usesMailSignature(subjectSource+bodySource);
  const subject = renderMail(subjectSource,context);
  const body = renderMail(bodySource,context);
  const missing = [...new Set([...subject.missing,...body.missing])];
  const recipientValid = isEmail(recipient);
  const canRequest = template.kind !== 'volunteer' || candidate?.committee === 'approved';
  const ready = recipientValid && missing.length===0 && subject.text.trim() && body.text.trim() && canRequest;
  const departmentId=candidate?.departmentId||'platform';
  const contactsAllowed=can(user,data,'contacts',event.id,departmentId);
  const editAllowed=canEdit&&can(user,data,'edit',event.id,departmentId)&&contactsAllowed;
  const writable=online&&editAllowed&&!busy;

  useEffect(()=>{const prior=document.activeElement as HTMLElement|null; dialog.current?.showModal(); return()=>{dialog.current?.close();prior?.focus();};},[]);

  function requestClose() {
    if(busy)return;
    if(!sent&&(subjectSource!==template.subject||bodySource!==template.body||deadline||videoUrl||signatureChanged)&&!window.confirm('¿Cerrar y descartar los cambios del mensaje?'))return;
    onClose();
  }

  function selectTemplate(id:string) {
    const next=available.find(t=>t.id===id); if(!next)return;
    if ((subjectSource!==template.subject || bodySource!==template.body) && !window.confirm('¿Cambiar de plantilla y descartar los cambios del mensaje?'))return;
    setTemplateId(id);setSubjectSource(next.subject);setBodySource(next.body);setRecipient(getRecipient(data,next.kind,candidate,programItem));setSent(false);setMessage('');setError('');
  }
  function insertField(key:string) {
    if(!writable)return;
    const node=activeField==='body'?bodyInput.current:subjectInput.current;
    const source=activeField==='body'?bodySource:subjectSource;
    const start=node?.selectionStart??source.length, end=node?.selectionEnd??source.length;
    const result=source.slice(0,start)+`{{${key}}}`+source.slice(end);
    if(activeField==='body')setBodySource(result);else setSubjectSource(result);
    requestAnimationFrame(()=>{node?.focus();node?.setSelectionRange(start+key.length+4,start+key.length+4);});
  }
  async function copy(value:string,label:string) {
    setError('');setMessage('');
    try {if(label==='Mensaje')await copyMail(value);else await copyText(value);setMessage(sent?`${label} copiado.`:`${label} copiado. Aún no está marcado como enviado.`);}catch(e){setError(e instanceof Error?e.message:'No se pudo copiar.');}
  }
  async function saveTemplate() {
    if(!writable||!isAdmin(user,data))return;
    if(!subjectSource.trim()||!bodySource.trim()){setError('Completa el asunto y el mensaje.');return;}
    setBusy(true);setError('');
    const updated:MailTemplate={...template,subject:subjectSource,body:bodySource};
    const exists=data.templates.some(t=>t.id===updated.id);
    try {await onChange({...data,templates:exists?data.templates.map(t=>t.id===updated.id?updated:t):[...data.templates,updated]},'Actualizó una plantilla de correo');setMessage('Plantilla guardada.');setEditTemplate(false);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}
  }
  async function markSent() {
    if(!online||!editAllowed||!ready||sent||busy)return;
    setBusy(true);setError('');
    try {const next=recordManualSend(data,event,user,{candidate,programItem,template,recipient,subjectSource,bodySource,details:{deadline,videoUrl,...signature}});await onChange(next,'Registró un correo enviado manualmente');setSent(true);setMessage('Envío registrado.');}catch(e){setError(e instanceof Error?e.message:'No se pudo registrar el envío.');}finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="team-dialog mail-dialog" aria-labelledby="mail-heading" onCancel={e=>{e.preventDefault();requestClose();}}>
    <header className="team-dialog-heading"><div className="team-heading-icon"><Mail size={24}/></div><div><span className="team-eyebrow">Correo manual</span><h2 id="mail-heading">Preparar mensaje</h2></div><button className="team-icon-button" aria-label="Cerrar mensaje" disabled={busy} onClick={requestClose}><X/></button></header>
    {!contactsAllowed?<div className="team-dialog-content"><p className="team-feedback warning">Necesitas permiso de contactos en este departamento.</p></div>:<div className="team-dialog-content">
      <label className="team-field">Plantilla<div className="team-select-wrap"><select value={templateId} onChange={e=>selectTemplate(e.target.value)} disabled={busy}>{available.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><ChevronDown size={18}/></div></label>
      {!canRequest&&<p className="team-feedback error" role="alert"><TriangleAlert size={20}/>Primero registra la aprobación del comité.</p>}
      <div className="mail-address-row"><label className="team-field">Para<input type="email" value={recipient} onChange={e=>{setRecipient(e.target.value);setSent(false);}} autoComplete="email" placeholder="nombre@jwpub.org" disabled={!writable}/></label><button className="team-button" disabled={!recipientValid} onClick={()=>copy(recipient,'Destinatario')}><Copy size={19}/>Copiar</button></div>
      {!recipientValid&&<p className="team-inline-error">{recipient?'Revisa la dirección de correo.':'Añade el correo del destinatario.'}</p>}
      {(needsDeadline||needsVideo)&&<fieldset className="mail-details"><legend>Completar correo</legend>
        {needsDeadline&&<label className="team-field"><span><CalendarClock size={19} aria-hidden="true"/>Fecha límite</span><input type="datetime-local" name="mail-deadline" autoComplete="off" value={deadline} disabled={!writable} onChange={e=>{setDeadline(e.target.value);setSent(false);}}/><small>Hora de {event.timezone}</small></label>}
        {needsVideo&&<label className="team-field"><span><Video size={19} aria-hidden="true"/>Vídeo de instrucciones en LSE</span><input type="url" name="mail-video-lse" autoComplete="off" spellCheck={false} placeholder="https://…" value={videoUrl} disabled={!writable} aria-invalid={Boolean(videoUrl&&!isHttpsUrl(videoUrl))} onChange={e=>{setVideoUrl(e.target.value);setSent(false);}}/>{videoUrl&&!isHttpsUrl(videoUrl)&&<small className="team-inline-error">Usa un enlace que empiece por https://.</small>}</label>}
      </fieldset>}
      {needsSignature&&<fieldset className="mail-details"><legend><Users size={19} aria-hidden="true"/> Contactos de la firma</legend>
        <label className="team-field">Departamento de la firma<select name="mail-signature-department" value={signature.signatureDepartmentId} disabled={!writable} onChange={e=>{const id=e.target.value;setSignature({signatureDepartmentId:id,...initialMailSignature(data,event.id,id,user)});setSignatureChanged(true);setSent(false);}}>
          {signatureDepartments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select></label>
        {([['responsibleId','Responsable','Elegir responsable'],['assistantId','Auxiliar (opcional)','Sin auxiliar']] as const).map(([key,label,empty])=>{
          const person=people.find(p=>p.id===signature[key]);
          const other=signature[key==='responsibleId'?'assistantId':'responsibleId'];
          return <label className="team-field" key={key}>{label}<select name={`mail-${key}`} value={signature[key]||''} disabled={!writable} onChange={e=>{setSignature({...signature,[key]:e.target.value});setSignatureChanged(true);setSent(false);}}>
            <option value="">{empty}</option>{signaturePeople(data,event.id,signature.signatureDepartmentId,user,key==='responsibleId'?'responsible':'assistant').filter(p=>p.id!==other).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>{person&&<small>{person.email||'Falta correo'} · {person.phone||'Falta teléfono'}</small>}
          {person&&(!isEmail(person.email)||!person.phone.trim())&&<small className="team-inline-error">Completa el correo y teléfono en su ficha de Equipo.</small>}</label>;
        })}
        {!people.length&&<p className="team-inline-error">Añade las personas a este departamento desde Equipo.</p>}
      </fieldset>}
      <div className="mail-preview">
        <div className="mail-section-heading"><span>Asunto</span><button className="team-copy-button" disabled={subject.missing.length>0||!subject.text.trim()} onClick={()=>copy(subject.text,'Asunto')}><Copy size={18}/>Copiar asunto</button></div>
        <p className="mail-subject">{subject.text}</p>
        <div className="mail-section-heading"><span>Mensaje</span><button className="team-copy-button" disabled={body.missing.length>0||!body.text.trim()||!canRequest} onClick={()=>copy(body.text,'Mensaje')}><Copy size={18}/>Copiar mensaje</button></div>
        <div className="mail-body" tabIndex={0}>{mailBlocks(body.text).map((block,index)=><p key={index}>{block.heading&&<><strong>{block.heading}</strong><br/></>}{block.body}</p>)}</div>
      </div>
      {missing.length>0&&<p className="team-feedback error" role="alert"><TriangleAlert size={20}/><span>Faltan datos: {missing.map(f=>MAIL_FIELDS.find(([key])=>key===f)?.[1]||f).join(', ')}.</span></p>}
      <button className="team-button team-button-quiet" disabled={!writable} onClick={()=>setEditTemplate(!editTemplate)} aria-expanded={editTemplate}><FilePenLine size={20}/>{editTemplate?'Ocultar edición':'Editar mensaje'}</button>
      {editTemplate&&<div className="mail-editor">
        <label className="team-field">Asunto<input ref={subjectInput} disabled={!writable} value={subjectSource} onChange={e=>{setSubjectSource(e.target.value);setSent(false);}} onFocus={()=>setActiveField('subject')}/></label>
        <label className="team-field">Mensaje<textarea ref={bodyInput} disabled={!writable} value={bodySource} onChange={e=>{setBodySource(e.target.value);setSent(false);}} onFocus={()=>setActiveField('body')} rows={9}/></label>
        <div className="mail-fields" aria-label="Insertar dato"><span>Insertar dato</span>{MAIL_FIELDS.map(([key,label])=><button key={key} type="button" onClick={()=>insertField(key)}>{label}</button>)}</div>
        {isAdmin(user,data)&&<button className="team-button" disabled={!writable} onClick={saveTemplate}><Save size={19}/>Guardar plantilla</button>}
      </div>}
      {!online&&<p className="team-feedback warning">Sin conexión · puedes consultar y copiar.</p>}
      {error&&<p className="team-feedback error" role="alert"><TriangleAlert size={20}/>{error}</p>}
      {message&&<p className="team-feedback success" role="status"><Check size={20}/>{message}</p>}
    </div>}
    <footer className="team-dialog-footer"><button className="team-button" disabled={busy} onClick={requestClose}><ArrowLeft size={19}/>Volver</button><button className="team-button team-button-primary" disabled={!online||!editAllowed||!ready||busy||sent} onClick={markSent}><CheckCheck size={20}/>{sent?'Envío registrado':busy?'Guardando…':'Marcar enviado'}</button></footer>
  </dialog>;
}
export default Correspondence;
