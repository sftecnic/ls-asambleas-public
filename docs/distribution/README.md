# LS Asambleas

Aplicación visual para coordinar asambleas de lengua de signos: equipo, aprobaciones, turnos, programa, plataforma, reuniones, avisos e histórico. Funciona en móvil y ordenador. Incluye consulta offline explícita e impresión.

Incluye recorridos 360° por sede y departamento, con fotografías ampliables y alternativa en lista. La demostración utiliza dibujos ficticios; consulta [cómo preparar y proteger tus fotografías](docs/RECORRIDOS.md).

También incluye [contactos por WhatsApp](docs/WHATSAPP.md): botones junto a las personas autorizadas y acceso del voluntario a responsables y auxiliares de su departamento. Abre la conversación sin enviar mensajes; utiliza el teléfono existente en la ficha.

Desde 0.5.0, el icono de WhatsApp es verde y se acompaña de Sorda/Oyente/Sin indicar mediante iconos neutros. Tocar la clasificación muestra su etiqueta, sin texto permanente. La proyección opcional conserva compatibilidad con las versiones anteriores y no comparte fichas privadas completas.

Desde 0.6.0, las fichas privadas permiten [nombramiento y precursorado actuales](docs/SERVICIO-PERSONAS.md), con un distintivo de siglas, filtros y columnas Excel opcionales. No modifican cargos ni permisos y no se comparten con voluntarios. Para actualizar una instalación, despliega primero las reglas compatibles y después Hosting.

Desde 0.7.0 incluye [Calendar, Zoom por número y circuitos](docs/CALENDAR.md): invitaciones desde el calendario del organizador, respuestas dentro de la aplicación y recordatorios de Gmail. Cada instalación conecta sus propias cuentas. Los borradores, importaciones y datos antiguos no envían invitaciones automáticamente. SC se vincula al circuito, sin congregación ficticia.

Desde 0.8.0, **Agenda** reúne Programa y Reuniones; las fichas separan **Datos, Equipo y Acceso**, y el plano abre ampliado. Consulta el [rediseño y su validación](docs/DISENO-080.md). El repositorio incluye cuatro [skills de diseño completas y versionadas](docs/SKILLS.md), con licencias, referencias y comandos de comprobación y recuperación.

Desde 0.9.0, **Agenda → Reuniones** permite alternar **Mes · Lista** y consultar una o todas las asambleas autorizadas. Consulta [uso, impresión y modo offline](docs/REUNIONES-VISTAS.md). Actualizar esta versión solo requiere Hosting.

Desde 0.10.0, **Más → Permisos** separa los accesos de la asamblea y la administración general. **Persona → Acciones → Revisar** muestra qué puede hacer cada cuenta, con Consulta o Gestión, acciones individuales y revisión de permisos añadidos o retirados. [Guía de permisos](docs/PERMISOS.md). Mantiene los cargos, las seis capacidades y las reglas actuales. Actualización solo de Hosting.

**Código disponible para uso no comercial**, bajo [PolyForm Noncommercial 1.0.0](LICENSE). Permite usar, modificar y distribuir respetando sus condiciones. Las dependencias conservan sus licencias; consulta [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Empezar

1. Descarga este repositorio con **Code → Download ZIP**, extrae el ZIP y abre la carpeta que contiene `package.json`. También puedes usar Git.
2. Instala **Node.js 24 LTS**. Git solo es necesario si quieres clonar o actualizar mediante Git.
3. En PowerShell, desde esa carpeta:

```powershell
npm.cmd ci
npm.cmd run dev:demo
```

Abre la dirección local que muestra Vite. Debe aparecer **Datos ficticios**. La demostración funciona sin cuentas cloud y guarda cambios solo en tu navegador. No introduzcas información real.

En macOS/Linux usa `npm` y `npx` donde esta guía escribe `npm.cmd` y `npx.cmd`.

## Instalar para tu organización

Sigue la [guía completa de instalación](docs/INSTALACION.md). Necesitarás tu propio proyecto Firebase Spark **sin facturación vinculada**, una cuenta Cloudflare Free y un Gmail remitente. El acceso con Google y el consentimiento para enviar correo son autorizaciones diferentes.

Puedes pedir a cualquier IA: «Lee AGENTS.md y docs/INSTALACION.md. Ayúdame a instalar este programa con mis cuentas, comprueba lo que ya está hecho y continúa desde el primer paso pendiente. No actives servicios de pago ni me pidas contraseñas o tokens en el chat».

La IA puede preparar archivos, ejecutar comprobaciones y explicar cada pantalla. Los accesos, consentimientos y verificaciones de identidad deben completarse en las páginas oficiales con la cuenta elegida.

## Cargar tu organización

En **Más → Importar** descarga la plantilla, completa las hojas necesarias y revisa el resultado antes de guardar. También están disponibles:

- [Plantilla vacía](public/templates/ls-asambleas-plantilla.xlsx).
- [Ejemplo ficticio](public/templates/ls-asambleas-ejemplo.xlsx).
- [Guía del Excel, códigos y actualizaciones](docs/IMPORTACION-EXCEL.md).

Importar no envía correos ni publica turnos. Dar acceso es una selección posterior independiente.

## Mantener y verificar

- [Lista final de puesta en marcha](docs/COMPROBACION.md).
- [Actualización, copias, recuperación y cambios de cuenta](docs/MANTENIMIENTO.md).
- [Arquitectura y desarrollo](docs/ARQUITECTURA.md).
- [Estado de validación de esta entrega](docs/VALIDACION.md).

```powershell
npm.cmd test
npm.cmd run skills:check
npm.cmd run test:skills
npm.cmd run test:installation
npm.cmd run check:worker
npm.cmd run build
```

El coste cero depende de mantener los planes gratuitos. Al agotar una cuota puede interrumpirse el servicio; no hay capacidad ilimitada. Los scripts detienen el despliegue si no pueden confirmar los planes o si los destinos no coinciden. No añadas una cuenta de facturación ni actives Blaze para resolver un error de cuota.
