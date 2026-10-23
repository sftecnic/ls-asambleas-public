# Instalación completa con tus cuentas

Esta guía parte de una descarga ZIP o un clon nuevo. No necesitas datos de la instalación original. Tiempo orientativo: varias sesiones; las autorizaciones, índices y revisión de OAuth pueden requerir espera.

## Antes de empezar

Usa una cuenta Google que controles como propietario del proyecto, un Gmail administrador de la aplicación, un Gmail remitente y una cuenta Cloudflare. Pueden ser el mismo Gmail. Decide quién conservará acceso de recuperación. No compartas contraseñas.

**Coste:** crea Firebase Spark sin vincular facturación y conserva Workers/Queues Free. El código no contrata capacidad. Las cuotas pueden detener peticiones, lecturas o correos. Comprueba las condiciones vigentes en [Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Workers](https://developers.cloudflare.com/workers/platform/pricing/) y [Queues](https://developers.cloudflare.com/queues/platform/pricing/). No uses presupuestos de Blaze como supuesto límite de gasto.

Todos los comandos se ejecutan desde la carpeta que contiene `package.json`. Sustituye `TU_PROYECTO`, `TU_GMAIL` y las rutas por tus datos; no copies esos textos literalmente. En macOS/Linux cambia `npm.cmd` por `npm` y `npx.cmd` por `npx`. El resto de comandos `node` es idéntico. En rutas con espacios conserva las comillas.

## 1. Equipo y demostración

**Objetivo:** comprobar el programa sin recursos remotos.

1. Instala Node.js **24 LTS** desde [nodejs.org](https://nodejs.org/) y, opcionalmente, Git desde [git-scm.com](https://git-scm.com/).
2. Descarga ZIP, extráelo y abre una terminal en la carpeta. En Windows: Explorador → barra de dirección → escribe `powershell`.
3. Ejecuta:

```powershell
node --version
npm.cmd ci
npm.cmd run dev
```

**Resultado y comprobación:** Node muestra `v24…`; Vite indica una URL local. Ábrela, comprueba «Datos ficticios», entra en Inicio, Equipo, Turnos y Programa. No necesitas Firebase para esta demostración. Ctrl+C detiene Vite.

**Si falla:** «npx.ps1 está deshabilitado» se resuelve usando `npx.cmd`, sin cambiar la política de PowerShell. Si el puerto está ocupado, usa el siguiente que indique Vite. Si aparecen datos reales, detén Vite y revisa que no haya configuración Firebase en `.env`, `.env.local` ni variables del sistema; la configuración real irá solo en `.env.production.local`.

## 2. Herramientas y cuentas

```powershell
npx.cmd --cache .tools/npm-cache -y firebase-tools@15.34.1 --version
npx.cmd --cache .tools/npm-cache -y wrangler@4.152.0 --version
npx.cmd --cache .tools/npm-cache -y firebase-tools@15.34.1 login
npx.cmd --cache .tools/npm-cache -y wrangler@4.152.0 login
```

**Resultado:** cada navegador confirma el acceso. Usa la cuenta propietaria elegida. Gemini es opcional y no se necesita; puedes responder No. La sesión Firebase CLI sirve para instalar, no sustituye el acceso de voluntarios ni la autorización Gmail.

**Comprobación:** `firebase login:list` y `wrangler whoami`, usando los mismos prefijos `npx.cmd --cache … -y …@versión`. Revisa la cuenta, sin copiar tokens. Si la ventana caduca, repite login; si ya hay varias cuentas, usa `firebase login:use TU_GMAIL` antes de seguir. En equipos sin navegador local, Firebase admite `login --no-localhost`; sigue su intercambio seguro en la terminal.

## 3. Proyecto propio y Firestore

1. Abre [Firebase Console](https://console.firebase.google.com/), **Crear proyecto**. Elige un ID propio y anótalo. Google Analytics no es necesario.
2. Comprueba **Spark**. No vincules una cuenta de facturación.
3. En **Compilación → Firestore Database → Crear base de datos**, elige **Standard**, base `(default)`, modo nativo y modo producción. Elige región cerca de tus usuarios, por ejemplo `europe-southwest1`. La ubicación no se cambia después con este instalador.
4. En **Configuración del proyecto → General → Tus aplicaciones**, añade aplicación **Web**. No necesita SDK de servidor ni Storage. Copia únicamente `apiKey` y `appId` de su configuración pública; el ID de proyecto debe coincidir.

**Resultado:** proyecto sin facturación, Firestore Standard y aplicación web. **Si falla:** habilita la API solicitada solo si es Firestore/Auth/Hosting/Gmail/IAM de estos pasos y no exige pago; si se pide Blaze, detente y revisa que elegiste Hosting clásico y Firestore Standard.

## 4. Google Authentication y configuración local

1. En Firebase → **Authentication → Comenzar → Método de acceso**, habilita **Google**, define nombre visible y correo de soporte, y guarda.
2. En Authentication → Configuración → **Dominios autorizados**, comprueba `TU_PROYECTO.firebaseapp.com`. La app utiliza ese dominio como origen canónico. No añadas dominios ajenos. El dominio `web.app` se redirige al canónico en la aplicación.
3. En Cloudflare Dashboard, selecciona la cuenta gratuita. Copia su **Account ID**. En **Workers & Pages**, establece el subdominio gratuito `tu-organizacion.workers.dev` si aún no existe. Anota solo `tu-organizacion`.
4. Ejecuta `npm.cmd run setup` y responde los campos públicos: proyecto, Gmail administrador, nombre, apiKey, appId, Account ID, nombre del Worker, subdominio y región.

Alternativa: copia `config/installation.example.json` a `installation.local.json`, sustituye todos los marcadores y ejecuta `npm.cmd run setup`. También se admite `npm.cmd run setup -- --from "ruta/configuracion.json"`.

**Resultado:** se generan `firebase.local.json`, `worker/wrangler.local.jsonc` y `.env.production.local`, ignorados por Git. No se modifica `.firebaserc` ni se elige un proyecto global por defecto. Repetir el paso conserva archivos iguales y se detiene ante valores distintos.

**Comprobación:** `npm.cmd run setup:check`. Las comprobaciones remotas todavía aparecerán pendientes. El retorno Gmail exacto se muestra en setup: `https://NOMBRE.SUBDOMINIO.workers.dev/oauth/callback`.

**Si falla el acceso posterior:** comprueba dominio autorizado, misma pestaña/origen, cookies permitidas y cuenta con permiso. No conviertas al visitante en administrador ni abras las reglas para solucionar «sin acceso».

## 5. Administración inicial explícita

El proyecto debe estar vacío de administración. Ejecuta primero sin `--apply` para revisar y después:

```powershell
node scripts/with-cli-auth.mjs bootstrap-admin.mjs --project TU_PROYECTO --email TU_GMAIL --name "Administración" --config firebase.local.json --apply
```

**Resultado:** un administrador explícito, tres departamentos iniciales y plantillas básicas. El script comprueba facturación y Firestore; escribe todo con condición de inexistencia. Si el registro ya existe se detiene, no lo sustituye ni añade otro por sorpresa.

**Comprobación:** más adelante entra con ese Gmail; otros visitantes no deben obtener acceso. Si olvidaste qué administrador existe, inspecciona `system/administrators` desde la consola con la cuenta propietaria. Los cambios posteriores se hacen desde Permisos, conservando al menos un administrador operativo.

## 6. Cloudflare Free, cola y Worker

En Cloudflare → **Billing → Subscriptions**, verifica que no hay suscripción de pago. No aceptes upgrades. Los comandos siguientes vuelven a comprobarlo por API antes de escribir:

```powershell
node scripts/with-cli-auth.mjs provision-installation.mjs --action queue --apply
node scripts/with-cli-auth.mjs provision-installation.mjs --action worker --apply
```

**Resultado:** una cola `NOMBRE_DEL_WORKER-mail`, un Worker con productor/consumidor y cron cada minuto. Repetir no crea otra cola. La URL `/health` responde JSON con `service: ls-asambleas-meetings`. Hasta terminar los secretos y conectar el remitente, los correos no están operativos; pueden aparecer errores del cron de esta instalación incompleta.

**Si falta permiso para consultar facturación:** el instalador se detiene. Wrangler OAuth puede no tener ese permiso. En Cloudflare → My Profile → API Tokens crea un token limitado a **esta cuenta**, con lectura de Account Billing/Subscriptions, edición de Workers Scripts, edición de Workers Queues y los permisos de lectura de cuenta necesarios. La lista exacta de permisos se muestra en el panel y puede cambiar. El token no debe habilitar contratación de planes. Úsalo solo en el entorno temporal `CLOUDFLARE_API_TOKEN` de la terminal mediante una entrada oculta, nunca como argumento, archivo ni mensaje del chat. PowerShell: `$cfSecret = Read-Host "Token Cloudflare" -AsSecureString; $env:CLOUDFLARE_API_TOKEN = [System.Net.NetworkCredential]::new("", $cfSecret).Password`; al terminar: `Remove-Item Env:CLOUDFLARE_API_TOKEN; Remove-Variable cfSecret`. En Bash: `read -rs CLOUDFLARE_API_TOKEN; export CLOUDFLARE_API_TOKEN`, y después `unset CLOUDFLARE_API_TOKEN`. No cambies la comprobación a «si falla, continuar».

Si una organización impide crear tokens o claves, solicita a su propietario los permisos adecuados; no desactives sus políticas.

## 7. Servicio y secretos

```powershell
node scripts/with-cli-auth.mjs provision-installation.mjs --action service --apply
```

**Resultado:** cuenta de servicio `ls-meetings-worker` en tu proyecto, rol `roles/datastore.user`, Gmail API habilitada y secretos `FIREBASE_SERVICE_ACCOUNT` y `TOKEN_ENCRYPTION_KEY` en el Worker. La clave se transfiere en memoria. No se guarda en el navegador ni en Git.

El servidor necesita acceso a Firestore y comprueba por su cuenta identidad, permisos y versiones. El rol de cuenta de servicio evita depender de la sesión de un navegador; no concede acceso a voluntarios.

**Comprobación:** Cloudflare → Worker → Settings → Variables and Secrets muestra los nombres de los secretos. No intentes ver su contenido. Repetir conserva una pareja ya existente. Si existe una clave pero faltan secretos, o solo hay uno, el script se detiene: sigue la recuperación de `MANTENIMIENTO.md`, no borres ni rotes a ciegas.

## 8. Gmail OAuth, separado del acceso

1. En [Google Cloud Console](https://console.cloud.google.com/), selecciona **el mismo proyecto Firebase**. En APIs y servicios comprueba **Gmail API habilitada**.
2. Abre **Google Auth Platform** (o APIs y servicios → Pantalla de consentimiento). Configura nombre LS Asambleas, correo de soporte, audiencia externa si usas Gmail personal y contacto del desarrollador.
3. En **Acceso a datos / Scopes**, solicita `https://www.googleapis.com/auth/gmail.send`, además de identidad básica `openid` y correo. No se necesita lectura del buzón. [Ámbitos Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes).
4. En **Clientes → Crear cliente OAuth → Aplicación web**, añade como URI de redirección **exactamente** el retorno mostrado por setup, terminado en `/oauth/callback`. Sin barra final extra. No confundas este cliente con el de Firebase Authentication.
5. Descarga el JSON y guárdalo temporalmente en `.tools/cliente-gmail.json`. No pegues su contenido en el chat, Git o variables Vite.

```powershell
node scripts/with-cli-auth.mjs provision-installation.mjs --action oauth --file ".tools/cliente-gmail.json" --apply
```

**Resultado:** `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Cloudflare. El script comprueba proyecto y retorno antes de transferirlos. No sustituye un cliente ya configurado. Puedes guardar el JSON fuera del proyecto en un almacén privado y eliminar la copia temporal una vez verificado.

**Estado de OAuth:** el modo externo **Pruebas no es una configuración duradera** para gmail.send: sus refresh tokens pueden caducar a los siete días. Añade el Gmail remitente como usuario de prueba durante el ensayo, pasa a **Producción / Publicar aplicación** cuando proceda y vuelve a conectar el remitente. Publicar la pantalla no equivale a que Google la haya verificado. Gmail.send es sensible; Google puede exigir verificación, dominio, política de privacidad y justificación. Para uso personal o pocos usuarios conocidos pueden existir excepciones y advertencias, pero no se garantiza una excepción para una distribución pública. Sigue [OAuth de Google](https://developers.google.com/identity/protocols/oauth2/) y [requisitos y excepciones de verificación](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification). No inventes una política ni indiques a usuarios que ignoren avisos de seguridad.

**Errores:** `redirect_uri_mismatch`: compara carácter por carácter el retorno; `access_denied`: revisa usuario de prueba/estado/consentimiento; `invalid_grant`: reconecta desde la app y revisa revocación o expiración. No solicites acceso completo al buzón para resolverlo.

## 9. Reglas, índices y Hosting

```powershell
npm.cmd test
npm.cmd run test:installation
npm.cmd run check:worker
node scripts/with-cli-auth.mjs provision-installation.mjs --action firebase --apply
```

**Resultado:** compila y publica Hosting clásico, reglas e índices en el proyecto exacto de `installation.local.json`. No publica bases de datos de ejemplo ni modifica permisos existentes. La cola y el Worker son los del paso 6. Authentication se configuró en la consola; si necesitas gestionarlo por CLI, se admite por separado `--action firebase --only auth --apply`.

**Comprobación:** espera a que los índices estén **READY**. Abre `https://TU_PROYECTO.firebaseapp.com` en una pestaña normal y entra con el Gmail administrador. Debe mostrarse la aplicación vacía, no «Datos ficticios». Si ves demo, revisa las variables y recompila. Si falla un índice, espera o corrige la configuración; no relajes reglas.

Ejecuta `node scripts/with-cli-auth.mjs check-installation.mjs` para comprobar proyecto, administrador, acceso Google, índices, servicio, cola, cron y remitente. Es una comprobación de lectura; no corrige ni borra datos. Los estados y siguientes acciones quedan en `.tools/installation-progress.json` sin tokens.

## 10. Conectar y probar el remitente

1. En la app, **Más → Avisos y correo → Conectar/Cambiar cuenta**.
2. Elige el Gmail remitente deseado en Google y concede el envío. Confirma el correo mostrado al regresar.
3. **Enviar prueba**: se dirige exclusivamente al administrador que la solicita. Comprueba llegada, remitente y enlace.
4. Activa los envíos solo tras esa comprobación. «Enviado» significa aceptado por Gmail, no leído.

**Resultado:** cuenta conectada, probada y envíos activos. Los recordatorios funcionarán sin navegador abierto. Se limita a 400 correos/24 horas desde la app y además a los límites efectivos de Gmail. Las cuotas o fallos pueden retrasar la entrega. [Límites de Gmail](https://support.google.com/mail/answer/22839?hl=es).

## 11. Preparar la organización

En Más → Importar descarga el Excel y sigue [IMPORTACION-EXCEL.md](IMPORTACION-EXCEL.md). Importa solo las hojas necesarias. Revisa identificadores y coincidencias. Después concede consulta a personas aprobadas y aceptadas; responsables/auxiliares reciben capacidades explícitas desde Permisos. No deduzcas permisos del cargo.

Prepara reuniones y revisa convocados antes de confirmar. Sus fechas son independientes del evento. Publica turnos y programa desde sus pantallas; importar los deja en borrador. Añade materiales como enlaces Drive, no como archivos alojados en Firebase.

## 12. Verificar y entregar

Completa [COMPROBACION.md](COMPROBACION.md) con datos ficticios y los correos autorizados. Incluye una reunión de ensayo destinada solo al administrador; cancélala al terminar. No marques un recordatorio como comprobado por haber visto únicamente la pantalla de configuración.

Guarda una copia privada y registra versión, fecha, proyecto, responsable y comprobaciones pendientes. Una instalación con OAuth pendiente o cron no observado todavía **no está completamente verificada**, aunque Hosting funcione. Para volver otro día: `npm.cmd run setup:resume` y después el comprobador remoto; continúa desde el primer pendiente sin repetir altas ni rotar claves.
