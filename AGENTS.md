# Acompañar una instalación de LS Asambleas

Estas instrucciones sirven a cualquier asistente con o sin terminal/navegador. Lee primero README.md, docs/INSTALACION.md y docs/COMPROBACION.md. No dependas de conversaciones anteriores, rutas personales ni plugins.

## Detectar y retomar

1. Identifica sistema operativo, carpeta con package.json, Node.js 24 y si el usuario está en demostración o quiere producción.
2. Examina solo los nombres y campos públicos de installation.local.json y config/. No muestres `.env`, secretos, tokens, JSON OAuth o claves de servicio en una respuesta ni en logs.
3. Ejecuta `npm run setup:check`, si hay terminal. Lee `.tools/installation-progress.json` como evidencia histórica; vuelve a comprobar los estados remotos. Un «PENDIENTE» no equivale a un error irreversible.
4. Pide únicamente datos que falten. Confirma el ID del proyecto y la cuenta antes de crear recursos. El administrador inicial siempre se indica explícitamente; nunca es el primer visitante.
5. Haz el siguiente paso de docs/INSTALACION.md. Comprueba su resultado antes de seguir. Guarda notas sin credenciales en `.tools/installation-notes.md`.

## Límites de operación

- Mantén Firebase Spark sin facturación y Workers/Queues Free. No habilites Blaze, Functions, App Hosting, Storage ni planes de pago. Presupuestos y alertas no bloquean cobros.
- Usa las versiones CLI indicadas y `scripts/with-cli-auth.mjs` con `provision-installation.mjs`; no omitas las comprobaciones de destino/coste para superar un bloqueo.
- No crees secretos en variables `VITE_*`. Las variables Vite se publican en el navegador.
- No pidas contraseñas, códigos MFA, cookies, claves privadas ni tokens en el chat. El usuario realiza inicio de sesión y consentimientos en Google/Cloudflare. No simules que has completado una autorización.
- No sobrescribas configuraciones existentes, administradores ni claves. Si hay diferencias, explica los archivos y destinos, prepara una comparación y sigue el procedimiento de recuperación.
- No envíes pruebas a voluntarios: la primera prueba se envía solo al administrador autenticado. No confirmes reuniones reales durante las pruebas.
- No importes información personal desde ejemplos, logs o documentos de otra organización. Todo ejemplo debe ser ficticio.
- Un cargo no concede permisos. Las importaciones solo ofrecen consulta como voluntario después de revisar aprobación, aceptación y Gmail.

## Si no tienes herramientas

Da un único paso o un bloque corto de comandos, indica en qué carpeta/ventana y el resultado esperado. Pide solo el estado o un mensaje de error sin credenciales. Usa las alternativas manuales de la guía. No afirmes haber ejecutado una comprobación que hizo otra persona sin su confirmación.

## Desarrollo y entrega

Para cambios de interfaz, lee primero PRODUCT.md y DESIGN.md. Las skills se encuentran en `.agents/skills/` dentro de este repositorio: esta es la fuente obligatoria para el proyecto, aunque tengas copias personales con el mismo nombre. No se fusionan. Consulta docs/SKILLS.md para comprobar, restaurar o actualizar versiones.

1. Identifica la pantalla y la tarea que la persona debe poder completar.
2. Carga solo la skill y referencias pertinentes: Impeccable para organización y claridad; frontend-design para composición; UI UX Pro Max para patrones concretos; web-design-guidelines para la revisión final.
3. Diseña y revisa con datos ficticios antes de conectar o modificar flujos reales.
4. Reutiliza componentes, tokens y vocabulario; conserva filtros, formularios y foco al volver.
5. Comprueba funcionamiento, accesibilidad y capturas móviles/escritorio. Una revisión automática no demuestra comprensión sin tutorial.

Ejecuta `npm run skills:check` antes de utilizar las skills y de preparar la distribución. No actualices sus versiones implícitamente. No incluyas los paquetes ni sus herramientas en `public/` o `dist/`. `npm run dev:demo` fuerza datos ficticios aunque exista configuración local de Firebase.

Conserva los componentes visuales: Source Sans 3, Lucide, icono + etiqueta, controles de 48 px, estados reforzados con texto y foco visible. Revisa cambios móviles y de teclado. No cambies reglas o permisos para hacer pasar una importación.

Antes de entregar: `npm ci`, `npm test`, `npm run test:installation`, `npm run check:worker`, `npm run build`; pruebas de navegador si cambias interacción y emulador si cambias reglas. Usa datos ficticios. Indica las comprobaciones no ejecutadas, especialmente Google OAuth real, correo, recordatorios, Excel/LibreOffice y comprensión con participantes.

No consideres la instalación completamente operativa hasta completar docs/COMPROBACION.md. Para un cambio de producción conserva una copia y una versión recuperable. La distribución pública se prepara mediante una lista explícita de archivos, nunca copiando `.git`, `.tools`, datos privados o el historial de una instalación.
