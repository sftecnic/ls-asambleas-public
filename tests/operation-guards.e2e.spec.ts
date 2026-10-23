import {openOptions} from './ui-navigation';
import {test,expect} from '@playwright/test';
import {createDemoData} from '../src/seed';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();});

test('cancelar la eliminación conserva el borrador y confirmar lo elimina',async({page})=>{
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const card=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Vídeo',exact:true})});
  await card.getByRole('button',{name:'Editar',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Editar turno'});
  page.once('dialog',message=>message.dismiss());await dialog.getByRole('button',{name:'Eliminar borrador'}).click();
  await expect(dialog).toBeVisible();await expect(card).toBeVisible();
  page.once('dialog',message=>message.accept());await dialog.getByRole('button',{name:'Eliminar borrador'}).click();
  await expect(dialog).toHaveCount(0);await expect(card).toHaveCount(0);
});

test('Cerrar y Escape conservan los cambios hasta confirmar la salida',async({page})=>{
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await page.getByRole('button',{name:'Añadir turno'}).click();const shift=page.getByRole('dialog',{name:'Añadir turno'});
  await shift.getByLabel('Puesto',{exact:true}).fill('Puesto sin guardar');
  page.once('dialog',message=>message.dismiss());await shift.getByRole('button',{name:'Cerrar',exact:true}).click();
  await expect(shift.getByLabel('Puesto',{exact:true})).toHaveValue('Puesto sin guardar');
  page.once('dialog',message=>message.accept());await page.keyboard.press('Escape');await expect(shift).toHaveCount(0);
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Programa',exact:true}).click();
  await page.getByRole('button',{name:'Añadir intervención'}).click();const program=page.getByRole('dialog',{name:'Añadir intervención'});
  await program.getByLabel('Título',{exact:true}).fill('Participación sin guardar');
  page.once('dialog',message=>message.dismiss());await page.keyboard.press('Escape');
  await expect(program.getByLabel('Título',{exact:true})).toHaveValue('Participación sin guardar');
  page.once('dialog',message=>message.dismiss());expect(await page.evaluate(()=>window.dispatchEvent(new Event('ls:before-navigate',{cancelable:true})))).toBe(false);
  await expect(program).toBeVisible();
  page.once('dialog',message=>message.accept());expect(await page.evaluate(()=>window.dispatchEvent(new Event('ls:before-navigate',{cancelable:true})))).toBe(true);
  await expect(program).toHaveCount(0);
});

test('la ausencia se registra, persiste y puede corregirse a presente',async({page})=>{
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const camera=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  await camera.getByRole('button',{name:'Ausente',exact:true}).click();await expect(camera.getByRole('button',{name:'Ausente',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.reload();await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await expect(camera.getByRole('button',{name:'Ausente',exact:true})).toHaveAttribute('aria-pressed','true');
  await camera.getByRole('button',{name:'Presente',exact:true}).click();await expect(camera.getByRole('button',{name:'Presente',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('tres opciones fijas permiten corregir toda asistencia sin perder el histórico',async({page})=>{
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const camera=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  await expect(camera.locator('.attendance-options button')).toHaveText(['Sin marcar','Presente','Ausente']);
  await camera.getByRole('button',{name:'Presente',exact:true}).click();
  await expect(camera.getByRole('button',{name:'Presente',exact:true})).toHaveAttribute('aria-pressed','true');
  const marked=await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!));
  for(const width of [390,820,1440]){
    await page.setViewportSize({width,height:1000});await camera.scrollIntoViewIfNeeded();
    await expect(camera.getByRole('button',{name:'Sin marcar',exact:true})).toBeVisible();
    await expect(camera.getByRole('button',{name:'Ausente',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const button of await camera.locator('.attendance-options button').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await camera.screenshot({path:`qa/attendance-flow/attendance-${width}.png`});
  }
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(axe.violations.map(v=>v.id)).toEqual([]);
  const scale=await page.addStyleTag({content:':root{font-size:36px!important}'});await page.setViewportSize({width:720,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await scale.evaluate(el=>el.remove());await page.setViewportSize({width:1440,height:1000});
  await camera.getByRole('button',{name:'Presente',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!).audit)).toEqual(marked.audit);
  for(const mark of ['Ausente','Sin marcar','Presente','Sin marcar','Ausente','Presente','Sin marcar']){
    const button=camera.getByRole('button',{name:mark,exact:true});await button.focus();await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed','true');await expect(button).toBeFocused();
    await expect(camera.locator('.attendance-options button')).toHaveText(['Sin marcar','Presente','Ausente']);
  }
  await page.reload();await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await expect(camera.getByRole('button',{name:'Sin marcar',exact:true})).toHaveAttribute('aria-pressed','true');
  const cleared=await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!));
  const markedShift=marked.shifts.find((s:{id:string})=>s.id==='s1'),clearedShift=cleared.shifts.find((s:{id:string})=>s.id==='s1');
  expect(clearedShift).toEqual({...markedShift,attendance:'planned',revision:clearedShift.revision});
  expect(cleared.shifts.filter((s:{id:string})=>s.id!=='s1')).toEqual(marked.shifts.filter((s:{id:string})=>s.id!=='s1'));
  expect(cleared.publications).toEqual(marked.publications);
  expect(cleared.audit.slice(0,marked.audit.length)).toEqual(marked.audit);
  expect(cleared.audit.at(-1).action).toContain('Asistencia desmarcada');
});

test('el error de asistencia aparece en la ficha y un fallo no registra un resultado falso',async({page})=>{
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const camera=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  // Simulate a newer server/browser version without updating the currently open form.
  await page.evaluate(seed=>{const key='ls-asambleas:demo:v1',data=JSON.parse(localStorage.getItem(key)||JSON.stringify(seed));data.shifts[0].revision=99;localStorage.setItem(key,JSON.stringify(data));},createDemoData());
  await camera.getByRole('button',{name:'Presente',exact:true}).click();
  await expect(camera.getByRole('alert')).toContainText('Otra persona ha cambiado');
  await expect(camera.getByRole('button',{name:'Sin marcar',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(camera.getByRole('button',{name:'Presente',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(camera.getByRole('button',{name:'Presente',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!).shifts[0].attendance)).toBe('planned');
  await page.setViewportSize({width:390,height:844});await camera.scrollIntoViewIfNeeded();
  await expect(camera.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await camera.screenshot({path:'qa/attendance-save/error-mobile.png'});
});

test('indica el guardado en curso y evita pulsaciones repetidas hasta confirmar',async({page})=>{
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const camera=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  await page.evaluate(()=>{void navigator.locks.request('ls-asambleas:demo:v1',()=>new Promise<void>(resolve=>{(window as unknown as {releaseAttendance:()=>void}).releaseAttendance=resolve;}));});
  await page.waitForFunction(()=>typeof (window as unknown as {releaseAttendance?:unknown}).releaseAttendance==='function');
  await camera.getByRole('button',{name:'Presente',exact:true}).click();
  await expect(camera.getByRole('status')).toHaveText('Guardando…');
  await expect(camera.getByRole('button',{name:'Presente',exact:true})).toBeDisabled();
  await expect(camera.getByRole('button',{name:'Ausente',exact:true})).toBeDisabled();
  await expect(camera.getByRole('button',{name:'Sin marcar',exact:true})).toHaveAttribute('aria-pressed','true');
  await camera.getByRole('button',{name:'Ausente',exact:true}).dispatchEvent('click');
  await camera.screenshot({path:'qa/attendance-save/saving-desktop.png'});
  await page.evaluate(()=>(window as unknown as {releaseAttendance:()=>void}).releaseAttendance());
  await expect(camera.getByRole('button',{name:'Presente',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(camera.getByRole('status')).toBeEmpty();
  await expect(camera.getByRole('button',{name:'Presente',exact:true})).toBeEnabled();
  await page.setViewportSize({width:390,height:844});await camera.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await camera.screenshot({path:'qa/attendance-save/present-mobile.png'});
});

test('la impresión identifica las versiones de cada departamento',async({page})=>{
  await openOptions(page); await page.getByRole('button',{name:'Ver publicado',exact:true}).click();
  await page.emulateMedia({media:'print'});
  await expect(page.locator('.print-only')).toBeVisible();
  await expect(page.locator('.print-only')).toContainText('Audio y vídeo · Versión 1');
  await expect(page.locator('.print-only')).toContainText('Plataforma · Versión 1');
  await expect(page.locator('.print-only')).toContainText('Versión vigente:');
});

test('Mis turnos omite el turno terminado y no muestra un borrador ajeno',async({page})=>{
  await page.clock.install({time:new Date('2027-04-10T10:00:00Z')});await page.reload();
  await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();
  await expect(page.locator('.home-personal')).not.toContainText('Cámara');
  await expect(page.locator('.home-personal')).not.toContainText('Vídeo');
  await expect(page.locator('.home-personal')).toContainText('No tienes reuniones ni turnos publicados pendientes');
});
