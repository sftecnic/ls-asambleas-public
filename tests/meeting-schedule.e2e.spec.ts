import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';
import type {MeetingPublication} from '../src/domain/types';
import {openOptions} from './ui-navigation';

const meeting:MeetingPublication={id:'m1',eventId:'e1',departmentIds:['video'],kind:'zoom',title:'Formación por Zoom',startsAt:'2027-03-10T18:00:00.000Z',duration:60,location:'',address:'',zoomUrl:'',zoomMeetingId:'12345678901',zoomPasscode:'00AB',instructions:'Trae tus preguntas.',sessionDate:'2027-04-10',session:'morning',additionalPersonIds:[],version:1,status:'confirmed',publishedAt:'2027-01-10T10:00:00.000Z',publishedBy:'demo-admin',recipientIds:['p1','p-admin']};
function fixture(){
 const data=createDemoData();data.events[1].title='Asamblea del Este';
 data.events.push({...data.events[1],id:'archived',title:'Evento archivado',archived:true});
 data.meetingPublications=[meeting,{...meeting,id:'m2',kind:'in-person',title:'Formación presencial',startsAt:'2027-03-10T20:00:00.000Z',location:'Salón del Norte',address:'Dirección ficticia'},
 {...meeting,id:'cancelled',title:'Orientación cancelada',kind:'orientation',startsAt:'2027-03-18T09:00:00.000Z',status:'cancelled'},
 {...meeting,id:'platform',title:'Formación de plataforma',departmentIds:['platform'],startsAt:'2027-03-12T09:00:00.000Z',recipientIds:['p4']},
 {...meeting,id:'m3',title:'Orientación del Este',eventId:'e2',startsAt:'2027-03-10T18:00:00.000Z'},
 {...meeting,id:'archived-meeting',title:'No mostrar archivada',eventId:'archived'}];
 const {version,status,publishedAt,publishedBy,recipientIds,...draft}=meeting;
 void [version,status,publishedAt,publishedBy,recipientIds];
 data.meetings=[{...draft,title:'Borrador de nueva fecha',startsAt:'2027-05-10T18:00:00.000Z',departmentIds:['makeup']},
 {...draft,id:'no-date',title:'Formación por preparar',startsAt:'',duration:0}];
 return data;
}
async function nav(page:Page,name:string){await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name,exact:true}).click();}
async function openMeetings(page:Page){await nav(page,'Agenda');await page.getByRole('navigation',{name:'Agenda'}).getByRole('button',{name:'Reuniones',exact:true}).click();}
test.beforeEach(async({page})=>{await page.addInitScript(data=>{if(!localStorage.getItem('ls-asambleas:demo:v1'))localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},fixture());await page.goto('/');await expect(page.getByRole('region',{name:'Demostración'})).toBeVisible();});

