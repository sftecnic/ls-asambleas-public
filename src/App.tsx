import Brand from './components/Brand';
import {ViewStateProvider,clearViewState} from './components/ViewState';
import MeetingsPanel from './components/MeetingsPanel';
import {meetingServiceError} from './data/meetingApi';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarCheck, CalendarDays, Check, ChevronDown, Download, Home, LogIn, LogOut, MapPin, MoreHorizontal, Presentation, Printer, RefreshCw, Send, ShieldCheck, Users, WifiOff, X, Eye, CircleHelp } from 'lucide-react';
import { createRepository, configured } from './data/repository';
import { createDemoData } from './seed';
import { emptyData, type AppData, type AppUser, type PanelProps } from './domain/types';
import {ContactsProvider} from './components/PersonContact';
import { can,isAdmin } from './domain/rules';
import {excelDependencies} from './domain/excelImport';
import { dateLabel, timeLabel } from './domain/format';
import { publishedData, publishDepartment } from './domain/publication';
import { clearOfflineCopies, listOfflineCopies, saveOfflineCopy, type OfflineCopy } from './offline';
import { ErrorMessage, Modal, Status, Empty } from './components/UI';
import HomePanel from './components/HomePanel';
import {ToursProvider} from './components/DepartmentTours';
import {clearHomeScopes,type HomeIntent} from './domain/homeDashboard';
import TeamPanel from './components/TeamPanel';
import ShiftsPanel from './components/ShiftsPanel';
import ProgramPanel from './components/ProgramPanel';
import AdminPanel from './components/AdminPanel';

