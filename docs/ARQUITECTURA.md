# Arquitectura y desarrollo

React + TypeScript + Vite sirven la aplicación estática desde Hosting clásico. Authentication identifica a la cuenta Google; Firestore guarda datos y comprueba permisos. Un Worker de Cloudflare con cron y cola gestiona reuniones y Gmail OAuth/envío. Drive aporta enlaces; no se utiliza Firebase Storage.

| Ruta | Responsabilidad |
|---|---|
| src/domain | Modelos, permisos, publicación, turnos, reuniones, histórico y validación Excel |
| src/components, src/styles | Pantallas y sistema visual compartido |
| src/data/repository.ts | Persistencia demo/Firebase, contactos separados, revisiones y transacciones |
| src/domain/excelSchema.ts | Contrato versionado de las ocho hojas y valores válidos |
| src/domain/excelImport.ts | Comparación, incidencias, resoluciones, lotes y dependencias de versión |
| src/domain/excel.worker.ts, excelFiles.ts | Lectura/exportación XLSX aislada y con límites |
| worker | Endpoint autenticado, programación, cola, Gmail y cifrado del remitente |
| firestore.rules, firestore.indexes.json | Autorización y consultas |
| scripts/installation-lib.mjs | Configuración sin destinos heredados, CLI fijadas y comprobación de coste |
| public/templates | Plantilla vacía y ejemplo ficticio versionados |
| src/domain/tours.ts, src/components/Tour* | Catálogo por sede/departamento, visor 360° bajo demanda y fotos ampliables |
| worker/tours.ts | Autorización de cada imagen y entrega desde Static Assets privados |
| src/domain/whatsapp.ts, src/components/PersonContact.tsx | Formato de enlaces, botón compartido y contactos departamentales solo en memoria |
| worker/contacts.ts | Proyección de lectura de responsables y auxiliares, con permisos actuales y sin documentos privados completos |

Los [recorridos](RECORRIDOS.md) no alteran Firestore. El catálogo y las fotos se despliegan juntos detrás del Worker, que verifica los permisos vigentes por evento y departamento antes de cada respuesta. `run_worker_first: true` es obligatorio. La distribución pública contiene un catálogo vacío y escenas ficticias. El visor se descarga solo al abrirlo y sus imágenes no forman parte del almacenamiento offline.

Los cargos del equipo y las capacidades de acceso son distintos. La aprobación del comité y la aceptación del voluntario también. Las publicaciones son instantáneas operativas; cambiar un borrador no modifica una versión publicada. Los datos privados se mantienen separados de esas instantáneas y de la consulta offline.

`personService.ts` define el [servicio actual privado](SERVICIO-PERSONAS.md): nombramiento y precursorado opcionales, validación conjunta de SC/No aplica y siglas positivas. `PersonContactActions` antepone el distintivo al grupo de contactos solo con acceso a la ficha privada. Las leyendas comparten interacción de ratón, teclado y toque. El repositorio separa ambos campos en `personContacts`, conserva valores anteriores en guardados y las reglas impiden omitir campos ya registrados. Editarlos exige contactos y edición en el mismo ámbito; no cambia la lectura operativa ni la proyección del Worker para voluntarios. Excel añade dos columnas opcionales sin modificar la versión EXCEL 1. No hay migración ni índices nuevos.

Los [contactos de WhatsApp](WHATSAPP.md) reutilizan el teléfono de la ficha. Los permisos privados siguen vigentes; el voluntario recibe una proyección limitada de responsables y auxiliares aprobados y aceptados de sus departamentos, independiente de las publicaciones. No se enlazan personas por el texto del nombre. El endpoint de lectura se ofrece en ambas entradas del Worker y no cambia reglas, datos, correo ni esquema.

La consulta nueva pide `include=hearingStatus` para añadir la clasificación al contacto. Sin ese parámetro se conserva la respuesta antigua. `ContactIcons` mantiene los pictogramas, etiquetas táctiles/de teclado y cierre accesible; `PersonContactActions` mantiene la pareja clasificación/WhatsApp unida, separada del encabezado semántico. La información no se copia a publicaciones ni a almacenamiento persistente.

La importación lee localmente y valida toda la selección, luego guarda por dependencias en lotes pequeños. Cada lote comprueba versiones de filas y referencias utilizadas. La reserva de horarios sigue siendo transaccional. Si un lote falla, no se anuncia rollback de los ya guardados: la revisión posterior permite retomar por identificadores.

## Pruebas

Calendar añade `calendarLinks` (versiones, correspondencia Google, audiencia/respuestas), `calendarDrafts` (cambios de asamblea aún no confirmados), `calendarSystem` (conexión cifrada y cuotas) y `calendarResponseHistory` (instante de detección). Son documentos exclusivos del servidor. Los endpoints proyectan solo las respuestas autorizadas y comprueban versiones y capacidades. `worker/calendar.ts` controla publicación, conflictos, deduplicación y sincronización; `calendarGoogle.ts` transporta solicitudes únicamente al calendario principal propio. La cola reparte la consulta cada cinco minutos por convocatoria. Las invitaciones no se crean al importar/restaurar datos. Consulta [CALENDAR.md](CALENDAR.md).

La congregación guarda un circuito operativo opcional. El SC guarda `serviceCircuit` en `personContacts`, con congregación vacía y precursorado No aplica en la misma operación. Las reglas conservan campos de clientes anteriores y bloquean la edición directa de eventos con convocatoria vigente. Publicaciones y consulta offline excluyen el circuito de servicio privado. No son necesarios índices compuestos nuevos.

`npm test` ejecuta las pruebas unitarias; las de Firebase que requieren emulador se omiten si no está configurado y deben ejecutarse antes de modificar reglas. `npm run test:installation` verifica destinos y reanudación local. `npm run check:worker` comprueba tipos del servidor.

Para navegador instala Playwright Chromium (`npx playwright install chromium`), inicia Vite en un puerto libre y establece `PLAYWRIGHT_BASE_URL`. `PLAYWRIGHT_CHANNEL` permite elegir Edge si está instalado. Ejecuta `npm run test:e2e`. Los datos deben ser ficticios. Para reglas, instala Java compatible con el emulador y arráncalo con la configuración local de un proyecto de demostración, nunca con escrituras a producción.

## Distribución pública

`npm run release:prepare -- --out RUTA_NUEVA` prepara una carpeta nueva mediante lista permitida. Copia código común y recursos ficticios, no historial ni configuraciones privadas. Los scripts de importaciones históricas/migraciones particulares no forman parte de la distribución. El manifiesto contiene hashes para verificar el paquete. Revisa además contenido y secretos antes de crear el commit público.

No mantengas una segunda aplicación divergente: corrige el código mantenido y vuelve a generar la distribución. Conserva licencias y avisos de terceros. Las autorizaciones OAuth y propiedad cloud siempre son propias de cada organización.