test('mes en escritorio, fechas confirmadas y lista equivalente sin escrituras',async({page})=>{
 await openMeetings(page);const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
 await expect(page.getByRole('button',{name:'Mes',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('heading',{name:'marzo de 2027',exact:true})).toBeVisible();
 await expect(page.locator('.meeting-record')).toHaveCount(5);await expect(page.getByRole('region',{name:'Sin fecha'})).toContainText('Formación por preparar');
 await expect(page.locator('.meeting-record').filter({hasText:'Formación por Zoom'})).toContainText('Cambios sin confirmar');
 await page.getByLabel('Departamento',{exact:true}).selectOption('video');await expect(page.locator('.meeting-record')).toHaveCount(4);
 await page.getByRole('button',{name:'Mes siguiente',exact:true}).click();await expect(page.getByText('No hay reuniones en este mes.',{exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Sin fecha'})).toBeVisible();
 await page.getByRole('button',{name:'Lista',exact:true}).click();await expect(page.locator('.meeting-record')).toHaveCount(4);await expect(page.locator('.meeting-record').filter({hasText:'Orientación cancelada'})).toContainText('Cancelada');
 expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
});

test('todas las asambleas es consulta, conserva contexto, abre evento y restaura al volver',async({page})=>{
 await openMeetings(page);await page.getByRole('button',{name:'Lista',exact:true}).click();await page.getByLabel('Reuniones de',{exact:true}).selectOption('all');
 await expect(page.locator('.meeting-record')).toHaveCount(6);await expect(page.getByRole('button',{name:'Añadir reunión',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Mes',exact:true}).click();await expect(page.locator('.meeting-month-entry').first()).toContainText('Oviedo');await page.screenshot({path:'qa/meeting-schedule/all-1440.png',fullPage:true});await page.getByRole('button',{name:'Ver 3 reuniones',exact:true}).click();await expect(page.locator('.meeting-date-group .meeting-record')).toHaveCount(3);await page.getByRole('button',{name:'Lista',exact:true}).click();
 const east=page.locator('.meeting-record').filter({hasText:'Orientación del Este'});await expect(east).toContainText('Zaragoza');
 await east.getByRole('button',{name:'Ver reunión',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Asamblea del Este');await expect(page.getByRole('dialog').getByRole('button',{name:'Preparar convocatoria',exact:true})).toHaveCount(0);
 await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();await east.getByRole('button',{name:'Abrir asamblea',exact:true}).click();
 await expect(page.getByLabel('Elegir evento')).toHaveValue('e2');await expect(page.getByLabel('Reuniones de',{exact:true})).toHaveValue('event');await expect(page.getByRole('button',{name:'Añadir reunión',exact:true})).toBeVisible();
 await page.goBack();await expect(page.getByLabel('Reuniones de',{exact:true})).toHaveValue('all');await expect(page.getByRole('button',{name:'Lista',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.meeting-record')).toHaveCount(6);
});

test('voluntario solo ve sus convocatorias autorizadas también en la vista conjunta',async({page})=>{
 await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();await openMeetings(page);await page.getByRole('button',{name:'Lista',exact:true}).click();await page.getByLabel('Reuniones de',{exact:true}).selectOption('all');
 await expect(page.locator('.meeting-record')).toHaveCount(3);await expect(page.getByText('Formación de plataforma',{exact:true})).toHaveCount(0);await expect(page.getByText('Orientación del Este',{exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Sin fecha'})).toHaveCount(0);
 const row=page.locator('.meeting-record').filter({hasText:'Formación por Zoom'});await row.getByRole('button',{name:'Ver reunión',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('12345678901');await expect(page.getByRole('button',{name:'Copiar código',exact:true})).toBeVisible();
});

test('lista inicial móvil y mes compacto; teclado, ampliación, contraste y capturas',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:390,height:844});await openMeetings(page);await expect(page.getByRole('button',{name:'Lista',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Mes',exact:true}).click();
 for(const width of [320,390,820,1440]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const targets=await page.locator('.meeting-day-select').evaluateAll(els=>els.filter(el=>getComputedStyle(el).display!=='none').map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));expect(targets.every(t=>t.w>=48&&t.h>=48)).toBe(true);
  if(width===320)expect(targets).toHaveLength(0);
  await page.screenshot({path:`qa/meeting-schedule/month-${width}.png`,fullPage:true});
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.getByRole('button',{name:'Lista',exact:true}).click();await page.screenshot({path:`qa/meeting-schedule/list-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Mes',exact:true}).click();
 }
 const day=page.locator('[data-day="2027-03-10"]');await day.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-day="2027-03-11"]')).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByText('No hay reuniones este día.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Todo el mes',exact:true}).click();
 await page.locator('.meeting-month-entry').filter({hasText:'Formación por Zoom'}).click();await page.keyboard.press('Escape');await expect(page.locator('.meeting-month-entry').filter({hasText:'Formación por Zoom'})).toBeFocused();
 await page.setViewportSize({width:720,height:1000});await page.addStyleTag({content:':root{font-size:36px!important}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('filtros, mes y posición sobreviven la navegación y los enlaces antiguos abren el detalle',async({page})=>{
 await openMeetings(page);await page.getByLabel('Departamento',{exact:true}).selectOption('video');await page.getByRole('button',{name:'Mes siguiente',exact:true}).click();await page.evaluate(()=>window.scrollTo(0,250));const scroll=await page.evaluate(()=>window.scrollY);
 await nav(page,'Equipo');await openMeetings(page);await expect(page.getByLabel('Departamento',{exact:true})).toHaveValue('video');await expect(page.getByRole('heading',{name:'abril de 2027',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(scroll);
 await page.goto('/?evento=e1&reunion=m1');await expect(page.getByRole('dialog')).toContainText('Formación por Zoom');
});

test('impresión agrupa publicaciones, conserva ámbito y no muestra borradores ni controles',async({page})=>{
 await openMeetings(page);await page.getByLabel('Reuniones de',{exact:true}).selectOption('all');
 await page.evaluate(()=>{window.print=()=>document.documentElement.setAttribute('data-printed','true');});await openOptions(page);await page.getByRole('button',{name:'Imprimir',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-printed','true');await expect(page.getByLabel('Reuniones de',{exact:true})).toHaveValue('all');
 // Inspect print CSS without invoking the operating system print dialog.
 await page.emulateMedia({media:'print'});await expect(page.locator('.meeting-browser')).not.toBeVisible();await expect(page.locator('.meeting-print-list')).toBeVisible();
 await expect(page.locator('.meeting-print-list')).not.toContainText('Formación por preparar');await expect(page.locator('.meeting-print-list')).not.toContainText('Borrador de nueva fecha');await expect(page.locator('.meeting-print-list')).toContainText('Asamblea del Este');await expect(page.locator('.meeting-print-list')).toContainText('00AB');
 await expect(page.locator('.meeting-print-list .meeting-print-record')).toHaveCount(5);
});

test('sin conexión limita el ámbito a la copia guardada y mantiene el día y estado',async({page,context})=>{
 test.skip(process.env.TEST_OFFLINE_BUILD!=='1','Requiere la compilación demo con service worker.');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await openMeetings(page);await page.getByLabel('Reuniones de',{exact:true}).selectOption('all');
 await openOptions(page);await page.getByRole('button',{name:'Guardar consulta',exact:true}).click();await page.getByLabel('Este dispositivo es de uso personal').check();await page.getByRole('dialog').getByRole('button',{name:'Guardar consulta',exact:true}).click();
 await context.setOffline(true);await page.reload();await expect(page.getByText('Sin conexión · Solo consulta',{exact:true})).toBeVisible();await expect(page.getByLabel('Reuniones de',{exact:true})).toHaveValue('event');await expect(page.getByLabel('Reuniones de',{exact:true}).locator('option[value="all"]')).toHaveJSProperty('disabled',true);
 await page.getByRole('button',{name:'Lista',exact:true}).click();await expect(page.locator('.meeting-record')).toHaveCount(4);await expect(page.getByText('Formación por preparar',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
});
