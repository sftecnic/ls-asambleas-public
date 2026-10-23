import {useEffect,useRef,useState} from 'react';
import type {KeyboardEvent,MouseEvent,ReactNode,RefObject} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,Armchair,Check,ChevronLeft,ChevronRight,Copy,Eye,LayoutTemplate,Maximize2,Minimize2,Move,PanelTop,Plus,Printer,Redo2,Save,Table2,Trash2,Undo2,UserRound,UsersRound,Video,WifiOff,X,ZoomIn,ZoomOut,TriangleAlert,Pencil} from 'lucide-react';
import type {StageElement,StageMoment,StagePlan,VenueTemplate} from '../domain/types';
import {copyVenueTemplateElements,createStageElement,createStageMoment,duplicateStageMoment,moveStageElement,normalizeStagePlan,stageTemplates,templateElements} from '../domain/stage';
import type {StageTemplate} from '../domain/stage';
import {Modal,ErrorMessage} from './UI';
import '../styles/stage.css';

export interface StageEditorProps {
  plan:StagePlan;onSave:(plan:StagePlan)=>Promise<void>;onClose:()=>void;
  canEdit:boolean;canPublish:boolean;online:boolean;published?:StagePlan;
  eventLabel?:string;venueLabel?:string;templates?:VenueTemplate[];onSaveTemplate?:(template:VenueTemplate)=>Promise<void>;
}

function Label({text,y=88}:{text:string;y?:number}){
  const words=text.trim().split(/\s+/).flatMap(word=>word.match(/.{1,19}/g)||[]);const lines:string[]=[''];
  words.forEach(word=>{const i=lines.length-1;if((lines[i]+' '+word).trim().length>19&&lines[i])lines.push(word);else lines[i]=(lines[i]+' '+word).trim();});
  return <g className="stage-object-name"><rect x={-112} y={y-22} width={224} height={Math.max(1,lines.length)*25+8} rx={9}/><text textAnchor="middle" y={y}>{lines.map((line,i)=><tspan key={i} x="0" dy={i===0?0:25}>{line}</tspan>)}</text></g>;
}

function ObjectGlyph({element,selected=false,mini=false}:{element:StageElement;selected?:boolean;mini?:boolean}){
  const seated=element.posture==='sitting';
  const side=element.facing==='left'?-1:element.facing==='right'?1:0;
  return <>
    {selected&&<rect className="stage-selection" x={-100} y={-85} width={200} height={190} rx={20}/>}
    {element.kind==='person'&&<g className="stage-person">
      {seated&&<path className="stage-seat-under" d="M-33-8v60h68v-60M-25 52v22M27 52v22"/>}
      <circle className="stage-head" cx={side*5} cy={-47} r={22}/>
      <path className="stage-person-body" d={seated?'M-24-14Q0-28 24-14L28 28Q0 43-28 28Z':'M-24-14Q0-28 24-14L30 32H-30Z'}/>
      <path className="stage-limbs" d={seated?'M-24-10L-40 14L-25 29M24-10L40 14L25 29M-18 34L-37 48V65M18 34L37 48V65':'M-24-9L-42 29M24-9L42 29M-17 32L-21 67M17 32L21 67'}/>
      <path className="stage-face-direction" d={side===0?'M-7-44q7 5 14 0':side<0?'M-14-48l-8 5 8 4':'M14-48l8 5-8 4'}/>
      {element.movement==='enter'&&<g className="stage-movement"><path d="M-130 20H-67l-15-12m15 12-15 12"/><text x={-110} y={-2} textAnchor="middle">Entra</text></g>}
      {element.movement==='exit'&&<g className="stage-movement"><path d="M65 20h63l-15-12m15 12-15 12"/><text x={107} y={-2} textAnchor="middle">Sale</text></g>}
    </g>}
    {element.kind==='table'&&<g className="stage-furniture"><rect x={-92} y={-26} width={184} height={58} rx={12}/><path d="M-72 32v35M72 32v35"/></g>}
    {element.kind==='chair'&&<g className="stage-furniture"><rect x={-34} y={-45} width={68} height={60} rx={12}/><path d="M-34 15h68v20h-68zM-27 35v32M27 35v32"/></g>}
    {element.kind==='lectern'&&<g className="stage-furniture stage-lectern"><path d="M-50-41h100l-12 42h-76zM0 1v57M-36 58h72"/><path d="M-29-28h58"/></g>}
    {!mini&&<Label text={element.label}/>}
  </>;
}

