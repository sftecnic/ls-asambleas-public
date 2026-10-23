import type {
  AppData,
  AppUser,
  Meeting,
  MeetingPublication,
  Shift,
} from "./types";
import { can } from "./rules";
import { matchesTeamFilter, publicationTeam, teamRole, teamView } from "./team";
import { meetingDraft } from "./meetings";

export type HomeFilter =
  | "absent"
  | "committee"
  | "availability"
  | "meeting-draft"
  | "shift-draft"
  | "material";
export interface HomeIntent {
  departmentIds: string[];
  filter?: HomeFilter;
  label: string;
}
export const homeFilterLabels: Record<HomeFilter, string> = {
  absent: "Ausencias sin sustitución",
  committee: "Aprobación del comité",
  availability: "Disponibilidad",
  "meeting-draft": "Reuniones por confirmar",
  "shift-draft": "Turnos por publicar",
  material: "Material pendiente",
};
const compareText = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
}).compare;

export function latestPublications(data: AppData, eventId: string) {
  const rows = data.publications.filter((p) => p.eventId === eventId);
  return [...new Set(rows.map((p) => p.departmentId))].flatMap((id) =>
    rows
      .filter((p) => p.departmentId === id)
      .sort((a, b) => b.version - a.version)
      .slice(0, 1),
  );
}
export function homeDepartments(
  data: AppData,
  user: AppUser,
  eventId: string,
  readOnly = false,
) {
  const publishedIds = new Set([
    ...latestPublications(data, eventId).map((p) => p.departmentId),
    ...data.meetingPublications
      .filter((m) => m.eventId === eventId)
      .flatMap((m) => m.departmentIds),
  ]);
  const allowed = data.departments
    .filter((d) =>
      readOnly
        ? publishedIds.has(d.id)
        : can(user, data, "view", eventId, d.id),
    )
    .sort((a, b) => compareText(a.name, b.name));
  const ownIds = new Set([
    ...data.candidates
      .filter(
        (c) =>
          c.eventId === eventId &&
          c.personId === user.personId &&
          c.committee !== "denied" &&
          c.availability !== "declined",
      )
      .map((c) => c.departmentId),
    ...data.shifts
      .filter(
        (s) =>
          s.eventId === eventId &&
          s.attendance !== "replaced" &&
          (s.personId === user.personId ||
            s.substituteIds.includes(user.personId)),
      )
      .map((s) => s.departmentId),
    ...latestPublications(data, eventId)
      .filter((p) =>
        publicationTeam(p).some((m) => m.personId === user.personId),
      )
      .map((p) => p.departmentId),
  ]);
  return { allowed, own: allowed.filter((d) => ownIds.has(d.id)) };
}
export function resolveHomeScope(
  value: string | null,
  allowed: string[],
  own: string[],
) {
  if (
    value === "all" ||
    (value === "mine" && own.length) ||
    (value && allowed.includes(value))
  )
    return value!;
  return own.length ? "mine" : "all";
}
export function pendingMeeting(meeting: Meeting, pub?: MeetingPublication) {
  if (!pub) return true;
  // Publication metadata and recipient changes do not make a new draft.
  const draft = meetingDraft(meeting),
    confirmed = meetingDraft(pub);
  return Object.keys(draft).some(
    (key) =>
      key !== "revision" &&
      JSON.stringify(draft[key as keyof Meeting]) !==
        JSON.stringify(confirmed[key as keyof Meeting]),
  );
}
export function attentionIds(
  data: AppData,
  eventId: string,
  intent: HomeIntent,
  now = Date.now(),
): string[] {
  const inScope = (id: string) => intent.departmentIds.includes(id);
  switch (intent.filter) {
    case "committee":
    case "availability":
      return data.candidates
        .filter(
          (c) =>
            c.eventId === eventId &&
            inScope(c.departmentId) &&
            teamRole(c) !== "supervisor" &&
            matchesTeamFilter(c, intent.filter as "committee" | "availability"),
        )
        .map((c) => c.id);
    case "absent":
      return data.shifts
        .filter(
          (s) =>
            s.eventId === eventId &&
            inScope(s.departmentId) &&
            s.attendance === "absent" &&
            Date.parse(s.endsAt) > now &&
            !data.shifts.some(
              (replacement) =>
                replacement.eventId === eventId &&
                replacement.replacementFor === s.id &&
                replacement.attendance !== "replaced" &&
                replacement.attendance !== "absent",
            ),
        )
        .map((s) => s.id);
    case "shift-draft":
      return data.shifts
        .filter(
          (s) =>
            s.eventId === eventId &&
            inScope(s.departmentId) &&
            s.status === "draft" &&
            s.attendance !== "replaced",
        )
        .map((s) => s.id);
    case "meeting-draft":
      return data.meetings
        .filter(
          (m) =>
            m.eventId === eventId &&
            m.departmentIds.some(inScope) &&
            pendingMeeting(
              m,
              data.meetingPublications.find(
                (p) => p.id === m.id && p.eventId === eventId,
              ),
            ),
        )
        .map((m) => m.id);
    case "material":
      return data.program
        .filter(
          (p) =>
            p.eventId === eventId &&
            p.kind !== "break" &&
            p.material !== "reviewed",
        )
        .map((p) => p.id);
    default:
      return [];
  }
}
export function homeAttention(
  data: AppData,
  eventId: string,
  departmentIds: string[],
  now = Date.now(),
) {
  return (
    [
      "absent",
      "committee",
      "availability",
      "meeting-draft",
      "shift-draft",
    ] as const
  )
    .map((filter) => {
      const intent: HomeIntent = {
          departmentIds,
          filter,
          label: homeFilterLabels[filter],
        },
        ids = attentionIds(data, eventId, intent, now);
      const count =
        filter === "committee" || filter === "availability"
          ? new Set(
              data.candidates
                .filter((c) => ids.includes(c.id))
                .map((c) => c.personId),
            ).size
          : ids.length;
      return {
        intent,
        count,
        page:
          filter === "committee" || filter === "availability"
            ? "team"
            : filter === "meeting-draft"
              ? "meetings"
              : "shifts",
      };
    })
    .filter((row) => row.count > 0);
}
export type PersonalActivity =
  | { kind: "shift"; item: Shift; startsAt: string; endsAt: string }
  | {
      kind: "meeting";
      item: MeetingPublication;
      startsAt: string;
      endsAt: string;
    };
