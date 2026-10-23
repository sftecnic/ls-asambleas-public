import type { Shift } from './types';

export type ShiftPostIcon='conductor'|'sliders'|'monitor'|'joystick'|'department';
interface PostDefinition {key:string;label:string;aliases:readonly string[];icon:ShiftPostIcon;ink:string;background:string}
export const videoPosts:readonly PostDefinition[]=[
  {key:'director',label:'Director',aliases:['director'],icon:'conductor',ink:'#6D28D9',background:'#F5F3FF'},
  {key:'mesa',label:'Mesa',aliases:['mesa'],icon:'sliders',ink:'#0E7490',background:'#ECFEFF'},
  {key:'video',label:'Vídeo',aliases:['video','ordenador'],icon:'monitor',ink:'#A21CAF',background:'#FDF4FF'},
  {key:'camera',label:'Cámara',aliases:['camara'],icon:'joystick',ink:'#4338CA',background:'#EEF2FF'},
];
export interface ShiftPostPresentation extends Omit<PostDefinition,'aliases'> {order:number}
const natural=new Intl.Collator('es',{numeric:true,sensitivity:'base'}).compare;
const normalized=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es');

/** Presentation only: historical role text and saved publications are never rewritten. */
export function shiftPost(departmentId:string,role:string):ShiftPostPresentation {
  const label=role.trim().replace(/\s+/g,' ');
  const match=/^(.+?)(?:\s+(\d+))?$/.exec(label);
  if(departmentId==='video'&&match){
    const order=videoPosts.findIndex(post=>post.aliases.includes(normalized(match[1])));
    if(order>=0){const {aliases:_,...post}=videoPosts[order];return {...post,order,label:post.label+(match[2]?` ${match[2]}`:'')};}
  }
  return {key:'other',label:label||'Sin puesto',icon:'department',order:videoPosts.length,ink:'#475569',background:'#F1F5F9'};
}

/** Call within a department/session; names, team duties and grants never affect order. */
export function compareShiftPosts(a:Shift,b:Shift):number {
  const left=shiftPost(a.departmentId,a.role),right=shiftPost(b.departmentId,b.role);
  return left.order-right.order||natural(left.label,right.label)||a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id);
}

export function shiftPostSuggestions(departmentId:string,shifts:readonly Pick<Shift,'departmentId'|'role'>[]):string[] {
  const defaults=departmentId==='video'?[...videoPosts.map(post=>post.label),'Audio']
    :departmentId==='platform'?['Plataforma','Responsable de turno']:departmentId==='makeup'?['Maquillaje']:[];
  const labels=new Set([...defaults,...shifts.filter(s=>s.departmentId===departmentId).map(s=>shiftPost(departmentId,s.role).label)]);
  return [...labels].sort((a,b)=>{
    const left=shiftPost(departmentId,a),right=shiftPost(departmentId,b);
    return left.order-right.order||natural(left.label,right.label);
  });
}
