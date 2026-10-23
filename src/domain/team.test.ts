import { describe,it,expect } from 'vitest';
import {createDemoData} from '../seed';
import {groupPeople,teamView,teamRole} from './team';
import {can} from './rules';
import {createBackup,prepareImport} from './adminImport';

describe('people, roles and team counters',()=>{
  it('counts one person across departments and separates supervision',()=>{
    const data=createDemoData();
    data.candidates.push({...data.candidates[0],id:'second-department',departmentId:'platform'});
    data.candidates.push({...data.candidates[0],id:'supervisor-video',personId:'p-admin',teamRole:'supervisor'});
    data.candidates.push({...data.candidates.at(-1)!,id:'supervisor-platform',departmentId:'platform'});
    const view=teamView(data,'e1');
    expect(view.counts.all).toBe(6);expect(groupPeople(view.operational)).toHaveLength(6);
    expect(view.supervisors).toHaveLength(1);expect(view.supervisors[0].candidates).toHaveLength(2);
    expect(teamView(data,'e1','platform').counts.all).toBe(3);
    expect(teamView(data,'e2').counts.all).toBe(0);
  });
  it('searches canonical and alias names without accents, with scoped counts',()=>{
    const data=createDemoData();data.persons[1].aliases=['Lucía de Martín'];
    const view=teamView(data,'e1','video','lucia de martin');
    expect(view.counts.all).toBe(1);expect(view.counts.ready).toBe(1);
    expect(teamView(data,'e1','makeup','lucia').counts.all).toBe(0);
  });
  it('excludes supervisors from all approval and availability counters',()=>{
    const data=createDemoData();data.candidates.forEach(c=>{c.teamRole='supervisor';});
    expect(teamView(data,'e1').counts).toEqual({all:0,committee:0,availability:0,ready:0,reserve:0});
  });
  it('preserves legacy volunteers and grants no permissions through an operational role',()=>{
    const data=createDemoData(),user={uid:'demo-volunteer',email:'voluntario@example.test',personId:'p1',name:'Lucía',role:'volunteer' as const};
    expect(teamRole(data.candidates[0])).toBe('volunteer');data.candidates[0].teamRole='responsible';
    expect(can(user,data,'edit','e1','video')).toBe(false);expect(can(user,data,'manageAccess','e1','video')).toBe(false);
  });
  it('refuses ambiguous alias imports rather than creating a second identity',()=>{
    const data=createDemoData();data.persons[1].aliases=['Lucía de Martín'];
    const incoming={...data.persons[1],id:'duplicate',name:'Lucía de Martín',aliases:[]};
    expect(()=>prepareImport(JSON.stringify({format:'ls-asambleas',version:1,data:{persons:[incoming]}}),data)).toThrow('Identidad ambigua');
  });
  it('exports and restores aliases and roles without changing access permissions',()=>{
    const data=createDemoData(),incoming=structuredClone(data);
    incoming.persons[1].aliases=['Nombre anterior'];incoming.candidates[0].teamRole='assistant';
    const result=prepareImport(JSON.stringify(createBackup(incoming)),data,true);
    expect(result.next.persons[1].aliases).toEqual(['Nombre anterior']);expect(result.next.candidates[0].teamRole).toBe('assistant');expect(result.next.grants).toEqual(data.grants);
  });
});
