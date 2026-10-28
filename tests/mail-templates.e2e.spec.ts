import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDemoData } from '../src/seed';
import { DEFAULT_MAIL_TEMPLATES } from '../src/domain/mail';

test('speaker email completes required details, groups talks, copies formatting and records only on request',async({page,context},testInfo)=>{
  const data=createDemoData();data.templates=structuredClone(DEFAULT_MAIL_TEMPLATES);
  data.candidates[0].teamRole='responsible';data.candidates[1].teamRole='assistant';data.candidates[5].teamRole='assistant';
  data.persons.forEach((p,i)=>{p.phone=`600 000 00${i}`;});
  data.program=data.program.map(p=>p.kind==='break'?p:{...p,driveUrl:`https://drive.google.com/drive/folders/demo-${p.id}`});
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  // Inspect the payload at the browser API boundary without changing the user's system clipboard.
  await page.addInitScript(()=>{Object.defineProperty(navigator.clipboard,'write',{value:async(items:ClipboardItem[])=>{
    const item=items[0];(window as any).__mailClipboard={plain:await(await item.getType('text/plain')).text(),html:await(await item.getType('text/html')).text()};
  }});});
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');
  await page.getByRole('button',{name:'Agenda',exact:true}).click();
  await page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Bienvenida',exact:true})}).locator('summary').click();
  await page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Bienvenida',exact:true})}).getByRole('button',{name:'Correo',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Copiar mensaje',exact:true})).toBeDisabled();
  await expect(dialog.getByRole('button',{name:'Copiar asunto',exact:true})).toBeEnabled();
  await dialog.locator('input[name="mail-deadline"]').fill('2027-04-08T23:59');
  await dialog.getByLabel('Vídeo de instrucciones en LSE').fill('https://example.test/instrucciones-lse');
  await expect(dialog.getByRole('button',{name:'Copiar mensaje',exact:true})).toBeEnabled();
  await expect(dialog.locator('select[name="mail-responsibleId"]')).toHaveValue('p1');
  await expect(dialog.locator('select[name="mail-responsibleId"] option[value="p2"]')).toHaveCount(0);
  await dialog.locator('select[name="mail-assistantId"]').selectOption('p2');
  await expect(dialog.locator('.mail-body')).toContainText('Lucía Martín');
  await expect(dialog.locator('.mail-body')).toContainText('persona1@example.test · 600 000 001');
  await expect(dialog.locator('.mail-body')).toContainText('David Romero');
  await expect(dialog.locator('.mail-body')).not.toContainText('Elena Vidal');
  await dialog.getByLabel('Departamento de la firma').selectOption('platform');
  await expect(dialog.getByRole('button',{name:'Copiar mensaje',exact:true})).toBeDisabled();
  await expect(dialog.locator('.mail-body')).not.toContainText('Lucía Martín');
  await dialog.getByLabel('Departamento de la firma').selectOption('video');
  await dialog.locator('select[name="mail-responsibleId"]').selectOption('p1');
  await dialog.locator('select[name="mail-assistantId"]').selectOption('p2');
  await expect(dialog.locator('.mail-body')).toContainText('Bienvenida');
  await expect(dialog.locator('.mail-body')).toContainText('Aprendamos juntos');
  await expect(dialog.locator('.mail-body')).not.toContainText('{{');
  for(const [width,height] of [[390,844],[820,1180],[1440,1000]]){
    await page.setViewportSize({width,height});
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await expect(dialog.getByRole('button',{name:'Marcar enviado',exact:true})).toBeInViewport();
    await page.screenshot({path:testInfo.outputPath(`speaker-mail-${width}.png`)});
    await dialog.locator('select[name="mail-signature-department"]').evaluate(el=>el.closest('fieldset')!.scrollIntoView({block:'start'}));
    await page.screenshot({path:testInfo.outputPath(`speaker-contacts-${width}.png`)});
    await dialog.locator('.mail-body').evaluate(el=>el.scrollIntoView({block:'start'}));
    await page.screenshot({path:testInfo.outputPath(`speaker-message-${width}.png`)});
    await dialog.locator('.team-dialog-content').evaluate(el=>{el.scrollTop=0;});
  }
  const accessibility=await new AxeBuilder({page}).include('.mail-dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await dialog.getByRole('button',{name:'Copiar mensaje',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__mailClipboard)).toBeTruthy();
  const clipboard=await page.evaluate(()=>(window as any).__mailClipboard as {plain:string;html:string});
  expect(clipboard.html).toContain('<strong>');expect(clipboard.html).toContain('href="https://drive.google.com/drive/folders/demo-pr2"');
  expect(clipboard.plain).toContain('8 de abril de 2027');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!).communications.length)).toBe(0);
  await dialog.getByRole('button',{name:'Marcar enviado',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Envío registrado',exact:true})).toBeDisabled();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!).communications);
  expect(saved).toHaveLength(1);expect(saved[0].body).toBe(clipboard.plain.replace(/\r\n/g,'\n'));
});
