import type {AppData} from './types';
import type {ExcelInputRow,ExcelIssue} from './excelImport';
export function excelTask(kind:'read',value:ArrayBuffer):Promise<ExcelInputRow[]>;
export function excelTask(kind:'export',value:AppData):Promise<ArrayBuffer>;
export function excelTask(kind:'issues',value:ExcelIssue[]):Promise<ArrayBuffer>;
export function excelTask(kind:string,value:unknown):Promise<unknown>{return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./excel.worker.ts',import.meta.url),{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(new Error('El Excel tarda demasiado. Divide el archivo y vuelve a intentarlo.'));},15000);worker.onmessage=e=>{clearTimeout(timer);worker.terminate();if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.result);};worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('No se ha podido procesar el Excel. Comprueba el archivo.'));};worker.postMessage({kind,value});});}
export function downloadExcel(name:string,bytes:ArrayBuffer){const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
