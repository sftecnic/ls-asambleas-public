import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';

test.setTimeout(60000);
function fixture(){
 const data=createDemoData();
 Object.assign(data.candidates[1],{teamRole:'responsible',committee:'approved',availability:'accepted'});
 data.candidates[5].teamRole='assistant';data.candidates[3].teamRole='responsible';
 data.persons.find(p=>p.id==='p2')!.phone='600 123 456';
 data.persons.find(p=>p.id==='p6')!.phone='+1 (202) 555-0123';
 data.persons.find(p=>p.id==='p4')!.phone='+34 611 123 456';
 data.persons.find(p=>p.id==='p3')!.phone='600123456 / 611123456';
 data.persons.find(p=>p.id==='p2')!.notes='Nota privada ficticia';
 data.persons.find(p=>p.id==='p2')!.hearingStatus='deaf';data.persons.find(p=>p.id==='p6')!.hearingStatus='hearing';
 return data;
}
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name,exact:true});
test.beforeEach(async({page,context})=>{
 await context.route('https://wa.me/**',route=>route.fulfill({contentType:'text/plain',body:'Enlace interceptado: no se contacta con WhatsApp.'}));
 await page.clock.install({time:new Date('2027-04-09T10:00:00Z')});
 await page.addInitScript(data=>{if(!localStorage.getItem('ls-asambleas:demo:v1'))localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},fixture());
 await page.goto('/');await expect(page.getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();
});

test('botones en fichas, turnos e histórico y apertura sin enviar mensajes',async({page})=>{
 await nav(page,'Equipo').click();
 const link=page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true});
 await expect(link).toHaveAttribute('href','https://wa.me/34600123456');
 await expect(page.getByRole('link',{name:'Abrir WhatsApp con Sara Gil',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Abrir WhatsApp con Elena Vidal',exact:true})).toHaveCount(0);
 const before=page.url(),popup=page.waitForEvent('popup');await link.click();const chat=await popup;
 await expect(chat).toHaveURL('https://wa.me/34600123456');expect(page.url()).toBe(before);await chat.close();
 await page.getByRole('button',{name:'Directorio',exact:true}).click();
 await expect(page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true})).toHaveAttribute('rel','noopener noreferrer');
 await nav(page,'Turnos').click();
 await expect(page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Abrir WhatsApp con Marcos León',exact:true}).first()).toBeVisible();
 await nav(page,'Más').click();await page.getByRole('button',{name:'Histórico',exact:true}).click();
 await expect(page.getByRole('link',{name:'Abrir WhatsApp con Marcos León',exact:true})).toBeVisible();
 await page.emulateMedia({media:'print'});await expect(page.locator('.person-whatsapp:visible')).toHaveCount(0);
 await expect(page.locator('.person-contact-actions:visible')).toHaveCount(0);
});

test('el voluntario consulta solo sus responsables, también antes de publicar y en instrucciones',async({page,context})=>{
 await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();
 const contacts=page.getByRole('region',{name:'Contactos de tus departamentos'});
 await expect(contacts.getByRole('link')).toHaveCount(2);
 await expect(contacts).toContainText('David Romero');await expect(contacts).toContainText('Marcos León');
 await expect(contacts.getByRole('button',{name:'Clasificación de David Romero: Sorda',exact:true})).toBeVisible();await expect(contacts.getByRole('button',{name:'Clasificación de Marcos León: Oyente',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:900});await page.screenshot({path:'qa/contact-icons/mis-turnos-390.png',fullPage:true});
 await expect(contacts).not.toContainText('Pablo Soto');await expect(page.getByText('Nota privada ficticia')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Abrir WhatsApp con Pablo Soto',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Instrucciones',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Instrucciones'});
 await expect(dialog.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true})).toHaveAttribute('href','https://wa.me/34600123456');await page.keyboard.press('Escape');
 await context.setOffline(true);await expect(page.locator('.person-contact-actions')).toHaveCount(0);await expect(contacts).toHaveCount(0);
 await context.setOffline(false);await expect(page.getByRole('region',{name:'Contactos de tus departamentos'}).getByRole('link')).toHaveCount(2);
 await page.getByRole('button',{name:'Ver responsable',exact:true}).click();await page.getByLabel('Elegir evento').selectOption('e2');await expect(page.locator('.person-whatsapp')).toHaveCount(0);
 await page.getByRole('button',{name:'Salir',exact:true}).first().click();await expect(page.locator('.person-whatsapp')).toHaveCount(0);
});

test('móvil, escritorio, teclado, texto grande y ausencia de enlaces en Programa',async({page})=>{
 await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!);data.persons.find((p:any)=>p.id==='p6').name='Marcos León de la Congregación de Ejemplo con un nombre completo muy largo para comprobar su lectura';localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));});await page.reload();
 await nav(page,'Equipo').click();
 for(const width of [320,390,820,1440]){
  await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const link=page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true});const box=await link.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(48);
  await page.screenshot({path:`qa/contact-icons/team-${width}.png`,fullPage:true});
 }
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
 const link=page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true});await link.focus();await expect(link).toBeFocused();
 const popup=page.waitForEvent('popup');await page.keyboard.press('Enter');await(await popup).close();
 await page.setViewportSize({width:720,height:1000});await page.addStyleTag({content:':root{font-size:36px!important}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await nav(page,'Agenda').click();await expect(page.locator('.person-whatsapp')).toHaveCount(0);
});

