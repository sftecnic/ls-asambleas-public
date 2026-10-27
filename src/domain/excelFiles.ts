import ExcelJS from 'exceljs';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import type {AppData} from './types';
import {EXCEL_VERSION,EXCEL_HEADER_ROW,EXCEL_MAX_BYTES,EXCEL_MAX_ROWS,excelSheets} from './excelSchema';
import {localParts,type ExcelInputRow,type ExcelIssue} from './excelImport';

export function compatibleExcelBuffer(buffer:ArrayBuffer){
 if(buffer.byteLength>EXCEL_MAX_BYTES)throw new Error('El Excel supera 5 MB. Divide el archivo.');
 const bytes=new Uint8Array(buffer);if(bytes[0]!==80||bytes[1]!==75)throw new Error('Usa un archivo .xlsx sin contraseña.');
 let size=0,count=0;
 const files=unzipSync(bytes,{filter:file=>{size+=file.originalSize;if(++count>200||file.originalSize>8_000_000||size>25_000_000)throw new Error('El Excel contiene demasiados datos. Divide el archivo.');if(/vbaProject|externalLinks|embeddings|activeX/i.test(file.name))throw new Error('No se admiten macros, objetos ni enlaces externos de libro.');return true;}});
 let normalized=false;
 const date1904=/\bdate1904=["'](?:1|true)["']/.test(strFromU8(files['xl/workbook.xml']||new Uint8Array()));
 for(const [name,content] of Object.entries(files)){if(!/\.(xml|rels)$/.test(name))continue;let xml=strFromU8(content);if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('El archivo contiene XML no permitido.');if(/sheetProtection|workbookProtection/.test(xml))throw new Error('Quita la protección del libro antes de importarlo.');if(/xl\/worksheets\//.test(name)&&(/<(?:[\w.-]+:)?f[\s/>]/.test(xml)))throw new Error('Convierte las fórmulas en valores antes de importar.');
  // ExcelJS expects unprefixed SpreadsheetML tags. Preserve relationships and values.
  const prefixes=[...xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/g)].map(m=>m[1]);
  for(const prefix of prefixes){const escaped=prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');xml=xml.replace(new RegExp(`(<\\/?)(?:${escaped}):`,'g'),'$1').replace(new RegExp(`xmlns:${escaped}=`,'g'),'xmlns=');normalized=true;}
  xml=xml.replace(/<c\b([^>]*\bt="d"[^>]*)>\s*<v>([^<]+)<\/v>\s*<\/c>/g,(_match,attrs:string,value:string)=>{const time=Date.parse(value);if(!Number.isFinite(time))throw new Error('Fecha ISO no válida en el Excel.');normalized=true;return `<c${attrs.replace(/\bt="d"/,'t="n"')}><v>${(time-(date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30)))/86400000}</v></c>`;});
  const relative=xml.replace(/Target="\/xl\/tables\/(table\d+\.xml)"/g,'Target="../tables/$1"');
  if(relative!==xml){normalized=true;xml=relative;}
  if(prefixes.length||relative!==strFromU8(content))files[name]=strToU8(xml);
 }
 if(!normalized)return buffer;const packed=zipSync(files,{level:0});return packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength) as ArrayBuffer;
}
export async function readExcel(buffer:ArrayBuffer):Promise<ExcelInputRow[]>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(compatibleExcelBuffer(buffer));const rows:ExcelInputRow[]=[];
 if(!book.worksheets.length)throw new Error('El libro está vacío.');
 for(const sheet of book.worksheets){const schema=excelSheets.find(s=>s.name===sheet.name);if(!schema){if(!['Guía','Listas'].includes(sheet.name))throw new Error(`Hoja desconocida: ${sheet.name}. Usa la plantilla.`);continue;}
  if(sheet.getCell('A1').text!==EXCEL_VERSION)throw new Error(`${sheet.name}: descarga la plantilla actual (versión 1).`);
  if(sheet.rowCount>EXCEL_MAX_ROWS+EXCEL_HEADER_ROW||sheet.columnCount>40)throw new Error('Máximo 1.000 filas por libro. Elimina las filas sobrantes.');
  const indexes=new Map<number,string>();const found=new Set<string>();
  sheet.getRow(EXCEL_HEADER_ROW).eachCell((cell,col)=>{const label=cell.text.replace(/\s*\*$/,'').trim();const field=schema.fields.find(f=>f.label===label);if(!field)throw new Error(`${sheet.name}: columna desconocida «${label}».`);if(found.has(field.key))throw new Error(`${sheet.name}: columna repetida «${label}».`);found.add(field.key);indexes.set(col,field.key);});
  for(const field of schema.fields)if(!found.has(field.key)&&!field.optionalColumn)throw new Error(`${sheet.name}: falta la columna «${field.label}».`);
  for(let n=EXCEL_HEADER_ROW+1;n<=sheet.rowCount;n++){const row=sheet.getRow(n),values:Record<string,string>={};let used=false;
   row.eachCell((cell,col)=>{const key=indexes.get(col);if(!key){if(cell.text.trim())throw new Error(`${sheet.name}, fila ${n}: datos fuera de las columnas de la plantilla.`);return;}
    const field=schema.fields.find(f=>f.key===key)!;let value=cell.value;
    if(value&&typeof value==='object'&&('formula' in value||'sharedFormula' in value))throw new Error(`${sheet.name}, fila ${n}: convierte las fórmulas en valores.`);
    let text='';if(value instanceof Date){text=field.kind==='time'?value.toISOString().slice(11,16):value.toISOString().slice(0,10);}
    else if(typeof value==='number'&&field.kind==='date'){const epoch=book.properties.date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30);text=new Date(epoch+Math.round(value*86400000)).toISOString().slice(0,10);}
    else if(typeof value==='number'&&field.kind==='time'){if(value<0||value>=1)throw new Error(`${sheet.name}, fila ${n}: indica una hora HH:mm.`);const mins=Math.round(value*1440);text=`${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;}
    else text=cell.text.trim();if(text.length>6000)throw new Error(`${sheet.name}, fila ${n}: una celda supera el tamaño permitido.`);
    if(text){used=true;values[key]=text;}
   });if(used){rows.push({sheet:sheet.name,row:n,values});if(rows.length>EXCEL_MAX_ROWS)throw new Error('Máximo 1.000 filas de datos por libro.');}
  }
 }if(!rows.length)throw new Error('No hay filas para importar. Rellena la plantilla desde la fila 5.');return rows;
}
function formatSheet(sheet:ExcelJS.Worksheet,columns:number){
 sheet.views=[{state:'frozen',xSplit:1,ySplit:4,showGridLines:false}];sheet.getRow(1).font={name:'Arial',size:12,color:{argb:'FF475569'}};sheet.getRow(2).font={name:'Arial',size:18,bold:true,color:{argb:'FF172B4D'}};sheet.getRow(2).height=32;
 sheet.getRow(4).height=48;sheet.getRow(4).eachCell(cell=>{cell.font={name:'Arial',size:12,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D4ED8'}};cell.alignment={vertical:'middle',wrapText:true};});
 for(let c=1;c<=columns;c++){sheet.getColumn(c).width=c===1?24:30;sheet.getColumn(c).numFmt='@';}
 sheet.autoFilter={from:{row:4,column:1},to:{row:Math.max(5,sheet.rowCount),column:columns}};
}
export async function exportExcel(data:AppData):Promise<ArrayBuffer>{
 const book=new ExcelJS.Workbook();book.creator='LS Asambleas';const guide=book.addWorksheet('Guía');guide.getColumn(1).width=110;
 [['Actualizar LS Asambleas'],['Conserva los códigos. Vacío conserva el dato anterior.'],['Alias y suplentes: separa los valores con punto y coma (;).'],['No concede accesos ni publica turnos. Revisa los cambios en la aplicación.'],['Guarda este archivo en privado: contiene contactos.']].forEach(r=>guide.addRow(r));
 for(const schema of excelSheets){const sheet=book.addWorksheet(schema.name);sheet.addRow([EXCEL_VERSION]);sheet.addRow([schema.name]);sheet.addRow(['* Obligatorio al añadir. Referencias mediante códigos.']);sheet.addRow(schema.fields.map(f=>f.label+(f.required?' *':'')));
  for(const raw of data[schema.collection]){const row=raw as unknown as Record<string,unknown>;const zone=data.events.find(e=>e.id===row.eventId)?.timezone||'Europe/Madrid';const parts=row.startsAt?localParts(String(row.startsAt),zone):undefined;
   const values=schema.fields.map(field=>{let value=row[field.key];if(field.key==='date')value=parts?.date;if(field.key==='start')value=parts?parts.time+parts.offset:'';if(field.key==='end'){const end=localParts(String(row.endsAt),zone);value=end.time+end.offset;}if(field.choices)value=Object.keys(field.choices).find(k=>field.choices![k]===String(value))||'';if(Array.isArray(value))return value.join('; ');if(field.kind==='date'&&value)return new Date(String(value)+'T00:00:00Z');return value===undefined?'':value as string|number|boolean;});sheet.addRow(values);
  }formatSheet(sheet,schema.fields.length);
  schema.fields.forEach((field,i)=>{if(field.kind==='date')sheet.getColumn(i+1).numFmt='dd/mm/yyyy';if(field.kind==='number')sheet.getColumn(i+1).numFmt='0';for(let n=5;n<=Math.max(104,sheet.rowCount);n++)if(field.choices)sheet.getCell(n,i+1).dataValidation={type:'list',allowBlank:true,formulae:['"'+Object.keys(field.choices).join(',')+'"'],showErrorMessage:true,errorTitle:'Elige un valor',error:'Usa la lista de opciones.'};});
 }return await book.xlsx.writeBuffer() as ArrayBuffer;
}
export async function exportIssues(issues:ExcelIssue[]):Promise<ArrayBuffer>{const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Revisión');sheet.addRow(['Hoja','Fila','Columna','Qué corregir']);issues.forEach(i=>sheet.addRow([i.sheet,i.row,i.column,i.message]));sheet.columns.forEach((c,i)=>c.width=i===3?90:25);return await book.xlsx.writeBuffer() as ArrayBuffer;}
