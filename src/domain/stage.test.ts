import {describe,it,expect} from 'vitest';
import {copyVenueTemplateElements,createStageElement,createStageMoment,duplicateStageMoment,moveStageElement,normalizeStagePlan,stageTemplates,templateElements} from './stage';
import type {StagePlan} from './types';

describe('stage scenes',()=>{
  it('every template gives unique object IDs',()=>{
    for(const t of stageTemplates){const rows=templateElements(t.id);expect(new Set(rows.map(x=>x.id)).size).toBe(rows.length);}
  });
  it('duplicates scenes without sharing people or mutable references',()=>{
    const original=createStageMoment('seated');const copy=duplicateStageMoment(original);
    expect(copy.id).not.toBe(original.id);expect(copy.elements[0].id).not.toBe(original.elements[0].id);
    copy.elements[0].x=100;expect(original.elements[0].x).toBe(500);
  });
  it('keeps moved objects and names within the stage',()=>{
    const original=createStageElement('person');const moved=moveStageElement(original,-600,2000);
    expect(moved.x).toBe(130);expect(moved.y).toBe(360);expect(original.x).toBe(500);
  });
  it('preserves the existing document revision and repairs an empty moment list',()=>{
    const plan:StagePlan={id:'plan',eventId:'event',programItemId:'talk',name:'Entrevista',moments:[],status:'draft',updatedAt:'',revision:7};
    const result=normalizeStagePlan(plan);expect(result.moments).toHaveLength(1);expect(result.revision).toBe(7);expect(plan.moments).toHaveLength(0);
  });
  it('seated interview and interpreter have the expected visual roles',()=>{
    expect(templateElements('seated').filter(x=>x.kind==='person').every(x=>x.posture==='sitting')).toBe(true);
    expect(templateElements('interpreter').some(x=>x.label==='Intérprete')).toBe(true);
  });
  it('keeps prepared scenes independent when a venue template changes',()=>{const template={id:'venue-template',name:'Entrevista',elements:templateElements('standing')};const copied=copyVenueTemplateElements(template);expect(copied[0].id).not.toBe(template.elements[0].id);template.elements[0].x=50;expect(copied[0].x).toBe(325);});
});
