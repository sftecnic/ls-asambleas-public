import type {CSSProperties} from 'react';
import {Joystick,MonitorPlay,SlidersHorizontal} from 'lucide-react';
import type {Department} from '../domain/types';
import {shiftPost} from '../domain/shiftPosts';
import {DepartmentIcon} from './UI';
import {ConductorIcon} from './ConductorIcon';
import '../styles/shift-post.css';

const icons={conductor:ConductorIcon,sliders:SlidersHorizontal,monitor:MonitorPlay,joystick:Joystick};

export function ShiftPost({departmentId,department,role}:{departmentId:string;department?:Department;role:string}){
  const post=shiftPost(departmentId,role),Icon=post.icon==='department'?undefined:icons[post.icon];
  const colors={'--post-ink':post.ink,'--post-background':post.background} as CSSProperties;
  return <span className="shift-post" data-post={post.key}>
    <span className="shift-post-icon" style={colors}>{Icon?<Icon size={24} aria-hidden="true"/>:<DepartmentIcon department={department} size={24}/>}</span>
    <span className="shift-post-label">{post.label}</span>
  </span>;
}
