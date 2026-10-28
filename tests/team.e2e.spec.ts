import { expect, test, type Page } from '@playwright/test';
import { createDemoData } from '../src/seed';

const DEMO_KEY='ls-asambleas:demo:v1';
async function openTeam(page:Page) {
  await page.goto('/');
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Equipo',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Equipo 6',exact:true})).toBeVisible();
}
async function openPerson(page:Page,name:string) {
  await page.locator('.team-person-card').filter({has:page.getByRole('heading',{name,exact:true})}).locator('button[data-team-candidate]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('tab',{name:'Equipo',exact:true}).click();
}

test.beforeEach(async({page})=>{
  // A new browser context per test; all app data are the built-in fictional demo.
  await page.addInitScript(()=>localStorage.clear());
});

test('copying does not send; explicit confirmation saves a snapshot and committee pending only',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await openTeam(page);await openPerson(page,'Nuria Vega');
  await page.getByRole('button',{name:'Preparar correo',exact:true}).click();
  const message=page.locator('.mail-body');
  const snapshot=await message.innerText();
  await page.getByRole('button',{name:'Copiar mensaje',exact:true}).click();
  await expect(page.getByText('Mensaje copiado. Aún no está marcado como enviado.',{exact:true})).toBeVisible();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"communications":[]}').communications.length,DEMO_KEY)).toBe(0);
  await page.getByRole('button',{name:'Marcar enviado',exact:true}).click();
  await expect(page.getByRole('button',{name:'Envío registrado',exact:true})).toBeDisabled();
  const data=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),DEMO_KEY);
  expect(data.communications).toHaveLength(1);
  expect(data.communications[0]).toMatchObject({body:snapshot,personId:'p5',departmentId:'makeup'});
  expect(data.candidates.find((c:{id:string})=>c.id==='ca5')).toMatchObject({committee:'pending',availability:'unknown',access:'none'});
  expect(data.audit.at(-1).action).toContain('correo enviado manualmente');
});

