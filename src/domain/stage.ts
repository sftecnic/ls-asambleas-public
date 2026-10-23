import type { StageElement, StageMoment, StagePlan,VenueTemplate } from './types';

export type StageTemplate = 'speaker' | 'standing' | 'seated' | 'interpreter' | 'empty';
export const stageTemplates: {id:StageTemplate;name:string}[] = [
  {id:'speaker',name:'Una persona'}, {id:'standing',name:'Entrevista de pie'},
  {id:'seated',name:'Entrevista sentada'}, {id:'interpreter',name:'Con intérprete'},
  {id:'empty',name:'Plano vacío'},
];
const uid = () => crypto.randomUUID();
const names: Record<StageElement['kind'],string> = {person:'Participante',chair:'Silla',table:'Mesa',lectern:'Atril'};

export function createStageElement(kind:StageElement['kind'], x=500,y=285,label=names[kind]):StageElement {
  return {id:uid(),kind,label,x,y,posture:'standing',facing:'audience',movement:'none'};
}
export function templateElements(template:StageTemplate):StageElement[] {
  const person=(label:string,x:number,y=265,posture:StageElement['posture']='standing'):StageElement=>({...createStageElement('person',x,y,label),posture});
  switch(template){
    case 'speaker': return [createStageElement('lectern',500,345),person('Orador',500,230)];
    case 'standing': return [person('Orador',325),person('Participante 1',610),person('Participante 2',790),createStageElement('lectern',325,375)];
    case 'seated': return [createStageElement('table',500,355),person('Orador',330,240,'sitting'),person('Participante 1',500,240,'sitting'),person('Participante 2',670,240,'sitting')];
    case 'interpreter': return [person('Orador',380),person('Intérprete',670),createStageElement('lectern',380,375)];
    default:return [];
  }
}
export function createStageMoment(template:StageTemplate='empty',title='Inicio'):StageMoment {
  return {id:uid(),title,instruction:'',camera:'',elements:templateElements(template)};
}
export function duplicateStageMoment(moment:StageMoment):StageMoment {
  return {...structuredClone(moment),id:uid(),title:`${moment.title} · copia`,elements:moment.elements.map(el=>({...el,id:uid()}))};
}
export function copyVenueTemplateElements(template:VenueTemplate):StageElement[]{return structuredClone(template.elements).map(element=>({...element,id:uid()}));}
export function moveStageElement(element:StageElement,x:number,y:number):StageElement {
  const minX=element.movement==='enter'?160:130,maxX=element.movement==='exit'?840:870;
  return {...element,x:Math.round(Math.max(minX,Math.min(maxX,x))),y:Math.round(Math.max(135,Math.min(360,y)))};
}
export function normalizeStagePlan(plan:StagePlan):StagePlan {
  const copy=structuredClone(plan);
  if(copy.moments.length===0) copy.moments=[createStageMoment('empty')];
  return copy;
}
