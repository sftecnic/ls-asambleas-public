import {openOptions} from './ui-navigation';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({page})=>{await page.goto('/'); await expect(page.getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();});
test('distingue los eventos simultáneos y el acceso de voluntario',async({page})=>{
  await page.getByLabel('Elegir evento').selectOption('e2');
  await expect(page.getByText('Salón del Este · Zaragoza',{exact:true})).toBeVisible();
  await expect(page.getByText('No tienes reuniones ni turnos publicados pendientes en este evento.')).toBeVisible();
  await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Mis turnos',exact:true})).toBeVisible();
  await expect(page.getByLabel('Elegir evento')).toHaveValue('e1');
  await expect(page.getByRole('navigation',{name:'Principal'}).getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'Publicar',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Instrucciones',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Instrucciones'})).toContainText('09:30');
});
test('bloquea solapes, conserva el publicado y crea una versión nueva',async({page})=>{
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await page.getByRole('button',{name:'Añadir turno'}).click();
  const form=page.getByRole('dialog',{name:'Añadir turno'});
  await form.getByLabel('Puesto',{exact:true}).fill('Audio');
  await form.getByRole('combobox',{name:'Persona',exact:true}).selectOption('p1');
  await form.getByRole('button',{name:'Guardar borrador'}).click();
  await expect(form.getByRole('alert')).toContainText('ya tiene un turno');
  await form.getByLabel('Inicio',{exact:true}).fill('2027-04-10T14:00');
  await form.getByLabel('Fin',{exact:true}).fill('2027-04-10T16:00');
  await form.getByRole('button',{name:'Guardar borrador'}).click();
  await expect(form).not.toBeVisible();
  await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Audio',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Ver responsable',exact:true}).click();
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await page.getByRole('button',{name:'Publicar',exact:true}).click();
  await page.getByRole('dialog',{name:'Publicar versión'}).getByRole('button',{name:'Publicar',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Audio',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Audio',exact:true})).toBeVisible();
});
test('registra sustitución y mantiene el servicio original en histórico',async({page})=>{
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const card=page.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  await card.getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByRole('dialog',{name:'Editar turno'}).getByRole('button',{name:'Sustituir',exact:true}).click();
  await page.getByLabel('Nueva persona').selectOption('p6');
  await page.getByRole('button',{name:'Guardar sustitución'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Sustituido',{exact:true})).toBeVisible();
  await expect(page.locator('.person-line').filter({hasText:'Marcos León'})).toHaveCount(2);
  await page.getByRole('button',{name:'Más',exact:true}).click();
  await page.getByRole('button',{name:'Histórico',exact:true}).click();
  await page.getByRole('button',{name:'Cambios',exact:true}).click();
  await expect(page.getByText(/Sustitución en Cámara/)).toBeVisible();
});
test('la desconexión solo muestra una copia explícita y el cierre de sesión la elimina',async({page,context})=>{
  await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();
  await openOptions(page); await page.getByRole('button',{name:'Guardar consulta',exact:true}).click();
  await page.getByLabel('Este dispositivo es de uso personal').check();
  await page.getByRole('dialog').getByRole('button',{name:'Guardar consulta',exact:true}).click();
  await expect(page.getByText('Consulta guardada para usar sin conexión.')).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Sin conexión · Solo consulta',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Cámara',exact:true})).toBeVisible();
  await expect(page.getByText(/Puede estar desactualizado/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Publicar',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Salir',exact:true}).click();
  await expect(page.getByText('Sin conexión. No hay una copia guardada para consultar.')).toBeVisible();
});
test('las pantallas caben en móvil, tableta y escritorio',async({page},testInfo)=>{
  for(const [name,width,height] of [['movil',390,844],['tableta',820,1180],['escritorio',1440,1000]] as const){
    await page.setViewportSize({width,height});
    await page.getByRole('button',{name:'Inicio',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`qa/inicio-${name}.png`,fullPage:true});
    await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Equipo',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`qa/equipo-${name}.png`,fullPage:true});
    await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Programa',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`qa/programa-${name}.png`,fullPage:true});
  }
});
