import { describe, expect, it } from 'vitest';
import { emptyData, type AppUser, type AssemblyEvent, type Candidate, type ProgramItem } from './types';
import { DEFAULT_MAIL_TEMPLATES, getMailTemplates, getRecipient, hasCapability, initialMailSignature, isGmail, mailContext, mailHtml, recordManualSend, renderMail, signaturePeople, speakerItems } from './mail';

const event:AssemblyEvent={id:'event-a',title:'Asamblea de circuito',type:'circuit',startDate:'2026-11-07',endDate:'2026-11-07',venueId:'venue-a',section:'LSE',timezone:'Europe/Madrid',archived:false};
const user:AppUser={uid:'responsible-1',email:'responsible@gmail.com',name:'Ana Pérez',personId:'ana',role:'responsible'};
const candidate:Candidate={id:'candidate-a',eventId:event.id,personId:'person-a',departmentId:'video',committee:'proposed',availability:'unknown',access:'none',reserve:false};
const programItem:ProgramItem={id:'talk-a',eventId:event.id,title:'Un futuro seguro',startsAt:'2026-11-07T10:00:00Z',duration:30,speaker:'Luis García',speakerEmail:'speaker@jwpub.org',language:'LSE',interpreter:'',kind:'talk',driveUrl:'https://drive.google.com/drive/folders/example',material:'pending',rehearsal:'pending',status:'draft'};
function fixture(){const data=emptyData();data.events=[event];data.persons=[{id:'person-a',name:'Carmen López',congregationId:'congregation-a',phone:'',email:'carmen@jwpub.org',gmail:'',notes:''}];data.congregations=[{id:'congregation-a',name:'Madrid LSE',committeeEmail:'committee@jwpub.org'}];data.venues=[{id:'venue-a',name:'Salón de asambleas',city:'Madrid',address:'Calle Mayor, 1'}];data.departments=[{id:'video',name:'Audio y vídeo',icon:'video'}];data.candidates=[{...candidate}];return data;}
const signature={signatureDepartmentId:'video',responsibleId:'person-a',assistantId:'person-b'};
function signatureFixture(){
  const data=fixture();data.persons[0].phone='600 000 001';
  data.persons.push({...data.persons[0],id:'person-b',name:'Eva López',email:'eva@example.test',phone:'600 000 002'});
  data.candidates[0].teamRole='responsible';
  data.candidates.push({...candidate,id:'candidate-b',personId:'person-b',teamRole:'assistant'});
  data.grants=[{id:'operator',email:user.email,uid:user.uid,personId:user.personId,eventId:event.id,departmentId:'video',role:'responsible',active:true,capabilities:['view','contacts']}];
  return data;
}

describe('mail rendering',()=>{
  it('autocompletes names with punctuation and preserves necessary message whitespace',()=>{
    expect(renderMail('Hola, {{ persona }}:\n\n{{evento}}.',{persona:'María $1 López',evento:'Asamblea LSE'})).toEqual({text:'Hola, María $1 López:\n\nAsamblea LSE.',missing:[]});
  });
  it('reports unknown and missing fields once rather than copying undefined',()=>{
    expect(renderMail('{{persona}} {{nombre_antiguo}} {{persona}}',{persona:''})).toEqual({text:'{{persona}} {{nombre_antiguo}} {{persona}}',missing:['persona','nombre_antiguo']});
  });
  it('blocks incomplete template variables rather than copying unresolved syntax',()=>{
    expect(renderMail('Hola {{persona', {persona:'Ana'}).missing).toEqual(['variable incompleta']);
    expect(renderMail('Hola {{}}', {}).missing).toEqual(['variable incompleta']);
  });
  it('supports seed aliases and the event timezone for speaker messages',()=>{
    const context=mailContext(fixture(),event,user,undefined,programItem);
    expect(context).toMatchObject({persona:'Luis García',discursante:'Luis García',drive:programItem.driveUrl,carpeta:programItem.driveUrl,hora:'11:00'});
    expect(getRecipient(fixture(),'speaker',undefined,programItem)).toBe('speaker@jwpub.org');
  });
  it('keeps committee recipient separate from volunteer recipient',()=>{
    expect(getRecipient(fixture(),'committee',candidate)).toBe('committee@jwpub.org');
    expect(getRecipient(fixture(),'volunteer',candidate)).toBe('carmen@jwpub.org');
  });
  it('supplies defaults only for kinds without a saved template',()=>{
    const data=fixture();data.templates=[{...DEFAULT_MAIL_TEMPLATES[0],id:'custom',name:'Mi solicitud'}];
    expect(getMailTemplates(data).map(t=>t.id)).toEqual(['custom','default-volunteer','default-speaker','default-reminder']);
  });
});

