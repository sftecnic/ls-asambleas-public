import {test, expect, type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';
import {emptyData, type AppData} from '../src/domain/types';

function fixture() {
  const data=createDemoData();
  data.grants[1]={...data.grants[1],role:'responsible',capabilities:['view','assign','contacts']};
  data.persons.find(p=>p.id==='p6')!.gmail='marcos.demostracion.ls@gmail.com';
  data.persons.find(p=>p.id==='p4')!.name='Pablo de los Santos Villanueva de la Sierra';
  data.grants.push({...data.grants[1],id:'g-east',eventId:'e2',email:'este@example.test',personId:'p4'});
  return data;
}
async function start(page:Page,data:AppData=fixture()) {
  await page.addInitScript(value=>{if(!localStorage.getItem('ls-asambleas:demo:v1'))localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(value));},data);
  await page.goto('/');await expect(page.getByRole('region',{name:'Demostración'})).toBeVisible();
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Más',exact:true}).click();
  if(await page.getByRole('button',{name:'Permisos',exact:true}).isVisible())await page.getByRole('button',{name:'Permisos',exact:true}).click();
}
async function editLucia(page:Page) {
  await page.locator('.access-row').filter({has:page.getByRole('heading',{name:'Lucía Martín',exact:true})}).getByRole('button',{name:'Cambiar permisos'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Continuar',exact:true}).click();
  return page.getByRole('dialog');
}
const stored=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!));
test('instalación sin eventos permite revisar administración sin crear accesos sin ámbito',async({page})=>{
  const source=createDemoData(),data={...emptyData(),grants:[source.grants[0]],persons:[source.persons[0]],congregations:source.congregations};await start(page,data);
  await expect(page.getByRole('button',{name:'Dar acceso',exact:true})).toBeDisabled();await expect(page.getByRole('region',{name:'Administración general',exact:true})).toContainText('Elena Vidal');
  await page.getByRole('button',{name:'Cambiar permisos',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Todas las asambleas y departamentos');
});
test('ámbito por evento, filtros conservados y administración general aparte',async({page})=>{
  await start(page);const section=page.getByRole('region',{name:'Permisos de esta asamblea'});
  await expect(section).toContainText('Oviedo');await expect(section.locator('.access-row')).toHaveCount(1);
  await expect(section).not.toContainText('este@example.test');await expect(page.getByRole('region',{name:'Administración general',exact:true})).toContainText('Todas las asambleas');
  await page.getByLabel('Buscar persona o Gmail',{exact:true}).fill('nadie');await expect(section).toContainText('No hay accesos');
  await page.getByRole('button',{name:'Volver',exact:true}).click();if(await page.getByRole('button',{name:'Permisos',exact:true}).isVisible())await page.getByRole('button',{name:'Permisos',exact:true}).click();await expect(page.getByLabel('Buscar persona o Gmail',{exact:true})).toHaveValue('nadie');
  await page.getByLabel('Buscar persona o Gmail',{exact:true}).fill('');await page.getByLabel('Elegir evento').selectOption('e2');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Más',exact:true}).click();if(await page.getByRole('button',{name:'Permisos',exact:true}).isVisible())await page.getByRole('button',{name:'Permisos',exact:true}).click();
  await expect(section).toContainText('Zaragoza');await expect(section).toContainText('este@example.test');await expect(section).not.toContainText('voluntario@example.test');
});
test('gestión a consulta conserva identidad, revisa retiradas y persiste sin cambiar cargo',async({page})=>{
  const data=fixture();await start(page,data);const dialog=await editLucia(page);
  await dialog.getByRole('radio',{name:/Consulta/}).check();await expect(dialog.locator('.access-identity')).toContainText('Lucía Martín');
  await dialog.getByRole('button',{name:'Revisar',exact:true}).click();await expect(dialog).toContainText('Se retira');await expect(dialog).toContainText('Organizar turnos');await expect(dialog).toContainText('Gestionar datos personales');
  await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();await expect(dialog).not.toBeVisible();
  const saved=await stored(page),grant=saved.grants.find((g:any)=>g.id==='g-vol');
  expect(grant).toMatchObject({personId:'p1',email:'voluntario@example.test',eventId:'e1',departmentId:'video',role:'volunteer',capabilities:['view'],active:true});
  expect(saved.candidates).toEqual(data.candidates);expect(saved.shifts).toEqual(data.shifts);expect(saved.publications).toEqual(data.publications);
  await page.reload();await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Más',exact:true}).click();if(await page.getByRole('button',{name:'Permisos',exact:true}).isVisible())await page.getByRole('button',{name:'Permisos',exact:true}).click();
  await expect(page.locator('.access-row').filter({hasText:'Lucía Martín'})).toContainText('Consulta');
});
test('gestión conserva responsible, solo asigna acciones elegidas y cancela sin perder formulario',async({page})=>{
  await start(page);const dialog=await editLucia(page);
  await dialog.getByRole('checkbox',{name:/Editar equipo y reuniones/}).check();
  page.once('dialog',d=>d.dismiss());await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:/Editar equipo y reuniones/})).toBeChecked();
  page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Revisar',exact:true}).click();await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();
  const grant=(await stored(page)).grants.find((g:any)=>g.id==='g-vol');expect(grant.role).toBe('responsible');expect(grant.capabilities.sort()).toEqual(['view','assign','contacts','edit'].sort());
});
test('alta con comprobaciones tempranas, duplicados y consulta de Gmail autorizada',async({page})=>{
  await start(page);await page.getByRole('button',{name:'Dar acceso',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('combobox',{name:'Persona',exact:true}).selectOption('p2');await expect(dialog).toContainText('Falta la aprobación del comité');await expect(dialog).toContainText('Falta un Gmail válido');await expect(dialog.getByRole('button',{name:'Continuar',exact:true})).toBeDisabled();
  await dialog.getByRole('combobox',{name:'Persona',exact:true}).selectOption('p1');await expect(dialog).toContainText('ya tiene un acceso');
  await dialog.getByRole('combobox',{name:'Persona',exact:true}).selectOption('p6');await dialog.getByRole('button',{name:'Continuar',exact:true}).click();
  await dialog.getByRole('radio',{name:/Gestión/}).check();await expect(dialog.getByRole('checkbox',{name:/^Consultar/})).toBeChecked();await expect(dialog.getByRole('checkbox',{name:/^Consultar/})).toBeDisabled();
  await dialog.getByRole('checkbox',{name:/Organizar turnos/}).check();await dialog.getByRole('button',{name:'Revisar',exact:true}).click();await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();
  expect((await stored(page)).grants.find((g:any)=>g.personId==='p6')).toMatchObject({role:'assistant',capabilities:['view','assign']});
});
test('delegación limitada sin Gmail privado no se describe como Gmail ausente',async({page})=>{
  const data=fixture();data.grants[0]={...data.grants[0],role:'assistant',eventId:'e1',departmentId:'video',capabilities:['view','manageAccess','assign']};
  await start(page,data);await expect(page.getByRole('region',{name:'Administración general',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Dar acceso',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Persona',exact:true}).selectOption('p6');await expect(dialog).toContainText('No puedes consultar el Gmail');await expect(dialog).not.toContainText('Falta un Gmail válido');
  page.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
  await editLucia(page);await expect(dialog.getByRole('checkbox',{name:/Editar equipo y reuniones/})).toBeDisabled();await expect(dialog.getByRole('checkbox',{name:/Publicar y convocar/})).toBeDisabled();
  await dialog.getByRole('radio',{name:/Consulta/}).check();await dialog.getByRole('button',{name:'Revisar',exact:true}).click();await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();await expect(dialog).not.toBeVisible();
});
test('concurrencia conserva formulario, no pisa cambios nuevos',async({page})=>{
  await start(page);const dialog=await editLucia(page);await dialog.getByRole('checkbox',{name:/Editar equipo y reuniones/}).check();
  await page.evaluate(()=>{const key='ls-asambleas:demo:v1',data=JSON.parse(localStorage.getItem(key)!);data.grants.find((g:any)=>g.id==='g-vol').revision=10;localStorage.setItem(key,JSON.stringify(data));window.dispatchEvent(new StorageEvent('storage',{key,newValue:JSON.stringify(data)}));});
  await dialog.getByRole('button',{name:'Revisar',exact:true}).click();await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('ha cambiado');
  await dialog.getByRole('button',{name:'Volver',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:/Editar equipo y reuniones/})).toBeChecked();expect((await stored(page)).grants.find((g:any)=>g.id==='g-vol').revision).toBe(10);
});
test('última administración no se retira; formulario y foco de error conservados',async({page})=>{
  await start(page);await page.getByRole('region',{name:'Administración general',exact:true}).getByRole('button',{name:'Cambiar permisos'}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('checkbox',{name:'Puede entrar',exact:true}).uncheck();await dialog.getByRole('button',{name:'Revisar',exact:true}).click();await expect(dialog).toContainText('Se retirará este acceso');await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Debe quedar');
  expect(await dialog.getByRole('alert').evaluate(el=>el.parentElement===document.activeElement)).toBe(true);expect((await stored(page)).grants.find((g:any)=>g.id==='g-admin').active).toBe(true);
});
test('dar administración general exige revisión explícita del ámbito y conserva los cargos',async({page})=>{
  const data=fixture();await start(page,data);await page.getByRole('button',{name:'Añadir administrador',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('combobox',{name:'Persona',exact:true}).selectOption('p6');await expect(dialog).toContainText('Todas las asambleas y departamentos');expect((await stored(page)).grants.filter((g:any)=>g.role==='admin')).toHaveLength(1);
  await dialog.getByRole('button',{name:'Revisar',exact:true}).click();await expect(dialog).toContainText('Este cambio afecta al acceso general');await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();
  const saved=await stored(page);expect(saved.grants.find((g:any)=>g.personId==='p6')).toMatchObject({role:'admin',eventId:'*',departmentId:'*',active:true});expect(saved.candidates).toEqual(data.candidates);
});
test('fallo de guardado, reintento y retirada de un acceso sin afectar a los demás',async({page})=>{
  await start(page);const dialog=await editLucia(page);await dialog.getByRole('checkbox',{name:'Puede entrar',exact:true}).uncheck();await dialog.getByRole('button',{name:'Revisar',exact:true}).click();
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='ls-asambleas:demo:v1'){Storage.prototype.setItem=original;throw new DOMException('Prueba ficticia de guardado','QuotaExceededError');}return original.call(this,key,value);};});
  await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('No se ha podido guardar');await expect(dialog).toContainText('Se retirará este acceso');expect((await stored(page)).grants.find((g:any)=>g.id==='g-vol').active).toBe(true);
  await dialog.getByRole('button',{name:'Guardar permisos',exact:true}).click();await expect(dialog).not.toBeVisible();const saved=await stored(page);expect(saved.grants.find((g:any)=>g.id==='g-vol').active).toBe(false);expect(saved.grants.find((g:any)=>g.id==='g-east').active).toBe(true);expect(saved.audit).toHaveLength(2);
});
test('sin conexión conserva lo elegido; navegación pide descartar y cancelar mantiene la ficha',async({page,context})=>{
  await start(page);const dialog=await editLucia(page);await dialog.getByRole('checkbox',{name:/Editar equipo y reuniones/}).check();await dialog.getByRole('button',{name:'Revisar',exact:true}).click();
  await context.setOffline(true);await expect(dialog).not.toBeVisible();await expect(page.getByText('Sin conexión · Solo consulta',{exact:true})).toBeVisible();await context.setOffline(false);await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Más',exact:true}).click();await expect(dialog.getByRole('button',{name:'Guardar permisos',exact:true})).toBeEnabled();
  page.once('dialog',d=>d.dismiss());expect(await page.evaluate(()=>window.dispatchEvent(new Event('ls:before-navigate',{cancelable:true})))).toBe(false);await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Volver',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:/Editar equipo y reuniones/})).toBeChecked();
  page.once('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(dialog).not.toBeVisible();expect((await stored(page)).audit).toHaveLength(1);
});
test('móvil, tableta, escritorio, texto grande, teclado y contraste',async({page})=>{
  test.setTimeout(120000);await start(page);
  for(const width of [320,390,820,1440]){
    await page.setViewportSize({width,height:1000});await page.screenshot({path:`qa/permissions/list-${width}.png`,fullPage:true});
    const dialog=await editLucia(page);await dialog.getByRole('radio',{name:/Gestión/}).focus();await page.keyboard.press('Space');
    await expect(dialog.getByRole('radio',{name:/Gestión/})).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    const targets=await dialog.locator('.access-mode label,.access-capability>label,.access-actions button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));expect(targets.every(h=>h>=48)).toBe(true);
    expect((await new AxeBuilder({page}).include('dialog').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await page.screenshot({path:`qa/permissions/actions-${width}.png`});await dialog.getByRole('button',{name:'Revisar',exact:true}).click();await page.screenshot({path:`qa/permissions/review-${width}.png`});await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
  }
  await page.setViewportSize({width:720,height:500});await page.evaluate(()=>document.documentElement.style.fontSize='36px');const dialog=await editLucia(page);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:'qa/permissions/text-200.png'});
});
