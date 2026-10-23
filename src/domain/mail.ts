import type { AppData, AppUser, AssemblyEvent, Candidate, Capability, MailTemplate, ProgramItem } from './types';
import { can } from './rules';
import { fromLocalInput } from './format';
import { teamRole } from './team';

export const MAIL_FIELDS = [
  ['persona', 'Nombre'], ['congregacion', 'Congregación'], ['evento', 'Evento'],
  ['fecha', 'Fecha'], ['sede', 'Sede'], ['departamento', 'Departamento'],
  ['discurso', 'Discurso'], ['discursante', 'Discursante'], ['hora', 'Hora'], ['drive', 'Carpeta Drive'], ['remitente', 'Remitente'],
  ['discursos', 'Discursos y carpetas'], ['fecha_limite', 'Fecha límite'], ['video_lse', 'Vídeo en LSE'],
  ['departamento_firma', 'Departamento de la firma'], ['firma_contactos', 'Contactos de la firma'],
  ['responsable_nombre', 'Nombre del responsable'], ['responsable_correo', 'Correo del responsable'], ['responsable_telefono', 'Teléfono del responsable'],
  ['auxiliar_nombre', 'Nombre del auxiliar'], ['auxiliar_correo', 'Correo del auxiliar'], ['auxiliar_telefono', 'Teléfono del auxiliar'],
] as const;

export const DEFAULT_MAIL_TEMPLATES: MailTemplate[] = [
  {id:'default-committee',name:'Aprobación del comité',kind:'committee',subject:'Solicitud al comité · {{persona}} · {{evento}}',body:`Queridos hermanos del comité de servicio de {{congregacion}}:

Nos gustaría contar con {{persona}} para colaborar en el departamento de {{departamento}}.

📅 Evento
{{evento}}
{{fecha}}

📍 Lugar
{{sede}}

✉ Respuesta del comité
¿Podéis confirmarnos si cuenta con vuestra aprobación para esta colaboración? Agradeceríamos recibir vuestra respuesta cuando os sea posible.

Después de recibir vuestra aprobación, nos pondremos en contacto con la persona propuesta para consultar su disponibilidad.

Muchas gracias por vuestra ayuda y por el tiempo que dedicáis.
Recibid un afectuoso saludo.

{{remitente}}
Departamento de {{departamento}}`},
  {id:'default-volunteer',name:'Disponibilidad del voluntario',kind:'volunteer',subject:'Invitación a colaborar · {{evento}}',body:`Hola, {{persona}}:

Nos gustaría contar contigo para colaborar en el departamento de {{departamento}}. Tu comité de servicio ya ha dado su aprobación.

📅 Evento
{{evento}}
{{fecha}}

📍 Lugar
{{sede}}

✉ Tu respuesta
Por favor, valora tus circunstancias personales y dinos si puedes aceptar esta colaboración. Si en esta ocasión no te es posible, lo comprendemos.

Si aceptas, indícanos también la dirección de Gmail con la que entrarás en la aplicación de turnos e instrucciones. Solo necesitamos la dirección, nunca la contraseña.

Muchas gracias por tu buena disposición. Nos alegrará trabajar contigo.
Un abrazo.

{{remitente}}
Departamento de {{departamento}}`},
  {id:'default-speaker',name:'Lista de reproducción del discursante',kind:'speaker',subject:'Listas de reproducción · {{evento}} · {{fecha}}',body:`Hola, {{discursante}}:

Muchas gracias por tu participación en {{evento}}. Para preparar el material de vídeo, te agradeceríamos que siguieras estos pasos.

📅 Fecha límite
{{fecha_limite}}

🎬 Instrucciones en LSE
{{video_lse}}

📁 Tus discursos y carpetas
{{discursos}}

1. Prepara la lista
Usa JW Library, la aplicación morada. Pon como nombre el número del discurso y tu nombre.
Ejemplo: 01.Nombre Apellido

2. Ordena los elementos
Numera las imágenes y los vídeos en el orden en que deben aparecer: 01, 02, 03…
⏸ Pausa: se detiene al terminar el elemento. Es la opción habitual.
▶ Continuar: inicia el siguiente elemento automáticamente. Úsala solo cuando deban reproducirse seguidos.

3. Añade las indicaciones
Si hace falta, cambia el nombre del elemento para indicar cuándo debe aparecer.
Ejemplo: 01 Mostrar esta imagen antes de empezar el discurso.

4. Señala entrevistas y vídeos de Betel
Usa la imagen azul con el símbolo de información para introducir un aviso. Cambia su nombre para explicar qué debe hacer el departamento de vídeo.
Los vídeos proporcionados por Betel no se incluyen en la lista. En su lugar, añade la imagen azul y escribe el título del vídeo.
Ejemplo: 04 Vídeo Betel 07-1.
Si necesitas la imagen azul o un ejemplo de la lista, escríbenos.

5. Sube el material
Exporta la lista de reproducción y súbela a la carpeta de su discurso, usando los enlaces de arriba. Cuando esté lista, avísanos respondiendo a este correo.

💬 ¿Necesitas ayuda?
Si tienes alguna dificultad, estaremos encantados de ayudarte.

Muchas gracias por tu colaboración.
Un abrazo.

Departamento de {{departamento_firma}}

{{firma_contactos}}`},
  {id:'default-reminder',name:'Recordatorio de material',kind:'reminder',subject:'{{evento}} · Recordatorio de material',body:'Hola, {{persona}}:\n\nTe recordamos el material pendiente de «{{discurso}}», el {{fecha}} a las {{hora}}. La carpeta es:\n\n{{carpeta}}\n\nMuchas gracias.\n{{remitente}}'},
];

