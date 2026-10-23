# LS Asambleas

Aplicación visual para coordinar asambleas de lengua de signos: equipo, aprobaciones, turnos, programa, plataforma, reuniones, avisos e histórico. Funciona en móvil y ordenador. Incluye consulta offline explícita e impresión.

**Código disponible para uso no comercial**, bajo [PolyForm Noncommercial 1.0.0](LICENSE). Permite usar, modificar y distribuir respetando sus condiciones. Las dependencias conservan sus licencias; consulta [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Empezar

1. Descarga este repositorio con **Code → Download ZIP**, extrae el ZIP y abre la carpeta que contiene `package.json`. También puedes usar Git.
2. Instala **Node.js 24 LTS**. Git solo es necesario si quieres clonar o actualizar mediante Git.
3. En PowerShell, desde esa carpeta:

```powershell
npm.cmd ci
npm.cmd run dev
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
npm.cmd run test:installation
npm.cmd run check:worker
npm.cmd run build
```

El coste cero depende de mantener los planes gratuitos. Al agotar una cuota puede interrumpirse el servicio; no hay capacidad ilimitada. Los scripts detienen el despliegue si no pueden confirmar los planes o si los destinos no coinciden. No añadas una cuenta de facturación ni actives Blaze para resolver un error de cuota.
