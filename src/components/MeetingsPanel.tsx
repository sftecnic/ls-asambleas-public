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
import type { Meeting, MeetingPublication, PanelProps } from "../domain/types";
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
import { fromLocalInput, toLocalInput, uid } from "../domain/format";
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
}: {
  meeting: Meeting | MeetingPublication;
  eventTimezone: string;
  departmentNames: string;
  onOpen?: () => void;
  headingLevel?: 2 | 3 | 4;
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
          {meetingWhen(meeting, eventTimezone)}
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
            <p>{meeting.kind === "zoom" ? meeting.zoomUrl : meeting.address}</p>
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
}: {
  meeting: MeetingPublication;
  timezone: string;
  onClose: () => void;
}) {
  const Icon = meetingIcons[meeting.kind];
  return (
    <Modal title={meeting.title} onClose={onClose}>
      <div className="stack">
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
        {meeting.status === "confirmed" &&
          meeting.kind === "zoom" &&
          safeMeetingUrl(meeting.zoomUrl) && (
            <a
              className="btn btn-primary"
              href={meeting.zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Video size={22} aria-hidden="true" />
              Entrar en Zoom
            </a>
          )}
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
          timezone={event.timezone}
          onClose={() => setDetail(undefined)}
        />
      )}
    </section>
  );
}
export default function MeetingsPanel(props: PanelProps & {initialIntent?:HomeIntent}) {
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
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState(props.initialIntent?.departmentIds.length===1?props.initialIntent.departmentIds[0]:"");
  const [homeIntent,setHomeIntent]=useState(props.initialIntent);
  const focusedIds=homeIntent?.filter?new Set(attentionIds(data,event.id,homeIntent)):null;
  const allowed = data.departments.filter(
    (d) =>
      can(user, data, "edit", event.id, d.id) ||
      can(user, data, "publish", event.id, d.id),
  );
  const pubs = (data.meetingPublications || []).filter(
      (m) => m.eventId === event.id,
    ),
    drafts = (data.meetings || []).filter((m) => m.eventId === event.id);
  const ids = [...new Set([...pubs, ...drafts].map((m) => m.id))];
  const rows = ids
    .map((id) => ({
      draft: drafts.find((m) => m.id === id),
      pub: pubs.find((m) => m.id === id),
    }))
    .filter(
      ({ draft, pub }) =>
        (!filter || (draft || pub)!.departmentIds.includes(filter))&&(!homeIntent||(draft||pub)!.departmentIds.some(id=>homeIntent.departmentIds.includes(id)))&&(!focusedIds||focusedIds.has((draft||pub)!.id)),
    )
    .sort((a, b) =>
      ((a.pub || a.draft)!.startsAt || "9999").localeCompare(
        (b.pub || b.draft)!.startsAt || "9999",
      ),
    );
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
  return (
    <section>
      <HomeFocus intent={homeIntent} onClear={()=>setHomeIntent(undefined)}/>
      <div className="page-heading">
        <div>
          <h1>Reuniones</h1>
        </div>
        {online && allowed.length > 0 && (
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
      <label className="field meeting-filter no-print">
        Departamento
        <select value={filter} onChange={(e) => {setHomeIntent(undefined);setFilter(e.target.value);}}>
          <option value="">Todos los departamentos</option>
          {data.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="meeting-list">
        {rows.map(({ draft, pub }) => {
          const m = pub || draft!,
            editable =
              online &&
              m.departmentIds.every(
                (d) =>
                  can(user, data, "edit", event.id, d) ||
                  can(user, data, "publish", event.id, d),
              );
          return (
            <div key={m.id} className="meeting-record">
              <MeetingCard
                meeting={m}
                eventTimezone={event.timezone}
                departmentNames={m.departmentIds
                  .map((id) => data.departments.find((d) => d.id === id)?.name)
                  .join(", ")}
                onOpen={pub ? () => setDetail(pub) : undefined}
              />
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
        })}
      </div>
      {!rows.length && (
        <Empty>
          Aún no hay reuniones{filter ? " en este departamento" : ""}.
        </Empty>
      )}
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
                <label className="field">
                  Enlace Zoom
                  <input
                    type="url"
                    inputMode="url"
                    value={form.zoomUrl}
                    maxLength={2000}
                    onChange={(e) => set("zoomUrl", e.target.value)}
                  />
                </label>
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
