import {stageCalendar} from './calendar';
import {calendarSnapshot} from '../src/domain/calendar';
import {fromLocalInput} from '../src/domain/format';
import {
  emptyData,
  type AppData,
  type AppUser,
  type Grant,
  type MeetingCommand,
  type MeetingPublication,
} from "../src/domain/types";
import { can, isAdmin } from "../src/domain/rules";
import {
  applyMeetingCommand,
  meetingRecipients,
  meetingReminders,
  notificationEmail,
  validEmail,
} from "../src/domain/meetings";
import {
  defaultMeetingTemplate,
  renderMeetingMail,
  reasonLabels,
  type DeliveryReason,
} from "../src/domain/meetingMail";
import { hash, type RecordData, type Store } from "./store";

const eq = (field: string, value: unknown) => ({
  field,
  op: "EQUAL" as const,
  value,
});
export async function context(
  store: Store,
  eventId: string,
  grants: Grant[] = [],
  personId?: string,
  includeShifts = true,
): Promise<AppData> {
  const data = emptyData();
  data.grants = grants;
  const event = await store.get("events/" + eventId);
  if (!event || event._deleted || event.archived)
    throw new Error("Evento no disponible.");
  data.events = [event as any];
  const [deps, candidates, heads] = await Promise.all([
    store.query("departments"),
    store.query("candidates", [
      eq("eventId", eventId),
      ...(personId ? [eq("personId", personId)] : []),
    ]),
    includeShifts
      ? store.query("publicationHeads", [eq("eventId", eventId)])
      : Promise.resolve([]),
  ]);
  data.departments = deps.filter((d) => !d._deleted) as any;
  data.candidates = candidates.filter((c) => !c._deleted) as any;
  data.publications = (
    await store.getMany(heads.map((h) => "publications/" + h.publicationId))
  ).filter(Boolean) as any;
  return data;
}
export async function listMeetings(
  store: Store,
  user: AppUser,
  grants: Grant[],
) {
  const scoped = { ...emptyData(), grants };
  const admin = isAdmin(user, scoped);
  const ids = admin
    ? (await store.query("events"))
        .filter((e) => !e.archived && !e._deleted)
        .map((e) => e.id)
    : [...new Set(grants.map((g) => g.eventId))];
  const meetings: AppData["meetings"] = [],
    meetingPublications: MeetingPublication[] = [];
  for (const eventId of ids) {
    const [drafts, pubs] = await Promise.all([
      store.query("meetings", [eq("eventId", eventId)]),
      store.query("meetingPublications", [eq("eventId", eventId)]),
    ]);
    const manager = (m: RecordData) =>
      m.departmentIds.some(
        (d: string) =>
          can(user, scoped, "edit", eventId, d) ||
          can(user, scoped, "publish", eventId, d),
      );
    meetings.push(...(drafts.filter(manager) as any));
    meetingPublications.push(
      ...(pubs
        .filter(
          (m) =>
            manager(m) ||
            (m.recipientIds.includes(user.personId) &&
              m.departmentIds.some((d: string) =>
                can(user, scoped, "view", eventId, d),
              )),
        )
        .map((m) =>
          manager(m)
            ? m
            : { ...m, recipientIds: [user.personId], additionalPersonIds: [] },
        ) as any),
    );
  }
  return { meetings, meetingPublications };
}
export async function noticesAndDeliveries(
  tx: Store,
  pub: MeetingPublication,
  personIds: string[],
  reason: DeliveryReason,
  now: string,
) {
  if (personIds.length > 150)
    throw new Error(
      "La convocatoria supera 150 personas. Divídela por departamentos.",
    );
  const ids = await Promise.all(
    personIds.map((personId) =>
      hash(`${pub.id}|${pub.version}|${personId}|${reason}`),
    ),
  );
  const existing = await tx.getMany(ids.map((id) => "meetingDeliveries/" + id));
  for (const [index, personId] of personIds.entries()) {
    const id = ids[index],
      path = "meetingDeliveries/" + id;
    if (existing[index]) continue;
    tx.put(path, {
      id,
      eventId: pub.eventId,
      meetingId: pub.id,
      version: pub.version,
      personId,
      reason,
      status: pub.calendarManaged&&['invitation','changed','cancelled'].includes(reason)?'calendar':'pending',
      dueAt: now,
      attempts: 0,
      createdAt: now,
    });
    tx.put("notices/" + id, {
      id,
      eventId: pub.eventId,
      departmentId: "*",
      personId,
      title: reasonLabels[reason],
      body: pub.title,
      createdAt: now,
      readBy: [],
      meetingId: pub.id,
      meetingVersion: pub.version,
      revision: 1,
      _deleted: false,
    });
  }
}
export function bump(tx: Store, eventId: string, actor: string, now: string) {
  for (const id of ["global", eventId, "public~" + eventId])
    tx.put("revisions/" + id, { at: now, actor });
}
export async function command(
  store: Store,
  user: AppUser,
  input: MeetingCommand,
  now = new Date().toISOString(),
  origin = '',
) {
  if (
    !input ||
    !["save", "confirm", "cancel"].includes(input.action) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 0
  )
    throw new Error("Operación no válida.");
  const id = input.action === "cancel" ? input.meetingId : input.meeting?.id,
    eventId =
      input.action === "cancel" ? input.eventId : input.meeting?.eventId;
  if (
    typeof id !== "string" ||
    !/^[\w-]{1,120}$/.test(id) ||
    typeof eventId !== "string" ||
    eventId.includes("/")
  )
    throw new Error("Reunión no válida.");
  await store.atomic(async (tx) => {
    const grants = (await tx.query("grants", [eq("email", user.email)])).filter(
      (g) => g.active && !g._deleted && (!g.uid || g.uid === user.uid),
    ) as Grant[];
    const data = await context(tx, eventId, grants);
    const old = await tx.get("meetings/" + id),
      pub = await tx.get("meetingPublications/" + id);
    data.meetings = old ? [old as any] : [];
    data.meetingPublications = pub ? [pub as any] : [];
    const next = applyMeetingCommand(data, user, input, now),
      draft = next.meetings[0];
    tx.put("meetings/" + id, draft);
    if (input.action !== "save") {
      const published = next.meetingPublications[0];
      const calendar=await tx.get("calendarSystem/connection"),previousCalendar=await tx.get("calendarLinks/meeting~"+id);
      if(calendar?.enabled||previousCalendar)published.calendarManaged=true;
      if(published.calendarManaged)await stageCalendar(tx,calendarSnapshot(data,"meeting",id,origin,published),now);
      tx.put("meetingPublications/" + id, published);
      tx.put(`meetingVersions/${id}-v${published.version}`, published);
      await noticesAndDeliveries(
        tx,
        published,
        published.recipientIds,
        input.action === "cancel"
          ? "cancelled"
          : pub
            ? "changed"
            : "invitation",
        now,
      );
      if (input.action === "confirm")
        for (const reminder of meetingReminders(
          published.startsAt,
          data.events[0].timezone,
          now,
        )) {
          const taskId = `${id}-v${published.version}-${reminder.kind}`;
          tx.put("meetingTasks/" + taskId, {
            id: taskId,
            meetingId: id,
            version: published.version,
            eventId,
            reason: reminder.kind,
            dueAt: reminder.at,
            status: "pending",
          });
        }
    }
    const auditId = crypto.randomUUID();
    tx.put("audit/" + auditId, {
      id: auditId,
      eventId,
      actor: user.name,
      actorUid: user.uid,
      at: now,
      action: `${input.action === "save" ? "Preparó" : input.action === "cancel" ? "Canceló" : "Confirmó"} reunión: ${draft.title}`,
      collection: "meetings",
      entityId: id,
    });
    bump(tx, eventId, user.uid, now);
  });
}
export async function dispatchTask(store: Store, id: string, now: string) {
  await store.atomic(async (tx) => {
    const task = await tx.get("meetingTasks/" + id);
    if (!task || task.status !== "pending" || task.dueAt > now) return;
    const pub = (await tx.get(
      "meetingPublications/" + task.meetingId,
    )) as MeetingPublication | null;
    const event = await tx.get("events/" + task.eventId);
    if (
      !pub ||
      pub.version !== task.version ||
      pub.status !== "confirmed" ||
      pub.startsAt <= now ||
      !event ||
      event.archived ||
      event._deleted
    ) {
      tx.put("meetingTasks/" + id, { ...task, status: "obsolete" });
      return;
    }
    const data = await context(tx, pub.eventId);
    const recipients = meetingRecipients(data, pub);
    await noticesAndDeliveries(tx, pub, recipients, task.reason, now);
    tx.put("meetingTasks/" + id, { ...task, status: "done" });
    bump(tx, pub.eventId, "meeting-service", now);
  });
}
/** Reconcile only after event data changes, not a full directory scan every minute. */
export async function syncAudience(store: Store, id: string, now: string) {
  await store.atomic(async (tx) => {
    const pub = (await tx.get(
      "meetingPublications/" + id,
    )) as MeetingPublication | null;
    if (!pub || pub.startsAt <= now || pub.status !== "confirmed") return;
    const event = await tx.get("events/" + pub.eventId);
    if (!event || event.archived || event._deleted) return;
    const data = await context(tx, pub.eventId),
      recipients = meetingRecipients(data, pub);
    const failed = await tx.query("meetingDeliveries", [
      eq("meetingId", id),
      eq("status", "missing-email"),
    ]);
    const recoverable = failed.filter(
        (j) => j.version === pub.version && recipients.includes(j.personId),
      ),
      contacts = await tx.getMany(
        recoverable.map((j) => "personContacts/" + j.personId),
      );
    for (const [i, job] of recoverable.entries()) {
      const contact = contacts[i];
      if (
        contact &&
        validEmail(
          notificationEmail({ gmail: "", email: "", ...contact } as any),
        )
      )
        tx.put("meetingDeliveries/" + job.id, {
          ...job,
      status: pub.calendarManaged?'calendar':'pending',
      dueAt: now,
          error: "",
        });
    }
    if (
      JSON.stringify(recipients) ===
      JSON.stringify([...pub.recipientIds].sort())
    )
      return;
    await noticesAndDeliveries(
      tx,
      pub,
      recipients.filter((p) => !pub.recipientIds.includes(p)),
      "invitation",
      now,
    );
    tx.put("meetingPublications/" + pub.id, {
      ...pub,
      recipientIds: recipients,
    });
    bump(tx, pub.eventId, "meeting-service", now);
  });
}
export interface SenderResult {
  id: string;
}
export type SendMail = (
  recipient: string,
  mail: { subject: string; body: string; html: string },
  sender: RecordData,
) => Promise<SenderResult>;
export class MailError extends Error {
  constructor(
    message: string,
    public kind: "retry" | "uncertain" | "permanent",
    public delay = 60000,
  ) {
    super(message);
  }
}
export async function reviewDelivery(
  store: Store,
  user: AppUser,
  id: string,
  action: "retry" | "sent",
  now = new Date().toISOString(),
) {
  if (!/^[\w-]{1,120}$/.test(id) || !["retry", "sent"].includes(action))
    throw new Error("Revisión no válida.");
  await store.atomic(async (tx) => {
    const job = await tx.get("meetingDeliveries/" + id);
    if (!job || !["error", "uncertain", "missing-email"].includes(job.status))
      throw new Error("Este envío ya ha cambiado. Actualiza la lista.");
    const pub = await tx.get("meetingPublications/" + job.meetingId),
      grants = await tx.query("grants", [eq("email", user.email)]);
    const data = {
      ...emptyData(),
      grants: grants.filter(
        (g) => g.active && !g._deleted && (!g.uid || g.uid === user.uid),
      ) as Grant[],
    };
    if (
      !pub ||
      !pub.departmentIds.every((d: string) =>
        can(user, data, "publish", job.eventId, d),
      )
    )
      throw new Error("No tienes permiso para revisar este envío.");
    if (action === "sent" && job.status !== "uncertain")
      throw new Error(
        "Solo se revisan como enviados los resultados inciertos.",
      );
    if (
      action === "retry" &&
      (pub.version !== job.version ||
        (job.reason !== "cancelled" &&
          (pub.status !== "confirmed" || pub.startsAt <= now)))
    )
      throw new Error("La convocatoria ha cambiado o ya ha pasado.");
    tx.put("meetingDeliveries/" + id, {
      ...job,
      status: action === "sent" ? "sent" : "pending",
      dueAt: now,
      reviewedBy: user.uid,
      reviewedAt: now,
      manuallyConfirmed: action === "sent",
      error: "",
    });
    const auditId = crypto.randomUUID();
    tx.put("audit/" + auditId, {
      id: auditId,
      eventId: job.eventId,
      actor: user.name,
      actorUid: user.uid,
      at: now,
      action:
        action === "sent"
          ? "Verificó el correo en Enviados"
          : "Solicitó reintentar un correo",
      collection: "meetingDeliveries",
      entityId: id,
    });
  });
}
export async function deliver(
  store: Store,
  id: string,
  origin: string,
  send: SendMail,
  now = new Date().toISOString(),
  senderPath = "meetingSystem/sender",
) {
  const lease = crypto.randomUUID();
  const prepared = await store.atomic(async (tx) => {
    const job = await tx.get("meetingDeliveries/" + id);
    if (
      !job ||
      !["pending", "retry", "sending"].includes(job.status) ||
      job.dueAt > now
    )
      return null;
    if (job.status === "sending") {
      if (job.leaseUntil <= now)
        tx.put("meetingDeliveries/" + id, {
          ...job,
          status: "uncertain",
          error:
            "Gmail no confirmó el resultado. Revisa Enviados antes de reenviar.",
        });
      return null;
    }
    const calendarLink=job.calendarKey?await tx.get('calendarLinks/'+job.calendarKey):null;
    const pub = (calendarLink?{...calendarLink.snapshot,id:calendarLink.sourceId,eventId:calendarLink.eventId,version:calendarLink.version,status:calendarLink.snapshot.status,recipientIds:calendarLink.snapshot.recipientIds,startsAt:calendarLink.snapshot.startsAt||fromLocalInput(calendarLink.snapshot.startDate+'T23:59',calendarLink.snapshot.timezone),duration:0,kind:'in-person',location:calendarLink.snapshot.location,address:'',instructions:calendarLink.snapshot.description,zoomUrl:'',sessionDate:'',session:'morning',additionalPersonIds:[],publishedAt:calendarLink.updatedAt,publishedBy:'LS Asambleas'}:await tx.get('meetingPublications/'+job.meetingId)) as MeetingPublication | null;
    const event = await tx.get("events/" + job.eventId);
    if (
      !pub ||
      pub.version !== job.version ||
      !event ||
      event.archived ||
      event._deleted ||
      (job.reason !== "cancelled" &&
        (pub.status !== "confirmed" || pub.startsAt <= now))
    ) {
      tx.put("meetingDeliveries/" + id, { ...job, status: "obsolete" });
      return null;
    }
    if(pub.calendarManaged&&["invitation","changed","cancelled"].includes(job.reason)){tx.put("meetingDeliveries/"+id,{...job,status:"calendar"});return null;}
    const data = await context(
      tx,
      pub.eventId,
      [],
      job.personId,
      pub.kind === "orientation",
    );
    const current =
      job.reason === "cancelled"
        ? pub.recipientIds
        : calendarLink?pub.recipientIds:meetingRecipients(data, pub);
    if (!current.includes(job.personId)) {
      tx.put("meetingDeliveries/" + id, { ...job, status: "obsolete" });
      return null;
    }
    const responseLink=calendarLink||await tx.get("calendarLinks/meeting~"+job.meetingId);
    if(responseLink?.responses?.[job.personId]?.status==="declined"){tx.put("meetingDeliveries/"+id,{...job,status:"declined",error:"Respondió No a esta convocatoria."});return null;}
    const [person, contact, sender, budget] = await Promise.all([
      tx.get("persons/" + job.personId),
      tx.get("personContacts/" + job.personId),
      tx.get(senderPath),
      tx.get("meetingSystem/budget"),
    ]);
    const recipient = notificationEmail({
      gmail: "",
      email: "",
      ...contact,
    } as any);
    if (!validEmail(recipient)) {
      tx.put("meetingDeliveries/" + id, {
        ...job,
        status: "missing-email",
        error: "Falta un correo válido.",
      });
      return null;
    }
    if (!sender?.encryptedToken || !sender.enabled) {
      tx.put("meetingDeliveries/" + id, {
        ...job,
        status: "pending",
        dueAt: new Date(Date.parse(now) + 60000).toISOString(),
        error: "El remitente está desconectado o en modo prueba.",
      });
      return null;
    }
    const recent = ((budget?.attempts || []) as string[]).filter(
      (at) => at > new Date(Date.parse(now) - 86400000).toISOString(),
    );
    if (recent.length >= 400) {
      tx.put("meetingDeliveries/" + id, {
        ...job,
        status: "retry",
        dueAt: new Date(Date.parse(recent[0]) + 86400000 + 1000).toISOString(),
        error: "Límite de 400 envíos en 24 horas.",
      });
      return null;
    }
    tx.put("meetingSystem/budget", { attempts: [...recent, now] });
    const claimed = {
      ...job,
      status: "sending",
      lease,
      leaseUntil: new Date(Date.parse(now) + 120000).toISOString(),
      attempts: job.attempts + 1,
      recipient,
      sender: sender.email,
      error: "",
    };
    tx.put("meetingDeliveries/" + id, claimed);
    tx.put("meetingAttempts/" + lease, {
      id: lease,
      deliveryId: id,
      meetingId: pub.id,
      version: pub.version,
      personId: job.personId,
      sender: sender.email,
      recipient,
      startedAt: now,
      status: "sending",
    });
    return {
      job: claimed,
      recipient,
      sender,
      mail: renderMeetingMail(
        pub,
        event as any,
        person?.name || "colaborador",
        job.reason,
        origin,
        sender.template || defaultMeetingTemplate,
        !!calendarLink,
      ),
    };
  });
  if (!prepared) return;
  let outcome: RecordData;
  try {
    const result = await send(
      prepared.recipient,
      prepared.mail,
      prepared.sender,
    );
    outcome = { status: "sent", sentAt: now, messageId: result.id, error: "" };
  } catch (e) {
    const error =
      e instanceof MailError
        ? e
        : new MailError("No se pudo confirmar el resultado.", "uncertain");
    const retry = error.kind === "retry" && prepared.job.attempts < 5;
    outcome = {
      status: retry
        ? "retry"
        : error.kind === "uncertain"
          ? "uncertain"
          : "error",
      error: error.message,
      ...(retry
        ? {
            dueAt: new Date(
              Date.parse(now) +
                Math.max(error.delay, 60000 * 2 ** prepared.job.attempts),
            ).toISOString(),
          }
        : {}),
    };
  }
  await store.atomic(async (tx) => {
    const current = await tx.get("meetingDeliveries/" + id);
    if (current?.lease === lease) {
      tx.put("meetingDeliveries/" + id, { ...current, ...outcome });
      const attempt = await tx.get("meetingAttempts/" + lease);
      if (attempt)
        tx.put("meetingAttempts/" + lease, { ...attempt, ...outcome });
    }
  });
}