export function getMailTemplates(data: AppData): MailTemplate[] {
  return [...data.templates, ...DEFAULT_MAIL_TEMPLATES.filter(t => !data.templates.some(saved => saved.kind === t.kind))];
}

export function hasCapability(data:AppData, user:AppUser, eventId:string, capability:Capability, departmentId?:string):boolean {
  if(departmentId!==undefined)return can(user,data,capability,eventId,departmentId);
  return can(user,data,capability,eventId,'*')||data.departments.some(d=>can(user,data,capability,eventId,d.id));
}

export interface MailDetails { deadline?:string; videoUrl?:string; signatureDepartmentId?:string; responsibleId?:string; assistantId?:string }
export const usesMailSignature=(source:string)=>/\{\{\s*(?:departamento_firma|firma_contactos|(?:responsable|auxiliar)_(?:nombre|correo|telefono))\s*\}\}/.test(source);

/** Only people in this event and department, whose contacts the operator may read. */
export function signaturePeople(data:AppData,eventId:string,departmentId:string,user:AppUser,role?:'responsible'|'assistant') {
  if(!can(user,data,'contacts',eventId,departmentId))return [];
  const ids=new Set(data.candidates.filter(c=>c.eventId===eventId&&c.departmentId===departmentId&&teamRole(c)!=='supervisor'&&(!role||teamRole(c)===role)).map(c=>c.personId));
  return data.persons.filter(p=>ids.has(p.id)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
export function initialMailSignature(data:AppData,eventId:string,departmentId:string,user:AppUser):Pick<MailDetails,'responsibleId'|'assistantId'> {
  const unique=(role:'responsible'|'assistant')=>{
    const ids=signaturePeople(data,eventId,departmentId,user,role).map(p=>p.id);
    return ids.length===1?ids[0]:'';
  };
  const responsibleId=unique('responsible'),assistantId=unique('assistant');
  return {responsibleId,assistantId:assistantId===responsibleId?'':assistantId};
}
function signatureContext(data:AppData,eventId:string,user:AppUser,details:MailDetails):Record<string,string> {
  const departmentId=details.signatureDepartmentId||'';
  const responsible=signaturePeople(data,eventId,departmentId,user,'responsible').find(p=>p.id===details.responsibleId);
  const assistant=signaturePeople(data,eventId,departmentId,user,'assistant').find(p=>p.id===details.assistantId&&p.id!==details.responsibleId);
  const complete=(person:typeof responsible)=>Boolean(person?.name.trim()&&isEmail(person.email)&&person.phone.trim());
  const contact=(person:NonNullable<typeof responsible>)=>`${person.name.trim()}\n${person.email.trim()} · ${person.phone.trim()}`;
  return {
    departamento_firma:can(user,data,'contacts',eventId,departmentId)?data.departments.find(d=>d.id===departmentId)?.name||'':'',
    responsable_nombre:responsible?.name||'',responsable_correo:responsible&&isEmail(responsible.email)?responsible.email.trim():'',responsable_telefono:responsible?.phone.trim()||'',
    auxiliar_nombre:assistant?.name||'',auxiliar_correo:assistant&&isEmail(assistant.email)?assistant.email.trim():'',auxiliar_telefono:assistant?.phone.trim()||'',
    firma_contactos:complete(responsible)&&(!details.assistantId||complete(assistant))?[contact(responsible!),...(assistant?[contact(assistant)]:[])].join('\n\n'):'',
  };
}
export function isHttpsUrl(value:string):boolean {
  try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}
export function speakerItems(data:AppData,event:AssemblyEvent,item:ProgramItem):ProgramItem[] {
  const sameName=(value:string)=>value.trim().normalize('NFC').toLocaleLowerCase('es');
  const email=item.speakerEmail.trim().toLowerCase();
  const related=email?data.program.filter(p=>p.eventId===event.id&&['talk','interview'].includes(p.kind)&&p.speakerEmail.trim().toLowerCase()===email&&sameName(p.speaker)===sameName(item.speaker)):[];
  return [...related.filter(p=>p.id!==item.id),item].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
export function mailContext(data:AppData, event:AssemblyEvent, user:AppUser, candidate?:Candidate, programItem?:ProgramItem, details:MailDetails={}):Record<string,string> {
  const person = data.persons.find(p => p.id === candidate?.personId);
  const congregation = data.congregations.find(c => c.id === person?.congregationId);
  const venue = data.venues.find(v => v.id === event.venueId);
  const programDate = programItem?.startsAt ? new Date(programItem.startsAt) : undefined;
  const safeDate = programDate && !Number.isNaN(programDate.getTime()) ? programDate : new Date(event.startDate + 'T12:00:00');
  let deadline='';
  if(details.deadline)try {deadline=new Intl.DateTimeFormat('es-ES',{dateStyle:'full',timeStyle:'short',timeZone:event.timezone}).format(new Date(fromLocalInput(details.deadline,event.timezone)));}catch{/* Keep missing dates visible. */}
  const talks=programItem?speakerItems(data,event,programItem):[];
  const talkList=talks.length&&talks.every(p=>isHttpsUrl(p.driveUrl))?talks.map(p=>`• ${p.title}\n${new Intl.DateTimeFormat('es-ES',{dateStyle:'long',timeStyle:'short',timeZone:event.timezone}).format(new Date(p.startsAt))}\n${p.driveUrl}`).join('\n\n'):'';
  const sender=data.persons.find(p=>p.id===user.personId)?.name||user.name;
  return {
    persona: programItem?.speaker || person?.name || '', congregacion: congregation?.name || '', evento:event.title,
    fecha:Number.isNaN(safeDate.getTime()) ? '' : new Intl.DateTimeFormat('es-ES',{dateStyle:'long',timeZone:event.timezone}).format(safeDate),
    sede:venue ? `${venue.name}, ${venue.city}` : '', departamento:data.departments.find(d => d.id === candidate?.departmentId)?.name || '',
    discurso:programItem?.title || '', hora:programDate && !Number.isNaN(programDate.getTime()) ? new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:event.timezone}).format(programDate) : '',
    carpeta:programItem?.driveUrl || '', drive:programItem?.driveUrl || '', discursante:programItem?.speaker || '', remitente:sender,responsable:sender,
    discursos:talkList,fecha_limite:deadline,video_lse:isHttpsUrl(details.videoUrl||'')?details.videoUrl!.trim():'',
    ...signatureContext(data,event.id,user,details),
  };
}

export interface RenderedMail {text:string;missing:string[]}
export function renderMail(source:string, context:Record<string,string>):RenderedMail {
  const missing = new Set<string>();
  const text = source.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, field:string) => {
    const value = context[field.trim()];
    if (typeof value !== 'string' || !value.trim()) {missing.add(field.trim()); return whole;}
    return value;
  });
  const unmatched=source.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,'');
  if(unmatched.includes('{{')||unmatched.includes('}}'))missing.add('variable incompleta');
  return {text,missing:[...missing]};
}

