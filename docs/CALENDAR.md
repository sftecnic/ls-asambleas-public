# Calendar, Zoom y circuitos

## Conectar las cuentas de esta instalación

La entrada con Google a LS Asambleas y las autorizaciones de Gmail y Calendar son tres conexiones independientes. Los voluntarios no autorizan sus calendarios: el organizador invita desde su propio calendario principal.

1. Sigue [INSTALACION.md](INSTALACION.md) hasta tener Firebase Standard sin facturación, Worker/Queues Free y un administrador explícito.
2. En Google Cloud, selecciona el mismo proyecto Firebase y habilita **Gmail API** y **Google Calendar API**. No habilites una prueba de pago.
3. En Google Auth Platform, declara `openid`, `userinfo.email`, `gmail.send` y `calendar.events.owned`. Estos dos últimos son sensibles. Consulta [los permisos oficiales](https://developers.google.com/workspace/calendar/api/auth) y [la verificación de OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification). Publicar OAuth no equivale a superar su verificación; el modo Pruebas puede producir autorizaciones de siete días. El responsable completa los consentimientos y las verificaciones que Google exija.
4. El cliente **Aplicación web** usa exactamente `https://TU_WORKER.TU_CUENTA.workers.dev/oauth/callback`. Guarda su JSON como secreto local y transfiérelo con el instalador; nunca en Git, Vite o el chat. El mismo cliente admite conexiones separadas y tokens cifrados independientes para Gmail y Calendar.
5. En **Más → Avisos y correo**, conecta Gmail, comprueba la cuenta y envía una prueba solo al administrador. Después conecta Calendar con **la misma cuenta organizadora**, crea la convocatoria ficticia de prueba y comprueba que solo invita al administrador autenticado. No uses una reunión real para esta prueba.
6. Activa ambos servicios únicamente después de comprobar las pruebas. Si se está migrando una instalación existente, primero completa el traspaso del procesador conforme a su procedimiento de recuperación; el sistema impide activarlo mientras siga pendiente.

**Resultado esperado:** correo y Calendar identifican al organizador elegido; no se pide acceso al contenido del buzón ni a calendarios de los invitados. Comprueba remitente, invitación, respuesta y recordatorios con una cuenta de ensayo autorizada. Una aceptación de la API no acredita que alguien haya leído el correo.

**Errores frecuentes:** `redirect_uri_mismatch` exige comparar el retorno exacto; conexión caducada exige reconectar el servicio afectado; una cuenta distinta de la organizadora es rechazada. No desconectes ni revoques globalmente Google para arreglar un solo servicio: Gmail y Calendar comparten cliente, pero conservan tokens separados. Si falta API, habilita Calendar en el proyecto correcto y repite la prueba.

## Convocar desde la aplicación

**Asamblea o reunión de precursores:** Más → Eventos → Calendar, o Programa → Convocatoria. Indica inicio/final opcionales en el evento; sin ellos se invita como Todo el día durante todas sus fechas, con fecha final incluida.

**Formación y orientación:** Programa → Reuniones. Las reuniones requieren fecha, hora y duración positiva al confirmar. Guardar un borrador no envía invitaciones. En una convocatoria confirmada, el borrador conserva visible la versión anterior hasta **Guardar y avisar**.

Antes de confirmar se revisan datos y personas. Se incluyen aprobados y aceptados, reservas y cargos operativos. Una persona de varios departamentos recibe una invitación. Un administrador sin participación no se añade por su permiso. Orientación utiliza sus destinatarios por turno y asistentes adicionales, sin inventar servicios. El correo se elige por Gmail de acceso, correo para avisos y correo de contacto, en ese orden. Los ausentes o compartidos se muestran para corregirlos; no se atribuyen respuestas ambiguas.

Calendar envía la convocatoria, modificaciones y cancelación. La aplicación mantiene avisos internos y recordatorios Gmail la víspera a las 20:00 y una hora antes, en la zona del evento. En eventos Todo el día solo corresponde el de la víspera. Confirmar tarde programa únicamente avisos futuros. No se convocan automáticamente datos anteriores, importaciones o restauraciones.

## Respuestas y cambios

En **Calendar · Respuestas** aparecen Sí, No, Quizás y Sin respuesta, junto a la última comprobación. Los estados Sin correo, Correo compartido, Invitación pendiente y Error son distintos. El servidor revisa cada cinco minutos; Actualizar tiene un intervalo mínimo de un minuto.

Los gestores ven su ámbito; cada voluntario ve su respuesta. Un No avisa a quienes coordinan y suspende los futuros recordatorios de esa convocatoria. No cambia la aprobación, la aceptación como voluntario, los turnos ni la asistencia real. Presente/Ausente sigue registrando lo sucedido.

Modifica los datos organizativos desde LS Asambleas. Si alguien cambia o elimina la entrada en Google, aparece **Revisar cambios**: no se sobrescribe ni recrea sin una decisión explícita. Revisa antes de usar los datos de la aplicación o recrear. Las respuestas se conservan al actualizar invitados; se registra cuándo se detectó el cambio, no una hora de respuesta inventada.

## Zoom por número

Puedes dejar **Enlace Zoom** vacío y completar un **Número de reunión** de 9 a 11 cifras. **Código de acceso** es opcional y conserva letras, mayúsculas y ceros iniciales. La aplicación ofrece Copiar número/Copiar código; Entrar en Zoom solo aparece cuando hay enlace. No deduce contraseñas del enlace ni crea reuniones Zoom. Los datos vigentes aparecen en convocatoria, recordatorio, consulta autorizada e impresión.

## Congregaciones y superintendente de circuito

El circuito es editable en la congregación. Los selectores agrupan primero 01B, después 01A y el resto; los filtros de Equipo y Directorio se combinan con congregación y clasificación. El correo del comité continúa privado y rellena las plantillas manuales: no invita a congregaciones en Calendar.

Al elegir **Superintendente de circuito**, se guarda conjuntamente SC, Precursor No aplica y Congregación vacía. El formulario muestra **Circuito de servicio**; puede quedar sin indicar. Es privado y no se publica ni se descarga offline. Al dejar SC se solicita congregación y se retira su circuito privado. El nombramiento no concede permisos ni aprobaciones.

Excel incorpora las columnas opcionales **Circuito** en Congregaciones y **Circuito de servicio** en Personas. Los libros anteriores siguen aceptándose y los blancos conservan datos existentes. Un SC con congregación asignada queda Por revisar, sin corregirse silenciosamente. Los respaldos administrativos conservan estos campos.

## Operación y límites

Solo el Worker accede a conexiones, trabajos y respuestas privadas. Las credenciales se cifran en servidor; los endpoints comprueban sesión, ámbito y versión. Hay identificadores estables, arrendamientos y comprobación previa de resultados inciertos para evitar invitaciones duplicadas. La cola ejecuta trabajos vencidos, no almacena toda la programación futura.

Se mantienen Spark sin facturación y Workers/Queues Free. La aplicación limita Gmail a 400 correos/24 h y Calendar a 10.000 solicitudes/día; además se aplican los límites efectivos de cada proveedor. Alcanzar cuotas retrasa o bloquea operaciones; no contrata capacidad. Los recordatorios requieren el cron y el consumidor activos, aunque la web esté cerrada. Consulta [cuotas de Calendar](https://developers.google.com/workspace/calendar/api/guides/quota) y completa [COMPROBACION.md](COMPROBACION.md) antes del uso real.
