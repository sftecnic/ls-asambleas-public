import {openOptions} from './ui-navigation';
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDemoData } from "../src/seed";
import { applyMeetingCommand } from "../src/domain/meetings";
import type { Meeting } from "../src/domain/types";

const m: Meeting = {
  id: "demo-meeting",
  eventId: "e1",
  departmentIds: ["video"],
  kind: "zoom",
  title: "Formación por Zoom",
  startsAt: "2027-03-10T18:00:00.000Z",
  duration: 60,
  location: "",
  address: "",
  zoomUrl: "https://zoom.us/j/123456789",
  instructions: "Prepara tus preguntas.",
  sessionDate: "2027-04-10",
  session: "morning",
  additionalPersonIds: [],
};
const admin = {
  uid: "demo-admin",
  email: "admin@example.test",
  personId: "p-admin",
  name: "Elena Vidal",
  role: "admin" as const,
};
test.beforeEach(async ({ page }) => {
  const data = createDemoData();
  data.candidates = data.candidates.map((c) => ({
    ...c,
    committee: "approved",
    availability: "accepted",
  }));
  const prepared = applyMeetingCommand(
    data,
    admin,
    { action: "confirm", meeting: m, expectedVersion: 0 },
    "2026-10-23T08:00:00.000Z",
  );
  await page.addInitScript((d) => {
    if (!localStorage.getItem("ls-asambleas:demo:v1"))
      localStorage.setItem("ls-asambleas:demo:v1", JSON.stringify(d));
  }, prepared);
  await page.goto("/");
});
async function meetings(page: import("@playwright/test").Page) {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("button", { name: "Agenda", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Agenda" })
    .getByRole("button", { name: "Reuniones", exact: true })
    .click();
  await page.getByRole("button", {name:"Lista", exact:true}).click();
}
test("prepara sin fecha, confirma, conserva borrador y recupera al recargar", async ({
  page,
}) => {
  await meetings(page);
  await page.getByRole("button", { name: "Añadir reunión" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título", { exact: true }).fill("Segunda formación");
  await dialog.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const record = page
    .locator(".meeting-record")
    .filter({ hasText: "Segunda formación" });
  await expect(record).toContainText("Por confirmar");
  await record.getByRole("button", { name: "Editar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Fecha y hora").fill("2027-03-20T19:00");
  await dialog.getByLabel("Duración · minutos").fill("60");
  await dialog.getByLabel("Enlace Zoom").fill("https://zoom.us/j/111222333");
  await dialog.getByRole("button", { name: "Revisar convocatoria" }).click();
  await expect(dialog).toContainText("personas convocadas");
  await dialog.getByRole("button", { name: "Confirmar y avisar" }).click();
  await expect(record).toContainText("Confirmada");
  await record.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Cambio privado");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(record).toContainText("Cambios sin confirmar");
  await page.reload();
  await meetings(page);
  await expect(
    page.locator(".meeting-record").filter({ hasText: "Segunda formación" }),
  ).toContainText("Confirmada");
});
test("enlace directo abre la última versión, y el voluntario no edita", async ({
  page,
}) => {
  await page.goto("/?evento=e1&reunion=demo-meeting");
  await expect(page.getByRole("dialog")).toContainText("Formación por Zoom");
  await expect(
    page.getByRole("link", { name: "Entrar en Zoom" }),
  ).toHaveAttribute("href", m.zoomUrl);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver voluntario", exact: true })
    .click();
  await meetings(page);
  await expect(
    page.getByRole("button", { name: "Añadir reunión" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Editar", exact: true }),
  ).toHaveCount(0);
});
test("orientación aparece en su departamento y bloque; borrador no aparece", async ({
  page,
}) => {
  await meetings(page);
  await page.getByRole("button", { name: "Añadir reunión" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Tipo", exact: true })
    .selectOption("orientation");
  await dialog.getByLabel("Fecha y hora").fill("2027-04-10T09:00");
  await dialog.getByLabel("Duración · minutos").fill("15");
  await dialog
    .getByLabel("Lugar / punto de encuentro")
    .fill("Acceso de plataforma");
  await dialog.getByRole("button", { name: "Revisar convocatoria" }).click();
  await dialog.getByRole("button", { name: "Confirmar y avisar" }).click();
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("button", { name: "Turnos", exact: true })
    .click();
  await expect(
    page
      .locator(".shift-session")
      .filter({ has: page.locator(".meeting-card") }),
  ).toHaveCount(1);
  await expect(page.locator(".meeting-card")).toContainText("Orientación");
});
test("cancelar requiere confirmación y conserva la reunión", async ({
  page,
}) => {
  await meetings(page);
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Cancelar reunión" }).click();
  await expect(page.locator(".meeting-record")).toContainText("Confirmada");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancelar reunión" }).click();
  await expect(page.locator(".meeting-record")).toContainText("Cancelada");
  await page.reload();
  await meetings(page);
  await expect(page.locator(".meeting-record")).toContainText("Cancelada");
});
test("remitente de prueba, plantilla editable y desconexión", async ({
  page,
}) => {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Avisos y correo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Activar envíos" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Enviar prueba" }).click();
  await page.getByRole("button", { name: "Activar envíos" }).click();
  await expect(page.locator(".sender-account")).toContainText("Envíos activos");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  await expect(page.locator(".sender-account")).toContainText("Desconectado");
});
test("cancelar el cambio de remitente conserva la plantilla sin guardar", async ({ page }) => {
  await page.getByRole("navigation", { name: "Principal" }).getByRole("button", { name: "Más", exact: true }).click();
  await page.getByRole("button", { name: "Avisos y correo", exact: true }).click();
  await page.getByText("Plantilla de reuniones", { exact: true }).click();
  await page.getByLabel("Asunto", { exact: true }).fill("Asunto pendiente de guardar");
  const dialogEvent = page.waitForEvent("dialog");
  const click = page.getByRole("button", { name: "Cambiar cuenta", exact: true }).click();
  const dialog = await dialogEvent;
  expect(dialog.type()).toBe("confirm");
  await dialog.dismiss();
  await click;
  await expect(page.getByLabel("Asunto", { exact: true })).toHaveValue("Asunto pendiente de guardar");
  await expect(page.getByText("Demostración guardada. No se envían correos.")).toHaveCount(0);
});

test("teclado, cierre y ampliación en el editor", async ({ page }) => {
  await meetings(page);
  const add = page.getByRole("button", { name: "Añadir reunión" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(add).toBeFocused();
  await page.setViewportSize({ width: 720, height: 1000 });
  await page.addStyleTag({ content: ":root{font-size:36px!important}" });
  await add.click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Guardar borrador" }),
  ).toBeInViewport();
});

test("la copia offline conserva reuniones confirmadas y excluye borradores", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.TEST_OFFLINE_BUILD !== "1",
    "Requiere compilación con service worker.",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await meetings(page);
  await page.getByRole("button", { name: "Añadir reunión" }).click();
  await page.getByLabel("Título", { exact: true }).fill("Borrador privado");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await openOptions(page); await page
    .getByRole("button", { name: "Guardar consulta", exact: true })
    .click();
  await page.getByLabel("Este dispositivo es de uso personal").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar consulta", exact: true })
    .click();
  await expect(
    page.getByText("Consulta guardada para usar sin conexión."),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText("Sin conexión · Solo consulta", { exact: true }),
  ).toBeVisible();
  await meetings(page);
  await expect(page.locator(".meeting-record")).toContainText(
    "Formación por Zoom",
  );
  await expect(page.getByText("Borrador privado")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Añadir reunión" }),
  ).toHaveCount(0);
  await expect(page.getByText(/Puede estar desactualizado/)).toBeVisible();
});

for (const width of [390, 820, 1440])
  test(`reuniones accesibles a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await meetings(page);
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `qa/meetings/reuniones-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Añadir reunión" }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `qa/meetings/editor-${width}.png`,
      fullPage: true,
    });
  });
