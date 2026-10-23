import {describe,it,expect} from 'vitest';
import {createDemoData} from '../seed';
import {eventPeriod,historyEvents,historyChanges,personExperience} from './history';
import {profileStats,profileMatches,canReadProfile} from './personProfile';
import {makeOfflineCopy} from '../offline';
import {prepareImport,createBackup} from './adminImport';
import type {AppUser} from './types';
const admin:AppUser={uid:'demo-admin',email:'admin@example.test',name:'Elena Vidal',personId:'p-admin',role:'admin'};
const filters={year:'',eventId:'',departmentId:'',personId:'',query:''};
describe('Histórico y clasificación privada',()=>{
  it('agrupa por evento y departamento, incluye reservas y excluye propuestas pendientes',()=>{
    const data=createDemoData();data.events[1].archived=true;
    data.candidates.push({...data.candidates[0],id:'extra',eventId:'e2',personId:'p6',reserve:true});
    const result=historyEvents(data,admin,filters);
    expect(result.map(row=>row.event.id)).toEqual(['e1','e2']);
    expect(result.find(row=>row.event.id==='e1')?.departments.flatMap(d=>d.people).map(p=>p.personId)).not.toContain('p2');
    expect(result.find(row=>row.event.id==='e2')?.departments[0].people[0].candidates[0].reserve).toBe(true);
    expect(historyEvents(data,admin,{...filters,year:'2026'})).toEqual([]);
    expect(historyEvents(data,admin,{...filters,eventId:'e1',departmentId:'video',query:'Cámara'})[0].departments[0].people.map(p=>p.personId)).toEqual(['p1']);
  });
  it('distingue futuro, anterior y presencia real, sin contar turnos sustituidos',()=>{
    const data=createDemoData(),now=Date.parse('2027-04-11T20:00:00Z');
    expect(eventPeriod(data.events[0],Date.parse('2027-04-09T20:00:00Z'))).toBe('Próximo');
    expect(eventPeriod(data.events[0],Date.parse('2027-04-10T10:00:00Z'))).toBe('En curso');
    expect(personExperience(data,admin,'p1',now)).toEqual({assignedEvents:1,presentEvents:0});
    data.shifts[0].attendance='completed';expect(personExperience(data,admin,'p1',now).presentEvents).toBe(1);
    data.shifts[0].attendance='replaced';expect(personExperience(data,admin,'p1',now)).toEqual({assignedEvents:0,presentEvents:0});
  });
  it('limita participaciones, auditoría y clasificación según permisos vigentes',()=>{
    const data=createDemoData(),user={...admin,email:'scope@example.test',uid:'scope',role:'responsible' as const};
    data.grants.push({id:'scope',email:user.email,personId:user.personId,eventId:'e1',departmentId:'video',role:'responsible',capabilities:['view'],active:true});
    expect(historyEvents(data,user,filters).flatMap(e=>e.departments).every(d=>d.id==='video')).toBe(true);
    expect(historyChanges(data,user,filters)).toEqual([]);
    expect(canReadProfile(data,user,'p1')).toBe(false);
    expect(profileMatches(data,data.persons[1],{query:'',congregationId:'',hearingStatus:'unknown'},false)).toBe(false);
  });
  it('cuenta identidades únicas y distingue dato desconocido de perfil no autorizado',()=>{
    const data=createDemoData();data.persons[1].hearingStatus='deaf';data.persons[2].hearingStatus='hearing';
    expect(profileStats([data.persons[1],data.persons[1],data.persons[2],data.persons[3]],new Set(['p1','p3']))).toEqual({total:3,visible:2,deaf:1,hearing:0,unknown:1});
    expect(profileMatches(data,data.persons[1],{query:'lucia',congregationId:'c1',hearingStatus:'deaf'},true)).toBe(true);
  });
  it('no incluye clasificación en publicaciones ni copias offline, ni siquiera de administración',()=>{
    const data=createDemoData();data.persons.forEach(p=>p.hearingStatus='deaf');
    expect(JSON.stringify(makeOfflineCopy(data,admin,'e1'))).not.toContain('hearingStatus');
  });
  it('acepta copias antiguas y valida el campo opcional en importaciones',()=>{
    const data=createDemoData(),backup=structuredClone(createBackup(data));data.persons[0].name='Nombre cambiado';data.persons[0].hearingStatus='deaf';
    expect(prepareImport(JSON.stringify(backup),data,true).next.persons[0].hearingStatus).toBe('deaf');
    const bad=structuredClone(backup) as unknown as {data:{persons:{hearingStatus:string}[]}};bad.data.persons[0].hearingStatus='inventado';
    expect(()=>prepareImport(JSON.stringify(bad),data,true)).toThrow('Clasificación');
  });
});
