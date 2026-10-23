import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDemoData } from '../src/seed';

for (const width of [390,820,1440]) test(`cuenta administrativa sin voluntario, ${width}px`,async({page})=>{
  const data=createDemoData();
  data.grants.push({...data.grants.find(g=>g.role==='admin')!,id:'office@example.test~*~*',email:'office@example.test',personId:'account-office'});
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(value=>localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(value)),data);
  await page.goto('/');
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Más',exact:true}).click();
  await page.getByRole('button',{name:'Permisos',exact:true}).click();
  await page.locator('.admin-config-row').filter({has:page.getByRole('heading',{name:'office@example.test',exact:true})}).getByRole('button',{name:'Cambiar',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Cambiar permisos'});
  await expect(dialog.getByLabel('Cuenta administrativa')).toHaveValue('office@example.test');
  await expect(dialog.getByLabel('Persona',{exact:true})).toHaveCount(0);
  await expect(dialog.getByLabel('Función')).toBeDisabled();
  const axe=await new AxeBuilder({page}).include('dialog').analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({path:`qa/account-migration/account-${width}.png`});
  await dialog.getByLabel('Acceso activo').uncheck();
  await dialog.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ls-asambleas:demo:v1')!));
  expect(saved.persons).toEqual(data.persons);expect(saved.candidates).toEqual(data.candidates);expect(saved.shifts).toEqual(data.shifts);
  expect(saved.grants.find((g:any)=>g.email==='office@example.test').active).toBe(false);
  expect(saved.grants.find((g:any)=>g.email==='admin@example.test').active).toBe(true);
});
