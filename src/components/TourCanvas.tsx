import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import type {Viewer} from '@photo-sphere-viewer/core';
import type {DepartmentTour} from '../domain/tours';
import {useTourImage} from './DepartmentTours';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

export interface TourControls {zoom:(delta:number)=>void;move:(horizontal:number,vertical:number)=>void;reset:()=>void;refresh:()=>void}
export const TourCanvas=forwardRef<TourControls,{tour:DepartmentTour;onZone:(id:string,trigger?:HTMLElement)=>void;onFallback:()=>void}>(function TourCanvas({tour,onZone,onFallback},ref){
 const host=useRef<HTMLDivElement>(null),viewer=useRef<Viewer|null>(null),onSelect=useRef(onZone),fallback=useRef(onFallback),[failed,setFailed]=useState(''),[ready,setReady]=useState(false);
 onSelect.current=onZone;fallback.current=onFallback;
 const image=useTourImage(tour.id,tour.panorama.id);
 useImperativeHandle(ref,()=>({zoom:delta=>{const v=viewer.current;if(v)v.zoom(Math.max(0,Math.min(100,v.getZoomLevel()+delta)));},move:(h,p)=>{const v=viewer.current;if(v){const pos=v.getPosition();v.rotate({yaw:pos.yaw+h,pitch:pos.pitch+p});}},reset:()=>{viewer.current?.rotate(tour.initialView);viewer.current?.zoom(0);},refresh:()=>{viewer.current?.autoSize();viewer.current?.needsUpdate();}}),[tour]);
 useEffect(()=>{if(!image.url||!image.blob||!host.current)return;let disposed=false;let releaseCache=()=>{};setFailed('');setReady(false);
  void (async()=>{try{
   const [{Viewer,SYSTEM,Cache},{MarkersPlugin},{VisibleRangePlugin}]=await Promise.all([import('@photo-sphere-viewer/core'),import('@photo-sphere-viewer/markers-plugin'),import('@photo-sphere-viewer/visible-range-plugin')]);if(disposed)return;
   SYSTEM.load();
   const markers=tour.zones.map(z=>{const button=document.createElement('button');button.type='button';button.className='tour-marker';button.setAttribute('aria-label',`Ampliar ${z.title}`);const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('width','20');icon.setAttribute('height','20');icon.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M12 5v14M5 12h14');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2');icon.append(path);button.append(icon,document.createTextNode(z.title));button.addEventListener('click',e=>{if(e.detail===0){e.stopPropagation();onSelect.current(z.id,button);}});return {id:z.id,position:{yaw:z.yaw,pitch:z.pitch},element:button,size:{width:150,height:50},anchor:'center center'};});
   const v=new Viewer({container:host.current!,panoData:tour.panoData,defaultYaw:tour.initialView.yaw,defaultPitch:tour.initialView.pitch,defaultZoomLvl:0,minFov:30,maxFov:65,navbar:false,keyboard:false,mousewheel:false,touchmoveTwoFingers:false,moveInertia:false,loadingTxt:'Cargando sala…',plugins:[MarkersPlugin.withConfig({markers}),VisibleRangePlugin.withConfig({usePanoData:true})]});
   viewer.current=v;v.addEventListener('ready',()=>{if(!disposed)setReady(true);},{once:true});
   // The viewer consumes touch events, so pointer activation uses its selection event.
   // Native clicks with detail=0 above cover keyboard and assistive technology only.
   v.getPlugin(MarkersPlugin)!.addEventListener('select-marker',({marker,rightClick})=>{
    if(disposed||rightClick)return;
    onSelect.current(marker.id,markers.find(m=>m.id===marker.id)?.element);
   });
   // Reuse the authenticated blob, preserving its MIME type and avoiding another fetch.
   Cache.add(image.url,image.url,image.blob!);releaseCache=()=>Cache.remove(image.url,image.url);
   v.addEventListener('panorama-error',()=>{if(!disposed){setFailed('No se pudo abrir la vista 360°. Puedes explorar las zonas.');fallback.current();}});
   await v.setPanorama(image.url,{panoData:tour.panoData,transition:false});
  }catch{if(!disposed){setFailed('Este dispositivo no puede abrir la vista 360°. Puedes explorar las zonas.');fallback.current();}}})();
  return()=>{disposed=true;viewer.current?.destroy();viewer.current=null;releaseCache();};
 },[image.url,tour]);
 return <div className="tour-panorama-wrap" data-ready={ready} data-failed={!!failed}><div className="tour-panorama" ref={host} tabIndex={0} role="region" aria-label={`Vista 360° de ${tour.title}. Usa las flechas para moverte.`} onKeyDown={e=>{
  if(e.target!==host.current)return;
  const delta:Record<string,[number,number]>={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,.12],ArrowDown:[0,-.12]};
  if(delta[e.key]){e.preventDefault();const v=viewer.current,pos=v?.getPosition();if(v&&pos)v.rotate({yaw:pos.yaw+delta[e.key][0],pitch:pos.pitch+delta[e.key][1]});}
 }}/>{(!ready||image.error||failed)&&<div className="tour-canvas-state" role="status"><p>{image.error||failed||'Cargando sala…'}</p>{image.error&&<button className="btn" onClick={image.retry}>Reintentar imagen</button>}</div>}</div>;
});
