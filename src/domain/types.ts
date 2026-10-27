export type Id = string;
export interface Row { id:Id; revision?:number }
export type Capability = 'view'|'edit'|'assign'|'publish'|'manageAccess'|'contacts';
export interface Department extends Row {name:string;icon:'video'|'platform'|'makeup'|'other';instructions?:string;trainingUrl?:string}
export interface Congregation extends Row {name:string;committeeEmail:string}
export type HearingStatus='unknown'|'deaf'|'hearing';
export type Appointment='unknown'|'none'|'ministerial-servant'|'elder'|'circuit-overseer';
export type RegularPioneer='unknown'|'yes'|'no'|'not-applicable';
export interface Person extends Row {name:string;aliases?:string[];congregationId:string;phone:string;email:string;gmail:string;notificationEmail?:string;notes:string;hearingStatus?:HearingStatus;appointment?:Appointment;regularPioneer?:RegularPioneer;source?:string}
export interface VenueTemplate {id:string;name:string;elements:StageElement[]}
export interface Venue extends Row {name:string;city:string;address:string;stageTemplates?:VenueTemplate[]}
export interface AssemblyEvent extends Row {title:string;type:'circuit'|'regional'|'pioneers';startDate:string;endDate:string;venueId:string;section:string;timezone:string;archived:boolean}
export type TeamRole = 'responsible'|'assistant'|'volunteer'|'supervisor';
export interface Candidate extends Row {eventId:string;personId:string;departmentId:string;teamRole?:TeamRole;committee:'proposed'|'pending'|'approved'|'denied';availability:'unknown'|'invited'|'accepted'|'declined';access:'none'|'invited'|'active';reserve:boolean}
export interface Shift extends Row {eventId:string;departmentId:string;personId:string;role:string;startsAt:string;endsAt:string;meetingPoint:string;status:'draft'|'published';attendance:'planned'|'present'|'absent'|'completed'|'replaced';replacementFor?:string;substituteIds:string[]}
export interface ProgramItem extends Row {eventId:string;title:string;startsAt:string;duration:number;speaker:string;speakerEmail:string;language:'LSE'|'oral';interpreter:string;kind:'talk'|'song'|'break'|'interview';driveUrl:string;material:'pending'|'received'|'reviewed';rehearsal:'pending'|'ready';status:'draft'|'published'}
export interface StageElement {id:string;kind:'person'|'chair'|'table'|'lectern';label:string;x:number;y:number;posture:'standing'|'sitting';facing:'audience'|'left'|'right';movement?:'none'|'enter'|'exit'}
export interface StageMoment {id:string;title:string;instruction:string;camera:string;elements:StageElement[]}
export interface StagePlan extends Row {eventId:string;programItemId:string;name:string;moments:StageMoment[];status:'draft'|'published';updatedAt:string}
export interface MailTemplate extends Row {name:string;kind:'committee'|'volunteer'|'speaker'|'reminder';subject:string;body:string}
export interface Communication extends Row {eventId:string;departmentId?:string;personId?:string;programItemId?:string;templateId:string;recipient:string;subject:string;body:string;sentAt:string;sentBy:string}
export interface Grant extends Row {email:string;uid?:string;personId:string;eventId:string;departmentId:string;role:'admin'|'responsible'|'assistant'|'volunteer';capabilities:Capability[];active:boolean}
export interface Notice extends Row {eventId:string;personId?:string;departmentId?:string;title:string;body:string;createdAt:string;readBy:string[];meetingId?:string;meetingVersion?:number}
export type MeetingKind='zoom'|'in-person'|'orientation';
export interface Meeting extends Row {eventId:string;departmentIds:string[];kind:MeetingKind;title:string;startsAt:string;duration:number;location:string;address:string;zoomUrl:string;instructions:string;sessionDate:string;session:'morning'|'afternoon';additionalPersonIds:string[]}
export interface MeetingPublication extends Meeting {version:number;status:'confirmed'|'cancelled';publishedAt:string;publishedBy:string;recipientIds:string[]}
export type MeetingCommand={action:'save'|'confirm';meeting:Meeting;expectedVersion:number}|{action:'cancel';meetingId:string;eventId:string;expectedVersion:number};
export interface AuditEntry extends Row {eventId:string;actor:string;at:string;action:string;collection?:string;entityId?:string}
export interface PublishedTeamMember {personId:string;name:string;role:TeamRole}
export interface Publication extends Row {eventId:string;departmentId:string;department?:Department;team?:PublishedTeamMember[];version:number;publishedAt:string;publishedBy:string;shifts:Shift[];program:ProgramItem[];plans:StagePlan[]}
export interface AppData {events:AssemblyEvent[];departments:Department[];congregations:Congregation[];persons:Person[];venues:Venue[];candidates:Candidate[];shifts:Shift[];program:ProgramItem[];plans:StagePlan[];templates:MailTemplate[];communications:Communication[];grants:Grant[];notices:Notice[];audit:AuditEntry[];publications:Publication[];meetings:Meeting[];meetingPublications:MeetingPublication[]}
export type CollectionName = keyof AppData;
export interface AppUser {uid:string;email:string;name:string;personId:string;role:'admin'|'responsible'|'assistant'|'volunteer'}
export type ChangeData = (next:AppData, description:string)=>Promise<void>;
export interface ImportOperations {refresh:()=>Promise<AppData>;commit:(before:AppData,next:AppData,description:string)=>Promise<AppData>}
export interface PanelProps {data:AppData;event:AssemblyEvent;user:AppUser;onChange:ChangeData;canEdit:boolean;canPublish:boolean;online:boolean;onImport?:ImportOperations;onMeetingCommand?:(command:MeetingCommand)=>Promise<void>}
export const emptyData=():AppData=>({events:[],departments:[],congregations:[],persons:[],venues:[],candidates:[],shifts:[],program:[],plans:[],templates:[],communications:[],grants:[],notices:[],audit:[],publications:[],meetings:[],meetingPublications:[]});
