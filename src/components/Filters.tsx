import {useId, useState, type ReactNode} from 'react';
import {SlidersHorizontal,X} from 'lucide-react';

export interface ActiveFilter {label:string;clear:()=>void}
/** Secondary filters remain disclosed while their active values stay visible. */
export default function Filters({children,active=[],onClear,label='Filtros'}:{children:ReactNode;active?:ActiveFilter[];onClear?:()=>void;label?:string}) {
  const [open,setOpen]=useState(false);
  const id=useId();
  return <div className="filter-disclosure no-print">
    <div className="filter-summary"><button type="button" className="btn" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}><SlidersHorizontal size={20} aria-hidden="true"/>{label}{active.length>0&&<span className="filter-count">{active.length}</span>}</button>
      {active.map(item=><button type="button" className="filter-chip" key={item.label} onClick={item.clear} aria-label={`Quitar filtro: ${item.label}`}>{item.label}<X size={16} aria-hidden="true"/></button>)}
      {active.length>0&&onClear&&<button type="button" className="btn btn-ghost" onClick={onClear}>Limpiar</button>}
    </div><div id={id} className="filter-fields" hidden={!open}>{children}</div>
  </div>;
}
