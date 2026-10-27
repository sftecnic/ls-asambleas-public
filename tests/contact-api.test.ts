import {afterEach,describe,it,expect,vi} from 'vitest';
import {fetchLeadershipContacts} from '../src/data/contactApi';
vi.mock('firebase/auth',()=>({getAuth:()=>({currentUser:{getIdToken:async()=>'example-token'}})}));
vi.mock('../src/data/tourApi',()=>({tourServiceUrl:'https://api.example.test'}));
const contact={personId:'p1',name:'Persona ficticia',departmentId:'video',role:'responsible',phone:'+34600123456'};
afterEach(()=>vi.unstubAllGlobals());
describe('consulta de contactos con clasificación opcional',()=>{
 it('solicita el campo explícitamente sin almacenar respuestas ni incluir tokens en la dirección',async()=>{
  const fetch=vi.fn(async()=>Response.json({eventId:'evento 1',contacts:[{...contact,hearingStatus:'deaf'}]}));vi.stubGlobal('fetch',fetch);
  expect(await fetchLeadershipContacts('evento 1',new AbortController().signal)).toEqual([{...contact,hearingStatus:'deaf'}]);
  expect(fetch).toHaveBeenCalledWith('https://api.example.test/contacts/leadership?event=evento%201&include=hearingStatus',expect.objectContaining({cache:'no-store',headers:{Authorization:'Bearer example-token'}}));
 });
 it('acepta la respuesta de un Worker anterior sin inventar clasificación',async()=>{
  vi.stubGlobal('fetch',async()=>Response.json({eventId:'e1',contacts:[contact]}));expect((await fetchLeadershipContacts('e1',new AbortController().signal))[0].hearingStatus).toBeUndefined();
 });
 it('rechaza respuestas de otro evento y campos privados adicionales',async()=>{
  for(const value of [{eventId:'e2',contacts:[contact]},{eventId:'e1',contacts:[{...contact,notes:'privado'}]}]){
   vi.stubGlobal('fetch',async()=>Response.json(value));await expect(fetchLeadershipContacts('e1',new AbortController().signal)).rejects.toThrow();
  }
 });
});
