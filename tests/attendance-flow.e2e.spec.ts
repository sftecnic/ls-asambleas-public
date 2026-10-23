import {openOptions} from './ui-navigation';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';

test('los completados antiguos se leen como presentes sin migrar y la consulta no tiene controles',async({page,context})=>{
  const data=createDemoData();data.shifts[0].attendance='completed';data.publications[0].shifts[0].attendance='completed';
  await page.clock.install({time:new Date('2027-04-10T08:30:00Z')});
  await page.addInitScript(data=>localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data)),data);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const camera=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
  await expect(camera.getByRole('button',{name:'Presente',exact:true})).toHaveAttribute('aria-pressed','true');
  await camera.getByRole('button',{name:'Presente',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
  await expect(page.getByRole('button',{name:/Completado|Volver a presente|Desmarcar/})).toHaveCount(0);
  await openOptions(page); await page.getByRole('button',{name:'Ver publicado',exact:true}).click();
  await expect(camera.locator('.attendance-status')).toHaveText('Presente');
  await expect(camera.getByRole('button')).toHaveCount(0);
  await page.emulateMedia({media:'print'});await expect(camera.locator('.attendance-status')).toBeVisible();
  await page.emulateMedia({media:'screen'});
  await openOptions(page); await page.getByRole('button',{name:'Guardar consulta',exact:true}).click();
  await page.getByLabel('Este dispositivo es de uso personal').check();
  await page.getByRole('dialog').getByRole('button',{name:'Guardar consulta',exact:true}).click();
  await expect(page.getByText('Consulta guardada para usar sin conexión.')).toBeVisible();
  await context.setOffline(true);await expect(page.getByText('Sin conexión · Solo consulta',{exact:true})).toBeVisible();
  await expect(camera.locator('.attendance-status')).toHaveText('Presente');
  await expect(page.locator('.attendance-options')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
});

test('Sustituir está dentro de Editar, conserva un solo diálogo y protege los cambios sin guardar',async({page})=>{
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const camera=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
  await expect(camera.getByRole('button',{name:'Sustituir',exact:true})).toHaveCount(0);
  const edit=camera.getByRole('button',{name:'Editar',exact:true});await edit.click();
  const dialog=page.getByRole('dialog',{name:'Editar turno'});
  await dialog.evaluate(el=>el.setAttribute('data-same-dialog','yes'));
  await expect(dialog.getByRole('combobox',{name:'Persona',exact:true})).toHaveCount(0);
  for(const width of [390,820,1440]){
    await page.setViewportSize({width,height:1000});
    await expect(dialog.getByRole('button',{name:'Sustituir',exact:true})).toBeVisible();
    await dialog.screenshot({path:`qa/attendance-flow/edit-${width}.png`});
  }
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
  const original=await dialog.getByLabel('Punto de encuentro').inputValue();
  await dialog.getByLabel('Punto de encuentro').fill('Cambio sin guardar');
  page.once('dialog',message=>message.dismiss());await dialog.getByRole('button',{name:'Sustituir',exact:true}).click();
  await expect(dialog.getByLabel('Punto de encuentro')).toHaveValue('Cambio sin guardar');
  page.once('dialog',message=>message.accept());await dialog.getByRole('button',{name:'Sustituir',exact:true}).click();
  const replacement=page.getByRole('dialog',{name:'Sustituir persona'});
  await expect(page.locator('dialog[open]')).toHaveCount(1);await expect(replacement).toHaveAttribute('data-same-dialog','yes');
  await expect(replacement.getByLabel('Nueva persona')).toBeFocused();
  await expect(replacement).toContainText('Lucía Martín');
  await replacement.getByRole('button',{name:'Volver',exact:true}).click();
  await expect(dialog.getByLabel('Punto de encuentro')).toHaveValue(original);
  await expect(dialog.getByRole('button',{name:'Sustituir',exact:true})).toBeFocused();
  await dialog.getByRole('button',{name:'Sustituir',exact:true}).click();
  await replacement.getByLabel('Nueva persona').selectOption('p6');
  for(const width of [390,820,1440]){
    await page.setViewportSize({width,height:1000});
    await expect(replacement.getByRole('button',{name:'Guardar sustitución',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await replacement.screenshot({path:`qa/attendance-flow/replacement-${width}.png`});
  }
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
  page.once('dialog',message=>message.dismiss());await replacement.getByRole('button',{name:'Volver',exact:true}).click();
  await expect(replacement.getByLabel('Nueva persona')).toHaveValue('p6');
  page.once('dialog',message=>message.accept());await replacement.getByRole('button',{name:'Volver',exact:true}).click();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(edit).toBeFocused();
  expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
});

test('la sustitución exige aprobación y aceptación y bloquea solapes entre eventos',async({page})=>{
  const data=createDemoData();
  data.grants.push({...data.grants[0],id:'pending-assistant',personId:'p2',email:'pending@example.test',uid:undefined,role:'assistant',eventId:'e1',departmentId:'video'});
  data.shifts.push({...data.shifts[0],id:'other-event',personId:'p6',eventId:'e2',status:'draft'});
  await page.addInitScript(data=>localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data)),data);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const camera=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
  await camera.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Sustituir',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Sustituir persona'}),select=dialog.getByLabel('Nueva persona');
  await expect(select.locator('option[value="p2"]')).toHaveCount(0);
  await select.selectOption('p6');await dialog.getByRole('button',{name:'Guardar sustitución',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('ya tiene un turno');await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
});
