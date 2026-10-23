import type {Page} from '@playwright/test';
export async function openOptions(page:Page){
  const button=page.getByRole('button',{name:'Opciones',exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
