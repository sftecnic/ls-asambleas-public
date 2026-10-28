import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.setTimeout(60000);
async function openVideo(page:import('@playwright/test').Page){await page.goto('/');await page.getByLabel('Ámbito de Inicio').selectOption('all');await page.locator('.tour-entry').filter({hasText:'Audio y vídeo'}).click();return page.getByRole('dialog',{name:'Conocer Audio y vídeo'});}

test('las etiquetas dentro de la panorámica abren su foto con ratón y teclado',async({page})=>{
 const dialog=await openVideo(page);
 await expect(dialog.locator('.tour-panorama-wrap')).toHaveAttribute('data-ready','true');
 const marker=dialog.getByRole('button',{name:'Ampliar Vídeo',exact:true});
 const position=(await marker.boundingBox())!;
 await page.mouse.move(position.x+position.width/2,position.y+position.height/2);
 await page.mouse.down();await page.mouse.move(position.x+position.width/2+80,position.y+position.height/2,{steps:8});await page.mouse.up();
 await expect(dialog.locator('.tour-detail')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Restablecer',exact:true}).click();
 await marker.click();
 await expect(dialog.getByRole('heading',{name:'Vídeo',exact:true})).toBeVisible();
 await expect(dialog.locator('.tour-photo-frame img')).toBeVisible();
 await dialog.getByRole('button',{name:'Volver al recorrido',exact:true}).click();
 await expect(marker).toBeFocused();
 await marker.focus();await page.keyboard.press('Enter');
 await expect(dialog.getByRole('heading',{name:'Vídeo',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Volver al recorrido',exact:true}).click();
 await marker.focus();await page.keyboard.press('Space');
 await expect(dialog.getByRole('heading',{name:'Vídeo',exact:true})).toBeVisible();
});

test('tocar una etiqueta abre el detalle en móvil',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const page=await context.newPage();const dialog=await openVideo(page);
 await expect(dialog.locator('.tour-panorama-wrap')).toHaveAttribute('data-ready','true');
 await dialog.getByRole('button',{name:'Ampliar Vídeo',exact:true}).tap();
 await expect(dialog.getByRole('heading',{name:'Vídeo',exact:true})).toBeVisible();
 await expect(dialog.locator('.tour-photo-frame img')).toBeVisible();
 await dialog.getByRole('button',{name:'Volver al recorrido',exact:true}).tap();
 await expect(dialog.getByRole('button',{name:'Ampliar Vídeo',exact:true})).toBeVisible();
 await context.close();
});
test('360°, zonas, ampliación y retorno conservan la escena',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const dialog=await openVideo(page);
 await expect(dialog.locator('.tour-panorama-wrap')).toHaveAttribute('data-ready','true');await expect(dialog.locator('.psv-canvas-container canvas')).toBeVisible();
 const canvas=await dialog.locator('.psv-canvas-container canvas').elementHandle();
 await dialog.getByRole('button',{name:'Mirar a la derecha',exact:true}).click();await dialog.getByRole('button',{name:'Acercar vista',exact:true}).click();
 await dialog.getByRole('button',{name:'Zonas',exact:true}).click();await dialog.locator('.tour-zone').filter({hasText:'Cámara'}).click();
 await expect(dialog.getByRole('heading',{name:'Cámara',exact:true})).toBeVisible();await expect(dialog.locator('.tour-photo-frame img')).toBeVisible();
 await dialog.getByRole('button',{name:'Acercar',exact:true}).click();await expect(dialog.getByLabel('Aumento de la foto')).toHaveText('150 %');
 await dialog.getByRole('region',{name:'Fotografía ampliable'}).focus();await page.keyboard.press('ArrowRight');await expect(dialog.locator('.tour-photo-frame img')).toHaveAttribute('style',/translate\(-50px/);await dialog.getByRole('button',{name:'Ver derecha',exact:true}).click();await expect(dialog.locator('.tour-photo-frame img')).toHaveAttribute('style',/translate\(-100px/);
 await dialog.getByRole('button',{name:'Restablecer',exact:true}).click();await expect(dialog.getByLabel('Aumento de la foto')).toHaveText('100 %');
 await dialog.getByRole('button',{name:'Volver al recorrido',exact:true}).click();expect(await canvas!.evaluate(el=>el.isConnected)).toBe(true);await expect(dialog.locator('.psv-canvas-container canvas')).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(errors).toEqual([]);
});
test('las tres salas caben en móvil y escritorio y permiten usar teclado',async({page})=>{
 const dialog=await openVideo(page);await expect(dialog.locator('.tour-panorama-wrap')).toHaveAttribute('data-ready','true');await expect(dialog.locator('.psv-canvas-container canvas')).toBeVisible();
 for(const width of [320,360,390,820,1440]){await page.setViewportSize({width,height:960});await expect(dialog.getByRole('button',{name:'Cerrar',exact:true})).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await expect.poll(()=>dialog.locator('canvas').evaluate((el:any)=>Math.abs(el.width/devicePixelRatio-el.parentElement.clientWidth))).toBeLessThan(3);await page.screenshot({path:`qa/visual-080/tours/demo-${width}.png`});}
 const axe=await new AxeBuilder({page}).include('.tour-dialog').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
 await dialog.getByRole('button',{name:'Zonas',exact:true}).click();await dialog.locator('.tour-zone').filter({hasText:'Mesa'}).click();await expect(dialog.locator('.tour-photo-frame img')).toBeVisible();await page.screenshot({path:'qa/visual-080/tours/detail-1440.png'});await page.keyboard.press('Escape');await expect(dialog.locator('.tour-room')).toBeVisible();await page.keyboard.press('Escape');
 for(const name of ['Plataforma','Maquillaje']){await page.locator('.tour-entry').filter({hasText:name}).click();const room=page.getByRole('dialog',{name:'Conocer '+name});await expect(room.locator('[data-ready=true]')).toBeVisible();await room.getByRole('button',{name:'Cerrar',exact:true}).click();}
 await page.locator('.tour-entry').filter({hasText:'Audio y vídeo'}).click();await page.setViewportSize({width:720,height:960});await page.addStyleTag({content:':root{font-size:36px!important}'});expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.keyboard.press('Escape');
});
test('si WebGL falla mantiene una galería utilizable',async({page})=>{
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:any[]){return ['webgl','webgl2','experimental-webgl'].includes(type)?null:(get as any).apply(this,[type,...args]);} as any;});
 const dialog=await openVideo(page);await expect(dialog.getByText('Este dispositivo no puede abrir la vista 360°. Puedes explorar las zonas.')).toBeVisible();await dialog.locator('.tour-zone').filter({hasText:'Vídeo'}).click();await expect(dialog.locator('.tour-photo-frame img')).toBeVisible();
});
test('evento, usuario, conexión y entrada desde instrucciones mantienen los ámbitos',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Ver voluntario',exact:true}).click();await expect(page.locator('.tour-entry')).toHaveCount(1);await expect(page.locator('.tour-entry')).toContainText('Audio y vídeo');
 await page.getByRole('button',{name:'Instrucciones',exact:true}).click();await page.getByRole('dialog',{name:'Instrucciones'}).getByRole('button',{name:'Conocer departamento',exact:true}).click();await expect(page.getByRole('dialog',{name:'Instrucciones'})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Conocer Audio y vídeo'})).toBeVisible();await page.keyboard.press('Escape');
 await page.context().setOffline(true);await expect(page.locator('.tour-entry')).toHaveCount(0);await page.context().setOffline(false);await expect(page.locator('.tour-entry')).toHaveCount(1);
 await page.getByRole('button',{name:'Ver responsable',exact:true}).click();await page.getByLabel('Elegir evento').selectOption('e2');await expect(page.locator('.tour-entry')).toHaveCount(0);
});