export function StageScene({moment,selectedId,onSelect,onMove,onKeyboard,interactive=false,mini=false,svgRef}:{moment:StageMoment;selectedId?:string;onSelect?:(id:string)=>void;onMove?:(event:MouseEvent<SVGSVGElement>)=>void;onKeyboard?:(event:KeyboardEvent<SVGGElement>,el:StageElement)=>void;interactive?:boolean;mini?:boolean;svgRef?:RefObject<SVGSVGElement|null>}){
  return <svg ref={svgRef} className={`stage-scene${mini?' stage-scene-mini':''}`} viewBox="0 0 1000 560" role={interactive?'group':'img'} aria-label={`${moment.title}. Vista desde el público. ${moment.elements.filter(x=>x.kind==='person').map(x=>`${x.label}, ${x.posture==='sitting'?'sentado':'de pie'}`).join('. ')}`} onClick={onMove}>
    <rect className="stage-floor" x="20" y="30" width="960" height="470" rx="24"/>
    <path className="stage-floor-guide" d="M340 110v330M660 110v330"/>
    {!mini&&<g className="stage-zone-label"><text x="180" y="77" textAnchor="middle">Zona izquierda</text><text x="500" y="77" textAnchor="middle">Centro</text><text x="820" y="77" textAnchor="middle">Zona derecha</text></g>}
    {[...moment.elements].sort((a,b)=>(a.kind==='person'?1:0)-(b.kind==='person'?1:0)).map(el=><g key={el.id} transform={`translate(${el.x}, ${el.y})`} className={`stage-object${interactive?' stage-object-interactive':''}`} role={interactive?'button':undefined} tabIndex={interactive?0:undefined} aria-label={interactive?`${el.label}, ${el.kind==='person'?(el.posture==='sitting'?'sentado':'de pie'):'mobiliario'}`:undefined} aria-pressed={interactive?selectedId===el.id:undefined} onKeyDown={event=>onKeyboard?.(event,el)} onClick={event=>{if(onSelect){event.stopPropagation();onSelect(el.id);}}}>
      {interactive&&<rect className="stage-object-hit" x="-93" y="-82" width="186" height="190" rx="14"/>}
      <ObjectGlyph element={el} selected={selectedId===el.id} mini={mini}/>
      {!mini&&<g className="stage-object-index" aria-hidden="true"><circle cy="94" r="34"/><text y="111" textAnchor="middle">{moment.elements.findIndex(item=>item.id===el.id)+1}</text></g>}
    </g>)}
    <path className="stage-front" d="M180 499H820"/>
    <text className="stage-audience" x="500" y="542" textAnchor="middle">PÚBLICO</text>
  </svg>;
}

function StageButton({children,onClick,disabled=false,primary=false,label,pressed}:{children:ReactNode;onClick:()=>void;disabled?:boolean;primary?:boolean;label?:string;pressed?:boolean}){
  return <button type="button" className={`stage-button${primary?' stage-button-primary':''}`} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={pressed}>{children}</button>;
}

