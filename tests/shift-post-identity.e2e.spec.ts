import {openOptions} from './ui-navigation';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';

function legacyPosts(){
  const data=createDemoData(),base=data.shifts[0];
  data.shifts=['Cámara','Ordenador','Mesa','Director'].map((role,i)=>({...base,id:`service-${i}`,role,substituteIds:[],
    startsAt:`2027-04-10T${String(6+i).padStart(2,'0')}:00:00.000Z`,endsAt:`2027-04-10T${String(7+i).padStart(2,'0')}:00:00.000Z`}));
  data.publications[0].shifts=structuredClone(data.shifts);
  return data;
}

test('uses the same video identity in personal services, instructions and the offline copy, keeping chronological service selection',async({page,context},testInfo)=>{
  const data=legacyPosts();
  await page.clock.install({time:new Date('2027-04-10T06:30:00.000Z')});
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();
  const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
  await page.clock.setSystemTime(new Date('2027-04-10T07:30:00.000Z'));
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.home-activity h3').first()).toHaveText('Vídeo');
  await expect(page.locator('.home-activity').first().locator('.shift-post .lucide-monitor-play')).toHaveCount(1);
  await expect(page.locator('.home-activity h3 .shift-post-label')).toHaveText(['Vídeo','Mesa','Director']);
  await expect(page.locator('.home-activity').first().locator('.shift-post-icon')).toHaveCSS('color','rgb(162, 28, 175)');
  const instructions=page.getByRole('button',{name:'Instrucciones',exact:true}).first();
  await instructions.focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog',{name:'Instrucciones'});
  await expect(dialog.getByRole('heading',{name:'Vídeo',exact:true})).toBeVisible();
  await expect(dialog.locator('.shift-post .lucide-monitor-play')).toHaveCount(1);
  await expect(dialog.locator('.shift-post-icon')).toHaveCSS('color','rgb(162, 28, 175)');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');await expect(instructions).toBeFocused();
  for(const [width,height] of [[390,844],[1440,1000]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`personal-post-${width}.png`)});
  }
  await page.setViewportSize({width:720,height:1000});await page.addStyleTag({content:':root{font-size:36px!important}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await openOptions(page); await page.getByRole('button',{name:'Guardar consulta',exact:true}).click();await page.getByLabel('Este dispositivo es de uso personal').check();
  await page.getByRole('dialog').getByRole('button',{name:'Guardar consulta',exact:true}).click();
  await expect(page.getByText('Consulta guardada para usar sin conexión.')).toBeVisible();
  await context.setOffline(true);await expect(page.getByText('Sin conexión · Solo consulta',{exact:true})).toBeVisible();
  await expect(page.locator('.home-activity h3').first()).toHaveText('Vídeo');await expect(page.locator('.home-activity').first().locator('.lucide-monitor-play')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Publicar',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
});

test('recognizes old published aliases while preserving raw values and department-specific suggestions',async({page})=>{
  const data=legacyPosts();
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
  await openOptions(page); await page.getByRole('button',{name:'Ver publicado',exact:true}).click();
  const video=page.getByRole('region',{name:'Audio y vídeo',exact:true});
  await expect(video.locator('.shift-card h4')).toHaveText(['Director','Mesa','Vídeo','Cámara']);
  await expect(video.locator('.shift-card h4 .shift-post-icon')).toHaveCount(4);
  await page.emulateMedia({media:'print'});await expect(video.locator('.shift-card h4')).toHaveText(['Director','Mesa','Vídeo','Cámara']);
  await page.emulateMedia({media:'screen'});await page.getByRole('button',{name:'Ver borradores',exact:true}).click();
  const old=video.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Vídeo',exact:true})});
  await old.getByRole('button',{name:'Editar',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Editar turno'});
  await expect(dialog.getByLabel('Puesto',{exact:true})).toHaveValue('Ordenador');
  expect(await dialog.locator('#shift-roles option').evaluateAll(options=>options.map(o=>(o as HTMLOptionElement).value))).toEqual(['Director','Mesa','Vídeo','Cámara','Audio']);
  await dialog.getByLabel('Puesto',{exact:true}).fill('Puesto propio');await expect(dialog.getByLabel('Puesto',{exact:true})).toHaveValue('Puesto propio');
  page.once('dialog',confirm=>confirm.accept());await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
});
