# Actualización, respaldo y recuperación

## Copias

Antes de cambiar datos o versión, descarga **Más → Copias → Guardar una copia**. Contiene datos y permisos privados: almacénala fuera de Git, protegida, con fecha y versión. Exportar Excel sirve para actualizar datos operativos; **no sustituye una copia completa**. Conserva también los identificadores públicos de instalación y acceso de recuperación a las cuentas.

El respaldo de la aplicación no exporta las credenciales de Gmail del servidor. Si pierdes el servicio de correo, podrás reconstruirlo y volver a autorizar Gmail. No exportes secretos a la copia de voluntarios ni a un repositorio.

## Actualizar código

1. Guarda copia y anota la versión de Hosting que funciona (Firebase Console → Hosting → Historial de versiones).
2. Descarga la nueva versión en una carpeta nueva o usa `git pull` con cambios locales previamente revisados. Conserva fuera del cambio `installation.local.json`, configuraciones locales y sesiones de herramientas.
3. Ejecuta `npm ci`, pruebas, comprobación de instalación y build. Revisa cambios de esquema/reglas en las notas de versión.
4. Para una actualización solo de interfaz:

```powershell
node scripts/with-cli-auth.mjs provision-installation.mjs --action firebase --only hosting --apply
```

5. Comprueba dominio público, login, datos y nueva versión. Si falla, usa **Rollback / Revertir** en el historial de Firebase Hosting. Revertir Hosting no revierte datos ni Worker.

Si cambia el servicio, despliega `--action worker --apply` solo tras leer las notas y comprobar cola/cron. No crees otra cola o otro secreto para una actualización normal. Las sesiones de CLI pueden caducar: vuelve a login, no copies tokens de otra máquina.

## Restaurar datos

En **Más → Copias → Restaurar datos** elige la copia y revisa la comparación. La restauración conserva histórico y permisos vigentes conforme a las reglas de la app; no es un borrado completo de Firestore. Si necesitas revertir permisos o reparar una corrupción de servidor, prepara una comparación explícita y usa un administrador, nunca abras las reglas a todos. Ensaya primero con datos ficticios. Un fallo de importación Excel se retoma desde su revisión, no restaurando toda la base sin comprobar los lotes ya guardados.

## Cambiar administración

El Gmail de despliegue, el administrador de la app y el remitente son identidades diferentes. Crea primero la nueva ficha/cuenta administrativa y su permiso desde la aplicación; verifica su entrada en otra sesión. Conserva la cuenta anterior hasta comprobar acceso, datos y capacidad de administrar. El historial de una persona operativa sigue ligado a su `personId`; no reasignes su identidad al nuevo buzón organizativo.

Para transferir propiedad de infraestructura añade al nuevo propietario en Firebase/Google Cloud IAM y Cloudflare desde sus paneles, verifica que puede desplegar y consultar facturación, y solo entonces retira accesos anteriores si corresponde. No ejecutes bootstrap sobre una instalación existente: se detendrá expresamente.

## Cambiar Gmail remitente

En Más → Avisos y correo usa **Cambiar cuenta**, autoriza el nuevo Gmail, envía la prueba al administrador y comprueba la dirección. Activa envíos tras la prueba. Los pendientes usarán el remitente vigente; los enviados conservan el remitente histórico. El cambio no altera el historial del auxiliar o responsable.

Si se revoca autorización o aparece `invalid_grant`, vuelve a conectar y revisa estado OAuth. En modo externo Pruebas el token puede caducar en siete días. Publica/verifica OAuth según los requisitos de Google y reconecta después. No publiques tokens ni JSON en una incidencia.

## Secretos incompletos o perdidos

- El instalador conserva secretos existentes; no los rota automáticamente.
- Si una carga terminó sin confirmación, comprueba primero los **nombres** en Cloudflare y la clave USER_MANAGED en Google IAM. Una respuesta de red incierta no demuestra que la operación falló.
- Si están ambos secretos del servicio, prueba el acceso del Worker. No crees otra clave por repetir setup.
- Si falta `TOKEN_ENCRYPTION_KEY`, el token Gmail anterior no puede descifrarse. Antes de sustituir nada, desactiva envíos, registra pendientes y prepara recuperación. Genera una clave de cifrado nueva mediante un procedimiento controlado y vuelve a conectar Gmail; no presentes esto como recuperación del token antiguo.
- Si falta la clave de servicio, un propietario puede crear una nueva, cargarla como secreto, comprobar el Worker y revocar la antigua solo después. No otorgues Owner a la cuenta de servicio; necesita `roles/datastore.user`.
- Si falta un secreto OAuth, recupera el cliente web de **tu proyecto**, comprueba retorno y actualiza los dos secretos como una operación revisada. El comando automático se detiene ante parejas incompletas para evitar una sustitución accidental.

Las operaciones manuales de recuperación son excepcionales: registra qué recurso se cambia y verifica estado antes/después. Nunca guardes material privado en VITE, Git o el chat.

## Cuotas y fallos

Revisa Firebase Usage, Workers Analytics, Queues y el seguimiento de correo. Al alcanzar el límite, espera o reduce frecuencia/carga; no contrates capacidad. «Enviado» solo acredita aceptación de Gmail. Los envíos con respuesta incierta requieren revisión humana, no un reintento ciego. Usa avisos internos o comunicación manual autorizada cuando el correo no esté disponible.
