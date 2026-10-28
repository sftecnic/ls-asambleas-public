import CalendarPanel from './CalendarPanel';
import MeetingSchedule from './MeetingSchedule';
import {useViewState} from './ViewState';
import {meetingScheduleRows,meetingInProgress,type MeetingScheduleRow} from '../domain/meetingSchedule';
import ZoomConnection from './ZoomConnection';
import {zoomDetails} from '../domain/zoom';
import HomeFocus from './HomeFocus';
import {attentionIds,type HomeIntent} from '../domain/homeDashboard';
import { useState } from "react";
import {
  Video,
  MapPin,
  UsersRound,
  Plus,
  Pencil,
  CalendarClock,
  Clock3,
  ExternalLink,
  Send,
  Save,
  ArrowLeft,
  Bell,
  Mail,
  XCircle,
} from "lucide-react";
import type { AssemblyEvent, Meeting, MeetingPublication, PanelProps } from "../domain/types";
import { can } from "../domain/rules";
import { reasonLabels } from "../domain/meetingMail";
import {
  meetingDraft,
  meetingLabels,
  meetingRecipients,
  meetingWhen,
  notificationEmail,
  safeMeetingUrl,
  validateMeeting,
} from "../domain/meetings";
import { dateLabel, timeLabel, fromLocalInput, toLocalInput, uid } from "../domain/format";
import { configured } from "../data/repository";
import { meetingRequest, meetingServiceUrl } from "../data/meetingApi";
import { Empty, ErrorMessage, Modal, Status } from "./UI";
import { useUnsavedChanges } from "./useUnsavedChanges";
import "../styles/meetings.css";

