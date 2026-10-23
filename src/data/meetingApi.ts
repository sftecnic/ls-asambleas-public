import { getAuth } from "firebase/auth";
import type { AppData } from "../domain/types";
export const meetingServiceUrl = (
  import.meta.env.VITE_MEETING_SERVICE_URL || ""
).replace(/\/$/, "");
export let meetingServiceError = "";
export async function loadMeetingData(): Promise<
  Pick<AppData, "meetings" | "meetingPublications">
> {
  meetingServiceError = "";
  if (meetingServiceUrl)
    try {
      return await meetingRequest("/meetings");
    } catch (e) {
      meetingServiceError =
        "No se pudieron consultar las reuniones. " + (e as Error).message;
    }
  return { meetings: [], meetingPublications: [] };
}
export async function meetingRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  if (!navigator.onLine)
    throw new Error("Conecta a internet para gestionar reuniones.");
  if (!meetingServiceUrl)
    throw new Error("El servicio de reuniones está pendiente de conectar.");
  const current = getAuth().currentUser;
  if (!current) throw new Error("Vuelve a iniciar sesión.");
  const response = await fetch(meetingServiceUrl + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${await current.getIdToken()}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(body===undefined?10000:25000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se ha completado. Inténtalo de nuevo.");
  return result;
}
