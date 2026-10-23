import {describe,it,expect} from 'vitest';
import {canonicalAppUrl} from './authRouting';

describe('dominio compartido entre aplicación y Google',()=>{
  const project='demo-asambleas-ejemplo';
  it('conserva el enlace del evento al pasar al origen de autenticación',()=>{
    expect(canonicalAppUrl(project,`https://${project}.web.app/?evento=asamblea-1#programa`,true))
      .toBe(`https://${project}.firebaseapp.com/?evento=asamblea-1#programa`);
  });
  it('no provoca un bucle en el origen definitivo',()=>{
    expect(canonicalAppUrl(project,`https://${project}.firebaseapp.com/`,true)).toBeNull();
  });
  it('no intercepta callbacks, otras aplicaciones ni el desarrollo',()=>{
    for(const url of [`https://${project}.web.app/__/auth/handler`,`https://otra-app.web.app/`,'http://localhost:5174/'])
      expect(canonicalAppUrl(project,url,true)).toBeNull();
    expect(canonicalAppUrl(project,`https://${project}.web.app/`,false)).toBeNull();
    expect(canonicalAppUrl(undefined,`https://${project}.web.app/`,true)).toBeNull();
  });
});
