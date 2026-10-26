import { useEffect, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileCheck2,
  MapPin,
  Presentation,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import type { PanelProps, Shift, MeetingPublication } from "../domain/types";
import { dateLabel, timeLabel } from "../domain/format";
import { can } from "../domain/rules";
import {
  attentionIds,
  departmentSummary,
  homeAttention,
  homeDepartments,
  personalActivities,
  resolveHomeScope,
  scopeKey,
  type HomeIntent,
} from "../domain/homeDashboard";
import { meetingLabels, safeMeetingUrl } from "../domain/meetings";
import { DepartmentIcon, Modal, Status } from "./UI";
import { AttendanceSummary } from "./AttendanceControl";
import { ShiftPost } from "./ShiftPost";
import { MeetingDetail } from "./MeetingsPanel";
import "../styles/home.css";
import {TourLinks,TourButton} from './DepartmentTours';

type Props = PanelProps & {
  readOnly: boolean;
  navigate: (page: string, intent?: HomeIntent) => void;
};
const attentionIcons = {
  absent: TriangleAlert,
  committee: ShieldCheck,
  availability: UserCheck,
  "meeting-draft": CalendarClock,
  "shift-draft": Send,
  material: FileCheck2,
};
export default function HomePanel({
  data,
  event,
  user,
  navigate,
  readOnly,
}: Props) {
  const [now, setNow] = useState(Date.now);
  const [shiftDetail, setShiftDetail] = useState<Shift>();
  const [meetingDetail, setMeetingDetail] = useState<MeetingPublication>();
  const volunteer = user.role === "volunteer";
  const departments = homeDepartments(data, user, event.id, readOnly);
  const [choice, setChoice] = useState(() => {
    try {
      return sessionStorage.getItem(scopeKey(user.uid, event.id));
    } catch {
      return null;
    }
  });
  const scope = resolveHomeScope(
    choice,
    departments.allowed.map((d) => d.id),
    departments.own.map((d) => d.id),
  );
  const selected =
    scope === "all"
      ? departments.allowed
      : scope === "mine"
        ? departments.own
        : departments.allowed.filter((d) => d.id === scope);
  const attention = readOnly
    ? []
    : homeAttention(
        data,
        event.id,
        selected.map((d) => d.id),
        now,
      );
  const activities = personalActivities(data, user, event.id, now);
  const [showAll, setShowAll] = useState(false);
  const venue = data.venues.find((v) => v.id === event.venueId);
  const materialIntent: HomeIntent = {
    departmentIds: [],
    filter: "material",
    label: "Material pendiente del programa",
  };
  const canManageProgram =
    !readOnly && can(user, data, "edit", event.id, "platform");
  const materialCount = canManageProgram
    ? attentionIds(data, event.id, materialIntent).length
    : 0;
  const detailDepartment = data.departments.find(
    (d) => d.id === shiftDetail?.departmentId,
  );
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  function choose(value: string) {
    setChoice(value);
    try {
      sessionStorage.setItem(scopeKey(user.uid, event.id), value);
    } catch {
      /* Session preferences are optional. */
    }
  }
  function openDepartment(page: string, id: string, name: string) {
    navigate(page, { departmentIds: [id], label: name });
  }
  return (
    <div className="home-dashboard">
      <header className="page-heading home-heading">
        <div>
          <h1>{volunteer ? "Mis turnos" : "Inicio"}</h1>
          {volunteer&&<p>Hola, {user.name.split(" ")[0]}</p>}
        </div>
        {!volunteer && departments.allowed.length > 0 && (
          <label className="field home-scope">
            Ver
            <select
              name="home-scope"
              aria-label="Ámbito de Inicio"
              autoComplete="off"
              value={scope}
              onChange={(e) => choose(e.target.value)}
            >
              {departments.own.length > 0 && (
                <option value="mine">
                  {departments.own.length === 1
                    ? `Mi departamento · ${departments.own[0].name}`
                    : "Mis departamentos"}
                </option>
              )}
              <option value="all">Toda la asamblea</option>
              {departments.allowed.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {!volunteer && !readOnly && (
        <section
          className="home-attention"
          aria-labelledby="home-attention-title"
        >
          <h2 id="home-attention-title">
            <ClipboardList size={24} aria-hidden="true" />
            Requiere atención
          </h2>
          {attention.length ? (
            <div className="home-action-list">
              {attention.map(({ intent, count, page }) => {
                const Icon = attentionIcons[intent.filter!];
                return (
                  <button
                    className={`home-action ${intent.filter === "absent" ? "home-action-urgent" : ""}`}
                    key={intent.filter}
                    onClick={() => navigate(page, intent)}
                  >
                    <Icon size={24} aria-hidden="true" />
                    <span>{intent.label}</span>
                    <strong>{count}</strong>
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="home-clear">
              <Check size={22} aria-hidden="true" />
              Sin pendientes registrados
            </p>
          )}
        </section>
      )}
      <section className="home-personal" aria-labelledby="home-personal-title">
        <h2 id="home-personal-title">
          <CalendarClock size={24} aria-hidden="true" />
          Lo próximo para ti
        </h2>
        <div className="home-agenda">
          {(showAll ? activities : activities.slice(0, 3)).map((activity) => {
            const shift = activity.kind === "shift" ? activity.item : undefined;
            const meeting =
              activity.kind === "meeting" ? activity.item : undefined;
            const department = shift
              ? data.departments.find((d) => d.id === shift.departmentId)
              : undefined;
            return (
              <article
                className="home-activity"
                key={`${activity.kind}-${activity.item.id}`}
              >
                <div className="home-activity-time">
                  <time dateTime={activity.startsAt}>
                    {dateLabel(activity.startsAt, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: event.timezone,
                    })}
                  </time>
                  <strong>
                    {timeLabel(activity.startsAt, event.timezone)}
                    {shift
                      ? ` – ${timeLabel(activity.endsAt, event.timezone)}`
                      : ""}
                  </strong>
                  {Date.parse(activity.startsAt) <= now && (
                    <Status kind="good">En curso</Status>
                  )}
                </div>
                <div className="home-activity-body">
                  <div className="home-activity-title">
                    <h3>
                      {shift ? (
                        <ShiftPost
                          departmentId={shift.departmentId}
                          department={department}
                          role={shift.role}
                        />
                      ) : (
                        meeting!.title
                      )}
                    </h3>
                    <Status kind="good">
                      {shift ? "Publicado" : "Confirmada"}
                    </Status>
                  </div>
                  <p className="small">
                    {shift
                      ? `${department?.name || "Departamento"} · ${shift.personId === user.personId ? "Titular" : "Suplente"}`
                      : `${meetingLabels[meeting!.kind]} · ${meeting!.departmentIds
                          .map(
                            (id) =>
                              data.departments.find((d) => d.id === id)?.name,
                          )
                          .filter(Boolean)
                          .join(", ")}`}
                  </p>
                  <p className="home-place">
                    <MapPin size={18} aria-hidden="true" />
                    {shift
                      ? shift.meetingPoint ||
                        venue?.name ||
                        "Encuentro sin indicar"
                      : meeting!.kind === "zoom"
                        ? "Zoom"
                        : meeting!.location || venue?.name}
                  </p>
                  <div>
                    {shift && <AttendanceSummary value={shift.attendance} />}
                  </div>
                  <div className="button-row no-print">
                    {shift ? (
                      <button
                        className="btn"
                        onClick={() => setShiftDetail(shift)}
                      >
                        <ClipboardList size={19} aria-hidden="true" />
                        Instrucciones
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn"
                          onClick={() => setMeetingDetail(meeting)}
                        >
                          <CalendarClock size={19} aria-hidden="true" />
                          Ver reunión
                        </button>
                        {meeting!.kind === "zoom" &&
                          safeMeetingUrl(meeting!.zoomUrl) && (
                            <a
                              className="btn btn-primary"
                              href={meeting!.zoomUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Video size={20} aria-hidden="true" />
                              Entrar en Zoom
                            </a>
                          )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!activities.length && (
          <p className="home-empty">
            No tienes reuniones ni turnos publicados pendientes en este evento.
          </p>
        )}
        {activities.length > 3 && (
          <button
            className="btn no-print home-show-all"
            aria-expanded={showAll}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Ver próximos tres" : "Ver todos mis compromisos"}
          </button>
        )}
      </section>
      {!volunteer && (
        <section className="home-teams" aria-labelledby="home-team-title">
          <h2 id="home-team-title">
            <Users size={24} aria-hidden="true" />
            {scope === "all"
              ? "Departamentos"
              : scope === "mine"
                ? selected.length === 1
                  ? "Tu departamento"
                  : "Tus departamentos"
                : "Departamento"}
          </h2>
          <div className="home-department-list">
            {selected.map((department) => {
              const summary = departmentSummary(
                data,
                event.id,
                department.id,
                readOnly,
              );
              return (
                <article
                  className="home-department"
                  key={department.id}
                  aria-label={department.name}
                >
                  <h3>
                    <DepartmentIcon department={department} size={24} />
                    {department.name}
                  </h3>
                  <dl className="home-leadership">
                    <div>
                      <dt>Responsable</dt>
                      <dd>{summary.responsible.join(", ") || "Sin indicar"}</dd>
                    </div>
                    <div>
                      <dt>Auxiliares</dt>
                      <dd>{summary.assistants.join(", ") || "Sin indicar"}</dd>
                    </div>
                  </dl>
                  {summary.counts && (
                    <div className="home-team-counts">
                      <span>
                        <UserCheck size={18} aria-hidden="true" />
                        <strong>{summary.counts.ready}</strong>{" "}
                        {summary.counts.ready === 1
                          ? "persona aceptada"
                          : "personas aceptadas"}
                      </span>
                      <span>
                        <Users size={18} aria-hidden="true" />
                        <strong>{summary.counts.reserve}</strong>{" "}
                        {summary.counts.reserve === 1 ? "reserva" : "reservas"}
                      </span>
                    </div>
                  )}
                  <p className="small home-publication">
                    {summary.publication
                      ? `Turnos · Versión ${summary.publication.version} · ${dateLabel(summary.publication.publishedAt, { day: "numeric", month: "long", year: "numeric", timeZone: event.timezone })} ${timeLabel(summary.publication.publishedAt, event.timezone)}`
                      : "Turnos sin publicar"}
                  </p>
                  <div className="button-row no-print">
                    {!readOnly && (
                      <button
                        className="btn"
                        onClick={() =>
                          openDepartment("team", department.id, department.name)
                        }
                      >
                        <Users size={18} aria-hidden="true" />
                        Equipo
                      </button>
                    )}
                    <button
                      className="btn"
                      onClick={() =>
                        openDepartment("shifts", department.id, department.name)
                      }
                    >
                      <CalendarCheck size={18} aria-hidden="true" />
                      Turnos
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        openDepartment(
                          "meetings",
                          department.id,
                          department.name,
                        )
                      }
                    >
                      <CalendarClock size={18} aria-hidden="true" />
                      Reuniones
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {!selected.length && (
            <p className="home-empty">
              {readOnly
                ? "Todavía no hay departamentos publicados para consultar."
                : "No hay departamentos disponibles en este evento."}
            </p>
          )}
        </section>
      )}
      <TourLinks data={data} departmentIds={volunteer?undefined:selected.map(d=>d.id)}/>
      <section className="home-program" aria-label="Programa común">
        <div>
          <h2>
            <Presentation size={24} aria-hidden="true" />
            Programa común
          </h2>
          {canManageProgram && (
            <p className="small">
              {materialCount
                ? `${materialCount} ${materialCount === 1 ? "intervención" : "intervenciones"} con material pendiente`
                : "Sin material pendiente registrado"}
            </p>
          )}
        </div>
        <div className="button-row no-print">
          {materialCount > 0 && (
            <button
              className="btn"
              onClick={() => navigate("program", materialIntent)}
            >
              <FileCheck2 size={19} aria-hidden="true" />
              Revisar material
            </button>
          )}
          <button className="btn" onClick={() => navigate("program")}>
            Ver programa
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>
      </section>
      {meetingDetail && (
        <MeetingDetail
          meeting={meetingDetail}
          timezone={event.timezone}
          onClose={() => setMeetingDetail(undefined)}
        />
      )}
      {shiftDetail && (
        <Modal title="Instrucciones" onClose={() => setShiftDetail(undefined)}>
          <div className="stack">
            <h3>
              <ShiftPost
                departmentId={shiftDetail.departmentId}
                department={detailDepartment}
                role={shiftDetail.role}
              />
            </h3>
            <p>
              {shiftDetail.personId === user.personId ? "Titular" : "Suplente"}
            </p>
            <p className="meta-item">
              <Clock3 size={22} aria-hidden="true" />
              {dateLabel(shiftDetail.startsAt, {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: event.timezone,
              })}{" "}
              · {timeLabel(shiftDetail.startsAt, event.timezone)} –{" "}
              {timeLabel(shiftDetail.endsAt, event.timezone)}
            </p>
            <p className="meta-item">
              <MapPin size={22} aria-hidden="true" />
              {shiftDetail.meetingPoint || venue?.name}
            </p>
            <p className="home-instructions">
              {detailDepartment?.instructions ||
                "Consulta el programa y el plano de las intervenciones de tu turno."}
            </p>
            <TourButton departmentId={shiftDetail.departmentId} beforeOpen={()=>setShiftDetail(undefined)}/>
            {detailDepartment?.trainingUrl && (
              <a
                className="btn"
                href={detailDepartment.trainingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={20} aria-hidden="true" />
                Abrir formación
              </a>
            )}
            <button
              className="btn btn-primary"
              onClick={() => {
                setShiftDetail(undefined);
                navigate("program");
              }}
            >
              <Presentation size={20} aria-hidden="true" />
              Ver programa
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