test('Gmail access needs separate committee approval and volunteer acceptance',async({page})=>{
  await openTeam(page);await openPerson(page,'David Romero');
  await expect(page.getByLabel('Cuenta de Gmail')).toHaveCount(0);
  await page.getByRole('button',{name:'Aprobado',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('button',{name:'Consultar disponibilidad',exact:true})).toBeVisible();
  await expect(page.getByLabel('Cuenta de Gmail')).toHaveCount(0);
  await page.getByRole('button',{name:'Acepta',exact:true}).click();
  await page.getByRole('tab',{name:'Acceso',exact:true}).click();
  await page.getByLabel('Cuenta de Gmail').fill('prueba@example.test');
  await page.getByRole('button',{name:'Dar acceso',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Gmail válida'})).toBeVisible();
  await page.getByLabel('Cuenta de Gmail').fill('david.demostracion.ls@gmail.com');
  await page.getByRole('button',{name:'Dar acceso',exact:true}).click();
  await expect(page.getByText('Podrá entrar con Google usando esta dirección.',{exact:true})).toBeVisible();
  const data=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),DEMO_KEY);
  expect(data.candidates.find((c:{id:string})=>c.id==='ca2')).toMatchObject({committee:'approved',availability:'accepted',access:'invited'});
  expect(data.grants.find((g:{email:string})=>g.email==='david.demostracion.ls@gmail.com')).toMatchObject({role:'volunteer',capabilities:['view'],active:true,personId:'p2'});
});

test('unresolved fields prevent copying and registering the message',async({page})=>{
  await openTeam(page);await openPerson(page,'Nuria Vega');
  await page.getByRole('button',{name:'Preparar correo',exact:true}).click();
  await page.getByRole('button',{name:'Editar mensaje',exact:true}).click();
  await page.getByRole('dialog').getByRole('textbox',{name:'Mensaje',exact:true}).fill('Hola {{persona}}. Falta {{dato_desconocido}}.');
  await expect(page.getByRole('alert').filter({hasText:'dato_desconocido'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Copiar mensaje',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Marcar enviado',exact:true})).toBeDisabled();
});

test('proposing a new person creates a separate directory identity without approval or access',async({page})=>{
  await openTeam(page);
  await page.getByRole('button',{name:'Proponer',exact:true}).click();
  await page.getByRole('button',{name:'Nueva persona',exact:true}).click();
  await page.getByLabel('Nombre completo').fill('Paula Prueba');
  await page.getByLabel('Correo de contacto').fill('paula@example.test');
  await page.getByRole('button',{name:'Añadir propuesta',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Paula Prueba',exact:true})).toBeVisible();
  const data=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),DEMO_KEY);
  const person=data.persons.find((p:{name:string})=>p.name==='Paula Prueba');
  expect(person).toMatchObject({email:'paula@example.test',gmail:''});
  expect(data.candidates.find((c:{personId:string})=>c.personId===person.id)).toMatchObject({committee:'proposed',availability:'unknown',access:'none'});
});

test('department contacts allow linked person edits and atomic proposals without event-wide access',async({browser,baseURL})=>{
  const fixture=createDemoData();
  fixture.grants=fixture.grants.filter(g=>g.id!=='g-admin');
  fixture.grants.push(
    {id:'g-team-video',email:'admin@example.test',uid:'demo-admin',personId:'p-admin',eventId:'e1',departmentId:'video',role:'responsible',capabilities:['view','edit','contacts'],active:true},
    {id:'g-team-platform',email:'admin@example.test',uid:'demo-admin',personId:'p-admin',eventId:'e1',departmentId:'platform',role:'responsible',capabilities:['view','edit'],active:true},
  );
  const context=await browser.newContext({baseURL});
  try {
    const page=await context.newPage();
    await page.addInitScript(({key,data})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(data));},{key:DEMO_KEY,data:fixture});
    await openTeam(page);await openPerson(page,'David Romero');
    await page.getByRole('tab',{name:'Datos',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Editar',exact:true}).click();
    await page.getByLabel('Correo de contacto').fill('david.contacto@example.test');
    await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();
    await expect(page.getByRole('link',{name:'david.contacto@example.test',exact:true})).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:'Volver',exact:true}).click();

    await openPerson(page,'Sara Gil');
    await expect(page.getByRole('dialog').getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
    await page.getByRole('dialog').getByRole('button',{name:'Volver',exact:true}).click();

    await page.getByRole('button',{name:'Proponer',exact:true}).click();
    await page.getByRole('button',{name:'Nueva persona',exact:true}).click();
    await page.getByLabel('Nombre completo').fill('Persona de prueba del equipo');
    await page.getByLabel('Correo de contacto').fill('equipo@example.test');
    await page.getByRole('button',{name:'Añadir propuesta',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Persona de prueba del equipo',exact:true})).toBeVisible();
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),DEMO_KEY);
    const person=saved.persons.find((p:{name:string})=>p.name==='Persona de prueba del equipo');
    expect(person.email).toBe('equipo@example.test');
    expect(saved.candidates.find((c:{personId:string})=>c.personId===person.id)).toMatchObject({departmentId:'video',committee:'proposed',availability:'unknown',access:'none'});
    expect(saved.persons.find((p:{id:string})=>p.id==='p2').email).toBe('david.contacto@example.test');

    await page.getByRole('button',{name:'Proponer',exact:true}).click();
    await page.getByRole('dialog').getByRole('combobox',{name:'Departamento',exact:true}).selectOption('platform');
    await expect(page.getByRole('button',{name:'Nueva persona',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Añadir propuesta',exact:true}).click();
    await expect(page.getByRole('alert').filter({hasText:'permiso de contactos en este departamento'})).toBeVisible();
  } finally { await context.close(); }
});

test('mobile team and communication remain within the viewport with accessible controls',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await openTeam(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('team-mobile.png'),fullPage:true});
  await openPerson(page,'Nuria Vega');
  await page.getByRole('button',{name:'Preparar correo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Marcar enviado',exact:true})).toBeInViewport();
  expect(await page.getByRole('button',{name:'Marcar enviado',exact:true}).evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('mail-mobile.png')});
});
