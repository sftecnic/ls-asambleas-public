import {useId} from 'react';
import type {AppData,Congregation,Person} from '../domain/types';
import {congregationGroups,circuitValues} from '../domain/circuits';
export function CongregationOptions({rows}:{rows:Congregation[]}){return <>{congregationGroups(rows).map(group=><optgroup key={group.circuit} label={group.label}>{group.rows.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</>;}
export function AffiliationFields({data,person,onChange,disabled=false}:{data:AppData;person:Pick<Person,'congregationId'|'appointment'|'serviceCircuit'>;onChange:(patch:Partial<Person>)=>void;disabled?:boolean}){
 const id=useId();
 return person.appointment==='circuit-overseer'?<label className="team-field no-print">Circuito de servicio<input name="person-service-circuit" list={id} maxLength={160} placeholder="Sin indicar" disabled={disabled} value={person.serviceCircuit||''} onChange={e=>onChange({serviceCircuit:e.target.value})}/><datalist id={id}>{circuitValues(data).map(c=><option key={c} value={c}/>)}</datalist></label>:<label className="team-field">Congregación<select name="person-congregation" autoComplete="off" required value={person.congregationId} onChange={e=>onChange({congregationId:e.target.value})}><option value="">Seleccionar congregación</option><CongregationOptions rows={data.congregations}/></select></label>;
}
