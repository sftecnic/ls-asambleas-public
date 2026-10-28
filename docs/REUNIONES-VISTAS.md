# Reuniones: mes y lista · 0.9.0

## Consultar

En **Agenda → Reuniones**, elige **Mes** o **Lista**. Las dos vistas usan las mismas convocatorias y abren el detalle habitual: fecha, lugar, conexión Zoom, invitación y respuestas. Cambiar de vista no guarda datos ni envía invitaciones.

- Ordenador desde 1100 px: inicialmente Mes. En pantallas menores: Lista.
- Mes empieza en lunes. Anterior, Siguiente y Hoy cambian el mes. Inicialmente se muestra la próxima reunión (incluidas las que están en curso), la última si todas han pasado, o el mes de la asamblea si no hay fechas.
- Seleccionar un día muestra todas sus reuniones debajo. **Todo el mes** vuelve al conjunto. Si no caben siete controles de 48 px, la cuadrícula es informativa; las acciones permanecen en la lista inferior.
- Lista agrupa cronológicamente por fecha completa. Las reuniones canceladas permanecen identificadas y las que están celebrándose indican **En curso**.
- **Sin fecha** reúne los borradores autorizados fuera de la cuadrícula. Una reunión confirmada mantiene su fecha y departamentos publicados mientras los cambios sigan en borrador; se muestra una sola vez.

La vista elegida, el mes, el día seleccionado, los filtros y la posición de consulta se conservan durante la sesión por usuario y asamblea. Cerrar sesión borra esta memoria. Los enlaces existentes a una reunión siguen abriendo su detalle.

## Ámbito y permisos

**Esta asamblea** es el ámbito inicial. **Todas las asambleas** reúne únicamente convocatorias autorizadas de eventos no archivados. Cada ficha identifica asamblea y localidad. Se usa la zona horaria de la asamblea seleccionada, indicada expresamente en la vista conjunta.

La consulta conjunta no permite preparar, editar ni confirmar convocatorias. **Abrir asamblea** conduce al evento correspondiente, donde se aplican los permisos habituales. La respuesta de Calendar puede consultarse sin modificar invitaciones.

Los voluntarios ven exclusivamente sus convocatorias autorizadas. Quienes gestionan reuniones conservan sus ámbitos existentes. Esta versión no modifica permisos, modelos persistentes, reglas, API, Worker ni integraciones.

## Sin conexión e impresión

Sin conexión solo aparecen las reuniones publicadas incluidas en la copia descargada. La cabecera identifica la asamblea y la fecha de actualización de la copia. Todas las asambleas requiere conexión; los borradores y los contactos privados no se incorporan a la consulta guardada.

**Opciones → Imprimir** imprime una lista por días de las reuniones publicadas del ámbito y departamento seleccionados, con sus versiones, datos de conexión e instrucciones. No imprime la cuadrícula ni borradores, controles de gestión o respuestas privadas. Cambiar de Mes a Lista no es necesario para imprimir.

## Comprobación reproducible

```sh
npm ci
npm run skills:check
npm test
npm run test:installation
npm run check:worker
npm run build
npm run dev:demo
```

En otra terminal: `npx playwright test tests/meeting-schedule.e2e.spec.ts tests/meetings.e2e.spec.ts tests/calendar.e2e.spec.ts`. En PowerShell usa `npm.cmd` y `npx.cmd`. Define `PLAYWRIGHT_CHANNEL=msedge` para usar Edge instalado, o instala Chromium de Playwright. `PLAYWRIGHT_BASE_URL` debe apuntar exclusivamente a una demostración con datos ficticios.

La prueba sin conexión se habilita con `TEST_OFFLINE_BUILD=1` contra una compilación de demostración con service worker. La distribución pública limpia no contiene configuración Firebase y permite construirla sin cuentas ni secretos. No uses una compilación de producción con datos reales para estas pruebas.

Las capturas ficticias del desarrollo se guardan en `qa/meeting-schedule/`: Mes y Lista a 320, 390, 820 y 1440 px. Las pruebas cubren teclado, foco, ampliación del 200 %, contraste automatizado, filtros, regreso a la consulta, eventos simultáneos, borradores, cancelaciones, privacidad, impresión y desconexión. Las pruebas de fechas incluyen el cambio de hora.

## Validación con participantes pendiente

Las comprobaciones técnicas no demuestran comprensión sin instrucciones. Queda pendiente pedir a participantes representativos que identifiquen día, hora y asamblea, distingan confirmación de borrador y abran la conexión. Recoger las dificultades y revisar cualquier confusión repetida.

## Evidencia técnica · 28 de octubre de 2026

- Código mantenido: 242 pruebas unitarias y tres de instalación correctas; compilación y tipos del Worker correctos. Las 34 pruebas que necesitan Firestore Emulator quedaron omitidas porque no cambian las reglas.
- Distribución limpia: instalación de las dependencias fijadas, 233 pruebas unitarias, tres de instalación, siete de las skills, verificación de los 143 archivos de skills y compilación correctas. Auditoría de dependencias: sin vulnerabilidades notificadas.
- Navegador Edge con datos ficticios: 36 casos funcionales y visuales distintos correctos entre reuniones, Calendar simulado, Inicio, navegación, formularios, asistencia, impresión y las nuevas vistas. Incluye las dos pruebas de consulta offline ejecutadas sobre la compilación pública.
- Capturas a 320, 390, 820 y 1440 px; teclado, foco, objetivos de 48 px y texto al 200 %. La revisión automatizada de contraste y accesibilidad no notificó infracciones en las pantallas examinadas. Se revisaron visualmente las capturas y se corrigieron etiquetas partidas en móvil.
- No se enviaron invitaciones ni correos a personas reales. No se alteraron reuniones, turnos, permisos, reglas ni datos de producción durante las pruebas. Las pruebas móviles usan ventanas del navegador; la comprensión con participantes y los dispositivos físicos se validan aparte.

## Publicación

Actualizar esta versión requiere únicamente Hosting. Conservar la versión anterior de Hosting y comprobar destino y Spark sin facturación antes de desplegar. No se necesitan cambios de Firebase, Cloudflare, Gmail o Calendar. La distribución pública se prepara desde el mismo código mediante `npm run release:prepare`.