const meetingIcons = {
  zoom: Video,
  "in-person": MapPin,
  orientation: UsersRound,
};
export function MeetingCard({
  meeting,
  eventTimezone,
  departmentNames,
  onOpen,
  headingLevel = 2,
  compact = false,
  inProgress = false,
}: {
  meeting: Meeting | MeetingPublication;
  eventTimezone: string;
  departmentNames: string;
  onOpen?: () => void;
  headingLevel?: 2 | 3 | 4;
  compact?:boolean;
  inProgress?:boolean;
}) {
  const Icon = meetingIcons[meeting.kind],
    published = "version" in meeting,
    Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <article className="meeting-card">
      <div className="meeting-type-icon">
        <Icon size={28} aria-hidden="true" />
      </div>
      <div className="meeting-card-copy">
        <div className="meeting-card-heading">
          <Heading>{meeting.title}</Heading>
          {inProgress&&<Status kind="good">En curso</Status>}
          <Status
            kind={
              !published
                ? "draft"
                : meeting.status === "cancelled"
                  ? "draft"
                  : "good"
            }
          >
            {!published
              ? "Por confirmar"
              : meeting.status === "cancelled"
                ? "Cancelada"
                : "Confirmada"}
          </Status>
        </div>
        <p>{departmentNames}</p>
        <p className="meeting-when">
          <CalendarClock size={20} aria-hidden="true" />
          {compact&&meeting.startsAt?`${timeLabel(meeting.startsAt,eventTimezone)}${meeting.duration>0?' – '+timeLabel(new Date(Date.parse(meeting.startsAt)+meeting.duration*60000).toISOString(),eventTimezone):''}`:meetingWhen(meeting, eventTimezone)}
        </p>
        <p className="meeting-place">
          <MapPin size={18} aria-hidden="true" />
          {meeting.kind === "zoom"
            ? "Zoom"
            : meeting.location || "Lugar por confirmar"}
        </p>
        {published && (
          <div className="print-only small">
            <p>
              Versión {meeting.version} · Actualizada:{" "}
              {meetingWhen(
                { ...meeting, startsAt: meeting.publishedAt },
                eventTimezone,
              )}
            </p>
            <p>{meeting.kind === "zoom" ? zoomDetails(meeting) : meeting.address}</p>
            <p>{meeting.instructions}</p>
          </div>
        )}
        {onOpen && (
          <button className="btn no-print" onClick={onOpen}>
            Ver reunión
            <ExternalLink size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}
export function MeetingDetail({
  meeting,
  timezone,
  onClose,
  data,
  user,
  eventInfo,
  city,
  readOnly=false,
  connected=navigator.onLine,
  onOpenEvent,
}: {
  meeting: MeetingPublication;
  timezone: string;
  data?:PanelProps["data"];
  user?:PanelProps["user"];
  eventInfo?:AssemblyEvent;
  city?:string;
  readOnly?:boolean;
  connected?:boolean;
  onOpenEvent?:()=>void;
  onClose: () => void;
}) {
  const Icon = meetingIcons[meeting.kind];
  return (
    <Modal title={meeting.title} onClose={onClose}>
      <div className="stack">
        {eventInfo&&<div className="meeting-detail-event"><strong>{eventInfo.title}</strong><p>{dateLabel(eventInfo.startDate)}{city?` · ${city}`:''}</p>{onOpenEvent&&<button className="btn" onClick={onOpenEvent}><ExternalLink size={20} aria-hidden="true"/>Abrir asamblea</button>}</div>}
        <section className="meeting-summary stack" aria-label="Reunión">
        <Status kind={meeting.status === "cancelled" ? "draft" : "good"}>
          {meeting.status === "cancelled" ? "Cancelada" : "Confirmada"}
        </Status>
        <p className="meta-item">
          <Icon size={24} aria-hidden="true" />
          {meetingLabels[meeting.kind]}
        </p>
        <p className="meta-item">
          <CalendarClock size={24} aria-hidden="true" />
          {meetingWhen(meeting, timezone)}
        </p>
        {meeting.duration > 0 && (
          <p className="meta-item">
            <Clock3 size={22} aria-hidden="true" />
            {meeting.duration} minutos
          </p>
        )}
        {meeting.kind !== "zoom" && (
          <div>
            <strong>{meeting.location}</strong>
            <p>{meeting.address}</p>
          </div>
        )}
        {meeting.instructions && (
          <p className="meeting-instructions">{meeting.instructions}</p>
        )}
        {meeting.status === 'confirmed'&&meeting.kind==='zoom'&&<ZoomConnection meeting={meeting}/>}
        </section>
        <CalendarPanel kind="meeting" id={meeting.id} eventId={meeting.eventId} data={data} user={user} online={connected} readOnly={readOnly}/>
        <p className="small">
          Versión {meeting.version} ·{" "}
          {meetingWhen({ ...meeting, startsAt: meeting.publishedAt }, timezone)}
        </p>
      </div>
    </Modal>
  );
}
export function UpcomingMeetings({
  data,
  event,
  user,
  orientationDate,
  session,
}: {
  data: PanelProps["data"];
  event: PanelProps["event"];
  user: PanelProps["user"];
  orientationDate?: string;
  session?: "morning" | "afternoon";
}) {
  const [detail, setDetail] = useState<MeetingPublication>();
  const list = (data.meetingPublications || [])
    .filter(
      (m) =>
        m.eventId === event.id &&
        m.status === "confirmed" &&
        (orientationDate
          ? m.kind === "orientation" &&
            m.sessionDate === orientationDate &&
            m.session === session
          : m.recipientIds.includes(user.personId) &&
            Date.parse(m.startsAt) + (m.duration || 60) * 60000 > Date.now()),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (!list.length) return null;
  return (
    <section
      className="meeting-upcoming"
      aria-label={
        orientationDate ? "Orientación del turno" : "Próximas reuniones"
      }
    >
      {!orientationDate && (
        <h2>
          <CalendarClock size={24} aria-hidden="true" />
          Tus reuniones
        </h2>
      )}
      {list.map((m) => (
        <MeetingCard
          key={m.id}
          headingLevel={orientationDate ? 4 : 3}
          meeting={m}
          eventTimezone={event.timezone}
          departmentNames={m.departmentIds
            .map((id) => data.departments.find((d) => d.id === id)?.name)
            .filter(Boolean)
            .join(", ")}
          onOpen={() => setDetail(m)}
        />
      ))}
      {detail && (
        <MeetingDetail
          meeting={detail}
          data={data} user={user}
          timezone={event.timezone}
          onClose={() => setDetail(undefined)}
        />
      )}
    </section>
  );
}
export default function MeetingsPanel(props: PanelProps & {initialIntent?:HomeIntent;scheduleRows?:MeetingScheduleRow[];connected?:boolean;onOpenEvent?:(eventId:string)=>void}) {
  const { data, event, user, online } = props;
  const [editing, setEditing] = useState<Meeting>(),
    [detail, setDetail] = useState<MeetingPublication | undefined>(() =>
      (data.meetingPublications || []).find(
        (m) =>
          m.eventId === event.id &&
          m.id === new URLSearchParams(location.search).get("reunion"),
      ),
    ),
    [deliveries, setDeliveries] = useState<any[]>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [filter,setFilter]=useViewState('meetings.department',props.initialIntent?.departmentIds.length===1?props.initialIntent.departmentIds[0]:"",'departamento');
  const [savedScope,setScope]=useViewState<'event'|'all'>('meetings.scope','event','ambito');
  const [homeIntent,setHomeIntent]=useState(props.initialIntent);
  const connected=props.connected??navigator.onLine,scope=connected&&!homeIntent&&savedScope==='all'?'all':'event';
  const focusedIds=homeIntent?.filter?new Set(attentionIds(data,event.id,homeIntent)):null;
  const allowed = data.departments.filter(
    (d) =>
      can(user, data, "edit", event.id, d.id) ||
      can(user, data, "publish", event.id, d.id),
  );
  const overview=props.scheduleRows??meetingScheduleRows(data,user,{publishedOnly:!online,offlineEventId:!connected?event.id:undefined});
  const rows=overview.filter(row=>(scope==='all'||row.event.id===event.id)&&(!filter||row.meeting.departmentIds.includes(filter))&&(!homeIntent||row.meeting.departmentIds.some(id=>homeIntent.departmentIds.includes(id)))&&(!focusedIds||focusedIds.has(row.meeting.id)));
  const pubs=overview.filter(row=>row.event.id===event.id&&row.pub).map(row=>row.pub!);
  const detailRow=detail?overview.find(row=>row.event.id===detail.eventId&&row.meeting.id===detail.id):undefined;
  const departmentIds=new Set(overview.filter(row=>scope==='all'||row.event.id===event.id).flatMap(row=>row.meeting.departmentIds));
  const availableDepartments=data.departments.filter(d=>departmentIds.has(d.id)||can(user,data,'view',event.id,d.id));
  const openRow=(row:MeetingScheduleRow)=>{if(row.pub)setDetail(row.pub);else if(scope==='event'&&online)setEditing(meetingDraft(row.draft!));else props.onOpenEvent?.(row.event.id);};
  async function cancel(m: MeetingPublication) {
    if (
      !window.confirm(
        "¿Cancelar esta reunión y avisar a las personas convocadas?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await props.onMeetingCommand?.({
        action: "cancel",
        meetingId: m.id,
        eventId: m.eventId,
        expectedVersion: m.version,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const renderRow=(row:MeetingScheduleRow,now:number,printing=false)=>{
          const {draft,pub}=row;
          const m = row.meeting,
            editable =
              scope==='event'&&!printing&&online &&
              m.departmentIds.every(
                (d) =>
                  can(user, data, "edit", event.id, d) ||
                  can(user, data, "publish", event.id, d),
              );
          return (
            <div key={row.key} className={printing?"meeting-print-record":"meeting-record"}>
              {scope==='all'&&<div className="meeting-schedule-event"><CalendarClock size={19} aria-hidden="true"/><strong>{row.event.title}</strong><span>{row.venue?.city||''}</span></div>}
              <MeetingCard
                headingLevel={3}
                compact
                inProgress={meetingInProgress(m,now)}
                meeting={m}
                eventTimezone={event.timezone}
                departmentNames={m.departmentIds
                  .map((id) => data.departments.find((d) => d.id === id)?.name)
                  .join(", ")}
                onOpen={pub&&!printing ? () => setDetail(pub) : undefined}
              />
              {scope==='all'&&!printing&&props.onOpenEvent&&<div className="meeting-actions no-print"><button className="btn" onClick={()=>props.onOpenEvent?.(row.event.id)}><ExternalLink size={20} aria-hidden="true"/>Abrir asamblea</button></div>}
              {editable && (
                <div className="meeting-actions no-print">
                  <button
                    className="btn"
                    onClick={() => setEditing(meetingDraft(draft || m))}
                  >
                    <Pencil size={19} aria-hidden="true" />
                    Editar
                  </button>
                  {pub &&
                    m.departmentIds.every((d) =>
                      can(user, data, "publish", event.id, d),
                    ) && (
                      <>
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={async () => {
                            setError("");
                            try {
                              const result = configured
                                ? await meetingRequest<{ deliveries: any[] }>(
                                    `/deliveries?event=${encodeURIComponent(event.id)}&meeting=${encodeURIComponent(m.id)}`,
                                  )
                                : {
                                    deliveries: pub.recipientIds.map(
                                      (personId) => ({
                                        id: personId,
                                        personId,
                                        status: "pending",
                                        reason: "invitation",
                                        error:
                                          "Demostración: no se envían correos.",
                                      }),
                                    ),
                                  };
                              setDeliveries(result.deliveries);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          <Mail size={19} aria-hidden="true" />
                          Envíos
                        </button>
                        {pub.status === "confirmed" && (
                          <button
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => void cancel(pub)}
                          >
                            <XCircle size={19} aria-hidden="true" />
                            Cancelar reunión
                          </button>
                        )}
                      </>
                    )}
                  {pub &&
                    draft &&
                    JSON.stringify({ ...meetingDraft(pub), revision: 0 }) !==
                      JSON.stringify({
                        ...meetingDraft(draft),
                        revision: 0,
                      }) && (
                      <span className="small">Cambios sin confirmar</span>
                    )}
                </div>
              )}
            </div>
          );
  };
  return (
    <section>
      <HomeFocus intent={homeIntent} onClear={()=>setHomeIntent(undefined)}/>
      <div className="page-heading">
        <div>
          <h1>Reuniones</h1>
        </div>
        {scope==='event'&&online && allowed.length > 0 && (
          <button
            className="btn btn-primary"
            disabled={configured && !meetingServiceUrl}
            onClick={() =>
              setEditing({
                id: uid(),
                eventId: event.id,
                departmentIds: [allowed[0].id],
                kind: "zoom",
                title: meetingLabels.zoom,
                startsAt: "",
                duration: 0,
                location: "",
                address: "",
                zoomUrl: "",
                instructions: "",
                sessionDate: event.startDate,
                session: "morning",
                additionalPersonIds: [],
              })
            }
          >
            <Plus size={21} aria-hidden="true" />
            Añadir reunión
          </button>
        )}
      </div>
      <ErrorMessage message={error} />
      {configured && !meetingServiceUrl && (
        <div className="message info">
          El servicio de reuniones está pendiente de conectar.
        </div>
      )}
      <div className="meeting-schedule-filters no-print">
      <label className="field">Reuniones de<select aria-label="Reuniones de" value={scope} onChange={e=>{setHomeIntent(undefined);setScope(e.target.value as 'event'|'all');}}><option value="event">Esta asamblea</option><option value="all" disabled={!connected}>Todas las asambleas</option></select></label>
      <label className="field meeting-filter">
        Departamento
        <select aria-label="Departamento" value={filter} onChange={(e) => {setHomeIntent(undefined);setFilter(e.target.value);}}>
          <option value="">Todos los departamentos</option>
          {availableDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      </div>
      {scope==='all'&&<p className="meeting-schedule-context"><CalendarClock size={21} aria-hidden="true"/><strong>Todas las asambleas</strong><span>Hora: {event.timezone}</span><span className="small no-print">Solo consulta</span></p>}
      {!connected&&<p className="message info">Consulta guardada · {event.title}</p>}
      <MeetingSchedule rows={rows} timezone={event.timezone} fallbackDate={event.startDate} showEvent={scope==='all'} scopeKey={scope+':'+filter+':'+(homeIntent?.filter||'')} onOpen={openRow} renderRow={renderRow}/>
      {editing && (
        <MeetingForm
          {...props}
          initial={editing}
          published={pubs.find((m) => m.id === editing.id)}
          onClose={() => setEditing(undefined)}
        />
      )}
      {detail && (
        <MeetingDetail
          meeting={detail}
          data={data} user={user}
          eventInfo={detailRow?.event}
          city={detailRow?.venue?.city}
          connected={connected}
          readOnly={scope==='all'||!online}
          onOpenEvent={scope==='all'&&props.onOpenEvent?()=>props.onOpenEvent!(detail.eventId):undefined}
          timezone={event.timezone}
          onClose={() => setDetail(undefined)}
        />
      )}
      {deliveries && (
        <Modal
          title="Envíos de la reunión"
          onClose={() => setDeliveries(undefined)}
        >
          <ErrorMessage message={error} />
          <p className="small">
            Enviado significa aceptado por Gmail o verificado manualmente en
            Enviados.
          </p>
          <div className="meeting-deliveries">
            {deliveries.map((job) => (
              <article key={job.id}>
                <strong>
                  {data.persons.find((p) => p.id === job.personId)?.name ||
                    "Persona convocada"}
                </strong>
                <Status
                  kind={
                    job.status === "sent"
                      ? "good"
                      : ["error", "uncertain", "missing-email"].includes(
                            job.status,
                          )
                        ? "pending"
                        : "draft"
                  }
                >
                  {(
                    {
                      sent: "Enviado",
                      calendar:"Invitación de Calendar",declined:"Respondió No",
                      error: "Error",
                      uncertain: "Revisar envío",
                      "missing-email": "Sin correo",
                      obsolete: "Anulado",
                      pending: "Pendiente",
                      retry: "Pendiente",
                      sending: "Enviando",
                    } as Record<string, string>
                  )[job.status] || job.status}
                </Status>
                <p className="small">
                  {reasonLabels[job.reason as keyof typeof reasonLabels] ||
                    "Aviso"}{" "}
                  · Versión {job.version || 1}
                  {job.sender ? " · " + job.sender : ""}
                </p>
                {job.error && <p className="small">{job.error}</p>}
                {online &&
                  ["error", "uncertain", "missing-email"].includes(
                    job.status,
                  ) && (
                    <div className="button-row">
                      {(job.status === "uncertain"
                        ? ["sent", "retry"]
                        : ["retry"]
                      ).map((action) => (
                        <button
                          key={action}
                          className="btn"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                action === "sent"
                                  ? "¿Has comprobado que este correo aparece en Enviados?"
                                  : "Comprueba primero Enviados. ¿Confirmas que el correo no se envió y quieres reintentarlo?",
                              )
                            )
                              return;
                            setBusy(true);
                            setError("");
                            try {
                              await meetingRequest("/deliveries/review", {
                                id: job.id,
                                action,
                              });
                              setDeliveries(
                                deliveries.map((j) =>
                                  j.id === job.id
                                    ? {
                                        ...j,
                                        status:
                                          action === "sent"
                                            ? "sent"
                                            : "pending",
                                        error: "",
                                      }
                                    : j,
                                ),
                              );
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {action === "sent" ? "Ya enviado" : "Reintentar"}
                        </button>
                      ))}
                    </div>
                  )}
              </article>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}
function MeetingForm({
  initial,
  published,
  onClose,
  ...props
}: PanelProps & {
  initial: Meeting;
  published?: MeetingPublication;
  onClose: () => void;
}) {
  const { data, event, user, online } = props;
  const [form, setForm] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState<{
      names: string[];
      missing: number;
      missingNames?: string[];
      mailReady?: boolean;
      total: number;
    } | null>(null);
  const allowClose = useUnsavedChanges(
      JSON.stringify(form) !== JSON.stringify(initial),
      busy,
      onClose,
    ),
    close = () => {
      if (allowClose()) onClose();
    };
  const set = <K extends keyof Meeting>(key: K, value: Meeting[K]) => {
    setForm({ ...form, [key]: value });
    setReview(null);
  };
  const allowed = data.departments.filter(
    (d) =>
      can(user, data, "edit", event.id, d.id) ||
      can(user, data, "publish", event.id, d.id),
  );
  const editable = form.departmentIds.every((d) =>
      can(user, data, "edit", event.id, d),
    ),
    publishable = form.departmentIds.every((d) =>
      can(user, data, "publish", event.id, d),
    );
  const eligible = data.persons.filter((p) =>
    data.candidates.some(
      (c) =>
        c.personId === p.id &&
        c.eventId === event.id &&
        form.departmentIds.includes(c.departmentId) &&
        c.committee === "approved" &&
        c.availability === "accepted",
    ),
  );
  async function submit(action: "save" | "confirm") {
    if (busy || !online) return;
    setBusy(true);
    setError("");
    try {
      validateMeeting(form, action === "confirm");
      if (action === "confirm" && !review) {
        if (configured)
          setReview(
            await meetingRequest("/meetings/preview", {
              meeting: form,
              expectedVersion: published?.version || 0,
            }),
          );
        else {
          const ids = meetingRecipients(data, form);
          setReview({
            names: ids.map(
              (id) => data.persons.find((p) => p.id === id)?.name || id,
            ),
            missing: ids.filter(
              (id) =>
                !notificationEmail(data.persons.find((p) => p.id === id)!),
            ).length,
            missingNames: ids
              .filter(
                (id) =>
                  !notificationEmail(data.persons.find((p) => p.id === id)!),
              )
              .map((id) => data.persons.find((p) => p.id === id)?.name || id),
            total: ids.length,
          });
        }
        return;
      }
      if (!props.onMeetingCommand)
        throw new Error("El servicio de reuniones no está disponible.");
      await props.onMeetingCommand({
        action,
        meeting: form,
        expectedVersion: published?.version || 0,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        review
          ? "Revisar convocatoria"
          : published
            ? "Editar reunión"
            : "Preparar reunión"
      }
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(review ? "confirm" : "save");
        }}
      >
        <fieldset disabled={busy || !online} className="meeting-fields">
          <ErrorMessage message={error} />
          {review ? (
            <>
              <h3>{form.title}</h3>
              <p className="meeting-when">
                {meetingWhen(form, event.timezone)}
              </p>
              <div className="meeting-review-count">
                <UsersRound size={26} aria-hidden="true" />
                <strong>{review.total} personas convocadas</strong>
              </div>
              <details>
                <summary>Ver personas</summary>
                <ul>
                  {review.names.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </details>
              {review.missing > 0 && (
                <div className="message info">
                  <div>
                    <p>
                      {review.missing} personas sin correo. Su aviso quedará en
                      la aplicación.
                    </p>
                    {review.missingNames?.length ? (
                      <ul>
                        {review.missingNames.map((name, i) => (
                          <li key={i}>{name}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              )}
              {review.mailReady === false && (
                <div className="message info">
                  El correo esperará a que administración active el remitente.
                </div>
              )}
              <p className="meta-item">
                <Bell size={22} aria-hidden="true" />
                Víspera, 20:00 · Una hora antes
              </p>
              <p className="small">
                Se publicará la reunión y se prepararán los correos
                individuales.
              </p>
            </>
          ) : (
            <>
              <label className="field">
                Tipo
                <select
                  value={form.kind}
                  onChange={(e) => {
                    const kind = e.target.value as Meeting["kind"];
                    setForm({
                      ...form,
                      kind,
                      title: Object.values(meetingLabels).includes(form.title)
                        ? meetingLabels[kind]
                        : form.title,
                    });
                  }}
                >
                  {Object.entries(meetingLabels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Título
                <input
                  value={form.title}
                  maxLength={160}
                  required
                  onChange={(e) => set("title", e.target.value)}
                />
              </label>
              <fieldset className="meeting-departments">
                <legend>Departamentos</legend>
                {allowed.map((d) => (
                  <label className="check" key={d.id}>
                    <input
                      type="checkbox"
                      checked={form.departmentIds.includes(d.id)}
                      onChange={(e) =>
                        set(
                          "departmentIds",
                          e.target.checked
                            ? [...form.departmentIds, d.id]
                            : form.departmentIds.filter((id) => id !== d.id),
                        )
                      }
                    />
                    {d.name}
                  </label>
                ))}
              </fieldset>
              <div className="form-grid">
                <label className="field">
                  Fecha y hora
                  <input
                    type="datetime-local"
                    value={
                      form.startsAt
                        ? toLocalInput(form.startsAt, event.timezone)
                        : ""
                    }
                    onChange={(e) => {
                      try {
                        set(
                          "startsAt",
                          e.target.value
                            ? fromLocalInput(e.target.value, event.timezone)
                            : "",
                        );
                        setError("");
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  />
                  <small>Puede quedar por confirmar</small>
                </label>
                <label className="field">
                  Duración · minutos
                  <input
                    type="number"
                    min={0}
                    max={720}
                    value={form.duration || ""}
                    placeholder="Sin indicar"
                    onChange={(e) => set("duration", Number(e.target.value))}
                  />
                </label>
              </div>
              {form.kind === "zoom" ? (
                <><label className="field">
                  Enlace Zoom
                  <input
                    type="url"
                    inputMode="url"
                    value={form.zoomUrl}
                    maxLength={2000}
                    onChange={(e) => set("zoomUrl", e.target.value)}
                  />
                </label><label className="field">Número de reunión<input inputMode="numeric" value={form.zoomMeetingId||''} maxLength={30} onChange={e=>set("zoomMeetingId",e.target.value)}/></label><label className="field">Código de acceso<input value={form.zoomPasscode||''} maxLength={100} autoComplete="off" onChange={e=>set("zoomPasscode",e.target.value)}/></label></>
              ) : (
                <>
                  <label className="field">
                    Lugar / punto de encuentro
                    <input
                      value={form.location}
                      maxLength={200}
                      onChange={(e) => set("location", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Dirección
                    <input
                      value={form.address}
                      maxLength={300}
                      onChange={(e) => set("address", e.target.value)}
                    />
                  </label>
                </>
              )}
              {form.kind === "orientation" && (
                <>
                  <div className="form-grid">
                    <label className="field">
                      Día del turno
                      <input
                        type="date"
                        min={event.startDate}
                        max={event.endDate}
                        value={form.sessionDate}
                        onChange={(e) => set("sessionDate", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Equipo
                      <select
                        value={form.session}
                        onChange={(e) =>
                          set("session", e.target.value as Meeting["session"])
                        }
                      >
                        <option value="morning">Mañana</option>
                        <option value="afternoon">Tarde</option>
                      </select>
                    </label>
                  </div>
                  <details>
                    <summary>Añadir asistentes sin turno</summary>
                    {eligible.map((p) => (
                      <label className="check" key={p.id}>
                        <input
                          type="checkbox"
                          checked={form.additionalPersonIds.includes(p.id)}
                          onChange={(e) =>
                            set(
                              "additionalPersonIds",
                              e.target.checked
                                ? [...form.additionalPersonIds, p.id]
                                : form.additionalPersonIds.filter(
                                    (id) => id !== p.id,
                                  ),
                            )
                          }
                        />
                        {p.name}
                      </label>
                    ))}
                  </details>
                </>
              )}
              <label className="field">
                Indicaciones
                <textarea
                  rows={3}
                  value={form.instructions}
                  maxLength={3000}
                  onChange={(e) => set("instructions", e.target.value)}
                />
              </label>
            </>
          )}
          <div className="modal-actions">
            {review ? (
              <button
                type="button"
                className="btn"
                onClick={() => setReview(null)}
              >
                <ArrowLeft size={19} aria-hidden="true" />
                Volver
              </button>
            ) : (
              editable && (
                <button type="submit" className="btn">
                  <Save size={19} aria-hidden="true" />
                  Guardar borrador
                </button>
              )
            )}
            {publishable && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submit("confirm")}
              >
                <Send size={19} aria-hidden="true" />
                {busy
                  ? "Preparando…"
                  : review
                    ? published
                      ? "Guardar y avisar"
                      : "Confirmar y avisar"
                    : "Revisar convocatoria"}
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
