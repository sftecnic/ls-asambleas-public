import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';
import {emptyData} from '../src/domain/types';
test.setTimeout(60000);

async function openImport(page:import('@playwright/test').Page){await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Más',exact:true}).click();await page.getByRole('button',{name:'Importar',exact:true}).click();}
test('alta desde una organización vacía, persistencia y reimportación sin cambios',async({page})=>{
 const data=emptyData(),demo=createDemoData();data.persons=[demo.persons[0]];data.grants=demo.grants.filter(g=>g.role==='admin');
 await page.addInitScript(data=>{if(!localStorage.getItem('ls-asambleas:demo:v1'))localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
 await page.goto('/');await openImport(page);
 await page.getByLabel('Elegir Excel',{exact:true}).setInputFiles('public/templates/ls-asambleas-ejemplo.xlsx');
 await expect(page.getByRole('button',{name:'Importar 9 registros'})).toBeEnabled();
 await page.getByRole('button',{name:'Importar 9 registros'}).click();
 await expect(page.getByRole('heading',{name:'Accesos de consulta'})).toBeVisible();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!));expect(stored.shifts).toHaveLength(2);expect(stored.shifts[0].status).toBe('draft');expect(stored.audit.length).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Terminar',exact:true}).click();
 await page.getByLabel('Elegir Excel',{exact:true}).setInputFiles('public/templates/ls-asambleas-ejemplo.xlsx');
 await expect(page.getByRole('button',{name:'Importar 0 registros'})).toBeDisabled();
 await expect(page.locator('.excel-record').getByText('Sin cambios',{exact:true})).toHaveCount(9);
});
test('revisión móvil, teclado, contraste y salida con cambios pendientes',async({page})=>{
 await page.goto('/');await openImport(page);
 for(const width of [360,390,820,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`qa/excel-import/archivo-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.getByLabel('Elegir Excel',{exact:true}).setInputFiles('public/templates/ls-asambleas-ejemplo.xlsx');
 await expect(page.getByRole('button',{name:/Importar \d+ registros/})).toBeVisible();
 for(const width of [320,390,820,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`qa/excel-import/revision-${width}.png`,fullPage:true});}
 const axe=await new AxeBuilder({page}).include('.excel-import').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Volver',exact:true}).click();await expect(page.getByRole('heading',{name:'Importar Excel'})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Volver',exact:true}).click();await expect(page.getByRole('heading',{name:'Más',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Importar',exact:true}).click();await expect(page.getByLabel('Elegir Excel',{exact:true})).toBeAttached();
 await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.tagName)).not.toBe('BODY');
});
