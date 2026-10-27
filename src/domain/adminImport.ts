import {emptyData,type AppData,type CollectionName,type Row} from './types';
import {validateData,changesBetween} from './rules';
import {safeDriveUrl} from './format';
import {searchKey} from './team';

export const IMPORT_FORMAT='ls-asambleas';
export const IMPORT_VERSION=1;
export const importCollections:CollectionName[]=['venues','departments','congregations','events','persons','candidates','shifts','program','plans','templates'];
export interface ImportPreview {next:AppData;counts:{collection:CollectionName;added:number;updated:number}[];warnings:string[];historyCount:number;total:number;baseSignature:string}
const labels:Record<CollectionName,string>={events:'Eventos',venues:'Sedes',departments:'Departamentos',congregations:'Congregaciones',persons:'Personas',candidates:'Candidaturas',shifts:'Turnos',program:'Programa',plans:'Planos',templates:'Plantillas',communications:'Correos',grants:'Permisos',notices:'Avisos',audit:'Histórico',publications:'Publicaciones',meetings:'Reuniones',meetingPublications:'Reuniones confirmadas'};
export const collectionLabel=(name:CollectionName)=>labels[name];
const required:Partial<Record<CollectionName,string[]>>={
  venues:['name','city','address'],departments:['name','icon'],congregations:['name','committeeEmail'],events:['title','type','startDate','endDate','venueId','section','timezone'],persons:['name','congregationId','phone','email','gmail','notes'],
  candidates:['eventId','personId','departmentId','committee','availability','access'],shifts:['eventId','departmentId','personId','role','startsAt','endsAt','meetingPoint','status','attendance'],program:['eventId','title','startsAt','speaker','speakerEmail','language','interpreter','kind','driveUrl','material','rehearsal','status'],plans:['eventId','programItemId','name','status','updatedAt'],templates:['name','kind','subject','body'],
  communications:['eventId','templateId','recipient','subject','body','sentAt','sentBy'],grants:['email','personId','eventId','departmentId','role'],notices:['eventId','title','body','createdAt'],
};
const enums:Partial<Record<CollectionName,Record<string,string[]>>>={departments:{icon:['video','platform','makeup','other']},events:{type:['circuit','regional','pioneers']},candidates:{committee:['proposed','pending','approved','denied'],availability:['unknown','invited','accepted','declined'],access:['none','invited','active']},shifts:{status:['draft','published'],attendance:['planned','present','absent','completed','replaced']},program:{language:['LSE','oral'],kind:['talk','song','break','interview'],material:['pending','received','reviewed'],rehearsal:['pending','ready'],status:['draft','published']},plans:{status:['draft','published']},templates:{kind:['committee','volunteer','speaker','reminder']},grants:{role:['admin','responsible','assistant','volunteer']}};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const normalized=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
const canonical=(value:unknown):string=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:record(value)?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value);
function check(value:unknown,collection:CollectionName):asserts value is Row {
  if(!record(value)||typeof value.id!=='string'||!value.id||value.id.includes('/')||value.id.length>240)throw new Error(`${labels[collection]}: identificador no válido.`);
  for(const field of required[collection]||[])if(typeof value[field]!=='string')throw new Error(`${labels[collection]} · ${value.id}: falta ${field}.`);
  if(collection==='persons'&&value.hearingStatus!==undefined&&!['deaf','hearing','unknown'].includes(value.hearingStatus as string))throw new Error('Clasificación de persona no válida.');
  for(const [field,options] of Object.entries(enums[collection]||{}))if(!options.includes(value[field] as string))throw new Error(`${labels[collection]} · ${value.id}: ${field} no válido.`);
  if(value.revision!==undefined&&(!Number.isInteger(value.revision)||Number(value.revision)<0))throw new Error('Revisión no válida.');
  for(const field of collection==='events'?['archived']:collection==='candidates'?['reserve']:collection==='grants'?['active']:[])if(typeof value[field]!=='boolean')throw new Error(`${labels[collection]}: falta ${field}.`);
  if(collection==='program'&&typeof value.duration!=='number')throw new Error('Falta la duración de una participación.');
  if(collection==='departments'){
    if(value.instructions!==undefined&&typeof value.instructions!=='string')throw new Error('Instrucciones de departamento no válidas.');
    if(value.trainingUrl!==undefined&&(typeof value.trainingUrl!=='string'||!safeDriveUrl(value.trainingUrl)))throw new Error('La formación necesita un enlace HTTPS de Drive.');
  }
  if(collection==='venues'&&value.stageTemplates!==undefined){if(!Array.isArray(value.stageTemplates)||value.stageTemplates.length>50)throw new Error('Las plantillas de sede no son válidas.');const ids=new Set<string>();for(const template of value.stageTemplates){if(!record(template)||typeof template.id!=='string'||!template.id||ids.has(template.id)||typeof template.name!=='string'||!template.name.trim())throw new Error('Nombre o identificador de plantilla no válido.');ids.add(template.id);checkElements(template.elements);}}
  for(const field of collection==='shifts'?['substituteIds']:collection==='grants'?['capabilities']:collection==='notices'?['readBy']:[])if(!Array.isArray(value[field])||!(value[field] as unknown[]).every(x=>typeof x==='string'))throw new Error(`${labels[collection]}: ${field} no válido.`);
  if(collection==='plans'){
    if(!Array.isArray(value.moments)||value.moments.length<1||value.moments.length>50)throw new Error('Cada plano necesita de 1 a 50 momentos.');
    for(const m of value.moments){if(!record(m)||!['id','title','instruction','camera'].every(k=>typeof m[k]==='string')||!Array.isArray(m.elements))throw new Error('Momento de plano no válido.');
      checkElements(m.elements);
    }
  }
}
function checkElements(elements:unknown){if(!Array.isArray(elements)||elements.length>80)throw new Error('Elementos de plano no válidos.');const ids=new Set<string>();for(const e of elements){if(!record(e)||!['id','label'].every(k=>typeof e[k]==='string'&&String(e[k]).trim())||ids.has(String(e.id))||!['person','chair','table','lectern'].includes(String(e.kind))||!['standing','sitting'].includes(String(e.posture))||!['audience','left','right'].includes(String(e.facing))||typeof e.x!=='number'||typeof e.y!=='number'||!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.x>1000||e.y<0||e.y>560||(e.movement!==undefined&&!['none','enter','exit'].includes(String(e.movement))))throw new Error('Elemento de plano no válido.');ids.add(String(e.id));}}
function references(data:AppData){
  const exists=(collection:CollectionName,id:string,optional=false)=>{if(optional&&!id)return;if(!data[collection].some(row=>row.id===id))throw new Error(`Falta una referencia en ${labels[collection]}: ${id}.`);};
  for(const e of data.events){exists('venues',e.venueId);try{new Intl.DateTimeFormat('es',{timeZone:e.timezone});}catch{throw new Error('Zona horaria no válida.');}}
  for(const p of data.persons)exists('congregations',p.congregationId,true);
  for(const c of data.candidates){exists('events',c.eventId);exists('persons',c.personId);exists('departments',c.departmentId);}
  for(const s of data.shifts){exists('events',s.eventId);exists('persons',s.personId);exists('departments',s.departmentId);s.substituteIds.forEach(id=>exists('persons',id));}
  for(const p of data.program)exists('events',p.eventId);
  for(const p of data.plans){exists('events',p.eventId);exists('program',p.programItemId);if(data.program.find(item=>item.id===p.programItemId)?.eventId!==p.eventId)throw new Error('El plano debe pertenecer al mismo evento que su participación.');}
}
export function createBackup(data:AppData){return {format:IMPORT_FORMAT,version:IMPORT_VERSION,exportedAt:new Date().toISOString(),data};}
export function prepareImport(text:string,current:AppData,restore=false):ImportPreview {
  if(text.length>2_000_000)throw new Error('El archivo supera 2 MB. Divídelo en partes.');
  let source:unknown;try{source=JSON.parse(text);}catch{throw new Error('El archivo no contiene JSON válido.');}
  if(!record(source)||source.format!==IMPORT_FORMAT||source.version!==IMPORT_VERSION||!record(source.data))throw new Error('Usa el formato LS Asambleas, versión 1.');
  const raw=source.data;const next=structuredClone(current);const counts:ImportPreview['counts']=[];const warnings:string[]=[];
  for(const key of Object.keys(raw))if(!(key in emptyData()))throw new Error(`Colección desconocida: ${key}.`);
  const parkingIds=new Set((Array.isArray(raw.departments)?raw.departments:[]).filter(d=>record(d)&&typeof d.name==='string'&&/aparcamiento|parking/.test(normalized(d.name))).map(d=>String((d as Record<string,unknown>).id)));
  const allowed=restore?[...importCollections,'communications','notices'] as CollectionName[]:importCollections;
  let excluded=0,total=0;
  for(const collection of allowed){
    const value=raw[collection];if(value===undefined)continue;if(!Array.isArray(value))throw new Error(`${labels[collection]} debe ser una lista.`);
    const incomingIds=new Set<string>();let added=0,updated=0;
    for(const rawRow of value){check(rawRow,collection);const row=rawRow as Row & Record<string,unknown>;
      if((collection==='departments'&&parkingIds.has(row.id))||(typeof row.departmentId==='string'&&parkingIds.has(row.departmentId))){excluded++;continue;}
      if(incomingIds.has(row.id))throw new Error(`${labels[collection]}: el identificador ${row.id} se repite.`);incomingIds.add(row.id);
      const existing=next[collection].find(r=>r.id===row.id);
      if(existing&&!restore)throw new Error(`${labels[collection]}: ${row.id} ya existe. No se fusionarán identidades.`);
      if(collection==='persons'){
        const incomingNames=[String(row.name),...(Array.isArray(row.aliases)?row.aliases.filter((a):a is string=>typeof a==='string'):[])].map(searchKey);
        const duplicate=next.persons.find(p=>p.id!==row.id&&([p.name,...(p.aliases||[])].some(name=>incomingNames.includes(searchKey(name)))||(row.gmail&&normalized(p.gmail)===normalized(String(row.gmail)))));
        if(duplicate)throw new Error(`Identidad ambigua: ${String(row.name)}. Revisa el nombre o Gmail antes de importar.`);
      }
      const imported={...row};if(collection==='persons'&&imported.hearingStatus===undefined&&existing&&'hearingStatus' in existing)imported.hearingStatus=existing.hearingStatus;if(collection==='persons'&&imported.notificationEmail===undefined&&existing&&'notificationEmail' in existing)imported.notificationEmail=existing.notificationEmail;if(collection==='persons'&&existing)for(const key of ['appointment','regularPioneer'])if(imported[key]===undefined&&key in existing)imported[key]=(existing as unknown as Row&Record<string,unknown>)[key];if(existing?.revision!==undefined)imported.revision=existing.revision;else delete imported.revision;
      if(existing&&canonical(existing)===canonical(imported))continue;
      const list=next[collection] as Row[];if(existing){list[list.findIndex(r=>r.id===row.id)]=imported;updated++;}else{list.push(imported);added++;}
      total++;if(total>500)throw new Error('Revisa como máximo 500 registros en cada importación.');
    }
    if(added||updated)counts.push({collection,added,updated});
  }
  if(excluded)warnings.push(`${excluded} registros de Aparcamiento excluidos.`);
  if(!restore&&['grants','audit','publications','communications','notices'].some(k=>Array.isArray(raw[k])&&(raw[k] as unknown[]).length))warnings.push('Permisos, publicaciones, correos e histórico no se importan desde este formato.');
  if(restore)warnings.push('Se conservan los permisos, publicaciones, reuniones confirmadas, recordatorios e histórico actuales. No se eliminan registros.');
  if(!total)throw new Error(restore?'La copia coincide con los datos actuales.':'No hay registros que importar.');
  references(next);validateData(next);
  if(changesBetween(current,next).length>150)throw new Error('Selecciona un grupo más pequeño: hasta 150 registros, contando las congregaciones nuevas.');
  return {next,counts,warnings,historyCount:Array.isArray(raw.audit)?raw.audit.length:0,total,baseSignature:JSON.stringify(current)};
}
