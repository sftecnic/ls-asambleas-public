import { describe, it, expect } from "vitest";
import { createDemoData } from "../seed";
import { publishedData } from "./publication";
import {
  attentionIds,
  clearHomeScopes,
  departmentSummary,
  homeAttention,
  homeDepartments,
  personalActivities,
  pendingMeeting,
  resolveHomeScope,
  scopeKey,
} from "./homeDashboard";
import type { AppUser, Meeting, MeetingPublication } from "./types";
const user: AppUser = {
  uid: "demo-admin",
  email: "admin@example.test",
  personId: "p-admin",
  name: "Elena Vidal",
  role: "admin",
};
const now = Date.parse("2027-04-10T08:30:00Z");
const meeting: Meeting = {
  id: "m1",
  eventId: "e1",
  departmentIds: ["makeup"],
  kind: "zoom",
  title: "Formación",
  startsAt: "2027-04-10T09:00:00.000Z",
  duration: 60,
  location: "",
  address: "",
  zoomUrl: "https://zoom.us/j/123",
  instructions: "",
  sessionDate: "2027-04-10",
  session: "morning",
  additionalPersonIds: [],
};
const publication: MeetingPublication = {
  ...meeting,
  version: 1,
  status: "confirmed",
  publishedAt: "2027-03-01T12:00:00Z",
  publishedBy: "Elena",
  recipientIds: ["p-admin"],
};
describe("inicio por ámbito y compromisos", () => {
  it("prioriza la participación del auxiliar aunque tenga administración y respeta permisos", () => {
    const data = createDemoData();
    data.candidates.push({
      ...data.candidates[0],
      id: "own",
      personId: user.personId,
      teamRole: "assistant",
    });
    expect(homeDepartments(data, user, "e1").own.map((d) => d.id)).toEqual([
      "video",
    ]);
    expect(resolveHomeScope(null, ["video", "makeup"], ["video"])).toBe("mine");
    data.grants = [];
    expect(homeDepartments(data, user, "e1").allowed).toEqual([]);
    expect(resolveHomeScope("makeup", ["video"], ["video"])).toBe("mine");
  });
  it("admite varios departamentos, nuevos departamentos y otro evento sin pertenencia", () => {
    const data = createDemoData();
    data.departments.push({ id: "new", name: "Acogida", icon: "other" });
    data.candidates.push(
      ...["new", "video"].map((departmentId) => ({
        ...data.candidates[0],
        id: departmentId,
        departmentId,
        personId: user.personId,
      })),
    );
    expect(homeDepartments(data, user, "e1").own.map((d) => d.id)).toEqual([
      "new",
      "video",
    ]);
    expect(
      resolveHomeScope(
        null,
        homeDepartments(data, user, "e2").allowed.map((d) => d.id),
        [],
      ),
    ).toBe("all");
  });
  it("cuenta personas únicas y excluye supervisores", () => {
    const data = createDemoData();
    data.candidates.push(
      { ...data.candidates[1], id: "duplicate", departmentId: "platform" },
      {
        ...data.candidates[1],
        id: "supervisor",
        personId: "supervisor",
        teamRole: "supervisor",
      },
    );
    const rows = homeAttention(data, "e1", ["video", "platform"], now);
    expect(rows.find((r) => r.intent.filter === "committee")?.count).toBe(1);
    expect(
      attentionIds(data, "e1", {
        departmentIds: ["video"],
        filter: "committee",
        label: "",
      }),
    ).toEqual(["ca2"]);
  });
  it("solo avisa de ausencias actuales o futuras sin sustitución efectiva", () => {
    const data = createDemoData(),
      base = data.shifts[0];
    data.shifts = [{ ...base, attendance: "absent" }];
    const intent = {
      departmentIds: ["video"],
      filter: "absent" as const,
      label: "",
    };
    expect(attentionIds(data, "e1", intent, now)).toEqual(["s1"]);
    data.shifts.push({
      ...base,
      id: "replacement",
      replacementFor: "s1",
      personId: "p6",
    });
    expect(attentionIds(data, "e1", intent, now)).toEqual([]);
    data.shifts[1].attendance = "absent";
    expect(attentionIds(data, "e1", intent, now)).toEqual([
      "s1",
      "replacement",
    ]);
    expect(attentionIds(data, "e1", intent, Date.parse(base.endsAt))).toEqual(
      [],
    );
  });
  it("no cuenta una copia confirmada como borrador, sí los cambios y no la cancelación sola", () => {
    expect(pendingMeeting(meeting, publication)).toBe(false);
    expect(pendingMeeting({ ...meeting, revision: 7 }, publication)).toBe(
      false,
    );
    expect(
      pendingMeeting(meeting, { ...publication, status: "cancelled" }),
    ).toBe(false);
    expect(
      pendingMeeting({ ...meeting, location: "Otra sala" }, publication),
    ).toBe(true);
    expect(pendingMeeting({ ...meeting, startsAt: "" })).toBe(true);
  });
  it("usa turnos publicados, conserva legacy completed y ordena en curso antes de futuros", () => {
    const data = createDemoData();
    data.publications[0].shifts[0].personId = user.personId;
    data.shifts[0].personId = user.personId;
    data.shifts[0].attendance = "completed";
    data.shifts.push({
      ...data.shifts[0],
      id: "private",
      role: "Privado",
      status: "draft",
    });
    data.meetingPublications = [
      publication,
      { ...publication, id: "cancelled", status: "cancelled" },
    ];
    expect(
      personalActivities(data, user, "e1", now).map((r) => r.item.id),
    ).toEqual(["s1", "m1"]);
    data.shifts[0].attendance = "replaced";
    expect(
      personalActivities(data, user, "e1", now).map((r) => r.item.id),
    ).toEqual(["m1"]);
    expect(personalActivities(data, user, "e2", now)).toEqual([]);
  });
  it("muestra suplentes y evita duplicar publicaciones antiguas", () => {
    const data = createDemoData();
    data.publications[0].shifts[0].substituteIds.push(user.personId);
    data.publications.push({
      ...data.publications[0],
      id: "latest",
      version: 2,
    });
    expect(personalActivities(data, user, "e1", now)).toHaveLength(1);
  });
  it("en consulta no inventa cantidades de aprobación y usa cargos publicados", () => {
    const data = createDemoData();
    data.publications[0].team = [
      { personId: user.personId, name: user.name, role: "assistant" },
    ];
    const shown = publishedData(data, user, "e1");
    expect(
      homeDepartments(shown, user, "e1", true).own.map((d) => d.id),
    ).toEqual(["video"]);
    expect(departmentSummary(shown, "e1", "video", true)).toMatchObject({
      counts: null,
      assistants: ["Elena Vidal"],
    });
  });
  it("separa preferencias por usuario y evento y borra solo las del inicio", () => {
    expect(scopeKey("u1", "e1")).not.toBe(scopeKey("u2", "e1"));
    expect(scopeKey("u1", "e1")).not.toBe(scopeKey("u1", "e2"));
    const map = new Map([
      [scopeKey("u1", "e1"), "video"],
      ["other", "safe"],
    ]);
    clearHomeScopes({
      length: map.size,
      key: (i) => [...map.keys()][i],
      removeItem: (key) => {
        map.delete(key);
      },
    } as Storage);
    expect([...map.keys()]).toEqual(["other"]);
  });
});
