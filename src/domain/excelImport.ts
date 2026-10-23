import type {AppData,AppUser,Row,Grant,Shift,CollectionName} from './types';
import {validateData,validateChange,grantId,same,emailKey,findShiftConflicts} from './rules';
import {searchKey} from './team';
import {excelSheets,excelOrder,excelDefaults,type ExcelCollection,type ExcelField} from './excelSchema';

export interface ExcelInputRow {sheet:string;row:number;values:Record<string,string>}
export interface ExcelIssue {sheet:string;row:number;column:string;message:string}
export interface ExcelRecord {key:string;sheet:string;row:number;collection:ExcelCollection;before?:Row;after:Row;changes:string[];state:'new'|'changed'|'same';issues:ExcelIssue[]}
export interface ExcelPlan {records:ExcelRecord[];issues:ExcelIssue[];next:AppData}
export type ExcelResolutions=Record<string,{targetId?:string;clear?:string[];skip?:boolean;distinct?:boolean}>;
const asRecord=(row:Row)=>row as Row&Record<string,unknown>;
const rowKey=(row:ExcelInputRow)=>`${row.sheet}:${row.row}`;
export function localParts(iso:string,zone:string){
 const p=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'longOffset'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,offset:p.timeZoneName==='GMT'?'+00:00':p.timeZoneName.replace('GMT','')};
}
export function localInstant(date:string,time:string,zone:string):string {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Indica una fecha completa y válida.');
 if(!/^([01]\d|2[0-3]):[0-5]\d(?:[+-]\d{2}:\d{2})?$/.test(time))throw new Error('Indica HH:mm, por ejemplo 09:40.');
 const wall=Date.parse(`${date}T${time.slice(0,5)}:00Z`), offsets=new Set<string>();
 for(const delta of [-36,-12,0,12,36])offsets.add(localParts(new Date(wall+delta*3600000).toISOString(),zone).offset);
 const matches=[...offsets].map(o=>`${date}T${time.slice(0,5)}:00${o}`).filter(s=>Number.isFinite(Date.parse(s))).map(s=>new Date(s).toISOString()).filter(s=>{const p=localParts(s,zone);return p.date===date&&p.time===time.slice(0,5)&&(!time.slice(5)||p.offset===time.slice(5));});
 if(matches.length!==1)throw new Error(matches.length?'Hora repetida por cambio horario. Indica también el desfase: 02:30+02:00 o 02:30+01:00.':'Esta hora no existe en la zona del evento.');
 return matches[0];
}
function parse(value:string,field:ExcelField):unknown {
 const s=value.trim();
 if(field.max&&s.length>field.max)throw new Error(`Máximo ${field.max} caracteres.`);
 if(field.choices){let key=Object.keys(field.choices).find(k=>searchKey(k)===searchKey(s));if(field.key==='hearingStatus'){if(['sordo','s'].includes(searchKey(s)))key='Sorda';if(searchKey(s)==='o')key='Oyente';}if(!key)throw new Error(`Elige: ${Object.keys(field.choices).join(', ')}.`);const result=field.choices[key];return field.key==='reserve'?result==='true':result;}
 if(field.kind==='list')return s.split(';').map(x=>x.trim()).filter(Boolean);
 if(field.kind==='number'){const n=Number(s.replace(',','.'));if(!Number.isFinite(n)||n<=0||n>1440)throw new Error('Indica una duración mayor que cero y de hasta 1440 minutos.');return n;}
 if(field.kind==='date'){const p=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);const d=p?`${p[3]}-${p[2]}-${p[1]}`:s;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)throw new Error('Usa DD/MM/AAAA o AAAA-MM-DD.');return d;}
 if(['email','gmail','notificationEmail','committeeEmail','speakerEmail'].includes(field.key)){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw new Error('Revisa la dirección de correo.');if(field.key==='gmail'&&!/^[^\s@]+@gmail\.com$/i.test(s))throw new Error('El acceso necesita una dirección @gmail.com.');return s.toLowerCase();}
 if(['driveUrl','trainingUrl'].includes(field.key)&&!/^https:\/\/(drive|docs)\.google\.com\//i.test(s))throw new Error('Usa un enlace HTTPS de Google Drive.');
 if(field.key==='id'&&(!s||s.includes('/')||/[\u0000-\u001f]/.test(s)))throw new Error('Revisa el código: no admite barras ni caracteres de control.');
 return s;
}
export function prepareExcel(rows:ExcelInputRow[],current:AppData,resolutions:ExcelResolutions={}):ExcelPlan {
 const next=structuredClone(current),records:ExcelRecord[]=[],issues:ExcelIssue[]=[];
 const aliases=new Map<string,string>();
 for(const row of rows){const schema=excelSheets.find(s=>s.name===row.sheet),resolution=resolutions[rowKey(row)];if(schema&&resolution?.targetId)aliases.set(`${schema.collection}:${row.values.id}`,resolution.targetId);}
 const seen=new Set<string>();
 for(const collection of excelOrder)for(const row of rows.filter(r=>excelSheets.find(s=>s.name===r.sheet)?.collection===collection)){
  const schema=excelSheets.find(s=>s.collection===collection)!,key=rowKey(row),resolution=resolutions[key]||{};
  if(resolution.skip)continue;
  const id=resolution.targetId||row.values.id?.trim(),before=current[collection].find(r=>r.id===id);
  const after={...structuredClone(excelDefaults[collection]),...structuredClone(before),id:id||''} as Row&Record<string,unknown>;
  const record:ExcelRecord={key,sheet:row.sheet,row:row.row,collection,before,after,changes:[],state:before?'same':'new',issues:[]};records.push(record);
  const issue=(column:string,message:string)=>{const item={sheet:row.sheet,row:row.row,column,message};record.issues.push(item);issues.push(item);};
  if(resolution.targetId&&!before)issue('Código','El registro elegido ya no existe.');
  if(!id||id.length>240||id.includes('/')||/[\u0000-\u001f]/.test(id)||['.','..'].includes(id)||/^__.*__$/.test(id))issue('Código','Indica un código único válido.');
  if(seen.has(`${collection}:${id}`))issue('Código','Este código aparece más de una vez.');seen.add(`${collection}:${id}`);
  const transient:Record<string,string>={};
  for(const field of schema.fields){if(field.key==='id')continue;const value=row.values[field.key]?.trim()||'';try{
   if(resolution.clear?.includes(field.key)){
    if(field.required||field.choices||field.kind==='date'||field.kind==='time'||field.kind==='number')throw new Error('Este dato no se puede vaciar.');
    after[field.key]=field.kind==='list'?[]:'';
   }else if(value){let parsed=parse(value,field);if(field.reference)parsed=Array.isArray(parsed)?parsed.map(v=>aliases.get(`${field.reference}:${v}`)||v):aliases.get(`${field.reference}:${parsed}`)||parsed;if(['date','start','end'].includes(field.key))transient[field.key]=String(parsed);else after[field.key]=parsed;}
   else if(field.required&&!before)throw new Error('Falta este dato obligatorio.');
  }catch(e){issue(field.label,(e as Error).message);}}
  if(collection==='events'){try{new Intl.DateTimeFormat('es',{timeZone:String(after.timezone)});}catch{issue('Zona horaria','Zona horaria no válida.');}}
  if(collection==='shifts'||collection==='program'){
   const event=next.events.find(e=>e.id===after.eventId),zone=event?.timezone||'Europe/Madrid';
   const old=before?asRecord(before):undefined;
   const oldStart=old?.startsAt?localParts(String(old.startsAt),zone):undefined;
   const date=transient.date||oldStart?.date||'';
   try{after.startsAt=localInstant(date,transient.start||(oldStart?oldStart.time+oldStart.offset:''),zone);}catch(e){issue('Hora / Inicio',(e as Error).message);}
   if(collection==='shifts'){const oldEnd=old?.endsAt?localParts(String(old.endsAt),zone):undefined;try{after.endsAt=localInstant(date,transient.end||(oldEnd?oldEnd.time+oldEnd.offset:''),zone);}catch(e){issue('Final',(e as Error).message);}}
   if(event&&date&&(date<event.startDate||date>event.endDate))issue('Fecha','La fecha está fuera del evento.');
   if(before&&collection==='shifts'&&after.personId!==asRecord(before).personId)issue('Persona','Para cambiar a la persona utiliza Editar → Sustituir en Turnos.');
   if(before&&['eventId','departmentId'].some(k=>k in after&&after[k]!==asRecord(before)[k]))issue('Evento / Departamento','No se puede mover un registro existente a otro ámbito.');
   if(before&&collection==='shifts'&&['absent','present','completed','replaced'].includes(String(asRecord(before).attendance))){
    if(schema.fields.some(f=>!['date','start','end'].includes(f.key)&&!same(after[f.key],asRecord(before)[f.key]))||after.startsAt!==asRecord(before).startsAt||after.endsAt!==asRecord(before).endsAt)issue('Código','Este turno tiene asistencia registrada. Corrígelo desde Turnos.');
   }
  }
  if(collection==='candidates'&&before&&['eventId','personId','departmentId'].some(k=>after[k]!==asRecord(before)[k]))issue('Código','La participación existente no puede cambiar de persona, evento o departamento.');
  if(collection==='persons'){
   const names=[after.name,...(after.aliases as string[]||[])].map(x=>searchKey(String(x)));
   const duplicates=next.persons.filter(p=>p.id!==id&&([p.name,...(p.aliases||[])].some(n=>names.includes(searchKey(n)))||(after.gmail&&emailKey(p.gmail)===emailKey(String(after.gmail)))));
   if(duplicates.length&&(!resolution.distinct||duplicates.some(p=>after.gmail&&emailKey(p.gmail)===emailKey(String(after.gmail)))))issue('Nombre / Gmail',`Posible coincidencia: ${duplicates.map(p=>`${p.name} (${p.id})`).join(', ')}. Elige la ficha existente o confirma que son personas diferentes.`);
   if(before&&emailKey(String(after.gmail))!==emailKey(asRecord(before).gmail as string)&&current.grants.some(g=>g.active&&g.personId===id))issue('Gmail de acceso','Revoca los accesos anteriores desde Permisos antes de cambiar el Gmail.');
  }
  if(collection==='candidates'&&next.candidates.some(c=>c.id!==id&&c.eventId===after.eventId&&c.personId===after.personId&&c.departmentId===after.departmentId))issue('Código','Ya existe esta participación. Usa su código en el Excel.');
  const list=next[collection] as Row[];const index=list.findIndex(r=>r.id===id);if(index<0)list.push(after);else list[index]=after;
 }
 // All references are checked after staging every sheet, including forward references.
 for(const record of records){const schema=excelSheets.find(s=>s.collection===record.collection)!,row=asRecord(record.after);const add=(column:string,message:string)=>{const issue={sheet:record.sheet,row:record.row,column,message};record.issues.push(issue);issues.push(issue);};
  for(const field of schema.fields.filter(f=>f.reference)){const values=Array.isArray(row[field.key])?row[field.key] as string[]:[row[field.key]];for(const value of values)if(value&&!next[field.reference!].some(r=>r.id===value))add(field.label,`No existe el código «${value}».`);}
  if(record.collection==='candidates'&&row.availability!=='unknown'&&row.committee!=='approved')add('Comité','Primero debe constar la aprobación del comité.');
  if(record.collection==='shifts'){
   const shift=row as unknown as Shift;
   for(const personId of [shift.personId,...shift.substituteIds])if(!next.candidates.some(c=>c.eventId===shift.eventId&&c.departmentId===shift.departmentId&&c.personId===personId&&c.committee==='approved'&&c.availability==='accepted'))add(personId===shift.personId?'Persona':'Suplentes','Necesita aprobación y aceptación en este departamento y evento.');
   if(shift.startsAt>=shift.endsAt)add('Final','El final debe ser posterior al inicio.');
   if(shift.substituteIds.length>20)add('Suplentes','Máximo 20 suplentes por turno.');
   if(next.shifts.filter(s=>s.personId===shift.personId&&s.attendance!=='replaced'&&s.startsAt.slice(0,10)===shift.startsAt.slice(0,10)).length>16)add('Horario','Máximo 16 turnos por persona y día UTC.');
   if(shift.startsAt.slice(0,10)!==shift.endsAt.slice(0,10))add('Final','Divide el turno que cruza medianoche UTC.');
   if(findShiftConflicts(next.shifts).some(pair=>pair.some(s=>s.id===shift.id)))add('Horario','Se solapa con otro turno de esta persona, posiblemente en otro evento.');
  }
  if(record.collection==='persons'&&(!(row.name as string)?.trim()||(row.aliases as string[]).length>10||(row.aliases as string[]).some(a=>a.length>160)))add('Nombre / Alias','Indica un nombre y hasta diez alias de 160 caracteres.');
  record.changes=schema.fields.filter(f=>!['date','start','end'].includes(f.key)&&!same(record.before?asRecord(record.before)[f.key]:undefined,row[f.key])).map(f=>f.label);
  if(record.before&&(row.startsAt!==asRecord(record.before).startsAt||row.endsAt!==asRecord(record.before).endsAt))record.changes.push('Horario');
  record.state=record.before?(same(record.before,record.after)?'same':'changed'):'new';
  // Changes to published content require a later explicit publication.
  if(record.state==='changed'&&['shifts','program'].includes(record.collection))row.status='draft';
 }
 if(!issues.length)try{validateData(next);}catch(e){issues.push({sheet:'Libro',row:0,column:'Datos',message:(e as Error).message});}
 return {records,issues,next};
}
export function importBatches(plan:ExcelPlan):ExcelRecord[][] {
 if(plan.issues.length)throw new Error('Corrige los datos antes de importar.');
 const batches:ExcelRecord[][]=[];
 for(const record of plan.records.filter(r=>r.state!=='same')){
  const last=batches[batches.length-1];
  const key=(r:ExcelRecord)=>r.collection==='shifts'?`${asRecord(r.after).personId}:${String(asRecord(r.after).startsAt).slice(0,10)}`:'';
  if(!last||last.length>=5||last[0].collection!==record.collection||record.collection==='shifts'&&last.some(r=>key(r)===key(record)))batches.push([record]);else last.push(record);
 }
 return batches;
}
export function applyExcelBatch(current:AppData,batch:ExcelRecord[],user:AppUser):AppData {
 const next=structuredClone(current);
 for(const record of batch){const existing=current[record.collection].find(r=>r.id===record.after.id);if(!same(existing,record.before))throw new Error(`Ha cambiado «${record.after.id}». Vuelve a revisar el archivo.`);const list=next[record.collection] as Row[];const index=list.findIndex(r=>r.id===record.after.id);if(index<0)list.push(structuredClone(record.after));else list[index]=structuredClone(record.after);}
 validateChange(current,next,user,'global');return next;
}
export function eligibleExcelAccess(data:AppData,personIds:string[]):Grant[]{
 return data.candidates.filter(c=>personIds.includes(c.personId)&&c.committee==='approved'&&c.availability==='accepted').flatMap(c=>{const person=data.persons.find(p=>p.id===c.personId);if(!person||!/^\S+@gmail\.com$/i.test(person.gmail))return [];const grant:Grant={id:'',email:emailKey(person.gmail),personId:c.personId,eventId:c.eventId,departmentId:c.departmentId,role:'volunteer',capabilities:['view'],active:true};grant.id=grantId(grant);return data.grants.some(g=>g.id===grant.id)?[]:[grant];});
}
export function excelDependencies(before:AppData,next:AppData):{collection:CollectionName;id:string;revision:number}[]{
 const dependencies=new Map<string,{collection:CollectionName;id:string;revision:number}>();
 const add=(collection:CollectionName,id:string)=>{const row=before[collection].find(r=>r.id===id);if(row)dependencies.set(`${collection}:${id}`,{collection,id,revision:row.revision||0});};
 for(const schema of excelSheets)for(const row of next[schema.collection]){
  if(same(row,before[schema.collection].find(r=>r.id===row.id)))continue;
  const record=asRecord(row);
  for(const field of schema.fields.filter(f=>f.reference)){const values=Array.isArray(record[field.key])?record[field.key] as string[]:[String(record[field.key]||'')];for(const value of values)add(field.reference!,value);}
  if(schema.collection==='shifts')for(const personId of [record.personId,...record.substituteIds as string[]]){const candidate=next.candidates.find(c=>c.eventId===record.eventId&&c.departmentId===record.departmentId&&c.personId===personId);if(!candidate||candidate.committee!=='approved'||candidate.availability!=='accepted')throw new Error('La persona ya no está aprobada y disponible. Vuelve a revisar.');add('candidates',candidate.id);}
 }
 for(const grant of next.grants.filter(g=>!same(g,before.grants.find(old=>old.id===g.id)))){add('persons',grant.personId);const candidate=next.candidates.find(c=>c.personId===grant.personId&&c.eventId===grant.eventId&&c.departmentId===grant.departmentId);if(candidate)add('candidates',candidate.id);}
 return [...dependencies.values()];
}
