import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';

test('shows unique people, scoped counts and separate supervision; roles do not grant access',async({page},testInfo)=>{
  const data=createDemoData(),person=data.persons[1],candidate=data.candidates[0];
  data.persons=[data.persons[0],...Array.from({length:22},(_,i)=>({...person,id:`person-${i}`,name:`Persona de prueba ${i+1}`,aliases:i===1?['Alias de prueba']:[],email:`persona${i}@example.test`,gmail:''})),{...person,id:'supervisor',name:'Supervisor de prueba',gmail:''}];
  data.candidates=Array.from({length:22},(_,i)=>({...candidate,id:`candidate-${i}`,personId:`person-${i}`,departmentId:i<11?'video':i<18?'platform':'makeup',committee:'approved' as const,availability:'accepted' as const,access:'none' as const,teamRole:i===0||i===11?'responsible' as const:i===1||i===2||i===12?'assistant' as const:'volunteer' as const}));
  for(const dep of ['video','platform'])data.candidates.push({...candidate,id:`sup-${dep}`,personId:'supervisor',departmentId:dep,teamRole:'supervisor'});
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Equipo',exact:true}).click();
  const team=page.locator('.team-panel'),cards=team.locator(':scope > .team-person-list > article');
  await expect(team.getByRole('heading',{name:'Equipo 22',exact:true})).toBeVisible();
  await expect(cards).toHaveCount(22);
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  await expect(team.getByRole('button',{name:'Por aprobar 0',exact:true})).toBeVisible();
  await expect(team.getByRole('button',{name:'Aceptados 22',exact:true})).toBeVisible();
  await expect(team.locator('.team-supervision article')).toHaveCount(1);
  await expect(team.locator('.team-supervision article').getByRole('heading',{name:'Supervisor de prueba'})).toBeVisible();
  for(const [dep,count] of [['video',11],['platform',7],['makeup',4]] as const){
    await team.getByLabel('Departamento del equipo').selectOption(dep);await expect(cards).toHaveCount(count);
    await expect(team.getByRole('button',{name:`Aceptados ${count}`,exact:true})).toBeVisible();
  }
  await team.getByLabel('Departamento del equipo').selectOption('video');
  await team.getByLabel('Buscar persona o congregación').fill('alias de prueba');await expect(cards).toHaveCount(1);
  await cards.first().getByRole('button').click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Cargo en este departamento')).toHaveValue('assistant');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!).grants);
  await dialog.getByLabel('Cargo en este departamento').selectOption('responsible');
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!).candidates.find((c:{id:string})=>c.id==='candidate-1').teamRole)).toBe('responsible');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!).grants)).toEqual(before);
  await dialog.getByRole('button',{name:'Volver',exact:true}).click();
  await team.getByLabel('Buscar persona o congregación').fill('');
  for(const [width,height] of [[390,844],[820,1180],[1440,1000]]){
    await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`team-${width}.png`),fullPage:true});
  }
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByLabel('Elegir evento').selectOption('e2');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Equipo',exact:true}).click();
  await expect(team.getByLabel('Departamento del equipo')).toHaveValue('');await expect(team.getByRole('heading',{name:'Equipo 0',exact:true})).toBeVisible();
});

test('keeps multiple departments on one card and opens the selected participation',async({page})=>{
  const data=createDemoData();data.candidates.push({...data.candidates[0],id:'multi',departmentId:'platform'});
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Equipo',exact:true}).click();
  const cards=page.locator('.team-panel > .team-person-list > article');await expect(cards).toHaveCount(6);
  const card=cards.filter({has:page.getByRole('heading',{name:'Lucía Martín',exact:true})});await expect(card).toHaveCount(1);
  await card.getByRole('button',{name:'Ver Plataforma',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Departamento de esta ficha')).toHaveValue('multi');
  await dialog.getByLabel('Departamento de esta ficha').selectOption('ca1');await expect(dialog.getByLabel('Departamento de esta ficha')).toHaveValue('ca1');
  await page.keyboard.press('Escape');await expect(card.getByRole('button',{name:'Ver Plataforma',exact:true})).toBeFocused();
});
