import {Joystick,SlidersHorizontal,MonitorPlay,PanelsTopLeft,AudioLines,Presentation,Brush,MapPin} from 'lucide-react';
import type {TourZone} from '../domain/tours';
export function TourIcon({icon,size=24}:{icon:TourZone['icon'];size?:number}){const Icon={camera:Joystick,mixer:SlidersHorizontal,video:MonitorPlay,monitor:PanelsTopLeft,audio:AudioLines,platform:Presentation,makeup:Brush,location:MapPin}[icon];return <Icon size={size} aria-hidden="true"/>;}
