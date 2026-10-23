import { b64, un64, utf8, type RecordData } from "./store";
import { MailError, type SendMail } from "./service";
export interface MailEnv {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
}
export async function encrypt(text: string, key: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await crypto.subtle.importKey("raw", un64(key), "AES-GCM", false, [
    "encrypt",
  ]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    k,
    utf8(text),
  );
  return b64(iv) + "." + b64(new Uint8Array(encrypted));
}
export async function decrypt(text: string, key: string) {
  const [iv, body] = text.split(".");
  const k = await crypto.subtle.importKey("raw", un64(key), "AES-GCM", false, [
    "decrypt",
  ]);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: un64(iv) },
      k,
      un64(body),
    ),
  );
}
export const gmailSender =
  (env: MailEnv): SendMail =>
  async (recipient, mail, sender) => {
    let tokenResponse: Response;
    try {
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: await decrypt(
            sender.encryptedToken,
            env.TOKEN_ENCRYPTION_KEY,
          ),
          grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new MailError("No se pudo conectar con Google.", "retry");
    }
    const token: any = await tokenResponse.json();
    if (!tokenResponse.ok)
      throw new MailError(
        "Vuelve a conectar la cuenta remitente.",
        tokenResponse.status >= 500 ? "retry" : "permanent",
      );
    const boundary = "ls_" + crypto.randomUUID();
    const encodedSubject = btoa(String.fromCharCode(...utf8(mail.subject)));
    const raw = [
      `From: LS Asambleas <${sender.email}>`,
      `To: ${recipient}`,
      `Subject: =?UTF-8?B?${encodedSubject}?=`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      btoa(String.fromCharCode(...utf8(mail.body))),
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      btoa(String.fromCharCode(...utf8(mail.html))),
      `--${boundary}--`,
    ].join("\r\n");
    let response: Response;
    try {
      response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: b64(utf8(raw)) }),
          signal: AbortSignal.timeout(20000),
        },
      );
    } catch {
      throw new MailError(
        "Gmail no confirmó el envío. Revisa Enviados.",
        "uncertain",
      );
    }
    if (response.status === 429)
      throw new MailError(
        "Google ha limitado los envíos. Se volverá a intentar.",
        "retry",
        3600000,
      );
    if (response.status >= 500)
      throw new MailError(
        "Google no confirmó el envío. Revisa Enviados.",
        "uncertain",
      );
    if (!response.ok)
      throw new MailError(
        "Google rechazó el envío. Revisa la cuenta y el destinatario.",
        "permanent",
      );
    const result: any = await response.json();
    if (!result.id)
      throw new MailError("No hay confirmación del envío.", "uncertain");
    return { id: result.id };
  };
export function senderPublic(sender: RecordData | null) {
  return {
    email: sender?.email || "",
    connected: !!sender?.encryptedToken,
    enabled: !!sender?.enabled,
    tested: !!sender?.tested,
    template: sender?.template,
    connectedAt: sender?.connectedAt || "",
  };
}