describe('explicit manual send recording',()=>{
  it('captures immutable rendered text and moves committee to pending without accepting the volunteer',()=>{
    const data=fixture(),template=DEFAULT_MAIL_TEMPLATES[0];
    const next=recordManualSend(data,event,user,{candidate,template,recipient:' committee@jwpub.org ',subjectSource:template.subject,bodySource:template.body},'2026-10-22T10:00:00.000Z','send-1');
    expect(next.communications[0]).toMatchObject({id:'send-1',recipient:'committee@jwpub.org',sentBy:user.uid,sentAt:'2026-10-22T10:00:00.000Z'});
    expect(next.communications[0].body).toContain('Carmen López');
    expect(next.communications[0].body).not.toContain('{{');
    expect(next.candidates[0]).toMatchObject({committee:'pending',availability:'unknown',access:'none'});
    expect(data.communications).toEqual([]);expect(data.candidates[0].committee).toBe('proposed');
    data.persons[0].name='Nombre cambiado';expect(next.communications[0].body).toContain('Carmen López');
  });
  it('does not register availability without committee approval',()=>{
    const template=DEFAULT_MAIL_TEMPLATES[1];
    expect(()=>recordManualSend(fixture(),event,user,{candidate,template,recipient:'carmen@jwpub.org',subjectSource:template.subject,bodySource:template.body})).toThrow('aprobación');
  });
  it('records an invitation while keeping approved committee and no access',()=>{
    const data=fixture();data.candidates[0].committee='approved';const approved=data.candidates[0],template=DEFAULT_MAIL_TEMPLATES[1];
    const next=recordManualSend(data,event,user,{candidate:approved,template,recipient:'carmen@jwpub.org',subjectSource:template.subject,bodySource:template.body});
    expect(next.candidates[0]).toMatchObject({committee:'approved',availability:'invited',access:'none'});
  });
  it('refuses unresolved data, invalid recipient and an event mismatch',()=>{
    const data=fixture(),template=DEFAULT_MAIL_TEMPLATES[0];
    const input={candidate,template,recipient:'committee@jwpub.org',subjectSource:template.subject,bodySource:'{{desconocido}}'};
    expect(()=>recordManualSend(data,event,user,input)).toThrow('datos');
    expect(()=>recordManualSend(data,event,user,{...input,recipient:'uno@jwpub.org;dos@jwpub.org'})).toThrow('destinatario');
    expect(()=>recordManualSend(data,event,user,{...input,candidate:{...candidate,eventId:'other'}})).toThrow('evento');
    expect(data.communications).toHaveLength(0);
  });
  it('does not downgrade an already accepted volunteer when recording a later message',()=>{
    const data=fixture();data.candidates[0]={...candidate,committee:'approved',availability:'accepted',access:'active'};
    const template=DEFAULT_MAIL_TEMPLATES[1];
    const next=recordManualSend(data,event,user,{candidate:data.candidates[0],template,recipient:'carmen@jwpub.org',subjectSource:template.subject,bodySource:template.body});
    expect(next.candidates[0]).toEqual(data.candidates[0]);
  });
});

