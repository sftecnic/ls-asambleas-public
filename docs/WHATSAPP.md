# Contactar por WhatsApp

El botón **WhatsApp**, junto al nombre, abre una conversación con el teléfono guardado en la ficha. No escribe ni envía mensajes. Usa el enlace oficial `https://wa.me/NUMERO`: Android e iPhone pueden abrir WhatsApp; en ordenador se ofrece la aplicación o WhatsApp Web. El dispositivo puede pedir confirmación o iniciar sesión.

## Dónde aparece

- Equipo, Directorio, Inicio, Turnos e Histórico: personas vinculadas por su identificador, incluidos responsables, auxiliares, titulares y suplentes.
- Mis turnos e Instrucciones: **Tu departamento** muestra responsables y auxiliares actuales, aprobados y aceptados, de los departamentos autorizados del evento elegido. Está disponible antes de publicar los turnos.
- Los contactos privados existentes siguen sujetos al permiso `contacts` o a administración. La consulta del voluntario recibe solo nombre, departamento, cargo y teléfono de sus responsables y auxiliares; nunca correos, observaciones ni clasificación personal.

No aparece para la propia persona, sin conexión, en impresión, selectores o plantillas. Programa, discursantes, intérpretes y rótulos del plano no se enlazan por nombre: necesitan antes una vinculación explícita con una ficha. No se deducen identidades por coincidencias de texto.

## Teléfonos

Se utiliza **Teléfono** en la ficha existente; no hay un segundo campo ni migración de datos. Los espacios, paréntesis, puntos y guiones se quitan únicamente al construir el enlace.

| Guardado | Enlace generado |
|---|---|
| `600 123 456` | `https://wa.me/34600123456` |
| `+34 600 123 456` o `0034 600 123 456` | El mismo enlace |
| `+1 (202) 555-0123` | `https://wa.me/12025550123` |

Un número nacional español de nueve cifras que empiece por 6, 7, 8 o 9 se interpreta con prefijo 34. Otros países requieren `+` o `00`. Se aceptan entre ocho y quince cifras internacionales; los españoles deben conservar sus nueve cifras nacionales. Extensiones, varios números en una celda, letras o prefijos ambiguos no generan botón. Corregir la ficha actualiza el enlace sin reescribir publicaciones. Un formato válido no acredita que ese teléfono tenga WhatsApp.

## Servicio y protección

`GET /contacts/leadership?event=CODIGO` está disponible tanto en el Worker de reuniones como en la entrada separada de lectura `worker/tour-entry.ts`. Se utiliza `VITE_TOUR_SERVICE_URL`; si está vacío, se usa `VITE_MEETING_SERVICE_URL`. No añade variables, reglas, índices ni colecciones Firestore.

Cada solicitud exige un ID token de Firebase vigente, correo verificado y permisos actuales del evento/departamento. El servidor consulta solo candidaturas con cargo responsable o auxiliar, verifica aprobación y aceptación, y comprueba el ámbito **antes** de leer los documentos privados. La respuesta contiene exclusivamente `personId`, `name`, `departmentId`, `role` y `phone`; el teléfono va en formato internacional o vacío. Se limita a 500 candidaturas por cargo y a lecturas en grupos pequeños; un exceso falla sin devolver resultados parciales.

El navegador valida el formato y el evento de la respuesta. Los contactos permanecen en la memoria de la pantalla: sin almacenamiento local, IndexedDB, consulta descargada ni caché persistente. Se invalidan al cambiar de cuenta, evento, permisos o conexión; se actualizan al volver a la aplicación o cambiar los datos pertinentes. No hay una petición por nombre ni sondeo periódico. La información ya vista no puede retirarse de la memoria de quien la ha consultado.

Las respuestas usan `Cache-Control: private, no-store`, Bearer en la cabecera y CORS limitado al origen canónico. Los enlaces a WhatsApp no transmiten el origen de la aplicación (`no-referrer`) y abren otra pestaña sin acceso a la original. No hay integración con WhatsApp Business, OAuth de WhatsApp, envíos automáticos ni cambios en Gmail.

## Actualizar una instalación

1. Conserva las versiones de recuperación del Worker y Hosting; confirma cuentas y planes gratuitos siguiendo [Mantenimiento](MANTENIMIENTO.md).
2. Despliega primero el Worker que atiende `VITE_TOUR_SERVICE_URL` (o el de reuniones si no hay servicio separado). Conserva secretos, assets, colas, cron y variables existentes. La entrada separada sigue necesitando únicamente `roles/datastore.viewer`; no se añaden permisos de escritura.
3. Comprueba `/health`, el rechazo sin sesión de `/contacts/leadership?event=CODIGO` y una consulta autorizada. No registres teléfonos, tokens ni respuestas privadas en logs o capturas públicas.
4. Compila y despliega **Hosting**. No es necesario desplegar reglas, índices o datos por este cambio.
5. Comprueba una persona con teléfono válido, otra sin teléfono y el acceso de un voluntario al responsable y auxiliares de su ámbito. Cambia de evento, cierra sesión y desconecta para comprobar que no quedan botones del ámbito anterior.

Si se revierte el Worker, revierte primero Hosting a su versión anterior. No cambies el remitente de Gmail para instalar esta función. Las consultas protegidas consumen cuotas gratuitas de Firestore y Workers; no contrates capacidad para superar un límite.

## Validación

`tests/whatsapp.test.ts` prueba normalización, permisos, proyección, rutas, identidades, bajas y ausencia de campos privados. `tests/whatsapp.e2e.spec.ts` prueba la interfaz con teléfonos ficticios y **bloquea las solicitudes a WhatsApp**: no contacta a ninguna persona. Incluye cambio de teléfono/cargo, cambio de cuenta/evento, desconexión, impresión, teclado, nombres largos, 320–1440 px y texto ampliado.

Antes del primer uso en cada entorno, comprueba manualmente Android, iPhone y ordenador con una persona autorizada: abrir la conversación correcta y volver a la aplicación. No hace falta enviar un mensaje. La emulación y las comprobaciones de enlaces no sustituyen esa prueba con las aplicaciones instaladas.

Referencia: [función oficial de clic para chatear de WhatsApp](https://faq.whatsapp.com/5913398998672934).
