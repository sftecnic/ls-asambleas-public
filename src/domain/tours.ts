import type {AppData,AppUser} from './types';
import {can} from './rules';

export interface TourImage {id:string;thumbnail:string;alt:string;width:number;height:number}
export interface TourZone {id:string;title:string;icon:'camera'|'mixer'|'video'|'monitor'|'audio'|'platform'|'makeup'|'location';yaw:number;pitch:number;images:TourImage[]}
export interface DepartmentTour {
 id:string;venueId:string;departmentId:string;title:string;version:number;capturedAt:string;
 panorama:TourImage;panoData:{fullWidth:number;fullHeight:number;croppedWidth:number;croppedHeight:number;croppedX:number;croppedY:number};
 initialView:{yaw:number;pitch:number};zones:TourZone[];
}
export interface TourCatalog {format:1;tours:DepartmentTour[]}
export const tourIdPattern=/^[a-zA-Z0-9_-]{1,160}$/;
export function validateTourCatalog(value:unknown):asserts value is TourCatalog {
 const c=value as TourCatalog;if(!c||c.format!==1||!Array.isArray(c.tours)||c.tours.length>100)throw new Error('Catálogo de recorridos no válido.');
 const seen=new Set<string>();
 const text=(s:unknown,max=240)=>typeof s==='string'&&s.length>0&&s.length<=max;
 const id=(s:unknown)=>typeof s==='string'&&tourIdPattern.test(s);
 for(const t of c.tours){
  if(!t||!id(t.id)||seen.has(t.id)||!id(t.venueId)||!id(t.departmentId)||!text(t.title,160)||!Number.isInteger(t.version)||t.version<1||!/^\d{4}-\d{2}-\d{2}$/.test(t.capturedAt)||!Number.isFinite(Date.parse(t.capturedAt))||new Date(t.capturedAt).toISOString().slice(0,10)!==t.capturedAt)throw new Error('Recorrido no válido.');seen.add(t.id);
  const p=t.panoData;if(!p||![p.fullWidth,p.fullHeight,p.croppedWidth,p.croppedHeight,p.croppedX,p.croppedY].every(n=>Number.isInteger(n)&&n>=0)||p.fullWidth!==p.fullHeight*2||!p.croppedWidth||!p.croppedHeight||p.croppedX+p.croppedWidth>p.fullWidth||p.croppedY+p.croppedHeight>p.fullHeight||p.fullWidth>8192)throw new Error('Geometría de panorámica no válida.');
  const angle=(a:{yaw:number;pitch:number})=>a&&Number.isFinite(a.yaw)&&Number.isFinite(a.pitch)&&Math.abs(a.pitch)<=Math.PI/2;
  if(!angle(t.initialView)||!Array.isArray(t.zones)||t.zones.length>30)throw new Error('Zonas de recorrido no válidas.');
  const zones=new Set<string>();
  for(const z of t.zones){if(!z||!id(z.id)||zones.has(z.id)||!text(z.title,80)||!['camera','mixer','video','monitor','audio','platform','makeup','location'].includes(z.icon)||!angle(z)||!Array.isArray(z.images)||!z.images.length||z.images.length>10)throw new Error('Zona no válida.');zones.add(z.id);}
  for(const im of [t.panorama,...t.zones.flatMap(z=>z.images)])if(!im||!id(im.id)||!id(im.thumbnail)||!text(im.alt,500)||!Number.isInteger(im.width)||!Number.isInteger(im.height)||im.width<1||im.height<1||im.width>8192||im.height>8192)throw new Error('Imagen de recorrido no válida.');
  if(t.panorama.width!==p.croppedWidth||t.panorama.height!==p.croppedHeight)throw new Error('La imagen no coincide con su geometría.');
 }
}
export function tourAssets(t:DepartmentTour){return new Set([t.panorama,...t.zones.flatMap(z=>z.images)].flatMap(im=>[im.id,im.thumbnail]));}
export function authorizedTours(c:TourCatalog,data:AppData,user:AppUser,eventId:string){
 const event=data.events.find(e=>e.id===eventId);if(!event)return [];
 return c.tours.filter(t=>t.venueId===event.venueId&&can(user,data,'view',eventId,t.departmentId));
}

export function demoTourCatalog():TourCatalog {
 const configs=[['video','Audio y vídeo',['Cámara','Mesa','Vídeo','Multiview','Audio'],['camera','mixer','video','monitor','audio']],['platform','Plataforma',['Atril','Mesa y sillas','Acceso'],['platform','platform','location']],['makeup','Maquillaje',['Mesa de trabajo','Material'],['makeup','makeup']]] as const;
 return {format:1,tours:configs.map(([departmentId,title,names,icons])=>({id:`demo-${departmentId}`,venueId:'v1',departmentId,title,version:1,capturedAt:'2026-10-25',panorama:{id:'demo-panorama',thumbnail:'demo-panorama',alt:'Sala ficticia de demostración',width:2048,height:1024},panoData:{fullWidth:2048,fullHeight:1024,croppedWidth:2048,croppedHeight:1024,croppedX:0,croppedY:0},initialView:{yaw:0,pitch:0},zones:names.map((name,i)=>({id:`zone-${i}`,title:name,icon:icons[i] as TourZone['icon'],yaw:(i-(names.length-1)/2)*0.48,pitch:-0.1,images:[{id:'demo-detail',thumbnail:'demo-detail',alt:`${name}: equipo ficticio de demostración`,width:1200,height:800}]}))}))};
}
