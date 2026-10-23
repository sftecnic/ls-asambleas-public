import {useId} from 'react';
import {CircleDashed,UserRoundCheck,UserRoundX,Replace} from 'lucide-react';
import type {Shift} from '../domain/types';
import {attendanceState,type EditableAttendance} from '../domain/attendance';
import {ErrorMessage} from './UI';

const options=[
  {value:'planned',label:'Sin marcar',Icon:CircleDashed},
  {value:'present',label:'Presente',Icon:UserRoundCheck},
  {value:'absent',label:'Ausente',Icon:UserRoundX},
] as const;

export function AttendanceSummary({value}:{value:Shift['attendance']}){
  const state=attendanceState(value);
  const selected=state==='replaced'?{label:'Sustituido',Icon:Replace}:options.find(option=>option.value===state)!;
  return <div className="attendance-readonly"><span className="attendance-label">Asistencia</span><span className={`attendance-status attendance-${state}`}><selected.Icon size={20} aria-hidden="true"/>{selected.label}</span></div>;
}

export function AttendanceControl({value,editable,saving,disabled,error,onSelect}:{
  value:Shift['attendance'];editable:boolean;saving:boolean;disabled:boolean;error?:string;
  onSelect:(value:EditableAttendance)=>void;
}){
  const labelId=useId(),state=attendanceState(value);
  const canChoose=editable&&state!=='replaced';
  return <>
    {canChoose&&<div className="attendance-control no-print">
      <div className="attendance-label" id={labelId}>Asistencia</div>
      <div className="attendance-options" role="group" aria-labelledby={labelId}>
        {options.map(({value:option,label,Icon})=><button key={option} type="button"
          className={`btn attendance-option attendance-${option}`} aria-pressed={state===option}
          aria-disabled={disabled||saving} onClick={()=>{if(!disabled&&!saving&&state!==option)onSelect(option);}}>
          <Icon size={20} aria-hidden="true"/>{label}
        </button>)}
      </div>
      <div className="attendance-feedback"><span role="status" aria-live="polite">{saving?'Guardando…':''}</span>{error&&<ErrorMessage message={error}/>}</div>
    </div>}
    <div className={canChoose?'print-only':undefined}><AttendanceSummary value={value}/></div>
  </>;
}
