import {describe,it,expect} from 'vitest';
import {createDemoData} from '../src/seed';
import {appointmentOptions,pioneerOptions,serviceBadge,serviceError,selectAppointment} from '../src/domain/personService';
import {profileMatches,emptyProfileFilters,canReadProfile,canEditService} from '../src/domain/personProfile';
import {can,validateData,validateChange} from '../src/domain/rules';
import {publishedData} from '../src/domain/publication';
import {makeOfflineCopy} from '../src/offline';
import {leadershipContacts} from '../src/domain/whatsapp';
import type {AppUser} from '../src/domain/types';
import {createBackup,prepareImport} from '../src/domain/adminImport';

const admin:AppUser={uid:'demo-admin',email:'admin@example.test',name:'Elena Vidal',personId:'p-admin',role:'admin'};
const volunteer:AppUser={uid:'demo-volunteer',email:'voluntario@example.test',name:'Lucía Martín',personId:'p1',role:'volunteer'};
describe('servicio actual privado de personas',()=>{
 it('valida todas las combinaciones sin convertir ausencia en una respuesta negativa',()=>{
  expect(serviceError({})).toBe('');
  for(const [appointment] of appointmentOptions)for(const [regularPioneer] of pioneerOptions){const valid=appointment==='circuit-overseer'?regularPioneer==='not-applicable':regularPioneer!=='not-applicable';expect(serviceError({appointment,regularPioneer})==='').toBe(valid);}
  for(const bad of [{appointment:null},{appointment:'admin'},{regularPioneer:false},{regularPioneer:'PR'}])expect(serviceError(bad as any)).not.toBe('');
 });
 it('el formulario guarda SC y No aplica juntos y al salir de SC pide indicar el precursorado',()=>{
  const before={appointment:'elder' as const,regularPioneer:'yes' as const},patch=selectAppointment(before,'circuit-overseer');
  expect(patch).toEqual({appointment:'circuit-overseer',regularPioneer:'not-applicable',congregationId:''});expect(before).toEqual({appointment:'elder',regularPioneer:'yes'});
  expect(selectAppointment(patch,'ministerial-servant')).toEqual({appointment:'ministerial-servant',regularPioneer:'unknown'});
  expect(selectAppointment(before,'none')).toEqual({appointment:'none'});
 });
 it('agrupa solo condiciones registradas y nunca combina SC con otras siglas',()=>{
  expect(serviceBadge({})).toBe('');expect(serviceBadge({appointment:'none',regularPioneer:'no'})).toBe('');
  expect(serviceBadge({appointment:'elder',regularPioneer:'yes'})).toBe('A · PR');expect(serviceBadge({appointment:'ministerial-servant',regularPioneer:'yes'})).toBe('SM · PR');expect(serviceBadge({regularPioneer:'yes'})).toBe('PR');expect(serviceBadge({appointment:'circuit-overseer',regularPioneer:'not-applicable'})).toBe('SC');
 });
 it('los filtros actuales se combinan sin incluir SC en Ancianos ni revelar información sin permiso',()=>{
  const data=createDemoData(),p={...data.persons[1],appointment:'elder' as const,regularPioneer:'yes' as const};
  const filters={...emptyProfileFilters,appointment:'elder',regularPioneer:'yes',congregationId:p.congregationId};
  expect(profileMatches(data,p,filters,true)).toBe(true);expect(profileMatches(data,p,filters,false)).toBe(false);expect(profileMatches(data,{...p,appointment:'circuit-overseer',regularPioneer:'not-applicable'},filters,true)).toBe(false);
  expect(profileMatches(data,data.persons[1],{...emptyProfileFilters,appointment:'unknown'},true)).toBe(true);
 });
 it('no concede permisos, altera cargos ni permite combinaciones inválidas',()=>{
  const data=createDemoData(),next=structuredClone(data);next.persons[0].congregationId='';next.persons[0].appointment='circuit-overseer';next.persons[0].regularPioneer='not-applicable';
  expect(()=>validateData(next)).not.toThrow();expect(can(volunteer,next,'contacts','e1','video')).toBe(false);expect(next.grants).toEqual(data.grants);expect(next.candidates).toEqual(data.candidates);expect(()=>validateChange(data,next,volunteer,'e1')).toThrow();
  next.persons[0].regularPioneer='yes';expect(()=>validateData(next)).toThrow(/No aplica/);
 });
 it('excluye servicio de consulta publicada, copia offline y proyección de contactos del voluntario',()=>{
  const data=createDemoData();for(const p of data.persons){p.appointment='elder';p.regularPioneer='yes';}
  Object.assign(data.candidates[1],{teamRole:'responsible',committee:'approved',availability:'accepted'});const contacts=leadershipContacts(data,volunteer,'e1',{includeHearingStatus:true});expect(contacts.length).toBeGreaterThan(0);
  for(const value of [publishedData(data,admin,'e1'),makeOfflineCopy(data,admin,'e1'),contacts])expect(JSON.stringify(value)).not.toMatch(/appointment|regularPioneer/);
 });
 it('consultar no permite editar, y los permisos de evento/departamento se pueden combinar en el mismo ámbito',()=>{
  const data=createDemoData(),user:AppUser={uid:'manager',email:'manager@example.test',name:'Gestión ficticia',personId:'p-admin',role:'assistant'};
  data.grants.push({...data.grants[1],id:'manager-video',email:user.email,uid:user.uid,role:'assistant',capabilities:['view','contacts']});
  expect(canReadProfile(data,user,'p2')).toBe(true);expect(canEditService(data,user,'p2')).toBe(false);const next=structuredClone(data);next.persons[2].appointment='elder';next.persons[2].regularPioneer='yes';expect(()=>validateChange(data,next,user,'e1')).toThrow(/edición/);
  data.grants.push({...data.grants.at(-1)!,id:'manager-event',departmentId:'*',capabilities:['view','edit']});next.grants=structuredClone(data.grants);expect(canEditService(data,user,'p2')).toBe(true);expect(()=>validateChange(data,next,user,'e1')).not.toThrow();
 });
 it('conserva el servicio actual en respaldos y restauraciones administrativas, también con copias antiguas',()=>{
  const source=createDemoData();source.persons[2].appointment='elder';source.persons[2].regularPioneer='yes';
  const current=structuredClone(source);current.persons[2].appointment='none';current.persons[2].regularPioneer='no';
  const restored=prepareImport(JSON.stringify(createBackup(source)),current,true);expect(restored.next.persons[2]).toMatchObject({appointment:'elder',regularPioneer:'yes'});
  const legacy=structuredClone(source);delete legacy.persons[2].appointment;delete legacy.persons[2].regularPioneer;legacy.persons[2].name='Nombre corregido';
  expect(prepareImport(JSON.stringify(createBackup(legacy)),source,true).next.persons[2]).toMatchObject({appointment:'elder',regularPioneer:'yes',name:'Nombre corregido'});
 });
});
