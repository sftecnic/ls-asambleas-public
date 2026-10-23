import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';

const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name,exact:true}).click();
const options=async(page:Page)=>{const button=page.getByRole('button',{name:'Opciones',exact:true});if(await button.getAttribute('aria-expanded')!=='true')await button.click();};
const dataKey='ls-asambleas:demo:v1';

test('Atrás cancelado conserva un borrador y solo pregunta una vez, también tras recargar',async({page})=>{
  await page.goto('/');await nav(page,'Programa');
  for(const reload of [false,true]){
    if(reload)await page.reload();
    await page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Aprendamos juntos',exact:true})}).getByRole('button',{name:'Ver plano'}).click();
    await page.getByRole('textbox',{name:'Qué ocurre',exact:true}).fill('Instrucción aún sin guardar');
    const currentUrl=page.url();let prompts=0;
    const dismiss=async(dialog:import('@playwright/test').Dialog)=>{prompts++;await dialog.dismiss();};
    page.on('dialog',dismiss);await page.goBack();
    await expect(page).toHaveURL(currentUrl);
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    expect(prompts).toBe(1);
    await expect(page.getByRole('textbox',{name:'Qué ocurre',exact:true})).toHaveValue('Instrucción aún sin guardar');
    page.off('dialog',dismiss);
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Volver',exact:true}).click();
  }
});

test('controles de 48 px, contexto ampliado, rehacer y anchura del plano',async({page})=>{
  test.setTimeout(120000);await page.goto('/');
  for(const width of [320,360,390,820,1440]){
    await page.setViewportSize({width,height:1000});await nav(page,'Programa');
    const navigation=page.getByRole('navigation',{name:'Principal'});
    const label=navigation.getByRole('button',{name:'Programa',exact:true}).locator('span');
    expect(await label.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length;})).toBe(1);
    await page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Aprendamos juntos',exact:true})}).getByRole('button',{name:'Ver plano'}).click();
    await page.locator('.stage-canvas-panel').getByRole('button',{name:'Andrés, de pie',exact:true}).click();
    await page.getByRole('button',{name:'Sentado',exact:true}).click();
    await page.getByRole('button',{name:'Deshacer',exact:true}).click();
    await page.getByRole('button',{name:'Rehacer',exact:true}).click();
    await expect(page.locator('.stage-canvas-panel').getByRole('button',{name:'Andrés, sentado',exact:true})).toBeVisible();
    await page.locator('.stage-canvas-panel').getByRole('button',{name:'Andrés, sentado',exact:true}).click();
    await expect(page.getByRole('button',{name:'Dejar de seleccionar',exact:true})).toBeVisible();
    for(const expanded of [false,true]){
      if(expanded)await page.getByRole('button',{name:'Ampliar',exact:true}).click();
      const short=await page.locator('.stage-editor button,.stage-editor input,.stage-editor select,.stage-editor textarea').evaluateAll(elements=>elements.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<47.5||r.width<47.5);}).map(el=>({name:el.textContent||el.getAttribute('aria-label'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
      expect(short).toEqual([]);
      if(expanded)await expect(page.locator('.stage-event-context')).toContainText('Salón del Norte · Oviedo');
      if(width===820)expect(await page.locator('.stage-canvas-panel').evaluate(el=>el.getBoundingClientRect().width/el.parentElement!.getBoundingClientRect().width)).toBeGreaterThan(.85);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:`qa/visual-redesign/after/stage-selected-${expanded?'expanded':'normal'}-${width}.png`,fullPage:true});
    }
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Volver',exact:true}).click();
  }
});

test('nombres largos, departamento nuevo, sesenta fichas y estado vacío caben en móvil',async({page})=>{
  const data=createDemoData();
  data.events[0].title='Asamblea de circuito de lengua de signos española — Servicio compartido de las congregaciones';
  data.departments.push({id:'new',name:'Acogida de participantes y acompañantes',icon:'other'});
  for(let i=0;i<60;i++){
    data.persons.push({...data.persons[1],id:`long-${i}`,name:`María de los Ángeles Fernández de la Fuente ${i+1}`,gmail:''});
    data.candidates.push({...data.candidates[0],id:`long-${i}`,personId:`long-${i}`,departmentId:'new'});
  }
  await page.addInitScript(data=>localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data)),data);
  await page.setViewportSize({width:320,height:900});await page.goto('/');await nav(page,'Equipo');
  await page.getByLabel('Departamento del equipo').selectOption('new');
  await expect(page.locator('.team-person-card')).toHaveCount(60);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByLabel('Buscar persona o congregación').fill('Persona inexistente');
  await expect(page.locator('.team-person-card')).toHaveCount(0);
  await page.screenshot({path:'qa/visual-redesign/after/empty-long-320.png',fullPage:true});
});

