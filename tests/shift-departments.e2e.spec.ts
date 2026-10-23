import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';

test('groups shifts by department, session, time and post, including future departments',async({page},testInfo)=>{
  const data=createDemoData(),base=data.shifts[0];
  data.departments.reverse();
  data.departments.push({id:'new-z',name:'Zona de apoyo',icon:'video'},{id:'new-a',name:'Acogida',icon:'other'},{id:'new-empty',name:'Sin turnos',icon:'other'});
  data.shifts.push(
    {...base,id:'camera-10',role:'Cámara 10',personId:'p2'},
    {...base,id:'camera-2-sara',role:'Cámara 2',personId:'p3'},
    {...base,id:'camera-2-david',role:'Cámara 2',personId:'p2'},
    {...base,id:'audio-early',role:'Audio',startsAt:'2027-04-10T07:00:00.000Z',endsAt:'2027-04-10T08:00:00.000Z'},
    {...base,id:'makeup',departmentId:'makeup',role:'Maquillaje',personId:'p5'},
    {...base,id:'future-z',departmentId:'new-z',role:'Apoyo',personId:'p2'},
    {...base,id:'future-a',departmentId:'new-a',role:'Recepción',personId:'p3'},
    {...base,id:'other-day',eventId:'e2',departmentId:'makeup',role:'Otro día',startsAt:'2027-04-11T06:00:00.000Z',endsAt:'2027-04-11T07:00:00.000Z'}
  );data.shifts.reverse();
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
  const sections=page.locator('.shift-departments > .shift-department');
  const names=['Audio y vídeo','Plataforma','Maquillaje','Acogida','Zona de apoyo'];
  await expect(sections.locator('h2')).toHaveText(names);
  const video=page.getByRole('region',{name:'Audio y vídeo',exact:true});
  await expect(video.locator('.shift-session-heading h3')).toHaveText(['Mañana','Tarde']);
  const morning=video.getByRole('region',{name:'Mañana',exact:true});
  await expect(morning.locator('.shift-card h4')).toHaveText(['Cámara','Cámara 2','Cámara 2','Cámara 10','Audio']);
  await expect(morning.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara 2',exact:true})}).locator('.person-line strong')).toHaveText(['David Romero','Sara Gil']);
  await expect(page.getByRole('heading',{name:'Otro día',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Ver lista',exact:true}).click();await expect(sections.locator('h2')).toHaveText(names);
  await expect(video.locator('.shift-department-list')).toHaveCount(1);
  await page.getByRole('button',{name:'Por sesión',exact:true}).click();
  await page.getByLabel('Departamento',{exact:true}).selectOption('new-a');await expect(sections.locator('h2')).toHaveText(['Acogida']);
  await page.getByRole('button',{name:'Añadir turno',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('combobox',{name:'Departamento',exact:true})).toHaveValue('new-a');
  await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByLabel('Departamento',{exact:true}).selectOption('new-empty');await expect(page.getByText('No hay turnos de Sin turnos para este día.',{exact:true})).toBeVisible();
  await page.getByLabel('Departamento',{exact:true}).selectOption('all');
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(a11y.violations).toEqual([]);
  for(const [width,height] of [[390,844],[820,1180],[1440,1000]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`shifts-${width}.png`)});
    await video.screenshot({path:testInfo.outputPath(`video-${width}.png`)});
  }
  await page.emulateMedia({media:'print'});await expect(sections.locator('h2')).toHaveText(names);await expect(page.getByRole('button',{name:'Añadir turno',exact:true})).toBeHidden();
  await page.emulateMedia({media:'screen'});
  expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
  await page.getByLabel('Elegir evento').selectOption('e2');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await expect(page.getByText('No hay turnos para este día.',{exact:true})).toBeVisible();
  await page.getByLabel('Día',{exact:true}).fill('2027-04-11');await expect(sections.locator('h2')).toHaveText(['Maquillaje']);
  await expect(page.getByRole('heading',{name:'Otro día',exact:true})).toBeVisible();
});
