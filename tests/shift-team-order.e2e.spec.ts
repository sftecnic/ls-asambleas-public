import {openOptions} from './ui-navigation';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';
import {publishDepartment} from '../src/domain/publication';

test('keeps leaders in the header and orders both sessions by post regardless of duty or person',async({page},testInfo)=>{
  const data=createDemoData(),base=data.shifts[0],participation=data.candidates[0];
  data.candidates[0].teamRole='assistant';data.candidates[1].teamRole='volunteer';data.candidates[5].teamRole='volunteer';
  data.candidates.push({...participation,id:'lead-no-shift',personId:'p-admin',teamRole:'responsible'},
    {...participation,id:'lead-with-shift',personId:'p3',teamRole:'responsible'},
    {...participation,id:'other-department',personId:'p2',departmentId:'platform',teamRole:'responsible'},
    {...participation,id:'other-event',personId:'p4',eventId:'e2',teamRole:'assistant'});
  // Access permissions do not determine the person's duty in this department.
  data.grants.push({...data.grants[1],id:'misleading',personId:'p6',email:'other@example.test',uid:'other',role:'responsible'});
  data.shifts.push({...base,id:'late-responsible',personId:'p3',role:'Mesa',startsAt:'2027-04-10T09:00:00.000Z',endsAt:'2027-04-10T10:00:00.000Z'},
    {...base,id:'early-volunteer',personId:'p2',role:'Director',startsAt:'2027-04-10T07:00:00.000Z',endsAt:'2027-04-10T08:00:00.000Z'},
    {...base,id:'middle-volunteer',personId:'p6',role:'Ordenador',startsAt:'2027-04-10T07:30:00.000Z',endsAt:'2027-04-10T08:00:00.000Z'},
    {...data.shifts[2],id:'pm-director',personId:'p2',role:'Director'},
    {...data.shifts[2],id:'pm-mesa',personId:'p3',role:'Mesa'},
    {...data.shifts[2],id:'pm-camera',personId:'p1',role:'Cámara'});
  data.shifts.reverse();
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
  const video=page.getByRole('region',{name:'Audio y vídeo',exact:true}),morning=video.getByRole('region',{name:'Mañana',exact:true});
  await expect(video.locator('.shift-summary-leader dt')).toHaveText(['Responsables','Auxiliar']);
  await expect(video.locator('.shift-summary-leader dd').first()).toHaveText('Elena VidalSara Gil');
  await expect(video.locator('.shift-summary-leader dd').nth(1)).toHaveText('Lucía Martín');
  await expect(video.locator('.shift-summary-leader')).not.toContainText(['David Romero']);
  await expect(video.locator('.shift-card .person-line')).not.toContainText(['Elena Vidal']);
  const order=['Director','Mesa','Vídeo','Cámara'];
  await expect(morning.locator('.shift-card h4')).toHaveText(order);
  await expect(video.getByRole('region',{name:'Tarde',exact:true}).locator('.shift-card h4')).toHaveText(order);
  await expect(morning.locator('.shift-person-role')).toHaveText(['Voluntario','Responsable','Voluntario','Auxiliar']);
  for(const icon of ['conductor','sliders-horizontal','monitor-play','joystick'])await expect(morning.locator(`.shift-post .lucide-${icon}`)).toHaveCount(1);
  await page.getByRole('button',{name:'Ver lista',exact:true}).click();await expect(morning.locator('.shift-card h4')).toHaveText(order);
  await page.getByRole('button',{name:'Por sesión',exact:true}).click();
  for(const [width,height] of [[390,844],[820,1180],[1440,1000]]){
    await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await video.evaluate(element=>{
      const context=document.querySelector('.event-context');
      const clearance=context&&getComputedStyle(context).position==='sticky'?context.getBoundingClientRect().height:0;
      window.scrollTo(0,scrollY+element.getBoundingClientRect().top-clearance-20);
    });
    await page.screenshot({path:testInfo.outputPath(`post-order-${width}.png`)});
  }
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.emulateMedia({media:'print'});await expect(video.locator('.shift-summary-leader dt')).toHaveText(['Responsables','Auxiliar']);
  await page.emulateMedia({media:'screen'});expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
});

test('preserves published department names and duties after later draft edits',async({page})=>{
  const data=createDemoData(),base=data.shifts[0],candidate=data.candidates[0];
  data.candidates[0].teamRole='assistant';
  data.candidates.push({...candidate,id:'leader',personId:'p-admin',teamRole:'responsible'},
    {...candidate,id:'leader-shift',personId:'p3',teamRole:'responsible'});
  data.shifts.push({...base,id:'late-leader',personId:'p3',role:'Mesa',startsAt:'2027-04-10T09:00:00.000Z',endsAt:'2027-04-10T10:00:00.000Z'},
    {...base,id:'early-volunteer',personId:'p2',role:'Director',startsAt:'2027-04-10T07:00:00.000Z',endsAt:'2027-04-10T08:00:00.000Z'});
  const next=publishDepartment(data,data.events[0],'video',{uid:'demo-admin',email:'admin@example.test',name:'Elena Vidal',personId:'p-admin',role:'admin'});
  next.persons.forEach(p=>{p.name='Nombre editado';});next.candidates.forEach(c=>{c.teamRole='volunteer';});
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},next);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await openOptions(page); await page.getByRole('button',{name:'Ver publicado',exact:true}).click();
  const video=page.getByRole('region',{name:'Audio y vídeo',exact:true}),morning=video.getByRole('region',{name:'Mañana',exact:true});
  await expect(video.locator('.shift-summary-leader dt')).toHaveText(['Responsables','Auxiliar']);
  await expect(video.locator('.shift-summary-leader dd').first()).toHaveText('Elena VidalSara Gil');
  await expect(morning.locator('.shift-card h4')).toHaveText(['Director','Mesa','Cámara']);
  await expect(morning.locator('.shift-person-role')).toHaveText(['Voluntario','Responsable','Auxiliar']);
  await expect(morning.locator('.shift-person-copy strong')).toHaveText(['David Romero','Sara Gil','Lucía Martín']);
  await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
});

test('keeps authorized published shifts visible without exposing editing controls or inferring roles',async({page})=>{
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  await openOptions(page); await page.getByRole('button',{name:'Ver publicado',exact:true}).click();
  await expect(page.locator('.shift-department-heading h2')).toHaveText(['Audio y vídeo','Plataforma']);
  await expect(page.getByRole('heading',{name:'Cámara',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Añadir turno',exact:true})).toHaveCount(0);
  await expect(page.locator('.shift-person-role')).toHaveCount(0);
  await page.getByLabel('Departamento',{exact:true}).selectOption('platform');
  await expect(page.locator('.shift-department-heading h2')).toHaveText(['Plataforma']);
});
