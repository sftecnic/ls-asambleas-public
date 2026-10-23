import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contraste, nombres y estructura accesible en pantallas principales',async({page})=>{
  await page.goto('/');
  for(const title of ['Inicio','Equipo','Turnos','Programa','Más']){
    await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:title,exact:true}).click();
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    expect(result.violations.map(v=>({id:v.id,description:v.description,nodes:v.nodes.map(n=>n.target)})),title).toEqual([]);
  }
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();await page.getByRole('button',{name:'Añadir turno'}).click();
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
test('teclado: navegación, modal, foco y escala de texto',async({page})=>{
  await page.goto('/'); await expect(page.getByRole('heading',{name:'Inicio',exact:true})).toBeVisible();
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Saltar al contenido'})).toBeFocused();
  await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();await page.getByRole('button',{name:'Instrucciones',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Instrucciones'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Instrucciones',exact:true})).toBeFocused();
  await page.setViewportSize({width:720,height:900});
  await page.addStyleTag({content:':root{font-size:36px!important}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
