import { describe, it, expect } from "vitest";
import { FirestoreStore } from "../worker/store";
const run = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
run("Transporte real del servicio de reuniones", () => {
  const store = new FirestoreStore(
    { project_id: "demo-meeting-service", client_email: "", private_key: "" },
    undefined,
    (url, body) =>
      fetch(
        url.replace(
          "https://firestore.googleapis.com",
          "http://" + process.env.FIRESTORE_EMULATOR_HOST,
        ),
        {
          method: "POST",
          headers: {
            Authorization: "Bearer owner",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      ),
  );
  it("mantiene lecturas, escrituras y consultas en una transacción REST", async () => {
    const id = crypto.randomUUID(),
      path = "meetingTasks/" + id;
    await store.atomic(async (tx) => {
      expect(await tx.get(path)).toBeNull();
      tx.put(path, {
        id,
        status: "pending",
        dueAt: "2026-10-24T18:00:00.000Z",
        nested: { version: 1, recipients: ["one", "two"], empty: null },
        enabled: true,
      });
    });
    expect((await store.get(path))?.nested).toEqual({
      version: 1,
      recipients: ["one", "two"],
      empty: null,
    });
    const rows = await store.getMany(["meetingTasks/missing", path]);
    expect(rows[0]).toBeNull();
    expect(rows[1]?.id).toBe(id);
    expect(
      (
        await store.query("meetingTasks", [
          { field: "status", op: "EQUAL", value: "pending" },
          {
            field: "dueAt",
            op: "LESS_THAN_OR_EQUAL",
            value: "2026-10-25T00:00:00.000Z",
          },
        ])
      ).some((r) => r.id === id),
    ).toBe(true);
    await expect(
      store.atomic(async (tx) => {
        tx.put(path, { id, status: "broken" });
        throw new Error("cancelled");
      }),
    ).rejects.toThrow("cancelled");
    expect((await store.get(path))?.status).toBe("pending");
    await store.atomic(async (tx) => {
      await tx.get(path);
      tx.remove(path);
    });
    expect(await store.get(path)).toBeNull();
  }, 30000);
});