export function personalActivities(
  data: AppData,
  user: AppUser,
  eventId: string,
  now = Date.now(),
): PersonalActivity[] {
  const shifts = latestPublications(data, eventId)
    .flatMap((p) => p.shifts)
    .map((s) => ({
      ...s,
      attendance:
        data.shifts.find((live) => live.id === s.id && live.eventId === eventId)
          ?.attendance ?? s.attendance,
    }));
  const rows: PersonalActivity[] = [
    ...shifts
      .filter(
        (s) =>
          s.status === "published" &&
          (s.personId === user.personId ||
            s.substituteIds.includes(user.personId)) &&
          !["absent", "replaced"].includes(s.attendance),
      )
      .map((item) => ({
        kind: "shift" as const,
        item,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
      })),
    ...data.meetingPublications
      .filter(
        (m) =>
          m.eventId === eventId &&
          m.status === "confirmed" &&
          m.recipientIds.includes(user.personId),
      )
      .map((item) => ({
        kind: "meeting" as const,
        item,
        startsAt: item.startsAt,
        endsAt: new Date(
          Date.parse(item.startsAt) + (item.duration || 60) * 60000,
        ).toISOString(),
      })),
  ];
  return rows
    .filter((r) => Date.parse(r.endsAt) > now)
    .sort(
      (a, b) =>
        Number(Date.parse(b.startsAt) <= now) -
          Number(Date.parse(a.startsAt) <= now) ||
        a.startsAt.localeCompare(b.startsAt) ||
        a.item.id.localeCompare(b.item.id),
    );
}
export function departmentSummary(
  data: AppData,
  eventId: string,
  departmentId: string,
  readOnly = false,
) {
  const publication = latestPublications(data, eventId).find(
    (p) => p.departmentId === departmentId,
  );
  const team = readOnly
    ? publication
      ? publicationTeam(publication)
      : []
    : data.candidates
        .filter((c) => c.eventId === eventId && c.departmentId === departmentId)
        .map((c) => ({
          personId: c.personId,
          name:
            data.persons.find((p) => p.id === c.personId)?.name ||
            "Persona no disponible",
          role: teamRole(c),
        }));
  const names = (role: "responsible" | "assistant") =>
    [
      ...new Map(
        team.filter((m) => m.role === role).map((m) => [m.personId, m.name]),
      ).values(),
    ].sort(compareText);
  const counts = readOnly ? null : teamView(data, eventId, departmentId).counts;
  return {
    responsible: names("responsible"),
    assistants: names("assistant"),
    publication,
    counts,
  };
}

const scopePrefix = "ls-asambleas:home-scope:";
export const scopeKey = (uid: string, eventId: string) =>
  `${scopePrefix}${encodeURIComponent(uid)}:${encodeURIComponent(eventId)}`;
export function clearHomeScopes(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, i) =>
    storage.key(i),
  ).filter((key): key is string => !!key && key.startsWith(scopePrefix));
  keys.forEach((key) => storage.removeItem(key));
}
