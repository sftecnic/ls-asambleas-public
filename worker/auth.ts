import type { AppUser, Grant } from "../src/domain/types";
import type { Store } from "./store";
import { un64, utf8 } from "./store";
let keys: { values: any[]; expires: number } | undefined;
export async function authenticate(
  request: Request,
  projectId: string,
  store: Store,
): Promise<{ user: AppUser; grants: Grant[] }> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Inicia sesión para continuar.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Sesión no válida.");
  const header = JSON.parse(new TextDecoder().decode(un64(parts[0]))),
    claims = JSON.parse(new TextDecoder().decode(un64(parts[1])));
  if (
    header.alg !== "RS256" ||
    claims.aud !== projectId ||
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    claims.sub.length > 128 ||
    claims.email_verified !== true ||
    claims.firebase?.sign_in_provider !== "google.com" ||
    typeof claims.email !== "string" ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number" ||
    claims.exp <= Date.now() / 1000 ||
    claims.iat > Date.now() / 1000 + 60
  )
    throw new Error("Sesión no válida.");
  if (!keys || keys.expires < Date.now()) {
    const r = await fetch(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    );
    if (!r.ok) throw new Error("No se pudo verificar la sesión.");
    const json: any = await r.json();
    keys = { values: json.keys, expires: Date.now() + 3600000 };
  }
  const jwk = keys.values.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Renueva la sesión de Google.");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      un64(parts[2]),
      utf8(parts[0] + "." + parts[1]),
    ))
  )
    throw new Error("Sesión no válida.");
  const email = claims.email.toLowerCase();
  const grants = (
    await store.query("grants", [{ field: "email", op: "EQUAL", value: email }])
  ).filter(
    (g) => g.active && !g._deleted && (!g.uid || g.uid === claims.sub),
  ) as Grant[];
  if (!grants.length) throw new Error("Tu acceso ha sido retirado.");
  const primary =
    grants.find((g) => g.role === "admin") ||
    grants.find((g) => g.role !== "volunteer") ||
    grants[0];
  return {
    user: {
      uid: claims.sub,
      email,
      name: claims.name || email,
      personId: primary.personId,
      role: primary.role,
    },
    grants,
  };
}
