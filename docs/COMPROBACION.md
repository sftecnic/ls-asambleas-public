# Lista final de puesta en marcha

Anota fecha, versión, proyecto y quién comprueba cada casilla en una copia privada. No marques un paso solo por leer esta guía. Usa personas ficticias y correos de prueba expresamente autorizados.

## Infraestructura

- [ ] Node 24, `npm ci`, pruebas y build correctos desde una copia limpia.
- [ ] `installation.local.json`, Firebase, Worker, OAuth y dominio pertenecen a la misma instalación.
- [ ] Firebase Spark, sin cuenta de facturación; Firestore Standard.
- [ ] Cloudflare Workers y Queues Free, sin suscripción de pago.
- [ ] Reglas e índices desplegados; índices READY.
- [ ] Worker `/health` correcto, cola vinculada y cron cada minuto.
- [ ] Cuatro secretos presentes en Cloudflare; ningún secreto en Git, logs o VITE.

## Acceso y datos

- [ ] Administrador explícito entra en el dominio canónico; una cuenta sin permiso no obtiene datos.
- [ ] Voluntario autorizado ve únicamente ámbitos y publicaciones permitidos; los contactos se limitan a nombre, teléfono y clasificación Sorda/Oyente/Sin indicar de responsables/auxiliares aprobados y aceptados de sus departamentos, sin fichas privadas completas.
- [ ] Cerrar sesión y cambiar de usuario no permite ver la copia privada del anterior.
- [ ] Importar ejemplo vacío, altas, cambios, blancos, coincidencia de nombres y reimportación funciona.
- [ ] Se conservan identificadores, histórico y publicaciones previas; los cambios quedan en borrador.
- [ ] Los accesos posteriores son solo consulta; un cargo no concede permisos.
- [ ] Servicio actual: SC guarda No aplica; filtros distinguen Anciano de SC; los libros anteriores conservan los campos al actualizar. Solo los lectores privados ven las siglas y la leyenda dice Condición actual en Histórico.
- [ ] Los campos de servicio no aparecen para voluntarios, impresión ni consulta offline. Una ficha guardada no pierde esos campos por un cliente antiguo; se recarga para editarla.
- [ ] Móvil, teclado, texto grande y escritorio permiten revisar y corregir.

## Correo y reuniones

- [ ] Gmail remitente correcto, OAuth publicado o estado temporal documentado; no se confunde con Authentication.
- [ ] La prueba llega solo al administrador autorizado y muestra el remitente correcto.
- [ ] Una reunión ficticia con solo el administrador genera aviso interno y correo.
- [ ] Modificar/cancelar invalida recordatorios de la versión anterior.
- [ ] Se observa un recordatorio una hora antes, con el navegador cerrado.
- [ ] Se observa el de víspera a las 20:00 en la zona del evento, sin destinatarios reales.
- [ ] Los estados Pendiente/Enviado/Error/Sin correo tienen el significado esperado; un resultado incierto no se reenvía automáticamente.
- [ ] El consumo de Firestore, Workers, Queues y Gmail se mantiene dentro de cuotas.

- [ ] Calendar API habilitada, conexión independiente probada y cuenta organizadora correcta; tokens sin exponer.
- [ ] Convocatoria ficticia revisada antes de confirmar, sin invitados reales; respuestas Sí/No/Quizás/Sin respuesta y última comprobación visibles con los permisos esperados.
- [ ] Calendar envía invitación/cambio/cancelación y Gmail solo los recordatorios correspondientes; no hay correo inicial duplicado.
- [ ] No impide recordatorios futuros, sin modificar turnos ni asistencia; cambios externos de Google producen conflicto revisable.
- [ ] Eventos de varios días sin horas conservan fecha final incluida y solo recordatorio de víspera; Zoom por número conserva código y ceros.
- [ ] Circuitos y correos del comité correctos; SC sin congregación ficticia, circuito privado y libros anteriores compatibles.

Para probar horarios reales elige fechas de ensayo que permitan observarlos; no alteres el reloj del servidor ni inventes resultados. Las pruebas unitarias verifican cálculos de horario de verano, pero no la entrega real de Gmail.

## Operación

- [ ] WhatsApp: abre el contacto correcto en Android, iPhone y ordenador; sin enviar mensajes durante la prueba.
- [ ] Iconos: la clasificación se reconoce, tocarla muestra su etiqueta y no abre WhatsApp; la pareja de controles permanece junta y es utilizable con teclado.
- [ ] Compatibilidad: la API conserva los campos antiguos sin `include`; añade solo la clasificación al pedir `include=hearingStatus`.
- [ ] Contactos: un teléfono inválido no genera enlace; cambiar de evento/usuario o desconectar retira los contactos anteriores; no aparecen en impresión ni consulta offline.

- [ ] Recorridos: sede, departamento y fecha correctos; las fotos no se entregan sin sesión ni a otro departamento.
- [ ] Zonas: abrir, ampliar y volver conserva la vista; la lista funciona sin WebGL y al cerrar se liberan las imágenes.
- [ ] Assets privados: Worker primero en todas las rutas, catálogo interno inaccesible directamente y respuestas sin caché persistente.

- [ ] Turnos: asignar, filtrar, marcar/corregir asistencia y sustituir conserva histórico.
- [ ] Programa y planos publicados son consultables sin permisos de edición.
- [ ] Reuniones: Mes y Lista muestran las mismas convocatorias; las fechas publicadas se conservan mientras hay borradores. La consulta conjunta identifica asamblea y zona horaria y solo permite gestionar al abrir el evento correspondiente.
- [ ] Reuniones: filtros y posición se conservan al volver; sin conexión solo está disponible la copia guardada y la impresión excluye borradores.
- [ ] Descargar consulta, desconectar y consultar muestra fecha/versión; no permite editar.
- [ ] Impresión contiene evento, actualización y referencia a la versión vigente.
- [ ] Existe copia privada y se ha ensayado recuperación en un entorno ficticio.
- [ ] Se conoce quién puede recuperar Firebase, Cloudflare y Gmail.
- [ ] Personas representativas han probado la comprensión sin tutorial; los pendientes están registrados.

Si alguna casilla esencial falla, no anuncies funcionamiento completo. Conserva el motivo y la siguiente acción. Un repositorio descargable no incorpora automáticamente las autorizaciones de la organización que lo creó.
