import { describe, it, expect, vi } from "vitest";
import {
  emptyData,
  type AppUser,
  type Meeting,
  type Grant,
} from "../src/domain/types";
import {
  applyMeetingCommand,
  meetingRecipients,
  meetingReminders,
  notificationEmail,
  validateMeeting,
} from "../src/domain/meetings";
import { publishedData } from "../src/domain/publication";
import { makeOfflineCopy } from "../src/offline";
import {
  defaultMeetingTemplate,
  renderMeetingMail,
} from "../src/domain/meetingMail";
import {
  command,
  deliver,
  dispatchTask,
  MailError,
  syncAudience,
  listMeetings,
  reviewDelivery,
} from "../worker/service";
import type { Store, RecordData, Filter } from "../worker/store";
import { encrypt, decrypt, gmailSender } from "../worker/gmail";

export class MemoryStore implements Store {
  values = new Map<string, RecordData>();
  private chain: Promise<unknown> = Promise.resolve();
  async get(path: string) {
    return structuredClone(this.values.get(path) || null);
  }
  async getMany(paths: string[]) {
    return Promise.all(paths.map((p) => this.get(p)));
  }
  async query(collection: string, filters: Filter[] = [], limit = 500) {
    return [...this.values.entries()]
      .filter(
        ([path, v]) =>
          path.startsWith(collection + "/") &&
          filters.every((f) =>
            f.op === "EQUAL"
              ? v[f.field] === f.value
              : f.op === "GREATER_THAN"
                ? v[f.field] > (f.value as any)
                : f.op === "GREATER_THAN_OR_EQUAL"
                  ? v[f.field] >= (f.value as any)
                  : v[f.field] <= (f.value as any),
          ),
      )
      .slice(0, limit)
      .map(([, v]) => structuredClone(v));
  }
  put(path: string, value: RecordData) {
    this.values.set(path, structuredClone(value));
  }
  remove(path: string) {
    this.values.delete(path);
  }
  async atomic<T>(fn: (tx: Store) => Promise<T>) {
    const work = this.chain.then(async () => {
      const tx = new MemoryStore();
      tx.values = structuredClone(this.values);
      const result = await fn(tx);
      this.values = tx.values;
      return result;
    });
    this.chain = work.catch(() => {});
    return work;
  }
}
const now = "2026-10-20T10:00:00.000Z";
const admin: AppUser = {
  uid: "admin",
  personId: "p-admin",
  email: "admin@example.test",
  name: "Administradora ficticia",
  role: "admin",
};
const grant: Grant = {
  id: "admin@example.test~*~*",
  email: admin.email,
  uid: admin.uid,
  personId: admin.personId,
  role: "admin",
  eventId: "*",
  departmentId: "*",
  active: true,
  capabilities: ["view", "edit", "publish", "contacts"],
};
const meeting: Meeting = {
  id: "meeting-1",
  eventId: "e1",
  departmentIds: ["video"],
  kind: "zoom",
  title: "Formación por Zoom",
  startsAt: "2026-10-25T08:00:00.000Z",
  duration: 60,
  location: "",
  address: "",
  zoomUrl: "https://zoom.us/j/123456789",
  instructions: "Datos ficticios",
  sessionDate: "2026-10-25",
  session: "morning",
  additionalPersonIds: [],
};
function fixture() {
  const d = emptyData();
  d.grants = [grant];
  d.events = [
    {
      id: "e1",
      title: "Asamblea ficticia",
      type: "circuit",
      startDate: "2026-10-25",
      endDate: "2026-10-25",
      venueId: "v",
      timezone: "Europe/Madrid",
      section: "LSE",
      archived: false,
    },
  ];
  d.departments = [
    { id: "video", name: "Vídeo", icon: "video" },
    { id: "new", name: "Acogida", icon: "other" },
  ];
  d.persons = ["p1", "p2", "p3", "p4"].map((id) => ({
    id,
    name: "Persona " + id,
    congregationId: "c",
    phone: "",
    email: id + "@example.test",
    gmail: "",
    notificationEmail: id === "p1" ? "avisos@example.test" : undefined,
    notes: "privado",
  }));
  d.candidates = d.persons.map((p, i) => ({
    id: "c" + i,
    eventId: "e1",
    departmentId: "video",
    personId: p.id,
    committee: "approved",
    availability: "accepted",
    access: "none",
    reserve: i === 3,
    teamRole: i === 0 ? "responsible" : i === 1 ? "assistant" : "volunteer",
  }));
  d.publications = [
    {
      id: "pub",
      eventId: "e1",
      departmentId: "video",
      version: 1,
      publishedAt: now,
      publishedBy: "Admin",
      shifts: [
        {
          id: "shift",
          eventId: "e1",
          departmentId: "video",
          personId: "p3",
          role: "Mesa",
          startsAt: "2026-10-25T08:40:00.000Z",
          endsAt: "2026-10-25T11:10:00.000Z",
          meetingPoint: "Mesa",
          status: "published",
          attendance: "planned",
          substituteIds: [],
        },
      ],
      program: [],
      plans: [],
    },
  ];
  return d;
}
function storeFixture() {
  const d = fixture(),
    s = new MemoryStore();
  for (const [name, rows] of Object.entries(d))
    for (const row of rows) s.put(name + "/" + row.id, row);
  for (const p of d.persons) s.put("personContacts/" + p.id, p);
  s.put("publicationHeads/e1~video", {
    id: "e1~video",
    eventId: "e1",
    departmentId: "video",
    publicationId: "pub",
  });
  s.put("meetingSystem/sender", {
    email: "sender@gmail.com",
    encryptedToken: "test-secret",
    enabled: true,
    tested: true,
  });
  return s;
}
describe("Reuniones: fechas, convocados y consulta", () => {
  it("víspera a las 20:00 y una hora antes durante el cambio horario", () => {
    expect(meetingReminders(meeting.startsAt, "Europe/Madrid", now)).toEqual([
      { kind: "previous-day", at: "2026-10-24T18:00:00.000Z" },
      { kind: "one-hour", at: "2026-10-25T07:00:00.000Z" },
    ]);
  });
  it("no acumula recordatorios vencidos ni confunde Canarias", () => {
    expect(
      meetingReminders(
        meeting.startsAt,
        "Europe/Madrid",
        "2026-10-25T07:30:00.000Z",
      ),
    ).toEqual([]);
    expect(
      meetingReminders(meeting.startsAt, "Atlantic/Canary", now)[0].at,
    ).toBe("2026-10-24T19:00:00.000Z");
  });
  it("permite un borrador sin fecha y una formación anterior al evento", () => {
    expect(() => validateMeeting({ ...meeting, startsAt: "" })).not.toThrow();
    expect(() => validateMeeting({ ...meeting, startsAt: "" }, true)).toThrow();
    expect(() =>
      applyMeetingCommand(
        fixture(),
        admin,
        {
          action: "confirm",
          meeting: { ...meeting, startsAt: "2026-10-22T18:00:00.000Z" },
          expectedVersion: 0,
        },
        now,
      ),
    ).not.toThrow();
  });
  it("incluye reservas y cargos, deduplica departamentos y excluye no aceptados", () => {
    const d = fixture();
    d.candidates.push({ ...d.candidates[0], id: "extra", departmentId: "new" });
    d.candidates[2].availability = "declined";
    expect(
      meetingRecipients(d, { ...meeting, departmentIds: ["video", "new"] }),
    ).toEqual(["p1", "p2", "p4"]);
  });
  it("orientación usa el equipo publicado, cargos y asistentes sin servicio", () => {
    const d = fixture(),
      m = { ...meeting, kind: "orientation" as const };
    expect(meetingRecipients(d, m)).toEqual(["p1", "p2", "p3"]);
    expect(
      meetingRecipients(d, {
        ...m,
        session: "afternoon",
        additionalPersonIds: ["p4"],
      }),
    ).toEqual(["p1", "p2", "p4"]);
  });
  it("las sustituciones publicadas no convocan al titular sustituido", () => {
    const d = fixture();
    d.publications[0].shifts[0].attendance = "replaced";
    d.publications[0].shifts.push({
      ...d.publications[0].shifts[0],
      id: "newshift",
      attendance: "planned",
      personId: "p4",
    });
    expect(meetingRecipients(d, { ...meeting, kind: "orientation" })).toEqual([
      "p1",
      "p2",
      "p4",
    ]);
  });
  it("guardar borrador conserva la versión confirmada y detecta conflictos", () => {
    let d = applyMeetingCommand(
      fixture(),
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    d = applyMeetingCommand(
      d,
      admin,
      {
        action: "save",
        meeting: { ...d.meetings[0], title: "Cambio sin publicar" },
        expectedVersion: 1,
      },
      now,
    );
    expect(d.meetingPublications[0].title).toBe(meeting.title);
    expect(() =>
      applyMeetingCommand(
        d,
        admin,
        { action: "confirm", meeting, expectedVersion: 0 },
        now,
      ),
    ).toThrow(/cambiado/);
  });
  it("un cargo sin permisos no autoriza y un ámbito parcial no publica conjuntamente", () => {
    const d = fixture();
    d.grants = [];
    expect(() =>
      applyMeetingCommand(
        d,
        { ...admin, role: "responsible" },
        { action: "confirm", meeting, expectedVersion: 0 },
        now,
      ),
    ).toThrow(/permiso/);
    d.grants = [
      { ...grant, role: "responsible", eventId: "e1", departmentId: "video" },
    ];
    expect(() =>
      applyMeetingCommand(
        d,
        admin,
        {
          action: "confirm",
          meeting: { ...meeting, departmentIds: ["video", "new"] },
          expectedVersion: 0,
        },
        now,
      ),
    ).toThrow(/permiso/);
  });
  it("el correo de avisos queda fuera de consultas offline, incluso sin turnos publicados", () => {
    const d = applyMeetingCommand(
      fixture(),
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    d.publications = [];
    const copy = makeOfflineCopy(d, admin, "e1");
    expect(copy.data.meetingPublications).toHaveLength(1);
    expect(JSON.stringify(copy)).not.toContain("avisos@example.test");
    expect(copy.data.meetings).toEqual([]);
    expect(notificationEmail(fixture().persons[0])).toBe("avisos@example.test");
  });
  it("el voluntario no ve convocatorias ajenas, ni borradores", () => {
    const d = applyMeetingCommand(
      fixture(),
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    d.grants.push({
      ...grant,
      id: "other",
      email: "p9@example.test",
      uid: "p9",
      personId: "p9",
      role: "volunteer",
      eventId: "e1",
      departmentId: "video",
      capabilities: ["view"],
    });
    expect(
      publishedData(
        d,
        {
          uid: "p9",
          email: "p9@example.test",
          personId: "p9",
          name: "P9",
          role: "volunteer",
        },
        "e1",
      ).meetingPublications,
    ).toEqual([]);
  });
  it("rechaza URLs peligrosas, campos secretos, fechas inválidas e inyección HTML", () => {
    expect(() =>
      validateMeeting({ ...meeting, zoomUrl: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      validateMeeting({ ...meeting, startsAt: "2026-02-31T10:00:00.000Z" }),
    ).toThrow();
    expect(() =>
      validateMeeting({ ...meeting, secret: "token" } as any),
    ).toThrow();
    const pub = applyMeetingCommand(
      fixture(),
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    ).meetingPublications[0];
    const mail = renderMeetingMail(
      pub,
      fixture().events[0],
      "<script>bad</script>",
      "invitation",
      "https://example.test",
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.body).toContain("?evento=e1&reunion=meeting-1");
    expect(defaultMeetingTemplate.body).not.toContain("Samuel");
  });
});
describe("Servicio: transacciones, correo y recuperación", () => {
  it("confirma atómicamente, genera dos recordatorios y un aviso por persona", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    expect(await s.query("meetingTasks")).toHaveLength(2);
    expect(await s.query("meetingDeliveries")).toHaveLength(4);
    expect(await s.query("notices")).toHaveLength(4);
    expect(await s.query("meetingVersions")).toHaveLength(1);
  });
  it("dos confirmaciones concurrentes no duplican versiones ni correos", async () => {
    const s = storeFixture();
    const results = await Promise.allSettled([
      command(
        s,
        admin,
        { action: "confirm", meeting, expectedVersion: 0 },
        now,
      ),
      command(
        s,
        admin,
        { action: "confirm", meeting, expectedVersion: 0 },
        now,
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await s.query("meetingDeliveries")).toHaveLength(4);
  });
  it("cambiar fecha invalida trabajos antiguos; cancelar avisa sin futuros recordatorios", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const task = (await s.query("meetingTasks"))[0];
    await command(
      s,
      admin,
      {
        action: "confirm",
        meeting: {
          ...meeting,
          revision: 1,
          startsAt: "2026-10-26T08:00:00.000Z",
        },
        expectedVersion: 1,
      },
      now,
    );
    await dispatchTask(s, task.id, "2026-10-24T20:00:00.000Z");
    expect((await s.get("meetingTasks/" + task.id))?.status).toBe("obsolete");
    await command(
      s,
      admin,
      {
        action: "cancel",
        meetingId: meeting.id,
        eventId: "e1",
        expectedVersion: 2,
      },
      now,
    );
    expect((await s.get("meetingPublications/" + meeting.id))?.status).toBe(
      "cancelled",
    );
    expect(
      (await s.query("meetingDeliveries")).filter(
        (j) => j.reason === "cancelled",
      ),
    ).toHaveLength(4);
  });
  it("dos consumidores concurrentes envían una sola vez y conservan el remitente usado", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const job = (await s.query("meetingDeliveries"))[0];
    const send = vi.fn(async () => ({ id: "gmail-id" }));
    await Promise.all([
      deliver(s, job.id, "https://example.test", send, now),
      deliver(s, job.id, "https://example.test", send, now),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    s.put("meetingSystem/sender", {
      email: "new@gmail.com",
      enabled: true,
      encryptedToken: "new",
    });
    expect((await s.get("meetingDeliveries/" + job.id))?.sender).toBe(
      "sender@gmail.com",
    );
  });
  it("un envío sin confirmación no se reintenta a ciegas", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const job = (await s.query("meetingDeliveries"))[0],
      send = vi.fn(async () => {
        throw new MailError("Resultado incierto", "uncertain");
      });
    await deliver(s, job.id, "https://example.test", send, now);
    await deliver(s, job.id, "https://example.test", send, now);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await s.get("meetingDeliveries/" + job.id))?.status).toBe(
      "uncertain",
    );
  });
  it("un consumidor interrumpido deja una entrega incierta, no otro envío", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const job = (await s.query("meetingDeliveries"))[0];
    s.put("meetingDeliveries/" + job.id, {
      ...job,
      status: "sending",
      leaseUntil: now,
    });
    const send = vi.fn();
    await deliver(s, job.id, "https://example.test", send, now);
    expect(send).not.toHaveBeenCalled();
    expect((await s.get("meetingDeliveries/" + job.id))?.status).toBe(
      "uncertain",
    );
  });
  it("sin correo conserva el aviso y se recupera al corregir la ficha", async () => {
    const s = storeFixture();
    s.put("personContacts/p1", { id: "p1", email: "", gmail: "" });
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const job = (await s.query("meetingDeliveries")).find(
      (j) => j.personId === "p1",
    )!;
    const send = vi.fn();
    await deliver(s, job.id, "https://example.test", send, now);
    expect((await s.get("meetingDeliveries/" + job.id))?.status).toBe(
      "missing-email",
    );
    expect(await s.query("notices")).toHaveLength(4);
    s.put("personContacts/p1", { email: "fixed@example.test", gmail: "" });
    await syncAudience(s, meeting.id, now);
    expect((await s.get("meetingDeliveries/" + job.id))?.status).toBe(
      "pending",
    );
  });
  it("una baja deja de recibir correo; una incorporación recibe la convocatoria", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const c = (await s.get("candidates/c2"))!;
    s.put("candidates/c2", { ...c, availability: "declined" });
    const job = (await s.query("meetingDeliveries")).find(
        (j) => j.personId === "p3",
      )!,
      send = vi.fn();
    await deliver(s, job.id, "https://example.test", send, now);
    expect(send).not.toHaveBeenCalled();
    s.put("candidates/new", { ...c, id: "new", personId: "new-person" });
    await syncAudience(s, meeting.id, now);
    expect(
      (await s.get("meetingPublications/" + meeting.id))?.recipientIds,
    ).toContain("new-person");
    expect(
      (await s.query("meetingDeliveries")).filter(
        (j) => j.personId === "new-person",
      ),
    ).toHaveLength(1);
  });
  it("el límite de 400 y el modo de prueba no generan envíos reales", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const job = (await s.query("meetingDeliveries"))[0],
      send = vi.fn();
    s.put("meetingSystem/budget", { attempts: Array(400).fill(now) });
    await deliver(s, job.id, "https://example.test", send, now);
    expect(send).not.toHaveBeenCalled();
    expect((await s.get("meetingDeliveries/" + job.id))?.status).toBe("retry");
  });
  it("las credenciales cifradas no forman parte de las reuniones consultables", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    expect(JSON.stringify(await listMeetings(s, admin, [grant]))).not.toContain(
      "test-secret",
    );
    const key = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    );
    const cipher = await encrypt("private-refresh-token", key);
    expect(cipher).not.toContain("private-refresh-token");
    expect(await decrypt(cipher, key)).toBe("private-refresh-token");
  });
  it("Gmail sin respuesta se trata como incierto, y solo se pide permiso de envío", async () => {
    const key = btoa(
        String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
      ),
      token = await encrypt("refresh", key);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
        }),
      )
      .mockRejectedValueOnce(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(
        gmailSender({
          GOOGLE_CLIENT_ID: "id",
          GOOGLE_CLIENT_SECRET: "secret",
          TOKEN_ENCRYPTION_KEY: key,
        })(
          "p@example.test",
          { subject: "Prueba", body: "Hola", html: "<p>Hola</p>" },
          { encryptedToken: token, email: "sender@gmail.com" },
        ),
      ).rejects.toMatchObject({ kind: "uncertain" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("Revisión de entregas", () => {
  it("exige permiso y revisión explícita para un resultado incierto", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const job = (await s.query("meetingDeliveries"))[0];
    s.put("meetingDeliveries/" + job.id, { ...job, status: "uncertain" });
    await expect(
      reviewDelivery(
        s,
        { ...admin, email: "intruder@example.test" },
        job.id,
        "retry",
        now,
      ),
    ).rejects.toThrow(/permiso/);
    await reviewDelivery(s, admin, job.id, "sent", now);
    expect(
      (await s.get("meetingDeliveries/" + job.id))?.manuallyConfirmed,
    ).toBe(true);
    expect(await s.query("audit")).toHaveLength(2);
  });
  it("el cambio de remitente no modifica el histórico de intentos", async () => {
    const s = storeFixture();
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const job = (await s.query("meetingDeliveries"))[0];
    await deliver(
      s,
      job.id,
      "https://example.test",
      async () => {
        throw new MailError("error temporal", "retry");
      },
      now,
    );
    s.put("meetingSystem/sender", {
      email: "new@gmail.com",
      encryptedToken: "new-secret",
      enabled: true,
    });
    await deliver(
      s,
      job.id,
      "https://example.test",
      async () => ({ id: "sent" }),
      "2026-10-20T10:10:00.000Z",
    );
    expect((await s.query("meetingAttempts")).map((a) => a.sender)).toEqual([
      "sender@gmail.com",
      "new@gmail.com",
    ]);
  });
  it("modo de prueba conserva avisos y detiene envíos a convocados", async () => {
    const s = storeFixture();
    s.put("meetingSystem/sender", {
      email: "sender@gmail.com",
      encryptedToken: "secret",
      enabled: false,
    });
    await command(
      s,
      admin,
      { action: "confirm", meeting, expectedVersion: 0 },
      now,
    );
    const send = vi.fn();
    await deliver(
      s,
      (await s.query("meetingDeliveries"))[0].id,
      "https://example.test",
      send,
      now,
    );
    expect(send).not.toHaveBeenCalled();
    expect(await s.query("notices")).toHaveLength(4);
  });
});
