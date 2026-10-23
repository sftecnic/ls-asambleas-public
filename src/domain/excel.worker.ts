import {readExcel,exportExcel,exportIssues} from './excelFiles';
self.onmessage=async(event:MessageEvent)=>{try{const {kind,value}=event.data;const result=kind==='read'?await readExcel(value):kind==='issues'?await exportIssues(value):await exportExcel(value);self.postMessage({result});}catch(error){self.postMessage({error:error instanceof Error?error.message:'No se ha podido leer el Excel.'});}};
