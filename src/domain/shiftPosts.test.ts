import {describe,it,expect} from 'vitest';
import {compareShiftPosts,shiftPost,shiftPostSuggestions,videoPosts} from './shiftPosts';
import {createDemoData} from '../seed';
import {makeOfflineCopy} from '../offline';

describe('Puestos y presentación de los turnos',()=>{
  it('reconoce alias, acentos, mayúsculas y numeración solo en Audio y vídeo',()=>{
    for(const role of ['Ordenador',' VIDEO ','víDEo'])expect(shiftPost('video',role)).toMatchObject({key:'video',label:'Vídeo',icon:'monitor'});
    expect(shiftPost('video','  ORDENADOR   2  ').label).toBe('Vídeo 2');
    expect(shiftPost('video','CAMARA 10')).toMatchObject({key:'camera',label:'Cámara 10',icon:'joystick'});
    expect(shiftPost('platform','Ordenador')).toMatchObject({key:'other',label:'Ordenador',icon:'department'});
    expect(shiftPost('new-department','Mesa')).toMatchObject({key:'other',label:'Mesa'});
    expect(shiftPost('video','Audio')).toMatchObject({key:'other',label:'Audio'});
    expect(shiftPost('video','Mesa de plataforma').key).toBe('other');
  });
  it('prioriza el puesto, después la hora y el identificador, sin usar a la persona',()=>{
    const base=createDemoData().shifts[0];
    const rows=[{...base,id:'camera',role:'Cámara',personId:'a',startsAt:'2027-04-10T06:00:00.000Z'},
      {...base,id:'video',role:'Ordenador',personId:'b'},
      {...base,id:'mesa-z',role:'Mesa',personId:'a'},
      {...base,id:'mesa-a',role:'Mesa',personId:'z'},
      {...base,id:'mesa-early',role:'Mesa',startsAt:'2027-04-10T07:00:00.000Z'},
      {...base,id:'director',role:'Director',personId:'z',startsAt:'2027-04-10T09:00:00.000Z'}];
    expect(rows.sort(compareShiftPosts).map(s=>s.id)).toEqual(['director','mesa-early','mesa-a','mesa-z','video','camera']);
  });
  it('mantiene el orden numérico y coloca después los puestos desconocidos por denominación',()=>{
    const base=createDemoData().shifts[0];
    const rows=['Cámara 10','Audio','Cámara 2','Otro puesto','Cámara'].map((role,i)=>({...base,id:String(i),role}));
    expect(rows.sort(compareShiftPosts).map(s=>s.role)).toEqual(['Cámara','Cámara 2','Cámara 10','Audio','Otro puesto']);
    const other=rows.map(s=>({...s,departmentId:'custom'}));
    expect(other.sort(compareShiftPosts).map(s=>s.role)).toEqual(['Audio','Cámara','Cámara 2','Cámara 10','Otro puesto']);
  });
  it('ofrece el catálogo ordenado y permite conservar los puestos propios de otros departamentos',()=>{
    const shifts=[{departmentId:'video',role:'Ordenador'},{departmentId:'video',role:'Cámara 2'},{departmentId:'custom',role:'Recepción'}];
    expect(shiftPostSuggestions('video',shifts)).toEqual(['Director','Mesa','Vídeo','Cámara','Cámara 2','Audio']);
    expect(shiftPostSuggestions('custom',shifts)).toEqual(['Recepción']);
    expect(shiftPostSuggestions('empty',shifts)).toEqual([]);
  });
  it('normaliza la vista sin modificar la publicación antigua ni su copia sin conexión',()=>{
    const data=createDemoData(),user={uid:'demo-admin',email:'admin@example.test',name:'Elena Vidal',personId:'p-admin',role:'admin' as const};
    data.publications[0].shifts[0].role='Ordenador';
    const before=JSON.stringify(data),copy=makeOfflineCopy(data,user,'e1');
    expect(shiftPost('video',copy.data.shifts[0].role).label).toBe('Vídeo');
    expect(copy.data.shifts[0].role).toBe('Ordenador');expect(JSON.stringify(data)).toBe(before);
  });
  it('mantiene contraste AA en los cuatro distintivos',()=>{
    const luminance=(hex:string)=>{
      const values=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
      return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;
    };
    for(const post of videoPosts)expect((luminance(post.background)+0.05)/(luminance(post.ink)+0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