const repository = createRepository(configured ? undefined : createDemoData());
const demoVolunteer: AppUser = { uid: 'demo-volunteer', email: 'voluntario@example.test', name: 'Lucía Martín', personId: 'p1', role: 'volunteer' };

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Abriendo LS Asambleas…');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [eventId, setEventId] = useState(new URLSearchParams(location.search).get('evento') ?? '');
  const [page, setPage] = useState(routePage(new URLSearchParams(location.search)));
  const [historyPersonId,setHistoryPersonId]=useState('');
  const [homeIntent,setHomeIntent]=useState<HomeIntent>();
  const [previewVolunteer, setPreviewVolunteer] = useState(false);
  const [publishedView, setPublishedView] = useState(false);
  const [offlineCopy, setOfflineCopy] = useState<OfflineCopy | null>(null);
  const [savedCopy, setSavedCopy] = useState<OfflineCopy | null>(null);
  const [offlineModal, setOfflineModal] = useState(false);
  const [publishModal, setPublishModal] = useState(false);
  const [optionsOpen,setOptionsOpen]=useState(false);
  const [largeText,setLargeText]=useState(()=>{try{return localStorage.getItem('ls-large-text')==='true';}catch{return false;}});
  const navMemory=useRef(new Map<string,{search:string;scroll:number}>());
  const navIndex=useRef(Number(history.state?.lsIndex)||0);
  const restoringHistory=useRef(false),acceptedLocation=useRef(location.href);
  const [routeRevision,setRouteRevision]=useState(0);
  useEffect(()=>{document.documentElement.classList.toggle('large-text',largeText);try{localStorage.setItem('ls-large-text',String(largeText));}catch{}},[largeText]);
  useEffect(()=>{
    const root=document.documentElement;
    const observer=new ResizeObserver(()=>{
      root.style.setProperty('--context-height',`${document.querySelector('.event-context')?.getBoundingClientRect().height||0}px`);
      root.style.setProperty('--nav-height',`${document.querySelector('.main-nav')?.getBoundingClientRect().height||0}px`);
    });
    document.querySelectorAll('.event-context,.main-nav').forEach(el=>observer.observe(el));
    return()=>observer.disconnect();
  },[loading,user?.uid]);
  useEffect(()=>{
    const onPop=(ev:PopStateEvent)=>{
      // A rejected Back is restored by another popstate. Consume that restoration
      // without asking again or unmounting the editor that the user kept open.
      if(restoringHistory.current){restoringHistory.current=false;return;}
      const index=ev.state?.lsIndex??0;
      if(!window.dispatchEvent(new Event('ls:before-navigate',{cancelable:true}))){
        const delta=navIndex.current-index;
        if(delta){restoringHistory.current=true;history.go(delta);}
        else history.replaceState({...history.state,lsIndex:navIndex.current},'',acceptedLocation.current);
        return;
      }
      navIndex.current=index;
      acceptedLocation.current=location.href;
      const query=new URLSearchParams(location.search);
      setPage(routePage(query));setEventId(query.get('evento')||'');setHomeIntent(undefined);setHistoryPersonId('');setOptionsOpen(false);setRouteRevision(v=>v+1);
      requestAnimationFrame(()=>window.scrollTo({top:ev.state?.scroll||0}));
    };
    window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
  },[]);
  useEffect(()=>{
    const url=new URL(location.href);url.searchParams.set('pantalla',page);if(eventId)url.searchParams.set('evento',eventId);
    history.replaceState({...history.state,lsIndex:navIndex.current},'',url);
    acceptedLocation.current=url.href;
  },[page,eventId]);
  const [publishDepartmentId, setPublishDepartmentId] = useState('');
  const [personalDevice, setPersonalDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const writeInProgress = useRef(false);
  const currentData = useRef(data);
  currentData.current = data;
  const sessionUser = previewVolunteer && repository.mode === 'demo' ? demoVolunteer : user;
  const activeUser = useMemo(()=>sessionUser ? {...sessionUser,name:data.persons.find(p=>p.id===sessionUser.personId)?.name||sessionUser.name} : null,[sessionUser,data.persons]);
  const offline = !online;
  const sessionData = offline && offlineCopy ? offlineCopy.data : data;

  useEffect(() => {
    let alive = true;
    async function start() {
      try {
        if (!navigator.onLine) {
          const copies = await listOfflineCopies();
          const copy = copies.sort((a,b) => b.savedAt.localeCompare(a.savedAt))[0];
          if (copy && alive) { setOfflineCopy(copy); setSavedCopy(copy); setUser(copy.user); setEventId(copy.eventId); }
          return;
        }
        const logged = await repository.currentUser(phase => { if (alive) setLoadingStatus(phase); });
        if (!alive) return;
        if (logged) { setLoadingStatus('Cargando tus asambleas…'); const result = await repository.loadData(logged); if (alive) { setUser(logged); setData(result); } }
      } catch(e) { if (alive) setError((e as Error).message); } finally { if (alive) setLoading(false); }
    }
    void start(); return () => { alive = false; };
  }, []);

  useEffect(() => {
    const connect = () => setOnline(navigator.onLine);
    window.addEventListener('online', connect); window.addEventListener('offline', connect);
    return () => { window.removeEventListener('online', connect); window.removeEventListener('offline', connect); };
  }, []);
  useEffect(() => {
    if (!user || !online) return;
    return repository.subscribe(user, fresh => { setData(fresh); setError(''); }, e => { if (navigator.onLine) { setError(e.message); if (/retirado|permission|permisos|acceso|denied/i.test(e.message)) { clearViewState(); navMemory.current.clear(); setData(emptyData()); setUser(null); void clearOfflineCopies(); } } });
  }, [user?.uid, online]);
  useEffect(() => {
    if (!activeUser) return;
    void listOfflineCopies().then(copies => {
      const copy = copies.find(c => c.user.uid === activeUser.uid && c.eventId === eventId) ?? null;
      setSavedCopy(copy); if (!online) setOfflineCopy(copy);
    }).catch(() => {});
  }, [activeUser?.uid, eventId, online]);
  useEffect(() => {
    if (online && offlineCopy) {
      void repository.currentUser().then(async logged => {
        if (!logged) { clearViewState(); navMemory.current.clear(); setUser(null); setData(emptyData()); setOfflineCopy(null); return; }
        if (logged.uid !== offlineCopy.user.uid) await clearOfflineCopies();
        const fresh = await repository.loadData(logged);
        setUser(logged); setData(fresh); setOfflineCopy(null); setSuccess('Conexión recuperada. Información actualizada.');
      }).catch(e => setError((e as Error).message));
    }
  }, [online, offlineCopy?.id]);

  const allowedEvents = sessionData.events.filter(e => !e.archived && activeUser && (offlineCopy && offline || can(activeUser, sessionData, 'view', e.id) || sessionData.departments.some(d => can(activeUser, sessionData, 'view', e.id, d.id))));
  const event = allowedEvents.find(e => e.id === eventId) ?? allowedEvents[0];
  useEffect(() => { if (event && eventId !== event.id) setEventId(event.id); }, [event?.id, eventId]);
  const volunteer = activeUser?.role === 'volunteer' || offline;
  useEffect(()=>{if(volunteer&&['team','more',...(activeUser?.role==='volunteer'?['shifts']:[])].includes(page))setPage('home');},[volunteer,page,activeUser?.role]);
  const readOnly = volunteer || publishedView;
  const shown = useMemo(() => {
    if (!activeUser || !event) return sessionData;
    if (offline && offlineCopy) return offlineCopy.data;
    if (readOnly) return publishedData(sessionData, activeUser, event.id);
    const published = publishedData(sessionData, activeUser, event.id);
    return { ...sessionData, program: sessionData.program.length ? sessionData.program : published.program, plans: sessionData.plans.length ? sessionData.plans : published.plans };
  }, [sessionData, activeUser, event?.id, readOnly, offlineCopy, offline]);
  const publishable = event && activeUser && !readOnly ? data.departments.filter(d => can(activeUser, data, 'publish', event.id, d.id)) : [];
  const venue = sessionData.venues.find(v => v.id === event?.venueId);
  const latestPublications = event ? shown.publications.filter(p => p.eventId === event.id) : [];
  const publishedAt = [...latestPublications,...(shown.meetingPublications||[]).filter(m=>m.eventId===event?.id)].sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))[0]?.publishedAt;
  const printVersions=[...new Set(latestPublications.map(p=>p.departmentId))].map(departmentId=>latestPublications.filter(p=>p.departmentId===departmentId).sort((a,b)=>b.version-a.version)[0]);
  const allowNavigation = () => window.dispatchEvent(new Event('ls:before-navigate', { cancelable: true }));
  const navigate = (next: string,intent?:HomeIntent) => {
    if (!allowNavigation()) return;
    const key=`${activeUser?.uid}:${eventId}:`;
    navMemory.current.set(key+page,{search:location.search,scroll:window.scrollY});
    history.replaceState({...history.state,scroll:window.scrollY},'',location.href);
    const prior=navMemory.current.get(key+next),url=new URL(location.href);
    for(const field of ['departamento','dia','reunion','correo'])url.searchParams.delete(field);
    if(prior&&!intent){const params=new URLSearchParams(prior.search);for(const field of ['departamento','dia'])if(params.has(field))url.searchParams.set(field,params.get(field)!);}
    if(intent?.departmentIds.length===1)url.searchParams.set('departamento',intent.departmentIds[0]);
    url.searchParams.set('pantalla',next);
    history.pushState({lsIndex:++navIndex.current,scroll:prior?.scroll||0},'',url);
    setPage(next);setHomeIntent(intent);setHistoryPersonId('');setError('');setSuccess('');setOptionsOpen(false);setRouteRevision(v=>v+1);
    requestAnimationFrame(()=>window.scrollTo({top:intent?0:prior?.scroll||0}));
  };
  const change = async (next: AppData, description: string) => {
    if (!activeUser || !event || !online || !navigator.onLine || readOnly) throw new Error('Conecta a internet y abre la edición para guardar.');
    if (writeInProgress.current) throw new Error('Espera a que termine el guardado anterior.');
    writeInProgress.current = true; setBusy(true); setError('');
    try { const result = await repository.commit(data, next, description, activeUser, event.id); setData(result); setSuccess(description); } finally { writeInProgress.current = false; setBusy(false); }
  };
  const signIn = async () => { setBusy(true); setError(''); try { const logged = await repository.signIn(); const next = await repository.loadData(logged); setUser(logged); setData(next); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  const importOperations={
    refresh:async()=>{if(!activeUser||!isAdmin(activeUser,data)||!online||readOnly)throw new Error('Necesitas administración y conexión.');return repository.loadData(activeUser);},
    commit:async(before:AppData,next:AppData,description:string)=>{if(!activeUser||!isAdmin(activeUser,data)||!online||!navigator.onLine||readOnly||writeInProgress.current)throw new Error('Necesitas administración, conexión y ningún guardado pendiente.');writeInProgress.current=true;setPage('more');try{const result=await repository.commit(before,next,description,activeUser,'global',excelDependencies(before,next));setData(result);return result;}finally{writeInProgress.current=false;}}
  };
  const signOut = async () => { if (!allowNavigation()) return; try { await clearOfflineCopies(); await repository.signOut(); try{clearHomeScopes(sessionStorage);}catch{} clearViewState(); navMemory.current.clear(); setHomeIntent(undefined); setUser(null); setData(emptyData()); setOfflineCopy(null); setSavedCopy(null); setPreviewVolunteer(false); setPage('home'); setError(''); } catch(e) { setError((e as Error).message); } };
  const refresh = async () => { if (!user || !online) return; setBusy(true); try { setData(await repository.loadData(user)); setError(''); setSuccess('Información actualizada.'); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };

  if (loading) return <div className="login-layout"><div className="login-card"><Brand /><p role="status">{loadingStatus}</p></div></div>;
  if (!user) return <div className="login-layout"><div className="login-card"><Brand /><h1>Tu asamblea, en equipo.</h1><p className="small">Turnos, equipo y reuniones.</p><ErrorMessage message={error} />{repository.mode === 'demo' && <div className="message info">Demostración local con personas ficticias.</div>}<button className="btn btn-primary" disabled={busy || !online} onClick={() => void signIn()}><LogIn size={22} />{busy ? 'Entrando…' : repository.mode === 'demo' ? 'Abrir demostración' : 'Entrar con Google'}</button>{!online && <p>Sin conexión. No hay una copia guardada para consultar.</p>}<p className="small"><ShieldCheck size={18} style={{ verticalAlign: 'middle' }} /> Acceso solo para personas autorizadas.</p><a className="btn btn-ghost small" href="/privacidad.html">Privacidad</a></div></div>;
  const panelProps: PanelProps | null = event && activeUser ? { data: shown, event, user: activeUser, onChange: change, canEdit: !readOnly && online && (can(activeUser, data, 'edit', event.id) || data.departments.some(d => can(activeUser, data, 'edit', event.id, d.id))), canPublish: publishable.length > 0, online: online && !readOnly, onMeetingCommand:async command=>{if(!online||readOnly)throw new Error('Conecta a internet y abre la edición.');const result=await repository.meetingCommand(command,activeUser);setData(result);} } : null;
  const navigation = volunteer ? [{ id: 'home', label: 'Mis turnos', icon: CalendarCheck }, { id: 'program', label: 'Programa', icon: Presentation }, { id: 'notices', label: 'Avisos', icon: Bell }] : [{ id: 'home', label: 'Inicio', icon: Home }, { id: 'team', label: 'Equipo', icon: Users }, { id: 'shifts', label: 'Turnos', icon: CalendarDays }, { id: 'program', label: 'Programa', icon: Presentation }, { id: 'more', label: 'Más', icon: MoreHorizontal }];
  return <ContactsProvider data={sessionData} user={activeUser!} eventId={event?.id||''} online={online} demo={repository.mode==='demo'}><div className="app-shell"><a className="skip-link" href="#main">Saltar al contenido</a><aside className="sidebar"><Brand /><nav className="main-nav" aria-label="Principal">{navigation.map(n => <button key={n.id} className="nav-item" aria-current={page === n.id || page==='meetings'&&n.id==='program' ? 'page' : undefined} onClick={() => navigate(n.id)}><n.icon size={23} /><span>{n.label}</span></button>)}</nav><div className="account"><div className="account-name">{activeUser?.name}</div><small>{volunteer ? 'Voluntario' : activeUser?.role === 'admin' ? 'Administración' : activeUser?.role === 'assistant' ? 'Auxiliar' : 'Responsable'}</small><button className="btn btn-ghost" onClick={() => void signOut()}><LogOut size={20} />Salir</button></div></aside>
    <div className="workspace">{repository.mode === 'demo' && <div className="demo-banner" role="region" aria-label="Demostración"><span>Demostración · Datos ficticios · Guardado en este navegador</span><button className="btn btn-ghost" onClick={() => { if (!allowNavigation()) return; setPreviewVolunteer(!previewVolunteer); setPublishedView(false); setPage('home'); }}><Eye size={17} />{previewVolunteer ? 'Ver responsable' : 'Ver voluntario'}</button></div>}
      <header className="event-context"><div className="event-main"><div className="context-picker"><CalendarDays size={26} /><label className="field"><span>Evento</span><div className="event-select"><span className="event-select-value" aria-hidden="true">{event?.title||'Elegir evento'}<ChevronDown size={20}/></span><select aria-label="Elegir evento" value={event?.id ?? ''} onChange={e => { if (!allowNavigation()) return; const url=new URL(location.href);url.search='';url.searchParams.set('evento',e.target.value);url.searchParams.set('pantalla','home');history.pushState({lsIndex:++navIndex.current},'',url);setRouteRevision(v=>v+1);setEventId(e.target.value); setHomeIntent(undefined); setPage('home'); setSuccess(''); setError(''); }}>{allowedEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title} · {dateLabel(ev.startDate,{day:'numeric',month:'long',year:'numeric'})} · {sessionData.venues.find(v => v.id === ev.venueId)?.city ?? ''}</option>)}</select></div></label></div><div className="event-meta">{event && <span className="meta-item"><CalendarCheck size={18} />{dateLabel(event.startDate, { day: 'numeric', month: 'long', year: 'numeric' })}{event.endDate !== event.startDate ? ` – ${dateLabel(event.endDate, { day: 'numeric', month: 'long' })}` : ''}</span>}<span className="meta-item"><MapPin size={19} />{venue?.name} {venue?.city ? `· ${venue.city}` : ''}</span></div></div><div className="context-actions no-print"><button className="btn btn-ghost" onClick={()=>navigate('notices')}><Bell size={21} aria-hidden="true"/>Avisos</button><button className="btn" aria-expanded={optionsOpen} aria-controls="app-options" onClick={()=>setOptionsOpen(!optionsOpen)}><MoreHorizontal size={21} aria-hidden="true"/>Opciones</button></div></header>
      {optionsOpen&&<div id="app-options" className="app-options no-print"><div className="button-row">{online && <button className="btn" onClick={() => { setOfflineModal(true); setPersonalDevice(false); }}><Download size={20} />Guardar consulta</button>}<button className="btn" disabled={!latestPublications.length && !shown.meetingPublications?.length} onClick={() => { if (!allowNavigation()) return; setPublishedView(true); if (page === 'team' || page === 'more' || page === 'notices') setPage('program'); setTimeout(() => window.print(), 100); }}><Printer size={20} />Imprimir</button>{!volunteer && <button className="btn" aria-pressed={publishedView} onClick={() => { if (!allowNavigation()) return; setPublishedView(!publishedView); if (page === 'team' || page === 'more') setPage('program'); }}><Eye size={20} />{publishedView ? 'Ver borradores' : 'Ver publicado'}</button>}<button className="btn" aria-pressed={largeText} onClick={()=>setLargeText(!largeText)}><span aria-hidden="true" className="text-size-icon">Aa</span>Texto grande</button></div></div>}
      {offline && <div className="offline-banner"><span className="meta-item"><WifiOff size={22} />Sin conexión · Solo consulta</span>{offlineCopy && <span>Guardado: {dateLabel(offlineCopy.savedAt)} {timeLabel(offlineCopy.savedAt)} · {offlineCopy.version} · Puede estar desactualizado</span>}</div>}
      {publishedView && !volunteer && <div className="demo-banner"><span className="meta-item"><Eye size={20} />Vista publicada · Solo consulta</span><button className="btn" onClick={() => setPublishedView(false)}><PencilIcon />Volver a editar</button></div>}
      <main id="main" className="content" tabIndex={-1}><div className="print-only"><Brand compact/><strong>{event?.title} · {venue?.name} · {venue?.city}</strong><p>{event ? dateLabel(event.startDate) : ''} · Publicación: {publishedAt ? dateLabel(publishedAt) : 'Sin publicar'}</p>{printVersions.map(publication=><p key={publication.id}>{publication.department?.name||shown.departments.find(d=>d.id===publication.departmentId)?.name||'Departamento'} · Versión {publication.version} · {dateLabel(publication.publishedAt)} {timeLabel(publication.publishedAt,event?.timezone)}</p>)}<p>Versión vigente: {location.origin}/?evento={event?.id}</p></div>
        <ErrorMessage message={error} />{meetingServiceError&&<div className="message info" role="status">{meetingServiceError}</div>}{success && <div className="message no-print" role="status"><Check size={21} /><span style={{ flex: 1 }}>{success}</span><button className="btn btn-ghost" aria-label="Cerrar aviso" style={{ minHeight: 48, minWidth:48, padding: 3 }} onClick={() => setSuccess('')}><X size={20} /></button></div>}
        {busy && <p className="small no-print" role="status" style={{ marginBottom: 16 }}>Guardando…</p>}
        {!event ? <Empty>No tienes eventos asignados. Administración debe crear un evento o revisar tus permisos.</Empty> : offline && !offlineCopy ? <Empty>No hay una copia guardada de este evento. Conecta a internet para consultarlo.</Empty> : panelProps && <ViewStateProvider key={`${activeUser!.uid}:${event.id}:${readOnly}`} scope={`${activeUser!.uid}:${event.id}:${readOnly}`}>
          {(page==='shifts'||page==='program')&&publishable.length>0&&<div className="publication-action no-print"><button className="btn" disabled={!online||busy} onClick={()=>{const selected=new URLSearchParams(location.search).get('departamento');setPublishDepartmentId(publishable.find(d=>d.id===selected)?.id||publishable[0].id);setPublishModal(true);}}><Send size={20} aria-hidden="true"/>Publicar</button></div>}
          {page === 'home' && <ToursProvider key={`${activeUser!.uid}:${event.id}:${readOnly}`} eventId={event.id} user={activeUser!} data={sessionData} online={online} demo={!configured}><HomePanel {...panelProps} readOnly={readOnly} navigate={navigate} /></ToursProvider>}
          {page === 'team' && !volunteer && <TeamPanel key={`${event.id}:${routeRevision}:${JSON.stringify(homeIntent)}`} initialIntent={homeIntent} {...panelProps} onShowHistory={personId=>{if(!allowNavigation())return;navigate('more');setHistoryPersonId(personId);}} />}
          {page === 'shifts' && activeUser?.role !== 'volunteer' && <ShiftsPanel key={`${event.id}:${routeRevision}:${JSON.stringify(homeIntent)}`} initialIntent={homeIntent} {...panelProps} />}
          {(page==='program'||page==='meetings')&&<nav className="program-tabs no-print" aria-label="Programa y reuniones"><button className="btn" aria-pressed={page==='program'} onClick={()=>navigate('program')}><Presentation size={21}/>Programa</button><button className="btn" aria-pressed={page==='meetings'} onClick={()=>navigate('meetings')}><CalendarDays size={21}/>Reuniones</button></nav>}
          {page === 'program' && <ProgramPanel key={`${event.id}:${routeRevision}:${JSON.stringify(homeIntent)}`} initialIntent={homeIntent} {...panelProps} />}
          {page === 'meetings' && <MeetingsPanel key={`${event.id}:${routeRevision}:${JSON.stringify(homeIntent)}`} initialIntent={homeIntent} {...panelProps} />}
          {page === 'notices' && <Notices {...panelProps} readonly={offline || publishedView} onRead={async id => { if (!activeUser || !online) return; const next = structuredClone(data); next.notices = next.notices.map(n => n.id === id ? { ...n, readBy: [...new Set([...n.readBy, activeUser.uid])] } : n); const result = await repository.commit(data, next, 'Aviso leído', activeUser, event.id); setData(result); }} />}

          {savedCopy && online && <p className="small no-print">Copia guardada: {dateLabel(savedCopy.savedAt)}. {publishedAt && publishedAt > savedCopy.savedAt ? 'Hay cambios nuevos. Actualiza la copia.' : 'Solo contiene información publicada.'}</p>}
        </ViewStateProvider>}
        {activeUser&&!volunteer&&(page==='more'||!event&&activeUser.role==='admin')&&<ViewStateProvider key={activeUser.uid} scope={`${activeUser.uid}:admin`}><AdminPanel data={shown} user={activeUser} event={event||{id:'',title:'',type:'circuit',startDate:'',endDate:'',venueId:'',section:'',timezone:'Europe/Madrid',archived:false}} canEdit={!readOnly} canPublish={!readOnly} online={online&&!readOnly} onImport={importOperations} onChange={event?change:async(next,desc)=>{const result=await repository.commit(data,next,desc,activeUser,'global');setData(result);setPage('more');}} initialHistoryPersonId={historyPersonId} initialSection={new URLSearchParams(location.search).has('correo')||new URLSearchParams(location.search).has('calendario')?'sender':undefined}/></ViewStateProvider>}
      </main>
    </div>
    {offlineModal && event && activeUser && <Modal title="Guardar para consultar" onClose={() => setOfflineModal(false)}><div className="stack"><p>Se guardará la información publicada de este evento. Los contactos y correos quedan fuera de la copia.</p><label className="check"><input type="checkbox" checked={personalDevice} onChange={e => setPersonalDevice(e.target.checked)} />Este dispositivo es de uso personal</label><p className="small">La copia puede quedar desactualizada. Al cerrar sesión se eliminará de este navegador.</p></div><div className="modal-actions"><button className="btn btn-primary" disabled={!personalDevice || !online} onClick={async () => { try { const copy = await saveOfflineCopy(data, activeUser, event.id); setSavedCopy(copy); setSuccess('Consulta guardada para usar sin conexión.'); setOfflineModal(false); } catch(e) { setError((e as Error).message); setOfflineModal(false); } }}><Download size={20} />Guardar consulta</button></div></Modal>}
    {publishModal && event && activeUser && <Modal title="Publicar versión" onClose={() => setPublishModal(false)}><div className="stack"><label className="field">Departamento<select value={publishDepartmentId} onChange={e => setPublishDepartmentId(e.target.value)}>{publishable.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><div className="card"><strong>{data.shifts.filter(s => s.eventId === event.id && s.departmentId === publishDepartmentId).length} turnos</strong><p>{data.program.filter(p => p.eventId === event.id).length} intervenciones · {data.plans.filter(p => p.eventId === event.id).length} planos</p></div><p>Incluye los turnos del departamento, el programa común y sus planos.</p><p>El equipo verá esta versión y recibirá un aviso. Las versiones anteriores se conservarán.</p><ErrorMessage message={error} /></div><div className="modal-actions"><button className="btn" onClick={() => setPublishModal(false)}>Volver</button><button className="btn btn-primary" disabled={busy || !online} onClick={async () => { try { await change(publishDepartment(data, event, publishDepartmentId, activeUser), 'Publicada una nueva versión'); setPublishModal(false); } catch(e) { setError((e as Error).message); } }}><Send size={20} />Publicar</button></div></Modal>}
  </div></ContactsProvider>;
}

function PencilIcon() { return <RefreshCw size={18} />; }
function Notices({ data, event, user, readonly, onRead }: PanelProps & { readonly: boolean; onRead: (id: string) => Promise<void> }) {
  const [error, setError] = useState('');
  const notices = data.notices.filter(n => n.eventId === event.id && (!n.personId || n.personId === '*' || n.personId === user.personId) && (!n.departmentId || n.departmentId === '*' || user.role === 'admin' || data.grants.some(g => g.email === user.email && (g.departmentId === n.departmentId || g.departmentId === '*')) || readonly)).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  return <><div className="page-heading"><h1>Avisos</h1></div><ErrorMessage message={error} /><div className="stack">{notices.length ? notices.map(n => <article key={n.id} className={`card ${n.readBy.includes(user.uid) ? '' : 'notice-unread'}`}><div className="section-title"><h2>{n.title}</h2>{n.readBy.includes(user.uid) ? <Status kind="good">Leído</Status> : <Status kind="info">Nuevo</Status>}</div><p>{n.body}</p>{n.meetingId&&<a className="btn" href={`/?evento=${encodeURIComponent(n.eventId)}&reunion=${encodeURIComponent(n.meetingId)}`}>Ver reunión</a>}<p className="small" style={{ marginTop: 10 }}>{dateLabel(n.createdAt)} · {timeLabel(n.createdAt)}</p>{!readonly && !n.readBy.includes(user.uid) && <button className="btn" style={{ marginTop: 18 }} onClick={() => void onRead(n.id).catch(e => setError(e.message))}><Check size={20} />Marcar leído</button>}</article>) : <Empty>No hay avisos para este evento.</Empty>}</div></>;
}

function routePage(query:URLSearchParams){if(query.has('reunion'))return 'meetings';if(query.has('correo')||new URLSearchParams(location.search).has('calendario'))return 'more';const page=query.get('pantalla');return page&&['home','team','shifts','program','meetings','more','notices'].includes(page)?page:'home';}
