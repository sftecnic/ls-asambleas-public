import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {prepareExcel,type ExcelInputRow} from '../src/domain/excelImport';
import {readExcel,exportExcel,compatibleExcelBuffer} from '../src/domain/excelFiles';
import {createDemoData} from '../src/seed';
import {emptyData} from '../src/domain/types';
const workbook=async()=>{const b=await readFile('public/templates/ls-asambleas-ejemplo.xlsx');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
describe('servicio actual en Excel',()=>{
 it('señala conflictos en su fila sin reparar SC o cambiar datos existentes',()=>{
  const data=createDemoData(),row:ExcelInputRow={sheet:'Personas',row:5,values:{id:'p2',appointment:'Superintendente de circuito',regularPioneer:'Sí'}};
  const bad=prepareExcel([row],data);expect(bad.issues.some(i=>i.sheet==='Personas'&&i.row===5&&i.column.includes('Precursor'))).toBe(true);expect(bad.records[0].after).toMatchObject({appointment:'circuit-overseer',regularPioneer:'yes'});expect(data.persons[1].appointment).toBeUndefined();
  expect(prepareExcel([{...row,values:{...row.values,regularPioneer:'No aplica'}}],data,{['Personas:5']:{clear:['congregationId']}}).issues).toEqual([]);
 });
 it('las celdas vacías conservan valores y no completan personas antiguas',()=>{
  const data=createDemoData();Object.assign(data.persons.find(p=>p.id==='p2')!,{appointment:'elder',regularPioneer:'yes'});
  const plan=prepareExcel([{sheet:'Personas',row:5,values:{id:'p2',appointment:'',regularPioneer:''}},{sheet:'Personas',row:6,values:{id:'p3'}}],data);
  expect(plan.issues).toEqual([]);expect(plan.next.persons.find(p=>p.id==='p2')).toMatchObject({appointment:'elder',regularPioneer:'yes'});expect(plan.records.every(r=>!r.changes.includes('Nombramiento')&&!r.changes.includes('Precursor regular'))).toBe(true);expect(plan.next.persons.find(p=>p.id==='p3')!.appointment).toBeUndefined();expect(plan.next.persons.find(p=>p.id==='p3')!.regularPioneer).toBeUndefined();
 });
 it('acepta un libro anterior sin las dos columnas opcionales',async()=>{
  const book=new ExcelJS.Workbook();await book.xlsx.load(compatibleExcelBuffer(await workbook()));const people=book.getWorksheet('Personas')!;
  const columns:number[]=[];people.getRow(4).eachCell((cell,col)=>{if(['Nombramiento','Precursor regular'].includes(cell.text))columns.push(col);});for(const col of columns.sort((a,b)=>b-a))people.spliceColumns(col,1);
  const rows=await readExcel(await book.xlsx.writeBuffer() as ArrayBuffer),plan=prepareExcel(rows,emptyData());expect(plan.issues).toEqual([]);expect(plan.next.persons[0].appointment).toBeUndefined();
 },15000);
 it('exporta y reimporta servicio actual por código sin cambios',async()=>{
  const rows=await readExcel(await workbook()),data=prepareExcel(rows,emptyData()).next;data.persons[0].congregationId='';data.persons[0].appointment='circuit-overseer';data.persons[0].regularPioneer='not-applicable';
  const result=prepareExcel(await readExcel(await exportExcel(data)),data);expect(result.issues).toEqual([]);expect(result.records.every(r=>r.state==='same')).toBe(true);expect(result.next.persons[0]).toMatchObject({appointment:'circuit-overseer',regularPioneer:'not-applicable'});
 });
});
