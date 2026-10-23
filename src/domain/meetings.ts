import type {
  AppData,
  AppUser,
  Meeting,
  MeetingCommand,
  MeetingPublication,
  Person,
} from "./types";
import { can } from "./rules";
import { dateLabel, fromLocalInput, timeLabel, toLocalInput } from "./format";

export const meetingLabels = {
  zoom: "Formación por Zoom",
  "in-person": "Formación presencial",
  orientation: "Orientación",
};
export const notificationEmail = (p: Person) =>
  (
    p.notificationEmail?.trim() ||
    p.gmail.trim() ||
    p.email.trim()
  ).toLowerCase();
export const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function safeMeetingUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function validateMeeting(m: Meeting, confirmed = false) {
  const allowed = [
    "id",
    "revision",
    "eventId",
    "departmentIds",
    "kind",
    "title",
    "startsAt",
    "duration",
    "location",
    "address",
    "zoomUrl",
    "instructions",
    "sessionDate",
    "session",
    "additionalPersonIds",
  ];
  if (Object.keys(m).some((k) => !allowed.includes(k)))
    throw new Error("La reunión contiene campos no admitidos.");
  for (const [key, max] of Object.entries({
    id: 120,
    eventId: 240,
    title: 160,
    startsAt: 24,
    location: 200,
    address: 300,
    zoomUrl: 2000,
    instructions: 3000,
    sessionDate: 10,
  })) {
    const value = m[key as keyof Meeting];
    if (typeof value !== "string" || value.length > max)
      throw new Error("Revisa los datos de la reunión.");
  }
  if (
    !/^[\w-]{1,120}$/.test(m.id) ||
    !m.eventId ||
    m.eventId.includes("/") ||
    !Object.hasOwn(meetingLabels, m.kind) ||
    !m.title.trim()
  )
    throw new Error("Completa el título y el tipo de reunión.");
  for (const [values, max] of [
    [m.departmentIds, 10],
    [m.additionalPersonIds, 100],
  ] as const)
    if (
      !Array.isArray(values) ||
      values.length > max ||
      values.some(
        (v) => typeof v !== "string" || !v || v.length > 240 || v.includes("/"),
      ) ||
      new Set(values).size !== values.length
    )
      throw new Error("Revisa los departamentos y las personas.");
  if (!m.departmentIds.length) throw new Error("Elige un departamento.");
  if (!Number.isInteger(m.duration) || m.duration < 0 || m.duration > 720)
    throw new Error("Duración no válida.");
  if (
    m.startsAt &&
    (!Number.isFinite(Date.parse(m.startsAt)) ||
      new Date(m.startsAt).toISOString() !== m.startsAt)
  )
    throw new Error("Revisa la fecha y hora.");
  if (m.zoomUrl && !safeMeetingUrl(m.zoomUrl))
    throw new Error("Usa un enlace HTTPS para Zoom.");
  if (!["morning", "afternoon"].includes(m.session))
    throw new Error("Elige mañana o tarde.");
  if (
    m.kind === "orientation" &&
    (!/^\d{4}-\d\d-\d\d$/.test(m.sessionDate) ||
      new Date(m.sessionDate + "T12:00Z").toISOString().slice(0, 10) !==
        m.sessionDate)
  )
    throw new Error("Elige el día del turno.");
  if (
    confirmed &&
    (!m.startsAt || (m.kind === "zoom" ? !m.zoomUrl : !m.location.trim()))
  )
    throw new Error(
      "Completa fecha, hora y lugar o enlace antes de confirmar.",
    );
}
export function publishedShifts(data: AppData, eventId: string) {
  return [
    ...new Set(
      data.publications
        .filter((p) => p.eventId === eventId)
        .map((p) => p.departmentId),
    ),
  ]
    .flatMap(
      (dep) =>
        data.publications
          .filter((p) => p.eventId === eventId && p.departmentId === dep)
          .sort((a, b) => b.version - a.version)[0].shifts,
    )
    .filter((s) => s.attendance !== "replaced");
}
/** Duties and invitations are independent of account permissions. */
export function meetingRecipients(data: AppData, m: Meeting): string[] {
  const zone =
    data.events.find((e) => e.id === m.eventId)?.timezone || "Europe/Madrid";
  const candidates = data.candidates.filter(
    (c) =>
      c.eventId === m.eventId &&
      m.departmentIds.includes(c.departmentId) &&
      c.committee === "approved" &&
      c.availability === "accepted",
  );
  const eligible = new Set(candidates.map((c) => c.personId));
  if (m.kind !== "orientation")
    return [
      ...new Set(
        candidates
          .filter((c) => c.teamRole !== "supervisor")
          .map((c) => c.personId),
      ),
    ].sort();
  const shifts = publishedShifts(data, m.eventId).filter(
    (s) =>
      m.departmentIds.includes(s.departmentId) &&
      toLocalInput(s.startsAt, zone).slice(0, 10) === m.sessionDate &&
      Number(toLocalInput(s.startsAt, zone).slice(11, 13)) >= 13 ===
        (m.session === "afternoon"),
  );
  return [
    ...new Set([
      ...shifts.flatMap((s) => [s.personId, ...s.substituteIds]),
      ...candidates
        .filter((c) => ["responsible", "assistant"].includes(c.teamRole || ""))
        .map((c) => c.personId),
      ...m.additionalPersonIds,
    ]),
  ]
    .filter((id) => eligible.has(id))
    .sort();
}
export function meetingReminders(startsAt: string, zone: string, now: string) {
  const day = toLocalInput(startsAt, zone).slice(0, 10);
  const previous = new Date(Date.parse(day + "T12:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
  return [
    {
      kind: "previous-day" as const,
      at: fromLocalInput(previous + "T20:00", zone),
    },
    {
      kind: "one-hour" as const,
      at: new Date(Date.parse(startsAt) - 3600000).toISOString(),
    },
  ].filter((r) => r.at > now);
}
export const meetingWhen = (m: Meeting, zone: string) =>
  m.startsAt
    ? `${dateLabel(m.startsAt, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: zone })} · ${timeLabel(m.startsAt, zone)}`
    : "Fecha por confirmar";
export function meetingDraft(m: Meeting): Meeting {
  const {
    id,
    revision,
    eventId,
    departmentIds,
    kind,
    title,
    startsAt,
    duration,
    location,
    address,
    zoomUrl,
    instructions,
    sessionDate,
    session,
    additionalPersonIds,
  } = m;
  return {
    id,
    ...(revision === undefined ? {} : { revision }),
    eventId,
    departmentIds,
    kind,
    title,
    startsAt,
    duration,
    location,
    address,
    zoomUrl,
    instructions,
    sessionDate,
    session,
    additionalPersonIds,
  };
}
/** Shared by the demo and the trusted server. Persistent jobs are server-only. */
export function applyMeetingCommand(
  data: AppData,
  user: AppUser,
  command: MeetingCommand,
  now = new Date().toISOString(),
): AppData {
  const id =
    command.action === "cancel" ? command.meetingId : command.meeting.id;
  const old = data.meetings.find((m) => m.id === id),
    published = data.meetingPublications.find((m) => m.id === id);
  if ((published?.version || 0) !== command.expectedVersion)
    throw new Error("La reunión ha cambiado. Recarga antes de guardar.");
  const m = command.action === "cancel" ? published : command.meeting;
  if (!m || !data.events.some((e) => e.id === m.eventId && !e.archived))
    throw new Error("Evento no disponible.");
  if (
    (old && old.eventId !== m.eventId) ||
    (published && published.eventId !== m.eventId)
  )
    throw new Error("No se puede cambiar el evento de una reunión.");
  const capability = command.action === "save" ? "edit" : "publish";
  if (
    [
      ...new Set([
        ...m.departmentIds,
        ...(old?.departmentIds || []),
        ...(published?.departmentIds || []),
      ]),
    ].some(
      (dep) =>
        !data.departments.some((d) => d.id === dep) ||
        !can(user, data, capability, m.eventId, dep),
    )
  )
    throw new Error(
      "No tienes permiso en todos los departamentos de esta reunión.",
    );
  if (command.action !== "cancel" && (old?.revision || 0) !== (m.revision || 0))
    throw new Error(
      "Otra persona ha cambiado el borrador. Recarga antes de guardar.",
    );
  const clean = meetingDraft(m);
  validateMeeting(clean, command.action !== "save");
  if (command.action === "confirm" && clean.startsAt <= now)
    throw new Error("Para convocar, elige una fecha futura.");
  if (command.action === "cancel" && published?.status === "cancelled")
    throw new Error("La reunión ya está cancelada.");
  const next = structuredClone(data);
  clean.revision = (old?.revision || 0) + 1;
  next.meetings = [...next.meetings.filter((row) => row.id !== id), clean];
  if (command.action !== "save") {
    const pub: MeetingPublication = {
      ...clean,
      version: (published?.version || 0) + 1,
      status: command.action === "cancel" ? "cancelled" : "confirmed",
      publishedAt: now,
      publishedBy: user.name,
      recipientIds:
        command.action === "cancel"
          ? published!.recipientIds
          : meetingRecipients(data, clean),
    };
    next.meetingPublications = [
      ...next.meetingPublications.filter((row) => row.id !== id),
      pub,
    ];
  }
  return next;
}
