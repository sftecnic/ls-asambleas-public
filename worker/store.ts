export type RecordData = Record<string, any>;
export interface Filter {
  field: string;
  op: "EQUAL" | "GREATER_THAN" | "GREATER_THAN_OR_EQUAL" | "LESS_THAN_OR_EQUAL";
  value: unknown;
}
export interface Store {
  get(path: string): Promise<RecordData | null>;
  getMany(paths: string[]): Promise<(RecordData | null)[]>;
  query(
    collection: string,
    filters?: Filter[],
    limit?: number,
  ): Promise<RecordData[]>;
  put(path: string, value: RecordData): void;
  remove(path: string): void;
  atomic<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
}
export const utf8 = (s: string) => new TextEncoder().encode(s);
export const b64 = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export const un64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
export async function hash(s: string) {
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(s))));
}
export function encode(v: any): any {
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  switch (typeof v) {
    case "boolean":
      return { booleanValue: v };
    case "number":
      return Number.isInteger(v)
        ? { integerValue: String(v) }
        : { doubleValue: v };
    case "string":
      return { stringValue: v };
    case "object":
      return {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(v)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, encode(v)]),
          ),
        },
      };
    default:
      throw new Error("Valor no válido.");
  }
}
export function decode(v: any): any {
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v)
    return Object.fromEntries(
      Object.entries(v.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]),
    );
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  return v.stringValue ?? v.timestampValue;
}
export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}
export type AuthenticatedFetch = (
  url: string,
  body: unknown,
) => Promise<Response>;
let cached: { email: string; token: string; expires: number } | undefined;
export async function serviceToken(account: ServiceAccount) {
  if (
    cached?.email === account.client_email &&
    cached.expires > Date.now() + 60000
  )
    return cached.token;
  const now = Math.floor(Date.now() / 1000),
    head = b64(utf8(JSON.stringify({ alg: "RS256", typ: "JWT" }))),
    body = b64(
      utf8(
        JSON.stringify({
          iss: account.client_email,
          scope: "https://www.googleapis.com/auth/datastore",
          aud: "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        }),
      ),
    );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    un64(account.private_key.replace(/-----[^-]+-----|\s/g, "")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    utf8(head + "." + body),
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: head + "." + body + "." + b64(new Uint8Array(signature)),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result: any = await response.json();
  if (!response.ok)
    throw new Error("No se pudo conectar el servicio con Firebase.");
  cached = {
    email: account.client_email,
    token: result.access_token,
    expires: Date.now() + Number(result.expires_in) * 1000,
  };
  return cached.token;
}
/** Only used on the server. Every mutation is a Firestore transaction. */
export class FirestoreStore implements Store {
  private writes: any[] = [];
  private base: string;
  constructor(
    private account: ServiceAccount,
    private transaction?: string,
    private transport?: AuthenticatedFetch,
  ) {
    this.base = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents`;
  }
  private async request(suffix: string, body: any) {
    const r = this.transport
      ? await this.transport(this.base + suffix, body)
      : await fetch(this.base + suffix, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await serviceToken(this.account)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        });
    const json: any = await r.json();
    if (!r.ok) {
      const e = new Error(
        "Firebase no ha completado la operación.",
      ) as Error & { retry?: boolean };
      e.retry = json.error?.status === "ABORTED";
      throw e;
    }
    return json;
  }
  async get(path: string) {
    const rows = await this.request(":batchGet", {
      documents: [
        this.base.replace("https://firestore.googleapis.com/v1/", "") +
          "/" +
          path,
      ],
      ...(this.transaction ? { transaction: this.transaction } : {}),
    });
    const found = rows[0]?.found;
    return found
      ? {
          ...decode({ mapValue: { fields: found.fields } }),
          id: found.name.split("/").pop(),
        }
      : null;
  }
  async getMany(paths: string[]) {
    if (!paths.length) return [];
    const prefix =
      this.base.replace("https://firestore.googleapis.com/v1/", "") + "/";
    const rows = await this.request(":batchGet", {
      documents: paths.map((p) => prefix + p),
      ...(this.transaction ? { transaction: this.transaction } : {}),
    });
    const values = new Map(
      rows
        .filter((r: any) => r.found)
        .map((r: any) => [
          r.found.name,
          {
            ...decode({ mapValue: { fields: r.found.fields } }),
            id: r.found.name.split("/").pop(),
          },
        ]),
    );
    return paths.map(
      (p) => (values.get(prefix + p) || null) as RecordData | null,
    );
  }
  async query(collection: string, filters: Filter[] = [], limit = 500) {
    const conditions = filters.map((f) => ({
      fieldFilter: {
        field: { fieldPath: f.field },
        op: f.op,
        value: encode(f.value),
      },
    }));
    const result = await this.request(":runQuery", {
      structuredQuery: {
        from: [{ collectionId: collection }],
        ...(conditions.length
          ? {
              where:
                conditions.length === 1
                  ? conditions[0]
                  : { compositeFilter: { op: "AND", filters: conditions } },
            }
          : {}),
        limit,
      },
      ...(this.transaction ? { transaction: this.transaction } : {}),
    });
    return result
      .filter((r: any) => r.document)
      .map((r: any) => ({
        ...decode({ mapValue: { fields: r.document.fields } }),
        id: r.document.name.split("/").pop(),
      }));
  }
  put(path: string, value: RecordData) {
    if (!this.transaction)
      throw new Error("La escritura requiere una transacción.");
    this.writes.push({
      update: {
        name:
          this.base.replace("https://firestore.googleapis.com/v1/", "") +
          "/" +
          path,
        fields: encode(value).mapValue.fields,
      },
    });
  }
  remove(path: string) {
    if (!this.transaction)
      throw new Error("La escritura requiere una transacción.");
    this.writes.push({
      delete:
        this.base.replace("https://firestore.googleapis.com/v1/", "") +
        "/" +
        path,
    });
  }
  async atomic<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { transaction } = await this.request(":beginTransaction", {});
      const tx = new FirestoreStore(this.account, transaction, this.transport);
      try {
        const result = await fn(tx);
        await this.request(":commit", { transaction, writes: tx.writes });
        return result;
      } catch (e) {
        await this.request(":rollback", { transaction }).catch(() => {});
        if (!(e as any).retry || attempt === 3) throw e;
      }
    }
    throw new Error("Vuelve a intentarlo.");
  }
}
