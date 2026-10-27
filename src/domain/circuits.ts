import type {AppData,Congregation,Person} from './types';
export const circuitLabel=(value?:string)=>value?.trim()||'Sin indicar';
export const circuitRank=(value:string)=>value.endsWith('01B')?0:value.endsWith('01A')?1:value?2:3;
export const compareCircuits=(a:string,b:string)=>circuitRank(a)-circuitRank(b)||a.localeCompare(b,'es',{numeric:true});
export function congregationGroups(rows:Congregation[]){
 return [...new Set(rows.map(c=>c.circuit||''))].sort(compareCircuits).map(circuit=>({circuit,label:circuitLabel(circuit),rows:rows.filter(c=>(c.circuit||'')===circuit).sort((a,b)=>a.name.localeCompare(b.name,'es'))}));
}
export const personCircuit=(data:AppData,person:Person,privateVisible:boolean)=>privateVisible&&person.appointment==='circuit-overseer'?person.serviceCircuit||'':data.congregations.find(c=>c.id===person.congregationId)?.circuit||'';
export const affiliationLabel=(data:AppData,person:Person,privateVisible:boolean)=>privateVisible&&person.appointment==='circuit-overseer'?`Circuito: ${circuitLabel(person.serviceCircuit)}`:data.congregations.find(c=>c.id===person.congregationId)?.name||'Congregación sin indicar';
export const circuitValues=(data:Pick<AppData,'congregations'>&Partial<Pick<AppData,'persons'>>)=>[...new Set([...data.congregations.map(c=>c.circuit||''),...(data.persons||[]).filter(p=>p.appointment==='circuit-overseer').map(p=>p.serviceCircuit||'')].filter(Boolean))].sort(compareCircuits);
