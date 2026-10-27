import CalendarSettings from './CalendarSettings';
import { useEffect, useState } from "react";
import { Mail, Link, Send, Unplug, Save, Check } from "lucide-react";
import { configured } from "../data/repository";
import { meetingRequest, meetingServiceUrl } from "../data/meetingApi";
import {
  defaultMeetingTemplate,
  meetingMailFields,
  validateMeetingTemplate,
} from "../domain/meetingMail";
import { ErrorMessage, Status } from "./UI";
import { useUnsavedChanges } from "./useUnsavedChanges";
type Sender = {
  email: string;
  connected: boolean;
  enabled: boolean;
  tested: boolean;
  template: typeof defaultMeetingTemplate;
};
export default function SenderSettings({ online }: { online: boolean }) {
  const [sender, setSender] = useState<Sender>({
      email: "",
      connected: false,
      enabled: false,
      tested: false,
      template: defaultMeetingTemplate,
    }),
    [template, setTemplate] = useState(defaultMeetingTemplate),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [oauthUrl, setOauthUrl] = useState("");
  const allowConnection = useUnsavedChanges(
    !oauthUrl && JSON.stringify(template) !== JSON.stringify(sender.template),
    !oauthUrl && busy,
  );
  // Navigate after React has removed the unload guard for this intentional exit.
  useEffect(() => {
    if (oauthUrl) window.location.assign(oauthUrl);
  }, [oauthUrl]);
  useEffect(() => {
    if (!configured) {
      setSender({
        email: "admin@example.test",
        connected: true,
        enabled: false,
        tested: false,
        template: defaultMeetingTemplate,
      });
      return;
    }
    if (!meetingServiceUrl) return;
    void meetingRequest<Sender>("/sender")
      .then((s) => {
        setSender({ ...s, template: s.template || defaultMeetingTemplate });
        setTemplate(s.template || defaultMeetingTemplate);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function action(
    kind: "connect" | "test" | "disconnect" | "settings",
    body: unknown = {},
  ) {
    if (!online || busy) return;
    if (kind === "connect" && !allowConnection()) return;
    if (
      kind === "disconnect" &&
      !window.confirm(
        "¿Desconectar el remitente? Los correos pendientes esperarán hasta conectar otra cuenta.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (kind === "settings") validateMeetingTemplate(template);
      if (!configured) {
        if (kind === "connect")
          setSender({
            ...sender,
            email: "admin@example.test",
            connected: true,
            tested: false,
            enabled: false,
          });
        if (kind === "disconnect")
          setSender({
            ...sender,
            email: "",
            connected: false,
            enabled: false,
            tested: false,
          });
        if (kind === "test") setSender({ ...sender, tested: true });
        if (kind === "settings")
          setSender({ ...sender, ...(body as Partial<Sender>) });
        setNotice("Demostración guardada. No se envían correos.");
        return;
      }
      const result = await meetingRequest<{ url?: string; recipient?: string }>(
        "/sender/" + kind,
        body,
      );
      if (result.url) {
        setOauthUrl(result.url);
        return;
      }
      const fresh = await meetingRequest<Sender>("/sender");
      setSender({
        ...fresh,
        template: fresh.template || defaultMeetingTemplate,
      });
      setNotice(
        kind === "test"
          ? `Prueba enviada a ${result.recipient}`
          : kind === "disconnect"
            ? "Cuenta desconectada"
            : "Cambios guardados",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const available = !configured || !!meetingServiceUrl;
  return (
    <div className="sender-settings">
      <ErrorMessage message={error} />
      {notice && (
        <div className="message" role="status">
          <Check size={22} />
          {notice}
        </div>
      )}
      {!available && (
        <div className="message info">
          Falta conectar el servicio gratuito de Cloudflare.
        </div>
      )}
      <div className="sender-account">
        <Mail size={30} aria-hidden="true" />
        <div>
          <strong>{sender.email || "Sin cuenta remitente"}</strong>
          <p>
            <Status kind={sender.enabled ? "good" : "draft"}>
              {sender.enabled
                ? "Envíos activos"
                : sender.connected
                  ? "Modo de prueba"
                  : "Desconectado"}
            </Status>
          </p>
        </div>
      </div>
      <div className="button-row">
        <button
          className="btn btn-primary"
          disabled={!online || busy || !available}
          onClick={() => void action("connect")}
        >
          <Link size={20} aria-hidden="true" />
          {sender.connected ? "Cambiar cuenta" : "Conectar Gmail"}
        </button>
        {sender.connected && (
          <>
            <button
              className="btn"
              disabled={!online || busy}
              onClick={() => void action("test")}
            >
              <Send size={20} aria-hidden="true" />
              Enviar prueba
            </button>
            <button
              className="btn btn-ghost"
              disabled={!online || busy}
              onClick={() => void action("disconnect")}
            >
              <Unplug size={20} aria-hidden="true" />
              Desconectar
            </button>
          </>
        )}
      </div>
      {sender.connected && (
        <>
          <p className="small">
            La prueba se envía solo a tu cuenta administradora.
          </p>
          <button
            className="btn"
            disabled={!online || busy || !sender.tested}
            onClick={() =>
              void action("settings", { enabled: !sender.enabled })
            }
          >
            {sender.enabled ? "Pausar envíos" : "Activar envíos"}
          </button>
        </>
      )}
      <details>
        <summary>Plantilla de reuniones</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action("settings", { template });
          }}
        >
          <fieldset disabled={!online || busy || !available}>
            <label className="field">
              Asunto
              <input
                value={template.subject}
                maxLength={250}
                onChange={(e) =>
                  setTemplate({ ...template, subject: e.target.value })
                }
              />
            </label>
            <label className="field">
              Mensaje
              <textarea
                value={template.body}
                maxLength={5000}
                onChange={(e) =>
                  setTemplate({ ...template, body: e.target.value })
                }
              />
            </label>
            <div
              className="button-row"
              aria-label="Insertar dato en el mensaje"
            >
              {meetingMailFields.map((field) => (
                <button
                  className="btn btn-ghost"
                  type="button"
                  key={field}
                  onClick={() =>
                    setTemplate({
                      ...template,
                      body: template.body + `{{${field}}}`,
                    })
                  }
                >
                  {field}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" type="submit">
              <Save size={20} aria-hidden="true" />
              Guardar plantilla
            </button>
          </fieldset>
        </form>
      </details>
      <p className="small">
        Límite de la aplicación: 400 correos en 24 horas. Cambiar el remitente
        conserva los envíos anteriores.
      </p>
    <CalendarSettings online={online}/></div>
  );
}
