import {createLucideIcon} from 'lucide-react';

/** A conductor with raised arms and a baton, using Lucide's stroke and sizing. */
export const ConductorIcon=createLucideIcon('Conductor',[
  ['circle',{cx:'11',cy:'5',r:'2',key:'head'}],
  ['path',{d:'M8 21V10h6v11',key:'body'}],
  ['path',{d:'m8 10-3 3-3-3',key:'left-arm'}],
  ['path',{d:'m14 10 3 3 3-3',key:'right-arm'}],
  ['path',{d:'M8 16h6m-3 0v5',key:'legs'}],
  ['path',{d:'m20 8 2-5',key:'baton'}],
]);
