import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {readExcel,exportExcel,compatibleExcelBuffer} from '../src/domain/excelFiles';
import {prepareExcel} from '../src/domain/excelImport';
import {emptyData} from '../src/domain/types';
const buffer=async(path:string)=>{const b=await readFile(path);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
describe('Libro descargable y parser real',()=>{
 it('lee las ocho hojas del ejemplo y sus fechas reales',async()=>{const rows=await readExcel(await buffer('public/templates/ls-asambleas-ejemplo.xlsx'));expect(rows).toHaveLength(9);const plan=prepareExcel(rows,emptyData());expect(plan.issues).toEqual([]);expect(plan.next.events[0].startDate).toBe('2030-10-27');expect(plan.next.shifts[0].startsAt).toBe('2030-10-27T08:40:00.000Z');});
 it('exportar y reimportar conserva identificadores y valores',async()=>{const rows=await readExcel(await buffer('public/templates/ls-asambleas-ejemplo.xlsx')),data=prepareExcel(rows,emptyData()).next;const exported=await exportExcel(data);const again=prepareExcel(await readExcel(exported),data);expect(again.issues).toEqual([]);expect(again.records.every(r=>r.state==='same')).toBe(true);});
 it('conserva cabeceras, filtros, inmovilización y desplegables nativos',async()=>{const wb=new ExcelJS.Workbook();await wb.xlsx.load(compatibleExcelBuffer(await buffer('public/templates/ls-asambleas-plantilla.xlsx')));expect(wb.worksheets).toHaveLength(10);const persons=wb.getWorksheet('Personas')!;expect(persons.getCell('A4').text).toBe('Código *');expect(persons.views[0].state).toBe('frozen');expect(persons.getCell('I5').dataValidation.type).toBe('list');expect(persons.getTable('Datospersons')).toBeTruthy();await expect(readExcel(await buffer('public/templates/ls-asambleas-plantilla.xlsx'))).rejects.toThrow();});
 it('rechaza fórmulas, protección y archivos que no son libros',async()=>{const wb=new ExcelJS.Workbook();await wb.xlsx.load(compatibleExcelBuffer(await buffer('public/templates/ls-asambleas-ejemplo.xlsx')));wb.getWorksheet('Personas')!.getCell('B5').value={formula:'1+1',result:2};await expect(readExcel(await wb.xlsx.writeBuffer() as ArrayBuffer)).rejects.toThrow(/fórmula/i);await expect(readExcel(new TextEncoder().encode('archivo falso').buffer)).rejects.toThrow();});
});
