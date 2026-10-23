import { describe, it, expect } from 'vitest';
import { createDemoData } from '../seed';
import { publishDepartment, publishedData } from './publication';
import { makeOfflineCopy } from '../offline';
import { fromLocalInput, toLocalInput } from './format';
import type { AppUser } from './types';
import { validateChange } from './rules';
import { isPublishedTeamMember, publicationTeam } from './team';
const admin: AppUser = { uid:'demo-admin', email:'admin@example.test', name:'Elena Vidal', personId:'p-admin', role:'admin' };
const volunteer: AppUser = { uid:'demo-volunteer', email:'voluntario@example.test', name:'Lucía Martín', personId:'p1', role:'volunteer' };
describe('Versiones publicadas y copia autorizada', () => {
  it('conserva la publicación antigua al editar un borrador y añade la nueva', () => {
    const data = createDemoData(); const old = structuredClone(data.publications);
    data.shifts[0] = { ...data.shifts[0], role:'Audio', status:'draft' };
    expect(publishedData(data,volunteer,'e1').shifts[0].role).toBe('Cámara');
    const next = publishDepartment(data,data.events[0],'video',admin);
    expect(next.publications.slice(0,3)).toEqual(old);
    expect(publishedData(next,volunteer,'e1').shifts[0].role).toBe('Audio');
    expect(publishedData(next,volunteer,'e1').shifts).toHaveLength(1);
  });
  it('elimina los contactos privados y registros de correo de la descarga', () => {
    const data = createDemoData(); data.persons[1].notes='PRIVADO';data.persons[1].phone='666123456';
    const copy=makeOfflineCopy(data,volunteer,'e1');
    const json=JSON.stringify(copy);
    expect(json).not.toContain('PRIVADO');expect(json).not.toContain('666123456');expect(json).not.toContain('orador@example.test');expect(json).not.toContain('comite-norte@example.test');
    expect(copy.data.communications).toEqual([]);expect(copy.data.grants).toEqual([]);expect(copy.data.candidates).toEqual([]);expect(copy.data.events).toHaveLength(1);
  });
  it('no permite descargar un evento sin publicar',()=>{const data=createDemoData();expect(()=>makeOfflineCopy(data,admin,'e2')).toThrow('publica');});
  it('no incluye publicaciones de departamentos ajenos',()=>{const data=createDemoData();const result=publishedData(data,volunteer,'e1');expect(result.publications.every(p=>p.departmentId==='video')).toBe(true);});
  it('conserva nombres y cargos por departamento sin contactos ni permisos',()=>{
    const data=createDemoData(),candidate=data.candidates[0];
    data.candidates[0].teamRole='assistant';
    data.candidates.push({...candidate,id:'leader',personId:'p-admin',teamRole:'responsible'},
      {...candidate,id:'supervisor',personId:'p3',teamRole:'supervisor'},
      {...candidate,id:'other-event',personId:'p4',eventId:'e2',teamRole:'responsible'});
    const next=publishDepartment(data,data.events[0],'video',admin),publication=next.publications.at(-1)!;
    validateChange(data,next,admin,'e1');
    expect(publication.team).toEqual([
      {personId:'p-admin',name:'Elena Vidal',role:'responsible'},
      {personId:'p1',name:'Lucía Martín',role:'assistant'},
      {personId:'p6',name:'Marcos León',role:'volunteer'},
    ]);
    const snapshot=structuredClone(publication.team);
    next.persons[0].name='Otro nombre';next.candidates[0].teamRole='volunteer';
    expect(publishedData(next,admin,'e1').publications.find(p=>p.id===publication.id)?.team).toEqual(snapshot);
    expect(Object.keys(publication.team![0]).sort()).toEqual(['name','personId','role']);
    expect(JSON.stringify(publication.team)).not.toContain('@');
    expect(data.publications.every(p=>p.team===undefined)).toBe(true);
  });
  it('rechaza equipos publicados mal formados y mantiene las versiones antiguas compatibles',()=>{
    const data=createDemoData(),next=publishDepartment(data,data.events[0],'video',admin),publication=next.publications.at(-1)!;
    const member=publication.team![0];
    expect(isPublishedTeamMember({...member,phone:'privado'})).toBe(false);
    expect(isPublishedTeamMember({...member,role:'admin'})).toBe(false);
    publication.team=[member,member];expect(()=>validateChange(data,next,admin,'e1')).toThrow('equipo publicado');
    expect(publicationTeam(data.publications[0])).toEqual([]);
  });
});
describe('Horario del evento',()=>{
  it('convierte Madrid en verano independientemente del dispositivo',()=>{expect(fromLocalInput('2027-04-10T10:00')).toBe('2027-04-10T08:00:00.000Z');});
  it('convierte Madrid en invierno y recupera hora local',()=>{expect(fromLocalInput('2027-01-10T10:00')).toBe('2027-01-10T09:00:00.000Z');expect(toLocalInput('2027-01-10T09:00:00.000Z')).toBe('2027-01-10T10:00');});
  it('rechaza la hora que no existe durante cambio horario',()=>{expect(()=>fromLocalInput('2027-03-28T02:30')).toThrow('no existe');});
});
