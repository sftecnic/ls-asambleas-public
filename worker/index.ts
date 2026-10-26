import {
  emptyData,
  type MeetingCommand,
  type Grant,
} from "../src/domain/types";
import {
  applyMeetingCommand,
  meetingRecipients,
  notificationEmail,
  validEmail,
} from "../src/domain/meetings";
import { can, isAdmin } from "../src/domain/rules";
import {
  defaultMeetingTemplate,
  validateMeetingTemplate,
} from "../src/domain/meetingMail";
import { authenticate } from "./auth";
import {handleTourRequest,TourHttpError,type TourAssetsBinding} from './tours';
import {
  FirestoreStore,
  b64,
  utf8,
  hash,
  type RecordData,
  type Store,
} from "./store";
import {
  command,
  context,
  listMeetings,
  dispatchTask,
  syncAudience,
  deliver,
  reviewDelivery,
} from "./service";
import {
  encrypt,
  decrypt,
  gmailSender,
  senderPublic,
  type MailEnv,
} from "./gmail";

type QueueJob = { id: string; kind: "audience" | "task" | "delivery" };
interface Queue {
  sendBatch(messages: { body: QueueJob }[]): Promise<void>;
}
interface Env extends MailEnv {
  FIREBASE_SERVICE_ACCOUNT: string;
  FIREBASE_PROJECT_ID: string;
  APP_ORIGIN: string;
  MEETING_QUEUE: Queue;
  TOUR_ASSETS?: TourAssetsBinding;
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
const eq = (field: string, value: unknown) => ({
  field,
  op: "EQUAL" as const,
  value,
});
const makeStore = (env: Env) =>
  new FirestoreStore(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT));
async function parse(request: Request) {
  const raw = await request.text();
  if (raw.length > 20000) throw new Error("El formulario es demasiado grande.");
  return JSON.parse(raw);
}

