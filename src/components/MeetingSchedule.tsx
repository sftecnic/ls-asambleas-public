import {useEffect,useRef,useState,type ReactNode} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,List,Video,MapPin,UsersRound,Clock3} from 'lucide-react';
import {dateLabel,timeLabel} from '../domain/format';
import {groupMeetingDays,initialMeetingMonth,meetingDay,meetingMonthDays,shiftMeetingMonth,type MeetingScheduleRow} from '../domain/meetingSchedule';
import {useViewState} from './ViewState';
import {Empty} from './UI';
import '../styles/meeting-schedule.css';

const icons={zoom:Video,'in-person':MapPin,orientation:UsersRound};
const weekdays=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const fullDay=(day:string)=>dateLabel(day,{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});

export default function MeetingSchedule({rows,timezone,fallbackDate,scopeKey,showEvent=false,onOpen,renderRow}:{
  rows:MeetingScheduleRow[];timezone:string;fallbackDate:string;scopeKey:string;
  showEvent?:boolean;onOpen:(row:MeetingScheduleRow)=>void;
  renderRow:(row:MeetingScheduleRow,now:number,printing?:boolean)=>ReactNode;
}){
  const [view,setView]=useViewState<'month'|'list'>('meetings.view',()=>matchMedia('(min-width:1100px)').matches?'month':'list');
  const [months,setMonths]=useViewState<Record<string,string>>('meetings.months',{});
  const [days,setDays]=useViewState<Record<string,string>>('meetings.days',{});
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const month=months[scopeKey]||initialMeetingMonth(rows,fallbackDate,timezone,now),selectedDay=days[scopeKey]||'';
  const setMonth=(value:string)=>{setMonths(old=>({...old,[scopeKey]:value}));setDays(old=>({...old,[scopeKey]:''}));};
  const setDay=(value:string)=>setDays(old=>({...old,[scopeKey]:value}));
  const groups=groupMeetingDays(rows,timezone),dated=[...groups].filter(([day])=>day);
  const monthGroups=dated.filter(([day])=>day.startsWith(month));
  const visible=view==='list'?dated:monthGroups.filter(([day])=>!selectedDay||day===selectedDay);
  const today=meetingDay(new Date(now).toISOString(),timezone),cells=meetingMonthDays(month);
  const grid=useRef<HTMLTableElement>(null);
  function dayKey(event:React.KeyboardEvent<HTMLButtonElement>,day:string){
    const index=cells.indexOf(day),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
    let next=offset===undefined?index:index+offset;
    if(event.key==='Home')next=index-index%7;else if(event.key==='End')next=index+6-index%7;else if(offset===undefined)return;
    event.preventDefault();const target=cells[next];if(target)grid.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus();
  }
  const printGroups=groupMeetingDays(rows.filter(r=>r.pub),timezone);
  return <>
    <div className="meeting-browser no-print">
      <div className="meeting-view-toggle" role="group" aria-label="Vista de reuniones">
        <button className="btn" aria-pressed={view==='month'} onClick={()=>setView('month')}><CalendarDays size={22} aria-hidden="true"/>Mes</button>
        <button className="btn" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={22} aria-hidden="true"/>Lista</button>
      </div>
      {view==='month'&&<section aria-label="Calendario mensual" className="meeting-month">
        <div className="meeting-month-toolbar">
          <h2 aria-live="polite">{dateLabel(month+'-01',{month:'long',year:'numeric',timeZone:'UTC'})}</h2>
          <div className="actions"><button className="btn" aria-label="Mes anterior" onClick={()=>setMonth(shiftMeetingMonth(month,-1))}><ChevronLeft size={22} aria-hidden="true"/>Anterior</button><button className="btn" onClick={()=>setMonth(today.slice(0,7))}>Hoy</button><button className="btn" aria-label="Mes siguiente" onClick={()=>setMonth(shiftMeetingMonth(month,1))}>Siguiente<ChevronRight size={22} aria-hidden="true"/></button></div>
        </div>
        <table className="meeting-month-grid" ref={grid}>
          <caption className="sr-only">Reuniones de {dateLabel(month+'-01',{month:'long',year:'numeric',timeZone:'UTC'})}</caption>
          <thead><tr>{weekdays.map(day=><th scope="col" key={day}><abbr title={day}>{day.slice(0,3)}</abbr></th>)}</tr></thead>
          <tbody>{Array.from({length:cells.length/7},(_,week)=><tr key={week}>{cells.slice(week*7,week*7+7).map((day,column)=>{
            if(!day)return <td key={`empty-${column}`} className="meeting-day-empty"/>;
            const meetings=groups.get(day)||[],label=`${fullDay(day)} · ${meetings.length} ${meetings.length===1?'reunión':'reuniones'}`;
            return <td key={day} className={`${day===today?'meeting-day-today ':''}${day===selectedDay?'meeting-day-selected':''}`}>
              <button type="button" className="meeting-day-select" data-day={day} aria-label={label} aria-current={day===today?'date':undefined} aria-pressed={selectedDay===day} onClick={()=>setDay(selectedDay===day?'':day)} onKeyDown={e=>dayKey(e,day)}><span>{Number(day.slice(-2))}</span>{meetings.length>0&&<span className="meeting-day-count" aria-hidden="true">{meetings.length}</span>}</button>
              <div className="meeting-day-summary" aria-label={label}><span>{Number(day.slice(-2))}</span>{meetings.length>0&&<span className="meeting-day-count" aria-hidden="true">{meetings.length}</span>}</div>
              <div className="meeting-day-items">{meetings.slice(0,2).map(row=>{const Icon=icons[row.meeting.kind];return <button className="meeting-month-entry" key={row.key} onClick={()=>onOpen(row)} aria-label={`${fullDay(day)} · ${row.meeting.title} · ${timeLabel(row.meeting.startsAt,timezone)} · ${row.event.title}`}>
                <span><Icon size={18} aria-hidden="true"/><time dateTime={row.meeting.startsAt}>{timeLabel(row.meeting.startsAt,timezone)}</time></span><strong>{row.meeting.title}</strong><small className={row.pub?.status==='confirmed'?'meeting-month-confirmed':undefined}>{!row.pub?'Por confirmar':row.pub.status==='cancelled'?'Cancelada':'Confirmada'}</small>{showEvent&&<small>{row.event.title}{row.venue?.city?' · '+row.venue.city:''}</small>}
              </button>;})}{meetings.length>2&&<button className="meeting-day-more" onClick={()=>setDay(day)}>Ver {meetings.length} reuniones</button>}</div>
            </td>;
          })}</tr>)}</tbody>
        </table>
        <div className="meeting-month-list-heading"><h2>{selectedDay?'Día seleccionado':'Reuniones del mes'}</h2>{selectedDay&&<button className="btn" onClick={()=>setDay('')}>Todo el mes</button>}</div>
        {!monthGroups.length&&<Empty>No hay reuniones en este mes.</Empty>}
        {selectedDay&&!visible.length&&monthGroups.length>0&&<Empty>No hay reuniones este día.</Empty>}
      </section>}
      <div className="meeting-days">{visible.map(([day,items])=><section className="meeting-date-group" key={day} aria-label={fullDay(day)}><h2><CalendarDays size={23} aria-hidden="true"/>{fullDay(day)}</h2><div className="meeting-list">{items.map(row=>renderRow(row,now))}</div></section>)}</div>
      {!!groups.get('')?.length&&<section className="meeting-undated" aria-label="Sin fecha"><h2><Clock3 size={23} aria-hidden="true"/>Sin fecha</h2><div className="meeting-list">{groups.get('')!.map(row=>renderRow(row,now))}</div></section>}
      {!rows.length&&view==='list'&&<Empty>No hay reuniones con estos filtros.</Empty>}
    </div>
    <div className="meeting-print-list print-only">{[...printGroups].map(([day,items])=><section key={day}><h2>{day?fullDay(day):'Sin fecha'}</h2>{items.map(row=>renderRow({...row,draft:undefined},now,true))}</section>)}</div>
  </>;
}
