import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';
const nav=(p:Page,name:string)=>p.getByRole('navigation',{name:'Principal'}).getByRole('button',{name,exact:true}).click();
const key='ls-asambleas:demo:v1';

test('ficha: Datos por defecto, pestañas con teclado, conserva el formulario y vuelve al filtro',async({page})=>{
 await page.goto('/');await nav(page,'Equipo');await page.getByLabel('Buscar persona o congregación').fill('David');
 const opener=page.getByRole('button',{name:'Ver ficha de David Romero',exact:true});await opener.click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('tab',{name:'Datos',exact:true})).toHaveAttribute('aria-selected','true');
 await dialog.getByRole('button',{name:'Editar',exact:true}).click();await dialog.getByRole('textbox',{name:'Nombre',exact:true}).fill('David prueba sin guardar');
 const before=await page.evaluate(key=>localStorage.getItem(key),key);
 await dialog.getByRole('tab',{name:'Datos',exact:true}).press('ArrowRight');await expect(dialog.getByRole('tab',{name:'Equipo',exact:true})).toBeFocused();await expect(dialog.getByRole('heading',{name:'Aprobación del comité'})).toBeVisible();
 await dialog.getByRole('tab',{name:'Equipo',exact:true}).press('End');await expect(dialog.getByRole('heading',{name:'Acceso a la aplicación'})).toBeVisible();
 await dialog.getByRole('tab',{name:'Acceso',exact:true}).press('Home');await expect(dialog.getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('David prueba sin guardar');
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(before);
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 for(const width of [320,390,820,1440]){await page.setViewportSize({width,height:900});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:`qa/visual-080/after/person-${width}.png`});}
 await page.keyboard.press('Escape');await expect(opener).toBeFocused();await expect(page.getByLabel('Buscar persona o congregación')).toHaveValue('David');
});

test('un pendiente abre Equipo y la ficha en su proceso, no en datos personales',async({page})=>{
 await page.goto('/');await page.locator('.home-attention').getByRole('button',{name:/Aprobación del comité/}).click();
 await page.locator('button[data-team-candidate]').first().click();await expect(page.getByRole('tab',{name:'Equipo',exact:true})).toHaveAttribute('aria-selected','true');
});

test('histórico permite plegar cada evento, conserva selección y muestra contenido al imprimir',async({page})=>{
 await page.goto('/');await nav(page,'Más');await page.getByRole('button',{name:'Histórico',exact:true}).click();
 const toggle=page.locator('.history-event-toggle').first();await expect(toggle).toHaveAttribute('aria-expanded','true');await toggle.click();await expect(page.locator('.history-event-content').first()).not.toBeVisible();
 await page.emulateMedia({media:'print'});await expect(page.locator('.history-event-content').first()).toBeVisible();await page.emulateMedia({media:'screen'});
 await page.getByRole('button',{name:'Volver',exact:true}).click();await page.getByRole('button',{name:'Histórico',exact:true}).click();await expect(toggle).toHaveAttribute('aria-expanded','false');
});

test('comparación reproducible con 0.7.1: cinco pantallas y cinco anchuras',async({page})=>{
 test.skip(process.env.VISUAL_080_BASELINE!=='1','Solo se ejecuta contra la copia aislada de 0.7.1.');test.setTimeout(120000);
 const data=createDemoData();data.candidates.push({...data.candidates[0],id:'admin-team',personId:'p-admin',teamRole:'assistant'});
 await page.addInitScript(data=>localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data)),data);await page.goto('/');
 for(const width of [320,360,390,820,1440]){
  await page.setViewportSize({width,height:1000});
  for(const [name,file] of [['Inicio','home'],['Equipo','team'],['Turnos','shifts'],['Programa','program']]){await nav(page,name);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`qa/visual-080/before/${file}-${width}.png`,fullPage:true});}
  await page.locator('.program-row').filter({hasText:'Aprendamos juntos'}).getByRole('button',{name:'Ver plano',exact:true}).click();await page.screenshot({path:`qa/visual-080/before/stage-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Volver',exact:true}).click();
 }
});
