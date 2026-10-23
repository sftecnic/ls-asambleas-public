import {test,expect} from '@playwright/test';
import {createDemoData} from '../src/seed';

// Run only against the untouched pre-redesign checkout, never the current app.
test('capturas comparables del diseño anterior',async({page})=>{
  test.skip(process.env.TEST_VISUAL_BASELINE!=='1','Requiere la versión anterior aislada.');
  test.setTimeout(120000);
  const data=createDemoData();
  data.candidates.push({...data.candidates[0],id:'admin-team',personId:'p-admin',teamRole:'assistant'});
  await page.addInitScript(data=>localStorage.setItem('ls-asambleas:demo:v1',JSON.stringify(data)),data);
  await page.goto('/');
  for(const width of [360,390,820,1440]){
    await page.setViewportSize({width,height:1000});
    for(const [label,file] of [['Inicio','home'],['Equipo','team'],['Turnos','shifts'],['Programa','program']]){
      await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:label,exact:true}).click();
      await expect(page.getByRole('heading',{name:new RegExp('^'+label)}).first()).toBeVisible();
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:`qa/visual-redesign/before/${file}-${width}.png`,fullPage:true});
    }
    await page.locator('.program-row').filter({has:page.getByRole('heading',{name:'Aprendamos juntos',exact:true})}).getByRole('button',{name:'Plano',exact:true}).click();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`qa/visual-redesign/before/stage-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Volver',exact:true}).click();
  }
});
