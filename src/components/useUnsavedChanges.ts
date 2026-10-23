import {useCallback,useEffect} from 'react';

/** A successful save closes directly; user-initiated exits go through this guard. */
export function useUnsavedChanges(dirty:boolean,busy=false,onNavigate?:()=>void){
  const allowClose=useCallback(()=>!busy&&(!dirty||window.confirm('Hay cambios sin guardar. ¿Descartarlos y salir?')),[dirty,busy]);
  useEffect(()=>{
    if(!dirty&&!busy&&!onNavigate)return;
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const beforeNavigate=(event:Event)=>{if(event.defaultPrevented)return;if(!allowClose())event.preventDefault();else onNavigate?.();};
    if(dirty||busy)window.addEventListener('beforeunload',beforeUnload);
    window.addEventListener('ls:before-navigate',beforeNavigate);
    return()=>{window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('ls:before-navigate',beforeNavigate);};
  },[dirty,busy,allowClose,onNavigate]);
  return allowClose;
}
