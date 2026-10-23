import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';

test.beforeEach(async({page})=>{
  const data=createDemoData();data.persons[1].hearingStatus='deaf';data.persons[2].hearingStatus='hearing';
  data.candidates.push({...data.candidates[0],id:'second-dept',departmentId:'platform'});
  data.events.push({...data.events[0],id:'past',title:'Asamblea anterior',startDate:'2025-04-12',endDate:'2025-04-12',archived:true});
  data.candidates.push({...data.candidates[0],id:'past-candidate',eventId:'past'});
  data.shifts.push({...data.shifts[0],id:'past-shift',eventId:'past',startsAt:'2025-04-12T08:00:00.000Z',endsAt:'2025-04-12T10:00:00.000Z',attendance:'completed'});
  await page.addInitScript(data=>{if(!localStorage.getItem('ls-asambleas:demo:v1'))localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');
});
const nav=(page:import('@playwright/test').Page,name:string)=>page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name,exact:true}).click();

test('equipo: filtros combinados, recuento único y edición de clasificación',async({page})=>{
  await nav(page,'Equipo');await page.getByRole('button',{name:'Filtros',exact:true}).click();
  const stats=page.getByRole('region',{name:'Estadísticas: Equipo'});
  await expect(stats.locator('dd').first()).toHaveText('6');
  await page.getByRole('combobox',{name:'Sorda u oyente',exact:true}).selectOption('deaf');
  await expect(page.locator('.team-person-card')).toHaveCount(1);
  await expect(stats.locator('dd').first()).toHaveText('1');
  await page.getByRole('combobox',{name:'Congregación',exact:true}).selectOption('c2');await expect(page.locator('.team-person-card')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Congregación',exact:true}).selectOption('c1');
  await page.locator('.team-person-card').getByRole('button',{name:'Ver Audio y vídeo'}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Editar',exact:true}).click();
  await dialog.getByLabel('Sorda u oyente').selectOption('hearing');page.once('dialog',d=>d.dismiss());await dialog.getByRole('button',{name:'Ver trayectoria'}).click();await expect(dialog.getByLabel('Sorda u oyente')).toHaveValue('hearing');await dialog.getByRole('button',{name:'Guardar ficha'}).click();
  await dialog.getByRole('button',{name:'Volver',exact:true}).click();
  await expect(page.locator('.team-person-card')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Sorda u oyente',exact:true}).selectOption('hearing');await expect(page.locator('.team-person-card')).toHaveCount(1);
});
test('directorio: edita y añade sin crear candidaturas, y conserva al recargar',async({page})=>{
  await nav(page,'Equipo');await page.getByRole('button',{name:'Directorio',exact:true}).click();
  await expect(page.getByRole('region',{name:'Estadísticas: Personas'}).locator('dd').first()).toHaveText('7');
  await page.getByRole('button',{name:'Ver ficha de Elena Vidal',exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Editar ficha'}).click();
  await dialog.getByLabel('Sorda u oyente').selectOption('deaf');await dialog.getByRole('button',{name:'Guardar ficha'}).click();await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'Añadir persona',exact:true}).click();dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('Sorda u oyente')).toHaveValue('unknown');
  await dialog.getByLabel('Nombre completo').fill('Persona de prueba');await dialog.getByRole('combobox',{name:'Congregación',exact:true}).selectOption('c1');
  await dialog.getByRole('button',{name:'Guardar ficha'}).click();await expect(dialog).toHaveCount(0);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!));expect(saved.candidates).toHaveLength(8);expect(saved.persons).toHaveLength(8);
  await page.reload();await nav(page,'Equipo');await page.getByRole('button',{name:'Directorio',exact:true}).click();await expect(page.getByRole('heading',{name:'Persona de prueba',exact:true})).toBeVisible();
});
test('trayectoria: años, eventos archivados, asistencia y reservas sin turno',async({page})=>{
  await nav(page,'Más');await page.getByRole('button',{name:'Histórico',exact:true}).click();await expect(page.getByRole('heading',{name:'2025',exact:true})).toBeVisible();
  await expect(page.locator('.history-event').filter({has:page.getByRole('heading',{name:'Asamblea anterior',exact:true})})).toContainText('Presente');
  await page.getByRole('combobox',{name:'Año',exact:true}).selectOption('2025');await expect(page.locator('.history-event')).toHaveCount(1);
  await page.getByRole('button',{name:'Filtros del histórico',exact:false}).click();
  await page.getByRole('button',{name:'Limpiar filtros'}).click();
  await page.getByRole('combobox',{name:'Persona',exact:true}).selectOption('p6');await expect(page.locator('.history-person-summary')).toContainText('Marcos León');
  await page.getByRole('combobox',{name:'Persona',exact:true}).selectOption('p1');await expect(page.locator('.history-person-summary')).toContainText('1 evento anterior con turno · 1 con presencia registrada');
  await page.getByRole('button',{name:'Volver',exact:true}).click();await page.getByRole('button',{name:'Departamentos',exact:true}).click();
  await nav(page,'Equipo');await page.locator('.team-person-card').filter({has:page.getByRole('heading',{name:'Lucía Martín',exact:true})}).getByRole('button',{name:'Ver Audio y vídeo'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Ver trayectoria'}).click();
  await page.getByRole('button',{name:/Filtros del histórico/}).click();
  await expect(page.getByRole('combobox',{name:'Persona',exact:true})).toHaveValue('p1');await expect(page.locator('.history-event')).toHaveCount(2);
});
test('cancelación y conflicto conservan el formulario y no confirman un guardado fallido',async({page})=>{
  await nav(page,'Equipo');await page.getByRole('button',{name:'Directorio',exact:true}).click();await page.getByRole('button',{name:'Ver ficha de Elena Vidal',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Editar ficha'}).click();await dialog.getByLabel('Nombre completo').fill('Nombre sin guardar');
  page.once('dialog',d=>d.dismiss());await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(dialog.getByLabel('Nombre completo')).toHaveValue('Nombre sin guardar');
  await page.evaluate(()=>{const key='ls-asambleas:demo:v1',data=JSON.parse(localStorage.getItem(key)!);data.persons[0].revision=99;localStorage.setItem(key,JSON.stringify(data));});
  await dialog.getByRole('button',{name:'Guardar ficha'}).click();await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByLabel('Nombre completo')).toHaveValue('Nombre sin guardar');
});
test('diseño responsive, teclado, ampliación y accesibilidad con datos ficticios',async({page})=>{
  for(const width of [390,820,1440]){
    await page.setViewportSize({width,height:1000});await nav(page,'Equipo');
    await page.screenshot({path:`qa/history-team/team-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Directorio',exact:true}).click();await page.screenshot({path:`qa/history-team/directory-${width}.png`,fullPage:true});
    const directoryResult=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(directoryResult.violations.map(v=>v.id)).toEqual([]);
    await nav(page,'Más');await page.getByRole('button',{name:'Histórico',exact:true}).click();await page.screenshot({path:`qa/history-team/history-${width}.png`,fullPage:true});
    const historyResult=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(historyResult.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await nav(page,'Equipo');await page.getByRole('button',{name:'Directorio',exact:true}).click();const opener=page.getByRole('button',{name:'Ver ficha de Elena Vidal',exact:true});await opener.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(opener).toBeFocused();
  await page.setViewportSize({width:720,height:1000});await page.addStyleTag({content:':root{font-size:36px!important}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