test('editar teléfono y retirar un cargo actualiza los contactos sin conceder otros permisos',async({page})=>{
 await nav(page,'Equipo').click();await page.getByRole('button',{name:'Directorio',exact:true}).click();
 await page.getByRole('button',{name:'Ver ficha de David Romero',exact:true}).click();
 const profile=page.getByRole('dialog',{name:'David Romero',exact:true});await profile.getByRole('button',{name:'Editar ficha',exact:true}).click();
 await profile.getByLabel('Teléfono',{exact:true}).fill('+34 622 333 444');await profile.getByLabel('Sorda u oyente').selectOption('hearing');await profile.getByRole('button',{name:'Guardar ficha',exact:true}).click();await expect(profile).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true})).toHaveAttribute('href','https://wa.me/34622333444');
 await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();await expect(page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true})).toHaveAttribute('href','https://wa.me/34622333444');
 await expect(page.getByRole('button',{name:'Clasificación de David Romero: Oyente',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ver responsable',exact:true}).click();await nav(page,'Equipo').click();await page.getByRole('button',{name:'Equipo del evento',exact:true}).click();
 const card=page.locator('.team-person-list article').filter({has:page.getByRole('heading',{name:'David Romero',exact:true})});await card.getByRole('button',{name:'Ver ficha de David Romero',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'David Romero',exact:true});await detail.getByRole('tab',{name:'Equipo',exact:true}).click();await detail.getByLabel('Cargo en este departamento').selectOption('volunteer');await expect(detail.getByLabel('Cargo en este departamento')).toBeEnabled();await detail.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
 await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();await expect(page.getByRole('region',{name:'Contactos de tus departamentos'}).getByRole('link')).toHaveCount(1);await expect(page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Clasificación de David Romero/})).toHaveCount(0);
});

test('los iconos conservan tamaño, orden, contraste y clasificación sin teléfono; sus etiquetas no modifican datos',async({page})=>{
 await nav(page,'Equipo').click();
 const deaf=page.getByRole('button',{name:'Clasificación de David Romero: Sorda',exact:true}),hearing=page.getByRole('button',{name:'Clasificación de Marcos León: Oyente',exact:true}),unknown=page.getByRole('button',{name:'Clasificación de Sara Gil: Sin indicar',exact:true}),wa=page.getByRole('link',{name:'Abrir WhatsApp con David Romero',exact:true});
 await expect(deaf.locator('svg')).toHaveClass(/lucide-ear-off/);await expect(hearing.locator('svg')).toHaveClass(/lucide-ear/);await expect(unknown.locator('svg')).toHaveClass(/lucide-circle-help/);await expect(wa).toHaveText('');
 for(const control of [deaf,hearing,unknown,wa]){const box=await control.boundingBox();expect(box!.width).toBe(48);expect(box!.height).toBe(48);await expect(control.locator('svg')).toHaveAttribute('width','24');await expect(control).toHaveCSS('border-top-width','0px');await expect(control).toHaveCSS('background-color','rgba(0, 0, 0, 0)');}
 await expect(wa).toHaveCSS('color','rgb(22, 101, 52)');await expect(deaf).toHaveCSS('color','rgb(71, 85, 105)');
 const group=deaf.locator('..').locator('..');expect(await group.locator('button').count()).toBe(1);expect(await group.evaluate(e=>e.firstElementChild?.tagName==='SPAN'&&e.lastElementChild?.tagName==='A')).toBe(true);
 const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
 await deaf.focus();await expect(page.getByRole('tooltip',{name:'Sorda',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);await expect(deaf).toBeFocused();
 await hearing.click();await expect(page.getByRole('tooltip',{name:'Oyente',exact:true})).toBeVisible();await page.getByRole('heading',{name:'Equipo',exact:false}).click();await expect(page.getByRole('tooltip')).toHaveCount(0);
 await unknown.click();await expect(page.getByRole('tooltip',{name:'Sin indicar',exact:true})).toBeVisible();
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
 expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);expect(page.context().pages()).toHaveLength(1);await expect(page.locator('.profile-classification')).toHaveCount(0);
});

test.describe('etiquetas táctiles',()=>{
 test.use({hasTouch:true,viewport:{width:390,height:900}});
 test('el toque abre la etiqueta dentro de la ficha y Escape cierra solo la etiqueta',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await nav(page,'Equipo').click();await page.getByRole('button',{name:'Directorio',exact:true}).click();await page.getByRole('button',{name:'Ver ficha de David Romero',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'David Romero',exact:true}),control=dialog.getByRole('button',{name:'Clasificación de David Romero: Sorda',exact:true});
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await control.tap();const tip=page.getByRole('tooltip',{name:'Sorda',exact:true});await expect(tip).toBeVisible();const box=await tip.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(8);expect(box!.x+box!.width).toBeLessThanOrEqual(390-8);expect(box!.y).toBeGreaterThanOrEqual(8);
  await page.screenshot({path:'qa/contact-icons/ficha-390.png'});await page.keyboard.press('Escape');await expect(tip).toHaveCount(0);await expect(dialog).toBeVisible();
  await control.tap();await expect(tip).toBeVisible();await dialog.getByRole('heading',{name:'David Romero',exact:true}).tap();await expect(tip).toHaveCount(0);await expect(dialog).toBeVisible();expect(errors).toEqual([]);
 });
});