export function mailBlocks(text:string):{heading:string;body:string}[] {
  return text.split(/\n{2,}/).map(block=>{
    const [first,...rest]=block.split('\n');
    return /^(?:\p{Extended_Pictographic}|[1-5]\.\s)/u.test(first)&&rest.length
      ? {heading:first,body:rest.join('\n')} : {heading:'',body:block};
  });
}
const escapeHtml=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
/** Both clipboard formats contain the same message; no template HTML is trusted. */
export function mailHtml(text:string):string {
  const content=(value:string)=>value.split(/(https:\/\/[^\s<>"]+)/g).map(part=>isHttpsUrl(part)?`<a href="${escapeHtml(part)}" style="color:#1d4ed8;text-decoration:underline">${escapeHtml(part)}</a>`:escapeHtml(part)).join('').replace(/\n/g,'<br>');
  return `<div lang="es" style="font-family:Arial,sans-serif;font-size:18px;line-height:1.6;color:#17243b;max-width:680px">${mailBlocks(text).map(block=>`<p style="margin:0 0 20px">${block.heading?`<strong>${content(block.heading)}</strong><br>`:''}${content(block.body)}</p>`).join('')}</div>`;
}
export async function copyMail(value:string):Promise<void> {
  if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined')try {
    await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([value],{type:'text/plain'}),'text/html':new Blob([mailHtml(value)],{type:'text/html'})})]);return;
  }catch{/* Plain text remains available when formatted copying is unsupported. */}
  await copyText(value);
}