test('filtros privados quedan en memoria; volver conserva consulta y el evento sigue separado',async({page})=>{
  await page.goto('/');await nav(page,'Equipo');
  await expect(page.getByRole('combobox',{name:'Congregación',exact:true})).not.toBeVisible();
  await page.getByLabel('Buscar persona o congregación').fill('Lucía');
  await page.getByLabel('Departamento del equipo').selectOption('video');
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  await page.getByRole('combobox',{name:'Congregación',exact:true}).selectOption('c1');
  await expect(page.locator('.team-person-card')).toHaveCount(1);
  expect(page.url()).toContain('departamento=video');expect(page.url()).not.toMatch(/Luc|c1|hearing|query/);
  await nav(page,'Turnos');await page.goBack();
  await expect(page.getByLabel('Buscar persona o congregación')).toHaveValue('Lucía');
  await expect(page.getByRole('button',{name:'Quitar filtro: Norte LSE'})).toBeVisible();
  await expect(page.locator('.team-person-card')).toHaveCount(1);
  await page.getByLabel('Elegir evento').selectOption('e2');await nav(page,'Equipo');
  await expect(page.getByLabel('Buscar persona o congregación')).toHaveValue('');
  await page.getByLabel('Elegir evento').selectOption('e1');await nav(page,'Equipo');
  await expect(page.getByLabel('Buscar persona o congregación')).toHaveValue('Lucía');
  await page.getByRole('button',{name:'Quitar filtro: Norte LSE'}).click();
  await page.getByRole('button',{name:'Salir',exact:true}).click();
  await page.getByRole('button',{name:'Abrir demostración'}).click();await nav(page,'Equipo');
  await expect(page.getByLabel('Buscar persona o congregación')).toHaveValue('');
});

test('estados explícitos del programa: no cambia al desplegar ni al repetir; descansos sin correo ni plano',async({page})=>{
  await page.goto('/');await nav(page,'Programa');
  const row=page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Aprendamos juntos',exact:true})});
  const before=await page.evaluate(key=>localStorage.getItem(key),dataKey);
  await row.locator('summary').click();
  expect(await page.evaluate(key=>localStorage.getItem(key),dataKey)).toBe(before);
  await row.getByLabel('Material de Aprendamos juntos').selectOption('reviewed');
  await expect(row.getByText('Material revisado',{exact:true})).toBeVisible();
  const saved=await page.evaluate(key=>localStorage.getItem(key),dataKey);
  await row.getByLabel('Material de Aprendamos juntos').selectOption('reviewed');
  expect(await page.evaluate(key=>localStorage.getItem(key),dataKey)).toBe(saved);
  await row.getByLabel('Ensayo de Aprendamos juntos').selectOption('ready');
  await expect(row.getByText('Ensayo listo',{exact:true})).toBeVisible();
  await page.reload();await expect(row.getByText('Material revisado',{exact:true})).toBeVisible();
  const rest=page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Descanso',exact:true})});
  await rest.locator('summary').click();await expect(rest.getByRole('button',{name:/Correo|plano/})).toHaveCount(0);
});

test('Más agrupa; texto grande persiste en este dispositivo; iconos instalables y marcas cargan',async({page,request})=>{
  await page.goto('/');await nav(page,'Más');
  await expect(page.getByRole('navigation',{name:'Comunicación',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Histórico',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Comunicación',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Volver',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Comunicación',exact:true})).toBeVisible();
  await options(page);await page.getByRole('button',{name:'Texto grande'}).click();
  await expect(page.locator('html')).toHaveClass('large-text');await page.reload();await expect(page.locator('html')).toHaveClass('large-text');
  const manifest=await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.icons.filter((icon:{purpose:string})=>icon.purpose==='maskable')).toHaveLength(2);
  for(const icon of manifest.icons)expect((await request.get(icon.src)).status()).toBe(200);
  expect(await page.locator('.brand-symbol').first().evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
});

test('plano ampliado, teclado, controles visuales y deshacer conservan los datos',async({page})=>{
  await page.goto('/');await nav(page,'Programa');
  await page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Aprendamos juntos',exact:true})}).getByRole('button',{name:'Ver plano'}).click();
  await page.getByRole('button',{name:'Ampliar',exact:true}).click();await expect(page.locator('html')).toHaveClass('stage-expanded');
  await expect(page.getByRole('navigation',{name:'Principal'})).not.toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Ampliar',exact:true})).toBeFocused();
  const person=page.locator('.stage-canvas-panel').getByRole('button',{name:'Andrés, de pie',exact:true});
  await person.focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Sentado',exact:true}).click();await expect(page.locator('.stage-canvas-panel').getByRole('button',{name:'Andrés, sentado',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(person).toBeVisible();
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByText('Borrador guardado. Los voluntarios aún ven la versión publicada.')).toBeVisible();
});

test('capturas y accesibilidad en 360, 390, 820 y 1440; reajuste a 320 y texto al 200 %',async({page})=>{
  test.setTimeout(150000);
  const data=createDemoData();
  data.candidates.push({...data.candidates[0],id:'admin-team',personId:'p-admin',teamRole:'assistant'});
  await page.addInitScript(data=>{if(!localStorage.getItem('ls-asambleas:demo:v1'))localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');
  for(const width of [360,390,820,1440]){
    await page.setViewportSize({width,height:1000});
    for(const [label,file] of [['Inicio','home'],['Equipo','team'],['Turnos','shifts'],['Programa','program'],['Más','more']]){
      await nav(page,label);await page.evaluate(()=>window.scrollTo(0,0));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} ${width}`).toBe(true);
      await page.screenshot({path:`qa/visual-redesign/after/${file}-${width}.png`,fullPage:true});
    }
    await nav(page,'Programa');await page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Aprendamos juntos',exact:true})}).getByRole('button',{name:'Ver plano'}).click();
    await page.getByRole('button',{name:'Ampliar',exact:true}).click();
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`qa/visual-redesign/after/stage-${width}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`plano ${width}`).toBe(true);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await page.getByRole('button',{name:'Volver',exact:true}).click();
  }
  for(const [width,font] of [[320,18],[720,36]]){
    await page.setViewportSize({width,height:1000});await page.addStyleTag({content:`:root{font-size:${font}px!important}`});
    for(const label of ['Inicio','Equipo','Turnos','Programa','Más']){
      await nav(page,label);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} ${width} font ${font}`).toBe(true);
    }
  }
});