async function oauthCallback(request: Request, env: Env, store: Store) {
  const url = new URL(request.url),
    state = url.searchParams.get("state") || "",
    code = url.searchParams.get("code");
  if (!/^[\w-]{43}$/.test(state) || !code)
    throw new Error("Conexión cancelada. Vuelve a Avisos y correo.");
  const saved = await store.atomic(async (tx) => {
    const value = await tx.get("meetingOAuth/" + state);
    if (!value || value.expires < Date.now() || value.used)
      throw new Error("La conexión ha caducado. Vuelve a intentarlo.");
    const grants = await tx.query("grants", [eq("email", value.email)]);
    if (
      !grants.some(
        (g) =>
          g.active &&
          g.role === "admin" &&
          g.eventId === "*" &&
          g.departmentId === "*" &&
          (!g.uid || g.uid === value.uid),
      )
    )
      throw new Error("Administración requerida.");
    tx.put("meetingOAuth/" + state, { ...value, used: true });
    return value;
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: url.origin + "/oauth/callback",
      grant_type: "authorization_code",
      code_verifier: saved.verifier,
    }),
  });
  const token: any = await r.json();
  if (
    !r.ok ||
    !token.refresh_token ||
    !String(token.scope)
      .split(" ")
      .includes("https://www.googleapis.com/auth/gmail.send")
  )
    throw new Error(
      "No se concedió permiso de envío. Vuelve a conectar Gmail.",
    );
  const infoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${token.access_token}` } },
  );
  const info: any = await infoResponse.json();
  if (
    !infoResponse.ok ||
    !info.email_verified ||
    typeof info.email !== "string" ||
    !/^[^\s@]+@gmail\.com$/i.test(info.email)
  )
    throw new Error("Conecta una cuenta de Gmail verificada.");
  const encryptedToken = await encrypt(
    token.refresh_token,
    env.TOKEN_ENCRYPTION_KEY,
  );
  await store.atomic(async (tx) => {
    const old = await tx.get("meetingSystem/sender");
    tx.put("meetingSystem/sender", {
      email: info.email.toLowerCase(),
      encryptedToken,
      enabled: false,
      tested: false,
      connectedAt: new Date().toISOString(),
      connectedBy: saved.email,
      template: old?.template || defaultMeetingTemplate,
    });
    tx.remove("meetingOAuth/" + state);
  });
  return Response.redirect(env.APP_ORIGIN + "/?correo=conectado", 303);
}
export async function handle(request: Request, env: Env, store: Store) {
  const url = new URL(request.url);
  if (url.pathname === "/health")
    return json({ service: "ls-asambleas-meetings", version: 1 });
  if (url.pathname === "/oauth/callback")
    return oauthCallback(request, env, store);
  const { user, grants } = await authenticate(
      request,
      env.FIREBASE_PROJECT_ID,
      store,
    ),
    data = { ...emptyData(), grants };
  if(url.pathname==='/tours'||url.pathname.startsWith('/tours/'))return handleTourRequest(request,store,user,grants,env.TOUR_ASSETS);
  if (url.pathname === "/meetings" && request.method === "GET")
    return json(await listMeetings(store, user, grants));
  if (url.pathname === "/meetings/preview" && request.method === "POST") {
    const input = await parse(request);
    const eventId = input.meeting?.eventId;
    if (typeof eventId !== "string" || eventId.includes("/"))
      throw new Error("Evento no válido.");
    const ctx = await context(store, eventId, grants);
    const id = input.meeting?.id;
    if (typeof id !== "string" || !/^[\w-]{1,120}$/.test(id))
      throw new Error("Reunión no válida.");
    const old = await store.get("meetings/" + id),
      pub = await store.get("meetingPublications/" + id);
    ctx.meetings = old ? [old as any] : [];
    ctx.meetingPublications = pub ? [pub as any] : [];
    applyMeetingCommand(ctx, user, {
      action: "confirm",
      meeting: input.meeting,
      expectedVersion: input.expectedVersion,
    });
    const ids = meetingRecipients(ctx, input.meeting);
    const people = await store.getMany(ids.map((id) => "persons/" + id)),
      contacts = await store.getMany(ids.map((id) => "personContacts/" + id));
    const missingNames = people
      .filter(
        (_, i) =>
          !validEmail(
            notificationEmail({ gmail: "", email: "", ...contacts[i] } as any),
          ),
      )
      .map((p) => p?.name || "Persona convocada");
    const sender = await store.get("meetingSystem/sender");
    return json({
      names: people.map((p) => p?.name || "Persona convocada"),
      total: ids.length,
      missing: missingNames.length,
      missingNames,
      mailReady: !!sender?.enabled && !!sender?.encryptedToken,
    });
  }
  if (url.pathname === "/meetings/command" && request.method === "POST") {
    await command(store, user, (await parse(request)) as MeetingCommand);
    return json({ ok: true });
  }
  if (url.pathname === "/deliveries/review" && request.method === "POST") {
    const input = await parse(request);
    await reviewDelivery(store, user, input.id, input.action);
    return json({ ok: true });
  }
  if (url.pathname === "/deliveries" && request.method === "GET") {
    const eventId = url.searchParams.get("event") || "",
      meetingId = url.searchParams.get("meeting") || "";
    const pub = await store.get("meetingPublications/" + meetingId);
    if (
      !pub ||
      pub.eventId !== eventId ||
      !pub.departmentIds.every((dep: string) =>
        can(user, data, "publish", eventId, dep),
      )
    )
      throw new Error("No tienes permiso para ver estos envíos.");
    const rows = await store.query(
      "meetingDeliveries",
      [eq("meetingId", meetingId), eq("version", pub.version)],
      500,
    );
    const contacts = pub.departmentIds.every((dep: string) =>
      can(user, data, "contacts", eventId, dep),
    );
    return json({
      deliveries: rows.map(({ recipient, ...row }) => ({
        ...row,
        ...(contacts ? { recipient } : {}),
        lease: undefined,
      })),
    });
  }
  if (!isAdmin(user, data))
    return json({ error: "Esta acción requiere administración." }, 403);
  if (url.pathname === "/sender" && request.method === "GET")
    return json(senderPublic(await store.get("meetingSystem/sender")));
  if (url.pathname === "/sender/connect" && request.method === "POST") {
    if (
      !env.GOOGLE_CLIENT_ID ||
      !env.GOOGLE_CLIENT_SECRET ||
      !env.TOKEN_ENCRYPTION_KEY
    )
      throw new Error("Falta configurar la conexión con Google.");
    const state = b64(crypto.getRandomValues(new Uint8Array(32))),
      verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
    await store.atomic(async (tx) =>
      tx.put("meetingOAuth/" + state, {
        email: user.email,
        uid: user.uid,
        verifier,
        expires: Date.now() + 600000,
        used: false,
      }),
    );
    const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    target.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: url.origin + "/oauth/callback",
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/gmail.send",
      access_type: "offline",
      prompt: "consent select_account",
      state,
      code_challenge: await hash(verifier),
      code_challenge_method: "S256",
    }).toString();
    return json({ url: target.href });
  }
  if (url.pathname === "/sender/test" && request.method === "POST") {
    const saved = await store.get("meetingSystem/sender");
    if (!saved?.encryptedToken)
      throw new Error("Conecta primero una cuenta de Gmail.");
    const at = new Date().toISOString();
    await store.atomic(async (tx) => {
      const budget = await tx.get("meetingSystem/budget"),
        attempts = (budget?.attempts || []).filter(
          (v: string) => Date.parse(v) > Date.now() - 86400000,
        );
      if (attempts.length >= 400)
        throw new Error("Límite de envíos alcanzado.");
      const last = await tx.get("meetingSystem/test");
      if (last && Date.parse(last.at) > Date.now() - 60000)
        throw new Error("Espera un minuto antes de otra prueba.");
      tx.put("meetingSystem/budget", { attempts: [...attempts, at] });
      tx.put("meetingSystem/test", { at });
    });
    await gmailSender(env)(
      user.email,
      {
        subject: "Prueba de avisos · LS Asambleas",
        body: "La conexión de correo funciona. Los recordatorios usarán esta cuenta.",
        html: '<html lang="es"><p>La conexión de correo de LS Asambleas funciona.</p></html>',
      },
      saved,
    );
    await store.atomic(async (tx) => {
      const current = await tx.get("meetingSystem/sender");
      if (current?.encryptedToken === saved.encryptedToken)
        tx.put("meetingSystem/sender", { ...current, tested: true });
    });
    return json({ recipient: user.email });
  }
  if (url.pathname === "/sender/settings" && request.method === "POST") {
    const input = await parse(request);
    if (input.template) validateMeetingTemplate(input.template);
    await store.atomic(async (tx) => {
      const saved = (await tx.get("meetingSystem/sender")) || {};
      if (input.enabled && (!saved.encryptedToken || !saved.tested))
        throw new Error(
          "Conecta la cuenta y envía una prueba antes de activar.",
        );
      tx.put("meetingSystem/sender", {
        ...saved,
        ...(input.template ? { template: input.template } : {}),
        ...(typeof input.enabled === "boolean"
          ? { enabled: input.enabled }
          : {}),
      });
    });
    return json({ ok: true });
  }
  if (url.pathname === "/sender/disconnect" && request.method === "POST") {
    const old = await store.atomic(async (tx) => {
      const saved = await tx.get("meetingSystem/sender");
      tx.put("meetingSystem/sender", {
        email: "",
        enabled: false,
        tested: false,
        template: saved?.template || defaultMeetingTemplate,
      });
      return saved;
    });
    if (old?.encryptedToken)
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: await decrypt(old.encryptedToken, env.TOKEN_ENCRYPTION_KEY),
        }),
      }).catch(() => {});
    return json({ ok: true });
  }
  return json({ error: "Acción no disponible." }, 404);
}
export default {
  async fetch(request: Request, env: Env) {
    const origin = request.headers.get("Origin");
    const allowed = origin === env.APP_ORIGIN;
    if (origin && !allowed)
      return json({ error: "Origen no autorizado." }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": env.APP_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    let response: Response;
    try {
      response = await handle(request, env, makeStore(env));
    } catch (e) {
      response = json(
        {
          error:
            e instanceof Error
              ? e.message
              : "No se pudo completar la operación.",
        },
        e instanceof TourHttpError ? e.status : 400,
      );
    }
    const out = new Response(response.body, response);
    if (allowed) out.headers.set("Access-Control-Allow-Origin", env.APP_ORIGIN);
    out.headers.set("Vary", "Origin");
    return out;
  },
  async scheduled(_controller: unknown, env: Env) {
    const store: Store = makeStore(env),
      now = new Date().toISOString();
    const revision = await store.get("revisions/global"),
      seen = await store.get("meetingSystem/sync"),
      marker = JSON.stringify(revision);
    if (seen?.marker !== marker) {
      const pubs = await store.query(
        "meetingPublications",
        [{ field: "startsAt", op: "GREATER_THAN", value: now }],
        200,
      );
      for (let start = 0; start < pubs.length; start += 100) {
        const jobs = pubs
          .slice(start, start + 100)
          .filter((p) => p.status === "confirmed")
          .map((p) => ({ body: { kind: "audience" as const, id: p.id } }));
        if (jobs.length) await env.MEETING_QUEUE.sendBatch(jobs);
      }
      await store.atomic(async (tx) => {
        tx.put("meetingSystem/sync", { marker, at: now });
      });
    }
    const tasks = await store.query(
      "meetingTasks",
      [
        eq("status", "pending"),
        { field: "dueAt", op: "LESS_THAN_OR_EQUAL", value: now },
      ],
      100,
    );
    if (tasks.length)
      await env.MEETING_QUEUE.sendBatch(
        tasks.map((task) => ({ body: { kind: "task", id: task.id } })),
      );
    const sender = await store.get("meetingSystem/sender");
    for (const status of sender?.enabled
      ? ["pending", "retry", "sending"]
      : ["sending"]) {
      const jobs = await store.query(
        "meetingDeliveries",
        [
          eq("status", status),
          { field: "dueAt", op: "LESS_THAN_OR_EQUAL", value: now },
        ],
        100,
      );
      if (jobs.length)
        await env.MEETING_QUEUE.sendBatch(
          jobs.map((job) => ({ body: { id: job.id, kind: "delivery" } })),
        );
    }
  },
  async queue(
    batch: {
      messages: {
        body: QueueJob;
        ack(): void;
        retry(options?: { delaySeconds: number }): void;
      }[];
    },
    env: Env,
  ) {
    for (const message of batch.messages) {
      try {
        const now = new Date().toISOString(),
          store = makeStore(env);
        if (message.body.kind === "task")
          await dispatchTask(store, message.body.id, now);
        else if (message.body.kind === "audience")
          await syncAudience(store, message.body.id, now);
        else
          await deliver(
            store,
            message.body.id,
            env.APP_ORIGIN,
            gmailSender(env),
          );
        message.ack();
      } catch {
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};