export function isEmail(value:string):boolean {
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value.trim());
}
export function isGmail(value:string):boolean {
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(value.trim());
}
export function getRecipient(data:AppData, kind:MailTemplate['kind'], candidate?:Candidate, programItem?:ProgramItem):string {
  if (programItem) return programItem.speakerEmail;
  const person = data.persons.find(p => p.id === candidate?.personId);
  if (!person) return '';
  return kind === 'committee' ? data.congregations.find(c => c.id === person.congregationId)?.committeeEmail || '' : person.email;
}

export interface ManualSend {
  candidate?:Candidate;programItem?:ProgramItem;template:MailTemplate;
  recipient:string;subjectSource:string;bodySource:string;
  details?:MailDetails;
}

/** Records the user's explicit confirmation; this function never sends an email. */
export function recordManualSend(data:AppData,event:AssemblyEvent,user:AppUser,input:ManualSend,at:string=new Date().toISOString(),id:string=crypto.randomUUID()):AppData {
  const {candidate,programItem,template}=input;
  if(candidate&&candidate.eventId!==event.id||programItem&&programItem.eventId!==event.id)throw new Error('Selecciona la participación de este evento.');
  if(!isEmail(input.recipient))throw new Error('Completa un destinatario válido.');
  if(template.kind==='volunteer'&&candidate?.committee!=='approved')throw new Error('Primero registra la aprobación del comité.');
  const context=mailContext(data,event,user,candidate,programItem,input.details);
  const subject=renderMail(input.subjectSource,context),body=renderMail(input.bodySource,context);
  if(subject.missing.length||body.missing.length)throw new Error('Completa los datos que faltan en el mensaje.');
  if(!subject.text.trim()||!body.text.trim())throw new Error('Completa el asunto y el mensaje.');
  if(data.communications.some(c=>c.id===id))throw new Error('Este envío ya está registrado.');
  const record={id,eventId:event.id,departmentId:candidate?.departmentId||'platform',...(candidate?{personId:candidate.personId}:{}),...(programItem?{programItemId:programItem.id}:{}),templateId:template.id,recipient:input.recipient.trim(),subject:subject.text,body:body.text,sentAt:at,sentBy:user.uid};
  return {...data,communications:[...data.communications,record],candidates:data.candidates.map(c=>{
    if(c.id!==candidate?.id)return c;
    if(template.kind==='committee'&&c.committee==='proposed')return {...c,committee:'pending'};
    if(template.kind==='volunteer'&&c.availability==='unknown')return {...c,availability:'invited'};
    return c;
  })};
}

export async function copyText(value:string):Promise<void> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return; } catch { /* Try the browser's explicit-selection fallback. */ }
  }
  const prior = document.activeElement as HTMLElement | null;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('aria-label','Texto para copiar');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto 0';
  textarea.style.opacity = '0';
  const host = document.querySelector('dialog[open]') || document.body;
  host.appendChild(textarea); textarea.select();
  let copied=false;
  try { copied=typeof document.execCommand==='function'&&document.execCommand('copy'); }
  finally {textarea.remove();prior?.focus();}
  if (!copied) throw new Error('Selecciona el texto y cópialo manualmente.');
}