describe('contact and access helpers',()=>{
  it('accepts Gmail only, including case and surrounding spaces',()=>{
    expect(isGmail(' User.Name@gmail.com ')).toBe(true);
    expect(isGmail('user@googlemail.com')).toBe(false);
    expect(isGmail('user@gmail.com.evil.test')).toBe(false);
    expect(isGmail('user name@gmail.com')).toBe(false);
  });
  it('does not expose contacts across departments or events and honors revocation',()=>{
    const data=fixture();data.grants=[{id:'grant-a',email:user.email,personId:user.personId,eventId:event.id,departmentId:'video',role:'responsible',active:true,capabilities:['contacts']}];
    expect(hasCapability(data,user,event.id,'contacts','video')).toBe(true);
    expect(hasCapability(data,user,event.id,'contacts','platform')).toBe(false);
    expect(hasCapability(data,user,'other','contacts','video')).toBe(false);
    data.grants[0].active=false;expect(hasCapability(data,user,event.id,'contacts','video')).toBe(false);
  });
  it('does not trust a displayed admin role or a matching email with a different bound uid',()=>{
    const data=fixture();
    expect(hasCapability(data,{...user,role:'admin'},event.id,'contacts','video')).toBe(false);
    data.grants=[{id:'grant-a',email:user.email,uid:'another-account',personId:user.personId,eventId:event.id,departmentId:'video',role:'responsible',active:true,capabilities:['contacts']}];
    expect(hasCapability(data,user,event.id,'contacts','video')).toBe(false);
  });
});

describe('visual speaker messages',()=>{
  it('groups only matching speakers in this event, excludes songs and flags missing folders',()=>{
    const data=fixture();
    data.program=[programItem,{...programItem,id:'second',title:'Otro discurso',startsAt:'2026-11-07T14:00:00Z'},
      {...programItem,id:'other-event',eventId:'event-b'}, {...programItem,id:'shared-email',speaker:'Otra persona'},
      {...programItem,id:'song',kind:'song'}];
    expect(speakerItems(data,event,programItem).map(p=>p.id)).toEqual(['talk-a','second']);
    expect(mailContext(data,event,user,undefined,programItem).discursos).toContain('Otro discurso');
    data.program[1].driveUrl='';
    expect(mailContext(data,event,user,undefined,programItem).discursos).toBe('');
    expect(speakerItems(data,event,{...programItem,speakerEmail:''})).toHaveLength(1);
  });
  it('requires the current deadline and a valid HTTPS video before recording a speaker message',()=>{
    const data=signatureFixture(),template=DEFAULT_MAIL_TEMPLATES[2];
    const input={programItem,template,recipient:programItem.speakerEmail,subjectSource:template.subject,bodySource:template.body};
    expect(()=>recordManualSend(data,event,user,input)).toThrow('datos');
    expect(()=>recordManualSend(data,event,user,{...input,details:{deadline:'2026-11-05T23:59',videoUrl:'javascript:alert(1)'}})).toThrow('datos');
    const next=recordManualSend(data,event,user,{...input,details:{deadline:'2026-11-05T23:59',videoUrl:'https://example.test/video-lse',...signature}});
    expect(next.communications[0].body).toContain('5 de noviembre de 2026');
    expect(next.communications[0].body).toContain('23:59');
    expect(next.communications[0].body).not.toContain('{{');
    expect(data.communications).toHaveLength(0);
  });
  it('copies styled headings and HTTPS links without accepting HTML from names or templates',()=>{
    const html=mailHtml('Hola <img src=x onerror=alert(1)>\n\n1. Prepara la lista\nA & B\nhttps://example.test/folder?a=1&b=2\n\njavascript:alert(1)');
    expect(html).not.toContain('<img');expect(html).toContain('&lt;img');
    expect(html).toContain('<strong>1. Prepara la lista</strong>');
    expect(html).toContain('href="https://example.test/folder?a=1&amp;b=2"');
    expect(html).not.toContain('href="javascript:');
  });
});

