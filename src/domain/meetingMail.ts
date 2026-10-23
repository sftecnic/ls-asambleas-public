import type { AssemblyEvent, MeetingPublication } from "./types";
import { meetingLabels, meetingWhen } from "./meetings";
export type DeliveryReason =
  | "invitation"
  | "changed"
  | "cancelled"
  | "previous-day"
  | "one-hour";
export const reasonLabels: Record<DeliveryReason, string> = {
  invitation: "Reunión confirmada",
  changed: "Reunión actualizada",
  cancelled: "Reunión cancelada",
  "previous-day": "Mañana tienes una reunión",
  "one-hour": "Tu reunión empieza en una hora",
};
export const defaultMeetingTemplate = {
  subject: "{{aviso}} · {{reunion}} · {{evento}}",
  body: "Hola {{nombre}}:\n\n{{aviso}}.\n\n{{reunion}}\n{{fecha}}\n{{lugar}}\n\n{{instrucciones}}\n\nGracias por tu colaboración.\nEquipo de LS Asambleas",
};
export const meetingMailFields = [
  "aviso",
  "nombre",
  "evento",
  "reunion",
  "fecha",
  "lugar",
  "instrucciones",
  "enlace",
];
export function validateMeetingTemplate(t: { subject: string; body: string }) {
  if (
    typeof t.subject !== "string" ||
    typeof t.body !== "string" ||
    !t.subject.trim() ||
    !t.body.trim() ||
    t.subject.length > 250 ||
    t.body.length > 5000 ||
    /[\r\n]/.test(t.subject) ||
    [...`${t.subject} ${t.body}`.matchAll(/\{\{([^{}]+)\}\}/g)].some(
      (m) => !meetingMailFields.includes(m[1].trim()),
    )
  )
    throw new Error("Revisa el asunto, mensaje y datos automáticos.");
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function renderMeetingMail(
  m: MeetingPublication,
  event: AssemblyEvent,
  name: string,
  reason: DeliveryReason,
  origin: string,
  template = defaultMeetingTemplate,
) {
  validateMeetingTemplate(template);
  const link = `${origin}/?evento=${encodeURIComponent(m.eventId)}&reunion=${encodeURIComponent(m.id)}`;
  const values: Record<string, string> = {
    aviso: reasonLabels[reason],
    nombre: name,
    evento: event.title,
    reunion: m.title || meetingLabels[m.kind],
    fecha: meetingWhen(m, event.timezone),
    lugar:
      m.kind === "zoom"
        ? "Zoom"
        : `${m.location}${m.address ? " · " + m.address : ""}`,
    instrucciones: m.instructions,
    enlace: link,
  };
  const fill = (s: string) =>
    s.replace(
      /\{\{\s*([^{}]+?)\s*\}\}/g,
      (_, key: string) => values[key] || "",
    );
  const subject = fill(template.subject)
      .replace(/[\r\n]+/g, " ")
      .slice(0, 300),
    body = fill(template.body);
  return {
    subject,
    body: body + "\n\nVer reunión: " + link,
    html: `<!doctype html><html lang="es"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:18px;color:#172b4d;background:#f3f6fa;padding:24px"><main style="max-width:600px;margin:auto;background:white;padding:28px"><h1 style="font-size:26px">${escape(reasonLabels[reason])}</h1><p style="white-space:pre-line;line-height:1.6">${escape(body)}</p><p><a style="display:inline-block;background:#1d4ed8;color:white;padding:16px 22px;text-decoration:none;border-radius:8px" href="${escape(link)}">Ver reunión</a></p></main></body></html>`,
  };
}
