import {describe,it,expect} from 'vitest';
import {createBackup,prepareImport} from './adminImport';
import {emptyData,type AppData} from './types';
const venue={id:'v1',name:'Sede',city:'Madrid',address:''};
describe('reviewed import',()=>{
  it('does not mutate the current directory during preview',()=>{const data=emptyData();const result=prepareImport(JSON.stringify(createBackup({...data,venues:[venue]})),data);expect(data.venues).toHaveLength(0);expect(result.next.venues).toHaveLength(1);});
  it('rejects duplicate identifiers rather than merging',()=>{const data={...emptyData(),venues:[venue]};expect(()=>prepareImport(JSON.stringify(createBackup(data)),data)).toThrow('ya existe');});
  it('conserves live revision during restoration and does not delete absent records',()=>{const data={...emptyData(),venues:[{...venue,revision:8},{...venue,id:'v2'}]};const backup={...emptyData(),venues:[{...venue,name:'Sede anterior',revision:2}]};const result=prepareImport(JSON.stringify(createBackup(backup)),data,true);expect(result.next.venues).toHaveLength(2);expect(result.next.venues[0].revision).toBe(8);});
  it('excludes parking and rejects unresolved references',()=>{const data=emptyData();const source:AppData={...data,departments:[{id:'parking',name:'Aparcamiento',icon:'other'},{id:'av',name:'Audio y vídeo',icon:'video'}]};const result=prepareImport(JSON.stringify(createBackup(source)),data);expect(result.next.departments).toHaveLength(1);expect(result.warnings.join()).toContain('excluidos');const invalid={...data,persons:[{id:'p1',name:'Persona',congregationId:'missing',phone:'',email:'',gmail:'',notes:''}]};expect(()=>prepareImport(JSON.stringify(createBackup(invalid)),data)).toThrow('referencia');});
  it('rejects malformed lists without exposing partially imported data',()=>{expect(()=>prepareImport(JSON.stringify({format:'ls-asambleas',version:1,data:{venues:'wrong'}}),emptyData())).toThrow('lista');});
  it('does not rewrite unchanged records on restore even when property order differs',()=>{const data={...emptyData(),venues:[{...venue,revision:4}]};const backup={...emptyData(),venues:[{revision:1,address:'',city:'Madrid',name:'Sede',id:'v1'}]};expect(()=>prepareImport(JSON.stringify(createBackup(backup)),data,true)).toThrow('coincide');});
});
