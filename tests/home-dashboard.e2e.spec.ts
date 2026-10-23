import {openOptions} from './ui-navigation';
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDemoData } from "../src/seed";
import type { MeetingPublication } from "../src/domain/types";

function fixture() {
  const data = createDemoData();
  data.events[0].endDate = "2027-04-11";
  data.candidates.push({
    ...data.candidates[0],
    id: "own",
    personId: "p-admin",
    teamRole: "assistant",
  });
  data.shifts[0].personId = "p-admin";
  data.publications[0].shifts[0].personId = "p-admin";
  data.shifts.push({
    ...data.shifts[0],
    id: "early-makeup",
    personId: "p5",
    departmentId: "makeup",
    role: "Maquillaje",
    startsAt: "2027-04-10T06:00:00.000Z",
  });
  data.shifts.push(
    { ...data.shifts[0], id: "absence", personId: "p6", attendance: "absent" },
    {
      ...data.shifts[0],
      id: "absence-tomorrow",
      personId: "p6",
      attendance: "absent",
      startsAt: "2027-04-11T08:00:00.000Z",
      endsAt: "2027-04-11T10:00:00.000Z",
    },
  );
  const m: MeetingPublication = {
    id: "personal",
    eventId: "e1",
    departmentIds: ["makeup"],
    kind: "zoom",
    title: "Reunión personal de otro departamento",
    startsAt: "2027-04-09T18:00:00.000Z",
    duration: 60,
    zoomUrl: "https://zoom.us/j/123456789",
    location: "",
    address: "",
    instructions: "Trae tus preguntas.",
    sessionDate: "2027-04-10",
    session: "morning",
    additionalPersonIds: [],
    version: 1,
    status: "confirmed",
    publishedAt: "2027-03-01T10:00:00Z",
    publishedBy: "Elena",
    recipientIds: ["p-admin"],
  };
  data.meetingPublications = [m];
  const { version, status, publishedAt, publishedBy, recipientIds, ...draft } =
    m;
  data.meetings = [
    {
      ...draft,
      id: "draft",
      title: "Preparación de vídeo",
      departmentIds: ["video"],
      startsAt: "",
    },
  ];
  return data;
}
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("button", { name, exact: true });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2027-04-09T10:00:00Z") });
  await page.addInitScript((data) => {
    if (!localStorage.getItem("ls-asambleas:demo:v1"))
      localStorage.setItem("ls-asambleas:demo:v1", JSON.stringify(data));
  }, fixture());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Inicio", exact: true }),
  ).toBeVisible();
});
test("abre el departamento propio, mantiene agenda y recuerda selección por evento y usuario", async ({
  page,
}) => {
  await expect(
    page.getByLabel("Ámbito de Inicio", { exact: true }),
  ).toHaveValue("mine");
  await expect(page.locator(".home-department h3")).toHaveText([
    "Audio y vídeo",
  ]);
  await expect(page.locator(".hero-shift")).toHaveCount(0);
  await expect(page.locator(".home-personal")).toContainText(
    "Reunión personal de otro departamento",
  );
  await page
    .getByLabel("Ámbito de Inicio", { exact: true })
    .selectOption("makeup");
  await expect(page.locator(".home-personal")).toContainText(
    "Reunión personal de otro departamento",
  );
  await nav(page, "Equipo").click();
  await nav(page, "Inicio").click();
  await expect(
    page.getByLabel("Ámbito de Inicio", { exact: true }),
  ).toHaveValue("makeup");
  await page.reload();
  await expect(
    page.getByLabel("Ámbito de Inicio", { exact: true }),
  ).toHaveValue("makeup");
  await page.getByLabel("Elegir evento").selectOption("e2");
  await expect(
    page.getByLabel("Ámbito de Inicio", { exact: true }),
  ).toHaveValue("all");
  await expect(page.locator(".home-personal")).not.toContainText(
    "Reunión personal",
  );
  await page.getByLabel("Elegir evento").selectOption("e1");
  await expect(
    page.getByLabel("Ámbito de Inicio", { exact: true }),
  ).toHaveValue("makeup");
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Abrir demostración" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((k) =>
        k.startsWith("ls-asambleas:home-scope:"),
      ),
    ),
  ).toEqual([]);
});
test("pendientes abren los registros exactos, incluidos varios días, y los enlaces conservan el departamento", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Ausencias sin sustitución 2" })
    .click();
  await expect(page.locator(".shift-card")).toHaveCount(2);
  await expect(page.locator(".shift-department h2")).toContainText([
    "10 de abril",
    "11 de abril",
  ]);
  await page.getByRole("button", { name: "Quitar filtro" }).click();
  await expect(page.getByLabel("Departamento", { exact: true })).toHaveValue(
    "video",
  );
  await nav(page, "Inicio").click();
  await page.getByRole("button", { name: "Aprobación del comité 1" }).click();
  await expect(page.locator(".team-person-card")).toHaveCount(1);
  await expect(page.locator(".team-person-card")).toContainText("David Romero");
  await nav(page, "Inicio").click();
  await page.getByRole("button", { name: "Reuniones por confirmar 1" }).click();
  await expect(page.locator(".meeting-record")).toHaveCount(1);
  await expect(page.locator(".meeting-record")).toContainText(
    "Preparación de vídeo",
  );
  await nav(page, "Inicio").click();
  await page.getByRole("button", { name: "Turnos por publicar 1" }).click();
  await expect(page.locator(".shift-card")).toHaveCount(1);
  await expect(page.locator(".shift-card")).toContainText("Vídeo");
  await nav(page, "Inicio").click();
  await page.getByRole("button", { name: "Revisar material" }).click();
  await expect(page.locator(".program-row")).toHaveCount(1);
  await expect(page.locator(".program-row")).toContainText("Aprendamos juntos");
  await nav(page, "Inicio").click();
  await page
    .locator(".home-department")
    .getByRole("button", { name: "Equipo", exact: true })
    .click();
  await expect(page.getByLabel("Departamento del equipo")).toHaveValue("video");
});
test("consulta publicada y offline omiten gestión y mantienen reuniones y cargos disponibles", async ({
  page,
  context,
}) => {
  await openOptions(page); await page
    .getByRole("button", { name: "Ver publicado", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Requiere atención" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Sin pendientes registrados", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".home-team-counts")).toHaveCount(0);
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
  await expect(
    page.getByText("Sin conexión · Solo consulta", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Requiere atención" }),
  ).toHaveCount(0);
  await expect(page.locator(".home-personal")).toContainText(
    "Reunión personal de otro departamento",
  );
});
test("móvil, tableta, ordenador, teclado y ampliación", async ({ page }) => {
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.map((v) => v.id),
    ).toEqual([]);
    await page.screenshot({
      path: `qa/home-dashboard/home-${width}.png`,
      fullPage: true,
    });
  }
  const instructions = page.getByRole("button", {
    name: "Instrucciones",
    exact: true,
  });
  await instructions.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Instrucciones" }),
  ).toContainText("Titular");
  await page.keyboard.press("Escape");
  await expect(instructions).toBeFocused();
  await page.setViewportSize({ width: 720, height: 1000 });
  await page.addStyleTag({ content: ":root{font-size:36px!important}" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
