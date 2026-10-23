import {openOptions} from './ui-navigation';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createDemoData} from '../src/seed';
import {publishDepartment} from '../src/domain/publication';

function sharedDetailsFixture(){
  const data=createDemoData(),base=data.shifts[0],afternoon=data.shifts[2];
  data.shifts.filter(s=>s.departmentId==='video').forEach(s=>{s.meetingPoint='Mesa de audio y vídeo';});
  data.candidates[0].teamRole='assistant';
  data.candidates.push({...data.candidates[0],id:'leader',personId:'p-admin',teamRole:'responsible'});
  data.shifts.push({...base,id:'audio',personId:'p2',role:'Audio'},
    {...base,id:'director',personId:'p3',role:'Director'},
    {...base,id:'exception',personId:'p6',role:'Apoyo especial',startsAt:'2027-04-10T09:00:00.000Z',meetingPoint:'Entrada lateral'},
    {...afternoon,id:'pm-camera',personId:'p5',role:'Cámara'},
    {...afternoon,id:'pm-audio',personId:'p2',role:'Audio'});
  return data;
}

test('shares each session time in its own section and the meeting point beside leaders',async({page},testInfo)=>{
  const data=sharedDetailsFixture();
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const before=await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'));
  const video=page.getByRole('region',{name:'Audio y vídeo',exact:true}),summary=video.locator('.shift-department-summary');
  await expect(summary.locator('.shift-summary-leader dt')).toHaveText(['Responsable','Auxiliar']);
  await expect(summary.locator('.shift-time')).toHaveCount(0);
  await expect(video.locator('.shift-session-heading .shift-time')).toHaveText(['10:00 – 12:00','14:00 – 16:00']);
  await expect(video.getByText('Mesa de audio y vídeo',{exact:true})).toHaveCount(1);
  const morning=video.getByRole('region',{name:'Mañana',exact:true});
  await expect(morning.locator('.shift-session-time .shift-time')).toHaveText('10:00 – 12:00');
  await expect(video.getByRole('region',{name:'Tarde',exact:true}).locator('.shift-session-time .shift-time')).toHaveText('14:00 – 16:00');
  const camera=morning.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Cámara',exact:true})});
  await expect(camera.locator('.shift-time')).toHaveCount(0);await expect(camera.locator('.shift-card-detail')).toHaveCount(0);
  await expect(camera).toHaveAccessibleDescription(/Horario general de mañana:\s*10:00 – 12:00\s+Mesa de audio y vídeo/);
  const exception=morning.locator('.shift-card').filter({has:page.getByRole('heading',{name:'Apoyo especial',exact:true})});
  await expect(exception.getByText('Horario propio',{exact:true})).toBeVisible();await expect(exception.locator('.shift-time')).toHaveText('11:00 – 12:00');
  await expect(exception.getByText('Otro encuentro',{exact:true})).toBeVisible();await expect(exception.getByText('Entrada lateral',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ver lista',exact:true}).click();await expect(video.locator('.shift-session-heading .shift-time')).toHaveCount(2);await expect(camera.locator('.shift-card-detail')).toHaveCount(0);
  await page.getByRole('button',{name:'Por sesión',exact:true}).click();
  for(const [width,height] of [[390,1000],[820,1180],[1440,1000]]){
    await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await video.evaluate(element=>{
      const context=document.querySelector('.event-context');
      const clearance=context&&getComputedStyle(context).position==='sticky'?context.getBoundingClientRect().height:0;
      window.scrollTo(0,scrollY+element.getBoundingClientRect().top-clearance-20);
    });
    await page.screenshot({path:testInfo.outputPath(`shared-details-${width}.png`)});
  }
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.emulateMedia({media:'print'});await expect(summary).toBeVisible();await expect(exception.getByText('Otro encuentro',{exact:true})).toBeVisible();
  await page.emulateMedia({media:'screen'});expect(await page.evaluate(()=>localStorage.getItem('ls-asambleas:demo:v1'))).toBe(before);
  // Editing still presents the complete stored data, including inherited details.
  await camera.getByRole('button',{name:'Editar',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Editar turno'});
  await expect(dialog.getByLabel('Inicio',{exact:true})).toHaveValue('2027-04-10T10:00');await expect(dialog.getByLabel('Punto de encuentro',{exact:true})).toHaveValue('Mesa de audio y vídeo');
});

test('does not guess a shared schedule when tied and distinguishes missing meeting points',async({page})=>{
  const data=createDemoData(),base=data.shifts[0];
  data.shifts=data.shifts.filter(s=>s.departmentId!=='video');
  data.shifts.push({...base,id:'first',role:'Primer tramo',meetingPoint:''},
    {...base,id:'second',personId:'p2',role:'Segundo tramo',startsAt:'2027-04-10T07:00:00.000Z',endsAt:'2027-04-10T08:00:00.000Z',meetingPoint:'Vestíbulo'});
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const video=page.getByRole('region',{name:'Audio y vídeo',exact:true});
  await expect(video.locator('.shift-session-time')).toHaveCount(0);await expect(video.locator('.shift-summary-place')).toHaveCount(0);
  await expect(video.locator('.shift-card .shift-time')).toHaveText(['10:00 – 12:00','09:00 – 10:00']);
  await expect(video.getByText('Sin punto de encuentro',{exact:true})).toBeVisible();await expect(video.getByText('Vestíbulo',{exact:true})).toBeVisible();
});

test('shows a missing common meeting point once without inventing a location',async({page})=>{
  const data=createDemoData();data.shifts.filter(s=>s.departmentId==='video').forEach(s=>{s.meetingPoint='';});
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},data);
  await page.goto('/');
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();
  const video=page.getByRole('region',{name:'Audio y vídeo',exact:true});
  await expect(video.locator('.shift-summary-place').getByText('Sin punto de encuentro',{exact:true})).toBeVisible();
  await expect(video.getByText('Sin punto de encuentro',{exact:true})).toHaveCount(1);
});

test('shows published shared details rather than subsequent draft changes',async({page})=>{
  const data=sharedDetailsFixture();
  const next=publishDepartment(data,data.events[0],'video',{uid:'demo-admin',email:'admin@example.test',name:'Elena Vidal',personId:'p-admin',role:'admin'});
  next.shifts.filter(s=>s.departmentId==='video').forEach(s=>{s.meetingPoint='Lugar cambiado en borrador';s.startsAt='2027-04-10T06:00:00.000Z';});
  await page.addInitScript(data=>{localStorage.clear();localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data));},next);
  await page.goto('/');await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Turnos',exact:true}).click();await openOptions(page); await page.getByRole('button',{name:'Ver publicado',exact:true}).click();
  const video=page.getByRole('region',{name:'Audio y vídeo',exact:true});
  await expect(video.locator('.shift-session-heading .shift-time')).toHaveText(['10:00 – 12:00','14:00 – 16:00']);
  await expect(video.getByText('Mesa de audio y vídeo',{exact:true})).toHaveCount(1);await expect(video).not.toContainText('Lugar cambiado en borrador');
  await expect(video.getByText('Entrada lateral',{exact:true})).toBeVisible();await expect(video.getByRole('button',{name:'Editar',exact:true})).toHaveCount(0);
});