export function StageEditor({plan,onSave,onClose,canEdit,online,published,eventLabel,venueLabel,templates=[],onSaveTemplate}:StageEditorProps){
  const [working,setWorking]=useState(()=>normalizeStagePlan(plan));
  const [momentIndex,setMomentIndex]=useState(0);
  const [selectedId,setSelectedId]=useState<string>();
  const [moving,setMoving]=useState(false);
  const [showTemplates,setShowTemplates]=useState(plan.moments.length===0||plan.moments.every(m=>m.elements.length===0));
  const [view,setView]=useState<'edit'|'review'|'published'>(canEdit?'edit':'published');
  const [undo,setUndo]=useState<StagePlan[]>([]);
  const [redo,setRedo]=useState<StagePlan[]>([]);
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const [remoteChanged,setRemoteChanged]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [zoom,setZoom]=useState(1);
  const [expanded,setExpanded]=useState(false);
  const expandButton=useRef<HTMLButtonElement>(null);
  const mobileActions=useRef<HTMLDivElement>(null);
  const stageHeader=useRef<HTMLElement>(null);
  useEffect(()=>{
    const header=stageHeader.current;if(!header)return;
    const observer=new ResizeObserver(()=>document.documentElement.style.setProperty('--stage-header-height',`${header.getBoundingClientRect().height}px`));
    observer.observe(header);return()=>{observer.disconnect();document.documentElement.style.removeProperty('--stage-header-height');};
  },[]);
  useEffect(()=>{
    const actions=mobileActions.current;if(!actions)return;
    const observer=new ResizeObserver(()=>document.documentElement.style.setProperty('--stage-actions-height',`${actions.getBoundingClientRect().height}px`));
    observer.observe(actions);return()=>{observer.disconnect();document.documentElement.style.removeProperty('--stage-actions-height');};
  },[view]);
  useEffect(()=>{
    document.documentElement.classList.toggle('stage-expanded',expanded);
    const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){setExpanded(false);expandButton.current?.focus();}};
    if(expanded)window.addEventListener('keydown',escape);
    return()=>{document.documentElement.classList.remove('stage-expanded');window.removeEventListener('keydown',escape);};
  },[expanded]);
  const [fit,setFit]=useState(()=>window.matchMedia('(max-width:1120px)').matches);
  const [templateDialog,setTemplateDialog]=useState(false),[templateName,setTemplateName]=useState(''),[templateTarget,setTemplateTarget]=useState(''),[templateBusy,setTemplateBusy]=useState(false),[templateError,setTemplateError]=useState('');
  const signature=useRef(JSON.stringify(plan));
  const svgRef=useRef<SVGSVGElement>(null);
  const publishedPlan=published||(plan.status==='published'?plan:undefined);
  const activePlan=view==='published'?publishedPlan:working;
  const currentIndex=Math.min(momentIndex,Math.max(0,(activePlan?.moments.length??1)-1));
  const moment=activePlan?.moments[currentIndex];
  const selected=moment?.elements.find(el=>el.id===selectedId);
  const editable=canEdit&&online&&!saving&&!remoteChanged&&view==='edit';

  useEffect(()=>{if(!canEdit){setView('published');setSelectedId(undefined);setMoving(false);}},[canEdit]);
  useEffect(()=>{
    const next=JSON.stringify(plan);
    if(next===signature.current)return;
    signature.current=next;
    if(dirty&&!saving){setRemoteChanged(true);return;}
    setWorking(normalizeStagePlan(plan));setUndo([]);setRedo([]);setDirty(false);setRemoteChanged(false);
  },[plan,dirty,saving]);
  useEffect(()=>{
    if(!dirty)return;
    const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const navigate=(event:Event)=>{if(!window.confirm('Hay cambios sin guardar en el plano. ¿Descartarlos y salir?'))event.preventDefault();};
    window.addEventListener('beforeunload',guard);window.addEventListener('ls:before-navigate',navigate);
    return()=>{window.removeEventListener('beforeunload',guard);window.removeEventListener('ls:before-navigate',navigate);};
  },[dirty]);

  function update(next:StagePlan){
    if(!editable)return;
    setUndo(prev=>[...prev,structuredClone(working)].slice(-60));setRedo([]);
    setWorking({...next,status:'draft'});setDirty(true);setError('');setMessage('');
  }
  function updateMoment(patch:Partial<StageMoment>){update({...working,moments:working.moments.map((m,i)=>i===currentIndex?{...m,...patch}:m)});}
  function updateElement(patch:Partial<StageElement>){if(selected)updateMoment({elements:moment!.elements.map(el=>el.id===selected.id?{...el,...patch}:el)});}
  function moveBy(dx:number,dy:number){if(!selected||!editable)return;const moved=moveStageElement(selected,selected.x+dx,selected.y+dy);updateElement({x:moved.x,y:moved.y});}
  function undoChange(){const previous=undo.at(-1);if(!previous||!editable)return;setRedo(p=>[...p,working]);setWorking(previous);setUndo(p=>p.slice(0,-1));setDirty(true);setSelectedId(undefined);setMoving(false);}
  function redoChange(){const next=redo.at(-1);if(!next||!editable)return;setUndo(p=>[...p,working]);setWorking(next);setRedo(p=>p.slice(0,-1));setDirty(true);setSelectedId(undefined);setMoving(false);}
  function addElement(kind:StageElement['kind']){if(!moment)return;const count=moment.elements.filter(el=>el.kind===kind).length;const el=createStageElement(kind,400+(count%3)*130,240+Math.floor(count/3)*45);if(kind==='person')el.label=`Persona ${count+1}`;updateMoment({elements:[...moment.elements,el]});setSelectedId(el.id);setMoving(true);}
  function applyTemplate(template:StageTemplate){updateMoment({elements:templateElements(template)});setSelectedId(undefined);setShowTemplates(false);setMoving(false);}
  function applyVenueTemplate(template:VenueTemplate){updateMoment({elements:copyVenueTemplateElements(template)});setSelectedId(undefined);setShowTemplates(false);setMoving(false);}
  async function saveVenueTemplate(){if(!onSaveTemplate||!moment||!editable||templateBusy)return;setTemplateError('');if(!templateName.trim()){setTemplateError('Escribe un nombre para la plantilla.');return;}setTemplateBusy(true);try{await onSaveTemplate({id:templateTarget||crypto.randomUUID(),name:templateName.trim(),elements:structuredClone(moment.elements)});setTemplateDialog(false);setMessage('Plantilla de sede guardada. Los planos preparados se conservan.');}catch(e){setTemplateError(e instanceof Error?e.message:'No se ha guardado la plantilla.');}finally{setTemplateBusy(false);}}
  function duplicateMoment(){if(!moment||working.moments.length>=50)return;const moments=[...working.moments];moments.splice(currentIndex+1,0,duplicateStageMoment(moment));update({...working,moments});setMomentIndex(currentIndex+1);setSelectedId(undefined);}
  function reorderMoment(direction:number){const target=currentIndex+direction;if(target<0||target>=working.moments.length)return;const moments=[...working.moments];[moments[currentIndex],moments[target]]=[moments[target],moments[currentIndex]];update({...working,moments});setMomentIndex(target);}
  function deleteMoment(){if(working.moments.length<2||!window.confirm('¿Eliminar este momento? Podrás deshacerlo.'))return;update({...working,moments:working.moments.filter((_,i)=>i!==currentIndex)});setMomentIndex(Math.max(0,currentIndex-1));setSelectedId(undefined);}
  function canvasClick(event:MouseEvent<SVGSVGElement>){if(!moving||!selected||!editable)return;const rect=event.currentTarget.getBoundingClientRect();const moved=moveStageElement(selected,(event.clientX-rect.left)*1000/rect.width,(event.clientY-rect.top)*560/rect.height);updateElement({x:moved.x,y:moved.y});setMoving(false);setMessage(`${selected.label}: posición cambiada`);}
  function selectElement(id:string){setSelectedId(id);setMoving(false);}
  function objectKeyboard(event:KeyboardEvent<SVGGElement>,el:StageElement){
    if(event.key==='Enter'||event.key===' '){event.preventDefault();selectElement(el.id);return;}
    if(event.key==='Escape'){setMoving(false);return;}
    const delta:Record<string,[number,number]>={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]};
    if(delta[event.key]&&editable){event.preventDefault();setSelectedId(el.id);const [dx,dy]=delta[event.key];const moved=moveStageElement(el,el.x+dx,el.y+dy);updateMoment({elements:moment!.elements.map(item=>item.id===el.id?moved:item)});}
  }
  async function save(){
    if(!editable||!dirty)return;
    if(working.moments.some(m=>!m.title.trim()||m.elements.some(el=>!el.label.trim()))){setError('Escribe un nombre para cada momento y elemento.');return;}
    setSaving(true);setError('');
    const next:StagePlan={...working,status:'draft',updatedAt:new Date().toISOString()};
    try{await onSave(next);setWorking(prev=>({...prev,status:'draft',updatedAt:next.updatedAt}));setDirty(false);setUndo([]);setRedo([]);setMessage('Borrador guardado. Los voluntarios aún ven la versión publicada.');}
    catch(e){setError(e instanceof Error?e.message:'No se ha guardado el plano. Inténtalo de nuevo.');}
    finally{setSaving(false);}
  }
  function close(){if(!dirty||window.confirm('Hay cambios sin guardar. ¿Salir del plano?'))onClose();}
  function reload(){if(dirty&&!window.confirm('¿Descartar tus cambios y cargar la última versión?'))return;setWorking(normalizeStagePlan(plan));setDirty(false);setRemoteChanged(false);setUndo([]);setRedo([]);setError('');}

  return <section className={`stage-editor${expanded?' is-expanded':''}`} data-print-ready={view==='published'?'true':'false'} aria-label="Editor de plataforma">
    <header className="stage-header" ref={stageHeader}>
      <StageButton onClick={close}><ArrowLeft size={20}/>Volver</StageButton>
      <div className="stage-heading"><h1>{plan.name||'Plano de plataforma'}</h1>{expanded&&<div className="stage-event-context"><p>{eventLabel}</p><p>{venueLabel}</p></div>}</div>
      <div className={`stage-version ${view==='published'&&publishedPlan?'stage-version-published':''}`}>{view==='published'&&publishedPlan?<Check size={16}/>:<Pencil size={16}/>}<span>{view==='published'?(publishedPlan?'Publicado':'Sin publicar'):dirty?'Sin guardar':'Borrador'}</span></div>
      <button type="button" ref={expandButton} className="stage-button" aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}<span>{expanded?'Reducir':'Ampliar'}</span></button>
      {canEdit&&<StageButton primary onClick={()=>void save()} disabled={!editable||!dirty}>{saving?<span className="stage-saving-dot"/>:<Save size={19}/>}<span>{saving?'Guardando…':'Guardar'}</span></StageButton>}
    </header>
    {!online&&<div className="stage-banner stage-banner-warning"><WifiOff size={19}/><span>Sin conexión · solo consulta{dirty?' · cambios sin guardar':''}</span></div>}
    {remoteChanged&&<div className="stage-banner stage-banner-warning" role="alert"><TriangleAlert size={20}/><span>Otra persona ha cambiado este plano.</span><StageButton onClick={reload}>Cargar versión</StageButton></div>}
    {error&&<div className="stage-banner stage-banner-error" role="alert"><TriangleAlert size={20}/><span>{error}</span></div>}
    {message&&<div className="stage-banner stage-banner-success" role="status"><Check size={19}/><span>{message}</span><button className="stage-banner-close" onClick={()=>setMessage('')} aria-label="Cerrar aviso"><X size={18}/></button></div>}

    <div className="stage-topbar">
      <div className="stage-view-switch" role="group" aria-label="Vista del plano">
        {canEdit&&<><StageButton onClick={()=>{setView('edit');setMoving(false);}} pressed={view==='edit'}><Pencil size={18}/>Editar</StageButton><StageButton onClick={()=>{setView('review');setMoving(false);}} pressed={view==='review'}><Eye size={18}/>Revisar</StageButton></>}
        {publishedPlan&&<StageButton onClick={()=>{setView('published');setMoving(false);}} pressed={view==='published'}><Check size={18}/>Publicado</StageButton>}
      </div>
      {view==='edit'?<div className="stage-history-actions"><StageButton onClick={undoChange} disabled={!editable||undo.length===0}><Undo2 size={18}/>Deshacer</StageButton><StageButton onClick={redoChange} disabled={!editable||redo.length===0} label="Rehacer"><Redo2 size={18}/></StageButton></div>:view==='published'&&publishedPlan?<StageButton onClick={()=>window.print()}><Printer size={19}/>Imprimir</StageButton>:<span className="stage-review-label">Vista previa · no publicado</span>}
    </div>

    {!moment?<div className="stage-empty"><PanelTop size={46}/><h2>Aún no hay un plano publicado</h2><p>El equipo está preparando las posiciones.</p></div>:<>
      <div className="stage-moment-rail" aria-label="Momentos de la participación">
        {activePlan!.moments.map((item,index)=><button className={`stage-moment-card${index===currentIndex?' is-current':''}`} key={item.id} type="button" onClick={()=>{setMomentIndex(index);setSelectedId(undefined);setMoving(false);}} aria-current={index===currentIndex?'step':undefined}><div className="stage-moment-number">{index+1}</div><div aria-hidden="true"><StageScene moment={item} mini/></div><span>{item.title}</span></button>)}
        {view==='edit'&&<button type="button" className="stage-add-moment" disabled={!editable||working.moments.length>=50} onClick={()=>{update({...working,moments:[...working.moments,createStageMoment('empty',`Momento ${working.moments.length+1}`)]});setMomentIndex(working.moments.length);setSelectedId(undefined);}}><Plus size={24}/><span>Añadir momento</span></button>}
      </div>

      <div className={`stage-workspace${view!=='edit'?' stage-workspace-review':''}`}>
        {view==='edit'&&<aside className="stage-catalog" aria-label="Añadir elementos">
          <h2>Añadir</h2>
          <StageButton onClick={()=>addElement('person')} disabled={!editable}><UserRound size={24}/>Persona</StageButton>
          <StageButton onClick={()=>addElement('chair')} disabled={!editable}><Armchair size={24}/>Silla</StageButton>
          <StageButton onClick={()=>addElement('table')} disabled={!editable}><Table2 size={24}/>Mesa</StageButton>
          <StageButton onClick={()=>addElement('lectern')} disabled={!editable}><PanelTop size={24}/>Atril</StageButton>
          <div className="stage-catalog-separator"/>
          <StageButton onClick={()=>setShowTemplates(x=>!x)} disabled={!editable} pressed={showTemplates}><LayoutTemplate size={22}/>Plantillas</StageButton>
          {onSaveTemplate&&<StageButton onClick={()=>{setTemplateName(moment.title);setTemplateTarget('');setTemplateError('');setTemplateDialog(true);}} disabled={!editable}><Save size={20}/>Guardar plantilla</StageButton>}
        </aside>}

        <div className="stage-canvas-panel">
          <div className="stage-canvas-heading"><div><span className="stage-moment-count">Momento {currentIndex+1} de {activePlan!.moments.length}</span><h2>{moment.title}</h2></div><span className="stage-orientation"><UsersRound size={18}/>Vista desde el público</span></div>
          {showTemplates&&editable&&<div className="stage-template-picker" aria-label="Elegir plantilla">{stageTemplates.map(t=><button type="button" key={t.id} onClick={()=>applyTemplate(t.id)}><div aria-hidden="true"><StageScene moment={{id:t.id,title:t.name,instruction:'',camera:'',elements:templateElements(t.id)}} mini/></div><span>{t.name}</span></button>)}{templates.map(t=><button type="button" key={`venue-${t.id}`} onClick={()=>applyVenueTemplate(t)}><div aria-hidden="true"><StageScene moment={{id:t.id,title:t.name,instruction:'',camera:'',elements:t.elements}} mini/></div><span>{t.name}<small>De esta sede</small></span></button>)}</div>}
          {moving&&editable&&<div className="stage-move-hint" role="status"><Move size={19}/><span>Toca el destino de <strong>{selected?.label}</strong></span><button type="button" onClick={()=>setMoving(false)} aria-label="Cancelar movimiento"><X size={19}/></button></div>}
          <div className={`stage-canvas-scroll${moving?' is-moving':''}`}>
            <div className={`stage-canvas-size${fit?' is-fitted':''}`} style={{width:zoom!==1?`${zoom*100}%`:undefined}}>
              <StageScene moment={moment} svgRef={svgRef} selectedId={view==='edit'?selectedId:undefined} interactive={editable} onSelect={editable?selectElement:undefined} onMove={canvasClick} onKeyboard={objectKeyboard}/>
            </div>
          </div>
          <div className="stage-canvas-footer"><span><ArrowDown size={17}/>Público abajo · sin escala</span><div className="stage-zoom-controls"><StageButton onClick={()=>{setFit(false);setZoom(x=>Math.max(.75,x-.25));}} label="Alejar plano"><ZoomOut size={20}/></StageButton><StageButton onClick={()=>{setFit(x=>!x);setZoom(1);}} pressed={fit}><Maximize2 size={18}/>Ver todo</StageButton><StageButton onClick={()=>{setFit(false);setZoom(x=>Math.min(2,x+.25));}} label="Acercar plano"><ZoomIn size={20}/></StageButton></div></div>
          {fit&&moment.elements.length>0&&<div className="stage-compact-legend" aria-label="Personas y mobiliario">{moment.elements.map((el,index)=>editable?<button type="button" key={el.id} onClick={()=>selectElement(el.id)} aria-pressed={selectedId===el.id}><span>{index+1}</span>{el.label}</button>:<div key={el.id}><span>{index+1}</span>{el.label}</div>)}</div>}
          {(moment.instruction||moment.camera)&&<div className="stage-scene-notes">{moment.instruction&&<p><Move size={20}/><strong>{moment.instruction}</strong></p>}{moment.camera&&<p><Video size={20}/><span>{moment.camera}</span></p>}</div>}
          {view!=='edit'&&<div className="stage-presentation-actions"><StageButton onClick={()=>setMomentIndex(x=>Math.max(0,x-1))} disabled={currentIndex===0}><ChevronLeft size={21}/>Anterior</StageButton><StageButton primary onClick={()=>setMomentIndex(x=>Math.min(activePlan!.moments.length-1,x+1))} disabled={currentIndex===activePlan!.moments.length-1}>Siguiente<ChevronRight size={21}/></StageButton></div>}
        </div>

        {view==='edit'&&<aside className="stage-properties" aria-label="Propiedades del plano">
          {selected?<>
            <div className="stage-properties-title"><h3>{selected.kind==='person'?'Persona':'Mobiliario'}</h3><button type="button" onClick={()=>{setSelectedId(undefined);setMoving(false);}} aria-label="Dejar de seleccionar"><X size={20}/></button></div>
            <label className="stage-field">Nombre<input value={selected.label} maxLength={60} autoComplete="off" onChange={e=>updateElement({label:e.target.value})} disabled={!editable}/></label>
            <StageButton primary onClick={()=>setMoving(x=>!x)} disabled={!editable} pressed={moving}><Move size={20}/>Mover</StageButton>
            <div className="stage-nudge" role="group" aria-label="Ajustar posición"><StageButton onClick={()=>moveBy(0,-15)} disabled={!editable} label="Mover hacia el fondo"><ArrowUp size={22}/></StageButton><StageButton onClick={()=>moveBy(-15,0)} disabled={!editable} label="Mover a la izquierda"><ArrowLeft size={22}/></StageButton><span aria-hidden="true"><Move size={18}/></span><StageButton onClick={()=>moveBy(15,0)} disabled={!editable} label="Mover a la derecha"><ArrowRight size={22}/></StageButton><StageButton onClick={()=>moveBy(0,15)} disabled={!editable} label="Mover hacia el público"><ArrowDown size={22}/></StageButton></div>
            {selected.kind==='person'&&<>
              <fieldset className="stage-choice-field"><legend>Postura</legend><div><StageButton onClick={()=>updateElement({posture:'standing'})} disabled={!editable} pressed={selected.posture==='standing'}><UserRound size={18}/>De pie</StageButton><StageButton onClick={()=>updateElement({posture:'sitting'})} disabled={!editable} pressed={selected.posture==='sitting'}><Armchair size={18}/>Sentado</StageButton></div></fieldset>
              <fieldset className="stage-choice-field"><legend>Mira hacia</legend><div>{([['audience','Público',UsersRound],['left','Izquierda',ArrowLeft],['right','Derecha',ArrowRight]] as const).map(([value,label,Icon])=><StageButton key={value} onClick={()=>updateElement({facing:value})} disabled={!editable} pressed={selected.facing===value}><Icon size={18}/>{label}</StageButton>)}</div></fieldset>
              <fieldset className="stage-choice-field"><legend>Movimiento</legend><div>{([['none','Sin mover',UserRound],['enter','Entra',ArrowRight],['exit','Sale',ArrowLeft]] as const).map(([value,label,Icon])=><StageButton key={value} onClick={()=>updateElement({movement:value})} disabled={!editable} pressed={(selected.movement||'none')===value}><Icon size={18}/>{label}</StageButton>)}</div></fieldset>
            </>}
            <button type="button" className="stage-delete" disabled={!editable} onClick={()=>{updateMoment({elements:moment.elements.filter(el=>el.id!==selected.id)});setSelectedId(undefined);setMoving(false);}}><Trash2 size={18}/>Quitar elemento</button>
          </>:<>
            <h3>Este momento</h3>
            <label className="stage-field">Nombre<input value={moment.title} maxLength={70} autoComplete="off" disabled={!editable} onChange={e=>updateMoment({title:e.target.value})}/></label>
            <label className="stage-field">Qué ocurre<textarea value={moment.instruction} rows={3} maxLength={300} placeholder="Entra el participante…" disabled={!editable} onChange={e=>updateMoment({instruction:e.target.value})}/></label>
            <label className="stage-field">Encuadre<input value={moment.camera} maxLength={120} placeholder="Cámara 2 · entrevista…" disabled={!editable} onChange={e=>updateMoment({camera:e.target.value})}/></label>
            <StageButton onClick={duplicateMoment} disabled={!editable||working.moments.length>=50}><Copy size={19}/>Duplicar momento</StageButton>
            <div className="stage-reorder"><StageButton onClick={()=>reorderMoment(-1)} disabled={!editable||currentIndex===0}><ChevronLeft size={18}/>Antes</StageButton><StageButton onClick={()=>reorderMoment(1)} disabled={!editable||currentIndex===working.moments.length-1}>Después<ChevronRight size={18}/></StageButton></div>
            <button type="button" className="stage-delete" disabled={!editable||working.moments.length===1} onClick={deleteMoment}><Trash2 size={18}/>Eliminar momento</button>
            <div className="stage-selection-help"><UserRound size={24}/><span>Toca una persona o un mueble para cambiarlo.</span></div>
          </>}
          {moment.elements.length>0&&<div className="stage-object-list"><h4>En el plano</h4>{moment.elements.map(el=><button key={el.id} type="button" onClick={()=>selectElement(el.id)} aria-pressed={selectedId===el.id}>{el.kind==='person'?<UserRound size={17}/>:el.kind==='chair'?<Armchair size={17}/>:el.kind==='table'?<Table2 size={17}/>:<PanelTop size={17}/>}<span>{el.label}</span></button>)}</div>}
        </aside>}
      </div>
    </>}

    {view==='edit'&&<div className="stage-actions-mobile no-print" ref={mobileActions}><div className="stage-current-label"><strong>Momento {currentIndex+1} · {moment?.title}</strong><span>Público abajo</span></div><div className="button-row"><StageButton onClick={undoChange} disabled={!editable||undo.length===0}><Undo2 size={18}/>Deshacer</StageButton><StageButton onClick={redoChange} disabled={!editable||redo.length===0}><Redo2 size={18}/>Rehacer</StageButton><StageButton primary onClick={()=>void save()} disabled={!editable||!dirty}><Save size={19}/>{saving?'Guardando…':'Guardar'}</StageButton></div></div>}
    {templateDialog&&<Modal title="Guardar plantilla de sede" onClose={()=>{if(!templateBusy)setTemplateDialog(false);}}><form className="stage-template-form" onSubmit={e=>{e.preventDefault();void saveVenueTemplate();}}><ErrorMessage message={templateError}/><label className="field">Guardar como<select value={templateTarget} onChange={e=>{setTemplateTarget(e.target.value);if(e.target.value)setTemplateName(templates.find(t=>t.id===e.target.value)?.name||'');}}><option value="">Plantilla nueva</option>{templates.map(t=><option key={t.id} value={t.id}>Reemplazar: {t.name}</option>)}</select></label><label className="field">Nombre<input required value={templateName} maxLength={70} onChange={e=>setTemplateName(e.target.value)}/></label><p className="stage-template-note">Los planos ya preparados se conservarán.</p><div className="modal-actions"><button type="button" className="btn" disabled={templateBusy} onClick={()=>setTemplateDialog(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={templateBusy||!editable}><Save size={19}/>{templateBusy?'Guardando…':templateTarget?'Reemplazar plantilla':'Guardar plantilla'}</button></div></form></Modal>}
    {publishedPlan&&<div className="stage-print-document" aria-hidden="true">{publishedPlan.moments.map((m,i)=><article className="stage-print-page" key={m.id}><header><span>LS Asambleas · Plataforma</span>{eventLabel&&<strong>{eventLabel}</strong>}{venueLabel&&<p>{venueLabel}</p>}<h2>{publishedPlan.name}</h2><p>Momento {i+1} de {publishedPlan.moments.length} · {m.title}</p></header><StageScene moment={m}/>{m.instruction&&<p><strong>{m.instruction}</strong></p>}{m.camera&&<p>{m.camera}</p>}<footer>Publicado · {publishedPlan.updatedAt?new Date(publishedPlan.updatedAt).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}):'Fecha no indicada'} · Revisión {publishedPlan.revision??1}<br/>Consulta la versión vigente: {window.location.href}</footer></article>)}</div>}
  </section>;
}
export default StageEditor;
