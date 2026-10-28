import {describe, expect, it} from 'vitest';
import {createDemoData} from '../src/seed';
import type {AppUser} from '../src/domain/types';
import {accessEligibility, accessLabel, managementRole, permissionChanges, permissionInfo, permissionOrder} from '../src/domain/accessPresentation';
import {capabilities} from '../src/domain/rules';
const admin: AppUser = {uid:'demo-admin',email:'admin@example.test',name:'Elena',personId:'p-admin',role:'admin'};
describe('Presentación de permisos sin modificar su autoridad', () => {
  it('describe las seis capacidades existentes, incluidos contactos editables y convocatorias', () => {
    expect([...permissionOrder].sort()).toEqual([...capabilities].sort());
    expect(permissionInfo.contacts.description).toContain('modificar');
    expect(permissionInfo.publish.detail).toContain('Calendar');
    expect(permissionInfo.manageAccess.detail).toContain('No concede administración general');
  });
  it('separa cargos y acceso y conserva el rol legado de gestión', () => {
    expect(accessLabel('assistant')).toBe('Gestión'); expect(accessLabel('responsible')).toBe('Gestión');
    expect(accessLabel('volunteer')).toBe('Consulta'); expect(managementRole()).toBe('assistant');
    expect(managementRole({...createDemoData().grants[1],role:'responsible'})).toBe('responsible');
  });
  it('revisa cambios por capacidad, no por orden ni duplicados', () => {
    expect(permissionChanges(['view','assign','contacts'],['view','edit'])).toEqual({added:['edit'],removed:['assign','contacts']});
    expect(permissionChanges(['assign','view'],['view','assign'])).toEqual({added:[],removed:[]});
  });
  it('distingue Gmail privado inaccesible de dato incompleto', () => {
    const data=createDemoData(); data.grants[0]={...data.grants[0],eventId:'e1',departmentId:'video',role:'assistant',capabilities:['view','manageAccess']};
    expect(accessEligibility(data,admin,'p6','e1','video').join(' ')).toContain('No puedes consultar');
    data.grants[0].capabilities.push('contacts');
    expect(accessEligibility(data,admin,'p6','e1','video').join(' ')).toContain('Falta un Gmail válido');
  });
  it('muestra comité y aceptación por separado y detecta acceso ya existente', () => {
    const data=createDemoData();
    expect(accessEligibility(data,admin,'p2','e1','video')).toEqual(['Falta la aprobación del comité.','El voluntario debe aceptar la participación.','Falta un Gmail válido. Complétalo en la ficha de la persona.']);
    expect(accessEligibility(data,admin,'p1','e1','video').join(' ')).toContain('ya tiene un acceso');
    expect(accessEligibility(data,admin,'p1','e1','video',false,data.grants[1])).toEqual([]);
  });
  it('una reactivación vuelve a comprobar candidatura y Gmail sin atribuirle datos privados ausentes', () => {
    const data=createDemoData(),grant={...data.grants[1],active:false}; data.candidates[0].availability='unknown';
    expect(accessEligibility(data,admin,'p1','e1','video',false,grant).join(' ')).toContain('debe aceptar');
  });
  it('preserva cuentas generales sin ficha de voluntario', () => {
    const data=createDemoData(),grant={...data.grants[0],personId:'institutional-account',active:false};
    expect(accessEligibility(data,admin,grant.personId,'*','*',true,grant)).toEqual([]);
  });
});
