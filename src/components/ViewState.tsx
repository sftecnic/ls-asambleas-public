import {createContext,useContext,useState,type Dispatch,type SetStateAction,type ReactNode} from 'react';

// In-memory only: searches and private classifications never enter a URL or storage.
const scopes=new Map<string,Map<string,unknown>>();
const ViewContext=createContext<Map<string,unknown>|null>(null);
export function clearViewState(){scopes.clear();}
export function ViewStateProvider({scope,children}:{scope:string;children:ReactNode}) {
  if(!scopes.has(scope))scopes.set(scope,new Map());
  return <ViewContext.Provider value={scopes.get(scope)!}>{children}</ViewContext.Provider>;
}
export function useViewState<T>(key:string,initial:T|(()=>T),urlKey?:'departamento'|'dia'|'ambito'):[T,Dispatch<SetStateAction<T>>] {
  const memory=useContext(ViewContext);
  const [value,setValue]=useState<T>(()=>{
    const param=urlKey?new URLSearchParams(location.search).get(urlKey):null;
    return param!==null?param as T:memory?.has(key)?memory.get(key) as T:typeof initial==='function'?(initial as ()=>T)():initial;
  });
  const update:Dispatch<SetStateAction<T>>=next=>setValue(current=>{
    const result=typeof next==='function'?(next as (v:T)=>T)(current):next;
    memory?.set(key,result);
    if(urlKey){const url=new URL(location.href);if(result)url.searchParams.set(urlKey,String(result));else url.searchParams.delete(urlKey);history.replaceState(history.state,'',url);}
    return result;
  });
  return [value,update];
}