describe('variable contact signatures',()=>{
  it('fills names, correspondence emails and phones from the selected people, not the signed-in user',()=>{
    const data=signatureFixture();data.persons[0].gmail='login@gmail.com';
    const context=mailContext(data,event,user,undefined,programItem,signature);
    expect(context).toMatchObject({departamento_firma:'Audio y vídeo',responsable_nombre:'Carmen López',responsable_correo:'carmen@jwpub.org',responsable_telefono:'600 000 001',auxiliar_nombre:'Eva López',auxiliar_correo:'eva@example.test',auxiliar_telefono:'600 000 002'});
    expect(context.firma_contactos).toBe('Carmen López\ncarmen@jwpub.org · 600 000 001\n\nEva López\neva@example.test · 600 000 002');
    expect(context.firma_contactos).not.toContain(user.name);expect(context.firma_contactos).not.toContain('login@gmail.com');
    data.persons[0].phone='600 000 099';
    expect(mailContext(data,event,user,undefined,programItem,signature).responsable_telefono).toBe('600 000 099');
  });
  it('allows a sole responsible and blocks incomplete or duplicate contacts without falling back to Gmail',()=>{
    const data=signatureFixture();
    expect(mailContext(data,event,user,undefined,programItem,{...signature,assistantId:''}).firma_contactos).not.toContain('Eva');
    expect(mailContext(data,event,user,undefined,programItem,{...signature,assistantId:'person-a'}).firma_contactos).toBe('');
    data.persons[1].phone='';
    expect(mailContext(data,event,user,undefined,programItem,signature).firma_contactos).toBe('');
    data.persons[0].email='';data.persons[0].gmail='valid@gmail.com';
    expect(mailContext(data,event,user,undefined,programItem,{...signature,assistantId:''}).responsable_correo).toBe('');
  });
  it('cannot use contacts from another event or department, or after revocation',()=>{
    const data=signatureFixture();data.candidates[1].eventId='another-event';
    expect(signaturePeople(data,event.id,'video',user).map(p=>p.id)).toEqual(['person-a']);
    expect(mailContext(data,event,user,undefined,programItem,signature).auxiliar_correo).toBe('');
    data.candidates[0].departmentId='makeup';
    expect(mailContext(data,event,user,undefined,programItem,signature).firma_contactos).toBe('');
    data.candidates[0].departmentId='video';data.grants[0].active=false;
    expect(signaturePeople(data,event.id,'video',user)).toEqual([]);
    expect(mailContext(data,event,user,undefined,programItem,signature).responsable_telefono).toBe('');
  });
  it('uses operational roles independently of access grants and never promotes an auxiliary',()=>{
    const data=signatureFixture();
    expect(initialMailSignature(data,event.id,'video',user)).toEqual({responsibleId:'person-a',assistantId:'person-b'});
    expect(signaturePeople(data,event.id,'video',user,'responsible').map(p=>p.id)).toEqual(['person-a']);
    data.grants.push({...data.grants[0],id:'misleading-permission',personId:'person-b',email:'other@gmail.com',role:'responsible'});
    expect(initialMailSignature(data,event.id,'video',user).responsibleId).toBe('person-a');
    expect(mailContext(data,event,user,undefined,programItem,{...signature,responsibleId:'person-b',assistantId:''}).firma_contactos).toBe('');
    data.candidates.push({...candidate,id:'other-role',personId:'person-b',teamRole:'responsible'});
    expect(initialMailSignature(data,event.id,'video',user).responsibleId).toBe('');
    data.candidates[2].eventId='another-event';
    expect(initialMailSignature(data,event.id,'video',user).responsibleId).toBe('person-a');
  });
  it('keeps legacy sender variables compatible with the canonical directory name',()=>{
    const data=fixture();data.persons.push({...data.persons[0],id:user.personId,name:'Nombre canónico'});
    const context=mailContext(data,event,user,candidate);
    expect(renderMail('{{remitente}} / {{responsable}}',context).text).toBe('Nombre canónico / Nombre canónico');
  });
  it('keeps the recorded signature unchanged when the directory is later edited',()=>{
    const data=signatureFixture(),template=DEFAULT_MAIL_TEMPLATES[2];
    const input={programItem,template,recipient:programItem.speakerEmail,subjectSource:template.subject,bodySource:template.body,details:{...signature,deadline:'2026-11-05T23:59',videoUrl:'https://example.test/video'}};
    const next=recordManualSend(data,event,user,input);
    data.persons[0].phone='600 000 099';
    expect(next.communications[0].body).toContain('600 000 001');
    expect(next.communications[0].body).not.toContain('{{');
    expect(DEFAULT_MAIL_TEMPLATES[2].body).toContain('{{firma_contactos}}');
  });
});
