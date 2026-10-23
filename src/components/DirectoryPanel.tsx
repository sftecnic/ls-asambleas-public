import FilterDisclosure from './Filters';
import {useViewState} from './ViewState';
import {useEffect,useRef,useState} from 'react';
import {History,Pencil,Search,UserPlus,Check} from 'lucide-react';
import type {PanelProps,Person} from '../domain/types';
import {can,isAdmin} from '../domain/rules';
import {isEmail} from '../domain/mail';
import {canReadProfile,profileMatches,type ProfileFilters as Filters} from '../domain/personProfile';
import {Empty,ErrorMessage,Modal} from './UI';
import {PersonFields,ProfileClassification,ProfileFilters,ProfileSummary} from './PersonProfile';

export default function DirectoryPanel({data,user,onChange,canEdit,online,onShowHistory}:PanelProps&{onShowHistory?:(id:string)=>void}){
  const [filters,setFilters]=useViewState<Filters>('directory.filters',{query:'',congregationId:'',hearingStatus:''});
  const [selectedId,setSelectedId]=useState(''),[draft,setDraft]=useState<Person>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const baseline=useRef('');
  const admin=isAdmin(user,data),authorizedIds=new Set(data.persons.filter(p=>canReadProfile(data,user,p.id)).map(p=>p.id));
  const people=data.persons.filter(p=>profileMatches(data,p,filters,authorizedIds.has(p.id))).sort((a,b)=>a.name.localeCompare(b.name,'es')||a.id.localeCompare(b.id));
  const selected=data.persons.find(p=>p.id===selectedId),privateVisible=selected&&authorizedIds.has(selected.id);
  const editable=canEdit&&online&&Boolean(admin||selected&&data.candidates.some(c=>c.personId===selected.id&&can(user,data,'contacts',c.eventId,c.departmentId)));
  const close=()=>{if(busy)return;if(draft&&JSON.stringify(draft)!==baseline.current&&!window.confirm('¿Descartar los cambios de la ficha?'))return;setDraft(undefined);setSelectedId('');setError('');};
  useEffect(()=>{const guard=(e:Event)=>{if(busy||draft&&JSON.stringify(draft)!==baseline.current&&!window.confirm('¿Descartar los cambios de la ficha?'))e.preventDefault();};const unload=(e:BeforeUnloadEvent)=>{if(busy||draft&&JSON.stringify(draft)!==baseline.current)e.preventDefault();};window.addEventListener('ls:before-navigate',guard);window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('ls:before-navigate',guard);window.removeEventListener('beforeunload',unload);};},[draft,busy]);
  function edit(person:Person){baseline.current=JSON.stringify(person);setDraft({...person});setError('');}
  async function save(){
    if(!draft||!online||!canEdit||busy||(!admin&&!editable))return;
    if(!draft.name.trim()||!draft.congregationId){setError('Completa nombre y congregación.');return;}
    if(draft.email&&!isEmail(draft.email)){setError('Revisa el correo de contacto.');return;}
    if(selected&&(selected.revision??0)!==(draft.revision??0)){setError('La ficha ha cambiado. Cierra y vuelve a abrirla antes de guardar.');return;}
    setBusy(true);setError('');
    try{const person={...draft,name:draft.name.trim(),email:draft.email.trim(),aliases:[...new Set((draft.aliases||[]).map(a=>a.trim()).filter(Boolean))]};await onChange({...data,persons:selected?data.persons.map(p=>p.id===person.id?person:p):[...data.persons,person]},selected?'Actualizó una ficha del directorio':'Añadió una persona al directorio');setDraft(undefined);setSelectedId('');}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}
  }
  return <div className="directory-panel">
    <div className="directory-tools"><label className="team-search"><Search size={21} aria-hidden="true"/><input type="search" name="directory-query" autoComplete="off" aria-label="Buscar en el directorio" placeholder="Nombre o congregación" value={filters.query} onChange={e=>setFilters({...filters,query:e.target.value})}/></label>{admin&&canEdit&&<button className="team-button team-button-primary" disabled={!online} onClick={()=>{setSelectedId('');edit({id:crypto.randomUUID(),name:'',congregationId:'',phone:'',email:'',gmail:'',notes:'',hearingStatus:'unknown'});}}><UserPlus size={20} aria-hidden="true"/>Añadir persona</button>}</div>
    <FilterDisclosure active={[
      ...(filters.congregationId?[{label:data.congregations.find(c=>c.id===filters.congregationId)?.name||'Congregación',clear:()=>setFilters({...filters,congregationId:''})}]:[]),
      ...(filters.hearingStatus?[{label:filters.hearingStatus==='deaf'?'Sorda':filters.hearingStatus==='hearing'?'Oyente':'Sin indicar',clear:()=>setFilters({...filters,hearingStatus:''})}]:[])
    ]} onClear={()=>setFilters({...filters,congregationId:'',hearingStatus:''})}><ProfileFilters data={data} value={filters} onChange={setFilters} canFilterPrivate={authorizedIds.size>0}/></FilterDisclosure>
    <ProfileSummary people={people} authorizedIds={authorizedIds}/>
    <p className="small directory-result" role="status">{people.length} personas del directorio</p>
    <div className="directory-list">{people.map(person=><article key={person.id}><div><h2>{person.name}</h2><p>{data.congregations.find(c=>c.id===person.congregationId)?.name||'Congregación sin indicar'}</p>{authorizedIds.has(person.id)&&<ProfileClassification person={person}/>}</div><button className="team-button" aria-label={`Ver ficha de ${person.name}`} onClick={()=>{setSelectedId(person.id);setDraft(undefined);setError('');}}>Ver ficha</button></article>)}</div>
    {!people.length&&<Empty>No hay personas con estos filtros.</Empty>}
    {(selected||draft)&&<Modal title={selected?.name||'Añadir persona'} onClose={close}>
      {draft?<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset className="profile-fieldset" disabled={busy}><PersonFields data={data} person={draft} onChange={setDraft}/></fieldset><ErrorMessage message={error}/><div className="modal-actions"><button type="button" className="btn" disabled={busy} onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={busy||!online}><Check size={20} aria-hidden="true"/>{busy?'Guardando…':'Guardar ficha'}</button></div></form>:selected&&<>
        <p>{data.congregations.find(c=>c.id===selected.congregationId)?.name||'Congregación sin indicar'}</p>
        {privateVisible&&<><ProfileClassification person={selected}/><dl className="team-contact-list"><div><dt>Teléfono</dt><dd>{selected.phone||'Sin indicar'}</dd></div><div><dt>Correo</dt><dd>{selected.email||'Sin indicar'}</dd></div>{selected.notes&&<div><dt>Notas privadas</dt><dd>{selected.notes}</dd></div>}</dl></>}
        <div className="modal-actions">{onShowHistory&&<button className="btn" onClick={()=>onShowHistory(selected.id)}><History size={20} aria-hidden="true"/>Ver trayectoria</button>}{editable&&<button className="btn btn-primary" onClick={()=>edit(selected)}><Pencil size={20} aria-hidden="true"/>Editar ficha</button>}</div>
      </>}
    </Modal>}
  </div>;
}
